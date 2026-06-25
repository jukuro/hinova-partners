import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, generateMonths, monthLabel, CHART_AXIS, BRAND } from '../lib/utils';
import { StatCardsSkeleton, ChartSkeleton } from '../components/Skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Send, CheckCircle, Coins, Clock, Users, AlertCircle } from 'lucide-react';

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const isThisMonth = (ts) => ts && ts.slice(0, 7) === thisMonth();

const OPEN_LEAD = ['received', 'in_progress', 'referred'];
const OPEN_DEAL = ['memo', 'introduced', 'hinova_handling', 'considering', 'referred'];
const CONTRACTED = ['contracted', 'started', 'payment_confirmed'];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [deals, setDeals] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [partners, setPartners] = useState([]);
  const partnerCount = useMemo(() => partners.filter(p => p.status === 'active').length, [partners]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: l }, { data: d }, { data: c }, { data: p }] = await Promise.all([
      supabase.from('leads').select('status, created_at, partner_id'),
      supabase.from('deals').select('status, created_at, contracted_at, partner_id, amount'),
      supabase.from('commissions').select('amount, status, payment_month, partner_id'),
      supabase.from('partners').select('id, name, status, partner_ranks(name)'),
    ]);
    setLeads(l || []);
    setDeals(d || []);
    setCommissions(c || []);
    setPartners(p || []);
    setLoading(false);
  }

  const PARTNER_STATUS = {
    reviewing: { label: '審査中', color: '#d97706', bg: '#ffedd5' },
    active: { label: '稼働中', color: '#059669', bg: 'rgba(16,185,129,0.12)' },
    inactive: { label: '停止', color: '#94a3b8', bg: '#f1f5f9' },
  };

  // パートナー別サマリー
  const partnerRows = useMemo(() => partners.map(p => {
    const intro = leads.filter(x => x.partner_id === p.id).length + deals.filter(x => x.partner_id === p.id).length;
    const reward = commissions.filter(c => c.partner_id === p.id && c.status !== 'cancelled').reduce((s, c) => s + Number(c.amount || 0), 0);
    return { ...p, intro, reward };
  }).sort((a, b) => b.reward - a.reward), [partners, leads, deals, commissions]);

  // 全体の決済金額合計（入金確認済みの紹介金額）
  const totalSales = useMemo(() => deals.filter(d => CONTRACTED.includes(d.status)).reduce((s, d) => s + Number(d.amount || 0), 0), [deals]);

  const stats = useMemo(() => {
    const introCount = leads.filter(x => isThisMonth(x.created_at)).length + deals.filter(x => isThisMonth(x.created_at)).length;
    const startedCount =
      leads.filter(x => CONTRACTED.includes(x.status) && isThisMonth(x.created_at)).length +
      deals.filter(x => CONTRACTED.includes(x.status) && isThisMonth(x.created_at)).length;
    const pendingPayout = commissions
      .filter(c => ['pending', 'confirmed'].includes(c.status))
      .reduce((s, c) => s + Number(c.amount || 0), 0);
    const openCount = leads.filter(x => OPEN_LEAD.includes(x.status)).length + deals.filter(x => OPEN_DEAL.includes(x.status)).length;
    const unpaidCount = commissions.filter(c => ['pending', 'confirmed'].includes(c.status)).length;
    return { introCount, startedCount, pendingPayout, openCount, unpaidCount };
  }, [leads, deals, commissions]);

  const chartData = useMemo(() => {
    const byMonth = {};
    commissions.forEach(c => {
      if (c.status === 'cancelled' || !c.payment_month) return;
      byMonth[c.payment_month] = (byMonth[c.payment_month] || 0) + Number(c.amount || 0);
    });
    return generateMonths(6).reverse().map(m => ({ month: monthLabel(m), 予定額: byMonth[m] || 0 }));
  }, [commissions]);

  const cards = [
    { label: '今月の紹介件数', value: `${stats.introCount} 件`, icon: Send, color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
    { label: '今月の契約', value: `${stats.startedCount} 件`, icon: CheckCircle, color: '#059669', bg: 'rgba(5,150,105,0.1)' },
    { label: 'お礼予定額', value: formatCurrency(stats.pendingPayout), icon: Coins, color: '#b88c00', bg: 'rgba(232,184,0,0.12)' },
    { label: '紹介中（契約前）', value: `${stats.openCount} 件`, icon: Clock, color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
    { label: '未払いのお礼', value: `${stats.unpaidCount} 件`, icon: AlertCircle, color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
    { label: '活動中パートナー', value: `${partnerCount} 名`, icon: Users, color: '#0d3d3d', bg: 'rgba(13,61,61,0.1)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>ダッシュボード</h1>
        <p className="page-header-desc">紹介の流れと、パートナーへのお礼の状況を確認できます。</p>
      </div>

      {loading ? (
        <>
          <StatCardsSkeleton />
          <ChartSkeleton />
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {cards.map((c, i) => (
              <div key={i} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ padding: '0.6rem', borderRadius: '0.6rem', background: c.bg, width: 'fit-content' }}>
                  <c.icon size={22} style={{ color: c.color }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.15rem' }}>{c.value}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>お礼予定額の推移（直近6ヶ月）</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>入金確認済みの紹介金額（決済金額）合計：<strong>{formatCurrency(totalSales)}</strong></p>
            <div style={{ height: '18rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS.grid} />
                  <XAxis dataKey="month" stroke={CHART_AXIS.axis} fontSize={12} />
                  <YAxis stroke={CHART_AXIS.axis} fontSize={12} tickFormatter={(v) => `¥${(v / 1000).toLocaleString()}k`} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="予定額" fill={BRAND.gold} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* パートナー別ステータス一覧 */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>パートナー別ステータス</h3>
            {partnerRows.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>パートナーが登録されていません。</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['パートナー', 'ランク', 'ステータス', '紹介数', '累計お礼額'].map((h, i) => (
                        <th key={h} style={{ padding: '0.6rem 0.8rem', textAlign: i >= 3 ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {partnerRows.map(p => {
                      const s = PARTNER_STATUS[p.status] || PARTNER_STATUS.reviewing;
                      return (
                        <tr key={p.id}>
                          <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid var(--border-light)' }}>{p.name}</td>
                          <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.82rem', borderBottom: '1px solid var(--border-light)' }}>{p.partner_ranks?.name || '—'}</td>
                          <td style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--border-light)' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '9999px', background: s.bg, color: s.color }}>{s.label}</span>
                          </td>
                          <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.85rem', textAlign: 'right', borderBottom: '1px solid var(--border-light)' }}>{p.intro} 件</td>
                          <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.85rem', fontWeight: 700, textAlign: 'right', borderBottom: '1px solid var(--border-light)' }}>{formatCurrency(p.reward)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
