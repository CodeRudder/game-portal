/**
 * 三国霸业 — 野外资源点系统
 *
 * 管理世界地图上的可占领资源点（农田/矿山/伐木场/渔场/药圃），
 * 支持占领、工人分配、产出计算和升级。
 *
 * @module games/three-kingdoms/ResourcePointSystem
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 资源点类型 */
export type ResourcePointType = 'farm' | 'mine' | 'lumber' | 'fishery' | 'herb';

/** 资源点 */
export interface ResourcePoint {
  id: string;
  type: ResourcePointType;
  name: string;
  position: { tileX: number; tileY: number };
  outputPerHour: Record<string, number>;
  isOccupied: boolean;
  occupiedBy?: string;
  workerCount: number;
  maxWorkers: number;
  level: number;
}

// ═══════════════════════════════════════════════════════════════
// 资源点模板
// ═══════════════════════════════════════════════════════════════

interface ResourceTemplate {
  type: ResourcePointType;
  name: string;
  output: Record<string, number>;
  maxWorkers: number;
  terrainTypes: string[];
}

const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  { type: 'farm',    name: '农田', output: { grain: 10 }, maxWorkers: 5, terrainTypes: ['plain', 'village'] },
  { type: 'mine',    name: '矿山', output: { gold: 8, troops: 2 }, maxWorkers: 4, terrainTypes: ['mountain'] },
  { type: 'lumber',  name: '伐木场', output: { grain: 3, gold: 3 }, maxWorkers: 4, terrainTypes: ['forest'] },
  { type: 'fishery', name: '渔场', output: { grain: 8 }, maxWorkers: 3, terrainTypes: ['water'] },
  { type: 'herb',    name: '药圃', output: { troops: 6 }, maxWorkers: 3, terrainTypes: ['mountain', 'forest'] },
];

/** 地形 → 可生成的资源点类型 */
function getTemplatesForTerrain(terrain: string): ResourceTemplate[] {
  return RESOURCE_TEMPLATES.filter(t => t.terrainTypes.includes(terrain));
}

// ═══════════════════════════════════════════════════════════════
// 资源点系统
// ═══════════════════════════════════════════════════════════════

export class ResourcePointSystem {
  private resourcePoints: Map<string, ResourcePoint>;

  constructor() {
    this.resourcePoints = new Map();
  }

  /**
   * 基于地图地形生成资源点
   * 遍历所有瓦片，根据地形类型随机放置资源点（约 15% 概率）
   */
  generateResourcePoints(tiles: { x: number; y: number; terrain: string }[][]): void {
    this.resourcePoints.clear();
    let counter = 0;

    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const tile = tiles[y][x];
        // 跳过城市/道路/关卡（资源点只在野外）
        if (['city', 'road', 'fortress'].includes(tile.terrain)) continue;

        const candidates = getTemplatesForTerrain(tile.terrain);
        if (candidates.length === 0) continue;

        // 约 15% 概率生成资源点（使用简单确定性随机）
        const hash = (x * 31 + y * 17 + tile.terrain.length) % 100;
        if (hash >= 15) continue;

        const tpl = candidates[hash % candidates.length];
        const id = `rp_${tpl.type}_${++counter}`;

        this.resourcePoints.set(id, {
          id,
          type: tpl.type,
          name: tpl.name,
          position: { tileX: x, tileY: y },
          outputPerHour: { ...tpl.output },
          isOccupied: false,
          occupiedBy: undefined,
          workerCount: 0,
          maxWorkers: tpl.maxWorkers,
          level: 1,
        });
      }
    }
  }

  /** 获取指定资源点 */
  getResourcePoint(id: string): ResourcePoint | undefined {
    return this.resourcePoints.get(id);
  }

  /** 获取所有资源点 */
  getAllResourcePoints(): ResourcePoint[] {
    return Array.from(this.resourcePoints.values());
  }

  /**
   * 占领资源点
   * @returns true 表示占领成功
   */
  occupyResourcePoint(id: string, occupiedBy: string): boolean {
    const rp = this.resourcePoints.get(id);
    if (!rp || rp.isOccupied) return false;
    rp.isOccupied = true;
    rp.occupiedBy = occupiedBy;
    return true;
  }

  /**
   * 分配工人到资源点
   * @returns true 表示分配成功
   */
  assignWorkers(id: string, count: number): boolean {
    const rp = this.resourcePoints.get(id);
    if (!rp || !rp.isOccupied) return false;
    if (count < 0 || count > rp.maxWorkers) return false;
    rp.workerCount = count;
    return true;
  }

  /**
   * 计算所有已占领资源点的总产出
   * 产出 = 基础产出 × (工人/最大工人) × 等级 × 时间
   * @param deltaTime - 现实秒数
   */
  calculateOutput(deltaTime: number): Record<string, number> {
    const hours = deltaTime / 3600;
    const total: Record<string, number> = {};

    this.resourcePoints.forEach(rp => {
      if (!rp.isOccupied || rp.workerCount === 0) return;
      const efficiency = rp.workerCount / rp.maxWorkers;
      const levelMultiplier = rp.level;

      Object.entries(rp.outputPerHour).forEach(([resource, base]) => {
        const amount = base * efficiency * levelMultiplier * hours;
        total[resource] = (total[resource] ?? 0) + amount;
      });
    });

    return total;
  }

  /**
   * 升级资源点（等级上限 5）
   * @returns true 表示升级成功
   */
  upgradeResourcePoint(id: string): boolean {
    const rp = this.resourcePoints.get(id);
    if (!rp || rp.level >= 5) return false;
    rp.level++;
    // 升级后产出提升 20%
    Object.keys(rp.outputPerHour).forEach(k => {
      rp.outputPerHour[k] = Math.round(rp.outputPerHour[k] * 1.2 * 100) / 100;
    });
    return true;
  }

  /** 序列化 */
  serialize(): object {
    const entries: Record<string, ResourcePoint> = {};
    this.resourcePoints.forEach((v, k) => { entries[k] = v; });
    return { resourcePoints: entries };
  }

  /** 反序列化 */
  deserialize(data: object): void {
    const d = data as { resourcePoints?: Record<string, ResourcePoint> };
    this.resourcePoints.clear();
    if (d.resourcePoints) {
      Object.entries(d.resourcePoints).forEach(([k, v]) => {
        this.resourcePoints.set(k, v);
      });
    }
  }
}
