/**
 * ActivitySystemConfig 测试
 *
 * 覆盖：
 *   - 并发上限配置完整性
 *   - 离线效率配置
 *   - 常量值校验
 *   - seasonHelper 委托对象接口
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONCURRENCY_CONFIG,
  DEFAULT_OFFLINE_EFFICIENCY,
  ACTIVITY_SAVE_VERSION,
  BASE_POINTS_PER_SECOND,
  seasonHelper,
  DEFAULT_SEASON_THEMES,
} from '../ActivitySystemConfig';

describe('ActivitySystemConfig', () => {
  describe('DEFAULT_CONCURRENCY_CONFIG', () => {
    it('应包含所有活动类型的并发上限', () => {
      expect(DEFAULT_CONCURRENCY_CONFIG).toHaveProperty('maxSeason');
      expect(DEFAULT_CONCURRENCY_CONFIG).toHaveProperty('maxLimitedTime');
      expect(DEFAULT_CONCURRENCY_CONFIG).toHaveProperty('maxDaily');
      expect(DEFAULT_CONCURRENCY_CONFIG).toHaveProperty('maxFestival');
      expect(DEFAULT_CONCURRENCY_CONFIG).toHaveProperty('maxAlliance');
      expect(DEFAULT_CONCURRENCY_CONFIG).toHaveProperty('maxTotal');
    });

    it('maxTotal 应大于等于各单项上限之和', () => {
      const { maxSeason, maxLimitedTime, maxDaily, maxFestival, maxAlliance, maxTotal } = DEFAULT_CONCURRENCY_CONFIG;
      const sumOfTypes = maxSeason + maxLimitedTime + maxDaily + maxFestival + maxAlliance;
      expect(maxTotal).toBeLessThanOrEqual(sumOfTypes);
      expect(maxTotal).toBeGreaterThan(0);
    });

    it('各并发上限应为正整数', () => {
      for (const val of Object.values(DEFAULT_CONCURRENCY_CONFIG)) {
        expect(val).toBeGreaterThan(0);
        expect(Number.isInteger(val)).toBe(true);
      }
    });
  });

  describe('DEFAULT_OFFLINE_EFFICIENCY', () => {
    it('应包含所有活动类型的离线效率', () => {
      expect(DEFAULT_OFFLINE_EFFICIENCY).toHaveProperty('season');
      expect(DEFAULT_OFFLINE_EFFICIENCY).toHaveProperty('limitedTime');
      expect(DEFAULT_OFFLINE_EFFICIENCY).toHaveProperty('daily');
      expect(DEFAULT_OFFLINE_EFFICIENCY).toHaveProperty('festival');
      expect(DEFAULT_OFFLINE_EFFICIENCY).toHaveProperty('alliance');
    });

    it('离线效率应在 0~1 范围内', () => {
      for (const val of Object.values(DEFAULT_OFFLINE_EFFICIENCY)) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    });

    it('日常活动离线效率应为 100%', () => {
      expect(DEFAULT_OFFLINE_EFFICIENCY.daily).toBe(1.0);
    });
  });

  describe('常量值', () => {
    it('ACTIVITY_SAVE_VERSION 应为正整数', () => {
      expect(ACTIVITY_SAVE_VERSION).toBeGreaterThan(0);
      expect(Number.isInteger(ACTIVITY_SAVE_VERSION)).toBe(true);
    });

    it('BASE_POINTS_PER_SECOND 应为正数', () => {
      expect(BASE_POINTS_PER_SECOND).toBeGreaterThan(0);
    });
  });

  describe('seasonHelper 委托对象', () => {
    it('应包含所有必需方法', () => {
      expect(typeof seasonHelper.getCurrentSeasonTheme).toBe('function');
      expect(typeof seasonHelper.createSettlementAnimation).toBe('function');
      expect(typeof seasonHelper.updateSeasonRecord).toBe('function');
      expect(typeof seasonHelper.generateSeasonRecordRanking).toBe('function');
      expect(typeof seasonHelper.getSeasonThemes).toBe('function');
    });
  });

  describe('DEFAULT_SEASON_THEMES', () => {
    it('应导出非空数组', () => {
      expect(Array.isArray(DEFAULT_SEASON_THEMES)).toBe(true);
      expect(DEFAULT_SEASON_THEMES.length).toBeGreaterThan(0);
    });
  });
});
