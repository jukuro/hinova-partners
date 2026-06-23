import { supabase } from './supabase';

// パートナー×商材のお礼ルールを解決して金額を計算する。
// 優先順位: partner_commission_rules → products標準 → 未設定(null)
// dealAmount は rate（売上率）計算に使用。
export async function resolveCommissionAmount(partnerId, productId, dealAmount) {
  let rule = null;

  if (partnerId && productId) {
    const { data } = await supabase
      .from('partner_commission_rules')
      .select('commission_type, commission_value')
      .eq('partner_id', partnerId)
      .eq('product_id', productId)
      .maybeSingle();
    if (data && data.commission_value != null) rule = data;
  }

  if (!rule && productId) {
    const { data } = await supabase
      .from('products')
      .select('commission_type, commission_value')
      .eq('id', productId)
      .maybeSingle();
    if (data) rule = data;
  }

  if (!rule || rule.commission_value == null) {
    return { amount: null, commission_type: rule?.commission_type || null };
  }

  let amount = null;
  if (rule.commission_type === 'fixed') {
    amount = Number(rule.commission_value);
  } else if (rule.commission_type === 'rate') {
    amount = dealAmount ? (Number(dealAmount) * Number(rule.commission_value)) / 100 : null;
  } else if (rule.commission_type === 'recurring') {
    amount = Number(rule.commission_value);
  }
  return { amount, commission_type: rule.commission_type };
}

// 月末締め翌月払い → 締め月の翌月を支払月（YYYY-MM）として返す
export function currentPaymentMonth(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 紹介コード生成（紛らわしい 0/O/1/I を除外）
export function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'HNP' + Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
