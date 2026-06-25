import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, Users, UserRound, Award, Package, Send, ClipboardList,
  Coins, FileText, Settings, LogOut, Menu, X,
} from 'lucide-react';

const NAV_SECTIONS = [
  { title: null, items: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'ダッシュボード' },
  ] },
  { title: 'パートナー', items: [
    { to: '/partners', icon: Users, label: 'パートナー' },
    { to: '/ranks', icon: Award, label: 'ランク' },
  ] },
  { title: '紹介・顧客', items: [
    { to: '/leads', icon: Send, label: 'かんたん紹介' },
    { to: '/deals', icon: ClipboardList, label: '紹介状況' },
    { to: '/customers', icon: UserRound, label: '顧客' },
  ] },
  { title: '商材・お礼', items: [
    { to: '/products', icon: Package, label: '商材' },
    { to: '/commissions', icon: Coins, label: 'お礼額' },
  ] },
  { title: 'その他', items: [
    { to: '/materials', icon: FileText, label: '説明資料' },
    { to: '/settings', icon: Settings, label: '設定' },
  ] },
];

const PAGE_TITLES = {
  '/dashboard': 'ダッシュボード',
  '/partners': 'パートナー管理',
  '/customers': '顧客',
  '/ranks': 'ランク管理',
  '/products': '商材管理',
  '/leads': 'かんたん紹介',
  '/deals': '紹介状況',
  '/commissions': 'お礼額管理',
  '/materials': '説明資料',
  '/settings': '設定',
};

const NavItem = ({ to, icon: Icon, label, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.7rem 0.85rem', borderRadius: '0.5rem', fontSize: '0.95rem', fontWeight: 600, textDecoration: 'none' }}
  >
    <Icon size={20} />
    <span>{label}</span>
  </NavLink>
);

export default function MainLayout() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const title = PAGE_TITLES[location.pathname] || 'Hinova Partners';
  const [open, setOpen] = useState(false);

  // ルート変更でドロワーを閉じる
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // ドロワー表示中は背面スクロールを止める
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  return (
    <div className="app-container" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* モバイル：ドロワー背景 */}
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 45 }} />
      )}

      <aside className={`sidebar glass${open ? ' sidebar-open' : ''}`} style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', borderBottom: '1px solid rgba(232,184,0,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.65rem', background: 'linear-gradient(135deg, #0d3d3d, #e8b800)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(232,184,0,0.3)' }}>
              <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.85rem' }}>HP</span>
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontWeight: 800, color: '#e8b800', fontSize: '1.05rem' }}>Hinova</div>
              <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)', fontSize: '0.78rem', letterSpacing: '0.08em' }}>PARTNERS</div>
            </div>
          </div>
          {/* モバイル：閉じるボタン */}
          <button className="sidebar-close-btn" onClick={() => setOpen(false)} aria-label="メニューを閉じる"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '0.25rem' }}>
            <X size={22} />
          </button>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          {NAV_SECTIONS.map((sec, i) => (
            <div key={i} style={{ marginTop: i === 0 ? 0 : '0.6rem' }}>
              {sec.title && (
                <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)', padding: '0.25rem 0.85rem' }}>{sec.title}</div>
              )}
              {sec.items.map((item) => (
                <NavItem key={item.to} {...item} onClick={() => setOpen(false)} />
              ))}
            </div>
          ))}
        </nav>

        <div style={{ padding: '0.85rem 0.75rem', marginTop: 'auto' }}>
          <button
            onClick={signOut}
            className="nav-item btn-logout"
            style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.7rem 0.85rem', borderRadius: '0.5rem', fontSize: '0.95rem', fontWeight: 600, width: '100%' }}
          >
            <LogOut size={20} />
            <span>ログアウト</span>
          </button>
        </div>
      </aside>

      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header className="topbar glass" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem', paddingTop: 'calc(0.7rem + env(safe-area-inset-top, 0px))', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, zIndex: 30 }}>
          {/* モバイル：ハンバーガー */}
          <button className="hamburger-btn" onClick={() => setOpen(true)} aria-label="メニューを開く"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', padding: '0.35rem', display: 'inline-flex' }}>
            <Menu size={24} />
          </button>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h2>
          <span className="topbar-email" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>{user?.email}</span>
        </header>

        <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto' }}>
          <Outlet />
        </div>
      </main>

      {/* 片手操作用：右下のメニューボタン（モバイル） */}
      <button className="menu-fab" onClick={() => setOpen(true)} aria-label="メニューを開く">
        <Menu size={24} />
      </button>
    </div>
  );
}
