/**
 * TileMap PixiJS v8 渲染器
 *
 * 负责将 TileMapData 渲染到 PixiJS Canvas。采用分层架构：
 *   terrainLayer    → 地形瓦片
 *   decorationLayer → 装饰物
 *   buildingLayer   → 建筑
 *   gridOverlay     → 网格线
 *   highlightLayer  → 高亮（悬停/选中）
 *   labelLayer      → 文字标签
 *
 * 只渲染视口内的瓦片（culling）以优化性能。
 *
 * @module engine/tilemap/TileMapRenderer
 */

import { Container, Graphics, Text } from 'pixi.js';
import type {
  TileMapData,
  Tile,
  Viewport,
  PlacedBuilding,
  BuildingDef,
  MapDecoration,
  TerrainType,
} from './types';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 默认地形颜色映射 */
const TERRAIN_COLORS: Record<string, string> = {
  grass: '#4a7c3f',
  dirt: '#8b7355',
  water: '#3a7ecf',
  mountain: '#6b6b6b',
  forest: '#2d5a1e',
  sand: '#d4b96a',
  snow: '#e8e8f0',
  road: '#a09070',
  bridge: '#8b6914',
};

/** 装饰物颜色映射 */
const DECO_COLORS: Record<string, string> = {
  tree: '#2d7a1e',
  rock: '#888888',
  flower: '#e06090',
  fence: '#a08050',
  lamp: '#ffd700',
  well: '#7070c0',
  bush: '#3a8a2a',
};

/** 高亮默认颜色 */
const HIGHLIGHT_DEFAULT = 'rgba(255, 255, 255, 0.25)';

// ---------------------------------------------------------------------------
// 辅助：将 CSS 颜色字符串转为十六进制数值（PixiJS Graphics 使用）
// ---------------------------------------------------------------------------

function cssColorToHex(css: string): number {
  const clean = css.replace('#', '');
  if (clean.length === 3) {
    return parseInt(
      clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2],
      16,
    );
  }
  return parseInt(clean.substring(0, 6), 16);
}

// ---------------------------------------------------------------------------
// TileMapRenderer
// ---------------------------------------------------------------------------

export class TileMapRenderer {
  /** 根容器，挂载到外部 parent */
  readonly container: Container;

  // 分层容器
  private terrainLayer: Container;
  private decorationLayer: Container;
  private buildingLayer: Container;
  private gridOverlay: Container;
  private highlightLayer: Container;
  private labelLayer: Container;

  /** 当前地图数据 */
  private mapData: TileMapData | null = null;
  /** 瓦片像素大小 */
  private tileSize: number = 48;
  /** 当前视口 */
  private viewport: Viewport = { x: 0, y: 0, width: 800, height: 600, zoom: 1 };
  /** 网格是否可见 */
  private gridVisible: boolean = false;
  /** 建筑定义缓存（用于渲染建筑时查找） */
  private buildingDefs: Map<string, BuildingDef> = new Map();
  /** 当前高亮的瓦片坐标 */
  private highlightedTile: { x: number; y: number } | null = null;
  /** 当前高亮的建筑 ID */
  private highlightedBuildingId: string | null = null;

  // -----------------------------------------------------------------------
  // 生命周期
  // -----------------------------------------------------------------------

  constructor(parent: Container) {
    this.container = new Container();
    this.container.label = 'TileMapRoot';

    // 按层级顺序添加子容器
    this.terrainLayer = new Container();
    this.terrainLayer.label = 'TerrainLayer';
    this.container.addChild(this.terrainLayer);

    this.decorationLayer = new Container();
    this.decorationLayer.label = 'DecorationLayer';
    this.container.addChild(this.decorationLayer);

    this.buildingLayer = new Container();
    this.buildingLayer.label = 'BuildingLayer';
    this.container.addChild(this.buildingLayer);

    this.gridOverlay = new Container();
    this.gridOverlay.label = 'GridOverlay';
    this.gridOverlay.visible = false;
    this.container.addChild(this.gridOverlay);

    this.highlightLayer = new Container();
    this.highlightLayer.label = 'HighlightLayer';
    this.container.addChild(this.highlightLayer);

    this.labelLayer = new Container();
    this.labelLayer.label = 'LabelLayer';
    this.container.addChild(this.labelLayer);

    parent.addChild(this.container);
  }

  /** 销毁所有资源 */
  destroy(): void {
    this.container.destroy({ children: true });
    this.mapData = null;
    this.buildingDefs.clear();
  }

  // -----------------------------------------------------------------------
  // 数据绑定
  // -----------------------------------------------------------------------

  /** 注册建筑定义（在渲染建筑前需要调用） */
  registerBuildingDefs(defs: BuildingDef[]): void {
    for (const def of defs) {
      this.buildingDefs.set(def.id, def);
    }
  }

  /** 设置地图数据并完整渲染 */
  setMapData(data: TileMapData): void {
    this.mapData = data;
    this.tileSize = data.tileSize;
    this.fullRender();
  }

  // -----------------------------------------------------------------------
  // 渲染
  // -----------------------------------------------------------------------

  /** 完整渲染（清空所有图层重绘） */
  private fullRender(): void {
    if (!this.mapData) return;

    // 清空图层
    this.terrainLayer.removeChildren();
    this.decorationLayer.removeChildren();
    this.buildingLayer.removeChildren();
    this.gridOverlay.removeChildren();
    this.highlightLayer.removeChildren();
    this.labelLayer.removeChildren();

    // 渲染所有地形瓦片
    this.renderAllTerrain();

    // 渲染装饰物
    for (const deco of this.mapData.decorations) {
      this.renderDecoration(deco);
    }

    // 渲染建筑
    for (const bld of this.mapData.buildings) {
      const def = this.buildingDefs.get(bld.defId);
      if (def) {
        this.renderBuilding(bld, def);
      }
    }

    // 渲染网格
    if (this.gridVisible) {
      this.renderGrid();
    }
  }

  /** 渲染所有地形瓦片 */
  private renderAllTerrain(): void {
    if (!this.mapData) return;

    const { width, height, tiles } = this.mapData;
    const ts = this.tileSize;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y]?.[x];
        if (!tile) continue;
        this.renderTerrainTile(tile, ts);
      }
    }
  }

  /** 渲染单个地形瓦片 */
  private renderTerrainTile(tile: Tile, ts: number): void {
    const g = new Graphics();
    const colorHex = cssColorToHex(TERRAIN_COLORS[tile.terrain] ?? '#cccccc');

    // 根据变体微调亮度（制造视觉多样性）
    const brightnessOffset = (tile.variant % 3 - 1) * 0x0a0a0a;
    const finalColor = Math.max(0, Math.min(0xffffff, colorHex + brightnessOffset));

    g.rect(tile.x * ts, tile.y * ts, ts, ts);
    g.fill(finalColor);

    // 水域添加波纹效果
    if (tile.terrain === 'water') {
      g.rect(tile.x * ts + 4, tile.y * ts + ts * 0.4, ts - 8, 2);
      g.fill(0x5a9edf);
    }

    this.terrainLayer.addChild(g);
  }

  /** 只渲染视口内的瓦片（culling 优化） */
  renderViewport(viewport: Viewport): void {
    this.viewport = viewport;

    if (!this.mapData) return;

    const ts = this.tileSize;
    const { width: mapW, height: mapH, tiles } = this.mapData;

    // 计算视口覆盖的瓦片范围
    const startCol = Math.max(0, Math.floor(viewport.x / ts));
    const startRow = Math.max(0, Math.floor(viewport.y / ts));
    const endCol = Math.min(mapW, Math.ceil((viewport.x + viewport.width) / ts));
    const endRow = Math.min(mapH, Math.ceil((viewport.y + viewport.height) / ts));

    // 清空地形层并只渲染可见区域
    this.terrainLayer.removeChildren();

    for (let y = startRow; y < endRow; y++) {
      for (let x = startCol; x < endCol; x++) {
        const tile = tiles[y]?.[x];
        if (!tile) continue;
        this.renderTerrainTile(tile, ts);
      }
    }

    // 重新渲染可见装饰物
    this.decorationLayer.removeChildren();
    for (const deco of this.mapData.decorations) {
      if (deco.x >= startCol && deco.x < endCol && deco.y >= startRow && deco.y < endRow) {
        this.renderDecoration(deco);
      }
    }

    // 重新渲染可见建筑
    this.buildingLayer.removeChildren();
    for (const bld of this.mapData.buildings) {
      const def = this.buildingDefs.get(bld.defId);
      if (!def) continue;
      if (
        bld.x + def.size.w > startCol && bld.x < endCol &&
        bld.y + def.size.h > startRow && bld.y < endRow
      ) {
        this.renderBuilding(bld, def);
      }
    }

    // 网格
    if (this.gridVisible) {
      this.renderGrid(startCol, startRow, endCol, endRow);
    }
  }

  /** 渲染建筑 */
  renderBuilding(building: PlacedBuilding, def: BuildingDef): Container {
    const ts = this.tileSize;
    const bw = def.size.w * ts;
    const bh = def.size.h * ts;
    const bx = building.x * ts;
    const by = building.y * ts;

    const container = new Container();
    container.label = `Building_${building.id}`;
    container.position.set(bx, by);

    // 建筑底色
    const bg = new Graphics();
    const colorHex = cssColorToHex(def.color);
    const cornerRadius = 4;

    // 根据状态调整外观
    let alpha = 1;
    if (building.state === 'building') alpha = 0.5 + 0.5 * building.buildProgress;
    if (building.state === 'damaged') alpha = 0.7;
    if (building.state === 'destroyed') alpha = 0.3;

    bg.roundRect(2, 2, bw - 4, bh - 4, cornerRadius);
    bg.fill({ color: colorHex, alpha });

    // 边框
    bg.roundRect(2, 2, bw - 4, bh - 4, cornerRadius);
    bg.stroke({ color: 0x333333, width: 1, alpha });

    container.addChild(bg);

    // Emoji 图标
    const icon = new Text({
      text: def.iconEmoji,
      style: { fontSize: Math.min(bw, bh) * 0.5 },
    });
    icon.anchor.set(0.5);
    icon.position.set(bw / 2, bh / 2 - 4);
    container.addChild(icon);

    // 等级标记
    if (building.level > 1) {
      const lvlText = new Text({
        text: `Lv${building.level}`,
        style: { fontSize: 10, fill: '#ffffff' },
      });
      lvlText.anchor.set(1, 1);
      lvlText.position.set(bw - 4, bh - 2);
      container.addChild(lvlText);
    }

    // 建造进度条
    if (building.state === 'building') {
      const barH = 3;
      const barY = bh - barH - 4;
      const barBg = new Graphics();
      barBg.rect(4, barY, bw - 8, barH);
      barBg.fill(0x333333);
      container.addChild(barBg);

      const barFill = new Graphics();
      barFill.rect(4, barY, (bw - 8) * building.buildProgress, barH);
      barFill.fill(0x00ff00);
      container.addChild(barFill);
    }

    this.buildingLayer.addChild(container);
    return container;
  }

  /** 渲染装饰物 */
  renderDecoration(decoration: MapDecoration): Container {
    const ts = this.tileSize;
    const cx = decoration.x * ts + ts / 2;
    const cy = decoration.y * ts + ts / 2;
    const color = cssColorToHex(decoration.color ?? DECO_COLORS[decoration.type] ?? '#888888');

    const g = new Graphics();
    g.position.set(cx, cy);

    switch (decoration.type) {
      case 'tree':
        // 三角形树冠
        g.moveTo(0, -ts * 0.35);
        g.lineTo(-ts * 0.2, ts * 0.1);
        g.lineTo(ts * 0.2, ts * 0.1);
        g.closePath();
        g.fill(color);
        // 树干
        g.rect(-2, ts * 0.1, 4, ts * 0.15);
        g.fill(0x6b4226);
        break;

      case 'rock':
        g.circle(0, 0, ts * 0.15);
        g.fill(color);
        break;

      case 'flower':
        g.circle(0, 0, ts * 0.08);
        g.fill(color);
        g.circle(-ts * 0.06, -ts * 0.06, ts * 0.05);
        g.fill(0xff90b0);
        break;

      case 'bush':
        g.ellipse(0, 0, ts * 0.18, ts * 0.12);
        g.fill(color);
        break;

      case 'fence':
        g.rect(-ts * 0.2, -1, ts * 0.4, 2);
        g.fill(color);
        g.rect(-ts * 0.15, -ts * 0.12, 2, ts * 0.24);
        g.fill(color);
        g.rect(ts * 0.13, -ts * 0.12, 2, ts * 0.24);
        g.fill(color);
        break;

      case 'lamp':
        g.circle(0, -ts * 0.15, ts * 0.06);
        g.fill(0xffd700);
        g.rect(-1, -ts * 0.1, 2, ts * 0.25);
        g.fill(0x666666);
        break;

      case 'well':
        g.circle(0, 0, ts * 0.15);
        g.fill(0x7070c0);
        g.circle(0, 0, ts * 0.08);
        g.fill(0x3a7ecf);
        break;

      default:
        g.circle(0, 0, ts * 0.1);
        g.fill(color);
    }

    this.decorationLayer.addChild(g);
    return g;
  }

  // -----------------------------------------------------------------------
  // 高亮
  // -----------------------------------------------------------------------

  /** 高亮指定瓦片 */
  highlightTile(x: number, y: number, color: string = HIGHLIGHT_DEFAULT): void {
    this.clearHighlight();
    if (!this.mapData) return;

    const ts = this.tileSize;
    const g = new Graphics();
    const hexColor = cssColorToHex(color.replace('rgba', '').includes(',') ? '#ffffff' : color);

    g.rect(x * ts, y * ts, ts, ts);
    g.fill({ color: hexColor, alpha: 0.3 });
    g.rect(x * ts, y * ts, ts, ts);
    g.stroke({ color: 0xffffff, width: 2, alpha: 0.8 });

    this.highlightLayer.addChild(g);
    this.highlightedTile = { x, y };
  }

  /** 清除瓦片高亮 */
  clearHighlight(): void {
    this.highlightLayer.removeChildren();
    this.highlightedTile = null;
    this.highlightedBuildingId = null;
  }

  /** 高亮建筑 */
  highlightBuilding(buildingId: string): void {
    if (!this.mapData) return;
    const bld = this.mapData.buildings.find((b) => b.id === buildingId);
    const def = bld ? this.buildingDefs.get(bld.defId) : undefined;
    if (!bld || !def) return;

    this.clearHighlight();

    const ts = this.tileSize;
    const g = new Graphics();
    g.rect(bld.x * ts - 2, bld.y * ts - 2, def.size.w * ts + 4, def.size.h * ts + 4);
    g.stroke({ color: 0xffff00, width: 3, alpha: 0.9 });

    this.highlightLayer.addChild(g);
    this.highlightedBuildingId = buildingId;
  }

  // -----------------------------------------------------------------------
  // 网格
  // -----------------------------------------------------------------------

  /** 显示/隐藏网格 */
  toggleGrid(show: boolean): void {
    this.gridVisible = show;
    this.gridOverlay.visible = show;
    if (show && this.mapData) {
      this.renderGrid();
    } else {
      this.gridOverlay.removeChildren();
    }
  }

  /** 渲染网格线 */
  private renderGrid(
    startCol = 0,
    startRow = 0,
    endCol?: number,
    endRow?: number,
  ): void {
    if (!this.mapData) return;

    this.gridOverlay.removeChildren();
    const ts = this.tileSize;
    const { width, height } = this.mapData;
    const sc = startCol;
    const sr = startRow;
    const ec = endCol ?? width;
    const er = endRow ?? height;

    const g = new Graphics();
    g.setStrokeStyle({ color: 0x000000, width: 0.5, alpha: 0.15 });

    // 水平线
    for (let y = sr; y <= er; y++) {
      g.moveTo(sc * ts, y * ts);
      g.lineTo(ec * ts, y * ts);
    }
    // 垂直线
    for (let x = sc; x <= ec; x++) {
      g.moveTo(x * ts, sr * ts);
      g.lineTo(x * ts, er * ts);
    }

    g.stroke();
    this.gridOverlay.addChild(g);
  }

  // -----------------------------------------------------------------------
  // 坐标转换
  // -----------------------------------------------------------------------

  /** 瓦片坐标 → 世界坐标（瓦片中心） */
  tileToWorld(tileX: number, tileY: number): { x: number; y: number } {
    return {
      x: tileX * this.tileSize + this.tileSize / 2,
      y: tileY * this.tileSize + this.tileSize / 2,
    };
  }

  /** 世界坐标 → 瓦片坐标 */
  worldToTile(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: Math.floor(worldX / this.tileSize),
      y: Math.floor(worldY / this.tileSize),
    };
  }

  // -----------------------------------------------------------------------
  // 更新
  // -----------------------------------------------------------------------

  /** 更新单个瓦片地形 */
  updateTile(x: number, y: number, terrain: TerrainType): void {
    if (!this.mapData) return;
    const tile = this.mapData.tiles[y]?.[x];
    if (!tile) return;

    tile.terrain = terrain;

    // 移除旧瓦片图形并重绘（遍历 terrainLayer 子节点）
    this.redrawTerrainTile(tile);
  }

  /** 重绘单个地形瓦片 */
  private redrawTerrainTile(tile: Tile): void {
    const ts = this.tileSize;

    // 查找并移除旧图形
    const idx = this.terrainLayer.children.findIndex((child) => {
      const g = child as Graphics;
      return g.x === tile.x * ts && g.y === tile.y * ts;
    });
    if (idx >= 0) {
      this.terrainLayer.removeChildAt(idx);
    }

    // 绘制新图形
    this.renderTerrainTile(tile, ts);
  }

  /** 更新建筑状态（重新渲染该建筑） */
  updateBuilding(building: PlacedBuilding): void {
    // 移除旧建筑容器
    const label = `Building_${building.id}`;
    const idx = this.buildingLayer.children.findIndex(
      (c) => (c as Container).label === label,
    );
    if (idx >= 0) {
      this.buildingLayer.removeChildAt(idx);
    }

    // 重新渲染
    const def = this.buildingDefs.get(building.defId);
    if (def) {
      this.renderBuilding(building, def);
    }
  }
}
