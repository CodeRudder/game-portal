/**
 * 测试基础设施统一导出
 *
 * 提供引擎契约测试所需的所有工具：
 * - EngineFactory   : 真实 Engine 实例的创建与缓存
 * - 契约常量        : getter / 依赖 / registry key / tab 映射
 * - 测试 fixture    : contractTest / integrationTest
 *
 * @module tests/lib
 */

export { EngineFactory } from './engine-factory';
export type { EngineFactoryOptions } from './engine-factory';

export {
  ENGINE_GETTER_CONTRACT,
  ENGINE_DEPENDENCY_CONTRACT,
  REGISTRY_KEY_CONTRACT,
  TAB_ID_CONTRACT,
} from './engine-contract';

export { contractTest, integrationTest } from './vitest-helpers';
