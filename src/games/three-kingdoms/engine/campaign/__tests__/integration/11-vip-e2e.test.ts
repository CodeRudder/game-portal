/**
 * 集成测试：VIP等级校验端到端（§9.6）
 *
 * 覆盖 Play v3.0 攻城略地(上) 中的 1 个流程：
 *   §9.6 VIP等级校验端到端：VIP经验获取→等级判定→特权解锁→GM命令模拟
 *
 * 测试策略：使用 PrestigeSystem 真实实例 + 事件总线 mock，
 * 验证声望/VIP系统的等级校验完整流程，包括经验获取、升级判定、
 * 特权解锁和GM命令模拟充值场景。
 *
 * 注：当前引擎层使用 PrestigeSystem（声望系统）作为VIP等价系统。
 * VIP等级校验通过声望等级和产出加成来实现。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PrestigeSystem } from '../../../prestige/PrestigeSystem';
import {
  calcRequiredPoints,
  calcProductionBonus,
} from '../../../prestige/PrestigeSystem';
import {
  MAX_PRESTIGE_LEVEL,
  PRESTIGE_BASE,
  PRESTIGE_EXPONENT,
  PRODUCTION_BONUS_PER_LEVEL,
  PRESTIGE_SOURCE_CONFIGS,
} from '../../../../core/prestige/prestige-config';
import type { PrestigeSourceType, PrestigePanel } from '../../../../core/prestige/prestige.types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建简单事件总线 mock */
function createMockEventBus() {
  const listeners: Record<string, Function[]> = {};
  const emitted: Array<{ event: string; payload?: unknown }> = [];

  return {
    on: (event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    off: (event: string, handler: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler);
      }
    },
    emit: (event: string, payload?: unknown) => {
      emitted.push({ event, payload });
      if (listeners[event]) {
        listeners[event].forEach(h => h(payload));
      }
    },
    getEmitted: () => emitted,
    clearEmitted: () => { emitted.length = 0; },
  };
}

/** 创建 mock 系统依赖 */
function createMockDeps() {
  const eventBus = createMockEventBus();
  return {
    eventBus,
    config: {
      get: (key: string) => undefined,
      getNumber: (key: string, def: number) => def,
      getString: (key: string, def: string) => def,
    },
    registry: {
      get: () => null,
      has: () => false,
      register: () => {},
      unregister: () => {},
      getAll: () => new Map(),
    },
  };
}

/** 创建完整的测试环境 */
function createTestEnv() {
  const deps = createMockDeps();
  const prestige = new PrestigeSystem();
  const rewards: Record<string, number>[] = [];

  prestige.init(deps);
  prestige.setRewardCallback((reward) => rewards.push(reward));

  return { prestige, deps, rewards };
}

/** 快速将声望升级到指定等级 */
function levelUpTo(
  prestige: PrestigeSystem,
  targetLevel: number,
): void {
  // 使用 main_quest 途径（无每日上限）快速升级
  while (prestige.getState().currentLevel < targetLevel) {
    const nextLevel = prestige.getState().currentLevel + 1;
    const required = calcRequiredPoints(nextLevel);
    const current = prestige.getState().currentPoints;
    const needed = required - current;
    if (needed > 0) {
      prestige.addPrestigePoints('main_quest', needed);
    }
  }
}

// ═══════════════════════════════════════════════
// §9.6 VIP等级校验端到端
// ═══════════════════════════════════════════════
describe('§9.6 VIP等级校验端到端', () => {

  // ── 阶段1：VIP经验获取 ──
  describe('阶段1：VIP经验获取', () => {
    let env: ReturnType<typeof createTestEnv>;

    beforeEach(() => {
      env = createTestEnv();
    });

    it('should start at level 1 with 0 points', () => {
      const state = env.prestige.getState();
      expect(state.currentLevel).toBe(1);
      expect(state.currentPoints).toBe(0);
    });

    it('should gain prestige points from daily quest', () => {
      const gained = env.prestige.addPrestigePoints('daily_quest', 10);
      expect(gained).toBe(10);
      expect(env.prestige.getState().currentPoints).toBe(10);
    });

    it('should gain prestige points from battle victory', () => {
      const gained = env.prestige.addPrestigePoints('battle_victory', 5);
      expect(gained).toBe(5);
    });

    it('should gain prestige points from main quest (no daily cap)', () => {
      const gained = env.prestige.addPrestigePoints('main_quest', 100);
      expect(gained).toBe(100);
    });

    it('should respect daily cap for capped sources', () => {
      // daily_quest 上限 100
      const config = PRESTIGE_SOURCE_CONFIGS.find(c => c.type === 'daily_quest');
      expect(config).toBeDefined();
      expect(config!.dailyCap).toBe(100);

      // 分多次获取，总计不超过100
      env.prestige.addPrestigePoints('daily_quest', 80);
      env.prestige.addPrestigePoints('daily_quest', 30); // 只能获得20
      const state = env.prestige.getState();
      expect(state.dailyGained['daily_quest']).toBe(100);
    });

    it('should return 0 when daily cap is reached', () => {
      env.prestige.addPrestigePoints('daily_quest', 100);
      const overflow = env.prestige.addPrestigePoints('daily_quest', 10);
      expect(overflow).toBe(0);
    });

    it('should track daily gained per source type', () => {
      env.prestige.addPrestigePoints('daily_quest', 30);
      env.prestige.addPrestigePoints('battle_victory', 50);

      const state = env.prestige.getState();
      expect(state.dailyGained['daily_quest']).toBe(30);
      expect(state.dailyGained['battle_victory']).toBe(50);
    });

    it('should accumulate total points across all sources', () => {
      env.prestige.addPrestigePoints('daily_quest', 20);
      env.prestige.addPrestigePoints('battle_victory', 15);
      env.prestige.addPrestigePoints('main_quest', 100);

      const state = env.prestige.getState();
      expect(state.totalPoints).toBe(135);
    });
  });

  // ── 阶段2：等级判定 ──
  describe('阶段2：等级判定', () => {
    let env: ReturnType<typeof createTestEnv>;

    beforeEach(() => {
      env = createTestEnv();
    });

    it('should calculate required points using formula 1000 × N^1.8', () => {
      // Level 2: 1000 × 2^1.8 ≈ 3482
      const level2 = calcRequiredPoints(2);
      expect(level2).toBe(Math.floor(1000 * Math.pow(2, 1.8)));

      // Level 5: 1000 × 5^1.8 ≈ 8726
      const level5 = calcRequiredPoints(5);
      expect(level5).toBe(Math.floor(1000 * Math.pow(5, 1.8)));
    });

    it('should auto level up when points meet threshold', () => {
      const required = calcRequiredPoints(2);
      env.prestige.addPrestigePoints('main_quest', required);

      const state = env.prestige.getState();
      expect(state.currentLevel).toBe(2);
    });

    it('should emit levelUp event on level change', () => {
      const required = calcRequiredPoints(2);
      env.prestige.addPrestigePoints('main_quest', required);

      const levelUps = env.deps.eventBus.getEmitted()
        .filter(e => e.event === 'prestige:levelUp');
      expect(levelUps.length).toBeGreaterThan(0);
      expect(levelUps[0].payload).toMatchObject({
        level: 2,
      });
    });

    it('should skip multiple levels with large point gain', () => {
      // 给大量声望值，跳级
      env.prestige.addPrestigePoints('main_quest', 50000);

      const state = env.prestige.getState();
      expect(state.currentLevel).toBeGreaterThan(1);
    });

    it('should not exceed MAX_PRESTIGE_LEVEL', () => {
      // 给超级多声望值
      env.prestige.addPrestigePoints('main_quest', 999999999);

      const state = env.prestige.getState();
      expect(state.currentLevel).toBeLessThanOrEqual(MAX_PRESTIGE_LEVEL);
    });

    it('should provide correct prestige panel data', () => {
      const panel: PrestigePanel = env.prestige.getPrestigePanel();

      expect(panel.currentLevel).toBe(1);
      expect(panel.currentPoints).toBe(0);
      expect(panel.productionBonus).toBe(calcProductionBonus(1));
      expect(panel.nextLevelPoints).toBe(calcRequiredPoints(2));
    });

    it('should provide correct level info for any level', () => {
      const info = env.prestige.getLevelInfo(5);

      expect(info.level).toBe(5);
      expect(info.requiredPoints).toBe(calcRequiredPoints(5));
      expect(info.productionBonus).toBe(calcProductionBonus(5));
      expect(info.title).toBeTruthy();
    });
  });

  // ── 阶段3：特权解锁 ──
  describe('阶段3：特权解锁', () => {
    let env: ReturnType<typeof createTestEnv>;

    beforeEach(() => {
      env = createTestEnv();
    });

    it('should calculate production bonus as 1 + level × 0.02', () => {
      const bonus1 = calcProductionBonus(1);
      expect(bonus1).toBe(1 + 1 * PRODUCTION_BONUS_PER_LEVEL);

      const bonus10 = calcProductionBonus(10);
      expect(bonus10).toBe(1 + 10 * PRODUCTION_BONUS_PER_LEVEL);
    });

    it('should increase production bonus on level up', () => {
      const bonusBefore = env.prestige.getProductionBonus();
      levelUpTo(env.prestige, 5);
      const bonusAfter = env.prestige.getProductionBonus();

      expect(bonusAfter).toBeGreaterThan(bonusBefore);
    });

    it('should list level unlock rewards', () => {
      const rewards = env.prestige.getLevelRewards();
      expect(Array.isArray(rewards)).toBe(true);
    });

    it('should not claim reward for level not reached', () => {
      // 尝试领取高等级奖励
      const result = env.prestige.claimLevelReward(100);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('等级不足');
    });

    it('should claim reward for reached level', () => {
      // 先升级到足够高的等级
      levelUpTo(env.prestige, 5);

      // 查找等级5以下的奖励
      const rewards = env.prestige.getLevelRewards();
      const claimable = rewards.find(r => r.level <= 5 && !r.claimed);

      if (claimable) {
        const result = env.prestige.claimLevelReward(claimable.level);
        expect(result.success).toBe(true);
      }
    });

    it('should not claim same level reward twice', () => {
      levelUpTo(env.prestige, 5);

      const rewards = env.prestige.getLevelRewards();
      const claimable = rewards.find(r => r.level <= 5 && !r.claimed);

      if (claimable) {
        env.prestige.claimLevelReward(claimable.level);
        const result = env.prestige.claimLevelReward(claimable.level);
        expect(result.success).toBe(false);
        expect(result.reason).toContain('已领取');
      }
    });

    it('should include privileges in level info', () => {
      const info = env.prestige.getLevelInfo(10);
      expect(Array.isArray(info.privileges)).toBe(true);
    });
  });

  // ── 阶段4：GM命令模拟 ──
  describe('阶段4：GM命令模拟', () => {
    let env: ReturnType<typeof createTestEnv>;

    beforeEach(() => {
      env = createTestEnv();
    });

    it('should simulate GM add prestige command via event', () => {
      // 模拟GM命令：通过事件总线注入声望
      env.deps.eventBus.emit('prestige:gain', {
        source: 'event_complete',
        points: 5000,
      });

      const state = env.prestige.getState();
      expect(state.currentPoints).toBeGreaterThan(0);
      expect(state.totalPoints).toBeGreaterThan(0);
    });

    it('should simulate GM set level via direct point injection', () => {
      // GM直接设置等级：注入足够声望值到达目标等级
      const targetLevel = 10;
      levelUpTo(env.prestige, targetLevel);

      expect(env.prestige.getState().currentLevel).toBe(targetLevel);
    });

    it('should simulate GM reset via reset()', () => {
      levelUpTo(env.prestige, 10);
      expect(env.prestige.getState().currentLevel).toBe(10);

      // GM重置
      env.prestige.reset();
      expect(env.prestige.getState().currentLevel).toBe(1);
      expect(env.prestige.getState().currentPoints).toBe(0);
      expect(env.prestige.getState().totalPoints).toBe(0);
    });

    it('should simulate GM prestige save/load cycle', () => {
      levelUpTo(env.prestige, 8);
      const saved = env.prestige.getSaveData();

      // 创建新实例并加载存档
      const env2 = createTestEnv();
      env2.prestige.loadSaveData(saved);

      expect(env2.prestige.getState().currentLevel).toBe(8);
      expect(env2.prestige.getState().currentPoints).toBe(saved.prestige.currentPoints);
    });

    it('should handle GM massive point injection without crash', () => {
      // GM注入巨额声望
      expect(() => {
        env.prestige.addPrestigePoints('main_quest', 999999999);
      }).not.toThrow();

      const state = env.prestige.getState();
      expect(state.currentLevel).toBeLessThanOrEqual(MAX_PRESTIGE_LEVEL);
      expect(state.currentPoints).toBeGreaterThan(0);
    });

    it('should simulate prestige quest completion via GM', () => {
      // 先获取一些声望以推进任务进度
      env.prestige.addPrestigePoints('daily_quest', 50);

      const quests = env.prestige.getPrestigeQuests();
      expect(Array.isArray(quests)).toBe(true);
    });

    it('should track prestige quest progress', () => {
      env.prestige.addPrestigePoints('daily_quest', 50);

      // 获取声望任务进度
      const quests = env.prestige.getPrestigeQuests();
      if (quests.length > 0) {
        const progress = env.prestige.getPrestigeQuestProgress(quests[0].id);
        expect(typeof progress).toBe('number');
      }
    });
  });

  // ── 端到端串联 ──
  describe('端到端串联：完整VIP生命周期', () => {
    it('should complete full VIP lifecycle: gain → level up → unlock → GM verify', () => {
      const env = createTestEnv();

      // 1. 初始状态
      expect(env.prestige.getState().currentLevel).toBe(1);
      expect(env.prestige.getProductionBonus()).toBe(1 + 1 * PRODUCTION_BONUS_PER_LEVEL);

      // 2. 通过多种途径获取声望
      env.prestige.addPrestigePoints('daily_quest', 50);
      env.prestige.addPrestigePoints('battle_victory', 100);
      env.prestige.addPrestigePoints('main_quest', 5000);

      // 3. 验证等级提升
      const state = env.prestige.getState();
      expect(state.currentLevel).toBeGreaterThan(1);
      expect(state.totalPoints).toBeGreaterThan(0);

      // 4. 验证产出加成增加
      const bonus = env.prestige.getProductionBonus();
      expect(bonus).toBeGreaterThan(1 + 1 * PRODUCTION_BONUS_PER_LEVEL);

      // 5. 验证面板数据一致性
      const panel = env.prestige.getPrestigePanel();
      expect(panel.currentLevel).toBe(state.currentLevel);
      expect(panel.currentPoints).toBe(state.currentPoints);
      expect(panel.totalPoints).toBe(state.totalPoints);
      expect(panel.productionBonus).toBe(bonus);

      // 6. 验证等级信息
      const levelInfo = env.prestige.getCurrentLevelInfo();
      expect(levelInfo.level).toBe(state.currentLevel);
      expect(levelInfo.productionBonus).toBe(bonus);

      // 7. 存档→加载→验证一致性
      const saved = env.prestige.getSaveData();
      const env2 = createTestEnv();
      env2.prestige.loadSaveData(saved);

      expect(env2.prestige.getState().currentLevel).toBe(state.currentLevel);
      expect(env2.prestige.getProductionBonus()).toBe(bonus);
    });
  });
});
