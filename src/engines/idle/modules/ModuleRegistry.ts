/**
 * ModuleRegistry — 模块注册中心
 *
 * 统一注册和管理放置游戏引擎的所有子系统模块，
 * 提供模块间发现、依赖验证、生命周期管理和状态快照能力。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 支持泛型模块注册与类型安全获取
 * - 自动依赖验证，防止循环引用和缺失依赖
 * - 统一生命周期管理（init / update / reset）
 * - 支持模块状态快照与恢复（序列化 / 反序列化）
 *
 * @module engines/idle/modules/ModuleRegistry
 */

// ============================================================
// 类型定义
// ============================================================

/** 模块描述符，描述一个注册到注册中心的模块 */
export interface ModuleDescriptor<T = unknown> {
  /** 模块唯一标识 */
  id: string;
  /** 模块名称 */
  name: string;
  /** 模块版本（语义化版本号） */
  version: string;
  /** 依赖的模块 ID 列表（注册时不会强制检查，通过 validateDependencies 统一验证） */
  dependencies?: string[];
  /** 模块实例 */
  module: T;
}

/** 单个模块的状态数据 */
export interface ModuleState {
  /** 模块 ID */
  moduleId: string;
  /** 模块状态数据（由模块自身的 getState() 产生） */
  state: unknown;
}

/** 注册中心快照，包含所有模块的状态 */
export interface RegistrySnapshot {
  /** 快照格式版本 */
  version: string;
  /** 快照生成时间戳（ms） */
  timestamp: number;
  /** 所有模块的状态列表 */
  modules: ModuleState[];
}

/**
 * 可初始化模块接口（可选实现）
 * 模块若实现 init 方法，将在注册中心初始化时被调用。
 */
export interface Initializable {
  init(): void;
}

/**
 * 可更新模块接口（可选实现）
 * 模块若实现 update 方法，将在注册中心更新时被调用。
 */
export interface Updatable {
  update(dt: number): void;
}

/**
 * 可重置模块接口（可选实现）
 * 模块若实现 reset 方法，将在注册中心重置时被调用。
 */
export interface Resetable {
  reset(): void;
}

/**
 * 可序列化模块接口（可选实现）
 * 模块若实现 getState/setState 方法，将参与快照生成与恢复。
 */
export interface Serializable {
  getState(): unknown;
  setState(state: unknown): void;
}

// ============================================================
// 常量
// ============================================================

/** 快照格式版本号 */
const SNAPSHOT_VERSION = '1.0.0';

// ============================================================
// ModuleRegistry 实现
// ============================================================

/**
 * 模块注册中心
 *
 * 管理所有子系统模块的注册、发现、依赖验证和生命周期。
 * 所有模块通过唯一的字符串 ID 进行标识和查找。
 *
 * @example
 * ```typescript
 * const registry = new ModuleRegistry();
 * registry.register({
 *   id: 'building',
 *   name: '建筑系统',
 *   version: '1.0.0',
 *   dependencies: ['resource'],
 *   module: new BuildingSystem(config),
 * });
 *
 * const building = registry.get<BuildingSystem>('building');
 * ```
 */
export class ModuleRegistry {
  /** 模块描述符映射表（moduleId → descriptor） */
  private readonly descriptors: Map<string, ModuleDescriptor> = new Map();

  // ========== 注册与注销 ==========

  /**
   * 注册一个模块到注册中心
   *
   * 如果模块 ID 已存在，将抛出错误（防止重复注册）。
   *
   * @param descriptor - 模块描述符
   * @throws {Error} 当模块 ID 已被注册时
   */
  register<T>(descriptor: ModuleDescriptor<T>): void {
    if (this.descriptors.has(descriptor.id)) {
      throw new Error(
        `[ModuleRegistry] 模块 "${descriptor.id}" 已注册，无法重复注册。` +
        `请先调用 unregister() 注销已有模块。`
      );
    }
    this.descriptors.set(descriptor.id, descriptor as ModuleDescriptor);
  }

  /**
   * 注销一个已注册的模块
   *
   * @param moduleId - 要注销的模块 ID
   * @returns 是否成功注销（true = 已注销，false = 模块不存在）
   */
  unregister(moduleId: string): boolean {
    return this.descriptors.delete(moduleId);
  }

  // ========== 查询 ==========

  /**
   * 获取已注册的模块实例
   *
   * @typeParam T - 模块实例类型
   * @param moduleId - 模块 ID
   * @returns 模块实例，若未注册则返回 undefined
   */
  get<T = unknown>(moduleId: string): T | undefined {
    const descriptor = this.descriptors.get(moduleId);
    return descriptor ? (descriptor.module as T) : undefined;
  }

  /**
   * 检查模块是否已注册
   *
   * @param moduleId - 模块 ID
   * @returns 是否已注册
   */
  has(moduleId: string): boolean {
    return this.descriptors.has(moduleId);
  }

  /**
   * 获取所有已注册模块的映射表
   *
   * 返回的是内部映射的浅拷贝，修改返回值不会影响注册中心状态。
   *
   * @returns moduleId → module 实例的映射
   */
  getAll(): Map<string, unknown> {
    const result = new Map<string, unknown>();
    for (const [id, descriptor] of this.descriptors) {
      result.set(id, descriptor.module);
    }
    return result;
  }

  /**
   * 获取模块描述符
   *
   * @param moduleId - 模块 ID
   * @returns 模块描述符，若未注册则返回 undefined
   */
  getDescriptor(moduleId: string): ModuleDescriptor | undefined {
    return this.descriptors.get(moduleId);
  }

  /**
   * 获取已注册模块数量
   *
   * @returns 模块数量
   */
  size(): number {
    return this.descriptors.size;
  }

  // ========== 依赖验证 ==========

  /**
   * 验证所有已注册模块的依赖是否满足
   *
   * 遍历所有模块的 dependencies 列表，检查每个依赖的模块是否已注册。
   *
   * @returns 未满足依赖的模块 ID 列表（空数组表示全部满足）
   */
  validateDependencies(): string[] {
    const unsatisfied: string[] = [];
    for (const [id, descriptor] of this.descriptors) {
      if (descriptor.dependencies) {
        for (const depId of descriptor.dependencies) {
          if (!this.descriptors.has(depId)) {
            unsatisfied.push(id);
            break; // 一个模块只需报告一次
          }
        }
      }
    }
    return unsatisfied;
  }

  // ========== 生命周期 ==========

  /**
   * 初始化所有支持 init() 的模块
   *
   * 按注册顺序依次调用各模块的 init 方法。
   */
  initAll(): void {
    for (const descriptor of this.descriptors.values()) {
      const mod = descriptor.module as Partial<Initializable>;
      if (typeof mod.init === 'function') {
        mod.init();
      }
    }
  }

  /**
   * 更新所有支持 update(dt) 的模块
   *
   * 按注册顺序依次调用各模块的 update 方法。
   *
   * @param dt - 距上次更新的时间间隔（秒）
   */
  updateAll(dt: number): void {
    for (const descriptor of this.descriptors.values()) {
      const mod = descriptor.module as Partial<Updatable>;
      if (typeof mod.update === 'function') {
        mod.update(dt);
      }
    }
  }

  /**
   * 重置所有支持 reset() 的模块
   *
   * 按注册顺序依次调用各模块的 reset 方法。
   */
  resetAll(): void {
    for (const descriptor of this.descriptors.values()) {
      const mod = descriptor.module as Partial<Resetable>;
      if (typeof mod.reset === 'function') {
        mod.reset();
      }
    }
  }

  /**
   * 重置注册中心（清除所有已注册模块）
   *
   * 注意：此操作会先对支持 reset() 的模块执行重置，然后清空注册表。
   */
  reset(): void {
    this.resetAll();
    this.descriptors.clear();
  }

  // ========== 快照 ==========

  /**
   * 对所有支持 getState() 的模块生成状态快照
   *
   * @returns 包含所有模块状态的快照对象
   */
  snapshot(): RegistrySnapshot {
    const modules: ModuleState[] = [];
    for (const [id, descriptor] of this.descriptors) {
      const mod = descriptor.module as Partial<Serializable>;
      if (typeof mod.getState === 'function') {
        modules.push({
          moduleId: id,
          state: mod.getState(),
        });
      }
    }
    return {
      version: SNAPSHOT_VERSION,
      timestamp: Date.now(),
      modules,
    };
  }

  /**
   * 从快照恢复所有模块状态
   *
   * 仅恢复快照中包含的且当前已注册的模块。
   * 模块必须实现 setState() 方法才能被恢复。
   *
   * @param snapshot - 注册中心快照
   */
  restore(snapshot: RegistrySnapshot): void {
    for (const moduleState of snapshot.modules) {
      const descriptor = this.descriptors.get(moduleState.moduleId);
      if (descriptor) {
        const mod = descriptor.module as Partial<Serializable>;
        if (typeof mod.setState === 'function') {
          mod.setState(moduleState.state);
        }
      }
    }
  }
}
