import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { FileText, Download } from 'lucide-react';

const CATEGORY_LABEL = {
  intro: 'はじめに', customer_facing: '顧客に見せる資料', partner_guide: 'パートナー向け',
  faq: 'よくある質問', prohibited: '禁止表現', industry: '業種別', url_qr: 'URL・QR',
};

export default function PortalMaterials() {
  const { partner } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partner) return;
    (async () => {
      // パートナーのランク sort_order と担当商材の事業を取得
      const [{ data: rank }, { data: pp }] = await Promise.all([
        partner.rank_id ? supabase.from('partner_ranks').select('sort_order').eq('id', partner.rank_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('partner_products').select('products(business)').eq('partner_id', partner.id),
      ]);
      const myRankSort = rank?.sort_order ?? 0;
      const myBusinesses = new Set((pp || []).map(r => r.products?.business).filter(Boolean));

      const { data } = await supabase.from('materials').select('*').eq('is_public', true).order('created_at', { ascending: false });
      // ランク・商材事業で出し分け
      const visible = (data || []).filter(m => {
        if (m.min_rank_sort != null && myRankSort < m.min_rank_sort) return false;
        if (m.business && myBusinesses.size > 0 && !myBusinesses.has(m.business)) return false;
        return true;
      });
      setMaterials(visible);
      setLoading(false);
    })();
  }, [partner]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>説明資料</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '-0.5rem' }}>紹介の際に使える資料です。お好きなものをダウンロードしてご利用ください。</p>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>読み込み中...</p>
      ) : materials.length === 0 ? (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <FileText size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} /><br />
          閲覧できる資料がまだありません。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {materials.map(m => (
            <a key={m.id} href={m.file_url || '#'} target="_blank" rel="noreferrer"
              className="glass-card"
              style={{ padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{m.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{CATEGORY_LABEL[m.category] || m.category || '資料'}</div>
              </div>
              {m.file_url && <Download size={18} style={{ color: '#0d3d3d', flexShrink: 0 }} />}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
