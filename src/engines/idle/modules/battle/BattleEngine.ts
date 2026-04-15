/**
 * BattleEngine — 战斗引擎框架核心（Phase 3）
 *
 * 战斗引擎的顶层协调器，管理战斗生命周期。
 * 支持多模式战斗（回合制、半回合制、自由战斗、攻城战、战棋、塔防、海战、格斗）。
 * 当前阶段实现基础回合调度，后续子任务会添加模式策略。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 事件驱动，支持 UI 层监听战斗事件
 * - 完整的存档/读档支持（含校验）
 * - 快速结算支持（跳过过程直接计算结果）
 *
 * @module engines/idle/modules/battle/BattleEngine
 */

// ============================================================
// 类型定义
// ============================================================

/** 战斗模式类型 */
export type BattleModeType =
  | 'turn-based' | 'semi-turn-based'
  | 'free-roam' | 'siege' | 'tactical'
  | 'tower-defense' | 'naval' | 'fighting';

/** 战斗单位定义 */
export interface BattleUnitDef {
  id: string;
  name: string;
  side: 'attacker' | 'defender';
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  critRate: number;
  critMultiplier: number;
  evasion: number;
  element?: string;
  skills?: BattleSkillDef[];
  position?: { x: number; y: number };
}

/** 技能定义 */
export interface BattleSkillDef {
  id: string;
  name: string;
  damage: number;
  targetMode: 'single' | 'aoe' | 'pierce' | 'all' | 'self';
  element?: string;
  cooldown: number;
  currentCooldown: number;
  effects?: BattleEffectDef[];
}

/** 效果定义 */
export interface BattleEffectDef {
  type: 'buff' | 'debuff';
  stat: string;
  value: number;
  durationMs: number;
}

/** 战斗配置 */
export interface BattleConfig {
  mode: BattleModeType;
  attackerUnits: BattleUnitDef[];
  defenderUnits: BattleUnitDef[];
  rewards?: Record<string, number>;
  maxTurns?: number;
  timeLimitMs?: number;
}

/** 战斗技能运行时 */
export interface BattleSkill {
  defId: string;
  name: string;
  damage: number;
  targetMode: 'single' | 'aoe' | 'pierce' | 'all' | 'self';
  element?: string;
  maxCooldown: number;
  currentCooldown: number;
  effects: BattleEffectDef[];
}

/** Buff 运行时 */
export interface BattleBuff {
  id: string;
  type: 'buff' | 'debuff';
  stat: string;
  value: number;
  remainingMs: number;
  sourceUnitId: string;
}

/** 战斗单位运行时状态 */
export interface BattleUnit {
  defId: string;
  instanceId: string;
  name: string;
  side: 'attacker' | 'defender';
  currentHp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  critRate: number;
  critMultiplier: number;
  evasion: number;
  element?: string;
  skills: BattleSkill[];
  buffs: BattleBuff[];
  isAlive: boolean;
  position: { x: number; y: number };
}

/** 伤害结果 */
export interface DamageResult {
  finalDamage: number;
  isCrit: boolean;
  isMiss: boolean;
  effectiveness: 'normal' | 'super' | 'weak';
}

/** 战斗统计 */
export interface BattleStats {
  totalDamageDealt: number;
  totalDamageTaken: number;
  turnsElapsed: number;
  unitsLost: number;
  unitsRemaining: number;
  critCount: number;
  missCount: number;
}

/** 战斗结果 */
export interface BattleResult {
  won: boolean;
  rewards: Record<string, number>;
  drops: Record<string, number>;
  mvp: string | null;
  duration: number;
  stats: BattleStats;
}

/** 战斗引擎状态 */
export type BattleEngineState = 'idle' | 'preparing' | 'running' | 'paused' | 'finished';

/** 战斗事件 */
export type BattleEngineEvent =
  | { type: 'battle_started'; data: { mode: BattleModeType; attackerCount: number; defenderCount: number } }
  | { type: 'battle_finished'; data: BattleResult }
  | { type: 'turn_started'; data: { turn: number; unitId: string; unitName: string } }
  | { type: 'unit_damaged'; data: { targetId: string; damage: number; isCrit: boolean; isMiss: boolean } }
  | { type: 'unit_healed'; data: { targetId: string; amount: number } }
  | { type: 'unit_died'; data: { unitId: string; unitName: string; side: string } }
  | { type: 'skill_used'; data: { unitId: string; skillName: string; targetIds: string[] } }
  | { type: 'buff_applied'; data: { targetId: string; buffType: string; stat: string } }
  | { type: 'buff_expired'; data: { targetId: string; buffId: string } }
  | { type: 'battle_paused'; data: Record<string, never> }
  | { type: 'battle_resumed'; data: Record<string, never> };

// ============================================================
// 辅助函数
// ============================================================

/** 深拷贝 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** 实例 ID 计数器 */
let instanceCounter = 0;

/** 生成唯一实例 ID */
function genInstanceId(defId: string): string {
  return `${defId}_${Date.now()}_${++instanceCounter}`;
}

/** 默认回合上限 */
const DEFAULT_MAX_TURNS = 30;

/** 回合间隔（毫秒），用于 update() 推进回合 */
const TURN_INTERVAL_MS = 1000;

// ============================================================
// BattleEngine 实现
// ============================================================

/**
 * 战斗引擎 — 顶层协调器，管理战斗生命周期
 *
 * @example
 * ```typescript
 * const engine = new BattleEngine();
 * engine.init({
 *   mode: 'turn-based',
 *   attackerUnits: [{ id: 'hero', name: '勇者', ... }],
 *   defenderUnits: [{ id: 'goblin', name: '哥布林', ... }],
 * });
 * engine.on((event) => console.log(event));
 * // 在游戏循环中调用
 * engine.update(deltaTime);
 * ```
 */
export class BattleEngine {
  /** 引擎状态 */
  private state: BattleEngineState = 'idle';
  /** 战斗模式 */
  private mode: BattleModeType = 'turn-based';
  /** 战斗配置 */
  private config: BattleConfig | null = null;
  /** 所有战斗单位 */
  private units: BattleUnit[] = [];
  /** 行动顺序（按速度降序排列的单位 instanceId 列表） */
  private turnOrder: string[] = [];
  /** 当前回合索引 */
  private currentTurnIndex = 0;
  /** 当前回合数 */
  private turnCount = 0;
  /** 回合上限 */
  private maxTurns = DEFAULT_MAX_TURNS;
  /** 回合计时器（毫秒） */
  private turnTimer = 0;
  /** 战斗开始时间戳 */
  private battleStartTime = 0;
  /** 战斗已用时间（毫秒） */
  private elapsedMs = 0;
  /** 时间限制（毫秒） */
  private timeLimitMs: number | null = null;
  /** 战斗奖励 */
  private rewards: Record<string, number> = {};
  /** 战斗结果 */
  private result: BattleResult | null = null;
  /** 战斗统计 */
  private stats: BattleStats = this.createEmptyStats();
  /** 事件监听器列表 */
  private readonly listeners: ((event: BattleEngineEvent) => void)[] = [];

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 创建战斗引擎实例
   */
  constructor() {
    // 引擎初始状态为 idle
  }

  /**
   * 初始化战斗（创建运行时单位、重置状态）
   *
   * @param config - 战斗配置
   */
  init(config: BattleConfig): void {
    this.reset();

    this.config = config;
    this.mode = config.mode;
    this.maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS;
    this.timeLimitMs = config.timeLimitMs ?? null;
    this.rewards = config.rewards ? { ...config.rewards } : {};
    this.state = 'preparing';

    // 创建运行时单位
    this.units = [
      ...config.attackerUnits.map((def) => this.createUnit(def)),
      ...config.defenderUnits.map((def) => this.createUnit(def)),
    ];

    // 生成行动顺序（按速度降序）
    this.turnOrder = this.units
      .filter((u) => u.isAlive)
      .sort((a, b) => b.speed - a.speed)
      .map((u) => u.instanceId);

    this.currentTurnIndex = 0;
    this.turnCount = 0;
    this.turnTimer = 0;
    this.elapsedMs = 0;
    this.battleStartTime = Date.now();
    this.stats = this.createEmptyStats();
    this.result = null;

    // 切换到运行状态
    this.state = 'running';

    this.emit({
      type: 'battle_started',
      data: {
        mode: this.mode,
        attackerCount: config.attackerUnits.length,
        defenderCount: config.defenderUnits.length,
      },
    });
  }

  // ============================================================
  // 每帧更新
  // ============================================================

  /**
   * 每帧更新（委托给当前模式）
   *
   * 基础实现：回合制调度，每 TURN_INTERVAL_MS 执行一个回合
   * 后续子任务会添加模式策略
   *
   * @param dt - 距上次更新的时间增量（毫秒）
   */
  update(dt: number): void {
    if (this.state !== 'running') return;

    this.elapsedMs += dt;

    // 检查时间限制
    if (this.timeLimitMs !== null && this.elapsedMs >= this.timeLimitMs) {
      this.finishBattle(false);
      return;
    }

    // 更新 Buff 倒计时
    this.updateBuffs(dt);

    // 回合调度
    this.turnTimer += dt;
    if (this.turnTimer >= TURN_INTERVAL_MS) {
      this.turnTimer -= TURN_INTERVAL_MS;
      this.executeTurn();
    }
  }

  // ============================================================
  // 快速结算
  // ============================================================

  /**
   * 快速结算（跳过战斗过程，直接计算结果）
   *
   * 使用简化公式：基于双方总攻击力/总血量计算胜率和结果
   *
   * @returns 战斗结果
   */
  quickSettle(): BattleResult {
    if (this.state === 'finished' && this.result) {
      return this.result;
    }

    // 如果尚未初始化，返回失败结果
    if (this.state === 'idle' || !this.config) {
      return {
        won: false,
        rewards: {},
        drops: {},
        mvp: null,
        duration: 0,
        stats: this.createEmptyStats(),
      };
    }

    // 计算双方总攻击力和总血量
    const attackerTotalAttack = this.units
      .filter((u) => u.side === 'attacker')
      .reduce((sum, u) => sum + u.attack, 0);
    const attackerTotalHp = this.units
      .filter((u) => u.side === 'attacker')
      .reduce((sum, u) => sum + u.maxHp, 0);
    const defenderTotalAttack = this.units
      .filter((u) => u.side === 'defender')
      .reduce((sum, u) => sum + u.attack, 0);
    const defenderTotalHp = this.units
      .filter((u) => u.side === 'defender')
      .reduce((sum, u) => sum + u.maxHp, 0);

    // 简化胜率公式
    const attackerPower = attackerTotalAttack * attackerTotalHp;
    const defenderPower = defenderTotalAttack * defenderTotalHp;
    const totalPower = attackerPower + defenderPower;
    const winRate = totalPower > 0 ? attackerPower / totalPower : 0.5;

    const won = Math.random() < winRate;

    // 模拟统计数据
    const duration = Math.floor(Math.random() * 30000) + 5000; // 5~35秒
    const turnsElapsed = Math.floor(Math.random() * this.maxTurns) + 1;

    // 计算 MVP（攻击力最高的存活单位）
    const aliveUnits = this.units.filter((u) => u.side === (won ? 'attacker' : 'defender'));
    const mvpUnit = aliveUnits.length > 0
      ? aliveUnits.reduce((best, u) => u.attack > best.attack ? u : best, aliveUnits[0])
      : null;

    this.stats = {
      totalDamageDealt: won ? defenderTotalHp : Math.floor(attackerTotalHp * 0.6),
      totalDamageTaken: won ? Math.floor(attackerTotalHp * 0.3) : attackerTotalHp,
      turnsElapsed,
      unitsLost: won ? 0 : this.units.filter((u) => u.side === 'attacker').length,
      unitsRemaining: won
        ? this.units.filter((u) => u.side === 'attacker').length
        : this.units.filter((u) => u.side === 'defender').length,
      critCount: Math.floor(Math.random() * 5),
      missCount: Math.floor(Math.random() * 3),
    };

    this.result = {
      won,
      rewards: won ? { ...this.rewards } : {},
      drops: won ? this.rollDrops() : {},
      mvp: mvpUnit?.instanceId ?? null,
      duration,
      stats: { ...this.stats },
    };

    this.state = 'finished';
    this.emit({ type: 'battle_finished', data: this.result });

    return this.result;
  }

  // ============================================================
  // 暂停 / 恢复
  // ============================================================

  /**
   * 暂停战斗
   */
  pause(): void {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.emit({ type: 'battle_paused', data: {} });
  }

  /**
   * 恢复战斗
   */
  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.emit({ type: 'battle_resumed', data: {} });
  }

  // ============================================================
  // 查询方法
  // ============================================================

  /**
   * 获取引擎状态
   */
  getState(): BattleEngineState {
    return this.state;
  }

  /**
   * 获取所有单位
   */
  getUnits(): BattleUnit[] {
    return this.units.map((u) => ({ ...u, skills: [...u.skills], buffs: [...u.buffs] }));
  }

  /**
   * 获取存活单位
   *
   * @param side - 可选，按阵营过滤
   */
  getAliveUnits(side?: 'attacker' | 'defender'): BattleUnit[] {
    return this.getUnits().filter(
      (u) => u.isAlive && (side === undefined || u.side === side),
    );
  }

  /**
   * 获取指定单位
   *
   * @param id - 单位 instanceId 或 defId
   */
  getUnit(id: string): BattleUnit | undefined {
    const unit = this.units.find((u) => u.instanceId === id || u.defId === id);
    return unit ? { ...unit, skills: [...unit.skills], buffs: [...unit.buffs] } : undefined;
  }

  /**
   * 获取战斗结果（结束后）
   */
  getResult(): BattleResult | null {
    return this.result ? { ...this.result, stats: { ...this.result.stats } } : null;
  }

  /**
   * 获取战斗统计
   */
  getStats(): BattleStats {
    return { ...this.stats };
  }

  // ============================================================
  // 存档 / 读档
  // ============================================================

  /**
   * 存档
   *
   * @returns 可序列化的状态数据
   */
  saveState(): Record<string, unknown> {
    return {
      state: this.state,
      mode: this.mode,
      config: this.config ? deepClone(this.config) : null,
      units: deepClone(this.units),
      turnOrder: [...this.turnOrder],
      currentTurnIndex: this.currentTurnIndex,
      turnCount: this.turnCount,
      maxTurns: this.maxTurns,
      turnTimer: this.turnTimer,
      battleStartTime: this.battleStartTime,
      elapsedMs: this.elapsedMs,
      timeLimitMs: this.timeLimitMs,
      rewards: { ...this.rewards },
      result: this.result ? deepClone(this.result) : null,
      stats: { ...this.stats },
    };
  }

  /**
   * 读档（含校验）
   *
   * @param data - 存档数据
   */
  loadState(data: Record<string, unknown>): void {
    if (!data || typeof data !== 'object') return;

    // state 校验
    const validStates: BattleEngineState[] = ['idle', 'preparing', 'running', 'paused', 'finished'];
    this.state = validStates.includes(data.state as BattleEngineState)
      ? (data.state as BattleEngineState)
      : 'idle';

    // mode 校验
    const validModes: BattleModeType[] = [
      'turn-based', 'semi-turn-based', 'free-roam', 'siege',
      'tactical', 'tower-defense', 'naval', 'fighting',
    ];
    this.mode = validModes.includes(data.mode as BattleModeType)
      ? (data.mode as BattleModeType)
      : 'turn-based';

    // config
    this.config = data.config && typeof data.config === 'object'
      ? (data.config as BattleConfig)
      : null;

    // units 校验
    this.units = Array.isArray(data.units)
      ? (data.units as unknown[]).filter(
          (u): u is Record<string, unknown> => typeof u === 'object' && u !== null,
        ).map((u) => this.deserializeUnit(u))
      : [];

    // turnOrder
    this.turnOrder = Array.isArray(data.turnOrder)
      ? (data.turnOrder as unknown[]).filter((id): id is string => typeof id === 'string')
      : [];

    // 基本数值字段
    this.currentTurnIndex = typeof data.currentTurnIndex === 'number'
      ? Math.max(0, Math.floor(data.currentTurnIndex)) : 0;
    this.turnCount = typeof data.turnCount === 'number'
      ? Math.max(0, Math.floor(data.turnCount)) : 0;
    this.maxTurns = typeof data.maxTurns === 'number'
      ? Math.max(1, Math.floor(data.maxTurns)) : DEFAULT_MAX_TURNS;
    this.turnTimer = typeof data.turnTimer === 'number'
      ? Math.max(0, data.turnTimer) : 0;
    this.battleStartTime = typeof data.battleStartTime === 'number'
      ? Math.max(0, data.battleStartTime) : 0;
    this.elapsedMs = typeof data.elapsedMs === 'number'
      ? Math.max(0, data.elapsedMs) : 0;
    this.timeLimitMs = typeof data.timeLimitMs === 'number'
      ? Math.max(0, data.timeLimitMs) : null;

    // rewards
    this.rewards = typeof data.rewards === 'object' && data.rewards !== null && !Array.isArray(data.rewards)
      ? Object.fromEntries(
          Object.entries(data.rewards as Record<string, unknown>).filter(
            ([, v]) => typeof v === 'number',
          ) as [string, number][],
        )
      : {};

    // result
    this.result = data.result && typeof data.result === 'object'
      ? (data.result as BattleResult)
      : null;

    // stats
    if (typeof data.stats === 'object' && data.stats !== null && !Array.isArray(data.stats)) {
      const s = data.stats as Record<string, unknown>;
      this.stats = {
        totalDamageDealt: typeof s.totalDamageDealt === 'number' ? Math.max(0, s.totalDamageDealt) : 0,
        totalDamageTaken: typeof s.totalDamageTaken === 'number' ? Math.max(0, s.totalDamageTaken) : 0,
        turnsElapsed: typeof s.turnsElapsed === 'number' ? Math.max(0, s.turnsElapsed) : 0,
        unitsLost: typeof s.unitsLost === 'number' ? Math.max(0, s.unitsLost) : 0,
        unitsRemaining: typeof s.unitsRemaining === 'number' ? Math.max(0, s.unitsRemaining) : 0,
        critCount: typeof s.critCount === 'number' ? Math.max(0, s.critCount) : 0,
        missCount: typeof s.missCount === 'number' ? Math.max(0, s.missCount) : 0,
      };
    } else {
      this.stats = this.createEmptyStats();
    }
  }

  // ============================================================
  // 重置
  // ============================================================

  /**
   * 重置引擎到初始状态
   */
  reset(): void {
    this.state = 'idle';
    this.mode = 'turn-based';
    this.config = null;
    this.units = [];
    this.turnOrder = [];
    this.currentTurnIndex = 0;
    this.turnCount = 0;
    this.maxTurns = DEFAULT_MAX_TURNS;
    this.turnTimer = 0;
    this.battleStartTime = 0;
    this.elapsedMs = 0;
    this.timeLimitMs = null;
    this.rewards = {};
    this.result = null;
    this.stats = this.createEmptyStats();
  }

  // ============================================================
  // 事件系统
  // ============================================================

  /**
   * 注册事件监听器
   *
   * @param handler - 事件处理回调
   */
  on(handler: (event: BattleEngineEvent) => void): void {
    this.listeners.push(handler);
  }

  /**
   * 注销事件监听器
   *
   * @param handler - 要移除的事件处理回调
   */
  off(handler: (event: BattleEngineEvent) => void): void {
    const idx = this.listeners.indexOf(handler);
    if (idx !== -1) {
      this.listeners.splice(idx, 1);
    }
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 创建空统计对象
   */
  private createEmptyStats(): BattleStats {
    return {
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      turnsElapsed: 0,
      unitsLost: 0,
      unitsRemaining: 0,
      critCount: 0,
      missCount: 0,
    };
  }

  /**
   * 从定义创建运行时单位
   */
  private createUnit(def: BattleUnitDef): BattleUnit {
    const isAlive = def.hp > 0;
    return {
      defId: def.id,
      instanceId: genInstanceId(def.id),
      name: def.name,
      side: def.side,
      currentHp: Math.max(0, def.hp),
      maxHp: def.maxHp,
      attack: def.attack,
      defense: def.defense,
      speed: def.speed,
      critRate: def.critRate,
      critMultiplier: def.critMultiplier,
      evasion: def.evasion,
      element: def.element,
      skills: (def.skills ?? []).map((s) => ({
        defId: s.id,
        name: s.name,
        damage: s.damage,
        targetMode: s.targetMode,
        element: s.element,
        maxCooldown: s.cooldown,
        currentCooldown: s.currentCooldown,
        effects: s.effects ? [...s.effects] : [],
      })),
      buffs: [],
      isAlive,
      position: def.position ? { ...def.position } : { x: 0, y: 0 },
    };
  }

  /**
   * 反序列化单位
   */
  private deserializeUnit(u: Record<string, unknown>): BattleUnit {
    return {
      defId: typeof u.defId === 'string' ? u.defId : '',
      instanceId: typeof u.instanceId === 'string' ? u.instanceId : '',
      name: typeof u.name === 'string' ? u.name : '',
      side: u.side === 'attacker' || u.side === 'defender' ? u.side : 'attacker',
      currentHp: typeof u.currentHp === 'number' ? Math.max(0, u.currentHp) : 0,
      maxHp: typeof u.maxHp === 'number' ? Math.max(1, u.maxHp) : 1,
      attack: typeof u.attack === 'number' ? Math.max(0, u.attack) : 0,
      defense: typeof u.defense === 'number' ? Math.max(0, u.defense) : 0,
      speed: typeof u.speed === 'number' ? Math.max(0, u.speed) : 0,
      critRate: typeof u.critRate === 'number' ? Math.min(1, Math.max(0, u.critRate)) : 0,
      critMultiplier: typeof u.critMultiplier === 'number' ? Math.max(1, u.critMultiplier) : 1.5,
      evasion: typeof u.evasion === 'number' ? Math.min(1, Math.max(0, u.evasion)) : 0,
      element: typeof u.element === 'string' ? u.element : undefined,
      skills: Array.isArray(u.skills)
        ? (u.skills as unknown[]).filter(
            (s): s is Record<string, unknown> => typeof s === 'object' && s !== null,
          ).map((s) => ({
            defId: typeof s.defId === 'string' ? s.defId : '',
            name: typeof s.name === 'string' ? s.name : '',
            damage: typeof s.damage === 'number' ? Math.max(0, s.damage) : 0,
            targetMode: ['single', 'aoe', 'pierce', 'all', 'self'].includes(s.targetMode as string)
              ? (s.targetMode as BattleSkill['targetMode']) : 'single',
            element: typeof s.element === 'string' ? s.element : undefined,
            maxCooldown: typeof s.maxCooldown === 'number' ? Math.max(0, s.maxCooldown) : 0,
            currentCooldown: typeof s.currentCooldown === 'number' ? Math.max(0, s.currentCooldown) : 0,
            effects: Array.isArray(s.effects) ? (s.effects as BattleEffectDef[]) : [],
          }))
        : [],
      buffs: Array.isArray(u.buffs)
        ? (u.buffs as unknown[]).filter(
            (b): b is Record<string, unknown> => typeof b === 'object' && b !== null,
          ).map((b) => ({
            id: typeof b.id === 'string' ? b.id : '',
            type: b.type === 'buff' || b.type === 'debuff' ? b.type : 'buff',
            stat: typeof b.stat === 'string' ? b.stat : '',
            value: typeof b.value === 'number' ? b.value : 0,
            remainingMs: typeof b.remainingMs === 'number' ? b.remainingMs : 0,
            sourceUnitId: typeof b.sourceUnitId === 'string' ? b.sourceUnitId : '',
          }))
        : [],
      isAlive: typeof u.isAlive === 'boolean' ? u.isAlive : true,
      position: typeof u.position === 'object' && u.position !== null
        ? {
            x: typeof (u.position as Record<string, unknown>).x === 'number'
              ? ((u.position as Record<string, unknown>).x as number) : 0,
            y: typeof (u.position as Record<string, unknown>).y === 'number'
              ? ((u.position as Record<string, unknown>).y as number) : 0,
          }
        : { x: 0, y: 0 },
    };
  }

  /**
   * 更新所有单位的 Buff 倒计时
   */
  private updateBuffs(dt: number): void {
    for (const unit of this.units) {
      if (!unit.isAlive) continue;
      for (const buff of unit.buffs) {
        buff.remainingMs -= dt;
      }
      const expiredBuffs = unit.buffs.filter((b) => b.remainingMs <= 0);
      unit.buffs = unit.buffs.filter((b) => b.remainingMs > 0);
      for (const expired of expiredBuffs) {
        this.emit({ type: 'buff_expired', data: { targetId: unit.instanceId, buffId: expired.id } });
      }
    }
  }

  /**
   * 执行一个回合
   */
  private executeTurn(): void {
    // 检查是否超过回合上限
    if (this.turnCount >= this.maxTurns) {
      this.finishBattle(false);
      return;
    }

    // 查找当前行动单位
    const actorId = this.turnOrder[this.currentTurnIndex];
    if (!actorId) {
      // 一轮结束，重新开始
      this.currentTurnIndex = 0;
      this.rebuildTurnOrder();
      if (this.turnOrder.length === 0) {
        this.finishBattle(false);
        return;
      }
      return;
    }

    const actor = this.units.find((u) => u.instanceId === actorId);
    if (!actor || !actor.isAlive) {
      // 跳过已死亡的单位
      this.advanceTurn();
      return;
    }

    this.turnCount++;
    this.stats.turnsElapsed = this.turnCount;

    this.emit({
      type: 'turn_started',
      data: { turn: this.turnCount, unitId: actor.instanceId, unitName: actor.name },
    });

    // 基础 AI：攻击对方阵营的随机存活单位
    const enemies = this.units.filter(
      (u) => u.isAlive && u.side !== actor.side,
    );
    if (enemies.length === 0) {
      // 一方全灭
      this.finishBattle(actor.side === 'attacker');
      return;
    }

    const target = enemies[Math.floor(Math.random() * enemies.length)];

    // 简单伤害计算（使用基础攻击）
    const baseDmg = Math.max(1, actor.attack - target.defense * 0.5);
    const isCrit = Math.random() < actor.critRate;
    const isMiss = Math.random() < target.evasion;
    const finalDmg = isMiss ? 0 : Math.floor(baseDmg * (isCrit ? actor.critMultiplier : 1));

    if (isMiss) {
      this.stats.missCount++;
    } else {
      target.currentHp = Math.max(0, target.currentHp - finalDmg);
      if (actor.side === 'attacker') {
        this.stats.totalDamageDealt += finalDmg;
      } else {
        this.stats.totalDamageTaken += finalDmg;
      }
      if (isCrit) {
        this.stats.critCount++;
      }
    }

    this.emit({
      type: 'unit_damaged',
      data: { targetId: target.instanceId, damage: finalDmg, isCrit, isMiss },
    });

    // 检查目标是否死亡
    if (target.currentHp <= 0) {
      target.isAlive = false;
      if (target.side === 'attacker') {
        this.stats.unitsLost++;
      }
      this.emit({
        type: 'unit_died',
        data: { unitId: target.instanceId, unitName: target.name, side: target.side },
      });

      // 检查胜负
      const attackerAlive = this.units.some((u) => u.isAlive && u.side === 'attacker');
      const defenderAlive = this.units.some((u) => u.isAlive && u.side === 'defender');

      if (!attackerAlive) {
        this.finishBattle(false);
        return;
      }
      if (!defenderAlive) {
        this.finishBattle(true);
        return;
      }
    }

    this.advanceTurn();
  }

  /**
   * 推进到下一个行动单位
   */
  private advanceTurn(): void {
    this.currentTurnIndex++;
    if (this.currentTurnIndex >= this.turnOrder.length) {
      this.currentTurnIndex = 0;
      this.rebuildTurnOrder();
    }
  }

  /**
   * 重建行动顺序（移除已死亡的单位）
   */
  private rebuildTurnOrder(): void {
    this.turnOrder = this.units
      .filter((u) => u.isAlive)
      .sort((a, b) => b.speed - a.speed)
      .map((u) => u.instanceId);
  }

  /**
   * 结束战斗
   */
  private finishBattle(won: boolean): void {
    this.state = 'finished';

    const attackerAlive = this.units.filter((u) => u.isAlive && u.side === 'attacker');
    const defenderAlive = this.units.filter((u) => u.isAlive && u.side === 'defender');
    const allAlive = won ? attackerAlive : defenderAlive;

    // MVP：存活单位中攻击力最高的
    const mvpUnit = allAlive.length > 0
      ? allAlive.reduce((best, u) => u.attack > best.attack ? u : best, allAlive[0])
      : null;

    this.stats.unitsRemaining = won
      ? attackerAlive.length
      : defenderAlive.length;

    this.result = {
      won,
      rewards: won ? { ...this.rewards } : {},
      drops: won ? this.rollDrops() : {},
      mvp: mvpUnit?.instanceId ?? null,
      duration: this.elapsedMs,
      stats: { ...this.stats },
    };

    this.emit({ type: 'battle_finished', data: this.result });
  }

  /**
   * 掷骰掉落
   */
  private rollDrops(): Record<string, number> {
    const drops: Record<string, number> = {};
    // 基于奖励的一定概率掉落
    for (const [key, amount] of Object.entries(this.rewards)) {
      if (Math.random() < 0.5) {
        drops[key] = Math.max(1, Math.floor(amount * 0.3));
      }
    }
    return drops;
  }

  /**
   * 内部事件发射
   */
  private emit(event: BattleEngineEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
