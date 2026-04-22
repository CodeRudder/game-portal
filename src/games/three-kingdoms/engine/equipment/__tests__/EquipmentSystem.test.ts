import { vi } from 'vitest';
/**
 * EquipmentSystem 单元测试
 *
 * 覆盖：
 * 1. 装备生成（指定部位+品质、随机掉落、装备箱/活动来源）
 * 2. 属性计算（主属性+副属性+特殊词条公式验证）
 * 3. 品质判定（权重随机、强化上限、品质比较）
 * 4. 背包管理（添加/删除/排序/筛选/扩容/分组/穿戴标记）
 * 5. 装备分解（单件/批量/全部分解+产出计算）
 * 6. 序列化/反序列化
 * 7. ISubsystem 接口
 * 8. 边界条件
 */

import { EquipmentSystem, resetUidCounter } from '../EquipmentSystem';
import type {
  EquipmentSlot,
  EquipmentRarity,
  EquipmentInstance,
  BagFilter,
  BagSortMode,
} from '../../../core/equipment';
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_RARITIES,
  RARITY_ORDER,
  RARITY_ENHANCE_CAP,
  RARITY_MAIN_STAT_MULTIPLIER,
  RARITY_SUB_STAT_MULTIPLIER,
  RARITY_SUB_STAT_COUNT,
  RARITY_SPECIAL_EFFECT_CHANCE,
  ENHANCE_MAIN_STAT_FACTOR,
  ENHANCE_SUB_STAT_FACTOR,
  DEFAULT_BAG_CAPACITY,
  MAX_BAG_CAPACITY,
  BAG_EXPAND_INCREMENT,
  DECOMPOSE_COPPER_BASE,
  DECOMPOSE_STONE_BASE,
  DECOMPOSE_ENHANCE_BONUS,
  SLOT_MAIN_STAT_TYPE,
  SLOT_SUB_STAT_POOL,
  SLOT_SPECIAL_EFFECT_POOL,
} from '../../../core/equipment';

/** 创建带 mock deps 的 EquipmentSystem */
function createSystem(): EquipmentSystem {
  resetUidCounter();
  const sys = new EquipmentSystem();
  const mockEventBus = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  const mockConfig = { get: vi.fn() };
  const mockRegistry = { get: vi.fn() };
  sys.init({
    eventBus: mockEventBus as any,
    config: mockConfig as any,
    registry: mockRegistry as any,
  });
  return sys;
}

/** 生成并添加装备到背包 */
function addRandomEquipment(
  sys: EquipmentSystem,
  slot: EquipmentSlot = 'weapon',
  rarity: EquipmentRarity = 'white',
  seed: number = 42,
): EquipmentInstance {
  const eq = sys.generateEquipment(slot, rarity, 'campaign_drop', seed);
  sys.addToBag(eq);
  return eq;
}

// ═══════════════════════════════════════════════════
// 1. 装备生成
// ═══════════════════════════════════════════════════
describe('EquipmentSystem — 装备生成', () => {
  let sys: EquipmentSystem;
  beforeEach(() => {
    sys = createSystem();
  });

  describe('generateEquipment', () => {
    it('应生成指定部位的装备', () => {
      for (const slot of EQUIPMENT_SLOTS) {
        const eq = sys.generateEquipment(slot, 'white', 'campaign_drop', 100);
        expect(eq.slot).toBe(slot);
      }
    });

    it('应生成指定品质的装备', () => {
      for (const rarity of EQUIPMENT_RARITIES) {
        const eq = sys.generateEquipment('weapon', rarity, 'campaign_drop', 200);
        expect(eq.rarity).toBe(rarity);
      }
    });

    it('应生成正确的装备来源', () => {
      const sources = ['campaign_drop', 'forge', 'shop', 'event', 'equipment_box'] as const;
      for (const source of sources) {
        const eq = sys.generateEquipment('weapon', 'white', source, 300);
        expect(eq.source).toBe(source);
      }
    });

    it('应生成唯一UID', () => {
      const eq1 = sys.generateEquipment('weapon', 'white', 'campaign_drop', 1);
      const eq2 = sys.generateEquipment('weapon', 'white', 'campaign_drop', 2);
      expect(eq1.uid).not.toBe(eq2.uid);
    });

    it('应包含主属性', () => {
      const eq = sys.generateEquipment('weapon', 'white', 'campaign_drop', 42);
      expect(eq.mainStat).toBeDefined();
      expect(eq.mainStat.type).toBe('attack');
      expect(eq.mainStat.baseValue).toBeGreaterThan(0);
      expect(eq.mainStat.value).toBeGreaterThan(0);
    });

    it('白色品质应有0~1条副属性', () => {
      // 多次生成，验证范围
      for (let seed = 0; seed < 20; seed++) {
        const eq = sys.generateEquipment('weapon', 'white', 'campaign_drop', seed);
        expect(eq.subStats.length).toBeGreaterThanOrEqual(0);
        expect(eq.subStats.length).toBeLessThanOrEqual(1);
      }
    });

    it('绿色品质应有固定1条副属性', () => {
      for (let seed = 0; seed < 10; seed++) {
        const eq = sys.generateEquipment('weapon', 'green', 'campaign_drop', seed);
        expect(eq.subStats.length).toBe(1);
      }
    });

    it('金色品质应有2~3条副属性', () => {
      for (let seed = 0; seed < 20; seed++) {
        const eq = sys.generateEquipment('weapon', 'gold', 'campaign_drop', seed);
        expect(eq.subStats.length).toBeGreaterThanOrEqual(2);
        expect(eq.subStats.length).toBeLessThanOrEqual(3);
      }
    });

    it('副属性应来自对应部位池', () => {
      const eq = sys.generateEquipment('weapon', 'purple', 'campaign_drop', 42);
      const weaponPool = SLOT_SUB_STAT_POOL.weapon;
      for (const ss of eq.subStats) {
        expect(weaponPool).toContain(ss.type);
      }
    });

    it('白色品质不应有特殊词条', () => {
      for (let seed = 0; seed < 50; seed++) {
        const eq = sys.generateEquipment('weapon', 'white', 'campaign_drop', seed);
        expect(eq.specialEffect).toBeNull();
      }
    });

    it('绿色品质不应有特殊词条', () => {
      for (let seed = 0; seed < 50; seed++) {
        const eq = sys.generateEquipment('weapon', 'green', 'campaign_drop', seed);
        expect(eq.specialEffect).toBeNull();
      }
    });

    it('金色品质必定有特殊词条', () => {
      for (let seed = 0; seed < 10; seed++) {
        const eq = sys.generateEquipment('weapon', 'gold', 'campaign_drop', seed);
        expect(eq.specialEffect).not.toBeNull();
      }
    });

    it('特殊词条应来自对应部位池', () => {
      const eq = sys.generateEquipment('weapon', 'gold', 'campaign_drop', 42);
      if (eq.specialEffect) {
        const weaponPool = SLOT_SPECIAL_EFFECT_POOL.weapon;
        expect(weaponPool).toContain(eq.specialEffect.type);
      }
    });

    it('初始强化等级为0', () => {
      const eq = sys.generateEquipment('weapon', 'blue', 'campaign_drop', 42);
      expect(eq.enhanceLevel).toBe(0);
    });

    it('初始状态为未穿戴', () => {
      const eq = sys.generateEquipment('weapon', 'blue', 'campaign_drop', 42);
      expect(eq.isEquipped).toBe(false);
      expect(eq.equippedHeroId).toBeNull();
    });

    it('相同种子生成相同装备', () => {
      resetUidCounter();
      const eq1 = sys.generateEquipment('weapon', 'blue', 'campaign_drop', 42);
      resetUidCounter();
      const eq2 = sys.generateEquipment('weapon', 'blue', 'campaign_drop', 42);
      expect(eq1.name).toBe(eq2.name);
      expect(eq1.mainStat.baseValue).toBe(eq2.mainStat.baseValue);
      expect(eq1.subStats.length).toBe(eq2.subStats.length);
    });

    it('各部位主属性类型正确', () => {
      const expected: Record<EquipmentSlot, string> = {
        weapon: 'attack',
        armor: 'defense',
        accessory: 'intelligence',
        mount: 'speed',
      };
      for (const [slot, statType] of Object.entries(expected)) {
        const eq = sys.generateEquipment(slot as EquipmentSlot, 'white', 'campaign_drop', 42);
        expect(eq.mainStat.type).toBe(statType);
      }
    });

    it('应生成装备名称', () => {
      const eq = sys.generateEquipment('weapon', 'blue', 'campaign_drop', 42);
      expect(eq.name).toBeTruthy();
      expect(eq.name.length).toBeGreaterThan(0);
    });
  });

  describe('generateCampaignDrop', () => {
    it('普通关卡不掉落金色装备（概率为0）', () => {
      for (let seed = 0; seed < 100; seed++) {
        const eq = sys.generateCampaignDrop('normal', seed);
        expect(eq.rarity).not.toBe('gold');
      }
    });

    it('应生成有效的装备实例', () => {
      const eq = sys.generateCampaignDrop('boss', 42);
      expect(eq.uid).toBeTruthy();
      expect(EQUIPMENT_SLOTS).toContain(eq.slot);
      expect(EQUIPMENT_RARITIES).toContain(eq.rarity);
      expect(eq.source).toBe('campaign_drop');
    });
  });

  describe('generateFromSource', () => {
    it('装备箱来源正确', () => {
      const eq = sys.generateFromSource('equipment_box', 42);
      expect(eq.source).toBe('equipment_box');
      // 装备箱只出紫和金
      expect(['purple', 'gold']).toContain(eq.rarity);
    });

    it('活动来源正确', () => {
      const eq = sys.generateFromSource('event', 42);
      expect(eq.source).toBe('event');
      // 活动只出蓝/紫/金
      expect(['blue', 'purple', 'gold']).toContain(eq.rarity);
    });
  });
});

// ═══════════════════════════════════════════════════
// 2. 属性计算
// ═══════════════════════════════════════════════════
describe('EquipmentSystem — 属性计算', () => {
  let sys: EquipmentSystem;
  beforeEach(() => {
    sys = createSystem();
  });

  describe('主属性计算', () => {
    it('公式：主属性 = 基础值 × 品质倍率 × (1 + 强化等级 × 0.15)', () => {
      const eq = sys.generateEquipment('weapon', 'blue', 'campaign_drop', 42);
      eq.enhanceLevel = 5;
      const expected = Math.floor(
        eq.mainStat.baseValue * RARITY_MAIN_STAT_MULTIPLIER.blue * (1 + 5 * ENHANCE_MAIN_STAT_FACTOR.min)
      );
      const actual = sys.calculateMainStatValue(eq);
      expect(actual).toBe(expected);
    });

    it('白色品质倍率为1.0', () => {
      const eq = sys.generateEquipment('weapon', 'white', 'campaign_drop', 42);
      const value = sys.calculateMainStatValue(eq);
      const expected = Math.floor(eq.mainStat.baseValue * 1.0);
      expect(value).toBe(expected);
    });

    it('金色品质倍率为2.5', () => {
      const eq = sys.generateEquipment('weapon', 'gold', 'campaign_drop', 42);
      eq.enhanceLevel = 0;
      const value = sys.calculateMainStatValue(eq);
      const expected = Math.floor(eq.mainStat.baseValue * 2.5);
      expect(value).toBe(expected);
    });

    it('强化等级越高，主属性越大', () => {
      const eq = sys.generateEquipment('weapon', 'purple', 'campaign_drop', 42);
      const value0 = sys.calculateMainStatValue({ ...eq, enhanceLevel: 0 });
      const value5 = sys.calculateMainStatValue({ ...eq, enhanceLevel: 5 });
      const value10 = sys.calculateMainStatValue({ ...eq, enhanceLevel: 10 });
      expect(value5).toBeGreaterThan(value0);
      expect(value10).toBeGreaterThan(value5);
    });
  });

  describe('副属性计算', () => {
    it('公式：副属性 = 基础值 × 品质倍率 × (1 + 强化等级 × 0.05)', () => {
      const eq = sys.generateEquipment('weapon', 'purple', 'campaign_drop', 42);
      if (eq.subStats.length > 0) {
        const ss = eq.subStats[0];
        const expected = Math.floor(
          ss.baseValue * RARITY_SUB_STAT_MULTIPLIER.purple * (1 + 5 * ENHANCE_SUB_STAT_FACTOR.min)
        );
        const actual = sys.calculateSubStatValue(ss, 'purple', 5);
        expect(actual).toBe(expected);
      }
    });
  });

  describe('recalculateStats', () => {
    it('强化后重算属性', () => {
      const eq = sys.generateEquipment('weapon', 'blue', 'campaign_drop', 42);
      const before = eq.mainStat.value;
      eq.enhanceLevel = 5;
      const updated = sys.recalculateStats(eq);
      expect(updated.mainStat.value).toBeGreaterThanOrEqual(before);
    });

    it('副属性也应重算', () => {
      const eq = sys.generateEquipment('weapon', 'purple', 'campaign_drop', 42);
      eq.enhanceLevel = 5;
      const updated = sys.recalculateStats(eq);
      for (const ss of updated.subStats) {
        expect(ss.value).toBeGreaterThan(0);
      }
    });
  });
});

// ═══════════════════════════════════════════════════
// 3. 品质判定
// ═══════════════════════════════════════════════════
describe('EquipmentSystem — 品质判定', () => {
  let sys: EquipmentSystem;
  beforeEach(() => {
    sys = createSystem();
  });

  it('getEnhanceCap 返回正确的强化上限', () => {
    expect(sys.getEnhanceCap('white')).toBe(5);
    expect(sys.getEnhanceCap('green')).toBe(8);
    expect(sys.getEnhanceCap('blue')).toBe(10);
    expect(sys.getEnhanceCap('purple')).toBe(12);
    expect(sys.getEnhanceCap('gold')).toBe(15);
  });

  it('canEnhanceTo 正确判断', () => {
    expect(sys.canEnhanceTo('white', 5)).toBe(true);
    expect(sys.canEnhanceTo('white', 6)).toBe(false);
    expect(sys.canEnhanceTo('gold', 15)).toBe(true);
    expect(sys.canEnhanceTo('gold', 16)).toBe(false);
  });

  it('compareRarity 正确比较品质高低', () => {
    expect(sys.compareRarity('white', 'green')).toBeLessThan(0);
    expect(sys.compareRarity('gold', 'purple')).toBeGreaterThan(0);
    expect(sys.compareRarity('blue', 'blue')).toBe(0);
  });

  it('rollRarity 权重为0时不选对应品质', () => {
    const weights = { white: 0, green: 100, blue: 0, purple: 0, gold: 0 };
    for (let seed = 0; seed < 20; seed++) {
      const rarity = sys.rollRarity(weights, seed);
      expect(rarity).toBe('green');
    }
  });

  it('rollRarity 全部为0时返回white', () => {
    const weights = { white: 0, green: 0, blue: 0, purple: 0, gold: 0 };
    const rarity = sys.rollRarity(weights, 42);
    expect(rarity).toBe('white');
  });
});

// ═══════════════════════════════════════════════════
// 4. 背包管理
// ═══════════════════════════════════════════════════
describe('EquipmentSystem — 背包管理', () => {
  let sys: EquipmentSystem;
  beforeEach(() => {
    sys = createSystem();
  });

  describe('添加/删除', () => {
    it('应成功添加装备到背包', () => {
      const eq = sys.generateEquipment('weapon', 'white', 'campaign_drop', 42);
      const result = sys.addToBag(eq);
      expect(result.success).toBe(true);
      expect(sys.getBagUsedCount()).toBe(1);
    });

    it('添加装备触发 equipment:added 事件', () => {
      const eq = sys.generateEquipment('weapon', 'white', 'campaign_drop', 42);
      sys.addToBag(eq);
      const mockEventBus = (sys as any).deps.eventBus;
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'equipment:added',
        expect.objectContaining({ uid: eq.uid }),
      );
    });

    it('背包满时不可添加', () => {
      // 填满背包
      for (let i = 0; i < DEFAULT_BAG_CAPACITY; i++) {
        const eq = sys.generateEquipment('weapon', 'white', 'campaign_drop', i);
        sys.addToBag(eq);
      }
      expect(sys.getBagUsedCount()).toBe(DEFAULT_BAG_CAPACITY);

      const eq = sys.generateEquipment('weapon', 'white', 'campaign_drop', 9999);
      const result = sys.addToBag(eq);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('背包已满');
    });

    it('应成功从背包移除装备', () => {
      const eq = addRandomEquipment(sys);
      const result = sys.removeFromBag(eq.uid);
      expect(result.success).toBe(true);
      expect(sys.getBagUsedCount()).toBe(0);
    });

    it('移除不存在的装备返回失败', () => {
      const result = sys.removeFromBag('nonexistent');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('装备不存在');
    });

    it('已穿戴的装备不能移除', () => {
      const eq = addRandomEquipment(sys);
      sys.markEquipped(eq.uid, 'hero1');
      const result = sys.removeFromBag(eq.uid);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已穿戴');
    });

    it('移除装备触发 equipment:removed 事件', () => {
      const eq = addRandomEquipment(sys);
      sys.removeFromBag(eq.uid);
      const mockEventBus = (sys as any).deps.eventBus;
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'equipment:removed',
        expect.objectContaining({ uid: eq.uid }),
      );
    });
  });

  describe('查询', () => {
    it('getEquipment 返回指定装备', () => {
      const eq = addRandomEquipment(sys);
      const found = sys.getEquipment(eq.uid);
      expect(found).toBeDefined();
      expect(found!.uid).toBe(eq.uid);
    });

    it('getEquipment 不存在时返回undefined', () => {
      expect(sys.getEquipment('nonexistent')).toBeUndefined();
    });

    it('getAllEquipments 返回所有装备', () => {
      addRandomEquipment(sys, 'weapon', 'white', 1);
      addRandomEquipment(sys, 'armor', 'green', 2);
      addRandomEquipment(sys, 'accessory', 'blue', 3);
      expect(sys.getAllEquipments()).toHaveLength(3);
    });
  });

  describe('扩容', () => {
    it('expandBag 增加容量', () => {
      const before = sys.getBagCapacity();
      const result = sys.expandBag();
      expect(result.success).toBe(true);
      expect(sys.getBagCapacity()).toBe(before + BAG_EXPAND_INCREMENT);
    });

    it('expandBag 不超过最大容量', () => {
      // 一直扩容到最大
      while (sys.getBagCapacity() < MAX_BAG_CAPACITY) {
        sys.expandBag();
      }
      const result = sys.expandBag();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已达最大容量');
      expect(sys.getBagCapacity()).toBe(MAX_BAG_CAPACITY);
    });

    it('expandBag 触发 equipment:bag_expanded 事件', () => {
      sys.expandBag();
      const mockEventBus = (sys as any).deps.eventBus;
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'equipment:bag_expanded',
        expect.objectContaining({ capacity: DEFAULT_BAG_CAPACITY + BAG_EXPAND_INCREMENT }),
      );
    });
  });

  describe('排序', () => {
    beforeEach(() => {
      addRandomEquipment(sys, 'weapon', 'white', 1);   // 白色武器
      addRandomEquipment(sys, 'armor', 'gold', 2);     // 金色防具
      addRandomEquipment(sys, 'accessory', 'blue', 3); // 蓝色饰品
      addRandomEquipment(sys, 'mount', 'purple', 4);   // 紫色坐骑
      addRandomEquipment(sys, 'weapon', 'green', 5);   // 绿色武器
    });

    it('按品质降序排序（金→白）', () => {
      const sorted = sys.sortEquipments('rarity_desc');
      expect(sorted[0].rarity).toBe('gold');
      expect(sorted[sorted.length - 1].rarity).toBe('white');
    });

    it('按品质升序排序（白→金）', () => {
      const sorted = sys.sortEquipments('rarity_asc');
      expect(sorted[0].rarity).toBe('white');
      expect(sorted[sorted.length - 1].rarity).toBe('gold');
    });

    it('按部位类型排序', () => {
      const sorted = sys.sortEquipments('slot_type');
      const slotOrder: Record<string, number> = { weapon: 0, armor: 1, accessory: 2, mount: 3 };
      for (let i = 1; i < sorted.length; i++) {
        expect(slotOrder[sorted[i].slot]).toBeGreaterThanOrEqual(slotOrder[sorted[i - 1].slot]);
      }
    });
  });

  describe('筛选', () => {
    beforeEach(() => {
      addRandomEquipment(sys, 'weapon', 'white', 1);
      addRandomEquipment(sys, 'armor', 'gold', 2);
      addRandomEquipment(sys, 'accessory', 'blue', 3);
      addRandomEquipment(sys, 'mount', 'purple', 4);
      addRandomEquipment(sys, 'weapon', 'green', 5);
    });

    it('按部位筛选', () => {
      const filter: BagFilter = { slot: 'weapon', rarity: null, unequippedOnly: false, setOnly: false };
      const filtered = sys.filterEquipments(filter);
      expect(filtered.length).toBe(2);
      expect(filtered.every(eq => eq.slot === 'weapon')).toBe(true);
    });

    it('按品质筛选', () => {
      const filter: BagFilter = { slot: null, rarity: 'gold', unequippedOnly: false, setOnly: false };
      const filtered = sys.filterEquipments(filter);
      expect(filtered.length).toBe(1);
      expect(filtered[0].rarity).toBe('gold');
    });

    it('只看未穿戴', () => {
      // 标记一件为已穿戴
      const all = sys.getAllEquipments();
      sys.markEquipped(all[0].uid, 'hero1');

      const filter: BagFilter = { slot: null, rarity: null, unequippedOnly: true, setOnly: false };
      const filtered = sys.filterEquipments(filter);
      expect(filtered.length).toBe(4);
      expect(filtered.every(eq => !eq.isEquipped)).toBe(true);
    });

    it('无筛选条件返回全部', () => {
      const filter: BagFilter = { slot: null, rarity: null, unequippedOnly: false, setOnly: false };
      const filtered = sys.filterEquipments(filter);
      expect(filtered.length).toBe(5);
    });
  });

  describe('分组', () => {
    it('groupBySlot 正确分组', () => {
      addRandomEquipment(sys, 'weapon', 'white', 1);
      addRandomEquipment(sys, 'weapon', 'green', 2);
      addRandomEquipment(sys, 'armor', 'blue', 3);
      addRandomEquipment(sys, 'mount', 'purple', 4);

      const groups = sys.groupBySlot();
      expect(groups.weapon.length).toBe(2);
      expect(groups.armor.length).toBe(1);
      expect(groups.accessory.length).toBe(0);
      expect(groups.mount.length).toBe(1);
    });
  });

  describe('穿戴标记', () => {
    it('markEquipped 标记装备为已穿戴', () => {
      const eq = addRandomEquipment(sys);
      const result = sys.markEquipped(eq.uid, 'hero_zhaoyun');
      expect(result.success).toBe(true);
      expect(eq.isEquipped).toBe(true);
      expect(eq.equippedHeroId).toBe('hero_zhaoyun');
    });

    it('markEquipped 不存在的装备返回失败', () => {
      const result = sys.markEquipped('nonexistent', 'hero1');
      expect(result.success).toBe(false);
    });

    it('markEquipped 已穿戴的装备返回失败', () => {
      const eq = addRandomEquipment(sys);
      sys.markEquipped(eq.uid, 'hero1');
      const result = sys.markEquipped(eq.uid, 'hero2');
      expect(result.success).toBe(false);
    });

    it('markUnequipped 卸下装备', () => {
      const eq = addRandomEquipment(sys);
      sys.markEquipped(eq.uid, 'hero1');
      const result = sys.markUnequipped(eq.uid);
      expect(result.success).toBe(true);
      expect(eq.isEquipped).toBe(false);
      expect(eq.equippedHeroId).toBeNull();
    });

    it('markUnequipped 未穿戴的装备返回失败', () => {
      const eq = addRandomEquipment(sys);
      const result = sys.markUnequipped(eq.uid);
      expect(result.success).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════
// 5. 装备分解
// ═══════════════════════════════════════════════════
describe('EquipmentSystem — 装备分解', () => {
  let sys: EquipmentSystem;
  beforeEach(() => {
    sys = createSystem();
  });

  describe('产出计算', () => {
    it('白色装备分解产出正确', () => {
      const eq = sys.generateEquipment('weapon', 'white', 'campaign_drop', 42);
      const reward = sys.calculateDecomposeReward(eq);
      expect(reward.copper).toBe(DECOMPOSE_COPPER_BASE.white);
      expect(reward.enhanceStone).toBe(DECOMPOSE_STONE_BASE.white);
    });

    it('金色装备分解产出更高', () => {
      const eq = sys.generateEquipment('weapon', 'gold', 'campaign_drop', 42);
      const reward = sys.calculateDecomposeReward(eq);
      expect(reward.copper).toBe(DECOMPOSE_COPPER_BASE.gold);
      expect(reward.enhanceStone).toBe(DECOMPOSE_STONE_BASE.gold);
    });

    it('强化等级越高分解产出越多', () => {
      const eq0 = sys.generateEquipment('weapon', 'blue', 'campaign_drop', 42);
      const eq5 = sys.generateEquipment('weapon', 'blue', 'campaign_drop', 42);
      eq5.enhanceLevel = 5;

      const reward0 = sys.calculateDecomposeReward(eq0);
      const reward5 = sys.calculateDecomposeReward(eq5);

      expect(reward5.copper).toBeGreaterThan(reward0.copper);
      expect(reward5.enhanceStone).toBeGreaterThan(reward0.enhanceStone);
    });

    it('强化产出公式正确', () => {
      const eq = sys.generateEquipment('weapon', 'purple', 'campaign_drop', 42);
      eq.enhanceLevel = 5;
      const reward = sys.calculateDecomposeReward(eq);
      const expectedCopper = Math.floor(DECOMPOSE_COPPER_BASE.purple * (1 + 5 * DECOMPOSE_ENHANCE_BONUS));
      const expectedStone = Math.floor(DECOMPOSE_STONE_BASE.purple * (1 + 5 * DECOMPOSE_ENHANCE_BONUS));
      expect(reward.copper).toBe(expectedCopper);
      expect(reward.enhanceStone).toBe(expectedStone);
    });
  });

  describe('单件分解', () => {
    it('应成功分解未穿戴装备', () => {
      const eq = addRandomEquipment(sys);
      const { result, success } = sys.decompose(eq.uid);
      expect(success).toBe(true);
      expect(result.copper).toBeGreaterThan(0);
      expect(sys.getBagUsedCount()).toBe(0);
    });

    it('分解后装备从背包移除', () => {
      const eq = addRandomEquipment(sys);
      sys.decompose(eq.uid);
      expect(sys.getEquipment(eq.uid)).toBeUndefined();
    });

    it('分解触发 equipment:decomposed 事件', () => {
      const eq = addRandomEquipment(sys);
      sys.decompose(eq.uid);
      const mockEventBus = (sys as any).deps.eventBus;
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'equipment:decomposed',
        expect.objectContaining({
          uid: eq.uid,
          reward: expect.objectContaining({ copper: expect.any(Number) }),
        }),
      );
    });

    it('不能分解不存在的装备', () => {
      const { success, reason } = sys.decompose('nonexistent');
      expect(success).toBe(false);
      expect(reason).toContain('装备不存在');
    });

    it('不能分解已穿戴的装备', () => {
      const eq = addRandomEquipment(sys);
      sys.markEquipped(eq.uid, 'hero1');
      const { success, reason } = sys.decompose(eq.uid);
      expect(success).toBe(false);
      expect(reason).toContain('已穿戴');
    });
  });

  describe('批量分解', () => {
    it('应批量分解多件装备', () => {
      const eq1 = addRandomEquipment(sys, 'weapon', 'white', 1);
      const eq2 = addRandomEquipment(sys, 'armor', 'green', 2);
      const eq3 = addRandomEquipment(sys, 'accessory', 'blue', 3);

      const result = sys.batchDecompose([eq1.uid, eq2.uid, eq3.uid]);
      expect(result.decomposedUids).toHaveLength(3);
      expect(result.skippedUids).toHaveLength(0);
      expect(result.total.copper).toBeGreaterThan(0);
      expect(result.total.enhanceStone).toBeGreaterThan(0);
      expect(sys.getBagUsedCount()).toBe(0);
    });

    it('应跳过已穿戴的装备', () => {
      const eq1 = addRandomEquipment(sys, 'weapon', 'white', 1);
      const eq2 = addRandomEquipment(sys, 'armor', 'green', 2);
      sys.markEquipped(eq1.uid, 'hero1');

      const result = sys.batchDecompose([eq1.uid, eq2.uid]);
      expect(result.decomposedUids).toHaveLength(1);
      expect(result.decomposedUids).toContain(eq2.uid);
      expect(result.skippedUids).toHaveLength(1);
      expect(result.skippedUids).toContain(eq1.uid);
    });

    it('应跳过不存在的UID', () => {
      const result = sys.batchDecompose(['nonexistent1', 'nonexistent2']);
      expect(result.decomposedUids).toHaveLength(0);
      expect(result.skippedUids).toHaveLength(2);
      expect(result.total.copper).toBe(0);
    });
  });

  describe('全部分解', () => {
    it('decomposeAllUnequipped 分解所有未穿戴装备', () => {
      const eq1 = addRandomEquipment(sys, 'weapon', 'white', 1);
      addRandomEquipment(sys, 'armor', 'green', 2);
      addRandomEquipment(sys, 'accessory', 'blue', 3);

      // 标记一件为已穿戴
      sys.markEquipped(eq1.uid, 'hero1');

      const result = sys.decomposeAllUnequipped();
      expect(result.decomposedUids).toHaveLength(2);
      expect(result.skippedUids).toHaveLength(0); // 已穿戴的不在uid列表中
      expect(sys.getBagUsedCount()).toBe(1); // 剩下已穿戴的
    });
  });
});

// ═══════════════════════════════════════════════════
// 6. 序列化
// ═══════════════════════════════════════════════════
describe('EquipmentSystem — 序列化', () => {
  let sys: EquipmentSystem;
  beforeEach(() => {
    sys = createSystem();
  });

  it('serialize/deserialize 往返一致', () => {
    addRandomEquipment(sys, 'weapon', 'white', 1);
    addRandomEquipment(sys, 'armor', 'gold', 2);
    sys.expandBag();

    const data = sys.serialize();
    expect(data.equipments).toHaveLength(2);
    expect(data.bagCapacity).toBe(DEFAULT_BAG_CAPACITY + BAG_EXPAND_INCREMENT);

    const sys2 = createSystem();
    sys2.deserialize(data);
    expect(sys2.getBagUsedCount()).toBe(2);
    expect(sys2.getBagCapacity()).toBe(DEFAULT_BAG_CAPACITY + BAG_EXPAND_INCREMENT);
  });

  it('deserialize 版本不匹配时仍恢复数据', () => {
    const data = {
      version: 99,
      equipments: [],
      bagCapacity: 100,
    };
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    sys.deserialize(data as any);
    expect(sys.getBagCapacity()).toBe(100);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('reset 恢复初始状态', () => {
    addRandomEquipment(sys, 'weapon', 'gold', 1);
    sys.expandBag();
    sys.reset();
    expect(sys.getBagUsedCount()).toBe(0);
    expect(sys.getBagCapacity()).toBe(DEFAULT_BAG_CAPACITY);
  });
});

// ═══════════════════════════════════════════════════
// 7. ISubsystem 接口
// ═══════════════════════════════════════════════════
describe('EquipmentSystem — ISubsystem 接口', () => {
  let sys: EquipmentSystem;
  beforeEach(() => {
    sys = createSystem();
  });

  it('name 为 equipment', () => {
    expect(sys.name).toBe('equipment');
  });

  it('update 不抛异常', () => {
    expect(() => sys.update(16)).not.toThrow();
  });

  it('getState 返回正确结构', () => {
    addRandomEquipment(sys);
    const state = sys.getState();
    expect(state).toHaveProperty('equipments');
    expect(state).toHaveProperty('bagCapacity');
    expect(state.equipments).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════
// 8. 边界条件
// ═══════════════════════════════════════════════════
describe('EquipmentSystem — 边界条件', () => {
  let sys: EquipmentSystem;
  beforeEach(() => {
    sys = createSystem();
  });

  it('空背包操作不崩溃', () => {
    expect(sys.getAllEquipments()).toHaveLength(0);
    expect(sys.sortEquipments('rarity_desc')).toHaveLength(0);
    expect(sys.filterEquipments({ slot: null, rarity: null, unequippedOnly: false, setOnly: false })).toHaveLength(0);
    expect(sys.groupBySlot()).toBeDefined();
  });

  it('未初始化时不崩溃', () => {
    resetUidCounter();
    const raw = new EquipmentSystem();
    expect(() => raw.generateEquipment('weapon', 'white', 'campaign_drop', 42)).not.toThrow();
    expect(() => raw.addToBag(raw.generateEquipment('weapon', 'white', 'campaign_drop', 43))).not.toThrow();
  });

  it('所有品质都可以生成所有部位的装备', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      for (const rarity of EQUIPMENT_RARITIES) {
        const eq = sys.generateEquipment(slot, rarity, 'campaign_drop', 42);
        expect(eq.slot).toBe(slot);
        expect(eq.rarity).toBe(rarity);
      }
    }
  });

  it('大量装备生成不崩溃', () => {
    for (let i = 0; i < 200; i++) {
      const eq = sys.generateEquipment(
        EQUIPMENT_SLOTS[i % 4],
        EQUIPMENT_RARITIES[i % 5],
        'campaign_drop',
        i,
      );
      sys.addToBag(eq);
    }
    expect(sys.getBagUsedCount()).toBe(DEFAULT_BAG_CAPACITY);
  });
});
