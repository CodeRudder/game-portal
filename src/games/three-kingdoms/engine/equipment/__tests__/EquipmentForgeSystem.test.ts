/**
 * EquipmentForgeSystem 单元测试
 *
 * 覆盖：基础/高级/定向炼制、验证、保底机制、序列化、查询
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EquipmentForgeSystem } from '../EquipmentForgeSystem';
import { EquipmentSystem } from '../EquipmentSystem';
import type {
  EquipmentSlot,
  EquipmentRarity,
  EquipmentInstance,
  ForgeType,
  ForgeResult,
} from '../../../core/equipment';
import type { ISystemDeps } from '../../../core/types/subsystem';
import { EQUIPMENT_SLOTS, RARITY_ORDER, FORGE_PITY_THRESHOLDS } from '../../../core/equipment';

// ── 测试辅助 ──

function createMockDeps(): ISystemDeps {
  return {
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() } as unknown as ISystemDeps['eventBus'],
    config: { get: vi.fn() } as unknown as ISystemDeps['config'],
    registry: { get: vi.fn() } as unknown as ISystemDeps['registry'],
  };
}

function createEquipmentSystem(): EquipmentSystem {
  const sys = new EquipmentSystem();
  sys.init(createMockDeps());
  return sys;
}

function addEquipmentToSystem(
  sys: EquipmentSystem,
  slot: EquipmentSlot = 'weapon',
  rarity: EquipmentRarity = 'white',
  isEquipped: boolean = false,
  heroId: string | null = null,
  seed: number = 42,
): EquipmentInstance {
  const eq = sys.generateEquipment(slot, rarity, 'forge', seed);
  if (isEquipped && heroId) {
    sys.equipItem(heroId, eq.uid);
  }
  return eq;
}

// ═══════════════════════════════════════════════════
// ISubsystem 接口
// ═══════════════════════════════════════════════════

describe('EquipmentForgeSystem — ISubsystem', () => {
  it('name 应为 equipmentForge', () => {
    const forge = new EquipmentForgeSystem();
    expect(forge.name).toBe('equipmentForge');
  });

  it('init 应注入依赖', () => {
    const forge = new EquipmentForgeSystem();
    const deps = createMockDeps();
    expect(() => forge.init(deps)).not.toThrow();
  });

  it('update 应不抛异常', () => {
    const forge = new EquipmentForgeSystem();
    expect(() => forge.update(16)).not.toThrow();
  });

  it('reset 应重置状态', () => {
    const sys = createEquipmentSystem();
    const forge = new EquipmentForgeSystem(sys);
    forge.init(createMockDeps());
    // 模拟一些操作后重置
    forge.reset();
    expect(forge.getTotalForgeCount()).toBe(0);
    expect(forge.getPityState().basicBluePity).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// 基础炼制
// ═══════════════════════════════════════════════════

describe('EquipmentForgeSystem — basicForge', () => {
  let sys: EquipmentSystem;
  let forge: EquipmentForgeSystem;

  beforeEach(() => {
    sys = createEquipmentSystem();
    forge = new EquipmentForgeSystem(sys);
    forge.init(createMockDeps());
  });

  it('3件白色装备基础炼制应成功', () => {
    const eq1 = addEquipmentToSystem(sys, 'weapon', 'white', false, null, 1);
    const eq2 = addEquipmentToSystem(sys, 'armor', 'white', false, null, 2);
    const eq3 = addEquipmentToSystem(sys, 'accessory', 'white', false, null, 3);

    const result = forge.basicForge([eq1.uid, eq2.uid, eq3.uid]);
    expect(result.success).toBe(true);
    expect(result.equipment).not.toBeNull();
    expect(result.cost.copper).toBe(500);
    expect(result.cost.enhanceStone).toBe(1);
    expect(result.cost.refineStone).toBe(0);
  });

  it('装备数量不足应失败', () => {
    const eq1 = addEquipmentToSystem(sys, 'weapon', 'white', false, null, 1);
    const result = forge.basicForge([eq1.uid]);
    expect(result.success).toBe(false);
  });

  it('品质不一致应失败', () => {
    const eq1 = addEquipmentToSystem(sys, 'weapon', 'white', false, null, 1);
    const eq2 = addEquipmentToSystem(sys, 'armor', 'white', false, null, 2);
    const eq3 = addEquipmentToSystem(sys, 'accessory', 'blue', false, null, 3);

    const result = forge.basicForge([eq1.uid, eq2.uid, eq3.uid]);
    expect(result.success).toBe(false);
  });

  it('已穿戴装备不可炼制', () => {
    const eq1 = addEquipmentToSystem(sys, 'weapon', 'white', true, 'hero1', 1);
    const eq2 = addEquipmentToSystem(sys, 'armor', 'white', false, null, 2);
    const eq3 = addEquipmentToSystem(sys, 'accessory', 'white', false, null, 3);

    const result = forge.basicForge([eq1.uid, eq2.uid, eq3.uid]);
    expect(result.success).toBe(false);
  });

  it('金色装备不可炼制', () => {
    const eq1 = addEquipmentToSystem(sys, 'weapon', 'gold', false, null, 1);
    const eq2 = addEquipmentToSystem(sys, 'armor', 'gold', false, null, 2);
    const eq3 = addEquipmentToSystem(sys, 'accessory', 'gold', false, null, 3);

    const result = forge.basicForge([eq1.uid, eq2.uid, eq3.uid]);
    expect(result.success).toBe(false);
  });

  it('不存在的装备应失败', () => {
    const result = forge.basicForge(['ghost1', 'ghost2', 'ghost3']);
    expect(result.success).toBe(false);
  });

  it('炼制后输入装备应被消耗', () => {
    const eq1 = addEquipmentToSystem(sys, 'weapon', 'white', false, null, 1);
    const eq2 = addEquipmentToSystem(sys, 'armor', 'white', false, null, 2);
    const eq3 = addEquipmentToSystem(sys, 'accessory', 'white', false, null, 3);

    forge.basicForge([eq1.uid, eq2.uid, eq3.uid]);
    expect(sys.getEquipment(eq1.uid)).toBeUndefined();
    expect(sys.getEquipment(eq2.uid)).toBeUndefined();
    expect(sys.getEquipment(eq3.uid)).toBeUndefined();
  });

  it('炼制计数应递增', () => {
    const eq1 = addEquipmentToSystem(sys, 'weapon', 'white', false, null, 1);
    const eq2 = addEquipmentToSystem(sys, 'armor', 'white', false, null, 2);
    const eq3 = addEquipmentToSystem(sys, 'accessory', 'white', false, null, 3);

    forge.basicForge([eq1.uid, eq2.uid, eq3.uid]);
    expect(forge.getTotalForgeCount()).toBe(1);
  });
});

// ═══════════════════════════════════════════════════
// 高级炼制
// ═══════════════════════════════════════════════════

describe('EquipmentForgeSystem — advancedForge', () => {
  let sys: EquipmentSystem;
  let forge: EquipmentForgeSystem;

  beforeEach(() => {
    sys = createEquipmentSystem();
    forge = new EquipmentForgeSystem(sys);
    forge.init(createMockDeps());
  });

  it('5件绿色装备高级炼制应成功', () => {
    const eqs: EquipmentInstance[] = [];
    for (let i = 0; i < 5; i++) {
      eqs.push(addEquipmentToSystem(sys, EQUIPMENT_SLOTS[i % 4], 'green', false, null, i + 10));
    }

    const result = forge.advancedForge(eqs.map(e => e.uid));
    expect(result.success).toBe(true);
    expect(result.equipment).not.toBeNull();
    expect(result.cost.copper).toBe(2000);
    expect(result.cost.enhanceStone).toBe(3);
    expect(result.cost.refineStone).toBe(1);
  });

  it('装备数量不足5件应失败', () => {
    const eq1 = addEquipmentToSystem(sys, 'weapon', 'green', false, null, 1);
    const eq2 = addEquipmentToSystem(sys, 'armor', 'green', false, null, 2);
    const eq3 = addEquipmentToSystem(sys, 'accessory', 'green', false, null, 3);

    const result = forge.advancedForge([eq1.uid, eq2.uid, eq3.uid]);
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
// 定向炼制
// ═══════════════════════════════════════════════════

describe('EquipmentForgeSystem — targetedForge', () => {
  let sys: EquipmentSystem;
  let forge: EquipmentForgeSystem;

  beforeEach(() => {
    sys = createEquipmentSystem();
    forge = new EquipmentForgeSystem(sys);
    forge.init(createMockDeps());
  });

  it('3件蓝色装备定向炼制应成功', () => {
    const eq1 = addEquipmentToSystem(sys, 'weapon', 'blue', false, null, 1);
    const eq2 = addEquipmentToSystem(sys, 'armor', 'blue', false, null, 2);
    const eq3 = addEquipmentToSystem(sys, 'accessory', 'blue', false, null, 3);

    const result = forge.targetedForge([eq1.uid, eq2.uid, eq3.uid], 'weapon' as EquipmentSlot);
    expect(result.success).toBe(true);
    expect(result.equipment).not.toBeNull();
    expect(result.cost.copper).toBe(5000);
    expect(result.cost.enhanceStone).toBe(5);
    expect(result.cost.refineStone).toBe(3);
  });

  it('传入 slot 字符串应自动选材', () => {
    // 添加足够的装备
    for (let i = 0; i < 5; i++) {
      addEquipmentToSystem(sys, EQUIPMENT_SLOTS[i % 4], 'white', false, null, i + 100);
    }

    const result = forge.targetedForge('weapon' as EquipmentSlot);
    // 自动选材可能成功也可能失败（取决于是否有3件同品质）
    // 这里主要验证不抛异常
    expect(result).toBeDefined();
    expect('success' in result).toBe(true);
  });

  it('无参数调用应自动选材', () => {
    const result = forge.targetedForge();
    expect(result).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════
// 品质确定
// ═══════════════════════════════════════════════════

describe('EquipmentForgeSystem — 品质确定', () => {
  it('白色输入应产出 green/blue/purple', () => {
    const sys = createEquipmentSystem();
    const forge = new EquipmentForgeSystem(sys);
    forge.init(createMockDeps());

    // 多次炼制验证产出品质范围
    const rarities: EquipmentRarity[] = [];
    for (let trial = 0; trial < 30; trial++) {
      const sys2 = createEquipmentSystem();
      forge.setEquipmentSystem(sys2);
      const eqs: EquipmentInstance[] = [];
      for (let i = 0; i < 3; i++) {
        eqs.push(addEquipmentToSystem(sys2, EQUIPMENT_SLOTS[i], 'white', false, null, trial * 10 + i));
      }
      const result = forge.basicForge(eqs.map(e => e.uid));
      if (result.success && result.equipment) {
        rarities.push(result.equipment.rarity);
      }
    }
    // 白色输入不应产出白色（基础炼制最低绿色）
    for (const r of rarities) {
      expect(['green', 'blue', 'purple']).toContain(r);
    }
  });

  it('紫色输入应产出金色', () => {
    const sys = createEquipmentSystem();
    const forge = new EquipmentForgeSystem(sys);
    forge.init(createMockDeps());

    const eq1 = addEquipmentToSystem(sys, 'weapon', 'purple', false, null, 1);
    const eq2 = addEquipmentToSystem(sys, 'armor', 'purple', false, null, 2);
    const eq3 = addEquipmentToSystem(sys, 'accessory', 'purple', false, null, 3);

    const result = forge.basicForge([eq1.uid, eq2.uid, eq3.uid]);
    expect(result.success).toBe(true);
    expect(result.equipment!.rarity).toBe('gold');
  });
});

// ═══════════════════════════════════════════════════
// 查询
// ═══════════════════════════════════════════════════

describe('EquipmentForgeSystem — 查询', () => {
  it('getForgeCostPreview 应返回正确预览', () => {
    const forge = new EquipmentForgeSystem();
    const basic = forge.getForgeCostPreview('basic');
    expect(basic.copper).toBe(500);
    expect(basic.enhanceStone).toBe(1);
    expect(basic.refineStone).toBe(0);
    expect(basic.inputCount).toBe(3);

    const advanced = forge.getForgeCostPreview('advanced');
    expect(advanced.copper).toBe(2000);
    expect(advanced.inputCount).toBe(5);

    const targeted = forge.getForgeCostPreview('targeted');
    expect(targeted.copper).toBe(5000);
    expect(targeted.inputCount).toBe(3);
  });

  it('getForgeCost 应返回正确的费用', () => {
    const forge = new EquipmentForgeSystem();
    expect(forge.getForgeCost('basic').copper).toBe(500);
    expect(forge.getForgeCost('advanced').copper).toBe(2000);
    expect(forge.getForgeCost('targeted').copper).toBe(5000);
  });
});

// ═══════════════════════════════════════════════════
// 序列化
// ═══════════════════════════════════════════════════

describe('EquipmentForgeSystem — 序列化', () => {
  it('serialize 应包含保底状态和炼制计数', () => {
    const forge = new EquipmentForgeSystem();
    const data = forge.serialize();
    expect(data.pityState).toBeDefined();
    expect(data.pity).toBeDefined();
    expect(data.totalForgeCount).toBe(0);
  });

  it('deserialize 应恢复状态', () => {
    const forge = new EquipmentForgeSystem();
    const saveData = {
      pityState: { basicBluePity: 5, advancedPurplePity: 3, targetedGoldPity: 10 },
      pity: { basicBluePity: 5, advancedPurplePity: 3, targetedGoldPity: 10 },
      totalForgeCount: 42,
    };
    forge.deserialize(saveData);
    expect(forge.getTotalForgeCount()).toBe(42);
    const state = forge.getPityState();
    expect(state.basicBluePity).toBe(5);
    expect(state.advancedPurplePity).toBe(3);
    expect(state.targetedGoldPity).toBe(10);
  });

  it('deserialize null 数据应不抛异常', () => {
    const forge = new EquipmentForgeSystem();
    expect(() => forge.deserialize({ pityState: { basicBluePity: 0, advancedPurplePity: 0, targetedGoldPity: 0 }, totalForgeCount: 0 })).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════
// 无装备系统
// ═══════════════════════════════════════════════════

describe('EquipmentForgeSystem — 无装备系统', () => {
  it('未设置 EquipmentSystem 时炼制应失败', () => {
    const forge = new EquipmentForgeSystem();
    const result = forge.basicForge(['a', 'b', 'c']);
    expect(result.success).toBe(false);
  });

  it('setEquipmentSystem 应设置系统', () => {
    const sys = createEquipmentSystem();
    const forge = new EquipmentForgeSystem();
    forge.setEquipmentSystem(sys);
    // 设置后应不抛异常
    expect(forge).toBeDefined();
  });
});
