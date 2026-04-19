/**
 * 测试基础设施 — 统一导出
 *
 * 从此文件导入所有测试工具类和类型，无需关心内部文件组织。
 *
 * @example
 * ```ts
 * import {
 *   GameTestRunner,
 *   MockGameLogic,
 *   TestDataProvider,
 *   resetCounters,
 * } from '../utils';
 *
 * import {
 *   mockHeroes,
 *   mockResources,
 *   threeKingdomsSetup,
 * } from '../fixtures';
 * ```
 *
 * @module tests/utils
 */

// GameTestRunner
export {
  GameTestRunner,
} from './GameTestRunner';

export type {
  GameTestCase,
  GameTestContext,
  GameTestResult,
  TestReport,
  TestFilter,
  TestCaseCategory,
  TestCaseStatus,
} from './GameTestRunner';

// MockGameLogic
export {
  MockGameLogic,
} from './MockGameLogic';

// TestDataProvider
export {
  TestDataProvider,
  resetCounters,
} from './TestDataProvider';
