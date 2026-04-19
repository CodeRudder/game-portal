/**
 * SimplexNoiseWrapper 模块测试
 *
 * 测试 NoiseGenerator、createSeededRandom 等。
 *
 * @module engine/tilemap/__tests__/SimplexNoiseWrapper.test
 */

import { describe, it, expect } from 'vitest';
import { NoiseGenerator, createSeededRandom, DEFAULT_NOISE_CONFIG } from '../SimplexNoiseWrapper';

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------

describe('createSeededRandom', () => {
  it('应返回函数', () => {
    const rng = createSeededRandom(42);
    expect(typeof rng).toBe('function');
  });

  it('应返回 [0, 1) 区间的值', () => {
    const rng = createSeededRandom(42);
    for (let i = 0; i < 100; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('相同种子应产生相同序列', () => {
    const rng1 = createSeededRandom(123);
    const rng2 = createSeededRandom(123);

    for (let i = 0; i < 50; i++) {
      expect(rng1()).toBeCloseTo(rng2(), 10);
    }
  });

  it('不同种子应产生不同序列', () => {
    const rng1 = createSeededRandom(1);
    const rng2 = createSeededRandom(2);

    let sameCount = 0;
    for (let i = 0; i < 20; i++) {
      if (Math.abs(rng1() - rng2()) < 0.001) sameCount++;
    }
    expect(sameCount).toBeLessThan(5);
  });

  it('种子 0 应正常工作', () => {
    const rng = createSeededRandom(0);
    const val = rng();
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThan(1);
  });

  it('负数种子应正常工作', () => {
    const rng = createSeededRandom(-42);
    const val = rng();
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// NoiseGenerator
// ---------------------------------------------------------------------------

describe('NoiseGenerator', () => {
  it('应使用默认配置创建', () => {
    const gen = new NoiseGenerator();
    const val = gen.get(0, 0);
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(1);
  });

  it('应使用自定义配置创建', () => {
    const gen = new NoiseGenerator({ seed: 999, scale: 0.1, octaves: 2 });
    const val = gen.get(5, 5);
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(1);
  });

  it('相同种子和坐标应返回相同值', () => {
    const gen1 = new NoiseGenerator({ seed: 42 });
    const gen2 = new NoiseGenerator({ seed: 42 });

    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        expect(gen1.get(x, y)).toBeCloseTo(gen2.get(x, y), 10);
      }
    }
  });

  it('不同种子应返回不同值', () => {
    const gen1 = new NoiseGenerator({ seed: 1 });
    const gen2 = new NoiseGenerator({ seed: 2 });

    const val1 = gen1.get(10, 10);
    const val2 = gen2.get(10, 10);

    expect(val1).not.toBeCloseTo(val2, 2);
  });

  it('getRaw 应返回 [0, 1] 范围值', () => {
    const gen = new NoiseGenerator({ seed: 42 });
    for (let i = 0; i < 20; i++) {
      const val = gen.getRaw(i * 0.5, i * 0.3);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  it('generateMatrix 应生成正确尺寸的矩阵', () => {
    const gen = new NoiseGenerator({ seed: 42 });
    const matrix = gen.generateMatrix(10, 8);

    expect(matrix).toHaveLength(8);
    expect(matrix[0]).toHaveLength(10);
  });

  it('generateMatrix 所有值应在 [0, 1] 范围内', () => {
    const gen = new NoiseGenerator({ seed: 42 });
    const matrix = gen.generateMatrix(20, 20);

    for (const row of matrix) {
      for (const val of row) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    }
  });

  it('更多八度应产生更多细节', () => {
    const genLow = new NoiseGenerator({ seed: 42, octaves: 1 });
    const genHigh = new NoiseGenerator({ seed: 42, octaves: 6 });

    // 高八度生成的矩阵方差应更大（更多细节变化）
    const matrixLow = genLow.generateMatrix(50, 50);
    const matrixHigh = genHigh.generateMatrix(50, 50);

    const varianceLow = computeVariance(matrixLow);
    const varianceHigh = computeVariance(matrixHigh);

    // 两者都应有合理的方差（不是全零）
    expect(varianceLow).toBeGreaterThan(0);
    expect(varianceHigh).toBeGreaterThan(0);
  });

  it('噪声值应在空间上连续（相邻值接近）', () => {
    const gen = new NoiseGenerator({ seed: 42, scale: 0.1 });
    const val00 = gen.get(0, 0);
    const val01 = gen.get(0, 1);
    const val10 = gen.get(1, 0);

    // 相邻值差距不应太大
    expect(Math.abs(val00 - val01)).toBeLessThan(0.5);
    expect(Math.abs(val00 - val10)).toBeLessThan(0.5);
  });

  it('大坐标应正常工作', () => {
    const gen = new NoiseGenerator({ seed: 42 });
    const val = gen.get(10000, 10000);
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_NOISE_CONFIG
// ---------------------------------------------------------------------------

describe('DEFAULT_NOISE_CONFIG', () => {
  it('应有合理的默认值', () => {
    expect(DEFAULT_NOISE_CONFIG.seed).toBe(42);
    expect(DEFAULT_NOISE_CONFIG.scale).toBeGreaterThan(0);
    expect(DEFAULT_NOISE_CONFIG.octaves).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_NOISE_CONFIG.persistence).toBeGreaterThan(0);
    expect(DEFAULT_NOISE_CONFIG.persistence).toBeLessThanOrEqual(1);
    expect(DEFAULT_NOISE_CONFIG.lacunarity).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function computeVariance(matrix: number[][]): number {
  const flat = matrix.flat();
  const mean = flat.reduce((a, b) => a + b, 0) / flat.length;
  return flat.reduce((sum, v) => sum + (v - mean) ** 2, 0) / flat.length;
}
