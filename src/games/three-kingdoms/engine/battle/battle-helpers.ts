/**
 * 战斗系统 — 通用辅助函数
 *
 * 从 BattleTurnExecutor 中提取的队伍/单位查询工具函数，
 * 供 BattleEngine、BattleTurnExecutor 等多个战斗模块复用。
 *
 * @module engine/battle/battle-helpers
 */

import type {
  BattleSide,
  BattleState,
  BattleTeam,
  BattleUnit,
} from './battle.types';

// ─────────────────────────────────────────────
// 队伍查询
// ─────────────────────────────────────────────

/**
 * 获取队伍中所有存活单位
 */
export function getAliveUnits(team: BattleTeam): BattleUnit[] {
  return team.units.filter((u) => u.isAlive);
}

/**
 * 获取队伍中所有存活的前排单位
 */
export function getAliveFrontUnits(team: BattleTeam): BattleUnit[] {
  return team.units.filter((u) => u.isAlive && u.position === 'front');
}

/**
 * 获取队伍中所有存活的后排单位
 */
export function getAliveBackUnits(team: BattleTeam): BattleUnit[] {
  return team.units.filter((u) => u.isAlive && u.position === 'back');
}

/**
 * 按速度降序排列单位（速度相同时按ID稳定排序）
 */
export function sortBySpeed(units: BattleUnit[]): BattleUnit[] {
  return [...units].sort((a, b) => {
    if (b.speed !== a.speed) return b.speed - a.speed;
    return a.id.localeCompare(a.id);
  });
}

/**
 * 获取单位的敌方队伍
 */
export function getEnemyTeam(state: BattleState, side: BattleSide): BattleTeam {
  return side === 'ally' ? state.enemyTeam : state.allyTeam;
}

/**
 * 获取单位的友方队伍
 */
export function getAllyTeam(state: BattleState, side: BattleSide): BattleTeam {
  return side === 'ally' ? state.allyTeam : state.enemyTeam;
}

/**
 * 从队伍中查找单位
 */
export function findUnitInTeam(team: BattleTeam, unitId: string): BattleUnit | undefined {
  return team.units.find((u) => u.id === unitId);
}

/**
 * 从战斗状态中查找单位
 */
export function findUnit(state: BattleState, unitId: string): BattleUnit | undefined {
  return (
    findUnitInTeam(state.allyTeam, unitId) ||
    findUnitInTeam(state.enemyTeam, unitId)
  );
}
