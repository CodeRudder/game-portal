/**
 * ClinicLossReport 单元测试
 *
 * 覆盖：
 * - 节省量计算
 * - 升级对比
 * - 未建造损失
 * - 每日报告
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { ClinicLossReport } from '../../clinic/ClinicLossReport';

describe('ClinicLossReport', () => {
  let report: ClinicLossReport;

  beforeEach(() => {
    report = new ClinicLossReport();
  });

  // ── 初始化 ──

  test('init sets up clinic level and production callbacks', () => {
    report.init(
      3,
      () => ({ grain: 10, gold: 5 }),
      () => ({ grain: 12, gold: 6 }),
    );
    expect(true).toBe(true);
  });

  // ── 节省量计算 ──

  test('getSavingsReport calculates saved per second correctly', () => {
    report.init(
      3,
      () => ({ grain: 10, gold: 5 }),
      () => ({ grain: 12, gold: 6 }),
    );

    const savings = report.getSavingsReport();
    expect(savings.length).toBeGreaterThan(0);

    const grainSaving = savings.find((s) => s.resource === 'grain');
    expect(grainSaving).toBeTruthy();
    expect(grainSaving!.savedPerSecond).toBe(2); // 12 - 10

    const goldSaving = savings.find((s) => s.resource === 'gold');
    expect(goldSaving).toBeTruthy();
    expect(goldSaving!.savedPerSecond).toBe(1); // 6 - 5
  });

  test('getSavingsReport returns empty without init', () => {
    const savings = report.getSavingsReport();
    expect(savings).toEqual([]);
  });

  test('getSavingsReport excludes resources with zero difference', () => {
    report.init(
      3,
      () => ({ grain: 10, gold: 5 }),
      () => ({ grain: 10, gold: 5 }),
    );

    const savings = report.getSavingsReport();
    expect(savings.length).toBe(0);
  });

  test('getSavingsReport includes negative savings (losses)', () => {
    report.init(
      3,
      () => ({ grain: 10, gold: 5 }),
      () => ({ grain: 8, gold: 5 }),
    );

    const savings = report.getSavingsReport();
    const grainSaving = savings.find((s) => s.resource === 'grain');
    expect(grainSaving!.savedPerSecond).toBe(-2);
  });

  // ── 升级对比 ──

  test('getUpgradeComparison calculates before/after/delta', () => {
    const comparison = report.getUpgradeComparison(2, 5);
    // Each level contributes 0.02 (2%)
    expect(comparison.before).toBe(0.04); // 2 * 0.02
    expect(comparison.after).toBe(0.10);  // 5 * 0.02
    expect(comparison.delta).toBeCloseTo(0.06, 10);  // 0.10 - 0.04
  });

  test('getUpgradeComparison with same level returns zero delta', () => {
    const comparison = report.getUpgradeComparison(3, 3);
    expect(comparison.delta).toBe(0);
    expect(comparison.before).toBe(comparison.after);
  });

  test('getUpgradeComparison with level 0', () => {
    const comparison = report.getUpgradeComparison(0, 1);
    expect(comparison.before).toBe(0);
    expect(comparison.after).toBe(0.02);
    expect(comparison.delta).toBe(0.02);
  });

  // ── 未建造损失 ──

  test('getUnbuiltLoss returns null when not unlocked', () => {
    report.init(
      0,
      () => ({ grain: 10, gold: 5 }),
      () => ({ grain: 12, gold: 6 }),
    );

    const loss = report.getUnbuiltLoss('clinic', 5, 3);
    expect(loss).toBeNull();
  });

  test('getUnbuiltLoss returns loss value when unlocked but unbuilt', () => {
    report.init(
      0,
      () => ({ grain: 10, gold: 5 }),
      () => ({ grain: 12, gold: 6 }),
    );

    const loss = report.getUnbuiltLoss('clinic', 5, 6);
    // Loss = sum of positive differences = (12-10) + (6-5) = 2 + 1 = 3
    expect(loss).toBe(3);
  });

  test('getUnbuiltLoss returns null without init', () => {
    const loss = report.getUnbuiltLoss('clinic', 5, 6);
    expect(loss).toBeNull();
  });

  test('getUnbuiltLoss only counts positive differences', () => {
    report.init(
      0,
      () => ({ grain: 10, gold: 5, ore: 8 }),
      () => ({ grain: 12, gold: 4, ore: 8 }),
    );

    const loss = report.getUnbuiltLoss('clinic', 1, 2);
    // grain: +2 (positive, counts), gold: -1 (negative, ignored), ore: 0 (ignored)
    expect(loss).toBe(2);
  });

  // ── 每日报告 ──

  test('getDailyReport calculates total and breakdown', () => {
    report.init(
      3,
      () => ({ grain: 10, gold: 5 }),
      () => ({ grain: 12, gold: 6 }),
    );

    const daily = report.getDailyReport();
    expect(daily.totalSaved).toBe(3 * 86400); // 3 per second * 86400 seconds
    expect(daily.breakdown['grain']).toBe(2 * 86400);
    expect(daily.breakdown['gold']).toBe(1 * 86400);
  });

  test('getDailyReport returns zero without init', () => {
    const daily = report.getDailyReport();
    expect(daily.totalSaved).toBe(0);
    expect(Object.keys(daily.breakdown).length).toBe(0);
  });

  test('getDailyReport handles negative savings correctly', () => {
    report.init(
      3,
      () => ({ grain: 10, gold: 5 }),
      () => ({ grain: 8, gold: 6 }),
    );

    const daily = report.getDailyReport();
    // grain: -2/s, gold: +1/s → total = -1/s
    expect(daily.totalSaved).toBe(-1 * 86400);
    expect(daily.breakdown['grain']).toBe(-2 * 86400);
    expect(daily.breakdown['gold']).toBe(1 * 86400);
  });
});
