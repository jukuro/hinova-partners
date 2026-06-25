import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import InstallPrompt from '../components/InstallPrompt';
import { Home, Send, ClipboardList, Coins, FileText, LogOut } from 'lucide-react';

const NAV = [
  { to: '/portal', icon: Home, label: 'ホーム', end: true },
  { to: '/portal/refer', icon: Send, label: '紹介する' },
  { to: '/portal/referrals', icon: ClipboardList, label: '紹介状況' },
  { to: '/portal/rewards', icon: Coins, label: 'お礼' },
  { to: '/portal/materials', icon: FileText, label: '資料' },
];

export default function PortalLayout() {
  const { partner, signOut } = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app, #f7f8fa)' }}>
      {/* ヘッダ */}
      <header className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.1rem', paddingTop: 'calc(0.85rem + env(safe-area-inset-top, 0px))', position: 'sticky', top: 0, zIndex: 20 }}>
        <NavLink to="/portal/profile" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
          <div style={{ width: '2rem', height: '2rem', borderRadius: '0.55rem', background: 'linear-gradient(135deg, #0d3d3d, #e8b800)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.72rem' }}>HP</span>
          </div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>{partner?.name || 'パートナー'}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Hinova Partners</div>
          </div>
        </NavLink>
        <button onClick={signOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
          <LogOut size={16} /> ログアウト
        </button>
      </header>

      {/* 本文 */}
      <main style={{ flex: 1, padding: '1rem 1rem 5.5rem', maxWidth: '640px', width: '100%', margin: '0 auto' }}>
        <Outlet />
      </main>

      {/* ボトムナビ */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-card, #fff)', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-around', padding: '0.4rem 0 calc(0.4rem + env(safe-area-inset-bottom, 0px))', zIndex: 30 }}>
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}
            style={({ isActive }) => ({
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem',
              textDecoration: 'none', fontSize: '0.66rem', fontWeight: 700, padding: '0.3rem 0.6rem',
              color: isActive ? '#0d3d3d' : 'var(--text-muted)',
            })}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <InstallPrompt />
    </div>
  );
}
