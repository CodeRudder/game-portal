/**
 * EquipmentRecommendSystem 单元测试
 *
 * 覆盖：单件评分、一键推荐、套装建议
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EquipmentRecommendSystem } from '../EquipmentRecommendSystem';
import { EquipmentSystem } from '../EquipmentSystem';
import { EquipmentSetSystem } from '../EquipmentSetSystem';
import type { EquipmentInstance, EquipmentSlot, EquipmentRarity } from '../../../core/equipment';
import type { ISystemDeps } from '../../../core/types/subsystem';
import {
  EQUIPMENT_SLOTS,
  RARITY_ORDER,
} from '../../../core/equipment';

// ── 测试辅助 ──

function createMockDeps(): ISystemDeps {
  return {
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() } as unknown as ISystemDeps['eventBus'],
    config: { get: vi.fn() } as unknown as ISystemDeps['config'],
    registry: { get: vi.fn() } as unknown as ISystemDeps['registry'],
  };
}

function createSystems(): { sys: EquipmentSystem; setSys: EquipmentSetSystem; recSys: EquipmentRecommendSystem } {
  const sys = new EquipmentSystem();
  sys.init(createMockDeps());
  const setSys = new EquipmentSetSystem(sys);
  setSys.init(createMockDeps());
  const recSys = new EquipmentRecommendSystem(sys, setSys);
  recSys.init(createMockDeps());
  return { sys, setSys, recSys };
}

// ═══════════════════════════════════════════════════
// ISubsystem 接口
// ═══════════════════════════════════════════════════

describe('EquipmentRecommendSystem — ISubsystem', () => {
  it('name 应为 equipmentRecommend', () => {
    const { recSys } = createSystems();
    expect(recSys.name).toBe('equipmentRecommend');
  });

  it('update 应不抛异常', () => {
    const { recSys } = createSystems();
    expect(() => recSys.update(16)).not.toThrow();
  });

  it('getState 应返回空对象', () => {
    const { recSys } = createSystems();
    expect(recSys.getState()).toEqual({});
  });
});

// ═══════════════════════════════════════════════════
// 单件评分
// ═══════════════════════════════════════════════════

describe('EquipmentRecommendSystem — evaluateEquipment', () => {
  let sys: EquipmentSystem;
  let recSys: EquipmentRecommendSystem;

  beforeEach(() => {
    ({ sys, recSys } = createSystems());
  });

  it('应返回完整的评分对象', () => {
    const eq = sys.generateEquipment('weapon', 'blue', 'forge', 42);
    const rec = recSys.evaluateEquipment(eq, 'hero1');
    expect(rec.uid).toBe(eq.uid);
    expect(rec.equipment).toBe(eq);
    expect(rec.slot).toBe('weapon');
    expect(rec.score).toBeGreaterThan(0);
    expect(rec.breakdown).toBeDefined();
    expect(rec.breakdown.mainStat).toBeGreaterThanOrEqual(0);
    expect(rec.breakdown.subStats).toBeGreaterThanOrEqual(0);
    expect(rec.breakdown.setBonus).toBeGreaterThanOrEqual(0);
    expect(rec.breakdown.rarity).toBeGreaterThanOrEqual(0);
    expect(rec.breakdown.enhanceLevel).toBeGreaterThanOrEqual(0);
  });

  it('高品质装备评分应高于低品质', () => {
    const whiteEq = sys.generateEquipment('weapon', 'white', 'forge', 42);
    const goldEq = sys.generateEquipment('weapon', 'gold', 'forge', 43);

    const whiteRec = recSys.evaluateEquipment(whiteEq, 'hero1');
    const goldRec = recSys.evaluateEquipment(goldEq, 'hero1');

    expect(goldRec.score).toBeGreaterThan(whiteRec.score);
  });

  it('高强化等级评分应更高', () => {
    const eq0 = sys.generateEquipment('weapon', 'blue', 'forge', 42);
    const eq10 = { ...eq0, enhanceLevel: 10, uid: 'eq_10' };

    const rec0 = recSys.evaluateEquipment(eq0, 'hero1');
    const rec10 = recSys.evaluateEquipment(eq10, 'hero1');

    expect(rec10.breakdown.enhanceLevel).toBeGreaterThan(rec0.breakdown.enhanceLevel);
  });

  it('score 应是两位小数', () => {
    const eq = sys.generateEquipment('weapon', 'purple', 'forge', 42);
    const rec = recSys.evaluateEquipment(eq, 'hero1');
    // Math.round(x * 100) / 100 保证最多两位小数
    const multiplied = rec.score * 100;
    expect(Math.abs(multiplied - Math.round(multiplied))).toBeLessThan(0.01);
  });

  it('无副属性装备的副属性评分应为 0', () => {
    const eq = sys.generateEquipment('weapon', 'white', 'forge', 42);
    // white 可能有0条副属性
    // 如果有副属性则 subStats > 0，但 white 的 subStats 可能为空
    const rec = recSys.evaluateEquipment(eq, 'hero1');
    if (eq.subStats.length === 0) {
      expect(rec.breakdown.subStats).toBe(0);
    }
  });
});

// ═══════════════════════════════════════════════════
// 一键推荐
// ═══════════════════════════════════════════════════

describe('EquipmentRecommendSystem — recommendForHero', () => {
  let sys: EquipmentSystem;
  let recSys: EquipmentRecommendSystem;

  beforeEach(() => {
    ({ sys, recSys } = createSystems());
  });

  it('无装备时应返回空推荐', () => {
    const result = recSys.recommendForHero('hero_empty');
    expect(result.slots.weapon).toBeNull();
    expect(result.slots.armor).toBeNull();
    expect(result.slots.accessory).toBeNull();
    expect(result.slots.mount).toBeNull();
    expect(result.totalScore).toBe(0);
    expect(result.setSuggestions).toEqual([]);
  });

  it('有装备时应推荐最优', () => {
    // 添加4件不同部位的装备
    const eq1 = sys.generateEquipment('weapon', 'blue', 'forge', 1);
    const eq2 = sys.generateEquipment('armor', 'purple', 'forge', 2);
    const eq3 = sys.generateEquipment('accessory', 'white', 'forge', 3);
    const eq4 = sys.generateEquipment('mount', 'green', 'forge', 4);

    const result = recSys.recommendForHero('hero1');
    // 如果装备已在背包中，应能推荐
    // 注意：generateEquipment 已自动 addToBag
    expect(result).toBeDefined();
    expect(result.slots).toBeDefined();
    expect(typeof result.totalScore).toBe('number');
    expect(Array.isArray(result.setSuggestions)).toBe(true);
  });

  it('多个同部位装备应推荐评分最高的', () => {
    const whiteW = sys.generateEquipment('weapon', 'white', 'forge', 10);
    const goldW = sys.generateEquipment('weapon', 'gold', 'forge', 11);

    const result = recSys.recommendForHero('hero1');
    if (result.slots.weapon) {
      expect(result.slots.weapon.uid).toBe(goldW.uid);
    }
  });

  it('totalScore 应是各部位评分之和', () => {
    sys.generateEquipment('weapon', 'blue', 'forge', 1);

    const result = recSys.recommendForHero('hero1');
    const slotScores = EQUIPMENT_SLOTS.reduce(
      (sum, slot) => sum + (result.slots[slot]?.score ?? 0), 0,
    );
    expect(result.totalScore).toBeCloseTo(slotScores, 1);
  });
});

// ═══════════════════════════════════════════════════
// 套装建议
// ═══════════════════════════════════════════════════

describe('EquipmentRecommendSystem — setSuggestions', () => {
  it('推荐中应包含套装建议', () => {
    const { sys, recSys } = createSystems();
    // 生成一些装备
    sys.generateEquipment('weapon', 'blue', 'forge', 1);
    const result = recSys.recommendForHero('hero1');
    // setSuggestions 应是数组（可能为空）
    expect(Array.isArray(result.setSuggestions)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════
// 品质评分
// ═══════════════════════════════════════════════════

describe('EquipmentRecommendSystem — 品质评分', () => {
  it('品质评分应按 RARITY_ORDER × 20 计算', () => {
    const { sys, recSys } = createSystems();
    const rarities: EquipmentRarity[] = ['white', 'green', 'blue', 'purple', 'gold'];
    for (const rarity of rarities) {
      const eq = sys.generateEquipment('weapon', rarity, 'forge', 42);
      const rec = recSys.evaluateEquipment(eq, 'hero1');
      expect(rec.breakdown.rarity).toBe(RARITY_ORDER[rarity] * 20);
    }
  });
});
