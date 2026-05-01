/**
 * 科技域 — 科技点系统
 *
 * 职责：科技点的产出（书院）、消耗、存储管理
 * 规则：可引用 tech-config 和 tech.types，禁止引用其他域的 System
 *
 * @module engine/tech/TechPointSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { TechPointState, TechSaveData } from './tech.types';
import { getTechPointProduction } from './tech-config';

// ─────────────────────────────────────────────
// TechPointSystem
// ─────────────────────────────────────────────

export class TechPointSystem implements ISubsystem {
  readonly name = 'tech-point' as const;
  private deps: ISystemDeps | null = null;

  /** 科技点状态 */
  private techPoints: TechPointState;
  /** 当前书院等级（由外部同步） */
  private academyLevel: number;
  /** 研究速度加成百分比（来自文化路线科技） */
  private researchSpeedBonus: number;

  /** FIX-504: 科技点上限常量 */
  static readonly MAX_TECH_POINTS = 99999;

  constructor() {
    this.techPoints = { current: 0, totalEarned: 0, totalSpent: 0 };
    this.academyLevel = 0;
    this.researchSpeedBonus = 0;
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(dt: number): void {
    // FIX-501: NaN/Infinity防护
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (this.academyLevel <= 0) return;
    const production = getTechPointProduction(this.academyLevel);
    if (production <= 0) return;

    const gain = production * dt;
    // FIX-504: 科技点上限检查
    this.techPoints.current = Math.min(this.techPoints.current + gain, TechPointSystem.MAX_TECH_POINTS);
    this.techPoints.totalEarned += gain;
  }

  getState(): TechPointState {
    return { ...this.techPoints };
  }

  reset(): void {
    this.techPoints = { current: 0, totalEarned: 0, totalSpent: 0 };
    this.academyLevel = 0;
    this.researchSpeedBonus = 0;
  }

  // ─────────────────────────────────────────
  // 科技点产出
  // ─────────────────────────────────────────

  /** 同步书院等级（由引擎 tick 调用） */
  syncAcademyLevel(level: number): void {
    // FIX-501: NaN防护
    if (!Number.isFinite(level) || level < 0) return;
    this.academyLevel = level;
  }

  /** 获取当前每秒科技点产出 */
  getProductionRate(): number {
    if (this.academyLevel <= 0) return 0;
    return getTechPointProduction(this.academyLevel);
  }

  /** 同步研究速度加成（来自文化路线科技） */
  syncResearchSpeedBonus(bonus: number): void {
    // FIX-501: NaN/负值防护
    if (!Number.isFinite(bonus)) return;
    this.researchSpeedBonus = Math.max(0, bonus);
  }

  /** 获取研究速度加成倍率（1.0 = 无加成） */
  getResearchSpeedMultiplier(): number {
    return 1 + this.researchSpeedBonus / 100;
  }

  // ─────────────────────────────────────────
  // 科技点消耗
  // ─────────────────────────────────────────

  /** 检查是否有足够的科技点 */
  canAfford(points: number): boolean {
    // FIX-501: NaN防护
    if (!Number.isFinite(points) || points < 0) return false;
    return this.techPoints.current >= points;
  }

  /** 消耗科技点（不检查，直接扣除） */
  spend(points: number): void {
    // FIX-501: NaN/负值防护
    if (!Number.isFinite(points) || points <= 0) return;
    this.techPoints.current -= points;
    this.techPoints.totalSpent += points;
    // 防护：确保科技点不会变为负数
    this.techPoints.current = Math.max(0, this.techPoints.current);
  }

  /** 退还科技点（不修改 totalSpent） */
  refund(points: number): void {
    // FIX-501: NaN/负值防护
    if (!Number.isFinite(points) || points <= 0) return;
    // FIX-504: 科技点上限检查
    this.techPoints.current = Math.min(this.techPoints.current + points, TechPointSystem.MAX_TECH_POINTS);
    // 防护：确保科技点不会变为负数
    this.techPoints.current = Math.max(0, this.techPoints.current);
  }

  /** 尝试消耗科技点（检查后扣除） */
  trySpend(points: number): { success: boolean; reason?: string } {
    if (!this.canAfford(points)) {
      return {
        success: false,
        reason: `科技点不足：需要 ${points}，当前 ${Math.floor(this.techPoints.current)}`,
      };
    }
    this.spend(points);
    return { success: true };
  }

  // ─────────────────────────────────────────
  // 查询
  // ─────────────────────────────────────────

  /** 获取当前科技点数 */
  getCurrentPoints(): number {
    return this.techPoints.current;
  }

  /** 获取累计获得的科技点 */
  getTotalEarned(): number {
    return this.techPoints.totalEarned;
  }

  /** 获取累计消耗的科技点 */
  getTotalSpent(): number {
    return this.techPoints.totalSpent;
  }

  /** 获取完整科技点状态 */
  getTechPointState(): TechPointState {
    return { ...this.techPoints };
  }

  // ─────────────────────────────────────────
  // 铜钱兑换科技点（PRD TEC-2: 比率100:1，需书院Lv5+）
  // ─────────────────────────────────────────

  /** 铜钱兑换科技点的比率 */
  static readonly EXCHANGE_RATE = 100;
  /** 兑换所需最低书院等级 */
  static readonly EXCHANGE_MIN_ACADEMY_LEVEL = 5;

  /** 检查是否可以兑换 */
  canExchange(academyLevel: number): { can: boolean; reason?: string } {
    if (academyLevel < TechPointSystem.EXCHANGE_MIN_ACADEMY_LEVEL) {
      return { can: false, reason: `书院等级不足：需Lv.${TechPointSystem.EXCHANGE_MIN_ACADEMY_LEVEL}+` };
    }
    return { can: true };
  }

  /** 铜钱兑换科技点（返回消耗的铜钱和获得的科技点） */
  exchangeGoldForTechPoints(goldAmount: number, academyLevel: number): { success: boolean; goldSpent: number; pointsGained: number; reason?: string } {
    const check = this.canExchange(academyLevel);
    if (!check.can) {
      return { success: false, goldSpent: 0, pointsGained: 0, reason: check.reason };
    }
    // FIX-501: NaN/负值防护
    if (!Number.isFinite(goldAmount) || goldAmount <= 0) {
      return { success: false, goldSpent: 0, pointsGained: 0, reason: '兑换铜钱数量必须大于0' };
    }
    // 100铜钱 = 1科技点
    const pointsGained = goldAmount / TechPointSystem.EXCHANGE_RATE;
    // FIX-504: 科技点上限检查
    this.techPoints.current = Math.min(this.techPoints.current + pointsGained, TechPointSystem.MAX_TECH_POINTS);
    this.techPoints.totalEarned += pointsGained;
    return { success: true, goldSpent: goldAmount, pointsGained };
  }

  // ─────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────

  /** 序列化 */
  serialize(): Pick<TechSaveData, 'techPoints'> {
    return {
      techPoints: { ...this.techPoints },
    };
  }

  /** 反序列化 */
  deserialize(data: Pick<TechSaveData, 'techPoints'>): void {
    if (data.techPoints) {
      this.techPoints = {
        current: data.techPoints.current,
        totalEarned: data.techPoints.totalEarned,
        totalSpent: data.techPoints.totalSpent,
      };
    }
  }
}
