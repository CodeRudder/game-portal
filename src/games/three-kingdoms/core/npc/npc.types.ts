/**
 * 核心层 — NPC 类型定义
 *
 * 定义 NPC 系统的所有核心类型：NPC类型、属性、对话树、地图展示规则。
 * 零 engine/ 依赖，所有类型在本文件中定义。
 *
 * @module core/npc/npc.types
 */

import type { GridPosition, RegionId } from '../map';

// ─────────────────────────────────────────────
// 1. NPC 类型定义（#9）
// ─────────────────────────────────────────────

/** NPC 职业类型（5种） */
export type NPCProfession =
  | 'merchant'   // 商人 — 交易/买卖
  | 'strategist' // 谋士 — 情报/计策
  | 'warrior'    // 武将 — 挑战/比武
  | 'artisan'    // 工匠 — 锻造/升级装备
  | 'traveler';  // 旅人 — 故事/线索

/** NPC 职业配置 */
export interface NPCProfessionDef {
  /** 职业类型 */
  profession: NPCProfession;
  /** 中文名 */
  label: string;
  /** 描述 */
  description: string;
  /** 地图图标 */
  icon: string;
  /** 默认好感度 */
  defaultAffinity: number;
  /** 好感度变化速率（每回合） */
  affinityDecayRate: number;
  /** 可交互类型 */
  interactionType: NPCInteractionType;
}

/** NPC 交互类型 */
export type NPCInteractionType =
  | 'trade'      // 商人：交易
  | 'intel'      // 谋士：情报
  | 'challenge'  // 武将：挑战
  | 'craft'      // 工匠：锻造
  | 'story';     // 旅人：故事

// ─────────────────────────────────────────────
// 2. NPC 属性（#10）
// ─────────────────────────────────────────────

/** NPC 唯一标识 */
export type NPCId = string;

/** NPC 属性数据 */
export interface NPCData {
  /** 唯一ID */
  id: NPCId;
  /** 名字 */
  name: string;
  /** 职业 */
  profession: NPCProfession;
  /** 好感度 (0-100) */
  affinity: number;
  /** 当前位置（地图坐标） */
  position: GridPosition;
  /** 所属区域 */
  region: RegionId;
  /** 是否可见 */
  visible: boolean;
  /** 对话ID（关联到对话树的入口节点） */
  dialogId: string;
  /** 自定义图标（覆盖职业默认图标） */
  customIcon?: string;
  /** 创建时间（游戏回合数） */
  createdAt: number;
  /** 上次交互时间（游戏回合数） */
  lastInteractedAt: number;
}

/** NPC 好感度等级 */
export type AffinityLevel = 'hostile' | 'neutral' | 'friendly' | 'trusted' | 'bonded';

/** 好感度等级边界 */
export const AFFINITY_THRESHOLDS: Record<AffinityLevel, { min: number; max: number }> = {
  hostile:  { min: 0,  max: 19 },
  neutral:  { min: 20, max: 39 },
  friendly: { min: 40, max: 64 },
  trusted:  { min: 65, max: 84 },
  bonded:   { min: 85, max: 100 },
} as const;

// ─────────────────────────────────────────────
// 3. NPC 地图展示规则（#11）
// ─────────────────────────────────────────────

/** NPC 地图展示数据 */
export interface NPCMapDisplay {
  /** NPC ID */
  id: NPCId;
  /** 显示位置（像素坐标，可能经过偏移处理） */
  displayPosition: { x: number; y: number };
  /** 显示图标 */
  icon: string;
  /** 是否聚合显示 */
  isClustered: boolean;
  /** 聚合数量（isClustered=true时有效） */
  clusterCount: number;
  /** 聚合NPC ID列表 */
  clusteredNPCIds: NPCId[];
}

/** NPC 聚合配置 */
export interface NPCClusterConfig {
  /** 聚合距离阈值（像素） */
  clusterDistance: number;
  /** 单区域最大NPC显示数量（超过则聚合） */
  maxDisplayPerRegion: number;
  /** 聚合气泡最小数量 */
  minClusterSize: number;
  /** 是否启用聚合 */
  enabled: boolean;
}

/** NPC 位置分配结果 */
export interface NPCPlacementResult {
  /** 成功分配的NPC列表 */
  placed: NPCId[];
  /** 因拥挤未能放置的NPC列表 */
  unplaced: NPCId[];
  /** 聚合气泡列表 */
  clusters: NPCMapDisplay[];
}

/** 拥挤管理配置 */
export interface CrowdManagementConfig {
  /** 单格最大NPC数量 */
  maxNPCsPerTile: number;
  /** NPC之间最小间距（格子数） */
  minSpacing: number;
  /** 偏移半径（拥挤时随机偏移范围，像素） */
  jitterRadius: number;
}

// ─────────────────────────────────────────────
// 4. NPC 信息弹窗（#14）
// ─────────────────────────────────────────────

/** NPC 信息弹窗数据 */
export interface NPCInfoPopup {
  /** NPC 基本信息 */
  npc: NPCData;
  /** 职业信息 */
  professionDef: NPCProfessionDef;
  /** 好感度等级 */
  affinityLevel: AffinityLevel;
  /** 好感度进度（当前等级内的百分比 0-1） */
  affinityProgress: number;
  /** 可交互操作列表 */
  availableActions: NPCAction[];
  /** 是否可对话 */
  canTalk: boolean;
}

/** NPC 可执行操作 */
export interface NPCAction {
  /** 操作ID */
  id: string;
  /** 操作名称 */
  label: string;
  /** 操作图标 */
  icon: string;
  /** 是否可用 */
  enabled: boolean;
  /** 不可用原因 */
  disabledReason?: string;
  /** 所需最低好感度 */
  requiredAffinity: number;
}

// ─────────────────────────────────────────────
// 5. NPC 对话系统（#15）
// ─────────────────────────────────────────────

/** 对话节点ID */
export type DialogNodeId = string;

/** 对话选项 */
export interface DialogOption {
  /** 选项ID */
  id: string;
  /** 选项文本 */
  text: string;
  /** 下一节点ID（null表示对话结束） */
  nextNodeId: DialogNodeId | null;
  /** 所需最低好感度（可选，低于此值选项不显示） */
  requiredAffinity?: number;
  /** 所需职业（可选，仅特定职业NPC显示） */
  requiredProfession?: NPCProfession;
  /** 选择后的效果 */
  effects?: DialogEffect[];
  /** 是否为默认选项（无其他可选时显示） */
  isDefault?: boolean;
}

/** 对话效果 */
export interface DialogEffect {
  /** 效果类型 */
  type: 'affinity_change' | 'unlock_item' | 'unlock_info' | 'trigger_event' | 'grant_resource';
  /** 效果值 */
  value: number | string;
  /** 额外参数 */
  params?: Record<string, unknown>;
}

/** 对话节点 */
export interface DialogNode {
  /** 节点ID */
  id: DialogNodeId;
  /** 说话者名字 */
  speaker: string;
  /** 对话文本 */
  text: string;
  /** 可选选项列表 */
  options: DialogOption[];
  /** 自动跳转的下一节点（无选项时使用） */
  autoNextId?: DialogNodeId | null;
  /** 节点触发效果 */
  onEnter?: DialogEffect[];
}

/** 对话树 */
export interface DialogTree {
  /** 对话树ID */
  id: string;
  /** 关联NPC职业 */
  profession: NPCProfession;
  /** 入口节点ID */
  startNodeId: DialogNodeId;
  /** 所有对话节点 */
  nodes: Record<DialogNodeId, DialogNode>;
}

/** 对话会话（运行时状态） */
export interface DialogSession {
  /** 会话ID */
  id: string;
  /** NPC ID */
  npcId: NPCId;
  /** 对话树ID */
  dialogTreeId: string;
  /** 当前节点ID */
  currentNodeId: DialogNodeId;
  /** 对话历史 */
  history: DialogHistoryEntry[];
  /** 是否已结束 */
  ended: boolean;
  /** 累计效果 */
  accumulatedEffects: DialogEffect[];
}

/** 对话历史记录 */
export interface DialogHistoryEntry {
  /** 节点ID */
  nodeId: DialogNodeId;
  /** 说话者 */
  speaker: string;
  /** 文本 */
  text: string;
  /** 选择的选项ID（null表示自动跳转） */
  selectedOptionId: string | null;
  /** 时间戳（回合数） */
  timestamp: number;
}

// ─────────────────────────────────────────────
// 6. NPC 系统状态
// ─────────────────────────────────────────────

/** NPC 系统状态 */
export interface NPCSystemState {
  /** 所有NPC数据 */
  npcs: NPCData[];
  /** 地图展示数据 */
  mapDisplays: NPCMapDisplay[];
  /** 活跃对话会话 */
  activeSessions: DialogSession[];
}

/** NPC 系统存档数据 */
export interface NPCSaveData {
  /** NPC状态列表 */
  npcs: NPCData[];
  /** 版本号 */
  version: number;
}
