/**
 * 战斗碎片奖励计算
 *
 * 胜利时从敌方队伍的单位中产出碎片。
 * 掉落以敌方单位的 id 作为 key（通常为武将ID或敌人定义ID）。
 * 上层系统（Campaign/RewardDistributor）可据此分发碎片。
 * 失败/平局时无碎片产出。
 *
 * @module engine/battle/BattleFragmentRewards
 */

import type { BattleTeam } from './battle.types';
import { BattleOutcome } from './battle.types';

/**
 * 计算战斗碎片奖励
 *
 * @param outcome - 战斗结果
 * @param enemyTeam - 敌方队伍
 * @param allySurvivors - 我方存活人数（影响掉落数量）
 * @returns 碎片奖励映射（单位ID → 碎片数量）
 */
export function calculateFragmentRewards(
  outcome: BattleOutcome,
  enemyTeam: BattleTeam,
  allySurvivors: number,
): Record<string, number> {
  // 非胜利无碎片
  if (outcome !== BattleOutcome.VICTORY) {
    return {};
  }

  const fragments: Record<string, number> = {};

  for (const unit of enemyTeam.units) {
    // 确定性掉落判定：基于单位ID的哈希
    // 基础掉率30%，存活4人以上额外+20%
    const baseDropRate = 0.3;
    const starBonus = allySurvivors >= 4 ? 0.2 : 0;
    const dropChance = baseDropRate + starBonus;

    const hash = simpleHash(unit.id);
    if ((hash % 100) < Math.floor(dropChance * 100)) {
      const count = allySurvivors >= 4 ? 2 : 1;
      fragments[unit.id] = (fragments[unit.id] ?? 0) + count;
    }
  }

  return fragments;
}

/**
 * 简单确定性哈希
 *
 * 用于碎片掉落判定，保持战斗引擎纯函数特性。
 *
 * @param str - 输入字符串
 * @returns 非负整数哈希值
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
