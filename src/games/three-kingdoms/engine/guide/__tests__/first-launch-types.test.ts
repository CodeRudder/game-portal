/**
 * first-launch-types 单元测试
 *
 * 验证首次启动类型的运行时常量：
 * - DEFAULT_LANGUAGE 默认语言
 * - DEFAULT_FIRST_LAUNCH_CONFIG 默认配置
 * - QUALITY_THRESHOLDS 画质阈值
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_FIRST_LAUNCH_CONFIG,
  QUALITY_THRESHOLDS,
} from '../first-launch-types';

describe('first-launch-types', () => {
  describe('DEFAULT_LANGUAGE', () => {
    it('should be zh-CN', () => {
      expect(DEFAULT_LANGUAGE).toBe('zh-CN');
    });

    it('should be a non-empty string', () => {
      expect(DEFAULT_LANGUAGE).toBeTruthy();
      expect(typeof DEFAULT_LANGUAGE).toBe('string');
    });
  });

  describe('DEFAULT_FIRST_LAUNCH_CONFIG', () => {
    it('should have defaultLanguage matching DEFAULT_LANGUAGE', () => {
      expect(DEFAULT_FIRST_LAUNCH_CONFIG.defaultLanguage).toBe(DEFAULT_LANGUAGE);
    });

    it('should recommend medium quality by default', () => {
      expect(DEFAULT_FIRST_LAUNCH_CONFIG.recommendedQuality).toBe('medium');
    });

    it('should require storage and network permissions', () => {
      expect(DEFAULT_FIRST_LAUNCH_CONFIG.requiredPermissions).toContain('storage');
      expect(DEFAULT_FIRST_LAUNCH_CONFIG.requiredPermissions).toContain('network');
    });
  });

  describe('QUALITY_THRESHOLDS', () => {
    it('should have low, medium, high tiers', () => {
      expect(QUALITY_THRESHOLDS.low).toBeDefined();
      expect(QUALITY_THRESHOLDS.medium).toBeDefined();
      expect(QUALITY_THRESHOLDS.high).toBeDefined();
    });

    it('should have ascending minCores across tiers', () => {
      expect(QUALITY_THRESHOLDS.low.minCores).toBeLessThan(QUALITY_THRESHOLDS.medium.minCores);
      expect(QUALITY_THRESHOLDS.medium.minCores).toBeLessThan(QUALITY_THRESHOLDS.high.minCores);
    });

    it('should have ascending minMemory across tiers', () => {
      expect(QUALITY_THRESHOLDS.low.minMemory).toBeLessThan(QUALITY_THRESHOLDS.medium.minMemory);
      expect(QUALITY_THRESHOLDS.medium.minMemory).toBeLessThan(QUALITY_THRESHOLDS.high.minMemory);
    });

    it('low tier should require at least 2 cores and 2GB memory', () => {
      expect(QUALITY_THRESHOLDS.low.minCores).toBeGreaterThanOrEqual(2);
      expect(QUALITY_THRESHOLDS.low.minMemory).toBeGreaterThanOrEqual(2);
    });

    it('high tier should require more than medium tier', () => {
      expect(QUALITY_THRESHOLDS.high.minCores).toBeGreaterThan(QUALITY_THRESHOLDS.medium.minCores);
      expect(QUALITY_THRESHOLDS.high.minMemory).toBeGreaterThan(QUALITY_THRESHOLDS.medium.minMemory);
    });
  });
});
