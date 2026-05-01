/**
 * 技能策略推荐子系统
 *
 * 职责：根据敌人类型推荐技能升级策略
 * 从 SkillUpgradeSystem.ts 拆分而来，通过依赖注入解耦。
 *
 * @module engine/hero/SkillStrategyRecommender
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { SkillType } from './hero.types';

// ── 类型 ──

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

// ── 常量 ──

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

/**
 * 技能策略推荐器
 *
 * 根据敌人类型提供技能升级优先级和属性侧重推荐。
 * 被 SkillUpgradeSystem 通过依赖注入调用。
 */
export class SkillStrategyRecommender implements ISubsystem {
  readonly name = 'skillStrategyRecommender' as const;
  private deps: ISystemDeps | null = null;

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void { /* 无需每帧更新 */ }
  getState(): unknown { return { strategies: Object.keys(STRATEGY_CONFIG) }; }
  reset(): void { /* 无状态，无需重置 */ }

  // ─────────────────────────────────────────
  // 1. 策略推荐
  // ─────────────────────────────────────────

  /**
   * 根据敌人类型推荐策略
   *
   * @param enemyType - 敌人类型
   * @returns 策略推荐结果
   */
  recommendStrategy(enemyType: EnemyType): StrategyRecommendation {
    // DEF-035: 无效输入防护，返回默认策略
    if (!enemyType || !STRATEGY_CONFIG[enemyType]) {
      return { ...STRATEGY_CONFIG['physical'] };
    }
    return { ...STRATEGY_CONFIG[enemyType] };
  }

  /**
   * 获取所有可用的策略配置
   *
   * @returns 所有敌人类型及其策略推荐
   */
  getAllStrategies(): Readonly<Record<EnemyType, StrategyRecommendation>> {
    return STRATEGY_CONFIG;
  }

  /**
   * 获取指定敌人类型的推荐技能类型优先级
   *
   * @param enemyType - 敌人类型
   * @returns 技能类型优先级列表
   */
  getPrioritySkillTypes(enemyType: EnemyType): SkillType[] {
    // DEF-035: 无效输入防护
    if (!enemyType || !STRATEGY_CONFIG[enemyType]) {
      return [...STRATEGY_CONFIG['physical'].prioritySkillTypes];
    }
    return [...STRATEGY_CONFIG[enemyType].prioritySkillTypes];
  }

  /**
   * 获取指定敌人类型的推荐属性侧重
   *
   * @param enemyType - 敌人类型
   * @returns 属性侧重列表
   */
  getFocusStats(enemyType: EnemyType): string[] {
    // DEF-035: 无效输入防护
    if (!enemyType || !STRATEGY_CONFIG[enemyType]) {
      return [...STRATEGY_CONFIG['physical'].focusStats];
    }
    return [...STRATEGY_CONFIG[enemyType].focusStats];
  }
}
