/**
 * equipment-reexports 单元测试
 *
 * 验证equipment模块的re-export正确性：
 * - generateUid 可用且功能正确
 * - resetUidCounter 可用
 * - weightedPickRarity 可用
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { generateUid, resetUidCounter, weightedPickRarity } from '../equipment-reexports';

describe('equipment-reexports', () => {
  describe('generateUid', () => {
    beforeEach(() => {
      resetUidCounter();
    });

    it('should generate unique IDs', () => {
      const id1 = generateUid();
      const id2 = generateUid();
      expect(id1).not.toBe(id2);
    });

    it('should generate string IDs', () => {
      const id = generateUid();
      expect(typeof id).toBe('string');
    });

    it('should generate non-empty IDs', () => {
      const id = generateUid();
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate IDs with eq_ prefix', () => {
      const id = generateUid();
      expect(id).toMatch(/^eq_/);
    });
  });

  describe('resetUidCounter', () => {
    it('should reset the counter so sequential part restarts', () => {
      resetUidCounter();
      const id1 = generateUid();
      // Extract sequential counter part (4th segment)
      const seq1 = id1.split('_')[2];
      resetUidCounter();
      const id2 = generateUid();
      const seq2 = id2.split('_')[2];
      // After reset, the sequential counter should restart from 0
      expect(seq2).toBe(seq1);
    });
  });

  describe('weightedPickRarity', () => {
    it('should be a function', () => {
      expect(typeof weightedPickRarity).toBe('function');
    });
  });
});
