/**
 * 共享 mockDeps 工厂函数
 *
 * 解决 R17 苏格拉底评测发现的问题3：
 * ~60% 单元测试每个文件独立定义 mockDeps + `as unknown as ISystemDeps`，
 * 接口变化时需逐一修改所有文件。
 *
 * 使用方法：
 * ```ts
 * import { createMockDeps } from '../../test-utils/createMockDeps';
 *
 * // 默认 mock（满足 ISystemDeps 接口）
 * const deps = createMockDeps();
 *
 * // 覆盖部分字段
 * const deps = createMockDeps({
 *   eventBus: { ...realEventBus },
 * });
 *
 * // 覆盖 config.get 的返回值
 * const deps = createMockDeps({
 *   config: { get: vi.fn().mockReturnValue(42), set: vi.fn(), has: vi.fn(), delete: vi.fn(), loadFromConstants: vi.fn(), getAll: vi.fn() },
 * });
 * ```
 *
 * @module test-utils/createMockDeps
 */

import { vi } from 'vitest';
import type { ISystemDeps } from '../core/types';

/**
 * 创建一个满足 ISystemDeps 接口的 mock 对象。
 *
 * 所有方法均为 vi.fn()，返回合理的默认值：
 * - eventBus.on / once 返回 unsubscribe 函数
 * - eventBus.emit / off / removeAllListeners 为空操作
 * - config.get 返回 undefined
 * - registry.get 返回空对象
 * - registry.getAll 返回空 Map
 * - registry.has 返回 false
 *
 * @param overrides - 部分覆盖 mock 的字段，深度合并到默认值上
 * @returns 满足 ISystemDeps 接口的 mock 对象
 */
export function createMockDeps(overrides?: Partial<ISystemDeps>): ISystemDeps {
  const defaultDeps: ISystemDeps = {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: {
      get: vi.fn().mockReturnValue(undefined),
      set: vi.fn(),
      has: vi.fn().mockReturnValue(false),
      delete: vi.fn(),
      loadFromConstants: vi.fn(),
      getAll: vi.fn().mockReturnValue({}),
    },
    registry: {
      register: vi.fn(),
      get: vi.fn().mockReturnValue({}),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn().mockReturnValue(false),
      unregister: vi.fn(),
    },
  };

  if (!overrides) {
    return defaultDeps;
  }

  // 深度合并：允许覆盖嵌套字段而不丢失兄弟字段
  return {
    ...defaultDeps,
    ...overrides,
  } as ISystemDeps;
}
