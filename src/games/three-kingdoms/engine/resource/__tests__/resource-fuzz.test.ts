/**
 * 资源系统 — 模糊测试（Fuzz Testing）
 *
 * 使用 seeded PRNG 生成随机操作序列，验证资源系统在各种随机输入下的稳定性。
 * 所有测试用例均可通过固定 seed 值重现。
 *
 * @module engine/resource/__tests__/resource-fuzz
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ResourceSystem } from '../ResourceSystem';
import type { ResourceType } from '../../shared/types';
import { RESOURCE_TYPES } from '../resource.types';
import { INITIAL_RESOURCES, INITIAL_CAPS, MIN_GRAIN_RESERVE } from '../resource-config';

// ─────────────────────────────────────────────
// Seeded PRNG (Park-Miller)
// ─────────────────────────────────────────────

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 从数组中随机选取一个元素 */
function pickRandom<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** 生成 [min, max] 范围内的随机整数 */
function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** 生成 [min, max] 范围内的随机浮点数 */
function randFloat(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps() {
  return {
    eventBus: {
      on: vi.fn(), once: vi.fn(), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn(() => false) },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(() => false), unregister: vi.fn() },
  };
}

/** 检查数值是否为有效有限数 */
function isValidNumber(v: number): boolean {
  return Number.isFinite(v) && !Number.isNaN(v);
}

/** 检查所有资源值均为有效非负有限数 */
function allResourcesValid(rs: ResourceSystem): boolean {
  const resources = rs.getResources();
  for (const type of RESOURCE_TYPES) {
    const val = resources[type];
    if (!isValidNumber(val) || val < 0) return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('ResourceSystem Fuzz Testing', () => {
  let rs: ResourceSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    rs = new ResourceSystem();
    rs.init(createMockDeps());
  });

  // ── 1. 随机添加/消耗资源100次后总量非负 ──

  it('随机添加/消耗资源100次后所有资源值非负', () => {
    const rng = seededRandom(42);
    const ITERATIONS = 100;

    for (let i = 0; i < ITERATIONS; i++) {
      const type = pickRandom(rng, RESOURCE_TYPES);
      const isAdd = rng() > 0.4; // 60% 添加, 40% 消耗

      if (isAdd) {
        const amount = randFloat(rng, 0.01, 1000);
        rs.addResource(type, amount);
      } else {
        const amount = randFloat(rng, 0.01, 500);
        try {
          rs.consumeResource(type, amount);
        } catch {
          // 资源不足时忽略
        }
      }
    }

    const resources = rs.getResources();
    for (const type of RESOURCE_TYPES) {
      expect(resources[type]).toBeGreaterThanOrEqual(0);
      expect(isValidNumber(resources[type])).toBe(true);
    }
  });

  // ── 2. 随机升级建筑10次后资源正确 ──

  it('随机设置资源上限10次后资源值受约束', () => {
    const rng = seededRandom(123);

    // 先添加大量资源
    for (const type of RESOURCE_TYPES) {
      rs.addResource(type, 100000);
    }

    // 随机设置上限10次
    for (let i = 0; i < 10; i++) {
      const type = pickRandom(rng, RESOURCE_TYPES);
      const capValue = randInt(rng, 100, 50000);
      rs.setCap(type, capValue);
    }

    // 验证：有上限的资源不超过上限
    const resources = rs.getResources();
    const caps = rs.getCaps();
    for (const type of RESOURCE_TYPES) {
      expect(resources[type]).toBeGreaterThanOrEqual(0);
      if (caps[type] !== null) {
        expect(resources[type]).toBeLessThanOrEqual(caps[type]!);
      }
      expect(isValidNumber(resources[type])).toBe(true);
    }
  });

  // ── 3. 随机购买商品（批量消耗）20次后金币正确 ──

  it('随机批量消耗20次后资源保持一致', () => {
    const rng = seededRandom(456);

    // 先添加大量资源
    for (const type of RESOURCE_TYPES) {
      rs.addResource(type, 100000);
    }

    const initialGold = rs.getAmount('gold');

    for (let i = 0; i < 20; i++) {
      // 随机生成一个消耗项
      const cost: Record<string, number> = {};
      const numTypes = randInt(rng, 1, 3);
      for (let j = 0; j < numTypes; j++) {
        const type = pickRandom(rng, RESOURCE_TYPES);
        cost[type] = randFloat(rng, 10, 1000);
      }
      try {
        rs.consumeBatch(cost);
      } catch {
        // 资源不足时忽略
      }
    }

    // 验证所有资源非负且有效
    const resources = rs.getResources();
    for (const type of RESOURCE_TYPES) {
      expect(resources[type]).toBeGreaterThanOrEqual(0);
      expect(isValidNumber(resources[type])).toBe(true);
    }
    // 金币应 <= 初始金币（因为只消耗不添加）
    expect(rs.getAmount('gold')).toBeLessThanOrEqual(initialGold);
  });

  // ── 4. 随机招募武将（模拟资源消耗）5次后资源正确 ──

  it('随机资源消耗5次后canAfford结果与实际一致', () => {
    const rng = seededRandom(789);

    // 给一些初始资源
    for (const type of RESOURCE_TYPES) {
      rs.addResource(type, 5000);
    }

    for (let i = 0; i < 5; i++) {
      const cost: Record<string, number> = {};
      cost.grain = randFloat(rng, 100, 3000);
      cost.gold = randFloat(rng, 100, 3000);
      cost.recruitToken = randFloat(rng, 1, 50);

      const check = rs.canAfford(cost);
      if (check.canAfford) {
        // canAfford 为 true 时，consumeBatch 应成功
        expect(() => rs.consumeBatch(cost)).not.toThrow();
      } else {
        // canAfford 为 false 时，consumeBatch 应抛出异常
        expect(() => rs.consumeBatch(cost)).toThrow();
      }
    }

    // 最终所有资源仍非负
    expect(allResourcesValid(rs)).toBe(true);
  });

  // ── 5. 混合随机操作200次后无NaN/Infinity ──

  it('混合随机操作200次后无NaN/Infinity', () => {
    const rng = seededRandom(101112);

    for (let i = 0; i < 200; i++) {
      const op = randInt(rng, 0, 7);

      switch (op) {
        case 0: { // addResource
          const type = pickRandom(rng, RESOURCE_TYPES);
          const amount = randFloat(rng, 0.01, 10000);
          rs.addResource(type, amount);
          break;
        }
        case 1: { // consumeResource
          const type = pickRandom(rng, RESOURCE_TYPES);
          const amount = randFloat(rng, 0.01, 5000);
          try { rs.consumeResource(type, amount); } catch { /* ignore */ }
          break;
        }
        case 2: { // setResource
          const type = pickRandom(rng, RESOURCE_TYPES);
          const amount = randFloat(rng, 0, 100000);
          rs.setResource(type, amount);
          break;
        }
        case 3: { // setProductionRate
          const type = pickRandom(rng, RESOURCE_TYPES);
          const rate = randFloat(rng, 0, 100);
          rs.setProductionRate(type, rate);
          break;
        }
        case 4: { // tick
          const deltaMs = randFloat(rng, 1, 10000);
          rs.tick(deltaMs);
          break;
        }
        case 5: { // setCap
          const type = pickRandom(rng, RESOURCE_TYPES);
          const cap = rng() > 0.3 ? randInt(rng, 100, 500000) : null;
          rs.setCap(type, cap);
          break;
        }
        case 6: { // consumeBatch
          const cost: Record<string, number> = {};
          cost.grain = randFloat(rng, 10, 1000);
          cost.gold = randFloat(rng, 10, 1000);
          try { rs.consumeBatch(cost); } catch { /* ignore */ }
          break;
        }
        case 7: { // recalculateProduction
          const prods: Record<string, number> = {};
          for (let j = 0; j < 3; j++) {
            const type = pickRandom(rng, RESOURCE_TYPES);
            prods[type] = randFloat(rng, 0, 50);
          }
          rs.recalculateProduction(prods);
          break;
        }
      }
    }

    // 最终验证：所有资源值有效
    const resources = rs.getResources();
    for (const type of RESOURCE_TYPES) {
      expect(isValidNumber(resources[type])).toBe(true);
      expect(resources[type]).toBeGreaterThanOrEqual(0);
    }

    // 产出速率也有效
    const rates = rs.getProductionRates();
    for (const type of RESOURCE_TYPES) {
      expect(isValidNumber(rates[type])).toBe(true);
    }
  });

  // ── 6. 随机序列化/反序列化10次后数据一致 ──

  it('随机操作后序列化再反序列化数据一致', () => {
    const rng = seededRandom(20240101);

    // 先做随机操作
    for (let i = 0; i < 30; i++) {
      const type = pickRandom(rng, RESOURCE_TYPES);
      const amount = randFloat(rng, 1, 5000);
      rs.addResource(type, amount);
    }

    // 序列化
    const saved = rs.serialize();

    // 创建新实例并反序列化
    const rs2 = new ResourceSystem();
    rs2.init(createMockDeps());
    rs2.deserialize(saved);

    // 验证数据一致
    const original = rs.getResources();
    const restored = rs2.getResources();
    for (const type of RESOURCE_TYPES) {
      expect(restored[type]).toBe(original[type]);
    }
  });

  // ── 7. 随机极端值添加资源不产生NaN ──

  it('随机极端值（极大/极小/0）添加资源后无NaN', () => {
    const rng = seededRandom(7777);
    const extremeValues = [
      0, 0.001, 1e-10, 1e10, 1e15, 999999999,
    ];

    for (const val of extremeValues) {
      const type = pickRandom(rng, RESOURCE_TYPES);
      rs.addResource(type, val);
    }

    expect(allResourcesValid(rs)).toBe(true);
  });

  // ── 8. 随机tick间隔模拟产出一致性 ──

  it('随机tick间隔累计产出与理论值误差在合理范围', () => {
    const rng = seededRandom(5555);

    // 设置固定产出速率
    rs.setProductionRate('grain', 10); // 10/秒
    rs.setCap('grain', null); // 移除上限

    const initialGrain = rs.getAmount('grain');
    let totalDeltaSec = 0;

    for (let i = 0; i < 50; i++) {
      const deltaMs = randFloat(rng, 100, 5000);
      rs.tick(deltaMs);
      totalDeltaSec += deltaMs / 1000;
    }

    const expectedGain = 10 * totalDeltaSec;
    const actualGain = rs.getAmount('grain') - initialGrain;

    // 允许浮点误差 0.01
    expect(Math.abs(actualGain - expectedGain)).toBeLessThan(0.01);
  });

  // ── 9. 随机资源类型操作后canAfford一致性 ──

  it('随机操作后canAfford与实际消耗结果一致', () => {
    const rng = seededRandom(33333);

    // 给充足资源
    for (const type of RESOURCE_TYPES) {
      rs.addResource(type, 10000);
    }

    for (let i = 0; i < 50; i++) {
      const cost: Record<string, number> = {};
      const numItems = randInt(rng, 1, 4);
      for (let j = 0; j < numItems; j++) {
        const type = pickRandom(rng, RESOURCE_TYPES);
        cost[type] = randFloat(rng, 1, 5000);
      }

      const check = rs.canAfford(cost);
      if (check.canAfford) {
        const before = rs.getResources();
        rs.consumeBatch(cost);
        const after = rs.getResources();
        // 验证消耗正确
        for (const type of RESOURCE_TYPES) {
          const expected = before[type] - (cost[type] ?? 0);
          expect(after[type]).toBeCloseTo(expected, 5);
        }
      }
    }
  });

  // ── 10. 多seed回归测试 ──

  it('多个不同seed下100次随机操作后资源始终非负且有效', () => {
    const seeds = [111, 222, 333, 444, 555];

    for (const seed of seeds) {
      const rng = seededRandom(seed);
      const localRs = new ResourceSystem();
      localRs.init(createMockDeps());

      for (let i = 0; i < 100; i++) {
        const type = pickRandom(rng, RESOURCE_TYPES);
        const op = rng();

        if (op < 0.5) {
          localRs.addResource(type, randFloat(rng, 1, 1000));
        } else {
          try {
            localRs.consumeResource(type, randFloat(rng, 1, 500));
          } catch {
            // 资源不足时忽略
          }
        }
      }

      const resources = localRs.getResources();
      for (const t of RESOURCE_TYPES) {
        expect(isValidNumber(resources[t])).toBe(true);
        expect(resources[t]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
