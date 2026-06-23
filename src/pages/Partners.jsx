import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { generateReferralCode } from '../lib/commission';
import { COMMISSION_TYPES, businessLabel } from './Products';
import Modal from '../components/Modal';
import { TableRowSkeleton } from '../components/Skeleton';
import { Plus, Pencil, Trash2, Users, RefreshCw } from 'lucide-react';

const PARTNER_TYPES = [
  { value: 'local', label: '地域紹介パートナー' },
  { value: 'user', label: '利用者紹介パートナー' },
  { value: 'industry', label: '業種特化パートナー' },
  { value: 'side_job', label: '副業パートナー' },
  { value: 'support', label: '地域サポートパートナー' },
  { value: 'creative', label: '制作協力パートナー' },
];

const RANKS = [
  { value: 'supporter', label: 'Hinova Supporter' },
  { value: 'guide', label: 'Hinova Guide' },
  { value: 'partner', label: 'Hinova Partner' },
  { value: 'local_partner', label: 'Hinova Local Partner' },
  { value: 'trusted_partner', label: 'Hinova Trusted Partner' },
];

const partnerTypeLabel = (v) => PARTNER_TYPES.find(t => t.value === v)?.label || '—';
const rankLabel = (v) => RANKS.find(r => r.value === v)?.label || 'Hinova Supporter';

const emptyForm = {
  name: '', name_kana: '', email: '', phone: '', referral_code: '',
  partner_type: 'local', company_name: '', rank: 'supporter', note: '', is_active: true,
};

const th = { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const td = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)', verticalAlign: 'middle' };

export default function Partners() {
  const toast = useToast();
  const confirm = useConfirm();
  const [partners, setPartners] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [rows, setRows] = useState([]); // 担当商材＋個別お礼

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: pData }, { data: prodData }] = await Promise.all([
      supabase.from('partners').select('*, partner_products(product_id)').order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('is_active', true).order('created_at'),
    ]);
    if (pData) setPartners(pData);
    if (prodData) setProducts(prodData);
    setLoading(false);
  }

  const buildRows = (assigned = {}, overrides = {}) =>
    products.map(p => {
      const ov = overrides[p.id];
      return {
        productId: p.id,
        name: p.name,
        business: p.business,
        checked: !!assigned[p.id],
        override: !!ov,
        commission_type: ov?.commission_type || p.commission_type || 'fixed',
        commission_value: ov?.commission_value ?? '',
      };
    });

  const openNew = () => {
    setEditingId(null);
    setFormData({ ...emptyForm, referral_code: generateReferralCode() });
    setRows(buildRows());
    setIsModalOpen(true);
  };

  const openEdit = async (p) => {
    setEditingId(p.id);
    setFormData({
      name: p.name || '', name_kana: p.name_kana || '', email: p.email || '',
      phone: p.phone || '', referral_code: p.referral_code || '',
      partner_type: p.partner_type || 'local', company_name: p.company_name || '',
      rank: p.rank || 'supporter', note: p.note || '', is_active: p.is_active ?? true,
    });
    const [{ data: pp }, { data: pcr }] = await Promise.all([
      supabase.from('partner_products').select('product_id').eq('partner_id', p.id),
      supabase.from('partner_commission_rules').select('product_id, commission_type, commission_value').eq('partner_id', p.id),
    ]);
    const assigned = {};
    (pp || []).forEach(r => { assigned[r.product_id] = true; });
    const overrides = {};
    (pcr || []).forEach(r => { overrides[r.product_id] = { commission_type: r.commission_type, commission_value: r.commission_value }; });
    setRows(buildRows(assigned, overrides));
    setIsModalOpen(true);
  };

  const updateRow = (productId, patch) =>
    setRows(prev => prev.map(r => r.productId === productId ? { ...r, ...patch } : r));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: formData.name.trim(), name_kana: formData.name_kana.trim() || null,
      email: formData.email.trim() || null, phone: formData.phone.trim() || null,
      referral_code: formData.referral_code.trim() || null,
      partner_type: formData.partner_type, company_name: formData.company_name.trim() || null,
      rank: formData.rank, note: formData.note.trim() || null, is_active: formData.is_active,
    };

    let partnerId = editingId;
    if (editingId) {
      const { error } = await supabase.from('partners').update(payload).eq('id', editingId);
      if (error) { setSaving(false); toast.error('保存に失敗しました: ' + error.message); return; }
    } else {
      const { data, error } = await supabase.from('partners').insert([payload]).select('id').single();
      if (error) { setSaving(false); toast.error('保存に失敗しました: ' + error.message); return; }
      partnerId = data.id;
    }

    // 担当商材・個別お礼を同期（全削除→再挿入）
    await supabase.from('partner_products').delete().eq('partner_id', partnerId);
    await supabase.from('partner_commission_rules').delete().eq('partner_id', partnerId);

    const checkedRows = rows.filter(r => r.checked);
    if (checkedRows.length) {
      await supabase.from('partner_products').insert(
        checkedRows.map(r => ({ partner_id: partnerId, product_id: r.productId }))
      );
      const overrideRows = checkedRows.filter(r => r.override && r.commission_value !== '');
      if (overrideRows.length) {
        await supabase.from('partner_commission_rules').insert(
          overrideRows.map(r => ({
            partner_id: partnerId, product_id: r.productId,
            commission_type: r.commission_type, commission_value: Number(r.commission_value),
          }))
        );
      }
    }

    setSaving(false);
    toast.success(editingId ? 'パートナーを更新しました' : 'パートナーを登録しました');
    setIsModalOpen(false);
    fetchAll();
  };

  const handleDelete = async (p) => {
    const ok = await confirm({
      title: 'パートナーの削除', message: `「${p.name}」を削除しますか？担当商材の設定も削除されます。`,
      confirmLabel: '削除する', variant: 'danger',
    });
    if (!ok) return;
    const { error } = await supabase.from('partners').delete().eq('id', p.id);
    if (error) { toast.error('削除に失敗しました: ' + error.message); return; }
    toast.success('パートナーを削除しました');
    fetchAll();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>パートナー管理</h1>
          <p className="page-header-desc">紹介してくれる方を登録し、紹介できる商材とお礼ルールを設定します。</p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={18} /> パートナーを登録
        </button>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>名前</th>
                <th style={th}>種別</th>
                <th style={th}>紹介コード</th>
                <th style={th}>担当商材</th>
                <th style={th}>ランク</th>
                <th style={th}>状態</th>
                <th style={{ ...th, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton cols={7} rows={5} />
              ) : partners.length === 0 ? (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }} colSpan={7}>
                  <Users size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} /><br />
                  パートナーがまだ登録されていません。
                </td></tr>
              ) : partners.map(p => (
                <tr key={p.id}>
                  <td style={{ ...td, fontWeight: 700 }}>
                    {p.name}
                    {p.name_kana && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{p.name_kana}</div>}
                  </td>
                  <td style={td}>{partnerTypeLabel(p.partner_type)}</td>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--link)' }}>{p.referral_code || '—'}</td>
                  <td style={td}>{p.partner_products?.length || 0} 件</td>
                  <td style={td}><span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{rankLabel(p.rank)}</span></td>
                  <td style={td}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '9999px', background: p.is_active ? 'rgba(16,185,129,0.12)' : '#f1f5f9', color: p.is_active ? '#059669' : '#94a3b8' }}>
                      {p.is_active ? '活動中' : '停止中'}
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'パートナーの編集' : 'パートナーの登録'}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">名前 *</label>
              <input className="form-input" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">フリガナ</label>
              <input className="form-input" value={formData.name_kana} onChange={e => setFormData({ ...formData, name_kana: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">メールアドレス</label>
              <input className="form-input" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">電話番号</label>
              <input className="form-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">種別</label>
              <select className="form-select" value={formData.partner_type} onChange={e => setFormData({ ...formData, partner_type: e.target.value })}>
                {PARTNER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">ランク</label>
              <select className="form-select" value={formData.rank} onChange={e => setFormData({ ...formData, rank: e.target.value })}>
                {RANKS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">会社名・屋号（任意）</label>
              <input className="form-input" value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">紹介コード</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input className="form-input" value={formData.referral_code} onChange={e => setFormData({ ...formData, referral_code: e.target.value })} style={{ fontFamily: 'monospace' }} />
                <button type="button" className="btn btn-secondary" title="再生成" onClick={() => setFormData({ ...formData, referral_code: generateReferralCode() })} style={{ padding: '0 0.6rem' }}><RefreshCw size={15} /></button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">メモ（任意）</label>
            <textarea className="form-input" rows={2} value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} />
          </div>

          {/* 担当商材＋個別お礼 */}
          <div>
            <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>紹介できる商材とお礼</label>
            {products.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>先に「商材管理」で商材を登録してください。</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid var(--border-light)', borderRadius: '0.6rem', padding: '0.75rem' }}>
                {rows.map(r => (
                  <div key={r.productId} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                      <input type="checkbox" checked={r.checked} onChange={e => updateRow(r.productId, { checked: e.target.checked })} style={{ accentColor: '#e8b800' }} />
                      {r.name}
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>（{businessLabel(r.business)}）</span>
                    </label>
                    {r.checked && (
                      <div style={{ marginLeft: '1.5rem', marginTop: '0.4rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          <input type="checkbox" checked={r.override} onChange={e => updateRow(r.productId, { override: e.target.checked })} style={{ accentColor: '#e8b800' }} />
                          このパートナーだけお礼を個別設定する
                        </label>
                        {r.override && (
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                            <select className="form-select" value={r.commission_type} onChange={e => updateRow(r.productId, { commission_type: e.target.value })} style={{ flex: 1 }}>
                              {COMMISSION_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                            <input className="form-input" type="number" min="0" placeholder={r.commission_type === 'rate' ? '%' : '円'} value={r.commission_value} onChange={e => updateRow(r.productId, { commission_value: e.target.value })} style={{ width: '6rem' }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
            <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} style={{ accentColor: '#e8b800' }} />
            活動中（紹介を受け付ける状態にする）
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
