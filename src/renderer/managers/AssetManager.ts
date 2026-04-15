/**
 * renderer/managers/AssetManager.ts — 资源管理器
 *
 * 负责纹理图集、精灵图等资源的加载、缓存和卸载。
 * 支持按场景/资源包（bundle）的按需加载策略。
 *
 * @module renderer/managers/AssetManager
 */

import { Texture, Assets, Cache, Spritesheet } from 'pixi.js';
import type { SpritesheetData } from 'pixi.js';
import type { LoadProgressCallback, IAssetManager } from '../types';

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

// ═══════════════════════════════════════════════════════════════
// AssetManager
// ═══════════════════════════════════════════════════════════════

/**
 * 资源管理器
 *
 * 基于 PixiJS v8 的 Assets 系统封装。
 * 提供按资源包粒度的加载/卸载，纹理缓存查询。
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

  /** Kenney Tower Defense spritesheet 默认路径 */
  private static readonly KENNEY_SPRITESHEET_PATH =
    '/assets/kenney-tower-defense/spritesheet.json';

  // ═══════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════

  constructor() {
    // 注册内置资源包清单
    this.registerBuiltinManifests();
  }

  /**
   * 注册内置资源包清单
   *
   * TODO: 在实际资源就绪后，填写真实的资源路径。
   * 目前仅定义骨架，不加载任何文件。
   */
  private registerBuiltinManifests(): void {
    const bundles: AssetBundleManifest[] = [
      {
        name: 'map',
        assets: [
          // TODO: 添加地图场景资源
          // { id: 'territory-capital', src: '/assets/map/capital.png', type: 'texture' },
          // { id: 'territory-city', src: '/assets/map/city.png', type: 'texture' },
        ],
      },
      {
        name: 'combat',
        assets: [
          // TODO: 添加战斗场景资源
          // { id: 'hero-warrior', src: '/assets/combat/warrior.png', type: 'texture' },
          // { id: 'effect-slash', src: '/assets/combat/slash.json', type: 'spritesheet' },
        ],
      },
      {
        name: 'ui',
        assets: [
          // TODO: 添加 UI 通用资源
          // { id: 'btn-primary', src: '/assets/ui/btn-primary.png', type: 'texture' },
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
            // TODO: PixiJS v8 spritesheet 加载
            // const sheet = await Assets.load<SpriteSheet>(asset.src);
            // for (const [frameName, frameTexture] of Object.entries(sheet.textures)) {
            //   this.textureCache.set(`${asset.id}:${frameName}`, frameTexture);
            // }
            break;
          }
          case 'font': {
            // TODO: 字体加载
            await Assets.load(asset.src);
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
  }
}
