/**
 * campaign-utils 单元测试
 *
 * 覆盖共享工具函数：
 * - mergeResources：资源合并
 * - mergeFragments：碎片合并
 */

import { describe, it, expect } from 'vitest';
import { mergeResources, mergeFragments } from '../campaign-utils';

// ─────────────────────────────────────────────
// 1. mergeResources
// ─────────────────────────────────────────────

describe('campaign-utils mergeResources', () => {
  it('合并正数值到空目标', () => {
    const target: Partial<Record<string, number>> = {};
    mergeResources(target, { grain: 100, gold: 50 });
    expect(target.grain).toBe(100);
    expect(target.gold).toBe(50);
  });

  it('累加到已有值', () => {
    const target: Partial<Record<string, number>> = { grain: 50 };
    mergeResources(target, { grain: 100 });
    expect(target.grain).toBe(150);
  });

  it('忽略零值', () => {
    const target: Partial<Record<string, number>> = { grain: 50 };
    mergeResources(target, { grain: 0 });
    expect(target.grain).toBe(50);
  });

  it('忽略负值', () => {
    const target: Partial<Record<string, number>> = { grain: 50 };
    mergeResources(target, { grain: -10 });
    expect(target.grain).toBe(50);
  });

  it('忽略 undefined 值', () => {
    const target: Partial<Record<string, number>> = {};
    mergeResources(target, { grain: undefined });
    expect(target.grain).toBeUndefined();
  });

  it('合并多个资源类型', () => {
    const target: Partial<Record<string, number>> = { grain: 10 };
    mergeResources(target, { grain: 20, gold: 30, troops: 40 });
    expect(target.grain).toBe(30);
    expect(target.gold).toBe(30);
    expect(target.troops).toBe(40);
  });

  it('空 source 不影响 target', () => {
    const target: Partial<Record<string, number>> = { grain: 100 };
    mergeResources(target, {});
    expect(target).toEqual({ grain: 100 });
  });

  it('多次合并累加', () => {
    const target: Partial<Record<string, number>> = {};
    mergeResources(target, { grain: 10 });
    mergeResources(target, { grain: 20 });
    mergeResources(target, { grain: 30 });
    expect(target.grain).toBe(60);
  });
});

// ─────────────────────────────────────────────
// 2. mergeFragments
// ─────────────────────────────────────────────

describe('campaign-utils mergeFragments', () => {
  it('合并正数值到空目标', () => {
    const target: Record<string, number> = {};
    mergeFragments(target, { guanyu: 5, zhangfei: 3 });
    expect(target.guanyu).toBe(5);
    expect(target.zhangfei).toBe(3);
  });

  it('累加到已有值', () => {
    const target: Record<string, number> = { guanyu: 2 };
    mergeFragments(target, { guanyu: 3 });
    expect(target.guanyu).toBe(5);
  });

  it('忽略零值', () => {
    const target: Record<string, number> = { guanyu: 5 };
    mergeFragments(target, { guanyu: 0 });
    expect(target.guanyu).toBe(5);
  });

  it('忽略负值', () => {
    const target: Record<string, number> = { guanyu: 5 };
    mergeFragments(target, { guanyu: -3 });
    expect(target.guanyu).toBe(5);
  });

  it('合并多个武将碎片', () => {
    const target: Record<string, number> = {};
    mergeFragments(target, { guanyu: 1, zhangfei: 2, liubei: 3 });
    expect(Object.keys(target)).toHaveLength(3);
    expect(target.liubei).toBe(3);
  });

  it('空 source 不影响 target', () => {
    const target: Record<string, number> = { guanyu: 5 };
    mergeFragments(target, {});
    expect(target).toEqual({ guanyu: 5 });
  });
});
