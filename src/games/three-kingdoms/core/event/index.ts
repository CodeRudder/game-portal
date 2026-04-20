/**
 * 核心层 — 事件模块统一导出
 *
 * @module core/event
 */

// 类型导出
export type {
  EventId,
  EventTriggerType,
  EventUrgency,
  EventStatus,
  EventScope,
  EventCondition,
  EventConsequence,
  EventOption,
  EventDef,
  EventInstance,
  EventTriggerResult,
  EventChoiceResult,
  BannerId,
  BannerType,
  EventBanner,
  BannerState,
  EncounterId,
  EncounterPopup,
  EncounterOption,
  EncounterChoiceResult,
  EventTriggerConfig,
  EventSystemState,
  EventSystemSaveData,
} from './event.types';

export { DEFAULT_EVENT_TRIGGER_CONFIG } from './event.types';

// 配置导出
export {
  URGENCY_TO_BANNER_TYPE,
  URGENCY_PRIORITY,
  EVENT_RANDOM_REFUGEES,
  EVENT_RANDOM_MERCHANTS,
  EVENT_FIXED_HARVEST,
  EVENT_CHAIN_SECRET_LETTER_1,
  EVENT_CHAIN_SECRET_LETTER_2,
  EVENT_CHAIN_SECRET_LETTER_3,
  PREDEFINED_EVENTS,
  EVENT_SAVE_VERSION,
} from './event-config';
