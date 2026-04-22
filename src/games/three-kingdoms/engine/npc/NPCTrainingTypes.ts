/**
 * 引擎层 — NPC 切磋/结盟/离线行为类型定义
 *
 * 从 NPCTrainingSystem 中提取的类型和常量。
 *
 * @module engine/npc/NPCTrainingTypes
 */

import type { NPCProfession } from '../../core/npc';

// ─────────────────────────────────────────────
// 切磋系统类型
// ─────────────────────────────────────────────

/** 切磋结果 */
export type TrainingOutcome = 'win' | 'lose' | 'draw';

/** 切磋奖励 */
export interface TrainingReward {
  /** 获得经验 */
  experience: number;
  /** 获得道具列表 */
  items: Array<{ itemId: string; count: number }>;
  /** 好感度变化 */
  affinityChange: number;
}

/** 切磋结果数据 */
export interface TrainingResult {
  /** NPC 实例 ID */
  npcId: string;
  /** 结果 */
  outcome: TrainingOutcome;
  /** 奖励（胜利时有效） */
  rewards: TrainingReward | null;
  /** 提示信息 */
  message: string;
}

/** 切磋记录 */
export interface TrainingRecord {
  /** NPC 实例 ID */
  npcId: string;
  /** 结果 */
  outcome: TrainingOutcome;
  /** 获得经验 */
  experience: number;
  /** 时间戳 */
  timestamp: number;
}

// ─────────────────────────────────────────────
// 结盟系统类型
// ─────────────────────────────────────────────

/** 结盟加成类型 */
export type AllianceBonusType = 'attack' | 'defense' | 'resource' | 'recruit' | 'tech';

/** 结盟加成 */
export interface AllianceBonus {
  /** 加成类型 */
  type: AllianceBonusType;
  /** 加成数值 */
  value: number;
  /** 描述 */
  description: string;
}

/** 结盟数据 */
export interface AllianceData {
  /** NPC 实例 ID */
  npcId: string;
  /** NPC 定义 ID */
  defId: string;
  /** 结盟时间戳 */
  alliedAt: number;
  /** 加成列表 */
  bonuses: AllianceBonus[];
}

// ─────────────────────────────────────────────
// 离线行为类型
// ─────────────────────────────────────────────

/** 离线行为类型 */
export type OfflineActionType = 'trade' | 'patrol' | 'advise' | 'gather' | 'social';

/** 单条离线行为记录 */
export interface OfflineAction {
  /** NPC 实例 ID */
  npcId: string;
  /** NPC 名称 */
  npcName: string;
  /** 行为类型 */
  actionType: OfflineActionType;
  /** 描述文本 */
  description: string;
  /** 资源变化 */
  resourceChanges?: Record<string, number>;
  /** 好感度变化 */
  affinityChange?: number;
  /** 发生时间戳 */
  timestamp: number;
}

/** 离线行为摘要 */
export interface OfflineSummary {
  /** 离线时长（秒） */
  offlineDuration: number;
  /** 行为列表 */
  actions: OfflineAction[];
  /** 总资源变化 */
  totalResourceChanges: Record<string, number>;
  /** 总好感度变化（npcId → 变化值） */
  totalAffinityChanges: Record<string, number>;
}

// ─────────────────────────────────────────────
// 对话历史类型
// ─────────────────────────────────────────────

/** 对话历史记录 */
export interface DialogueHistoryEntry {
  /** NPC 实例 ID */
  npcId: string;
  /** NPC 名称 */
  npcName: string;
  /** 对话内容摘要 */
  summary: string;
  /** 对话行数 */
  lineCount: number;
  /** 对话时间戳 */
  timestamp: number;
  /** 玩家选择（如有） */
  playerChoice?: string;
}

// ─────────────────────────────────────────────
// 存档数据
// ─────────────────────────────────────────────

/** NPC高级交互系统存档 */
export interface NPCInteractionSaveData {
  /** 存档版本 */
  version: number;
  /** 切磋记录 */
  trainingRecords: TrainingRecord[];
  /** 结盟数据 */
  alliances: Array<{
    npcId: string;
    defId: string;
    alliedAt: number;
    bonuses: AllianceBonus[];
  }>;
  /** 离线摘要 */
  offlineSummary: OfflineSummary | null;
  /** 对话历史 */
  dialogueHistory: DialogueHistoryEntry[];
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 存档版本号 */
export const TRAINING_SAVE_VERSION = 1;

/** 切磋冷却时间（秒） */
export const TRAINING_COOLDOWN = 60;

/** 结盟所需好感度 */
export const ALLIANCE_REQUIRED_AFFINITY = 80;

/** 切磋经验奖励范围 */
export const TRAINING_EXP_RANGE = { min: 20, max: 50 };

/** 离线行为间隔（秒） */
export const OFFLINE_ACTION_INTERVAL = 300;

/** 最大离线行为条数 */
export const MAX_OFFLINE_ACTIONS = 50;

/** 对话历史最大条数 */
export const MAX_DIALOGUE_HISTORY = 200;

/** 对话历史裁剪后保留条数 */
export const DIALOGUE_TRIM_TO = 100;

/** 切磋记录最大条数 */
export const MAX_TRAINING_RECORDS = 50;

/** 对话历史序列化保留条数 */
export const DIALOGUE_SERIALIZE_LIMIT = 100;

/** 各职业离线行为偏好 */
export const PROFESSION_ACTION_MAP: Record<string, OfflineActionType[]> = {
  merchant: ['trade', 'gather'],
  warrior: ['patrol', 'gather'],
  strategist: ['advise', 'social'],
  artisan: ['gather', 'trade'],
  traveler: ['social', 'gather'],
};

/** 离线行为描述模板 */
export const OFFLINE_DESCRIPTIONS: Record<OfflineActionType, (name: string) => string> = {
  trade: (name) => `${name}在离线期间完成了一笔交易`,
  patrol: (name) => `${name}在离线期间巡逻发现了资源点`,
  advise: (name) => `${name}在离线期间提供了战略建议`,
  gather: (name) => `${name}在离线期间收集了一些资源`,
  social: (name) => `${name}在离线期间与其他NPC进行了交流`,
};

/** 离线行为资源变化模板 */
export const OFFLINE_RESOURCE_MAP: Record<OfflineActionType, () => Record<string, number>> = {
  trade: () => ({ gold: Math.floor(Math.random() * 50) + 10 }),
  patrol: () => ({}),
  advise: () => ({}),
  gather: () => ({ grain: Math.floor(Math.random() * 30) + 10 }),
  social: () => ({}),
};

/** 切磋掉落物品表 */
export const TRAINING_DROP_TABLE = ['item_exp_scroll', 'item_hp_potion', 'item_gold_pouch'];

/** 切磋掉落概率 */
export const TRAINING_DROP_CHANCE = 0.3;

/** 切磋结果消息 */
export const TRAINING_MESSAGES: Record<TrainingOutcome, string> = {
  win: '切磋胜利！获得了经验和道具奖励',
  lose: '切磋失败，下次再来挑战吧',
  draw: '不分胜负，双方势均力敌',
};

/** 结盟加成模板（按职业） */
export const ALLIANCE_BONUSES_BY_PROFESSION: Record<NPCProfession, AllianceBonus[]> = {
  merchant: [
    { type: 'resource', value: 10, description: '商人结盟：资源产出+10%' },
    { type: 'recruit', value: 5, description: '商人结盟：招募折扣+5%' },
  ],
  strategist: [
    { type: 'tech', value: 10, description: '谋士结盟：科技速度+10%' },
    { type: 'defense', value: 5, description: '谋士结盟：防御+5%' },
  ],
  warrior: [
    { type: 'attack', value: 10, description: '武将结盟：攻击+10%' },
    { type: 'defense', value: 5, description: '武将结盟：防御+5%' },
  ],
  artisan: [
    { type: 'tech', value: 8, description: '工匠结盟：锻造效率+8%' },
    { type: 'resource', value: 5, description: '工匠结盟：资源产出+5%' },
  ],
  traveler: [
    { type: 'recruit', value: 8, description: '旅人结盟：探索奖励+8%' },
    { type: 'resource', value: 5, description: '旅人结盟：资源产出+5%' },
  ],
};
