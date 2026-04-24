/**
 * 装备系统 v10.0 — 集成测试 §5~§6
 * 强化 / 炼制 / 分解
 *
 * 验证：
 *   §5 强化成功率、降级保护、自动强化、强化转移、一键强化
 *   §6 炼制配方、分解产出、保底机制
 *
 * @integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EquipmentSystem } from '../../EquipmentSystem';
import { EquipmentForgeSystem } from '../../EquipmentForgeSystem';
import { EquipmentEnhanceSystem } from '../../EquipmentEnhanceSystem';
import type {
  EquipmentSlot,
  EquipmentRarity,
  EquipmentInstance,
} from '../../../../core/equipment';
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_RARITIES,
  RARITY_ORDER,
} from '../../../../core/equipment';
import {
  ENHANCE_CONFIG,
  RARITY_ENHANCE_CAP,
  DECOMPOSE_COPPER_BASE,
  DECOMPOSE_STONE_BASE,
  DECOMPOSE_ENHANCE_BONUS,
  FORGE_PITY_THRESHOLDS,
  TRANSFER_COST_FACTOR,
  TRANSFER_LEVEL_LOSS,
} from '../../../../core/equipment';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

function createSystems() {
  const equipment = new EquipmentSystem();
  const forge = new EquipmentForgeSystem(equipment);
  const enhance = new EquipmentEnhanceSystem(equipment);
  return { equipment, forge, enhance };
}

/** 生成指定品质装备（不入背包，用于炼制输入） */
function genEq(sys: EquipmentSystem, rarity: EquipmentRarity, seed: number = 42): EquipmentInstance {
  const eq = sys.generateEquipment('weapon', rarity, 'campaign_drop', seed);
  expect(eq).not.toBeNull();
  return eq!;
}

/** 生成N件同品质装备用于炼制 */
function genForgeInputs(sys: EquipmentSystem, count: number, rarity: EquipmentRarity, startSeed: number = 100): EquipmentInstance[] {
  const items: EquipmentInstance[] = [];
  for (let i = 0; i < count; i++) {
    const slot = EQUIPMENT_SLOTS[i % EQUIPMENT_SLOTS.length];
    const eq = sys.generateEquipment(slot, rarity, 'campaign_drop', startSeed + i);
    if (eq) items.push(eq);
  }
  return items;
}

// ═══════════════════════════════════════════════
// §5 强化系统
// ═══════════════════════════════════════════════

describe('§5 强化系统', () => {
  let equipment: EquipmentSystem;
  let enhance: EquipmentEnhanceSystem;

  beforeEach(() => {
    const systems = createSystems();
    equipment = systems.equipment;
    enhance = systems.enhance;
  });

  describe('§5.1 强化成功率', () => {
    it('0→1级成功率应为100%', () => {
      expect(enhance.getSuccessRate(0)).toBe(1.0);
    });

    it('1→2级成功率应为100%', () => {
      expect(enhance.getSuccessRate(1)).toBe(1.0);
    });

    it('高等级成功率应低于低等级', () => {
      const low = enhance.getSuccessRate(3);
      const high = enhance.getSuccessRate(10);
      expect(high).toBeLessThan(low);
    });

    it('成功率曲线应覆盖15级', () => {
      expect(ENHANCE_CONFIG.successRates.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe('§5.2 基础强化', () => {
    it('强化不存在的装备应返回fail', () => {
      const result = enhance.enhance('nonexistent_uid');
      expect(result.outcome).toBe('fail');
    });

    it('0→1级强化应成功（100%成功率）', () => {
      const eq = genEq(equipment, 'green');
      const result = enhance.enhance(eq.uid);
      expect(result.outcome).toBe('success');
      expect(result.currentLevel).toBe(1);
    });

    it('1→2级强化应成功（100%成功率）', () => {
      const eq = genEq(equipment, 'green');
      enhance.enhance(eq.uid); // 0→1
      const result = enhance.enhance(eq.uid); // 1→2
      expect(result.outcome).toBe('success');
      expect(result.currentLevel).toBe(2);
    });

    it('强化后装备属性应增加', () => {
      const eq = genEq(equipment, 'blue');
      const powerBefore = equipment.calculatePower(eq);
      // 强化3级以确保属性差异明显（避免浮点取整导致差异为0）
      enhance.enhance(eq.uid); // 0→1
      enhance.enhance(eq.uid); // 1→2
      enhance.enhance(eq.uid); // 2→3
      const updated = equipment.getEquipment(eq.uid)!;
      const powerAfter = equipment.calculatePower(updated);
      expect(powerAfter).toBeGreaterThan(powerBefore);
    });

    it('强化消耗铜钱应随等级增长', () => {
      const cost0 = enhance.getCopperCost(0);
      const cost5 = enhance.getCopperCost(5);
      expect(cost5).toBeGreaterThan(cost0);
    });

    it('强化消耗强化石应随等级增长', () => {
      const cost0 = enhance.getStoneCost(0);
      const cost5 = enhance.getStoneCost(5);
      expect(cost5).toBeGreaterThan(cost0);
    });
  });

  describe('§5.3 品质强化上限', () => {
    it('白色装备强化上限应为5', () => {
      expect(RARITY_ENHANCE_CAP.white).toBe(5);
    });

    it('绿色装备强化上限应为8', () => {
      expect(RARITY_ENHANCE_CAP.green).toBe(8);
    });

    it('金色装备强化上限应为15', () => {
      expect(RARITY_ENHANCE_CAP.gold).toBe(15);
    });

    it('达到品质上限后强化应失败', () => {
      const eq = genEq(equipment, 'white');
      // 手动设置到上限
      equipment.updateEquipment({ ...eq, enhanceLevel: RARITY_ENHANCE_CAP.white });
      const result = enhance.enhance(eq.uid);
      expect(result.outcome).toBe('fail');
    });
  });

  describe('§5.4 降级保护', () => {
    it('安全等级内失败不应降级', () => {
      // safeLevel = 5, 在安全等级内失败不会降级
      // 但0-2级100%成功率，3级以上才有失败可能
      // 测试：装备在安全等级内，即使失败也不降
      const eq = genEq(equipment, 'green');
      // 手动设置到安全等级
      equipment.updateEquipment({ ...eq, enhanceLevel: 3 });
      // 多次强化，如果有失败，不应降级
      for (let i = 0; i < 20; i++) {
        const current = equipment.getEquipment(eq.uid)!;
        if (current.enhanceLevel >= ENHANCE_CONFIG.safeLevel) break;
        enhance.enhance(eq.uid);
        const updated = equipment.getEquipment(eq.uid)!;
        // 在安全等级内，等级不应低于初始值
        expect(updated.enhanceLevel).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('§5.5 保护符', () => {
    it('添加保护符应增加库存', () => {
      enhance.addProtection(5);
      expect(enhance.getProtectionCount()).toBe(5);
    });

    it('保护符消耗查询', () => {
      const cost = enhance.getProtectionCost(6);
      expect(cost).toBeGreaterThan(0);
    });

    it('安全等级以下不需要保护符', () => {
      for (let i = 0; i <= ENHANCE_CONFIG.safeLevel; i++) {
        expect(enhance.getProtectionCost(i)).toBe(0);
      }
    });
  });

  describe('§5.6 自动强化', () => {
    it('自动强化到目标等级应成功', () => {
      const eq = genEq(equipment, 'green');
      const result = enhance.autoEnhance(eq.uid, {
        targetLevel: 3,
        maxCopper: 100000,
        maxStone: 1000,
        useProtection: false,
        protectionThreshold: 6,
      });
      expect(result.finalLevel).toBe(3);
      expect(result.steps.length).toBeGreaterThanOrEqual(3);
    });

    it('自动强化应受铜钱上限约束', () => {
      const eq = genEq(equipment, 'green');
      const result = enhance.autoEnhance(eq.uid, {
        targetLevel: 10,
        maxCopper: 1, // 极少铜钱
        maxStone: 1000,
        useProtection: false,
        protectionThreshold: 6,
      });
      // 应因铜钱不足而提前停止
      expect(result.finalLevel).toBeLessThan(10);
    });

    it('自动强化不存在的装备应返回空结果', () => {
      const result = enhance.autoEnhance('nonexistent', {
        targetLevel: 5,
        maxCopper: 10000,
        maxStone: 100,
        useProtection: false,
        protectionThreshold: 6,
      });
      expect(result.steps.length).toBe(0);
      expect(result.finalLevel).toBe(0);
    });
  });

  describe('§5.7 强化转移', () => {
    it('转移强化等级应成功', () => {
      const source = genEq(equipment, 'blue', 10);
      const target = genEq(equipment, 'blue', 20);
      // 强化源装备到5级
      equipment.updateEquipment({ ...source, enhanceLevel: 5 });
      const result = enhance.transferEnhance(source.uid, target.uid);
      expect(result.success).toBe(true);
      expect(result.transferredLevel).toBe(5 - TRANSFER_LEVEL_LOSS);
    });

    it('转移后源装备等级应归零', () => {
      const source = genEq(equipment, 'blue', 10);
      const target = genEq(equipment, 'blue', 20);
      equipment.updateEquipment({ ...source, enhanceLevel: 5 });
      enhance.transferEnhance(source.uid, target.uid);
      const srcUpdated = equipment.getEquipment(source.uid)!;
      expect(srcUpdated.enhanceLevel).toBe(0);
    });

    it('转移费用应为等级×系数', () => {
      const source = genEq(equipment, 'blue', 10);
      const target = genEq(equipment, 'blue', 20);
      equipment.updateEquipment({ ...source, enhanceLevel: 5 });
      const result = enhance.transferEnhance(source.uid, target.uid);
      expect(result.cost).toBe(5 * TRANSFER_COST_FACTOR);
    });

    it('源装备等级为0时转移应失败', () => {
      const source = genEq(equipment, 'blue', 10);
      const target = genEq(equipment, 'blue', 20);
      const result = enhance.transferEnhance(source.uid, target.uid);
      expect(result.success).toBe(false);
    });
  });

  describe('§5.8 一键强化', () => {
    it('批量强化应返回每个装备的结果', () => {
      const eq1 = genEq(equipment, 'green', 10);
      const eq2 = genEq(equipment, 'green', 20);
      const results = enhance.batchEnhance([eq1.uid, eq2.uid]);
      expect(results.length).toBe(2);
    });

    it('空列表批量强化应返回空结果', () => {
      const results = enhance.batchEnhance([]);
      expect(results.length).toBe(0);
    });
  });

  describe('§5.9 强化存档', () => {
    it('序列化应包含保护符数量', () => {
      enhance.addProtection(3);
      const data = enhance.serialize();
      expect(data.protectionCount).toBe(3);
    });

    it('反序列化应恢复保护符数量', () => {
      enhance.addProtection(5);
      const data = enhance.serialize();
      enhance.reset();
      expect(enhance.getProtectionCount()).toBe(0);
      enhance.deserialize(data);
      expect(enhance.getProtectionCount()).toBe(5);
    });
  });
});

// ═══════════════════════════════════════════════
// §6 炼制与分解
// ═══════════════════════════════════════════════

describe('§6 炼制与分解', () => {
  let equipment: EquipmentSystem;
  let forge: EquipmentForgeSystem;

  beforeEach(() => {
    const systems = createSystems();
    equipment = systems.equipment;
    forge = systems.forge;
  });

  describe('§6.1 基础炼制', () => {
    it('3件白色装备基础炼制应成功', () => {
      const inputs = genForgeInputs(equipment, 3, 'white', 100);
      const uids = inputs.map(e => e.uid);
      const result = forge.basicForge(uids);
      expect(result.success).toBe(true);
      expect(result.equipment).not.toBeNull();
    });

    it('炼制产出品质应高于输入品质', () => {
      // 多次测试统计
      let higherCount = 0;
      const trials = 20;
      for (let t = 0; t < trials; t++) {
        const inputs = genForgeInputs(equipment, 3, 'white', 1000 + t * 10);
        const uids = inputs.map(e => e.uid);
        const result = forge.basicForge(uids);
        if (result.success && result.equipment) {
          if (RARITY_ORDER[result.equipment.rarity] > RARITY_ORDER.white) {
            higherCount++;
          }
        }
      }
      // 大部分应产出更高品质
      expect(higherCount).toBeGreaterThan(trials * 0.5);
    });

    it('投入数量不正确应失败', () => {
      const inputs = genForgeInputs(equipment, 2, 'white', 100);
      const result = forge.basicForge(inputs.map(e => e.uid));
      expect(result.success).toBe(false);
    });

    it('品质不一致应失败', () => {
      const eq1 = genEq(equipment, 'white', 10);
      const eq2 = genEq(equipment, 'white', 20);
      const eq3 = genEq(equipment, 'green', 30);
      const result = forge.basicForge([eq1.uid, eq2.uid, eq3.uid]);
      expect(result.success).toBe(false);
    });

    it('金色装备不可炼制', () => {
      const inputs = genForgeInputs(equipment, 3, 'gold', 100);
      const result = forge.basicForge(inputs.map(e => e.uid));
      expect(result.success).toBe(false);
    });

    it('已穿戴装备不可作为炼制材料', () => {
      const inputs = genForgeInputs(equipment, 3, 'white', 100);
      equipment.equipItem('hero_1', inputs[0].uid);
      const result = forge.basicForge(inputs.map(e => e.uid));
      expect(result.success).toBe(false);
    });

    it('炼制应消耗输入装备', () => {
      const inputs = genForgeInputs(equipment, 3, 'white', 100);
      const uids = inputs.map(e => e.uid);
      forge.basicForge(uids);
      // 输入装备应被移除
      for (const uid of uids) {
        expect(equipment.getEquipment(uid)).toBeUndefined();
      }
    });
  });

  describe('§6.2 高级炼制', () => {
    it('5件白色装备高级炼制应成功', () => {
      const inputs = genForgeInputs(equipment, 5, 'white', 200);
      const result = forge.advancedForge(inputs.map(e => e.uid));
      expect(result.success).toBe(true);
      expect(result.equipment).not.toBeNull();
    });

    it('高级炼制产出品质应优于基础炼制（统计）', () => {
      let basicTotal = 0;
      let advancedTotal = 0;
      const trials = 20;

      for (let t = 0; t < trials; t++) {
        const basicInputs = genForgeInputs(equipment, 3, 'white', 3000 + t * 10);
        const basicResult = forge.basicForge(basicInputs.map(e => e.uid));
        if (basicResult.equipment) basicTotal += RARITY_ORDER[basicResult.equipment.rarity];

        const advInputs = genForgeInputs(equipment, 5, 'white', 4000 + t * 10);
        const advResult = forge.advancedForge(advInputs.map(e => e.uid));
        if (advResult.equipment) advancedTotal += RARITY_ORDER[advResult.equipment.rarity];
      }
      // 高级炼制平均品质应更高
      expect(advancedTotal).toBeGreaterThanOrEqual(basicTotal);
    });
  });

  describe('§6.3 定向炼制', () => {
    it('指定部位的定向炼制应成功', () => {
      const inputs = genForgeInputs(equipment, 3, 'blue', 500);
      const result = forge.targetedForge(inputs.map(e => e.uid), 'weapon');
      expect(result.success).toBe(true);
      if (result.equipment) {
        expect(result.equipment.slot).toBe('weapon');
      }
    });

    it('定向炼制成本应高于基础炼制', () => {
      const basicCost = forge.getForgeCost('basic');
      const targetedCost = forge.getForgeCost('targeted');
      expect(targetedCost.copper).toBeGreaterThan(basicCost.copper);
    });
  });

  describe('§6.4 炼制费用查询', () => {
    it('基础炼制费用预览应正确', () => {
      const preview = forge.getForgeCostPreview('basic');
      expect(preview.inputCount).toBe(3);
      expect(preview.copper).toBeGreaterThan(0);
    });

    it('高级炼制需要5件输入', () => {
      const preview = forge.getForgeCostPreview('advanced');
      expect(preview.inputCount).toBe(5);
    });

    it('定向炼制需要3件输入', () => {
      const preview = forge.getForgeCostPreview('targeted');
      expect(preview.inputCount).toBe(3);
    });
  });

  describe('§6.5 分解系统', () => {
    it('分解白色装备应产出铜钱和强化石', () => {
      const eq = genEq(equipment, 'white');
      // 先卸下（generateEquipment自动入袋，但未穿戴）
      const result = equipment.decompose(eq.uid);
      expect(result.success).toBe(true);
      if (result.result) {
        expect(result.result.copper).toBeGreaterThan(0);
        expect(result.result.enhanceStone).toBeGreaterThan(0);
      }
    });

    it('高品质装备分解产出应更多', () => {
      const white = genEq(equipment, 'white', 10);
      const gold = genEq(equipment, 'gold', 20);

      const whiteReward = equipment.calculateDecomposeReward(white);
      const goldReward = equipment.calculateDecomposeReward(gold);

      expect(goldReward.copper).toBeGreaterThan(whiteReward.copper);
      expect(goldReward.enhanceStone).toBeGreaterThan(whiteReward.enhanceStone);
    });

    it('强化等级增加分解产出', () => {
      const eq = genEq(equipment, 'blue');
      const baseReward = equipment.calculateDecomposeReward(eq);

      const enhanced = { ...eq, enhanceLevel: 5 };
      const enhancedReward = equipment.calculateDecomposeReward(enhanced);

      expect(enhancedReward.copper).toBeGreaterThan(baseReward.copper);
    });

    it('已穿戴装备不可分解', () => {
      const eq = genEq(equipment, 'white');
      equipment.equipItem('hero_1', eq.uid);
      const result = equipment.decompose(eq.uid);
      expect(result.success).toBe(false);
    });

    it('分解不存在的装备应失败', () => {
      const result = equipment.decompose('nonexistent_uid');
      expect(result.success).toBe(false);
    });

    it('分解预览应与实际产出一致', () => {
      const eq = genEq(equipment, 'green');
      const preview = equipment.getDecomposePreview(eq.uid);
      const result = equipment.decompose(eq.uid);
      if (preview && result.result) {
        expect(result.result.copper).toBe(preview.copper);
        expect(result.result.enhanceStone).toBe(preview.enhanceStone);
      }
    });
  });

  describe('§6.6 批量分解', () => {
    it('批量分解应返回汇总结果', () => {
      const items = genForgeInputs(equipment, 5, 'white', 600);
      const uids = items.map(e => e.uid);
      const result = equipment.batchDecompose(uids);
      expect(result.total.copper).toBeGreaterThan(0);
      expect(result.decomposedUids.length).toBeGreaterThan(0);
    });

    it('批量分解应跳过已穿戴装备', () => {
      const items = genForgeInputs(equipment, 5, 'white', 700);
      equipment.equipItem('hero_1', items[0].uid);
      const uids = items.map(e => e.uid);
      const result = equipment.batchDecompose(uids);
      expect(result.skippedUids).toContain(items[0].uid);
      expect(result.decomposedUids).not.toContain(items[0].uid);
    });
  });

  describe('§6.7 保底机制', () => {
    it('初始保底计数应为0', () => {
      const pity = forge.getPityState();
      expect(pity.basicBluePity).toBe(0);
      expect(pity.advancedPurplePity).toBe(0);
      expect(pity.targetedGoldPity).toBe(0);
    });

    it('保底阈值应已配置', () => {
      expect(FORGE_PITY_THRESHOLDS.basicBluePity).toBeGreaterThan(0);
      expect(FORGE_PITY_THRESHOLDS.advancedPurplePity).toBeGreaterThan(0);
      expect(FORGE_PITY_THRESHOLDS.targetedGoldPity).toBeGreaterThan(0);
    });

    it('连续炼制后保底计数应增加', () => {
      const initialPity = forge.getPityState();
      // 炼制一次
      const inputs = genForgeInputs(equipment, 3, 'white', 800);
      forge.basicForge(inputs.map(e => e.uid));
      const afterPity = forge.getPityState();
      // 保底计数应变化（增加或重置）
      const changed = afterPity.basicBluePity !== initialPity.basicBluePity;
      expect(changed).toBe(true);
    });

    it('炼制总次数应递增', () => {
      expect(forge.getTotalForgeCount()).toBe(0);
      const inputs = genForgeInputs(equipment, 3, 'white', 900);
      forge.basicForge(inputs.map(e => e.uid));
      expect(forge.getTotalForgeCount()).toBe(1);
    });
  });

  describe('§6.8 炼制存档', () => {
    it('序列化应包含保底状态', () => {
      const state = forge.getState();
      expect(state.pityState).toBeDefined();
      expect(state.totalForgeCount).toBeDefined();
    });

    it('重置后保底计数应归零', () => {
      const inputs = genForgeInputs(equipment, 3, 'white', 950);
      forge.basicForge(inputs.map(e => e.uid));
      forge.reset();
      const pity = forge.getPityState();
      expect(pity.basicBluePity).toBe(0);
      expect(forge.getTotalForgeCount()).toBe(0);
    });
  });
});
