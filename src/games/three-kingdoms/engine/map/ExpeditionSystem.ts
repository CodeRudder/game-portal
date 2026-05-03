/**
 * 出征编队系统
 *
 * 管理出征编队的创建、校验、伤亡计算和将领受伤状态。
 * 出征编队用于攻城/资源占领，必须包含至少一个将领和士兵。
 *
 * @module engine/map/ExpeditionSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  ExpeditionForce,
  ExpeditionForceStatus,
  CreateExpeditionForceParams,
  ExpeditionValidationResult,
  ExpeditionErrorCode,
  CasualtyResult,
  InjuryLevel,
  ExpeditionSaveData,
} from './expedition-types';
import {
  CASUALTY_RATES,
  HERO_INJURY_RATES,
  INJURY_POWER_MULTIPLIER,
  INJURY_RECOVERY_TIME,
} from './expedition-types';

// ─────────────────────────────────────────────
// 配置常量
// ─────────────────────────────────────────────

/** 出征编队最大数量 */
const MAX_EXPEDITION_FORCES = 3;

/** 每个编队最少兵力 */
const MIN_TROOPS_PER_FORCE = 100;

/** 出征编队存档版本 */
const EXPEDITION_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 依赖接口
// ─────────────────────────────────────────────

/** 出征系统依赖 */
export interface ExpeditionDeps {
  /** 获取将领信息 */
  getHero: (heroId: string) => { id: string; name: string } | undefined;
  /** 获取可用兵力 */
  getAvailableTroops: () => number;
  /** 消耗兵力 */
  consumeTroops: (amount: number) => boolean;
  /** 检查将领是否在编队中 */
  isHeroInFormation: (heroId: string) => boolean;
}

// ─────────────────────────────────────────────
// 出征编队系统
// ─────────────────────────────────────────────

/**
 * 出征编队系统
 *
 * 管理出征编队的创建、校验、伤亡计算和将领受伤状态。
 */
export class ExpeditionSystem implements ISubsystem {
  readonly name = 'expedition';

  private deps!: ISystemDeps;
  private expeditionDeps: ExpeditionDeps | null = null;

  /** 出征编队列表 */
  private forces: Map<string, ExpeditionForce> = new Map();

  /** 将领受伤状态 (heroId -> InjuryLevel) */
  private heroInjuries: Map<string, InjuryLevel> = new Map();

  /** 将领受伤恢复时间 (heroId -> 恢复时间戳) */
  private heroInjuryRecovery: Map<string, number> = new Map();

  /** 编队ID计数器 */
  private nextForceId = 1;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.forces.clear();
    this.heroInjuries.clear();
    this.heroInjuryRecovery.clear();
    this.nextForceId = 1;
  }

  update(_dt: number): void {
    // 检查将领受伤恢复
    this.checkInjuryRecovery();
  }

  getState(): unknown {
    return this.serialize();
  }

  reset(): void {
    this.forces.clear();
    this.heroInjuries.clear();
    this.heroInjuryRecovery.clear();
    this.nextForceId = 1;
  }

  // ─── 依赖注入 ──────────────────────────────

  /** 设置出征系统依赖 */
  setExpeditionDeps(deps: ExpeditionDeps): void {
    this.expeditionDeps = deps;
  }

  // ─── 编队管理 ──────────────────────────────

  /**
   * 创建出征编队
   *
   * @param params 编队参数（将领ID + 士兵数量）
   * @returns 校验结果，成功时返回编队ID
   */
  createForce(params: CreateExpeditionForceParams): ExpeditionValidationResult & { forceId?: string } {
    // 校验将领
    if (!params.heroId) {
      return { valid: false, errorCode: 'HERO_REQUIRED', errorMessage: '必须选择一个将领' };
    }

    // 校验士兵
    if (!params.troops || params.troops <= 0) {
      return { valid: false, errorCode: 'TROOPS_REQUIRED', errorMessage: '必须分配士兵' };
    }

    if (params.troops < MIN_TROOPS_PER_FORCE) {
      return { valid: false, errorCode: 'INSUFFICIENT_TROOPS', errorMessage: `最少需要 ${MIN_TROOPS_PER_FORCE} 士兵` };
    }

    // 检查编队数量上限
    if (this.forces.size >= MAX_EXPEDITION_FORCES) {
      return { valid: false, errorCode: 'MAX_FORCES_REACHED', errorMessage: `最多只能创建 ${MAX_EXPEDITION_FORCES} 个出征编队` };
    }

    // 检查将领是否在其他编队中
    if (this.isHeroBusy(params.heroId)) {
      return { valid: false, errorCode: 'HERO_BUSY', errorMessage: '该将领已在其他出征编队中' };
    }

    // 检查将领是否受伤
    const injury = this.getHeroInjury(params.heroId);
    if (injury !== 'none') {
      return { valid: false, errorCode: 'HERO_INJURED', errorMessage: `该将领正在受伤恢复中（${this.getInjuryLabel(injury)}）` };
    }

    // 检查兵力是否充足
    if (this.expeditionDeps) {
      const available = this.expeditionDeps.getAvailableTroops();
      if (available < params.troops) {
        return { valid: false, errorCode: 'INSUFFICIENT_TROOPS', errorMessage: `兵力不足，需要 ${params.troops}，当前可用 ${available}` };
      }
    }

    // 创建编队
    const forceId = `exp-${this.nextForceId++}`;
    const force: ExpeditionForce = {
      id: forceId,
      heroId: params.heroId,
      troops: params.troops,
      status: 'ready',
    };

    this.forces.set(forceId, force);
    return { valid: true, forceId };
  }

  /**
   * 解散出征编队
   *
   * @param forceId 编队ID
   * @returns 是否成功解散
   */
  disbandForce(forceId: string): boolean {
    const force = this.forces.get(forceId);
    if (!force) return false;

    // 只有ready状态的编队才能解散
    if (force.status !== 'ready') {
      return false;
    }

    this.forces.delete(forceId);
    return true;
  }

  /**
   * 获取编队信息
   */
  getForce(forceId: string): ExpeditionForce | undefined {
    return this.forces.get(forceId);
  }

  /**
   * 获取所有编队
   */
  getAllForces(): ExpeditionForce[] {
    return Array.from(this.forces.values());
  }

  /**
   * 获取可用（ready状态）的编队
   */
  getReadyForces(): ExpeditionForce[] {
    return this.getAllForces().filter(f => f.status === 'ready');
  }

  /**
   * 设置编队状态
   */
  setForceStatus(forceId: string, status: ExpeditionForceStatus): boolean {
    const force = this.forces.get(forceId);
    if (!force) return false;
    force.status = status;
    return true;
  }

  // ─── 编队校验 ──────────────────────────────

  /**
   * 校验编队是否可以出征
   */
  validateForceForExpedition(forceId: string): ExpeditionValidationResult {
    const force = this.forces.get(forceId);
    if (!force) {
      return { valid: false, errorCode: 'FORCE_NOT_FOUND', errorMessage: '编队不存在' };
    }

    if (force.status !== 'ready') {
      return { valid: false, errorCode: 'FORCE_NOT_READY', errorMessage: '编队不在待命状态' };
    }

    // 检查将领是否受伤
    const injury = this.getHeroInjury(force.heroId);
    if (injury !== 'none') {
      return { valid: false, errorCode: 'HERO_INJURED', errorMessage: `将领正在受伤恢复中（${this.getInjuryLabel(injury)}）` };
    }

    return { valid: true };
  }

  /**
   * 检查将领是否在出征编队中
   */
  isHeroBusy(heroId: string): boolean {
    return Array.from(this.forces.values()).some(f => f.heroId === heroId);
  }

  // ─── 伤亡计算 ──────────────────────────────

  /**
   * 计算战斗伤亡
   *
   * @param forceId 编队ID
   * @param battleResult 战斗结果
   * @returns 伤亡结果
   */
  calculateCasualties(forceId: string, battleResult: 'victory' | 'defeat' | 'rout'): CasualtyResult | null {
    const force = this.forces.get(forceId);
    if (!force) return null;

    // 计算士兵伤亡
    const rate = CASUALTY_RATES[battleResult];
    const lossPercent = rate.min + Math.random() * (rate.max - rate.min);
    const troopsLost = Math.floor(force.troops * lossPercent);

    // 计算将领受伤
    const injuryConfig = HERO_INJURY_RATES[battleResult];
    const heroInjured = Math.random() < injuryConfig.probability;
    const injuryLevel = heroInjured ? injuryConfig.level : 'none';

    // 应用伤亡
    force.troops = Math.max(0, force.troops - troopsLost);

    // 应用将领受伤
    if (heroInjured) {
      this.applyHeroInjury(force.heroId, injuryLevel);
    }

    return {
      troopsLost,
      troopsLostPercent: lossPercent,
      heroInjured,
      injuryLevel,
      battleResult,
    };
  }

  /**
   * 获取将领受伤状态
   */
  getHeroInjury(heroId: string): InjuryLevel {
    return this.heroInjuries.get(heroId) || 'none';
  }

  /**
   * 获取将领战力倍率（考虑受伤）
   */
  getHeroPowerMultiplier(heroId: string): number {
    const injury = this.getHeroInjury(heroId);
    return INJURY_POWER_MULTIPLIER[injury];
  }

  /**
   * 应用将领受伤
   */
  private applyHeroInjury(heroId: string, level: InjuryLevel): void {
    if (level === 'none') return;

    this.heroInjuries.set(heroId, level);

    // 设置恢复时间
    const recoveryTime = INJURY_RECOVERY_TIME[level];
    this.heroInjuryRecovery.set(heroId, Date.now() + recoveryTime);
  }

  /**
   * 检查将领受伤恢复
   */
  private checkInjuryRecovery(): void {
    const now = Date.now();
    for (const [heroId, recoveryTime] of this.heroInjuryRecovery) {
      if (now >= recoveryTime) {
        this.heroInjuries.delete(heroId);
        this.heroInjuryRecovery.delete(heroId);
      }
    }
  }

  /**
   * 获取受伤等级标签
   */
  private getInjuryLabel(level: InjuryLevel): string {
    const labels: Record<InjuryLevel, string> = {
      none: '无',
      minor: '轻伤',
      moderate: '中伤',
      severe: '重伤',
    };
    return labels[level];
  }

  // ─── 序列化 ────────────────────────────────

  serialize(): ExpeditionSaveData {
    const forces: Record<string, ExpeditionForce> = {};
    for (const [id, force] of this.forces) {
      forces[id] = { ...force };
    }

    const heroInjuries: Record<string, InjuryLevel> = {};
    for (const [heroId, level] of this.heroInjuries) {
      heroInjuries[heroId] = level;
    }

    return {
      version: EXPEDITION_SAVE_VERSION,
      forces,
      heroInjuries,
    };
  }

  deserialize(data: ExpeditionSaveData): void {
    this.forces.clear();
    this.heroInjuries.clear();
    this.heroInjuryRecovery.clear();

    if (data.forces) {
      for (const [id, force] of Object.entries(data.forces)) {
        this.forces.set(id, force);
        // 更新ID计数器
        const match = id.match(/^exp-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= this.nextForceId) {
            this.nextForceId = num + 1;
          }
        }
      }
    }

    if (data.heroInjuries) {
      for (const [heroId, level] of Object.entries(data.heroInjuries)) {
        this.heroInjuries.set(heroId, level);
      }
    }
  }
}
