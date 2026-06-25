import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';

export default function PortalProfile() {
  const { partner, refreshProfile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: partner?.name || '', name_kana: partner?.name_kana || '',
    phone: partner?.phone || '', email: partner?.email || '',
    company_name: partner?.company_name || '', address: partner?.address || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('partners').update({
      name: form.name.trim(),
      name_kana: form.name_kana.trim() || null,
      phone: form.phone.trim() || null,
      company_name: form.company_name.trim() || null,
      address: form.address.trim() || null,
    }).eq('id', partner.id);
    setSaving(false);
    if (error) { toast.error('保存に失敗しました: ' + error.message); return; }
    toast.success('プロフィールを更新しました');
    refreshProfile();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>マイページ</h1>

      <form onSubmit={handleSave} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">お名前 *</label>
          <input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">フリガナ</label>
          <input className="form-input" value={form.name_kana} onChange={e => setForm({ ...form, name_kana: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">電話番号</label>
          <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">メールアドレス（ログイン用・変更不可）</label>
          <input className="form-input" value={form.email} disabled style={{ opacity: 0.7 }} />
        </div>
        <div className="form-group">
          <label className="form-label">会社名・屋号</label>
          <input className="form-input" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">住所</label>
          <input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '保存中...' : '保存する'}</button>
      </form>
    </div>
  );
}
