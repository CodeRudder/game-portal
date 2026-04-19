/**
 * 离线奖励计算器
 *
 * 计算玩家离线期间的资源收益，采用分段衰减算法：
 * 离线时间越长，效率越低，防止无限挂机收益过高。
 *
 * 衰减规则：
 *   0 ~ 2h   → 100% 效率
 *   2 ~ 8h   →  80% 效率
 *   8 ~ 24h  →  60% 效率
 *  24 ~ 48h  →  40% 效率
 *  48 ~ 72h  →  25% 效率
 *  > 72h     →   0% 效率（不再产生收益）
 *
 * @module core/save/OfflineRewardCalculator
 */

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 最大离线收益时长（秒）：72 小时 */
const MAX_OFFLINE_SECONDS = 72 * 3600;

/**
 * 衰减分段表
 *
 * 每个分段定义：[累计时长上限（秒）, 效率百分比]
 * 按时长升序排列，用于逐段计算收益。
 */
const DECAY_TIERS: ReadonlyArray<readonly [number, number]> = [
  [2 * 3600, 1.0],   // 0~2h:   100%
  [8 * 3600, 0.8],   // 2~8h:    80%
  [24 * 3600, 0.6],  // 8~24h:   60%
  [48 * 3600, 0.4],  // 24~48h:  40%
  [72 * 3600, 0.25], // 48~72h:  25%
] as const;

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/**
 * 离线收益计算结果
 */
export interface OfflineRewards {
  /** 各资源获得的数量 */
  resources: Record<string, number>;
  /** 综合效率（0~1），用于 UI 显示 */
  efficiency: number;
}

// ─────────────────────────────────────────────
// 离线奖励计算器
// ─────────────────────────────────────────────

/**
 * 离线奖励计算器
 *
 * 纯静态工具类，提供离线时长计算、收益计算和格式化显示。
 * 所有方法均为纯函数，无副作用。
 *
 * @example
 * ```ts
 * // 计算离线时长
 * const offlineSeconds = OfflineRewardCalculator.calculateOfflineTime(lastSaveTime);
 *
 * // 计算离线收益
 * const rewards = OfflineRewardCalculator.calculateRewards(
 *   { gold: 100, wood: 50, food: 80 },
 *   offlineSeconds,
 * );
 * // rewards = { resources: { gold: 720000, wood: 360000, ... }, efficiency: 0.85 }
 *
 * // 格式化显示
 * const display = OfflineRewardCalculator.formatOfflineTime(offlineSeconds);
 * // display = "2小时30分钟"
 * ```
 */
export class OfflineRewardCalculator {
  /**
   * 计算离线时长
   *
   * 根据上次保存时间戳计算到当前时刻的离线秒数。
   * 结果被限制在 [0, MAX_OFFLINE_SECONDS] 范围内。
   *
   * @param lastSaveTime - 上次保存的 Unix 时间戳（毫秒）
   * @returns 离线秒数（非负，上限 72 小时）
   */
  static calculateOfflineTime(lastSaveTime: number): number {
    const now = Date.now();
    const diffMs = now - lastSaveTime;

    // 尚未离线或时间异常（未来时间）
    if (diffMs <= 0) return 0;

    const seconds = Math.floor(diffMs / 1000);
    return Math.min(seconds, MAX_OFFLINE_SECONDS);
  }

  /**
   * 计算离线收益（带分段衰减）
   *
   * 根据各资源的每秒产出速率和离线时长，按衰减分段计算实际收益。
   * 每个分段独立计算，收益 = 速率 × 分段时长 × 分段效率。
   *
   * @param productionRates - 各资源的每秒产出速率，如 { gold: 100, wood: 50 }
   * @param offlineSeconds - 离线秒数
   * @returns 离线收益结果
   *
   * @example
   * ```ts
   * // 离线 3 小时，金矿产出 10/秒
   * const result = OfflineRewardCalculator.calculateRewards(
   *   { gold: 10 },
   *   3 * 3600,
   * );
   * // 前 2h: 10 * 7200 * 1.0 = 72000
   * // 后 1h: 10 * 3600 * 0.8 = 28800
   * // 总计: 100800, 效率: 100800 / (10 * 10800) ≈ 0.933
   * ```
   */
  static calculateRewards(
    productionRates: Record<string, number>,
    offlineSeconds: number,
  ): OfflineRewards {
    if (offlineSeconds <= 0 || !productionRates) {
      return { resources: {}, efficiency: 0 };
    }

    const clampedSeconds = Math.min(offlineSeconds, MAX_OFFLINE_SECONDS);

    // 逐段计算有效产出时间
    let remainingSeconds = clampedSeconds;
    let prevTierEnd = 0;
    let totalEffectiveSeconds = 0;

    for (const [tierEnd, efficiency] of DECAY_TIERS) {
      if (remainingSeconds <= 0) break;

      const tierDuration = Math.min(remainingSeconds, tierEnd - prevTierEnd);
      totalEffectiveSeconds += tierDuration * efficiency;
      remainingSeconds -= tierDuration;
      prevTierEnd = tierEnd;
    }

    // 综合效率 = 有效时间 / 实际时间
    const overallEfficiency =
      clampedSeconds > 0 ? totalEffectiveSeconds / clampedSeconds : 0;

    // 计算各资源收益
    const resources: Record<string, number> = {};
    for (const [resource, rate] of Object.entries(productionRates)) {
      if (rate > 0) {
        resources[resource] = Math.floor(rate * totalEffectiveSeconds);
      }
    }

    return {
      resources,
      efficiency: Math.round(overallEfficiency * 10000) / 10000, // 保留4位小数
    };
  }

  /**
   * 格式化离线时间为可读字符串
   *
   * 将秒数转换为人类友好的时间描述，如 "2小时30分钟"。
   * 自动选择合适的单位组合。
   *
   * @param seconds - 离线秒数
   * @returns 格式化后的时间字符串
   *
   * @example
   * ```ts
   * formatOfflineTime(90);         // "1分钟"
   * formatOfflineTime(3661);       // "1小时1分钟"
   * formatOfflineTime(90000);      // "1天1小时"
   * formatOfflineTime(0);          // "刚刚"
   * ```
   */
  static formatOfflineTime(seconds: number): string {
    if (seconds <= 0) return '刚刚';
    if (seconds < 60) return `${Math.floor(seconds)}秒`;

    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    // 超过 1 天：显示 "X天X小时"
    if (days > 0) {
      const remainHours = hours % 24;
      return remainHours > 0 ? `${days}天${remainHours}小时` : `${days}天`;
    }

    // 超过 1 小时：显示 "X小时X分钟"
    if (hours > 0) {
      const remainMinutes = minutes % 60;
      return remainMinutes > 0 ? `${hours}小时${remainMinutes}分钟` : `${hours}小时`;
    }

    // 不足 1 小时：显示 "X分钟"
    return `${minutes}分钟`;
  }

  /**
   * 获取指定离线时长的效率百分比
   *
   * 用于 UI 显示"当前效率"提示。
   *
   * @param offlineSeconds - 离线秒数
   * @returns 效率百分比（0~100）
   */
  static getEfficiencyPercent(offlineSeconds: number): number {
    if (offlineSeconds <= 0) return 100;

    let remaining = Math.min(offlineSeconds, MAX_OFFLINE_SECONDS);
    let prevTierEnd = 0;
    let totalEffective = 0;

    for (const [tierEnd, efficiency] of DECAY_TIERS) {
      if (remaining <= 0) break;
      const tierDuration = Math.min(remaining, tierEnd - prevTierEnd);
      totalEffective += tierDuration * efficiency;
      remaining -= tierDuration;
      prevTierEnd = tierEnd;
    }

    return Math.round((totalEffective / Math.min(offlineSeconds, MAX_OFFLINE_SECONDS)) * 100);
  }
}
