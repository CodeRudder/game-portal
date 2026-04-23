/**
 * 引擎层 — NPC 地图展示系统
 *
 * 负责 NPC 在地图上的位置分配、拥挤管理和聚合展示。
 * 实现 ISubsystem 接口，可注册到引擎子系统中统一管理。
 *
 * 职责：
 *   - NPC 位置分配（避免重叠）
 *   - 拥挤检测与管理
 *   - NPC 聚合气泡（同区域多个NPC折叠显示）
 *   - 视口内 NPC 过滤
 *   - 像素坐标转换
 *
 * @module engine/npc/NPCMapPlacer
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  NPCId,
  NPCData,
  NPCMapDisplay,
  NPCClusterConfig,
  NPCPlacementResult,
  CrowdManagementConfig,
} from '../../core/npc';
import {
  DEFAULT_CLUSTER_CONFIG,
  DEFAULT_CROWD_CONFIG,
  NPC_PROFESSION_DEFS,
} from '../../core/npc';
import type { RegionId, GridPosition } from '../../core/map';
import { GRID_CONFIG } from '../../core/map';

// ─────────────────────────────────────────────
// NPC 地图展示系统
// ─────────────────────────────────────────────

/** NPCMapPlacer 依赖（外部注入） */
export interface NPCMapPlacerDeps {
  /** 获取所有 NPC 数据 */
  getAllNPCs: () => NPCData[];
  /** 获取可见 NPC */
  getVisibleNPCs: () => NPCData[];
}

/**
 * NPC 地图展示系统
 *
 * 管理 NPC 在地图上的展示逻辑，包括位置分配、拥挤管理和聚合展示。
 *
 * @example
 * ```ts
 * const placer = new NPCMapPlacer();
 * placer.init(deps);
 * placer.setPlacerDeps({ getAllNPCs, getVisibleNPCs });
 *
 * // 计算地图展示数据
 * const displays = placer.computeMapDisplays();
 *
 * // 按区域获取聚合展示
 * const regionDisplays = placer.getRegionDisplays('wei');
 *
 * // 获取视口内的 NPC
 * const visible = placer.getNPCsInViewport(0, 0, 1280, 696, 1.0);
 * ```
 */
export class NPCMapPlacer implements ISubsystem {
  readonly name = 'npcMapPlacer';

  private deps!: ISystemDeps;
  private placerDeps!: NPCMapPlacerDeps;
  private clusterConfig: NPCClusterConfig = { ...DEFAULT_CLUSTER_CONFIG };
  private crowdConfig: CrowdManagementConfig = { ...DEFAULT_CROWD_CONFIG };
  private cachedDisplays: NPCMapDisplay[] = [];
  private cacheValid = false;

  // ─────────────────────────────────────────
  // ISubsystem 生命周期
  // ─────────────────────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 地图展示系统不需要帧更新
    // 缓存在调用 computeMapDisplays 时更新
  }

  getState(): { displays: NPCMapDisplay[]; clusterConfig: NPCClusterConfig } {
    return {
      displays: this.cachedDisplays,
      clusterConfig: { ...this.clusterConfig },
    };
  }

  reset(): void {
    this.cachedDisplays = [];
    this.cacheValid = false;
    this.clusterConfig = { ...DEFAULT_CLUSTER_CONFIG };
    this.crowdConfig = { ...DEFAULT_CROWD_CONFIG };
  }

  // ─────────────────────────────────────────
  // 依赖注入
  // ─────────────────────────────────────────

  /** 注入地图展示依赖 */
  setPlacerDeps(placerDeps: NPCMapPlacerDeps): void {
    this.placerDeps = placerDeps;
    this.cacheValid = false;
    this.cachedDisplays = [];
  }

  /** 更新聚合配置 */
  setClusterConfig(config: Partial<NPCClusterConfig>): void {
    this.clusterConfig = { ...this.clusterConfig, ...config };
    this.cacheValid = false;
  }

  /** 更新拥挤管理配置 */
  setCrowdConfig(config: Partial<CrowdManagementConfig>): void {
    this.crowdConfig = { ...this.crowdConfig, ...config };
    this.cacheValid = false;
  }

  // ─────────────────────────────────────────
  // 坐标转换
  // ─────────────────────────────────────────

  /** 格子坐标转像素坐标（格子中心点） */
  gridToPixel(pos: GridPosition): { x: number; y: number } {
    return {
      x: pos.x * GRID_CONFIG.tileWidth + GRID_CONFIG.tileWidth / 2,
      y: pos.y * GRID_CONFIG.tileHeight + GRID_CONFIG.tileHeight / 2,
    };
  }

  /** 像素坐标转格子坐标 */
  pixelToGrid(px: number, py: number): GridPosition {
    return {
      x: Math.floor(px / GRID_CONFIG.tileWidth),
      y: Math.floor(py / GRID_CONFIG.tileHeight),
    };
  }

  // ─────────────────────────────────────────
  // 地图展示计算
  // ─────────────────────────────────────────

  /**
   * 计算所有 NPC 的地图展示数据
   *
   * 处理流程：
   * 1. 获取所有可见 NPC
   * 2. 按区域分组
   * 3. 每个区域内进行拥挤检测和聚合
   * 4. 返回展示数据列表
   *
   * @returns NPC 地图展示数据列表
   */
  computeMapDisplays(): NPCMapDisplay[] {
    if (this.cacheValid) return this.cachedDisplays;

    const npcs = this.placerDeps?.getVisibleNPCs?.() ?? [];
    const displays: NPCMapDisplay[] = [];

    // 按区域分组
    const regionGroups = this.groupByRegion(npcs);

    for (const [region, regionNPCs] of regionGroups) {
      const regionDisplays = this.computeRegionDisplays(region, regionNPCs);
      displays.push(...regionDisplays);
    }

    this.cachedDisplays = displays;
    this.cacheValid = true;
    return displays;
  }

  /**
   * 按区域获取展示数据
   *
   * @param region - 区域 ID
   * @returns 该区域的 NPC 展示数据
   */
  getRegionDisplays(region: RegionId): NPCMapDisplay[] {
    const allDisplays = this.computeMapDisplays();
    return allDisplays.filter((d) => {
      // 通过关联的 NPC 数据判断区域
      return this.isDisplayInRegion(d, region);
    });
  }

  /**
   * 获取视口内的 NPC 展示数据
   *
   * @param offsetX - 视口 X 偏移
   * @param offsetY - 视口 Y 偏移
   * @param width - 视口宽度
   * @param height - 视口高度
   * @param zoom - 缩放级别
   * @returns 视口内的 NPC 展示数据
   */
  getNPCsInViewport(
    offsetX: number,
    offsetY: number,
    width: number,
    height: number,
    zoom: number,
  ): NPCMapDisplay[] {
    const allDisplays = this.computeMapDisplays();

    return allDisplays.filter((d) => {
      const px = d.displayPosition.x * zoom - offsetX;
      const py = d.displayPosition.y * zoom - offsetY;
      const margin = 32; // 图标大小边距
      return (
        px >= -margin &&
        px <= width + margin &&
        py >= -margin &&
        py <= height + margin
      );
    });
  }

  /**
   * 计算位置分配结果
   *
   * 对一组 NPC 进行位置分配，考虑拥挤管理。
   *
   * @param npcs - 需要分配位置的 NPC 列表
   * @returns 位置分配结果
   */
  computePlacement(npcs: NPCData[]): NPCPlacementResult {
    const placed: NPCId[] = [];
    const unplaced: NPCId[] = [];
    const clusters: NPCMapDisplay[] = [];

    // 按位置分组
    const positionMap = new Map<string, NPCData[]>();
    for (const npc of npcs) {
      const key = `${npc.position.x},${npc.position.y}`;
      const group = positionMap.get(key) ?? [];
      group.push(npc);
      positionMap.set(key, group);
    }

    // 处理每个位置
    for (const [key, group] of positionMap) {
      if (group.length <= this.crowdConfig.maxNPCsPerTile) {
        // 不超过单格上限，直接放置
        for (const npc of group) {
          placed.push(npc.id);
        }
      } else {
        // 超过单格上限，部分放置+部分聚合
        const directPlace = group.slice(0, this.crowdConfig.maxNPCsPerTile);
        const overflow = group.slice(this.crowdConfig.maxNPCsPerTile);

        for (const npc of directPlace) {
          placed.push(npc.id);
        }

        // 聚合溢出的 NPC
        if (overflow.length >= this.clusterConfig.minClusterSize) {
          const [x, y] = key.split(',').map(Number);
          const pixelPos = this.gridToPixel({ x, y });
          clusters.push({
            id: `cluster-${key}`,
            displayPosition: {
              x: pixelPos.x + this.crowdConfig.jitterRadius,
              y: pixelPos.y - this.crowdConfig.jitterRadius,
            },
            icon: '👥',
            isClustered: true,
            clusterCount: overflow.length,
            clusteredNPCIds: overflow.map((n) => n.id),
          });
          placed.push(...overflow.map((n) => n.id));
        } else {
          // 溢出数量不足聚合最小值，仍然直接放置
          for (const npc of overflow) {
            placed.push(npc.id);
          }
        }
      }
    }

    return { placed, unplaced, clusters };
  }

  /**
   * 使缓存失效
   *
   * 当 NPC 位置或数量发生变化时调用。
   */
  invalidateCache(): void {
    this.cacheValid = false;
    this.cachedDisplays = [];
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /** 按区域分组 NPC */
  private groupByRegion(npcs: NPCData[]): Map<RegionId, NPCData[]> {
    const groups = new Map<RegionId, NPCData[]>();
    for (const npc of npcs) {
      const group = groups.get(npc.region) ?? [];
      group.push(npc);
      groups.set(npc.region, group);
    }
    return groups;
  }

  /** 计算单个区域的展示数据 */
  private computeRegionDisplays(
    _region: RegionId,
    npcs: NPCData[],
  ): NPCMapDisplay[] {
    const displays: NPCMapDisplay[] = [];

    if (!this.clusterConfig.enabled || npcs.length <= this.clusterConfig.maxDisplayPerRegion) {
      // 不需要聚合，直接展示
      for (const npc of npcs) {
        const pixelPos = this.gridToPixel(npc.position);
        const profDef = NPC_PROFESSION_DEFS[npc.profession];
        displays.push({
          id: npc.id,
          displayPosition: this.applyJitter(pixelPos, npc.id),
          icon: npc.customIcon ?? profDef.icon,
          isClustered: false,
          clusterCount: 1,
          clusteredNPCIds: [npc.id],
        });
      }
    } else {
      // 需要聚合
      const clustered = this.clusterNPCs(npcs);
      displays.push(...clustered);
    }

    return displays;
  }

  /** 对 NPC 进行聚合 */
  private clusterNPCs(npcs: NPCData[]): NPCMapDisplay[] {
    const displays: NPCMapDisplay[] = [];
    const assigned = new Set<NPCId>();

    for (let i = 0; i < npcs.length; i++) {
      if (assigned.has(npcs[i].id)) continue;

      const cluster: NPCData[] = [npcs[i]];
      const pixelI = this.gridToPixel(npcs[i].position);

      for (let j = i + 1; j < npcs.length; j++) {
        if (assigned.has(npcs[j].id)) continue;

        const pixelJ = this.gridToPixel(npcs[j].position);
        const dist = Math.hypot(pixelI.x - pixelJ.x, pixelI.y - pixelJ.y);

        if (dist <= this.clusterConfig.clusterDistance) {
          cluster.push(npcs[j]);
        }
      }

      if (cluster.length >= this.clusterConfig.minClusterSize) {
        // 聚合显示
        const center = this.computeClusterCenter(cluster);
        displays.push({
          id: `cluster-${cluster.map((n) => n.id).join('-')}`,
          displayPosition: center,
          icon: '👥',
          isClustered: true,
          clusterCount: cluster.length,
          clusteredNPCIds: cluster.map((n) => n.id),
        });
        cluster.forEach((n) => assigned.add(n.id));
      } else {
        // 单独显示
        const npc = npcs[i];
        const pixelPos = this.gridToPixel(npc.position);
        const profDef = NPC_PROFESSION_DEFS[npc.profession];
        displays.push({
          id: npc.id,
          displayPosition: this.applyJitter(pixelPos, npc.id),
          icon: npc.customIcon ?? profDef.icon,
          isClustered: false,
          clusterCount: 1,
          clusteredNPCIds: [npc.id],
        });
        assigned.add(npc.id);
      }
    }

    return displays;
  }

  /** 计算聚合中心点 */
  private computeClusterCenter(cluster: NPCData[]): { x: number; y: number } {
    let sumX = 0;
    let sumY = 0;
    for (const npc of cluster) {
      const px = this.gridToPixel(npc.position);
      sumX += px.x;
      sumY += px.y;
    }
    return {
      x: sumX / cluster.length,
      y: sumY / cluster.length,
    };
  }

  /** 应用位置抖动（避免完全重叠） */
  private applyJitter(
    pos: { x: number; y: number },
    seed: string,
  ): { x: number; y: number } {
    // 使用字符串 hash 作为伪随机种子
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    const angle = ((hash & 0xff) / 255) * Math.PI * 2;
    const radius = this.crowdConfig.jitterRadius * ((hash >> 8 & 0xff) / 255);
    return {
      x: pos.x + Math.cos(angle) * radius,
      y: pos.y + Math.sin(angle) * radius,
    };
  }

  /** 判断展示数据是否在指定区域 */
  private isDisplayInRegion(display: NPCMapDisplay, region: RegionId): boolean {
    const gridPos = this.pixelToGrid(
      display.displayPosition.x,
      display.displayPosition.y,
    );
    // 通过 NPC 数据判断区域
    const npcs = this.placerDeps?.getVisibleNPCs?.() ?? [];
    const npcIds = display.clusteredNPCIds;
    return npcIds.some((id) => {
      const npc = npcs.find((n) => n.id === id);
      return npc?.region === region;
    });
  }
}
