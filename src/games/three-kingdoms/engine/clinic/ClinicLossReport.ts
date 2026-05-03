/**
 * 医馆域 — 损失报告（纯计算层）
 *
 * 职责：
 * - 计算医馆节省的资源损失
 * - 升级前后对比
 * - 未建造损失预估
 * - 每日报告
 *
 * 不修改 BuildingSystem，纯计算层
 *
 * @module engine/clinic/ClinicLossReport
 */

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 资源产出记录 */
export interface ResourceProduction {
  resource: string;
  savedPerSecond: number;
}

/** 升级对比结果 */
export interface UpgradeComparison {
  before: number;
  after: number;
  delta: number;
}

/** 每日报告 */
export interface DailyReport {
  totalSaved: number;
  breakdown: Record<string, number>;
}

/** 获取产出回调 */
export type GetProductionFn = () => Record<string, number>;

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 每日秒数 */
const SECONDS_PER_DAY = 86400;

// ─────────────────────────────────────────────
// ClinicLossReport 类
// ─────────────────────────────────────────────

export class ClinicLossReport {
  private clinicLevel: number = 0;
  private getProductionWithoutClinic: GetProductionFn | null = null;
  private getProductionWithClinic: GetProductionFn | null = null;

  /**
   * 初始化损失报告系统
   *
   * @param clinicLevel 当前医馆等级
   * @param getProductionWithoutClinic 无医馆时的产出（每秒）
   * @param getProductionWithClinic 有医馆时的产出（每秒）
   */
  init(
    clinicLevel: number,
    getProductionWithoutClinic: GetProductionFn,
    getProductionWithClinic: GetProductionFn,
  ): void {
    this.clinicLevel = clinicLevel;
    this.getProductionWithoutClinic = getProductionWithoutClinic;
    this.getProductionWithClinic = getProductionWithClinic;
  }

  /**
   * 获取各资源节省量（每秒）
   *
   * 节省量 = 有医馆产出 - 无医馆产出
   * 正值表示医馆带来的增益
   */
  getSavingsReport(): ResourceProduction[] {
    if (!this.getProductionWithoutClinic || !this.getProductionWithClinic) {
      return [];
    }

    const without = this.getProductionWithoutClinic();
    const withClinic = this.getProductionWithClinic();
    const allResources = new Set([
      ...Object.keys(without),
      ...Object.keys(withClinic),
    ]);

    const result: ResourceProduction[] = [];
    for (const resource of allResources) {
      const saved = (withClinic[resource] ?? 0) - (without[resource] ?? 0);
      if (saved !== 0) {
        result.push({ resource, savedPerSecond: saved });
      }
    }

    return result;
  }

  /**
   * 升级对比
   *
   * @param oldLevel 旧等级
   * @param newLevel 新等级
   * @returns 升级前后对比（基于等级差估算）
   */
  getUpgradeComparison(oldLevel: number, newLevel: number): UpgradeComparison {
    // 医馆每级产出提升约 2%（基于 PASSIVE_HEAL_RATE_PER_LEVEL）
    const HEAL_RATE_PER_LEVEL = 0.02;
    const before = oldLevel * HEAL_RATE_PER_LEVEL;
    const after = newLevel * HEAL_RATE_PER_LEVEL;
    const delta = after - before;

    return { before, after, delta };
  }

  /**
   * 计算已解锁但未建造医馆的损失值
   *
   * @param buildingType 建筑类型（通常为 'clinic'）
   * @param unlockLevel 解锁所需的主城等级
   * @param currentCastleLevel 当前主城等级
   * @returns 每秒损失值，未解锁返回 null
   */
  getUnbuiltLoss(
    buildingType: string,
    unlockLevel: number,
    currentCastleLevel: number,
  ): number | null {
    // 未解锁
    if (currentCastleLevel < unlockLevel) {
      return null;
    }

    // 已解锁但未建造 → 使用无医馆产出来估算损失
    if (!this.getProductionWithoutClinic || !this.getProductionWithClinic) {
      return null;
    }

    const without = this.getProductionWithoutClinic();
    const withClinic = this.getProductionWithClinic();

    // 损失 = 有医馆产出 - 无医馆产出（正值表示损失）
    let totalLoss = 0;
    for (const resource of Object.keys(withClinic)) {
      const loss = (withClinic[resource] ?? 0) - (without[resource] ?? 0);
      if (loss > 0) {
        totalLoss += loss;
      }
    }

    return totalLoss;
  }

  /**
   * 获取每日报告
   *
   * @returns 每日总节省量及各资源明细
   */
  getDailyReport(): DailyReport {
    const savings = this.getSavingsReport();
    const breakdown: Record<string, number> = {};
    let totalSaved = 0;

    for (const item of savings) {
      const daily = item.savedPerSecond * SECONDS_PER_DAY;
      breakdown[item.resource] = daily;
      totalSaved += daily;
    }

    return { totalSaved, breakdown };
  }
}
