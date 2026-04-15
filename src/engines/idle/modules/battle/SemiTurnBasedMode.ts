/**
 * SemiTurnBasedMode — 半回合制（ATB）战斗模式
 *
 * 每个单位拥有独立的 ATB 条（0-1000），每帧按速度增长。
 * ATB 满时该单位行动，行动后 ATB 重置。
 * 多个单位同时满 ATB 时，速度高的优先行动。
 *
 * @module engines/idle/modules/battle/SemiTurnBasedMode
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
// 常量
// ============================================================

/** ATB 条最大值 */
const ATB_MAX = 1000;

/** 默认时间限制（5 分钟） */
const DEFAULT_TIME_LIMIT_MS = 5 * 60 * 1000;

// ============================================================
// 状态接口
// ============================================================

/** ATB 模式内部状态 */
interface SemiTurnBasedState {
  /** ATB 条：unitId → 当前 ATB 值 (0~1000) */
  atbBars: Map<string, number>;
  /** 当前正在行动的单位 ID */
  currentActingUnit: string | null;
  /** 总时间限制（毫秒） */
  timeLimitMs: number;
  /** 已经过时间（毫秒） */
  elapsedMs: number;
  /** 当前阶段 */
  phase: 'charging' | 'acting' | 'finished';
  /** 行动间隔（毫秒） */
  actionDelayMs: number;
  /** 自上次行动以来的累计时间 */
  elapsedSinceLastAction: number;
  /** 累计伤害统计 */
  stats: BattleStats;
  /** 行动次数计数 */
  actionCount: number;
}

// ============================================================
// SemiTurnBasedMode
// ============================================================

/**
 * 半回合制（ATB）战斗模式
 *
 * 规则：
 * - 每个单位有独立 ATB 条（0-1000）
 * - 每帧 ATB 增加值 = speed * dt / 1000
 * - ATB 满时（≥1000）该单位行动
 * - 行动后 ATB 重置为 0
 * - 多个单位同时满 ATB 时，速度高的优先
 * - 无回合上限，但有总时间限制（默认 5 分钟）
 * - 超时判负
 */
export class SemiTurnBasedMode implements IBattleMode {
  readonly type = 'semi-turn-based';

  /** 策略预设 */
  private preset: StrategyPreset;

  /** 内部状态 */
  private state: SemiTurnBasedState;

  constructor(options?: {
    timeLimitMs?: number;
    actionDelayMs?: number;
    preset?: StrategyPreset;
  }) {
    this.preset = options?.preset ?? { ...DEFAULT_STRATEGY_PRESET };
    this.state = this.createInitialState(options?.timeLimitMs, options?.actionDelayMs);
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /** 初始化模式 — 初始化所有单位的 ATB 条 */
  init(ctx: BattleModeContext): void {
    this.state = this.createInitialState(
      this.state.timeLimitMs,
      this.state.actionDelayMs,
    );

    // 为所有存活单位初始化 ATB 条
    for (const unit of ctx.units) {
      if (unit.isAlive) {
        this.state.atbBars.set(unit.id, 0);
      }
    }

    this.state.phase = 'charging';
  }

  /** 每帧更新 — 增长 ATB 并处理行动 */
  update(ctx: BattleModeContext, dt: number): void {
    if (this.state.phase === 'finished') return;

    // 应用速度倍率
    const scaledDt = dt * ctx.speed;

    // 累计时间
    this.state.elapsedMs += scaledDt;

    // 检查超时
    if (this.state.elapsedMs >= this.state.timeLimitMs) {
      this.state.phase = 'finished';
      return;
    }

    // 检查胜负
    if (this.checkWin(ctx) || this.checkLose(ctx)) {
      this.state.phase = 'finished';
      return;
    }

    // 如果正在执行行动，处理行动延迟
    if (this.state.phase === 'acting') {
      this.state.elapsedSinceLastAction += scaledDt;
      if (this.state.elapsedSinceLastAction < this.state.actionDelayMs) return;

      // 行动完成，回到充电阶段
      this.state.phase = 'charging';
      this.state.currentActingUnit = null;
      this.state.elapsedSinceLastAction = 0;
      return;
    }

    // 充电阶段：增长所有单位的 ATB
    this.chargeATB(ctx, scaledDt);

    // 检查是否有单位 ATB 满
    const readyUnit = this.getHighestSpeedReadyUnit(ctx);
    if (readyUnit) {
      this.executeUnitAction(readyUnit, ctx);
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
      atbBars: Object.fromEntries(this.state.atbBars),
      currentActingUnit: this.state.currentActingUnit,
      timeLimitMs: this.state.timeLimitMs,
      elapsedMs: this.state.elapsedMs,
      phase: this.state.phase,
      actionDelayMs: this.state.actionDelayMs,
      elapsedSinceLastAction: this.state.elapsedSinceLastAction,
      stats: { ...this.state.stats },
      actionCount: this.state.actionCount,
    };
  }

  /** 恢复模式状态 */
  loadState(data: Record<string, unknown>): void {
    if (!data || typeof data !== 'object') return;

    const atbBars = new Map<string, number>();
    if (typeof data.atbBars === 'object' && data.atbBars !== null) {
      const entries = Object.entries(data.atbBars as Record<string, unknown>);
      for (const [key, value] of entries) {
        if (typeof value === 'number') {
          atbBars.set(key, Math.max(0, Math.min(ATB_MAX, value)));
        }
      }
    }

    this.state = {
      atbBars,
      currentActingUnit: typeof data.currentActingUnit === 'string'
        ? data.currentActingUnit : null,
      timeLimitMs: typeof data.timeLimitMs === 'number'
        ? Math.max(0, data.timeLimitMs) : DEFAULT_TIME_LIMIT_MS,
      elapsedMs: typeof data.elapsedMs === 'number'
        ? Math.max(0, data.elapsedMs) : 0,
      phase: this.parsePhase(data.phase),
      actionDelayMs: typeof data.actionDelayMs === 'number'
        ? Math.max(0, data.actionDelayMs) : 500,
      elapsedSinceLastAction: typeof data.elapsedSinceLastAction === 'number'
        ? Math.max(0, data.elapsedSinceLastAction) : 0,
      stats: typeof data.stats === 'object' && data.stats !== null
        ? this.parseStats(data.stats as Record<string, unknown>)
        : { totalDamageDealt: 0, totalDamageTaken: 0, unitsLost: 0, enemiesDefeated: 0 },
      actionCount: typeof data.actionCount === 'number'
        ? Math.max(0, Math.floor(data.actionCount)) : 0,
    };
  }

  /** 重置模式 */
  reset(): void {
    this.state = this.createInitialState(this.state.timeLimitMs, this.state.actionDelayMs);
  }

  // ============================================================
  // 公开访问器
  // ============================================================

  /** 获取指定单位的 ATB 值 */
  getATB(unitId: string): number {
    return this.state.atbBars.get(unitId) ?? 0;
  }

  /** 获取已过时间 */
  get elapsedMs(): number {
    return this.state.elapsedMs;
  }

  /** 获取当前阶段 */
  get phase(): string {
    return this.state.phase;
  }

  /** 获取行动次数 */
  get actionCount(): number {
    return this.state.actionCount;
  }

  /** 获取策略预设 */
  get strategyPreset(): StrategyPreset {
    return { ...this.preset };
  }

  /** 获取当前行动单位 */
  get currentActingUnit(): string | null {
    return this.state.currentActingUnit;
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /** 创建初始状态 */
  private createInitialState(timeLimitMs?: number, actionDelayMs?: number): SemiTurnBasedState {
    return {
      atbBars: new Map(),
      currentActingUnit: null,
      timeLimitMs: timeLimitMs ?? DEFAULT_TIME_LIMIT_MS,
      elapsedMs: 0,
      phase: 'charging',
      actionDelayMs: actionDelayMs ?? 500,
      elapsedSinceLastAction: 0,
      stats: {
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        unitsLost: 0,
        enemiesDefeated: 0,
      },
      actionCount: 0,
    };
  }

  /** 增长所有存活单位的 ATB */
  private chargeATB(ctx: BattleModeContext, dt: number): void {
    for (const unit of ctx.units) {
      if (!unit.isAlive) {
        // 死亡单位移除 ATB 条
        this.state.atbBars.delete(unit.id);
        continue;
      }

      const current = this.state.atbBars.get(unit.id) ?? 0;
      // ATB 增加值 = speed * dt / 1000
      const increment = unit.stats.speed * dt / 1000;
      this.state.atbBars.set(unit.id, Math.min(ATB_MAX, current + increment));
    }
  }

  /** 获取 ATB 满的单位中速度最高的 */
  private getHighestSpeedReadyUnit(ctx: BattleModeContext): BattleUnit | null {
    let best: BattleUnit | null = null;
    let bestSpeed = -1;

    for (const unit of ctx.units) {
      if (!unit.isAlive) continue;
      const atb = this.state.atbBars.get(unit.id) ?? 0;
      if (atb >= ATB_MAX && unit.stats.speed > bestSpeed) {
        best = unit;
        bestSpeed = unit.stats.speed;
      }
    }

    return best;
  }

  /** 执行单位行动 */
  private executeUnitAction(unit: BattleUnit, ctx: BattleModeContext): void {
    // 重置该单位的 ATB
    this.state.atbBars.set(unit.id, 0);
    this.state.currentActingUnit = unit.id;
    this.state.phase = 'acting';
    this.state.actionCount++;

    // 发射回合开始事件
    ctx.emit({
      type: 'turn_started',
      data: {
        turn: this.state.actionCount,
        unitId: unit.id,
        unitName: unit.name,
      },
    });

    // 执行 AI 决策
    executeAction(unit, ctx, this.preset);

    // 递减技能冷却（每次行动后）
    tickCooldowns(ctx.units);

    // 递减 Buff 持续时间
    tickBuffs(ctx.units);

    // 检查死亡
    this.checkDeaths(ctx);
  }

  /** 检查单位死亡并发射事件 */
  private checkDeaths(ctx: BattleModeContext): void {
    for (const unit of ctx.units) {
      if (!unit.isAlive) {
        ctx.emit({
          type: 'unit_died',
          data: { unitId: unit.id, unitName: unit.name, side: unit.side },
        });
      }
    }
  }

  /** 解析阶段字符串 */
  private parsePhase(value: unknown): 'charging' | 'acting' | 'finished' {
    if (value === 'charging' || value === 'acting' || value === 'finished') {
      return value;
    }
    return 'charging';
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
