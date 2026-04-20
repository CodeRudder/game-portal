/**
 * OfflineEstimateSystem 单元测试
 *
 * 覆盖：
 *   - 预估时间线生成
 *   - 各系统修正预估
 *   - 指定时长预估
 *   - 效率衰减曲线
 *   - 推荐下线时长
 */

import { OfflineEstimateSystem } from '../OfflineEstimateSystem';

const RATES = { grain: 10, gold: 5, troops: 2, mandate: 1 };

describe('OfflineEstimateSystem', () => {
  const system = new OfflineEstimateSystem();

  // ═══════════════════════════════════════════
  // 1. 预估时间线
  // ═══════════════════════════════════════════

  describe('预估时间线', () => {
    it('应生成7个时间点（1/2/4/8/24/48/72h）', () => {
      const result = system.estimate(RATES);
      expect(result.timeline).toHaveLength(7);
      expect(result.timeline[0].hours).toBe(1);
      expect(result.timeline[6].hours).toBe(72);
    });

    it('收益应随时间递增', () => {
      const result = system.estimate(RATES);
      for (let i = 1; i < result.timeline.length; i++) {
        expect(result.timeline[i].earned.grain).toBeGreaterThan(result.timeline[i - 1].earned.grain);
      }
    });

    it('效率应随时间递减', () => {
      const result = system.estimate(RATES);
      for (let i = 1; i < result.timeline.length; i++) {
        expect(result.timeline[i].efficiency).toBeLessThanOrEqual(result.timeline[i - 1].efficiency);
      }
    });

    it('1小时效率应为100%', () => {
      const result = system.estimate(RATES);
      expect(result.timeline[0].efficiency).toBeCloseTo(1.0, 2);
    });

    it('1小时收益 = 10 * 3600 = 36000 grain', () => {
      const result = system.estimate(RATES);
      expect(result.timeline[0].earned.grain).toBeCloseTo(36000, 1);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 系统修正预估
  // ═══════════════════════════════════════════

  describe('系统修正预估', () => {
    it('应包含各系统修正预估', () => {
      const result = system.estimate(RATES);
      expect(Object.keys(result.systemEstimates).length).toBeGreaterThan(0);
    });

    it('building修正应大于基础', () => {
      const result = system.estimate(RATES);
      const baseEarned = result.timeline[0].earned.grain;
      const buildingEarned = result.systemEstimates['building']?.[0].earned.grain ?? 0;
      expect(buildingEarned).toBeGreaterThan(baseEarned);
    });

    it('trade修正应小于基础', () => {
      const result = system.estimate(RATES);
      const baseEarned = result.timeline[0].earned.grain;
      const tradeEarned = result.systemEstimates['trade']?.[0].earned.grain ?? 0;
      expect(tradeEarned).toBeLessThan(baseEarned);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 指定时长预估
  // ═══════════════════════════════════════════

  describe('指定时长预估', () => {
    it('预估6小时收益', () => {
      const point = system.estimateForHours(6, RATES);
      expect(point.hours).toBe(6);
      expect(point.earned.grain).toBeGreaterThan(0);
    });

    it('超过72h封顶到72h', () => {
      const point = system.estimateForHours(100, RATES);
      expect(point.hours).toBe(72);
    });

    it('带系统修正的预估', () => {
      const base = system.estimateForHours(8, RATES);
      const withBuilding = system.estimateForHours(8, RATES, 'building');
      expect(withBuilding.earned.grain).toBeGreaterThan(base.earned.grain);
    });

    it('0小时收益为0', () => {
      const point = system.estimateForHours(0, RATES);
      expect(point.earned.grain).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 效率曲线
  // ═══════════════════════════════════════════

  describe('效率曲线', () => {
    it('应生成72个数据点', () => {
      const curve = system.getEfficiencyCurve();
      expect(curve).toHaveLength(72);
    });

    it('第1小时效率应为1.0', () => {
      const curve = system.getEfficiencyCurve();
      expect(curve[0].efficiency).toBeCloseTo(1.0, 2);
    });

    it('效率应单调递减', () => {
      const curve = system.getEfficiencyCurve();
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].efficiency).toBeLessThanOrEqual(curve[i - 1].efficiency);
      }
    });

    it('自定义最大小时数', () => {
      const curve = system.getEfficiencyCurve(24);
      expect(curve).toHaveLength(24);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 推荐下线时长
  // ═══════════════════════════════════════════

  describe('推荐下线时长', () => {
    it('推荐时长应大于0', () => {
      const result = system.estimate(RATES);
      expect(result.recommendedHours).toBeGreaterThan(0);
    });

    it('推荐时长对应效率应≥50%', () => {
      const result = system.estimate(RATES);
      const recommendedPoint = result.timeline.find(p => p.hours === result.recommendedHours);
      expect(recommendedPoint).toBeDefined();
      expect(recommendedPoint!.efficiency).toBeGreaterThanOrEqual(0.5);
    });
  });
});
