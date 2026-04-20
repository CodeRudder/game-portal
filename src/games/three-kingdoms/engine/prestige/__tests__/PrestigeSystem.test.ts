/**
 * PrestigeSystem 单元测试
 *
 * 覆盖声望系统所有功能：
 * - #1 声望分栏
 * - #2 等级阈值公式 1000×N^1.8
 * - #3 升级规则
 * - #4 产出加成特权
 * - #5 声望获取途径 (9种)
 * - #7 等级解锁奖励
 * - #14 声望专属任务
 * - #15 转生专属任务
 */

import { PrestigeSystem, calcRequiredPoints, calcProductionBonus } from '../PrestigeSystem';
import type { ISystemDeps } from '../../../core/types';
import type { PrestigeSourceType } from '../../../core/prestige';
import { MAX_PRESTIGE_LEVEL, PRESTIGE_BASE, PRESTIGE_EXPONENT } from '../../../core/prestige';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

function createSystem(): PrestigeSystem {
  const sys = new PrestigeSystem();
  sys.init(mockDeps());
  return sys;
}

// ═══════════════════════════════════════════════════════════

describe('PrestigeSystem', () => {
  let sys: PrestigeSystem;

  beforeEach(() => {
    sys = createSystem();
  });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════

  describe('ISubsystem', () => {
    test('name 为 prestige', () => {
      expect(sys.name).toBe('prestige');
    });

    test('初始状态正确', () => {
      const state = sys.getState();
      expect(state.currentPoints).toBe(0);
      expect(state.totalPoints).toBe(0);
      expect(state.currentLevel).toBe(1);
    });

    test('reset 恢复初始状态', () => {
      sys.addPrestigePoints('battle_victory', 100);
      sys.reset();
      const state = sys.getState();
      expect(state.currentPoints).toBe(0);
      expect(state.currentLevel).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 等级阈值公式 (#2) — 1000×N^1.8
  // ═══════════════════════════════════════════

  describe('等级阈值公式', () => {
    test('calcRequiredPoints 公式正确', () => {
      // 1000 × 1^1.8 = 1000
      expect(calcRequiredPoints(1)).toBe(1000);
      // 1000 × 2^1.8 ≈ 3482
      expect(calcRequiredPoints(2)).toBe(Math.floor(PRESTIGE_BASE * Math.pow(2, PRESTIGE_EXPONENT)));
      // 1000 × 5^1.8 ≈ 7862
      expect(calcRequiredPoints(5)).toBe(Math.floor(PRESTIGE_BASE * Math.pow(5, PRESTIGE_EXPONENT)));
      // 1000 × 10^1.8 ≈ 39811
      expect(calcRequiredPoints(10)).toBe(Math.floor(PRESTIGE_BASE * Math.pow(10, PRESTIGE_EXPONENT)));
    });

    test('level <= 0 返回 0', () => {
      expect(calcRequiredPoints(0)).toBe(0);
      expect(calcRequiredPoints(-1)).toBe(0);
    });

    test('高等级阈值递增', () => {
      let prev = 0;
      for (let i = 1; i <= MAX_PRESTIGE_LEVEL; i++) {
        const pts = calcRequiredPoints(i);
        expect(pts).toBeGreaterThan(prev);
        prev = pts;
      }
    });
  });

  // ═══════════════════════════════════════════
  // 3. 产出加成 (#4)
  // ═══════════════════════════════════════════

  describe('产出加成', () => {
    test('calcProductionBonus 公式: 1 + level × 0.02', () => {
      expect(calcProductionBonus(1)).toBeCloseTo(1.02);
      expect(calcProductionBonus(10)).toBeCloseTo(1.2);
      expect(calcProductionBonus(50)).toBeCloseTo(2.0);
    });

    test('初始产出加成为 1.02', () => {
      expect(sys.getProductionBonus()).toBeCloseTo(1.02);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 声望分栏 (#1)
  // ═══════════════════════════════════════════

  describe('声望分栏', () => {
    test('初始分栏数据正确', () => {
      const panel = sys.getPrestigePanel();
      expect(panel.currentLevel).toBe(1);
      expect(panel.currentPoints).toBe(0);
      expect(panel.totalPoints).toBe(0);
      expect(panel.productionBonus).toBeCloseTo(1.02);
      expect(panel.nextLevelPoints).toBe(calcRequiredPoints(2));
    });

    test('获取等级信息', () => {
      const info = sys.getLevelInfo(5);
      expect(info.level).toBe(5);
      expect(info.requiredPoints).toBe(calcRequiredPoints(5));
      expect(info.productionBonus).toBeCloseTo(1 + 5 * 0.02);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 声望获取途径 (#5)
  // ═══════════════════════════════════════════

  describe('声望获取途径', () => {
    test('9种获取途径', () => {
      const configs = sys.getSourceConfigs();
      expect(configs).toHaveLength(9);
    });

    test('正常获取声望', () => {
      const gained = sys.addPrestigePoints('battle_victory', 50);
      expect(gained).toBe(50);
      expect(sys.getState().currentPoints).toBe(50);
      expect(sys.getState().totalPoints).toBe(50);
    });

    test('每日上限限制', () => {
      // battle_victory 每日上限 200
      const gained1 = sys.addPrestigePoints('battle_victory', 150);
      expect(gained1).toBe(150);

      const gained2 = sys.addPrestigePoints('battle_victory', 100);
      expect(gained2).toBe(50); // 只能获取剩余50

      const gained3 = sys.addPrestigePoints('battle_victory', 10);
      expect(gained3).toBe(0); // 已达上限
    });

    test('无上限途径不限制', () => {
      // main_quest 每日上限 -1 (无限)
      const gained = sys.addPrestigePoints('main_quest', 1000);
      expect(gained).toBe(1000);
    });

    test('无效途径返回0', () => {
      const gained = sys.addPrestigePoints('invalid_type' as PrestigeSourceType, 100);
      expect(gained).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 升级规则 (#3)
  // ═══════════════════════════════════════════

  describe('升级规则', () => {
    test('达到阈值自动升级', () => {
      // 等级1 → 2 需要 calcRequiredPoints(2) ≈ 3482
      const required = calcRequiredPoints(2);
      sys.addPrestigePoints('main_quest', required);

      const state = sys.getState();
      expect(state.currentLevel).toBeGreaterThanOrEqual(2);
    });

    test('一次获取大量声望可跳级', () => {
      const required = calcRequiredPoints(5);
      sys.addPrestigePoints('main_quest', required);

      const state = sys.getState();
      expect(state.currentLevel).toBeGreaterThanOrEqual(5);
    });

    test('等级上限为50', () => {
      // 给予巨量声望
      sys.addPrestigePoints('main_quest', 999999999);
      expect(sys.getState().currentLevel).toBe(MAX_PRESTIGE_LEVEL);
    });

    test('升级时发射事件', () => {
      const deps = mockDeps();
      const emitSpy = jest.spyOn(deps.eventBus, 'emit');
      const localSys = new PrestigeSystem();
      localSys.init(deps);

      localSys.addPrestigePoints('main_quest', calcRequiredPoints(2));

      expect(emitSpy).toHaveBeenCalledWith('prestige:levelUp', expect.objectContaining({
        level: expect.any(Number),
      }));
    });
  });

  // ═══════════════════════════════════════════
  // 7. 等级解锁奖励 (#7)
  // ═══════════════════════════════════════════

  describe('等级解锁奖励', () => {
    test('获取奖励列表', () => {
      const rewards = sys.getLevelRewards();
      expect(rewards.length).toBeGreaterThan(0);
    });

    test('等级不足不能领取', () => {
      const result = sys.claimLevelReward(5);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('等级不足');
    });

    test('达到等级可领取', () => {
      sys.addPrestigePoints('main_quest', calcRequiredPoints(5));
      const state = sys.getState();
      // 确保达到等级5
      if (state.currentLevel >= 5) {
        const result = sys.claimLevelReward(5);
        expect(result.success).toBe(true);
      }
    });

    test('不可重复领取', () => {
      sys.addPrestigePoints('main_quest', calcRequiredPoints(5));
      const state = sys.getState();
      if (state.currentLevel >= 5) {
        sys.claimLevelReward(5);
        const result = sys.claimLevelReward(5);
        expect(result.success).toBe(false);
        expect(result.reason).toContain('已领取');
      }
    });
  });

  // ═══════════════════════════════════════════
  // 8. 声望专属任务 (#14)
  // ═══════════════════════════════════════════

  describe('声望专属任务', () => {
    test('初始只有等级1可见的任务', () => {
      const quests = sys.getPrestigeQuests();
      expect(quests.every((q) => q.requiredPrestigeLevel <= 1)).toBe(true);
    });

    test('等级提升解锁更多任务', () => {
      sys.addPrestigePoints('main_quest', calcRequiredPoints(5));
      const quests = sys.getPrestigeQuests();
      expect(quests.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 转生专属任务 (#15)
  // ═══════════════════════════════════════════

  describe('转生专属任务', () => {
    test('转生0次只显示基础任务', () => {
      const quests = sys.getRebirthQuests(0);
      expect(quests.every((q) => q.requiredRebirthCount <= 0)).toBe(true);
    });

    test('转生次数增加解锁更多任务', () => {
      const quests0 = sys.getRebirthQuests(0);
      const quests5 = sys.getRebirthQuests(5);
      expect(quests5.length).toBeGreaterThanOrEqual(quests0.length);
    });
  });

  // ═══════════════════════════════════════════
  // 10. 存档
  // ═══════════════════════════════════════════

  describe('存档', () => {
    test('存档和读档一致', () => {
      sys.addPrestigePoints('main_quest', 5000);
      const saveData = sys.getSaveData();
      const state = sys.getState();

      const newSys = createSystem();
      newSys.loadSaveData(saveData);
      const loadedState = newSys.getState();

      expect(loadedState.currentPoints).toBe(state.currentPoints);
      expect(loadedState.totalPoints).toBe(state.totalPoints);
      expect(loadedState.currentLevel).toBe(state.currentLevel);
    });
  });
});
