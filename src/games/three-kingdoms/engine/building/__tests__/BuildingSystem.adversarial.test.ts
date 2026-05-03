/**
 * BuildingSystem — 对抗性测试
 *
 * 目标：检测存活变异（如边界条件变异）
 * 专门验证数值精确性和逻辑正确性
 */

import { vi } from 'vitest';
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

const RICH: Resources = { grain: 1e9, gold: 1e9, ore: 1e9, wood: 1e9, troops: 1e9, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 };
const ZERO: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0 };

function mockNow(base: number, offset: number) {
  vi.spyOn(Date, 'now').mockReturnValue(base + offset);
}

function makeSave(overrides: Partial<Record<BuildingType, Partial<BuildingState>>> = {}): BuildingSaveData {
  const buildings = {} as Record<BuildingType, BuildingState>;
  for (const t of BUILDING_TYPES) {
    buildings[t] = { type: t, level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null, ...overrides[t] };
  }
  return { version: BUILDING_SAVE_VERSION, buildings };
}

describe('BuildingSystem — 对抗性测试 (Adversarial)', () => {
  let sys: BuildingSystem;
  let base: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    sys = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ── 1. checkUnlock 精确边界：主城等级恰好等于要求等级 ──
  it('主城等级恰好等于解锁要求时，应返回 true', () => {
    // market 要求主城 Lv2
    // 主城 Lv2 时恰好满足
    sys.deserialize(makeSave({ castle: { level: 2 } }));
    expect(sys.checkUnlock('market')).toBe(true);
  });

  // ── 2. checkUnlock 精确边界：主城等级比要求等级少1 ──
  it('主城等级比解锁要求少1时，应返回 false', () => {
    // market 要求主城 Lv2
    // 主城 Lv1 时不应满足
    sys.deserialize(makeSave({ castle: { level: 1 } }));
    expect(sys.checkUnlock('market')).toBe(false);
  });

  // ── 3. checkUpgrade 精确边界：建筑等级恰好等于主城等级 ──
  it('非主城建筑等级恰好等于主城等级时，可以升级（允许子建筑领先主城1级）', () => {
    sys.deserialize(makeSave({ castle: { level: 5 }, farmland: { level: 5 } }));
    const r = sys.checkUpgrade('farmland', RICH);
    expect(r.canUpgrade).toBe(true);
  });

  // ── 3b. checkUpgrade 精确边界：建筑等级超过主城等级 ──
  it('非主城建筑等级超过主城等级时，不能升级', () => {
    sys.deserialize(makeSave({ castle: { level: 3 }, farmland: { level: 4 } }));
    const r = sys.checkUpgrade('farmland', RICH);
    expect(r.canUpgrade).toBe(false);
    expect(r.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('不能超过主城等级')])
    );
  });

  // ── 4. checkUpgrade 精确边界：建筑等级比主城等级少1 ──
  it('非主城建筑等级比主城等级少1时，可以升级', () => {
    sys.deserialize(makeSave({ castle: { level: 5 }, farmland: { level: 4 } }));
    const r = sys.checkUpgrade('farmland', RICH);
    expect(r.canUpgrade).toBe(true);
  });

  // ── 5. getProduction 精确值：等级0返回0 ──
  it('getProduction 等级0时精确返回0', () => {
    // wall 初始是 locked (level 0)
    sys.deserialize(makeSave({ castle: { level: 1 }, wall: { level: 0, status: 'locked' } }));
    expect(sys.getProduction('wall')).toBe(0);
  });

  // ── 6. getProduction 精确值：指定等级的产出 ──
  it('getProduction 返回值与 BUILDING_DEFS 中 levelTable 精确匹配', () => {
    sys.deserialize(makeSave({ farmland: { level: 3 } }));
    const expected = BUILDING_DEFS.farmland.levelTable[2]?.production ?? 0;
    expect(sys.getProduction('farmland')).toBe(expected);
  });

  // ── 7. cancelUpgrade 退款精确值 ──
  it('cancelUpgrade 退款精确为 80%（CANCEL_REFUND_RATIO）', () => {
    sys.deserialize(makeSave({ castle: { level: 3 }, farmland: { level: 1 } }));
    const cost = sys.startUpgrade('farmland', RICH);

    const refund = sys.cancelUpgrade('farmland');
    expect(refund).not.toBeNull();
    expect(refund!.grain).toBe(Math.round(cost.grain * CANCEL_REFUND_RATIO));
    expect(refund!.gold).toBe(Math.round(cost.gold * CANCEL_REFUND_RATIO));
    expect(refund!.troops).toBe(Math.round(cost.troops * CANCEL_REFUND_RATIO));
  });

  // ── 8. isQueueFull 精确边界 ──
  it('队列恰好达到上限时，isQueueFull 返回 true', () => {
    // 主城 Lv2 → getMaxQueueSlots() = 1（假设）
    // farmland Lv1, castle Lv2 → farmland可以升级
    sys.deserialize(makeSave({ castle: { level: 2 }, farmland: { level: 1 } }));
    expect(sys.isQueueFull()).toBe(false);

    // 开始一个升级
    sys.startUpgrade('farmland', RICH);
    expect(sys.isQueueFull()).toBe(true);
  });

  // ── 9. checkUpgrade 达到等级上限的精确边界 ──
  it('建筑等级恰好等于 maxLevel 时不能升级', () => {
    sys.deserialize(makeSave({
      castle: { level: BUILDING_MAX_LEVELS.castle },
      farmland: { level: BUILDING_MAX_LEVELS.farmland },
    }));
    const r = sys.checkUpgrade('farmland', RICH);
    expect(r.canUpgrade).toBe(false);
    expect(r.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('等级上限')])
    );
  });

  // ── 10. 主城加成乘数精确值 ──
  it('getCastleBonusMultiplier 精确值验证', () => {
    // 主城 Lv1 → production=0 → bonus=0% → multiplier=1.0
    expect(sys.getCastleBonusMultiplier()).toBeCloseTo(1.0, 10);

    // 主城 Lv2 → production=2 → bonus=2% → multiplier=1.02
    sys.deserialize(makeSave({ castle: { level: 2 } }));
    expect(sys.getCastleBonusMultiplier()).toBeCloseTo(1.02, 10);
  });
});
