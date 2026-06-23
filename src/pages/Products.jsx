import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { formatCurrency } from '../lib/utils';
import Modal from '../components/Modal';
import { TableRowSkeleton } from '../components/Skeleton';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';

export const BUSINESS_OPTIONS = [
  { value: 'hinova_biz', label: 'Hinova Biz' },
  { value: 'hinova_crm', label: 'Hinova CRM' },
  { value: 'medaka', label: 'メダカ管理アプリ' },
  { value: 'ochome', label: 'お帳面アプリ' },
  { value: 'design', label: 'デザイン制作' },
  { value: 'family_tree', label: '家系図・ヒストリー制作' },
  { value: 'other', label: 'その他' },
];

export const COMMISSION_TYPES = [
  { value: 'fixed', label: '固定額（紹介お礼）' },
  { value: 'rate', label: '売上率（％）' },
  { value: 'recurring', label: '継続お礼（月額）' },
];

export const businessLabel = (v) => BUSINESS_OPTIONS.find(b => b.value === v)?.label || '—';

export const formatCommission = (type, value) => {
  if (value == null || value === '') return '未設定';
  if (type === 'fixed') return `${formatCurrency(value)}`;
  if (type === 'rate') return `${value}%`;
  if (type === 'recurring') return `${formatCurrency(value)}/月`;
  return String(value);
};

const emptyForm = {
  name: '', business: 'hinova_biz', unit_price: '',
  commission_type: 'fixed', commission_value: '', description: '', is_active: true,
};

const th = { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const td = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)', verticalAlign: 'middle' };

export default function Products() {
  const toast = useToast();
  const confirm = useConfirm();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setProducts(data);
    setLoading(false);
  }

  const openNew = () => { setEditingId(null); setFormData(emptyForm); setIsModalOpen(true); };
  const openEdit = (p) => {
    setEditingId(p.id);
    setFormData({
      name: p.name || '', business: p.business || 'hinova_biz',
      unit_price: p.unit_price ?? '', commission_type: p.commission_type || 'fixed',
      commission_value: p.commission_value ?? '', description: p.description || '',
      is_active: p.is_active ?? true,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: formData.name.trim(),
      business: formData.business,
      unit_price: formData.unit_price === '' ? null : Number(formData.unit_price),
      commission_type: formData.commission_type,
      commission_value: formData.commission_value === '' ? null : Number(formData.commission_value),
      description: formData.description.trim() || null,
      is_active: formData.is_active,
    };
    const { error } = editingId
      ? await supabase.from('products').update(payload).eq('id', editingId)
      : await supabase.from('products').insert([payload]);
    setSaving(false);
    if (error) { toast.error('保存に失敗しました: ' + error.message); return; }
    toast.success(editingId ? '商材を更新しました' : '商材を登録しました');
    setIsModalOpen(false);
    fetchProducts();
  };

  const handleDelete = async (p) => {
    const ok = await confirm({
      title: '商材の削除', message: `「${p.name}」を削除しますか？`,
      confirmLabel: '削除する', variant: 'danger',
    });
    if (!ok) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) { toast.error('削除に失敗しました: ' + error.message); return; }
    toast.success('商材を削除しました');
    fetchProducts();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>商材管理</h1>
          <p className="page-header-desc">紹介できる商材と、紹介してくれた方へのお礼ルールを設定します。</p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={18} /> 商材を登録
        </button>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>商材名</th>
                <th style={th}>事業</th>
                <th style={th}>単価</th>
                <th style={th}>お礼</th>
                <th style={th}>状態</th>
                <th style={{ ...th, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton cols={6} rows={5} />
              ) : products.length === 0 ? (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }} colSpan={6}>
                  <Package size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} /><br />
                  商材がまだ登録されていません。
                </td></tr>
              ) : products.map(p => (
                <tr key={p.id}>
                  <td style={{ ...td, fontWeight: 700 }}>{p.name}</td>
                  <td style={td}>{businessLabel(p.business)}</td>
                  <td style={td}>{p.unit_price != null ? formatCurrency(p.unit_price) : '—'}</td>
                  <td style={td}>{formatCommission(p.commission_type, p.commission_value)}</td>
                  <td style={td}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '9999px', background: p.is_active ? 'rgba(16,185,129,0.12)' : '#f1f5f9', color: p.is_active ? '#059669' : '#94a3b8' }}>
                      {p.is_active ? '有効' : '停止中'}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-secondary" onClick={() => openEdit(p)} style={{ padding: '0.35rem 0.6rem', marginRight: '0.4rem' }}><Pencil size={15} /></button>
                    <button className="btn btn-danger" onClick={() => handleDelete(p)} style={{ padding: '0.35rem 0.6rem' }}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? '商材の編集' : '商材の登録'}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">商材名 *</label>
            <input className="form-input" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">事業</label>
            <select className="form-select" value={formData.business} onChange={e => setFormData({ ...formData, business: e.target.value })}>
              {BUSINESS_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">単価（任意）</label>
            <input className="form-input" type="number" min="0" value={formData.unit_price} onChange={e => setFormData({ ...formData, unit_price: e.target.value })} placeholder="例: 980" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">お礼タイプ</label>
              <select className="form-select" value={formData.commission_type} onChange={e => setFormData({ ...formData, commission_type: e.target.value })}>
                {COMMISSION_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{formData.commission_type === 'rate' ? 'お礼率（%）' : 'お礼額（円）'}</label>
              <input className="form-input" type="number" min="0" value={formData.commission_value} onChange={e => setFormData({ ...formData, commission_value: e.target.value })} placeholder={formData.commission_type === 'rate' ? '例: 10' : '例: 1000'} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">説明（任意）</label>
            <textarea className="form-input" rows={2} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
            <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} style={{ accentColor: '#e8b800' }} />
            有効（紹介できる状態にする）
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>キャンセル</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
