/**
 * 引擎层 — NPC 刷新管理器
 *
 * 从 NPCPatrolSystem.ts 拆分出的 NPC 刷新规则逻辑。
 * 职责：刷新模板注册、定时刷新、权重选择、刷新记录管理
 *
 * @module engine/npc/NPCSpawnManager
 */

import type {
  NPCData,
  GridPosition,
  NPCSpawnTemplate,
  NPCSpawnConfig,
  NPCSpawnRecord,
  SpawnResult,
} from '../../core/npc';
import { DEFAULT_SPAWN_CONFIG } from './PatrolConfig';

/**
 * NPCSystem 对外暴露的方法子集（刷新管理器所需）
 * 避免直接依赖 NPCSystem 具体类，降低耦合。
 */
export interface INPCSystemFacade {
  getNPCCount(): number;
  getNPCsByRegion(region: string): NPCData[];
  createNPC(
    name: string,
    profession: string,
    position: GridPosition,
    options?: { affinity?: number; visible?: boolean; dialogId?: string },
  ): NPCData | null;
}

/** 刷新管理器依赖 */
export interface SpawnManagerDeps {
  /** 获取 NPCSystem 引用 */
  getNPCSystem: () => INPCSystemFacade | null;
  /** 分配巡逻路径 */
  assignPatrol: (npcId: string, pathId: string) => void;
  /** 获取路径起始位置 */
  getPathStartPosition: (pathId: string) => GridPosition | null;
  /** 事件发射 */
  emitEvent: (event: string, data: unknown) => void;
}

/**
 * NPC 刷新管理器
 *
 * 管理 NPC 的定时刷新规则、模板权重选择和刷新记录。
 * 由 NPCPatrolSystem 持有并委托调用。
 */
export class NPCSpawnManager {
  private spawnTemplates: Map<string, NPCSpawnTemplate> = new Map();
  private spawnConfig: NPCSpawnConfig = { ...DEFAULT_SPAWN_CONFIG };
  private spawnRecords: NPCSpawnRecord[] = [];
  private spawnTimer: number = 0;
  private deps: SpawnManagerDeps | null = null;

  /** 注入依赖 */
  setDeps(deps: SpawnManagerDeps): void {
    this.deps = deps;
  }

  // ─── 配置 ──────────────────────────────────

  /** 获取刷新配置 */
  getConfig(): NPCSpawnConfig {
    return { ...this.spawnConfig };
  }

  /** 更新刷新配置（局部更新） */
  setConfig(config: Partial<NPCSpawnConfig>): void {
    this.spawnConfig = { ...this.spawnConfig, ...config };
  }

  // ─── 模板管理 ──────────────────────────────

  /** 注册刷新模板 */
  registerTemplate(template: NPCSpawnTemplate): void {
    this.spawnTemplates.set(template.id, { ...template });
  }

  /** 批量注册刷新模板 */
  registerTemplates(templates: NPCSpawnTemplate[]): void {
    templates.forEach((t) => this.registerTemplate(t));
  }

  /** 获取刷新模板 */
  getTemplate(id: string): NPCSpawnTemplate | undefined {
    const t = this.spawnTemplates.get(id);
    return t ? { ...t } : undefined;
  }

  /** 获取所有刷新模板 */
  getAllTemplates(): NPCSpawnTemplate[] {
    return Array.from(this.spawnTemplates.values()).map((t) => ({ ...t }));
  }

  // ─── 记录查询 ──────────────────────────────

  /** 获取刷新记录 */
  getRecords(): NPCSpawnRecord[] {
    return [...this.spawnRecords];
  }

  /** 获取刷新计时器值 */
  getTimer(): number {
    return this.spawnTimer;
  }

  // ─── 刷新逻辑 ──────────────────────────────

  /** 更新刷新计时器 */
  updateTimer(dt: number): void {
    if (!this.spawnConfig.autoSpawnEnabled) return;
    if (this.spawnConfig.spawnInterval <= 0) return;

    this.spawnTimer += dt;

    if (this.spawnTimer >= this.spawnConfig.spawnInterval) {
      this.spawnTimer = 0;
      this.trySpawn();
    }
  }

  /**
   * 尝试刷新一个 NPC
   */
  trySpawn(): SpawnResult {
    if (!this.deps) {
      return { success: false, npcId: null, reason: '依赖未设置' };
    }

    if (this.spawnTemplates.size === 0) {
      return { success: false, npcId: null, reason: '没有可用的刷新模板' };
    }

    const npcSys = this.deps.getNPCSystem();

    // 检查全局NPC数量上限
    const currentCount = npcSys?.getNPCCount() ?? 0;
    if (currentCount >= this.spawnConfig.maxNPCCount) {
      return { success: false, npcId: null, reason: '已达全局NPC上限' };
    }

    // 按权重选择模板
    const template = this.selectTemplateByWeight();
    if (!template) {
      return { success: false, npcId: null, reason: '没有可用的刷新模板' };
    }

    // 检查区域NPC数量上限
    const regionNPCs = npcSys?.getNPCsByRegion(template.region) ?? [];
    if (regionNPCs.length >= this.spawnConfig.maxNPCPerRegion) {
      return { success: false, npcId: null, reason: '已达区域NPC上限' };
    }

    // 获取路径起始位置作为刷新位置
    const startPos = this.deps.getPathStartPosition(template.patrolPathId);
    const spawnPosition: GridPosition = startPos ?? { x: 0, y: 0 };

    // 创建NPC
    let npcData: NPCData | null = null;
    if (npcSys) {
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
      this.deps.assignPatrol(npcData.id, template.patrolPathId);
    }

    // 发出事件
    this.deps.emitEvent('patrol:npc_spawned', {
      npcId: npcData.id,
      templateId: template.id,
      region: template.region,
      position: spawnPosition,
    });

    return { success: true, npcId: npcData.id };
  }

  /** 强制刷新 */
  forceSpawn(): SpawnResult {
    return this.trySpawn();
  }

  /** 完全重置 */
  fullReset(): void {
    this.spawnRecords = [];
    this.spawnTimer = 0;
    this.spawnTemplates.clear();
    this.spawnConfig = { ...DEFAULT_SPAWN_CONFIG };
  }

  // ─── 序列化辅助 ─────────────────────────────

  /** 导出存档数据 */
  exportSaveData(): { spawnRecords: NPCSpawnRecord[]; spawnTimer: number } {
    return {
      spawnRecords: this.spawnRecords.map((r) => ({ ...r })),
      spawnTimer: this.spawnTimer,
    };
  }

  /** 导入存档数据 */
  importSaveData(data: { spawnRecords?: NPCSpawnRecord[]; spawnTimer?: number }): void {
    this.spawnRecords = [];
    this.spawnTimer = 0;

    if (data.spawnRecords) {
      this.spawnRecords = data.spawnRecords.map((r) => ({ ...r }));
    }

    if (typeof data.spawnTimer === 'number') {
      this.spawnTimer = data.spawnTimer;
    }
  }

  // ─── 内部方法 ──────────────────────────────

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
