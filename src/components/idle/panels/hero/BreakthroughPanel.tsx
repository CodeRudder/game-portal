/**
 * BreakthroughPanel — 突破面板（增强版）
 *
 * 功能：
 * - 突破路径可视化（4个节点：30→40→50→60→70）
 * - 当前突破阶段高亮（节点点亮动画）
 * - 每个节点显示：等级上限、所需材料（突破石+铜钱+碎片）
 * - 突破按钮（材料不足时禁用）
 * - 突破后属性加成预览
 * - 突破动画效果（节点点亮，不使用明暗变化）
 *
 * @module components/idle/panels/hero/BreakthroughPanel
 */

import React, { useState, useCallback, useMemo } from 'react';
import './BreakthroughPanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

/** 材料持有量 */
export interface MaterialInventory {
  fragments: number;
  copper: number;
  breakthroughStones: number;
}

/** 属性加成 */
export interface StatBonus {
  atk: number;
  hp: number;
  def: number;
}

/** 突破阶段配置 */
export interface BreakthroughStage {
  /** 等级上限 */
  levelCap: number;
  /** 所需材料 */
  cost: { fragments: number; copper: number; breakthroughStones: number };
  /** 突破后属性加成 */
  bonus: StatBonus;
}

export interface BreakthroughPanelProps {
  /** 武将ID */
  heroId: string;
  /** 当前突破阶段 0-4 */
  currentStage: number;
  /** 当前等级上限 */
  levelCap: number;
  /** 材料持有量 */
  materials: MaterialInventory;
  /** 突破回调 */
  onBreakthrough: (heroId: string) => void;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 突破路线配置 */
const STAGES: BreakthroughStage[] = [
  { levelCap: 30, cost: { fragments: 20, copper: 5000, breakthroughStones: 5 }, bonus: { atk: 50, hp: 200, def: 30 } },
  { levelCap: 40, cost: { fragments: 40, copper: 12000, breakthroughStones: 10 }, bonus: { atk: 120, hp: 500, def: 60 } },
  { levelCap: 50, cost: { fragments: 80, copper: 25000, breakthroughStones: 20 }, bonus: { atk: 250, hp: 1000, def: 120 } },
  { levelCap: 60, cost: { fragments: 150, copper: 50000, breakthroughStones: 40 }, bonus: { atk: 500, hp: 2000, def: 250 } },
  { levelCap: 70, cost: { fragments: 0, copper: 0, breakthroughStones: 0 }, bonus: { atk: 0, hp: 0, def: 0 } },
];

const STAGE_LABELS = ['一阶', '二阶', '三阶', '四阶', '满阶'];

// ─────────────────────────────────────────────
// 子组件：突破节点
// ─────────────────────────────────────────────

interface NodeProps {
  stage: BreakthroughStage;
  index: number;
  isCompleted: boolean;
  isCurrent: boolean;
  isLocked: boolean;
  isAnimating: boolean;
}

const BreakthroughNode: React.FC<NodeProps> = React.memo(({
  stage, index, isCompleted, isCurrent, isLocked, isAnimating,
}) => {
  const cls = [
    'bp-node',
    isCompleted && 'bp-node--completed',
    isCurrent && 'bp-node--current',
    isLocked && 'bp-node--locked',
    isAnimating && 'bp-node--animating',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} data-testid={`bp-node-${index}`}>
      <div className="bp-node__dot">
        {isCompleted ? '✓' : isCurrent ? '★' : (index + 1)}
      </div>
      <div className="bp-node__label">{STAGE_LABELS[index]}</div>
      <div className="bp-node__cap">Lv.{stage.levelCap}</div>
      {!isLocked && (
        <div className="bp-node__materials">
          {index < 4 && (
            <>
              <span className="bp-node__mat">💎{stage.cost.fragments}</span>
              <span className="bp-node__mat">🪙{stage.cost.copper}</span>
              <span className="bp-node__mat">🔮{stage.cost.breakthroughStones}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
});
BreakthroughNode.displayName = 'BreakthroughNode';

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const BreakthroughPanel: React.FC<BreakthroughPanelProps> = ({
  heroId,
  currentStage,
  levelCap,
  materials,
  onBreakthrough,
}) => {
  const [animating, setAnimating] = useState(false);
  const isMaxed = currentStage >= 4;

  /** 当前阶段材料需求 */
  const currentCost = useMemo(() => {
    if (isMaxed) return null;
    return STAGES[currentStage].cost;
  }, [currentStage, isMaxed]);

  /** 材料是否充足 */
  const sufficient = useMemo(() => {
    if (!currentCost) return false;
    return (
      materials.fragments >= currentCost.fragments
      && materials.copper >= currentCost.copper
      && materials.breakthroughStones >= currentCost.breakthroughStones
    );
  }, [currentCost, materials]);

  /** 下一阶段属性加成预览 */
  const nextBonus = useMemo(() => {
    if (isMaxed || currentStage >= 4) return null;
    return STAGES[currentStage].bonus;
  }, [currentStage, isMaxed]);

  /** 突破操作 */
  const handleBreakthrough = useCallback(() => {
    if (!sufficient || isMaxed) return;
    setAnimating(true);
    // 播放动画后触发回调
    setTimeout(() => {
      setAnimating(false);
      onBreakthrough(heroId);
    }, 600);
  }, [sufficient, isMaxed, onBreakthrough, heroId]);

  return (
    <div className="bp-panel" data-testid="breakthrough-panel">
      {/* 标题 */}
      <div className="bp-header">
        <h3 className="bp-title">突破面板</h3>
        <span className="bp-stage" data-testid="bp-stage">
          {isMaxed ? '已满突' : `${currentStage} / 4`}
        </span>
      </div>

      {/* 突破路线 */}
      <div className="bp-roadmap" data-testid="bp-roadmap">
        {STAGES.slice(0, 4).map((stage, i) => (
          <React.Fragment key={i}>
            <BreakthroughNode
              stage={stage}
              index={i}
              isCompleted={i < currentStage}
              isCurrent={i === currentStage}
              isLocked={i > currentStage}
              isAnimating={animating && i === currentStage}
            />
            {i < 3 && (
              <div
                className={`bp-connector ${i < currentStage ? 'bp-connector--completed' : ''}`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* 当前等级上限 */}
      <div className="bp-level-cap" data-testid="bp-level-cap">
        <span className="bp-level-cap__label">当前等级上限</span>
        <span className="bp-level-cap__value">Lv.{levelCap}</span>
        {!isMaxed && currentStage < 4 && (
          <span className="bp-level-cap__next" data-testid="bp-next-cap">
            → Lv.{STAGES[currentStage].levelCap}
          </span>
        )}
      </div>

      {/* 材料需求 */}
      {!isMaxed && currentCost && (
        <div className="bp-materials" data-testid="bp-materials">
          <div className="bp-materials__title">突破所需材料</div>
          <div className="bp-mat-item">
            <span>💎 碎片</span>
            <span className={materials.fragments >= currentCost.fragments ? 'bp-mat--ok' : 'bp-mat--lack'}>
              {materials.fragments} / {currentCost.fragments}
            </span>
          </div>
          <div className="bp-mat-item">
            <span>🪙 铜钱</span>
            <span className={materials.copper >= currentCost.copper ? 'bp-mat--ok' : 'bp-mat--lack'}>
              {materials.copper} / {currentCost.copper}
            </span>
          </div>
          <div className="bp-mat-item">
            <span>🔮 突破石</span>
            <span className={materials.breakthroughStones >= currentCost.breakthroughStones ? 'bp-mat--ok' : 'bp-mat--lack'}>
              {materials.breakthroughStones} / {currentCost.breakthroughStones}
            </span>
          </div>
        </div>
      )}

      {/* 属性加成预览 */}
      {nextBonus && !isMaxed && (
        <div className="bp-bonus" data-testid="bp-bonus-preview">
          <div className="bp-bonus__title">突破后属性加成</div>
          <div className="bp-bonus__stats">
            <span className="bp-bonus__stat">⚔️ 攻击 +{nextBonus.atk}</span>
            <span className="bp-bonus__stat">❤️ 生命 +{nextBonus.hp}</span>
            <span className="bp-bonus__stat">🛡️ 防御 +{nextBonus.def}</span>
          </div>
        </div>
      )}

      {/* 满突提示 */}
      {isMaxed && (
        <div className="bp-max-hint" data-testid="bp-max-hint">
          已达最高突破阶段，等级上限 Lv.70
        </div>
      )}

      {/* 突破按钮 */}
      {!isMaxed && (
        <button
          className={`bp-btn ${sufficient ? 'bp-btn--active' : 'bp-btn--disabled'} ${animating ? 'bp-btn--animating' : ''}`}
          disabled={!sufficient || animating}
          onClick={handleBreakthrough}
          data-testid="bp-btn"
        >
          {animating ? '突破中...' : sufficient ? '立即突破' : '材料不足'}
        </button>
      )}
    </div>
  );
};

BreakthroughPanel.displayName = 'BreakthroughPanel';
export default BreakthroughPanel;
