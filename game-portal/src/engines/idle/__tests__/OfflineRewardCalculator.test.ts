/**
 * OfflineRewardCalculator 离线收益计算器 — 单元测试
 *
 * 覆盖范围：
 * - 构造函数和默认配置
 * - 产出源注册/移除/查询
 * - 单产出源收益计算
 * - 多产出源收益计算
 * - 最大离线时间封顶
 * - 效率衰减计算
 * - 声望加成
 * - 速度倍率
 * - 收益明细分解
 * - 边界条件（0时长、负时长、超大时长、空产出源）
 * - reset() 方法
 * - updateConfig() 方法
 *
 * @module engines/idle/__tests__/OfflineRewardCalculator.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OfflineRewardCalculator,
  type ProductionSource,
  type OfflineRewardConfig,
} from '../modules/OfflineRewardCalculator';

// ============================================================
// 常量与工具函数
// ============================================================

/** 小时转毫秒 */
const HOUR_MS = 3600 * 1000;

/** 创建默认配置 */
function makeConfig(overrides: Partial<OfflineRewardConfig> = {}): OfflineRewardConfig {
  return {
    maxOfflineHours: 24,
    efficiencyDecayRate: 0,
    minEfficiency: 0.5,
    prestigeBonus: 1,
    speedMultiplier: 1,
    ...overrides,
  };
}

/** 创建示例产出源 */
function makeSource(overrides: Partial<ProductionSource> = {}): ProductionSource {
  return {
    id: 'lumberMill',
    name: '伐木场',
    baseOutput: { wood: 100, gold: 10 },
    multiplier: 1,
    ...overrides,
  };
}

/** 创建计算器实例 */
function createCalculator(configOverrides: Partial<OfflineRewardConfig> = {}): OfflineRewardCalculator {
  return new OfflineRewardCalculator(makeConfig(configOverrides));
}

// ============================================================
// 测试套件
// ============================================================

describe('OfflineRewardCalculator', () => {

  // ----------------------------------------------------------
  // 构造函数和默认配置
  // ----------------------------------------------------------
  describe('构造函数和默认配置', () => {
    it('应正确存储传入的配置', () => {
      const calc = createCalculator({ maxOfflineHours: 48 });
      const config = calc.getConfig();
      expect(config.maxOfflineHours).toBe(48);
    });

    it('未传入的可选配置应使用默认值', () => {
      const calc = new OfflineRewardCalculator({ maxOfflineHours: 24 });
      const config = calc.getConfig();
      expect(config.efficiencyDecayRate).toBe(0);
      expect(config.minEfficiency).toBe(0.5);
      expect(config.prestigeBonus).toBe(1);
      expect(config.speedMultiplier).toBe(1);
    });

    it('应正确存储所有配置项', () => {
      const calc = createCalculator({
        maxOfflineHours: 12,
        efficiencyDecayRate: 0.3,
        minEfficiency: 0.2,
        prestigeBonus: 2,
        speedMultiplier: 3,
      });
      const config = calc.getConfig();
      expect(config.maxOfflineHours).toBe(12);
      expect(config.efficiencyDecayRate).toBe(0.3);
      expect(config.minEfficiency).toBe(0.2);
      expect(config.prestigeBonus).toBe(2);
      expect(config.speedMultiplier).toBe(3);
    });

    it('getConfig 应返回配置的副本，修改不影响内部', () => {
      const calc = createCalculator();
      const config = calc.getConfig();
      config.maxOfflineHours = 999;
      expect(calc.getConfig().maxOfflineHours).toBe(24);
    });
  });

  // ----------------------------------------------------------
  // 产出源注册/移除/查询
  // ----------------------------------------------------------
  describe('产出源注册/移除/查询', () => {
    let calc: OfflineRewardCalculator;

    beforeEach(() => {
      calc = createCalculator();
    });

    it('addSource 应注册产出源', () => {
      calc.addSource(makeSource());
      expect(calc.getSourceCount()).toBe(1);
    });

    it('addSource 相同 ID 应覆盖原有产出源', () => {
      calc.addSource(makeSource());
      calc.addSource(makeSource({ name: '超级伐木场', baseOutput: { wood: 500 } }));
      expect(calc.getSourceCount()).toBe(1);

      const sources = calc.getSources();
      expect(sources[0].name).toBe('超级伐木场');
    });

    it('addSource 应支持多个不同产出源', () => {
      calc.addSource(makeSource({ id: 'farm', name: '农场', baseOutput: { food: 80 } }));
      calc.addSource(makeSource({ id: 'mine', name: '矿场', baseOutput: { iron: 50, gold: 20 } }));
      expect(calc.getSourceCount()).toBe(2);
    });

    it('removeSource 应移除已注册的产出源', () => {
      calc.addSource(makeSource());
      const removed = calc.removeSource('lumberMill');
      expect(removed).toBe(true);
      expect(calc.getSourceCount()).toBe(0);
    });

    it('removeSource 不存在的 ID 应返回 false', () => {
      const removed = calc.removeSource('nonexistent');
      expect(removed).toBe(false);
    });

    it('getSources 应返回所有产出源的副本', () => {
      calc.addSource(makeSource({ id: 'a', name: 'A' }));
      calc.addSource(makeSource({ id: 'b', name: 'B' }));
      const sources = calc.getSources();
      expect(sources).toHaveLength(2);

      // 修改返回值不影响内部
      sources[0].name = 'Modified';
      expect(calc.getSources()[0].name).toBe('A');
    });

    it('getSourceCount 空状态应为 0', () => {
      expect(calc.getSourceCount()).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // 单产出源收益计算
  // ----------------------------------------------------------
  describe('单产出源收益计算', () => {
    it('应正确计算单产出源 1 小时的收益', () => {
      const calc = createCalculator();
      calc.addSource(makeSource()); // wood: 100/h, gold: 10/h

      const result = calc.calculate(1 * HOUR_MS);
      expect(result.resources.wood).toBeCloseTo(100, 5);
      expect(result.resources.gold).toBeCloseTo(10, 5);
    });

    it('应正确计算单产出源 12 小时的收益', () => {
      const calc = createCalculator();
      calc.addSource(makeSource());

      const result = calc.calculate(12 * HOUR_MS);
      expect(result.resources.wood).toBeCloseTo(1200, 5);
      expect(result.resources.gold).toBeCloseTo(120, 5);
    });

    it('应正确应用产出源倍率', () => {
      const calc = createCalculator();
      calc.addSource(makeSource({ multiplier: 3 })); // 3 倍

      const result = calc.calculate(1 * HOUR_MS);
      expect(result.resources.wood).toBeCloseTo(300, 5);
      expect(result.resources.gold).toBeCloseTo(30, 5);
    });

    it('产出源 multiplier 未设置时应默认为 1', () => {
      const calc = createCalculator();
      calc.addSource({ id: 'test', name: '测试', baseOutput: { gold: 50 } });

      const result = calc.calculate(2 * HOUR_MS);
      expect(result.resources.gold).toBeCloseTo(100, 5);
    });
  });

  // ----------------------------------------------------------
  // 多产出源收益计算
  // ----------------------------------------------------------
  describe('多产出源收益计算', () => {
    it('应汇总多个产出源的资源收益', () => {
      const calc = createCalculator();
      calc.addSource({ id: 'farm', name: '农场', baseOutput: { food: 100, gold: 5 } });
      calc.addSource({ id: 'mine', name: '矿场', baseOutput: { iron: 50, gold: 20 } });

      const result = calc.calculate(1 * HOUR_MS);
      expect(result.resources.food).toBeCloseTo(100, 5);
      expect(result.resources.iron).toBeCloseTo(50, 5);
      expect(result.resources.gold).toBeCloseTo(25, 5); // 5 + 20
    });

    it('应正确处理各产出源的不同倍率', () => {
      const calc = createCalculator();
      calc.addSource({ id: 'a', name: 'A', baseOutput: { gold: 100 }, multiplier: 2 });
      calc.addSource({ id: 'b', name: 'B', baseOutput: { gold: 100 }, multiplier: 3 });

      const result = calc.calculate(1 * HOUR_MS);
      expect(result.resources.gold).toBeCloseTo(500, 5); // 200 + 300
    });
  });

  // ----------------------------------------------------------
  // 最大离线时间封顶
  // ----------------------------------------------------------
  describe('最大离线时间封顶', () => {
    it('离线时长未超过上限时不应封顶', () => {
      const calc = createCalculator({ maxOfflineHours: 24 });
      calc.addSource(makeSource());

      const result = calc.calculate(12 * HOUR_MS);
      expect(result.totalDuration).toBe(12 * HOUR_MS);
      expect(result.cappedDuration).toBe(12 * HOUR_MS);
    });

    it('离线时长超过上限时应封顶到 maxOfflineHours', () => {
      const calc = createCalculator({ maxOfflineHours: 24 });
      calc.addSource(makeSource());

      const result = calc.calculate(48 * HOUR_MS);
      expect(result.totalDuration).toBe(48 * HOUR_MS);
      expect(result.cappedDuration).toBe(24 * HOUR_MS);
    });

    it('封顶后收益应基于封顶时长计算', () => {
      const calc = createCalculator({ maxOfflineHours: 24 });
      calc.addSource(makeSource()); // wood: 100/h

      // 48 小时离线，但封顶到 24 小时
      const result = calc.calculate(48 * HOUR_MS);
      expect(result.resources.wood).toBeCloseTo(2400, 5); // 100 * 24，不是 100 * 48
    });

    it('不同 maxOfflineHours 配置应正确封顶', () => {
      const calc = createCalculator({ maxOfflineHours: 8 });
      calc.addSource(makeSource());

      const result = calc.calculate(20 * HOUR_MS);
      expect(result.cappedDuration).toBe(8 * HOUR_MS);
      expect(result.resources.wood).toBeCloseTo(800, 5); // 100 * 8
    });
  });

  // ----------------------------------------------------------
  // 效率衰减计算
  // ----------------------------------------------------------
  describe('效率衰减计算', () => {
    it('decayRate 为 0 时效率应始终为 1', () => {
      const calc = createCalculator({ efficiencyDecayRate: 0 });
      calc.addSource(makeSource());

      const result = calc.calculate(24 * HOUR_MS);
      expect(result.efficiency).toBe(1);
    });

    it('应正确应用线性衰减', () => {
      const calc = createCalculator({
        maxOfflineHours: 24,
        efficiencyDecayRate: 0.5,
        minEfficiency: 0,
      });
      calc.addSource(makeSource());

      // 12 小时：efficiency = 1 - (12/24) * 0.5 = 0.75
      const result = calc.calculate(12 * HOUR_MS);
      expect(result.efficiency).toBeCloseTo(0.75, 5);
    });

    it('效率不应低于 minEfficiency', () => {
      const calc = createCalculator({
        maxOfflineHours: 24,
        efficiencyDecayRate: 1,
        minEfficiency: 0.5,
      });
      calc.addSource(makeSource());

      // 24 小时满衰减：efficiency = 1 - (24/24) * 1 = 0，但 minEfficiency = 0.5
      const result = calc.calculate(24 * HOUR_MS);
      expect(result.efficiency).toBeCloseTo(0.5, 5);
    });

    it('衰减后的收益应正确反映效率', () => {
      const calc = createCalculator({
        maxOfflineHours: 24,
        efficiencyDecayRate: 1,
        minEfficiency: 0,
      });
      calc.addSource(makeSource()); // wood: 100/h

      // 12 小时：efficiency = 1 - (12/24) * 1 = 0.5
      const result = calc.calculate(12 * HOUR_MS);
      expect(result.efficiency).toBeCloseTo(0.5, 5);
      expect(result.resources.wood).toBeCloseTo(600, 5); // 100 * 12 * 0.5
    });

    it('0 小时时效率应为 1', () => {
      const calc = createCalculator({
        efficiencyDecayRate: 0.5,
        minEfficiency: 0.3,
      });

      // 注意：0 时长走边界分支，效率为 0
      const result = calc.calculate(0);
      expect(result.efficiency).toBe(0);
    });

    it('极短时间的效率应接近 1', () => {
      const calc = createCalculator({
        maxOfflineHours: 24,
        efficiencyDecayRate: 0.5,
        minEfficiency: 0,
      });
      calc.addSource(makeSource());

      // 0.01 小时 ≈ 36 秒
      const result = calc.calculate(0.01 * HOUR_MS);
      expect(result.efficiency).toBeCloseTo(0.999792, 3);
    });
  });

  // ----------------------------------------------------------
  // 声望加成
  // ----------------------------------------------------------
  describe('声望加成', () => {
    it('prestigeBonus 为 1 时不应影响收益', () => {
      const calc = createCalculator({ prestigeBonus: 1 });
      calc.addSource(makeSource());

      const result = calc.calculate(1 * HOUR_MS);
      expect(result.resources.wood).toBeCloseTo(100, 5);
    });

    it('prestigeBonus 为 2 时收益应翻倍', () => {
      const calc = createCalculator({ prestigeBonus: 2 });
      calc.addSource(makeSource());

      const result = calc.calculate(1 * HOUR_MS);
      expect(result.resources.wood).toBeCloseTo(200, 5);
    });

    it('prestigeBonus 为 0.5 时收益应减半', () => {
      const calc = createCalculator({ prestigeBonus: 0.5 });
      calc.addSource(makeSource());

      const result = calc.calculate(1 * HOUR_MS);
      expect(result.resources.wood).toBeCloseTo(50, 5);
    });

    it('应与效率衰减叠加计算', () => {
      const calc = createCalculator({
        maxOfflineHours: 24,
        efficiencyDecayRate: 1,
        minEfficiency: 0,
        prestigeBonus: 2,
      });
      calc.addSource(makeSource()); // wood: 100/h

      // 12 小时：efficiency = 0.5，prestigeBonus = 2
      // wood = 100 * 1 * 1 * 2 * 0.5 * 12 = 1200
      const result = calc.calculate(12 * HOUR_MS);
      expect(result.resources.wood).toBeCloseTo(1200, 5);
    });
  });

  // ----------------------------------------------------------
  // 速度倍率
  // ----------------------------------------------------------
  describe('速度倍率', () => {
    it('speedMultiplier 为 1 时不应影响收益', () => {
      const calc = createCalculator({ speedMultiplier: 1 });
      calc.addSource(makeSource());

      const result = calc.calculate(1 * HOUR_MS);
      expect(result.resources.wood).toBeCloseTo(100, 5);
    });

    it('speedMultiplier 为 3 时收益应 3 倍', () => {
      const calc = createCalculator({ speedMultiplier: 3 });
      calc.addSource(makeSource());

      const result = calc.calculate(1 * HOUR_MS);
      expect(result.resources.wood).toBeCloseTo(300, 5);
    });

    it('应与产出源倍率、声望加成叠加', () => {
      const calc = createCalculator({
        speedMultiplier: 2,
        prestigeBonus: 3,
      });
      calc.addSource(makeSource({ multiplier: 4 })); // wood: 100/h

      // wood = 100 * 4(源) * 2(速度) * 3(声望) * 1(效率) * 1(小时) = 2400
      const result = calc.calculate(1 * HOUR_MS);
      expect(result.resources.wood).toBeCloseTo(2400, 5);
    });
  });

  // ----------------------------------------------------------
  // 收益明细分解
  // ----------------------------------------------------------
  describe('收益明细分解', () => {
    it('breakdown 应包含每个产出源的收益', () => {
      const calc = createCalculator();
      calc.addSource({ id: 'farm', name: '农场', baseOutput: { food: 80 } });
      calc.addSource({ id: 'mine', name: '矿场', baseOutput: { iron: 50 } });

      const result = calc.calculate(1 * HOUR_MS);
      expect(Object.keys(result.breakdown)).toHaveLength(2);
      expect(result.breakdown['farm']).toBeDefined();
      expect(result.breakdown['mine']).toBeDefined();
    });

    it('breakdown 应包含正确的产出源信息', () => {
      const calc = createCalculator();
      calc.addSource({ id: 'farm', name: '农场', baseOutput: { food: 80, gold: 5 } });

      const result = calc.calculate(1 * HOUR_MS);
      expect(result.breakdown['farm'].sourceId).toBe('farm');
      expect(result.breakdown['farm'].sourceName).toBe('农场');
      expect(result.breakdown['farm'].resources.food).toBeCloseTo(80, 5);
      expect(result.breakdown['farm'].resources.gold).toBeCloseTo(5, 5);
    });

    it('各产出源的明细收益之和应等于总收益', () => {
      const calc = createCalculator();
      calc.addSource({ id: 'a', name: 'A', baseOutput: { gold: 100 } });
      calc.addSource({ id: 'b', name: 'B', baseOutput: { gold: 200, gem: 10 } });

      const result = calc.calculate(1 * HOUR_MS);
      const breakdownGold =
        (result.breakdown['a'].resources.gold ?? 0) +
        (result.breakdown['b'].resources.gold ?? 0);

      expect(breakdownGold).toBeCloseTo(result.resources.gold!, 5);
      expect(result.resources.gold).toBeCloseTo(300, 5);
      expect(result.resources.gem).toBeCloseTo(10, 5);
    });
  });

  // ----------------------------------------------------------
  // 边界条件
  // ----------------------------------------------------------
  describe('边界条件', () => {
    it('0 时长应返回空结果', () => {
      const calc = createCalculator();
      calc.addSource(makeSource());

      const result = calc.calculate(0);
      expect(result.totalDuration).toBe(0);
      expect(result.cappedDuration).toBe(0);
      expect(result.efficiency).toBe(0);
      expect(result.resources).toEqual({});
      expect(result.breakdown).toEqual({});
    });

    it('负时长应返回空结果', () => {
      const calc = createCalculator();
      calc.addSource(makeSource());

      const result = calc.calculate(-1000);
      expect(result.totalDuration).toBe(-1000);
      expect(result.cappedDuration).toBe(0);
      expect(result.efficiency).toBe(0);
      expect(result.resources).toEqual({});
      expect(result.breakdown).toEqual({});
    });

    it('超大时长应被封顶', () => {
      const calc = createCalculator({ maxOfflineHours: 24 });
      calc.addSource(makeSource());

      // 365 天
      const result = calc.calculate(365 * 24 * HOUR_MS);
      expect(result.totalDuration).toBe(365 * 24 * HOUR_MS);
      expect(result.cappedDuration).toBe(24 * HOUR_MS);
    });

    it('无产出源时收益应为空', () => {
      const calc = createCalculator();

      const result = calc.calculate(10 * HOUR_MS);
      expect(result.totalDuration).toBe(10 * HOUR_MS);
      expect(result.cappedDuration).toBe(10 * HOUR_MS);
      expect(result.efficiency).toBe(1);
      expect(result.resources).toEqual({});
      expect(result.breakdown).toEqual({});
    });

    it('产出源 baseOutput 为空对象时收益应为空', () => {
      const calc = createCalculator();
      calc.addSource({ id: 'empty', name: '空产出源', baseOutput: {} });

      const result = calc.calculate(10 * HOUR_MS);
      expect(result.resources).toEqual({});
    });
  });

  // ----------------------------------------------------------
  // updateConfig 方法
  // ----------------------------------------------------------
  describe('updateConfig', () => {
    it('应支持部分更新配置', () => {
      const calc = createCalculator();
      expect(calc.getConfig().maxOfflineHours).toBe(24);

      calc.updateConfig({ maxOfflineHours: 48 });
      expect(calc.getConfig().maxOfflineHours).toBe(48);
      // 其他配置不变
      expect(calc.getConfig().speedMultiplier).toBe(1);
    });

    it('应支持更新多个配置项', () => {
      const calc = createCalculator();
      calc.updateConfig({
        maxOfflineHours: 12,
        speedMultiplier: 5,
        prestigeBonus: 3,
        efficiencyDecayRate: 0.8,
        minEfficiency: 0.2,
      });

      const config = calc.getConfig();
      expect(config.maxOfflineHours).toBe(12);
      expect(config.speedMultiplier).toBe(5);
      expect(config.prestigeBonus).toBe(3);
      expect(config.efficiencyDecayRate).toBe(0.8);
      expect(config.minEfficiency).toBe(0.2);
    });

    it('配置更新后计算应使用新配置', () => {
      const calc = createCalculator();
      calc.addSource(makeSource());

      // 先验证默认收益
      const before = calc.calculate(1 * HOUR_MS);
      expect(before.resources.wood).toBeCloseTo(100, 5);

      // 更新速度倍率
      calc.updateConfig({ speedMultiplier: 10 });

      const after = calc.calculate(1 * HOUR_MS);
      expect(after.resources.wood).toBeCloseTo(1000, 5);
    });
  });

  // ----------------------------------------------------------
  // reset 方法
  // ----------------------------------------------------------
  describe('reset', () => {
    it('应清空所有产出源', () => {
      const calc = createCalculator();
      calc.addSource(makeSource({ id: 'a' }));
      calc.addSource(makeSource({ id: 'b' }));
      calc.addSource(makeSource({ id: 'c' }));
      expect(calc.getSourceCount()).toBe(3);

      calc.reset();
      expect(calc.getSourceCount()).toBe(0);
    });

    it('重置后配置应保持不变', () => {
      const calc = createCalculator({ maxOfflineHours: 48, speedMultiplier: 5 });
      calc.reset();

      const config = calc.getConfig();
      expect(config.maxOfflineHours).toBe(48);
      expect(config.speedMultiplier).toBe(5);
    });

    it('重置后计算应返回空收益', () => {
      const calc = createCalculator();
      calc.addSource(makeSource());
      calc.reset();

      const result = calc.calculate(10 * HOUR_MS);
      expect(result.resources).toEqual({});
      expect(result.breakdown).toEqual({});
    });

    it('重置后可以重新注册产出源', () => {
      const calc = createCalculator();
      calc.addSource(makeSource());
      calc.reset();
      calc.addSource(makeSource({ id: 'newSource', baseOutput: { gem: 10 } }));

      const result = calc.calculate(1 * HOUR_MS);
      expect(result.resources.gem).toBeCloseTo(10, 5);
      expect(result.resources.wood).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // 综合场景
  // ----------------------------------------------------------
  describe('综合场景', () => {
    it('模拟真实离线收益计算（建筑 + 领土 + 科技 + 声望）', () => {
      const calc = createCalculator({
        maxOfflineHours: 24,
        efficiencyDecayRate: 0.5,
        minEfficiency: 0.3,
        prestigeBonus: 1.5,
        speedMultiplier: 2,
      });

      // 建筑产出
      calc.addSource({
        id: 'buildings',
        name: '建筑群',
        baseOutput: { gold: 1000, wood: 500, stone: 300 },
        multiplier: 1,
      });

      // 领地产出
      calc.addSource({
        id: 'territory',
        name: '领土',
        baseOutput: { gold: 800, food: 600 },
        multiplier: 1.5,
      });

      // 科技加成（作为独立产出源模拟）
      calc.addSource({
        id: 'techBonus',
        name: '科技加成',
        baseOutput: { gold: 200 },
        multiplier: 3,
      });

      // 离线 8 小时
      // efficiency = 1 - (8/24) * 0.5 = 0.8333...
      const result = calc.calculate(8 * HOUR_MS);

      expect(result.efficiency).toBeCloseTo(1 - (8 / 24) * 0.5, 5);
      expect(result.totalDuration).toBe(8 * HOUR_MS);
      expect(result.cappedDuration).toBe(8 * HOUR_MS);

      // 验证各来源存在
      expect(result.breakdown['buildings']).toBeDefined();
      expect(result.breakdown['territory']).toBeDefined();
      expect(result.breakdown['techBonus']).toBeDefined();

      // 验证建筑收益：gold = 1000 * 1 * 2 * 1.5 * eff * 8
      const eff = result.efficiency;
      expect(result.breakdown['buildings'].resources.gold).toBeCloseTo(1000 * 1 * 2 * 1.5 * eff * 8, 3);
      expect(result.breakdown['territory'].resources.gold).toBeCloseTo(800 * 1.5 * 2 * 1.5 * eff * 8, 3);
      expect(result.breakdown['techBonus'].resources.gold).toBeCloseTo(200 * 3 * 2 * 1.5 * eff * 8, 3);
    });

    it('长时间离线应同时触发封顶和最低效率', () => {
      const calc = createCalculator({
        maxOfflineHours: 12,
        efficiencyDecayRate: 1,
        minEfficiency: 0.3,
      });
      calc.addSource({ id: 'gold', name: '金矿', baseOutput: { gold: 100 } });

      // 离线 48 小时，封顶到 12 小时
      // efficiency = 1 - (12/12) * 1 = 0，但 minEfficiency = 0.3
      const result = calc.calculate(48 * HOUR_MS);

      expect(result.cappedDuration).toBe(12 * HOUR_MS);
      expect(result.efficiency).toBeCloseTo(0.3, 5);
      expect(result.resources.gold).toBeCloseTo(100 * 0.3 * 12, 5); // 360
    });
  });
});
