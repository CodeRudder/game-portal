/**
 * 科技域 — 研究系统
 *
 * 职责：研究流程（选择→消耗→等待→完成）、研究队列、加速机制
 * 规则：可引用 TechTreeSystem、TechPointSystem 和 tech.types
 *
 * @module engine/tech/TechResearchSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  ResearchSlot,
  StartResearchResult,
  SpeedUpResult,
  SpeedUpMethod,
  TechSaveData,
} from './tech.types';
import type { TechTreeSystem } from './TechTreeSystem';
import type { TechPointSystem } from './TechPointSystem';
import {
  TECH_NODE_MAP,
  getQueueSizeForAcademyLevel,
  MANDATE_SPEEDUP_SECONDS_PER_POINT,
  INGOT_SPEEDUP_SECONDS_PER_UNIT,
} from './tech-config';

// ─────────────────────────────────────────────
// TechResearchSystem
// ─────────────────────────────────────────────

export class TechResearchSystem implements ISubsystem {
  readonly name = 'tech-research' as const;
  private deps: ISystemDeps | null = null;

  /** 研究队列 */
  private queue: ResearchSlot[];
  /** 依赖的科技树系统 */
  private readonly treeSystem: TechTreeSystem;
  /** 依赖的科技点系统 */
  private readonly pointSystem: TechPointSystem;
  /** 获取当前书院等级的回调 */
  private getAcademyLevel: () => number;
  /** 获取天命数量的回调 */
  private getMandate: () => number;
  /** 消耗天命的回调 */
  private spendMandate: (amount: number) => boolean;

  constructor(
    treeSystem: TechTreeSystem,
    pointSystem: TechPointSystem,
    getAcademyLevel: () => number,
    getMandate: () => number = () => 0,
    spendMandate: (amount: number) => boolean = () => false,
  ) {
    this.treeSystem = treeSystem;
    this.pointSystem = pointSystem;
    this.getAcademyLevel = getAcademyLevel;
    this.getMandate = getMandate;
    this.spendMandate = spendMandate;
    this.queue = [];
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(dt: number): void {
    this.checkCompleted();
  }

  getState(): { queue: ResearchSlot[] } {
    return { queue: [...this.queue] };
  }

  reset(): void {
    this.queue = [];
  }

  // ─────────────────────────────────────────
  // 研究流程
  // ─────────────────────────────────────────

  /** 开始研究 */
  startResearch(techId: string): StartResearchResult {
    // 1. 检查节点存在性
    const def = TECH_NODE_MAP.get(techId);
    if (!def) {
      return { success: false, reason: '科技节点不存在' };
    }

    // 2. 检查是否可研究
    const check = this.treeSystem.canResearch(techId);
    if (!check.can) {
      return { success: false, reason: check.reason };
    }

    // 3. 检查队列是否已满
    const maxQueue = this.getMaxQueueSize();
    if (this.queue.length >= maxQueue) {
      return { success: false, reason: `研究队列已满（${maxQueue}/${maxQueue}）` };
    }

    // 4. 检查是否已在队列中
    if (this.queue.some((s) => s.techId === techId)) {
      return { success: false, reason: '该科技已在研究队列中' };
    }

    // 5. 检查并消耗科技点
    const spendResult = this.pointSystem.trySpend(def.costPoints);
    if (!spendResult.success) {
      return { success: false, reason: spendResult.reason };
    }

    // 6. 计算研究时间（应用研究速度加成）
    const speedMultiplier = this.pointSystem.getResearchSpeedMultiplier();
    const actualTime = def.researchTime / speedMultiplier;

    // 7. 创建研究槽位
    const now = Date.now();
    const slot: ResearchSlot = {
      techId,
      startTime: now,
      endTime: now + actualTime * 1000,
    };

    // 8. 更新节点状态
    this.treeSystem.setResearching(techId, now, slot.endTime);
    this.queue.push(slot);

    // 9. 发出事件
    this.deps?.eventBus.emit('economy:techResearched', {
      techId,
      techName: def.name,
      duration: actualTime,
    });

    return { success: true };
  }

  /** 取消研究（返还科技点） */
  cancelResearch(techId: string): { success: boolean; refundPoints: number } {
    const slotIndex = this.queue.findIndex((s) => s.techId === techId);
    if (slotIndex === -1) {
      return { success: false, refundPoints: 0 };
    }

    const def = TECH_NODE_MAP.get(techId);
    const refundPoints = def?.costPoints ?? 0;

    // 移除队列
    this.queue.splice(slotIndex, 1);

    // 恢复节点状态
    this.treeSystem.cancelResearch(techId);

    // 返还科技点
    this.pointSystem.spend(-refundPoints); // 负数消耗 = 增加
    this.pointSystem.getState(); // 触发状态更新

    return { success: true, refundPoints };
  }

  // ─────────────────────────────────────────
  // 研究队列
  // ─────────────────────────────────────────

  /** 获取研究队列 */
  getQueue(): ResearchSlot[] {
    return [...this.queue];
  }

  /** 获取最大队列大小 */
  getMaxQueueSize(): number {
    return getQueueSizeForAcademyLevel(this.getAcademyLevel());
  }

  /** 获取队列中指定科技的研究进度 */
  getResearchProgress(techId: string): number {
    const slot = this.queue.find((s) => s.techId === techId);
    if (!slot) return 0;

    const now = Date.now();
    const total = slot.endTime - slot.startTime;
    const elapsed = now - slot.startTime;
    return Math.min(1, Math.max(0, elapsed / total));
  }

  /** 获取队列中指定科技的剩余时间（秒） */
  getRemainingTime(techId: string): number {
    const slot = this.queue.find((s) => s.techId === techId);
    if (!slot) return 0;

    const now = Date.now();
    return Math.max(0, (slot.endTime - now) / 1000);
  }

  /** 检查队列中是否有指定科技 */
  isResearching(techId: string): boolean {
    return this.queue.some((s) => s.techId === techId);
  }

  // ─────────────────────────────────────────
  // 加速机制
  // ─────────────────────────────────────────

  /** 加速研究 */
  speedUp(techId: string, method: SpeedUpMethod, amount: number): SpeedUpResult {
    const slotIndex = this.queue.findIndex((s) => s.techId === techId);
    if (slotIndex === -1) {
      return { success: false, cost: 0, timeReduced: 0, completed: false, reason: '未找到研究中的科技' };
    }

    const slot = this.queue[slotIndex];
    const now = Date.now();
    const remaining = slot.endTime - now;

    if (remaining <= 0) {
      // 已完成，触发完成检查
      this.checkCompleted();
      return { success: false, cost: 0, timeReduced: 0, completed: true };
    }

    let timeReduced: number;
    let cost: number;

    switch (method) {
      case 'mandate': {
        // 天命加速：每点天命减少固定秒数
        timeReduced = amount * MANDATE_SPEEDUP_SECONDS_PER_POINT * 1000;
        cost = amount;
        // 检查天命是否足够
        if (this.getMandate() < cost) {
          return {
            success: false,
            cost: 0,
            timeReduced: 0,
            completed: false,
            reason: `天命不足：需要 ${cost}，当前 ${this.getMandate()}`,
          };
        }
        // 消耗天命
        if (!this.spendMandate(cost)) {
          return {
            success: false,
            cost: 0,
            timeReduced: 0,
            completed: false,
            reason: '天命消耗失败',
          };
        }
        break;
      }

      case 'ingot': {
        // 元宝加速：立即完成，计算所需元宝数
        const requiredUnits = Math.ceil(remaining / (INGOT_SPEEDUP_SECONDS_PER_UNIT * 1000));
        cost = requiredUnits;
        timeReduced = remaining;
        // 元宝消耗逻辑（预留，暂用天命替代标记）
        // 实际项目中应接入元宝系统
        break;
      }

      default:
        return { success: false, cost: 0, timeReduced: 0, completed: false, reason: '未知加速方式' };
    }

    // 更新完成时间
    const newEndTime = slot.endTime - timeReduced;
    this.queue[slotIndex] = {
      ...slot,
      endTime: Math.max(newEndTime, now),
    };

    // 检查是否完成
    const completed = this.queue[slotIndex].endTime <= now;
    if (completed) {
      this.checkCompleted();
    }

    return {
      success: true,
      cost,
      timeReduced: timeReduced / 1000,
      completed,
    };
  }

  /** 计算元宝加速所需数量 */
  calculateIngotCost(techId: string): number {
    const slot = this.queue.find((s) => s.techId === techId);
    if (!slot) return 0;
    const remaining = slot.endTime - Date.now();
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / (INGOT_SPEEDUP_SECONDS_PER_UNIT * 1000));
  }

  /** 计算天命加速所需数量（加速完成） */
  calculateMandateCost(techId: string): number {
    const slot = this.queue.find((s) => s.techId === techId);
    if (!slot) return 0;
    const remaining = slot.endTime - Date.now();
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / (MANDATE_SPEEDUP_SECONDS_PER_POINT * 1000));
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /** 检查并处理已完成的研究 */
  private checkCompleted(): void {
    const now = Date.now();
    const completedIds: string[] = [];

    for (let i = this.queue.length - 1; i >= 0; i--) {
      const slot = this.queue[i];
      if (slot.endTime <= now) {
        completedIds.push(slot.techId);
        this.queue.splice(i, 1);
      }
    }

    // 通知科技树完成
    for (const techId of completedIds) {
      this.treeSystem.completeNode(techId);
    }
  }

  // ─────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────

  /** 序列化 */
  serialize(): Pick<TechSaveData, 'activeResearch'> {
    return {
      activeResearch: this.queue.length > 0 ? { ...this.queue[0] } : null,
    };
  }

  /** 反序列化 */
  deserialize(data: Pick<TechSaveData, 'activeResearch'>): void {
    this.queue = [];
    if (data.activeResearch) {
      const slot = data.activeResearch;
      this.queue.push({ ...slot });
      // 恢复节点状态
      this.treeSystem.setResearching(slot.techId, slot.startTime, slot.endTime);
    }
  }
}
