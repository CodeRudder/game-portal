/**
 * EventSystem — 放置游戏活动系统核心模块
 *
 * 提供限时活动管理、活动商店兑换、活动排行榜、
 * 里程碑奖励、活动积分与代币等完整功能。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 事件驱动，支持 UI 层监听活动状态变化
 * - 完整的存档/读档支持
 * - 支持活动商店、里程碑、排名等级
 *
 * @module engines/idle/modules/EventSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 活动状态 */
export type EventStatus = 'upcoming' | 'active' | 'ended';

/** 活动排名等级 */
export type EventTier = 'bronze' | 'silver' | 'gold' | 'diamond';

/** 活动奖励 */
export interface EventReward {
  /** 奖励唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 奖励资源映射 */
  resources: Record<string, number>;
  /** 奖励等级 */
  tier: EventTier;
}

/** 活动商店物品 */
export interface EventShopItem {
  /** 物品唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 消耗活动代币数量 */
  cost: number;
  /** 兑换获得的资源 */
  reward: Record<string, number>;
  /** 库存上限（-1 = 无限） */
  stock: number;
  /** 已购买数量 */
  purchased: number;
}

/** 里程碑定义 */
export interface EventMilestone {
  /** 所需活动积分 */
  points: number;
  /** 里程碑奖励 */
  reward: Record<string, number>;
  /** 是否已领取 */
  claimed: boolean;
}

/** 活动定义（含运行时状态） */
export interface GameEvent {
  /** 活动唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 活动描述 */
  description: string;
  /** 当前状态 */
  status: EventStatus;
  /** 开始时间戳（ms） */
  startsAt: number;
  /** 结束时间戳（ms） */
  endsAt: number;
  /** 活动奖励列表 */
  rewards: EventReward[];
  /** 活动商店 */
  shop: EventShopItem[];
  /** 里程碑列表 */
  milestones: EventMilestone[];
  /** 玩家活动积分 */
  playerPoints: number;
  /** 玩家活动代币 */
  playerTokens: number;
}

/** 活动系统事件 */
export type EventSystemEvent =
  | { type: 'event_registered'; eventId: string }
  | { type: 'event_participated'; eventId: string }
  | { type: 'event_points_added'; eventId: string; points: number }
  | { type: 'event_tokens_added'; eventId: string; tokens: number }
  | { type: 'milestone_claimed'; eventId: string; milestoneIndex: number }
  | { type: 'token_exchanged'; eventId: string; itemId: string }
  | { type: 'event_status_changed'; eventId: string; status: EventStatus };

/** 事件监听器类型 */
export type EventSystemListener = (event: EventSystemEvent) => void;

// ============================================================
// EventSystem 实现
// ============================================================

/**
 * 活动系统 — 管理限时活动、活动商店、排行榜
 *
 * @example
 * ```typescript
 * const eventSys = new EventSystem();
 * eventSys.registerEvent({
 *   id: 'spring_fest',
 *   name: '春节活动',
 *   description: '限时春节庆典',
 *   status: 'upcoming',
 *   startsAt: Date.now() - 1000,
 *   endsAt: Date.now() + 86400000 * 7,
 *   rewards: [],
 *   shop: [],
 *   milestones: [],
 *   playerPoints: 0,
 *   playerTokens: 0,
 * });
 * ```
 */
export class EventSystem {
  private readonly events: Map<string, GameEvent> = new Map();
  private readonly eventListeners: Map<string, EventSystemListener[]> = new Map();

  // ============================================================
  // 初始化
  // ============================================================

  constructor() {
    // 初始化 — 空系统
  }

  // ============================================================
  // 活动注册
  // ============================================================

  /**
   * 注册一个活动
   */
  registerEvent(event: GameEvent): void {
    this.events.set(event.id, {
      ...event,
      milestones: event.milestones.map((m) => ({ ...m })),
      shop: event.shop.map((s) => ({ ...s })),
      rewards: event.rewards.map((r) => ({ ...r })),
    });
    this.emit('event_registered', { type: 'event_registered', eventId: event.id });
  }

  // ============================================================
  // 活动参与
  // ============================================================

  /**
   * 参与活动（仅 active 状态可参与）
   */
  participateEvent(id: string): boolean {
    const event = this.events.get(id);
    if (!event) return false;
    if (event.status !== 'active') return false;
    this.emit('event_participated', { type: 'event_participated', eventId: id });
    return true;
  }

  // ============================================================
  // 积分与代币
  // ============================================================

  /**
   * 增加玩家活动积分
   */
  addPoints(eventId: string, points: number): void {
    const event = this.events.get(eventId);
    if (!event) return;
    event.playerPoints += points;
    this.emit('event_points_added', {
      type: 'event_points_added',
      eventId,
      points,
    });
  }

  /**
   * 增加玩家活动代币
   */
  addTokens(eventId: string, tokens: number): void {
    const event = this.events.get(eventId);
    if (!event) return;
    event.playerTokens += tokens;
    this.emit('event_tokens_added', {
      type: 'event_tokens_added',
      eventId,
      tokens,
    });
  }

  // ============================================================
  // 里程碑
  // ============================================================

  /**
   * 领取里程碑奖励
   * @returns 奖励资源映射，或 null（条件不满足）
   */
  claimMilestone(eventId: string, milestoneIndex: number): Record<string, number> | null {
    const event = this.events.get(eventId);
    if (!event) return null;
    if (milestoneIndex < 0 || milestoneIndex >= event.milestones.length) return null;

    const milestone = event.milestones[milestoneIndex];
    if (milestone.claimed) return null;
    if (event.playerPoints < milestone.points) return null;

    milestone.claimed = true;
    this.emit('milestone_claimed', {
      type: 'milestone_claimed',
      eventId,
      milestoneIndex,
    });
    return { ...milestone.reward };
  }

  // ============================================================
  // 活动商店
  // ============================================================

  /**
   * 使用活动代币兑换商店物品
   * @returns 获得的奖励资源映射，或 null（条件不满足）
   */
  exchangeToken(eventId: string, itemId: string): Record<string, number> | null {
    const event = this.events.get(eventId);
    if (!event) return null;

    const item = event.shop.find((s) => s.id === itemId);
    if (!item) return null;

    // 代币不足
    if (event.playerTokens < item.cost) return null;

    // 库存不足（stock > 0 表示有限库存）
    if (item.stock > 0 && item.purchased >= item.stock) return null;

    event.playerTokens -= item.cost;
    item.purchased++;
    this.emit('token_exchanged', {
      type: 'token_exchanged',
      eventId,
      itemId,
    });
    return { ...item.reward };
  }

  // ============================================================
  // 活动状态
  // ============================================================

  /**
   * 根据当前时间更新所有活动的状态
   */
  updateEventStatuses(currentTime: number): void {
    for (const event of this.events.values()) {
      let newStatus: EventStatus;
      if (currentTime < event.startsAt) {
        newStatus = 'upcoming';
      } else if (currentTime >= event.endsAt) {
        newStatus = 'ended';
      } else {
        newStatus = 'active';
      }

      if (event.status !== newStatus) {
        event.status = newStatus;
        this.emit('event_status_changed', {
          type: 'event_status_changed',
          eventId: event.id,
          status: newStatus,
        });
      }
    }
  }

  /**
   * 获取所有进行中的活动
   */
  getActiveEvents(): GameEvent[] {
    return Array.from(this.events.values()).filter((e) => e.status === 'active');
  }

  /**
   * 获取所有未开始的活动
   */
  getUpcomingEvents(): GameEvent[] {
    return Array.from(this.events.values()).filter((e) => e.status === 'upcoming');
  }

  // ============================================================
  // 排名等级
  // ============================================================

  /**
   * 根据活动积分计算排名等级
   */
  getEventRanking(eventId: string): EventTier {
    const event = this.events.get(eventId);
    if (!event) return 'bronze';

    const points = event.playerPoints;
    if (points >= 1000) return 'diamond';
    if (points >= 500) return 'gold';
    if (points >= 200) return 'silver';
    return 'bronze';
  }

  // ============================================================
  // 事件监听
  // ============================================================

  /**
   * 注册事件监听器
   */
  on(event: string, callback: EventSystemListener): void {
    const listeners = this.eventListeners.get(event) ?? [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);
  }

  // ============================================================
  // 序列化
  // ============================================================

  /**
   * 序列化活动系统状态
   */
  serialize(): object {
    const data: Record<string, GameEvent> = {};
    for (const [id, event] of this.events) {
      data[id] = {
        ...event,
        milestones: event.milestones.map((m) => ({ ...m })),
        shop: event.shop.map((s) => ({ ...s })),
        rewards: event.rewards.map((r) => ({ ...r })),
      };
    }
    return data;
  }

  /**
   * 反序列化恢复活动系统状态
   */
  deserialize(data: object): void {
    this.events.clear();
    const record = data as Record<string, GameEvent>;
    for (const [id, event] of Object.entries(record)) {
      this.events.set(id, {
        ...event,
        milestones: event.milestones.map((m) => ({ ...m })),
        shop: event.shop.map((s) => ({ ...s })),
        rewards: event.rewards.map((r) => ({ ...r })),
      });
    }
  }

  // ============================================================
  // 内部工具
  // ============================================================

  private emit(event: string, payload: EventSystemEvent): void {
    const listeners = this.eventListeners.get(event) ?? [];
    for (const listener of listeners) {
      try {
        listener(payload);
      } catch {
        // 忽略监听器异常
      }
    }
  }
}
