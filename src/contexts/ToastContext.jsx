import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    // エラーと警告は8秒、その他は4秒
    const duration = (type === 'error' || type === 'warning') ? 8000 : 4000;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const TYPE_STYLES = {
  success: { bar: '#10b981', icon: '✓', bg: '#0f2a1e', border: '#10b981', text: '#34d399', label: '成功' },
  error:   { bar: '#ef4444', icon: '✕', bg: '#2a0f0f', border: '#ef4444', text: '#fca5a5', label: 'エラー' },
  warning: { bar: '#f59e0b', icon: '⚠', bg: '#2a1f0a', border: '#f59e0b', text: '#fcd34d', label: '注意' },
  info:    { bar: '#6366f1', icon: 'ℹ', bg: '#13143a', border: '#6366f1', text: '#a5b4fc', label: '情報' },
};

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', top: '1.25rem', right: '1.25rem', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '360px', maxWidth: 'calc(100vw - 2rem)' }}>
      {toasts.map(t => {
        const s = TYPE_STYLES[t.type] || TYPE_STYLES.info;
        return (
          <div
            key={t.id}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              background: s.bg,
              border: `1px solid ${s.border}`,
              borderLeft: `5px solid ${s.bar}`,
              borderRadius: '0.75rem',
              padding: '0.9rem 1rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
              animation: 'fadeIn 0.25s ease',
            }}
          >
            {/* アイコン */}
            <div style={{
              width: '2rem', height: '2rem', borderRadius: '50%',
              background: `${s.bar}22`, border: `1.5px solid ${s.bar}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: '0.9rem', fontWeight: 700, color: s.bar,
            }}>{s.icon}</div>
            {/* テキスト */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: s.text, fontSize: '0.72rem', fontWeight: 700, margin: '0 0 0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
              <p style={{ color: '#e2e8f0', fontSize: '0.875rem', lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>{t.message}</p>
            </div>
            {/* 閉じるボタン */}
            <button
              onClick={() => onDismiss(t.id)}
              style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '0.15rem', flexShrink: 0, marginTop: '-0.1rem' }}
              title="閉じる"
            >✕</button>
          </div>
        );
      })}
    </div>
  );
}
