import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { resolveCommissionAmount, currentPaymentMonth } from '../lib/commission';
import { formatCurrency } from '../lib/utils';
import Modal from '../components/Modal';
import { TableRowSkeleton } from '../components/Skeleton';
import { Plus, Pencil, Trash2, ClipboardList } from 'lucide-react';

const DEAL_STATUS = [
  { value: 'memo', label: '紹介メモ', color: '#64748b', bg: '#e2e8f0' },
  { value: 'introduced', label: '紹介済み', color: '#2563eb', bg: '#dbeafe' },
  { value: 'hinova_handling', label: 'Hinova対応中', color: '#0891b2', bg: '#cffafe' },
  { value: 'considering', label: '検討中', color: '#7c3aed', bg: '#ede9fe' },
  { value: 'started', label: '利用開始', color: '#059669', bg: '#dcfce7' },
  { value: 'payment_confirmed', label: '入金確認済み', color: '#047857', bg: '#a7f3d0' },
  { value: 'skipped', label: '今回は見送り', color: '#64748b', bg: '#e2e8f0' },
  { value: 'not_applicable', label: '対応不要', color: '#94a3b8', bg: '#f1f5f9' },
];
const statusInfo = (v) => DEAL_STATUS.find(s => s.value === v) || DEAL_STATUS[0];

const emptyForm = { partner_id: '', product_id: '', customer_name: '', customer_contact: '', amount: '', next_contact_date: '', note: '' };

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
      customer_name: d.customer_name || '', customer_contact: d.customer_contact || '',
      amount: d.amount ?? '', next_contact_date: d.next_contact_date || '', note: d.note || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      partner_id: formData.partner_id || null,
      product_id: formData.product_id || null,
      customer_name: formData.customer_name.trim(),
      customer_contact: formData.customer_contact.trim() || null,
      amount: formData.amount === '' ? null : Number(formData.amount),
      next_contact_date: formData.next_contact_date || null,
      note: formData.note.trim() || null,
    };
    const { error } = editingId
      ? await supabase.from('deals').update(payload).eq('id', editingId)
      : await supabase.from('deals').insert([payload]);
    setSaving(false);
    if (error) { toast.error('保存に失敗しました: ' + error.message); return; }
    toast.success(editingId ? '更新しました' : '紹介状況を登録しました');
    setIsModalOpen(false);
    fetchAll();
  };

  const handleStatusChange = async (deal, newStatus) => {
    if (newStatus === deal.status) return;
    const patch = { status: newStatus };
    if (newStatus === 'started' && !deal.contracted_at) patch.contracted_at = new Date().toISOString().slice(0, 10);
    if (newStatus === 'payment_confirmed' && !deal.paid_at) patch.paid_at = new Date().toISOString().slice(0, 10);

    const { error } = await supabase.from('deals').update(patch).eq('id', deal.id);
    if (error) { toast.error('更新に失敗しました: ' + error.message); return; }

    await supabase.from('deal_events').insert([{ deal_id: deal.id, status_from: deal.status, status_to: newStatus }]);

    if (newStatus === 'payment_confirmed') {
      const { data: existing } = await supabase.from('commissions').select('id').eq('deal_id', deal.id).maybeSingle();
      if (!existing) {
        const { amount, commission_type } = await resolveCommissionAmount(deal.partner_id, deal.product_id, deal.amount);
        await supabase.from('commissions').insert([{
          deal_id: deal.id, partner_id: deal.partner_id, amount, commission_type,
          payment_month: currentPaymentMonth(), status: amount != null ? 'confirmed' : 'pending',
        }]);
        toast.success(amount != null ? `お礼額（${Math.round(amount).toLocaleString()}円）を作成しました` : 'お礼額を作成しました（金額は管理者確認待ち）');
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
          <p className="page-header-desc">継続的に管理する紹介の進捗です。「入金確認済み」にするとお礼額が作成されます。</p>
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
                        value={d.status}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">パートナー</label>
              <select className="form-select" value={formData.partner_id} onChange={e => setFormData({ ...formData, partner_id: e.target.value })}>
                <option value="">（未選択）</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">商材</label>
              <select className="form-select" value={formData.product_id} onChange={e => setFormData({ ...formData, product_id: e.target.value })}>
                <option value="">（未選択）</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
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
              <label className="form-label">金額（売上率のお礼に使用）</label>
              <input className="form-input" type="number" min="0" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="例: 50000" />
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
