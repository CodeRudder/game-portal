/**
 * 招贤令经济系统 — 基于 4h 在线/天的经济模型
 *
 * 职责：招贤令（recruitToken）的获取途径管理，包括：
 * - 被动产出 tick（每秒调用）
 * - 新手礼包（首次登录赠送 100）
 * - 日常任务奖励（每日完成 3 个任务奖励 15）
 * - 商店购买（100 铜钱/个，每日限购 50 个）
 * - 关卡首通奖励（3~5 随机）
 * - 活动奖励（10~20 招贤令）
 * - 离线收益（按 50% 效率产出）
 *
 * 设计规格来源：PRD v1.3 HER-10.2
 *
 * @module engine/hero/recruit-token-economy-system
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 常量配置
// ─────────────────────────────────────────────

/** 被动产出速率（招贤令/秒） */
const PASSIVE_RATE_PER_SECOND = 0.002;

/** 新手礼包赠送数量 */
const NEWBIE_PACK_AMOUNT = 100;

/** 日常任务奖励数量 */
const DAILY_TASK_REWARD = 15;

/** 商店单价（铜钱） */
const SHOP_UNIT_COST = 100;

/** 商店每日限购数量 */
const SHOP_DAILY_LIMIT = 50;

/** 关卡首通奖励最小值 */
const STAGE_CLEAR_MIN = 3;

/** 关卡首通奖励最大值 */
const STAGE_CLEAR_MAX = 5;

/** 活动奖励最小值 */
const EVENT_REWARD_MIN = 10;

/** 活动奖励最大值 */
const EVENT_REWARD_MAX = 20;

/** 离线收益效率（50%） */
const OFFLINE_EFFICIENCY = 0.5;

// ─────────────────────────────────────────────
// 存档数据接口
// ─────────────────────────────────────────────

/** 招贤令经济系统存档数据 */
export interface RecruitTokenEconomySaveData {
  /** 存档版本号 */
  version: number;
  /** 是否已领取新手礼包 */
  newbiePackClaimed: boolean;
  /** 今日已购买商店数量 */
  dailyShopPurchased: number;
  /** 今日日期字符串（用于日重置判断） */
  lastResetDate: string;
  /** 今日是否已领取日常任务奖励 */
  dailyTaskClaimed: boolean;
  /** 已领取首通奖励的关卡 ID 集合 */
  clearedStages: string[];
  /** 累计被动产出（用于追踪） */
  totalPassiveEarned: number;
}

/** 当前存档版本号 */
const SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 依赖注入接口
// ─────────────────────────────────────────────

/**
 * 招贤令经济系统资源操作依赖
 *
 * 通过回调函数解耦具体的资源系统实现。
 */
export interface RecruitTokenEconomyDeps {
  /** 增加招贤令 */
  addRecruitToken: (amount: number) => number;
  /** 增加铜钱（用于商店退款等场景） */
  addGold?: (amount: number) => number;
  /** 消耗铜钱 */
  consumeGold: (amount: number) => boolean;
  /** 获取铜钱数量 */
  getGoldAmount: () => number;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 获取今日日期字符串 YYYY-MM-DD */
function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 生成 [min, max] 范围内的随机整数（含边界） */
function randomInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ─────────────────────────────────────────────
// RecruitTokenEconomySystem
// ─────────────────────────────────────────────

/**
 * 招贤令经济系统
 *
 * 管理招贤令的所有获取途径，实现 PRD v1.3 HER-10.2 经济模型。
 * 基于 4h 在线/天的设计目标：
 * - 被动产出：0.002/秒 × 14400秒 = 28.8
 * - 新手礼包：100（仅首次）
 * - 日常任务：15/天
 * - 商店购买：最多 50 个/天（需铜钱）
 * - 关卡首通：3~5/关
 * - 活动奖励：10~20/次
 * - 离线收益：0.002 × seconds × 0.5
 *
 * 4h 在线日产出 ≈ 28.8（被动）+ 15（日常）+ 关卡/活动 ≈ 191
 */
export class RecruitTokenEconomySystem implements ISubsystem {
  readonly name = 'recruitTokenEconomy' as const;

  // ── 依赖 ──
  private deps: ISystemDeps | null = null;
  private economyDeps: RecruitTokenEconomyDeps | null = null;

  // ── 状态 ──
  /** 是否已领取新手礼包 */
  private newbiePackClaimed = false;
  /** 今日已购买商店数量 */
  private dailyShopPurchased = 0;
  /** 上次重置日期 */
  private lastResetDate = '';
  /** 今日是否已领取日常任务奖励 */
  private dailyTaskClaimed = false;
  /** 已领取首通奖励的关卡 ID 集合 */
  private clearedStages = new Set<string>();
  /** 累计被动产出 */
  private totalPassiveEarned = 0;
  /** 随机数生成器 */
  private rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }

  // ── ISubsystem 接口实现 ──

  /** 注入系统依赖 */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** 每帧更新（dt 为秒），处理被动产出和日重置 */
  update(dt: number): void {
    this.checkDailyReset();
    this.tick(dt);
  }

  /** 获取系统状态快照 */
  getState(): unknown {
    return this.serialize();
  }

  /** 重置为初始状态 */
  reset(): void {
    this.newbiePackClaimed = false;
    this.dailyShopPurchased = 0;
    this.lastResetDate = '';
    this.dailyTaskClaimed = false;
    this.clearedStages.clear();
    this.totalPassiveEarned = 0;
  }

  // ── 依赖注入 ──

  /** 设置资源操作依赖 */
  setEconomyDeps(deps: RecruitTokenEconomyDeps): void {
    this.economyDeps = deps;
  }

  /** 注入随机数生成器（测试用） */
  setRng(rng: () => number): void {
    this.rng = rng;
  }

  // ─────────────────────────────────────────
  // 1. 被动产出
  // ─────────────────────────────────────────

  /**
   * 被动产出 tick
   *
   * 每帧调用，按 0.002/秒 的速率增加招贤令。
   * 实际资源增加通过 economyDeps.addRecruitToken 回调执行。
   *
   * @param deltaSeconds 距上次 tick 的时间间隔（秒）
   */
  tick(deltaSeconds: number): void {
    if (!this.economyDeps) return;
    if (deltaSeconds <= 0) return;

    const earned = PASSIVE_RATE_PER_SECOND * deltaSeconds;
    const actual = this.economyDeps.addRecruitToken(earned);
    this.totalPassiveEarned += actual;
  }

  // ─────────────────────────────────────────
  // 2. 新手礼包
  // ─────────────────────────────────────────

  /**
   * 领取新手礼包
   *
   * 首次登录赠送 100 招贤令，仅可领取一次。
   *
   * @returns 实际获得的招贤令数量（首次 100，已领取过返回 0）
   */
  claimNewbiePack(): number {
    if (this.newbiePackClaimed) return 0;
    if (!this.economyDeps) return 0;

    this.newbiePackClaimed = true;
    const actual = this.economyDeps.addRecruitToken(NEWBIE_PACK_AMOUNT);
    return actual;
  }

  // ─────────────────────────────────────────
  // 3. 日常任务奖励
  // ─────────────────────────────────────────

  /**
   * 领取日常任务奖励
   *
   * 每日完成 3 个任务后可领取 15 招贤令，每日限领 1 次。
   * 每日 0 点重置。
   *
   * @returns 实际获得的招贤令数量（15 或 0）
   */
  claimDailyTaskReward(): number {
    this.checkDailyReset();
    if (this.dailyTaskClaimed) return 0;
    if (!this.economyDeps) return 0;

    this.dailyTaskClaimed = true;
    const actual = this.economyDeps.addRecruitToken(DAILY_TASK_REWARD);
    return actual;
  }

  // ─────────────────────────────────────────
  // 4. 商店购买
  // ─────────────────────────────────────────

  /**
   * 从商店购买招贤令
   *
   * 单价 100 铜钱/个，每日限购 50 个。
   * 购买数量不能超过剩余限购额度。
   *
   * @param count 购买数量
   * @returns 是否购买成功
   */
  buyFromShop(count: number): boolean {
    this.checkDailyReset();
    if (!this.economyDeps) return false;
    if (count <= 0) return false;

    // 检查日限购
    const remaining = SHOP_DAILY_LIMIT - this.dailyShopPurchased;
    if (remaining <= 0) return false;

    // 实际购买数量不超过剩余额度
    const actualCount = Math.min(count, remaining);
    const totalCost = actualCount * SHOP_UNIT_COST;

    // 检查铜钱是否足够
    const goldAmount = this.economyDeps.getGoldAmount();
    if (goldAmount < totalCost) return false;

    // 扣除铜钱
    const consumed = this.economyDeps.consumeGold(totalCost);
    if (!consumed) return false;

    // 增加招贤令
    this.economyDeps.addRecruitToken(actualCount);
    this.dailyShopPurchased += actualCount;
    return true;
  }

  // ─────────────────────────────────────────
  // 5. 关卡首通奖励
  // ─────────────────────────────────────────

  /**
   * 领取关卡首通奖励
   *
   * 每个关卡首次通关奖励 3~5 招贤令（随机），同一关卡不可重复领取。
   *
   * @param stageId 关卡 ID
   * @returns 实际获得的招贤令数量（3~5 或 0）
   */
  claimStageClearReward(stageId: string): number {
    if (!this.economyDeps) return 0;
    if (!stageId) return 0;

    // 同一关卡不可重复领取
    if (this.clearedStages.has(stageId)) return 0;

    const reward = randomInt(STAGE_CLEAR_MIN, STAGE_CLEAR_MAX, this.rng);
    this.clearedStages.add(stageId);
    const actual = this.economyDeps.addRecruitToken(reward);
    return actual;
  }

  // ─────────────────────────────────────────
  // 6. 活动奖励
  // ─────────────────────────────────────────

  /**
   * 领取活动奖励
   *
   * 奖励 10~20 招贤令（随机）。活动奖励可多次领取，
   * 由上层活动系统控制领取次数。
   *
   * @returns 实际获得的招贤令数量（10~20）
   */
  claimEventReward(): number {
    if (!this.economyDeps) return 0;

    const reward = randomInt(EVENT_REWARD_MIN, EVENT_REWARD_MAX, this.rng);
    const actual = this.economyDeps.addRecruitToken(reward);
    return actual;
  }

  // ─────────────────────────────────────────
  // 7. 离线收益
  // ─────────────────────────────────────────

  /**
   * 计算离线收益
   *
   * 按 50% 效率产出：0.002 × seconds × 0.5 = 0.001/秒
   *
   * @param offlineSeconds 离线秒数
   * @returns 离线期间应获得的招贤令数量
   */
  calculateOfflineReward(offlineSeconds: number): number {
    if (offlineSeconds <= 0) return 0;
    return PASSIVE_RATE_PER_SECOND * offlineSeconds * OFFLINE_EFFICIENCY;
  }

  /**
   * 领取离线收益
   *
   * 计算并直接发放离线期间的招贤令收益。
   *
   * @param offlineSeconds 离线秒数
   * @returns 实际获得的招贤令数量
   */
  claimOfflineReward(offlineSeconds: number): number {
    if (!this.economyDeps) return 0;
    const reward = this.calculateOfflineReward(offlineSeconds);
    if (reward <= 0) return 0;
    return this.economyDeps.addRecruitToken(reward);
  }

  // ─────────────────────────────────────────
  // 8. 查询接口
  // ─────────────────────────────────────────

  /** 获取今日已购买商店数量 */
  getDailyShopPurchased(): number {
    this.checkDailyReset();
    return this.dailyShopPurchased;
  }

  /** 获取商店每日剩余可购买数量 */
  getDailyShopRemaining(): number {
    this.checkDailyReset();
    return Math.max(0, SHOP_DAILY_LIMIT - this.dailyShopPurchased);
  }

  /** 是否已领取新手礼包 */
  getNewbiePackClaimed(): boolean {
    return this.newbiePackClaimed;
  }

  /** 今日是否已领取日常任务奖励 */
  getDailyTaskClaimed(): boolean {
    this.checkDailyReset();
    return this.dailyTaskClaimed;
  }

  /** 获取累计被动产出 */
  getTotalPassiveEarned(): number {
    return this.totalPassiveEarned;
  }

  /** 检查关卡是否已领取首通奖励 */
  isStageRewardClaimed(stageId: string): boolean {
    return this.clearedStages.has(stageId);
  }

  /** 获取已领取首通奖励的关卡数量 */
  getClearedStageCount(): number {
    return this.clearedStages.size;
  }

  /** 获取被动产出速率（招贤令/秒） */
  getPassiveRate(): number {
    return PASSIVE_RATE_PER_SECOND;
  }

  /** 获取离线收益效率 */
  getOfflineEfficiency(): number {
    return OFFLINE_EFFICIENCY;
  }

  // ─────────────────────────────────────────
  // 9. 序列化 / 反序列化
  // ─────────────────────────────────────────

  /** 序列化为存档数据 */
  serialize(): RecruitTokenEconomySaveData {
    return {
      version: SAVE_VERSION,
      newbiePackClaimed: this.newbiePackClaimed,
      dailyShopPurchased: this.dailyShopPurchased,
      lastResetDate: this.lastResetDate,
      dailyTaskClaimed: this.dailyTaskClaimed,
      clearedStages: Array.from(this.clearedStages),
      totalPassiveEarned: this.totalPassiveEarned,
    };
  }

  /** 从存档数据恢复 */
  deserialize(data: RecruitTokenEconomySaveData): void {
    if (data.version !== SAVE_VERSION) {
      // 兼容处理：尝试加载
    }

    this.newbiePackClaimed = data.newbiePackClaimed ?? false;
    this.dailyShopPurchased = data.dailyShopPurchased ?? 0;
    this.lastResetDate = data.lastResetDate ?? '';
    this.dailyTaskClaimed = data.dailyTaskClaimed ?? false;
    this.clearedStages = new Set(data.clearedStages ?? []);
    this.totalPassiveEarned = data.totalPassiveEarned ?? 0;
  }

  // ─────────────────────────────────────────
  // 10. 内部方法
  // ─────────────────────────────────────────

  /** 检查并执行每日重置 */
  private checkDailyReset(): void {
    const today = todayDateString();
    if (this.lastResetDate !== today) {
      this.dailyShopPurchased = 0;
      this.dailyTaskClaimed = false;
      this.lastResetDate = today;
    }
  }
}
