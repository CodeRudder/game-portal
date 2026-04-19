/**
 * NPC 好感度系统
 *
 * 管理 NPC 与玩家之间、NPC 与 NPC 之间的关系。
 * 好感度等级影响对话内容、可触发任务、交易折扣等。
 *
 * 好感度等级：
 * - STRANGER (陌生人): 0~19
 * - ACQUAINTANCE (熟人): 20~39
 * - FRIEND (朋友): 40~59
 * - CLOSE_FRIEND (挚友): 60~79
 * - CONFIDANT (知己): 80~100
 *
 * @module engine/npc/RelationshipSystem
 */

import type { NPCEventBus } from './NPCEventBus';

// ---------------------------------------------------------------------------
// 好感度等级
// ---------------------------------------------------------------------------

/** 好感度等级枚举 */
export enum RelationshipLevel {
  STRANGER = 'stranger',
  ACQUAINTANCE = 'acquaintance',
  FRIEND = 'friend',
  CLOSE_FRIEND = 'close_friend',
  CONFIDANT = 'confidant',
}

/** NPC 之间的关系类型 */
export enum NPCRelationType {
  ALLY = 'ally',
  RIVAL = 'rival',
  MENTOR = 'mentor',
  APPRENTICE = 'apprentice',
  NEUTRAL = 'neutral',
}

// ---------------------------------------------------------------------------
// 好感度数据结构
// ---------------------------------------------------------------------------

/** 好感度等级阈值 */
const LEVEL_THRESHOLDS: { level: RelationshipLevel; min: number; max: number }[] = [
  { level: RelationshipLevel.STRANGER, min: 0, max: 19 },
  { level: RelationshipLevel.ACQUAINTANCE, min: 20, max: 39 },
  { level: RelationshipLevel.FRIEND, min: 40, max: 59 },
  { level: RelationshipLevel.CLOSE_FRIEND, min: 60, max: 79 },
  { level: RelationshipLevel.CONFIDANT, min: 80, max: 100 },
];

/** 好感度变动原因 */
export type RelationshipChangeReason =
  | 'dialogue'
  | 'gift'
  | 'quest_complete'
  | 'quest_fail'
  | 'trade'
  | 'help'
  | 'attack'
  | 'insult'
  | 'schedule_interact';

/** 好感度变动记录 */
export interface RelationshipChangeLog {
  npcId: string;
  oldPoints: number;
  newPoints: number;
  change: number;
  reason: RelationshipChangeReason;
  timestamp: number;
}

/** 单个 NPC 对玩家的好感度 */
export interface PlayerRelationship {
  npcId: string;
  points: number;
  level: RelationshipLevel;
  /** 累计交互次数 */
  interactionCount: number;
  /** 最后交互时间 */
  lastInteractionTime: number;
  /** 是否已解锁特殊对话 */
  unlockedDialogues: string[];
  /** 变动日志 */
  changeLog: RelationshipChangeLog[];
}

/** NPC 之间的关系 */
export interface NPCRelationship {
  npcId1: string;
  npcId2: string;
  relationType: NPCRelationType;
  /** 好感度 0~100 */
  affinity: number;
}

/** 好感度变动配置 */
export interface RelationshipChangeConfig {
  dialogue: number;
  gift: number;
  quest_complete: number;
  quest_fail: number;
  trade: number;
  help: number;
  attack: number;
  insult: number;
  schedule_interact: number;
}

/** 默认好感度变动值 */
const DEFAULT_CHANGES: RelationshipChangeConfig = {
  dialogue: 2,
  gift: 10,
  quest_complete: 15,
  quest_fail: -10,
  trade: 3,
  help: 8,
  attack: -30,
  insult: -15,
  schedule_interact: 1,
};

// ---------------------------------------------------------------------------
// RelationshipSystem
// ---------------------------------------------------------------------------

/**
 * NPC 好感度系统
 *
 * 管理玩家与 NPC 之间的好感度关系，以及 NPC 之间的社交关系网。
 * 提供好感度查询、变动、等级判断、折扣计算等接口。
 */
export class RelationshipSystem {
  /** 玩家与 NPC 的好感度映射 */
  private playerRelationships: Map<string, PlayerRelationship> = new Map();

  /** NPC 之间的关系映射 (key: `${npcId1}_${npcId2}`) */
  private npcRelationships: Map<string, NPCRelationship> = new Map();

  /** 好感度变动配置 */
  private changeConfig: RelationshipChangeConfig;

  /** 事件总线 */
  private eventBus: NPCEventBus;

  constructor(eventBus: NPCEventBus, config?: Partial<RelationshipChangeConfig>) {
    this.eventBus = eventBus;
    this.changeConfig = { ...DEFAULT_CHANGES, ...config };
  }

  // -----------------------------------------------------------------------
  // 玩家好感度管理
  // -----------------------------------------------------------------------

  /**
   * 获取或初始化 NPC 对玩家的好感度
   * @param npcId - NPC 实例 ID
   * @returns 好感度数据
   */
  getOrCreate(npcId: string): PlayerRelationship {
    let rel = this.playerRelationships.get(npcId);
    if (!rel) {
      rel = {
        npcId,
        points: 0,
        level: RelationshipLevel.STRANGER,
        interactionCount: 0,
        lastInteractionTime: 0,
        unlockedDialogues: [],
        changeLog: [],
      };
      this.playerRelationships.set(npcId, rel);
    }
    return rel;
  }

  /**
   * 获取好感度等级
   * @param npcId - NPC 实例 ID
   * @returns 好感度等级
   */
  getLevel(npcId: string): RelationshipLevel {
    const rel = this.playerRelationships.get(npcId);
    return rel?.level ?? RelationshipLevel.STRANGER;
  }

  /**
   * 获取好感度点数
   * @param npcId - NPC 实例 ID
   * @returns 好感度点数 (0-100)
   */
  getPoints(npcId: string): number {
    const rel = this.playerRelationships.get(npcId);
    return rel?.points ?? 0;
  }

  /**
   * 修改好感度
   * @param npcId - NPC 实例 ID
   * @param reason - 变动原因
   * @param customChange - 自定义变动值（覆盖默认配置）
   * @returns 变动后的好感度数据
   */
  changeRelationship(
    npcId: string,
    reason: RelationshipChangeReason,
    customChange?: number,
  ): PlayerRelationship {
    const rel = this.getOrCreate(npcId);
    const change = customChange ?? this.changeConfig[reason];

    const oldPoints = rel.points;
    const oldLevel = rel.level;

    // 计算新点数，限制在 0~100
    rel.points = Math.max(0, Math.min(100, rel.points + change));
    rel.level = this.pointsToLevel(rel.points);
    rel.interactionCount++;
    rel.lastInteractionTime = Date.now();

    // 记录日志
    const logEntry: RelationshipChangeLog = {
      npcId,
      oldPoints,
      newPoints: rel.points,
      change: rel.points - oldPoints,
      reason,
      timestamp: Date.now(),
    };
    rel.changeLog.push(logEntry);

    // 触发事件
    this.eventBus.emit('relationshipChanged', {
      npcId,
      oldPoints,
      newPoints: rel.points,
      reason,
      change: rel.points - oldPoints,
    });

    // 等级变化时触发额外事件
    if (oldLevel !== rel.level) {
      this.eventBus.emit('relationshipLevelChanged', {
        npcId,
        oldLevel,
        newLevel: rel.level,
      });
    }

    return rel;
  }

  /**
   * 直接设置好感度点数
   * @param npcId - NPC 实例 ID
   * @param points - 目标点数
   */
  setPoints(npcId: string, points: number): void {
    const rel = this.getOrCreate(npcId);
    rel.points = Math.max(0, Math.min(100, points));
    rel.level = this.pointsToLevel(rel.points);
  }

  /**
   * 解锁特殊对话
   * @param npcId - NPC 实例 ID
   * @param dialogueId - 对话 ID
   */
  unlockDialogue(npcId: string, dialogueId: string): void {
    const rel = this.getOrCreate(npcId);
    if (!rel.unlockedDialogues.includes(dialogueId)) {
      rel.unlockedDialogues.push(dialogueId);
      this.eventBus.emit('dialogueUnlocked', { npcId, dialogueId });
    }
  }

  /**
   * 检查是否已解锁对话
   * @param npcId - NPC 实例 ID
   * @param dialogueId - 对话 ID
   */
  isDialogueUnlocked(npcId: string, dialogueId: string): boolean {
    const rel = this.playerRelationships.get(npcId);
    return rel?.unlockedDialogues.includes(dialogueId) ?? false;
  }

  // -----------------------------------------------------------------------
  // 交易折扣
  // -----------------------------------------------------------------------

  /**
   * 计算交易折扣系数
   * @param npcId - NPC 实例 ID
   * @returns 折扣系数 (0.7~1.0)，等级越高折扣越大
   */
  getTradeDiscount(npcId: string): number {
    const level = this.getLevel(npcId);
    switch (level) {
      case RelationshipLevel.CONFIDANT:
        return 0.7;
      case RelationshipLevel.CLOSE_FRIEND:
        return 0.8;
      case RelationshipLevel.FRIEND:
        return 0.85;
      case RelationshipLevel.ACQUAINTANCE:
        return 0.9;
      case RelationshipLevel.STRANGER:
      default:
        return 1.0;
    }
  }

  /**
   * 计算好感度加成后的价格
   * @param npcId - NPC 实例 ID
   * @param basePrice - 基础价格
   * @returns 折后价格（向上取整）
   */
  getDiscountedPrice(npcId: string, basePrice: number): number {
    const discount = this.getTradeDiscount(npcId);
    return Math.ceil(basePrice * discount);
  }

  // -----------------------------------------------------------------------
  // NPC 间关系
  // -----------------------------------------------------------------------

  /**
   * 设置 NPC 之间的关系
   * @param npcId1 - NPC 1 ID
   * @param npcId2 - NPC 2 ID
   * @param relationType - 关系类型
   * @param affinity - 好感度 (0-100)
   */
  setNPCRelationship(
    npcId1: string,
    npcId2: string,
    relationType: NPCRelationType,
    affinity: number = 50,
  ): void {
    const key = this.makeNPCKey(npcId1, npcId2);
    this.npcRelationships.set(key, {
      npcId1,
      npcId2,
      relationType,
      affinity: Math.max(0, Math.min(100, affinity)),
    });
  }

  /**
   * 获取 NPC 之间的关系
   * @param npcId1 - NPC 1 ID
   * @param npcId2 - NPC 2 ID
   * @returns NPC 间关系，若不存在返回 null
   */
  getNPCRelationship(npcId1: string, npcId2: string): NPCRelationship | null {
    const key = this.makeNPCKey(npcId1, npcId2);
    return this.npcRelationships.get(key) ?? null;
  }

  /**
   * 获取 NPC 的所有关系
   * @param npcId - NPC 实例 ID
   * @returns 该 NPC 的所有关系列表
   */
  getNPCAllRelationships(npcId: string): NPCRelationship[] {
    const result: NPCRelationship[] = [];
    for (const rel of this.npcRelationships.values()) {
      if (rel.npcId1 === npcId || rel.npcId2 === npcId) {
        result.push(rel);
      }
    }
    return result;
  }

  /**
   * 获取 NPC 的盟友列表
   * @param npcId - NPC 实例 ID
   * @returns 盟友 NPC ID 列表
   */
  getAllies(npcId: string): string[] {
    const allies: string[] = [];
    for (const rel of this.npcRelationships.values()) {
      if (rel.relationType === NPCRelationType.ALLY) {
        if (rel.npcId1 === npcId) allies.push(rel.npcId2);
        else if (rel.npcId2 === npcId) allies.push(rel.npcId1);
      }
    }
    return allies;
  }

  /**
   * 获取 NPC 的对手列表
   * @param npcId - NPC 实例 ID
   * @returns 对手 NPC ID 列表
   */
  getRivals(npcId: string): string[] {
    const rivals: string[] = [];
    for (const rel of this.npcRelationships.values()) {
      if (rel.relationType === NPCRelationType.RIVAL) {
        if (rel.npcId1 === npcId) rivals.push(rel.npcId2);
        else if (rel.npcId2 === npcId) rivals.push(rel.npcId1);
      }
    }
    return rivals;
  }

  // -----------------------------------------------------------------------
  // 查询
  // -----------------------------------------------------------------------

  /**
   * 获取所有玩家好感度数据
   */
  getAllPlayerRelationships(): PlayerRelationship[] {
    return Array.from(this.playerRelationships.values());
  }

  /**
   * 获取指定等级的所有 NPC
   * @param level - 好感度等级
   */
  getNPCsByLevel(level: RelationshipLevel): string[] {
    const result: string[] = [];
    for (const rel of this.playerRelationships.values()) {
      if (rel.level === level) {
        result.push(rel.npcId);
      }
    }
    return result;
  }

  /**
   * 获取好感度变动日志
   * @param npcId - NPC 实例 ID
   * @returns 变动日志列表
   */
  getChangeLog(npcId: string): RelationshipChangeLog[] {
    const rel = this.playerRelationships.get(npcId);
    return rel?.changeLog ?? [];
  }

  // -----------------------------------------------------------------------
  // 序列化
  // -----------------------------------------------------------------------

  /** 序列化所有好感度数据 */
  serialize(): object {
    return {
      playerRelationships: Array.from(this.playerRelationships.entries()).map(
        ([id, rel]) => [id, { ...rel, changeLog: rel.changeLog.slice(-50) }],
      ),
      npcRelationships: Array.from(this.npcRelationships.entries()),
    };
  }

  /** 反序列化恢复好感度数据 */
  deserialize(data: Record<string, unknown>): void {
    const d = data as {
      playerRelationships: [string, PlayerRelationship][];
      npcRelationships: [string, NPCRelationship][];
    };

    this.playerRelationships.clear();
    for (const [id, rel] of d.playerRelationships ?? []) {
      this.playerRelationships.set(id, rel);
    }

    this.npcRelationships.clear();
    for (const [key, rel] of d.npcRelationships ?? []) {
      this.npcRelationships.set(key, rel);
    }
  }

  // -----------------------------------------------------------------------
  // 内部辅助
  // -----------------------------------------------------------------------

  /** 将好感度点数转换为等级 */
  private pointsToLevel(points: number): RelationshipLevel {
    for (const t of LEVEL_THRESHOLDS) {
      if (points >= t.min && points <= t.max) {
        return t.level;
      }
    }
    return RelationshipLevel.STRANGER;
  }

  /** 生成 NPC 关系 Map 的 key（保证顺序一致） */
  private makeNPCKey(id1: string, id2: string): string {
    return id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
  }
}
