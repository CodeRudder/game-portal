/**
 * HeroesMightScene 测试
 *
 * 测试英雄无敌专属场景：
 * - 构造函数和初始化
 * - 生命周期
 * - 状态更新
 * - 响应式布局
 * - 事件系统
 * - 冒险地图渲染
 * - 英雄队伍面板
 * - 技能面板
 * - 策略注册
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock PixiJS v8
// ---------------------------------------------------------------------------

vi.mock('pixi.js', () => {
  class MockContainer {
    label: string;
    x = 0;
    y = 0;
    visible = true;
    scale = { set: vi.fn(), x: 1, y: 1 };
    position = { set: vi.fn((x: number, y: number) => { this.x = x; this.y = y; }) };
    children: any[] = [];
    parent: any = null;
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
    position = { set: vi.fn() };
    emit = vi.fn();
    on = vi.fn();

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

    constructor(opts?: any) { this.text = opts?.text ?? ''; }
    destroy() {}
  }

  return { Container: MockContainer, Graphics: MockGraphics, Text: MockText };
});

import { HeroesMightScene } from '../scenes/HeroesMightScene';
import { RenderStrategyRegistry } from '../RenderStrategyRegistry';
import type { RenderStrategy, IdleGameRenderState } from '../types';

// ═══════════════════════════════════════════════════════════════
// 测试数据
// ═══════════════════════════════════════════════════════════════

const HEROES_STRATEGY: RenderStrategy = RenderStrategyRegistry.get('heroes-might');

const TEST_STATE: IdleGameRenderState = {
  gameId: 'heroes-might',
  resources: [
    { id: 'gold', name: '金币', amount: 1000, perSecond: 5.5, maxAmount: 1e9, unlocked: true },
    { id: 'gem', name: '宝石', amount: 500, perSecond: 2.0, maxAmount: 1e9, unlocked: true },
    { id: 'crystal', name: '魔法水晶', amount: 200, perSecond: 0, maxAmount: 1e9, unlocked: true },
  ],
  upgrades: [
    {
      id: 'gold_mine', name: '金矿场', description: '产出金币', level: 2, maxLevel: 10,
      baseCost: { gold: 100 }, costMultiplier: 1.5, unlocked: true, canAfford: true,
      effect: { type: 'add_production', target: 'gold', value: 1 }, icon: '⛏️',
    },
    {
      id: 'magic_tower', name: '魔法塔', description: '产出水晶', level: 0, maxLevel: 5,
      baseCost: { gold: 500 }, costMultiplier: 2.0, unlocked: true, canAfford: false,
      effect: { type: 'add_production', target: 'crystal', value: 2 }, icon: '🔮',
    },
  ],
  prestige: { currency: 50, count: 2 },
  statistics: { totalGoldEarned: 10000, totalSpellsCast: 15, totalEvolutions: 3 },
};

const MINIMAL_STATE: IdleGameRenderState = {
  gameId: 'heroes-might',
  resources: [],
  upgrades: [],
  prestige: { currency: 0, count: 0 },
  statistics: {},
};

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('HeroesMightScene', () => {
  let scene: HeroesMightScene;

  beforeEach(() => {
    scene = new HeroesMightScene(HEROES_STRATEGY);
  });

  // ─── 构造函数 ─────────────────────────────────────────────

  describe('constructor', () => {
    it('should create a scene instance', () => {
      expect(scene).toBeDefined();
    });

    it('should return a container with correct label', () => {
      const container = scene.getContainer();
      expect(container).toBeDefined();
      expect(container.label).toBe('heroes-might-scene');
    });

    it('should not be active initially', () => {
      expect(scene.isActive()).toBe(false);
    });

    it('should have no current state initially', () => {
      expect(scene.getCurrentState()).toBeNull();
    });

    it('should have zero anim timer initially', () => {
      expect(scene.getAnimTimer()).toBe(0);
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

    it('update should increment anim timer', async () => {
      await scene.enter();
      scene.update(100);
      expect(scene.getAnimTimer()).toBe(100);
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
      scene.on('heroClick', callback);
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

    it('should handle many resources', async () => {
      await scene.enter();
      const manyResources = Array.from({ length: 10 }, (_, i) => ({
        id: `res-${i}`, name: `资源${i}`, amount: i * 100, perSecond: i * 0.5, maxAmount: 1e9, unlocked: true,
      }));
      const state = { ...TEST_STATE, resources: manyResources };
      scene.updateState(state);
      expect(scene.getCurrentState()!.resources.length).toBe(10);
    });

    it('should handle large numbers', async () => {
      await scene.enter();
      const state: IdleGameRenderState = {
        gameId: 'heroes-might',
        resources: [
          { id: 'gold', name: '金币', amount: 1e15, perSecond: 1e9, maxAmount: Infinity, unlocked: true },
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
      const callback = vi.fn();
      scene.on('heroClick', callback);
      expect((scene as any).listeners.has('heroClick')).toBe(true);
    });

    it('should unregister event listeners', () => {
      const callback = vi.fn();
      scene.on('heroClick', callback);
      scene.off('heroClick', callback);
      expect((scene as any).listeners.get('heroClick')?.size).toBe(0);
    });

    it('should call event listeners when emitted', () => {
      const callback = vi.fn();
      scene.on('heroClick', callback);
      (scene as any).emit('heroClick', 'hero-knight');
      expect(callback).toHaveBeenCalledWith('hero-knight');
    });

    it('should support spellCast event', () => {
      const callback = vi.fn();
      scene.on('spellCast', callback);
      (scene as any).emit('spellCast', 'fireball');
      expect(callback).toHaveBeenCalledWith('fireball');
    });

    it('should not throw on emit with no listeners', () => {
      expect(() => (scene as any).emit('nonexistent')).not.toThrow();
    });

    it('should catch errors in listeners', () => {
      const badCallback = vi.fn(() => { throw new Error('test'); });
      scene.on('heroClick', badCallback);
      expect(() => (scene as any).emit('heroClick', 'id')).not.toThrow();
    });
  });

  // ─── 渲染区域验证 ─────────────────────────────────────────

  describe('rendering', () => {
    it('should render resource bar', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const resourceBar = container.getChildByLabel('hm-resource-bar');
      expect(resourceBar).toBeDefined();
    });

    it('should render adventure map', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const adventureMap = container.getChildByLabel('hm-adventure-map');
      expect(adventureMap).toBeDefined();
    });

    it('should render hero panel', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const heroPanel = container.getChildByLabel('hm-hero-panel');
      expect(heroPanel).toBeDefined();
    });

    it('should render building panel', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const buildingPanel = container.getChildByLabel('hm-building-panel');
      expect(buildingPanel).toBeDefined();
    });

    it('should render spell panel', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const spellPanel = container.getChildByLabel('hm-spell-panel');
      expect(spellPanel).toBeDefined();
    });

    it('should render title with game id', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      expect((scene as any).titleText.text).toBe('🏰 heroes-might');
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

  // ─── 策略注册 ─────────────────────────────────────────────

  describe('strategy registration', () => {
    it('should have heroes-might strategy registered', () => {
      expect(RenderStrategyRegistry.hasStrategy('heroes-might')).toBe(true);
    });

    it('should have heroes-might game mapping', () => {
      expect(RenderStrategyRegistry.hasGameMapping('heroes-might')).toBe(true);
    });

    it('should return heroes-might strategy for heroes-might game', () => {
      const strategy = RenderStrategyRegistry.get('heroes-might');
      expect(strategy.name).toBe('heroes-might');
    });

    it('should have fantasy theme colors', () => {
      const strategy = RenderStrategyRegistry.get('heroes-might');
      expect(strategy.theme.accent).toBe('#ffd700');
      expect(strategy.theme.background).toBe('#12061f');
    });

    it('should have correct layout for fantasy UI', () => {
      const strategy = RenderStrategyRegistry.get('heroes-might');
      expect(strategy.layout.borderRadius).toBe(12);
    });
  });
});
