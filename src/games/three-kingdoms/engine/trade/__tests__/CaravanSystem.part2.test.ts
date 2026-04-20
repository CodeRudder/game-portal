/**
 * CaravanSystem 单元测试 — Part 2
 *
 * 覆盖：
 * 5. 护卫系统
 * 6. 商队管理（新增、升级）
 * 7. 序列化/反序列化
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaravanSystem } from '../CaravanSystem';
import {
  INITIAL_CARAVAN_COUNT,
  BASE_CARAVAN_ATTRIBUTES,
  GUARD_RISK_REDUCTION,
  TRADE_SAVE_VERSION,
} from '../../../core/trade/trade-config';

function createCaravan(): CaravanSystem {
  const cs = new CaravanSystem();
  cs.init({
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() } as any,
    config: { get: vi.fn() } as any,
    registry: { get: vi.fn() } as any,
  });
  return cs;
}

describe('CaravanSystem - 护卫系统', () => {
  let cs: CaravanSystem;
  beforeEach(() => { vi.restoreAllMocks(); cs = createCaravan(); });

  it('assignGuard 成功指派', () => {
    const caravans = cs.getCaravans();
    const result = cs.assignGuard(caravans[0].id, 'hero_001');
    expect(result.success).toBe(true);
    expect(result.riskReduction).toBe(GUARD_RISK_REDUCTION);
  });

  it('assignGuard 不存在的商队失败', () => {
    expect(cs.assignGuard('nonexistent', 'hero_001').success).toBe(false);
  });

  it('assignGuard 互斥检查：同一武将不能同时护卫两个商队', () => {
    const [c1, c2] = cs.getCaravans();
    cs.assignGuard(c1.id, 'hero_001');
    const result = cs.assignGuard(c2.id, 'hero_001');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('其他商队');
  });

  it('checkGuardMutex 可用武将', () => {
    expect(cs.checkGuardMutex('hero_001').available).toBe(true);
  });

  it('checkGuardMutex 已指派武将', () => {
    const [c1] = cs.getCaravans();
    cs.assignGuard(c1.id, 'hero_001');
    const check = cs.checkGuardMutex('hero_001');
    expect(check.available).toBe(false);
    expect(check.conflictCaravanId).toBe(c1.id);
  });

  it('checkGuardMutex 排除自身商队', () => {
    const [c1] = cs.getCaravans();
    cs.assignGuard(c1.id, 'hero_001');
    expect(cs.checkGuardMutex('hero_001', c1.id).available).toBe(true);
  });

  it('removeGuard 成功移除', () => {
    const [c1] = cs.getCaravans();
    cs.assignGuard(c1.id, 'hero_001');
    expect(cs.removeGuard(c1.id)).toBe(true);
    expect(cs.hasGuard(c1.id)).toBe(false);
  });

  it('removeGuard 无护卫返回 false', () => {
    expect(cs.removeGuard(cs.getCaravans()[0].id)).toBe(false);
  });

  it('hasGuard 正确判断', () => {
    const [c1] = cs.getCaravans();
    expect(cs.hasGuard(c1.id)).toBe(false);
    cs.assignGuard(c1.id, 'hero_001');
    expect(cs.hasGuard(c1.id)).toBe(true);
  });

  it('getGuardHeroId 返回护卫ID', () => {
    const [c1] = cs.getCaravans();
    expect(cs.getGuardHeroId(c1.id)).toBeNull();
    cs.assignGuard(c1.id, 'hero_001');
    expect(cs.getGuardHeroId(c1.id)).toBe('hero_001');
  });

  it('assignGuard 替换旧护卫', () => {
    const [c1] = cs.getCaravans();
    cs.assignGuard(c1.id, 'hero_001');
    cs.assignGuard(c1.id, 'hero_002');
    expect(cs.getGuardHeroId(c1.id)).toBe('hero_002');
    // hero_001 应该被释放
    expect(cs.checkGuardMutex('hero_001').available).toBe(true);
  });
});

describe('CaravanSystem - 商队管理', () => {
  let cs: CaravanSystem;
  beforeEach(() => { vi.restoreAllMocks(); cs = createCaravan(); });

  it('addCaravan 成功添加', () => {
    const result = cs.addCaravan();
    expect(result.success).toBe(true);
    expect(result.caravan).toBeDefined();
    expect(cs.getCaravanCount()).toBe(INITIAL_CARAVAN_COUNT + 1);
  });

  it('addCaravan 达到上限失败', () => {
    while (cs.canAddCaravan()) cs.addCaravan();
    const result = cs.addCaravan();
    expect(result.success).toBe(false);
    expect(result.reason).toContain('上限');
  });

  it('upgradeCaravan 成功升级载重', () => {
    const [c1] = cs.getCaravans();
    expect(cs.upgradeCaravan(c1.id, 'capacity', 10)).toBe(true);
    expect(cs.getCaravan(c1.id)!.attributes.capacity).toBe(BASE_CARAVAN_ATTRIBUTES.capacity + 10);
  });

  it('upgradeCaravan 成功升级速度', () => {
    const [c1] = cs.getCaravans();
    expect(cs.upgradeCaravan(c1.id, 'speedMultiplier', 0.5)).toBe(true);
    expect(cs.getCaravan(c1.id)!.attributes.speedMultiplier).toBe(BASE_CARAVAN_ATTRIBUTES.speedMultiplier + 0.5);
  });

  it('upgradeCaravan 成功升级议价', () => {
    const [c1] = cs.getCaravans();
    expect(cs.upgradeCaravan(c1.id, 'bargainingPower', 0.3)).toBe(true);
    expect(cs.getCaravan(c1.id)!.attributes.bargainingPower).toBe(BASE_CARAVAN_ATTRIBUTES.bargainingPower + 0.3);
  });

  it('upgradeCaravan currentLoad 不可升级', () => {
    expect(cs.upgradeCaravan(cs.getCaravans()[0].id, 'currentLoad', 10)).toBe(false);
  });

  it('upgradeCaravan 不存在的商队返回 false', () => {
    expect(cs.upgradeCaravan('nonexistent', 'capacity', 10)).toBe(false);
  });
});

describe('CaravanSystem - 序列化', () => {
  let cs: CaravanSystem;
  beforeEach(() => { vi.restoreAllMocks(); cs = createCaravan(); });

  it('serialize/deserialize 往返一致', () => {
    const [c1] = cs.getCaravans();
    cs.assignGuard(c1.id, 'hero_001');
    const data = cs.serialize();
    expect(data.version).toBe(TRADE_SAVE_VERSION);
    expect(data.caravans.length).toBe(INITIAL_CARAVAN_COUNT);

    const cs2 = createCaravan();
    cs2.deserialize(data);
    expect(cs2.getCaravanCount()).toBe(INITIAL_CARAVAN_COUNT);
    expect(cs2.hasGuard(data.caravans[0].id)).toBe(true);
  });

  it('deserialize 版本不匹配抛异常', () => {
    expect(() => cs.deserialize({ caravans: [], version: 99 } as any)).toThrow();
  });

  it('reset 恢复初始状态', () => {
    const [c1] = cs.getCaravans();
    cs.assignGuard(c1.id, 'hero_001');
    cs.addCaravan();
    cs.reset();
    expect(cs.getCaravanCount()).toBe(INITIAL_CARAVAN_COUNT);
    for (const c of cs.getCaravans()) expect(c.guardHeroId).toBeNull();
  });
});
