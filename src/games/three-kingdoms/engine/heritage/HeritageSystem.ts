/**
 * 引擎层 — 传承系统
 *
 * 管理武将传承、装备传承、经验传承的完整流程：
 *   #18 转生后加速机制 — 初始资源赠送 + 低级建筑瞬间 + 一键重建
 *   #19 转生次数解锁内容 — 1次天命/2次专属科技/3次神话武将/5次跨服
 *   #20 收益模拟器 — 预测声望增长 + 推荐转生时机 + 倍率对比
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
  HeroHeritageOptions,
  EquipmentHeritageRequest,
  ExperienceHeritageRequest,
  RebirthAccelerationState,
  RebirthRebuildConfig,
  HeritageSimulationParams,
  HeritageSimulationResult,
} from '../../core/heritage';
import {
  HERO_HERITAGE_RULE,
  EQUIPMENT_HERITAGE_RULE,
  EXPERIENCE_HERITAGE_RULE,
  QUALITY_EXP_EFFICIENCY,
  RARITY_DIFF_EFFICIENCY,
  REBIRTH_INITIAL_GIFT,
  DEFAULT_REBUILD_CONFIG,
  INSTANT_UPGRADE_MAX_LEVEL,
  INSTANT_UPGRADE_COUNT_PER_REBIRTH,
  HERITAGE_REBIRTH_UNLOCKS,
  SIMULATION_BASE_DAILY,
  SIMULATION_DIMINISHING_THRESHOLD,
  DAILY_HERITAGE_LIMIT,
  HERITAGE_SAVE_VERSION,
} from '../../core/heritage';
import type { Faction } from '../hero/hero.types';
import { calcRebirthMultiplier } from '../prestige/RebirthSystem';

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
  private accelState: RebirthAccelerationState = {
    initialGiftClaimed: false,
    rebuildCompleted: false,
    instantUpgradeCount: 0,
    instantUpgradedBuildings: [],
  };

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

  update(_dt: number): void {
    // 传承系统不依赖帧更新
  }

  getState(): HeritageState {
    return { ...this.state };
  }

  getAccelerationState(): RebirthAccelerationState {
    return { ...this.accelState };
  }

  reset(): void {
    this.state = createInitialHeritageState();
    this.accelState = {
      initialGiftClaimed: false,
      rebuildCompleted: false,
      instantUpgradeCount: 0,
      instantUpgradedBuildings: [],
    };
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

  // ─── 武将传承 API ───────────────────────

  /**
   * 执行武将传承
   * 将源武将的经验和技能等级传给目标武将
   *
   * 规则：
   * - 源武将品质 ≥ 精良(2)
   * - 目标武将品质 ≥ 稀有(3)
   * - 同阵营额外+10%效率，不同阵营-10%
   * - 源武将传承后重置为1级
   */
  executeHeroHeritage(request: HeroHeritageRequest): HeritageResult {
    // 检查每日限制
    this.checkDailyReset();
    if (this.state.dailyHeritageCount >= DAILY_HERITAGE_LIMIT) {
      return this.failResult('hero', '今日传承次数已达上限');
    }

    const source = this.heroCallback?.(request.sourceHeroId);
    const target = this.heroCallback?.(request.targetHeroId);

    if (!source) return this.failResult('hero', '源武将不存在');
    if (!target) return this.failResult('hero', '目标武将不存在');
    if (source.id === target.id) return this.failResult('hero', '不能自我传承');

    // 品质检查
    if (source.quality < HERO_HERITAGE_RULE.minSourceQuality) {
      return this.failResult('hero', '源武将品质不足');
    }
    if (target.quality < HERO_HERITAGE_RULE.minTargetQuality) {
      return this.failResult('hero', '目标武将品质不足');
    }

    // 计算效率
    const baseEfficiency = QUALITY_EXP_EFFICIENCY[source.quality] ?? 0.5;
    const sameFaction = source.faction === target.faction;
    const factionModifier = sameFaction
      ? HERO_HERITAGE_RULE.sameFactionBonus
      : -HERO_HERITAGE_RULE.diffFactionPenalty;
    const efficiency = Math.min(1, Math.max(0, baseEfficiency + factionModifier));

    // 计算铜钱消耗
    const copperCost = source.level * HERO_HERITAGE_RULE.copperCostFactor;

    // 记录传承前数据
    const sourceBefore = this.makeHeroSummary(source);
    const targetBefore = this.makeHeroSummary(target);

    // 执行传承
    const transferredExp = Math.floor(source.exp * efficiency * request.options.expEfficiency);
    const newTargetExp = target.exp + transferredExp;

    // 更新目标武将
    this.updateHeroCallback?.(target.id, {
      exp: newTargetExp,
      ...(request.options.transferSkillLevels ? { skillLevels: [...source.skillLevels] } : {}),
      ...(request.options.transferFavorability ? { favorability: source.favorability } : {}),
    });

    // 重置源武将
    if (HERO_HERITAGE_RULE.sourceAfterState === 'reset') {
      this.updateHeroCallback?.(source.id, { level: 1, exp: 0 });
    }

    // 更新状态
    const sourceAfter = this.makeHeroSummary({
      ...source,
      level: HERO_HERITAGE_RULE.sourceAfterState === 'reset' ? 1 : source.level,
      exp: 0,
    });
    const targetAfter = this.makeHeroSummary({ ...target, exp: newTargetExp });

    this.recordHeritage('hero', source.id, target.id, efficiency, copperCost);

    return {
      success: true,
      type: 'hero',
      efficiency,
      copperCost,
      sourceBefore,
      sourceAfter,
      targetBefore,
      targetAfter,
    };
  }

  // ─── 装备传承 API ───────────────────────

  /**
   * 执行装备传承
   * 将源装备的强化等级传给目标装备
   *
   * 规则：
   * - 必须同部位
   * - 等级损耗-1
   * - 源装备被消耗
   */
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

    // 同部位检查
    if (EQUIPMENT_HERITAGE_RULE.mustSameSlot && source.slot !== target.slot) {
      return this.failResult('equipment', '源装备和目标装备必须同部位');
    }

    // 计算传承等级
    const rawLevel = request.options.transferEnhanceLevel
      ? source.enhanceLevel
      : 0;
    const transferredLevel = Math.max(0, rawLevel - EQUIPMENT_HERITAGE_RULE.levelLoss);

    // 品质差异影响
    const rarityDiff = target.rarity - source.rarity;
    let efficiency = 1.0;
    if (rarityDiff === 0) efficiency = RARITY_DIFF_EFFICIENCY['same'];
    else if (rarityDiff === 1) efficiency = RARITY_DIFF_EFFICIENCY['higher_1'];
    else if (rarityDiff >= 2) efficiency = RARITY_DIFF_EFFICIENCY['higher_2'];
    else if (rarityDiff === -1) efficiency = RARITY_DIFF_EFFICIENCY['lower_1'];
    else efficiency = RARITY_DIFF_EFFICIENCY['lower_2'];

    const finalLevel = Math.floor(transferredLevel * efficiency);

    // 铜钱消耗
    const copperCost = rawLevel * EQUIPMENT_HERITAGE_RULE.copperCostFactor;

    // 记录传承前数据
    const sourceBefore: HeritageDataSummary = { id: source.uid, level: source.enhanceLevel, value: source.enhanceLevel };
    const targetBefore: HeritageDataSummary = { id: target.uid, level: target.enhanceLevel, value: target.enhanceLevel };

    // 更新目标装备
    this.updateEquipCallback?.(target.uid, { enhanceLevel: finalLevel });

    // 消耗源装备
    if (EQUIPMENT_HERITAGE_RULE.sourceAfterState === 'consumed') {
      this.removeEquipCallback?.(source.uid);
    }

    const sourceAfter: HeritageDataSummary = {
      id: source.uid,
      level: EQUIPMENT_HERITAGE_RULE.sourceAfterState === 'consumed' ? 0 : 0,
      value: 0,
    };
    const targetAfter: HeritageDataSummary = { id: target.uid, level: finalLevel, value: finalLevel };

    this.recordHeritage('equipment', source.uid, target.uid, efficiency, copperCost);

    return {
      success: true,
      type: 'equipment',
      efficiency,
      copperCost,
      sourceBefore,
      sourceAfter,
      targetBefore,
      targetAfter,
    };
  }

  // ─── 经验传承 API ───────────────────────

  /**
   * 执行经验传承
   * 将源武将的部分经验传给目标武将
   *
   * 规则：
   * - 最大传承80%经验
   * - 效率70%
   * - 源武将最低10级
   */
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

    // 最低等级检查
    if (source.level < EXPERIENCE_HERITAGE_RULE.minSourceLevel) {
      return this.failResult('experience', `源武将等级不足${EXPERIENCE_HERITAGE_RULE.minSourceLevel}级`);
    }

    // 计算传承经验
    const ratio = Math.min(request.expRatio, EXPERIENCE_HERITAGE_RULE.maxExpRatio);
    const rawExp = source.exp * ratio;
    const transferredExp = Math.floor(rawExp * EXPERIENCE_HERITAGE_RULE.efficiency);

    // 铜钱消耗
    const copperCost = Math.floor(source.level * EXPERIENCE_HERITAGE_RULE.copperCostFactor * ratio);

    // 记录传承前数据
    const sourceBefore = this.makeHeroSummary(source);
    const targetBefore = this.makeHeroSummary(target);

    // 执行传承
    const newSourceExp = source.exp - Math.floor(rawExp);
    const newTargetExp = target.exp + transferredExp;

    this.updateHeroCallback?.(source.id, { exp: newSourceExp });
    this.updateHeroCallback?.(target.id, { exp: newTargetExp });

    const sourceAfter = this.makeHeroSummary({ ...source, exp: newSourceExp });
    const targetAfter = this.makeHeroSummary({ ...target, exp: newTargetExp });

    this.recordHeritage('experience', source.id, target.id, EXPERIENCE_HERITAGE_RULE.efficiency, copperCost);

    return {
      success: true,
      type: 'experience',
      efficiency: EXPERIENCE_HERITAGE_RULE.efficiency,
      copperCost,
      sourceBefore,
      sourceAfter,
      targetBefore,
      targetAfter,
    };
  }

  // ─── 转生后加速 API (#18) ───────────────

  /**
   * 领取转生后初始资源赠送
   */
  claimInitialGift(): { success: boolean; resources: Record<string, number>; reason?: string } {
    if (this.accelState.initialGiftClaimed) {
      return { success: false, resources: {}, reason: '已领取过初始资源' };
    }

    const resources = {
      grain: REBIRTH_INITIAL_GIFT.grain,
      copper: REBIRTH_INITIAL_GIFT.copper,
      enhanceStone: REBIRTH_INITIAL_GIFT.enhanceStone,
    };

    this.addResourcesCallback?.(resources);
    this.accelState.initialGiftClaimed = true;

    this.deps.eventBus.emit(`${EVENT_PREFIX}:initialGiftClaimed`, resources);

    return { success: true, resources };
  }

  /**
   * 一键重建 (#18)
   * 按优先级自动升级建筑
   */
  executeRebuild(config?: Partial<RebirthRebuildConfig>): {
    success: boolean;
    upgradedBuildings: string[];
    reason?: string;
  } {
    if (this.accelState.rebuildCompleted) {
      return { success: false, upgradedBuildings: [], reason: '已执行过一键重建' };
    }

    const cfg = { ...DEFAULT_REBUILD_CONFIG, ...config };
    const upgradedBuildings: string[] = [];

    for (const buildingId of cfg.buildingPriority) {
      const success = this.upgradeBuildingCallback?.(buildingId) ?? false;
      if (success) {
        upgradedBuildings.push(buildingId);
      }
    }

    this.accelState.rebuildCompleted = true;

    this.deps.eventBus.emit(`${EVENT_PREFIX}:rebuildCompleted`, { upgradedBuildings });

    return { success: true, upgradedBuildings };
  }

  /**
   * 瞬间升级低级建筑 (#18)
   */
  instantUpgrade(buildingId: string): { success: boolean; reason?: string } {
    const rebirthCount = this.rebirthCountCallback?.() ?? 0;
    const maxInstantUpgrades = rebirthCount * INSTANT_UPGRADE_COUNT_PER_REBIRTH;

    if (this.accelState.instantUpgradeCount >= maxInstantUpgrades) {
      return { success: false, reason: '瞬间升级次数已用完' };
    }

    if (this.accelState.instantUpgradedBuildings.includes(buildingId)) {
      return { success: false, reason: '该建筑已瞬间升级过' };
    }

    const success = this.upgradeBuildingCallback?.(buildingId) ?? false;
    if (!success) {
      return { success: false, reason: '建筑升级失败' };
    }

    this.accelState.instantUpgradeCount++;
    this.accelState.instantUpgradedBuildings.push(buildingId);

    return { success: true };
  }

  /**
   * 初始化转生后加速状态
   * 在每次转生后调用
   */
  initRebirthAcceleration(): void {
    this.accelState = {
      initialGiftClaimed: false,
      rebuildCompleted: false,
      instantUpgradeCount: 0,
      instantUpgradedBuildings: [],
    };
  }

  // ─── 转生次数解锁 (#19) ─────────────────

  /**
   * 获取转生次数解锁内容
   */
  getRebirthUnlocks(): Array<{
    rebirthCount: number;
    description: string;
    type: string;
    unlockId: string;
    unlocked: boolean;
  }> {
    const currentCount = this.rebirthCountCallback?.() ?? 0;
    return HERITAGE_REBIRTH_UNLOCKS.map(u => ({
      ...u,
      unlocked: currentCount >= u.rebirthCount,
    }));
  }

  /**
   * 检查指定内容是否已解锁
   */
  isUnlocked(unlockId: string): boolean {
    const currentCount = this.rebirthCountCallback?.() ?? 0;
    return HERITAGE_REBIRTH_UNLOCKS.some(
      u => u.unlockId === unlockId && currentCount >= u.rebirthCount,
    );
  }

  // ─── 收益模拟器 (#20) ───────────────────

  /**
   * 模拟转生收益
   * 对比立即转生和等待后转生的收益差异
   */
  simulateEarnings(params: HeritageSimulationParams): HeritageSimulationResult {
    const immediateMultiplier = calcRebirthMultiplier(params.currentRebirthCount + 1);
    const waitMultiplier = immediateMultiplier; // 倍率不受等待影响

    // 立即转生：从现在开始享受倍率
    const immediateDays = 30; // 模拟30天
    const immediateEarnings = this.calcEarnings(
      immediateMultiplier, immediateDays, params.dailyOnlineHours,
    );

    // 等待后转生：等待期间无倍率，之后享受倍率
    const waitDays = params.waitHours / 24;
    const remainingDays = Math.max(0, immediateDays - waitDays);
    const waitEarnings = this.calcEarnings(
      waitMultiplier, remainingDays, params.dailyOnlineHours,
    );

    // 计算边际收益递减拐点
    const diminishingReturnHour = SIMULATION_DIMINISHING_THRESHOLD;
    const recommendedWaitHours = this.findOptimalWaitTime(
      params, immediateMultiplier,
    );

    // 置信度：基于在线时长，越长越准
    const confidence = Math.min(1, params.dailyOnlineHours / 8);

    return {
      immediateMultiplier,
      waitMultiplier,
      immediateEarnings,
      waitEarnings,
      recommendedWaitHours,
      diminishingReturnHour,
      confidence,
    };
  }

  // ─── 存档 ───────────────────────────────

  /** 加载存档 */
  loadSaveData(data: HeritageSaveData): void {
    this.state = { ...data.state };
  }

  /** 导出存档 */
  getSaveData(): HeritageSaveData {
    return {
      version: HERITAGE_SAVE_VERSION,
      state: { ...this.state },
    };
  }

  // ─── 内部方法 ───────────────────────────

  /** 创建失败结果 */
  private failResult(type: HeritageType, reason: string): HeritageResult {
    return {
      success: false,
      reason,
      type,
      efficiency: 0,
      copperCost: 0,
      sourceBefore: { id: '', level: 0, value: 0 },
      sourceAfter: { id: '', level: 0, value: 0 },
      targetBefore: { id: '', level: 0, value: 0 },
      targetAfter: { id: '', level: 0, value: 0 },
    };
  }

  /** 创建武将数据摘要 */
  private makeHeroSummary(hero: HeroDataSource): HeritageDataSummary {
    return { id: hero.id, level: hero.level, value: hero.exp };
  }

  /** 记录传承历史 */
  private recordHeritage(
    type: HeritageType,
    sourceId: string,
    targetId: string,
    efficiency: number,
    copperCost: number,
  ): void {
    const record: HeritageRecord = {
      type,
      sourceId,
      targetId,
      efficiency,
      copperCost,
      timestamp: Date.now(),
    };

    this.state.heritageHistory.push(record);
    this.state.dailyHeritageCount++;

    switch (type) {
      case 'hero': this.state.heroHeritageCount++; break;
      case 'equipment': this.state.equipmentHeritageCount++; break;
      case 'experience': this.state.experienceHeritageCount++; break;
    }

    this.deps.eventBus.emit(`${EVENT_PREFIX}:completed`, record);
  }

  /** 检查并重置每日计数 */
  private checkDailyReset(): void {
    const today = getTodayStr();
    if (this.state.lastDailyReset !== today) {
      this.state.dailyHeritageCount = 0;
      this.state.lastDailyReset = today;
    }
  }

  /** 重置每日计数（由日历事件触发） */
  private resetDailyCount(): void {
    this.state.dailyHeritageCount = 0;
    this.state.lastDailyReset = getTodayStr();
  }

  /** 计算指定天数收益 */
  private calcEarnings(
    multiplier: number,
    days: number,
    dailyHours: number,
  ): Record<string, number> {
    return {
      gold: Math.floor(SIMULATION_BASE_DAILY.gold * multiplier * days * (dailyHours / 4)),
      grain: Math.floor(SIMULATION_BASE_DAILY.grain * multiplier * days * (dailyHours / 4)),
      prestige: Math.floor(SIMULATION_BASE_DAILY.prestige * days * (dailyHours / 4)),
    };
  }

  /** 寻找最优等待时间 */
  private findOptimalWaitTime(
    params: HeritageSimulationParams,
    multiplier: number,
  ): number {
    // 简化模型：边际收益递减拐点即为推荐等待时间
    // 实际应根据声望增长曲线计算
    const basePrestigePerHour = SIMULATION_BASE_DAILY.prestige / 24;
    const prestigeGain = basePrestigePerHour * params.waitHours;
    const marginalGain = basePrestigePerHour * multiplier;

    // 当边际收益开始递减时推荐转生
    if (marginalGain < basePrestigePerHour * 1.5) {
      return 0; // 立即转生
    }

    return SIMULATION_DIMINISHING_THRESHOLD;
  }
}
