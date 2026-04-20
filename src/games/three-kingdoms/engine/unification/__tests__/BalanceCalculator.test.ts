/**
 * BalanceCalculator 测试
 *
 * 覆盖数值计算器的所有功能：
 *   - 默认配置常量
 *   - 工具函数（范围判断、偏差计算、ID生成等）
 *   - 纯计算函数（战力计算、转生倍率计算、曲线生成等）
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RESOURCE_CONFIGS,
  HERO_BASE_STATS,
  DEFAULT_BATTLE_CONFIG,
  DEFAULT_ECONOMY_CONFIGS,
  DEFAULT_REBIRTH_CONFIG,
  generateId,
  inRange,
  calcDeviation,
  makeEntry,
  calcPower,
  calcRebirthMultiplier,
  generateResourceCurve,
  calculateRebirthPoints,
} from '../BalanceCalculator';
import type {
  NumericRange,
  RebirthBalanceConfig,
  ResourceBalanceConfig,
} from '../../../../core/unification';

// ─────────────────────────────────────────────
// 默认配置常量
// ─────────────────────────────────────────────

describe('BalanceCalculator — 默认配置常量', () => {
  describe('DEFAULT_RESOURCE_CONFIGS', () => {
    it('应包含4种资源配置', () => {
      expect(DEFAULT_RESOURCE_CONFIGS).toHaveLength(4);
    });

    it('应包含 grain/gold/troops/mandate', () => {
      const types = DEFAULT_RESOURCE_CONFIGS.map(c => c.resourceType);
      expect(types).toEqual(expect.arrayContaining(['grain', 'gold', 'troops', 'mandate']));
    });

    it('每种配置应有完整的范围定义', () => {
      for (const cfg of DEFAULT_RESOURCE_CONFIGS) {
        expect(cfg.earlyGameDailyRange.min).toBeLessThan(cfg.earlyGameDailyRange.max);
        expect(cfg.midGameDailyRange.min).toBeLessThan(cfg.midGameDailyRange.max);
        expect(cfg.lateGameDailyRange.min).toBeLessThan(cfg.lateGameDailyRange.max);
        expect(cfg.maxDeviationPercent).toBeGreaterThan(0);
      }
    });
  });

  describe('HERO_BASE_STATS', () => {
    it('应包含5种品质', () => {
      const qualities = Object.keys(HERO_BASE_STATS);
      expect(qualities).toEqual(
        expect.arrayContaining(['COMMON', 'FINE', 'RARE', 'EPIC', 'LEGENDARY']),
      );
    });

    it('品质越高属性越高', () => {
      const common = HERO_BASE_STATS['COMMON'];
      const legendary = HERO_BASE_STATS['LEGENDARY'];
      expect(legendary.attack).toBeGreaterThan(common.attack);
      expect(legendary.defense).toBeGreaterThan(common.defense);
      expect(legendary.hp).toBeGreaterThan(common.hp);
      expect(legendary.speed).toBeGreaterThan(common.speed);
    });

    it('所有属性应为正数', () => {
      for (const [, stats] of Object.entries(HERO_BASE_STATS)) {
        expect(stats.attack).toBeGreaterThan(0);
        expect(stats.defense).toBeGreaterThan(0);
        expect(stats.hp).toBeGreaterThan(0);
        expect(stats.speed).toBeGreaterThan(0);
      }
    });
  });

  describe('DEFAULT_BATTLE_CONFIG', () => {
    it('应有合理的章节和关卡配置', () => {
      expect(DEFAULT_BATTLE_CONFIG.totalChapters).toBeGreaterThan(0);
      expect(DEFAULT_BATTLE_CONFIG.stagesPerChapter).toBeGreaterThan(0);
    });

    it('首关战力应低于末关', () => {
      expect(DEFAULT_BATTLE_CONFIG.firstStagePower).toBeLessThan(DEFAULT_BATTLE_CONFIG.lastStagePower);
    });

    it('应有曲线类型和增长因子', () => {
      expect(DEFAULT_BATTLE_CONFIG.curveType).toBeTruthy();
      expect(DEFAULT_BATTLE_CONFIG.growthFactor).toBeGreaterThan(1);
    });

    it('BOSS 倍率应大于1', () => {
      expect(DEFAULT_BATTLE_CONFIG.bossMultiplier).toBeGreaterThan(1);
    });
  });

  describe('DEFAULT_ECONOMY_CONFIGS', () => {
    it('应包含4种货币配置', () => {
      expect(DEFAULT_ECONOMY_CONFIGS).toHaveLength(4);
    });

    it('应包含 copper/mandate/recruit/ingot', () => {
      const currencies = DEFAULT_ECONOMY_CONFIGS.map(c => c.currency);
      expect(currencies).toEqual(
        expect.arrayContaining(['copper', 'mandate', 'recruit', 'ingot']),
      );
    });

    it('通胀预警阈值应在合理范围', () => {
      for (const cfg of DEFAULT_ECONOMY_CONFIGS) {
        expect(cfg.inflationWarningThreshold).toBeGreaterThan(0);
        expect(cfg.inflationWarningThreshold).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('DEFAULT_REBIRTH_CONFIG', () => {
    it('应有合理的转生配置', () => {
      expect(DEFAULT_REBIRTH_CONFIG.maxRebirthCount).toBeGreaterThan(0);
      expect(DEFAULT_REBIRTH_CONFIG.perRebirthIncrement).toBeGreaterThan(0);
      expect(DEFAULT_REBIRTH_CONFIG.maxMultiplier).toBeGreaterThan(1);
    });

    it('基础倍率应为1', () => {
      expect(DEFAULT_REBIRTH_CONFIG.baseMultiplier).toBe(1.0);
    });

    it('衰减因子应在0~1之间', () => {
      expect(DEFAULT_REBIRTH_CONFIG.decayFactor).toBeGreaterThan(0);
      expect(DEFAULT_REBIRTH_CONFIG.decayFactor).toBeLessThanOrEqual(1);
    });
  });
});

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

describe('BalanceCalculator — 工具函数', () => {
  describe('generateId', () => {
    it('应生成非空字符串', () => {
      const id = generateId();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('应以 rpt_ 前缀开头', () => {
      const id = generateId();
      expect(id.startsWith('rpt_')).toBe(true);
    });

    it('应生成唯一 ID', () => {
      const ids = new Set(Array.from({ length: 50 }, () => generateId()));
      expect(ids.size).toBe(50);
    });
  });

  describe('inRange', () => {
    it('范围内值应返回 true', () => {
      const range: NumericRange = { min: 10, max: 20 };
      expect(inRange(15, range)).toBe(true);
      expect(inRange(10, range)).toBe(true);
      expect(inRange(20, range)).toBe(true);
    });

    it('范围外值应返回 false', () => {
      const range: NumericRange = { min: 10, max: 20 };
      expect(inRange(9, range)).toBe(false);
      expect(inRange(21, range)).toBe(false);
      expect(inRange(-1, range)).toBe(false);
    });

    it('min === max 时只有等于才为 true', () => {
      const range: NumericRange = { min: 10, max: 10 };
      expect(inRange(10, range)).toBe(true);
      expect(inRange(9, range)).toBe(false);
      expect(inRange(11, range)).toBe(false);
    });
  });

  describe('calcDeviation', () => {
    it('完全相等时偏差为0', () => {
      expect(calcDeviation(100, 100)).toBe(0);
    });

    it('应计算百分比偏差', () => {
      expect(calcDeviation(110, 100)).toBeCloseTo(10, 1);
      expect(calcDeviation(90, 100)).toBeCloseTo(10, 1);
    });

    it('期望值为0时特殊处理', () => {
      expect(calcDeviation(0, 0)).toBe(0);
      expect(calcDeviation(50, 0)).toBe(100);
    });

    it('偏差应始终非负', () => {
      expect(calcDeviation(50, 100)).toBeGreaterThanOrEqual(0);
      expect(calcDeviation(200, 100)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('makeEntry', () => {
    it('应创建正确的验证条目', () => {
      const entry = makeEntry(
        'TEST-001', 'resource', 'pass', 100, 100, 'Test message',
      );
      expect(entry.featureId).toBe('TEST-001');
      expect(entry.dimension).toBe('resource');
      expect(entry.level).toBe('pass');
      expect(entry.actual).toBe(100);
      expect(entry.expected).toBe(100);
      expect(entry.deviation).toBe(0);
      expect(entry.message).toBe('Test message');
    });

    it('expected 为范围时应取中值计算偏差', () => {
      const range: NumericRange = { min: 80, max: 120 };
      const entry = makeEntry('TEST-002', 'hero', 'warning', 90, range, 'Range test');
      expect(entry.expected).toEqual(range);
      expect(entry.deviation).toBe(calcDeviation(90, 100));
    });
  });
});

// ─────────────────────────────────────────────
// 纯计算函数
// ─────────────────────────────────────────────

describe('BalanceCalculator — 纯计算函数', () => {
  describe('calcPower', () => {
    it('应基于属性计算战力', () => {
      const stats = { attack: 100, defense: 50, hp: 500, speed: 30 };
      const power = calcPower(stats, 1, 1);
      expect(power).toBeGreaterThan(0);
    });

    it('levelFactor 越大战力越高', () => {
      const stats = { attack: 100, defense: 50, hp: 500, speed: 30 };
      const p1 = calcPower(stats, 1, 1);
      const p2 = calcPower(stats, 2, 1);
      expect(p2).toBeGreaterThan(p1);
    });

    it('starFactor 越大战力越高', () => {
      const stats = { attack: 100, defense: 50, hp: 500, speed: 30 };
      const p1 = calcPower(stats, 1, 1);
      const p2 = calcPower(stats, 1, 2);
      expect(p2).toBeGreaterThan(p1);
    });

    it('应返回整数', () => {
      const stats = { attack: 33, defense: 17, hp: 123, speed: 7 };
      const power = calcPower(stats, 1.5, 1.3);
      expect(Number.isInteger(power)).toBe(true);
    });
  });

  describe('calcRebirthMultiplier', () => {
    it('次数为0时应返回1.0', () => {
      expect(calcRebirthMultiplier(0, DEFAULT_REBIRTH_CONFIG)).toBe(1.0);
    });

    it('负数次数应返回1.0', () => {
      expect(calcRebirthMultiplier(-5, DEFAULT_REBIRTH_CONFIG)).toBe(1.0);
    });

    it('次数越多倍率越高', () => {
      const m1 = calcRebirthMultiplier(1, DEFAULT_REBIRTH_CONFIG);
      const m5 = calcRebirthMultiplier(5, DEFAULT_REBIRTH_CONFIG);
      const m10 = calcRebirthMultiplier(10, DEFAULT_REBIRTH_CONFIG);
      expect(m1).toBeGreaterThan(1.0);
      expect(m5).toBeGreaterThan(m1);
      expect(m10).toBeGreaterThan(m5);
    });

    it('不应超过最大倍率', () => {
      const m = calcRebirthMultiplier(100, DEFAULT_REBIRTH_CONFIG);
      expect(m).toBeLessThanOrEqual(DEFAULT_REBIRTH_CONFIG.maxMultiplier);
    });

    it('应体现递减效应', () => {
      const multipliers: number[] = [];
      for (let i = 0; i <= 10; i++) {
        multipliers.push(calcRebirthMultiplier(i, DEFAULT_REBIRTH_CONFIG));
      }
      // 递减曲线：前5次增量之和 > 后5次增量之和
      const firstHalfInc = multipliers[5] - multipliers[0];
      const secondHalfInc = multipliers[10] - multipliers[5];
      expect(secondHalfInc).toBeLessThanOrEqual(firstHalfInc);
    });

    it('线性曲线配置应等量增长', () => {
      const linearConfig: RebirthBalanceConfig = {
        maxRebirthCount: 10,
        baseMultiplier: 1.0,
        perRebirthIncrement: 0.2,
        maxMultiplier: 5.0,
        curveType: 'linear',
        decayFactor: 1.0,
      };
      const m1 = calcRebirthMultiplier(1, linearConfig);
      const m2 = calcRebirthMultiplier(2, linearConfig);
      const m3 = calcRebirthMultiplier(3, linearConfig);
      expect(m2 - m1).toBeCloseTo(m3 - m2, 5);
    });
  });

  describe('generateResourceCurve', () => {
    it('应生成6个数据点', () => {
      const curve = generateResourceCurve(DEFAULT_RESOURCE_CONFIGS[0]);
      expect(curve).toHaveLength(6);
    });

    it('数据点应包含必要字段', () => {
      const curve = generateResourceCurve(DEFAULT_RESOURCE_CONFIGS[0]);
      for (const point of curve) {
        expect(point).toHaveProperty('day');
        expect(point).toHaveProperty('productionRate');
        expect(point).toHaveProperty('totalProduced');
        expect(point).toHaveProperty('totalConsumed');
        expect(point).toHaveProperty('netIncome');
      }
    });

    it('产出应随天数增长', () => {
      const curve = generateResourceCurve(DEFAULT_RESOURCE_CONFIGS[0]);
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].totalProduced).toBeGreaterThan(curve[i - 1].totalProduced);
      }
    });

    it('净收入可为正', () => {
      const curve = generateResourceCurve(DEFAULT_RESOURCE_CONFIGS[0]);
      // 至少初期净收入应为正
      expect(curve[0].netIncome).toBeGreaterThan(0);
    });
  });

  describe('calculateRebirthPoints', () => {
    it('应生成与 maxRebirthCount 相同数量的数据点', () => {
      const points = calculateRebirthPoints(DEFAULT_REBIRTH_CONFIG);
      expect(points).toHaveLength(DEFAULT_REBIRTH_CONFIG.maxRebirthCount);
    });

    it('每个点应有正确的字段', () => {
      const points = calculateRebirthPoints(DEFAULT_REBIRTH_CONFIG);
      for (const point of points) {
        expect(point).toHaveProperty('rebirthCount');
        expect(point).toHaveProperty('multiplier');
        expect(point).toHaveProperty('increment');
        expect(point).toHaveProperty('cumulativeAcceleration');
      }
    });

    it('rebirthCount 应从1开始递增', () => {
      const points = calculateRebirthPoints(DEFAULT_REBIRTH_CONFIG);
      for (let i = 0; i < points.length; i++) {
        expect(points[i].rebirthCount).toBe(i + 1);
      }
    });

    it('multiplier 应随次数递增', () => {
      const points = calculateRebirthPoints(DEFAULT_REBIRTH_CONFIG);
      for (let i = 1; i < points.length; i++) {
        expect(points[i].multiplier).toBeGreaterThanOrEqual(points[i - 1].multiplier);
      }
    });

    it('increment 应体现递减', () => {
      const points = calculateRebirthPoints(DEFAULT_REBIRTH_CONFIG);
      for (let i = 1; i < points.length; i++) {
        expect(points[i].increment).toBeLessThanOrEqual(points[i - 1].increment);
      }
    });

    it('不应超过最大倍率', () => {
      const points = calculateRebirthPoints(DEFAULT_REBIRTH_CONFIG);
      for (const point of points) {
        expect(point.multiplier).toBeLessThanOrEqual(DEFAULT_REBIRTH_CONFIG.maxMultiplier);
      }
    });
  });
});
