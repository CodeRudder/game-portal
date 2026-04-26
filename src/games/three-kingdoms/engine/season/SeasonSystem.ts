/**
 * 引擎层 — 赛季系统
 *
 * 管理赛季生命周期：创建 → 进行中 → 结算 → 历史。
 * 提供积分排行榜、赛季结算奖励和赛季历史记录功能。
 *
 * 核心流程：
 * 1. createSeason() 创建新赛季，设定起止时间
 * 2. addScore() 在赛季进行中为武将添加积分
 * 3. getLeaderboard() 查询实时排行榜
 * 4. settleSeason() 结算当前赛季，发放奖励，归档历史
 *
 * @module engine/season/SeasonSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import {
  DEFAULT_SEASON_DURATION_DAYS,
  DEFAULT_LEADERBOARD_LIMIT,
  SEASON_SAVE_VERSION,
  getRewardsForRank,
  type SeasonRewardItem,
} from './season-config';

// ─────────────────────────────────────────────
// 公共类型
// ─────────────────────────────────────────────

/** 赛季信息 */
export interface SeasonInfo {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  durationDays: number;
  isActive: boolean;
}

/** 赛季排名条目 */
export interface SeasonRanking {
  heroId: string;
  score: number;
  rank: number;
  rewards: SeasonRewardItem[];
}

/** 赛季积分记录 */
interface ScoreEntry {
  heroId: string;
  score: number;
}

/** 赛季内部状态 */
interface SeasonState {
  currentSeason: SeasonInfo | null;
  scores: ScoreEntry[];
  history: SeasonInfo[];
  settledSeasonIds: string[];
}

/** 存档数据格式 */
export interface SeasonSaveData {
  version: number;
  state: SeasonState;
}

// ─────────────────────────────────────────────
// SeasonSystem 类
// ─────────────────────────────────────────────

/**
 * 赛季系统
 *
 * 实现赛季的完整生命周期管理，包括创建、积分、排行和结算。
 */
export class SeasonSystem implements ISubsystem {
  readonly name = 'season';

  private deps!: ISystemDeps;
  private state: SeasonState = this.createInitialState();
  private seasonCounter = 0;

  // ─── 生命周期 (ISubsystem) ──────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 赛季系统不依赖帧更新，由业务层主动调用
  }

  getState(): SeasonState {
    return {
      currentSeason: this.state.currentSeason ? { ...this.state.currentSeason } : null,
      scores: this.state.scores.map(s => ({ ...s })),
      history: this.state.history.map(h => ({ ...h })),
      settledSeasonIds: [...this.state.settledSeasonIds],
    };
  }

  reset(): void {
    this.state = this.createInitialState();
    this.seasonCounter = 0;
  }

  // ─── 公开 API: 赛季管理 ────────────────

  /**
   * 获取当前赛季信息
   * @returns 当前赛季，无赛季时返回 null
   */
  getCurrentSeason(): SeasonInfo | null {
    if (!this.state.currentSeason) return null;
    // 动态计算 isActive
    return {
      ...this.state.currentSeason,
      isActive: this.isSeasonActive(this.state.currentSeason),
    };
  }

  /**
   * 创建新赛季
   *
   * 如果当前有未结算的赛季，会先自动结算。
   *
   * @param name - 赛季名称
   * @param durationDays - 持续天数，默认30天
   * @returns 新创建的赛季信息
   */
  createSeason(name: string, durationDays: number = DEFAULT_SEASON_DURATION_DAYS): SeasonInfo {
    // 如果有进行中的赛季，先结算
    if (this.state.currentSeason && this.isSeasonActive(this.state.currentSeason)) {
      this.settleSeason();
    }

    this.seasonCounter++;
    const now = Date.now();
    const endTime = now + durationDays * 24 * 60 * 60 * 1000;

    const season: SeasonInfo = {
      id: `season_${this.seasonCounter}_${now}`,
      name,
      startTime: now,
      endTime,
      durationDays,
      isActive: true,
    };

    this.state.currentSeason = season;
    this.state.scores = [];

    this.deps?.eventBus?.emit('season:created', {
      id: season.id,
      name: season.name,
      durationDays,
    });

    return { ...season };
  }

  /**
   * 获取当前赛季剩余天数
   * @returns 剩余天数，无赛季时返回 0
   */
  getRemainingDays(): number {
    const season = this.state.currentSeason;
    if (!season) return 0;
    const remaining = season.endTime - Date.now();
    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
  }

  /**
   * 获取当前赛季已过去的天数
   * @returns 已过天数
   */
  getElapsedDays(): number {
    const season = this.state.currentSeason;
    if (!season) return 0;
    const elapsed = Date.now() - season.startTime;
    return Math.max(0, Math.floor(elapsed / (24 * 60 * 60 * 1000)));
  }

  // ─── 公开 API: 积分系统 ────────────────

  /**
   * 为武将添加赛季积分
   *
   * @param heroId - 武将ID
   * @param score - 积分增量（必须 > 0）
   * @throws 无活跃赛季时抛出错误
   */
  addScore(heroId: string, score: number): void {
    this.ensureActiveSeason();
    if (score <= 0) return;

    const existing = this.state.scores.find(s => s.heroId === heroId);
    if (existing) {
      existing.score += score;
    } else {
      this.state.scores.push({ heroId, score });
    }
  }

  /**
   * 设置武将的赛季积分（覆盖）
   *
   * @param heroId - 武将ID
   * @param score - 积分绝对值
   */
  setScore(heroId: string, score: number): void {
    this.ensureActiveSeason();

    const existing = this.state.scores.find(s => s.heroId === heroId);
    if (existing) {
      existing.score = score;
    } else {
      this.state.scores.push({ heroId, score });
    }
  }

  /**
   * 获取武将的赛季积分
   *
   * @param heroId - 武将ID
   * @returns 积分值，不存在返回 0
   */
  getScore(heroId: string): number {
    const entry = this.state.scores.find(s => s.heroId === heroId);
    return entry?.score ?? 0;
  }

  // ─── 公开 API: 排行榜 ──────────────────

  /**
   * 获取排行榜
   *
   * 按积分降序排列，返回前 N 名及其奖励。
   *
   * @param limit - 返回条数，默认50
   * @returns 排名列表（含奖励）
   */
  getLeaderboard(limit: number = DEFAULT_LEADERBOARD_LIMIT): SeasonRanking[] {
    const sorted = [...this.state.scores].sort((a, b) => b.score - a.score);
    const top = sorted.slice(0, limit);

    return top.map((entry, index) => {
      const rank = index + 1;
      return {
        heroId: entry.heroId,
        score: entry.score,
        rank,
        rewards: getRewardsForRank(rank),
      };
    });
  }

  /**
   * 获取某武将的排名
   *
   * @param heroId - 武将ID
   * @returns 排名（从1开始），未上榜返回 -1
   */
  getHeroRank(heroId: string): number {
    const sorted = [...this.state.scores].sort((a, b) => b.score - a.score);
    const index = sorted.findIndex(s => s.heroId === heroId);
    return index === -1 ? -1 : index + 1;
  }

  // ─── 公开 API: 赛季结算 ────────────────

  /**
   * 结算当前赛季
   *
   * 1. 按积分排序生成最终排名
   * 2. 根据排名分配奖励
   * 3. 将赛季归档到历史
   * 4. 重置当前赛季和积分
   *
   * @returns 最终排名列表（含奖励）
   * @throws 无赛季时抛出错误
   */
  settleSeason(): SeasonRanking[] {
    if (!this.state.currentSeason) {
      throw new Error('没有可结算的赛季');
    }

    const season = this.state.currentSeason;
    const rankings = this.getLeaderboard(Infinity);

    // 标记赛季为不活跃
    season.isActive = false;

    // 归档到历史
    this.state.history.push({ ...season });
    this.state.settledSeasonIds.push(season.id);

    // 重置当前状态
    this.state.currentSeason = null;
    this.state.scores = [];

    this.deps?.eventBus?.emit('season:settled', {
      id: season.id,
      name: season.name,
      participantCount: rankings.length,
      topRank: rankings[0] ?? null,
    });

    return rankings;
  }

  // ─── 公开 API: 赛季历史 ────────────────

  /**
   * 获取所有已结束的赛季历史
   * @returns 赛季历史列表（按时间升序）
   */
  getSeasonHistory(): SeasonInfo[] {
    return this.state.history.map(h => ({ ...h }));
  }

  /**
   * 获取已结算赛季数量
   */
  getSettledSeasonCount(): number {
    return this.state.settledSeasonIds.length;
  }

  /**
   * 检查某赛季是否已结算
   */
  isSeasonSettled(seasonId: string): boolean {
    return this.state.settledSeasonIds.includes(seasonId);
  }

  // ─── 公开 API: 奖励查询 ────────────────

  /**
   * 根据排名获取赛季奖励
   *
   * @param rank - 排名（从1开始）
   * @returns 奖励列表
   */
  getSeasonRewards(rank: number): SeasonRewardItem[] {
    return getRewardsForRank(rank);
  }

  // ─── 存档 ───────────────────────────────

  /**
   * 序列化（ISubsystem 兼容别名）
   */
  serialize(): SeasonSaveData {
    return this.getSaveData();
  }

  /**
   * 获取存档数据
   */
  getSaveData(): SeasonSaveData {
    return {
      version: SEASON_SAVE_VERSION,
      state: {
        currentSeason: this.state.currentSeason ? { ...this.state.currentSeason } : null,
        scores: this.state.scores.map(s => ({ ...s })),
        history: this.state.history.map(h => ({ ...h })),
        settledSeasonIds: [...this.state.settledSeasonIds],
      },
    };
  }

  /**
   * 加载存档数据
   */
  loadSaveData(data: SeasonSaveData): void {
    if (data.version !== SEASON_SAVE_VERSION) return;
    this.state = {
      currentSeason: data.state.currentSeason ? { ...data.state.currentSeason } : null,
      scores: data.state.scores.map(s => ({ ...s })),
      history: data.state.history.map(h => ({ ...h })),
      settledSeasonIds: [...data.state.settledSeasonIds],
    };
    // 从历史中恢复计数器
    if (this.state.history.length > 0) {
      this.seasonCounter = this.state.history.length;
    }
  }

  // ─── 内部方法 ───────────────────────────

  /** 创建初始状态 */
  private createInitialState(): SeasonState {
    return {
      currentSeason: null,
      scores: [],
      history: [],
      settledSeasonIds: [],
    };
  }

  /** 检查赛季是否仍在有效期内 */
  private isSeasonActive(season: SeasonInfo): boolean {
    return Date.now() < season.endTime;
  }

  /** 确保有活跃赛季，否则抛出错误 */
  private ensureActiveSeason(): void {
    if (!this.state.currentSeason) {
      throw new Error('当前没有活跃赛季');
    }
    if (!this.isSeasonActive(this.state.currentSeason)) {
      throw new Error('当前赛季已过期');
    }
  }
}
