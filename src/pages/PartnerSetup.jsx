import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import InstallPrompt from '../components/InstallPrompt';
import AppLoading from '../components/AppLoading';
import { UserPlus, CheckCircle } from 'lucide-react';

export default function PartnerSetup() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);     // { id, name, phone_last4, activated }
  const [invalid, setInvalid] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    email: '', password: '', name_kana: '', company_name: '', address: '', note: '',
  });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('get_invite_partner', { p_token: token });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) { setInvalid(true); setLoading(false); return; }
      setInvite(row);
      setLoading(false);
    })();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    // 1. 認証ユーザー作成（メール確認OFF前提で即サインイン）
    const { error: signUpErr } = await supabase.auth.signUp({ email: form.email.trim(), password: form.password });
    if (signUpErr) {
      setSaving(false);
      toast.error('登録に失敗しました: ' + signUpErr.message);
      return;
    }

    // セッションが無い場合（メール確認ON等）はサインインを試みる
    let { data: sess } = await supabase.auth.getSession();
    if (!sess?.session) {
      await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
      ({ data: sess } = await supabase.auth.getSession());
    }
    if (!sess?.session) {
      setSaving(false);
      toast.error('メール確認が必要な設定になっています。管理者にご連絡ください。');
      return;
    }

    // 2. 招待トークンと自分のアカウントを紐付け
    const { data: claimedId, error: claimErr } = await supabase.rpc('claim_partner_invite', { p_token: token });
    if (claimErr || !claimedId) {
      setSaving(false);
      toast.error('この招待リンクは無効か、すでに使用されています。');
      return;
    }

    // 3. 基本情報を保存（自分の行はRLSで更新可）
    await supabase.from('partners').update({
      email: form.email.trim(),
      name_kana: form.name_kana.trim() || null,
      company_name: form.company_name.trim() || null,
      address: form.address.trim() || null,
      note: form.note.trim() || null,
    }).eq('id', claimedId);

    setSaving(false);
    setDone(true);
    toast.success('本登録が完了しました');
  };

  if (loading) return <AppLoading message="読み込み中..." />;

  const Shell = ({ children }) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '30rem', padding: '2rem' }}>
        {children}
      </div>
    </div>
  );

  if (invalid) {
    return (
      <Shell>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>リンクが無効です</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>この招待リンクは無効か、期限切れの可能性があります。お手数ですが、ご担当者へご連絡ください。</p>
      </Shell>
    );
  }

  if (invite?.activated) {
    return (
      <Shell>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>すでに登録済みです</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>このアカウントは本登録が完了しています。ログインしてご利用ください。</p>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/login')}>ログインへ</button>
      </Shell>
    );
  }

  if (done) {
    return (
      <>
        <Shell>
          <div style={{ textAlign: 'center' }}>
            <CheckCircle size={48} color="#059669" style={{ marginBottom: '0.75rem' }} />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.5rem' }}>本登録が完了しました！</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {invite?.name} 様、ありがとうございます。<br />
              ホーム画面に追加すると、次回からすぐに開けます。
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/portal')}>マイページへ進む</button>
          </div>
        </Shell>
        <InstallPrompt force />
      </>
    );
  }

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '0.9rem', background: 'linear-gradient(135deg, #0d3d3d, #e8b800)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
          <UserPlus size={26} color="#fff" />
        </div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>パートナー本登録</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem', textAlign: 'center' }}>
          {invite?.name} 様、ようこそ。ログイン用のメール・パスワードと基本情報をご登録ください。
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">メールアドレス *</label>
          <input className="form-input" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">パスワード * <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.78rem' }}>（6文字以上）</span></label>
          <input className="form-input" type="password" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">フリガナ（任意）</label>
          <input className="form-input" value={form.name_kana} onChange={e => setForm({ ...form, name_kana: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">会社名・屋号（任意）</label>
          <input className="form-input" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">住所（任意）</label>
          <input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.25rem' }} disabled={saving}>
          {saving ? '登録中...' : '本登録を完了する'}
        </button>
      </form>
    </Shell>
  );
}
