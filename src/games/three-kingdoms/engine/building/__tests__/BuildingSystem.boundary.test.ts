/**
 * BuildingSystem 边界条件测试（R04 回合）
 *
 * 覆盖场景（13个）：
 * 1. 资源全部为0时升级
 * 2. 建筑已达满级时升级
 * 3. 负数资源升级
 * 4. 同时升级同一建筑两次
 * 5. 升级到刚好满级后再升级
 * 6. 锁定建筑升级
 * 7. 升级队列已满时新升级
 * 8. 取消非升级中建筑
 * 9. 零等级建筑产出
 * 10. 负等级产出查询
 * 11. 版本不匹配反序列化
 * 12. 部分建筑数据反序列化
 * 13. 主城Lv5→6前置条件不满足
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BuildingSystem } from '../BuildingSystem';
import {
  BUILDING_MAX_LEVELS,
  BUILDING_SAVE_VERSION,
  BUILDING_UNLOCK_LEVELS,
} from '../building-config';
import type { BuildingType, BuildingState, BuildingSaveData } from '../building.types';
import { BUILDING_TYPES } from '../building.types';
import type { Resources } from '../../../shared/types';

// ── 辅助函数 ──

const RICH: Resources = {
  grain: 1e15, gold: 1e15, ore: 1e15, wood: 1e15, troops: 1e15,
  mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
};
const ZERO: Resources = {
  grain: 0, gold: 0, ore: 0, wood: 0, troops: 0,
  mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
};
const NEGATIVE: Resources = {
  grain: -999, gold: -999, ore: -999, wood: -999, troops: -999,
  mandate: -1, techPoint: -1, recruitToken: -1, skillBook: -1,
};

/** 构造存档数据，未指定的建筑使用合理默认值 */
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

describe('BuildingSystem 边界条件测试', () => {
  let bs: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    bs = new BuildingSystem();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. 资源为0时升级 ──
  it('资源全部为0时升级主城应返回资源不足', () => {
    const result = bs.checkUpgrade('castle', ZERO);
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons.some((r) => r.includes('不足'))).toBe(true);
  });

  // ── 2. 建筑已满级时升级 ──
  it('建筑已达满级时升级应返回已达上限', () => {
    const maxLv = BUILDING_MAX_LEVELS.farmland; // 25
    bs.deserialize(
      makeSave({
        castle: { level: maxLv + 1, status: 'idle' },
        farmland: { level: maxLv, status: 'idle' },
      }),
    );
    const result = bs.checkUpgrade('farmland', RICH);
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons.some((r) => r.includes('上限'))).toBe(true);
  });

  // ── 3. 负数资源升级 ──
  it('资源为负数时升级应返回资源不足', () => {
    bs.deserialize(makeSave({ castle: { level: 2, status: 'idle' } }));
    const result = bs.checkUpgrade('farmland', NEGATIVE);
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons.some((r) => r.includes('不足'))).toBe(true);
  });

  // ── 4. 同时升级同一建筑两次 ──
  it('同一建筑连续两次startUpgrade第二次应抛错', () => {
    bs.deserialize(makeSave({ castle: { level: 2, status: 'idle' } }));
    bs.startUpgrade('farmland', RICH);
    expect(() => bs.startUpgrade('farmland', RICH)).toThrow(/正在升级中/);
  });

  // ── 5. 升级到刚好满级后再升级 ──
  it('建筑升到刚好满级后不能再升级', () => {
    bs.deserialize(
      makeSave({
        castle: { level: 25, status: 'idle' },
        farmland: { level: 24, status: 'idle' },
      }),
    );
    expect(bs.checkUpgrade('farmland', RICH).canUpgrade).toBe(true);
    bs.startUpgrade('farmland', RICH);
    const completed = bs.forceCompleteUpgrades();
    expect(completed).toContain('farmland');
    const checkAfter = bs.checkUpgrade('farmland', RICH);
    expect(checkAfter.canUpgrade).toBe(false);
    expect(checkAfter.reasons.some((r) => r.includes('上限'))).toBe(true);
  });

  // ── 6. 锁定建筑升级 ──
  it('锁定建筑的升级检查应返回尚未解锁', () => {
    // barracks 需要 castle level 2，初始 castle=1
    const result = bs.checkUpgrade('barracks');
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons.some((r) => r.includes('尚未解锁'))).toBe(true);
  });

  // ── 7. 队列满时升级 ──
  it('升级队列已满时新升级应被拒绝', () => {
    bs.deserialize(makeSave({ castle: { level: 2, status: 'idle' } }));
    bs.startUpgrade('farmland', RICH);
    const check = bs.checkUpgrade('castle', RICH);
    expect(check.canUpgrade).toBe(false);
    expect(check.reasons.some((r) => r.includes('队列已满'))).toBe(true);
  });

  // ── 8. 取消非升级中建筑 ──
  it('取消非升级中的建筑应返回null', () => {
    expect(bs.cancelUpgrade('farmland')).toBeNull();
    expect(bs.cancelUpgrade('castle')).toBeNull();
  });

  // ── 9. 零等级建筑产出 ──
  it('等级为0的建筑产出应为0', () => {
    expect(bs.getProduction('wall', 0)).toBe(0);
  });

  // ── 10. 负等级产出查询 ──
  it('查询负等级产出应返回0而不崩溃', () => {
    expect(bs.getProduction('farmland', -1)).toBe(0);
    expect(bs.getProduction('castle', -100)).toBe(0);
  });

  // ── 11. 版本不匹配反序列化 ──
  it('反序列化版本不匹配时应不崩溃', () => {
    const data = makeSave();
    data.version = 999;
    expect(() => bs.deserialize(data)).not.toThrow();
    expect(bs.getCastleLevel()).toBe(1);
  });

  // ── 12. 部分建筑数据反序列化 ──
  it('反序列化部分建筑数据时应保留其余默认值', () => {
    const partial: BuildingSaveData = {
      version: BUILDING_SAVE_VERSION,
      buildings: {
        castle: {
          type: 'castle',
          level: 5,
          status: 'idle',
          upgradeStartTime: null,
          upgradeEndTime: null,
        },
      } as Record<BuildingType, BuildingState>,
    };
    bs.deserialize(partial);
    expect(bs.getCastleLevel()).toBe(5);
    expect(bs.getLevel('farmland')).toBe(1);
  });

  // ── 13. 主城升级前置条件 ──
  it('主城Lv4→5前置条件不满足时应拒绝升级', () => {
    bs.deserialize(
      makeSave({
        castle: { level: 4, status: 'idle' },
        farmland: { level: 3, status: 'idle' },
      }),
    );
    const result = bs.checkUpgrade('castle', RICH);
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons.some((r) => r.includes('Lv4'))).toBe(true);
  });
});
