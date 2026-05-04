/**
 * 攻城策略道具系统 (I8)
 *
 * 管理攻城策略道具(夜袭令/内应信/攻城手册)的获取、存储和消费。
 * 道具获取途径: shop(商店购买) / drop(攻城掉落) / daily(每日领取)
 *
 * @module engine/map/SiegeItemSystem
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 攻城道具类型 */
export type SiegeItemType = 'nightRaid' | 'insiderLetter' | 'siegeManual';

/** 道具获取来源 */
export type SiegeItemSource = 'shop' | 'drop' | 'daily';

/** 单个道具数据 */
export interface SiegeItem {
  /** 道具类型 */
  type: SiegeItemType;
  /** 持有数量 */
  count: number;
}

/** 道具系统存档数据 */
export interface SiegeItemSaveData {
  /** 道具列表 */
  items: Record<SiegeItemType, number>;
  /** 累计获取计数 */
  totalAcquired: Record<SiegeItemType, number>;
  /** 累计消费计数 */
  totalConsumed: Record<SiegeItemType, number>;
  /** 版本号 */
  version: number;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 道具堆叠上限 */
const MAX_STACK: Record<SiegeItemType, number> = {
  nightRaid: 10,
  insiderLetter: 10,
  siegeManual: 5,
};

/** 道具名称映射 */
export const SIEGE_ITEM_NAMES: Record<SiegeItemType, string> = {
  nightRaid: '夜袭令',
  insiderLetter: '内应信',
  siegeManual: '攻城手册',
};

/** 存档版本 */
const SAVE_VERSION = 1;

/** 所有道具类型 */
export const ALL_ITEM_TYPES: SiegeItemType[] = ['nightRaid', 'insiderLetter', 'siegeManual'];

// ─────────────────────────────────────────────
// 确定性Hash工具
// ─────────────────────────────────────────────

/**
 * 字符串哈希函数 (djb2)
 * 用于基于taskId的确定性随机判定
 */
export function hashCode(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
}

/**
 * 判定是否掉落内应信 (I7)
 *
 * 使用确定性随机种子（基于taskId的hash），保证可测试性。
 * 20%掉落概率：hashCode(taskId) % 100 < 20
 *
 * @param taskId - 攻城任务ID
 * @returns 是否掉落
 */
export function shouldDropInsiderLetter(taskId: string): boolean {
  return hashCode(taskId) % 100 < 20;
}

// ─────────────────────────────────────────────
// SiegeItemSystem
// ─────────────────────────────────────────────

/**
 * 攻城道具系统
 *
 * 管理攻城策略道具的获取、存储和消费。
 */
export class SiegeItemSystem {
  private inventory: Record<SiegeItemType, number> = {
    nightRaid: 0,
    insiderLetter: 0,
    siegeManual: 0,
  };
  private totalAcquired: Record<SiegeItemType, number> = {
    nightRaid: 0,
    insiderLetter: 0,
    siegeManual: 0,
  };
  private totalConsumed: Record<SiegeItemType, number> = {
    nightRaid: 0,
    insiderLetter: 0,
    siegeManual: 0,
  };

  // ── 查询 ─────────────────────────────────────

  /**
   * 获取完整背包
   */
  getInventory(): SiegeItem[] {
    return ALL_ITEM_TYPES.map((type) => ({
      type,
      count: this.inventory[type],
    }));
  }

  /**
   * 获取指定道具数量
   */
  getCount(type: SiegeItemType): number {
    return this.inventory[type];
  }

  /**
   * 是否持有指定道具（数量 > 0）
   */
  hasItem(type: SiegeItemType): boolean {
    return this.inventory[type] > 0;
  }

  /**
   * 获取堆叠上限
   */
  getMaxStack(type: SiegeItemType): number {
    return MAX_STACK[type];
  }

  /**
   * 获取累计获取数量
   */
  getTotalAcquired(type: SiegeItemType): number {
    return this.totalAcquired[type];
  }

  /**
   * 获取累计消费数量
   */
  getTotalConsumed(type: SiegeItemType): number {
    return this.totalConsumed[type];
  }

  // ── 获取 ─────────────────────────────────────

  /**
   * 获取道具
   *
   * @param type - 道具类型
   * @param source - 获取来源
   * @param amount - 获取数量（默认1）
   * @returns 是否成功获取
   */
  acquireItem(type: SiegeItemType, source: SiegeItemSource, amount: number = 1): boolean {
    const current = this.inventory[type];
    const max = MAX_STACK[type];

    if (current >= max) {
      return false;
    }

    const actualAmount = Math.min(amount, max - current);
    this.inventory[type] += actualAmount;
    this.totalAcquired[type] += actualAmount;

    return true;
  }

  // ── 消费 ─────────────────────────────────────

  /**
   * 消费道具
   *
   * @param type - 道具类型
   * @param amount - 消费数量（默认1）
   * @returns 是否成功消费
   */
  consumeItem(type: SiegeItemType, amount: number = 1): boolean {
    if (this.inventory[type] < amount) {
      return false;
    }

    this.inventory[type] -= amount;
    this.totalConsumed[type] += amount;

    return true;
  }

  // ── 重置 ─────────────────────────────────────

  /**
   * 重置所有数据
   */
  reset(): void {
    for (const type of ALL_ITEM_TYPES) {
      this.inventory[type] = 0;
      this.totalAcquired[type] = 0;
      this.totalConsumed[type] = 0;
    }
  }

  // ── 序列化 ───────────────────────────────────

  /**
   * 序列化存档
   */
  serialize(): SiegeItemSaveData {
    return {
      items: { ...this.inventory },
      totalAcquired: { ...this.totalAcquired },
      totalConsumed: { ...this.totalConsumed },
      version: SAVE_VERSION,
    };
  }

  /**
   * 反序列化恢复
   */
  deserialize(data: SiegeItemSaveData): void {
    if (!data) {
      this.reset();
      return;
    }
    for (const type of ALL_ITEM_TYPES) {
      this.inventory[type] = data.items?.[type] ?? 0;
      this.totalAcquired[type] = data.totalAcquired?.[type] ?? 0;
      this.totalConsumed[type] = data.totalConsumed?.[type] ?? 0;
    }
  }
}
