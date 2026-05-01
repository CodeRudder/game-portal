/**
 * 引擎层 — 任务活跃度管理器
 *
 * 从 QuestSystem.ts 拆分出的活跃度系统。
 * 职责：活跃度点数增减、里程碑宝箱领取、每日重置
 *
 * @module engine/quest/QuestActivityManager
 */

import type { ActivityState, ActivityMilestone, QuestReward as QR } from '../../core/quest';
import { DEFAULT_ACTIVITY_MILESTONES } from '../../core/quest';

/** 最大活跃度点数 */
export const MAX_ACTIVITY_POINTS = 100;

/**
 * 任务活跃度管理器
 *
 * 管理活跃度点数的增减、里程碑宝箱的领取状态和每日重置。
 * 由 QuestSystem 持有并委托调用。
 */
export class QuestActivityManager {
  private state: ActivityState;

  constructor() {
    this.state = {
      currentPoints: 0,
      maxPoints: MAX_ACTIVITY_POINTS,
      milestones: DEFAULT_ACTIVITY_MILESTONES.map((m) => ({ ...m })),
      lastResetDate: '',
    };
  }

  // ─── 查询 ──────────────────────────────────

  /** 获取活跃度状态（返回副本） */
  getState(): ActivityState {
    return {
      currentPoints: this.state.currentPoints,
      maxPoints: this.state.maxPoints,
      milestones: this.state.milestones.map((m) => ({ ...m })),
      lastResetDate: this.state.lastResetDate,
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

  /** 获取里程碑列表（副本） */
  getMilestones(): ActivityMilestone[] {
    return this.state.milestones.map((m) => ({ ...m }));
  }

  // ─── 变更 ──────────────────────────────────

  /** 增加活跃度（不超过最大值） */
  addPoints(points: number): void {
    // P0-003 FIX: NaN/负值防护（P0-002 的对称函数）
    if (!Number.isFinite(points) || points <= 0) return;
    if (!Number.isFinite(this.state.currentPoints)) this.state.currentPoints = 0;
    this.state.currentPoints = Math.min(
      this.state.currentPoints + points,
      this.state.maxPoints,
    );
  }

  /** 领取活跃度里程碑宝箱 */
  claimMilestone(index: number): QR | null {
    const milestone = this.state.milestones[index];
    if (!milestone) return null;
    if (this.state.currentPoints < milestone.points) return null;
    if (milestone.claimed) return null;

    milestone.claimed = true;
    return milestone.rewards;
  }

  /** 重置每日活跃度 */
  resetDaily(): void {
    this.state.currentPoints = 0;
    this.state.lastResetDate = new Date().toISOString().slice(0, 10);
    this.state.milestones = DEFAULT_ACTIVITY_MILESTONES.map((m) => ({ ...m }));
  }

  /** 完全重置 */
  fullReset(): void {
    this.state = {
      currentPoints: 0,
      maxPoints: MAX_ACTIVITY_POINTS,
      milestones: DEFAULT_ACTIVITY_MILESTONES.map((m) => ({ ...m })),
      lastResetDate: '',
    };
  }

  // ─── 序列化辅助 ─────────────────────────────

  /** 从外部恢复状态 */
  restoreState(state: ActivityState): void {
    this.state = {
      currentPoints: state.currentPoints,
      maxPoints: state.maxPoints,
      milestones: state.milestones.map((m) => ({ ...m })),
      lastResetDate: state.lastResetDate,
    };
  }
}
