import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { resolveCommissionAmount, currentPaymentMonth } from '../lib/commission';
import Modal from '../components/Modal';
import { TableRowSkeleton } from '../components/Skeleton';
import { Plus, Trash2, Send } from 'lucide-react';

const LEAD_STATUS = [
  { value: 'received', label: '受付', color: '#2563eb', bg: '#dbeafe' },
  { value: 'in_progress', label: '対応中', color: '#d97706', bg: '#ffedd5' },
  { value: 'started', label: '利用開始', color: '#059669', bg: '#dcfce7' },
  { value: 'skipped', label: '今回は見送り', color: '#64748b', bg: '#e2e8f0' },
];
const statusInfo = (v) => LEAD_STATUS.find(s => s.value === v) || LEAD_STATUS[0];

const emptyForm = { partner_id: '', product_id: '', customer_name: '', customer_contact: '', ok_to_contact: true, memo: '' };

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
    const payload = {
      partner_id: formData.partner_id || null,
      product_id: formData.product_id || null,
      customer_name: formData.customer_name.trim(),
      customer_contact: formData.customer_contact.trim() || null,
      ok_to_contact: formData.ok_to_contact,
      memo: formData.memo.trim() || null,
    };
    const { error } = await supabase.from('leads').insert([payload]);
    setSaving(false);
    if (error) { toast.error('登録に失敗しました: ' + error.message); return; }
    toast.success('紹介を受け付けました');
    setIsModalOpen(false);
    fetchAll();
  };

  const handleStatusChange = async (lead, newStatus) => {
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', lead.id);
    if (error) { toast.error('更新に失敗しました: ' + error.message); return; }

    if (newStatus === 'started') {
      const { data: existing } = await supabase.from('commissions').select('id').eq('lead_id', lead.id).maybeSingle();
      if (!existing) {
        const { amount, commission_type } = await resolveCommissionAmount(lead.partner_id, lead.product_id, null);
        await supabase.from('commissions').insert([{
          lead_id: lead.id, partner_id: lead.partner_id, amount, commission_type,
          payment_month: currentPaymentMonth(), status: amount != null ? 'confirmed' : 'pending',
        }]);
        toast.success(amount != null ? `お礼額（${Math.round(amount).toLocaleString()}円）を作成しました` : 'お礼額を作成しました（金額は管理者確認待ち）');
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
          <p className="page-header-desc">パートナーから届いた紹介を受け付け、状況を管理します。「利用開始」にするとお礼額が作成されます。</p>
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
                        value={l.status}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">パートナー</label>
              <select className="form-select" value={formData.partner_id} onChange={e => setFormData({ ...formData, partner_id: e.target.value })}>
                <option value="">（未選択）</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">紹介する商材</label>
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
