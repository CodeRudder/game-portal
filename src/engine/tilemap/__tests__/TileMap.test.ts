/**
 * TileMap 引擎核心模块测试
 *
 * 覆盖：
 * - 地图生成（MapGenerator）
 * - A* 寻路（PathFinder）— 可达 / 不可达 / 绕障碍
 * - 瓦片坐标转换（TileMapRenderer）
 * - 视口裁剪
 *
 * @module engine/tilemap/__tests__/TileMap.test
 */

import { TerrainType } from '../types';
import type { TerrainDef, TileMapData, PlacedBuilding, Viewport } from '../types';
import { MapGenerator } from '../MapGenerator';
import type { MapGenConfig } from '../MapGenerator';
import { PathFinder } from '../PathFinder';
import { TileMapRenderer } from '../TileMapRenderer';

// ---------------------------------------------------------------------------
// 测试用默认地形定义
// ---------------------------------------------------------------------------

const DEFAULT_TERRAIN_DEFS: TerrainDef[] = [
  { type: TerrainType.GRASS, name: '草地', color: '#4a7c3f', walkable: true, buildable: true, movementCost: 1 },
  { type: TerrainType.DIRT, name: '泥地', color: '#8b7355', walkable: true, buildable: true, movementCost: 1 },
  { type: TerrainType.WATER, name: '水域', color: '#3a7ecf', walkable: false, buildable: false, movementCost: Infinity },
  { type: TerrainType.MOUNTAIN, name: '山地', color: '#6b6b6b', walkable: false, buildable: false, movementCost: Infinity },
  { type: TerrainType.FOREST, name: '森林', color: '#2d5a1e', walkable: true, buildable: false, movementCost: 2 },
  { type: TerrainType.SAND, name: '沙地', color: '#d4b96a', walkable: true, buildable: true, movementCost: 1 },
  { type: TerrainType.SNOW, name: '雪地', color: '#e8e8f0', walkable: true, buildable: false, movementCost: 2 },
  { type: TerrainType.ROAD, name: '道路', color: '#a09070', walkable: true, buildable: false, movementCost: 0.5 },
  { type: TerrainType.BRIDGE, name: '桥梁', color: '#8b6914', walkable: true, buildable: false, movementCost: 1 },
];

// ---------------------------------------------------------------------------
// 辅助：创建全草地地图
// ---------------------------------------------------------------------------

function createGrassMap(w: number, h: number, tileSize = 48): TileMapData {
  return MapGenerator.generate({
    width: w,
    height: h,
    tileSize,
    seed: 42,
    terrainWeights: { [TerrainType.GRASS]: 1 },
    decorationDensity: 0,
  });
}

// ---------------------------------------------------------------------------
// 地图生成测试
// ---------------------------------------------------------------------------

describe('MapGenerator', () => {
  it('应生成指定尺寸的地图', () => {
    const data = createGrassMap(10, 8);

    expect(data.width).toBe(10);
    expect(data.height).toBe(8);
    expect(data.tileSize).toBe(48);
    expect(data.tiles).toHaveLength(8);
    expect(data.tiles[0]).toHaveLength(10);
  });

  it('应生成正确的瓦片坐标', () => {
    const data = createGrassMap(5, 5);

    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        expect(data.tiles[y][x].x).toBe(x);
        expect(data.tiles[y][x].y).toBe(y);
      }
    }
  });

  it('应根据权重生成不同地形', () => {
    const data = MapGenerator.generate({
      width: 50,
      height: 50,
      tileSize: 48,
      seed: 123,
      terrainWeights: {
        [TerrainType.GRASS]: 0.5,
        [TerrainType.WATER]: 0.3,
        [TerrainType.MOUNTAIN]: 0.2,
      },
      decorationDensity: 0,
    });

    const terrainCounts = new Map<string, number>();
    for (const row of data.tiles) {
      for (const tile of row) {
        terrainCounts.set(tile.terrain, (terrainCounts.get(tile.terrain) ?? 0) + 1);
      }
    }

    // 应该至少有 2 种地形
    expect(terrainCounts.size).toBeGreaterThanOrEqual(2);
  });

  it('应生成河流', () => {
    const data = MapGenerator.generate({
      width: 20,
      height: 20,
      tileSize: 48,
      seed: 42,
      terrainWeights: { [TerrainType.GRASS]: 1 },
      riverCount: 1,
      decorationDensity: 0,
    });

    const waterTiles = data.tiles.flat().filter((t) => t.terrain === TerrainType.WATER);
    expect(waterTiles.length).toBeGreaterThan(0);
  });

  it('应放置装饰物', () => {
    const data = MapGenerator.generate({
      width: 20,
      height: 20,
      tileSize: 48,
      seed: 42,
      terrainWeights: { [TerrainType.GRASS]: 0.7, [TerrainType.FOREST]: 0.3 },
      decorationDensity: 0.3,
    });

    expect(data.decorations.length).toBeGreaterThan(0);
  });

  it('应放置建筑并生成道路', () => {
    const data = MapGenerator.generate({
      width: 30,
      height: 30,
      tileSize: 48,
      seed: 42,
      terrainWeights: { [TerrainType.GRASS]: 1 },
      buildingSlots: 3,
      roadCount: 1,
      decorationDensity: 0,
    });

    expect(data.buildings.length).toBeGreaterThan(0);
  });

  it('相同 seed 应生成相同地图', () => {
    const config: MapGenConfig = {
      width: 10,
      height: 10,
      tileSize: 48,
      seed: 999,
      terrainWeights: { [TerrainType.GRASS]: 0.6, [TerrainType.DIRT]: 0.4 },
      decorationDensity: 0.2,
    };

    const a = MapGenerator.generate(config);
    const b = MapGenerator.generate(config);

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        expect(a.tiles[y][x].terrain).toBe(b.tiles[y][x].terrain);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// A* 寻路测试
// ---------------------------------------------------------------------------

describe('PathFinder', () => {
  let pathFinder: PathFinder;

  beforeEach(() => {
    pathFinder = new PathFinder(DEFAULT_TERRAIN_DEFS);
  });

  it('应在全草地地图上找到直线路径', () => {
    const data = createGrassMap(10, 10);
    pathFinder.setMapData(data);

    const path = pathFinder.findPath(0, 0, 5, 0);

    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 5, y: 0 });
  });

  it('应返回包含起点和终点的路径', () => {
    const data = createGrassMap(10, 10);
    pathFinder.setMapData(data);

    const path = pathFinder.findPath(2, 3, 7, 8);

    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ x: 2, y: 3 });
    expect(path[path.length - 1]).toEqual({ x: 7, y: 8 });
  });

  it('路径中每一步应相邻（曼哈顿距离 ≤ 1）', () => {
    const data = createGrassMap(10, 10);
    pathFinder.setMapData(data);

    const path = pathFinder.findPath(0, 0, 9, 9);

    for (let i = 1; i < path.length; i++) {
      const dx = Math.abs(path[i].x - path[i - 1].x);
      const dy = Math.abs(path[i].y - path[i - 1].y);
      expect(dx + dy).toBeLessThanOrEqual(1);
    }
  });

  it('水域和山地应不可通行', () => {
    const data = createGrassMap(10, 10);
    // 设置一行水域阻挡，但留一个缺口在 x=4
    for (let x = 0; x < 10; x++) {
      if (x !== 4) {
        data.tiles[5][x].terrain = TerrainType.WATER;
      }
    }
    pathFinder.setMapData(data);

    // (0,0) → (0,9) 需要通过缺口绕行
    const path = pathFinder.findPath(0, 0, 0, 9);

    // 路径应存在（绕过水域）
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual({ x: 0, y: 9 });

    // 路径不应经过水域
    for (const p of path) {
      expect(data.tiles[p.y][p.x].terrain).not.toBe(TerrainType.WATER);
    }
  });

  it('完全被阻挡时应返回空路径', () => {
    const data = createGrassMap(5, 5);
    // 用水域包围终点
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = 3 + dx;
        const ny = 3 + dy;
        if (nx >= 0 && nx < 5 && ny >= 0 && ny < 5 && !(dx === 0 && dy === 0)) {
          data.tiles[ny][nx].terrain = TerrainType.WATER;
        }
      }
    }
    // 终点本身设为不可通行
    data.tiles[3][3].terrain = TerrainType.MOUNTAIN;

    pathFinder.setMapData(data);
    const path = pathFinder.findPath(0, 0, 3, 3);

    expect(path).toEqual([]);
  });

  it('isWalkable 应正确判断通行性', () => {
    const data = createGrassMap(5, 5);
    data.tiles[2][2].terrain = TerrainType.WATER;
    pathFinder.setMapData(data);

    expect(pathFinder.isWalkable(0, 0)).toBe(true);
    expect(pathFinder.isWalkable(2, 2)).toBe(false);
    expect(pathFinder.isWalkable(-1, 0)).toBe(false);
    expect(pathFinder.isWalkable(10, 10)).toBe(false);
  });

  it('maxDistance 限制应生效', () => {
    const data = createGrassMap(50, 50);
    pathFinder.setMapData(data);

    const path = pathFinder.findPath(0, 0, 40, 40, { maxDistance: 5 });

    expect(path).toEqual([]);
  });

  it('avoidBuildings 应避开建筑格子', () => {
    const data = createGrassMap(10, 10);
    const building: PlacedBuilding = {
      id: 'b1',
      defId: 'house',
      x: 5,
      y: 5,
      level: 1,
      state: 'active',
      buildProgress: 1,
    };
    data.buildings.push(building);
    data.tiles[5][5].buildingId = 'b1';

    pathFinder.setMapData(data);
    const path = pathFinder.findPath(0, 5, 9, 5, { avoidBuildings: true });

    // 路径不应经过建筑格子
    for (const p of path) {
      expect(p.x === 5 && p.y === 5).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 坐标转换测试
// ---------------------------------------------------------------------------

describe('TileMapRenderer 坐标转换', () => {
  it('tileToWorld 应返回瓦片中心坐标', () => {
    const { Container } = require('pixi.js');
    const parent = new Container();
    const renderer = new TileMapRenderer(parent);

    const data = createGrassMap(10, 10, 48);
    renderer.setMapData(data);

    const world = renderer.tileToWorld(3, 5);
    expect(world).toEqual({ x: 3 * 48 + 24, y: 5 * 48 + 24 });

    renderer.destroy();
  });

  it('worldToTile 应返回正确的瓦片坐标', () => {
    const { Container } = require('pixi.js');
    const parent = new Container();
    const renderer = new TileMapRenderer(parent);

    const data = createGrassMap(10, 10, 48);
    renderer.setMapData(data);

    // 中心点
    expect(renderer.worldToTile(72, 120)).toEqual({ x: 1, y: 2 });
    // 左上角
    expect(renderer.worldToTile(0, 0)).toEqual({ x: 0, y: 0 });
    // 边界
    expect(renderer.worldToTile(479, 479)).toEqual({ x: 9, y: 9 });

    renderer.destroy();
  });

  it('tileToWorld ↔ worldToTile 应可逆', () => {
    const { Container } = require('pixi.js');
    const parent = new Container();
    const renderer = new TileMapRenderer(parent);

    const data = createGrassMap(10, 10, 48);
    renderer.setMapData(data);

    // 瓦片坐标 → 世界坐标 → 瓦片坐标
    const tileX = 4;
    const tileY = 6;
    const world = renderer.tileToWorld(tileX, tileY);
    const tile = renderer.worldToTile(world.x, world.y);

    expect(tile).toEqual({ x: tileX, y: tileY });

    renderer.destroy();
  });
});

// ---------------------------------------------------------------------------
// 视口裁剪测试
// ---------------------------------------------------------------------------

describe('TileMapRenderer 视口裁剪', () => {
  it('renderViewport 不应抛出异常', () => {
    const { Container } = require('pixi.js');
    const parent = new Container();
    const renderer = new TileMapRenderer(parent);

    const data = createGrassMap(20, 20, 48);
    renderer.setMapData(data);

    const viewport: Viewport = { x: 0, y: 0, width: 400, height: 300, zoom: 1 };

    expect(() => renderer.renderViewport(viewport)).not.toThrow();

    renderer.destroy();
  });

  it('视口外瓦片不应被渲染', () => {
    const { Container } = require('pixi.js');
    const parent = new Container();
    const renderer = new TileMapRenderer(parent);

    const data = createGrassMap(20, 20, 48);
    renderer.setMapData(data);

    // 只看左上角 5×5 区域
    const viewport: Viewport = { x: 0, y: 0, width: 240, height: 240, zoom: 1 };
    renderer.renderViewport(viewport);

    // terrainLayer 子节点数应远少于全部 400 个瓦片
    const terrainLayer = renderer.container.children[0];
    expect(terrainLayer.children.length).toBeLessThan(100);

    renderer.destroy();
  });
});
