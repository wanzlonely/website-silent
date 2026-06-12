"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requester, setRequester] = useState('');
  const [requesterRole, setRequesterRole] = useState('');
  
  // Form States
  const [showAddModal, setShowAddModal] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [roleInput, setRoleInput] = useState('User');
  const [activeUntilInput, setActiveUntilInput] = useState('2026-12-31');
  const [limitInput, setLimitInput] = useState('10');
  
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });

  const router = useRouter();

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 2500);
  };

  useEffect(() => {
    const saved = localStorage.getItem('username');
    if (!saved) {
      router.push('/login');
      return;
    }
    setRequester(saved);
    fetchUsers(saved);
  }, [router]);

  const fetchUsers = async (uname: string) => {
    try {
      const res = await fetch(`/api/admin/users?requester=${uname}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        // Find requester's own role
        const me = data.users.find((u: any) => u.username === uname);
        if (me) {
          setRequesterRole(me.status);
          if (me.status !== 'Owner' && me.status !== 'Reseller') {
            router.push('/dashboard');
          }
        } else {
          router.push('/dashboard');
        }
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error(err);
      triggerToast('FAILED TO FETCH USERS', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester,
          username: usernameInput.trim(),
          status: roleInput,
          activeUntil: activeUntilInput,
          limit: parseInt(limitInput, 10)
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast('USER SAVED SUCCESSFULLY', 'success');
        setShowAddModal(false);
        // Reset form
        setUsernameInput('');
        setRoleInput('User');
        setActiveUntilInput('2026-12-31');
        setLimitInput('10');
        fetchUsers(requester);
      } else {
        triggerToast(data.error || 'FAILED TO SAVE USER', 'error');
      }
    } catch (err) {
      triggerToast('SERVER ERROR', 'error');
    }
  };

  const handleDeleteUser = async (targetUsername: string) => {
    if (targetUsername === requester) {
      triggerToast('CANNOT DELETE YOURSELF', 'error');
      return;
    }
    if (!confirm(`Are you sure you want to delete user "${targetUsername}"?`)) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requester, username: targetUsername })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast('USER DELETED', 'success');
        fetchUsers(requester);
      } else {
        triggerToast(data.error || 'FAILED TO DELETE USER', 'error');
      }
    } catch (err) {
      triggerToast('SERVER ERROR', 'error');
    }
  };

  const handleEditClick = (user: any) => {
    setUsernameInput(user.username);
    setRoleInput(user.status);
    setActiveUntilInput(user.activeUntil || '2026-12-31');
    setLimitInput(String(user.limit || 10));
    setShowAddModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050508] text-white">
        <p className="text-xs font-bold tracking-[0.2em] font-orbitron animate-pulse">AUTHORIZING GATEWAY...</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-mesh" />

      <div className="relative z-10 w-full max-w-[430px] mx-auto min-h-[100dvh] flex flex-col pb-8">
        {/* Header */}
        <header className="flex justify-between items-center px-5 pt-8 pb-4">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-10 h-10 rounded-2xl glass flex items-center justify-center hover:bg-white/5 active:scale-95 transition-all cursor-pointer text-zinc-400 hover:text-zinc-200"
            >
              <Icon d="PL15 18 9 12 15 6" size={16} />
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-[0.2em] text-white font-orbitron">ADMIN PANEL</h1>
              <p className="text-[9px] tracking-[0.15em] text-indigo-400 font-bold uppercase mt-0.5">USER GATEWAY CONTROL</p>
            </div>
          </div>
          <button
            onClick={() => {
              setUsernameInput('');
              setRoleInput('User');
              setActiveUntilInput('2026-12-31');
              setLimitInput('10');
              setShowAddModal(true);
            }}
            className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center hover:bg-indigo-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Icon d="L,12,5,12,19|L,5,12,19,12" size={16} />
          </button>
        </header>

        {/* Content list */}
        <main className="flex-1 px-5 space-y-4 overflow-y-auto">
          {users.length === 0 ? (
            <div className="glass p-8 text-center">
              <p className="text-xs text-zinc-500 font-bold tracking-wider">NO REGISTERED USERS FOUND</p>
            </div>
          ) : (
            users.map((u) => (
              <div key={u.username} className="glass p-5 relative overflow-hidden group border border-white/5">
                <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r ${u.status === 'Owner' ? 'from-red-500 to-amber-500' : u.status === 'Reseller' ? 'from-purple-500 to-indigo-500' : 'from-zinc-700 to-zinc-600'}`} />
                
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-md font-bold tracking-wider text-white font-orbitron uppercase">{u.username}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[8px] px-2 py-0.5 rounded border tracking-wider font-extrabold uppercase
                        ${u.status === 'Owner' ? 'bg-red-500/15 border-red-500/30 text-red-400' : u.status === 'Reseller' ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                        {u.status}
                      </span>
                      <span className="text-[9px] text-zinc-500 font-mono">
                        LIMIT: {u.limit || 0}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEditClick(u)}
                      className="w-8 h-8 rounded-xl glass flex items-center justify-center hover:bg-white/5 text-zinc-400 hover:text-zinc-200 active:scale-95 transition-all cursor-pointer"
                    >
                      <Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7|M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" size={12} />
                    </button>
                    {requesterRole === 'Owner' && (
                      <button
                        onClick={() => handleDeleteUser(u.username)}
                        className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 text-red-400 active:scale-95 transition-all cursor-pointer"
                      >
                        <Icon d="M3 6h18|M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-[9px] text-zinc-500 font-mono">
                  <span>SENDERS: {(u.whatsappSenders || []).length}</span>
                  <span>EXP: {u.activeUntil || 'N/A'}</span>
                </div>
              </div>
            ))
          )}
        </main>

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => setShowAddModal(false)}>
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-[430px] bg-[#0c0c10] border-t border-x border-zinc-800 rounded-t-3xl p-6 pb-10 anim-slide-up"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />
              <div className="text-center mb-6">
                <h3 className="text-md font-bold tracking-[0.15em] text-white font-orbitron">PROVISION USER NODE</h3>
                <p className="text-[10px] text-zinc-500 tracking-wide mt-1">Configure access credentials for target workspace</p>
              </div>

              <form onSubmit={handleSaveUser} className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="label">USERNAME</label>
                  <input
                    type="text"
                    className="input-glass"
                    placeholder="Enter Username"
                    value={usernameInput}
                    onChange={e => setUsernameInput(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="label">STATUS / ROLE</label>
                    <select
                      className="input-glass bg-[#0c0c10] pr-8"
                      value={roleInput}
                      onChange={e => setRoleInput(e.target.value)}
                    >
                      <option value="User">USER</option>
                      <option value="Reseller">RESELLER</option>
                      <option value="Owner">OWNER</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="label">LIMIT</label>
                    <input
                      type="number"
                      className="input-glass"
                      placeholder="Execution Limit"
                      value={limitInput}
                      onChange={e => setLimitInput(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="label">ACTIVE UNTIL (YYYY-MM-DD)</label>
                  <input
                    type="text"
                    className="input-glass font-mono"
                    placeholder="YYYY-MM-DD"
                    value={activeUntilInput}
                    onChange={e => setActiveUntilInput(e.target.value)}
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost flex-1">CANCEL</button>
                  <button type="submit" className="btn-primary flex-1">SAVE CREDENTIALS</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast.show && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 anim-slide-up">
            <div className={`glass px-6 py-3.5 flex items-center gap-3 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <span className={`text-xs font-bold tracking-[0.15em] ${toast.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
