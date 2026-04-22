/**
 * 排行榜系统 — 引擎层
 *
 * 职责：多维度排名、实时排名计算、奖励发放
 * 规则：
 *   - 多维度排名：战力/积分/赛季
 *   - 实时刷新排名
 *   - 自己排名固定底部显示
 *
 * @module engine/pvp/RankingSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { ArenaOpponent } from '../../core/pvp/pvp.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 排名维度 */
export enum RankingDimension {
  /** 积分排名 */
  SCORE = 'SCORE',
  /** 战力排名 */
  POWER = 'POWER',
  /** 赛季排名 */
  SEASON = 'SEASON',
}

/** 排行榜条目 */
export interface RankingEntry {
  /** 玩家ID */
  playerId: string;
  /** 玩家名称 */
  playerName: string;
  /** 排名值（积分/战力） */
  value: number;
  /** 段位ID */
  rankId: string;
  /** 阵营 */
  faction: string;
}

/** 排行榜数据 */
export interface RankingData {
  /** 排行榜条目列表 */
  entries: RankingEntry[];
  /** 最后更新时间 */
  lastUpdateTime: number;
}

/** 排行榜配置 */
export interface RankingConfig {
  /** 最大显示条数 */
  maxDisplayCount: number;
  /** 刷新间隔（毫秒） */
  refreshIntervalMs: number;
}

/** 默认排行榜配置 */
export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  maxDisplayCount: 100,
  refreshIntervalMs: 5 * 60 * 1000, // 5分钟
};

/** 排行榜存档数据 */
export interface RankingSaveData {
  version: number;
  scoreRanking: RankingData;
  powerRanking: RankingData;
  seasonRanking: RankingData;
}

/** 排行榜存档版本 */
export const RANKING_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// RankingSystem 类
// ─────────────────────────────────────────────

/**
 * 排行榜系统
 *
 * 管理多维度排名计算和查询
 */
export class RankingSystem implements ISubsystem {
  readonly name = 'PvpRankingSystem';
  private deps!: ISystemDeps;
  private config: RankingConfig;

  /** 各维度排行榜缓存 */
  private rankings: Map<RankingDimension, RankingData> = new Map();

  constructor(config?: Partial<RankingConfig>) {
    this.config = { ...DEFAULT_RANKING_CONFIG, ...config };
    // 初始化各维度排行榜
    for (const dim of Object.values(RankingDimension)) {
      this.rankings.set(dim, { entries: [], lastUpdateTime: 0 });
    }
  }

  // ── ISubsystem 接口 ─────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    for (const dim of Object.values(RankingDimension)) {
      this.rankings.set(dim, { entries: [], lastUpdateTime: 0 });
    }
  }

  update(_dt: number): void {
    /* 预留：可在此处理排行榜自动刷新 */
  }

  getState(): Record<string, unknown> {
    return {
      rankings: this.serialize(),
      config: this.config,
    };
  }

  reset(): void {
    for (const dim of Object.values(RankingDimension)) {
      this.rankings.set(dim, { entries: [], lastUpdateTime: 0 });
    }
  }

  // ── 排名计算 ──────────────────────────────

  /**
   * 更新排行榜
   *
   * 根据对手列表重新计算排名
   */
  updateRanking(dimension: RankingDimension, players: ArenaOpponent[], now: number): RankingData {
    const entries: RankingEntry[] = players
      .map((p) => ({
        playerId: p.playerId,
        playerName: p.playerName,
        value: dimension === RankingDimension.POWER ? p.power : p.score,
        rankId: p.rankId,
        faction: p.faction,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, this.config.maxDisplayCount);

    const data: RankingData = { entries, lastUpdateTime: now };
    this.rankings.set(dimension, data);
    return data;
  }

  /**
   * 获取排行榜
   */
  getRanking(dimension: RankingDimension): RankingData {
    return this.rankings.get(dimension) ?? { entries: [], lastUpdateTime: 0 };
  }

  /**
   * 获取玩家排名
   *
   * 返回1-based排名，0表示未入榜
   */
  getPlayerRank(dimension: RankingDimension, playerId: string): number {
    const data = this.rankings.get(dimension);
    if (!data) return 0;

    const idx = data.entries.findIndex((e) => e.playerId === playerId);
    return idx >= 0 ? idx + 1 : 0;
  }

  /**
   * 获取排名附近的玩家（用于匹配参考）
   */
  getNearbyPlayers(
    dimension: RankingDimension,
    playerId: string,
    range: number = 10,
  ): RankingEntry[] {
    const data = this.rankings.get(dimension);
    if (!data) return [];

    const idx = data.entries.findIndex((e) => e.playerId === playerId);
    if (idx < 0) return [];

    const start = Math.max(0, idx - range);
    const end = Math.min(data.entries.length, idx + range + 1);
    return data.entries.slice(start, end);
  }

  /**
   * 获取Top N玩家
   */
  getTopPlayers(dimension: RankingDimension, count: number = 10): RankingEntry[] {
    const data = this.rankings.get(dimension);
    if (!data) return [];

    return data.entries.slice(0, count);
  }

  // ── 排名检查 ──────────────────────────────

  /**
   * 检查排行榜是否需要刷新
   */
  needsRefresh(dimension: RankingDimension, now: number): boolean {
    const data = this.rankings.get(dimension);
    if (!data) return true;
    // 从未更新过的排行榜需要刷新
    if (data.lastUpdateTime === 0) return true;

    return now - data.lastUpdateTime >= this.config.refreshIntervalMs;
  }

  /**
   * 获取排行榜条目数量
   */
  getEntryCount(dimension: RankingDimension): number {
    return this.rankings.get(dimension)?.entries.length ?? 0;
  }

  // ── 工具方法 ──────────────────────────────

  /**
   * 获取配置
   */
  getConfig(): RankingConfig {
    return { ...this.config };
  }

  /**
   * 获取所有维度
   */
  getDimensions(): RankingDimension[] {
    return Object.values(RankingDimension);
  }

  // ── 存档序列化 ──────────────────────────

  /**
   * 序列化排行榜数据
   */
  serialize(): RankingSaveData {
    return {
      version: RANKING_SAVE_VERSION,
      scoreRanking: this.getRanking(RankingDimension.SCORE),
      powerRanking: this.getRanking(RankingDimension.POWER),
      seasonRanking: this.getRanking(RankingDimension.SEASON),
    };
  }

  /**
   * 反序列化恢复排行榜
   */
  deserialize(data: RankingSaveData): void {
    if (!data || data.version !== RANKING_SAVE_VERSION) return;

    this.rankings.set(RankingDimension.SCORE, data.scoreRanking);
    this.rankings.set(RankingDimension.POWER, data.powerRanking);
    this.rankings.set(RankingDimension.SEASON, data.seasonRanking);
  }
}
