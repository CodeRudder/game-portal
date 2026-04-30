/**
 * 装备模块对抗式测试 — Part 1: F-Normal + F-Boundary
 *
 * 维度覆盖：
 *   F-Normal: 装备获取、穿戴、卸下、强化、分解 完整正向流程
 *   F-Boundary: 背包满、强化等级上限、同名装备、空背包边界
 *
 * 目标：验证所有公开API在正常和边界条件下的行为一致性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EquipmentSystem } from '../EquipmentSystem';
import { EquipmentEnhanceSystem } from '../EquipmentEnhanceSystem';
import { EquipmentForgeSystem } from '../EquipmentForgeSystem';
import { EquipmentSetSystem } from '../EquipmentSetSystem';
import { EquipmentRecommendSystem } from '../EquipmentRecommendSystem';
import type { EquipmentInstance, EquipmentRarity, EquipmentSlot, HeroEquipSlots } from '../../../core/equipment/equipment.types';
import type { ISystemDeps } from '../../../core/types';
import {
  DEFAULT_BAG_CAPACITY,
  MAX_BAG_CAPACITY,
  RARITY_ENHANCE_CAP,
  ENHANCE_CONFIG,
  EQUIPMENT_SAVE_VERSION,
} from '../../../core/equipment/equipment-config';

// ── 测试辅助 ──

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
    } as unknown as ISystemDeps['eventBus'],
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
  const recommend = new EquipmentRecommendSystem(sys, setSys);
  recommend.init(createMockDeps());
  return { sys, enhance, forge, setSys, recommend };
}

/** 生成装备到背包 */
function genEq(sys: EquipmentSystem, slot: EquipmentSlot = 'weapon', rarity: EquipmentRarity = 'white', seed: number = 42): EquipmentInstance {
  const eq = sys.generateEquipment(slot, rarity, 'forge', seed);
  expect(eq).not.toBeNull();
  return eq!;
}

// ═══════════════════════════════════════════════
// F-Normal: 正向流程验证
// ═══════════════════════════════════════════════

describe('F-Normal: 装备获取流程', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('generateEquipment(按部位) 应生成正确部位的装备', () => {
    const slots: EquipmentSlot[] = ['weapon', 'armor', 'accessory', 'mount'];
    for (const slot of slots) {
      const eq = genEq(sys, slot, 'white', Math.random() * 10000 | 0);
      expect(eq.slot).toBe(slot);
      expect(eq.uid).toBeTruthy();
      expect(eq.rarity).toBe('white');
      expect(eq.enhanceLevel).toBe(0);
      expect(eq.isEquipped).toBe(false);
      expect(eq.equippedHeroId).toBeNull();
    }
  });

  it('generateEquipment(按模板) 应生成对应模板装备', () => {
    const eq = sys.generateEquipment('sword_iron', 'green');
    expect(eq).not.toBeNull();
    expect(eq!.templateId).toBe('sword_iron');
    expect(eq!.slot).toBe('weapon');
    expect(eq!.rarity).toBe('green');
  });

  it('generateEquipment(不存在的模板) 应返回 null', () => {
    const eq = sys.generateEquipment('nonexistent_template', 'white');
    expect(eq).toBeNull();
  });

  it('generateEquipment 后装备应自动加入背包', () => {
    const eq = genEq(sys);
    expect(sys.getEquipment(eq.uid)).toBeDefined();
    expect(sys.getBagUsedCount()).toBe(1);
  });

  it('所有品质装备均可正常生成', () => {
    const rarities: EquipmentRarity[] = ['white', 'green', 'blue', 'purple', 'gold'];
    for (const r of rarities) {
      const eq = genEq(sys, 'weapon', r, Math.random() * 10000 | 0);
      expect(eq.rarity).toBe(r);
    }
    expect(sys.getBagUsedCount()).toBe(5);
  });

  it('generateCampaignDrop 应生成有效装备', () => {
    const eq = sys.generateCampaignDrop('normal', 42);
    expect(eq).toBeDefined();
    expect(eq.slot).toBeTruthy();
    expect(['white', 'green', 'blue', 'purple', 'gold']).toContain(eq.rarity);
  });

  it('generateFromSource 应生成有效装备', () => {
    const sources = ['forge', 'shop', 'event', 'equipment_box'] as const;
    for (const source of sources) {
      const eq = sys.generateFromSource(source, Math.random() * 10000 | 0);
      expect(eq).toBeDefined();
      expect(eq.source).toBe(source);
    }
  });
});

describe('F-Normal: 穿戴/卸下流程', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('equipItem 应成功穿戴装备到武将', () => {
    const eq = genEq(sys, 'weapon');
    const result = sys.equipItem('hero_1', eq.uid);
    expect(result.success).toBe(true);
    expect(result.replacedUid).toBeUndefined();

    const updated = sys.getEquipment(eq.uid);
    expect(updated!.isEquipped).toBe(true);
    expect(updated!.equippedHeroId).toBe('hero_1');
  });

  it('unequipItem 应成功卸下装备', () => {
    const eq = genEq(sys, 'weapon');
    sys.equipItem('hero_1', eq.uid);

    const result = sys.unequipItem('hero_1', 'weapon');
    expect(result.success).toBe(true);

    const updated = sys.getEquipment(eq.uid);
    expect(updated!.isEquipped).toBe(false);
    expect(updated!.equippedHeroId).toBeNull();
  });

  it('穿戴四个不同部位装备应全部成功', () => {
    const slots: EquipmentSlot[] = ['weapon', 'armor', 'accessory', 'mount'];
    const uids: string[] = [];
    for (let i = 0; i < slots.length; i++) {
      const eq = genEq(sys, slots[i], 'white', 100 + i);
      uids.push(eq.uid);
      const result = sys.equipItem('hero_1', eq.uid);
      expect(result.success).toBe(true);
    }

    const heroEquips = sys.getHeroEquips('hero_1');
    expect(heroEquips.weapon).toBe(uids[0]);
    expect(heroEquips.armor).toBe(uids[1]);
    expect(heroEquips.accessory).toBe(uids[2]);
    expect(heroEquips.mount).toBe(uids[3]);
  });

  it('穿戴同部位新装备应替换旧装备', () => {
    const eq1 = genEq(sys, 'weapon', 'white', 100);
    sys.equipItem('hero_1', eq1.uid);

    const eq2 = genEq(sys, 'weapon', 'green', 200);
    const result = sys.equipItem('hero_1', eq2.uid);
    expect(result.success).toBe(true);
    expect(result.replacedUid).toBe(eq1.uid);

    // 旧装备应被卸下
    const old = sys.getEquipment(eq1.uid);
    expect(old!.isEquipped).toBe(false);
    expect(old!.equippedHeroId).toBeNull();

    // 新装备应已穿戴
    const heroEquips = sys.getHeroEquips('hero_1');
    expect(heroEquips.weapon).toBe(eq2.uid);
  });

  it('getHeroEquipItems 应返回4个元素（含null）', () => {
    const items = sys.getHeroEquipItems('hero_1');
    expect(items).toHaveLength(4);
    expect(items.every(i => i === null)).toBe(true);
  });

  it('getHeroEquipments 应返回已穿戴装备数组', () => {
    const eq = genEq(sys, 'weapon');
    sys.equipItem('hero_1', eq.uid);
    const equipped = sys.getHeroEquipments('hero_1');
    expect(equipped).toHaveLength(1);
    expect(equipped[0].uid).toBe(eq.uid);
  });
});

describe('F-Normal: 强化流程', () => {
  let sys: EquipmentSystem;
  let enhance: EquipmentEnhanceSystem;
  beforeEach(() => {
    ({ sys, enhance } = createFullSetup());
    enhance.setResourceDeductor(() => true); // 资源充足
  });

  it('enhance 应返回有效的 EnhanceResult', () => {
    const eq = genEq(sys, 'weapon', 'white');
    const result = enhance.enhance(eq.uid, false);
    expect(result).toHaveProperty('outcome');
    expect(result).toHaveProperty('previousLevel');
    expect(result).toHaveProperty('currentLevel');
    expect(result).toHaveProperty('copperCost');
    expect(result).toHaveProperty('stoneCost');
    expect(['success', 'fail', 'downgrade']).toContain(result.outcome);
  });

  it('强化成功时 currentLevel = previousLevel + 1', () => {
    const eq = genEq(sys, 'weapon', 'white');
    // level 0 → 1 成功率100%
    const result = enhance.enhance(eq.uid, false);
    expect(result.outcome).toBe('success');
    expect(result.previousLevel).toBe(0);
    expect(result.currentLevel).toBe(1);
  });

  it('连续强化低等级应可预测成功', () => {
    const eq = genEq(sys, 'weapon', 'white');
    // level 0→1, 1→2, 2→3 都是100%
    for (let i = 0; i < 3; i++) {
      const result = enhance.enhance(eq.uid, false);
      expect(result.outcome).toBe('success');
    }
    const updated = sys.getEquipment(eq.uid);
    expect(updated!.enhanceLevel).toBe(3);
  });

  it('autoEnhance 应循环强化到目标等级或资源耗尽', () => {
    const eq = genEq(sys, 'weapon', 'gold');
    const result = enhance.autoEnhance(eq.uid, {
      targetLevel: 5,
      maxCopper: 999999,
      maxStone: 999999,
      useProtection: false,
      protectionThreshold: 6,
    });
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.finalLevel).toBeLessThanOrEqual(5);
    expect(result.totalCopper).toBeGreaterThan(0);
  });

  it('batchEnhance 应对多件装备各强化一次', () => {
    const eq1 = genEq(sys, 'weapon', 'white', 100);
    const eq2 = genEq(sys, 'armor', 'white', 200);
    const results = enhance.batchEnhance([eq1.uid, eq2.uid], false);
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(['success', 'fail', 'downgrade']).toContain(r.outcome);
    }
  });
});

describe('F-Normal: 分解流程', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('decompose(单件) 应成功分解并返回奖励', () => {
    const eq = genEq(sys, 'weapon', 'green');
    const result = sys.decompose(eq.uid);
    expect('success' in result && result.success).toBe(true);
    if ('result' in result && result.result) {
      expect(result.result.copper).toBeGreaterThan(0);
      expect(result.result.enhanceStone).toBeGreaterThan(0);
    }
    // 装备应从背包移除
    expect(sys.getEquipment(eq.uid)).toBeUndefined();
  });

  it('batchDecompose 应批量分解多件装备', () => {
    const uids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const eq = genEq(sys, 'weapon', 'white', 100 + i);
      uids.push(eq.uid);
    }
    const result = sys.batchDecompose(uids);
    expect(result.decomposedUids.length).toBe(3);
    expect(result.skippedUids.length).toBe(0);
    expect(result.total.copper).toBeGreaterThan(0);
  });

  it('decomposeAllUnequipped 应只分解未穿戴装备', () => {
    const eq1 = genEq(sys, 'weapon', 'white', 100);
    const eq2 = genEq(sys, 'armor', 'white', 200);
    sys.equipItem('hero_1', eq1.uid);

    const result = sys.decomposeAllUnequipped();
    expect(result.decomposedUids).toContain(eq2.uid);
    expect(result.decomposedUids).not.toContain(eq1.uid);
    // 已穿戴装备仍在背包
    expect(sys.getEquipment(eq1.uid)).toBeDefined();
  });

  it('getDecomposePreview 应返回正确的预览奖励', () => {
    const eq = genEq(sys, 'weapon', 'purple');
    const preview = sys.getDecomposePreview(eq.uid);
    expect(preview).not.toBeNull();
    expect(preview!.copper).toBeGreaterThan(0);
  });

  it('calculateDecomposeReward 高品质装备应给更多奖励', () => {
    const whiteEq = genEq(sys, 'weapon', 'white', 100);
    const goldEq = genEq(sys, 'weapon', 'gold', 200);
    const whiteReward = sys.calculateDecomposeReward(whiteEq);
    const goldReward = sys.calculateDecomposeReward(goldEq);
    expect(goldReward.copper).toBeGreaterThan(whiteReward.copper);
    expect(goldReward.enhanceStone).toBeGreaterThan(whiteReward.enhanceStone);
  });
});

// ═══════════════════════════════════════════════
// F-Boundary: 边界条件验证
// ═══════════════════════════════════════════════

describe('F-Boundary: 背包容量边界', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('默认背包容量应为 DEFAULT_BAG_CAPACITY', () => {
    expect(sys.getBagCapacity()).toBe(DEFAULT_BAG_CAPACITY);
  });

  it('背包满时添加装备应失败', () => {
    // 填满背包
    for (let i = 0; i < DEFAULT_BAG_CAPACITY; i++) {
      genEq(sys, 'weapon', 'white', i * 7 + 1);
    }
    expect(sys.isBagFull()).toBe(true);
    expect(sys.getBagUsedCount()).toBe(DEFAULT_BAG_CAPACITY);

    // 再添加应失败
    const result = sys.addToBag({
      uid: 'overflow_eq',
      templateId: 'tpl_weapon_white',
      name: '溢出装备',
      slot: 'weapon',
      rarity: 'white',
      enhanceLevel: 0,
      mainStat: { type: 'attack', baseValue: 10, value: 10 },
      subStats: [],
      specialEffect: null,
      source: 'forge',
      acquiredAt: Date.now(),
      isEquipped: false,
      equippedHeroId: null,
      seed: 99999,
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('背包已满');
  });

  it('expandBag 应增加背包容量', () => {
    const before = sys.getBagCapacity();
    const result = sys.expandBag();
    expect(result.success).toBe(true);
    expect(sys.getBagCapacity()).toBeGreaterThan(before);
  });

  it('背包容量不应超过 MAX_BAG_CAPACITY', () => {
    // 反复扩容到极限
    while (!sys.isBagFull()) {
      const eq = genEq(sys, 'weapon', 'white', Math.random() * 100000 | 0);
    }
    // 扩容直到最大
    for (let i = 0; i < 100; i++) {
      sys.expandBag();
    }
    expect(sys.getBagCapacity()).toBeLessThanOrEqual(MAX_BAG_CAPACITY);
  });

  it('达到最大容量后 expandBag 应失败', () => {
    // 强制设置容量到最大
    const save = sys.serialize();
    save.bagCapacity = MAX_BAG_CAPACITY;
    sys.deserialize(save);

    const result = sys.expandBag();
    expect(result.success).toBe(false);
    expect(result.reason).toBe('已达最大容量');
  });

  it('重复添加同一uid应幂等成功', () => {
    const eq = genEq(sys);
    const result = sys.addToBag(eq); // 重复添加
    expect(result.success).toBe(true);
    expect(sys.getBagUsedCount()).toBe(1); // 数量不变
  });
});

describe('F-Boundary: 强化等级上限', () => {
  let sys: EquipmentSystem;
  let enhance: EquipmentEnhanceSystem;
  beforeEach(() => {
    ({ sys, enhance } = createFullSetup());
    enhance.setResourceDeductor(() => true);
  });

  it('白色装备强化不应超过 RARITY_ENHANCE_CAP.white=5', () => {
    const eq = genEq(sys, 'weapon', 'white');
    for (let i = 0; i < 30; i++) {
      enhance.enhance(eq.uid, false);
    }
    const final = sys.getEquipment(eq.uid);
    expect(final!.enhanceLevel).toBeLessThanOrEqual(RARITY_ENHANCE_CAP['white']);
  });

  it('绿色装备强化不应超过 RARITY_ENHANCE_CAP.green=8', () => {
    const eq = genEq(sys, 'weapon', 'green');
    for (let i = 0; i < 30; i++) {
      enhance.enhance(eq.uid, false);
    }
    const final = sys.getEquipment(eq.uid);
    expect(final!.enhanceLevel).toBeLessThanOrEqual(RARITY_ENHANCE_CAP['green']);
  });

  it('金色装备强化不应超过 RARITY_ENHANCE_CAP.gold=15', () => {
    const eq = genEq(sys, 'weapon', 'gold');
    for (let i = 0; i < 50; i++) {
      enhance.enhance(eq.uid, false);
    }
    const final = sys.getEquipment(eq.uid);
    expect(final!.enhanceLevel).toBeLessThanOrEqual(RARITY_ENHANCE_CAP['gold']);
    expect(final!.enhanceLevel).toBeLessThanOrEqual(ENHANCE_CONFIG.maxLevel);
  });

  it('已达上限时 enhance 应返回 fail 且等级不变', () => {
    const eq = genEq(sys, 'weapon', 'white');
    // 白色上限5，持续强化直到达到上限
    for (let i = 0; i < 30; i++) {
      enhance.enhance(eq.uid, false);
    }
    const before = sys.getEquipment(eq.uid)!.enhanceLevel;
    expect(before).toBeLessThanOrEqual(RARITY_ENHANCE_CAP['white']);
    // 继续强化应失败
    const result = enhance.enhance(eq.uid, false);
    expect(result.outcome).toBe('fail');
    expect(result.currentLevel).toBe(before);
  });

  it('canEnhanceTo 应正确判断品质上限', () => {
    expect(sys.canEnhanceTo('white', 5)).toBe(true);
    expect(sys.canEnhanceTo('white', 6)).toBe(false);
    expect(sys.canEnhanceTo('gold', 15)).toBe(true);
    expect(sys.canEnhanceTo('gold', 16)).toBe(false);
  });

  it('getEnhanceCap 应返回正确的品质上限', () => {
    expect(sys.getEnhanceCap('white')).toBe(5);
    expect(sys.getEnhanceCap('green')).toBe(8);
    expect(sys.getEnhanceCap('blue')).toBe(10);
    expect(sys.getEnhanceCap('purple')).toBe(12);
    expect(sys.getEnhanceCap('gold')).toBe(15);
  });
});

describe('F-Boundary: 空背包边界', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('空背包 getAllEquipments 应返回空数组', () => {
    expect(sys.getAllEquipments()).toEqual([]);
  });

  it('空背包 getBagUsedCount 应为 0', () => {
    expect(sys.getBagUsedCount()).toBe(0);
    expect(sys.getBagSize()).toBe(0);
  });

  it('空背包 isBagFull 应为 false', () => {
    expect(sys.isBagFull()).toBe(false);
  });

  it('空背包 removeEquipment 不存在的uid应返回 false', () => {
    expect(sys.removeEquipment('nonexistent')).toBe(false);
  });

  it('空背包 getEquipment 不存在的uid应返回 undefined', () => {
    expect(sys.getEquipment('nonexistent')).toBeUndefined();
  });

  it('空背包 sortEquipments 应返回空数组', () => {
    expect(sys.sortEquipments('rarity_desc')).toEqual([]);
  });

  it('空背包 filterEquipments 应返回空数组', () => {
    expect(sys.filterEquipments({ slot: null, rarity: null, unequippedOnly: false, setOnly: false })).toEqual([]);
  });

  it('空背包 groupBySlot 应返回空分组', () => {
    const groups = sys.groupBySlot();
    expect(groups.weapon).toEqual([]);
    expect(groups.armor).toEqual([]);
    expect(groups.accessory).toEqual([]);
    expect(groups.mount).toEqual([]);
  });

  it('空背包 decomposeAllUnequipped 应返回空结果', () => {
    const result = sys.decomposeAllUnequipped();
    expect(result.decomposedUids).toEqual([]);
    expect(result.total.copper).toBe(0);
  });
});

describe('F-Boundary: 排序与筛选边界', () => {
  let sys: EquipmentSystem;
  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  it('所有排序模式应正常工作', () => {
    const modes: Array<'rarity_desc' | 'rarity_asc' | 'level_desc' | 'level_asc' | 'slot_type' | 'acquired_time'> = [
      'rarity_desc', 'rarity_asc', 'level_desc', 'level_asc', 'slot_type', 'acquired_time',
    ];
    for (const mode of modes) {
      const sorted = sys.sortEquipments(mode);
      expect(Array.isArray(sorted)).toBe(true);
    }
  });

  it('单件装备排序应返回单元素数组', () => {
    genEq(sys, 'weapon', 'gold');
    for (const mode of ['rarity_desc', 'level_asc', 'slot_type'] as const) {
      const sorted = sys.sortEquipments(mode);
      expect(sorted).toHaveLength(1);
    }
  });

  it('筛选不存在的部位应返回空', () => {
    genEq(sys, 'weapon');
    const filtered = sys.filterEquipments({ slot: 'mount', rarity: null, unequippedOnly: false, setOnly: false });
    expect(filtered).toHaveLength(0);
  });

  it('筛选已穿戴装备应排除未穿戴的', () => {
    const eq = genEq(sys, 'weapon');
    sys.equipItem('hero_1', eq.uid);
    const filtered = sys.filterEquipments({ slot: null, rarity: null, unequippedOnly: true, setOnly: false });
    expect(filtered).toHaveLength(0);
  });
});
