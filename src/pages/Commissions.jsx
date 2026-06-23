import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency } from '../lib/utils';
import { TableRowSkeleton } from '../components/Skeleton';
import { Coins, Check } from 'lucide-react';

const COMM_STATUS = [
  { value: 'pending', label: '確認待ち', color: '#d97706', bg: '#ffedd5' },
  { value: 'confirmed', label: '確定', color: '#2563eb', bg: '#dbeafe' },
  { value: 'paid', label: '支払い済み', color: '#059669', bg: '#dcfce7' },
  { value: 'cancelled', label: '取消', color: '#64748b', bg: '#e2e8f0' },
];
const statusInfo = (v) => COMM_STATUS.find(s => s.value === v) || COMM_STATUS[0];

const th = { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const td = { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border-light)', verticalAlign: 'middle' };

export default function Commissions() {
  const toast = useToast();
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amountEdits, setAmountEdits] = useState({});

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

  const originName = (c) => c.deals?.customer_name || c.leads?.customer_name || '—';

  const monthSummary = useMemo(() => {
    const map = {};
    commissions.forEach(c => {
      if (c.status === 'cancelled' || c.amount == null || !c.payment_month) return;
      map[c.payment_month] = (map[c.payment_month] || 0) + Number(c.amount);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [commissions]);

  const handleAmountSave = async (c) => {
    const raw = amountEdits[c.id];
    if (raw == null || raw === '') return;
    const amount = Number(raw);
    const patch = { amount };
    if (c.status === 'pending') patch.status = 'confirmed';
    const { error } = await supabase.from('commissions').update(patch).eq('id', c.id);
    if (error) { toast.error('保存に失敗しました: ' + error.message); return; }
    toast.success('お礼額を確定しました');
    setAmountEdits(prev => { const n = { ...prev }; delete n[c.id]; return n; });
    fetchAll();
  };

  const handleStatusChange = async (c, status) => {
    const patch = { status };
    if (status === 'paid') patch.paid_at = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('commissions').update(patch).eq('id', c.id);
    if (error) { toast.error('更新に失敗しました: ' + error.message); return; }
    fetchAll();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>お礼額管理</h1>
          <p className="page-header-desc">紹介が利用開始・入金確認されると自動で作成されるお礼額です。支払い月ごとに管理できます。</p>
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

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>パートナー</th>
                <th style={th}>紹介先</th>
                <th style={th}>お礼額</th>
                <th style={th}>支払月</th>
                <th style={th}>状態</th>
                <th style={{ ...th, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton cols={6} rows={5} />
              ) : commissions.length === 0 ? (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }} colSpan={6}>
                  <Coins size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} /><br />
                  お礼額がまだありません。紹介が利用開始・入金確認されると作成されます。
                </td></tr>
              ) : commissions.map(c => {
                const s = statusInfo(c.status);
                const needsAmount = c.amount == null;
                return (
                  <tr key={c.id}>
                    <td style={{ ...td, fontWeight: 700 }}>{c.partners?.name || '—'}</td>
                    <td style={td}>{originName(c)}</td>
                    <td style={td}>
                      {needsAmount ? (
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          <input
                            className="form-input"
                            type="number" min="0"
                            placeholder="金額を入力"
                            value={amountEdits[c.id] ?? ''}
                            onChange={e => setAmountEdits(prev => ({ ...prev, [c.id]: e.target.value }))}
                            style={{ width: '7rem', padding: '0.3rem 0.5rem' }}
                          />
                          <button className="btn btn-primary" onClick={() => handleAmountSave(c)} style={{ padding: '0.3rem 0.55rem' }}><Check size={14} /></button>
                        </div>
                      ) : (
                        <span style={{ fontWeight: 700 }}>{formatCurrency(c.amount)}</span>
                      )}
                    </td>
                    <td style={td}>{c.payment_month ? c.payment_month.replace('-', '年') + '月' : '—'}</td>
                    <td style={td}>
                      <select
                        value={c.status}
                        onChange={e => handleStatusChange(c, e.target.value)}
                        className="status-select"
                        style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.25rem 1.5rem 0.25rem 0.6rem', borderRadius: '9999px', border: 'none', background: s.bg, color: s.color, cursor: 'pointer' }}
                      >
                        {COMM_STATUS.map(o => <option key={o.value} value={o.value} style={{ background: '#fff', color: '#1e293b' }}>{o.label}</option>)}
                      </select>
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {c.status === 'confirmed' && (
                        <button className="btn btn-secondary" onClick={() => handleStatusChange(c, 'paid')} style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}>支払い済みにする</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
