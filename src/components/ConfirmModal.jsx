import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Info, Trash2, X } from 'lucide-react';

/**
 * デザイン統一済みの確認モーダル
 *
 * Props:
 *  isOpen       boolean
 *  onClose      () => void  — キャンセル時
 *  onConfirm    () => void  — 確認ボタン押下時
 *  title        string
 *  message      string | ReactNode
 *  confirmLabel string      (default: "削除する")
 *  cancelLabel  string      (default: "キャンセル")
 *  variant      'danger' | 'warning' | 'info'   (default: 'danger')
 *  loading      boolean     — 処理中スピナー
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = '確認',
  message,
  confirmLabel = '削除する',
  cancelLabel = 'キャンセル',
  variant = 'danger',
  loading = false,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const iconMap = {
    danger:  { Icon: Trash2,        bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',  iconColor: '#dc2626',  btnClass: 'btn-confirm-danger' },
    warning: { Icon: AlertTriangle, bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)', iconColor: '#d97706',  btnClass: 'btn-confirm-warning' },
    info:    { Icon: Info,          bg: 'rgba(232,184,0,0.12)',  border: 'rgba(232,184,0,0.3)',   iconColor: '#b88c00',  btnClass: 'btn-confirm-info' },
  };
  const { Icon, bg, border, iconColor, btnClass } = iconMap[variant] ?? iconMap.danger;

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog open:animate-fade-in"
      onCancel={onClose}
      style={{ maxWidth: '26rem' }}
    >
      <div className="modal-content">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '0.5rem', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={18} style={{ color: iconColor }} />
            </div>
            <h3 className="modal-title" style={{ fontSize: '1rem' }}>{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="閉じる">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{message}</p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${btnClass}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '処理中...' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
