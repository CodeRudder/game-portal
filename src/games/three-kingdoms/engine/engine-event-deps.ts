/**
 * 引擎事件系统依赖注入
 *
 * 从 ThreeKingdomsEngine 中拆分出的事件系统初始化逻辑。
 * 职责：创建事件子系统实例、注入依赖、提供上下文接口
 *
 * 包含子系统：
 *   - EventTriggerSystem — 事件触发管理（时间/条件/概率触发）
 *   - EventNotificationSystem — 事件通知管理（急报横幅）
 *   - EventUINotification — 事件UI通知（随机遭遇弹窗）
 *   - EventChainSystem — 事件链管理（连锁事件）
 *   - EventLogSystem — 事件日志（历史记录+回归急报）
 *   - OfflineEventSystem — 离线事件处理
 *
 * @module engine/engine-event-deps
 */

import { EventTriggerSystem } from './event/EventTriggerSystem';
import { EventNotificationSystem } from './event/EventNotificationSystem';
import { EventUINotification } from './event/EventUINotification';
import { EventChainSystem } from './event/EventChainSystem';
import { EventLogSystem } from './event/EventLogSystem';
import { OfflineEventSystem } from './event/OfflineEventSystem';
import { EventTriggerEngine } from './event/EventTriggerEngine';
import { ChainEventEngine } from './event/ChainEventEngine';
import type { ISystemDeps } from '../core/types';

// ─────────────────────────────────────────────
// 事件子系统集合
// ─────────────────────────────────────────────

/** 事件域核心子系统的集合 */
export interface EventSystems {
  readonly trigger: EventTriggerSystem;
  readonly notification: EventNotificationSystem;
  readonly uiNotification: EventUINotification;
  readonly chain: EventChainSystem;
  readonly log: EventLogSystem;
  readonly offline: OfflineEventSystem;
}

// ─────────────────────────────────────────────
// 创建 & 初始化
// ─────────────────────────────────────────────

/**
 * 创建事件子系统实例
 *
 * 事件子系统间通过 SubsystemRegistry 互相查询，
 * 无需在构造时注入直接依赖。
 *
 * 初始化顺序（init 调用顺序）：
 * 1. EventTriggerSystem — 事件触发核心
 * 2. EventNotificationSystem — 通知管理（依赖触发系统）
 * 3. EventUINotification — UI通知（依赖通知系统）
 * 4. EventChainSystem — 事件链（依赖触发系统）
 * 5. EventLogSystem — 事件日志（依赖通知系统）
 * 6. OfflineEventSystem — 离线处理（依赖触发+日志系统）
 */
export function createEventSystems(): EventSystems {
  const trigger = new EventTriggerSystem();
  const notification = new EventNotificationSystem();
  const uiNotification = new EventUINotification();
  const chain = new EventChainSystem();
  const log = new EventLogSystem();
  const offline = new OfflineEventSystem();

  return { trigger, notification, uiNotification, chain, log, offline };
}

/**
 * 初始化事件子系统（注入依赖）
 *
 * 按依赖顺序初始化，确保基础系统先就绪。
 */
export function initEventSystems(systems: EventSystems, deps: ISystemDeps): void {
  systems.trigger.init(deps);
  systems.notification.init(deps);
  systems.uiNotification.init(deps);
  systems.chain.init(deps);
  systems.log.init(deps);
  systems.offline.init(deps);
}
