/**
 * 战斗碎片奖励计算
 *
 * 胜利时从敌方队伍的单位中产出碎片。
 * 掉落以敌方单位的 id 作为 key（通常为武将ID或敌人定义ID）。
 * 上层系统（Campaign/RewardDistributor）可据此分发碎片。
 * 失败/平局时无碎片产出。
 *
 * PRD v3.0 §4.3a：
 *   - 基础碎片掉率 10%
 *   - 首通时关联武将碎片必掉（100%概率）
 *
 * 注意：碎片掉落的权威来源是 RewardDistributor 的 dropTable。
 * 本模块仅作为 BattleEngine 的独立碎片计算路径，
 * Campaign 系统应使用 RewardDistributor.dropTable 进行掉落判定。
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
 * @param allySurvivors - 我方存活人数
 * @param isFirstClear - 是否首通（首通时碎片必掉）
 * @returns 碎片奖励映射（单位ID → 碎片数量）
 */
export function calculateFragmentRewards(
  outcome: BattleOutcome,
  enemyTeam: BattleTeam,
  allySurvivors: number,
  isFirstClear?: boolean,
): Record<string, number> {
  // 非胜利无碎片
  if (outcome !== BattleOutcome.VICTORY) {
    return {};
  }

  // DEF-026: 防护 enemyTeam 为空
  if (!enemyTeam || !enemyTeam.units) {
    return {};
  }

  const fragments: Record<string, number> = {};

  // PRD v3.0 §4.3a：首通时关联武将碎片必掉（100%概率）
  if (isFirstClear) {
    for (const unit of enemyTeam.units) {
      // DEF-040: 跳过空ID单位，防止 simpleHash("") = 0 导致必掉碎片
      if (!unit || !unit.id) continue;
      fragments[unit.id] = (fragments[unit.id] ?? 0) + 1;
    }
    return fragments;
  }

  // 非首通：基础掉率 10%（PRD v3.0 §4.3a）
  const baseDropRate = 0.1;

  for (const unit of enemyTeam.units) {
    // DEF-040: 跳过空ID单位
    if (!unit || !unit.id) continue;
    const hash = simpleHash(unit.id);
    if ((hash % 100) < Math.floor(baseDropRate * 100)) {
      fragments[unit.id] = (fragments[unit.id] ?? 0) + 1;
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
