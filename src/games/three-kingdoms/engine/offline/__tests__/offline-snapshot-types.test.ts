/**
 * offline-snapshot-types 单元测试
 *
 * 验证离线快照类型的运行时常量：
 * - SNAPSHOT_KEY 存储键
 * - SAVE_DATA_KEY 存储键
 */
import { describe, it, expect } from 'vitest';
import { SNAPSHOT_KEY, SAVE_DATA_KEY } from '../offline-snapshot-types';

describe('offline-snapshot-types', () => {
  describe('SNAPSHOT_KEY', () => {
    it('should be a non-empty string', () => {
      expect(SNAPSHOT_KEY).toBeTruthy();
      expect(typeof SNAPSHOT_KEY).toBe('string');
    });

    it('should contain "offline-snapshot" in the key', () => {
      expect(SNAPSHOT_KEY).toContain('offline-snapshot');
    });

    it('should be prefixed with "three-kingdoms"', () => {
      expect(SNAPSHOT_KEY).toMatch(/^three-kingdoms/);
    });

    it('should be the expected value', () => {
      expect(SNAPSHOT_KEY).toBe('three-kingdoms-offline-snapshot');
    });
  });

  describe('SAVE_DATA_KEY', () => {
    it('should be a non-empty string', () => {
      expect(SAVE_DATA_KEY).toBeTruthy();
      expect(typeof SAVE_DATA_KEY).toBe('string');
    });

    it('should contain "offline-save" in the key', () => {
      expect(SAVE_DATA_KEY).toContain('offline-save');
    });

    it('should be prefixed with "three-kingdoms"', () => {
      expect(SAVE_DATA_KEY).toMatch(/^three-kingdoms/);
    });

    it('should be the expected value', () => {
      expect(SAVE_DATA_KEY).toBe('three-kingdoms-offline-save');
    });
  });

  describe('key uniqueness', () => {
    it('SNAPSHOT_KEY and SAVE_DATA_KEY should be different', () => {
      expect(SNAPSHOT_KEY).not.toBe(SAVE_DATA_KEY);
    });
  });
});
