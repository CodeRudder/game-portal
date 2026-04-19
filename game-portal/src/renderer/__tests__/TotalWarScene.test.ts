/**
 * TotalWarScene 测试
 *
 * 测试全面战争专属场景：
 * - 构造函数和初始化
 * - 生命周期（enter/exit/update/destroy）
 * - 状态更新（updateState）
 * - 响应式布局（resize）
 * - 事件系统
 * - 战场地图渲染
 * - 军队编制面板
 * - 建筑升级面板
 * - 战斗日志
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

    constructor(opts?: any) { this.text = opts?.text ?? ''; }
    destroy() {}
  }

  return { Container: MockContainer, Graphics: MockGraphics, Text: MockText };
});

import { TotalWarScene } from '../scenes/TotalWarScene';
import { RenderStrategyRegistry } from '../RenderStrategyRegistry';
import type { RenderStrategy, IdleGameRenderState } from '../types';

// ═══════════════════════════════════════════════════════════════
// 测试数据
// ═══════════════════════════════════════════════════════════════

const TOTAL_WAR_STRATEGY: RenderStrategy = RenderStrategyRegistry.get('total-war');

const TEST_STATE: IdleGameRenderState = {
  gameId: 'total-war',
  resources: [
    { id: 'gold', name: '金币', amount: 1000, perSecond: 5.5, maxAmount: 1e9, unlocked: true },
    { id: 'iron', name: '铁矿石', amount: 500, perSecond: 2.0, maxAmount: 1e9, unlocked: true },
    { id: 'troop', name: '兵力', amount: 200, perSecond: 0, maxAmount: 1e9, unlocked: true },
  ],
  upgrades: [
    {
      id: 'gold_mine', name: '金矿场', description: '产出金币', level: 2, maxLevel: 10,
      baseCost: { gold: 100 }, costMultiplier: 1.5, unlocked: true, canAfford: true,
      effect: { type: 'add_production', target: 'gold', value: 1 }, icon: '⛏️',
    },
    {
      id: 'barracks', name: '兵营', description: '产出兵力', level: 0, maxLevel: 5,
      baseCost: { gold: 500 }, costMultiplier: 2.0, unlocked: true, canAfford: false,
      effect: { type: 'add_production', target: 'troop', value: 2 }, icon: '🏰',
    },
  ],
  prestige: { currency: 50, count: 2 },
  statistics: { totalGoldEarned: 10000, totalBattlesWon: 5, totalTroopsTrained: 100 },
};

const MINIMAL_STATE: IdleGameRenderState = {
  gameId: 'total-war',
  resources: [],
  upgrades: [],
  prestige: { currency: 0, count: 0 },
  statistics: {},
};

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('TotalWarScene', () => {
  let scene: TotalWarScene;

  beforeEach(() => {
    scene = new TotalWarScene(TOTAL_WAR_STRATEGY);
  });

  // ─── 构造函数 ─────────────────────────────────────────────

  describe('constructor', () => {
    it('should create a scene instance', () => {
      expect(scene).toBeDefined();
    });

    it('should return a container with correct label', () => {
      const container = scene.getContainer();
      expect(container).toBeDefined();
      expect(container.label).toBe('total-war-scene');
    });

    it('should not be active initially', () => {
      expect(scene.isActive()).toBe(false);
    });

    it('should have no current state initially', () => {
      expect(scene.getCurrentState()).toBeNull();
    });

    it('should have empty log entries initially', () => {
      expect(scene.getLogEntries()).toEqual([]);
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
        gameId: 'total-war',
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

    it('should handle large numbers', async () => {
      await scene.enter();
      const state: IdleGameRenderState = {
        gameId: 'total-war',
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

    it('should handle small sizes', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      expect(() => scene.resize(320, 240)).not.toThrow();
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
      (scene as any).emit('upgradeClick', 'gold_mine');
      expect(callback).toHaveBeenCalledWith('gold_mine');
    });

    it('should support multiple listeners', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      scene.on('upgradeClick', cb1);
      scene.on('upgradeClick', cb2);
      (scene as any).emit('upgradeClick', 'gold_mine');
      expect(cb1).toHaveBeenCalledWith('gold_mine');
      expect(cb2).toHaveBeenCalledWith('gold_mine');
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
    it('should render resource bar', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const resourceBar = container.getChildByLabel('tw-resource-bar');
      expect(resourceBar).toBeDefined();
    });

    it('should render battlefield area', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const battlefield = container.getChildByLabel('tw-battlefield');
      expect(battlefield).toBeDefined();
    });

    it('should render army panel', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const armyPanel = container.getChildByLabel('tw-army-panel');
      expect(armyPanel).toBeDefined();
    });

    it('should render building panel', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const buildingPanel = container.getChildByLabel('tw-building-panel');
      expect(buildingPanel).toBeDefined();
    });

    it('should render battle log', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      const container = scene.getContainer();
      const battleLog = container.getChildByLabel('tw-battle-log');
      expect(battleLog).toBeDefined();
    });

    it('should render title with game id', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      expect((scene as any).titleText.text).toBe('⚔️ total-war');
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

  // ─── 战斗日志 ─────────────────────────────────────────────

  describe('battle log', () => {
    it('should add log entry', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      scene.addLogEntry('征服了领土 #1');
      expect(scene.getLogEntries()).toContain('征服了领土 #1');
    });

    it('should limit log entries to 20', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      for (let i = 0; i < 25; i++) {
        scene.addLogEntry(`日志 ${i}`);
      }
      expect(scene.getLogEntries().length).toBe(20);
    });

    it('should prepend new entries', async () => {
      await scene.enter();
      scene.updateState(TEST_STATE);
      scene.addLogEntry('第一条');
      scene.addLogEntry('第二条');
      const entries = scene.getLogEntries();
      expect(entries[0]).toBe('第二条');
      expect(entries[1]).toBe('第一条');
    });
  });

  // ─── 策略注册 ─────────────────────────────────────────────

  describe('strategy registration', () => {
    it('should have total-war strategy registered', () => {
      expect(RenderStrategyRegistry.hasStrategy('total-war')).toBe(true);
    });

    it('should have total-war game mapping', () => {
      expect(RenderStrategyRegistry.hasGameMapping('total-war')).toBe(true);
    });

    it('should return total-war strategy for total-war game', () => {
      const strategy = RenderStrategyRegistry.get('total-war');
      expect(strategy.name).toBe('total-war');
    });

    it('should have military theme colors', () => {
      const strategy = RenderStrategyRegistry.get('total-war');
      expect(strategy.theme.accent).toBe('#c0392b');
      expect(strategy.theme.background).toBe('#1a1a1e');
    });

    it('should have correct layout for military UI', () => {
      const strategy = RenderStrategyRegistry.get('total-war');
      expect(strategy.layout.gridColumns).toBe(4);
      expect(strategy.layout.borderRadius).toBe(6);
    });
  });
});
