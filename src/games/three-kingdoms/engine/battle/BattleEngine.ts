/**
 * 战斗系统 — 战斗引擎核心
 *
 * 职责：回合制战斗流程控制、胜负判定、星级评定、战斗统计
 * 来源：CBT-3 战斗机制
 *
 * 回合流程：
 * 1. 按速度排序所有存活单位 → turnOrder
 * 2. 依次执行每个单位的行动（委托给 BattleTurnExecutor）
 * 3. 回合结束：减少Buff持续时间，检查胜负
 *
 * @module engine/battle/BattleEngine
 */

import type {
  BattleAction,
  BattleResult,
  BattleState,
  BattleTeam,
  BattleUnit,
  IDamageCalculator,
  IBattleEngine,
} from './battle.types';
import {
  BattleOutcome,
  BattlePhase,
  StarRating,
} from './battle.types';
import { BATTLE_CONFIG } from './battle-config';
import { DamageCalculator } from './DamageCalculator';
import {
  BattleTurnExecutor,
  findUnit,
  getAliveUnits,
} from './BattleTurnExecutor';

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/**
 * 生成唯一ID
 */
function generateBattleId(): string {
  return `battle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────
// BattleEngine
// ─────────────────────────────────────────────

/**
 * 战斗引擎
 *
 * 纯逻辑层，不依赖UI。通过依赖注入解耦伤害计算器。
 * 回合内行动执行委托给 BattleTurnExecutor。
 *
 * @example
 * ```ts
 * const engine = new BattleEngine();
 * const result = engine.runFullBattle(allyTeam, enemyTeam);
 * console.log(result.outcome); // VICTORY | DEFEAT | DRAW
 * console.log(result.stars);   // 1 | 2 | 3
 * ```
 */
export class BattleEngine implements IBattleEngine {
  private readonly damageCalculator: IDamageCalculator;
  private readonly turnExecutor: BattleTurnExecutor;

  constructor(damageCalculator?: IDamageCalculator) {
    this.damageCalculator = damageCalculator ?? new DamageCalculator();
    this.turnExecutor = new BattleTurnExecutor(this.damageCalculator);
  }

  // ─────────────────────────────────────────
  // 公共API
  // ─────────────────────────────────────────

  /**
   * 初始化战斗
   *
   * 创建初始战斗状态，按速度排序生成首回合行动顺序
   */
  initBattle(allyTeam: BattleTeam, enemyTeam: BattleTeam): BattleState {
    const state = {
      id: generateBattleId(),
      phase: BattlePhase.IN_PROGRESS,
      currentTurn: 1,
      maxTurns: BATTLE_CONFIG.MAX_TURNS,
      allyTeam,
      enemyTeam,
      turnOrder: [] as string[],
      currentActorIndex: 0,
      actionLog: [] as BattleAction[],
      result: null as BattleResult | null,
    };

    // 生成首回合行动顺序
    this.turnExecutor.buildTurnOrder(state);

    return state;
  }

  /**
   * 执行一个回合
   *
   * 按速度排序依次执行每个存活单位的行动，
   * 返回本回合所有行动记录
   */
  executeTurn(state: BattleState): BattleAction[] {
    if (state.phase !== BattlePhase.IN_PROGRESS) {
      return [];
    }

    const actions: BattleAction[] = [];

    // 重新生成行动顺序
    this.turnExecutor.buildTurnOrder(state);

    // 依次执行每个单位的行动
    for (let i = 0; i < state.turnOrder.length; i++) {
      state.currentActorIndex = i;

      // 再次检查战斗是否已结束
      if (this.isBattleOver(state)) {
        break;
      }

      const actorId = state.turnOrder[i];
      const actor = findUnit(state, actorId);

      // 单位可能在本回合中已死亡
      if (!actor || !actor.isAlive) continue;

      // 执行单位行动
      const action = this.turnExecutor.executeUnitAction(state, actor);
      if (action) {
        actions.push(action);
        state.actionLog.push(action);
      }
    }

    // 回合结束处理
    this.endTurn(state);

    return actions;
  }

  /**
   * 检查战斗是否结束
   *
   * 条件：一方全灭 或 达到最大回合数
   */
  isBattleOver(state: BattleState): boolean {
    if (state.phase === BattlePhase.FINISHED) return true;

    const allyAlive = getAliveUnits(state.allyTeam).length;
    const enemyAlive = getAliveUnits(state.enemyTeam).length;

    return allyAlive === 0 || enemyAlive === 0;
  }

  /**
   * 获取战斗结果
   *
   * 计算胜负、星级评定、战斗统计
   */
  getBattleResult(state: BattleState): BattleResult {
    const allyAlive = getAliveUnits(state.allyTeam).length;
    const enemyAlive = getAliveUnits(state.enemyTeam).length;

    // 判定胜负
    let outcome: BattleOutcome;
    if (enemyAlive === 0) {
      outcome = BattleOutcome.VICTORY;
    } else if (allyAlive === 0) {
      outcome = BattleOutcome.DEFEAT;
    } else if (state.currentTurn >= state.maxTurns) {
      outcome = BattleOutcome.DRAW;
    } else {
      outcome = BattleOutcome.DRAW;
    }

    // 计算星级（仅胜利时评定）
    const stars = this.calculateStars(outcome, allyAlive, state.currentTurn);

    // 统计数据
    const stats = this.calculateBattleStats(state);

    return {
      outcome,
      stars,
      totalTurns: state.currentTurn,
      allySurvivors: allyAlive,
      enemySurvivors: enemyAlive,
      ...stats,
      summary: this.generateSummary(outcome, stars, state.currentTurn, allyAlive),
    };
  }

  /**
   * 运行完整战斗
   *
   * 从初始化到战斗结束，自动执行所有回合
   */
  runFullBattle(allyTeam: BattleTeam, enemyTeam: BattleTeam): BattleResult {
    const state = this.initBattle(allyTeam, enemyTeam);

    while (
      state.phase === BattlePhase.IN_PROGRESS &&
      state.currentTurn <= state.maxTurns
    ) {
      this.executeTurn(state);

      if (this.isBattleOver(state)) {
        break;
      }

      state.currentTurn++;
    }

    // 标记战斗结束
    state.phase = BattlePhase.FINISHED;

    // 生成结果
    const result = this.getBattleResult(state);
    state.result = result;

    return result;
  }

  // ─────────────────────────────────────────
  // 回合内部流程
  // ─────────────────────────────────────────

  /**
   * 回合结束处理
   */
  private endTurn(state: BattleState): void {
    this.turnExecutor.endTurn(state);

    // 检查战斗是否结束
    if (this.isBattleOver(state)) {
      state.phase = BattlePhase.FINISHED;
      state.result = this.getBattleResult(state);
    }
  }

  // ─────────────────────────────────────────
  // 星级评定
  // ─────────────────────────────────────────

  /**
   * 计算星级
   *
   * ★☆☆：通关（任意HP > 0）
   * ★★☆：通关 + 我方存活 ≥ 4人
   * ★★★：通关 + 我方存活 ≥ 4人 + 回合数 ≤ 6
   */
  private calculateStars(
    outcome: BattleOutcome,
    allyAlive: number,
    turns: number,
  ): StarRating {
    if (outcome !== BattleOutcome.VICTORY) {
      return StarRating.NONE;
    }

    if (
      allyAlive >= BATTLE_CONFIG.STAR2_MIN_SURVIVORS &&
      turns <= BATTLE_CONFIG.STAR3_MAX_TURNS
    ) {
      return StarRating.THREE;
    }

    if (allyAlive >= BATTLE_CONFIG.STAR2_MIN_SURVIVORS) {
      return StarRating.TWO;
    }

    return StarRating.ONE;
  }

  // ─────────────────────────────────────────
  // 战斗统计
  // ─────────────────────────────────────────

  /**
   * 计算战斗统计数据
   */
  private calculateBattleStats(state: BattleState): {
    allyTotalDamage: number;
    enemyTotalDamage: number;
    maxSingleDamage: number;
    maxCombo: number;
  } {
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

  // ─────────────────────────────────────────
  // 辅助方法
  // ─────────────────────────────────────────

  /**
   * 生成战斗摘要
   */
  private generateSummary(
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
}
