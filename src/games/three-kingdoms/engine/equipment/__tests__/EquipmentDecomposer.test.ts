/**
 * EquipmentDecomposer 单元测试
 *
 * 覆盖：分解奖励计算、单件分解、批量分解、全部分解、图鉴管理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EquipmentDecomposer } from '../EquipmentDecomposer';
import type { EquipmentInstance, DecomposeResult, BatchDecomposeResult } from '../../../core/equipment';
import type { CodexEntry } from '../../../core/equipment';
import type { EquipmentBagManager } from '../EquipmentBagManager';
import {
  DECOMPOSE_COPPER_BASE,
  DECOMPOSE_STONE_BASE,
  DECOMPOSE_ENHANCE_BONUS,
} from '../../../core/equipment';

// ── 测试辅助 ──

function makeEquipment(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    uid: `eq_test_${Math.random().toString(36).slice(2, 8)}`,
    templateId: 'tpl_weapon_white',
    name: '测试剑',
    slot: 'weapon',
    rarity: 'white',
    enhanceLevel: 0,
    mainStat: { type: 'attack', baseValue: 10, value: 10 },
    subStats: [],
    specialEffect: null,
    source: 'campaign_drop',
    acquiredAt: Date.now(),
    isEquipped: false,
    equippedHeroId: null,
    seed: 42,
    ...overrides,
  };
}

function createMockBag(equipments: EquipmentInstance[]): EquipmentBagManager {
  const map = new Map(equipments.map(e => [e.uid, e]));
  return {
    get: (uid: string) => map.get(uid),
    removeFromBag: (uid: string) => {
      const eq = map.get(uid);
      if (!eq) return { success: false, reason: '装备不存在' };
      if (eq.isEquipped) return { success: false, reason: '已穿戴装备不可分解' };
      map.delete(uid);
      return { success: true };
    },
  } as unknown as EquipmentBagManager;
}

function createDecomposer(bag: EquipmentBagManager): {
  decomposer: EquipmentDecomposer;
  codex: Map<string, CodexEntry>;
  emittedEvents: Array<{ event: string; payload: unknown }>;
} {
  const codex = new Map<string, CodexEntry>();
  const emittedEvents: Array<{ event: string; payload: unknown }> = [];
  const emitFn = (event: string, payload: unknown) => {
    emittedEvents.push({ event, payload });
  };
  const decomposer = new EquipmentDecomposer(bag, codex, emitFn);
  return { decomposer, codex, emittedEvents };
}

// ═══════════════════════════════════════════════════
// 分解奖励计算
// ═══════════════════════════════════════════════════

describe('EquipmentDecomposer — calculateDecomposeReward', () => {
  it('白色品质基础分解奖励', () => {
    const bag = createMockBag([]);
    const { decomposer } = createDecomposer(bag);
    const eq = makeEquipment({ rarity: 'white', enhanceLevel: 0 });
    const reward = decomposer.calculateDecomposeReward(eq);
    expect(reward.copper).toBe(DECOMPOSE_COPPER_BASE.white);
    expect(reward.enhanceStone).toBe(DECOMPOSE_STONE_BASE.white);
  });

  it('金色品质基础分解奖励', () => {
    const bag = createMockBag([]);
    const { decomposer } = createDecomposer(bag);
    const eq = makeEquipment({ rarity: 'gold', enhanceLevel: 0 });
    const reward = decomposer.calculateDecomposeReward(eq);
    expect(reward.copper).toBe(DECOMPOSE_COPPER_BASE.gold);
    expect(reward.enhanceStone).toBe(DECOMPOSE_STONE_BASE.gold);
  });

  it('强化等级应增加分解奖励', () => {
    const bag = createMockBag([]);
    const { decomposer } = createDecomposer(bag);
    const eq0 = makeEquipment({ rarity: 'blue', enhanceLevel: 0 });
    const eq5 = makeEquipment({ rarity: 'blue', enhanceLevel: 5 });

    const reward0 = decomposer.calculateDecomposeReward(eq0);
    const reward5 = decomposer.calculateDecomposeReward(eq5);

    const enhanceBonus = 1 + 5 * DECOMPOSE_ENHANCE_BONUS;
    expect(reward5.copper).toBe(Math.floor(DECOMPOSE_COPPER_BASE.blue * enhanceBonus));
    expect(reward5.enhanceStone).toBe(Math.floor(DECOMPOSE_STONE_BASE.blue * enhanceBonus));
    expect(reward5.copper).toBeGreaterThan(reward0.copper);
    expect(reward5.enhanceStone).toBeGreaterThan(reward0.enhanceStone);
  });

  it('所有品质的分解奖励应为正数', () => {
    const bag = createMockBag([]);
    const { decomposer } = createDecomposer(bag);
    const rarities: Array<'white' | 'green' | 'blue' | 'purple' | 'gold'> = ['white', 'green', 'blue', 'purple', 'gold'];
    for (const rarity of rarities) {
      const eq = makeEquipment({ rarity, enhanceLevel: 0 });
      const reward = decomposer.calculateDecomposeReward(eq);
      expect(reward.copper).toBeGreaterThan(0);
      expect(reward.enhanceStone).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════
// 分解预览
// ═══════════════════════════════════════════════════

describe('EquipmentDecomposer — getDecomposePreview', () => {
  it('存在的装备应返回预览', () => {
    const eq = makeEquipment({ uid: 'eq_preview', rarity: 'purple' });
    const bag = createMockBag([eq]);
    const { decomposer } = createDecomposer(bag);
    const preview = decomposer.getDecomposePreview('eq_preview');
    expect(preview).not.toBeNull();
    expect(preview!.copper).toBe(DECOMPOSE_COPPER_BASE.purple);
  });

  it('不存在的装备应返回 null', () => {
    const bag = createMockBag([]);
    const { decomposer } = createDecomposer(bag);
    expect(decomposer.getDecomposePreview('nonexistent')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════
// 单件分解
// ═══════════════════════════════════════════════════

describe('EquipmentDecomposer — decomposeSingle', () => {
  it('应成功分解未穿戴装备', () => {
    const eq = makeEquipment({ uid: 'eq_d1', rarity: 'blue', isEquipped: false });
    const bag = createMockBag([eq]);
    const { decomposer, emittedEvents } = createDecomposer(bag);

    const result = decomposer.decomposeSingle('eq_d1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.result!.copper).toBe(DECOMPOSE_COPPER_BASE.blue);
      expect(result.result!.enhanceStone).toBe(DECOMPOSE_STONE_BASE.blue);
    }
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0].event).toBe('equipment:decomposed');
  });

  it('不存在的装备应失败', () => {
    const bag = createMockBag([]);
    const { decomposer } = createDecomposer(bag);
    const result = decomposer.decomposeSingle('ghost');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('装备不存在');
  });

  it('已穿戴装备不可分解', () => {
    const eq = makeEquipment({ uid: 'eq_worn', isEquipped: true, equippedHeroId: 'hero1' });
    const bag = createMockBag([eq]);
    const { decomposer } = createDecomposer(bag);
    const result = decomposer.decomposeSingle('eq_worn');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('已穿戴装备不可分解');
  });
});

// ═══════════════════════════════════════════════════
// decompose (分派方法)
// ═══════════════════════════════════════════════════

describe('EquipmentDecomposer — decompose (分派)', () => {
  it('传入字符串应调用单件分解', () => {
    const eq = makeEquipment({ uid: 'eq_single', rarity: 'green' });
    const bag = createMockBag([eq]);
    const { decomposer } = createDecomposer(bag);
    const result = decomposer.decompose('eq_single');
    expect('success' in result && result.success).toBe(true);
  });

  it('传入数组应调用批量分解', () => {
    const eq1 = makeEquipment({ uid: 'eq_b1', rarity: 'white' });
    const eq2 = makeEquipment({ uid: 'eq_b2', rarity: 'blue' });
    const bag = createMockBag([eq1, eq2]);
    const { decomposer } = createDecomposer(bag);
    const result = decomposer.decompose(['eq_b1', 'eq_b2']);
    // BatchDecomposeResult has 'total', 'decomposedUids', 'skippedUids'
    expect('total' in result).toBe(true);
    if ('total' in result) {
      expect(result.decomposedUids).toHaveLength(2);
    }
  });
});

// ═══════════════════════════════════════════════════
// 批量分解
// ═══════════════════════════════════════════════════

describe('EquipmentDecomposer — batchDecompose', () => {
  it('应批量分解多件装备', () => {
    const eq1 = makeEquipment({ uid: 'eq_ba1', rarity: 'white' });
    const eq2 = makeEquipment({ uid: 'eq_ba2', rarity: 'blue' });
    const eq3 = makeEquipment({ uid: 'eq_ba3', rarity: 'purple' });
    const bag = createMockBag([eq1, eq2, eq3]);
    const { decomposer } = createDecomposer(bag);

    const result = decomposer.batchDecompose(['eq_ba1', 'eq_ba2', 'eq_ba3']);
    expect(result.decomposedUids).toHaveLength(3);
    expect(result.skippedUids).toHaveLength(0);
    expect(result.total.copper).toBe(
      DECOMPOSE_COPPER_BASE.white + DECOMPOSE_COPPER_BASE.blue + DECOMPOSE_COPPER_BASE.purple,
    );
    expect(result.total.enhanceStone).toBe(
      DECOMPOSE_STONE_BASE.white + DECOMPOSE_STONE_BASE.blue + DECOMPOSE_STONE_BASE.purple,
    );
  });

  it('应跳过已穿戴和不存在的装备', () => {
    const eq1 = makeEquipment({ uid: 'eq_ok', rarity: 'white' });
    const eq2 = makeEquipment({ uid: 'eq_worn', isEquipped: true, equippedHeroId: 'hero1' });
    const bag = createMockBag([eq1, eq2]);
    const { decomposer } = createDecomposer(bag);

    const result = decomposer.batchDecompose(['eq_ok', 'eq_worn', 'eq_ghost']);
    expect(result.decomposedUids).toEqual(['eq_ok']);
    expect(result.skippedUids).toHaveLength(2);
    expect(result.skippedUids).toEqual(expect.arrayContaining(['eq_worn', 'eq_ghost']));
  });

  it('空列表应返回空结果', () => {
    const bag = createMockBag([]);
    const { decomposer } = createDecomposer(bag);
    const result = decomposer.batchDecompose([]);
    expect(result.decomposedUids).toHaveLength(0);
    expect(result.total.copper).toBe(0);
    expect(result.total.enhanceStone).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// 全部分解
// ═══════════════════════════════════════════════════

describe('EquipmentDecomposer — decomposeAllUnequipped', () => {
  it('应只分解未穿戴装备', () => {
    const eq1 = makeEquipment({ uid: 'eq_au1', rarity: 'white', isEquipped: false });
    const eq2 = makeEquipment({ uid: 'eq_au2', rarity: 'blue', isEquipped: true, equippedHeroId: 'hero1' });
    const eq3 = makeEquipment({ uid: 'eq_au3', rarity: 'green', isEquipped: false });
    const bag = createMockBag([eq1, eq2, eq3]);
    const { decomposer } = createDecomposer(bag);

    const getAllEquipments = () => [eq1, eq2, eq3];
    const result = decomposer.decomposeAllUnequipped(getAllEquipments);
    // 只有 eq_au1 和 eq_au3 是未穿戴的
    expect(result.decomposedUids).toHaveLength(2);
    expect(result.decomposedUids).toEqual(expect.arrayContaining(['eq_au1', 'eq_au3']));
    // eq_au2 不会被传入 batchDecompose，所以 skippedUids 为空
    expect(result.skippedUids).toHaveLength(0);
  });

  it('没有装备时应返回空结果', () => {
    const bag = createMockBag([]);
    const { decomposer } = createDecomposer(bag);
    const result = decomposer.decomposeAllUnequipped(() => []);
    expect(result.decomposedUids).toHaveLength(0);
    expect(result.total.copper).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// 图鉴管理
// ═══════════════════════════════════════════════════

describe('EquipmentDecomposer — 图鉴', () => {
  it('未发现的模板应返回 false', () => {
    const bag = createMockBag([]);
    const { decomposer } = createDecomposer(bag);
    expect(decomposer.isCodexDiscovered('tpl_unknown')).toBe(false);
  });

  it('updateCodex 应添加新条目', () => {
    const bag = createMockBag([]);
    const { decomposer, codex } = createDecomposer(bag);
    const eq = makeEquipment({ templateId: 'tpl_test1', rarity: 'blue' });
    decomposer.updateCodex(eq);

    expect(decomposer.isCodexDiscovered('tpl_test1')).toBe(true);
    const entry = decomposer.getCodexEntry('tpl_test1');
    expect(entry).not.toBeNull();
    expect(entry!.discovered).toBe(true);
    expect(entry!.bestRarity).toBe('blue');
    expect(entry!.obtainCount).toBe(1);
  });

  it('重复获取同一模板应增加计数', () => {
    const bag = createMockBag([]);
    const { decomposer } = createDecomposer(bag);
    const eq1 = makeEquipment({ templateId: 'tpl_dup', rarity: 'white' });
    decomposer.updateCodex(eq1);

    const eq2 = makeEquipment({ templateId: 'tpl_dup', rarity: 'purple' });
    decomposer.updateCodex(eq2);

    const entry = decomposer.getCodexEntry('tpl_dup');
    expect(entry!.obtainCount).toBe(2);
    expect(entry!.bestRarity).toBe('purple');
  });

  it('低品质不应覆盖高品质记录', () => {
    const bag = createMockBag([]);
    const { decomposer } = createDecomposer(bag);
    const eq1 = makeEquipment({ templateId: 'tpl_best', rarity: 'gold' });
    decomposer.updateCodex(eq1);

    const eq2 = makeEquipment({ templateId: 'tpl_best', rarity: 'white' });
    decomposer.updateCodex(eq2);

    const entry = decomposer.getCodexEntry('tpl_best');
    expect(entry!.bestRarity).toBe('gold');
    expect(entry!.obtainCount).toBe(2);
  });
});
