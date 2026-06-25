import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { generateReferralCode } from '../lib/commission';
import { businessLabel } from './Products';
import Modal from '../components/Modal';
import { TableRowSkeleton } from '../components/Skeleton';
import { Plus, Pencil, Trash2, Users, RefreshCw, MessageSquare, Link2 } from 'lucide-react';

const PARTNER_TYPES = [
  { value: 'local', label: '地域紹介パートナー' },
  { value: 'user', label: '利用者紹介パートナー' },
  { value: 'industry', label: '業種特化パートナー' },
  { value: 'side_job', label: '副業パートナー' },
  { value: 'support', label: '地域サポートパートナー' },
  { value: 'creative', label: '制作協力パートナー' },
];

export const PARTNER_STATUS = [
  { value: 'reviewing', label: '審査中', color: '#d97706', bg: '#ffedd5' },
  { value: 'active', label: '稼働中', color: '#059669', bg: 'rgba(16,185,129,0.12)' },
  { value: 'inactive', label: '停止', color: '#94a3b8', bg: '#f1f5f9' },
];
const statusInfo = (v) => PARTNER_STATUS.find(s => s.value === v) || PARTNER_STATUS[0];

const partnerTypeLabel = (v) => PARTNER_TYPES.find(t => t.value === v)?.label || '—';

const emptyForm = {
  name: '', name_kana: '', email: '', phone: '', referral_code: '',
  partner_type: 'local', company_name: '', rank_id: '', status: 'reviewing',
  note: '', is_active: true,
};

const th = { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const td = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)', verticalAlign: 'middle' };

export default function Partners() {
  const toast = useToast();
  const confirm = useConfirm();
  const [partners, setPartners] = useState([]);
  const [products, setProducts] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [rows, setRows] = useState([]); // 担当商材＋個別報酬率

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: pData }, { data: prodData }, { data: rData }] = await Promise.all([
      supabase.from('partners').select('*, partner_products(product_id), partner_ranks(name, rate_addition)').order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('is_active', true).order('created_at'),
      supabase.from('partner_ranks').select('*').order('sort_order'),
    ]);
    if (pData) setPartners(pData);
    if (prodData) setProducts(prodData);
    if (rData) setRanks(rData);
    setLoading(false);
  }

  const buildRows = (assigned = {}, overrides = {}) =>
    products.map(p => ({
      productId: p.id,
      name: p.name,
      business: p.business,
      base_reward_rate: p.base_reward_rate,
      checked: !!assigned[p.id],
      override: overrides[p.id] != null,
      custom_rate: overrides[p.id] ?? '',
    }));

  const defaultRankId = () => ranks.find(r => r.slug === 'partner')?.id || ranks[0]?.id || '';

  const openNew = () => {
    setEditingId(null);
    setFormData({ ...emptyForm, rank_id: defaultRankId(), referral_code: generateReferralCode() });
    setRows(buildRows());
    setIsModalOpen(true);
  };

  const openEdit = async (p) => {
    setEditingId(p.id);
    setFormData({
      name: p.name || '', name_kana: p.name_kana || '', email: p.email || '',
      phone: p.phone || '', referral_code: p.referral_code || '',
      partner_type: p.partner_type || 'local', company_name: p.company_name || '',
      rank_id: p.rank_id || defaultRankId(), status: p.status || 'reviewing',
      note: p.note || '', is_active: p.is_active ?? true,
    });
    const [{ data: pp }, { data: pcr }] = await Promise.all([
      supabase.from('partner_products').select('product_id').eq('partner_id', p.id),
      supabase.from('partner_commission_rules').select('product_id, custom_rate').eq('partner_id', p.id),
    ]);
    const assigned = {};
    (pp || []).forEach(r => { assigned[r.product_id] = true; });
    const overrides = {};
    (pcr || []).forEach(r => { if (r.custom_rate != null) overrides[r.product_id] = r.custom_rate; });
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
      rank_id: formData.rank_id || null, status: formData.status,
      note: formData.note.trim() || null, is_active: formData.is_active,
    };

    let partnerId = editingId;
    if (editingId) {
      const { error } = await supabase.from('partners').update(payload).eq('id', editingId);
      if (error) { setSaving(false); toast.error('保存に失敗しました: ' + error.message); return; }
    } else {
      // 新規は招待トークンを発行（本登録URLに使用）
      const insertPayload = { ...payload, invite_token: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`) };
      const { data, error } = await supabase.from('partners').insert([insertPayload]).select('id').single();
      if (error) { setSaving(false); toast.error('保存に失敗しました: ' + error.message); return; }
      partnerId = data.id;
    }

    // 担当商材・個別報酬率を同期（全削除→再挿入）
    await supabase.from('partner_products').delete().eq('partner_id', partnerId);
    await supabase.from('partner_commission_rules').delete().eq('partner_id', partnerId);

    const checkedRows = rows.filter(r => r.checked);
    if (checkedRows.length) {
      await supabase.from('partner_products').insert(
        checkedRows.map(r => ({ partner_id: partnerId, product_id: r.productId }))
      );
      const overrideRows = checkedRows.filter(r => r.override && r.custom_rate !== '');
      if (overrideRows.length) {
        await supabase.from('partner_commission_rules').insert(
          overrideRows.map(r => ({
            partner_id: partnerId, product_id: r.productId,
            custom_rate: Number(r.custom_rate),
          }))
        );
      }
    }

    setSaving(false);
    toast.success(editingId ? 'パートナーを更新しました' : 'パートナーを登録しました');
    setIsModalOpen(false);
    fetchAll();
  };

  // 招待URLを生成
  const inviteUrl = (p) => p.invite_token ? `${window.location.origin}/portal/setup/${p.invite_token}` : null;

  // SMSで招待（管理者のスマホでSMSアプリが定型文+URL付きで開く）
  const sendSmsInvite = async (p) => {
    const url = inviteUrl(p);
    if (!url) { toast.error('招待リンクがありません（再作成してください）'); return; }
    if (!p.phone) { toast.error('電話番号が未登録です。編集して電話番号を入力してください。'); return; }
    const body = `【Hinova Partners】${p.name}様、パートナー登録のご案内です。下記URLから登録を完了してください（お名前の入力だけで始められます）。\n${url}`;
    const tel = p.phone.replace(/[^\d+]/g, '');
    if (!p.invited_at) {
      await supabase.from('partners').update({ invited_at: new Date().toISOString() }).eq('id', p.id);
      fetchAll();
    }
    window.location.href = `sms:${tel}?&body=${encodeURIComponent(body)}`;
  };

  // 招待URLをコピー
  const copyInvite = async (p) => {
    const url = inviteUrl(p);
    if (!url) { toast.error('招待リンクがありません（再作成してください）'); return; }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('招待URLをコピーしました');
      if (!p.invited_at) {
        await supabase.from('partners').update({ invited_at: new Date().toISOString() }).eq('id', p.id);
        fetchAll();
      }
    } catch {
      toast.error('コピーに失敗しました: ' + url);
    }
  };

  // 招待状況
  const inviteState = (p) => {
    if (p.activated_at || p.auth_user_id) return { label: '本登録済み', color: '#059669', bg: 'rgba(16,185,129,0.12)' };
    if (p.invited_at) return { label: '招待済み', color: '#2563eb', bg: '#dbeafe' };
    return { label: '未招待', color: '#94a3b8', bg: '#f1f5f9' };
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
          <p className="page-header-desc">紹介してくれる方を登録し、ランク・紹介できる商材・個別報酬率を設定します。</p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={18} /> パートナーを登録
        </button>
      </div>

      {/* スマホ：カード表示 */}
      <div className="mobile-only">
        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>読み込み中...</p>
        ) : partners.length === 0 ? (
          <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} /><br />
            パートナーがまだ登録されていません。
          </div>
        ) : (
          <div>
            {partners.map(p => {
              const s = statusInfo(p.status);
              const iv = inviteState(p);
              const notActivated = !(p.activated_at || p.auth_user_id);
              return (
                <div key={p.id} className="m-card">
                  <div className="m-card__row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{p.name}</div>
                      {p.name_kana && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.name_kana}</div>}
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '9999px', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.85rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>{partnerTypeLabel(p.partner_type)}</span>
                    <span>ランク: {p.partner_ranks?.name || '—'}</span>
                    <span>担当 {p.partner_products?.length || 0}件</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--link)' }}>{p.referral_code || '—'}</span>
                    <span style={{ fontWeight: 700, color: iv.color }}>招待: {iv.label}</span>
                    {p.phone && <span>📞 {p.phone}</span>}
                  </div>
                  {notActivated && (
                    <div className="m-card__actions">
                      <button className="btn btn-primary" onClick={() => sendSmsInvite(p)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><MessageSquare size={16} /> SMSで招待</button>
                      <button className="btn btn-secondary" onClick={() => copyInvite(p)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Link2 size={16} /> URLコピー</button>
                    </div>
                  )}
                  <div className="m-card__actions">
                    <button className="btn btn-secondary" onClick={() => openEdit(p)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Pencil size={16} /> 編集</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(p)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Trash2 size={16} /> 削除</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* デスクトップ：テーブル表示 */}
      <div className="glass-card desktop-only" style={{ overflow: 'hidden' }}>
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
                <th style={th}>招待</th>
                <th style={{ ...th, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton cols={7} rows={5} />
              ) : partners.length === 0 ? (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }} colSpan={8}>
                  <Users size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} /><br />
                  パートナーがまだ登録されていません。
                </td></tr>
              ) : partners.map(p => {
                const s = statusInfo(p.status);
                const rankName = p.partner_ranks?.name || '—';
                const add = p.partner_ranks?.rate_addition;
                return (
                  <tr key={p.id}>
                    <td style={{ ...td, fontWeight: 700 }}>
                      {p.name}
                      {p.name_kana && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{p.name_kana}</div>}
                    </td>
                    <td style={td}>{partnerTypeLabel(p.partner_type)}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--link)' }}>{p.referral_code || '—'}</td>
                    <td style={td}>{p.partner_products?.length || 0} 件</td>
                    <td style={td}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{rankName}</span>
                      {add != null && add > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}> +{add}%</span>}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '9999px', background: s.bg, color: s.color }}>
                        {s.label}
                      </span>
                    </td>
                    <td style={td}>
                      {(() => { const iv = inviteState(p); return (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '9999px', background: iv.bg, color: iv.color }}>{iv.label}</span>
                      ); })()}
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {!(p.activated_at || p.auth_user_id) && (
                        <>
                          <button className="btn btn-secondary" title="SMSで招待" onClick={() => sendSmsInvite(p)} style={{ padding: '0.35rem 0.6rem', marginRight: '0.4rem' }}><MessageSquare size={15} /></button>
                          <button className="btn btn-secondary" title="招待URLをコピー" onClick={() => copyInvite(p)} style={{ padding: '0.35rem 0.6rem', marginRight: '0.4rem' }}><Link2 size={15} /></button>
                        </>
                      )}
                      <button className="btn btn-secondary" onClick={() => openEdit(p)} style={{ padding: '0.35rem 0.6rem', marginRight: '0.4rem' }}><Pencil size={15} /></button>
                      <button className="btn btn-danger" onClick={() => handleDelete(p)} style={{ padding: '0.35rem 0.6rem' }}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
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
              <label className="form-label">ステータス</label>
              <select className="form-select" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                {PARTNER_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">ランク</label>
              <select className="form-select" value={formData.rank_id} onChange={e => setFormData({ ...formData, rank_id: e.target.value })}>
                {ranks.map(r => <option key={r.id} value={r.id}>{r.name}（+{r.rate_addition}%）</option>)}
              </select>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>ランク加算は「稼働中」のときのみ適用されます。</p>
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

          {/* 担当商材＋個別報酬率 */}
          <div>
            <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>紹介できる商材と個別報酬率</label>
            {products.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>先に「商材管理」で商材を登録してください。</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid var(--border-light)', borderRadius: '0.6rem', padding: '0.75rem' }}>
                {rows.map(r => (
                  <div key={r.productId} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                      <input type="checkbox" checked={r.checked} onChange={e => updateRow(r.productId, { checked: e.target.checked })} style={{ accentColor: '#e8b800' }} />
                      {r.name}
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        （{businessLabel(r.business)}{r.base_reward_rate != null ? ` / 基本${r.base_reward_rate}%` : ''}）
                      </span>
                    </label>
                    {r.checked && (
                      <div style={{ marginLeft: '1.5rem', marginTop: '0.4rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          <input type="checkbox" checked={r.override} onChange={e => updateRow(r.productId, { override: e.target.checked })} style={{ accentColor: '#e8b800' }} />
                          このパートナーだけ報酬率を個別設定する（ランクより優先）
                        </label>
                        {r.override && (
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.4rem' }}>
                            <input className="form-input" type="number" min="0" step="0.1" placeholder="率" value={r.custom_rate} onChange={e => updateRow(r.productId, { custom_rate: e.target.value })} style={{ width: '6rem' }} />
                            <span style={{ fontSize: '0.85rem' }}>%</span>
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
            有効（一覧・紹介の対象にする）
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
