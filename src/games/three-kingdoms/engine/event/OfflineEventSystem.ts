/**
 * 引擎层 — v15.0 离线事件处理系统
 *
 * 管理玩家离线期间的事件处理：
 *   - 离线事件队列管理
 *   - 自动处理规则匹配
 *   - 按策略自动选择选项
 *   - 事件回溯数据生成
 *   - 资源变化汇总
 *
 * @module engine/event/OfflineEventSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { EventId, EventDef } from '../../core/event';
import type {
  EventCategory,
  OfflineEventEntry,
  AutoProcessRule,
  AutoSelectStrategy,
  OfflineEventProcessResult,
  EventRetrospectiveData,
  OptionConsequence,
} from '../../core/event/event-v15.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 最大离线事件队列容量 */
const MAX_OFFLINE_QUEUE_SIZE = 50;

/** 紧急程度排序权重 */
const URGENCY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** 存档版本 */
const OFFLINE_EVENT_SAVE_VERSION = 15;

// ─────────────────────────────────────────────
// 离线事件系统
// ─────────────────────────────────────────────

/**
 * v15.0 离线事件处理系统
 *
 * 管理离线期间累积的事件，按规则自动处理或保留待玩家确认。
 */
export class OfflineEventSystem implements ISubsystem {
  readonly name = 'offlineEvent';

  private deps!: ISystemDeps;
  private offlineQueue: OfflineEventEntry[] = [];
  private autoRules: Map<string, AutoProcessRule> = new Map();
  private eventDefs: Map<EventId, EventDef> = new Map();
  private entryIdCounter = 0;

  // ─── ISubsystem 生命周期 ────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 由外部驱动
  }

  getState() {
    return {
      offlineQueue: [...this.offlineQueue],
      autoRules: new Map(this.autoRules),
    };
  }

  reset(): void {
    this.offlineQueue = [];
    this.autoRules.clear();
    this.eventDefs.clear();
    this.entryIdCounter = 0;
  }

  // ─── 事件定义注册 ──────────────────────────

  /** 注册事件定义（用于自动处理时查找选项） */
  registerEventDef(def: EventDef): void {
    this.eventDefs.set(def.id, def);
  }

  /** 批量注册 */
  registerEventDefs(defs: EventDef[]): void {
    defs.forEach(d => this.registerEventDef(d));
  }

  // ─── 离线事件队列 ──────────────────────────

  /**
   * 添加离线事件到队列
   */
  addOfflineEvent(event: Omit<OfflineEventEntry, 'id' | 'autoProcessed'>): OfflineEventEntry {
    const entry: OfflineEventEntry = {
      ...event,
      id: `offline-${++this.entryIdCounter}`,
      autoProcessed: false,
    };

    this.offlineQueue.push(entry);

    // 限制队列大小
    if (this.offlineQueue.length > MAX_OFFLINE_QUEUE_SIZE) {
      this.offlineQueue = this.offlineQueue.slice(-MAX_OFFLINE_QUEUE_SIZE);
    }

    return entry;
  }

  /**
   * 批量添加离线事件
   */
  addOfflineEvents(events: Array<{
    eventId: EventId;
    eventDefId: string;
    title: string;
    description: string;
    urgency: OfflineEventEntry['urgency'];
    category: EventCategory;
    triggeredAt: number;
    requiresManualAction: boolean;
    triggerTurn: number;
    eventDef: EventDef;
    autoResult: import('../../core/event/event-v15.types').AutoResolveResult | null;
  }>): OfflineEventEntry[] {
    return events.map(e => this.addOfflineEvent(e));
  }

  /** 获取离线事件队列 */
  getOfflineQueue(): OfflineEventEntry[] {
    return [...this.offlineQueue];
  }

  /** 获取待处理事件（未自动处理且需手动确认） */
  getPendingEvents(): OfflineEventEntry[] {
    return this.offlineQueue.filter(e => !e.autoProcessed && e.requiresManualAction);
  }

  /** 获取已自动处理事件 */
  getAutoProcessedEvents(): OfflineEventEntry[] {
    return this.offlineQueue.filter(e => e.autoProcessed);
  }

  /** 获取队列大小 */
  getQueueSize(): number {
    return this.offlineQueue.length;
  }

  /** 清空队列 */
  clearQueue(): void {
    this.offlineQueue = [];
  }

  // ─── 自动处理规则 ──────────────────────────

  /**
   * 注册自动处理规则
   */
  registerAutoRule(rule: AutoProcessRule): void {
    this.autoRules.set(rule.id, rule);
  }

  /** 批量注册 */
  registerAutoRules(rules: AutoProcessRule[]): void {
    rules.forEach(r => this.registerAutoRule(r));
  }

  /** 获取规则 */
  getAutoRule(ruleId: string): AutoProcessRule | undefined {
    return this.autoRules.get(ruleId);
  }

  /** 获取所有规则 */
  getAllAutoRules(): AutoProcessRule[] {
    return Array.from(this.autoRules.values()).sort((a, b) => b.priority - a.priority);
  }

  /** 启用/禁用规则 */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.autoRules.get(ruleId);
    if (rule) rule.enabled = enabled;
  }

  /** 移除规则 */
  removeAutoRule(ruleId: string): void {
    this.autoRules.delete(ruleId);
  }

  // ─── 自动处理 ──────────────────────────────

  /**
   * 处理离线事件队列
   *
   * 按优先级匹配自动处理规则，未匹配的事件保留待玩家确认。
   */
  processOfflineEvents(): OfflineEventProcessResult {
    const processed: OfflineEventProcessResult['processedEntries'] = [];
    const pending: OfflineEventEntry[] = [];
    const totalResourceChanges: Record<string, number> = {};
    const timeline: EventRetrospectiveData['timeline'] = [];

    // 按紧急程度排序（高优先）
    const sorted = [...this.offlineQueue].sort(
      (a, b) => (URGENCY_ORDER[b.urgency] ?? 0) - (URGENCY_ORDER[a.urgency] ?? 0),
    );

    for (const entry of sorted) {
      const rule = this.findMatchingRule(entry);

      if (rule && !entry.requiresManualAction) {
        // 自动处理
        const optionId = this.selectOption(entry.eventDefId, rule.strategy);
        const consequences = this.getOptionConsequences(entry.eventDefId, optionId);

        entry.autoProcessed = true;
        entry.autoRuleId = rule.id;
        entry.autoSelectedOptionId = optionId;

        processed.push({
          entryId: entry.id,
          eventDefId: entry.eventDefId,
          selectedOptionId: optionId,
          consequences: consequences ?? {
            description: '自动处理',
          },
        });

        // 汇总资源变化
        if (consequences?.resourceChanges) {
          for (const [key, value] of Object.entries(consequences.resourceChanges)) {
            totalResourceChanges[key] = (totalResourceChanges[key] ?? 0) + value;
          }
        }

        timeline.push({
          timestamp: entry.triggeredAt,
          eventTitle: entry.title,
          action: `自动处理（${rule.name}）`,
          result: consequences?.description ?? '已处理',
        });
      } else {
        // 保留待手动处理
        pending.push(entry);
        timeline.push({
          timestamp: entry.triggeredAt,
          eventTitle: entry.title,
          action: '等待处理',
          result: '待玩家确认',
        });
      }
    }

    const retrospectiveData: EventRetrospectiveData = {
      offlineEvents: [...this.offlineQueue],
      totalResourceChanges,
      timeline,
    };

    return {
      autoProcessedCount: processed.length,
      manualRequiredCount: pending.length,
      processedEntries: processed,
      pendingEntries: pending,
      retrospectiveData,
    };
  }

  /**
   * 手动处理单个离线事件
   */
  manualProcessEvent(entryId: string, optionId: string): OptionConsequence | null {
    const entry = this.offlineQueue.find(e => e.id === entryId);
    if (!entry) return null;

    const consequences = this.getOptionConsequences(entry.eventDefId, optionId);
    if (!consequences) return null;

    entry.autoProcessed = true;
    entry.autoSelectedOptionId = optionId;

    // 从队列移除
    this.offlineQueue = this.offlineQueue.filter(e => e.id !== entryId);

    return consequences;
  }

  /**
   * 生成事件回溯数据
   */
  generateRetrospective(): EventRetrospectiveData {
    const totalResourceChanges: Record<string, number> = {};
    const timeline: EventRetrospectiveData['timeline'] = [];

    for (const entry of this.offlineQueue) {
      if (entry.autoProcessed && entry.autoSelectedOptionId) {
        const consequences = this.getOptionConsequences(entry.eventDefId, entry.autoSelectedOptionId);
        if (consequences?.resourceChanges) {
          for (const [key, value] of Object.entries(consequences.resourceChanges)) {
            totalResourceChanges[key] = (totalResourceChanges[key] ?? 0) + value;
          }
        }
      }

      timeline.push({
        timestamp: entry.triggeredAt,
        eventTitle: entry.title,
        action: entry.autoProcessed ? '已处理' : '待处理',
        result: entry.autoProcessed ? '已选择选项' : '等待确认',
      });
    }

    return {
      offlineEvents: [...this.offlineQueue],
      totalResourceChanges,
      timeline,
    };
  }

  // ─── 序列化 ────────────────────────────────

  /** 导出存档 */
  exportSaveData(): { version: number; offlineQueue: OfflineEventEntry[]; autoRules: AutoProcessRule[] } {
    return {
      version: OFFLINE_EVENT_SAVE_VERSION,
      offlineQueue: this.offlineQueue.map(e => ({ ...e })),
      autoRules: Array.from(this.autoRules.values()),
    };
  }

  /** 导入存档 */
  importSaveData(data: { version: number; offlineQueue: OfflineEventEntry[]; autoRules: AutoProcessRule[] }): void {
    this.offlineQueue = data.offlineQueue ?? [];
    this.autoRules.clear();
    for (const rule of data.autoRules ?? []) {
      this.autoRules.set(rule.id, rule);
    }
  }

  // ─── 内部方法 ──────────────────────────────

  /** 查找匹配的自动处理规则 */
  private findMatchingRule(entry: OfflineEventEntry): AutoProcessRule | null {
    const rules = this.getAllAutoRules().filter(r => r.enabled);

    for (const rule of rules) {
      // 检查紧急程度阈值
      if (URGENCY_ORDER[entry.urgency] >= URGENCY_ORDER[rule.urgencyThreshold]) {
        continue; // 事件紧急程度 >= 阈值，不自动处理
      }

      // 检查分类匹配
      if (rule.applicableCategories.length > 0 && !rule.applicableCategories.includes(entry.category)) {
        continue;
      }

      // 检查事件ID匹配
      if (rule.applicableEventIds.length > 0 && !rule.applicableEventIds.includes(entry.eventDefId)) {
        continue;
      }

      return rule;
    }

    return null;
  }

  /** 按策略选择选项 */
  private selectOption(eventDefId: EventId, strategy: AutoSelectStrategy): string {
    const def = this.eventDefs.get(eventDefId);
    if (!def || def.options.length === 0) return '';

    switch (strategy) {
      case 'default_option': {
        const defaultOpt = def.options.find(o => o.isDefault);
        return defaultOpt?.id ?? def.options[0].id;
      }
      case 'best_outcome': {
        // 选择资源收益最大的选项
        let bestId = def.options[0].id;
        let bestValue = -Infinity;
        for (const opt of def.options) {
          const value = Object.values(opt.consequences.resourceChanges ?? {}).reduce((s, v) => s + v, 0);
          if (value > bestValue) {
            bestValue = value;
            bestId = opt.id;
          }
        }
        return bestId;
      }
      case 'safest': {
        // 选择资源消耗最小的选项
        let safestId = def.options[0].id;
        let minLoss = Infinity;
        for (const opt of def.options) {
          const loss = Object.values(opt.consequences.resourceChanges ?? {})
            .filter(v => v < 0)
            .reduce((s, v) => s + Math.abs(v), 0);
          if (loss < minLoss) {
            minLoss = loss;
            safestId = opt.id;
          }
        }
        return safestId;
      }
      case 'weighted_random': {
        const totalWeight = def.options.reduce((s, o) => s + (o.isDefault ? 60 : 40), 0);
        let roll = Math.random() * totalWeight;
        for (const opt of def.options) {
          roll -= opt.isDefault ? 60 : 40;
          if (roll <= 0) return opt.id;
        }
        return def.options[def.options.length - 1].id;
      }
      case 'skip':
        return '';
      default:
        return def.options[0].id;
    }
  }

  /** 获取选项后果 */
  private getOptionConsequences(eventDefId: EventId, optionId: string): OptionConsequence | null {
    const def = this.eventDefs.get(eventDefId);
    if (!def) return null;

    const option = def.options.find(o => o.id === optionId);
    if (!option) return null;

    return {
      description: option.consequences.description,
      resourceChanges: option.consequences.resourceChanges ? { ...option.consequences.resourceChanges } : undefined,
      affinityChanges: option.consequences.affinityChanges ? { ...option.consequences.affinityChanges } : undefined,
      triggerEventId: option.consequences.triggerEventId,
      unlockIds: option.consequences.unlockIds ? [...option.consequences.unlockIds] : undefined,
    };
  }
}
