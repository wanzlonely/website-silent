"use client";

import { useState, useEffect, useCallback } from 'react';

/* ── Icon Components ── */
const Icon = ({ d, size = 18, className = "" }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{d.split('|').map((p, i) => {
    if (p.startsWith('C')) return <circle key={i} cx={p.split(',')[1]} cy={p.split(',')[2]} r={p.split(',')[3]} />;
    if (p.startsWith('R')) { const v = p.split(','); return <rect key={i} x={v[1]} y={v[2]} width={v[3]} height={v[4]} rx={v[5] || "0"} />; }
    if (p.startsWith('L')) { const v = p.split(','); return <line key={i} x1={v[1]} y1={v[2]} x2={v[3]} y2={v[4]} />; }
    if (p.startsWith('PL')) return <polyline key={i} points={p.substring(2)} />;
    if (p.startsWith('PG')) return <polygon key={i} points={p.substring(2)} />;
    return <path key={i} d={p} />;
  })}</svg>
);

/* ── Nav Items ── */
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Home', icon: 'R,3,3,7,7,1.5|R,14,3,7,7,1.5|R,14,14,7,7,1.5|R,3,14,7,7,1.5' },
  { id: 'execution', label: 'Execute', icon: 'PG13 2 3 14 12 14 11 22 21 10 12 10 13 2' },
  { id: 'history', label: 'Logs', icon: 'C,12,12,10|PL12 6 12 12 16 14' },
  { id: 'profile', label: 'Profile', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|C,12,7,4' },
];

/* ── StatusBadge ── */
function StatusBadge({ text, variant = 'default' }: { text: string; variant?: 'default' | 'blue' | 'green' }) {
  const colors = {
    default: 'border-zinc-700 text-zinc-400 bg-zinc-800/50',
    blue: 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10',
    green: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
  };
  return <span className={`text-[10px] px-3 py-1.5 rounded-lg border tracking-[0.15em] font-semibold ${colors[variant]}`}>{text}</span>;
}

/* ── StatCard ── */
function StatCard({ label, value, accentColor, glow, pulse }: { label: string; value: string | number; accentColor: string; glow: string; pulse?: boolean }) {
  return (
    <div className="glass p-5 relative overflow-hidden group cursor-default">
      <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r ${accentColor}`} />
      <div className="flex justify-between items-start mb-4">
        <span className="label">{label}</span>
        {pulse && <div className={`w-2 h-2 rounded-full bg-emerald-400 glow-dot`} />}
      </div>
      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${glow} transition-all duration-300 group-hover:scale-110`}>
        <span className="text-lg font-bold">{value}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/* ── MAIN COMPONENT ── */
/* ══════════════════════════════════════════════════════════ */

export default function DashboardClient({ initialData }: { initialData: any }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [prevTab, setPrevTab] = useState('dashboard');
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'info' }>({
    show: false,
    message: '',
    type: 'success'
  });

  const triggerToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 2500);
  };
  const [mounted, setMounted] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [showPairing, setShowPairing] = useState(false);
  const [pairingStep, setPairingStep] = useState<'phone' | 'code' | 'success'>('phone');
  const [pairingCode, setPairingCode] = useState('');
  const [pairingPhone, setPairingPhone] = useState('');
  const [countdown, setCountdown] = useState(0);

  const user = initialData?.user || {};
  const history = initialData?.history || [];

  const [senders, setSenders] = useState<any[]>(() => user.whatsappSenders || []);
  const [confirmDeletePhone, setConfirmDeletePhone] = useState<string | null>(null);
  const [targetPhone, setTargetPhone] = useState('');
  const [isServerOnline, setIsServerOnline] = useState(true);
  const [protocol, setProtocol] = useState('A');
  const [showProtocolDropdown, setShowProtocolDropdown] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('username');
    if (!saved) {
      window.location.href = '/login';
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const urlUsername = urlParams.get('username');
      if (urlUsername !== saved) {
        window.location.href = `/dashboard?username=${saved}`;
      }
    }
  }, [user.username]);

  // Polling WhatsApp senders status from API
  useEffect(() => {
    if (!user.username) return;

    const fetchSenders = async () => {
      try {
        const res = await fetch(`/api/senders?username=${user.username}`);
        if (res.ok) {
          const data = await res.json();
          if (data.whatsappSenders) {
            setSenders(data.whatsappSenders);
          }
          setIsServerOnline(true);
        } else {
          setIsServerOnline(false);
        }
      } catch (err) {
        // Suppress print to console or set offline silently to avoid spamming
        setIsServerOnline(false);
      }
    };

    fetchSenders(); // fetch immediately
    const interval = setInterval(fetchSenders, 5000); // poll every 5 seconds
    return () => clearInterval(interval);
  }, [user.username]);

  // Countdown timer for pairing code expiry
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const switchTab = useCallback((id: string) => {
    if (id === activeTab) return;
    setPrevTab(activeTab);
    setActiveTab(id);
    setAnimKey(k => k + 1);
  }, [activeTab]);

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPhone.trim()) return;

    triggerToast("SENDING PAYLOAD...", "info");

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          targetNumber: targetPhone,
          protocol: protocol
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast("EXECUTION INITIATED", "success");
        setTargetPhone('');
      } else {
        triggerToast(data.error || "FAILED TO SEND PAYLOAD", "info");
      }
    } catch (err) {
      console.error(err);
      triggerToast("SERVER UNREACHABLE", "info");
    }
  };

  const openPairing = () => {
    setPairingStep('phone');
    setPairingPhone('');
    setPairingCode('');
    setShowPairing(true);
  };

  const generatePairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingPhone.trim()) return;

    try {
      triggerToast("GENERATING CODE...", "info");
      const res = await fetch('/api/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, number: pairingPhone })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.alreadyLinked) {
          triggerToast("SENDER ALREADY LINKED", "success");
          setShowPairing(false);
        } else {
          setPairingCode(data.pairingCode);
          setPairingStep('code');
          setCountdown(120);
          triggerToast("PAIRING CODE GENERATED", "info");
        }
      } else {
        triggerToast(data.error || "FAILED TO GENERATE CODE", "info");
      }
    } catch (err) {
      console.error(err);
      triggerToast("SERVER UNREACHABLE", "info");
    }
  };

  const confirmPairing = () => {
    setShowPairing(false);
    triggerToast("WAITING FOR WHATSAPP TO SYNC...", "info");
  };

  const handleRemoveSender = async (num: string) => {
    try {
      const res = await fetch('/api/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, number: num })
      });
      if (res.ok) {
        setSenders(prev => prev.filter(s => s.number !== num));
        triggerToast("SENDER DISCONNECTED", "info");
      } else {
        triggerToast("FAILED TO DISCONNECT", "info");
      }
    } catch (err) {
      triggerToast("SERVER UNREACHABLE", "info");
    }
  };

  if (!mounted) return null;

  const userExists = !!initialData?.user;

  if (!userExists) {
    return (
      <>
        {/* Animated background mesh */}
        <div className="bg-mesh" />

        <div className="relative z-10 w-full max-w-[430px] mx-auto min-h-[100dvh] flex flex-col justify-center px-6">
          <div className="glass p-8 text-center anim-slide-up relative overflow-hidden">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-60 h-60 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                <span className="text-4xl">🔒</span>
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-[0.2em] text-white">ACCESS DENIED</h2>
                <p className="text-[9px] tracking-[0.15em] text-red-400 mt-1 font-semibold">NODE UNREGISTERED</p>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed tracking-wide">
                This username {initialData?.queryUsername ? (
                  <span className="text-zinc-200 font-mono font-bold">"{initialData.queryUsername}"</span>
                ) : 'is'} is not registered in the system database. Accounts must be provisioned via the secure Telegram gateway by an Owner or Reseller.
              </p>
              <div className="p-4 rounded-xl bg-zinc-950/45 border border-zinc-800/80 text-left space-y-2">
                <p className="text-[10px] text-zinc-500 tracking-wider font-bold">REGISTRATION PROCESS</p>
                <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                  1. Contact the Telegram Bot or administrator.<br />
                  2. Request user registration using your username.<br />
                  3. Access this URL using the generated link.
                </p>
              </div>
              <div className="pt-2">
                <a
                  href="https://t.me/VannessWangsaff"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary w-full inline-flex items-center justify-center gap-2 text-center text-xs py-3.5"
                >
                  <span className="relative z-10">OPEN TELEGRAM BOT</span>
                </a>
              </div>
            </div>
          </div>
          <div className="text-center mt-6">
            <p className="text-[10px] tracking-[0.2em] text-zinc-600 font-bold">CREDIT BY @VANNESSWANGSAFF</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Animated background mesh */}
      <div className="bg-mesh" />

      <div className="relative z-10 w-full max-w-[430px] mx-auto min-h-[100dvh] flex flex-col pb-[88px]">

        {/* ── HEADER ── */}
        <header className="flex justify-between items-center px-5 pt-8 pb-4">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => setShowSidebar(true)}
              className="w-10 h-10 rounded-2xl glass flex items-center justify-center hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
            >
              <Icon d="L,3,12,21,12|L,3,6,21,6|L,3,18,21,18" size={16} className="text-zinc-400" />
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-[0.2em] text-white">DASHBOARD</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[9px] tracking-[0.15em] text-zinc-600">THE EXECUTOR v1.0</p>
                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                <span className={`inline-flex items-center gap-1 text-[8px] font-bold tracking-wider ${isServerOnline ? 'text-emerald-400' : 'text-red-400 animate-pulse'}`}>
                  <span className={`w-1 h-1 rounded-full ${isServerOnline ? 'bg-emerald-400 glow-dot' : 'bg-red-400'}`} />
                  {isServerOnline ? 'API ONLINE' : 'API OFFLINE'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ── CONTENT ── */}
        <main className="flex-1 px-5 overflow-y-auto" key={animKey}>

          {/* ═══ DASHBOARD TAB ═══ */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">

              {/* Profile Section (Sleek Glass Capsule layout) */}
              <section className="glass rounded-[30px] p-5 relative overflow-hidden anim-slide-up anim-stagger-1 border border-white/5 shadow-2xl">
                {/* Asymmetric glowing lights */}
                <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="relative flex items-center gap-5">
                  {/* Glowing Circular Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-[68px] h-[68px] rounded-full p-[2px] bg-gradient-to-tr from-indigo-500 via-purple-500 to-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.25)]">
                      <div className="w-full h-full rounded-full bg-[#0c0c10] flex items-center justify-center">
                        <span className="text-2xl font-black text-white/90 font-orbitron">
                          {(user.username || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {/* Active dot */}
                    <div className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-[3px] border-[#0c0c10] glow-dot" />
                  </div>

                  {/* Profile Details */}
                  <div className="min-w-0 flex-1">
                    <span className="text-[8px] tracking-[0.2em] font-semibold text-zinc-500 block mb-0.5 uppercase">
                      USER INFORMATION
                    </span>
                    <h2 className="text-lg font-black tracking-[0.12em] text-white truncate uppercase font-orbitron flex items-center gap-1.5">
                      <span className="truncate">{user.username || 'GUEST'}</span>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 drop-shadow-[0_0_6px_rgba(0,149,246,0.65)]">
                        <path
                          d="M22.25 12c0-1.43-.88-2.67-2.15-3.26.15-.39.24-.82.24-1.27 0-2-1.61-3.64-3.6-3.64-.45 0-.87.09-1.27.24C14.88 2.8 13.56 2 12 2s-2.88.8-3.47 2.07c-.4-.15-.82-.24-1.27-.24-1.99 0-3.6 1.64-3.6 3.64 0 .45.09.88.24 1.27-1.27.59-2.15 1.83-2.15 3.26 0 1.43.88 2.67 2.15 3.26-.15.39-.24.82-.24 1.27 0 2 1.61 3.64 3.6 3.64.45 0 .87-.09 1.27-.24.59 1.27 1.91 2.07 3.47 2.07s2.88-.8 3.47-2.07c.4.15.82.24 1.27.24 1.99 0 3.6-1.64 3.6-3.64 0-.45-.09-.88-.24-1.27 1.27-.59 2.15-1.83 2.15-3.26z"
                          fill="#0095f6"
                        />
                        <path
                          d="M7.5 12.5L10 15L16.5 8.5"
                          stroke="#ffffff"
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    </h2>

                    {/* Minimalist Details Row (replacing boxy badges) */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        <span className="text-[9px] tracking-wider text-indigo-300 font-bold uppercase font-orbitron">{user.status || 'USER'}</span>
                      </div>
                      <div className="h-3 w-[1px] bg-zinc-800" />
                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                        <span className="text-[9px] tracking-widest font-semibold font-mono text-zinc-400 uppercase">EXP {user.activeUntil || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 anim-slide-up anim-stagger-2">
                <StatCard
                  label="ONLINE"
                  value={senders.filter(s => s.linked).length}
                  accentColor="from-emerald-500 to-emerald-400"
                  glow="border-emerald-500/20 text-emerald-400 bg-emerald-500/10"
                  pulse={senders.some(s => s.linked)}
                />

                {/* WhatsApp Senders Count Card */}
                <div className="glass p-4 relative overflow-hidden group cursor-default">
                  <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r ${senders.length > 0 ? 'from-emerald-500 to-emerald-400' : 'from-zinc-600 to-zinc-500'}`} />
                  <div className="flex justify-between items-start mb-3">
                    <span className="label">WA SENDER</span>
                    {senders.some(s => s.linked) && <div className="w-2 h-2 rounded-full bg-emerald-400 glow-dot" />}
                  </div>
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${senders.length > 0 ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10' : 'border-zinc-600/30 text-zinc-500 bg-zinc-800/50'}`}>
                    <span className="text-lg font-bold font-orbitron text-white">{senders.length}</span>
                  </div>
                  <p className={`text-[9px] mt-3 tracking-widest font-semibold ${senders.length > 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {senders.length > 0 ? 'ACTIVE DEPLOYED' : 'NO SENDERS'}
                  </p>
                </div>
              </div>

              {/* WA SENDERS MANAGER */}
              <section className="glass p-5 space-y-4 anim-slide-up anim-stagger-3 border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-indigo-400"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.327 0-4.47-.781-6.191-2.093l-.367-.291-2.694.903.903-2.694-.291-.367A9.935 9.935 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" /></svg>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold tracking-[0.2em] text-white uppercase font-orbitron">WA Senders</h3>
                      <p className="text-[8px] tracking-[0.15em] text-zinc-500 font-semibold uppercase">Manage Connections</p>
                    </div>
                  </div>
                  <button
                    onClick={openPairing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 text-indigo-300 bg-indigo-500/10 text-[9px] tracking-[0.15em] font-bold transition-all hover:bg-indigo-500/20 active:scale-95"
                  >
                    <span>+ ADD SENDER</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {senders.length === 0 ? (
                    <div className="glass-subtle p-6 text-center border border-dashed border-zinc-800 rounded-xl">
                      <p className="text-[10px] text-zinc-500 tracking-[0.15em] font-bold uppercase mb-1">No Senders Connected</p>
                      <p className="text-[9px] text-zinc-600 leading-relaxed max-w-[280px] mx-auto">Link your first WhatsApp account using the Pairing Code method to start sending messages.</p>
                    </div>
                  ) : (
                    senders.map((sender) => (
                      <div key={sender.number} className="glass-subtle p-3.5 rounded-xl border border-white/5 flex items-center justify-between transition-all hover:border-zinc-800">
                        {confirmDeletePhone === sender.number ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[9px] tracking-[0.15em] text-red-400 font-bold uppercase">Disconnect Sender?</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  handleRemoveSender(sender.number);
                                  setConfirmDeletePhone(null);
                                }}
                                className="px-2.5 py-1 rounded bg-red-500/20 border border-red-500/30 text-red-300 text-[9px] tracking-[0.12em] font-bold hover:bg-red-500/35 active:scale-95"
                              >
                                DISCONNECT
                              </button>
                              <button
                                onClick={() => setConfirmDeletePhone(null)}
                                className="px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-[9px] tracking-[0.12em] font-bold hover:bg-zinc-700 active:scale-95"
                              >
                                CANCEL
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-[#0e0e14] border border-zinc-800 flex items-center justify-center flex-shrink-0">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className={sender.linked ? "text-emerald-400" : "text-zinc-500"}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.327 0-4.47-.781-6.191-2.093l-.367-.291-2.694.903.903-2.694-.291-.367A9.935 9.935 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" /></svg>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-zinc-200 font-mono tracking-wider truncate">{sender.number}</p>
                                <p className="text-[8px] text-zinc-500 font-semibold tracking-wider uppercase mt-0.5">
                                  {sender.connectedAt ? `Linked: ${sender.connectedAt}` : 'Linked status unknown'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] px-2 py-0.5 rounded border tracking-[0.15em] font-semibold ${sender.linked
                                ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5'
                                : 'border-zinc-800 text-zinc-500 bg-zinc-900/50'
                                }`}>
                                {sender.linked ? 'ONLINE' : 'OFFLINE'}
                              </span>
                              <button
                                onClick={() => setConfirmDeletePhone(sender.number)}
                                className="w-8 h-8 rounded-lg bg-zinc-950/40 border border-zinc-800/80 flex items-center justify-center text-zinc-500 hover:text-red-400 hover:border-red-500/20 active:scale-95 transition-all"
                                title="Disconnect"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Credit Card with GIF Background */}
              <div className="glass p-0 overflow-hidden anim-slide-up anim-stagger-4 group cursor-pointer relative h-[140px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                {/* Background GIF */}
                <img
                  src="https://media1.tenor.com/m/sxpgGK7u-T4AAAAd/higuruma-hiromi.gif"
                  alt="JJK Higuruma"
                  className="absolute inset-0 w-full h-full object-cover object-top opacity-50 group-hover:scale-105 transition-transform duration-700 ease-out pointer-events-none"
                />

                {/* Glass and Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/20 to-transparent" />
                <div className="absolute inset-0 bg-black/20" />

                {/* Glowing border outline */}
                <div className="absolute inset-0 border border-white/5 rounded-2xl group-hover:border-indigo-500/30 transition-colors duration-500" />

                {/* Text Content */}
                <div className="absolute inset-0 flex items-center justify-center p-5 z-10">
                  <h3 className="text-xl font-black tracking-[0.25em] text-shimmer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] font-orbitron uppercase text-center">
                    THE EXECUTOR
                  </h3>
                </div>
              </div>

              {/* Notice */}
              <div className="glass-subtle p-4 border-l-2 border-l-amber-500/40 anim-slide-up anim-stagger-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <span className="text-xs">⚠️</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed tracking-wide">
                    <span className="text-zinc-300 font-semibold">NOTICE</span> — Account provisioning requires Owner/Reseller authorization via secure Telegram gateway.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══ EXECUTION TAB ═══ */}
          {activeTab === 'execution' && (
            <div className="space-y-5">
              <div className="glass p-6 anim-slide-up anim-stagger-1 relative overflow-visible">
                <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center glow-indigo">
                      <Icon d="PG13 2 3 14 12 14 11 22 21 10 12 10 13 2" size={18} className="text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold tracking-[0.2em] text-zinc-200">INITIALIZE TARGET</h2>
                      <p className="text-[9px] text-zinc-600 tracking-[0.15em] mt-0.5">SECURE PAYLOAD GATEWAY</p>
                    </div>
                  </div>

                  <form onSubmit={handleExecute} className="space-y-5">
                    <div className="space-y-2.5">
                      <label className="label">TARGET IDENTIFIER</label>
                      <input
                        type="text"
                        className="input-glass"
                        placeholder="Enter phone number..."
                        value={targetPhone}
                        onChange={e => setTargetPhone(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2.5">
                      <label className="label">PAYLOAD</label>
                      <div className="relative">
                        {/* Custom Dropdown Trigger */}
                        <button
                          type="button"
                          onClick={() => setShowProtocolDropdown(!showProtocolDropdown)}
                          className="input-glass w-full text-left flex items-center justify-between pr-10 cursor-pointer relative"
                        >
                          <div>
                            <span className="text-zinc-200 text-xs font-bold font-mono">
                              {protocol === 'A' && 'TES PLAIN TEXT'}
                              {protocol === 'B' && 'TES ADS MESSAGE'}
                              {protocol === 'C' && 'BUG EVENT'}
                              {protocol === 'D' && 'BUG BUFFER IMAGE'}
                            </span>
                          </div>
                          <div className={`absolute right-4 top-1/2 -translate-y-1/2 transition-transform duration-300 ${showProtocolDropdown ? 'rotate-180' : ''}`}>
                            <Icon d="PL6 9 12 15 18 9" size={14} className="text-zinc-500" />
                          </div>
                        </button>

                        {showProtocolDropdown && (
                          <>

                            <div className="fixed inset-0 z-40" onClick={() => setShowProtocolDropdown(false)} />

                            <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-[#050507] border border-zinc-700/80 rounded-2xl p-2.5 z-50 space-y-1 shadow-[0_12px_45px_rgba(0,0,0,0.95)] max-h-[170px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-zinc-800 anim-slide-up">
                              {[
                                { id: 'A', name: 'TES PLAIN TEXT', desc: 'Standard text notification' },
                                { id: 'B', name: 'TES ADS MESSAGE', desc: 'Interactive banner layout' },
                                { id: 'C', name: 'BUG EVENT', desc: 'Calendar invitation view' },
                                { id: 'D', name: 'BUG BUFFER IMAGE', desc: 'Image buffer rendering' },
                              ].map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    setProtocol(opt.id);
                                    setShowProtocolDropdown(false);
                                  }}
                                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 flex flex-col gap-0.5 ${protocol === opt.id
                                    ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300'
                                    : 'border border-transparent hover:bg-white/5 text-zinc-400 hover:text-zinc-200'
                                    }`}
                                >
                                  <span className="text-[10px] tracking-widest font-bold font-orbitron">{opt.name}</span>
                                  <span className="text-[9px] text-zinc-500 leading-tight">{opt.desc}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="pt-3">
                      {!isServerOnline && (
                        <p className="text-[10px] text-red-400 font-bold text-center uppercase tracking-wide mb-2">
                          ⚠️ API Server is Offline. Start the bot first!
                        </p>
                      )}
                      <button
                        type="submit"
                        className={`btn-primary w-full flex items-center justify-center gap-3 ${!isServerOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={!isServerOnline}
                      >
                        <Icon d="PG13 2 3 14 12 14 11 22 21 10 12 10 13 2" size={16} className="relative z-10" />
                        <span className="relative z-10">EXECUTE</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ═══ HISTORY TAB ═══ */}
          {activeTab === 'history' && (
            <div className="space-y-5">
              <div className="glass p-5 anim-slide-up anim-stagger-1">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center">
                      <Icon d="C,12,12,10|PL12 6 12 12 16 14" size={16} className="text-zinc-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold tracking-[0.2em] text-zinc-200">EXEC LOGS</h2>
                      <p className="text-[9px] text-zinc-600 tracking-[0.15em] mt-0.5">{history.length} RECORDS</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {history.map((h: any, idx: number) => (
                    <div key={h.id} className={`glass-subtle p-4 hover:border-white/10 transition-all duration-300 anim-slide-up anim-stagger-${Math.min(idx + 2, 4)}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-600 font-mono">#{String(h.id).padStart(3, '0')}</span>
                          <div className={`w-1.5 h-1.5 rounded-full ${h.status === 'Success' ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                        </div>
                        <StatusBadge text={h.status} variant={h.status === 'Success' ? 'green' : 'default'} />
                      </div>
                      <p className="text-[15px] text-zinc-200 tracking-wider font-bold mb-2 font-mono">{h.target}</p>
                      <div className="flex justify-between items-center">
                        <span className="label text-zinc-600">{h.payload}</span>
                        <span className="text-[10px] text-zinc-700 tracking-wide">{h.date}</span>
                      </div>
                    </div>
                  ))}

                  {history.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
                        <Icon d="C,12,12,10|PL12 6 12 12 16 14" size={24} className="text-zinc-700" />
                      </div>
                      <p className="label text-zinc-600">NO RECORDS FOUND</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ PROFILE TAB ═══ */}
          {activeTab === 'profile' && (
            <div className="space-y-5">

              {/* Avatar + Identity Card */}
              <section className="glass rounded-[28px] p-6 relative overflow-hidden anim-slide-up anim-stagger-1 border border-white/5 shadow-2xl">
                {/* Ambient glows */}
                <div className="absolute -top-16 -left-16 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-purple-500/8 rounded-full blur-3xl pointer-events-none" />

                <div className="relative flex flex-col items-center text-center">
                  {/* Glowing Avatar */}
                  <div className="relative mb-5">
                    <div className="w-[88px] h-[88px] rounded-full p-[2.5px] bg-gradient-to-tr from-zinc-600 via-zinc-500 to-zinc-600 shadow-[0_0_25px_rgba(161,161,170,0.15)]">
                      <div className="w-full h-full rounded-full bg-[#0c0c10] flex items-center justify-center">
                        <span className="text-3xl font-black text-white/90 font-orbitron">
                          {(user.username || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {/* Active dot */}
                    <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full border-[3px] border-[#0c0c10] glow-dot" />
                  </div>

                  {/* Username + Verified */}
                  <h2 className="text-xl font-black tracking-[0.15em] text-white uppercase font-orbitron flex items-center gap-1.5">
                    <span>{user.username || 'GUEST'}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 drop-shadow-[0_0_6px_rgba(0,149,246,0.65)]">
                      <path d="M22.25 12c0-1.43-.88-2.67-2.15-3.26.15-.39.24-.82.24-1.27 0-2-1.61-3.64-3.6-3.64-.45 0-.87.09-1.27.24C14.88 2.8 13.56 2 12 2s-2.88.8-3.47 2.07c-.4-.15-.82-.24-1.27-.24-1.99 0-3.6 1.64-3.6 3.64 0 .45.09.88.24 1.27-1.27.59-2.15 1.83-2.15 3.26 0 1.43.88 2.67 2.15 3.26-.15.39-.24.82-.24 1.27 0 2 1.61 3.64 3.6 3.64.45 0 .87-.09 1.27-.24.59 1.27 1.91 2.07 3.47 2.07s2.88-.8 3.47-2.07c.4.15.82.24 1.27.24 1.99 0 3.6-1.64 3.6-3.64 0-.45-.09-.88-.24-1.27 1.27-.59 2.15-1.83 2.15-3.26z" fill="#0095f6" />
                      <path d="M7.5 12.5L10 15L16.5 8.5" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  </h2>

                  <p className="text-[8px] tracking-[0.2em] text-zinc-500 font-bold mt-1.5 uppercase">Authenticated Operator Node</p>

                  {/* Status Badges Row */}
                  <div className="flex items-center gap-2 mt-4">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" /></svg>
                      <span className="text-[9px] tracking-[0.15em] font-bold text-indigo-300">{user.status || 'USER'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 glow-dot" />
                      <span className="text-[9px] tracking-[0.15em] font-bold text-emerald-300">ACTIVE</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Account Details */}
              <div className="glass p-5 anim-slide-up anim-stagger-2 space-y-0 divide-y divide-zinc-800/50">
                {[
                  {
                    label: 'USERNAME',
                    value: user.username || 'Guest',
                    icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
                    iconExtra: 'C,12,7,4',
                    color: 'text-indigo-400'
                  },
                  {
                    label: 'ROLE',
                    value: user.status || 'User',
                    icon: 'M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z',
                    color: 'text-purple-400'
                  },
                  {
                    label: 'EXEC LIMIT',
                    value: user.limit || 0,
                    icon: 'PG13 2 3 14 12 14 11 22 21 10 12 10 13 2',
                    color: 'text-amber-400'
                  },
                  {
                    label: 'EXPIRES',
                    value: user.activeUntil || 'N/A',
                    icon: 'R,3,4,18,18,2|L,16,2,16,6|L,8,2,8,6|L,3,10,21,10',
                    color: 'text-emerald-400'
                  },
                  {
                    label: 'WA SENDERS',
                    value: `${senders.filter(s => s.linked).length} Online / ${senders.length} Total`,
                    icon: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
                    color: 'text-cyan-400'
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3.5 py-4 first:pt-0 last:pb-0">
                    <div className={`w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0`}>
                      <Icon d={item.icon + (item.iconExtra ? '|' + item.iconExtra : '')} size={14} className={item.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] tracking-[0.15em] text-zinc-500 font-bold">{item.label}</p>
                      <p className="text-[13px] font-bold text-zinc-200 tracking-wider truncate mt-0.5">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* System Information */}
              <div className="glass p-5 anim-slide-up anim-stagger-3 relative overflow-hidden">
                <div className="absolute -top-16 -right-16 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <Icon d="R,2,3,20,14,2|L,8,21,16,21|L,12,17,12,21" size={14} className="text-zinc-400" />
                    </div>
                    <div>
                      <h3 className="text-[10px] font-bold tracking-[0.2em] text-zinc-300 uppercase">System Info</h3>
                      <p className="text-[8px] tracking-[0.15em] text-zinc-600 font-semibold">Runtime Environment</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'VERSION', value: 'v1.0' },
                      { label: 'ENGINE', value: 'Baileys' },
                      { label: 'FRAMEWORK', value: 'Next.js' },
                      { label: 'PROTOCOL', value: 'Multi-Device' },
                    ].map((item, i) => (
                      <div key={i} className="glass-subtle p-3 rounded-xl">
                        <p className="text-[8px] tracking-[0.15em] text-zinc-600 font-bold">{item.label}</p>
                        <p className="text-[11px] font-bold text-zinc-300 tracking-wider mt-0.5">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* JANGAN PERNAH DELETE / UBAH APAPUN, KALAU MAU NAMBAH GAPAPA */}
              <div className="glass p-5 text-center anim-slide-up anim-stagger-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/3 to-transparent pointer-events-none" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                  </div>
                  <p className="text-[8px] tracking-[0.2em] text-zinc-500 font-bold uppercase mb-1">System Developer</p>
                  <p className="text-base font-extrabold tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 font-orbitron">@VANNESSWANGSAFF</p>
                  <div className="flex justify-center gap-2.5 mt-5">
                    <a href="https://whatsapp.com/channel/0029Vak1Mh81noz57tVkqv2y" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] tracking-[0.12em] font-bold hover:bg-emerald-500/15 hover:border-emerald-500/30 active:scale-95 transition-all">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.327 0-4.47-.781-6.191-2.093l-.367-.291-2.694.903.903-2.694-.291-.367A9.935 9.935 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" /></svg>
                      WHATSAPP
                    </a>
                    <a href="https://t.me/VannessWangsaff" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] tracking-[0.12em] font-bold hover:bg-indigo-500/15 hover:border-indigo-500/30 active:scale-95 transition-all">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.492-1.302.48-.428-.013-1.252-.242-1.865-.442-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                      TELEGRAM
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ── BOTTOM NAVIGATION ── */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 px-4 pb-4 pt-2">
          <div className="glass bg-black/70 backdrop-blur-2xl rounded-2xl flex justify-around items-center p-1.5 border-zinc-800/80 shadow-[0_-8px_40px_rgba(0,0,0,0.6)]">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => switchTab(item.id)}
                  className={`relative flex flex-col items-center gap-1 w-[72px] py-2.5 rounded-xl transition-all duration-300
                    ${isActive ? 'text-white' : 'text-zinc-600 hover:text-zinc-400 active:scale-95'}`}
                >
                  {/* Active indicator line */}
                  <div className={`absolute top-0 w-6 h-[3px] rounded-b-full transition-all duration-300
                    ${isActive ? 'bg-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.6)] opacity-100' : 'opacity-0'}`}
                  />

                  {/* Active background glow */}
                  {isActive && <div className="absolute inset-0 rounded-xl bg-indigo-500/5" />}

                  <div className="relative mt-1">
                    <Icon d={item.icon} size={20} />
                  </div>
                  <span className={`text-[9px] tracking-[0.12em] font-bold relative ${isActive ? 'text-indigo-300' : ''}`}>
                    {item.label.toUpperCase()}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── TOAST NOTIFICATION ── */}
        {toast.show && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 anim-slide-up">
            <div className={`glass px-6 py-3.5 flex items-center gap-3 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] ${toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 glow-green'
              : 'bg-indigo-500/10 border-indigo-500/30 glow-indigo'
              }`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toast.type === 'success' ? 'bg-emerald-500/20' : 'bg-indigo-500/20'
                }`}>
                {toast.type === 'success' ? (
                  <Icon d="PL20 6 9 17 4 12" size={14} className="text-emerald-400" />
                ) : (
                  <Icon d="C,12,12,10|PL12 6 12 12 16 14" size={14} className="text-indigo-400" />
                )}
              </div>
              <span className={`text-xs font-bold tracking-[0.15em] ${toast.type === 'success' ? 'text-emerald-300' : 'text-indigo-300'
                }`}>{toast.message}</span>
            </div>
          </div>
        )}

        {/* ── WHATSAPP PAIRING MODAL ── */}
        {showPairing && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => { setShowPairing(false); setCountdown(0); }}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal Sheet */}
            <div
              className="relative w-full max-w-[430px] bg-[#0c0c10] border-t border-x border-zinc-800 rounded-t-3xl p-6 pb-10 anim-slide-up"
              onClick={e => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />

              {/* Step: Enter Phone Number */}
              {pairingStep === 'phone' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-emerald-400"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.327 0-4.47-.781-6.191-2.093l-.367-.291-2.694.903.903-2.694-.291-.367A9.935 9.935 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold tracking-[0.15em] text-white">LINK WHATSAPP</h3>
                    <p className="text-[11px] text-zinc-500 tracking-wide mt-1">Enter your WhatsApp number to generate a pairing code</p>
                  </div>

                  <form onSubmit={generatePairingCode} className="space-y-4">
                    <div className="space-y-2">
                      <label className="label">PHONE NUMBER</label>
                      <input
                        type="tel"
                        className="input-glass text-center text-lg tracking-[0.3em]"
                        placeholder="08XXXXXXXXXX"
                        value={pairingPhone}
                        onChange={e => setPairingPhone(e.target.value)}
                        required
                      />
                    </div>
                    {!isServerOnline && (
                      <p className="text-[10px] text-red-400 font-bold text-center uppercase tracking-wide">
                        ⚠️ API Server is Offline. Start the bot first!
                      </p>
                    )}
                    <button
                      type="submit"
                      className={`btn-primary w-full ${!isServerOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={!isServerOnline}
                    >
                      GENERATE PAIRING CODE
                    </button>
                  </form>
                </div>
              )}

              {/* Step: Show Pairing Code */}
              {pairingStep === 'code' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    </div>
                    <h3 className="text-lg font-bold tracking-[0.15em] text-white">PAIRING CODE</h3>
                    <p className="text-[11px] text-zinc-500 tracking-wide mt-1">Enter this code on your WhatsApp app</p>
                  </div>

                  {/* The Code Display */}
                  <div className="glass p-6 text-center glow-indigo">
                    <p className="text-3xl font-bold tracking-[0.5em] text-white font-mono">
                      {pairingCode.substring(0, 4)}-{pairingCode.substring(4)}
                    </p>
                  </div>

                  {/* Target Number */}
                  <div className="glass-subtle p-3 flex items-center justify-between">
                    <span className="label">TARGET</span>
                    <span className="text-sm text-zinc-300 tracking-wider font-mono">{pairingPhone}</span>
                  </div>

                  {/* Step-by-Step Instruction Guide */}
                  <div className="p-4 rounded-xl bg-zinc-950/45 border border-zinc-800/80 space-y-2 text-left">
                    <p className="text-[9px] text-zinc-500 tracking-wider font-bold uppercase">HOW TO LINK</p>
                    <ol className="text-[10px] text-zinc-400 leading-relaxed font-sans list-decimal pl-4 space-y-1">
                      <li>Buka aplikasi <span className="text-emerald-400 font-semibold">WhatsApp</span> di HP Anda.</li>
                      <li>Ketuk ikon <span className="text-zinc-300 font-semibold">Menu</span> (Titik Tiga / Pengaturan) &gt; <span className="text-zinc-300 font-semibold">Perangkat Tertaut</span>.</li>
                      <li>Pilih <span className="text-indigo-400 font-semibold">Tautkan Perangkat</span> &gt; lalu ketuk <span className="text-indigo-400 font-semibold">Tautkan dengan nomor telepon saja</span>.</li>
                      <li>Masukkan 8 karakter kode pairing di atas.</li>
                    </ol>
                  </div>

                  {/* Countdown */}
                  <div className="text-center">
                    <p className="text-[11px] text-zinc-500 tracking-wide">
                      Code expires in <span className={`font-bold ${countdown < 30 ? 'text-red-400' : 'text-indigo-300'}`}>{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</span>
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setPairingStep('phone')} className="btn-ghost flex-1">BACK</button>
                    <button onClick={confirmPairing} className="btn-primary flex-1">CONFIRM LINKED</button>
                  </div>
                </div>
              )}

              {/* Step: Success */}
              {pairingStep === 'success' && (
                <div className="text-center py-6 space-y-4">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto glow-green">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <h3 className="text-lg font-bold tracking-[0.15em] text-emerald-300">LINKED SUCCESSFULLY</h3>
                  <p className="text-[11px] text-zinc-500 tracking-wide">WhatsApp sender is now connected</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SIDEBAR DRAWER ── */}
        {showSidebar && (
          <div className="fixed inset-0 z-[60] flex" onClick={() => setShowSidebar(false)}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm anim-fade-in" />

            {/* Sidebar Content */}
            <div
              className="relative w-[280px] max-w-[80vw] h-full bg-[#0c0c10] border-r border-zinc-800/80 p-6 flex flex-col justify-between anim-slide-right shadow-[10px_0_40px_rgba(0,0,0,0.6)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-md font-bold tracking-[0.2em] text-white">COMMUNITY</h2>
                    <p className="text-[8px] tracking-[0.15em] text-zinc-500 font-semibold mt-0.5">JOIN OUR GROUPS</p>
                  </div>
                  <button
                    onClick={() => setShowSidebar(false)}
                    className="w-8 h-8 rounded-xl glass flex items-center justify-center hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                  >
                    <Icon d="M18 6L6 18|M6 6l12 12" size={14} className="text-zinc-400" />
                  </button>
                </div>

                {/* Info Text */}
                <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                  Join our social channels to get update news, tools, support, and connect with developers.
                </p>

                {/* Links list */}
                <div className="space-y-3 pt-2">
                  {(user.status === 'Owner' || user.status === 'Reseller') && (
                    <a 
                      href="/admin" 
                      className="flex items-center gap-3 p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/15 hover:border-indigo-500/30 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                        <Icon d="R,4,4,16,16,2|C,12,12,3" size={14} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-[10px] font-bold tracking-[0.15em] text-indigo-300">ADMIN PANEL</p>
                        <p className="text-[8px] tracking-[0.1em] text-zinc-500 font-semibold mt-0.5 uppercase">MANAGE USERS</p>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-400/60 group-hover:translate-x-0.5 transition-transform"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </a>
                  )}

                  <a
                    href="https://whatsapp.com/channel/0029Vak1Mh81noz57tVkqv2y"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 hover:border-emerald-500/30 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.327 0-4.47-.781-6.191-2.093l-.367-.291-2.694.903.903-2.694-.291-.367A9.935 9.935 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[10px] font-bold tracking-[0.15em] text-emerald-300">SALURAN WHATSAPP</p>
                      <p className="text-[8px] tracking-[0.1em] text-zinc-500 font-semibold mt-0.5 uppercase">JOIN CHANNEL</p>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400/60 group-hover:translate-x-0.5 transition-transform"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </a>

                  <a
                    href="https://t.me/VannessWangsaff"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/15 hover:border-indigo-500/30 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.492-1.302.48-.428-.013-1.252-.242-1.865-.442-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[10px] font-bold tracking-[0.15em] text-indigo-300">DEVELOPER BASE</p>
                      <p className="text-[8px] tracking-[0.1em] text-zinc-500 font-semibold mt-0.5 uppercase">TELEGRAM GROUP</p>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-400/60 group-hover:translate-x-0.5 transition-transform"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </a>
                </div>
              </div>
              {/* Logout Button */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    localStorage.removeItem('username');
                    window.location.href = '/login';
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 hover:border-red-500/30 transition-all text-[10px] tracking-[0.2em] font-bold cursor-pointer"
                >
                  LOGOUT
                </button>
              </div>

              {/* Footer */}
              <div className="border-t border-zinc-800/80 pt-4 text-center">
                <p className="text-[8px] tracking-[0.2em] text-zinc-600 font-bold uppercase">THE EXECUTOR</p>
                <p className="text-[7px] tracking-[0.15em] text-zinc-700 font-medium mt-1">POWERED BY @VANNESSWANGSAFF</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
