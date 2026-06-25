import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { BUSINESS_OPTIONS, businessLabel } from './Products';
import Modal from '../components/Modal';
import { TableRowSkeleton } from '../components/Skeleton';
import { Plus, Pencil, Trash2, FileText, ExternalLink } from 'lucide-react';

const MATERIAL_CATEGORIES = [
  { value: 'intro', label: 'はじめて説明する方向け' },
  { value: 'customer_facing', label: '顧客に見せる資料' },
  { value: 'partner_guide', label: 'パートナー用説明ガイド' },
  { value: 'faq', label: 'よくある質問' },
  { value: 'prohibited', label: '禁止表現ガイド' },
  { value: 'industry', label: '業種別資料' },
  { value: 'url_qr', label: 'URL・QR素材' },
];
const categoryLabel = (v) => MATERIAL_CATEGORIES.find(c => c.value === v)?.label || '—';

const emptyForm = { title: '', category: 'intro', business: '', file_url: '', description: '', is_public: true, min_rank_sort: '' };

const th = { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const td = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)', verticalAlign: 'middle' };

export default function Materials() {
  const toast = useToast();
  const confirm = useConfirm();
  const [materials, setMaterials] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data }, { data: rData }] = await Promise.all([
      supabase.from('materials').select('*').order('created_at', { ascending: false }),
      supabase.from('partner_ranks').select('*').order('sort_order'),
    ]);
    if (data) setMaterials(data);
    if (rData) setRanks(rData);
    setLoading(false);
  }

  const rankLabel = (sort) => {
    if (sort == null) return '全員';
    const r = ranks.find(x => x.sort_order === Number(sort));
    return r ? `${r.name}以上` : `ランク${sort}以上`;
  };

  const openNew = () => { setEditingId(null); setFormData(emptyForm); setIsModalOpen(true); };
  const openEdit = (m) => {
    setEditingId(m.id);
    setFormData({
      title: m.title || '', category: m.category || 'intro', business: m.business || '',
      file_url: m.file_url || '', description: m.description || '', is_public: m.is_public ?? true,
      min_rank_sort: m.min_rank_sort ?? '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: formData.title.trim(), category: formData.category,
      business: formData.business || null, file_url: formData.file_url.trim() || null,
      description: formData.description.trim() || null, is_public: formData.is_public,
      min_rank_sort: formData.min_rank_sort === '' ? null : Number(formData.min_rank_sort),
    };
    const { error } = editingId
      ? await supabase.from('materials').update(payload).eq('id', editingId)
      : await supabase.from('materials').insert([payload]);
    setSaving(false);
    if (error) { toast.error('保存に失敗しました: ' + error.message); return; }
    toast.success(editingId ? '資料を更新しました' : '資料を登録しました');
    setIsModalOpen(false);
    fetchAll();
  };

  const handleDelete = async (m) => {
    const ok = await confirm({ title: '資料の削除', message: `「${m.title}」を削除しますか？`, confirmLabel: '削除する', variant: 'danger' });
    if (!ok) return;
    const { error } = await supabase.from('materials').delete().eq('id', m.id);
    if (error) { toast.error('削除に失敗しました: ' + error.message); return; }
    toast.success('削除しました');
    fetchAll();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>説明資料</h1>
          <p className="page-header-desc">パートナーが安心して紹介できるよう、説明資料のリンクを登録します。</p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={18} /> 資料を登録
        </button>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>タイトル</th>
                <th style={th}>カテゴリ</th>
                <th style={th}>事業</th>
                <th style={th}>公開ランク</th>
                <th style={th}>公開</th>
                <th style={{ ...th, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton cols={5} rows={5} />
              ) : materials.length === 0 ? (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }} colSpan={6}>
                  <FileText size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} /><br />
                  資料がまだ登録されていません。
                </td></tr>
              ) : materials.map(m => (
                <tr key={m.id}>
                  <td style={{ ...td, fontWeight: 700 }}>
                    {m.file_url ? (
                      <a href={m.file_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        {m.title} <ExternalLink size={13} />
                      </a>
                    ) : m.title}
                    {m.description && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>{m.description}</div>}
                  </td>
                  <td style={td}>{categoryLabel(m.category)}</td>
                  <td style={td}>{m.business ? businessLabel(m.business) : '共通'}</td>
                  <td style={td}><span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{rankLabel(m.min_rank_sort)}</span></td>
                  <td style={td}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: m.is_public ? '#059669' : '#94a3b8' }}>{m.is_public ? '公開' : '非公開'}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-secondary" onClick={() => openEdit(m)} style={{ padding: '0.35rem 0.6rem', marginRight: '0.4rem' }}><Pencil size={15} /></button>
                    <button className="btn btn-danger" onClick={() => handleDelete(m)} style={{ padding: '0.35rem 0.6rem' }}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? '資料の編集' : '資料の登録'}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">タイトル *</label>
            <input className="form-input" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">カテゴリ</label>
              <select className="form-select" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                {MATERIAL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">対象事業（任意）</label>
              <select className="form-select" value={formData.business} onChange={e => setFormData({ ...formData, business: e.target.value })}>
                <option value="">共通</option>
                {BUSINESS_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">公開ランク（このランク以上で閲覧可）</label>
            <select className="form-select" value={formData.min_rank_sort} onChange={e => setFormData({ ...formData, min_rank_sort: e.target.value })}>
              <option value="">全員（制限なし）</option>
              {ranks.map(r => <option key={r.id} value={r.sort_order}>{r.name}以上</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">資料のURL（Google Drive・LP・PDFなど）</label>
            <input className="form-input" value={formData.file_url} onChange={e => setFormData({ ...formData, file_url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="form-group">
            <label className="form-label">説明（任意）</label>
            <textarea className="form-input" rows={2} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
            <input type="checkbox" checked={formData.is_public} onChange={e => setFormData({ ...formData, is_public: e.target.checked })} style={{ accentColor: '#e8b800' }} />
            パートナーに公開する
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
