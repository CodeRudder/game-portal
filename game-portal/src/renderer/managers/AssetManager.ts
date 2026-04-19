/**
 * renderer/managers/AssetManager.ts — 资源管理器
 *
 * 负责纹理图集、精灵图等资源的加载、缓存和卸载。
 * 支持按场景/资源包（bundle）的按需加载策略。
 * 支持程序化 spritesheet 生成和字体加载。
 *
 * @module renderer/managers/AssetManager
 */

import { Texture, Assets, Cache, Spritesheet, Rectangle } from 'pixi.js';
import type { SpritesheetData, TextureSource } from 'pixi.js';
import type { LoadProgressCallback, IAssetManager } from '../types';
import {
  resolveAssetPath,
  MAP_ASSET_PATHS,
  COMBAT_ASSET_PATHS,
  UI_ASSET_PATHS,
  TERRAIN_COLORS,
  BUILDING_ICONS,
  COMBAT_EFFECTS,
  COMBAT_UI_ELEMENTS,
  BUTTON_STYLES,
  PANEL_STYLES,
  FONT_CONFIGS,
  DEFAULT_FONT_FAMILY,
  FALLBACK_FONT_FAMILIES,
  getWebFonts,
  getFontStack,
  getTerrainSpritesheetConfig,
  getCombatEffectSpritesheetConfig,
  getUISpritesheetConfig,
  type ProceduralSpritesheetConfig,
  type FontDef,
} from '../config/AssetPaths';

// ═══════════════════════════════════════════════════════════════
// 资源包定义
// ═══════════════════════════════════════════════════════════════

/**
 * 资源包清单
 *
 * 每个场景对应一个资源包，包含该场景需要的所有纹理。
 * 在场景 enter 时加载，exit 时卸载。
 */
interface AssetBundleManifest {
  /** 资源包名称 */
  name: string;
  /** 资源路径列表 */
  assets: AssetDescriptor[];
}

/** 单个资源描述 */
interface AssetDescriptor {
  /** 资源唯一标识（用于后续 getTexture） */
  id: string;
  /** 资源路径（URL） */
  src: string;
  /** 资源类型 */
  type: 'texture' | 'spritesheet' | 'font';
}

/** 预加载清单项 */
interface PreloadManifestItem {
  /** 资源唯一标识 */
  id: string;
  /** 资源路径 */
  src: string;
  /** 资源类型 */
  type: 'texture' | 'spritesheet' | 'font';
}

/** 加载进度回调（含百分比） */
type PreloadProgressCallback = (loaded: number, total: number, percent: number) => void;

/** 字体加载状态 */
type FontLoadStatus = 'pending' | 'loading' | 'loaded' | 'failed';

// ═══════════════════════════════════════════════════════════════
// AssetManager
// ═══════════════════════════════════════════════════════════════

/**
 * 资源管理器
 *
 * 基于 PixiJS v8 的 Assets 系统封装。
 * 提供按资源包粒度的加载/卸载，纹理缓存查询。
 * 支持程序化 spritesheet 生成和字体加载。
 *
 * @example
 * ```ts
 * const am = new AssetManager();
 * await am.loadBundle('map', (loaded, total, name) => {
 *   console.log(`Loading ${name}: ${loaded}/${total}`);
 * });
 * const tex = am.getTexture('territory-capital');
 * ```
 */
export class AssetManager implements IAssetManager {
  // ─── 状态 ─────────────────────────────────────────────────

  /** 已加载的资源包集合 */
  private loadedBundles: Set<string> = new Set();

  /** 资源包清单注册表 */
  private manifests: Map<string, AssetBundleManifest> = new Map();

  /** 纹理缓存（id → Texture） */
  private textureCache: Map<string, Texture> = new Map();

  /** 纹理别名映射（alias → textureKey） */
  private textureAliases: Map<string, string> = new Map();

  /** 字体加载状态映射 */
  private fontStatus: Map<string, FontLoadStatus> = new Map();

  /** Kenney Tower Defense spritesheet 默认路径 */
  private static readonly KENNEY_SPRITESHEET_PATH =
    '/assets/kenney-tower-defense/spritesheet.json';

  // ═══════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════

  constructor() {
    // 初始化字体状态
    for (const font of FONT_CONFIGS) {
      this.fontStatus.set(font.family, 'pending');
    }
    // 注册内置资源包清单
    this.registerBuiltinManifests();
  }

  /**
   * 注册内置资源包清单
   *
   * 定义地图、战斗、UI 三个场景的资源包。
   * 资源路径通过 resolveAssetPath 解析。
   */
  private registerBuiltinManifests(): void {
    const bundles: AssetBundleManifest[] = [
      {
        name: 'map',
        assets: [
          // 地形瓦片 spritesheet（程序化生成）
          {
            id: 'terrain',
            src: resolveAssetPath(MAP_ASSET_PATHS.terrainSpritesheet),
            type: 'spritesheet',
          },
          // 建筑 spritesheet（程序化生成）
          {
            id: 'buildings',
            src: resolveAssetPath(MAP_ASSET_PATHS.buildingSpritesheet),
            type: 'spritesheet',
          },
        ],
      },
      {
        name: 'combat',
        assets: [
          // 战斗特效 spritesheet
          {
            id: 'combat-effects',
            src: resolveAssetPath(COMBAT_ASSET_PATHS.effectSpritesheet),
            type: 'spritesheet',
          },
          // 战斗 UI spritesheet
          {
            id: 'combat-ui',
            src: resolveAssetPath(COMBAT_ASSET_PATHS.combatUISpritesheet),
            type: 'spritesheet',
          },
        ],
      },
      {
        name: 'ui',
        assets: [
          // UI spritesheet（按钮、面板等）
          {
            id: 'ui-buttons',
            src: resolveAssetPath(UI_ASSET_PATHS.uiSpritesheet),
            type: 'spritesheet',
          },
          // 字体加载
          {
            id: 'font-primary',
            src: 'font://primary',
            type: 'font',
          },
        ],
      },
    ];

    for (const bundle of bundles) {
      this.manifests.set(bundle.name, bundle);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 加载/卸载
  // ═══════════════════════════════════════════════════════════

  /**
   * 加载资源包
   *
   * @param bundleName - 资源包名称
   * @param onProgress - 加载进度回调
   */
  async loadBundle(bundleName: string, onProgress?: LoadProgressCallback): Promise<void> {
    if (this.loadedBundles.has(bundleName)) {
      console.info(`[AssetManager] Bundle "${bundleName}" already loaded`);
      return;
    }

    const manifest = this.manifests.get(bundleName);
    if (!manifest) {
      console.warn(`[AssetManager] Unknown bundle: "${bundleName}"`);
      return;
    }

    // 如果没有资源定义，直接标记为已加载（占位模式）
    if (manifest.assets.length === 0) {
      this.loadedBundles.add(bundleName);
      return;
    }

    const total = manifest.assets.length;
    let loaded = 0;

    for (const asset of manifest.assets) {
      onProgress?.(loaded, total, asset.id);

      try {
        switch (asset.type) {
          case 'texture': {
            const texture = await Assets.load<Texture>(asset.src);
            if (texture) {
              this.textureCache.set(asset.id, texture);
            }
            break;
          }
          case 'spritesheet': {
            await this.loadSpritesheetAsset(asset.id, asset.src);
            break;
          }
          case 'font': {
            await this.loadFontAsset(asset.id);
            break;
          }
        }
      } catch (err) {
        console.error(`[AssetManager] Failed to load asset "${asset.id}":`, err);
      }

      loaded++;
      onProgress?.(loaded, total, asset.id);
    }

    this.loadedBundles.add(bundleName);
    console.info(`[AssetManager] Bundle "${bundleName}" loaded (${total} assets)`);
  }

  /**
   * 卸载资源包
   *
   * @param bundleName - 资源包名称
   */
  async unloadBundle(bundleName: string): Promise<void> {
    if (!this.loadedBundles.has(bundleName)) return;

    const manifest = this.manifests.get(bundleName);
    if (!manifest) return;

    // 从缓存中移除纹理
    for (const asset of manifest.assets) {
      const cached = this.textureCache.get(asset.id);
      if (cached) {
        cached.destroy(true);
        this.textureCache.delete(asset.id);
      }

      // 从 PixiJS 全局缓存中移除
      if (Cache.has(asset.src)) {
        Cache.remove(asset.src);
      }
    }

    this.loadedBundles.delete(bundleName);
    console.info(`[AssetManager] Bundle "${bundleName}" unloaded`);
  }

  // ═══════════════════════════════════════════════════════════
  // Spritesheet 加载
  // ═══════════════════════════════════════════════════════════

  /**
   * 加载 spritesheet 资源
   *
   * 支持两种模式：
   * 1. 从 URL 加载真实 spritesheet JSON
   * 2. 程序化生成 spritesheet（当 URL 不可用时）
   *
   * @param assetId - 资源 ID
   * @param src - 资源路径
   */
  private async loadSpritesheetAsset(assetId: string, src: string): Promise<void> {
    try {
      // 尝试从 PixiJS Assets 系统加载
      const sheet = await Assets.load<Spritesheet<SpritesheetData>>(src);
      if (sheet?.textures) {
        for (const [frameName, frameTexture] of Object.entries(sheet.textures)) {
          if (frameTexture instanceof Texture) {
            this.textureCache.set(`${assetId}:${frameName}`, frameTexture);
          }
        }
        return;
      }
    } catch {
      // 加载失败，回退到程序化生成
      console.info(`[AssetManager] Falling back to procedural spritesheet for "${assetId}"`);
    }

    // 程序化生成 spritesheet
    await this.generateProceduralSpritesheet(assetId);
  }

  /**
   * 程序化生成 spritesheet
   *
   * 使用 Canvas API 动态生成精灵图并注册到纹理缓存。
   * 根据 assetId 选择对应的生成配置。
   *
   * @param assetId - 资源 ID
   */
  async generateProceduralSpritesheet(assetId: string): Promise<void> {
    let config: ProceduralSpritesheetConfig | null = null;

    switch (assetId) {
      case 'terrain':
        config = getTerrainSpritesheetConfig();
        break;
      case 'buildings':
        config = this.getBuildingSpritesheetConfig();
        break;
      case 'combat-effects':
        config = getCombatEffectSpritesheetConfig();
        break;
      case 'combat-ui':
        config = this.getCombatUISpritesheetConfig();
        break;
      case 'ui-buttons':
        config = getUISpritesheetConfig();
        break;
      default:
        console.warn(`[AssetManager] No procedural config for "${assetId}"`);
        return;
    }

    if (!config) return;

    // 使用 Canvas API 生成 spritesheet 图像
    const canvas = document.createElement('canvas');
    canvas.width = config.sheetWidth;
    canvas.height = config.sheetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 绘制所有帧
    for (const frame of config.frames) {
      config.drawFrame(ctx, frame);
    }

    // 从 Canvas 创建 PixiJS Texture
    const baseTexture = Texture.from(canvas as unknown as TextureSource);

    // 为每个帧创建子纹理
    for (const frame of config.frames) {
      const frameTexture = new Texture({
        source: baseTexture.source,
        frame: new Rectangle(frame.x, frame.y, frame.width, frame.height),
      });
      this.textureCache.set(`${assetId}:${frame.name}`, frameTexture);
    }

    console.info(
      `[AssetManager] Generated procedural spritesheet "${assetId}" (${config.frames.length} frames)`,
    );
  }

  /**
   * 获取建筑 spritesheet 配置
   */
  private getBuildingSpritesheetConfig(): ProceduralSpritesheetConfig {
    const buildingTypes = Object.keys(BUILDING_ICONS);
    const frameSize = 48;
    const cols = 4;
    const rows = Math.ceil(buildingTypes.length / cols);

    const frames = buildingTypes.map((type, i) => ({
      name: `building_${type}`,
      x: (i % cols) * frameSize,
      y: Math.floor(i / cols) * frameSize,
      width: frameSize,
      height: frameSize,
    }));

    return {
      id: 'buildings',
      sheetWidth: cols * frameSize,
      sheetHeight: rows * frameSize,
      frames,
      drawFrame: (ctx, frame) => {
        const buildingType = frame.name.replace('building_', '');
        const iconDef = BUILDING_ICONS[buildingType];
        if (!iconDef) return;

        const r = (iconDef.color >> 16) & 0xff;
        const g = (iconDef.color >> 8) & 0xff;
        const b = iconDef.color & 0xff;

        // 绘制圆角矩形背景
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.roundRect(frame.x + 2, frame.y + 2, frame.width - 4, frame.height - 4, 8);
        ctx.fill();

        // 绘制边框
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(frame.x + 2, frame.y + 2, frame.width - 4, frame.height - 4, 8);
        ctx.stroke();

        // 绘制标签文字
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(iconDef.label, frame.x + frame.width / 2, frame.y + frame.height / 2);
      },
    };
  }

  /**
   * 获取战斗 UI spritesheet 配置
   */
  private getCombatUISpritesheetConfig(): ProceduralSpritesheetConfig {
    const elements = Object.entries(COMBAT_UI_ELEMENTS);
    const cols = 3;
    const rows = Math.ceil(elements.length / cols);

    const frames = elements.map(([name, def], i) => ({
      name: `combat_ui_${name}`,
      x: (i % cols) * def.width,
      y: Math.floor(i / cols) * def.height,
      width: def.width,
      height: def.height,
    }));

    return {
      id: 'combat-ui',
      sheetWidth: cols * 120,
      sheetHeight: rows * 40,
      frames,
      drawFrame: (ctx, frame) => {
        const elementName = frame.name.replace('combat_ui_', '');
        const def = COMBAT_UI_ELEMENTS[elementName];
        if (!def) return;

        const r = (def.color >> 16) & 0xff;
        const g = (def.color >> 8) & 0xff;
        const b = def.color & 0xff;

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.roundRect(frame.x, frame.y, frame.width, frame.height, def.radius);
        ctx.fill();
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 字体加载
  // ═══════════════════════════════════════════════════════════

  /**
   * 加载字体资源
   *
   * 支持系统字体和 Web 字体加载。
   * 使用 FontFace API 加载 Web 字体，系统字体直接标记为已加载。
   *
   * @param assetId - 字体资源 ID
   */
  private async loadFontAsset(assetId: string): Promise<void> {
    const webFonts = getWebFonts();

    for (const font of webFonts) {
      const status = this.fontStatus.get(font.family);
      if (status === 'loaded' || status === 'loading') continue;

      this.fontStatus.set(font.family, 'loading');

      try {
        if (font.source === 'web' && font.url) {
          // 使用 FontFace API 加载 Web 字体
          const fontFace = new FontFace(font.family, `url(${font.url})`, {
            weight: String(font.weight),
          });
          const loaded = await fontFace.load();
          document.fonts.add(loaded);
        } else if (font.source === 'google' && font.url) {
          // Google Fonts: 通过 link 标签加载
          await this.loadGoogleFont(font);
        }
        this.fontStatus.set(font.family, 'loaded');
      } catch (err) {
        console.warn(`[AssetManager] Failed to load font "${font.family}":`, err);
        this.fontStatus.set(font.family, 'failed');
      }
    }

    // 系统字体直接标记为已加载
    for (const font of FONT_CONFIGS) {
      if (font.source === 'system') {
        this.fontStatus.set(font.family, 'loaded');
      }
    }
  }

  /**
   * 加载 Google Font
   *
   * 通过动态创建 <link> 标签加载 Google Fonts CSS。
   *
   * @param font - 字体定义
   */
  private loadGoogleFont(font: FontDef): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!font.url) {
        resolve();
        return;
      }

      // 检查是否已加载
      const existing = document.querySelector(`link[href="${font.url}"]`);
      if (existing) {
        resolve();
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = font.url;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to load font: ${font.family}`));
      document.head.appendChild(link);
    });
  }

  /**
   * 获取字体加载状态
   *
   * @param family - 字体族名称
   * @returns 加载状态
   */
  getFontStatus(family: string): FontLoadStatus {
    return this.fontStatus.get(family) ?? 'pending';
  }

  /**
   * 检查字体是否已加载
   *
   * @param family - 字体族名称
   */
  isFontLoaded(family: string): boolean {
    return this.fontStatus.get(family) === 'loaded';
  }

  /**
   * 获取所有字体加载状态
   */
  getAllFontStatus(): Map<string, FontLoadStatus> {
    return new Map(this.fontStatus);
  }

  // ═══════════════════════════════════════════════════════════
  // 纹理查询
  // ═══════════════════════════════════════════════════════════

  /**
   * 获取纹理
   *
   * @param assetId - 资源 ID
   * @returns Texture 或 null（未找到）
   */
  getTexture(assetId: string): Texture | null {
    return this.textureCache.get(assetId) ?? null;
  }

  /**
   * 获取纹理图集中的帧
   *
   * @param assetId - 图集资源 ID
   * @param frame - 帧名称
   * @returns Texture 或 null
   */
  getSpriteFrame(assetId: string, frame: string): Texture | null {
    const key = `${assetId}:${frame}`;
    return this.textureCache.get(key) ?? null;
  }

  /**
   * 检查资源包是否已加载
   */
  isBundleLoaded(bundleName: string): boolean {
    return this.loadedBundles.has(bundleName);
  }

  // ═══════════════════════════════════════════════════════════
  // 注册自定义资源包
  // ═══════════════════════════════════════════════════════════

  /**
   * 注册自定义资源包清单
   *
   * 允许外部注册资源包，用于动态扩展。
   */
  registerBundle(manifest: AssetBundleManifest): void {
    this.manifests.set(manifest.name, manifest);
  }

  // ═══════════════════════════════════════════════════════════
  // Kenney 资源加载
  // ═══════════════════════════════════════════════════════════

  /**
   * 加载 Kenney Tower Defense spritesheet
   *
   * 从标准路径加载 spritesheet.json，解析后将所有帧纹理
   * 注册到 textureCache，键名为帧名（如 'tower_archer'）。
   *
   * @param path - spritesheet JSON 路径（默认使用内置路径）
   * @returns 加载的帧名称列表
   *
   * @example
   * ```ts
   * const frames = await assetManager.loadKenneySpritesheet();
   * // frames: ['tower_archer', 'tower_magic', 'enemy_skeleton', ...]
   * const tex = assetManager.getTexture('tower_archer');
   * ```
   */
  async loadKenneySpritesheet(
    path: string = AssetManager.KENNEY_SPRITESHEET_PATH,
  ): Promise<string[]> {
    try {
      // 使用 PixiJS v8 Assets 系统加载 spritesheet
      // Assets.load 会自动识别 JSON spritesheet 并解析帧纹理
      const sheet = await Assets.load<Spritesheet<SpritesheetData>>(path);

      if (!sheet || !sheet.textures) {
        console.warn('[AssetManager] Kenney spritesheet loaded but no textures found');
        return [];
      }

      const frameNames: string[] = [];

      // 将所有帧纹理注册到缓存
      for (const [frameName, frameTexture] of Object.entries(sheet.textures)) {
        if (frameTexture instanceof Texture) {
          this.textureCache.set(frameName, frameTexture);
          frameNames.push(frameName);
        }
      }

      console.info(
        `[AssetManager] Kenney spritesheet loaded (${frameNames.length} frames)`,
      );
      return frameNames;
    } catch (err) {
      console.error('[AssetManager] Failed to load Kenney spritesheet:', err);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 纹理别名管理
  // ═══════════════════════════════════════════════════════════

  /**
   * 注册纹理别名
   *
   * 为一个纹理键注册别名，后续可通过别名获取纹理。
   *
   * @param name - 别名
   * @param textureKey - 原始纹理键
   *
   * @example
   * ```ts
   * assetManager.registerAlias('hero', 'tower_archer');
   * const tex = assetManager.getTextureByAlias('hero'); // 等价于 getTexture('tower_archer')
   * ```
   */
  registerAlias(name: string, textureKey: string): void {
    this.textureAliases.set(name, textureKey);
  }

  /**
   * 批量注册纹理别名
   *
   * @param aliases - 别名映射表 { alias: textureKey }
   */
  registerAliases(aliases: Record<string, string>): void {
    for (const [alias, key] of Object.entries(aliases)) {
      this.textureAliases.set(alias, key);
    }
  }

  /**
   * 通过别名获取纹理
   *
   * 先查别名映射，再查纹理缓存。如果别名不存在，
   * 退化为直接用 name 作为 textureKey 查询。
   *
   * @param name - 别名或纹理键
   * @returns Texture 或 null
   */
  getTextureByAlias(name: string): Texture | null {
    const key = this.textureAliases.get(name) ?? name;
    return this.textureCache.get(key) ?? null;
  }

  // ═══════════════════════════════════════════════════════════
  // 资源预加载
  // ═══════════════════════════════════════════════════════════

  /**
   * 批量预加载资源
   *
   * 根据清单逐项加载资源，支持进度回调。
   * 所有资源加载完成后 resolve。
   *
   * @param manifest - 资源清单列表
   * @param onProgress - 加载进度回调（已加载数, 总数, 百分比）
   * @returns 所有资源 ID 列表
   *
   * @example
   * ```ts
   * const ids = await assetManager.preloadAssets([
   *   { id: 'bg', src: '/assets/bg.png', type: 'texture' },
   *   { id: 'fx', src: '/assets/fx.json', type: 'spritesheet' },
   * ], (loaded, total, pct) => {
   *   console.log(`Loading: ${pct}%`);
   * });
   * ```
   */
  async preloadAssets(
    manifest: PreloadManifestItem[],
    onProgress?: PreloadProgressCallback,
  ): Promise<string[]> {
    const total = manifest.length;
    let loaded = 0;
    const loadedIds: string[] = [];

    for (const item of manifest) {
      try {
        switch (item.type) {
          case 'texture': {
            const texture = await Assets.load<Texture>(item.src);
            if (texture) {
              this.textureCache.set(item.id, texture);
              loadedIds.push(item.id);
            }
            break;
          }
          case 'spritesheet': {
            const sheet = await Assets.load<Spritesheet<SpritesheetData>>(item.src);
            if (sheet?.textures) {
              for (const [frameName, frameTexture] of Object.entries(sheet.textures)) {
                if (frameTexture instanceof Texture) {
                  this.textureCache.set(`${item.id}:${frameName}`, frameTexture);
                }
              }
              loadedIds.push(item.id);
            }
            break;
          }
          case 'font': {
            await Assets.load(item.src);
            loadedIds.push(item.id);
            break;
          }
        }
      } catch (err) {
        console.error(`[AssetManager] Failed to preload "${item.id}":`, err);
      }

      loaded++;
      onProgress?.(loaded, total, Math.round((loaded / total) * 100));
    }

    console.info(`[AssetManager] Preloaded ${loadedIds.length}/${total} assets`);
    return loadedIds;
  }

  // ═══════════════════════════════════════════════════════════
  // 销毁
  // ═══════════════════════════════════════════════════════════

  /**
   * 销毁所有资源
   */
  destroy(): void {
    // 卸载所有已加载的资源包
    for (const bundleName of this.loadedBundles) {
      const manifest = this.manifests.get(bundleName);
      if (manifest) {
        for (const asset of manifest.assets) {
          if (Cache.has(asset.src)) {
            Cache.remove(asset.src);
          }
        }
      }
    }

    // 销毁缓存的纹理
    for (const texture of this.textureCache.values()) {
      texture.destroy(true);
    }

    this.textureCache.clear();
    this.textureAliases.clear();
    this.loadedBundles.clear();
    this.manifests.clear();
    this.fontStatus.clear();
  }
}
