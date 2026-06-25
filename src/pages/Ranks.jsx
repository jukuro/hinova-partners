import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import Modal from '../components/Modal';
import { TableRowSkeleton } from '../components/Skeleton';
import { Plus, Pencil, Trash2, Award } from 'lucide-react';

const emptyForm = { name: '', slug: '', rate_addition: '', sort_order: '' };

const th = { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const td = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)', verticalAlign: 'middle' };

const slugify = (s) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `rank_${Date.now()}`;

export default function Ranks() {
  const toast = useToast();
  const confirm = useConfirm();
  const [ranks, setRanks] = useState([]);
  const [counts, setCounts] = useState({}); // rank_id -> パートナー数
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: rData }, { data: pData }] = await Promise.all([
      supabase.from('partner_ranks').select('*').order('sort_order'),
      supabase.from('partners').select('rank_id'),
    ]);
    if (rData) setRanks(rData);
    const c = {};
    (pData || []).forEach(p => { if (p.rank_id) c[p.rank_id] = (c[p.rank_id] || 0) + 1; });
    setCounts(c);
    setLoading(false);
  }

  const openNew = () => {
    setEditingId(null);
    setFormData({ ...emptyForm, sort_order: String((ranks[ranks.length - 1]?.sort_order ?? 0) + 1) });
    setIsModalOpen(true);
  };
  const openEdit = (r) => {
    setEditingId(r.id);
    setFormData({ name: r.name || '', slug: r.slug || '', rate_addition: r.rate_addition ?? '', sort_order: r.sort_order ?? '' });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: formData.name.trim(),
      slug: (formData.slug.trim() || slugify(formData.name)),
      rate_addition: formData.rate_addition === '' ? 0 : Number(formData.rate_addition),
      sort_order: formData.sort_order === '' ? 0 : Number(formData.sort_order),
    };
    const { error } = editingId
      ? await supabase.from('partner_ranks').update(payload).eq('id', editingId)
      : await supabase.from('partner_ranks').insert([payload]);
    setSaving(false);
    if (error) { toast.error('保存に失敗しました: ' + error.message); return; }
    toast.success(editingId ? 'ランクを更新しました' : 'ランクを追加しました');
    setIsModalOpen(false);
    fetchAll();
  };

  const handleDelete = async (r) => {
    const used = counts[r.id] || 0;
    if (used > 0) {
      toast.error(`このランクは${used}名のパートナーが使用中のため削除できません。`);
      return;
    }
    const ok = await confirm({
      title: 'ランクの削除', message: `「${r.name}」を削除しますか？`,
      confirmLabel: '削除する', variant: 'danger',
    });
    if (!ok) return;
    const { error } = await supabase.from('partner_ranks').delete().eq('id', r.id);
    if (error) { toast.error('削除に失敗しました: ' + error.message); return; }
    toast.success('ランクを削除しました');
    fetchAll();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>ランク管理</h1>
          <p className="page-header-desc">パートナーランクごとの報酬加算率を設定します。加算率の変更は既存契約・既存履歴には影響しません（契約日ロック）。</p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={18} /> ランクを追加
        </button>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>ランク名</th>
                <th style={th}>加算率</th>
                <th style={th}>対象パートナー数</th>
                <th style={{ ...th, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton cols={4} rows={3} />
              ) : ranks.length === 0 ? (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }} colSpan={4}>
                  <Award size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} /><br />
                  ランクがまだありません。
                </td></tr>
              ) : ranks.map(r => (
                <tr key={r.id}>
                  <td style={{ ...td, fontWeight: 700 }}>{r.name}</td>
                  <td style={td}><span style={{ fontWeight: 700, color: '#b45309' }}>+{r.rate_addition}%</span></td>
                  <td style={td}>{counts[r.id] || 0} 名</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-secondary" onClick={() => openEdit(r)} style={{ padding: '0.35rem 0.6rem', marginRight: '0.4rem' }}><Pencil size={15} /></button>
                    <button className="btn btn-danger" onClick={() => handleDelete(r)} style={{ padding: '0.35rem 0.6rem' }} disabled={(counts[r.id] || 0) > 0}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'ランクの編集' : 'ランクの追加'}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">ランク名 *</label>
            <input className="form-input" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="例: Hinova Local Partner" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">加算率（%）</label>
              <input className="form-input" type="number" min="0" step="0.1" value={formData.rate_addition} onChange={e => setFormData({ ...formData, rate_addition: e.target.value })} placeholder="例: 3" />
            </div>
            <div className="form-group">
              <label className="form-label">並び順</label>
              <input className="form-input" type="number" value={formData.sort_order} onChange={e => setFormData({ ...formData, sort_order: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">識別子（slug・任意）</label>
            <input className="form-input" value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} placeholder="空欄なら自動生成" style={{ fontFamily: 'monospace' }} />
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
