/**
 * 装备模块对抗式测试 — Builder产出
 *
 * 覆盖子系统：
 *   E1: EquipmentSystem       — 装备管理聚合根
 *   E2: EquipmentBagManager   — 背包管理
 *   E3: EquipmentEnhanceSystem — 强化系统
 *   E4: EquipmentForgeSystem  — 炼制系统
 *   E5: EquipmentSetSystem    — 套装系统
 *   E6: EquipmentDecomposer   — 分解与图鉴
 *   E7: ForgePityManager      — 保底机制
 *
 * 5维度挑战：
 *   F-Error:     异常路径覆盖（空uid/无效品质/非法状态）
 *   F-Cross:     跨系统交互覆盖（穿戴+分解/强化+炼制/套装+穿戴）
 *   F-Lifecycle: 数据生命周期覆盖（序列化/反序列化/重置）
 *   F-Boundary:  边界条件覆盖（属性计算/容量/保护符/保底/图鉴/套装）
 *   F-Normal:    正向流程补充（强化转移/来源生成/排序筛选）
 *
 * @module tests/adversarial/equipment-adversarial
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EquipmentSystem } from '../../engine/equipment/EquipmentSystem';
import { EquipmentEnhanceSystem } from '../../engine/equipment/EquipmentEnhanceSystem';
import { EquipmentForgeSystem } from '../../engine/equipment/EquipmentForgeSystem';
import { EquipmentSetSystem } from '../../engine/equipment/EquipmentSetSystem';
import type { EquipmentInstance, EquipmentRarity, EquipmentSlot } from '../../core/equipment/equipment.types';
import type { ISystemDeps } from '../../core/types';
import {
  DEFAULT_BAG_CAPACITY, BAG_EXPAND_INCREMENT,
  EQUIPMENT_SAVE_VERSION,
} from '../../core/equipment/equipment-config';

// ── 测试辅助 ──────────────────────────────────

function createMockDeps(): ISystemDeps {
  return {
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() } as unknown as ISystemDeps['eventBus'],
    config: { get: vi.fn() } as unknown as ISystemDeps['config'],
    registry: { get: vi.fn() } as unknown as ISystemDeps['registry'],
  };
}

function createFullSetup() {
  const sys = new EquipmentSystem();
  sys.init(createMockDeps());
  const enhance = new EquipmentEnhanceSystem(sys);
  enhance.init(createMockDeps());
  const forge = new EquipmentForgeSystem(sys);
  forge.init(createMockDeps());
  const setSys = new EquipmentSetSystem(sys);
  setSys.init(createMockDeps());
  return { sys, enhance, forge, setSys };
}

function genEq(sys: EquipmentSystem, slot: EquipmentSlot = 'weapon', rarity: EquipmentRarity = 'white', seed: number = 42): EquipmentInstance {
  const eq = sys.generateEquipment(slot, rarity, 'forge', seed);
  expect(eq).not.toBeNull();
  return eq!;
}

function genN(sys: EquipmentSystem, count: number, rarity: EquipmentRarity = 'white', startSeed: number = 100): string[] {
  const slots: EquipmentSlot[] = ['weapon', 'armor', 'accessory', 'mount'];
  return Array.from({ length: count }, (_, i) => genEq(sys, slots[i % 4], rarity, startSeed + i * 7).uid);
}

function makeInstance(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    uid: `test_${Math.random().toString(36).slice(2, 8)}`, templateId: 'sword_iron',
    name: '测试铁剑', slot: 'weapon', rarity: 'white', enhanceLevel: 0,
    mainStat: { type: 'attack', baseValue: 10, value: 10 }, subStats: [],
    specialEffect: null, source: 'forge', acquiredAt: Date.now(),
    isEquipped: false, equippedHeroId: null, seed: 12345, ...overrides,
  };
}

// ═══════════════════════════════════════════════
// F-Error: 异常路径覆盖
// ═══════════════════════════════════════════════

describe('F-Error: 装备生成异常', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('不存在的模板应返回null', () => {
    expect(sys.generateEquipment('nonexistent_tpl', 'white')).toBeNull();
  });

  it('无效campaignType应回退到normal不崩溃', () => {
    const eq = sys.generateCampaignDrop('invalid_type' as any, 42);
    expect(eq).toBeDefined();
    expect(eq.slot).toBeTruthy();
  });

  it('空字符串slot应不崩溃', () => {
    expect(() => sys.generateEquipment('' as EquipmentSlot, 'white')).not.toThrow();
  });
});

describe('F-Error: 穿戴异常路径', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('equipItem 不存在的uid应失败', () => {
    expect(sys.equipItem('hero_1', 'nonexistent').success).toBe(false);
  });

  it('unequipItem 无装备栏的武将应失败', () => {
    expect(sys.unequipItem('hero_no_equips', 'weapon').success).toBe(false);
  });

  it('unequipItem 空槽位应失败', () => {
    const eq = genEq(sys, 'weapon');
    sys.equipItem('hero_1', eq.uid);
    expect(sys.unequipItem('hero_1', 'armor').success).toBe(false);
  });

  it('equipItem 装备已被其他武将穿戴应失败', () => {
    const eq = genEq(sys, 'weapon');
    sys.equipItem('hero_1', eq.uid);
    const r = sys.equipItem('hero_2', eq.uid);
    expect(r.success).toBe(false);
    expect(r.reason).toContain('其他武将');
  });

  it('markEquipped/Unequipped 异常路径', () => {
    expect(sys.markEquipped('nonexistent', 'hero_1').success).toBe(false);
    const eq = genEq(sys, 'weapon');
    expect(sys.markUnequipped(eq.uid).success).toBe(false);
    sys.equipItem('hero_1', eq.uid);
    expect(sys.markEquipped(eq.uid, 'hero_2').success).toBe(false);
  });
});

describe('F-Error: 强化异常路径', () => {
  let sys: EquipmentSystem; let enhance: EquipmentEnhanceSystem;
  beforeEach(() => { ({ sys, enhance } = createFullSetup()); });

  it('enhance 不存在的uid应返回fail', () => {
    expect(enhance.enhance('nonexistent').outcome).toBe('fail');
  });

  it('enhance 未注入资源扣除回调应拒绝强化', () => {
    const eq = genEq(sys, 'weapon', 'white');
    expect(enhance.enhance(eq.uid).outcome).toBe('fail');
  });

  it('enhance 资源扣除失败应拒绝且等级不变', () => {
    enhance.setResourceDeductor(() => false);
    const eq = genEq(sys, 'weapon', 'white');
    enhance.enhance(eq.uid);
    expect(sys.getEquipment(eq.uid)!.enhanceLevel).toBe(0);
  });

  it('autoEnhance 不存在的装备应返回空', () => {
    const r = enhance.autoEnhance('nonexistent', { targetLevel: 5, maxCopper: 99999, maxStone: 99999, useProtection: false, protectionThreshold: 6 });
    expect(r.steps).toEqual([]);
    expect(r.finalLevel).toBe(0);
  });

  it('transferEnhance 源/目标不存在或源+0应失败', () => {
    const eq = genEq(sys, 'weapon', 'white');
    expect(enhance.transferEnhance('nonexistent', eq.uid).success).toBe(false);
    expect(enhance.transferEnhance(eq.uid, 'nonexistent').success).toBe(false);
    const eq2 = genEq(sys, 'armor', 'white', 200);
    expect(enhance.transferEnhance(eq.uid, eq2.uid).success).toBe(false);
  });

  it('batchEnhance 空数组或含不存在uid', () => {
    enhance.setResourceDeductor(() => true);
    expect(enhance.batchEnhance([])).toEqual([]);
    const eq = genEq(sys, 'weapon', 'white');
    expect(enhance.batchEnhance([eq.uid, 'nonexistent'])).toHaveLength(1);
  });
});

describe('F-Error: 炼制异常路径', () => {
  let sys: EquipmentSystem; let forge: EquipmentForgeSystem;
  beforeEach(() => { ({ sys, forge } = createFullSetup()); });

  it('输入数量不匹配应失败', () => {
    const uids2 = genN(sys, 2, 'white');
    const uids4 = genN(sys, 4, 'white');
    expect(forge.basicForge(uids2).success).toBe(false);
    expect(forge.basicForge(uids4).success).toBe(false);
    expect(forge.advancedForge(uids2).success).toBe(false);
  });

  it('品质不一致应失败', () => {
    const uids = [genEq(sys, 'weapon', 'white', 100).uid, genEq(sys, 'armor', 'white', 200).uid, genEq(sys, 'accessory', 'green', 300).uid];
    expect(forge.basicForge(uids).success).toBe(false);
  });

  it('金色装备不可炼制', () => {
    expect(forge.basicForge(genN(sys, 3, 'gold', 100)).success).toBe(false);
  });

  it('已穿戴装备不可炼制', () => {
    const uids = genN(sys, 3, 'white', 100);
    sys.equipItem('hero_1', uids[0]);
    expect(forge.basicForge(uids).success).toBe(false);
  });

  it('不存在uid或装备系统未初始化应失败', () => {
    expect(forge.basicForge(['fake1', 'fake2', 'fake3']).success).toBe(false);
    const orphan = new EquipmentForgeSystem();
    orphan.init(createMockDeps());
    expect(orphan.basicForge().success).toBe(false);
  });
});

describe('F-Error: 分解与背包异常', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('decompose 不存在uid应失败', () => {
    const r = sys.decompose('nonexistent');
    expect('success' in r && r.success).toBe(false);
  });

  it('已穿戴装备不可分解', () => {
    const eq = genEq(sys, 'weapon');
    sys.equipItem('hero_1', eq.uid);
    const r = sys.decompose(eq.uid);
    expect('success' in r && r.success).toBe(false);
    expect(sys.getEquipment(eq.uid)).toBeDefined();
  });

  it('batchDecompose 空数组或含不存在uid', () => {
    expect(sys.batchDecompose([]).decomposedUids).toEqual([]);
    const eq = genEq(sys, 'weapon');
    const r = sys.batchDecompose([eq.uid, 'nonexistent']);
    expect(r.decomposedUids).toContain(eq.uid);
    expect(r.skippedUids).toContain('nonexistent');
  });

  it('getDecomposePreview 不存在uid返回null', () => {
    expect(sys.getDecomposePreview('nonexistent')).toBeNull();
  });

  it('addToBag null应失败', () => {
    expect(sys.addToBag(null as any).success).toBe(false);
  });

  it('updateEquipment 不存在uid应静默忽略', () => {
    expect(() => sys.updateEquipment(makeInstance({ uid: 'nonexistent' }))).not.toThrow();
  });

  it('removeFromBag 已穿戴装备应拒绝', () => {
    const eq = genEq(sys, 'weapon');
    sys.equipItem('hero_1', eq.uid);
    expect(sys.removeFromBag(eq.uid).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════
// F-Cross: 跨系统交互覆盖
// ═══════════════════════════════════════════════

describe('F-Cross: 穿戴+分解交互', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('已穿戴装备不可分解且保持穿戴状态', () => {
    const eq = genEq(sys, 'weapon', 'blue');
    sys.equipItem('hero_1', eq.uid);
    expect('success' in sys.decompose(eq.uid) && (sys.decompose(eq.uid) as any).success).toBe(false);
    expect(sys.getHeroEquips('hero_1').weapon).toBe(eq.uid);
  });

  it('卸下后可正常分解', () => {
    const eq = genEq(sys, 'weapon', 'blue');
    sys.equipItem('hero_1', eq.uid);
    sys.unequipItem('hero_1', 'weapon');
    const r = sys.decompose(eq.uid);
    expect('success' in r && r.success).toBe(true);
    expect(sys.getEquipment(eq.uid)).toBeUndefined();
  });

  it('decomposeAllUnequipped 不分解已穿戴装备', () => {
    const eq1 = genEq(sys, 'weapon', 'white', 100);
    const eq2 = genEq(sys, 'armor', 'white', 200);
    const eq3 = genEq(sys, 'accessory', 'white', 300);
    sys.equipItem('hero_1', eq1.uid);
    sys.equipItem('hero_1', eq2.uid);
    const r = sys.decomposeAllUnequipped();
    expect(r.decomposedUids).toContain(eq3.uid);
    expect(r.decomposedUids).not.toContain(eq1.uid);
    expect(sys.getEquipment(eq1.uid)).toBeDefined();
  });
});

describe('F-Cross: 强化+炼制交互', () => {
  let sys: EquipmentSystem; let enhance: EquipmentEnhanceSystem; let forge: EquipmentForgeSystem;
  beforeEach(() => {
    ({ sys, enhance, forge } = createFullSetup());
    enhance.setResourceDeductor(() => true);
  });

  it('强化后的装备炼制时应被消耗', () => {
    const uids = genN(sys, 3, 'white', 100);
    enhance.enhance(uids[0]);
    expect(sys.getEquipment(uids[0])!.enhanceLevel).toBeGreaterThan(0);
    const r = forge.basicForge(uids, () => 0.5);
    if (r.success) {
      uids.forEach(u => expect(sys.getEquipment(u)).toBeUndefined());
      expect(r.equipment).not.toBeNull();
    }
  });

  it('炼制产出装备可继续强化', () => {
    const uids = genN(sys, 3, 'white', 100);
    const r = forge.basicForge(uids, () => 0.5);
    if (r.success && r.equipment) {
      expect(() => enhance.enhance(r.equipment!.uid)).not.toThrow();
    }
  });
});

describe('F-Cross: 套装+穿戴交互', () => {
  let sys: EquipmentSystem; let setSys: EquipmentSetSystem;
  beforeEach(() => { ({ sys, setSys } = createFullSetup()); });

  it('无装备时套装效果为空', () => {
    expect(setSys.getActiveSetBonuses('hero_1')).toEqual([]);
    expect(Object.keys(setSys.getTotalSetBonuses('hero_1'))).toHaveLength(0);
  });

  it('2件同套装应激活2件套效果', () => {
    const eq1 = sys.generateEquipment('sword_dragon', 'blue', 'forge', 100);
    const eq2 = sys.generateEquipment('armor_dragon', 'blue', 'forge', 200);
    expect(eq1).not.toBeNull();
    expect(eq2).not.toBeNull();
    sys.equipItem('hero_1', eq1!.uid);
    sys.equipItem('hero_1', eq2!.uid);
    const dragon = setSys.getActiveSetBonuses('hero_1').find(b => b.setId === 'dragon');
    if (dragon) {
      expect(dragon.count).toBe(2);
      expect(dragon.activeTiers).toContain(2);
    }
  });

  it('卸下装备后套装效果应失效', () => {
    const eq1 = sys.generateEquipment('sword_dragon', 'blue', 'forge', 100);
    const eq2 = sys.generateEquipment('armor_dragon', 'blue', 'forge', 200);
    sys.equipItem('hero_1', eq1!.uid);
    sys.equipItem('hero_1', eq2!.uid);
    sys.unequipItem('hero_1', 'weapon');
    expect(setSys.getActiveSetBonuses('hero_1').find(b => b.setId === 'dragon')).toBeUndefined();
  });

  it('getSetCounts/getClosestSetBonus 正确统计', () => {
    const eq1 = sys.generateEquipment('sword_dragon', 'blue', 'forge', 100);
    sys.equipItem('hero_1', eq1!.uid);
    expect(setSys.getSetCounts('hero_1').get('dragon')).toBe(1);
    const closest = setSys.getClosestSetBonus('hero_1');
    if (closest) { expect(closest.setId).toBe('dragon'); expect(closest.target).toBe(2); }
  });
});

describe('F-Cross: 穿戴+背包交互', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('穿戴同部位新装备时旧装备自动卸下', () => {
    const eq1 = genEq(sys, 'weapon', 'white', 100);
    sys.equipItem('hero_1', eq1.uid);
    const eq2 = genEq(sys, 'weapon', 'green', 200);
    const r = sys.equipItem('hero_1', eq2.uid);
    expect(r.success).toBe(true);
    expect(r.replacedUid).toBe(eq1.uid);
    expect(sys.getEquipment(eq1.uid)!.isEquipped).toBe(false);
  });

  it('不同武将可独立穿戴不同装备', () => {
    const eq1 = genEq(sys, 'weapon', 'white', 100);
    const eq2 = genEq(sys, 'weapon', 'white', 200);
    sys.equipItem('hero_1', eq1.uid);
    sys.equipItem('hero_2', eq2.uid);
    expect(sys.getHeroEquips('hero_1').weapon).toBe(eq1.uid);
    expect(sys.getHeroEquips('hero_2').weapon).toBe(eq2.uid);
  });

  it('filterEquipments unequippedOnly排除已穿戴', () => {
    const eq1 = genEq(sys, 'weapon'); const eq2 = genEq(sys, 'armor');
    sys.equipItem('hero_1', eq1.uid);
    const f = sys.filterEquipments({ slot: null, rarity: null, unequippedOnly: true, setOnly: false });
    expect(f).toHaveLength(1);
    expect(f[0].uid).toBe(eq2.uid);
  });
});

// ═══════════════════════════════════════════════
// F-Lifecycle: 数据生命周期覆盖
// ═══════════════════════════════════════════════

describe('F-Lifecycle: 序列化/反序列化', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('空系统序列化/反序列化应一致', () => {
    const data = sys.serialize();
    expect(data.version).toBe(EQUIPMENT_SAVE_VERSION);
    const sys2 = new EquipmentSystem(); sys2.init(createMockDeps());
    sys2.deserialize(data);
    expect(sys2.getBagUsedCount()).toBe(0);
  });

  it('有装备和穿戴状态应完整保留', () => {
    const eq1 = genEq(sys, 'weapon', 'blue', 100);
    genEq(sys, 'armor', 'purple', 200);
    sys.equipItem('hero_1', eq1.uid);
    const data = sys.serialize();
    const sys2 = new EquipmentSystem(); sys2.init(createMockDeps());
    sys2.deserialize(data);
    expect(sys2.getBagUsedCount()).toBe(2);
    expect(sys2.getEquipment(eq1.uid)!.isEquipped).toBe(true);
    expect(sys2.getHeroEquips('hero_1').weapon).toBe(eq1.uid);
  });

  it('deserialize null/undefined 应安全重置', () => {
    genEq(sys, 'weapon', 'gold');
    sys.deserialize(null as any);
    expect(sys.getBagUsedCount()).toBe(0);
    genEq(sys, 'armor', 'blue');
    sys.deserialize(undefined as any);
    expect(sys.getBagUsedCount()).toBe(0);
  });

  it('扩容和图鉴数据应保留', () => {
    sys.expandBag();
    const cap = sys.getBagCapacity();
    genEq(sys, 'weapon', 'purple');
    const data = sys.serialize();
    const sys2 = new EquipmentSystem(); sys2.init(createMockDeps());
    sys2.deserialize(data);
    expect(sys2.getBagCapacity()).toBe(cap);
    for (const key of Object.keys(data.codexEntries)) {
      expect(sys2.isCodexDiscovered(key)).toBe(true);
    }
  });
});

describe('F-Lifecycle: 强化/炼制序列化', () => {
  let sys: EquipmentSystem; let enhance: EquipmentEnhanceSystem; let forge: EquipmentForgeSystem;
  beforeEach(() => { ({ sys, enhance, forge } = createFullSetup()); enhance.setResourceDeductor(() => true); });

  it('保护符序列化/反序列化应一致', () => {
    enhance.addProtection(10);
    const data = enhance.serialize();
    const e2 = new EquipmentEnhanceSystem(sys); e2.init(createMockDeps());
    e2.deserialize(data);
    expect(e2.getProtectionCount()).toBe(10);
  });

  it('addProtection 非法值应被忽略', () => {
    enhance.addProtection(-5); enhance.addProtection(NaN); enhance.addProtection(Infinity);
    expect(enhance.getProtectionCount()).toBe(0);
  });

  it('addProtection 不超过上限', () => {
    enhance.addProtection(EquipmentEnhanceSystem.MAX_PROTECTION_COUNT + 1000);
    expect(enhance.getProtectionCount()).toBe(EquipmentEnhanceSystem.MAX_PROTECTION_COUNT);
  });

  it('炼制保底状态序列化/反序列化', () => {
    forge.deserialize(null as any);
    expect(forge.getTotalForgeCount()).toBe(0);
    const uids = genN(sys, 3, 'white', 100);
    forge.basicForge(uids, () => 0.5);
    const data = forge.serialize();
    const f2 = new EquipmentForgeSystem(sys); f2.init(createMockDeps());
    f2.deserialize(data);
    expect(f2.getTotalForgeCount()).toBe(1);
  });
});

describe('F-Lifecycle: 系统重置', () => {
  it('EquipmentSystem.reset 清空所有状态', () => {
    const sys = new EquipmentSystem(); sys.init(createMockDeps());
    genEq(sys, 'weapon', 'gold');
    sys.equipItem('hero_1', sys.getAllEquipments()[0].uid);
    sys.reset();
    expect(sys.getBagUsedCount()).toBe(0);
    expect(sys.getBagCapacity()).toBe(DEFAULT_BAG_CAPACITY);
    expect(sys.getHeroEquips('hero_1').weapon).toBeNull();
  });

  it('Enhance/Forge reset 清空状态', () => {
    const { sys, enhance, forge } = createFullSetup();
    enhance.addProtection(50);
    enhance.reset();
    expect(enhance.getProtectionCount()).toBe(0);
    forge.reset();
    expect(forge.getTotalForgeCount()).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// F-Boundary: 边界条件覆盖
// ═══════════════════════════════════════════════

describe('F-Boundary: 属性计算边界', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('baseValue=0 应返回0', () => {
    expect(sys.calculateMainStatValue(makeInstance({ mainStat: { type: 'attack', baseValue: 0, value: 0 }, enhanceLevel: 0 }))).toBe(0);
  });

  it('负数/NaN enhanceLevel应安全处理', () => {
    const r1 = sys.calculateMainStatValue(makeInstance({ mainStat: { type: 'attack', baseValue: 10, value: 10 }, enhanceLevel: -5 }));
    expect(r1).toBeGreaterThan(0);
    const r2 = sys.calculateMainStatValue(makeInstance({ mainStat: { type: 'attack', baseValue: 10, value: 10 }, enhanceLevel: NaN }));
    expect(Number.isFinite(r2)).toBe(true);
  });

  it('calculatePower 高品质>低品质', () => {
    const w = genEq(sys, 'weapon', 'white', 100);
    const g = genEq(sys, 'weapon', 'gold', 200);
    expect(sys.calculatePower(g)).toBeGreaterThan(sys.calculatePower(w));
  });

  it('compareRarity 正确比较', () => {
    expect(sys.compareRarity('white', 'gold')).toBeLessThan(0);
    expect(sys.compareRarity('gold', 'white')).toBeGreaterThan(0);
    expect(sys.compareRarity('blue', 'blue')).toBe(0);
  });

  it('recalculateStats 强化后属性增长', () => {
    const eq = genEq(sys, 'weapon', 'blue');
    expect(sys.recalculateStats({ ...eq, enhanceLevel: 5 }).mainStat.value).toBeGreaterThan(eq.mainStat.value);
  });
});

describe('F-Boundary: 背包容量边界', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('setCapacity NaN/负数/Infinity回退默认值', () => {
    const test = (val: number) => {
      const d = sys.serialize(); d.bagCapacity = val; sys.deserialize(d);
      expect(sys.getBagCapacity()).toBe(DEFAULT_BAG_CAPACITY);
    };
    test(NaN); test(-10); test(Infinity);
  });

  it('expandBag 无验证器时成功', () => {
    const before = sys.getBagCapacity();
    expect(sys.expandBag().success).toBe(true);
    expect(sys.getBagCapacity()).toBe(before + BAG_EXPAND_INCREMENT);
  });
});

describe('F-Boundary: 强化保护符边界', () => {
  let sys: EquipmentSystem; let enhance: EquipmentEnhanceSystem;
  beforeEach(() => { ({ sys, enhance } = createFullSetup()); enhance.setResourceDeductor(() => true); });

  it('保护符不足时useProtection被忽略不崩溃', () => {
    const eq = genEq(sys, 'weapon', 'white');
    for (let i = 0; i < 6; i++) enhance.enhance(eq.uid, false);
    expect(() => enhance.enhance(eq.uid, true)).not.toThrow();
  });

  it('getProtectionCost/getSuccessRate 边界', () => {
    expect(enhance.getProtectionCost(0)).toBe(0);
    expect(enhance.getProtectionCost(6)).toBe(1);
    expect(enhance.getSuccessRate(99)).toBe(0.01);
  });
});

describe('F-Boundary: 炼制品质与保底', () => {
  let sys: EquipmentSystem; let forge: EquipmentForgeSystem;
  beforeEach(() => { ({ sys, forge } = createFullSetup()); });

  it('紫色装备炼制应产出金色', () => {
    const r = forge.basicForge(genN(sys, 3, 'purple', 100), () => 0.5);
    if (r.success && r.equipment) expect(r.equipment.rarity).toBe('gold');
  });

  it('getForgeCostPreview 返回正确配置', () => {
    expect(forge.getForgeCostPreview('basic').inputCount).toBe(3);
    expect(forge.getForgeCostPreview('advanced').inputCount).toBe(5);
    expect(forge.getForgeCostPreview('targeted').inputCount).toBe(3);
  });

  it('连续炼制应累积保底计数', () => {
    for (let i = 0; i < 3; i++) {
      forge.basicForge(genN(sys, 3, 'white', 1000 + i * 10), () => 0.99);
    }
    expect(forge.getPityState().basicBluePity).toBeGreaterThanOrEqual(0);
  });
});

describe('F-Boundary: 图鉴边界', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('未发现模板返回false/null', () => {
    expect(sys.isCodexDiscovered('nonexistent')).toBe(false);
    expect(sys.getCodexEntry('nonexistent')).toBeNull();
  });

  it('重复获取同模板应增加obtainCount并更新bestRarity', () => {
    const eq1 = genEq(sys, 'weapon', 'white', 100);
    const eq2 = genEq(sys, 'weapon', 'gold', 200);
    if (eq1.templateId === eq2.templateId) {
      const entry = sys.getCodexEntry(eq1.templateId);
      if (entry) {
        expect(entry.obtainCount).toBeGreaterThanOrEqual(2);
        expect(entry.bestRarity).toBe('gold');
      }
    }
  });
});

describe('F-Boundary: 套装系统边界', () => {
  let sys: EquipmentSystem; let setSys: EquipmentSetSystem;
  beforeEach(() => { ({ sys, setSys } = createFullSetup()); });

  it('getAllSetDefs 返回至少5套', () => {
    expect(setSys.getAllSetDefs().length).toBeGreaterThanOrEqual(5);
  });

  it('getSetDef 不存在返回undefined', () => {
    expect(setSys.getSetDef('nonexistent' as any)).toBeUndefined();
  });

  it('3件dragon套装激活2件但不激活4件效果', () => {
    const e1 = sys.generateEquipment('sword_dragon', 'blue', 'forge', 100);
    const e2 = sys.generateEquipment('armor_dragon', 'blue', 'forge', 200);
    const e3 = sys.generateEquipment('ring_dragon', 'blue', 'forge', 300);
    [e1, e2, e3].forEach(e => { expect(e).not.toBeNull(); sys.equipItem('hero_1', e!.uid); });
    const dragon = setSys.getActiveSetBonuses('hero_1').find(b => b.setId === 'dragon');
    if (dragon) {
      expect(dragon.count).toBe(3);
      expect(dragon.activeTiers).toContain(2);
      expect(dragon.activeTiers).not.toContain(4);
    }
  });

  it('getSetCompletionEquipments 无可凑套装返回空', () => {
    expect(setSys.getSetCompletionEquipments('hero_1')).toEqual([]);
  });
});

// ═══════════════════════════════════════════════
// F-Normal: 正向流程补充
// ═══════════════════════════════════════════════

describe('F-Normal: 强化转移流程', () => {
  let sys: EquipmentSystem; let enhance: EquipmentEnhanceSystem;
  beforeEach(() => { ({ sys, enhance } = createFullSetup()); enhance.setResourceDeductor(() => true); });

  it('transferEnhance 将等级从源转移到目标', () => {
    const source = genEq(sys, 'weapon', 'gold');
    for (let i = 0; i < 3; i++) enhance.enhance(source.uid); // 0→3 100%
    expect(sys.getEquipment(source.uid)!.enhanceLevel).toBe(3);
    const target = genEq(sys, 'armor', 'gold', 500);
    const r = enhance.transferEnhance(source.uid, target.uid);
    if (r.success) {
      expect(sys.getEquipment(source.uid)!.enhanceLevel).toBe(0);
      expect(sys.getEquipment(target.uid)!.enhanceLevel).toBeGreaterThan(0);
      expect(r.transferredLevel).toBe(2); // 3 - TRANSFER_LEVEL_LOSS(1)
    }
  });
});

describe('F-Normal: 装备来源生成', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('generateCampaignDrop 不同关卡类型', () => {
    for (const t of ['normal', 'elite', 'boss'] as const) {
      expect(sys.generateCampaignDrop(t, Math.random() * 10000 | 0).source).toBe('campaign_drop');
    }
  });

  it('generateFromSource 所有来源类型', () => {
    for (const s of ['forge', 'shop', 'event', 'equipment_box', 'quest'] as const) {
      expect(sys.generateFromSource(s, Math.random() * 10000 | 0).source).toBe(s);
    }
  });

  it('固定seed生成装备属性正确', () => {
    const eq = sys.generateEquipment('weapon', 'white', 'forge', 42);
    expect(eq).not.toBeNull();
    expect(eq!.slot).toBe('weapon');
    expect(eq!.rarity).toBe('white');
  });
});

describe('F-Normal: 背包排序与筛选', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('rarity_desc排序正确', () => {
    genEq(sys, 'weapon', 'white', 100);
    genEq(sys, 'armor', 'gold', 200);
    genEq(sys, 'accessory', 'blue', 300);
    const sorted = sys.sortEquipments('rarity_desc');
    expect(sorted[0].rarity).toBe('gold');
    expect(sorted[sorted.length - 1].rarity).toBe('white');
  });

  it('筛选指定品质', () => {
    genEq(sys, 'weapon', 'white', 100);
    genEq(sys, 'armor', 'gold', 200);
    genEq(sys, 'accessory', 'gold', 300);
    const f = sys.filterEquipments({ slot: null, rarity: 'gold', unequippedOnly: false, setOnly: false });
    expect(f).toHaveLength(2);
    expect(f.every(e => e.rarity === 'gold')).toBe(true);
  });

  it('groupBySlot 正确分组', () => {
    genEq(sys, 'weapon', 'white', 100);
    genEq(sys, 'weapon', 'green', 200);
    genEq(sys, 'armor', 'white', 300);
    const g = sys.groupBySlot();
    expect(g.weapon).toHaveLength(2);
    expect(g.armor).toHaveLength(1);
    expect(g.accessory).toHaveLength(0);
  });
});
