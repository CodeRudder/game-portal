/**
 * 引擎层 — 地图渲染数据生成器
 *
 * 负责计算视口内的渲染数据：视口范围、格子像素坐标、层级划分。
 * 不直接操作 Canvas/PixiJS，仅生成渲染所需的数据结构。
 *
 * 职责：
 *   - 计算视口内可见的格子范围
 *   - 生成格子的像素坐标
 *   - 分配渲染层级
 *   - 处理视口裁剪（只返回可见区域数据）
 *
 * @module engine/map/MapRenderer
 */

import type {
  GridPosition,
  ViewportState,
  TileData,
  LandmarkData,
  TileRenderData,
  ViewportRenderData,
  RenderLayer,
} from '../../core/map';
import {
  MAP_SIZE,
  GRID_CONFIG,
  VIEWPORT_CONFIG,
  REGION_COLORS,
  TERRAIN_COLORS,
} from '../../core/map';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 渲染数据生成器
// ─────────────────────────────────────────────

/**
 * 地图渲染数据生成器
 *
 * 纯计算模块，将世界地图数据转换为渲染层可消费的格式。
 * 不持有 DOM/Canvas 引用，方便单元测试。
 *
 * @example
 * ```ts
 * const renderer = new MapDataRenderer();
 * const data = renderer.computeViewportRenderData(tiles, viewport);
 * // data.tiles → 可见格子的渲染数据
 * // data.visibleLandmarks → 可见地标列表
 * ```
 */
export class MapDataRenderer implements ISubsystem {
  readonly name = 'mapDataRenderer' as const;
  private deps!: ISystemDeps;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void { /* 纯计算渲染器，无帧更新逻辑 */ }
  getState(): unknown { return { name: this.name }; }
  reset(): void { /* 无状态，无需重置 */ }

  // ─── 视口计算（#9, #13）──────────────────────

  /**
   * 计算视口内可见的格子范围
   *
   * 根据视口偏移和缩放，计算当前可见的格子坐标范围。
   *
   * @param viewport - 视口状态
   * @returns 可见格子范围
   */
  computeVisibleRange(viewport: ViewportState): {
    startX: number;
    endX: number;
    startY: number;
    endY: number;
  } {
    const { tileWidth, tileHeight } = GRID_CONFIG;
    const { width, height } = VIEWPORT_CONFIG;
    // FIX-708: zoom=0/NaN除零防护
    const zoom = (!viewport.zoom || !Number.isFinite(viewport.zoom)) ? VIEWPORT_CONFIG.defaultZoom : viewport.zoom;
    const { offsetX, offsetY } = viewport;

    // 视口在世界坐标中的范围
    const worldLeft = -offsetX / zoom;
    const worldTop = -offsetY / zoom;
    const worldRight = worldLeft + width / zoom;
    const worldBottom = worldTop + height / zoom;

    // 转换为格子坐标
    const startX = Math.max(0, Math.floor(worldLeft / tileWidth));
    const startY = Math.max(0, Math.floor(worldTop / tileHeight));
    const endX = Math.min(MAP_SIZE.cols - 1, Math.ceil(worldRight / tileWidth));
    const endY = Math.min(MAP_SIZE.rows - 1, Math.ceil(worldBottom / tileHeight));

    return { startX, endX, startY, endY };
  }

  /**
   * 计算格子总数（视口内）
   *
   * @param range - 可见范围
   * @returns 格子数量
   */
  computeVisibleTileCount(range: {
    startX: number;
    endX: number;
    startY: number;
    endY: number;
  }): number {
    const cols = range.endX - range.startX + 1;
    const rows = range.endY - range.startY + 1;
    return Math.max(0, cols) * Math.max(0, rows);
  }

  // ─── 像素坐标计算 ────────────────────────────

  /**
   * 格子坐标转像素坐标
   *
   * @param pos - 格子坐标
   * @returns 像素坐标 { pixelX, pixelY }
   */
  gridToPixel(pos: GridPosition): { pixelX: number; pixelY: number } {
    return {
      pixelX: pos.x * GRID_CONFIG.tileWidth,
      pixelY: pos.y * GRID_CONFIG.tileHeight,
    };
  }

  /**
   * 像素坐标转格子坐标
   *
   * @param pixelX - 像素X
   * @param pixelY - 像素Y
   * @returns 格子坐标
   */
  pixelToGrid(pixelX: number, pixelY: number): GridPosition {
    return {
      x: Math.floor(pixelX / GRID_CONFIG.tileWidth),
      y: Math.floor(pixelY / GRID_CONFIG.tileHeight),
    };
  }

  // ─── 渲染数据生成 ────────────────────────────

  /**
   * 生成单个格子的渲染数据
   *
   * @param tile - 格子数据
   * @param highlighted - 是否高亮
   * @returns 格子渲染数据
   */
  generateTileRenderData(tile: TileData, highlighted: boolean = false): TileRenderData {
    const { pixelX, pixelY } = this.gridToPixel(tile.pos);

    return {
      pos: { ...tile.pos },
      pixelX,
      pixelY,
      terrainColor: TERRAIN_COLORS[tile.terrain] || '#CCCCCC',
      regionColor: REGION_COLORS[tile.region] || '#CCCCCC',
      landmarkIcon: tile.landmark?.icon,
      highlighted,
      layer: this.computeLayer(tile),
    };
  }

  /**
   * 计算视口内完整渲染数据
   *
   * @param allTiles - 全部格子数据
   * @param viewport - 视口状态
   * @returns 视口渲染数据
   */
  computeViewportRenderData(
    allTiles: TileData[],
    viewport: ViewportState,
  ): ViewportRenderData {
    const range = this.computeVisibleRange(viewport);
    const visibleTiles: TileRenderData[] = [];
    const visibleLandmarks: LandmarkData[] = [];

    for (let y = range.startY; y <= range.endY; y++) {
      for (let x = range.startX; x <= range.endX; x++) {
        const index = y * MAP_SIZE.cols + x;
        const tile = allTiles[index];
        if (!tile) continue;

        visibleTiles.push(this.generateTileRenderData(tile));

        if (tile.landmark) {
          visibleLandmarks.push({ ...tile.landmark });
        }
      }
    }

    return {
      tiles: visibleTiles,
      visibleLandmarks,
      visibleRange: range,
    };
  }

  /**
   * 生成全地图渲染数据（离屏预渲染用）
   *
   * @param allTiles - 全部格子数据
   * @returns 全部格子渲染数据
   */
  generateFullRenderData(allTiles: TileData[]): TileRenderData[] {
    return allTiles.map(tile => this.generateTileRenderData(tile));
  }

  // ─── 层级计算 ────────────────────────────────

  /**
   * 计算格子的渲染层级
   *
   * 层级优先级：territory > landmark > region_overlay > terrain
   *
   * @param tile - 格子数据
   * @returns 渲染层级
   */
  computeLayer(tile: TileData): RenderLayer {
    if (tile.landmark) {
      if (tile.landmark.type === 'city') return 'landmark';
      if (tile.landmark.type === 'pass') return 'landmark';
      if (tile.landmark.type === 'resource') return 'landmark';
    }
    if (tile.terrain === 'city') return 'territory';
    return 'terrain';
  }

  // ─── 视口约束 ────────────────────────────────

  /**
   * 约束视口偏移在合法范围内
   *
   * @param viewport - 视口状态
   * @returns 约束后的视口状态
   */
  clampViewport(viewport: ViewportState): ViewportState {
    const { width, height } = VIEWPORT_CONFIG;
    const { tileWidth, tileHeight } = GRID_CONFIG;
    const mapPixelW = MAP_SIZE.cols * tileWidth * viewport.zoom;
    const mapPixelH = MAP_SIZE.rows * tileHeight * viewport.zoom;

    // 视口不能超出地图边界
    const minOffsetX = width - mapPixelW;
    const minOffsetY = height - mapPixelH;

    return {
      offsetX: Math.min(0, Math.max(minOffsetX, viewport.offsetX)),
      offsetY: Math.min(0, Math.max(minOffsetY, viewport.offsetY)),
      zoom: Math.max(VIEWPORT_CONFIG.minZoom, Math.min(VIEWPORT_CONFIG.maxZoom, viewport.zoom)),
    };
  }

  /**
   * 计算中心视口状态
   *
   * 将视口居中到指定格子坐标。
   *
   * @param targetPos - 目标格子坐标
   * @param zoom - 缩放级别
   * @returns 居中后的视口状态
   */
  centerOnPosition(targetPos: GridPosition, zoom: number = 1.0): ViewportState {
    const { width, height } = VIEWPORT_CONFIG;
    const { tileWidth, tileHeight } = GRID_CONFIG;

    const targetPixelX = targetPos.x * tileWidth + tileWidth / 2;
    const targetPixelY = targetPos.y * tileHeight + tileHeight / 2;

    return {
      offsetX: width / 2 - targetPixelX * zoom,
      offsetY: height / 2 - targetPixelY * zoom,
      zoom: Math.max(VIEWPORT_CONFIG.minZoom, Math.min(VIEWPORT_CONFIG.maxZoom, zoom)),
    };
  }
}
