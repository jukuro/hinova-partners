import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { Mail, KeyRound } from 'lucide-react';

const card = { background: '#fff', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };

export default function Settings() {
  const { user } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const handleEmail = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setSavingEmail(false);
    if (error) { toast.error('変更に失敗しました: ' + error.message); return; }
    toast.success('確認メールを送信しました。メール内のリンクから変更を完了してください。');
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('パスワードは8文字以上にしてください。'); return; }
    if (password !== password2) { toast.error('パスワードが一致しません。'); return; }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPw(false);
    if (error) { toast.error('変更に失敗しました: ' + error.message); return; }
    toast.success('パスワードを変更しました。');
    setPassword(''); setPassword2('');
  };

  return (
    <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <Mail size={18} color="#0d3d3d" />
          <h3 style={{ fontWeight: 800, fontSize: '15px', margin: 0 }}>メールアドレス</h3>
        </div>
        <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">ログイン用メールアドレス</label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <button type="submit" className="btn btn-primary" disabled={savingEmail}>{savingEmail ? '送信中...' : 'メールアドレスを変更'}</button>
          </div>
        </form>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <KeyRound size={18} color="#0d3d3d" />
          <h3 style={{ fontWeight: 800, fontSize: '15px', margin: 0 }}>パスワード変更</h3>
        </div>
        <form onSubmit={handlePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">新しいパスワード（8文字以上）</label>
            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">新しいパスワード（確認）</label>
            <input className="form-input" type="password" value={password2} onChange={e => setPassword2(e.target.value)} required />
          </div>
          <div>
            <button type="submit" className="btn btn-primary" disabled={savingPw}>{savingPw ? '変更中...' : 'パスワードを変更'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
