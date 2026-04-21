/**
 * HeroStarUpModal — 武将升星弹窗
 *
 * 功能：
 * - 碎片进度条（当前/所需 + 百分比）
 * - 升星预览（属性变化对比：攻击/防御/智力/速度）
 * - 升星确认按钮（碎片+铜钱消耗）
 * - 突破状态显示（4阶段突破进度）
 * - 碎片来源快捷入口（扫荡/商店/活动）
 *
 * 设计：独立弹窗组件，嵌入 HeroDetailModal 或 HeroTab
 * 引擎依赖：HeroStarSystem
 *
 * @module components/idle/panels/hero/HeroStarUpModal
 */

import React, { useMemo, useCallback, useEffect } from 'react';
import type {
  StarUpPreview,
  FragmentProgress,
  BreakthroughPreview,
  StarUpResult,
  BreakthroughResult,
} from '@/games/three-kingdoms/engine/hero/star-up.types';
import { MAX_STAR_LEVEL } from '@/games/three-kingdoms/engine/hero/star-up-config';
import './HeroStarUpModal.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
export interface HeroStarUpModalProps {
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
  /** 当前突破阶段（0~4） */
  breakthroughStage: number;
  /** 等级上限 */
  levelCap: number;
  /** 金币数量 */
  goldAmount: number;
  /** 突破石数量 */
  breakthroughStoneAmount: number;
  /** 关闭回调 */
  onClose: () => void;
  /** 升星回调 */
  onStarUp: (generalId: string) => StarUpResult;
  /** 突破回调 */
  onBreakthrough: (generalId: string) => BreakthroughResult;
  /** 来源点击回调 */
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
  if (isMax) return 'tk-starup-progress-fill--max';
  if (percentage >= 100) return 'tk-starup-progress-fill--full';
  if (percentage >= 80) return 'tk-starup-progress-fill--high';
  if (percentage >= 50) return 'tk-starup-progress-fill--mid';
  return 'tk-starup-progress-fill--low';
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const HeroStarUpModal: React.FC<HeroStarUpModalProps> = ({
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
  onClose,
  onStarUp,
  onBreakthrough,
  onSourceClick,
}) => {
  // ── ESC 键关闭 ──
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

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
            'tk-starup-star',
            filled ? 'tk-starup-star--filled' : '',
            isMax ? 'tk-starup-star--max' : '',
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
      ? 'tk-starup-fragment-count--max'
      : canStarUp
        ? 'tk-starup-fragment-count--sufficient'
        : 'tk-starup-fragment-count--insufficient';

    return (
      <div className="tk-starup-fragment-section">
        <div className="tk-starup-fragment-header">
          <span className="tk-starup-fragment-label">💎 {generalName} 碎片</span>
          <span className={`tk-starup-fragment-count ${countClass}`}>
            {currentFragments}/{isMaxStar ? '—' : requiredFragments}
          </span>
        </div>
        <div className="tk-starup-progress-bar">
          <div
            className={`tk-starup-progress-fill ${getProgressClass(percentage, isMaxStar)}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className="tk-starup-progress-text">
          {isMaxStar ? '已满星' : `${percentage}%`}
        </div>
        {!isMaxStar && (
          <div className="tk-starup-sources">
            <button className="tk-starup-source-tag" onClick={() => onSourceClick?.('sweep')}>⚔️ 扫荡</button>
            <button className="tk-starup-source-tag" onClick={() => onSourceClick?.('shop')}>🏪 商店</button>
            <button className="tk-starup-source-tag" onClick={() => onSourceClick?.('activity')}>🎉 活动</button>
          </div>
        )}
      </div>
    );
  };

  // ── 渲染升星预览 ──
  const renderStarUpPreview = () => {
    if (!starUpPreview || isMaxStar) return null;
    const { currentStar: from, targetStar, statsDiff } = starUpPreview;
    const statKeys = ['attack', 'defense', 'intelligence', 'speed'] as const;

    return (
      <div className="tk-starup-preview">
        <div className="tk-starup-preview-title">
          ⭐ {from}星 <span className="tk-starup-preview-title-arrow">→</span> {targetStar}星 属性预览
        </div>
        <div className="tk-starup-stats-grid">
          {statKeys.map((key) => {
            const before = statsDiff.before[key] ?? 0;
            const after = statsDiff.after[key] ?? 0;
            const diff = after - before;
            return (
              <div key={key} className="tk-starup-stat-row">
                <span className="tk-starup-stat-name">{STAT_LABELS[key]}</span>
                <div className="tk-starup-stat-values">
                  <span className="tk-starup-stat-before">{before}</span>
                  <span className="tk-starup-stat-arrow">→</span>
                  <span className="tk-starup-stat-after">{after}</span>
                  {diff > 0 && <span className="tk-starup-stat-diff">(+{diff})</span>}
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
      <div className="tk-starup-cost-section">
        <div className="tk-starup-cost-item">
          <span className="tk-starup-cost-icon">💎</span>
          <span className="tk-starup-cost-label">碎片</span>
          <span className={`tk-starup-cost-value ${fragSufficient ? 'tk-starup-cost-value--sufficient' : 'tk-starup-cost-value--insufficient'}`}>
            {starUpPreview.fragmentCost}
          </span>
        </div>
        <div className="tk-starup-cost-item">
          <span className="tk-starup-cost-icon">💰</span>
          <span className="tk-starup-cost-label">铜钱</span>
          <span className={`tk-starup-cost-value ${goldSufficient ? 'tk-starup-cost-value--sufficient' : 'tk-starup-cost-value--insufficient'}`}>
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
        <div className="tk-starup-breakthrough">
          <div className="tk-starup-bt-max">🏆 已达最高突破</div>
        </div>
      );
    }
    if (!breakthroughPreview) return null;

    const { currentLevel, currentLevelCap, nextLevelCap, levelReady,
      fragmentCost, goldCost, breakthroughStoneCost } = breakthroughPreview;

    const fragEnough = fragmentProgress ? fragmentProgress.currentFragments >= fragmentCost : false;
    const goldEnough = goldAmount >= goldCost;
    const stoneEnough = breakthroughStoneAmount >= breakthroughStoneCost;

    return (
      <div className="tk-starup-breakthrough">
        <div className="tk-starup-bt-header">
          <span className="tk-starup-bt-title">🔮 突破</span>
          <span className="tk-starup-bt-stage">第{breakthroughStage + 1}阶 / 4阶</span>
        </div>
        <div className="tk-starup-bt-info">
          <div className="tk-starup-bt-row">
            <span className="tk-starup-bt-row-label">当前等级</span>
            <span className="tk-starup-bt-row-value">{currentLevel}/{currentLevelCap}</span>
          </div>
          <div className="tk-starup-bt-row">
            <span className="tk-starup-bt-row-label">突破后上限</span>
            <span className="tk-starup-bt-row-value tk-starup-bt-row-value--highlight">Lv.{nextLevelCap}</span>
          </div>
          <div className="tk-starup-bt-row">
            <span className="tk-starup-bt-row-label">等级要求</span>
            <span className={`tk-starup-bt-row-value ${levelReady ? 'tk-starup-bt-row-value--highlight' : 'tk-starup-bt-row-value--warning'}`}>
              {levelReady ? '✓ 已满足' : `需达到 Lv.${currentLevelCap}`}
            </span>
          </div>
        </div>
        <div className="tk-starup-bt-costs">
          <span className={`tk-starup-bt-cost-tag ${fragEnough ? 'tk-starup-bt-cost-tag--sufficient' : 'tk-starup-bt-cost-tag--insufficient'}`}>
            💎 {fragmentCost}
          </span>
          <span className={`tk-starup-bt-cost-tag ${goldEnough ? 'tk-starup-bt-cost-tag--sufficient' : 'tk-starup-bt-cost-tag--insufficient'}`}>
            💰 {goldCost.toLocaleString()}
          </span>
          <span className={`tk-starup-bt-cost-tag ${stoneEnough ? 'tk-starup-bt-cost-tag--sufficient' : 'tk-starup-bt-cost-tag--insufficient'}`}>
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
        <div className="tk-starup-maxed">
          ✨ {generalName} 已达最高境界
        </div>
      );
    }
    return (
      <div className="tk-starup-actions">
        {!isMaxStar && (
          <button
            className="tk-starup-btn tk-starup-btn--star-up"
            onClick={handleStarUp}
            disabled={!starUpAffordable}
          >
            ⭐ 升星 ({currentStar}→{currentStar + 1})
          </button>
        )}
        {breakthroughPreview && breakthroughStage < 4 && (
          <button
            className="tk-starup-btn tk-starup-btn--breakthrough"
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
    <div className="tk-starup-overlay" role="dialog" aria-modal="true" aria-label="武将升星" data-testid="starup-modal-overlay">
      <div className="tk-starup-modal">
        {/* 标题栏 */}
        <div className="tk-starup-header">
          <div>
            <span className="tk-starup-title">⭐ {generalName} 升星</span>
            <span className="tk-starup-subtitle">Lv.{level}/{levelCap}</span>
          </div>
          <button className="tk-starup-close" onClick={onClose} aria-label="关闭">✕</button>
        </div>

        {/* 内容区 */}
        <div className="tk-starup-body">
          {/* 星级展示 */}
          <div className="tk-starup-star-display">
            {renderStars()}
            <span className="tk-starup-level">Lv.{level}/{levelCap}</span>
          </div>

          {/* 碎片进度 */}
          {renderFragmentProgress()}

          {/* 升星预览 */}
          {renderStarUpPreview()}

          {/* 升星消耗 */}
          {renderStarUpCost()}

          {/* 突破状态 */}
          {renderBreakthrough()}
        </div>

        {/* 操作按钮 */}
        {renderActions()}
      </div>
    </div>
  );
};

HeroStarUpModal.displayName = 'HeroStarUpModal';

export default HeroStarUpModal;
