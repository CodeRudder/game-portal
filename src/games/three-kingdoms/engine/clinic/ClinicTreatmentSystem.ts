/**
 * 医馆治疗系统 — 引擎层
 *
 * 职责：伤兵管理、治疗恢复、产出Buff
 * 规则：
 *   - 伤兵入池：战斗后伤兵进入医馆伤兵池
 *   - 主动治疗：消耗grain(10%日产)→恢复10%伤兵，冷却30分钟
 *   - 治疗后+10%产出持续10分钟
 *   - 被动恢复：clinicLevel × 2%/tick
 *
 * @module engine/clinic/ClinicTreatmentSystem
 */

import type { TroopType } from '../barracks/barracks.types';
import type {
  WoundedPool,
  TreatmentResult,
  ClinicState,
  ClinicSaveData,
} from './clinic.types';
import {
  TREATMENT_COOLDOWN_MS,
  PRODUCTION_BUFF_DURATION_MS,
  TREATMENT_HEAL_RATE,
  PRODUCTION_BUFF_BONUS,
  PASSIVE_HEAL_RATE_PER_LEVEL,
} from './clinic.types';

// Re-export for convenience
export type {
  WoundedPool,
  TreatmentResult,
  ClinicState,
  ClinicSaveData,
} from './clinic.types';
export {
  TREATMENT_COOLDOWN_MS,
  PRODUCTION_BUFF_DURATION_MS,
  TREATMENT_HEAL_RATE,
  PRODUCTION_BUFF_BONUS,
  PASSIVE_HEAL_RATE_PER_LEVEL,
} from './clinic.types';

// ─────────────────────────────────────────────
// 资源接口
// ─────────────────────────────────────────────

export type GetResourceFn = (type: string) => number;
export type SpendResourceFn = (type: string, amount: number) => boolean;

// ─────────────────────────────────────────────
// 医馆治疗系统
// ─────────────────────────────────────────────

export class ClinicTreatmentSystem {
  private clinicLevel: number = 1;
  private getResource: GetResourceFn | null = null;
  private spendResource: SpendResourceFn | null = null;

  /** 当前时间戳（可注入） */
  private nowMs: number = Date.now();

  /** 系统状态 */
  private state: ClinicState;

  constructor() {
    this.state = this.createInitialState();
  }

  // ── 初始化 ──

  /**
   * 初始化医馆治疗系统
   *
   * @param clinicLevel - 医馆等级
   * @param getResource - 获取资源的回调函数
   * @param spendResource - 消耗资源的回调函数
   */
  init(
    clinicLevel: number,
    getResource: GetResourceFn,
    spendResource: SpendResourceFn,
  ): void {
    this.clinicLevel = Math.max(1, Math.floor(clinicLevel));
    this.getResource = getResource;
    this.spendResource = spendResource;
  }

  /**
   * 设置当前时间（用于测试）
   */
  setNow(ms: number): void {
    this.nowMs = ms;
  }

  /**
   * 获取当前时间
   */
  private getNow(): number {
    return this.nowMs;
  }

  // ── 伤兵管理 ──

  /**
   * 添加伤兵到伤兵池
   *
   * @param count - 伤兵数量
   * @param troopType - 兵种类型（可选，默认归入infantry）
   */
  addWounded(count: number, troopType?: TroopType): void {
    if (count <= 0) return;

    const type: TroopType = troopType ?? 'infantry';
    this.state.woundedPool.totalWounded += count;
    this.state.woundedPool.woundedByType[type] =
      (this.state.woundedPool.woundedByType[type] ?? 0) + count;
  }

  /**
   * 从伤兵池移除伤兵
   *
   * @param count - 移除数量
   * @param troopType - 兵种类型（可选）
   */
  private removeWounded(count: number, troopType?: TroopType): void {
    const actual = Math.min(count, this.state.woundedPool.totalWounded);
    if (actual <= 0) return;

    this.state.woundedPool.totalWounded -= actual;

    if (troopType) {
      const current = this.state.woundedPool.woundedByType[troopType] ?? 0;
      this.state.woundedPool.woundedByType[troopType] = Math.max(0, current - actual);
    } else {
      // 按比例从各兵种扣除
      const total = this.state.woundedPool.totalWounded + actual;
      if (total > 0) {
        for (const key of Object.keys(this.state.woundedPool.woundedByType) as TroopType[]) {
          const ratio = (this.state.woundedPool.woundedByType[key] ?? 0) / total;
          const toRemove = Math.min(
            Math.round(actual * ratio),
            this.state.woundedPool.woundedByType[key] ?? 0,
          );
          this.state.woundedPool.woundedByType[key] -= toRemove;
        }
      }
    }
  }

  // ── 主动治疗 ──

  /**
   * 执行主动治疗
   *
   * 消耗grain(10%日产)→恢复10%伤兵，冷却30分钟
   * 治疗后+10%产出持续10分钟
   *
   * @returns 治疗结果
   */
  treat(): { success: boolean; healed: number; cost: Record<string, number>; reason?: string; buffActive?: boolean } {
    // 检查是否有伤兵
    if (this.state.woundedPool.totalWounded <= 0) {
      return {
        success: false,
        healed: 0,
        cost: {},
        reason: '没有伤兵需要治疗',
      };
    }

    // 检查冷却
    if (this.isTreatmentOnCooldown()) {
      return {
        success: false,
        healed: 0,
        cost: {},
        reason: '治疗冷却中',
      };
    }

    if (!this.getResource || !this.spendResource) {
      return {
        success: false,
        healed: 0,
        cost: {},
        reason: '系统未初始化',
      };
    }

    // 计算治疗消耗：10%日产粮草
    // 日产粮草 = grain资源总量（简化模型）
    const dailyGrain = this.getResource('grain');
    const treatmentCost = Math.floor(dailyGrain * 0.1);
    const cost: Record<string, number> = { grain: treatmentCost };

    // 检查粮草是否充足
    const currentGrain = this.getResource('grain');
    if (currentGrain < treatmentCost) {
      return {
        success: false,
        healed: 0,
        cost,
        reason: '粮草不足',
      };
    }

    // 扣除粮草
    const spent = this.spendResource('grain', treatmentCost);
    if (!spent) {
      return {
        success: false,
        healed: 0,
        cost,
        reason: '粮草扣除失败',
      };
    }

    // 计算恢复数量：10%伤兵
    const healed = Math.max(1, Math.floor(this.state.woundedPool.totalWounded * TREATMENT_HEAL_RATE));
    this.removeWounded(healed);

    // 设置冷却
    this.state.treatmentCooldownEnd = this.getNow() + TREATMENT_COOLDOWN_MS;

    // 激活产出Buff
    this.state.buffEndTime = this.getNow() + PRODUCTION_BUFF_DURATION_MS;

    return {
      success: true,
      healed,
      cost,
      buffActive: true,
    };
  }

  // ── 被动恢复 ──

  /**
   * 获取被动恢复速率
   *
   * @returns 每次tick恢复比例 = clinicLevel × 2%
   */
  passiveHealRate(): number {
    return this.clinicLevel * PASSIVE_HEAL_RATE_PER_LEVEL;
  }

  /**
   * tick被动恢复
   *
   * @param deltaMs - 距上次tick的毫秒数
   * @returns 本次恢复的伤兵数量
   */
  tickPassiveHeal(deltaMs: number): number {
    if (this.state.woundedPool.totalWounded <= 0) return 0;
    if (deltaMs <= 0) return 0;

    // 被动恢复速率（每秒）
    const ratePerSecond = this.passiveHealRate();
    // 按时间比例计算恢复量
    const healFraction = ratePerSecond * (deltaMs / 1000);
    const healed = Math.max(0, Math.floor(this.state.woundedPool.totalWounded * healFraction));

    if (healed > 0) {
      this.removeWounded(healed);
    }

    return healed;
  }

  // ── 产出Buff ──

  /**
   * 获取当前产出加成
   *
   * 治疗后10分钟内+10%
   *
   * @returns 产出加成比例（0 或 0.1）
   */
  getProductionBuff(): number {
    if (this.state.buffEndTime > this.getNow()) {
      return PRODUCTION_BUFF_BONUS;
    }
    return 0;
  }

  /**
   * tick buff持续时间
   *
   * @param deltaMs - 距上次tick的毫秒数
   */
  tickBuff(deltaMs: number): void {
    // buff时间随tick推进（在非注入模式下由外部驱动时间）
    // 这里不做额外操作，因为buff判断基于getNow()
    // 此方法保留用于扩展（例如buff叠加等）
  }

  // ── 查询 ──

  /**
   * 获取伤兵池
   */
  getWoundedPool(): WoundedPool {
    return { ...this.state.woundedPool };
  }

  /**
   * 治疗是否在冷却中
   */
  isTreatmentOnCooldown(): boolean {
    return this.state.treatmentCooldownEnd > this.getNow();
  }

  /**
   * 获取医馆等级
   */
  getClinicLevel(): number {
    return this.clinicLevel;
  }

  // ── 序列化 ──

  /**
   * 序列化为JSON字符串
   */
  serialize(): string {
    const saveData: ClinicSaveData = {
      version: 1,
      state: {
        woundedPool: {
          totalWounded: this.state.woundedPool.totalWounded,
          woundedByType: { ...this.state.woundedPool.woundedByType },
        },
        treatmentCooldownEnd: this.state.treatmentCooldownEnd,
        buffEndTime: this.state.buffEndTime,
      },
      clinicLevel: this.clinicLevel,
    };
    return JSON.stringify(saveData);
  }

  /**
   * 从JSON字符串反序列化
   */
  deserialize(data: string): void {
    try {
      const saveData: ClinicSaveData = JSON.parse(data);
      if (saveData.version === 1 && saveData.state) {
        this.state = {
          woundedPool: {
            totalWounded: saveData.state.woundedPool.totalWounded,
            woundedByType: { ...saveData.state.woundedPool.woundedByType },
          },
          treatmentCooldownEnd: saveData.state.treatmentCooldownEnd,
          buffEndTime: saveData.state.buffEndTime,
        };
        this.clinicLevel = saveData.clinicLevel ?? 1;
      }
    } catch {
      // 反序列化失败时保持当前状态不变
    }
  }

  /**
   * 重置系统状态
   */
  reset(): void {
    this.clinicLevel = 1;
    this.getResource = null;
    this.spendResource = null;
    this.nowMs = Date.now();
    this.state = this.createInitialState();
  }

  // ── 内部方法 ──

  /**
   * 创建初始状态
   */
  private createInitialState(): ClinicState {
    return {
      woundedPool: {
        totalWounded: 0,
        woundedByType: {
          infantry: 0,
          cavalry: 0,
          archer: 0,
        },
      },
      treatmentCooldownEnd: 0,
      buffEndTime: 0,
    };
  }
}
