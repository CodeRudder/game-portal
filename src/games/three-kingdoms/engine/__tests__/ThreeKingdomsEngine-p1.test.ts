/**
 * ThreeKingdomsEngine 编排层单元测试 — 核心域
 * 覆盖：初始化、tick 循环、存档/读档、事件系统、状态查询、重置、
 *       SaveManager 委托、离线收益、加成体系框架
 */

import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';
import { SAVE_KEY, ENGINE_SAVE_VERSION } from '../../shared/constants';

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

describe('ThreeKingdomsEngine', () => {
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
  // 1. 初始化
  // ═══════════════════════════════════════════
  describe('init()', () => {
    it('初始化新游戏并发出 game:initialized 事件', () => {
      const listener = vi.fn();
      engine.on('game:initialized', listener);
      engine.init();
      expect(engine.isInitialized()).toBe(true);
      expect(listener).toHaveBeenCalledWith({ isNewGame: true });
    });

    it('重复调用 init() 为空操作', () => {
      engine.init();
      const listener = vi.fn();
      engine.on('game:initialized', listener);
      engine.init();
      expect(listener).not.toHaveBeenCalled();
    });

    it('初始化后快照包含默认资源', () => {
      engine.init();
      const snap = engine.getSnapshot();
      expect(snap.resources).toBeDefined();
      expect(snap.buildings).toBeDefined();
      expect(snap.onlineSeconds).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 游戏循环 tick
  // ═══════════════════════════════════════════
  describe('tick()', () => {
    it('未初始化时 tick 为空操作', () => {
      expect(() => engine.tick(100)).not.toThrow();
    });

    it('驱动资源产出并发出 resource:changed 事件', () => {
      engine.init();
      const listener = vi.fn();
      engine.on('resource:changed', listener);
      engine.tick(1000);
      expect(listener).toHaveBeenCalled();
    });

    it('自动保存累加', () => {
      engine.init();
      // 累加到30秒触发自动保存
      for (let i = 0; i < 30; i++) {
        engine.tick(1000);
      }
      expect(localStorageMock.setItem).toHaveBeenCalledWith(SAVE_KEY, expect.any(String));
    });

    it('tick 更新在线时长', () => {
      engine.init();
      engine.tick(5000);
      expect(engine.getOnlineSeconds()).toBeGreaterThanOrEqual(5);
    });

    it('建筑升级完成时发出 building:upgraded 事件', () => {
      engine.init();
      const check = engine.checkUpgrade('farmland');
      if (check.canUpgrade) {
        engine.upgradeBuilding('farmland');
        const upgradedListener = vi.fn();
        engine.on('building:upgraded', upgradedListener);
        engine.tick(999999999);
        expect(upgradedListener).toHaveBeenCalled();
      }
    });
  });

  // ═══════════════════════════════════════════
  // 3. 存档 / 读档
  // ═══════════════════════════════════════════
  describe('save() / load()', () => {
    it('保存到 localStorage', () => {
      engine.init();
      engine.save();
      expect(storage[SAVE_KEY]).toBeDefined();
      // SaveManager 使用 StateSerializer 包装：外层 {v, checksum, data}
      const outer = JSON.parse(storage[SAVE_KEY]);
      expect(outer.v).toBeDefined();
      expect(outer.checksum).toBeDefined();
      expect(outer.data).toBeDefined();
      // 内层是 IGameState 格式，subsystems 包含 resource/building
      const inner = JSON.parse(outer.data);
      expect(inner.version).toBe(String(ENGINE_SAVE_VERSION));
      expect(inner.subsystems.resource).toBeDefined();
      expect(inner.subsystems.building).toBeDefined();
    });

    it('发出 game:saved 事件', () => {
      engine.init();
      const listener = vi.fn();
      engine.on('game:saved', listener);
      engine.save();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ timestamp: expect.any(Number) }),
      );
    });

    it('加载存档并发出 game:loaded 事件', () => {
      engine.init();
      engine.save();
      const engine2 = new ThreeKingdomsEngine();
      const listener = vi.fn();
      engine2.on('game:loaded', listener);
      const result = engine2.load();
      expect(engine2.isInitialized()).toBe(true);
      expect(listener).toHaveBeenCalled();
      engine2.reset();
    });

    it('无存档时 load 返回 null', () => {
      expect(engine.load()).toBeNull();
    });

    it('损坏存档时 load 返回 null', () => {
      storage[SAVE_KEY] = 'not-valid-json{{{';
      expect(engine.load()).toBeNull();
    });

    it('serialize / deserialize 往返一致性', () => {
      engine.init();
      const json = engine.serialize();
      const engine2 = new ThreeKingdomsEngine();
      engine2.deserialize(json);
      expect(engine2.isInitialized()).toBe(true);
      const snap1 = engine.getSnapshot();
      const snap2 = engine2.getSnapshot();
      expect(snap1.resources.grain).toEqual(snap2.resources.grain);
    });

    it('hasSaveData 正确判断', () => {
      expect(engine.hasSaveData()).toBe(false);
      engine.init();
      engine.save();
      expect(engine.hasSaveData()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 事件系统
  // ═══════════════════════════════════════════
  describe('事件系统', () => {
    it('on() 注册并触发回调', () => {
      engine.init();
      const cb = vi.fn();
      engine.on('game:saved', cb);
      engine.save();
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('once() 仅触发一次', () => {
      engine.init();
      const cb = vi.fn();
      engine.once('game:saved', cb);
      engine.save();
      engine.save();
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('off() 取消订阅', () => {
      engine.init();
      const cb = vi.fn();
      engine.on('game:saved', cb);
      engine.off('game:saved', cb);
      engine.save();
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // 5. 状态查询
  // ═══════════════════════════════════════════
  describe('状态查询', () => {
    it('getSnapshot 返回完整快照', () => {
      engine.init();
      const snap = engine.getSnapshot();
      expect(snap).toHaveProperty('resources');
      expect(snap).toHaveProperty('productionRates');
      expect(snap).toHaveProperty('caps');
      expect(snap).toHaveProperty('buildings');
      expect(snap).toHaveProperty('onlineSeconds');
    });

    it('getCapWarnings 返回警告列表', () => {
      engine.init();
      const warnings = engine.getCapWarnings();
      expect(Array.isArray(warnings)).toBe(true);
    });

    it('getUpgradeProgress 返回 0~1', () => {
      engine.init();
      const progress = engine.getUpgradeProgress('farmland');
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    });

    it('getUpgradeRemainingTime 返回秒数', () => {
      engine.init();
      const remaining = engine.getUpgradeRemainingTime('farmland');
      expect(typeof remaining).toBe('number');
    });

    it('getUpgradeCost 返回费用', () => {
      engine.init();
      const cost = engine.getUpgradeCost('farmland');
      if (cost) {
        expect(cost).toHaveProperty('grain');
        expect(cost).toHaveProperty('gold');
      }
    });
  });

  // ═══════════════════════════════════════════
  // 6. 重置
  // ═══════════════════════════════════════════
  describe('reset()', () => {
    it('清除所有状态', () => {
      engine.init();
      engine.tick(1000);
      engine.reset();
      expect(engine.isInitialized()).toBe(false);
      expect(engine.getOnlineSeconds()).toBe(0);
    });

    it('删除 localStorage 存档', () => {
      engine.init();
      engine.save();
      engine.reset();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(SAVE_KEY);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 存档统一 — SaveManager 委托
  // ═══════════════════════════════════════════
  describe('存档统一（SaveManager 委托）', () => {
    it('save() 委托给 SaveManager（外层有 v/checksum/data 包装）', () => {
      engine.init();
      engine.save();
      const raw = storage[SAVE_KEY];
      expect(raw).toBeDefined();
      const outer = JSON.parse(raw);
      expect(outer.v).toBeDefined();
      expect(outer.checksum).toBeDefined();
      expect(outer.data).toBeDefined();
    });

    it('save() 内层数据包含 subsystems.resource 和 subsystems.building', () => {
      engine.init();
      engine.save();
      const outer = JSON.parse(storage[SAVE_KEY]);
      const inner = JSON.parse(outer.data);
      expect(inner.subsystems.resource).toBeDefined();
      expect(inner.subsystems.building).toBeDefined();
    });

    it('load() 从 SaveManager 恢复状态', () => {
      engine.init();
      engine.tick(2000);
      engine.save();

      const engine2 = new ThreeKingdomsEngine();
      const result = engine2.load();
      expect(result).not.toBeNull();
      expect(engine2.isInitialized()).toBe(true);
    });
  });
});
