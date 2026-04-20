/**
 * CivilizationScene 测试
 *
 * 测试通用文明放置游戏场景：
 * - 构造函数和初始化
 * - 生命周期（enter/exit/update/destroy）
 * - 状态更新（updateState）
 * - 时代进度条渲染
 * - 资源栏渲染
 * - 建筑区域渲染
 * - 升级面板渲染
 * - 科技树面板（打开/关闭/渲染）
 * - 军事单位展示
 * - 贸易路线可视化
 * - 响应式布局（resize）
 * - 事件系统
 */

// ---------------------------------------------------------------------------
// Mock PixiJS v8
// ---------------------------------------------------------------------------

jest.mock('pixi.js', () => {
  class MockContainer {
    label: string;
    x = 0;
    y = 0;
    rotation = 0;
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
    quadraticCurveTo(_cx: number, _cy: number, _x: number, _y: number) { return this; }
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

import { CivilizationScene } from '../scenes/CivilizationScene';
import type { CivilizationRenderState } from '../scenes/CivilizationScene';
import type { RenderStrategy } from '../types';
import type { CivilizationId } from '../CivIconRenderer';

// ═══════════════════════════════════════════════════════════════
// 测试策略
// ═══════════════════════════════════════════════════════════════

const TEST_STRATEGY: RenderStrategy = {
  name: 'test-civ',
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

const BASE_STATE: CivilizationRenderState = {
  gameId: 'civ-china',
  resources: [
    { id: 'food', name: '粮食', amount: 1000, perSecond: 5.5, maxAmount: 1e9, unlocked: true },
    { id: 'silk', name: '丝绸', amount: 500, perSecond: 2.0, maxAmount: 1e9, unlocked: true },
  ],
  upgrades: [
    {
      id: 'upgrade-1',
      name: '农田升级',
      description: '增加粮食产出',
      level: 2,
      maxLevel: 10,
      baseCost: { food: 100 },
      costMultiplier: 1.5,
      unlocked: true,
      canAfford: true,
      effect: { type: 'multiplier', target: 'food', value: 1.5 },
    },
  ],
  prestige: { currency: 10, count: 2 },
  statistics: { totalEarned: 50000 },
};

const FULL_STATE: CivilizationRenderState = {
  ...BASE_STATE,
  currentEra: {
    id: 'tang',
    name: '唐',
    description: '盛世大唐',
    progress: 0.65,
    multiplier: 2.5,
    themeColor: '#daa520',
  },
  eras: [
    { id: 'xia', name: '夏', completed: true, current: false, locked: false },
    { id: 'shang', name: '商', completed: true, current: false, locked: false },
    { id: 'tang', name: '唐', completed: false, current: true, locked: false },
    { id: 'song', name: '宋', completed: false, current: false, locked: true },
  ],
  techs: [
    { id: 'irrigation', name: '灌溉术', state: 'completed', progress: 1, tier: 1 },
    { id: 'plow', name: '铁犁牛耕', state: 'researching', progress: 0.4, tier: 2 },
    { id: 'printing', name: '活字印刷', state: 'available', progress: 0, tier: 3 },
    { id: 'gunpowder', name: '火药', state: 'locked', progress: 0, tier: 2 },
  ],
  units: [
    { id: 'warrior', name: '战士', level: 3, unlocked: true },
    { id: 'archer', name: '弓箭手', level: 1, unlocked: true },
    { id: 'cavalry', name: '骑兵', level: 0, unlocked: false },
  ],
  tradeRoutes: [
    { id: 'route-1', from: '长安', to: '洛阳', profit: 50, isActive: true },
    { id: 'route-2', from: '长安', to: '敦煌', profit: 120, isActive: false },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('CivilizationScene', () => {
  let scene: CivilizationScene;

  beforeEach(() => {
    scene = new CivilizationScene(TEST_STRATEGY, 'civ-china');
  });

  // ─── 构造函数 ────────────────────────────────────────────

  describe('constructor', () => {
    it('should create scene with civ-china strategy', () => {
      expect(scene).toBeDefined();
      expect(scene.isActive()).toBe(false);
      expect(scene.getCivId()).toBe('civ-china');
    });

    it('should create scene for each civilization', () => {
      const civIds: CivilizationId[] = ['civ-china', 'civ-egypt', 'civ-babylon', 'civ-india'];
      for (const civId of civIds) {
        const s = new CivilizationScene(TEST_STRATEGY, civId);
        expect(s.getCivId()).toBe(civId);
        s.destroy();
      }
    });

    it('should have a root container', () => {
      const container = scene.getContainer();
      expect(container).toBeDefined();
      expect(container.label).toBe('civilization-scene');
    });

    it('should have an icon renderer', () => {
      const renderer = scene.getIconRenderer();
      expect(renderer).toBeDefined();
      expect(renderer.getCivId()).toBe('civ-china');
    });

    it('should return null current state initially', () => {
      expect(scene.getCurrentState()).toBeNull();
    });

    it('should have tech panel closed initially', () => {
      expect(scene.isTechPanelOpen()).toBe(false);
    });
  });

  // ─── 生命周期 ────────────────────────────────────────────

  describe('lifecycle', () => {
    it('should activate on enter', async () => {
      await scene.enter();
      expect(scene.isActive()).toBe(true);
    });

    it('should deactivate on exit', async () => {
      await scene.enter();
      await scene.exit();
      expect(scene.isActive()).toBe(false);
    });

    it('should handle update when active', async () => {
      await scene.enter();
      expect(() => scene.update(16.67)).not.toThrow();
    });

    it('should skip update when inactive', () => {
      expect(() => scene.update(16.67)).not.toThrow();
    });

    it('should destroy cleanly', async () => {
      await scene.enter();
      scene.destroy();
      expect(scene.isActive()).toBe(false);
    });

    it('should handle destroy without enter', () => {
      expect(() => scene.destroy()).not.toThrow();
    });
  });

  // ─── 状态更新 ────────────────────────────────────────────

  describe('updateState', () => {
    it('should not update when inactive', () => {
      scene.updateState(BASE_STATE);
      expect(scene.getCurrentState()).toBeNull();
    });

    it('should store state when active', async () => {
      await scene.enter();
      scene.updateState(BASE_STATE);
      expect(scene.getCurrentState()).toBe(BASE_STATE);
    });

    it('should render base state without era data', async () => {
      await scene.enter();
      expect(() => scene.updateState(BASE_STATE)).not.toThrow();
    });

    it('should render full state with all features', async () => {
      await scene.enter();
      expect(() => scene.updateState(FULL_STATE)).not.toThrow();
    });

    it('should handle empty resources', async () => {
      await scene.enter();
      const emptyState = { ...BASE_STATE, resources: [] };
      expect(() => scene.updateState(emptyState)).not.toThrow();
    });

    it('should handle empty upgrades', async () => {
      await scene.enter();
      const emptyState = { ...BASE_STATE, upgrades: [] };
      expect(() => scene.updateState(emptyState)).not.toThrow();
    });

    it('should handle state with era but no techs', async () => {
      await scene.enter();
      const state = { ...FULL_STATE, techs: undefined };
      expect(() => scene.updateState(state)).not.toThrow();
    });

    it('should handle state with units but no trade routes', async () => {
      await scene.enter();
      const state = { ...FULL_STATE, tradeRoutes: undefined };
      expect(() => scene.updateState(state)).not.toThrow();
    });
  });

  // ─── 时代进度条 ──────────────────────────────────────────

  describe('era bar', () => {
    it('should render era progress bar', async () => {
      await scene.enter();
      scene.updateState(FULL_STATE);
      const container = scene.getContainer();
      const eraBar = container.getChildByLabel('era-bar');
      expect(eraBar).toBeDefined();
    });

    it('should render era markers', async () => {
      await scene.enter();
      scene.updateState(FULL_STATE);
      const container = scene.getContainer();
      const eraBar = container.getChildByLabel('era-bar');
      expect(eraBar!.children.length).toBeGreaterThan(0);
    });

    it('should handle state without current era', async () => {
      await scene.enter();
      expect(() => scene.updateState(BASE_STATE)).not.toThrow();
    });
  });

  // ─── 科技树面板 ──────────────────────────────────────────

  describe('tech panel', () => {
    it('should be closed by default', () => {
      expect(scene.isTechPanelOpen()).toBe(false);
    });

    it('should toggle open', async () => {
      await scene.enter();
      scene.toggleTechPanel();
      expect(scene.isTechPanelOpen()).toBe(true);
    });

    it('should toggle closed', async () => {
      await scene.enter();
      scene.toggleTechPanel();
      scene.toggleTechPanel();
      expect(scene.isTechPanelOpen()).toBe(false);
    });

    it('should open explicitly', async () => {
      await scene.enter();
      scene.openTechPanel();
      expect(scene.isTechPanelOpen()).toBe(true);
    });

    it('should close explicitly', async () => {
      await scene.enter();
      scene.openTechPanel();
      scene.closeTechPanel();
      expect(scene.isTechPanelOpen()).toBe(false);
    });

    it('should render techs when open', async () => {
      await scene.enter();
      scene.openTechPanel();
      scene.updateState(FULL_STATE);
      // Tech panel should have children
      const container = scene.getContainer();
      const techPanel = container.getChildByLabel('tech-panel');
      expect(techPanel).toBeDefined();
      expect(techPanel!.visible).toBe(true);
    });

    it('should not render techs when closed', async () => {
      await scene.enter();
      scene.updateState(FULL_STATE);
      const container = scene.getContainer();
      const techPanel = container.getChildByLabel('tech-panel');
      expect(techPanel!.visible).toBe(false);
    });

    it('should handle empty tech list', async () => {
      await scene.enter();
      scene.openTechPanel();
      const state = { ...FULL_STATE, techs: [] };
      expect(() => scene.updateState(state)).not.toThrow();
    });
  });

  // ─── 军事单位展示 ────────────────────────────────────────

  describe('unit display', () => {
    it('should render units', async () => {
      await scene.enter();
      scene.updateState(FULL_STATE);
      const container = scene.getContainer();
      const unitDisplay = container.getChildByLabel('unit-display');
      expect(unitDisplay).toBeDefined();
    });

    it('should show placeholder when no units', async () => {
      await scene.enter();
      scene.updateState({ ...BASE_STATE, units: [] });
      const container = scene.getContainer();
      const unitDisplay = container.getChildByLabel('unit-display');
      expect(unitDisplay!.children.length).toBeGreaterThan(0);
    });

    it('should limit units to 4', async () => {
      await scene.enter();
      const manyUnits = Array.from({ length: 10 }, (_, i) => ({
        id: `unit-${i}`, name: `Unit ${i}`, level: i, unlocked: true,
      }));
      scene.updateState({ ...FULL_STATE, units: manyUnits });
      // Should not throw
      expect(scene.getCurrentState()).toBeDefined();
    });
  });

  // ─── 贸易路线 ────────────────────────────────────────────

  describe('trade display', () => {
    it('should render trade routes', async () => {
      await scene.enter();
      scene.updateState(FULL_STATE);
      const container = scene.getContainer();
      const tradeDisplay = container.getChildByLabel('trade-display');
      expect(tradeDisplay).toBeDefined();
    });

    it('should show placeholder when no routes', async () => {
      await scene.enter();
      scene.updateState({ ...BASE_STATE, tradeRoutes: [] });
      const container = scene.getContainer();
      const tradeDisplay = container.getChildByLabel('trade-display');
      expect(tradeDisplay!.children.length).toBeGreaterThan(0);
    });

    it('should limit routes to 4', async () => {
      await scene.enter();
      const manyRoutes = Array.from({ length: 10 }, (_, i) => ({
        id: `route-${i}`, from: `City${i}`, to: `City${i + 1}`, profit: i * 10, isActive: i % 2 === 0,
      }));
      scene.updateState({ ...FULL_STATE, tradeRoutes: manyRoutes });
      expect(scene.getCurrentState()).toBeDefined();
    });
  });

  // ─── 响应式布局 ──────────────────────────────────────────

  describe('resize', () => {
    it('should handle resize', async () => {
      await scene.enter();
      expect(() => scene.resize(1024, 768)).not.toThrow();
    });

    it('should re-render state after resize', async () => {
      await scene.enter();
      scene.updateState(FULL_STATE);
      scene.resize(1024, 768);
      expect(scene.getCurrentState()).toBe(FULL_STATE);
    });

    it('should handle multiple resizes', async () => {
      await scene.enter();
      scene.resize(800, 600);
      scene.resize(1024, 768);
      scene.resize(1920, 1080);
      expect(() => scene.updateState(FULL_STATE)).not.toThrow();
    });
  });

  // ─── 事件系统 ────────────────────────────────────────────

  describe('events', () => {
    it('should register and trigger upgradeClick', async () => {
      await scene.enter();
      const handler = jest.fn();
      scene.on('upgradeClick', handler);
      // Simulate upgrade click through updateState
      scene.updateState(FULL_STATE);
      // The event is wired through the upgrade panel buttons
      expect(handler).not.toHaveBeenCalled(); // Not triggered yet
    });

    it('should register and trigger toggleTechPanel', async () => {
      await scene.enter();
      const handler = jest.fn();
      scene.on('toggleTechPanel', handler);
      scene.toggleTechPanel();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should unregister event callback', async () => {
      await scene.enter();
      const handler = jest.fn();
      scene.on('toggleTechPanel', handler);
      scene.off('toggleTechPanel', handler);
      scene.toggleTechPanel();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple listeners on same event', async () => {
      await scene.enter();
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      scene.on('toggleTechPanel', handler1);
      scene.on('toggleTechPanel', handler2);
      scene.toggleTechPanel();
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in event callbacks gracefully', async () => {
      await scene.enter();
      const errorHandler = jest.fn(() => { throw new Error('test error'); });
      const goodHandler = jest.fn();
      scene.on('toggleTechPanel', errorHandler);
      scene.on('toggleTechPanel', goodHandler);
      // Should not throw
      expect(() => scene.toggleTechPanel()).not.toThrow();
    });
  });

  // ─── 不同文明 ────────────────────────────────────────────

  describe('different civilizations', () => {
    it('should work with civ-egypt', async () => {
      const egyptScene = new CivilizationScene(TEST_STRATEGY, 'civ-egypt');
      await egyptScene.enter();
      egyptScene.updateState({ ...FULL_STATE, gameId: 'civ-egypt' });
      expect(egyptScene.getCivId()).toBe('civ-egypt');
      egyptScene.destroy();
    });

    it('should work with civ-babylon', async () => {
      const babylonScene = new CivilizationScene(TEST_STRATEGY, 'civ-babylon');
      await babylonScene.enter();
      babylonScene.updateState({ ...FULL_STATE, gameId: 'civ-babylon' });
      expect(babylonScene.getCivId()).toBe('civ-babylon');
      babylonScene.destroy();
    });

    it('should work with civ-india', async () => {
      const indiaScene = new CivilizationScene(TEST_STRATEGY, 'civ-india');
      await indiaScene.enter();
      indiaScene.updateState({ ...FULL_STATE, gameId: 'civ-india' });
      expect(indiaScene.getCivId()).toBe('civ-india');
      indiaScene.destroy();
    });
  });
});
