import { vi } from 'vitest';
/**
 * ResourceSystem 单元测试
 * 覆盖：初始化、tick产出、消耗、上限管理、容量警告、离线收益、序列化/反序列化
 */

import { ResourceSystem } from '../ResourceSystem';
import type { ResourceSaveData } from '../../shared/types';
import {
  INITIAL_RESOURCES,
  INITIAL_PRODUCTION_RATES,
  INITIAL_CAPS,
  GRANARY_CAPACITY_TABLE,
  BARRACKS_CAPACITY_TABLE,
  MIN_GRAIN_RESERVE,
  SAVE_VERSION,
  OFFLINE_MAX_SECONDS,
} from '../resource-config';
import { gameLog } from '../../../core/logger';

function createMockDeps() {
  return {
    eventBus: { on: vi.fn(), once: vi.fn(), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn(() => false) },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(() => false), unregister: vi.fn() },
  };
}

describe('ResourceSystem', () => {
  let rs: ResourceSystem;
  beforeEach(() => { vi.restoreAllMocks(); rs = new ResourceSystem(); rs.init(createMockDeps()); });

  // ═══════════════════════════════════════════
  // 1. 初始化
  // ═══════════════════════════════════════════
  describe('初始化', () => {
    it('4种资源初始值正确', () => {
      const r = rs.getResources();
      expect(r).toEqual(INITIAL_RESOURCES);
    });
    it('初始产出速率与配置一致', () => {
      const rates = rs.getProductionRates();
      expect(rates.grain).toBe(INITIAL_PRODUCTION_RATES.grain);
      expect(rates.gold).toBe(INITIAL_PRODUCTION_RATES.gold);
      expect(rates.troops).toBe(INITIAL_PRODUCTION_RATES.troops);
      expect(rates.mandate).toBe(INITIAL_PRODUCTION_RATES.mandate);
    });
    it('初始上限正确', () => {
      const caps = rs.getCaps();
      expect(caps.grain).toBe(INITIAL_CAPS.grain);
      expect(caps.gold).toBe(INITIAL_CAPS.gold);
      expect(caps.troops).toBe(INITIAL_CAPS.troops);
      expect(caps.mandate).toBeNull();
    });
    it('getAmount 返回指定资源数量', () => {
      expect(rs.getAmount('grain')).toBe(INITIAL_RESOURCES.grain);
      expect(rs.getAmount('mandate')).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 资源产出 (tick)
  // ═══════════════════════════════════════════
  describe('资源产出 (tick)', () => {
    it('tick 后资源按速率增加正确数量', () => {
      rs.setProductionRate('grain', 10);
      rs.tick(1000);
      expect(rs.getAmount('grain')).toBe(INITIAL_RESOURCES.grain + 10);
    });
    it('产出速率为0时不增加', () => {
      rs.recalculateProduction({}); // 重置所有产出为0
      rs.tick(5000);
      expect(rs.getAmount('grain')).toBe(INITIAL_RESOURCES.grain);
    });
    it('资源不超过上限', () => {
      rs.setProductionRate('grain', 9999);
      rs.tick(1000);
      expect(rs.getAmount('grain')).toBe(INITIAL_CAPS.grain);
    });
    it('产出速率受建筑等级影响', () => {
      // 使用 levelTable 查表值：farmland Lv3 → production=1.5 (来自 FARMLAND_LEVEL_TABLE)
      rs.recalculateProduction({ grain: 1.5 });
      expect(rs.getProductionRates().grain).toBeCloseTo(1.5);
    });
    it('bonus 加成正确应用', () => {
      rs.setProductionRate('grain', 10);
      rs.tick(1000, { castle: 0.2 });
      expect(rs.getAmount('grain')).toBeCloseTo(INITIAL_RESOURCES.grain + 12);
    });
    it('多个 bonus 乘法叠加', () => {
      rs.setProductionRate('grain', 10);
      rs.tick(1000, { castle: 0.2, tech: 0.1 });
      expect(rs.getAmount('grain')).toBeCloseTo(INITIAL_RESOURCES.grain + 13.2);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 资源消耗
  // ═══════════════════════════════════════════
  describe('资源消耗', () => {
    it('consumeBatch 正常消耗扣减正确', () => {
      const before = rs.getAmount('gold');
      rs.consumeBatch({ gold: 30 });
      expect(rs.getAmount('gold')).toBe(before - 30);
    });
    it('consumeBatch 批量消耗多种资源', () => {
      const gB = rs.getAmount('grain'), goB = rs.getAmount('gold');
      rs.consumeBatch({ grain: 50, gold: 20 });
      expect(rs.getAmount('grain')).toBe(gB - 50);
      expect(rs.getAmount('gold')).toBe(goB - 20);
    });
    it('consumeBatch 资源不足时抛出错误', () => {
      expect(() => rs.consumeBatch({ gold: 9999 })).toThrow(/资源不足/);
    });
    it('consumeBatch 资源不足时原子性（不扣减任何资源）', () => {
      const before = rs.getResources();
      try { rs.consumeBatch({ grain: 50, gold: 9999 }); } catch { /* expected */ }
      expect(rs.getAmount('grain')).toBe(before.grain);
      expect(rs.getAmount('gold')).toBe(before.gold);
    });
    it('consumeResource 粮草保护：保留 MIN_GRAIN_RESERVE', () => {
      rs.setResource('grain', MIN_GRAIN_RESERVE + 5);
      expect(() => rs.consumeResource('grain', 6)).toThrow(/粮草不足/);
    });
    it('consumeResource 粮草保护：刚好够用时不报错', () => {
      rs.setResource('grain', MIN_GRAIN_RESERVE + 10);
      expect(() => rs.consumeResource('grain', 10)).not.toThrow();
      expect(rs.getAmount('grain')).toBe(MIN_GRAIN_RESERVE);
    });
    it('canAfford 检查粮草时扣除保留量', () => {
      rs.setResource('grain', MIN_GRAIN_RESERVE + 5);
      expect(rs.canAfford({ grain: 6 }).canAfford).toBe(false);
    });
    it('canAfford 足够时返回 true 且无短缺', () => {
      const r = rs.canAfford({ grain: 10, gold: 10 });
      expect(r.canAfford).toBe(true);
      expect(Object.keys(r.shortages)).toHaveLength(0);
    });
    it('canAfford 不足时返回短缺信息', () => {
      const r = rs.canAfford({ gold: 9999 });
      expect(r.canAfford).toBe(false);
      expect(r.shortages.gold!.required).toBe(9999);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 资源上限 (enforceCaps)
  // ═══════════════════════════════════════════
  describe('资源上限', () => {
    it('addResource 超过上限时截断', () => {
      const actual = rs.addResource('grain', 99999);
      expect(rs.getAmount('grain')).toBe(INITIAL_CAPS.grain);
      expect(actual).toBeLessThan(99999);
    });
    it('setResource 超过上限时截断', () => {
      rs.setResource('grain', 99999);
      expect(rs.getAmount('grain')).toBe(INITIAL_CAPS.grain);
    });
    it('updateCaps 根据粮仓等级查表', () => {
      rs.updateCaps(5, 1);
      expect(rs.getCaps().grain).toBe(GRANARY_CAPACITY_TABLE[5]);
    });
    it('updateCaps 根据兵营等级查表', () => {
      rs.updateCaps(1, 10);
      expect(rs.getCaps().troops).toBe(BARRACKS_CAPACITY_TABLE[10]);
    });
    it('updateCaps 降低上限时截断溢出资源', () => {
      rs.setProductionRate('grain', 9999); rs.tick(1000);
      rs.updateCaps(1, 1);
      expect(rs.getAmount('grain')).toBeLessThanOrEqual(INITIAL_CAPS.grain);
    });
    it('setCap 设置自定义上限并截断', () => {
      rs.setCap('grain', 100);
      expect(rs.getCaps().grain).toBe(100);
      expect(rs.getAmount('grain')).toBeLessThanOrEqual(100);
    });
    it('updateCaps 超过最大等级时线性外推', () => {
      rs.updateCaps(35, 1);
      const expected = GRANARY_CAPACITY_TABLE[30] +
        Math.floor(((GRANARY_CAPACITY_TABLE[30] - GRANARY_CAPACITY_TABLE[25]) / 5) * 5);
      expect(rs.getCaps().grain).toBe(expected);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 容量警告 (getCapWarnings)
  // ═══════════════════════════════════════════
  describe('容量警告', () => {
    it('safe 等级：0% 和 70%', () => {
      rs.setResource('grain', 0);
      expect(rs.getCapWarning('grain')!.level).toBe('safe');
      rs.setResource('grain', INITIAL_CAPS.grain * 0.7);
      expect(rs.getCapWarning('grain')!.level).toBe('safe');
    });
    it('notice 等级：>= 90% 且 < 95%', () => {
      rs.setResource('grain', INITIAL_CAPS.grain * 0.92);
      expect(rs.getCapWarning('grain')!.level).toBe('notice');
    });
    it('warning 等级：>= 95% 且 < 100%', () => {
      rs.setResource('grain', INITIAL_CAPS.grain * 0.96);
      expect(rs.getCapWarning('grain')!.level).toBe('warning');
    });
    it('full 等级：>= 100%（urgent 阈值=1.0 被 full 优先匹配）', () => {
      rs.setResource('grain', INITIAL_CAPS.grain);
      const w = rs.getCapWarning('grain')!;
      expect(w.level).toBe('full');
      expect(w.percentage).toBeGreaterThanOrEqual(1);
    });
    it('getCapWarnings 返回有上限资源的警告', () => {
      const types = rs.getCapWarnings().map((w) => w.resourceType);
      expect(types).toContain('grain');
      expect(types).toContain('troops');
      expect(types).toContain('gold');
      expect(types).not.toContain('mandate');
    });
    it('getCapWarning 无上限资源返回 null', () => {
      expect(rs.getCapWarning('mandate')).toBeNull();
    });
    it('警告信息包含正确的百分比和数值', () => {
      rs.setResource('grain', INITIAL_CAPS.grain * 0.5);
      const w = rs.getCapWarning('grain')!;
      expect(w.percentage).toBeCloseTo(0.5);
      expect(w.cap).toBe(INITIAL_CAPS.grain);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 离线收益 (calculateOfflineEarnings)
  // ═══════════════════════════════════════════
  describe('离线收益', () => {
    beforeEach(() => { rs.setProductionRate('grain', 10); rs.setProductionRate('gold', 5); });
    it('第一档 0~2h 效率100%', () => {
      const r = rs.calculateOfflineEarnings(3600);
      expect(r.earned.grain).toBeCloseTo(10 * 3600);
      expect(r.isCapped).toBe(false);
    });
    it('第二档 2~8h 效率80%', () => {
      const r = rs.calculateOfflineEarnings(7200 + 3600);
      expect(r.earned.grain).toBeCloseTo(10 * 7200 + 10 * 3600 * 0.8);
    });
    it('第三档 8~24h 效率60%', () => {
      const r = rs.calculateOfflineEarnings(28800 + 3600);
      const exp = 10 * 7200 + 10 * 21600 * 0.8 + 10 * 3600 * 0.6;
      expect(r.earned.grain).toBeCloseTo(exp);
    });
    it('第四档 24~48h 效率40%', () => {
      const r = rs.calculateOfflineEarnings(86400 + 3600);
      expect(r.tierBreakdown!.length).toBeGreaterThanOrEqual(4);
    });
    it('第五档 48~72h 效率20%', () => {
      const r = rs.calculateOfflineEarnings(172800 + 3600);
      const t = r.tierBreakdown!.find((b) => b.tier.efficiency === 0.20);
      expect(t).toBeDefined();
      expect(t!.seconds).toBe(3600);
    });
    it('超过72h上限截断', () => {
      expect(rs.calculateOfflineEarnings(OFFLINE_MAX_SECONDS + 10000).isCapped).toBe(true);
    });
    it('天命资源不产出', () => {
      expect(rs.calculateOfflineEarnings(3600).earned.mandate).toBe(0);
    });
    it('bonus 加成应用于离线收益', () => {
      const a = rs.calculateOfflineEarnings(3600);
      const b = rs.calculateOfflineEarnings(3600, { castle: 0.5 });
      expect(b.earned.grain).toBeCloseTo(a.earned.grain * 1.5);
    });
    it('applyOfflineEarnings 实际添加资源并受上限约束', () => {
      const before = rs.getAmount('grain');
      rs.applyOfflineEarnings(3600);
      expect(rs.getAmount('grain')).toBeGreaterThan(before);
    });
    it('applyOfflineEarnings 受上限约束', () => {
      rs.applyOfflineEarnings(OFFLINE_MAX_SECONDS);
      expect(rs.getAmount('grain')).toBeLessThanOrEqual(INITIAL_CAPS.grain);
    });
    it('0秒离线收益为空', () => {
      const r = rs.calculateOfflineEarnings(0);
      expect(r.earned.grain).toBe(0);
      expect(r.isCapped).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 序列化 / 反序列化
  // ═══════════════════════════════════════════
  describe('序列化 / 反序列化', () => {
    it('serialize → deserialize 往返一致', () => {
      rs.setProductionRate('grain', 5);
      rs.setResource('gold', 200);
      const data = rs.serialize();
      const rs2 = new ResourceSystem(); rs2.init(createMockDeps());
      rs2.deserialize(data);
      expect(rs2.getAmount('grain')).toBe(rs.getAmount('grain'));
      expect(rs2.getAmount('gold')).toBe(200);
      expect(rs2.getProductionRates().grain).toBe(5);
    });
    it('deserialize 后上限约束生效', () => {
      rs.deserialize({
        resources: { grain: 99999, gold: 0, troops: 0, mandate: 0 },
        lastSaveTime: Date.now(),
        productionRates: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        caps: { grain: 2000, gold: 2000, troops: 500, mandate: null },
        version: SAVE_VERSION,
      });
      expect(rs.getAmount('grain')).toBeLessThanOrEqual(2000);
    });
    it('deserialize 版本不匹配时仍加载', () => {
      const spy = vi.spyOn(gameLog, 'warn').mockImplementation(() => {});
      rs.deserialize({
        resources: { grain: 100, gold: 50, troops: 25, mandate: 0 },
        lastSaveTime: Date.now(),
        productionRates: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        caps: { grain: 2000, gold: 2000, troops: 500, mandate: null },
        version: 999,
      });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('版本不匹配'));
      expect(rs.getAmount('grain')).toBe(100);
      spy.mockRestore();
    });
    it('serialize 包含 lastSaveTime', () => {
      expect(rs.serialize().lastSaveTime).toBeGreaterThan(0);
    });
    it('粮草保护：序列化后反序列化保留粮草状态', () => {
      rs.setResource('grain', MIN_GRAIN_RESERVE + 50);
      rs.consumeResource('grain', 30);
      const rs2 = new ResourceSystem(); rs2.init(createMockDeps());
      rs2.deserialize(rs.serialize());
      expect(rs2.getAmount('grain')).toBe(MIN_GRAIN_RESERVE + 20);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 静态工具方法
  // ═══════════════════════════════════════════
  describe('静态工具方法', () => {
    it('formatOfflineTime 各档位正确', () => {
      expect(ResourceSystem.formatOfflineTime(0)).toBe('刚刚');
      expect(ResourceSystem.formatOfflineTime(30)).toBe('30秒');
      expect(ResourceSystem.formatOfflineTime(90)).toBe('1分钟');
      expect(ResourceSystem.formatOfflineTime(3661)).toBe('1小时1分钟');
      expect(ResourceSystem.formatOfflineTime(90000)).toBe('1天1小时');
      expect(ResourceSystem.formatOfflineTime(172800)).toBe('2天');
    });
    it('getOfflineEfficiencyPercent 短时间100%，长时间降低', () => {
      expect(ResourceSystem.getOfflineEfficiencyPercent(3600)).toBe(100);
      const pct = ResourceSystem.getOfflineEfficiencyPercent(86400);
      expect(pct).toBeLessThan(100);
      expect(pct).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 重置 & ISubsystem 适配
  // ═══════════════════════════════════════════
  describe('重置', () => {
    it('reset 恢复初始状态', () => {
      rs.setProductionRate('grain', 99);
      rs.setResource('gold', 9999);
      rs.reset();
      expect(rs.getAmount('grain')).toBe(INITIAL_RESOURCES.grain);
      expect(rs.getAmount('gold')).toBe(INITIAL_RESOURCES.gold);
      expect(rs.getProductionRates().grain).toBe(INITIAL_PRODUCTION_RATES.grain);
    });
    it('reset 后上限恢复默认', () => {
      rs.updateCaps(10, 10);
      rs.reset();
      expect(rs.getCaps().grain).toBe(INITIAL_CAPS.grain);
    });
  });

  describe('ISubsystem 适配', () => {
    it('name 为 "resource"', () => { expect(rs.name).toBe('resource'); });
    it('update 适配 tick（秒→毫秒）', () => {
      rs.setProductionRate('grain', 10);
      rs.update(1);
      expect(rs.getAmount('grain')).toBe(INITIAL_RESOURCES.grain + 10);
    });
    it('getState 返回序列化数据', () => {
      const state = rs.getState() as ResourceSaveData;
      expect(state.version).toBe(SAVE_VERSION);
    });
  });

  describe('产出速率管理', () => {
    it('recalculateProduction 累加多建筑产出', () => {
      // 使用 levelTable 查表值：farmland Lv2 → 1.0, market Lv3 → 1.2
      rs.recalculateProduction({ grain: 1.0, gold: 1.2 });
      expect(rs.getProductionRates().grain).toBeCloseTo(1.0);
      expect(rs.getProductionRates().gold).toBeCloseTo(1.2);
    });
    it('recalculateProduction 空对象重置为0', () => {
      rs.setProductionRate('grain', 99);
      rs.recalculateProduction({});
      expect(rs.getProductionRates().grain).toBe(0);
    });
    it('recalculateProduction 忽略未知资源类型', () => {
      rs.recalculateProduction({ unknownResource: 5 });
      expect(rs.getProductionRates().grain).toBe(0);
      expect(rs.getProductionRates().gold).toBe(0);
    });
  });

  describe('边界条件', () => {
    it('addResource amount<=0 返回0且不增加', () => {
      const before = rs.getAmount('grain');
      expect(rs.addResource('grain', 0)).toBe(0);
      expect(rs.addResource('grain', -5)).toBe(0);
      expect(rs.getAmount('grain')).toBe(before);
    });
    it('无上限资源不截断', () => {
      rs.addResource('mandate', 99999);
      expect(rs.getAmount('mandate')).toBe(INITIAL_RESOURCES.mandate + 99999);
    });
    it('consumeResource amount<=0 返回0', () => {
      expect(rs.consumeResource('gold', 0)).toBe(0);
    });
    it('非粮草资源不足时抛出错误', () => {
      expect(() => rs.consumeResource('gold', 99999)).toThrow(/资源不足/);
    });
    it('touchSaveTime 更新时间戳', () => {
      const before = rs.getLastSaveTime();
      rs.touchSaveTime();
      expect(rs.getLastSaveTime()).toBeGreaterThanOrEqual(before);
    });
  });
});
