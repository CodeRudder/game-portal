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
} from './building.types';
import { BUILDING_TYPES } from './building.types';
import {
  BUILDING_DEFS,
  BUILDING_MAX_LEVELS,
  BUILDING_UNLOCK_LEVELS,
  BUILDING_SAVE_VERSION,
  QUEUE_CONFIGS,
  CANCEL_REFUND_RATIO,
} from './building-config';
import type { Resources } from '../resource/resource.types';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

/** 根据等级获取外观阶段 */
function getAppearanceStage(level: number): AppearanceStage {
  if (level <= 5) return 'humble';
  if (level <= 12) return 'orderly';
  if (level <= 20) return 'refined';
  return 'glorious';
}

function createInitialState(type: BuildingType): BuildingState {
  const unlocked = BUILDING_UNLOCK_LEVELS[type] === 0;
  return {
    type,
    level: unlocked ? 1 : 0,
    status: unlocked ? 'idle' : 'locked',
    upgradeStartTime: null,
    upgradeEndTime: null,
  };
}

function createAllStates(): Record<BuildingType, BuildingState> {
  const s = {} as Record<BuildingType, BuildingState>;
  for (const t of BUILDING_TYPES) s[t] = createInitialState(t);
  return s;
}

// ─────────────────────────────────────────────
// BuildingSystem
// ─────────────────────────────────────────────

export class BuildingSystem implements ISubsystem {
  // ── ISubsystem 接口 ──
  readonly name = 'building' as const;
  private deps: ISystemDeps | null = null;

  private buildings: Record<BuildingType, BuildingState>;
  private upgradeQueue: QueueSlot[];

  constructor() {
    this.buildings = createAllStates();
    this.upgradeQueue = [];
  }

  // ── ISubsystem 适配层 ──

  /** 注入依赖（事件总线、配置注册表等） */
  init(deps: ISystemDeps): void {
    this.deps = deps;
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

    // 非主城建筑等级 ≤ 主城等级
    if (type !== 'castle' && state.level >= this.buildings.castle.level) {
      reasons.push(`建筑等级不能超过主城等级 (Lv${this.buildings.castle.level})`);
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

    // 资源检查
    if (resources && state.level < maxLv) {
      const cost = this.getUpgradeCost(type);
      if (cost) {
        if (resources.grain < cost.grain) reasons.push(`粮草不足：需要 ${cost.grain}`);
        if (resources.gold < cost.gold) reasons.push(`铜钱不足：需要 ${cost.gold}`);
        if (cost.troops > 0 && resources.troops < cost.troops) reasons.push(`兵力不足：需要 ${cost.troops}`);
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
    return data?.production ?? 0;
  }

  /** 主城全资源加成百分比（如 8 表示 +8%） */
  getCastleBonusPercent(): number {
    return this.getProduction('castle');
  }

  /** 主城加成乘数（8% → 1.08） */
  getCastleBonusMultiplier(): number {
    return 1 + this.getCastleBonusPercent() / 100;
  }

  // ── 5. 升级执行 ──

  /** 开始升级，返回扣除的资源费用；失败抛错 */
  startUpgrade(type: BuildingType, resources: Resources): UpgradeCost {
    const check = this.checkUpgrade(type, resources);
    if (!check.canUpgrade) throw new Error(`无法升级 ${type}：${check.reasons.join('；')}`);

    const cost = this.getUpgradeCost(type)!;
    const state = this.buildings[type];
    const now = Date.now();

    state.status = 'upgrading';
    state.upgradeStartTime = now;
    state.upgradeEndTime = now + cost.timeSeconds * 1000;

    this.upgradeQueue.push({
      buildingType: type,
      startTime: now,
      endTime: state.upgradeEndTime,
    });

    return { ...cost };
  }

  /** 取消升级，返回 80% 返还资源 */
  cancelUpgrade(type: BuildingType): UpgradeCost | null {
    const state = this.buildings[type];
    if (state.status !== 'upgrading') return null;

    const cost = this.getUpgradeCost(type);
    if (!cost) return null;

    const refund: UpgradeCost = {
      grain: Math.round(cost.grain * CANCEL_REFUND_RATIO),
      gold: Math.round(cost.gold * CANCEL_REFUND_RATIO),
      troops: Math.round(cost.troops * CANCEL_REFUND_RATIO),
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
    if (completed.includes('castle')) this.checkAndUnlockBuildings();

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

  // ── 10. 序列化 ──

  serialize(): BuildingSaveData {
    return { buildings: this.cloneBuildings(), version: BUILDING_SAVE_VERSION };
  }

  deserialize(data: BuildingSaveData): void {
    if (data.version !== BUILDING_SAVE_VERSION) {
      console.warn(`BuildingSystem: 存档版本不匹配 (期望 ${BUILDING_SAVE_VERSION}，实际 ${data.version})`);
    }

    for (const t of BUILDING_TYPES) {
      if (data.buildings[t]) this.buildings[t] = { ...data.buildings[t] };
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
  }

  // ── 11. 重置 ──

  reset(): void {
    this.buildings = createAllStates();
    this.upgradeQueue = [];
  }

  // ── 12. C19 建筑升级路线推荐 ──

  /**
   * 根据当前建筑状态推荐升级路线
   *
   * 策略：优先主城 → 产出建筑（按资源瓶颈排序） → 功能建筑
   * 返回按优先级排序的推荐列表，每项包含建筑类型、原因和预估收益
   */
  getUpgradeRouteRecommendation(resources?: Readonly<Resources>): Array<{
    type: BuildingType;
    priority: number;
    reason: string;
    estimatedBenefit: string;
  }> {
    const recommendations: Array<{
      type: BuildingType;
      priority: number;
      reason: string;
      estimatedBenefit: string;
    }> = [];

    for (const t of BUILDING_TYPES) {
      const state = this.buildings[t];
      if (state.status === 'locked' || state.status === 'upgrading') continue;

      const maxLv = BUILDING_MAX_LEVELS[t];
      if (state.level >= maxLv) continue;

      // 检查是否能升级（不含资源检查）
      const levelOk = t === 'castle' || state.level < this.buildings.castle.level;
      if (!levelOk) continue;

      let priority = 0;
      let reason = '';
      let benefit = '';

      if (t === 'castle') {
        // 主城优先级最高
        priority = 100;
        reason = '主城升级解锁新建筑并提升全资源加成';
        const nextBonus = BUILDING_DEFS.castle.levelTable[state.level]?.production ?? 0;
        benefit = `全资源加成 +${nextBonus}%`;
      } else {
        const def = BUILDING_DEFS[t];
        const currentProd = this.getProduction(t);
        const nextProd = def.levelTable[state.level]?.production ?? currentProd;
        const prodGain = nextProd - currentProd;

        if (def.production) {
          priority = 50 + Math.round(prodGain * 10);
          reason = `${BUILDING_LABELS[t]}产出提升`;
          benefit = `产出 +${prodGain.toFixed(1)}/s`;
        } else {
          priority = 30;
          reason = `${BUILDING_LABELS[t]}功能强化`;
          const specialVal = def.levelTable[state.level]?.specialValue ?? 0;
          benefit = specialVal > 0 ? `属性值 +${specialVal}` : '等级提升';
        }
      }

      // 资源不足降低优先级
      if (resources) {
        const cost = this.getUpgradeCost(t);
        if (cost && (resources.grain < cost.grain || resources.gold < cost.gold)) {
          priority -= 20;
        }
      }

      recommendations.push({ type: t, priority, reason, estimatedBenefit: benefit });
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  // ── 13. B13 批量升级 ──

  /**
   * 批量升级：尝试升级多个建筑
   *
   * 按列表顺序依次尝试升级，跳过不可升级的建筑。
   * 返回成功和失败的建筑列表及对应原因。
   */
  batchUpgrade(
    types: BuildingType[],
    resources: Resources,
  ): {
    succeeded: Array<{ type: BuildingType; cost: UpgradeCost }>;
    failed: Array<{ type: BuildingType; reason: string }>;
    totalCost: UpgradeCost;
  } {
    const succeeded: Array<{ type: BuildingType; cost: UpgradeCost }> = [];
    const failed: Array<{ type: BuildingType; reason: string }> = [];
    const totalCost: UpgradeCost = { grain: 0, gold: 0, troops: 0, timeSeconds: 0 };

    // 追踪剩余资源（避免超支）
    let remainingGrain = resources.grain;
    let remainingGold = resources.gold;
    let remainingTroops = resources.troops;

    for (const t of types) {
      const currentResources: Resources = {
        grain: remainingGrain,
        gold: remainingGold,
        troops: remainingTroops,
        mandate: resources.mandate,
      };
      const check = this.checkUpgrade(t, currentResources);
      if (!check.canUpgrade) {
        failed.push({ type: t, reason: check.reasons.join('；') });
        continue;
      }

      try {
        const cost = this.startUpgrade(t, currentResources);
        succeeded.push({ type: t, cost });
        totalCost.grain += cost.grain;
        totalCost.gold += cost.gold;
        totalCost.troops += cost.troops;
        totalCost.timeSeconds += cost.timeSeconds;
        remainingGrain -= cost.grain;
        remainingGold -= cost.gold;
        remainingTroops -= cost.troops;
      } catch (e) {
        failed.push({ type: t, reason: e instanceof Error ? e.message : '未知错误' });
      }
    }

    return { succeeded, failed, totalCost };
  }

  // ── 私有 ──

  private cloneBuildings(): Record<BuildingType, BuildingState> {
    const c = {} as Record<BuildingType, BuildingState>;
    for (const t of BUILDING_TYPES) c[t] = { ...this.buildings[t] };
    return c;
  }
}
