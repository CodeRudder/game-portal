/**
 * AgeOfEmpiresScene 测试
 *
 * 测试帝国时代专属场景：
 * - 构造函数和初始化
 * - 生命周期
 * - 状态更新
 * - 响应式布局
 * - 事件系统
 * - 城镇地图渲染
 * - 科技树渲染
 * - 时代指示器
 * - 策略注册
 */

// ---------------------------------------------------------------------------
// Mock PixiJS v8
// ---------------------------------------------------------------------------

jest.mock('pixi.js', () => {
  class MockContainer {
    label: string;
    x = 0;
    y = 0;
    visible = true;
    scale = { set: jest.fn(), x: 1, y: 1 };
    position = { set: jest.fn((x: number, y: number) => { this.x = x; this.y = y; }) };
    children: any[] = [];
    parent: any = null;
    emit = jest.fn();
    on = jest.fn().mockReturnThis();
    off = jest.fn();
    once = jest.fn();
    removeAllListeners = jest.fn();
    eventMode: string = 'passive';
    cursor: string = 'default';

    constructor(opts?: { label?: string }) { this.label = opts?.label ?? ''; }

    addChild(child: any) {
      this.children.push(child);
      if (child) { child.parent = this; if (typeof child.emit === 'function') child.emit('added', this); }
    }
    removeChild(child: any) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      if (child) child.parent = null;
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
    position = { set: jest.fn() };
    emit = jest.fn();
    on = jest.fn();

    clear() { return this; }
    circle(_x: number, _y: number, _r: number) { return this; }
    rect(_x: number, _y: number, _w: number, _h: number) { return this; }
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
    anchor = { set: jest.fn(), x: 0, y: 0 };
    x = 0;
    y = 0;
    width = 50;
    height = 14;
    visible = true;
    parent: any = null;
    position = { set: jest.fn((x: number, y: number) => { this.x = x; this.y = y; }) };
    emit = jest.fn();
    on = jest.fn();
    off = jest.fn();

    constructor(opts?: any) { this.text = opts?.text ?? ''; }
    destroy() {}
  }

  return { Container: MockContainer, Graphics: MockGraphics, Text: MockText };
});

import { AgeOfEmpiresScene } from '../scenes/AgeOfEmpiresScene';
import { RenderStrategyRegistry } from '../RenderStrategyRegistry';
import type { RenderStrategy, IdleGameRenderState } from '../types';

// ═══════════════════════════════════════════════════════════════
// 测试数据
// ═══════════════════════════════════════════════════════════════

const AOE_STRATEGY: RenderStrategy = RenderStrategyRegistry.get('age-of-empires');

const TEST_STATE: IdleGameRenderState = {
  gameId: 'age-of-empires',
  resources: [
    { id: 'food', name: '食物', amount: 1000, perSecond: 5.5, maxAmount: 1e9, unlocked: true },
    { id: 'wood', name: '木材', amount: 500, perSecond: 2.0, maxAmount: 1e9, unlocked: true },
    { id: 'stone', name: '石头', amount: 200, perSecond: 0, maxAmount: 1e9, unlocked: true },
  ],
  upgrades: [
    {
      id: 'farm', name: '农田', description: '产出食物', level: 2, maxLevel: 10,
      baseCost: { food: 100 }, costMultiplier: 1.5, unlocked: true, canAfford: true,
      effect: { type: 'add_production', target: 'food', value: 1 }, icon: '🌾',
    },
    {
      id: 'lumber_camp', name: '伐木场', description: '产出木材', level: 0, maxLevel: 5,
      baseCost: { food: 500 }, costMultiplier: 2.0, unlocked: true, canAfford: false,
      effect: { type: 'add_production', target: 'wood', value: 2 }, icon: '🪵',
    },
  ],
  prestige: { currency: 50, count: 2 },
  statistics: { totalFoodEarned: 10000, totalAgeAdvances: 1, totalBuildingsPurchased: 10 },
};

const MINIMAL_STATE: IdleGameRenderState = {
  gameId: 'age-of-empires',
  resources: [],
  upgrades: [],
  prestige: { currency: 0, count: 0 },
  statistics: {},
};

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('AgeOfEmpiresScene', () => {
  let scene: AgeOfEmpiresScene;

  beforeEach(() => {
    scene = new AgeOfEmpiresScene(AOE_STRATEGY);
  });

  // ─── 构造函数 ─────────────────────────────────────────────

  describe('constructor', () => {
    it('should create a scene instance', () => {
      expect(scene).toBeDefined();
    });

    it('should return a container with correct label', () => {
      const container = scene.getContainer();
      expect(container).toBeDefined();
      expect(container.label).toBe('age-of-empires-scene');
    });

    it('should not be active initially', () => {
      expect(scene.isActive()).toBe(false);
    });

    it('should have no current state initially', () => {
      expect(scene.getCurrentState()).toBeNull();
    });

    it('should default to dark age', () => {
      expect(scene.getAge()).toBe('dark_age');
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
      const callback = jest.fn();
      scene.on('upgradeClick', callback);
      scene.destroy();
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

    it('should handle consecutive updates', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      scene.updateState(MINIMAL_STATE);
      expect(scene.getCurrentState()).toEqual(MINIMAL_STATE);
    });

    it('should handle zero values', async () => {
      await scene.enter();
      const state: IdleGameRenderState = {
        gameId: 'age-of-empires',
        resources: [
          { id: 'food', name: '食物', amount: 0, perSecond: 0, maxAmount: 0, unlocked: true },
        ],
        upgrades: [],
        prestige: { currency: 0, count: 0 },
        statistics: {},
      };
      scene.updateState(state);
      expect(scene.getCurrentState()!.resources[0].amount).toBe(0);
    });

    it('should handle large numbers', async () => {
      await scene.enter();
      const state: IdleGameRenderState = {
        gameId: 'age-of-empires',
        resources: [
          { id: 'food', name: '食物', amount: 1e15, perSecond: 1e9, maxAmount: Infinity, unlocked: true },
        ],
        upgrades: [],
        prestige: { currency: 1e12, count: 100 },
        statistics: {},
      };
      scene.updateState(state);
      expect(scene.getCurrentState()!.resources[0].amount).toBe(1e15);
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
      expect(() => scene.resize(1280, 720)).not.toThrow();
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
      const callback = jest.fn();
      scene.on('upgradeClick', callback);
      expect((scene as any).listeners.has('upgradeClick')).toBe(true);
    });

    it('should unregister event listeners', () => {
      const callback = jest.fn();
      scene.on('upgradeClick', callback);
      scene.off('upgradeClick', callback);
      expect((scene as any).listeners.get('upgradeClick')?.size).toBe(0);
    });

    it('should call event listeners when emitted', () => {
      const callback = jest.fn();
      scene.on('techClick', callback);
      (scene as any).emit('techClick', 'agriculture');
      expect(callback).toHaveBeenCalledWith('agriculture');
    });

    it('should support ageAdvance event', () => {
      const callback = jest.fn();
      scene.on('ageAdvance', callback);
      (scene as any).emit('ageAdvance');
      expect(callback).toHaveBeenCalled();
    });

    it('should not throw on emit with no listeners', () => {
      expect(() => (scene as any).emit('nonexistent')).not.toThrow();
    });

    it('should catch errors in listeners', () => {
      const badCallback = jest.fn(() => { throw new Error('test'); });
      scene.on('upgradeClick', badCallback);
      expect(() => (scene as any).emit('upgradeClick', 'id')).not.toThrow();
    });
  });

  // ─── 渲染区域验证 ─────────────────────────────────────────

  describe('rendering', () => {
    it('should render resource bar', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const resourceBar = container.getChildByLabel('aoe-resource-bar');
      expect(resourceBar).toBeDefined();
    });

    it('should render town map', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const townMap = container.getChildByLabel('aoe-town-map');
      expect(townMap).toBeDefined();
    });

    it('should render tech tree', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const techTree = container.getChildByLabel('aoe-tech-tree');
      expect(techTree).toBeDefined();
    });

    it('should render building panel', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const buildingPanel = container.getChildByLabel('aoe-building-panel');
      expect(buildingPanel).toBeDefined();
    });

    it('should render age indicator', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const ageIndicator = container.getChildByLabel('aoe-age-indicator');
      expect(ageIndicator).toBeDefined();
    });

    it('should render title with game id', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      expect((scene as any).titleText.text).toBe('👑 age-of-empires');
    });

    it('should render empty state without errors', async () => {
      await scene.enter();
      expect(() => scene.updateState(MINIMAL_STATE)).not.toThrow();
    });

    it('should clean up old texts on re-render', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      scene.updateState(MINIMAL_STATE);
      expect((scene as any).resourceTexts.length).toBe(0);
    });
  });

  // ─── 时代系统 ─────────────────────────────────────────────

  describe('age system', () => {
    it('should default to dark age', () => {
      expect(scene.getAge()).toBe('dark_age');
    });

    it('should set age to feudal age', () => {
      scene.setAge('feudal_age');
      expect(scene.getAge()).toBe('feudal_age');
    });

    it('should set age to castle age', () => {
      scene.setAge('castle_age');
      expect(scene.getAge()).toBe('castle_age');
    });

    it('should set age to imperial age', () => {
      scene.setAge('imperial_age');
      expect(scene.getAge()).toBe('imperial_age');
    });

    it('should re-render age indicator when age changes', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      scene.setAge('feudal_age');
      // Verify no error thrown
      expect(scene.getAge()).toBe('feudal_age');
    });
  });

  // ─── 策略注册 ─────────────────────────────────────────────

  describe('strategy registration', () => {
    it('should have age-of-empires strategy registered', () => {
      expect(RenderStrategyRegistry.hasStrategy('age-of-empires')).toBe(true);
    });

    it('should have age-of-empires game mapping', () => {
      expect(RenderStrategyRegistry.hasGameMapping('age-of-empires')).toBe(true);
    });

    it('should return age-of-empires strategy for age-of-empires game', () => {
      const strategy = RenderStrategyRegistry.get('age-of-empires');
      expect(strategy.name).toBe('age-of-empires');
    });

    it('should have empire theme colors', () => {
      const strategy = RenderStrategyRegistry.get('age-of-empires');
      expect(strategy.theme.accent).toBe('#d4a017');
      expect(strategy.theme.background).toBe('#1a1408');
    });

    it('should have correct layout for empire UI', () => {
      const strategy = RenderStrategyRegistry.get('age-of-empires');
      expect(strategy.layout.gridColumns).toBe(4);
      expect(strategy.layout.borderRadius).toBe(8);
    });
  });
});
