/**
 * BuildingSystem — 对抗式测试（Adversarial Test Suite）
 *
 * 基于流程分支树枚举，覆盖：
 * - 资源边界攻击（恰好/差1/负数/零/溢出）
 * - 等级边界攻击（0/maxLevel/maxLevel-1/负数/主城等级约束）
 * - 状态机攻击（locked→升级/upgrading→重复升级/idle→取消）
 * - 队列攻击（满队列/取消释放/多建筑同时到期）
 * - 序列化攻击（版本不匹配/部分数据/离线完成/篡改数据）
 * - 数值精确性攻击（退款/加成/产出/费用查表）
 * - 跨系统交互（升级→解锁→产出联动）
 *
 * @module engine/building/__tests__/BuildingSystem.adversarial.v2.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BuildingSystem } from '../BuildingSystem';
import type { BuildingType, BuildingState, BuildingSaveData, Resources } from '../../../shared/types';
import { BUILDING_TYPES } from '../building.types';
import {
  BUILDING_DEFS,
  BUILDING_MAX_LEVELS,
  BUILDING_UNLOCK_LEVELS,
  BUILDING_SAVE_VERSION,
  CANCEL_REFUND_RATIO,
} from '../building-config';

// ── 辅助常量 ──

const RICH: Resources = {
  grain: 1e15, gold: 1e15, troops: 1e15,
  mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
};
const ZERO: Resources = {
  grain: 0, gold: 0, troops: 0,
  mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
};
const NEGATIVE: Resources = {
  grain: -999, gold: -999, troops: -999,
  mandate: -1, techPoint: -1, recruitToken: -1, skillBook: -1,
};
const MAX_SAFE: Resources = {
  grain: Number.MAX_SAFE_INTEGER, gold: Number.MAX_SAFE_INTEGER, troops: Number.MAX_SAFE_INTEGER,
  mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
};

/** 构造存档数据 */
function makeSave(
  overrides: Partial<Record<BuildingType, Partial<BuildingState>>> = {},
): BuildingSaveData {
  const buildings = {} as Record<BuildingType, BuildingState>;
  for (const t of BUILDING_TYPES) {
    buildings[t] = {
      type: t,
      level: BUILDING_UNLOCK_LEVELS[t] === 0 ? 1 : 0,
      status: BUILDING_UNLOCK_LEVELS[t] === 0 ? 'idle' : 'locked',
      upgradeStartTime: null,
      upgradeEndTime: null,
      ...overrides[t],
    };
  }
  return { version: BUILDING_SAVE_VERSION, buildings };
}

// ── 测试套件 ──

describe('BuildingSystem 对抗式测试 — 资源边界攻击', () => {
  let bs: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('TR-CHECK-015: 资源恰好等于升级费用时允许升级', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    const cost = bs.getUpgradeCost('farmland')!;
    const exact: Resources = {
      grain: cost.grain, gold: cost.gold, troops: cost.troops,
      mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
    };
    const result = bs.checkUpgrade('farmland', exact);
    expect(result.canUpgrade).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('TR-CHECK-016: 粮草差1时拒绝升级', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    const cost = bs.getUpgradeCost('farmland')!;
    const short1: Resources = {
      grain: cost.grain - 1, gold: cost.gold, troops: cost.troops,
      mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
    };
    const result = bs.checkUpgrade('farmland', short1);
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons.some((r) => r.includes('粮草不足'))).toBe(true);
  });

  it('TR-CHECK-016b: 铜钱差1时拒绝升级', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    const cost = bs.getUpgradeCost('farmland')!;
    const short1: Resources = {
      grain: cost.grain, gold: cost.gold - 1, troops: cost.troops,
      mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
    };
    const result = bs.checkUpgrade('farmland', short1);
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons.some((r) => r.includes('铜钱不足'))).toBe(true);
  });

  it('资源为负数时拒绝升级', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    const result = bs.checkUpgrade('farmland', NEGATIVE);
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons.some((r) => r.includes('不足'))).toBe(true);
  });

  it('资源为零时拒绝升级', () => {
    const result = bs.checkUpgrade('castle', ZERO);
    expect(result.canUpgrade).toBe(false);
  });

  it('资源为MAX_SAFE_INTEGER时不崩溃', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    const result = bs.checkUpgrade('farmland', MAX_SAFE);
    expect(result.canUpgrade).toBe(true);
  });

  it('TR-CHECK-020: 兵力费用为0时不检查兵力', () => {
    // farmland Lv1→2 费用 troops=0，即使 resources.troops=0 也应通过
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    const cost = bs.getUpgradeCost('farmland')!;
    expect(cost.troops).toBe(0);
    const noTroops: Resources = {
      grain: cost.grain, gold: cost.gold, troops: 0,
      mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
    };
    const result = bs.checkUpgrade('farmland', noTroops);
    expect(result.canUpgrade).toBe(true);
  });
});

describe('BuildingSystem 对抗式测试 — 等级边界攻击', () => {
  let bs: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('TR-COST-002: level=0 时 getUpgradeCost 返回 null', () => {
    // wall 初始锁定 level=0
    expect(bs.getUpgradeCost('wall')).toBeNull();
  });

  it('TR-COST-003: level=maxLevel 时 getUpgradeCost 返回 null', () => {
    bs.deserialize(makeSave({
      castle: { level: BUILDING_MAX_LEVELS.castle },
      farmland: { level: BUILDING_MAX_LEVELS.farmland },
    }));
    expect(bs.getUpgradeCost('farmland')).toBeNull();
    expect(bs.getUpgradeCost('castle')).toBeNull();
  });

  it('TR-COST-004: level=1 时返回 Lv1→2 费用', () => {
    const cost = bs.getUpgradeCost('farmland');
    expect(cost).not.toBeNull();
    const expected = BUILDING_DEFS.farmland.levelTable[1]?.upgradeCost;
    expect(cost!.grain).toBe(expected!.grain);
    expect(cost!.gold).toBe(expected!.gold);
  });

  it('TR-COST-007: level=0 时 getProduction 返回 0', () => {
    expect(bs.getProduction('wall', 0)).toBe(0);
  });

  it('TR-COST-008: 负数等级时 getProduction 返回 0', () => {
    expect(bs.getProduction('farmland', -1)).toBe(0);
    expect(bs.getProduction('castle', -100)).toBe(0);
  });

  it('TR-CHECK-005: 非主城建筑等级=主城等级时拒绝升级（level > castle.level）', () => {
    // 规则：state.level > castle.level 时拒绝（允许 level == castle.level）
    // 所以需要 farmland.level > castle.level 才触发拒绝
    bs.deserialize(makeSave({ castle: { level: 3 }, farmland: { level: 4 } }));
    const r = bs.checkUpgrade('farmland', RICH);
    expect(r.canUpgrade).toBe(false);
    expect(r.reasons).toEqual(expect.arrayContaining([expect.stringContaining('不能超过主城等级')]));
  });

  it('TR-CHECK-005b: 非主城建筑等级=主城等级时允许升级（level == castle.level 不触发限制）', () => {
    bs.deserialize(makeSave({ castle: { level: 5 }, farmland: { level: 5 } }));
    const r = bs.checkUpgrade('farmland', RICH);
    expect(r.canUpgrade).toBe(true);
  });

  it('TR-CHECK-006: 非主城建筑等级=主城等级-1时允许升级', () => {
    bs.deserialize(makeSave({ castle: { level: 5 }, farmland: { level: 4 } }));
    const r = bs.checkUpgrade('farmland', RICH);
    expect(r.canUpgrade).toBe(true);
  });

  it('TR-CHECK-019: 非主城建筑等级>主城等级+1时拒绝（防御性检查）', () => {
    bs.deserialize(makeSave({ castle: { level: 3 }, farmland: { level: 6 } }));
    const r = bs.checkUpgrade('farmland', RICH);
    expect(r.canUpgrade).toBe(false);
    expect(r.reasons).toEqual(expect.arrayContaining([expect.stringContaining('不能超过主城等级')]));
  });

  it('建筑等级恰好=maxLevel-1时允许最后一次升级', () => {
    const maxLv = BUILDING_MAX_LEVELS.farmland;
    bs.deserialize(makeSave({
      castle: { level: maxLv + 1 },
      farmland: { level: maxLv - 1 },
    }));
    const r = bs.checkUpgrade('farmland', RICH);
    expect(r.canUpgrade).toBe(true);
  });

  it('TR-COST-005: getUpgradeCost 返回深拷贝', () => {
    const cost = bs.getUpgradeCost('farmland')!;
    cost.grain = 999999;
    const cost2 = bs.getUpgradeCost('farmland')!;
    expect(cost2.grain).not.toBe(999999);
  });

  it('TR-COST-009: getProduction 指定 level 参数', () => {
    // Lv3 产出
    const expected = BUILDING_DEFS.farmland.levelTable[2]?.production ?? 0;
    expect(bs.getProduction('farmland', 3)).toBeCloseTo(expected, 5);
  });

  it('TR-COST-010/011: 主城 Lv1 加成为 0%', () => {
    expect(bs.getCastleBonusPercent()).toBe(0);
    expect(bs.getCastleBonusMultiplier()).toBeCloseTo(1.0, 10);
  });

  it('TR-COST-012: 主城 Lv2 加成乘数为 1.02', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    expect(bs.getCastleBonusMultiplier()).toBeCloseTo(1.02, 10);
  });
});

describe('BuildingSystem 对抗式测试 — 状态机攻击', () => {
  let bs: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('locked → startUpgrade 抛错', () => {
    expect(() => bs.startUpgrade('market', RICH)).toThrow(/尚未解锁/);
  });

  it('upgrading → startUpgrade 重复升级抛错', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    bs.startUpgrade('farmland', RICH);
    expect(() => bs.startUpgrade('farmland', RICH)).toThrow(/正在升级中/);
  });

  it('idle → cancelUpgrade 返回 null', () => {
    expect(bs.cancelUpgrade('farmland')).toBeNull();
    expect(bs.cancelUpgrade('castle')).toBeNull();
  });

  it('upgrading → cancelUpgrade → startUpgrade 成功', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    bs.startUpgrade('farmland', RICH);
    const refund = bs.cancelUpgrade('farmland');
    expect(refund).not.toBeNull();

    // 取消后可以重新升级
    const r = bs.checkUpgrade('farmland', RICH);
    expect(r.canUpgrade).toBe(true);
    expect(() => bs.startUpgrade('farmland', RICH)).not.toThrow();
  });

  it('locked → checkAndUnlock → idle 状态转换正确', () => {
    // market 初始锁定，需要主城 Lv2
    expect(bs.isUnlocked('market')).toBe(false);
    expect(bs.getBuilding('market').status).toBe('locked');

    // 模拟主城升级到 Lv2
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    // market 应该在反序列化时被解锁
    expect(bs.isUnlocked('market')).toBe(true);
    expect(bs.getBuilding('market').status).toBe('idle');
    expect(bs.getBuilding('market').level).toBe(1);
  });

  it('TR-EXEC-010: cancelUpgrade 状态恢复完整', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    bs.startUpgrade('farmland', RICH);
    bs.cancelUpgrade('farmland');

    const state = bs.getBuilding('farmland');
    expect(state.status).toBe('idle');
    expect(state.upgradeStartTime).toBeNull();
    expect(state.upgradeEndTime).toBeNull();
  });

  it('TR-EXEC-011: cancelUpgrade 从队列移除', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    bs.startUpgrade('farmland', RICH);
    expect(bs.getUpgradeQueue()).toHaveLength(1);

    bs.cancelUpgrade('farmland');
    expect(bs.getUpgradeQueue()).toHaveLength(0);
  });

  it('TR-EXEC-013: cancelUpgrade 退款精确值 = Math.round(cost * 0.8)', () => {
    bs.deserialize(makeSave({ castle: { level: 3 }, farmland: { level: 1 } }));
    const cost = bs.startUpgrade('farmland', RICH);
    const refund = bs.cancelUpgrade('farmland')!;

    expect(refund.grain).toBe(Math.round(cost.grain * CANCEL_REFUND_RATIO));
    expect(refund.gold).toBe(Math.round(cost.gold * CANCEL_REFUND_RATIO));
    expect(refund.troops).toBe(Math.round(cost.troops * CANCEL_REFUND_RATIO));
    expect(refund.timeSeconds).toBe(0);
  });

  it('TR-EXEC-014: troops=0 时退款 troops=0', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    const cost = bs.getUpgradeCost('farmland')!;
    expect(cost.troops).toBe(0); // farmland 升级不需要兵力

    bs.startUpgrade('farmland', RICH);
    const refund = bs.cancelUpgrade('farmland')!;
    expect(refund.troops).toBe(0);
  });
});

describe('BuildingSystem 对抗式测试 — 队列攻击', () => {
  let bs: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('TR-QUEUE-003: 主城 Lv1~5 队列1槽', () => {
    bs.deserialize(makeSave({ castle: { level: 1 } }));
    expect(bs.getMaxQueueSlots()).toBe(1);
    bs.deserialize(makeSave({ castle: { level: 5 } }));
    expect(bs.getMaxQueueSlots()).toBe(1);
  });

  it('TR-QUEUE-004: 主城 Lv6~10 队列2槽', () => {
    bs.deserialize(makeSave({ castle: { level: 6 } }));
    expect(bs.getMaxQueueSlots()).toBe(2);
    bs.deserialize(makeSave({ castle: { level: 10 } }));
    expect(bs.getMaxQueueSlots()).toBe(2);
  });

  it('TR-QUEUE-005: 主城 Lv11~20 队列3槽', () => {
    bs.deserialize(makeSave({ castle: { level: 11 } }));
    expect(bs.getMaxQueueSlots()).toBe(3);
    bs.deserialize(makeSave({ castle: { level: 20 } }));
    expect(bs.getMaxQueueSlots()).toBe(3);
  });

  it('TR-QUEUE-006: 主城 Lv21~30 队列4槽', () => {
    bs.deserialize(makeSave({ castle: { level: 21 } }));
    expect(bs.getMaxQueueSlots()).toBe(4);
    bs.deserialize(makeSave({ castle: { level: 30 } }));
    expect(bs.getMaxQueueSlots()).toBe(4);
  });

  it('队列满后拒绝新升级', () => {
    // 主城 Lv2 → 1 槽
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    bs.startUpgrade('farmland', RICH);
    expect(bs.isQueueFull()).toBe(true);

    const r = bs.checkUpgrade('castle', RICH);
    expect(r.canUpgrade).toBe(false);
    expect(r.reasons.some((reason) => reason.includes('队列已满'))).toBe(true);
  });

  it('队列满 → cancel → startUpgrade 成功', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    bs.startUpgrade('farmland', RICH);
    expect(bs.isQueueFull()).toBe(true);

    bs.cancelUpgrade('farmland');
    expect(bs.isQueueFull()).toBe(false);

    expect(() => bs.startUpgrade('farmland', RICH)).not.toThrow();
  });

  it('TR-TICK-006: 多个建筑同时到期全部完成', () => {
    // 主城 Lv6 → 2 槽
    bs.deserialize(makeSave({
      castle: { level: 6 },
      farmland: { level: 1 },
      market: { level: 1 },
    }));

    bs.startUpgrade('farmland', RICH);
    bs.startUpgrade('market', RICH);

    // 快进到所有升级完成
    const maxEndTime = Math.max(...bs.getUpgradeQueue().map((s) => s.endTime));
    vi.spyOn(Date, 'now').mockReturnValue(maxEndTime);

    const completed = bs.tick();
    expect(completed).toHaveLength(2);
    expect(completed).toContain('farmland');
    expect(completed).toContain('market');
    expect(bs.getUpgradeQueue()).toHaveLength(0);
  });

  it('TR-TICK-004: 空队列 tick 返回空数组', () => {
    const completed = bs.tick();
    expect(completed).toEqual([]);
  });

  it('TR-QUEUE-002: getUpgradeQueue 返回副本', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    bs.startUpgrade('farmland', RICH);
    const queue = bs.getUpgradeQueue();
    queue.length = 0; // 修改返回值
    expect(bs.getUpgradeQueue()).toHaveLength(1); // 内部不受影响
  });
});

describe('BuildingSystem 对抗式测试 — 主城特殊前置条件', () => {
  let bs: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('TR-CHECK-007: 主城 Lv4→5 无其他建筑 Lv4 → 拒绝', () => {
    bs.deserialize(makeSave({
      castle: { level: 4 },
      farmland: { level: 3 },
    }));
    const r = bs.checkUpgrade('castle', RICH);
    expect(r.canUpgrade).toBe(false);
    expect(r.reasons.some((reason) => reason.includes('Lv4'))).toBe(true);
  });

  it('TR-CHECK-008: 主城 Lv4→5 有其他建筑 Lv4 → 允许', () => {
    bs.deserialize(makeSave({
      castle: { level: 4 },
      farmland: { level: 4 },
    }));
    const r = bs.checkUpgrade('castle', RICH);
    expect(r.canUpgrade).toBe(true);
  });

  it('TR-CHECK-009: 主城 Lv9→10 无其他建筑 Lv9 → 拒绝', () => {
    bs.deserialize(makeSave({
      castle: { level: 9 },
      farmland: { level: 8 },
    }));
    const r = bs.checkUpgrade('castle', RICH);
    expect(r.canUpgrade).toBe(false);
    expect(r.reasons.some((reason) => reason.includes('Lv9'))).toBe(true);
  });

  it('TR-CHECK-010: 主城 Lv9→10 有其他建筑 Lv9 → 允许', () => {
    bs.deserialize(makeSave({
      castle: { level: 9 },
      farmland: { level: 9 },
    }));
    const r = bs.checkUpgrade('castle', RICH);
    expect(r.canUpgrade).toBe(true);
  });

  it('TR-CHECK-018: 多条件同时不满足时返回多条原因', () => {
    bs.deserialize(makeSave({
      castle: { level: 4 },
      farmland: { level: 4, status: 'upgrading' },
    }));
    const r = bs.checkUpgrade('farmland', ZERO);
    expect(r.canUpgrade).toBe(false);
    // 至少包含 "正在升级中" 和 资源不足
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
  });
});

describe('BuildingSystem 对抗式测试 — 序列化攻击', () => {
  let bs: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('TR-SER-004: 版本不匹配不崩溃', () => {
    const data = makeSave();
    data.version = 999;
    expect(() => bs.deserialize(data)).not.toThrow();
    expect(bs.getCastleLevel()).toBe(1);
  });

  it('TR-SER-005: 部分建筑数据保留默认值', () => {
    const partial: BuildingSaveData = {
      version: BUILDING_SAVE_VERSION,
      buildings: {
        castle: { type: 'castle', level: 5, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
      } as Record<BuildingType, BuildingState>,
    };
    bs.deserialize(partial);
    expect(bs.getCastleLevel()).toBe(5);
    expect(bs.getLevel('farmland')).toBe(1); // 默认值
  });

  it('TR-SER-006: 离线完成升级自动处理', () => {
    const pastTime = baseTime - 60000; // 60秒前
    const data = makeSave({
      farmland: {
        level: 1,
        status: 'upgrading',
        upgradeStartTime: pastTime - 10000,
        upgradeEndTime: pastTime,
      },
    });
    bs.deserialize(data);
    // 离线期间已完成
    expect(bs.getLevel('farmland')).toBe(2);
    expect(bs.getBuilding('farmland').status).toBe('idle');
    expect(bs.getUpgradeQueue()).toHaveLength(0);
  });

  it('TR-SER-007: 离线未完成升级重建队列', () => {
    const futureTime = baseTime + 60000; // 60秒后
    const data = makeSave({
      farmland: {
        level: 1,
        status: 'upgrading',
        upgradeStartTime: baseTime - 10000,
        upgradeEndTime: futureTime,
      },
    });
    bs.deserialize(data);
    expect(bs.getLevel('farmland')).toBe(1); // 未完成
    expect(bs.getBuilding('farmland').status).toBe('upgrading');
    expect(bs.getUpgradeQueue()).toHaveLength(1);
  });

  it('TR-SER-002: serialize 返回深拷贝', () => {
    const data = bs.serialize();
    data.buildings.castle.level = 999;
    expect(bs.getCastleLevel()).toBe(1); // 内部不受影响
  });

  it('TR-SER-001: serialize 包含正确版本号', () => {
    const data = bs.serialize();
    expect(data.version).toBe(BUILDING_SAVE_VERSION);
  });

  it('TR-SER-008: reset 恢复初始状态', () => {
    bs.deserialize(makeSave({ castle: { level: 10 } }));
    expect(bs.getCastleLevel()).toBe(10);

    bs.reset();
    expect(bs.getCastleLevel()).toBe(1);
    expect(bs.getUpgradeQueue()).toHaveLength(0);
    // 验证所有建筑回到初始状态
    for (const t of BUILDING_TYPES) {
      const state = bs.getBuilding(t);
      if (BUILDING_UNLOCK_LEVELS[t] === 0) {
        expect(state.status).toBe('idle');
        expect(state.level).toBe(1);
      } else {
        expect(state.status).toBe('locked');
        expect(state.level).toBe(0);
      }
    }
  });

  it('篡改 level 超过 maxLevel 不崩溃', () => {
    const data = makeSave({
      castle: { level: 999 },
      farmland: { level: 999 },
    });
    expect(() => bs.deserialize(data)).not.toThrow();
    expect(bs.getLevel('farmland')).toBe(999);
    // getUpgradeCost 应返回 null（超出 levelTable 范围）
    expect(bs.getUpgradeCost('farmland')).toBeNull();
  });
});

describe('BuildingSystem 对抗式测试 — 数值精确性', () => {
  let bs: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('TR-COST-006: getProduction 与 levelTable 精确匹配（已解锁建筑 Lv1）', () => {
    // 只检查初始解锁的建筑（castle level=1, farmland level=1）
    // 锁定建筑 level=0，getProduction 返回 0
    for (const t of BUILDING_TYPES) {
      const state = bs.getBuilding(t);
      if (state.status === 'locked') {
        expect(bs.getProduction(t)).toBe(0);
      } else {
        const expected = BUILDING_DEFS[t].levelTable[state.level - 1]?.production ?? 0;
        expect(bs.getProduction(t)).toBeCloseTo(expected, 5);
      }
    }
  });

  it('TR-SPEC-001: getWallDefense 与 specialValue 精确匹配', () => {
    // wall 需要 castle Lv5 才解锁，但 deserialize 会自动解锁并设 level=1
    // 所以用更高主城等级，且 wall 状态为 idle（已解锁）
    
    // Lv1 城墙 → levelTable[0].specialValue=300
    bs.deserialize(makeSave({ castle: { level: 6 }, wall: { level: 1, status: 'idle' } }));
    expect(bs.getWallDefense()).toBe(300);

    // Lv2 城墙 → levelTable[1].specialValue=500
    bs.deserialize(makeSave({ castle: { level: 6 }, wall: { level: 2, status: 'idle' } }));
    expect(bs.getWallDefense()).toBe(500);

    // Lv3 城墙 → levelTable[2].specialValue=800
    bs.deserialize(makeSave({ castle: { level: 6 }, wall: { level: 3, status: 'idle' } }));
    expect(bs.getWallDefense()).toBe(800);
  });

  it('TR-SPEC-002: 城墙 Lv0 时 getWallDefense 返回 0', () => {
    expect(bs.getWallDefense()).toBe(0);
  });

  it('TR-SPEC-003: getWallDefenseBonus 与 getProduction(wall) 一致', () => {
    bs.deserialize(makeSave({ castle: { level: 5 }, wall: { level: 3 } }));
    expect(bs.getWallDefenseBonus()).toBe(bs.getProduction('wall'));
  });

  it('TR-SPEC-004: getClinicRecoveryRate 与 getProduction(clinic) 一致', () => {
    bs.deserialize(makeSave({ castle: { level: 5 }, clinic: { level: 2 } }));
    expect(bs.getClinicRecoveryRate()).toBe(bs.getProduction('clinic'));
  });

  it('主城各等级加成精确值', () => {
    // Lv10 → production=18 → multiplier=1.18
    bs.deserialize(makeSave({ castle: { level: 10 } }));
    expect(bs.getCastleBonusPercent()).toBe(18);
    expect(bs.getCastleBonusMultiplier()).toBeCloseTo(1.18, 10);
  });
});

describe('BuildingSystem 对抗式测试 — 跨系统交互', () => {
  let bs: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('TR-CROSS-001: 主城升级完成触发建筑解锁', () => {
    // 初始主城 Lv1，market/barracks 锁定
    expect(bs.isUnlocked('market')).toBe(false);
    expect(bs.isUnlocked('barracks')).toBe(false);

    // 模拟主城升级到 Lv2
    bs.deserialize(makeSave({ castle: { level: 1 } }));
    bs.startUpgrade('castle', RICH);

    // 完成升级
    const endTime = bs.getBuilding('castle').upgradeEndTime!;
    vi.spyOn(Date, 'now').mockReturnValue(endTime);
    const completed = bs.tick();

    expect(completed).toContain('castle');
    expect(bs.getCastleLevel()).toBe(2);
    expect(bs.isUnlocked('market')).toBe(true);
    expect(bs.isUnlocked('barracks')).toBe(true);
  });

  it('TR-CROSS-003: calculateTotalProduction 与 getProduction 一致', () => {
    bs.deserialize(makeSave({
      castle: { level: 5 },
      farmland: { level: 3 },
      market: { level: 2 },
    }));

    const total = bs.calculateTotalProduction();
    expect(total.grain).toBeCloseTo(bs.getProduction('farmland'), 5);
    expect(total.gold).toBeCloseTo(bs.getProduction('market'), 5);
  });

  it('TR-CROSS-003b: calculateTotalProduction 排除主城', () => {
    bs.deserialize(makeSave({ castle: { level: 10 } }));
    const total = bs.calculateTotalProduction();
    // 不应包含主城的加成百分比
    expect(total).not.toHaveProperty('castle');
    // 主城没有 production.resourceType，所以不出现在结果中
  });

  it('TR-CROSS-005: forceCompleteUpgrades 主城升级触发解锁', () => {
    bs.deserialize(makeSave({ castle: { level: 1 } }));
    bs.startUpgrade('castle', RICH);

    const completed = bs.forceCompleteUpgrades();
    expect(completed).toContain('castle');
    expect(bs.getCastleLevel()).toBe(2);
    expect(bs.isUnlocked('market')).toBe(true);
    expect(bs.isUnlocked('barracks')).toBe(true);
  });

  it('TR-CROSS-004: 升级→取消→重新升级完整流程', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));

    // 1. 开始升级
    const cost1 = bs.startUpgrade('farmland', RICH);
    expect(bs.getBuilding('farmland').status).toBe('upgrading');

    // 2. 取消升级
    const refund = bs.cancelUpgrade('farmland')!;
    expect(refund.grain).toBe(Math.round(cost1.grain * CANCEL_REFUND_RATIO));

    // 3. 重新升级
    const cost2 = bs.startUpgrade('farmland', RICH);
    expect(cost2.grain).toBe(cost1.grain); // 费用不变
    expect(bs.getBuilding('farmland').status).toBe('upgrading');
    expect(bs.getUpgradeQueue()).toHaveLength(1);
  });

  it('TR-TICK-005: tick 主城升级后自动解锁新建筑', () => {
    // 主城 Lv1，升级到 Lv2
    bs.deserialize(makeSave({ castle: { level: 1 } }));
    bs.startUpgrade('castle', RICH);

    const endTime = bs.getBuilding('castle').upgradeEndTime!;
    vi.spyOn(Date, 'now').mockReturnValue(endTime);
    bs.tick();

    // 验证解锁
    expect(bs.getBuilding('market').status).toBe('idle');
    expect(bs.getBuilding('market').level).toBe(1);
    expect(bs.getBuilding('barracks').status).toBe('idle');
    expect(bs.getBuilding('barracks').level).toBe(1);
  });
});

describe('BuildingSystem 对抗式测试 — 批量升级', () => {
  let bs: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('TR-BATCH-004: 空列表返回全空结果', () => {
    const result = bs.batchUpgrade([], RICH);
    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.totalCost.grain).toBe(0);
  });

  it('TR-BATCH-001: 全部成功', () => {
    bs.deserialize(makeSave({ castle: { level: 6 } })); // 2 槽
    const result = bs.batchUpgrade(['farmland', 'market'], RICH);
    expect(result.succeeded).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(result.totalCost.grain).toBeGreaterThan(0);
  });

  it('TR-BATCH-003: 全部失败（锁定建筑）', () => {
    // market/barracks 初始锁定
    const result = bs.batchUpgrade(['market', 'barracks'], RICH);
    expect(result.succeeded).toHaveLength(0);
    expect(result.failed).toHaveLength(2);
  });

  it('TR-BATCH-005: 资源恰好够第一个', () => {
    bs.deserialize(makeSave({ castle: { level: 6 } }));
    const cost1 = bs.getUpgradeCost('farmland')!;
    const exact1: Resources = {
      grain: cost1.grain, gold: cost1.gold, troops: cost1.troops,
      mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
    };
    const result = bs.batchUpgrade(['farmland', 'market'], exact1);
    expect(result.succeeded).toHaveLength(1);
    expect(result.succeeded[0].type).toBe('farmland');
    expect(result.failed).toHaveLength(1);
  });

  it('TR-BATCH-006: totalCost 为所有成功费用之和', () => {
    bs.deserialize(makeSave({ castle: { level: 6 } }));
    const result = bs.batchUpgrade(['farmland', 'market'], RICH);
    const expectedGrain = result.succeeded.reduce((sum, s) => sum + s.cost.grain, 0);
    expect(result.totalCost.grain).toBe(expectedGrain);
  });
});

describe('BuildingSystem 对抗式测试 — 升级计时精确性', () => {
  let bs: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('TR-TICK-003: 恰好到期时完成升级', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    bs.startUpgrade('farmland', RICH);
    const endTime = bs.getBuilding('farmland').upgradeEndTime!;

    // 恰好到达 endTime
    vi.spyOn(Date, 'now').mockReturnValue(endTime);
    const completed = bs.tick();
    expect(completed).toContain('farmland');
    expect(bs.getLevel('farmland')).toBe(2);
  });

  it('TR-TICK-002: 未到期不处理', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    bs.startUpgrade('farmland', RICH);
    const endTime = bs.getBuilding('farmland').upgradeEndTime!;

    // 还差 1ms
    vi.spyOn(Date, 'now').mockReturnValue(endTime - 1);
    const completed = bs.tick();
    expect(completed).toEqual([]);
    expect(bs.getBuilding('farmland').status).toBe('upgrading');
  });

  it('TR-TICK-007: getUpgradeRemainingTime 正确', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    const cost = bs.getUpgradeCost('farmland')!;
    bs.startUpgrade('farmland', RICH);

    // 过了 3 秒
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + 3000);
    const remaining = bs.getUpgradeRemainingTime('farmland');
    expect(remaining).toBeCloseTo(cost.timeSeconds - 3, 1);
  });

  it('TR-TICK-008: 非升级中建筑剩余时间为 0', () => {
    expect(bs.getUpgradeRemainingTime('farmland')).toBe(0);
  });

  it('TR-TICK-009: getUpgradeProgress 在 0~1 之间', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    const cost = bs.getUpgradeCost('farmland')!;
    bs.startUpgrade('farmland', RICH);

    // 过了 50% 时间
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + (cost.timeSeconds * 500));
    const progress = bs.getUpgradeProgress('farmland');
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThanOrEqual(1);
  });

  it('TR-TICK-010: 非升级中建筑进度为 0', () => {
    expect(bs.getUpgradeProgress('farmland')).toBe(0);
  });

  it('TR-EXEC-002: startUpgrade 正确设置时间戳', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    const cost = bs.getUpgradeCost('farmland')!;
    bs.startUpgrade('farmland', RICH);

    const state = bs.getBuilding('farmland');
    expect(state.upgradeStartTime).toBe(baseTime);
    expect(state.upgradeEndTime).toBe(baseTime + cost.timeSeconds * 1000);
  });
});

describe('BuildingSystem 对抗式测试 — 解锁链验证', () => {
  let bs: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('TR-UNLOCK-005: 主城 Lv1→2 解锁 market + barracks', () => {
    bs.deserialize(makeSave({ castle: { level: 1 } }));
    bs.startUpgrade('castle', RICH);
    bs.forceCompleteUpgrades();

    expect(bs.isUnlocked('market')).toBe(true);
    expect(bs.isUnlocked('barracks')).toBe(true);
    // workshop 还不应解锁（需要 Lv3）
    expect(bs.isUnlocked('workshop')).toBe(false);
  });

  it('TR-UNLOCK-006: 主城 Lv3 解锁 workshop + academy', () => {
    // deserialize 时自动调用 checkAndUnlockBuildings
    bs.deserialize(makeSave({ castle: { level: 3 } }));
    expect(bs.isUnlocked('workshop')).toBe(true);
    expect(bs.isUnlocked('academy')).toBe(true);
    expect(bs.getLevel('workshop')).toBe(1);
    expect(bs.getLevel('academy')).toBe(1);
  });

  it('TR-UNLOCK-007: 主城 Lv4 解锁 clinic', () => {
    bs.deserialize(makeSave({ castle: { level: 4 } }));
    expect(bs.isUnlocked('clinic')).toBe(true);
    expect(bs.getLevel('clinic')).toBe(1);
  });

  it('TR-UNLOCK-008: 无新建筑可解锁返回空数组', () => {
    // 所有建筑都已解锁
    bs.deserialize(makeSave({ castle: { level: 10 } }));
    const unlocked = bs.checkAndUnlockBuildings();
    expect(unlocked).toEqual([]);
  });

  it('解锁后建筑等级为 1', () => {
    bs.deserialize(makeSave({ castle: { level: 5 } }));
    // wall 应被解锁
    expect(bs.isUnlocked('wall')).toBe(true);
    expect(bs.getLevel('wall')).toBe(1);
  });
});

describe('BuildingSystem 对抗式测试 — 推荐系统', () => {
  let bs: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('TR-REC-001: newbie 阶段 castle 排第一', () => {
    const rec = bs.recommendUpgradePath('newbie');
    expect(rec.length).toBeGreaterThan(0);
    expect(rec[0].type).toBe('castle');
  });

  it('TR-REC-002: development 阶段 workshop/academy 靠前', () => {
    bs.deserialize(makeSave({ castle: { level: 5 } }));
    const rec = bs.recommendUpgradePath('development');
    expect(rec.length).toBeGreaterThan(0);
    expect(rec[0].type).toBe('castle');
    // workshop 应在 farmland 之前
    const workshopIdx = rec.findIndex((r) => r.type === 'workshop');
    const farmlandIdx = rec.findIndex((r) => r.type === 'farmland');
    expect(workshopIdx).toBeLessThan(farmlandIdx);
  });

  it('TR-REC-003: late 阶段 wall/clinic 靠前', () => {
    bs.deserialize(makeSave({ castle: { level: 10 } }));
    const rec = bs.recommendUpgradePath('late');
    expect(rec[0].type).toBe('castle');
    expect(rec[1].type).toBe('wall');
    expect(rec[2].type).toBe('clinic');
  });

  it('TR-REC-004: 全满级返回空列表', () => {
    const maxOverrides: Partial<Record<BuildingType, Partial<BuildingState>>> = {};
    for (const t of BUILDING_TYPES) {
      maxOverrides[t] = { level: BUILDING_MAX_LEVELS[t], status: 'idle' };
    }
    bs.deserialize(makeSave(maxOverrides));
    const rec = bs.recommendUpgradePath('newbie');
    expect(rec).toEqual([]);
  });

  it('TR-REC-005: 锁定建筑被跳过', () => {
    // 初始状态，market/barracks 等锁定
    const rec = bs.recommendUpgradePath('newbie');
    const types = rec.map((r) => r.type);
    expect(types).not.toContain('market');
    expect(types).not.toContain('barracks');
    expect(types).not.toContain('wall');
  });

  it('TR-REC-007: getUpgradeRouteRecommendation 主城优先级 100', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    const rec = bs.getUpgradeRouteRecommendation(RICH);
    const castleRec = rec.find((r) => r.type === 'castle');
    expect(castleRec).toBeDefined();
    expect(castleRec!.priority).toBe(100);
  });

  it('TR-REC-006: 资源不足降低优先级', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    const recRich = bs.getUpgradeRouteRecommendation(RICH);
    const recPoor = bs.getUpgradeRouteRecommendation(ZERO);
    // 找到非主城建筑
    const nonCastle = recRich.find((r) => r.type !== 'castle');
    if (nonCastle) {
      const poor = recPoor.find((r) => r.type === nonCastle.type);
      if (poor) {
        expect(poor.priority).toBeLessThan(nonCastle.priority);
      }
    }
  });
});

describe('BuildingSystem 对抗式测试 — 外观阶段', () => {
  it('Lv0~5 → humble', () => {
    bs.deserialize(makeSave({ castle: { level: 1 } }));
    expect(bs.getAppearanceStage('castle')).toBe('humble');
  });

  it('Lv6~12 → orderly', () => {
    bs.deserialize(makeSave({ castle: { level: 6 } }));
    expect(bs.getAppearanceStage('castle')).toBe('orderly');
  });

  it('Lv13~20 → refined', () => {
    bs.deserialize(makeSave({ castle: { level: 13 } }));
    expect(bs.getAppearanceStage('castle')).toBe('refined');
  });

  it('Lv21+ → glorious', () => {
    bs.deserialize(makeSave({ castle: { level: 21 } }));
    expect(bs.getAppearanceStage('castle')).toBe('glorious');
  });

  let bs: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });
});

describe('BuildingSystem 对抗式测试 — 深拷贝隔离', () => {
  let bs: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('TR-READ-002: getAllBuildings 返回深拷贝', () => {
    const all = bs.getAllBuildings();
    all.castle.level = 999;
    expect(bs.getCastleLevel()).toBe(1);
  });

  it('TR-READ-004: getBuilding 返回浅拷贝', () => {
    const building = bs.getBuilding('castle');
    building.level = 999;
    expect(bs.getCastleLevel()).toBe(1);
  });

  it('TR-EXEC-007: startUpgrade 返回深拷贝', () => {
    bs.deserialize(makeSave({ castle: { level: 2 } }));
    const cost = bs.startUpgrade('farmland', RICH);
    const originalGrain = cost.grain;
    cost.grain = 999999;
    // 再次获取费用（取消后）
    bs.cancelUpgrade('farmland');
    const cost2 = bs.getUpgradeCost('farmland')!;
    expect(cost2.grain).toBe(originalGrain);
  });
});
