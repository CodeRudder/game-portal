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
import { BUILDING_TYPES, BUILDING_LABELS } from './building.types';
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

// BuildingSystem

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
      if (!Number.isFinite(resources.grain) || !Number.isFinite(resources.gold) || !Number.isFinite(resources.troops)) {
        reasons.push('资源数据异常（含NaN或Infinity）');
      } else {
        const cost = this.getUpgradeCost(type);
        if (cost) {
          if (resources.grain < cost.grain) reasons.push(`粮草不足：需要 ${cost.grain}`);
          if (resources.gold < cost.gold) reasons.push(`铜钱不足：需要 ${cost.gold}`);
          if (cost.troops > 0 && resources.troops < cost.troops) reasons.push(`兵力不足：需要 ${cost.troops}`);
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
    return data?.production ?? 0;
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

    const cost = this.getUpgradeCost(type)!;
    const state = this.buildings[type];
    const now = Date.now();

    // FIX-405: 升级计时NaN防护
    const timeSeconds = Number.isFinite(cost.timeSeconds) ? cost.timeSeconds : 0;

    state.status = 'upgrading';
    state.upgradeStartTime = now;
    state.upgradeEndTime = now + timeSeconds * 1000;

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
