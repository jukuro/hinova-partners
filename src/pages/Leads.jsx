import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { resolveRewardRate, calcReward, currentPaymentMonth } from '../lib/commission';
import Modal from '../components/Modal';
import { TableRowSkeleton } from '../components/Skeleton';
import { Plus, Trash2, Send } from 'lucide-react';

const LEAD_STATUS = [
  { value: 'referred', label: '紹介された', color: '#2563eb', bg: '#dbeafe' },
  { value: 'contracted', label: '契約（有料登録）', color: '#059669', bg: '#dcfce7' },
  { value: 'skipped', label: '見送り', color: '#64748b', bg: '#e2e8f0' },
];
const LEGACY_MAP = { received: 'referred', in_progress: 'referred', started: 'contracted', skipped: 'skipped' };
const normStatus = (v) => LEAD_STATUS.some(s => s.value === v) ? v : (LEGACY_MAP[v] || 'referred');
const statusInfo = (v) => LEAD_STATUS.find(s => s.value === normStatus(v)) || LEAD_STATUS[0];

const emptyForm = { partner_id: '', product_ids: [], customer_name: '', customer_contact: '', ok_to_contact: true, memo: '' };

const th = { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const td = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)', verticalAlign: 'middle' };

export default function Leads() {
  const toast = useToast();
  const confirm = useConfirm();
  const [leads, setLeads] = useState([]);
  const [partners, setPartners] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: lData }, { data: pData }, { data: prodData }] = await Promise.all([
      supabase.from('leads').select('*, partners(name), products(name)').order('created_at', { ascending: false }),
      supabase.from('partners').select('id, name').eq('is_active', true).order('name'),
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
    ]);
    if (lData) setLeads(lData);
    if (pData) setPartners(pData);
    if (prodData) setProducts(prodData);
    setLoading(false);
  }

  const openNew = () => { setFormData(emptyForm); setIsModalOpen(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const base = {
      partner_id: formData.partner_id || null,
      customer_name: formData.customer_name.trim(),
      customer_contact: formData.customer_contact.trim() || null,
      ok_to_contact: formData.ok_to_contact,
      memo: formData.memo.trim() || null,
    };
    // 商材を複数選んだ場合は商材ごとに1件ずつ作成（fan-out）。未選択なら商材なしで1件。
    const ids = formData.product_ids.length ? formData.product_ids : [null];
    const rows = ids.map(pid => ({ ...base, product_id: pid }));
    const { error } = await supabase.from('leads').insert(rows);
    setSaving(false);
    if (error) { toast.error('登録に失敗しました: ' + error.message); return; }
    toast.success(rows.length > 1 ? `${rows.length}件の紹介を受け付けました` : '紹介を受け付けました');
    setIsModalOpen(false);
    fetchAll();
  };

  const toggleProduct = (pid) => setFormData(prev => ({
    ...prev,
    product_ids: prev.product_ids.includes(pid)
      ? prev.product_ids.filter(x => x !== pid)
      : [...prev.product_ids, pid],
  }));

  const handleStatusChange = async (lead, newStatus) => {
    if (newStatus === normStatus(lead.status)) return;
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', lead.id);
    if (error) { toast.error('更新に失敗しました: ' + error.message); return; }

    if (newStatus === 'contracted') {
      const { data: existing } = await supabase.from('commissions').select('id').eq('lead_id', lead.id).maybeSingle();
      if (!existing) {
        const { data: product } = lead.product_id
          ? await supabase.from('products').select('*').eq('id', lead.product_id).maybeSingle()
          : { data: null };
        const resolved = await resolveRewardRate(lead.partner_id, lead.product_id);
        const payAmount = product?.unit_price != null ? Number(product.unit_price) : null;
        const rule = product?.rounding_rule || 'floor_10';
        const { raw, final } = calcReward(payAmount, resolved.rate, rule);
        await supabase.from('commissions').insert([{
          lead_id: lead.id, partner_id: lead.partner_id,
          product_id: lead.product_id || null, product_name: product?.name || null,
          customer_name: lead.customer_name || null,
          payment_amount: payAmount, applied_rate: resolved.rate, amount: final,
          calculation_basis: { ...resolved, rounding_rule: rule, raw_amount: raw, final_amount: final, locked_at: new Date().toISOString().slice(0, 10) },
          payment_month: currentPaymentMonth(), status: 'pending',
        }]);
        toast.success(final != null ? `お礼額（${Number(final).toLocaleString()}円）を作成しました` : 'お礼額を作成しました（商材の月額・報酬率を確認してください）');
      }
    }
    fetchAll();
  };

  const handleDelete = async (lead) => {
    const ok = await confirm({ title: '紹介の削除', message: `「${lead.customer_name}」の紹介を削除しますか？`, confirmLabel: '削除する', variant: 'danger' });
    if (!ok) return;
    const { error } = await supabase.from('leads').delete().eq('id', lead.id);
    if (error) { toast.error('削除に失敗しました: ' + error.message); return; }
    toast.success('削除しました');
    fetchAll();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>かんたん紹介</h1>
          <p className="page-header-desc">パートナーから届いた紹介の一覧です。顧客が有料登録したら「契約（有料登録）」にすると、お礼額が自動計算されます。</p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={18} /> 紹介を追加
        </button>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>紹介先</th>
                <th style={th}>パートナー</th>
                <th style={th}>商材</th>
                <th style={th}>連絡可否</th>
                <th style={th}>状況</th>
                <th style={{ ...th, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton cols={6} rows={5} />
              ) : leads.length === 0 ? (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }} colSpan={6}>
                  <Send size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} /><br />
                  紹介がまだありません。
                </td></tr>
              ) : leads.map(l => {
                const s = statusInfo(l.status);
                return (
                  <tr key={l.id}>
                    <td style={{ ...td, fontWeight: 700 }}>
                      {l.customer_name}
                      {l.customer_contact && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{l.customer_contact}</div>}
                      {l.memo && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '0.15rem' }}>{l.memo}</div>}
                    </td>
                    <td style={td}>{l.partners?.name || '—'}</td>
                    <td style={td}>{l.products?.name || '—'}</td>
                    <td style={td}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: l.ok_to_contact ? '#059669' : '#dc2626' }}>
                        {l.ok_to_contact ? '連絡OK' : '連絡NG'}
                      </span>
                    </td>
                    <td style={td}>
                      <select
                        value={normStatus(l.status)}
                        onChange={e => handleStatusChange(l, e.target.value)}
                        className="status-select"
                        style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.25rem 1.5rem 0.25rem 0.6rem', borderRadius: '9999px', border: 'none', background: s.bg, color: s.color, cursor: 'pointer' }}
                      >
                        {LEAD_STATUS.map(o => <option key={o.value} value={o.value} style={{ background: '#fff', color: '#1e293b' }}>{o.label}</option>)}
                      </select>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button className="btn btn-danger" onClick={() => handleDelete(l)} style={{ padding: '0.35rem 0.6rem' }}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="紹介を追加">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">パートナー</label>
            <select className="form-select" value={formData.partner_id} onChange={e => setFormData({ ...formData, partner_id: e.target.value })}>
              <option value="">（未選択）</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">紹介する商材（複数選択可）</label>
            {products.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>商材が登録されていません。</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', border: '1px solid var(--border-light)', borderRadius: '0.6rem', padding: '0.6rem 0.75rem', maxHeight: '11rem', overflowY: 'auto' }}>
                {products.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>
                    <input type="checkbox" checked={formData.product_ids.includes(p.id)} onChange={() => toggleProduct(p.id)} style={{ accentColor: '#e8b800' }} />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
            {formData.product_ids.length > 1 && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>商材ごとに1件ずつ紹介として登録されます（{formData.product_ids.length}件）。</p>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">紹介先の名前 *</label>
            <input className="form-input" required value={formData.customer_name} onChange={e => setFormData({ ...formData, customer_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">連絡先（任意）</label>
            <input className="form-input" value={formData.customer_contact} onChange={e => setFormData({ ...formData, customer_contact: e.target.value })} placeholder="電話・メール・LINEなど" />
          </div>
          <div className="form-group">
            <label className="form-label">メモ（任意）</label>
            <textarea className="form-input" rows={2} value={formData.memo} onChange={e => setFormData({ ...formData, memo: e.target.value })} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
            <input type="checkbox" checked={formData.ok_to_contact} onChange={e => setFormData({ ...formData, ok_to_contact: e.target.checked })} style={{ accentColor: '#e8b800' }} />
            Hinova から紹介先へ連絡してよい
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>キャンセル</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '保存中...' : '受け付ける'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
