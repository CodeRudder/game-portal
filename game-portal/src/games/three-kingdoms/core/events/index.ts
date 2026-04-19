/**
 * 事件模块 — 统一导出
 *
 * @module core/events
 */

export { EventBus } from './EventBus';
export {
  EngineEvents,
  ResourceEvents,
  BuildingEvents,
  SaveEvents,
  GameEvents,
  GeneralEvents,
  CampaignEvents,
  MapEvents,
  EconomyEvents,
  SocialEvents,
  VisualEvents,
} from './EventTypes';
export type { EventPayloadMap } from './EventTypes';
