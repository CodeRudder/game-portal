/**
 * TechTreeSystem — 放置游戏科技树系统核心模块（P2）
 *
 * 提供科技定义注册、前置检查、资源消耗、研究进度推进、
 * 研究队列、效果汇总、依赖关系查询等完整功能。
 * 泛型 `TechTreeSystem<Def>` 允许游戏自定义扩展 TechDef。
 *
 * @module engines/idle/modules/TechTreeSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 科技效果定义 */
export interface TechEffect {
  type: 'multiplier' | 'unlock' | 'modifier' | 'ability';
  target: string;
  value: number;
  description: string;
}

/** 科技定义 */
export interface TechDef {
  id: string;
  name: string;
  description: string;
  requires: string[];
  cost: Record<string, number>;
  researchTime: number;
  effects: TechEffect[];
  tier: number;
  icon: string;
  branch?: string;
}

/** 正在进行的研究 */
export interface ActiveResearch {
  techId: string;
  startTime: number;
  endTime: number;
  progress: number;
}

/** 科技树状态快照 */
export interface TechTreeState {
  researched: string[];
  current: ActiveResearch | null;
  queue: string[];
  totalInvestment: Record<string, number>;
}

/** 科技树事件 */
export interface TechTreeEvent {
  type: 'research_started' | 'research_completed' | 'research_queued' | 'tech_unlocked';
  techId?: string;
  data?: Record<string, unknown>;
}

// ============================================================
// TechTreeSystem 实现
// ============================================================

export class TechTreeSystem<Def extends TechDef = TechDef> {
  private readonly techMap: Map<string, Def>;
  private researched: Set<string>;
  private current: ActiveResearch | null;
  private queue: string[];
  private totalInvestment: Record<string, number>;
  private readonly listeners: Array<(event: TechTreeEvent) => void> = [];

  constructor(defs: Def[]) {
    this.techMap = new Map();
    this.researched = new Set();
    this.current = null;
    this.queue = [];
    this.totalInvestment = {};
    for (const def of defs) {
      if (this.techMap.has(def.id)) throw new Error(`Duplicate tech id: "${def.id}"`);
      this.techMap.set(def.id, def);
    }
  }

  /** 开始研究：校验前置+资源，启动计时 */
  research(id: string, resources: Record<string, number>): boolean {
    const def = this.techMap.get(id);
    if (!def || this.researched.has(id)) return false;
    if (this.current) return false;
    if (!def.requires.every((r) => this.researched.has(r))) return false;
    for (const [res, amt] of Object.entries(def.cost)) {
      if ((resources[res] ?? 0) < amt) return false;
    }
    this.recordInvestment(def.cost);
    const now = Date.now();
    this.current = { techId: id, startTime: now, endTime: now + def.researchTime, progress: 0 };
    this.emit({ type: 'research_started', techId: id, data: { techId: id, name: def.name, cost: { ...def.cost } } });
    return true;
  }

  isResearched(id: string): boolean { return this.researched.has(id); }

  canResearch(id: string, resources: Record<string, number>): boolean {
    const def = this.techMap.get(id);
    if (!def || this.researched.has(id)) return false;
    if (!def.requires.every((r) => this.researched.has(r))) return false;
    for (const [res, amt] of Object.entries(def.cost)) {
      if ((resources[res] ?? 0) < amt) return false;
    }
    return true;
  }

  /** 已研究科技效果汇总：multiplier 累乘，modifier 累加，unlock/ability 标记为 1 */
  getEffects(): Record<string, number> {
    const r: Record<string, number> = {};
    for (const tid of this.researched) {
      const def = this.techMap.get(tid);
      if (!def) continue;
      for (const e of def.effects) {
        if (e.type === 'multiplier') r[e.target] = (r[e.target] ?? 1) * e.value;
        else if (e.type === 'modifier') r[e.target] = (r[e.target] ?? 0) + e.value;
        else r[e.target] = 1;
      }
    }
    return r;
  }

  /** 递归获取所有前置科技（拓扑序，不含自身） */
  getPrerequisites(id: string): string[] {
    const visited = new Set<string>(), result: string[] = [];
    const walk = (tid: string) => {
      const def = this.techMap.get(tid);
      if (!def) return;
      for (const req of def.requires) {
        if (!visited.has(req)) { visited.add(req); walk(req); result.push(req); }
      }
    };
    walk(id);
    return result;
  }

  /** 获取直接依赖指定科技的所有后续科技 */
  getDependents(id: string): string[] {
    const deps: string[] = [];
    this.techMap.forEach((def, tid) => { if (def.requires.includes(id)) deps.push(tid); });
    return deps;
  }

  /** 将科技加入研究队列 */
  enqueue(id: string): boolean {
    if (!this.techMap.has(id) || this.researched.has(id)) return false;
    if (this.current?.techId === id || this.queue.includes(id)) return false;
    this.queue.push(id);
    this.emit({ type: 'research_queued', techId: id, data: { techId: id, queueLength: this.queue.length } });
    return true;
  }

  getCurrentResearch(): ActiveResearch | null { return this.current ? { ...this.current } : null; }
  getQueue(): string[] { return [...this.queue]; }

  /** 推进研究进度，完成时从队列取下一个 */
  update(_dt: number): void {
    if (!this.current) { this.startNext(); return; }
    const def = this.techMap.get(this.current.techId);
    if (!def) { this.current = null; return; }
    this.current.progress = Math.min((Date.now() - this.current.startTime) / def.researchTime, 1);
    if (this.current.progress >= 1) this.complete(this.current.techId);
  }

  reset(): void {
    this.researched = new Set(); this.current = null;
    this.queue = []; this.totalInvestment = {};
  }

  saveState(): Record<string, unknown> {
    return {
      researched: Array.from(this.researched),
      current: this.current ? { ...this.current } : null,
      queue: [...this.queue],
      totalInvestment: { ...this.totalInvestment },
    };
  }

  loadState(data: Record<string, unknown>): void {
    this.researched = Array.isArray(data.researched)
      ? new Set((data.researched as unknown[]).filter((x): x is string => typeof x === 'string'))
      : new Set<string>();
    const c = data.current as Record<string, unknown> | null;
    this.current = c && typeof c === 'object' && !Array.isArray(c)
      ? { techId: String(c.techId ?? ''), startTime: Number(c.startTime ?? Date.now()),
          endTime: Number(c.endTime ?? Date.now()), progress: Number(c.progress ?? 0) }
      : null;
    this.queue = Array.isArray(data.queue)
      ? (data.queue as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    const inv = data.totalInvestment;
    this.totalInvestment = inv && typeof inv === 'object' && !Array.isArray(inv)
      ? Object.fromEntries(Object.entries(inv as Record<string, unknown>).filter(([, v]) => typeof v === 'number') as [string, number][])
      : {};
  }

  serialize(): Record<string, unknown> { return this.saveState(); }
  deserialize(data: Record<string, unknown>): void { this.loadState(data); }

  /** 注册事件监听器，返回取消订阅函数 */
  onEvent(cb: (event: TechTreeEvent) => void): () => void {
    this.listeners.push(cb);
    return () => { const i = this.listeners.indexOf(cb); if (i !== -1) this.listeners.splice(i, 1); };
  }

  // ---------- 内部方法 ----------

  private emit(event: TechTreeEvent): void {
    for (const fn of this.listeners) { try { fn(event); } catch { /* 静默 */ } }
  }

  private recordInvestment(cost: Record<string, number>): void {
    for (const [r, a] of Object.entries(cost)) this.totalInvestment[r] = (this.totalInvestment[r] ?? 0) + a;
  }

  private complete(techId: string): void {
    const def = this.techMap.get(techId);
    this.researched.add(techId);
    this.current = null;
    this.emit({ type: 'research_completed', techId, data: { techId, name: def?.name ?? techId, effects: def?.effects.map((e) => ({ ...e })) ?? [] } });
    this.emit({ type: 'tech_unlocked', techId, data: { techId, name: def?.name ?? techId, tier: def?.tier ?? 0, branch: def?.branch } });
    this.startNext();
  }

  private startNext(): void {
    while (this.queue.length > 0 && !this.current) {
      const id = this.queue.shift()!;
      if (this.researched.has(id)) continue;
      const def = this.techMap.get(id);
      if (!def || !def.requires.every((r) => this.researched.has(r))) continue;
      const now = Date.now();
      this.current = { techId: id, startTime: now, endTime: now + def.researchTime, progress: 0 };
      this.emit({ type: 'research_started', techId: id, data: { techId: id, name: def.name, fromQueue: true } });
      break;
    }
  }
}
