/**
 * 引擎层 — NPC 刷新系统
 *
 * 管理 NPC 的定时刷新、条件刷新和消失规则：
 *   - 定时刷新：按固定间隔自动生成 NPC
 *   - 条件刷新：满足特定条件（回合/事件）才生成
 *   - 消失规则：超时消失或条件触发消失
 *   - 最大数量控制：同种 NPC 同时存在上限
 *
 * 功能覆盖：
 *   #2 NPC刷新规则（P0）
 *
 * @module engine/npc/NPCSpawnSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 刷新条件类型 */
export type SpawnConditionType = 'time' | 'turn' | 'event' | 'condition';

/** 单个刷新条件 */
export interface NPCSpawnCondition {
  /** 条件类型 */
  type: SpawnConditionType;
  /** 条件参数 */
  params: Record<string, unknown>;
}

/** NPC 刷新规则 */
export interface NPCSpawnRule {
  /** 规则唯一 ID */
  id: string;
  /** NPC 定义 ID（用于创建 NPC 实例） */
  defId: string;
  /** 刷新位置 X */
  spawnX: number;
  /** 刷新位置 Y */
  spawnY: number;
  /** 关联巡逻路径 ID（可选，刷新后自动绑定巡逻） */
  patrolPathId?: string;
  /** 刷新条件列表（全部满足才刷新） */
  conditions?: NPCSpawnCondition[];
  /** 刷新间隔（秒），0 表示只刷新一次 */
  respawnInterval: number;
  /** 存在时间（秒），0 表示永久存在 */
  despawnAfter?: number;
  /** 最大同时存在数量 */
  maxCount: number;
  /** 自定义 NPC 名称 */
  name?: string;
  /** 是否启用 */
  enabled: boolean;
}

/** 刷新结果 */
export interface SpawnResult {
  /** 是否成功 */
  success: boolean;
  /** 生成的 NPC 实例 ID（成功时有效） */
  npcId?: string;
  /** 规则 ID */
  ruleId: string;
  /** 失败原因 */
  reason?: string;
}

/** 活跃的刷新 NPC 记录 */
export interface SpawnedNPCRecord {
  /** NPC 实例 ID */
  npcId: string;
  /** 规则 ID */
  ruleId: string;
  /** 生成时间（累计秒数） */
  spawnTime: number;
  /** 是否已消失 */
  despawned: boolean;
}

/** 刷新系统存档数据 */
export interface SpawnSaveData {
  /** 版本号 */
  version: number;
  /** 刷新计时器 */
  spawnTimers: Record<string, number>;
  /** 活跃 NPC 记录 */
  spawnedRecords: Array<{
    npcId: string;
    ruleId: string;
    spawnTime: number;
    despawned: boolean;
  }>;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 刷新存档版本 */
const SPAWN_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// NPC 刷新系统
// ─────────────────────────────────────────────

/**
 * NPC 刷新系统
 *
 * 管理 NPC 的定时/条件刷新和消失规则。
 *
 * @example
 * ```ts
 * const spawn = new NPCSpawnSystem();
 * spawn.init(deps);
 * spawn.setSpawnCallback((defId, x, y, name) => {
 *   return npcSystem.createNPC(name ?? 'NPC', profession, { x, y }).id;
 * });
 * spawn.setDespawnCallback((npcId) => npcSystem.removeNPC(npcId));
 *
 * // 注册刷新规则
 * spawn.registerRule({
 *   id: 'guard-day',
 *   defId: 'guard',
 *   spawnX: 10, spawnY: 10,
 *   conditions: [{ type: 'time', params: { minHour: 6 } }],
 *   respawnInterval: 300,
 *   despawnAfter: 600,
 *   maxCount: 3,
 *   enabled: true,
 * });
 *
 * spawn.update(dt);
 * ```
 */
export class NPCSpawnSystem implements ISubsystem {
  readonly name = 'npcSpawn';

  private deps!: ISystemDeps;

  /** 刷新规则 */
  private rules: Map<string, NPCSpawnRule> = new Map();

  /** 刷新计时器（ruleId → 累计时间） */
  private spawnTimers: Map<string, number> = new Map();

  /** 已生成的 NPC 记录（npcId → record） */
  private spawnedRecords: Map<string, SpawnedNPCRecord> = new Map();

  /** 每条规则当前活跃的 NPC ID 列表（ruleId → npcId[]） */
  private ruleActiveNPCs: Map<string, Set<string>> = new Map();

  /** 累计游戏时间 */
  private gameTime: number = 0;

  // 外部回调
  private spawnCallback?: (defId: string, x: number, y: number, name?: string) => string | null;
  private despawnCallback?: (npcId: string) => void;
  private patrolAssignCallback?: (npcId: string, pathId: string) => void;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(dt: number): void {
    this.gameTime += dt;
    this.updateSpawnTimers(dt);
    this.updateDespawnTimers(dt);
  }

  getState(): {
    rules: NPCSpawnRule[];
    activeNPCCount: number;
    gameTime: number;
  } {
    return {
      rules: Array.from(this.rules.values()),
      activeNPCCount: this.getActiveNPCCount(),
      gameTime: this.gameTime,
    };
  }

  reset(): void {
    this.spawnTimers.clear();
    this.spawnedRecords.clear();
    this.ruleActiveNPCs.clear();
    this.gameTime = 0;
  }

  // ─── 回调注入 ──────────────────────────────

  /** 设置 NPC 生成回调 */
  setSpawnCallback(
    cb: (defId: string, x: number, y: number, name?: string) => string | null,
  ): void {
    this.spawnCallback = cb;
  }

  /** 设置 NPC 消失回调 */
  setDespawnCallback(cb: (npcId: string) => void): void {
    this.despawnCallback = cb;
  }

  /** 设置巡逻绑定回调 */
  setPatrolAssignCallback(cb: (npcId: string, pathId: string) => void): void {
    this.patrolAssignCallback = cb;
  }

  // ─── 规则管理 ──────────────────────────────

  /** 注册刷新规则 */
  registerRule(rule: NPCSpawnRule): void {
    this.rules.set(rule.id, { ...rule });
    this.spawnTimers.set(rule.id, 0);
    if (!this.ruleActiveNPCs.has(rule.id)) {
      this.ruleActiveNPCs.set(rule.id, new Set());
    }
  }

  /** 批量注册规则 */
  registerRules(rules: NPCSpawnRule[]): void {
    rules.forEach((r) => this.registerRule(r));
  }

  /** 获取规则 */
  getRule(ruleId: string): NPCSpawnRule | undefined {
    return this.rules.get(ruleId);
  }

  /** 移除规则 */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      this.spawnTimers.delete(ruleId);
      // 消失该规则下的所有活跃 NPC
      const activeNPCs = this.ruleActiveNPCs.get(ruleId);
      if (activeNPCs) {
        for (const npcId of activeNPCs) {
          this.despawnNPC(npcId);
        }
      }
      this.ruleActiveNPCs.delete(ruleId);
    }
    return removed;
  }

  /** 启用/禁用规则 */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    rule.enabled = enabled;
    return true;
  }

  /** 获取所有规则 ID */
  getRuleIds(): string[] {
    return Array.from(this.rules.keys());
  }

  // ─── 手动刷新 ──────────────────────────────

  /**
   * 根据条件触发刷新检查
   *
   * 遍历所有规则，检查条件是否满足，满足则刷新。
   *
   * @param context - 上下文信息
   * @returns 成功生成的 NPC ID 列表
   */
  checkSpawnConditions(context: {
    currentTurn?: number;
    gameTime?: number;
    completedEvents?: string[];
  }): string[] {
    const spawned: string[] = [];

    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;

      // 检查条件
      if (rule.conditions && !this.evaluateAllConditions(rule.conditions, context)) {
        continue;
      }

      const result = this.spawnNPC(ruleId, rule);
      if (result.success && result.npcId) {
        spawned.push(result.npcId);
      }
    }

    return spawned;
  }

  /**
   * 手动触发指定规则的刷新
   *
   * @param ruleId - 规则 ID
   * @returns 刷新结果
   */
  forceSpawn(ruleId: string): SpawnResult {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return { success: false, ruleId, reason: '规则不存在' };
    }
    return this.spawnNPC(ruleId, rule);
  }

  // ─── 查询 ──────────────────────────────────

  /** 获取指定规则当前活跃 NPC 数量 */
  getActiveCountForRule(ruleId: string): number {
    return this.ruleActiveNPCs.get(ruleId)?.size ?? 0;
  }

  /** 获取所有活跃 NPC 总数 */
  getActiveNPCCount(): number {
    let count = 0;
    for (const set of this.ruleActiveNPCs.values()) {
      count += set.size;
    }
    return count;
  }

  /** 获取指定规则对应的活跃 NPC ID 列表 */
  getActiveNPCsForRule(ruleId: string): string[] {
    return Array.from(this.ruleActiveNPCs.get(ruleId) ?? []);
  }

  /** 获取 NPC 所属规则 ID */
  getRuleIdForNPC(npcId: string): string | undefined {
    const record = this.spawnedRecords.get(npcId);
    return record?.ruleId;
  }

  /** 获取游戏时间 */
  getGameTime(): number {
    return this.gameTime;
  }

  // ─── 序列化 ────────────────────────────────

  /** 导出存档数据 */
  serialize(): SpawnSaveData {
    return {
      version: SPAWN_SAVE_VERSION,
      spawnTimers: Object.fromEntries(this.spawnTimers),
      spawnedRecords: Array.from(this.spawnedRecords.values()).map((r) => ({
        npcId: r.npcId,
        ruleId: r.ruleId,
        spawnTime: r.spawnTime,
        despawned: r.despawned,
      })),
    };
  }

  /** 导入存档数据 */
  deserialize(data: SpawnSaveData): void {
    this.spawnTimers.clear();
    this.spawnedRecords.clear();
    this.ruleActiveNPCs.clear();

    if (data.spawnTimers) {
      for (const [k, v] of Object.entries(data.spawnTimers)) {
        this.spawnTimers.set(k, v);
      }
    }

    for (const r of data.spawnedRecords ?? []) {
      if (!r.despawned) {
        const record: SpawnedNPCRecord = { ...r };
        this.spawnedRecords.set(r.npcId, record);

        if (!this.ruleActiveNPCs.has(r.ruleId)) {
          this.ruleActiveNPCs.set(r.ruleId, new Set());
        }
        this.ruleActiveNPCs.get(r.ruleId)!.add(r.npcId);
      }
    }
  }

  // ─── 内部方法 ──────────────────────────────

  /** 更新刷新计时器 */
  private updateSpawnTimers(dt: number): void {
    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;
      if (rule.respawnInterval <= 0) continue; // 一次性规则不自动刷新

      // 检查是否已达最大数量
      if (this.getActiveCountForRule(ruleId) >= rule.maxCount) continue;

      const timer = (this.spawnTimers.get(ruleId) ?? 0) + dt;
      this.spawnTimers.set(ruleId, timer);

      if (timer >= rule.respawnInterval) {
        this.spawnTimers.set(ruleId, 0);
        this.spawnNPC(ruleId, rule);
      }
    }
  }

  /** 更新消失计时器 */
  private updateDespawnTimers(_dt: number): void {
    for (const [npcId, record] of this.spawnedRecords) {
      if (record.despawned) continue;

      // 找到规则获取消失时间
      const rule = this.rules.get(record.ruleId);
      if (!rule || !rule.despawnAfter || rule.despawnAfter <= 0) continue;

      const aliveTime = this.gameTime - record.spawnTime;
      if (aliveTime >= rule.despawnAfter) {
        this.despawnNPC(npcId);
      }
    }
  }

  /** 生成 NPC */
  private spawnNPC(ruleId: string, rule: NPCSpawnRule): SpawnResult {
    if (!this.spawnCallback) {
      return { success: false, ruleId, reason: '未设置生成回调' };
    }

    // 检查最大数量
    if (this.getActiveCountForRule(ruleId) >= rule.maxCount) {
      return { success: false, ruleId, reason: '已达最大数量' };
    }

    // 调用外部回调创建 NPC
    const npcId = this.spawnCallback(rule.defId, rule.spawnX, rule.spawnY, rule.name);
    if (!npcId) {
      return { success: false, ruleId, reason: '生成回调返回空' };
    }

    // 记录
    const record: SpawnedNPCRecord = {
      npcId,
      ruleId,
      spawnTime: this.gameTime,
      despawned: false,
    };
    this.spawnedRecords.set(npcId, record);

    if (!this.ruleActiveNPCs.has(ruleId)) {
      this.ruleActiveNPCs.set(ruleId, new Set());
    }
    this.ruleActiveNPCs.get(ruleId)!.add(npcId);

    // 绑定巡逻路径
    if (rule.patrolPathId) {
      this.patrolAssignCallback?.(npcId, rule.patrolPathId);
    }

    this.deps?.eventBus?.emit('npc:spawned', { npcId, defId: rule.defId, ruleId });
    return { success: true, npcId, ruleId };
  }

  /** 消失 NPC */
  private despawnNPC(npcId: string): void {
    const record = this.spawnedRecords.get(npcId);
    if (!record || record.despawned) return;

    record.despawned = true;

    // 从规则活跃列表中移除
    const activeSet = this.ruleActiveNPCs.get(record.ruleId);
    if (activeSet) {
      activeSet.delete(npcId);
    }

    // 调用外部回调
    this.despawnCallback?.(npcId);

    this.deps?.eventBus?.emit('npc:despawned', {
      npcId,
      ruleId: record.ruleId,
    });
  }

  /** 评估所有条件 */
  private evaluateAllConditions(
    conditions: NPCSpawnCondition[],
    context: {
      currentTurn?: number;
      gameTime?: number;
      completedEvents?: string[];
    },
  ): boolean {
    return conditions.every((cond) => this.evaluateCondition(cond, context));
  }

  /** 评估单个条件 */
  private evaluateCondition(
    cond: NPCSpawnCondition,
    context: {
      currentTurn?: number;
      gameTime?: number;
      completedEvents?: string[];
    },
  ): boolean {
    switch (cond.type) {
      case 'turn':
        return (context.currentTurn ?? 0) >= (cond.params.minTurn as number ?? 0);
      case 'time':
        return (context.gameTime ?? 0) >= (cond.params.minHour as number ?? 0);
      case 'event':
        return (context.completedEvents ?? []).includes(cond.params.eventId as string);
      case 'condition':
        return cond.params.evaluate === 'true';
      default:
        return true;
    }
  }
}
