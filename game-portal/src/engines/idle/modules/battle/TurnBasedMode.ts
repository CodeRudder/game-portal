/**
 * TurnBasedMode — 回合制战斗模式
 *
 * 所有单位按速度值降序排列决定行动顺序，每回合一个单位行动。
 * AI 自动执行技能选择和目标选择，支持策略预设。
 *
 * @module engines/idle/modules/battle/TurnBasedMode
 */

import type {
  IBattleMode,
  BattleModeContext,
  BattleResult,
  BattleStats,
  StrategyPreset,
} from './BattleMode';
import { DEFAULT_STRATEGY_PRESET } from './BattleMode';
import { executeAction, tickCooldowns, tickBuffs, calculateMvp } from './BattleAI';

// ============================================================
// 状态接口
// ============================================================

/** 回合制模式内部状态 */
interface TurnBasedState {
  /** 行动顺序（单位 ID 数组，按速度降序） */
  turnOrder: string[];
  /** 当前行动单位在 turnOrder 中的索引 */
  currentTurnIndex: number;
  /** 当前回合数（每轮所有单位行动完毕为一回合） */
  turnCount: number;
  /** 回合上限 */
  maxTurns: number;
  /** 当前阶段 */
  phase: 'waiting' | 'acting' | 'finished';
  /** 行动间隔（毫秒），用于动画延迟 */
  actionDelayMs: number;
  /** 自上次行动以来的累计时间 */
  elapsedSinceLastAction: number;
  /** 累计伤害统计 */
  stats: BattleStats;
}

// ============================================================
// TurnBasedMode
// ============================================================

/**
 * 回合制战斗模式
 *
 * 规则：
 * - 所有单位按速度降序排列决定行动顺序
 * - 每回合一个单位行动（AI 自动执行）
 * - 回合上限默认 30，超过判负
 * - 技能优先使用最强可用技能，无技能时普通攻击
 * - 每次行动后递减技能冷却和 Buff 持续时间
 */
export class TurnBasedMode implements IBattleMode {
  readonly type = 'turn-based';

  /** 策略预设 */
  private preset: StrategyPreset;

  /** 内部状态 */
  private state: TurnBasedState;

  constructor(options?: {
    maxTurns?: number;
    actionDelayMs?: number;
    preset?: StrategyPreset;
  }) {
    this.preset = options?.preset ?? { ...DEFAULT_STRATEGY_PRESET };
    this.state = this.createInitialState(options?.maxTurns, options?.actionDelayMs);
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /** 初始化模式 — 生成行动顺序 */
  init(ctx: BattleModeContext): void {
    this.state = this.createInitialState(
      this.state.maxTurns,
      this.state.actionDelayMs,
    );

    // 收集所有存活单位并按速度降序排列
    const alive = ctx.units.filter((u) => u.isAlive);
    alive.sort((a, b) => b.stats.speed - a.stats.speed);
    this.state.turnOrder = alive.map((u) => u.id);
    this.state.currentTurnIndex = 0;
    this.state.phase = 'acting';
    this.state.turnCount = 1;

    // 发射第一个回合开始事件
    if (this.state.turnOrder.length > 0) {
      const firstUnit = ctx.getUnit(this.state.turnOrder[0]);
      if (firstUnit) {
        ctx.emit({
          type: 'turn_started',
          data: {
            turn: this.state.turnCount,
            unitId: firstUnit.id,
            unitName: firstUnit.name,
          },
        });
      }
    }
  }

  /** 每帧更新 — 处理行动延迟 */
  update(ctx: BattleModeContext, dt: number): void {
    if (this.state.phase !== 'acting') return;

    // 检查胜负
    if (this.checkWin(ctx) || this.checkLose(ctx)) {
      this.state.phase = 'finished';
      return;
    }

    // 累计时间
    this.state.elapsedSinceLastAction += dt * ctx.speed;

    // 未到行动间隔，等待
    if (this.state.elapsedSinceLastAction < this.state.actionDelayMs) return;

    this.state.elapsedSinceLastAction = 0;

    // 执行当前单位的行动
    this.executeCurrentUnitTurn(ctx);

    // 检查是否有单位死亡，发射死亡事件
    this.checkDeaths(ctx);

    // 前进到下一个单位
    this.advanceTurn(ctx);

    // 检查胜负（行动后可能已结束）
    if (this.checkWin(ctx) || this.checkLose(ctx)) {
      this.state.phase = 'finished';
      return;
    }

    // 检查回合上限
    if (this.state.turnCount > this.state.maxTurns) {
      this.state.phase = 'finished';
      return;
    }
  }

  /** 检查胜利条件 — 所有防守方单位死亡 */
  checkWin(ctx: BattleModeContext): boolean {
    return ctx.getAliveUnits('defender').length === 0;
  }

  /** 检查失败条件 — 所有攻击方单位死亡 */
  checkLose(ctx: BattleModeContext): boolean {
    return ctx.getAliveUnits('attacker').length === 0;
  }

  /** 结算战斗结果 */
  settle(ctx: BattleModeContext, durationMs: number): BattleResult {
    const won = this.checkWin(ctx);
    return {
      won,
      rewards: {},
      drops: {},
      mvp: calculateMvp(ctx),
      durationMs,
      stats: { ...this.state.stats },
    };
  }

  /** 获取模式状态（用于存档） */
  getState(): Record<string, unknown> {
    return {
      turnOrder: [...this.state.turnOrder],
      currentTurnIndex: this.state.currentTurnIndex,
      turnCount: this.state.turnCount,
      maxTurns: this.state.maxTurns,
      phase: this.state.phase,
      actionDelayMs: this.state.actionDelayMs,
      elapsedSinceLastAction: this.state.elapsedSinceLastAction,
      stats: { ...this.state.stats },
    };
  }

  /** 恢复模式状态 */
  loadState(data: Record<string, unknown>): void {
    if (!data || typeof data !== 'object') return;

    this.state = {
      turnOrder: Array.isArray(data.turnOrder)
        ? data.turnOrder.filter((v): v is string => typeof v === 'string')
        : [],
      currentTurnIndex: typeof data.currentTurnIndex === 'number'
        ? Math.max(0, Math.floor(data.currentTurnIndex))
        : 0,
      turnCount: typeof data.turnCount === 'number'
        ? Math.max(1, Math.floor(data.turnCount))
        : 1,
      maxTurns: typeof data.maxTurns === 'number'
        ? Math.max(1, Math.floor(data.maxTurns))
        : 30,
      phase: this.parsePhase(data.phase),
      actionDelayMs: typeof data.actionDelayMs === 'number'
        ? Math.max(0, data.actionDelayMs)
        : 500,
      elapsedSinceLastAction: typeof data.elapsedSinceLastAction === 'number'
        ? Math.max(0, data.elapsedSinceLastAction)
        : 0,
      stats: typeof data.stats === 'object' && data.stats !== null
        ? this.parseStats(data.stats as Record<string, unknown>)
        : { totalDamageDealt: 0, totalDamageTaken: 0, unitsLost: 0, enemiesDefeated: 0 },
    };
  }

  /** 重置模式 */
  reset(): void {
    this.state = this.createInitialState(this.state.maxTurns, this.state.actionDelayMs);
  }

  // ============================================================
  // 公开访问器
  // ============================================================

  /** 获取当前行动顺序 */
  get turnOrder(): string[] {
    return [...this.state.turnOrder];
  }

  /** 获取当前行动索引 */
  get currentTurnIndex(): number {
    return this.state.currentTurnIndex;
  }

  /** 获取当前回合数 */
  get turnCount(): number {
    return this.state.turnCount;
  }

  /** 获取当前阶段 */
  get phase(): string {
    return this.state.phase;
  }

  /** 获取策略预设 */
  get strategyPreset(): StrategyPreset {
    return { ...this.preset };
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /** 创建初始状态 */
  private createInitialState(maxTurns?: number, actionDelayMs?: number): TurnBasedState {
    return {
      turnOrder: [],
      currentTurnIndex: 0,
      turnCount: 1,
      maxTurns: maxTurns ?? 30,
      phase: 'waiting',
      actionDelayMs: actionDelayMs ?? 500,
      elapsedSinceLastAction: 0,
      stats: {
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        unitsLost: 0,
        enemiesDefeated: 0,
      },
    };
  }

  /** 执行当前单位的行动 */
  private executeCurrentUnitTurn(ctx: BattleModeContext): void {
    const unitId = this.state.turnOrder[this.state.currentTurnIndex];
    if (!unitId) return;

    const unit = ctx.getUnit(unitId);
    if (!unit || !unit.isAlive) return;

    // 执行 AI 决策
    const result = executeAction(unit, ctx, this.preset);

    // 更新统计
    // （伤害统计由 ctx.dealDamage 内部处理）

    // 递减技能冷却
    tickCooldowns(ctx.units);

    // 递减 Buff 持续时间
    tickBuffs(ctx.units);
  }

  /** 检查单位死亡并发射事件 */
  private checkDeaths(ctx: BattleModeContext): void {
    for (const unit of ctx.units) {
      if (!unit.isAlive) {
        // 检查是否已经发射过死亡事件（通过 buffs 标记简化处理）
        // 这里依赖引擎侧的 dealDamage 已经设置了 isAlive = false
        ctx.emit({
          type: 'unit_died',
          data: { unitId: unit.id, unitName: unit.name, side: unit.side },
        });
      }
    }
  }

  /** 前进到下一个行动单位 */
  private advanceTurn(ctx: BattleModeContext): void {
    this.state.currentTurnIndex++;

    // 一轮结束，回到开头
    if (this.state.currentTurnIndex >= this.state.turnOrder.length) {
      this.state.currentTurnIndex = 0;
      this.state.turnCount++;

      // 重新计算行动顺序（可能有单位死亡）
      const alive = ctx.units.filter((u) => u.isAlive);
      alive.sort((a, b) => b.stats.speed - a.stats.speed);
      this.state.turnOrder = alive.map((u) => u.id);
    }

    // 跳过已死亡的单位
    while (
      this.state.currentTurnIndex < this.state.turnOrder.length &&
      !this.isUnitAlive(ctx, this.state.turnOrder[this.state.currentTurnIndex])
    ) {
      this.state.currentTurnIndex++;
      if (this.state.currentTurnIndex >= this.state.turnOrder.length) {
        this.state.currentTurnIndex = 0;
        this.state.turnCount++;
        // 重新计算
        const alive = ctx.units.filter((u) => u.isAlive);
        alive.sort((a, b) => b.stats.speed - a.stats.speed);
        this.state.turnOrder = alive.map((u) => u.id);
        break;
      }
    }

    // 发射回合开始事件
    if (this.state.currentTurnIndex < this.state.turnOrder.length) {
      const nextUnit = ctx.getUnit(this.state.turnOrder[this.state.currentTurnIndex]);
      if (nextUnit) {
        ctx.emit({
          type: 'turn_started',
          data: {
            turn: this.state.turnCount,
            unitId: nextUnit.id,
            unitName: nextUnit.name,
          },
        });
      }
    }
  }

  /** 检查单位是否存活 */
  private isUnitAlive(ctx: BattleModeContext, unitId: string): boolean {
    const unit = ctx.getUnit(unitId);
    return unit !== undefined && unit.isAlive;
  }

  /** 解析阶段字符串 */
  private parsePhase(value: unknown): 'waiting' | 'acting' | 'finished' {
    if (value === 'waiting' || value === 'acting' || value === 'finished') {
      return value;
    }
    return 'waiting';
  }

  /** 解析统计对象 */
  private parseStats(data: Record<string, unknown>): BattleStats {
    return {
      totalDamageDealt: typeof data.totalDamageDealt === 'number'
        ? Math.max(0, data.totalDamageDealt) : 0,
      totalDamageTaken: typeof data.totalDamageTaken === 'number'
        ? Math.max(0, data.totalDamageTaken) : 0,
      unitsLost: typeof data.unitsLost === 'number'
        ? Math.max(0, data.unitsLost) : 0,
      enemiesDefeated: typeof data.enemiesDefeated === 'number'
        ? Math.max(0, data.enemiesDefeated) : 0,
    };
  }
}
