/**
 * Engine 测试工厂
 *
 * 核心设计：
 * 1. 创建真实 ThreeKingdomsEngine 实例（非 mock）
 * 2. 支持缓存复用（同一测试文件内共享，避免重复创建开销）
 * 3. 支持自定义初始化参数
 * 4. 提供 reset 能力（测试间隔离）
 *
 * @module tests/lib/engine-factory
 */

import { ThreeKingdomsEngine } from '../../engine/ThreeKingdomsEngine';

/** Engine 工厂配置 */
export interface EngineFactoryOptions {
  /** 是否调用 engine.init()，默认 true */
  autoInit?: boolean;
  /** 是否在测试间复用实例，默认 true（性能优化） */
  reuseAcrossTests?: boolean;
}

/**
 * Engine 测试工厂类
 *
 * 提供三种创建模式：
 * - create()      — 创建或复用已初始化的实例（默认模式，适合契约测试）
 * - createFresh() — 每次创建全新实例（适合需要干净状态的测试）
 * - resetCache()  — 清除缓存并重置实例（用于 afterEach 全局清理）
 */
export class EngineFactory {
  private static cachedEngine: ThreeKingdomsEngine | null = null;

  /** 创建或复用一个已初始化的真实 Engine 实例 */
  static create(options?: EngineFactoryOptions): ThreeKingdomsEngine {
    const { autoInit = true, reuseAcrossTests = true } = options ?? {};

    if (reuseAcrossTests && EngineFactory.cachedEngine) {
      return EngineFactory.cachedEngine;
    }

    const engine = new ThreeKingdomsEngine();
    if (autoInit) {
      engine.init();
    }

    if (reuseAcrossTests) {
      EngineFactory.cachedEngine = engine;
    }

    return engine;
  }

  /** 重置缓存的实例（用于测试隔离） */
  static resetCache(): void {
    if (EngineFactory.cachedEngine) {
      EngineFactory.cachedEngine.reset();
    }
    EngineFactory.cachedEngine = null;
  }

  /** 创建一个全新的、不复用的 Engine 实例 */
  static createFresh(
    options?: Omit<EngineFactoryOptions, 'reuseAcrossTests'>,
  ): ThreeKingdomsEngine {
    const { autoInit = true } = options ?? {};
    const engine = new ThreeKingdomsEngine();
    if (autoInit) {
      engine.init();
    }
    return engine;
  }
}
