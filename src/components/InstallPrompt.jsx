import React, { useEffect, useState } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

const DISMISS_KEY = 'hinova_partners_install_dismissed_at';
const DISMISS_DAYS = 14;
const QUIET_PATHS = ['/login'];

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}

function recentlyDismissed() {
  const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
  if (!ts) return false;
  return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

// force=true で本登録完了時など、必ず案内を出す
export default function InstallPrompt({ force = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [iosGuide, setIosGuide] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const quietRoute = !force && QUIET_PATHS.some(path => window.location.pathname.startsWith(path));
    if (!force && (quietRoute || recentlyDismissed())) return;

    const onBIP = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onBIP);

    if (force) setShow(true);
    else if (isIOS()) {
      const t = setTimeout(() => setShow(true), 4000);
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onBIP); };
    }

    return () => window.removeEventListener('beforeinstallprompt', onBIP);
  }, [force]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
    setIosGuide(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setShow(false);
      if (outcome !== 'accepted') localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } else if (isIOS()) {
      setIosGuide(true);
    }
  };

  if (!show) return null;

  return (
    <div
      className="install-prompt"
      style={{
        position: 'fixed', left: '50%', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        transform: 'translateX(-50%)', zIndex: 60, width: 'calc(100% - 32px)', maxWidth: '420px',
      }}
    >
      {iosGuide ? (
        <div style={{ background: 'var(--bg-card, #fff)', borderRadius: '16px', padding: '18px 20px', boxShadow: '0 12px 40px rgba(0,0,0,0.25)', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontWeight: 800, fontSize: '15px', color: '#0d3d3d' }}>ホーム画面に追加</span>
            <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
          </div>
          <ol style={{ margin: 0, paddingLeft: '4px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#475569' }}>
              <span style={{ background: '#0d3d3d', color: '#e8b800', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>1</span>
              下部の <Share size={15} color="#007aff" /> 共有ボタンをタップ
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#475569' }}>
              <span style={{ background: '#0d3d3d', color: '#e8b800', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>2</span>
              <PlusSquare size={15} color="#475569" /> 「ホーム画面に追加」を選択
            </li>
          </ol>
        </div>
      ) : (
        <div style={{ background: 'linear-gradient(135deg, #0d3d3d, #1a5c5c)', borderRadius: '16px', padding: '14px 16px', boxShadow: '0 12px 40px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/icon-192.png" alt="Hinova Partners" style={{ width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>アプリとして使う</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '11px' }}>ホーム画面に追加すると素早く起動できます</div>
          </div>
          <button
            onClick={handleInstall}
            style={{ background: '#e8b800', color: '#0d3d3d', border: 'none', borderRadius: '9px', padding: '9px 14px', fontWeight: 800, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}
          >
            <Download size={15} /> 追加
          </button>
          <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: '4px', flexShrink: 0 }}><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
