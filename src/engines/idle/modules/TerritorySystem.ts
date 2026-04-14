/**
 * TerritorySystem — 放置游戏领土征服系统核心模块（P2）
 *
 * 管理领土定义、进攻、征服、加成与收入。
 * 泛型 TerritorySystem<Def> 允许游戏自定义扩展 TerritoryDef。
 * 零外部依赖，纯回调数组实现事件监听。
 * @module engines/idle/modules/TerritorySystem
 */

export interface TerritoryDef {
  id: string; name: string; powerRequired: number;
  rewards: Record<string, number>; conquestBonus?: Record<string, number>;
  adjacent: string[];
  type: 'plains' | 'mountain' | 'forest' | 'desert' | 'coastal' | 'capital';
  defenseMultiplier: number; level: number; specialEffect?: string;
  position: { x: number; y: number };
}

export interface TerritoryStatus {
  conquered: boolean; garrison: number; prosperity: number; conqueredAt?: number;
}

export interface TerritoryState {
  conquered: Set<string>; territories: Record<string, TerritoryStatus>;
  attacking: string | null; attackProgress: number; totalPower: number;
}

export interface TerritoryEvent {
  type: 'territory_conquered' | 'attack_started' | 'attack_progress' | 'attack_failed';
  territoryId?: string; data?: Record<string, unknown>;
}

/** 领土征服系统 — 图结构领土，进攻/征服/加成/收入 */
export class TerritorySystem<Def extends TerritoryDef = TerritoryDef> {
  private readonly defMap = new Map<string, Def>();
  private territories: Record<string, TerritoryStatus> = {};
  private conqueredSet = new Set<string>();
  private attacking: string | null = null;
  private attackProgress = 0;
  private attackPower = 0;
  private totalPower = 0;
  private readonly listeners: Array<(e: TerritoryEvent) => void> = [];

  constructor(defs: Def[]) {
    for (const d of defs) {
      if (this.defMap.has(d.id))
        throw new Error(`[TerritorySystem] Duplicate territory id: "${d.id}"`);
      this.defMap.set(d.id, d);
      this.territories[d.id] = { conquered: false, garrison: 0, prosperity: 0 };
    }
  }

  /** 开始进攻：未征服 + 有已征服相邻领土 + 无进行中进攻 + power>0 */
  attack(id: string, power: number): boolean {
    const def = this.defMap.get(id);
    if (!def || this.conqueredSet.has(id) || !this.canAttack(id) || power <= 0) return false;
    if (this.attacking !== null) return false;
    this.attacking = id; this.attackProgress = 0;
    this.attackPower = power; this.totalPower += power;
    this.emit({ type: 'attack_started', territoryId: id, data: {
      territoryId: id, name: def.name, power, powerRequired: def.powerRequired, defenseMultiplier: def.defenseMultiplier
    }});
    return true;
  }

  /** 征服领土，返回奖励和加成 */
  conquer(id: string): { rewards: Record<string, number>; bonus: Record<string, number> } {
    const def = this.defMap.get(id);
    if (!def) throw new Error(`[TerritorySystem] Territory not found: "${id}"`);
    this.conqueredSet.add(id);
    const s = this.territories[id];
    if (s) { s.conquered = true; s.conqueredAt = Date.now(); s.prosperity = 10; }
    const rewards = { ...def.rewards };
    const bonus = def.conquestBonus ? { ...def.conquestBonus } : {};
    if (this.attacking === id) { this.attacking = null; this.attackProgress = 0; this.attackPower = 0; }
    this.emit({ type: 'territory_conquered', territoryId: id, data: {
      territoryId: id, name: def.name, type: def.type, level: def.level, rewards: { ...rewards }, bonus: { ...bonus }
    }});
    return { rewards, bonus };
  }

  isConquered(id: string): boolean { return this.conqueredSet.has(id); }

  /** 所有已征服领土的累计 conquestBonus */
  getBonus(): Record<string, number> {
    const r: Record<string, number> = {};
    for (const id of this.conqueredSet) {
      const cb = this.defMap.get(id)?.conquestBonus;
      if (!cb) continue;
      for (const [k, v] of Object.entries(cb)) r[k] = (r[k] ?? 0) + v;
    }
    return r;
  }

  /** 每秒产出：base × (prosperity/100) × (level×0.5) */
  getIncomePerSecond(): Record<string, number> {
    const r: Record<string, number> = {};
    for (const id of this.conqueredSet) {
      const def = this.defMap.get(id), s = this.territories[id];
      if (!def || !s) continue;
      const f = (s.prosperity / 100) * (def.level * 0.5);
      for (const [k, v] of Object.entries(def.rewards)) r[k] = (r[k] ?? 0) + v * f;
    }
    return r;
  }

  /** 可进攻：存在 + 未征服 + 有已征服相邻领土 */
  canAttack(id: string): boolean {
    const def = this.defMap.get(id);
    return !!def && !this.conqueredSet.has(id) && def.adjacent.some(a => this.conqueredSet.has(a));
  }

  /** 推进进攻进度和繁荣度。dt 毫秒。 */
  update(dt: number): void {
    if (dt <= 0) return;
    if (this.attacking !== null) this.updateAttack(dt);
    this.updateProsperity(dt);
  }

  getTerritoryStatus(id: string): TerritoryStatus | null {
    const s = this.territories[id]; return s ? { ...s } : null;
  }
  getDef(id: string): Def | undefined { return this.defMap.get(id); }
  getAllDefs(): Def[] { return Array.from(this.defMap.values()); }
  getAttackInfo(): { territoryId: string; progress: number } | null {
    return this.attacking !== null ? { territoryId: this.attacking, progress: this.attackProgress } : null;
  }
  getConqueredIds(): string[] { return Array.from(this.conqueredSet); }

  setGarrison(id: string, garrison: number): boolean {
    const s = this.territories[id];
    if (!s || !s.conquered) return false;
    s.garrison = Math.max(0, garrison); return true;
  }

  serialize(): Record<string, unknown> {
    const t: Record<string, TerritoryStatus> = {};
    for (const [id, s] of Object.entries(this.territories)) t[id] = { ...s };
    return { conquered: Array.from(this.conqueredSet), territories: t,
      attacking: this.attacking, attackProgress: this.attackProgress, totalPower: this.totalPower };
  }
  saveState(): Record<string, unknown> { return this.serialize(); }

  deserialize(data: Record<string, unknown>): void {
    this.conqueredSet = Array.isArray(data.conquered)
      ? new Set((data.conquered as unknown[]).filter((v): v is string => typeof v === 'string'))
      : new Set<string>();
    if (data.territories && typeof data.territories === 'object' && !Array.isArray(data.territories)) {
      const td = data.territories as Record<string, unknown>;
      for (const id of Object.keys(this.territories)) {
        const sv = td[id];
        if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
          const s = sv as Record<string, unknown>;
          this.territories[id] = {
            conquered: typeof s.conquered === 'boolean' ? s.conquered : false,
            garrison: typeof s.garrison === 'number' ? s.garrison : 0,
            prosperity: typeof s.prosperity === 'number' ? Math.min(100, Math.max(0, s.prosperity)) : 0,
            conqueredAt: typeof s.conqueredAt === 'number' ? s.conqueredAt : undefined,
          };
        } else { this.territories[id] = { conquered: false, garrison: 0, prosperity: 0 }; }
      }
    }
    this.attacking = typeof data.attacking === 'string' ? data.attacking : null;
    this.attackProgress = typeof data.attackProgress === 'number' ? Math.min(1, Math.max(0, data.attackProgress)) : 0;
    this.totalPower = typeof data.totalPower === 'number' ? data.totalPower : 0;
  }
  loadState(data: Record<string, unknown>): void { this.deserialize(data); }

  reset(): void {
    this.conqueredSet = new Set<string>();
    this.attacking = null; this.attackProgress = 0; this.attackPower = 0; this.totalPower = 0;
    for (const id of Object.keys(this.territories))
      this.territories[id] = { conquered: false, garrison: 0, prosperity: 0 };
  }

  onEvent(cb: (e: TerritoryEvent) => void): () => void {
    this.listeners.push(cb);
    return () => { const i = this.listeners.indexOf(cb); if (i !== -1) this.listeners.splice(i, 1); };
  }

  // ---- 内部方法 ----

  private emit(event: TerritoryEvent): void {
    for (const cb of this.listeners) { try { cb(event); } catch { /* 静默 */ } }
  }

  private updateAttack(dt: number): void {
    const def = this.defMap.get(this.attacking!);
    if (!def) { this.attacking = null; this.attackProgress = 0; return; }
    const eff = def.powerRequired * def.defenseMultiplier;
    this.attackProgress += eff <= 0 ? 1 : (this.attackPower / eff / 1000) * dt;
    this.emit({ type: 'attack_progress', territoryId: this.attacking!,
      data: { territoryId: this.attacking!, progress: Math.min(this.attackProgress, 1) } });
    if (this.attackProgress >= 1) this.resolveAttack();
  }

  private resolveAttack(): void {
    const tid = this.attacking!; const def = this.defMap.get(tid);
    if (!def) { this.attacking = null; this.attackProgress = 0; return; }
    const eff = def.powerRequired * def.defenseMultiplier;
    const ok = this.attackPower >= eff || this.deterministicRandom(tid, this.totalPower) < this.attackPower / eff;
    if (ok) { this.conquer(tid); }
    else {
      this.emit({ type: 'attack_failed', territoryId: tid,
        data: { territoryId: tid, name: def.name, powerUsed: this.attackPower, powerRequired: eff } });
      this.attacking = null; this.attackProgress = 0; this.attackPower = 0;
    }
  }

  private updateProsperity(dt: number): void {
    for (const id of this.conqueredSet) {
      const s = this.territories[id];
      if (!s?.conquered) continue;
      s.prosperity = Math.min(100, s.prosperity + (0.0001 + s.garrison * 0.00005) * dt);
    }
  }

  /** DJB2 确定性随机 0~1 */
  private deterministicRandom(tid: string, seed: number): number {
    let h = seed | 0;
    const c = tid + ':' + String(seed);
    for (let i = 0; i < c.length; i++) h = ((h << 5) - h + c.charCodeAt(i)) | 0;
    return Math.abs(h % 10000) / 10000;
  }
}
