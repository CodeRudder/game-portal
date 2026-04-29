/**
 * SeasonSystem 单元测试
 *
 * 覆盖：
 * 1. 赛季生命周期（创建→积分→排行→结算→历史）
 * 2. 积分系统
 * 3. 排行榜
 * 4. 赛季结算
 * 5. 存档序列化
 */

import { SeasonSystem } from '../SeasonSystem';

describe('SeasonSystem', () => {
  let system: SeasonSystem;
  const mockDeps = {
    eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
    registry: { get: vi.fn() },
  };

  beforeEach(() => {
    system = new SeasonSystem();
    system.init(mockDeps);
  });

  // ─── ISubsystem ───────────────────────────

  describe('ISubsystem 接口', () => {
    it('name 应为 season', () => {
      expect(system.name).toBe('season');
    });

    it('reset 应清除所有状态', () => {
      system.createSeason('Test');
      system.reset();
      expect(system.getCurrentSeason()).toBeNull();
    });
  });

  // ─── 赛季管理 ─────────────────────────────

  describe('赛季管理', () => {
    it('初始应无赛季', () => {
      expect(system.getCurrentSeason()).toBeNull();
    });

    it('createSeason 应创建新赛季', () => {
      const season = system.createSeason('赛季1');
      expect(season.name).toBe('赛季1');
      expect(season.isActive).toBe(true);
      expect(season.id).toContain('season_');
    });

    it('创建新赛季应自动结算旧赛季', () => {
      system.createSeason('赛季1');
      system.addScore('hero_1', 100);
      const season2 = system.createSeason('赛季2');
      expect(season2.name).toBe('赛季2');
      expect(system.getSettledSeasonCount()).toBe(1);
    });

    it('getRemainingDays 应返回正数', () => {
      system.createSeason('赛季1');
      expect(system.getRemainingDays()).toBeGreaterThan(0);
    });

    it('无赛季时 getRemainingDays 应返回0', () => {
      expect(system.getRemainingDays()).toBe(0);
    });
  });

  // ─── 积分系统 ─────────────────────────────

  describe('积分系统', () => {
    beforeEach(() => {
      system.createSeason('赛季1');
    });

    it('addScore 应增加积分', () => {
      system.addScore('hero_1', 100);
      expect(system.getScore('hero_1')).toBe(100);
    });

    it('重复 addScore 应累加', () => {
      system.addScore('hero_1', 50);
      system.addScore('hero_1', 30);
      expect(system.getScore('hero_1')).toBe(80);
    });

    it('score <= 0 应被忽略', () => {
      system.addScore('hero_1', 0);
      system.addScore('hero_1', -10);
      expect(system.getScore('hero_1')).toBe(0);
    });

    it('setScore 应覆盖积分', () => {
      system.addScore('hero_1', 100);
      system.setScore('hero_1', 50);
      expect(system.getScore('hero_1')).toBe(50);
    });

    it('未添加积分的武将应返回0', () => {
      expect(system.getScore('unknown')).toBe(0);
    });

    it('无赛季时 addScore 应抛错', () => {
      system.reset();
      expect(() => system.addScore('hero_1', 10)).toThrow();
    });
  });

  // ─── 排行榜 ───────────────────────────────

  describe('排行榜', () => {
    beforeEach(() => {
      system.createSeason('赛季1');
      system.addScore('hero_1', 100);
      system.addScore('hero_2', 200);
      system.addScore('hero_3', 150);
    });

    it('应按积分降序排列', () => {
      const lb = system.getLeaderboard();
      expect(lb[0].heroId).toBe('hero_2');
      expect(lb[1].heroId).toBe('hero_3');
      expect(lb[2].heroId).toBe('hero_1');
    });

    it('应包含排名和奖励', () => {
      const lb = system.getLeaderboard();
      expect(lb[0].rank).toBe(1);
      expect(lb[0].rewards).toBeDefined();
    });

    it('getHeroRank 应返回正确排名', () => {
      expect(system.getHeroRank('hero_2')).toBe(1);
      expect(system.getHeroRank('hero_1')).toBe(3);
    });

    it('未上榜应返回 -1', () => {
      expect(system.getHeroRank('unknown')).toBe(-1);
    });

    it('应支持 limit 参数', () => {
      const lb = system.getLeaderboard(2);
      expect(lb.length).toBe(2);
    });
  });

  // ─── 赛季结算 ─────────────────────────────

  describe('赛季结算', () => {
    it('应结算并归档', () => {
      system.createSeason('赛季1');
      system.addScore('hero_1', 100);
      const rankings = system.settleSeason();
      expect(rankings.length).toBe(1);
      expect(system.getCurrentSeason()).toBeNull();
      expect(system.getSeasonHistory().length).toBe(1);
    });

    it('无赛季时结算应抛错', () => {
      expect(() => system.settleSeason()).toThrow();
    });

    it('isSeasonSettled 应正确判断', () => {
      const season = system.createSeason('赛季1');
      expect(system.isSeasonSettled(season.id)).toBe(false);
      system.settleSeason();
      expect(system.isSeasonSettled(season.id)).toBe(true);
    });
  });

  // ─── 存档 ─────────────────────────────────

  describe('存档', () => {
    it('应正确序列化和反序列化', () => {
      system.createSeason('赛季1');
      system.addScore('hero_1', 100);
      const data = system.getSaveData();

      const system2 = new SeasonSystem();
      system2.init(mockDeps);
      system2.loadSaveData(data);
      expect(system2.getScore('hero_1')).toBe(100);
    });

    it('版本不匹配应忽略', () => {
      const system2 = new SeasonSystem();
      system2.loadSaveData({ version: 999, state: { currentSeason: null, scores: [], history: [], settledSeasonIds: [] } });
      expect(system2.getCurrentSeason()).toBeNull();
    });
  });
});
