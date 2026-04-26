/**
 * AttributeBar — 属性条原子组件
 *
 * 显示单个属性（攻击/防御/生命/速度）的名称、数值、进度条。
 * 支持显示变化值（如 +15），正数绿色、负数红色。
 *
 * 内置颜色映射：
 *   - 攻击 → 红色  #EF4444
 *   - 防御 → 蓝色  #3B82F6
 *   - 生命 → 绿色  #22C55E
 *   - 速度 → 黄色  #EAB308
 * 可通过 color prop 自定义覆盖。
 */
import React, { useMemo } from 'react';
import './AttributeBar.css';

// ─────────────────────────────────────────────
// Props 接口
// ─────────────────────────────────────────────
export interface AttributeBarProps {
  /** 属性名（如 "攻击"、"防御"） */
  name: string;
  /** 当前值 */
  value: number;
  /** 最大值（用于进度条百分比计算，默认取 value 自身） */
  maxValue?: number;
  /** 变化值（正数显示绿色 +N，负数显示红色 -N） */
  change?: number;
  /** 自定义进度条颜色，覆盖内置颜色映射 */
  color?: string;
  /** 自定义类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 属性名 → 默认颜色映射
// ─────────────────────────────────────────────
const ATTRIBUTE_COLORS: Record<string, string> = {
  攻击: '#EF4444',
  攻击力: '#EF4444',
  ATK: '#EF4444',
  atk: '#EF4444',
  防御: '#3B82F6',
  防御力: '#3B82F6',
  DEF: '#3B82F6',
  def: '#3B82F6',
  生命: '#22C55E',
  生命值: '#22C55E',
  HP: '#22C55E',
  hp: '#22C55E',
  速度: '#EAB308',
  SPD: '#EAB308',
  spd: '#EAB308',
};

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 格式化数值（千位以上用 k 表示） */
function formatAttributeValue(n: number): string {
  if (Math.abs(n) >= 10000) {
    return `${(n / 10000).toFixed(1)}万`;
  }
  return String(n);
}

/** 格式化变化值 */
function formatChange(n: number): string {
  if (n > 0) return `+${formatAttributeValue(n)}`;
  return formatAttributeValue(n);
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const AttributeBar: React.FC<AttributeBarProps> = ({
  name,
  value,
  maxValue,
  change,
  color,
  className = '',
}) => {
  // 确定进度条颜色：优先使用 prop，其次使用属性名映射，最后用默认金色
  const barColor = color ?? ATTRIBUTE_COLORS[name] ?? 'var(--tk-gold, #C9A84C)';

  // 计算进度百分比
  const percent = useMemo(() => {
    const max = maxValue ?? value;
    if (max <= 0) return 0;
    return Math.min(100, Math.max(0, (value / max) * 100));
  }, [value, maxValue]);

  const rootClass = [
    'tk-attr-bar',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} data-testid={`attr-bar-${name}`}>
      {/* 属性名 + 数值行 */}
      <div className="tk-attr-bar__header">
        <span className="tk-attr-bar__name">{name}</span>
        <span className="tk-attr-bar__values">
          <span className="tk-attr-bar__value">{formatAttributeValue(value)}</span>
          {change !== undefined && change !== 0 && (
            <span
              className={`tk-attr-bar__change ${change > 0 ? 'tk-attr-bar__change--positive' : 'tk-attr-bar__change--negative'}`}
            >
              {formatChange(change)}
            </span>
          )}
        </span>
      </div>

      {/* 进度条 */}
      <div className="tk-attr-bar__track">
        <div
          className="tk-attr-bar__fill"
          style={{
            width: `${percent}%`,
            backgroundColor: barColor,
          }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={maxValue ?? value}
          aria-label={`${name}进度`}
        />
      </div>
    </div>
  );
};

export default AttributeBar;
