/**
 * 战斗系统 — 回合执行器
 *
 * 职责：单个单位的行动执行、技能选择、目标选择、怒气更新、Buff应用
 * 从 BattleEngine 中拆分，降低单文件复杂度。
 *
 * @module engine/battle/BattleTurnExecutor
 */

import type {
  BattleAction,
  BattleSide,
  BattleSkill,
  BattleState,
  BattleTeam,
  BattleUnit,
  BuffEffect,
  DamageResult,
  IDamageCalculator,
} from './battle.types';
import { BattlePhase } from './battle.types';
import { BATTLE_CONFIG } from './battle-config';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 工具函数
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
    return a.id.localeCompare(b.id);
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

// ─────────────────────────────────────────────
// BattleTurnExecutor
// ─────────────────────────────────────────────

/**
 * 回合执行器
 *
 * 封装单个单位的行动执行逻辑，包括技能选择、目标选择、
 * 伤害应用、怒气更新、Buff应用等。
 *
 * 由 BattleEngine 在每个回合中调用。
 */
export class BattleTurnExecutor implements ISubsystem {
  // ── ISubsystem 接口 ──
  readonly name = 'battleTurnExecutor' as const;
  private sysDeps: ISystemDeps | null = null;

  private readonly damageCalculator: IDamageCalculator;

  constructor(damageCalculator: IDamageCalculator) {
    this.damageCalculator = damageCalculator;
  }

  // ─────────────────────────────────────────
  // ISubsystem 适配层
  // ─────────────────────────────────────────

  /** ISubsystem.init — 注入依赖 */
  init(deps: ISystemDeps): void {
    this.sysDeps = deps;
  }

  /** ISubsystem.update — 回合执行器按需调用，不需要每帧更新 */
  update(_dt: number): void {
    // 回合执行器由 BattleEngine 驱动，不需要每帧更新
  }

  /** ISubsystem.getState — 返回执行器状态快照 */
  getState(): { hasCalculator: boolean } {
    return { hasCalculator: this.damageCalculator !== null };
  }

  /** ISubsystem.reset — 重置执行器状态 */
  reset(): void {
    // 回合执行器无持久状态，无需重置
  }

  /**
   * 生成回合行动顺序
   *
   * 将双方所有存活单位按速度降序排列
   */
  buildTurnOrder(state: BattleState): void {
    const allAlive = [
      ...getAliveUnits(state.allyTeam),
      ...getAliveUnits(state.enemyTeam),
    ];
    const sorted = sortBySpeed(allAlive);
    state.turnOrder = sorted.map((u) => u.id);
    state.currentActorIndex = 0;
  }

  /**
   * 执行单个单位的行动
   */
  executeUnitAction(
    state: BattleState,
    actor: BattleUnit,
  ): BattleAction | null {
    // 1. 处理持续伤害（DOT）
    const dotDamage = this.damageCalculator.calculateDotDamage(actor);
    if (dotDamage > 0) {
      this.damageCalculator.applyDamage(actor, dotDamage);
      if (!actor.isAlive) {
        return this.createAction(
          state, actor, null, [], {},
          `${actor.name} 受到持续伤害 ${dotDamage}，阵亡`,
          false,
        );
      }
    }

    // 2. 检查是否被控制
    if (this.damageCalculator.isControlled(actor)) {
      return this.createAction(
        state, actor, null, [], {},
        `${actor.name} 被控制，无法行动`,
        false,
      );
    }

    // 3. 选择技能
    const { skill, isNormalAttack } = this.selectSkill(actor);

    // 4. 选择目标
    const targets = this.selectTargets(state, actor, skill);
    if (targets.length === 0) {
      return null;
    }

    // 5. 计算伤害
    const damageResults: Record<string, DamageResult> = {};
    let totalDamage = 0;

    for (const target of targets) {
      if (!target.isAlive) continue;

      const result = this.damageCalculator.calculateDamage(
        actor,
        target,
        skill.multiplier,
      );
      const actualDamage = this.damageCalculator.applyDamage(target, result.damage);
      damageResults[target.id] = { ...result, damage: actualDamage };
      totalDamage += actualDamage;
    }

    // 6. 更新怒气
    this.updateRage(actor, totalDamage, targets);

    // 7. 应用技能附带的Buff/Debuff
    if (skill.buffs && skill.buffs.length > 0) {
      this.applySkillBuffs(actor, targets, skill.buffs);
    }

    // 8. 更新技能冷却
    if (!isNormalAttack && skill.currentCooldown === 0) {
      skill.currentCooldown = skill.cooldown;
    }

    // 9. 生成行动描述
    const targetNames = targets.map((t) => t.name).join('、');
    const description = isNormalAttack
      ? `${actor.name} 对 ${targetNames} 发动普通攻击，造成 ${totalDamage} 点伤害`
      : `${actor.name} 释放【${skill.name}】对 ${targetNames} 造成 ${totalDamage} 点伤害`;

    return this.createAction(
      state, actor, skill, targets.map((t) => t.id),
      damageResults, description, isNormalAttack,
    );
  }

  /**
   * 回合结束处理
   */
  endTurn(state: BattleState): void {
    // 减少所有单位的Buff持续时间
    const allUnits = [...state.allyTeam.units, ...state.enemyTeam.units];
    for (const unit of allUnits) {
      this.tickBuffs(unit);
      this.tickSkillCooldowns(unit);
    }

    // 检查战斗是否结束（由 BattleEngine 判断）
    if (state.currentTurn >= state.maxTurns) {
      state.phase = BattlePhase.FINISHED;
    }
  }

  // ─────────────────────────────────────────
  // 技能选择
  // ─────────────────────────────────────────

  /**
   * 选择技能
   *
   * 规则：
   * - 怒气满（≥100）且有可用大招 → 释放大招
   * - 否则 → 普攻（倍率1.0）
   */
  private selectSkill(actor: BattleUnit): {
    skill: BattleSkill;
    isNormalAttack: boolean;
  } {
    // 检查是否有可用大招
    if (actor.rage >= BATTLE_CONFIG.MAX_RAGE) {
      for (const skill of actor.skills) {
        if (
          skill.type === 'active' &&
          skill.rageCost > 0 &&
          skill.currentCooldown === 0
        ) {
          // 消耗怒气
          actor.rage -= skill.rageCost;
          return { skill, isNormalAttack: false };
        }
      }
    }

    // 普攻
    return { skill: actor.normalAttack, isNormalAttack: true };
  }

  // ─────────────────────────────────────────
  // 目标选择
  // ─────────────────────────────────────────

  /**
   * 选择技能目标
   */
  private selectTargets(
    state: BattleState,
    actor: BattleUnit,
    skill: BattleSkill,
  ): BattleUnit[] {
    const enemyTeam = getEnemyTeam(state, actor.side);
    const allyTeam = getAllyTeam(state, actor.side);

    switch (skill.targetType) {
      case 'SINGLE_ENEMY':
        return this.selectSingleTarget(enemyTeam);

      case 'FRONT_ROW':
        return this.selectFrontRowTargets(enemyTeam);

      case 'BACK_ROW':
        return this.selectBackRowTargets(enemyTeam);

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
        return this.selectSingleTarget(enemyTeam);
    }
  }

  /** 选择单体目标 — 优先前排 */
  private selectSingleTarget(team: BattleTeam): BattleUnit[] {
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
  private selectFrontRowTargets(team: BattleTeam): BattleUnit[] {
    const front = getAliveFrontUnits(team);
    return front.length > 0 ? front : getAliveBackUnits(team);
  }

  /** 选择后排目标 */
  private selectBackRowTargets(team: BattleTeam): BattleUnit[] {
    const back = getAliveBackUnits(team);
    return back.length > 0 ? back : getAliveFrontUnits(team);
  }

  // ─────────────────────────────────────────
  // 怒气系统
  // ─────────────────────────────────────────

  /**
   * 更新怒气
   *
   * 攻击者：普攻+25怒气
   * 被击者：受击+15怒气
   */
  private updateRage(
    actor: BattleUnit,
    _totalDamage: number,
    targets: BattleUnit[],
  ): void {
    // 攻击者获得怒气
    actor.rage = Math.min(
      actor.maxRage,
      actor.rage + BATTLE_CONFIG.RAGE_GAIN_ATTACK,
    );

    // 被击者获得怒气
    for (const target of targets) {
      if (target.isAlive) {
        target.rage = Math.min(
          target.maxRage,
          target.rage + BATTLE_CONFIG.RAGE_GAIN_HIT,
        );
      }
    }
  }

  // ─────────────────────────────────────────
  // Buff/Debuff应用
  // ─────────────────────────────────────────

  /** 应用技能附带的Buff/Debuff到目标 */
  private applySkillBuffs(
    actor: BattleUnit,
    targets: BattleUnit[],
    buffs: BuffEffect[],
  ): void {
    for (const target of targets) {
      if (!target.isAlive) continue;

      for (const buff of buffs) {
        target.buffs.push({
          ...buff,
          sourceId: actor.id,
        });
      }
    }
  }

  // ─────────────────────────────────────────
  // Buff/冷却 tick
  // ─────────────────────────────────────────

  /** 减少Buff持续时间，移除过期的Buff */
  private tickBuffs(unit: BattleUnit): void {
    for (let i = unit.buffs.length - 1; i >= 0; i--) {
      unit.buffs[i].remainingTurns -= 1;
      if (unit.buffs[i].remainingTurns <= 0) {
        unit.buffs.splice(i, 1);
      }
    }
  }

  /** 减少技能冷却时间 */
  private tickSkillCooldowns(unit: BattleUnit): void {
    for (const skill of unit.skills) {
      if (skill.currentCooldown > 0) {
        skill.currentCooldown -= 1;
      }
    }
  }

  // ─────────────────────────────────────────
  // 辅助方法
  // ─────────────────────────────────────────

  /** 创建行动记录 */
  private createAction(
    state: BattleState,
    actor: BattleUnit,
    skill: BattleSkill | null,
    targetIds: string[],
    damageResults: Record<string, DamageResult>,
    description: string,
    isNormalAttack: boolean,
  ): BattleAction {
    return {
      turn: state.currentTurn,
      actorId: actor.id,
      actorName: actor.name,
      actorSide: actor.side,
      skill,
      targetIds,
      damageResults,
      description,
      isNormalAttack,
    };
  }
}
