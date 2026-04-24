/**
 * 装备系统 v10.0 — 集成测试 §11~§15
 * 炼制 / 分解 / 保底
 *
 * 验证：
 *   §11 炼制配方与消耗（基础/高级/定向）
 *   §12 分解系统（单件/批量/产出计算）
 *   §13 保底机制（计数器递增/阈值触发）
 *   §14 炼制+分解闭环（资源循环）
 *   §15 存档序列化（保底状态恢复）
 *
 * @integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EquipmentSystem } from '../../EquipmentSystem';
import { EquipmentForgeSystem } from '../../EquipmentForgeSystem';
import type { EquipmentRarity, EquipmentInstance } from '../../../../core/equipment';
import {
  EQUIPMENT_SLOTS,
  RARITY_ORDER,
  DECOMPOSE_COPPER_BASE,
  DECOMPOSE_STONE_BASE,
  DECOMPOSE_ENHANCE_BONUS,
  FORGE_PITY_THRESHOLDS,
} from '../../../../core/equipment';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function createSystems() {
  const equipment = new EquipmentSystem();
  const forge = new EquipmentForgeSystem(equipment);
  return { equipment, forge };
}

function genEq(sys: EquipmentSystem, rarity: EquipmentRarity, seed: number = 42): EquipmentInstance {
  const eq = sys.generateEquipment('weapon', rarity, 'campaign_drop', seed);
  expect(eq).not.toBeNull();
  return eq!;
}

function genForgeInputs(sys: EquipmentSystem, count: number, rarity: EquipmentRarity, startSeed = 100): EquipmentInstance[] {
  const items: EquipmentInstance[] = [];
  for (let i = 0; i < count; i++) {
    const slot = EQUIPMENT_SLOTS[i % EQUIPMENT_SLOTS.length];
    const eq = sys.generateEquipment(slot, rarity, 'campaign_drop', startSeed + i);
    if (eq) items.push(eq);
  }
  return items;
}

// ═══════════════════════════════════════════════

describe('§11 炼制配方与消耗', () => {
  let equipment: EquipmentSystem;
  let forge: EquipmentForgeSystem;

  beforeEach(() => {
    ({ equipment, forge } = createSystems());
  });

  // §11.1 基础炼制
  it('§11.1 3件白色基础炼制应成功产出更高品质', () => {
    const inputs = genForgeInputs(equipment, 3, 'white', 100);
    const result = forge.basicForge(inputs.map(e => e.uid));
    expect(result.success).toBe(true);
    expect(result.equipment).not.toBeNull();
    expect(RARITY_ORDER[result.equipment!.rarity]).toBeGreaterThan(RARITY_ORDER.white);
  });

  it('§11.2 基础炼制应消耗3件输入装备', () => {
    const inputs = genForgeInputs(equipment, 3, 'green', 110);
    const uids = inputs.map(e => e.uid);
    forge.basicForge(uids);
    for (const uid of uids) expect(equipment.getEquipment(uid)).toBeUndefined();
  });

  it('§11.3 投入数量/品质不一致应失败', () => {
    const two = genForgeInputs(equipment, 2, 'white', 120);
    expect(forge.basicForge(two.map(e => e.uid)).success).toBe(false);

    const mixed = [genEq(equipment, 'white', 130), genEq(equipment, 'white', 131), genEq(equipment, 'green', 132)];
    expect(forge.basicForge(mixed.map(e => e.uid)).success).toBe(false);
  });

  it('§11.4 已穿戴/金色装备不可炼制', () => {
    const inputs = genForgeInputs(equipment, 3, 'white', 140);
    equipment.equipItem('hero_1', inputs[0].uid);
    expect(forge.basicForge(inputs.map(e => e.uid)).success).toBe(false);

    const golds = genForgeInputs(equipment, 3, 'gold', 150);
    expect(forge.basicForge(golds.map(e => e.uid)).success).toBe(false);
  });

  // §11.2 高级/定向炼制
  it('§11.5 5件白色高级炼制应成功', () => {
    const inputs = genForgeInputs(equipment, 5, 'white', 200);
    const result = forge.advancedForge(inputs.map(e => e.uid));
    expect(result.success).toBe(true);
    expect(result.equipment).not.toBeNull();
  });

  it('§11.6 高级炼制产出品质应优于基础炼制（统计20次）', () => {
    let basicSum = 0;
    let advSum = 0;
    for (let t = 0; t < 20; t++) {
      const b = genForgeInputs(equipment, 3, 'white', 3000 + t * 10);
      const br = forge.basicForge(b.map(e => e.uid));
      if (br.equipment) basicSum += RARITY_ORDER[br.equipment.rarity];

      const a = genForgeInputs(equipment, 5, 'white', 4000 + t * 10);
      const ar = forge.advancedForge(a.map(e => e.uid));
      if (ar.equipment) advSum += RARITY_ORDER[ar.equipment.rarity];
    }
    expect(advSum).toBeGreaterThanOrEqual(basicSum);
  });

  it('§11.7 定向炼制指定部位应产出对应装备', () => {
    const inputs = genForgeInputs(equipment, 3, 'blue', 250);
    const result = forge.targetedForge(inputs.map(e => e.uid), 'armor');
    expect(result.success).toBe(true);
    if (result.equipment) expect(result.equipment.slot).toBe('armor');
  });

  it('§11.8 炼制费用预览应正确', () => {
    const basic = forge.getForgeCostPreview('basic');
    expect(basic.inputCount).toBe(3);
    expect(basic.copper).toBe(500);

    const adv = forge.getForgeCostPreview('advanced');
    expect(adv.inputCount).toBe(5);

    const targeted = forge.getForgeCost('targeted');
    expect(targeted.copper).toBeGreaterThan(forge.getForgeCost('basic').copper);
  });
});

// ═══════════════════════════════════════════════

describe('§12 分解系统', () => {
  let equipment: EquipmentSystem;

  beforeEach(() => {
    ({ equipment } = createSystems());
  });

  it('§12.1 分解白色装备应产出铜钱和强化石', () => {
    const eq = genEq(equipment, 'white');
    const result = equipment.decompose(eq.uid);
    expect(result.success).toBe(true);
    if ('result' in result && result.result) {
      expect(result.result.copper).toBe(DECOMPOSE_COPPER_BASE.white);
      expect(result.result.enhanceStone).toBe(DECOMPOSE_STONE_BASE.white);
    }
  });

  it('§12.2 分解后装备应从背包移除', () => {
    const eq = genEq(equipment, 'green');
    equipment.decompose(eq.uid);
    expect(equipment.getEquipment(eq.uid)).toBeUndefined();
  });

  it('§12.3 不存在/已穿戴装备分解应失败', () => {
    expect(equipment.decompose('nonexistent').success).toBe(false);
    const eq = genEq(equipment, 'white');
    equipment.equipItem('hero_1', eq.uid);
    expect(equipment.decompose(eq.uid).success).toBe(false);
  });

  it('§12.4 高品质装备分解产出应更多', () => {
    const white = genEq(equipment, 'white', 10);
    const gold = genEq(equipment, 'gold', 20);
    const wr = equipment.calculateDecomposeReward(white);
    const gr = equipment.calculateDecomposeReward(gold);
    expect(gr.copper).toBeGreaterThan(wr.copper);
    expect(gr.enhanceStone).toBeGreaterThan(wr.enhanceStone);
  });

  it('§12.5 强化等级应按公式增加分解产出', () => {
    const eq = genEq(equipment, 'purple');
    const enhanced = { ...eq, enhanceLevel: 3 };
    const reward = equipment.calculateDecomposeReward(enhanced);
    const bonus = 1 + 3 * DECOMPOSE_ENHANCE_BONUS;
    expect(reward.copper).toBe(Math.floor(DECOMPOSE_COPPER_BASE.purple * bonus));
    expect(reward.enhanceStone).toBe(Math.floor(DECOMPOSE_STONE_BASE.purple * bonus));
  });

  it('§12.6 分解预览应与实际产出一致', () => {
    const eq = genEq(equipment, 'green');
    const preview = equipment.getDecomposePreview(eq.uid);
    const result = equipment.decompose(eq.uid);
    if (preview && 'result' in result && result.result) {
      expect(result.result.copper).toBe(preview.copper);
      expect(result.result.enhanceStone).toBe(preview.enhanceStone);
    }
  });

  it('§12.7 批量分解应返回汇总、跳过已穿戴、全部分解', () => {
    const items = genForgeInputs(equipment, 5, 'white', 600);
    equipment.equipItem('hero_1', items[0].uid);
    const result = equipment.batchDecompose(items.map(e => e.uid));
    expect(result.decomposedUids.length).toBe(4);
    expect(result.skippedUids).toContain(items[0].uid);
    expect(result.total.copper).toBeGreaterThan(0);

    // 全部分解
    const all = genForgeInputs(equipment, 3, 'green', 800);
    const allResult = equipment.decomposeAllUnequipped();
    expect(allResult.decomposedUids.length).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════

describe('§13 保底机制', () => {
  let equipment: EquipmentSystem;
  let forge: EquipmentForgeSystem;

  beforeEach(() => {
    ({ equipment, forge } = createSystems());
  });

  it('§13.1 初始保底计数应为0，阈值已配置', () => {
    const pity = forge.getPityState();
    expect(pity.basicBluePity).toBe(0);
    expect(pity.advancedPurplePity).toBe(0);
    expect(pity.targetedGoldPity).toBe(0);
    expect(FORGE_PITY_THRESHOLDS.basicBluePity).toBe(10);
    expect(FORGE_PITY_THRESHOLDS.targetedGoldPity).toBe(20);
  });

  it('§13.2 炼制后保底计数应变化，总次数递增', () => {
    const before = forge.getPityState().basicBluePity;
    const inputs = genForgeInputs(equipment, 3, 'white', 900);
    forge.basicForge(inputs.map(e => e.uid));
    expect(forge.getPityState().basicBluePity).not.toBe(before);
    expect(forge.getTotalForgeCount()).toBe(1);
  });

  it('§13.3 连续炼制超过阈值后保底应触发并重置', () => {
    let triggered = false;
    for (let i = 0; i < FORGE_PITY_THRESHOLDS.basicBluePity + 5; i++) {
      const inputs = genForgeInputs(equipment, 3, 'white', 6000 + i * 10);
      const result = forge.basicForge(inputs.map(e => e.uid));
      if (result.pityTriggered) triggered = true;
    }
    expect(triggered).toBe(true);
  });
});

// ═══════════════════════════════════════════════

describe('§14 炼制+分解闭环', () => {
  let equipment: EquipmentSystem;
  let forge: EquipmentForgeSystem;

  beforeEach(() => {
    ({ equipment, forge } = createSystems());
  });

  it('§14.1 炼制产出装备可正常分解', () => {
    const inputs = genForgeInputs(equipment, 3, 'white', 1000);
    const forgeResult = forge.basicForge(inputs.map(e => e.uid));
    expect(forgeResult.success).toBe(true);

    const decResult = equipment.decompose(forgeResult.equipment!.uid);
    expect(decResult.success).toBe(true);
    if ('result' in decResult && decResult.result) {
      expect(decResult.result.copper).toBeGreaterThan(0);
    }
  });

  it('§14.2 炼制→分解→再炼制应可行', () => {
    const i1 = genForgeInputs(equipment, 3, 'white', 1100);
    const f1 = forge.basicForge(i1.map(e => e.uid));
    if (f1.equipment) equipment.decompose(f1.equipment.uid);

    const i2 = genForgeInputs(equipment, 3, 'white', 1200);
    const f2 = forge.basicForge(i2.map(e => e.uid));
    expect(f2.success).toBe(true);
    expect(forge.getTotalForgeCount()).toBe(2);
  });

  it('§14.3 炼制消耗应与背包变化一致，批量分解多品质应正确汇总', () => {
    // 炼制消耗 -3+1=-2
    const inputs = genForgeInputs(equipment, 3, 'blue', 1300);
    const before = equipment.getAllEquipments().length;
    forge.basicForge(inputs.map(e => e.uid));
    expect(before - equipment.getAllEquipments().length).toBe(2);

    // 批量分解多品质
    const mixed = [genEq(equipment, 'white', 1400), genEq(equipment, 'green', 1401), genEq(equipment, 'blue', 1402)];
    const result = equipment.batchDecompose(mixed.map(e => e.uid));
    expect(result.decomposedUids.length).toBe(3);
    expect(result.total.copper).toBeGreaterThan(DECOMPOSE_COPPER_BASE.white);
  });
});

// ═══════════════════════════════════════════════

describe('§15 存档序列化', () => {
  let equipment: EquipmentSystem;
  let forge: EquipmentForgeSystem;

  beforeEach(() => {
    ({ equipment, forge } = createSystems());
  });

  it('§15.1 序列化应包含保底状态和炼制计数', () => {
    const inputs = genForgeInputs(equipment, 3, 'white', 1500);
    forge.basicForge(inputs.map(e => e.uid));
    const state = forge.getState();
    expect(state.pityState).toBeDefined();
    expect(state.totalForgeCount).toBe(1);
  });

  it('§15.2 反序列化应恢复保底状态和炼制计数', () => {
    const inputs = genForgeInputs(equipment, 3, 'white', 1600);
    forge.basicForge(inputs.map(e => e.uid));
    const saved = forge.getState();

    forge.reset();
    expect(forge.getTotalForgeCount()).toBe(0);

    forge.deserialize(saved as any);
    expect(forge.getTotalForgeCount()).toBe(1);
    expect(forge.getPityState().basicBluePity).toBe(saved.pityState.basicBluePity);
  });

  it('§15.3 重置后保底计数和炼制次数应归零', () => {
    const inputs = genForgeInputs(equipment, 3, 'white', 1700);
    forge.basicForge(inputs.map(e => e.uid));
    forge.reset();
    const pity = forge.getPityState();
    expect(pity.basicBluePity).toBe(0);
    expect(pity.advancedPurplePity).toBe(0);
    expect(pity.targetedGoldPity).toBe(0);
    expect(forge.getTotalForgeCount()).toBe(0);
  });

  it('§15.4 装备系统反序列化应恢复背包数据', () => {
    const eq = genEq(equipment, 'purple', 1800);
    const uid = eq.uid;
    const state = equipment.serialize();

    equipment.reset();
    equipment.deserialize(state);

    const restored = equipment.getEquipment(uid);
    expect(restored).toBeDefined();
    expect(restored!.rarity).toBe('purple');
  });
});
