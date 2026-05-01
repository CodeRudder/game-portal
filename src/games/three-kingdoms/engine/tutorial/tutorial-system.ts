/**
 * 新手引导系统 — 主逻辑
 *
 * 帮助新玩家理解武将系统的核心玩法，通过4个引导步骤引导玩家完成首次关键操作：
 *   1. 领取新手礼包 — 获得100招贤令+5000铜钱+1本技能书
 *   2. 首次招募 — 执行一次普通招募
 *   3. 查看武将 — 查看刚招募的武将详情
 *   4. 编队上阵 — 将武将添加到编队中
 *
 * 规则：
 *   - 每个步骤只能按顺序完成
 *   - 完成当前步骤后自动解锁下一步
 *   - 所有步骤完成后，引导结束
 *   - 引导状态持久化（存档保存）
 *   - 可跳过（但不会有跳过奖励）
 *
 * @module engine/tutorial/tutorial-system
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  TutorialGuideStep,
  TutorialGuideStepId,
  TutorialGuideSaveData,
  TutorialGuideReward,
} from './tutorial-config';
import {
  TUTORIAL_GUIDE_SAVE_VERSION,
  TUTORIAL_GUIDE_TOTAL_STEPS,
  TUTORIAL_GUIDE_STEPS,
  TUTORIAL_GUIDE_STEP_MAP,
  TUTORIAL_GUIDE_ACTION_MAP,
} from './tutorial-config';

// ─────────────────────────────────────────────
// 内部状态
// ─────────────────────────────────────────────

/** 引导系统内部状态 */
interface TutorialGuideInternalState {
  /** 已完成的步骤ID列表（按完成顺序） */
  completedSteps: TutorialGuideStepId[];
  /** 是否已跳过 */
  skipped: boolean;
  /** 每步完成时间戳（步骤ID → 完成时的 Unix ms） */
  stepCompletionTimes: Record<string, number>;
  /** 引导开始时间（首次调用 getCurrentStep 时记录） */
  startedAt: number | null;
}

// ─────────────────────────────────────────────
// 完成步骤结果
// ─────────────────────────────────────────────

/** 完成步骤的返回结果 */
export interface CompleteStepResult {
  /** 是否成功完成 */
  success: boolean;
  /** 失败原因 */
  reason?: string;
  /** 完成的步骤 */
  step?: TutorialGuideStep;
  /** 获得的奖励 */
  rewards: TutorialGuideReward[];
  /** 完成后解锁的下一步骤（null表示引导结束） */
  nextStep: TutorialGuideStep | null;
}

// ─────────────────────────────────────────────
// TutorialSystem 类
// ─────────────────────────────────────────────

/**
 * 新手引导系统
 *
 * 管理新手引导的4个步骤，按顺序引导玩家完成首次关键操作。
 * 实现 ISubsystem 接口，可注册到引擎子系统注册表中。
 */
export class TutorialSystem implements ISubsystem {
  readonly name = 'tutorial-guide' as const;

  private deps!: ISystemDeps;
  private state: TutorialGuideInternalState = this.createInitialState();

  // ─── ISubsystem 生命周期 ──────────────────

  /** 注入依赖 */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** 每帧更新（当前无帧级逻辑） */
  update(_dt: number): void {
    // 预留：可在此检测超时自动完成等
  }

  /** 获取系统状态快照 */
  getState(): TutorialGuideInternalState {
    return { ...this.state };
  }

  /** 重置为初始状态 */
  reset(): void {
    this.state = this.createInitialState();
  }

  // ─── 核心 API ────────────────────────────

  /**
   * 获取当前引导步骤
   *
   * @returns 当前未完成的第一个步骤，引导完成或已跳过时返回 null
   */
  getCurrentStep(): TutorialGuideStep | null {
    if (this.state.skipped) return null;
    if (this.isTutorialComplete()) return null;

    // 首次获取步骤时记录引导开始时间
    if (this.state.startedAt === null) {
      this.state.startedAt = Date.now();
    }

    for (const step of TUTORIAL_GUIDE_STEPS) {
      if (!this.isStepCompleted(step.id)) {
        return step;
      }
    }
    return null;
  }

  /**
   * 完成当前步骤
   *
   * 只有当 action 匹配当前未完成步骤的 triggerAction 时才能完成。
   * 完成后自动解锁下一步。
   *
   * @param action - 触发完成的行为标识
   * @returns 完成结果
   */
  completeCurrentStep(action: string): CompleteStepResult {
    // FIX-T03: 未初始化时安全返回
    if (!this.deps) {
      return { success: false, reason: '系统未初始化', rewards: [], nextStep: null };
    }

    // 引导已跳过
    if (this.state.skipped) {
      return { success: false, reason: '引导已跳过', rewards: [], nextStep: null };
    }

    // 引导已完成
    if (this.isTutorialComplete()) {
      return { success: false, reason: '引导已完成', rewards: [], nextStep: null };
    }

    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      return { success: false, reason: '没有待完成的步骤', rewards: [], nextStep: null };
    }

    // 检查 action 是否匹配当前步骤
    if (currentStep.triggerAction !== action) {
      return {
        success: false,
        reason: `当前步骤需要 "${currentStep.triggerAction}"，收到 "${action}"`,
        rewards: [],
        nextStep: currentStep,
      };
    }

    // 标记完成
    this.state.completedSteps.push(currentStep.id);
    this.state.stepCompletionTimes[currentStep.id] = Date.now();

    // 发射步骤完成事件
    this.deps.eventBus.emit('tutorial-guide:stepCompleted', {
      stepId: currentStep.id,
      timestamp: Date.now(),
    });

    // 检查是否全部完成
    const nextStep = this.getCurrentStep();
    if (!nextStep) {
      this.deps.eventBus.emit('tutorial-guide:completed', {
        timestamp: Date.now(),
      });
    }

    return {
      success: true,
      step: currentStep,
      rewards: [...currentStep.rewards],
      nextStep,
    };
  }

  /**
   * 获取所有步骤状态
   *
   * @returns 步骤列表，每步附带完成状态
   */
  getAllSteps(): (TutorialGuideStep & { isCompleted: boolean })[] {
    return TUTORIAL_GUIDE_STEPS.map(step => ({
      ...step,
      isCompleted: this.isStepCompleted(step.id),
    }));
  }

  /**
   * 引导是否完成
   */
  isTutorialComplete(): boolean {
    return this.state.completedSteps.length >= TUTORIAL_GUIDE_TOTAL_STEPS;
  }

  /**
   * 获取引导进度
   *
   * @returns 进度信息：已完成数、总数、百分比
   */
  getProgress(): { completed: number; total: number; percentage: number } {
    const completed = this.state.completedSteps.length;
    const total = TUTORIAL_GUIDE_TOTAL_STEPS;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage };
  }

  /**
   * 跳过引导
   *
   * 跳过后不能再完成任何步骤，也不会获得跳过奖励。
   */
  skipTutorial(): void {
    // FIX-T07 (R2): 未初始化时安全返回（与 FIX-T03 对称）
    if (!this.deps) return;
    // FIX-T06: 防止重复跳过和重复emit
    if (this.state.skipped) return;
    if (this.isTutorialComplete()) return;
    this.state.skipped = true;
    this.deps.eventBus.emit('tutorial-guide:skipped', {
      timestamp: Date.now(),
    });
  }

  /**
   * 是否已跳过
   */
  isSkipped(): boolean {
    return this.state.skipped;
  }

  // ─── 查询 API ────────────────────────────

  /**
   * 指定步骤是否已完成
   */
  isStepCompleted(stepId: TutorialGuideStepId): boolean {
    return this.state.completedSteps.includes(stepId);
  }

  /**
   * 获取指定步骤定义
   */
  getStepById(stepId: TutorialGuideStepId): TutorialGuideStep | null {
    return TUTORIAL_GUIDE_STEP_MAP[stepId] ?? null;
  }

  /**
   * 获取指定步骤的完成状态
   */
  getStepStatus(stepId: TutorialGuideStepId): 'locked' | 'current' | 'completed' {
    if (this.isStepCompleted(stepId)) return 'completed';
    const currentStep = this.getCurrentStep();
    if (currentStep && currentStep.id === stepId) return 'current';
    return 'locked';
  }

  /**
   * 获取当前步骤的顺序号（1-based）
   *
   * @returns 当前步骤序号，引导完成返回 -1，跳过返回 -2
   */
  getCurrentStepOrder(): number {
    if (this.state.skipped) return -2;
    const current = this.getCurrentStep();
    if (!current) return -1;
    return current.order;
  }

  // ─── 交互式引导 API ──────────────────────

  /**
   * 获取当前步骤需要执行的动作类型
   *
   * @returns 当前步骤的 triggerAction，无待完成步骤时返回 null
   */
  getCurrentStepAction(): string | null {
    const current = this.getCurrentStep();
    return current?.triggerAction ?? null;
  }

  /**
   * 获取指定步骤的提示信息
   *
   * @param stepId - 步骤ID
   * @returns 提示文本，步骤不存在时返回 null
   */
  getStepHint(stepId: TutorialGuideStepId): string | null {
    const step = TUTORIAL_GUIDE_STEP_MAP[stepId];
    return step?.hint ?? null;
  }

  /**
   * 获取引导完成统计
   *
   * @returns 统计信息：总步骤数、完成数、跳过率、平均完成时间(ms)
   */
  getTutorialStats(): {
    totalSteps: number;
    completedSteps: number;
    skipRate: number;
    avgCompletionTimeMs: number;
  } {
    const totalSteps = TUTORIAL_GUIDE_TOTAL_STEPS;
    const completedSteps = this.state.completedSteps.length;
    const skipRate = this.state.skipped ? 1 : 0;

    // 计算已完成步骤的平均完成时间
    const times = Object.values(this.state.stepCompletionTimes);
    let avgCompletionTimeMs = 0;
    if (this.state.startedAt !== null && times.length > 0) {
      const totalTime = times.reduce((sum, t) => sum + (t - this.state.startedAt!), 0);
      avgCompletionTimeMs = Math.round(totalTime / times.length);
    }

    return { totalSteps, completedSteps, skipRate, avgCompletionTimeMs };
  }

  // ─── 序列化 / 反序列化 ────────────────────

  /**
   * 序列化为存档数据
   */
  serialize(): TutorialGuideSaveData {
    return {
      version: TUTORIAL_GUIDE_SAVE_VERSION,
      completedSteps: [...this.state.completedSteps],
      skipped: this.state.skipped,
      stepCompletionTimes: { ...this.state.stepCompletionTimes },
      startedAt: this.state.startedAt,
    };
  }

  /**
   * 从存档数据恢复
   */
  loadSaveData(data: TutorialGuideSaveData): void {
    // FIX-601: null/undefined 防护
    if (!data) {
      this.state.completedSteps = [];
      this.state.skipped = false;
      this.state.stepCompletionTimes = {};
      this.state.startedAt = null;
      return;
    }

    // FIX-602: completedSteps 内容校验，过滤非法 stepId
    const validIds = new Set<string>(TUTORIAL_GUIDE_STEPS.map(s => s.id));
    const rawSteps = Array.isArray(data.completedSteps) ? data.completedSteps : [];
    // FIX-T10 (R2): 去重，防止重复 stepId 导致进度计算错误
    this.state.completedSteps = [...new Set(
      rawSteps.filter((id: string) => validIds.has(id))
    )] as TutorialGuideStepId[];

    this.state.skipped = Boolean(data.skipped);

    // FIX-603: 恢复 stepCompletionTimes 和 startedAt（兼容旧存档）
    if (data.stepCompletionTimes && typeof data.stepCompletionTimes === 'object') {
      // FIX-T08 (R2): 过滤非 finite number 值，防止 NaN/Infinity 污染
      const times: Record<string, number> = {};
      for (const [key, val] of Object.entries(data.stepCompletionTimes)) {
        if (typeof val === 'number' && Number.isFinite(val)) {
          times[key] = val;
        }
      }
      this.state.stepCompletionTimes = times;
    } else {
      this.state.stepCompletionTimes = {};
    }
    // FIX-T09 (R2): startedAt 值合理性校验
    this.state.startedAt =
      typeof data.startedAt === 'number' && Number.isFinite(data.startedAt) && data.startedAt > 0
        ? data.startedAt
        : null;
  }

  // ─── 内部方法 ────────────────────────────

  /** 创建初始状态 */
  private createInitialState(): TutorialGuideInternalState {
    return {
      completedSteps: [],
      skipped: false,
      stepCompletionTimes: {},
      startedAt: null,
    };
  }
}
