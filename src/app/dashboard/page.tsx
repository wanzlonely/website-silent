import fs from 'fs/promises';
import path from 'path';
import DashboardClient from './DashboardClient';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function DashboardPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const queryUsername = typeof searchParams.username === 'string' ? searchParams.username.trim() : undefined;

  const filePath = path.join(process.cwd(), 'database.json');
  let initialData = null;

  try {
    const fileContents = await fs.readFile(filePath, 'utf8');
    const db = JSON.parse(fileContents);
    
    // Fallback logic: if no username provided, take the first available user in DB
    const usernames = Object.keys(db.users || {});
    const targetUsername = queryUsername || usernames[0] || '';
    
    let userKey = targetUsername;
    let user = db.users && targetUsername ? db.users[targetUsername] || null : null;
    if (!user && db.users && targetUsername) {
      const foundKey = Object.keys(db.users).find(k => db.users[k].username === targetUsername);
      if (foundKey) {
        userKey = foundKey;
        user = db.users[foundKey];
      }
    }
    const history = db.history && userKey ? db.history[userKey] || [] : [];
    
    initialData = {
      user,
      history,
      queryUsername: queryUsername || null
    };
  } catch (err) {
    console.error("Error reading database:", err);
  }

  return (
    <main className="p-4 sm:p-8 flex justify-center items-center min-h-screen">
      <DashboardClient initialData={initialData} />
    </main>
  );
}

