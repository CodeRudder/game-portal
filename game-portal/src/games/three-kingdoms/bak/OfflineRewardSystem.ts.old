/**
 * 三国霸业 — 离线收益 & 回归奖励系统
 *
 * 当玩家重新上线时，根据离线时长计算离线期间的资源收益，
 * 并在离线超过阈值时触发回归奖励（额外倍率加成）。
 *
 * 设计：
 * - 最大离线收益时长：24小时（超时部分收益递减）
 *   - 0~24h：100% 收益
 *   - 24~48h：50% 收益
 *   - 48h+：10% 收益
 * - 回归奖励阈值：24小时（离线超过 24h 触发回归奖励，3x 倍率）
 * - 离线事件：每 4 小时随机触发 1 个（粮草丰收/商队到访/矿脉发现等）
 *
 * @module games/three-kingdoms/OfflineRewardSystem
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 离线收益结果 */
export interface OfflineReward {
  /** 离线时长（分钟） */
  offlineMinutes: number;
  /** 获得的资源（资源ID → 数量） */
  resources: Record<string, number>;
  /** 离线期间触发的事件列表 */
  events: OfflineEvent[];
  /** 是否为回归奖励（离线 > 24h） */
  isReturnReward: boolean;
  /** 回归奖励倍率（非回归时为 1） */
  returnBonusMultiplier: number;
}

/** 离线事件 */
export interface OfflineEvent {
  /** 事件描述 */
  description: string;
  /** 事件奖励（资源ID → 数量） */
  reward: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

/** 离线事件模板表 */
const OFFLINE_EVENT_TEMPLATES: { description: string; reward: Record<string, number> }[] = [
  { description: '🌾 粮草丰收：风调雨顺，粮仓满溢！', reward: { grain: 500 } },
  { description: '🐪 商队到访：西域商队带来珍贵货物！', reward: { gold: 300 } },
  { description: '⛏️ 矿脉发现：探子发现了一处富矿！', reward: { gold: 200, grain: 200 } },
  { description: '🏹 义军投奔：四方义士慕名而来！', reward: { troops: 150 } },
  { description: '📚 典籍出土：古墓中发现了兵法残卷！', reward: { techPoints: 100 } },
  { description: '🎭 民心所向：百姓安居乐业，声望大增！', reward: { destiny: 50 } },
  { description: '🏥 瘟疫退散：疫病终于过去，人口恢复！', reward: { grain: 300, troops: 100 } },
  { description: '🌊 漕运畅通：水路贸易带来丰厚利润！', reward: { gold: 400 } },
];

/** 收益递减阈值（小时） */
const TIER1_HOURS = 24;
const TIER2_HOURS = 48;

/** 收益递减倍率 */
const TIER1_MULT = 1.0;
const TIER2_MULT = 0.5;
const TIER3_MULT = 0.1;

/** 离线事件触发间隔（小时） */
const EVENT_INTERVAL_HOURS = 4;

// ═══════════════════════════════════════════════════════════════
// OfflineRewardSystem 类
// ═══════════════════════════════════════════════════════════════

export class OfflineRewardSystem {
  /** 最大离线收益时长（小时），超过此值后收益递减 */
  private maxOfflineHours: number;
  /** 回归奖励阈值（小时），超过此值触发回归奖励 */
  private returnThresholdHours: number;
  /** 回归奖励倍率 */
  private returnBonusMultiplier: number;

  constructor() {
    this.maxOfflineHours = TIER1_HOURS;
    this.returnThresholdHours = TIER1_HOURS;
    this.returnBonusMultiplier = 3;
  }

  // ───────────────────────────────────────────────────────────
  // 核心计算
  // ───────────────────────────────────────────────────────────

  /**
   * 计算离线收益
   *
   * @param offlineMinutes 离线时长（分钟）
   * @param productionPerSecond 每秒产出（资源ID → 产出速率）
   * @returns 离线收益结果
   */
  calculateReward(
    offlineMinutes: number,
    productionPerSecond: Record<string, number>,
  ): OfflineReward {
    const offlineHours = offlineMinutes / 60;
    const isReturnReward = offlineHours > this.returnThresholdHours;
    const returnBonus = isReturnReward ? this.returnBonusMultiplier : 1;

    // 计算有效收益时长（分段递减）
    const effectiveHours = this.calculateEffectiveHours(offlineHours);

    // 计算资源收益
    const resources: Record<string, number> = {};
    const totalSeconds = effectiveHours * 3600;

    for (const [resId, rate] of Object.entries(productionPerSecond)) {
      if (rate > 0) {
        resources[resId] = Math.floor(rate * totalSeconds * returnBonus);
      }
    }

    // 生成离线事件
    const events = this.generateOfflineEvents(offlineMinutes);

    return {
      offlineMinutes,
      resources,
      events,
      isReturnReward,
      returnBonusMultiplier: returnBonus,
    };
  }

  // ───────────────────────────────────────────────────────────
  // 离线事件
  // ───────────────────────────────────────────────────────────

  /**
   * 生成离线期间随机触发的事件
   *
   * 每 4 小时触发 1 个随机事件，事件奖励独立于基础收益。
   *
   * @param offlineMinutes 离线时长（分钟）
   * @returns 离线事件列表
   */
  generateOfflineEvents(offlineMinutes: number): OfflineEvent[] {
    const offlineHours = offlineMinutes / 60;
    const eventCount = Math.floor(offlineHours / EVENT_INTERVAL_HOURS);

    if (eventCount <= 0) return [];

    const events: OfflineEvent[] = [];
    const used = new Set<number>();

    for (let i = 0; i < Math.min(eventCount, OFFLINE_EVENT_TEMPLATES.length); i++) {
      // 随机选取不重复的事件
      let idx: number;
      do {
        idx = Math.floor(Math.random() * OFFLINE_EVENT_TEMPLATES.length);
      } while (used.has(idx) && used.size < OFFLINE_EVENT_TEMPLATES.length);

      used.add(idx);
      const template = OFFLINE_EVENT_TEMPLATES[idx];
      events.push({
        description: template.description,
        reward: { ...template.reward },
      });
    }

    return events;
  }

  // ───────────────────────────────────────────────────────────
  // 序列化
  // ───────────────────────────────────────────────────────────

  serialize(): object {
    return {
      maxOfflineHours: this.maxOfflineHours,
      returnThresholdHours: this.returnThresholdHours,
      returnBonusMultiplier: this.returnBonusMultiplier,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    if (typeof data.maxOfflineHours === 'number') {
      this.maxOfflineHours = data.maxOfflineHours;
    }
    if (typeof data.returnThresholdHours === 'number') {
      this.returnThresholdHours = data.returnThresholdHours;
    }
    if (typeof data.returnBonusMultiplier === 'number') {
      this.returnBonusMultiplier = data.returnBonusMultiplier;
    }
  }

  // ───────────────────────────────────────────────────────────
  // 私有工具方法
  // ───────────────────────────────────────────────────────────

  /**
   * 分段计算有效收益时长
   *
   * - 0~24h：100% 计入
   * - 24~48h：50% 计入
   * - 48h+：10% 计入
   */
  private calculateEffectiveHours(offlineHours: number): number {
    if (offlineHours <= TIER1_HOURS) {
      return offlineHours * TIER1_MULT;
    }
    if (offlineHours <= TIER2_HOURS) {
      return TIER1_HOURS * TIER1_MULT
        + (offlineHours - TIER1_HOURS) * TIER2_MULT;
    }
    return TIER1_HOURS * TIER1_MULT
      + (TIER2_HOURS - TIER1_HOURS) * TIER2_MULT
      + (offlineHours - TIER2_HOURS) * TIER3_MULT;
  }
}
