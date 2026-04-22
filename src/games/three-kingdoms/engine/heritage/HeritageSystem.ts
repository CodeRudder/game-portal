/**
 * 引擎层 — 传承系统
 *
 * 管理武将传承、装备传承、经验传承的完整流程。
 * 转生加速/次数解锁/收益模拟器已拆分至 HeritageSimulation.ts。
 *
 * 传承规则：
 *   - 武将传承：源武将经验/技能传给目标武将，源武将重置为1级
 *   - 装备传承：源装备强化等级传给目标装备，源装备被消耗
 *   - 经验传承：部分经验从源武将传给目标武将
 *
 * @module engine/heritage/HeritageSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  HeritageType,
  HeritageResult,
  HeritageDataSummary,
  HeritageState,
  HeritageRecord,
  HeritageSaveData,
  HeroHeritageRequest,
  EquipmentHeritageRequest,
  ExperienceHeritageRequest,
  RebirthAccelerationState,
  HeritageSimulationParams,
  HeritageSimulationResult,
} from '../../core/heritage';
import {
  HERO_HERITAGE_RULE,
  EQUIPMENT_HERITAGE_RULE,
  EXPERIENCE_HERITAGE_RULE,
  QUALITY_EXP_EFFICIENCY,
  RARITY_DIFF_EFFICIENCY,
  DAILY_HERITAGE_LIMIT,
  HERITAGE_SAVE_VERSION,
} from '../../core/heritage';
import type { Faction } from '../hero/hero.types';
import {
  claimInitialGift,
  executeRebuild,
  instantUpgrade,
  createInitialAccelState,
  getRebirthUnlocks,
  isHeritageUnlocked,
  simulateEarnings,
  type RebirthAccelCallbacks,
} from './HeritageSimulation';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const EVENT_PREFIX = 'heritage';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建初始传承状态 */
function createInitialHeritageState(): HeritageState {
  return {
    heroHeritageCount: 0,
    equipmentHeritageCount: 0,
    experienceHeritageCount: 0,
    dailyHeritageCount: 0,
    lastDailyReset: new Date().toISOString().slice(0, 10),
    heritageHistory: [],
  };
}

/** 获取今天日期字符串 */
function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────
// 外部数据接口（回调获取）
// ─────────────────────────────────────────────

/** 武将数据（传承所需） */
interface HeroDataSource {
  id: string;
  level: number;
  exp: number;
  quality: number;
  faction: Faction;
  skillLevels: number[];
  favorability: number;
}

/** 装备数据（传承所需） */
interface EquipDataSource {
  uid: string;
  slot: string;
  rarity: number;
  enhanceLevel: number;
}

// ─────────────────────────────────────────────
// HeritageSystem 类
// ─────────────────────────────────────────────

/**
 * 传承系统
 *
 * 管理武将/装备/经验传承，转生后加速，收益模拟器。
 */
export class HeritageSystem implements ISubsystem {
  readonly name = 'heritage';

  private deps!: ISystemDeps;
  private state: HeritageState = createInitialHeritageState();
  private accelState: RebirthAccelerationState = createInitialAccelState();

  /** 外部数据查询回调 */
  private heroCallback?: (id: string) => HeroDataSource | null;
  private equipCallback?: (uid: string) => EquipDataSource | null;
  private updateHeroCallback?: (id: string, updates: Partial<HeroDataSource>) => void;
  private removeEquipCallback?: (uid: string) => void;
  private updateEquipCallback?: (uid: string, updates: Partial<EquipDataSource>) => void;
  private addResourcesCallback?: (resources: Record<string, number>) => void;
  private upgradeBuildingCallback?: (buildingId: string) => boolean;
  private rebirthCountCallback?: () => number;

  // ─── 生命周期 ───────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.deps.eventBus.on('calendar:dayChanged', () => this.resetDailyCount());
  }

  update(_dt: number): void { /* 传承系统不依赖帧更新 */ }

  getState(): HeritageState { return { ...this.state }; }

  getAccelerationState(): RebirthAccelerationState { return { ...this.accelState }; }

  reset(): void {
    this.state = createInitialHeritageState();
    this.accelState = createInitialAccelState();
  }

  // ─── 配置回调 ───────────────────────────

  /** 设置外部数据查询回调 */
  setCallbacks(callbacks: {
    getHero?: (id: string) => HeroDataSource | null;
    getEquip?: (uid: string) => EquipDataSource | null;
    updateHero?: (id: string, updates: Partial<HeroDataSource>) => void;
    removeEquip?: (uid: string) => void;
    updateEquip?: (uid: string, updates: Partial<EquipDataSource>) => void;
    addResources?: (resources: Record<string, number>) => void;
    upgradeBuilding?: (buildingId: string) => boolean;
    getRebirthCount?: () => number;
  }): void {
    this.heroCallback = callbacks.getHero;
    this.equipCallback = callbacks.getEquip;
    this.updateHeroCallback = callbacks.updateHero;
    this.removeEquipCallback = callbacks.removeEquip;
    this.updateEquipCallback = callbacks.updateEquip;
    this.addResourcesCallback = callbacks.addResources;
    this.upgradeBuildingCallback = callbacks.upgradeBuilding;
    this.rebirthCountCallback = callbacks.getRebirthCount;
  }

  /** 获取加速回调集合 */
  private getAccelCallbacks(): RebirthAccelCallbacks {
    return {
      addResources: this.addResourcesCallback,
      upgradeBuilding: this.upgradeBuildingCallback,
      getRebirthCount: this.rebirthCountCallback,
    };
  }

  // ─── 武将传承 API ───────────────────────

  /** 执行武将传承 */
  executeHeroHeritage(request: HeroHeritageRequest): HeritageResult {
    this.checkDailyReset();
    if (this.state.dailyHeritageCount >= DAILY_HERITAGE_LIMIT) {
      return this.failResult('hero', '今日传承次数已达上限');
    }

    const source = this.heroCallback?.(request.sourceHeroId);
    const target = this.heroCallback?.(request.targetHeroId);

    if (!source) return this.failResult('hero', '源武将不存在');
    if (!target) return this.failResult('hero', '目标武将不存在');
    if (source.id === target.id) return this.failResult('hero', '不能自我传承');
    if (source.quality < HERO_HERITAGE_RULE.minSourceQuality) return this.failResult('hero', '源武将品质不足');
    if (target.quality < HERO_HERITAGE_RULE.minTargetQuality) return this.failResult('hero', '目标武将品质不足');

    const baseEfficiency = QUALITY_EXP_EFFICIENCY[source.quality] ?? 0.5;
    const sameFaction = source.faction === target.faction;
    const factionModifier = sameFaction ? HERO_HERITAGE_RULE.sameFactionBonus : -HERO_HERITAGE_RULE.diffFactionPenalty;
    const efficiency = Math.min(1, Math.max(0, baseEfficiency + factionModifier));
    const copperCost = source.level * HERO_HERITAGE_RULE.copperCostFactor;

    const sourceBefore = this.makeHeroSummary(source);
    const targetBefore = this.makeHeroSummary(target);

    const transferredExp = Math.floor(source.exp * efficiency * request.options.expEfficiency);
    const newTargetExp = target.exp + transferredExp;

    this.updateHeroCallback?.(target.id, {
      exp: newTargetExp,
      ...(request.options.transferSkillLevels ? { skillLevels: [...source.skillLevels] } : {}),
      ...(request.options.transferFavorability ? { favorability: source.favorability } : {}),
    });

    if (HERO_HERITAGE_RULE.sourceAfterState === 'reset') {
      this.updateHeroCallback?.(source.id, { level: 1, exp: 0 });
    }

    const sourceAfter = this.makeHeroSummary({
      ...source, level: HERO_HERITAGE_RULE.sourceAfterState === 'reset' ? 1 : source.level, exp: 0,
    });
    const targetAfter = this.makeHeroSummary({ ...target, exp: newTargetExp });

    this.addResourcesCallback?.({ copper: -copperCost });
    this.recordHeritage('hero', source.id, target.id, efficiency, copperCost);

    return { success: true, type: 'hero', efficiency, copperCost, sourceBefore, sourceAfter, targetBefore, targetAfter };
  }

  // ─── 装备传承 API ───────────────────────

  /** 执行装备传承 */
  executeEquipmentHeritage(request: EquipmentHeritageRequest): HeritageResult {
    this.checkDailyReset();
    if (this.state.dailyHeritageCount >= DAILY_HERITAGE_LIMIT) {
      return this.failResult('equipment', '今日传承次数已达上限');
    }

    const source = this.equipCallback?.(request.sourceUid);
    const target = this.equipCallback?.(request.targetUid);

    if (!source) return this.failResult('equipment', '源装备不存在');
    if (!target) return this.failResult('equipment', '目标装备不存在');
    if (source.uid === target.uid) return this.failResult('equipment', '不能自我传承');
    if (EQUIPMENT_HERITAGE_RULE.mustSameSlot && source.slot !== target.slot) {
      return this.failResult('equipment', '源装备和目标装备必须同部位');
    }

    const rawLevel = request.options.transferEnhanceLevel ? source.enhanceLevel : 0;
    const transferredLevel = Math.max(0, rawLevel - EQUIPMENT_HERITAGE_RULE.levelLoss);

    const rarityDiff = target.rarity - source.rarity;
    let efficiency = 1.0;
    if (rarityDiff === 0) efficiency = RARITY_DIFF_EFFICIENCY['same'];
    else if (rarityDiff === 1) efficiency = RARITY_DIFF_EFFICIENCY['higher_1'];
    else if (rarityDiff >= 2) efficiency = RARITY_DIFF_EFFICIENCY['higher_2'];
    else if (rarityDiff === -1) efficiency = RARITY_DIFF_EFFICIENCY['lower_1'];
    else efficiency = RARITY_DIFF_EFFICIENCY['lower_2'];

    const finalLevel = Math.floor(transferredLevel * efficiency);
    const copperCost = rawLevel * EQUIPMENT_HERITAGE_RULE.copperCostFactor;

    const sourceBefore: HeritageDataSummary = { id: source.uid, level: source.enhanceLevel, value: source.enhanceLevel };
    const targetBefore: HeritageDataSummary = { id: target.uid, level: target.enhanceLevel, value: target.enhanceLevel };

    this.updateEquipCallback?.(target.uid, { enhanceLevel: finalLevel });
    if (EQUIPMENT_HERITAGE_RULE.sourceAfterState === 'consumed') {
      this.removeEquipCallback?.(source.uid);
    }

    const sourceAfter: HeritageDataSummary = { id: source.uid, level: 0, value: 0 };
    const targetAfter: HeritageDataSummary = { id: target.uid, level: finalLevel, value: finalLevel };

    this.addResourcesCallback?.({ copper: -copperCost });
    this.recordHeritage('equipment', source.uid, target.uid, efficiency, copperCost);

    return { success: true, type: 'equipment', efficiency, copperCost, sourceBefore, sourceAfter, targetBefore, targetAfter };
  }

  // ─── 经验传承 API ───────────────────────

  /** 执行经验传承 */
  executeExperienceHeritage(request: ExperienceHeritageRequest): HeritageResult {
    this.checkDailyReset();
    if (this.state.dailyHeritageCount >= DAILY_HERITAGE_LIMIT) {
      return this.failResult('experience', '今日传承次数已达上限');
    }

    const source = this.heroCallback?.(request.sourceHeroId);
    const target = this.heroCallback?.(request.targetHeroId);

    if (!source) return this.failResult('experience', '源武将不存在');
    if (!target) return this.failResult('experience', '目标武将不存在');
    if (source.id === target.id) return this.failResult('experience', '不能自我传承');
    if (source.level < EXPERIENCE_HERITAGE_RULE.minSourceLevel) {
      return this.failResult('experience', `源武将等级不足${EXPERIENCE_HERITAGE_RULE.minSourceLevel}级`);
    }

    const ratio = Math.min(request.expRatio, EXPERIENCE_HERITAGE_RULE.maxExpRatio);
    const rawExp = source.exp * ratio;
    const transferredExp = Math.floor(rawExp * EXPERIENCE_HERITAGE_RULE.efficiency);
    const copperCost = Math.floor(source.level * EXPERIENCE_HERITAGE_RULE.copperCostFactor * ratio);

    const sourceBefore = this.makeHeroSummary(source);
    const targetBefore = this.makeHeroSummary(target);

    const newSourceExp = source.exp - Math.floor(rawExp);
    const newTargetExp = target.exp + transferredExp;

    this.updateHeroCallback?.(source.id, { exp: newSourceExp });
    this.updateHeroCallback?.(target.id, { exp: newTargetExp });

    const sourceAfter = this.makeHeroSummary({ ...source, exp: newSourceExp });
    const targetAfter = this.makeHeroSummary({ ...target, exp: newTargetExp });

    this.addResourcesCallback?.({ copper: -copperCost });
    this.recordHeritage('experience', source.id, target.id, EXPERIENCE_HERITAGE_RULE.efficiency, copperCost);

    return { success: true, type: 'experience', efficiency: EXPERIENCE_HERITAGE_RULE.efficiency, copperCost, sourceBefore, sourceAfter, targetBefore, targetAfter };
  }

  // ─── 转生后加速 API (#18) ───────────────

  /** 领取转生后初始资源赠送 */
  claimInitialGift(): { success: boolean; resources: Record<string, number>; reason?: string } {
    const result = claimInitialGift(this.accelState, this.getAccelCallbacks(), this.deps);
    this.accelState = result.newState;
    return { success: result.success, resources: result.resources, reason: result.reason };
  }

  /** 一键重建 */
  executeRebuild(config?: Partial<import('../../core/heritage').RebirthRebuildConfig>): {
    success: boolean; upgradedBuildings: string[]; reason?: string;
  } {
    const result = executeRebuild(this.accelState, this.getAccelCallbacks(), this.deps, config);
    this.accelState = result.newState;
    return { success: result.success, upgradedBuildings: result.upgradedBuildings, reason: result.reason };
  }

  /** 瞬间升级低级建筑 */
  instantUpgrade(buildingId: string): { success: boolean; reason?: string } {
    const result = instantUpgrade(buildingId, this.accelState, this.getAccelCallbacks());
    this.accelState = result.newState;
    return { success: result.success, reason: result.reason };
  }

  /** 初始化转生后加速状态 */
  initRebirthAcceleration(): void {
    this.accelState = createInitialAccelState();
  }

  // ─── 转生次数解锁 (#19) ─────────────────

  /** 获取转生次数解锁内容 */
  getRebirthUnlocks() {
    return getRebirthUnlocks(this.rebirthCountCallback?.() ?? 0);
  }

  /** 检查指定内容是否已解锁 */
  isUnlocked(unlockId: string): boolean {
    return isHeritageUnlocked(unlockId, this.rebirthCountCallback?.() ?? 0);
  }

  // ─── 收益模拟器 (#20) ───────────────────

  /** 模拟转生收益 */
  simulateEarnings(params: HeritageSimulationParams): HeritageSimulationResult {
    return simulateEarnings(params);
  }

  // ─── 存档 ───────────────────────────────

  loadSaveData(data: HeritageSaveData): void {
    this.state = { ...data.state };
    if (data.accelState) { this.accelState = { ...data.accelState }; }
  }

  getSaveData(): HeritageSaveData {
    return { version: HERITAGE_SAVE_VERSION, state: { ...this.state }, accelState: { ...this.accelState } };
  }

  // ─── 内部方法 ───────────────────────────

  private failResult(type: HeritageType, reason: string): HeritageResult {
    return {
      success: false, reason, type, efficiency: 0, copperCost: 0,
      sourceBefore: { id: '', level: 0, value: 0 }, sourceAfter: { id: '', level: 0, value: 0 },
      targetBefore: { id: '', level: 0, value: 0 }, targetAfter: { id: '', level: 0, value: 0 },
    };
  }

  private makeHeroSummary(hero: HeroDataSource): HeritageDataSummary {
    return { id: hero.id, level: hero.level, value: hero.exp };
  }

  private recordHeritage(type: HeritageType, sourceId: string, targetId: string, efficiency: number, copperCost: number): void {
    const record: HeritageRecord = { type, sourceId, targetId, efficiency, copperCost, timestamp: Date.now() };
    this.state.heritageHistory.push(record);
    this.state.dailyHeritageCount++;
    switch (type) {
      case 'hero': this.state.heroHeritageCount++; break;
      case 'equipment': this.state.equipmentHeritageCount++; break;
      case 'experience': this.state.experienceHeritageCount++; break;
    }
    this.deps.eventBus.emit(`${EVENT_PREFIX}:completed`, record);
  }

  private checkDailyReset(): void {
    const today = getTodayStr();
    if (this.state.lastDailyReset !== today) {
      this.state.dailyHeritageCount = 0;
      this.state.lastDailyReset = today;
    }
  }

  private resetDailyCount(): void {
    this.state.dailyHeritageCount = 0;
    this.state.lastDailyReset = getTodayStr();
  }
}
