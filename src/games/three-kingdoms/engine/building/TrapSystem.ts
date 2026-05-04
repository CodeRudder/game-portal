/**
 * 建筑域 — 陷阱系统
 *
 * 职责：管理城墙陷阱的部署、库存、触发
 * 3种陷阱：箭塔(持续)、拒马(持续)、陷坑(一次性)
 * 陷阱上限 = wallLevel × 5
 *
 * @module engine/building/TrapSystem
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 陷阱类型配置 */
export interface TrapDef {
  /** 伤害值 */
  damage: number;
  /** 减速百分比（可选） */
  slowPercent?: number;
  /** 持续类型：persistent=持续, single_use=一次性 */
  duration: 'persistent' | 'single_use';
  /** 部署消耗矿石 */
  costOre: number;
  /** 中文标签 */
  label: string;
}

/** 陷阱触发结果 */
export interface TriggerResult {
  /** 总伤害 */
  totalDamage: number;
  /** 各陷阱消耗数量 */
  trapsUsed: Record<string, number>;
}

/** 陷阱总效果 */
export interface TrapBonusResult {
  /** 总伤害 */
  damage: number;
  /** 总减速百分比 */
  slow: number;
}

/** 陷阱系统序列化数据 */
export interface TrapSaveData {
  version: number;
  inventory: Record<string, number>;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 陷阱类型配置表 */
export const TRAP_TYPES: Record<string, TrapDef> = {
  arrow_tower: {
    damage: 500,
    duration: 'persistent',
    costOre: 200,
    label: '箭塔',
  },
  barricade: {
    damage: 200,
    slowPercent: 30,
    duration: 'persistent',
    costOre: 150,
    label: '拒马',
  },
  pitfall: {
    damage: 1500,
    duration: 'single_use',
    costOre: 300,
    label: '陷坑',
  },
};

/** 陷阱触发顺序（按伤害从高到低） */
const TRIGGER_ORDER = ['pitfall', 'arrow_tower', 'barricade'];

// ─────────────────────────────────────────────
// 陷阱系统类
// ─────────────────────────────────────────────

/**
 * 陷阱系统
 *
 * 通过回调获取矿石和城墙等级，不直接依赖其他系统
 */
export class TrapSystem {
  // 外部依赖
  private wallLevel: number = 0;
  private getOre: () => number = () => 0;
  private spendOre: (n: number) => boolean = () => false;

  // 陷阱库存
  private inventory: Record<string, number> = {};

  // ─────────────────────────────────────────
  // 初始化
  // ─────────────────────────────────────────

  /**
   * 初始化陷阱系统
   * @param wallLevel 城墙等级
   * @param getOre 获取矿石数量回调
   * @param spendOre 消耗矿石回调
   */
  init(wallLevel: number, getOre: () => number, spendOre: (n: number) => boolean): void {
    this.wallLevel = Math.max(0, Math.floor(wallLevel));
    this.getOre = getOre;
    this.spendOre = spendOre;
    this.inventory = {};
  }

  // ─────────────────────────────────────────
  // 部署操作
  // ─────────────────────────────────────────

  /**
   * 部署陷阱
   * 消耗矿石→陷阱库存+1
   */
  deployTrap(trapType: string): { success: boolean; reason?: string } {
    // 检查陷阱类型
    const trapDef = TRAP_TYPES[trapType];
    if (!trapDef) {
      return { success: false, reason: '未知陷阱类型' };
    }

    // 检查库存上限
    const currentTotal = this.getTotalTraps();
    const maxTraps = this.getMaxTraps();
    if (currentTotal >= maxTraps) {
      return { success: false, reason: `陷阱库存已达上限(${maxTraps})` };
    }

    // 检查矿石
    if (this.getOre() < trapDef.costOre) {
      return { success: false, reason: '矿石不足' };
    }

    // 扣除矿石
    if (!this.spendOre(trapDef.costOre)) {
      return { success: false, reason: '矿石扣除失败' };
    }

    // 库存+1
    if (!this.inventory[trapType]) {
      this.inventory[trapType] = 0;
    }
    this.inventory[trapType]++;

    return { success: true };
  }

  // ─────────────────────────────────────────
  // 触发操作
  // ─────────────────────────────────────────

  /**
   * 触发所有陷阱（攻城战开始时调用）
   * 按顺序触发，一次性陷阱触发后消失，持续陷阱保留
   */
  triggerTraps(): TriggerResult {
    let totalDamage = 0;
    const trapsUsed: Record<string, number> = {};

    for (const trapType of TRIGGER_ORDER) {
      const count = this.inventory[trapType] ?? 0;
      if (count <= 0) continue;

      const trapDef = TRAP_TYPES[trapType];
      if (!trapDef) continue;

      // 触发所有该类型陷阱
      totalDamage += trapDef.damage * count;
      trapsUsed[trapType] = count;

      // 一次性陷阱触发后消失
      if (trapDef.duration === 'single_use') {
        this.inventory[trapType] = 0;
      }
      // 持续陷阱保留
    }

    return { totalDamage, trapsUsed };
  }

  // ─────────────────────────────────────────
  // 查询
  // ─────────────────────────────────────────

  /**
   * 获取陷阱库存
   */
  getTrapInventory(): Record<string, number> {
    return { ...this.inventory };
  }

  /**
   * 获取陷阱库存上限
   * 上限 = wallLevel × 5
   */
  getMaxTraps(): number {
    return this.wallLevel * 5;
  }

  /**
   * 获取陷阱总效果（伤害+减速）
   */
  getTrapBonus(): TrapBonusResult {
    let damage = 0;
    let slow = 0;

    for (const [trapType, count] of Object.entries(this.inventory)) {
      const trapDef = TRAP_TYPES[trapType];
      if (!trapDef || count <= 0) continue;

      damage += trapDef.damage * count;
      if (trapDef.slowPercent) {
        slow += trapDef.slowPercent * count;
      }
    }

    return { damage, slow };
  }

  // ─────────────────────────────────────────
  // 序列化 / 反序列化
  // ─────────────────────────────────────────

  serialize(): TrapSaveData {
    return {
      version: 1,
      inventory: { ...this.inventory },
    };
  }

  deserialize(data: TrapSaveData): void {
    if (data && data.inventory) {
      this.inventory = { ...data.inventory };
    }
  }

  reset(): void {
    this.inventory = {};
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /**
   * 获取当前陷阱总数
   */
  private getTotalTraps(): number {
    let total = 0;
    for (const count of Object.values(this.inventory)) {
      total += count;
    }
    return total;
  }
}
