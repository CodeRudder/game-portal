/**
 * EquipmentSystem & DeitySystem — 综合单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  EquipmentSystem,
  type EquipDef,
  type EquipSlot,
  type EquipEvent,
} from '../modules/EquipmentSystem';
import {
  DeitySystem,
  type DeityDef,
  type DeityEvent,
} from '../modules/DeitySystem';

// ============================================================
// 测试数据：装备定义
// ============================================================

const SWORD_DEF: EquipDef = {
  id: 'sword1',
  name: '铁剑',
  rarity: 'common',
  slot: 'weapon',
  bonus: { atk: 10, critRate: 2 },
  effects: [],
  levelRequired: 1,
  description: '一把普通的铁剑',
  icon: 'sword',
};

const HELMET_DEF: EquipDef = {
  id: 'helm_fire',
  name: '炎龙头盔',
  rarity: 'epic',
  slot: 'helmet',
  bonus: { def: 20, hp: 100 },
  effects: ['fire_res'],
  levelRequired: 10,
  setId: 'dragon',
  description: '炎龙套装头盔',
  icon: 'helmet',
};

const ARMOR_DEF: EquipDef = {
  id: 'armor_dragon',
  name: '炎龙铠甲',
  rarity: 'epic',
  slot: 'armor',
  bonus: { def: 40, hp: 200 },
  effects: ['fire_res', 'burn_immune'],
  levelRequired: 10,
  setId: 'dragon',
  description: '炎龙套装铠甲',
  icon: 'armor',
};

const RING_DEF: EquipDef = {
  id: 'ring_luck',
  name: '幸运戒指',
  rarity: 'rare',
  slot: 'ring',
  bonus: { luck: 15 },
  effects: [],
  levelRequired: 5,
  description: '带来好运的戒指',
  icon: 'ring',
};

const ALL_EQUIP_DEFS = [SWORD_DEF, HELMET_DEF, ARMOR_DEF, RING_DEF];

// ============================================================
// 测试数据：神明定义
// ============================================================

const MARS_DEF: DeityDef = {
  id: 'mars',
  name: '战神',
  title: '战争之主',
  bonusType: 'multiplier',
  bonusValue: 0.1,
  bonusTarget: 'attack',
  blessingCosts: { gold: 100 },
  costScaling: 1.5,
  maxBlessingLevel: 5,
  bonusPerLevel: 0.05,
  mutuallyExclusive: ['athena'],
  unlockCondition: { level: 5 },
  lore: '战场上无往不胜的神明',
  icon: 'mars',
  domain: 'war',
};

const ATHENA_DEF: DeityDef = {
  id: 'athena',
  name: '雅典娜',
  title: '智慧女神',
  bonusType: 'flat',
  bonusValue: 50,
  bonusTarget: 'defense',
  blessingCosts: { gold: 120, wisdom: 10 },
  costScaling: 1.6,
  maxBlessingLevel: 5,
  bonusPerLevel: 20,
  mutuallyExclusive: ['mars'],
  requires: 'mars',
  unlockCondition: { level: 10 },
  lore: '智慧与策略之神',
  icon: 'athena',
  domain: 'wisdom',
};

const APOLLO_DEF: DeityDef = {
  id: 'apollo',
  name: '阿波罗',
  title: '太阳神',
  bonusType: 'chance',
  bonusValue: 0.05,
  bonusTarget: 'critChance',
  blessingCosts: { gold: 80 },
  costScaling: 1.4,
  maxBlessingLevel: 3,
  bonusPerLevel: 0.02,
  mutuallyExclusive: [],
  unlockCondition: { level: 3 },
  lore: '光明与预言之神',
  icon: 'apollo',
  domain: 'light',
};

const ALL_DEITY_DEFS = [MARS_DEF, ATHENA_DEF, APOLLO_DEF];

// ============================================================
// EquipmentSystem 测试
// ============================================================

describe('EquipmentSystem', () => {
  let system: EquipmentSystem<EquipDef>;

  beforeEach(() => {
    system = new EquipmentSystem(ALL_EQUIP_DEFS);
  });

  describe('addToInventory', () => {
    it('应成功创建装备实例并加入背包', () => {
      const inst = system.addToInventory('sword1');
      expect(inst.defId).toBe('sword1');
      expect(inst.enhanceLevel).toBe(0);
      expect(inst.extraBonus).toEqual({});
      expect(system.getInventory()).toHaveLength(1);
    });

    it('应支持传入额外加成', () => {
      const inst = system.addToInventory('sword1', { atk: 5 });
      expect(inst.extraBonus).toEqual({ atk: 5 });
    });

    it('不存在的定义应抛出错误', () => {
      expect(() => system.addToInventory('nonexistent')).toThrow(
        'Equipment definition not found: nonexistent',
      );
    });

    it('应触发 obtained 事件', () => {
      const events: EquipEvent[] = [];
      system.onEvent((e) => events.push(e));
      system.addToInventory('sword1');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('obtained');
    });
  });

  describe('equip / unequip', () => {
    it('应成功穿戴装备到对应槽位', () => {
      const inst = system.addToInventory('sword1');
      const result = system.equip(inst.instanceId);
      expect(result).toBe(true);
      expect(system.getEquipped().weapon).toBe(inst.instanceId);
      expect(system.getInventory()).toHaveLength(0);
    });

    it('穿戴不存在的实例应返回 false', () => {
      expect(system.equip('nonexistent')).toBe(false);
    });

    it('穿戴已装备的实例应返回 false（不在背包中）', () => {
      const inst = system.addToInventory('sword1');
      system.equip(inst.instanceId);
      expect(system.equip(inst.instanceId)).toBe(false);
    });

    it('穿戴时应自动替换同槽位旧装备', () => {
      const inst1 = system.addToInventory('sword1');
      system.equip(inst1.instanceId);

      // 创建另一个武器实例（使用同一个定义）
      const inst2 = system.addToInventory('sword1');
      system.equip(inst2.instanceId);

      const equipped = system.getEquipped();
      expect(equipped.weapon).toBe(inst2.instanceId);
      // 旧武器应回到背包
      const inv = system.getInventory();
      expect(inv).toHaveLength(1);
      expect(inv[0].instanceId).toBe(inst1.instanceId);
    });

    it('应成功卸下装备', () => {
      const inst = system.addToInventory('sword1');
      system.equip(inst.instanceId);

      const unequipped = system.unequip('weapon');
      expect(unequipped).not.toBeNull();
      expect(unequipped!.instanceId).toBe(inst.instanceId);
      expect(system.getEquipped().weapon).toBeUndefined();
      expect(system.getInventory()).toHaveLength(1);
    });

    it('卸下空槽位应返回 null', () => {
      expect(system.unequip('weapon')).toBeNull();
    });

    it('穿戴/卸下应触发相应事件', () => {
      const events: EquipEvent[] = [];
      system.onEvent((e) => events.push(e));

      const inst = system.addToInventory('sword1');
      system.equip(inst.instanceId);
      expect(events.find((e) => e.type === 'equipped')).toBeDefined();

      system.unequip('weapon');
      expect(events.find((e) => e.type === 'unequipped')).toBeDefined();
    });
  });

  describe('getBonus', () => {
    it('无装备时应返回空对象', () => {
      expect(system.getBonus()).toEqual({});
    });

    it('应正确汇总单件装备的基础加成', () => {
      const inst = system.addToInventory('sword1');
      system.equip(inst.instanceId);
      expect(system.getBonus()).toEqual({ atk: 10, critRate: 2 });
    });

    it('应正确汇总多件装备的加成', () => {
      system.addToInventory('sword1');
      const swordInst = system.getInventory()[0];
      system.equip(swordInst.instanceId);

      system.addToInventory('ring_luck');
      const ringInst = system.getInventory()[0];
      system.equip(ringInst.instanceId);

      const bonus = system.getBonus();
      expect(bonus).toEqual({ atk: 10, critRate: 2, luck: 15 });
    });

    it('应包含强化加成（基础 × 等级 × 10%）', () => {
      const inst = system.addToInventory('sword1');
      system.equip(inst.instanceId);

      // 强化到 +3
      system.enhance(inst.instanceId, { gold: 100 });
      system.enhance(inst.instanceId, { gold: 100 });
      system.enhance(inst.instanceId, { gold: 100 });

      const bonus = system.getBonus();
      // 基础 atk: 10, 强化加成: 10 * 3 * 0.1 = 3, 总计: 13
      expect(bonus.atk).toBe(13);
      // 基础 critRate: 2, 强化加成: 2 * 3 * 0.1 = 0.6, 总计: 2.6
      expect(bonus.critRate).toBeCloseTo(2.6);
    });

    it('应包含额外加成', () => {
      const inst = system.addToInventory('sword1', { atk: 7 });
      system.equip(inst.instanceId);
      const bonus = system.getBonus();
      expect(bonus.atk).toBe(17); // 10 + 7
    });
  });

  describe('enhance', () => {
    it('应成功强化装备', () => {
      const inst = system.addToInventory('sword1');
      const result = system.enhance(inst.instanceId, { gold: 100 });
      expect(result).toBe(true);
      expect(inst.enhanceLevel).toBe(1);
    });

    it('不存在的实例应返回 false', () => {
      expect(system.enhance('nonexistent', { gold: 100 })).toBe(false);
    });

    it('资源不足时应返回 false', () => {
      const inst = system.addToInventory('sword1');
      expect(system.enhance(inst.instanceId, { gold: 0 })).toBe(false);
      expect(system.enhance(inst.instanceId, { gold: -10 })).toBe(false);
    });

    it('已穿戴的装备也可以强化', () => {
      const inst = system.addToInventory('sword1');
      system.equip(inst.instanceId);
      expect(system.enhance(inst.instanceId, { gold: 100 })).toBe(true);
      expect(inst.enhanceLevel).toBe(1);
    });

    it('应触发 enhanced 事件', () => {
      const events: EquipEvent[] = [];
      system.onEvent((e) => events.push(e));
      const inst = system.addToInventory('sword1');
      // addToInventory 也触发 obtained，所以先清空
      events.length = 0;
      system.enhance(inst.instanceId, { gold: 100 });
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('enhanced');
    });
  });

  describe('discard', () => {
    it('应成功丢弃背包中的装备', () => {
      const inst = system.addToInventory('sword1');
      expect(system.discard(inst.instanceId)).toBe(true);
      expect(system.getInventory()).toHaveLength(0);
    });

    it('已穿戴的装备不能丢弃', () => {
      const inst = system.addToInventory('sword1');
      system.equip(inst.instanceId);
      expect(system.discard(inst.instanceId)).toBe(false);
    });

    it('不存在的实例应返回 false', () => {
      expect(system.discard('nonexistent')).toBe(false);
    });

    it('应触发 discarded 事件', () => {
      const events: EquipEvent[] = [];
      system.onEvent((e) => events.push(e));
      const inst = system.addToInventory('sword1');
      // addToInventory 触发 obtained，先清空
      events.length = 0;
      system.discard(inst.instanceId);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('discarded');
    });
  });

  describe('套装效果', () => {
    it('2 件同套装装备应触发 set_bonus_activated', () => {
      const events: EquipEvent[] = [];
      system.onEvent((e) => events.push(e));

      const helm = system.addToInventory('helm_fire');
      const armor = system.addToInventory('armor_dragon');
      system.equip(helm.instanceId);
      system.equip(armor.instanceId);

      const setEvents = events.filter((e) => e.type === 'set_bonus_activated');
      expect(setEvents).toHaveLength(1);
      expect(setEvents[0].data?.setId).toBe('dragon');
      expect(setEvents[0].data?.pieceCount).toBe(2);
    });

    it('卸下一件套装后套装应失效', () => {
      const helm = system.addToInventory('helm_fire');
      const armor = system.addToInventory('armor_dragon');
      system.equip(helm.instanceId);
      system.equip(armor.instanceId);

      system.unequip('helmet');

      // 套装不再激活（只有 1 件）
      const serialized = system.serialize();
      expect(
        (serialized.activeSets as Record<string, number>)['dragon'],
      ).toBeUndefined();
    });
  });

  describe('serialize / deserialize', () => {
    it('空系统序列化应返回初始状态', () => {
      const data = system.serialize();
      expect(data.equipped).toEqual({});
      expect(data.inventoryIds).toEqual([]);
      expect(data.activeSets).toEqual({});
    });

    it('应正确序列化和反序列化完整状态', () => {
      const inst = system.addToInventory('sword1');
      system.equip(inst.instanceId);
      system.enhance(inst.instanceId, { gold: 100 });

      const helm = system.addToInventory('helm_fire');
      system.equip(helm.instanceId);

      const ring = system.addToInventory('ring_luck');
      // ring 留在背包

      const data = system.serialize();

      // 反序列化到新系统
      const system2 = new EquipmentSystem(ALL_EQUIP_DEFS);
      system2.deserialize(data);

      // 验证已装备状态
      const equipped = system2.getEquipped();
      expect(equipped.weapon).toBe(inst.instanceId);
      expect(equipped.helmet).toBe(helm.instanceId);

      // 验证背包
      const inv = system2.getInventory();
      expect(inv).toHaveLength(1);
      expect(inv[0].instanceId).toBe(ring.instanceId);

      // 验证强化等级
      expect(inv[0].enhanceLevel).toBe(0); // ring 没强化

      // 验证加成
      const bonus = system2.getBonus();
      expect(bonus.atk).toBe(11); // 10 base + 1 enhance (10 * 1 * 0.1)
      expect(bonus.def).toBe(20);
      expect(bonus.hp).toBe(100);
    });
  });

  describe('reset', () => {
    it('应清空所有状态', () => {
      system.addToInventory('sword1');
      system.addToInventory('ring_luck');
      system.reset();
      expect(system.getInventory()).toHaveLength(0);
      expect(system.getEquipped()).toEqual({});
    });
  });

  describe('onEvent', () => {
    it('取消订阅后不应再收到事件', () => {
      const events: EquipEvent[] = [];
      const unsub = system.onEvent((e) => events.push(e));
      unsub();
      system.addToInventory('sword1');
      expect(events).toHaveLength(0);
    });
  });
});

// ============================================================
// DeitySystem 测试
// ============================================================

describe('DeitySystem', () => {
  let system: DeitySystem<DeityDef>;

  beforeEach(() => {
    system = new DeitySystem(ALL_DEITY_DEFS);
  });

  describe('unlock', () => {
    it('条件满足时应成功解锁', () => {
      expect(system.unlock('mars', { level: 5 })).toBe(true);
      expect(system.isUnlocked('mars')).toBe(true);
    });

    it('条件不满足时应失败', () => {
      expect(system.unlock('mars', { level: 3 })).toBe(false);
      expect(system.isUnlocked('mars')).toBe(false);
    });

    it('未提供 context 且有条件时应失败', () => {
      expect(system.unlock('mars')).toBe(false);
    });

    it('重复解锁应幂等返回 true', () => {
      system.unlock('mars', { level: 5 });
      expect(system.unlock('mars', { level: 5 })).toBe(true);
    });

    it('不存在的神明应返回 false', () => {
      expect(system.unlock('nonexistent', { level: 99 })).toBe(false);
    });

    it('前置神明未解锁时应失败', () => {
      // athena requires mars
      expect(system.unlock('athena', { level: 10 })).toBe(false);
    });

    it('前置神明已解锁时应成功', () => {
      system.unlock('mars', { level: 5 });
      expect(system.unlock('athena', { level: 10 })).toBe(true);
    });

    it('应触发 deity_unlocked 事件', () => {
      const events: DeityEvent[] = [];
      system.onEvent((e) => events.push(e));
      system.unlock('mars', { level: 5 });
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('deity_unlocked');
    });
  });

  describe('activate', () => {
    beforeEach(() => {
      system.unlock('mars', { level: 5 });
      system.unlock('apollo', { level: 3 });
    });

    it('应成功激活已解锁的神明', () => {
      expect(system.activate('mars')).toBe(true);
    });

    it('不存在的神明应返回 false', () => {
      expect(system.activate('nonexistent')).toBe(false);
    });

    it('未解锁的神明应返回 false', () => {
      const fresh = new DeitySystem(ALL_DEITY_DEFS);
      expect(fresh.activate('mars')).toBe(false);
    });

    it('互斥神明不能同时激活', () => {
      system.unlock('athena', { level: 10 });
      system.activate('mars');
      expect(system.activate('athena')).toBe(false);
    });

    it('非互斥神明可以切换激活', () => {
      system.activate('mars');
      // apollo 与 mars 不互斥
      expect(system.activate('apollo')).toBe(true);
    });

    it('重复激活同一神明应幂等返回 true', () => {
      system.activate('mars');
      expect(system.activate('mars')).toBe(true);
    });

    it('应触发 deity_activated 事件', () => {
      const events: DeityEvent[] = [];
      system.onEvent((e) => events.push(e));
      system.activate('mars');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('deity_activated');
    });
  });

  describe('bless', () => {
    beforeEach(() => {
      system.unlock('mars', { level: 5 });
    });

    it('应成功消耗资源升级祝福', () => {
      const result = system.bless('mars', { gold: 200 });
      expect(result.success).toBe(true);
      expect(result.newLevel).toBe(1);
    });

    it('资源不足时应失败', () => {
      const result = system.bless('mars', { gold: 50 }); // 需要 100
      expect(result.success).toBe(false);
      expect(result.newLevel).toBe(0);
    });

    it('未解锁的神明不能祝福', () => {
      const result = system.bless('athena', { gold: 200 });
      expect(result.success).toBe(false);
    });

    it('达到最大等级后不能再祝福', () => {
      // mars maxBlessingLevel = 5, costScaling = 1.5
      system.bless('mars', { gold: 1000 }); // 0→1
      system.bless('mars', { gold: 1000 }); // 1→2
      system.bless('mars', { gold: 1000 }); // 2→3
      system.bless('mars', { gold: 1000 }); // 3→4
      system.bless('mars', { gold: 1000 }); // 4→5

      const result = system.bless('mars', { gold: 10000 }); // 已满
      expect(result.success).toBe(false);
      expect(result.newLevel).toBe(5);
    });

    it('应触发 blessing_performed 事件', () => {
      const events: DeityEvent[] = [];
      system.onEvent((e) => events.push(e));
      system.bless('mars', { gold: 200 });
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('blessing_performed');
    });

    it('满级时应触发 blessing_maxed 事件', () => {
      const events: DeityEvent[] = [];
      system.onEvent((e) => events.push(e));
      // apollo maxBlessingLevel = 3
      system.unlock('apollo', { level: 3 });
      system.bless('apollo', { gold: 1000 }); // 0→1
      system.bless('apollo', { gold: 1000 }); // 1→2
      system.bless('apollo', { gold: 1000 }); // 2→3 (maxed)

      const maxedEvents = events.filter((e) => e.type === 'blessing_maxed');
      expect(maxedEvents).toHaveLength(1);
    });

    it('应累计 totalBlessings', () => {
      system.bless('mars', { gold: 200 });
      system.bless('mars', { gold: 200 });
      const data = system.serialize();
      expect(data.totalBlessings).toBe(2);
    });
  });

  describe('getBonus', () => {
    it('应返回正确的加成信息', () => {
      system.unlock('mars', { level: 5 });
      system.bless('mars', { gold: 200 }); // level 1

      const bonus = system.getBonus('mars');
      expect(bonus.target).toBe('attack');
      expect(bonus.type).toBe('multiplier');
      // 0.1 + 0.05 * 1 = 0.15
      expect(bonus.value).toBeCloseTo(0.15);
    });

    it('未解锁的神明应返回定义中的基础加成', () => {
      // getBonus 基于定义计算，不检查解锁状态
      const bonus = system.getBonus('mars');
      expect(bonus.target).toBe('attack');
      expect(bonus.value).toBe(0.1); // bonusValue + 0 * bonusPerLevel
    });
  });

  describe('getActiveBonus', () => {
    it('无激活神明应返回 null', () => {
      expect(system.getActiveBonus()).toBeNull();
    });

    it('应返回激活神明的加成', () => {
      system.unlock('mars', { level: 5 });
      system.activate('mars');
      const bonus = system.getActiveBonus();
      expect(bonus).not.toBeNull();
      expect(bonus!.target).toBe('attack');
      expect(bonus!.type).toBe('multiplier');
    });
  });

  describe('getNextBlessingCost', () => {
    it('等级 0 时应返回基础消耗', () => {
      system.unlock('mars', { level: 5 });
      const cost = system.getNextBlessingCost('mars');
      expect(cost).toEqual({ gold: 100 }); // 100 * 1.5^0 = 100
    });

    it('等级 1 时应返回缩放后的消耗', () => {
      system.unlock('mars', { level: 5 });
      system.bless('mars', { gold: 200 }); // 0→1
      const cost = system.getNextBlessingCost('mars');
      expect(cost.gold).toBe(150); // 100 * 1.5^1 = 150
    });

    it('不存在的神明应返回空对象', () => {
      expect(system.getNextBlessingCost('nonexistent')).toEqual({});
    });
  });

  describe('getExclusive', () => {
    it('应返回互斥神明列表', () => {
      expect(system.getExclusive('mars')).toEqual(['athena']);
    });

    it('无互斥应返回空数组', () => {
      expect(system.getExclusive('apollo')).toEqual([]);
    });

    it('不存在的神明应返回空数组', () => {
      expect(system.getExclusive('nonexistent')).toEqual([]);
    });
  });

  describe('serialize / deserialize', () => {
    it('空系统序列化应返回初始状态', () => {
      const data = system.serialize();
      expect(data.unlocked).toEqual([]);
      expect(data.activeDeity).toBeNull();
      expect(data.blessingLevels).toEqual({});
      expect(data.history).toEqual([]);
      expect(data.totalBlessings).toBe(0);
    });

    it('应正确序列化和反序列化完整状态', () => {
      system.unlock('mars', { level: 5 });
      system.activate('mars');
      system.bless('mars', { gold: 200 }); // level 1
      system.bless('mars', { gold: 200 }); // level 2

      const data = system.serialize();

      // 反序列化到新系统
      const system2 = new DeitySystem(ALL_DEITY_DEFS);
      system2.deserialize(data);

      // 验证解锁状态
      expect(system2.isUnlocked('mars')).toBe(true);
      expect(system2.isUnlocked('athena')).toBe(false);

      // 验证祝福等级
      const bonus = system2.getBonus('mars');
      // 0.1 + 0.05 * 2 = 0.2
      expect(bonus.value).toBeCloseTo(0.2);

      // 验证历史
      const serialized2 = system2.serialize();
      expect(serialized2.totalBlessings).toBe(2);
    });
  });

  describe('reset', () => {
    it('应清空所有状态', () => {
      system.unlock('mars', { level: 5 });
      system.activate('mars');
      system.bless('mars', { gold: 200 });
      system.reset();
      expect(system.isUnlocked('mars')).toBe(false);
      expect(system.getActiveBonus()).toBeNull();
      const data = system.serialize();
      expect(data.totalBlessings).toBe(0);
    });
  });

  describe('onEvent', () => {
    it('取消订阅后不应再收到事件', () => {
      const events: DeityEvent[] = [];
      const unsub = system.onEvent((e) => events.push(e));
      unsub();
      system.unlock('mars', { level: 5 });
      expect(events).toHaveLength(0);
    });
  });
});
