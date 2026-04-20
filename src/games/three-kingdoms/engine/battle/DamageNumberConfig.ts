/**
 * 战斗系统 — 伤害数字配置与类型定义
 *
 * 从 DamageNumberSystem.ts 拆分而出，包含：
 * - 伤害数字类型枚举
 * - 轨迹类型枚举
 * - 相关接口定义
 * - 默认轨迹/颜色/系统配置
 *
 * @module engine/battle/DamageNumberConfig
 */

// ─────────────────────────────────────────────
// 1. 伤害数字类型
// ─────────────────────────────────────────────

/** 伤害数字类型 */
export enum DamageNumberType {
  /** 普通伤害 */
  NORMAL = 'NORMAL',
  /** 暴击伤害 */
  CRITICAL = 'CRITICAL',
  /** 治疗 */
  HEAL = 'HEAL',
  /** 护盾吸收 */
  SHIELD = 'SHIELD',
  /** 持续伤害（DOT） */
  DOT = 'DOT',
  /** 闪避 */
  DODGE = 'DODGE',
  /** 免疫 */
  IMMUNE = 'IMMUNE',
}

// ─────────────────────────────────────────────
// 2. 轨迹配置
// ─────────────────────────────────────────────

/** 飘字运动轨迹类型 */
export enum TrajectoryType {
  /** 向上飘出（默认） */
  FLOAT_UP = 'FLOAT_UP',
  /** 抛物线 */
  PARABOLA = 'PARABOLA',
  /** 弹跳 */
  BOUNCE = 'BOUNCE',
  /** 放大后缩小（暴击专用） */
  ZOOM_FADE = 'ZOOM_FADE',
  /** 波浪 */
  WAVE = 'WAVE',
}

/** 轨迹配置 */
export interface TrajectoryConfig {
  /** 轨迹类型 */
  type: TrajectoryType;
  /** 初始 X 偏移（相对目标中心） */
  offsetX: number;
  /** 初始 Y 偏移（相对目标中心） */
  offsetY: number;
  /** 飘出速度（像素/秒） */
  speed: number;
  /** 持续时间（ms） */
  duration: number;
  /** X 方向振幅（波浪/抛物线用） */
  amplitudeX: number;
  /** Y 方向振幅 */
  amplitudeY: number;
  /** 字体缩放（1.0 = 正常） */
  scale: number;
  /** 重力加速度（抛物线用） */
  gravity: number;
}

/** 各类型默认轨迹配置 */
export const DEFAULT_TRAJECTORIES: Record<DamageNumberType, TrajectoryConfig> = {
  [DamageNumberType.NORMAL]: {
    type: TrajectoryType.FLOAT_UP,
    offsetX: 0, offsetY: 0, speed: 80, duration: 1000,
    amplitudeX: 0, amplitudeY: 60, scale: 1.0, gravity: 0,
  },
  [DamageNumberType.CRITICAL]: {
    type: TrajectoryType.ZOOM_FADE,
    offsetX: 0, offsetY: -10, speed: 100, duration: 1200,
    amplitudeX: 0, amplitudeY: 80, scale: 1.5, gravity: 0,
  },
  [DamageNumberType.HEAL]: {
    type: TrajectoryType.FLOAT_UP,
    offsetX: 0, offsetY: 0, speed: 60, duration: 1000,
    amplitudeX: 0, amplitudeY: 50, scale: 1.0, gravity: 0,
  },
  [DamageNumberType.SHIELD]: {
    type: TrajectoryType.BOUNCE,
    offsetX: 0, offsetY: 0, speed: 50, duration: 800,
    amplitudeX: 0, amplitudeY: 30, scale: 0.9, gravity: 0.5,
  },
  [DamageNumberType.DOT]: {
    type: TrajectoryType.FLOAT_UP,
    offsetX: 10, offsetY: 0, speed: 40, duration: 800,
    amplitudeX: 0, amplitudeY: 40, scale: 0.8, gravity: 0,
  },
  [DamageNumberType.DODGE]: {
    type: TrajectoryType.WAVE,
    offsetX: 0, offsetY: 0, speed: 30, duration: 600,
    amplitudeX: 20, amplitudeY: 10, scale: 0.9, gravity: 0,
  },
  [DamageNumberType.IMMUNE]: {
    type: TrajectoryType.BOUNCE,
    offsetX: 0, offsetY: 0, speed: 20, duration: 500,
    amplitudeX: 0, amplitudeY: 15, scale: 0.8, gravity: 0,
  },
};

// ─────────────────────────────────────────────
// 3. 伤害数字实例
// ─────────────────────────────────────────────

/** 单个伤害数字实例 */
export interface DamageNumber {
  /** 唯一 ID */
  id: string;
  /** 数字类型 */
  type: DamageNumberType;
  /** 显示的数值 */
  value: number;
  /** 显示文本（如 "-100", "+50", "闪避"） */
  text: string;
  /** 目标单位 ID */
  targetUnitId: string;
  /** 轨迹配置 */
  trajectory: TrajectoryConfig;
  /** 创建时间戳（ms） */
  createdAt: number;
  /** 颜色（十六进制） */
  color: string;
  /** 是否已合并 */
  merged: boolean;
  /** 合并来源 ID 列表 */
  mergedFrom: string[];
}

/** 合并后的伤害数字 */
export interface MergedDamageNumber extends DamageNumber {
  /** 合并的总值 */
  mergedValue: number;
  /** 合并的数字数量 */
  mergeCount: number;
}

// ─────────────────────────────────────────────
// 4. 颜色配置
// ─────────────────────────────────────────────

/** 各类型默认颜色 */
export const DAMAGE_NUMBER_COLORS: Record<DamageNumberType, string> = {
  [DamageNumberType.NORMAL]: '#FFFFFF',
  [DamageNumberType.CRITICAL]: '#FF4500',
  [DamageNumberType.HEAL]: '#00FF7F',
  [DamageNumberType.SHIELD]: '#4169E1',
  [DamageNumberType.DOT]: '#FF6347',
  [DamageNumberType.DODGE]: '#C0C0C0',
  [DamageNumberType.IMMUNE]: '#FFD700',
};

// ─────────────────────────────────────────────
// 5. 系统配置
// ─────────────────────────────────────────────

/** 伤害数字系统配置 */
export interface DamageNumberConfig {
  /** 合并时间窗口（ms），同一目标在窗口内的同类数字合并 */
  mergeWindowMs: number;
  /** 最大同屏数字数量 */
  maxActiveNumbers: number;
  /** 是否启用合并 */
  enableMerge: boolean;
  /** 数字消失前的淡出时间（ms） */
  fadeOutDuration: number;
  /** 自定义轨迹覆盖 */
  trajectoryOverrides: Partial<Record<DamageNumberType, Partial<TrajectoryConfig>>>;
  /** 自定义颜色覆盖 */
  colorOverrides: Partial<Record<DamageNumberType, string>>;
}

/** 默认配置 */
export const DEFAULT_CONFIG: DamageNumberConfig = {
  mergeWindowMs: 200,
  maxActiveNumbers: 30,
  enableMerge: true,
  fadeOutDuration: 300,
  trajectoryOverrides: {},
  colorOverrides: {},
};
