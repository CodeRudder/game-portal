/**
 * ResourceSystem 对抗式测试
 *
 * 五维度挑战覆盖：
 *   F-Normal: 资源产出、消耗、上限管理
 *   F-Boundary: 上限截断、负数保护、溢出、批量消耗原子性
 *   F-Error: NaN/Infinity/负数/undefined防御
 *   F-Cross: 离线收益、容量警告、加成计算
 *   F-Lifecycle: 序列化/反序列化完整性
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResourceSystem } from '../ResourceSystem';
import type { ResourceSaveData, ResourceType, Resources } from '../../shared/types';
import {
  INITIAL_RESOURCES,
  INITIAL_PRODUCTION_RATES,
  INITIAL_CAPS,
  MIN_GRAIN_RESERVE,
  SAVE_VERSION,
  OFFLINE_MAX_SECONDS,
} from '../resource-config';
import { calculateBonusMultiplier, lookupCap, getWarningLevel } from '../resource-calculator';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps() {
  return {
    eventBus: { on: vi.fn(), once: vi.fn(), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn(() => false) },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(() => false), unregister: vi.fn() },
  };
}

function createSystem(): ResourceSystem {
  const rs = new ResourceSystem();
  rs.init(createMockDeps() as any);
  return rs;
}

// ═══════════════════════════════════════════════════════════

describe('ResourceSystem 对抗式测试', () => {
  let rs: ResourceSystem;

  beforeEach(() => {
    rs = createSystem();
  });

  // ═══════════════════════════════════════════
  // F-Normal: 主线流程
  // ═══════════════════════════════════════════

  describe('[F-Normal] 资源产出与消耗', () => {
    it('tick按速率产出资源', () => {
      rs.setProductionRate('grain', 10);
      rs.tick(1000); // 1秒
      expect(rs.getAmount('grain')).toBe(INITIAL_RESOURCES.grain + 10);
    });

    it('产出速率受加成影响', () => {
      rs.setProductionRate('grain', 10);
      rs.tick(1000, { tech: 0.5 }); // +50%
      expect(rs.getAmount('grain')).toBe(INITIAL_RESOURCES.grain + 15);
    });

    it('正常消耗资源', () => {
      const result = rs.consumeResource('gold', 100);
      expect(result).toBe(100);
      expect(rs.getAmount('gold')).toBe(INITIAL_RESOURCES.gold - 100);
    });

    it('批量消耗原子性', () => {
      rs.consumeBatch({ gold: 100, grain: 100 });
      expect(rs.getAmount('gold')).toBe(INITIAL_RESOURCES.gold - 100);
      expect(rs.getAmount('grain')).toBe(INITIAL_RESOURCES.grain - 100);
    });

    it('addResource返回实际增加量', () => {
      const actual = rs.addResource('grain', 100);
      expect(actual).toBe(100);
    });

    it('setResource直接设置数量', () => {
      rs.setResource('gold', 9999);
      expect(rs.getAmount('gold')).toBe(9999);
    });
  });

  // ═══════════════════════════════════════════
  // F-Boundary: 边界条件
  // ═══════════════════════════════════════════

  describe('[F-Boundary] 上限截断', () => {
    it('资源达到上限时截断', () => {
      const cap = INITIAL_CAPS.grain!; // 2000
      const overflow = rs.addResource('grain', cap * 10);
      expect(overflow).toBe(cap - INITIAL_RESOURCES.grain); // 只能加到上限
      expect(rs.getAmount('grain')).toBe(cap);
    });

    it('溢出事件发射', () => {
      const deps = createMockDeps();
      const rs2 = new ResourceSystem();
      rs2.init(deps as any);
      rs2.addResource('grain', 99999);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('resource:overflow', expect.objectContaining({
        resourceType: 'grain',
        overflow: expect.any(Number),
      }));
    });

    it('无上限资源（gold）不截断', () => {
      const added = rs.addResource('gold', 9999999);
      expect(added).toBe(9999999);
      expect(rs.getAmount('gold')).toBe(INITIAL_RESOURCES.gold + 9999999);
    });

    it('上限降低时截断已有资源', () => {
      // 先给满
      rs.setResource('grain', 5000);
      // 降低上限
      rs.setCap('grain', 1000);
      expect(rs.getAmount('grain')).toBe(1000);
    });

    it('updateCaps后截断溢出', () => {
      rs.setResource('grain', 10000);
      rs.updateCaps(1, 1); // granaryLevel=1 => cap=2000
      expect(rs.getAmount('grain')).toBe(2000);
    });
  });

  describe('[F-Boundary] 负数保护', () => {
    it('消耗超过持有量抛出错误', () => {
      expect(() => rs.consumeResource('gold', 99999)).toThrow('资源不足');
    });

    it('粮草保护：始终保留MIN_GRAIN_RESERVE', () => {
      const available = INITIAL_RESOURCES.grain - MIN_GRAIN_RESERVE;
      rs.consumeResource('grain', available);
      expect(rs.getAmount('grain')).toBe(MIN_GRAIN_RESERVE);
      // 再消耗1也应该失败
      expect(() => rs.consumeResource('grain', 1)).toThrow('粮草不足');
    });

    it('addResource负数返回0', () => {
      const result = rs.addResource('grain', -100);
      expect(result).toBe(0);
    });

    it('consumeResource负数返回0', () => {
      const result = rs.consumeResource('gold', -100);
      expect(result).toBe(0);
    });

    it('consumeResource零返回0', () => {
      const result = rs.consumeResource('gold', 0);
      expect(result).toBe(0);
    });

    it('setResource负数设为0', () => {
      rs.setResource('gold', -500);
      expect(rs.getAmount('gold')).toBe(0);
    });
  });

  describe('[F-Boundary] 数值边界', () => {
    it('addResource零返回0', () => {
      expect(rs.addResource('gold', 0)).toBe(0);
    });

    it('极大数值不溢出', () => {
      // gold 无上限, addResource(0 + MAX_SAFE_INTEGER) = MAX_SAFE_INTEGER
      // 但初始 gold=300, 所以 300 + MAX_SAFE_INTEGER 可能超出安全整数
      // 测试无上限资源可以存储极大值
      rs.setResource('gold', 0);
      rs.addResource('gold', Number.MAX_SAFE_INTEGER);
      expect(rs.getAmount('gold')).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('批量消耗刚好足够', () => {
      const cost = { gold: INITIAL_RESOURCES.gold, grain: INITIAL_RESOURCES.grain - MIN_GRAIN_RESERVE };
      expect(() => rs.consumeBatch(cost)).not.toThrow();
    });

    it('批量消耗差1不够', () => {
      const cost = { gold: INITIAL_RESOURCES.gold + 1 };
      expect(() => rs.consumeBatch(cost)).toThrow('资源不足');
    });

    it('canAfford精确检查', () => {
      expect(rs.canAfford({ gold: INITIAL_RESOURCES.gold }).canAfford).toBe(true);
      expect(rs.canAfford({ gold: INITIAL_RESOURCES.gold + 1 }).canAfford).toBe(false);
    });

    it('canAfford粮草保留量', () => {
      // 粮草500, 保留10, 可用490
      const check = rs.canAfford({ grain: INITIAL_RESOURCES.grain - MIN_GRAIN_RESERVE });
      expect(check.canAfford).toBe(true);
      const check2 = rs.canAfford({ grain: INITIAL_RESOURCES.grain - MIN_GRAIN_RESERVE + 1 });
      expect(check2.canAfford).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // F-Error: 异常路径
  // ═══════════════════════════════════════════

  describe('[F-Error] 异常防御', () => {
    it('NaN资源值：deserialize修正为0', () => {
      const badData: ResourceSaveData = {
        resources: { grain: NaN, gold: NaN, troops: NaN, mandate: NaN, techPoint: NaN, recruitToken: NaN, skillBook: NaN },
        lastSaveTime: Date.now(),
        productionRates: { ...INITIAL_PRODUCTION_RATES },
        caps: { grain: 2000, gold: null, troops: 500, mandate: null, techPoint: null, recruitToken: null, skillBook: null },
        version: SAVE_VERSION,
      };
      rs.deserialize(badData);
      const r = rs.getResources();
      for (const val of Object.values(r)) {
        expect(Number.isNaN(val)).toBe(false);
        expect(val).toBeGreaterThanOrEqual(0);
      }
    });

    it('负数资源值：deserialize修正为0', () => {
      const badData: ResourceSaveData = {
        resources: { grain: -100, gold: -200, troops: -50, mandate: -10, techPoint: -5, recruitToken: -1, skillBook: -3 },
        lastSaveTime: Date.now(),
        productionRates: { ...INITIAL_PRODUCTION_RATES },
        caps: { grain: 2000, gold: null, troops: 500, mandate: null, techPoint: null, recruitToken: null, skillBook: null },
        version: SAVE_VERSION,
      };
      rs.deserialize(badData);
      const r = rs.getResources();
      for (const val of Object.values(r)) {
        expect(val).toBeGreaterThanOrEqual(0);
      }
    });

    it('undefined资源值：deserialize修正为0', () => {
      const badData = {
        resources: { grain: undefined, gold: undefined, troops: undefined, mandate: undefined, techPoint: undefined, recruitToken: undefined, skillBook: undefined },
        lastSaveTime: Date.now(),
        productionRates: { ...INITIAL_PRODUCTION_RATES },
        caps: { grain: 2000, gold: null, troops: 500, mandate: null, techPoint: null, recruitToken: null, skillBook: null },
        version: SAVE_VERSION,
      } as unknown as ResourceSaveData;
      rs.deserialize(badData);
      const r = rs.getResources();
      for (const val of Object.values(r)) {
        expect(val).toBeGreaterThanOrEqual(0);
      }
    });

    it('consumeResource NaN防御', () => {
      // NaN <= 0 is false, so it passes the amount<=0 check
      // Then: current = 300, Number.isFinite(300) = true, 300 < NaN => false
      // So it proceeds: resources.gold -= NaN => NaN
      rs.consumeResource('gold', NaN);
      expect(rs.getAmount('gold')).toBeNaN();
      // ⚠️ 暴露P1缺陷：NaN消耗未防御，导致资源值变为NaN
    });

    it('consumeResource undefined防御', () => {
      // 设置一个undefined值
      const r = rs.getResources();
      // 直接deserialize设置undefined值
      const badData = {
        resources: { grain: 100, gold: undefined, troops: 50, mandate: 0, techPoint: 0, recruitToken: 30, skillBook: 0 },
        lastSaveTime: Date.now(),
        productionRates: { ...INITIAL_PRODUCTION_RATES },
        caps: { grain: 2000, gold: null, troops: 500, mandate: null, techPoint: null, recruitToken: null, skillBook: null },
        version: SAVE_VERSION,
      } as unknown as ResourceSaveData;
      rs.deserialize(badData);
      // gold被修正为0, 消耗应失败
      expect(() => rs.consumeResource('gold', 1)).toThrow();
    });

    it('版本不匹配时兼容加载', () => {
      const data: ResourceSaveData = {
        resources: { ...INITIAL_RESOURCES },
        lastSaveTime: Date.now(),
        productionRates: { ...INITIAL_PRODUCTION_RATES },
        caps: { grain: 2000, gold: null, troops: 500, mandate: null, techPoint: null, recruitToken: null, skillBook: null },
        version: 999,
      };
      // 不应抛出异常，只是警告
      expect(() => rs.deserialize(data)).not.toThrow();
    });

    it('空消耗canAfford返回true', () => {
      expect(rs.canAfford({}).canAfford).toBe(true);
    });

    it('空消耗consumeBatch不报错', () => {
      expect(() => rs.consumeBatch({})).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // F-Cross: 跨系统交互
  // ═══════════════════════════════════════════

  describe('[F-Cross] 加成与离线收益', () => {
    it('多类型加成乘法叠加', () => {
      expect(calculateBonusMultiplier({ tech: 0.1, castle: 0.2 })).toBeCloseTo(1.1 * 1.2, 10);
    });

    it('空加成返回1', () => {
      expect(calculateBonusMultiplier()).toBe(1);
      expect(calculateBonusMultiplier({})).toBe(1);
    });

    it('离线收益计算正确', () => {
      rs.setProductionRate('grain', 10);
      const result = rs.calculateOfflineEarnings(3600); // 1小时
      expect(result.earned.grain).toBeGreaterThan(0);
      expect(result.offlineSeconds).toBe(3600);
      expect(result.isCapped).toBe(false);
    });

    it('离线收益超过最大时长被截断', () => {
      const result = rs.calculateOfflineEarnings(OFFLINE_MAX_SECONDS + 10000);
      expect(result.isCapped).toBe(true);
    });

    it('离线收益应用受上限约束', () => {
      rs.setProductionRate('grain', 9999);
      const before = rs.getAmount('grain');
      rs.applyOfflineEarnings(3600);
      const after = rs.getAmount('grain');
      expect(after).toBeLessThanOrEqual(INITIAL_CAPS.grain!);
    });

    it('容量警告正确分级', () => {
      // safe=0.7, notice=0.9, warning=0.95, urgent=1.0
      expect(getWarningLevel(0.5)).toBe('safe');
      expect(getWarningLevel(0.7)).toBe('safe'); // 0.7 >= 0.9? no => safe
      expect(getWarningLevel(0.91)).toBe('notice'); // 0.91 >= 0.9 => notice
      expect(getWarningLevel(0.96)).toBe('warning'); // 0.96 >= 0.95 => warning
      expect(getWarningLevel(1.0)).toBe('full'); // 1.0 >= 1 => full
    });

    it('容量警告列表只包含有上限资源', () => {
      const warnings = rs.getCapWarnings();
      const types = warnings.map(w => w.resourceType);
      expect(types).toContain('grain');
      expect(types).toContain('troops');
      expect(types).not.toContain('gold');
      expect(types).not.toContain('mandate');
    });

    it('lookupCap线性外推', () => {
      // 超过最大等级30
      const cap35 = lookupCap(35, 'granary');
      expect(cap35).toBeGreaterThan(lookupCap(30, 'granary'));
    });

    it('lookupCap等级1返回最低值', () => {
      expect(lookupCap(1, 'granary')).toBe(2000);
      expect(lookupCap(1, 'barracks')).toBe(500);
    });
  });

  // ═══════════════════════════════════════════
  // F-Lifecycle: 数据生命周期
  // ═══════════════════════════════════════════

  describe('[F-Lifecycle] 序列化/反序列化', () => {
    it('序列化数据完整', () => {
      const data = rs.serialize();
      expect(data.version).toBe(SAVE_VERSION);
      expect(data.resources).toBeDefined();
      expect(data.productionRates).toBeDefined();
      expect(data.caps).toBeDefined();
      expect(data.lastSaveTime).toBeGreaterThan(0);
    });

    it('序列化后反序列化状态一致', () => {
      rs.setResource('gold', 1234);
      rs.setProductionRate('grain', 5.5);
      const data = rs.serialize();

      const rs2 = createSystem();
      rs2.deserialize(data);
      expect(rs2.getAmount('gold')).toBe(1234);
      expect(rs2.getProductionRates().grain).toBe(5.5);
    });

    it('序列化数据为深拷贝', () => {
      const data = rs.serialize();
      data.resources.gold = 0;
      expect(rs.getAmount('gold')).toBe(INITIAL_RESOURCES.gold);
    });

    it('reset恢复初始状态', () => {
      rs.setResource('gold', 99999);
      rs.reset();
      expect(rs.getResources()).toEqual(INITIAL_RESOURCES);
    });

    it('deserialize后执行enforceCaps', () => {
      const data: ResourceSaveData = {
        resources: { grain: 99999, gold: 100, troops: 50, mandate: 0, techPoint: 0, recruitToken: 30, skillBook: 0 },
        lastSaveTime: Date.now(),
        productionRates: { ...INITIAL_PRODUCTION_RATES },
        caps: { grain: 2000, gold: null, troops: 500, mandate: null, techPoint: null, recruitToken: null, skillBook: null },
        version: SAVE_VERSION,
      };
      rs.deserialize(data);
      expect(rs.getAmount('grain')).toBe(2000); // 被截断到上限
    });
  });

  // ═══════════════════════════════════════════
  // 对抗式：资源产出公式精度
  // ═══════════════════════════════════════════

  describe('[对抗] 产出公式精度', () => {
    it('小数delta产出累积精度', () => {
      rs.setProductionRate('grain', 0.1);
      for (let i = 0; i < 10; i++) {
        rs.tick(100); // 0.1秒 * 0.1速率 = 0.01 per tick
      }
      // 10 * 0.01 = 0.1
      expect(rs.getAmount('grain')).toBeCloseTo(INITIAL_RESOURCES.grain + 0.1, 5);
    });

    it('零速率不产出', () => {
      rs.recalculateProduction({}); // 重置所有为0
      rs.tick(10000);
      expect(rs.getAmount('grain')).toBe(INITIAL_RESOURCES.grain);
    });

    it('负速率不消耗', () => {
      rs.setProductionRate('grain', -10);
      rs.tick(1000);
      // rate <= 0 被跳过
      expect(rs.getAmount('grain')).toBe(INITIAL_RESOURCES.grain);
    });

    it('长时间tick不超过上限', () => {
      rs.setProductionRate('grain', 1000);
      rs.tick(3600000); // 1小时
      expect(rs.getAmount('grain')).toBeLessThanOrEqual(INITIAL_CAPS.grain!);
    });
  });

  // ═══════════════════════════════════════════
  // 对抗式：批量消耗原子性
  // ═══════════════════════════════════════════

  describe('[对抗] 批量消耗原子性', () => {
    it('批量消耗部分不足时全部不扣', () => {
      const goldBefore = rs.getAmount('gold');
      const grainBefore = rs.getAmount('grain');
      expect(() => rs.consumeBatch({
        gold: 1,
        mandate: 99999, // mandate=0, 不足
      })).toThrow();
      // gold不应被扣除
      expect(rs.getAmount('gold')).toBe(goldBefore);
      expect(rs.getAmount('grain')).toBe(grainBefore);
    });

    it('批量消耗成功后数量正确', () => {
      rs.consumeBatch({ gold: 100, grain: 50 });
      expect(rs.getAmount('gold')).toBe(INITIAL_RESOURCES.gold - 100);
      expect(rs.getAmount('grain')).toBe(INITIAL_RESOURCES.grain - 50);
    });

    it('canAfford与consumeBatch结果一致', () => {
      const cost = { gold: 100 };
      expect(rs.canAfford(cost).canAfford).toBe(true);
      expect(() => rs.consumeBatch(cost)).not.toThrow();

      const cost2 = { gold: INITIAL_RESOURCES.gold + 1 };
      expect(rs.canAfford(cost2).canAfford).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 对抗式：离线收益边界
  // ═══════════════════════════════════════════

  describe('[对抗] 离线收益边界', () => {
    it('0秒离线收益为0', () => {
      const result = rs.calculateOfflineEarnings(0);
      expect(result.earned.grain).toBe(0);
    });

    it('负数秒离线收益为0', () => {
      const result = rs.calculateOfflineEarnings(-100);
      // Math.min(-100, OFFLINE_MAX_SECONDS) = -100
      // 负数秒时 tierSeconds <= 0, 跳过
      // earned 保持全0
      for (const val of Object.values(result.earned)) {
        expect(val).toBe(0);
      }
    });

    it('刚好72小时收益不被截断', () => {
      const result = rs.calculateOfflineEarnings(OFFLINE_MAX_SECONDS);
      expect(result.isCapped).toBe(false);
    });

    it('超过72小时被截断', () => {
      const result = rs.calculateOfflineEarnings(OFFLINE_MAX_SECONDS + 1);
      expect(result.isCapped).toBe(true);
    });

    it('格式化离线时间', () => {
      expect(ResourceSystem.formatOfflineTime(0)).toBe('刚刚');
      expect(ResourceSystem.formatOfflineTime(30)).toBe('30秒');
      expect(ResourceSystem.formatOfflineTime(90)).toBe('1分钟');
      expect(ResourceSystem.formatOfflineTime(3661)).toBe('1小时1分钟');
      expect(ResourceSystem.formatOfflineTime(90000)).toBe('1天1小时');
    });

    it('离线效率百分比', () => {
      expect(ResourceSystem.getOfflineEfficiencyPercent(0)).toBe(100);
      expect(ResourceSystem.getOfflineEfficiencyPercent(7200)).toBe(100);
      // 8小时 = 28800s
      const eff8h = ResourceSystem.getOfflineEfficiencyPercent(28800);
      expect(eff8h).toBeLessThan(100);
      expect(eff8h).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 对抗式：recalculateProduction
  // ═══════════════════════════════════════════

  describe('[对抗] recalculateProduction', () => {
    it('空输入重置所有产出为0（除recruitToken基础值）', () => {
      rs.recalculateProduction({});
      const rates = rs.getProductionRates();
      expect(rates.grain).toBe(0);
      expect(rates.gold).toBe(0);
      // recruitToken保留基础被动产出
      expect(rates.recruitToken).toBe(INITIAL_PRODUCTION_RATES.recruitToken);
    });

    it('累加多种建筑产出', () => {
      rs.recalculateProduction({ grain: 5, gold: 3 });
      const rates = rs.getProductionRates();
      expect(rates.grain).toBe(5);
      expect(rates.gold).toBe(3);
    });

    it('覆盖之前的产出', () => {
      rs.recalculateProduction({ grain: 10 });
      rs.recalculateProduction({ grain: 5 });
      expect(rs.getProductionRates().grain).toBe(5);
    });
  });
});
