/**
 * FormationGrid — 编队网格面板
 *
 * 功能：
 * - 6个武将槽位（3前排 + 3后排）
 * - 每个槽位显示武将头像 + 名字 + 品质
 * - 空槽位显示 "+" 添加按钮
 * - 底部显示编队总战力
 * - 底部显示羁绊摘要
 */

import React, { useMemo } from 'react';
import './FormationGrid.css';

// ─────────────────────────────────────────────
// Props 接口
// ─────────────────────────────────────────────

/** 槽位中的武将数据 */
export interface FormationSlotHero {
  id: string;
  name: string;
  quality: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
}

/** 羁绊摘要项 */
export interface BondSummary {
  id: string;
  name: string;
  isActive: boolean;
  description?: string;
}

export interface FormationGridProps {
  /** 6个槽位数据，null 表示空槽 */
  slots: (FormationSlotHero | null)[];
  /** 编队总战力 */
  totalPower: number;
  /** 羁绊摘要 */
  bonds: BondSummary[];
  /** 点击空槽位的回调 */
  onAddHero?: (slotIndex: number) => void;
  /** 点击已有武将的回调 */
  onRemoveHero?: (slotIndex: number, heroId: string) => void;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 品质色映射 */
const QUALITY_COLORS: Record<string, string> = {
  COMMON: '#9e9e9e',
  UNCOMMON: '#4caf50',
  RARE: '#2196f3',
  EPIC: '#9c27b0',
  LEGENDARY: '#ffc107',
};

/** 前排数量 */
const FRONT_COUNT = 3;

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 格式化战力数值（中文万/亿） */
function formatPower(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}亿`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}

// ─────────────────────────────────────────────
// 槽位组件
// ─────────────────────────────────────────────

interface SlotProps {
  hero: FormationSlotHero | null;
  index: number;
  onAdd?: () => void;
  onRemove?: () => void;
}

const FormationSlot: React.FC<SlotProps> = ({ hero, index, onAdd, onRemove }) => {
  if (!hero) {
    const rowClass = index < FRONT_COUNT ? 'tk-formation-grid-slot--front' : 'tk-formation-grid-slot--back';
    return (
      <button
        className={`tk-formation-grid-slot tk-formation-grid-slot--empty ${rowClass}`}
        onClick={onAdd}
        data-testid={`formation-slot-${index}`}
        aria-label={`槽位${index + 1} 添加武将`}
      >
        <span className="tk-formation-grid-slot-plus">+</span>
        <span className="tk-formation-grid-slot-label">
          {index < FRONT_COUNT ? '前排' : '后排'}
        </span>
      </button>
    );
  }

  const color = QUALITY_COLORS[hero.quality] ?? '#9e9e9e';
  const rowClass = index < FRONT_COUNT ? 'tk-formation-grid-slot--front' : 'tk-formation-grid-slot--back';

  return (
    <div
      className={`tk-formation-grid-slot tk-formation-grid-slot--filled ${rowClass}`}
      style={{ borderColor: color }}
      data-testid={`formation-slot-${index}`}
    >
      <div className="tk-formation-grid-slot-avatar" style={{ background: `${color}33` }}>
        <span className="tk-formation-grid-slot-char">{hero.name.charAt(0)}</span>
      </div>
      <span className="tk-formation-grid-slot-name">{hero.name}</span>
      {onRemove && (
        <button
          className="tk-formation-grid-slot-remove"
          onClick={onRemove}
          aria-label={`移除${hero.name}`}
          data-testid={`formation-slot-remove-${index}`}
        >
          ✕
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const FormationGrid: React.FC<FormationGridProps> = ({
  slots,
  totalPower,
  bonds,
  onAddHero,
  onRemoveHero,
}) => {
  // 确保 slots 为 6 个
  const paddedSlots = useMemo(
    () => {
      const s = [...slots];
      while (s.length < 6) s.push(null);
      return s.slice(0, 6);
    },
    [slots],
  );

  const frontSlots = paddedSlots.slice(0, FRONT_COUNT);
  const backSlots = paddedSlots.slice(FRONT_COUNT);

  // 已激活羁绊
  const activeBonds = bonds.filter((b) => b.isActive);
  // 未激活羁绊
  const inactiveBonds = bonds.filter((b) => !b.isActive);

  return (
    <div className="tk-formation-grid" data-testid="formation-grid">
      {/* ── 阵型标题 ── */}
      <div className="tk-formation-grid-header">
        <span className="tk-formation-grid-title">⚔️ 编队</span>
      </div>

      {/* ── 后排 ── */}
      <div className="tk-formation-grid-row">
        <span className="tk-formation-grid-row-label">后排</span>
        <div className="tk-formation-grid-row-slots">
          {backSlots.map((hero, i) => (
            <FormationSlot
              key={`back-${i}`}
              hero={hero}
              index={FRONT_COUNT + i}
              onAdd={onAddHero ? () => onAddHero(FRONT_COUNT + i) : undefined}
              onRemove={
                hero && onRemoveHero
                  ? () => onRemoveHero(FRONT_COUNT + i, hero.id)
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      {/* ── 前排 ── */}
      <div className="tk-formation-grid-row">
        <span className="tk-formation-grid-row-label">前排</span>
        <div className="tk-formation-grid-row-slots">
          {frontSlots.map((hero, i) => (
            <FormationSlot
              key={`front-${i}`}
              hero={hero}
              index={i}
              onAdd={onAddHero ? () => onAddHero(i) : undefined}
              onRemove={
                hero && onRemoveHero
                  ? () => onRemoveHero(i, hero.id)
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      {/* ── 总战力 ── */}
      <div className="tk-formation-grid-power" data-testid="formation-grid-power">
        <span className="tk-formation-grid-power-label">总战力</span>
        <span className="tk-formation-grid-power-value">{formatPower(totalPower)}</span>
      </div>

      {/* ── 羁绊摘要 ── */}
      {bonds.length > 0 && (
        <div className="tk-formation-grid-bonds" data-testid="formation-grid-bonds">
          <span className="tk-formation-grid-bonds-label">羁绊</span>
          <div className="tk-formation-grid-bonds-list">
            {activeBonds.map((b) => (
              <span
                key={b.id}
                className="tk-formation-grid-bond tk-formation-grid-bond--active"
                data-testid={`formation-bond-${b.id}`}
              >
                🔗 {b.name}
              </span>
            ))}
            {inactiveBonds.map((b) => (
              <span
                key={b.id}
                className="tk-formation-grid-bond tk-formation-grid-bond--inactive"
                data-testid={`formation-bond-${b.id}`}
              >
                🔓 {b.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

FormationGrid.displayName = 'FormationGrid';

export default FormationGrid;
