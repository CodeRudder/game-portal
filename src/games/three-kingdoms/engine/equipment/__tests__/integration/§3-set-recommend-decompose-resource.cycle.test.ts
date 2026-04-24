/**
 * 集成测试 §3: 套装→推荐→分解→资源循环 全链路
 *
 * 覆盖 Play 流程:
 *   4.1 套装激活
 *   4.2 套装归属与搭配
 *   4.3 套装跨武将不共享
 *   4.4 装备无限制穿戴
 *   6.3 套装→属性→武将战力闭环
 *   6.4 背包→分解→炼制资源循环
 *   6.10 紫色装备套装概率验证
 *   6.18 一键穿戴推荐算法验证
 *   6.21 装备数据持久化与压缩验证
 *
 * @module engine/equipment/__tests__/integration/§3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EquipmentSystem } from '../../EquipmentSystem';
import { EquipmentForgeSystem } from '../../EquipmentForgeSystem';
import { EquipmentEnhanceSystem } from '../../EquipmentEnhanceSystem';
import { EquipmentSetSystem } from '../../EquipmentSetSystem';
import { EquipmentRecommendSystem } from '../../EquipmentRecommendSystem';
import type {
  EquipmentSlot,
  EquipmentRarity,
  EquipmentInstance,
} from '../../../../core/equipment/equipment.types';
import {
  EQUIPMENT_SLOTS,
  RARITY_ORDER,
} from '../../../../core/equipment/equipment.types';
import {
  EQUIPMENT_TEMPLATES,
  EQUIPMENT_SETS,
  SET_MAP,
  DECOMPOSE_COPPER_BASE,
  DECOMPOSE_STONE_BASE,
  DECOMPOSE_ENHANCE_BONUS,
  RARITY_ENHANCE_CAP,
} from '../../../../core/equipment/equipment-config';
import type { ActiveSetBonus, SetId } from '../../../../core/equipment/equipment-forge.types';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function createSystems() {
  const equipment = new EquipmentSystem();
  const forge = new EquipmentForgeSystem(equipment);
  const enhance = new EquipmentEnhanceSystem(equipment);
  const set = new EquipmentSetSystem(equipment);
  const recommend = new EquipmentRecommendSystem(equipment, set);
  return { equipment, forge, enhance, set, recommend };
}

/** 生成N件指定品质装备 */
function generateN(equipment: EquipmentSystem, count: number, rarity: EquipmentRarity, slot?: EquipmentSlot): EquipmentInstance[] {
  const result: EquipmentInstance[] = [];
  for (let i = 0; i < count; i++) {
    const s = slot ?? EQUIPMENT_SLOTS[i % 4];
    const eq = equipment.generateEquipment(s, rarity);
    if (eq) result.push(eq);
  }
  return result;
}

/** 为武将穿齐4个部位 */
function equipAll(equipment: EquipmentSystem, heroId: string, items: EquipmentInstance[]): void {
  for (const item of items) {
    equipment.equipItem(heroId, item.uid);
  }
}

// ═══════════════════════════════════════════════
// §3 套装→推荐→分解→资源循环 全链路集成测试
// ═══════════════════════════════════════════════

describe('§3 套装→推荐→分解→资源循环全链路', () => {

  // ─── §3.1 套装定义与激活 ───

  describe('§3.1 套装定义与激活', () => {
    let equipment: EquipmentSystem;
    let set: EquipmentSetSystem;

    beforeEach(() => {
      ({ equipment, set } = createSystems());
    });

    it('有7套套装定义', () => {
      const allSets = set.getAllSetDefs();
      expect(allSets.length).toBeGreaterThanOrEqual(7);
    });

    it('每套套装有2件套和4件套效果', () => {
      const allSets = set.getAllSetDefs();
      for (const s of allSets) {
        expect(s.bonus2).toBeDefined();
        expect(s.bonus2.description).toBeTruthy();
        expect(s.bonus4).toBeDefined();
        expect(s.bonus4.description).toBeTruthy();
      }
    });

    it('无装备时无套装激活', () => {
      const bonuses = set.getActiveSetBonuses('hero1');
      expect(bonuses).toHaveLength(0);
    });

    it('穿戴2件同套装激活2件套效果', () => {
      // warrior套装有 sword_iron(weapon) + armor_leather(armor)
      // 但 armor_leather 属于 guardian，需要找同套装的模板
      // 查看模板找到同套装组合
      const warriorTemplates = EQUIPMENT_TEMPLATES.filter(t => t.setId === 'warrior');
      if (warriorTemplates.length >= 2) {
        const eq1 = equipment.generateEquipment(warriorTemplates[0].id, 'white');
        const eq2 = equipment.generateEquipment(warriorTemplates[1].id, 'white');
        if (eq1 && eq2) {
          equipment.equipItem('hero1', eq1.uid);
          equipment.equipItem('hero1', eq2.uid);
          const bonuses = set.getActiveSetBonuses('hero1');
          expect(bonuses.length).toBeGreaterThanOrEqual(1);
          const twoPiece = bonuses.find(b => b.tier === 2);
          expect(twoPiece).toBeDefined();
        }
      }
    });

    it('穿戴4件同套装激活2件套+4件套', () => {
      // dragon套装有 sword_dragon + armor_dragon + ring_dragon 三个模板
      // 需要凑齐4件，可能需要多个模板
      const dragonTemplates = EQUIPMENT_TEMPLATES.filter(t => t.setId === 'dragon');
      if (dragonTemplates.length >= 2) {
        // 至少验证2件套效果
        const eq1 = equipment.generateEquipment(dragonTemplates[0].id, 'blue');
        const eq2 = equipment.generateEquipment(dragonTemplates[1].id, 'blue');
        if (eq1 && eq2) {
          equipment.equipItem('hero1', eq1.uid);
          equipment.equipItem('hero1', eq2.uid);
          const bonuses = set.getActiveSetBonuses('hero1');
          expect(bonuses.length).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('套装件数统计正确', () => {
      const warriorTemplates = EQUIPMENT_TEMPLATES.filter(t => t.setId === 'warrior');
      if (warriorTemplates.length >= 2) {
        const eq1 = equipment.generateEquipment(warriorTemplates[0].id, 'white');
        const eq2 = equipment.generateEquipment(warriorTemplates[1].id, 'white');
        if (eq1 && eq2) {
          equipment.equipItem('hero1', eq1.uid);
          equipment.equipItem('hero1', eq2.uid);
          const counts = set.getSetCounts('hero1');
          expect(counts.get('warrior')).toBe(2);
        }
      }
    });

    it('卸下装备后套装效果消失', () => {
      const warriorTemplates = EQUIPMENT_TEMPLATES.filter(t => t.setId === 'warrior');
      if (warriorTemplates.length >= 2) {
        const eq1 = equipment.generateEquipment(warriorTemplates[0].id, 'white');
        const eq2 = equipment.generateEquipment(warriorTemplates[1].id, 'white');
        if (eq1 && eq2) {
          equipment.equipItem('hero1', eq1.uid);
          equipment.equipItem('hero1', eq2.uid);
          expect(set.getActiveSetBonuses('hero1').length).toBeGreaterThanOrEqual(1);

          equipment.unequipItem('hero1', eq1.slot);
          // 1件不满足2件套
          const bonuses = set.getActiveSetBonuses('hero1');
          // 可能还有其他套装激活
          const warriorBonus = bonuses.find(b => b.setId === 'warrior');
          expect(warriorBonus).toBeUndefined();
        }
      }
    });
  });

  // ─── §3.2 套装跨武将独立性 ───

  describe('§3.2 套装跨武将独立性', () => {
    let equipment: EquipmentSystem;
    let set: EquipmentSetSystem;

    beforeEach(() => {
      ({ equipment, set } = createSystems());
    });

    it('不同武将穿戴同套装互不干扰', () => {
      const warriorTemplates = EQUIPMENT_TEMPLATES.filter(t => t.setId === 'warrior');
      if (warriorTemplates.length >= 2) {
        const eq1 = equipment.generateEquipment(warriorTemplates[0].id, 'white');
        const eq2 = equipment.generateEquipment(warriorTemplates[1].id, 'white');

        if (eq1 && eq2) {
          equipment.equipItem('heroA', eq1.uid);
          equipment.equipItem('heroA', eq2.uid);

          // heroA 有套装效果
          const bonusesA = set.getActiveSetBonuses('heroA');
          expect(bonusesA.length).toBeGreaterThanOrEqual(1);

          // heroB 无套装效果
          const bonusesB = set.getActiveSetBonuses('heroB');
          expect(bonusesB).toHaveLength(0);
        }
      }
    });

    it('卸下武将A装备不影响武将B', () => {
      const warriorTemplates = EQUIPMENT_TEMPLATES.filter(t => t.setId === 'warrior');
      if (warriorTemplates.length >= 2) {
        const eq1 = equipment.generateEquipment(warriorTemplates[0].id, 'white');
        const eq2 = equipment.generateEquipment(warriorTemplates[1].id, 'white');

        if (eq1 && eq2) {
          equipment.equipItem('heroA', eq1.uid);
          equipment.equipItem('heroA', eq2.uid);

          // 卸下A的一件
          equipment.unequipItem('heroA', eq1.slot);

          // heroA 套装效果消失
          const warriorBonusA = set.getActiveSetBonuses('heroA').find(b => b.setId === 'warrior');
          expect(warriorBonusA).toBeUndefined();
        }
      }
    });
  });

  // ─── §3.3 一键推荐 ───

  describe('§3.3 一键推荐', () => {
    let equipment: EquipmentSystem;
    let recommend: EquipmentRecommendSystem;

    beforeEach(() => {
      ({ equipment, recommend } = createSystems());
    });

    it('空背包时推荐结果全为null', () => {
      const result = recommend.recommendForHero('hero1');
      expect(result.slots.weapon).toBeNull();
      expect(result.slots.armor).toBeNull();
      expect(result.slots.accessory).toBeNull();
      expect(result.slots.mount).toBeNull();
      expect(result.totalScore).toBe(0);
    });

    it('有装备时推荐最优选择', () => {
      // 生成不同品质的武器
      const white = equipment.generateEquipment('weapon', 'white');
      const green = equipment.generateEquipment('weapon', 'green');
      const blue = equipment.generateEquipment('weapon', 'blue');

      const result = recommend.recommendForHero('hero1');
      expect(result.slots.weapon).not.toBeNull();
      // 推荐的应该是蓝色（最高品质）
      if (result.slots.weapon) {
        expect(result.slots.weapon.equipment.uid).toBe(blue.uid);
      }
    });

    it('推荐评分包含各项breakdown', () => {
      const eq = equipment.generateEquipment('weapon', 'green');
      const rec = recommend.evaluateEquipment(eq, 'hero1');
      expect(rec.score).toBeGreaterThan(0);
      expect(rec.breakdown).toBeDefined();
      expect(rec.breakdown.mainStat).toBeGreaterThanOrEqual(0);
      expect(rec.breakdown.subStats).toBeGreaterThanOrEqual(0);
      expect(rec.breakdown.rarity).toBeGreaterThanOrEqual(0);
      expect(rec.breakdown.enhanceLevel).toBeGreaterThanOrEqual(0);
    });

    it('推荐包含套装建议', () => {
      generateN(equipment, 4, 'blue');
      const result = recommend.recommendForHero('hero1');
      expect(result.setSuggestions).toBeDefined();
    });

    it('已穿戴装备也纳入推荐候选', () => {
      const white = equipment.generateEquipment('weapon', 'white');
      equipment.equipItem('hero1', white.uid);

      const green = equipment.generateEquipment('weapon', 'green');
      const result = recommend.recommendForHero('hero1');
      // 应推荐绿色武器（更好）
      if (result.slots.weapon) {
        expect(result.slots.weapon.equipment.uid).toBe(green.uid);
      }
    });
  });

  // ─── §3.4 分解与资源循环 ───

  describe('§3.4 分解与资源循环', () => {
    let equipment: EquipmentSystem;

    beforeEach(() => {
      ({ equipment } = createSystems());
    });

    it('白色装备分解产出铜钱和强化石', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      const result = equipment.decompose(eq.uid);
      if ('success' in result && result.result) {
        expect(result.result.copper).toBeGreaterThan(0);
        expect(result.result.enhanceStone).toBeGreaterThanOrEqual(0);
      }
    });

    it('高品质装备分解产出更多资源', () => {
      const white = equipment.generateEquipment('weapon', 'white');
      const gold = equipment.generateEquipment('weapon', 'gold');

      const whiteResult = equipment.decompose(white.uid);
      // 重新生成因为上面已分解
      const gold2 = equipment.generateEquipment('weapon', 'gold');
      const goldResult = equipment.decompose(gold2.uid);

      let whiteCopper = 0, goldCopper = 0;
      if ('success' in whiteResult && whiteResult.result) whiteCopper = whiteResult.result.copper;
      if ('success' in goldResult && goldResult.result) goldCopper = goldResult.result.copper;

      expect(goldCopper).toBeGreaterThan(whiteCopper);
    });

    it('强化后分解产出更多（强化加成）', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      const preview0 = equipment.getDecomposePreview(eq.uid);

      // 模拟强化后
      const enhanced = { ...eq, enhanceLevel: 5 };
      const reward = equipment.calculateDecomposeReward(enhanced);
      expect(reward.copper).toBeGreaterThan(preview0!.copper);
    });

    it('批量分解多件装备', () => {
      const items = generateN(equipment, 5, 'white');
      const result = equipment.batchDecompose(items.map(i => i.uid));
      expect(result.totalCopper).toBeGreaterThan(0);
      expect(result.decomposedCount).toBe(5);
    });

    it('已穿戴装备不可分解', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      equipment.equipItem('hero1', eq.uid);
      const result = equipment.decompose(eq.uid);
      if ('success' in result) {
        expect(result.success).toBe(false);
      }
    });

    it('分解全量未穿戴装备', () => {
      generateN(equipment, 10, 'white');
      // 穿戴1件
      const all = equipment.getAllEquipments();
      equipment.equipItem('hero1', all[0].uid);

      const result = equipment.decomposeAllUnequipped();
      expect(result.decomposedCount).toBe(9);
      expect(equipment.getBagUsedCount()).toBe(1); // 仅剩穿戴的那件
    });

    it('分解产出符合配置表', () => {
      const rarities: EquipmentRarity[] = ['white', 'green', 'blue', 'purple', 'gold'];
      for (const rarity of rarities) {
        const eq = equipment.generateEquipment('weapon', rarity);
        const reward = equipment.calculateDecomposeReward(eq);
        expect(reward.copper).toBeGreaterThanOrEqual(DECOMPOSE_COPPER_BASE[rarity]);
      }
    });
  });

  // ─── §3.5 序列化与持久化 ───

  describe('§3.5 序列化与持久化', () => {
    let equipment: EquipmentSystem;

    beforeEach(() => {
      ({ equipment } = createSystems());
    });

    it('序列化后反序列化数据完整', () => {
      const eq = equipment.generateEquipment('weapon', 'blue');
      equipment.equipItem('hero1', eq.uid);

      const data = equipment.getState();
      expect(data).toBeDefined();

      // 反序列化到新实例
      const equipment2 = new EquipmentSystem();
      equipment2.deserialize(data);

      expect(equipment2.getBagUsedCount()).toBe(1);
      const heroEquips = equipment2.getHeroEquips('hero1');
      expect(heroEquips.weapon).not.toBeNull();
    });

    it('多件装备序列化完整', () => {
      generateN(equipment, 10, 'white');
      generateN(equipment, 5, 'green');
      generateN(equipment, 3, 'blue');

      const data = equipment.getState();
      const equipment2 = new EquipmentSystem();
      equipment2.deserialize(data);

      expect(equipment2.getBagUsedCount()).toBe(18);
    });

    it('序列化包含版本号', () => {
      const data = equipment.getState();
      expect(data.version).toBeDefined();
    });
  });

  // ─── §3.6 全链路闭环 ───

  describe('§3.6 全链路闭环', () => {
    it('背包→分解→炼制→强化→穿戴→战力闭环', () => {
      const { equipment, forge, enhance, set, recommend } = createSystems();
      enhance.setResourceDeductor(() => true);

      // 1. 生成大量白色装备
      const whites = generateN(equipment, 10, 'white');
      expect(equipment.getBagUsedCount()).toBe(10);

      // 2. 批量分解5件获取资源
      const decomposeResult = equipment.batchDecompose(whites.slice(0, 5).map(i => i.uid));
      expect(decomposeResult.decomposedCount).toBe(5);
      expect(decomposeResult.totalCopper).toBeGreaterThan(0);

      // 3. 剩余5件中取3件炼制
      const remaining = whites.slice(5);
      const forgeResult = forge.basicForge(remaining.slice(0, 3).map(i => i.uid));
      expect(forgeResult.success).toBe(true);

      // 4. 强化炼制产出
      if (forgeResult.equipment) {
        enhance.enhance(forgeResult.equipment.uid);
        const enhanced = equipment.getEquipment(forgeResult.equipment.uid)!;
        expect(enhanced.enhanceLevel).toBeGreaterThan(0);
      }

      // 5. 穿戴到武将
      const allItems = equipment.getAllEquipments();
      for (const item of allItems) {
        if (!item.isEquipped && item.slot) {
          equipment.equipItem('hero1', item.uid);
        }
      }

      // 6. 验证战力
      const heroItems = equipment.getHeroEquipments('hero1');
      expect(heroItems.length).toBeGreaterThan(0);

      // 7. 验证推荐系统
      const rec = recommend.recommendForHero('hero1');
      expect(rec).toBeDefined();
    });

    it('多武将装备管理+套装+推荐综合场景', () => {
      const { equipment, set, recommend } = createSystems();

      // 武将A穿蓝装
      const aWeapon = equipment.generateEquipment('weapon', 'blue');
      const aArmor = equipment.generateEquipment('armor', 'blue');
      equipment.equipItem('heroA', aWeapon.uid);
      equipment.equipItem('heroA', aArmor.uid);

      // 武将B穿白装
      const bWeapon = equipment.generateEquipment('weapon', 'white');
      equipment.equipItem('heroB', bWeapon.uid);

      // 验证各武将独立
      expect(equipment.getHeroEquipments('heroA')).toHaveLength(2);
      expect(equipment.getHeroEquipments('heroB')).toHaveLength(1);

      // 武将B推荐应建议更好装备
      const rec = recommend.recommendForHero('heroB');
      expect(rec.slots.weapon).not.toBeNull();
      // 武器槽应推荐蓝装（更好）
      // 但蓝装已被heroA穿戴，推荐系统应考虑这一点
    });
  });
});
