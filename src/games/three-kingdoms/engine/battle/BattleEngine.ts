/**
 * 战斗系统 — 战斗引擎核心
 *
 * 职责：回合制战斗流程控制、胜负判定、星级评定、战斗统计
 * v4.0 新增：大招时停机制、战斗加速系统
 * 来源：CBT-3 战斗机制 + v4.0 CBT-3/CBT-6
 *
 * 回合流程：
 * 1. 按速度排序所有存活单位 → turnOrder
 * 2. 依次执行每个单位的行动（委托给 BattleTurnExecutor）
 *    - v4.0：半自动模式下，大招就绪时暂停等待玩家确认
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
  BattleSpeedState,
  IDamageCalculator,
  IBattleEngine,
  IUltimateTimeStopHandler,
  Position,
} from './battle.types';
import {
  BattleMode,
  BattleOutcome,
  BattlePhase,
  BattleSpeed,
  StarRating,
  TroopType,
} from './battle.types';
import { BATTLE_CONFIG } from './battle-config';
import { DamageCalculator } from './DamageCalculator';
import {
  BattleTurnExecutor,
  findUnit,
  getAliveUnits,
} from './BattleTurnExecutor';
import { UltimateSkillSystem } from './UltimateSkillSystem';
import { BattleSpeedController } from './BattleSpeedController';

// 工具函数

/** 生成唯一ID */
function generateBattleId(): string {
  return `battle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// BattleEngine

/**
 * 战斗引擎
 *
 * 纯逻辑层，不依赖UI。通过依赖注入解耦伤害计算器。
 * 回合内行动执行委托给 BattleTurnExecutor。
 * v4.0：集成大招时停和战斗加速。
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

  /** v4.0：大招时停系统 */
  private readonly ultimateSystem: UltimateSkillSystem;

  /** v4.0：战斗加速控制器 */
  private readonly speedController: BattleSpeedController;

  /** v4.0：当前战斗模式 */
  private battleMode: BattleMode = BattleMode.AUTO;

  constructor(damageCalculator?: IDamageCalculator) {
    this.damageCalculator = damageCalculator ?? new DamageCalculator();
    this.turnExecutor = new BattleTurnExecutor(this.damageCalculator);
    this.ultimateSystem = new UltimateSkillSystem();
    this.speedController = new BattleSpeedController();
  }

  // ─────────────────────────────────────────
  // 公共API（v3.0 兼容）
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

      // v4.0：半自动模式下检测大招时停
      if (this.battleMode === BattleMode.SEMI_AUTO) {
        const ultimateReady = this.ultimateSystem.checkUltimateReady(actor);
        if (ultimateReady.isReady) {
          // 触发时停
          const skill = ultimateReady.readyUnits[0].skills[0];
          this.ultimateSystem.pauseForUltimate(actor, skill);

          // 暂停执行，等待玩家确认
          // 在单步执行模式中，由外部调用 confirmUltimate 后再继续
          // 在全自动 runFullBattle 中，自动确认
          this.ultimateSystem.confirmUltimateWithInfo(actor, skill);
        }
      }

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
  // v4.0 新增API — 战斗模式
  // ─────────────────────────────────────────

  /**
   * 设置战斗模式
   *
   * @param mode - 战斗模式（AUTO/SEMI_AUTO/MANUAL）
   */
  setBattleMode(mode: BattleMode): void {
    this.battleMode = mode;
    // 半自动模式启用时停
    this.ultimateSystem.setEnabled(mode === BattleMode.SEMI_AUTO);
  }

  /** 获取当前战斗模式 */
  getBattleMode(): BattleMode {
    return this.battleMode;
  }

  // ─────────────────────────────────────────
  // v4.0 新增API — 大招时停
  // ─────────────────────────────────────────

  /**
   * 确认释放大招（半自动模式）
   *
   * @param unitId - 释放单位ID
   * @param skillId - 释放技能ID
   */
  confirmUltimate(unitId: string, skillId: string): void {
    this.ultimateSystem.confirmUltimate(unitId, skillId);
  }

  /** 取消大招释放（半自动模式） */
  cancelUltimate(): void {
    this.ultimateSystem.cancelUltimate();
  }

  /**
   * 注册大招时停事件处理器
   *
   * @param handler - 事件处理器
   */
  registerTimeStopHandler(handler: IUltimateTimeStopHandler): void {
    this.ultimateSystem.registerHandler(handler);
  }

  /** 获取大招时停系统（用于高级用法） */
  getUltimateSystem(): UltimateSkillSystem {
    return this.ultimateSystem;
  }

  /** 检查大招时停是否暂停中 */
  isTimeStopPaused(): boolean {
    return this.ultimateSystem.isPaused();
  }

  // ─────────────────────────────────────────
  // v4.0 新增API — 战斗加速
  // ─────────────────────────────────────────

  /**
   * 设置战斗速度
   *
   * @param speed - 速度档位（1x/2x/4x）
   */
  setSpeed(speed: BattleSpeed): void {
    this.speedController.setSpeed(speed);
  }

  /** 获取当前战斗速度状态 */
  getSpeedState(): BattleSpeedState {
    return this.speedController.getSpeedState();
  }

  /** 获取战斗加速控制器（用于高级用法） */
  getSpeedController(): BattleSpeedController {
    return this.speedController;
  }

  /** 获取调整后的回合间隔（ms） */
  getAdjustedTurnInterval(): number {
    return this.speedController.getAdjustedTurnInterval();
  }

  /** 获取动画速度缩放系数 */
  getAnimationSpeedScale(): number {
    return this.speedController.getAnimationSpeedScale();
  }

  // ─────────────────────────────────────────
  // 回合内部流程
  // ─────────────────────────────────────────

  /** 回合结束处理 */
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

  /** 计算战斗统计数据 */
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

  /** 生成战斗摘要 */
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

// 一键布阵（独立方法）

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

/**
 * 一键布阵：根据武将属性自动分配前排/后排
 *
 * 策略：
 * 1. 防御最高的3个单位放前排
 * 2. 其余单位放后排
 * 3. 同防御时按HP降序排
 * 4. 最多6人（前排3 + 后排3）
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
