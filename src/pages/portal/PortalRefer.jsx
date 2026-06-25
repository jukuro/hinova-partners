import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { Send, CheckCircle, Share2, Link2 } from 'lucide-react';

// LP URL に紹介コードを付与
const withRef = (url, code) => {
  if (!url) return null;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}ref=${encodeURIComponent(code)}`;
};

export default function PortalRefer() {
  const { partner } = useAuth();
  const toast = useToast();
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ product_ids: [], customer_name: '', customer_contact: '', ok_to_contact: true, memo: '' });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!partner) return;
    (async () => {
      const [{ data: svc }, { data: prods }, { data: pp }] = await Promise.all([
        supabase.from('services').select('id, name, lp_url').eq('is_active', true).order('sort_order').order('name'),
        supabase.from('products').select('id, name, service_id').eq('is_active', true).order('name'),
        supabase.from('partner_products').select('product_id').eq('partner_id', partner.id),
      ]);
      setServices(svc || []);
      // 担当プランがあればそれを、なければ有効な全プラン
      const assignedIds = (pp || []).map(r => r.product_id);
      const list = assignedIds.length ? (prods || []).filter(p => assignedIds.includes(p.id)) : (prods || []);
      setProducts(list);
    })();
  }, [partner]);

  const code = partner?.referral_code;
  const serviceName = (id) => services.find(s => s.id === id)?.name || '商材';

  // LP共有は商材（サービス）単位
  const lpGroups = services.filter(s => s.lp_url).map(s => ({ lp_url: s.lp_url, label: s.name }));

  // 手入力フォーム：プランを商材ごとにグルーピング
  const grouped = services
    .map(s => ({ service: s, plans: products.filter(p => p.service_id === s.id) }))
    .filter(g => g.plans.length > 0);
  const ungrouped = products.filter(p => !services.some(s => s.id === p.service_id));

  const shareLp = async (g) => {
    const url = withRef(g.lp_url, code);
    if (!url) return;
    const text = `${g.label} のご案内です。下記からご覧ください。`;
    if (navigator.share) {
      try { await navigator.share({ title: g.label, text, url }); } catch { /* キャンセル */ }
    } else {
      try { await navigator.clipboard.writeText(url); toast.success('紹介リンクをコピーしました'); }
      catch { toast.error('コピーに失敗: ' + url); }
    }
  };
  const lineLp = (g) => {
    const url = withRef(g.lp_url, code);
    if (!url) return;
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(`${g.label} のご案内です。\n${url}`)}`, '_blank');
  };
  const copyLp = async (g) => {
    const url = withRef(g.lp_url, code);
    if (!url) return;
    try { await navigator.clipboard.writeText(url); toast.success('紹介リンクをコピーしました'); }
    catch { toast.error('コピーに失敗: ' + url); }
  };

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
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>商品ページのリンクをLINEやSNSで送るだけ。リンクにはあなたの紹介コードが付きます。</p>
      </div>

      {/* 商品リンクで紹介（LP + 紹介コード）。同一LPは1つにまとめる */}
      {lpGroups.length > 0 && (
        <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>商品リンクを送る</div>
          {lpGroups.map(g => (
            <div key={g.lp_url} style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.6rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>{g.label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                <button type="button" className="btn btn-primary" onClick={() => shareLp(g)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.55rem' }}><Share2 size={15} /> 送る</button>
                <button type="button" className="btn btn-secondary" onClick={() => lineLp(g)} style={{ padding: '0.55rem', color: '#06c755', fontWeight: 700 }}>LINE</button>
                <button type="button" className="btn btn-secondary" onClick={() => copyLp(g)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.55rem' }}><Link2 size={15} /> コピー</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: '0.25rem' }}>または、直接お名前を登録する</div>

      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">紹介する商材・プラン（複数選択可）</label>
          {products.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>紹介できる商材がまだありません。</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', border: '1px solid var(--border-light)', borderRadius: '0.6rem', padding: '0.6rem 0.75rem' }}>
              {grouped.map(({ service, plans }) => (
                <div key={service.id}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{service.name}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', paddingLeft: '0.25rem' }}>
                    {plans.map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                        <input type="checkbox" checked={form.product_ids.includes(p.id)} onChange={() => toggleProduct(p.id)} style={{ accentColor: '#e8b800' }} />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {ungrouped.map(p => (
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
