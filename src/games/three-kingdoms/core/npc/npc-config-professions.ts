/**
 * 核心层 — NPC 职业与基础配置
 *
 * 包含 NPC 职业定义、好感度工具函数、默认 NPC 数据、地图展示配置。
 *
 * @module core/npc/npc-config-professions
 */

import type {
  NPCProfession,
  NPCProfessionDef,
  NPCData,
  AffinityLevel,
  NPCClusterConfig,
  CrowdManagementConfig,
} from './npc.types';
import { AFFINITY_THRESHOLDS } from './npc.types';
import type { RegionId, GridPosition } from '../map';
import { REGION_IDS } from '../map';

// ─────────────────────────────────────────────
// 1. 职业定义（#9）
// ─────────────────────────────────────────────

/** NPC 职业定义表 */
export const NPC_PROFESSION_DEFS: Record<NPCProfession, NPCProfessionDef> = {
  merchant: {
    profession: 'merchant',
    label: '商人',
    description: '行走天下的商贾，善于交易买卖',
    icon: '🏪',
    defaultAffinity: 30,
    affinityDecayRate: -0.5,
    interactionType: 'trade',
  },
  strategist: {
    profession: 'strategist',
    label: '谋士',
    description: '运筹帷幄的智者，提供情报与计策',
    icon: '📜',
    defaultAffinity: 25,
    affinityDecayRate: -0.3,
    interactionType: 'intel',
  },
  warrior: {
    profession: 'warrior',
    label: '武将',
    description: '身经百战的猛将，可进行比武挑战',
    icon: '⚔️',
    defaultAffinity: 20,
    affinityDecayRate: -0.2,
    interactionType: 'challenge',
  },
  artisan: {
    profession: 'artisan',
    label: '工匠',
    description: '技艺精湛的匠人，可锻造升级装备',
    icon: '🔨',
    defaultAffinity: 30,
    affinityDecayRate: -0.4,
    interactionType: 'craft',
  },
  traveler: {
    profession: 'traveler',
    label: '旅人',
    description: '云游四方的行者，讲述奇闻轶事',
    icon: '🗺️',
    defaultAffinity: 35,
    affinityDecayRate: -0.1,
    interactionType: 'story',
  },
} as const;

/** 职业列表 */
export const NPC_PROFESSIONS: readonly NPCProfession[] = [
  'merchant', 'strategist', 'warrior', 'artisan', 'traveler',
] as const;

/** 职业中文名映射 */
export const NPC_PROFESSION_LABELS: Record<NPCProfession, string> = {
  merchant: '商人',
  strategist: '谋士',
  warrior: '武将',
  artisan: '工匠',
  traveler: '旅人',
} as const;

// ─────────────────────────────────────────────
// 2. 好感度工具函数（#10, #17）
// ─────────────────────────────────────────────

/** 根据好感度值获取等级 */
export function getAffinityLevel(affinity: number): AffinityLevel {
  const clamped = Math.max(0, Math.min(100, affinity));
  if (clamped >= AFFINITY_THRESHOLDS.bonded.min) return 'bonded';
  if (clamped >= AFFINITY_THRESHOLDS.trusted.min) return 'trusted';
  if (clamped >= AFFINITY_THRESHOLDS.friendly.min) return 'friendly';
  if (clamped >= AFFINITY_THRESHOLDS.neutral.min) return 'neutral';
  return 'hostile';
}

/** 获取当前等级内的进度 (0-1) */
export function getAffinityProgress(affinity: number): number {
  const clamped = Math.max(0, Math.min(100, affinity));
  const level = getAffinityLevel(clamped);
  const threshold = AFFINITY_THRESHOLDS[level];
  const range = threshold.max - threshold.min;
  if (range === 0) return 1;
  return (clamped - threshold.min) / range;
}

/** 将好感度限制在 0-100 范围 */
export function clampAffinity(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** 好感度等级中文名 */
export const AFFINITY_LEVEL_LABELS: Record<AffinityLevel, string> = {
  hostile: '敌意',
  neutral: '中立',
  friendly: '友善',
  trusted: '信赖',
  bonded: '羁绊',
} as const;

// ─────────────────────────────────────────────
// 3. 默认 NPC 数据（#10）
// ─────────────────────────────────────────────

/** 默认 NPC 列表 */
export const DEFAULT_NPCS: NPCData[] = [
  {
    id: 'npc-merchant-01',
    name: '甄商',
    profession: 'merchant',
    affinity: 30,
    position: { x: 32, y: 10 },
    region: 'central_plains',
    visible: true,
    dialogId: 'dialog-merchant-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-strategist-01',
    name: '荀策',
    profession: 'strategist',
    affinity: 25,
    position: { x: 35, y: 8 },
    region: 'central_plains',
    visible: true,
    dialogId: 'dialog-strategist-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-warrior-01',
    name: '赵锋',
    profession: 'warrior',
    affinity: 20,
    position: { x: 40, y: 15 },
    region: 'central_plains',
    visible: true,
    dialogId: 'dialog-warrior-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-artisan-01',
    name: '鲁匠',
    profession: 'artisan',
    affinity: 30,
    position: { x: 20, y: 25 },
    region: 'western_shu',
    visible: true,
    dialogId: 'dialog-artisan-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-traveler-01',
    name: '司马行',
    profession: 'traveler',
    affinity: 35,
    position: { x: 45, y: 28 },
    region: 'jiangnan',
    visible: true,
    dialogId: 'dialog-traveler-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-merchant-02',
    name: '糜商',
    profession: 'merchant',
    affinity: 40,
    position: { x: 50, y: 32 },
    region: 'jiangnan',
    visible: true,
    dialogId: 'dialog-merchant-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-strategist-02',
    name: '庞策',
    profession: 'strategist',
    affinity: 45,
    position: { x: 15, y: 28 },
    region: 'western_shu',
    visible: true,
    dialogId: 'dialog-strategist-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-warrior-02',
    name: '黄武',
    profession: 'warrior',
    affinity: 50,
    position: { x: 38, y: 12 },
    region: 'central_plains',
    visible: true,
    dialogId: 'dialog-warrior-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-artisan-02',
    name: '陈匠',
    profession: 'artisan',
    affinity: 40,
    position: { x: 46, y: 30 },
    region: 'jiangnan',
    visible: true,
    dialogId: 'dialog-artisan-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-traveler-02',
    name: '孙游',
    profession: 'traveler',
    affinity: 35,
    position: { x: 14, y: 32 },
    region: 'western_shu',
    visible: true,
    dialogId: 'dialog-traveler-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
] as const;

// ─────────────────────────────────────────────
// 4. 地图展示配置（#11）
// ─────────────────────────────────────────────

/** 默认聚合配置 */
export const DEFAULT_CLUSTER_CONFIG: NPCClusterConfig = {
  clusterDistance: 48,
  maxDisplayPerRegion: 5,
  minClusterSize: 2,
  enabled: true,
} as const;

/** 默认拥挤管理配置 */
export const DEFAULT_CROWD_CONFIG: CrowdManagementConfig = {
  maxNPCsPerTile: 3,
  minSpacing: 1,
  jitterRadius: 12,
} as const;
