"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    const saved = localStorage.getItem('username');
    if (saved) {
      window.location.href = `/dashboard?username=${saved}`;
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('username', data.username);
        window.location.href = `/dashboard?username=${data.username}`;
      } else {
        setError(data.error || 'INVALID USERNAME');
      }
    } catch (err) {
      setError('SERVER UNREACHABLE');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Animated background mesh */}
      <div className="bg-mesh" />

      <div className="relative z-10 w-full max-w-[430px] mx-auto min-h-[100dvh] flex flex-col justify-center px-6">
        <div className="glass p-8 text-center anim-slide-up relative overflow-hidden">
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-60 h-60 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative space-y-6">
            <div className="relative w-24 h-24 rounded-full p-[2px] bg-zinc-800 border border-zinc-700/50 shadow-[0_0_20px_rgba(255,255,255,0.05)] mx-auto overflow-hidden">
              <div className="w-full h-full rounded-full bg-[#0c0c10] overflow-hidden flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-[0.25em] text-white font-orbitron">THE EXECUTOR</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-2 text-left">
                <label className="label">USERNAME</label>
                <input
                  type="text"
                  className="input-glass text-left text-md tracking-[0.1em] placeholder:tracking-[0.1em]"
                  placeholder="YOUR USERNAME"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-center glow-red">
                  <p className="text-[10px] text-red-400 font-extrabold tracking-wider uppercase">
                    ⚠️ {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                className={`btn-primary w-full py-4 text-xs ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={loading}
              >
                {loading ? 'AUTHORIZING...' : 'AUTHORIZE ACCESS'}
              </button>
            </form>

            <div className="p-4 rounded-xl bg-zinc-950/45 border border-zinc-800/80 text-left space-y-2">
              <p className="text-[10px] text-zinc-500 tracking-wider font-bold">ATTENTION</p>
              <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                Access is restricted to authorized credentials. Request node creation via the official Telegram account gateway.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <a
                href="https://t.me/VannessWangsaff"
                target="_blank"
                rel="noreferrer"
                className="btn-ghost w-full py-3.5 text-[10px] text-center"
              >
                CONTACT ADMINISTRATOR
              </a>
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-[9px] tracking-[0.2em] text-zinc-600 font-bold">POWERED BY @VANNESSWANGSAFF</p>
        </div>
      </div>
    </>
  );
}
