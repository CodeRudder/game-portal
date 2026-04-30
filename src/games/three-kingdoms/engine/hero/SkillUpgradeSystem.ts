/**
 * 技能升级系统 — 聚合根
 *
 * 职责：技能升级消耗计算、技能效果增强、技能等级上限、觉醒技能突破前置
 * 规则：依赖 HeroSystem，通过回调解耦 ResourceSystem
 *
 * 策略推荐已拆分到 SkillStrategyRecommender.ts，通过依赖注入调用。
 *
 * @module engine/hero/SkillUpgradeSystem
 */

import type { GeneralData, SkillData, SkillType } from './hero.types';
import type { HeroSystem } from './HeroSystem';
import type { HeroStarSystem } from './HeroStarSystem';
import type { ISubsystem, ISystemDeps } from '../../core/types';
import { SkillStrategyRecommender } from './SkillStrategyRecommender';
// Re-export types from SkillStrategyRecommender for backward compatibility
export type {
  EnemyType,
  StrategyRecommendation,
} from './SkillStrategyRecommender';
import type { EnemyType, StrategyRecommendation } from './SkillStrategyRecommender';
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

/** 技能升级系统状态 */
export interface SkillUpgradeState {
  upgradeHistory: Record<string, number>;
  breakthroughSkillUnlocks: Record<string, number[]>;
}

/** 技能升级系统存档数据 (FIX-301: R3 保存/加载覆盖) */
export interface SkillUpgradeSaveData {
  /** 存档版本号 */
  version: number;
  /** 技能升级历史 */
  upgradeHistory: Record<string, number>;
  /** 突破技能解锁记录 */
  breakthroughSkillUnlocks: Record<string, number[]>;
}

/** 武将技能条目（heroSkills Map 的 value 类型） */
export interface HeroSkillEntry {
  skills: { level: number }[];
  unlockedSkills?: string[];
}

/** 额外效果描述 */
export interface ExtraEffect {
  skillIndex: number;
  name: string;
  description: string;
  bonus: number;
}

/** 技能解锁状态 */
export interface SkillUnlockState {
  heroId: string;
  unlockedSkills: {
    breakthroughLevel: number;
    skillIndex: number;
    unlockType: 'passive_enhance' | 'new_skill' | 'ultimate_enhance';
    description: string;
  }[];
}

// ── 常量 ──

const SKILL_UPGRADE_COST_TABLE: Record<number, { copper: number; skillBook: number }> = {
  1: { copper: 500, skillBook: 1 },
  2: { copper: 1500, skillBook: 1 },
  3: { copper: 4000, skillBook: 2 },
  4: { copper: 10000, skillBook: 2 },
};

const DEFAULT_SKILL_UPGRADE_COST = { copper: 10000, skillBook: 2 };
const BASE_SKILL_EFFECT = 1.0;
const SKILL_EFFECT_PER_LEVEL = 0.1;
const DEFAULT_SKILL_LEVEL_CAP = 5;
const AWAKEN_BREAKTHROUGH_REQUIREMENT = 1;
const EXTRA_EFFECT_MIN_LEVEL = 5;
const EXTRA_EFFECT_BONUS = 0.2;

const STAR_SKILL_CAP: Record<number, number> = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 8, 6: 10 };

/** 突破等级→技能解锁映射配置 */
const BREAKTHROUGH_SKILL_MAP: Record<number, {
  unlockType: 'passive_enhance' | 'new_skill' | 'ultimate_enhance';
  skillIndex: number;
  description: string;
}> = {
  10: { unlockType: 'passive_enhance', skillIndex: 1, description: '突破Lv10：被动技能强化，效果提升20%' },
  20: { unlockType: 'new_skill', skillIndex: 3, description: '突破Lv20：解锁新技能' },
  30: { unlockType: 'ultimate_enhance', skillIndex: 0, description: '突破Lv30：终极技能强化，伤害提升20%' },
  40: { unlockType: 'ultimate_enhance', skillIndex: 0, description: '突破Lv40：终极技能强化+，伤害提升35%' },
};

// ── 辅助函数 ──

function createEmptyState(): SkillUpgradeState {
  return { upgradeHistory: {}, breakthroughSkillUnlocks: {} };
}

function historyKey(generalId: string, skillIndex: number): string {
  return `${generalId}_${skillIndex}`;
}

// ── SkillUpgradeSystem ──

export class SkillUpgradeSystem implements ISubsystem {
  readonly name = 'skillUpgrade' as const;
  private coreDeps: ISystemDeps | null = null;
  private deps: SkillUpgradeDeps | null = null;
  private state: SkillUpgradeState;
  private heroSkills = new Map<string, HeroSkillEntry>();
  /** 策略推荐子系统（依赖注入） */
  private readonly strategyRecommender: SkillStrategyRecommender;

  private static readonly BREAKTHROUGH_SKILL_MAP: Record<number, { type: string; description: string }> = {
    10: { type: 'passive_enhance', description: '被动技能强化' },
    20: { type: 'new_skill', description: '解锁新技能' },
    30: { type: 'ultimate_enhance', description: '终极技能强化' },
    40: { type: 'ultimate_enhance_plus', description: '终极技能强化+' },
  };

  constructor() {
    this.state = createEmptyState();
    this.strategyRecommender = new SkillStrategyRecommender();
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void {
    this.coreDeps = deps;
    this.strategyRecommender.init(deps);
    gameLog.info('[SkillUpgradeSystem] initialized');
  }

  update(_dt: number): void { /* 无需每帧更新 */ }

  getState(): SkillUpgradeState {
    return {
      ...this.state,
      upgradeHistory: { ...this.state.upgradeHistory },
      breakthroughSkillUnlocks: { ...this.state.breakthroughSkillUnlocks },
    };
  }

  reset(): void { this.state = createEmptyState(); }

  // ── 依赖注入 ──

  setSkillUpgradeDeps(deps: SkillUpgradeDeps): void { this.deps = deps; }

  /** 获取策略推荐子系统 */
  getStrategyRecommender(): SkillStrategyRecommender { return this.strategyRecommender; }

  // ── 核心功能 ──

  upgradeSkill(
    generalId: string,
    skillIndex: number,
    materials: SkillUpgradeMaterials,
  ): SkillUpgradeResult {
    if (!this.deps) return this.failResult(generalId, skillIndex);

    const { heroSystem, heroStarSystem } = this.deps;
    const general = heroSystem.getGeneral(generalId);
    if (!general) {
      gameLog.info(`[SkillUpgradeSystem] general not found: ${generalId}`);
      return this.failResult(generalId, skillIndex);
    }

    if (skillIndex < 0 || skillIndex >= general.skills.length) {
      gameLog.info(`[SkillUpgradeSystem] invalid skill index: ${skillIndex}`);
      return this.failResult(generalId, skillIndex);
    }

    const skill = general.skills[skillIndex];
    const currentLevel = skill.level;

    if (skill.type === 'awaken' && !this.canUpgradeAwakenSkill(generalId)) {
      gameLog.info(`[SkillUpgradeSystem] awaken skill requires breakthrough: ${generalId}`);
      return this.failResult(generalId, skillIndex, currentLevel);
    }

    const star = heroStarSystem.getStar(generalId);
    const levelCap = this.getSkillLevelCap(star);
    if (currentLevel >= levelCap) {
      gameLog.info(`[SkillUpgradeSystem] skill level cap reached: ${currentLevel}/${levelCap}`);
      return this.failResult(generalId, skillIndex, currentLevel);
    }

    const cost = this.calculateUpgradeCost(currentLevel);

    if (materials.skillBooks < cost.skillBooks || materials.gold < cost.gold) {
      gameLog.info(`[SkillUpgradeSystem] insufficient materials: need ${JSON.stringify(cost)}, got ${JSON.stringify(materials)}`);
      return this.failResult(generalId, skillIndex, currentLevel);
    }

    if (!this.deps.canAffordResource('gold', cost.gold)) {
      gameLog.info('[SkillUpgradeSystem] insufficient gold resource');
      return this.failResult(generalId, skillIndex, currentLevel);
    }

    if (!this.deps.spendResource('gold', cost.gold)) {
      gameLog.info('[SkillUpgradeSystem] failed to spend gold');
      return this.failResult(generalId, skillIndex, currentLevel);
    }

    // Bug-3修复：扣除技能书
    if (!this.deps.spendResource('skillBook', cost.skillBooks)) {
      gameLog.info('[SkillUpgradeSystem] failed to spend skillBook');
      return this.failResult(generalId, skillIndex, currentLevel);
    }

    const effectBefore = this.getSkillEffect(generalId, skillIndex);
    const newLevel = currentLevel + 1;

    heroSystem.updateSkillLevel(generalId, skillIndex, newLevel);

    const key = historyKey(generalId, skillIndex);
    this.state.upgradeHistory[key] = (this.state.upgradeHistory[key] || 0) + 1;

    const effectAfter = this.getSkillEffect(generalId, skillIndex);
    gameLog.info(`[SkillUpgradeSystem] skill upgraded: ${generalId}[${skillIndex}] Lv${currentLevel}→${newLevel}`);

    return {
      success: true, generalId, skillIndex,
      previousLevel: currentLevel, currentLevel: newLevel,
      materialsUsed: cost, effectBefore, effectAfter,
    };
  }

  getSkillLevel(generalId: string, skillIndex: number): number {
    if (!this.deps) return 0;
    const general = this.deps.heroSystem.getGeneral(generalId);
    if (!general || skillIndex < 0 || skillIndex >= general.skills.length) return 0;
    return general.skills[skillIndex].level;
  }

  getSkillEffect(generalId: string, skillIndex: number): number {
    if (!this.deps) return BASE_SKILL_EFFECT;
    const general = this.deps.heroSystem.getGeneral(generalId);
    if (!general || skillIndex < 0 || skillIndex >= general.skills.length) return BASE_SKILL_EFFECT;
    const level = general.skills[skillIndex].level;
    return BASE_SKILL_EFFECT + (level - 1) * SKILL_EFFECT_PER_LEVEL;
  }

  getSkillLevelCap(starLevel: number): number {
    if (starLevel < 1) return STAR_SKILL_CAP[1] ?? DEFAULT_SKILL_LEVEL_CAP;
    return STAR_SKILL_CAP[starLevel] ?? DEFAULT_SKILL_LEVEL_CAP;
  }

  canUpgradeAwakenSkill(generalId: string): boolean {
    if (!this.deps) return false;
    const breakthroughStage = this.deps.heroStarSystem.getBreakthroughStage(generalId);
    return breakthroughStage >= AWAKEN_BREAKTHROUGH_REQUIREMENT;
  }

  /** 根据敌人类型推荐策略（委托给 SkillStrategyRecommender） */
  recommendStrategy(enemyType: EnemyType): StrategyRecommendation {
    return this.strategyRecommender.recommendStrategy(enemyType);
  }

  // ═══════════════════════════════════════════
  // P0-1: 突破解锁技能系统
  // ═══════════════════════════════════════════

  unlockSkillOnBreakthrough(heroId: string, breakthroughLevel: number): { unlocked: boolean; skillType: string; description: string } | null {
    const mapping = SkillUpgradeSystem.BREAKTHROUGH_SKILL_MAP[breakthroughLevel];
    if (!mapping) return null;

    let state = this.heroSkills.get(heroId);
    if (!state) {
      const general = this.deps?.heroSystem.getGeneral(heroId);
      if (!general) return null;
      state = { skills: general.skills.map(s => ({ level: s.level })), unlockedSkills: [] };
      this.heroSkills.set(heroId, state);
    }

    const key = `breakthrough_${breakthroughLevel}`;
    if (state.unlockedSkills?.includes(key)) return null;
    if (!state.unlockedSkills) state.unlockedSkills = [];
    state.unlockedSkills.push(key);

    const bkKey = `${heroId}_${breakthroughLevel}`;
    if (!this.state.breakthroughSkillUnlocks[bkKey]) {
      this.state.breakthroughSkillUnlocks[bkKey] = [mapping.type === 'passive_enhance' ? 1 : mapping.type === 'new_skill' ? 3 : 0];
    }

    gameLog.info(`[SkillUpgradeSystem] breakthrough skill unlocked: ${heroId} Lv${breakthroughLevel} → ${mapping.description}`);
    return { unlocked: true, skillType: mapping.type, description: mapping.description };
  }

  getSkillUnlockState(heroId: string): { breakthroughLevel: number; unlocked: boolean; skillType: string; description: string }[] {
    const state = this.heroSkills.get(heroId);
    const results: { breakthroughLevel: number; unlocked: boolean; skillType: string; description: string }[] = [];
    for (const [level, mapping] of Object.entries(SkillUpgradeSystem.BREAKTHROUGH_SKILL_MAP)) {
      const key = `breakthrough_${level}`;
      results.push({
        breakthroughLevel: Number(level),
        unlocked: state?.unlockedSkills?.includes(key) ?? false,
        skillType: mapping.type,
        description: mapping.description,
      });
    }
    return results;
  }

  // ═══════════════════════════════════════════
  // P0-2: 技能CD减少和额外效果
  // ═══════════════════════════════════════════

  getCooldownReduce(heroId: string, skillIndex: number): number {
    const state = this.heroSkills.get(heroId);
    if (!state) return 0;
    const skill = state.skills[skillIndex];
    if (!skill) return 0;
    return Math.min(skill.level * 0.05, 0.30);
  }

  hasExtraEffect(heroId: string, skillIndex: number): boolean {
    const state = this.heroSkills.get(heroId);
    if (!state) return false;
    const skill = state.skills[skillIndex];
    return skill ? skill.level >= 5 : false;
  }

  getExtraEffect(heroId: string, skillIndex: number): ExtraEffect | null {
    if (!this.hasExtraEffect(heroId, skillIndex)) return null;
    if (!this.deps) return null;
    const general = this.deps.heroSystem.getGeneral(heroId);
    if (!general || skillIndex < 0 || skillIndex >= general.skills.length) return null;

    const skill = general.skills[skillIndex];
    const level = skill.level;
    const bonus = EXTRA_EFFECT_BONUS * (level - EXTRA_EFFECT_MIN_LEVEL + 1);

    return {
      skillIndex,
      name: `${skill.name}·额外效果`,
      description: `技能等级${level}时解锁，额外提升${Math.round(bonus * 100)}%效果`,
      bonus,
    };
  }

  // ── 内部方法 ──

  private calculateUpgradeCost(currentLevel: number): SkillUpgradeMaterials {
    const entry = SKILL_UPGRADE_COST_TABLE[currentLevel] ?? DEFAULT_SKILL_UPGRADE_COST;
    return { skillBooks: entry.skillBook, gold: entry.copper };
  }

  private failResult(generalId: string, skillIndex: number, level = 0): SkillUpgradeResult {
    return {
      success: false, generalId, skillIndex,
      previousLevel: level, currentLevel: level,
      materialsUsed: { skillBooks: 0, gold: 0 },
      effectBefore: BASE_SKILL_EFFECT + (level - 1) * SKILL_EFFECT_PER_LEVEL,
      effectAfter: BASE_SKILL_EFFECT + (level - 1) * SKILL_EFFECT_PER_LEVEL,
    };
  }

  // ═══════════════════════════════════════════
  // 序列化/反序列化 (FIX-301: R3 保存/加载覆盖)
  // ═══════════════════════════════════════════

  private static readonly SAVE_VERSION = 1;

  /** 序列化技能升级系统状态 */
  serialize(): SkillUpgradeSaveData {
    return {
      version: SkillUpgradeSystem.SAVE_VERSION,
      upgradeHistory: { ...this.state.upgradeHistory },
      breakthroughSkillUnlocks: { ...this.state.breakthroughSkillUnlocks },
    };
  }

  /** 反序列化恢复技能升级系统状态 */
  deserialize(data: SkillUpgradeSaveData): void {
    if (!data) {
      this.state = createEmptyState();
      return;
    }
    if (data.version !== SkillUpgradeSystem.SAVE_VERSION) {
      gameLog.warn(`SkillUpgradeSystem: 存档版本不匹配 (期望 ${SkillUpgradeSystem.SAVE_VERSION}，实际 ${data.version})`);
    }
    this.state = {
      upgradeHistory: { ...(data.upgradeHistory ?? {}) },
      breakthroughSkillUnlocks: { ...(data.breakthroughSkillUnlocks ?? {}) },
    };
  }
}
