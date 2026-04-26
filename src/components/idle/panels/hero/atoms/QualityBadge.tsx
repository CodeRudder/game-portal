/**
 * QualityBadge — 品质标签原子组件
 *
 * 显示武将品质标签（COMMON / FINE / RARE / EPIC / LEGENDARY）。
 * 品质色通过 CSS 变量 --hero-quality-* 控制，便于全局换肤。
 *
 * 尺寸模式：
 *   - small  → 标签模式，12px 字号，紧凑内边距
 *   - normal → 徽章模式，14px 字号，标准内边距
 *
 * 注意：禁止闪烁/渐变动画，保持纯静态展示。
 */
import React from 'react';
import './QualityBadge.css';

// ─────────────────────────────────────────────
// Props 接口
// ─────────────────────────────────────────────
export interface QualityBadgeProps {
  /** 武将品质等级 */
  quality: 'COMMON' | 'FINE' | 'RARE' | 'EPIC' | 'LEGENDARY';
  /** 尺寸模式：small=标签 12px / normal=徽章 14px */
  size?: 'small' | 'normal';
  /** 自定义类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 品质中文名映射
// ─────────────────────────────────────────────
const QUALITY_TEXT: Record<QualityBadgeProps['quality'], string> = {
  COMMON: '普通',
  FINE: '精良',
  RARE: '稀有',
  EPIC: '史诗',
  LEGENDARY: '传说',
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const QualityBadge: React.FC<QualityBadgeProps> = ({
  quality,
  size = 'normal',
  className = '',
}) => {
  const rootClass = [
    'tk-quality-badge',
    `tk-quality-badge--${quality.toLowerCase()}`,
    `tk-quality-badge--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={rootClass}
      data-testid={`quality-badge-${quality.toLowerCase()}`}
    >
      {QUALITY_TEXT[quality]}
    </span>
  );
};

export default QualityBadge;
