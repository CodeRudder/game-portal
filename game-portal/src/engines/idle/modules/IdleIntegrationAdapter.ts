/**
 * IdleIntegrationAdapter — 放置游戏引擎集成适配器
 *
 * 将 ModuleRegistry 和 ModuleEventBus 整合到放置游戏引擎中，
 * 提供统一的初始化流程、自动事件连接和引擎级别的状态管理。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 适配器模式，不修改现有模块代码
 * - 防御性编程，所有模块连接都检查存在性
 * - 自动事件连接，将子系统事件桥接到统计追踪器
 * - 统一的快照/恢复/重置接口
 *
 * 自动连接规则：
 * - BuildingSystem 'building_upgraded' → StatisticsTracker increment 'buildingUpgrades'
 * - UnitSystem 'unit_unlocked' → StatisticsTracker increment 'unitsUnlocked'
 * - PrestigeSystem 'prestige_completed' → StatisticsTracker increment 'prestigeCount'
 * - BattleSystem 'battle_completed' → StatisticsTracker increment 'battlesWon'
 *
 * @module engines/idle/modules/IdleIntegrationAdapter
 */

import type { ModuleRegistry, RegistrySnapshot } from './ModuleRegistry';
import type { ModuleEventBus } from './ModuleEventBus';

// ============================================================
// 常量
// ============================================================

/** 模块 ID 常量 */
const MODULE_ID = {
  BUILDING: 'building',
  UNIT: 'unit',
  PRESTIGE: 'prestige',
  BATTLE: 'battle',
  STATISTICS: 'statistics',
} as const;

/** 事件频道常量 */
const CHANNEL = {
  BUILDING_UPGRADED: 'building_upgraded',
  UNIT_UNLOCKED: 'unit_unlocked',
  PRESTIGE_COMPLETED: 'prestige_completed',
  BATTLE_COMPLETED: 'battle_completed',
} as const;

/** 统计项常量 */
const STAT = {
  BUILDING_UPGRADES: 'buildingUpgrades',
  UNITS_UNLOCKED: 'unitsUnlocked',
  PRESTIGE_COUNT: 'prestigeCount',
  BATTLES_WON: 'battlesWon',
} as const;

// ============================================================
// IdleIntegrationAdapter 实现
// ============================================================

/**
 * 放置游戏引擎集成适配器
 *
 * 整合模块注册中心和事件总线，提供引擎级别的统一管理接口。
 * 适配器不持有自身状态，所有状态由注册中心和事件总线管理。
 *
 * @example
 * ```typescript
 * const registry = new ModuleRegistry();
 * const eventBus = new ModuleEventBus();
 * const adapter = new IdleIntegrationAdapter(registry, eventBus);
 *
 * // 注册模块
 * registry.register({ id: 'building', name: '建筑系统', version: '1.0.0', module: buildingSystem });
 * registry.register({ id: 'statistics', name: '统计追踪', version: '1.0.0', module: statsTracker });
 *
 * // 初始化并连接事件
 * adapter.initialize();
 * adapter.connectModuleEvents();
 *
 * // 游戏循环
 * function gameLoop(dt: number) {
 *   adapter.update(dt);
 * }
 * ```
 */
export class IdleIntegrationAdapter {
  /** 模块注册中心 */
  private readonly registry: ModuleRegistry;
  /** 模块事件总线 */
  private readonly eventBus: ModuleEventBus;

  /** 已注册的取消订阅函数列表（用于清理事件连接） */
  private readonly unsubscribers: (() => void)[] = [];

  /** 适配器是否已初始化 */
  private initialized: boolean = false;

  /**
   * @param registry - 模块注册中心实例
   * @param eventBus - 模块事件总线实例
   */
  constructor(registry: ModuleRegistry, eventBus: ModuleEventBus) {
    this.registry = registry;
    this.eventBus = eventBus;
  }

  // ========== 生命周期 ==========

  /**
   * 初始化所有模块，验证依赖
   *
   * 执行步骤：
   * 1. 验证所有模块依赖是否满足
   * 2. 调用所有支持 init() 的模块的初始化方法
   * 3. 标记为已初始化
   *
   * @throws {Error} 当存在未满足的依赖时
   */
  initialize(): void {
    // 验证依赖
    const unsatisfied = this.registry.validateDependencies();
    if (unsatisfied.length > 0) {
      throw new Error(
        `[IdleIntegrationAdapter] 以下模块的依赖未满足: ${unsatisfied.join(', ')}`
      );
    }

    // 初始化所有模块
    this.registry.initAll();

    this.initialized = true;
  }

  /**
   * 更新所有支持 update 的模块
   *
   * @param dt - 距上次更新的时间间隔（秒）
   */
  update(dt: number): void {
    this.registry.updateAll(dt);
  }

  /**
   * 生成完整快照
   *
   * @returns 包含所有模块状态的快照
   */
  snapshot(): RegistrySnapshot {
    return this.registry.snapshot();
  }

  /**
   * 从快照恢复所有模块状态
   *
   * @param snapshot - 注册中心快照
   */
  restore(snapshot: RegistrySnapshot): void {
    this.registry.restore(snapshot);
  }

  /**
   * 重置所有模块并清除事件连接
   *
   * 重置后需要重新调用 connectModuleEvents() 恢复事件连接。
   */
  reset(): void {
    // 先断开事件连接
    this.disconnectModuleEvents();
    // 重置所有模块
    this.registry.resetAll();
    // 重置事件总线
    this.eventBus.reset();
    this.initialized = false;
  }

  // ========== 事件连接 ==========

  /**
   * 自动连接模块间事件
   *
   * 根据预定义的规则，将子系统事件桥接到统计追踪器。
   * 所有连接都采用防御性编程，仅在目标模块存在时才建立连接。
   *
   * 连接规则：
   * - building_upgraded → statistics.increment('buildingUpgrades')
   * - unit_unlocked → statistics.increment('unitsUnlocked')
   * - prestige_completed → statistics.increment('prestigeCount')
   * - battle_completed → statistics.increment('battlesWon')
   */
  connectModuleEvents(): void {
    // 先清除已有连接
    this.disconnectModuleEvents();

    // 检查统计追踪器是否存在
    const stats = this.registry.get<{ increment?: (statId: string, value?: number) => void }>(MODULE_ID.STATISTICS);
    if (!stats || typeof stats.increment !== 'function') {
      // 统计追踪器不存在或接口不匹配，跳过所有连接
      return;
    }

    // BuildingSystem → StatisticsTracker
    if (this.registry.has(MODULE_ID.BUILDING)) {
      const unsub = this.eventBus.subscribe(
        CHANNEL.BUILDING_UPGRADED,
        () => {
          stats.increment!(STAT.BUILDING_UPGRADES);
        }
      );
      this.unsubscribers.push(unsub);
    }

    // UnitSystem → StatisticsTracker
    if (this.registry.has(MODULE_ID.UNIT)) {
      const unsub = this.eventBus.subscribe(
        CHANNEL.UNIT_UNLOCKED,
        () => {
          stats.increment!(STAT.UNITS_UNLOCKED);
        }
      );
      this.unsubscribers.push(unsub);
    }

    // PrestigeSystem → StatisticsTracker
    if (this.registry.has(MODULE_ID.PRESTIGE)) {
      const unsub = this.eventBus.subscribe(
        CHANNEL.PRESTIGE_COMPLETED,
        () => {
          stats.increment!(STAT.PRESTIGE_COUNT);
        }
      );
      this.unsubscribers.push(unsub);
    }

    // BattleSystem → StatisticsTracker
    if (this.registry.has(MODULE_ID.BATTLE)) {
      const unsub = this.eventBus.subscribe(
        CHANNEL.BATTLE_COMPLETED,
        () => {
          stats.increment!(STAT.BATTLES_WON);
        }
      );
      this.unsubscribers.push(unsub);
    }
  }

  /**
   * 断开所有模块间事件连接
   *
   * 调用所有已注册的取消订阅函数。
   */
  disconnectModuleEvents(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
  }

  // ========== 状态查询 ==========

  /**
   * 检查适配器是否已初始化
   *
   * @returns 是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 获取活跃的事件连接数量
   *
   * @returns 活跃的取消订阅函数数量
   */
  getConnectionCount(): number {
    return this.unsubscribers.length;
  }
}
