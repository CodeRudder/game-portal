/**
 * 武将觉醒系统 — 聚合根
 *
 * 觉醒条件：Lv100 + 6星 + 4阶突破 + 品质≥RARE
 * 觉醒效果：属性+50%、等级上限120、解锁终极技能、全局被动
 * 设计来源：HER-heroes-prd.md §13
 *
 * @module engine/hero/AwakeningSystem
 */

import type { GeneralStats } from './hero.types';
import { QUALITY_ORDER } from './hero.types';
import {
  AWAKENING_MAX_LEVEL, AWAKENING_REQUIREMENTS, AWAKENING_COST,
  AWAKENING_STAT_MULTIPLIER, AWAKENING_SKILLS, AWAKENING_PASSIVE,
  AWAKENING_SAVE_VERSION, AWAKENING_EXP_TABLE, AWAKENING_GOLD_TABLE,
} from './awakening-config';
import type { AwakeningSkill } from './awakening-config';
import type { HeroSystem } from './HeroSystem';
import type { HeroStarSystem } from './HeroStarSystem';
import type { ISubsystem, ISystemDeps } from '../../core/types';
import { gameLog } from '../../core/logger';

// ── 导出类型 ──

/** 觉醒系统依赖（资源消耗接口） */
export interface AwakeningDeps {
  canAffordResource: (type: string, amount: number) => boolean;
  spendResource: (type: string, amount: number) => boolean;
  getResourceAmount: (type: string) => number;
  addResource: (type: string, amount: number) => void;
}

/** 觉醒状态（每个武将） */
export interface AwakeningHeroState {
  isAwakened: boolean;
  awakeningLevel: number; // 当前固定为1，预留扩展
}

/** 觉醒系统整体状态 */
export interface AwakeningSystemState {
  heroes: Record<string, AwakeningHeroState>;
}

/** 觉醒系统存档数据 */
export interface AwakeningSaveData {
  version: number;
  state: AwakeningSystemState;
}

/** 觉醒条件检查结果 */
export interface AwakeningEligibility {
  eligible: boolean;
  failures: string[];
  details: {
    level: { required: number; current: number; met: boolean };
    stars: { required: number; current: number; met: boolean };
    breakthrough: { required: number; current: number; met: boolean };
    quality: { required: string; current: string; met: boolean };
    owned: boolean;
  };
}

/** 觉醒执行结果 */
export interface AwakeningResult {
  success: boolean;
  generalId: string;
  costSpent: typeof AWAKENING_COST | null;
  awakenedStats: GeneralStats | null;
  skillUnlocked: AwakeningSkill | null;
  reason?: string;
}

/** 觉醒被动加成汇总 */
export interface AwakeningPassiveSummary {
  awakenedCount: number;
  factionStacks: Record<string, number>;
  globalStatBonus: number;
  resourceBonus: number;
  expBonus: number;
}

// ── 辅助 ──

function createEmptyState(): AwakeningSystemState {
  return { heroes: {} };
}

// ── AwakeningSystem ──

/**
 * 武将觉醒系统
 * 管理觉醒条件检查、执行、属性计算、终极技能、被动效果。
 */
export class AwakeningSystem implements ISubsystem {
  readonly name = 'awakening' as const;
  private coreDeps: ISystemDeps | null = null;
  private deps: AwakeningDeps | null = null;
  private heroSystem: HeroSystem;
  private starSystem: HeroStarSystem;
  private state: AwakeningSystemState;

  constructor(heroSystem: HeroSystem, starSystem: HeroStarSystem) {
    this.heroSystem = heroSystem;
    this.starSystem = starSystem;
    this.state = createEmptyState();
  }

  // ── ISubsystem ──
  init(deps: ISystemDeps): void { this.coreDeps = deps; }
  update(_dt: number): void { /* 预留 */ }
  getState(): unknown { return this.serialize(); }
  reset(): void { this.state = createEmptyState(); }
  setDeps(deps: AwakeningDeps): void { this.deps = deps; }

  // ═══════════════════════════════════════════
  // 1. 觉醒条件检查
  // ═══════════════════════════════════════════

  /** 检查武将是否满足觉醒条件（PRD HER-13.2） */
  checkAwakeningEligible(heroId: string): AwakeningEligibility {
    const general = this.heroSystem.getGeneral(heroId);
    const failures: string[] = [];

    // 武将是否拥有
    if (!general) {
      return {
        eligible: false,
        failures: ['武将未拥有'],
        details: {
          level: { required: AWAKENING_REQUIREMENTS.minLevel, current: 0, met: false },
          stars: { required: AWAKENING_REQUIREMENTS.minStars, current: 0, met: false },
          breakthrough: { required: AWAKENING_REQUIREMENTS.minBreakthrough, current: 0, met: false },
          quality: { required: 'RARE+', current: 'NONE', met: false },
          owned: false,
        },
      };
    }

    const currentLevel = general.level;
    const currentStars = this.starSystem.getStar(heroId);
    const currentBreakthrough = this.starSystem.getBreakthroughStage(heroId);
    const currentQuality = general.quality;
    const currentQualityOrder = QUALITY_ORDER[currentQuality];

    const levelMet = currentLevel >= AWAKENING_REQUIREMENTS.minLevel;
    const starsMet = currentStars >= AWAKENING_REQUIREMENTS.minStars;
    const breakthroughMet = currentBreakthrough >= AWAKENING_REQUIREMENTS.minBreakthrough;
    const qualityMet = currentQualityOrder >= AWAKENING_REQUIREMENTS.minQualityOrder;

    if (!levelMet) failures.push(`等级不足: ${currentLevel}/${AWAKENING_REQUIREMENTS.minLevel}`);
    if (!starsMet) failures.push(`星级不足: ${currentStars}/${AWAKENING_REQUIREMENTS.minStars}`);
    if (!breakthroughMet) failures.push(`突破不足: ${currentBreakthrough}/${AWAKENING_REQUIREMENTS.minBreakthrough}`);
    if (!qualityMet) failures.push(`品质不足: ${currentQuality} (需要RARE+)`);

    return {
      eligible: levelMet && starsMet && breakthroughMet && qualityMet,
      failures,
      details: {
        level: { required: AWAKENING_REQUIREMENTS.minLevel, current: currentLevel, met: levelMet },
        stars: { required: AWAKENING_REQUIREMENTS.minStars, current: currentStars, met: starsMet },
        breakthrough: { required: AWAKENING_REQUIREMENTS.minBreakthrough, current: currentBreakthrough, met: breakthroughMet },
        quality: { required: 'RARE+', current: currentQuality, met: qualityMet },
        owned: true,
      },
    };
  }

  // ═══════════════════════════════════════════
  // 2. 觉醒执行
  // ═══════════════════════════════════════════

  /** 执行觉醒：条件检查→资源检查→消耗→更新状态→解锁技能 */
  awaken(heroId: string): AwakeningResult {
    // 检查是否已觉醒
    const heroState = this.state.heroes[heroId];
    if (heroState?.isAwakened) {
      return {
        success: false,
        generalId: heroId,
        costSpent: null,
        awakenedStats: null,
        skillUnlocked: null,
        reason: '武将已觉醒',
      };
    }

    // 检查觉醒条件
    const eligibility = this.checkAwakeningEligible(heroId);
    if (!eligibility.eligible) {
      return {
        success: false,
        generalId: heroId,
        costSpent: null,
        awakenedStats: null,
        skillUnlocked: null,
        reason: `条件不满足: ${eligibility.failures.join(', ')}`,
      };
    }

    // 检查资源依赖
    if (!this.deps) {
      return {
        success: false,
        generalId: heroId,
        costSpent: null,
        awakenedStats: null,
        skillUnlocked: null,
        reason: '资源系统未初始化',
      };
    }

    // 检查资源是否充足
    const resourceFailures = this.checkResources(heroId);
    if (resourceFailures.length > 0) {
      return {
        success: false,
        generalId: heroId,
        costSpent: null,
        awakenedStats: null,
        skillUnlocked: null,
        reason: `资源不足: ${resourceFailures.join(', ')}`,
      };
    }

    // 执行资源消耗
    const spentOk = this.spendResources(heroId);
    if (!spentOk) {
      return {
        success: false,
        generalId: heroId,
        costSpent: null,
        awakenedStats: null,
        skillUnlocked: null,
        reason: '资源消耗失败（并发竞争或资源不足）',
      };
    }

    // 更新觉醒状态
    this.state.heroes[heroId] = {
      isAwakened: true,
      awakeningLevel: 1,
    };

    // FIX-303: 验证武将存在性（移除非空断言）
    const general = this.heroSystem.getGeneral(heroId);
    if (!general) {
      // 回滚觉醒状态
      delete this.state.heroes[heroId];
      return {
        success: false,
        generalId: heroId,
        costSpent: null,
        awakenedStats: null,
        skillUnlocked: null,
        reason: `武将 ${heroId} 不存在`,
      };
    }

    // 计算觉醒后属性
    const awakenedStats = this.calculateAwakenedStats(heroId);

    // 获取觉醒技能
    const skill = this.getAwakeningSkill(heroId);

    gameLog.info(`[AwakeningSystem] ${general.name}(${heroId}) 觉醒成功！属性+50%，等级上限→${AWAKENING_MAX_LEVEL}`);

    return {
      success: true,
      generalId: heroId,
      costSpent: { ...AWAKENING_COST },
      awakenedStats,
      skillUnlocked: skill,
    };
  }

  // ═══════════════════════════════════════════
  // 3. 觉醒状态查询
  // ═══════════════════════════════════════════

  /** 获取武将觉醒状态 */
  getAwakeningState(heroId: string): AwakeningHeroState {
    return this.state.heroes[heroId] ?? { isAwakened: false, awakeningLevel: 0 };
  }

  /** 检查武将是否已觉醒 */
  isAwakened(heroId: string): boolean {
    return this.state.heroes[heroId]?.isAwakened ?? false;
  }

  /** 获取觉醒后等级上限（已觉醒=120，未觉醒=原上限） */
  getAwakenedLevelCap(heroId: string): number {
    return this.isAwakened(heroId) ? AWAKENING_MAX_LEVEL : this.starSystem.getLevelCap(heroId);
  }

  // ═══════════════════════════════════════════
  // 4. 觉醒技能
  // ═══════════════════════════════════════════

  /** 获取武将觉醒终极技能（PRD HER-13.4.4） */
  getAwakeningSkill(heroId: string): AwakeningSkill | null {
    const skill = AWAKENING_SKILLS[heroId];
    return skill ? { ...skill } : null;
  }

  /** 觉醒技能预览（不要求已觉醒，用于觉醒前展示） */
  getAwakeningSkillPreview(heroId: string): AwakeningSkill | null {
    return this.getAwakeningSkill(heroId);
  }

  // ═══════════════════════════════════════════
  // 5. 觉醒后属性计算
  // ═══════════════════════════════════════════

  /**
   * 计算觉醒后属性
   * 公式：觉醒后属性 = 原始属性 × 觉醒倍率(1.5)
   */
  calculateAwakenedStats(heroId: string): GeneralStats {
    const general = this.heroSystem.getGeneral(heroId);
    if (!general) {
      return { attack: 0, defense: 0, intelligence: 0, speed: 0 };
    }

    if (!this.isAwakened(heroId)) {
      return { ...general.baseStats };
    }

    // 觉醒后属性 = 基础属性 × 觉醒倍率(1.5)
    const m = AWAKENING_STAT_MULTIPLIER;
    return {
      attack: Math.floor(general.baseStats.attack * m),
      defense: Math.floor(general.baseStats.defense * m),
      intelligence: Math.floor(general.baseStats.intelligence * m),
      speed: Math.floor(general.baseStats.speed * m),
    };
  }

  /** 计算觉醒属性加成差值（觉醒后 - 觉醒前） */
  getAwakeningStatDiff(heroId: string): GeneralStats {
    const base = this.heroSystem.getGeneral(heroId)?.baseStats ?? { attack: 0, defense: 0, intelligence: 0, speed: 0 };
    const awakened = this.calculateAwakenedStats(heroId);
    return {
      attack: awakened.attack - base.attack,
      defense: awakened.defense - base.defense,
      intelligence: awakened.intelligence - base.intelligence,
      speed: awakened.speed - base.speed,
    };
  }

  // ═══════════════════════════════════════════
  // 6. 觉醒被动效果
  // ═══════════════════════════════════════════

  /** 计算全局觉醒被动加成汇总（PRD HER-13.5） */
  getPassiveSummary(): AwakeningPassiveSummary {
    const factionStacks: Record<string, number> = {};
    let globalStacks = 0;
    let resourceStacks = 0;
    let expStacks = 0;

    for (const [heroId, heroState] of Object.entries(this.state.heroes)) {
      if (!heroState.isAwakened) continue;

      // 阵营光环叠加
      const general = this.heroSystem.getGeneral(heroId);
      if (general) {
        factionStacks[general.faction] = (factionStacks[general.faction] ?? 0) + 1;
      }

      // 全局属性叠加（最多5次）
      if (globalStacks < AWAKENING_PASSIVE.globalMaxStacks) globalStacks++;
      // 资源加成叠加（最多3次）
      if (resourceStacks < AWAKENING_PASSIVE.resourceMaxStacks) resourceStacks++;
      // 经验加成叠加（最多3次）
      if (expStacks < AWAKENING_PASSIVE.expMaxStacks) expStacks++;
    }

    // 限制阵营光环最大叠加
    for (const faction of Object.keys(factionStacks)) {
      factionStacks[faction] = Math.min(factionStacks[faction], AWAKENING_PASSIVE.factionMaxStacks);
    }

    return {
      awakenedCount: Object.values(this.state.heroes).filter((h) => h.isAwakened).length,
      factionStacks,
      globalStatBonus: globalStacks * AWAKENING_PASSIVE.globalStatBonus,
      resourceBonus: resourceStacks * AWAKENING_PASSIVE.resourceBonus,
      expBonus: expStacks * AWAKENING_PASSIVE.expBonus,
    };
  }

  // ═══════════════════════════════════════════
  // 7. 觉醒经验（101~120级）
  // ═══════════════════════════════════════════

  /** 获取觉醒后指定等级升级所需经验 */
  getAwakeningExpRequired(level: number): number {
    return AWAKENING_EXP_TABLE[level] ?? 0;
  }

  /** 获取觉醒后指定等级升级所需铜钱 */
  getAwakeningGoldRequired(level: number): number {
    return AWAKENING_GOLD_TABLE[level] ?? 0;
  }

  // ═══════════════════════════════════════════
  // 8. 序列化/反序列化
  // ═══════════════════════════════════════════

  serialize(): AwakeningSaveData {
    return { version: AWAKENING_SAVE_VERSION, state: { heroes: { ...this.state.heroes } } };
  }

  deserialize(data: AwakeningSaveData): void {
    if (!data || !data.state) {
      this.state = { heroes: {} };
      return;
    }
    if (data.version !== AWAKENING_SAVE_VERSION) {
      gameLog.warn(`AwakeningSystem: 存档版本不匹配 (期望 ${AWAKENING_SAVE_VERSION}，实际 ${data.version})`);
    }
    this.state = { heroes: { ...(data.state.heroes ?? {}) } };
  }

  // ═══════════════════════════════════════════
  // 私有方法
  // ═══════════════════════════════════════════

  /** 检查资源是否充足，返回不足的资源列表 */
  private checkResources(heroId: string): string[] {
    if (!this.deps) return ['资源系统未初始化'];
    const failures: string[] = [];
    const checks: [string, number][] = [
      ['gold', AWAKENING_COST.copper],
      ['breakthroughStone', AWAKENING_COST.breakthroughStones],
      ['skillBook', AWAKENING_COST.skillBooks],
      ['awakeningStone', AWAKENING_COST.awakeningStones],
    ];
    for (const [type, cost] of checks) {
      if (!this.deps.canAffordResource(type, cost)) {
        failures.push(`${type}: ${this.deps.getResourceAmount(type)}/${cost}`);
      }
    }
    const fragments = this.heroSystem.getFragments(heroId);
    if (fragments < AWAKENING_COST.fragments) {
      failures.push(`碎片: ${fragments}/${AWAKENING_COST.fragments}`);
    }
    return failures;
  }

  /** 执行资源消耗（DEF-021: 原子性消耗，任一失败则回滚已消耗资源） */
  private spendResources(heroId: string): boolean {
    if (!this.deps) return false;

    // DEF-021: 逐个消耗，记录已消耗的资源以便回滚
    const spent: Array<{ type: string; amount: number }> = [];

    const trySpend = (type: string, amount: number): boolean => {
      if (amount <= 0) return true;
      const ok = this.deps!.spendResource(type, amount);
      if (ok) {
        spent.push({ type, amount });
      }
      return ok;
    };

    if (!trySpend('gold', AWAKENING_COST.copper)) { this.rollbackSpent(spent); return false; }
    if (!trySpend('breakthroughStone', AWAKENING_COST.breakthroughStones)) { this.rollbackSpent(spent); return false; }
    if (!trySpend('skillBook', AWAKENING_COST.skillBooks)) { this.rollbackSpent(spent); return false; }
    if (!trySpend('awakeningStone', AWAKENING_COST.awakeningStones)) { this.rollbackSpent(spent); return false; }

    const fragOk = this.heroSystem.useFragments(heroId, AWAKENING_COST.fragments);
    if (!fragOk) {
      // 回滚已消耗的其他资源（碎片未消耗，不需要回滚碎片）
      this.rollbackSpent(spent);
      return false;
    }

    return true;
  }

  /** 回滚已消耗的资源 */
  private rollbackSpent(spent: Array<{ type: string; amount: number }>): void {
    for (const { type, amount } of spent) {
      try {
        if (this.deps?.addResource) {
          (this.deps as { addResource?: (type: string, amount: number) => void }).addResource?.(type, amount);
        }
      } catch {
        gameLog.error?.(`[AwakeningSystem] rollback failed: ${type}×${amount}`);
      }
    }
  }
}
