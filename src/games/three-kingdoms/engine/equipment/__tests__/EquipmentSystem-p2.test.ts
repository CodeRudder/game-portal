import { EquipmentSystem, resetUidCounter } from '../EquipmentSystem';
import type {
import {


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
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
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
