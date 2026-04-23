/**
 * 战斗系统 — v4.0 扩展类型定义
 *
 * 包含大招时停机制、战斗加速系统、战斗模式等 v4.0 新增类型
 * 规则：只有 interface/type/enum/const，零运行时逻辑
 *
 * @module engine/battle/battle-ultimate.types
 */

import type {
  BattleSkill,
  BattleUnit,
} from './battle-base.types';
import type {
  IBattleEngine,
} from './battle.types';

// ─────────────────────────────────────────────
// 1. 大招时停机制
// ─────────────────────────────────────────────

/**
 * 大招时停状态
 *
 * 控制半自动模式下大招就绪时的暂停/恢复流程
 */
export enum TimeStopState {
  /** 未激活 — 战斗正常进行 */
  INACTIVE = 'INACTIVE',
  /** 大招就绪 — 检测到怒气满，等待玩家确认 */
  ULTIMATE_READY = 'ULTIMATE_READY',
  /** 时停中 — 战斗已暂停，等待玩家操作 */
  PAUSED = 'PAUSED',
  /** 玩家已确认 — 释放大招，战斗恢复 */
  CONFIRMED = 'CONFIRMED',
}

/**
 * 大招时停事件
 *
 * 用于通知UI层时停状态变化
 */
export interface UltimateTimeStopEvent {
  /** 事件类型 */
  type: 'ultimate_ready' | 'battle_paused' | 'ultimate_confirmed' | 'ultimate_cancelled';
  /** 触发事件的单位ID */
  unitId: string;
  /** 触发事件的单位名称 */
  unitName: string;
  /** 可释放的大招技能 */
  skill: BattleSkill;
  /** 当前时停状态 */
  state: TimeStopState;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 大招时停回调接口
 *
 * UI层实现此接口以响应时停事件
 */
export interface IUltimateTimeStopHandler {
  /** 大招就绪回调 — 通知UI有单位大招就绪 */
  onUltimateReady(event: UltimateTimeStopEvent): void;
  /** 战斗暂停回调 — 通知UI战斗已暂停 */
  onBattlePaused(event: UltimateTimeStopEvent): void;
  /** 大招确认回调 — 玩家确认释放大招 */
  onUltimateConfirmed(event: UltimateTimeStopEvent): void;
  /** 大招取消回调 — 玩家取消释放大招 */
  onUltimateCancelled(event: UltimateTimeStopEvent): void;
}

/**
 * 大招就绪检测结果
 */
export interface UltimateReadyResult {
  /** 是否有大招就绪 */
  isReady: boolean;
  /** 就绪的单位列表（可能有多个单位同时怒气满） */
  readyUnits: Array<{
    /** 单位 */
    unit: BattleUnit;
    /** 可释放的技能列表 */
    skills: BattleSkill[];
  }>;
}

// ─────────────────────────────────────────────
// 2. 战斗加速系统
// ─────────────────────────────────────────────

/**
 * 战斗速度档位
 */
export enum BattleSpeed {
  /** 正常速度 */
  X1 = 1,
  /** 2倍速 */
  X2 = 2,
  /** 4倍速 */
  X4 = 4,
}

/**
 * 战斗速度状态
 *
 * 管理战斗加速的完整状态
 */
export interface BattleSpeedState {
  /** 当前速度档位 */
  speed: BattleSpeed;
  /** 回合间隔缩放系数（1/speed） */
  turnIntervalScale: number;
  /** 动画速度缩放系数（speed倍） */
  animationSpeedScale: number;
  /** 是否简化特效（4x时简化） */
  simplifiedEffects: boolean;
}

/**
 * 战斗速度变更事件
 */
export interface SpeedChangeEvent {
  /** 变更前速度 */
  previousSpeed: BattleSpeed;
  /** 变更后速度 */
  newSpeed: BattleSpeed;
  /** 时间戳 */
  timestamp: number;
}

// ─────────────────────────────────────────────
// 3. 战斗模式
// ─────────────────────────────────────────────

/**
 * 战斗模式
 *
 * 控制战斗的自动化程度
 */
export enum BattleMode {
  /** 全自动 — 系统自动释放所有技能 */
  AUTO = 'AUTO',
  /** 半自动 — 普攻自动，大招需玩家确认（时停） */
  SEMI_AUTO = 'SEMI_AUTO',
  /** 手动 — 所有行动需玩家操作 */
  MANUAL = 'MANUAL',
}

/**
 * v4.0 扩展的战斗引擎接口
 *
 * 在 IBattleEngine 基础上增加大招时停和加速控制
 */
export interface IBattleEngineV4 extends IBattleEngine {
  /** 设置战斗模式 */
  setBattleMode(mode: BattleMode): void;
  /** 获取当前战斗模式 */
  getBattleMode(): BattleMode;
  /** 确认释放大招（半自动模式） */
  confirmUltimate(unitId: string, skillId: string): void;
  /** 取消大招释放（半自动模式） */
  cancelUltimate(): void;
  /** 设置战斗速度 */
  setSpeed(speed: BattleSpeed): void;
  /** 获取当前战斗速度状态 */
  getSpeedState(): BattleSpeedState;
  /** 注册大招时停事件处理器 */
  registerTimeStopHandler(handler: IUltimateTimeStopHandler): void;
}
