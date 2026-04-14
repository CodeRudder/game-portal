/**
 * DeitySystem — 放置游戏神明庇护系统核心模块（P2）
 * 零外部依赖，纯回调数组实现事件监听。
 * @module engines/idle/modules/DeitySystem
 */

// ============================================================
// 类型定义
// ============================================================

export interface DeityDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  domain: string;
  /** 基础加成 { 属性名: 加成值 } */
  bonus: Record<string, number>;
  requires?: string;
  exclusiveWith?: string[];
  unlockCondition?: Record<string, number>;
  maxFavorLevel: number;
  favorPerLevel: number;
  /** @deprecated 旧 API 兼容字段 */
  title?: string;
  bonusType?: 'multiplier' | 'flat' | 'chance' | 'unlock';
  bonusValue?: number;
  bonusTarget?: string;
  blessingCosts?: Record<string, number>;
  costScaling?: number;
  maxBlessingLevel?: number;
  bonusPerLevel?: number;
  mutuallyExclusive?: string[];
  lore?: string;
}

export interface DeityState {
  unlocked: string[];
  activeDeity: string | null;
  favor: Record<string, number>;
}

export interface DeityEvent {
  type: 'deity_unlocked' | 'deity_activated' | 'deity_deactivated'
    | 'favor_increased' | 'favor_maxed' | 'blessing_performed' | 'blessing_maxed';
  deityId?: string;
}

// ============================================================
// DeitySystem
// ============================================================

/**
 * 神明庇护系统 — 管理神明的解锁、激活、好感度与加成计算。
 * 核心规则：同时只能激活一位神明；互斥时自动停用旧神明；
 * 好感加成倍率：bonus × (1 + favorLevel × 0.1)。
 * @typeParam Def - 神明定义类型
 */
export class DeitySystem<Def extends DeityDef = DeityDef> {
  private readonly defs = new Map<string, Def>();
  private unlocked = new Set<string>();
  private activeDeity: string | null = null;
  private favor: Record<string, number> = {};
  private totalBlessings = 0;
  private readonly listeners: Array<(e: DeityEvent) => void> = [];

  constructor(defs: Def[]) { for (const d of defs) this.defs.set(d.id, d); }

  // ---- 兼容辅助 ----
  private excl(d: Def): string[] { return d.exclusiveWith ?? d.mutuallyExclusive ?? []; }
  private maxLvl(d: Def): number { return d.maxFavorLevel ?? d.maxBlessingLevel ?? 10; }
  private fpl(d: Def): number { return d.favorPerLevel ?? 100; }
  private isOld(d: Def): boolean { return d.bonusType !== undefined || d.bonusValue !== undefined; }
  private bMap(d: Def): Record<string, number> {
    if (d.bonus && Object.keys(d.bonus).length > 0) return d.bonus;
    return (d.bonusTarget !== undefined && d.bonusValue !== undefined)
      ? { [d.bonusTarget]: d.bonusValue } : {};
  }

  // ==================== 激活 / 停用 ====================

  /** 激活神明。互斥旧格式返回 false；新格式自动停用旧神明再激活。 */
  activate(id: string): boolean {
    const def = this.defs.get(id);
    if (!def || !this.unlocked.has(id)) return false;
    if (this.activeDeity === id) return true;
    if (this.activeDeity !== null) {
      const cur = this.defs.get(this.activeDeity);
      const isExcl = (cur ? this.excl(cur) : []).includes(id)
        || this.excl(def).includes(this.activeDeity);
      // 旧格式互斥 → 拒绝
      if (isExcl && (this.isOld(def) || (cur && this.isOld(cur)))) return false;
      const old = this.activeDeity; this.activeDeity = null;
      this.emit({ type: 'deity_deactivated', deityId: old });
    }
    this.activeDeity = id;
    this.emit({ type: 'deity_activated', deityId: id });
    return true;
  }

  /** 停用当前激活的神明 */
  deactivate(): void {
    if (!this.activeDeity) return;
    const old = this.activeDeity; this.activeDeity = null;
    this.emit({ type: 'deity_deactivated', deityId: old });
  }

  /** 获取当前激活神明的定义 */
  getActive(): Def | null {
    return this.activeDeity ? (this.defs.get(this.activeDeity) ?? null) : null;
  }

  // ==================== 加成计算 ====================

  /** 无参数→当前激活神明加成映射（含好感倍率）；传 id→旧 API 对象 */
  getBonus(id?: string): Record<string, number> | { target: string; type: string; value: number } {
    if (id !== undefined) return this.getBonusById(id);
    if (!this.activeDeity) return {};
    const def = this.defs.get(this.activeDeity);
    if (!def) return {};
    const m = 1 + this.getFavorLevel(this.activeDeity) * 0.1;
    const r: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.bMap(def))) r[k] = v * m;
    return r;
  }

  // ==================== 好感度 ====================

  /** 增加当前激活神明的好感度，上限 maxFavorLevel × favorPerLevel */
  addFavor(amount: number): boolean {
    if (!this.activeDeity || amount <= 0) return false;
    const def = this.defs.get(this.activeDeity);
    if (!def) return false;
    const ml = this.maxLvl(def), pl = this.fpl(def);
    const prev = this.favor[this.activeDeity] ?? 0;
    const pLvl = Math.min(ml, Math.floor(prev / pl));
    this.favor[this.activeDeity] = Math.min(ml * pl, prev + amount);
    const nLvl = Math.min(ml, Math.floor(this.favor[this.activeDeity] / pl));
    this.emit({ type: 'favor_increased', deityId: this.activeDeity });
    if (nLvl >= ml && pLvl < ml) this.emit({ type: 'favor_maxed', deityId: this.activeDeity });
    return true;
  }

  /** 好感等级 = floor(favor / favorPerLevel)，上限 maxFavorLevel */
  getFavorLevel(id: string): number {
    const d = this.defs.get(id);
    if (!d) return 0;
    return Math.min(this.maxLvl(d), Math.floor((this.favor[id] ?? 0) / this.fpl(d)));
  }

  // ==================== 解锁 ====================

  isUnlocked(id: string): boolean { return this.unlocked.has(id); }

  /** 批量检查解锁条件（requires + unlockCondition），返回新解锁 ID 列表 */
  checkUnlocks(stats: Record<string, number>): string[] {
    const res: string[] = [];
    for (const [id, def] of this.defs) {
      if (this.unlocked.has(id)) continue;
      if (def.requires && !this.unlocked.has(def.requires)) continue;
      if (def.unlockCondition) {
        let ok = true;
        for (const [k, v] of Object.entries(def.unlockCondition))
          if ((stats[k] ?? 0) < v) { ok = false; break; }
        if (!ok) continue;
      }
      this.unlocked.add(id); res.push(id);
      if (this.favor[id] === undefined) this.favor[id] = 0;
      this.emit({ type: 'deity_unlocked', deityId: id });
    }
    return res;
  }

  getAllDeities(): Def[] { return Array.from(this.defs.values()); }

  // ==================== 持久化 ====================

  saveState(): DeityState {
    return { unlocked: Array.from(this.unlocked), activeDeity: this.activeDeity, favor: { ...this.favor } };
  }

  loadState(data: DeityState): void {
    this.reset();
    if (Array.isArray(data.unlocked))
      for (const id of data.unlocked) if (typeof id === 'string') this.unlocked.add(id);
    this.activeDeity = typeof data.activeDeity === 'string' ? data.activeDeity : null;
    if (data.favor && typeof data.favor === 'object' && !Array.isArray(data.favor))
      for (const [k, v] of Object.entries(data.favor))
        if (typeof v === 'number') this.favor[k] = v;
  }

  reset(): void { this.unlocked = new Set(); this.activeDeity = null; this.favor = {}; this.totalBlessings = 0; }

  // ==================== 事件 ====================

  /** 注册事件回调，返回取消订阅函数 */
  onEvent(cb: (e: DeityEvent) => void): () => void {
    this.listeners.push(cb);
    return () => { const i = this.listeners.indexOf(cb); if (i !== -1) this.listeners.splice(i, 1); };
  }

  // ==================== 旧 API 兼容 ====================

  /** @deprecated 使用 checkUnlocks */
  unlock(id: string, ctx?: Record<string, number>): boolean {
    const d = this.defs.get(id);
    if (!d || this.unlocked.has(id)) return this.unlocked.has(id);
    if (d.requires && !this.unlocked.has(d.requires)) return false;
    if (ctx !== undefined && d.unlockCondition) {
      for (const [k, v] of Object.entries(d.unlockCondition)) if ((ctx[k] ?? 0) < v) return false;
    } else if (d.unlockCondition && Object.keys(d.unlockCondition).length > 0) return false;
    this.unlocked.add(id); if (this.favor[id] === undefined) this.favor[id] = 0;
    this.emit({ type: 'deity_unlocked', deityId: id }); return true;
  }

  /** @deprecated 使用 addFavor */
  bless(id: string, res: Record<string, number>): { success: boolean; newLevel: number } {
    const d = this.defs.get(id);
    if (!d || !this.unlocked.has(id)) return { success: false, newLevel: 0 };
    const ml = this.maxLvl(d), pl = this.fpl(d);
    const cf = this.favor[id] ?? 0, cl = Math.min(ml, Math.floor(cf / pl));
    if (cl >= ml) return { success: false, newLevel: cl };
    if (d.blessingCosts) {
      const c = this.getNextBlessingCost(id);
      for (const [k, v] of Object.entries(c)) if ((res[k] ?? 0) < v) return { success: false, newLevel: cl };
      for (const [k, v] of Object.entries(c)) res[k] -= v;
    }
    this.favor[id] = Math.min(ml * pl, cf + pl);
    const nl = Math.min(ml, Math.floor(this.favor[id] / pl));
    this.totalBlessings++;
    this.emit({ type: 'blessing_performed', deityId: id });
    if (nl >= ml) this.emit({ type: 'blessing_maxed', deityId: id });
    return { success: true, newLevel: nl };
  }

  /** @deprecated 使用 getBonus() */
  getBonusById(id: string): { target: string; type: string; value: number } {
    const d = this.defs.get(id);
    if (!d) return { target: '', type: '', value: 0 };
    const m = this.bMap(d);
    if (!Object.keys(m).length) return { target: '', type: '', value: 0 };
    if (this.isOld(d) && d.bonusValue !== undefined)
      return { target: d.bonusTarget ?? Object.keys(m)[0], type: d.bonusType ?? 'multiplier',
        value: d.bonusValue + (d.bonusPerLevel ?? 0) * this.getFavorLevel(id) };
    const [t, bv] = Object.entries(m)[0];
    return { target: t, type: d.bonusType ?? 'multiplier', value: bv * (1 + this.getFavorLevel(id) * 0.1) };
  }

  /** @deprecated 使用 getBonus() */
  getActiveBonus(): { target: string; type: string; value: number } | null {
    if (!this.activeDeity) return null;
    const b = this.getBonusById(this.activeDeity);
    return (!b.target && !b.type && !b.value) ? null : b;
  }

  /** @deprecated */
  getNextBlessingCost(id: string): Record<string, number> {
    const d = this.defs.get(id);
    if (!d?.blessingCosts) return {};
    const s = Math.pow(d.costScaling ?? 1.5, this.getFavorLevel(id));
    const c: Record<string, number> = {};
    for (const [k, v] of Object.entries(d.blessingCosts)) c[k] = Math.floor(v * s);
    return c;
  }

  /** @deprecated */
  getExclusive(id: string): string[] { const d = this.defs.get(id); return d ? this.excl(d) : []; }
  /** @deprecated 使用 saveState */
  serialize(): DeityState & { blessingLevels: Record<string, number>; history: unknown[]; totalBlessings: number } {
    const bl: Record<string, number> = {};
    for (const [id, fv] of Object.entries(this.favor)) {
      const d = this.defs.get(id);
      if (d) bl[id] = Math.min(this.maxLvl(d), Math.floor(fv / this.fpl(d)));
    }
    return {
      unlocked: Array.from(this.unlocked), activeDeity: this.activeDeity, favor: { ...this.favor },
      blessingLevels: bl, history: [], totalBlessings: this.totalBlessings,
    };
  }
  /** @deprecated 使用 loadState */
  deserialize(data: Record<string, unknown>): void {
    this.reset();
    if (Array.isArray(data.unlocked))
      for (const id of data.unlocked) if (typeof id === 'string') this.unlocked.add(id);
    this.activeDeity = typeof data.activeDeity === 'string' ? data.activeDeity : null;
    if (data.favor && typeof data.favor === 'object' && !Array.isArray(data.favor))
      for (const [k, v] of Object.entries(data.favor as Record<string, unknown>))
        if (typeof v === 'number') this.favor[k] = v;
    else if (data.blessingLevels && typeof data.blessingLevels === 'object' && !Array.isArray(data.blessingLevels))
      for (const [k, v] of Object.entries(data.blessingLevels as Record<string, unknown>))
        if (typeof v === 'number') { const d = this.defs.get(k); this.favor[k] = v * (d ? this.fpl(d) : 100); }
    if (typeof data.totalBlessings === 'number') this.totalBlessings = data.totalBlessings;
  }

  // ==================== 内部工具 ====================

  private emit(ev: DeityEvent): void {
    for (const fn of this.listeners) { try { fn(ev); } catch { /* 静默 */ } }
  }
}
