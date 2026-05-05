/**
 * ThreeKingdomsEngine 单元测试
 *
 * 覆盖资源系统的所有 public 方法
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ThreeKingdomsEngine,
  type ResourceType,
  type Resources,
} from '../ThreeKingdomsEngine';

describe('ThreeKingdomsEngine', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = new ThreeKingdomsEngine();
  });

  // ═══════════════════════════════════════════════════════════
  // 初始状态
  // ═══════════════════════════════════════════════════════════

  describe('初始状态', () => {
    it('应有正确的初始资源量', () => {
      expect(engine.getResource('food')).toBe(500);
      expect(engine.getResource('wood')).toBe(300);
      expect(engine.getResource('iron')).toBe(100);
      expect(engine.getResource('gold')).toBe(300);
    });

    it('getResources 应返回所有资源的副本', () => {
      const res = engine.getResources();
      expect(res).toEqual({ food: 500, wood: 300, iron: 100, gold: 300 });

      // 修改副本不影响引擎
      res.food = 9999;
      expect(engine.getResource('food')).toBe(500);
    });

    it('应有正确的基础产出速率', () => {
      const rate = engine.getProductionRate();
      expect(rate.food).toBe(0.5);
      expect(rate.wood).toBe(0.3);
      expect(rate.iron).toBe(0.1);
      expect(rate.gold).toBe(0.8);
    });

    it('应有正确的初始存储上限', () => {
      expect(engine.getResourceCap('food')).toBe(2000);
      expect(engine.getResourceCap('wood')).toBe(1500);
      expect(engine.getResourceCap('iron')).toBe(800);
      expect(engine.getResourceCap('gold')).toBe(Infinity);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // tick — 资源产出
  // ═══════════════════════════════════════════════════════════

  describe('tick()', () => {
    it('应按 deltaTime × productionRate 增加资源', () => {
      engine.tick(1.0);
      // food: 500 + 0.5*1 = 500.5
      expect(engine.getResource('food')).toBeCloseTo(500.5, 2);
      // gold: 300 + 0.8*1 = 300.8
      expect(engine.getResource('gold')).toBeCloseTo(300.8, 2);
    });

    it('应支持小数 deltaTime（0.1s）', () => {
      engine.tick(0.1);
      // food: 500 + 0.5*0.1 = 500.05
      expect(engine.getResource('food')).toBeCloseTo(500.05, 3);
    });

    it('连续 tick 应正确累加', () => {
      engine.tick(0.5);
      engine.tick(0.5);
      // food: 500 + 0.5*0.5 + 0.5*0.5 = 500.5
      expect(engine.getResource('food')).toBeCloseTo(500.5, 2);
    });

    it('资源达到上限后应停止增长', () => {
      // food cap = 2000, rate = 0.5/s
      // 模拟大量 tick
      for (let i = 0; i < 5000; i++) {
        engine.tick(1.0);
      }
      expect(engine.getResource('food')).toBe(2000);
    });

    it('deltaTime <= 0 时不应改变资源', () => {
      const before = engine.getResource('food');
      engine.tick(0);
      expect(engine.getResource('food')).toBe(before);
      engine.tick(-1);
      expect(engine.getResource('food')).toBe(before);
    });

    it('deltaTime 为 NaN/Infinity 时不应改变资源', () => {
      const before = engine.getResource('food');
      engine.tick(NaN);
      expect(engine.getResource('food')).toBe(before);
      engine.tick(Infinity);
      expect(engine.getResource('food')).toBe(before);
    });

    it('单次 tick deltaTime 超过 1s 应被截断为 1s', () => {
      engine.tick(100); // 100s → capped to 1s
      // food: 500 + 0.5*1 = 500.5 (not 500 + 50)
      expect(engine.getResource('food')).toBeCloseTo(500.5, 2);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // addResource
  // ═══════════════════════════════════════════════════════════

  describe('addResource()', () => {
    it('应正确增加资源', () => {
      engine.addResource('food', 100);
      expect(engine.getResource('food')).toBe(600);
    });

    it('增加后应受上限约束', () => {
      engine.addResource('food', 9999);
      expect(engine.getResource('food')).toBe(2000); // cap
    });

    it('amount <= 0 时不应改变资源', () => {
      engine.addResource('food', 0);
      expect(engine.getResource('food')).toBe(500);
      engine.addResource('food', -100);
      expect(engine.getResource('food')).toBe(500);
    });

    it('gold 无上限应可无限增加', () => {
      engine.addResource('gold', 999999);
      expect(engine.getResource('gold')).toBe(999999 + 300);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // consumeResource
  // ═══════════════════════════════════════════════════════════

  describe('consumeResource()', () => {
    it('资源充足时应成功消耗', () => {
      const result = engine.consumeResource('food', 100);
      expect(result).toBe(true);
      expect(engine.getResource('food')).toBe(400);
    });

    it('资源不足时应失败且不扣减', () => {
      const result = engine.consumeResource('food', 9999);
      expect(result).toBe(false);
      expect(engine.getResource('food')).toBe(500); // 未变化
    });

    it('amount <= 0 应视为成功', () => {
      expect(engine.consumeResource('food', 0)).toBe(true);
      expect(engine.consumeResource('food', -10)).toBe(true);
    });

    it('粮草消耗后应保留最低量 (10)', () => {
      // 尝试消耗到只剩 5
      const result = engine.consumeResource('food', 495);
      expect(result).toBe(false); // 500-495=5 < 10 保护线
      expect(engine.getResource('food')).toBe(500); // 未变化
    });

    it('粮草消耗到刚好保留 10 应成功', () => {
      const result = engine.consumeResource('food', 490);
      expect(result).toBe(true);
      expect(engine.getResource('food')).toBe(10);
    });

    it('非粮草资源无最低保留限制', () => {
      const result = engine.consumeResource('wood', 300);
      expect(result).toBe(true);
      expect(engine.getResource('wood')).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // canAfford
  // ═══════════════════════════════════════════════════════════

  describe('canAfford()', () => {
    it('所有资源充足时应返回 true', () => {
      expect(engine.canAfford({ food: 100, gold: 50 })).toBe(true);
    });

    it('任一资源不足应返回 false', () => {
      expect(engine.canAfford({ food: 9999 })).toBe(false);
    });

    it('空 cost 应返回 true', () => {
      expect(engine.canAfford({})).toBe(true);
    });

    it('cost 中值为 0 或 undefined 的字段应忽略', () => {
      expect(engine.canAfford({ food: 0, wood: undefined as any })).toBe(true);
    });

    it('应考虑粮草最低保留', () => {
      // food=500, 保留10, 可用=490
      expect(engine.canAfford({ food: 490 })).toBe(true);
      expect(engine.canAfford({ food: 491 })).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 产出速率管理
  // ═══════════════════════════════════════════════════════════

  describe('产出速率管理', () => {
    it('setProductionRate 应覆盖速率', () => {
      engine.setProductionRate('food', 5.0);
      expect(engine.getProductionRate().food).toBe(5.0);
    });

    it('setProductionRate 不允许负值', () => {
      engine.setProductionRate('food', -1);
      expect(engine.getProductionRate().food).toBe(0);
    });

    it('addProductionBonus 应叠加速率', () => {
      engine.addProductionBonus('food', 0.5);
      expect(engine.getProductionRate().food).toBe(1.0); // 0.5 + 0.5
    });

    it('addProductionBonus 不允许结果为负', () => {
      engine.addProductionBonus('food', -999);
      expect(engine.getProductionRate().food).toBe(0);
    });

    it('setAllProductionRates 应批量设置', () => {
      engine.setAllProductionRates({ food: 1, wood: 2, iron: 3, gold: 4 });
      const rate = engine.getProductionRate();
      expect(rate.food).toBe(1);
      expect(rate.wood).toBe(2);
      expect(rate.iron).toBe(3);
      expect(rate.gold).toBe(4);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 存储上限管理
  // ═══════════════════════════════════════════════════════════

  describe('存储上限管理', () => {
    it('setResourceCap 应更新上限', () => {
      engine.setResourceCap('food', 5000);
      expect(engine.getResourceCap('food')).toBe(5000);
    });

    it('降低上限时应截断已有资源', () => {
      engine.setResourceCap('food', 100);
      expect(engine.getResource('food')).toBe(100);
    });

    it('getCapacityPercent 应返回正确百分比', () => {
      // food=500, cap=2000 → 25%
      expect(engine.getCapacityPercent('food')).toBeCloseTo(0.25, 2);
    });

    it('无上限资源 getCapacityPercent 应返回 0', () => {
      expect(engine.getCapacityPercent('gold')).toBe(0);
    });

    it('满资源时 getCapacityPercent 应返回 1', () => {
      engine.addResource('food', 9999);
      expect(engine.getCapacityPercent('food')).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 离线收益
  // ═══════════════════════════════════════════════════════════

  describe('calculateOfflineProgress()', () => {
    it('0秒离线应返回全零', () => {
      const gain = engine.calculateOfflineProgress(0);
      expect(gain.food).toBe(0);
      expect(gain.gold).toBe(0);
    });

    it('负数离线应返回全零', () => {
      const gain = engine.calculateOfflineProgress(-100);
      expect(gain.food).toBe(0);
    });

    it('1小时离线应按100%效率计算', () => {
      const gain = engine.calculateOfflineProgress(3600);
      // food rate=0.5, 1h=3600s, 100% efficiency
      expect(gain.food).toBeCloseTo(0.5 * 3600, 1);
    });

    it('5小时离线应分段计算（2h@100% + 3h@80%）', () => {
      const gain = engine.calculateOfflineProgress(5 * 3600);
      // food rate=0.5
      // tier1: 7200s * 100% = 7200 effective seconds
      // tier2: (18000-7200)=10800s * 80% = 8640 effective seconds
      // total effective = 15840s
      // food gain = 0.5 * 15840 = 7920
      expect(gain.food).toBeCloseTo(0.5 * 15840, 1);
    });

    it('超过72小时应封顶', () => {
      const gain72h = engine.calculateOfflineProgress(72 * 3600);
      const gain100h = engine.calculateOfflineProgress(100 * 3600);
      expect(gain72h.food).toBe(gain100h.food);
    });
  });

  describe('applyOfflineProgress()', () => {
    it('应将离线收益添加到资源', () => {
      engine.applyOfflineProgress(3600);
      // food: 500 + 0.5*3600 = 2300, but cap=2000
      expect(engine.getResource('food')).toBe(2000);
    });

    it('应返回实际获得的量（截断后）', () => {
      const actual = engine.applyOfflineProgress(3600);
      // food: min(1800, 2000-500) = 1500
      expect(actual.food).toBe(1500);
    });

    it('无上限资源不应截断', () => {
      const actual = engine.applyOfflineProgress(3600);
      // gold: 0.8 * 3600 = 2880
      expect(actual.gold).toBeCloseTo(2880, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 序列化 / 反序列化
  // ═══════════════════════════════════════════════════════════

  describe('serialize() / deserialize()', () => {
    it('serialize 应返回正确的数据结构', () => {
      const data = engine.serialize();
      expect(data).toHaveProperty('resources');
      expect(data).toHaveProperty('productionRate');
      expect(data).toHaveProperty('lastTickTime');
      expect(data.resources.food).toBe(500);
    });

    it('deserialize 应恢复引擎状态', () => {
      engine.addResource('food', 100);
      const saved = engine.serialize();

      const engine2 = new ThreeKingdomsEngine();
      engine2.deserialize(saved);
      expect(engine2.getResource('food')).toBe(600);
    });

    it('deserialize null 不应崩溃', () => {
      expect(() => engine.deserialize(null)).not.toThrow();
      expect(engine.getResource('food')).toBe(500);
    });

    it('deserialize 空对象不应崩溃', () => {
      expect(() => engine.deserialize({})).not.toThrow();
    });

    it('deserialize 缺失字段应使用默认值', () => {
      engine.deserialize({ resources: { food: 1000 } });
      // wood 缺失 → 使用默认 300
      expect(engine.getResource('food')).toBe(1000);
      expect(engine.getResource('wood')).toBe(300);
    });

    it('deserialize 非法数值应修正', () => {
      engine.deserialize({
        resources: { food: -100, wood: NaN, iron: Infinity, gold: 'abc' },
      });
      expect(engine.getResource('food')).toBe(500); // fallback to initial
      expect(engine.getResource('wood')).toBe(300); // fallback to initial
      expect(engine.getResource('iron')).toBe(100); // fallback to initial
    });
  });

  // ═══════════════════════════════════════════════════════════
  // reset
  // ═══════════════════════════════════════════════════════════

  describe('reset()', () => {
    it('应恢复到初始状态', () => {
      engine.addResource('food', 9999);
      engine.setProductionRate('food', 100);
      engine.reset();
      expect(engine.getResource('food')).toBe(500);
      expect(engine.getProductionRate().food).toBe(0.5);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 工具方法
  // ═══════════════════════════════════════════════════════════

  describe('工具方法', () => {
    it('getLastTickTime 应返回毫秒时间戳', () => {
      const t = engine.getLastTickTime();
      expect(t).toBeGreaterThan(0);
      expect(Date.now() - t).toBeLessThan(1000);
    });

    it('getSaveVersion 应返回版本号', () => {
      expect(engine.getSaveVersion()).toBe(1);
    });
  });
});
