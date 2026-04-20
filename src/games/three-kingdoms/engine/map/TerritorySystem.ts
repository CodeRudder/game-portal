/**
 * 引擎层 — 领土管理系统
 *
 * 管理领土的归属、产出、升级和相邻关系。
 * 实现 ISubsystem 接口，可注册到引擎子系统中统一管理。
 *
 * 职责：
 *   - 领土数据管理（从地标初始化）
 *   - 归属变更（占领/失去）
 *   - 产出计算（等级加成）
 *   - 领土升级（消耗资源、提升等级）
 *   - 相邻关系查询（攻城条件）
 *   - 产出汇总（玩家总产出）
 *   - 存档序列化/反序列化
 *
 * @module engine/map/TerritorySystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  OwnershipStatus,
  LandmarkLevel,
  RegionId,
} from '../../core/map';
import type {
  TerritoryData,
  TerritoryProduction,
  TerritoryUpgradeCost,
  TerritoryUpgradeResult,
  TerritoryProductionSummary,
  TerritoryState,
  TerritorySaveData,
} from '../../core/map';
import {
  generateTerritoryData,
  calculateProduction,
  calculateUpgradeCost,
  getAdjacentIds,
  TERRITORY_SAVE_VERSION,
} from '../../core/map';

// ─────────────────────────────────────────────
// 领土管理系统
// ─────────────────────────────────────────────

/**
 * 领土管理系统
 *
 * 管理世界地图上所有领土的归属、产出和升级。
 * 从地标数据初始化，提供产出汇总和攻城条件查询。
 *
 * @example
 * ```ts
 * const territorySys = new TerritorySystem();
 * territorySys.init(deps);
 *
 * // 占领领土
 * territorySys.captureTerritory('city-luoyang', 'player');
 *
 * // 获取玩家总产出
 * const summary = territorySys.getPlayerProductionSummary();
 *
 * // 检查攻城条件
 * const canAttack = territorySys.canAttackTerritory('city-xuchang', 'player');
 * ```
 */
export class TerritorySystem implements ISubsystem {
  readonly name = 'territory';

  private deps!: ISystemDeps;
  private territories: Map<string, TerritoryData> = new Map();

  // ─── ISubsystem 接口 ───────────────────────

  /** 初始化领土系统 */
  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.territories.clear();
    const data = generateTerritoryData();
    for (const t of data) {
      this.territories.set(t.id, { ...t });
    }
  }

  /** 每帧更新（预留） */
  update(_dt: number): void {
    // 预留：后续版本用于产出累积
  }

  /** 获取系统状态快照 */
  getState(): TerritoryState {
    return {
      territories: this.getAllTerritories(),
      playerTerritoryIds: this.getPlayerTerritoryIds(),
      productionSummary: this.getPlayerProductionSummary(),
    };
  }

  /** 重置到初始状态 */
  reset(): void {
    this.territories.clear();
    const data = generateTerritoryData();
    for (const t of data) {
      this.territories.set(t.id, { ...t });
    }
  }

  // ─── 领土查询 ──────────────────────────────

  /** 获取所有领土数据 */
  getAllTerritories(): TerritoryData[] {
    return Array.from(this.territories.values()).map(t => ({ ...t }));
  }

  /** 按ID获取领土 */
  getTerritoryById(id: string): TerritoryData | null {
    const t = this.territories.get(id);
    return t ? { ...t } : null;
  }

  /** 按区域获取领土 */
  getTerritoriesByRegion(region: RegionId): TerritoryData[] {
    return this.getAllTerritories().filter(t => t.region === region);
  }

  /** 按归属获取领土 */
  getTerritoriesByOwnership(ownership: OwnershipStatus): TerritoryData[] {
    return this.getAllTerritories().filter(t => t.ownership === ownership);
  }

  /** 获取玩家领土ID列表 */
  getPlayerTerritoryIds(): string[] {
    return this.getAllTerritories()
      .filter(t => t.ownership === 'player')
      .map(t => t.id);
  }

  /** 获取领土总数 */
  getTotalTerritoryCount(): number {
    return this.territories.size;
  }

  /** 获取玩家领土数量 */
  getPlayerTerritoryCount(): number {
    return this.getTerritoriesByOwnership('player').length;
  }

  // ─── 归属变更 ──────────────────────────────

  /**
   * 占领领土
   *
   * 变更领土归属，并重新计算产出。
   *
   * @param id - 领土ID
   * @param newOwner - 新归属
   * @returns 是否成功
   */
  captureTerritory(id: string, newOwner: OwnershipStatus): boolean {
    const t = this.territories.get(id);
    if (!t) return false;

    const previousOwner = t.ownership;
    t.ownership = newOwner;

    // 发出事件
    this.deps?.eventBus.emit('territory:captured', {
      territoryId: id,
      territoryName: t.name,
      previousOwner,
      newOwner,
      region: t.region,
    });

    return true;
  }

  /**
   * 批量设置归属（用于存档恢复）
   *
   * @param owners - ID→归属映射
   */
  setOwnerships(owners: Record<string, OwnershipStatus>): void {
    for (const [id, ownership] of Object.entries(owners)) {
      const t = this.territories.get(id);
      if (t) {
        t.ownership = ownership;
      }
    }
  }

  // ─── 领土升级 ──────────────────────────────

  /**
   * 升级领土
   *
   * 消耗资源升级领土等级，提升产出。
   * 仅玩家拥有的领土可升级。
   *
   * @param id - 领土ID
   * @returns 升级结果
   */
  upgradeTerritory(id: string): TerritoryUpgradeResult {
    const t = this.territories.get(id);
    const failResult: TerritoryUpgradeResult = {
      success: false,
      previousLevel: t?.level ?? 1,
      newLevel: t?.level ?? 1,
      cost: { grain: 0, gold: 0 },
      newProduction: t?.currentProduction ?? { grain: 0, gold: 0, troops: 0, mandate: 0 },
    };

    if (!t) return failResult;
    if (t.ownership !== 'player') return failResult;
    if (t.level >= 5) return failResult;

    const previousLevel = t.level;
    const cost = calculateUpgradeCost(previousLevel);
    if (!cost) return failResult;

    const newLevel = (previousLevel + 1) as LandmarkLevel;
    const newProduction = calculateProduction(t.baseProduction, newLevel);

    t.level = newLevel;
    t.currentProduction = newProduction;

    // 发出事件
    this.deps?.eventBus.emit('territory:upgraded', {
      territoryId: id,
      territoryName: t.name,
      previousLevel,
      newLevel,
      cost,
    });

    return {
      success: true,
      previousLevel,
      newLevel,
      cost,
      newProduction,
    };
  }

  // ─── 相邻关系 ──────────────────────────────

  /**
   * 获取相邻领土ID列表
   *
   * @param id - 领土ID
   * @returns 相邻领土ID列表
   */
  getAdjacentTerritoryIds(id: string): string[] {
    return getAdjacentIds(id);
  }

  /**
   * 检查是否可以攻击指定领土
   *
   * 攻城条件：目标非己方，且与己方领土相邻。
   *
   * @param targetId - 目标领土ID
   * @param attackerOwner - 攻击方归属
   * @returns 是否可以攻击
   */
  canAttackTerritory(targetId: string, attackerOwner: OwnershipStatus): boolean {
    const target = this.territories.get(targetId);
    if (!target) return false;
    if (target.ownership === attackerOwner) return false;

    // 检查是否有相邻的己方领土
    const adjacentIds = getAdjacentIds(targetId);
    return adjacentIds.some(adjId => {
      const adj = this.territories.get(adjId);
      return adj && adj.ownership === attackerOwner;
    });
  }

  /**
   * 获取可攻击的领土列表
   *
   * @param owner - 攻击方归属
   * @returns 可攻击的领土列表
   */
  getAttackableTerritories(owner: OwnershipStatus): TerritoryData[] {
    return this.getAllTerritories().filter(t =>
      t.ownership !== owner && this.canAttackTerritory(t.id, owner),
    );
  }

  // ─── 产出汇总 ──────────────────────────────

  /**
   * 获取玩家领土产出汇总
   *
   * @returns 产出汇总
   */
  getPlayerProductionSummary(): TerritoryProductionSummary {
    const playerTerritories = this.getTerritoriesByOwnership('player');
    const territoriesByRegion: Record<RegionId, number> = {
      central_plains: 0,
      jiangnan: 0,
      western_shu: 0,
    };
    const totalProduction: TerritoryProduction = {
      grain: 0,
      gold: 0,
      troops: 0,
      mandate: 0,
    };

    const details: TerritoryProductionSummary['details'] = [];

    for (const t of playerTerritories) {
      territoriesByRegion[t.region]++;
      totalProduction.grain += t.currentProduction.grain;
      totalProduction.gold += t.currentProduction.gold;
      totalProduction.troops += t.currentProduction.troops;
      totalProduction.mandate += t.currentProduction.mandate;

      details.push({
        id: t.id,
        name: t.name,
        region: t.region,
        level: t.level,
        production: { ...t.currentProduction },
      });
    }

    // 四舍五入
    totalProduction.grain = Math.round(totalProduction.grain * 100) / 100;
    totalProduction.gold = Math.round(totalProduction.gold * 100) / 100;
    totalProduction.troops = Math.round(totalProduction.troops * 100) / 100;
    totalProduction.mandate = Math.round(totalProduction.mandate * 100) / 100;

    return {
      totalTerritories: playerTerritories.length,
      territoriesByRegion,
      totalProduction,
      details,
    };
  }

  /**
   * 计算指定时长的领土总产出
   *
   * @param seconds - 时长（秒）
   * @returns 各资源产出量
   */
  calculateAccumulatedProduction(seconds: number): TerritoryProduction {
    const summary = this.getPlayerProductionSummary();
    return {
      grain: Math.round(summary.totalProduction.grain * seconds * 100) / 100,
      gold: Math.round(summary.totalProduction.gold * seconds * 100) / 100,
      troops: Math.round(summary.totalProduction.troops * seconds * 100) / 100,
      mandate: Math.round(summary.totalProduction.mandate * seconds * 100) / 100,
    };
  }

  // ─── 序列化 ────────────────────────────────

  /** 序列化为存档数据 */
  serialize(): TerritorySaveData {
    const owners: Record<string, OwnershipStatus> = {};
    const levels: Record<string, LandmarkLevel> = {};

    for (const [id, t] of this.territories) {
      owners[id] = t.ownership;
      levels[id] = t.level;
    }

    return { owners, levels, version: TERRITORY_SAVE_VERSION };
  }

  /** 从存档数据恢复 */
  deserialize(data: TerritorySaveData): void {
    for (const [id, ownership] of Object.entries(data.owners)) {
      const t = this.territories.get(id);
      if (t) {
        t.ownership = ownership;
      }
    }
    for (const [id, level] of Object.entries(data.levels)) {
      const t = this.territories.get(id);
      if (t) {
        t.level = level;
        t.currentProduction = calculateProduction(t.baseProduction, level);
      }
    }
  }
}
