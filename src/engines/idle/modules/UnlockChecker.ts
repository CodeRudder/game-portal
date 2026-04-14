/**
 * UnlockChecker — 放置游戏解锁检查核心模块
 *
 * 提供基于条件的建筑 / 资源解锁判定功能：
 * - 支持多种原子条件类型（资源数量、建筑等级、点击次数、声望等）
 * - 支持复合条件（AND / OR 逻辑组合）
 * - 递归评估条件树
 * - 注册解锁目标并批量检查
 * - 查询单个目标的解锁进度
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 不可变注册：注册后条件不可修改，保证运行时稳定性
 * - 无副作用：check 方法仅返回结果，不修改传入的 context
 *
 * @module engines/idle/modules/UnlockChecker
 */

// ============================================================
// 类型定义
// ============================================================

/** 解锁条件类型 */
export type UnlockCondition =
  | { type: 'resource_amount'; resourceId: string; minAmount: number }
  | { type: 'building_level'; buildingId: string; minLevel: number }
  | { type: 'total_clicks'; minClicks: number }
  | { type: 'prestige_count'; minCount: number }
  | { type: 'prestige_currency'; minCurrency: number }
  | { type: 'statistic'; statKey: string; minValue: number }
  | { type: 'and'; conditions: UnlockCondition[] }
  | { type: 'or'; conditions: UnlockCondition[] };

/** 解锁检查结果 */
export interface UnlockResult {
  targetId: string;
  unlocked: boolean;
  description: string;
}

/** 解锁目标 */
export interface Unlockable {
  id: string;
  condition: UnlockCondition;
  description: string;
}

/** 解锁检查上下文 */
export interface UnlockContext {
  resources: Map<string, { amount: number; unlocked: boolean }>;
  buildings: Map<string, { level: number; unlocked: boolean }>;
  statistics: Record<string, number>;
  prestige: { currency: number; count: number };
  totalClicks: number;
}

// ============================================================
// UnlockChecker 类
// ============================================================

/**
 * 解锁检查器
 *
 * 负责管理建筑和资源的解锁条件注册与判定。
 * 内部维护两个独立的注册表，支持分类注册和批量检查。
 */
export class UnlockChecker {
  // ---------- 注册表 ----------

  /** 建筑解锁目标注册表（id → Unlockable） */
  private buildingUnlockables: Map<string, Unlockable> = new Map();

  /** 资源解锁目标注册表（id → Unlockable） */
  private resourceUnlockables: Map<string, Unlockable> = new Map();

  // ============================================================
  // 注册方法
  // ============================================================

  /**
   * 注册建筑解锁条件
   *
   * 将一组 Unlockable 注册到建筑解锁表中。
   * 如果 id 已存在，则覆盖旧的条件。
   *
   * @param unlockables - 待注册的建筑解锁目标列表
   */
  registerBuildingUnlocks(unlockables: Unlockable[]): void {
    for (const unlockable of unlockables) {
      this.buildingUnlockables.set(unlockable.id, {
        id: unlockable.id,
        condition: unlockable.condition,
        description: unlockable.description,
      });
    }
  }

  /**
   * 注册资源解锁条件
   *
   * 将一组 Unlockable 注册到资源解锁表中。
   * 如果 id 已存在，则覆盖旧的条件。
   *
   * @param unlockables - 待注册的资源解锁目标列表
   */
  registerResourceUnlocks(unlockables: Unlockable[]): void {
    for (const unlockable of unlockables) {
      this.resourceUnlockables.set(unlockable.id, {
        id: unlockable.id,
        condition: unlockable.condition,
        description: unlockable.description,
      });
    }
  }

  // ============================================================
  // 检查方法
  // ============================================================

  /**
   * 检查建筑解锁
   *
   * 遍历所有已注册的建筑解锁目标，评估每个目标的条件。
   * 仅返回当前 context 下满足条件且对应建筑尚未解锁的目标 ID。
   *
   * @param context - 当前游戏状态上下文
   * @returns 新解锁的建筑 ID 列表
   */
  checkBuildingUnlocks(context: UnlockContext): string[] {
    const newlyUnlocked: string[] = [];

    this.buildingUnlockables.forEach((unlockable, id) => {
      // 跳过已经解锁的建筑
      const buildingState = context.buildings.get(id);
      if (buildingState && buildingState.unlocked) {
        return;
      }

      // 评估条件
      if (this.evaluateCondition(unlockable.condition, context)) {
        newlyUnlocked.push(id);
      }
    });

    return newlyUnlocked;
  }

  /**
   * 检查资源解锁
   *
   * 遍历所有已注册的资源解锁目标，评估每个目标的条件。
   * 仅返回当前 context 下满足条件且对应资源尚未解锁的目标 ID。
   *
   * @param context - 当前游戏状态上下文
   * @returns 新解锁的资源 ID 列表
   */
  checkResourceUnlocks(context: UnlockContext): string[] {
    const newlyUnlocked: string[] = [];

    this.resourceUnlockables.forEach((unlockable, id) => {
      // 跳过已经解锁的资源
      const resourceState = context.resources.get(id);
      if (resourceState && resourceState.unlocked) {
        return;
      }

      // 评估条件
      if (this.evaluateCondition(unlockable.condition, context)) {
        newlyUnlocked.push(id);
      }
    });

    return newlyUnlocked;
  }

  /**
   * 一次性检查所有解锁目标
   *
   * 分别检查建筑和资源的解锁条件，返回分类结果。
   * 等价于同时调用 checkBuildingUnlocks 和 checkResourceUnlocks。
   *
   * @param context - 当前游戏状态上下文
   * @returns 包含新解锁的建筑和资源 ID 列表
   */
  checkAll(context: UnlockContext): { buildings: string[]; resources: string[] } {
    return {
      buildings: this.checkBuildingUnlocks(context),
      resources: this.checkResourceUnlocks(context),
    };
  }

  // ============================================================
  // 进度查询
  // ============================================================

  /**
   * 获取指定目标的解锁进度
   *
   * 在建筑和资源两个注册表中查找目标，返回其解锁状态和描述。
   * 如果目标未注册，返回 null。
   *
   * @param targetId - 目标 ID
   * @param context  - 当前游戏状态上下文
   * @returns 解锁结果，未找到时返回 null
   */
  getProgress(targetId: string, context: UnlockContext): UnlockResult | null {
    // 先在建筑注册表中查找
    const buildingTarget = this.buildingUnlockables.get(targetId);
    if (buildingTarget) {
      const unlocked = this.evaluateCondition(buildingTarget.condition, context);
      return {
        targetId: buildingTarget.id,
        unlocked,
        description: buildingTarget.description,
      };
    }

    // 再在资源注册表中查找
    const resourceTarget = this.resourceUnlockables.get(targetId);
    if (resourceTarget) {
      const unlocked = this.evaluateCondition(resourceTarget.condition, context);
      return {
        targetId: resourceTarget.id,
        unlocked,
        description: resourceTarget.description,
      };
    }

    // 未找到目标
    return null;
  }

  // ============================================================
  // 条件评估（私有核心方法）
  // ============================================================

  /**
   * 递归评估解锁条件
   *
   * 根据条件类型从 context 中提取对应数据并进行判定。
   * 支持 AND / OR 复合条件的递归求值。
   *
   * 评估规则：
   * - resource_amount: 检查资源数量 >= minAmount（资源不存在时视为 0）
   * - building_level:  检查建筑等级 >= minLevel（建筑不存在时视为 0）
   * - total_clicks:    检查总点击次数 >= minClicks
   * - prestige_count:  检查声望次数 >= minCount
   * - prestige_currency: 检查声望货币 >= minCurrency
   * - statistic:       检查统计值 >= minValue（键不存在时视为 0）
   * - and:             所有子条件都满足时为 true（空列表为 true）
   * - or:              任一子条件满足时为 true（空列表为 false）
   *
   * @param condition - 待评估的解锁条件
   * @param ctx       - 当前游戏状态上下文
   * @returns 条件是否满足
   */
  private evaluateCondition(condition: UnlockCondition, ctx: UnlockContext): boolean {
    switch (condition.type) {
      case 'resource_amount': {
        const resource = ctx.resources.get(condition.resourceId);
        const amount = resource ? resource.amount : 0;
        return amount >= condition.minAmount;
      }

      case 'building_level': {
        const building = ctx.buildings.get(condition.buildingId);
        const level = building ? building.level : 0;
        return level >= condition.minLevel;
      }

      case 'total_clicks': {
        return ctx.totalClicks >= condition.minClicks;
      }

      case 'prestige_count': {
        return ctx.prestige.count >= condition.minCount;
      }

      case 'prestige_currency': {
        return ctx.prestige.currency >= condition.minCurrency;
      }

      case 'statistic': {
        const value = ctx.statistics[condition.statKey] ?? 0;
        return value >= condition.minValue;
      }

      case 'and': {
        // 空列表视为满足（vacuous truth）
        if (condition.conditions.length === 0) {
          return true;
        }
        return condition.conditions.every((sub) => this.evaluateCondition(sub, ctx));
      }

      case 'or': {
        // 空列表视为不满足
        if (condition.conditions.length === 0) {
          return false;
        }
        return condition.conditions.some((sub) => this.evaluateCondition(sub, ctx));
      }

      default: {
        // 未知条件类型，安全降级为不满足
        return false;
      }
    }
  }
}
