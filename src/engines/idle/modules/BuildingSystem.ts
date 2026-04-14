/**
 * BuildingSystem — 放置游戏建筑系统核心模块
 *
 * 提供建筑注册、购买、升级、解锁、产出计算等完整功能。
 * 使用泛型 `BuildingSystem<Def>` 允许游戏自定义扩展 BuildingDef。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 泛型设计，支持游戏自定义建筑定义
 * - 事件驱动，支持 UI 层监听建筑变化
 * - 完整的存档/读档支持
 *
 * @module engines/idle/modules/BuildingSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 建筑定义（基础接口） */
export interface BuildingDef {
  /** 建筑唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 图标标识（emoji 或图标名） */
  icon: string;
  /** 基础建造费用：资源ID → 数量 */
  baseCost: Record<string, number>;
  /** 每级费用递增倍率 */
  costMultiplier: number;
  /** 最大等级（0 表示无上限） */
  maxLevel: number;
  /** 产出资源ID */
  productionResource: string;
  /** 基础每秒产出（等级 1 时） */
  baseProduction: number;
  /** 前置建筑ID列表（全部满足才可解锁） */
  requires?: string[];
  /** 自定义解锁条件描述（仅用于 UI 展示） */
  unlockCondition?: string;
}

/** 建筑运行时状态 */
export interface BuildingState {
  /** 关联的建筑定义 ID */
  defId: string;
  /** 当前等级 */
  level: number;
  /** 是否已解锁 */
  unlocked: boolean;
}

/** 建筑系统事件 */
export type BuildingEvent =
  | { type: 'purchased'; buildingId: string; newLevel: number }
  | { type: 'unlocked'; buildingId: string }
  | { type: 'levelMaxed'; buildingId: string };

/** 建筑系统配置 */
export interface BuildingSystemConfig {
  /** 初始即解锁的建筑 ID 列表 */
  initiallyUnlocked: string[];
  /** 全局产出倍率（默认 1.0） */
  globalMultiplier?: number;
}

/** 事件监听器函数类型 */
export type BuildingEventListener = (event: BuildingEvent) => void;

// ============================================================
// BuildingSystem 实现
// ============================================================

/**
 * 建筑系统 — 管理建筑注册、购买、升级、解锁、产出计算
 *
 * @typeParam Def - 建筑定义类型，必须继承 BuildingDef
 *
 * @example
 * ```typescript
 * // 基础用法
 * const system = new BuildingSystem({
 *   initiallyUnlocked: ['fisherman'],
 * });
 *
 * system.register([
 *   {
 *     id: 'fisherman',
 *     name: '渔夫小屋',
 *     icon: '🏠',
 *     baseCost: { gold: 10 },
 *     costMultiplier: 1.15,
 *     maxLevel: 100,
 *     productionResource: 'fish',
 *     baseProduction: 1,
 *   },
 * ]);
 * ```
 */
export class BuildingSystem<Def extends BuildingDef = BuildingDef> {

  // ========== 内部数据 ==========

  /** 建筑定义注册表：defId → Def */
  private readonly defs: Map<string, Def> = new Map();

  /** 建筑运行时状态：defId → BuildingState */
  private readonly states: Map<string, BuildingState> = new Map();

  /** 系统配置（只读快照） */
  private readonly config: BuildingSystemConfig;

  /** 全局产出倍率 */
  private globalMultiplier: number;

  /** 事件监听器列表 */
  private readonly listeners: BuildingEventListener[] = [];

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 创建建筑系统实例
   *
   * @param config - 系统配置，包含初始解锁列表和全局倍率
   */
  constructor(config: BuildingSystemConfig) {
    this.config = {
      initiallyUnlocked: Array.from(config.initiallyUnlocked),
      globalMultiplier: config.globalMultiplier ?? 1.0,
    };
    this.globalMultiplier = this.config.globalMultiplier!;
  }

  /**
   * 注册建筑定义列表
   *
   * 根据配置中的 initiallyUnlocked 设置初始解锁状态。
   * 重复注册同一 ID 会覆盖之前的定义和状态。
   *
   * @param buildings - 建筑定义数组
   */
  register(buildings: Def[]): void {
    for (const def of buildings) {
      this.defs.set(def.id, def);

      // 如果已有状态（例如重新注册），保留现有状态
      if (!this.states.has(def.id)) {
        const isInitiallyUnlocked = this.config.initiallyUnlocked.includes(def.id);
        this.states.set(def.id, {
          defId: def.id,
          level: 0,
          unlocked: isInitiallyUnlocked,
        });
      }
    }
  }

  /**
   * 从存档恢复建筑等级
   *
   * 仅恢复等级数据，解锁状态由 checkUnlocks() 或 forceUnlock() 管理。
   * 未注册的建筑 ID 会被静默忽略。
   *
   * @param savedLevels - 存档中的等级数据：buildingId → level
   */
  loadState(savedLevels: Record<string, number>): void {
    for (const [id, level] of Object.entries(savedLevels)) {
      const state = this.states.get(id);
      if (state) {
        state.level = level;
      }
    }
  }

  /**
   * 导出当前等级数据用于存档
   *
   * 仅导出等级 > 0 的建筑，减小存档体积。
   *
   * @returns 建筑等级映射：buildingId → level
   */
  saveState(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [id, state] of this.states) {
      if (state.level > 0) {
        result[id] = state.level;
      }
    }
    return result;
  }

  // ============================================================
  // 查询
  // ============================================================

  /**
   * 获取指定建筑定义
   *
   * @param id - 建筑 ID
   * @returns 建筑定义，未找到返回 undefined
   */
  getDef(id: string): Def | undefined {
    return this.defs.get(id);
  }

  /**
   * 获取所有已注册的建筑定义列表
   *
   * @returns 建筑定义数组（保持注册顺序）
   */
  getAllDefs(): Def[] {
    return Array.from(this.defs.values());
  }

  /**
   * 获取指定建筑的当前等级
   *
   * @param id - 建筑 ID
   * @returns 当前等级，未注册返回 0
   */
  getLevel(id: string): number {
    const state = this.states.get(id);
    return state ? state.level : 0;
  }

  /**
   * 计算指定建筑下一级的购买费用
   *
   * 费用公式：floor(baseCost[resource] * costMultiplier^level)
   * 即当前等级 level 对应的是"再升一级"的费用。
   *
   * @param id - 建筑 ID
   * @returns 资源费用映射，未注册返回空对象
   */
  getCost(id: string): Record<string, number> {
    const def = this.defs.get(id);
    if (!def) {
      return {};
    }

    const level = this.getLevel(id);
    const multiplier = Math.pow(def.costMultiplier, level);
    const cost: Record<string, number> = {};

    for (const [resource, baseAmount] of Object.entries(def.baseCost)) {
      cost[resource] = Math.floor(baseAmount * multiplier);
    }

    return cost;
  }

  /**
   * 检查玩家是否买得起指定建筑
   *
   * 综合判断：建筑是否已注册、是否已解锁、是否达到最大等级、资源是否充足。
   *
   * @param id - 建筑 ID
   * @param hasResource - 资源检查回调：(resourceId, amount) => boolean
   * @returns 是否可以购买
   */
  canAfford(id: string, hasResource: (id: string, amount: number) => boolean): boolean {
    const def = this.defs.get(id);
    const state = this.states.get(id);

    // 建筑必须已注册
    if (!def) {
      return false;
    }

    // 建筑必须已解锁
    if (!state || !state.unlocked) {
      return false;
    }

    // 检查是否达到最大等级（maxLevel > 0 时生效）
    if (def.maxLevel > 0 && state.level >= def.maxLevel) {
      return false;
    }

    // 检查资源是否充足
    const cost = this.getCost(id);
    for (const [resource, amount] of Object.entries(cost)) {
      if (!hasResource(resource, amount)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 检查指定建筑是否已解锁
   *
   * @param id - 建筑 ID
   * @returns 是否已解锁，未注册返回 false
   */
  isUnlocked(id: string): boolean {
    const state = this.states.get(id);
    return state ? state.unlocked : false;
  }

  /**
   * 计算指定建筑的每秒产出
   *
   * 产出公式：baseProduction * level * globalMultiplier
   * 等级为 0 时产出为 0。
   *
   * @param id - 建筑 ID
   * @returns 每秒产出值，未注册返回 0
   */
  getProduction(id: string): number {
    const def = this.defs.get(id);
    const state = this.states.get(id);

    if (!def || !state) {
      return 0;
    }

    return def.baseProduction * state.level * this.globalMultiplier;
  }

  /**
   * 计算所有已解锁建筑的总产出（按资源分组汇总）
   *
   * 遍历所有已解锁且等级 > 0 的建筑，按 productionResource 分组累加产出。
   *
   * @returns 资源产出映射：resourceId → 总每秒产出
   */
  getTotalProduction(): Record<string, number> {
    const total: Record<string, number> = {};

    for (const [id, state] of this.states) {
      if (!state.unlocked || state.level <= 0) {
        continue;
      }

      const def = this.defs.get(id);
      if (!def) {
        continue;
      }

      const production = def.baseProduction * state.level * this.globalMultiplier;

      if (total[def.productionResource] === undefined) {
        total[def.productionResource] = 0;
      }
      total[def.productionResource] += production;
    }

    return total;
  }

  /**
   * 获取所有已解锁的建筑定义列表
   *
   * @returns 已解锁的建筑定义数组
   */
  getUnlockedBuildings(): Def[] {
    const result: Def[] = [];

    for (const [id, state] of this.states) {
      if (state.unlocked) {
        const def = this.defs.get(id);
        if (def) {
          result.push(def);
        }
      }
    }

    return result;
  }

  /**
   * 获取可见建筑数量
   *
   * "可见"定义：已解锁的建筑 + 未解锁但前置条件(requires)已全部满足的建筑。
   * 用于 UI 展示"即将解锁"的建筑预览。
   *
   * @returns 可见建筑数量
   */
  getVisibleCount(): number {
    let count = 0;

    for (const [id, state] of this.states) {
      // 已解锁的建筑直接可见
      if (state.unlocked) {
        count++;
        continue;
      }

      // 未解锁的建筑，检查前置条件是否满足
      const def = this.defs.get(id);
      if (def && def.requires && def.requires.length > 0) {
        const allRequiresMet = def.requires.every((reqId) => {
          const reqState = this.states.get(reqId);
          return reqState && reqState.level > 0;
        });

        if (allRequiresMet) {
          count++;
        }
      }
    }

    return count;
  }

  // ============================================================
  // 操作
  // ============================================================

  /**
   * 购买建筑（升级一级）
   *
   * 执行流程：
   * 1. 检查是否买得起（canAfford）
   * 2. 扣除资源（通过 spendResource 回调）
   * 3. 等级 +1
   * 4. 触发 purchased 事件
   * 5. 如果达到最大等级，额外触发 levelMaxed 事件
   *
   * @param id - 建筑 ID
   * @param hasResource - 资源检查回调：(resourceId, amount) => boolean
   * @param spendResource - 资源扣除回调：(resourceId, amount) => void
   * @returns 是否购买成功
   */
  purchase(
    id: string,
    hasResource: (id: string, amount: number) => boolean,
    spendResource: (id: string, amount: number) => void,
  ): boolean {
    // 前置检查：是否买得起
    if (!this.canAfford(id, hasResource)) {
      return false;
    }

    const state = this.states.get(id);
    const def = this.defs.get(id);

    // 双重保障（canAfford 已检查，但防御性编程）
    if (!state || !def) {
      return false;
    }

    // 扣除资源
    const cost = this.getCost(id);
    for (const [resource, amount] of Object.entries(cost)) {
      spendResource(resource, amount);
    }

    // 等级提升
    state.level += 1;

    // 触发 purchased 事件
    this.emitEvent({ type: 'purchased', buildingId: id, newLevel: state.level });

    // 检查是否达到最大等级
    if (def.maxLevel > 0 && state.level >= def.maxLevel) {
      this.emitEvent({ type: 'levelMaxed', buildingId: id });
    }

    return true;
  }

  /**
   * 设置全局产出倍率
   *
   * 影响所有建筑的产出计算。用于声望加成、活动加成等场景。
   *
   * @param multiplier - 新的全局倍率值（应 > 0）
   */
  setGlobalMultiplier(multiplier: number): void {
    this.globalMultiplier = multiplier;
  }

  // ============================================================
  // 解锁
  // ============================================================

  /**
   * 检查所有建筑的解锁条件，自动解锁满足条件的建筑
   *
   * 解锁条件：建筑的 requires 列表中所有前置建筑的等级 > 0。
   * 已解锁的建筑不会重复触发事件。
   *
   * @returns 本次新解锁的建筑 ID 列表
   */
  checkUnlocks(): string[] {
    const newlyUnlocked: string[] = [];

    for (const [id, state] of this.states) {
      // 跳过已解锁的建筑
      if (state.unlocked) {
        continue;
      }

      const def = this.defs.get(id);
      if (!def) {
        continue;
      }

      // 没有前置条件的不在此处处理（由 initiallyUnlocked 或 forceUnlock 管理）
      if (!def.requires || def.requires.length === 0) {
        continue;
      }

      // 检查所有前置条件是否满足
      const allRequiresMet = def.requires.every((reqId) => {
        const reqState = this.states.get(reqId);
        return reqState && reqState.level > 0;
      });

      if (allRequiresMet) {
        state.unlocked = true;
        newlyUnlocked.push(id);
        this.emitEvent({ type: 'unlocked', buildingId: id });
      }
    }

    return newlyUnlocked;
  }

  /**
   * 手动强制解锁指定建筑
   *
   * 用于特殊事件、成就奖励、调试等场景。
   *
   * @param id - 建筑 ID
   * @throws 建筑未注册时静默跳过
   */
  forceUnlock(id: string): void {
    const state = this.states.get(id);
    if (!state) {
      return;
    }

    if (!state.unlocked) {
      state.unlocked = true;
      this.emitEvent({ type: 'unlocked', buildingId: id });
    }
  }

  // ============================================================
  // 事件
  // ============================================================

  /**
   * 注册事件监听器
   *
   * @param listener - 事件回调函数
   */
  onEvent(listener: BuildingEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * 移除事件监听器
   *
   * 使用引用比较移除，需传入与 onEvent 相同的函数引用。
   *
   * @param listener - 要移除的事件回调函数
   */
  offEvent(listener: BuildingEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  // ============================================================
  // 重置
  // ============================================================

  /**
   * 重置建筑系统
   *
   * 将所有建筑等级归零。可选择保留解锁状态。
   *
   * @param keepUnlocked - 是否保留当前解锁状态（默认 false，全部重置为配置的初始解锁）
   */
  reset(keepUnlocked: boolean = false): void {
    for (const [id, state] of this.states) {
      state.level = 0;

      if (keepUnlocked) {
        // 保留当前解锁状态不变
        continue;
      }

      // 重置解锁状态为配置中的初始解锁列表
      state.unlocked = this.config.initiallyUnlocked.includes(id);
    }
  }

  // ============================================================
  // 内部工具
  // ============================================================

  /**
   * 向所有监听器派发事件
   *
   * @param event - 要派发的事件对象
   */
  private emitEvent(event: BuildingEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (_error) {
        // 监听器异常不应中断其他监听器或系统流程
        // 生产环境中可接入日志系统
      }
    }
  }
}
