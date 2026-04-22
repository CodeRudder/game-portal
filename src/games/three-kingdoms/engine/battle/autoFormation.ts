/**
 * 战斗系统 — 一键布阵
 *
 * 职责：根据武将属性自动分配前排/后排
 * 从 BattleEngine 拆分出来，降低主文件复杂度
 *
 * 策略：
 * 1. 防御最高的3个单位放前排
 * 2. 其余单位放后排
 * 3. 同防御时按HP降序排
 * 4. 最多6人（前排3 + 后排3）
 *
 * @module engine/battle/autoFormation
 */

import type { BattleTeam, BattleUnit, Position } from './battle.types';

// ─────────────────────────────────────────
// 类型
// ─────────────────────────────────────────

/** 布阵结果 */
export interface AutoFormationResult {
  /** 布阵后的队伍 */
  team: BattleTeam;
  /** 前排单位ID */
  frontLine: string[];
  /** 后排单位ID */
  backLine: string[];
  /** 布阵评分（0~100） */
  score: number;
}

// ─────────────────────────────────────────
// 函数
// ─────────────────────────────────────────

/**
 * 一键布阵：根据武将属性自动分配前排/后排
 */
export function autoFormation(units: BattleUnit[]): AutoFormationResult {
  const valid = units.filter((u) => u.isAlive).slice(0, 6);
  if (valid.length === 0) {
    return { team: { units: [], side: 'ally' }, frontLine: [], backLine: [], score: 0 };
  }

  // 按防御降序 → HP降序排序
  const sorted = [...valid].sort((a, b) => {
    const defDiff = b.defense - a.defense;
    if (defDiff !== 0) return defDiff;
    return b.maxHp - a.maxHp;
  });

  const frontCount = Math.min(3, sorted.length);
  const frontLine: string[] = [];
  const backLine: string[] = [];

  sorted.forEach((u, i) => {
    const pos: Position = i < frontCount ? 'front' : 'back';
    u.position = pos;
    if (pos === 'front') frontLine.push(u.id);
    else backLine.push(u.id);
  });

  // 计算布阵评分：前排坦度 + 后排火力
  const frontDef = sorted.slice(0, frontCount).reduce((s, u) => s + u.defense, 0);
  const backAtk = sorted.slice(frontCount).reduce((s, u) => s + u.attack, 0);
  const score = Math.min(100, Math.round((frontDef * 0.5 + backAtk * 0.5) / valid.length));

  return {
    team: { units: sorted, side: 'ally' },
    frontLine,
    backLine,
    score,
  };
}
