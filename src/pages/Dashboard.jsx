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

const OPEN_LEAD = ['received'];
const OPEN_DEAL = ['memo', 'introduced', 'hinova_handling', 'considering'];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [deals, setDeals] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [partnerCount, setPartnerCount] = useState(0);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: l }, { data: d }, { data: c }, { count }] = await Promise.all([
      supabase.from('leads').select('status, created_at'),
      supabase.from('deals').select('status, created_at, contracted_at'),
      supabase.from('commissions').select('amount, status, payment_month'),
      supabase.from('partners').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    setLeads(l || []);
    setDeals(d || []);
    setCommissions(c || []);
    setPartnerCount(count || 0);
    setLoading(false);
  }

  const stats = useMemo(() => {
    const introCount = leads.filter(x => isThisMonth(x.created_at)).length + deals.filter(x => isThisMonth(x.created_at)).length;
    const startedCount =
      leads.filter(x => x.status === 'started' && isThisMonth(x.created_at)).length +
      deals.filter(x => ['started', 'payment_confirmed'].includes(x.status) && isThisMonth(x.created_at)).length;
    const pendingPayout = commissions
      .filter(c => ['pending', 'confirmed'].includes(c.status))
      .reduce((s, c) => s + Number(c.amount || 0), 0);
    const openCount = leads.filter(x => OPEN_LEAD.includes(x.status)).length + deals.filter(x => OPEN_DEAL.includes(x.status)).length;
    const awaitingPayment = deals.filter(x => x.status === 'started').length;
    return { introCount, startedCount, pendingPayout, openCount, awaitingPayment };
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
    { label: '今月の利用開始', value: `${stats.startedCount} 件`, icon: CheckCircle, color: '#059669', bg: 'rgba(5,150,105,0.1)' },
    { label: 'お礼予定額', value: formatCurrency(stats.pendingPayout), icon: Coins, color: '#b88c00', bg: 'rgba(232,184,0,0.12)' },
    { label: '未対応の紹介', value: `${stats.openCount} 件`, icon: Clock, color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
    { label: '入金確認待ち', value: `${stats.awaitingPayment} 件`, icon: AlertCircle, color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
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
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>お礼予定額の推移（直近6ヶ月）</h3>
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
        </>
      )}
    </div>
  );
}
