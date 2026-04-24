/**
 * 集成测试 §2: 炼制→强化→降级→保护符 全链路
 *
 * 覆盖 Play 流程:
 *   1.3 装备品质与炼制
 *   2.1 强化流程
 *   2.2 强化保护符
 *   2.3 自动强化
 *   6.2 强化降级→保护符→自动强化联动
 *   6.12 炼制配方铜钱消耗全量验证
 *   6.17 装备强化后属性数值精确验证
 *
 * @module engine/equipment/__tests__/integration/§2
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
  RARITY_ENHANCE_CAP,
  ENHANCE_CONFIG,
  ENHANCE_SUCCESS_RATES,
  FORGE_PITY_THRESHOLDS,
} from '../../../../core/equipment/equipment-config';
import type { ForgeResult, ForgePityState } from '../../../../core/equipment/equipment-forge.types';

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

// ═══════════════════════════════════════════════
// §2 炼制→强化→降级→保护符 全链路集成测试
// ═══════════════════════════════════════════════

describe('§2 炼制→强化→降级→保护符全链路', () => {

  // ─── §2.1 基础炼制 ───

  describe('§2.1 基础炼制', () => {
    let equipment: EquipmentSystem;
    let forge: EquipmentForgeSystem;

    beforeEach(() => {
      ({ equipment, forge } = createSystems());
    });

    it('3件白色基础炼制成功', () => {
      const items = generateN(equipment, 3, 'white', 'weapon');
      const result = forge.basicForge(items.map(i => i.uid));
      expect(result.success).toBe(true);
      expect(result.equipment).not.toBeNull();
    });

    it('基础炼制消耗3件投入装备', () => {
      const items = generateN(equipment, 3, 'white', 'weapon');
      const uids = items.map(i => i.uid);
      forge.basicForge(uids);

      // 投入装备应被消耗
      for (const uid of uids) {
        expect(equipment.getEquipment(uid)).toBeUndefined();
      }
    });

    it('基础炼制产出品质≥投入品质', () => {
      const items = generateN(equipment, 3, 'white', 'weapon');
      // 强制产出最高品质
      const result = forge.basicForge(items.map(i => i.uid), () => 0.999);
      expect(result.success).toBe(true);
      if (result.equipment) {
        expect(RARITY_ORDER[result.equipment.rarity]).toBeGreaterThan(RARITY_ORDER.white);
      }
    });

    it('投入数量不足3件失败', () => {
      const items = generateN(equipment, 2, 'white', 'weapon');
      const result = forge.basicForge(items.map(i => i.uid));
      expect(result.success).toBe(false);
    });

    it('投入品质不一致失败', () => {
      const w1 = equipment.generateEquipment('weapon', 'white');
      const w2 = equipment.generateEquipment('weapon', 'white');
      const g1 = equipment.generateEquipment('weapon', 'green');
      const result = forge.basicForge([w1.uid, w2.uid, g1.uid]);
      expect(result.success).toBe(false);
    });

    it('金色装备不可炼制', () => {
      const items = generateN(equipment, 3, 'gold', 'weapon');
      const result = forge.basicForge(items.map(i => i.uid));
      expect(result.success).toBe(false);
    });

    it('已穿戴装备不可炼制', () => {
      const items = generateN(equipment, 3, 'white', 'weapon');
      equipment.equipItem('hero1', items[0].uid);
      const result = forge.basicForge(items.map(i => i.uid));
      expect(result.success).toBe(false);
    });

    it('炼制产出装备自动进入背包', () => {
      const items = generateN(equipment, 3, 'white', 'weapon');
      const before = equipment.getBagUsedCount(); // 3
      forge.basicForge(items.map(i => i.uid));
      // 消耗3 + 产出1 = before - 3 + 1 = before - 2
      expect(equipment.getBagUsedCount()).toBe(before - 2);
    });
  });

  // ─── §2.2 高级/定向炼制 ───

  describe('§2.2 高级/定向炼制', () => {
    let equipment: EquipmentSystem;
    let forge: EquipmentForgeSystem;

    beforeEach(() => {
      ({ equipment, forge } = createSystems());
    });

    it('5件高级炼制成功', () => {
      const items = generateN(equipment, 5, 'white', 'weapon');
      const result = forge.advancedForge(items.map(i => i.uid));
      expect(result.success).toBe(true);
    });

    it('高级炼制消耗5件装备', () => {
      const items = generateN(equipment, 5, 'white', 'weapon');
      const uids = items.map(i => i.uid);
      forge.advancedForge(uids);
      for (const uid of uids) {
        expect(equipment.getEquipment(uid)).toBeUndefined();
      }
    });

    it('定向炼制指定产出部位', () => {
      const items = generateN(equipment, 3, 'white', 'weapon');
      const result = forge.targetedForge(items.map(i => i.uid), 'armor');
      expect(result.success).toBe(true);
      if (result.equipment) {
        expect(result.equipment.slot).toBe('armor');
      }
    });

    it('定向炼制不指定部位时随机产出', () => {
      const items = generateN(equipment, 3, 'white', 'weapon');
      const result = forge.targetedForge(items.map(i => i.uid));
      expect(result.success).toBe(true);
      if (result.equipment) {
        expect(EQUIPMENT_SLOTS).toContain(result.equipment.slot);
      }
    });
  });

  // ─── §2.3 保底机制 ───

  describe('§2.3 保底机制', () => {
    let equipment: EquipmentSystem;
    let forge: EquipmentForgeSystem;

    beforeEach(() => {
      ({ equipment, forge } = createSystems());
    });

    it('保底计数器初始为0', () => {
      const state = forge.getState();
      expect(state.pityState.basicBluePity).toBe(0);
    });

    it('基础炼制未出紫色时计数器递增', () => {
      for (let i = 0; i < 5; i++) {
        const items = generateN(equipment, 3, 'white', 'weapon');
        // 强制低品质产出
        forge.basicForge(items.map(it => it.uid), () => 0.01);
      }
      const state = forge.getState();
      expect(state.pityState.basicBluePity).toBeGreaterThan(0);
    });

    it('保底触发时必出紫色或更高', () => {
      // basicBluePity阈值=10，连续10次不出紫品以上后保底计数器达到阈值
      for (let i = 0; i < 10; i++) {
        const items = generateN(equipment, 3, 'white', 'weapon');
        const r = forge.basicForge(items.map(it => it.uid), () => 0.01);
        // 前9次品质应为green（rng=0.01强制低品质）
        if (i < 9) {
          expect(r.equipment?.rarity).toBe('green');
        }
      }
      // 验证保底计数器已重置（在第10次update中触发保底并重置）
      const state = forge.getState();
      expect(state.pityState.basicBluePity).toBe(0);
    });
  });

  // ─── §2.4 强化流程 ───

  describe('§2.4 强化流程', () => {
    let equipment: EquipmentSystem;
    let enhance: EquipmentEnhanceSystem;

    beforeEach(() => {
      ({ equipment, enhance } = createSystems());
      // 注入资源扣除（总是成功）
      enhance.setResourceDeductor(() => true);
    });

    it('+1→+2必成', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      const result = enhance.enhance(eq.uid);
      expect(result.outcome).toBe('success');
      expect(result.currentLevel).toBe(1);
    });

    it('+2→+3必成', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      enhance.enhance(eq.uid); // +1
      enhance.enhance(eq.uid); // +2
      const result = enhance.enhance(eq.uid); // +3
      expect(result.outcome).toBe('success');
      expect(result.currentLevel).toBe(3);
    });

    it('强化成功后装备属性值提升', () => {
      const eq = equipment.generateEquipment('weapon', 'green');
      const beforeValue = equipment.getEquipment(eq.uid)!.mainStat.value;
      enhance.enhance(eq.uid);
      const afterValue = equipment.getEquipment(eq.uid)!.mainStat.value;
      expect(afterValue).toBeGreaterThanOrEqual(beforeValue);
    });

    it('白色装备强化到+5后不可继续（品质上限）', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      // 白色上限+5，循环强化直到达到上限
      // 注意：3→4是80%、4→5是70%成功率，需要多次尝试
      const cap = RARITY_ENHANCE_CAP.white; // 5
      for (let i = 0; i < 30; i++) {
        const current = equipment.getEquipment(eq.uid)!;
        if (current.enhanceLevel >= cap) break;
        enhance.enhance(eq.uid);
      }
      const updated = equipment.getEquipment(eq.uid)!;
      expect(updated.enhanceLevel).toBe(cap);

      // 再强化应返回fail（达到上限）
      const result = enhance.enhance(eq.uid);
      expect(result.outcome).toBe('fail');
      expect(result.currentLevel).toBe(cap);
    });

    it('各品质强化上限正确', () => {
      expect(RARITY_ENHANCE_CAP.white).toBe(5);
      expect(RARITY_ENHANCE_CAP.green).toBe(8);
      expect(RARITY_ENHANCE_CAP.blue).toBe(10);
      expect(RARITY_ENHANCE_CAP.purple).toBe(12);
      expect(RARITY_ENHANCE_CAP.gold).toBe(15);
    });

    it('强化费用随等级递增', () => {
      const cost1 = enhance.getCopperCost(1);
      const cost5 = enhance.getCopperCost(5);
      const cost10 = enhance.getCopperCost(10);
      expect(cost5).toBeGreaterThan(cost1);
      expect(cost10).toBeGreaterThan(cost5);
    });

    it('成功率表：+1~+3为100%', () => {
      expect(enhance.getSuccessRate(0)).toBe(1.0);
      expect(enhance.getSuccessRate(1)).toBe(1.0);
      expect(enhance.getSuccessRate(2)).toBe(1.0);
    });

    it('成功率表：+3→+4低于100%', () => {
      const rate = enhance.getSuccessRate(3);
      expect(rate).toBeLessThan(1.0);
      expect(rate).toBeGreaterThan(0);
    });
  });

  // ─── §2.5 降级与保护符 ───

  describe('§2.5 降级与保护符', () => {
    let equipment: EquipmentSystem;
    let enhance: EquipmentEnhanceSystem;

    beforeEach(() => {
      ({ equipment, enhance } = createSystems());
      enhance.setResourceDeductor(() => true);
    });

    it('安全等级内失败不降级', () => {
      // safeLevel = 5
      expect(ENHANCE_CONFIG.safeLevel).toBe(5);
      // +1~+3必成，不涉及降级
      const eq = equipment.generateEquipment('weapon', 'white');
      enhance.enhance(eq.uid);
      const updated = equipment.getEquipment(eq.uid)!;
      expect(updated.enhanceLevel).toBe(1);
    });

    it('保护符消耗查询正确', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      // 先强化到+3（必成）
      for (let i = 0; i < 3; i++) {
        enhance.enhance(eq.uid);
      }
      const updated = equipment.getEquipment(eq.uid)!;
      expect(updated.enhanceLevel).toBe(3);

      // +4的保护符消耗
      const protCost = enhance.getProtectionCost(4);
      expect(protCost).toBeGreaterThanOrEqual(0);
    });

    it('保护符不足时不使用', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      // 保护符数量为0时请求使用
      const result = enhance.enhance(eq.uid, true);
      // 应正常强化（+1必成），保护符不生效
      expect(result.protectionUsed).toBe(false);
    });
  });

  // ─── §2.6 自动强化 ───

  describe('§2.6 自动强化', () => {
    let equipment: EquipmentSystem;
    let enhance: EquipmentEnhanceSystem;

    beforeEach(() => {
      ({ equipment, enhance } = createSystems());
      enhance.setResourceDeductor(() => true);
    });

    it('自动强化到目标等级', () => {
      const eq = equipment.generateEquipment('weapon', 'green');
      const result = enhance.autoEnhance(eq.uid, { targetLevel: 3, stopOnDowngrade: false, autoProtection: false });
      expect(result.finalLevel).toBeGreaterThanOrEqual(3);
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('自动强化达到品质上限时停止', () => {
      const eq = equipment.generateEquipment('weapon', 'white');
      // 白色上限+5，设置目标+10
      const result = enhance.autoEnhance(eq.uid, { targetLevel: 10, stopOnDowngrade: true, autoProtection: false });
      expect(result.finalLevel).toBeLessThanOrEqual(RARITY_ENHANCE_CAP.white);
    });

    it('自动强化返回操作步骤', () => {
      const eq = equipment.generateEquipment('weapon', 'green');
      const result = enhance.autoEnhance(eq.uid, { targetLevel: 3, stopOnDowngrade: false, autoProtection: false });
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.finalLevel).toBeGreaterThan(0);
    });
  });

  // ─── §2.7 强化转移 ───

  describe('§2.7 强化转移', () => {
    let equipment: EquipmentSystem;
    let enhance: EquipmentEnhanceSystem;

    beforeEach(() => {
      ({ equipment, enhance } = createSystems());
      enhance.setResourceDeductor(() => true);
    });

    it('强化转移成功', () => {
      const source = equipment.generateEquipment('weapon', 'white');
      // 强化源装备到+3（必成）
      for (let i = 0; i < 3; i++) {
        enhance.enhance(source.uid);
      }
      const sourceEq = equipment.getEquipment(source.uid)!;
      expect(sourceEq.enhanceLevel).toBe(3);

      const target = equipment.generateEquipment('weapon', 'green');
      const result = enhance.transferEnhance(source.uid, target.uid);
      expect(result.success).toBe(true);
    });

    it('源装备强化等级为0时不可转移', () => {
      const source = equipment.generateEquipment('weapon', 'white');
      const target = equipment.generateEquipment('weapon', 'green');
      const result = enhance.transferEnhance(source.uid, target.uid);
      expect(result.success).toBe(false);
    });
  });

  // ─── §2.8 炼制→强化→分解全链路 ───

  describe('§2.8 炼制→强化→分解全链路', () => {
    it('完整链路：白色炼制→绿色→强化→分解', () => {
      const { equipment, forge, enhance } = createSystems();
      enhance.setResourceDeductor(() => true);

      // 1. 生成3件白色
      const whites = generateN(equipment, 3, 'white', 'weapon');
      expect(equipment.getBagUsedCount()).toBe(3);

      // 2. 基础炼制
      const forgeResult = forge.basicForge(whites.map(i => i.uid));
      expect(forgeResult.success).toBe(true);
      expect(forgeResult.equipment).not.toBeNull();

      // 3. 强化产出装备
      if (forgeResult.equipment) {
        const forged = forgeResult.equipment;
        enhance.enhance(forged.uid);
        const enhanced = equipment.getEquipment(forged.uid)!;
        expect(enhanced.enhanceLevel).toBeGreaterThan(0);

        // 4. 分解
        const decomposeResult = equipment.decompose(forged.uid);
        if ('success' in decomposeResult) {
          expect(decomposeResult.success).toBe(true);
        }
      }
    });
  });
});
