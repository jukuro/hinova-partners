import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../lib/utils';
import { Send, ClipboardList, Coins, Award } from 'lucide-react';

const isThisMonth = (d) => {
  if (!d) return false;
  const x = new Date(d), n = new Date();
  return x.getFullYear() === n.getFullYear() && x.getMonth() === n.getMonth();
};

export default function PortalHome() {
  const { partner } = useAuth();
  const navigate = useNavigate();
  const [rank, setRank] = useState(null);
  const [leads, setLeads] = useState([]);
  const [deals, setDeals] = useState([]);
  const [commissions, setCommissions] = useState([]);

  useEffect(() => {
    if (!partner) return;
    (async () => {
      const [{ data: rData }, { data: lData }, { data: dData }, { data: cData }] = await Promise.all([
        partner.rank_id ? supabase.from('partner_ranks').select('*').eq('id', partner.rank_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('leads').select('created_at').eq('partner_id', partner.id),
        supabase.from('deals').select('created_at, status').eq('partner_id', partner.id),
        supabase.from('commissions').select('amount, status, payment_month').eq('partner_id', partner.id),
      ]);
      setRank(rData);
      setLeads(lData || []);
      setDeals(dData || []);
      setCommissions(cData || []);
    })();
  }, [partner]);

  const stats = useMemo(() => {
    const introCount = leads.filter(x => isThisMonth(x.created_at)).length + deals.filter(x => isThisMonth(x.created_at)).length;
    const pending = commissions.filter(c => c.status !== 'cancelled' && c.status !== 'paid').reduce((s, c) => s + Number(c.amount || 0), 0);
    return { introCount, pending };
  }, [leads, deals, commissions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ランクカード */}
      <div className="glass-card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #0d3d3d, #1a5c5c)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', opacity: 0.85 }}>
          <Award size={16} /> あなたのランク
        </div>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.35rem' }}>{rank?.name || 'Hinova Partner'}</div>
        {partner?.status === 'reviewing' && (
          <div style={{ fontSize: '0.75rem', marginTop: '0.4rem', background: 'rgba(255,255,255,0.15)', display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: '9999px' }}>
            審査中（承認されると紹介できます）
          </div>
        )}
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>今月の紹介数</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.2rem' }}>{stats.introCount} 件</div>
        </div>
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>お礼予定額</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.2rem' }}>{formatCurrency(stats.pending)}</div>
        </div>
      </div>

      {/* クイック紹介 */}
      <button className="btn btn-primary" onClick={() => navigate('/portal/refer')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem', fontSize: '1rem' }}>
        <Send size={20} /> 知り合いに紹介する
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/portal/referrals')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.85rem' }}>
          <ClipboardList size={18} /> 紹介状況
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/portal/rewards')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.85rem' }}>
          <Coins size={18} /> お礼を見る
        </button>
      </div>
    </div>
  );
}
