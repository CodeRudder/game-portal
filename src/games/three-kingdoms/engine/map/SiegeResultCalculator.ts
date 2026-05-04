/**
 * 攻占结果结算计算器 (I14)
 *
 * 战斗结束后计算伤亡、将领受伤、奖励发放、生成事件记录。
 * 纯函数式计算，无状态依赖。
 *
 * @module engine/map/SiegeResultCalculator
 * @see flows.md MAP-F06-14
 */

import type { BattleCompletedEvent } from './SiegeBattleSystem';
import type { InjuryLevel } from './expedition-types';

// ─── Types ───

/** 战斗结果等级 */
export type BattleOutcome =
  | 'decisiveVictory'  // 大胜
  | 'victory'          // 胜利
  | 'narrowVictory'    // 险胜
  | 'defeat'           // 失败
  | 'rout';            // 惨败

/** 攻占结算结果 */
export interface SiegeSettlementResult {
  outcome: BattleOutcome;
  victory: boolean;
  troopsLost: number;
  troopsLostPercent: number;
  heroInjured: boolean;
  injuryLevel: InjuryLevel;
  rewardMultiplier: number;
}

/** 结算上下文 */
export interface SettlementContext {
  /** 目标等级 */
  targetLevel: number;
  /** 是否首次攻占 */
  isFirstCapture: boolean;
  /** 随机数生成器 (可注入用于测试) */
  rng?: () => number;
}

// ─── Constants ───

/** 结果等级对应的伤亡率 */
export const OUTCOME_CASUALTY_RATES: Record<BattleOutcome, { min: number; max: number }> = {
  decisiveVictory: { min: 0.10, max: 0.20 },
  victory:         { min: 0.20, max: 0.30 },
  narrowVictory:   { min: 0.30, max: 0.40 },
  defeat:          { min: 0.40, max: 0.70 },
  rout:            { min: 0.80, max: 0.90 },
};

/** 结果等级对应的将领受伤概率 */
export const OUTCOME_INJURY_RATES: Record<BattleOutcome, { probability: number; levels: InjuryLevel[] }> = {
  decisiveVictory: { probability: 0.05, levels: ['minor'] },
  victory:         { probability: 0.15, levels: ['minor', 'moderate'] },
  narrowVictory:   { probability: 0.30, levels: ['moderate', 'severe'] },
  defeat:          { probability: 0.50, levels: ['moderate', 'severe'] },
  rout:            { probability: 0.80, levels: ['severe'] },
};

/** 结果等级对应的奖励倍率 */
export const OUTCOME_REWARD_MULTIPLIER: Record<BattleOutcome, number> = {
  decisiveVictory: 1.5,
  victory: 1.0,
  narrowVictory: 0.8,
  defeat: 0.0,
  rout: 0.0,
};

// ─── SiegeResultCalculator ───

export class SiegeResultCalculator {
  /**
   * 计算攻占结算结果
   */
  calculateSettlement(
    event: BattleCompletedEvent,
    context: SettlementContext,
  ): SiegeSettlementResult {
    const rng = context.rng ?? Math.random;

    // 1. 判定结果等级
    const outcome = this.determineOutcome(event);

    // 2. 计算伤亡
    const { troopsLost, troopsLostPercent } = this.calculateTroopLoss(outcome, event.troops, rng);

    // 3. 判定将领受伤
    const { heroInjured, injuryLevel } = this.rollHeroInjury(outcome, rng);

    // 4. 计算奖励倍率
    const baseMultiplier = OUTCOME_REWARD_MULTIPLIER[outcome];
    const rewardMultiplier = context.isFirstCapture ? baseMultiplier * 1.5 : baseMultiplier;

    return {
      outcome,
      victory: event.victory,
      troopsLost,
      troopsLostPercent,
      heroInjured,
      injuryLevel,
      rewardMultiplier,
    };
  }

  /**
   * 判定战斗结果等级
   */
  determineOutcome(event: BattleCompletedEvent): BattleOutcome {
    if (!event.victory) {
      // 失败: 惨败 or 失败
      // 如果城防剩余很高(>50%)说明很快被打退, 判定为惨败
      return event.remainingDefense > 50 ? 'rout' : 'defeat';
    }

    // 胜利: 判定大胜/胜利/险胜
    // 大胜: 剩余城防为0且战斗迅速
    if (event.remainingDefense === 0 && event.elapsedMs < 10000) {
      return 'decisiveVictory';
    }
    // 险胜: 用时较长
    if (event.elapsedMs > 40000) {
      return 'narrowVictory';
    }
    // 普通胜利
    return 'victory';
  }

  /**
   * 计算士兵伤亡
   */
  calculateTroopLoss(
    outcome: BattleOutcome,
    troops: number,
    rng: () => number = Math.random,
  ): { troopsLost: number; troopsLostPercent: number } {
    const rate = OUTCOME_CASUALTY_RATES[outcome];
    const lossPercent = rate.min + rng() * (rate.max - rate.min);
    const troopsLost = Math.floor(troops * lossPercent);
    return { troopsLost, troopsLostPercent: lossPercent };
  }

  /**
   * 判定将领受伤
   */
  rollHeroInjury(
    outcome: BattleOutcome,
    rng: () => number = Math.random,
  ): { heroInjured: boolean; injuryLevel: InjuryLevel } {
    const config = OUTCOME_INJURY_RATES[outcome];
    const injured = rng() < config.probability;
    if (!injured) {
      return { heroInjured: false, injuryLevel: 'none' };
    }
    // 随机选择一个受伤等级
    const level = config.levels[Math.floor(rng() * config.levels.length)];
    return { heroInjured: true, injuryLevel: level };
  }
}
