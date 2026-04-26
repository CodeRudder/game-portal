/**
 * StarDisplay — 星级显示原子组件
 *
 * 显示武将星级（0~6星），使用实心星 ★（已激活）+ 空心星 ☆（未激活）。
 * 纯 CSS 实现，金色 #F59E0B。
 *
 * 尺寸模式：
 *   - small  → 12px 星星
 *   - normal → 16px 星星
 *   - large  → 20px 星星
 */
import React, { useMemo } from 'react';
import './StarDisplay.css';

// ─────────────────────────────────────────────
// Props 接口
// ─────────────────────────────────────────────
export interface StarDisplayProps {
  /** 当前星级 0~6 */
  stars: number;
  /** 最大星级，默认 6 */
  maxStars?: number;
  /** 尺寸模式：small(12px) / normal(16px) / large(20px) */
  size?: 'small' | 'normal' | 'large';
  /** 自定义类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const StarDisplay: React.FC<StarDisplayProps> = ({
  stars,
  maxStars = 6,
  size = 'normal',
  className = '',
}) => {
  // 将星级限制在 [0, maxStars] 范围内
  const clampedStars = Math.max(0, Math.min(stars, maxStars));

  // 生成星星数组
  const starItems = useMemo(() => {
    const items: { index: number; filled: boolean }[] = [];
    for (let i = 0; i < maxStars; i++) {
      items.push({ index: i, filled: i < clampedStars });
    }
    return items;
  }, [clampedStars, maxStars]);

  const rootClass = [
    'tk-star-display',
    `tk-star-display--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={rootClass}
      role="img"
      aria-label={`${clampedStars}星`}
      data-testid={`star-display-${clampedStars}`}
    >
      {starItems.map(({ index, filled }) => (
        <span
          key={index}
          className={`tk-star-display__star ${filled ? 'tk-star-display__star--filled' : 'tk-star-display__star--empty'}`}
          aria-hidden="true"
        >
          {filled ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
};

export default StarDisplay;
