import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../lib/utils';
import { Coins } from 'lucide-react';

const STATUS = {
  pending: { label: '未払い', color: '#d97706', bg: '#ffedd5' },
  paid: { label: '支払済み', color: '#059669', bg: '#dcfce7' },
  cancelled: { label: '取消', color: '#64748b', bg: '#e2e8f0' },
};
const sInfo = (v) => STATUS[v] || STATUS.pending;

export default function PortalRewards() {
  const { partner } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partner) return;
    (async () => {
      const { data } = await supabase.from('commissions').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false });
      setRows(data || []);
      setLoading(false);
    })();
  }, [partner]);

  const total = useMemo(() => rows.filter(r => r.status !== 'cancelled' && r.status !== 'paid').reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>お礼</h1>

      <div className="glass-card" style={{ padding: '1.1rem 1.25rem' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>未払いのお礼予定額</div>
        <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: '0.2rem' }}>{formatCurrency(total)}</div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>読み込み中...</p>
      ) : rows.length === 0 ? (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Coins size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} /><br />
          まだお礼の記録がありません。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {rows.map(c => {
            const s = sInfo(c.status);
            return (
              <div key={c.id} className="glass-card" style={{ padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{c.product_name || '—'}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {c.customer_name || '—'} ・ {c.payment_month ? c.payment_month.replace('-', '年') + '月' : '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 800 }}>{c.amount != null ? formatCurrency(c.amount) : '—'}</div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '9999px', background: s.bg, color: s.color }}>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
