/**
 * 联盟Boss系统 — 引擎层
 *
 * 职责：Boss生成/伤害统计/击杀判定/奖励分配/伤害排行
 * 规则：
 *   - 每日刷新Boss（难度随联盟等级递增）
 *   - 全员参与讨伐（异步，每人每日3次挑战机会）
 *   - 伤害统计 → 排行 → 按伤害比例分配奖励
 *   - 击杀奖励：全员获得公会币×30 + 天命×20
 *   - 未击杀：按个人伤害发放参与奖
 *
 * @module engine/alliance/AllianceBossSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  AllianceBoss,
  AllianceBossConfig,
  AllianceData,
  AlliancePlayerState,
  BossChallengeResult,
  BossDamageEntry,
} from '../../core/alliance/alliance.types';
import { BossStatus } from '../../core/alliance/alliance.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认Boss配置 */
export const DEFAULT_BOSS_CONFIG: AllianceBossConfig = {
  dailyChallengeLimit: 3,
  killGuildCoinReward: 30,
  killDestinyReward: 20,
  participationGuildCoin: 5,
  baseHp: 100000,
  hpPerLevel: 50000,
};

/** Boss名称表 */
const BOSS_NAMES = [
  '黄巾力士', '董卓残党', '吕布幻影', '袁绍精锐',
  '南蛮象兵', '山越蛮王', '匈奴铁骑', '鲜卑战神',
];

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 生成Boss实例 */
export function createBoss(allianceLevel: number, now: number): AllianceBoss {
  const bossLevel = allianceLevel;
  const maxHp = DEFAULT_BOSS_CONFIG.baseHp + (bossLevel - 1) * DEFAULT_BOSS_CONFIG.hpPerLevel;
  const nameIdx = (allianceLevel - 1) % BOSS_NAMES.length;

  return {
    id: `boss_${now}`,
    name: BOSS_NAMES[nameIdx],
    level: bossLevel,
    maxHp,
    currentHp: maxHp,
    status: BossStatus.ALIVE,
    damageRecords: {},
    dailyChallengeLimit: DEFAULT_BOSS_CONFIG.dailyChallengeLimit,
    refreshTime: now,
  };
}

// ─────────────────────────────────────────────
// AllianceBossSystem 类
// ─────────────────────────────────────────────

/**
 * 联盟Boss系统
 *
 * 管理Boss生成、挑战、伤害排行、奖励分配
 */
export class AllianceBossSystem implements ISubsystem {
  readonly name = 'AllianceBossSystem';
  private deps!: ISystemDeps;
  private config: AllianceBossConfig;
  /** 缓存的Boss实例，避免每次getCurrentBoss重建丢失伤害记录 */
  private _bossCache: AllianceBoss | null = null;
  /** 缓存对应的联盟ID，用于判断缓存是否过期 */
  private _bossCacheAllianceId: string | null = null;

  constructor(config?: Partial<AllianceBossConfig>) {
    this.config = { ...DEFAULT_BOSS_CONFIG, ...config };
  }

  // ── ISubsystem 接口 ─────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    /* 预留：可在此处理Boss自动刷新检测 */
  }

  getState(): Record<string, unknown> {
    return {
      config: this.config,
    };
  }

  reset(): void {
    this.clearBossCache();
  }

  // ── Boss管理 ──────────────────────────────

  /**
   * 每日刷新Boss
   */
  refreshBoss(alliance: AllianceData, now: number): AllianceData {
    this.clearBossCache();
    const boss = createBoss(alliance.level, now);
    return {
      ...alliance,
      bossKilledToday: false,
      lastBossRefreshTime: now,
      // 存储Boss到alliance的扩展字段（实际工程中可用独立存储）
    };
  }

  /**
   * 获取当前Boss（优先使用缓存，避免重建丢失伤害记录）
   */
  getCurrentBoss(alliance: AllianceData): AllianceBoss {
    // 如果有缓存且联盟ID匹配，直接返回缓存
    if (this._bossCache && this._bossCacheAllianceId === alliance.id) {
      // 同步bossKilledToday状态
      if (alliance.bossKilledToday && this._bossCache.status !== BossStatus.KILLED) {
        this._bossCache = {
          ...this._bossCache,
          status: BossStatus.KILLED,
          currentHp: 0,
        };
      }
      return this._bossCache;
    }
    // 无缓存时根据联盟数据重建
    const boss = createBoss(alliance.level, alliance.lastBossRefreshTime);
    if (alliance.bossKilledToday) {
      boss.status = BossStatus.KILLED;
      boss.currentHp = 0;
    }
    this._bossCache = boss;
    this._bossCacheAllianceId = alliance.id;
    return boss;
  }

  /**
   * 更新缓存的Boss实例（challengeBoss后调用）
   */
  updateBossCache(boss: AllianceBoss, allianceId: string): void {
    this._bossCache = boss;
    this._bossCacheAllianceId = allianceId;
  }

  /**
   * 清除Boss缓存（Boss刷新时调用）
   */
  clearBossCache(): void {
    this._bossCache = null;
    this._bossCacheAllianceId = null;
  }

  // ── Boss挑战 ──────────────────────────────

  /**
   * 挑战Boss
   * @returns 挑战结果
   */
  challengeBoss(
    boss: AllianceBoss,
    alliance: AllianceData,
    playerState: AlliancePlayerState,
    playerId: string,
    damage: number,
  ): {
    boss: AllianceBoss;
    alliance: AllianceData;
    playerState: AlliancePlayerState;
    result: BossChallengeResult;
  } {
    // 检查Boss状态
    if (boss.status !== BossStatus.ALIVE) {
      throw new Error('Boss已被击杀');
    }

    // 检查成员
    if (!alliance.members[playerId]) {
      throw new Error('不是联盟成员');
    }

    // 检查挑战次数
    const member = alliance.members[playerId];
    if (
      member.dailyBossChallenges >= this.config.dailyChallengeLimit ||
      playerState.dailyBossChallenges >= this.config.dailyChallengeLimit
    ) {
      throw new Error('今日挑战次数已用完');
    }

    // 限制伤害不超过当前HP，且不允许负数；NaN视为0
    const safeDamage = Number.isNaN(damage) ? 0 : damage;
    const actualDamage = Math.max(0, Math.min(safeDamage, boss.currentHp));
    const isKillingBlow = boss.currentHp - actualDamage <= 0;

    // 更新Boss
    const newHp = boss.currentHp - actualDamage;
    const newDamageRecords = { ...boss.damageRecords };
    newDamageRecords[playerId] = (newDamageRecords[playerId] ?? 0) + actualDamage;

    const updatedBoss: AllianceBoss = {
      ...boss,
      currentHp: newHp,
      status: isKillingBlow ? BossStatus.KILLED : BossStatus.ALIVE,
      damageRecords: newDamageRecords,
    };

    // 计算奖励
    let guildCoinReward = this.config.participationGuildCoin;
    let killReward: BossChallengeResult['killReward'] = null;

    if (isKillingBlow) {
      killReward = {
        guildCoin: this.config.killGuildCoinReward,
        destinyPoint: this.config.killDestinyReward,
      };
    }

    const result: BossChallengeResult = {
      damage: actualDamage,
      isKillingBlow,
      guildCoinReward,
      killReward,
    };

    // 更新玩家状态
    const updatedPlayerState: AlliancePlayerState = {
      ...playerState,
      guildCoins: playerState.guildCoins + guildCoinReward,
      dailyBossChallenges: playerState.dailyBossChallenges + 1,
    };

    // 更新联盟成员数据
    const updatedMembers = {
      ...alliance.members,
      [playerId]: {
        ...member,
        dailyBossChallenges: member.dailyBossChallenges + 1,
        dailyContribution: member.dailyContribution + actualDamage / 100,
        totalContribution: member.totalContribution + actualDamage / 100,
      },
    };

    const updatedAlliance: AllianceData = {
      ...alliance,
      members: updatedMembers,
      bossKilledToday: isKillingBlow ? true : alliance.bossKilledToday,
    };

    // 更新Boss缓存
    this.updateBossCache(updatedBoss, alliance.id);

    return {
      boss: updatedBoss,
      alliance: updatedAlliance,
      playerState: updatedPlayerState,
      result,
    };
  }

  // ── 伤害排行 ──────────────────────────────

  /**
   * 获取Boss伤害排行
   */
  getDamageRanking(boss: AllianceBoss, alliance: AllianceData): BossDamageEntry[] {
    const totalDamage = Object.values(boss.damageRecords).reduce((sum, d) => sum + d, 0);

    const entries: BossDamageEntry[] = Object.entries(boss.damageRecords).map(([playerId, damage]) => {
      const member = alliance.members[playerId];
      return {
        playerId,
        playerName: member?.playerName ?? '未知',
        damage,
        damagePercent: totalDamage > 0 ? (damage / totalDamage) * 100 : 0,
        rank: 0,
      };
    });

    // 按伤害降序排序
    entries.sort((a, b) => b.damage - a.damage);
    entries.forEach((e, i) => { e.rank = i + 1; });

    return entries;
  }

  /**
   * 获取击杀全员奖励
   */
  getKillRewards(): { guildCoin: number; destinyPoint: number } {
    return {
      guildCoin: this.config.killGuildCoinReward,
      destinyPoint: this.config.killDestinyReward,
    };
  }

  /**
   * 分配击杀全员奖励
   */
  distributeKillRewards(
    alliance: AllianceData,
    playerState: AlliancePlayerState,
  ): AlliancePlayerState {
    return {
      ...playerState,
      guildCoins: playerState.guildCoins + this.config.killGuildCoinReward,
    };
  }

  // ── 工具方法 ──────────────────────────────

  /**
   * 获取配置
   */
  getConfig(): AllianceBossConfig {
    return { ...this.config };
  }

  /**
   * 计算Boss最大HP
   */
  calculateBossMaxHp(allianceLevel: number): number {
    return this.config.baseHp + (allianceLevel - 1) * this.config.hpPerLevel;
  }

  /**
   * 获取玩家今日剩余挑战次数
   */
  getRemainingChallenges(playerState: AlliancePlayerState): number {
    const challenges = playerState.dailyBossChallenges;
    const used = Number.isNaN(challenges) ? 0 : challenges;
    return Math.max(0, this.config.dailyChallengeLimit - used);
  }

  // ── 存档序列化 (FIX-P0-001: Alliance R1 存档接入) ──

  /** Boss系统存档数据 — Boss状态由 AllianceData 字段承载(bossKilledToday/lastBossRefreshTime) */
  serialize(): Record<string, unknown> {
    return { config: { ...this.config } };
  }

  /** 从存档恢复 — Boss通过 alliance 数据重建，此处无额外状态 */
  deserialize(_data: Record<string, unknown>): void {
    /* Boss状态由 AllianceData.bossKilledToday/lastBossRefreshTime 承载 */
  }
}
