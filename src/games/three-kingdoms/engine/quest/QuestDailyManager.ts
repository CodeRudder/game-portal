/**
 * 引擎层 — 日常任务管理器
 *
 * 从 QuestSystem.ts 拆分出的日常任务管理逻辑。
 * 职责：每日任务池刷新、20选6随机抽取、过期清理
 *
 * @module engine/quest/QuestDailyManager
 */

import type { QuestDef, QuestInstance, QuestId } from '../../core/quest';
import { DEFAULT_DAILY_POOL_CONFIG, DAILY_QUEST_TEMPLATES } from '../../core/quest';

/** 日常任务管理器配置 */
export interface DailyManagerDeps {
  /** 注册并接受任务，返回实例 */
  registerAndAccept: (def: QuestDef) => QuestInstance | null;
  /** 使旧日常任务过期 */
  expireQuest: (instanceId: string) => void;
  /** 事件发射 */
  emitEvent: (event: string, data: unknown) => void;
}

/**
 * 日常任务管理器
 *
 * 管理每日任务的刷新周期：从20个任务模板池中随机抽取6个。
 * 由 QuestSystem 持有并委托调用。
 */
export class QuestDailyManager {
  private dailyQuestInstanceIds: string[] = [];
  private dailyRefreshDate: string = '';
  private deps: DailyManagerDeps | null = null;

  /** 注入依赖 */
  setDeps(deps: DailyManagerDeps): void {
    this.deps = deps;
  }

  // ─── 查询 ──────────────────────────────────

  /** 获取当前日常任务实例ID列表 */
  getInstanceIds(): string[] {
    return [...this.dailyQuestInstanceIds];
  }

  /** 获取上次刷新日期 */
  getRefreshDate(): string {
    return this.dailyRefreshDate;
  }

  /** 是否今天已刷新 */
  isRefreshedToday(): boolean {
    return this.dailyRefreshDate === QuestDailyManager.computeTodayString();
  }

  // ─── 刷新 ──────────────────────────────────

  /**
   * 刷新日常任务
   *
   * 每日0点从20个任务池中随机抽取6个。
   * 如果当天已刷新则跳过，返回当前实例ID列表。
   *
   * @returns 新创建的任务实例列表
   */
  refresh(): QuestInstance[] {
    if (!this.deps) return [];

    // B-C07 FIX: 使用与 isRefreshedToday 一致的日期计算
    const today = QuestDailyManager.computeTodayString();
    if (this.dailyRefreshDate === today) {
      // 已刷新，返回空（调用方应通过 getInstanceIds 获取）
      return [];
    }

    // 清除旧的日常任务
    for (const id of this.dailyQuestInstanceIds) {
      this.deps.expireQuest(id);
    }

    // 随机抽取（P0-008 FIX: 使用 Fisher-Yates 洗牌替代不安全的 sort+random）
    const config = DEFAULT_DAILY_POOL_CONFIG;
    const pool = [...DAILY_QUEST_TEMPLATES];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, config.dailyPickCount);

    // 注册并接受
    const newInstances: QuestInstance[] = [];
    this.dailyQuestInstanceIds = [];

    for (const def of picked) {
      const instance = this.deps.registerAndAccept(def);
      if (instance) {
        this.dailyQuestInstanceIds.push(instance.instanceId);
        newInstances.push(instance);
      }
    }

    this.dailyRefreshDate = today;

    this.deps.emitEvent('quest:dailyRefreshed', {
      date: today,
      questIds: newInstances.map((i) => i.questDefId),
    });

    return newInstances;
  }

  /** 完全重置 */
  fullReset(): void {
    this.dailyQuestInstanceIds = [];
    this.dailyRefreshDate = '';
  }

  // ─── 序列化辅助 ─────────────────────────────

  /** 从外部恢复状态 */
  restoreState(dailyRefreshDate: string, dailyQuestInstanceIds: string[]): void {
    this.dailyRefreshDate = dailyRefreshDate;
    this.dailyQuestInstanceIds = [...dailyQuestInstanceIds];
  }

  // ─── 内部工具 ──────────────────────────────

  /**
   * 计算当前"游戏日"字符串（考虑 refreshHour）
   * 与 refreshDailyQuestsLogic 使用相同的日期计算逻辑
   */
  private static computeTodayString(): string {
    const config = DEFAULT_DAILY_POOL_CONFIG;
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (now.getHours() < config.refreshHour) {
      todayDate.setDate(todayDate.getDate() - 1);
    }
    return todayDate.toISOString().slice(0, 10);
  }
}
