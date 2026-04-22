/**
 * 引擎层 — 离线事件堆积处理 v15.0
 *
 * 功能覆盖：
 *   #13 离线事件堆积处理
 *
 * 设计：
 *   - 玩家离线期间，事件按时间线模拟触发
 *   - 低优先级事件自动处理（选默认选项）
 *   - 高优先级事件保留，玩家上线后手动处理
 *   - 最多堆积10个事件，超出自动处理最早的
 *
 * @module engine/event/OfflineEventHandler
 */

import type { EventId, EventDef } from '../../core/event';
import type {
  OfflineEventPile,
  OfflineEventEntry,
  AutoResolveResult,
  EventNotification,
} from '../../core/event/event-v15.types';
import { NotificationPriority } from '../../core/event/event-v15-event.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 最大堆积事件数 */
const MAX_PILE_SIZE = 10;

/** 自动处理阈值：MEDIUM 及以下优先级自动处理 */
const AUTO_RESOLVE_THRESHOLD = NotificationPriority.MEDIUM;

// ─────────────────────────────────────────────
// 离线事件处理器
// ─────────────────────────────────────────────

/**
 * 离线事件处理器
 *
 * 处理玩家离线期间堆积的事件。
 */
export class OfflineEventHandler {
  /**
   * 模拟离线期间的事件触发
   *
   * 根据离线回合数，模拟事件触发并生成堆积列表。
   *
   * @param offlineTurns - 离线回合数
   * @param availableEvents - 可用事件定义池
   * @param triggerProbability - 每回合触发概率
   * @returns 离线事件堆积
   */
  simulateOfflineEvents(
    offlineTurns: number,
    availableEvents: EventDef[],
    triggerProbability: number = 0.3,
  ): OfflineEventPile {
    const entries: OfflineEventEntry[] = [];
    const now = Date.now();

    for (let turn = 1; turn <= offlineTurns; turn++) {
      // 每回合有概率触发一个事件
      if (Math.random() >= triggerProbability) continue;
      if (entries.length >= MAX_PILE_SIZE) break;

      // 随机选择一个事件
      const eventDef = availableEvents[Math.floor(Math.random() * availableEvents.length)];
      if (!eventDef) continue;

      // 决定是否自动处理
      const autoResult = this.tryAutoResolve(eventDef);

      entries.push({
        id: `offline-pile-${turn}`,
        eventId: eventDef.id,
        eventDefId: eventDef.id,
        title: eventDef.title,
        description: eventDef.description,
        urgency: autoResult ? 'low' : 'high',
        category: 'random',
        triggeredAt: turn,
        triggerTurn: turn,
        eventDef,
        autoResult,
        autoProcessed: autoResult !== null,
        requiresManualAction: autoResult === null,
      });
    }

    return {
      id: `pile-${now}`,
      offlineStart: now - offlineTurns * 60000, // 假设每回合1分钟
      offlineEnd: now,
      offlineTurns,
      events: entries,
      processed: false,
    };
  }

  /**
   * 尝试自动处理事件
   *
   * 低优先级事件（MEDIUM及以下）自动选择默认选项或最高权重选项。
   * 高优先级事件保留给玩家手动处理。
   */
  tryAutoResolve(eventDef: EventDef): AutoResolveResult | null {
    // 检查事件优先级（通过urgency映射）
    const priority = urgencyToPriority(eventDef.urgency);
    // 数值越小优先级越高：SYSTEM=0, URGENT=1, HIGH=2, MEDIUM=3, LOW=4, INFO=5
    // AUTO_RESOLVE_THRESHOLD=MEDIUM(3)，MEDIUM及以下（数值≥3）自动处理
    if (priority < AUTO_RESOLVE_THRESHOLD) {
      // 高优先级事件保留给玩家
      return null;
    }

    // 低优先级事件自动处理
    return this.autoChooseOption(eventDef);
  }

  /**
   * 自动选择选项
   *
   * 策略：
   *   1. 优先选择默认选项
   *   2. 无默认选项则选择第一个
   */
  private autoChooseOption(eventDef: EventDef): AutoResolveResult {
    const options = eventDef.options;
    if (options.length === 0) {
      throw new Error(`事件 ${eventDef.id} 没有选项`);
    }

    // 查找默认选项
    const defaultOption = options.find((o) => o.isDefault);
    const chosenOption = defaultOption ?? options[0];

    return {
      chosenOptionId: chosenOption.id,
      reason: defaultOption ? 'default' : 'highest_weight',
      consequences: chosenOption.consequences,
    };
  }

  /**
   * 处理离线事件堆积
   *
   * 返回需要玩家手动处理的事件列表和自动处理的结果。
   */
  processOfflinePile(pile: OfflineEventPile): {
    /** 需要玩家手动处理的事件 */
    pendingEvents: OfflineEventEntry[];
    /** 自动处理的事件及结果 */
    autoResolvedEvents: Array<{
      entry: OfflineEventEntry;
      result: AutoResolveResult;
    }>;
    /** 自动处理的资源变化汇总 */
    autoResourceChanges: Record<string, number>;
  } {
    const pendingEvents: OfflineEventEntry[] = [];
    const autoResolvedEvents: Array<{
      entry: OfflineEventEntry;
      result: AutoResolveResult;
    }> = [];
    const autoResourceChanges: Record<string, number> = {};

    for (const entry of pile.events) {
      if (entry.autoResult) {
        // 已自动处理
        autoResolvedEvents.push({ entry, result: entry.autoResult });

        // 汇总资源变化
        const changes = entry.autoResult.consequences.resourceChanges ?? {};
        for (const [resource, amount] of Object.entries(changes) as [string, number][]) {
          autoResourceChanges[resource] = (autoResourceChanges[resource] ?? 0) + amount;
        }
      } else {
        // 需要玩家处理
        pendingEvents.push(entry);
      }
    }

    // 标记已处理
    pile.processed = true;

    return { pendingEvents, autoResolvedEvents, autoResourceChanges };
  }

  /**
   * 手动处理一个离线事件
   */
  resolveOfflineEvent(
    pile: OfflineEventPile,
    eventId: EventId,
    optionId: string,
  ): {
    success: boolean;
    consequences: EventDef['options'][0]['consequences'] | null;
    reason?: string;
  } {
    const entry = pile.events.find((e: { eventId: string }) => e.eventId === eventId);
    if (!entry) {
      return { success: false, consequences: null, reason: '事件不存在' };
    }

    if (entry.autoResult) {
      return { success: false, consequences: null, reason: '事件已自动处理' };
    }

    const option = entry.eventDef.options.find((o: { id: string }) => o.id === optionId);
    if (!option) {
      return { success: false, consequences: null, reason: '选项不存在' };
    }

    // 标记为自动处理（玩家手动选择的结果）
    entry.autoResult = {
      chosenOptionId: optionId,
      reason: 'time_expired',
      consequences: option.consequences,
    };

    return { success: true, consequences: option.consequences };
  }

  /**
   * 获取堆积统计信息
   */
  getPileStats(pile: OfflineEventPile): {
    total: number;
    pending: number;
    autoResolved: number;
  } {
    const total = pile.events.length;
    const autoResolved = pile.events.filter((e: { autoResult: unknown }) => e.autoResult !== null).length;
    return {
      total,
      pending: total - autoResolved,
      autoResolved,
    };
  }

  /**
   * 将堆积事件转换为通知列表
   */
  convertToNotifications(pile: OfflineEventPile): EventNotification[] {
    const notifications: EventNotification[] = [];
    let counter = 0;

    for (const entry of pile.events) {
      if (entry.autoResult) continue; // 跳过已自动处理的

      counter++;
      notifications.push({
        id: `offline-notif-${pile.id}-${counter}`,
        eventId: entry.eventId,
        title: entry.eventDef.title,
        content: entry.eventDef.description,
        priority: urgencyToPriority(entry.eventDef.urgency),
        createdAt: pile.offlineEnd,
        expireAt: null,
        read: false,
      });
    }

    return notifications;
  }
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 紧急程度 → 通知优先级映射 */
function urgencyToPriority(urgency: string): NotificationPriority {
  switch (urgency) {
    case 'critical': return NotificationPriority.URGENT;
    case 'high': return NotificationPriority.HIGH;
    case 'medium': return NotificationPriority.MEDIUM;
    case 'low': return NotificationPriority.LOW;
    default: return NotificationPriority.INFO;
  }
}
