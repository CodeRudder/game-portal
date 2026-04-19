/**
 * 三国霸业 — NPC 活动系统
 *
 * 管理地图上所有 NPC 的行为 AI，包括：
 * - 根据时间表在瓦片间移动
 * - 状态切换（空闲→移动→执行活动）
 * - 简单寻路（A* 简化版，避开水域）
 * - 活动动画状态管理
 *
 * NPC 类型与行为：
 * - farmer（农民）：在农田附近耕作，移动+停留
 * - soldier（士兵）：在城池附近巡逻，路径循环
 * - merchant（商人）：在城镇间移动交易
 * - scholar（学者）：在书院附近活动
 * - scout（斥候）：在边境探索
 *
 * @module games/three-kingdoms/NPCSystem
 */

import type { MapNPC, MapTile } from './MapGenerator';

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** NPC 移动状态 */
export type NPCMovementState = 'idle' | 'moving' | 'performing';

/** NPC 方向（用于动画朝向） */
export type NPCDirection = 'up' | 'down' | 'left' | 'right';

/** NPC 运行时状态（扩展 MapNPC，添加 AI 状态） */
export interface NPCRuntimeState {
  /** 原始 NPC 数据 */
  npc: MapNPC;
  /** 当前移动状态 */
  movementState: NPCMovementState;
  /** 朝向 */
  direction: NPCDirection;
  /** 像素级 X 位置（用于平滑移动） */
  pixelX: number;
  /** 像素级 Y 位置（用于平滑移动） */
  pixelY: number;
  /** 当前目标 X 瓦片坐标 */
  targetX: number;
  /** 当前目标 Y 瓦片坐标 */
  targetY: number;
  /** 移动进度 (0~1) */
  moveProgress: number;
  /** 当前时间表索引 */
  scheduleIndex: number;
  /** 等待计时器（秒） */
  waitTimer: number;
}

/** NPC 系统配置 */
export interface NPCSystemConfig {
  /** 瓦片像素尺寸（用于计算像素位置） */
  tileSize: number;
  /** NPC 移动速度（瓦片/秒） */
  moveSpeed: number;
  /** 活动停留时间（秒） */
  activityDuration: number;
}

// ═══════════════════════════════════════════════════════════════
// 默认配置
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: NPCSystemConfig = {
  tileSize: 64,
  moveSpeed: 2.0,    // 每秒移动 2 个瓦片
  activityDuration: 3.0, // 每次活动停留 3 秒
};

// ═══════════════════════════════════════════════════════════════
// NPC 系统
// ═══════════════════════════════════════════════════════════════

/**
 * NPC 活动系统
 *
 * 管理所有 NPC 的生命周期：
 * 1. 初始化：将 MapNPC 转换为运行时状态
 * 2. 更新：根据时间表驱动移动和活动
 * 3. 寻路：在瓦片间寻找可通行路径
 */
export class NPCSystem {
  private config: NPCSystemConfig;
  private states: Map<string, NPCRuntimeState> = new Map();
  private tiles: MapTile[][] = [];
  private mapWidth = 0;
  private mapHeight = 0;
  /** 游戏内时间（小时，0~24 循环） */
  private gameHour = 8;

  constructor(config?: Partial<NPCSystemConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── 初始化 ─────────────────────────────────────────────

  /**
   * 初始化 NPC 系统
   *
   * @param npcs - 地图生成器产出的 NPC 列表
   * @param tiles - 瓦片数据（用于寻路）
   * @param mapWidth - 地图宽度
   * @param mapHeight - 地图高度
   */
  init(npcs: MapNPC[], tiles: MapTile[][], mapWidth: number, mapHeight: number): void {
    this.tiles = tiles;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.states.clear();

    for (const npc of npcs) {
      const state: NPCRuntimeState = {
        npc,
        movementState: 'idle',
        direction: 'down',
        pixelX: npc.tileX * this.config.tileSize,
        pixelY: npc.tileY * this.config.tileSize,
        targetX: npc.tileX,
        targetY: npc.tileY,
        moveProgress: 0,
        scheduleIndex: 0,
        waitTimer: 0,
      };
      this.states.set(npc.id, state);
    }
  }

  // ─── 更新 ───────────────────────────────────────────────

  /**
   * 每帧更新所有 NPC 状态
   *
   * @param dt - 帧间隔时间（毫秒）
   * @param gameHour - 当前游戏时间（小时，0~24）
   */
  update(dt: number, gameHour?: number): void {
    const sec = dt / 1000;

    // 更新游戏时间
    if (gameHour !== undefined) {
      this.gameHour = gameHour;
    }

    for (const state of this.states.values()) {
      this.updateNPC(state, sec);
    }
  }

  /**
   * 更新单个 NPC
   *
   * 状态机：
   * idle → 检查时间表 → moving → performing → idle
   */
  private updateNPC(state: NPCRuntimeState, sec: number): void {
    // 检查时间表是否需要切换目标
    this.checkSchedule(state);

    switch (state.movementState) {
      case 'idle':
        this.updateIdle(state, sec);
        break;
      case 'moving':
        this.updateMoving(state, sec);
        break;
      case 'performing':
        this.updatePerforming(state, sec);
        break;
    }
  }

  /**
   * 检查时间表，如果当前时间超过了下一个时间点则切换目标
   */
  private checkSchedule(state: NPCRuntimeState): void {
    const schedule = state.npc.schedule;
    if (!schedule.length) return;

    // 找到当前时间对应的时间表索引
    let bestIdx = 0;
    for (let i = 0; i < schedule.length; i++) {
      if (this.gameHour >= schedule[i].hour) {
        bestIdx = i;
      }
    }

    // 如果时间表索引变化，设置新目标
    if (bestIdx !== state.scheduleIndex) {
      state.scheduleIndex = bestIdx;
      const entry = schedule[bestIdx];
      state.targetX = entry.targetX;
      state.targetY = entry.targetY;

      // 如果不在目标位置，开始移动
      if (state.npc.tileX !== state.targetX || state.npc.tileY !== state.targetY) {
        state.movementState = 'moving';
        state.moveProgress = 0;
      }
    }
  }

  /**
   * 空闲状态更新
   *
   * 等待一段时间后检查是否需要移动到下一个目标。
   */
  private updateIdle(state: NPCRuntimeState, sec: number): void {
    state.waitTimer += sec;

    // 空闲一段时间后开始移动到下一个时间点
    if (state.waitTimer >= this.config.activityDuration) {
      state.waitTimer = 0;

      // 检查是否需要移动
      if (state.npc.tileX !== state.targetX || state.npc.tileY !== state.targetY) {
        state.movementState = 'moving';
        state.moveProgress = 0;
      }
    }
  }

  /**
   * 移动状态更新
   *
   * 在瓦片间平滑移动，到达目标后切换到执行活动状态。
   */
  private updateMoving(state: NPCRuntimeState, sec: number): void {
    const speed = this.config.moveSpeed;
    state.moveProgress += speed * sec;

    // 插值计算像素位置
    const fromX = state.npc.tileX * this.config.tileSize;
    const fromY = state.npc.tileY * this.config.tileSize;
    const toX = state.targetX * this.config.tileSize;
    const toY = state.targetY * this.config.tileSize;

    const t = Math.min(1, state.moveProgress);
    state.pixelX = fromX + (toX - fromX) * t;
    state.pixelY = fromY + (toY - fromY) * t;

    // 更新朝向
    if (toX > fromX) state.direction = 'right';
    else if (toX < fromX) state.direction = 'left';
    if (toY > fromY) state.direction = 'down';
    else if (toY < fromY) state.direction = 'up';

    // 到达目标
    if (state.moveProgress >= 1) {
      state.npc.tileX = state.targetX;
      state.npc.tileY = state.targetY;
      state.pixelX = state.npc.tileX * this.config.tileSize;
      state.pixelY = state.npc.tileY * this.config.tileSize;
      state.moveProgress = 0;
      state.movementState = 'performing';
      state.waitTimer = 0;
    }
  }

  /**
   * 执行活动状态更新
   *
   * 模拟 NPC 在目标位置执行活动（耕作、巡逻等），
   * 一段时间后回到空闲状态。
   */
  private updatePerforming(state: NPCRuntimeState, sec: number): void {
    state.waitTimer += sec;

    if (state.waitTimer >= this.config.activityDuration) {
      state.waitTimer = 0;
      state.movementState = 'idle';

      // 巡逻型 NPC：移动到巡逻路径的下一个点
      if (state.npc.type === 'soldier') {
        const nextIdx = (state.scheduleIndex + 1) % state.npc.schedule.length;
        const nextTarget = state.npc.schedule[nextIdx];
        if (nextTarget) {
          state.targetX = nextTarget.targetX;
          state.targetY = nextTarget.targetY;
        }
      }

      // 斥候型 NPC：随机探索附近瓦片
      if (state.npc.type === 'scout') {
        const wander = this.findWanderTarget(state.npc.tileX, state.npc.tileY, 3);
        if (wander) {
          state.targetX = wander.x;
          state.targetY = wander.y;
        }
      }
    }
  }

  // ─── 公共查询接口 ───────────────────────────────────────

  /**
   * 获取所有 NPC 的运行时状态
   */
  getAllStates(): NPCRuntimeState[] {
    return Array.from(this.states.values());
  }

  /**
   * 获取指定 NPC 的运行时状态
   */
  getState(npcId: string): NPCRuntimeState | undefined {
    return this.states.get(npcId);
  }

  /**
   * 获取指定瓦片上的所有 NPC
   */
  getNPCsAtTile(x: number, y: number): NPCRuntimeState[] {
    const result: NPCRuntimeState[] = [];
    for (const state of this.states.values()) {
      if (state.npc.tileX === x && state.npc.tileY === y) {
        result.push(state);
      }
    }
    return result;
  }

  /**
   * 获取当前游戏时间
   */
  getGameHour(): number {
    return this.gameHour;
  }

  /**
   * 设置游戏时间（用于外部时间控制）
   */
  setGameHour(hour: number): void {
    this.gameHour = hour % 24;
  }

  // ─── 寻路 ───────────────────────────────────────────────

  /**
   * 在附近区域随机寻找一个可通行的瓦片作为漫游目标
   *
   * @param cx - 起点 X
   * @param cy - 起点 Y
   * @param radius - 搜索半径
   * @returns 可通行瓦片坐标，或 null
   */
  private findWanderTarget(cx: number, cy: number, radius: number): { x: number; y: number } | null {
    const candidates: { x: number; y: number }[] = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > radius) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= this.mapWidth || ny < 0 || ny >= this.mapHeight) continue;
        const tile = this.tiles[ny]?.[nx];
        if (tile && tile.terrain !== 'water' && tile.terrain !== 'mountain') {
          candidates.push({ x: nx, y: ny });
        }
      }
    }

    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}
