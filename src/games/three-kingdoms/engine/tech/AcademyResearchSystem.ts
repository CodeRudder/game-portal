/**
 * 科技域 — 书院研究系统门面（Facade）
 *
 * Sprint 3 核心门面层：
 * - 组合 TechResearchSystem + TechPointSystem + TechTreeSystem +
 *   TechDetailProvider + TechEffectSystem + AcademyResearchManager
 * - 对外暴露统一的书院研究 API
 * - 内部委托到各子系统，门面层只做参数转换和结果聚合
 *
 * 设计说明：
 * - 门面持有自己的 academyLevel，通过 syncAcademyLevel 同步
 * - 研究队列由门面自行管理，使用门面的 academyLevel 计算队列大小、科技上限、研究速度
 * - 科技点消耗/返还委托 TechPointSystem
 * - 节点状态管理委托 TechTreeSystem
 *
 * @module engine/tech/AcademyResearchSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { TechTreeSystem } from './TechTreeSystem';
import type { TechPointSystem } from './TechPointSystem';
import type { TechEffectSystem } from './TechEffectSystem';
import type { TechDetailProvider } from './TechDetailProvider';
import type { TechDetail } from './TechDetailProvider';
import type {
  ResearchSlot,
  StartResearchResult,
  TechPath,
  TechNodeDef,
  TechEffect,
  TechEffectType,
} from './tech.types';
import { TECH_NODE_DEFS, TECH_EDGES, TECH_NODE_MAP } from './tech-config';
import {
  COPPER_SPEEDUP_COST,
  INGOT_SPEEDUP_SECONDS_PER_UNIT,
  RESEARCH_START_TECH_POINT_MULTIPLIER,
  RESEARCH_START_COPPER_COST,
  getQueueSizeForAcademyLevel,
  getMaxResearchableTechCount,
  getAcademyResearchSpeedMultiplier,
} from './tech-config';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 铜钱加速结果 */
export interface CopperSpeedUpResult {
  /** 是否成功 */
  success: boolean;
  /** 减少的时间（毫秒） */
  timeReduced: number;
  /** 剩余铜钱加速次数 */
  remainingCopperSpeedUps: number;
  /** 失败原因 */
  reason?: string;
}

/** 元宝秒完成结果 */
export interface IngotInstantResult {
  /** 是否成功 */
  success: boolean;
  /** 是否已完成 */
  completed: boolean;
  /** 元宝消耗 */
  ingotCost: number;
  /** 失败原因 */
  reason?: string;
}

/** 科技树预览节点 */
export interface TechPreviewNode {
  /** 节点 ID */
  id: string;
  /** 节点名称 */
  name: string;
  /** 节点描述 */
  description: string;
  /** 图标 */
  icon: string;
  /** 所属路线 */
  path: string;
  /** 层级 */
  tier: number;
  /** 当前状态 */
  status: string;
  /** 前置条件 */
  prerequisites: Array<{ id: string; name: string; completed: boolean }>;
  /** 效果预览 */
  effects: Array<{ type: string; target: string; value: number; description: string }>;
  /** 消耗科技点 */
  costPoints: number;
  /** 研究时间（秒） */
  researchTime: number;
  /** 铜钱加速已用次数 */
  copperSpeedUpCount: number;
}

/** 路线统计 */
export interface PathStats {
  /** 总节点数 */
  total: number;
  /** 已完成数 */
  completed: number;
  /** 研究中数 */
  researching: number;
  /** 可用数 */
  available: number;
  /** 锁定数 */
  locked: number;
}

/** 科技树预览 */
export interface TechTreePreview {
  /** 所有节点 */
  nodes: TechPreviewNode[];
  /** 所有边 */
  edges: Array<{ from: string; to: string }>;
  /** 路线统计 */
  pathStats: Record<string, PathStats>;
  /** 推荐科技 ID */
  recommendedIds: string[];
}

/** 建筑加成注入数据（科技完成→建筑系统） */
export interface BuildingBonusInjection {
  /** 触发科技 ID */
  techId: string;
  /** 科技名称 */
  techName: string;
  /** 效果列表 */
  effects: Array<{
    type: TechEffectType;
    target: string;
    value: number;
  }>;
  /** 受影响的建筑类型 */
  affectedBuildingTypes: string[];
}

/** 书院研究系统状态 */
export interface AcademyResearchState {
  /** 每个科技已用铜钱加速次数 */
  copperSpeedUpCounts: Record<string, number>;
  /** 累计元宝加速次数 */
  totalIngotSpeedUpCount: number;
}

/** 序列化数据 */
export interface AcademyResearchSaveData extends AcademyResearchState {}

// ─────────────────────────────────────────────
// 建筑类型映射（科技效果→受影响建筑）
// ─────────────────────────────────────────────

/** 资源类型→建筑类型映射 */
const RESOURCE_TO_BUILDING: Record<string, string[]> = {
  grain: ['farmland'],
  gold: ['market'],
  troops: ['barracks'],
  all: ['farmland', 'market', 'barracks', 'workshop', 'clinic'],
};

/** 铜钱加速每科技上限 */
const COPPER_SPEEDUP_MAX_PER_TECH = 3;

// ─────────────────────────────────────────────
// AcademyResearchSystem（Facade）
// ─────────────────────────────────────────────

export class AcademyResearchSystem implements ISubsystem {
  readonly name = 'academy-research' as const;
  private deps: ISystemDeps | null = null;

  // ── 子系统引用 ──
  private readonly treeSys: TechTreeSystem;
  private readonly pointSys: TechPointSystem;

  // ── 资源回调 ──
  private readonly getCopper: () => number;
  private readonly spendCopper: (amount: number) => boolean;
  private readonly getIngot: () => number;
  private readonly spendIngot: (amount: number) => boolean;

  // ── 可选子系统引用 ──
  private techEffectSys: TechEffectSystem | null = null;
  private detailProvider: TechDetailProvider | null = null;

  // ── 回调 ──
  private buildingBonusCallback: ((injection: BuildingBonusInjection) => void) | null = null;

  // ── 门面自有状态 ──
  /** 研究队列（门面自行管理） */
  private queue: ResearchSlot[];
  /** 每个科技已用铜钱加速次数（per tech，最多3次） */
  private copperSpeedUpCounts: Record<string, number>;
  /** 累计元宝加速次数 */
  private totalIngotSpeedUpCount: number;
  /** 当前书院等级 */
  private academyLevel: number;

  constructor(
    _researchSys: unknown,
    treeSys: TechTreeSystem,
    pointSys: TechPointSystem,
    getCopper: () => number,
    spendCopper: (amount: number) => boolean,
    getIngot: () => number,
    spendIngot: (amount: number) => boolean,
  ) {
    this.treeSys = treeSys;
    this.pointSys = pointSys;
    this.getCopper = getCopper;
    this.spendCopper = spendCopper;
    this.getIngot = getIngot;
    this.spendIngot = spendIngot;

    this.queue = [];
    this.copperSpeedUpCounts = {};
    this.totalIngotSpeedUpCount = 0;
    this.academyLevel = 0;
  }

  // ─────────────────────────────────────────
  // ISubsystem 接口
  // ─────────────────────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 门面层不自行 tick
  }

  getState(): AcademyResearchState {
    return {
      copperSpeedUpCounts: { ...this.copperSpeedUpCounts },
      totalIngotSpeedUpCount: this.totalIngotSpeedUpCount,
    };
  }

  reset(): void {
    this.queue = [];
    this.copperSpeedUpCounts = {};
    this.totalIngotSpeedUpCount = 0;
    this.academyLevel = 0;
  }

  // ─────────────────────────────────────────
  // 依赖注入
  // ─────────────────────────────────────────

  /** 注入科技效果系统 */
  setTechEffectSystem(sys: TechEffectSystem): void {
    this.techEffectSys = sys;
  }

  /** 注入建筑加成回调 */
  setBuildingBonusCallback(cb: (injection: BuildingBonusInjection) => void): void {
    this.buildingBonusCallback = cb;
  }

  // ─────────────────────────────────────────
  // 研究队列管理
  // ─────────────────────────────────────────

  /**
   * 启动研究
   * 使用门面自有的 academyLevel 计算队列大小、科技上限、研究速度
   */
  startResearch(techId: string): StartResearchResult {
    // 1. 检查节点存在性
    const def = TECH_NODE_MAP.get(techId);
    if (!def) {
      return { success: false, reason: '科技节点不存在' };
    }

    // 2. 检查是否可研究（前置条件、互斥等）
    const check = this.treeSys.canResearch(techId);
    if (!check.can) {
      return { success: false, reason: check.reason };
    }

    // 3. 检查队列是否已满（使用门面的 academyLevel）
    const maxQueue = getQueueSizeForAcademyLevel(this.academyLevel);
    if (this.queue.length >= maxQueue) {
      return { success: false, reason: `研究队列已满（${maxQueue}/${maxQueue}）` };
    }

    // 4. 检查是否已在队列中
    if (this.queue.some(s => s.techId === techId)) {
      return { success: false, reason: '该科技已在研究队列中' };
    }

    // 5. 检查可研究科技上限（使用门面的 academyLevel）
    if (this.academyLevel > 0) {
      const maxTechCount = getMaxResearchableTechCount(this.academyLevel);
      const completedCount = this.treeSys.getAllNodeDefs().filter(
        nd => this.treeSys.getNodeState(nd.id)?.status === 'completed',
      ).length;
      const researchingCount = this.queue.length;
      if (completedCount + researchingCount >= maxTechCount) {
        return { success: false, reason: `可研究科技上限已满（${maxTechCount}），请提升书院等级` };
      }
    }

    // 6. 检查并消耗科技点（costPoints × RESEARCH_START_TECH_POINT_MULTIPLIER）
    const techPointCost = def.costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER;
    const spendResult = this.pointSys.trySpend(techPointCost);
    if (!spendResult.success) {
      return { success: false, reason: spendResult.reason };
    }

    // 7. 消耗铜钱（RESEARCH_START_COPPER_COST）
    if (this.getCopper() < RESEARCH_START_COPPER_COST) {
      this.pointSys.refund(techPointCost);
      return { success: false, reason: `铜钱不足：需要 ${RESEARCH_START_COPPER_COST}` };
    }
    if (!this.spendCopper(RESEARCH_START_COPPER_COST)) {
      this.pointSys.refund(techPointCost);
      return { success: false, reason: '铜钱消耗失败' };
    }

    // 8. 计算研究时间（使用门面的 academyLevel）
    const speedMultiplier = this.pointSys.getResearchSpeedMultiplier();
    const academySpeedMultiplier = getAcademyResearchSpeedMultiplier(this.academyLevel);
    const totalSpeedMultiplier = speedMultiplier * academySpeedMultiplier;
    if (!Number.isFinite(totalSpeedMultiplier) || totalSpeedMultiplier <= 0) {
      this.pointSys.refund(techPointCost);
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

    // 10. 更新节点状态为 researching
    this.treeSys.setResearching(techId, now, slot.endTime);
    this.queue.push(slot);

    // 11. 发出事件
    this.deps?.eventBus.emit('economy:techResearched', {
      techId,
      techName: def.name,
      duration: actualTime,
    });

    return { success: true };
  }

  /**
   * 取消研究，返还科技点
   */
  cancelResearch(techId: string): { success: boolean; refundPoints: number } {
    const slotIndex = this.queue.findIndex(s => s.techId === techId);
    if (slotIndex === -1) {
      return { success: false, refundPoints: 0 };
    }

    const def = TECH_NODE_MAP.get(techId);
    const refundPoints = def ? def.costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER : 0;

    // 移除队列
    this.queue.splice(slotIndex, 1);

    // 恢复节点状态
    this.treeSys.cancelResearch(techId);

    // 返还科技点
    this.pointSys.refund(refundPoints);

    // 清除该科技的铜钱加速计数
    delete this.copperSpeedUpCounts[techId];

    return { success: true, refundPoints };
  }

  /**
   * tick 推进研究进度
   * 检查已完成的研究，触发加成回流
   * @param _deltaMs - 距上次 tick 的毫秒数（仅触发完成检查）
   * @returns 本次完成的科技 ID 列表
   */
  tickResearch(_deltaMs: number): string[] {
    // NaN/负值防护 — 仍然执行完成检查
    const now = Date.now();
    const completedIds: string[] = [];

    // 从后往前遍历，安全删除
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const slot = this.queue[i];
      if (slot.endTime <= now) {
        completedIds.push(slot.techId);
        this.queue.splice(i, 1);
      }
    }

    // 通知科技树完成
    for (const techId of completedIds) {
      this.treeSys.completeNode(techId);
      this.notifyTechCompleted(techId);
    }

    // 刷新效果系统缓存
    if (completedIds.length > 0 && this.techEffectSys) {
      this.techEffectSys.invalidateCache();
    }

    return completedIds;
  }

  /**
   * 获取当前研究队列
   */
  getQueue(): ResearchSlot[] {
    return [...this.queue];
  }

  /**
   * 获取研究进度 (0-1)
   */
  getResearchProgress(techId: string): number {
    const slot = this.queue.find(s => s.techId === techId);
    if (!slot) return 0;

    const now = Date.now();
    const total = slot.endTime - slot.startTime;
    if (total <= 0) return 1;
    const elapsed = now - slot.startTime;
    return Math.min(1, Math.max(0, elapsed / total));
  }

  /**
   * 获取剩余时间（毫秒）
   */
  getRemainingTime(techId: string): number {
    const slot = this.queue.find(s => s.techId === techId);
    if (!slot) return 0;

    const now = Date.now();
    return Math.max(0, slot.endTime - now);
  }

  // ─────────────────────────────────────────
  // 加速系统
  // ─────────────────────────────────────────

  /**
   * 铜钱加速：减少 30% 剩余时间，每个科技最多叠加 3 次
   * 费用递增：基础费用 × (已用次数 + 1)
   */
  copperSpeedUp(techId: string): CopperSpeedUpResult {
    // 检查科技是否在队列中
    const slotIndex = this.queue.findIndex(s => s.techId === techId);
    if (slotIndex === -1) {
      return { success: false, timeReduced: 0, remainingCopperSpeedUps: 0, reason: '科技不在研究队列中' };
    }

    const slot = this.queue[slotIndex];

    // 检查铜钱加速次数上限（per tech，最多3次）
    const usedCount = this.copperSpeedUpCounts[techId] ?? 0;
    if (usedCount >= COPPER_SPEEDUP_MAX_PER_TECH) {
      return {
        success: false,
        timeReduced: 0,
        remainingCopperSpeedUps: 0,
        reason: '铜钱加速次数已达上限',
      };
    }

    // 计算费用（递增：基础费用 × (已用次数 + 1)）
    const cost = COPPER_SPEEDUP_COST * (usedCount + 1);

    // 检查铜钱是否足够
    if (this.getCopper() < cost) {
      return {
        success: false,
        timeReduced: 0,
        remainingCopperSpeedUps: COPPER_SPEEDUP_MAX_PER_TECH - usedCount,
        reason: '铜钱不足',
      };
    }

    // 计算减少的时间（当前剩余时间的 30%）
    const now = Date.now();
    const remainingMs = Math.max(0, slot.endTime - now);
    const timeReducedMs = remainingMs * 0.3;

    // 消耗铜钱
    if (!this.spendCopper(cost)) {
      return {
        success: false,
        timeReduced: 0,
        remainingCopperSpeedUps: COPPER_SPEEDUP_MAX_PER_TECH - usedCount,
        reason: '铜钱消耗失败',
      };
    }

    // 更新加速计数
    this.copperSpeedUpCounts[techId] = usedCount + 1;

    // 更新研究槽位的 endTime
    const newEndTime = Math.max(slot.endTime - timeReducedMs, now);
    this.queue[slotIndex] = { ...slot, endTime: newEndTime };

    // 检查是否完成
    if (newEndTime <= now) {
      this.tickResearch(0);
    }

    return {
      success: true,
      timeReduced: timeReducedMs,
      remainingCopperSpeedUps: COPPER_SPEEDUP_MAX_PER_TECH - usedCount - 1,
    };
  }

  /**
   * 元宝立即完成
   * 费用 = 剩余秒数 / INGOT_SPEEDUP_SECONDS_PER_UNIT
   */
  ingotInstantComplete(techId: string): IngotInstantResult {
    // 检查科技是否在队列中
    const slotIndex = this.queue.findIndex(s => s.techId === techId);
    if (slotIndex === -1) {
      return { success: false, completed: false, ingotCost: 0, reason: '科技不在研究队列中' };
    }

    const slot = this.queue[slotIndex];

    // 计算元宝费用
    const now = Date.now();
    const remainingMs = Math.max(0, slot.endTime - now);
    const remainingSec = remainingMs / 1000;
    const ingotCost = Math.max(1, Math.ceil(remainingSec / INGOT_SPEEDUP_SECONDS_PER_UNIT));

    // 检查元宝是否足够
    if (this.getIngot() < ingotCost) {
      return { success: false, completed: false, ingotCost, reason: '元宝不足' };
    }

    // 消耗元宝
    if (!this.spendIngot(ingotCost)) {
      return { success: false, completed: false, ingotCost, reason: '元宝消耗失败' };
    }

    // 更新计数
    this.totalIngotSpeedUpCount++;

    // 直接完成：将 endTime 设为 now
    this.queue[slotIndex] = { ...slot, endTime: now };

    // 触发完成处理
    const completed = this.tickResearch(0);

    return {
      success: true,
      completed: completed.includes(techId),
      ingotCost,
    };
  }

  /**
   * 获取铜钱加速消耗
   * 返回递增费用和当前已用次数
   */
  getCopperSpeedUpCost(techId: string): { cost: number; usedCount: number } {
    const usedCount = this.copperSpeedUpCounts[techId] ?? 0;
    return {
      cost: COPPER_SPEEDUP_COST * (usedCount + 1),
      usedCount,
    };
  }

  // ─────────────────────────────────────────
  // 科技点管理
  // ─────────────────────────────────────────

  /**
   * tick 科技点产出
   * 委托 TechPointSystem.update，直接传递 deltaMs 作为 dt（秒）
   */
  tickTechPoints(deltaMs: number): void {
    // NaN/负值/零值防护
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    this.pointSys.update(deltaMs);
  }

  /**
   * 获取科技点产出速率（每秒）
   */
  getTechPointProductionRate(): number {
    return this.pointSys.getProductionRate();
  }

  /**
   * 获取当前科技点数
   */
  getCurrentTechPoints(): number {
    return this.pointSys.getCurrentPoints();
  }

  // ─────────────────────────────────────────
  // 科技树预览
  // ─────────────────────────────────────────

  /**
   * 获取科技树预览数据
   * 聚合 TechTreeSystem 节点状态 + 效果描述
   */
  getTechTreePreview(): TechTreePreview {
    const nodes: TechPreviewNode[] = [];
    const pathStatsMap: Record<string, PathStats> = {
      military: { total: 0, completed: 0, researching: 0, available: 0, locked: 0 },
      economy: { total: 0, completed: 0, researching: 0, available: 0, locked: 0 },
      culture: { total: 0, completed: 0, researching: 0, available: 0, locked: 0 },
    };

    const recommendedIds: string[] = [];

    for (const def of TECH_NODE_DEFS) {
      const state = this.treeSys.getNodeState(def.id);
      const status = state?.status ?? 'locked';
      const copperCount = this.copperSpeedUpCounts[def.id] ?? 0;

      // 构建前置条件
      const prerequisites = def.prerequisites.map(preId => {
        const preDef = TECH_NODE_MAP.get(preId);
        const preState = this.treeSys.getNodeState(preId);
        return {
          id: preId,
          name: preDef?.name ?? preId,
          completed: preState?.status === 'completed',
        };
      });

      // 构建效果预览
      const effects = def.effects.map(eff => ({
        type: eff.type,
        target: eff.target,
        value: eff.value,
        description: this.describeEffect(eff),
      }));

      const node: TechPreviewNode = {
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        path: def.path,
        tier: def.tier,
        status,
        prerequisites,
        effects,
        costPoints: def.costPoints,
        researchTime: def.researchTime,
        copperSpeedUpCount: copperCount,
      };
      nodes.push(node);

      // 更新路线统计
      const stats = pathStatsMap[def.path];
      if (stats) {
        stats.total++;
        switch (status) {
          case 'completed': stats.completed++; break;
          case 'researching': stats.researching++; break;
          case 'available': stats.available++; break;
          default: stats.locked++; break;
        }
      }

      // 推荐逻辑：经济路线低层级科技被推荐
      if (def.path === 'economy' && def.tier <= 1 && status === 'available') {
        recommendedIds.push(def.id);
      }
    }

    // 构建边
    const edges = TECH_EDGES.map(e => ({ from: e.from, to: e.to }));

    return { nodes, edges, pathStats: pathStatsMap, recommendedIds };
  }

  /**
   * 获取指定路线的科技预览
   */
  getPathPreview(path: TechPath): TechPreviewNode[] {
    const preview = this.getTechTreePreview();
    return preview.nodes.filter(n => n.path === path);
  }

  /**
   * 获取单个科技详情预览
   * 委托 TechDetailProvider，降级使用节点定义
   */
  getTechDetailPreview(techId: string): TechDetail | null {
    if (this.detailProvider) {
      return this.detailProvider.getTechDetail(techId);
    }
    // 降级：从节点定义中构建详情
    const def = TECH_NODE_MAP.get(techId);
    if (!def) return null;

    const state = this.treeSys.getNodeState(techId);
    const status = state?.status ?? 'locked';

    return {
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      path: def.path,
      pathLabel: '',
      pathColor: '',
      tier: def.tier,
      isFusion: false,
      status,
      effects: def.effects.map(eff => ({
        type: eff.type,
        target: eff.target,
        value: eff.value,
        description: this.describeEffect(eff),
      })),
      prerequisites: def.prerequisites.map(preId => {
        const preDef = TECH_NODE_MAP.get(preId);
        const preState = this.treeSys.getNodeState(preId);
        return {
          id: preId,
          name: preDef?.name ?? preId,
          completed: preState?.status === 'completed',
          path: preDef?.path ?? '',
          pathLabel: '',
        };
      }),
      cost: {
        type: 'tech_points',
        typeLabel: '科技点',
        amount: def.costPoints,
        current: this.pointSys.getCurrentPoints(),
        sufficient: this.pointSys.getCurrentPoints() >= def.costPoints,
      },
      researchTime: {
        baseTime: def.researchTime,
        actualTime: def.researchTime,
        speedBonus: 0,
        formattedBase: `${def.researchTime}秒`,
        formattedActual: `${def.researchTime}秒`,
      },
      linkEffects: [],
    };
  }

  // ─────────────────────────────────────────
  // 加成回流
  // ─────────────────────────────────────────

  /**
   * 获取所有建筑加成
   * 汇总已完成科技的效果，按 "效果类型:目标" 聚合
   */
  getAllBuildingBonuses(): Record<string, number> {
    const bonuses: Record<string, number> = {};
    for (const def of TECH_NODE_DEFS) {
      const state = this.treeSys.getNodeState(def.id);
      if (state?.status !== 'completed') continue;
      for (const eff of def.effects) {
        const key = `${eff.type}:${eff.target}`;
        bonuses[key] = (bonuses[key] ?? 0) + eff.value;
      }
    }
    return bonuses;
  }

  /**
   * 获取资源产出倍率
   * 使用 TechEffectSystem（如果可用）或直接从科技树计算
   */
  getResourceProductionMultiplier(resourceType: string): number {
    if (this.techEffectSys) {
      // getEffectValue 内部已将 target='all' 的效果纳入匹配，
      // 因此 specificBonus 已包含特定资源 + 全体加成，无需再单独加 allBonus
      const specificBonus = this.techEffectSys.getProductionBonus(resourceType);
      return 1 + specificBonus / 100;
    }
    // 降级：直接从科技树计算（同理 getEffectValue 已包含 all 匹配）
    const specific = this.treeSys.getEffectValue('resource_production', resourceType);
    return 1 + specific / 100;
  }

  // ─────────────────────────────────────────
  // 书院等级同步
  // ─────────────────────────────────────────

  /**
   * 同步书院等级
   * 同步到 TechPointSystem 以影响科技点产出
   */
  syncAcademyLevel(level: number): void {
    if (!Number.isFinite(level) || level < 0) return;
    this.academyLevel = level;
    this.pointSys.syncAcademyLevel(level);
  }

  // ─────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────

  /**
   * 序列化 Facade 自有状态
   */
  serialize(): AcademyResearchSaveData {
    return {
      copperSpeedUpCounts: { ...this.copperSpeedUpCounts },
      totalIngotSpeedUpCount: this.totalIngotSpeedUpCount,
    };
  }

  /**
   * 反序列化恢复 Facade 自有状态
   */
  deserialize(data: AcademyResearchSaveData): void {
    this.copperSpeedUpCounts = { ...(data.copperSpeedUpCounts ?? {}) };
    this.totalIngotSpeedUpCount = data.totalIngotSpeedUpCount ?? 0;
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /**
   * 通知科技完成 → 建筑加成注入
   */
  private notifyTechCompleted(techId: string): void {
    if (!this.buildingBonusCallback) return;

    const def = TECH_NODE_MAP.get(techId);
    if (!def) return;

    // 收集受影响的建筑类型
    const affectedBuildingTypes = new Set<string>();
    for (const eff of def.effects) {
      const buildings = RESOURCE_TO_BUILDING[eff.target];
      if (buildings) {
        for (const b of buildings) {
          affectedBuildingTypes.add(b);
        }
      }
      // building_production 类型也影响建筑
      if (eff.type === 'building_production') {
        affectedBuildingTypes.add('all');
      }
    }

    const injection: BuildingBonusInjection = {
      techId,
      techName: def.name,
      effects: def.effects.map(eff => ({
        type: eff.type,
        target: eff.target,
        value: eff.value,
      })),
      affectedBuildingTypes: [...affectedBuildingTypes],
    };

    this.buildingBonusCallback(injection);
  }

  /**
   * 生成效果可读描述
   */
  private describeEffect(effect: TechEffect): string {
    const typeLabels: Record<string, string> = {
      resource_production: '产出加成',
      troop_attack: '攻击加成',
      troop_defense: '防御加成',
      troop_hp: '生命加成',
      building_production: '建筑产出加成',
      hero_exp: '经验加成',
      research_speed: '研究速度加成',
      march_speed: '行军速度加成',
      resource_cap: '资源上限加成',
      recruit_discount: '招募折扣',
    };
    return typeLabels[effect.type] ?? effect.type;
  }
}
