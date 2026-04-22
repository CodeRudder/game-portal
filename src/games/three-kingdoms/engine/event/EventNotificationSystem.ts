/**
 * 引擎层 — 事件通知系统
 *
 * 管理事件触发后的 UI 通知数据生成：
 *   - 急报横幅系统（#22）
 *   - 随机遭遇弹窗（#23）
 *   - 横幅队列管理（优先级排序、自动过期）
 *
 * @module engine/event/EventNotificationSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  EventId, EventTriggerType, EventUrgency, EventBanner, BannerId, BannerType, BannerState,
  EncounterPopup, EncounterId, EncounterOption, EncounterChoiceResult,
  EventOption, EventConsequence, EventInstance, EventTriggerConfig,
} from '../../core/event/event.types';
import { DEFAULT_EVENT_TRIGGER_CONFIG } from '../../core/event/event.types';

const NOTIFICATION_SAVE_VERSION = 1;

const URGENCY_TO_BANNER_TYPE: Record<EventUrgency, BannerType> = { low: 'info', medium: 'warning', high: 'danger', critical: 'opportunity' };
const URGENCY_PRIORITY: Record<EventUrgency, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const BANNER_TYPE_ICONS: Record<BannerType, string> = { info: '📢', warning: '⚠️', danger: '🔴', opportunity: '🌟' };
const BANNER_TYPE_COLORS: Record<BannerType, string> = { info: '#4A90D9', warning: '#F5A623', danger: '#D0021B', opportunity: '#7ED321' };
const RESOURCE_LABELS: Record<string, string> = { gold: '金币', grain: '粮草', troops: '兵力', morale: '士气', mandate: '天命' };

// ─────────────────────────────────────────────
// 事件通知系统
// ─────────────────────────────────────────────

export class EventNotificationSystem implements ISubsystem {
  readonly name = 'eventNotification';
  private deps!: ISystemDeps;
  private config: EventTriggerConfig;
  private banners: Map<BannerId, EventBanner> = new Map();
  private bannerOrder: BannerId[] = [];
  private bannerCounter = 0;
  private activeEncounters: Map<EncounterId, EncounterPopup> = new Map();
  private encounterCounter = 0;
  private resolvedEncounters: Map<EncounterId, EncounterChoiceResult> = new Map();
  private currentTurn = 0;

  constructor(config?: Partial<EventTriggerConfig>) { this.config = { ...DEFAULT_EVENT_TRIGGER_CONFIG, ...config }; }

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void {}
  getState(): BannerState { return this.getBannerState(); }

  reset(): void {
    this.banners.clear(); this.bannerOrder = []; this.bannerCounter = 0;
    this.activeEncounters.clear(); this.encounterCounter = 0; this.resolvedEncounters.clear();
  }

  // ─── #22 急报横幅系统 ─────────────────────

  createBanner(instance: EventInstance, eventDef: { title: string; description: string; urgency: EventUrgency }, currentTurn?: number): EventBanner {
    this.bannerCounter++;
    const bannerType = URGENCY_TO_BANNER_TYPE[eventDef.urgency];
    const priority = URGENCY_PRIORITY[eventDef.urgency];
    const turn = currentTurn ?? this.currentTurn;
    const banner: EventBanner = {
      id: `banner-${this.bannerCounter}`, eventInstanceId: instance.instanceId,
      title: eventDef.title, description: eventDef.description, urgency: eventDef.urgency,
      bannerType, priority, expireTurn: instance.expireTurn, read: false, createdAt: turn,
    };
    this.banners.set(banner.id, banner);
    this.insertBannerOrdered(banner.id, priority);
    this.trimBanners();
    this.deps?.eventBus.emit('event:banner_created', { bannerId: banner.id, eventInstanceId: instance.instanceId, title: banner.title, urgency: banner.urgency });
    return banner;
  }

  createBanners(entries: Array<{ instance: EventInstance; eventDef: { title: string; description: string; urgency: EventUrgency } }>, currentTurn?: number): EventBanner[] {
    return entries.map(e => this.createBanner(e.instance, e.eventDef, currentTurn));
  }

  getBanner(id: BannerId): EventBanner | undefined { const b = this.banners.get(id); return b ? { ...b } : undefined; }
  getActiveBanners(): EventBanner[] { return this.bannerOrder.map(id => this.banners.get(id)).filter((b): b is EventBanner => b !== undefined).map(b => ({ ...b })); }
  getUnreadBanners(): EventBanner[] { return this.getActiveBanners().filter(b => !b.read); }

  getBannerState(): BannerState {
    const active = this.getActiveBanners();
    const unreadCount = active.filter(b => !b.read).length;
    return { activeBanners: active, hasUnread: unreadCount > 0, unreadCount };
  }

  markBannerRead(id: BannerId): boolean { const b = this.banners.get(id); if (!b) return false; b.read = true; return true; }
  markAllBannersRead(): void { for (const b of this.banners.values()) b.read = true; }
  removeBanner(id: BannerId): boolean { const existed = this.banners.delete(id); if (existed) this.bannerOrder = this.bannerOrder.filter(bid => bid !== id); return existed; }
  dismissBanner(id: BannerId): boolean { return this.removeBanner(id); }

  expireBanners(currentTurn: number): EventBanner[] {
    const expired: EventBanner[] = [];
    for (const [id, b] of this.banners) {
      if (b.expireTurn !== null && currentTurn >= b.expireTurn) { expired.push({ ...b }); this.banners.delete(id); this.bannerOrder = this.bannerOrder.filter(bid => bid !== id); }
    }
    return expired;
  }

  checkBannerExpiry(currentTurn: number): EventBanner[] { return this.expireBanners(currentTurn); }
  getBannerIcon(bannerType: BannerType): string { return BANNER_TYPE_ICONS[bannerType]; }
  getBannerColor(bannerType: BannerType): string { return BANNER_TYPE_COLORS[bannerType]; }

  // ─── #23 随机遭遇弹窗 ─────────────────────

  createEncounterPopup(instance: EventInstance, eventDef: { title: string; description: string; urgency: EventUrgency; options: EventOption[] }): EncounterPopup {
    this.encounterCounter++;
    const encounterId = `encounter-${this.encounterCounter}`;
    const encounterOptions: EncounterOption[] = eventDef.options.map(opt => ({
      id: opt.id, text: opt.text, description: opt.description,
      consequencePreview: this.generatePreviewText(opt.consequences),
      available: true, unavailableReason: undefined, consequences: opt.consequences,
    }));
    const popup: EncounterPopup = {
      id: encounterId, eventInstanceId: instance.instanceId,
      title: eventDef.title, description: eventDef.description,
      options: encounterOptions, dismissible: eventDef.urgency !== 'critical', urgency: eventDef.urgency,
    };
    this.activeEncounters.set(encounterId, popup);
    this.deps?.eventBus.emit('event:encounter_created', { encounterId, eventInstanceId: instance.instanceId, title: popup.title, optionCount: popup.options.length });
    return { ...popup, options: [...popup.options] };
  }

  getEncounterPopup(id: EncounterId): EncounterPopup | undefined { const p = this.activeEncounters.get(id); return p ? { ...p, options: [...p.options] } : undefined; }
  getEncounter(id: EncounterId): EncounterPopup | null { const p = this.activeEncounters.get(id); return p ? { ...p, options: [...p.options] } : null; }

  getEncounterByInstance(instanceId: string): EncounterPopup | undefined {
    for (const p of this.activeEncounters.values()) { if (p.eventInstanceId === instanceId) return { ...p, options: [...p.options] }; }
    return undefined;
  }

  getActiveEncounters(): EncounterPopup[] { return Array.from(this.activeEncounters.values()).map(p => ({ ...p, options: [...p.options] })); }

  resolveEncounter(encounterId: EncounterId, optionId: string): EncounterChoiceResult | null {
    const popup = this.activeEncounters.get(encounterId);
    if (!popup) return null;
    const option = popup.options.find(o => o.id === optionId);
    if (!option || !option.available) return null;
    const result: EncounterChoiceResult = {
      encounterId, optionId, consequences: { ...option.consequences },
      resourceChanges: option.consequences?.resourceChanges ? { ...option.consequences.resourceChanges } : undefined,
    };
    this.resolvedEncounters.set(encounterId, result);
    this.activeEncounters.delete(encounterId);
    this.deps?.eventBus.emit('event:encounter_resolved', { encounterId, optionId, consequences: result.consequences });
    return result;
  }

  dismissEncounter(encounterId: EncounterId): boolean {
    const p = this.activeEncounters.get(encounterId);
    if (!p || !p.dismissible) return false;
    this.activeEncounters.delete(encounterId);
    return true;
  }

  getResolvedResult(encounterId: EncounterId): EncounterChoiceResult | null { const r = this.resolvedEncounters.get(encounterId); return r ? { ...r } : null; }

  // ─── 回合管理 ──────────────────────────────

  setCurrentTurn(turn: number): void { this.currentTurn = turn; }
  getCurrentTurn(): number { return this.currentTurn; }
  getConfig(): EventTriggerConfig { return { ...this.config }; }
  setMaxBannerDisplay(max: number): void { this.config.maxBannerCount = max; }
  setBannerDisplayTurns(turns: number): void { this.config.bannerDisplayTurns = turns; }

  // ─── 序列化 ────────────────────────────────

  serializeBanners(): EventBanner[] { return this.getActiveBanners(); }

  deserializeBanners(banners: EventBanner[]): void {
    this.banners.clear(); this.bannerOrder = [];
    for (const b of banners) { this.banners.set(b.id, b); this.bannerOrder.push(b.id); }
  }

  exportSaveData(): EventNotificationSaveData {
    return { banners: this.getActiveBanners(), resolvedEncounters: Array.from(this.resolvedEncounters.values()), version: NOTIFICATION_SAVE_VERSION };
  }

  importSaveData(data: EventNotificationSaveData): void {
    this.banners.clear(); this.bannerOrder = []; this.resolvedEncounters.clear(); this.activeEncounters.clear();
    if (data.banners) for (const b of data.banners) { this.banners.set(b.id, b); this.bannerOrder.push(b.id); }
    if (data.resolvedEncounters) for (const r of data.resolvedEncounters) this.resolvedEncounters.set(r.encounterId, r);
  }

  // ─── 内部方法 ──────────────────────────────

  private insertBannerOrdered(id: BannerId, priority: number): void {
    let idx = this.bannerOrder.length;
    for (let i = 0; i < this.bannerOrder.length; i++) { const b = this.banners.get(this.bannerOrder[i]); if (b && b.priority < priority) { idx = i; break; } }
    this.bannerOrder.splice(idx, 0, id);
  }

  private trimBanners(): void {
    while (this.bannerOrder.length > this.config.maxBannerCount) {
      let removed = false;
      for (let i = this.bannerOrder.length - 1; i >= 0; i--) {
        const b = this.banners.get(this.bannerOrder[i]);
        if (b && b.read) { this.banners.delete(b.id); this.bannerOrder.splice(i, 1); removed = true; break; }
      }
      if (!removed) { const rid = this.bannerOrder.pop()!; this.banners.delete(rid); }
    }
  }

  private generatePreviewText(consequences: EventConsequence): string {
    if (!consequences) return '';
    const parts: string[] = [];
    if (consequences.resourceChanges) { for (const [r, v] of Object.entries(consequences.resourceChanges)) parts.push(`${RESOURCE_LABELS[r] || r}${v > 0 ? '+' : ''}${v}`); }
    if (consequences.affinityChanges) { for (const [n, v] of Object.entries(consequences.affinityChanges)) parts.push(`好感度(${n}) ${v > 0 ? '+' : ''}${v}`); }
    if (consequences.triggerEventId) parts.push('触发后续事件');
    if (consequences.unlockIds?.length) parts.push(`解锁: ${consequences.unlockIds.join(', ')}`);
    return parts.length > 0 ? parts.join(', ') : consequences.description;
  }
}

// ─────────────────────────────────────────────
// 辅助类型
// ─────────────────────────────────────────────

/** 事件通知系统存档数据 */
export interface EventNotificationSaveData {
  banners: EventBanner[];
  resolvedEncounters: EncounterChoiceResult[];
  version: number;
}
