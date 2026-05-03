/**
 * 情报值系统 (R7/R8/R9/R10/R11)
 *
 * 管理情报值的获取、上限和兑换:
 * - 获取: 山贼快速处理"+1"绕行分支
 * - 上限: dailyLimit=5, maxCap=100
 * - 兑换: 10点→战斗重试令牌
 * - 约束: 每次事件处理时实时检查(R11)
 *
 * @module engine/map/IntelPointsSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 情报值系统状态 */
export interface IntelPointsState {
  /** 当前情报值 */
  current: number;
  /** 上限 */
  maxCap: number;
  /** 今日已获取量 */
  dailyGained: number;
  /** 每日获取上限 */
  dailyLimit: number;
}

/** 情报值系统存档数据 */
export interface IntelPointsSaveData {
  /** 当前情报值 */
  current: number;
  /** 今日已获取量 */
  dailyGained: number;
  /** 上次重置日期(YYYY-MM-DD) */
  lastResetDate: string;
  /** 版本号 */
  version: number;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 情报值上限 */
const MAX_CAP = 100;

/** 每日获取上限 */
const DAILY_LIMIT = 5;

/** 兑换战斗重试令牌所需情报值 */
const RETRY_TOKEN_COST = 10;

/** 存档版本 */
const SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// IntelPointsSystem
// ─────────────────────────────────────────────

/**
 * 情报值系统
 */
export class IntelPointsSystem implements ISubsystem {
  readonly name = 'intelPoints';

  private deps!: ISystemDeps;
  private current = 0;
  private dailyGained = 0;
  private lastResetDate = '';

  // ── ISubsystem 接口 ──────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.current = 0;
    this.dailyGained = 0;
    this.lastResetDate = '';
  }

  update(_dt: number): void {
    // 事件驱动，不需要每帧更新
  }

  getState(): IntelPointsState {
    return {
      current: this.current,
      maxCap: MAX_CAP,
      dailyGained: this.dailyGained,
      dailyLimit: DAILY_LIMIT,
    };
  }

  reset(): void {
    this.current = 0;
    this.dailyGained = 0;
    this.lastResetDate = '';
  }

  // ── 查询 ─────────────────────────────────────

  /** 获取当前情报值 */
  getCurrent(): number {
    return this.current;
  }

  /** 获取上限 */
  getMaxCap(): number {
    return MAX_CAP;
  }

  /** 获取今日已获取量 */
  getDailyGained(): number {
    return this.dailyGained;
  }

  /** 获取每日获取上限 */
  getDailyLimit(): number {
    return DAILY_LIMIT;
  }

  /** 获取今日剩余可获取量 */
  getDailyRemaining(): number {
    return Math.max(0, DAILY_LIMIT - this.dailyGained);
  }

  /** 是否可获取更多 */
  canAcquire(): boolean {
    return this.current < MAX_CAP && this.dailyGained < DAILY_LIMIT;
  }

  /** 是否可兑换重试令牌 */
  canExchangeRetryToken(): boolean {
    return this.current >= RETRY_TOKEN_COST;
  }

  /** 获取重试令牌兑换成本 */
  getRetryTokenCost(): number {
    return RETRY_TOKEN_COST;
  }

  // ── 每日重置 ─────────────────────────────────

  /**
   * 检查并执行每日重置
   */
  checkDailyReset(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.lastResetDate !== today) {
      this.dailyGained = 0;
      this.lastResetDate = today;
    }
  }

  // ── 获取 ─────────────────────────────────────

  /**
   * 尝试获取情报值
   *
   * @param source - 获取来源
   * @param amount - 获取数量(默认1)
   * @returns 实际获取数量
   */
  acquire(source: string, amount: number = 1): number {
    this.checkDailyReset();

    // 计算实际可获取量(受上限和每日限制约束)
    const capRemaining = MAX_CAP - this.current;
    const dailyRemaining = DAILY_LIMIT - this.dailyGained;
    const actualAmount = Math.min(amount, capRemaining, dailyRemaining);

    if (actualAmount <= 0) {
      this.deps?.eventBus.emit('intelPoints:acquireFailed', {
        source,
        requested: amount,
        reason: this.current >= MAX_CAP ? 'capReached' : 'dailyLimitReached',
      });
      return 0;
    }

    this.current += actualAmount;
    this.dailyGained += actualAmount;

    this.deps?.eventBus.emit('intelPoints:acquired', {
      source,
      amount: actualAmount,
      current: this.current,
      dailyGained: this.dailyGained,
    });

    return actualAmount;
  }

  // ── 消费 ─────────────────────────────────────

  /**
   * 消费情报值
   *
   * @param amount - 消费数量
   * @param reason - 消费原因
   * @returns 是否成功消费
   */
  consume(amount: number, reason: string): boolean {
    if (this.current < amount) {
      this.deps?.eventBus.emit('intelPoints:consumeFailed', {
        reason,
        requested: amount,
        current: this.current,
      });
      return false;
    }

    this.current -= amount;

    this.deps?.eventBus.emit('intelPoints:consumed', {
      reason,
      amount,
      current: this.current,
    });

    return true;
  }

  /**
   * 兑换战斗重试令牌
   *
   * @returns 是否成功兑换
   */
  exchangeRetryToken(): boolean {
    if (!this.canExchangeRetryToken()) {
      this.deps?.eventBus.emit('intelPoints:exchangeFailed', {
        reason: 'insufficient',
        current: this.current,
        cost: RETRY_TOKEN_COST,
      });
      return false;
    }

    this.current -= RETRY_TOKEN_COST;

    this.deps?.eventBus.emit('intelPoints:retryTokenExchanged', {
      cost: RETRY_TOKEN_COST,
      current: this.current,
    });

    return true;
  }

  // ── 序列化 ───────────────────────────────────

  serialize(): IntelPointsSaveData {
    return {
      current: this.current,
      dailyGained: this.dailyGained,
      lastResetDate: this.lastResetDate,
      version: SAVE_VERSION,
    };
  }

  deserialize(data: IntelPointsSaveData): void {
    if (!data) {
      this.current = 0;
      this.dailyGained = 0;
      this.lastResetDate = '';
      return;
    }
    this.current = data.current ?? 0;
    this.dailyGained = data.dailyGained ?? 0;
    this.lastResetDate = data.lastResetDate ?? '';
  }
}
