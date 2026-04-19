/**
 * StrategyPreset — 放置游戏战斗策略预设系统
 *
 * 实现放置游戏核心特色"策略预设 + 自动执行"。
 * 玩家在战斗前配置策略（目标选择、技能使用、防御行为、阵型），
 * 战斗开始后由系统自动按预设策略执行决策。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 事件驱动，支持 UI 层监听策略状态变化
 * - 完整的存档/读档支持（含校验）
 * - decide() 为纯函数式决策，不修改传入的 context
 *
 * @module engines/idle/modules/battle/StrategyPreset
 */

// ============================================================
// 类型定义
// ============================================================

/** 目标选择策略 */
export type TargetStrategy =
  | 'lowest_hp'        // 优先攻击血量最低的
  | 'highest_attack'   // 优先攻击攻击力最高的
  | 'fastest'          // 优先攻击速度最快的
  | 'weakest_defense'  // 优先攻击防御最低的
  | 'boss_priority'    // 优先攻击 Boss
  | 'nearest';         // 优先攻击最近的（地图模式）

/** 技能使用策略 */
export type SkillStrategy =
  | 'strongest_first'  // 最强技能优先
  | 'weakest_first'    // 最弱技能优先（省大招）
  | 'balanced'         // 均衡使用
  | 'save_for_boss';   // 留大招给 Boss

/** 防御策略 */
export type DefenseStrategy =
  | 'never'            // 从不防御
  | 'when_low_hp'      // HP 低时防御
  | 'when_outnumbered' // 敌方人数多时防御
  | 'always';          // 总是防御优先

/** 阵型策略 */
export type FormationStrategy =
  | 'offensive'        // 攻击阵型（攻击+20%，防御-10%）
  | 'defensive'        // 防御阵型（防御+20%，攻击-10%）
  | 'balanced'         // 均衡阵型（无加成）
  | 'speed';           // 速度阵型（速度+20%）

/**
 * 战斗单位 — 最小化接口定义
 *
 * 后续统一到 BattleEngine 模块后可替换。
 */
export interface BattleUnit {
  /** 单位唯一标识 */
  id: string;
  /** 当前 HP */
  currentHp: number;
  /** 最大 HP */
  maxHp: number;
  /** 攻击力 */
  attack: number;
  /** 防御力 */
  defense: number;
  /** 速度 */
  speed: number;
  /** 是否存活 */
  isAlive: boolean;
  /** 是否为 Boss */
  isBoss: boolean;
  /** 可用技能 ID 列表 */
  skills: string[];
  /** 技能威力映射（skillId → 威力值，用于策略排序） */
  skillPower?: Record<string, number>;
  /** 是否为治疗单位 */
  isHealer?: boolean;
  /** 治疗技能 ID 列表 */
  healSkills?: string[];
}

/** 单位级策略覆盖 */
export interface UnitStrategyOverride {
  /** 单位 ID */
  unitId: string;
  /** 目标选择策略覆盖 */
  targetStrategy?: TargetStrategy;
  /** 技能使用策略覆盖 */
  skillStrategy?: SkillStrategy;
  /** 防御阈值覆盖（0-1，低于此 HP 比例时触发防御） */
  defenseThreshold?: number;
  /** 禁用的技能 ID */
  skillBlacklist?: string[];
}

/** 策略预设配置 */
export interface StrategyPresetConfig {
  /** 预设名称 */
  name: string;
  /** 预设描述 */
  description?: string;

  // ---- 全局策略 ----

  /** 目标选择策略 */
  targetStrategy: TargetStrategy;
  /** 技能使用策略 */
  skillStrategy: SkillStrategy;
  /** 防御策略 */
  defenseStrategy: DefenseStrategy;
  /** 阵型策略 */
  formationStrategy: FormationStrategy;

  // ---- 阈值 ----

  /** 撤退/防御 HP 阈值（0-1，HP 低于此值时撤退/防御） */
  retreatHpThreshold: number;
  /** 爆发 HP 阈值（0-1，敌方 HP 低于此值时全力输出） */
  burstHpThreshold: number;

  // ---- 行为开关 ----

  /** 自动使用技能 */
  autoUseSkills: boolean;
  /** 自动治疗 */
  autoHeal: boolean;
  /** 集火（所有单位攻击同一目标） */
  focusFire: boolean;

  // ---- 单位级覆盖 ----

  /** 单位级策略覆盖列表 */
  unitOverrides: UnitStrategyOverride[];
}

/** 策略预设运行时状态（用于存档） */
export interface StrategyPresetState {
  /** 当前配置 */
  config: StrategyPresetConfig;
  /** 是否已激活 */
  enabled: boolean;
}

/** 策略决策结果 */
export interface StrategyDecision {
  /** 决策动作类型 */
  action: 'attack' | 'skill' | 'defend' | 'heal' | 'retreat';
  /** 使用的技能 ID（仅 action 为 skill 或 heal 时有效） */
  skillId?: string;
  /** 目标单位 ID 列表 */
  targetIds: string[];
  /** 决策原因说明 */
  reason: string;
}

/** 策略决策上下文（由战斗系统提供） */
export interface StrategyDecisionContext {
  /** 当前行动单位 */
  unit: BattleUnit;
  /** 友方存活单位 */
  allies: BattleUnit[];
  /** 敌方存活单位 */
  enemies: BattleUnit[];
  /** 当前回合 */
  turn: number;
}

/** 策略事件 */
export type StrategyEvent =
  | { type: 'preset_activated'; data: { name: string } }
  | { type: 'preset_deactivated'; data: {} }
  | { type: 'config_updated'; data: { name: string } }
  | { type: 'decision_made'; data: StrategyDecision };

/** 事件监听器类型 */
export type StrategyEventListener = (event: StrategyEvent) => void;

// ============================================================
// StrategyPreset 实现
// ============================================================

/**
 * 战斗策略预设 — 管理策略配置与自动决策
 *
 * @example
 * ```typescript
 * const preset = new StrategyPreset(StrategyPreset.getAggressivePreset());
 * preset.activate();
 *
 * const decision = preset.decide({
 *   unit: myUnit,
 *   allies: [myUnit, allyUnit],
 *   enemies: [enemy1, enemy2],
 *   turn: 1,
 * });
 * ```
 */
export class StrategyPreset {
  /** 当前策略配置 */
  private config: StrategyPresetConfig;
  /** 是否已激活 */
  private enabled: boolean = false;
  /** 事件监听器列表 */
  private readonly listeners: StrategyEventListener[] = [];
  /** 集火共享目标（focusFire 模式下所有单位攻击同一目标） */
  private sharedTargetId: string | null = null;

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 创建策略预设实例
   *
   * @param partialConfig - 可选的部分配置，未指定字段使用默认值
   */
  constructor(partialConfig?: Partial<StrategyPresetConfig>) {
    this.config = {
      ...StrategyPreset.getDefaultConfig(),
      ...partialConfig,
      unitOverrides: partialConfig?.unitOverrides
        ? [...partialConfig.unitOverrides]
        : [...StrategyPreset.getDefaultConfig().unitOverrides],
    };
  }

  // ============================================================
  // 激活/停用
  // ============================================================

  /**
   * 激活策略预设
   */
  activate(): void {
    if (!this.enabled) {
      this.enabled = true;
      this.sharedTargetId = null;
      this.emit({ type: 'preset_activated', data: { name: this.config.name } });
    }
  }

  /**
   * 停用策略预设
   */
  deactivate(): void {
    if (this.enabled) {
      this.enabled = false;
      this.sharedTargetId = null;
      this.emit({ type: 'preset_deactivated', data: {} });
    }
  }

  /**
   * 查询策略是否已激活
   *
   * @returns 是否已激活
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  // ============================================================
  // 配置管理
  // ============================================================

  /**
   * 获取当前策略配置
   *
   * @returns 当前配置的副本
   */
  getConfig(): StrategyPresetConfig {
    return { ...this.config, unitOverrides: [...this.config.unitOverrides] };
  }

  /**
   * 更新策略配置（浅合并）
   *
   * @param partial - 要更新的配置字段
   */
  updateConfig(partial: Partial<StrategyPresetConfig>): void {
    // unitOverrides 需要特殊处理，避免引用共享
    if (partial.unitOverrides) {
      this.config.unitOverrides = [...partial.unitOverrides];
    }
    const { unitOverrides, ...rest } = partial;
    Object.assign(this.config, rest);
    this.emit({ type: 'config_updated', data: { name: this.config.name } });
  }

  /**
   * 设置单位级策略覆盖
   *
   * 如果已存在同 unitId 的覆盖，则替换。
   *
   * @param override - 单位级策略覆盖配置
   */
  setUnitOverride(override: UnitStrategyOverride): void {
    const idx = this.config.unitOverrides.findIndex((o) => o.unitId === override.unitId);
    if (idx !== -1) {
      this.config.unitOverrides[idx] = override;
    } else {
      this.config.unitOverrides.push(override);
    }
  }

  /**
   * 移除单位级策略覆盖
   *
   * @param unitId - 要移除覆盖的单位 ID
   * @returns 是否成功移除
   */
  removeUnitOverride(unitId: string): boolean {
    const idx = this.config.unitOverrides.findIndex((o) => o.unitId === unitId);
    if (idx === -1) return false;
    this.config.unitOverrides.splice(idx, 1);
    return true;
  }

  // ============================================================
  // 决策引擎
  // ============================================================

  /**
   * 根据战场情况做出策略决策（纯函数，不修改 context）
   *
   * 决策优先级：
   * 1. 检查单位级覆盖 → 有则使用覆盖策略
   * 2. 检查 HP 是否低于 retreatHpThreshold → 返回 defend/retreat
   * 3. 检查是否有可治疗友方且 autoHeal=true → 返回 heal
   * 4. 检查是否有可用技能且 autoUseSkills=true → 根据技能策略选择
   * 5. 默认 → 普通攻击，根据 targetStrategy 选择目标
   *
   * @param context - 决策上下文
   * @returns 策略决策结果
   */
  decide(context: StrategyDecisionContext): StrategyDecision {
    const { unit, allies, enemies } = context;

    // 获取单位级覆盖（如有）
    const override = this.findUnitOverride(unit.id);

    // ---- 1. 检查防御策略（HP 低于阈值） ----
    const hpRatio = unit.currentHp / Math.max(1, unit.maxHp);
    const retreatThreshold = override?.defenseThreshold ?? this.config.retreatHpThreshold;
    const shouldDefend = this.checkDefenseStrategy(unit, hpRatio, allies, enemies, override);

    if (shouldDefend) {
      const decision: StrategyDecision = {
        action: hpRatio < retreatThreshold * 0.5 ? 'retreat' : 'defend',
        targetIds: [],
        reason: `HP 比例 ${Math.round(hpRatio * 100)}% 低于阈值 ${Math.round(retreatThreshold * 100)}%，执行防御`,
      };
      this.emit({ type: 'decision_made', data: decision });
      return decision;
    }

    // ---- 2. 检查自动治疗 ----
    if (this.config.autoHeal) {
      const healDecision = this.tryHeal(unit, allies);
      if (healDecision) {
        this.emit({ type: 'decision_made', data: healDecision });
        return healDecision;
      }
    }

    // ---- 3. 检查技能使用 ----
    if (this.config.autoUseSkills) {
      const skillDecision = this.tryUseSkill(unit, enemies, override);
      if (skillDecision) {
        this.emit({ type: 'decision_made', data: skillDecision });
        return skillDecision;
      }
    }

    // ---- 4. 默认：普通攻击 ----
    const targetStrategy = override?.targetStrategy ?? this.config.targetStrategy;
    const targets = this.selectTargets(enemies, targetStrategy);
    const decision: StrategyDecision = {
      action: 'attack',
      targetIds: targets,
      reason: `普通攻击，目标策略：${targetStrategy}`,
    };
    this.emit({ type: 'decision_made', data: decision });
    return decision;
  }

  // ============================================================
  // 预设模板（静态方法）
  // ============================================================

  /**
   * 获取默认策略配置
   *
   * @returns 默认配置
   */
  static getDefaultConfig(): StrategyPresetConfig {
    return {
      name: '默认策略',
      description: '均衡的默认战斗策略',
      targetStrategy: 'lowest_hp',
      skillStrategy: 'balanced',
      defenseStrategy: 'when_low_hp',
      formationStrategy: 'balanced',
      retreatHpThreshold: 0.3,
      burstHpThreshold: 0.2,
      autoUseSkills: true,
      autoHeal: true,
      focusFire: false,
      unitOverrides: [],
    };
  }

  /**
   * 获取激进预设配置
   *
   * 特点：全力输出，不防御，最强技能优先，集火目标
   *
   * @returns 激进配置
   */
  static getAggressivePreset(): StrategyPresetConfig {
    return {
      name: '激进策略',
      description: '全力输出，不防御，最强技能优先，集火目标',
      targetStrategy: 'lowest_hp',
      skillStrategy: 'strongest_first',
      defenseStrategy: 'never',
      formationStrategy: 'offensive',
      retreatHpThreshold: 0.1,
      burstHpThreshold: 0.4,
      autoUseSkills: true,
      autoHeal: false,
      focusFire: true,
      unitOverrides: [],
    };
  }

  /**
   * 获取防御预设配置
   *
   * 特点：防御优先，留大招给 Boss，HP 低时防御，均衡阵型
   *
   * @returns 防御配置
   */
  static getDefensivePreset(): StrategyPresetConfig {
    return {
      name: '防御策略',
      description: '防御优先，留大招给 Boss，HP 低时防御',
      targetStrategy: 'weakest_defense',
      skillStrategy: 'save_for_boss',
      defenseStrategy: 'when_low_hp',
      formationStrategy: 'defensive',
      retreatHpThreshold: 0.5,
      burstHpThreshold: 0.15,
      autoUseSkills: true,
      autoHeal: true,
      focusFire: false,
      unitOverrides: [],
    };
  }

  /**
   * 获取均衡预设配置
   *
   * 特点：攻守兼备，均衡使用技能，低 HP 时防御
   *
   * @returns 均衡配置
   */
  static getBalancedPreset(): StrategyPresetConfig {
    return {
      name: '均衡策略',
      description: '攻守兼备，均衡使用技能，低 HP 时防御',
      targetStrategy: 'lowest_hp',
      skillStrategy: 'balanced',
      defenseStrategy: 'when_low_hp',
      formationStrategy: 'balanced',
      retreatHpThreshold: 0.3,
      burstHpThreshold: 0.2,
      autoUseSkills: true,
      autoHeal: true,
      focusFire: false,
      unitOverrides: [],
    };
  }

  // ============================================================
  // 状态管理
  // ============================================================

  /**
   * 获取当前状态（用于存档）
   *
   * @returns 策略预设状态快照
   */
  getState(): StrategyPresetState {
    return {
      config: this.getConfig(),
      enabled: this.enabled,
    };
  }

  /**
   * 加载状态（含校验）
   *
   * @param state - 要加载的状态
   * @throws 当状态不合法时抛出错误
   */
  loadState(state: StrategyPresetState): void {
    // 校验 enabled
    if (typeof state.enabled !== 'boolean') {
      throw new Error('StrategyPreset.loadState: enabled 必须为布尔值');
    }

    // 校验 config
    if (typeof state.config !== 'object' || state.config === null) {
      throw new Error('StrategyPreset.loadState: config 必须为对象');
    }

    const cfg = state.config;

    // 校验必要字段
    if (typeof cfg.name !== 'string' || cfg.name.length === 0) {
      throw new Error('StrategyPreset.loadState: config.name 必须为非空字符串');
    }
    if (typeof cfg.targetStrategy !== 'string') {
      throw new Error('StrategyPreset.loadState: config.targetStrategy 必须为字符串');
    }
    if (typeof cfg.skillStrategy !== 'string') {
      throw new Error('StrategyPreset.loadState: config.skillStrategy 必须为字符串');
    }
    if (typeof cfg.defenseStrategy !== 'string') {
      throw new Error('StrategyPreset.loadState: config.defenseStrategy 必须为字符串');
    }
    if (typeof cfg.formationStrategy !== 'string') {
      throw new Error('StrategyPreset.loadState: config.formationStrategy 必须为字符串');
    }
    if (typeof cfg.retreatHpThreshold !== 'number' || cfg.retreatHpThreshold < 0 || cfg.retreatHpThreshold > 1) {
      throw new Error('StrategyPreset.loadState: config.retreatHpThreshold 必须为 0-1 之间的数字');
    }
    if (typeof cfg.burstHpThreshold !== 'number' || cfg.burstHpThreshold < 0 || cfg.burstHpThreshold > 1) {
      throw new Error('StrategyPreset.loadState: config.burstHpThreshold 必须为 0-1 之间的数字');
    }
    if (typeof cfg.autoUseSkills !== 'boolean') {
      throw new Error('StrategyPreset.loadState: config.autoUseSkills 必须为布尔值');
    }
    if (typeof cfg.autoHeal !== 'boolean') {
      throw new Error('StrategyPreset.loadState: config.autoHeal 必须为布尔值');
    }
    if (typeof cfg.focusFire !== 'boolean') {
      throw new Error('StrategyPreset.loadState: config.focusFire 必须为布尔值');
    }
    if (!Array.isArray(cfg.unitOverrides)) {
      throw new Error('StrategyPreset.loadState: config.unitOverrides 必须为数组');
    }

    // 校验每个 unitOverride
    for (const o of cfg.unitOverrides) {
      if (typeof o.unitId !== 'string') {
        throw new Error('StrategyPreset.loadState: unitOverride.unitId 必须为字符串');
      }
    }

    // 应用状态
    this.config = {
      ...cfg,
      unitOverrides: cfg.unitOverrides.map((o) => ({ ...o })),
    };
    this.enabled = state.enabled;
    this.sharedTargetId = null;
  }

  /**
   * 重置为默认配置并停用
   */
  reset(): void {
    this.config = { ...StrategyPreset.getDefaultConfig(), unitOverrides: [] };
    this.enabled = false;
    this.sharedTargetId = null;
  }

  // ============================================================
  // 事件系统
  // ============================================================

  /**
   * 注册事件监听器
   *
   * @param handler - 事件处理回调
   */
  on(handler: StrategyEventListener): void {
    this.listeners.push(handler);
  }

  /**
   * 注销事件监听器
   *
   * @param handler - 要移除的事件处理回调
   */
  off(handler: StrategyEventListener): void {
    const idx = this.listeners.indexOf(handler);
    if (idx !== -1) {
      this.listeners.splice(idx, 1);
    }
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 内部事件发射
   *
   * @param event - 要发射的事件
   */
  private emit(event: StrategyEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * 查找单位级策略覆盖
   *
   * @param unitId - 单位 ID
   * @returns 覆盖配置或 undefined
   */
  private findUnitOverride(unitId: string): UnitStrategyOverride | undefined {
    return this.config.unitOverrides.find((o) => o.unitId === unitId);
  }

  /**
   * 检查是否应该执行防御
   *
   * @param unit - 当前单位
   * @param hpRatio - 当前 HP 比例
   * @param allies - 友方单位
   * @param enemies - 敌方单位
   * @param override - 单位级覆盖
   * @returns 是否应防御
   */
  private checkDefenseStrategy(
    unit: BattleUnit,
    hpRatio: number,
    allies: BattleUnit[],
    enemies: BattleUnit[],
    override: UnitStrategyOverride | undefined,
  ): boolean {
    const strategy = this.config.defenseStrategy;
    const threshold = override?.defenseThreshold ?? this.config.retreatHpThreshold;

    switch (strategy) {
      case 'never':
        return false;

      case 'always':
        return true;

      case 'when_low_hp':
        return hpRatio < threshold;

      case 'when_outnumbered':
        // 存活的友方少于敌方时防御
        return allies.filter((a) => a.isAlive).length < enemies.filter((e) => e.isAlive).length;

      default:
        return false;
    }
  }

  /**
   * 尝试执行治疗
   *
   * @param unit - 当前行动单位
   * @param allies - 友方单位
   * @returns 治疗决策或 null
   */
  private tryHeal(unit: BattleUnit, allies: BattleUnit[]): StrategyDecision | null {
    // 只有治疗单位才能治疗
    if (!unit.isHealer) return null;

    // 找到 HP 比例最低的友方（包括自己）
    const woundedAllies = allies
      .filter((a) => a.isAlive && a.currentHp < a.maxHp)
      .sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp));

    if (woundedAllies.length === 0) return null;

    const target = woundedAllies[0];
    const healSkills = unit.healSkills ?? [];

    if (healSkills.length > 0) {
      return {
        action: 'heal',
        skillId: healSkills[0],
        targetIds: [target.id],
        reason: `治疗友方 ${target.id}，HP 比例 ${Math.round((target.currentHp / target.maxHp) * 100)}%`,
      };
    }

    return null;
  }

  /**
   * 尝试使用技能
   *
   * @param unit - 当前行动单位
   * @param enemies - 敌方单位
   * @param override - 单位级覆盖
   * @returns 技能决策或 null
   */
  private tryUseSkill(
    unit: BattleUnit,
    enemies: BattleUnit[],
    override: UnitStrategyOverride | undefined,
  ): StrategyDecision | null {
    let availableSkills = [...unit.skills];

    // 过滤黑名单技能
    const blacklist = override?.skillBlacklist ?? [];
    if (blacklist.length > 0) {
      availableSkills = availableSkills.filter((s) => !blacklist.includes(s));
    }

    if (availableSkills.length === 0) return null;

    // 根据技能策略选择技能
    const skillStrategy = override?.skillStrategy ?? this.config.skillStrategy;
    const selectedSkill = this.selectSkill(availableSkills, unit, skillStrategy, enemies);

    if (!selectedSkill) return null;

    // 选择目标
    const targetStrategy = override?.targetStrategy ?? this.config.targetStrategy;
    const targets = this.selectTargets(enemies, targetStrategy);

    return {
      action: 'skill',
      skillId: selectedSkill,
      targetIds: targets,
      reason: `使用技能 ${selectedSkill}，技能策略：${skillStrategy}`,
    };
  }

  /**
   * 根据技能策略选择技能
   *
   * @param skills - 可用技能列表
   * @param unit - 当前单位
   * @param strategy - 技能策略
   * @param enemies - 敌方单位
   * @returns 选中的技能 ID 或 null
   */
  private selectSkill(
    skills: string[],
    unit: BattleUnit,
    strategy: SkillStrategy,
    enemies: BattleUnit[],
  ): string | null {
    if (skills.length === 0) return null;

    const powerMap = unit.skillPower ?? {};

    switch (strategy) {
      case 'strongest_first': {
        // 按威力降序排列，选最强
        const sorted = [...skills].sort((a, b) => (powerMap[b] ?? 0) - (powerMap[a] ?? 0));
        return sorted[0];
      }

      case 'weakest_first': {
        // 按威力升序排列，选最弱
        const sorted = [...skills].sort((a, b) => (powerMap[a] ?? 0) - (powerMap[b] ?? 0));
        return sorted[0];
      }

      case 'balanced': {
        // 轮流使用，选第一个（简单均衡实现）
        return skills[0];
      }

      case 'save_for_boss': {
        // 有 Boss 时用最强技能，否则用最弱
        const hasBoss = enemies.some((e) => e.isBoss && e.isAlive);
        if (hasBoss) {
          const sorted = [...skills].sort((a, b) => (powerMap[b] ?? 0) - (powerMap[a] ?? 0));
          return sorted[0];
        } else {
          const sorted = [...skills].sort((a, b) => (powerMap[a] ?? 0) - (powerMap[b] ?? 0));
          return sorted[0];
        }
      }

      default:
        return skills[0];
    }
  }

  /**
   * 根据目标策略选择目标
   *
   * @param enemies - 敌方存活单位
   * @param strategy - 目标选择策略
   * @returns 目标 ID 列表（通常为 1 个，集火模式可能为多个）
   */
  private selectTargets(enemies: BattleUnit[], strategy: TargetStrategy): string[] {
    const alive = enemies.filter((e) => e.isAlive);
    if (alive.length === 0) return [];

    // 集火模式：使用共享目标
    if (this.config.focusFire) {
      if (this.sharedTargetId && alive.some((e) => e.id === this.sharedTargetId)) {
        return [this.sharedTargetId];
      }
      // 重新选择共享目标
      const target = this.pickTargetByStrategy(alive, strategy);
      this.sharedTargetId = target.id;
      return [target.id];
    }

    // 非集火模式：每次选择一个目标
    const target = this.pickTargetByStrategy(alive, strategy);
    return [target.id];
  }

  /**
   * 按策略从存活敌人中选择一个目标
   *
   * @param alive - 存活敌人列表
   * @param strategy - 目标选择策略
   * @returns 选中的目标
   */
  private pickTargetByStrategy(alive: BattleUnit[], strategy: TargetStrategy): BattleUnit {
    switch (strategy) {
      case 'lowest_hp':
        return [...alive].sort((a, b) => a.currentHp - b.currentHp)[0];

      case 'highest_attack':
        return [...alive].sort((a, b) => b.attack - a.attack)[0];

      case 'fastest':
        return [...alive].sort((a, b) => b.speed - a.speed)[0];

      case 'weakest_defense':
        return [...alive].sort((a, b) => a.defense - b.defense)[0];

      case 'boss_priority': {
        const boss = alive.find((e) => e.isBoss);
        return boss ?? alive[0];
      }

      case 'nearest':
        // 简化实现：返回第一个（实际地图模式中按距离排序）
        return alive[0];

      default:
        return alive[0];
    }
  }
}
