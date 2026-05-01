/**
 * 转生解锁条件完整测试 — P0 级覆盖缺口
 *
 * PRD [PRS-4] 要求 6 项条件同时满足：
 *   1. 声望等级 ≥ 20   2. 主城等级 ≥ 30   3. 武将数量 ≥ 15
 *   4. 总战力 ≥ 50,000  5. 通关进度 ≥ 第4阶段  6. 成就链"初露锋芒"
 *   + 转生冷却 ≥ 72小时（首次无限制）
 *
 * 引擎当前仅实现4项（声望/主城/武将/战力），未实现项标记 test.todo。
 * @module engine/prestige/__tests__/ReincarnationUnlock
 */

import { describe, it, test, expect, beforeEach, vi } from 'vitest';
import { RebirthSystem, calcRebirthMultiplier } from '../RebirthSystem';
import type { ISystemDeps } from '../../../core/types';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_MULTIPLIER,
  REBIRTH_KEEP_RULES,
  REBIRTH_RESET_RULES,
  REBIRTH_ACCELERATION,
  REBIRTH_UNLOCK_CONTENTS,
  REBIRTH_INITIAL_GIFT,
  REBIRTH_INSTANT_BUILD,
} from '../../../core/prestige';

// ═══════════════════════════════════════════════════════════
// 辅助工具
// ═══════════════════════════════════════════════════════════
function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createSystem(): RebirthSystem {
  const sys = new RebirthSystem();
  sys.init(mockDeps());
  return sys;
}

/** 创建满足所有已实现条件的系统 */
function createReadySystem(overrides?: {
  prestigeLevel?: number;
  castleLevel?: number;
  heroCount?: number;
  totalPower?: number;
}): { sys: RebirthSystem; resetFn: ReturnType<typeof vi.fn> } {
  const sys = createSystem();
  const resetFn = vi.fn();
  sys.setCallbacks({
    castleLevel: () => overrides?.castleLevel ?? REBIRTH_CONDITIONS.minCastleLevel,
    heroCount: () => overrides?.heroCount ?? REBIRTH_CONDITIONS.minHeroCount,
    totalPower: () => overrides?.totalPower ?? REBIRTH_CONDITIONS.minTotalPower,
    prestigeLevel: () => overrides?.prestigeLevel ?? REBIRTH_CONDITIONS.minPrestigeLevel,
    onReset: resetFn,
  });
  sys.updatePrestigeLevel(overrides?.prestigeLevel ?? REBIRTH_CONDITIONS.minPrestigeLevel);
  return { sys, resetFn };
}

// ═══════════════════════════════════════════════════════════
// 测试主体
// ═══════════════════════════════════════════════════════════
describe('转生解锁条件 — P0 完整覆盖', () => {

  // ─────────────────────────────────────────
  // A. 常量与配置正确性验证
  // ─────────────────────────────────────────

  describe('A. 转生条件常量验证', () => {
    test('REBIRTH_CONDITIONS 包含4个必要字段', () => {
      expect(REBIRTH_CONDITIONS).toHaveProperty('minPrestigeLevel');
      expect(REBIRTH_CONDITIONS).toHaveProperty('minCastleLevel');
      expect(REBIRTH_CONDITIONS).toHaveProperty('minHeroCount');
      expect(REBIRTH_CONDITIONS).toHaveProperty('minTotalPower');
    });

    test('声望等级门槛 > 1（非初始值）', () => {
      expect(REBIRTH_CONDITIONS.minPrestigeLevel).toBeGreaterThan(1);
    });

    test('主城等级门槛 > 1', () => {
      expect(REBIRTH_CONDITIONS.minCastleLevel).toBeGreaterThan(1);
    });

    test('武将数量门槛 ≥ 1', () => {
      expect(REBIRTH_CONDITIONS.minHeroCount).toBeGreaterThanOrEqual(1);
    });

    test('总战力门槛 > 0', () => {
      expect(REBIRTH_CONDITIONS.minTotalPower).toBeGreaterThan(0);
    });

    test('转生倍率配置合理：base ≥ 1.0，perRebirth > 0，max > base', () => {
      expect(REBIRTH_MULTIPLIER.base).toBeGreaterThanOrEqual(1.0);
      expect(REBIRTH_MULTIPLIER.perRebirth).toBeGreaterThan(0);
      expect(REBIRTH_MULTIPLIER.max).toBeGreaterThan(REBIRTH_MULTIPLIER.base);
    });

    test('加速配置天数 > 0', () => {
      expect(REBIRTH_ACCELERATION.durationDays).toBeGreaterThan(0);
    });

    test('保留规则列表非空', () => {
      expect(REBIRTH_KEEP_RULES.length).toBeGreaterThan(0);
    });

    test('重置规则列表非空', () => {
      expect(REBIRTH_RESET_RULES.length).toBeGreaterThan(0);
    });

    test('保留规则与重置规则无交集', () => {
      const keepSet = new Set(REBIRTH_KEEP_RULES);
      const overlap = REBIRTH_RESET_RULES.filter(r => keepSet.has(r));
      expect(overlap).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────
  // B. 已实现条件 — 单项边界测试
  // ─────────────────────────────────────────

  describe('B. 单项条件边界', () => {

    // --- B1. 声望等级 ---

    describe('B1. 声望等级条件', () => {
      test('声望等级 = 阈值 - 1 → 不满足', () => {
        const sys = createSystem();
        sys.setCallbacks({
          castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
          heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
          totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        });
        sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel - 1);
        const check = sys.checkRebirthConditions();
        expect(check.conditions.prestigeLevel.met).toBe(false);
        expect(check.canRebirth).toBe(false);
      });

      test('声望等级 = 阈值 → 满足', () => {
        const sys = createSystem();
        sys.setCallbacks({
          castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
          heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
          totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        });
        sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
        const check = sys.checkRebirthConditions();
        expect(check.conditions.prestigeLevel.met).toBe(true);
      });

      test('声望等级 = 阈值 + 10 → 满足', () => {
        const sys = createSystem();
        sys.setCallbacks({
          castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
          heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
          totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        });
        sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel + 10);
        const check = sys.checkRebirthConditions();
        expect(check.conditions.prestigeLevel.met).toBe(true);
        expect(check.conditions.prestigeLevel.current).toBe(REBIRTH_CONDITIONS.minPrestigeLevel + 10);
      });

      test('声望等级 = 1（初始值）→ 不满足', () => {
        const sys = createSystem();
        sys.setCallbacks({
          castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
          heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
          totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        });
        sys.updatePrestigeLevel(1);
        const check = sys.checkRebirthConditions();
        expect(check.conditions.prestigeLevel.met).toBe(false);
      });

      test('声望等级 = 0 → 不满足', () => {
        const sys = createSystem();
        sys.setCallbacks({
          castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
          heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
          totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        });
        sys.updatePrestigeLevel(0);
        const check = sys.checkRebirthConditions();
        expect(check.conditions.prestigeLevel.met).toBe(false);
      });
    });

    // --- B2. 主城等级 ---

    describe('B2. 主城等级条件', () => {
      test('主城等级 = 阈值 - 1 → 不满足', () => {
        const { sys } = createReadySystem({
          castleLevel: REBIRTH_CONDITIONS.minCastleLevel - 1,
        });
        const check = sys.checkRebirthConditions();
        expect(check.conditions.castleLevel.met).toBe(false);
        expect(check.canRebirth).toBe(false);
      });

      test('主城等级 = 阈值 → 满足', () => {
        const { sys } = createReadySystem({
          castleLevel: REBIRTH_CONDITIONS.minCastleLevel,
        });
        const check = sys.checkRebirthConditions();
        expect(check.conditions.castleLevel.met).toBe(true);
      });

      test('主城等级 = 阈值 + 5 → 满足', () => {
        const { sys } = createReadySystem({
          castleLevel: REBIRTH_CONDITIONS.minCastleLevel + 5,
        });
        const check = sys.checkRebirthConditions();
        expect(check.conditions.castleLevel.met).toBe(true);
        expect(check.conditions.castleLevel.current).toBe(REBIRTH_CONDITIONS.minCastleLevel + 5);
      });

      test('主城等级 = 0（未设置回调）→ 不满足', () => {
        const sys = createSystem();
        sys.setCallbacks({
          heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
          totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        });
        sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
        const check = sys.checkRebirthConditions();
        expect(check.conditions.castleLevel.current).toBe(0);
        expect(check.conditions.castleLevel.met).toBe(false);
      });
    });

    // --- B3. 武将数量 ---

    describe('B3. 武将数量条件', () => {
      test('武将数量 = 阈值 - 1 → 不满足', () => {
        const { sys } = createReadySystem({
          heroCount: REBIRTH_CONDITIONS.minHeroCount - 1,
        });
        const check = sys.checkRebirthConditions();
        expect(check.conditions.heroCount.met).toBe(false);
        expect(check.canRebirth).toBe(false);
      });

      test('武将数量 = 阈值 → 满足', () => {
        const { sys } = createReadySystem({
          heroCount: REBIRTH_CONDITIONS.minHeroCount,
        });
        const check = sys.checkRebirthConditions();
        expect(check.conditions.heroCount.met).toBe(true);
      });

      test('武将数量 = 0 → 不满足', () => {
        const { sys } = createReadySystem({ heroCount: 0 });
        const check = sys.checkRebirthConditions();
        expect(check.conditions.heroCount.met).toBe(false);
      });
    });

    // --- B4. 总战力 ---

    describe('B4. 总战力条件', () => {
      test('总战力 = 阈值 - 1 → 不满足', () => {
        const { sys } = createReadySystem({
          totalPower: REBIRTH_CONDITIONS.minTotalPower - 1,
        });
        const check = sys.checkRebirthConditions();
        expect(check.conditions.totalPower.met).toBe(false);
        expect(check.canRebirth).toBe(false);
      });

      test('总战力 = 阈值 → 满足', () => {
        const { sys } = createReadySystem({
          totalPower: REBIRTH_CONDITIONS.minTotalPower,
        });
        const check = sys.checkRebirthConditions();
        expect(check.conditions.totalPower.met).toBe(true);
      });

      test('总战力 = 阈值 × 10 → 满足且 current 显示正确', () => {
        const bigPower = REBIRTH_CONDITIONS.minTotalPower * 10;
        const { sys } = createReadySystem({ totalPower: bigPower });
        const check = sys.checkRebirthConditions();
        expect(check.conditions.totalPower.met).toBe(true);
        expect(check.conditions.totalPower.current).toBe(bigPower);
      });
    });
  });

  // ─────────────────────────────────────────
  // C. 条件组合 — 逐项缺失穷举
  // ─────────────────────────────────────────

  describe('C. 条件组合穷举（缺任一项即失败）', () => {
    const ALL_MET = {
      prestigeLevel: REBIRTH_CONDITIONS.minPrestigeLevel,
      castleLevel: REBIRTH_CONDITIONS.minCastleLevel,
      heroCount: REBIRTH_CONDITIONS.minHeroCount,
      totalPower: REBIRTH_CONDITIONS.minTotalPower,
    };

    test('全部满足 → canRebirth = true', () => {
      const { sys } = createReadySystem(ALL_MET);
      expect(sys.checkRebirthConditions().canRebirth).toBe(true);
    });

    test('仅缺声望等级 → canRebirth = false', () => {
      const { sys } = createReadySystem({
        ...ALL_MET,
        prestigeLevel: REBIRTH_CONDITIONS.minPrestigeLevel - 1,
      });
      const check = sys.checkRebirthConditions();
      expect(check.canRebirth).toBe(false);
      // 只有声望等级不满足
      const unmetKeys = Object.entries(check.conditions)
        .filter(([, v]) => !v.met)
        .map(([k]) => k);
      expect(unmetKeys).toEqual(['prestigeLevel']);
    });

    test('仅缺主城等级 → canRebirth = false', () => {
      const { sys } = createReadySystem({
        ...ALL_MET,
        castleLevel: REBIRTH_CONDITIONS.minCastleLevel - 1,
      });
      const check = sys.checkRebirthConditions();
      expect(check.canRebirth).toBe(false);
      const unmetKeys = Object.entries(check.conditions)
        .filter(([, v]) => !v.met)
        .map(([k]) => k);
      expect(unmetKeys).toEqual(['castleLevel']);
    });

    test('仅缺武将数量 → canRebirth = false', () => {
      const { sys } = createReadySystem({
        ...ALL_MET,
        heroCount: REBIRTH_CONDITIONS.minHeroCount - 1,
      });
      const check = sys.checkRebirthConditions();
      expect(check.canRebirth).toBe(false);
      const unmetKeys = Object.entries(check.conditions)
        .filter(([, v]) => !v.met)
        .map(([k]) => k);
      expect(unmetKeys).toEqual(['heroCount']);
    });

    test('仅缺总战力 → canRebirth = false', () => {
      const { sys } = createReadySystem({
        ...ALL_MET,
        totalPower: REBIRTH_CONDITIONS.minTotalPower - 1,
      });
      const check = sys.checkRebirthConditions();
      expect(check.canRebirth).toBe(false);
      const unmet = Object.entries(check.conditions).filter(([, v]) => !v.met).map(([k]) => k);
      expect(unmet).toEqual(['totalPower']);
    });

    test('缺2项 → 返回2个未满足项', () => {
      const { sys } = createReadySystem({
        ...ALL_MET,
        prestigeLevel: REBIRTH_CONDITIONS.minPrestigeLevel - 1,
        heroCount: REBIRTH_CONDITIONS.minHeroCount - 1,
      });
      const check = sys.checkRebirthConditions();
      expect(check.canRebirth).toBe(false);
      const unmet = Object.entries(check.conditions).filter(([, v]) => !v.met).map(([k]) => k);
      expect(unmet).toHaveLength(2);
      expect(unmet).toContain('prestigeLevel');
      expect(unmet).toContain('heroCount');
    });

    test('全部不满足 → canRebirth = false，4项全未满足', () => {
      const sys = createSystem();
      // 默认状态：声望1，其余回调未设置返回0
      const check = sys.checkRebirthConditions();
      expect(check.canRebirth).toBe(false);
      const unmet = Object.entries(check.conditions).filter(([, v]) => !v.met).map(([k]) => k);
      expect(unmet).toHaveLength(4);
    });
  });

  // ─────────────────────────────────────────
  // D. PRD 6 项条件 vs 引擎实现差距
  // ─────────────────────────────────────────

  describe('D. PRD 6项条件 vs 引擎实现（未实现项标记 TODO）', () => {

    test.todo('条件5: 通关进度 ≥ 第4阶段"赤壁之战" — 引擎未实现 campaignProgress 条件');
    test.todo('条件6: 成就链"初露锋芒"5个子成就 — 引擎未实现 achievementChain 条件');
    test.todo('条件7: 转生冷却 ≥ 72小时 — 引擎未实现 cooldown 条件');

    test('引擎当前仅实现4项条件（声望/主城/武将/战力）', () => {
      // 验证 checkRebirthConditions 返回4个条件
      const sys = createSystem();
      const check = sys.checkRebirthConditions();
      const conditionKeys = Object.keys(check.conditions);
      expect(conditionKeys).toHaveLength(4);
      expect(conditionKeys).toContain('prestigeLevel');
      expect(conditionKeys).toContain('castleLevel');
      expect(conditionKeys).toContain('heroCount');
      expect(conditionKeys).toContain('totalPower');
    });

    test('PRD要求的2项额外条件（通关进度/成就链）不在当前条件中', () => {
      const sys = createSystem();
      const check = sys.checkRebirthConditions();
      // 确认缺失
      expect(check.conditions).not.toHaveProperty('campaignProgress');
      expect(check.conditions).not.toHaveProperty('achievementChain');
    });
  });

  // ─────────────────────────────────────────
  // E. 转生执行 — 成功路径
  // ─────────────────────────────────────────

  describe('E. 转生执行成功路径', () => {
    test('全部条件满足时 executeRebirth 返回 success=true', () => {
      const { sys } = createReadySystem();
      const result = sys.executeRebirth();
      expect(result.success).toBe(true);
      expect(result.newCount).toBe(1);
    });

    test('转生后倍率正确更新', () => {
      const { sys } = createReadySystem();
      const result = sys.executeRebirth();
      const expected = calcRebirthMultiplier(1);
      expect(result.multiplier).toBeCloseTo(expected);
      expect(sys.getCurrentMultiplier()).toBeCloseTo(expected);
    });

    test('转生后状态 rebirthCount = 1', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      expect(sys.getState().rebirthCount).toBe(1);
    });

    test('转生触发 resetCallback 并传入重置规则', () => {
      const { sys, resetFn } = createReadySystem();
      sys.executeRebirth();
      expect(resetFn).toHaveBeenCalledTimes(1);
      const resetRules = resetFn.mock.calls[0][0] as string[];
      expect(resetRules).toContain('reset_buildings');
      expect(resetRules).toContain('reset_resources');
      expect(resetRules).toContain('reset_map_progress');
      expect(resetRules).toContain('reset_quest_progress');
      expect(resetRules).toContain('reset_campaign');
    });

    test('转生后加速期激活', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const accel = sys.getAcceleration();
      expect(accel.active).toBe(true);
      expect(accel.daysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
    });

    test('转生记录保存（含转生前声望等级、时间戳）', () => {
      const { sys } = createReadySystem();
      const before = Date.now();
      sys.executeRebirth();
      const after = Date.now();
      const records = sys.getRebirthRecords();
      expect(records).toHaveLength(1);
      expect(records[0].rebirthCount).toBe(1);
      expect(records[0].prestigeLevelBefore).toBe(REBIRTH_CONDITIONS.minPrestigeLevel);
      expect(records[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(records[0].timestamp).toBeLessThanOrEqual(after);
    });

    test('转生发射 rebirth:completed 事件', () => {
      const deps = mockDeps();
      const emitSpy = vi.spyOn(deps.eventBus, 'emit');
      const sys = new RebirthSystem();
      sys.init(deps);
      sys.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);

      sys.executeRebirth();
      expect(emitSpy).toHaveBeenCalledWith(
        'rebirth:completed',
        expect.objectContaining({ count: 1 }),
      );
    });
  });

  // ─────────────────────────────────────────
  // F. 转生执行 — 失败路径（条件不满足）
  // ─────────────────────────────────────────

  describe('F. 转生执行失败路径', () => {
    test('条件不满足时 executeRebirth 返回 success=false', () => {
      const sys = createSystem();
      const result = sys.executeRebirth();
      expect(result.success).toBe(false);
    });

    test('失败时 reason 包含未满足条件详情', () => {
      const sys = createSystem();
      const result = sys.executeRebirth();
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('条件不满足');
    });

    test('失败时不调用 resetCallback', () => {
      const resetFn = vi.fn();
      const sys = createSystem();
      sys.setCallbacks({
        castleLevel: () => 0, // 不满足
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        onReset: resetFn,
      });
      sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      sys.executeRebirth();
      expect(resetFn).not.toHaveBeenCalled();
    });

    test('失败时不改变 rebirthCount', () => {
      const sys = createSystem();
      sys.executeRebirth();
      expect(sys.getState().rebirthCount).toBe(0);
    });

    test('失败时不触发加速', () => {
      const sys = createSystem();
      sys.executeRebirth();
      expect(sys.getAcceleration().active).toBe(false);
    });

    test('失败时不发射 rebirth:completed 事件', () => {
      const deps = mockDeps();
      const emitSpy = vi.spyOn(deps.eventBus, 'emit');
      const sys = new RebirthSystem();
      sys.init(deps);
      // 不设置回调 → 条件不满足
      sys.executeRebirth();
      expect(emitSpy).not.toHaveBeenCalledWith(
        'rebirth:completed',
        expect.anything(),
      );
    });

    test('reason 中包含每个未满足条件的当前值/目标值', () => {
      const sys = createSystem();
      sys.updatePrestigeLevel(5);
      const result = sys.executeRebirth();
      expect(result.reason).toMatch(/prestigeLevel.*5/);
    });
  });
  // G. 多次转生（转生次数上限与奖励递增）
  // ─────────────────────────────────────────

  describe('G. 多次转生', () => {
    test('连续转生2次 → rebirthCount = 2', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      sys.executeRebirth();
      expect(sys.getState().rebirthCount).toBe(2);
    });

    test('连续转生 → 倍率递增', () => {
      const { sys } = createReadySystem();
      const mult1 = sys.executeRebirth().multiplier!;
      const mult2 = sys.executeRebirth().multiplier!;
      expect(mult2).toBeGreaterThan(mult1);
    });

    test('连续转生 → 记录数累加', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      sys.executeRebirth();
      sys.executeRebirth();
      expect(sys.getRebirthRecords()).toHaveLength(3);
    });

    test('每次转生 resetCallback 都被调用', () => {
      const { sys, resetFn } = createReadySystem();
      sys.executeRebirth();
      sys.executeRebirth();
      sys.executeRebirth();
      expect(resetFn).toHaveBeenCalledTimes(3);
    });

    test('第N次转生倍率 = calcRebirthMultiplier(N)', () => {
      const { sys } = createReadySystem();
      for (let i = 1; i <= 5; i++) {
        const result = sys.executeRebirth();
        expect(result.multiplier).toBeCloseTo(calcRebirthMultiplier(i));
      }
    });

    test.todo('转生次数上限 20 次 — 引擎未实现上限检查');
    test.todo('达到上限后 executeRebirth 应返回失败');
  });

  // ─────────────────────────────────────────
  // H. 转生后属性保留/重置验证
  // ─────────────────────────────────────────

  describe('H. 转生后保留/重置规则', () => {
    test('保留规则包含：武将、装备、科技点、声望、成就、VIP', () => {
      const sys = createSystem();
      const rules = sys.getKeepRules();
      expect(rules).toContain('keep_heroes');
      expect(rules).toContain('keep_equipment');
      expect(rules).toContain('keep_tech_points');
      expect(rules).toContain('keep_prestige');
      expect(rules).toContain('keep_achievements');
      expect(rules).toContain('keep_vip');
    });

    test('重置规则包含：建筑、资源、地图进度、任务进度、战役', () => {
      const sys = createSystem();
      const rules = sys.getResetRules();
      expect(rules).toContain('reset_buildings');
      expect(rules).toContain('reset_resources');
      expect(rules).toContain('reset_map_progress');
      expect(rules).toContain('reset_quest_progress');
      expect(rules).toContain('reset_campaign');
    });

    test('保留规则与重置规则互斥', () => {
      const sys = createSystem();
      const keep = new Set(sys.getKeepRules());
      const reset = sys.getResetRules();
      const conflict = reset.filter(r => keep.has(r));
      expect(conflict).toHaveLength(0);
    });

    test('executeRebirth 传入的 resetRules 与 getResetRules 一致', () => {
      const { sys, resetFn } = createReadySystem();
      const expectedRules = sys.getResetRules();
      sys.executeRebirth();
      const actualRules = resetFn.mock.calls[0][0] as string[];
      expect(actualRules.sort()).toEqual([...expectedRules].sort());
    });

    test.todo('PRD: 武将等级衰减50% — 引擎保留规则为 keep_heroes (100%)，衰减逻辑未在引擎层实现');
    test.todo('PRD: 天命保留30% — 引擎未实现天命衰减');
    test.todo('PRD: 科技研究进度保留50% — 引擎 keep_tech_points 为100%保留，衰减逻辑未实现');
  });

  // ─────────────────────────────────────────
  // I. 转生后加速机制
  // ─────────────────────────────────────────

  describe('I. 转生后加速', () => {
    test('转生后加速天数 = REBIRTH_ACCELERATION.durationDays', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      expect(sys.getState().accelerationDaysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
    });

    test('加速期内有效倍率 = 转生倍率 × 加速倍率', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const mults = sys.getEffectiveMultipliers();
      const rebirthMult = sys.getCurrentMultiplier();
      expect(mults.buildSpeed).toBeCloseTo(rebirthMult * REBIRTH_ACCELERATION.buildSpeedMultiplier);
      expect(mults.techSpeed).toBeCloseTo(rebirthMult * REBIRTH_ACCELERATION.techSpeedMultiplier);
      expect(mults.resource).toBeCloseTo(rebirthMult * REBIRTH_ACCELERATION.resourceMultiplier);
      expect(mults.exp).toBeCloseTo(rebirthMult * REBIRTH_ACCELERATION.expMultiplier);
    });

    test('加速期结束后有效倍率回落为转生倍率', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      // 模拟加速期结束
      const state = sys.getState();
      for (let i = 0; i < REBIRTH_ACCELERATION.durationDays; i++) {
        // 触发 dayChanged（通过 loadSaveData 模拟天数流逝不实际可行，
        // 直接通过状态修改验证回落逻辑）
      }
      // 通过 loadSaveData 设置加速天数为0
      const finalState = { ...state, accelerationDaysLeft: 0 };
      const sys2 = createSystem();
      sys2.loadSaveData({ rebirth: finalState });
      const mults = sys2.getEffectiveMultipliers();
      const rebirthMult = sys2.getCurrentMultiplier();
      expect(mults.buildSpeed).toBeCloseTo(rebirthMult);
      expect(mults.resource).toBeCloseTo(rebirthMult);
    });

    test('加速期每日tick减少1天', () => {
      const deps = mockDeps();
      const sys = new RebirthSystem();
      sys.init(deps);
      sys.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      sys.executeRebirth();

      const onCalls = (deps.eventBus.on as ReturnType<typeof vi.fn>).mock.calls;
      const dayChangedCall = onCalls.find((c: [string]) => c[0] === 'calendar:dayChanged');
      const dayChangedCb = dayChangedCall![1] as () => void;

      const daysBefore = sys.getState().accelerationDaysLeft;
      dayChangedCb();
      expect(sys.getState().accelerationDaysLeft).toBe(daysBefore - 1);
    });

    test('加速期归零时发射 accelerationEnded 事件', () => {
      const deps = mockDeps();
      const emitSpy = vi.spyOn(deps.eventBus, 'emit');
      const sys = new RebirthSystem();
      sys.init(deps);
      sys.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      sys.executeRebirth();

      const onCalls = (deps.eventBus.on as ReturnType<typeof vi.fn>).mock.calls;
      const dayChangedCall = onCalls.find((c: [string]) => c[0] === 'calendar:dayChanged');
      const dayChangedCb = dayChangedCall![1] as () => void;

      // tick 到归零
      for (let i = 0; i < REBIRTH_ACCELERATION.durationDays; i++) {
        dayChangedCb();
      }
      expect(emitSpy).toHaveBeenCalledWith(
        'rebirth:accelerationEnded',
        expect.objectContaining({ rebirthCount: 1 }),
      );
    });

    test.todo('PRD: 转生冷却72小时 — 引擎未实现冷却检查');
  });

  // ─────────────────────────────────────────
  // J. 转生次数解锁内容
  // ─────────────────────────────────────────

  describe('J. 转生次数解锁内容', () => {
    test('0次转生 → 无解锁内容', () => {
      const sys = createSystem();
      expect(sys.getUnlockedContents()).toHaveLength(0);
    });

    test('1次转生 → 解锁第1项', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const unlocked = sys.getUnlockedContents();
      expect(unlocked.length).toBeGreaterThanOrEqual(1);
      expect(unlocked.some(c => c.requiredRebirthCount === 1)).toBe(true);
    });

    test('getUnlockContents 返回所有内容（含 unlocked 标志）', () => {
      const sys = createSystem();
      const all = sys.getUnlockContents();
      expect(all.length).toBe(REBIRTH_UNLOCK_CONTENTS.length);
      // 0次转生，全部 unlocked=false
      expect(all.every(c => c.unlocked === false)).toBe(true);
    });

    test('解锁内容随转生次数逐步开放', () => {
      const { sys } = createReadySystem();
      for (let i = 1; i <= 3; i++) {
        sys.executeRebirth();
        const unlocked = sys.getUnlockedContents();
        const count = unlocked.length;
        expect(count).toBeGreaterThanOrEqual(1);
        // 确保每个解锁项的 requiredRebirthCount ≤ 当前次数
        unlocked.forEach(c => {
          expect(c.requiredRebirthCount).toBeLessThanOrEqual(i);
        });
      }
    });

    test('REBIRTH_UNLOCK_CONTENTS 按 requiredRebirthCount 升序排列', () => {
      const counts = REBIRTH_UNLOCK_CONTENTS.map(c => c.requiredRebirthCount);
      const sorted = [...counts].sort((a, b) => a - b);
      expect(counts).toEqual(sorted);
    });
  });

  // ─────────────────────────────────────────
  // K. 转生初始赠送与瞬间建筑
  // ─────────────────────────────────────────

  describe('K. 转生初始赠送', () => {
    test('getInitialGift 返回正确资源', () => {
      const { sys } = createReadySystem();
      const gift = sys.getInitialGift();
      expect(gift.gold).toBe(REBIRTH_INITIAL_GIFT.gold);
      expect(gift.grain).toBe(REBIRTH_INITIAL_GIFT.grain);
      expect(gift.troops).toBe(REBIRTH_INITIAL_GIFT.troops);
    });

    test('赠送值 > 0', () => {
      const { sys } = createReadySystem();
      const gift = sys.getInitialGift();
      expect(gift.gold).toBeGreaterThan(0);
      expect(gift.grain).toBeGreaterThan(0);
      expect(gift.troops).toBeGreaterThan(0);
    });
  });

  describe('K2. 瞬间建筑', () => {
    test('getInstantBuildConfig 返回正确配置', () => {
      const { sys } = createReadySystem();
      const config = sys.getInstantBuildConfig();
      expect(config.maxInstantLevel).toBe(REBIRTH_INSTANT_BUILD.maxInstantLevel);
      expect(config.speedDivisor).toBe(REBIRTH_INSTANT_BUILD.speedDivisor);
    });

    test('低级建筑（≤maxInstantLevel）升级时间大幅缩短', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const buildTime = sys.calculateBuildTime(600, REBIRTH_INSTANT_BUILD.maxInstantLevel);
      expect(buildTime).toBeLessThan(600);
      expect(buildTime).toBeGreaterThanOrEqual(1);
    });

    test('高级建筑（>maxInstantLevel）在加速期内享受加速', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const highLevel = REBIRTH_INSTANT_BUILD.maxInstantLevel + 5;
      const buildTime = sys.calculateBuildTime(600, highLevel);
      expect(buildTime).toBeLessThan(600);
    });
  });

  // ─────────────────────────────────────────
  // L. 存档一致性
  // ─────────────────────────────────────────

  describe('L. 存档一致性', () => {
    test('转生后存档/读档数据一致', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const state = sys.getState();

      const newSys = createSystem();
      newSys.loadSaveData({ rebirth: state });
      const loaded = newSys.getState();

      expect(loaded.rebirthCount).toBe(state.rebirthCount);
      expect(loaded.currentMultiplier).toBeCloseTo(state.currentMultiplier);
      expect(loaded.accelerationDaysLeft).toBe(state.accelerationDaysLeft);
      expect(loaded.rebirthRecords).toHaveLength(state.rebirthRecords.length);
    });

    test('多次转生后存档/读档数据一致', () => {
      const { sys } = createReadySystem();
      for (let i = 0; i < 5; i++) {
        sys.executeRebirth();
      }
      const state = sys.getState();

      const newSys = createSystem();
      newSys.loadSaveData({ rebirth: state });
      const loaded = newSys.getState();

      expect(loaded.rebirthCount).toBe(5);
      expect(loaded.rebirthRecords).toHaveLength(5);
      loaded.rebirthRecords.forEach((r, i) => {
        expect(r.rebirthCount).toBe(i + 1);
      });
    });

    test('getState 返回顶层浅拷贝（state 对象不同引用）', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const state1 = sys.getState();
      const state2 = sys.getState();
      // 顶层对象是浅拷贝
      expect(state1).not.toBe(state2);
    });

    test('getState rebirthRecords 是同一引用（引擎浅拷贝限制）', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const state1 = sys.getState();
      const state2 = sys.getState();
      // ⚠️ 引擎使用 { ...this.state } 浅拷贝，rebirthRecords 数组为同一引用
      // 这是已知行为 — 如果引擎改为深拷贝，此测试需更新为 not.toBe
      expect(state1.rebirthRecords).toBe(state2.rebirthRecords);
    });
  });

  // ─────────────────────────────────────────
  // M. 回调与边界
  // ─────────────────────────────────────────

  describe('M. 回调与边界', () => {
    test('未设置回调时默认值为0，条件不满足', () => {
      const sys = createSystem();
      const check = sys.checkRebirthConditions();
      expect(check.conditions.castleLevel.current).toBe(0);
      expect(check.conditions.heroCount.current).toBe(0);
      expect(check.conditions.totalPower.current).toBe(0);
    });

    test('回调返回动态值（模拟实时变化）', () => {
      let dynamicCastle = 5;
      const sys = createSystem();
      sys.setCallbacks({
        castleLevel: () => dynamicCastle,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
      });
      sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);

      // 低等级不满足
      expect(sys.checkRebirthConditions().conditions.castleLevel.met).toBe(false);

      // 升级后满足
      dynamicCastle = REBIRTH_CONDITIONS.minCastleLevel;
      expect(sys.checkRebirthConditions().conditions.castleLevel.met).toBe(true);
    });

    test('updatePrestigeLevel 实时生效', () => {
      const sys = createSystem();
      sys.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
      });

      sys.updatePrestigeLevel(1);
      expect(sys.checkRebirthConditions().conditions.prestigeLevel.met).toBe(false);

      sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      expect(sys.checkRebirthConditions().conditions.prestigeLevel.met).toBe(true);
    });

    test('reset 恢复初始状态后条件不满足', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      expect(sys.getState().rebirthCount).toBe(1);

      sys.reset();
      expect(sys.getState().rebirthCount).toBe(0);
      expect(sys.getState().currentMultiplier).toBeCloseTo(1.0);
      expect(sys.getState().accelerationDaysLeft).toBe(0);
      expect(sys.getRebirthRecords()).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────
  // N. PRD 与引擎差距汇总（回归防护）
  // ─────────────────────────────────────────

  describe('N. PRD 差距回归防护', () => {
    test('PRD 声望阈值 20 vs 引擎阈值应一致', () => {
      // PRD 要求声望等级≥20，引擎常量也应为20
      expect(REBIRTH_CONDITIONS.minPrestigeLevel).toBe(20);
    });

    test('PRD 转生次数上限 20 vs 引擎 — 引擎未实现', () => {
      const { sys } = createReadySystem();
      for (let i = 0; i < 21; i++) sys.executeRebirth();
      // 引擎无上限检查，当前允许超过20次
      expect(sys.getState().rebirthCount).toBe(21);
    });

    test('PRD 转生冷却72小时 — 引擎未实现', () => {
      const { sys } = createReadySystem();
      const r1 = sys.executeRebirth();
      const r2 = sys.executeRebirth();
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
    });

    test.todo('PRD: 通关进度条件 — 待引擎实现 campaignProgress 后补充');
    test.todo('PRD: 成就链条件 — 待引擎实现 achievementChain 后补充');
    test.todo('PRD: 转生冷却72小时 — 待引擎实现 cooldown 后补充');
    test.todo('PRD: 转生次数上限20 — 待引擎实现 maxRebirthCount 后补充');
    test.todo('PRD: 武将等级衰减50% — 待引擎实现衰减逻辑后补充');
    test.todo('PRD: 天命保留30% — 待引擎实现天命衰减后补充');
    test.todo('PRD: 科技进度保留50% — 待引擎实现衰减后补充');
  });
});
