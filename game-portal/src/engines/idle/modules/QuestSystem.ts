/**
 * QuestSystem — 放置游戏任务系统核心模块
 *
 * 提供任务注册、接取、条件跟踪、完成判定、奖励发放、
 * 日常/周常刷新等完整任务功能。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 事件驱动，支持 UI 层监听任务状态变化
 * - 完整的存档/读档支持
 * - 支持多种任务类型（日常、周常、主线、成就）
 *
 * @module engines/idle/modules/QuestSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 任务类型 */
export type QuestType = 'daily' | 'weekly' | 'main' | 'achievement';

/** 任务条件类型 */
export type QuestConditionType =
  | 'build'
  | 'defeat'
  | 'collect'
  | 'upgrade'
  | 'prestige'
  | 'reach_stage'
  | 'custom';

/** 单个任务条件 */
export interface QuestCondition {
  /** 条件类型 */
  type: QuestConditionType;
  /** 目标对象 ID（如建筑ID、敌人ID、资源ID） */
  targetId: string;
  /** 需要达成的数量 */
  requiredCount: number;
}

/** 任务奖励 */
export interface QuestReward {
  /** 奖励类型 */
  type: 'resource' | 'item' | 'building' | 'character' | 'skin';
  /** 奖励对象 ID */
  id: string;
  /** 奖励数量 */
  amount: number;
}

/** 任务定义 */
export interface QuestDef {
  /** 任务唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 任务描述 */
  description: string;
  /** 任务类型 */
  type: QuestType;
  /** 完成条件列表（全部满足才算完成） */
  conditions: QuestCondition[];
  /** 任务奖励列表 */
  rewards: QuestReward[];
  /** 前置任务 ID（完成后才可接取） */
  prerequisiteQuest?: string;
  /** 是否自动接取（默认 false） */
  autoAccept?: boolean;
  /** 任务过期时间戳（0 表示不过期） */
  expiresAt?: number;
  /** 排序权重（越大越靠前） */
  priority?: number;
}

/** 任务运行时状态 */
export interface QuestState {
  /** 关联的任务定义 ID */
  defId: string;
  /** 是否已接取 */
  accepted: boolean;
  /** 是否已完成（条件达成） */
  completed: boolean;
  /** 是否已领取奖励 */
  claimed: boolean;
  /** 各条件当前进度：targetId → currentCount */
  progress: Record<string, number>;
  /** 接取时间戳 */
  acceptedAt: number;
  /** 完成时间戳 */
  completedAt: number;
}

/** 任务系统事件 */
export type QuestEvent =
  | { type: 'quest_accepted'; questId: string }
  | { type: 'quest_progress'; questId: string; targetId: string; current: number; required: number }
  | { type: 'quest_completed'; questId: string }
  | { type: 'quest_reward_claimed'; questId: string }
  | { type: 'quests_refreshed'; questType: QuestType; count: number };

/** 任务系统配置 */
export interface QuestSystemConfig {
  /** 每日任务刷新时间（小时，默认 0 = 午夜） */
  dailyRefreshHour?: number;
  /** 每周任务刷新星期（0=周日, 1=周一, 默认 1） */
  weeklyRefreshDay?: number;
}

/** 事件监听器函数类型 */
export type QuestEventListener = (event: QuestEvent) => void;

// ============================================================
// QuestSystem 实现
// ============================================================

/**
 * 任务系统 — 管理任务注册、接取、条件跟踪、完成判定、奖励发放
 *
 * @example
 * ```typescript
 * const questSystem = new QuestSystem();
 * questSystem.register([
 *   {
 *     id: 'daily_build_5',
 *     name: '建造大师',
 *     description: '建造 5 个建筑',
 *     type: 'daily',
 *     conditions: [{ type: 'build', targetId: 'any', requiredCount: 5 }],
 *     rewards: [{ type: 'resource', id: 'gold', amount: 100 }],
 *     autoAccept: true,
 *   },
 * ]);
 * questSystem.acceptQuest('daily_build_5');
 * questSystem.updateProgress('build', 'any', 3);
 * ```
 */
export class QuestSystem {

  // ========== 内部数据 ==========

  /** 任务定义注册表：defId → QuestDef */
  private readonly defs: Map<string, QuestDef> = new Map();

  /** 任务运行时状态：defId → QuestState */
  private readonly states: Map<string, QuestState> = new Map();

  /** 事件监听器列表 */
  private readonly listeners: QuestEventListener[] = [];

  /** 系统配置 */
  private readonly config: Required<QuestSystemConfig>;

  /** 上次日常刷新日期（YYYY-MM-DD） */
  private lastDailyRefresh: string = '';

  /** 上次周常刷新日期（YYYY-MM-DD） */
  private lastWeeklyRefresh: string = '';

  // ============================================================
  // 初始化
  // ============================================================

  constructor(config: QuestSystemConfig = {}) {
    this.config = {
      dailyRefreshHour: config.dailyRefreshHour ?? 0,
      weeklyRefreshDay: config.weeklyRefreshDay ?? 1,
    };
  }

  /**
   * 注册任务定义列表
   *
   * 重复注册同一 ID 会覆盖之前的定义。自动接取的任务会立即创建状态。
   *
   * @param quests - 任务定义数组
   */
  register(quests: QuestDef[]): void {
    for (const def of quests) {
      this.defs.set(def.id, def);

      // 自动接取的任务直接创建状态
      if (def.autoAccept && !this.states.has(def.id)) {
        this.createState(def.id, true);
      }
    }
  }

  /**
   * 从存档恢复任务状态
   *
   * @param data - 存档数据
   */
  loadState(data: {
    states: Record<string, { accepted: boolean; completed: boolean; claimed: boolean; progress: Record<string, number>; acceptedAt: number; completedAt: number }>;
    lastDailyRefresh?: string;
    lastWeeklyRefresh?: string;
  }): void {
    for (const [id, saved] of Object.entries(data.states)) {
      if (this.defs.has(id)) {
        this.states.set(id, {
          defId: id,
          accepted: saved.accepted,
          completed: saved.completed,
          claimed: saved.claimed,
          progress: { ...saved.progress },
          acceptedAt: saved.acceptedAt,
          completedAt: saved.completedAt,
        });
      }
    }
    if (data.lastDailyRefresh) this.lastDailyRefresh = data.lastDailyRefresh;
    if (data.lastWeeklyRefresh) this.lastWeeklyRefresh = data.lastWeeklyRefresh;
  }

  /**
   * 导出当前状态用于存档
   */
  saveState(): {
    states: Record<string, { accepted: boolean; completed: boolean; claimed: boolean; progress: Record<string, number>; acceptedAt: number; completedAt: number }>;
    lastDailyRefresh: string;
    lastWeeklyRefresh: string;
  } {
    const states: Record<string, { accepted: boolean; completed: boolean; claimed: boolean; progress: Record<string, number>; acceptedAt: number; completedAt: number }> = {};
    for (const [id, state] of this.states) {
      states[id] = {
        accepted: state.accepted,
        completed: state.completed,
        claimed: state.claimed,
        progress: { ...state.progress },
        acceptedAt: state.acceptedAt,
        completedAt: state.completedAt,
      };
    }
    return { states, lastDailyRefresh: this.lastDailyRefresh, lastWeeklyRefresh: this.lastWeeklyRefresh };
  }

  // ============================================================
  // 查询
  // ============================================================

  /**
   * 获取所有已注册的任务定义
   */
  get quests(): QuestDef[] {
    return Array.from(this.defs.values());
  }

  /**
   * 获取已接取但未完成的任务
   */
  get activeQuests(): QuestDef[] {
    const result: QuestDef[] = [];
    for (const [id, state] of this.states) {
      if (state.accepted && !state.completed) {
        const def = this.defs.get(id);
        if (def) result.push(def);
      }
    }
    return result;
  }

  /**
   * 获取已完成（含已领奖）的任务
   */
  get completedQuests(): QuestDef[] {
    const result: QuestDef[] = [];
    for (const [id, state] of this.states) {
      if (state.completed) {
        const def = this.defs.get(id);
        if (def) result.push(def);
      }
    }
    return result;
  }

  /**
   * 获取可接取的任务（未接取且前置任务已完成）
   */
  getAvailableQuests(): QuestDef[] {
    const result: QuestDef[] = [];
    for (const [id, def] of this.defs) {
      const state = this.states.get(id);
      if (state?.accepted) continue;

      // 检查前置任务
      if (def.prerequisiteQuest) {
        const preState = this.states.get(def.prerequisiteQuest);
        if (!preState?.completed) continue;
      }

      result.push(def);
    }
    return result;
  }

  /**
   * 获取指定任务定义
   */
  getDef(id: string): QuestDef | undefined {
    return this.defs.get(id);
  }

  /**
   * 获取指定任务的状态
   */
  getState(id: string): QuestState | undefined {
    return this.states.get(id);
  }

  /**
   * 获取指定任务的进度百分比
   */
  getProgress(id: string): number {
    const def = this.defs.get(id);
    const state = this.states.get(id);
    if (!def || !state) return 0;

    let totalProgress = 0;
    for (const cond of def.conditions) {
      const current = state.progress[cond.targetId] || 0;
      totalProgress += Math.min(current / cond.requiredCount, 1);
    }
    return totalProgress / def.conditions.length;
  }

  // ============================================================
  // 操作
  // ============================================================

  /**
   * 接取任务
   *
   * @param id - 任务 ID
   * @returns 是否接取成功
   */
  acceptQuest(id: string): boolean {
    const def = this.defs.get(id);
    if (!def) return false;

    // 已接取
    if (this.states.has(id) && this.states.get(id)!.accepted) return false;

    // 检查前置任务
    if (def.prerequisiteQuest) {
      const preState = this.states.get(def.prerequisiteQuest);
      if (!preState?.completed) return false;
    }

    this.createState(id, true);
    this.emitEvent({ type: 'quest_accepted', questId: id });
    return true;
  }

  /**
   * 领取任务奖励
   *
   * @param id - 任务 ID
   * @returns 奖励列表，未完成或已领取返回 null
   */
  claimReward(id: string): QuestReward[] | null {
    const state = this.states.get(id);
    if (!state || !state.completed || state.claimed) return null;

    const def = this.defs.get(id);
    if (!def) return null;

    state.claimed = true;
    this.emitEvent({ type: 'quest_reward_claimed', questId: id });
    return [...def.rewards];
  }

  /**
   * 批量领取所有已完成未领取的奖励
   */
  claimAll(): QuestReward[] {
    const allRewards: QuestReward[] = [];
    for (const [id, state] of this.states) {
      if (state.completed && !state.claimed) {
        const rewards = this.claimReward(id);
        if (rewards) allRewards.push(...rewards);
      }
    }
    return allRewards;
  }

  /**
   * 更新任务进度
   *
   * 通知系统某个条件类型的进度增加了。
   *
   * @param conditionType - 条件类型
   * @param targetId - 目标 ID
   * @param count - 增加的数量（默认 1）
   */
  updateProgress(conditionType: QuestConditionType, targetId: string, count: number = 1): void {
    for (const [id, state] of this.states) {
      if (!state.accepted || state.completed) continue;

      const def = this.defs.get(id);
      if (!def) continue;

      for (const cond of def.conditions) {
        if (cond.type === conditionType && (cond.targetId === targetId || cond.targetId === 'any')) {
          const current = state.progress[cond.targetId] || 0;
          state.progress[cond.targetId] = current + count;

          this.emitEvent({
            type: 'quest_progress',
            questId: id,
            targetId: cond.targetId,
            current: state.progress[cond.targetId],
            required: cond.requiredCount,
          });
        }
      }
    }

    // 进度更新后检查完成
    this.checkCompletion();
  }

  /**
   * 检查所有活跃任务的完成状态
   *
   * @returns 本次新完成的任务 ID 列表
   */
  checkCompletion(): string[] {
    const newlyCompleted: string[] = [];

    for (const [id, state] of this.states) {
      if (!state.accepted || state.completed) continue;

      const def = this.defs.get(id);
      if (!def) continue;

      const allMet = def.conditions.every((cond) => {
        const current = state.progress[cond.targetId] || 0;
        return current >= cond.requiredCount;
      });

      if (allMet) {
        state.completed = true;
        state.completedAt = Date.now();
        newlyCompleted.push(id);
        this.emitEvent({ type: 'quest_completed', questId: id });
      }
    }

    return newlyCompleted;
  }

  /**
   * 刷新日常任务
   *
   * 重置所有日常任务的状态，使其可以重新接取。
   *
   * @returns 重置的任务 ID 列表
   */
  refreshDaily(): string[] {
    const refreshed: string[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const [id, def] of this.defs) {
      if (def.type !== 'daily') continue;

      this.states.delete(id);
      if (def.autoAccept) {
        this.createState(id, true);
      }
      refreshed.push(id);
    }

    this.lastDailyRefresh = today;
    this.emitEvent({ type: 'quests_refreshed', questType: 'daily', count: refreshed.length });
    return refreshed;
  }

  /**
   * 刷新周常任务
   *
   * @returns 重置的任务 ID 列表
   */
  refreshWeekly(): string[] {
    const refreshed: string[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const [id, def] of this.defs) {
      if (def.type !== 'weekly') continue;

      this.states.delete(id);
      if (def.autoAccept) {
        this.createState(id, true);
      }
      refreshed.push(id);
    }

    this.lastWeeklyRefresh = today;
    this.emitEvent({ type: 'quests_refreshed', questType: 'weekly', count: refreshed.length });
    return refreshed;
  }

  // ============================================================
  // 事件
  // ============================================================

  /**
   * 注册事件监听器
   */
  onEvent(listener: QuestEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * 移除事件监听器
   */
  offEvent(listener: QuestEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  // ============================================================
  // 重置
  // ============================================================

  /**
   * 重置任务系统
   *
   * 清除所有任务状态，保留注册的定义。
   */
  reset(): void {
    this.states.clear();
    this.lastDailyRefresh = '';
    this.lastWeeklyRefresh = '';

    // 重新自动接取
    for (const [id, def] of this.defs) {
      if (def.autoAccept) {
        this.createState(id, true);
      }
    }
  }

  // ============================================================
  // 内部工具
  // ============================================================

  /**
   * 创建任务运行时状态
   */
  private createState(defId: string, accepted: boolean): void {
    this.states.set(defId, {
      defId,
      accepted,
      completed: false,
      claimed: false,
      progress: {},
      acceptedAt: accepted ? Date.now() : 0,
      completedAt: 0,
    });
  }

  /**
   * 向所有监听器派发事件
   */
  private emitEvent(event: QuestEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (_error) {
        // 监听器异常不应中断系统流程
      }
    }
  }
}
