/**
 * 引擎层 — NPC 刷新系统
 *
 * 管理 NPC 的定时刷新、条件刷新和消失规则。
 * 功能覆盖：#2 NPC刷新规则（P0）
 *
 * @module engine/npc/NPCSpawnSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export type SpawnConditionType = 'time' | 'turn' | 'event' | 'condition';

export interface NPCSpawnCondition {
  type: SpawnConditionType;
  params: Record<string, unknown>;
}

export interface NPCSpawnRule {
  id: string;
  defId: string;
  spawnX: number;
  spawnY: number;
  patrolPathId?: string;
  conditions?: NPCSpawnCondition[];
  respawnInterval: number;
  despawnAfter?: number;
  maxCount: number;
  name?: string;
  enabled: boolean;
}

export interface SpawnResult {
  success: boolean;
  npcId?: string;
  ruleId: string;
  reason?: string;
}

export interface SpawnedNPCRecord {
  npcId: string;
  ruleId: string;
  spawnTime: number;
  despawned: boolean;
}

export interface SpawnSaveData {
  version: number;
  spawnTimers: Record<string, number>;
  spawnedRecords: Array<{ npcId: string; ruleId: string; spawnTime: number; despawned: boolean }>;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const SPAWN_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// NPC 刷新系统
// ─────────────────────────────────────────────

export class NPCSpawnSystem implements ISubsystem {
  readonly name = 'npcSpawn';
  private deps!: ISystemDeps;
  private rules: Map<string, NPCSpawnRule> = new Map();
  private spawnTimers: Map<string, number> = new Map();
  private spawnedRecords: Map<string, SpawnedNPCRecord> = new Map();
  private ruleActiveNPCs: Map<string, Set<string>> = new Map();
  private gameTime = 0;
  private spawnCallback?: (defId: string, x: number, y: number, name?: string) => string | null;
  private despawnCallback?: (npcId: string) => void;
  private patrolAssignCallback?: (npcId: string, pathId: string) => void;

  init(deps: ISystemDeps): void { this.deps = deps; }

  update(dt: number): void {
    this.gameTime += dt;
    this.updateSpawnTimers(dt);
    this.checkDespawnConditions();
  }

  getState() {
    return {
      rules: new Map(this.rules),
      spawnTimers: new Map(this.spawnTimers),
      spawnedRecords: new Map(this.spawnedRecords),
      gameTime: this.gameTime,
    };
  }

  reset(): void {
    this.rules.clear(); this.spawnTimers.clear(); this.spawnedRecords.clear();
    this.ruleActiveNPCs.clear(); this.gameTime = 0;
  }

  // ─── 回调注入 ──────────────────────────────

  setSpawnCallback(cb: (defId: string, x: number, y: number, name?: string) => string | null): void { this.spawnCallback = cb; }
  setDespawnCallback(cb: (npcId: string) => void): void { this.despawnCallback = cb; }
  setPatrolAssignCallback(cb: (npcId: string, pathId: string) => void): void { this.patrolAssignCallback = cb; }

  // ─── 规则管理 ──────────────────────────────

  registerRule(rule: NPCSpawnRule): void {
    this.rules.set(rule.id, rule);
    if (!this.spawnTimers.has(rule.id)) this.spawnTimers.set(rule.id, 0);
    if (!this.ruleActiveNPCs.has(rule.id)) this.ruleActiveNPCs.set(rule.id, new Set());
  }

  registerRules(rules: NPCSpawnRule[]): void { rules.forEach(r => this.registerRule(r)); }
  getRule(ruleId: string): NPCSpawnRule | undefined { return this.rules.get(ruleId); }

  removeRule(ruleId: string): boolean {
    const active = this.ruleActiveNPCs.get(ruleId);
    if (active) { for (const npcId of active) this.despawnNPC(npcId, ruleId); }
    return this.rules.delete(ruleId);
  }

  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) { rule.enabled = enabled; return true; }
    return false;
  }

  getRuleIds(): string[] { return Array.from(this.rules.keys()); }

  // ─── 刷新逻辑 ──────────────────────────────

  checkSpawnConditions(context: { currentTurn: number; events: string[] }): SpawnResult[] {
    const results: SpawnResult[] = [];
    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;
      if (this.getActiveCountForRule(ruleId) >= rule.maxCount) continue;
      if (rule.conditions && !this.evaluateConditions(rule.conditions, context)) continue;
      if (this.spawnTimers.get(ruleId) ?? 0 > 0) continue;
      const result = this.executeSpawn(ruleId, rule);
      results.push(result);
    }
    return results;
  }

  forceSpawn(ruleId: string): SpawnResult {
    const rule = this.rules.get(ruleId);
    if (!rule) return { success: false, ruleId, reason: '规则不存在' };
    if (this.getActiveCountForRule(ruleId) >= rule.maxCount) return { success: false, ruleId, reason: '已达最大数量' };
    return this.executeSpawn(ruleId, rule);
  }

  // ─── 查询 ──────────────────────────────────

  getActiveCountForRule(ruleId: string): number { return this.ruleActiveNPCs.get(ruleId)?.size ?? 0; }
  getActiveNPCCount(): number { let c = 0; for (const s of this.ruleActiveNPCs.values()) c += s.size; return c; }
  getActiveNPCsForRule(ruleId: string): string[] { return Array.from(this.ruleActiveNPCs.get(ruleId) ?? []); }

  getRuleIdForNPC(npcId: string): string | undefined {
    for (const [ruleId, npcs] of this.ruleActiveNPCs) { if (npcs.has(npcId)) return ruleId; }
    return undefined;
  }

  getGameTime(): number { return this.gameTime; }

  // ─── 序列化 ────────────────────────────────

  serialize(): SpawnSaveData {
    return {
      version: SPAWN_SAVE_VERSION,
      spawnTimers: Object.fromEntries(this.spawnTimers),
      spawnedRecords: Array.from(this.spawnedRecords.values()),
    };
  }

  deserialize(data: SpawnSaveData): void {
    this.spawnTimers.clear();
    if (data.spawnTimers) { for (const [id, timer] of Object.entries(data.spawnTimers)) this.spawnTimers.set(id, timer); }
    this.spawnedRecords.clear();
    this.ruleActiveNPCs.clear();
    for (const rec of data.spawnedRecords ?? []) {
      this.spawnedRecords.set(rec.npcId, rec);
      if (!this.ruleActiveNPCs.has(rec.ruleId)) this.ruleActiveNPCs.set(rec.ruleId, new Set());
      if (!rec.despawned) this.ruleActiveNPCs.get(rec.ruleId)!.add(rec.npcId);
    }
  }

  // ─── 内部方法 ──────────────────────────────

  private updateSpawnTimers(dt: number): void {
    for (const [ruleId, timer] of this.spawnTimers) {
      const newTimer = timer - dt;
      if (newTimer <= 0) this.spawnTimers.set(ruleId, 0);
      else this.spawnTimers.set(ruleId, newTimer);
    }
  }

  private checkDespawnConditions(): void {
    for (const [npcId, record] of this.spawnedRecords) {
      if (record.despawned) continue;
      const rule = this.rules.get(record.ruleId);
      if (!rule?.despawnAfter) continue;
      if (this.gameTime - record.spawnTime >= rule.despawnAfter) this.despawnNPC(npcId, record.ruleId);
    }
  }

  private executeSpawn(ruleId: string, rule: NPCSpawnRule): SpawnResult {
    if (!this.spawnCallback) return { success: false, ruleId, reason: '未设置spawn回调' };
    const npcId = this.spawnCallback(rule.defId, rule.spawnX, rule.spawnY, rule.name);
    if (!npcId) return { success: false, ruleId, reason: 'spawn回调返回null' };

    this.spawnedRecords.set(npcId, { npcId, ruleId, spawnTime: this.gameTime, despawned: false });
    if (!this.ruleActiveNPCs.has(ruleId)) this.ruleActiveNPCs.set(ruleId, new Set());
    this.ruleActiveNPCs.get(ruleId)!.add(npcId);

    if (rule.patrolPathId && this.patrolAssignCallback) this.patrolAssignCallback(npcId, rule.patrolPathId);
    if (rule.respawnInterval > 0) this.spawnTimers.set(ruleId, rule.respawnInterval);

    this.deps?.eventBus.emit('npc:spawned', { npcId, ruleId, defId: rule.defId });
    return { success: true, npcId, ruleId };
  }

  private despawnNPC(npcId: string, ruleId: string): void {
    const record = this.spawnedRecords.get(npcId);
    if (record) record.despawned = true;
    this.ruleActiveNPCs.get(ruleId)?.delete(npcId);
    this.despawnCallback?.(npcId);
    this.deps?.eventBus.emit('npc:despawned', { npcId, ruleId });
  }

  private evaluateConditions(conditions: NPCSpawnCondition[], context: { currentTurn: number; events: string[] }): boolean {
    return conditions.every(cond => {
      switch (cond.type) {
        case 'turn': return (context.currentTurn ?? 0) >= (cond.params.minTurn as number ?? 0);
        case 'event': return context.events.includes(cond.params.eventId as string);
        case 'time': return this.gameTime >= (cond.params.minTime as number ?? 0);
        default: return true;
      }
    });
  }
}
