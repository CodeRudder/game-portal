/**
 * 集成测试 — 装备穿戴 / 战力计算 / 强化系统
 *
 * 覆盖：EquipmentSystem (穿戴/战力) + EquipmentEnhanceSystem 的交互
 * 验证：穿戴→替换→卸下→战力计算→强化→属性重算 完整链路
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EquipmentSystem } from '../../EquipmentSystem';
import { EquipmentEnhanceSystem } from '../../EquipmentEnhanceSystem';
import type {
  EquipmentSlot,
  EquipmentRarity,
} from '../../../../core/equipment';
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_RARITIES,
  RARITY_ORDER,
  RARITY_ENHANCE_CAP,
} from '../../../../core/equipment';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function createSystems() {
  const equipment = new EquipmentSystem();
  equipment.init({ eventBus: { emit: () => {} } } as unknown as Record<string, unknown>);
  const enhance = new EquipmentEnhanceSystem(equipment);
  enhance.init({ eventBus: { emit: () => {} } } as unknown as Record<string, unknown>);
  return { equipment, enhance };
}

/** 生成指定装备 */
function genEq(sys: EquipmentSystem, slot: EquipmentSlot, rarity: EquipmentRarity, seed = 42) {
  return sys.generateEquipment(slot, rarity, 'campaign_drop', seed)!;
}

// ═══════════════════════════════════════════════
// §6 装备穿戴
// ═══════════════════════════════════════════════

describe('§6 装备穿戴集成', () => {
  let equipment: EquipmentSystem;

  beforeEach(() => {
    ({ equipment } = createSystems());
  });

  it('§6.1 武将穿戴上装备', () => {
    const eq = genEq(equipment, 'weapon', 'blue');
    const result = equipment.equipItem('hero1', eq.uid);
    expect(result.success).toBe(true);
    expect(equipment.getHeroEquips('hero1').weapon).toBe(eq.uid);
    expect(equipment.getEquipment(eq.uid)!.isEquipped).toBe(true);
  });

  it('§6.2 同部位穿戴替换旧装备', () => {
    const old = genEq(equipment, 'armor', 'white', 10);
    const newer = genEq(equipment, 'armor', 'purple', 20);
    equipment.equipItem('hero1', old.uid);
    const result = equipment.equipItem('hero1', newer.uid);
    expect(result.success).toBe(true);
    expect(result.replacedUid).toBe(old.uid);
    expect(equipment.getEquipment(old.uid)!.isEquipped).toBe(false);
    expect(equipment.getHeroEquips('hero1').armor).toBe(newer.uid);
  });

  it('§6.3 装备已被其他武将穿戴时失败', () => {
    const eq = genEq(equipment, 'mount', 'gold', 30);
    equipment.equipItem('hero1', eq.uid);
    const result = equipment.equipItem('hero2', eq.uid);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('其他武将');
  });

  it('§6.4 同一武将重复穿戴同一装备幂等成功', () => {
    const eq = genEq(equipment, 'accessory', 'green', 40);
    equipment.equipItem('hero1', eq.uid);
    const result = equipment.equipItem('hero1', eq.uid);
    expect(result.success).toBe(true);
  });

  it('§6.5 不存在的装备穿戴失败', () => {
    const result = equipment.equipItem('hero1', 'nonexistent');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('不存在');
  });

  it('§6.6 四个部位全部穿戴', () => {
    const uids = EQUIPMENT_SLOTS.map((slot, i) =>
      genEq(equipment, slot, 'blue', 50 + i).uid
    );
    uids.forEach(uid => equipment.equipItem('hero1', uid));
    const slots = equipment.getHeroEquips('hero1');
    EQUIPMENT_SLOTS.forEach((slot, i) => {
      expect(slots[slot]).toBe(uids[i]);
    });
  });
});

// ═══════════════════════════════════════════════
// §7 装备卸下
// ═══════════════════════════════════════════════

describe('§7 装备卸下集成', () => {
  let equipment: EquipmentSystem;

  beforeEach(() => {
    ({ equipment } = createSystems());
  });

  it('§7.1 卸下已穿戴装备', () => {
    const eq = genEq(equipment, 'weapon', 'blue', 60);
    equipment.equipItem('hero1', eq.uid);
    const result = equipment.unequipItem('hero1', 'weapon');
    expect(result.success).toBe(true);
    expect(equipment.getHeroEquips('hero1').weapon).toBeNull();
    expect(equipment.getEquipment(eq.uid)!.isEquipped).toBe(false);
  });

  it('§7.2 武将无装备栏时卸下失败', () => {
    const result = equipment.unequipItem('unknown_hero', 'weapon');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('无装备栏');
  });

  it('§7.3 空部位卸下失败', () => {
    const eq = genEq(equipment, 'armor', 'green', 70);
    equipment.equipItem('hero1', eq.uid);
    const result = equipment.unequipItem('hero1', 'weapon');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('无装备');
  });

  it('§7.4 卸下后可再次穿戴', () => {
    const eq = genEq(equipment, 'mount', 'purple', 80);
    equipment.equipItem('hero1', eq.uid);
    equipment.unequipItem('hero1', 'mount');
    const result = equipment.equipItem('hero1', eq.uid);
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// §8 战力计算
// ═══════════════════════════════════════════════

describe('§8 战力计算集成', () => {
  let equipment: EquipmentSystem;

  beforeEach(() => {
    ({ equipment } = createSystems());
  });

  it('§8.1 calculatePower 返回正数', () => {
    const eq = genEq(equipment, 'weapon', 'purple', 100);
    const power = equipment.calculatePower(eq);
    expect(power).toBeGreaterThan(0);
  });

  it('§8.2 品质越高战力越高', () => {
    const white = genEq(equipment, 'weapon', 'white', 110);
    const gold = genEq(equipment, 'weapon', 'gold', 110);
    expect(equipment.calculatePower(gold)).toBeGreaterThan(equipment.calculatePower(white));
  });

  it('§8.3 强化后战力提升', () => {
    const eq = genEq(equipment, 'armor', 'blue', 120);
    const power0 = equipment.calculatePower(eq);
    const enhanced = { ...eq, enhanceLevel: 5 };
    const power5 = equipment.calculatePower(enhanced);
    expect(power5).toBeGreaterThan(power0);
  });

  it('§8.4 recalculateStats 属性值更新', () => {
    const eq = genEq(equipment, 'accessory', 'gold', 130);
    const recalced = equipment.recalculateStats({ ...eq, enhanceLevel: 3 });
    expect(recalced.mainStat.value).not.toBe(eq.mainStat.value);
    expect(recalced.enhanceLevel).toBe(3);
  });

  it('§8.5 getHeroEquipItems 返回已穿戴装备列表', () => {
    const eq = genEq(equipment, 'weapon', 'blue', 140);
    equipment.equipItem('hero1', eq.uid);
    const items = equipment.getHeroEquipItems('hero1');
    expect(items).toHaveLength(4);
    expect(items[0]).not.toBeNull(); // weapon
    expect(items[1]).toBeNull(); // armor
  });

  it('§8.6 getHeroEquipments 只返回非空装备', () => {
    const eq1 = genEq(equipment, 'weapon', 'blue', 150);
    const eq2 = genEq(equipment, 'mount', 'green', 151);
    equipment.equipItem('hero1', eq1.uid);
    equipment.equipItem('hero1', eq2.uid);
    const items = equipment.getHeroEquipments('hero1');
    expect(items).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════
// §9 强化系统
// ═══════════════════════════════════════════════

describe('§9 强化系统集成', () => {
  let equipment: EquipmentSystem;
  let enhance: EquipmentEnhanceSystem;

  beforeEach(() => {
    ({ equipment, enhance } = createSystems());
    enhance.setResourceDeductor(() => true); // 默认资源充足
  });

  it('§9.1 强化成功等级+1', () => {
    const eq = genEq(equipment, 'weapon', 'blue', 200);
    const result = enhance.enhance(eq.uid);
    expect(['success', 'fail', 'downgrade']).toContain(result.outcome);
    if (result.outcome === 'success') {
      expect(result.currentLevel).toBe(1);
    }
  });

  it('§9.2 不存在的装备强化失败', () => {
    const result = enhance.enhance('fake_uid');
    expect(result.outcome).toBe('fail');
    expect(result.currentLevel).toBe(0);
  });

  it('§9.3 品质强化上限校验', () => {
    const eq = genEq(equipment, 'weapon', 'white', 210);
    const cap = RARITY_ENHANCE_CAP['white'];
    // 强制设置到上限
    equipment.updateEquipment({ ...eq, enhanceLevel: cap });
    const result = enhance.enhance(eq.uid);
    expect(result.outcome).toBe('fail');
    expect(result.currentLevel).toBe(cap);
  });

  it('§9.4 强化消耗铜钱和强化石', () => {
    const eq = genEq(equipment, 'armor', 'green', 220);
    const result = enhance.enhance(eq.uid);
    expect(result.copperCost).toBeGreaterThan(0);
    expect(result.stoneCost).toBeGreaterThanOrEqual(1);
  });

  it('§9.5 getSuccessRate 随等级递减', () => {
    const rate0 = enhance.getSuccessRate(0);
    const rate10 = enhance.getSuccessRate(10);
    expect(rate0).toBeGreaterThan(rate10);
  });

  it('§9.6 保护符防止降级', () => {
    const eq = genEq(equipment, 'weapon', 'blue', 230);
    // 强制设置到安全等级以上
    equipment.updateEquipment({ ...eq, enhanceLevel: 8 });
    enhance.addProtection(10);
    const protBefore = enhance.getProtectionCount();
    const result = enhance.enhance(eq.uid, true);
    if (result.outcome === 'fail' || result.outcome === 'downgrade') {
      // 使用了保护符时不应降级
      if (result.protectionUsed) {
        expect(result.currentLevel).toBe(8); // 不降级
        expect(enhance.getProtectionCount()).toBeLessThan(protBefore);
      }
    }
  });

  it('§9.7 batchEnhance 批量强化', () => {
    const uids = [
      genEq(equipment, 'weapon', 'green', 240).uid,
      genEq(equipment, 'armor', 'blue', 241).uid,
    ];
    const results = enhance.batchEnhance(uids);
    expect(results).toHaveLength(2);
    results.forEach(r => {
      expect(['success', 'fail', 'downgrade']).toContain(r.outcome);
    });
  });
});

// ═══════════════════════════════════════════════
// §10 自动强化 & 转移
// ═══════════════════════════════════════════════

describe('§10 自动强化与转移集成', () => {
  let equipment: EquipmentSystem;
  let enhance: EquipmentEnhanceSystem;

  beforeEach(() => {
    ({ equipment, enhance } = createSystems());
    enhance.setResourceDeductor(() => true);
  });

  it('§10.1 autoEnhance 循环强化到目标等级或资源耗尽', () => {
    const eq = genEq(equipment, 'weapon', 'purple', 300);
    const result = enhance.autoEnhance(eq.uid, {
      targetLevel: 5,
      maxCopper: 1_000_000,
      maxStone: 1_000_000,
      useProtection: false,
      protectionThreshold: 8,
    });
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.totalCopper).toBeGreaterThan(0);
    expect(result.finalLevel).toBeGreaterThan(0);
  });

  it('§10.2 autoEnhance 资源不足时提前停止', () => {
    const eq = genEq(equipment, 'armor', 'blue', 310);
    const result = enhance.autoEnhance(eq.uid, {
      targetLevel: 15,
      maxCopper: 1, // 极少资源
      maxStone: 1,
      useProtection: false,
      protectionThreshold: 8,
    });
    // 至少执行一步（第一次扣除可能已超限，但循环先执行再累计）
    expect(result.steps.length).toBeLessThan(15);
  });

  it('§10.3 transferEnhance 转移强化等级', () => {
    const source = genEq(equipment, 'weapon', 'blue', 320);
    const target = genEq(equipment, 'weapon', 'purple', 321);
    equipment.updateEquipment({ ...source, enhanceLevel: 5 });
    const result = enhance.transferEnhance(source.uid, target.uid);
    expect(result.success).toBe(true);
    expect(result.transferredLevel).toBeGreaterThan(0);
    expect(result.transferredLevel).toBeLessThan(5); // 有损耗
    expect(equipment.getEquipment(source.uid)!.enhanceLevel).toBe(0);
  });

  it('§10.4 transferEnhance 源等级为0时失败', () => {
    const source = genEq(equipment, 'armor', 'white', 330);
    const target = genEq(equipment, 'armor', 'green', 331);
    const result = enhance.transferEnhance(source.uid, target.uid);
    expect(result.success).toBe(false);
  });

  it('§10.5 enhance 序列化/反序列化保护符数量', () => {
    enhance.addProtection(5);
    const data = enhance.serialize();
    const enhance2 = new EquipmentEnhanceSystem(equipment);
    enhance2.deserialize(data);
    expect(enhance2.getProtectionCount()).toBe(5);
  });

  it('§10.6 穿戴+强化+战力 完整链路', () => {
    const eq = genEq(equipment, 'weapon', 'gold', 400);
    const powerBefore = equipment.calculatePower(eq);
    equipment.equipItem('hero1', eq.uid);
    // 强制强化到 +3
    equipment.updateEquipment({ ...eq, enhanceLevel: 3 });
    const updated = equipment.getEquipment(eq.uid)!;
    const powerAfter = equipment.calculatePower(updated);
    expect(powerAfter).toBeGreaterThan(powerBefore);
    // 验证穿戴状态保持
    expect(updated.isEquipped).toBe(true);
    expect(equipment.getHeroEquips('hero1').weapon).toBe(eq.uid);
  });
});
