/**
 * 建筑域 — 聚合根
 *
 * 职责：建筑状态管理、升级逻辑（含前置条件检查）、升级费用计算、
 *       产出关联、升级计时、序列化/反序列化
 * 规则：可引用 building-config 和 building.types，禁止引用其他域的 System
 */

import type {
  BuildingType,
  BuildingState,
  BuildingDef,
  UpgradeCost,
  UpgradeCheckResult,
  QueueSlot,
  BuildingSaveData,
  AppearanceStage,
  BuildingStorage,
  CollectResult,
} from './building.types';
import { BUILDING_TYPES, BUILDING_LABELS } from './building.types';
import {
  BUILDING_DEFS,
  BUILDING_MAX_LEVELS,
  BUILDING_UNLOCK_LEVELS,
  BUILDING_SAVE_VERSION,
  QUEUE_CONFIGS,
  CANCEL_REFUND_RATIO,
  STORAGE_OVERFLOW_SLOWDOWN,
  DEFAULT_BUFFER_SECONDS,
  NEWBIE_BUFFER_SECONDS,
} from './building-config';
import type { Resources } from '../resource/resource.types';
import type { ISubsystem, ISystemDeps } from '../../core/types';
import {
  recommendUpgradePath,
  getUpgradeRouteRecommendation,
  getUpgradeRecommendation,
} from './BuildingRecommender';
// 拆分模块
import { getAppearanceStage, createAllStates } from './BuildingStateHelpers';
import { gameLog } from '../../core/logger';
import { batchUpgrade } from './BuildingBatchOps';
import type { BatchUpgradeResult } from './BuildingBatchOps';

// ── BLD-F11 升级加速常量 ──

/** 铜钱加速：每次减少30%剩余时间 */
const COPPER_SPEEDUP_REDUCE_RATIO = 0.3;
/** 铜钱加速：最大次数 */
const COPPER_SPEEDUP_MAX_COUNT = 3;
/** 铜钱加速：基础消耗（×(已加速次数+1)） */
const COPPER_SPEEDUP_BASE_COST = 1000;
/** 天命加速：每点天命减少60秒 */
const MANDATE_SPEEDUP_SECONDS_PER_POINT = 60;
/** 元宝加速：每单位元宝对应600秒 */
const INGOT_SPEEDUP_SECONDS_PER_UNIT = 600;

// BuildingSystem

export class BuildingSystem implements ISubsystem {
  // ── ISubsystem 接口 ──
  readonly name = 'building' as const;
  private deps: ISystemDeps | null = null;

  private buildings: Record<BuildingType, BuildingState>;
  private upgradeQueue: QueueSlot[];

  // ── Sprint 1: 建筑库存系统（BLD-F26/BLD-F10/BLD-F15） ──
  /** 各建筑库存累积量 */
  private storage: Record<BuildingType, number>;

  /** 繁荣度→市集铜钱加成回调（返回百分比，如 15 表示 +15%） */
  private prosperityBonusCallback: (() => number) | null = null;

  constructor() {
    this.buildings = createAllStates();
    this.upgradeQueue = [];
    this.storage = {} as Record<BuildingType, number>;
    for (const t of BUILDING_TYPES) {
      this.storage[t] = 0;
    }
  }

  // ── ISubsystem 适配层 ──

  /** 注入依赖（事件总线、配置注册表等） */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /**
   * 注入繁荣度→市集铜钱加成回调
   * 回调返回铜钱加成百分比（如 15 表示 +15%），由市舶司繁荣度等级决定
   */
  setProsperityBonus(cb: () => number): void {
    this.prosperityBonusCallback = cb;
  }

  /** ISubsystem.update — 适配 tick()，建筑系统基于实时时间戳 */
  update(_dt: number): void {
    this.tick();
  }

  /** ISubsystem.getState — 适配 serialize() */
  getState(): unknown {
    return this.serialize();
  }

  // ── 1. 状态读取 ──

  getAllBuildings(): Readonly<Record<BuildingType, BuildingState>> {
    return this.cloneBuildings();
  }

  getBuilding(type: BuildingType): Readonly<BuildingState> {
    return { ...this.buildings[type] };
  }

  getLevel(type: BuildingType): number {
    return this.buildings[type].level;
  }

  getCastleLevel(): number {
    return this.buildings.castle.level;
  }

  getBuildingLevels(): Record<BuildingType, number> {
    const levels = {} as Record<BuildingType, number>;
    for (const t of BUILDING_TYPES) levels[t] = this.buildings[t].level;
    return levels;
  }

  getBuildingDef(type: BuildingType): BuildingDef {
    return BUILDING_DEFS[type];
  }

  getAppearanceStage(type: BuildingType) {
    return getAppearanceStage(this.buildings[type].level);
  }

  isUnlocked(type: BuildingType): boolean {
    return this.buildings[type].status !== 'locked';
  }

  // ── 2. 解锁检查 ──

  checkUnlock(type: BuildingType): boolean {
    const required = BUILDING_UNLOCK_LEVELS[type];
    return required === 0 || this.buildings.castle.level >= required;
  }

  /** 主城升级后调用，返回新解锁的建筑列表 */
  checkAndUnlockBuildings(): BuildingType[] {
    const unlocked: BuildingType[] = [];
    for (const t of BUILDING_TYPES) {
      const s = this.buildings[t];
      if (s.status === 'locked' && this.checkUnlock(t)) {
        s.status = 'idle';
        s.level = 1;
        unlocked.push(t);
      }
    }
    return unlocked;
  }

  // ── 3. 升级前置条件检查 ──

  checkUpgrade(type: BuildingType, resources?: Readonly<Resources>): UpgradeCheckResult {
    const reasons: string[] = [];
    const state = this.buildings[type];

    if (state.status === 'locked') {
      return { canUpgrade: false, reasons: ['建筑尚未解锁'] };
    }
    if (state.status === 'upgrading') reasons.push('建筑正在升级中');

    const maxLv = BUILDING_MAX_LEVELS[type];
    if (state.level >= maxLv) reasons.push(`已达等级上限 Lv${maxLv}`);

    // 非主城建筑等级 ≤ 主城等级 + 1（允许子建筑领先主城1级，改善新手体验）
    // P0-1 修复：初始状态农田 Lv1 可以直接升级到 Lv2，无需先升级主城
    if (type !== 'castle' && state.level > this.buildings.castle.level) {
      reasons.push(`建筑等级不能超过主城等级+1 (当前主城 Lv${this.buildings.castle.level})`);
    }

    // 主城特殊前置：Lv4→5 需任一建筑 Lv4, Lv9→10 需任一建筑 Lv9
    if (type === 'castle') {
      const next = state.level + 1;
      if (next === 5 && !BUILDING_TYPES.some((t) => t !== 'castle' && this.buildings[t].level >= 4)) {
        reasons.push('需要至少一座其他建筑达到 Lv4');
      }
      if (next === 10 && !BUILDING_TYPES.some((t) => t !== 'castle' && this.buildings[t].level >= 9)) {
        reasons.push('需要至少一座其他建筑达到 Lv9');
      }
    }

    if (state.status !== 'upgrading' && this.isQueueFull()) {
      reasons.push('升级队列已满');
    }

    // 资源检查（FIX-401: NaN绕过防护 — NaN < cost 返回 false 绕过检查）
    if (resources && state.level < maxLv) {
      // 防护 NaN/Infinity 资源值绕过比较
      // 注意：ore/wood 可能为 undefined（旧存档/测试数据），视为 0
      const oreAmount = resources.ore ?? 0;
      const woodAmount = resources.wood ?? 0;
      if (!Number.isFinite(resources.grain) || !Number.isFinite(resources.gold) ||
          !Number.isFinite(resources.troops) || !Number.isFinite(oreAmount) ||
          !Number.isFinite(woodAmount)) {
        reasons.push('资源数据异常（含NaN或Infinity）');
      } else {
        const cost = this.getUpgradeCost(type);
        if (cost) {
          if (resources.grain < cost.grain) reasons.push(`粮草不足：需要 ${cost.grain}`);
          if (resources.gold < cost.gold) reasons.push(`铜钱不足：需要 ${cost.gold}`);
          if (cost.troops > 0 && resources.troops < cost.troops) reasons.push(`兵力不足：需要 ${cost.troops}`);
          // Sprint 1 BLD-F02: 矿石/木材消耗检查
          if (cost.ore > 0 && oreAmount < cost.ore) reasons.push(`矿石不足：需要 ${cost.ore}`);
          if (cost.wood > 0 && woodAmount < cost.wood) reasons.push(`木材不足：需要 ${cost.wood}`);
        }
      }
    }

    return { canUpgrade: reasons.length === 0, reasons };
  }

  // ── 4. 升级费用计算 ──

  getUpgradeCost(type: BuildingType): UpgradeCost | null {
    const state = this.buildings[type];
    if (state.level <= 0 || state.level >= BUILDING_DEFS[type].maxLevel) return null;
    const data = BUILDING_DEFS[type].levelTable[state.level];
    return data ? { ...data.upgradeCost } : null;
  }

  /** 获取指定等级的产出值（默认当前等级） */
  getProduction(type: BuildingType, level?: number): number {
    const lv = level ?? this.buildings[type].level;
    if (lv <= 0) return 0;
    const data = BUILDING_DEFS[type].levelTable[lv - 1];
    const baseProduction = data?.production ?? 0;

    // 繁荣度加成仅作用于市集（gold产出）
    if (type === 'market' && this.prosperityBonusCallback) {
      const bonusPercent = this.prosperityBonusCallback();
      return baseProduction * (1 + bonusPercent / 100);
    }

    return baseProduction;
  }

  /** 主城全资源加成百分比（如 8 表示 +8%） */
  getCastleBonusPercent(): number {
    return this.getProduction('castle');
  }

  /** 主城加成乘数（8% → 1.08）；FIX-402: NaN防护 */
  getCastleBonusMultiplier(): number {
    const pct = this.getCastleBonusPercent();
    if (!Number.isFinite(pct)) return 1.0; // 安全默认值：无加成
    return 1 + pct / 100;
  }

  // ── 5. 升级执行 ──

  /** 开始升级，返回扣除的资源费用；失败抛错 */
  startUpgrade(type: BuildingType, resources: Resources): UpgradeCost {
    const check = this.checkUpgrade(type, resources);
    if (!check.canUpgrade) throw new Error(`无法升级 ${type}：${check.reasons.join('；')}`);

    const cost = this.getUpgradeCost(type);
    if (!cost) throw new Error(`无法获取 ${type} 升级费用`);

    const state = this.buildings[type];
    const now = Date.now();

    // FIX-405: 升级计时NaN防护
    const timeSeconds = Number.isFinite(cost.timeSeconds) ? cost.timeSeconds : 0;

    // 保存快照用于回滚
    const prevStatus = state.status;
    const prevStartTime = state.upgradeStartTime;
    const prevEndTime = state.upgradeEndTime;

    try {
      state.status = 'upgrading';
      state.upgradeStartTime = now;
      state.upgradeEndTime = now + timeSeconds * 1000;

      this.upgradeQueue.push({
        buildingType: type,
        startTime: now,
        endTime: state.upgradeEndTime,
      });
    } catch (e) {
      // 回滚状态
      state.status = prevStatus;
      state.upgradeStartTime = prevStartTime;
      state.upgradeEndTime = prevEndTime;
      throw e;
    }

    return { ...cost };
  }

  /** 取消升级，返回 80% 返还资源 */
  cancelUpgrade(type: BuildingType): UpgradeCost | null {
    const state = this.buildings[type];
    if (state.status !== 'upgrading') return null;

    const cost = this.getUpgradeCost(type);
    if (!cost) return null;

    const refund: UpgradeCost = {
      grain: Math.floor(cost.grain * CANCEL_REFUND_RATIO),
      gold: Math.floor(cost.gold * CANCEL_REFUND_RATIO),
      ore: Math.floor(cost.ore * CANCEL_REFUND_RATIO),
      wood: Math.floor(cost.wood * CANCEL_REFUND_RATIO),
      troops: Math.floor(cost.troops * CANCEL_REFUND_RATIO),
      timeSeconds: 0,
    };

    state.status = 'idle';
    state.upgradeStartTime = null;
    state.upgradeEndTime = null;
    this.upgradeQueue = this.upgradeQueue.filter((s) => s.buildingType !== type);

    return refund;
  }

  // ── 6. 升级计时 ──

  /** 每帧调用，返回本帧完成的建筑列表 */
  tick(): BuildingType[] {
    const completed: BuildingType[] = [];
    const now = Date.now();
    const remaining: QueueSlot[] = [];

    for (const slot of this.upgradeQueue) {
      if (now >= slot.endTime) {
        const state = this.buildings[slot.buildingType];
        state.level += 1;
        state.status = 'idle';
        state.upgradeStartTime = null;
        state.upgradeEndTime = null;
        completed.push(slot.buildingType);
      } else {
        remaining.push(slot);
      }
    }

    this.upgradeQueue = remaining;

    // 主城升级后检查新建筑解锁
    if (completed.includes('castle')) {
      this.checkAndUnlockBuildings();
    }

    return completed;
  }

  /** 升级剩余时间（秒） */
  getUpgradeRemainingTime(type: BuildingType): number {
    const s = this.buildings[type];
    if (s.status !== 'upgrading' || !s.upgradeEndTime) return 0;
    return Math.max(0, (s.upgradeEndTime - Date.now()) / 1000);
  }

  /** 升级进度 0~1 */
  getUpgradeProgress(type: BuildingType): number {
    const s = this.buildings[type];
    if (s.status !== 'upgrading' || !s.upgradeStartTime || !s.upgradeEndTime) return 0;
    const total = s.upgradeEndTime - s.upgradeStartTime;
    return total <= 0 ? 1 : Math.min(1, (Date.now() - s.upgradeStartTime) / total);
  }

  // ── 6.1 BLD-F11 升级加速系统 ──

  /**
   * F11-01: 铜钱加速 — 消耗铜钱减少30%剩余时间，最多叠加3次
   *
   * 消耗公式：1000 × (已加速次数 + 1)
   * @param buildingType 建筑类型
   * @param gold 当前铜钱数量（由调用方传入）
   * @returns 加速结果
   */
  speedUpWithCopper(
    buildingType: BuildingType,
    gold: number,
  ): { success: boolean; timeReduced: number; remainingSpeedUps: number; cost: number; reason?: string } {
    const slot = this.upgradeQueue.find((s) => s.buildingType === buildingType);
    if (!slot) {
      return { success: false, timeReduced: 0, remainingSpeedUps: 0, cost: 0, reason: '该建筑未在升级队列中' };
    }

    const count = slot.copperSpeedUpCount ?? 0;
    if (count >= COPPER_SPEEDUP_MAX_COUNT) {
      return { success: false, timeReduced: 0, remainingSpeedUps: 0, cost: 0, reason: '铜钱加速次数已达上限(3次)' };
    }

    const cost = COPPER_SPEEDUP_BASE_COST * (count + 1);
    if (gold < cost) {
      return { success: false, timeReduced: 0, remainingSpeedUps: COPPER_SPEEDUP_MAX_COUNT - count, cost, reason: `铜钱不足：需要 ${cost}，当前 ${gold}` };
    }

    const now = Date.now();
    const remainingMs = slot.endTime - now;
    if (remainingMs <= 0) {
      return { success: false, timeReduced: 0, remainingSpeedUps: 0, cost: 0, reason: '升级已完成' };
    }

    const reduceMs = remainingMs * COPPER_SPEEDUP_REDUCE_RATIO;
    const newEndTime = slot.endTime - reduceMs;

    // 更新队列槽位
    slot.endTime = newEndTime;
    slot.copperSpeedUpCount = count + 1;

    // 同步更新建筑状态
    const state = this.buildings[buildingType];
    state.upgradeEndTime = newEndTime;

    return {
      success: true,
      timeReduced: reduceMs / 1000,
      remainingSpeedUps: COPPER_SPEEDUP_MAX_COUNT - count - 1,
      cost,
    };
  }

  /**
   * F11-02: 天命加速 — 消耗天命减少固定时间
   *
   * 每点天命减少60秒
   * @param buildingType 建筑类型
   * @param mandatePoints 消耗的天命点数
   * @param currentMandate 当前天命数量（由调用方传入）
   * @returns 加速结果
   */
  speedUpWithMandate(
    buildingType: BuildingType,
    mandatePoints: number,
    currentMandate: number,
  ): { success: boolean; timeReduced: number; cost: number; reason?: string } {
    if (!Number.isFinite(mandatePoints) || mandatePoints <= 0) {
      return { success: false, timeReduced: 0, cost: 0, reason: '天命数量无效' };
    }

    const slot = this.upgradeQueue.find((s) => s.buildingType === buildingType);
    if (!slot) {
      return { success: false, timeReduced: 0, cost: 0, reason: '该建筑未在升级队列中' };
    }

    if (currentMandate < mandatePoints) {
      return { success: false, timeReduced: 0, cost: mandatePoints, reason: `天命不足：需要 ${mandatePoints}，当前 ${currentMandate}` };
    }

    const now = Date.now();
    const remainingMs = slot.endTime - now;
    if (remainingMs <= 0) {
      return { success: false, timeReduced: 0, cost: 0, reason: '升级已完成' };
    }

    const reduceMs = mandatePoints * MANDATE_SPEEDUP_SECONDS_PER_POINT * 1000;
    const actualReduceMs = Math.min(reduceMs, remainingMs);
    const newEndTime = slot.endTime - actualReduceMs;

    // 更新队列槽位
    slot.endTime = newEndTime;

    // 同步更新建筑状态
    const state = this.buildings[buildingType];
    state.upgradeEndTime = newEndTime;

    // 如果刚好完成，立即结算
    if (newEndTime <= now) {
      state.level += 1;
      state.status = 'idle';
      state.upgradeStartTime = null;
      state.upgradeEndTime = null;
      this.upgradeQueue = this.upgradeQueue.filter((s) => s.buildingType !== buildingType);
      if (buildingType === 'castle') {
        this.checkAndUnlockBuildings();
      }
    }

    return {
      success: true,
      timeReduced: actualReduceMs / 1000,
      cost: mandatePoints,
    };
  }

  /**
   * F11-03: 元宝秒完成 — 消耗元宝立即完成升级
   *
   * 消耗公式：⌈剩余秒数 / 600⌉
   * @param buildingType 建筑类型
   * @param currentIngot 当前元宝数量（由调用方传入）
   * @returns 加速结果
   */
  instantCompleteWithIngot(
    buildingType: BuildingType,
    currentIngot: number,
  ): { success: boolean; ingotCost: number; reason?: string } {
    const slot = this.upgradeQueue.find((s) => s.buildingType === buildingType);
    if (!slot) {
      return { success: false, ingotCost: 0, reason: '该建筑未在升级队列中' };
    }

    const now = Date.now();
    const remainingMs = slot.endTime - now;
    if (remainingMs <= 0) {
      return { success: false, ingotCost: 0, reason: '升级已完成' };
    }

    const remainingSeconds = remainingMs / 1000;
    const ingotCost = Math.ceil(remainingSeconds / INGOT_SPEEDUP_SECONDS_PER_UNIT);

    if (currentIngot < ingotCost) {
      return { success: false, ingotCost, reason: `元宝不足：需要 ${ingotCost}，当前 ${currentIngot}` };
    }

    // 立即完成：等级+1、状态恢复idle
    const state = this.buildings[buildingType];
    state.level += 1;
    state.status = 'idle';
    state.upgradeStartTime = null;
    state.upgradeEndTime = null;

    // 从队列中移除
    this.upgradeQueue = this.upgradeQueue.filter((s) => s.buildingType !== buildingType);

    // 主城升级后检查新建筑解锁
    if (buildingType === 'castle') {
      this.checkAndUnlockBuildings();
    }

    return { success: true, ingotCost };
  }

  // ── 7. 队列管理 ──

  getUpgradeQueue(): Readonly<QueueSlot[]> {
    return [...this.upgradeQueue];
  }

  getMaxQueueSlots(): number {
    const lv = this.buildings.castle.level;
    for (const c of QUEUE_CONFIGS) {
      if (lv >= c.castleLevelMin && lv <= c.castleLevelMax) return c.slots;
    }
    return 1;
  }

  isQueueFull(): boolean {
    return this.upgradeQueue.length >= this.getMaxQueueSlots();
  }

  // ── 8. 产出关联 ──

  /** 计算所有建筑的资源产出汇总（不含主城加成） */
  calculateTotalProduction(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const t of BUILDING_TYPES) {
      if (t === 'castle') continue;
      const state = this.buildings[t];
      if (state.level <= 0) continue;
      const def = BUILDING_DEFS[t];
      if (!def.production) continue;
      const rt = def.production.resourceType;
      result[rt] = (result[rt] ?? 0) + this.getProduction(t);
    }
    return result;
  }

  /** 获取产出建筑等级映射（用于资源上限计算等场景） */
  getProductionBuildingLevels(): Record<string, number> {
    const levels: Record<string, number> = {};
    for (const t of BUILDING_TYPES) {
      if (t !== 'castle') levels[t] = this.buildings[t].level;
    }
    return levels;
  }

  // ── 9. 特殊属性 ──

  getWallDefense(): number {
    const lv = this.buildings.wall.level;
    if (lv <= 0) return 0;
    return BUILDING_DEFS.wall.levelTable[lv - 1]?.specialValue ?? 0;
  }

  getWallDefenseBonus(): number {
    return this.getProduction('wall');
  }

  getClinicRecoveryRate(): number {
    return this.getProduction('clinic');
  }

  // ── Sprint 2: 工坊装备系统（BLD-F24/XI-009） ──

  /** 工坊锻造效率百分比（production字段，如5表示+5%） */
  getWorkshopForgeEfficiency(): number {
    return this.getProduction('workshop');
  }

  /** 工坊强化折扣百分比（specialValue字段，如3表示-3%） */
  getWorkshopEnhanceDiscount(): number {
    const lv = this.buildings.workshop.level;
    if (lv <= 0) return 0;
    return BUILDING_DEFS.workshop.levelTable[lv - 1]?.specialValue ?? 0;
  }

  /** 工坊锻造效率乘数（5% → 1.05） */
  getWorkshopForgeMultiplier(): number {
    const pct = this.getWorkshopForgeEfficiency();
    return 1 + pct / 100;
  }

  /** 工坊强化折扣乘数（3% → 0.97） */
  getWorkshopEnhanceDiscountMultiplier(): number {
    const pct = this.getWorkshopEnhanceDiscount();
    return Math.max(0.5, 1 - pct / 100); // 最低50%折扣
  }

  /** 工坊等级是否解锁批量锻造（Lv10解锁） */
  isBatchForgeUnlocked(): boolean {
    return this.buildings.workshop.level >= 10;
  }

  /** 获取工坊等级 */
  getWorkshopLevel(): number {
    return this.buildings.workshop.level;
  }

  // ── 10. 序列化 ──

  serialize(): BuildingSaveData {
    return {
      buildings: this.cloneBuildings(),
      storage: { ...this.storage },
      version: BUILDING_SAVE_VERSION,
    };
  }

  deserialize(data: BuildingSaveData): void {
    // FIX-403: null/undefined防护
    if (!data || !data.buildings) {
      gameLog.warn('BuildingSystem: deserialize收到无效数据，使用默认状态');
      this.reset();
      return;
    }

    if (data.version !== BUILDING_SAVE_VERSION) {
      gameLog.warn(`BuildingSystem: 存档版本不匹配 (期望 ${BUILDING_SAVE_VERSION}，实际 ${data.version})`);
    }

    for (const t of BUILDING_TYPES) {
      if (data.buildings[t]) {
        const saved = data.buildings[t];
        // FIX-404: 校验 level/status 一致性
        if (saved.status === 'upgrading' && (saved.level < 0 || !saved.upgradeEndTime)) {
          gameLog.warn(`BuildingSystem: ${t} upgrading状态异常，修正为idle`);
          saved.status = 'idle';
          saved.upgradeStartTime = null;
          saved.upgradeEndTime = null;
        }
        if (saved.status === 'locked' && saved.level > 0) {
          gameLog.warn(`BuildingSystem: ${t} locked但level=${saved.level}，修正为idle`);
          saved.status = 'idle';
        }
        if (saved.status === 'idle' && saved.level <= 0 && saved.level !== 0) {
          gameLog.warn(`BuildingSystem: ${t} idle但level=${saved.level}，修正为locked`);
          saved.status = 'locked';
        }
        this.buildings[t] = { ...saved };
      }
    }

    // 重建队列 & 处理离线期间完成的升级
    this.upgradeQueue = [];
    const now = Date.now();
    for (const t of BUILDING_TYPES) {
      const s = this.buildings[t];
      if (s.status === 'upgrading' && s.upgradeEndTime) {
        if (now >= s.upgradeEndTime) {
          s.level += 1;
          s.status = 'idle';
          s.upgradeStartTime = null;
          s.upgradeEndTime = null;
        } else {
          this.upgradeQueue.push({
            buildingType: t,
            startTime: s.upgradeStartTime ?? now,
            endTime: s.upgradeEndTime,
          });
        }
      }
    }

    this.checkAndUnlockBuildings();

    // 恢复库存数据（Sprint 1 BLD-F26）
    for (const t of BUILDING_TYPES) {
      this.storage[t] = data.storage?.[t] ?? 0;
    }
  }

  // ── 11. 重置 ──

  reset(): void {
    this.buildings = createAllStates();
    this.upgradeQueue = [];
    // 重置库存
    for (const t of BUILDING_TYPES) {
      this.storage[t] = 0;
    }
  }

  // ── 15. 建筑库存系统（Sprint 1 BLD-F26/BLD-F10/BLD-F15） ──

  /**
   * 获取建筑库存容量
   * 公式：产出速率 × 缓冲时间
   * 新手(Lv1~5)缓冲时间45分钟，Lv10+为2小时
   */
  getStorageCapacity(type: BuildingType): number {
    const level = this.buildings[type].level;
    const def = BUILDING_DEFS[type];
    if (!def.production || level <= 0) return 0;

    const production = this.getProduction(type);
    // 新手保护：Lv1~5 使用更长缓冲时间
    const bufferSeconds = level <= 5 ? NEWBIE_BUFFER_SECONDS : DEFAULT_BUFFER_SECONDS;
    return Math.floor(production * bufferSeconds);
  }

  /**
   * 获取建筑库存累积量
   */
  getStorageAmount(type: BuildingType): number {
    return this.storage[type] ?? 0;
  }

  /**
   * 获取所有建筑的库存状态
   */
  getAllStorage(): BuildingStorage[] {
    const result: BuildingStorage[] = [];
    for (const t of BUILDING_TYPES) {
      const def = BUILDING_DEFS[t];
      if (!def.production) continue;
      const amount = this.storage[t];
      const capacity = this.getStorageCapacity(t);
      result.push({
        buildingType: t,
        amount,
        capacity,
        isOverflowing: capacity > 0 && amount >= capacity,
      });
    }
    return result;
  }

  /**
   * 建筑库存是否溢出（产出降速中）
   */
  isStorageOverflowing(type: BuildingType): boolean {
    const capacity = this.getStorageCapacity(type);
    return capacity > 0 && this.storage[type] >= capacity;
  }

  /**
   * 每帧累加建筑库存（tick 产出 → 库存）
   * 溢出后产出降速50%
   *
   * @param dtSec 帧间隔（秒）
   * @returns 库存变化的建筑列表
   */
  tickStorage(dtSec: number): BuildingType[] {
    if (!Number.isFinite(dtSec) || dtSec <= 0) return [];

    const changed: BuildingType[] = [];

    for (const t of BUILDING_TYPES) {
      const def = BUILDING_DEFS[t];
      if (!def.production) continue;

      const state = this.buildings[t];
      if (state.level <= 0 || state.status === 'locked') continue;

      const production = this.getProduction(t);
      if (production <= 0) continue;

      // 溢出降速
      const capacity = this.getStorageCapacity(t);
      const isOverflowing = capacity > 0 && this.storage[t] >= capacity;
      const rate = isOverflowing ? production * STORAGE_OVERFLOW_SLOWDOWN : production;

      const gain = rate * dtSec;
      if (gain <= 0) continue;

      const before = this.storage[t];
      // 库存不超过容量（降速模式下仍然可以缓慢累积到上限）
      this.storage[t] = capacity > 0
        ? Math.min(before + gain, capacity)
        : before + gain;

      if (this.storage[t] !== before) {
        changed.push(t);
      }
    }

    return changed;
  }

  /**
   * 一键收取所有建筑库存（Sprint 1 BLD-F10）
   * 收取时4种资源飞入资源栏
   *
   * @returns 收取结果（各资源总量 + 各建筑明细）
   */
  collectAll(): CollectResult {
    const collected: Record<string, number> = {};
    const buildingDetails: CollectResult['buildingDetails'] = [];

    for (const t of BUILDING_TYPES) {
      const def = BUILDING_DEFS[t];
      if (!def.production) continue;

      const amount = this.storage[t];
      if (amount <= 0) continue;

      const resourceType = def.production.resourceType;
      collected[resourceType] = (collected[resourceType] ?? 0) + amount;
      buildingDetails.push({
        buildingType: t,
        resourceType,
        amount,
      });

      // 清零库存
      this.storage[t] = 0;
    }

    return { collected, buildingDetails };
  }

  /**
   * 收取单个建筑库存
   */
  collectBuilding(type: BuildingType): number {
    const amount = this.storage[type];
    this.storage[type] = 0;
    return amount;
  }

  // ── 12. C19 建筑升级路线推荐 ──（委托 BuildingRecommender）

  /** 建筑升级路线推荐（按游戏阶段） */
  recommendUpgradePath(context: 'newbie' | 'development' | 'late') {
    return recommendUpgradePath(this.buildings, context);
  }

  /** 根据当前建筑状态推荐升级路线 */
  getUpgradeRouteRecommendation(resources?: Readonly<Resources>) {
    return getUpgradeRouteRecommendation(
      this.buildings, (t) => this.getProduction(t), (t) => this.getUpgradeCost(t), resources,
    );
  }

  /** 建筑升级路线推荐（简化版） */
  getUpgradeRecommendation(resources?: Readonly<Resources>) {
    return getUpgradeRecommendation(
      this.buildings, (t) => this.getProduction(t), (t) => this.getUpgradeCost(t), resources,
    );
  }

  // ── 14. B13 批量升级 ──（委托 BuildingBatchOps）

  /** 批量升级：按列表顺序依次尝试升级，跳过不可升级的建筑 */
  batchUpgrade(
    types: BuildingType[],
    resources: Resources,
  ): BatchUpgradeResult {
    return batchUpgrade(types, resources, {
      getBuilding: (t) => this.getBuilding(t),
      checkUpgrade: (t, r) => this.checkUpgrade(t, r),
      startUpgrade: (t, r) => this.startUpgrade(t, r),
    });
  }

  // ── 13. 测试基础设施 ──

  /**
   * 即时完成所有待处理的建筑升级（含队列清空）。
   *
   * 仅用于测试工具（GameEventSimulator），生产代码禁止调用。
   *
   * @internal
   */
  forceCompleteUpgrades(): BuildingType[] {
    const completed: BuildingType[] = [];

    for (const [type, state] of Object.entries(this.buildings) as [BuildingType, BuildingState][]) {
      if (state.status === 'upgrading') {
        state.level += 1;
        state.status = 'idle';
        state.upgradeStartTime = null;
        state.upgradeEndTime = null;
        completed.push(type);
      }
    }

    // 清空升级队列
    this.upgradeQueue.length = 0;

    // 主城升级后检查新建筑解锁
    if (completed.includes('castle')) {
      this.checkAndUnlockBuildings();
    }

    return completed;
  }

  // ── 私有 ──

  private cloneBuildings(): Record<BuildingType, BuildingState> {
    const c = {} as Record<BuildingType, BuildingState>;
    for (const t of BUILDING_TYPES) c[t] = { ...this.buildings[t] };
    return c;
  }
}
