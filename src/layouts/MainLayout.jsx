import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, Users, Package, Send, ClipboardList,
  Coins, FileText, Settings, LogOut,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'ダッシュボード' },
  { to: '/partners', icon: Users, label: 'パートナー' },
  { to: '/products', icon: Package, label: '商材' },
  { to: '/leads', icon: Send, label: 'かんたん紹介' },
  { to: '/deals', icon: ClipboardList, label: '紹介状況' },
  { to: '/commissions', icon: Coins, label: 'お礼額' },
  { to: '/materials', icon: FileText, label: '説明資料' },
  { to: '/settings', icon: Settings, label: '設定' },
];

const PAGE_TITLES = {
  '/dashboard': 'ダッシュボード',
  '/partners': 'パートナー管理',
  '/products': '商材管理',
  '/leads': 'かんたん紹介',
  '/deals': '紹介状況',
  '/commissions': 'お礼額管理',
  '/materials': '説明資料',
  '/settings': '設定',
};

const NavItem = ({ to, icon: Icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}
  >
    <Icon size={19} />
    <span>{label}</span>
  </NavLink>
);

export default function MainLayout() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const title = PAGE_TITLES[location.pathname] || 'Hinova Partners';

  return (
    <div className="app-container" style={{ display: 'flex', minHeight: '100vh' }}>
      <aside className="sidebar glass" style={{ width: '15rem', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '1.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(232,184,0,0.15)' }}>
          <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.65rem', background: 'linear-gradient(135deg, #0d3d3d, #e8b800)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(232,184,0,0.3)' }}>
            <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.85rem' }}>HP</span>
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontWeight: 800, color: '#e8b800', fontSize: '1.05rem' }}>Hinova</div>
            <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)', fontSize: '0.78rem', letterSpacing: '0.08em' }}>PARTNERS</div>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '0.85rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <div style={{ padding: '0.85rem 0.75rem', marginTop: 'auto' }}>
          <button
            onClick={signOut}
            className="nav-item btn-logout"
            style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', fontSize: '0.9rem', fontWeight: 600, width: '100%' }}
          >
            <LogOut size={19} />
            <span>ログアウト</span>
          </button>
        </div>
      </aside>

      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header className="topbar glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.75rem', borderBottom: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{title}</h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>{user?.email}</span>
        </header>

        <div style={{ flex: 1, padding: '1.75rem', overflowY: 'auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
