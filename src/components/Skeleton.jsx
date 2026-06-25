import React from 'react';

const CHART_SKELETON_HEIGHTS = [42, 58, 35, 72, 50, 64, 46, 80, 55, 68, 38, 60];
const TABLE_SKELETON_WIDTHS = [72, 58, 84, 66, 76, 52];

// 隨渉隨渉隨渉 陜難ｽｺ隴幢ｽｬ郢ｧ・ｹ郢ｧ・ｱ郢晢ｽｫ郢晏現ﾎｦ郢晄じﾎ溽ｹ昴・縺・隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉
export function SkeletonBlock({ width = '100%', height = '1rem', rounded = 'md', className = '' }) {
  const radiusMap = { sm: '0.375rem', md: '0.5rem', lg: '1rem', full: '9999px' };
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{ width, height, borderRadius: radiusMap[rounded] ?? rounded, flexShrink: 0 }}
    />
  );
}

// 隨渉隨渉隨渉 郢敖郢昴・縺咏ｹ晢ｽ･郢晄㈱繝ｻ郢晁・逡代・螟ゑｽｵ・ｱ髫ｪ蛹ｻ縺咲ｹ晢ｽｼ郢昴・隴ｫ繝ｻ隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉
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

// 隨渉隨渉隨渉 郢敖郢昴・縺咏ｹ晢ｽ･郢晄㈱繝ｻ郢晁・逡代・螢ｹ縺堤ｹ晢ｽｩ郢晁ｼ斐″郢晢ｽｼ郢昴・隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉
export function ChartSkeleton({ height = '18rem' }) {
  return (
    <div className="glass-card p-6">
      <SkeletonBlock width="40%" height="1.125rem" className="mb-6" />
      <div style={{ height }} className="flex items-end gap-2 px-2">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="flex-1 flex flex-col gap-1 justify-end">
            <SkeletonBlock
              width="100%"
              height={`${CHART_SKELETON_HEIGHTS[i % CHART_SKELETON_HEIGHTS.length]}%`}
              rounded="sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// 隨渉隨渉隨渉 郢昴・繝ｻ郢晄じﾎ晞包ｽｨ繝ｻ螟奇ｽ｡蠕後○郢ｧ・ｱ郢晢ｽｫ郢晏現ﾎｦ 隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉
export function TableRowSkeleton({ cols = 6, rows = 5 }) {
  return (
    <>
      {[...Array(rows)].map((_, i) => (
        <tr key={i}>
          {[...Array(cols)].map((_, j) => (
            <td key={j} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <SkeletonBlock
                width={j === 0 ? '5rem' : j === cols - 1 ? '4rem' : `${TABLE_SKELETON_WIDTHS[(i + j) % TABLE_SKELETON_WIDTHS.length]}%`}
                height="0.875rem"
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// 隨渉隨渉隨渉 郢ｧ・ｫ郢晢ｽｼ郢晏ｳｨﾎ懃ｹｧ・ｹ郢晁ご逡代・螢ｹ縺・ｹｧ・ｯ郢昴・縺・ｹ晁侭繝ｦ郢ｧ・｣髯ｦ繝ｻ隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉
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
