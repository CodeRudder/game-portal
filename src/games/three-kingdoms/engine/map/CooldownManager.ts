/**
 * 统一冷却管理器 (R7/R8/R9/R10)
 *
 * 管理所有冷却状态的统一入口:
 * - 全局单例管理所有冷却状态
 * - cooldownStateChanged事件驱动UI更新
 * - 10s定时扫描主动检测冷却结束
 * - 乐观锁去重 + destroy()生命周期
 *
 * @module engine/map/CooldownManager
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 冷却状态 */
export type CooldownStatus = 'active' | 'ended' | 'none';

/** 冷却条目 */
export interface CooldownEntry {
  /** 关联ID(如领土ID) */
  id: string;
  /** 冷却类型 */
  type: string;
  /** 开始时间戳(ms) */
  startAt: number;
  /** 持续时间(ms) */
  duration: number;
  /** 结束时间戳(ms) */
  endAt: number;
  /** 状态 */
  status: CooldownStatus;
  /** 剩余时间(ms) */
  remaining?: number;
}

/** 冷却状态变化事件 */
export interface CooldownStateChangedEvent {
  /** 关联ID */
  id: string;
  /** 冷却类型 */
  type: string;
  /** 新状态 */
  status: CooldownStatus;
  /** 剩余时间(ms, 仅active时有效) */
  remaining: number;
}

/** 冷却状态变化监听器 */
export type CooldownListener = (event: CooldownStateChangedEvent) => void;

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 扫描间隔(ms) */
const SCAN_INTERVAL_MS = 10000; // 10s

// ─────────────────────────────────────────────
// CooldownManager
// ─────────────────────────────────────────────

/**
 * 统一冷却管理器
 *
 * 提供统一的冷却状态管理接口，支持多种冷却类型。
 * 使用定时扫描主动检测冷却结束，消除UI被动依赖。
 */
export class CooldownManager {
  private cooldowns: Map<string, CooldownEntry> = new Map();
  private listeners: Set<CooldownListener> = new Set();
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private readonly scanInterval: number;

  constructor(options?: { scanInterval?: number }) {
    this.scanInterval = options?.scanInterval ?? SCAN_INTERVAL_MS;
  }

  // ── 生命周期 ─────────────────────────────────

  /**
   * 销毁冷却管理器
   * 停止扫描、清空数据、释放引用
   */
  destroy(): void {
    this.stopScan();
    this.cooldowns.clear();
    this.listeners.clear();
  }

  // ── 查询 ─────────────────────────────────────

  /**
   * 获取冷却状态
   */
  getCooldown(id: string, type: string): CooldownEntry | null {
    const key = this.makeKey(id, type);
    const entry = this.cooldowns.get(key);
    if (!entry || entry.status !== 'active') return null;

    const now = Date.now();
    const remaining = entry.endAt - now;

    if (remaining <= 0) {
      // 冷却已结束，主动清理
      entry.status = 'ended';
      this.emitStateChanged({ id, type, status: 'ended', remaining: 0 });
      this.cooldowns.delete(key);
      this.stopScanIfEmpty();
      return null;
    }

    return { ...entry, remaining };
  }

  /**
   * 检查是否在冷却中
   */
  isInCooldown(id: string, type: string): boolean {
    return this.getCooldown(id, type) !== null;
  }

  /**
   * 获取冷却剩余时间(ms)
   */
  getRemaining(id: string, type: string): number {
    const entry = this.getCooldown(id, type);
    return entry ? entry.endAt - Date.now() : 0;
  }

  /**
   * 获取所有活跃冷却
   */
  getAllActive(): CooldownEntry[] {
    const now = Date.now();
    const result: CooldownEntry[] = [];
    for (const entry of this.cooldowns.values()) {
      if (entry.status === 'active') {
        const remaining = entry.endAt - now;
        if (remaining > 0) {
          result.push({ ...entry });
        }
      }
    }
    return result;
  }

  // ── 设置 ─────────────────────────────────────

  /**
   * 设置冷却
   */
  setCooldown(id: string, type: string, durationMs: number): void {
    const key = this.makeKey(id, type);
    const now = Date.now();
    const entry: CooldownEntry = {
      id,
      type,
      startAt: now,
      duration: durationMs,
      endAt: now + durationMs,
      status: 'active',
    };

    this.cooldowns.set(key, entry);
    this.emitStateChanged({ id, type, status: 'active', remaining: durationMs });
    this.startScan();
  }

  /**
   * 清除冷却
   */
  clearCooldown(id: string, type: string): void {
    const key = this.makeKey(id, type);
    const entry = this.cooldowns.get(key);
    if (entry) {
      this.cooldowns.delete(key);
      this.emitStateChanged({ id, type, status: 'ended', remaining: 0 });
      this.stopScanIfEmpty();
    }
  }

  // ── 监听 ─────────────────────────────────────

  /**
   * 注册状态变化监听器
   */
  onStateChanged(listener: CooldownListener): void {
    this.listeners.add(listener);
  }

  /**
   * 移除状态变化监听器
   */
  offStateChanged(listener: CooldownListener): void {
    this.listeners.delete(listener);
  }

  // ── 内部方法 ─────────────────────────────────

  private makeKey(id: string, type: string): string {
    return `${type}:${id}`;
  }

  private emitStateChanged(event: CooldownStateChangedEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // 监听器异常不影响其他监听器
      }
    }
  }

  /**
   * 启动定时扫描
   */
  private startScan(): void {
    if (this.scanTimer) return;
    this.scanTimer = setInterval(() => {
      this.scanAllCooldowns();
    }, this.scanInterval);
  }

  /**
   * 停止定时扫描
   */
  private stopScan(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }

  /**
   * 无活跃冷却时停止扫描
   */
  private stopScanIfEmpty(): void {
    if (this.cooldowns.size === 0) {
      this.stopScan();
    }
  }

  /**
   * 扫描所有冷却状态(R10: 先收集后删除)
   */
  private scanAllCooldowns(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    // 阶段1: 遍历收集
    for (const [key, entry] of this.cooldowns) {
      if (entry.status === 'active' && entry.endAt - now <= 0) {
        toDelete.push(key);
      }
    }

    // 阶段2: 统一处理
    for (const key of toDelete) {
      const entry = this.cooldowns.get(key);
      if (entry) {
        entry.status = 'ended';
        this.emitStateChanged({
          id: entry.id,
          type: entry.type,
          status: 'ended',
          remaining: 0,
        });
        this.cooldowns.delete(key);
      }
    }

    // 无冷却时停止扫描
    if (this.cooldowns.size === 0) {
      this.stopScan();
    }
  }
}
