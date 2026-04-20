/**
 * 引擎层 — NPC 巡逻系统
 *
 * 管理 NPC 巡逻行为与刷新规则。巡逻路径移动计算委托给 PatrolPathCalculator。
 * 功能覆盖：#1 NPC巡逻路径（P0）、#2 NPC刷新规则（P0）
 *
 * @module engine/npc/NPCPatrolSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  NPCId,
  NPCData,
  RegionId,
  GridPosition,
  PatrolPathId,
  PatrolPath,
  NPCSpawnTemplate,
  NPCSpawnConfig,
  NPCSpawnRecord,
  SpawnResult,
  PatrolSaveData,
} from '../../core/npc';
import { PatrolPathCalculator, type RuntimePatrolState } from './PatrolPathCalculator';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 巡逻存档版本 */
const PATROL_SAVE_VERSION = 1;

/** 默认刷新配置 */
const DEFAULT_SPAWN_CONFIG: NPCSpawnConfig = {
  spawnInterval: 30,
  maxNPCCount: 20,
  maxNPCPerRegion: 8,
  npcLifetime: 0,
  autoSpawnEnabled: true,
};

// ─────────────────────────────────────────────
// NPC 巡逻系统
// ─────────────────────────────────────────────

/**
 * NPC 巡逻系统
 *
 * 管理 NPC 沿预定义路径的巡逻行为，以及 NPC 的定时刷新规则。
 * 巡逻路径的移动计算委托给 PatrolPathCalculator。
 */
export class NPCPatrolSystem implements ISubsystem {
  readonly name = 'npcPatrol';

  private deps!: ISystemDeps;

  /** 已注册的巡逻路径 */
  private paths: Map<PatrolPathId, PatrolPath> = new Map();

  /** NPC 巡逻状态 */
  private patrolStates: Map<NPCId, RuntimePatrolState> = new Map();

  /** 刷新模板 */
  private spawnTemplates: Map<string, NPCSpawnTemplate> = new Map();

  /** 刷新配置 */
  private spawnConfig: NPCSpawnConfig = { ...DEFAULT_SPAWN_CONFIG };

  /** 刷新记录 */
  private spawnRecords: NPCSpawnRecord[] = [];

  /** 刷新计时器 */
  private spawnTimer: number = 0;

  /** NPC 位置更新回调 */
  private moveCallback?: (npcId: string, x: number, y: number) => void;

  /** 巡逻路径计算器 */
  private pathCalculator = new PatrolPathCalculator();

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(dt: number): void {
    this.pathCalculator.updateAllPatrols(
      this.patrolStates,
      this.paths,
      dt,
      this.moveCallback,
      (event, data) => this.deps?.eventBus?.emit(event, data),
    );
    this.updateSpawnTimer(dt);
  }

  getState(): {
    patrolStates: RuntimePatrolState[];
    spawnRecords: NPCSpawnRecord[];
  } {
    return {
      patrolStates: Array.from(this.patrolStates.values()),
      spawnRecords: [...this.spawnRecords],
    };
  }

  reset(): void {
    this.patrolStates.clear();
    this.spawnRecords = [];
    this.spawnTimer = 0;
    this.paths.clear();
    this.spawnTemplates.clear();
    this.spawnConfig = { ...DEFAULT_SPAWN_CONFIG };
  }

  // ─── 回调注入 ──────────────────────────────

  /** 设置 NPC 位置更新回调 */
  setMoveCallback(cb: (npcId: string, x: number, y: number) => void): void {
    this.moveCallback = cb;
  }

  // ═══════════════════════════════════════════
  // #1 巡逻路径管理
  // ═══════════════════════════════════════════

  /** 注册巡逻路径 */
  registerPatrolPath(path: PatrolPath): void {
    if (path.waypoints.length < 2) {
      throw new Error(
        `[NPCPatrolSystem] 路径 ${path.id} 至少需要2个路径点，当前 ${path.waypoints.length} 个`,
      );
    }
    this.paths.set(path.id, { ...path, waypoints: path.waypoints.map((w) => ({ ...w })) });
    this.deps?.eventBus?.emit('patrol:path_registered', { pathId: path.id });
  }

  /** 批量注册路径 */
  registerPatrolPaths(paths: PatrolPath[]): void {
    paths.forEach((p) => this.registerPatrolPath(p));
  }

  /** 获取路径定义 */
  getPatrolPath(pathId: PatrolPathId): PatrolPath | undefined {
    const path = this.paths.get(pathId);
    if (!path) return undefined;
    return { ...path, waypoints: path.waypoints.map((w) => ({ ...w })) };
  }

  /** 获取所有已注册路径 */
  getAllPatrolPaths(): PatrolPath[] {
    return Array.from(this.paths.values()).map((p) => ({
      ...p, waypoints: p.waypoints.map((w) => ({ ...w })),
    }));
  }

  /** 按区域获取路径 */
  getPatrolPathsByRegion(region: RegionId): PatrolPath[] {
    return this.getAllPatrolPaths().filter((p) => p.region === region);
  }

  /** 移除路径（同时移除关联巡逻状态） */
  removePatrolPath(pathId: PatrolPathId): boolean {
    const removed = this.paths.delete(pathId);
    if (removed) {
      for (const [npcId, state] of this.patrolStates) {
        if (state.patrolPathId === pathId) {
          this.patrolStates.delete(npcId);
        }
      }
    }
    return removed;
  }

  // ═══════════════════════════════════════════
  // #1 NPC 巡逻控制
  // ═══════════════════════════════════════════

  /** 将 NPC 绑定到巡逻路径 */
  assignPatrol(
    npcId: NPCId,
    pathId: PatrolPathId,
    options?: { startIndex?: number; direction?: 1 | -1 },
  ): boolean {
    const path = this.paths.get(pathId);
    if (!path) return false;

    const startIndex = options?.startIndex ?? 0;
    const direction = options?.direction ?? 1;

    if (startIndex < 0 || startIndex >= path.waypoints.length) {
      return false;
    }

    const startWp = path.waypoints[startIndex];
    const state: RuntimePatrolState = {
      npcId,
      patrolPathId: pathId,
      currentWaypointIndex: startIndex,
      direction,
      exactPosition: { x: startWp.x, y: startWp.y },
      isPatrolling: true,
      pauseTimer: 0,
    };

    this.patrolStates.set(npcId, state);
    this.moveCallback?.(npcId, startWp.x, startWp.y);

    this.deps?.eventBus?.emit('patrol:assigned', {
      npcId,
      patrolPathId: pathId,
      startIndex,
      direction,
    });

    return true;
  }

  /** 移除 NPC 巡逻 */
  unassignPatrol(npcId: NPCId): boolean {
    const removed = this.patrolStates.delete(npcId);
    if (removed) {
      this.deps?.eventBus?.emit('patrol:unassigned', { npcId });
    }
    return removed;
  }

  /** 暂停 NPC 巡逻 */
  pausePatrol(npcId: NPCId, duration: number): boolean {
    const state = this.patrolStates.get(npcId);
    if (!state) return false;
    state.isPatrolling = false;
    state.pauseTimer = duration;
    return true;
  }

  /** 恢复 NPC 巡逻 */
  resumePatrol(npcId: NPCId): boolean {
    const state = this.patrolStates.get(npcId);
    if (!state) return false;
    state.isPatrolling = true;
    state.pauseTimer = 0;
    return true;
  }

  /** 获取 NPC 巡逻状态 */
  getPatrolState(npcId: NPCId): RuntimePatrolState | undefined {
    const state = this.patrolStates.get(npcId);
    return state ? { ...state } : undefined;
  }

  /** 获取所有巡逻中的 NPC 状态 */
  getAllPatrolStates(): RuntimePatrolState[] {
    return Array.from(this.patrolStates.values()).map((s) => ({ ...s }));
  }

  /** 获取 NPC 当前精确位置 */
  getNPCExactPosition(npcId: NPCId): { x: number; y: number } | null {
    const state = this.patrolStates.get(npcId);
    if (!state) return null;
    return { ...state.exactPosition };
  }

  /** 获取巡逻中的 NPC 数量 */
  getPatrollingCount(): number {
    return this.patrolStates.size;
  }

  /** 检查 NPC 是否正在巡逻 */
  isPatrolling(npcId: NPCId): boolean {
    return this.patrolStates.has(npcId);
  }

  // ═══════════════════════════════════════════
  // #2 NPC 刷新规则
  // ═══════════════════════════════════════════

  /** 注册刷新模板 */
  registerSpawnTemplate(template: NPCSpawnTemplate): void {
    this.spawnTemplates.set(template.id, { ...template });
  }

  /** 批量注册刷新模板 */
  registerSpawnTemplates(templates: NPCSpawnTemplate[]): void {
    templates.forEach((t) => this.registerSpawnTemplate(t));
  }

  /** 获取刷新模板 */
  getSpawnTemplate(id: string): NPCSpawnTemplate | undefined {
    const t = this.spawnTemplates.get(id);
    return t ? { ...t } : undefined;
  }

  /** 获取所有刷新模板 */
  getAllSpawnTemplates(): NPCSpawnTemplate[] {
    return Array.from(this.spawnTemplates.values()).map((t) => ({ ...t }));
  }

  /** 获取刷新配置 */
  getSpawnConfig(): NPCSpawnConfig {
    return { ...this.spawnConfig };
  }

  /** 更新刷新配置（局部更新） */
  setSpawnConfig(config: Partial<NPCSpawnConfig>): void {
    this.spawnConfig = { ...this.spawnConfig, ...config };
  }

  /** 获取刷新记录 */
  getSpawnRecords(): NPCSpawnRecord[] {
    return [...this.spawnRecords];
  }

  /** 获取刷新计时器值 */
  getSpawnTimer(): number {
    return this.spawnTimer;
  }

  /**
   * 尝试刷新一个 NPC
   *
   * 通过 registry 获取 NPCSystem 来创建 NPC。
   */
  trySpawnNPC(): SpawnResult {
    if (this.spawnTemplates.size === 0) {
      return { success: false, npcId: null, reason: '没有可用的刷新模板' };
    }

    const npcSys = this.getNPCSystem();

    // 检查全局NPC数量上限
    const currentCount = npcSys?.getNPCCount?.() ?? 0;
    if (currentCount >= this.spawnConfig.maxNPCCount) {
      return { success: false, npcId: null, reason: '已达全局NPC上限' };
    }

    // 按权重选择模板
    const template = this.selectTemplateByWeight();
    if (!template) {
      return { success: false, npcId: null, reason: '没有可用的刷新模板' };
    }

    // 检查区域NPC数量上限
    const regionNPCs = npcSys?.getNPCsByRegion?.(template.region) ?? [];
    if (regionNPCs.length >= this.spawnConfig.maxNPCPerRegion) {
      return { success: false, npcId: null, reason: '已达区域NPC上限' };
    }

    // 获取路径起始位置作为刷新位置
    const path = this.paths.get(template.patrolPathId);
    const spawnPosition: GridPosition = path
      ? { ...path.waypoints[0] }
      : { x: 0, y: 0 };

    // 创建NPC
    let npcData: NPCData | null = null;
    if (npcSys?.createNPC) {
      npcData = npcSys.createNPC(
        template.name,
        template.profession,
        spawnPosition,
        { affinity: template.initialAffinity },
      );
    }

    if (!npcData) {
      return { success: false, npcId: null, reason: 'NPC创建失败' };
    }

    // 记录刷新
    this.spawnRecords.push({
      npcId: npcData.id,
      templateId: template.id,
      spawnTime: this.spawnTimer,
      spawnPosition: { ...spawnPosition },
      expireTime: this.spawnConfig.npcLifetime > 0
        ? this.spawnTimer + this.spawnConfig.npcLifetime
        : 0,
    });

    // 分配巡逻路径
    if (template.patrolPathId) {
      this.assignPatrol(npcData.id, template.patrolPathId);
    }

    // 发出事件
    this.deps?.eventBus?.emit('patrol:npc_spawned', {
      npcId: npcData.id,
      templateId: template.id,
      region: template.region,
      position: spawnPosition,
    });

    return { success: true, npcId: npcData.id };
  }

  /** 强制刷新 */
  forceSpawn(): SpawnResult {
    return this.trySpawnNPC();
  }

  // ═══════════════════════════════════════════
  // 序列化
  // ═══════════════════════════════════════════

  /** 导出存档数据 */
  exportSaveData(): PatrolSaveData {
    return {
      version: PATROL_SAVE_VERSION,
      patrolStates: Array.from(this.patrolStates.values()).map((s) => ({
        npcId: s.npcId,
        patrolPathId: s.patrolPathId,
        currentWaypointIndex: s.currentWaypointIndex,
        direction: s.direction,
        exactPosition: { ...s.exactPosition },
        isPatrolling: s.isPatrolling,
        pauseTimer: s.pauseTimer,
      })),
      spawnRecords: this.spawnRecords.map((r) => ({ ...r })),
      spawnTimer: this.spawnTimer,
    };
  }

  /** 导入存档数据 */
  importSaveData(data: PatrolSaveData): void {
    this.patrolStates.clear();
    this.spawnRecords = [];
    this.spawnTimer = 0;

    if (data.patrolStates) {
      for (const s of data.patrolStates) {
        this.patrolStates.set(s.npcId, {
          npcId: s.npcId,
          patrolPathId: s.patrolPathId,
          currentWaypointIndex: s.currentWaypointIndex,
          direction: s.direction,
          exactPosition: { ...s.exactPosition },
          isPatrolling: s.isPatrolling,
          pauseTimer: s.pauseTimer,
        });
      }
    }

    if (data.spawnRecords) {
      this.spawnRecords = data.spawnRecords.map((r) => ({ ...r }));
    }

    if (typeof data.spawnTimer === 'number') {
      this.spawnTimer = data.spawnTimer;
    }
  }

  // ═══════════════════════════════════════════
  // 内部方法
  // ═══════════════════════════════════════════

  private updateSpawnTimer(dt: number): void {
    if (!this.spawnConfig.autoSpawnEnabled) return;
    if (this.spawnConfig.spawnInterval <= 0) return;

    this.spawnTimer += dt;

    if (this.spawnTimer >= this.spawnConfig.spawnInterval) {
      this.spawnTimer = 0;
      this.trySpawnNPC();
    }
  }

  /** 通过注册表获取 NPCSystem */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getNPCSystem(): any {
    try {
      return this.deps?.registry?.get('npc') ?? null;
    } catch {
      return null;
    }
  }

  /** 按权重随机选择模板 */
  private selectTemplateByWeight(): NPCSpawnTemplate | undefined {
    const templates = Array.from(this.spawnTemplates.values());
    if (templates.length === 0) return undefined;

    const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);
    if (totalWeight <= 0) return templates[0];

    let random = Math.random() * totalWeight;
    for (const template of templates) {
      random -= template.weight;
      if (random <= 0) return template;
    }

    return templates[templates.length - 1];
  }
}
