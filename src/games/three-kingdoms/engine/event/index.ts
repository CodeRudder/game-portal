/**
 * 引擎层 — 事件模块统一导出
 *
 * @module engine/event
 */

export { EventTriggerSystem } from './EventTriggerSystem';
export type { EventTriggerContext, EventSelectResult } from './EventTriggerSystem';
export { EventUINotification } from './EventUINotification';
export type { EncounterOptionDisplay, EncounterModalData } from './EventUINotification';
