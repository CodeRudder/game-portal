/**
 * 引擎层 — 活跃度系统
 *
 * 管理日常活跃度累积和宝箱奖励：
 *   - 活跃度点数累积（完成任务获得）
 *   - 里程碑宝箱（达到阈值领取奖励）
 *   - 每日重置
 *   - 存档序列化
 *
 * 功能覆盖：
 *   #18 活跃度系统
 *
 * @module engine/quest/ActivitySystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { QuestReward, ActivityState, ActivityMilestone } from '../../core/quest';
import { DEFAULT_ACTIVITY_MILESTONES } from '../../core/quest';

// ─────────────────────────────────────────────
// 活跃度系统
// ─────────────────────────────────────────────

/** 活跃度系统存档数据 */
export interface ActivitySaveData {
  version: number;
  activityState: ActivityState;
}

/**
 * 活跃度系统
 *
 * 独立管理活跃度累积和宝箱奖励。
 * 与 QuestSystem 解耦，通过事件监听活跃度变化。
 *
 * @example
 * ```ts
 * const activitySys = new ActivitySystem();
 * activitySys.init(deps);
 *
 * // 添加活跃度
 * activitySys.addPoints(10);
 *
 * // 领取宝箱
 * activitySys.claimMilestone(0);
 *
 * // 每日重置
 * activitySys.resetDaily();
 * ```
 */
export class ActivitySystem implements ISubsystem {
  readonly name = 'activity';

  private deps!: ISystemDeps;
  private state: ActivityState;
  private rewardCallback?: (reward: QuestReward) => void;

  // ─── ISubsystem 接口 ───────────────────────

  constructor() {
    this.state = this.createInitialState();
  }

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 活跃度由事件驱动，无需帧更新
  }

  getState(): { activity: ActivityState } {
    return { activity: this.getActivityState() };
  }

  reset(): void {
    this.state = this.createInitialState();
  }

  // ─── 回调注入 ──────────────────────────────

  /** 设置奖励发放回调 */
  setRewardCallback(cb: (reward: QuestReward) => void): void {
    this.rewardCallback = cb;
  }

  // ─── 活跃度操作 ────────────────────────────

  /**
   * 增加活跃度点数
   *
   * @param points - 增加的点数
   * @returns 增加后的活跃度
   */
  addPoints(points: number): number {
    // P0-002 FIX: NaN/负值防护
    if (!Number.isFinite(points) || points <= 0) return this.state.currentPoints;
    // 防御 currentPoints 已为 NaN
    if (!Number.isFinite(this.state.currentPoints)) this.state.currentPoints = 0;
    this.state.currentPoints = Math.min(
      this.state.currentPoints + points,
      this.state.maxPoints,
    );

    this.deps?.eventBus.emit('quest:activityChanged', {
      current: this.state.currentPoints,
      max: this.state.maxPoints,
    });

    return this.state.currentPoints;
  }

  /**
   * 获取活跃度状态（副本）
   */
  getActivityState(): ActivityState {
    return {
      ...this.state,
      milestones: this.state.milestones.map((m) => ({ ...m })),
    };
  }

  /** 获取当前活跃度点数 */
  getCurrentPoints(): number {
    return this.state.currentPoints;
  }

  /** 获取最大活跃度点数 */
  getMaxPoints(): number {
    return this.state.maxPoints;
  }

  /**
   * 领取活跃度宝箱
   *
   * @param index - 里程碑索引
   * @returns 奖励数据，失败返回 null
   */
  claimMilestone(index: number): QuestReward | null {
    if (index < 0 || index >= this.state.milestones.length) return null;

    const milestone = this.state.milestones[index];
    if (milestone.claimed) return null;
    if (this.state.currentPoints < milestone.points) return null;

    milestone.claimed = true;
    this.rewardCallback?.(milestone.rewards);

    this.deps?.eventBus.emit('quest:activityMilestoneClaimed', {
      index,
      points: milestone.points,
    });

    return milestone.rewards;
  }

  /**
   * 一键领取所有可领取的宝箱
   *
   * @returns 领取的奖励列表
   */
  claimAllMilestones(): QuestReward[] {
    const rewards: QuestReward[] = [];
    for (let i = 0; i < this.state.milestones.length; i++) {
      const reward = this.claimMilestone(i);
      if (reward) rewards.push(reward);
    }
    return rewards;
  }

  /**
   * 检查指定里程碑是否可领取
   */
  isMilestoneClaimable(index: number): boolean {
    if (index < 0 || index >= this.state.milestones.length) return false;
    const m = this.state.milestones[index];
    return !m.claimed && this.state.currentPoints >= m.points;
  }

  /**
   * 获取下一个可领取的里程碑索引
   *
   * @returns 索引，没有则返回 -1
   */
  getNextClaimableIndex(): number {
    for (let i = 0; i < this.state.milestones.length; i++) {
      if (this.isMilestoneClaimable(i)) return i;
    }
    return -1;
  }

  /**
   * 获取活跃度进度百分比
   *
   * @returns 0~1 的比例值
   */
  getProgressRatio(): number {
    if (this.state.maxPoints <= 0) return 0;
    return this.state.currentPoints / this.state.maxPoints;
  }

  /**
   * 每日重置活跃度
   */
  resetDaily(): void {
    this.state.currentPoints = 0;
    this.state.milestones = DEFAULT_ACTIVITY_MILESTONES.map((m) => ({ ...m, claimed: false }));
    this.state.lastResetDate = new Date().toISOString().slice(0, 10);

    this.deps?.eventBus.emit('quest:activityReset', {
      date: this.state.lastResetDate,
    });
  }

  /**
   * 检查并执行每日重置
   *
   * @param currentDate - 当前日期字符串 (YYYY-MM-DD)
   * @returns 是否执行了重置
   */
  checkDailyReset(currentDate: string): boolean {
    if (this.state.lastResetDate === currentDate) return false;
    this.resetDaily();
    return true;
  }

  // ─── 序列化 ────────────────────────────────

  /** 导出存档 */
  serialize(): ActivitySaveData {
    return {
      version: 1,
      activityState: this.getActivityState(),
    };
  }

  /** 导入存档 */
  deserialize(data: ActivitySaveData): void {
    // FIX-Q02: null顶层防护 — 存档损坏时安全回退
    if (!data || !data.activityState) {
      this.state = this.createInitialState();
      return;
    }
    // FIX-Q07: NaN防护 — currentPoints必须为有限数
    if (typeof data.activityState.currentPoints === 'number' && !Number.isFinite(data.activityState.currentPoints)) {
      data.activityState.currentPoints = 0;
    }
    if (typeof data.activityState.maxPoints === 'number' && !Number.isFinite(data.activityState.maxPoints)) {
      data.activityState.maxPoints = 100;
    }
    this.state = {
      ...data.activityState,
      milestones: data.activityState.milestones.map((m) => ({ ...m })),
    };
  }

  // ─── 内部方法 ──────────────────────────────

  /** 创建初始状态 */
  private createInitialState(): ActivityState {
    return {
      currentPoints: 0,
      maxPoints: 100,
      milestones: DEFAULT_ACTIVITY_MILESTONES.map((m) => ({ ...m, claimed: false })),
      lastResetDate: '',
    };
  }
}
