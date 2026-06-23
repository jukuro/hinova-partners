import React from 'react';

// ─── 基本スケルトンブロック ────────────────────────────────────────
export function SkeletonBlock({ width = '100%', height = '1rem', rounded = 'md', className = '' }) {
  const radiusMap = { sm: '0.375rem', md: '0.5rem', lg: '1rem', full: '9999px' };
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{ width, height, borderRadius: radiusMap[rounded] ?? rounded, flexShrink: 0 }}
    />
  );
}

// ─── ダッシュボード用：統計カード4枚 ─────────────────────────────────
export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass-card p-6 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <SkeletonBlock width="2.75rem" height="2.75rem" rounded="lg" />
            <SkeletonBlock width="5rem" height="1.25rem" rounded="full" />
          </div>
          <div className="flex flex-col gap-2">
            <SkeletonBlock width="60%" height="0.875rem" />
            <SkeletonBlock width="80%" height="2rem" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ダッシュボード用：グラフカード ──────────────────────────────────
export function ChartSkeleton({ height = '18rem' }) {
  return (
    <div className="glass-card p-6">
      <SkeletonBlock width="40%" height="1.125rem" className="mb-6" />
      <div style={{ height }} className="flex items-end gap-2 px-2">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="flex-1 flex flex-col gap-1 justify-end">
            <SkeletonBlock
              width="100%"
              height={`${30 + Math.sin(i) * 20 + Math.random() * 30}%`}
              rounded="sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── テーブル用：行スケルトン ─────────────────────────────────────────
export function TableRowSkeleton({ cols = 6, rows = 5 }) {
  return (
    <>
      {[...Array(rows)].map((_, i) => (
        <tr key={i}>
          {[...Array(cols)].map((_, j) => (
            <td key={j} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <SkeletonBlock
                width={j === 0 ? '5rem' : j === cols - 1 ? '4rem' : `${50 + Math.random() * 40}%`}
                height="0.875rem"
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── カードリスト用：アクティビティ行 ────────────────────────────────
export function ActivitySkeleton({ rows = 5 }) {
  return (
    <div className="flex flex-col gap-4">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4 items-start p-3">
          <SkeletonBlock width="2rem" height="2rem" rounded="full" />
          <div className="flex-1 flex flex-col gap-2">
            <SkeletonBlock width="70%" height="0.875rem" />
            <SkeletonBlock width="40%" height="0.75rem" />
          </div>
          <SkeletonBlock width="4rem" height="0.875rem" />
        </div>
      ))}
    </div>
  );
}
