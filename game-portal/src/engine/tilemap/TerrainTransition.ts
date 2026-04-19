/**
 * 地形过渡系统
 *
 * 处理相邻不同地形之间的平滑过渡瓦片。
 * 通过检测相邻地形的方向组合，生成对应的过渡效果。
 *
 * @module engine/tilemap/TerrainTransition
 */

import { BiomeType, BIOME_CONFIGS } from './BiomeConfig';
import { TerrainType } from './types';
import type { Tile, TileMapData } from './types';

// ---------------------------------------------------------------------------
// 过渡方向
// ---------------------------------------------------------------------------

/** 8 方向标记 */
export const DIR_N = 1 << 0;   // 00000001
export const DIR_NE = 1 << 1;  // 00000010
export const DIR_E = 1 << 2;   // 00000100
export const DIR_SE = 1 << 3;  // 00001000
export const DIR_S = 1 << 4;   // 00010000
export const DIR_SW = 1 << 5;  // 00100000
export const DIR_W = 1 << 6;   // 01000000
export const DIR_NW = 1 << 7;  // 10000000

/** 方向偏移量表（与位标记顺序一致） */
const DIR_OFFSETS = [
  { dx: 0, dy: -1, flag: DIR_N },
  { dx: 1, dy: -1, flag: DIR_NE },
  { dx: 1, dy: 0, flag: DIR_E },
  { dx: 1, dy: 1, flag: DIR_SE },
  { dx: 0, dy: 1, flag: DIR_S },
  { dx: -1, dy: 1, flag: DIR_SW },
  { dx: -1, dy: 0, flag: DIR_W },
  { dx: -1, dy: -1, flag: DIR_NW },
];

// ---------------------------------------------------------------------------
// 过渡瓦片信息
// ---------------------------------------------------------------------------

/** 过渡瓦片数据 */
export interface TransitionTile {
  /** 瓦片 X */
  x: number;
  /** 瓦片 Y */
  y: number;
  /** 当前地形 */
  terrain: TerrainType;
  /** 邻接不同地形的位掩码 */
  neighborMask: number;
  /** 需要过渡到的地形列表（按优先级） */
  transitionTo: TerrainType[];
  /** 过渡颜色（混合色） */
  transitionColor: string;
}

// ---------------------------------------------------------------------------
// 颜色混合
// ---------------------------------------------------------------------------

/** 解析十六进制颜色为 RGB */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

/** RGB 转十六进制 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

/**
 * 混合两个颜色
 *
 * @param color1 第一个颜色（十六进制）
 * @param color2 第二个颜色（十六进制）
 * @param ratio 混合比例（0=color1, 1=color2）
 * @returns 混合后的颜色（十六进制）
 */
export function blendColors(color1: string, color2: string, ratio: number = 0.5): string {
  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);

  const r = r1 + (r2 - r1) * ratio;
  const g = g1 + (g2 - g1) * ratio;
  const b = b1 + (b2 - b1) * ratio;

  return rgbToHex(r, g, b);
}

// ---------------------------------------------------------------------------
// TerrainTransition
// ---------------------------------------------------------------------------

export class TerrainTransition {
  /**
   * 计算地图上所有需要过渡的瓦片
   *
   * @param mapData 地图数据
   * @param biomeMap Biome 映射
   * @returns 过渡瓦片列表
   */
  static computeTransitions(
    mapData: TileMapData,
    biomeMap: Map<string, BiomeType>,
  ): TransitionTile[] {
    const transitions: TransitionTile[] = [];
    const { width, height, tiles } = mapData;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y][x];
        const biomeKey = `${x},${y}`;
        const currentBiome = biomeMap.get(biomeKey);

        if (!currentBiome) continue;

        const currentConfig = BIOME_CONFIGS[currentBiome];
        let neighborMask = 0;
        const differentNeighborTerrains = new Set<TerrainType>();

        for (const { dx, dy, flag } of DIR_OFFSETS) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

          const neighborBiome = biomeMap.get(`${nx},${ny}`);
          if (neighborBiome && neighborBiome !== currentBiome) {
            neighborMask |= flag;
            const neighborConfig = BIOME_CONFIGS[neighborBiome];
            differentNeighborTerrains.add(neighborConfig.terrainTypes[0]);
          }
        }

        // 只在有不同邻居时生成过渡
        if (neighborMask > 0 && differentNeighborTerrains.size > 0) {
          const neighborColors: string[] = [];
          for (const terrain of differentNeighborTerrains) {
            // 从 biome 配置中查找颜色
            for (const bt of Object.values(BiomeType)) {
              const cfg = BIOME_CONFIGS[bt];
              if (cfg.terrainTypes.includes(terrain)) {
                neighborColors.push(cfg.color);
                break;
              }
            }
          }

          // 混合颜色
          let transitionColor = currentConfig.color;
          if (neighborColors.length > 0) {
            const avgColor = neighborColors.reduce((acc, c) => {
              const [r, g, b] = hexToRgb(c);
              return [acc[0] + r, acc[1] + g, acc[2] + b];
            }, [0, 0, 0]);
            const n = neighborColors.length;
            const mixedColor = rgbToHex(avgColor[0] / n, avgColor[1] / n, avgColor[2] / n);
            transitionColor = blendColors(currentConfig.color, mixedColor, 0.3);
          }

          transitions.push({
            x,
            y,
            terrain: tile.terrain,
            neighborMask,
            transitionTo: Array.from(differentNeighborTerrains),
            transitionColor,
          });
        }
      }
    }

    return transitions;
  }

  /**
   * 计算单个瓦片的过渡掩码
   *
   * @param tiles 瓦片数组
   * @param x X 坐标
   * @param y Y 坐标
   * @param biomeMap Biome 映射
   * @returns 邻接方向位掩码
   */
  static getNeighborMask(
    tiles: Tile[][],
    x: number,
    y: number,
    biomeMap: Map<string, BiomeType>,
  ): number {
    const height = tiles.length;
    const width = tiles[0]?.length ?? 0;
    const currentBiome = biomeMap.get(`${x},${y}`);
    if (!currentBiome) return 0;

    let mask = 0;
    for (const { dx, dy, flag } of DIR_OFFSETS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const neighborBiome = biomeMap.get(`${nx},${ny}`);
      if (neighborBiome && neighborBiome !== currentBiome) {
        mask |= flag;
      }
    }

    return mask;
  }

  /**
   * 判断两个方向之间是否形成"角"过渡
   *
   * @param mask 方向掩码
   * @returns 是否为角过渡
   */
  static isCornerTransition(mask: number): boolean {
    // 检查对角线方向是否与相邻的两个正交方向同时存在
    const corners = [
      { diag: DIR_NE, ortho1: DIR_N, ortho2: DIR_E },
      { diag: DIR_SE, ortho1: DIR_S, ortho2: DIR_E },
      { diag: DIR_SW, ortho1: DIR_S, ortho2: DIR_W },
      { diag: DIR_NW, ortho1: DIR_N, ortho2: DIR_W },
    ];

    for (const { diag, ortho1, ortho2 } of corners) {
      if ((mask & diag) && !(mask & ortho1) && !(mask & ortho2)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取过渡类型描述（用于调试和可视化）
   */
  static describeTransition(mask: number): string {
    if (mask === 0) return 'none';
    const parts: string[] = [];
    const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    for (let i = 0; i < 8; i++) {
      if (mask & (1 << i)) parts.push(names[i]);
    }
    return parts.join('|');
  }
}
