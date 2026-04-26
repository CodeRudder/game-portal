/**
 * SeasonSystem 单元测试
 * 覆盖：赛季创建、倒计时、积分、排行榜、结算、奖励、历史、序列化、ISubsystem 接口
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SeasonSystem } from '../SeasonSystem';
import type { SeasonInfo, SeasonRanking, SeasonSaveData } from '../SeasonSystem';
import {
  DEFAULT_SEASON_DURATION_DAYS,
  SEASON_SAVE_VERSION,
  SEASON_REWARD_TIERS,
  getRewardsForRank,
} from '../season-config';
import type { ISystemDeps } from '../../../../core/types';

// ─────────────────────────────────────────────
// 测试工具
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

/** 快进时间（ms） */
function advanceTime(ms: number): void {
  vi.advanceTimersByTime(ms);
}

// ─────────────────────────────────────────────
// 测试主体
// ─────────────────────────────────────────────

describe('SeasonSystem', () => {
  let sys: SeasonSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2025-01-01T00:00:00Z') });
    sys = new SeasonSystem();
    deps = mockDeps();
    sys.init(deps);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════
  // 1. 初始化 & ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('初始化', () => {
    it('name 属性为 "season"', () => {
      expect(sys.name).toBe('season');
    });

    it('初始无当前赛季', () => {
      expect(sys.getCurrentSeason()).toBeNull();
    });

    it('初始排行榜为空', () => {
      expect(sys.getLeaderboard()).toEqual([]);
    });

    it('初始赛季历史为空', () => {
      expect(sys.getSeasonHistory()).toEqual([]);
    });

    it('初始剩余天数为 0', () => {
      expect(sys.getRemainingDays()).toBe(0);
    });

    it('update() 不抛错', () => {
      expect(() => sys.update(1)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 赛季创建
  // ═══════════════════════════════════════════
  describe('赛季创建', () => {
    it('创建赛季返回 SeasonInfo', () => {
      const season = sys.createSeason('S1 赛季');
      expect(season).toBeDefined();
      expect(season.name).toBe('S1 赛季');
      expect(season.isActive).toBe(true);
      expect(season.durationDays).toBe(DEFAULT_SEASON_DURATION_DAYS);
    });

    it('创建赛季后 getCurrentSeason 不为 null', () => {
      sys.createSeason('S1');
      expect(sys.getCurrentSeason()).not.toBeNull();
      expect(sys.getCurrentSeason()!.name).toBe('S1');
    });

    it('自定义持续天数', () => {
      const season = sys.createSeason('短赛季', 7);
      expect(season.durationDays).toBe(7);
    });

    it('创建赛季触发 season:created 事件', () => {
      sys.createSeason('S1');
      expect(deps.eventBus.emit).toHaveBeenCalledWith('season:created', expect.objectContaining({
        name: 'S1',
        durationDays: DEFAULT_SEASON_DURATION_DAYS,
      }));
    });

    it('创建新赛季时自动结算旧赛季', () => {
      sys.createSeason('S1');
      sys.addScore('hero1', 100);
      sys.createSeason('S2');
      // S1 已结算归档到历史
      expect(sys.getSeasonHistory()).toHaveLength(1);
      expect(sys.getSeasonHistory()[0].name).toBe('S1');
    });
  });

  // ═══════════════════════════════════════════
  // 3. 赛季倒计时
  // ═══════════════════════════════════════════
  describe('赛季倒计时', () => {
    it('新赛季剩余天数接近 30', () => {
      sys.createSeason('S1');
      expect(sys.getRemainingDays()).toBe(30);
    });

    it('经过1天后剩余天数为 29', () => {
      sys.createSeason('S1');
      advanceTime(1 * 24 * 60 * 60 * 1000);
      expect(sys.getRemainingDays()).toBe(29);
    });

    it('赛季过期后剩余天数为 0', () => {
      sys.createSeason('S1');
      advanceTime(31 * 24 * 60 * 60 * 1000);
      expect(sys.getRemainingDays()).toBe(0);
    });

    it('无赛季时剩余天数为 0', () => {
      expect(sys.getRemainingDays()).toBe(0);
    });

    it('getElapsedDays 返回已过天数', () => {
      sys.createSeason('S1');
      advanceTime(5 * 24 * 60 * 60 * 1000);
      expect(sys.getElapsedDays()).toBe(5);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 积分系统
  // ═══════════════════════════════════════════
  describe('积分系统', () => {
    beforeEach(() => {
      sys.createSeason('S1');
    });

    it('addScore 添加积分', () => {
      sys.addScore('hero1', 100);
      expect(sys.getScore('hero1')).toBe(100);
    });

    it('addScore 累加积分', () => {
      sys.addScore('hero1', 50);
      sys.addScore('hero1', 30);
      expect(sys.getScore('hero1')).toBe(80);
    });

    it('addScore 忽略非正数', () => {
      sys.addScore('hero1', 100);
      sys.addScore('hero1', 0);
      sys.addScore('hero1', -10);
      expect(sys.getScore('hero1')).toBe(100);
    });

    it('无活跃赛季时 addScore 抛错', () => {
      sys.reset();
      expect(() => sys.addScore('hero1', 100)).toThrow('当前没有活跃赛季');
    });

    it('setScore 覆盖积分', () => {
      sys.addScore('hero1', 100);
      sys.setScore('hero1', 200);
      expect(sys.getScore('hero1')).toBe(200);
    });

    it('getScore 未记录武将返回 0', () => {
      expect(sys.getScore('unknown')).toBe(0);
    });

    it('过期赛季 addScore 抛错', () => {
      advanceTime(31 * 24 * 60 * 60 * 1000);
      expect(() => sys.addScore('hero1', 100)).toThrow('当前赛季已过期');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 排行榜排序
  // ═══════════════════════════════════════════
  describe('排行榜', () => {
    beforeEach(() => {
      sys.createSeason('S1');
      sys.addScore('hero3', 50);
      sys.addScore('hero1', 200);
      sys.addScore('hero2', 100);
    });

    it('排行榜按积分降序排列', () => {
      const lb = sys.getLeaderboard();
      expect(lb[0].heroId).toBe('hero1');
      expect(lb[1].heroId).toBe('hero2');
      expect(lb[2].heroId).toBe('hero3');
    });

    it('排行榜包含正确排名', () => {
      const lb = sys.getLeaderboard();
      expect(lb[0].rank).toBe(1);
      expect(lb[1].rank).toBe(2);
      expect(lb[2].rank).toBe(3);
    });

    it('排行榜包含奖励', () => {
      const lb = sys.getLeaderboard();
      expect(lb[0].rewards).toBeDefined();
      expect(lb[0].rewards.length).toBeGreaterThan(0);
    });

    it('getLeaderboard 限制返回条数', () => {
      sys.addScore('hero4', 25);
      const lb = sys.getLeaderboard(2);
      expect(lb).toHaveLength(2);
    });

    it('getHeroRank 返回正确排名', () => {
      expect(sys.getHeroRank('hero1')).toBe(1);
      expect(sys.getHeroRank('hero2')).toBe(2);
      expect(sys.getHeroRank('hero3')).toBe(3);
    });

    it('getHeroRank 未上榜返回 -1', () => {
      expect(sys.getHeroRank('unknown')).toBe(-1);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 赛季结算
  // ═══════════════════════════════════════════
  describe('赛季结算', () => {
    it('结算返回排行榜', () => {
      sys.createSeason('S1');
      sys.addScore('hero1', 300);
      sys.addScore('hero2', 200);
      const rankings = sys.settleSeason();
      expect(rankings).toHaveLength(2);
      expect(rankings[0].heroId).toBe('hero1');
      expect(rankings[0].rank).toBe(1);
    });

    it('结算后当前赛季为 null', () => {
      sys.createSeason('S1');
      sys.settleSeason();
      expect(sys.getCurrentSeason()).toBeNull();
    });

    it('结算后积分清零', () => {
      sys.createSeason('S1');
      sys.addScore('hero1', 100);
      sys.settleSeason();
      sys.createSeason('S2');
      expect(sys.getScore('hero1')).toBe(0);
    });

    it('结算触发 season:settled 事件', () => {
      sys.createSeason('S1');
      sys.addScore('hero1', 100);
      sys.settleSeason();
      expect(deps.eventBus.emit).toHaveBeenCalledWith('season:settled', expect.objectContaining({
        participantCount: 1,
      }));
    });

    it('无赛季时结算抛错', () => {
      expect(() => sys.settleSeason()).toThrow('没有可结算的赛季');
    });

    it('结算后排行榜为空', () => {
      sys.createSeason('S1');
      sys.addScore('hero1', 100);
      sys.settleSeason();
      expect(sys.getLeaderboard()).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 奖励发放
  // ═══════════════════════════════════════════
  describe('奖励发放', () => {
    it('第1名奖励：5000铜钱+50招贤令+10突破石', () => {
      const rewards = sys.getSeasonRewards(1);
      expect(rewards).toEqual([
        { resource: 'copper', amount: 5000 },
        { resource: 'recruitToken', amount: 50 },
        { resource: 'breakthroughStone', amount: 10 },
      ]);
    });

    it('第2名奖励：3000铜钱+30招贤令+5突破石', () => {
      const rewards = sys.getSeasonRewards(2);
      expect(rewards).toEqual([
        { resource: 'copper', amount: 3000 },
        { resource: 'recruitToken', amount: 30 },
        { resource: 'breakthroughStone', amount: 5 },
      ]);
    });

    it('第4名奖励：2000铜钱+20招贤令+3突破石', () => {
      const rewards = sys.getSeasonRewards(4);
      expect(rewards).toEqual([
        { resource: 'copper', amount: 2000 },
        { resource: 'recruitToken', amount: 20 },
        { resource: 'breakthroughStone', amount: 3 },
      ]);
    });

    it('第20名奖励：1000铜钱+10招贤令+1突破石', () => {
      const rewards = sys.getSeasonRewards(20);
      expect(rewards).toEqual([
        { resource: 'copper', amount: 1000 },
        { resource: 'recruitToken', amount: 10 },
        { resource: 'breakthroughStone', amount: 1 },
      ]);
    });

    it('第100名参与奖：500铜钱+5招贤令', () => {
      const rewards = sys.getSeasonRewards(100);
      expect(rewards).toEqual([
        { resource: 'copper', amount: 500 },
        { resource: 'recruitToken', amount: 5 },
      ]);
    });

    it('结算时排行榜包含正确奖励', () => {
      sys.createSeason('S1');
      sys.addScore('hero1', 100);
      const [ranking] = sys.settleSeason();
      expect(ranking.rewards).toEqual([
        { resource: 'copper', amount: 5000 },
        { resource: 'recruitToken', amount: 50 },
        { resource: 'breakthroughStone', amount: 10 },
      ]);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 赛季历史
  // ═══════════════════════════════════════════
  describe('赛季历史', () => {
    it('结算后历史记录增加', () => {
      sys.createSeason('S1');
      sys.settleSeason();
      expect(sys.getSeasonHistory()).toHaveLength(1);
    });

    it('多个赛季历史按时间升序', () => {
      sys.createSeason('S1');
      sys.settleSeason();
      sys.createSeason('S2');
      sys.settleSeason();
      const history = sys.getSeasonHistory();
      expect(history).toHaveLength(2);
      expect(history[0].name).toBe('S1');
      expect(history[1].name).toBe('S2');
    });

    it('getSettledSeasonCount 正确计数', () => {
      sys.createSeason('S1');
      sys.settleSeason();
      sys.createSeason('S2');
      sys.settleSeason();
      expect(sys.getSettledSeasonCount()).toBe(2);
    });

    it('isSeasonSettled 正确判断', () => {
      sys.createSeason('S1');
      const seasonId = sys.getCurrentSeason()!.id;
      sys.settleSeason();
      expect(sys.isSeasonSettled(seasonId)).toBe(true);
      expect(sys.isSeasonSettled('nonexistent')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 序列化 / 反序列化
  // ═══════════════════════════════════════════
  describe('序列化 / 反序列化', () => {
    it('serialize 返回有效存档数据', () => {
      sys.createSeason('S1');
      sys.addScore('hero1', 100);
      const data = sys.serialize();
      expect(data.version).toBe(SEASON_SAVE_VERSION);
      expect(data.state.currentSeason).not.toBeNull();
      expect(data.state.scores).toHaveLength(1);
    });

    it('getSaveData 与 serialize 返回相同数据', () => {
      sys.createSeason('S1');
      expect(sys.serialize()).toEqual(sys.getSaveData());
    });

    it('loadSaveData 恢复赛季状态', () => {
      sys.createSeason('S1');
      sys.addScore('hero1', 100);
      sys.addScore('hero2', 200);
      const saved = sys.getSaveData();

      const sys2 = new SeasonSystem();
      sys2.init(deps);
      sys2.loadSaveData(saved);
      expect(sys2.getScore('hero1')).toBe(100);
      expect(sys2.getScore('hero2')).toBe(200);
      expect(sys2.getCurrentSeason()!.name).toBe('S1');
    });

    it('loadSaveData 恢复历史记录', () => {
      sys.createSeason('S1');
      sys.settleSeason();
      sys.createSeason('S2');
      const saved = sys.getSaveData();

      const sys2 = new SeasonSystem();
      sys2.init(deps);
      sys2.loadSaveData(saved);
      expect(sys2.getSeasonHistory()).toHaveLength(1);
      expect(sys2.getSeasonHistory()[0].name).toBe('S1');
    });

    it('loadSaveData 忽略版本不匹配', () => {
      const badData: SeasonSaveData = { version: 999, state: { currentSeason: null, scores: [], history: [], settledSeasonIds: [] } };
      sys.loadSaveData(badData);
      // 不应崩溃，状态不变
      expect(sys.getCurrentSeason()).toBeNull();
    });

    it('序列化-反序列化往返一致', () => {
      sys.createSeason('S1');
      sys.addScore('hero1', 500);
      sys.addScore('hero2', 300);
      sys.addScore('hero3', 100);
      const json = JSON.stringify(sys.getSaveData());

      const sys2 = new SeasonSystem();
      sys2.init(deps);
      sys2.loadSaveData(JSON.parse(json));
      expect(sys2.getScore('hero1')).toBe(500);
      expect(sys2.getHeroRank('hero1')).toBe(1);
      expect(sys2.getHeroRank('hero2')).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // 10. reset
  // ═══════════════════════════════════════════
  describe('reset', () => {
    it('reset 清除所有状态', () => {
      sys.createSeason('S1');
      sys.addScore('hero1', 100);
      sys.settleSeason();
      sys.reset();
      expect(sys.getCurrentSeason()).toBeNull();
      expect(sys.getLeaderboard()).toEqual([]);
      expect(sys.getSeasonHistory()).toEqual([]);
      expect(sys.getRemainingDays()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 11. season-config 工具函数
  // ═══════════════════════════════════════════
  describe('season-config', () => {
    it('DEFAULT_SEASON_DURATION_DAYS 为 30', () => {
      expect(DEFAULT_SEASON_DURATION_DAYS).toBe(30);
    });

    it('SEASON_REWARD_TIERS 有 5 个阶梯', () => {
      expect(SEASON_REWARD_TIERS).toHaveLength(5);
    });

    it('getRewardsForRank fallback 返回参与奖', () => {
      // rank 0 不在正常范围，应返回参与奖
      const rewards = getRewardsForRank(0);
      expect(rewards).toEqual(SEASON_REWARD_TIERS[4].rewards);
    });
  });

  // ═══════════════════════════════════════════
  // 12. getState (ISubsystem)
  // ═══════════════════════════════════════════
  describe('getState', () => {
    it('返回可序列化的状态快照', () => {
      sys.createSeason('S1');
      const state = sys.getState() as ReturnType<SeasonSystem['getState']>;
      expect(state.currentSeason).not.toBeNull();
      expect(state.scores).toEqual([]);
      expect(state.history).toEqual([]);
      expect(state.settledSeasonIds).toEqual([]);
    });
  });
});
