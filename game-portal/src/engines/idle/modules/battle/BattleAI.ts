/**
 * BattleAI — 共享 AI 决策逻辑
 *
 * 回合制和半回合制模式共用的 AI 决策函数，
 * 包括技能选择、目标选择、Buff 处理等。
 *
 * @module engines/idle/modules/battle/BattleAI
 */

import type {
  BattleUnit,
  BattleSkill,
  BattleModeContext,
  StrategyPreset,
  FocusTarget,
  SkillPriority,
} from './BattleMode';

// ============================================================
// 技能选择
// ============================================================

/**
 * 选择要使用的技能
 *
 * 策略说明：
 * - strongest: 按伤害降序，优先使用最强技能
 * - weakest: 按伤害升序，优先使用最弱技能（省大招）
 * - balanced: 交替使用强/弱技能
 *
 * @param unit  当前行动单位
 * @param preset 策略预设
 * @returns 选中的技能，无可用技能时返回 null
 */
export function selectSkill(
  unit: BattleUnit,
  preset: StrategyPreset,
): BattleSkill | null {
  // 过滤可用技能（冷却为 0 且有伤害/治疗）
  const available = unit.skills.filter(
    (s) => s.currentCooldown <= 0 && (s.damage !== undefined || s.healAmount !== undefined),
  );

  if (available.length === 0) return null;

  // 按策略排序
  const sorted = [...available].sort((a, b) => {
    const dmgA = a.damage ?? a.healAmount ?? 0;
    const dmgB = b.damage ?? b.healAmount ?? 0;
    return preset.skillPriority === 'strongest'
      ? dmgB - dmgA
      : dmgA - dmgB;
  });

  // balanced 策略：随机选择前半部分技能
  if (preset.skillPriority === 'balanced') {
    const halfIndex = Math.max(1, Math.ceil(sorted.length / 2));
    const candidates = sorted.slice(0, halfIndex);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  return sorted[0];
}

// ============================================================
// 目标选择
// ============================================================

/**
 * 选择技能目标
 *
 * 根据技能 targetting 模式和策略预设选择目标：
 * - single: 按普攻目标策略选择单个敌方
 * - aoe: 所有敌方存活单位
 * - self: 自己
 * - ally: 血量最低的友方
 *
 * @param unit    当前行动单位
 * @param skill   使用的技能
 * @param ctx     战斗模式上下文
 * @param preset  策略预设
 * @returns 目标单位数组
 */
export function selectTargets(
  unit: BattleUnit,
  skill: BattleSkill,
  ctx: BattleModeContext,
  preset: StrategyPreset,
): BattleUnit[] {
  const enemySide: 'attacker' | 'defender' = unit.side === 'attacker' ? 'defender' : 'attacker';
  const allySide = unit.side;

  switch (skill.targetting) {
    case 'self':
      return [unit];

    case 'aoe':
      return ctx.getAliveUnits(enemySide);

    case 'ally': {
      const allies = ctx.getAliveUnits(allySide);
      // 血量比例最低的友方
      allies.sort((a, b) => (a.stats.hp / a.stats.maxHp) - (b.stats.hp / b.stats.maxHp));
      return allies.length > 0 ? [allies[0]] : [];
    }

    case 'single':
    default: {
      const enemies = ctx.getAliveUnits(enemySide);
      if (enemies.length === 0) return [];
      return [selectSingleTarget(enemies, preset.focusTarget)];
    }
  }
}

/**
 * 选择普攻目标
 *
 * @param unit    当前行动单位
 * @param ctx     战斗模式上下文
 * @param preset  策略预设
 * @returns 目标单位数组
 */
export function selectNormalAttackTargets(
  unit: BattleUnit,
  ctx: BattleModeContext,
  preset: StrategyPreset,
): BattleUnit[] {
  const enemySide: 'attacker' | 'defender' = unit.side === 'attacker' ? 'defender' : 'attacker';
  const enemies = ctx.getAliveUnits(enemySide);
  if (enemies.length === 0) return [];
  return [selectSingleTarget(enemies, preset.focusTarget)];
}

/**
 * 选择单个目标（内部辅助）
 */
function selectSingleTarget(
  enemies: BattleUnit[],
  focusTarget: FocusTarget,
): BattleUnit {
  switch (focusTarget) {
    case 'lowest_hp':
      return enemies.reduce((min, e) => e.stats.hp < min.stats.hp ? e : min, enemies[0]);

    case 'highest_attack':
      return enemies.reduce((max, e) => e.stats.attack > max.stats.attack ? e : max, enemies[0]);

    case 'fastest':
      return enemies.reduce((max, e) => e.stats.speed > max.stats.speed ? e : max, enemies[0]);

    default:
      return enemies[0];
  }
}

// ============================================================
// 执行行动
// ============================================================

/**
 * 执行单位的行动（AI 自动执行）
 *
 * 逻辑：
 * 1. 检查是否有可用技能，有则使用最强技能
 * 2. 无技能可用则普通攻击
 * 3. 技能目标选择遵循 targetting 模式
 * 4. 普攻目标选择遵循 focusTarget 策略
 *
 * @param unit    当前行动单位
 * @param ctx     战斗模式上下文
 * @param preset  策略预设
 * @returns 行动描述
 */
export function executeAction(
  unit: BattleUnit,
  ctx: BattleModeContext,
  preset: StrategyPreset,
): { action: string; targetIds: string[] } {
  // 检查是否需要防御/治疗（HP 低于阈值）
  if (unit.stats.hp / unit.stats.maxHp < preset.defensiveThreshold) {
    const healSkill = unit.skills.find(
      (s) => s.currentCooldown <= 0 && s.healAmount !== undefined && s.targetting === 'self',
    );
    if (healSkill) {
      const targets = selectTargets(unit, healSkill, ctx, preset);
      if (targets.length > 0) {
        // 使用治疗技能
        const healAmount = healSkill.healAmount ?? 0;
        for (const target of targets) {
          ctx.heal(target.id, healAmount);
        }
        // 设置冷却
        healSkill.currentCooldown = healSkill.cooldown;
        // 处理技能附加效果
        applySkillEffects(unit, healSkill, targets, ctx);
        ctx.emit({
          type: 'skill_used',
          data: { unitId: unit.id, skillName: healSkill.name, targetIds: targets.map((t) => t.id) },
        });
        return { action: 'skill', targetIds: targets.map((t) => t.id) };
      }
    }
  }

  // 尝试使用攻击技能
  const skill = selectSkill(unit, preset);
  if (skill && skill.damage !== undefined) {
    const targets = selectTargets(unit, skill, ctx, preset);
    if (targets.length > 0) {
      // 对每个目标造成技能伤害
      for (const target of targets) {
        ctx.dealDamage(unit.id, target.id, skill.damage);
      }
      // 设置冷却
      skill.currentCooldown = skill.cooldown;
      // 处理技能附加效果
      applySkillEffects(unit, skill, targets, ctx);
      ctx.emit({
        type: 'skill_used',
        data: { unitId: unit.id, skillName: skill.name, targetIds: targets.map((t) => t.id) },
      });
      return { action: 'skill', targetIds: targets.map((t) => t.id) };
    }
  }

  // 普通攻击
  const targets = selectNormalAttackTargets(unit, ctx, preset);
  if (targets.length > 0) {
    for (const target of targets) {
      ctx.dealDamage(unit.id, target.id);
    }
    ctx.emit({
      type: 'action_executed',
      data: { unitId: unit.id, action: 'normal_attack', targetIds: targets.map((t) => t.id) },
    });
    return { action: 'normal_attack', targetIds: targets.map((t) => t.id) };
  }

  return { action: 'idle', targetIds: [] };
}

// ============================================================
// Buff 处理
// ============================================================

/**
 * 处理技能附加效果（Buff/Debuff）
 */
function applySkillEffects(
  unit: BattleUnit,
  skill: BattleSkill,
  targets: BattleUnit[],
  ctx: BattleModeContext,
): void {
  if (!skill.effects) return;
  for (const effect of skill.effects) {
    for (const target of targets) {
      ctx.addBuff(
        target.id,
        {
          id: `${skill.id}_${effect.type}_${effect.stat}`,
          type: effect.type,
          stat: effect.stat,
          value: effect.value,
          remainingTurns: effect.durationTurns,
        },
        unit.id,
      );
    }
  }
}

/**
 * 递减技能冷却
 *
 * @param units 所有单位
 */
export function tickCooldowns(units: BattleUnit[]): void {
  for (const unit of units) {
    for (const skill of unit.skills) {
      if (skill.currentCooldown > 0) {
        skill.currentCooldown--;
      }
    }
  }
}

/**
 * 递减 Buff 持续时间
 *
 * @param units 所有单位
 * @returns 被移除的 Buff ID 列表
 */
export function tickBuffs(units: BattleUnit[]): string[] {
  const removed: string[] = [];
  for (const unit of units) {
    for (const buff of unit.buffs) {
      buff.remainingTurns--;
      if (buff.remainingTurns <= 0) {
        removed.push(buff.id);
      }
    }
    unit.buffs = unit.buffs.filter((b) => b.remainingTurns > 0);
  }
  return removed;
}

/**
 * 计算战斗 MVP（输出伤害最高的单位）
 */
export function calculateMvp(ctx: BattleModeContext): string | null {
  // 简化版：返回攻击方第一个存活单位
  const alive = ctx.getAliveUnits('attacker');
  return alive.length > 0 ? alive[0].id : null;
}
