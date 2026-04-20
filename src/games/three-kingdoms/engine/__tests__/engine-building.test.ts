/**
 * ThreeKingdomsEngine 编排层单元测试 — 建筑域
 * 覆盖：建筑升级、取消升级、升级检查
 */

import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';

// ── localStorage mock ──
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((k: string) => storage[k] ?? null),
  setItem: jest.fn((k: string, v: string) => { storage[k] = v; }),
  removeItem: jest.fn((k: string) => { delete storage[k]; }),
  clear: jest.fn(() => Object.keys(storage).forEach(k => delete storage[k])),
  get length() { return Object.keys(storage).length; },
  key: jest.fn(() => null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('ThreeKingdomsEngine — 建筑域', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    jest.restoreAllMocks();
    engine = new ThreeKingdomsEngine();
  });

  afterEach(() => {
    engine.reset();
  });

  // ═══════════════════════════════════════════
  // 1. 建筑升级
  // ═══════════════════════════════════════════
  describe('upgradeBuilding()', () => {
    it('成功升级建筑', () => {
      engine.init();
      const check = engine.checkUpgrade('farmland');
      if (check.canUpgrade) {
        const goldBefore = engine.resource.getAmount('gold');
        engine.upgradeBuilding('farmland');
        expect(engine.resource.getAmount('gold')).toBeLessThan(goldBefore);
      }
    });

    it('资源不足时抛出错误', () => {
      engine.init();
      // 消耗所有gold和grain（grain有保留量保护，用setResource直接置0）
      const res = engine.resource.getResources();
      engine.resource.setResource('gold', 0);
      engine.resource.setResource('grain', 0);
      expect(() => engine.upgradeBuilding('farmland')).toThrow();
    });

    it('发出 building:upgrade-start 事件', () => {
      engine.init();
      const listener = jest.fn();
      engine.on('building:upgrade-start', listener);
      const check = engine.checkUpgrade('farmland');
      if (check.canUpgrade) {
        engine.upgradeBuilding('farmland');
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'farmland' }),
        );
      }
    });

    it('checkUpgrade 返回不可升级原因', () => {
      engine.init();
      engine.resource.setResource('gold', 0);
      engine.resource.setResource('grain', 0);
      const check = engine.checkUpgrade('farmland');
      expect(check.canUpgrade).toBe(false);
      expect(check.reasons.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 取消升级
  // ═══════════════════════════════════════════
  describe('cancelUpgrade()', () => {
    it('成功取消并返还资源', () => {
      engine.init();
      const check = engine.checkUpgrade('farmland');
      if (check.canUpgrade) {
        const goldBefore = engine.resource.getAmount('gold');
        engine.upgradeBuilding('farmland');
        const refund = engine.cancelUpgrade('farmland');
        expect(refund).not.toBeNull();
        expect(engine.resource.getAmount('gold')).toBe(goldBefore);
      }
    });

    it('建筑未升级时返回 null', () => {
      engine.init();
      expect(engine.cancelUpgrade('farmland')).toBeNull();
    });
  });
});
