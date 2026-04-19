/**
 * 华夏文明渲染策略和场景测试
 *
 * 测试范围：
 * - CIV_CHINA_STRATEGY 配置正确性
 * - CivChinaScene 生命周期
 * - 状态更新和渲染
 * - 中式建筑图标绘制
 * - 事件系统
 * - 策略注册
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock PixiJS ──────────────────────────────────────────

vi.mock('pixi.js', () => {
  class MockContainer {
    label: string;
    x = 0; y = 0; visible = true;
    scale = { set: vi.fn(), x: 1, y: 1 };
    position = { set: vi.fn((x: number, y: number) => { this.x = x; this.y = y; }) };
    children: any[] = [];
    parent: any = null;
    emit = vi.fn();
    on = vi.fn().mockReturnThis();
    off = vi.fn();
    once = vi.fn();
    eventMode: string = 'passive';
    cursor: string = 'default';

    constructor(opts?: { label?: string }) { this.label = opts?.label ?? ''; }
    addChild(child: any) { this.children.push(child); if (child) child.parent = this; }
    removeChild(child: any) { const i = this.children.indexOf(child); if (i >= 0) this.children.splice(i, 1); }
    removeChildren() { const old = [...this.children]; this.children.forEach((c) => { if (c) c.parent = null; }); this.children = []; return old; }
    getChildByLabel(label: string) { return this.children.find((c: any) => c.label === label) ?? null; }
    destroy(_opts?: any) { this.children = []; }
  }

  class MockGraphics {
    label = ''; x = 0; y = 0; visible = true; parent: any = null;
    position = { set: vi.fn() };
    emit = vi.fn(); on = vi.fn(); off = vi.fn();
    clear() { return this; }
    circle(_x: number, _y: number, _r: number) { return this; }
    rect(_x: number, _y: number, _w: number, _h: number) { return this; }
    ellipse(_x: number, _y: number, _rw: number, _rh: number) { return this; }
    moveTo(_x: number, _y: number) { return this; }
    lineTo(_x: number, _y: number) { return this; }
    bezierCurveTo(_cx1: number, _cy1: number, _cx2: number, _cy2: number, _x: number, _y: number) { return this; }
    arc(_cx: number, _cy: number, _r: number, _start: number, _end: number) { return this; }
    closePath() { return this; }
    fill(_c: any) { return this; }
    stroke(_s: any) { return this; }
    roundRect(_x: number, _y: number, _w: number, _h: number, _r: number) { return this; }
    destroy() {}
  }

  class MockText {
    label = ''; text: string;
    anchor = { set: vi.fn(), x: 0, y: 0 };
    x = 0; y = 0; width = 50; height = 14; visible = true; parent: any = null;
    position = { set: vi.fn((x: number, y: number) => { this.x = x; this.y = y; }) };
    emit = vi.fn(); on = vi.fn(); off = vi.fn();
    constructor(opts?: any) { this.text = opts?.text ?? ''; }
    destroy() {}
  }

  return { Container: MockContainer, Graphics: MockGraphics, Text: MockText };
});

import { CivChinaScene } from '../scenes/CivChinaScene';
import { CIV_CHINA_STRATEGY, CIV_STRATEGIES, registerCivStrategies } from '../CivRenderStrategies';
import { RenderStrategyRegistry } from '../RenderStrategyRegistry';
import type { CivRenderState } from '../scenes/CivBaseScene';

// ═══════════════════════════════════════════════════════════════
// 测试数据
// ═══════════════════════════════════════════════════════════════

const CHINA_STATE: CivRenderState = {
  gameId: 'civ-china',
  resources: [
    { id: 'food', name: '粮食', amount: 1000, perSecond: 5.5, maxAmount: 1e9, unlocked: true },
    { id: 'silk', name: '丝绸', amount: 500, perSecond: 2.0, maxAmount: 1e9, unlocked: true },
    { id: 'culture', name: '文化', amount: 200, perSecond: 0, maxAmount: 1e9, unlocked: true },
  ],
  upgrades: [
    {
      id: 'upgrade-farm', name: '农田升级', description: '增加粮食产出',
      level: 2, maxLevel: 10, baseCost: { food: 100 }, costMultiplier: 1.5,
      unlocked: true, canAfford: true,
      effect: { type: 'add_production', target: 'food', value: 1 },
    },
  ],
  prestige: { currency: 50, count: 2 },
  statistics: { totalFood: 10000, totalUpgrades: 5 },
  era: { id: 'xia', name: '夏朝', description: '大禹治水' },
  prestigeName: '天命',
  unitTypeName: '官员',
};

const MINIMAL_STATE: CivRenderState = {
  gameId: 'civ-china',
  resources: [],
  upgrades: [],
  prestige: { currency: 0, count: 0 },
  statistics: {},
};

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('CivChinaScene', () => {
  let scene: CivChinaScene;

  beforeEach(() => {
    scene = new CivChinaScene();
  });

  // ─── 构造函数 ─────────────────────────────────────────────

  describe('constructor', () => {
    it('should create scene instance', () => {
      expect(scene).toBeDefined();
    });

    it('should have civ-china id', () => {
      expect(scene.getCivId()).toBe('civ-china');
    });

    it('should return a container', () => {
      expect(scene.getContainer()).toBeDefined();
    });

    it('should not be active initially', () => {
      expect(scene.isActive()).toBe(false);
    });

    it('should have no current state initially', () => {
      expect(scene.getCurrentState()).toBeNull();
    });

    it('should use CIV_CHINA_STRATEGY by default', () => {
      expect(scene.getStrategy().name).toBe('civ-china');
    });

    it('should accept custom strategy', () => {
      const customStrategy = { ...CIV_CHINA_STRATEGY, name: 'custom-china' };
      const customScene = new CivChinaScene(customStrategy);
      expect(customScene.getStrategy().name).toBe('custom-china');
      customScene.destroy();
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
      scene.on('upgradeClick', vi.fn());
      scene.destroy();
      expect((scene as any).listeners.size).toBe(0);
    });
  });

  // ─── 状态更新 ─────────────────────────────────────────────

  describe('updateState', () => {
    it('should update state when active', async () => {
      await scene.enter();
      scene.updateState(CHINA_STATE);
      expect(scene.getCurrentState()).toEqual(CHINA_STATE);
    });

    it('should not update state when inactive', () => {
      scene.updateState(CHINA_STATE);
      expect(scene.getCurrentState()).toBeNull();
    });

    it('should handle minimal state', async () => {
      await scene.enter();
      scene.updateState(MINIMAL_STATE);
      expect(scene.getCurrentState()).toEqual(MINIMAL_STATE);
    });

    it('should handle consecutive updates', async () => {
      await scene.enter();
      scene.updateState(CHINA_STATE);
      scene.updateState(MINIMAL_STATE);
      expect(scene.getCurrentState()).toEqual(MINIMAL_STATE);
    });

    it('should handle state with era info', async () => {
      await scene.enter();
      scene.updateState(CHINA_STATE);
      expect(scene.getCurrentState()!.era).toBeDefined();
      expect(scene.getCurrentState()!.era!.name).toBe('夏朝');
    });

    it('should handle state without era info', async () => {
      await scene.enter();
      const state = { ...MINIMAL_STATE };
      scene.updateState(state);
      expect(scene.getCurrentState()!.era).toBeUndefined();
    });

    it('should handle large numbers', async () => {
      await scene.enter();
      const state: CivRenderState = {
        gameId: 'civ-china',
        resources: [
          { id: 'food', name: '粮食', amount: 1e15, perSecond: 1e9, maxAmount: Infinity, unlocked: true },
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
      scene.updateState(CHINA_STATE);
      expect(() => scene.resize(1280, 720)).not.toThrow();
    });

    it('should handle small sizes', async () => {
      await scene.enter();
      scene.updateState(CHINA_STATE);
      expect(() => scene.resize(320, 240)).not.toThrow();
    });

    it('should re-render state after resize', async () => {
      await scene.enter();
      scene.updateState(CHINA_STATE);
      scene.resize(1280, 720);
      expect(scene.getCurrentState()).toEqual(CHINA_STATE);
    });
  });

  // ─── 事件系统 ─────────────────────────────────────────────

  describe('events', () => {
    it('should register event listeners', () => {
      const cb = vi.fn();
      scene.on('upgradeClick', cb);
      expect((scene as any).listeners.has('upgradeClick')).toBe(true);
    });

    it('should unregister event listeners', () => {
      const cb = vi.fn();
      scene.on('upgradeClick', cb);
      scene.off('upgradeClick', cb);
      expect((scene as any).listeners.get('upgradeClick')?.size).toBe(0);
    });

    it('should call listeners on emit', () => {
      const cb = vi.fn();
      scene.on('upgradeClick', cb);
      (scene as any).emit('upgradeClick', 'upgrade-1');
      expect(cb).toHaveBeenCalledWith('upgrade-1');
    });

    it('should support multiple listeners', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      scene.on('upgradeClick', cb1);
      scene.on('upgradeClick', cb2);
      (scene as any).emit('upgradeClick', 'id');
      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    it('should not throw on emit with no listeners', () => {
      expect(() => (scene as any).emit('nonexistent')).not.toThrow();
    });

    it('should catch errors in listeners', () => {
      const badCb = vi.fn(() => { throw new Error('test'); });
      scene.on('upgradeClick', badCb);
      expect(() => (scene as any).emit('upgradeClick', 'id')).not.toThrow();
    });
  });

  // ─── 渲染验证 ─────────────────────────────────────────────

  describe('rendering', () => {
    it('should render resource bar', async () => {
      await scene.enter();
      scene.updateState(CHINA_STATE);
      const container = scene.getContainer();
      const resourceBar = container.getChildByLabel('resource-bar');
      expect(resourceBar).toBeDefined();
    });

    it('should render building area', async () => {
      await scene.enter();
      scene.updateState(CHINA_STATE);
      const container = scene.getContainer();
      const buildingArea = container.getChildByLabel('building-area');
      expect(buildingArea).toBeDefined();
    });

    it('should render upgrade panel', async () => {
      await scene.enter();
      scene.updateState(CHINA_STATE);
      const container = scene.getContainer();
      const upgradePanel = container.getChildByLabel('upgrade-panel');
      expect(upgradePanel).toBeDefined();
    });

    it('should render stats panel', async () => {
      await scene.enter();
      scene.updateState(CHINA_STATE);
      const container = scene.getContainer();
      const statsPanel = container.getChildByLabel('stats-panel');
      expect(statsPanel).toBeDefined();
    });

    it('should render era bar', async () => {
      await scene.enter();
      scene.updateState(CHINA_STATE);
      const container = scene.getContainer();
      const eraBar = container.getChildByLabel('era-bar');
      expect(eraBar).toBeDefined();
    });

    it('should render title', async () => {
      await scene.enter();
      scene.updateState(CHINA_STATE);
      expect((scene as any).titleText.text).toBe('civ-china');
    });

    it('should clean up old texts on re-render', async () => {
      await scene.enter();
      scene.updateState(CHINA_STATE);
      scene.updateState(MINIMAL_STATE);
      expect((scene as any).resourceTexts.length).toBe(0);
    });

    it('should clean up old building cards', async () => {
      await scene.enter();
      scene.updateState(CHINA_STATE);
      scene.updateState(MINIMAL_STATE);
      expect((scene as any).buildingCards.length).toBe(0);
    });

    it('should clean up old upgrade buttons', async () => {
      await scene.enter();
      scene.updateState(CHINA_STATE);
      scene.updateState(MINIMAL_STATE);
      expect((scene as any).upgradeButtons.length).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 策略测试
// ═══════════════════════════════════════════════════════════════

describe('CIV_CHINA_STRATEGY', () => {
  it('should have correct name', () => {
    expect(CIV_CHINA_STRATEGY.name).toBe('civ-china');
  });

  it('should have idle scene type', () => {
    expect(CIV_CHINA_STRATEGY.sceneType).toBe('idle');
  });

  it('should have red-gold theme colors', () => {
    expect(CIV_CHINA_STRATEGY.theme.background).toBe('#1a0a0a');
    expect(CIV_CHINA_STRATEGY.theme.accent).toBe('#d4a017');
  });

  it('should have valid layout proportions', () => {
    const l = CIV_CHINA_STRATEGY.layout;
    expect(l.resourceBarHeight + l.buildingAreaHeight + l.upgradePanelHeight).toBeLessThanOrEqual(1);
    expect(l.statsPanelWidth).toBeLessThanOrEqual(1);
    expect(l.gridColumns).toBeGreaterThan(0);
    expect(l.gridGap).toBeGreaterThan(0);
    expect(l.padding).toBeGreaterThan(0);
    expect(l.borderRadius).toBeGreaterThanOrEqual(0);
  });

  it('should have all theme properties', () => {
    const t = CIV_CHINA_STRATEGY.theme;
    expect(t.background).toBeDefined();
    expect(t.panelBackground).toBeDefined();
    expect(t.textPrimary).toBeDefined();
    expect(t.textSecondary).toBeDefined();
    expect(t.accent).toBeDefined();
    expect(t.success).toBeDefined();
    expect(t.warning).toBeDefined();
    expect(t.resourceBarBg).toBeDefined();
    expect(t.buttonBg).toBeDefined();
    expect(t.buttonHover).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// 策略注册测试
// ═══════════════════════════════════════════════════════════════

describe('Civ Strategy Registration', () => {
  it('should have civ-china in CIV_STRATEGIES', () => {
    expect(CIV_STRATEGIES['civ-china']).toBeDefined();
    expect(CIV_STRATEGIES['civ-china'].name).toBe('civ-china');
  });

  it('should register all civ strategies', async () => {
    await registerCivStrategies();
    expect(RenderStrategyRegistry.hasStrategy('civ-china')).toBe(true);
    expect(RenderStrategyRegistry.hasStrategy('civ-egypt')).toBe(true);
    expect(RenderStrategyRegistry.hasStrategy('civ-babylon')).toBe(true);
    expect(RenderStrategyRegistry.hasStrategy('civ-india')).toBe(true);
  });

  it('should register game mappings', async () => {
    await registerCivStrategies();
    expect(RenderStrategyRegistry.hasGameMapping('civ-china')).toBe(true);
    expect(RenderStrategyRegistry.hasGameMapping('civ-egypt')).toBe(true);
    expect(RenderStrategyRegistry.hasGameMapping('civ-babylon')).toBe(true);
    expect(RenderStrategyRegistry.hasGameMapping('civ-india')).toBe(true);
  });

  it('should return civ-china strategy from registry', async () => {
    await registerCivStrategies();
    const strategy = RenderStrategyRegistry.get('civ-china');
    expect(strategy.name).toBe('civ-china');
  });

  it('should have 4 civ strategies in total', () => {
    expect(Object.keys(CIV_STRATEGIES).length).toBe(4);
  });
});
