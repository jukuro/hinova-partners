import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency } from '../lib/utils';
import { ROUNDING_LABEL } from '../lib/commission';
import { TableRowSkeleton } from '../components/Skeleton';
import { Coins, ChevronDown, ChevronRight } from 'lucide-react';

// 承認ステップなし：未払い → 支払済み（取消は例外）
const COMM_STATUS = [
  { value: 'pending', label: '未払い', color: '#d97706', bg: '#ffedd5' },
  { value: 'paid', label: '支払済み', color: '#059669', bg: '#dcfce7' },
  { value: 'cancelled', label: '取消', color: '#64748b', bg: '#e2e8f0' },
];
// 旧データの 'confirmed' は未払い扱いで表示
const statusInfo = (v) => COMM_STATUS.find(s => s.value === v) || COMM_STATUS[0];

const th = { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const td = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)', verticalAlign: 'middle' };

export default function Commissions() {
  const toast = useToast();
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [filters, setFilters] = useState({ month: '', partner: '', product: '', status: '' });

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const { data } = await supabase
      .from('commissions')
      .select('*, partners(name), deals(customer_name), leads(customer_name)')
      .order('created_at', { ascending: false });
    if (data) setCommissions(data);
    setLoading(false);
  }

  const partnerName = (c) => c.partners?.name || '—';
  const customerName = (c) => c.customer_name || c.deals?.customer_name || c.leads?.customer_name || '—';
  const productName = (c) => c.product_name || '—';

  // フィルター選択肢
  const partnerOptions = useMemo(() => [...new Set(commissions.map(partnerName))].filter(n => n !== '—'), [commissions]);
  const productOptions = useMemo(() => [...new Set(commissions.map(productName))].filter(n => n !== '—'), [commissions]);
  const monthOptions = useMemo(() => [...new Set(commissions.map(c => c.payment_month).filter(Boolean))].sort().reverse(), [commissions]);

  const filtered = useMemo(() => commissions.filter(c => {
    if (filters.month && c.payment_month !== filters.month) return false;
    if (filters.partner && partnerName(c) !== filters.partner) return false;
    if (filters.product && productName(c) !== filters.product) return false;
    if (filters.status && (statusInfo(c.status).value) !== filters.status) return false;
    return true;
  }), [commissions, filters]);

  const monthSummary = useMemo(() => {
    const map = {};
    filtered.forEach(c => {
      if (statusInfo(c.status).value === 'cancelled' || c.amount == null || !c.payment_month) return;
      map[c.payment_month] = (map[c.payment_month] || 0) + Number(c.amount);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const handleStatusChange = async (c, status) => {
    const patch = { status };
    if (status === 'paid') patch.paid_at = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('commissions').update(patch).eq('id', c.id);
    if (error) { toast.error('更新に失敗しました: ' + error.message); return; }
    fetchAll();
  };

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const selectStyle = { fontSize: '0.82rem', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-input, #fff)' };

  const renderBasis = (c) => {
    const b = c.calculation_basis || {};
    const parts = [];
    if (b.base_rate != null) parts.push(`基本報酬率: ${b.base_rate}%`);
    if (b.resolved_by === 'custom' && b.custom_rate != null) parts.push(`個別報酬率: ${b.custom_rate}%`);
    if (b.rank_name && b.rank_addition != null) parts.push(`ランク(${b.rank_name}): +${b.rank_addition}%`);
    parts.push(`適用率: ${c.applied_rate}%`);
    return (
      <div style={{ background: 'var(--bg-subtle, #f8fafc)', borderRadius: '0.5rem', padding: '0.75rem 1rem', fontSize: '0.82rem', lineHeight: 1.7 }}>
        <div>{parts.join(' ｜ ')}</div>
        {b.locked_at && <div style={{ color: 'var(--text-muted)' }}>契約日: {b.locked_at}（この率で固定）</div>}
        {b.raw_amount != null && (
          <div>
            計算: {c.payment_amount != null ? formatCurrency(c.payment_amount) : '—'} × {c.applied_rate}%
            = {Math.round(b.raw_amount).toLocaleString()}円
            → <strong>{formatCurrency(b.final_amount ?? c.amount)}</strong>
            <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>（{ROUNDING_LABEL[b.rounding_rule] || b.rounding_rule || '—'}）</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>お礼額管理（報酬履歴）</h1>
          <p className="page-header-desc">入金確認されると、契約日に確定した報酬率で自動計算されたお礼額が記録されます。料金・率を後から変えても過去の履歴は変わりません。</p>
        </div>
      </div>

      {monthSummary.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.85rem' }}>
          {monthSummary.map(([month, total]) => (
            <div key={month} className="glass-card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>{month.replace('-', '年')}月 お礼予定額</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>{formatCurrency(total)}</div>
            </div>
          ))}
        </div>
      )}

      {/* フィルター */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={selectStyle} value={filters.month} onChange={e => setFilters({ ...filters, month: e.target.value })}>
          <option value="">対象月：すべて</option>
          {monthOptions.map(m => <option key={m} value={m}>{m.replace('-', '年')}月</option>)}
        </select>
        <select style={selectStyle} value={filters.partner} onChange={e => setFilters({ ...filters, partner: e.target.value })}>
          <option value="">パートナー：すべて</option>
          {partnerOptions.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select style={selectStyle} value={filters.product} onChange={e => setFilters({ ...filters, product: e.target.value })}>
          <option value="">商材：すべて</option>
          {productOptions.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select style={selectStyle} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
          <option value="">状態：すべて</option>
          {COMM_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: '2rem' }}></th>
                <th style={th}>対象月</th>
                <th style={th}>パートナー</th>
                <th style={th}>顧客</th>
                <th style={th}>商材</th>
                <th style={{ ...th, textAlign: 'right' }}>決済金額</th>
                <th style={{ ...th, textAlign: 'right' }}>適用率</th>
                <th style={{ ...th, textAlign: 'right' }}>お礼額</th>
                <th style={th}>状態</th>
                <th style={{ ...th, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton cols={10} rows={5} />
              ) : filtered.length === 0 ? (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }} colSpan={10}>
                  <Coins size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} /><br />
                  お礼額がまだありません。紹介が入金確認されると作成されます。
                </td></tr>
              ) : filtered.map(c => {
                const s = statusInfo(c.status);
                const isOpen = !!expanded[c.id];
                return (
                  <React.Fragment key={c.id}>
                    <tr>
                      <td style={{ ...td, textAlign: 'center', cursor: 'pointer' }} onClick={() => toggle(c.id)}>
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </td>
                      <td style={td}>{c.payment_month ? c.payment_month.replace('-', '年') + '月' : '—'}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{partnerName(c)}</td>
                      <td style={td}>{customerName(c)}</td>
                      <td style={td}>{productName(c)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{c.payment_amount != null ? formatCurrency(c.payment_amount) : '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{c.applied_rate != null ? `${c.applied_rate}%` : '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{c.amount != null ? formatCurrency(c.amount) : '—'}</td>
                      <td style={td}>
                        <select
                          value={s.value}
                          onChange={e => handleStatusChange(c, e.target.value)}
                          className="status-select"
                          style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.25rem 1.5rem 0.25rem 0.6rem', borderRadius: '9999px', border: 'none', background: s.bg, color: s.color, cursor: 'pointer' }}
                        >
                          {COMM_STATUS.map(o => <option key={o.value} value={o.value} style={{ background: '#fff', color: '#1e293b' }}>{o.label}</option>)}
                        </select>
                      </td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {s.value === 'pending' && (
                          <button className="btn btn-secondary" onClick={() => handleStatusChange(c, 'paid')} style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}>支払済みにする</button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td></td>
                        <td colSpan={9} style={{ ...td, padding: '0.5rem 1rem 1rem' }}>{renderBasis(c)}</td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
