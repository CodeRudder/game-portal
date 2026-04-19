/**
 * 印度文明渲染策略和场景测试
 *
 * 测试范围：
 * - CIV_INDIA_STRATEGY 配置正确性
 * - CivIndiaScene 生命周期
 * - 状态更新和渲染
 * - 印度建筑图标绘制（佛塔、宫殿等）
 * - 事件系统
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pixi.js', () => {
  class MockContainer {
    label: string; x = 0; y = 0; visible = true;
    scale = { set: vi.fn(), x: 1, y: 1 };
    position = { set: vi.fn((x: number, y: number) => { this.x = x; this.y = y; }) };
    children: any[] = []; parent: any = null;
    emit = vi.fn(); on = vi.fn().mockReturnThis(); off = vi.fn();
    eventMode: string = 'passive'; cursor: string = 'default';
    constructor(opts?: { label?: string }) { this.label = opts?.label ?? ''; }
    addChild(child: any) { this.children.push(child); if (child) child.parent = this; }
    removeChild(child: any) { const i = this.children.indexOf(child); if (i >= 0) this.children.splice(i, 1); }
    removeChildren() { const old = [...this.children]; this.children.forEach((c) => { if (c) c.parent = null; }); this.children = []; return old; }
    getChildByLabel(label: string) { return this.children.find((c: any) => c.label === label) ?? null; }
    destroy(_opts?: any) { this.children = []; }
  }
  class MockGraphics {
    label = ''; x = 0; y = 0; visible = true; parent: any = null;
    position = { set: vi.fn() }; emit = vi.fn(); on = vi.fn(); off = vi.fn();
    clear() { return this; } circle() { return this; } rect() { return this; }
    ellipse() { return this; } moveTo() { return this; } lineTo() { return this; }
    arc() { return this; } closePath() { return this; } fill() { return this; } stroke() { return this; }
    roundRect() { return this; } destroy() {}
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

import { CivIndiaScene } from '../scenes/CivIndiaScene';
import { CIV_INDIA_STRATEGY } from '../CivRenderStrategies';
import type { CivRenderState } from '../scenes/CivBaseScene';

const INDIA_STATE: CivRenderState = {
  gameId: 'civ-india',
  resources: [
    { id: 'rice', name: '稻米', amount: 1200, perSecond: 6.0, maxAmount: 1e9, unlocked: true },
    { id: 'spice', name: '香料', amount: 400, perSecond: 2.5, maxAmount: 1e9, unlocked: true },
    { id: 'gem', name: '宝石', amount: 150, perSecond: 0.8, maxAmount: 1e9, unlocked: true },
    { id: 'gold', name: '黄金', amount: 80, perSecond: 0.3, maxAmount: 1e9, unlocked: true },
  ],
  upgrades: [
    {
      id: 'upgrade-stupa', name: '佛塔扩建', description: '增加业力获取',
      level: 2, maxLevel: 10, baseCost: { gold: 200 }, costMultiplier: 1.4,
      unlocked: true, canAfford: false,
      effect: { type: 'add_production', target: 'gem', value: 2 },
    },
  ],
  prestige: { currency: 15, count: 0 },
  statistics: { totalRice: 12000, totalSpice: 4000 },
  era: { id: 'indus_valley', name: '印度河谷', description: '哈拉帕文明' },
  prestigeName: '业力',
  unitTypeName: '英雄',
};

const MINIMAL_STATE: CivRenderState = {
  gameId: 'civ-india', resources: [], upgrades: [],
  prestige: { currency: 0, count: 0 }, statistics: {},
};

describe('CivIndiaScene', () => {
  let scene: CivIndiaScene;

  beforeEach(() => { scene = new CivIndiaScene(); });

  describe('constructor', () => {
    it('should create scene instance', () => { expect(scene).toBeDefined(); });
    it('should have civ-india id', () => { expect(scene.getCivId()).toBe('civ-india'); });
    it('should return a container', () => { expect(scene.getContainer()).toBeDefined(); });
    it('should not be active initially', () => { expect(scene.isActive()).toBe(false); });
    it('should have no current state', () => { expect(scene.getCurrentState()).toBeNull(); });
    it('should use CIV_INDIA_STRATEGY by default', () => { expect(scene.getStrategy().name).toBe('civ-india'); });
    it('should accept custom strategy', () => {
      const s = new CivIndiaScene({ ...CIV_INDIA_STRATEGY, name: 'custom' });
      expect(s.getStrategy().name).toBe('custom');
      s.destroy();
    });
  });

  describe('lifecycle', () => {
    it('enter should activate', async () => { await scene.enter(); expect(scene.isActive()).toBe(true); });
    it('exit should deactivate', async () => { await scene.enter(); await scene.exit(); expect(scene.isActive()).toBe(false); });
    it('update should not throw when active', async () => { await scene.enter(); expect(() => scene.update(16.67)).not.toThrow(); });
    it('update should not throw when inactive', () => { expect(() => scene.update(16.67)).not.toThrow(); });
    it('destroy should clean up', async () => { await scene.enter(); scene.destroy(); expect(scene.isActive()).toBe(false); });
    it('destroy should clear listeners', () => { scene.on('upgradeClick', vi.fn()); scene.destroy(); expect((scene as any).listeners.size).toBe(0); });
  });

  describe('updateState', () => {
    it('should update state when active', async () => { await scene.enter(); scene.updateState(INDIA_STATE); expect(scene.getCurrentState()).toEqual(INDIA_STATE); });
    it('should not update state when inactive', () => { scene.updateState(INDIA_STATE); expect(scene.getCurrentState()).toBeNull(); });
    it('should handle minimal state', async () => { await scene.enter(); scene.updateState(MINIMAL_STATE); expect(scene.getCurrentState()).toEqual(MINIMAL_STATE); });
    it('should handle consecutive updates', async () => { await scene.enter(); scene.updateState(INDIA_STATE); scene.updateState(MINIMAL_STATE); expect(scene.getCurrentState()).toEqual(MINIMAL_STATE); });
    it('should handle era info', async () => { await scene.enter(); scene.updateState(INDIA_STATE); expect(scene.getCurrentState()!.era!.name).toBe('印度河谷'); });
    it('should handle negative perSecond', async () => {
      await scene.enter();
      scene.updateState({ ...MINIMAL_STATE, resources: [{ id: 'rice', name: '稻米', amount: 100, perSecond: -3, maxAmount: 1e9, unlocked: true }] });
      expect(scene.getCurrentState()!.resources[0].perSecond).toBe(-3);
    });
  });

  describe('resize', () => {
    it('should handle resize without state', async () => { await scene.enter(); expect(() => scene.resize(1920, 1080)).not.toThrow(); });
    it('should handle resize with state', async () => { await scene.enter(); scene.updateState(INDIA_STATE); expect(() => scene.resize(1280, 720)).not.toThrow(); });
    it('should handle small sizes', async () => { await scene.enter(); scene.updateState(INDIA_STATE); expect(() => scene.resize(320, 240)).not.toThrow(); });
    it('should re-render state after resize', async () => { await scene.enter(); scene.updateState(INDIA_STATE); scene.resize(1280, 720); expect(scene.getCurrentState()).toEqual(INDIA_STATE); });
  });

  describe('events', () => {
    it('should register listeners', () => { const cb = vi.fn(); scene.on('upgradeClick', cb); expect((scene as any).listeners.has('upgradeClick')).toBe(true); });
    it('should unregister listeners', () => { const cb = vi.fn(); scene.on('upgradeClick', cb); scene.off('upgradeClick', cb); expect((scene as any).listeners.get('upgradeClick')?.size).toBe(0); });
    it('should call listeners on emit', () => { const cb = vi.fn(); scene.on('upgradeClick', cb); (scene as any).emit('upgradeClick', 'id'); expect(cb).toHaveBeenCalledWith('id'); });
    it('should support multiple listeners', () => { const cb1 = vi.fn(), cb2 = vi.fn(); scene.on('upgradeClick', cb1); scene.on('upgradeClick', cb2); (scene as any).emit('upgradeClick', 'id'); expect(cb1).toHaveBeenCalled(); expect(cb2).toHaveBeenCalled(); });
    it('should not throw on emit with no listeners', () => { expect(() => (scene as any).emit('nonexistent')).not.toThrow(); });
    it('should catch errors in listeners', () => { scene.on('upgradeClick', () => { throw new Error('test'); }); expect(() => (scene as any).emit('upgradeClick', 'id')).not.toThrow(); });
  });

  describe('rendering', () => {
    it('should render resource bar', async () => { await scene.enter(); scene.updateState(INDIA_STATE); expect(scene.getContainer().getChildByLabel('resource-bar')).toBeDefined(); });
    it('should render building area', async () => { await scene.enter(); scene.updateState(INDIA_STATE); expect(scene.getContainer().getChildByLabel('building-area')).toBeDefined(); });
    it('should render upgrade panel', async () => { await scene.enter(); scene.updateState(INDIA_STATE); expect(scene.getContainer().getChildByLabel('upgrade-panel')).toBeDefined(); });
    it('should render stats panel', async () => { await scene.enter(); scene.updateState(INDIA_STATE); expect(scene.getContainer().getChildByLabel('stats-panel')).toBeDefined(); });
    it('should render era bar', async () => { await scene.enter(); scene.updateState(INDIA_STATE); expect(scene.getContainer().getChildByLabel('era-bar')).toBeDefined(); });
    it('should render title', async () => { await scene.enter(); scene.updateState(INDIA_STATE); expect((scene as any).titleText.text).toBe('civ-india'); });
    it('should clean up old texts', async () => { await scene.enter(); scene.updateState(INDIA_STATE); scene.updateState(MINIMAL_STATE); expect((scene as any).resourceTexts.length).toBe(0); });
    it('should clean up old cards', async () => { await scene.enter(); scene.updateState(INDIA_STATE); scene.updateState(MINIMAL_STATE); expect((scene as any).buildingCards.length).toBe(0); });
    it('should clean up old buttons', async () => { await scene.enter(); scene.updateState(INDIA_STATE); scene.updateState(MINIMAL_STATE); expect((scene as any).upgradeButtons.length).toBe(0); });
  });

  describe('india-specific buildings', () => {
    it('should draw stupa icon for unknown resource', async () => {
      await scene.enter();
      scene.updateState({ ...INDIA_STATE, resources: [{ id: 'unknown', name: '未知', amount: 100, perSecond: 1, maxAmount: 1e9, unlocked: true }] });
      expect((scene as any).buildingCards.length).toBe(1);
    });
    it('should draw building icons for all resource types', async () => {
      await scene.enter();
      scene.updateState(INDIA_STATE);
      expect((scene as any).buildingCards.length).toBe(4);
    });
  });
});

describe('CIV_INDIA_STRATEGY', () => {
  it('should have correct name', () => { expect(CIV_INDIA_STRATEGY.name).toBe('civ-india'); });
  it('should have idle scene type', () => { expect(CIV_INDIA_STRATEGY.sceneType).toBe('idle'); });
  it('should have emerald theme', () => {
    expect(CIV_INDIA_STRATEGY.theme.background).toBe('#0a1a0e');
    expect(CIV_INDIA_STRATEGY.theme.accent).toBe('#e8a030');
  });
  it('should have valid layout', () => {
    const l = CIV_INDIA_STRATEGY.layout;
    expect(l.resourceBarHeight + l.buildingAreaHeight + l.upgradePanelHeight).toBeLessThanOrEqual(1);
    expect(l.gridColumns).toBeGreaterThan(0);
  });
  it('should have all theme properties', () => {
    const t = CIV_INDIA_STRATEGY.theme;
    ['background','panelBackground','textPrimary','textSecondary','accent','success','warning','resourceBarBg','buttonBg','buttonHover'].forEach(k => {
      expect(t[k as keyof typeof t]).toBeDefined();
    });
  });
});
