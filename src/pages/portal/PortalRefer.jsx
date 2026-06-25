import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { Send, CheckCircle } from 'lucide-react';

export default function PortalRefer() {
  const { partner } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ product_ids: [], customer_name: '', customer_contact: '', ok_to_contact: true, memo: '' });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!partner) return;
    (async () => {
      // 担当商材があればそれを、なければ有効な全商材を表示
      const { data: pp } = await supabase.from('partner_products').select('product_id').eq('partner_id', partner.id);
      const assignedIds = (pp || []).map(r => r.product_id);
      const { data: prods } = await supabase.from('products').select('id, name, business').eq('is_active', true).order('name');
      const list = assignedIds.length ? (prods || []).filter(p => assignedIds.includes(p.id)) : (prods || []);
      setProducts(list);
    })();
  }, [partner]);

  const toggleProduct = (pid) => setForm(prev => ({
    ...prev,
    product_ids: prev.product_ids.includes(pid) ? prev.product_ids.filter(x => x !== pid) : [...prev.product_ids, pid],
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (partner?.status === 'reviewing') { toast.error('審査中のため、まだ紹介できません。'); return; }
    setSaving(true);
    const base = {
      partner_id: partner.id,
      customer_name: form.customer_name.trim(),
      customer_contact: form.customer_contact.trim() || null,
      ok_to_contact: form.ok_to_contact,
      memo: form.memo.trim() || null,
    };
    const ids = form.product_ids.length ? form.product_ids : [null];
    const { error } = await supabase.from('leads').insert(ids.map(pid => ({ ...base, product_id: pid })));
    setSaving(false);
    if (error) { toast.error('送信に失敗しました: ' + error.message); return; }
    setDone(true);
    setForm({ product_ids: [], customer_name: '', customer_contact: '', ok_to_contact: true, memo: '' });
  };

  if (done) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <CheckCircle size={44} color="#059669" style={{ marginBottom: '0.75rem' }} />
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>紹介を送信しました！</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>Hinovaが内容を確認し、対応を進めます。状況は「紹介状況」で確認できます。</p>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setDone(false)}>続けて紹介する</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>知り合いに紹介する</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>必要そうな人にHinovaのサービスをお伝えください。お名前と連絡先だけでOKです。</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">紹介する商材（複数選択可）</label>
          {products.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>紹介できる商材がまだありません。</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid var(--border-light)', borderRadius: '0.6rem', padding: '0.6rem 0.75rem' }}>
              {products.map(p => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={form.product_ids.includes(p.id)} onChange={() => toggleProduct(p.id)} style={{ accentColor: '#e8b800' }} />
                  {p.name}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">紹介先の名前 *</label>
          <input className="form-input" required value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">連絡先（任意）</label>
          <input className="form-input" value={form.customer_contact} onChange={e => setForm({ ...form, customer_contact: e.target.value })} placeholder="電話・メール・LINEなど" />
        </div>
        <div className="form-group">
          <label className="form-label">メモ（任意）</label>
          <textarea className="form-input" rows={2} value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
          <input type="checkbox" checked={form.ok_to_contact} onChange={e => setForm({ ...form, ok_to_contact: e.target.checked })} style={{ accentColor: '#e8b800' }} />
          Hinova から紹介先へ連絡してよい
        </label>
        <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.9rem' }} disabled={saving}>
          <Send size={18} /> {saving ? '送信中...' : '紹介を送る'}
        </button>
      </form>
    </div>
  );
}
