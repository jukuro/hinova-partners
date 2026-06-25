import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { lockRewardRateForDeal, recordReward } from '../lib/commission';
import { formatCurrency } from '../lib/utils';
import Modal from '../components/Modal';
import { TableRowSkeleton } from '../components/Skeleton';
import { Plus, Pencil, Trash2, ClipboardList } from 'lucide-react';

// 簡素化したステータス（紹介された → 契約（有料登録）→ 見送り）
const DEAL_STATUS = [
  { value: 'referred', label: '紹介された', color: '#2563eb', bg: '#dbeafe' },
  { value: 'contracted', label: '契約（有料登録）', color: '#059669', bg: '#dcfce7' },
  { value: 'skipped', label: '見送り', color: '#64748b', bg: '#e2e8f0' },
];
// 旧ステータスを新ステータスへ読み替え
const LEGACY_MAP = {
  memo: 'referred', introduced: 'referred', hinova_handling: 'referred', considering: 'referred',
  started: 'contracted', payment_confirmed: 'contracted',
  skipped: 'skipped', not_applicable: 'skipped',
};
const normStatus = (v) => DEAL_STATUS.some(s => s.value === v) ? v : (LEGACY_MAP[v] || 'referred');
const statusInfo = (v) => DEAL_STATUS.find(s => s.value === normStatus(v)) || DEAL_STATUS[0];

const emptyForm = { partner_id: '', product_id: '', product_ids: [], customer_name: '', customer_contact: '', amount: '', next_contact_date: '', note: '' };

const th = { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const td = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)', verticalAlign: 'middle' };

export default function Deals() {
  const toast = useToast();
  const confirm = useConfirm();
  const [deals, setDeals] = useState([]);
  const [partners, setPartners] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: dData }, { data: pData }, { data: prodData }] = await Promise.all([
      supabase.from('deals').select('*, partners(name), products(name)').order('created_at', { ascending: false }),
      supabase.from('partners').select('id, name').eq('is_active', true).order('name'),
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
    ]);
    if (dData) setDeals(dData);
    if (pData) setPartners(pData);
    if (prodData) setProducts(prodData);
    setLoading(false);
  }

  const openNew = () => { setEditingId(null); setFormData(emptyForm); setIsModalOpen(true); };
  const openEdit = (d) => {
    setEditingId(d.id);
    setFormData({
      partner_id: d.partner_id || '', product_id: d.product_id || '',
      product_ids: d.product_id ? [d.product_id] : [],
      customer_name: d.customer_name || '', customer_contact: d.customer_contact || '',
      amount: d.amount ?? '', next_contact_date: d.next_contact_date || '', note: d.note || '',
    });
    setIsModalOpen(true);
  };

  const toggleProduct = (pid) => setFormData(prev => ({
    ...prev,
    product_ids: prev.product_ids.includes(pid)
      ? prev.product_ids.filter(x => x !== pid)
      : [...prev.product_ids, pid],
  }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const base = {
      partner_id: formData.partner_id || null,
      customer_name: formData.customer_name.trim(),
      customer_contact: formData.customer_contact.trim() || null,
      amount: formData.amount === '' ? null : Number(formData.amount),
      next_contact_date: formData.next_contact_date || null,
      note: formData.note.trim() || null,
    };
    let error;
    if (editingId) {
      // 編集時は単一商材（先頭）で更新
      ({ error } = await supabase.from('deals').update({ ...base, product_id: formData.product_ids[0] || null }).eq('id', editingId));
    } else {
      // 新規は商材ごとに1件ずつ作成（fan-out）。未選択なら商材なしで1件。
      const ids = formData.product_ids.length ? formData.product_ids : [null];
      ({ error } = await supabase.from('deals').insert(ids.map(pid => ({ ...base, product_id: pid }))));
    }
    setSaving(false);
    if (error) { toast.error('保存に失敗しました: ' + error.message); return; }
    toast.success(editingId ? '更新しました' : '紹介状況を登録しました');
    setIsModalOpen(false);
    fetchAll();
  };

  const handleStatusChange = async (deal, newStatus) => {
    const current = normStatus(deal.status);
    if (newStatus === current) return;
    const today = new Date().toISOString().slice(0, 10);
    const patch = { status: newStatus };
    if (newStatus === 'contracted' && !deal.contracted_at) patch.contracted_at = today;

    const { error } = await supabase.from('deals').update(patch).eq('id', deal.id);
    if (error) { toast.error('更新に失敗しました: ' + error.message); return; }

    await supabase.from('deal_events').insert([{ deal_id: deal.id, status_from: deal.status, status_to: newStatus }]);

    // 「契約（有料登録）」で報酬率を確定（契約日ロック）＋お礼額を一括作成
    if (newStatus === 'contracted') {
      const contractDate = deal.contracted_at || today;
      if (deal.locked_reward_rate == null) {
        await lockRewardRateForDeal({ ...deal, contracted_at: contractDate }, contractDate);
      }
      const { data: existing } = await supabase.from('commissions').select('id').eq('deal_id', deal.id).maybeSingle();
      if (!existing) {
        const { data: fresh } = await supabase.from('deals').select('*').eq('id', deal.id).single();
        const { data: product } = deal.product_id
          ? await supabase.from('products').select('*').eq('id', deal.product_id).maybeSingle()
          : { data: null };
        const { error: rErr, amount } = await recordReward({
          deal: fresh || { ...deal, ...patch },
          product,
          paymentAmount: deal.amount,
        });
        if (rErr) toast.error('お礼額の作成に失敗しました: ' + rErr.message);
        else toast.success(amount != null ? `契約を記録し、お礼額（${Number(amount).toLocaleString()}円）を作成しました` : '契約を記録しました（月額・報酬率をご確認ください）');
      } else {
        toast.success('契約に更新しました');
      }
    }
    fetchAll();
  };

  const handleDelete = async (deal) => {
    const ok = await confirm({ title: '紹介状況の削除', message: `「${deal.customer_name}」を削除しますか？`, confirmLabel: '削除する', variant: 'danger' });
    if (!ok) return;
    const { error } = await supabase.from('deals').delete().eq('id', deal.id);
    if (error) { toast.error('削除に失敗しました: ' + error.message); return; }
    toast.success('削除しました');
    fetchAll();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>紹介状況</h1>
          <p className="page-header-desc">パートナーが紹介した顧客の状況です。顧客が有料登録したら「契約（有料登録）」にすると、お礼額が自動計算されます。</p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={18} /> 紹介状況を追加
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
                <th style={th}>金額</th>
                <th style={th}>次回連絡</th>
                <th style={th}>状況</th>
                <th style={{ ...th, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton cols={7} rows={5} />
              ) : deals.length === 0 ? (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }} colSpan={7}>
                  <ClipboardList size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} /><br />
                  紹介状況がまだありません。
                </td></tr>
              ) : deals.map(d => {
                const s = statusInfo(d.status);
                return (
                  <tr key={d.id}>
                    <td style={{ ...td, fontWeight: 700 }}>
                      {d.customer_name}
                      {d.customer_contact && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{d.customer_contact}</div>}
                    </td>
                    <td style={td}>{d.partners?.name || '—'}</td>
                    <td style={td}>{d.products?.name || '—'}</td>
                    <td style={td}>{d.amount != null ? formatCurrency(d.amount) : '—'}</td>
                    <td style={td}>{d.next_contact_date || '—'}</td>
                    <td style={td}>
                      <select
                        value={normStatus(d.status)}
                        onChange={e => handleStatusChange(d, e.target.value)}
                        className="status-select"
                        style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.25rem 1.5rem 0.25rem 0.6rem', borderRadius: '9999px', border: 'none', background: s.bg, color: s.color, cursor: 'pointer' }}
                      >
                        {DEAL_STATUS.map(o => <option key={o.value} value={o.value} style={{ background: '#fff', color: '#1e293b' }}>{o.label}</option>)}
                      </select>
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary" onClick={() => openEdit(d)} style={{ padding: '0.35rem 0.6rem', marginRight: '0.4rem' }}><Pencil size={15} /></button>
                      <button className="btn btn-danger" onClick={() => handleDelete(d)} style={{ padding: '0.35rem 0.6rem' }}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? '紹介状況の編集' : '紹介状況を追加'}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">パートナー</label>
            <select className="form-select" value={formData.partner_id} onChange={e => setFormData({ ...formData, partner_id: e.target.value })}>
              <option value="">（未選択）</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">商材{editingId ? '' : '（複数選択可）'}</label>
            {products.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>商材が登録されていません。</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', border: '1px solid var(--border-light)', borderRadius: '0.6rem', padding: '0.6rem 0.75rem', maxHeight: '11rem', overflowY: 'auto' }}>
                {products.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>
                    <input
                      type={editingId ? 'radio' : 'checkbox'}
                      name="deal-product"
                      checked={formData.product_ids.includes(p.id)}
                      onChange={() => editingId ? setFormData({ ...formData, product_ids: [p.id] }) : toggleProduct(p.id)}
                      style={{ accentColor: '#e8b800' }}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
            {!editingId && formData.product_ids.length > 1 && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>商材ごとに1件ずつ紹介状況が登録されます（{formData.product_ids.length}件）。</p>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">紹介先の名前 *</label>
            <input className="form-input" required value={formData.customer_name} onChange={e => setFormData({ ...formData, customer_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">連絡先（任意）</label>
            <input className="form-input" value={formData.customer_contact} onChange={e => setFormData({ ...formData, customer_contact: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">月額（報酬計算に使用）</label>
              <input className="form-input" type="number" min="0" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="例: 2980" />
            </div>
            <div className="form-group">
              <label className="form-label">次回連絡日（任意）</label>
              <input className="form-input" type="date" value={formData.next_contact_date} onChange={e => setFormData({ ...formData, next_contact_date: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">メモ（任意）</label>
            <textarea className="form-input" rows={2} value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>キャンセル</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
