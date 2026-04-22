/**
 * 引擎层 — 事件日志系统
 *
 * 管理事件日志记录和回归急报堆。
 * 功能覆盖：#13 事件日志面板（P1）、#14 回归急报堆展示（P1）
 *
 * @module engine/event/EventLogSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { EventId } from '../../core/event';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export type LogId = string;
export type AlertId = string;
export type EventLogType = 'random' | 'fixed' | 'chain' | 'story' | 'npc';
export type AlertUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface EventLogEntry {
  id: LogId;
  eventDefId: EventId;
  title: string;
  description: string;
  chosenOptionText?: string;
  consequenceDescription?: string;
  triggeredTurn: number;
  resolvedTurn?: number;
  timestamp: number;
  eventType: EventLogType;
}

export interface ReturnAlert {
  id: AlertId;
  eventInstanceId?: string;
  title: string;
  description: string;
  urgency: AlertUrgency;
  timestamp: number;
  read: boolean;
  alertType: EventLogType;
}

export interface AlertStack {
  alerts: ReturnAlert[];
  totalCount: number;
  unreadCount: number;
  highestUrgency: AlertUrgency | null;
}

export interface EventLogSaveData {
  version: number;
  eventLog: EventLogEntry[];
  returnAlerts: ReturnAlert[];
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const LOG_SAVE_VERSION = 1;
const MAX_LOG_SIZE = 200;
const MAX_ALERT_SIZE = 50;
const URGENCY_WEIGHT: Record<AlertUrgency, number> = { critical: 4, high: 3, medium: 2, low: 1 };

// ─────────────────────────────────────────────
// 事件日志系统
// ─────────────────────────────────────────────

export class EventLogSystem implements ISubsystem {
  readonly name = 'eventLog';
  private deps!: ISystemDeps;
  private eventLog: EventLogEntry[] = [];
  private returnAlerts: ReturnAlert[] = [];
  private logIdCounter = 0;
  private alertIdCounter = 0;

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void {}

  getState(): { eventLog: EventLogEntry[]; alerts: ReturnAlert[] } {
    return { eventLog: [...this.eventLog], alerts: [...this.returnAlerts] };
  }

  reset(): void { this.eventLog = []; this.returnAlerts = []; this.logIdCounter = 0; this.alertIdCounter = 0; }

  // ─── 日志记录 ──────────────────────────────

  logEvent(entry: Omit<EventLogEntry, 'id'>): EventLogEntry {
    this.logIdCounter++;
    const log: EventLogEntry = { ...entry, id: `log-${this.logIdCounter}` };
    this.eventLog.push(log);
    this.trimLog();
    this.deps?.eventBus.emit('eventLog:added', { logId: log.id, eventDefId: log.eventDefId, title: log.title });
    return log;
  }

  logEventResolved(eventDefId: EventId, chosenOptionText: string, consequenceDescription: string, triggeredTurn: number, resolvedTurn: number): EventLogEntry | null {
    let existing = this.eventLog.find(l => l.eventDefId === eventDefId && !l.resolvedTurn && l.triggeredTurn === triggeredTurn);
    if (!existing) {
      this.logIdCounter++;
      existing = { id: `log-${this.logIdCounter}`, eventDefId, title: eventDefId, description: '', triggeredTurn, timestamp: Date.now(), eventType: 'random' };
      this.eventLog.push(existing);
    }
    existing.chosenOptionText = chosenOptionText;
    existing.consequenceDescription = consequenceDescription;
    existing.resolvedTurn = resolvedTurn;
    return existing;
  }

  // ─── 日志查询 ──────────────────────────────

  getEventLog(options?: { eventType?: EventLogType; fromTurn?: number; toTurn?: number; limit?: number }): EventLogEntry[] {
    let logs = [...this.eventLog];
    if (options?.eventType) logs = logs.filter(l => l.eventType === options.eventType);
    if (options?.fromTurn != null) logs = logs.filter(l => l.triggeredTurn >= options.fromTurn!);
    if (options?.toTurn != null) logs = logs.filter(l => l.triggeredTurn <= options.toTurn!);
    if (options?.limit) logs = logs.slice(-options.limit);
    return logs;
  }

  getLogEntry(logId: LogId): EventLogEntry | undefined { return this.eventLog.find(l => l.id === logId); }
  getLogCount(): number { return this.eventLog.length; }
  getLogCountByType(eventType: EventLogType): number { return this.eventLog.filter(l => l.eventType === eventType).length; }
  getRecentLogs(count: number): EventLogEntry[] { return this.eventLog.slice(-count); }

  // ─── 急报管理 ──────────────────────────────

  addAlert(alert: Omit<ReturnAlert, 'id' | 'timestamp' | 'read'>): ReturnAlert {
    this.alertIdCounter++;
    const newAlert: ReturnAlert = { ...alert, id: `alert-${this.alertIdCounter}`, timestamp: Date.now(), read: false };
    this.returnAlerts.push(newAlert);
    this.returnAlerts.sort((a, b) => URGENCY_WEIGHT[b.urgency] - URGENCY_WEIGHT[a.urgency]);
    this.trimAlerts();
    return newAlert;
  }

  addOfflineAlerts(events: Array<{ title: string; description: string; urgency: 'low' | 'medium' | 'high' | 'critical' }>): ReturnAlert[] {
    return events.map(e => this.addAlert({ title: e.title, description: e.description, urgency: e.urgency as AlertUrgency, alertType: 'random' }));
  }

  getAlertStack(): AlertStack {
    const unread = this.returnAlerts.filter(a => !a.read);
    const highest = unread.length > 0 ? unread[0].urgency : null;
    return { alerts: [...this.returnAlerts], totalCount: this.returnAlerts.length, unreadCount: unread.length, highestUrgency: highest };
  }

  getAlerts(unreadOnly = false): ReturnAlert[] { return unreadOnly ? this.returnAlerts.filter(a => !a.read) : [...this.returnAlerts]; }
  getAlert(alertId: AlertId): ReturnAlert | undefined { return this.returnAlerts.find(a => a.id === alertId); }

  markAlertRead(alertId: string): boolean { const a = this.returnAlerts.find(al => al.id === alertId); if (a) { a.read = true; return true; } return false; }
  markAllAlertsRead(): void { for (const a of this.returnAlerts) a.read = true; }
  clearReadAlerts(): void { this.returnAlerts = this.returnAlerts.filter(a => !a.read); }
  getUnreadAlertCount(): number { return this.returnAlerts.filter(a => !a.read).length; }

  removeAlert(alertId: AlertId): boolean {
    const idx = this.returnAlerts.findIndex(a => a.id === alertId);
    if (idx >= 0) { this.returnAlerts.splice(idx, 1); return true; }
    return false;
  }

  // ─── 序列化 ────────────────────────────────

  exportSaveData(): EventLogSaveData {
    return { version: LOG_SAVE_VERSION, eventLog: this.eventLog.slice(-MAX_LOG_SIZE), returnAlerts: this.returnAlerts.slice(-MAX_ALERT_SIZE) };
  }

  importSaveData(data: EventLogSaveData): void {
    this.eventLog = data.eventLog ?? [];
    this.returnAlerts = data.returnAlerts ?? [];
    this.logIdCounter = this.eventLog.length;
    this.alertIdCounter = this.returnAlerts.length;
  }

  // ─── 内部方法 ──────────────────────────────

  private trimLog(): void { if (this.eventLog.length > MAX_LOG_SIZE) this.eventLog = this.eventLog.slice(-MAX_LOG_SIZE); }
  private trimAlerts(): void { if (this.returnAlerts.length > MAX_ALERT_SIZE) this.returnAlerts = this.returnAlerts.slice(-MAX_ALERT_SIZE); }
}
