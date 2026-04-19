/**
 * FightingMode — 即时对战（格斗）模式
 *
 * 参考拳皇/街霸/火影忍者究极风暴的简化放置模式：
 * - 1v1 或小队 vs 小队（最多 3v3）
 * - 实时战斗，无回合
 * - 每个角色有：普通攻击、重攻击、特殊技能、防御、闪避、必杀技
 * - 能量条：攻击/受击积累，满后可释放必杀技
 * - 连击系统：连续命中增加伤害倍率
 * - AI 自动控制（策略预设决定攻防倾向）
 * - 闪避系统：短暂无敌帧
 * - 眩晕系统：必杀技或重攻击可能造成眩晕
 * - KO 和换人：角色被 KO 后切换到下一个队友
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 连击倍率公式：1 + comboCount * comboMultiplier
 * - AI 决策基于策略预设的概率分布
 * - 闪避提供短暂无敌帧（dodgeDurationMs）
 * - 防御减少 blockReduction 比例的伤害
 *
 * @module engines/idle/modules/battle/FightingMode
 */

import type {
  IBattleMode,
  BattleModeContext,
  BattleResult,
  BattleUnit,
} from './BattleMode';

// ============================================================
// 类型定义
// ============================================================

/** 格斗角色扩展属性 */
export interface FighterExtension {
  /** 能量值 0-100 */
  energy: number;
  /** 最大能量 */
  maxEnergy: number;
  /** 当前连击数 */
  comboCount: number;
  /** 连击计时器（毫秒） */
  comboTimer: number;
  /** 连击最大间隔，默认 2000ms */
  maxComboTime: number;
  /** 是否正在防御 */
  isBlocking: boolean;
  /** 是否正在闪避 */
  isDodging: boolean;
  /** 闪避冷却（毫秒） */
  dodgeCooldown: number;
  /** 上次闪避时间 */
  lastDodgeTime: number;
  /** 攻击冷却（毫秒） */
  attackCooldown: number;
  /** 上次攻击时间 */
  lastAttackTime: number;
  /** 重攻击冷却（毫秒） */
  heavyAttackCooldown: number;
  /** 上次重攻击时间 */
  lastHeavyAttackTime: number;
  /** 无敌剩余时间（毫秒） */
  invincibleMs: number;
  /** 眩晕剩余时间（毫秒） */
  stunMs: number;
}

/** 格斗配置 */
export interface FightingConfig {
  /** 每队最大人数，默认 3 */
  maxTeamSize: number;
  /** 战场宽度 */
  stageWidth: number;
  /** 战场高度 */
  stageHeight: number;
  /** 命中获得能量，默认 8 */
  energyGainOnHit: number;
  /** 受击获得能量，默认 5 */
  energyGainOnHurt: number;
  /** 必杀技消耗能量，默认 100 */
  ultimateCost: number;
  /** 连击每层伤害加成，默认 0.1（10%） */
  comboMultiplier: number;
  /** 防御减伤比例，默认 0.7（减70%） */
  blockReduction: number;
  /** 闪避无敌时间，默认 300ms */
  dodgeDurationMs: number;
  /** 闪避冷却，默认 1500ms */
  dodgeCooldownMs: number;
  /** 轻攻击冷却，默认 500ms */
  lightAttackCooldownMs: number;
  /** 重攻击冷却，默认 1000ms */
  heavyAttackCooldownMs: number;
  /** 技能冷却，默认 2000ms */
  skillCooldownMs: number;
  /** 技能消耗能量，默认 30 */
  skillEnergyCost: number;
  /** 轻攻击伤害倍率，默认 1.0 */
  lightAttackMultiplier: number;
  /** 重攻击伤害倍率，默认 1.8 */
  heavyAttackMultiplier: number;
  /** 技能伤害倍率，默认 2.5 */
  skillMultiplier: number;
  /** 必杀技伤害倍率，默认 4.0 */
  ultimateMultiplier: number;
  /** 重攻击眩晕时间，默认 300ms */
  heavyStunMs: number;
  /** 必杀技眩晕时间，默认 800ms */
  ultimateStunMs: number;
  /** 连击最大间隔，默认 2000ms */
  maxComboTime: number;
  /** 最大连击倍率上限，默认 3.0 */
  maxComboMultiplierCap: number;
  /** 时间限制（毫秒），默认 120000（2分钟） */
  timeLimitMs: number;
  /** AI 决策间隔（毫秒），默认 200ms */
  aiDecisionIntervalMs: number;
}

/** 格斗动作类型 */
export type FightAction = 'light_attack' | 'heavy_attack' | 'skill' | 'block' | 'dodge' | 'ultimate';

/** 格斗事件 */
export type FightingEvent =
  | { type: 'action_executed'; data: { unitId: string; action: FightAction } }
  | { type: 'combo_hit'; data: { attackerId: string; comboCount: number } }
  | { type: 'ultimate_triggered'; data: { unitId: string; skillName: string } }
  | { type: 'fighter_stunned'; data: { unitId: string; durationMs: number } }
  | { type: 'ko'; data: { unitId: string; unitName: string; side: string } };

/** AI 策略类型 */
export type AIStrategy = 'aggressive' | 'defensive' | 'balanced';

/** 格斗模式内部状态 */
export interface FightingState {
  /** 当前阶段 */
  phase: 'running' | 'finished';
  /** 已用时间（毫秒） */
  elapsedMs: number;
  /** 时间限制（毫秒） */
  timeLimitMs: number;
  /** 格斗角色扩展属性 */
  fighters: Map<string, FighterExtension>;
  /** 当前出场的角色索引 */
  activeFighterIndex: { attacker: number; defender: number };
  /** KO 顺序 */
  koOrder: string[];
  /** 上次 AI 决策时间 */
  lastAiDecisionTime: number;
  /** 累计伤害统计 */
  totalDamageDealt: number;
  totalDamageTaken: number;
  unitsLost: number;
  enemiesDefeated: number;
}

// ============================================================
// 默认配置
// ============================================================

/** 默认格斗配置 */
const DEFAULT_FIGHTING_CONFIG: FightingConfig = {
  maxTeamSize: 3,
  stageWidth: 800,
  stageHeight: 400,
  energyGainOnHit: 8,
  energyGainOnHurt: 5,
  ultimateCost: 100,
  comboMultiplier: 0.1,
  blockReduction: 0.7,
  dodgeDurationMs: 300,
  dodgeCooldownMs: 1500,
  lightAttackCooldownMs: 500,
  heavyAttackCooldownMs: 1000,
  skillCooldownMs: 2000,
  skillEnergyCost: 30,
  lightAttackMultiplier: 1.0,
  heavyAttackMultiplier: 1.8,
  skillMultiplier: 2.5,
  ultimateMultiplier: 4.0,
  heavyStunMs: 300,
  ultimateStunMs: 800,
  maxComboTime: 2000,
  maxComboMultiplierCap: 3.0,
  timeLimitMs: 120000,
  aiDecisionIntervalMs: 200,
};

/** AI 策略概率分布 */
const AI_STRATEGY_WEIGHTS: Record<AIStrategy, { attack: number; block: number; dodge: number; skill: number }> = {
  aggressive: { attack: 0.7, block: 0.1, dodge: 0.1, skill: 0.1 },
  defensive: { attack: 0.3, block: 0.4, dodge: 0.2, skill: 0.1 },
  balanced: { attack: 0.4, block: 0.2, dodge: 0.2, skill: 0.2 },
};

// ============================================================
// FightingMode 实现
// ============================================================

/**
 * 即时对战（格斗）模式
 *
 * 实现街霸/拳皇风格的简化放置战斗：
 * 1. 每帧更新所有角色的冷却、连击衰减、眩晕计时、无敌时间
 * 2. 按 AI 决策间隔执行动作选择
 * 3. 攻击命中后累积能量和连击数
 * 4. 能量满时自动释放必杀技
 * 5. 被攻击时防御减伤或闪避无敌
 * 6. 角色 KO 后自动换人
 *
 * @example
 * ```typescript
 * const mode = new FightingMode({ maxTeamSize: 3 });
 * mode.init(ctx);
 * // 在游戏循环中
 * mode.update(ctx, 16);
 * ```
 */
export class FightingMode implements IBattleMode {
  readonly type = 'fighting';

  /** 格斗配置 */
  private readonly config: FightingConfig;

  /** 内部状态 */
  private state: FightingState;

  /** AI 策略预设 */
  private strategy: AIStrategy = 'balanced';

  // ============================================================
  // 构造函数
  // ============================================================

  /**
   * 创建即时对战模式
   *
   * @param config - 可选配置覆盖
   */
  constructor(config?: Partial<FightingConfig>) {
    this.config = { ...DEFAULT_FIGHTING_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  // ============================================================
  // 生命周期（IBattleMode 接口）
  // ============================================================

  /**
   * 初始化模式 — 从 BattleUnit 列表创建格斗角色扩展属性
   */
  init(ctx: BattleModeContext): void {
    this.state = this.createInitialState();

    const aliveUnits = ctx.units.filter((u) => u.isAlive);

    for (const unit of aliveUnits) {
      this.state.fighters.set(unit.id, this.createFighterExtension());
    }

    this.state.phase = 'running';
  }

  /**
   * 每帧更新 — AI 决策、动作执行、冷却更新、连击计时、能量积累、KO/换人
   *
   * @param ctx - 战斗模式上下文
   * @param dt  - 距上次更新的时间增量（毫秒）
   */
  update(ctx: BattleModeContext, dt: number): void {
    if (this.state.phase === 'finished') return;

    // 应用速度倍率
    const scaledDt = dt * ctx.speed;

    // 累计时间
    this.state.elapsedMs += scaledDt;

    // 检查时间限制
    if (this.state.elapsedMs >= this.state.timeLimitMs) {
      this.state.phase = 'finished';
      return;
    }

    // 检查胜负
    if (this.checkWin(ctx) || this.checkLose(ctx)) {
      this.state.phase = 'finished';
      return;
    }

    // 更新所有存活角色的状态
    this.updateFighterStates(ctx, scaledDt);

    // AI 决策
    if (this.state.elapsedMs - this.state.lastAiDecisionTime >= this.config.aiDecisionIntervalMs) {
      this.state.lastAiDecisionTime = this.state.elapsedMs;
      this.executeAiDecisions(ctx);
    }

    // 同步死亡状态
    this.syncKO(ctx);
  }

  /**
   * 检查胜利条件 — 所有防守方角色死亡
   */
  checkWin(ctx: BattleModeContext): boolean {
    return ctx.getAliveUnits('defender').length === 0;
  }

  /**
   * 检查失败条件 — 所有攻击方角色死亡
   */
  checkLose(ctx: BattleModeContext): boolean {
    return ctx.getAliveUnits('attacker').length === 0;
  }

  /**
   * 结算战斗结果
   *
   * @param ctx        - 战斗模式上下文
   * @param durationMs - 战斗持续时间
   */
  settle(ctx: BattleModeContext, durationMs: number): BattleResult {
    const won = this.checkWin(ctx);

    // 计算 MVP：存活单位中攻击力最高的
    const alive = ctx.getAliveUnits(won ? 'attacker' : 'defender');
    const mvp = alive.length > 0
      ? alive.reduce((best, u) => u.stats.attack > best.stats.attack ? u : best, alive[0])
      : null;

    return {
      won,
      rewards: {},
      drops: {},
      mvp: mvp?.id ?? null,
      durationMs,
      stats: {
        totalDamageDealt: this.state.totalDamageDealt,
        totalDamageTaken: this.state.totalDamageTaken,
        unitsLost: this.state.unitsLost,
        enemiesDefeated: this.state.enemiesDefeated,
      },
    };
  }

  /**
   * 获取模式状态（用于存档）
   */
  getState(): Record<string, unknown> {
    return {
      phase: this.state.phase,
      elapsedMs: this.state.elapsedMs,
      timeLimitMs: this.state.timeLimitMs,
      activeFighterIndex: { ...this.state.activeFighterIndex },
      koOrder: [...this.state.koOrder],
      lastAiDecisionTime: this.state.lastAiDecisionTime,
      totalDamageDealt: this.state.totalDamageDealt,
      totalDamageTaken: this.state.totalDamageTaken,
      unitsLost: this.state.unitsLost,
      enemiesDefeated: this.state.enemiesDefeated,
      fighters: this.serializeFighterMap(this.state.fighters),
    };
  }

  /**
   * 恢复模式状态
   */
  loadState(data: Record<string, unknown>): void {
    if (!data || typeof data !== 'object') return;

    this.state.phase = data.phase === 'finished' ? 'finished' : 'running';
    this.state.elapsedMs = typeof data.elapsedMs === 'number' ? Math.max(0, data.elapsedMs) : 0;
    this.state.timeLimitMs = typeof data.timeLimitMs === 'number' ? Math.max(0, data.timeLimitMs) : this.config.timeLimitMs;
    this.state.lastAiDecisionTime = typeof data.lastAiDecisionTime === 'number' ? Math.max(0, data.lastAiDecisionTime) : 0;
    this.state.totalDamageDealt = typeof data.totalDamageDealt === 'number' ? Math.max(0, data.totalDamageDealt) : 0;
    this.state.totalDamageTaken = typeof data.totalDamageTaken === 'number' ? Math.max(0, data.totalDamageTaken) : 0;
    this.state.unitsLost = typeof data.unitsLost === 'number' ? Math.max(0, data.unitsLost) : 0;
    this.state.enemiesDefeated = typeof data.enemiesDefeated === 'number' ? Math.max(0, data.enemiesDefeated) : 0;

    // 恢复 activeFighterIndex
    if (typeof data.activeFighterIndex === 'object' && data.activeFighterIndex !== null) {
      const idx = data.activeFighterIndex as Record<string, unknown>;
      this.state.activeFighterIndex = {
        attacker: typeof idx.attacker === 'number' ? Math.max(0, Math.floor(idx.attacker)) : 0,
        defender: typeof idx.defender === 'number' ? Math.max(0, Math.floor(idx.defender)) : 0,
      };
    }

    // 恢复 KO 顺序
    this.state.koOrder = Array.isArray(data.koOrder)
      ? (data.koOrder as unknown[]).filter((id): id is string => typeof id === 'string')
      : [];

    // 恢复格斗角色扩展属性
    this.state.fighters = this.deserializeFighterMap(data.fighters);
  }

  /**
   * 重置模式到初始状态
   */
  reset(): void {
    this.state = this.createInitialState();
  }

  // ============================================================
  // 公开访问器
  // ============================================================

  /**
   * 获取格斗角色扩展属性
   */
  getFighterExtension(unitId: string): FighterExtension | undefined {
    return this.state.fighters.get(unitId);
  }

  /**
   * 获取连击数
   */
  getComboCount(unitId: string): number {
    return this.state.fighters.get(unitId)?.comboCount ?? 0;
  }

  /**
   * 获取能量信息
   */
  getEnergy(unitId: string): { current: number; max: number } {
    const ext = this.state.fighters.get(unitId);
    if (!ext) return { current: 0, max: this.config.ultimateCost };
    return { current: ext.energy, max: ext.maxEnergy };
  }

  /**
   * 是否可以使用必杀技
   */
  canUseUltimate(unitId: string): boolean {
    const ext = this.state.fighters.get(unitId);
    return ext !== undefined && ext.energy >= this.config.ultimateCost;
  }

  /**
   * 获取当前出场的角色
   *
   * @param ctx - 可选上下文，不传时返回 undefined
   */
  getActiveFighters(ctx?: BattleModeContext): { attacker: BattleUnit | undefined; defender: BattleUnit | undefined } {
    return {
      attacker: this.getActiveFighterForSide('attacker', ctx),
      defender: this.getActiveFighterForSide('defender', ctx),
    };
  }

  /**
   * 获取 KO 顺序
   */
  getKOOrder(): string[] {
    return [...this.state.koOrder];
  }

  /** 获取已用时间 */
  get elapsedMs(): number {
    return this.state.elapsedMs;
  }

  /** 获取当前阶段 */
  get phase(): string {
    return this.state.phase;
  }

  /** 获取配置 */
  getConfig(): FightingConfig {
    return { ...this.config };
  }

  /** 获取内部状态 */
  get internalState(): FightingState {
    return this.state;
  }

  /**
   * 设置 AI 策略
   */
  setStrategy(strategy: AIStrategy): void {
    this.strategy = strategy;
  }

  /**
   * 获取 AI 策略
   */
  getStrategy(): AIStrategy {
    return this.strategy;
  }

  // ============================================================
  // 私有方法 — 初始化
  // ============================================================

  /**
   * 创建初始状态
   */
  private createInitialState(): FightingState {
    return {
      phase: 'running',
      elapsedMs: 0,
      timeLimitMs: this.config.timeLimitMs,
      fighters: new Map(),
      activeFighterIndex: { attacker: 0, defender: 0 },
      koOrder: [],
      lastAiDecisionTime: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      unitsLost: 0,
      enemiesDefeated: 0,
    };
  }

  /**
   * 创建格斗角色扩展属性
   */
  private createFighterExtension(): FighterExtension {
    return {
      energy: 0,
      maxEnergy: this.config.ultimateCost,
      comboCount: 0,
      comboTimer: 0,
      maxComboTime: this.config.maxComboTime,
      isBlocking: false,
      isDodging: false,
      dodgeCooldown: 0,
      lastDodgeTime: -Infinity,
      attackCooldown: 0,
      lastAttackTime: -Infinity,
      heavyAttackCooldown: 0,
      lastHeavyAttackTime: -Infinity,
      invincibleMs: 0,
      stunMs: 0,
    };
  }

  // ============================================================
  // 私有方法 — 状态更新
  // ============================================================

  /**
   * 更新所有存活角色的状态
   */
  private updateFighterStates(ctx: BattleModeContext, dt: number): void {
    for (const unit of ctx.units) {
      if (!unit.isAlive) continue;

      const ext = this.state.fighters.get(unit.id);
      if (!ext) continue;

      // 更新眩晕时间
      if (ext.stunMs > 0) {
        ext.stunMs = Math.max(0, ext.stunMs - dt);
      }

      // 更新无敌时间
      if (ext.invincibleMs > 0) {
        ext.invincibleMs = Math.max(0, ext.invincibleMs - dt);
        if (ext.invincibleMs <= 0) {
          ext.isDodging = false;
        }
      }

      // 更新攻击冷却
      if (ext.attackCooldown > 0) {
        ext.attackCooldown = Math.max(0, ext.attackCooldown - dt);
      }

      // 更新重攻击冷却
      if (ext.heavyAttackCooldown > 0) {
        ext.heavyAttackCooldown = Math.max(0, ext.heavyAttackCooldown - dt);
      }

      // 更新闪避冷却
      if (ext.dodgeCooldown > 0) {
        ext.dodgeCooldown = Math.max(0, ext.dodgeCooldown - dt);
      }

      // 更新连击计时器
      if (ext.comboTimer > 0) {
        ext.comboTimer -= dt;
        if (ext.comboTimer <= 0) {
          ext.comboCount = 0;
          ext.comboTimer = 0;
        }
      }

      // 确保能量不超过上限
      ext.energy = Math.min(ext.maxEnergy, ext.energy);
    }
  }

  // ============================================================
  // 私有方法 — AI 决策
  // ============================================================

  /**
   * 执行 AI 决策
   *
   * 对每个阵营的当前出场角色执行一次 AI 动作选择。
   */
  private executeAiDecisions(ctx: BattleModeContext): void {
    // 攻击方和防守方各执行一次决策
    for (const side of ['attacker', 'defender'] as const) {
      const activeUnit = this.getActiveFighterForSide(side, ctx);
      if (!activeUnit) continue;

      const ext = this.state.fighters.get(activeUnit.id);
      if (!ext) continue;

      // 眩晕中无法行动
      if (ext.stunMs > 0) continue;

      // 决策
      const action = this.chooseAction(activeUnit, ext, ctx);
      this.executeAction(activeUnit, ext, action, ctx);
    }
  }

  /**
   * 选择动作（基于策略预设的概率分布）
   */
  private chooseAction(unit: BattleUnit, ext: FighterExtension, ctx: BattleModeContext): FightAction {
    // 能量满时优先释放必杀技
    if (ext.energy >= this.config.ultimateCost && ext.attackCooldown <= 0) {
      return 'ultimate';
    }

    // 连击中继续攻击
    if (ext.comboCount > 0 && ext.attackCooldown <= 0) {
      return 'light_attack';
    }

    // 有足够能量且技能冷却完毕时考虑使用技能
    if (ext.energy >= this.config.skillEnergyCost && ext.attackCooldown <= 0 && Math.random() < 0.3) {
      return 'skill';
    }

    // 基于策略的概率分布
    const weights = AI_STRATEGY_WEIGHTS[this.strategy];
    const roll = Math.random();

    if (roll < weights.attack) {
      // 攻击：检查轻/重攻击冷却
      if (ext.heavyAttackCooldown <= 0 && Math.random() < 0.4) {
        return 'heavy_attack';
      }
      if (ext.attackCooldown <= 0) {
        return 'light_attack';
      }
      // 冷却中，尝试防御
      return 'block';
    } else if (roll < weights.attack + weights.block) {
      return 'block';
    } else if (roll < weights.attack + weights.block + weights.dodge) {
      // 闪避：检查冷却
      if (ext.dodgeCooldown <= 0) {
        return 'dodge';
      }
      return 'block';
    } else {
      // 技能：检查能量和冷却
      if (ext.energy >= this.config.skillEnergyCost && ext.attackCooldown <= 0) {
        return 'skill';
      }
      return 'light_attack';
    }
  }

  /**
   * 执行动作
   */
  private executeAction(unit: BattleUnit, ext: FighterExtension, action: FightAction, ctx: BattleModeContext): void {
    const enemySide: 'attacker' | 'defender' = unit.side === 'attacker' ? 'defender' : 'attacker';

    switch (action) {
      case 'light_attack':
      case 'heavy_attack':
      case 'skill':
      case 'ultimate': {
        // 选择目标
        const target = this.selectTarget(enemySide, ctx);
        if (!target) return;

        // 检查冷却（ultimate 使用通用攻击冷却）
        if (action === 'heavy_attack' && ext.heavyAttackCooldown > 0) return;
        if (action !== 'heavy_attack' && ext.attackCooldown > 0) return;
        if (action === 'skill' && ext.energy < this.config.skillEnergyCost) return;
        if (action === 'ultimate' && ext.energy < this.config.ultimateCost) return;

        this.performAttack(unit, ext, target, action, ctx);

        // 设置冷却
        if (action === 'heavy_attack') {
          ext.heavyAttackCooldown = this.config.heavyAttackCooldownMs;
          ext.lastHeavyAttackTime = this.state.elapsedMs;
        }
        ext.attackCooldown = action === 'light_attack'
          ? this.config.lightAttackCooldownMs
          : action === 'heavy_attack'
            ? this.config.heavyAttackCooldownMs
            : action === 'skill'
              ? this.config.skillCooldownMs
              : this.config.heavyAttackCooldownMs; // ultimate
        ext.lastAttackTime = this.state.elapsedMs;
        ext.isBlocking = false;
        break;
      }

      case 'block': {
        ext.isBlocking = true;
        break;
      }

      case 'dodge': {
        if (ext.dodgeCooldown > 0) return;
        ext.isDodging = true;
        ext.invincibleMs = this.config.dodgeDurationMs;
        ext.dodgeCooldown = this.config.dodgeCooldownMs;
        ext.lastDodgeTime = this.state.elapsedMs;
        ext.isBlocking = false;
        break;
      }
    }
  }

  /**
   * 选择攻击目标
   *
   * 优先攻击当前出场的角色，否则攻击血量最低的敌方。
   */
  private selectTarget(enemySide: 'attacker' | 'defender', ctx: BattleModeContext): BattleUnit | null {
    const enemies = ctx.getAliveUnits(enemySide);
    if (enemies.length === 0) return null;

    // 优先攻击当前出场的角色
    const activeEnemy = this.getActiveFighterForSide(enemySide, ctx);
    if (activeEnemy) return activeEnemy;

    // 否则攻击血量最低的
    return enemies.reduce((lowest, current) =>
      current.stats.hp < lowest.stats.hp ? current : lowest,
    );
  }

  /**
   * 执行攻击
   */
  private performAttack(
    attacker: BattleUnit,
    attackerExt: FighterExtension,
    target: BattleUnit,
    action: FightAction,
    ctx: BattleModeContext,
  ): void {
    const targetExt = this.state.fighters.get(target.id);

    // 计算伤害倍率
    const multiplier = this.getAttackMultiplier(action);

    // 消耗能量
    if (action === 'ultimate') {
      attackerExt.energy -= this.config.ultimateCost;
    } else if (action === 'skill') {
      attackerExt.energy -= this.config.skillEnergyCost;
    }

    // 计算基础伤害
    const baseDamage = Math.max(1, Math.floor(
      attacker.stats.attack * multiplier - target.stats.defense * 0.3,
    ));

    // 暴击判定
    const isCrit = Math.random() < attacker.stats.critRate;
    let damage = isCrit ? Math.floor(baseDamage * attacker.stats.critMultiplier) : baseDamage;

    // 应用连击倍率
    const comboMult = Math.min(
      this.config.maxComboMultiplierCap,
      1 + attackerExt.comboCount * this.config.comboMultiplier,
    );
    damage = Math.floor(damage * comboMult);

    // 检查目标是否无敌（闪避中）
    if (targetExt && targetExt.invincibleMs > 0) {
      // 闪避成功，不造成伤害
      ctx.emit({
        type: 'unit_damaged',
        data: { targetId: target.id, damage: 0, isCrit: false, isMiss: true },
      });
      ctx.emit({
        type: 'action_executed',
        data: { unitId: attacker.id, action },
      });
      return;
    }

    // 检查目标是否防御
    let isBlocked = false;
    if (targetExt && targetExt.isBlocking) {
      isBlocked = true;
      damage = Math.floor(damage * (1 - this.config.blockReduction));
    }

    // 确保最低伤害为 1（未格挡时）
    if (!isBlocked && damage <= 0) {
      damage = 1;
    }

    // 应用伤害（通过引擎上下文）
    const dmgOutput = ctx.dealDamage(attacker.id, target.id, damage);
    // 使用我们计算的伤害（引擎的伤害计算可能不同）
    const finalDamage = damage;

    // 统计
    if (attacker.side === 'attacker') {
      this.state.totalDamageDealt += finalDamage;
    } else {
      this.state.totalDamageTaken += finalDamage;
    }

    // 攻击者获得能量
    attackerExt.energy = Math.min(
      attackerExt.maxEnergy,
      attackerExt.energy + this.config.energyGainOnHit,
    );

    // 目标受击获得能量
    if (targetExt) {
      targetExt.energy = Math.min(
        targetExt.maxEnergy,
        targetExt.energy + this.config.energyGainOnHurt,
      );
    }

    // 更新连击
    attackerExt.comboCount++;
    attackerExt.comboTimer = attackerExt.maxComboTime;

    // 发射事件
    ctx.emit({
      type: 'unit_damaged',
      data: { targetId: target.id, damage: finalDamage, isCrit, isMiss: false },
    });

    ctx.emit({
      type: 'action_executed',
      data: { unitId: attacker.id, action },
    });

    ctx.emit({
      type: 'combo_hit',
      data: { attackerId: attacker.id, comboCount: attackerExt.comboCount },
    });

    // 必杀技事件
    if (action === 'ultimate') {
      ctx.emit({
        type: 'ultimate_triggered',
        data: { unitId: attacker.id, skillName: '必杀技' },
      });
    }

    // 眩晕效果
    if (action === 'ultimate' && targetExt && targetExt.stunMs <= 0) {
      targetExt.stunMs = this.config.ultimateStunMs;
      ctx.emit({
        type: 'fighter_stunned',
        data: { unitId: target.id, durationMs: this.config.ultimateStunMs },
      });
    } else if (action === 'heavy_attack' && targetExt && targetExt.stunMs <= 0 && Math.random() < 0.3) {
      targetExt.stunMs = this.config.heavyStunMs;
      ctx.emit({
        type: 'fighter_stunned',
        data: { unitId: target.id, durationMs: this.config.heavyStunMs },
      });
    }

    // 检查目标死亡
    const refreshedTarget = ctx.getUnit(target.id);
    if (refreshedTarget && !refreshedTarget.isAlive) {
      this.handleKO(refreshedTarget, ctx);
    }
  }

  /**
   * 获取攻击伤害倍率
   */
  private getAttackMultiplier(action: FightAction): number {
    switch (action) {
      case 'light_attack': return this.config.lightAttackMultiplier;
      case 'heavy_attack': return this.config.heavyAttackMultiplier;
      case 'skill': return this.config.skillMultiplier;
      case 'ultimate': return this.config.ultimateMultiplier;
      default: return 1.0;
    }
  }

  // ============================================================
  // 私有方法 — KO 和换人
  // ============================================================

  /**
   * 处理 KO 事件
   */
  private handleKO(unit: BattleUnit, ctx: BattleModeContext): void {
    this.state.koOrder.push(unit.id);

    if (unit.side === 'attacker') {
      this.state.unitsLost++;
    } else {
      this.state.enemiesDefeated++;
    }

    ctx.emit({
      type: 'ko',
      data: { unitId: unit.id, unitName: unit.name, side: unit.side },
    });

    ctx.emit({
      type: 'unit_died',
      data: { unitId: unit.id, unitName: unit.name, side: unit.side },
    });

    // 换人：切换到下一个存活的队友
    this.switchToNextFighter(unit.side, ctx);
  }

  /**
   * 切换到下一个存活的队友
   */
  private switchToNextFighter(side: 'attacker' | 'defender', ctx: BattleModeContext): void {
    const aliveUnits = ctx.getAliveUnits(side);
    if (aliveUnits.length === 0) return;

    // 寻找下一个存活角色的索引
    const allUnits = ctx.units.filter((u) => u.side === side);
    const currentIndex = this.state.activeFighterIndex[side];

    // 从当前位置往后找
    for (let offset = 1; offset <= allUnits.length; offset++) {
      const nextIndex = (currentIndex + offset) % allUnits.length;
      if (allUnits[nextIndex].isAlive) {
        this.state.activeFighterIndex[side] = nextIndex;
        return;
      }
    }
  }

  /**
   * 同步 KO 状态
   *
   * 检查引擎上下文中的死亡单位，确保内部状态一致。
   */
  private syncKO(ctx: BattleModeContext): void {
    for (const unit of ctx.units) {
      if (!unit.isAlive && !this.state.koOrder.includes(unit.id)) {
        this.state.koOrder.push(unit.id);
        if (unit.side === 'attacker') {
          this.state.unitsLost++;
        } else {
          this.state.enemiesDefeated++;
        }
      }
    }
  }

  // ============================================================
  // 私有方法 — 辅助
  // ============================================================

  /**
   * 获取指定阵营的当前出场角色
   */
  private getActiveFighterForSide(side: 'attacker' | 'defender', ctx?: BattleModeContext): BattleUnit | undefined {
    const context = ctx ?? ({} as BattleModeContext);
    const units = context.units ?? [];
    const sideUnits = units.filter((u) => u.side === side);
    if (sideUnits.length === 0) return undefined;

    const idx = this.state.activeFighterIndex[side];
    // 确保索引有效
    const safeIdx = idx % sideUnits.length;
    const unit = sideUnits[safeIdx];

    if (unit && unit.isAlive) return unit;

    // 当前角色已死亡，找下一个存活的
    for (let offset = 1; offset <= sideUnits.length; offset++) {
      const nextIdx = (safeIdx + offset) % sideUnits.length;
      if (sideUnits[nextIdx].isAlive) {
        return sideUnits[nextIdx];
      }
    }

    return undefined;
  }

  // ============================================================
  // 序列化辅助
  // ============================================================

  /** 序列化格斗角色 Map */
  private serializeFighterMap(fighters: Map<string, FighterExtension>): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [id, ext] of fighters) {
      obj[id] = { ...ext };
    }
    return obj;
  }

  /** 反序列化格斗角色 Map */
  private deserializeFighterMap(data: unknown): Map<string, FighterExtension> {
    const map = new Map<string, FighterExtension>();
    if (typeof data !== 'object' || data === null) return map;

    const obj = data as Record<string, unknown>;
    for (const [id, val] of Object.entries(obj)) {
      if (typeof val === 'object' && val !== null) {
        const s = val as Record<string, unknown>;
        map.set(id, {
          energy: typeof s.energy === 'number' ? Math.max(0, s.energy) : 0,
          maxEnergy: typeof s.maxEnergy === 'number' ? Math.max(1, s.maxEnergy) : this.config.ultimateCost,
          comboCount: typeof s.comboCount === 'number' ? Math.max(0, Math.floor(s.comboCount)) : 0,
          comboTimer: typeof s.comboTimer === 'number' ? Math.max(0, s.comboTimer) : 0,
          maxComboTime: typeof s.maxComboTime === 'number' ? Math.max(0, s.maxComboTime) : this.config.maxComboTime,
          isBlocking: typeof s.isBlocking === 'boolean' ? s.isBlocking : false,
          isDodging: typeof s.isDodging === 'boolean' ? s.isDodging : false,
          dodgeCooldown: typeof s.dodgeCooldown === 'number' ? Math.max(0, s.dodgeCooldown) : 0,
          lastDodgeTime: typeof s.lastDodgeTime === 'number' ? s.lastDodgeTime : -Infinity,
          attackCooldown: typeof s.attackCooldown === 'number' ? Math.max(0, s.attackCooldown) : 0,
          lastAttackTime: typeof s.lastAttackTime === 'number' ? s.lastAttackTime : -Infinity,
          heavyAttackCooldown: typeof s.heavyAttackCooldown === 'number' ? Math.max(0, s.heavyAttackCooldown) : 0,
          lastHeavyAttackTime: typeof s.lastHeavyAttackTime === 'number' ? s.lastHeavyAttackTime : -Infinity,
          invincibleMs: typeof s.invincibleMs === 'number' ? Math.max(0, s.invincibleMs) : 0,
          stunMs: typeof s.stunMs === 'number' ? Math.max(0, s.stunMs) : 0,
        });
      }
    }
    return map;
  }
}
