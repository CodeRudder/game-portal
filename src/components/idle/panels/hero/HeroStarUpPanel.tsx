/**
 * HeroStarUpPanel — 武将升星面板
 *
 * 功能：
 * - 当前星级展示（1~6星）
 * - 碎片进度条（含百分比+来源提示）
 * - 升星预览（属性提升对比）
 * - 升星按钮 + 消耗显示（碎片+铜钱）
 * - 突破状态 + 突破按钮
 *
 * 嵌入位置：武将详情弹窗的"碎片/升星"Tab
 * 引擎依赖：HeroStarSystem
 *
 * @module components/idle/panels/hero/HeroStarUpPanel
 */

import React, { useMemo, useCallback } from 'react';
import type {
  StarUpPreview,
  FragmentProgress,
  BreakthroughPreview,
  StarUpResult,
  BreakthroughResult,
} from '@/games/three-kingdoms/engine/hero/star-up.types';
import { MAX_STAR_LEVEL } from '@/games/three-kingdoms/engine/hero/star-up-config';
import './HeroStarUpPanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
export interface HeroStarUpPanelProps {
  /** 武将ID */
  generalId: string;
  /** 武将名称 */
  generalName: string;
  /** 当前等级 */
  level: number;
  /** 当前星级 */
  currentStar: number;
  /** 碎片进度 */
  fragmentProgress: FragmentProgress | null;
  /** 升星预览 */
  starUpPreview: StarUpPreview | null;
  /** 突破预览 */
  breakthroughPreview: BreakthroughPreview | null;
  /** 当前突破阶段 */
  breakthroughStage: number;
  /** 等级上限 */
  levelCap: number;
  /** 金币数量 */
  goldAmount: number;
  /** 突破石数量 */
  breakthroughStoneAmount: number;
  /** 升星回调 */
  onStarUp: (generalId: string) => StarUpResult;
  /** 突破回调 */
  onBreakthrough: (generalId: string) => BreakthroughResult;
  /** 来源点击回调（扫荡/商店/活动） */
  onSourceClick?: (source: string) => void;
}

// ─────────────────────────────────────────────
// 属性名映射
// ─────────────────────────────────────────────
const STAT_LABELS: Record<string, string> = {
  attack: '攻击',
  defense: '防御',
  intelligence: '智力',
  speed: '速度',
};

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 获取进度条样式类名 */
function getProgressClass(percentage: number, isMax: boolean): string {
  if (isMax) return 'tk-star-progress-fill--max';
  if (percentage >= 100) return 'tk-star-progress-fill--full';
  if (percentage >= 80) return 'tk-star-progress-fill--high';
  if (percentage >= 50) return 'tk-star-progress-fill--mid';
  return 'tk-star-progress-fill--low';
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const HeroStarUpPanel: React.FC<HeroStarUpPanelProps> = ({
  generalId,
  generalName,
  level,
  currentStar,
  fragmentProgress,
  starUpPreview,
  breakthroughPreview,
  breakthroughStage,
  levelCap,
  goldAmount,
  breakthroughStoneAmount,
  onStarUp,
  onBreakthrough,
  onSourceClick,
}) => {
  const isMaxStar = currentStar >= MAX_STAR_LEVEL;

  // ── 升星消耗是否充足 ──
  const starUpAffordable = useMemo(() => {
    if (!starUpPreview) return false;
    return starUpPreview.fragmentSufficient && goldAmount >= starUpPreview.goldCost;
  }, [starUpPreview, goldAmount]);

  // ── 突破消耗是否充足 ──
  const btAffordable = useMemo(() => {
    if (!breakthroughPreview) return false;
    return breakthroughPreview.canBreakthrough;
  }, [breakthroughPreview]);

  // ── 事件处理 ──
  const handleStarUp = useCallback(() => {
    onStarUp(generalId);
  }, [onStarUp, generalId]);

  const handleBreakthrough = useCallback(() => {
    onBreakthrough(generalId);
  }, [onBreakthrough, generalId]);

  // ── 渲染星级 ──
  const renderStars = () => {
    const elements: React.ReactNode[] = [];
    for (let i = 1; i <= MAX_STAR_LEVEL; i++) {
      const filled = i <= currentStar;
      const isMax = isMaxStar && filled;
      elements.push(
        <span
          key={i}
          className={[
            'tk-star-display-star',
            filled ? 'tk-star-display-star--filled' : 'tk-star-display-star--empty',
            isMax ? 'tk-star-display-star--max' : '',
          ].filter(Boolean).join(' ')}
        >
          ★
        </span>,
      );
    }
    return elements;
  };

  // ── 渲染碎片进度 ──
  const renderFragmentProgress = () => {
    if (!fragmentProgress) return null;

    const { currentFragments, requiredFragments, percentage, canStarUp } = fragmentProgress;
    const countClass = isMaxStar
      ? 'tk-star-fragment-count--max'
      : canStarUp
        ? 'tk-star-fragment-count--sufficient'
        : 'tk-star-fragment-count--insufficient';

    return (
      <div className="tk-star-fragment-section">
        <div className="tk-star-fragment-header">
          <span className="tk-star-fragment-label">💎 {generalName} 碎片</span>
          <span className={`tk-star-fragment-count ${countClass}`}>
            {currentFragments}/{isMaxStar ? '—' : requiredFragments}
          </span>
        </div>
        <div className="tk-star-progress-bar">
          <div
            className={`tk-star-progress-fill ${getProgressClass(percentage, isMaxStar)}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className="tk-star-progress-text">
          {isMaxStar ? '已满星' : `${percentage}%`}
        </div>
        {!isMaxStar && (
          <div className="tk-star-fragment-sources">
            <button className="tk-star-source-tag" onClick={() => onSourceClick?.('sweep')}>
              ⚔️ 扫荡
            </button>
            <button className="tk-star-source-tag" onClick={() => onSourceClick?.('shop')}>
              🏪 商店
            </button>
            <button className="tk-star-source-tag" onClick={() => onSourceClick?.('activity')}>
              🎉 活动
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── 渲染升星预览 ──
  const renderStarUpPreview = () => {
    if (!starUpPreview || isMaxStar) return null;

    const { statsDiff, currentStar: from, targetStar } = starUpPreview;
    const statEntries: Array<{ key: string; label: string; before: number; after: number }> = [
      { key: 'attack', label: STAT_LABELS.attack, before: statsDiff.before.attack, after: statsDiff.after.attack },
      { key: 'defense', label: STAT_LABELS.defense, before: statsDiff.before.defense, after: statsDiff.after.defense },
      { key: 'intelligence', label: STAT_LABELS.intelligence, before: statsDiff.before.intelligence, after: statsDiff.after.intelligence },
      { key: 'speed', label: STAT_LABELS.speed, before: statsDiff.before.speed, after: statsDiff.after.speed },
    ];

    return (
      <div className="tk-star-preview">
        <div className="tk-star-preview-title">
          ⭐ {from}星 <span className="tk-star-preview-title-arrow">→</span> {targetStar}星 属性预览
        </div>
        <div className="tk-star-stats-grid">
          {statEntries.map(({ key, label, before, after }) => {
            const diff = after - before;
            return (
              <div key={key} className="tk-star-stat-row">
                <span className="tk-star-stat-name">{label}</span>
                <div className="tk-star-stat-values">
                  <span className="tk-star-stat-before">{before}</span>
                  <span className="tk-star-stat-arrow">→</span>
                  <span className="tk-star-stat-after">{after}</span>
                  {diff > 0 && <span className="tk-star-stat-diff">(+{diff})</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── 渲染升星消耗 ──
  const renderStarUpCost = () => {
    if (!starUpPreview || isMaxStar) return null;

    const fragSufficient = starUpPreview.fragmentSufficient;
    const goldSufficient = goldAmount >= starUpPreview.goldCost;

    return (
      <div className="tk-star-cost-section">
        <div className="tk-star-cost-item">
          <span className="tk-star-cost-icon">💎</span>
          <span className="tk-star-cost-label">碎片</span>
          <span className={`tk-star-cost-value ${fragSufficient ? 'tk-star-cost-value--sufficient' : 'tk-star-cost-value--insufficient'}`}>
            {starUpPreview.fragmentCost}
          </span>
        </div>
        <div className="tk-star-cost-item">
          <span className="tk-star-cost-icon">💰</span>
          <span className="tk-star-cost-label">铜钱</span>
          <span className={`tk-star-cost-value ${goldSufficient ? 'tk-star-cost-value--sufficient' : 'tk-star-cost-value--insufficient'}`}>
            {starUpPreview.goldCost.toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  // ── 渲染突破状态 ──
  const renderBreakthrough = () => {
    if (breakthroughStage >= 4 && !breakthroughPreview) {
      return (
        <div className="tk-star-breakthrough">
          <div className="tk-star-bt-max">🏆 已达最高突破</div>
        </div>
      );
    }

    if (!breakthroughPreview) return null;

    const { currentLevel, currentLevelCap, nextLevelCap, levelReady, resourceSufficient,
      fragmentCost, goldCost, breakthroughStoneCost } = breakthroughPreview;

    const fragEnough = fragmentProgress
      ? fragmentProgress.currentFragments >= fragmentCost
      : false;
    const goldEnough = goldAmount >= goldCost;
    const stoneEnough = breakthroughStoneAmount >= breakthroughStoneCost;

    return (
      <div className="tk-star-breakthrough">
        <div className="tk-star-bt-header">
          <span className="tk-star-bt-title">🔮 突破</span>
          <span className="tk-star-bt-stage">
            第{breakthroughStage + 1}阶 / 4阶
          </span>
        </div>

        <div className="tk-star-bt-info">
          <div className="tk-star-bt-row">
            <span className="tk-star-bt-row-label">当前等级</span>
            <span className="tk-star-bt-row-value">{currentLevel} / {currentLevelCap}</span>
          </div>
          <div className="tk-star-bt-row">
            <span className="tk-star-bt-row-label">突破后上限</span>
            <span className="tk-star-bt-row-value tk-star-bt-row-value--highlight">
              Lv.{nextLevelCap}
            </span>
          </div>
          <div className="tk-star-bt-row">
            <span className="tk-star-bt-row-label">等级要求</span>
            <span className={`tk-star-bt-row-value ${levelReady ? 'tk-star-bt-row-value--highlight' : 'tk-star-bt-row-value--warning'}`}>
              {levelReady ? '✓ 已满足' : `需达到 Lv.${currentLevelCap}`}
            </span>
          </div>
        </div>

        <div className="tk-star-bt-costs">
          <span className={`tk-star-bt-cost-tag ${fragEnough ? 'tk-star-bt-cost-tag--sufficient' : 'tk-star-bt-cost-tag--insufficient'}`}>
            💎 {fragmentCost}
          </span>
          <span className={`tk-star-bt-cost-tag ${goldEnough ? 'tk-star-bt-cost-tag--sufficient' : 'tk-star-bt-cost-tag--insufficient'}`}>
            💰 {goldCost.toLocaleString()}
          </span>
          <span className={`tk-star-bt-cost-tag ${stoneEnough ? 'tk-star-bt-cost-tag--sufficient' : 'tk-star-bt-cost-tag--insufficient'}`}>
            🔮 {breakthroughStoneCost}
          </span>
        </div>
      </div>
    );
  };

  // ── 渲染操作按钮 ──
  const renderActions = () => {
    if (isMaxStar && breakthroughStage >= 4) {
      return (
        <div className="tk-star-maxed-notice">
          ✨ {generalName} 已达最高境界
        </div>
      );
    }

    return (
      <div className="tk-star-actions">
        {!isMaxStar && (
          <button
            className="tk-star-btn tk-star-btn--star-up"
            onClick={handleStarUp}
            disabled={!starUpAffordable}
          >
            ⭐ 升星 ({currentStar}→{currentStar + 1})
          </button>
        )}
        {breakthroughPreview && breakthroughStage < 4 && (
          <button
            className="tk-star-btn tk-star-btn--breakthrough"
            onClick={handleBreakthrough}
            disabled={!btAffordable}
          >
            🔮 突破
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="tk-star-panel" role="region" aria-label="武将升星">
      {/* ── 星级展示 ── */}
      <div className="tk-star-display">
        {renderStars()}
        <span className="tk-star-display-level">Lv.{level}/{levelCap}</span>
      </div>

      {/* ── 碎片进度 ── */}
      {renderFragmentProgress()}

      {/* ── 升星预览 ── */}
      {renderStarUpPreview()}

      {/* ── 升星消耗 ── */}
      {renderStarUpCost()}

      {/* ── 突破状态 ── */}
      {renderBreakthrough()}

      {/* ── 操作按钮 ── */}
      {renderActions()}
    </div>
  );
};

HeroStarUpPanel.displayName = 'HeroStarUpPanel';

export default HeroStarUpPanel;
