/**
 * EventProbabilityCalculator 单元测试
 *
 * 覆盖：calculateProbability
 */
import { describe, it, expect } from 'vitest';
import { calculateProbability } from '../EventProbabilityCalculator';
import type { ProbabilityCondition } from '../../../core/event/event-encounter.types';

function makeCondition(overrides: Partial<ProbabilityCondition> = {}): ProbabilityCondition {
  return {
    baseProbability: 0.5,
    modifiers: [],
    ...overrides,
  };
}

describe('EventProbabilityCalculator', () => {
  describe('calculateProbability', () => {
    it('基础概率无修正', () => {
      const cond = makeCondition({ baseProbability: 0.5, modifiers: [] });
      const result = calculateProbability(cond);

      expect(result.baseProbability).toBe(0.5);
      expect(result.additiveTotal).toBe(0);
      expect(result.multiplicativeTotal).toBe(1);
      expect(result.finalProbability).toBeCloseTo(0.5, 5);
    });

    it('加法修正', () => {
      const cond = makeCondition({
        baseProbability: 0.3,
        modifiers: [
          { name: 'bonus1', additiveBonus: 0.2, multiplicativeBonus: 1, active: true },
          { name: 'bonus2', additiveBonus: 0.1, multiplicativeBonus: 1, active: true },
        ],
      });

      const result = calculateProbability(cond);

      expect(result.additiveTotal).toBeCloseTo(0.3, 5);
      // (0.3 + 0.3) * 1 = 0.6
      expect(result.finalProbability).toBeCloseTo(0.6, 5);
    });

    it('乘法修正', () => {
      const cond = makeCondition({
        baseProbability: 0.5,
        modifiers: [
          { name: 'mult1', additiveBonus: 0, multiplicativeBonus: 1.5, active: true },
          { name: 'mult2', additiveBonus: 0, multiplicativeBonus: 0.8, active: true },
        ],
      });

      const result = calculateProbability(cond);

      expect(result.multiplicativeTotal).toBeCloseTo(1.2, 5); // 1.5 * 0.8
      // (0.5 + 0) * 1.2 = 0.6
      expect(result.finalProbability).toBeCloseTo(0.6, 5);
    });

    it('混合加法和乘法修正', () => {
      const cond = makeCondition({
        baseProbability: 0.4,
        modifiers: [
          { name: 'add', additiveBonus: 0.2, multiplicativeBonus: 1, active: true },
          { name: 'mul', additiveBonus: 0, multiplicativeBonus: 2.0, active: true },
        ],
      });

      const result = calculateProbability(cond);

      // (0.4 + 0.2) * (1 * 2.0) = 0.6 * 2.0 = 1.2 → clamped to 1
      expect(result.finalProbability).toBe(1);
    });

    it('非活跃修正因子被忽略', () => {
      const cond = makeCondition({
        baseProbability: 0.5,
        modifiers: [
          { name: 'active', additiveBonus: 0.1, multiplicativeBonus: 1, active: true },
          { name: 'inactive', additiveBonus: 0.5, multiplicativeBonus: 3, active: false },
        ],
      });

      const result = calculateProbability(cond);

      expect(result.additiveTotal).toBeCloseTo(0.1, 5);
      expect(result.multiplicativeTotal).toBeCloseTo(1, 5);
      // (0.5 + 0.1) * 1 = 0.6
      expect(result.finalProbability).toBeCloseTo(0.6, 5);
    });

    it('结果 clamp 到 [0, 1]', () => {
      // 上限 clamp
      const condHigh = makeCondition({
        baseProbability: 0.8,
        modifiers: [
          { name: 'big', additiveBonus: 0.5, multiplicativeBonus: 2, active: true },
        ],
      });
      const resultHigh = calculateProbability(condHigh);
      expect(resultHigh.finalProbability).toBe(1);

      // 下限 clamp
      const condLow = makeCondition({
        baseProbability: 0.1,
        modifiers: [
          { name: 'neg', additiveBonus: -0.5, multiplicativeBonus: 1, active: true },
        ],
      });
      const resultLow = calculateProbability(condLow);
      expect(resultLow.finalProbability).toBe(0);
    });

    it('triggered 字段为布尔值', () => {
      const cond = makeCondition({ baseProbability: 0.5, modifiers: [] });
      const result = calculateProbability(cond);
      expect(typeof result.triggered).toBe('boolean');
    });

    it('概率为 0 时 triggered 必为 false', () => {
      const cond = makeCondition({
        baseProbability: 0,
        modifiers: [
          { name: 'neg', additiveBonus: -1, multiplicativeBonus: 1, active: true },
        ],
      });
      const result = calculateProbability(cond);
      expect(result.finalProbability).toBe(0);
      expect(result.triggered).toBe(false);
    });

    it('概率为 1 时 triggered 必为 true', () => {
      const cond = makeCondition({
        baseProbability: 1,
        modifiers: [],
      });
      const result = calculateProbability(cond);
      expect(result.finalProbability).toBe(1);
      expect(result.triggered).toBe(true);
    });
  });
});
