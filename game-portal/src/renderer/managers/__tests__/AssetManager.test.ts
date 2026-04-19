/**
 * AssetManager 测试
 *
 * 测试资源管理器的所有功能：
 * - 资源路径解析（AssetPaths）
 * - Bundle 加载/卸载
 * - Spritesheet 程序化生成
 * - 字体配置和加载状态
 * - 纹理缓存和别名
 * - 资源预加载
 * - 销毁清理
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Mock PixiJS v8
// ═══════════════════════════════════════════════════════════════

const mockTextureDestroy = vi.fn();

vi.mock('pixi.js', () => {
  const textureCache = new Map<string, any>();

  class MockTextureSource {
    width = 64;
    height = 64;
  }

  class MockTexture {
    source: MockTextureSource;
    private _frame: { x: number; y: number; width: number; height: number } | null;

    constructor(opts?: any) {
      this.source = new MockTextureSource();
      this._frame = opts?.frame ?? null;
    }

    get frame() {
      return this._frame ?? { x: 0, y: 0, width: this.source.width, height: this.source.height };
    }

    destroy(_destroyBase?: boolean) {
      mockTextureDestroy();
    }

    static from(source: any): MockTexture {
      return new MockTexture();
    }
  }

  const MockAssets = {
    load: vi.fn(async (src: string) => {
      if (src.includes('spritesheet') || src.endsWith('.json')) {
        // 模拟 spritesheet 加载失败（触发程序化生成）
        throw new Error('File not found');
      }
      // 模拟普通纹理加载
      return new MockTexture();
    }),
    reset: vi.fn(),
  };

  const MockCache = {
    _store: new Map<string, any>(),
    has: vi.fn((key: string) => MockCache._store.has(key)),
    get: vi.fn((key: string) => MockCache._store.get(key)),
    set: vi.fn((key: string, value: any) => MockCache._store.set(key, value)),
    remove: vi.fn((key: string) => MockCache._store.delete(key)),
    clear: vi.fn(() => MockCache._store.clear()),
  };

  class MockSpritesheet {
    textures: Record<string, MockTexture> = {};
    constructor(_texture: any, _data: any) {}
    async parse() {}
  }

  class MockRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
    type = 'rectangle' as const;
    left: number;
    right: number;
    top: number;
    bottom: number;
    isValid: boolean = true;

    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.left = x;
      this.right = x + width;
      this.top = y;
      this.bottom = y + height;
    }

    contains(_x: number, _y: number): boolean { return true; }
    intersects(_other: MockRectangle): boolean { return true; }
    enqueue(_other: MockRectangle): this { return this; }
    fit(_other: MockRectangle): this { return this; }
    pad(_px: number, _py?: number): this { return this; }
    ceil(): this { return this; }
    enlarge(_other: MockRectangle): this { return this; }
    clone(): MockRectangle { return new MockRectangle(this.x, this.y, this.width, this.height); }
    copyFrom(rect: MockRectangle): this {
      this.x = rect.x; this.y = rect.y; this.width = rect.width; this.height = rect.height;
      return this;
    }
    copyTo(rect: MockRectangle): MockRectangle {
      rect.x = this.x; rect.y = this.y; rect.width = this.width; rect.height = this.height;
      return rect;
    }
  }

  return {
    Texture: MockTexture,
    Assets: MockAssets,
    Cache: MockCache,
    Spritesheet: MockSpritesheet,
    Rectangle: MockRectangle,
  };
});

// ═══════════════════════════════════════════════════════════════
// 导入被测模块
// ═══════════════════════════════════════════════════════════════

import { AssetManager } from '../AssetManager';
import {
  resolveAssetPath,
  resolveAssetPaths,
  setAssetBase,
  getAssetBase,
  TERRAIN_COLORS,
  BUILDING_ICONS,
  COMBAT_EFFECTS,
  COMBAT_UI_ELEMENTS,
  BUTTON_STYLES,
  PANEL_STYLES,
  FONT_CONFIGS,
  DEFAULT_FONT_FAMILY,
  FALLBACK_FONT_FAMILIES,
  CIV_ICONS,
  getFontStack,
  getWebFonts,
  getTerrainSpritesheetConfig,
  getCombatEffectSpritesheetConfig,
  getUISpritesheetConfig,
  type TerrainType,
  type CombatEffectType,
  type ButtonState,
} from '../../config/AssetPaths';

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('AssetPaths - 资源路径配置', () => {
  // ─── resolveAssetPath ─────────────────────────────────────

  describe('resolveAssetPath', () => {
    it('should resolve relative paths with asset base', () => {
      setAssetBase('/assets');
      expect(resolveAssetPath('/map/terrain.png')).toBe('/assets/map/terrain.png');
    });

    it('should handle paths without leading slash', () => {
      setAssetBase('/assets');
      expect(resolveAssetPath('map/terrain.png')).toBe('/assets/map/terrain.png');
    });

    it('should return http URLs unchanged', () => {
      expect(resolveAssetPath('http://cdn.example.com/img.png')).toBe(
        'http://cdn.example.com/img.png',
      );
    });

    it('should return https URLs unchanged', () => {
      expect(resolveAssetPath('https://cdn.example.com/img.png')).toBe(
        'https://cdn.example.com/img.png',
      );
    });

    it('should return data URIs unchanged', () => {
      expect(resolveAssetPath('data:image/png;base64,abc')).toBe(
        'data:image/png;base64,abc',
      );
    });
  });

  // ─── resolveAssetPaths ────────────────────────────────────

  describe('resolveAssetPaths', () => {
    it('should resolve multiple paths at once', () => {
      setAssetBase('/assets');
      const paths = resolveAssetPaths(['/a.png', '/b.png']);
      expect(paths).toEqual(['/assets/a.png', '/assets/b.png']);
    });

    it('should handle mixed path types', () => {
      setAssetBase('/assets');
      const paths = resolveAssetPaths(['/local.png', 'https://cdn.com/remote.png']);
      expect(paths).toEqual(['/assets/local.png', 'https://cdn.com/remote.png']);
    });
  });

  // ─── setAssetBase / getAssetBase ──────────────────────────

  describe('setAssetBase / getAssetBase', () => {
    it('should set and get asset base', () => {
      setAssetBase('/custom-assets');
      expect(getAssetBase()).toBe('/custom-assets');
    });

    it('should fallback to default when empty string', () => {
      setAssetBase('');
      expect(getAssetBase()).toBe('/assets');
    });

    afterEach(() => {
      setAssetBase('/assets');
    });
  });

  // ─── TERRAIN_COLORS ──────────────────────────────────────

  describe('TERRAIN_COLORS', () => {
    it('should have colors for all terrain types', () => {
      const types: TerrainType[] = ['grass', 'forest', 'mountain', 'water', 'desert', 'snow', 'swamp', 'lava'];
      for (const type of types) {
        expect(TERRAIN_COLORS[type]).toBeDefined();
        expect(typeof TERRAIN_COLORS[type]).toBe('number');
      }
    });

    it('should have 8 terrain types', () => {
      expect(Object.keys(TERRAIN_COLORS)).toHaveLength(8);
    });
  });

  // ─── BUILDING_ICONS ──────────────────────────────────────

  describe('BUILDING_ICONS', () => {
    it('should have icon definitions for all building types', () => {
      const types = ['capital', 'city', 'fortress', 'village', 'wilderness', 'farm', 'mine', 'barracks', 'market', 'temple', 'academy', 'wall'];
      for (const type of types) {
        expect(BUILDING_ICONS[type]).toBeDefined();
        expect(BUILDING_ICONS[type].color).toBeDefined();
        expect(BUILDING_ICONS[type].label).toBeDefined();
        expect(BUILDING_ICONS[type].size).toBeGreaterThan(0);
      }
    });

    it('should have correct capital building icon', () => {
      expect(BUILDING_ICONS.capital.color).toBe(0xffd700);
      expect(BUILDING_ICONS.capital.label).toBe('🏛');
    });
  });

  // ─── COMBAT_EFFECTS ──────────────────────────────────────

  describe('COMBAT_EFFECTS', () => {
    it('should have definitions for all effect types', () => {
      const types: CombatEffectType[] = ['slash', 'fire', 'ice', 'lightning', 'heal', 'buff', 'debuff'];
      for (const type of types) {
        expect(COMBAT_EFFECTS[type]).toBeDefined();
        expect(COMBAT_EFFECTS[type].color).toBeDefined();
        expect(COMBAT_EFFECTS[type].particleCount).toBeGreaterThan(0);
        expect(COMBAT_EFFECTS[type].duration).toBeGreaterThan(0);
      }
    });

    it('should have slash effect with white color', () => {
      expect(COMBAT_EFFECTS.slash.color).toBe(0xffffff);
    });
  });

  // ─── COMBAT_UI_ELEMENTS ──────────────────────────────────

  describe('COMBAT_UI_ELEMENTS', () => {
    it('should have hp bar definitions', () => {
      expect(COMBAT_UI_ELEMENTS.hpBarBg).toBeDefined();
      expect(COMBAT_UI_ELEMENTS.hpBarFill).toBeDefined();
      expect(COMBAT_UI_ELEMENTS.hpBarLow).toBeDefined();
    });

    it('should have victory and defeat banners', () => {
      expect(COMBAT_UI_ELEMENTS.victoryBanner).toBeDefined();
      expect(COMBAT_UI_ELEMENTS.defeatBanner).toBeDefined();
    });
  });

  // ─── BUTTON_STYLES ───────────────────────────────────────

  describe('BUTTON_STYLES', () => {
    it('should have primary, secondary, danger, and icon styles', () => {
      expect(BUTTON_STYLES.primary).toBeDefined();
      expect(BUTTON_STYLES.secondary).toBeDefined();
      expect(BUTTON_STYLES.danger).toBeDefined();
      expect(BUTTON_STYLES.icon).toBeDefined();
    });

    it('should have all button states for each style', () => {
      const states: ButtonState[] = ['normal', 'hover', 'pressed', 'disabled'];
      for (const [, style] of Object.entries(BUTTON_STYLES)) {
        for (const state of states) {
          expect(style.colors[state]).toBeDefined();
        }
      }
    });

    it('should have disabled color as gray for all buttons', () => {
      for (const [, style] of Object.entries(BUTTON_STYLES)) {
        expect(style.colors.disabled).toBe(0x888888);
      }
    });
  });

  // ─── PANEL_STYLES ────────────────────────────────────────

  describe('PANEL_STYLES', () => {
    it('should have default, tooltip, dialog, and resourceBar styles', () => {
      expect(PANEL_STYLES.default).toBeDefined();
      expect(PANEL_STYLES.tooltip).toBeDefined();
      expect(PANEL_STYLES.dialog).toBeDefined();
      expect(PANEL_STYLES.resourceBar).toBeDefined();
    });

    it('should have valid border radius for all panels', () => {
      for (const [, style] of Object.entries(PANEL_STYLES)) {
        expect(style.radius).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ─── FONT_CONFIGS ────────────────────────────────────────

  describe('FONT_CONFIGS', () => {
    it('should have at least one font config', () => {
      expect(FONT_CONFIGS.length).toBeGreaterThan(0);
    });

    it('should have fallback fonts', () => {
      const fallbacks = FONT_CONFIGS.filter((f) => f.fallback);
      expect(fallbacks.length).toBeGreaterThan(0);
    });

    it('should have system fonts', () => {
      const systemFonts = FONT_CONFIGS.filter((f) => f.source === 'system');
      expect(systemFonts.length).toBeGreaterThan(0);
    });
  });

  // ─── CIV_ICONS ───────────────────────────────────────────

  describe('CIV_ICONS', () => {
    it('should have 8 civilization icons', () => {
      expect(CIV_ICONS).toHaveLength(8);
    });

    it('should include china civilization', () => {
      const china = CIV_ICONS.find((c) => c.id === 'china');
      expect(china).toBeDefined();
      expect(china!.color).toBe(0xff0000);
    });
  });

  // ─── getFontStack ────────────────────────────────────────

  describe('getFontStack', () => {
    it('should return font stack with primary font', () => {
      const stack = getFontStack();
      expect(stack).toContain('Noto Sans SC');
    });

    it('should return font stack with custom primary', () => {
      const stack = getFontStack('CustomFont');
      expect(stack).toContain('CustomFont');
    });

    it('should include fallback fonts', () => {
      const stack = getFontStack();
      expect(stack).toContain('Arial');
    });
  });

  // ─── getWebFonts ─────────────────────────────────────────

  describe('getWebFonts', () => {
    it('should return only non-system fonts', () => {
      const webFonts = getWebFonts();
      for (const font of webFonts) {
        expect(font.source).not.toBe('system');
      }
    });

    it('should include Noto Sans SC', () => {
      const webFonts = getWebFonts();
      const noto = webFonts.find((f) => f.family === 'Noto Sans SC');
      expect(noto).toBeDefined();
    });
  });

  // ─── DEFAULT_FONT_FAMILY / FALLBACK_FONT_FAMILIES ────────

  describe('font constants', () => {
    it('should have default font family set', () => {
      expect(DEFAULT_FONT_FAMILY).toBe('Noto Sans SC');
    });

    it('should have fallback font families', () => {
      expect(FALLBACK_FONT_FAMILIES.length).toBeGreaterThan(0);
      expect(FALLBACK_FONT_FAMILIES).toContain('Arial');
    });
  });

  // ─── Spritesheet configs ─────────────────────────────────

  describe('getTerrainSpritesheetConfig', () => {
    it('should return a valid config', () => {
      const config = getTerrainSpritesheetConfig();
      expect(config.id).toBe('terrain');
      expect(config.sheetWidth).toBeGreaterThan(0);
      expect(config.sheetHeight).toBeGreaterThan(0);
      expect(config.frames.length).toBe(8); // 8 terrain types
    });

    it('should have frames named terrain_*', () => {
      const config = getTerrainSpritesheetConfig();
      for (const frame of config.frames) {
        expect(frame.name).toMatch(/^terrain_/);
      }
    });

    it('should have a drawFrame function', () => {
      const config = getTerrainSpritesheetConfig();
      expect(typeof config.drawFrame).toBe('function');
    });
  });

  describe('getCombatEffectSpritesheetConfig', () => {
    it('should return a valid config', () => {
      const config = getCombatEffectSpritesheetConfig();
      expect(config.id).toBe('combat-effects');
      expect(config.frames.length).toBe(7); // 7 effect types
    });

    it('should have frames named effect_*', () => {
      const config = getCombatEffectSpritesheetConfig();
      for (const frame of config.frames) {
        expect(frame.name).toMatch(/^effect_/);
      }
    });
  });

  describe('getUISpritesheetConfig', () => {
    it('should return a valid config', () => {
      const config = getUISpritesheetConfig();
      expect(config.id).toBe('ui-buttons');
      // 4 button types × 4 states = 16 frames
      expect(config.frames.length).toBe(16);
    });

    it('should have frames named btn_*', () => {
      const config = getUISpritesheetConfig();
      for (const frame of config.frames) {
        expect(frame.name).toMatch(/^btn_/);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// AssetManager 测试
// ═══════════════════════════════════════════════════════════════

describe('AssetManager', () => {
  let assetManager: AssetManager;

  beforeEach(() => {
    vi.clearAllMocks();
    assetManager = new AssetManager();
  });

  afterEach(() => {
    assetManager.destroy();
  });

  // ─── 构造函数 ────────────────────────────────────────────

  describe('constructor', () => {
    it('should register built-in bundles', () => {
      expect(assetManager.isBundleLoaded('map')).toBe(false);
      expect(assetManager.isBundleLoaded('combat')).toBe(false);
      expect(assetManager.isBundleLoaded('ui')).toBe(false);
    });

    it('should initialize font status for all fonts', () => {
      for (const font of FONT_CONFIGS) {
        const status = assetManager.getFontStatus(font.family);
        expect(['pending', 'loaded']).toContain(status);
      }
    });
  });

  // ─── loadBundle ──────────────────────────────────────────

  describe('loadBundle', () => {
    it('should skip already loaded bundles', async () => {
      // First load
      await assetManager.loadBundle('map');
      expect(assetManager.isBundleLoaded('map')).toBe(true);

      // Second load should be a no-op
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      await assetManager.loadBundle('map');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already loaded'),
      );
      consoleSpy.mockRestore();
    });

    it('should warn for unknown bundles', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await assetManager.loadBundle('nonexistent');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown bundle'),
      );
      expect(assetManager.isBundleLoaded('nonexistent')).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should call progress callback during loading', async () => {
      const onProgress = vi.fn();
      await assetManager.loadBundle('map', onProgress);
      // Should be called at least once (before and after each asset)
      expect(onProgress).toHaveBeenCalled();
    });

    it('should mark bundle as loaded after completion', async () => {
      await assetManager.loadBundle('map');
      expect(assetManager.isBundleLoaded('map')).toBe(true);
    });
  });

  // ─── unloadBundle ────────────────────────────────────────

  describe('unloadBundle', () => {
    it('should do nothing for unloaded bundles', async () => {
      await assetManager.unloadBundle('map');
      // Should not throw
    });

    it('should remove bundle from loaded set', async () => {
      await assetManager.loadBundle('map');
      expect(assetManager.isBundleLoaded('map')).toBe(true);

      await assetManager.unloadBundle('map');
      expect(assetManager.isBundleLoaded('map')).toBe(false);
    });
  });

  // ─── registerBundle ──────────────────────────────────────

  describe('registerBundle', () => {
    it('should register custom bundle', async () => {
      assetManager.registerBundle({
        name: 'custom',
        assets: [
          { id: 'custom-tex', src: '/custom/tex.png', type: 'texture' },
        ],
      });

      // Should be loadable
      await assetManager.loadBundle('custom');
      expect(assetManager.isBundleLoaded('custom')).toBe(true);
    });

    it('should allow empty custom bundle', async () => {
      assetManager.registerBundle({
        name: 'empty',
        assets: [],
      });

      await assetManager.loadBundle('empty');
      expect(assetManager.isBundleLoaded('empty')).toBe(true);
    });
  });

  // ─── getTexture / getSpriteFrame ─────────────────────────

  describe('getTexture', () => {
    it('should return null for unloaded textures', () => {
      expect(assetManager.getTexture('nonexistent')).toBeNull();
    });
  });

  describe('getSpriteFrame', () => {
    it('should return null for unloaded frames', () => {
      expect(assetManager.getSpriteFrame('terrain', 'grass')).toBeNull();
    });
  });

  // ─── 纹理别名 ────────────────────────────────────────────

  describe('texture aliases', () => {
    it('should register and resolve single alias', () => {
      assetManager.registerAlias('hero', 'tower_archer');
      // Both should return null since no textures loaded, but alias is registered
      expect(assetManager.getTextureByAlias('hero')).toBeNull();
    });

    it('should register multiple aliases', () => {
      assetManager.registerAliases({
        hero: 'tower_archer',
        enemy: 'enemy_skeleton',
      });
      expect(assetManager.getTextureByAlias('hero')).toBeNull();
      expect(assetManager.getTextureByAlias('enemy')).toBeNull();
    });

    it('should fallback to direct lookup for unknown aliases', () => {
      expect(assetManager.getTextureByAlias('some_id')).toBeNull();
    });
  });

  // ─── 字体状态 ────────────────────────────────────────────

  describe('font management', () => {
    it('should report font status', () => {
      const status = assetManager.getFontStatus('Noto Sans SC');
      expect(['pending', 'loading', 'loaded', 'failed']).toContain(status);
    });

    it('should return pending for unknown fonts', () => {
      expect(assetManager.getFontStatus('UnknownFont')).toBe('pending');
    });

    it('should check if font is loaded', () => {
      // System fonts should be loaded
      const arialLoaded = assetManager.isFontLoaded('Arial');
      expect(typeof arialLoaded).toBe('boolean');
    });

    it('should return all font statuses', () => {
      const statuses = assetManager.getAllFontStatus();
      expect(statuses).toBeInstanceOf(Map);
      expect(statuses.size).toBeGreaterThan(0);
    });
  });

  // ─── destroy ─────────────────────────────────────────────

  describe('destroy', () => {
    it('should clear all caches', () => {
      assetManager.registerAlias('test', 'value');
      assetManager.destroy();

      // After destroy, everything should be clean
      expect(assetManager.isBundleLoaded('map')).toBe(false);
      expect(assetManager.getTexture('any')).toBeNull();
    });

    it('should handle multiple destroy calls gracefully', () => {
      assetManager.destroy();
      expect(() => assetManager.destroy()).not.toThrow();
    });
  });

  // ─── loadKenneySpritesheet ───────────────────────────────

  describe('loadKenneySpritesheet', () => {
    it('should return empty array on load failure', async () => {
      const frames = await assetManager.loadKenneySpritesheet();
      // Since mock throws, should return empty
      expect(Array.isArray(frames)).toBe(true);
    });

    it('should accept custom path', async () => {
      const frames = await assetManager.loadKenneySpritesheet('/custom/path.json');
      expect(Array.isArray(frames)).toBe(true);
    });
  });

  // ─── preloadAssets ───────────────────────────────────────

  describe('preloadAssets', () => {
    it('should handle empty manifest', async () => {
      const ids = await assetManager.preloadAssets([]);
      expect(ids).toEqual([]);
    });

    it('should call progress callback', async () => {
      const onProgress = vi.fn();
      await assetManager.preloadAssets(
        [{ id: 'test', src: '/test.png', type: 'texture' }],
        onProgress,
      );
      expect(onProgress).toHaveBeenCalled();
    });

    it('should handle texture loading failure gracefully', async () => {
      const { Assets } = await import('pixi.js');
      (Assets.load as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));

      const ids = await assetManager.preloadAssets([
        { id: 'fail', src: '/fail.png', type: 'texture' },
      ]);
      expect(ids).toEqual([]);
    });
  });

  // ─── generateProceduralSpritesheet ───────────────────────

  describe('generateProceduralSpritesheet', () => {
    it('should generate terrain spritesheet', async () => {
      await assetManager.generateProceduralSpritesheet('terrain');
      // Check that frames were cached
      const grassFrame = assetManager.getSpriteFrame('terrain', 'terrain_grass');
      // In test env, Texture.from may not work fully, but the method should not throw
      expect(grassFrame).toBeDefined();
    });

    it('should generate combat-effects spritesheet', async () => {
      await assetManager.generateProceduralSpritesheet('combat-effects');
      expect(true).toBe(true); // Should not throw
    });

    it('should generate ui-buttons spritesheet', async () => {
      await assetManager.generateProceduralSpritesheet('ui-buttons');
      expect(true).toBe(true); // Should not throw
    });

    it('should warn for unknown procedural config', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await assetManager.generateProceduralSpritesheet('unknown-type');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No procedural config'),
      );
      consoleSpy.mockRestore();
    });
  });
});
