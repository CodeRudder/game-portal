/**
 * 引擎层 — 事件 UI 通知系统
 *
 * 管理事件触发的 UI 通知：
 *   - 急报横幅系统（顶部滑入/自动消失）
 *   - 横幅队列管理（优先级排序）
 *   - 随机遭遇弹窗数据生成
 *   - 通知事件总线集成
 *
 * 功能覆盖：
 *   #22 急报横幅系统
 *   #23 随机遭遇弹窗
 *
 * @module engine/event/EventUINotification
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  GameEventId,
  EventPriority,
  EventBanner,
  EventBannerQueue,
  ActiveGameEvent,
  EventOption,
} from '../../core/events';
import {
  BANNER_DEFAULT_DURATION,
  BANNER_MAX_QUEUE_SIZE,
  BANNER_PRIORITY_WEIGHT,
  BANNER_ICONS,
} from '../../core/events';

// ─────────────────────────────────────────────
// 遭遇弹窗数据
// ─────────────────────────────────────────────

/** 遭遇弹窗选项数据 */
export interface EncounterOptionDisplay {
  /** 选项ID */
  id: string;
  /** 选项文本 */
  text: string;
  /** 选项描述 */
  description: string;
  /** 后果预览文本列表 */
  consequencePreviews: string[];
}

/** 遭遇弹窗数据 */
export interface EncounterModalData {
  /** 事件实例ID */
  instanceId: string;
  /** 事件名称 */
  title: string;
  /** 事件描述 */
  description: string;
  /** 事件图标 */
  icon: string;
  /** 事件分类 */
  category: string;
  /** 优先级 */
  priority: EventPriority;
  /** 选项列表 */
  options: EncounterOptionDisplay[];
  /** 是否为紧急事件 */
  isUrgent: boolean;
}

// ─────────────────────────────────────────────
// 事件 UI 通知系统
// ─────────────────────────────────────────────

/**
 * 事件 UI 通知系统
 *
 * 管理急报横幅和遭遇弹窗的数据生成和队列管理。
 * 依赖 EventTriggerSystem 获取活跃事件数据。
 */
export class EventUINotification implements ISubsystem {
  readonly name = 'eventUINotification';

  private deps!: ISystemDeps;
  private bannerQueue: EventBannerQueue = {
    current: null,
    pending: [],
    expired: [],
  };
  private bannerCounter = 0;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.bannerQueue = { current: null, pending: [], expired: [] };
  }

  update(_dt: number): void { /* 预留 */ }

  getState(): { bannerQueue: EventBannerQueue } {
    return {
      bannerQueue: {
        current: this.bannerQueue.current ? { ...this.bannerQueue.current } : null,
        pending: this.bannerQueue.pending.map(b => ({ ...b })),
        expired: this.bannerQueue.expired.map(b => ({ ...b })),
      },
    };
  }

  reset(): void {
    this.bannerQueue = { current: null, pending: [], expired: [] };
    this.bannerCounter = 0;
  }

  // ─── 急报横幅（#22）──────────────────────────

  /**
   * 为事件创建急报横幅
   *
   * @param event - 活跃事件
   * @returns 创建的横幅数据
   */
  createBanner(event: ActiveGameEvent): EventBanner {
    this.bannerCounter++;
    const banner: EventBanner = {
      id: `banner-${this.bannerCounter}-${Date.now()}`,
      eventId: event.eventId,
      title: event.name,
      content: event.description,
      icon: BANNER_ICONS[event.category] ?? '📢',
      priority: event.priority,
      displayDuration: this.getDisplayDuration(event.priority),
      createdAt: Date.now(),
      read: false,
    };

    // 加入队列
    this.enqueueBanner(banner);

    // 发出横幅事件
    this.deps?.eventBus.emit('event:banner_created', {
      bannerId: banner.id,
      eventId: event.eventId,
      title: banner.title,
      priority: banner.priority,
    });

    return { ...banner };
  }

  /**
   * 获取当前显示的横幅
   */
  getCurrentBanner(): EventBanner | null {
    return this.bannerQueue.current ? { ...this.bannerQueue.current } : null;
  }

  /**
   * 标记当前横幅为已读
   */
  markCurrentBannerRead(): boolean {
    if (!this.bannerQueue.current) return false;
    this.bannerQueue.current.read = true;
    return true;
  }

  /**
   * 关闭当前横幅，显示下一个
   *
   * @returns 下一个横幅（无下一个返回null）
   */
  dismissCurrentBanner(): EventBanner | null {
    if (this.bannerQueue.current) {
      this.bannerQueue.expired.push(this.bannerQueue.current);
      // 保留最近50条过期记录
      if (this.bannerQueue.expired.length > 50) {
        this.bannerQueue.expired = this.bannerQueue.expired.slice(-50);
      }
    }

    this.bannerQueue.current = null;

    // 显示下一个
    if (this.bannerQueue.pending.length > 0) {
      this.bannerQueue.current = this.bannerQueue.pending.shift()!;
      return { ...this.bannerQueue.current };
    }

    return null;
  }

  /**
   * 获取待显示横幅数量
   */
  getPendingBannerCount(): number {
    return this.bannerQueue.pending.length;
  }

  /**
   * 获取过期横幅列表
   */
  getExpiredBanners(): EventBanner[] {
    return [...this.bannerQueue.expired];
  }

  // ─── 遭遇弹窗（#23）──────────────────────────

  /**
   * 为活跃事件生成遭遇弹窗数据
   *
   * @param event - 活跃事件
   * @returns 遭遇弹窗数据
   */
  createEncounterModal(event: ActiveGameEvent): EncounterModalData {
    const options: EncounterOptionDisplay[] = event.options.map(opt => ({
      id: opt.id,
      text: opt.text,
      description: opt.description ?? '',
      consequencePreviews: opt.consequences.map(c => c.description),
    }));

    return {
      instanceId: event.instanceId,
      title: event.name,
      description: event.description,
      icon: BANNER_ICONS[event.category] ?? '📢',
      category: event.category,
      priority: event.priority,
      options,
      isUrgent: event.priority === 'urgent',
    };
  }

  /**
   * 批量生成遭遇弹窗数据
   *
   * @param events - 活跃事件列表
   * @returns 遭遇弹窗数据列表
   */
  createEncounterModals(events: ActiveGameEvent[]): EncounterModalData[] {
    return events.map(e => this.createEncounterModal(e));
  }

  // ─── 序列化 ────────────────────────────────

  serialize(): { expiredBanners: EventBanner[] } {
    return {
      expiredBanners: [...this.bannerQueue.expired],
    };
  }

  deserialize(data: { expiredBanners?: EventBanner[] }): void {
    this.bannerQueue = {
      current: null,
      pending: [],
      expired: data.expiredBanners ?? [],
    };
  }

  // ─── 内部方法 ──────────────────────────────

  /** 将横幅加入队列 */
  private enqueueBanner(banner: EventBanner): void {
    if (!this.bannerQueue.current) {
      // 无当前横幅，直接显示
      this.bannerQueue.current = banner;
    } else {
      // 按优先级插入队列
      this.bannerQueue.pending.push(banner);
      this.bannerQueue.pending.sort(
        (a, b) => (BANNER_PRIORITY_WEIGHT[b.priority] ?? 0) - (BANNER_PRIORITY_WEIGHT[a.priority] ?? 0),
      );

      // 限制队列长度
      if (this.bannerQueue.pending.length > BANNER_MAX_QUEUE_SIZE) {
        const removed = this.bannerQueue.pending.splice(BANNER_MAX_QUEUE_SIZE);
        this.bannerQueue.expired.push(...removed);
      }
    }
  }

  /** 根据优先级获取显示时长 */
  private getDisplayDuration(priority: EventPriority): number {
    const durations: Record<EventPriority, number> = {
      urgent: 8000,
      high: 6000,
      normal: BANNER_DEFAULT_DURATION,
      low: 4000,
    };
    return durations[priority] ?? BANNER_DEFAULT_DURATION;
  }
}
