/**
 * 像素地图渲染器 — 通用组件
 *
 * 将解析后的ASCII地图数据渲染为像素风格的Canvas图像。
 * 支持多种地图类型(天下/城池/副本)，根据地图数据自动渲染。
 *
 * 渲染层次(从下到上):
 * 1. 地形层 — 基础色块+纹理
 * 2. 道路层 — 道路路径
 * 3. 建筑层 — 城市/资源点/关卡
 * 4. 动画层 — 行军精灵/事件标记
 * 5. UI层 — 城市名称/状态标记
 *
 * @module engine/map/PixelMapRenderer
 */

import type { ParsedMap, MapCell, ASCIITerrain } from '../../core/map/ASCIIMapParser';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 渲染配置 */
export interface PixelRenderConfig {
  /** 色块尺寸(px) */
  tileSize: number;
  /** 缩放比例 */
  scale: number;
  /** 是否显示城市名称 */
  showCityNames: boolean;
  /** 是否显示网格线(调试用) */
  showGrid: boolean;
  /** 阵营颜色映射 */
  factionColors: Record<string, string>;
}

/** 城市渲染数据 */
export interface CityRenderData {
  id: string;
  name: string;
  x: number;
  y: number;
  faction: string;
  level: number;
  icon?: string;    // 图标(如 🌾💰⚔️🌟🏰🚩)
  type?: string;    // 类型(city/pass/resource)
}

/** 行军精灵数据 */
export interface MarchSprite {
  id: string;
  /** 当前位置(像素坐标) */
  x: number;
  y: number;
  /** 目标位置 */
  targetX: number;
  targetY: number;
  /** 路径点列表 */
  path: Array<{ x: number; y: number }>;
  /** 当前路径索引 */
  pathIndex: number;
  /** 速度(像素/帧) */
  speed: number;
  /** 阵营 */
  faction: string;
  /** 兵力(影响精灵数量) */
  troops: number;
}

// ─────────────────────────────────────────────
// 地形色板
// ─────────────────────────────────────────────

const TERRAIN_COLORS: Record<ASCIITerrain, string> = {
  plain: '#7ec850',
  mountain: '#8b7355',
  water: '#2d6b8a',
  forest: '#2e5a2e',
  road_h: '#b8a07a',
  road_v: '#b8a07a',
  road_cross: '#b8a07a',
  road_diag: '#b8a07a',
  path: '#9a8a6a',
  pass: '#8b6914',
  desert: '#d4b896',
  grass: '#a8d88a',
  mud: '#6b5b3e',
  wall_h: '#8b6914',
  wall_v: '#8b6914',
  wall_tl: '#8b6914',
  wall_tr: '#8b6914',
  wall_bl: '#8b6914',
  wall_br: '#8b6914',
  wall_t: '#8b6914',
  wall_t_r: '#8b6914',
  wall_t_d: '#8b6914',
  wall_t_u: '#8b6914',
  wall_cross: '#8b6914',
  city: '#c0392b',
  resource: '#f39c12',
  outpost: '#7f8c8d',
  player: '#e74c3c',
  event: '#f1c40f',
  unknown: '#34495e',
  ruins: '#95a5a6',
  chest: '#e67e22',
  caravan: '#d35400',
  empty: '#1a1a2e',
};

// ─────────────────────────────────────────────
// PixelMapRenderer
// ─────────────────────────────────────────────

/**
 * 像素地图渲染器
 *
 * 通用渲染组件，根据ASCII地图数据渲染像素风格地图。
 *
 * @example
 * ```ts
 * const renderer = new PixelMapRenderer(canvas);
 * renderer.loadMap(parsedMap);
 * renderer.render();
 * ```
 */
export class PixelMapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private map: ParsedMap | null = null;
  private config: PixelRenderConfig;

  /** 视口偏移 */
  private offsetX = 0;
  private offsetY = 0;

  /** 城市渲染数据(外部注入) */
  private cityData: Map<string, CityRenderData> = new Map();

  /** 行军精灵列表 */
  private marchSprites: MarchSprite[] = [];

  /** 动画帧计数器 */
  private frameCount = 0;

  constructor(canvas: HTMLCanvasElement, config?: Partial<PixelRenderConfig>) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.config = {
      tileSize: 8,
      scale: 1,
      showCityNames: true,
      showGrid: false,
      factionColors: {
        wei: '#2E5090',
        shu: '#8B2500',
        wu: '#2E6B3E',
        neutral: '#6B5B3E',
        player: '#7EC850',
        enemy: '#e74c3c',
      },
      ...config,
    };
  }

  // ── 地图加载 ─────────────────────────────────

  /**
   * 加载解析后的地图数据
   */
  loadMap(map: ParsedMap): void {
    this.map = map;
    this.config.tileSize = map.tileSize;
    this.updateCanvasSize();
  }

  /**
   * 从ASCII文本直接加载地图
   */
  loadFromText(text: string, parser: { parse: (text: string) => ParsedMap }): void {
    const map = parser.parse(text);
    this.loadMap(map);
  }

  // ── 城市数据注入 ─────────────────────────────

  /**
   * 设置城市渲染数据(阵营/等级等)
   */
  setCityData(cities: CityRenderData[]): void {
    this.cityData.clear();
    for (const city of cities) {
      this.cityData.set(city.id, city);
    }
  }

  // ── 行军精灵 ─────────────────────────────────

  /**
   * 添加行军精灵
   */
  addMarchSprite(sprite: MarchSprite): void {
    this.marchSprites.push(sprite);
  }

  /**
   * 移除行军精灵
   */
  removeMarchSprite(id: string): void {
    this.marchSprites = this.marchSprites.filter(s => s.id !== id);
  }

  /**
   * 清空所有行军精灵
   */
  clearMarchSprites(): void {
    this.marchSprites = [];
  }

  // ── 视口控制 ─────────────────────────────────

  /**
   * 设置视口偏移
   */
  setViewport(offsetX: number, offsetY: number): void {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  /**
   * 设置缩放比例
   */
  setScale(scale: number): void {
    this.config.scale = Math.max(0.5, Math.min(4, scale));
    this.updateCanvasSize();
  }

  /**
   * 自动适配缩放并居中地图
   *
   * 根据Canvas容器尺寸和地图尺寸，计算最佳缩放比例使地图填满容器，
   * 然后居中显示。缩放范围: [1.0, 4.0]。
   *
   * @param canvasWidth  Canvas像素宽度
   * @param canvasHeight Canvas像素高度
   */
  autoFit(canvasWidth: number, canvasHeight: number): void {
    if (!this.map) return;
    if (canvasWidth <= 0 || canvasHeight <= 0) return;

    const mapPixelWidth = this.map.width * this.config.tileSize;
    const mapPixelHeight = this.map.height * this.config.tileSize;

    // 让地图刚好填满Canvas的缩放比例
    const fitScale = Math.min(
      canvasWidth / mapPixelWidth,
      canvasHeight / mapPixelHeight,
    );

    // 缩放范围: 最小1.0(不缩小), 最大4.0
    const newScale = Math.max(1.0, Math.min(4.0, fitScale));
    this.config.scale = newScale;

    // 居中: offset = (canvasSize - mapPixelSize * scale) / 2
    const ts = this.config.tileSize * this.config.scale;
    this.offsetX = (canvasWidth - this.map.width * ts) / 2;
    this.offsetY = (canvasHeight - this.map.height * ts) / 2;
  }

  /**
   * 居中到指定地图坐标
   */
  centerOn(gridX: number, gridY: number): void {
    const ts = this.config.tileSize * this.config.scale;
    this.offsetX = gridX * ts - this.canvas.width / 2;
    this.offsetY = gridY * ts - this.canvas.height / 2;
  }

  // ── 渲染 ─────────────────────────────────────

  /**
   * 主渲染循环(调用一次渲染一帧)
   */
  render(): void {
    if (!this.map) return;

    this.frameCount++;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. 地形层
    this.renderTerrain();

    // 2. 道路层
    this.renderRoads();

    // 3. 建筑层
    this.renderCities();

    // 4. 动画层
    this.renderMarchSprites();

    // 5. UI层
    if (this.config.showCityNames) {
      this.renderCityNames();
    }

    // 调试: 网格线
    if (this.config.showGrid) {
      this.renderGrid();
    }
  }

  // ── 地形渲染 ─────────────────────────────────

  private renderTerrain(): void {
    if (!this.map) return;

    const ts = this.config.tileSize * this.config.scale;
    const startX = Math.max(0, Math.floor(this.offsetX / ts));
    const startY = Math.max(0, Math.floor(this.offsetY / ts));
    const endX = Math.min(this.map.width, Math.ceil((this.offsetX + this.canvas.width) / ts) + 1);
    const endY = Math.min(this.map.height, Math.ceil((this.offsetY + this.canvas.height) / ts) + 1);

    // Pass 1: 基础色块(水平合并同类地形)
    for (let y = startY; y < endY; y++) {
      let runStart = startX;
      let runTerrain = this.map.cells[y]?.[startX]?.terrain;

      for (let x = startX; x <= endX; x++) {
        const cell = this.map.cells[y]?.[x];
        const terrain = cell?.terrain;

        if (terrain !== runTerrain || x === endX) {
          // 结束当前run，绘制合并矩形
          if (runStart < x && runTerrain) {
            const color = TERRAIN_COLORS[runTerrain] || TERRAIN_COLORS.empty;
            const px = runStart * ts - this.offsetX;
            const py = y * ts - this.offsetY;
            const w = (x - runStart) * ts;
            this.ctx.fillStyle = color;
            this.ctx.fillRect(px, py, w, ts);
          }
          runStart = x;
          runTerrain = terrain;
        }
      }
    }

    // Pass 2: 地形过渡色(相邻不同地形之间的渐变)
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const cell = this.map.cells[y]?.[x];
        if (!cell) continue;

        const px = x * ts - this.offsetX;
        const py = y * ts - this.offsetY;

        this.renderTerrainTransitions(cell, px, py, ts, x, y);
      }
    }

    // Pass 3: 地形纹理
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const cell = this.map.cells[y]?.[x];
        if (!cell) continue;

        const px = x * ts - this.offsetX;
        const py = y * ts - this.offsetY;

        this.renderTerrainTexture(cell, px, py, ts);
      }
    }
  }

  private renderTerrainTexture(cell: MapCell, px: number, py: number, ts: number): void {
    const ctx = this.ctx;
    const seed = cell.x * 31 + cell.y * 17; // 伪随机种子

    switch (cell.terrain) {
      case 'mountain': {
        // 山峰主体(三角形)
        ctx.fillStyle = '#a09080';
        ctx.beginPath();
        ctx.moveTo(px + ts / 2, py + ts * 0.15);
        ctx.lineTo(px + ts * 0.85, py + ts * 0.85);
        ctx.lineTo(px + ts * 0.15, py + ts * 0.85);
        ctx.fill();
        // 右侧亮面
        ctx.fillStyle = '#b8a898';
        ctx.beginPath();
        ctx.moveTo(px + ts / 2, py + ts * 0.15);
        ctx.lineTo(px + ts * 0.85, py + ts * 0.85);
        ctx.lineTo(px + ts / 2, py + ts * 0.85);
        ctx.fill();
        // 左侧暗面
        ctx.fillStyle = '#6b5b4b';
        ctx.beginPath();
        ctx.moveTo(px + ts / 2, py + ts * 0.15);
        ctx.lineTo(px + ts / 2, py + ts * 0.85);
        ctx.lineTo(px + ts * 0.15, py + ts * 0.85);
        ctx.fill();
        // 山脊线
        ctx.strokeStyle = '#8a7a6a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + ts / 2, py + ts * 0.15);
        ctx.lineTo(px + ts * 0.35, py + ts * 0.55);
        ctx.stroke();
        // 雪顶(部分山峰)
        if (seed % 3 === 0) {
          ctx.fillStyle = '#e8e8f0';
          ctx.beginPath();
          ctx.moveTo(px + ts / 2, py + ts * 0.15);
          ctx.lineTo(px + ts * 0.6, py + ts * 0.35);
          ctx.lineTo(px + ts * 0.4, py + ts * 0.35);
          ctx.fill();
        }
        break;
      }

      case 'water': {
        // 水波纹(多层动画)
        const wavePhase = this.frameCount * 0.4 + cell.x * 5 + cell.y * 3;
        ctx.strokeStyle = '#4a9aba';
        ctx.lineWidth = 1;
        // 上层波纹
        ctx.beginPath();
        ctx.moveTo(px, py + ts * 0.25 + Math.sin(wavePhase * 0.3) * 1.5);
        ctx.quadraticCurveTo(px + ts / 2, py + ts * 0.25 + Math.sin(wavePhase * 0.3 + 1.5) * 1.5, px + ts, py + ts * 0.25 + Math.sin(wavePhase * 0.3 + 3) * 1.5);
        ctx.stroke();
        // 下层波纹(更暗)
        ctx.strokeStyle = '#3a7a9a';
        ctx.beginPath();
        ctx.moveTo(px, py + ts * 0.55 + Math.sin(wavePhase * 0.25 + 2) * 1);
        ctx.quadraticCurveTo(px + ts / 2, py + ts * 0.55 + Math.sin(wavePhase * 0.25 + 3.5) * 1, px + ts, py + ts * 0.55 + Math.sin(wavePhase * 0.25 + 5) * 1);
        ctx.stroke();
        // 水面反光点
        if ((seed + Math.floor(this.frameCount / 20)) % 7 === 0) {
          ctx.fillStyle = '#8ac8e8';
          ctx.fillRect(px + ts * 0.3, py + ts * 0.4, 2, 1);
        }
        break;
      }

      case 'forest': {
        // 多层树冠
        const treeVariant = seed % 3;
        if (treeVariant === 0) {
          // 大树: 宽树冠
          ctx.fillStyle = '#2a6a2a';
          ctx.beginPath();
          ctx.arc(px + ts / 2, py + ts * 0.35, ts * 0.38, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#3a8a3a';
          ctx.beginPath();
          ctx.arc(px + ts * 0.45, py + ts * 0.3, ts * 0.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (treeVariant === 1) {
          // 中树: 圆锥形
          ctx.fillStyle = '#2e5a2e';
          ctx.beginPath();
          ctx.moveTo(px + ts / 2, py + ts * 0.1);
          ctx.lineTo(px + ts * 0.8, py + ts * 0.7);
          ctx.lineTo(px + ts * 0.2, py + ts * 0.7);
          ctx.fill();
          ctx.fillStyle = '#3a7a3a';
          ctx.beginPath();
          ctx.moveTo(px + ts / 2, py + ts * 0.25);
          ctx.lineTo(px + ts * 0.7, py + ts * 0.6);
          ctx.lineTo(px + ts * 0.3, py + ts * 0.6);
          ctx.fill();
        } else {
          // 小树: 灌木丛
          ctx.fillStyle = '#3a7a3a';
          ctx.beginPath();
          ctx.arc(px + ts * 0.35, py + ts * 0.5, ts * 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#2e6a2e';
          ctx.beginPath();
          ctx.arc(px + ts * 0.65, py + ts * 0.45, ts * 0.22, 0, Math.PI * 2);
          ctx.fill();
        }
        // 树干
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(px + ts * 0.44, py + ts * 0.6, ts * 0.12, ts * 0.35);
        break;
      }

      case 'grass': {
        // 草丛(多根草叶)
        ctx.fillStyle = '#7ab858';
        for (let i = 0; i < 5; i++) {
          const gx = px + ((seed + i * 13) % (ts - 2)) + 1;
          const gy = py + ((seed + i * 17) % (ts - 3)) + 1;
          ctx.fillRect(gx, gy, 1, 2);
          ctx.fillRect(gx - 1, gy + 1, 1, 1);
          ctx.fillRect(gx + 1, gy + 1, 1, 1);
        }
        // 偶尔有小花
        if (seed % 11 === 0) {
          ctx.fillStyle = '#e8e040';
          ctx.fillRect(px + ts * 0.6, py + ts * 0.3, 2, 2);
        }
        break;
      }

      case 'plain': {
        // 平原纹理(浅色噪点)
        ctx.fillStyle = '#90d870';
        const plainSeed = seed % 5;
        if (plainSeed < 2) {
          ctx.fillRect(px + ts * 0.3, py + ts * 0.4, 1, 1);
        }
        if (plainSeed < 1) {
          ctx.fillRect(px + ts * 0.7, py + ts * 0.6, 1, 1);
          ctx.fillRect(px + ts * 0.5, py + ts * 0.2, 1, 1);
        }
        break;
      }

      case 'desert': {
        // 沙丘纹理
        ctx.fillStyle = '#c4a876';
        for (let i = 0; i < 6; i++) {
          const sx = px + ((seed + i * 11) % (ts - 1));
          const sy = py + ((seed + i * 13) % (ts - 1));
          ctx.fillRect(sx, sy, 1, 1);
        }
        // 沙丘波纹
        ctx.strokeStyle = '#b8a06a';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(px, py + ts * 0.6);
        ctx.quadraticCurveTo(px + ts * 0.5, py + ts * 0.5, px + ts, py + ts * 0.65);
        ctx.stroke();
        // 高光沙粒
        ctx.fillStyle = '#d8c8a0';
        ctx.fillRect(px + ts * 0.2, py + ts * 0.3, 1, 1);
        ctx.fillRect(px + ts * 0.7, py + ts * 0.5, 1, 1);
        break;
      }
    }
  }

  /**
   * 渲染地形过渡色 — 相邻不同地形之间的渐变边缘
   */
  private renderTerrainTransitions(cell: MapCell, px: number, py: number, ts: number, gx: number, gy: number): void {
    if (!this.map) return;
    const ctx = this.ctx;
    const blendWidth = Math.max(2, ts * 0.3); // 渐变带宽度

    // 4个方向的邻居
    const neighbors = [
      { dx: 0, dy: -1, edge: 'top' as const },
      { dx: 0, dy: 1, edge: 'bottom' as const },
      { dx: -1, dy: 0, edge: 'left' as const },
      { dx: 1, dy: 0, edge: 'right' as const },
    ];

    for (const { dx, dy, edge } of neighbors) {
      const nx = gx + dx;
      const ny = gy + dy;
      const neighbor = this.map.cells[ny]?.[nx];
      if (!neighbor) continue;

      // 只在不同地形之间绘制过渡
      if (neighbor.terrain === cell.terrain) continue;

      const neighborColor = TERRAIN_COLORS[neighbor.terrain] || TERRAIN_COLORS.empty;
      const selfColor = TERRAIN_COLORS[cell.terrain] || TERRAIN_COLORS.empty;

      // 使用半透明渐变实现过渡
      const gradient = this.getEdgeGradient(ctx, edge, px, py, ts, blendWidth, selfColor, neighborColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(px, py, ts, ts);
    }
  }

  /**
   * 获取边缘渐变
   */
  private getEdgeGradient(
    ctx: CanvasRenderingContext2D,
    edge: 'top' | 'bottom' | 'left' | 'right',
    px: number, py: number, ts: number, bw: number,
    selfColor: string, neighborColor: string,
  ): CanvasGradient {
    let gradient: CanvasGradient;
    switch (edge) {
      case 'top':
        gradient = ctx.createLinearGradient(px, py, px, py + bw);
        gradient.addColorStop(0, neighborColor + 'aa');
        gradient.addColorStop(1, selfColor + '00');
        break;
      case 'bottom':
        gradient = ctx.createLinearGradient(px, py + ts - bw, px, py + ts);
        gradient.addColorStop(0, selfColor + '00');
        gradient.addColorStop(1, neighborColor + 'aa');
        break;
      case 'left':
        gradient = ctx.createLinearGradient(px, py, px + bw, py);
        gradient.addColorStop(0, neighborColor + 'aa');
        gradient.addColorStop(1, selfColor + '00');
        break;
      case 'right':
        gradient = ctx.createLinearGradient(px + ts - bw, py, px + ts, py);
        gradient.addColorStop(0, selfColor + '00');
        gradient.addColorStop(1, neighborColor + 'aa');
        break;
    }
    return gradient;
  }

  // ── 道路渲染 ─────────────────────────────────

  private renderRoads(): void {
    if (!this.map) return;

    const ts = this.config.tileSize * this.config.scale;
    const roadWidth = Math.max(2, ts * 0.4);
    const roadColor = '#b8a07a';
    const roadShadow = '#8a7a5a';

    for (const road of this.map.roads) {
      const fromX = road.from.x * ts - this.offsetX + ts / 2;
      const fromY = road.from.y * ts - this.offsetY + ts / 2;
      const toX = road.to.x * ts - this.offsetX + ts / 2;
      const toY = road.to.y * ts - this.offsetY + ts / 2;

      // 道路阴影
      this.ctx.strokeStyle = roadShadow;
      this.ctx.lineWidth = roadWidth + 1;
      this.ctx.beginPath();
      this.ctx.moveTo(fromX, fromY + 1);
      this.ctx.lineTo(toX, toY + 1);
      this.ctx.stroke();

      // 道路主体
      this.ctx.strokeStyle = roadColor;
      this.ctx.lineWidth = roadWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(fromX, fromY);
      this.ctx.lineTo(toX, toY);
      this.ctx.stroke();
    }
  }

  // ── 城市渲染 ─────────────────────────────────

  private renderCities(): void {
    if (!this.map) return;

    const ts = this.config.tileSize * this.config.scale;

    // D3-3: 视口裁剪 - 计算可见区域
    const viewStartX = Math.floor(this.offsetX / ts) - 5;
    const viewStartY = Math.floor(this.offsetY / ts) - 5;
    const viewEndX = Math.ceil((this.offsetX + this.canvas.width) / ts) + 5;
    const viewEndY = Math.ceil((this.offsetY + this.canvas.height) / ts) + 5;

    // 构建建筑框架中已渲染的城市ID集合和已渲染位置集合
    const renderedBuildingIds = new Set<string>();
    const renderedPositions = new Set<string>();

    // 渲染建筑框架(从地图数据中检测)
    for (const city of this.map.cities) {
      // D3-3: 视口裁剪 - 跳过不在视口内的城市
      if (city.x < viewStartX || city.x > viewEndX || city.y < viewStartY || city.y > viewEndY) {
        continue;
      }
      const cityRender = this.cityData.get(city.id);
      const faction = cityRender?.faction || 'neutral';
      const factionColor = this.config.factionColors[faction] || this.config.factionColors.neutral;

      // 查找建筑框架范围
      const bounds = this.findBuildingBounds(city.x, city.y);
      if (!bounds) continue;

      renderedBuildingIds.add(city.id);
      // 记录建筑覆盖的所有位置(防止重复渲染)
      for (let by = bounds.y1; by <= bounds.y2; by++) {
        for (let bx = bounds.x1; bx <= bounds.x2; bx++) {
          renderedPositions.add(`${bx},${by}`);
        }
      }

      const px = bounds.x1 * ts - this.offsetX;
      const py = bounds.y1 * ts - this.offsetY;
      const w = (bounds.x2 - bounds.x1 + 1) * ts;
      const h = (bounds.y2 - bounds.y1 + 1) * ts;

      // 建筑填充(阵营色)
      this.ctx.fillStyle = factionColor + '80'; // 半透明
      this.ctx.fillRect(px + ts, py + ts, w - ts * 2, h - ts * 2);

      // 建筑边框
      this.ctx.strokeStyle = factionColor;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(px + ts * 0.5, py + ts * 0.5, w - ts, h - ts);

      // 城市名称由 renderCityNames() 统一渲染，避免重影
    }

    // 渲染资源点/关卡等不在建筑框架中的地标(使用图标)
    for (const [id, city] of this.cityData) {
      // 跳过已在建筑框架中渲染的城市
      if (renderedBuildingIds.has(id)) continue;

      // 跳过与建筑框架位置重叠的城市(防止重影)
      const posKey = `${city.x},${city.y}`;
      if (renderedPositions.has(posKey)) continue;

      const px = city.x * ts - this.offsetX;
      const py = city.y * ts - this.offsetY;

      // 检查是否在视口范围内
      if (px + ts < 0 || px > this.canvas.width || py + ts < 0 || py > this.canvas.height) continue;

      // 资源点背景色块(阵营色半透明)
      const factionColor = this.config.factionColors[city.faction] || this.config.factionColors.neutral;
      this.ctx.fillStyle = factionColor + '60';
      this.ctx.fillRect(px, py, ts, ts);

      // 资源点边框
      this.ctx.strokeStyle = factionColor;
      this.ctx.lineWidth = Math.max(1, ts * 0.15);
      this.ctx.strokeRect(px, py, ts, ts);

      // 资源点图标
      if (city.icon) {
        const fontSize = Math.max(8, ts * 0.9);
        this.ctx.font = `${fontSize}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(city.icon, px + ts / 2, py + ts / 2);
      }
    }
  }

  /**
   * 从建筑左上角位置查找建筑边界
   */
  private findBuildingBounds(startX: number, startY: number): { x1: number; y1: number; x2: number; y2: number } | null {
    if (!this.map) return null;

    // 向右找 ┐
    let endX = -1;
    for (let x = startX + 1; x < this.map.width; x++) {
      const ch = this.map.cells[startY]?.[x]?.char;
      if (ch === '┐') { endX = x; break; }
      if (ch !== '─') break;
    }
    if (endX < 0) return null;

    // 向下找 └
    let endY = -1;
    for (let y = startY + 1; y < this.map.height; y++) {
      const ch = this.map.cells[y]?.[startX]?.char;
      if (ch === '└') { endY = y; break; }
      if (ch !== '│' && ch !== ' ') break;
    }
    if (endY < 0) return null;

    // 验证 ┘
    if (this.map.cells[endY]?.[endX]?.char !== '┘') return null;

    return { x1: startX, y1: startY, x2: endX, y2: endY };
  }

  // ── 城市名称 ─────────────────────────────────

  private renderCityNames(): void {
    if (!this.map) return;

    const ts = this.config.tileSize * this.config.scale;
    const fontSize = Math.max(8, ts * 0.8);

    this.ctx.font = `bold ${fontSize}px monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';

    // 构建 map.cities 中已渲染的位置集合(用坐标去重，避免ID不匹配导致重影)
    const renderedPositions = new Set<string>();

    // 第一轮: 渲染建筑框架城市(从 map.cities 获取位置)
    for (const city of this.map.cities) {
      // 检查是否有建筑框架(以 ┌ 开头)
      const hasBuilding = this.map.cells[city.y]?.[city.x]?.char === '┌';

      // 从 cityData 获取名称(优先)，fallback 到 map.cities 的 id
      const cityRender = this.cityData.get(city.id);
      const name = cityRender?.name || city.id;

      let px: number;
      let py: number;

      if (hasBuilding) {
        // 建筑框架城市: 名称在建筑下方
        px = city.x * ts - this.offsetX + ts / 2;
        py = city.y * ts - this.offsetY + ts * 1.5;
      } else {
        // 单字母城市: 名称在位置下方
        px = city.x * ts - this.offsetX + ts / 2;
        py = city.y * ts - this.offsetY + ts * 1.2;
      }

      renderedPositions.add(`${city.x},${city.y}`);

      // 文字阴影
      this.ctx.fillStyle = '#000000';
      this.ctx.fillText(name, px + 1, py + 1);

      // 文字
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(name, px, py);
    }

    // 第二轮: 渲染不在 map.cities 中的 cityData 条目(如动态生成的资源点)
    for (const [, city] of this.cityData) {
      const posKey = `${city.x},${city.y}`;
      if (renderedPositions.has(posKey)) continue;

      const px = city.x * ts - this.offsetX + ts / 2;
      const py = city.y * ts - this.offsetY + ts * 1.2;

      // 检查是否在视口范围内
      if (px < -50 || px > this.canvas.width + 50 || py < -20 || py > this.canvas.height + 20) continue;

      const name = city.name;

      // 文字阴影
      this.ctx.fillStyle = '#000000';
      this.ctx.fillText(name, px + 1, py + 1);

      // 文字
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(name, px, py);
    }
  }

  // ── 行军精灵渲染 ─────────────────────────────

  private renderMarchSprites(): void {
    const ts = this.config.tileSize * this.config.scale;

    for (const sprite of this.marchSprites) {
      const px = sprite.x - this.offsetX;
      const py = sprite.y - this.offsetY;
      const factionColor = this.config.factionColors[sprite.faction] || '#ffffff';

      // 计算显示的精灵数量
      const spriteCount = sprite.troops > 1000 ? 5 : sprite.troops > 500 ? 3 : 1;
      const spacing = ts * 0.4;

      for (let i = 0; i < spriteCount; i++) {
        const sx = px - (spriteCount - 1) * spacing / 2 + i * spacing;
        const sy = py + Math.sin(this.frameCount * 0.2 + i) * 2;

        // 精灵身体(小方块)
        this.ctx.fillStyle = factionColor;
        this.ctx.fillRect(sx - 2, sy - 3, 4, 6);

        // 精灵头部
        this.ctx.fillStyle = '#f0d0b0';
        this.ctx.fillRect(sx - 1, sy - 4, 2, 2);

        // 精灵旗帜(第一人)
        if (i === 0) {
          this.ctx.fillStyle = factionColor;
          this.ctx.fillRect(sx + 2, sy - 6, 3, 2);
        }
      }
    }
  }

  // ── 网格线(调试) ─────────────────────────────

  private renderGrid(): void {
    const ts = this.config.tileSize * this.config.scale;
    this.ctx.strokeStyle = '#ffffff20';
    this.ctx.lineWidth = 0.5;

    for (let x = 0; x <= (this.map?.width || 0); x++) {
      const px = x * ts - this.offsetX;
      this.ctx.beginPath();
      this.ctx.moveTo(px, 0);
      this.ctx.lineTo(px, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = 0; y <= (this.map?.height || 0); y++) {
      const py = y * ts - this.offsetY;
      this.ctx.beginPath();
      this.ctx.moveTo(0, py);
      this.ctx.lineTo(this.canvas.width, py);
      this.ctx.stroke();
    }
  }

  // ── 工具方法 ─────────────────────────────────

  private updateCanvasSize(): void {
    // Canvas尺寸由外部设置，这里不做修改
  }

  /**
   * 获取地图坐标对应的网格位置
   */
  screenToGrid(screenX: number, screenY: number): { x: number; y: number } | null {
    const ts = this.config.tileSize * this.config.scale;
    const gridX = Math.floor((screenX + this.offsetX) / ts);
    const gridY = Math.floor((screenY + this.offsetY) / ts);

    if (this.map && gridX >= 0 && gridX < this.map.width && gridY >= 0 && gridY < this.map.height) {
      return { x: gridX, y: gridY };
    }
    return null;
  }

  /**
   * 获取网格位置对应的像素坐标
   */
  gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
    const ts = this.config.tileSize * this.config.scale;
    return {
      x: gridX * ts - this.offsetX,
      y: gridY * ts - this.offsetY,
    };
  }

  /**
   * 获取指定网格位置的单元格
   */
  getCellAt(gridX: number, gridY: number): MapCell | null {
    return this.map?.cells[gridY]?.[gridX] || null;
  }
}
