/**
 * IdleScene 测试
 *
 * 测试通用放置游戏场景：
 * - 构造函数和初始化
 * - 生命周期（enter/exit/update/destroy）
 * - 状态更新（updateState）
 * - 响应式布局（resize）
 * - 事件系统
 * - 渲染各区域
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock PixiJS v8 — IdleScene 使用 Container / Graphics / Text，
// 测试环境没有 Canvas / WebGL，需要完整 mock。
// ---------------------------------------------------------------------------

vi.mock('pixi.js', () => {
  class MockContainer {
    label: string;
    x = 0;
    y = 0;
    rotation = 0;
    visible = true;
    scale = { set: vi.fn(), x: 1, y: 1 };
    position = { set: vi.fn((x: number, y: number) => { this.x = x; this.y = y; }) };
    children: any[] = [];
    parent: any = null;
    // 事件
    emit = vi.fn();
    on = vi.fn().mockReturnThis();
    off = vi.fn();
    once = vi.fn();
    removeAllListeners = vi.fn();
    eventMode: string = 'passive';
    cursor: string = 'default';

    constructor(opts?: { label?: string }) { this.label = opts?.label ?? ''; }

    addChild(child: any) {
      this.children.push(child);
      if (child) {
        child.parent = this;
        if (typeof child.emit === 'function') child.emit('added', this);
      }
    }
    removeChild(child: any) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      if (child) child.parent = null;
    }
    removeChildren() {
      const old = [...this.children];
      this.children.forEach((c) => { if (c) c.parent = null; });
      this.children = [];
      return old;
    }
    getChildByLabel(label: string) {
      return this.children.find((c: any) => c.label === label) ?? null;
    }
    destroy(_opts?: any) { this.children = []; }
  }

  class MockGraphics {
    label = '';
    x = 0;
    y = 0;
    visible = true;
    parent: any = null;
    position = { set: vi.fn() };
    emit = vi.fn();
    on = vi.fn();
    off = vi.fn();
    once = vi.fn();
    removeAllListeners = vi.fn();

    clear() { return this; }
    circle(_x: number, _y: number, _r: number) { return this; }
    rect(_x: number, _y: number, _w: number, _h: number) { return this; }
    ellipse(_x: number, _y: number, _rw: number, _rh: number) { return this; }
    moveTo(_x: number, _y: number) { return this; }
    lineTo(_x: number, _y: number) { return this; }
    closePath() { return this; }
    fill(_c: any) { return this; }
    stroke(_s: any) { return this; }
    roundRect(_x: number, _y: number, _w: number, _h: number, _r: number) { return this; }
    destroy() {}
  }

  class MockText {
    label = '';
    text: string;
    anchor = { set: vi.fn(), x: 0, y: 0 };
    x = 0;
    y = 0;
    width = 50;
    height = 14;
    visible = true;
    parent: any = null;
    position = { set: vi.fn((x: number, y: number) => { this.x = x; this.y = y; }) };
    emit = vi.fn();
    on = vi.fn();
    off = vi.fn();
    once = vi.fn();
    removeAllListeners = vi.fn();

    constructor(opts?: any) { this.text = opts?.text ?? ''; }
    destroy() {}
  }

  return { Container: MockContainer, Graphics: MockGraphics, Text: MockText };
});

import { IdleScene } from '../scenes/IdleScene';
import type { RenderStrategy, IdleGameRenderState } from '../types';

// ═══════════════════════════════════════════════════════════════
// 测试策略
// ═══════════════════════════════════════════════════════════════

const TEST_STRATEGY: RenderStrategy = {
  name: 'test',
  sceneType: 'idle',
  theme: {
    background: '#0f0f1a',
    panelBackground: '#1a1a2e',
    textPrimary: '#e0e0e0',
    textSecondary: '#8888aa',
    accent: '#ffd700',
    success: '#4ecdc4',
    warning: '#f39c12',
    resourceBarBg: '#16162a',
    buttonBg: '#2a2a4a',
    buttonHover: '#3a3a6a',
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

// ═══════════════════════════════════════════════════════════════
// 测试状态
// ═══════════════════════════════════════════════════════════════

const TEST_STATE: IdleGameRenderState = {
  gameId: 'test-game',
  resources: [
    { id: 'gold', name: '金币', amount: 1000, perSecond: 5.5, maxAmount: 1e9, unlocked: true },
    { id: 'food', name: '食物', amount: 500, perSecond: 2.0, maxAmount: 1e9, unlocked: true },
    { id: 'wood', name: '木材', amount: 200, perSecond: 0, maxAmount: 1e9, unlocked: true },
  ],
  upgrades: [
    {
      id: 'upgrade-1',
      name: '农田升级',
      description: '增加食物产出',
      level: 2,
      maxLevel: 10,
      baseCost: { gold: 100 },
      costMultiplier: 1.5,
      unlocked: true,
      canAfford: true,
      effect: { type: 'add_production', target: 'food', value: 1 },
      icon: '🌾',
    },
    {
      id: 'upgrade-2',
      name: '金矿升级',
      description: '增加金币产出',
      level: 0,
      maxLevel: 5,
      baseCost: { gold: 500 },
      costMultiplier: 2.0,
      unlocked: true,
      canAfford: false,
      effect: { type: 'multiply_production', target: 'gold', value: 2 },
      icon: '⛏️',
    },
  ],
  prestige: { currency: 50, count: 2 },
  statistics: { totalGold: 10000, totalUpgrades: 5, playTime: 3600 },
};

const MINIMAL_STATE: IdleGameRenderState = {
  gameId: 'minimal',
  resources: [],
  upgrades: [],
  prestige: { currency: 0, count: 0 },
  statistics: {},
};

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('IdleScene', () => {
  let scene: IdleScene;

  beforeEach(() => {
    scene = new IdleScene(TEST_STRATEGY);
  });

  // ─── 构造函数 ─────────────────────────────────────────────

  describe('constructor', () => {
    it('should create a scene instance', () => {
      expect(scene).toBeDefined();
    });

    it('should return a container', () => {
      const container = scene.getContainer();
      expect(container).toBeDefined();
    });

    it('should not be active initially', () => {
      expect(scene.isActive()).toBe(false);
    });

    it('should have no current state initially', () => {
      expect(scene.getCurrentState()).toBeNull();
    });
  });

  // ─── 生命周期 ─────────────────────────────────────────────

  describe('lifecycle', () => {
    it('enter should activate the scene', async () => {
      await scene.enter();
      expect(scene.isActive()).toBe(true);
    });

    it('exit should deactivate the scene', async () => {
      await scene.enter();
      await scene.exit();
      expect(scene.isActive()).toBe(false);
    });

    it('update should not throw when active', async () => {
      await scene.enter();
      expect(() => scene.update(16.67)).not.toThrow();
    });

    it('update should not throw when inactive', () => {
      expect(() => scene.update(16.67)).not.toThrow();
    });

    it('destroy should clean up', async () => {
      await scene.enter();
      scene.destroy();
      expect(scene.isActive()).toBe(false);
    });

    it('destroy should clear listeners', async () => {
      const callback = vi.fn();
      scene.on('upgradeClick', callback);
      scene.destroy();
      // After destroy, listeners are cleared
      // Verify by checking internal state
      expect((scene as any).listeners.size).toBe(0);
    });
  });

  // ─── 状态更新 ─────────────────────────────────────────────

  describe('updateState', () => {
    it('should update state when active', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      expect(scene.getCurrentState()).toEqual(TEST_STATE);
    });

    it('should not update state when inactive', () => {
      scene.updateState(TEST_STATE);
      expect(scene.getCurrentState()).toBeNull();
    });

    it('should handle minimal state', async () => {
      await scene.enter();
      scene.updateState(MINIMAL_STATE);
      expect(scene.getCurrentState()).toEqual(MINIMAL_STATE);
    });

    it('should handle state with many resources', async () => {
      await scene.enter();
      const manyResources = Array.from({ length: 20 }, (_, i) => ({
        id: `res-${i}`,
        name: `资源${i}`,
        amount: i * 100,
        perSecond: i * 0.5,
        maxAmount: 1e9,
        unlocked: true,
      }));
      const state = { ...TEST_STATE, resources: manyResources };
      scene.updateState(state);
      expect(scene.getCurrentState()!.resources.length).toBe(20);
    });

    it('should handle state with many upgrades', async () => {
      await scene.enter();
      const manyUpgrades = Array.from({ length: 15 }, (_, i) => ({
        id: `upgrade-${i}`,
        name: `升级${i}`,
        description: `描述${i}`,
        level: 0,
        maxLevel: 10,
        baseCost: { gold: (i + 1) * 100 },
        costMultiplier: 1.5,
        unlocked: true,
        canAfford: i < 5,
        effect: { type: 'add_production', target: 'gold', value: i + 1 },
      }));
      const state = { ...TEST_STATE, upgrades: manyUpgrades };
      scene.updateState(state);
      expect(scene.getCurrentState()!.upgrades.length).toBe(15);
    });

    it('should handle state with large numbers', async () => {
      await scene.enter();
      const state: IdleGameRenderState = {
        gameId: 'big-numbers',
        resources: [
          { id: 'gold', name: '金币', amount: 1e15, perSecond: 1e9, maxAmount: Infinity, unlocked: true },
        ],
        upgrades: [],
        prestige: { currency: 1e12, count: 100 },
        statistics: { total: 1e18 },
      };
      scene.updateState(state);
      expect(scene.getCurrentState()!.resources[0].amount).toBe(1e15);
    });

    it('should handle consecutive updates', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      scene.updateState(MINIMAL_STATE);
      expect(scene.getCurrentState()).toEqual(MINIMAL_STATE);
    });

    it('should handle zero values', async () => {
      await scene.enter();
      const state: IdleGameRenderState = {
        gameId: 'zeros',
        resources: [
          { id: 'gold', name: '金币', amount: 0, perSecond: 0, maxAmount: 0, unlocked: true },
        ],
        upgrades: [],
        prestige: { currency: 0, count: 0 },
        statistics: {},
      };
      scene.updateState(state);
      expect(scene.getCurrentState()!.resources[0].amount).toBe(0);
    });

    it('should handle negative perSecond (consumption)', async () => {
      await scene.enter();
      const state: IdleGameRenderState = {
        gameId: 'consumption',
        resources: [
          { id: 'food', name: '食物', amount: 100, perSecond: -2, maxAmount: 1e9, unlocked: true },
        ],
        upgrades: [],
        prestige: { currency: 0, count: 0 },
        statistics: {},
      };
      scene.updateState(state);
      expect(scene.getCurrentState()!.resources[0].perSecond).toBe(-2);
    });
  });

  // ─── 响应式布局 ───────────────────────────────────────────

  describe('resize', () => {
    it('should handle resize without state', async () => {
      await scene.enter();
      expect(() => scene.resize(1920, 1080)).not.toThrow();
    });

    it('should handle resize with state', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      expect(() => scene.resize(1920, 1080)).not.toThrow();
    });

    it('should handle small sizes', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      expect(() => scene.resize(320, 240)).not.toThrow();
    });

    it('should handle large sizes', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      expect(() => scene.resize(3840, 2160)).not.toThrow();
    });

    it('should handle zero size gracefully', async () => {
      await scene.enter();
      expect(() => scene.resize(0, 0)).not.toThrow();
    });

    it('should re-render state after resize', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      scene.resize(1280, 720);
      expect(scene.getCurrentState()).toEqual(TEST_STATE);
    });
  });

  // ─── 事件系统 ─────────────────────────────────────────────

  describe('events', () => {
    it('should register event listeners', () => {
      const callback = vi.fn();
      scene.on('upgradeClick', callback);
      expect((scene as any).listeners.has('upgradeClick')).toBe(true);
    });

    it('should unregister event listeners', () => {
      const callback = vi.fn();
      scene.on('upgradeClick', callback);
      scene.off('upgradeClick', callback);
      expect((scene as any).listeners.get('upgradeClick')?.size).toBe(0);
    });

    it('should call event listeners when emitted', () => {
      const callback = vi.fn();
      scene.on('upgradeClick', callback);
      (scene as any).emit('upgradeClick', 'upgrade-1');
      expect(callback).toHaveBeenCalledWith('upgrade-1');
    });

    it('should support multiple listeners', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      scene.on('upgradeClick', cb1);
      scene.on('upgradeClick', cb2);
      (scene as any).emit('upgradeClick', 'upgrade-1');
      expect(cb1).toHaveBeenCalledWith('upgrade-1');
      expect(cb2).toHaveBeenCalledWith('upgrade-1');
    });

    it('should not throw on emit with no listeners', () => {
      expect(() => (scene as any).emit('nonexistent')).not.toThrow();
    });

    it('should catch errors in listeners', () => {
      const badCallback = vi.fn(() => { throw new Error('test'); });
      scene.on('upgradeClick', badCallback);
      expect(() => (scene as any).emit('upgradeClick', 'id')).not.toThrow();
    });
  });

  // ─── 渲染区域验证 ─────────────────────────────────────────

  describe('rendering', () => {
    it('should render resource bar with resources', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      // Resource bar should have children (texts)
      const resourceBar = container.getChildByLabel('resource-bar');
      expect(resourceBar).toBeDefined();
    });

    it('should render building area with cards', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const buildingArea = container.getChildByLabel('building-area');
      expect(buildingArea).toBeDefined();
    });

    it('should render upgrade panel with buttons', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const upgradePanel = container.getChildByLabel('upgrade-panel');
      expect(upgradePanel).toBeDefined();
    });

    it('should render stats panel', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const statsPanel = container.getChildByLabel('stats-panel');
      expect(statsPanel).toBeDefined();
    });

    it('should render title', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      // Title text should be set to gameId
      expect((scene as any).titleText.text).toBe('test-game');
    });

    it('should render empty state without errors', async () => {
      await scene.enter();
      expect(() => scene.updateState(MINIMAL_STATE)).not.toThrow();
    });

    it('should clean up old texts on re-render', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const firstStateResourceCount = TEST_STATE.resources.length;

      // Update with different state
      scene.updateState(MINIMAL_STATE);

      // Resource texts should be cleaned (minimal has 0 resources)
      expect((scene as any).resourceTexts.length).toBe(0);
    });

    it('should clean up old building cards on re-render', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      scene.updateState(MINIMAL_STATE);
      expect((scene as any).buildingCards.length).toBe(0);
    });

    it('should clean up old upgrade buttons on re-render', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      scene.updateState(MINIMAL_STATE);
      expect((scene as any).upgradeButtons.length).toBe(0);
    });

    it('should clean up old stats texts on re-render', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      // TEST_STATE has statistics entries → extra stats texts beyond the 3 base ones
      const fullCount = (scene as any).statsTexts.length;

      scene.updateState(MINIMAL_STATE);
      // MINIMAL_STATE has no statistics entries, but still renders 3 base texts (title + prestige + count)
      expect((scene as any).statsTexts.length).toBe(3);
      expect((scene as any).statsTexts.length).toBeLessThan(fullCount);
    });
  });

  // ─── 不同策略测试 ─────────────────────────────────────────

  describe('different strategies', () => {
    it('should work with cookie-clicker strategy', async () => {
      const { RenderStrategyRegistry } = await import('../RenderStrategyRegistry');
      const strategy = RenderStrategyRegistry.get('cookie-clicker');
      const cookieScene = new IdleScene(strategy);
      await cookieScene.enter();
      cookieScene.updateState(TEST_STATE);
      expect(cookieScene.getCurrentState()).toEqual(TEST_STATE);
      cookieScene.destroy();
    });

    it('should work with civilization strategy', async () => {
      const { RenderStrategyRegistry } = await import('../RenderStrategyRegistry');
      const strategy = RenderStrategyRegistry.get('civ-egypt');
      const civScene = new IdleScene(strategy);
      await civScene.enter();
      civScene.updateState(TEST_STATE);
      expect(civScene.getCurrentState()).toEqual(TEST_STATE);
      civScene.destroy();
    });

    it('should work with fantasy strategy', async () => {
      const { RenderStrategyRegistry } = await import('../RenderStrategyRegistry');
      const strategy = RenderStrategyRegistry.get('idle-xianxia');
      const fantasyScene = new IdleScene(strategy);
      await fantasyScene.enter();
      fantasyScene.updateState(TEST_STATE);
      expect(fantasyScene.getCurrentState()).toEqual(TEST_STATE);
      fantasyScene.destroy();
    });

    it('should work with scifi strategy', async () => {
      const { RenderStrategyRegistry } = await import('../RenderStrategyRegistry');
      const strategy = RenderStrategyRegistry.get('space-war');
      const scifiScene = new IdleScene(strategy);
      await scifiScene.enter();
      scifiScene.updateState(TEST_STATE);
      expect(scifiScene.getCurrentState()).toEqual(TEST_STATE);
      scifiScene.destroy();
    });

    it('should work with nature strategy', async () => {
      const { RenderStrategyRegistry } = await import('../RenderStrategyRegistry');
      const strategy = RenderStrategyRegistry.get('ant-kingdom');
      const natureScene = new IdleScene(strategy);
      await natureScene.enter();
      natureScene.updateState(TEST_STATE);
      expect(natureScene.getCurrentState()).toEqual(TEST_STATE);
      natureScene.destroy();
    });
  });
});
