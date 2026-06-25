import { supabase } from './supabase';

// ============================================================
// 報酬率の解決と計算（月額 × 報酬率）
//
// 適用報酬率の優先順位：
//  ① パートナー個別 × 商材個別の報酬率（partner_commission_rules.custom_rate）
//  ② 商材の基本報酬率 + パートナーランクの加算率（status='active' のときのみ加算）
//  ③ 加算なし → 基本報酬率のみ（②で加算0と同義）
// ============================================================

// 報酬率を解決する。partner / product の現在値から適用率を求める。
export async function resolveRewardRate(partnerId, productId) {
  // ① 個別報酬率
  if (partnerId && productId) {
    const { data: custom } = await supabase
      .from('partner_commission_rules')
      .select('custom_rate')
      .eq('partner_id', partnerId)
      .eq('product_id', productId)
      .maybeSingle();
    if (custom && custom.custom_rate != null) {
      return { rate: Number(custom.custom_rate), resolved_by: 'custom', custom_rate: Number(custom.custom_rate), rank_addition: 0 };
    }
  }

  // ② 基本報酬率 + ランク加算率
  const [{ data: partner }, { data: product }] = await Promise.all([
    supabase.from('partners').select('status, partner_ranks(rate_addition, name)').eq('id', partnerId).maybeSingle(),
    supabase.from('products').select('base_reward_rate, max_reward_rate').eq('id', productId).maybeSingle(),
  ]);

  const base = product?.base_reward_rate != null ? Number(product.base_reward_rate) : 0;
  const rank = partner?.partner_ranks;
  // 稼働中のパートナーのみランク加算を適用（審査中・停止中は基本率のみ）
  const addition = partner?.status === 'active' ? Number(rank?.rate_addition ?? 0) : 0;

  const rate = base + addition;
  const max = product?.max_reward_rate != null ? Number(product.max_reward_rate) : null;
  const applied = max != null ? Math.min(rate, max) : rate;

  return {
    rate: applied,
    resolved_by: addition > 0 ? 'rank' : 'base',
    base_rate: base,
    rank_name: rank?.name ?? null,
    rank_addition: addition,
    capped: max != null && rate > max,
  };
}

// 端数処理
export function applyRounding(amount, rule = 'floor_10') {
  if (amount == null || isNaN(amount)) return null;
  if (rule === 'floor_10')  return Math.floor(amount / 10) * 10;
  if (rule === 'floor_100') return Math.floor(amount / 100) * 100;
  if (rule === 'round')     return Math.round(amount);
  return amount;
}

export const ROUNDING_LABEL = {
  floor_10: '10円切り捨て',
  floor_100: '100円切り捨て',
  round: '四捨五入',
};

// 報酬金額を計算（決済金額 × 率 → 端数処理）
export function calcReward(paymentAmount, rate, roundingRule = 'floor_10') {
  if (paymentAmount == null || rate == null) return { raw: null, final: null };
  const raw = Number(paymentAmount) * (Number(rate) / 100);
  return { raw, final: applyRounding(raw, roundingRule) };
}

// 契約成立時に報酬率を確定して deal にスナップショット保存（契約日ロック）
// 以降の毎月の報酬計算は、この率を使い再解決しない。
export async function lockRewardRateForDeal(deal, contractDate) {
  const resolved = await resolveRewardRate(deal.partner_id, deal.product_id);
  const basis = { ...resolved, locked_at: contractDate || new Date().toISOString().slice(0, 10) };
  await supabase.from('deals').update({
    locked_reward_rate: resolved.rate,
    locked_rate_basis: basis,
  }).eq('id', deal.id);
  return { rate: resolved.rate, basis };
}

// 報酬を確定して履歴（commissions）に保存。
// 率は deal にロック済みのものを使う。未ロックの場合はその場で解決してロックする。
export async function recordReward({ deal, product, paymentAmount, paymentMonth }) {
  let rate = deal.locked_reward_rate;
  let basis = deal.locked_rate_basis;
  if (rate == null) {
    const locked = await lockRewardRateForDeal(deal, deal.contracted_at);
    rate = locked.rate;
    basis = locked.basis;
  }
  const rule = product?.rounding_rule || 'floor_10';
  const amount = paymentAmount != null ? Number(paymentAmount)
    : (product?.unit_price != null ? Number(product.unit_price) : null);
  const { raw, final } = calcReward(amount, rate, rule);

  const svcName = product?.services?.name;
  const productLabel = product ? [svcName, product.name].filter(Boolean).join(' ') : null;
  const { error } = await supabase.from('commissions').insert([{
    deal_id: deal.id,
    partner_id: deal.partner_id,
    product_id: deal.product_id || null,
    product_name: productLabel,
    customer_name: deal.customer_name || null,
    payment_amount: amount,
    applied_rate: rate,
    amount: final,
    calculation_basis: { ...(basis || {}), rounding_rule: rule, raw_amount: raw, final_amount: final },
    payment_month: paymentMonth || currentPaymentMonth(),
    status: 'pending',
  }]);
  return { error, amount: final, rate };
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
