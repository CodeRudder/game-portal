/**
 * MiniGameSystem 小游戏系统 — 单元测试
 *
 * 覆盖范围：
 * - 注册小游戏
 * - 设置转盘奖品 / 抽奖奖品 / 答题题库
 * - 玩小游戏（免费次数 / 付费次数）
 * - 转盘抽奖 / 幸运抽奖 / 答题
 * - 每日免费次数重置
 * - 剩余免费次数查询
 * - 事件监听
 * - 序列化 / 反序列化
 * - 系统重置
 *
 * @module engines/idle/modules/__tests__/MiniGameSystem.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MiniGameSystem,
  type MiniGameDef,
  type WheelPrize,
  type DrawPrize,
  type QuizQuestion,
  type MiniGameEvent,
} from '../MiniGameSystem';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建转盘小游戏定义 */
function makeWheelGame(overrides?: Partial<MiniGameDef>): MiniGameDef {
  return {
    id: 'lucky_wheel',
    name: '幸运转盘',
    type: 'wheel',
    description: '每日免费转 3 次',
    icon: '🎡',
    dailyFreePlays: 3,
    costPerPlay: 10,
    costResource: 'gem',
    ...overrides,
  };
}

/** 创建抽奖小游戏定义 */
function makeDrawGame(): MiniGameDef {
  return {
    id: 'lucky_draw',
    name: '幸运抽奖',
    type: 'draw',
    description: '试试手气',
    icon: '🎰',
    dailyFreePlays: 1,
    costPerPlay: 20,
    costResource: 'gem',
  };
}

/** 创建转盘奖品列表 */
function makeWheelPrizes(): WheelPrize[] {
  return [
    { id: 'prize_gold', name: '金币', weight: 50, rewardType: 'resource', rewardId: 'gold', rewardAmount: 100, icon: '🪙' },
    { id: 'prize_gem', name: '宝石', weight: 10, rewardType: 'resource', rewardId: 'gem', rewardAmount: 5, icon: '💎' },
    { id: 'prize_exp', name: '经验', weight: 40, rewardType: 'resource', rewardId: 'exp', rewardAmount: 50, icon: '⭐' },
  ];
}

/** 创建抽奖奖品列表 */
function makeDrawPrizes(): DrawPrize[] {
  return [
    { id: 'draw_common', name: '普通道具', rarity: 'common', weight: 60, rewardType: 'item', rewardId: 'herb', rewardAmount: 1, icon: '🌿' },
    { id: 'draw_rare', name: '稀有装备', rarity: 'rare', weight: 30, rewardType: 'item', rewardId: 'sword', rewardAmount: 1, icon: '⚔️' },
    { id: 'draw_legend', name: '传说之盾', rarity: 'legendary', weight: 10, rewardType: 'item', rewardId: 'shield', rewardAmount: 1, icon: '🛡️' },
  ];
}

/** 创建答题题库 */
function makeQuizQuestions(): QuizQuestion[] {
  return [
    { id: 'q1', question: '1+1=?', options: ['1', '2', '3', '4'], correctIndex: 1, rewardAmount: 10 },
    { id: 'q2', question: '太阳是什么颜色？', options: ['蓝', '绿', '红', '黑'], correctIndex: 2, rewardAmount: 15 },
  ];
}

// ============================================================
// 测试套件
// ============================================================

describe('MiniGameSystem', () => {
  let system: MiniGameSystem;

  beforeEach(() => {
    system = new MiniGameSystem();
    system.register([makeWheelGame(), makeDrawGame()]);
    system.setWheelPrizes('lucky_wheel', makeWheelPrizes());
    system.setDrawPrizes('lucky_draw', makeDrawPrizes());
  });

  // ----------------------------------------------------------
  // 注册小游戏
  // ----------------------------------------------------------
  describe('注册小游戏', () => {
    it('应成功注册小游戏并返回列表', () => {
      expect(system.miniGames).toHaveLength(2);
      expect(system.miniGames.map((g) => g.id)).toContain('lucky_wheel');
      expect(system.miniGames.map((g) => g.id)).toContain('lucky_draw');
    });

    it('重复注册同一 ID 应覆盖', () => {
      system.register([makeWheelGame({ name: '超级转盘' })]);
      const def = system.getDef('lucky_wheel');
      expect(def?.name).toBe('超级转盘');
    });
  });

  // ----------------------------------------------------------
  // 免费次数与付费
  // ----------------------------------------------------------
  describe('免费次数与付费游玩', () => {
    it('初始免费次数应正确', () => {
      expect(system.getRemainingPlays('lucky_wheel')).toBe(3);
      expect(system.getRemainingPlays('lucky_draw')).toBe(1);
    });

    it('免费次数内可直接游玩', () => {
      const result = system.playGame('lucky_wheel');
      expect(result.success).toBe(true);
      expect(result.rewards).toHaveLength(1);
      expect(system.getRemainingPlays('lucky_wheel')).toBe(2);
    });

    it('免费次数用完后需要付费', () => {
      // 消耗 3 次免费
      for (let i = 0; i < 3; i++) system.playGame('lucky_wheel');
      expect(system.getRemainingPlays('lucky_wheel')).toBe(0);

      // 无资源时失败
      const failResult = system.playGame('lucky_wheel');
      expect(failResult.success).toBe(false);
      expect(failResult.message).toBe('资源不足');

      // 有资源时成功
      const successResult = system.playGame(
        'lucky_wheel',
        () => true, // hasResource
        () => {},   // spendResource
      );
      expect(successResult.success).toBe(true);
    });

    it('不存在的游戏应返回失败', () => {
      const result = system.playGame('nonexistent');
      expect(result.success).toBe(false);
      expect(result.message).toBe('游戏不存在');
    });
  });

  // ----------------------------------------------------------
  // 转盘抽奖
  // ----------------------------------------------------------
  describe('转盘抽奖', () => {
    it('应从奖品池中随机返回奖品', () => {
      const result = system.spinWheel('lucky_wheel');
      expect(result.success).toBe(true);
      expect(result.rewards).toHaveLength(1);
      const rewardIds = makeWheelPrizes().map((p) => p.rewardId);
      expect(rewardIds).toContain(result.rewards[0].id);
    });

    it('无奖品时应返回空奖励', () => {
      const fresh = new MiniGameSystem();
      fresh.register([makeWheelGame()]);
      const result = fresh.spinWheel('lucky_wheel');
      expect(result.success).toBe(true);
      expect(result.rewards).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // 幸运抽奖
  // ----------------------------------------------------------
  describe('幸运抽奖', () => {
    it('应从奖池中随机返回奖品', () => {
      const result = system.luckyDraw('lucky_draw');
      expect(result.success).toBe(true);
      expect(result.rewards).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // 答题
  // ----------------------------------------------------------
  describe('答题', () => {
    beforeEach(() => {
      system.setQuizQuestions('lucky_wheel', makeQuizQuestions());
    });

    it('答对应返回奖励', () => {
      const result = system.quiz('lucky_wheel', 'q1', 1);
      expect(result.success).toBe(true);
      expect(result.rewards[0].amount).toBe(10);
    });

    it('答错应返回失败', () => {
      const result = system.quiz('lucky_wheel', 'q1', 0);
      expect(result.success).toBe(false);
    });

    it('不存在的题目应返回失败', () => {
      const result = system.quiz('lucky_wheel', 'q999', 0);
      expect(result.success).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // 每日重置
  // ----------------------------------------------------------
  describe('每日重置', () => {
    it('应重置非今日的游玩次数', () => {
      // 模拟昨天已游玩的状态
      system.playGame('lucky_wheel');
      expect(system.getRemainingPlays('lucky_wheel')).toBe(2);

      // 手动设置 lastPlayDate 为昨天
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      system.loadState({ lucky_wheel: { lastPlayDate: yesterday, playsToday: 2 } });

      // 重置后应恢复免费次数
      system.resetDailyPlays();
      expect(system.getRemainingPlays('lucky_wheel')).toBe(3);
    });

    it('今日已游玩的游戏不应被重置', () => {
      // 两个游戏都游玩一次
      system.playGame('lucky_wheel');
      system.playGame('lucky_draw');
      const resetCount = system.resetDailyPlays();
      // 两个游戏 lastPlayDate === today，都不会重置
      expect(resetCount).toBe(0);
    });

    it('重置时应触发 daily_plays_reset 事件', () => {
      const events: MiniGameEvent[] = [];
      system.onEvent((e) => events.push(e));

      // 设置非今日日期以触发重置
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      system.loadState({ lucky_wheel: { lastPlayDate: yesterday, playsToday: 3 } });
      system.resetDailyPlays();

      const resetEvent = events.find((e) => e.type === 'daily_plays_reset');
      expect(resetEvent).toBeDefined();
    });
  });

  // ----------------------------------------------------------
  // 事件监听
  // ----------------------------------------------------------
  describe('事件监听', () => {
    it('游玩时应触发 game_played 事件', () => {
      const events: MiniGameEvent[] = [];
      system.onEvent((e) => events.push(e));
      system.playGame('lucky_wheel');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('game_played');
    });

    it('offEvent 应移除监听器', () => {
      const events: MiniGameEvent[] = [];
      const listener = (e: MiniGameEvent) => events.push(e);
      system.onEvent(listener);
      system.playGame('lucky_wheel');
      expect(events).toHaveLength(1);

      system.offEvent(listener);
      system.playGame('lucky_wheel');
      expect(events).toHaveLength(1); // 不再增加
    });
  });

  // ----------------------------------------------------------
  // 序列化 / 反序列化
  // ----------------------------------------------------------
  describe('序列化与反序列化', () => {
    it('saveState 应导出完整状态', () => {
      system.playGame('lucky_wheel');
      const saved = system.saveState();

      expect(saved['lucky_wheel']).toBeDefined();
      expect(saved['lucky_wheel'].totalPlays).toBe(1);
    });

    it('loadState 应恢复状态', () => {
      system.playGame('lucky_wheel');
      system.playGame('lucky_draw');
      const saved = system.saveState();

      const fresh = new MiniGameSystem();
      fresh.register([makeWheelGame(), makeDrawGame()]);
      fresh.loadState(saved);

      expect(fresh.saveState()['lucky_wheel'].totalPlays).toBe(1);
      expect(fresh.saveState()['lucky_draw'].totalPlays).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // 重置
  // ----------------------------------------------------------
  describe('系统重置', () => {
    it('reset 应清空所有游玩记录', () => {
      system.playGame('lucky_wheel');
      system.playGame('lucky_draw');
      system.reset();

      const saved = system.saveState();
      expect(saved['lucky_wheel'].totalPlays).toBe(0);
      expect(saved['lucky_wheel'].playsToday).toBe(0);
    });
  });
});
