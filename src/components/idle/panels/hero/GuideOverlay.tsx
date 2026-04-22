/**
 * GuideOverlay - Step-by-step tutorial overlay
 *
 * 对接引擎 TutorialStateMachine：
 * - 有 engine 时通过 TutorialStateMachine 读取/推进引导状态
 * - 无 engine 时回退到 localStorage（兼容旧逻辑）
 *
 * @module components/idle/panels/hero/GuideOverlay
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import { TutorialStateMachine } from '@/games/three-kingdoms/engine';
import type { TutorialPhase } from '@/games/three-kingdoms/core/guide';
import './GuideOverlay.css';

export interface GuideStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const DEFAULT_STEPS: GuideStep[] = [
  {
    id: 'recruit',
    title: '🎮 Welcome!',
    description: 'Click the recruit button to recruit your first hero!',
    targetSelector: '.tk-hero-recruit-btn',
    position: 'bottom',
  },
  {
    id: 'detail',
    title: '📋 View Hero Details',
    description: 'Click a hero card to view detailed stats, skills and power.',
    targetSelector: '.tk-hero-card',
    position: 'right',
  },
  {
    id: 'enhance',
    title: '✅ Enhance Heroes',
    description: 'Spend gold to level up your heroes and increase their power!',
    targetSelector: '.tk-hero-detail-enhance-btn',
    position: 'top',
  },
  {
    id: 'formation',
    title: '⚔️ Form Teams',
    description: 'Create formations and assign heroes to build the strongest team!',
    targetSelector: '.tk-formation-panel',
    position: 'top',
  },
];

const GUIDE_KEY = 'tk-guide-progress';

// ─────────────────────────────────────────────
// 引擎 TutorialStateMachine 适配
// ─────────────────────────────────────────────

/**
 * 尝试从引擎获取 TutorialStateMachine 实例
 *
 * 引擎可能尚未注册 tutorial-state 子系统（如旧存档），
 * 此函数安全地返回 null 而不抛异常。
 */
function getTutorialSM(engine?: ThreeKingdomsEngine | null): TutorialStateMachine | null {
  if (!engine) return null;
  try {
    // ThreeKingdomsEngine 没有直接的 getTutorialStateMachine 方法，
    // 但通过 registry 可以获取已注册的子系统
    const registry = (engine as any).registry;
    if (!registry) return null;
    const sm = registry.get('tutorial-state') as TutorialStateMachine | undefined;
    // TutorialStateMachine.name === 'tutorial-state'
    return sm && typeof sm.getCurrentPhase === 'function' ? sm : null;
  } catch {
    return null;
  }
}

/**
 * 从引擎状态机判断引导是否已完成
 */
function isEngineTutorialCompleted(sm: TutorialStateMachine | null): boolean {
  if (!sm) return false;
  const phase = sm.getCurrentPhase();
  // free_play 或 mini_tutorial 表示核心引导已完成
  return phase === 'free_play' || phase === 'mini_tutorial';
}

/**
 * 从引擎状态机推断当前应显示的步骤索引
 *
 * 映射关系：core_guiding 阶段根据 completedSteps 数量推算步骤索引。
 */
function getEngineStepIndex(sm: TutorialStateMachine | null, totalSteps: number): number {
  if (!sm) return 0;
  const phase = sm.getCurrentPhase();
  if (phase === 'not_started') return 0;
  if (phase === 'free_explore' || phase === 'free_play' || phase === 'mini_tutorial') return -1;
  // core_guiding: 根据 completedSteps 推算
  const count = sm.getCompletedStepCount();
  return Math.min(count, totalSteps - 1);
}

// ─────────────────────────────────────────────
// localStorage 回退（引擎不可用时）
// ─────────────────────────────────────────────

function loadProgress(): number {
  try {
    const raw = localStorage.getItem(GUIDE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.completed) return -1;
      return typeof data.step === 'number' ? data.step : 0;
    }
  } catch { /* ignore */ }
  return 0;
}

function saveProgress(step: number, completed: boolean): void {
  try {
    localStorage.setItem(GUIDE_KEY, JSON.stringify({ step, completed }));
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface GuideOverlayProps {
  steps?: GuideStep[];
  /** 引擎实例，用于对接 TutorialStateMachine */
  engine?: ThreeKingdomsEngine | null;
  onComplete?: () => void;
  onSkip?: () => void;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

const GuideOverlay: React.FC<GuideOverlayProps> = ({
  steps = DEFAULT_STEPS,
  engine,
  onComplete,
  onSkip,
}) => {
  // 获取引擎 TutorialStateMachine（可能为 null）
  const tutorialSM = useMemo(() => getTutorialSM(engine), [engine]);

  // 初始化步骤索引：优先引擎，回退 localStorage
  const [currentStep, setCurrentStep] = useState<number>(() => {
    if (tutorialSM) {
      return getEngineStepIndex(tutorialSM, steps.length);
    }
    return loadProgress();
  });
  const [visible, setVisible] = useState(true);

  if (currentStep < 0 || steps.length === 0 || !visible) return null;

  const step = steps[currentStep];
  if (!step) return null;

  const isLastStep = currentStep >= steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      // 完成引导：通知引擎 + 回退存储
      if (tutorialSM) {
        // 如果还在 core_guiding，推进到 free_explore → free_play
        const phase = tutorialSM.getCurrentPhase();
        if (phase === 'core_guiding') {
          tutorialSM.transition('step6_complete');
          tutorialSM.transition('explore_done');
        } else if (phase === 'not_started') {
          tutorialSM.transition('first_enter');
          tutorialSM.transition('step6_complete');
          tutorialSM.transition('explore_done');
        }
      }
      saveProgress(currentStep, true);
      setVisible(false);
      onComplete?.();
    } else {
      const next = currentStep + 1;
      // 通知引擎步骤完成
      if (tutorialSM) {
        const phase = tutorialSM.getCurrentPhase();
        if (phase === 'not_started') {
          tutorialSM.transition('first_enter');
        }
        // 将 overlay 步骤映射到引擎步骤 ID（近似映射）
        const engineStepIds = [
          'step3_recruit_hero' as const,
          'step1_castle_overview' as const,
          'step3_recruit_hero' as const,
          'step4_first_battle' as const,
        ];
        const stepId = engineStepIds[currentStep];
        if (stepId) {
          tutorialSM.completeStep(stepId);
        }
      }
      setCurrentStep(next);
      saveProgress(next, false);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      saveProgress(prev, false);
    }
  };

  const handleSkip = () => {
    // 跳过引导：通知引擎加速跳过 + 回退存储
    if (tutorialSM) {
      const phase = tutorialSM.getCurrentPhase();
      if (phase === 'not_started') {
        tutorialSM.transition('first_enter');
      }
      if (tutorialSM.getCurrentPhase() === 'core_guiding') {
        tutorialSM.transition('skip_to_explore');
        tutorialSM.transition('explore_done');
      }
    }
    saveProgress(currentStep, true);
    setVisible(false);
    onSkip?.();
  };

  const posClass = step.position
    ? 'tk-guide-tooltip--' + step.position
    : 'tk-guide-tooltip--center';

  return (
    <div className="tk-guide-overlay" role="dialog" aria-modal="true" aria-label="Tutorial">
      <div className="tk-guide-backdrop" onClick={handleSkip} />
      <div className={`tk-guide-tooltip ${posClass}`}>
        <h3 className="tk-guide-tooltip__title">{step.title}</h3>
        <p className="tk-guide-tooltip__desc">{step.description}</p>
        <div className="tk-guide-tooltip__actions">
          <button
            className="tk-guide-btn tk-guide-btn--skip"
            onClick={handleSkip}
          >
            Skip
          </button>
          {currentStep > 0 && (
            <button
              className="tk-guide-btn tk-guide-btn--prev"
              onClick={handlePrev}
            >
              Previous
            </button>
          )}
          <button
            className="tk-guide-btn tk-guide-btn--next"
            onClick={handleNext}
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
        <div className="tk-guide-tooltip__progress">
          {currentStep + 1} / {steps.length}
        </div>
      </div>
    </div>
  );
};

export default GuideOverlay;
