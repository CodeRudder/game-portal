/**
 * OfflineEarningsCalculator 单元测试
 *
 * 覆盖：
 * 1. calculateOfflineEarnings — 离线收益计算
 * 2. applyEarningsToResources — 收益叠加
 * 3. formatOfflineTime — 时间格式化
 * 4. getOfflineEfficiencyPercent — 效率百分比
 */

import {
  calculateOfflineEarnings,
  applyEarningsToResources,
  formatOfflineTime,
  getOfflineEfficiencyPercent,
} from '../OfflineEarningsCalculator';

import type { ProductionRate, Resources } from '../resource.types';

describe('OfflineEarningsCalculator', () => {
  const rates: ProductionRate = {
    grain: 10,
    gold: 5,
    troops: 2,
    mandate: 1,
    techPoint: 0,
    recruitToken: 0,
    skillBook: 0,
  };

  // ─── calculateOfflineEarnings ─────────────

  describe('calculateOfflineEarnings', () => {
    it('应计算各资源的离线收益', () => {
      const result = calculateOfflineEarnings(3600, rates);
      expect(result.earned.grain).toBeGreaterThan(0);
      expect(result.earned.gold).toBeGreaterThan(0);
    });

    it('0秒应返回零收益', () => {
      const result = calculateOfflineEarnings(0, rates);
      expect(result.earned.grain).toBe(0);
    });

    it('超过最大时长应标记 isCapped', () => {
      const result = calculateOfflineEarnings(999999999, rates);
      expect(result.isCapped).toBe(true);
    });

    it('正常时长不应标记 isCapped', () => {
      const result = calculateOfflineEarnings(3600, rates);
      expect(result.isCapped).toBe(false);
    });

    it('应有衰减分段明细', () => {
      const result = calculateOfflineEarnings(3600, rates);
      expect(result.tierBreakdown.length).toBeGreaterThan(0);
    });
  });

  // ─── applyEarningsToResources ─────────────

  describe('applyEarningsToResources', () => {
    const current: Resources = { grain: 100, gold: 50, troops: 20, mandate: 5, techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0 };
    const earnings: Resources = { grain: 50, gold: 30, troops: 10, mandate: 2, techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0 };
    const caps: Record<keyof Resources, number | null> = {
      grain: 200, gold: 100, troops: 50, mandate: null, techPoint: null, recruitToken: null, skillBook: null,
    };

    it('应正确叠加收益', () => {
      const result = applyEarningsToResources(current, earnings, caps);
      expect(result.grain).toBe(150);
      expect(result.gold).toBe(80);
    });

    it('应受上限约束', () => {
      const result = applyEarningsToResources(current, earnings, caps);
      expect(result.troops).toBeLessThanOrEqual(50);
    });

    it('null 上限不受约束', () => {
      const result = applyEarningsToResources(current, earnings, caps);
      expect(result.mandate).toBe(7); // 无上限，直接叠加
    });

    it('不应修改原始对象', () => {
      applyEarningsToResources(current, earnings, caps);
      expect(current.grain).toBe(100);
    });
  });

  // ─── formatOfflineTime ────────────────────

  describe('formatOfflineTime', () => {
    it('0秒应返回"刚刚"', () => {
      expect(formatOfflineTime(0)).toBe('刚刚');
    });

    it('负数应返回"刚刚"', () => {
      expect(formatOfflineTime(-10)).toBe('刚刚');
    });

    it('90秒应返回"1分钟"', () => {
      expect(formatOfflineTime(90)).toBe('1分钟');
    });

    it('3661秒应返回"1小时1分钟"', () => {
      expect(formatOfflineTime(3661)).toBe('1小时1分钟');
    });

    it('90000秒应返回"1天1小时"', () => {
      expect(formatOfflineTime(90000)).toBe('1天1小时');
    });

    it('86400秒应返回"1天"', () => {
      expect(formatOfflineTime(86400)).toBe('1天');
    });

    it('3600秒应返回"1小时"', () => {
      expect(formatOfflineTime(3600)).toBe('1小时');
    });

    it('60秒应返回"1分钟"', () => {
      expect(formatOfflineTime(60)).toBe('1分钟');
    });
  });

  // ─── getOfflineEfficiencyPercent ──────────

  describe('getOfflineEfficiencyPercent', () => {
    it('0秒应返回100', () => {
      expect(getOfflineEfficiencyPercent(0)).toBe(100);
    });

    it('短时间应返回较高效率', () => {
      const short = getOfflineEfficiencyPercent(3600);
      const long = getOfflineEfficiencyPercent(86400);
      expect(short).toBeGreaterThan(long);
    });

    it('应返回0~100之间的值', () => {
      const percent = getOfflineEfficiencyPercent(3600);
      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThanOrEqual(100);
    });
  });
});
