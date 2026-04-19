/**
 * 测试基础设施 — 游戏测试运行器
 *
 * 按架构文档 §6.2 实现，提供结构化的测试用例注册、执行和报告功能。
 * 支持 category 和 tags 过滤、setup/teardown 生命周期、超时控制。
 *
 * 核心职责：
 * - 注册测试用例（registerCase）
 * - 按条件过滤并批量执行（run）
 * - 执行单个测试用例（runSingle）
 * - 生成测试报告（report）
 *
 * @module tests/utils/GameTestRunner
 */

import type { IGameLogic, HeroData, ArmyData, CityData } from '../types';
import { MockGameLogic } from './MockGameLogic';
import { TestDataProvider } from './TestDataProvider';
import { resetCounters } from './TestDataProvider';

// ─────────────────────────────────────────────
// 接口定义
// ─────────────────────────────────────────────

/** 测试用例分类 */
export type TestCaseCategory = 'core' | 'system' | 'ui' | 'e2e';

/** 测试用例状态 */
export type TestCaseStatus = 'passed' | 'failed' | 'skipped' | 'error';

/**
 * 测试用例定义
 *
 * 描述一个可执行的测试用例，包含名称、分类、标签、
 * 生命周期钩子（setup / execute / teardown）和超时配置。
 */
export interface GameTestCase {
  /** 测试用例名称（应唯一） */
  name: string;
  /** 测试分类 */
  category: TestCaseCategory;
  /** 标签列表（用于过滤） */
  tags?: string[];
  /** 超时时间（毫秒），默认 5000 */
  timeout?: number;
  /** 初始化钩子 */
  setup?: (ctx: GameTestContext) => Promise<void>;
  /** 测试执行逻辑 */
  execute: (ctx: GameTestContext) => Promise<void>;
  /** 清理钩子 */
  teardown?: (ctx: GameTestContext) => Promise<void>;
}

/**
 * 测试上下文
 *
 * 在 setup / execute / teardown 生命周期中共享的对象集合。
 * 每个测试用例获得独立的上下文实例。
 */
export interface GameTestContext {
  /** Mock 游戏逻辑实例 */
  mockLogic: IGameLogic;
  /** 测试数据工厂 */
  data: typeof TestDataProvider;
}

/**
 * 单个测试用例的执行结果
 */
export interface GameTestResult {
  /** 测试用例名称 */
  name: string;
  /** 执行状态 */
  status: TestCaseStatus;
  /** 执行时长（毫秒） */
  duration: number;
  /** 错误信息（仅在 failed / error 状态时有值） */
  error?: Error;
}

/**
 * 测试报告
 *
 * 汇总所有测试用例的执行结果，提供统计信息。
 */
export interface TestReport {
  /** 报告生成时间（ISO 格式） */
  timestamp: string;
  /** 总用例数 */
  total: number;
  /** 通过数 */
  passed: number;
  /** 失败数 */
  failed: number;
  /** 跳过数 */
  skipped: number;
  /** 总执行时长（毫秒） */
  duration: number;
  /** 各用例执行结果 */
  results: GameTestResult[];
}

/** 测试用例过滤条件 */
export interface TestFilter {
  /** 按分类过滤 */
  category?: TestCaseCategory;
  /** 按标签过滤（匹配任一标签即通过） */
  tags?: string[];
}

// ─────────────────────────────────────────────
// GameTestRunner 类
// ─────────────────────────────────────────────

/**
 * 游戏测试运行器
 *
 * 管理测试用例的注册、执行和报告生成。
 * 设计为与 Vitest 配合使用：在 describe/it 块中调用 run/runSingle。
 *
 * @example
 * ```ts
 * import { describe, it, expect, beforeEach } from 'vitest';
 * import { GameTestRunner } from './GameTestRunner';
 *
 * describe('HeroSystem', () => {
 *   const runner = new GameTestRunner();
 *
 *   runner.registerCase({
 *     name: 'recruit hero',
 *     category: 'system',
 *     tags: ['hero', 'recruit'],
 *     execute: async (ctx) => {
 *       const result = ctx.mockLogic.recruitHero('hero-0', 'city-0');
 *       expect(result).toBe(true);
 *     },
 *   });
 *
 *   it('runs all hero tests', async () => {
 *     const results = await runner.run({ tags: ['hero'] });
 *     expect(results.every(r => r.status === 'passed')).toBe(true);
 *   });
 * });
 * ```
 */
export class GameTestRunner {
  /** 已注册的测试用例 */
  private cases: Map<string, GameTestCase>;

  /** 历史执行结果（用于 report） */
  private lastResults: GameTestResult[];

  /** 上次执行的总时长 */
  private lastDuration: number;

  constructor() {
    this.cases = new Map();
    this.lastResults = [];
    this.lastDuration = 0;
  }

  // ─────────────────────────────────────────
  // 注册
  // ─────────────────────────────────────────

  /**
   * 注册测试用例
   *
   * @param tc - 测试用例定义
   * @throws {Error} 当用例名称已存在时
   */
  registerCase(tc: GameTestCase): void {
    if (this.cases.has(tc.name)) {
      throw new Error(`测试用例 "${tc.name}" 已注册，名称必须唯一`);
    }
    this.cases.set(tc.name, tc);
  }

  /**
   * 批量注册测试用例
   *
   * @param cases - 测试用例数组
   */
  registerCases(cases: GameTestCase[]): void {
    for (const tc of cases) {
      this.registerCase(tc);
    }
  }

  /**
   * 获取已注册的用例数量
   */
  get caseCount(): number {
    return this.cases.size;
  }

  // ─────────────────────────────────────────
  // 执行
  // ─────────────────────────────────────────

  /**
   * 创建独立的测试上下文
   *
   * 每个测试用例获得独立的 MockGameLogic 实例和 TestDataProvider，
   * 确保用例之间互不干扰。
   */
  private createContext(): GameTestContext {
    resetCounters();
    return {
      mockLogic: new MockGameLogic(),
      data: TestDataProvider,
    };
  }

  /**
   * 执行单个测试用例
   *
   * 完整执行 setup → execute → teardown 生命周期，
   * 捕获各阶段异常并记录结果。
   *
   * @param name - 测试用例名称
   * @returns 执行结果
   */
  async runSingle(name: string): Promise<GameTestResult> {
    const tc = this.cases.get(name);
    if (!tc) {
      return {
        name,
        status: 'error',
        duration: 0,
        error: new Error(`测试用例 "${name}" 未注册`),
      };
    }

    const ctx = this.createContext();
    const timeout = tc.timeout ?? 5000;
    const start = performance.now();

    try {
      // setup 阶段
      if (tc.setup) {
        await this.withTimeout(tc.setup(ctx), timeout, `${name}: setup`);
      }

      // execute 阶段
      await this.withTimeout(tc.execute(ctx), timeout, `${name}: execute`);

      const duration = performance.now() - start;
      return { name, status: 'passed', duration };
    } catch (err) {
      const duration = performance.now() - start;
      const error = err instanceof Error ? err : new Error(String(err));

      // 区分超时错误和其他错误
      const status: TestCaseStatus = error.message.includes('超时')
        ? 'error'
        : 'failed';

      return { name, status, duration, error };
    } finally {
      // teardown 阶段（即使前面出错也要执行）
      if (tc.teardown) {
        try {
          await tc.teardown(ctx);
        } catch {
          // teardown 错误不覆盖主结果
        }
      }
    }
  }

  /**
   * 批量执行测试用例
   *
   * 按过滤条件筛选已注册的用例，逐一执行并收集结果。
   *
   * @param filter - 过滤条件（可选）
   * @returns 所有匹配用例的执行结果
   */
  async run(filter?: TestFilter): Promise<GameTestResult[]> {
    const matchedCases = this.getFilteredCases(filter);
    const results: GameTestResult[] = [];
    const start = performance.now();

    for (const tc of matchedCases) {
      const result = await this.runSingle(tc.name);
      results.push(result);
    }

    this.lastResults = results;
    this.lastDuration = performance.now() - start;

    return results;
  }

  /**
   * 按过滤条件筛选测试用例
   */
  private getFilteredCases(filter?: TestFilter): GameTestCase[] {
    const allCases = Array.from(this.cases.values());

    if (!filter) return allCases;

    return allCases.filter((tc) => {
      // 分类过滤
      if (filter.category && tc.category !== filter.category) {
        return false;
      }

      // 标签过滤（匹配任一标签即通过）
      if (filter.tags && filter.tags.length > 0) {
        const tcTags = tc.tags ?? [];
        const hasMatch = filter.tags.some((tag) => tcTags.includes(tag));
        if (!hasMatch) return false;
      }

      return true;
    });
  }

  // ─────────────────────────────────────────
  // 超时控制
  // ─────────────────────────────────────────

  /**
   * 为 Promise 添加超时限制
   *
   * @param promise - 待执行的 Promise
   * @param ms - 超时时间（毫秒）
   * @param label - 超时错误描述
   */
  private withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${label} 超时 (${ms}ms)`)),
        ms,
      );
      promise.then(
        (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  // ─────────────────────────────────────────
  // 报告
  // ─────────────────────────────────────────

  /**
   * 生成测试报告
   *
   * 基于最近一次 run() 的执行结果生成汇总报告。
   *
   * @returns 测试报告（如果尚未执行过，返回空报告）
   */
  report(): TestReport {
    const results = this.lastResults;
    const passed = results.filter((r) => r.status === 'passed').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;

    return {
      timestamp: new Date().toISOString(),
      total: results.length,
      passed,
      failed,
      skipped,
      duration: this.lastDuration,
      results,
    };
  }

  /**
   * 清除所有已注册的用例和执行结果
   */
  clear(): void {
    this.cases.clear();
    this.lastResults = [];
    this.lastDuration = 0;
  }
}
