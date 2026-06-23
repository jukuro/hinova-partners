import React, { useState, useCallback, useRef, createContext, useContext } from 'react';
import ConfirmModal from '../components/ConfirmModal';

/**
 * Promise ベースの確認ダイアログフック
 *
 * 使い方:
 *   const confirm = useConfirm();
 *
 *   const ok = await confirm({
 *     title: '削除の確認',
 *     message: 'このデータを削除しますか？',
 *     confirmLabel: '削除する',
 *     variant: 'danger',
 *   });
 *   if (!ok) return;
 *   // ... 処理続行
 */

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ isOpen: false, options: {}, loading: false });
  const resolveRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ isOpen: true, options, loading: false });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState(prev => ({ ...prev, loading: true }));
    // 少しディレイを入れてボタンのフィードバックを見せる
    setTimeout(() => {
      setState({ isOpen: false, options: {}, loading: false });
      resolveRef.current?.(true);
    }, 150);
  }, []);

  const handleClose = useCallback(() => {
    setState({ isOpen: false, options: {}, loading: false });
    resolveRef.current?.(false);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmModal
        isOpen={state.isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        loading={state.loading}
        title={state.options.title}
        message={state.options.message}
        confirmLabel={state.options.confirmLabel}
        cancelLabel={state.options.cancelLabel}
        variant={state.options.variant}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
