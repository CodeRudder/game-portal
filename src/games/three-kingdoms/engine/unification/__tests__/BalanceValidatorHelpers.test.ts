/**
 * BalanceValidatorHelpers 单元测试
 *
 * 覆盖：
 * 1. buildSummary — 构建验证汇总
 * 2. determineOverallLevel — 总体等级判定
 */

import {
  buildSummary,
  determineOverallLevel,
} from '../BalanceValidatorHelpers';

import type { ValidationEntry } from '../../../core/unification';

describe('BalanceValidatorHelpers', () => {
  // ─── buildSummary ─────────────────────────

  describe('buildSummary', () => {
    it('空列表应返回零值汇总', () => {
      const summary = buildSummary([]);
      expect(summary.totalChecks).toBe(0);
      expect(summary.passCount).toBe(0);
      expect(summary.warningCount).toBe(0);
      expect(summary.failCount).toBe(0);
      expect(summary.passRate).toBe(0);
    });

    it('应正确统计各等级数量', () => {
      const entries: ValidationEntry[] = [
        { featureId: 'f1', dimension: 'economy', level: 'pass', actual: 100, expected: 100, deviation: 0, message: '' },
        { featureId: 'f2', dimension: 'economy', level: 'pass', actual: 95, expected: 100, deviation: 5, message: '' },
        { featureId: 'f3', dimension: 'economy', level: 'warning', actual: 80, expected: 100, deviation: 20, message: '' },
        { featureId: 'f4', dimension: 'economy', level: 'fail', actual: 50, expected: 100, deviation: 50, message: '' },
      ];
      const summary = buildSummary(entries);
      expect(summary.totalChecks).toBe(4);
      expect(summary.passCount).toBe(2);
      expect(summary.warningCount).toBe(1);
      expect(summary.failCount).toBe(1);
      expect(summary.passRate).toBe(0.5);
    });

    it('全部通过应 passRate 为1', () => {
      const entries: ValidationEntry[] = [
        { featureId: 'f1', dimension: 'economy', level: 'pass', actual: 100, expected: 100, deviation: 0, message: '' },
        { featureId: 'f2', dimension: 'economy', level: 'pass', actual: 100, expected: 100, deviation: 0, message: '' },
      ];
      const summary = buildSummary(entries);
      expect(summary.passRate).toBe(1);
    });
  });

  // ─── determineOverallLevel ────────────────

  describe('determineOverallLevel', () => {
    it('有 fail 应返回 fail', () => {
      const summary = { totalChecks: 3, passCount: 2, warningCount: 0, failCount: 1, passRate: 2 / 3 };
      expect(determineOverallLevel(summary)).toBe('fail');
    });

    it('有 warning 无 fail 应返回 warning', () => {
      const summary = { totalChecks: 3, passCount: 2, warningCount: 1, failCount: 0, passRate: 2 / 3 };
      expect(determineOverallLevel(summary)).toBe('warning');
    });

    it('全部通过应返回 pass', () => {
      const summary = { totalChecks: 2, passCount: 2, warningCount: 0, failCount: 0, passRate: 1 };
      expect(determineOverallLevel(summary)).toBe('pass');
    });
  });
});
