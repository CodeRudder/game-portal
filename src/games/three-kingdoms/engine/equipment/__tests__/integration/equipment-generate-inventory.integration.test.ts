/**
 * 集成测试 — 装备生成 & 背包管理
 *
 * 覆盖：EquipmentSystem + EquipmentBagManager + EquipmentGenerator 的交互
 * 验证：生成→入袋→排序→筛选→扩容→序列化 完整链路
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EquipmentSystem } from '../../EquipmentSystem';
import type {
  EquipmentSlot,
  EquipmentRarity,
  EquipmentInstance,
  BagFilter,
} from '../../../../core/equipment';
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_RARITIES,
  RARITY_ORDER,
  DEFAULT_BAG_CAPACITY,
  MAX_BAG_CAPACITY,
  BAG_EXPAND_INCREMENT,
} from '../../../../core/equipment';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function createSystem(): EquipmentSystem {
  const sys = new EquipmentSystem();
  sys.init({ eventBus: { emit: () => {} } } as unknown as Record<string, unknown>);
  return sys;
}

/** 批量生成并返回 uid[] */
function generateBatch(sys: EquipmentSystem, count: number, seedBase = 100): string[] {
  const uids: string[] = [];
  for (let i = 0; i < count; i++) {
    const slot = EQUIPMENT_SLOTS[i % EQUIPMENT_SLOTS.length];
    const rarity = EQUIPMENT_RARITIES[i % EQUIPMENT_RARITIES.length];
    const eq = sys.generateEquipment(slot, rarity, 'campaign_drop', seedBase + i);
    if (eq) uids.push(eq.uid);
  }
  return uids;
}

// ═══════════════════════════════════════════════
// §1 装备生成
// ═══════════════════════════════════════════════

describe('§1 装备生成集成', () => {
  let sys: EquipmentSystem;

  beforeEach(() => { sys = createSystem(); });

  it('§1.1 按部位+品质生成装备并自动入袋', () => {
    const eq = sys.generateEquipment('weapon', 'blue', 'campaign_drop', 42);
    expect(eq).not.toBeNull();
    expect(eq!.slot).toBe('weapon');
    expect(eq!.rarity).toBe('blue');
    expect(eq!.source).toBe('campaign_drop');
    expect(sys.getEquipment(eq!.uid)).toBeDefined();
  });

  it('§1.2 同种子生成结果一致', () => {
    const a = sys.generateEquipment('armor', 'purple', 'forge', 999);
    sys.reset();
    const b = sys.generateEquipment('armor', 'purple', 'forge', 999);
    // 种子一致 → 属性一致（uid 不同因为时间戳）
    expect(a!.mainStat.baseValue).toBe(b!.mainStat.baseValue);
    expect(a!.subStats.length).toBe(b!.subStats.length);
  });

  it('§1.3 不同品质属性倍率递增', () => {
    const white = sys.generateEquipment('weapon', 'white', 'campaign_drop', 10);
    sys.reset();
    const gold = sys.generateEquipment('weapon', 'gold', 'campaign_drop', 10);
    expect(gold!.mainStat.value).toBeGreaterThan(white!.mainStat.value);
  });

  it('§1.4 generateCampaignDrop 按关卡权重生成', () => {
    const eq = sys.generateCampaignDrop('boss', 777);
    expect(eq).toBeDefined();
    expect(EQUIPMENT_SLOTS).toContain(eq.slot);
    expect(EQUIPMENT_RARITIES).toContain(eq.rarity);
    expect(eq.source).toBe('campaign_drop');
  });

  it('§1.5 generateFromSource 按来源权重生成', () => {
    const eq = sys.generateFromSource('event', 888);
    expect(eq).toBeDefined();
    expect(eq.source).toBe('event');
  });

  it('§1.6 无效模板返回 null', () => {
    const eq = sys.generateEquipment('nonexistent_tpl', 'white');
    expect(eq).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// §2 背包 CRUD
// ═══════════════════════════════════════════════

describe('§2 背包CRUD集成', () => {
  let sys: EquipmentSystem;

  beforeEach(() => { sys = createSystem(); });

  it('§2.1 添加装备后 getBagUsedCount 递增', () => {
    expect(sys.getBagUsedCount()).toBe(0);
    sys.generateEquipment('weapon', 'white', 'campaign_drop', 1);
    expect(sys.getBagUsedCount()).toBe(1);
  });

  it('§2.2 重复添加同 uid 幂等成功', () => {
    const eq = sys.generateEquipment('armor', 'green', 'campaign_drop', 5)!;
    const before = sys.getBagUsedCount();
    const result = sys.addToBag(eq);
    expect(result.success).toBe(true);
    expect(sys.getBagUsedCount()).toBe(before);
  });

  it('§2.3 删除未穿戴装备成功', () => {
    const eq = sys.generateEquipment('mount', 'blue', 'campaign_drop', 10)!;
    expect(sys.removeEquipment(eq.uid)).toBe(true);
    expect(sys.getEquipment(eq.uid)).toBeUndefined();
  });

  it('§2.4 已穿戴装备不可删除', () => {
    const eq = sys.generateEquipment('weapon', 'purple', 'campaign_drop', 20)!;
    sys.equipItem('hero1', eq.uid);
    expect(sys.removeFromBag(eq.uid).success).toBe(false);
  });

  it('§2.5 删除不存在 uid 返回 false', () => {
    expect(sys.removeEquipment('fake_uid')).toBe(false);
  });

  it('§2.6 updateEquipment 更新已存在装备', () => {
    const eq = sys.generateEquipment('accessory', 'gold', 'campaign_drop', 30)!;
    const modified = { ...eq, enhanceLevel: 5 };
    sys.updateEquipment(modified);
    expect(sys.getEquipment(eq.uid)!.enhanceLevel).toBe(5);
  });
});

// ═══════════════════════════════════════════════
// §3 背包容量 & 扩容
// ═══════════════════════════════════════════════

describe('§3 背包容量与扩容', () => {
  let sys: EquipmentSystem;

  beforeEach(() => { sys = createSystem(); });

  it('§3.1 初始容量为 DEFAULT_BAG_CAPACITY', () => {
    expect(sys.getBagCapacity()).toBe(DEFAULT_BAG_CAPACITY);
  });

  it('§3.2 背包满时添加失败', () => {
    // 填满背包
    for (let i = 0; i < DEFAULT_BAG_CAPACITY; i++) {
      sys.generateEquipment('weapon', 'white', 'campaign_drop', i * 7);
    }
    expect(sys.isBagFull()).toBe(true);
    const result = sys.addToBag({ uid: 'overflow' } as EquipmentInstance);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('背包已满');
  });

  it('§3.3 expandBag 增加容量', () => {
    const before = sys.getBagCapacity();
    const result = sys.expandBag();
    expect(result.success).toBe(true);
    expect(sys.getBagCapacity()).toBe(before + BAG_EXPAND_INCREMENT);
  });

  it('§3.4 扩容不超过 MAX_BAG_CAPACITY', () => {
    // 强制设到上限
    for (let i = 0; i < 30; i++) sys.expandBag();
    expect(sys.getBagCapacity()).toBeLessThanOrEqual(MAX_BAG_CAPACITY);
    const result = sys.expandBag();
    expect(result.success).toBe(false);
    expect(result.reason).toBe('已达最大容量');
  });
});

// ═══════════════════════════════════════════════
// §4 排序 & 筛选
// ═══════════════════════════════════════════════

describe('§4 排序与筛选集成', () => {
  let sys: EquipmentSystem;

  beforeEach(() => { sys = createSystem(); });

  it('§4.1 品质降序排列', () => {
    generateBatch(sys, 5, 200);
    const sorted = sys.getSortedEquipments('rarity_desc');
    for (let i = 1; i < sorted.length; i++) {
      expect(RARITY_ORDER[sorted[i - 1].rarity]).toBeGreaterThanOrEqual(RARITY_ORDER[sorted[i].rarity]);
    }
  });

  it('§4.2 强化等级升序排列', () => {
    const uids = generateBatch(sys, 3, 300);
    // 手动设置不同强化等级
    sys.updateEquipment({ ...sys.getEquipment(uids[0])!, enhanceLevel: 5 });
    sys.updateEquipment({ ...sys.getEquipment(uids[1])!, enhanceLevel: 1 });
    sys.updateEquipment({ ...sys.getEquipment(uids[2])!, enhanceLevel: 10 });
    const sorted = sys.getSortedEquipments('level_asc');
    expect(sorted[0].enhanceLevel).toBeLessThanOrEqual(sorted[1].enhanceLevel);
    expect(sorted[1].enhanceLevel).toBeLessThanOrEqual(sorted[2].enhanceLevel);
  });

  it('§4.3 按部位类型排序', () => {
    generateBatch(sys, 8, 400);
    const sorted = sys.getSortedEquipments('slot_type');
    for (let i = 1; i < sorted.length; i++) {
      const prev = EQUIPMENT_SLOTS.indexOf(sorted[i - 1].slot);
      const curr = EQUIPMENT_SLOTS.indexOf(sorted[i].slot);
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });

  it('§4.4 筛选指定部位', () => {
    generateBatch(sys, 8, 500);
    const weapons = sys.getFilteredEquipments({ slot: 'weapon' });
    expect(weapons.every(e => e.slot === 'weapon')).toBe(true);
  });

  it('§4.5 筛选未穿戴装备', () => {
    const uids = generateBatch(sys, 4, 600);
    sys.equipItem('hero1', uids[0]);
    const unequipped = sys.getFilteredEquipments({ unequippedOnly: true });
    expect(unequipped.every(e => !e.isEquipped)).toBe(true);
    expect(unequipped.length).toBe(3);
  });

  it('§4.6 groupBySlot 分组正确', () => {
    generateBatch(sys, 8, 700);
    const groups = sys.groupBySlot();
    const all = sys.getAllEquipments();
    const total = Object.values(groups).flat().length;
    expect(total).toBe(all.length);
  });
});

// ═══════════════════════════════════════════════
// §5 序列化 & 反序列化
// ═══════════════════════════════════════════════

describe('§5 序列化集成', () => {
  let sys: EquipmentSystem;

  beforeEach(() => { sys = createSystem(); });

  it('§5.1 serialize → deserialize 数据一致', () => {
    generateBatch(sys, 5, 800);
    const data = sys.serialize();

    const sys2 = createSystem();
    sys2.deserialize(data);
    expect(sys2.getBagUsedCount()).toBe(5);
    expect(sys2.getBagCapacity()).toBe(data.bagCapacity);
  });

  it('§5.2 序列化保留穿戴状态', () => {
    const eq = sys.generateEquipment('weapon', 'gold', 'campaign_drop', 900)!;
    sys.equipItem('hero1', eq.uid);
    const data = sys.serialize();

    const sys2 = createSystem();
    sys2.deserialize(data);
    const restored = sys2.getEquipment(eq.uid)!;
    expect(restored.isEquipped).toBe(true);
    expect(restored.equippedHeroId).toBe('hero1');
    expect(sys2.getHeroEquips('hero1').weapon).toBe(eq.uid);
  });

  it('§5.3 reset 清空所有数据', () => {
    generateBatch(sys, 3, 950);
    sys.equipItem('hero1', sys.getAllEquipments()[0].uid);
    sys.reset();
    expect(sys.getBagUsedCount()).toBe(0);
    expect(sys.getHeroEquips('hero1').weapon).toBeNull();
  });
});
