/**
 * ResourceSystem.ts 单元测试
 * 目标：100% 分支覆盖，聚焦关键分支
 */

import { describe, it, expect, vi } from 'vitest';
import { ResourceSystem } from '../ResourceSystem';
import {
  INITIAL_RESOURCES, INITIAL_CAPS,
  GRANARY_CAPACITY_TABLE, BARRACKS_CAPACITY_TABLE,
  OFFLINE_MAX_SECONDS, SAVE_VERSION, MIN_GRAIN_RESERVE,
} from '../resource-config';
import type { Bonuses, ResourceSaveData } from '../resource.types';

const S = () => new ResourceSystem();

// ═══════════════════════════════════════════════════════════════
// 1. 初始化 & 读取
// ═══════════════════════════════════════════════════════════════

describe('初始化', () => {
  it('默认值与 INITIAL_RESOURCES / INITIAL_CAPS 一致', () => {
    const s = S();
    expect(s.getResources()).toEqual({ grain: 200, gold: 100, troops: 50, mandate: 0 });
    expect(s.getProductionRates()).toEqual({ grain: 0, gold: 0, troops: 0, mandate: 0 });
    expect(s.getCaps()).toEqual({ grain: 2000, gold: null, troops: 500, mandate: null });
  });

  it('各 getter 返回副本', () => {
    const s = S();
    (s.getResources() as any).grain = 9; expect(s.getAmount('grain')).toBe(200);
    s.getProductionRates().grain = 9; expect(s.getProductionRates().grain).toBe(0);
    (s.getCaps() as any).grain = 9; expect(s.getCaps().grain).toBe(2000);
  });

  it('getAmount 返回初始值', () => {
    const s = S();
    expect(s.getAmount('grain')).toBe(200);
    expect(s.getAmount('gold')).toBe(100);
    expect(s.getAmount('troops')).toBe(50);
    expect(s.getAmount('mandate')).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. addResource
// ═══════════════════════════════════════════════════════════════

describe('addResource', () => {
  it('正常增加、负数/零返回0、无上限无限增、有上限截断、已达上限返回0', () => {
    const s = S();
    expect(s.addResource('grain', 100)).toBe(100);
    expect(s.getAmount('grain')).toBe(300);
    expect(s.addResource('grain', -50)).toBe(0);
    expect(s.addResource('grain', 0)).toBe(0);
    expect(s.addResource('gold', 99999)).toBe(99999);
    expect(s.addResource('mandate', 500)).toBe(500);
    expect(s.addResource('grain', 99999)).toBe(2000 - 300);
    expect(s.getAmount('grain')).toBe(2000);
    expect(s.addResource('grain', 100)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. consumeResource
// ═══════════════════════════════════════════════════════════════

describe('consumeResource', () => {
  it('正常消耗', () => {
    const s = S();
    expect(s.consumeResource('gold', 30)).toBe(30);
    expect(s.getAmount('gold')).toBe(70);
  });

  it('消耗0/负数返回0', () => {
    const s = S();
    expect(s.consumeResource('gold', 0)).toBe(0);
    expect(s.consumeResource('gold', -10)).toBe(0);
  });

  it('资源不足抛出错误', () => {
    expect(() => S().consumeResource('gold', 200)).toThrow('gold 资源不足');
  });

  it('粮草保留 MIN_GRAIN_RESERVE', () => {
    const s = S();
    expect(s.consumeResource('grain', 190)).toBe(190);
    expect(s.getAmount('grain')).toBe(MIN_GRAIN_RESERVE);
    expect(() => S().consumeResource('grain', 191)).toThrow('粮草不足');
  });

  it('粮草低于保留量时消耗失败', () => {
    const s = S(); s.setResource('grain', 5);
    expect(() => s.consumeResource('grain', 1)).toThrow('粮草不足');
  });

  it('消耗兵力/天命', () => {
    const s = S();
    expect(s.consumeResource('troops', 30)).toBe(30);
    s.addResource('mandate', 100);
    expect(s.consumeResource('mandate', 50)).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. setResource
// ═══════════════════════════════════════════════════════════════

describe('setResource', () => {
  it('直接设置、有上限截断、无上限不截断、零/负数', () => {
    const s = S();
    s.setResource('gold', 500); expect(s.getAmount('gold')).toBe(500);
    s.setResource('grain', 99999); expect(s.getAmount('grain')).toBe(2000);
    s.setResource('mandate', 99999); expect(s.getAmount('mandate')).toBe(99999);
    s.setResource('grain', 0); expect(s.getAmount('grain')).toBe(0);
    s.setResource('grain', -10); expect(s.getAmount('grain')).toBe(-10);
    s.setResource('mandate', -10); expect(s.getAmount('mandate')).toBe(-10);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. canAfford & consumeBatch
// ═══════════════════════════════════════════════════════════════

describe('canAfford', () => {
  it('充足=true，不足=false+短缺', () => {
    const s = S();
    expect(s.canAfford({ grain: 100, gold: 50 }).canAfford).toBe(true);
    const r = s.canAfford({ gold: 200 });
    expect(r.canAfford).toBe(false);
    expect(r.shortages.gold).toEqual({ required: 200, current: 100 });
  });

  it('空/零/负数消耗=true', () => {
    const s = S();
    expect(s.canAfford({}).canAfford).toBe(true);
    expect(s.canAfford({ grain: 0, gold: undefined as any }).canAfford).toBe(true);
    expect(s.canAfford({ gold: -100 }).canAfford).toBe(true);
  });

  it('粮草扣除保留量', () => {
    const s = S();
    expect(s.canAfford({ grain: 190 }).canAfford).toBe(true);
    expect(s.canAfford({ grain: 191 }).canAfford).toBe(false);
  });

  it('多资源不足返回所有短缺', () => {
    expect(Object.keys(S().canAfford({ grain: 500, gold: 500, troops: 1000 }).shortages)).toHaveLength(3);
  });
});

describe('consumeBatch', () => {
  it('原子扣除成功', () => {
    const s = S();
    s.consumeBatch({ grain: 100, gold: 50, troops: 30 });
    expect(s.getAmount('grain')).toBe(100);
    expect(s.getAmount('gold')).toBe(50);
    expect(s.getAmount('troops')).toBe(20);
  });

  it('不足时抛出错误且不扣除', () => {
    const s = S();
    expect(() => s.consumeBatch({ grain: 50, gold: 500 })).toThrow('资源不足');
    expect(s.getAmount('grain')).toBe(200);
    expect(s.getAmount('gold')).toBe(100);
  });

  it('空消耗/含零项成功', () => {
    const s = S();
    s.consumeBatch({});
    expect(s.getAmount('grain')).toBe(200);
    s.consumeBatch({ grain: 0, gold: undefined as any, troops: 10 });
    expect(s.getAmount('troops')).toBe(40);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. tick & 产出速率
// ═══════════════════════════════════════════════════════════════

describe('tick', () => {
  it('速率为0不改变资源', () => {
    const s = S(); s.tick(1000);
    expect(s.getAmount('grain')).toBe(200);
  });

  it('基本产出按deltaMs计算', () => {
    const s = S(); s.setProductionRate('grain', 10); s.tick(1000);
    expect(s.getAmount('grain')).toBe(210);
  });

  it('产出受上限约束', () => {
    const s = S(); s.setResource('grain', 1995); s.setProductionRate('grain', 100); s.tick(1000);
    expect(s.getAmount('grain')).toBe(2000);
  });

  it('负速率跳过', () => {
    const s = S(); s.setProductionRate('grain', -5); s.tick(1000);
    expect(s.getAmount('grain')).toBe(200);
  });

  it('加成：undefined/空=1, 单加成, 多加成乘法叠加, 零加成无影响', () => {
    const s1 = S(); s1.setProductionRate('gold', 10); s1.tick(1000, undefined);
    expect(s1.getAmount('gold')).toBe(110);
    const s2 = S(); s2.setProductionRate('gold', 10); s2.tick(1000, {});
    expect(s2.getAmount('gold')).toBe(110);
    const s3 = S(); s3.setProductionRate('gold', 10); s3.tick(1000, { tech: 0.5 });
    expect(s3.getAmount('gold')).toBe(115);
    const s4 = S(); s4.setProductionRate('gold', 10); s4.tick(1000, { tech: 0.5, hero: 0.3 });
    expect(s4.getAmount('gold')).toBeCloseTo(119.5, 5);
    const s5 = S(); s5.setProductionRate('gold', 10); s5.tick(1000, { tech: 0 });
    expect(s5.getAmount('gold')).toBe(110);
  });

  it('多资源同时产出', () => {
    const s = S();
    s.setProductionRate('grain', 5); s.setProductionRate('gold', 10); s.setProductionRate('troops', 2);
    s.tick(1000);
    expect(s.getAmount('grain')).toBe(205);
    expect(s.getAmount('gold')).toBe(110);
    expect(s.getAmount('troops')).toBe(52);
  });
});

describe('recalculateProduction', () => {
  it('空/零/负/未知建筑忽略，多建筑累加，重置之前速率', () => {
    const s = S();
    s.setProductionRate('grain', 999);
    s.recalculateProduction({});
    expect(s.getProductionRates().grain).toBe(0);
    s.recalculateProduction({ farmland: 0 }); expect(s.getProductionRates().grain).toBe(0);
    s.recalculateProduction({ farmland: -1 }); expect(s.getProductionRates().grain).toBe(0);
    s.recalculateProduction({ unknown: 10 }); expect(s.getProductionRates().grain).toBe(0);
    s.recalculateProduction({ farmland: 3, market: 5, barracks: 2 });
    const r = s.getProductionRates();
    expect(r.grain).toBe(2.5); expect(r.gold).toBe(2.8); expect(r.troops).toBe(1.1); expect(r.mandate).toBe(0);
    s.recalculateProduction({ market: 1 });
    expect(s.getProductionRates().grain).toBe(0);
    expect(s.getProductionRates().gold).toBeCloseTo(1.2, 10);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. 上限管理
// ═══════════════════════════════════════════════════════════════

describe('updateCaps', () => {
  it('正确更新粮仓/兵营，gold/mandate保持null', () => {
    const s = S(); s.updateCaps(5, 10);
    expect(s.getCaps().grain).toBe(GRANARY_CAPACITY_TABLE[5]);
    expect(s.getCaps().troops).toBe(BARRACKS_CAPACITY_TABLE[10]);
    expect(s.getCaps().gold).toBeNull();
    expect(s.getCaps().mandate).toBeNull();
  });

  it('降低上限截断溢出资源', () => {
    const s = S(); s.setResource('grain', 5000); s.updateCaps(1, 1);
    expect(s.getAmount('grain')).toBe(2000);
  });

  it('等级在节点间使用较低值', () => {
    const s = S(); s.updateCaps(7, 7);
    expect(s.getCaps().grain).toBe(GRANARY_CAPACITY_TABLE[5]);
  });

  it('超过最大等级线性外推', () => {
    const s = S(); s.updateCaps(35, 35);
    expect(s.getCaps().grain).toBe(300000); // 200000 + 5*20000
    expect(s.getCaps().troops).toBe(75000); // 50000 + 5*5000
  });

  it('等级0/负数返回最低等级容量', () => {
    const s1 = S(); s1.updateCaps(0, 0);
    expect(s1.getCaps().grain).toBe(GRANARY_CAPACITY_TABLE[1]);
    const s2 = S(); s2.updateCaps(-5, -5);
    expect(s2.getCaps().grain).toBe(GRANARY_CAPACITY_TABLE[1]);
  });

  it('等级30不外推', () => {
    const s = S(); s.updateCaps(30, 30);
    expect(s.getCaps().grain).toBe(GRANARY_CAPACITY_TABLE[30]);
  });
});

describe('setCap', () => {
  it('设置上限、设null、降低截断、设置后add受限', () => {
    const s = S();
    s.setCap('grain', 5000); expect(s.getCaps().grain).toBe(5000);
    s.setCap('grain', null); expect(s.getCaps().grain).toBeNull();
    s.setCap('grain', 2000); s.setResource('grain', 1500); s.setCap('grain', 1000);
    expect(s.getAmount('grain')).toBe(1000);
    s.setCap('gold', 10000); expect(s.getCaps().gold).toBe(10000);
    const s2 = S(); s2.setCap('grain', 500); s2.addResource('grain', 1000);
    expect(s2.getAmount('grain')).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 容量警告
// ═══════════════════════════════════════════════════════════════

describe('容量警告', () => {
  it('各百分比对应正确等级：safe/notice/warning/full', () => {
    const s = S();
    const check = (val: number, level: string) => {
      s.setResource('grain', val);
      const w = s.getCapWarnings().find(w => w.resourceType === 'grain')!;
      expect(w.level).toBe(level);
    };
    check(1400, 'safe');   // 70%
    check(1800, 'notice'); // 90%
    check(1900, 'warning'); // 95%
    check(2000, 'full');   // 100%
  });

  it('无上限资源不在列表中，getCapWarning返回null', () => {
    const s = S();
    expect(s.getCapWarnings().find(w => w.resourceType === 'gold')).toBeUndefined();
    expect(s.getCapWarning('gold')).toBeNull();
    expect(s.getCapWarning('mandate')).toBeNull();
  });

  it('getCapWarning返回正确信息', () => {
    const w = S().getCapWarning('grain')!;
    expect(w.resourceType).toBe('grain');
    expect(w.cap).toBe(2000);
    expect(w.percentage).toBeCloseTo(0.1, 5);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. 离线收益
// ═══════════════════════════════════════════════════════════════

describe('calculateOfflineEarnings', () => {
  it('速率为0返回全0，0秒不封顶', () => {
    const s = S();
    expect(s.calculateOfflineEarnings(3600).earned).toEqual({ grain: 0, gold: 0, troops: 0, mandate: 0 });
    s.setProductionRate('grain', 10);
    const r = s.calculateOfflineEarnings(0);
    expect(r.earned.grain).toBe(0);
    expect(r.isCapped).toBe(false);
  });

  it('第一时段100%，跨时段分段计算', () => {
    const s = S(); s.setProductionRate('grain', 10);
    expect(s.calculateOfflineEarnings(3600).earned.grain).toBe(36000);
    const r = s.calculateOfflineEarnings(10000);
    expect(r.earned.grain).toBeCloseTo(94400, 5); // 72000 + 22400
    expect(r.tierBreakdown).toHaveLength(2);
  });

  it('超过72h封顶', () => {
    const s = S(); s.setProductionRate('grain', 10);
    const r = s.calculateOfflineEarnings(OFFLINE_MAX_SECONDS + 10000);
    expect(r.isCapped).toBe(true);
  });

  it('加成影响收益', () => {
    const s = S(); s.setProductionRate('grain', 10);
    expect(s.calculateOfflineEarnings(3600, { tech: 1.0 }).earned.grain).toBe(72000);
  });

  it('完整72h五时段', () => {
    const s = S(); s.setProductionRate('grain', 1);
    const r = s.calculateOfflineEarnings(OFFLINE_MAX_SECONDS);
    expect(r.earned.grain).toBeCloseTo(115200, 5);
    expect(r.tierBreakdown).toHaveLength(5);
    expect(r.isCapped).toBe(false);
  });

  it('刚好2h一时段，刚超2h两时段', () => {
    const s = S(); s.setProductionRate('grain', 10);
    expect(s.calculateOfflineEarnings(7200).tierBreakdown).toHaveLength(1);
    const r = s.calculateOfflineEarnings(7201);
    expect(r.tierBreakdown).toHaveLength(2);
    expect(r.earned.grain).toBeCloseTo(72008, 5);
  });
});

describe('applyOfflineEarnings', () => {
  it('添加收益、受上限约束、无产出不变', () => {
    const s1 = S(); s1.setProductionRate('gold', 10); s1.applyOfflineEarnings(3600);
    expect(s1.getAmount('gold')).toBe(100 + 36000);
    const s2 = S(); s2.setProductionRate('grain', 1000); s2.applyOfflineEarnings(3600);
    expect(s2.getAmount('grain')).toBe(2000);
    const s3 = S(); s3.applyOfflineEarnings(3600);
    expect(s3.getAmount('grain')).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. 序列化
// ═══════════════════════════════════════════════════════════════

describe('序列化', () => {
  const makeSave = (overrides: Partial<ResourceSaveData> = {}): ResourceSaveData => ({
    resources: { grain: 500, gold: 300, troops: 100, mandate: 50 },
    lastSaveTime: 1000000,
    productionRates: { grain: 5, gold: 3, troops: 1, mandate: 0 },
    caps: { grain: 5000, gold: null, troops: 1000, mandate: null },
    version: SAVE_VERSION,
    ...overrides,
  });

  it('serialize 包含所有字段且为副本', () => {
    const d = S().serialize();
    expect(d).toHaveProperty('resources');
    expect(d.version).toBe(SAVE_VERSION);
    d.resources.grain = 9;
    expect(S().getAmount('grain')).toBe(200);
  });

  it('deserialize 恢复状态', () => {
    const s = S(); s.deserialize(makeSave());
    expect(s.getAmount('grain')).toBe(500);
    expect(s.getProductionRates().grain).toBe(5);
    expect(s.getCaps().grain).toBe(5000);
    expect(s.getLastSaveTime()).toBe(1000000);
  });

  it('版本不匹配打印警告但仍加载', () => {
    const s = S();
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    s.deserialize(makeSave({ version: 999 }));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('存档版本不匹配'));
    expect(s.getAmount('grain')).toBe(500);
    spy.mockRestore();
  });

  it('恢复后执行上限约束', () => {
    const s = S();
    s.deserialize(makeSave({ resources: { grain: 99999, gold: 300, troops: 100, mandate: 50 } }));
    expect(s.getAmount('grain')).toBe(5000);
  });

  it('serialize → deserialize 往返一致', () => {
    const s = S();
    s.setResource('gold', 555); s.setProductionRate('grain', 7.5);
    s.setCap('grain', 10000); s.setResource('grain', 8000);
    const s2 = S(); s2.deserialize(s.serialize());
    expect(s2.getResources()).toEqual(s.getResources());
    expect(s2.getProductionRates()).toEqual(s.getProductionRates());
    expect(s2.getCaps()).toEqual(s.getCaps());
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. 时间戳 & 重置
// ═══════════════════════════════════════════════════════════════

describe('时间戳 & 重置', () => {
  it('touchSaveTime 更新时间戳', () => {
    const s = S(); const b = Date.now(); s.touchSaveTime();
    expect(s.getLastSaveTime()).toBeGreaterThanOrEqual(b);
  });

  it('reset 恢复初始状态', () => {
    const s = S();
    s.setResource('gold', 99999); s.setProductionRate('grain', 100); s.setCap('grain', 99999);
    s.reset();
    expect(s.getResources()).toEqual({ grain: 200, gold: 100, troops: 50, mandate: 0 });
    expect(s.getProductionRates().grain).toBe(0);
    expect(s.getCaps().grain).toBe(INITIAL_CAPS.grain);
  });
});

// ═══════════════════════════════════════════════════════════════
// 12. 边界条件
// ═══════════════════════════════════════════════════════════════

describe('边界条件', () => {
  it('超大deltaMs正常', () => {
    const s = S(); s.setProductionRate('gold', 1); s.tick(86400000);
    expect(s.getAmount('gold')).toBe(100 + 86400);
  });

  it('负deltaMs不减少资源', () => {
    const s = S(); s.setProductionRate('gold', 10); s.tick(-1000);
    expect(s.getAmount('gold')).toBe(100);
  });

  it('超大资源数量', () => {
    const s = S(); s.setResource('mandate', Number.MAX_SAFE_INTEGER - 100);
    s.addResource('mandate', 50);
    expect(s.getAmount('mandate')).toBe(Number.MAX_SAFE_INTEGER - 50);
  });

  it('consumeBatch错误含短缺详情', () => {
    try { S().consumeBatch({ gold: 200, troops: 600 }); expect.fail('nope'); }
    catch (e) { expect((e as Error).message).toContain('资源不足'); }
  });

  it('多次tick累加', () => {
    const s = S(); s.setProductionRate('grain', 10);
    for (let i = 0; i < 10; i++) s.tick(100);
    expect(s.getAmount('grain')).toBeCloseTo(210, 5);
  });
});
