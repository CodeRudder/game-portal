/**
 * 核心层 — NPC 巡逻路径类型定义
 *
 * 定义 v7.0 NPC 巡逻系统的核心类型：
 *   - 巡逻路径（路径点列表）
 *   - 巡逻状态（移动方向、当前进度）
 *   - 刷新规则（定时刷新、同屏数量控制）
 *
 * @module core/npc/patrol.types
 */

import type { NPCId, NPCProfession } from './npc.types';
import type { GridPosition, RegionId } from '../map';

// ─────────────────────────────────────────────
// 1. 巡逻路径类型
// ─────────────────────────────────────────────

/** 巡逻路径ID */
export type PatrolPathId = string;

/** 巡逻路径定义 */
export interface PatrolPath {
  /** 路径唯一ID */
  id: PatrolPathId;
  /** 路径名称 */
  name: string;
  /** 路径点列表（至少2个点） */
  waypoints: GridPosition[];
  /** 所属区域 */
  region: RegionId;
  /** 移动速度（格/秒） */
  speed: number;
}

/** NPC 巡逻状态 */
export interface NPCPatrolState {
  /** NPC ID */
  npcId: NPCId;
  /** 关联的巡逻路径ID */
  patrolPathId: PatrolPathId;
  /** 当前路径点索引 */
  currentWaypointIndex: number;
  /** 移动方向：1=正向，-1=反向（折返） */
  direction: 1 | -1;
  /** 当前精确位置（浮点坐标，用于平滑移动） */
  exactPosition: { x: number; y: number };
  /** 是否正在巡逻 */
  isPatrolling: boolean;
  /** 暂停剩余时间（秒），0表示未暂停 */
  pauseTimer: number;
}

/** 巡逻路径分配 */
export interface PatrolAssignment {
  /** NPC ID */
  npcId: NPCId;
  /** 分配的巡逻路径ID */
  patrolPathId: PatrolPathId;
  /** 初始路径点索引 */
  startWaypointIndex: number;
  /** 初始方向 */
  startDirection: 1 | -1;
}

// ─────────────────────────────────────────────
// 2. NPC 刷新规则类型
// ─────────────────────────────────────────────

/** NPC 刷新模板 */
export interface NPCSpawnTemplate {
  /** 模板ID */
  id: string;
  /** NPC 名称 */
  name: string;
  /** NPC 职业 */
  profession: NPCProfession;
  /** 刷新区域 */
  region: RegionId;
  /** 关联的巡逻路径ID */
  patrolPathId: PatrolPathId;
  /** 初始好感度 */
  initialAffinity: number;
  /** 刷新权重（影响被选中概率） */
  weight: number;
}

/** NPC 刷新配置 */
export interface NPCSpawnConfig {
  /** 刷新间隔（秒） */
  spawnInterval: number;
  /** 同屏最大NPC数量 */
  maxNPCCount: number;
  /** 每个区域最大NPC数量 */
  maxNPCPerRegion: number;
  /** NPC存活时间（秒），0表示永久 */
  npcLifetime: number;
  /** 是否启用自动刷新 */
  autoSpawnEnabled: boolean;
}

/** NPC 刷新记录 */
export interface NPCSpawnRecord {
  /** 刷新出的NPC ID */
  npcId: NPCId;
  /** 使用的模板ID */
  templateId: string;
  /** 刷新时间（游戏时间戳） */
  spawnTime: number;
  /** 刷新位置 */
  spawnPosition: GridPosition;
  /** 预计消失时间（0表示永久） */
  expireTime: number;
}

/** 刷新结果 */
export interface SpawnResult {
  /** 是否成功刷新 */
  success: boolean;
  /** 新创建的NPC ID（失败时为null） */
  npcId: NPCId | null;
  /** 失败原因 */
  reason?: string;
}

/** 巡逻系统状态 */
export interface PatrolSystemState {
  /** 所有巡逻路径 */
  patrolPaths: PatrolPath[];
  /** NPC巡逻状态映射 */
  patrolStates: Map<NPCId, NPCPatrolState>;
  /** 刷新记录 */
  spawnRecords: NPCSpawnRecord[];
  /** 刷新计时器 */
  spawnTimer: number;
}

/** 巡逻系统存档数据 */
export interface PatrolSaveData {
  /** 巡逻状态列表 */
  patrolStates: Array<{
    npcId: NPCId;
    patrolPathId: PatrolPathId;
    currentWaypointIndex: number;
    direction: 1 | -1;
    exactPosition: { x: number; y: number };
    isPatrolling: boolean;
    pauseTimer: number;
  }>;
  /** 刷新记录 */
  spawnRecords: NPCSpawnRecord[];
  /** 刷新计时器 */
  spawnTimer: number;
  /** 版本号 */
  version: number;
}
