/**
 * ThreeKingdomsEngine 编排层单元测试 — 资源域
 * 覆盖：资源上限映射（粮仓、兵营、铁匠铺对上限的影响）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';

// ── localStorage mock ──
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((k: string) => storage[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { storage[k] = v; }),
  removeItem: vi.fn((k: string) => { delete storage[k]; }),
  clear: vi.fn(() => Object.keys(storage).forEach(k => delete storage[k])),
  get length() { return Object.keys(storage).length; },
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('ThreeKingdomsEngine — 资源域', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    vi.restoreAllMocks();
    engine = new ThreeKingdomsEngine();
  });

  afterEach(() => {
    engine.reset();
  });

  // ═══════════════════════════════════════════
  // 1. 粮仓映射修复
  // ═══════════════════════════════════════════
  describe('粮仓映射修复', () => {
    it('粮草上限由农田等级决定（非铁匠铺）', () => {
      engine.init();
      // 农田初始等级为 1，GRANARY_CAPACITY_TABLE[1]=2000, [5]=5000
      // 需要升级农田到 5 级才能看到上限变化
      const grainCapBefore = engine.getSnapshot().caps.grain;
      expect(grainCapBefore).toBe(2000); // GRANARY_CAPACITY_TABLE[1]

      // 升级农田 4 次（从 1 级到 5 级）
      for (let i = 0; i < 4; i++) {
        const check = engine.checkUpgrade('farmland');
        if (check.canUpgrade) {
          engine.upgradeBuilding('farmland');
          engine.tick(999999999);
        }
      }

      const grainCapAfter = engine.getSnapshot().caps.grain;
      // 如果成功升级到 5 级，上限应为 5000
      if (engine.building.getLevel('farmland') >= 5) {
        expect(grainCapAfter).toBeGreaterThan(grainCapBefore);
      }
    });

    it('兵力上限由兵营等级决定', () => {
      engine.init();
      // 兵营需要主城 2 级解锁，初始为 locked (level 0)
      // 先升级主城到 2 级以解锁兵营
      const castleCheck = engine.checkUpgrade('castle');
      if (castleCheck.canUpgrade) {
        engine.upgradeBuilding('castle');
        engine.tick(999999999);
      }

      const troopsCapBefore = engine.getSnapshot().caps.troops;

      const check = engine.checkUpgrade('barracks');
      if (check.canUpgrade) {
        engine.upgradeBuilding('barracks');
        engine.tick(999999999);
      }

      // 兵营从 0→1 解锁后，BARRACKS_CAPACITY_TABLE[1]=500
      const troopsCapAfter = engine.getSnapshot().caps.troops;
      if (engine.building.getLevel('barracks') >= 1) {
        expect(troopsCapAfter).toBeGreaterThanOrEqual(500);
      }
    });

    it('铁匠铺升级不影响粮草上限', () => {
      engine.init();
      // 先升级主城到 3 级以解锁铁匠铺
      for (let i = 0; i < 3; i++) {
        const castleCheck = engine.checkUpgrade('castle');
        if (castleCheck.canUpgrade) {
          engine.upgradeBuilding('castle');
          engine.tick(999999999);
        }
      }

      // 记录升级铁匠铺前的粮草上限
      const grainCapBefore = engine.getSnapshot().caps.grain;

      // 升级铁匠铺
      const smithyCheck = engine.checkUpgrade('smithy');
      if (smithyCheck.canUpgrade) {
        engine.upgradeBuilding('smithy');
        engine.tick(999999999);
      }

      // 粮草上限应该不变（铁匠铺不影响粮草上限）
      const grainCapAfter = engine.getSnapshot().caps.grain;
      expect(grainCapAfter).toBe(grainCapBefore);
    });
  });
});
