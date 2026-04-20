/**
 * 引擎层 — 事件系统深化
 *
 * 扩展 EventTriggerSystem，支持：
 *   - 连锁事件深化：前序事件选择影响后续事件触发
 *   - 历史剧情事件：全屏沉浸式剧情体验
 *   - 事件日志面板：查看所有历史事件记录
 *   - 回归急报堆：离线多个事件堆叠展示
 *
 * 功能覆盖：
 *   #10 连锁事件深化
 *   #11 历史剧情事件
 *   #13 事件日志面板
 *   #14 回归急报堆展示
 *
 * @module engine/event/EventChainSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  EventId,
  EventDef,
  EventInstance,
  EventChoiceResult,
  EventCondition,
} from '../../core/event';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 连锁事件链定义 */
export interface EventChain {
  /** 链唯一 ID */
  id: string;
  /** 链名称 */
  name: string;
  /** 链描述 */
  description: string;
  /** 事件节点列表 */
  nodes: EventChainNode[];
  /** 最大深度（防止无限递归） */
  maxDepth: number;
}

/** 连锁事件节点 */
export interface EventChainNode {
  /** 节点 ID */
  id: string;
  /** 关联事件定义 ID */
  eventDefId: EventId;
  /** 前序节点 ID */
  parentNodeId?: string;
  /** 前序选项 ID（哪个选择触发此节点） */
  parentOptionId?: string;
  /** 深度 */
  depth: number;
}

/** 剧情事件定义 */
export interface StoryEventDef {
  /** 事件 ID */
  id: EventId;
  /** 标题 */
  title: string;
  /** 剧情文本列表 */
  storyLines: StoryLine[];
  /** 触发条件 */
  triggerConditions: EventCondition[];
  /** 背景图标识 */
  backgroundImage?: string;
  /** 角色立绘标识列表 */
  characterPortraits?: string[];
  /** 是否已触发 */
  triggered: boolean;
}

/** 剧情行 */
export interface StoryLine {
  /** 说话者 */
  speaker: string;
  /** 文本 */
  text: string;
  /** 玩家选项（如有） */
  choices?: StoryChoice[];
}

/** 剧情选项 */
export interface StoryChoice {
  /** 选项文本 */
  text: string;
  /** 后果描述 */
  consequence: string;
  /** 资源变化 */
  resourceChanges?: Record<string, number>;
  /** 触发后续事件 */
  triggerEventId?: EventId;
}

/** 事件日志条目 */
export interface EventLogEntry {
  /** 日志 ID */
  id: string;
  /** 事件定义 ID */
  eventDefId: EventId;
  /** 事件标题 */
  title: string;
  /** 事件描述 */
  description: string;
  /** 玩家选择 */
  chosenOptionText?: string;
  /** 后果描述 */
  consequenceDescription?: string;
  /** 触发回合 */
  triggeredTurn: number;
  /** 解决回合 */
  resolvedTurn?: number;
  /** 时间戳 */
  timestamp: number;
  /** 事件类型标记 */
  eventType: 'random' | 'fixed' | 'chain' | 'story';
}

/** 回归急报条目 */
export interface ReturnAlert {
  /** 急报 ID */
  id: string;
  /** 关联事件实例 ID */
  eventInstanceId?: string;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 紧急程度 */
  urgency: 'low' | 'medium' | 'high' | 'critical';
  /** 发生时间 */
  timestamp: number;
  /** 是否已读 */
  read: boolean;
  /** 类型 */
  alertType: 'event' | 'story' | 'chain' | 'npc';
}

/** 事件深化系统存档 */
export interface EventChainSaveData {
  version: number;
  eventChains: Array<{
    id: string;
    currentNodeId: string | null;
    completedNodeIds: string[];
  }>;
  triggeredStoryEventIds: EventId[];
  eventLog: EventLogEntry[];
  returnAlerts: ReturnAlert[];
}

// ─────────────────────────────────────────────
// 事件深化系统
// ─────────────────────────────────────────────

/**
 * 事件深化系统
 *
 * 管理连锁事件链、历史剧情事件、事件日志和回归急报。
 */
export class EventChainSystem implements ISubsystem {
  readonly name = 'eventChain';

  private deps!: ISystemDeps;
  private chains: Map<string, EventChain> = new Map();
  private chainProgress: Map<string, { currentNodeId: string | null; completedNodeIds: Set<string> }> = new Map();
  private storyEvents: Map<EventId, StoryEventDef> = new Map();
  private eventLog: EventLogEntry[] = [];
  private returnAlerts: ReturnAlert[] = [];
  private logIdCounter = 0;
  private alertIdCounter = 0;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 事件触发由外部 tick 驱动
  }

  getState() {
    return {
      chains: new Map(this.chains),
      chainProgress: new Map(this.chainProgress),
      storyEvents: new Map(this.storyEvents),
      eventLog: [...this.eventLog],
      returnAlerts: [...this.returnAlerts],
    };
  }

  reset(): void {
    this.chains.clear();
    this.chainProgress.clear();
    this.storyEvents.clear();
    this.eventLog = [];
    this.returnAlerts = [];
    this.logIdCounter = 0;
    this.alertIdCounter = 0;
  }

  // ─── 连锁事件深化（#10）───────────────────────

  /** 注册事件链 */
  registerChain(chain: EventChain): void {
    if (chain.maxDepth > 3) {
      throw new Error(`[EventChainSystem] 连锁链 ${chain.id} 最大深度不能超过3`);
    }
    this.chains.set(chain.id, chain);
    this.chainProgress.set(chain.id, { currentNodeId: null, completedNodeIds: new Set() });
  }

  /** 批量注册 */
  registerChains(chains: EventChain[]): void {
    chains.forEach((c) => this.registerChain(c));
  }

  /** 获取链的当前节点 */
  getCurrentChainNode(chainId: string): EventChainNode | null {
    const chain = this.chains.get(chainId);
    const progress = this.chainProgress.get(chainId);
    if (!chain || !progress || !progress.currentNodeId) return null;

    return chain.nodes.find((n) => n.id === progress.currentNodeId) ?? null;
  }

  /**
   * 推进连锁事件链
   *
   * 根据玩家选择推进到下一个节点。
   *
   * @param chainId - 链 ID
   * @param optionId - 玩家选择的选项 ID
   * @returns 下一个事件节点，无后续返回 null
   */
  advanceChain(chainId: string, optionId: string): EventChainNode | null {
    const chain = this.chains.get(chainId);
    const progress = this.chainProgress.get(chainId);
    if (!chain || !progress) return null;

    // 标记当前节点完成
    if (progress.currentNodeId) {
      progress.completedNodeIds.add(progress.currentNodeId);
    }

    // 查找匹配选项的下一个节点
    const nextNode = chain.nodes.find(
      (n) => n.parentOptionId === optionId && n.depth <= chain.maxDepth,
    ) ?? null;

    if (nextNode) {
      progress.currentNodeId = nextNode.id;

      this.deps?.eventBus.emit('event:chainAdvanced', {
        chainId,
        nodeId: nextNode.id,
        eventDefId: nextNode.eventDefId,
      });
    } else {
      progress.currentNodeId = null;
    }

    return nextNode;
  }

  /** 开始事件链 */
  startChain(chainId: string): EventChainNode | null {
    const chain = this.chains.get(chainId);
    if (!chain || chain.nodes.length === 0) return null;

    const firstNode = chain.nodes.find((n) => n.depth === 0);
    if (!firstNode) return null;

    const progress = this.chainProgress.get(chainId);
    if (progress) {
      progress.currentNodeId = firstNode.id;
    }

    return firstNode;
  }

  /** 获取链的进度 */
  getChainProgress(chainId: string): { completedCount: number; totalCount: number } {
    const chain = this.chains.get(chainId);
    const progress = this.chainProgress.get(chainId);
    if (!chain || !progress) return { completedCount: 0, totalCount: 0 };

    return {
      completedCount: progress.completedNodeIds.size,
      totalCount: chain.nodes.length,
    };
  }

  // ─── 历史剧情事件（#11）───────────────────────

  /** 注册剧情事件 */
  registerStoryEvent(event: StoryEventDef): void {
    this.storyEvents.set(event.id, event);
  }

  /** 批量注册 */
  registerStoryEvents(events: StoryEventDef[]): void {
    events.forEach((e) => this.registerStoryEvent(e));
  }

  /** 检查剧情事件是否可触发 */
  canTriggerStoryEvent(eventId: EventId): boolean {
    const event = this.storyEvents.get(eventId);
    if (!event || event.triggered) return false;

    // 条件检查（简化）
    return true;
  }

  /** 触发剧情事件 */
  triggerStoryEvent(eventId: EventId): StoryEventDef | null {
    const event = this.storyEvents.get(eventId);
    if (!event || event.triggered) return null;

    event.triggered = true;

    // 记录日志
    this.addLogEntry({
      eventDefId: event.id,
      title: event.title,
      description: event.storyLines.map((l) => l.text).join(' '),
      eventType: 'story',
      triggeredTurn: 0,
      timestamp: Date.now(),
    });

    // 添加急报
    this.addReturnAlert({
      title: event.title,
      description: event.storyLines[0]?.text ?? '',
      urgency: 'high',
      alertType: 'story',
    });

    this.deps?.eventBus.emit('event:storyTriggered', { eventId, title: event.title });

    return event;
  }

  /** 获取剧情事件 */
  getStoryEvent(eventId: EventId): StoryEventDef | undefined {
    return this.storyEvents.get(eventId);
  }

  /** 获取所有剧情事件 */
  getAllStoryEvents(): StoryEventDef[] {
    return Array.from(this.storyEvents.values());
  }

  // ─── 事件日志面板（#13）───────────────────────

  /** 添加日志条目 */
  addLogEntry(entry: Omit<EventLogEntry, 'id'>): EventLogEntry {
    const logEntry: EventLogEntry = {
      ...entry,
      id: `log-${++this.logIdCounter}`,
    };
    this.eventLog.push(logEntry);

    // 限制日志数量：超过100条自动截断
    if (this.eventLog.length > 100) {
      this.eventLog = this.eventLog.slice(-100);
    }

    return logEntry;
  }

  /** 记录事件解决 */
  logEventResolved(
    eventDefId: EventId,
    title: string,
    description: string,
    chosenOptionText: string,
    consequenceDescription: string,
    eventType: 'random' | 'fixed' | 'chain' | 'story',
    triggeredTurn: number,
    resolvedTurn: number,
  ): EventLogEntry {
    return this.addLogEntry({
      eventDefId,
      title,
      description,
      chosenOptionText,
      consequenceDescription,
      triggeredTurn,
      resolvedTurn,
      timestamp: Date.now(),
      eventType,
    });
  }

  /** 获取事件日志 */
  getEventLog(limit?: number, eventType?: string): EventLogEntry[] {
    let log = [...this.eventLog];
    if (eventType) {
      log = log.filter((e) => e.eventType === eventType);
    }
    if (limit) {
      log = log.slice(-limit);
    }
    return log;
  }

  /** 获取日志总数 */
  getLogCount(): number {
    return this.eventLog.length;
  }

  // ─── 回归急报堆（#14）───────────────────────

  /** 添加急报 */
  addReturnAlert(alert: Omit<ReturnAlert, 'id' | 'timestamp' | 'read'>): ReturnAlert {
    const newAlert: ReturnAlert = {
      ...alert,
      id: `alert-${++this.alertIdCounter}`,
      timestamp: Date.now(),
      read: false,
    };
    this.returnAlerts.push(newAlert);
    return newAlert;
  }

  /** 批量添加急报（离线回归时） */
  addOfflineAlerts(events: Array<{ title: string; description: string; urgency: 'low' | 'medium' | 'high' | 'critical' }>): ReturnAlert[] {
    return events.map((e) => this.addReturnAlert({
      title: e.title,
      description: e.description,
      urgency: e.urgency,
      alertType: 'event',
    }));
  }

  /** 获取所有急报 */
  getReturnAlerts(unreadOnly?: boolean): ReturnAlert[] {
    if (unreadOnly) {
      return this.returnAlerts.filter((a) => !a.read);
    }
    return [...this.returnAlerts];
  }

  /** 标记急报已读 */
  markAlertRead(alertId: string): boolean {
    const alert = this.returnAlerts.find((a) => a.id === alertId);
    if (!alert) return false;
    alert.read = true;
    return true;
  }

  /** 全部标记已读 */
  markAllAlertsRead(): void {
    this.returnAlerts.forEach((a) => { a.read = true; });
  }

  /** 清除已读急报 */
  clearReadAlerts(): void {
    this.returnAlerts = this.returnAlerts.filter((a) => !a.read);
  }

  /** 获取未读急报数量 */
  getUnreadAlertCount(): number {
    return this.returnAlerts.filter((a) => !a.read).length;
  }

  // ─── 序列化 ────────────────────────────────

  serialize(): EventChainSaveData {
    return {
      version: 1,
      eventChains: Array.from(this.chainProgress.entries()).map(([id, progress]) => ({
        id,
        currentNodeId: progress.currentNodeId,
        completedNodeIds: Array.from(progress.completedNodeIds),
      })),
      triggeredStoryEventIds: Array.from(this.storyEvents.values())
        .filter((e) => e.triggered)
        .map((e) => e.id),
      eventLog: this.eventLog.slice(-100),
      returnAlerts: this.returnAlerts.slice(-50),
    };
  }

  deserialize(data: EventChainSaveData): void {
    this.chainProgress.clear();
    for (const chain of data.eventChains ?? []) {
      this.chainProgress.set(chain.id, {
        currentNodeId: chain.currentNodeId,
        completedNodeIds: new Set(chain.completedNodeIds),
      });
    }

    for (const id of data.triggeredStoryEventIds ?? []) {
      const event = this.storyEvents.get(id);
      if (event) event.triggered = true;
    }

    this.eventLog = data.eventLog ?? [];
    this.returnAlerts = data.returnAlerts ?? [];
  }
}
