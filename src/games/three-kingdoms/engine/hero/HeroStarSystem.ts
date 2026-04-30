/**
 * 武将升星 + 突破系统 — 聚合根
 *
 * 功能点：#11 碎片获取、#12 升星消耗与效果、#13 碎片进度可视化、#14 突破系统
 * 规则：依赖 HeroSystem 的碎片接口，通过回调解耦 ResourceSystem
 * @module engine/hero/HeroStarSystem
 */

import type {
  StarUpResult, StarUpPreview, StarUpCost, FragmentProgress,
  BreakthroughResult, BreakthroughPreview,
  StarSystemState, StarSystemSaveData, StarSystemDeps,
} from './star-up.types';
import { FragmentSource } from './star-up.types';
import type { GeneralStats, GeneralData } from './hero.types';
import { HeroSystem } from './HeroSystem';
import type { ISubsystem, ISystemDeps } from '../../core/types';
import {
  STAR_UP_FRAGMENT_COST, STAR_UP_GOLD_COST, getStarMultiplier,
  BREAKTHROUGH_TIERS, MAX_BREAKTHROUGH_STAGE, INITIAL_LEVEL_CAP, FINAL_LEVEL_CAP,
  STAGE_FRAGMENT_DROPS, SHOP_FRAGMENT_EXCHANGE, STAR_SYSTEM_SAVE_VERSION,
  RESOURCE_TYPE_GOLD, RESOURCE_TYPE_BREAKTHROUGH_STONE, MAX_STAR_LEVEL,
} from './star-up-config';
import { GENERAL_DEF_MAP } from './hero-config';
import { gameLog } from '../../core/logger';

// ── 导出类型 ──

/** 碎片获取结果 */
export interface FragmentGainResult {
  generalId: string;
  count: number;
  source: FragmentSource;
}

/** 商店兑换结果 */
export interface ShopExchangeResult {
  success: boolean;
  generalId: string;
  count: number;
  goldSpent: number;
}

/** 突破后技能解锁回调 */
export type SkillUnlockCallback = (heroId: string, breakthroughLevel: number) => { unlocked: boolean; skillType: string; description: string } | null;

// ── 辅助函数 ──

function createEmptyStarState(): StarSystemState {
  return { stars: {}, breakthroughStages: {}, dailyExchangeCount: {} };
}

function failedStarUp(generalId: string, star = 1): StarUpResult {
  const zero = { attack: 0, defense: 0, intelligence: 0, speed: 0 };
  return { success: false, generalId, previousStar: star, currentStar: star,
    fragmentsSpent: 0, goldSpent: 0, statsBefore: zero, statsAfter: zero };
}

function failedBreakthrough(generalId: string): BreakthroughResult {
  return { success: false, generalId, previousLevelCap: 0, newLevelCap: 0,
    breakthroughStage: 0, fragmentsSpent: 0, goldSpent: 0, breakthroughStonesSpent: 0 };
}

// ── HeroStarSystem ──

/**
 * 武将升星 + 突破系统
 * 管理武将升星、碎片获取、突破等核心玩法。
 * 通过 StarSystemDeps 解耦对资源系统的直接依赖。
 */
export class HeroStarSystem implements ISubsystem {
  readonly name = 'heroStar' as const;
  private coreDeps: ISystemDeps | null = null;
  private deps: StarSystemDeps | null = null;
  private heroSystem: HeroSystem;
  private state: StarSystemState;
  /** 突破后技能解锁回调（由引擎层注入 SkillUpgradeSystem.unlockSkillOnBreakthrough） */
  private skillUnlockCallback: SkillUnlockCallback | null = null;

  constructor(heroSystem: HeroSystem) {
    this.heroSystem = heroSystem;
    this.state = createEmptyStarState();
  }

  // ── ISubsystem ──
  init(deps: ISystemDeps): void { this.coreDeps = deps; }
  update(_dt: number): void { /* 预留 */ }
  getState(): unknown { return this.serialize(); }
  reset(): void { this.state = createEmptyStarState(); }
  setDeps(deps: StarSystemDeps): void { this.deps = deps; }

  /** 设置突破后技能解锁回调 */
  setSkillUnlockCallback(callback: SkillUnlockCallback): void {
    this.skillUnlockCallback = callback;
  }

  // ═══════════════════════════════════════════
  // 1. 碎片获取途径（功能点 #11）
  // ═══════════════════════════════════════════

  /** 招募重复武将 → 碎片转化（碎片数量由品质决定） */
  handleDuplicateFragments(generalId: string, quality: import('./hero.types').Quality): FragmentGainResult {
    const count = this.heroSystem.handleDuplicate(generalId, quality);
    return { generalId, count, source: FragmentSource.DUPLICATE };
  }

  /** 关卡掉落碎片（根据关卡ID查找掉落表） */
  gainFragmentsFromStage(stageId: string, rng: () => number = Math.random): FragmentGainResult[] {
    const results: FragmentGainResult[] = [];
    for (const drop of STAGE_FRAGMENT_DROPS) {
      if (drop.stageId !== stageId) continue;
      const { min, max } = drop.dropRange;
      const count = min + Math.floor(rng() * (max - min + 1));
      if (count > 0) {
        this.heroSystem.addFragment(drop.generalId, count);
        results.push({ generalId: drop.generalId, count, source: FragmentSource.STAGE_DROP });
      }
    }
    return results;
  }

  /** 商店兑换碎片（铜钱兑换，受每日限购） */
  exchangeFragmentsFromShop(generalId: string, count: number): ShopExchangeResult {
    if (!this.deps || !Number.isFinite(count) || count <= 0) return { success: false, generalId, count: 0, goldSpent: 0 };

    const config = SHOP_FRAGMENT_EXCHANGE.find((c) => c.generalId === generalId);
    if (!config) return { success: false, generalId, count: 0, goldSpent: 0 };

    // DEF-001 fix: 跟踪每日已兑换次数，剩余可购 = dailyLimit - dailyExchangeCount
    const alreadyExchanged = this.state.dailyExchangeCount[generalId] ?? 0;
    const remaining = config.dailyLimit - alreadyExchanged;
    if (remaining <= 0) return { success: false, generalId, count: 0, goldSpent: 0 };

    const actualCount = Math.min(count, remaining);
    const totalGold = actualCount * config.pricePerFragment;

    if (!this.deps.canAffordResource(RESOURCE_TYPE_GOLD, totalGold)) return { success: false, generalId, count: 0, goldSpent: 0 };
    if (!this.deps.spendResource(RESOURCE_TYPE_GOLD, totalGold)) return { success: false, generalId, count: 0, goldSpent: 0 };

    // R2-FIX-P03: 捕获溢出碎片，退还对应铜钱
    const overflow = this.heroSystem.addFragment(generalId, actualCount);
    if (overflow > 0) {
      const refundGold = overflow * config.pricePerFragment;
      if (this.deps.addResource) {
        this.deps.addResource(RESOURCE_TYPE_GOLD, refundGold);
      }
      gameLog.warn(`[HeroStarSystem] shop fragment overflow: ${generalId} overflow=${overflow}, refund=${refundGold} gold`);
    }
    // 累加已兑换次数
    this.state.dailyExchangeCount[generalId] = alreadyExchanged + actualCount;
    return { success: true, generalId, count: actualCount, goldSpent: totalGold };
  }

  /** 重置所有武将的商店碎片每日已兑换次数（跨日调用） */
  resetDailyExchangeLimits(): void {
    this.state.dailyExchangeCount = {};
  }

  // ═══════════════════════════════════════════
  // 1b. 碎片获取途径扩展（F3.04 P0-5）
  // ═══════════════════════════════════════════

  /**
   * 活动获取碎片
   *
   * 通过限时活动、签到活动等途径获取武将碎片。
   * @param heroId - 武将ID
   * @param source - 活动来源描述（如 '限时活动·赤壁之战'）
   * @param amount - 碎片数量
   * @returns 碎片获取结果
   */
  addFragmentFromActivity(heroId: string, source: string, amount: number): FragmentGainResult {
    if (!Number.isFinite(amount) || amount <= 0) return { generalId: heroId, count: 0, source: FragmentSource.ACTIVITY };
    const overflow = this.heroSystem.addFragment(heroId, amount);
    const actual = amount - overflow;
    // R2-FIX-P03: 溢出碎片转化为铜钱（1碎片 = 100铜钱）
    if (overflow > 0 && this.deps?.addResource) {
      const goldCompensation = overflow * HeroSystem.FRAGMENT_TO_GOLD_RATE;
      this.deps.addResource(RESOURCE_TYPE_GOLD, goldCompensation);
      gameLog.info(`[HeroStarSystem] activity fragment overflow: ${heroId} overflow=${overflow}, gold=${goldCompensation}`);
    }
    gameLog.info(`[HeroStarSystem] activity fragment: ${heroId} +${actual} from "${source}"`);
    return { generalId: heroId, count: actual, source: FragmentSource.ACTIVITY };
  }

  /**
   * 远征获取碎片
   *
   * 通过远征系统挂机获取武将碎片。
   * @param heroId - 武将ID
   * @param amount - 碎片数量
   * @returns 碎片获取结果
   */
  addFragmentFromExpedition(heroId: string, amount: number): FragmentGainResult {
    if (!Number.isFinite(amount) || amount <= 0) return { generalId: heroId, count: 0, source: FragmentSource.EXPEDITION };
    const overflow = this.heroSystem.addFragment(heroId, amount);
    const actual = amount - overflow;
    // R2-FIX-P03: 溢出碎片转化为铜钱（1碎片 = 100铜钱）
    if (overflow > 0 && this.deps?.addResource) {
      const goldCompensation = overflow * HeroSystem.FRAGMENT_TO_GOLD_RATE;
      this.deps.addResource(RESOURCE_TYPE_GOLD, goldCompensation);
      gameLog.info(`[HeroStarSystem] expedition fragment overflow: ${heroId} overflow=${overflow}, gold=${goldCompensation}`);
    }
    gameLog.info(`[HeroStarSystem] expedition fragment: ${heroId} +${actual}`);
    return { generalId: heroId, count: actual, source: FragmentSource.EXPEDITION };
  }

  // ═══════════════════════════════════════════
  // 2. 升星消耗与效果（功能点 #12）
  // ═══════════════════════════════════════════

  /** 获取升星消耗（碎片+铜钱） */
  getStarUpCost(currentStar: number): StarUpCost {
    const idx = Math.min(currentStar, STAR_UP_FRAGMENT_COST.length - 1);
    const goldIdx = Math.min(currentStar, STAR_UP_GOLD_COST.length - 1);
    return { fragments: STAR_UP_FRAGMENT_COST[idx], gold: STAR_UP_GOLD_COST[goldIdx] };
  }

  /** 升星预览（不执行实际操作） */
  getStarUpPreview(generalId: string): StarUpPreview | null {
    const general = this.heroSystem.getGeneral(generalId);
    if (!general) return null;

    const currentStar = this.getStar(generalId);
    if (currentStar >= MAX_STAR_LEVEL) return null;

    const cost = this.getStarUpCost(currentStar);
    const fragmentOwned = this.heroSystem.getFragments(generalId);

    return {
      generalId, currentStar, targetStar: currentStar + 1,
      fragmentCost: cost.fragments, goldCost: cost.gold,
      fragmentOwned, fragmentSufficient: fragmentOwned >= cost.fragments,
      statsDiff: {
        before: this.calculateStarStats(general, currentStar),
        after: this.calculateStarStats(general, currentStar + 1),
      },
    };
  }

  /** 执行升星（消耗碎片+铜钱，提升星级，属性按倍率增长） */
  starUp(generalId: string): StarUpResult {
    const general = this.heroSystem.getGeneral(generalId);
    if (!general) return failedStarUp(generalId);

    const currentStar = this.getStar(generalId);
    if (currentStar >= MAX_STAR_LEVEL) return failedStarUp(generalId, currentStar);

    const cost = this.getStarUpCost(currentStar);
    if (!this.deps) return failedStarUp(generalId, currentStar);

    const currentFragments = this.heroSystem.getFragments(generalId);
    if (currentFragments < cost.fragments) return failedStarUp(generalId, currentStar);
    if (!this.deps.canAffordResource(RESOURCE_TYPE_GOLD, cost.gold)) return failedStarUp(generalId, currentStar);

    // 执行消耗
    const statsBefore = this.calculateStarStats(general, currentStar);
    this.heroSystem.useFragments(generalId, cost.fragments);
    this.deps.spendResource(RESOURCE_TYPE_GOLD, cost.gold);

    const newStar = currentStar + 1;
    this.state.stars[generalId] = newStar;
    const statsAfter = this.calculateStarStats(general, newStar);

    return {
      success: true, generalId, previousStar: currentStar, currentStar: newStar,
      fragmentsSpent: cost.fragments, goldSpent: cost.gold, statsBefore, statsAfter,
    };
  }

  /** 计算指定星级下的属性：基础属性 × 星级倍率 */
  calculateStarStats(general: GeneralData, star: number): GeneralStats {
    const m = getStarMultiplier(star);
    return {
      attack: Math.floor(general.baseStats.attack * m),
      defense: Math.floor(general.baseStats.defense * m),
      intelligence: Math.floor(general.baseStats.intelligence * m),
      speed: Math.floor(general.baseStats.speed * m),
    };
  }

  // ═══════════════════════════════════════════
  // 3. 碎片进度可视化（功能点 #13）
  // ═══════════════════════════════════════════

  /** 获取碎片升星进度 */
  getFragmentProgress(generalId: string): FragmentProgress | null {
    const def = GENERAL_DEF_MAP.get(generalId);
    if (!def) return null;

    const currentStar = this.getStar(generalId);
    const currentFragments = this.heroSystem.getFragments(generalId);
    const requiredFragments = currentStar < MAX_STAR_LEVEL ? this.getStarUpCost(currentStar).fragments : 0;

    const percentage = requiredFragments > 0
      ? Math.min(100, Math.floor((currentFragments / requiredFragments) * 100))
      : (currentStar >= MAX_STAR_LEVEL ? 100 : 0);

    return {
      generalId, generalName: def.name, currentFragments, requiredFragments,
      percentage, currentStar,
      canStarUp: currentStar < MAX_STAR_LEVEL && currentFragments >= requiredFragments,
    };
  }

  /** 批量获取碎片进度 */
  getAllFragmentProgress(): FragmentProgress[] {
    return this.heroSystem.getAllGenerals()
      .map((g) => this.getFragmentProgress(g.id))
      .filter((p): p is FragmentProgress => p !== null);
  }

  // ═══════════════════════════════════════════
  // 4. 突破系统（功能点 #14）
  // ═══════════════════════════════════════════

  /** 获取武将当前等级上限（根据突破阶段确定） */
  getLevelCap(generalId: string): number {
    const stage = this.state.breakthroughStages[generalId] ?? 0;
    if (!Number.isFinite(stage) || stage <= 0) return INITIAL_LEVEL_CAP;
    if (stage >= BREAKTHROUGH_TIERS.length) return FINAL_LEVEL_CAP;
    return BREAKTHROUGH_TIERS[stage - 1].levelCapAfter;
  }

  /** 获取武将当前突破阶段 */
  getBreakthroughStage(generalId: string): number {
    return this.state.breakthroughStages[generalId] ?? 0;
  }

  /** 获取下一突破阶段配置（已满突破返回 null） */
  getNextBreakthroughTier(generalId: string): import('./star-up.types').BreakthroughTier | null {
    const currentStage = this.getBreakthroughStage(generalId);
    if (currentStage >= MAX_BREAKTHROUGH_STAGE) return null;
    return { ...BREAKTHROUGH_TIERS[currentStage] };
  }

  /** 突破预览 */
  getBreakthroughPreview(generalId: string): BreakthroughPreview | null {
    const general = this.heroSystem.getGeneral(generalId);
    if (!general) return null;

    const currentStage = this.getBreakthroughStage(generalId);
    if (currentStage >= MAX_BREAKTHROUGH_STAGE) return null;

    const tier = BREAKTHROUGH_TIERS[currentStage];
    const currentLevelCap = this.getLevelCap(generalId);
    const levelReady = general.level >= currentLevelCap;

    let resourceSufficient = false;
    if (this.deps) {
      resourceSufficient =
        this.heroSystem.getFragments(generalId) >= tier.fragmentCost
        && this.deps.canAffordResource(RESOURCE_TYPE_GOLD, tier.goldCost)
        && this.deps.canAffordResource(RESOURCE_TYPE_BREAKTHROUGH_STONE, tier.breakthroughStoneCost);
    }

    return {
      generalId, currentLevel: general.level, currentLevelCap,
      nextLevelCap: tier.levelCapAfter, nextBreakthroughStage: currentStage + 1,
      fragmentCost: tier.fragmentCost, goldCost: tier.goldCost,
      breakthroughStoneCost: tier.breakthroughStoneCost,
      levelReady, resourceSufficient, canBreakthrough: levelReady && resourceSufficient,
    };
  }

  /** 执行突破（条件：等级达到上限 + 资源充足 → 等级上限提升） */
  breakthrough(generalId: string): BreakthroughResult {
    const general = this.heroSystem.getGeneral(generalId);
    if (!general) return failedBreakthrough(generalId);

    const currentStage = this.getBreakthroughStage(generalId);
    if (currentStage >= MAX_BREAKTHROUGH_STAGE) return failedBreakthrough(generalId);

    const currentLevelCap = this.getLevelCap(generalId);
    if (general.level < currentLevelCap) return failedBreakthrough(generalId);
    if (!this.deps) return failedBreakthrough(generalId);

    const tier = BREAKTHROUGH_TIERS[currentStage];
    const hasFragments = this.heroSystem.getFragments(generalId) >= tier.fragmentCost;
    const hasGold = this.deps.canAffordResource(RESOURCE_TYPE_GOLD, tier.goldCost);
    const hasStone = this.deps.canAffordResource(RESOURCE_TYPE_BREAKTHROUGH_STONE, tier.breakthroughStoneCost);
    if (!hasFragments || !hasGold || !hasStone) return failedBreakthrough(generalId);

    // 执行消耗
    this.heroSystem.useFragments(generalId, tier.fragmentCost);
    this.deps.spendResource(RESOURCE_TYPE_GOLD, tier.goldCost);
    this.deps.spendResource(RESOURCE_TYPE_BREAKTHROUGH_STONE, tier.breakthroughStoneCost);

    const newStage = currentStage + 1;
    this.state.breakthroughStages[generalId] = newStage;

    // P0-1: 突破成功后调用技能解锁回调
    if (this.skillUnlockCallback) {
      this.skillUnlockCallback(generalId, newStage);
    }

    return {
      success: true, generalId, previousLevelCap: currentLevelCap,
      newLevelCap: tier.levelCapAfter, breakthroughStage: newStage,
      fragmentsSpent: tier.fragmentCost, goldSpent: tier.goldCost,
      breakthroughStonesSpent: tier.breakthroughStoneCost,
    };
  }

  /** 检查武将是否可以突破 */
  canBreakthrough(generalId: string): boolean {
    return this.getBreakthroughPreview(generalId)?.canBreakthrough ?? false;
  }

  // ═══════════════════════════════════════════
  // 5. 星级查询 + 序列化
  // ═══════════════════════════════════════════

  /** 获取武将星级 */
  getStar(generalId: string): number { return this.state.stars[generalId] ?? 1; }

  /** 获取所有武将星级 */
  getAllStars(): Readonly<Record<string, number>> { return { ...this.state.stars }; }

  serialize(): StarSystemSaveData {
    return {
      version: STAR_SYSTEM_SAVE_VERSION,
      state: {
        stars: { ...this.state.stars },
        breakthroughStages: { ...this.state.breakthroughStages },
        dailyExchangeCount: { ...this.state.dailyExchangeCount },
      },
    };
  }

  deserialize(data: StarSystemSaveData): void {
    if (!data || !data.state) {
      this.state = { stars: {}, breakthroughStages: {}, dailyExchangeCount: {} };
      return;
    }
    if (data.version !== STAR_SYSTEM_SAVE_VERSION) {
      gameLog.warn(`HeroStarSystem: 存档版本不匹配 (期望 ${STAR_SYSTEM_SAVE_VERSION}，实际 ${data.version})`);
    }
    this.state = {
      stars: { ...(data.state.stars ?? {}) },
      breakthroughStages: { ...(data.state.breakthroughStages ?? {}) },
      dailyExchangeCount: { ...(data.state.dailyExchangeCount ?? {}) },
    };
  }
}
