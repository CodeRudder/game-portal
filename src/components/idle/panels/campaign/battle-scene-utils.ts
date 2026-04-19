/**
 * battle-scene-utils — 战斗场景工具函数
 *
 * 从 BattleScene.tsx 提取的纯函数：
 * - sleep()          Promise 延迟
 * - findUnitInState() 在战斗状态中查找单位
 * - getHpLevel()     血条颜色等级
 * - formatHp()       格式化HP显示
 * - buildActionLog() 生成行动播报HTML
 *
 * @module components/idle/panels/campaign/battle-scene-utils
 */

import type {
  BattleAction,
  BattleState,
  BattleUnit,
} from '@/games/three-kingdoms/engine/battle/battle.types';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 战斗播报条目类型 */
export type LogType = 'ally' | 'enemy' | 'critical' | 'turn' | 'system';

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** Promise 延迟 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 在战斗状态中查找单位（用于直接修改HP） */
export function findUnitInState(state: BattleState, unitId: string): BattleUnit | undefined {
  return (
    state.allyTeam.units.find((u) => u.id === unitId) ||
    state.enemyTeam.units.find((u) => u.id === unitId)
  );
}

/** 获取血条颜色等级 */
export function getHpLevel(hp: number, maxHp: number): string {
  if (hp <= 0) return 'dead';
  const ratio = hp / maxHp;
  if (ratio > 0.6) return 'high';
  if (ratio > 0.25) return 'mid';
  return 'low';
}

/** 格式化HP显示 */
export function formatHp(hp: number, maxHp: number): string {
  return `${Math.max(0, Math.round(hp))}/${maxHp}`;
}

/** 生成行动播报HTML */
export function buildActionLog(action: BattleAction): { html: string; type: LogType } {
  const actorClass = action.actorSide === 'ally' ? 'ally' : 'enemy';
  const skillName = action.skill?.name ?? '行动';

  // 收集伤害信息
  let totalDamage = 0;
  let hasCritical = false;
  const targetCount = action.targetIds.length;

  for (const [, dmgResult] of Object.entries(action.damageResults)) {
    totalDamage += dmgResult.damage;
    if (dmgResult.isCritical) hasCritical = true;
  }

  const isSkip = action.skill === null;
  if (isSkip) {
    return {
      html: `<span class="tk-bs-log-actor">${action.actorName}</span> 被控制，无法行动`,
      type: 'system',
    };
  }

  const critTag = hasCritical ? ' <span class="tk-bs-log-crit">暴击!</span>' : '';
  const aoeTag = targetCount > 1 ? ` (×${targetCount})` : '';

  return {
    html: `<span class="tk-bs-log-actor">${action.actorName}</span> 使用 ` +
      `<span class="tk-bs-log-skill">${skillName}</span>` +
      `${aoeTag} 造成 <span class="tk-bs-log-damage">${totalDamage.toLocaleString()}</span> 伤害${critTag}`,
    type: hasCritical ? 'critical' : actorClass,
  };
}
