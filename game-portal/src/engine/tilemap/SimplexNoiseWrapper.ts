/**
 * Simplex Noise 封装模块
 *
 * 封装 simplex-noise 库，提供可种子的 2D 噪声生成器。
 * 支持多八度（octave）噪声叠加，用于自然地形生成。
 *
 * @module engine/tilemap/SimplexNoiseWrapper
 */

import { createNoise2D } from 'simplex-noise';

// ---------------------------------------------------------------------------
// 可种子的伪随机数生成器 (Mulberry32)
// ---------------------------------------------------------------------------

/**
 * 创建一个可种子的 PRNG（Mulberry32 算法）
 *
 * @param seed 随机种子
 * @returns 返回 [0, 1) 区间的随机数函数
 */
export function createSeededRandom(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// NoiseGenerator
// ---------------------------------------------------------------------------

/** 噪声生成器配置 */
export interface NoiseConfig {
  /** 随机种子 */
  seed: number;
  /** 噪声缩放（值越大，地形块越大） */
  scale: number;
  /** 八度数（叠加层数，越多细节越丰富） */
  octaves: number;
  /** 持久度（每层衰减系数，0~1） */
  persistence: number;
  /** 空隙度（每层频率倍增系数，通常为 2） */
  lacunarity: number;
}

/** 默认噪声配置 */
export const DEFAULT_NOISE_CONFIG: NoiseConfig = {
  seed: 42,
  scale: 0.05,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2,
};

/**
 * Simplex Noise 生成器
 *
 * 支持多八度叠加的 2D 噪声生成。
 */
export class NoiseGenerator {
  private noise2D: (x: number, y: number) => number;
  private config: NoiseConfig;

  constructor(config: Partial<NoiseConfig> = {}) {
    this.config = { ...DEFAULT_NOISE_CONFIG, ...config };
    const random = createSeededRandom(this.config.seed);
    this.noise2D = createNoise2D(random);
  }

  /**
   * 获取指定坐标的噪声值
   *
   * @param x X 坐标
   * @param y Y 坐标
   * @returns 噪声值 [0, 1]
   */
  get(x: number, y: number): number {
    const { scale, octaves, persistence, lacunarity } = this.config;

    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    let total = 0;

    for (let i = 0; i < octaves; i++) {
      const nx = x * scale * frequency;
      const ny = y * scale * frequency;
      // simplex-noise 返回 [-1, 1]，映射到 [0, 1]
      const val = (this.noise2D(nx, ny) + 1) / 2;

      total += val * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  /**
   * 获取原始噪声值（单八度，无缩放）
   *
   * @param x X 坐标
   * @param y Y 坐标
   * @returns 噪声值 [0, 1]
   */
  getRaw(x: number, y: number): number {
    return (this.noise2D(x, y) + 1) / 2;
  }

  /**
   * 生成一个噪声矩阵
   *
   * @param width 宽度
   * @param height 高度
   * @returns 噪声值二维数组 [0, 1]
   */
  generateMatrix(width: number, height: number): number[][] {
    const matrix: number[][] = [];
    for (let y = 0; y < height; y++) {
      matrix[y] = [];
      for (let x = 0; x < width; x++) {
        matrix[y][x] = this.get(x, y);
      }
    }
    return matrix;
  }
}
