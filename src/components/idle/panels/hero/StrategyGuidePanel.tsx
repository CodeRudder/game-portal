/**
 * StrategyGuidePanel — 策略引导面板
 *
 * 显示所有引导阶段的解锁/完成状态，支持折叠展开。
 * 已解锁阶段显示完成状态，未解锁阶段显示解锁条件。
 * 支持重玩已完成的核心引导。
 *
 * 从 GuideOverlay.tsx 拆分而来，解决单文件超过500行的问题。
 *
 * @module components/idle/panels/hero/StrategyGuidePanel
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import { getTutorialSM, saveProgress, getTutorialStepMgr } from './guide-utils';
import './GuideOverlay.css';

// ─────────────────────────────────────────────
// 策略引导阶段解锁阈值配置
// ─────────────────────────────────────────────

/**
 * 从引擎 guide-config.ts 的步骤定义中提取：
 * - 核心引导 6 步（step1~step6）→ 进阶解锁阈值 = 核心步骤总数
 * - 扩展引导 6 步（step7~step12）→ 策略精通解锁阈值 = 扩展步骤开始位置
 * - 全部完成阈值 = 核心步骤数 + 扩展步骤数
 *
 * 如果引擎步骤数量变化，只需修改此处的常量即可。
 */
const STRATEGY_PHASE_THRESHOLDS = {
  /** 核心步骤总数（step1~step6）= 进阶引导解锁阈值 */
  coreStepCount: 6,
  /** 策略精通解锁阈值（扩展引导开始触发） */
  strategyUnlockCount: 10,
  /** 全部完成阈值（核心+扩展步骤总数） */
  totalCompleteCount: 12,
} as const;

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 策略引导阶段定义 */
interface StrategyGuidePhase {
  /** 阶段ID */
  id: string;
  /** 阶段标题 */
  title: string;
  /** 阶段描述 */
  description: string;
  /** 图标 */
  icon: string;
  /** 是否已解锁 */
  isUnlocked: boolean;
  /** 是否已完成 */
  isCompleted: boolean;
}

export interface StrategyGuidePanelProps {
  /** 引擎实例 */
  engine?: ThreeKingdomsEngine | null;
  /** 重玩引导回调 */
  onReplayTutorial?: () => void;
}

// ─────────────────────────────────────────────
// 引导重玩按钮
// ─────────────────────────────────────────────

export interface ReplayButtonProps {
  engine?: ThreeKingdomsEngine | null;
  onReplayTutorial?: () => void;
}

/**
 * 引导重玩按钮 — 可嵌入任意面板（如设置页/策略引导面板）
 *
 * 点击后触发引擎 TutorialStepManager.startReplay 并重新显示 GuideOverlay。
 * 使用方式：父组件维护 guideVisible 状态，将此按钮放在合适位置。
 */
export const GuideReplayButton: React.FC<ReplayButtonProps> = ({
  engine,
  onReplayTutorial,
}) => {
  const handleReplay = useCallback(() => {
    const stepMgr = getTutorialStepMgr(engine);
    if (stepMgr) {
      stepMgr.startReplay('interactive');
    }
    // 清除 localStorage 完成标记
    saveProgress(0, false);
    onReplayTutorial?.();
  }, [engine, onReplayTutorial]);

  return (
    <button
      className="tk-guide-btn tk-guide-btn--replay"
      data-testid="guide-replay-btn"
      onClick={handleReplay}
    >
      🔄 重玩新手引导
    </button>
  );
};

// ─────────────────────────────────────────────
// 策略引导面板主组件
// ─────────────────────────────────────────────

/**
 * StrategyGuidePanel — 策略引导面板
 *
 * 显示所有引导阶段的解锁/完成状态，支持折叠展开。
 * 已解锁阶段显示完成状态，未解锁阶段显示解锁条件。
 * 支持重玩已完成的核心引导。
 */
export const StrategyGuidePanel: React.FC<StrategyGuidePanelProps> = ({
  engine,
  onReplayTutorial,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const tutorialSM = useMemo(() => getTutorialSM(engine), [engine]);

  // 构建引导阶段列表
  const phases = useMemo<StrategyGuidePhase[]>(() => {
    const phase = tutorialSM?.getCurrentPhase();
    const isCompleted = phase === 'free_play' || phase === 'mini_tutorial';
    const completedCount = tutorialSM?.getCompletedStepCount() ?? 0;

    return [
      {
        id: 'core',
        title: '核心引导',
        description: '主城概览、武将招募、编队战斗等基础操作',
        icon: '🎓',
        isUnlocked: true,
        isCompleted,
      },
      {
        id: 'extended',
        title: '进阶引导',
        description: '建筑升级、多次战斗、科技研究等进阶玩法',
        icon: '📖',
        isUnlocked: completedCount >= STRATEGY_PHASE_THRESHOLDS.coreStepCount,
        isCompleted: completedCount >= STRATEGY_PHASE_THRESHOLDS.totalCompleteCount,
      },
      {
        id: 'strategy',
        title: '策略精通',
        description: '联盟加入、顾问建议、科技分支选择等策略玩法',
        icon: '🎯',
        isUnlocked: completedCount >= STRATEGY_PHASE_THRESHOLDS.strategyUnlockCount,
        isCompleted: completedCount >= STRATEGY_PHASE_THRESHOLDS.totalCompleteCount,
      },
    ];
  }, [tutorialSM]);

  const completedPhases = phases.filter(p => p.isCompleted).length;
  const unlockedPhases = phases.filter(p => p.isUnlocked).length;

  return (
    <div className="tk-strategy-guide" data-testid="strategy-guide-panel">
      <button
        className="tk-strategy-guide__header"
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
        aria-controls="strategy-guide-content-region"
        data-testid="strategy-guide-toggle"
      >
        <span className="tk-strategy-guide__header-icon">📋</span>
        <span className="tk-strategy-guide__header-title">策略引导</span>
        <span className="tk-strategy-guide__header-progress">
          {completedPhases}/{phases.length} 已完成
        </span>
        <span className={`tk-strategy-guide__header-arrow ${isExpanded ? 'tk-strategy-guide__header-arrow--expanded' : ''}`}>
          ▸
        </span>
      </button>

      <div
        className={`tk-strategy-guide__content-wrapper ${isExpanded ? 'tk-strategy-guide__content-wrapper--expanded' : ''}`}
        id="strategy-guide-content-region"
        role="region"
        aria-hidden={!isExpanded}
      >
        {isExpanded && (
        <div className="tk-strategy-guide__content" data-testid="strategy-guide-content">
          {/* 总进度 */}
          <div className="tk-strategy-guide__overview">
            <div className="tk-strategy-guide__progress-bar">
              <div
                className="tk-strategy-guide__progress-fill"
                style={{ width: `${phases.length > 0 ? (completedPhases / phases.length) * 100 : 0}%` }}
                role="progressbar"
                aria-valuenow={completedPhases}
                aria-valuemin={0}
                aria-valuemax={phases.length}
              />
            </div>
            <span className="tk-strategy-guide__progress-text">
              已解锁 {unlockedPhases}/{phases.length} · 已完成 {completedPhases}/{phases.length}
            </span>
          </div>

          {/* 阶段列表 */}
          <div className="tk-strategy-guide__phases">
            {phases.map(phase => (
              <div
                key={phase.id}
                className={`tk-strategy-guide__phase ${phase.isCompleted ? 'tk-strategy-guide__phase--completed' : ''} ${!phase.isUnlocked ? 'tk-strategy-guide__phase--locked' : ''}`}
                data-testid={`strategy-guide-phase-${phase.id}`}
              >
                <div className="tk-strategy-guide__phase-icon">
                  {phase.isUnlocked ? phase.icon : '🔒'}
                </div>
                <div className="tk-strategy-guide__phase-info">
                  <div className="tk-strategy-guide__phase-title">
                    {phase.title}
                    {phase.isCompleted && <span className="tk-strategy-guide__phase-badge">✓</span>}
                    {!phase.isUnlocked && <span className="tk-strategy-guide__phase-badge tk-strategy-guide__phase-badge--locked">未解锁</span>}
                  </div>
                  <div className="tk-strategy-guide__phase-desc">{phase.description}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 重玩按钮 */}
          <div className="tk-strategy-guide__actions">
            <GuideReplayButton engine={engine} onReplayTutorial={onReplayTutorial} />
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
