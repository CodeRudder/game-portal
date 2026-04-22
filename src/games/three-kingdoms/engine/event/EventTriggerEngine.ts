/**
 * 引擎层 — 事件触发引擎 v15.0
 * #6 触发条件(时间+条件+概率) #7 概率公式(加法+乘法修正)
 * #8 通知优先级(6级) #9 事件冷却 #10 选项系统(2-3分支)
 * P = clamp(base + Σ(additive) * Π(multiplicative), 0, 1)
 * @module engine/event/EventTriggerEngine
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { EventId } from '../../core/event';
import type {
  TriggerConditionGroup, TimeCondition, StateCondition,
  ProbabilityCondition, ProbabilityModifier, ProbabilityResult,
  EventNotification, CooldownRecord, BranchOption, NotificationPriority,
} from '../../core/event/event-v15.types';
import { NotificationPriority as NotificationPriorityEnum } from '../../core/event/event-v15.types';

const MAX_NOTIFICATION_QUEUE_SIZE = 50;
const DEFAULT_COOLDOWN_TURNS = 5;

/** 管理触发条件评估、概率计算、通知优先级、冷却、分支选项 */
export class EventTriggerEngine implements ISubsystem {
  readonly name = 'eventTriggerEngine';

  private deps!: ISystemDeps;
  private conditionGroups: Map<EventId, TriggerConditionGroup> = new Map();
  private cooldowns: Map<EventId, CooldownRecord> = new Map();
  private notifications: EventNotification[] = [];
  private notificationIdCounter = 0;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 由外部 tick 驱动
  }

  getState() {
    return {
      conditionGroups: new Map(this.conditionGroups),
      cooldowns: new Map(this.cooldowns),
      notifications: [...this.notifications],
    };
  }

  reset(): void {
    this.conditionGroups.clear();
    this.cooldowns.clear();
    this.notifications = [];
    this.notificationIdCounter = 0;
  }

  // ─── #6 触发条件引擎 ──────────────────────

  /**
   * 注册触发条件组
   */
  registerConditionGroup(group: TriggerConditionGroup): void {
    this.conditionGroups.set(group.eventId, group);
  }

  /**
   * 批量注册触发条件组
   */
  registerConditionGroups(groups: TriggerConditionGroup[]): void {
    for (const g of groups) {
      this.registerConditionGroup(g);
    }
  }

  /**
   * 评估触发条件
   *
   * @param eventId - 事件ID
   * @param currentTurn - 当前回合
   * @param gameState - 游戏状态快照
   * @returns 是否满足触发条件
   */
  evaluateTriggerConditions(
    eventId: EventId,
    currentTurn: number,
    gameState: Record<string, number>,
  ): boolean {
    const group = this.conditionGroups.get(eventId);
    if (!group) return true; // 无条件组默认可触发

    // 检查冷却
    if (this.isOnCooldown(eventId, currentTurn)) return false;

    // 评估时间条件
    const timeOk = !group.timeCondition || this.evaluateTimeCondition(group.timeCondition, currentTurn);

    // 评估状态条件
    const stateOk = group.stateConditions.length === 0
      || (group.logicOperator === 'AND'
        ? group.stateConditions.every((c) => this.evaluateStateCondition(c, gameState))
        : group.stateConditions.some((c) => this.evaluateStateCondition(c, gameState)));

    return timeOk && stateOk;
  }

  /**
   * 评估时间条件
   */
  evaluateTimeCondition(cond: TimeCondition, currentTurn: number): boolean {
    if (cond.minTurn !== undefined && currentTurn < cond.minTurn) return false;
    if (cond.maxTurn !== undefined && currentTurn > cond.maxTurn) return false;
    if (cond.turnInterval !== undefined && currentTurn % cond.turnInterval !== 0) return false;
    return true;
  }

  /**
   * 评估状态条件
   */
  evaluateStateCondition(cond: StateCondition, gameState: Record<string, number>): boolean {
    const value = gameState[cond.target] ?? 0;
    switch (cond.operator) {
      case '>=': return value >= cond.value;
      case '<=': return value <= cond.value;
      case '==': return value === cond.value;
      case '!=': return value !== cond.value;
      case '>':  return value > cond.value;
      case '<':  return value < cond.value;
      default: return false;
    }
  }

  // ─── #7 概率触发公式 ──────────────────────

  /**
   * 计算最终触发概率
   *
   * 公式：P = clamp(base + Σ(active_additive) * Π(active_multiplicative), 0, 1)
   *
   * @param probCondition - 概率条件
   * @returns 概率计算结果
   */
  calculateProbability(probCondition: ProbabilityCondition): ProbabilityResult {
    const { baseProbability, modifiers } = probCondition;

    // 加法修正
    const additiveTotal = modifiers
      .filter((m) => m.active)
      .reduce((sum, m) => sum + m.additiveBonus, 0);

    // 乘法修正
    const multiplicativeTotal = modifiers
      .filter((m) => m.active)
      .reduce((product, m) => product * m.multiplicativeBonus, 1);

    // 最终概率
    const finalProbability = Math.max(0, Math.min(1,
      (baseProbability + additiveTotal) * multiplicativeTotal,
    ));

    // 触发判定
    const triggered = Math.random() < finalProbability;

    return {
      finalProbability,
      baseProbability,
      additiveTotal,
      multiplicativeTotal,
      triggered,
    };
  }

  /**
   * 便捷方法：计算事件触发概率并判定
   */
  rollEventTrigger(eventId: EventId): ProbabilityResult {
    const group = this.conditionGroups.get(eventId);
    if (!group) {
      return {
        finalProbability: 0,
        baseProbability: 0,
        additiveTotal: 0,
        multiplicativeTotal: 0,
        triggered: false,
      };
    }
    return this.calculateProbability(group.probabilityCondition);
  }

  /**
   * 创建概率条件
   */
  static createProbabilityCondition(
    baseProbability: number,
    modifiers?: ProbabilityModifier[],
  ): ProbabilityCondition {
    return {
      baseProbability,
      modifiers: modifiers ?? [],
    };
  }

  /**
   * 创建概率修正因子
   */
  static createModifier(
    name: string,
    additiveBonus: number,
    multiplicativeBonus: number,
    active: boolean,
  ): ProbabilityModifier {
    return { name, additiveBonus, multiplicativeBonus, active };
  }

  // ─── #8 通知优先级（6级）──────────────────

  /**
   * 发送通知
   */
  sendNotification(
    eventId: EventId,
    title: string,
    content: string,
    priority: NotificationPriority,
    expireAt: number | null = null,
  ): EventNotification {
    this.notificationIdCounter++;
    const notification: EventNotification = {
      id: `notif-${this.notificationIdCounter}`,
      eventId,
      title,
      content,
      priority,
      createdAt: Date.now(),
      expireAt,
      read: false,
    };

    this.notifications.push(notification);

    // 按优先级排序（低数值=高优先级）
    this.notifications.sort((a, b) => a.priority - b.priority);

    // 裁剪队列
    if (this.notifications.length > MAX_NOTIFICATION_QUEUE_SIZE) {
      this.notifications = this.notifications.slice(0, MAX_NOTIFICATION_QUEUE_SIZE);
    }

    return notification;
  }

  /**
   * 获取所有通知（按优先级排序）
   */
  getNotifications(): EventNotification[] {
    return [...this.notifications];
  }

  /**
   * 获取未读通知
   */
  getUnreadNotifications(): EventNotification[] {
    return this.notifications.filter((n) => !n.read);
  }

  /**
   * 标记通知已读
   */
  markNotificationRead(notificationId: string): boolean {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (notif) {
      notif.read = true;
      return true;
    }
    return false;
  }

  /**
   * 全部标记已读
   */
  markAllRead(): void {
    this.notifications.forEach((n) => { n.read = true; });
  }

  /**
   * 清理过期通知
   */
  cleanExpiredNotifications(now: number): number {
    const before = this.notifications.length;
    this.notifications = this.notifications.filter(
      (n) => n.expireAt === null || n.expireAt > now,
    );
    return before - this.notifications.length;
  }

  /**
   * 按优先级过滤通知
   */
  getNotificationsByPriority(priority: NotificationPriority): EventNotification[] {
    return this.notifications.filter((n) => n.priority === priority);
  }

  /**
   * 获取最高优先级未读通知
   */
  getHighestPriorityUnread(): EventNotification | null {
    const unread = this.getUnreadNotifications();
    return unread.length > 0 ? unread[0] : null;
  }

  // ─── #9 事件冷却 ──────────────────────────

  /**
   * 设置冷却
   */
  setCooldown(eventId: EventId, startTurn: number, durationTurns: number): CooldownRecord {
    const record: CooldownRecord = {
      eventId,
      startTurn,
      endTurn: startTurn + durationTurns,
      remainingTurns: durationTurns,
    };
    this.cooldowns.set(eventId, record);
    return record;
  }

  /**
   * 检查是否在冷却中
   */
  isOnCooldown(eventId: EventId, currentTurn: number): boolean {
    const record = this.cooldowns.get(eventId);
    if (!record) return false;
    return currentTurn < record.endTurn;
  }

  /**
   * 获取冷却剩余回合
   */
  getCooldownRemaining(eventId: EventId, currentTurn: number): number {
    const record = this.cooldowns.get(eventId);
    if (!record) return 0;
    return Math.max(0, record.endTurn - currentTurn);
  }

  /**
   * 获取所有冷却记录
   */
  getAllCooldowns(): CooldownRecord[] {
    return Array.from(this.cooldowns.values());
  }

  /**
   * 清除冷却
   */
  clearCooldown(eventId: EventId): void {
    this.cooldowns.delete(eventId);
  }

  /**
   * 清理过期冷却
   */
  cleanExpiredCooldowns(currentTurn: number): number {
    let cleaned = 0;
    for (const [eventId, record] of this.cooldowns) {
      if (currentTurn >= record.endTurn) {
        this.cooldowns.delete(eventId);
        cleaned++;
      }
    }
    return cleaned;
  }

  // ─── #10 事件选项系统（2-3分支）──────────────

  /**
   * 评估分支选项可见性
   *
   * @param options - 分支选项列表
   * @param gameState - 游戏状态快照
   * @returns 评估后的选项列表（含可用状态）
   */
  evaluateBranchOptions(
    options: BranchOption[],
    gameState: Record<string, number>,
  ): BranchOption[] {
    return options.map((opt) => {
      if (!opt.visibilityConditions || opt.visibilityConditions.length === 0) {
        return { ...opt, available: true };
      }

      const allMet = opt.visibilityConditions.every(
        (cond) => this.evaluateStateCondition(cond, gameState),
      );

      return {
        ...opt,
        available: allMet,
        unavailableReason: allMet ? undefined : '条件不满足',
      };
    });
  }

  /**
   * 获取可用选项
   */
  getAvailableOptions(
    options: BranchOption[],
    gameState: Record<string, number>,
  ): BranchOption[] {
    return this.evaluateBranchOptions(options, gameState)
      .filter((o) => o.available);
  }

  // ─── 工具方法 ──────────────────────────────

  /**
   * 获取触发条件组
   */
  getConditionGroup(eventId: EventId): TriggerConditionGroup | undefined {
    return this.conditionGroups.get(eventId);
  }

  /**
   * 获取所有条件组
   */
  getAllConditionGroups(): TriggerConditionGroup[] {
    return Array.from(this.conditionGroups.values());
  }

  /**
   * 获取通知优先级枚举
   */
  static getPriorityLevels(): typeof NotificationPriorityEnum {
    return NotificationPriorityEnum;
  }

  // ─── 序列化 ──────────────────────────────

  /** 导出存档 */
  serialize(): {
    cooldowns: Array<{ eventId: EventId; startTurn: number; endTurn: number }>;
    notifications: EventNotification[];
  } {
    return {
      cooldowns: Array.from(this.cooldowns.values()).map((r) => ({
        eventId: r.eventId,
        startTurn: r.startTurn,
        endTurn: r.endTurn,
      })),
      notifications: this.notifications.map((n) => ({ ...n })),
    };
  }

  /** 导入存档 */
  deserialize(data: {
    cooldowns: Array<{ eventId: EventId; startTurn: number; endTurn: number }>;
    notifications: EventNotification[];
  }): void {
    this.cooldowns.clear();
    for (const c of data.cooldowns ?? []) {
      this.cooldowns.set(c.eventId, {
        eventId: c.eventId,
        startTurn: c.startTurn,
        endTurn: c.endTurn,
        remainingTurns: c.endTurn - c.startTurn,
      });
    }

    this.notifications = (data.notifications ?? []).map((n) => ({ ...n }));
  }
}
