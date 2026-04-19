/**
 * 战斗系统 — 配置常量
 *
 * 集中管理战斗系统的所有可调参数，便于数值平衡调整。
 * 来源：CBT-3 战斗机制 PRD
 *
 * @module engine/battle/battle-config
 */

// ─────────────────────────────────────────────
// 战斗配置
// ─────────────────────────────────────────────

/** 战斗配置 */
export const BATTLE_CONFIG = {
  /** 最大回合数 */
  MAX_TURNS: 8,
  /** 最大队伍人数 */
  TEAM_SIZE: 6,
  /** 前排人数 */
  FRONT_ROW_SIZE: 3,
  /** 后排人数 */
  BACK_ROW_SIZE: 3,

  // ── 伤害计算 ──
  /** 暴击基础概率 */
  BASE_CRITICAL_RATE: 0.05,
  /** 速度对暴击率的贡献系数（速度/100） */
  SPEED_CRITICAL_COEFFICIENT: 100,
  /** 暴击伤害倍率 */
  CRITICAL_MULTIPLIER: 1.5,
  /** 最低伤害保底比例（攻击力×10%） */
  MIN_DAMAGE_RATIO: 0.1,
  /** 伤害随机波动下限 */
  RANDOM_FACTOR_MIN: 0.9,
  /** 伤害随机波动上限 */
  RANDOM_FACTOR_MAX: 1.1,

  // ── 克制系数 ──
  /** 克制系数（伤害+50%） */
  RESTRAINT_ADVANTAGE: 1.5,
  /** 被克制系数（伤害-30%） */
  RESTRAINT_DISADVANTAGE: 0.7,
  /** 无克制系数 */
  RESTRAINT_NEUTRAL: 1.0,

  // ── 怒气系统 ──
  /** 最大怒气值 */
  MAX_RAGE: 100,
  /** 普攻获得怒气 */
  RAGE_GAIN_ATTACK: 25,
  /** 受击获得怒气 */
  RAGE_GAIN_HIT: 15,
  /** 大招怒气消耗 */
  RAGE_COST_ULTIMATE: 100,

  // ── 状态效果 ──
  /** 灼烧伤害比例（最大HP%） */
  BURN_DAMAGE_RATIO: 0.05,
  /** 中毒伤害比例（最大HP%） */
  POISON_DAMAGE_RATIO: 0.03,
  /** 流血伤害比例（攻击力%） */
  BLEED_DAMAGE_RATIO: 0.10,

  // ── 星级评定 ──
  /** 二星要求存活人数 */
  STAR2_MIN_SURVIVORS: 4,
  /** 三星要求最大回合数 */
  STAR3_MAX_TURNS: 6,

  // ── 大招时停（v4.0） ──
  /** 大招怒气阈值（≥此值视为大招就绪） */
  ULTIMATE_RAGE_THRESHOLD: 100,
  /** 时停超时时间（ms），超时后自动释放大招 */
  TIME_STOP_TIMEOUT_MS: 30_000,
  /** 半自动模式默认启用时停 */
  TIME_STOP_ENABLED_BY_DEFAULT: true,

  // ── 战斗加速（v4.0） ──
  /** 默认战斗速度档位 */
  DEFAULT_BATTLE_SPEED: 1 as const,
  /** 可用速度档位列表 */
  AVAILABLE_SPEEDS: [1, 2, 4] as const,
  /** 基础回合间隔（ms），实际间隔 = 基础间隔 / 速度 */
  BASE_TURN_INTERVAL_MS: 1000,
  /** 4x速度时是否简化特效 */
  SIMPLIFY_EFFECTS_AT_X4: true,
} as const;
