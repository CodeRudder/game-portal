/**
 * EquipmentBagManager 单元测试
 *
 * 覆盖：背包CRUD、排序、筛选、分组、扩容、边界条件
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EquipmentBagManager } from '../EquipmentBagManager';
import type { EquipmentInstance, BagFilter, BagSortMode } from '../../../core/equipment';
import {
  EQUIPMENT_SLOTS,
  RARITY_ORDER,
  DEFAULT_BAG_CAPACITY,
  MAX_BAG_CAPACITY,
  BAG_EXPAND_INCREMENT,
} from '../../../core/equipment';

// ── 测试辅助 ──

function createBag(): EquipmentBagManager {
  return new EquipmentBagManager(
    () => {},
    () => undefined,
  );
}

function makeEquipment(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    uid: `eq_test_${Math.random().toString(36).slice(2, 8)}`,
    templateId: 'tpl_weapon_white',
    name: '测试剑',
    slot: 'weapon',
    rarity: 'white',
    enhanceLevel: 0,
    mainStat: { type: 'attack', baseValue: 10, value: 10 },
    subStats: [],
    specialEffect: null,
    source: 'campaign_drop',
    acquiredAt: Date.now(),
    isEquipped: false,
    equippedHeroId: null,
    seed: 42,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════

describe('EquipmentBagManager — CRUD', () => {
  let bag: EquipmentBagManager;

  beforeEach(() => {
    bag = createBag();
  });

  describe('add', () => {
    it('应成功添加装备', () => {
      const eq = makeEquipment();
      const result = bag.add(eq);
      expect(result.success).toBe(true);
      expect(bag.get(eq.uid)).toBe(eq);
    });

    it('重复添加同一 uid 应幂等成功', () => {
      const eq = makeEquipment();
      expect(bag.add(eq).success).toBe(true);
      expect(bag.add(eq).success).toBe(true);
      expect(bag.getUsedCount()).toBe(1);
    });

    it('背包满时应拒绝添加', () => {
      // 创建一个容量极小的背包
      const smallBag = createBag();
      smallBag.setCapacity(2);
      smallBag.add(makeEquipment({ uid: 'eq_1' }));
      smallBag.add(makeEquipment({ uid: 'eq_2' }));
      const result = smallBag.add(makeEquipment({ uid: 'eq_3' }));
      expect(result.success).toBe(false);
      expect(result.reason).toBe('背包已满');
    });

    it('应触发 equipment:added 事件', () => {
      const emitFn = vi.fn();
      const eventBag = new EquipmentBagManager(emitFn, () => undefined);
      const eq = makeEquipment({ uid: 'eq_event' });
      eventBag.add(eq);
      expect(emitFn).toHaveBeenCalledWith('equipment:added', { uid: 'eq_event' });
    });
  });

  describe('get', () => {
    it('存在的 uid 应返回装备', () => {
      const eq = makeEquipment({ uid: 'eq_get' });
      bag.add(eq);
      expect(bag.get('eq_get')).toBe(eq);
    });

    it('不存在的 uid 应返回 undefined', () => {
      expect(bag.get('nonexistent')).toBeUndefined();
    });
  });

  describe('remove / removeFromBag', () => {
    it('应成功移除未穿戴装备', () => {
      const eq = makeEquipment({ uid: 'eq_rm' });
      bag.add(eq);
      const result = bag.removeFromBag('eq_rm');
      expect(result.success).toBe(true);
      expect(bag.get('eq_rm')).toBeUndefined();
    });

    it('remove 方法应返回 boolean', () => {
      const eq = makeEquipment({ uid: 'eq_rm2' });
      bag.add(eq);
      expect(bag.remove('eq_rm2')).toBe(true);
      expect(bag.remove('nonexistent')).toBe(false);
    });

    it('已穿戴装备不可移除', () => {
      const eq = makeEquipment({ uid: 'eq_worn', isEquipped: true, equippedHeroId: 'hero1' });
      bag.add(eq);
      const result = bag.removeFromBag('eq_worn');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('已穿戴装备不可移除');
    });

    it('不存在的 uid 应返回失败', () => {
      const result = bag.removeFromBag('ghost');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('装备不存在');
    });

    it('应触发 equipment:removed 事件', () => {
      const emitFn = vi.fn();
      const eventBag = new EquipmentBagManager(emitFn, () => undefined);
      const eq = makeEquipment({ uid: 'eq_ev_rm' });
      eventBag.add(eq);
      emitFn.mockClear();
      eventBag.removeFromBag('eq_ev_rm');
      expect(emitFn).toHaveBeenCalledWith('equipment:removed', { uid: 'eq_ev_rm' });
    });
  });

  describe('update', () => {
    it('应更新已存在的装备', () => {
      const eq = makeEquipment({ uid: 'eq_upd', enhanceLevel: 0 });
      bag.add(eq);
      const updated = { ...eq, enhanceLevel: 5 };
      bag.update(updated);
      expect(bag.get('eq_upd')!.enhanceLevel).toBe(5);
    });

    it('更新不存在的装备应静默忽略', () => {
      const eq = makeEquipment({ uid: 'eq_noexist' });
      expect(() => bag.update(eq)).not.toThrow();
    });
  });

  describe('getAll / getUsedCount / getSize', () => {
    it('getAll 应返回所有装备', () => {
      const eq1 = makeEquipment({ uid: 'eq_a1' });
      const eq2 = makeEquipment({ uid: 'eq_a2' });
      bag.add(eq1);
      bag.add(eq2);
      const all = bag.getAll();
      expect(all).toHaveLength(2);
      expect(all.map(e => e.uid)).toEqual(expect.arrayContaining(['eq_a1', 'eq_a2']));
    });

    it('getUsedCount 和 getSize 应返回相同值', () => {
      bag.add(makeEquipment({ uid: 'eq_c1' }));
      bag.add(makeEquipment({ uid: 'eq_c2' }));
      bag.add(makeEquipment({ uid: 'eq_c3' }));
      expect(bag.getUsedCount()).toBe(3);
      expect(bag.getSize()).toBe(3);
    });
  });

  describe('getCapacity / isFull', () => {
    it('默认容量应为 DEFAULT_BAG_CAPACITY', () => {
      expect(bag.getCapacity()).toBe(DEFAULT_BAG_CAPACITY);
    });

    it('isFull 在未满时应返回 false', () => {
      expect(bag.isFull()).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════
// 扩容
// ═══════════════════════════════════════════════════

describe('EquipmentBagManager — 扩容', () => {
  it('应成功扩容', () => {
    const bag = createBag();
    const original = bag.getCapacity();
    const result = bag.expand();
    expect(result.success).toBe(true);
    expect(bag.getCapacity()).toBe(Math.min(original + BAG_EXPAND_INCREMENT, MAX_BAG_CAPACITY));
  });

  it('达到最大容量后不可再扩', () => {
    const bag = createBag();
    bag.setCapacity(MAX_BAG_CAPACITY);
    const result = bag.expand();
    expect(result.success).toBe(false);
    expect(result.reason).toBe('已达最大容量');
  });

  it('扩容应触发两个事件', () => {
    const emitFn = vi.fn();
    const bag = new EquipmentBagManager(emitFn, () => undefined);
    bag.expand();
    expect(emitFn).toHaveBeenCalledWith('equipment:bag_expand_cost', expect.objectContaining({ cost: expect.any(Number) }));
    expect(emitFn).toHaveBeenCalledWith('equipment:bag_expanded', expect.objectContaining({ capacity: expect.any(Number) }));
  });
});

// ═══════════════════════════════════════════════════
// 排序
// ═══════════════════════════════════════════════════

describe('EquipmentBagManager — 排序', () => {
  let bag: EquipmentBagManager;

  beforeEach(() => {
    bag = createBag();
    bag.add(makeEquipment({ uid: 'eq_w', rarity: 'white', enhanceLevel: 1, slot: 'weapon', acquiredAt: 100 }));
    bag.add(makeEquipment({ uid: 'eq_g', rarity: 'gold', enhanceLevel: 10, slot: 'mount', acquiredAt: 300 }));
    bag.add(makeEquipment({ uid: 'eq_b', rarity: 'blue', enhanceLevel: 5, slot: 'armor', acquiredAt: 200 }));
  });

  it('rarity_desc 应按品质降序排列', () => {
    const sorted = bag.sort('rarity_desc');
    expect(sorted[0].uid).toBe('eq_g');   // gold=5
    expect(sorted[1].uid).toBe('eq_b');   // blue=3
    expect(sorted[2].uid).toBe('eq_w');   // white=1
  });

  it('rarity_asc 应按品质升序排列', () => {
    const sorted = bag.sort('rarity_asc');
    expect(sorted[0].uid).toBe('eq_w');
    expect(sorted[2].uid).toBe('eq_g');
  });

  it('level_desc 应按强化等级降序', () => {
    const sorted = bag.sort('level_desc');
    expect(sorted[0].enhanceLevel).toBe(10);
    expect(sorted[2].enhanceLevel).toBe(1);
  });

  it('level_asc 应按强化等级升序', () => {
    const sorted = bag.sort('level_asc');
    expect(sorted[0].enhanceLevel).toBe(1);
  });

  it('slot_type 应按部位顺序', () => {
    const sorted = bag.sort('slot_type');
    expect(sorted[0].slot).toBe('weapon');
    expect(sorted[1].slot).toBe('armor');
    expect(sorted[2].slot).toBe('mount');
  });

  it('acquired_time 应按获取时间排序', () => {
    const sorted = bag.sort('acquired_time');
    expect(sorted[0].acquiredAt).toBe(100);
    expect(sorted[2].acquiredAt).toBe(300);
  });

  it('排序不应修改原数组', () => {
    const before = bag.getAll().map(e => e.uid);
    bag.sort('rarity_desc');
    const after = bag.getAll().map(e => e.uid);
    expect(before).toEqual(after);
  });

  it('传入自定义列表时应正确排序', () => {
    const customList = [
      makeEquipment({ uid: 'a', rarity: 'purple' }),
      makeEquipment({ uid: 'b', rarity: 'white' }),
    ];
    const sorted = bag.sort('rarity_desc', customList);
    expect(sorted[0].uid).toBe('a');
    expect(sorted[1].uid).toBe('b');
  });
});

// ═══════════════════════════════════════════════════
// 筛选
// ═══════════════════════════════════════════════════

describe('EquipmentBagManager — 筛选', () => {
  let bag: EquipmentBagManager;

  beforeEach(() => {
    bag = createBag();
    bag.add(makeEquipment({ uid: 'eq_w1', slot: 'weapon', rarity: 'white', isEquipped: false, templateId: 'sword_iron' }));
    bag.add(makeEquipment({ uid: 'eq_a1', slot: 'armor', rarity: 'blue', isEquipped: true, equippedHeroId: 'h1', templateId: 'armor_leather' }));
    bag.add(makeEquipment({ uid: 'eq_m1', slot: 'mount', rarity: 'gold', isEquipped: false, templateId: 'mount_redhare' }));
  });

  it('按部位筛选', () => {
    const result = bag.filter({ slot: 'weapon', rarity: null, unequippedOnly: false, setOnly: false });
    expect(result).toHaveLength(1);
    expect(result[0].uid).toBe('eq_w1');
  });

  it('按品质筛选', () => {
    const result = bag.filter({ slot: null, rarity: 'gold', unequippedOnly: false, setOnly: false });
    expect(result).toHaveLength(1);
    expect(result[0].uid).toBe('eq_m1');
  });

  it('只看未穿戴', () => {
    const result = bag.filter({ slot: null, rarity: null, unequippedOnly: true, setOnly: false });
    expect(result).toHaveLength(2);
    expect(result.every(e => !e.isEquipped)).toBe(true);
  });

  it('只看套装（有 setId 的模板）', () => {
    const getTemplate = (id: string) => {
      const map: Record<string, { setId?: string }> = {
        sword_iron: { setId: 'warrior' },
        armor_leather: { setId: 'guardian' },
        mount_redhare: { setId: 'overlord' },
      };
      return map[id];
    };
    const setBag = new EquipmentBagManager(() => {}, getTemplate);
    setBag.add(makeEquipment({ uid: 'eq_w1', templateId: 'sword_iron' }));
    setBag.add(makeEquipment({ uid: 'eq_a1', templateId: 'armor_leather' }));
    setBag.add(makeEquipment({ uid: 'eq_m1', templateId: 'mount_redhare' }));
    setBag.add(makeEquipment({ uid: 'eq_no_set', templateId: 'unknown' }));

    const result = setBag.filter({ slot: null, rarity: null, unequippedOnly: false, setOnly: true });
    expect(result).toHaveLength(3);
  });

  it('无筛选条件应返回全部', () => {
    const result = bag.filter({ slot: null, rarity: null, unequippedOnly: false, setOnly: false });
    expect(result).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════
// 分组
// ═══════════════════════════════════════════════════

describe('EquipmentBagManager — groupBySlot', () => {
  it('应按部位正确分组', () => {
    const bag = createBag();
    bag.add(makeEquipment({ uid: 'eq_w1', slot: 'weapon' }));
    bag.add(makeEquipment({ uid: 'eq_w2', slot: 'weapon' }));
    bag.add(makeEquipment({ uid: 'eq_a1', slot: 'armor' }));

    const groups = bag.groupBySlot();
    expect(groups.weapon).toHaveLength(2);
    expect(groups.armor).toHaveLength(1);
    expect(groups.accessory).toHaveLength(0);
    expect(groups.mount).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════
// 重置
// ═══════════════════════════════════════════════════

describe('EquipmentBagManager — reset', () => {
  it('应清空背包并恢复默认容量', () => {
    const bag = createBag();
    bag.add(makeEquipment({ uid: 'eq_r1' }));
    bag.setCapacity(100);
    bag.reset();
    expect(bag.getUsedCount()).toBe(0);
    expect(bag.getCapacity()).toBe(DEFAULT_BAG_CAPACITY);
  });
});
