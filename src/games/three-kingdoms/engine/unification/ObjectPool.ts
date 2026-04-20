/**
 * 引擎层 — 通用对象池
 *
 * 用于粒子、飘字、子弹等高频创建/销毁对象的复用，
 * 减少 GC 压力，提升运行时性能。
 *
 * @module engine/unification/ObjectPool
 */

import type { ObjectPoolState } from '../../core/unification';

// ─────────────────────────────────────────────
// 对象池条目
// ─────────────────────────────────────────────

/** 对象池内部条目 */
interface PoolEntry<T> {
  object: T;
  active: boolean;
}

// ─────────────────────────────────────────────
// 对象池实现
// ─────────────────────────────────────────────

/**
 * 通用对象池
 *
 * 用于粒子、飘字、子弹等高频创建/销毁对象的复用。
 *
 * @typeParam T - 池中对象的类型
 *
 * @example
 * ```ts
 * const bulletPool = new ObjectPool<Bullet>(
 *   'bullet',
 *   () => new Bullet(),
 *   (b) => b.reset(),
 *   20,
 * );
 *
 * const bullet = bulletPool.allocate();
 * // ... 使用 bullet ...
 * bulletPool.deallocate(bullet);
 * ```
 */
export class ObjectPool<T> {
  private pool: PoolEntry<T>[] = [];
  private factory: () => T;
  private resetFn: (obj: T) => void;
  private name: string;
  private totalAllocations = 0;
  private totalDeallocations = 0;
  private hits = 0;
  private misses = 0;

  /**
   * @param name - 池名称（用于调试和报告）
   * @param factory - 创建新对象的工厂函数
   * @param resetFn - 重置对象状态的函数（分配和回收时调用）
   * @param initialSize - 初始预分配数量
   */
  constructor(name: string, factory: () => T, resetFn: (obj: T) => void, initialSize: number = 10) {
    this.name = name;
    this.factory = factory;
    this.resetFn = resetFn;

    for (let i = 0; i < initialSize; i++) {
      this.pool.push({ object: this.factory(), active: false });
    }
  }

  /** 分配一个对象（优先复用已回收的，否则创建新的） */
  allocate(): T {
    this.totalAllocations++;
    const inactive = this.pool.find(e => !e.active);
    if (inactive) {
      inactive.active = true;
      this.hits++;
      this.resetFn(inactive.object);
      return inactive.object;
    }
    this.misses++;
    const obj = this.factory();
    this.pool.push({ object: obj, active: true });
    return obj;
  }

  /** 回收一个对象（归还到池中等待复用） */
  deallocate(obj: T): void {
    const entry = this.pool.find(e => e.object === obj);
    if (entry) {
      entry.active = false;
      this.totalDeallocations++;
      this.resetFn(obj);
    }
  }

  /** 获取池状态快照（用于性能报告） */
  getState(): ObjectPoolState {
    const activeCount = this.pool.filter(e => e.active).length;
    return {
      name: this.name,
      poolSize: this.pool.length,
      activeCount,
      totalAllocations: this.totalAllocations,
      totalDeallocations: this.totalDeallocations,
      hitRate: this.totalAllocations > 0 ? this.hits / this.totalAllocations : 0,
    };
  }

  /** 清空池（释放所有对象） */
  clear(): void {
    this.pool = [];
    this.totalAllocations = 0;
    this.totalDeallocations = 0;
    this.hits = 0;
    this.misses = 0;
  }
}
