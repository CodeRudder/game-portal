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
      if (isAlly) {
        allyTotalDamage += result.damage;
      } else {
        enemyTotalDamage += result.damage;
      }

      maxSingleDamage = Math.max(maxSingleDamage, result.damage);

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
