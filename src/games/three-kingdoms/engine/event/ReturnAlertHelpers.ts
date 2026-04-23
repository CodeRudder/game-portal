/**
 * 事件系统 — 回归急报辅助函数
 *
 * 从 EventChainSystem 中提取的急报管理纯函数。
 *
 * @module engine/event/ReturnAlertHelpers
 */

import type { ReturnAlert } from './event-chain.types';

/** 创建新急报 */
export function createReturnAlert(
  alert: Omit<ReturnAlert, 'id' | 'timestamp' | 'read'>,
  idCounter: number,
): { alert: ReturnAlert; newCounter: number } {
  const newAlert: ReturnAlert = {
    ...alert,
    id: `alert-${idCounter + 1}`,
    timestamp: Date.now(),
    read: false,
  };
  return { alert: newAlert, newCounter: idCounter + 1 };
}

/** 批量创建急报（离线回归时） */
export function createOfflineAlerts(
  events: Array<{ title: string; description: string; urgency: 'low' | 'medium' | 'high' | 'critical' }>,
  startCounter: number,
): { alerts: ReturnAlert[]; newCounter: number } {
  let counter = startCounter;
  const alerts: ReturnAlert[] = [];
  for (const e of events) {
    const result = createReturnAlert({
      title: e.title,
      description: e.description,
      urgency: e.urgency,
      alertType: 'event',
    }, counter);
    alerts.push(result.alert);
    counter = result.newCounter;
  }
  return { alerts, newCounter: counter };
}

/** 过滤未读急报 */
export function filterUnreadAlerts(alerts: ReturnAlert[]): ReturnAlert[] {
  return alerts.filter((a) => !a.read);
}

/** 标记急报已读 */
export function markAlertRead(alerts: ReturnAlert[], alertId: string): boolean {
  const alert = alerts.find((a) => a.id === alertId);
  if (!alert) return false;
  alert.read = true;
  return true;
}

/** 全部标记已读 */
export function markAllAlertsRead(alerts: ReturnAlert[]): void {
  alerts.forEach((a) => { a.read = true; });
}

/** 清除已读急报 */
export function clearReadAlerts(alerts: ReturnAlert[]): ReturnAlert[] {
  return alerts.filter((a) => !a.read);
}
