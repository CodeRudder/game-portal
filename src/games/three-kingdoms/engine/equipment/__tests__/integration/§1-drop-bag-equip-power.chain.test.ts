/**
 * 集成测试 §1: 掉落→背包→穿戴→战力 全链路
 *
 * 覆盖 Play 流程:
 *   1.1 装备获取（关卡掉落）
 *   1.2 装备背包管理
 *   3.2 武将战力计算验证
 *   6.1 关卡掉落→穿戴→战力全链路
 *   6.9 背包满边界验证
 *   6.22 背包满→卸下装备边界
 *   6.23 装备换装→唯一性约束
 *
 * @module engine/equipment/__tests__/integration/§1
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
  BagFilter,
  CampaignType,
} from '../../../../core/equipment/equipment.types';
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_RARITIES,
  RARITY_ORDER,
} from '../../../../core/equipment/equipment.types';
import {
  DEFAULT_BAG_CAPACITY,
} from '../../../../core/equipment/equipment-config';
import {
  EQUIPMENT_TEMPLATES,
  RARITY_MAIN_STAT_MULTIPLIER,
  RARITY_ENHANCE_CAP,
  ENHANCE_CONFIG,
  DECOMPOSE_COPPER_BASE,
  DECOMPOSE_STONE_BASE,
} from '../../../../core/equipment/equipment-config';

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

/** 生成N件指定品质装备到背包 */
function generateN(equipment: EquipmentSystem, count: number, rarity: EquipmentRarity, slot?: EquipmentSlot): EquipmentInstance[] {
  const result: EquipmentInstance[] = [];
  for (let i = 0; i < count; i++) {
    const s = slot ?? EQUIPMENT_SLOTS[i % 4];
    const eq = equipment.generateEquipment(s, rarity);
    if (eq) result.push(eq);
  }
  return result;
}

/** 填满背包 */
function fillBag(equipment: EquipmentSystem, rarity: EquipmentRarity = 'white'): EquipmentInstance[] {
  const items: EquipmentInstance[] = [];
  while (!equipment.isBagFull()) {
    const eq = equipment.generateEquipment('weapon', rarity);
    if (eq) items.push(eq);
  }
  return items;
}

// ═══════════════════════════════════════════════
// §1 掉落→背包→穿戴→战力全链路集成测试
// ═══════════════════════════════════════════════

describe('§1 掉落→背包→穿戴→战力全链路', () => {

  // ─── §1.1 关卡掉落装备生成 ───

  describe('§1.1 关卡掉落装备生成', () => {
    let equipment: EquipmentSystem;

    beforeEach(() => {
      equipment = new EquipmentSystem();
    });

    it('普通关卡掉落装备正确生成', () => {
      const eq = equipment.generateCampaignDrop('normal');
      expect(eq).toBeDefined();
      expect(EQUIPMENT_SLOTS).toContain(eq.slot);
      expect(EQUIPMENT_RARITIES).toContain(eq.rarity);
    });

    it('精英关卡掉落装备正确生成', () => {
      const eq = equipment.generateCampaignDrop('elite');
      expect(eq).toBeDefined();
      expect(EQUIPMENT_SLOTS).toContain(eq.slot);
    });

    it('Boss关卡掉落装备正确生成', () => {
      const eq = equipment.generateCampaignDrop('boss');
      expect(eq).toBeDefined();
      expect(EQUIPMENT_SLOTS).toContain(eq.slot);
    });

    it('关卡掉落装备自动进入背包', () => {
      equipment.generateCampaignDrop('normal');
      expect(equipment.getBagUsedCount()).toBe(1);
    });

    it('多次掉落生成不同装备', () => {
      const eqs: EquipmentInstance[] = [];
      for (let i = 0; i < 10; i++) {
        eqs.push(equipment.generateCampaignDrop('normal'));
      }
      const uids = new Set(eqs.map(e => e.uid));
      expect(uids.size).toBe(10); // 所有UID唯一
    });

    it('装备有完整属性结构', () => {
      const eq = equipment.generateCampaignDrop('boss');
      expect(eq.uid).toBeTruthy();
      expect(eq.slot).toBeTruthy();
      expect(eq.rarity).toBeTruthy();
      expect(eq.mainStat).toBeDefined();
      expect(eq.mainStat.type).toBeTruthy();
      expect(eq.mainStat.value).toBeGreaterThan(0);
      expect(eq.enhanceLevel).toBe(0);
      expect(eq.isEquipped).toBe(false);
    });

    it('装备来源标记为campaign_drop', () => {
      const eq = equipment.generateCampaignDrop('normal');
      expect(eq.source).toBe('campaign_drop');
    });
  });

  // ─── §1.2 背包管理 ───

  describe('§1.2 背包管理', () => {
    let equipment: EquipmentSystem;

    beforeEach(() => {
      equipment = new EquipmentSystem();
    });

    it('初始背包容量为默认值', () => {
      expect(equipment.getBagCapacity()).toBe(DEFAULT_BAG_CAPACITY);
      expect(equipment.getBagUsedCount()).toBe(0);
    });

    it('装备入袋后计数正确', () => {
      generateN(equipment, 5, 'white');
      expect(equipment.getBagUsedCount()).toBe(5);
      expect(equipment.getBagSize()).toBe(5);
    });

    it('按部位筛选装备', () => {
      equipment.generateEquipment('weapon', 'white');
      equipment.generateEquipment('armor', 'white');
      equipment.generateEquipment('weapon', 'green');

      const filter: BagFilter = { slot: 'weapon', rarity: null, unequippedOnly: false, setOnly: false };
      const weapons = equipment.getFilteredEquipments(filter);
      expect(weapons).toHaveLength(2);
      expect(weapons.every(e => e.slot === 'weapon')).toBe(true);
    });

    it('按品质筛选装备', () => {
      equipment.generateEquipment('weapon', 'white');
      equipment.generateEquipment('weapon', 'green');
      equipment.generateEquipment('armor', 'blue');

      const filter: BagFilter = { slot: null, rarity: 'green', unequippedOnly: false, setOnly: false };
      const greens = equipment.getFilteredEquipments(filter);
      expect(greens).toHaveLength(1);
      expect(greens[0].rarity).toBe('green');
    });

    it('仅未穿戴筛选', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      equipment.equipItem('hero1', eq.uid);

      const filter: BagFilter = { slot: null, rarity: null, unequippedOnly: true, setOnly: false };
      const unequipped = equipment.getFilteredEquipments(filter);
      expect(unequipped).toHaveLength(0);
    });

    it('背包扩容增加容量', () => {
      const oldCap = equipment.getBagCapacity();
      const result = equipment.expandBag();
      expect(result.success).toBe(true);
      expect(equipment.getBagCapacity()).toBeGreaterThan(oldCap);
    });

    it('按部位分组装备', () => {
      equipment.generateEquipment('weapon', 'white');
      equipment.generateEquipment('weapon', 'green');
      equipment.generateEquipment('armor', 'white');

      const groups = equipment.groupBySlot();
      expect(groups.weapon).toHaveLength(2);
      expect(groups.armor).toHaveLength(1);
    });

    it('删除装备后背包计数减少', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      expect(equipment.getBagUsedCount()).toBe(1);
      equipment.removeEquipment(eq.uid);
      expect(equipment.getBagUsedCount()).toBe(0);
    });
  });

  // ─── §1.3 背包满边界 ───

  describe('§1.3 背包满边界验证', () => {
    let equipment: EquipmentSystem;

    beforeEach(() => {
      equipment = new EquipmentSystem();
    });

    it('背包满时标记正确', () => {
      fillBag(equipment);
      expect(equipment.isBagFull()).toBe(true);
      expect(equipment.getBagUsedCount()).toBe(equipment.getBagCapacity());
    });

    it('背包满时卸下装备可执行', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      equipment.equipItem('hero1', eq.uid);
      fillBag(equipment); // 填满剩余
      expect(equipment.isBagFull()).toBe(true);

      // 卸下装备：已穿戴的不在背包计数中，所以放回可以
      const result = equipment.unequipItem('hero1', 'weapon');
      expect(result.success).toBe(true);
    });

    it('扩容后可继续添加装备', () => {
      fillBag(equipment);
      const oldCount = equipment.getBagUsedCount();
      equipment.expandBag();
      const eq = equipment.generateEquipment('weapon', 'white');
      expect(equipment.getBagUsedCount()).toBeGreaterThan(oldCount);
    });

    it('炼制消耗>产出，背包满时仍可炼制', () => {
      const { equipment: eqSys, forge } = createSystems();
      // 生成3件白色装备
      const items = generateN(eqSys, 3, 'white', 'weapon');
      fillBag(eqSys); // 填满其余

      // 炼制消耗3件产出1件，应可执行
      const result = forge.basicForge(items.map(i => i.uid));
      expect(result.success).toBe(true);
    });
  });

  // ─── §1.4 武将穿戴/卸下 ───

  describe('§1.4 武将穿戴/卸下', () => {
    let equipment: EquipmentSystem;

    beforeEach(() => {
      equipment = new EquipmentSystem();
    });

    it('穿戴装备到武将4个槽位', () => {
      const weapon = equipment.generateEquipment('weapon', 'white');
      const armor = equipment.generateEquipment('armor', 'white');
      const accessory = equipment.generateEquipment('accessory', 'white');
      const mount = equipment.generateEquipment('mount', 'white');

      expect(equipment.equipItem('hero1', weapon.uid).success).toBe(true);
      expect(equipment.equipItem('hero1', armor.uid).success).toBe(true);
      expect(equipment.equipItem('hero1', accessory.uid).success).toBe(true);
      expect(equipment.equipItem('hero1', mount.uid).success).toBe(true);

      const heroEquips = equipment.getHeroEquips('hero1');
      expect(heroEquips.weapon).toBe(weapon.uid);
      expect(heroEquips.armor).toBe(armor.uid);
      expect(heroEquips.accessory).toBe(accessory.uid);
      expect(heroEquips.mount).toBe(mount.uid);
    });

    it('穿戴后装备标记为已穿戴', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      equipment.equipItem('hero1', eq.uid);

      const updated = equipment.getEquipment(eq.uid);
      expect(updated?.isEquipped).toBe(true);
      expect(updated?.equippedHeroId).toBe('hero1');
    });

    it('穿戴新装备自动替换旧装备', () => {
      const old = equipment.generateEquipment('weapon', 'white');
      equipment.equipItem('hero1', old.uid);

      const newer = equipment.generateEquipment('weapon', 'green');
      const result = equipment.equipItem('hero1', newer.uid);
      expect(result.success).toBe(true);
      expect(result.replacedUid).toBe(old.uid);

      // 旧装备应被卸下
      const oldEq = equipment.getEquipment(old.uid);
      expect(oldEq?.isEquipped).toBe(false);
      expect(oldEq?.equippedHeroId).toBeNull();
    });

    it('卸下装备恢复为未穿戴', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      equipment.equipItem('hero1', eq.uid);
      const result = equipment.unequipItem('hero1', 'weapon');
      expect(result.success).toBe(true);

      const updated = equipment.getEquipment(eq.uid);
      expect(updated?.isEquipped).toBe(false);
      expect(updated?.equippedHeroId).toBeNull();
    });

    it('穿戴不存在的装备失败', () => {
      const result = equipment.equipItem('hero1', 'nonexistent');
      expect(result.success).toBe(false);
    });

    it('同一装备不可被两个武将同时穿戴', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      equipment.equipItem('hero1', eq.uid);

      const result = equipment.equipItem('hero2', eq.uid);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('其他武将');
    });

    it('不同武将可穿戴不同装备', () => {
      const w1 = equipment.generateEquipment('weapon', 'white');
      const w2 = equipment.generateEquipment('weapon', 'green');

      expect(equipment.equipItem('hero1', w1.uid).success).toBe(true);
      expect(equipment.equipItem('hero2', w2.uid).success).toBe(true);

      expect(equipment.getHeroEquips('hero1').weapon).toBe(w1.uid);
      expect(equipment.getHeroEquips('hero2').weapon).toBe(w2.uid);
    });

    it('装备无等级限制—1级武将可穿金装', () => {
      const gold = equipment.generateEquipment('weapon', 'gold');
      const result = equipment.equipItem('hero_lv1', gold.uid);
      expect(result.success).toBe(true);
    });

    it('getHeroEquipItems返回4个槽位实例', () => {
      const weapon = equipment.generateEquipment('weapon', 'white');
      equipment.equipItem('hero1', weapon.uid);

      const items = equipment.getHeroEquipItems('hero1');
      expect(items).toHaveLength(4);
      expect(items[0]?.uid).toBe(weapon.uid); // weapon
      expect(items[1]).toBeNull(); // armor
      expect(items[2]).toBeNull(); // accessory
      expect(items[3]).toBeNull(); // mount
    });
  });

  // ─── §1.5 战力计算 ───

  describe('§1.5 战力计算', () => {
    let equipment: EquipmentSystem;

    beforeEach(() => {
      equipment = new EquipmentSystem();
    });

    it('装备有战力值', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      const power = equipment.calculatePower(eq);
      expect(power).toBeGreaterThan(0);
    });

    it('高品质装备战力更高', () => {
      const white = equipment.generateEquipment('weapon', 'white');
      const green = equipment.generateEquipment('weapon', 'green');
      const blue = equipment.generateEquipment('weapon', 'blue');

      const pw = equipment.calculatePower(white);
      const pg = equipment.calculatePower(green);
      const pb = equipment.calculatePower(blue);

      expect(pb).toBeGreaterThan(pg);
      expect(pg).toBeGreaterThan(pw);
    });

    it('强化后战力提升', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      const powerBefore = equipment.calculatePower(eq);

      const enhanced = { ...eq, enhanceLevel: 5 };
      const recalced = equipment.recalcStats(enhanced);
      const powerAfter = equipment.calculatePower(recalced);

      expect(powerAfter).toBeGreaterThan(powerBefore);
    });

    it('主属性受品质倍率影响', () => {
      const white = equipment.generateEquipment('weapon', 'white');
      const gold = equipment.generateEquipment('weapon', 'gold');

      // 金色倍率2.5x vs 白色1.0x
      expect(gold.mainStat.value / white.mainStat.value).toBeGreaterThan(1.5);
    });

    it('全4件装备穿戴后可查询', () => {
      const weapon = equipment.generateEquipment('weapon', 'white');
      const armor = equipment.generateEquipment('armor', 'green');
      const accessory = equipment.generateEquipment('accessory', 'blue');
      const mount = equipment.generateEquipment('mount', 'white');

      equipment.equipItem('hero1', weapon.uid);
      equipment.equipItem('hero1', armor.uid);
      equipment.equipItem('hero1', accessory.uid);
      equipment.equipItem('hero1', mount.uid);

      const heroEquips = equipment.getHeroEquipments('hero1');
      expect(heroEquips).toHaveLength(4);
    });
  });

  // ─── §1.6 全链路贯通 ───

  describe('§1.6 全链路贯通（掉落→穿戴→战力→分解）', () => {
    it('完整链路：掉落→背包→穿戴→战力→卸下→分解', () => {
      const { equipment } = createSystems();

      // 1. 关卡掉落
      const drop = equipment.generateCampaignDrop('normal');
      expect(drop).toBeDefined();
      expect(equipment.getBagUsedCount()).toBe(1);

      // 2. 穿戴到武将
      const equipResult = equipment.equipItem('hero1', drop.uid);
      expect(equipResult.success).toBe(true);

      // 3. 计算战力
      const power = equipment.calculatePower(drop);
      expect(power).toBeGreaterThan(0);

      // 4. 卸下装备
      const unequipResult = equipment.unequipItem('hero1', drop.slot);
      expect(unequipResult.success).toBe(true);

      // 5. 分解装备
      const decomposeResult = equipment.decompose(drop.uid);
      expect(decomposeResult).toHaveProperty('success', true);
      if ('result' in decomposeResult && decomposeResult.result) {
        expect(decomposeResult.result.copper).toBeGreaterThan(0);
      }
    });

    it('多武将多装备并行管理', () => {
      const { equipment } = createSystems();

      // 武将A穿白装
      const a1 = equipment.generateEquipment('weapon', 'white');
      equipment.equipItem('heroA', a1.uid);

      // 武将B穿绿装
      const b1 = equipment.generateEquipment('weapon', 'green');
      equipment.equipItem('heroB', b1.uid);

      // 各自独立
      expect(equipment.getHeroEquips('heroA').weapon).toBe(a1.uid);
      expect(equipment.getHeroEquips('heroB').weapon).toBe(b1.uid);

      // 武将A换装
      const a2 = equipment.generateEquipment('weapon', 'blue');
      const replaceResult = equipment.equipItem('heroA', a2.uid);
      expect(replaceResult.success).toBe(true);
      expect(replaceResult.replacedUid).toBe(a1.uid);

      // 武将B不受影响
      expect(equipment.getHeroEquips('heroB').weapon).toBe(b1.uid);
    });
  });
});
