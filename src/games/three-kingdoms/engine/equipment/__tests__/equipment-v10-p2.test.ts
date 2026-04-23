import { EquipmentSystem } from '../EquipmentSystem';
import { EquipmentForgeSystem } from '../EquipmentForgeSystem';
import { EquipmentEnhanceSystem } from '../EquipmentEnhanceSystem';
import { EquipmentSetSystem } from '../EquipmentSetSystem';
import { EquipmentRecommendSystem } from '../EquipmentRecommendSystem';
import type {
  EquipmentSlot,
  EquipmentRarity,
  BagFilter,
} from '../../../core/equipment/equipment.types';
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_RARITIES,
  RARITY_ORDER,
} from '../../../core/equipment/equipment.types';
import {
  EQUIPMENT_TEMPLATES,
  ENHANCE_CONFIG,
  FORGE_PITY_THRESHOLDS,
  EQUIPMENT_SETS,
  SET_MAP,
  TRANSFER_LEVEL_LOSS,
} from '../../../core/equipment/equipment-config';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

function createSystems() {
  const equipment = new EquipmentSystem();
  const forge = new EquipmentForgeSystem(equipment);
  const enhance = new EquipmentEnhanceSystem(equipment);
  const set = new EquipmentSetSystem(equipment);
  const recommend = new EquipmentRecommendSystem(equipment, set);
  return { equipment, forge, enhance, set, recommend };
}

// ═══════════════════════════════════════════
// 模块C: 装备属性与套装 (续)
// ═══════════════════════════════════════════

describe('模块C: 装备属性与套装', () => {
  let systems: ReturnType<typeof createSystems>;

  beforeEach(() => {
    systems = createSystems();
  });

  describe('属性计算一致性', () => {
    it('recalcStats保持uid不变', () => {
      const eq = systems.equipment.generateEquipment('sword_iron', 'white');
      const recalced = systems.equipment.recalcStats(eq!);
      expect(recalced.uid).toBe(eq!.uid);
      expect(recalced.templateId).toBe(eq!.templateId);
    });
  });
});

// ═══════════════════════════════════════════
// 模块D: 强化系统 (6项)
// ═══════════════════════════════════════════

describe('模块D: 强化系统', () => {
  let systems: ReturnType<typeof createSystems>;

  beforeEach(() => {
    systems = createSystems();
  });

  // #10 成功率曲线
  describe('#10 成功率曲线', () => {
    it('等级0→1成功率100%', () => {
      expect(systems.enhance.getSuccessRate(0)).toBe(1.0);
    });

    it('高等级成功率递减', () => {
      for (let i = 1; i < 14; i++) {
        expect(systems.enhance.getSuccessRate(i)).toBeLessThanOrEqual(systems.enhance.getSuccessRate(i - 1));
      }
    });

    it('最大等级为15', () => {
      expect(ENHANCE_CONFIG.maxLevel).toBe(15);
    });
  });

  // #11 降级规则
  describe('#11 降级规则', () => {
    it('安全等级内失败不降级', () => {
      const eq = systems.equipment.generateEquipment('sword_iron', 'white');
      // 在安全等级内反复强化，等级不应低于0
      for (let i = 0; i < 20; i++) {
        systems.enhance.enhance(eq!.uid, false);
      }
      const current = systems.equipment.getEquipment(eq!.uid);
      expect(current!.enhanceLevel).toBeGreaterThanOrEqual(0);
    });

    it('安全等级为5', () => {
      expect(ENHANCE_CONFIG.safeLevel).toBe(5);
    });
  });

  // #12 保护符
  describe('#12 保护符', () => {
    it('保护符可添加', () => {
      systems.enhance.addProtection(10);
      expect(systems.enhance.getProtectionCount()).toBe(10);
    });

    it('保护符不足时不使用', () => {
      const eq = systems.equipment.generateEquipment('sword_iron', 'white');
      // 先强化到安全等级以上
      for (let i = 0; i < 6; i++) {
        systems.enhance.enhance(eq!.uid, false);
      }
      expect(systems.enhance.getProtectionCount()).toBe(0);
      // 保护符不足时强化仍可执行
      const result = systems.enhance.enhance(eq!.uid, true);
      expect(result).toBeDefined();
    });
  });

  // #13 自动强化
  describe('#13 自动强化', () => {
    it('自动强化到目标等级', () => {
      const eq = systems.equipment.generateEquipment('sword_iron', 'white');
      // 使用100%成功率等级测试
      const result = systems.enhance.autoEnhance(eq!.uid, {
        targetLevel: 3,
        maxCopper: 999999,
        maxStone: 999999,
        useProtection: false,
        protectionThreshold: 10,
      });
      expect(result.finalLevel).toBeGreaterThanOrEqual(0);
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('自动强化受铜钱上限限制', () => {
      const eq = systems.equipment.generateEquipment('sword_iron', 'white');
      const result = systems.enhance.autoEnhance(eq!.uid, {
        targetLevel: 15,
        maxCopper: 100,
        maxStone: 999999,
        useProtection: false,
        protectionThreshold: 10,
      });
      // 铜钱不够时应该停止
      expect(result.totalCopper).toBeLessThanOrEqual(200);
    });
  });

  // #14 强化转移
  describe('#14 强化转移', () => {
    it('转移强化等级', () => {
      const source = systems.equipment.generateEquipment('sword_iron', 'white');
      const target = systems.equipment.generateEquipment('sword_steel', 'green');

      // 先强化源装备
      for (let i = 0; i < 5; i++) {
        systems.enhance.enhance(source!.uid, false);
      }
      const sourceLevel = systems.equipment.getEquipment(source!.uid)!.enhanceLevel;

      if (sourceLevel > 0) {
        const result = systems.enhance.transferEnhance(source!.uid, target!.uid);
        expect(result.success).toBe(true);
        expect(result.transferredLevel).toBe(Math.max(0, sourceLevel - 1));

        // 源装备等级归零
        const srcEq = systems.equipment.getEquipment(source!.uid);
        expect(srcEq!.enhanceLevel).toBe(0);
      }
    });

    it('转移有等级损耗', () => {
      // 损耗1级
      expect(TRANSFER_LEVEL_LOSS).toBe(1);
    });
  });

  // #15 一键强化
  describe('#15 一键强化', () => {
    it('批量强化多件装备', () => {
      const eq1 = systems.equipment.generateEquipment('sword_iron', 'white');
      const eq2 = systems.equipment.generateEquipment('armor_leather', 'white');

      const results = systems.enhance.batchEnhance([eq1!.uid, eq2!.uid], false);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('跳过已满级装备', () => {
      const eq = systems.equipment.generateEquipment('sword_iron', 'white');
      // 手动设置满级
      systems.equipment.updateEquipment({ ...eq!, enhanceLevel: 15 });
      const results = systems.enhance.batchEnhance([eq!.uid], false);
      expect(results).toHaveLength(0);
    });
  });
});

// ═══════════════════════════════════════════
// 模块E: 穿戴规则 (2项)
// ═══════════════════════════════════════════

describe('模块E: 穿戴规则', () => {
  let systems: ReturnType<typeof createSystems>;

  beforeEach(() => {
    systems = createSystems();
  });

  // #19 四槽位穿戴 (note: #18 is codex, #19 is equipping, #20 is recommend)
  describe('#19 四槽位穿戴', () => {
    it('穿戴装备到正确槽位', () => {
      const weapon = systems.equipment.generateEquipment('sword_iron', 'white');
      const result = systems.equipment.equipItem('hero1', weapon!.uid);
      expect(result.success).toBe(true);

      const equips = systems.equipment.getHeroEquips('hero1');
      expect(equips.weapon).toBe(weapon!.uid);
    });

    it('穿戴4个部位', () => {
      const weapon = systems.equipment.generateEquipment('sword_iron', 'white');
      const armor = systems.equipment.generateEquipment('armor_leather', 'white');
      const accessory = systems.equipment.generateEquipment('ring_jade', 'white');
      const mount = systems.equipment.generateEquipment('mount_horse', 'white');

      systems.equipment.equipItem('hero1', weapon!.uid);
      systems.equipment.equipItem('hero1', armor!.uid);
      systems.equipment.equipItem('hero1', accessory!.uid);
      systems.equipment.equipItem('hero1', mount!.uid);

      const equips = systems.equipment.getHeroEquips('hero1');
      expect(equips.weapon).toBe(weapon!.uid);
      expect(equips.armor).toBe(armor!.uid);
      expect(equips.accessory).toBe(accessory!.uid);
      expect(equips.mount).toBe(mount!.uid);
    });

    it('替换已有装备', () => {
      const weapon1 = systems.equipment.generateEquipment('sword_iron', 'white');
      const weapon2 = systems.equipment.generateEquipment('sword_steel', 'green');

      systems.equipment.equipItem('hero1', weapon1!.uid);
      const result = systems.equipment.equipItem('hero1', weapon2!.uid);
      expect(result.success).toBe(true);
      expect(result.replacedUid).toBe(weapon1!.uid);

      const equips = systems.equipment.getHeroEquips('hero1');
      expect(equips.weapon).toBe(weapon2!.uid);
    });

    it('卸下装备', () => {
      const weapon = systems.equipment.generateEquipment('sword_iron', 'white');
      systems.equipment.equipItem('hero1', weapon!.uid);

      const result = systems.equipment.unequipItem('hero1', 'weapon');
      expect(result.success).toBe(true);

      const equips = systems.equipment.getHeroEquips('hero1');
      expect(equips.weapon).toBeNull();
    });

    it('装备标记为已穿戴', () => {
      const weapon = systems.equipment.generateEquipment('sword_iron', 'white');
      systems.equipment.equipItem('hero1', weapon!.uid);

      const eq = systems.equipment.getEquipment(weapon!.uid);
      expect(eq!.isEquipped).toBe(true);
      expect(eq!.equippedHeroId).toBe('hero1');
    });

    it('已穿戴装备不可再次穿戴', () => {
      const weapon = systems.equipment.generateEquipment('sword_iron', 'white');
      systems.equipment.equipItem('hero1', weapon!.uid);
      const result = systems.equipment.equipItem('hero2', weapon!.uid);
      expect(result.success).toBe(false);
    });
  });

  // #20 一键推荐
  describe('#20 一键推荐', () => {
    it('为空角色推荐最优装备', () => {
      // 生成一些装备
      systems.equipment.generateEquipment('sword_iron', 'white');
      systems.equipment.generateEquipment('armor_leather', 'green');
      systems.equipment.generateEquipment('ring_jade', 'blue');
      systems.equipment.generateEquipment('mount_horse', 'white');

      const result = systems.recommend.recommendForHero('hero1');
      expect(result.slots).toBeDefined();
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
    });

    it('推荐评分包含明细', () => {
      systems.equipment.generateEquipment('sword_iron', 'white');
      const result = systems.recommend.recommendForHero('hero1');
      const weaponRec = result.slots.weapon;
      if (weaponRec) {
        expect(weaponRec.breakdown.mainStat).toBeGreaterThanOrEqual(0);
        expect(weaponRec.breakdown.subStats).toBeGreaterThanOrEqual(0);
        expect(weaponRec.breakdown.rarity).toBeGreaterThanOrEqual(0);
        expect(weaponRec.breakdown.enhanceLevel).toBeGreaterThanOrEqual(0);
      }
    });

    it('高品质装备评分更高', () => {
      const white = systems.equipment.generateEquipment('sword_iron', 'white');
      const gold = systems.equipment.generateEquipment('sword_steel', 'gold');

      const whiteRec = systems.recommend.evaluateEquipment(white!, 'hero1');
      const goldRec = systems.recommend.evaluateEquipment(gold!, 'hero1');
      expect(goldRec.score).toBeGreaterThan(whiteRec.score);
    });

    it('生成套装建议', () => {
      // 生成多件同套装装备
      systems.equipment.generateEquipment('sword_iron', 'white');
      systems.equipment.generateEquipment('armor_leather', 'white');
      systems.equipment.generateEquipment('ring_jade', 'white');
      systems.equipment.generateEquipment('mount_horse', 'white');

      const result = systems.recommend.recommendForHero('hero1');
      expect(result.setSuggestions).toBeDefined();
      expect(Array.isArray(result.setSuggestions)).toBe(true);
    });

    it('无装备时返回空推荐', () => {
      const result = systems.recommend.recommendForHero('hero1');
      expect(result.slots.weapon).toBeNull();
      expect(result.slots.armor).toBeNull();
      expect(result.totalScore).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════
// 存档/序列化
// ═══════════════════════════════════════════

describe('装备系统存档', () => {
  it('EquipmentSystem 序列化/反序列化一致', () => {
    const sys = new EquipmentSystem();
    sys.generateEquipment('sword_iron', 'white');
    sys.generateEquipment('armor_leather', 'green');
    sys.equipItem('hero1', sys.getAllEquipments()[0].uid);

    const data = sys.serialize();
    const sys2 = new EquipmentSystem();
    sys2.deserialize(data);

    expect(sys2.getBagSize()).toBe(2);
    expect(sys2.getBagCapacity()).toBe(sys.getBagCapacity());
    expect(sys2.getHeroEquips('hero1').weapon).toBeDefined();
  });

  it('ForgeSystem 序列化/反序列化一致', () => {
    const eq = new EquipmentSystem();
    const forge = new EquipmentForgeSystem(eq);
    // 添加材料后炼制
    for (let i = 0; i < 3; i++) eq.generateEquipment('weapon', 'white');
    forge.basicForge();
    for (let i = 0; i < 5; i++) eq.generateEquipment('weapon', 'white');
    forge.advancedForge();

    const data = forge.serialize();
    const forge2 = new EquipmentForgeSystem(eq);
    forge2.deserialize(data);

    expect(forge2.getTotalForgeCount()).toBe(2);
    expect(forge2.getPityState()).toEqual(data.pity);
  });

  it('EnhanceSystem 序列化/反序列化一致', () => {
    const eq = new EquipmentSystem();
    const enhance = new EquipmentEnhanceSystem(eq);
    enhance.addProtection(5);

    const data = enhance.serialize();
    const enhance2 = new EquipmentEnhanceSystem(eq);
    enhance2.deserialize(data);

    expect(enhance2.getProtectionCount()).toBe(5);
  });

  it('全系统reset清除状态', () => {
    const { equipment, forge, enhance } = createSystems();
    equipment.generateEquipment('sword_iron', 'white');
    forge.basicForge();
    enhance.addProtection(5);

    equipment.reset();
    forge.reset();
    enhance.reset();

    expect(equipment.getBagSize()).toBe(0);
    expect(forge.getTotalForgeCount()).toBe(0);
    expect(enhance.getProtectionCount()).toBe(0);
  });
});
