/**
 * PrestigeSystem — 放置游戏声望系统核心模块
 *
 * 提供声望货币计算、执行、预览、状态管理等完整功能。
 * 声望系统是放置游戏的核心循环机制，允许玩家重置进度以获取
 * 永久性增益（产出倍率），从而加速后续游戏进程。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 对数公式计算声望货币获取量，确保数值平衡
 * - 完整的存档/读档支持
 * - 预览机制，允许 UI 展示声望执行前的预期收益
 *
 * @module engines/idle/modules/PrestigeSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 声望配置 */
export interface PrestigeConfig {
  /** 声望货币名称（如 "声望点"、"星尘"） */
  currencyName: string;
  /** 声望货币图标（emoji 或图标标识） */
  currencyIcon: string;
  /** 计算公式基数（对数底数等效参数，影响获取曲线） */
  base: number;
  /** 最低触发阈值：总资源低于此值时无法声望 */
  threshold: number;
  /** 每点声望货币提供的产出倍率增量 */
  bonusMultiplier: number;
  /** 资源保留比例（0~1），声望后保留的资源占比 */
  retention: number;
  /** 离线收益加成：每点声望货币提供的离线收益额外比例 */
  offlineBonusPerPoint?: number;
}

/** 声望状态 */
export interface PrestigeState {
  /** 声望货币数量 */
  currency: number;
  /** 累计声望次数 */
  count: number;
  /** 当前总产出倍率（1 + currency * bonusMultiplier） */
  multiplier: number;
  /** 历史最高单次声望货币获取量 */
  bestGain: number;
}

/** 声望预览信息 */
export interface PrestigePreview {
  /** 当前资源是否满足声望条件 */
  canPrestige: boolean;
  /** 本次声望可获得的声望货币数量 */
  gain: number;
  /** 声望后的新总产出倍率 */
  newMultiplier: number;
  /** 倍率增量（newMultiplier - 当前 multiplier） */
  multiplierIncrease: number;
  /** 资源保留比例 */
  retentionRate: number;
  /** 警告信息（如收益过低等） */
  warning?: string;
}

/** 声望执行结果 */
export interface PrestigeResult {
  /** 本次获得的声望货币数量 */
  gainedCurrency: number;
  /** 声望后的新状态快照 */
  newState: PrestigeState;
  /** 本次声望的资源保留比例 */
  retentionRate: number;
}

// ============================================================
// PrestigeSystem 实现
// ============================================================

/**
 * 声望系统 — 管理声望货币计算、执行与状态
 *
 * 核心公式：gain = floor(log(threshold + totalResource) / log(base))
 *                  - floor(log(threshold) / log(base))
 *
 * 该公式确保：
 * - 当 totalResource = 0 时 gain = 0（无法获得声望货币）
 * - gain 随 totalResource 增长而增长，但增速递减（对数曲线）
 * - threshold 越大，获得第一点声望货币所需的资源越多
 *
 * @example
 * ```typescript
 * const prestige = new PrestigeSystem({
 *   currencyName: '星尘',
 *   currencyIcon: '✨',
 *   base: 10,
 *   threshold: 100,
 *   bonusMultiplier: 0.25,
 *   retention: 0.1,
 * });
 *
 * // 检查是否可声望
 * if (prestige.canPrestige(totalResource)) {
 *   const result = prestige.doPrestige(totalResource);
 *   // result.gainedCurrency → 获得的声望货币
 *   // result.newState.multiplier → 新的产出倍率
 * }
 * ```
 */
export class PrestigeSystem {

  // ========== 内部数据 ==========

  /** 声望配置（只读快照） */
  private readonly config: PrestigeConfig;

  /** 当前声望状态 */
  private state: PrestigeState;

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 创建声望系统实例
   *
   * @param config - 声望配置参数
   */
  constructor(config: PrestigeConfig) {
    this.config = {
      currencyName: config.currencyName,
      currencyIcon: config.currencyIcon,
      base: config.base,
      threshold: config.threshold,
      bonusMultiplier: config.bonusMultiplier,
      retention: config.retention,
      offlineBonusPerPoint: config.offlineBonusPerPoint,
    };

    this.state = {
      currency: 0,
      count: 0,
      multiplier: 1,
      bestGain: 0,
    };
  }

  // ============================================================
  // 查询
  // ============================================================

  /**
   * 检查是否满足声望条件
   *
   * 条件：总资源 >= 配置的最低阈值。
   *
   * @param totalResource - 玩家当前的总资源数量
   * @returns 是否可以执行声望
   */
  canPrestige(totalResource: number): boolean {
    return totalResource >= this.config.threshold;
  }

  /**
   * 计算给定总资源可获得的声望货币数量
   *
   * 公式：floor(log(threshold + total) / log(base))
   *       - floor(log(threshold) / log(base))
   *
   * 当 totalResource <= 0 时返回 0。
   *
   * @param totalResource - 玩家当前的总资源数量
   * @returns 可获得的声望货币数量（向下取整）
   */
  calculateGain(totalResource: number): number {
    if (totalResource <= 0) {
      return 0;
    }

    const { base, threshold } = this.config;
    const logBase = Math.log(base);
    const currentLevel = Math.floor(Math.log(threshold + totalResource) / logBase);
    const baseLevel = Math.floor(Math.log(threshold) / logBase);

    const gain = currentLevel - baseLevel;

    // 确保不返回负数（防御性编程）
    return Math.max(0, gain);
  }

  /**
   * 获取当前总产出倍率
   *
   * 公式：1 + currency * bonusMultiplier
   *
   * @returns 当前产出倍率
   */
  getMultiplier(): number {
    return 1 + this.state.currency * this.config.bonusMultiplier;
  }

  /**
   * 获取声望预览信息
   *
   * 提供完整的预览数据供 UI 展示，包含：
   * - 是否满足声望条件
   * - 预期获得的声望货币
   * - 新的产出倍率及增量
   * - 资源保留比例
   * - 警告信息（收益过低或首次声望等）
   *
   * @param totalResource - 玩家当前的总资源数量
   * @returns 声望预览信息
   */
  getPreview(totalResource: number): PrestigePreview {
    const gain = this.calculateGain(totalResource);
    const canPrestige = this.canPrestige(totalResource) && gain > 0;
    const currentMultiplier = this.getMultiplier();
    const newCurrency = this.state.currency + gain;
    const newMultiplier = 1 + newCurrency * this.config.bonusMultiplier;
    const multiplierIncrease = newMultiplier - currentMultiplier;

    // 生成警告信息
    let warning: string | undefined;

    if (!this.canPrestige(totalResource)) {
      warning = `资源未达到声望阈值 ${this.config.threshold}`;
    } else if (gain === 0) {
      warning = '当前资源不足以获得任何声望货币';
    } else if (gain <= this.state.bestGain * 0.1 && this.state.count > 0) {
      warning = '本次声望收益远低于历史最高，建议继续积累资源';
    } else if (this.state.count === 0 && canPrestige) {
      warning = '首次声望！重置后所有资源将按保留比例折算';
    }

    return {
      canPrestige,
      gain,
      newMultiplier,
      multiplierIncrease,
      retentionRate: this.config.retention,
      warning,
    };
  }

  /**
   * 获取当前声望状态快照
   *
   * 返回状态的浅拷贝，外部修改不会影响内部状态。
   *
   * @returns 当前声望状态
   */
  getState(): PrestigeState {
    return {
      currency: this.state.currency,
      count: this.state.count,
      multiplier: this.state.multiplier,
      bestGain: this.state.bestGain,
    };
  }

  // ============================================================
  // 操作
  // ============================================================

  /**
   * 执行声望
   *
   * 执行流程：
   * 1. 检查是否满足声望条件
   * 2. 计算声望货币获取量
   * 3. 更新内部状态（累加货币、次数、更新倍率和历史最高）
   * 4. 返回执行结果
   *
   * 注意：此方法仅更新声望系统内部状态。
   * 资源重置（按保留比例折算）需由调用方（如 IdleGameEngine）处理。
   *
   * @param totalResource - 玩家当前的总资源数量
   * @returns 声望执行结果，不满足条件时返回 null
   */
  doPrestige(totalResource: number): PrestigeResult | null {
    // 前置检查：是否可声望
    if (!this.canPrestige(totalResource)) {
      return null;
    }

    // 计算本次声望货币获取量
    const gainedCurrency = this.calculateGain(totalResource);

    // 获取量为 0 时也不执行声望
    if (gainedCurrency <= 0) {
      return null;
    }

    // 更新状态
    this.state.currency += gainedCurrency;
    this.state.count += 1;
    this.state.multiplier = this.getMultiplier();

    // 更新历史最高获取量
    if (gainedCurrency > this.state.bestGain) {
      this.state.bestGain = gainedCurrency;
    }

    return {
      gainedCurrency,
      newState: this.getState(),
      retentionRate: this.config.retention,
    };
  }

  /**
   * 从存档恢复声望状态
   *
   * 支持部分恢复：仅更新传入的字段，未传入的字段保持当前值。
   * multiplier 会在恢复后根据 currency 和 bonusMultiplier 重新计算。
   *
   * @param state - 要恢复的状态字段（部分或全部）
   */
  loadState(state: Partial<PrestigeState>): void {
    if (state.currency !== undefined) {
      this.state.currency = state.currency;
    }
    if (state.count !== undefined) {
      this.state.count = state.count;
    }
    if (state.bestGain !== undefined) {
      this.state.bestGain = state.bestGain;
    }

    // multiplier 始终根据 currency 重新计算，确保一致性
    this.state.multiplier = this.getMultiplier();
  }

  /**
   * 完全重置声望系统
   *
   * 将所有状态恢复到初始值：
   * - currency → 0
   * - count → 0
   * - multiplier → 1
   * - bestGain → 0
   */
  reset(): void {
    this.state = {
      currency: 0,
      count: 0,
      multiplier: 1,
      bestGain: 0,
    };
  }

  // ============================================================
  // 配置访问
  // ============================================================

  /**
   * 获取声望货币名称
   *
   * @returns 配置中的货币名称
   */
  getCurrencyName(): string {
    return this.config.currencyName;
  }

  /**
   * 获取声望货币图标
   *
   * @returns 配置中的货币图标
   */
  getCurrencyIcon(): string {
    return this.config.currencyIcon;
  }

  /**
   * 获取资源保留比例
   *
   * @returns 配置中的保留比例（0~1）
   */
  getRetentionRate(): number {
    return this.config.retention;
  }

  /**
   * 计算当前离线收益加成倍率
   *
   * 公式：1 + currency * offlineBonusPerPoint
   * 如果未配置 offlineBonusPerPoint，返回 1（无加成）。
   *
   * @returns 离线收益加成倍率
   */
  getOfflineBonus(): number {
    if (this.config.offlineBonusPerPoint === undefined) {
      return 1;
    }
    return 1 + this.state.currency * this.config.offlineBonusPerPoint;
  }

  /**
   * 获取完整配置的只读快照
   *
   * 用于 UI 展示或调试。
   *
   * @returns 声望配置对象
   */
  getConfig(): PrestigeConfig {
    return { ...this.config };
  }
}
