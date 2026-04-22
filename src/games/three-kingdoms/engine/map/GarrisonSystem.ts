/**
 * 引擎层 — 驻防系统
 *
 * 管理武将驻防领土的完整生命周期：
 *   - 武将派遣驻防（含互斥校验）
 *   - 防御加成计算
 *   - 产出加成计算
 *   - 撤回驻防武将
 *   - 驻防查询
 *   - 存档序列化/反序列化
 *
 * 规则：
 *   - 每个己方领土最多1名驻防武将
 *   - 驻防与出战编队互斥（同一武将不能同时驻防和出战）
 *   - 撤回驻防即时生效
 *
 * @module engine/map/GarrisonSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  GarrisonAssignment,
  GarrisonBonus,
  GarrisonErrorCode,
  GarrisonResult,
  UngarrisonResult,
  GarrisonState,
  GarrisonSaveData,
} from '../../core/map';
import {
  QUALITY_PRODUCTION_BONUS,
  DEFENSE_BONUS_FACTOR,
  GARRISON_SAVE_VERSION,
} from '../../core/map';
import type { TerritoryProduction } from '../../core/map';
import type { GeneralData } from '../hero/hero.types';

// ─────────────────────────────────────────────
// 驻防系统
// ─────────────────────────────────────────────

/**
 * 驻防系统
 *
 * 管理武将驻防领土，提供防御和产出加成。
 * 依赖 TerritorySystem 和 HeroSystem 进行数据校验。
 */
export class GarrisonSystem implements ISubsystem {
  readonly name = 'garrison';

  private deps!: ISystemDeps;
  /** 领土ID → 驻防记录 */
  private assignments: Map<string, GarrisonAssignment> = new Map();

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.assignments.clear();
  }

  update(_dt: number): void { /* 预留 */ }

  getState(): GarrisonState {
    const assignments: Record<string, GarrisonAssignment> = {};
    for (const [tid, a] of this.assignments) {
      assignments[tid] = { ...a };
    }
    return {
      assignments,
      totalGarrisons: this.assignments.size,
    };
  }

  reset(): void {
    this.assignments.clear();
  }

  // ─── 驻防操作 ──────────────────────────────

  /**
   * 派遣武将驻防领土
   *
   * 校验流程：
   * 1. 领土存在且为玩家所有
   * 2. 武将存在
   * 3. 武将未在其他领土驻防
   * 4. 武将未在出战编队中
   * 5. 目标领土未驻防其他武将
   *
   * @param territoryId - 领土ID
   * @param generalId - 武将ID
   * @returns 驻防结果
   */
  assignGarrison(territoryId: string, generalId: string): GarrisonResult {
    // 1. 校验领土
    const territory = this.territorySys?.getTerritoryById(territoryId);
    if (!territory) {
      return this.fail('TERRITORY_NOT_FOUND', `领土 ${territoryId} 不存在`);
    }
    if (territory.ownership !== 'player') {
      return this.fail('TERRITORY_NOT_OWNED', `${territory.name} 非己方领土`);
    }

    // 2. 校验武将
    const general = this.getGeneralData(generalId);
    if (!general) {
      return this.fail('GENERAL_NOT_FOUND', `武将 ${generalId} 不存在`);
    }

    // 3. 校验武将未在其他领土驻防
    const existingTerritory = this.findGarrisonedByGeneral(generalId);
    if (existingTerritory) {
      return this.fail('GENERAL_ALREADY_GARRISONED', `武将 ${general.name} 已驻防于 ${existingTerritory}`);
    }

    // 4. 校验武将未在出战编队中
    if (this.isGeneralInFormation(generalId)) {
      return this.fail('GENERAL_IN_FORMATION', `武将 ${general.name} 正在出战编队中，无法驻防`);
    }

    // 5. 校验目标领土未驻防其他武将
    const currentAssignment = this.assignments.get(territoryId);
    if (currentAssignment) {
      return this.fail('TERRITORY_ALREADY_GARRISONED', `${territory.name} 已有驻防武将`);
    }

    // 执行驻防
    const assignment: GarrisonAssignment = {
      territoryId,
      generalId,
      assignedAt: Date.now(),
    };
    this.assignments.set(territoryId, assignment);

    // 计算加成
    const bonus = this.calculateBonus(general, territory.currentProduction);

    // 发出事件
    this.deps?.eventBus.emit('garrison:assigned', {
      territoryId,
      territoryName: territory.name,
      generalId,
      generalName: general.name,
      bonus,
    });

    return {
      success: true,
      assignment: { ...assignment },
      bonus,
    };
  }

  /**
   * 撤回驻防武将
   *
   * 即时生效，移除驻防记录和加成。
   *
   * @param territoryId - 领土ID
   * @returns 撤防结果
   */
  withdrawGarrison(territoryId: string): UngarrisonResult {
    const assignment = this.assignments.get(territoryId);
    if (!assignment) {
      return {
        success: false,
        errorMessage: `领土 ${territoryId} 无驻防武将`,
        territoryId,
      };
    }

    const generalId = assignment.generalId;
    const general = this.getGeneralData(generalId);
    const territory = this.territorySys?.getTerritoryById(territoryId);

    this.assignments.delete(territoryId);

    // 发出事件
    this.deps?.eventBus.emit('garrison:withdrawn', {
      territoryId,
      territoryName: territory?.name ?? territoryId,
      generalId,
      generalName: general?.name ?? generalId,
    });

    return {
      success: true,
      territoryId,
      generalId,
    };
  }

  // ─── 加成计算 ──────────────────────────────

  /**
   * 计算武将驻防加成
   *
   * 防御加成 = 武将defense × DEFENSE_BONUS_FACTOR
   * 产出加成 = 基础产出 × 品质加成百分比
   *
   * @param general - 武将数据
   * @param baseProduction - 领土基础产出
   * @returns 驻防加成
   */
  calculateBonus(general: GeneralData, baseProduction: TerritoryProduction): GarrisonBonus {
    // 防御加成：武将defense属性 × 系数
    const defenseBonus = general.baseStats.defense * DEFENSE_BONUS_FACTOR;

    // 产出加成：基础产出 × 品质百分比
    const qualityBonus = QUALITY_PRODUCTION_BONUS[general.quality] ?? 0.05;

    return {
      defenseBonus: Math.round(defenseBonus * 1000) / 1000,
      productionBonus: {
        grain: Math.round(baseProduction.grain * qualityBonus * 100) / 100,
        gold: Math.round(baseProduction.gold * qualityBonus * 100) / 100,
        troops: Math.round(baseProduction.troops * qualityBonus * 100) / 100,
        mandate: Math.round(baseProduction.mandate * qualityBonus * 100) / 100,
      },
    };
  }

  /**
   * 获取领土的驻防加成
   *
   * @param territoryId - 领土ID
   * @returns 驻防加成（无驻防时返回零加成）
   */
  getGarrisonBonus(territoryId: string): GarrisonBonus {
    const assignment = this.assignments.get(territoryId);
    if (!assignment) {
      return {
        defenseBonus: 0,
        productionBonus: { grain: 0, gold: 0, troops: 0, mandate: 0 },
      };
    }

    const general = this.getGeneralData(assignment.generalId);
    if (!general) {
      return {
        defenseBonus: 0,
        productionBonus: { grain: 0, gold: 0, troops: 0, mandate: 0 },
      };
    }

    const territory = this.territorySys?.getTerritoryById(territoryId);
    const baseProduction = territory?.currentProduction ?? { grain: 0, gold: 0, troops: 0, mandate: 0 };

    return this.calculateBonus(general, baseProduction);
  }

  /**
   * 获取领土的驻防加成后的总防御值
   *
   * @param territoryId - 领土ID
   * @param baseDefense - 基础防御值
   * @returns 加成后防御值
   */
  getEffectiveDefense(territoryId: string, baseDefense: number): number {
    const bonus = this.getGarrisonBonus(territoryId);
    return Math.round(baseDefense * (1 + bonus.defenseBonus) * 100) / 100;
  }

  /**
   * 获取领土的驻防加成后的总产出
   *
   * @param territoryId - 领土ID
   * @param baseProduction - 基础产出
   * @returns 加成后产出
   */
  getEffectiveProduction(territoryId: string, baseProduction: TerritoryProduction): TerritoryProduction {
    const bonus = this.getGarrisonBonus(territoryId);
    return {
      grain: Math.round((baseProduction.grain + bonus.productionBonus.grain) * 100) / 100,
      gold: Math.round((baseProduction.gold + bonus.productionBonus.gold) * 100) / 100,
      troops: Math.round((baseProduction.troops + bonus.productionBonus.troops) * 100) / 100,
      mandate: Math.round((baseProduction.mandate + bonus.productionBonus.mandate) * 100) / 100,
    };
  }

  // ─── 查询方法 ──────────────────────────────

  /** 获取指定领土的驻防记录 */
  getAssignment(territoryId: string): GarrisonAssignment | null {
    const a = this.assignments.get(territoryId);
    return a ? { ...a } : null;
  }

  /** 获取所有驻防记录 */
  getAllAssignments(): GarrisonAssignment[] {
    return Array.from(this.assignments.values()).map(a => ({ ...a }));
  }

  /** 检查领土是否有驻防 */
  isTerritoryGarrisoned(territoryId: string): boolean {
    return this.assignments.has(territoryId);
  }

  /** 检查武将是否正在驻防 */
  isGeneralGarrisoned(generalId: string): boolean {
    return this.findGarrisonedByGeneral(generalId) !== null;
  }

  /** 获取驻防总数 */
  getGarrisonCount(): number {
    return this.assignments.size;
  }

  /** 获取玩家领土的驻防加成后的总产出汇总 */
  getPlayerGarrisonedProductionSummary(): { totalBonus: TerritoryProduction; details: Array<{ territoryId: string; bonus: GarrisonBonus }> } {
    const details: Array<{ territoryId: string; bonus: GarrisonBonus }> = [];
    const totalBonus: TerritoryProduction = { grain: 0, gold: 0, troops: 0, mandate: 0 };

    for (const [territoryId] of this.assignments) {
      const bonus = this.getGarrisonBonus(territoryId);
      details.push({ territoryId, bonus });
      totalBonus.grain += bonus.productionBonus.grain;
      totalBonus.gold += bonus.productionBonus.gold;
      totalBonus.troops += bonus.productionBonus.troops;
      totalBonus.mandate += bonus.productionBonus.mandate;
    }

    totalBonus.grain = Math.round(totalBonus.grain * 100) / 100;
    totalBonus.gold = Math.round(totalBonus.gold * 100) / 100;
    totalBonus.troops = Math.round(totalBonus.troops * 100) / 100;
    totalBonus.mandate = Math.round(totalBonus.mandate * 100) / 100;

    return { totalBonus, details };
  }

  // ─── 序列化 ────────────────────────────────

  serialize(): GarrisonSaveData {
    return {
      assignments: this.getAllAssignments(),
      version: GARRISON_SAVE_VERSION,
    };
  }

  deserialize(data: GarrisonSaveData): void {
    this.assignments.clear();
    if (data?.assignments) {
      for (const a of data.assignments) {
        this.assignments.set(a.territoryId, { ...a });
      }
    }
  }

  // ─── 内部方法 ──────────────────────────────

  /** 创建失败结果 */
  private fail(code: GarrisonErrorCode, message: string): GarrisonResult {
    return { success: false, errorCode: code, errorMessage: message };
  }

  /** 查找武将驻防的领土ID */
  private findGarrisonedByGeneral(generalId: string): string | null {
    for (const [territoryId, assignment] of this.assignments) {
      if (assignment.generalId === generalId) {
        return territoryId;
      }
    }
    return null;
  }

  /** 获取武将数据（从HeroSystem） */
  private getGeneralData(generalId: string): GeneralData | null {
    try {
      const heroSys = this.deps?.registry?.get<import('../hero/HeroSystem').HeroSystem>('hero');
      const general = heroSys?.getGeneral(generalId);
      return general ?? null;
    } catch {
      return null;
    }
  }

  /** 检查武将是否在出战编队中 */
  private isGeneralInFormation(generalId: string): boolean {
    try {
      // HeroFormation 已实现 ISubsystem，通过 registry 获取
      const formation = this.deps?.registry?.get('heroFormation') as
        import('../hero/HeroFormation').HeroFormation | undefined;
      return formation?.isGeneralInAnyFormation(generalId) ?? false;
    } catch {
      return false;
    }
  }

  /** 获取 TerritorySystem */
  private get territorySys(): import('./TerritorySystem').TerritorySystem | null {
    try {
      return this.deps?.registry?.get<import('./TerritorySystem').TerritorySystem>('territory') ?? null;
    } catch {
      return null;
    }
  }
}
