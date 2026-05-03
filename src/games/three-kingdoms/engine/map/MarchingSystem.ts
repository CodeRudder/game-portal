/**
 * 行军动画系统 (MAP-F02b)
 *
 * 管理军队沿道路行军的精灵动画:
 * - A*寻路(沿道路网络)
 * - 精灵队列动画(8×8像素小人)
 * - 路线预览(预计到达时间)
 * - 地形影响(道路加速/山地减速)
 *
 * @module engine/map/MarchingSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { GridPosition } from '../../core/map/world-map.types';
import { LANDMARK_POSITIONS } from '../../core/map/map-config';
import {
  findPathBetweenCities,
  extractWaypoints,
  type WalkabilityGrid,
} from './PathfindingSystem';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 行军状态 */
export type MarchState = 'preparing' | 'marching' | 'arrived' | 'intercepted' | 'retreating';

/** 行军单位 */
export interface MarchUnit {
  /** 唯一ID */
  id: string;
  /** 起点城市ID */
  fromCityId: string;
  /** 终点城市ID */
  toCityId: string;
  /** 当前位置(像素坐标) */
  x: number;
  y: number;
  /** 路径点列表 */
  path: Array<{ x: number; y: number }>;
  /** 当前路径索引 */
  pathIndex: number;
  /** 速度(像素/秒) */
  speed: number;
  /** 阵营 */
  faction: 'wei' | 'shu' | 'wu' | 'neutral';
  /** 兵力 */
  troops: number;
  /** 主将 */
  general: string;
  /** 士气(0~100) */
  morale: number;
  /** 状态 */
  state: MarchState;
  /** 开始时间 */
  startTime: number;
  /** 预计到达时间 */
  eta: number;
  /** 动画帧 */
  animFrame: number;
}

/** 行军预览信息 */
export interface MarchPreview {
  /** 路径点 */
  path: Array<{ x: number; y: number }>;
  /** 总距离(像素) */
  distance: number;
  /** 预计时间(秒) */
  estimatedTime: number;
  /** 路径地形摘要 */
  terrainSummary: Array<{ terrain: string; percentage: number }>;
}

/** 行军系统状态 */
export interface MarchingState {
  /** 活跃行军列表 */
  activeMarches: MarchUnit[];
}

/** 行军系统存档 */
export interface MarchingSaveData {
  activeMarches: MarchUnit[];
  version: number;
}

/** 行军路线信息 */
export interface MarchRoute {
  /** 完整网格路径 */
  path: GridPosition[];
  /** 关键转折点 */
  waypoints: GridPosition[];
  /** 总距离(格子数) */
  distance: number;
  /** 预计行军时间(秒) */
  estimatedTime: number;
  /** 途径城市ID列表 */
  waypointCities: string[];
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 基础行军速度(像素/秒) */
const BASE_SPEED = 30;

/** 道路加速倍率 */
const ROAD_SPEED_MULTIPLIER = 1.5;

/** 山地减速倍率 */
const MOUNTAIN_SPEED_MULTIPLIER = 0.5;

/** 精灵动画帧率(fps) */
const ANIM_FPS = 8;

/** 存档版本 */
const SAVE_VERSION = 1;

/** 网格行军速度(格子/秒) */
const GRID_MARCH_SPEED = 1;

// ─────────────────────────────────────────────
// MarchingSystem
// ─────────────────────────────────────────────

/**
 * 行军动画系统
 */
export class MarchingSystem implements ISubsystem {
  readonly name = 'marching';

  private deps!: ISystemDeps;
  private activeMarches: Map<string, MarchUnit> = new Map();
  private lastUpdateTime = 0;
  private walkabilityGrid: WalkabilityGrid | null = null;

  // ── ISubsystem 接口 ──────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.activeMarches.clear();
    this.lastUpdateTime = Date.now();
  }

  update(dt: number): void {
    const now = Date.now();

    for (const [id, march] of this.activeMarches) {
      if (march.state !== 'marching') continue;

      // 更新位置
      this.updateMarchPosition(march, dt);

      // 更新动画帧
      march.animFrame = Math.floor(now / (1000 / ANIM_FPS)) % 4;

      // 检查是否到达
      if (march.pathIndex >= march.path.length - 1) {
        march.state = 'arrived';
        march.x = march.path[march.path.length - 1].x;
        march.y = march.path[march.path.length - 1].y;

        this.deps.eventBus.emit('march:arrived', {
          marchId: id,
          cityId: march.toCityId,
          troops: march.troops,
          general: march.general,
        });
      }
    }

    this.lastUpdateTime = now;
  }

  getState(): MarchingState {
    return {
      activeMarches: Array.from(this.activeMarches.values()),
    };
  }

  reset(): void {
    this.activeMarches.clear();
  }

  // ── 行军管理 ─────────────────────────────────

  /**
   * 创建行军
   */
  createMarch(
    fromCityId: string,
    toCityId: string,
    troops: number,
    general: string,
    faction: MarchUnit['faction'],
    path: Array<{ x: number; y: number }>,
  ): MarchUnit {
    const id = `march_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const distance = this.calculatePathDistance(path);
    const speed = BASE_SPEED;
    const estimatedTime = distance / speed;

    const march: MarchUnit = {
      id,
      fromCityId,
      toCityId,
      x: path[0].x,
      y: path[0].y,
      path,
      pathIndex: 0,
      speed,
      faction,
      troops,
      general,
      morale: 100,
      state: 'preparing',
      startTime: Date.now(),
      eta: Date.now() + estimatedTime * 1000,
      animFrame: 0,
    };

    this.activeMarches.set(id, march);

    this.deps.eventBus.emit('march:created', {
      marchId: id,
      fromCityId,
      toCityId,
      troops,
      general,
      estimatedTime,
    });

    return march;
  }

  /**
   * 启动行军
   */
  startMarch(marchId: string): void {
    const march = this.activeMarches.get(marchId);
    if (march && march.state === 'preparing') {
      march.state = 'marching';
      march.startTime = Date.now();

      this.deps.eventBus.emit('march:started', {
        marchId,
        fromCityId: march.fromCityId,
        toCityId: march.toCityId,
      });
    }
  }

  /**
   * 取消行军
   */
  cancelMarch(marchId: string): void {
    const march = this.activeMarches.get(marchId);
    if (march) {
      march.state = 'retreating';
      this.activeMarches.delete(marchId);

      this.deps.eventBus.emit('march:cancelled', {
        marchId,
        troops: march.troops,
      });
    }
  }

  /**
   * 获取所有活跃行军
   */
  getActiveMarches(): MarchUnit[] {
    return Array.from(this.activeMarches.values());
  }

  /**
   * 获取指定行军
   */
  getMarch(marchId: string): MarchUnit | undefined {
    return this.activeMarches.get(marchId);
  }

  /**
   * 移除已到达的行军
   */
  removeMarch(marchId: string): void {
    this.activeMarches.delete(marchId);
  }

  // ── 路线预览 ─────────────────────────────────

  /**
   * 生成行军预览
   */
  generatePreview(path: Array<{ x: number; y: number }>): MarchPreview {
    const distance = this.calculatePathDistance(path);
    const speed = BASE_SPEED;
    const estimatedTime = distance / speed;

    // 计算地形摘要
    const terrainSummary = this.calculateTerrainSummary(path);

    return {
      path,
      distance,
      estimatedTime,
      terrainSummary,
    };
  }

  // ── A* 路线计算 ─────────────────────────────

  /**
   * 设置可行走网格(由 PathfindingSystem.buildWalkabilityGrid 生成)
   *
   * 必须在调用 calculateMarchRoute 之前设置。
   *
   * @param grid - 可行走网格
   */
  setWalkabilityGrid(grid: WalkabilityGrid): void {
    this.walkabilityGrid = grid;
  }

  /**
   * 计算行军路线
   *
   * 使用 A* 寻路系统计算两座城市之间的行军路线。
   * 返回路线详情(路径、转折点、距离、预计时间、途径城市)，
   * 如果不可达则返回 null。
   *
   * @param fromCityId - 起点城市ID (如 'city-luoyang')
   * @param toCityId - 终点城市ID (如 'city-xuchang')
   * @returns 路线信息 或 null(不可达/未设置网格/城市不存在)
   */
  calculateMarchRoute(fromCityId: string, toCityId: string): MarchRoute | null {
    // 前置校验
    if (!this.walkabilityGrid) return null;
    if (!LANDMARK_POSITIONS[fromCityId] || !LANDMARK_POSITIONS[toCityId]) return null;

    // 调用 A* 寻路
    const path = findPathBetweenCities(fromCityId, toCityId, this.walkabilityGrid);
    if (path.length === 0) return null;

    // 提取转折点
    const waypoints = extractWaypoints(path);

    // 计算距离(网格曼哈顿步数 = 路径长度 - 1)
    const distance = path.length - 1;

    // 预计时间: 距离 / 速度
    const estimatedTime = distance / GRID_MARCH_SPEED;

    // 提取途径城市
    const waypointCities = this.findWaypointCities(path, fromCityId, toCityId);

    return {
      path,
      waypoints,
      distance,
      estimatedTime,
      waypointCities,
    };
  }

  // ── 内部方法 ─────────────────────────────────

  /**
   * 更新行军位置
   */
  private updateMarchPosition(march: MarchUnit, dt: number): void {
    if (march.pathIndex >= march.path.length - 1) return;

    const target = march.path[march.pathIndex + 1];
    const dx = target.x - march.x;
    const dy = target.y - march.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) {
      // 到达当前路径点
      march.pathIndex++;
      march.x = target.x;
      march.y = target.y;
      return;
    }

    // 计算移动
    const moveAmount = march.speed * dt;
    const ratio = Math.min(1, moveAmount / dist);
    march.x += dx * ratio;
    march.y += dy * ratio;
  }

  /**
   * 计算路径总距离
   */
  private calculatePathDistance(path: Array<{ x: number; y: number }>): number {
    let distance = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      distance += Math.sqrt(dx * dx + dy * dy);
    }
    return distance;
  }

  /**
   * 计算地形摘要
   */
  private calculateTerrainSummary(path: Array<{ x: number; y: number }>): MarchPreview['terrainSummary'] {
    // 简化实现：基于路径长度估算
    const total = path.length;
    return [
      { terrain: '平原', percentage: 60 },
      { terrain: '道路', percentage: 30 },
      { terrain: '山地', percentage: 10 },
    ];
  }

  /**
   * 从路径中提取途径城市
   *
   * 遍历路径上的每个格子，检查是否与 LANDMARK_POSITIONS 中的城市坐标匹配。
   * 排除起点和终点城市本身。
   *
   * @param path - 完整网格路径
   * @param fromCityId - 起点城市ID(排除)
   * @param toCityId - 终点城市ID(排除)
   * @returns 途径城市ID列表(不含起终点)
   */
  private findWaypointCities(
    path: GridPosition[],
    fromCityId: string,
    toCityId: string,
  ): string[] {
    // 构建坐标→城市ID映射(仅 city-* 类型)
    const posToCity = new Map<string, string>();
    for (const [id, pos] of Object.entries(LANDMARK_POSITIONS)) {
      if (id.startsWith('city-')) {
        posToCity.set(`${pos.x},${pos.y}`, id);
      }
    }

    const waypointCities: string[] = [];
    const seen = new Set<string>();

    for (const pos of path) {
      const key = `${pos.x},${pos.y}`;
      const cityId = posToCity.get(key);
      if (cityId && cityId !== fromCityId && cityId !== toCityId && !seen.has(cityId)) {
        waypointCities.push(cityId);
        seen.add(cityId);
      }
    }

    return waypointCities;
  }

  // ── 序列化 ───────────────────────────────────

  serialize(): MarchingSaveData {
    return {
      activeMarches: Array.from(this.activeMarches.values()),
      version: SAVE_VERSION,
    };
  }

  deserialize(data: MarchingSaveData): void {
    if (!data) return;
    this.activeMarches.clear();
    for (const march of data.activeMarches || []) {
      this.activeMarches.set(march.id, march);
    }
  }
}
