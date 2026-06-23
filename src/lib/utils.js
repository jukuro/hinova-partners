export const CHART_COLORS = [
  '#e8b800', '#0d3d3d', '#2dd4bf', '#d4a600',
  '#14b8a6', '#0f766e', '#f59e0b', '#64748b',
];

export const BRAND = {
  gold: '#e8b800',
  teal: '#0d3d3d',
  accent: '#2dd4bf',
  expense: '#e11d48', // 経費（支出）用のセマンティックレッド（旧ピンク#ec4899を置換）
};

// グラフ共通の軸・グリッド色（ライトテーマ準拠で全画面統一）
export const CHART_AXIS = {
  grid: '#e2e8f0',  // slate-200
  axis: '#94a3b8',  // slate-400
};

export function generateMonths(count = 12) {
  const months = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

export function formatCurrency(value) {
  return `¥${Number(value || 0).toLocaleString()}`;
}

export function monthLabel(yyyyMM) {
  return yyyyMM.replace('-', '年') + '月';
}
