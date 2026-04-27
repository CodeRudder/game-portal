/**
 * Vitest 测试增强工具
 *
 * 基于 test.extend 提供自定义 fixture：
 * - realEngine  : 真实初始化的 Engine 实例（测试间共享，适合契约测试）
 * - cleanEngine : 每次测试独立的全新 Engine 实例（适合状态敏感测试）
 *
 * 用法：
 * ```ts
 * import { contractTest } from './lib';
 *
 * contractTest('getter 应返回非 null', ({ realEngine }) => {
 *   expect(realEngine.getHeroSystem()).toBeTruthy();
 * });
 * ```
 *
 * @module tests/lib/vitest-helpers
 */

import { test as base } from 'vitest';
import type { ThreeKingdomsEngine } from '../../engine/ThreeKingdomsEngine';
import { EngineFactory } from './engine-factory';

// ─────────────────────────────────────────────
// Fixture 类型定义
// ─────────────────────────────────────────────

/** Engine 相关 fixture 接口 */
interface EngineFixture {
  /** 共享的真实 Engine（测试间复用，性能优化） */
  realEngine: ThreeKingdomsEngine;
  /** 独立的真实 Engine（每次测试创建新实例） */
  cleanEngine: ThreeKingdomsEngine;
}

// ─────────────────────────────────────────────
// contractTest — 契约测试专用
// 使用真实 Engine，测试间共享实例
// ─────────────────────────────────────────────

/**
 * 契约测试 fixture
 *
 * - realEngine : 全局缓存，所有测试共享同一个实例
 * - cleanEngine: 每次测试独立创建新实例，测试结束自动清理
 */
export const contractTest = base.extend<EngineFixture>({
  realEngine: async ({}, use) => {
    const engine = EngineFactory.create({
      autoInit: true,
      reuseAcrossTests: true,
    });
    await use(engine);
  },
  cleanEngine: async ({}, use) => {
    const engine = EngineFactory.createFresh({ autoInit: true });
    await use(engine);
    // cleanEngine 不影响缓存，仅清理自身
  },
});

// ─────────────────────────────────────────────
// integrationTest — 集成测试专用
// 使用真实 Engine + 真实组件
// ─────────────────────────────────────────────

/** 集成测试 fixture 扩展类型 */
interface IntegrationFixture extends EngineFixture {
  /** 渲染容器（配合 @testing-library/react 使用） */
  container: HTMLElement;
}

/**
 * 集成测试 fixture
 *
 * - cleanEngine: 每次测试独立创建
 * - realEngine  : 全局共享
 * - container   : DOM 容器，用于 React 组件渲染
 */
export const integrationTest = base.extend<IntegrationFixture>({
  cleanEngine: async ({}, use) => {
    const engine = EngineFactory.createFresh({ autoInit: true });
    await use(engine);
  },
  realEngine: async ({}, use) => {
    const engine = EngineFactory.create({
      autoInit: true,
      reuseAcrossTests: true,
    });
    await use(engine);
  },
  container: async ({}, use) => {
    const div = document.createElement('div');
    div.id = 'test-container';
    document.body.appendChild(div);
    await use(div);
    div.remove();
  },
});
