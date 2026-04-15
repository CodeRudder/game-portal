/**
 * NPC 任务发布系统
 *
 * 管理 NPC 发布的任务（Quest），包括任务创建、接取、
 * 进度追踪、完成/失败判定、奖励发放等。
 *
 * 任务类型：
 * - COLLECT: 收集指定数量的资源
 * - DEFEAT: 击败指定数量的敌人
 * - EXPLORE: 探索指定地图区域
 * - DELIVER: 将物品送达指定 NPC
 * - ESCORT: 护送 NPC 到指定位置
 *
 * @module engine/npc/QuestBoard
 */

import type { NPCEventBus } from './NPCEventBus';

// ---------------------------------------------------------------------------
// 任务数据结构
// ---------------------------------------------------------------------------

/** 任务类型 */
export enum QuestType {
  COLLECT = 'collect',
  DEFEAT = 'defeat',
  EXPLORE = 'explore',
  DELIVER = 'deliver',
  ESCORT = 'escort',
}

/** 任务难度 */
export enum QuestDifficulty {
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard',
  EPIC = 'epic',
}

/** 任务状态 */
export enum QuestStatus {
  AVAILABLE = 'available',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

/** 任务奖励 */
export interface QuestReward {
  /** 金币 */
  gold?: number;
  /** 经验值 */
  exp?: number;
  /** 物品奖励 */
  items?: { itemId: string; quantity: number }[];
  /** 好感度奖励 */
  relationshipBonus?: number;
}

/** 任务目标 */
export interface QuestObjective {
  /** 目标描述 */
  description: string;
  /** 目标类型 */
  type: QuestType;
  /** 目标 ID（物品/敌人/区域） */
  targetId: string;
  /** 需要数量 */
  requiredAmount: number;
  /** 当前进度 */
  currentAmount: number;
}

/** 任务定义 */
export interface Quest {
  /** 任务唯一 ID */
  id: string;
  /** 任务标题 */
  title: string;
  /** 任务描述 */
  description: string;
  /** 发布者 NPC ID */
  publisherNpcId: string;
  /** 任务类型 */
  type: QuestType;
  /** 难度 */
  difficulty: QuestDifficulty;
  /** 状态 */
  status: QuestStatus;
  /** 目标列表 */
  objectives: QuestObjective[];
  /** 奖励 */
  rewards: QuestReward;
  /** 时限（秒），0 表示无限 */
  timeLimit: number;
  /** 接取时间戳 */
  acceptedAt: number | null;
  /** 完成时间戳 */
  completedAt: number | null;
  /** 最低好感度要求 */
  minRelationshipLevel: string;
  /** 最低玩家等级 */
  minPlayerLevel: number;
}

// ---------------------------------------------------------------------------
// 自动 ID 计数器
// ---------------------------------------------------------------------------

let questIdCounter = 0;

function generateQuestId(): string {
  return `quest_${++questIdCounter}_${Date.now()}`;
}

// ---------------------------------------------------------------------------
// QuestBoard
// ---------------------------------------------------------------------------

/**
 * NPC 任务发布系统
 *
 * 提供 NPC 任务的创建、查询、接取、进度更新、完成/失败处理。
 * 通过事件总线广播任务状态变更事件。
 */
export class QuestBoard {
  /** 所有任务 */
  private quests: Map<string, Quest> = new Map();

  /** 事件总线 */
  private eventBus: NPCEventBus;

  constructor(eventBus: NPCEventBus) {
    this.eventBus = eventBus;
  }

  // -----------------------------------------------------------------------
  // 任务创建
  // -----------------------------------------------------------------------

  /**
   * 创建一个新任务
   * @param data - 任务数据（不含 id、status、acceptedAt、completedAt）
   * @returns 创建的任务
   */
  createQuest(
    data: Omit<Quest, 'id' | 'status' | 'acceptedAt' | 'completedAt'>,
  ): Quest {
    const quest: Quest = {
      ...data,
      id: generateQuestId(),
      status: QuestStatus.AVAILABLE,
      acceptedAt: null,
      completedAt: null,
    };

    this.quests.set(quest.id, quest);
    this.eventBus.emit('questCreated', quest);
    return quest;
  }

  /**
   * 批量创建任务
   * @param dataList - 任务数据列表
   * @returns 创建的任务数组
   */
  createQuests(
    dataList: Omit<Quest, 'id' | 'status' | 'acceptedAt' | 'completedAt'>[],
  ): Quest[] {
    return dataList.map((data) => this.createQuest(data));
  }

  // -----------------------------------------------------------------------
  // 任务接取
  // -----------------------------------------------------------------------

  /**
   * 玩家接取任务
   * @param questId - 任务 ID
   * @param playerLevel - 玩家等级（用于检查等级要求）
   * @param relationshipLevel - 玩家与发布者的好感度等级
   * @returns 是否成功接取
   */
  acceptQuest(
    questId: string,
    playerLevel: number = 1,
    relationshipLevel: string = 'stranger',
  ): boolean {
    const quest = this.quests.get(questId);
    if (!quest) return false;
    if (quest.status !== QuestStatus.AVAILABLE) return false;

    // 检查等级要求
    if (playerLevel < quest.minPlayerLevel) return false;

    // 检查好感度要求
    if (quest.minRelationshipLevel && relationshipLevel !== quest.minRelationshipLevel) {
      // 简化处理：只要等级不低于要求即可
      const levels = ['stranger', 'acquaintance', 'friend', 'close_friend', 'confidant'];
      const requiredIdx = levels.indexOf(quest.minRelationshipLevel);
      const currentIdx = levels.indexOf(relationshipLevel);
      if (currentIdx < requiredIdx) return false;
    }

    quest.status = QuestStatus.ACTIVE;
    quest.acceptedAt = Date.now();

    this.eventBus.emit('questAccepted', quest);
    return true;
  }

  // -----------------------------------------------------------------------
  // 进度更新
  // -----------------------------------------------------------------------

  /**
   * 更新任务目标进度
   * @param questId - 任务 ID
   * @param objectiveIndex - 目标索引
   * @param amount - 增加数量
   * @returns 更新后的目标进度，若任务不存在返回 null
   */
  updateObjective(questId: string, objectiveIndex: number, amount: number): QuestObjective | null {
    const quest = this.quests.get(questId);
    if (!quest || quest.status !== QuestStatus.ACTIVE) return null;
    if (objectiveIndex < 0 || objectiveIndex >= quest.objectives.length) return null;

    const obj = quest.objectives[objectiveIndex];
    obj.currentAmount = Math.min(obj.currentAmount + amount, obj.requiredAmount);

    this.eventBus.emit('questProgress', {
      questId,
      objectiveIndex,
      currentAmount: obj.currentAmount,
      requiredAmount: obj.requiredAmount,
    });

    // 检查是否所有目标都完成
    if (this.areAllObjectivesComplete(quest)) {
      this.completeQuest(questId);
    }

    return obj;
  }

  /**
   * 通过目标类型和 ID 更新进度（自动匹配目标）
   * @param type - 目标类型
   * @param targetId - 目标 ID
   * @param amount - 增加数量
   * @returns 受影响的任务列表
   */
  progressByType(type: QuestType, targetId: string, amount: number): Quest[] {
    const affected: Quest[] = [];

    for (const quest of this.quests.values()) {
      if (quest.status !== QuestStatus.ACTIVE) continue;

      for (let i = 0; i < quest.objectives.length; i++) {
        const obj = quest.objectives[i];
        if (obj.type === type && obj.targetId === targetId && obj.currentAmount < obj.requiredAmount) {
          this.updateObjective(quest.id, i, amount);
          affected.push(quest);
        }
      }
    }

    return affected;
  }

  // -----------------------------------------------------------------------
  // 任务完成 / 失败
  // -----------------------------------------------------------------------

  /**
   * 完成任务
   * @param questId - 任务 ID
   * @returns 是否成功完成
   */
  completeQuest(questId: string): boolean {
    const quest = this.quests.get(questId);
    if (!quest || quest.status !== QuestStatus.ACTIVE) return false;
    if (!this.areAllObjectivesComplete(quest)) return false;

    quest.status = QuestStatus.COMPLETED;
    quest.completedAt = Date.now();

    this.eventBus.emit('questCompleted', quest);
    return true;
  }

  /**
   * 任务失败
   * @param questId - 任务 ID
   * @returns 是否成功标记为失败
   */
  failQuest(questId: string): boolean {
    const quest = this.quests.get(questId);
    if (!quest || quest.status !== QuestStatus.ACTIVE) return false;

    quest.status = QuestStatus.FAILED;

    this.eventBus.emit('questFailed', quest);
    return true;
  }

  /**
   * 检查并处理超时任务
   * @param currentTime - 当前时间戳
   * @returns 过期的任务列表
   */
  checkExpired(currentTime: number): Quest[] {
    const expired: Quest[] = [];

    for (const quest of this.quests.values()) {
      if (quest.status !== QuestStatus.ACTIVE) continue;
      if (quest.timeLimit <= 0) continue;
      if (!quest.acceptedAt) continue;

      const elapsed = (currentTime - quest.acceptedAt) / 1000;
      if (elapsed >= quest.timeLimit) {
        quest.status = QuestStatus.EXPIRED;
        this.eventBus.emit('questExpired', quest);
        expired.push(quest);
      }
    }

    return expired;
  }

  // -----------------------------------------------------------------------
  // 查询
  // -----------------------------------------------------------------------

  /**
   * 获取任务
   * @param questId - 任务 ID
   */
  getQuest(questId: string): Quest | undefined {
    return this.quests.get(questId);
  }

  /**
   * 获取指定 NPC 发布的所有任务
   * @param npcId - NPC 实例 ID
   */
  getQuestsByPublisher(npcId: string): Quest[] {
    const result: Quest[] = [];
    for (const quest of this.quests.values()) {
      if (quest.publisherNpcId === npcId) {
        result.push(quest);
      }
    }
    return result;
  }

  /**
   * 获取指定状态的任务
   * @param status - 任务状态
   */
  getQuestsByStatus(status: QuestStatus): Quest[] {
    const result: Quest[] = [];
    for (const quest of this.quests.values()) {
      if (quest.status === status) {
        result.push(quest);
      }
    }
    return result;
  }

  /**
   * 获取可接取的任务
   * @param playerLevel - 玩家等级
   * @param relationshipLevel - 好感度等级
   */
  getAvailableQuests(playerLevel: number = 1, relationshipLevel: string = 'stranger'): Quest[] {
    const levels = ['stranger', 'acquaintance', 'friend', 'close_friend', 'confidant'];
    const currentLevelIdx = levels.indexOf(relationshipLevel);

    return this.getQuestsByStatus(QuestStatus.AVAILABLE).filter((quest) => {
      if (playerLevel < quest.minPlayerLevel) return false;
      if (quest.minRelationshipLevel) {
        const requiredIdx = levels.indexOf(quest.minRelationshipLevel);
        if (currentLevelIdx < requiredIdx) return false;
      }
      return true;
    });
  }

  /**
   * 获取玩家当前活跃的任务
   */
  getActiveQuests(): Quest[] {
    return this.getQuestsByStatus(QuestStatus.ACTIVE);
  }

  /**
   * 获取任务完成进度
   * @param questId - 任务 ID
   * @returns 进度 0~1
   */
  getProgress(questId: string): number {
    const quest = this.quests.get(questId);
    if (!quest || quest.objectives.length === 0) return 0;

    let total = 0;
    let done = 0;
    for (const obj of quest.objectives) {
      total += obj.requiredAmount;
      done += Math.min(obj.currentAmount, obj.requiredAmount);
    }

    return total > 0 ? done / total : 0;
  }

  /**
   * 获取所有任务
   */
  getAllQuests(): Quest[] {
    return Array.from(this.quests.values());
  }

  /**
   * 移除任务
   * @param questId - 任务 ID
   */
  removeQuest(questId: string): boolean {
    return this.quests.delete(questId);
  }

  // -----------------------------------------------------------------------
  // 序列化
  // -----------------------------------------------------------------------

  /** 序列化所有任务数据 */
  serialize(): object {
    return {
      quests: Array.from(this.quests.entries()),
      questIdCounter,
    };
  }

  /** 反序列化恢复任务数据 */
  deserialize(data: Record<string, unknown>): void {
    const d = data as {
      quests: [string, Quest][];
      questIdCounter: number;
    };

    this.quests.clear();
    for (const [id, quest] of d.quests ?? []) {
      this.quests.set(id, quest);
    }
    if (typeof d.questIdCounter === 'number') {
      questIdCounter = d.questIdCounter;
    }
  }

  // -----------------------------------------------------------------------
  // 内部辅助
  // -----------------------------------------------------------------------

  /** 检查所有目标是否完成 */
  private areAllObjectivesComplete(quest: Quest): boolean {
    return quest.objectives.every(
      (obj) => obj.currentAmount >= obj.requiredAmount,
    );
  }
}
