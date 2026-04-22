/**
 * 活动系统 — 赛季辅助模块
 *
 * 从 ActivitySystem.ts 拆分出的赛季深化功能：
 *   - 赛季主题获取
 *   - 赛季结算动画
 *   - 赛季战绩更新
 *   - 赛季战绩排行
 *
 * @module engine/activity/SeasonHelper
 */

import type {
  SeasonTheme,
  SeasonSettlementAnimation,
  SeasonRecord,
  SeasonRecordEntry,
} from '../../core/activity/activity.types';

/** 默认赛季主题列表 */
export const DEFAULT_SEASON_THEMES: SeasonTheme[] = [
  { id: 'theme_s1', name: '黄巾之乱', description: '苍天已死，黄天当立', avatarFrameId: 'frame_s1', kingTitle: '平乱功臣' },
  { id: 'theme_s2', name: '群雄逐鹿', description: '天下英雄谁敌手', avatarFrameId: 'frame_s2', kingTitle: '天下霸主' },
  { id: 'theme_s3', name: '赤壁烽火', description: '东风不与周郎便', avatarFrameId: 'frame_s3', kingTitle: '赤壁英雄' },
  { id: 'theme_s4', name: '三国鼎立', description: '三分天下有其一', avatarFrameId: 'frame_s4', kingTitle: '一统天下' },
];

/**
 * 获取当前赛季主题
 */
export function getCurrentSeasonTheme(seasonIndex: number): SeasonTheme {
  const idx = seasonIndex % DEFAULT_SEASON_THEMES.length;
  return DEFAULT_SEASON_THEMES[idx];
}

/**
 * 生成赛季结算动画数据
 */
export function createSettlementAnimation(
  seasonId: string,
  oldRankId: string,
  newRankId: string,
  oldRanking: number,
  newRanking: number,
  rewards: SeasonSettlementAnimation['rewards'],
  isServerAnnouncement: boolean,
): SeasonSettlementAnimation {
  return {
    seasonId,
    oldRankId,
    newRankId,
    oldRanking,
    newRanking,
    rewards,
    isServerAnnouncement,
  };
}

/**
 * 更新赛季战绩
 */
export function updateSeasonRecord(
  record: SeasonRecord,
  won: boolean,
  currentRank: string,
  currentRanking: number,
): SeasonRecord {
  const wins = record.wins + (won ? 1 : 0);
  const losses = record.losses + (won ? 0 : 1);
  const total = wins + losses;

  return {
    ...record,
    wins,
    losses,
    total,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    highestRank: currentRank,
    highestRanking: Math.min(currentRanking, record.highestRanking || currentRanking),
  };
}

/**
 * 生成赛季战绩排行
 */
export function generateSeasonRecordRanking(
  records: Array<{ playerId: string; playerName: string; record: SeasonRecord }>,
): SeasonRecordEntry[] {
  const entries = records
    .map(r => ({
      playerId: r.playerId,
      playerName: r.playerName,
      wins: r.record.wins,
      winRate: r.record.winRate,
      rank: 0,
    }))
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.winRate - a.winRate;
    });

  entries.forEach((e, i) => { e.rank = i + 1; });
  return entries;
}

/**
 * 获取赛季主题列表
 */
export function getSeasonThemes(): SeasonTheme[] {
  return [...DEFAULT_SEASON_THEMES];
}
