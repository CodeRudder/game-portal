/**
 * StrategyIconRenderer 测试
 *
 * 测试策略游戏图标绘制器：
 * - 军事图标绘制（剑、盾、弓、马、塔）
 * - 资源图标绘制（木材、石头、粮食、金矿）
 * - 建筑图标绘制（兵营、市场、城堡、城墙）
 * - 配置选项（颜色、尺寸、背景）
 * - 缓存系统
 * - 静态方法
 * - 销毁
 */

// ---------------------------------------------------------------------------
// Mock PixiJS v8
// ---------------------------------------------------------------------------

import { vi } from 'vitest';

vi.mock('pixi.js', () => {
  class MockContainer {
    label: string;
    x = 0;
    y = 0;
    visible = true;
    children: any[] = [];
    parent: any = null;
    emit = vi.fn();
    on = vi.fn();
    off = vi.fn();

    constructor(opts?: { label?: string }) { this.label = opts?.label ?? ''; }

    addChild(child: any) {
      this.children.push(child);
      if (child) child.parent = this;
    }
    removeChild(child: any) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      if (child) child.parent = null;
    }
    destroy(_opts?: any) { this.children = []; }
  }

  class MockGraphics {
    label = '';
    x = 0;
    y = 0;
    visible = true;
    parent: any = null;
    emit = vi.fn();
    on = vi.fn();
    off = vi.fn();

    // Track drawing calls
    drawingCalls: string[] = [];

    clear() { this.drawingCalls.push('clear'); return this; }
    circle(_x: number, _y: number, _r: number) { this.drawingCalls.push('circle'); return this; }
    rect(_x: number, _y: number, _w: number, _h: number) { this.drawingCalls.push('rect'); return this; }
    ellipse(_x: number, _y: number, _rw: number, _rh: number) { this.drawingCalls.push('ellipse'); return this; }
    arc(_cx: number, _cy: number, _rx: number, _ry: number, _startAngle: number, _endAngle: number, _ccw?: boolean) { this.drawingCalls.push('arc'); return this; }
    moveTo(_x: number, _y: number) { this.drawingCalls.push('moveTo'); return this; }
    lineTo(_x: number, _y: number) { this.drawingCalls.push('lineTo'); return this; }
    quadraticCurveTo(_cx: number, _cy: number, _x: number, _y: number) { this.drawingCalls.push('quadraticCurveTo'); return this; }
    closePath() { this.drawingCalls.push('closePath'); return this; }
    fill(_c: any) { this.drawingCalls.push('fill'); return this; }
    stroke(_s: any) { this.drawingCalls.push('stroke'); return this; }
    roundRect(_x: number, _y: number, _w: number, _h: number, _r: number) { this.drawingCalls.push('roundRect'); return this; }
    destroy() { this.drawingCalls = []; }
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
    style: any;
    emit = vi.fn();
    on = vi.fn();

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

import { StrategyIconRenderer } from '../StrategyIconRenderer';
import type { StrategyIconType, MilitaryIconType, ResourceIconType, BuildingIconType } from '../StrategyIconRenderer';

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('StrategyIconRenderer', () => {
  let renderer: StrategyIconRenderer;

  beforeEach(() => {
    renderer = new StrategyIconRenderer();
  });

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should create renderer instance', () => {
      expect(renderer).toBeDefined();
    });

    it('should start with empty cache', () => {
      expect(renderer.getCacheSize()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 军事图标
  // ═══════════════════════════════════════════════════════════

  describe('military icons', () => {
    it('should draw sword icon', () => {
      const icon = renderer.drawIcon('sword');
      expect(icon).toBeDefined();
      expect(icon.label).toBe('icon-sword');
      expect(icon.children.length).toBeGreaterThan(0);
    });

    it('should draw shield icon', () => {
      const icon = renderer.drawIcon('shield');
      expect(icon).toBeDefined();
      expect(icon.label).toBe('icon-shield');
      expect(icon.children.length).toBeGreaterThan(0);
    });

    it('should draw bow icon', () => {
      const icon = renderer.drawIcon('bow');
      expect(icon).toBeDefined();
      expect(icon.label).toBe('icon-bow');
      expect(icon.children.length).toBeGreaterThan(0);
    });

    it('should draw horse icon', () => {
      const icon = renderer.drawIcon('horse');
      expect(icon).toBeDefined();
      expect(icon.label).toBe('icon-horse');
      expect(icon.children.length).toBeGreaterThan(0);
    });

    it('should draw tower icon', () => {
      const icon = renderer.drawIcon('tower');
      expect(icon).toBeDefined();
      expect(icon.label).toBe('icon-tower');
      expect(icon.children.length).toBeGreaterThan(0);
    });

    it('sword should use drawing operations', () => {
      const icon = renderer.drawIcon('sword');
      const g = icon.children[0] as any;
      expect(g.drawingCalls.length).toBeGreaterThan(0);
      expect(g.drawingCalls).toContain('rect');
      expect(g.drawingCalls).toContain('fill');
    });

    it('shield should contain circle operations', () => {
      const icon = renderer.drawIcon('shield');
      const g = icon.children[0] as any;
      expect(g.drawingCalls).toContain('circle');
    });

    it('tower should contain rect and arc operations', () => {
      const icon = renderer.drawIcon('tower');
      const g = icon.children[0] as any;
      expect(g.drawingCalls).toContain('rect');
      expect(g.drawingCalls).toContain('arc');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 资源图标
  // ═══════════════════════════════════════════════════════════

  describe('resource icons', () => {
    it('should draw wood icon', () => {
      const icon = renderer.drawIcon('wood');
      expect(icon).toBeDefined();
      expect(icon.label).toBe('icon-wood');
      expect(icon.children.length).toBeGreaterThan(0);
    });

    it('should draw stone icon', () => {
      const icon = renderer.drawIcon('stone');
      expect(icon).toBeDefined();
      expect(icon.label).toBe('icon-stone');
      expect(icon.children.length).toBeGreaterThan(0);
    });

    it('should draw food icon', () => {
      const icon = renderer.drawIcon('food');
      expect(icon).toBeDefined();
      expect(icon.label).toBe('icon-food');
      expect(icon.children.length).toBeGreaterThan(0);
    });

    it('should draw gold icon', () => {
      const icon = renderer.drawIcon('gold');
      expect(icon).toBeDefined();
      expect(icon.label).toBe('icon-gold');
      expect(icon.children.length).toBeGreaterThan(0);
    });

    it('wood should use stroke operations for crossed logs', () => {
      const icon = renderer.drawIcon('wood');
      const g = icon.children[0] as any;
      expect(g.drawingCalls).toContain('stroke');
      expect(g.drawingCalls).toContain('circle');
    });

    it('stone should use ellipse operations for stacked rocks', () => {
      const icon = renderer.drawIcon('stone');
      const g = icon.children[0] as any;
      expect(g.drawingCalls).toContain('ellipse');
    });

    it('gold should use ellipse for coin shapes', () => {
      const icon = renderer.drawIcon('gold');
      const g = icon.children[0] as any;
      expect(g.drawingCalls).toContain('ellipse');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 建筑图标
  // ═══════════════════════════════════════════════════════════

  describe('building icons', () => {
    it('should draw barracks icon', () => {
      const icon = renderer.drawIcon('barracks');
      expect(icon).toBeDefined();
      expect(icon.label).toBe('icon-barracks');
      expect(icon.children.length).toBeGreaterThan(0);
    });

    it('should draw market icon', () => {
      const icon = renderer.drawIcon('market');
      expect(icon).toBeDefined();
      expect(icon.label).toBe('icon-market');
      expect(icon.children.length).toBeGreaterThan(0);
    });

    it('should draw castle icon', () => {
      const icon = renderer.drawIcon('castle');
      expect(icon).toBeDefined();
      expect(icon.label).toBe('icon-castle');
      expect(icon.children.length).toBeGreaterThan(0);
    });

    it('should draw wall icon', () => {
      const icon = renderer.drawIcon('wall');
      expect(icon).toBeDefined();
      expect(icon.label).toBe('icon-wall');
      expect(icon.children.length).toBeGreaterThan(0);
    });

    it('castle should use rect and arc for gate', () => {
      const icon = renderer.drawIcon('castle');
      const g = icon.children[0] as any;
      expect(g.drawingCalls).toContain('rect');
      expect(g.drawingCalls).toContain('arc');
    });

    it('barracks should use closePath for tent shape', () => {
      const icon = renderer.drawIcon('barracks');
      const g = icon.children[0] as any;
      expect(g.drawingCalls).toContain('closePath');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 配置选项
  // ═══════════════════════════════════════════════════════════

  describe('configuration', () => {
    it('should accept custom size', () => {
      const icon = renderer.drawIcon('sword', { size: 48 });
      expect(icon).toBeDefined();
    });

    it('should accept custom color', () => {
      const icon = renderer.drawIcon('sword', { color: '#ff0000' });
      expect(icon).toBeDefined();
    });

    it('should accept custom secondary color', () => {
      const icon = renderer.drawIcon('shield', { secondaryColor: '#00ff00' });
      expect(icon).toBeDefined();
    });

    it('should accept background color', () => {
      const icon = renderer.drawIcon('sword', { backgroundColor: '#333333' });
      expect(icon).toBeDefined();
      const g = icon.children[0] as any;
      // Should have a roundRect for background
      expect(g.drawingCalls).toContain('roundRect');
    });

    it('should accept stroke color and width', () => {
      const icon = renderer.drawIcon('tower', {
        strokeColor: '#ffffff',
        strokeWidth: 2,
      });
      expect(icon).toBeDefined();
    });

    it('should use default config when no config provided', () => {
      const icon = renderer.drawIcon('gold');
      expect(icon).toBeDefined();
    });

    it('should handle all config options together', () => {
      const icon = renderer.drawIcon('castle', {
        size: 32,
        color: '#ff0000',
        secondaryColor: '#880000',
        backgroundColor: '#220000',
        strokeColor: '#ffffff',
        strokeWidth: 2,
      });
      expect(icon).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 缓存系统
  // ═══════════════════════════════════════════════════════════

  describe('caching', () => {
    it('should cache icons', () => {
      renderer.drawCachedIcon('sword');
      expect(renderer.getCacheSize()).toBe(1);
    });

    it('should cache different icons separately', () => {
      renderer.drawCachedIcon('sword');
      renderer.drawCachedIcon('shield');
      expect(renderer.getCacheSize()).toBe(2);
    });

    it('should return icon from cache for same type+config', () => {
      const icon1 = renderer.drawCachedIcon('sword');
      const icon2 = renderer.drawCachedIcon('sword');
      expect(icon1).toBeDefined();
      expect(icon2).toBeDefined();
    });

    it('should cache with different configs separately', () => {
      renderer.drawCachedIcon('sword', { color: '#ff0000' });
      renderer.drawCachedIcon('sword', { color: '#00ff00' });
      expect(renderer.getCacheSize()).toBe(2);
    });

    it('should clear cache', () => {
      renderer.drawCachedIcon('sword');
      renderer.drawCachedIcon('shield');
      renderer.clearCache();
      expect(renderer.getCacheSize()).toBe(0);
    });

    it('should allow drawing after cache clear', () => {
      renderer.drawCachedIcon('sword');
      renderer.clearCache();
      const icon = renderer.drawCachedIcon('sword');
      expect(icon).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 静态方法
  // ═══════════════════════════════════════════════════════════

  describe('static methods', () => {
    it('getSupportedTypes should return all 13 types', () => {
      const types = StrategyIconRenderer.getSupportedTypes();
      expect(types).toHaveLength(13);
    });

    it('getSupportedTypes should include all categories', () => {
      const types = StrategyIconRenderer.getSupportedTypes();
      expect(types).toContain('sword');
      expect(types).toContain('wood');
      expect(types).toContain('barracks');
    });

    it('getMilitaryTypes should return 5 types', () => {
      const types = StrategyIconRenderer.getMilitaryTypes();
      expect(types).toHaveLength(5);
      expect(types).toEqual(['sword', 'shield', 'bow', 'horse', 'tower']);
    });

    it('getResourceTypes should return 4 types', () => {
      const types = StrategyIconRenderer.getResourceTypes();
      expect(types).toHaveLength(4);
      expect(types).toEqual(['wood', 'stone', 'food', 'gold']);
    });

    it('getBuildingTypes should return 4 types', () => {
      const types = StrategyIconRenderer.getBuildingTypes();
      expect(types).toHaveLength(4);
      expect(types).toEqual(['barracks', 'market', 'castle', 'wall']);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 销毁
  // ═══════════════════════════════════════════════════════════

  describe('destroy', () => {
    it('should destroy renderer and clear cache', () => {
      renderer.drawCachedIcon('sword');
      renderer.drawCachedIcon('shield');
      renderer.destroy();
      expect(renderer.getCacheSize()).toBe(0);
    });

    it('should be safe to destroy empty renderer', () => {
      expect(() => renderer.destroy()).not.toThrow();
    });

    it('should be safe to destroy multiple times', () => {
      renderer.destroy();
      expect(() => renderer.destroy()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 全图标遍历测试
  // ═══════════════════════════════════════════════════════════

  describe('all icon types', () => {
    const allTypes: StrategyIconType[] = [
      'sword', 'shield', 'bow', 'horse', 'tower',
      'wood', 'stone', 'food', 'gold',
      'barracks', 'market', 'castle', 'wall',
    ];

    it.each(allTypes)('should draw %s icon without error', (type) => {
      const icon = renderer.drawIcon(type);
      expect(icon).toBeDefined();
      expect(icon.label).toBe(`icon-${type}`);
      expect(icon.children.length).toBeGreaterThan(0);
    });

    it.each(allTypes)('should draw %s icon with custom config', (type) => {
      const icon = renderer.drawIcon(type, {
        size: 32,
        color: '#ff0000',
        secondaryColor: '#880000',
      });
      expect(icon).toBeDefined();
    });
  });
});
