/**
 * 引擎层 — NPC 管理系统
 *
 * 管理 NPC 的完整生命周期：创建、查询、位置管理、好感度变更。
 * 实现 ISubsystem 接口，可注册到引擎子系统中统一管理。
 *
 * 职责：
 *   - NPC 创建和销毁
 *   - NPC 查询（按ID/区域/职业）
 *   - NPC 位置管理（移动、区域归属）
 *   - 好感度管理（增减、等级判断）
 *   - NPC 可见性控制
 *   - 存档序列化/反序列化
 *
 * @module engine/npc/NPCSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  NPCId,
  NPCData,
  NPCProfession,
  AffinityLevel,
  NPCSaveData,
} from '../../core/npc';
import {
  DEFAULT_NPCS,
  NPC_PROFESSION_DEFS,
  NPC_SAVE_VERSION,
  getAffinityLevel,
} from '../../core/npc';
import type { RegionId, GridPosition } from '../../core/map';
import { getRegionAtPosition } from '../../core/map';

// ─────────────────────────────────────────────
// NPC 管理系统
// ─────────────────────────────────────────────

/**
 * NPC 管理系统
 *
 * 管理 NPC 数据的 CRUD 操作，包括创建、查询、位置和好感度管理。
 *
 * @example
 * ```ts
 * const npcSystem = new NPCSystem();
 * npcSystem.init(deps);
 *
 * // 查询 NPC
 * const npc = npcSystem.getNPCById('npc-merchant-01');
 *
 * // 按区域查询
 * const npcsInRegion = npcSystem.getNPCsByRegion('wei');
 *
 * // 修改好感度
 * npcSystem.changeAffinity('npc-merchant-01', 10);
 * ```
 */
export class NPCSystem implements ISubsystem {
  readonly name = 'npc';

  private deps!: ISystemDeps;
  private npcs: Map<NPCId, NPCData> = new Map();
  private nextIdCounter = 0;

  // ─────────────────────────────────────────
  // ISubsystem 生命周期
  // ─────────────────────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.loadDefaultNPCs();
  }

  update(_dt: number): void {
    // NPC 系统目前不需要帧更新
    // 未来可在此处理 NPC 好感度衰减
  }

  getState(): { npcs: NPCData[] } {
    return { npcs: this.getAllNPCs() };
  }

  reset(): void {
    this.npcs.clear();
    this.nextIdCounter = 0;
    this.loadDefaultNPCs();
  }

  // ─────────────────────────────────────────
  // NPC 创建与管理
  // ─────────────────────────────────────────

  /** 加载默认 NPC 数据 */
  private loadDefaultNPCs(): void {
    for (const npc of DEFAULT_NPCS) {
      this.npcs.set(npc.id, { ...npc });
    }
  }

  /** 生成唯一 NPC ID */
  private generateId(profession: NPCProfession): NPCId {
    this.nextIdCounter++;
    return `npc-${profession}-${String(this.nextIdCounter).padStart(3, '0')}`;
  }

  /**
   * 创建新 NPC
   *
   * @param name - NPC 名字
   * @param profession - NPC 职业
   * @param position - 初始位置
   * @param options - 可选参数
   * @returns 创建的 NPC 数据
   */
  createNPC(
    name: string,
    profession: NPCProfession,
    position: GridPosition,
    options?: {
      affinity?: number;
      visible?: boolean;
      dialogId?: string;
    },
  ): NPCData {
    const profDef = NPC_PROFESSION_DEFS[profession];
    const id = this.generateId(profession);
    const region = getRegionAtPosition(position.x, position.y);

    const npc: NPCData = {
      id,
      name,
      profession,
      affinity: options?.affinity ?? profDef.defaultAffinity,
      position: { ...position },
      region,
      visible: options?.visible ?? true,
      dialogId: options?.dialogId ?? `dialog-${profession}-default`,
      createdAt: 0,
      lastInteractedAt: 0,
    };

    this.npcs.set(id, npc);
    this.deps.eventBus.emit('npc:created', { npcId: id });
    return { ...npc };
  }

  /**
   * 删除 NPC
   *
   * @param id - NPC ID
   * @returns 是否删除成功
   */
  removeNPC(id: NPCId): boolean {
    const existed = this.npcs.delete(id);
    if (existed) {
      this.deps.eventBus.emit('npc:removed', { npcId: id });
    }
    return existed;
  }

  // ─────────────────────────────────────────
  // NPC 查询
  // ─────────────────────────────────────────

  /** 获取所有 NPC 列表 */
  getAllNPCs(): NPCData[] {
    return Array.from(this.npcs.values()).map((n) => ({ ...n }));
  }

  /** 根据 ID 获取 NPC */
  getNPCById(id: NPCId): NPCData | undefined {
    const npc = this.npcs.get(id);
    return npc ? { ...npc } : undefined;
  }

  /** 检查 NPC 是否存在 */
  hasNPC(id: NPCId): boolean {
    return this.npcs.has(id);
  }

  /** 获取 NPC 数量 */
  getNPCCount(): number {
    return this.npcs.size;
  }

  /** 按区域查询 NPC */
  getNPCsByRegion(region: RegionId): NPCData[] {
    return this.getAllNPCs().filter((n) => n.region === region);
  }

  /** 按职业查询 NPC */
  getNPCsByProfession(profession: NPCProfession): NPCData[] {
    return this.getAllNPCs().filter((n) => n.profession === profession);
  }

  /** 按可见性查询 NPC */
  getVisibleNPCs(): NPCData[] {
    return this.getAllNPCs().filter((n) => n.visible);
  }

  /** 按位置范围查询 NPC */
  getNPCsInBounds(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): NPCData[] {
    return this.getAllNPCs().filter(
      (n) =>
        n.position.x >= startX &&
        n.position.x <= endX &&
        n.position.y >= startY &&
        n.position.y <= endY,
    );
  }

  // ─────────────────────────────────────────
  // NPC 属性修改
  // ─────────────────────────────────────────

  /**
   * 修改 NPC 好感度
   *
   * @param id - NPC ID
   * @param delta - 好感度变化量（正数增加，负数减少）
   * @returns 修改后的好感度值，如果 NPC 不存在返回 null
   */
  changeAffinity(id: NPCId, delta: number): number | null {
    const npc = this.npcs.get(id);
    if (!npc) return null;

    const oldLevel = getAffinityLevel(npc.affinity);
    npc.affinity = Math.max(0, Math.min(100, npc.affinity + delta));
    const newLevel = getAffinityLevel(npc.affinity);

    if (oldLevel !== newLevel) {
      this.deps.eventBus.emit('npc:affinity_level_changed', {
        npcId: id,
        oldLevel,
        newLevel,
        affinity: npc.affinity,
      });
    }

    this.deps.eventBus.emit('npc:affinity_changed', {
      npcId: id,
      delta,
      affinity: npc.affinity,
    });

    return npc.affinity;
  }

  /**
   * 设置 NPC 好感度
   *
   * @param id - NPC ID
   * @param value - 好感度值 (0-100)
   * @returns 是否设置成功
   */
  setAffinity(id: NPCId, value: number): boolean {
    const npc = this.npcs.get(id);
    if (!npc) return false;

    npc.affinity = Math.max(0, Math.min(100, value));
    return true;
  }

  /**
   * 获取 NPC 好感度等级
   *
   * @param id - NPC ID
   * @returns 好感度等级，NPC 不存在返回 null
   */
  getAffinityLevel(id: NPCId): AffinityLevel | null {
    const npc = this.npcs.get(id);
    if (!npc) return null;
    return getAffinityLevel(npc.affinity);
  }

  /**
   * 移动 NPC 到新位置
   *
   * @param id - NPC ID
   * @param newPosition - 新位置坐标
   * @returns 是否移动成功
   */
  moveNPC(id: NPCId, newPosition: GridPosition): boolean {
    const npc = this.npcs.get(id);
    if (!npc) return false;

    npc.position = { ...newPosition };
    npc.region = getRegionAtPosition(newPosition.x, newPosition.y);

    this.deps.eventBus.emit('npc:moved', {
      npcId: id,
      position: newPosition,
      region: npc.region,
    });

    return true;
  }

  /**
   * 设置 NPC 可见性
   *
   * @param id - NPC ID
   * @param visible - 是否可见
   * @returns 是否设置成功
   */
  setVisible(id: NPCId, visible: boolean): boolean {
    const npc = this.npcs.get(id);
    if (!npc) return false;

    npc.visible = visible;
    return true;
  }

  /**
   * 更新 NPC 上次交互时间
   *
   * @param id - NPC ID
   * @param timestamp - 交互时间（回合数）
   * @returns 是否更新成功
   */
  updateLastInteracted(id: NPCId, timestamp: number): boolean {
    const npc = this.npcs.get(id);
    if (!npc) return false;

    npc.lastInteractedAt = timestamp;
    return true;
  }

  // ─────────────────────────────────────────
  // 存档序列化
  // ─────────────────────────────────────────

  /** 导出存档数据 */
  exportSaveData(): NPCSaveData {
    return {
      npcs: this.getAllNPCs(),
      version: NPC_SAVE_VERSION,
    };
  }

  /** 导入存档数据 */
  importSaveData(data: NPCSaveData): void {
    this.npcs.clear();
    for (const npc of data.npcs) {
      this.npcs.set(npc.id, { ...npc });
    }
  }
}
