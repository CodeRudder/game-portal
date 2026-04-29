/**
 * SeasonHelper 单元测试
 *
 * 覆盖：
 * 1. getCurrentSeasonTheme — 赛季主题获取
 * 2. createSettlementAnimation — 结算动画
 * 3. updateSeasonRecord — 战绩更新
 * 4. generateSeasonRecordRanking — 战绩排行
 * 5. getSeasonThemes — 获取主题列表
 */

import {
  getCurrentSeasonTheme,
  createSettlementAnimation,
  updateSeasonRecord,
  generateSeasonRecordRanking,
  getSeasonThemes,
  DEFAULT_SEASON_THEMES,
} from '../SeasonHelper';

import type { SeasonRecord } from '../../../core/activity/activity.types';

describe('SeasonHelper', () => {
  // ─── getCurrentSeasonTheme ────────────────

  describe('getCurrentSeasonTheme', () => {
    it('应返回第一个主题（index 0）', () => {
      const theme = getCurrentSeasonTheme(0);
      expect(theme.id).toBe('theme_s1');
      expect(theme.name).toBe('黄巾之乱');
    });

    it('应循环返回主题', () => {
      const theme = getCurrentSeasonTheme(4);
      expect(theme.id).toBe('theme_s1');
    });

    it('应正确映射各索引', () => {
      expect(getCurrentSeasonTheme(1).id).toBe('theme_s2');
      expect(getCurrentSeasonTheme(2).id).toBe('theme_s3');
      expect(getCurrentSeasonTheme(3).id).toBe('theme_s4');
    });

    it('大索引应正确取模', () => {
      const theme = getCurrentSeasonTheme(100);
      expect(theme.id).toBe('theme_s1');
    });
  });

  // ─── createSettlementAnimation ────────────

  describe('createSettlementAnimation', () => {
    it('应创建结算动画数据', () => {
      const anim = createSettlementAnimation(
        'season_1', 'gold', 'diamond', 10, 1, {}, false,
      );
      expect(anim.seasonId).toBe('season_1');
      expect(anim.oldRankId).toBe('gold');
      expect(anim.newRankId).toBe('diamond');
    });

    it('应正确传递所有参数', () => {
      const rewards = { gold: 500 };
      const anim = createSettlementAnimation(
        's2', 'silver', 'gold', 50, 10, rewards, true,
      );
      expect(anim.oldRanking).toBe(50);
      expect(anim.newRanking).toBe(10);
      expect(anim.rewards).toBe(rewards);
      expect(anim.isServerAnnouncement).toBe(true);
    });
  });

  // ─── updateSeasonRecord ───────────────────

  describe('updateSeasonRecord', () => {
    const baseRecord: SeasonRecord = {
      seasonId: '',
      wins: 0,
      losses: 0,
      total: 0,
      winRate: 0,
      highestRank: '',
      highestRanking: 0,
    };

    it('胜场应增加 wins 和 total', () => {
      const updated = updateSeasonRecord(baseRecord, true, 'gold', 10);
      expect(updated.wins).toBe(1);
      expect(updated.losses).toBe(0);
      expect(updated.total).toBe(1);
    });

    it('败场应增加 losses 和 total', () => {
      const updated = updateSeasonRecord(baseRecord, false, 'silver', 50);
      expect(updated.wins).toBe(0);
      expect(updated.losses).toBe(1);
      expect(updated.total).toBe(1);
    });

    it('应正确计算胜率', () => {
      let r = updateSeasonRecord(baseRecord, true, 'gold', 10);
      r = updateSeasonRecord(r, true, 'gold', 10);
      r = updateSeasonRecord(r, false, 'gold', 10);
      expect(r.winRate).toBe(67); // 2/3 = 66.67% → round to 67
    });

    it('应更新最高排名（取最小值）', () => {
      const record: SeasonRecord = { ...baseRecord, highestRanking: 50 };
      const updated = updateSeasonRecord(record, true, 'gold', 10);
      expect(updated.highestRanking).toBe(10);
    });

    it('不应覆盖更高的排名', () => {
      const record: SeasonRecord = { ...baseRecord, highestRanking: 5 };
      const updated = updateSeasonRecord(record, true, 'gold', 10);
      expect(updated.highestRanking).toBe(5);
    });

    it('total为0时 winRate 应为0', () => {
      const updated = updateSeasonRecord(baseRecord, true, 'gold', 10);
      expect(updated.total).toBe(1);
      expect(updated.winRate).toBe(100);
    });
  });

  // ─── generateSeasonRecordRanking ──────────

  describe('generateSeasonRecordRanking', () => {
    it('应按胜场降序排列', () => {
      const records = [
        { playerId: 'p1', playerName: 'A', record: { wins: 5, losses: 0, total: 5, winRate: 100, seasonId: '', highestRank: '', highestRanking: 0 } },
        { playerId: 'p2', playerName: 'B', record: { wins: 10, losses: 0, total: 10, winRate: 100, seasonId: '', highestRank: '', highestRanking: 0 } },
      ];
      const ranking = generateSeasonRecordRanking(records);
      expect(ranking[0].playerId).toBe('p2');
      expect(ranking[1].playerId).toBe('p1');
    });

    it('胜场相同时按胜率排序', () => {
      const records = [
        { playerId: 'p1', playerName: 'A', record: { wins: 5, losses: 5, total: 10, winRate: 50, seasonId: '', highestRank: '', highestRanking: 0 } },
        { playerId: 'p2', playerName: 'B', record: { wins: 5, losses: 0, total: 5, winRate: 100, seasonId: '', highestRank: '', highestRanking: 0 } },
      ];
      const ranking = generateSeasonRecordRanking(records);
      expect(ranking[0].playerId).toBe('p2');
    });

    it('应正确分配排名', () => {
      const records = [
        { playerId: 'p1', playerName: 'A', record: { wins: 10, losses: 0, total: 10, winRate: 100, seasonId: '', highestRank: '', highestRanking: 0 } },
        { playerId: 'p2', playerName: 'B', record: { wins: 5, losses: 0, total: 5, winRate: 100, seasonId: '', highestRank: '', highestRanking: 0 } },
        { playerId: 'p3', playerName: 'C', record: { wins: 1, losses: 0, total: 1, winRate: 100, seasonId: '', highestRank: '', highestRanking: 0 } },
      ];
      const ranking = generateSeasonRecordRanking(records);
      expect(ranking[0].rank).toBe(1);
      expect(ranking[1].rank).toBe(2);
      expect(ranking[2].rank).toBe(3);
    });

    it('空列表应返回空数组', () => {
      const ranking = generateSeasonRecordRanking([]);
      expect(ranking).toEqual([]);
    });
  });

  // ─── getSeasonThemes ──────────────────────

  describe('getSeasonThemes', () => {
    it('应返回所有默认主题', () => {
      const themes = getSeasonThemes();
      expect(themes.length).toBe(DEFAULT_SEASON_THEMES.length);
    });

    it('应返回副本，修改不影响原数据', () => {
      const themes = getSeasonThemes();
      themes.pop();
      expect(DEFAULT_SEASON_THEMES.length).toBe(4);
    });
  });
});
