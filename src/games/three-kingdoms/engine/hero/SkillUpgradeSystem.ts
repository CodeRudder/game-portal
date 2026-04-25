/**
 * 技能升级系统 — 聚合根
 *
 * 职责：技能升级消耗计算、技能效果增强、技能等级上限、觉醒技能突破前置、策略推荐
 * 规则：依赖 HeroSystem，通过回调解耦 ResourceSystem
 * 功能点：技能升级消耗、技能效果增强、技能等级上限（受星级影响）、觉醒技能突破前置、策略推荐
 *
 * @module engine/hero/SkillUpgradeSystem
 */

import type { GeneralData, SkillData, SkillType } from './hero.types';
import type { HeroSystem } from './HeroSystem';
import type { HeroStarSystem } from './HeroStarSystem';
import type { ISubsystem, ISystemDeps } from '../../core/types';
import { gameLog } from '../../core/logger';

// ── 类型 ──

export type ResourceSpendFn = (resourceType: string, amount: number) => boolean;
export type ResourceCheckFn = (resourceType: string, amount: number) => boolean;
export type ResourceGetFn = (resourceType: string) => number;

/** 技能升级系统业务依赖 */
export interface SkillUpgradeDeps {
  heroSystem: HeroSystem;
  heroStarSystem: HeroStarSystem;
  spendResource: ResourceSpendFn;
  canAffordResource: ResourceCheckFn;
  getResourceAmount: ResourceGetFn;
}

/** 技能升级材料 */
export interface SkillUpgradeMaterials {
  /** 技能书数量 */
  skillBooks: number;
  /** 铜钱数量 */
  gold: number;
}

/** 技能升级结果 */
export interface SkillUpgradeResult {
  success: boolean;
  generalId: string;
  skillIndex: number;
  previousLevel: number;
  currentLevel: number;
  materialsUsed: SkillUpgradeMaterials;
  effectBefore: number;
  effectAfter: number;
}

/** 敌人类型 */
export type EnemyType = 'burn-heavy' | 'physical' | 'boss';

/** 策略推荐结果 */
export interface StrategyRecommendation {
  enemyType: EnemyType;
  /** 推荐的技能类型优先级 */
  prioritySkillTypes: SkillType[];
  /** 推荐的属性侧重 */
  focusStats: string[];
  /** 策略描述 */
  description: string;
}

/** 技能升级系统状态 */
export interface SkillUpgradeState {
  /** 各武将各技能的升级次数记录 */
  upgradeHistory: Record<string, number>; // `${generalId}_${skillIndex}` → totalUpgrades
  /** 突破解锁的技能记录 Map<`${generalId}_${breakthroughLevel}`, skillIndex[]> */
  breakthroughSkillUnlocks: Record<string, number[]>;
}

/** 技能解锁状态 */
export interface SkillUnlockState {
  /** 武将ID */
  heroId: string;
  /** 已解锁的突破技能列表 */
  unlockedSkills: {
    /** 突破等级 */
    breakthroughLevel: number;
    /** 解锁的技能索引 */
    skillIndex: number;
    /** 解锁类型 */
    unlockType: 'passive_enhance' | 'new_skill' | 'ultimate_enhance';
    /** 解锁描述 */
    description: string;
  }[];
}

/** 额外效果描述 */
export interface ExtraEffect {
  /** 技能索引 */
  skillIndex: number;
  /** 额外效果名称 */
  name: string;
  /** 额外效果描述 */
  description: string;
  /** 效果数值加成 */
  bonus: number;
}

// ── 常量 ──

/** 每级技能书消耗 */
const SKILL_BOOK_COST_PER_LEVEL = 1;

/** 每级铜钱消耗基数 */
const GOLD_COST_BASE = 100;

/** 每级铜钱消耗增长系数 */
const GOLD_COST_GROWTH = 50;

/** 基础技能效果值（从技能描述中的百分比提取的基数） */
const BASE_SKILL_EFFECT = 1.0;

/** 每级技能效果增量 */
const SKILL_EFFECT_PER_LEVEL = 0.1;

/** 默认技能等级上限 */
const DEFAULT_SKILL_LEVEL_CAP = 5;

/** 星级→技能等级上限映射 */
const STAR_SKILL_CAP: Record<number, number> = {
  1: 3,
  2: 4,
  3: 5,
  4: 6,
  5: 8,
  6: 10,
};

/** 觉醒技能最低突破阶段要求 */
const AWAKEN_BREAKTHROUGH_REQUIREMENT = 1;

/** 每级CD减少量（秒） */
const CD_REDUCE_PER_LEVEL = 0.5;

/** 触发额外效果的最低技能等级 */
const EXTRA_EFFECT_MIN_LEVEL = 5;

/** 额外效果加成比例 */
const EXTRA_EFFECT_BONUS = 0.2;

/** 突破等级→技能解锁映射配置 */
const BREAKTHROUGH_SKILL_MAP: Record<number, {
  unlockType: 'passive_enhance' | 'new_skill' | 'ultimate_enhance';
  skillIndex: number;
  description: string;
}> = {
  10: {
    unlockType: 'passive_enhance',
    skillIndex: 1,
    description: '突破Lv10：被动技能强化，效果提升20%',
  },
  20: {
    unlockType: 'new_skill',
    skillIndex: 3,
    description: '突破Lv20：解锁新技能',
  },
  30: {
    unlockType: 'ultimate_enhance',
    skillIndex: 0,
    description: '突破Lv30：终极技能强化，伤害提升20%',
  },
};

/** 策略推荐配置 */
const STRATEGY_CONFIG: Record<EnemyType, StrategyRecommendation> = {
  'burn-heavy': {
    enemyType: 'burn-heavy',
    prioritySkillTypes: ['passive', 'active'],
    focusStats: ['intelligence', 'defense'],
    description: '多灼烧敌人→高智力+治疗型推荐',
  },
  'physical': {
    enemyType: 'physical',
    prioritySkillTypes: ['passive', 'faction'],
    focusStats: ['defense', 'speed'],
    description: '多物理敌人→高防+坦克型推荐',
  },
  'boss': {
    enemyType: 'boss',
    prioritySkillTypes: ['active', 'awaken'],
    focusStats: ['attack', 'intelligence'],
    description: 'BOSS关→高爆发+控制型推荐',
  },
};

// ── 辅助函数 ──

function createEmptyState(): SkillUpgradeState {
  return { upgradeHistory: {}, breakthroughSkillUnlocks: {} };
}

function historyKey(generalId: string, skillIndex: number): string {
  return `${generalId}_${skillIndex}`;
}

// ── SkillUpgradeSystem ──

/**
 * 技能升级系统
 *
 * 管理武将技能升级、技能效果计算、技能等级上限（受星级影响）、觉醒技能突破前置、策略推荐。
 */
export class SkillUpgradeSystem implements ISubsystem {
  readonly name = 'skillUpgrade' as const;
  private coreDeps: ISystemDeps | null = null;
  private deps: SkillUpgradeDeps | null = null;
  private state: SkillUpgradeState;

  constructor() {
    this.state = createEmptyState();
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void {
    this.coreDeps = deps;
    gameLog.info('[SkillUpgradeSystem] initialized');
  }

  update(_dt: number): void {
    // 技能升级系统无需每帧更新
  }

  getState(): SkillUpgradeState {
    return {
      ...this.state,
      upgradeHistory: { ...this.state.upgradeHistory },
      breakthroughSkillUnlocks: { ...this.state.breakthroughSkillUnlocks },
    };
  }

  reset(): void {
    this.state = createEmptyState();
  }

  // ── 依赖注入 ──

  /** 注入业务依赖（资源回调 + HeroSystem + HeroStarSystem） */
  setSkillUpgradeDeps(deps: SkillUpgradeDeps): void {
    this.deps = deps;
  }

  // ── 核心功能 ──

  /**
   * 升级技能
   *
   * 消耗技能书和铜钱，提升技能等级。
   * 受星级等级上限约束，觉醒技能需要突破前置。
   *
   * @param generalId - 武将ID
   * @param skillIndex - 技能索引
   * @param materials - 提供的材料
   * @returns 升级结果
   */
  upgradeSkill(
    generalId: string,
    skillIndex: number,
    materials: SkillUpgradeMaterials,
  ): SkillUpgradeResult {
    if (!this.deps) {
      return this.failResult(generalId, skillIndex);
    }

    const { heroSystem, heroStarSystem } = this.deps;
    const general = heroSystem.getGeneral(generalId);
    if (!general) {
      gameLog.info(`[SkillUpgradeSystem] general not found: ${generalId}`);
      return this.failResult(generalId, skillIndex);
    }

    // 检查技能索引是否有效
    if (skillIndex < 0 || skillIndex >= general.skills.length) {
      gameLog.info(`[SkillUpgradeSystem] invalid skill index: ${skillIndex}`);
      return this.failResult(generalId, skillIndex);
    }

    const skill = general.skills[skillIndex];
    const currentLevel = skill.level;

    // 检查觉醒技能是否需要突破
    if (skill.type === 'awaken' && !this.canUpgradeAwakenSkill(generalId)) {
      gameLog.info(`[SkillUpgradeSystem] awaken skill requires breakthrough: ${generalId}`);
      return this.failResult(generalId, skillIndex, currentLevel);
    }

    // 检查技能等级上限
    const star = heroStarSystem.getStar(generalId);
    const levelCap = this.getSkillLevelCap(star);
    if (currentLevel >= levelCap) {
      gameLog.info(`[SkillUpgradeSystem] skill level cap reached: ${currentLevel}/${levelCap}`);
      return this.failResult(generalId, skillIndex, currentLevel);
    }

    // 计算升级消耗
    const cost = this.calculateUpgradeCost(currentLevel);

    // 检查材料是否充足
    if (materials.skillBooks < cost.skillBooks || materials.gold < cost.gold) {
      gameLog.info(`[SkillUpgradeSystem] insufficient materials: need ${JSON.stringify(cost)}, got ${JSON.stringify(materials)}`);
      return this.failResult(generalId, skillIndex, currentLevel);
    }

    // 检查实际资源是否充足
    if (!this.deps.canAffordResource('gold', cost.gold)) {
      gameLog.info('[SkillUpgradeSystem] insufficient gold resource');
      return this.failResult(generalId, skillIndex, currentLevel);
    }

    // 消耗资源
    if (!this.deps.spendResource('gold', cost.gold)) {
      gameLog.info('[SkillUpgradeSystem] failed to spend gold');
      return this.failResult(generalId, skillIndex, currentLevel);
    }

    // 计算效果
    const effectBefore = this.getSkillEffect(generalId, skillIndex);
    const newLevel = currentLevel + 1;

    // 更新技能等级到 HeroSystem
    heroSystem.updateSkillLevel(generalId, skillIndex, newLevel);

    // 记录升级历史
    const key = historyKey(generalId, skillIndex);
    this.state.upgradeHistory[key] = (this.state.upgradeHistory[key] || 0) + 1;

    const effectAfter = this.getSkillEffect(generalId, skillIndex);

    gameLog.info(`[SkillUpgradeSystem] skill upgraded: ${generalId}[${skillIndex}] Lv${currentLevel}→${newLevel}`);

    return {
      success: true,
      generalId,
      skillIndex,
      previousLevel: currentLevel,
      currentLevel: newLevel,
      materialsUsed: cost,
      effectBefore,
      effectAfter,
    };
  }

  /**
   * 获取技能等级
   */
  getSkillLevel(generalId: string, skillIndex: number): number {
    if (!this.deps) return 0;
    const general = this.deps.heroSystem.getGeneral(generalId);
    if (!general || skillIndex < 0 || skillIndex >= general.skills.length) return 0;
    return general.skills[skillIndex].level;
  }

  /**
   * 获取技能效果值
   *
   * 效果 = 基础效果 + (技能等级 - 1) × 每级增量
   * 例如 Lv1 = 1.0, Lv2 = 1.1, Lv3 = 1.2 ...
   */
  getSkillEffect(generalId: string, skillIndex: number): number {
    if (!this.deps) return BASE_SKILL_EFFECT;
    const general = this.deps.heroSystem.getGeneral(generalId);
    if (!general || skillIndex < 0 || skillIndex >= general.skills.length) return BASE_SKILL_EFFECT;
    const level = general.skills[skillIndex].level;
    return BASE_SKILL_EFFECT + (level - 1) * SKILL_EFFECT_PER_LEVEL;
  }

  /**
   * 获取技能等级上限（受星级影响）
   *
   * 星级越高，技能等级上限越高。
   * @param starLevel - 武将星级
   */
  getSkillLevelCap(starLevel: number): number {
    if (starLevel < 1) return STAR_SKILL_CAP[1] ?? DEFAULT_SKILL_LEVEL_CAP;
    return STAR_SKILL_CAP[starLevel] ?? DEFAULT_SKILL_LEVEL_CAP;
  }

  /**
   * 检查觉醒技能是否可以升级（需要突破）
   *
   * 觉醒技能需要武将完成至少1次突破才能升级。
   */
  canUpgradeAwakenSkill(generalId: string): boolean {
    if (!this.deps) return false;
    const breakthroughStage = this.deps.heroStarSystem.getBreakthroughStage(generalId);
    return breakthroughStage >= AWAKEN_BREAKTHROUGH_REQUIREMENT;
  }

  /**
   * 根据敌人类型推荐策略
   *
   * @param enemyType - 敌人类型
   */
  recommendStrategy(enemyType: EnemyType): StrategyRecommendation {
    return { ...STRATEGY_CONFIG[enemyType] };
  }

  // ── 内部方法 ──

  /** 计算升级到下一级的材料消耗 */
  private calculateUpgradeCost(currentLevel: number): SkillUpgradeMaterials {
    return {
      skillBooks: SKILL_BOOK_COST_PER_LEVEL,
      gold: GOLD_COST_BASE + (currentLevel - 1) * GOLD_COST_GROWTH,
    };
  }

  /** 生成失败结果 */
  private failResult(generalId: string, skillIndex: number, level = 0): SkillUpgradeResult {
    return {
      success: false,
      generalId,
      skillIndex,
      previousLevel: level,
      currentLevel: level,
      materialsUsed: { skillBooks: 0, gold: 0 },
      effectBefore: BASE_SKILL_EFFECT + (level - 1) * SKILL_EFFECT_PER_LEVEL,
      effectAfter: BASE_SKILL_EFFECT + (level - 1) * SKILL_EFFECT_PER_LEVEL,
    };
  }
}
