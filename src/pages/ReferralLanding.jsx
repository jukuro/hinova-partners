import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AppLoading from '../components/AppLoading';
import { Send, CheckCircle } from 'lucide-react';

// 外枠（コンポーネント外で定義：入力のたびに作り直されないように）
function Shell({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--bg-app, #f7f8fa)' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '30rem', padding: '1.75rem' }}>{children}</div>
    </div>
  );
}

export default function ReferralLanding() {
  const { code } = useParams();
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState(null);
  const [invalid, setInvalid] = useState(false);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ product_ids: [], customer_name: '', customer_contact: '', memo: '' });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: pData }, { data: prodData }] = await Promise.all([
        supabase.rpc('get_partner_by_code', { p_code: code }),
        supabase.rpc('list_referral_products'),
      ]);
      const row = Array.isArray(pData) ? pData[0] : pData;
      if (!row) { setInvalid(true); setLoading(false); return; }
      setPartner(row);
      setProducts(prodData || []);
      setLoading(false);
    })();
  }, [code]);

  const toggle = (pid) => setForm(prev => ({
    ...prev,
    product_ids: prev.product_ids.includes(pid) ? prev.product_ids.filter(x => x !== pid) : [...prev.product_ids, pid],
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.rpc('submit_referral', {
      p_code: code,
      p_customer_name: form.customer_name,
      p_customer_contact: form.customer_contact,
      p_memo: form.memo,
      p_product_ids: form.product_ids.length ? form.product_ids : null,
    });
    setSaving(false);
    if (error) { alert('送信に失敗しました。お手数ですが時間をおいて再度お試しください。'); return; }
    setDone(true);
  };

  if (loading) return <AppLoading message="読み込み中..." />;

  if (invalid) {
    return <Shell><h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>リンクが無効です</h2><p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>お手数ですが、紹介してくれた方にご確認ください。</p></Shell>;
  }

  if (done) {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <CheckCircle size={48} color="#059669" style={{ marginBottom: '0.75rem' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>送信しました！</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            ありがとうございます。担当者よりご連絡いたします。
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem', textAlign: 'center' }}>
        <div style={{ width: '3rem', height: '3rem', borderRadius: '0.8rem', background: 'linear-gradient(135deg, #0d3d3d, #e8b800)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.6rem' }}>
          <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.9rem' }}>HP</span>
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Hinova サービスのご案内</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
          {partner?.name} さんからのご紹介です。<br />ご興味のあるサービスとご連絡先をお知らせください。
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {products.length > 0 && (
          <div className="form-group">
            <label className="form-label">気になるサービス（複数選択可・任意）</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid var(--border-light)', borderRadius: '0.6rem', padding: '0.6rem 0.75rem' }}>
              {products.map(p => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={form.product_ids.includes(p.id)} onChange={() => toggle(p.id)} style={{ accentColor: '#e8b800' }} />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">お名前 *</label>
          <input className="form-input" required value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">ご連絡先（電話・メール・LINEなど）</label>
          <input className="form-input" value={form.customer_contact} onChange={e => setForm({ ...form, customer_contact: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">ご質問・ご要望（任意）</label>
          <textarea className="form-input" rows={2} value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })} />
        </div>
        <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.9rem' }} disabled={saving}>
          <Send size={18} /> {saving ? '送信中...' : '送信する'}
        </button>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>送信いただいた内容は、ご連絡のために使用します。</p>
      </form>
    </Shell>
  );
}
