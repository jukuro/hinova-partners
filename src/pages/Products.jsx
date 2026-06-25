import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { formatCurrency } from '../lib/utils';
import { calcReward, ROUNDING_LABEL } from '../lib/commission';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Package, Link2 } from 'lucide-react';

export const BUSINESS_OPTIONS = [
  { value: 'hinova_biz', label: 'Hinova Biz' },
  { value: 'hinova_crm', label: 'Hinova CRM' },
  { value: 'medaka', label: 'メダカ管理アプリ' },
  { value: 'ochome', label: 'お帳面アプリ' },
  { value: 'design', label: 'デザイン制作' },
  { value: 'family_tree', label: '家系図・ヒストリー制作' },
  { value: 'other', label: 'その他' },
];

export const ROUNDING_OPTIONS = [
  { value: 'floor_10', label: '10円切り捨て' },
  { value: 'floor_100', label: '100円切り捨て' },
  { value: 'round', label: '四捨五入' },
];

export const DETECTION_OPTIONS = [
  { value: 'manual', label: '手動で契約を確認' },
  { value: 'stripe', label: 'Stripe自動（将来）' },
];

export const businessLabel = (v) => BUSINESS_OPTIONS.find(b => b.value === v)?.label || '—';
const detectionLabel = (v) => DETECTION_OPTIONS.find(d => d.value === v)?.label || '手動で契約を確認';

const emptyService = { name: '', business: 'hinova_biz', lp_url: '', detection_method: 'manual', description: '', is_active: true };
const emptyPlan = { name: '', unit_price: '', base_reward_rate: '', max_reward_rate: '', rounding_rule: 'floor_10', is_active: true };

export default function Products() {
  const toast = useToast();
  const confirm = useConfirm();
  const [services, setServices] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const [svcModal, setSvcModal] = useState(false);
  const [svcEditId, setSvcEditId] = useState(null);
  const [svcForm, setSvcForm] = useState(emptyService);

  const [planModal, setPlanModal] = useState(false);
  const [planEditId, setPlanEditId] = useState(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [planServiceId, setPlanServiceId] = useState(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('services').select('*').order('sort_order').order('created_at'),
      supabase.from('products').select('*').order('created_at'),
    ]);
    setServices(s || []);
    setPlans(p || []);
    setLoading(false);
  }

  const plansOf = (serviceId) => plans.filter(p => p.service_id === serviceId);

  // ---- 商材（サービス） ----
  const openNewService = () => { setSvcEditId(null); setSvcForm(emptyService); setSvcModal(true); };
  const openEditService = (s) => {
    setSvcEditId(s.id);
    setSvcForm({ name: s.name || '', business: s.business || 'hinova_biz', lp_url: s.lp_url || '', detection_method: s.detection_method || 'manual', description: s.description || '', is_active: s.is_active ?? true });
    setSvcModal(true);
  };
  const saveService = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: svcForm.name.trim(), business: svcForm.business,
      lp_url: svcForm.lp_url.trim() || null, detection_method: svcForm.detection_method,
      description: svcForm.description.trim() || null, is_active: svcForm.is_active,
    };
    const { error } = svcEditId
      ? await supabase.from('services').update(payload).eq('id', svcEditId)
      : await supabase.from('services').insert([payload]);
    // 商材の事業を配下プランにも同期（資料の事業フィルタ用）
    if (!error && svcEditId) await supabase.from('products').update({ business: payload.business }).eq('service_id', svcEditId);
    setSaving(false);
    if (error) { toast.error('保存に失敗しました: ' + error.message); return; }
    toast.success(svcEditId ? '商材を更新しました' : '商材を登録しました');
    setSvcModal(false); fetchAll();
  };
  const deleteService = async (s) => {
    if (plansOf(s.id).length > 0) { toast.error('プランが残っています。先にプランを削除してください。'); return; }
    const ok = await confirm({ title: '商材の削除', message: `「${s.name}」を削除しますか？`, confirmLabel: '削除する', variant: 'danger' });
    if (!ok) return;
    const { error } = await supabase.from('services').delete().eq('id', s.id);
    if (error) { toast.error('削除に失敗しました: ' + error.message); return; }
    toast.success('商材を削除しました'); fetchAll();
  };

  // ---- プラン ----
  const openNewPlan = (serviceId) => { setPlanEditId(null); setPlanServiceId(serviceId); setPlanForm(emptyPlan); setPlanModal(true); };
  const openEditPlan = (p) => {
    setPlanEditId(p.id); setPlanServiceId(p.service_id);
    setPlanForm({ name: p.name || '', unit_price: p.unit_price ?? '', base_reward_rate: p.base_reward_rate ?? '', max_reward_rate: p.max_reward_rate ?? '', rounding_rule: p.rounding_rule || 'floor_10', is_active: p.is_active ?? true });
    setPlanModal(true);
  };
  const savePlan = async (e) => {
    e.preventDefault();
    setSaving(true);
    const svc = services.find(s => s.id === planServiceId);
    const payload = {
      service_id: planServiceId,
      name: planForm.name.trim(),
      business: svc?.business || null, // 資料の事業フィルタ用に同期
      unit_price: planForm.unit_price === '' ? null : Number(planForm.unit_price),
      base_reward_rate: planForm.base_reward_rate === '' ? null : Number(planForm.base_reward_rate),
      max_reward_rate: planForm.max_reward_rate === '' ? null : Number(planForm.max_reward_rate),
      rounding_rule: planForm.rounding_rule,
      is_active: planForm.is_active,
    };
    const { error } = planEditId
      ? await supabase.from('products').update(payload).eq('id', planEditId)
      : await supabase.from('products').insert([payload]);
    setSaving(false);
    if (error) { toast.error('保存に失敗しました: ' + error.message); return; }
    toast.success(planEditId ? 'プランを更新しました' : 'プランを追加しました');
    setPlanModal(false); fetchAll();
  };
  const deletePlan = async (p) => {
    const ok = await confirm({ title: 'プランの削除', message: `「${p.name}」を削除しますか？`, confirmLabel: '削除する', variant: 'danger' });
    if (!ok) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) { toast.error('削除に失敗しました: ' + error.message); return; }
    toast.success('プランを削除しました'); fetchAll();
  };

  const planEstimate = (p) => (p.unit_price != null && p.base_reward_rate != null)
    ? calcReward(p.unit_price, p.base_reward_rate, p.rounding_rule || 'floor_10').final : null;
  const previewEstimate = planForm.unit_price !== '' && planForm.base_reward_rate !== ''
    ? calcReward(Number(planForm.unit_price), Number(planForm.base_reward_rate), planForm.rounding_rule) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>商材管理</h1>
          <p className="page-header-desc">商材（サービス）を登録し、その中にプランを追加します。LP・事業・把握方法は商材で共通、月額・報酬率はプランごとです。</p>
        </div>
        <button className="btn btn-primary" onClick={openNewService} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={18} /> 商材を登録
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>読み込み中...</p>
      ) : services.length === 0 ? (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Package size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} /><br />
          商材がまだ登録されていません。
        </div>
      ) : services.map(s => (
        <div key={s.id} className="glass-card" style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* 商材ヘッダ */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{s.name}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '9999px', background: '#f1f5f9', color: '#475569' }}>{businessLabel(s.business)}</span>
                {!s.is_active && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>停止中</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', marginTop: '0.3rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Link2 size={13} /> {s.lp_url ? <a href={s.lp_url} target="_blank" rel="noreferrer">LP設定済み</a> : <span style={{ color: '#dc2626' }}>LP未設定</span>}
                </span>
                <span>{detectionLabel(s.detection_method)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button className="btn btn-secondary" onClick={() => openEditService(s)} style={{ padding: '0.35rem 0.6rem' }}><Pencil size={15} /></button>
              <button className="btn btn-danger" onClick={() => deleteService(s)} style={{ padding: '0.35rem 0.6rem' }}><Trash2 size={15} /></button>
            </div>
          </div>

          {/* プラン一覧 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {plansOf(s.id).length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>プランがありません。</p>
            ) : plansOf(s.id).map(p => {
              const est = planEstimate(p);
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', border: '1px solid var(--border-light)', borderRadius: '0.6rem', padding: '0.6rem 0.8rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 700 }}>{p.name}</span>
                    {!p.is_active && <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '0.4rem' }}>停止中</span>}
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      月額 {p.unit_price != null ? formatCurrency(p.unit_price) : '—'} ・ 報酬率 {p.base_reward_rate != null ? `${p.base_reward_rate}%` : '未設定'}
                      {est != null && <> ・ お礼目安 <strong>{formatCurrency(est)}</strong></>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button className="btn btn-secondary" onClick={() => openEditPlan(p)} style={{ padding: '0.3rem 0.5rem' }}><Pencil size={14} /></button>
                    <button className="btn btn-danger" onClick={() => deletePlan(p)} style={{ padding: '0.3rem 0.5rem' }}><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
            <button className="btn btn-secondary" onClick={() => openNewPlan(s.id)} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.7rem', fontSize: '0.82rem' }}>
              <Plus size={15} /> プランを追加
            </button>
          </div>
        </div>
      ))}

      {/* 商材モーダル */}
      <Modal isOpen={svcModal} onClose={() => setSvcModal(false)} title={svcEditId ? '商材の編集' : '商材の登録'}>
        <form onSubmit={saveService} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">商材名 *</label>
            <input className="form-input" required value={svcForm.name} onChange={e => setSvcForm({ ...svcForm, name: e.target.value })} placeholder="例: Hinova Biz" />
          </div>
          <div className="form-group">
            <label className="form-label">事業</label>
            <select className="form-select" value={svcForm.business} onChange={e => setSvcForm({ ...svcForm, business: e.target.value })}>
              {BUSINESS_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">LP（ランディングページ）URL</label>
            <input className="form-input" value={svcForm.lp_url} onChange={e => setSvcForm({ ...svcForm, lp_url: e.target.value })} placeholder="https://..." />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>パートナーの紹介リンクは、このURLに紹介コード（?ref=）を付けて送られます。</p>
          </div>
          <div className="form-group">
            <label className="form-label">契約の把握方法</label>
            <select className="form-select" value={svcForm.detection_method} onChange={e => setSvcForm({ ...svcForm, detection_method: e.target.value })}>
              {DETECTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">説明（任意）</label>
            <textarea className="form-input" rows={2} value={svcForm.description} onChange={e => setSvcForm({ ...svcForm, description: e.target.value })} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
            <input type="checkbox" checked={svcForm.is_active} onChange={e => setSvcForm({ ...svcForm, is_active: e.target.checked })} style={{ accentColor: '#e8b800' }} />
            有効
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setSvcModal(false)}>キャンセル</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </Modal>

      {/* プランモーダル */}
      <Modal isOpen={planModal} onClose={() => setPlanModal(false)} title={planEditId ? 'プランの編集' : 'プランの追加'}>
        <form onSubmit={savePlan} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">プラン名 *</label>
            <input className="form-input" required value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} placeholder="例: スタンダード" />
          </div>
          <div className="form-group">
            <label className="form-label">月額（円）</label>
            <input className="form-input" type="number" min="0" value={planForm.unit_price} onChange={e => setPlanForm({ ...planForm, unit_price: e.target.value })} placeholder="例: 2980" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">基本報酬率（%）</label>
              <input className="form-input" type="number" min="0" step="0.1" value={planForm.base_reward_rate} onChange={e => setPlanForm({ ...planForm, base_reward_rate: e.target.value })} placeholder="例: 17" />
            </div>
            <div className="form-group">
              <label className="form-label">最大報酬率（%・任意）</label>
              <input className="form-input" type="number" min="0" step="0.1" value={planForm.max_reward_rate} onChange={e => setPlanForm({ ...planForm, max_reward_rate: e.target.value })} placeholder="上限なしは空欄" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">端数処理</label>
            <select className="form-select" value={planForm.rounding_rule} onChange={e => setPlanForm({ ...planForm, rounding_rule: e.target.value })}>
              {ROUNDING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {previewEstimate && previewEstimate.final != null && (
            <div style={{ background: 'rgba(232,184,0,0.08)', border: '1px solid rgba(232,184,0,0.3)', borderRadius: '0.6rem', padding: '0.7rem 0.9rem', fontSize: '0.85rem' }}>
              <strong>お礼目安：</strong> {formatCurrency(Number(planForm.unit_price))} × {planForm.base_reward_rate}%
              → <strong style={{ color: '#b45309' }}>{formatCurrency(previewEstimate.final)}</strong>
              <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>（{ROUNDING_LABEL[planForm.rounding_rule]}・基本報酬率時）</span>
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
            <input type="checkbox" checked={planForm.is_active} onChange={e => setPlanForm({ ...planForm, is_active: e.target.checked })} style={{ accentColor: '#e8b800' }} />
            有効
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setPlanModal(false)}>キャンセル</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
