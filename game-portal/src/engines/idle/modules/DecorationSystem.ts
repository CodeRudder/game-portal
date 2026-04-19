/**
 * DecorationSystem — 放置游戏装饰系统核心模块
 *
 * 提供皮肤系统（建筑/角色/地图）、称号系统、头像框、
 * 特效装饰等外观自定义功能。
 *
 * @module engines/idle/modules/DecorationSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 皮肤类型 */
export type SkinType = 'building' | 'character' | 'map';

/** 稀有度 */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** 皮肤定义 */
export interface SkinDef {
  id: string;
  name: string;
  type: SkinType;
  rarity: Rarity;
  icon: string;
  description: string;
  targetId: string; // 应用目标 ID（建筑ID/角色ID/地图ID）
  effects?: string[]; // 特效标识列表
}

/** 称号定义 */
export interface TitleDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: Rarity;
  condition?: string; // 获取条件描述
}

/** 头像框定义 */
export interface AvatarFrameDef {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  borderColor: string;
  effects?: string[];
}

/** 特效装饰定义 */
export interface EffectDef {
  id: string;
  name: string;
  type: 'entrance' | 'click' | 'idle' | 'battle';
  icon: string;
  description: string;
  rarity: Rarity;
  duration?: number; // 持续时间(ms)，0=永久
}

/** 装饰系统持久化状态 */
export interface DecorationState {
  /** 已拥有的皮肤 ID 集合 */
  ownedSkins: string[];
  /** 已拥有的称号 ID 集合 */
  ownedTitles: string[];
  /** 已拥有的头像框 ID 集合 */
  ownedAvatarFrames: string[];
  /** 已拥有的特效 ID 集合 */
  ownedEffects: string[];
  /** 当前装备的皮肤：skinType → skinId */
  equippedSkins: Record<string, string>;
  /** 当前装备的称号 ID */
  equippedTitle: string | null;
  /** 当前装备的头像框 ID */
  equippedAvatarFrame: string | null;
  /** 当前装备的特效 ID 列表 */
  equippedEffects: string[];
}

/** 装饰系统事件 */
export type DecorationEvent =
  | { type: 'skin_unlocked'; skinId: string }
  | { type: 'skin_equipped'; skinId: string; skinType: SkinType }
  | { type: 'skin_unequipped'; skinType: SkinType }
  | { type: 'title_unlocked'; titleId: string }
  | { type: 'title_equipped'; titleId: string }
  | { type: 'avatar_frame_unlocked'; frameId: string }
  | { type: 'avatar_frame_equipped'; frameId: string }
  | { type: 'effect_equipped'; effectId: string };

/** 事件监听器类型 */
export type DecorationEventListener = (event: DecorationEvent) => void;

// ============================================================
// DecorationSystem 实现
// ////////////////////////////////////////////////////////////

/**
 * 装饰系统 — 管理皮肤、称号、头像框、特效装饰
 *
 * @example
 * ```typescript
 * const deco = new DecorationSystem();
 * deco.registerSkins([
 *   { id: 'skin_castle_gold', name: '黄金城堡', type: 'building', rarity: 'legendary', targetId: 'castle', icon: '🏰' },
 * ]);
 * deco.unlockSkin('skin_castle_gold');
 * deco.equipSkin('skin_castle_gold');
 * ```
 */
export class DecorationSystem {

  // ========== 内部数据 ==========

  /** 皮肤定义注册表 */
  private readonly skinDefs: Map<string, SkinDef> = new Map();

  /** 称号定义注册表 */
  private readonly titleDefs: Map<string, TitleDef> = new Map();

  /** 头像框定义注册表 */
  private readonly avatarFrameDefs: Map<string, AvatarFrameDef> = new Map();

  /** 特效定义注册表 */
  private readonly effectDefs: Map<string, EffectDef> = new Map();

  /** 运行时状态 */
  private state: DecorationState = {
    ownedSkins: [],
    ownedTitles: [],
    ownedAvatarFrames: [],
    ownedEffects: [],
    equippedSkins: {},
    equippedTitle: null,
    equippedAvatarFrame: null,
    equippedEffects: [],
  };

  /** 事件监听器 */
  private readonly listeners: DecorationEventListener[] = [];

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 注册皮肤定义
   */
  registerSkins(skins: SkinDef[]): void {
    for (const s of skins) this.skinDefs.set(s.id, s);
  }

  /**
   * 注册称号定义
   */
  registerTitles(titles: TitleDef[]): void {
    for (const t of titles) this.titleDefs.set(t.id, t);
  }

  /**
   * 注册头像框定义
   */
  registerAvatarFrames(frames: AvatarFrameDef[]): void {
    for (const f of frames) this.avatarFrameDefs.set(f.id, f);
  }

  /**
   * 注册特效定义
   */
  registerEffects(effects: EffectDef[]): void {
    for (const e of effects) this.effectDefs.set(e.id, e);
  }

  loadState(data: Partial<DecorationState>): void {
    if (data.ownedSkins) this.state.ownedSkins = [...data.ownedSkins];
    if (data.ownedTitles) this.state.ownedTitles = [...data.ownedTitles];
    if (data.ownedAvatarFrames) this.state.ownedAvatarFrames = [...data.ownedAvatarFrames];
    if (data.ownedEffects) this.state.ownedEffects = [...data.ownedEffects];
    if (data.equippedSkins) this.state.equippedSkins = { ...data.equippedSkins };
    if (data.equippedTitle !== undefined) this.state.equippedTitle = data.equippedTitle;
    if (data.equippedAvatarFrame !== undefined) this.state.equippedAvatarFrame = data.equippedAvatarFrame;
    if (data.equippedEffects) this.state.equippedEffects = [...data.equippedEffects];
  }

  saveState(): DecorationState {
    return {
      ownedSkins: [...this.state.ownedSkins],
      ownedTitles: [...this.state.ownedTitles],
      ownedAvatarFrames: [...this.state.ownedAvatarFrames],
      ownedEffects: [...this.state.ownedEffects],
      equippedSkins: { ...this.state.equippedSkins },
      equippedTitle: this.state.equippedTitle,
      equippedAvatarFrame: this.state.equippedAvatarFrame,
      equippedEffects: [...this.state.equippedEffects],
    };
  }

  // ============================================================
  // 查询
  // ============================================================

  /** 获取所有已拥有的皮肤 */
  get skins(): SkinDef[] {
    return this.state.ownedSkins.map((id) => this.skinDefs.get(id)).filter((s): s is SkinDef => !!s);
  }

  /** 获取所有已拥有的称号 */
  get titles(): TitleDef[] {
    return this.state.ownedTitles.map((id) => this.titleDefs.get(id)).filter((t): t is TitleDef => !!t);
  }

  /** 获取所有已拥有的头像框 */
  get avatars(): AvatarFrameDef[] {
    return this.state.ownedAvatarFrames.map((id) => this.avatarFrameDefs.get(id)).filter((f): f is AvatarFrameDef => !!f);
  }

  /** 获取所有已拥有的特效 */
  get effects(): EffectDef[] {
    return this.state.ownedEffects.map((id) => this.effectDefs.get(id)).filter((e): e is EffectDef => !!e);
  }

  /**
   * 获取当前装备的皮肤
   */
  getEquippedSkin(type: SkinType): SkinDef | null {
    const skinId = this.state.equippedSkins[type];
    if (!skinId) return null;
    return this.skinDefs.get(skinId) ?? null;
  }

  /**
   * 获取当前装备的称号
   */
  getEquippedTitle(): TitleDef | null {
    if (!this.state.equippedTitle) return null;
    return this.titleDefs.get(this.state.equippedTitle) ?? null;
  }

  /**
   * 获取当前装备的头像框
   */
  getEquippedAvatarFrame(): AvatarFrameDef | null {
    if (!this.state.equippedAvatarFrame) return null;
    return this.avatarFrameDefs.get(this.state.equippedAvatarFrame) ?? null;
  }

  /**
   * 检查是否拥有指定皮肤
   */
  ownsSkin(id: string): boolean {
    return this.state.ownedSkins.includes(id);
  }

  /**
   * 检查是否拥有指定称号
   */
  ownsTitle(id: string): boolean {
    return this.state.ownedTitles.includes(id);
  }

  /**
   * 检查是否拥有指定头像框
   */
  ownsAvatarFrame(id: string): boolean {
    return this.state.ownedAvatarFrames.includes(id);
  }

  // ============================================================
  // 操作 — 解锁
  // ============================================================

  /**
   * 解锁皮肤
   */
  unlockSkin(id: string): boolean {
    if (!this.skinDefs.has(id)) return false;
    if (this.state.ownedSkins.includes(id)) return false;
    this.state.ownedSkins.push(id);
    this.emitEvent({ type: 'skin_unlocked', skinId: id });
    return true;
  }

  /**
   * 解锁称号
   */
  unlockTitle(id: string): boolean {
    if (!this.titleDefs.has(id)) return false;
    if (this.state.ownedTitles.includes(id)) return false;
    this.state.ownedTitles.push(id);
    this.emitEvent({ type: 'title_unlocked', titleId: id });
    return true;
  }

  /**
   * 解锁头像框
   */
  unlockAvatarFrame(id: string): boolean {
    if (!this.avatarFrameDefs.has(id)) return false;
    if (this.state.ownedAvatarFrames.includes(id)) return false;
    this.state.ownedAvatarFrames.push(id);
    this.emitEvent({ type: 'avatar_frame_unlocked', frameId: id });
    return true;
  }

  /**
   * 解锁特效
   */
  unlockEffect(id: string): boolean {
    if (!this.effectDefs.has(id)) return false;
    if (this.state.ownedEffects.includes(id)) return false;
    this.state.ownedEffects.push(id);
    return true;
  }

  // ============================================================
  // 操作 — 装备
  // ============================================================

  /**
   * 装备皮肤
   */
  equipSkin(id: string): boolean {
    const def = this.skinDefs.get(id);
    if (!def || !this.state.ownedSkins.includes(id)) return false;

    this.state.equippedSkins[def.type] = id;
    this.emitEvent({ type: 'skin_equipped', skinId: id, skinType: def.type });
    return true;
  }

  /**
   * 装备称号
   */
  equipTitle(id: string): boolean {
    if (!this.state.ownedTitles.includes(id)) return false;
    this.state.equippedTitle = id;
    this.emitEvent({ type: 'title_equipped', titleId: id });
    return true;
  }

  /**
   * 装备头像框
   */
  equipAvatarFrame(id: string): boolean {
    if (!this.state.ownedAvatarFrames.includes(id)) return false;
    this.state.equippedAvatarFrame = id;
    this.emitEvent({ type: 'avatar_frame_equipped', frameId: id });
    return true;
  }

  /**
   * 装备特效
   */
  equipEffect(id: string): boolean {
    if (!this.state.ownedEffects.includes(id)) return false;
    if (this.state.equippedEffects.includes(id)) return false;
    if (this.state.equippedEffects.length >= 3) return false; // 最多3个特效
    this.state.equippedEffects.push(id);
    this.emitEvent({ type: 'effect_equipped', effectId: id });
    return true;
  }

  /**
   * 卸下皮肤
   */
  unequipSkin(type: SkinType): boolean {
    if (!this.state.equippedSkins[type]) return false;
    delete this.state.equippedSkins[type];
    this.emitEvent({ type: 'skin_unequipped', skinType: type });
    return true;
  }

  /**
   * 卸下称号
   */
  unequipTitle(): boolean {
    if (!this.state.equippedTitle) return false;
    this.state.equippedTitle = null;
    return true;
  }

  /**
   * 卸下头像框
   */
  unequipAvatarFrame(): boolean {
    if (!this.state.equippedAvatarFrame) return false;
    this.state.equippedAvatarFrame = null;
    return true;
  }

  /**
   * 卸下特效
   */
  unequipEffect(id: string): boolean {
    const idx = this.state.equippedEffects.indexOf(id);
    if (idx === -1) return false;
    this.state.equippedEffects.splice(idx, 1);
    return true;
  }

  // ============================================================
  // 事件
  // ============================================================

  onEvent(listener: DecorationEventListener): void {
    this.listeners.push(listener);
  }

  offEvent(listener: DecorationEventListener): void {
    const idx = this.listeners.indexOf(listener);
    if (idx !== -1) this.listeners.splice(idx, 1);
  }

  // ============================================================
  // 重置
  // ============================================================

  reset(): void {
    this.state = {
      ownedSkins: [],
      ownedTitles: [],
      ownedAvatarFrames: [],
      ownedEffects: [],
      equippedSkins: {},
      equippedTitle: null,
      equippedAvatarFrame: null,
      equippedEffects: [],
    };
  }

  // ============================================================
  // 内部工具
  // ============================================================

  private emitEvent(event: DecorationEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (_error) {
        // 忽略
      }
    }
  }
}
