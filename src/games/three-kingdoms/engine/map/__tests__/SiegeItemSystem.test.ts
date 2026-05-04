/**
 * R14 Task4: 内应信掉落概率统计收紧测试
 *
 * 验证 shouldDropInsiderLetter 的掉落概率:
 * - 理论概率 20% (hashCode % 100 < 20)
 * - 使用二项分布 95% CI 确定合理的观测范围
 * - 500次模拟: μ=100, σ≈8.94, ±2σ → [82, 118]
 *
 * @module engine/map/__tests__/SiegeItemSystem.test
 */

import { describe, it, expect } from 'vitest';
import {
  SiegeItemSystem,
  hashCode,
  shouldDropInsiderLetter,
} from '../SiegeItemSystem';

// ─────────────────────────────────────────────
// R14 Task4: 掉落概率统计收紧测试
// ─────────────────────────────────────────────

describe('R14 Task4: shouldDropInsiderLetter 掉落概率 — 500次模拟二项分布95%CI', () => {
  it('500次模拟掉落数在82~118之间 (±2σ, p=0.20)', () => {
    const N = 500;
    const p = 0.20; // 理论掉落概率
    const mu = N * p;               // 期望值 = 100
    const sigma = Math.sqrt(N * p * (1 - p)); // ≈ 8.94

    let dropped = 0;
    for (let i = 1; i <= N; i++) {
      if (shouldDropInsiderLetter(`r14-sim-${i}`)) {
        dropped++;
      }
    }

    // 二项分布 95% CI: μ ± 2σ
    const lower = Math.floor(mu - 2 * sigma); // ≈ 82
    const upper = Math.ceil(mu + 2 * sigma);  // ≈ 118

    expect(dropped).toBeGreaterThanOrEqual(lower);
    expect(dropped).toBeLessThanOrEqual(upper);
  });

  it('确定性hash: 相同taskId总是返回相同掉落结果', () => {
    const taskId = 'r14-deterministic-test';
    const results = Array.from({ length: 50 }, () => shouldDropInsiderLetter(taskId));
    const allSame = results.every(r => r === results[0]);
    expect(allSame).toBe(true);
  });

  it('hashCode稳定且非负', () => {
    for (let i = 0; i < 100; i++) {
      const h = hashCode(`test-string-${i}`);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(0x7fffffff);
      // 二次调用相同
      expect(hashCode(`test-string-${i}`)).toBe(h);
    }
  });
});

// ─────────────────────────────────────────────
// SiegeItemSystem 基本功能回归测试
// ─────────────────────────────────────────────

describe('R14 Task4: SiegeItemSystem 回归测试', () => {
  it('acquire + consume 基本流程', () => {
    const sys = new SiegeItemSystem();
    expect(sys.acquireItem('nightRaid', 'shop')).toBe(true);
    expect(sys.getCount('nightRaid')).toBe(1);
    expect(sys.consumeItem('nightRaid')).toBe(true);
    expect(sys.getCount('nightRaid')).toBe(0);
  });

  it('堆叠上限', () => {
    const sys = new SiegeItemSystem();
    for (let i = 0; i < 10; i++) {
      expect(sys.acquireItem('nightRaid', 'daily')).toBe(true);
    }
    expect(sys.acquireItem('nightRaid', 'daily')).toBe(false);
    expect(sys.getCount('nightRaid')).toBe(10);
  });

  it('reset清空', () => {
    const sys = new SiegeItemSystem();
    sys.acquireItem('insiderLetter', 'drop');
    sys.acquireItem('siegeManual', 'shop');
    sys.reset();
    expect(sys.getCount('insiderLetter')).toBe(0);
    expect(sys.getCount('siegeManual')).toBe(0);
  });
});
