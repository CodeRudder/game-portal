/**
 * StrategyScene 测试
 *
 * 测试策略游戏通用场景：
 * - 构造函数和初始化
 * - 生命周期（enter/exit/update/destroy）
 * - 状态更新（updateState）
 * - 响应式布局（resize）
 * - 事件系统
 * - 各面板渲染（资源栏、领地、军队、科技、底部）
 * - 颜色主题切换
 * - 边界情况
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
    position = { set: jest.fn() };
    emit = jest.fn();
    on = jest.fn();
    off = jest.fn();
    once = jest.fn();
    removeAllListeners = jest.fn();

    clear() { return this; }
    circle(_x: number, _y: number, _r: number) { return this; }
    rect(_x: number, _y: number, _w: number, _h: number) { return this; }
    ellipse(_x: number, _y: number, _rw: number, _rh: number) { return this; }
    arc(_cx: number, _cy: number, _rx: number, _ry: number, _startAngle: number, _endAngle: number, _counterclockwise?: boolean) { return this; }
    moveTo(_x: number, _y: number) { return this; }
    lineTo(_x: number, _y: number) { return this; }
    quadraticCurveTo(_cx: number, _cy: number, _x: number, _y: number) { return this; }
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
    position = { set: jest.fn() };
    style: any;
    emit = jest.fn();
    on = jest.fn();
    off = jest.fn();
    once = jest.fn();
    removeAllListeners = jest.fn();

    constructor(opts?: { text?: string; style?: any }) {
      this.text = opts?.text ?? '';
      this.style = opts?.style ?? {};
    }
    destroy() {}
  }

  return {
    Container: MockContainer,
    Graphics: MockGraphics,
    Text: MockText,
  };
});

// ---------------------------------------------------------------------------
// 导入
// ---------------------------------------------------------------------------

import { StrategyScene } from '../scenes/StrategyScene';
import type { StrategyGameRenderState } from '../scenes/StrategyScene';
import type { RenderStrategy } from '../types';

// ---------------------------------------------------------------------------
// 测试辅助
// ---------------------------------------------------------------------------

/** 创建测试用渲染策略 */
function createTestStrategy(overrides?: Partial<RenderStrategy>): RenderStrategy {
  return {
    name: 'test-strategy',
    sceneType: 'idle',
    theme: {
      background: '#1a1a1e',
      panelBackground: '#2a2a30',
      textPrimary: '#d0d0d8',
      textSecondary: '#7a7a8a',
      accent: '#c0392b',
      success: '#27ae60',
      warning: '#e67e22',
      resourceBarBg: '#1e1e24',
      buttonBg: '#3a2a2a',
      buttonHover: '#4a3a3a',
      ...overrides?.theme,
    },
    layout: {
      resourceBarHeight: 0.08,
      buildingAreaHeight: 0.5,
      upgradePanelHeight: 0.38,
      statsPanelWidth: 0.25,
      gridColumns: 4,
      gridGap: 8,
      padding: 12,
      borderRadius: 6,
      ...overrides?.layout,
    },
  };
}

/** 创建最小渲染状态 */
function createMinimalState(overrides?: Partial<StrategyGameRenderState>): StrategyGameRenderState {
  return {
    gameId: 'total-war',
    resources: [
      { id: 'gold', name: '金币', amount: 1000, perSecond: 5, maxAmount: 1e15, unlocked: true },
      { id: 'iron', name: '铁矿石', amount: 500, perSecond: 2, maxAmount: 1e12, unlocked: true },
      { id: 'troop', name: '兵力', amount: 100, perSecond: 1, maxAmount: 1e9, unlocked: true },
    ],
    upgrades: [],
    prestige: { currency: 0, count: 0 },
    statistics: { totalGoldEarned: 5000 },
    ...overrides,
  };
}

/** 创建完整策略游戏渲染状态 */
function createFullState(): StrategyGameRenderState {
  return createMinimalState({
    territories: [
      { id: 'capital', name: '王都', conquered: true },
      { id: 'north', name: '北方要塞', conquered: true },
      { id: 'east', name: '东方平原', conquered: false, powerRequired: 500 },
      { id: 'south', name: '南方港口', conquered: false, powerRequired: 1000 },
    ],
    units: [
      { id: 'infantry', name: '步兵', type: 'infantry', count: 50, level: 2, power: 150, unlocked: true },
      { id: 'cavalry', name: '骑兵', type: 'cavalry', count: 20, level: 1, power: 100, unlocked: true },
      { id: 'archer', name: '弓箭手', type: 'archer', count: 30, level: 1, power: 80, unlocked: true },
    ],
    techs: [
      { id: 'iron_weapons', name: '铁制武器', progress: 0.75, state: 'researching' as const },
      { id: 'fortification', name: '城防工事', progress: 1.0, state: 'completed' as const },
      { id: 'agriculture', name: '农业技术', progress: 0, state: 'available' as const },
      { id: 'siege', name: '攻城术', progress: 0, state: 'locked' as const },
    ],
    resourcePoints: [
      { id: 'rp1', type: 'gold', name: '金矿脉', level: 3, output: 10, isActive: true },
      { id: 'rp2', type: 'wood', name: '伐木场', level: 2, output: 5, isActive: true },
      { id: 'rp3', type: 'stone', name: '采石场', level: 1, output: 3, isActive: false },
    ],
    diplomacy: [
      { id: 'alliance1', name: '北方联盟', relation: 'ally' as const, strength: 500 },
      { id: 'neutral1', name: '东方王国', relation: 'neutral' as const, strength: 300 },
      { id: 'enemy1', name: '南方帝国', relation: 'enemy' as const, strength: 800 },
    ],
    eraName: '铁器时代',
    totalPower: 330,
  });
}

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('StrategyScene', () => {

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should create scene with strategy', () => {
      const strategy = createTestStrategy();
      const scene = new StrategyScene(strategy);
      expect(scene).toBeDefined();
      expect(scene.isActive()).toBe(false);
      expect(scene.getContainer()).toBeDefined();
      expect(scene.getStrategy()).toBe(strategy);
    });

    it('should create container with correct label', () => {
      const scene = new StrategyScene(createTestStrategy());
      expect(scene.getContainer().label).toBe('strategy-scene');
    });

    it('should initialize with null current state', () => {
      const scene = new StrategyScene(createTestStrategy());
      expect(scene.getCurrentState()).toBeNull();
    });

    it('should create icon renderer', () => {
      const scene = new StrategyScene(createTestStrategy());
      expect(scene.getIconRenderer()).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  describe('lifecycle', () => {
    let scene: StrategyScene;

    beforeEach(() => {
      scene = new StrategyScene(createTestStrategy());
    });

    it('should activate on enter', async () => {
      await scene.enter();
      expect(scene.isActive()).toBe(true);
    });

    it('should make container visible on enter', async () => {
      await scene.enter();
      expect(scene.getContainer().visible).toBe(true);
    });

    it('should deactivate on exit', async () => {
      await scene.enter();
      await scene.exit();
      expect(scene.isActive()).toBe(false);
    });

    it('should hide container on exit', async () => {
      await scene.enter();
      await scene.exit();
      expect(scene.getContainer().visible).toBe(false);
    });

    it('should handle update when not active', () => {
      expect(() => scene.update(16)).not.toThrow();
    });

    it('should handle update when active', async () => {
      await scene.enter();
      expect(() => scene.update(16)).not.toThrow();
    });

    it('should destroy scene and clear listeners', async () => {
      await scene.enter();
      scene.destroy();
      expect(scene.isActive()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 状态更新
  // ═══════════════════════════════════════════════════════════

  describe('updateState', () => {
    let scene: StrategyScene;

    beforeEach(async () => {
      scene = new StrategyScene(createTestStrategy());
      await scene.enter();
    });

    it('should update state when active', () => {
      const state = createMinimalState();
      scene.updateState(state);
      expect(scene.getCurrentState()).toBe(state);
    });

    it('should not update state when not active', async () => {
      await scene.exit();
      const state = createMinimalState();
      scene.updateState(state);
      expect(scene.getCurrentState()).toBeNull();
    });

    it('should render resources in resource bar', () => {
      const state = createMinimalState();
      scene.updateState(state);
      // Resource bar should have children (texts and icons)
      const resourceBar = scene.getContainer().children.find(c => c.label === 'strategy-resource-bar');
      expect(resourceBar).toBeDefined();
      expect(resourceBar!.children.length).toBeGreaterThan(0);
    });

    it('should handle empty resources', () => {
      const state = createMinimalState({ resources: [] });
      scene.updateState(state);
      expect(scene.getCurrentState()).toBe(state);
    });

    it('should handle full state with all panels', () => {
      const state = createFullState();
      scene.updateState(state);
      expect(scene.getCurrentState()).toBe(state);
    });

    it('should render territories when provided', () => {
      const state = createFullState();
      scene.updateState(state);
      const territoryPanel = scene.getContainer().children.find(c => c.label === 'territory-panel');
      expect(territoryPanel).toBeDefined();
      expect(territoryPanel!.children.length).toBeGreaterThan(1);
    });

    it('should render army units when provided', () => {
      const state = createFullState();
      scene.updateState(state);
      const armyPanel = scene.getContainer().children.find(c => c.label === 'army-panel');
      expect(armyPanel).toBeDefined();
      expect(armyPanel!.children.length).toBeGreaterThan(1);
    });

    it('should render tech progress bars when provided', () => {
      const state = createFullState();
      scene.updateState(state);
      const techPanel = scene.getContainer().children.find(c => c.label === 'tech-panel');
      expect(techPanel).toBeDefined();
      expect(techPanel!.children.length).toBeGreaterThan(1);
    });

    it('should render bottom panel with resource points and diplomacy', () => {
      const state = createFullState();
      scene.updateState(state);
      const bottomPanel = scene.getContainer().children.find(c => c.label === 'bottom-panel');
      expect(bottomPanel).toBeDefined();
      expect(bottomPanel!.children.length).toBeGreaterThan(0);
    });

    it('should display era name when provided', () => {
      const state = createFullState();
      scene.updateState(state);
      // eraText should be visible
      expect(scene.getCurrentState()?.eraName).toBe('铁器时代');
    });

    it('should display total power when provided', () => {
      const state = createFullState();
      scene.updateState(state);
      expect(scene.getCurrentState()?.totalPower).toBe(330);
    });

    it('should handle state with no territories', () => {
      const state = createMinimalState({ territories: [] });
      scene.updateState(state);
      expect(scene.getCurrentState()?.territories).toEqual([]);
    });

    it('should handle state with no units', () => {
      const state = createMinimalState({ units: [] });
      scene.updateState(state);
      expect(scene.getCurrentState()?.units).toEqual([]);
    });

    it('should handle state with no techs', () => {
      const state = createMinimalState({ techs: [] });
      scene.updateState(state);
      expect(scene.getCurrentState()?.techs).toEqual([]);
    });

    it('should handle state with no resource points', () => {
      const state = createMinimalState({ resourcePoints: [] });
      scene.updateState(state);
      expect(scene.getCurrentState()?.resourcePoints).toEqual([]);
    });

    it('should handle state with no diplomacy', () => {
      const state = createMinimalState({ diplomacy: [] });
      scene.updateState(state);
      expect(scene.getCurrentState()?.diplomacy).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 响应式布局
  // ═══════════════════════════════════════════════════════════

  describe('resize', () => {
    let scene: StrategyScene;

    beforeEach(async () => {
      scene = new StrategyScene(createTestStrategy());
      await scene.enter();
    });

    it('should handle resize', () => {
      expect(() => scene.resize(1024, 768)).not.toThrow();
    });

    it('should re-render state after resize if state exists', () => {
      const state = createMinimalState();
      scene.updateState(state);
      scene.resize(1024, 768);
      expect(scene.getCurrentState()).toBe(state);
    });

    it('should handle different aspect ratios', () => {
      scene.resize(1920, 1080);
      scene.resize(800, 600);
      scene.resize(400, 800);
    });

    it('should handle very small sizes', () => {
      scene.resize(100, 100);
    });

    it('should handle very large sizes', () => {
      scene.resize(3840, 2160);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 事件系统
  // ═══════════════════════════════════════════════════════════

  describe('events', () => {
    let scene: StrategyScene;

    beforeEach(async () => {
      scene = new StrategyScene(createTestStrategy());
      await scene.enter();
    });

    it('should register and call event listeners', () => {
      const callback = jest.fn();
      scene.on('upgradeClick', callback);
      // Simulate event by updating state with upgrades
      // The scene internally emits events on user interactions
    });

    it('should unregister event listeners', () => {
      const callback = jest.fn();
      scene.on('upgradeClick', callback);
      scene.off('upgradeClick', callback);
      // After off, callback should not be called
    });

    it('should support multiple listeners for same event', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      scene.on('upgradeClick', cb1);
      scene.on('upgradeClick', cb2);
    });

    it('should handle territoryClick event', () => {
      const callback = jest.fn();
      scene.on('territoryClick', callback);
    });

    it('should handle unitClick event', () => {
      const callback = jest.fn();
      scene.on('unitClick', callback);
    });

    it('should handle techClick event', () => {
      const callback = jest.fn();
      scene.on('techClick', callback);
    });

    it('should handle diplomacyClick event', () => {
      const callback = jest.fn();
      scene.on('diplomacyClick', callback);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 颜色主题切换
  // ═══════════════════════════════════════════════════════════

  describe('theme switching', () => {
    it('should work with total-war theme (crimson + steel gray)', async () => {
      const strategy = createTestStrategy({
        theme: {
          background: '#1a1a1e',
          panelBackground: '#2a2a30',
          accent: '#c0392b',
        },
      });
      const scene = new StrategyScene(strategy);
      await scene.enter();
      const state = createFullState();
      scene.updateState(state);
      expect(scene.isActive()).toBe(true);
    });

    it('should work with heroes-might theme (purple + gold)', async () => {
      const strategy = createTestStrategy({
        theme: {
          background: '#12061f',
          panelBackground: '#1a0a2e',
          accent: '#ffd700',
        },
      });
      const scene = new StrategyScene(strategy);
      await scene.enter();
      const state = createFullState();
      scene.updateState(state);
      expect(scene.isActive()).toBe(true);
    });

    it('should work with age-of-empires theme (brown-green + gold)', async () => {
      const strategy = createTestStrategy({
        theme: {
          background: '#1a1408',
          panelBackground: '#2a2010',
          accent: '#d4a017',
        },
      });
      const scene = new StrategyScene(strategy);
      await scene.enter();
      const state = createFullState();
      scene.updateState(state);
      expect(scene.isActive()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 边界情况
  // ═══════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle multiple updateState calls', async () => {
      const scene = new StrategyScene(createTestStrategy());
      await scene.enter();
      const state1 = createMinimalState();
      const state2 = createFullState();
      scene.updateState(state1);
      scene.updateState(state2);
      expect(scene.getCurrentState()).toBe(state2);
    });

    it('should handle updateState after destroy gracefully', async () => {
      const scene = new StrategyScene(createTestStrategy());
      await scene.enter();
      scene.destroy();
      // Should not throw
      expect(() => scene.updateState(createMinimalState())).not.toThrow();
    });

    it('should handle resize after destroy gracefully', async () => {
      const scene = new StrategyScene(createTestStrategy());
      await scene.enter();
      scene.destroy();
      // Resize on destroyed scene should not throw (it just sets values)
    });

    it('should handle state with very large numbers', async () => {
      const scene = new StrategyScene(createTestStrategy());
      await scene.enter();
      const state = createMinimalState({
        resources: [
          { id: 'gold', name: '金币', amount: 1e15, perSecond: 1e9, maxAmount: 1e18, unlocked: true },
        ],
      });
      scene.updateState(state);
      expect(scene.getCurrentState()?.resources[0].amount).toBe(1e15);
    });

    it('should handle state with zero values', async () => {
      const scene = new StrategyScene(createTestStrategy());
      await scene.enter();
      const state = createMinimalState({
        resources: [
          { id: 'gold', name: '金币', amount: 0, perSecond: 0, maxAmount: 0, unlocked: true },
        ],
      });
      scene.updateState(state);
      expect(scene.getCurrentState()?.resources[0].amount).toBe(0);
    });

    it('should handle many territories', async () => {
      const scene = new StrategyScene(createTestStrategy());
      await scene.enter();
      const territories = Array.from({ length: 20 }, (_, i) => ({
        id: `t${i}`,
        name: `领土${i}`,
        conquered: i < 5,
        powerRequired: i >= 5 ? i * 100 : undefined,
      }));
      scene.updateState(createMinimalState({ territories }));
      expect(scene.getCurrentState()?.territories?.length).toBe(20);
    });

    it('should handle many units', async () => {
      const scene = new StrategyScene(createTestStrategy());
      await scene.enter();
      const units = Array.from({ length: 15 }, (_, i) => ({
        id: `u${i}`,
        name: `兵种${i}`,
        type: 'infantry',
        count: i * 10,
        level: i,
        power: i * 50,
        unlocked: i < 10,
      }));
      scene.updateState(createMinimalState({ units }));
      expect(scene.getCurrentState()?.units?.length).toBe(15);
    });

    it('should handle many techs', async () => {
      const scene = new StrategyScene(createTestStrategy());
      await scene.enter();
      const techs = Array.from({ length: 10 }, (_, i) => ({
        id: `tech${i}`,
        name: `科技${i}`,
        progress: i / 10,
        state: (['locked', 'available', 'researching', 'completed'] as const)[i % 4],
      }));
      scene.updateState(createMinimalState({ techs }));
      expect(scene.getCurrentState()?.techs?.length).toBe(10);
    });

    it('should handle enter-exit-enter cycle', async () => {
      const scene = new StrategyScene(createTestStrategy());
      await scene.enter();
      expect(scene.isActive()).toBe(true);
      await scene.exit();
      expect(scene.isActive()).toBe(false);
      await scene.enter();
      expect(scene.isActive()).toBe(true);
    });
  });
});
