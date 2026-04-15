/**
 * renderer/managers/AssetManager.ts — 资源管理器
 *
 * 负责纹理图集、精灵图等资源的加载、缓存和卸载。
 * 支持按场景/资源包（bundle）的按需加载策略。
 *
 * @module renderer/managers/AssetManager
 */

import { Texture, Assets, Cache } from 'pixi.js';
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
    this.loadedBundles.clear();
    this.manifests.clear();
  }
}
