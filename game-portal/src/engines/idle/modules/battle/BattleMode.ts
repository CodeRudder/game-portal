/**
 * BattleMode — 战斗模式策略接口
 *
 * 定义所有战斗模式（回合制、ATB 等）必须实现的统一接口。
 * 每种模式通过 BattleModeContext 与引擎交互，
 * 引擎通过 IBattleMode 驱动模式的生命周期。
 *
 * @module engines/idle/modules/battle/BattleMode
 */

// ============================================================
// 类型依赖（来自 BattleEngine，此处前向声明）
// ============================================================

/** 战斗单位 */
export interface BattleUnit {
  id: string;
  name: string;
  side: 'attacker' | 'defender';
  currentHp: number;
  maxHp: number;
  stats: {
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    critRate: number;
    critMultiplier: number;
    evasion: number;
    accuracy: number;
  };
  skills: BattleSkill[];
  buffs: BattleBuff[];
  isAlive: boolean;
}

/** 战斗技能 */
export interface BattleSkill {
  id: string;
  name: string;
  targetting: 'single' | 'aoe' | 'self' | 'ally';
  damage?: number;
  healAmount?: number;
  cooldown: number;         // 冷却回合数（回合制）或冷却毫秒数（ATB）
  currentCooldown: number;  // 当前剩余冷却
  effects?: BattleSkillEffect[];
}

/** 技能附加效果 */
export interface BattleSkillEffect {
  type: 'buff' | 'debuff';
  stat: string;
  value: number;
  durationTurns: number;    // 持续回合数
}

/** 战斗 Buff */
export interface BattleBuff {
  id: string;
  sourceUnitId: string;
  type: 'buff' | 'debuff';
  stat: string;
  value: number;
  remainingTurns: number;
}

/** 战斗结果 */
export interface BattleResult {
  won: boolean;
  rewards: Record<string, number>;
  drops: Record<string, number>;
  mvp: string | null;
  durationMs: number;
  stats: BattleStats;
}

/** 战斗统计 */
export interface BattleStats {
  totalDamageDealt: number;
  totalDamageTaken: number;
  unitsLost: number;
  enemiesDefeated: number;
}

// ============================================================
// 伤害输出
// ============================================================

/** 伤害输出结果 */
export interface DamageOutput {
  damage: number;
  isCrit: boolean;
  isMiss: boolean;
}

// ============================================================
// 战斗模式事件
// ============================================================

/** 战斗模式事件类型 */
export type BattleModeEvent =
  | { type: 'turn_started'; data: { turn: number; unitId: string; unitName: string } }
  | { type: 'action_executed'; data: { unitId: string; action: string; targetIds?: string[] } }
  | { type: 'unit_damaged'; data: { targetId: string; damage: number; isCrit: boolean; isMiss: boolean } }
  | { type: 'unit_died'; data: { unitId: string; unitName: string; side: string } }
  | { type: 'skill_used'; data: { unitId: string; skillName: string; targetIds?: string[] } }
  | { type: 'combo_hit'; data: { attackerId: string; comboCount: number } }
  | { type: 'ultimate_triggered'; data: { unitId: string; skillName: string } }
  | { type: 'fighter_stunned'; data: { unitId: string; durationMs: number } }
  | { type: 'ko'; data: { unitId: string; unitName: string; side: string } };

// ============================================================
// 战斗模式上下文
// ============================================================

/**
 * 战斗模式上下文 — 模式可访问的引擎数据
 *
 * 通过此接口，模式可以读取/操作单位、造成伤害、
 * 管理 Buff、发射事件等，而无需直接引用引擎实例。
 */
export interface BattleModeContext {
  /** 所有战斗单位 */
  units: BattleUnit[];
  /** 获取指定单位 */
  getUnit(id: string): BattleUnit | undefined;
  /** 对目标造成伤害（经过伤害计算管道） */
  dealDamage(attackerId: string, targetId: string, skillDamage?: number): DamageOutput;
  /** 对目标治疗 */
  heal(targetId: string, amount: number): void;
  /** 添加 Buff */
  addBuff(targetId: string, buff: Omit<BattleBuff, 'sourceUnitId'>, sourceUnitId: string): void;
  /** 移除 Buff */
  removeBuff(targetId: string, buffId: string): void;
  /** 获取存活单位 */
  getAliveUnits(side?: 'attacker' | 'defender'): BattleUnit[];
  /** 发射事件 */
  emit(event: BattleModeEvent): void;
  /** 当前速度倍率 */
  speed: number;
}

// ============================================================
// 策略预设
// ============================================================

/** 普攻目标优先级策略 */
export type FocusTarget = 'lowest_hp' | 'highest_attack' | 'fastest';

/** 技能使用策略 */
export type SkillPriority = 'strongest' | 'weakest' | 'balanced';

/** 策略预设配置 */
export interface StrategyPreset {
  /** 普攻目标优先级 */
  focusTarget: FocusTarget;
  /** 技能使用策略 */
  skillPriority: SkillPriority;
  /** HP 低于此比例时优先防御/治疗（0~1） */
  defensiveThreshold: number;
}

/** 默认策略预设 */
export const DEFAULT_STRATEGY_PRESET: StrategyPreset = {
  focusTarget: 'lowest_hp',
  skillPriority: 'strongest',
  defensiveThreshold: 0.3,
};

// ============================================================
// 战斗模式策略接口
// ============================================================

/**
 * 战斗模式策略接口
 *
 * 每种战斗模式（回合制、ATB 等）必须实现此接口。
 * 引擎通过 init → update → checkWin/checkLose → settle 的
 * 生命周期驱动模式运行。
 */
export interface IBattleMode {
  /** 模式类型标识 */
  readonly type: string;

  /** 初始化模式（战斗开始时调用） */
  init(ctx: BattleModeContext): void;

  /** 每帧更新（由引擎主循环调用） */
  update(ctx: BattleModeContext, dt: number): void;

  /** 检查胜利条件 */
  checkWin(ctx: BattleModeContext): boolean;

  /** 检查失败条件 */
  checkLose(ctx: BattleModeContext): boolean;

  /** 结算战斗结果 */
  settle(ctx: BattleModeContext, durationMs: number): BattleResult;

  /** 获取模式特有状态（用于存档） */
  getState(): Record<string, unknown>;

  /** 恢复模式状态 */
  loadState(data: Record<string, unknown>): void;

  /** 重置模式到初始状态 */
  reset(): void;
}
