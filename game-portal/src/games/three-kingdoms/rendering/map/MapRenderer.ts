/**
 * 地图渲染主控
 *
 * 负责管理整个游戏地图的渲染流程，协调 TileRenderer 和 TerritoryRenderer。
 * 持有地图根容器，管理视口和摄像机。
 *
 * 职责：
 *   - 创建和管理地图渲染根容器
 *   - 协调地块渲染器（TileRenderer）和领土渲染器（TerritoryRenderer）
 *   - 管理视口平移和缩放
 *   - 响应渲染状态中的地图数据变更
 *
 * @module rendering/map/MapRenderer
 */

import { Container } from 'pixi.js';
import type { IRenderer } from '../adapters/RenderStateBridge';
import type { TileRenderer } from './TileRenderer';
import type { TerritoryRenderer } from './TerritoryRenderer';
import type { TextureManager } from '../core/TextureManager';

// ─────────────────────────────────────────────
// 配置接口
// ─────────────────────────────────────────────

/** 地图渲染配置 */
export interface IMapRenderConfig {
  /** 地图列数 */
  cols: number;
  /** 地图行数 */
  rows: number;
  /** 单个地块宽度（像素） */
  tileWidth: number;
  /** 单个地块高度（像素） */
  tileHeight: number;
}

/** 视口状态 */
export interface IViewport {
  /** X 偏移（像素） */
  x: number;
  /** Y 偏移（像素） */
  y: number;
  /** 缩放比例 */
  zoom: number;
}

// ─────────────────────────────────────────────
// MapRenderer 类
// ─────────────────────────────────────────────

/**
 * 地图渲染主控
 *
 * 管理地图渲染的整体流程，协调子渲染器工作。
 * 后续版本将实现完整的地图渲染逻辑。
 *
 * @example
 * ```ts
 * const mapRenderer = new MapRenderer(textureManager, config);
 * mapRenderer.init(stage);
 *
 * // 每帧更新
 * renderLoop.register({ name: 'map', renderer: mapRenderer, priority: 0 });
 * ```
 */
export class MapRenderer implements IRenderer {
  private readonly root = new Container();
  private readonly config: IMapRenderConfig;
  private readonly textureManager: TextureManager;

  private tileRenderer: TileRenderer | null = null;
  private territoryRenderer: TerritoryRenderer | null = null;
  private viewport: IViewport = { x: 0, y: 0, zoom: 1 };
  private _visible = true;
  private _initialized = false;

  constructor(textureManager: TextureManager, config: IMapRenderConfig) {
    this.textureManager = textureManager;
    this.config = config;
  }

  // ─── IRenderer 接口实现 ─────────────────────

  /**
   * 初始化地图渲染器
   *
   * 创建子渲染器并将根容器挂载到父容器。
   *
   * @param container - 父级 PIXI.Container
   */
  init(container: Container): void {
    if (this._initialized) return;

    // TODO: 创建并初始化 TileRenderer 和 TerritoryRenderer
    // this.tileRenderer = new TileRenderer(this.textureManager, this.config);
    // this.tileRenderer.init(this.root);
    // this.territoryRenderer = new TerritoryRenderer(this.config);
    // this.territoryRenderer.init(this.root);

    container.addChild(this.root);
    this._initialized = true;
  }

  /**
   * 每帧更新
   *
   * 更新视口变换和子渲染器。
   *
   * @param dt - 帧间隔时间（秒）
   */
  update(dt: number): void {
    if (!this._initialized) return;

    // 应用视口变换
    this.root.x = this.viewport.x;
    this.root.y = this.viewport.y;
    this.root.scale.set(this.viewport.zoom);

    // TODO: 更新子渲染器
    // this.tileRenderer?.update(dt);
    // this.territoryRenderer?.update(dt);

    void dt; // 占位，避免未使用参数警告
  }

  /**
   * 销毁地图渲染器
   *
   * 释放所有子渲染器和容器资源。
   */
  destroy(): void {
    // TODO: 销毁子渲染器
    // this.tileRenderer?.destroy();
    // this.territoryRenderer?.destroy();

    this.root.destroy({ children: true });
    this._initialized = false;
  }

  // ─── 视口控制 ───────────────────────────────

  /**
   * 设置视口位置和缩放
   *
   * @param viewport - 新的视口状态
   */
  setViewport(viewport: Partial<IViewport>): void {
    Object.assign(this.viewport, viewport);
  }

  /**
   * 平移视口
   *
   * @param dx - X 方向偏移（像素）
   * @param dy - Y 方向偏移（像素）
   */
  pan(dx: number, dy: number): void {
    this.viewport.x += dx;
    this.viewport.y += dy;
  }

  // ─── 访问器 ─────────────────────────────────

  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    this._visible = value;
    this.root.visible = value;
  }
}
