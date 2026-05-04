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
  COPPER_SPEEDUP_COST,
  COPPER_SPEEDUP_PROGRESS_PERCENT,
  COPPER_SPEEDUP_MAX_DAILY,
  RESEARCH_START_COPPER_COST,
  RESEARCH_START_TECH_POINT_MULTIPLIER,
  getMaxResearchableTechCount,
  getAcademyResearchSpeedMultiplier,
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
  /** 获取铜钱数量的回调（Sprint 3） */
  private getGold: () => number;
  /** 消耗铜钱的回调（Sprint 3） */
  private spendGold: (amount: number) => boolean;
  /** 今日铜钱加速已用次数（Sprint 3） */
  private copperSpeedUpCount: number;
  /** 上次铜钱加速重置日期（YYYY-MM-DD） */
  private lastCopperSpeedUpDate: string;

  constructor(
    treeSystem: TechTreeSystem,
    pointSystem: TechPointSystem,
    getAcademyLevel: () => number,
    getMandate: () => number = () => 0,
    spendMandate: (amount: number) => boolean = () => false,
    getGold: () => number = () => 0,
    spendGold: (amount: number) => boolean = () => false,
  ) {
    this.treeSystem = treeSystem;
    this.pointSystem = pointSystem;
    this.getAcademyLevel = getAcademyLevel;
    this.getMandate = getMandate;
    this.spendMandate = spendMandate;
    this.getGold = getGold;
    this.spendGold = spendGold;
    this.queue = [];
    this.copperSpeedUpCount = 0;
    this.lastCopperSpeedUpDate = '';
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
    this.copperSpeedUpCount = 0;
    this.lastCopperSpeedUpDate = '';
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

    // 5. Sprint 3: 检查可研究科技上限（XI-005）
    const academyLevel = this.getAcademyLevel();
    const maxTechCount = getMaxResearchableTechCount(academyLevel);
    const completedCount = this.treeSystem.getAllNodeDefs().filter(
      (nd) => this.treeSystem.getNodeState(nd.id)?.status === 'completed'
    ).length;
    const researchingCount = this.queue.length;
    if (completedCount + researchingCount >= maxTechCount) {
      return { success: false, reason: `可研究科技上限已满（${maxTechCount}），请提升书院等级` };
    }

    // 6. 检查并消耗科技点（Sprint 3: techPoint × RESEARCH_START_TECH_POINT_MULTIPLIER）
    const techPointCost = def.costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER;
    const spendResult = this.pointSystem.trySpend(techPointCost);
    if (!spendResult.success) {
      return { success: false, reason: spendResult.reason };
    }

    // 7. Sprint 3: 消耗铜钱（RESEARCH_START_COPPER_COST）
    if (this.getGold() < RESEARCH_START_COPPER_COST) {
      // 返还科技点
      this.pointSystem.refund(techPointCost);
      return { success: false, reason: `铜钱不足：需要 ${RESEARCH_START_COPPER_COST}` };
    }
    if (!this.spendGold(RESEARCH_START_COPPER_COST)) {
      // 返还科技点
      this.pointSystem.refund(techPointCost);
      return { success: false, reason: '铜钱消耗失败' };
    }

    // 8. 计算研究时间（应用研究速度加成 + 书院等级加成）
    const speedMultiplier = this.pointSystem.getResearchSpeedMultiplier();
    const academySpeedMultiplier = getAcademyResearchSpeedMultiplier(academyLevel);
    const totalSpeedMultiplier = speedMultiplier * academySpeedMultiplier;
    // FIX-501: NaN/除零防护
    if (!Number.isFinite(totalSpeedMultiplier) || totalSpeedMultiplier <= 0) {
      // 返还资源
      this.pointSystem.refund(techPointCost);
      return { success: false, reason: '研究速度异常' };
    }
    const actualTime = def.researchTime / totalSpeedMultiplier;

    // 9. 创建研究槽位
    const now = Date.now();
    const slot: ResearchSlot = {
      techId,
      startTime: now,
      endTime: now + actualTime * 1000,
    };

    // 10. 更新节点状态
    this.treeSystem.setResearching(techId, now, slot.endTime);
    this.queue.push(slot);

    // 11. 发出事件
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
    // Sprint 3: 返还科技点按消耗的倍率计算
    const refundPoints = def ? def.costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER : 0;

    // 移除队列
    this.queue.splice(slotIndex, 1);

    // 恢复节点状态
    this.treeSystem.cancelResearch(techId);

    // 返还科技点
    this.pointSystem.refund(refundPoints);
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
    // FIX-501: NaN/负值防护
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, cost: 0, timeReduced: 0, completed: false, reason: '加速数量无效' };
    }
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

      case 'copper': {
        // Sprint 3: 铜钱加速 — 消耗铜钱×1000，进度+10%
        // 检查每日次数上限
        this.resetCopperSpeedUpIfNeeded();
        if (this.copperSpeedUpCount >= COPPER_SPEEDUP_MAX_DAILY) {
          return {
            success: false,
            cost: 0,
            timeReduced: 0,
            completed: false,
            reason: `今日铜钱加速次数已用完（${COPPER_SPEEDUP_MAX_DAILY}次）`,
          };
        }
        // 检查铜钱是否足够
        if (this.getGold() < COPPER_SPEEDUP_COST) {
          return {
            success: false,
            cost: 0,
            timeReduced: 0,
            completed: false,
            reason: `铜钱不足：需要 ${COPPER_SPEEDUP_COST}，当前 ${this.getGold()}`,
          };
        }
        // 消耗铜钱
        if (!this.spendGold(COPPER_SPEEDUP_COST)) {
          return {
            success: false,
            cost: 0,
            timeReduced: 0,
            completed: false,
            reason: '铜钱消耗失败',
          };
        }
        // 计算加速时间：进度+10% = 总时间×10%
        const totalDuration = slot.endTime - slot.startTime;
        timeReduced = totalDuration * (COPPER_SPEEDUP_PROGRESS_PERCENT / 100);
        cost = COPPER_SPEEDUP_COST;
        this.copperSpeedUpCount++;
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
  // Sprint 3: 铜钱加速接口
  // ─────────────────────────────────────────

  /** 获取今日铜钱加速已用次数 */
  getCopperSpeedUpCount(): number {
    this.resetCopperSpeedUpIfNeeded();
    return this.copperSpeedUpCount;
  }

  /** 获取今日铜钱加速剩余次数 */
  getCopperSpeedUpRemaining(): number {
    return COPPER_SPEEDUP_MAX_DAILY - this.getCopperSpeedUpCount();
  }

  /** 获取铜钱加速每次消耗 */
  getCopperSpeedUpCost(): number {
    return COPPER_SPEEDUP_COST;
  }

  /** 获取铜钱加速每次进度增量百分比 */
  getCopperSpeedUpProgressPercent(): number {
    return COPPER_SPEEDUP_PROGRESS_PERCENT;
  }

  /** 获取铜钱加速每日上限 */
  getCopperSpeedUpMaxDaily(): number {
    return COPPER_SPEEDUP_MAX_DAILY;
  }

  /** 获取可研究科技上限 */
  getMaxResearchableTechCount(): number {
    return getMaxResearchableTechCount(this.getAcademyLevel());
  }

  /** 获取书院研究速度加成倍率 */
  getAcademyResearchSpeedMultiplier(): number {
    return getAcademyResearchSpeedMultiplier(this.getAcademyLevel());
  }

  /** 检查日期并重置铜钱加速次数 */
  private resetCopperSpeedUpIfNeeded(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.lastCopperSpeedUpDate !== today) {
      this.copperSpeedUpCount = 0;
      this.lastCopperSpeedUpDate = today;
    }
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

  /** 序列化（保存整个研究队列） */
  serialize(): Pick<TechSaveData, 'activeResearch'> & { researchQueue: ResearchSlot[] } {
    return {
      activeResearch: this.queue.length > 0 ? { ...this.queue[0] } : null,
      researchQueue: this.queue.map(slot => ({ ...slot })),
    };
  }

  /** 反序列化（恢复整个研究队列） */
  deserialize(data: Pick<TechSaveData, 'activeResearch'> & { researchQueue?: ResearchSlot[] }): void {
    this.queue = [];
    // 优先使用完整的队列数据
    const queueData = data.researchQueue;
    if (queueData && queueData.length > 0) {
      for (const slot of queueData) {
        this.queue.push({ ...slot });
        this.treeSystem.setResearching(slot.techId, slot.startTime, slot.endTime);
      }
    } else if (data.activeResearch) {
      // 兼容旧存档：只有单个 activeResearch
      const slot = data.activeResearch;
      this.queue.push({ ...slot });
      this.treeSystem.setResearching(slot.techId, slot.startTime, slot.endTime);
    }
  }
}
