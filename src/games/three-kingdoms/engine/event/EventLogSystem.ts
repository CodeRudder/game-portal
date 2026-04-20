/**
 * 引擎层 — 事件日志系统
 *
 * 管理事件日志记录和回归急报堆：
 *   - 事件日志记录（所有已触发事件的完整记录）
 *   - 日志查询与筛选（按类型、时间范围）
 *   - 回归急报堆（离线回归时批量展示未读急报）
 *   - 急报已读状态管理
 *   - 序列化/反序列化
 *
 * 功能覆盖：
 *   #13 事件日志面板（P1）
 *   #14 回归急报堆展示（P1）
 *
 * 设计：
 *   所有事件触发/解决时自动记录日志。
 *   离线回归时，将未读急报打包展示（急报堆）。
 *   急报按紧急程度排序，支持逐条或批量已读。
 *
 * @module engine/event/EventLogSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { EventId } from '../../core/event';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 日志 ID */
export type LogId = string;

/** 急报 ID */
export type AlertId = string;

/** 事件类型标记 */
export type EventLogType = 'random' | 'fixed' | 'chain' | 'story' | 'npc';

/** 紧急程度 */
export type AlertUrgency = 'low' | 'medium' | 'high' | 'critical';

/** 事件日志条目 */
export interface EventLogEntry {
  /** 日志 ID */
  id: LogId;
  /** 事件定义 ID */
  eventDefId: EventId;
  /** 事件标题 */
  title: string;
  /** 事件描述 */
  description: string;
  /** 玩家选择的选项文本 */
  chosenOptionText?: string;
  /** 后果描述 */
  consequenceDescription?: string;
  /** 触发回合 */
  triggeredTurn: number;
  /** 解决回合 */
  resolvedTurn?: number;
  /** 创建时间戳 */
  timestamp: number;
  /** 事件类型 */
  eventType: EventLogType;
}

/** 回归急报条目 */
export interface ReturnAlert {
  /** 急报 ID */
  id: AlertId;
  /** 关联事件实例 ID */
  eventInstanceId?: string;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 紧急程度 */
  urgency: AlertUrgency;
  /** 发生时间戳 */
  timestamp: number;
  /** 是否已读 */
  read: boolean;
  /** 急报类型 */
  alertType: EventLogType;
}

/** 急报堆展示数据 */
export interface AlertStack {
  /** 急报列表（按紧急程度排序） */
  alerts: ReturnAlert[];
  /** 总数 */
  totalCount: number;
  /** 未读数 */
  unreadCount: number;
  /** 最高紧急程度 */
  highestUrgency: AlertUrgency | null;
}

/** 事件日志系统存档 */
export interface EventLogSaveData {
  /** 版本号 */
  version: number;
  /** 事件日志 */
  eventLog: EventLogEntry[];
  /** 回归急报 */
  returnAlerts: ReturnAlert[];
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 存档版本 */
const LOG_SAVE_VERSION = 1;

/** 最大日志条数 */
const MAX_LOG_SIZE = 200;

/** 最大急报条数 */
const MAX_ALERT_SIZE = 50;

/** 紧急程度排序权重 */
const URGENCY_WEIGHT: Record<AlertUrgency, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
} as const;

// ─────────────────────────────────────────────
// 事件日志系统
// ─────────────────────────────────────────────

/**
 * 事件日志系统
 *
 * 记录所有事件日志，管理回归急报堆。
 *
 * @example
 * ```ts
 * const logSys = new EventLogSystem();
 * logSys.init(deps);
 *
 * // 记录事件日志
 * logSys.logEvent({
 *   eventDefId: 'evt-01',
 *   title: '流民涌入',
 *   description: '大量流民涌入城池',
 *   eventType: 'random',
 *   triggeredTurn: 5,
 * });
 *
 * // 记录事件解决
 * logSys.logEventResolved('evt-01', '接纳流民', '人口增加', 5, 6);
 *
 * // 添加急报
 * logSys.addAlert({ title: '紧急军情', description: '...', urgency: 'high', alertType: 'event' });
 *
 * // 获取急报堆（离线回归时）
 * const stack = logSys.getAlertStack();
 * ```
 */
export class EventLogSystem implements ISubsystem {
  readonly name = 'eventLog';

  private deps!: ISystemDeps;
  private eventLog: EventLogEntry[] = [];
  private returnAlerts: ReturnAlert[] = [];
  private logIdCounter = 0;
  private alertIdCounter = 0;

  // ─── ISubsystem 生命周期 ────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 日志系统不需要帧更新
  }

  getState(): { eventLog: EventLogEntry[]; alerts: ReturnAlert[] } {
    return {
      eventLog: [...this.eventLog],
      alerts: [...this.returnAlerts],
    };
  }

  reset(): void {
    this.eventLog = [];
    this.returnAlerts = [];
    this.logIdCounter = 0;
    this.alertIdCounter = 0;
  }

  // ─────────────────────────────────────────
  // #13 事件日志记录
  // ─────────────────────────────────────────

  /**
   * 记录事件日志
   *
   * @param entry - 日志条目（不含 id）
   * @returns 创建的日志条目
   */
  logEvent(entry: Omit<EventLogEntry, 'id'>): EventLogEntry {
    const logEntry: EventLogEntry = {
      ...entry,
      id: `log-${++this.logIdCounter}`,
    };

    this.eventLog.push(logEntry);
    this.trimLog();

    this.deps?.eventBus.emit('eventLog:added', { logId: logEntry.id });

    return logEntry;
  }

  /**
   * 记录事件解决日志
   *
   * 查找对应事件日志并更新解决信息，如未找到则创建新条目。
   *
   * @param eventDefId - 事件定义 ID
   * @param chosenOptionText - 选择的选项文本
   * @param consequenceDescription - 后果描述
   * @param triggeredTurn - 触发回合
   * @param resolvedTurn - 解决回合
   * @param eventType - 事件类型
   * @param title - 事件标题
   * @param description - 事件描述
   */
  logEventResolved(
    eventDefId: EventId,
    chosenOptionText: string,
    consequenceDescription: string,
    triggeredTurn: number,
    resolvedTurn: number,
    eventType: EventLogType = 'random',
    title?: string,
    description?: string,
  ): EventLogEntry {
    // 尝试找到已有的日志条目
    const existing = this.eventLog.find(
      (e) => e.eventDefId === eventDefId && !e.resolvedTurn,
    );

    if (existing) {
      existing.chosenOptionText = chosenOptionText;
      existing.consequenceDescription = consequenceDescription;
      existing.resolvedTurn = resolvedTurn;
      return { ...existing };
    }

    // 未找到，创建新条目
    return this.logEvent({
      eventDefId,
      title: title ?? eventDefId,
      description: description ?? '',
      chosenOptionText,
      consequenceDescription,
      triggeredTurn,
      resolvedTurn,
      timestamp: Date.now(),
      eventType,
    });
  }

  // ─────────────────────────────────────────
  // 日志查询
  // ─────────────────────────────────────────

  /**
   * 获取事件日志
   *
   * @param options - 查询选项
   * @returns 日志条目列表
   */
  getEventLog(options?: {
    /** 限制条数 */
    limit?: number;
    /** 事件类型筛选 */
    eventType?: EventLogType;
    /** 最小回合 */
    minTurn?: number;
    /** 最大回合 */
    maxTurn?: number;
  }): EventLogEntry[] {
    let log = [...this.eventLog];

    if (options?.eventType) {
      log = log.filter((e) => e.eventType === options.eventType);
    }

    if (options?.minTurn !== undefined) {
      log = log.filter((e) => e.triggeredTurn >= options.minTurn!);
    }

    if (options?.maxTurn !== undefined) {
      log = log.filter((e) => e.triggeredTurn <= options.maxTurn!);
    }

    if (options?.limit) {
      log = log.slice(-options.limit);
    }

    return log;
  }

  /**
   * 获取日志条目
   */
  getLogEntry(logId: LogId): EventLogEntry | undefined {
    return this.eventLog.find((e) => e.id === logId);
  }

  /**
   * 获取日志总数
   */
  getLogCount(): number {
    return this.eventLog.length;
  }

  /**
   * 按事件类型获取日志数量
   */
  getLogCountByType(eventType: EventLogType): number {
    return this.eventLog.filter((e) => e.eventType === eventType).length;
  }

  /**
   * 获取最近 N 条日志
   */
  getRecentLogs(count: number): EventLogEntry[] {
    return this.eventLog.slice(-count);
  }

  // ─────────────────────────────────────────
  // #14 回归急报堆
  // ─────────────────────────────────────────

  /**
   * 添加急报
   *
   * @param alert - 急报数据（不含 id、timestamp、read）
   * @returns 创建的急报
   */
  addAlert(alert: Omit<ReturnAlert, 'id' | 'timestamp' | 'read'>): ReturnAlert {
    const newAlert: ReturnAlert = {
      ...alert,
      id: `alert-${++this.alertIdCounter}`,
      timestamp: Date.now(),
      read: false,
    };

    this.returnAlerts.push(newAlert);
    this.trimAlerts();

    this.deps?.eventBus.emit('alert:added', {
      alertId: newAlert.id,
      title: newAlert.title,
      urgency: newAlert.urgency,
    });

    return newAlert;
  }

  /**
   * 批量添加急报（离线回归时使用）
   *
   * @param alerts - 急报数据列表
   * @returns 创建的急报列表
   */
  addOfflineAlerts(
    alerts: Array<{
      title: string;
      description: string;
      urgency: AlertUrgency;
      alertType?: EventLogType;
      eventInstanceId?: string;
    }>,
  ): ReturnAlert[] {
    return alerts.map((a) =>
      this.addAlert({
        title: a.title,
        description: a.description,
        urgency: a.urgency,
        alertType: a.alertType ?? 'random',
        eventInstanceId: a.eventInstanceId,
      }),
    );
  }

  /**
   * 获取急报堆展示数据
   *
   * 离线回归时调用，返回按紧急程度排序的急报列表。
   *
   * @returns 急报堆数据
   */
  getAlertStack(): AlertStack {
    const sorted = [...this.returnAlerts].sort(
      (a, b) => URGENCY_WEIGHT[b.urgency] - URGENCY_WEIGHT[a.urgency],
    );

    const unreadCount = sorted.filter((a) => !a.read).length;
    const highestUrgency = sorted.length > 0
      ? sorted[0].urgency
      : null;

    return {
      alerts: sorted,
      totalCount: sorted.length,
      unreadCount,
      highestUrgency,
    };
  }

  /**
   * 获取急报列表
   *
   * @param unreadOnly - 是否只返回未读
   * @returns 急报列表
   */
  getAlerts(unreadOnly?: boolean): ReturnAlert[] {
    if (unreadOnly) {
      return this.returnAlerts.filter((a) => !a.read);
    }
    return [...this.returnAlerts];
  }

  /**
   * 获取急报
   */
  getAlert(alertId: AlertId): ReturnAlert | undefined {
    return this.returnAlerts.find((a) => a.id === alertId);
  }

  /**
   * 标记急报已读
   *
   * @param alertId - 急报 ID
   * @returns 是否成功
   */
  markAlertRead(alertId: string): boolean {
    const alert = this.returnAlerts.find((a) => a.id === alertId);
    if (!alert) return false;
    alert.read = true;
    return true;
  }

  /**
   * 全部标记已读
   */
  markAllAlertsRead(): void {
    this.returnAlerts.forEach((a) => {
      a.read = true;
    });
  }

  /**
   * 清除已读急报
   */
  clearReadAlerts(): void {
    this.returnAlerts = this.returnAlerts.filter((a) => !a.read);
  }

  /**
   * 获取未读急报数量
   */
  getUnreadAlertCount(): number {
    return this.returnAlerts.filter((a) => !a.read).length;
  }

  /**
   * 移除急报
   */
  removeAlert(alertId: AlertId): boolean {
    const idx = this.returnAlerts.findIndex((a) => a.id === alertId);
    if (idx === -1) return false;
    this.returnAlerts.splice(idx, 1);
    return true;
  }

  // ─────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────

  /** 导出存档数据 */
  exportSaveData(): EventLogSaveData {
    return {
      version: LOG_SAVE_VERSION,
      eventLog: this.eventLog.slice(-MAX_LOG_SIZE),
      returnAlerts: this.returnAlerts.slice(-MAX_ALERT_SIZE),
    };
  }

  /** 导入存档数据 */
  importSaveData(data: EventLogSaveData): void {
    this.eventLog = data.eventLog ?? [];
    this.returnAlerts = data.returnAlerts ?? [];

    // 恢复计数器
    this.logIdCounter = this.eventLog.length;
    this.alertIdCounter = this.returnAlerts.length;
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /** 裁剪日志超出上限 */
  private trimLog(): void {
    if (this.eventLog.length > MAX_LOG_SIZE) {
      this.eventLog = this.eventLog.slice(-MAX_LOG_SIZE);
    }
  }

  /** 裁剪急报超出上限 */
  private trimAlerts(): void {
    if (this.returnAlerts.length > MAX_ALERT_SIZE) {
      // 优先保留未读急报
      const unread = this.returnAlerts.filter((a) => !a.read);
      const read = this.returnAlerts.filter((a) => a.read);

      if (unread.length >= MAX_ALERT_SIZE) {
        this.returnAlerts = unread.slice(-MAX_ALERT_SIZE);
      } else {
        const keepRead = MAX_ALERT_SIZE - unread.length;
        this.returnAlerts = [
          ...read.slice(-keepRead),
          ...unread,
        ];
      }
    }
  }
}
