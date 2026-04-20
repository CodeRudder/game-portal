/**
 * CivIconRenderer 测试
 *
 * 测试文明专属图标绘制器：
 * - 构造函数和初始化
 * - 各文明主题色
 * - 图标定义查询
 * - 图标绘制（每个文明）
 * - 图标缓存
 * - 静态方法
 * - 销毁和清理
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
    children: any[] = [];
    parent: any = null;
    position = { set: jest.fn() };
    emit = jest.fn();
    on = jest.fn();
    off = jest.fn();

    constructor(opts?: { label?: string }) { this.label = opts?.label ?? ''; }

    addChild(child: any) {
      this.children.push(child);
      if (child) child.parent = this;
    }
    removeChild(child: any) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
    }
    destroy(_opts?: any) { this.children = []; }
  }

  class MockGraphics {
    label = '';
    x = 0;
    y = 0;
    visible = true;
    parent: any = null;

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

  return { Container: MockContainer, Graphics: MockGraphics };
});

import { CivIconRenderer, type CivilizationId } from '../CivIconRenderer';

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('CivIconRenderer', () => {
  // ─── 构造函数 ────────────────────────────────────────────

  describe('constructor', () => {
    it('should create renderer for civ-china', () => {
      const r = new CivIconRenderer('civ-china');
      expect(r.getCivId()).toBe('civ-china');
      r.destroy();
    });

    it('should create renderer for civ-egypt', () => {
      const r = new CivIconRenderer('civ-egypt');
      expect(r.getCivId()).toBe('civ-egypt');
      r.destroy();
    });

    it('should create renderer for civ-babylon', () => {
      const r = new CivIconRenderer('civ-babylon');
      expect(r.getCivId()).toBe('civ-babylon');
      r.destroy();
    });

    it('should create renderer for civ-india', () => {
      const r = new CivIconRenderer('civ-india');
      expect(r.getCivId()).toBe('civ-india');
      r.destroy();
    });
  });

  // ─── 主题色 ──────────────────────────────────────────────

  describe('theme colors', () => {
    it('should return china theme colors', () => {
      const r = new CivIconRenderer('civ-china');
      const colors = r.getThemeColors();
      expect(colors.primary).toBe(0xcc2936);
      expect(colors.secondary).toBe(0xffd700);
      r.destroy();
    });

    it('should return egypt theme colors', () => {
      const r = new CivIconRenderer('civ-egypt');
      const colors = r.getThemeColors();
      expect(colors.primary).toBe(0xdaa520);
      expect(colors.secondary).toBe(0x1e90ff);
      r.destroy();
    });

    it('should return babylon theme colors', () => {
      const r = new CivIconRenderer('civ-babylon');
      const colors = r.getThemeColors();
      expect(colors.primary).toBe(0xcd7f32);
      expect(colors.secondary).toBe(0x9370db);
      r.destroy();
    });

    it('should return india theme colors', () => {
      const r = new CivIconRenderer('civ-india');
      const colors = r.getThemeColors();
      expect(colors.primary).toBe(0x2e8b57);
      expect(colors.secondary).toBe(0xff8c00);
      r.destroy();
    });

    it('should return a copy of theme colors', () => {
      const r = new CivIconRenderer('civ-china');
      const colors1 = r.getThemeColors();
      const colors2 = r.getThemeColors();
      expect(colors1).toEqual(colors2);
      expect(colors1).not.toBe(colors2);
      r.destroy();
    });
  });

  // ─── 图标定义 ────────────────────────────────────────────

  describe('icon definitions', () => {
    it('should return 10 icons for china', () => {
      const r = new CivIconRenderer('civ-china');
      const defs = r.getIconDefs();
      expect(defs.length).toBe(10);
      r.destroy();
    });

    it('should return 10 icons for egypt', () => {
      const r = new CivIconRenderer('civ-egypt');
      const defs = r.getIconDefs();
      expect(defs.length).toBe(10);
      r.destroy();
    });

    it('should return 10 icons for babylon', () => {
      const r = new CivIconRenderer('civ-babylon');
      const defs = r.getIconDefs();
      expect(defs.length).toBe(10);
      r.destroy();
    });

    it('should return 10 icons for india', () => {
      const r = new CivIconRenderer('civ-india');
      const defs = r.getIconDefs();
      expect(defs.length).toBe(10);
      r.destroy();
    });

    it('should filter icons by category building', () => {
      const r = new CivIconRenderer('civ-china');
      const buildings = r.getIconsByCategory('building');
      expect(buildings.length).toBeGreaterThan(0);
      buildings.forEach((d) => expect(d.category).toBe('building'));
      r.destroy();
    });

    it('should filter icons by category resource', () => {
      const r = new CivIconRenderer('civ-china');
      const resources = r.getIconsByCategory('resource');
      expect(resources.length).toBeGreaterThan(0);
      resources.forEach((d) => expect(d.category).toBe('resource'));
      r.destroy();
    });

    it('should filter icons by category unit', () => {
      const r = new CivIconRenderer('civ-china');
      const units = r.getIconsByCategory('unit');
      expect(units.length).toBeGreaterThan(0);
      units.forEach((d) => expect(d.category).toBe('unit'));
      r.destroy();
    });

    it('should check if icon exists', () => {
      const r = new CivIconRenderer('civ-china');
      expect(r.hasIcon('farm')).toBe(true);
      expect(r.hasIcon('nonexistent')).toBe(false);
      r.destroy();
    });
  });

  // ─── 华夏图标绘制 ────────────────────────────────────────

  describe('china icon drawing', () => {
    let renderer: CivIconRenderer;

    beforeEach(() => {
      renderer = new CivIconRenderer('civ-china');
    });

    afterEach(() => {
      renderer.destroy();
    });

    const chinaIcons = ['farm', 'silk_workshop', 'academy', 'great_wall', 'silk_road', 'imperial_palace', 'food', 'silk', 'culture', 'official'];

    it.each(chinaIcons)('should draw china icon: %s', (iconId) => {
      const container = renderer.drawIcon(iconId, 32);
      expect(container).toBeDefined();
      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should draw with default size', () => {
      const container = renderer.drawIcon('farm');
      expect(container).toBeDefined();
    });

    it('should draw with custom size', () => {
      const container = renderer.drawIcon('farm', 64);
      expect(container).toBeDefined();
    });

    it('should draw default for unknown icon', () => {
      const container = renderer.drawIcon('unknown_icon', 32);
      expect(container).toBeDefined();
    });
  });

  // ─── 埃及图标绘制 ────────────────────────────────────────

  describe('egypt icon drawing', () => {
    let renderer: CivIconRenderer;

    beforeEach(() => {
      renderer = new CivIconRenderer('civ-egypt');
    });

    afterEach(() => {
      renderer.destroy();
    });

    const egyptIcons = ['pyramid', 'obelisk', 'sphinx', 'temple', 'nile', 'tomb', 'grain', 'gold', 'papyrus', 'pharaoh'];

    it.each(egyptIcons)('should draw egypt icon: %s', (iconId) => {
      const container = renderer.drawIcon(iconId, 32);
      expect(container).toBeDefined();
      expect(container.children.length).toBeGreaterThan(0);
    });
  });

  // ─── 巴比伦图标绘制 ──────────────────────────────────────

  describe('babylon icon drawing', () => {
    let renderer: CivIconRenderer;

    beforeEach(() => {
      renderer = new CivIconRenderer('civ-babylon');
    });

    afterEach(() => {
      renderer.destroy();
    });

    const babylonIcons = ['hanging_gardens', 'gate', 'ziggurat', 'library', 'walls', 'canal', 'clay', 'bronze', 'knowledge', 'warrior'];

    it.each(babylonIcons)('should draw babylon icon: %s', (iconId) => {
      const container = renderer.drawIcon(iconId, 32);
      expect(container).toBeDefined();
      expect(container.children.length).toBeGreaterThan(0);
    });
  });

  // ─── 印度图标绘制 ────────────────────────────────────────

  describe('india icon drawing', () => {
    let renderer: CivIconRenderer;

    beforeEach(() => {
      renderer = new CivIconRenderer('civ-india');
    });

    afterEach(() => {
      renderer.destroy();
    });

    const indiaIcons = ['taj_mahal', 'temple', 'stepwell', 'fort', 'market', 'palace', 'spice', 'cotton', 'faith', 'elephant'];

    it.each(indiaIcons)('should draw india icon: %s', (iconId) => {
      const container = renderer.drawIcon(iconId, 32);
      expect(container).toBeDefined();
      expect(container.children.length).toBeGreaterThan(0);
    });
  });

  // ─── 缓存 ────────────────────────────────────────────────

  describe('caching', () => {
    it('should return cached icon on second call', () => {
      const r = new CivIconRenderer('civ-china');
      const icon1 = r.drawIcon('farm', 32);
      const icon2 = r.drawIcon('farm', 32);
      expect(icon1).toBe(icon2);
      r.destroy();
    });

    it('should cache different sizes separately', () => {
      const r = new CivIconRenderer('civ-china');
      const icon32 = r.drawIcon('farm', 32);
      const icon64 = r.drawIcon('farm', 64);
      expect(icon32).not.toBe(icon64);
      r.destroy();
    });

    it('should clear cache', () => {
      const r = new CivIconRenderer('civ-china');
      r.drawIcon('farm', 32);
      r.clearCache();
      // After clearing, new icon should be different instance
      const icon = r.drawIcon('farm', 32);
      expect(icon).toBeDefined();
      r.destroy();
    });
  });

  // ─── 静态方法 ────────────────────────────────────────────

  describe('static methods', () => {
    it('should return all registered civ IDs', () => {
      const ids = CivIconRenderer.getRegisteredCivIds();
      expect(ids).toContain('civ-china');
      expect(ids).toContain('civ-egypt');
      expect(ids).toContain('civ-babylon');
      expect(ids).toContain('civ-india');
      expect(ids.length).toBe(4);
    });

    it('should get icon defs statically', () => {
      const defs = CivIconRenderer.getIconDefs('civ-china');
      expect(defs.length).toBe(10);
    });

    it('should get theme colors statically', () => {
      const colors = CivIconRenderer.getThemeColors('civ-egypt');
      expect(colors.primary).toBe(0xdaa520);
    });
  });

  // ─── 销毁 ────────────────────────────────────────────────

  describe('destroy', () => {
    it('should destroy cleanly', () => {
      const r = new CivIconRenderer('civ-china');
      r.drawIcon('farm', 32);
      expect(() => r.destroy()).not.toThrow();
    });

    it('should handle multiple destroys', () => {
      const r = new CivIconRenderer('civ-china');
      r.destroy();
      expect(() => r.destroy()).not.toThrow();
    });
  });
});
