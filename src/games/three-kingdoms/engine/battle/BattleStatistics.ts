/**
 * 战斗系统 — 战斗统计模块
 *
 * 职责：战斗结束后的伤害统计、连击统计、摘要生成
 * 从 BattleEngine 拆分出来，降低主文件复杂度
 *
 * @module engine/battle/BattleStatistics
 */

import type { BattleState } from './battle.types';
import { BattleOutcome, StarRating } from './battle.types';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────
// 类型
// ─────────────────────────────────────────

/** 战斗统计数据 */
export interface BattleStats {
  /** 我方总伤害 */
  allyTotalDamage: number;
  /** 敌方总伤害 */
  enemyTotalDamage: number;
  /** 单次最高伤害 */
  maxSingleDamage: number;
  /** 最大连击数（连续暴击） */
  maxCombo: number;
}

// ─────────────────────────────────────────
// BattleStatisticsSubsystem — ISubsystem 包装
// ─────────────────────────────────────────

/**
 * 战斗统计子系统
 *
 * 实现 ISubsystem 接口，封装战斗统计的纯函数。
 * 提供依赖注入入口和状态管理能力。
 */
export class BattleStatisticsSubsystem implements ISubsystem {
  readonly name = 'battleStatistics' as const;
  private sysDeps: ISystemDeps | null = null;
  private lastStats: BattleStats | null = null;

  /** ISubsystem.init — 注入依赖 */
  init(deps: ISystemDeps): void {
    this.sysDeps = deps;
  }

  /** ISubsystem.update — 统计模块按需调用，不需要每帧更新 */
  update(_dt: number): void {
    // 战斗统计在战斗结束时调用，不需要每帧更新
  }

  /** ISubsystem.getState — 返回最近一次统计数据 */
  getState(): { lastStats: BattleStats | null } {
    return { lastStats: this.lastStats };
  }

  /** ISubsystem.reset — 重置统计数据 */
  reset(): void {
    this.lastStats = null;
  }

  /**
   * 计算战斗统计数据（委托给纯函数）
   */
  calculate(state: BattleState): BattleStats {
    this.lastStats = calculateBattleStats(state);
    return this.lastStats;
  }

  /**
   * 生成战斗摘要（委托给纯函数）
   */
  summary(
    outcome: BattleOutcome,
    stars: StarRating,
    turns: number,
    allyAlive: number,
  ): string {
    return generateSummary(outcome, stars, turns, allyAlive);
  }
}

// ─────────────────────────────────────────
// 函数
// ─────────────────────────────────────────

/**
 * 计算战斗统计数据
 *
 * 遍历行动日志，统计双方总伤害、单次最高伤害、最大连击数
 */
export function calculateBattleStats(state: BattleState): BattleStats {
  let allyTotalDamage = 0;
  let enemyTotalDamage = 0;
  let maxSingleDamage = 0;
  let currentCombo = 0;
  let maxCombo = 0;

  for (const action of state.actionLog) {
    const isAlly = action.actorSide === 'ally';

    for (const [, result] of Object.entries(action.damageResults)) {
      // DEF-037: NaN 防护，防止 NaN damage 累积导致统计全 NaN
      const dmg = Number.isFinite(result.damage) ? result.damage : 0;
      if (isAlly) {
        allyTotalDamage += dmg;
      } else {
        enemyTotalDamage += dmg;
      }

      maxSingleDamage = Math.max(maxSingleDamage, dmg);

      // 连击统计（连续暴击）
      if (result.isCritical) {
        currentCombo++;
        maxCombo = Math.max(maxCombo, currentCombo);
      } else {
        currentCombo = 0;
      }
    }
  }

  return {
    allyTotalDamage,
    enemyTotalDamage,
    maxSingleDamage,
    maxCombo,
  };
}

/**
 * 生成战斗摘要文本
 *
 * 根据胜负结果、星级、回合数、存活人数生成可读的摘要字符串
 */
export function generateSummary(
  outcome: BattleOutcome,
  stars: StarRating,
  turns: number,
  allyAlive: number,
): string {
  if (outcome === BattleOutcome.VICTORY) {
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    return `战斗胜利！${starStr}，用时${turns}回合，存活${allyAlive}人`;
  }
  if (outcome === BattleOutcome.DEFEAT) {
    return `战斗失败，第${turns}回合全军覆没`;
  }
  return `战斗平局，${turns}回合内未能分出胜负`;
}
