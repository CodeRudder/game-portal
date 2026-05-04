/**
 * guide-utils — 引导系统共享工具函数
 *
 * 从 GuideOverlay.tsx 提取的公共逻辑，供 GuideOverlay、GuideReplayButton、
 * StrategyGuidePanel 共同使用。
 *
 * @module components/idle/panels/hero/guide-utils
 */

import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import { TutorialStateMachine, TutorialStepManager } from '@/games/three-kingdoms/engine';

/** 检查对象是否实现 TutorialStateMachine 接口 */
function isTutorialStateMachine(obj: unknown): obj is TutorialStateMachine {
  if (obj == null || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return typeof o.getCurrentPhase === 'function' && typeof o.getCompletedStepCount === 'function';
}

/** 检查对象是否实现 TutorialStepManager 接口 */
function isTutorialStepManager(obj: unknown): obj is TutorialStepManager {
  if (obj == null || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return typeof o.getNextStep === 'function' && typeof o.getStepDefinition === 'function';
}

// ─────────────────────────────────────────────
// localStorage Key
// ─────────────────────────────────────────────

/** 引导进度 localStorage 键名 */
export const GUIDE_KEY = 'tk-tutorial-progress';

/** 欢迎弹窗已关闭标记 localStorage 键名 */
export const WELCOME_DISMISSED_KEY = 'tk-tutorial-welcome-dismissed';

// ─────────────────────────────────────────────
// 引擎 TutorialStateMachine 适配
// ─────────────────────────────────────────────

/**
 * 尝试从引擎获取 TutorialStateMachine 实例
 *
 * 引擎可能尚未注册 tutorial-state 子系统（如旧存档），
 * 此函数安全地返回 null 而不抛异常。
 */
export function getTutorialSM(engine?: ThreeKingdomsEngine | null): TutorialStateMachine | null {
  if (!engine) return null;
  try {
    // ThreeKingdomsEngine 有 getTutorialStateMachine getter
    if (typeof engine.getTutorialStateMachine === 'function') {
      const sm = engine.getTutorialStateMachine();
      if (isTutorialStateMachine(sm)) return sm;
    }
    // 回退：通过 registry 获取
    const registry = engine.getSubsystemRegistry();
    if (!registry) return null;
    const sm = registry.get('tutorialStateMachine') as unknown;
    return isTutorialStateMachine(sm) ? sm : null;
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
export function getTutorialStepMgr(engine?: ThreeKingdomsEngine | null): TutorialStepManager | null {
  if (!engine) return null;
  try {
    if (typeof engine.getTutorialStepManager === 'function') {
      const mgr = engine.getTutorialStepManager();
      if (isTutorialStepManager(mgr)) return mgr;
    }
    // 回退：通过 registry 获取
    const registry = engine.getSubsystemRegistry();
    if (!registry) return null;
    const mgr = registry.get('tutorialStepManager') as unknown;
    return isTutorialStepManager(mgr) ? mgr : null;
  } catch {
    return null;
  }
}

/**
 * 从引擎状态机判断引导是否已完成
 */
export function isEngineTutorialCompleted(sm: TutorialStateMachine | null): boolean {
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
export function getEngineStepIndex(sm: TutorialStateMachine | null, totalSteps: number): number {
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

/** 从 localStorage 读取引导进度 */
export function loadProgress(): number {
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

/** 将引导进度写入 localStorage */
export function saveProgress(step: number, completed: boolean): void {
  try {
    localStorage.setItem(GUIDE_KEY, JSON.stringify({ step, completed }));
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────
// 引导步骤类型
// ─────────────────────────────────────────────

export interface GuideStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** 是否不可跳过（强制引导步骤，隐藏Skip按钮） */
  unskippable?: boolean;
  /** 步骤完成时的奖励描述文本 */
  rewardText?: string;
}

/**
 * 引导动作类型 — 每个步骤对应的引擎操作
 */
export type GuideActionType = 'recruit' | 'detail' | 'enhance' | 'formation' | 'resources' | 'tech';

export interface GuideAction {
  /** 动作类型 */
  type: GuideActionType;
  /** 步骤索引 */
  stepIndex: number;
  /** 步骤ID */
  stepId: string;
}

// ─────────────────────────────────────────────
// 默认引导步骤配置
// ─────────────────────────────────────────────

export const DEFAULT_STEPS: GuideStep[] = [
  {
    id: 'recruit',
    title: '🎮 千军易得，一将难求',
    description: '点击酒馆招募你的第一位武将！武将是争霸天下的核心力量。',
    targetSelector: '.tk-hero-recruit-btn',
    position: 'bottom',
    unskippable: true,
    rewardText: '🎁 奖励：铜钱 ×500',
  },
  {
    id: 'detail',
    title: '📋 知己知彼，百战不殆',
    description: '点击武将卡片查看详细属性、技能和战力信息。',
    targetSelector: '.tk-hero-card',
    position: 'right',
    unskippable: true,
    rewardText: '🎁 奖励：招贤令 ×1',
  },
  {
    id: 'enhance',
    title: '✅ 强将手下无弱兵',
    description: '消耗铜钱升级武将，提升攻击、防御等核心属性！',
    targetSelector: '.tk-hero-detail-enhance-btn',
    position: 'top',
    rewardText: '🎁 奖励：铜钱 ×2000',
  },
  {
    id: 'formation',
    title: '⚔️ 排兵布阵，运筹帷幄',
    description: '创建编队并分配武将，前排防御、后排输出，打造最强阵容！',
    targetSelector: '.tk-formation-panel',
    position: 'top',
    rewardText: '🎁 奖励：招贤令 ×1',
  },
  {
    id: 'resources',
    title: '💰 开源节流，富国强兵',
    description: '了解资源类型和产出速率，合理分配是发展的关键！',
    targetSelector: '.tk-resource-bar',
    position: 'bottom',
  },
  {
    id: 'tech',
    title: '🔬 运筹帷幄，决胜千里',
    description: '进入科技树选择研究方向，不同路线提供不同加成效果。',
    targetSelector: '.tk-tech-tab',
    position: 'top',
    rewardText: '🎁 奖励：科技点 ×100',
  },
];

// ─────────────────────────────────────────────
// 步骤映射：Overlay ID ↔ 引擎 StepId
// ─────────────────────────────────────────────

/**
 * Overlay 步骤ID → 引擎 TutorialStepId 映射
 *
 * GuideOverlay 使用简短的语义ID（recruit/detail/enhance/formation/resources/tech），
 * 引擎使用 stepN_xxx 格式。此映射确保两者正确对接。
 *
 * 语义对应关系：
 *   recruit   → step3_recruit_hero   （招募武将）
 *   detail    → step1_castle_overview （查看详情/主城概览）
 *   enhance   → step2_build_farm      （强化/建造升级）
 *   formation → step4_first_battle    （编队/出征布阵）
 *   resources → step5_check_resources （查看资源）
 *   tech      → step6_tech_research   （科技研究）
 */
export const OVERLAY_TO_ENGINE_STEP: Record<string, import('@/games/three-kingdoms/core/guide/guide.types').TutorialStepId> = {
  recruit: 'step3_recruit_hero',
  detail: 'step1_castle_overview',
  enhance: 'step2_build_farm',
  formation: 'step4_first_battle',
  resources: 'step5_check_resources',
  tech: 'step6_tech_research',
};

/**
 * 引擎 TutorialStepId → Overlay 步骤ID 反向映射
 *
 * 用于从引擎 StepManager.getNextStep() 返回的引擎步骤ID
 * 反向查找对应的 overlay 步骤。
 */
export const ENGINE_TO_OVERLAY_STEP: Record<string, string> = {
  step1_castle_overview: 'detail',
  step2_build_farm: 'enhance',
  step3_recruit_hero: 'recruit',
  step4_first_battle: 'formation',
  step5_check_resources: 'resources',
  step6_tech_research: 'tech',
  step7_advisor_suggest: 'tech',
  step8_semi_auto_battle: 'tech',
  step9_borrow_hero: 'recruit',
  step10_bag_manage: 'detail',
  step11_tech_branch: 'tech',
  step12_alliance: 'formation',
};

// ─────────────────────────────────────────────
// 引擎子步骤文案获取
// ─────────────────────────────────────────────

/**
 * 从引擎获取当前活跃步骤的子步骤文案
 *
 * 优先使用引擎 TutorialStepManager 中定义的子步骤文案（subSteps[].text），
 * 回退到 DEFAULT_STEPS 中的静态 description。
 *
 * @param stepMgr TutorialStepManager 实例
 * @param overlayStepId 当前 Overlay 步骤ID
 * @returns 子步骤文案文本，引擎不可用时返回 null
 */
export function getEngineStepDescription(
  stepMgr: import('@/games/three-kingdoms/engine/guide/TutorialStepManager').TutorialStepManager | null,
  overlayStepId: string,
): string | null {
  if (!stepMgr) return null;
  const engineStepId = OVERLAY_TO_ENGINE_STEP[overlayStepId];
  if (!engineStepId) return null;

  // 优先获取当前活跃步骤的子步骤文案
  const currentSubStep = stepMgr.getCurrentSubStep();
  if (currentSubStep?.text) return currentSubStep.text;

  // 回退：获取步骤定义的 description
  const stepDef = stepMgr.getStepDefinition(engineStepId);
  if (stepDef?.description) return stepDef.description;

  return null;
}

/**
 * 获取引擎步骤定义中的所有子步骤文案列表
 *
 * 用于步骤切换时一次性获取所有子步骤，
 * UI层可以根据子步骤索引显示对应文案。
 *
 * @param stepMgr TutorialStepManager 实例
 * @param overlayStepId 当前 Overlay 步骤ID
 * @returns 子步骤文案数组，引擎不可用时返回空数组
 */
export function getEngineSubStepTexts(
  stepMgr: import('@/games/three-kingdoms/engine/guide/TutorialStepManager').TutorialStepManager | null,
  overlayStepId: string,
): string[] {
  if (!stepMgr) return [];
  const engineStepId = OVERLAY_TO_ENGINE_STEP[overlayStepId];
  if (!engineStepId) return [];

  const stepDef = stepMgr.getStepDefinition(engineStepId);
  if (!stepDef?.subSteps) return [];

  return stepDef.subSteps.map(sub => sub.text);
}

// ─────────────────────────────────────────────
// 高亮定位工具
// ─────────────────────────────────────────────

/** 高亮区域位置信息 */
export interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * 将目标元素滚动到可视区域内
 *
 * 手机端虚拟键盘、地址栏收缩等场景下，目标元素可能不在当前视口内。
 * 使用 scrollIntoView 确保高亮前元素可见，再获取精确位置。
 */
export function scrollElementIntoView(el: Element, behavior: ScrollBehavior = 'smooth'): void {
  try {
    el.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
  } catch {
    el.scrollIntoView(false);
  }
}

/**
 * 获取目标元素的视口位置矩形（含安全边界检查）
 *
 * 根据 targetSelector 查找 DOM 元素，返回其位置信息，
 * 用于遮罩层镂空高亮显示。自动处理视口外元素的滚动定位。
 */
export function getTargetElementRect(selector?: string): HighlightRect | null {
  if (!selector || typeof document === 'undefined') return null;
  try {
    const el = document.querySelector(selector);
    if (!el) return null;

    // 手机端适配：先确保目标元素在可视区域内
    const rect0 = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const isInViewport = rect0.top >= 0 && rect0.bottom <= vh && rect0.left >= 0 && rect0.right <= vw;
    if (!isInViewport) {
      scrollElementIntoView(el);
    }

    const rect = el.getBoundingClientRect();
    const padding = 6;

    // 视口边界安全检查
    const safeTop = Math.max(0, Math.min(rect.top - padding, vh - rect.height - padding * 2));
    const safeLeft = Math.max(0, Math.min(rect.left - padding, vw - rect.width - padding * 2));

    return {
      top: safeTop,
      left: safeLeft,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    };
  } catch {
    return null;
  }
}
