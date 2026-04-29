/**
 * BalanceUtils 单元测试
 *
 * 覆盖：
 * 1. generateId — ID生成
 * 2. inRange — 范围判断
 * 3. calcDeviation — 偏差计算
 * 4. makeEntry — 验证条目创建
 * 5. calcPower — 战力计算
 * 6. calcRebirthMultiplier — 转生倍率
 * 7. generateResourceCurve — 资源曲线
 */

import {
  generateId,
  inRange,
  calcDeviation,
  makeEntry,
  calcPower,
  calcRebirthMultiplier,
  generateResourceCurve,
} from '../BalanceUtils';

import type { NumericRange, RebirthBalanceConfig, ResourceBalanceConfig, HeroBaseStats } from '../../../core/unification';

describe('BalanceUtils', () => {
  // ─── generateId ───────────────────────────

  describe('generateId', () => {
    it('应生成以 rpt_ 开头的ID', () => {
      const id = generateId();
      expect(id).toMatch(/^rpt_/);
    });

    it('每次调用应返回不同ID', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  // ─── inRange ──────────────────────────────

  describe('inRange', () => {
    const range: NumericRange = { min: 10, max: 20 };

    it('范围内应返回 true', () => {
      expect(inRange(15, range)).toBe(true);
    });

    it('边界值应返回 true', () => {
      expect(inRange(10, range)).toBe(true);
      expect(inRange(20, range)).toBe(true);
    });

    it('范围外应返回 false', () => {
      expect(inRange(9, range)).toBe(false);
      expect(inRange(21, range)).toBe(false);
    });
  });

  // ─── calcDeviation ────────────────────────

  describe('calcDeviation', () => {
    it('相同值偏差为0', () => {
      expect(calcDeviation(100, 100)).toBe(0);
    });

    it('应正确计算偏差百分比', () => {
      expect(calcDeviation(110, 100)).toBe(10);
      expect(calcDeviation(90, 100)).toBe(10);
    });

    it('期望值为0时应返回0或100', () => {
      expect(calcDeviation(0, 0)).toBe(0);
      expect(calcDeviation(1, 0)).toBe(100);
    });
  });

  // ─── makeEntry ────────────────────────────

  describe('makeEntry', () => {
    it('应创建验证条目', () => {
      const entry = makeEntry('feat_1', 'economy', 'pass', 100, 100, 'OK');
      expect(entry.featureId).toBe('feat_1');
      expect(entry.dimension).toBe('economy');
      expect(entry.level).toBe('pass');
      expect(entry.deviation).toBe(0);
    });

    it('范围类型的期望值应取中间值', () => {
      const entry = makeEntry('feat_1', 'economy', 'warning', 50, { min: 80, max: 120 }, 'Low');
      expect(entry.deviation).toBeGreaterThan(0);
    });
  });

  // ─── calcPower ────────────────────────────

  describe('calcPower', () => {
    it('应正确计算战力', () => {
      const stats: HeroBaseStats = { attack: 100, defense: 80, hp: 500, speed: 50 };
      const power = calcPower(stats, 1, 1);
      expect(power).toBeGreaterThan(0);
    });

    it('高等级因子应增加战力', () => {
      const stats: HeroBaseStats = { attack: 100, defense: 80, hp: 500, speed: 50 };
      const low = calcPower(stats, 1, 1);
      const high = calcPower(stats, 2, 1);
      expect(high).toBeGreaterThan(low);
    });

    it('0属性应返回0', () => {
      const stats: HeroBaseStats = { attack: 0, defense: 0, hp: 0, speed: 0 };
      expect(calcPower(stats, 1, 1)).toBe(0);
    });
  });

  // ─── calcRebirthMultiplier ────────────────

  describe('calcRebirthMultiplier', () => {
    const config: RebirthBalanceConfig = {
      baseMultiplier: 1.0,
      perRebirthIncrement: 0.5,
      decayFactor: 0.8,
      maxMultiplier: 5.0,
      curveType: 'diminishing',
    };

    it('0次转生应返回1.0', () => {
      expect(calcRebirthMultiplier(0, config)).toBe(1.0);
    });

    it('负数应返回1.0', () => {
      expect(calcRebirthMultiplier(-1, config)).toBe(1.0);
    });

    it('多次转生应增加倍率', () => {
      const m1 = calcRebirthMultiplier(1, config);
      const m5 = calcRebirthMultiplier(5, config);
      expect(m5).toBeGreaterThan(m1);
    });

    it('不应超过最大倍率', () => {
      const result = calcRebirthMultiplier(1000, config);
      expect(result).toBeLessThanOrEqual(config.maxMultiplier);
    });

    it('对数曲线应正常工作', () => {
      const logConfig: RebirthBalanceConfig = { ...config, curveType: 'logarithmic' };
      const result = calcRebirthMultiplier(5, logConfig);
      expect(result).toBeGreaterThan(1);
    });
  });

  // ─── generateResourceCurve ────────────────

  describe('generateResourceCurve', () => {
    it('应生成6个数据点', () => {
      const config: ResourceBalanceConfig = {
        earlyGameDailyRange: { min: 100, max: 200 },
        midGameDailyRange: { min: 500, max: 1000 },
        lateGameDailyRange: { min: 2000, max: 5000 },
        consumptionRatio: 0.65,
      };
      const curve = generateResourceCurve(config);
      expect(curve.length).toBe(6);
    });

    it('产量应随天数增长', () => {
      const config: ResourceBalanceConfig = {
        earlyGameDailyRange: { min: 100, max: 200 },
        midGameDailyRange: { min: 500, max: 1000 },
        lateGameDailyRange: { min: 2000, max: 5000 },
        consumptionRatio: 0.65,
      };
      const curve = generateResourceCurve(config);
      expect(curve[1].productionRate).toBeGreaterThan(curve[0].productionRate);
    });

    it('净收入应为正', () => {
      const config: ResourceBalanceConfig = {
        earlyGameDailyRange: { min: 100, max: 200 },
        midGameDailyRange: { min: 500, max: 1000 },
        lateGameDailyRange: { min: 2000, max: 5000 },
        consumptionRatio: 0.65,
      };
      const curve = generateResourceCurve(config);
      curve.forEach(point => {
        expect(point.netIncome).toBeGreaterThan(0);
      });
    });
  });
});
