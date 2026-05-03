/**
 * 天下大地图生成器
 *
 * 生成800×480像素(100×60色块@8px)的ASCII地图
 * 包含: 地形/城市(多字符建筑)/道路(2~4字符宽+边框)/河流/山脉
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── 配置 ───────────────────────────────────────

const WIDTH = 100;
const HEIGHT = 60;
const OUTPUT = path.join(__dirname, '../src/games/three-kingdoms/core/map/maps/world-map.txt');

// ── 地形符号 ───────────────────────────────────

const T = {
  MOUNTAIN: '^',
  WATER: '~',
  FOREST: '#',
  PLAIN: '.',
  GRASS: ',',
  DESERT: '*',
  MUD: '_',
  ROAD: '░',      // 道路(统一符号，渲染器自动处理轮廓)
  FILL: '▒',      // 建筑填充(色块)
} as const;

// ── 城市定义 ───────────────────────────────────

interface CityDef {
  id: string;
  char: string;
  name: string;
  x: number;
  y: number;
  faction: 'wei' | 'shu' | 'wu' | 'neutral';
  w: number; // 建筑宽度
  h: number; // 建筑高度
}

const CITIES: CityDef[] = [
  // 魏国(北方) — 间距15~20
  { id: 'ye', char: 'Y', name: '邺城', x: 30, y: 8, faction: 'wei', w: 4, h: 3 },
  { id: 'xuchang', char: 'X', name: '许昌', x: 35, y: 25, faction: 'wei', w: 4, h: 3 },
  { id: 'puyang', char: 'P', name: '濮阳', x: 15, y: 15, faction: 'wei', w: 4, h: 3 },
  { id: 'beihai', char: 'E', name: '北海', x: 50, y: 5, faction: 'wei', w: 4, h: 3 },
  { id: 'luoyang', char: 'L', name: '洛阳', x: 48, y: 22, faction: 'neutral', w: 5, h: 3 },
  { id: 'changan', char: 'C', name: '长安', x: 25, y: 35, faction: 'neutral', w: 5, h: 3 },

  // 蜀国(西南) — 间距15~25
  { id: 'chengdu', char: 'G', name: '成都', x: 10, y: 48, faction: 'shu', w: 4, h: 3 },
  { id: 'hanzhong', char: 'H', name: '汉中', x: 28, y: 42, faction: 'shu', w: 4, h: 3 },
  { id: 'yongan', char: 'A', name: '永安', x: 40, y: 52, faction: 'shu', w: 4, h: 3 },
  { id: 'nanzhong', char: 'N', name: '南中', x: 5, y: 56, faction: 'shu', w: 4, h: 3 },

  // 吴国(东南) — 间距15~20
  { id: 'jianye', char: 'J', name: '建业', x: 78, y: 38, faction: 'wu', w: 4, h: 3 },
  { id: 'kuaiji', char: 'K', name: '会稽', x: 90, y: 45, faction: 'wu', w: 4, h: 3 },
  { id: 'chaisang', char: 'S', name: '柴桑', x: 65, y: 32, faction: 'wu', w: 4, h: 3 },
  { id: 'lujiang', char: 'B', name: '庐江', x: 58, y: 18, faction: 'wu', w: 4, h: 3 },
  { id: 'xiangyang', char: 'Q', name: '襄阳', x: 52, y: 38, faction: 'neutral', w: 4, h: 3 },

  // 关卡 — 小型
  { id: 'hulao', char: '0', name: '虎牢关', x: 52, y: 24, faction: 'neutral', w: 3, h: 2 },
  { id: 'tongguan', char: '1', name: '潼关', x: 32, y: 32, faction: 'neutral', w: 3, h: 2 },
  { id: 'jiange', char: '2', name: '剑阁', x: 18, y: 45, faction: 'neutral', w: 3, h: 2 },
  { id: 'yangping', char: '3', name: '阳平关', x: 22, y: 40, faction: 'neutral', w: 3, h: 2 },

  // 资源点 — 最小
  { id: 'xutian', char: 'g', name: '许田', x: 40, y: 20, faction: 'neutral', w: 3, h: 2 },
  { id: 'jinkuang', char: 'm', name: '金矿', x: 42, y: 30, faction: 'neutral', w: 3, h: 2 },
  { id: 'daotian', char: 'k', name: '稻田', x: 85, y: 42, faction: 'neutral', w: 3, h: 2 },
  { id: 'bingying', char: 't', name: '兵营', x: 55, y: 28, faction: 'neutral', w: 3, h: 2 },
  { id: 'tianming', char: 'd', name: '天命台', x: 3, y: 52, faction: 'neutral', w: 3, h: 2 },
];

// ── 道路连接 ───────────────────────────────────

interface RoadDef {
  from: string;
  to: string;
  width: number; // 2~4
}

const ROADS: RoadDef[] = [
  // 中原干道(宽)
  { from: 'ye', to: 'luoyang', width: 3 },
  { from: 'xuchang', to: 'luoyang', width: 3 },
  { from: 'puyang', to: 'ye', width: 3 },
  { from: 'puyang', to: 'xuchang', width: 3 },
  { from: 'beihai', to: 'ye', width: 2 },
  { from: 'luoyang', to: 'hulao', width: 3 },
  { from: 'luoyang', to: 'changan', width: 3 },
  { from: 'hulao', to: 'lujiang', width: 2 },
  { from: 'lujiang', to: 'chaisang', width: 2 },
  { from: 'chaisang', to: 'jianye', width: 3 },
  { from: 'jianye', to: 'kuaiji', width: 2 },

  // 西蜀栈道
  { from: 'changan', to: 'tongguan', width: 3 },
  { from: 'tongguan', to: 'hanzhong', width: 2 },
  { from: 'hanzhong', to: 'yangping', width: 2 },
  { from: 'yangping', to: 'chengdu', width: 2 },
  { from: 'chengdu', to: 'jiange', width: 2 },
  { from: 'jiange', to: 'yongan', width: 2 },
  { from: 'chengdu', to: 'nanzhong', width: 2 },
  { from: 'yongan', to: 'nanzhong', width: 2 },

  // 南北纵贯
  { from: 'luoyang', to: 'xiangyang', width: 3 },
  { from: 'xiangyang', to: 'chaisang', width: 2 },
  { from: 'xiangyang', to: 'jianye', width: 2 },

  // 资源点连接
  { from: 'xuchang', to: 'xutian', width: 2 },
  { from: 'luoyang', to: 'jinkuang', width: 2 },
  { from: 'hulao', to: 'bingying', width: 2 },
  { from: 'kuaiji', to: 'daotian', width: 2 },
  { from: 'nanzhong', to: 'tianming', width: 2 },
];

// ── 河流定义 ───────────────────────────────────

interface RiverDef {
  name: string;
  points: Array<{ x: number; y: number }>;
  width: number;
}

const RIVERS: RiverDef[] = [
  {
    name: '黄河',
    width: 3,
    points: [
      { x: 0, y: 16 }, { x: 10, y: 15 }, { x: 20, y: 17 },
      { x: 30, y: 16 }, { x: 40, y: 18 }, { x: 50, y: 17 },
      { x: 60, y: 19 }, { x: 70, y: 18 }, { x: 80, y: 20 },
      { x: 90, y: 19 }, { x: 100, y: 21 },
    ],
  },
  {
    name: '长江',
    width: 4,
    points: [
      { x: 0, y: 38 }, { x: 10, y: 37 }, { x: 20, y: 39 },
      { x: 30, y: 38 }, { x: 40, y: 40 }, { x: 50, y: 39 },
      { x: 60, y: 41 }, { x: 70, y: 40 }, { x: 80, y: 42 },
      { x: 90, y: 41 }, { x: 100, y: 43 },
    ],
  },
];

// ── 生成器 ─────────────────────────────────────

class MapGenerator {
  private grid: string[][] = [];
  private cityPositions: Map<string, { x: number; y: number; cx: number; cy: number }> = new Map();

  constructor() {
    // 初始化网格
    for (let y = 0; y < HEIGHT; y++) {
      this.grid[y] = [];
      for (let x = 0; x < WIDTH; x++) {
        this.grid[y][x] = T.PLAIN;
      }
    }
  }

  generate(): string {
    console.log('生成地形...');
    this.generateTerrain();

    console.log('放置河流...');
    this.placeRivers();

    console.log('放置山脉...');
    this.placeMountains();

    console.log('放置森林...');
    this.placeForests();

    console.log('放置城市...');
    this.placeCities();

    console.log('生成道路...');
    this.generateRoads();

    console.log('添加草地纹理...');
    this.addGrassTexture();

    console.log('输出地图...');
    return this.output();
  }

  // ── 地形生成 ─────────────────────────────────

  private generateTerrain(): void {
    // 基础平原已初始化
    // 西部山地(秦岭/太行山)
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < 15; x++) {
        const noise = this.noise(x * 0.1, y * 0.1);
        if (noise > 0.3) {
          this.grid[y][x] = T.MOUNTAIN;
        } else if (noise > 0.1) {
          this.grid[y][x] = T.GRASS;
        }
      }
    }

    // 东南水域(长江中下游湖泊)
    for (let y = 35; y < 50; y++) {
      for (let x = 55; x < 90; x++) {
        const noise = this.noise(x * 0.08, y * 0.08);
        if (noise > 0.4 && (x > 65 || y > 40)) {
          this.grid[y][x] = T.WATER;
        }
      }
    }
  }

  private placeRivers(): void {
    for (const river of RIVERS) {
      for (let i = 0; i < river.points.length - 1; i++) {
        const p1 = river.points[i];
        const p2 = river.points[i + 1];
        this.drawLine(p1.x, p1.y, p2.x, p2.y, T.WATER, river.width);
      }
    }
  }

  private placeMountains(): void {
    // 秦岭(东西走向, 关中南侧)
    for (let x = 10; x < 35; x++) {
      const y = 30 + Math.floor(this.noise(x * 0.2, 0) * 4);
      this.drawBlob(x, y, 2, T.MOUNTAIN);
    }

    // 太行山(南北走向, 河北西侧)
    for (let y = 5; y < 25; y++) {
      const x = 25 + Math.floor(this.noise(0, y * 0.2) * 3);
      this.drawBlob(x, y, 2, T.MOUNTAIN);
    }

    // 巫山(三峡地区)
    for (let x = 30; x < 40; x++) {
      const y = 44 + Math.floor(this.noise(x * 0.3, 1) * 3);
      this.drawBlob(x, y, 2, T.MOUNTAIN);
    }
  }

  private placeForests(): void {
    // 南方森林
    for (let y = 40; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        if (this.grid[y][x] === T.PLAIN || this.grid[y][x] === T.GRASS) {
          const noise = this.noise(x * 0.15, y * 0.15);
          if (noise > 0.35) {
            this.grid[y][x] = T.FOREST;
          }
        }
      }
    }

    // 中原零散森林
    for (let y = 10; y < 35; y++) {
      for (let x = 30; x < 70; x++) {
        if (this.grid[y][x] === T.PLAIN) {
          const noise = this.noise(x * 0.2, y * 0.2);
          if (noise > 0.5) {
            this.grid[y][x] = T.FOREST;
          }
        }
      }
    }
  }

  private placeCities(): void {
    for (const city of CITIES) {
      this.drawBuilding(city.x, city.y, city.w, city.h, city.name, city.char);
      this.cityPositions.set(city.id, {
        x: city.x,
        y: city.y,
        cx: city.x + Math.floor(city.w / 2),
        cy: city.y + Math.floor(city.h / 2),
      });
    }
  }

  private generateRoads(): void {
    for (const road of ROADS) {
      const from = this.cityPositions.get(road.from);
      const to = this.cityPositions.get(road.to);
      if (!from || !to) continue;

      this.drawRoad(from.cx, from.cy, to.cx, to.cy, road.width);
    }
  }

  private addGrassTexture(): void {
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        if (this.grid[y][x] === T.PLAIN) {
          const noise = this.noise(x * 0.3, y * 0.3);
          if (noise > 0.6) {
            this.grid[y][x] = T.GRASS;
          }
        }
      }
    }
  }

  // ── 绘制工具 ─────────────────────────────────

  private drawBuilding(x: number, y: number, w: number, h: number, name: string, id: string): void {
    // 色块填充整个建筑区域
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const gx = x + dx;
        const gy = y + dy;
        if (gx >= WIDTH || gy >= HEIGHT) continue;
        this.grid[gy][gx] = T.FILL;
      }
    }

    // 字母ID写入建筑中心
    const cx = x + Math.floor(w / 2);
    const cy = y + Math.floor(h / 2);
    if (cx >= 0 && cx < WIDTH && cy >= 0 && cy < HEIGHT) {
      this.grid[cy][cx] = id;
    }
  }

  private drawRoad(x1: number, y1: number, x2: number, y2: number, width: number): void {
    // 使用Bresenham算法绘制弯曲路径
    const points = this.roadPath(x1, y1, x2, y2);

    for (const p of points) {
      // 绘制宽道路(统一使用░，渲染器自动处理轮廓)
      const half = Math.floor(width / 2);
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const gx = p.x + dx;
          const gy = p.y + dy;
          if (gx < 0 || gx >= WIDTH || gy < 0 || gy >= HEIGHT) continue;

          // 跳过城市区域和水域
          if (this.isBuilding(gx, gy) || this.isName(gx, gy)) continue;
          if (this.grid[gy][gx] === T.WATER) continue;

          this.grid[gy][gx] = T.ROAD;
        }
      }
    }
  }

  private roadPath(x1: number, y1: number, x2: number, y2: number): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let cx = x1;
    let cy = y1;
    let step = 0;

    while (cx !== x2 || cy !== y2) {
      points.push({ x: cx, y: cy });

      const e2 = err * 2;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }

      // 添加轻微弯曲
      step++;
      if (step % 8 === 0) {
        const bend = Math.floor(this.noise(cx * 0.1, cy * 0.1) * 3) - 1;
        points.push({ x: cx + bend, y: cy });
      }
    }
    points.push({ x: x2, y: y2 });

    return points;
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number, char: string, width: number): void {
    const points = this.roadPath(x1, y1, x2, y2);
    const half = Math.floor(width / 2);

    for (const p of points) {
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const gx = p.x + dx;
          const gy = p.y + dy;
          if (gx >= 0 && gx < WIDTH && gy >= 0 && gy < HEIGHT) {
            if (!this.isBuilding(gx, gy) && !this.isName(gx, gy)) {
              this.grid[gy][gx] = char;
            }
          }
        }
      }
    }
  }

  private drawBlob(cx: number, cy: number, radius: number, char: string): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const gx = cx + dx;
          const gy = cy + dy;
          if (gx >= 0 && gx < WIDTH && gy >= 0 && gy < HEIGHT) {
            if (!this.isBuilding(gx, gy) && !this.isName(gx, gy) && !this.isRoad(gx, gy)) {
              this.grid[gy][gx] = char;
            }
          }
        }
      }
    }
  }

  private isBuilding(x: number, y: number): boolean {
    return this.grid[y]?.[x] === T.FILL;
  }

  private isName(x: number, y: number): boolean {
    // 建筑内部的字母ID
    const c = this.grid[y]?.[x];
    return c !== undefined && /[A-Za-z]/.test(c) && this.grid[y]?.[x] !== T.FILL;
  }

  private isRoad(x: number, y: number): boolean {
    return this.grid[y]?.[x] === T.ROAD;
  }

  // ── 简单噪声 ─────────────────────────────────

  private noise(x: number, y: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  // ── 输出 ─────────────────────────────────────

  private output(): string {
    const lines: string[] = [];

    // 头部注释
    lines.push('# 天下大地图 — 三国世界');
    lines.push(`# SIZE: ${WIDTH * 8}x${HEIGHT * 8} (${WIDTH}x${HEIGHT} 色块 @ 8px)`);
    lines.push('# 城市: ▒色块填充 + 字母ID居中');
    lines.push('# 道路: ░ (2~4字符宽，渲染器自动处理轮廓)');
    lines.push('# 地形: ^山 ~水 #林 .平 ,草 *沙 _泥');
    lines.push('');
    lines.push(`MAP:天下大地图`);
    lines.push(`SIZE:${WIDTH}x${HEIGHT}`);
    lines.push(`TILE:8x8`);
    lines.push('');

    // 城市映射
    const cityEntries = CITIES.map(c => `${c.char}=${c.name}`).join(',');
    lines.push(`CITY: ${cityEntries}`);
    lines.push('');

    // 地图数据
    for (let y = 0; y < HEIGHT; y++) {
      lines.push(this.grid[y].join(''));
    }

    return lines.join('\n');
  }
}

// ── 执行 ───────────────────────────────────────

const generator = new MapGenerator();
const map = generator.generate();

fs.writeFileSync(OUTPUT, map, 'utf-8');
console.log(`地图已生成: ${OUTPUT}`);
console.log(`尺寸: ${WIDTH}x${HEIGHT} 色块 (${WIDTH * 8}x${HEIGHT * 8} px)`);
