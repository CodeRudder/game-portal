/**
 * 纹理管理器
 *
 * 统一管理 PixiJS 纹理的加载、缓存和释放。
 * 支持按需加载（lazy loading）和批量预加载。
 *
 * 职责：
 *   - 纹理 URL 到 PIXI.Texture 的映射和缓存
 *   - 按需加载，避免一次性加载所有资源
 *   - 批量预加载指定纹理集合
 *   - 纹理释放，回收 GPU 内存
 *
 * @module rendering/core/TextureManager
 */

import { Texture, Assets } from 'pixi.js';
import { gameLog } from '../../core/logger';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 纹理加载结果 */
export interface ITextureLoadResult {
  /** 纹理键名 */
  key: string;
  /** 加载的纹理实例 */
  texture: Texture;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（加载失败时） */
  error?: string;
}

/** 预加载配置条目 */
export interface ITexturePreloadEntry {
  /** 纹理键名（缓存索引） */
  key: string;
  /** 纹理资源 URL */
  url: string;
}

// ─────────────────────────────────────────────
// TextureManager 类
// ─────────────────────────────────────────────

/**
 * 纹理管理器
 *
 * 基于 PIXI.Assets 的纹理加载和缓存管理。
 * 提供同步获取（从缓存）和异步加载两种模式。
 *
 * @example
 * ```ts
 * const tm = new TextureManager();
 *
 * // 预加载
 * await tm.preload([
 *   { key: 'tile_grass', url: '/assets/tiles/grass.png' },
 *   { key: 'tile_mountain', url: '/assets/tiles/mountain.png' },
 * ]);
 *
 * // 获取纹理
 * const grass = tm.get('tile_grass');
 * if (grass) sprite.texture = grass;
 *
 * // 释放
 * tm.release('tile_grass');
 * tm.releaseAll();
 * ```
 */
export class TextureManager {
  private readonly cache = new Map<string, Texture>();
  private readonly urlMap = new Map<string, string>();

  // ─── 加载 ───────────────────────────────────

  /**
   * 异步加载单个纹理
   *
   * 如果已缓存则直接返回缓存实例。
   *
   * @param key - 纹理键名
   * @param url - 纹理资源 URL
   * @returns 加载结果
   */
  async load(key: string, url: string): Promise<ITextureLoadResult> {
    // 缓存命中
    const cached = this.cache.get(key);
    if (cached) {
      return { key, texture: cached, success: true };
    }

    try {
      const texture = await Assets.load<Texture>(url);
      this.cache.set(key, texture);
      this.urlMap.set(key, url);
      return { key, texture, success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      gameLog.warn(`[TextureManager] Failed to load "${key}" from ${url}:`, msg);
      return {
        key,
        texture: Texture.EMPTY,
        success: false,
        error: msg,
      };
    }
  }

  /**
   * 批量预加载纹理
   *
   * 并行加载所有指定纹理，返回每个纹理的加载结果。
   *
   * @param entries - 预加载配置列表
   * @returns 所有纹理的加载结果
   */
  async preload(entries: ITexturePreloadEntry[]): Promise<ITextureLoadResult[]> {
    return Promise.all(entries.map((e) => this.load(e.key, e.url)));
  }

  // ─── 获取 ───────────────────────────────────

  /**
   * 从缓存获取纹理
   *
   * @param key - 纹理键名
   * @returns 纹理实例，未缓存时返回 undefined
   */
  get(key: string): Texture | undefined {
    return this.cache.get(key);
  }

  /**
   * 检查纹理是否已缓存
   *
   * @param key - 纹理键名
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  // ─── 释放 ───────────────────────────────────

  /**
   * 释放指定纹理
   *
   * 从缓存移除并销毁纹理，回收 GPU 内存。
   *
   * @param key - 纹理键名
   */
  release(key: string): void {
    const texture = this.cache.get(key);
    if (texture && texture !== Texture.EMPTY) {
      texture.destroy(true);
    }
    this.cache.delete(key);
    this.urlMap.delete(key);
  }

  /**
   * 释放所有纹理
   *
   * 清空缓存并销毁所有纹理实例。
   */
  releaseAll(): void {
    for (const [, texture] of this.cache) {
      if (texture !== Texture.EMPTY) {
        texture.destroy(true);
      }
    }
    this.cache.clear();
    this.urlMap.clear();
  }

  // ─── 访问器 ─────────────────────────────────

  /** 已缓存的纹理数量 */
  get size(): number {
    return this.cache.size;
  }
}
