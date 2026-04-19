/**
 * EquipmentSystem — 等级校验 & 套装加成 单元测试
 *
 * 测试覆盖：
 * 1. equip() 等级校验（核心 Bug 修复验证）
 * 2. equip() 等级足够时正常穿戴
 * 3. 套装加成在 getBonus() 中正确计算
 * 4. 向后兼容：不传 characterLevel 时行为不变
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  EquipmentSystem,
  type EquipDef,
  type EquipSlot,
  type EquipEvent,
} from '../modules/EquipmentSystem';

// ============================================================
// 测试数据：装备定义
// ============================================================

/** 低等级武器（levelRequired: 1） */
const BASIC_SWORD: EquipDef = {
  id: 'basic-sword',
  name: '新手铁剑',
  rarity: 'common',
  slot: 'weapon',
  bonus: { atk: 10 },
  effects: [],
  levelRequired: 1,
  description: '入门级铁剑',
  icon: 'sword',
};

/** 高等级武器（levelRequired: 20） */
const LEGENDARY_SWORD: EquipDef = {
  id: 'legendary-sword',
  name: '传说之剑',
  rarity: 'legendary',
  slot: 'weapon',
  bonus: { atk: 100, critRate: 10 },
  effects: ['legendary_slash'],
  levelRequired: 20,
  description: '只有传说中的勇者才能持有',
  icon: 'sword_legendary',
};

/** 高等级头盔（levelRequired: 15） */
const ELITE_HELMET: EquipDef = {
  id: 'elite-helmet',
  name: '精英头盔',
  rarity: 'epic',
  slot: 'helmet',
  bonus: { def: 30, hp: 150 },
  effects: [],
  levelRequired: 15,
  description: '精英战士的头盔',
  icon: 'helmet_elite',
};

/** 火焰套装 - 头盔（levelRequired: 10, setId: 'flame'） */
const FLAME_HELMET: EquipDef = {
  id: 'flame-helmet',
  name: '炎龙头盔',
  rarity: 'epic',
  slot: 'helmet',
  bonus: { def: 20, hp: 100 },
  effects: ['fire_res'],
  levelRequired: 10,
  setId: 'flame',
  setBonuses: [
    { pieces: 2, bonus: { fireDmg: 15 } },
    { pieces: 3, bonus: { fireDmg: 15, burnChance: 10 } },
  ],
  description: '炎龙套装头盔',
  icon: 'helmet_flame',
};

/** 火焰套装 - 铠甲（levelRequired: 10, setId: 'flame'） */
const FLAME_ARMOR: EquipDef = {
  id: 'flame-armor',
  name: '炎龙铠甲',
  rarity: 'epic',
  slot: 'armor',
  bonus: { def: 40, hp: 200 },
  effects: ['fire_res', 'burn_immune'],
  levelRequired: 10,
  setId: 'flame',
  setBonuses: [
    { pieces: 2, bonus: { fireDmg: 15 } },
    { pieces: 3, bonus: { fireDmg: 15, burnChance: 10 } },
  ],
  description: '炎龙套装铠甲',
  icon: 'armor_flame',
};

/** 火焰套装 - 戒指（levelRequired: 10, setId: 'flame'） */
const FLAME_RING: EquipDef = {
  id: 'flame-ring',
  name: '炎龙戒指',
  rarity: 'rare',
  slot: 'ring',
  bonus: { atk: 15, fireDmg: 5 },
  effects: [],
  levelRequired: 10,
  setId: 'flame',
  setBonuses: [
    { pieces: 2, bonus: { fireDmg: 15 } },
    { pieces: 3, bonus: { fireDmg: 15, burnChance: 10 } },
  ],
  description: '炎龙套装戒指',
  icon: 'ring_flame',
};

/** 无套装的低等级戒指 */
const LUCKY_RING: EquipDef = {
  id: 'lucky-ring',
  name: '幸运戒指',
  rarity: 'rare',
  slot: 'ring',
  bonus: { luck: 15 },
  effects: [],
  levelRequired: 1,
  description: '带来好运的戒指',
  icon: 'ring_lucky',
};

const ALL_DEFS: EquipDef[] = [
  BASIC_SWORD,
  LEGENDARY_SWORD,
  ELITE_HELMET,
  FLAME_HELMET,
  FLAME_ARMOR,
  FLAME_RING,
  LUCKY_RING,
];

// ============================================================
// 测试
// ============================================================

describe('EquipmentSystem — 等级校验', () => {
  let system: EquipmentSystem<EquipDef>;

  beforeEach(() => {
    system = new EquipmentSystem(ALL_DEFS);
  });

  describe('equip() 等级不足时返回 false', () => {
    it('等级 5 角色不能穿戴 levelRequired=20 的传说之剑', () => {
      const inst = system.addToInventory('legendary-sword');
      const result = system.equip(inst.instanceId, 5);
      expect(result).toBe(false);
    });

    it('等级 1 角色不能穿戴 levelRequired=15 的精英头盔', () => {
      const inst = system.addToInventory('elite-helmet');
      const result = system.equip(inst.instanceId, 1);
      expect(result).toBe(false);
    });

    it('等级 9 角色不能穿戴 levelRequired=10 的火焰套装', () => {
      const inst = system.addToInventory('flame-helmet');
      const result = system.equip(inst.instanceId, 9);
      expect(result).toBe(false);
    });

    it('等级不足时装备应留在背包中', () => {
      const inst = system.addToInventory('legendary-sword');
      system.equip(inst.instanceId, 5);
      // 装备应该还在背包中
      expect(system.getInventory()).toHaveLength(1);
      expect(system.getInventory()[0].instanceId).toBe(inst.instanceId);
    });

    it('等级不足时不应触发 equipped 事件', () => {
      const events: EquipEvent[] = [];
      system.onEvent((e) => events.push(e));
      const inst = system.addToInventory('legendary-sword');
      events.length = 0; // 清掉 obtained 事件

      system.equip(inst.instanceId, 5);
      const equipEvents = events.filter((e) => e.type === 'equipped');
      expect(equipEvents).toHaveLength(0);
    });

    it('等级不足时不应占用装备槽位', () => {
      const inst = system.addToInventory('legendary-sword');
      system.equip(inst.instanceId, 5);
      expect(system.getEquipped().weapon).toBeUndefined();
    });
  });

  describe('equip() 等级足够时成功穿戴', () => {
    it('等级 1 角色可以穿戴 levelRequired=1 的新手铁剑', () => {
      const inst = system.addToInventory('basic-sword');
      const result = system.equip(inst.instanceId, 1);
      expect(result).toBe(true);
      expect(system.getEquipped().weapon).toBe(inst.instanceId);
    });

    it('等级 25 角色可以穿戴 levelRequired=20 的传说之剑', () => {
      const inst = system.addToInventory('legendary-sword');
      const result = system.equip(inst.instanceId, 25);
      expect(result).toBe(true);
      expect(system.getEquipped().weapon).toBe(inst.instanceId);
    });

    it('等级 15 角色可以穿戴 levelRequired=15 的精英头盔', () => {
      const inst = system.addToInventory('elite-helmet');
      const result = system.equip(inst.instanceId, 15);
      expect(result).toBe(true);
      expect(system.getEquipped().helmet).toBe(inst.instanceId);
    });

    it('等级 10 角色可以穿戴 levelRequired=10 的火焰套装头盔', () => {
      const inst = system.addToInventory('flame-helmet');
      const result = system.equip(inst.instanceId, 10);
      expect(result).toBe(true);
      expect(system.getEquipped().helmet).toBe(inst.instanceId);
    });

    it('等级足够时穿戴后应从背包移除', () => {
      const inst = system.addToInventory('basic-sword');
      system.equip(inst.instanceId, 1);
      expect(system.getInventory()).toHaveLength(0);
    });

    it('等级足够时穿戴应触发 equipped 事件', () => {
      const events: EquipEvent[] = [];
      system.onEvent((e) => events.push(e));
      const inst = system.addToInventory('basic-sword');
      events.length = 0;

      system.equip(inst.instanceId, 1);
      const equipEvents = events.filter((e) => e.type === 'equipped');
      expect(equipEvents).toHaveLength(1);
      expect(equipEvents[0].data?.defId).toBe('basic-sword');
    });
  });

  describe('equip() 向后兼容 — 不传 characterLevel', () => {
    it('不传等级参数时，高等级装备也能穿戴（默认 Infinity）', () => {
      const inst = system.addToInventory('legendary-sword');
      // 不传第二个参数，应该成功（向后兼容）
      const result = system.equip(inst.instanceId);
      expect(result).toBe(true);
      expect(system.getEquipped().weapon).toBe(inst.instanceId);
    });

    it('不传等级参数时，原有测试场景应正常工作', () => {
      const inst = system.addToInventory('basic-sword');
      expect(system.equip(inst.instanceId)).toBe(true);

      const inst2 = system.addToInventory('lucky-ring');
      expect(system.equip(inst2.instanceId)).toBe(true);

      const bonus = system.getBonus();
      expect(bonus).toEqual({ atk: 10, luck: 15 });
    });
  });

  describe('equip() 等级边界值', () => {
    it('等级恰好等于 levelRequired 时应成功', () => {
      const inst = system.addToInventory('legendary-sword');
      expect(system.equip(inst.instanceId, 20)).toBe(true);
    });

    it('等级比 levelRequired 少 1 时应失败', () => {
      const inst = system.addToInventory('legendary-sword');
      expect(system.equip(inst.instanceId, 19)).toBe(false);
    });

    it('等级为 0 时不能穿戴任何有等级要求的装备', () => {
      const inst = system.addToInventory('basic-sword');
      expect(system.equip(inst.instanceId, 0)).toBe(false);
    });
  });

  describe('equip() 等级不足时替换逻辑不应执行', () => {
    it('已有低级装备在槽位时，等级不足的高级装备不应替换', () => {
      // 先穿戴低级武器
      const basicInst = system.addToInventory('basic-sword');
      system.equip(basicInst.instanceId, 1);

      // 尝试穿戴高级武器（等级不足）
      const legendInst = system.addToInventory('legendary-sword');
      system.equip(legendInst.instanceId, 5);

      // 低级武器应该还在槽位上
      expect(system.getEquipped().weapon).toBe(basicInst.instanceId);
      // 高级武器应该在背包中
      expect(system.getInventory()).toHaveLength(1);
      expect(system.getInventory()[0].instanceId).toBe(legendInst.instanceId);
    });
  });
});

describe('EquipmentSystem — 套装加成计算', () => {
  let system: EquipmentSystem<EquipDef>;

  beforeEach(() => {
    system = new EquipmentSystem(ALL_DEFS);
  });

  describe('getBonus() 套装加成', () => {
    it('2 件火焰套装应获得 2 件套加成（fireDmg: 15）', () => {
      const helm = system.addToInventory('flame-helmet');
      const armor = system.addToInventory('flame-armor');

      system.equip(helm.instanceId, 10);
      system.equip(armor.instanceId, 10);

      const bonus = system.getBonus();
      // 基础：def: 20+40=60, hp: 100+200=300
      // 套装 2 件加成：fireDmg: 15
      expect(bonus.def).toBe(60);
      expect(bonus.hp).toBe(300);
      expect(bonus.fireDmg).toBe(15);
    });

    it('3 件火焰套装应获得 2 件和 3 件套加成叠加', () => {
      const helm = system.addToInventory('flame-helmet');
      const armor = system.addToInventory('flame-armor');
      const ring = system.addToInventory('flame-ring');

      system.equip(helm.instanceId, 10);
      system.equip(armor.instanceId, 10);
      system.equip(ring.instanceId, 10);

      const bonus = system.getBonus();
      // 基础：def: 60, hp: 300, atk: 15, fireDmg: 5
      // 套装 2 件加成：fireDmg: 15
      // 套装 3 件加成：fireDmg: 15, burnChance: 10
      // 总 fireDmg = 5 + 15 + 15 = 35
      expect(bonus.def).toBe(60);
      expect(bonus.hp).toBe(300);
      expect(bonus.atk).toBe(15);
      expect(bonus.fireDmg).toBe(35);
      expect(bonus.burnChance).toBe(10);
    });

    it('卸下一件套装后套装加成应消失', () => {
      const helm = system.addToInventory('flame-helmet');
      const armor = system.addToInventory('flame-armor');

      system.equip(helm.instanceId, 10);
      system.equip(armor.instanceId, 10);

      // 确认 2 件套激活
      expect(system.getBonus().fireDmg).toBe(15);

      // 卸下头盔
      system.unequip('helmet');

      const bonus = system.getBonus();
      // 只剩铠甲的基础加成
      expect(bonus.def).toBe(40);
      expect(bonus.hp).toBe(200);
      expect(bonus.fireDmg).toBeUndefined();
    });

    it('1 件套装装备不应触发套装加成', () => {
      const helm = system.addToInventory('flame-helmet');
      system.equip(helm.instanceId, 10);

      const bonus = system.getBonus();
      expect(bonus.def).toBe(20);
      expect(bonus.hp).toBe(100);
      expect(bonus.fireDmg).toBeUndefined();
    });

    it('无 setBonuses 定义的套装不应产生额外加成', () => {
      // 使用原始测试定义（没有 setBonuses 字段）
      const noSetBonusDefs: EquipDef[] = [
        {
          id: 'helm-a',
          name: '头盔A',
          rarity: 'rare',
          slot: 'helmet',
          bonus: { def: 10 },
          effects: [],
          levelRequired: 1,
          setId: 'test-set',
          description: '',
          icon: '',
        },
        {
          id: 'armor-a',
          name: '铠甲A',
          rarity: 'rare',
          slot: 'armor',
          bonus: { def: 20 },
          effects: [],
          levelRequired: 1,
          setId: 'test-set',
          description: '',
          icon: '',
        },
      ];

      const sys = new EquipmentSystem(noSetBonusDefs);
      const helm = sys.addToInventory('helm-a');
      const armor = sys.addToInventory('armor-a');
      sys.equip(helm.instanceId, 1);
      sys.equip(armor.instanceId, 1);

      const bonus = sys.getBonus();
      expect(bonus).toEqual({ def: 30 }); // 只有基础加成，无套装额外加成
    });
  });

  describe('套装加成与强化加成叠加', () => {
    it('强化后的套装装备应同时包含强化加成和套装加成', () => {
      const helm = system.addToInventory('flame-helmet');
      const armor = system.addToInventory('flame-armor');

      system.equip(helm.instanceId, 10);
      system.equip(armor.instanceId, 10);

      // 强化头盔到 +5
      for (let i = 0; i < 5; i++) {
        system.enhance(helm.instanceId, { gold: 100 });
      }

      const bonus = system.getBonus();
      // 头盔基础 def: 20, 强化: 20 * 5 * 0.1 = 10 → 30
      // 铠甲基础 def: 40
      // 总 def = 30 + 40 = 70
      expect(bonus.def).toBe(70);
      // 套装 2 件加成：fireDmg: 15
      expect(bonus.fireDmg).toBe(15);
    });
  });
});

describe('EquipmentSystem — 等级校验与套装联动', () => {
  it('等级不足不能穿戴套装件，导致套装不激活', () => {
    const defs: EquipDef[] = [
      FLAME_HELMET,
      FLAME_ARMOR,
      FLAME_RING,
    ];
    const system = new EquipmentSystem(defs);

    // 等级 10 可以穿头盔和铠甲
    const helm = system.addToInventory('flame-helmet');
    const armor = system.addToInventory('flame-armor');
    system.equip(helm.instanceId, 10);
    system.equip(armor.instanceId, 10);

    // 2 件套应该激活
    expect(system.getBonus().fireDmg).toBe(15);

    // 尝试穿戴戒指但等级不足（需要 10，角色等级 9）
    const ring = system.addToInventory('flame-ring');
    const result = system.equip(ring.instanceId, 9);
    expect(result).toBe(false);

    // 仍然只有 2 件套
    expect(system.getBonus().fireDmg).toBe(15);
    expect(system.getBonus().burnChance).toBeUndefined();
  });
});
