/**
 * 战斗系统 — 目标选择辅助
 *
 * 从 BattleTurnExecutor 中提取的目标选择逻辑。
 *
 * @module engine/battle/BattleTargetSelector
 */

import type {
  BattleState,
  BattleTeam,
  BattleUnit,
  BattleSkill,
} from './battle.types';
import {
  getAliveUnits,
  getAliveFrontUnits,
  getAliveBackUnits,
  getEnemyTeam,
  getAllyTeam,
} from './battle-helpers';

/** 根据技能目标类型选择目标 */
export function selectTargets(
  state: BattleState,
  actor: BattleUnit,
  skill: BattleSkill,
): BattleUnit[] {
  const enemyTeam = getEnemyTeam(state, actor.side);
  const allyTeam = getAllyTeam(state, actor.side);

  switch (skill.targetType) {
    case 'SINGLE_ENEMY':
      return selectSingleTarget(enemyTeam);

    case 'FRONT_ROW':
      return selectFrontRowTargets(enemyTeam);

    case 'BACK_ROW':
      return selectBackRowTargets(enemyTeam);

    case 'ALL_ENEMY':
      return getAliveUnits(enemyTeam);

    case 'SELF':
      return actor.isAlive ? [actor] : [];

    case 'SINGLE_ALLY': {
      const allies = getAliveUnits(allyTeam);
      const lowest = allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      return lowest.length > 0 ? [lowest[0]] : [];
    }

    case 'ALL_ALLY':
      return getAliveUnits(allyTeam);

    default:
      return selectSingleTarget(enemyTeam);
  }
}

/** 选择单体目标 — 优先前排 */
export function selectSingleTarget(team: BattleTeam): BattleUnit[] {
  const front = getAliveFrontUnits(team);
  if (front.length > 0) {
    return [front[Math.floor(Math.random() * front.length)]];
  }

  const back = getAliveBackUnits(team);
  if (back.length > 0) {
    return [back[Math.floor(Math.random() * back.length)]];
  }

  return [];
}

/** 选择前排目标 */
export function selectFrontRowTargets(team: BattleTeam): BattleUnit[] {
  const front = getAliveFrontUnits(team);
  return front.length > 0 ? front : getAliveBackUnits(team);
}

/** 选择后排目标 */
export function selectBackRowTargets(team: BattleTeam): BattleUnit[] {
  const back = getAliveBackUnits(team);
  return back.length > 0 ? back : getAliveFrontUnits(team);
}
