/**
 * 战斗系统 — 大招时停机制
 *
 * 职责：半自动模式下，检测大招就绪、暂停战斗、等待玩家确认释放
 * 来源：v4.0 CBT-3 大招时停机制
 *
 * 流程：
 * 1. 每个单位行动前检测怒气是否达到大招阈值
 * 2. 怒气满 → 触发时停 → 通知UI层暂停
 * 3. 玩家点击确认 → 释放大招 → 恢复战斗
 * 4. 玩家点击取消 → 使用普攻 → 恢复战斗
 *
 * @module engine/battle/UltimateSkillSystem
 */

import type {
  BattleSkill,
  BattleState,
  BattleUnit,
  IUltimateTimeStopHandler,
  UltimateReadyResult,
  UltimateTimeStopEvent,
} from './battle.types';
import { TimeStopState } from './battle.types';
import { BATTLE_CONFIG } from './battle-config';

// ─────────────────────────────────────────────
// 大招时停系统
// ─────────────────────────────────────────────

/**
 * 大招时停系统
 *
 * 管理半自动模式下的大招释放暂停机制。
 * 纯逻辑层，通过回调接口与UI层交互。
 *
 * @example
 * ```ts
 * const system = new UltimateSkillSystem();
 * system.registerHandler(myUIHandler);
 *
 * // 在单位行动前检测
 * const result = system.checkUltimateReady(unit);
 * if (result.isReady) {
 *   system.pauseForUltimate(unit, result.readyUnits[0].skills[0]);
 *   // 等待玩家确认...
 *   system.confirmUltimate(unitId, skillId);
 * }
 * ```
 */
export class UltimateSkillSystem {
  /** 当前时停状态 */
  private state: TimeStopState = TimeStopState.INACTIVE;

  /** UI事件处理器 */
  private handler: IUltimateTimeStopHandler | null = null;

  /** 当前暂停等待的单位ID */
  private pendingUnitId: string | null = null;

  /** 当前暂停等待的技能ID */
  private pendingSkillId: string | null = null;

  /** 是否启用时停（半自动模式为true） */
  private enabled: boolean = BATTLE_CONFIG.TIME_STOP_ENABLED_BY_DEFAULT;

  /** 超时定时器ID */
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  // ─────────────────────────────────────────
  // 公共API
  // ─────────────────────────────────────────

  /**
   * 注册UI事件处理器
   *
   * @param handler - 大招时停事件处理器
   */
  registerHandler(handler: IUltimateTimeStopHandler): void {
    this.handler = handler;
  }

  /**
   * 移除UI事件处理器
   */
  removeHandler(): void {
    this.handler = null;
  }

  /**
   * 设置是否启用时停
   *
   * @param enabled - 是否启用
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  /**
   * 检查是否启用时停
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 获取当前时停状态
   */
  getState(): TimeStopState {
    return this.state;
  }

  /**
   * 检测单位是否有大招就绪
   *
   * 条件：
   * - 怒气 ≥ 大招阈值（默认100）
   * - 有可用的主动技能（rageCost > 0）
   * - 技能不在冷却中
   *
   * @param unit - 要检测的战斗单位
   * @returns 就绪检测结果
   */
  checkUltimateReady(unit: BattleUnit): UltimateReadyResult {
    if (!this.enabled) {
      return { isReady: false, readyUnits: [] };
    }

    // 怒气未达到阈值
    if (unit.rage < BATTLE_CONFIG.ULTIMATE_RAGE_THRESHOLD) {
      return { isReady: false, readyUnits: [] };
    }

    // 查找可用大招
    const readySkills = unit.skills.filter(
      (skill) =>
        skill.type === 'active' &&
        skill.rageCost > 0 &&
        skill.currentCooldown === 0,
    );

    if (readySkills.length === 0) {
      return { isReady: false, readyUnits: [] };
    }

    return {
      isReady: true,
      readyUnits: [{ unit, skills: readySkills }],
    };
  }

  /**
   * 批量检测队伍中所有单位的大招就绪状态
   *
   * @param units - 要检测的单位列表
   * @returns 所有就绪的单位及其技能
   */
  checkTeamUltimateReady(units: BattleUnit[]): UltimateReadyResult {
    if (!this.enabled) {
      return { isReady: false, readyUnits: [] };
    }

    const readyUnits: UltimateReadyResult['readyUnits'] = [];

    for (const unit of units) {
      if (!unit.isAlive) continue;

      const result = this.checkUltimateReady(unit);
      if (result.isReady) {
        readyUnits.push(...result.readyUnits);
      }
    }

    return {
      isReady: readyUnits.length > 0,
      readyUnits,
    };
  }

  /**
   * 暂停战斗，等待玩家确认释放大招
   *
   * @param unit - 大招就绪的单位
   * @param skill - 要释放的技能
   */
  pauseForUltimate(unit: BattleUnit, skill: BattleSkill): void {
    if (!this.enabled) return;

    this.state = TimeStopState.ULTIMATE_READY;
    this.pendingUnitId = unit.id;
    this.pendingSkillId = skill.id;

    const event = this.createEvent('ultimate_ready', unit, skill);

    // 通知UI：大招就绪
    if (this.handler) {
      this.handler.onUltimateReady(event);
    }

    // 进入暂停状态
    this.state = TimeStopState.PAUSED;

    const pauseEvent = this.createEvent('battle_paused', unit, skill);
    if (this.handler) {
      this.handler.onBattlePaused(pauseEvent);
    }

    // 设置超时自动确认
    this.startTimeout(unit, skill);
  }

  /**
   * 玩家确认释放大招
   *
   * @param unitId - 释放大招的单位ID
   * @param skillId - 释放的技能ID
   * @returns 是否确认成功
   */
  confirmUltimate(unitId: string, skillId: string): boolean {
    if (this.state !== TimeStopState.PAUSED) {
      return false;
    }

    // 验证单位和技能匹配
    if (this.pendingUnitId !== unitId || this.pendingSkillId !== skillId) {
      return false;
    }

    this.clearTimeout();
    this.state = TimeStopState.CONFIRMED;

    // 通知UI：大招已确认
    if (this.handler && this.pendingUnitId) {
      const event: UltimateTimeStopEvent = {
        type: 'ultimate_confirmed',
        unitId,
        unitName: '', // 单位名称由调用方补充
        skill: {} as BattleSkill, // 技能由调用方补充
        state: this.state,
        timestamp: Date.now(),
      };
      this.handler.onUltimateConfirmed(event);
    }

    // 重置状态
    this.reset();
    return true;
  }

  /**
   * 玩家确认释放大招（带完整信息）
   *
   * @param unit - 释放单位
   * @param skill - 释放技能
   * @returns 是否确认成功
   */
  confirmUltimateWithInfo(unit: BattleUnit, skill: BattleSkill): boolean {
    if (this.state !== TimeStopState.PAUSED) {
      return false;
    }

    if (this.pendingUnitId !== unit.id || this.pendingSkillId !== skill.id) {
      return false;
    }

    this.clearTimeout();
    this.state = TimeStopState.CONFIRMED;

    if (this.handler) {
      const event = this.createEvent('ultimate_confirmed', unit, skill);
      this.handler.onUltimateConfirmed(event);
    }

    this.reset();
    return true;
  }

  /**
   * 玩家取消释放大招
   *
   * 取消后战斗继续，单位将使用普攻
   */
  cancelUltimate(): void {
    if (this.state !== TimeStopState.PAUSED) {
      return;
    }

    this.clearTimeout();

    if (this.handler && this.pendingUnitId) {
      const event: UltimateTimeStopEvent = {
        type: 'ultimate_cancelled',
        unitId: this.pendingUnitId,
        unitName: '',
        skill: {} as BattleSkill,
        state: TimeStopState.INACTIVE,
        timestamp: Date.now(),
      };
      this.handler.onUltimateCancelled(event);
    }

    this.reset();
  }

  /**
   * 判断当前是否处于暂停状态
   */
  isPaused(): boolean {
    return this.state === TimeStopState.PAUSED;
  }

  /**
   * 判断是否已确认释放大招
   */
  isConfirmed(): boolean {
    return this.state === TimeStopState.CONFIRMED;
  }

  /**
   * 获取当前等待确认的单位ID
   */
  getPendingUnitId(): string | null {
    return this.pendingUnitId;
  }

  /**
   * 获取当前等待确认的技能ID
   */
  getPendingSkillId(): string | null {
    return this.pendingSkillId;
  }

  /**
   * 重置时停系统状态
   */
  reset(): void {
    this.clearTimeout();
    this.state = TimeStopState.INACTIVE;
    this.pendingUnitId = null;
    this.pendingSkillId = null;
  }

  /**
   * 序列化时停状态（用于存档）
   */
  serialize(): {
    state: TimeStopState;
    enabled: boolean;
    pendingUnitId: string | null;
    pendingSkillId: string | null;
  } {
    return {
      state: this.state,
      enabled: this.enabled,
      pendingUnitId: this.pendingUnitId,
      pendingSkillId: this.pendingSkillId,
    };
  }

  /**
   * 从存档恢复时停状态
   */
  deserialize(data: ReturnType<typeof this.serialize>): void {
    this.state = data.state;
    this.enabled = data.enabled;
    this.pendingUnitId = data.pendingUnitId;
    this.pendingSkillId = data.pendingSkillId;
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /**
   * 创建时停事件
   */
  private createEvent(
    type: UltimateTimeStopEvent['type'],
    unit: BattleUnit,
    skill: BattleSkill,
  ): UltimateTimeStopEvent {
    return {
      type,
      unitId: unit.id,
      unitName: unit.name,
      skill,
      state: this.state,
      timestamp: Date.now(),
    };
  }

  /**
   * 启动超时定时器
   *
   * 超时后自动确认释放大招，避免战斗卡住
   */
  private startTimeout(unit: BattleUnit, skill: BattleSkill): void {
    this.clearTimeout();

    this.timeoutId = setTimeout(() => {
      if (this.state === TimeStopState.PAUSED) {
        this.confirmUltimateWithInfo(unit, skill);
      }
    }, BATTLE_CONFIG.TIME_STOP_TIMEOUT_MS);
  }

  /**
   * 清除超时定时器
   */
  private clearTimeout(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
