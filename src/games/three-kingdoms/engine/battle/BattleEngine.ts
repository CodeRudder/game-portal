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
import { calculateBattleStats, generateSummary } from './BattleStatistics';
import type { ISubsystem, ISystemDeps } from '../../core/types';

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
export class BattleEngine implements IBattleEngine, ISubsystem {
  // ── ISubsystem 接口 ──
  readonly name = 'battleEngine' as const;
  private sysDeps: ISystemDeps | null = null;

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
    const stats = calculateBattleStats(state);

    // 碎片奖励：胜利时从敌方队伍中收集碎片掉落
    const fragmentRewards = this.calculateFragmentRewards(
      outcome, state.enemyTeam, allyAlive,
    );

    return {
      outcome,
      stars,
      totalTurns: state.currentTurn,
      allySurvivors: allyAlive,
      enemySurvivors: enemyAlive,
      ...stats,
      summary: generateSummary(outcome, stars, state.currentTurn, allyAlive),
      fragmentRewards,
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
  // v4.0 新增API — 跳过战斗（Plan #49）
  // ─────────────────────────────────────────

  /**
   * 跳过战斗
   *
   * 对正在进行的战斗，直接计算最终结果，跳过所有动画。
   * 仅在 BattlePhase.IN_PROGRESS 时有效。
   *
   * 实现方式：以最快速度运行完所有剩余回合（无动画间隔），
   * 然后返回战斗结果。
   *
   * @param state - 当前战斗状态
   * @returns 战斗结果（战斗已结束时返回已有结果）
   */
  skipBattle(state: BattleState): BattleResult {
    // 已结束的战斗直接返回结果
    if (state.phase === BattlePhase.FINISHED) {
      return state.result ?? this.getBattleResult(state);
    }

    // 设置 SKIP 速度
    this.speedController.setSpeed(BattleSpeed.SKIP);

    // 快速执行所有剩余回合
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

  /**
   * 快速战斗（便捷方法）
   *
   * 初始化并立即跳过整个战斗，直接返回结果。
   * 等价于 initBattle + skipBattle。
   *
   * @param allyTeam - 我方队伍
   * @param enemyTeam - 敌方队伍
   * @returns 战斗结果
   */
  quickBattle(allyTeam: BattleTeam, enemyTeam: BattleTeam): BattleResult {
    const state = this.initBattle(allyTeam, enemyTeam);
    return this.skipBattle(state);
  }

  /**
   * 检查当前是否处于跳过战斗模式
   */
  isSkipMode(): boolean {
    return this.speedController.getSpeed() === BattleSpeed.SKIP;
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
  // 碎片奖励计算
  // ─────────────────────────────────────────

  /**
   * 计算战斗碎片奖励
   *
   * 胜利时从敌方队伍的单位中产出碎片。
   * 掉落以敌方单位的 id 作为 key（通常为武将ID或敌人定义ID）。
   * 上层系统（Campaign/RewardDistributor）可据此分发碎片。
   * 失败/平局时无碎片产出。
   *
   * @param outcome - 战斗结果
   * @param enemyTeam - 敌方队伍
   * @param allySurvivors - 我方存活人数（影响掉落数量）
   */
  private calculateFragmentRewards(
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

      const hash = this.simpleHash(unit.id);
      if ((hash % 100) < Math.floor(dropChance * 100)) {
        const count = allySurvivors >= 4 ? 2 : 1;
        fragments[unit.id] = (fragments[unit.id] ?? 0) + count;
      }
    }

    return fragments;
  }

  /** 简单确定性哈希（用于碎片掉落判定，保持战斗引擎纯函数特性） */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // ─────────────────────────────────────────
  // ISubsystem 适配层
  // ─────────────────────────────────────────

  /** ISubsystem.init — 注入依赖 */
  init(deps: ISystemDeps): void {
    this.sysDeps = deps;
  }

  /** ISubsystem.update — 战斗引擎按需调用，不需要每帧更新 */
  update(_dt: number): void {
    // 战斗引擎是回合驱动的，不需要每帧更新
  }

  /** ISubsystem.getState — 返回引擎状态快照 */
  getState(): { battleMode: BattleMode } {
    return { battleMode: this.battleMode };
  }

  /** ISubsystem.reset — 重置战斗模式为自动 */
  reset(): void {
    this.battleMode = BattleMode.AUTO;
    this.speedController.setSpeed(BattleSpeed.X1);
    this.ultimateSystem.setEnabled(false);
  }
}
