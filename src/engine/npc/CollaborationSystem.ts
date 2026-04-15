/**
 * NPC 协作系统
 *
 * 管理多个 NPC 协同完成任务的机制。支持运粮队、建筑队、
 * 巡逻队、商队、丰收队等多种协作场景。
 *
 * 核心概念：
 * - CollaborationTask：一个协作任务，定义所需职业、人数、位置、时长
 * - 自动匹配：根据任务需求，从 NPC 管理器中找到合适的空闲 NPC
 * - 进度管理：协作任务按参与人数和时间推进进度
 *
 * @module engine/npc/CollaborationSystem
 */

import type { NPCProfession } from './types';
import type { NPCEventBus } from './NPCEventBus';

// ---------------------------------------------------------------------------
// 协作任务类型
// ---------------------------------------------------------------------------

/** 协作任务类型枚举 */
export type CollaborationTaskType =
  | 'transport'
  | 'build'
  | 'patrol'
  | 'harvest'
  | 'trade_caravan';

/** 协作任务定义 */
export interface CollaborationTask {
  /** 任务唯一 ID */
  id: string;
  /** 任务类型 */
  type: CollaborationTaskType;
  /** 需要的职业列表 */
  requiredProfessions: NPCProfession[];
  /** 最少参与人数 */
  minParticipants: number;
  /** 最多参与人数 */
  maxParticipants: number;
  /** 任务目标位置 */
  location: { x: number; y: number };
  /** 任务持续时间（秒） */
  duration: number;
  /** 当前进度 0~1 */
  progress: number;
  /** 已加入的 NPC ID 列表 */
  participants: string[];
  /** 完成奖励 */
  rewards: Record<string, number>;
}

// ---------------------------------------------------------------------------
// NPCManager 接口（由外部注入，避免硬依赖）
// ---------------------------------------------------------------------------

/** NPC 管理器接口，仅暴露协作系统需要的查询能力 */
export interface INPCManagerForCollaboration {
  /** 获取所有 NPC 实例 */
  getAllNPCs(): { id: string; profession: NPCProfession; state: string }[];
}

// ---------------------------------------------------------------------------
// 自动 ID 计数器
// ---------------------------------------------------------------------------

let taskIdCounter = 0;

function generateTaskId(): string {
  taskIdCounter += 1;
  return `collab_${taskIdCounter}_${Date.now()}`;
}

// ---------------------------------------------------------------------------
// CollaborationSystem
// ---------------------------------------------------------------------------

/**
 * NPC 协作系统
 *
 * 负责创建、匹配、推进多 NPC 协作任务。
 * 通过 INPCManagerForCollaboration 接口查询可用 NPC，
 * 通过 NPCEventBus 广播协作事件。
 */
export class CollaborationSystem {
  /** 所有活跃的协作任务 */
  private tasks: Map<string, CollaborationTask> = new Map();

  /** NPC 管理器（只读查询） */
  private npcManager: INPCManagerForCollaboration;

  /** 事件总线 */
  private eventBus: NPCEventBus;

  constructor(npcManager: INPCManagerForCollaboration, eventBus: NPCEventBus) {
    this.npcManager = npcManager;
    this.eventBus = eventBus;
  }

  // -----------------------------------------------------------------------
  // 任务创建与管理
  // -----------------------------------------------------------------------

  /**
   * 创建一个新的协作任务
   * @param taskData - 任务数据（不含 id、progress、participants）
   * @returns 创建完成的协作任务
   */
  createTask(
    taskData: Omit<CollaborationTask, 'id' | 'progress' | 'participants'>,
  ): CollaborationTask {
    const task: CollaborationTask = {
      ...taskData,
      id: generateTaskId(),
      progress: 0,
      participants: [],
    };

    this.tasks.set(task.id, task);
    this.eventBus.emit('collaborationTaskCreated', task);
    return task;
  }

  /**
   * NPC 加入协作任务
   * @param taskId - 任务 ID
   * @param npcId  - NPC 实例 ID
   * @returns 是否成功加入
   */
  joinTask(taskId: string, npcId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // 已满员
    if (task.participants.length >= task.maxParticipants) return false;

    // 已在任务中
    if (task.participants.includes(npcId)) return false;

    // 检查 NPC 职业是否匹配
    const npc = this.npcManager.getAllNPCs().find((n) => n.id === npcId);
    if (!npc) return false;

    if (task.requiredProfessions.length > 0) {
      const hasRequiredProfession = task.requiredProfessions.includes(npc.profession);
      if (!hasRequiredProfession) return false;
    }

    task.participants.push(npcId);
    this.eventBus.emit('collaborationNpcJoined', { task, npcId });

    // 检查是否达到最低人数
    if (task.participants.length >= task.minParticipants && task.progress === 0) {
      this.eventBus.emit('collaborationTaskStarted', task);
    }

    return true;
  }

  /**
   * NPC 离开协作任务
   * @param taskId - 任务 ID
   * @param npcId  - NPC 实例 ID
   */
  leaveTask(taskId: string, npcId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const idx = task.participants.indexOf(npcId);
    if (idx === -1) return false;

    task.participants.splice(idx, 1);
    this.eventBus.emit('collaborationNpcLeft', { task, npcId });

    // 人数不足时暂停（进度不变）
    if (task.participants.length < task.minParticipants) {
      this.eventBus.emit('collaborationTaskPaused', task);
    }

    return true;
  }

  // -----------------------------------------------------------------------
  // 更新循环
  // -----------------------------------------------------------------------

  /**
   * 每帧更新所有活跃任务的进度
   * @param deltaTime - 帧间隔（秒）
   */
  update(deltaTime: number): void {
    for (const task of this.tasks.values()) {
      // 人数不足时不推进
      if (task.participants.length < task.minParticipants) continue;

      // 进度按参与人数 / 最低人数比例推进
      const efficiency = task.participants.length / task.minParticipants;
      task.progress += (deltaTime / task.duration) * Math.min(efficiency, 1.5);

      if (task.progress >= 1) {
        task.progress = 1;
        this.eventBus.emit('collaborationTaskCompleted', task);
        this.tasks.delete(task.id);
      }
    }
  }

  // -----------------------------------------------------------------------
  // 查询
  // -----------------------------------------------------------------------

  /**
   * 自动匹配：寻找合适的空闲 NPC 组队
   * @param taskId - 任务 ID
   * @returns 匹配到的 NPC ID 列表
   */
  autoMatch(taskId: string): string[] {
    const task = this.tasks.get(taskId);
    if (!task) return [];

    const allNPCs = this.npcManager.getAllNPCs();

    // 筛选空闲且职业匹配的 NPC
    const candidates = allNPCs.filter((npc) => {
      // 排除已在任务中的 NPC
      if (task.participants.includes(npc.id)) return false;
      // 只选择空闲状态的 NPC
      if (npc.state !== 'idle') return false;
      // 检查职业是否匹配
      if (task.requiredProfessions.length > 0) {
        return task.requiredProfessions.includes(npc.profession);
      }
      return true;
    });

    // 按职业优先级排序，优先匹配需求职业
    const matched: string[] = [];
    const remaining = task.maxParticipants - task.participants.length;

    for (const profession of task.requiredProfessions) {
      const match = candidates.find(
        (c) => c.profession === profession && !matched.includes(c.id),
      );
      if (match && matched.length < remaining) {
        matched.push(match.id);
      }
    }

    // 填充剩余名额
    for (const candidate of candidates) {
      if (matched.length >= remaining) break;
      if (!matched.includes(candidate.id)) {
        matched.push(candidate.id);
      }
    }

    return matched;
  }

  /**
   * 获取所有活跃的协作任务
   */
  getActiveTasks(): CollaborationTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取指定 NPC 当前参与的协作任务
   * @param npcId - NPC 实例 ID
   */
  getNPCTask(npcId: string): CollaborationTask | null {
    for (const task of this.tasks.values()) {
      if (task.participants.includes(npcId)) {
        return task;
      }
    }
    return null;
  }

  /**
   * 获取指定 ID 的协作任务
   * @param taskId - 任务 ID
   */
  getTask(taskId: string): CollaborationTask | undefined {
    return this.tasks.get(taskId);
  }
}
