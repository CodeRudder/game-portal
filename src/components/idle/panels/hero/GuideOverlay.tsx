/**
 * GuideOverlay - Step-by-step tutorial overlay
 *
 * 对接引擎 TutorialStateMachine：
 * - 有 engine 时通过 TutorialStateMachine 读取/推进引导状态
 * - 无 engine 时回退到 localStorage（兼容旧逻辑）
 *
 * @module components/idle/panels/hero/GuideOverlay
 */
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { TutorialPhase } from '@/games/three-kingdoms/core/guide';
import { UNSKIPPABLE_STEPS } from '@/games/three-kingdoms/core/guide';
import {
  getTutorialSM,
  getTutorialStepMgr,
  isEngineTutorialCompleted,
  getEngineStepIndex,
  loadProgress,
  saveProgress,
  DEFAULT_STEPS,
  OVERLAY_TO_ENGINE_STEP,
  ENGINE_TO_OVERLAY_STEP,
  getTargetElementRect,
  getEngineStepDescription,
  GUIDE_KEY,
  WELCOME_DISMISSED_KEY,
} from './guide-utils';
import type { GuideStep, GuideActionType, GuideAction, HighlightRect } from './guide-utils';
// 拆分组件：StrategyGuidePanel + GuideReplayButton 移至独立文件
export { StrategyGuidePanel } from './StrategyGuidePanel';
export type { StrategyGuidePanelProps } from './StrategyGuidePanel';
export { GuideReplayButton } from './StrategyGuidePanel';
export type { ReplayButtonProps } from './StrategyGuidePanel';
// 拆分组件：GuideRewardConfirm 奖励确认弹窗
export { GuideRewardConfirm } from './GuideRewardConfirm';
export type { GuideRewardConfirmProps } from './GuideRewardConfirm';
import { GuideRewardConfirm } from './GuideRewardConfirm';
// 拆分组件：GuideWelcomeModal 欢迎弹窗
export { GuideWelcomeModal } from './GuideWelcomeModal';
export type { GuideWelcomeModalProps } from './GuideWelcomeModal';
import { GuideWelcomeModal } from './GuideWelcomeModal';
// 自由探索过渡弹窗
export { GuideFreeExploreModal } from './GuideFreeExploreModal';
export type { GuideFreeExploreModalProps } from './GuideFreeExploreModal';
import { GuideFreeExploreModal } from './GuideFreeExploreModal';
// 重新导出类型供外部使用
export type { GuideStep, GuideActionType, GuideAction } from './guide-utils';
import './GuideOverlay.css';

// ── Props ──

interface GuideOverlayProps {
  steps?: GuideStep[];
  /** 引擎实例，用于对接 TutorialStateMachine */
  engine?: ThreeKingdomsEngine | null;
  /** 引导动作回调 — 步骤完成时触发引擎操作（招募/升级/编队等） */
  onGuideAction?: (action: GuideAction) => void;
  onComplete?: () => void;
  onSkip?: () => void;
  /** 重玩引导回调 */
  onReplayTutorial?: () => void;
}

// ── 组件 ──

const GuideOverlay: React.FC<GuideOverlayProps> = ({
  steps = DEFAULT_STEPS,
  engine,
  onGuideAction,
  onComplete,
  onSkip,
  onReplayTutorial,
}) => {
  // 获取引擎 TutorialStateMachine 和 TutorialStepManager
  const tutorialSM = useMemo(() => getTutorialSM(engine), [engine]);
  const tutorialStepMgr = useMemo(() => getTutorialStepMgr(engine), [engine]);

  /** 引导完成奖励发放：调用引擎 grantTutorialRewards 将奖励写入玩家资源 */
  const grantStepRewards = useCallback((overlayStepId: string) => {
    if (!engine || typeof engine.grantTutorialRewards !== 'function') return;
    const engineStepId = OVERLAY_TO_ENGINE_STEP[overlayStepId];
    if (!engineStepId) return;
    // 从引擎 StepManager 获取步骤定义中的奖励
    if (tutorialStepMgr) {
      const stepDef = tutorialStepMgr.getStepDefinition(engineStepId);
      if (stepDef && stepDef.rewards.length > 0) {
        engine.grantTutorialRewards(stepDef.rewards);
      }
    }
  }, [engine, tutorialStepMgr]);

  // 初始化步骤索引：优先引擎 StepManager → StateMachine → localStorage
  const [currentStep, setCurrentStep] = useState<number>(() => {
    // Bug-3: 回归玩家检测 — 已有存档数据时直接跳过引导
    if (tutorialSM) {
      const phase = tutorialSM.getCurrentPhase();
      if (phase === 'free_play' || phase === 'mini_tutorial') return -1;
      const completedCount = tutorialSM.getCompletedStepCount();
      if (completedCount > 0 && phase !== 'core_guiding') return -1;
    }
    const savedProgress = loadProgress();
    if (savedProgress === -1) return -1;

    // 优先使用 StepManager 获取下一个未完成步骤
    if (tutorialStepMgr) {
      const nextStep = tutorialStepMgr.getNextStep();
      if (!nextStep) return -1; // 所有步骤已完成
      // 将引擎步骤ID反向映射到 overlay 步骤索引
      const overlayStepId = ENGINE_TO_OVERLAY_STEP[nextStep.stepId];
      if (overlayStepId) {
        const stepIndex = DEFAULT_STEPS.findIndex((s) => s.id === overlayStepId);
        if (stepIndex >= 0) return stepIndex;
      }
    }
    // 回退到 StateMachine
    if (tutorialSM) {
      return getEngineStepIndex(tutorialSM, steps.length);
    }
    return savedProgress;
  });
  const [visible, setVisible] = useState(true);

  // ── 欢迎弹窗状态 ──
  // 首次进入游戏且引导未完成时显示欢迎弹窗
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      // 已完成引导或已关闭过欢迎弹窗 → 不再显示
      const dismissed = localStorage.getItem(WELCOME_DISMISSED_KEY);
      if (dismissed === 'true') return false;
      const progress = loadProgress();
      if (progress === -1) return false; // 已完成
      return true;
    } catch {
      return true;
    }
  });

  // ── 奖励确认弹窗状态 ──
  const [rewardConfirm, setRewardConfirm] = useState<{
    visible: boolean;
    rewardText: string;
  }>({ visible: false, rewardText: '' });

  // ── 自由探索过渡弹窗状态 ──
  // 引导完成后先显示奖励弹窗，用户收取奖励后再显示自由探索过渡弹窗
  const [showFreeExplore, setShowFreeExplore] = useState(false);

  // ── 高亮目标元素位置 ──
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);

  // Bug-3 修复：回归玩家自动跳过引导
  // 当引擎可用且检测到回归玩家时，通知引擎进入回归模式
  useEffect(() => {
    if (!tutorialSM || currentStep !== -1) return;
    const phase = tutorialSM.getCurrentPhase();
    if (phase === 'not_started') {
      // 有存档但状态机未开始 → 回归玩家，直接进入自由游戏
      tutorialSM.enterAsReturning();
      saveProgress(0, true);
    }
  }, [tutorialSM, currentStep]);

  // 确保引擎步骤已启动 — 初始化和步骤切换时都需要 activeStepId 不为 null
  const engineStepStarted = useRef(false);
  useEffect(() => {
    if (!tutorialStepMgr || currentStep < 0 || !visible) return;
    const overlayStep = steps[currentStep];
    if (!overlayStep) return;
    const engineStepId = OVERLAY_TO_ENGINE_STEP[overlayStep.id];
    if (!engineStepId) return;
    // 仅在 activeStepId 为 null 时启动（避免重复启动）
    const { activeStepId } = tutorialStepMgr.getState();
    if (!activeStepId) {
      tutorialStepMgr.startStep(engineStepId);
      engineStepStarted.current = true;
    }
  }, [tutorialStepMgr, currentStep, steps, visible]);

  // ── 高亮目标元素定位：步骤切换时更新 ──
  // 手机端增强：scrollIntoView + 视口边界安全 + 延迟重取
  useEffect(() => {
    if (currentStep < 0 || !visible) {
      setHighlightRect(null);
      return;
    }
    const overlayStep = steps[currentStep];
    if (!overlayStep?.targetSelector) {
      setHighlightRect(null);
      return;
    }
    // 立即尝试定位（内部已含 scrollIntoView + 视口边界安全检查）
    const rect = getTargetElementRect(overlayStep.targetSelector);
    setHighlightRect(rect);

    // scrollIntoView 后延迟重取精确位置（滚动动画完成后位置更准确）
    const scrollRetryTimer = setTimeout(() => {
      const newRect = getTargetElementRect(overlayStep.targetSelector);
      if (newRect) {
        setHighlightRect(prev => {
          // 仅在位置确实变化时更新，避免不必要的重渲染
          if (!prev || prev.top !== newRect.top || prev.left !== newRect.left) return newRect;
          return prev;
        });
      }
    }, 350); // smooth 滚动约 300ms 完成

    // 目标元素可能延迟渲染，使用 MutationObserver + 定时重试
    const observer = new MutationObserver(() => {
      const newRect = getTargetElementRect(overlayStep.targetSelector);
      if (newRect) {
        setHighlightRect(newRect);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 定时重试（目标元素可能延迟挂载）
    const retryTimer = setInterval(() => {
      const newRect = getTargetElementRect(overlayStep.targetSelector);
      if (newRect) {
        setHighlightRect(newRect);
      }
    }, 500);

    // 窗口resize时更新位置（手机端地址栏收缩/展开、横竖屏切换）
    const handleResize = () => {
      const newRect = getTargetElementRect(overlayStep.targetSelector);
      setHighlightRect(newRect);
    };
    window.addEventListener('resize', handleResize);

    // 手机端可视区域变化（虚拟键盘弹出/收起）时更新位置
    const handleVHChange = () => {
      const newRect = getTargetElementRect(overlayStep.targetSelector);
      setHighlightRect(newRect);
    };
    if (typeof visualViewport !== 'undefined' && visualViewport) {
      visualViewport.addEventListener('resize', handleVHChange);
    }

    // 页面滚动时更新高亮位置（修复遮罩高亮定位在滚动时不跟随的问题）
    const handleScroll = () => {
      const newRect = getTargetElementRect(overlayStep.targetSelector);
      if (newRect) {
        setHighlightRect(newRect);
      }
    };
    window.addEventListener('scroll', handleScroll, true); // capture模式捕获所有滚动事件

    return () => {
      clearTimeout(scrollRetryTimer);
      observer.disconnect();
      clearInterval(retryTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      if (typeof visualViewport !== 'undefined' && visualViewport) {
        visualViewport.removeEventListener('resize', handleVHChange);
      }
    };
  }, [currentStep, steps, visible]);

  // ── 检查当前步骤是否不可跳过 ──
  // 注意：此 hook 必须在条件返回之前调用，以遵守 React hooks 规则
  const isUnskippable = useMemo(() => {
    if (currentStep < 0 || currentStep >= steps.length) return false;
    const s = steps[currentStep];
    if (!s) return false;
    // 优先检查步骤自身标记
    if (s.unskippable) return true;
    // 回退检查引擎映射
    const engineStepId = OVERLAY_TO_ENGINE_STEP[s.id];
    return engineStepId ? UNSKIPPABLE_STEPS.includes(engineStepId) : false;
  }, [currentStep, steps]);

  // ── 条件渲染守卫（不使用 early return 以保持 hooks 数量一致） ──
  const shouldRender = currentStep >= 0 && steps.length > 0 && visible;
  // 注意：step 在 shouldRender=true 时一定不为 null
  // handleNext/handlePrev/handleSkip 只在 shouldRender=true 时被调用
  // 使用非空断言因为所有事件处理函数仅在组件渲染时触发，此时 step 必然存在
  const step = (shouldRender ? steps[currentStep] : null) as GuideStep | null;
  const isLastStep = step ? currentStep >= steps.length - 1 : false;

  // ── 引擎子步骤文案消费 ──
  // 优先使用引擎定义的子步骤文案，回退到 DEFAULT_STEPS 的静态 description
  const engineDescription = useMemo(() => {
    if (!step || !tutorialStepMgr) return null;
    return getEngineStepDescription(tutorialStepMgr, step.id);
  }, [step?.id, tutorialStepMgr]);

  // 最终显示的描述文案：引擎文案 > 静态文案
  const displayDescription = engineDescription ?? step?.description ?? '';

  const handleNext = () => {
    if (!step) return;
    if (isLastStep) {
      // 完成引导：通知 StepManager → StateMachine → 回退存储
      // 先触发当前步骤的引擎动作
      if (onGuideAction && step) {
        onGuideAction({ type: step.id as GuideActionType, stepIndex: currentStep, stepId: step.id });
      }
      if (tutorialStepMgr) {
        // 确保当前步骤已启动（activeStepId 可能因初始化未触发而为 null）
        const { activeStepId } = tutorialStepMgr.getState();
        if (!activeStepId && step) {
          const engineStepId = OVERLAY_TO_ENGINE_STEP[step.id];
          if (engineStepId) {
            tutorialStepMgr.startStep(engineStepId);
          }
        }
        // 通过 StepManager 完成当前活跃步骤（触发奖励发放）
        const currentActiveId = tutorialStepMgr.getState().activeStepId;
        if (currentActiveId && step) {
          tutorialStepMgr.completeCurrentStep();
          // Bug-2 修复：实际发放步骤奖励到玩家资源
          grantStepRewards(step.id);
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

      // Bug-2 增强：确保所有未发放的步骤奖励都被正确发放
      // 遍历所有步骤，为每个有引擎映射但可能未发放奖励的步骤补发
      if (tutorialStepMgr) {
        for (let i = 0; i <= currentStep; i++) {
          const s = steps[i];
          if (s) {
            grantStepRewards(s.id);
          }
        }
      }

      // 显示引导完成庆祝弹窗 — 汇总所有步骤奖励
      const allRewards = steps
        .filter(s => s.rewardText)
        .map(s => s.rewardText);
      setRewardConfirm({
        visible: true,
        rewardText: allRewards.length > 0
          ? allRewards.join('\n')
          : '🎓 新手引导已完成！',
      });
      setVisible(false);
      onComplete?.();
    } else {
      const next = currentStep + 1;
      // 触发当前步骤的引擎动作（招募/升级/编队等）
      if (onGuideAction && step) {
        onGuideAction({ type: step.id as GuideActionType, stepIndex: currentStep, stepId: step.id });
      }
      // 通知 StepManager 完成当前步骤（触发奖励发放）
      if (tutorialStepMgr) {
        // 确保当前步骤已启动（activeStepId 可能为 null）
        const { activeStepId } = tutorialStepMgr.getState();
        if (!activeStepId && step) {
          const engineStepId = OVERLAY_TO_ENGINE_STEP[step.id];
          if (engineStepId) {
            tutorialStepMgr.startStep(engineStepId);
          }
        }
        const currentActiveId = tutorialStepMgr.getState().activeStepId;
        if (currentActiveId && step) {
          tutorialStepMgr.completeCurrentStep();
          // Bug-2 修复：实际发放步骤奖励到玩家资源
          grantStepRewards(step.id);
        }
        // 启动下一步骤（幂等保护：仅在 activeStepId 为 null 时启动）
        // 使用 setTimeout(0) 确保在 completeCurrentStep 的状态更新生效后再启动下一步
        const nextOverlayStepId = steps[next]?.id;
        if (nextOverlayStepId) {
          const mappedId = OVERLAY_TO_ENGINE_STEP[nextOverlayStepId];
          if (mappedId) {
            // 延迟启动，避免同一渲染周期内 startStep 被调用两次
            setTimeout(() => {
              const { activeStepId: newActiveId } = tutorialStepMgr.getState();
              if (!newActiveId) {
                tutorialStepMgr.startStep(mappedId);
              }
            }, 0);
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

  // ── 欢迎弹窗处理 ──
  const handleWelcomeStart = useCallback(() => {
    setShowWelcome(false);
    try {
      localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    } catch { /* ignore */ }
  }, []);

  const handleWelcomeSkip = useCallback(() => {
    setShowWelcome(false);
    try {
      localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    } catch { /* ignore */ }
    // 跳过引导
    saveProgress(0, true);
    setVisible(false);
    onSkip?.();
  }, [onSkip]);

  const posClass = step?.position
    ? 'tk-guide-tooltip--' + step.position
    : 'tk-guide-tooltip--center';

  // 注意：GuideRewardConfirm 和 GuideWelcomeModal 需要在 shouldRender=false 时仍能渲染
  // 因为引导完成时 setVisible(false) 会导致 shouldRender=false，
  // 但此时 rewardConfirm.visible=true 需要显示奖励弹窗
  return (
    <>
      {/* 欢迎弹窗 — 首次进入游戏时显示 */}
      <GuideWelcomeModal
        visible={showWelcome}
        stepCount={steps.length}
        onStart={handleWelcomeStart}
        onSkip={handleWelcomeSkip}
      />
      {/* 奖励确认弹窗 — 引导完成后显示所有已获奖励汇总 */}
      <GuideRewardConfirm
        visible={rewardConfirm.visible}
        rewardText={rewardConfirm.rewardText}
        onConfirm={() => {
          setRewardConfirm({ visible: false, rewardText: '' });
          // 奖励收取后显示自由探索过渡弹窗
          setShowFreeExplore(true);
        }}
      />
      {/* 自由探索过渡弹窗 — 奖励收取后显示，引导用户进入自由探索阶段 */}
      <GuideFreeExploreModal
        visible={showFreeExplore}
        onConfirm={() => setShowFreeExplore(false)}
      />
      {/* 引导步骤遮罩 — 仅在 shouldRender 且 step 有效时渲染 */}
      {shouldRender && step && (
      <div className="tk-guide-overlay" role="dialog" aria-modal="true" aria-label="Tutorial" data-testid="guide-overlay">
        {/* 遮罩层 — 支持高亮镂空 */}
        <div className="tk-guide-backdrop" onClick={isUnskippable ? undefined : handleSkip}>
          {/* 高亮镂空区域 */}
          {highlightRect && (
            <div
              className="tk-guide-highlight"
              style={{
                top: highlightRect.top,
                left: highlightRect.left,
                width: highlightRect.width,
                height: highlightRect.height,
              }}
              data-testid="guide-highlight-area"
            />
          )}
        </div>
        <div className={`tk-guide-tooltip ${posClass}`} data-testid={`guide-overlay-step-${currentStep}`}>
          {/* 步骤指示器 dots */}
          <div className="tk-guide-tooltip__dots" data-testid="guide-step-dots">
            {steps.map((s, idx) => (
              <span
                key={s.id}
                className={`tk-guide-dot ${idx === currentStep ? 'tk-guide-dot--active' : ''} ${idx < currentStep ? 'tk-guide-dot--done' : ''}`}
                data-testid={`guide-dot-${idx}`}
              />
            ))}
          </div>
          <h3 className="tk-guide-tooltip__title">{step.title}</h3>
          <p className="tk-guide-tooltip__desc">{displayDescription}</p>
          {/* 引导完成奖励展示 */}
          {step.rewardText && (
            <div className="tk-guide-tooltip__reward" data-testid={`guide-overlay-reward-${currentStep}`}>
              {step.rewardText}
            </div>
          )}
          <div className="tk-guide-tooltip__actions">
            {!isUnskippable && (
              <button
                className="tk-guide-btn tk-guide-btn--skip"
                data-testid="guide-overlay-skip"
                onClick={handleSkip}
              >
                跳过
              </button>
            )}
            {currentStep > 0 && (
              <button
                className="tk-guide-btn tk-guide-btn--prev"
                data-testid="guide-overlay-prev"
                onClick={handlePrev}
              >
                上一步
              </button>
            )}
            <button
              className="tk-guide-btn tk-guide-btn--next"
              data-testid="guide-overlay-next"
              onClick={handleNext}
            >
              {isLastStep ? '完成' : '下一步'}
            </button>
          </div>
          <div className="tk-guide-tooltip__progress" data-testid="guide-step-progress">
            {currentStep + 1} / {steps.length}
          </div>
        </div>
      </div>
      )}
    </>
  );
};

GuideOverlay.displayName = 'GuideOverlay';

export default GuideOverlay;
