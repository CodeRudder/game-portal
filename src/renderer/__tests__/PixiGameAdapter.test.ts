import { vi } from 'vitest';
/**
 * PixiGameAdapter 测试
 *
 * 测试通用放置游戏 PixiJS 渲染适配器：
 * - 构造函数和配置
 * - 状态提取（extractState）
 * - 生命周期（init/destroy）
 * - 状态同步（startSync/stopSync/syncState）
 * - 事件系统
 * - 尺寸管理
 */

import { PixiGameAdapter } from '../PixiGameAdapter';
import type { PixiGameAdapterConfig } from '../types';
import type { IdleGameRenderState } from '../types';

// ═══════════════════════════════════════════════════════════════
// Mock IdleGameEngine
// ═══════════════════════════════════════════════════════════════

/**
 * 创建模拟的 IdleGameEngine 实例
 *
 * 模拟 IdleGameEngine 的公共 API，提供可配置的测试数据。
 */
function createMockEngine(overrides: Record<string, any> = {}) {
  const resources = [
    { id: 'gold', name: '金币', amount: 1000, perSecond: 5.5, maxAmount: 1e9, unlocked: true },
    { id: 'food', name: '食物', amount: 500, perSecond: 2.0, maxAmount: 1e9, unlocked: true },
    { id: 'wood', name: '木材', amount: 0, perSecond: 0, maxAmount: 1e9, unlocked: false },
  ];

  const upgrades = [
    {
      id: 'upgrade-1',
      name: '农田升级',
      description: '增加食物产出',
      baseCost: { gold: 100 },
      costMultiplier: 1.5,
      level: 2,
      maxLevel: 10,
      effect: { type: 'add_production', target: 'food', value: 1 },
      unlocked: true,
      icon: '🌾',
    },
    {
      id: 'upgrade-2',
      name: '金矿升级',
      description: '增加金币产出',
      baseCost: { gold: 500 },
      costMultiplier: 2.0,
      level: 0,
      maxLevel: 5,
      effect: { type: 'multiply_production', target: 'gold', value: 2 },
      unlocked: true,
      icon: '⛏️',
    },
  ];

  return {
    gameId: 'test-game',
    getUnlockedResources: vi.fn(() => resources.filter(r => r.unlocked)),
    getAvailableUpgrades: vi.fn(() => upgrades.filter(u => u.unlocked && u.level < u.maxLevel)),
    getUpgradeCost: vi.fn((id: string) => {
      const u = upgrades.find(u => u.id === id);
      if (!u) return {};
      const cost: Record<string, number> = {};
      for (const [resId, base] of Object.entries(u.baseCost)) {
        cost[resId] = Math.floor((base as number) * Math.pow(u.costMultiplier, u.level));
      }
      return cost;
    }),
    canAfford: vi.fn((cost: Record<string, number>) => {
      for (const [id, amount] of Object.entries(cost)) {
        const r = resources.find(r => r.id === id);
        if (!r || r.amount < amount) return false;
      }
      return true;
    }),
    purchaseUpgrade: vi.fn(() => true),
    prestige: { currency: 50, count: 2 },
    statistics: { totalGold: 10000, totalUpgrades: 5, playTime: 3600 },
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    ...overrides,
  } as any;
}

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('PixiGameAdapter', () => {
  let mockEngine: any;

  beforeEach(() => {
    mockEngine = createMockEngine();
  });

  // ─── 构造函数 ─────────────────────────────────────────────

  describe('constructor', () => {
    it('should create an adapter with default config', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      expect(adapter).toBeDefined();
      expect(adapter.isInitialized()).toBe(false);
    });

    it('should accept custom config', () => {
      const config: PixiGameAdapterConfig = {
        syncInterval: 500,
        autoStart: false,
        showFPS: true,
      };
      const adapter = new PixiGameAdapter(mockEngine, config);
      expect(adapter).toBeDefined();
    });

    it('should accept custom renderer config', () => {
      const config: PixiGameAdapterConfig = {
        rendererConfig: {
          backgroundColor: '#ff0000',
          designWidth: 1280,
          designHeight: 720,
        },
      };
      const adapter = new PixiGameAdapter(mockEngine, config);
      expect(adapter).toBeDefined();
    });

    it('should use default strategy when none provided', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      const strategy = adapter.getStrategy();
      expect(strategy).toBeDefined();
      expect(strategy.sceneType).toBe('idle');
    });

    it('should use custom strategy when provided', () => {
      const customStrategy = {
        name: 'custom',
        sceneType: 'idle' as const,
        theme: {
          background: '#ff0000',
          panelBackground: '#00ff00',
          textPrimary: '#0000ff',
          textSecondary: '#888888',
          accent: '#ffff00',
          success: '#00ff00',
          warning: '#ff8800',
          resourceBarBg: '#333333',
          buttonBg: '#444444',
          buttonHover: '#555555',
        },
        layout: {
          resourceBarHeight: 0.1,
          buildingAreaHeight: 0.5,
          upgradePanelHeight: 0.3,
          statsPanelWidth: 0.2,
          gridColumns: 3,
          gridGap: 8,
          padding: 12,
          borderRadius: 8,
        },
      };
      const adapter = new PixiGameAdapter(mockEngine, { strategy: customStrategy });
      expect(adapter.getStrategy().name).toBe('custom');
    });

    it('should resolve strategy from game ID when not provided', () => {
      const engine = createMockEngine({ gameId: 'cookie-clicker' });
      const adapter = new PixiGameAdapter(engine);
      const strategy = adapter.getStrategy();
      expect(strategy.name).toBe('cookie-clicker');
    });
  });

  // ─── 公共访问器 ───────────────────────────────────────────

  describe('accessors', () => {
    it('getEngine should return the engine', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      expect(adapter.getEngine()).toBe(mockEngine);
    });

    it('getFPS should return 0 before init', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      expect(adapter.getFPS()).toBe(0);
    });

    it('getLastState should return null before sync', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      expect(adapter.getLastState()).toBeNull();
    });

    it('getIdleScene should return null before init', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      expect(adapter.getIdleScene()).toBeNull();
    });

    it('getApp should return null before init', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      expect(adapter.getApp()).toBeNull();
    });
  });

  // ─── 状态提取 ─────────────────────────────────────────────

  describe('state extraction', () => {
    it('should extract resources from engine', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      // Access private method via any cast for testing
      const state = (adapter as any).extractState() as IdleGameRenderState;
      expect(state.resources).toBeDefined();
      expect(state.resources.length).toBe(2); // Only unlocked
      expect(state.resources[0].id).toBe('gold');
      expect(state.resources[1].id).toBe('food');
    });

    it('should extract upgrades with canAfford status', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      const state = (adapter as any).extractState() as IdleGameRenderState;
      expect(state.upgrades).toBeDefined();
      expect(state.upgrades.length).toBe(2);
      // upgrade-1 cost: 100 * 1.5^2 = 225 gold, engine has 1000 → canAfford
      expect(state.upgrades[0].canAfford).toBe(true);
    });

    it('should extract prestige data', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      const state = (adapter as any).extractState() as IdleGameRenderState;
      expect(state.prestige).toEqual({ currency: 50, count: 2 });
    });

    it('should extract statistics', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      const state = (adapter as any).extractState() as IdleGameRenderState;
      expect(state.statistics).toEqual({
        totalGold: 10000,
        totalUpgrades: 5,
        playTime: 3600,
      });
    });

    it('should extract gameId', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      const state = (adapter as any).extractState() as IdleGameRenderState;
      expect(state.gameId).toBe('test-game');
    });

    it('should handle engine with no prestige', () => {
      const engine = createMockEngine({ prestige: undefined });
      const adapter = new PixiGameAdapter(engine);
      const state = (adapter as any).extractState() as IdleGameRenderState;
      expect(state.prestige).toEqual({ currency: 0, count: 0 });
    });

    it('should handle engine with no statistics', () => {
      const engine = createMockEngine({ statistics: undefined });
      const adapter = new PixiGameAdapter(engine);
      const state = (adapter as any).extractState() as IdleGameRenderState;
      expect(state.statistics).toEqual({});
    });

    it('should handle engine with no gameId', () => {
      const engine = createMockEngine({ gameId: undefined });
      const adapter = new PixiGameAdapter(engine);
      const state = (adapter as any).extractState() as IdleGameRenderState;
      expect(state.gameId).toBe('unknown');
    });

    it('should handle engine with no resources', () => {
      const engine = createMockEngine({
        getUnlockedResources: vi.fn(() => []),
      });
      const adapter = new PixiGameAdapter(engine);
      const state = (adapter as any).extractState() as IdleGameRenderState;
      expect(state.resources).toEqual([]);
    });

    it('should handle engine with no upgrades', () => {
      const engine = createMockEngine({
        getAvailableUpgrades: vi.fn(() => []),
      });
      const adapter = new PixiGameAdapter(engine);
      const state = (adapter as any).extractState() as IdleGameRenderState;
      expect(state.upgrades).toEqual([]);
    });
  });

  // ─── 事件系统 ─────────────────────────────────────────────

  describe('event system', () => {
    it('should register and call event listeners', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      const callback = vi.fn();
      adapter.on('ready', callback);
      (adapter as any).emit('ready');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should unregister event listeners', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      const callback = vi.fn();
      adapter.on('ready', callback);
      adapter.off('ready', callback);
      (adapter as any).emit('ready');
      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple listeners for same event', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      adapter.on('sync', cb1);
      adapter.on('sync', cb2);
      const testState = {} as IdleGameRenderState;
      (adapter as any).emit('sync', testState);
      expect(cb1).toHaveBeenCalledWith(testState);
      expect(cb2).toHaveBeenCalledWith(testState);
    });

    it('should not throw when emitting with no listeners', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      expect(() => (adapter as any).emit('nonexistent')).not.toThrow();
    });

    it('should catch errors in event listeners', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      const errorCallback = vi.fn(() => { throw new Error('test error'); });
      adapter.on('ready', errorCallback);
      expect(() => (adapter as any).emit('ready')).not.toThrow();
    });

    it('should pass arguments to event listeners', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      const callback = vi.fn();
      adapter.on('upgradeClick', callback);
      (adapter as any).emit('upgradeClick', 'upgrade-1');
      expect(callback).toHaveBeenCalledWith('upgrade-1');
    });
  });

  // ─── 升级处理 ─────────────────────────────────────────────

  describe('upgrade handling', () => {
    it('should call engine.purchaseUpgrade on upgrade click', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      // Initialize internals enough for handleUpgradeClick
      (adapter as any).initialized = true;
      (adapter as any).idleScene = { updateState: vi.fn() };

      (adapter as any).handleUpgradeClick('upgrade-1');
      expect(mockEngine.purchaseUpgrade).toHaveBeenCalledWith('upgrade-1');
    });

    it('should emit upgradeClick event', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      const callback = vi.fn();
      adapter.on('upgradeClick', callback);

      (adapter as any).handleUpgradeClick('upgrade-1');
      expect(callback).toHaveBeenCalledWith('upgrade-1');
    });

    it('should sync state after successful purchase', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      const syncSpy = vi.spyOn(adapter as any, 'syncState').mockImplementation(() => {});

      (adapter as any).handleUpgradeClick('upgrade-1');
      expect(syncSpy).toHaveBeenCalled();
    });

    it('should handle purchase failure gracefully', () => {
      const engine = createMockEngine({
        purchaseUpgrade: vi.fn(() => { throw new Error('purchase failed'); }),
      });
      const adapter = new PixiGameAdapter(engine);
      (adapter as any).initialized = true;

      expect(() => (adapter as any).handleUpgradeClick('upgrade-1')).not.toThrow();
    });
  });

  // ─── 同步控制 ─────────────────────────────────────────────

  describe('sync control', () => {
    it('startSync should create an interval', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      (adapter as any).initialized = true;
      (adapter as any).idleScene = { updateState: vi.fn() };

      adapter.startSync();
      expect((adapter as any).syncTimerId).not.toBeNull();
      adapter.stopSync();
    });

    it('stopSync should clear the interval', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      (adapter as any).initialized = true;
      (adapter as any).idleScene = { updateState: vi.fn() };

      adapter.startSync();
      adapter.stopSync();
      expect((adapter as any).syncTimerId).toBeNull();
    });

    it('startSync should not create duplicate intervals', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      (adapter as any).initialized = true;
      (adapter as any).idleScene = { updateState: vi.fn() };

      adapter.startSync();
      const firstId = (adapter as any).syncTimerId;
      adapter.startSync();
      expect((adapter as any).syncTimerId).toBe(firstId);
      adapter.stopSync();
    });

    it('syncState should update lastState', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      (adapter as any).initialized = true;
      (adapter as any).idleScene = { updateState: vi.fn() };

      adapter.syncState();
      const state = adapter.getLastState();
      expect(state).not.toBeNull();
      expect(state!.gameId).toBe('test-game');
    });

    it('syncState should emit sync event', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      (adapter as any).initialized = true;
      (adapter as any).idleScene = { updateState: vi.fn() };
      const callback = vi.fn();
      adapter.on('sync', callback);

      adapter.syncState();
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].gameId).toBe('test-game');
    });

    it('syncState should not run when not initialized', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      adapter.syncState();
      expect(adapter.getLastState()).toBeNull();
    });

    it('syncState should not run when already syncing', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      (adapter as any).initialized = true;
      (adapter as any).idleScene = { updateState: vi.fn() };
      (adapter as any).syncing = true;

      adapter.syncState();
      // Should not update because syncing flag was true
      expect((adapter as any).syncing).toBe(true);
    });
  });

  // ─── 销毁 ─────────────────────────────────────────────────

  describe('destroy', () => {
    it('should not throw when called on uninitialized adapter', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      expect(() => adapter.destroy()).not.toThrow();
    });

    it('should emit destroy event', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      (adapter as any).initialized = true;
      (adapter as any).idleScene = { destroy: vi.fn() };
      const callback = vi.fn();
      adapter.on('destroy', callback);

      adapter.destroy();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should set initialized to false', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      (adapter as any).initialized = true;
      (adapter as any).idleScene = { destroy: vi.fn() };
      adapter.destroy();
      expect(adapter.isInitialized()).toBe(false);
    });

    it('should clear listeners', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      (adapter as any).initialized = true;
      (adapter as any).idleScene = { destroy: vi.fn() };
      const callback = vi.fn();
      adapter.on('destroy', callback);

      adapter.destroy();
      // After destroy, listeners are cleared
      // callback was called once from the destroy itself
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should stop sync on destroy', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      (adapter as any).initialized = true;
      (adapter as any).idleScene = { updateState: vi.fn(), destroy: vi.fn() };
      adapter.startSync();

      adapter.destroy();
      expect((adapter as any).syncTimerId).toBeNull();
    });

    it('should clear lastState', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      (adapter as any).initialized = true;
      (adapter as any).idleScene = { updateState: vi.fn(), destroy: vi.fn() };
      adapter.syncState();
      expect(adapter.getLastState()).not.toBeNull();

      adapter.destroy();
      expect(adapter.getLastState()).toBeNull();
    });
  });

  // ─── 尺寸管理 ─────────────────────────────────────────────

  describe('resize', () => {
    it('should not throw when app is null', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      expect(() => adapter.resize(800, 600)).not.toThrow();
    });
  });

  // ─── 边界条件 ─────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle engine with empty resources gracefully', () => {
      const engine = createMockEngine({
        getUnlockedResources: vi.fn(() => []),
        getAvailableUpgrades: vi.fn(() => []),
      });
      const adapter = new PixiGameAdapter(engine);
      (adapter as any).initialized = true;
      (adapter as any).idleScene = { updateState: vi.fn() };

      adapter.syncState();
      const state = adapter.getLastState();
      expect(state!.resources).toEqual([]);
      expect(state!.upgrades).toEqual([]);
    });

    it('should handle engine with large numbers', () => {
      const engine = createMockEngine({
        getUnlockedResources: vi.fn(() => [
          { id: 'gold', name: '金币', amount: 1e15, perSecond: 1e9, maxAmount: Infinity, unlocked: true },
        ]),
      });
      const adapter = new PixiGameAdapter(engine);
      const state = (adapter as any).extractState() as IdleGameRenderState;
      expect(state.resources[0].amount).toBe(1e15);
      expect(state.resources[0].perSecond).toBe(1e9);
    });

    it('should handle multiple rapid syncState calls', () => {
      const adapter = new PixiGameAdapter(mockEngine);
      (adapter as any).initialized = true;
      (adapter as any).idleScene = { updateState: vi.fn() };

      adapter.syncState();
      adapter.syncState();
      adapter.syncState();
      expect(adapter.getLastState()).not.toBeNull();
    });
  });
});
