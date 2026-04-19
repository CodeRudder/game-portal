/**
 * 三国霸业 — NPC 寻路跟随器
 *
 * 基于 PathFinder（A*）为 NPC 提供瓦片级路径规划，
 * 并在 update 循环中驱动逐帧平滑像素移动。
 *
 * 职责：
 * 1. 调用 PathFinder.findPath 规划瓦片路径
 * 2. 逐路径点插值移动，产出像素坐标 + 瓦片坐标 + 朝向
 * 3. 管理每个 NPC 独立的 MovementState
 *
 * @module games/three-kingdoms/NPCPathFollower
 */

import { PathFinder } from '../../engine/tilemap/PathFinder';
import type { TerrainDef } from '../../engine/tilemap/types';
import { TerrainType } from '../../engine/tilemap/types';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** 路径节点（瓦片坐标） */
export interface PathNode {
  x: number;
  y: number;
}

/** 单个 NPC 的移动运行时状态 */
export interface MovementState {
  /** 规划好的瓦片路径（含起点与终点） */
  path: PathNode[];
  /** 当前正在前往的路径节点索引 */
  currentPathIndex: number;
  /** 当前像素 X */
  pixelX: number;
  /** 当前像素 Y */
  pixelY: number;
  /** 当前路径点的像素 X（插值起点） */
  targetPixelX: number;
  /** 当前路径点的像素 Y（插值起点） */
  targetPixelY: number;
  /** 移动速度（像素 / 秒） */
  speed: number;
  /** 是否正在移动 */
  isMoving: boolean;
}

/** updateMovement 返回的位置快照 */
export interface MovementResult {
  pixelX: number;
  pixelY: number;
  tileX: number;
  tileY: number;
  arrived: boolean;
  direction: 'up' | 'down' | 'left' | 'right' | 'idle';
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 默认瓦片像素尺寸 */
const DEFAULT_TILE_SIZE = 64;

/** 默认移动速度（像素/秒） */
const DEFAULT_SPEED = 128;

// ---------------------------------------------------------------------------
// NPCPathFollower
// ---------------------------------------------------------------------------

/**
 * NPC 寻路跟随器
 *
 * 用法：
 *   const follower = new NPCPathFollower(64);
 *   follower.initMovement('npc1', 3, 5);
 *   const path = follower.planPath('npc1', 3, 5, 10, 12, walkableMap);
 *   // 在游戏循环中
 *   const result = follower.updateMovement('npc1', dt);
 */
export class NPCPathFollower {
  /** A* 寻路器实例 */
  private pathFinder: PathFinder;
  /** 瓦片像素尺寸 */
  private tileSize: number;
  /** 所有 NPC 的移动状态 */
  private movementStates: Map<string, MovementState> = new Map();

  // -----------------------------------------------------------------------
  // 构造
  // -----------------------------------------------------------------------

  constructor(tileSize: number = DEFAULT_TILE_SIZE) {
    this.tileSize = tileSize;

    // 构建基础地形定义表（walkable + movementCost）
    const terrainDefs: TerrainDef[] = [
      { type: TerrainType.GRASS, name: '草地', color: '#4ade80', walkable: true, buildable: true, movementCost: 1 },
      { type: TerrainType.DIRT, name: '泥地', color: '#a3763d', walkable: true, buildable: true, movementCost: 1 },
      { type: TerrainType.ROAD, name: '道路', color: '#d4a574', walkable: true, buildable: false, movementCost: 0.5 },
      { type: TerrainType.BRIDGE, name: '桥梁', color: '#c2a66b', walkable: true, buildable: false, movementCost: 1 },
      { type: TerrainType.SAND, name: '沙地', color: '#fde68a', walkable: true, buildable: false, movementCost: 1.5 },
      { type: TerrainType.FOREST, name: '森林', color: '#166534', walkable: true, buildable: false, movementCost: 2 },
      { type: TerrainType.SNOW, name: '雪地', color: '#e2e8f0', walkable: true, buildable: false, movementCost: 2 },
      { type: TerrainType.WATER, name: '水域', color: '#3b82f6', walkable: false, buildable: false, movementCost: Infinity },
      { type: TerrainType.MOUNTAIN, name: '山脉', color: '#78716c', walkable: false, buildable: false, movementCost: Infinity },
    ];

    this.pathFinder = new PathFinder(terrainDefs);
  }

  // -----------------------------------------------------------------------
  // 路径规划
  // -----------------------------------------------------------------------

  /**
   * 为 NPC 规划从起点到终点的 A* 路径
   *
   * 调用前需先通过 setMapData 设置地图，或传入 walkableMap。
   * 如果同时存在两种地图数据，优先使用 walkableMap。
   *
   * @param npcId - NPC 唯一标识
   * @param fromTileX - 起点瓦片 X
   * @param fromTileY - 起点瓦片 Y
   * @param toTileX - 终点瓦片 X
   * @param toTileY - 终点瓦片 Y
   * @param walkableMap - 可选的二维布尔数组，true 表示可通行
   * @returns 路径节点数组（含起点和终点）；不可达时返回空数组
   */
  planPath(
    npcId: string,
    fromTileX: number,
    fromTileY: number,
    toTileX: number,
    toTileY: number,
    walkableMap?: boolean[][],
  ): PathNode[] {
    // 如果提供了 walkableMap，临时构建地图数据供 PathFinder 使用
    if (walkableMap) {
      const mapData = this.buildMapData(walkableMap);
      this.pathFinder.setMapData(mapData);
    }

    // 调用 A* 寻路
    const rawPath = this.pathFinder.findPath(fromTileX, fromTileY, toTileX, toTileY);

    if (rawPath.length === 0) return [];

    const path: PathNode[] = rawPath.map((p) => ({ x: p.x, y: p.y }));

    // 写入 MovementState
    const state = this.movementStates.get(npcId);
    if (state) {
      state.path = path;
      state.currentPathIndex = 1; // 跳过起点（index 0）
      state.isMoving = true;

      // 设置第一个路径点的像素目标
      if (path.length > 1) {
        state.targetPixelX = path[1].x * this.tileSize;
        state.targetPixelY = path[1].y * this.tileSize;
      }
    }

    return path;
  }

  // -----------------------------------------------------------------------
  // 移动状态管理
  // -----------------------------------------------------------------------

  /**
   * 初始化 NPC 移动状态
   *
   * @param npcId - NPC 唯一标识
   * @param tileX - 初始瓦片 X
   * @param tileY - 初始瓦片 Y
   * @param speed - 可选初始速度（像素/秒）
   */
  initMovement(npcId: string, tileX: number, tileY: number, speed: number = DEFAULT_SPEED): void {
    this.movementStates.set(npcId, {
      path: [{ x: tileX, y: tileY }],
      currentPathIndex: 0,
      pixelX: tileX * this.tileSize,
      pixelY: tileY * this.tileSize,
      targetPixelX: tileX * this.tileSize,
      targetPixelY: tileY * this.tileSize,
      speed,
      isMoving: false,
    });
  }

  /**
   * 更新 NPC 位置（每帧调用）
   *
   * 沿路径逐点移动，在路径点之间做线性插值。
   *
   * @param npcId - NPC 唯一标识
   * @param deltaTime - 帧间隔（秒）
   * @returns 当前位置快照
   */
  updateMovement(npcId: string, deltaTime: number): MovementResult {
    const state = this.movementStates.get(npcId);
    if (!state) {
      return { pixelX: 0, pixelY: 0, tileX: 0, tileY: 0, arrived: true, direction: 'idle' };
    }

    // 如果没有路径或已完成
    if (!state.isMoving || state.currentPathIndex >= state.path.length) {
      state.isMoving = false;
      const tile = this.pixelToTile(state.pixelX, state.pixelY);
      return {
        pixelX: state.pixelX,
        pixelY: state.pixelY,
        tileX: tile.x,
        tileY: tile.y,
        arrived: true,
        direction: 'idle',
      };
    }

    // 当前路径点目标
    const targetNode = state.path[state.currentPathIndex];
    const targetPX = targetNode.x * this.tileSize;
    const targetPY = targetNode.y * this.tileSize;

    // 计算方向
    const direction = this.computeDirection(state.pixelX, state.pixelY, targetPX, targetPY);

    // 计算移动距离
    const dx = targetPX - state.pixelX;
    const dy = targetPY - state.pixelY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const moveAmount = state.speed * deltaTime;

    if (moveAmount >= dist) {
      // 到达当前路径点，跳到下一个
      state.pixelX = targetPX;
      state.pixelY = targetPY;
      state.currentPathIndex++;

      // 检查是否到达最终目标
      if (state.currentPathIndex >= state.path.length) {
        state.isMoving = false;
        const tile = this.pixelToTile(state.pixelX, state.pixelY);
        return {
          pixelX: state.pixelX,
          pixelY: state.pixelY,
          tileX: tile.x,
          tileY: tile.y,
          arrived: true,
          direction,
        };
      }

      // 更新下一个路径点的像素目标
      const nextNode = state.path[state.currentPathIndex];
      state.targetPixelX = nextNode.x * this.tileSize;
      state.targetPixelY = nextNode.y * this.tileSize;
    } else {
      // 沿方向移动
      const ratio = moveAmount / dist;
      state.pixelX += dx * ratio;
      state.pixelY += dy * ratio;
    }

    const tile = this.pixelToTile(state.pixelX, state.pixelY);
    return {
      pixelX: state.pixelX,
      pixelY: state.pixelY,
      tileX: tile.x,
      tileY: tile.y,
      arrived: false,
      direction,
    };
  }

  /**
   * 获取 NPC 当前位置
   */
  getPosition(npcId: string): { pixelX: number; pixelY: number; tileX: number; tileY: number } {
    const state = this.movementStates.get(npcId);
    if (!state) return { pixelX: 0, pixelY: 0, tileX: 0, tileY: 0 };

    const tile = this.pixelToTile(state.pixelX, state.pixelY);
    return { pixelX: state.pixelX, pixelY: state.pixelY, tileX: tile.x, tileY: tile.y };
  }

  /**
   * 检查 NPC 是否已到达路径终点
   */
  hasArrived(npcId: string): boolean {
    const state = this.movementStates.get(npcId);
    if (!state) return true;
    return !state.isMoving || state.currentPathIndex >= state.path.length;
  }

  /**
   * 设置 NPC 移动速度
   */
  setSpeed(npcId: string, speed: number): void {
    const state = this.movementStates.get(npcId);
    if (state) {
      state.speed = speed;
    }
  }

  /**
   * 移除 NPC
   */
  removeNPC(npcId: string): void {
    this.movementStates.delete(npcId);
  }

  /**
   * 获取所有移动状态（只读引用）
   */
  getAllStates(): Map<string, MovementState> {
    return this.movementStates;
  }

  // -----------------------------------------------------------------------
  // 内部辅助
  // -----------------------------------------------------------------------

  /**
   * 像素坐标 → 瓦片坐标
   */
  private pixelToTile(pixelX: number, pixelY: number): { x: number; y: number } {
    return {
      x: Math.round(pixelX / this.tileSize),
      y: Math.round(pixelY / this.tileSize),
    };
  }

  /**
   * 根据移动方向计算朝向
   */
  private computeDirection(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): 'up' | 'down' | 'left' | 'right' | 'idle' {
    const dx = toX - fromX;
    const dy = toY - fromY;

    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return 'idle';

    // 优先取位移较大的轴作为朝向
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }

  /**
   * 从布尔可通行图构建 TileMapData（供 PathFinder 使用）
   */
  private buildMapData(walkableMap: boolean[][]): {
    width: number;
    height: number;
    tileSize: number;
    tiles: { x: number; y: number; terrain: TerrainType; elevation: number; variant: number }[][];
    buildings: never[];
    decorations: never[];
  } {
    const height = walkableMap.length;
    const width = height > 0 ? walkableMap[0].length : 0;

    const tiles = walkableMap.map((row, y) =>
      row.map((walkable, x) => ({
        x,
        y,
        terrain: walkable ? TerrainType.GRASS : TerrainType.WATER,
        elevation: 0,
        variant: 0,
      })),
    );

    return {
      width,
      height,
      tileSize: this.tileSize,
      tiles,
      buildings: [],
      decorations: [],
    };
  }
}
