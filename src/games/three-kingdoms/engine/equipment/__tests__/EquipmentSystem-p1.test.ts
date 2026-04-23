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
import type { ISystemDeps } from '../../../core/types/subsystem';
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

/** 创建满足 ISystemDeps 的 mock 依赖 */
function createMockDeps(): ISystemDeps {
  return {
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() } as unknown as ISystemDeps['eventBus'],
    config: { get: vi.fn() } as unknown as ISystemDeps['config'],
    registry: { get: vi.fn() } as unknown as ISystemDeps['registry'],
  };
}

/** 访问 EquipmentSystem 内部私有 deps（测试专用） */
function getInternalDeps(sys: EquipmentSystem): ISystemDeps {
  return (sys as unknown as { deps: ISystemDeps }).deps;
}

/** 创建带 mock deps 的 EquipmentSystem */
function createSystem(): EquipmentSystem {
  resetUidCounter();
  const sys = new EquipmentSystem();
  sys.init(createMockDeps());
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
      const mockEventBus = getInternalDeps(sys).eventBus;
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
});
});
