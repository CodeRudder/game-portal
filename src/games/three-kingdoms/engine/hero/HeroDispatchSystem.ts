/**
 * 武将派驻建筑系统 — 武将派驻到建筑以增加产出
 *
 * 职责：
 *   - 管理武将到建筑的派驻关系
 *   - 根据派驻武将的属性计算建筑产出加成
 *   - 武将升级/升星时自动更新建筑产出加成
 *   - 每个建筑最多派驻1名武将，每个武将最多派驻到1个建筑
 *
 * 加成算法：
 *   基础加成 = 武将等级 × 0.5% + 武将品质系数
 *   品质系数: COMMON=1%, FINE=2%, RARE=3%, EPIC=5%, LEGENDARY=8%
 *   最终加成 = 基础加成 × (1 + 攻击属性加成)
 *
 * @module engine/hero/HeroDispatchSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { GeneralData, Quality } from './hero.types';
import type { BuildingType } from '../../shared/types';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 派驻记录 */
export interface DispatchRecord {
  /** 武将ID */
  heroId: string;
  /** 建筑类型 */
  buildingType: BuildingType;
  /** 派驻时的加成百分比 */
  bonusPercent: number;
}

/** 派驻系统状态 */
export interface DispatchState {
  /** 建筑类型 → 派驻记录 */
  buildingDispatch: Record<string, DispatchRecord>;
  /** 武将ID → 派驻到的建筑类型 */
  heroDispatch: Record<string, BuildingType>;
}

/** 派驻结果 */
export interface DispatchResult {
  /** 是否成功 */
  success: boolean;
  /** 派驻后的加成百分比 */
  bonusPercent: number;
  /** 失败原因（如果失败） */
  reason?: string;
}

/** 派驻系统存档数据 (FIX-301: R3 保存/加载覆盖) */
export interface DispatchSaveData {
  /** 存档版本号 */
  version: number;
  /** 建筑类型 → 派驻记录 */
  buildingDispatch: Record<string, DispatchRecord>;
  /** 武将ID → 派驻到的建筑类型 */
  heroDispatch: Record<string, BuildingType>;
}

// ─────────────────────────────────────────────
// 品质加成映射
// ─────────────────────────────────────────────

const QUALITY_BONUS: Record<Quality, number> = {
  COMMON: 1,
  FINE: 2,
  RARE: 3,
  EPIC: 5,
  LEGENDARY: 8,
};

/** 等级每级加成（百分比） */
const LEVEL_BONUS_PER_LEVEL = 0.5;

/** 攻击属性影响系数（每100点攻击增加1%加成） */
const ATTACK_BONUS_COEFFICIENT = 0.01;

// ─────────────────────────────────────────────
// HeroDispatchSystem
// ─────────────────────────────────────────────

/**
 * 武将派驻建筑系统
 *
 * 管理武将到建筑的派驻关系和产出加成计算。
 */
export class HeroDispatchSystem implements ISubsystem {
  readonly name = 'heroDispatch';
  private deps: ISystemDeps | null = null;

  /** 建筑类型 → 派驻记录 */
  private buildingDispatch: Record<string, DispatchRecord> = {};
  /** 武将ID → 派驻到的建筑类型 */
  private heroDispatch: Record<string, BuildingType> = {};

  /** 武将数据获取回调 */
  private getGeneralFn: ((heroId: string) => GeneralData | undefined) | null = null;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {}

  getState(): Record<string, unknown> {
    return {
      buildingDispatch: { ...this.buildingDispatch },
      heroDispatch: { ...this.heroDispatch },
    };
  }

  reset(): void {
    this.buildingDispatch = {};
    this.heroDispatch = {};
  }

  // ─── 依赖注入 ──────────────────────────────

  /**
   * 设置武将数据获取回调
   * @param fn - 通过heroId获取GeneralData的回调
   */
  setGetGeneral(fn: (heroId: string) => GeneralData | undefined): void {
    this.getGeneralFn = fn;
  }

  // ─── 核心 API ──────────────────────────────

  /**
   * 派驻武将到建筑
   *
   * @param heroId - 武将ID
   * @param buildingType - 建筑类型
   * @returns 派驻结果
   */
  dispatchHero(heroId: string, buildingType: BuildingType): DispatchResult {
    // FIX-303: 验证武将存在性
    if (!this.getGeneralFn) {
      return { success: false, bonusPercent: 0, reason: '武将查询函数未初始化' };
    }
    const general = this.getGeneralFn(heroId);
    if (!general) {
      return { success: false, bonusPercent: 0, reason: `武将 ${heroId} 不存在` };
    }

    // 检查武将是否已派驻到其他建筑
    const existingBuilding = this.heroDispatch[heroId];
    if (existingBuilding && existingBuilding !== buildingType) {
      return { success: false, bonusPercent: 0, reason: `武将 ${heroId} 已派驻到 ${existingBuilding}` };
    }

    // 检查建筑是否已有其他武将派驻
    const existingDispatch = this.buildingDispatch[buildingType];
    if (existingDispatch && existingDispatch.heroId !== heroId) {
      // 自动替换：先取消原武将的派驻
      delete this.heroDispatch[existingDispatch.heroId];
    }

    // 计算加成
    const bonusPercent = this.calculateBonus(heroId);

    // 记录派驻关系
    const record: DispatchRecord = { heroId, buildingType, bonusPercent };
    this.buildingDispatch[buildingType] = record;
    this.heroDispatch[heroId] = buildingType;

    return { success: true, bonusPercent };
  }

  /**
   * 取消武将派驻
   *
   * @param heroId - 武将ID
   * @returns 是否成功取消
   */
  undeployHero(heroId: string): boolean {
    const buildingType = this.heroDispatch[heroId];
    if (!buildingType) return false;

    delete this.buildingDispatch[buildingType];
    delete this.heroDispatch[heroId];
    return true;
  }

  /**
   * 获取指定建筑的派驻加成百分比
   *
   * @param buildingType - 建筑类型
   * @returns 加成百分比（如 5 表示 +5%）
   */
  getDispatchBonus(buildingType: BuildingType): number {
    const record = this.buildingDispatch[buildingType];
    if (!record) return 0;
    // 重新计算（武将可能已升级）
    return this.calculateBonus(record.heroId);
  }

  /**
   * 获取所有建筑的派驻加成
   *
   * @returns 建筑类型 → 加成百分比
   */
  getAllDispatchBonuses(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const buildingType of Object.keys(this.buildingDispatch)) {
      result[buildingType] = this.getDispatchBonus(buildingType as BuildingType);
    }
    return result;
  }

  /**
   * 获取武将派驻的建筑类型
   *
   * @param heroId - 武将ID
   * @returns 建筑类型，未派驻返回 null
   */
  getHeroDispatchBuilding(heroId: string): BuildingType | null {
    return this.heroDispatch[heroId] ?? null;
  }

  /**
   * 获取建筑的派驻武将ID
   *
   * @param buildingType - 建筑类型
   * @returns 武将ID，无派驻返回 null
   */
  getBuildingDispatchHero(buildingType: BuildingType): string | null {
    return this.buildingDispatch[buildingType]?.heroId ?? null;
  }

  /**
   * 武将升级后刷新派驻加成
   * 武将升级/升星时调用，自动更新建筑产出加成
   *
   * @param heroId - 升级的武将ID
   * @returns 更新后的加成百分比（未派驻返回0）
   */
  refreshDispatchBonus(heroId: string): number {
    const buildingType = this.heroDispatch[heroId];
    if (!buildingType) return 0;

    const newBonus = this.calculateBonus(heroId);
    this.buildingDispatch[buildingType] = {
      heroId,
      buildingType,
      bonusPercent: newBonus,
    };

    return newBonus;
  }

  /**
   * 计算指定武将的派驻加成百分比
   *
   * @param heroId - 武将ID
   * @returns 加成百分比
   */
  private calculateBonus(heroId: string): number {
    if (!this.getGeneralFn) return 0;

    const general = this.getGeneralFn(heroId);
    if (!general) return 0;

    // 品质加成
    const qualityBonus = QUALITY_BONUS[general.quality] ?? 1;

    // 等级加成
    const levelBonus = general.level * LEVEL_BONUS_PER_LEVEL;

    // 攻击属性加成
    const attackBonus = (general.baseStats?.attack ?? 0) * ATTACK_BONUS_COEFFICIENT;

    // 综合加成
    const totalBonus = (qualityBonus + levelBonus) * (1 + attackBonus);

    return Math.round(totalBonus * 10) / 10; // 保留一位小数
  }

  // ─── 序列化 (FIX-301: R3 保存/加载覆盖，改为结构化存档) ─────────────────

  private static readonly DISPATCH_SAVE_VERSION = 1;

  /** 序列化状态 */
  serialize(): DispatchSaveData {
    return {
      version: HeroDispatchSystem.DISPATCH_SAVE_VERSION,
      buildingDispatch: { ...this.buildingDispatch },
      heroDispatch: { ...this.heroDispatch },
    };
  }

  /** 反序列化状态 */
  deserialize(data: DispatchSaveData): void {
    if (!data) { this.reset(); return; }
    if (data.version !== HeroDispatchSystem.DISPATCH_SAVE_VERSION) {
      // 兼容旧格式（JSON 字符串）
    }
    this.buildingDispatch = { ...(data.buildingDispatch ?? {}) };
    this.heroDispatch = { ...(data.heroDispatch ?? {}) };
  }

  /** 兼容旧格式反序列化（JSON 字符串） */
  deserializeLegacy(json: string): void {
    if (!json) { this.reset(); return; }
    try {
      const data = JSON.parse(json);
      this.buildingDispatch = data.buildingDispatch ?? {};
      this.heroDispatch = data.heroDispatch ?? {};
    } catch {
      this.reset();
    }
  }
}
