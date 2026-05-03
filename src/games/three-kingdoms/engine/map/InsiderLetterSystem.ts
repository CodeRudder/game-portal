/**
 * 内应信系统 (MAP-F06-07)
 *
 * 管理内应信道具的完整生命周期:
 * - 获取: 攻城胜利20%掉落 / 地图事件掉落(10~25%)
 * - 存储: 堆叠上限10封
 * - 消费: 内应策略扣取
 * - 冷却: 内应失败后24h暴露冷却(per-city)
 *
 * @module engine/map/InsiderLetterSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 内应信系统状态 */
export interface InsiderLetterState {
  /** 当前持有内应信数量 */
  count: number;
  /** 堆叠上限 */
  maxStack: number;
}

/** 内应信系统存档数据 */
export interface InsiderLetterSaveData {
  /** 当前持有数量 */
  count: number;
  /** 累计获取数量 */
  totalAcquired: number;
  /** 累计消费数量 */
  totalConsumed: number;
  version: number;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 内应信堆叠上限 */
const MAX_STACK = 10;

/** 存档版本 */
const SAVE_VERSION = 1;

/** 攻城胜利掉落概率 */
const SIEGE_VICTORY_DROP_CHANCE = 0.20;

// ─────────────────────────────────────────────
// InsiderLetterSystem
// ─────────────────────────────────────────────

/**
 * 内应信系统
 *
 * 管理内应信道具的获取、存储和消费。
 * 冷却管理委托给 SiegeSystem 的 insiderExposures。
 */
export class InsiderLetterSystem implements ISubsystem {
  readonly name = 'insiderLetter';

  private deps!: ISystemDeps;
  private count = 0;
  private totalAcquired = 0;
  private totalConsumed = 0;

  // ── ISubsystem 接口 ──────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.count = 0;
    this.totalAcquired = 0;
    this.totalConsumed = 0;
  }

  update(_dt: number): void {
    // 事件驱动，不需要每帧更新
  }

  getState(): InsiderLetterState {
    return {
      count: this.count,
      maxStack: MAX_STACK,
    };
  }

  reset(): void {
    this.count = 0;
    this.totalAcquired = 0;
    this.totalConsumed = 0;
  }

  // ── 查询 ─────────────────────────────────────

  /** 获取当前内应信数量 */
  getCount(): number {
    return this.count;
  }

  /** 获取堆叠上限 */
  getMaxStack(): number {
    return MAX_STACK;
  }

  /** 是否可获取更多 */
  canAcquire(): boolean {
    return this.count < MAX_STACK;
  }

  /** 是否可消费 */
  canConsume(): boolean {
    return this.count > 0;
  }

  /** 获取累计获取数量 */
  getTotalAcquired(): number {
    return this.totalAcquired;
  }

  /** 获取累计消费数量 */
  getTotalConsumed(): number {
    return this.totalConsumed;
  }

  // ── 获取 ─────────────────────────────────────

  /**
   * 尝试获取内应信
   *
   * @param source - 获取来源描述
   * @param chance - 掉落概率(0~1)
   * @param rng - 随机数生成器
   * @returns 是否成功获取
   */
  tryAcquire(
    source: string,
    chance: number = SIEGE_VICTORY_DROP_CHANCE,
    rng: () => number = Math.random,
  ): boolean {
    if (!this.canAcquire()) {
      this.deps?.eventBus.emit('insiderLetter:acquireFailed', {
        reason: 'stackFull',
        source,
        currentCount: this.count,
        maxStack: MAX_STACK,
      });
      return false;
    }

    if (rng() >= chance) {
      return false;
    }

    this.count++;
    this.totalAcquired++;

    this.deps?.eventBus.emit('insiderLetter:acquired', {
      source,
      newCount: this.count,
      maxStack: MAX_STACK,
    });

    return true;
  }

  /**
   * 直接获取内应信(不经过概率判定)
   */
  acquireDirectly(source: string): boolean {
    if (!this.canAcquire()) return false;
    this.count++;
    this.totalAcquired++;
    this.deps?.eventBus.emit('insiderLetter:acquired', { source, newCount: this.count });
    return true;
  }

  // ── 消费 ─────────────────────────────────────

  /**
   * 消费内应信
   *
   * @param reason - 消费原因描述
   * @returns 是否成功消费
   */
  consume(reason: string): boolean {
    if (!this.canConsume()) {
      this.deps?.eventBus.emit('insiderLetter:consumeFailed', {
        reason: 'insufficient',
        currentCount: this.count,
      });
      return false;
    }

    this.count--;
    this.totalConsumed++;

    this.deps?.eventBus.emit('insiderLetter:consumed', {
      reason,
      newCount: this.count,
    });

    return true;
  }

  // ── 序列化 ───────────────────────────────────

  serialize(): InsiderLetterSaveData {
    return {
      count: this.count,
      totalAcquired: this.totalAcquired,
      totalConsumed: this.totalConsumed,
      version: SAVE_VERSION,
    };
  }

  deserialize(data: InsiderLetterSaveData): void {
    if (!data) {
      this.count = 0;
      this.totalAcquired = 0;
      this.totalConsumed = 0;
      return;
    }
    this.count = data.count ?? 0;
    this.totalAcquired = data.totalAcquired ?? 0;
    this.totalConsumed = data.totalConsumed ?? 0;
  }
}
