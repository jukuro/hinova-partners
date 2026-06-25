import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { ClipboardList } from 'lucide-react';

const LEAD_STATUS = {
  received: { label: '受付', color: '#2563eb', bg: '#dbeafe' },
  in_progress: { label: '対応中', color: '#d97706', bg: '#ffedd5' },
  started: { label: '利用開始', color: '#059669', bg: '#dcfce7' },
  skipped: { label: '今回は見送り', color: '#64748b', bg: '#e2e8f0' },
};
const DEAL_STATUS = {
  memo: { label: '紹介メモ', color: '#64748b', bg: '#e2e8f0' },
  introduced: { label: '紹介済み', color: '#2563eb', bg: '#dbeafe' },
  hinova_handling: { label: 'Hinova対応中', color: '#0891b2', bg: '#cffafe' },
  considering: { label: '検討中', color: '#7c3aed', bg: '#ede9fe' },
  started: { label: '利用開始', color: '#059669', bg: '#dcfce7' },
  payment_confirmed: { label: '入金確認済み', color: '#047857', bg: '#a7f3d0' },
  skipped: { label: '今回は見送り', color: '#64748b', bg: '#e2e8f0' },
  not_applicable: { label: '対応不要', color: '#94a3b8', bg: '#f1f5f9' },
};

export default function PortalReferrals() {
  const { partner } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partner) return;
    (async () => {
      const [{ data: leads }, { data: deals }] = await Promise.all([
        supabase.from('leads').select('*, products(name)').eq('partner_id', partner.id).order('created_at', { ascending: false }),
        supabase.from('deals').select('*, products(name)').eq('partner_id', partner.id).order('created_at', { ascending: false }),
      ]);
      const merged = [
        ...(leads || []).map(l => ({ ...l, _type: 'lead', _status: LEAD_STATUS[l.status] || LEAD_STATUS.received })),
        ...(deals || []).map(d => ({ ...d, _type: 'deal', _status: DEAL_STATUS[d.status] || DEAL_STATUS.memo })),
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setItems(merged);
      setLoading(false);
    })();
  }, [partner]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>紹介状況</h1>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>読み込み中...</p>
      ) : items.length === 0 ? (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <ClipboardList size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} /><br />
          まだ紹介がありません。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {items.map(it => (
            <div key={`${it._type}-${it.id}`} className="glass-card" style={{ padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{it.customer_name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {it.products?.name || '商材未定'} ・ {new Date(it.created_at).toLocaleDateString('ja-JP')}
                </div>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '9999px', background: it._status.bg, color: it._status.color, whiteSpace: 'nowrap' }}>
                {it._status.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
