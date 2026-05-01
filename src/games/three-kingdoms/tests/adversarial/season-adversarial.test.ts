/**
 * 赛季系统对抗式测试
 *
 * 覆盖子系统：
 *   S1: SeasonSystem（赛季生命周期/积分/排行榜/结算/历史/序列化）
 *   S2: season-config（奖励阶梯/常量）
 *
 * 5维度：F-Normal / F-Error / F-Boundary / F-Cross / F-Lifecycle
 * @module tests/adversarial/season-adversarial
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SeasonSystem } from '../../engine/season/SeasonSystem';
import type { SeasonSaveData } from '../../engine/season/SeasonSystem';
import {
  DEFAULT_SEASON_DURATION_DAYS,
  SEASON_SAVE_VERSION,
  SEASON_REWARD_TIERS,
  getRewardsForRank,
} from '../../engine/season/season-config';
import type { ISystemDeps } from '../../core/types';

const mockDeps = (): ISystemDeps => {
  const ls = new Map<string, Function[]>();
  return {
    eventBus: {
      on: vi.fn((e: string, h: Function) => { (ls.has(e) ? ls : ls.set(e, [])).get(e)!.push(h); return vi.fn(); }),
      once: vi.fn((e: string, h: Function) => { (ls.has(e) ? ls : ls.set(e, [])).get(e)!.push(h); return vi.fn(); }),
      emit: vi.fn((e: string, p?: unknown) => { ls.get(e)?.forEach(h => h(p)); }),
      off: vi.fn(), removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
};

const createSeason = (): { sys: SeasonSystem; deps: ISystemDeps } => {
  const deps = mockDeps();
  const sys = new SeasonSystem();
  sys.init(deps);
  return { sys, deps };
};

const DAY_MS = 24 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════
// F-Normal: 正常流程
// ═══════════════════════════════════════════════

describe('赛季对抗测试 — F-Normal', () => {

  describe('赛季初始化', () => {
    it('新建实例无活跃赛季', () => {
      const { sys } = createSeason();
      expect(sys.getCurrentSeason()).toBeNull();
      expect(sys.getScore('any')).toBe(0);
      expect(sys.getHeroRank('any')).toBe(-1);
    });

    it('ISubsystem 接口完整', () => {
      const { sys } = createSeason();
      expect(sys.name).toBe('season');
      expect(() => sys.update(16)).not.toThrow();
    });

    it('getState 返回初始空状态', () => {
      const { sys } = createSeason();
      const s = sys.getState();
      expect(s).toMatchObject({ currentSeason: null, scores: [], history: [], settledSeasonIds: [] });
    });
  });

  describe('赛季创建', () => {
    it('createSeason 返回完整赛季信息', () => {
      const { sys } = createSeason();
      const season = sys.createSeason('赛季1');
      expect(season.name).toBe('赛季1');
      expect(season.isActive).toBe(true);
      expect(season.id).toContain('season_');
      expect(season.durationDays).toBe(DEFAULT_SEASON_DURATION_DAYS);
      expect(season.endTime - season.startTime).toBe(DEFAULT_SEASON_DURATION_DAYS * DAY_MS);
    });

    it('createSeason 自定义天数', () => {
      const { sys } = createSeason();
      expect(sys.createSeason('短赛季', 7).durationDays).toBe(7);
    });

    it('createSeason 发出 season:created 事件', () => {
      const { sys, deps } = createSeason();
      sys.createSeason('赛季1');
      expect(deps.eventBus!.emit).toHaveBeenCalledWith('season:created',
        expect.objectContaining({ name: '赛季1', durationDays: DEFAULT_SEASON_DURATION_DAYS }));
    });

    it('getCurrentSeason 返回已创建赛季', () => {
      const { sys } = createSeason();
      sys.createSeason('赛季1');
      expect(sys.getCurrentSeason()).not.toBeNull();
      expect(sys.getCurrentSeason()!.name).toBe('赛季1');
    });
  });

  describe('赛季积分', () => {
    it('addScore 为新武将添加积分', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('hero_1', 100);
      expect(sys.getScore('hero_1')).toBe(100);
    });

    it('addScore 累加已有武将积分', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('hero_1', 100);
      sys.addScore('hero_1', 50);
      expect(sys.getScore('hero_1')).toBe(150);
    });

    it('setScore 覆盖已有积分', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('hero_1', 100);
      sys.setScore('hero_1', 200);
      expect(sys.getScore('hero_1')).toBe(200);
    });

    it('setScore 为新武将设置积分', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.setScore('hero_new', 500);
      expect(sys.getScore('hero_new')).toBe(500);
    });

    it('多武将积分独立', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 100);
      sys.addScore('h2', 200);
      sys.addScore('h3', 300);
      expect(sys.getScore('h1')).toBe(100);
      expect(sys.getScore('h2')).toBe(200);
      expect(sys.getScore('h3')).toBe(300);
    });
  });

  describe('赛季排行榜', () => {
    it('getLeaderboard 按积分降序', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h_low', 100);
      sys.addScore('h_mid', 500);
      sys.addScore('h_high', 1000);
      const lb = sys.getLeaderboard();
      expect(lb.map(e => e.heroId)).toEqual(['h_high', 'h_mid', 'h_low']);
    });

    it('排行榜包含正确排名和奖励', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 1000);
      const lb = sys.getLeaderboard();
      expect(lb[0].rank).toBe(1);
      expect(lb[0].rewards.length).toBeGreaterThan(0);
    });

    it('getHeroRank 返回正确排名', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 100);
      sys.addScore('h2', 300);
      sys.addScore('h3', 200);
      expect(sys.getHeroRank('h2')).toBe(1);
      expect(sys.getHeroRank('h3')).toBe(2);
      expect(sys.getHeroRank('h1')).toBe(3);
    });

    it('getLeaderboard 限制返回条数', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      for (let i = 0; i < 100; i++) sys.addScore(`h_${i}`, i + 1);
      expect(sys.getLeaderboard(10).length).toBe(10);
    });
  });

  describe('赛季结算', () => {
    it('settleSeason 返回最终排名', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 100);
      sys.addScore('h2', 300);
      const rankings = sys.settleSeason();
      expect(rankings.length).toBe(2);
      expect(rankings[0].heroId).toBe('h2');
      expect(rankings[0].rank).toBe(1);
    });

    it('settleSeason 发出 season:settled 事件', () => {
      const { sys, deps } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 100);
      sys.settleSeason();
      expect(deps.eventBus!.emit).toHaveBeenCalledWith('season:settled',
        expect.objectContaining({ participantCount: 1 }));
    });

    it('结算后当前赛季清空', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.settleSeason();
      expect(sys.getCurrentSeason()).toBeNull();
    });

    it('结算后积分清零', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 100);
      sys.settleSeason();
      expect(sys.getScore('h1')).toBe(0);
    });
  });

  describe('赛季历史', () => {
    it('getSeasonHistory 返回已结算赛季', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.settleSeason();
      sys.createSeason('S2');
      sys.settleSeason();
      const history = sys.getSeasonHistory();
      expect(history.length).toBe(2);
      expect(history.map(h => h.name)).toEqual(['S1', 'S2']);
    });

    it('getSettledSeasonCount 正确计数', () => {
      const { sys } = createSeason();
      expect(sys.getSettledSeasonCount()).toBe(0);
      sys.createSeason('S1');
      sys.settleSeason();
      expect(sys.getSettledSeasonCount()).toBe(1);
    });

    it('isSeasonSettled 正确判断', () => {
      const { sys } = createSeason();
      const s = sys.createSeason('S1');
      expect(sys.isSeasonSettled(s.id)).toBe(false);
      sys.settleSeason();
      expect(sys.isSeasonSettled(s.id)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Error: 错误路径
// ═══════════════════════════════════════════════

describe('赛季对抗测试 — F-Error', () => {

  describe('无活跃赛季操作', () => {
    it('addScore 无赛季抛错', () => {
      const { sys } = createSeason();
      expect(() => sys.addScore('h1', 100)).toThrow('当前没有活跃赛季');
    });

    it('setScore 无赛季抛错', () => {
      const { sys } = createSeason();
      expect(() => sys.setScore('h1', 100)).toThrow('当前没有活跃赛季');
    });

    it('settleSeason 无赛季抛错', () => {
      const { sys } = createSeason();
      expect(() => sys.settleSeason()).toThrow('没有可结算的赛季');
    });
  });

  describe('无效积分输入', () => {
    it('addScore NaN 静默忽略', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', NaN);
      expect(sys.getScore('h1')).toBe(0);
    });

    it('addScore Infinity 静默忽略', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', Infinity);
      expect(sys.getScore('h1')).toBe(0);
    });

    it('addScore 负数静默忽略', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', -50);
      expect(sys.getScore('h1')).toBe(0);
    });

    it('addScore 零静默忽略', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 0);
      expect(sys.getScore('h1')).toBe(0);
    });

    it('setScore NaN 静默忽略', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.setScore('h1', NaN);
      expect(sys.getScore('h1')).toBe(0);
    });

    it('setScore Infinity 静默忽略', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.setScore('h1', Infinity);
      expect(sys.getScore('h1')).toBe(0);
    });

    it('setScore 负数不覆盖原值', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 100);
      sys.setScore('h1', -10);
      expect(sys.getScore('h1')).toBe(100);
    });
  });

  describe('赛季过期后操作', () => {
    it('过期赛季 addScore 抛错', () => {
      const { sys } = createSeason();
      sys.createSeason('S1', 1);
      vi.useFakeTimers();
      vi.advanceTimersByTime(2 * DAY_MS);
      expect(() => sys.addScore('h1', 100)).toThrow('当前赛季已过期');
      vi.useRealTimers();
    });

    it('过期赛季 setScore 抛错', () => {
      const { sys } = createSeason();
      sys.createSeason('S1', 1);
      vi.useFakeTimers();
      vi.advanceTimersByTime(2 * DAY_MS);
      expect(() => sys.setScore('h1', 100)).toThrow('当前赛季已过期');
      vi.useRealTimers();
    });
  });
});

// ═══════════════════════════════════════════════
// F-Boundary: 边界条件
// ═══════════════════════════════════════════════

describe('赛季对抗测试 — F-Boundary', () => {

  describe('NaN / Infinity / 极端值', () => {
    it('createSeason NaN天数回退到默认值', () => {
      const { sys } = createSeason();
      expect(sys.createSeason('NaN赛季', NaN).durationDays).toBe(DEFAULT_SEASON_DURATION_DAYS);
    });

    it('createSeason Infinity天数回退到默认值', () => {
      const { sys } = createSeason();
      expect(sys.createSeason('Inf赛季', Infinity).durationDays).toBe(DEFAULT_SEASON_DURATION_DAYS);
    });

    it('createSeason 负数天数回退到默认值', () => {
      const { sys } = createSeason();
      expect(sys.createSeason('负赛季', -10).durationDays).toBe(DEFAULT_SEASON_DURATION_DAYS);
    });

    it('createSeason 零天回退到默认值', () => {
      const { sys } = createSeason();
      expect(sys.createSeason('零赛季', 0).durationDays).toBe(DEFAULT_SEASON_DURATION_DAYS);
    });
  });

  describe('空ID / 特殊字符', () => {
    it('addScore 空字符串 heroId 正常工作', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('', 100);
      expect(sys.getScore('')).toBe(100);
    });

    it('getHeroRank 未上榜返回 -1', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      expect(sys.getHeroRank('nonexistent')).toBe(-1);
    });

    it('getScore 不存在的武将返回 0', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      expect(sys.getScore('ghost')).toBe(0);
    });
  });

  describe('排行榜边界', () => {
    it('无积分时 getLeaderboard 返回空数组', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      expect(sys.getLeaderboard()).toEqual([]);
    });

    it('getLeaderboard limit=0 返回空数组', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 100);
      expect(sys.getLeaderboard(0)).toEqual([]);
    });

    it('getLeaderboard 负数 limit 返回空数组', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 100);
      expect(sys.getLeaderboard(-5)).toEqual([]);
    });

    it('getLeaderboard Infinity 返回全部', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      for (let i = 0; i < 200; i++) sys.addScore(`h_${i}`, i + 1);
      expect(sys.getLeaderboard(Infinity).length).toBe(200);
    });

    it('同积分武将排名稳定不抛错', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 100);
      sys.addScore('h2', 100);
      sys.addScore('h3', 100);
      const lb = sys.getLeaderboard();
      expect(lb.length).toBe(3);
      lb.forEach(entry => expect(entry.score).toBe(100));
    });
  });

  describe('奖励阶梯边界', () => {
    it('第1名奖励正确', () => {
      expect(getRewardsForRank(1)).toEqual(SEASON_REWARD_TIERS[0].rewards);
    });

    it('第2-3名奖励正确', () => {
      expect(getRewardsForRank(2)).toEqual(SEASON_REWARD_TIERS[1].rewards);
      expect(getRewardsForRank(3)).toEqual(SEASON_REWARD_TIERS[1].rewards);
    });

    it('第4-10名奖励正确', () => {
      expect(getRewardsForRank(10)).toEqual(SEASON_REWARD_TIERS[2].rewards);
    });

    it('第11-50名奖励正确', () => {
      expect(getRewardsForRank(11)).toEqual(SEASON_REWARD_TIERS[3].rewards);
    });

    it('第51名获得参与奖', () => {
      expect(getRewardsForRank(51)).toEqual(SEASON_REWARD_TIERS[4].rewards);
    });

    it('第999名获得参与奖 fallback', () => {
      expect(getRewardsForRank(999).length).toBeGreaterThan(0);
    });

    it('getSeasonRewards 调用正确', () => {
      const { sys } = createSeason();
      expect(sys.getSeasonRewards(1).length).toBe(3);
    });
  });

  describe('时间边界', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('getRemainingDays 无赛季返回 0', () => {
      const { sys } = createSeason();
      expect(sys.getRemainingDays()).toBe(0);
    });

    it('getElapsedDays 无赛季返回 0', () => {
      const { sys } = createSeason();
      expect(sys.getElapsedDays()).toBe(0);
    });

    it('赛季刚好到期 isActive 变为 false', () => {
      const { sys } = createSeason();
      sys.createSeason('S1', 1);
      vi.advanceTimersByTime(DAY_MS);
      expect(sys.getCurrentSeason()!.isActive).toBe(false);
    });

    it('赛季未到期 isActive 为 true', () => {
      const { sys } = createSeason();
      sys.createSeason('S1', 30);
      vi.advanceTimersByTime(10 * DAY_MS);
      expect(sys.getCurrentSeason()!.isActive).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Cross: 跨系统联动
// ═══════════════════════════════════════════════

describe('赛季对抗测试 — F-Cross', () => {

  describe('赛季自动结算联动', () => {
    it('创建新赛季自动结算旧赛季', () => {
      const { sys, deps } = createSeason();
      const s1 = sys.createSeason('S1');
      sys.addScore('h1', 100);
      sys.addScore('h2', 200);
      const s2 = sys.createSeason('S2');

      expect(sys.isSeasonSettled(s1.id)).toBe(true);
      expect(sys.getSettledSeasonCount()).toBe(1);
      expect(sys.getSeasonHistory().length).toBe(1);
      expect(sys.getScore('h1')).toBe(0);
      expect(sys.getScore('h2')).toBe(0);
      expect(deps.eventBus!.emit).toHaveBeenCalledWith('season:settled', expect.anything());
      expect(deps.eventBus!.emit).toHaveBeenCalledWith('season:created', expect.anything());
    });

    it('连续创建3个赛季，历史完整', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 100);
      sys.createSeason('S2');
      sys.addScore('h2', 200);
      sys.createSeason('S3');
      const history = sys.getSeasonHistory();
      expect(history.length).toBe(2);
      expect(history.map(h => h.name)).toEqual(['S1', 'S2']);
      expect(sys.getCurrentSeason()!.name).toBe('S3');
    });
  });

  describe('事件总线联动', () => {
    it('season:created 事件携带正确数据', () => {
      const { sys, deps } = createSeason();
      sys.createSeason('测试赛季', 15);
      expect(deps.eventBus!.emit).toHaveBeenCalledWith('season:created',
        expect.objectContaining({ name: '测试赛季', durationDays: 15 }));
    });

    it('season:settled 事件携带 topRank', () => {
      const { sys, deps } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 500);
      sys.settleSeason();
      expect(deps.eventBus!.emit).toHaveBeenCalledWith('season:settled', expect.objectContaining({
        participantCount: 1,
        topRank: expect.objectContaining({ heroId: 'h1', rank: 1 }),
      }));
    });

    it('无参赛者结算时 topRank 为 null', () => {
      const { sys, deps } = createSeason();
      sys.createSeason('S1');
      sys.settleSeason();
      expect(deps.eventBus!.emit).toHaveBeenCalledWith('season:settled', expect.objectContaining({
        participantCount: 0, topRank: null,
      }));
    });
  });

  describe('赛季与排行榜联动', () => {
    it('结算排行榜奖励与 getSeasonRewards 一致', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 1000);
      sys.addScore('h2', 500);
      sys.addScore('h3', 100);
      const rankings = sys.settleSeason();
      expect(rankings[0].rewards).toEqual(sys.getSeasonRewards(1));
      expect(rankings[1].rewards).toEqual(sys.getSeasonRewards(2));
      expect(rankings[2].rewards).toEqual(sys.getSeasonRewards(3));
    });
  });

  describe('赛季与积分系统联动', () => {
    it('结算后再次 addScore 需要新赛季', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 100);
      sys.settleSeason();
      expect(() => sys.addScore('h1', 50)).toThrow('当前没有活跃赛季');
      sys.createSeason('S2');
      expect(() => sys.addScore('h1', 50)).not.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════
// F-Lifecycle: 序列化 / 重置 / 生命周期
// ═══════════════════════════════════════════════

describe('赛季对抗测试 — F-Lifecycle', () => {

  describe('序列化 getSaveData / loadSaveData', () => {
    it('空系统序列化后恢复一致', () => {
      const { sys } = createSeason();
      const data = sys.getSaveData();
      expect(data.version).toBe(SEASON_SAVE_VERSION);
      expect(data.state).toMatchObject({ currentSeason: null, scores: [], history: [] });
    });

    it('有赛季有积分时序列化完整', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 100);
      sys.addScore('h2', 300);
      const data = sys.getSaveData();
      expect(data.state.currentSeason!.name).toBe('S1');
      expect(data.state.scores.length).toBe(2);
    });

    it('loadSaveData 恢复赛季状态', () => {
      const { sys: sys1 } = createSeason();
      sys1.createSeason('S1');
      sys1.addScore('h1', 500);
      sys1.addScore('h2', 200);
      const data = sys1.getSaveData();
      const { sys: sys2 } = createSeason();
      sys2.loadSaveData(data);
      expect(sys2.getCurrentSeason()!.name).toBe('S1');
      expect(sys2.getScore('h1')).toBe(500);
      expect(sys2.getScore('h2')).toBe(200);
    });

    it('loadSaveData 恢复历史和已结算ID', () => {
      const { sys: sys1 } = createSeason();
      const s1 = sys1.createSeason('S1');
      sys1.addScore('h1', 100);
      sys1.settleSeason();
      const data = sys1.getSaveData();
      const { sys: sys2 } = createSeason();
      sys2.loadSaveData(data);
      expect(sys2.getSeasonHistory().length).toBe(1);
      expect(sys2.isSeasonSettled(s1.id)).toBe(true);
      expect(sys2.getSettledSeasonCount()).toBe(1);
    });

    it('loadSaveData null 输入静默忽略', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      // @ts-expect-error 测试非法输入
      sys.loadSaveData(null);
      expect(sys.getCurrentSeason()!.name).toBe('S1');
    });

    it('loadSaveData undefined 输入静默忽略', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      // @ts-expect-error 测试非法输入
      sys.loadSaveData(undefined);
      expect(sys.getCurrentSeason()!.name).toBe('S1');
    });

    it('loadSaveData 版本不匹配静默忽略', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.loadSaveData({ version: 999, state: { currentSeason: null, scores: [], history: [], settledSeasonIds: [] } });
      expect(sys.getCurrentSeason()!.name).toBe('S1');
    });

    it('loadSaveData 过滤 NaN/Infinity/负数积分', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      const badData: SeasonSaveData = {
        version: SEASON_SAVE_VERSION,
        state: {
          currentSeason: null,
          scores: [
            { heroId: 'h1', score: NaN },
            { heroId: 'h2', score: Infinity },
            { heroId: 'h3', score: -100 },
            { heroId: 'h4', score: 50 },
          ],
          history: [],
          settledSeasonIds: [],
        },
      };
      sys.loadSaveData(badData);
      expect(sys.getScore('h1')).toBe(0);
      expect(sys.getScore('h2')).toBe(0);
      expect(sys.getScore('h3')).toBe(0);
      expect(sys.getScore('h4')).toBe(50);
    });

    it('loadSaveData state 为 null 时静默忽略', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      // @ts-expect-error 测试非法输入
      sys.loadSaveData({ version: SEASON_SAVE_VERSION, state: null });
      expect(sys.getCurrentSeason()!.name).toBe('S1');
    });

    it('serialize 是 getSaveData 的别名', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      expect(sys.serialize()).toEqual(sys.getSaveData());
    });

    it('从历史恢复 seasonCounter', () => {
      const { sys: sys1 } = createSeason();
      sys1.createSeason('S1');
      sys1.settleSeason();
      sys1.createSeason('S2');
      sys1.settleSeason();
      const { sys: sys2 } = createSeason();
      sys2.loadSaveData(sys1.getSaveData());
      const s3 = sys2.createSeason('S3');
      expect(s3.id).toContain('season_');
    });
  });

  describe('reset 重置', () => {
    it('reset 清除所有状态', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.addScore('h1', 100);
      sys.settleSeason();
      sys.createSeason('S2');
      sys.reset();
      expect(sys.getCurrentSeason()).toBeNull();
      expect(sys.getScore('h1')).toBe(0);
      expect(sys.getSeasonHistory()).toEqual([]);
      expect(sys.getSettledSeasonCount()).toBe(0);
    });

    it('reset 后可重新创建赛季', () => {
      const { sys } = createSeason();
      sys.createSeason('S1');
      sys.reset();
      const s = sys.createSeason('S2');
      expect(s.name).toBe('S2');
      expect(s.id).toContain('season_1_');
    });
  });

  describe('完整生命周期', () => {
    it('创建→积分→排行→结算→历史→重置 全流程', () => {
      const { sys } = createSeason();
      const s1 = sys.createSeason('完整赛季');
      expect(s1.isActive).toBe(true);
      sys.addScore('h1', 1000);
      sys.addScore('h2', 500);
      sys.addScore('h3', 100);
      expect(sys.getHeroRank('h1')).toBe(1);
      expect(sys.getHeroRank('h2')).toBe(2);
      expect(sys.getHeroRank('h3')).toBe(3);
      const rankings = sys.settleSeason();
      expect(rankings.length).toBe(3);
      expect(rankings[0].heroId).toBe('h1');
      expect(sys.getSeasonHistory().length).toBe(1);
      expect(sys.isSeasonSettled(s1.id)).toBe(true);
      sys.reset();
      expect(sys.getCurrentSeason()).toBeNull();
      expect(sys.getSeasonHistory()).toEqual([]);
    });

    it('多赛季循环：序列化→加载→继续', () => {
      const { sys: sys1 } = createSeason();
      sys1.createSeason('S1');
      sys1.addScore('h1', 100);
      sys1.settleSeason();
      sys1.createSeason('S2');
      sys1.addScore('h2', 200);
      const data = sys1.getSaveData();
      const { sys: sys2 } = createSeason();
      sys2.loadSaveData(data);
      expect(sys2.getCurrentSeason()!.name).toBe('S2');
      expect(sys2.getScore('h2')).toBe(200);
      expect(sys2.getSeasonHistory().length).toBe(1);
      sys2.settleSeason();
      sys2.createSeason('S3');
      sys2.addScore('h3', 300);
      expect(sys2.getSettledSeasonCount()).toBe(2);
      expect(sys2.getScore('h3')).toBe(300);
    });
  });
});
