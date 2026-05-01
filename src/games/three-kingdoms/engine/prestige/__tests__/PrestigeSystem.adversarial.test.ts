/**
 * PrestigeSystem 对抗式测试
 *
 * 五维度挑战覆盖：
 *   F-Normal: 主线流程完整性
 *   F-Boundary: 边界条件覆盖
 *   F-Error: 异常路径覆盖
 *   F-Cross: 跨系统交互覆盖
 *   F-Lifecycle: 数据生命周期覆盖
 *
 * 重点测试：声望等级提升、奖励领取、每日上限、任务进度、存档完整性
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrestigeSystem, calcRequiredPoints, calcProductionBonus } from '../PrestigeSystem';
import type { ISystemDeps } from '../../../core/types';
import type { PrestigeSourceType } from '../../../core/prestige';
import { MAX_PRESTIGE_LEVEL, PRESTIGE_BASE, PRESTIGE_EXPONENT, PRESTIGE_SAVE_VERSION } from '../../../core/prestige';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

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

function createSystem(): PrestigeSystem {
  const sys = new PrestigeSystem();
  sys.init(mockDeps());
  return sys;
}

/**
 * 升到指定等级所需的最少声望值
 *
 * checkLevelUp 逻辑：while currentPoints >= calcRequiredPoints(nextLevel)
 * currentPoints 是累积的，不会在升级时消耗。
 * 所以要达到等级 N，需要 calcRequiredPoints(N) 点声望值。
 */
function pointsForLevel(targetLevel: number): number {
  return calcRequiredPoints(targetLevel);
}

// ═══════════════════════════════════════════════════════════

describe('PrestigeSystem 对抗式测试', () => {
  let sys: PrestigeSystem;

  beforeEach(() => {
    sys = createSystem();
  });

  // ═══════════════════════════════════════════
  // F-Normal: 主线流程完整性
  // ═══════════════════════════════════════════

  describe('[F-Normal] 声望获取与等级提升', () => {
    it('正常获取声望值并累计', () => {
      const gained = sys.addPrestigePoints('battle_victory', 50);
      expect(gained).toBe(50);
      const state = sys.getState();
      expect(state.currentPoints).toBe(50);
      expect(state.totalPoints).toBe(50);
    });

    it('声望达到阈值自动升级', () => {
      const needed = calcRequiredPoints(2);
      sys.addPrestigePoints('main_quest', needed);
      expect(sys.getState().currentLevel).toBe(2);
    });

    it('连续多次获取受每日上限约束', () => {
      // daily_quest dailyCap=100, 20次*10=200但只能获得100
      for (let i = 0; i < 20; i++) {
        sys.addPrestigePoints('daily_quest', 10);
      }
      expect(sys.getState().currentLevel).toBe(1);
      expect(sys.getState().currentPoints).toBe(100);
    });

    it('产出加成随等级提升', () => {
      expect(sys.getProductionBonus()).toBe(1 + 1 * 0.02); // level 1
      // 升到5级
      sys.addPrestigePoints('main_quest', calcRequiredPoints(5));
      expect(sys.getState().currentLevel).toBe(5);
      expect(sys.getProductionBonus()).toBe(1 + 5 * 0.02);
    });

    it('声望分栏信息完整', () => {
      const panel = sys.getPrestigePanel();
      expect(panel.currentLevel).toBe(1);
      expect(panel.currentPoints).toBe(0);
      expect(panel.totalPoints).toBe(0);
      expect(panel.productionBonus).toBe(1.02);
      expect(panel.nextLevelPoints).toBe(calcRequiredPoints(2));
    });
  });

  // ═══════════════════════════════════════════
  // F-Boundary: 边界条件覆盖
  // ═══════════════════════════════════════════

  describe('[F-Boundary] 边界条件', () => {
    it('每日上限精确截断：刚好达到上限', () => {
      // daily_quest dailyCap=100
      const g1 = sys.addPrestigePoints('daily_quest', 80);
      expect(g1).toBe(80);
      const g2 = sys.addPrestigePoints('daily_quest', 30);
      expect(g2).toBe(20); // 只能获得剩余的20
      const g3 = sys.addPrestigePoints('daily_quest', 10);
      expect(g3).toBe(0); // 已达上限
    });

    it('每日上限为-1时无限制（main_quest）', () => {
      const gained = sys.addPrestigePoints('main_quest', 99999);
      expect(gained).toBe(99999);
    });

    it('单次获取0声望值', () => {
      const gained = sys.addPrestigePoints('battle_victory', 0);
      expect(gained).toBe(0);
    });

    it('单次获取极大声望值', () => {
      const gained = sys.addPrestigePoints('main_quest', Number.MAX_SAFE_INTEGER);
      expect(gained).toBe(Number.MAX_SAFE_INTEGER);
      // currentPoints 经过 checkLevelUp 后可能因等级提升计算导致精度变化
      // 但声望值应该非常大
      expect(sys.getState().currentPoints).toBeGreaterThan(Number.MAX_SAFE_INTEGER - 1000);
    });

    it('声望等级达到最大等级50后不再升级', () => {
      // 给足够升到50级的声望
      sys.addPrestigePoints('main_quest', calcRequiredPoints(50));
      expect(sys.getState().currentLevel).toBe(MAX_PRESTIGE_LEVEL);
      // 再加也不会超
      sys.addPrestigePoints('main_quest', 100000);
      expect(sys.getState().currentLevel).toBe(MAX_PRESTIGE_LEVEL);
    });

    it('calcRequiredPoints 边界值', () => {
      expect(calcRequiredPoints(0)).toBe(0);
      expect(calcRequiredPoints(-1)).toBe(0);
      expect(calcRequiredPoints(1)).toBe(Math.floor(PRESTIGE_BASE * Math.pow(1, PRESTIGE_EXPONENT)));
      expect(calcRequiredPoints(50)).toBe(Math.floor(PRESTIGE_BASE * Math.pow(50, PRESTIGE_EXPONENT)));
    });

    it('calcProductionBonus 边界值', () => {
      expect(calcProductionBonus(0)).toBe(1);
      expect(calcProductionBonus(1)).toBe(1.02);
      expect(calcProductionBonus(50)).toBe(1 + 50 * 0.02);
      expect(calcProductionBonus(-1)).toBe(1 + (-1) * 0.02); // 0.98
    });

    it('无效声望来源类型返回0', () => {
      const gained = sys.addPrestigePoints('invalid_source_type' as PrestigeSourceType, 100);
      expect(gained).toBe(0);
    });

    it('连续升级：一次获得足够升多级的声望', () => {
      // 一次给够升到5级
      sys.addPrestigePoints('main_quest', calcRequiredPoints(5));
      expect(sys.getState().currentLevel).toBe(5);
    });

    it('刚好卡在升级阈值的声望值', () => {
      const needed = calcRequiredPoints(2);
      sys.addPrestigePoints('main_quest', needed - 1);
      expect(sys.getState().currentLevel).toBe(1);
      sys.addPrestigePoints('main_quest', 1);
      expect(sys.getState().currentLevel).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // F-Error: 异常路径覆盖
  // ═══════════════════════════════════════════

  describe('[F-Error] 异常路径', () => {
    it('负数声望值：FIX-501 已修复，返回0', () => {
      // FIX-501: 负数声望值被拦截，返回0
      const gained = sys.addPrestigePoints('battle_victory', -100);
      expect(gained).toBe(0);
      expect(sys.getState().currentPoints).toBe(0);
    });

    it('NaN声望值处理：FIX-501 已修复，返回0', () => {
      // FIX-501: NaN声望值被拦截，返回0
      const gained = sys.addPrestigePoints('battle_victory', NaN);
      expect(gained).toBe(0);
    });

    it('Infinity声望值处理：FIX-501 已修复，返回0', () => {
      // FIX-501: Infinity声望值被拦截，返回0
      const gained = sys.addPrestigePoints('main_quest', Infinity);
      expect(gained).toBe(0);
      expect(sys.getState().currentPoints).toBe(0);
    });

    it('重复领取等级奖励被拒绝', () => {
      // 先升到5级
      sys.addPrestigePoints('main_quest', calcRequiredPoints(5));
      expect(sys.getState().currentLevel).toBeGreaterThanOrEqual(5);

      const r1 = sys.claimLevelReward(5);
      expect(r1.success).toBe(true);
      const r2 = sys.claimLevelReward(5);
      expect(r2.success).toBe(false);
      expect(r2.reason).toContain('已领取');
    });

    it('声望等级不足时领取奖励被拒绝', () => {
      const result = sys.claimLevelReward(50);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('等级不足');
    });

    it('领取不存在配置的等级奖励被拒绝', () => {
      // 先升到足够等级
      sys.addPrestigePoints('main_quest', calcRequiredPoints(50));
      // level 999 不在 LEVEL_UNLOCK_REWARDS 配置中
      const result = sys.claimLevelReward(999);
      expect(result.success).toBe(false);
      // 先检查等级（等级足够），然后检查配置中是否有该等级奖励
      expect(result.reason).toBeDefined();
    });

    it('未初始化时不崩溃', () => {
      const raw = new PrestigeSystem();
      expect(() => raw.getState()).not.toThrow();
      expect(() => raw.getPrestigePanel()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // F-Cross: 跨系统交互覆盖
  // ═══════════════════════════════════════════

  describe('[F-Cross] 跨系统交互', () => {
    it('事件监听声望获取事件', () => {
      const deps = mockDeps();
      const sys2 = new PrestigeSystem();
      sys2.init(deps);
      const onCalls = (deps.eventBus.on as ReturnType<typeof vi.fn>).mock.calls;
      const gainHandler = onCalls.find((c: string[]) => c[0] === 'prestige:gain');
      expect(gainHandler).toBeDefined();
    });

    it('升级事件正确发射', () => {
      const deps = mockDeps();
      const sys2 = new PrestigeSystem();
      sys2.init(deps);
      const needed = calcRequiredPoints(2);
      sys2.addPrestigePoints('main_quest', needed);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('prestige:levelUp', expect.objectContaining({
        level: 2,
      }));
    });

    it('每日重置事件监听', () => {
      const deps = mockDeps();
      const sys2 = new PrestigeSystem();
      sys2.init(deps);
      const onCalls = (deps.eventBus.on as ReturnType<typeof vi.fn>).mock.calls;
      const dayHandler = onCalls.find((c: string[]) => c[0] === 'calendar:dayChanged');
      expect(dayHandler).toBeDefined();
    });

    it('奖励回调正确触发', () => {
      const cb = vi.fn();
      sys.setRewardCallback(cb);
      sys.addPrestigePoints('main_quest', calcRequiredPoints(5));
      const result = sys.claimLevelReward(5);
      expect(result.success).toBe(true);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ gold: expect.any(Number) }));
    });

    it('声望任务 reach_prestige_level 自动检测', () => {
      const cb = vi.fn();
      sys.setRewardCallback(cb);
      // pq-001: reach_prestige_level 3, requiredPrestigeLevel=1
      sys.addPrestigePoints('main_quest', calcRequiredPoints(3));
      // 升到3级时自动更新任务进度并检测完成
      expect(sys.getState().completedPrestigeQuests).toContain('pq-001');
    });

    it('转生状态回调在存档时被调用', () => {
      const rebirthCb = vi.fn().mockReturnValue({
        rebirthCount: 2,
        currentMultiplier: 2.0,
        rebirthRecords: [],
        accelerationDaysLeft: 0,
        completedRebirthQuests: [],
        rebirthQuestProgress: {},
      });
      sys.setRebirthStateCallback(rebirthCb);
      const saveData = sys.getSaveData();
      expect(rebirthCb).toHaveBeenCalled();
      expect(saveData.rebirth.rebirthCount).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // F-Lifecycle: 数据生命周期覆盖
  // ═══════════════════════════════════════════

  describe('[F-Lifecycle] 存档与加载', () => {
    it('存档数据结构完整', () => {
      sys.addPrestigePoints('main_quest', 500);
      const save = sys.getSaveData();
      expect(save.version).toBe(PRESTIGE_SAVE_VERSION);
      expect(save.prestige).toBeDefined();
      expect(save.prestige.currentPoints).toBe(500);
      expect(save.prestige.currentLevel).toBe(1);
      expect(save.rebirth).toBeDefined();
    });

    it('存档后加载恢复状态', () => {
      sys.addPrestigePoints('main_quest', calcRequiredPoints(10));
      const levelBefore = sys.getState().currentLevel;
      sys.claimLevelReward(5);
      const save = sys.getSaveData();

      const sys2 = createSystem();
      sys2.loadSaveData(save);
      const state = sys2.getState();
      expect(state.currentLevel).toBe(levelBefore);
      expect(state.claimedLevelRewards).toContain(5);
    });

    it('版本不匹配时拒绝加载', () => {
      const sys2 = createSystem();
      sys2.addPrestigePoints('main_quest', 1000);
      const badSave = { ...sys2.getSaveData(), version: 999 };
      const sys3 = createSystem();
      sys3.loadSaveData(badSave);
      expect(sys3.getState().currentPoints).toBe(0);
    });

    it('存档数据为深拷贝不影响原状态', () => {
      sys.addPrestigePoints('main_quest', 500);
      const save = sys.getSaveData();
      save.prestige.currentPoints = 0;
      expect(sys.getState().currentPoints).toBe(500);
    });

    it('reset后存档数据为初始状态', () => {
      sys.addPrestigePoints('main_quest', 10000);
      sys.reset();
      const save = sys.getSaveData();
      expect(save.prestige.currentPoints).toBe(0);
      expect(save.prestige.currentLevel).toBe(1);
      expect(save.prestige.totalPoints).toBe(0);
    });

    it('声望任务进度在存档中保留', () => {
      sys.addPrestigePoints('daily_quest', 50);
      const save = sys.getSaveData();
      expect(save.prestige.prestigeQuestProgress).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // 对抗式：声望等级提升压力测试
  // ═══════════════════════════════════════════

  describe('[对抗] 等级提升压力测试', () => {
    it('从等级1连续升到等级50', () => {
      sys.addPrestigePoints('main_quest', calcRequiredPoints(50));
      expect(sys.getState().currentLevel).toBe(50);
      expect(sys.getProductionBonus()).toBe(1 + 50 * 0.02);
    });

    it('逐级升级：每级声望值精确匹配', () => {
      for (let level = 2; level <= 10; level++) {
        // currentPoints 需要达到 calcRequiredPoints(level) 才能升到 level
        const needed = calcRequiredPoints(level);
        const currentPoints = sys.getState().currentPoints;
        if (currentPoints < needed) {
          sys.addPrestigePoints('main_quest', needed - currentPoints);
        }
        expect(sys.getState().currentLevel).toBe(level);
      }
    });

    it('等级信息查询一致性', () => {
      for (let level = 1; level <= 50; level++) {
        const info = sys.getLevelInfo(level);
        expect(info.level).toBe(level);
        expect(info.requiredPoints).toBe(calcRequiredPoints(level));
        expect(info.productionBonus).toBe(calcProductionBonus(level));
      }
    });
  });

  // ═══════════════════════════════════════════
  // 对抗式：每日上限精确测试
  // ═══════════════════════════════════════════

  describe('[对抗] 每日上限精确测试', () => {
    it('所有9种途径的每日上限行为', () => {
      const sources: PrestigeSourceType[] = [
        'daily_quest', 'main_quest', 'battle_victory',
        'building_upgrade', 'tech_research', 'npc_interact',
        'expedition', 'pvp_rank', 'event_complete',
      ];
      for (const source of sources) {
        const sys2 = createSystem();
        const gained = sys2.addPrestigePoints(source, 99999);
        if (source === 'main_quest') {
          expect(gained).toBe(99999); // 无上限
        } else {
          expect(gained).toBeLessThan(99999); // 有上限
        }
      }
    });

    it('每日重置后上限恢复', () => {
      const deps = mockDeps();
      const sys2 = new PrestigeSystem();
      sys2.init(deps);
      sys2.addPrestigePoints('daily_quest', 100);
      expect(sys2.addPrestigePoints('daily_quest', 10)).toBe(0);

      // 触发日变更
      const onCalls = (deps.eventBus.on as ReturnType<typeof vi.fn>).mock.calls;
      const dayHandler = onCalls.find((c: string[]) => c[0] === 'calendar:dayChanged');
      if (dayHandler) {
        (dayHandler[1] as () => void)();
        expect(sys2.addPrestigePoints('daily_quest', 10)).toBe(10);
      }
    });
  });
});
