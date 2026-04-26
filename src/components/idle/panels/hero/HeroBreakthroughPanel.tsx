/**
 * HeroBreakthroughPanel — 武将突破面板
 *
 * 功能：
 * - 显示武将当前突破阶段（0/4）
 * - 显示突破路线：从引擎配置动态读取（50→60→70→80→100）
 * - 显示每次突破所需材料（碎片+铜钱+突破石）
 * - 突破按钮（材料足够时可点击）
 * - 突破后等级上限变化提示
 * - 突破进度可视化（4个节点，当前节点高亮）
 *
 * @module components/idle/panels/hero/HeroBreakthroughPanel
 */

import React, { useMemo } from 'react';
import {
  BREAKTHROUGH_TIERS,
  INITIAL_LEVEL_CAP,
  MAX_BREAKTHROUGH_STAGE,
} from '@/games/three-kingdoms/engine/hero/star-up-config';
import './HeroBreakthroughPanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface HeroBreakthroughPanelProps {
  /** 武将ID */
  heroId: string;
  /** 当前突破阶段 0-4 */
  currentBreakthrough: number;
  /** 当前等级上限 */
  levelCap: number;
  /** 所需材料 */
  materials: {
    fragments: number;
    copper: number;
    breakthroughStones: number;
  };
  /** 突破回调 */
  onBreakthrough: (heroId: string) => void;
}

// ─────────────────────────────────────────────
// 从引擎配置派生的常量（不再硬编码）
// ─────────────────────────────────────────────

/** 突破路线：每阶段对应的等级上限（初始 + 各阶突破后） */
const BREAKTHROUGH_LEVEL_CAPS: readonly number[] = [
  INITIAL_LEVEL_CAP,
  ...BREAKTHROUGH_TIERS.map((t) => t.levelCapAfter),
];

/** 每阶段所需材料（从引擎配置读取） */
const BREAKTHROUGH_COSTS: readonly { fragments: number; copper: number; breakthroughStones: number }[] =
  BREAKTHROUGH_TIERS.map((t) => ({
    fragments: t.fragmentCost,
    copper: t.goldCost,
    breakthroughStones: t.breakthroughStoneCost,
  }));

/** 阶段标签：与 BREAKTHROUGH_LEVEL_CAPS 的 5 个节点对应 */
const STAGE_LABELS = ['初始', '一阶', '二阶', '三阶', '四阶'];

// ─────────────────────────────────────────────
// 子组件：突破路线节点
// ─────────────────────────────────────────────

interface BreakthroughNodeProps {
  index: number;
  isCompleted: boolean;
  isCurrent: boolean;
  isLocked: boolean;
  levelCap: number;
}

const BreakthroughNode: React.FC<BreakthroughNodeProps> = React.memo(({
  index,
  isCompleted,
  isCurrent,
  isLocked,
  levelCap,
}) => {
  const nodeClass = [
    'tk-bt-node',
    isCompleted && 'tk-bt-node--completed',
    isCurrent && 'tk-bt-node--current',
    isLocked && 'tk-bt-node--locked',
  ].filter(Boolean).join(' ');

  return (
    <div className={nodeClass}>
      <div className="tk-bt-node__dot">
        {isCompleted ? '✓' : isCurrent ? '★' : (index + 1)}
      </div>
      <div className="tk-bt-node__label">{STAGE_LABELS[index]}</div>
      <div className="tk-bt-node__cap">Lv.{levelCap}</div>
    </div>
  );
});
BreakthroughNode.displayName = 'BreakthroughNode';

// ─────────────────────────────────────────────
// 子组件：材料需求项
// ─────────────────────────────────────────────

interface MaterialItemProps {
  icon: string;
  label: string;
  required: number;
  owned: number;
}

const MaterialItem: React.FC<MaterialItemProps> = React.memo(({
  icon, label, required, owned,
}) => {
  const sufficient = owned >= required;
  return (
    <div className={`tk-bt-material ${sufficient ? 'tk-bt-material--sufficient' : 'tk-bt-material--insufficient'}`}>
      <span className="tk-bt-material__icon">{icon}</span>
      <span className="tk-bt-material__label">{label}</span>
      <span className="tk-bt-material__count">
        <span className={sufficient ? 'tk-bt-material__owned--ok' : 'tk-bt-material__owned--lack'}>
          {owned}
        </span>
        {' / '}
        {required}
      </span>
    </div>
  );
});
MaterialItem.displayName = 'MaterialItem';

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const HeroBreakthroughPanel: React.FC<HeroBreakthroughPanelProps> = ({
  heroId,
  currentBreakthrough,
  levelCap,
  materials,
  onBreakthrough,
}) => {
  /** 是否已满突 */
  const isMaxBreakthrough = currentBreakthrough >= MAX_BREAKTHROUGH_STAGE;

  /** 当前阶段所需材料 */
  const currentCost = useMemo(() => {
    if (isMaxBreakthrough) return null;
    return BREAKTHROUGH_COSTS[currentBreakthrough];
  }, [currentBreakthrough, isMaxBreakthrough]);

  /** 材料是否充足 */
  const materialsSufficient = useMemo(() => {
    if (!currentCost) return false;
    return (
      materials.fragments >= currentCost.fragments
      && materials.copper >= currentCost.copper
      && materials.breakthroughStones >= currentCost.breakthroughStones
    );
  }, [currentCost, materials]);

  /** 下一阶段等级上限 */
  const nextLevelCap = isMaxBreakthrough ? null : BREAKTHROUGH_LEVEL_CAPS[currentBreakthrough + 1];

  /** 突破按钮点击 */
  const handleBreakthrough = React.useCallback(() => {
    if (materialsSufficient && !isMaxBreakthrough) {
      onBreakthrough(heroId);
    }
  }, [materialsSufficient, isMaxBreakthrough, onBreakthrough, heroId]);

  return (
    <div className="tk-bt-panel" data-testid="breakthrough-panel">
      {/* ── 标题 ── */}
      <div className="tk-bt-header">
        <h3 className="tk-bt-title">武将突破</h3>
        <span className="tk-bt-stage" data-testid="breakthrough-stage">
          {isMaxBreakthrough ? '已满突' : `${currentBreakthrough} / 4`}
        </span>
      </div>

      {/* ── 突破路线可视化 ── */}
      <div className="tk-bt-roadmap" data-testid="breakthrough-roadmap">
        {BREAKTHROUGH_LEVEL_CAPS.map((cap, i) => {
          const isCompleted = i < currentBreakthrough;
          const isCurrent = i === currentBreakthrough;
          const isLocked = i > currentBreakthrough;

          return (
            <React.Fragment key={i}>
              <BreakthroughNode
                index={i}
                isCompleted={isCompleted}
                isCurrent={isCurrent}
                isLocked={isLocked}
                levelCap={cap}
              />
              {i < BREAKTHROUGH_LEVEL_CAPS.length - 1 && (
                <div
                  className={`tk-bt-connector ${i < currentBreakthrough ? 'tk-bt-connector--completed' : ''}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── 当前等级上限 ── */}
      <div className="tk-bt-level-cap" data-testid="breakthrough-level-cap">
        <span className="tk-bt-level-cap__label">当前等级上限</span>
        <span className="tk-bt-level-cap__value">Lv.{levelCap}</span>
        {!isMaxBreakthrough && nextLevelCap && (
          <span className="tk-bt-level-cap__next" data-testid="breakthrough-next-cap">
            → Lv.{nextLevelCap}
          </span>
        )}
      </div>

      {/* ── 材料需求 ── */}
      {!isMaxBreakthrough && currentCost && (
        <div className="tk-bt-materials" data-testid="breakthrough-materials">
          <div className="tk-bt-materials__title">突破所需材料</div>
          <MaterialItem
            icon="💎"
            label="碎片"
            required={currentCost.fragments}
            owned={materials.fragments}
          />
          <MaterialItem
            icon="🪙"
            label="铜钱"
            required={currentCost.copper}
            owned={materials.copper}
          />
          <MaterialItem
            icon="🔮"
            label="突破石"
            required={currentCost.breakthroughStones}
            owned={materials.breakthroughStones}
          />
        </div>
      )}

      {/* ── 满突提示 ── */}
      {isMaxBreakthrough && (
        <div className="tk-bt-max-hint" data-testid="breakthrough-max-hint">
          已达最高突破阶段，等级上限 Lv.{BREAKTHROUGH_LEVEL_CAPS[BREAKTHROUGH_LEVEL_CAPS.length - 1]}
        </div>
      )}

      {/* ── 突破按钮 ── */}
      {!isMaxBreakthrough && (
        <button
          className={`tk-bt-btn ${materialsSufficient ? 'tk-bt-btn--active' : 'tk-bt-btn--disabled'}`}
          disabled={!materialsSufficient}
          onClick={handleBreakthrough}
          data-testid="breakthrough-btn"
        >
          {materialsSufficient ? '立即突破' : '材料不足'}
        </button>
      )}
    </div>
  );
};

HeroBreakthroughPanel.displayName = 'HeroBreakthroughPanel';
export default HeroBreakthroughPanel;
