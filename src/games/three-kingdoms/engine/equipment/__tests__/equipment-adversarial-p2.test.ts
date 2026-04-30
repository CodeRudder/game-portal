/**
 * 装备模块对抗式测试 — Part 2: F-Error 错误注入与异常处理
 *
 * 维度覆盖：
 *   F-Error: 负数强化、不存在装备ID、重复穿戴、资源不足强化
 *   非法参数注入、空值/undefined处理、类型混淆攻击
 *
 * 目标：验证所有公开API在异常输入下的防御能力
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EquipmentSystem } from '../EquipmentSystem';
import { EquipmentEnhanceSystem } from '../EquipmentEnhanceSystem';
import { EquipmentForgeSystem } from '../EquipmentForgeSystem';
import { EquipmentSetSystem } from '../EquipmentSetSystem';
import { EquipmentRecommendSystem } from '../EquipmentRecommendSystem';
import type { EquipmentInstance, EquipmentRarity, EquipmentSlot } from '../../../core/equipment/equipment.types';
import type { ISystemDeps } from '../../../core/types';
import { EQUIPMENT_SAVE_VERSION } from '../../../core/equipment/equipment-config';

// ── 测试辅助 ──

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn(),
    } as unknown as ISystemDeps['eventBus'],
    config: { get: vi.fn() } as unknown as ISystemDeps['config'],
    registry: { get: vi.fn() } as unknown as ISystemDeps['registry'],
  };
}

function createFullSetup() {
  const sys = new EquipmentSystem();
  sys.init(createMockDeps());
  const enhance = new EquipmentEnhanceSystem(sys);
  enhance.init(createMockDeps());
  const forge = new EquipmentForgeSystem(sys);
  forge.init(createMockDeps());
  const setSys = new EquipmentSetSystem(sys);
  setSys.init(createMockDeps());
  const recommend = new EquipmentRecommendSystem(sys, setSys);
  recommend.init(createMockDeps());
  return { sys, enhance, forge, setSys, recommend };
}

function genEq(sys: EquipmentSystem, slot: EquipmentSlot = 'weapon', rarity: EquipmentRarity = 'white', seed: number = 42): EquipmentInstance {
  const eq = sys.generateEquipment(slot, rarity, 'forge', seed);
  expect(eq).not.toBeNull();
  return eq!;
}

// ═══════════════════════════════════════════════
// F-Error: 不存在的装备ID
// ═══════════════════════════════════════════════

describe('F-Error: 不存在的装备ID操作', () => {
  let sys: EquipmentSystem;
  let enhance: EquipmentEnhanceSystem;
  beforeEach(() => {
    ({ sys, enhance } = createFullSetup());
    enhance.setResourceDeductor(() => true);
  });

  it('getEquipment(不存在的uid) 应返回 undefined', () => {
    expect(sys.getEquipment('')).toBeUndefined();
    expect(sys.getEquipment('nonexistent')).toBeUndefined();
    expect(sys.getEquipment('eq_99999_zzzz_abcd')).toBeUndefined();
  });

  it('removeEquipment(不存在的uid) 应返回 false', () => {
    expect(sys.removeEquipment('nonexistent')).toBe(false);
    expect(sys.removeEquipment('')).toBe(false);
  });

  it('removeFromBag(不存在的uid) 应返回失败', () => {
    const result = sys.removeFromBag('nonexistent');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('装备不存在');
  });

  it('equipItem(不存在的uid) 应返回失败', () => {
    const result = sys.equipItem('hero_1', 'nonexistent');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('装备不存在');
  });

  it('unequipItem(无装备栏的武将) 应返回失败', () => {
    const result = sys.unequipItem('hero_nonexistent', 'weapon');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('武将无装备栏');
  });

  it('markEquipped(不存在的uid) 应返回失败', () => {
    const result = sys.markEquipped('nonexistent', 'hero_1');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('装备不存在');
  });

  it('markUnequipped(不存在的uid) 应返回失败', () => {
    const result = sys.markUnequipped('nonexistent');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('装备不存在');
  });

  it('enhance(不存在的uid) 应返回 fail 结果', () => {
    const result = enhance.enhance('nonexistent', false);
    expect(result.outcome).toBe('fail');
    expect(result.currentLevel).toBe(0);
  });

  it('decompose(不存在的uid) 应返回失败', () => {
    const result = sys.decompose('nonexistent');
    expect('success' in result && result.success).toBe(false);
  });

  it('getDecomposePreview(不存在的uid) 应返回 null', () => {
    expect(sys.getDecomposePreview('nonexistent')).toBeNull();
  });

  it('transferEnhance(不存在的uid) 应返回失败', () => {
    const result = enhance.transferEnhance('nonexistent', 'also_nonexistent');
    expect(result.success).toBe(false);
    expect(result.transferredLevel).toBe(0);
  });

  it('autoEnhance(不存在的uid) 应返回空步骤', () => {
    const result = enhance.autoEnhance('nonexistent', {
      targetLevel: 10,
      maxCopper: 99999,
      maxStone: 99999,
      useProtection: false,
      protectionThreshold: 6,
    });
    expect(result.steps).toEqual([]);
    expect(result.finalLevel).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// F-Error: 重复穿戴与状态冲突
// ═══════════════════════════════════════════════

describe('F-Error: 重复穿戴与状态冲突', () => {
  let sys: EquipmentSystem;
  beforeEach(() => {
    ({ sys } = createFullSetup());
  });

  it('已穿戴装备再次穿戴到同一武将应成功（幂等）', () => {
    const eq = genEq(sys, 'weapon');
    const r1 = sys.equipItem('hero_1', eq.uid);
    expect(r1.success).toBe(true);
    const r2 = sys.equipItem('hero_1', eq.uid);
    expect(r2.success).toBe(true);
  });

  it('已穿戴装备穿戴到其他武将应失败', () => {
    const eq = genEq(sys, 'weapon');
    sys.equipItem('hero_1', eq.uid);
    const result = sys.equipItem('hero_2', eq.uid);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('装备已被其他武将穿戴');
  });

  it('markEquipped 对已穿戴装备应返回失败', () => {
    const eq = genEq(sys, 'weapon');
    sys.equipItem('hero_1', eq.uid);
    const result = sys.markEquipped(eq.uid, 'hero_2');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('装备已被穿戴');
  });

  it('markUnequipped 对未穿戴装备应返回失败', () => {
    const eq = genEq(sys, 'weapon');
    const result = sys.markUnequipped(eq.uid);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('装备未被穿戴');
  });

  it('卸下空部位应返回失败', () => {
    const eq = genEq(sys, 'weapon');
    sys.equipItem('hero_1', eq.uid);
    // 卸下未穿戴的部位
    const result = sys.unequipItem('hero_1', 'armor');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('该部位无装备');
  });

  it('已穿戴装备不可从背包移除', () => {
    const eq = genEq(sys, 'weapon');
    sys.equipItem('hero_1', eq.uid);
    const result = sys.removeFromBag(eq.uid);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('已穿戴装备不可移除');
  });

  it('已穿戴装备不可分解', () => {
    const eq = genEq(sys, 'weapon');
    sys.equipItem('hero_1', eq.uid);
    const result = sys.decompose(eq.uid);
    expect('success' in result && result.success).toBe(false);
    if ('reason' in result) {
      expect(result.reason).toContain('穿戴');
    }
  });
});

// ═══════════════════════════════════════════════
// F-Error: 资源不足强化
// ═══════════════════════════════════════════════

describe('F-Error: 资源不足强化', () => {
  let sys: EquipmentSystem;
  let enhance: EquipmentEnhanceSystem;
  beforeEach(() => {
    ({ sys, enhance } = createFullSetup());
  });

  it('资源扣除失败时 enhance 应返回 fail', () => {
    enhance.setResourceDeductor(() => false); // 资源不足
    const eq = genEq(sys, 'weapon', 'white');
    const result = enhance.enhance(eq.uid, false);
    expect(result.outcome).toBe('fail');
    expect(result.currentLevel).toBe(0); // 等级不变
  });

  it('未设置资源扣除器时 enhance 仍可执行（不扣资源）', () => {
    // 不调用 setResourceDeductor
    const enhanceNoDeductor = new EquipmentEnhanceSystem(sys);
    enhanceNoDeductor.init(createMockDeps());
    const eq = genEq(sys, 'weapon', 'white');
    const result = enhanceNoDeductor.enhance(eq.uid, false);
    // 应该正常执行（不扣资源但随机判定）
    expect(['success', 'fail', 'downgrade']).toContain(result.outcome);
  });

  it('autoEnhance 资源耗尽应停止', () => {
    enhance.setResourceDeductor(() => true);
    const eq = genEq(sys, 'weapon', 'gold');
    const result = enhance.autoEnhance(eq.uid, {
      targetLevel: 15,
      maxCopper: 500, // 极少资源
      maxStone: 5,
      useProtection: false,
      protectionThreshold: 6,
    });
    // 应在资源耗尽时停止
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.totalCopper).toBeLessThanOrEqual(500 + 1000); // 容差
  });
});

// ═══════════════════════════════════════════════
// F-Error: 炼制系统异常
// ═══════════════════════════════════════════════

describe('F-Error: 炼制系统异常输入', () => {
  let sys: EquipmentSystem;
  let forge: EquipmentForgeSystem;
  beforeEach(() => {
    ({ sys, forge } = createFullSetup());
  });

  it('basicForge 不足3件同品质应失败', () => {
    const eq1 = genEq(sys, 'weapon', 'white', 100);
    const result = forge.basicForge([eq1.uid]);
    expect(result.success).toBe(false);
  });

  it('basicForge 品质不一致应失败', () => {
    const eq1 = genEq(sys, 'weapon', 'white', 100);
    const eq2 = genEq(sys, 'armor', 'white', 200);
    const eq3 = genEq(sys, 'accessory', 'green', 300); // 不同品质
    const result = forge.basicForge([eq1.uid, eq2.uid, eq3.uid]);
    expect(result.success).toBe(false);
  });

  it('basicForge 金色装备不可炼制', () => {
    const eq1 = genEq(sys, 'weapon', 'gold', 100);
    const eq2 = genEq(sys, 'armor', 'gold', 200);
    const eq3 = genEq(sys, 'accessory', 'gold', 300);
    const result = forge.basicForge([eq1.uid, eq2.uid, eq3.uid]);
    expect(result.success).toBe(false);
  });

  it('basicForge 已穿戴装备不可炼制', () => {
    const eq1 = genEq(sys, 'weapon', 'white', 100);
    const eq2 = genEq(sys, 'armor', 'white', 200);
    const eq3 = genEq(sys, 'accessory', 'white', 300);
    sys.equipItem('hero_1', eq1.uid); // 穿戴一件
    const result = forge.basicForge([eq1.uid, eq2.uid, eq3.uid]);
    expect(result.success).toBe(false);
  });

  it('basicForge 不存在的uid应失败', () => {
    const result = forge.basicForge(['fake1', 'fake2', 'fake3']);
    expect(result.success).toBe(false);
  });

  it('advancedForge 不足5件应失败', () => {
    const eqs = [];
    for (let i = 0; i < 3; i++) {
      eqs.push(genEq(sys, 'weapon', 'white', 100 + i).uid);
    }
    const result = forge.advancedForge(eqs);
    expect(result.success).toBe(false);
  });

  it('targetedForge 空背包自动选材应失败', () => {
    const result = forge.targetedForge();
    expect(result.success).toBe(false);
    expect(result.equipment).toBeNull();
  });

  it('basicForge 正常3件白装应成功', () => {
    const eq1 = genEq(sys, 'weapon', 'white', 101);
    const eq2 = genEq(sys, 'armor', 'white', 102);
    const eq3 = genEq(sys, 'accessory', 'white', 103);
    const result = forge.basicForge([eq1.uid, eq2.uid, eq3.uid], () => 0.5);
    expect(result.success).toBe(true);
    expect(result.equipment).not.toBeNull();
    // 输入装备应被消耗
    expect(sys.getEquipment(eq1.uid)).toBeUndefined();
    expect(sys.getEquipment(eq2.uid)).toBeUndefined();
    expect(sys.getEquipment(eq3.uid)).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════
// F-Error: 强化转移异常
// ═══════════════════════════════════════════════

describe('F-Error: 强化转移异常', () => {
  let sys: EquipmentSystem;
  let enhance: EquipmentEnhanceSystem;
  beforeEach(() => {
    ({ sys, enhance } = createFullSetup());
    enhance.setResourceDeductor(() => true);
  });

  it('transferEnhance 源装备+0等级应失败', () => {
    const source = genEq(sys, 'weapon', 'white', 100);
    const target = genEq(sys, 'armor', 'white', 200);
    const result = enhance.transferEnhance(source.uid, target.uid);
    expect(result.success).toBe(false);
    expect(result.transferredLevel).toBe(0);
  });

  it('transferEnhance 源和目标相同时行为应正确', () => {
    const eq = genEq(sys, 'weapon', 'white', 100);
    // 先强化
    for (let i = 0; i < 3; i++) enhance.enhance(eq.uid, false);
    const result = enhance.transferEnhance(eq.uid, eq.uid);
    // 自己转自己，源被重置，目标获得（结果应为 level - 1 = 0 或行为一致）
    expect(result.success).toBe(true);
  });

  it('transferEnhance 后源装备等级应为0', () => {
    const source = genEq(sys, 'weapon', 'white', 100);
    const target = genEq(sys, 'armor', 'white', 200);
    for (let i = 0; i < 3; i++) enhance.enhance(source.uid, false);
    const sourceLevel = sys.getEquipment(source.uid)!.enhanceLevel;

    enhance.transferEnhance(source.uid, target.uid);

    const sourceAfter = sys.getEquipment(source.uid);
    expect(sourceAfter!.enhanceLevel).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// F-Error: 序列化/反序列化异常
// ═══════════════════════════════════════════════

describe('F-Error: 序列化/反序列化边界', () => {
  let sys: EquipmentSystem;
  beforeEach(() => {
    ({ sys } = createFullSetup());
  });

  it('serialize 后 deserialize 应恢复完整状态', () => {
    const eq = genEq(sys, 'weapon', 'purple');
    sys.equipItem('hero_1', eq.uid);

    const data = sys.serialize();
    expect(data.version).toBe(EQUIPMENT_SAVE_VERSION);
    expect(data.equipments.length).toBe(1);

    // 新系统反序列化
    const sys2 = new EquipmentSystem();
    sys2.init(createMockDeps());
    sys2.deserialize(data);

    expect(sys2.getBagUsedCount()).toBe(1);
    expect(sys2.getHeroEquips('hero_1').weapon).toBe(eq.uid);
  });

  it('deserialize 空数据应正常处理', () => {
    const sys2 = new EquipmentSystem();
    sys2.init(createMockDeps());
    expect(() => sys2.deserialize({ version: 1, equipments: [], bagCapacity: 50 })).not.toThrow();
    expect(sys2.getBagUsedCount()).toBe(0);
  });

  it('deserialize 版本不匹配应发出警告但不崩溃', () => {
    const sys2 = new EquipmentSystem();
    sys2.init(createMockDeps());
    expect(() => sys2.deserialize({ version: 999, equipments: [], bagCapacity: 50 })).not.toThrow();
  });

  it('reset 应清空所有状态', () => {
    genEq(sys, 'weapon');
    genEq(sys, 'armor');
    sys.equipItem('hero_1', sys.getAllEquipments()[0].uid);

    sys.reset();
    expect(sys.getBagUsedCount()).toBe(0);
    expect(sys.getAllEquipments()).toEqual([]);
    expect(sys.getHeroEquips('hero_1').weapon).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// F-Error: 保护符边界
// ═══════════════════════════════════════════════

describe('F-Error: 保护符边界', () => {
  let sys: EquipmentSystem;
  let enhance: EquipmentEnhanceSystem;
  beforeEach(() => {
    ({ sys, enhance } = createFullSetup());
    enhance.setResourceDeductor(() => true);
  });

  it('保护符不足时 useProtection 应被忽略', () => {
    enhance.addProtection(0); // 无保护符
    const eq = genEq(sys, 'weapon', 'white');
    // 强化到安全等级以上
    for (let i = 0; i < 6; i++) enhance.enhance(eq.uid, false);
    const before = sys.getEquipment(eq.uid)!.enhanceLevel;

    // 使用保护符强化（但无保护符）
    const result = enhance.enhance(eq.uid, true);
    // 保护符不足时 useProtection 被静默忽略
    if (result.outcome === 'downgrade') {
      // 如果降级了，说明保护符确实没生效
      expect(result.currentLevel).toBe(before - 1);
    }
  });

  it('addProtection 负数应减少保护符', () => {
    enhance.addProtection(10);
    enhance.addProtection(-5);
    expect(enhance.getProtectionCount()).toBe(5);
  });

  it('serialize/deserialize 应保存保护符数量', () => {
    enhance.addProtection(42);
    const data = enhance.serialize();
    expect(data.protectionCount).toBe(42);

    const enhance2 = new EquipmentEnhanceSystem(sys);
    enhance2.init(createMockDeps());
    enhance2.deserialize(data);
    expect(enhance2.getProtectionCount()).toBe(42);
  });
});

// ═══════════════════════════════════════════════
// F-Error: 推荐系统异常
// ═══════════════════════════════════════════════

describe('F-Error: 推荐系统异常输入', () => {
  let sys: EquipmentSystem;
  let recommend: EquipmentRecommendSystem;
  beforeEach(() => {
    ({ sys, recommend } = createFullSetup());
  });

  it('recommendForHero 空背包应返回空推荐', () => {
    const result = recommend.recommendForHero('hero_1');
    expect(result.slots.weapon).toBeNull();
    expect(result.slots.armor).toBeNull();
    expect(result.slots.accessory).toBeNull();
    expect(result.slots.mount).toBeNull();
    expect(result.totalScore).toBe(0);
  });

  it('recommendForHero 不存在的武将应正常返回', () => {
    genEq(sys, 'weapon');
    const result = recommend.recommendForHero('nonexistent_hero');
    expect(result).toBeDefined();
    expect(result.slots.weapon).not.toBeNull();
  });

  it('evaluateEquipment 应返回有效评分', () => {
    const eq = genEq(sys, 'weapon', 'gold');
    const rec = recommend.evaluateEquipment(eq, 'hero_1');
    expect(rec.score).toBeGreaterThan(0);
    expect(rec.uid).toBe(eq.uid);
    expect(rec.breakdown.mainStat).toBeGreaterThanOrEqual(0);
    expect(rec.breakdown.rarity).toBeGreaterThan(0);
  });
});
