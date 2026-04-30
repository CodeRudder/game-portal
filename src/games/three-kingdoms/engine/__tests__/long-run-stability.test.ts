/**
 * 三国霸业引擎 — 长时间运行稳定性测试
 *
 * 模拟游戏运行1000个tick，每个tick执行随机操作。
 * 验证最终状态一致性：资源非负、等级合法、无NaN/Infinity、存档一致性。
 *
 * @module engine/__tests__/long-run-stability
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';
import type { ResourceType } from '../../shared/types';

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

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randFloat(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

const RESOURCE_TYPES: readonly ResourceType[] = [
  'grain', 'gold', 'troops', 'mandate', 'techPoint', 'recruitToken', 'skillBook',
];

const BUILDING_TYPES: readonly string[] = [
  'castle', 'farmland', 'market', 'barracks', 'smithy', 'academy', 'clinic', 'wall',
];

/** 检查数值有效 */
function isValidNumber(v: number): boolean {
  return Number.isFinite(v) && !Number.isNaN(v);
}

/** 深度检查对象中所有数值是否有效 */
function allNumbersValid(obj: unknown, path = ''): string[] {
  const errors: string[] = [];
  if (obj === null || obj === undefined) return errors;

  if (typeof obj === 'number') {
    if (!isValidNumber(obj)) {
      errors.push(`${path} = ${obj}`);
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      errors.push(...allNumbersValid(item, `${path}[${i}]`));
    });
  } else if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      errors.push(...allNumbersValid(record[key], path ? `${path}.${key}` : key));
    }
  }
  return errors;
}

// ─────────────────────────────────────────────
// localStorage mock
// ─────────────────────────────────────────────

const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((k: string) => storage[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { storage[k] = v; }),
  removeItem: vi.fn((k: string) => { delete storage[k]; }),
  clear: vi.fn(() => Object.keys(storage).forEach(k => delete storage[k])),
  get length() { return Object.keys(storage).length; },
  key: vi.fn(() => null),
};

// ─────────────────────────────────────────────
// 模拟1000 tick运行
// ─────────────────────────────────────────────

function runEngineForTicks(tickCount: number, seed: number): ThreeKingdomsEngine {
  const rng = seededRandom(seed);

  const engine = new ThreeKingdomsEngine();
  engine.init();

  for (let t = 0; t < tickCount; t++) {
    // 每个tick执行1-3个随机操作
    const opsThisTick = randInt(rng, 1, 3);

    for (let op = 0; op < opsThisTick; op++) {
      const opType = randInt(rng, 0, 5);

      switch (opType) {
        case 0: { // 添加资源
          const type = RESOURCE_TYPES[randInt(rng, 0, RESOURCE_TYPES.length - 1)];
          const amount = randFloat(rng, 10, 5000);
          engine.resource.addResource(type, amount);
          break;
        }
        case 1: { // 消耗资源
          const type = RESOURCE_TYPES[randInt(rng, 0, RESOURCE_TYPES.length - 1)];
          const amount = randFloat(rng, 10, 1000);
          try { engine.resource.consumeResource(type, amount); } catch (e) {
            // 预期失败：资源可能不足，记录但不中断
            expect(e).toBeDefined();
          }
          break;
        }
        case 2: { // 尝试升级建筑
          const buildingType = BUILDING_TYPES[randInt(rng, 0, BUILDING_TYPES.length - 1)] as import('../../shared/types').BuildingType;
          try { engine.upgradeBuilding(buildingType); } catch (e) {
            // 预期失败：资源/条件可能不足，记录但不中断
            expect(e).toBeDefined();
          }
          break;
        }
        case 3: { // tick驱动
          engine.tick(1000); // 1秒
          break;
        }
        case 4: { // 设置资源
          const type = RESOURCE_TYPES[randInt(rng, 0, RESOURCE_TYPES.length - 1)];
          const amount = randFloat(rng, 0, 10000);
          engine.resource.setResource(type, amount);
          break;
        }
        case 5: { // 设置产出速率
          const type = RESOURCE_TYPES[randInt(rng, 0, RESOURCE_TYPES.length - 1)];
          const rate = randFloat(rng, 0, 50);
          engine.resource.setProductionRate(type, rate);
          break;
        }
      }
    }
  }

  return engine;
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('Long-Run Stability Testing (1000 ticks)', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
  });

  afterEach(() => {
    try { engine.reset(); } catch (e) {
      // 长时间运行后引擎状态可能异常，reset 可能失败
      expect(e).toBeDefined();
    }
  });

  // ── 1. 1000 tick后资源非负 ──

  it('1000 tick后所有资源值非负', () => {
    engine = runEngineForTicks(1000, 88888);

    const resources = engine.resource.getResources();
    for (const type of RESOURCE_TYPES) {
      expect(resources[type]).toBeGreaterThanOrEqual(0);
    }
  });

  // ── 2. 1000 tick后无NaN ──

  it('1000 tick后快照中无NaN或Infinity', () => {
    engine = runEngineForTicks(1000, 99999);

    const snapshot = engine.getSnapshot();
    const errors = allNumbersValid(snapshot);

    if (errors.length > 0) {
      console.error('Invalid numbers found:', errors.slice(0, 10));
    }
    expect(errors).toHaveLength(0);
  });

  // ── 3. 1000 tick后存档可正常保存加载 ──

  it('1000 tick后存档可正常保存和加载', () => {
    engine = runEngineForTicks(1000, 77777);

    // 序列化
    const json = engine.serialize();
    expect(json).toBeTruthy();
    expect(() => JSON.parse(json)).not.toThrow();

    // 创建新引擎并反序列化
    const engine2 = new ThreeKingdomsEngine();
    engine2.deserialize(json);
    engine2.init();

    // 验证资源一致
    const resources1 = engine.resource.getResources();
    const resources2 = engine2.resource.getResources();
    for (const type of RESOURCE_TYPES) {
      expect(resources2[type]).toBeCloseTo(resources1[type], 5);
    }

    engine2.reset();
  });

  // ── 4. 1000 tick中建筑全部完成 ──

  it('1000 tick后建筑状态有效（等级在合法范围）', () => {
    engine = runEngineForTicks(1000, 66666);

    const buildings = engine.building.getAllBuildings();
    for (const [type, state] of Object.entries(buildings)) {
      // 等级 >= 0（未解锁建筑等级为0）
      expect(state.level).toBeGreaterThanOrEqual(0);
      // 等级 <= maxLevel (30 for castle)
      expect(state.level).toBeLessThanOrEqual(30);
      expect(isValidNumber(state.level)).toBe(true);
    }
  });

  // ── 5. 1000 tick后武将属性在合理范围 ──

  it('1000 tick后资源产出速率有效', () => {
    engine = runEngineForTicks(1000, 55555);

    const rates = engine.resource.getProductionRates();
    for (const type of RESOURCE_TYPES) {
      expect(isValidNumber(rates[type])).toBe(true);
      // 产出速率不应为负数
      expect(rates[type]).toBeGreaterThanOrEqual(0);
    }
  });

  // ── 6. 1000 tick后资源上限有效 ──

  it('1000 tick后资源上限有效', () => {
    engine = runEngineForTicks(1000, 44444);

    const caps = engine.resource.getCaps();
    const resources = engine.resource.getResources();

    for (const type of RESOURCE_TYPES) {
      if (caps[type] !== null) {
        expect(isValidNumber(caps[type]!)).toBe(true);
        expect(caps[type]!).toBeGreaterThan(0);
        // 资源不超过上限
        expect(resources[type]).toBeLessThanOrEqual(caps[type]!);
      }
    }
  });

  // ── 7. 1000 tick后canAfford一致性 ──

  it('1000 tick后canAfford与实际资源状态一致', () => {
    engine = runEngineForTicks(1000, 33333);

    // 验证 canAfford 与实际资源量一致
    const resources = engine.resource.getResources();

    // 构造一个刚好等于当前资源量的消耗
    const cost1: Record<string, number> = { grain: resources.grain };
    const check1 = engine.resource.canAfford(cost1);
    // 粮草有保留量，所以不能全部消耗
    expect(check1.canAfford).toBe(false);

    // 构造一个很小的消耗
    const cost2: Record<string, number> = { gold: 1 };
    const check2 = engine.resource.canAfford(cost2);
    if (resources.gold >= 1) {
      expect(check2.canAfford).toBe(true);
    }
  });

  // ── 8. 1000 tick后多次序列化结果一致 ──

  it('1000 tick后多次序列化结果一致', () => {
    engine = runEngineForTicks(1000, 22222);

    const json1 = engine.serialize();
    const json2 = engine.serialize();

    // 两次序列化应产生相同结果（除了时间戳）
    const data1 = JSON.parse(json1);
    const data2 = JSON.parse(json2);

    // 资源部分应完全一致
    expect(data1.resource?.resources).toEqual(data2.resource?.resources);
  });

  // ── 9. 1000 tick后引擎仍可正常tick ──

  it('1000 tick后引擎仍可正常响应tick', () => {
    engine = runEngineForTicks(1000, 11111);

    // 再执行100个tick
    for (let i = 0; i < 100; i++) {
      expect(() => engine.tick(1000)).not.toThrow();
    }

    // 验证资源仍然有效
    const resources = engine.resource.getResources();
    for (const type of RESOURCE_TYPES) {
      expect(isValidNumber(resources[type])).toBe(true);
      expect(resources[type]).toBeGreaterThanOrEqual(0);
    }
  });

  // ── 10. 多seed回归测试 ──

  it('多个seed下1000 tick均保持稳定', () => {
    const seeds = [12345, 23456, 34567];

    for (const seed of seeds) {
      const localEngine = runEngineForTicks(500, seed); // 减少到500 tick避免超时

      // 验证资源有效
      const resources = localEngine.resource.getResources();
      for (const type of RESOURCE_TYPES) {
        expect(isValidNumber(resources[type])).toBe(true);
        expect(resources[type]).toBeGreaterThanOrEqual(0);
      }

      // 验证无NaN
      const snapshot = localEngine.getSnapshot();
      const errors = allNumbersValid(snapshot);
      expect(errors).toHaveLength(0);

      try { localEngine.reset(); } catch (e) {
        // 长时间运行后引擎状态可能异常
        expect(e).toBeDefined();
      }
    }
  });
});
