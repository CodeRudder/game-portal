/**
 * 引擎层 — 事件通知系统
 *
 * 管理事件触发后的 UI 通知数据生成：
 *   - 急报横幅系统（#22）：事件触发时顶部横幅通知
 *   - 随机遭遇弹窗（#23）：事件选项+后果选择
 *   - 横幅队列管理（优先级排序、自动过期）
 *   - 横幅已读/未读状态管理
 *
 * 与 EventUINotification 的关系：
 *   本系统基于 core/event/event.types.ts 中的类型定义，
 *   提供更丰富的通知管理功能（已读状态、横幅过期、遭遇弹窗选项过滤）。
 *
 * @module engine/event/EventNotificationSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  EventId,
  EventTriggerType,
  EventUrgency,
  EventBanner,
  BannerId,
  BannerType,
  BannerState,
  EncounterPopup,
  EncounterId,
  EncounterOption,
  EncounterChoiceResult,
  EventOption,
  EventConsequence,
  EventInstance,
  EventTriggerConfig,
} from '../../core/event/event.types';
import {
  DEFAULT_EVENT_TRIGGER_CONFIG,
} from '../../core/event/event.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 通知系统存档版本 */
const NOTIFICATION_SAVE_VERSION = 1;

/** 紧急程度到横幅类型的映射 */
const URGENCY_TO_BANNER_TYPE: Record<EventUrgency, BannerType> = {
  low: 'info',
  medium: 'warning',
  high: 'danger',
  critical: 'opportunity',
} as const;

/** 紧急程度到优先级数值的映射 */
const URGENCY_PRIORITY: Record<EventUrgency, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
} as const;

/** 横幅类型图标映射 */
const BANNER_TYPE_ICONS: Record<BannerType, string> = {
  info: '📢',
  warning: '⚠️',
  danger: '🔴',
  opportunity: '🌟',
} as const;

/** 横幅类型颜色映射 */
const BANNER_TYPE_COLORS: Record<BannerType, string> = {
  info: '#4A90D9',
  warning: '#F5A623',
  danger: '#D0021B',
  opportunity: '#7ED321',
} as const;

/** 资源键到中文名称的映射 */
const RESOURCE_LABELS: Record<string, string> = {
  gold: '金币',
  grain: '粮草',
  troops: '兵力',
  morale: '士气',
  mandate: '天命',
};

// ─────────────────────────────────────────────
// 事件通知系统
// ─────────────────────────────────────────────

/**
 * 事件通知系统
 *
 * 管理急报横幅和随机遭遇弹窗的数据生成、队列管理和状态追踪。
 *
 * @example
 * ```ts
 * const notifySys = new EventNotificationSystem();
 * notifySys.init(deps);
 *
 * // 创建急报横幅
 * const banner = notifySys.createBanner(eventInstance, eventDef, currentTurn);
 *
 * // 标记已读
 * notifySys.markBannerRead(banner.id);
 *
 * // 移除横幅
 * notifySys.removeBanner(banner.id);
 *
 * // 创建遭遇弹窗
 * const popup = notifySys.createEncounterPopup(eventInstance, eventDef);
 *
 * // 选择遭遇选项
 * const result = notifySys.resolveEncounter(popup.id, 'option-1');
 * ```
 */
export class EventNotificationSystem implements ISubsystem {
  readonly name = 'eventNotification';

  private deps!: ISystemDeps;
  private config: EventTriggerConfig;

  // 横幅管理
  private banners: Map<BannerId, EventBanner> = new Map();
  private bannerOrder: BannerId[] = [];
  private bannerCounter = 0;

  // 遭遇弹窗管理
  private activeEncounters: Map<EncounterId, EncounterPopup> = new Map();
  private encounterCounter = 0;

  // 已解析的遭遇结果
  private resolvedEncounters: Map<EncounterId, EncounterChoiceResult> = new Map();

  constructor(config?: Partial<EventTriggerConfig>) {
    this.config = { ...DEFAULT_EVENT_TRIGGER_CONFIG, ...config };
  }

  // ─── ISubsystem 生命周期 ────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 预留：横幅自动过期检查
  }

  getState(): BannerState {
    return this.getBannerState();
  }

  reset(): void {
    this.banners.clear();
    this.bannerOrder = [];
    this.bannerCounter = 0;
    this.activeEncounters.clear();
    this.encounterCounter = 0;
    this.resolvedEncounters.clear();
  }

  // ─────────────────────────────────────────
  // #22 急报横幅系统
  // ─────────────────────────────────────────

  /**
   * 为事件实例创建急报横幅
   *
   * @param instance - 事件实例
   * @param eventDef - 事件定义（包含标题、描述等）
   * @param currentTurn - 当前回合（用于 createdAt）
   * @returns 创建的横幅数据
   */
  createBanner(
    instance: EventInstance,
    eventDef: { title: string; description: string; urgency: EventUrgency },
    currentTurn?: number,
  ): EventBanner {
    this.bannerCounter++;
    const bannerType = URGENCY_TO_BANNER_TYPE[eventDef.urgency];
    const priority = URGENCY_PRIORITY[eventDef.urgency];
    const turn = currentTurn ?? this.getCurrentTurn();

    const banner: EventBanner = {
      id: `banner-${this.bannerCounter}`,
      eventInstanceId: instance.instanceId,
      title: eventDef.title,
      description: eventDef.description,
      urgency: eventDef.urgency,
      bannerType,
      priority,
      expireTurn: instance.expireTurn,
      read: false,
      createdAt: turn,
    };

    this.banners.set(banner.id, banner);
    this.insertBannerOrdered(banner.id, priority);

    // 限制横幅数量
    this.trimBanners();

    // 发出横幅创建事件
    this.deps?.eventBus.emit('event:banner_created', {
      bannerId: banner.id,
      eventInstanceId: instance.instanceId,
      title: banner.title,
      urgency: banner.urgency,
    });

    return banner;
  }

  /**
   * 批量创建横幅
   *
   * @param entries - 事件实例与定义的配对数组
   * @param currentTurn - 当前回合
   * @returns 创建的横幅数组
   */
  createBanners(
    entries: Array<{
      instance: EventInstance;
      eventDef: { title: string; description: string; urgency: EventUrgency };
    }>,
    currentTurn?: number,
  ): EventBanner[] {
    return entries.map(entry =>
      this.createBanner(entry.instance, entry.eventDef, currentTurn),
    );
  }

  /**
   * 获取横幅
   *
   * @param id - 横幅 ID
   * @returns 横幅数据，不存在返回 undefined
   */
  getBanner(id: BannerId): EventBanner | undefined {
    const banner = this.banners.get(id);
    return banner ? { ...banner } : undefined;
  }

  /**
   * 获取所有活跃横幅（按优先级排序）
   */
  getActiveBanners(): EventBanner[] {
    return this.bannerOrder
      .map(id => this.banners.get(id))
      .filter((b): b is EventBanner => b !== undefined)
      .map(b => ({ ...b }));
  }

  /**
   * 获取未读横幅列表
   */
  getUnreadBanners(): EventBanner[] {
    return this.getActiveBanners().filter(b => !b.read);
  }

  /**
   * 获取横幅状态
   */
  getBannerState(): BannerState {
    const active = this.getActiveBanners();
    const unreadCount = active.filter(b => !b.read).length;
    return {
      activeBanners: active,
      hasUnread: unreadCount > 0,
      unreadCount,
    };
  }

  /**
   * 标记横幅为已读
   *
   * @param id - 横幅 ID
   * @returns 是否成功
   */
  markBannerRead(id: BannerId): boolean {
    const banner = this.banners.get(id);
    if (!banner) return false;
    banner.read = true;
    return true;
  }

  /**
   * 标记所有横幅为已读
   */
  markAllBannersRead(): void {
    for (const banner of this.banners.values()) {
      banner.read = true;
    }
  }

  /**
   * 移除横幅
   *
   * @param id - 横幅 ID
   * @returns 是否成功移除
   */
  removeBanner(id: BannerId): boolean {
    const existed = this.banners.delete(id);
    if (existed) {
      this.bannerOrder = this.bannerOrder.filter(bid => bid !== id);
    }
    return existed;
  }

  /**
   * 关闭横幅（别名方法）
   *
   * @param id - 横幅 ID
   * @returns 是否成功关闭
   */
  dismissBanner(id: BannerId): boolean {
    return this.removeBanner(id);
  }

  /**
   * 过期横幅清理
   *
   * @param currentTurn - 当前回合
   * @returns 过期的横幅列表
   */
  expireBanners(currentTurn: number): EventBanner[] {
    const expired: EventBanner[] = [];

    for (const [id, banner] of this.banners) {
      if (banner.expireTurn !== null && currentTurn >= banner.expireTurn) {
        expired.push({ ...banner });
        this.banners.delete(id);
        this.bannerOrder = this.bannerOrder.filter(bid => bid !== id);
      }
    }

    return expired;
  }

  /**
   * 过期横幅检查（别名方法）
   *
   * @param currentTurn - 当前回合
   * @returns 过期的横幅列表
   */
  checkBannerExpiry(currentTurn: number): EventBanner[] {
    return this.expireBanners(currentTurn);
  }

  /**
   * 获取横幅图标
   */
  getBannerIcon(bannerType: BannerType): string {
    return BANNER_TYPE_ICONS[bannerType];
  }

  /**
   * 获取横幅颜色
   */
  getBannerColor(bannerType: BannerType): string {
    return BANNER_TYPE_COLORS[bannerType];
  }

  // ─────────────────────────────────────────
  // #23 随机遭遇弹窗
  // ─────────────────────────────────────────

  /**
   * 创建遭遇弹窗
   *
   * @param instance - 事件实例
   * @param eventDef - 事件定义（包含选项等）
   * @returns 遭遇弹窗数据
   */
  createEncounterPopup(
    instance: EventInstance,
    eventDef: {
      title: string;
      description: string;
      urgency: EventUrgency;
      options: EventOption[];
    },
  ): EncounterPopup {
    this.encounterCounter++;
    const encounterId = `encounter-${this.encounterCounter}`;

    // 将事件选项转换为遭遇选项
    const encounterOptions: EncounterOption[] = eventDef.options.map(opt => ({
      id: opt.id,
      text: opt.text,
      description: opt.description,
      consequencePreview: this.generatePreviewText(opt.consequences),
      available: this.checkOptionAvailability(opt),
      unavailableReason: this.getUnavailableReason(opt),
      consequences: opt.consequences,
    }));

    const popup: EncounterPopup = {
      id: encounterId,
      eventInstanceId: instance.instanceId,
      title: eventDef.title,
      description: eventDef.description,
      options: encounterOptions,
      dismissible: eventDef.urgency !== 'critical',
      urgency: eventDef.urgency,
    };

    this.activeEncounters.set(encounterId, popup);

    // 发出遭遇弹窗创建事件
    this.deps?.eventBus.emit('event:encounter_created', {
      encounterId,
      eventInstanceId: instance.instanceId,
      title: popup.title,
      optionCount: popup.options.length,
    });

    return { ...popup, options: [...popup.options] };
  }

  /**
   * 获取遭遇弹窗
   *
   * @param id - 遭遇弹窗 ID
   * @returns 弹窗数据，不存在返回 undefined
   */
  getEncounterPopup(id: EncounterId): EncounterPopup | undefined {
    const popup = this.activeEncounters.get(id);
    return popup
      ? { ...popup, options: [...popup.options] }
      : undefined;
  }

  /**
   * 获取遭遇弹窗（别名方法）
   *
   * @param id - 遭遇弹窗 ID
   * @returns 弹窗数据，不存在返回 null
   */
  getEncounter(id: EncounterId): EncounterPopup | null {
    const popup = this.activeEncounters.get(id);
    return popup
      ? { ...popup, options: [...popup.options] }
      : null;
  }

  /**
   * 按事件实例ID获取遭遇弹窗
   *
   * @param instanceId - 事件实例ID
   * @returns 弹窗数据，不存在返回 undefined
   */
  getEncounterByInstance(instanceId: string): EncounterPopup | undefined {
    for (const popup of this.activeEncounters.values()) {
      if (popup.eventInstanceId === instanceId) {
        return { ...popup, options: [...popup.options] };
      }
    }
    return undefined;
  }

  /**
   * 获取所有活跃遭遇弹窗
   */
  getActiveEncounters(): EncounterPopup[] {
    return Array.from(this.activeEncounters.values())
      .map(p => ({ ...p, options: [...p.options] }));
  }

  /**
   * 解决遭遇 — 选择一个选项
   *
   * @param encounterId - 遭遇弹窗 ID
   * @param optionId - 选择的选项 ID
   * @returns 选择结果，失败返回 null
   */
  resolveEncounter(encounterId: EncounterId, optionId: string): EncounterChoiceResult | null {
    const popup = this.activeEncounters.get(encounterId);
    if (!popup) return null;

    const option = popup.options.find(o => o.id === optionId);
    if (!option) return null;
    if (!option.available) return null;

    const result: EncounterChoiceResult = {
      encounterId,
      optionId,
      consequences: { ...option.consequences },
      // 透传 resourceChanges 以便测试直接访问
      resourceChanges: option.consequences?.resourceChanges
        ? { ...option.consequences.resourceChanges }
        : undefined,
    };

    // 记录结果
    this.resolvedEncounters.set(encounterId, result);

    // 移除活跃遭遇
    this.activeEncounters.delete(encounterId);

    // 发出遭遇解决事件
    this.deps?.eventBus.emit('event:encounter_resolved', {
      encounterId,
      optionId,
      consequences: result.consequences,
    });

    return result;
  }

  /**
   * 关闭遭遇弹窗（不选择选项）
   *
   * @param encounterId - 遭遇弹窗 ID
   * @returns 是否成功关闭
   */
  dismissEncounter(encounterId: EncounterId): boolean {
    const popup = this.activeEncounters.get(encounterId);
    if (!popup) return false;
    if (!popup.dismissible) return false;

    this.activeEncounters.delete(encounterId);
    return true;
  }

  /**
   * 获取已解决的遭遇结果
   *
   * @param encounterId - 遭遇弹窗 ID
   * @returns 选择结果，无则 null
   */
  getResolvedResult(encounterId: EncounterId): EncounterChoiceResult | null {
    const result = this.resolvedEncounters.get(encounterId);
    return result ? { ...result } : null;
  }

  // ─────────────────────────────────────────
  // 回合管理
  // ─────────────────────────────────────────

  /**
   * 设置当前回合（用于过期检查）
   */
  setCurrentTurn(turn: number): void {
    this.currentTurn = turn;
  }

  private currentTurn = 0;

  /** 获取当前回合 */
  getCurrentTurn(): number {
    return this.currentTurn;
  }

  // ─────────────────────────────────────────
  // 配置
  // ─────────────────────────────────────────

  /** 获取配置 */
  getConfig(): EventTriggerConfig {
    return { ...this.config };
  }

  /**
   * 设置最大横幅显示数量
   */
  setMaxBannerDisplay(max: number): void {
    this.config.maxBannerCount = max;
  }

  /**
   * 设置横幅显示回合数
   */
  setBannerDisplayTurns(turns: number): void {
    this.config.bannerDisplayTurns = turns;
  }

  // ─────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────

  /** 导出横幅数据 */
  serializeBanners(): EventBanner[] {
    return this.getActiveBanners();
  }

  /** 导入横幅数据 */
  deserializeBanners(banners: EventBanner[]): void {
    this.banners.clear();
    this.bannerOrder = [];

    for (const banner of banners) {
      this.banners.set(banner.id, banner);
      this.bannerOrder.push(banner.id);
    }
  }

  /** 导出存档数据 */
  exportSaveData(): EventNotificationSaveData {
    return {
      banners: this.getActiveBanners(),
      resolvedEncounters: Array.from(this.resolvedEncounters.values()),
      version: NOTIFICATION_SAVE_VERSION,
    };
  }

  /** 导入存档数据 */
  importSaveData(data: EventNotificationSaveData): void {
    this.banners.clear();
    this.bannerOrder = [];
    this.resolvedEncounters.clear();
    this.activeEncounters.clear();

    if (data.banners) {
      for (const banner of data.banners) {
        this.banners.set(banner.id, banner);
        this.bannerOrder.push(banner.id);
      }
    }

    if (data.resolvedEncounters) {
      for (const result of data.resolvedEncounters) {
        this.resolvedEncounters.set(result.encounterId, result);
      }
    }
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /** 按优先级插入横幅 */
  private insertBannerOrdered(id: BannerId, priority: number): void {
    let insertIndex = this.bannerOrder.length;
    for (let i = 0; i < this.bannerOrder.length; i++) {
      const existingBanner = this.banners.get(this.bannerOrder[i]);
      if (existingBanner && existingBanner.priority < priority) {
        insertIndex = i;
        break;
      }
    }
    this.bannerOrder.splice(insertIndex, 0, id);
  }

  /** 裁剪超出上限的横幅 */
  private trimBanners(): void {
    while (this.bannerOrder.length > this.config.maxBannerCount) {
      // 移除最旧的已读横幅，如果没有已读的则移除末尾
      let removed = false;
      for (let i = this.bannerOrder.length - 1; i >= 0; i--) {
        const banner = this.banners.get(this.bannerOrder[i]);
        if (banner && banner.read) {
          this.banners.delete(banner.id);
          this.bannerOrder.splice(i, 1);
          removed = true;
          break;
        }
      }
      if (!removed) {
        const removedId = this.bannerOrder.pop()!;
        this.banners.delete(removedId);
      }
    }
  }

  /** 生成后果预览文本 */
  private generatePreviewText(consequences: EventConsequence): string {
    if (!consequences) return '';

    const parts: string[] = [];

    if (consequences.resourceChanges) {
      for (const [resource, value] of Object.entries(consequences.resourceChanges)) {
        const label = RESOURCE_LABELS[resource] || resource;
        parts.push(`${label}${value > 0 ? '+' : ''}${value}`);
      }
    }

    if (consequences.affinityChanges) {
      for (const [npcId, value] of Object.entries(consequences.affinityChanges)) {
        parts.push(`好感度(${npcId}) ${value > 0 ? '+' : ''}${value}`);
      }
    }

    if (consequences.triggerEventId) {
      parts.push('触发后续事件');
    }

    if (consequences.unlockIds && consequences.unlockIds.length > 0) {
      parts.push(`解锁: ${consequences.unlockIds.join(', ')}`);
    }

    return parts.length > 0 ? parts.join(', ') : consequences.description;
  }

  /** 检查选项是否可用 */
  private checkOptionAvailability(_option: EventOption): boolean {
    // 基础实现：所有选项都可用
    // 未来可扩展条件检查
    return true;
  }

  /** 获取选项不可用原因 */
  private getUnavailableReason(_option: EventOption): string | undefined {
    // 基础实现：无不可用原因
    return undefined;
  }
}

// ─────────────────────────────────────────────
// 辅助类型
// ─────────────────────────────────────────────

/** 事件通知系统存档数据 */
export interface EventNotificationSaveData {
  /** 活跃横幅列表 */
  banners: EventBanner[];
  /** 已解决的遭遇结果 */
  resolvedEncounters: EncounterChoiceResult[];
  /** 版本号 */
  version: number;
}
