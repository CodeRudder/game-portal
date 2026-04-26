/**
 * AchievementPanel — 成就系统面板
 *
 * 功能：
 * - 成就列表按类别分组（收集/战斗/成长/经济）
 * - 每个成就显示：图标+名称+描述+进度条+奖励
 * - 已完成成就金色标记
 * - 可领取奖励的成就有领取按钮
 * - 进度分类筛选（全部/进行中/已完成/已领取）
 */

import React, { useMemo, useState } from 'react';
import './AchievementPanel.css';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 成就类别 */
export type AchievementCategory = 'collection' | 'combat' | 'growth' | 'economy';

/** 成就奖励 */
export interface AchievementReward {
  resource: string;
  amount: number;
}

/** 成就数据 */
export interface Achievement {
  id: string;
  category: AchievementCategory;
  name: string;
  description: string;
  target: number;
  current: number;
  rewards: AchievementReward[];
  isClaimed: boolean;
}

/** 进度筛选类型 */
export type ProgressFilter = 'all' | 'in_progress' | 'completed' | 'claimed';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface AchievementPanelProps {
  /** 成就列表 */
  achievements: Achievement[];
  /** 领取奖励回调 */
  onClaim?: (achievementId: string) => void;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 类别配置 */
const CATEGORY_CONFIG: Record<AchievementCategory, { label: string; icon: string }> = {
  collection: { label: '收集', icon: '📦' },
  combat: { label: '战斗', icon: '⚔️' },
  growth: { label: '成长', icon: '📈' },
  economy: { label: '经济', icon: '💰' },
};

/** 筛选标签 */
const FILTER_LABELS: Record<ProgressFilter, string> = {
  all: '全部',
  in_progress: '进行中',
  completed: '已完成',
  claimed: '已领取',
};

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 获取成就进度状态 */
function getProgressStatus(achievement: Achievement): ProgressFilter {
  if (achievement.isClaimed) return 'claimed';
  if (achievement.current >= achievement.target) return 'completed';
  return 'in_progress';
}

/** 格式化奖励文本 */
function formatRewards(rewards: AchievementReward[]): string {
  return rewards.map(r => `${r.resource} ×${r.amount}`).join('，');
}

// ─────────────────────────────────────────────
// 子组件：单个成就卡片
// ─────────────────────────────────────────────

const AchievementItem: React.FC<{
  achievement: Achievement;
  onClaim?: (id: string) => void;
}> = React.memo(({ achievement, onClaim }) => {
  const progress = Math.min(100, Math.floor((achievement.current / achievement.target) * 100));
  const status = getProgressStatus(achievement);
  const categoryCfg = CATEGORY_CONFIG[achievement.category];
  const isCompleted = status === 'completed';
  const isClaimed = status === 'claimed';

  return (
    <div
      className={`ach-item ${isClaimed ? 'ach-item--claimed' : ''} ${isCompleted ? 'ach-item--completed' : ''}`}
      data-testid={`ach-item-${achievement.id}`}
    >
      {/* 图标与名称 */}
      <div className="ach-item__header">
        <span className="ach-item__icon" data-testid={`ach-icon-${achievement.id}`}>
          {categoryCfg.icon}
        </span>
        <div className="ach-item__info">
          <span className="ach-item__name" data-testid={`ach-name-${achievement.id}`}>
            {achievement.name}
          </span>
          <span className="ach-item__desc" data-testid={`ach-desc-${achievement.id}`}>
            {achievement.description}
          </span>
        </div>
        {/* 状态标记 */}
        {isClaimed && (
          <span className="ach-item__badge ach-item__badge--claimed" data-testid={`ach-badge-claimed-${achievement.id}`}>
            ✅ 已领取
          </span>
        )}
        {isCompleted && !isClaimed && (
          <span className="ach-item__badge ach-item__badge--gold" data-testid={`ach-badge-gold-${achievement.id}`}>
            🏆
          </span>
        )}
      </div>

      {/* 进度条 */}
      <div className="ach-item__progress">
        <div className="ach-progress-bar" data-testid={`ach-progress-bar-${achievement.id}`}>
          <div
            className={`ach-progress-fill ${isClaimed ? 'ach-progress-fill--claimed' : isCompleted ? 'ach-progress-fill--completed' : ''}`}
            style={{ width: `${progress}%` }}
            data-testid={`ach-progress-fill-${achievement.id}`}
          />
        </div>
        <span className="ach-progress-text" data-testid={`ach-progress-text-${achievement.id}`}>
          {achievement.current}/{achievement.target}
        </span>
      </div>

      {/* 奖励 */}
      <div className="ach-item__rewards" data-testid={`ach-rewards-${achievement.id}`}>
        🎁 {formatRewards(achievement.rewards)}
      </div>

      {/* 领取按钮 */}
      {isCompleted && !isClaimed && (
        <button
          className="ach-claim-btn"
          onClick={() => onClaim?.(achievement.id)}
          data-testid={`ach-claim-btn-${achievement.id}`}
        >
          领取奖励
        </button>
      )}
    </div>
  );
});
AchievementItem.displayName = 'AchievementItem';

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const AchievementPanel: React.FC<AchievementPanelProps> = ({
  achievements,
  onClaim,
}) => {
  const [activeFilter, setActiveFilter] = useState<ProgressFilter>('all');

  // ── 按类别分组 ──
  const groupedByCategory = useMemo(() => {
    const groups: Record<AchievementCategory, Achievement[]> = {
      collection: [],
      combat: [],
      growth: [],
      economy: [],
    };
    for (const ach of achievements) {
      groups[ach.category].push(ach);
    }
    return groups;
  }, [achievements]);

  // ── 按进度筛选 ──
  const filteredAchievements = useMemo(() => {
    if (activeFilter === 'all') return achievements;
    return achievements.filter((a) => getProgressStatus(a) === activeFilter);
  }, [achievements, activeFilter]);

  // ── 统计信息 ──
  const stats = useMemo(() => {
    let inProgress = 0;
    let completed = 0;
    let claimed = 0;
    for (const a of achievements) {
      const s = getProgressStatus(a);
      if (s === 'in_progress') inProgress++;
      else if (s === 'completed') completed++;
      else if (s === 'claimed') claimed++;
    }
    return { total: achievements.length, inProgress, completed, claimed };
  }, [achievements]);

  return (
    <div className="ach-panel" data-testid="ach-panel">
      {/* 标题栏 */}
      <div className="ach-panel__header">
        <h3 className="ach-panel__title">🏆 成就系统</h3>
        <span className="ach-panel__stats" data-testid="ach-stats">
          已完成 {stats.claimed}/{stats.total}
        </span>
      </div>

      {/* 进度筛选 */}
      <div className="ach-panel__filters" data-testid="ach-filters">
        {(Object.keys(FILTER_LABELS) as ProgressFilter[]).map((filter) => (
          <button
            key={filter}
            className={`ach-filter-btn ${activeFilter === filter ? 'ach-filter-btn--active' : ''}`}
            onClick={() => setActiveFilter(filter)}
            data-testid={`ach-filter-${filter}`}
          >
            {FILTER_LABELS[filter]}
          </button>
        ))}
      </div>

      {/* 成就列表（按类别分组） */}
      <div className="ach-panel__content">
        {(Object.keys(CATEGORY_CONFIG) as AchievementCategory[]).map((category) => {
          const categoryAchs = groupedByCategory[category].filter((a) => {
            if (activeFilter === 'all') return true;
            return getProgressStatus(a) === activeFilter;
          });
          if (categoryAchs.length === 0) return null;

          const cfg = CATEGORY_CONFIG[category];
          return (
            <div key={category} className="ach-category" data-testid={`ach-category-${category}`}>
              <div className="ach-category__title">
                {cfg.icon} {cfg.label}
              </div>
              {categoryAchs.map((ach) => (
                <AchievementItem key={ach.id} achievement={ach} onClaim={onClaim} />
              ))}
            </div>
          );
        })}
      </div>

      {/* 空状态 */}
      {filteredAchievements.length === 0 && (
        <div className="ach-panel__empty" data-testid="ach-empty">
          暂无匹配的成就
        </div>
      )}
    </div>
  );
};

AchievementPanel.displayName = 'AchievementPanel';
export default AchievementPanel;
