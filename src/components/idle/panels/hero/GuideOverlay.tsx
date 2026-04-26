/**
 * GuideOverlay - Step-by-step tutorial overlay
 *
 * 对接引擎 TutorialStateMachine：
 * - 有 engine 时通过 TutorialStateMachine 读取/推进引导状态
 * - 无 engine 时回退到 localStorage（兼容旧逻辑）
 *
 * @module components/idle/panels/hero/GuideOverlay
 */
import React, { useState, useCallback, useMemo } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import { TutorialStateMachine, TutorialStepManager } from '@/games/three-kingdoms/engine';
import type { TutorialPhase } from '@/games/three-kingdoms/core/guide';
import './GuideOverlay.css';

export interface GuideStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

/**
 * 引导动作类型 — 每个步骤对应的引擎操作
 *
 * 当用户在引导中点击 Next/Finish 时，GuideOverlay 通过 onGuideAction
 * 回调通知父组件执行对应的引擎操作（招募、升级、编队等），
 * 实现引导系统与引擎的完整对接。
 */
export type GuideActionType = 'recruit' | 'detail' | 'enhance' | 'formation';

export interface GuideAction {
  /** 动作类型 */
  type: GuideActionType;
  /** 步骤索引 */
  stepIndex: number;
  /** 步骤ID */
  stepId: string;
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

/**
 * Overlay 步骤ID → 引擎 TutorialStepId 映射
 *
 * GuideOverlay 使用简短的语义ID（recruit/detail/enhance/formation），
 * 引擎使用 stepN_xxx 格式。此映射确保两者正确对接。
 */
const OVERLAY_TO_ENGINE_STEP: Record<string, import('@/games/three-kingdoms/core/guide/guide.types').TutorialStepId> = {
  recruit: 'step3_recruit_hero',
  detail: 'step3_recruit_hero',
  enhance: 'step3_recruit_hero',
  formation: 'step4_first_battle',
};

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
    // ThreeKingdomsEngine 有 getTutorialStateMachine getter
    if (typeof engine.getTutorialStateMachine === 'function') {
      return engine.getTutorialStateMachine();
    }
    // 回退：通过 registry 获取
    const registry = engine.getSubsystemRegistry();
    if (!registry) return null;
    const sm = registry.get('tutorial-state') as TutorialStateMachine | undefined;
    return sm && typeof sm.getCurrentPhase === 'function' ? sm : null;
  } catch {
    return null;
  }
}

/**
 * 尝试从引擎获取 TutorialStepManager 实例
 *
 * TutorialStepManager 管理步骤的执行、完成判定和奖励发放，
 * 是 GuideOverlay 推进引导步骤的推荐 API。
 */
function getTutorialStepMgr(engine?: ThreeKingdomsEngine | null): TutorialStepManager | null {
  if (!engine) return null;
  try {
    if (typeof engine.getTutorialStepManager === 'function') {
      const mgr = engine.getTutorialStepManager();
      return mgr && typeof mgr.getNextStep === 'function' ? mgr : null;
    }
    // 回退：通过 registry 获取
    const registry = engine.getSubsystemRegistry();
    if (!registry) return null;
    const mgr = registry.get('tutorial-steps') as TutorialStepManager | undefined;
    return mgr && typeof mgr.getNextStep === 'function' ? mgr : null;
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
  /**
   * 引导动作回调 — 当引导步骤完成时触发引擎操作
   *
   * 父组件（如 HeroTab）通过此回调将引导动作桥接到 useHeroEngine，
   * 确保引导中的操作（招募、升级、编队）通过引擎执行。
   *
   * @example
   * ```tsx
   * <GuideOverlay
   *   engine={engine}
   *   onGuideAction={(action) => {
   *     switch (action.type) {
   *       case 'recruit': engine.recruitHero('normal', 1); break;
   *       case 'enhance': engine.enhanceHero(heroId, 1); break;
   *       case 'formation': engine.setFormation('0', heroIds); break;
   *     }
   *   }}
   * />
   * ```
   */
  onGuideAction?: (action: GuideAction) => void;
  onComplete?: () => void;
  onSkip?: () => void;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

const GuideOverlay: React.FC<GuideOverlayProps> = ({
  steps = DEFAULT_STEPS,
  engine,
  onGuideAction,
  onComplete,
  onSkip,
}) => {
  // 获取引擎 TutorialStateMachine 和 TutorialStepManager
  const tutorialSM = useMemo(() => getTutorialSM(engine), [engine]);
  const tutorialStepMgr = useMemo(() => getTutorialStepMgr(engine), [engine]);

  // 初始化步骤索引：优先引擎 StepManager → StateMachine → localStorage
  const [currentStep, setCurrentStep] = useState<number>(() => {
    // 优先使用 StepManager 获取下一个未完成步骤
    if (tutorialStepMgr) {
      const nextStep = tutorialStepMgr.getNextStep();
      if (!nextStep) return -1; // 所有步骤已完成
      // 将引擎步骤索引映射到 overlay 步骤索引
      const stepIndex = DEFAULT_STEPS.findIndex((s) => s.id === nextStep.stepId);
      if (stepIndex >= 0) return stepIndex;
    }
    // 回退到 StateMachine
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
      // 完成引导：通知 StepManager → StateMachine → 回退存储
      // 先触发当前步骤的引擎动作
      if (onGuideAction && step) {
        onGuideAction({ type: step.id as GuideActionType, stepIndex: currentStep, stepId: step.id });
      }
      if (tutorialStepMgr) {
        // 通过 StepManager 完成当前活跃步骤
        const activeId = tutorialStepMgr.getState().activeStepId;
        if (activeId) {
          tutorialStepMgr.completeCurrentStep();
        }
      }
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
      // 触发当前步骤的引擎动作（招募/升级/编队等）
      if (onGuideAction && step) {
        onGuideAction({ type: step.id as GuideActionType, stepIndex: currentStep, stepId: step.id });
      }
      // 通知 StepManager 完成当前步骤
      if (tutorialStepMgr) {
        const activeId = tutorialStepMgr.getState().activeStepId;
        if (activeId) {
          tutorialStepMgr.completeCurrentStep();
        }
        // 尝试启动下一步骤
        const nextOverlayStepId = steps[next]?.id;
        if (nextOverlayStepId) {
          const mappedId = OVERLAY_TO_ENGINE_STEP[nextOverlayStepId];
          if (mappedId) {
            tutorialStepMgr.startStep(mappedId);
          }
        }
      }
      // 通知 StateMachine 步骤完成
      if (tutorialSM) {
        const phase = tutorialSM.getCurrentPhase();
        if (phase === 'not_started') {
          tutorialSM.transition('first_enter');
        }
        // 将 overlay 步骤映射到引擎步骤 ID
        const overlayStepId = steps[currentStep]?.id;
        const engineStepId = overlayStepId ? OVERLAY_TO_ENGINE_STEP[overlayStepId] : undefined;
        if (engineStepId) {
          tutorialSM.completeStep(engineStepId);
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
    // 跳过引导：通知 StepManager → StateMachine → 回退存储
    if (tutorialStepMgr) {
      const activeId = tutorialStepMgr.getState().activeStepId;
      if (activeId) {
        tutorialStepMgr.completeCurrentStep();
      }
    }
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
    <div className="tk-guide-overlay" role="dialog" aria-modal="true" aria-label="Tutorial" data-testid="guide-overlay">
      <div className="tk-guide-backdrop" onClick={handleSkip} />
      <div className={`tk-guide-tooltip ${posClass}`} data-testid={`guide-overlay-step-${currentStep}`}>
        <h3 className="tk-guide-tooltip__title">{step.title}</h3>
        <p className="tk-guide-tooltip__desc">{step.description}</p>
        <div className="tk-guide-tooltip__actions">
          <button
            className="tk-guide-btn tk-guide-btn--skip"
            data-testid="guide-overlay-skip"
            onClick={handleSkip}
          >
            Skip
          </button>
          {currentStep > 0 && (
            <button
              className="tk-guide-btn tk-guide-btn--prev"
              data-testid="guide-overlay-prev"
              onClick={handlePrev}
            >
              Previous
            </button>
          )}
          <button
            className="tk-guide-btn tk-guide-btn--next"
            data-testid="guide-overlay-next"
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
