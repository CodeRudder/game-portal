/**
 * StarUpPanel — 升星面板组件
 *
 * 功能：
 * - 当前星级显示（大星星）
 * - 升星预览（下一星级属性加成）
 * - 所需材料列表（碎片+铜钱）
 * - 材料充足/不足状态
 * - 升星按钮（材料不足时禁用）
 * - 升星成功动画（星星点亮效果）
 *
 * @module components/idle/panels/hero/StarUpPanel
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import './StarUpPanel.css';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface StarUpPanelProps {
  /** 武将ID */
  heroId: string;
  /** 武将名字 */
  heroName: string;
  /** 当前星级（1~6） */
  currentStar: number;
  /** 最大星级 */
  maxStar?: number;
  /** 属性数据 */
  stats: {
    attack: number;
    defense: number;
    intelligence: number;
    speed: number;
  };
  /** 升星后属性预览 */
  nextStats: {
    attack: number;
    defense: number;
    intelligence: number;
    speed: number;
  } | null;
  /** 碎片需求 */
  fragmentCost: number;
  /** 当前碎片数量 */
  fragmentOwned: number;
  /** 铜钱需求 */
  goldCost: number;
  /** 当前铜钱数量 */
  goldOwned: number;
  /** 升星回调 */
  onStarUp: (heroId: string) => void;
  /** 是否已满星 */
  isMaxStar?: boolean;
}

/** 属性名映射 */
const STAT_LABELS: Record<string, string> = {
  attack: '攻击',
  defense: '防御',
  intelligence: '智力',
  speed: '速度',
};

const STAT_KEYS = ['attack', 'defense', 'intelligence', 'speed'] as const;

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const StarUpPanel: React.FC<StarUpPanelProps> = ({
  heroId,
  heroName,
  currentStar,
  maxStar = 6,
  stats,
  nextStats,
  fragmentCost,
  fragmentOwned,
  goldCost,
  goldOwned,
  onStarUp,
  isMaxStar = false,
}) => {
  // ── 升星成功动画状态 ──
  const [animating, setAnimating] = useState(false);
  const [animatedStar, setAnimatedStar] = useState(currentStar);

  // 同步星级
  useEffect(() => {
    if (!animating) {
      setAnimatedStar(currentStar);
    }
  }, [currentStar, animating]);

  // ── 材料是否充足 ──
  const fragmentSufficient = useMemo(() => fragmentOwned >= fragmentCost, [fragmentOwned, fragmentCost]);
  const goldSufficient = useMemo(() => goldOwned >= goldCost, [goldOwned, goldCost]);
  const canStarUp = fragmentSufficient && goldSufficient && !isMaxStar;

  // ── 升星操作 ──
  const handleStarUp = useCallback(() => {
    if (!canStarUp) return;
    setAnimating(true);
    // 动画：逐星点亮
    const nextStar = currentStar + 1;
    const timer = setTimeout(() => {
      setAnimatedStar(nextStar);
      setTimeout(() => {
        setAnimating(false);
        onStarUp(heroId);
      }, 400);
    }, 200);
    return () => clearTimeout(timer);
  }, [canStarUp, currentStar, onStarUp, heroId]);

  // ── 渲染星星 ──
  const renderStars = () => {
    const elements: React.ReactNode[] = [];
    for (let i = 1; i <= maxStar; i++) {
      const filled = i <= (animating ? animatedStar : currentStar);
      const isAnimatingStar = animating && i === currentStar + 1;
      elements.push(
        <span
          key={i}
          className={[
            'tk-starup-star',
            filled ? 'tk-starup-star--filled' : 'tk-starup-star--empty',
            isAnimatingStar ? 'tk-starup-star--animating' : '',
          ].filter(Boolean).join(' ')}
          data-testid={`starup-star-${i}`}
        >
          ★
        </span>,
      );
    }
    return elements;
  };

  // ── 渲染属性预览 ──
  const renderStatPreview = () => {
    if (!nextStats || isMaxStar) return null;

    return (
      <div className="tk-starup-preview" data-testid="starup-preview">
        <div className="tk-starup-preview-title">
          ⭐ {currentStar}星 → {currentStar + 1}星 属性预览
        </div>
        <div className="tk-starup-stats">
          {STAT_KEYS.map(key => {
            const before = stats[key];
            const after = nextStats[key];
            const diff = after - before;
            return (
              <div key={key} className="tk-starup-stat-row">
                <span className="tk-starup-stat-name">{STAT_LABELS[key]}</span>
                <span className="tk-starup-stat-before">{before}</span>
                <span className="tk-starup-stat-arrow">→</span>
                <span className="tk-starup-stat-after">{after}</span>
                {diff > 0 && (
                  <span className="tk-starup-stat-diff" data-testid={`stat-diff-${key}`}>
                    (+{diff})
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── 渲染材料列表 ──
  const renderMaterials = () => {
    if (isMaxStar) return null;

    return (
      <div className="tk-starup-materials" data-testid="starup-materials">
        <div className="tk-starup-material-item">
          <span className="tk-starup-material-icon">💎</span>
          <span className="tk-starup-material-label">碎片</span>
          <span
            className={`tk-starup-material-value ${fragmentSufficient ? 'tk-starup-material-value--sufficient' : 'tk-starup-material-value--insufficient'}`}
            data-testid="fragment-status"
          >
            {fragmentOwned}/{fragmentCost}
          </span>
        </div>
        <div className="tk-starup-material-item">
          <span className="tk-starup-material-icon">💰</span>
          <span className="tk-starup-material-label">铜钱</span>
          <span
            className={`tk-starup-material-value ${goldSufficient ? 'tk-starup-material-value--sufficient' : 'tk-starup-material-value--insufficient'}`}
            data-testid="gold-status"
          >
            {goldOwned.toLocaleString()}/{goldCost.toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="tk-starup-panel" role="region" aria-label="武将升星" data-testid="starup-panel">
      {/* 武将名字 */}
      <div className="tk-starup-hero-name" data-testid="starup-hero-name">{heroName}</div>

      {/* 当前星级 */}
      <div className="tk-starup-stars" data-testid="starup-stars">
        {renderStars()}
      </div>

      {/* 属性预览 */}
      {renderStatPreview()}

      {/* 材料列表 */}
      {renderMaterials()}

      {/* 升星按钮 */}
      {isMaxStar ? (
        <div className="tk-starup-maxed" data-testid="starup-maxed">
          ✨ 已达最高星级
        </div>
      ) : (
        <button
          className={`tk-starup-btn ${canStarUp ? 'tk-starup-btn--active' : 'tk-starup-btn--disabled'}`}
          onClick={handleStarUp}
          disabled={!canStarUp}
          data-testid="starup-btn"
        >
          ⭐ 升星 ({currentStar}→{currentStar + 1})
        </button>
      )}
    </div>
  );
};

StarUpPanel.displayName = 'StarUpPanel';

export default StarUpPanel;
