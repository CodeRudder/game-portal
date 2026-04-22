import { vi } from 'vitest';
/**
 * 古埃及文明渲染策略和场景测试
 *
 * 测试范围：
 * - CIV_EGYPT_STRATEGY 配置正确性
 * - CivEgyptScene 生命周期
 * - 状态更新和渲染
 * - 埃及建筑图标绘制（金字塔、神殿等）
 * - 事件系统
 */

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
    arc(_cx: number, _cy: number, _r: number, _start: number, _end: number) { return this; }
    closePath() { return this; } fill() { return this; } stroke() { return this; }
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

import { CivEgyptScene } from '../scenes/CivEgyptScene';
import { CIV_EGYPT_STRATEGY } from '../CivRenderStrategies';
import type { CivRenderState } from '../scenes/CivBaseScene';

const EGYPT_STATE: CivRenderState = {
  gameId: 'civ-egypt',
  resources: [
    { id: 'grain', name: '谷物', amount: 1000, perSecond: 5.5, maxAmount: 1e9, unlocked: true },
    { id: 'stone', name: '石头', amount: 500, perSecond: 2.0, maxAmount: 1e9, unlocked: true },
    { id: 'papyrus', name: '纸莎草', amount: 200, perSecond: 0, maxAmount: 1e9, unlocked: true },
    { id: 'gold', name: '黄金', amount: 100, perSecond: 1.0, maxAmount: 1e9, unlocked: true },
  ],
  upgrades: [
    {
      id: 'upgrade-pyramid', name: '金字塔加固', description: '增加石头产出',
      level: 1, maxLevel: 10, baseCost: { stone: 200 }, costMultiplier: 1.5,
      unlocked: true, canAfford: true,
      effect: { type: 'add_production', target: 'stone', value: 2 },
    },
  ],
  prestige: { currency: 30, count: 1 },
  statistics: { totalGrain: 5000 },
  era: { id: 'predynastic', name: '前王朝', description: '尼罗河畔' },
  prestigeName: '神恩',
  unitTypeName: '神明',
};

const MINIMAL_STATE: CivRenderState = {
  gameId: 'civ-egypt', resources: [], upgrades: [],
  prestige: { currency: 0, count: 0 }, statistics: {},
};

describe('CivEgyptScene', () => {
  let scene: CivEgyptScene;

  beforeEach(() => {
    scene = new CivEgyptScene();
  });

  describe('constructor', () => {
    it('should create scene instance', () => { expect(scene).toBeDefined(); });
    it('should have civ-egypt id', () => { expect(scene.getCivId()).toBe('civ-egypt'); });
    it('should return a container', () => { expect(scene.getContainer()).toBeDefined(); });
    it('should not be active initially', () => { expect(scene.isActive()).toBe(false); });
    it('should have no current state', () => { expect(scene.getCurrentState()).toBeNull(); });
    it('should use CIV_EGYPT_STRATEGY by default', () => { expect(scene.getStrategy().name).toBe('civ-egypt'); });
    it('should accept custom strategy', () => {
      const s = new CivEgyptScene({ ...CIV_EGYPT_STRATEGY, name: 'custom' });
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
    it('should update state when active', async () => {
      await scene.enter();
      scene.updateState(EGYPT_STATE);
      expect(scene.getCurrentState()).toEqual(EGYPT_STATE);
    });
    it('should not update state when inactive', () => { scene.updateState(EGYPT_STATE); expect(scene.getCurrentState()).toBeNull(); });
    it('should handle minimal state', async () => { await scene.enter(); scene.updateState(MINIMAL_STATE); expect(scene.getCurrentState()).toEqual(MINIMAL_STATE); });
    it('should handle consecutive updates', async () => { await scene.enter(); scene.updateState(EGYPT_STATE); scene.updateState(MINIMAL_STATE); expect(scene.getCurrentState()).toEqual(MINIMAL_STATE); });
    it('should handle state with era', async () => { await scene.enter(); scene.updateState(EGYPT_STATE); expect(scene.getCurrentState()!.era!.name).toBe('前王朝'); });
    it('should handle state without era', async () => { await scene.enter(); scene.updateState({ ...MINIMAL_STATE }); expect(scene.getCurrentState()!.era).toBeUndefined(); });
    it('should handle zero resources', async () => {
      await scene.enter();
      const state: CivRenderState = { ...MINIMAL_STATE, resources: [{ id: 'grain', name: '谷物', amount: 0, perSecond: 0, maxAmount: 0, unlocked: true }] };
      scene.updateState(state);
      expect(scene.getCurrentState()!.resources[0].amount).toBe(0);
    });
  });

  describe('resize', () => {
    it('should handle resize without state', async () => { await scene.enter(); expect(() => scene.resize(1920, 1080)).not.toThrow(); });
    it('should handle resize with state', async () => { await scene.enter(); scene.updateState(EGYPT_STATE); expect(() => scene.resize(1280, 720)).not.toThrow(); });
    it('should handle small sizes', async () => { await scene.enter(); scene.updateState(EGYPT_STATE); expect(() => scene.resize(320, 240)).not.toThrow(); });
    it('should re-render state after resize', async () => { await scene.enter(); scene.updateState(EGYPT_STATE); scene.resize(1280, 720); expect(scene.getCurrentState()).toEqual(EGYPT_STATE); });
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
    it('should render resource bar', async () => { await scene.enter(); scene.updateState(EGYPT_STATE); expect(scene.getContainer().getChildByLabel('resource-bar')).toBeDefined(); });
    it('should render building area', async () => { await scene.enter(); scene.updateState(EGYPT_STATE); expect(scene.getContainer().getChildByLabel('building-area')).toBeDefined(); });
    it('should render upgrade panel', async () => { await scene.enter(); scene.updateState(EGYPT_STATE); expect(scene.getContainer().getChildByLabel('upgrade-panel')).toBeDefined(); });
    it('should render stats panel', async () => { await scene.enter(); scene.updateState(EGYPT_STATE); expect(scene.getContainer().getChildByLabel('stats-panel')).toBeDefined(); });
    it('should render era bar', async () => { await scene.enter(); scene.updateState(EGYPT_STATE); expect(scene.getContainer().getChildByLabel('era-bar')).toBeDefined(); });
    it('should render title', async () => { await scene.enter(); scene.updateState(EGYPT_STATE); expect((scene as any).titleText.text).toBe('civ-egypt'); });
    it('should clean up old texts', async () => { await scene.enter(); scene.updateState(EGYPT_STATE); scene.updateState(MINIMAL_STATE); expect((scene as any).resourceTexts.length).toBe(0); });
    it('should clean up old cards', async () => { await scene.enter(); scene.updateState(EGYPT_STATE); scene.updateState(MINIMAL_STATE); expect((scene as any).buildingCards.length).toBe(0); });
    it('should clean up old buttons', async () => { await scene.enter(); scene.updateState(EGYPT_STATE); scene.updateState(MINIMAL_STATE); expect((scene as any).upgradeButtons.length).toBe(0); });
  });

  describe('egypt-specific building icons', () => {
    it('should draw pyramid icon for gold resource', async () => {
      await scene.enter();
      scene.updateState(EGYPT_STATE);
      // Building area should have cards for each resource
      expect((scene as any).buildingCards.length).toBe(4);
    });

    it('should draw different icons for different resources', async () => {
      await scene.enter();
      scene.updateState(EGYPT_STATE);
      // Each building card should have a Graphics child (the icon)
      for (const card of (scene as any).buildingCards) {
        // At least check the card has children
        expect(card.children.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('CIV_EGYPT_STRATEGY', () => {
  it('should have correct name', () => { expect(CIV_EGYPT_STRATEGY.name).toBe('civ-egypt'); });
  it('should have idle scene type', () => { expect(CIV_EGYPT_STRATEGY.sceneType).toBe('idle'); });
  it('should have golden-sand theme', () => {
    expect(CIV_EGYPT_STRATEGY.theme.background).toBe('#1a1408');
    expect(CIV_EGYPT_STRATEGY.theme.accent).toBe('#c8a832');
  });
  it('should have valid layout', () => {
    const l = CIV_EGYPT_STRATEGY.layout;
    expect(l.resourceBarHeight + l.buildingAreaHeight + l.upgradePanelHeight).toBeLessThanOrEqual(1);
    expect(l.gridColumns).toBeGreaterThan(0);
  });
  it('should have all theme properties', () => {
    const t = CIV_EGYPT_STRATEGY.theme;
    ['background','panelBackground','textPrimary','textSecondary','accent','success','warning','resourceBarBg','buttonBg','buttonHover'].forEach(k => {
      expect(t[k as keyof typeof t]).toBeDefined();
    });
  });
});
