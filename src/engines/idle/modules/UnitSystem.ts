/**
 * UnitSystem — 角色招募 + 进化系统
 *
 * 提供角色招募、经验获取、自动升级、进化等完整功能。
 * 使用泛型 `UnitSystem<Def>` 允许游戏自定义扩展 UnitDef。
 * 适用于 11/28 款放置游戏。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 泛型设计，支持游戏自定义角色定义
 * - 事件驱动，支持 UI 层监听角色变化
 * - 完整的存档/读档支持
 * - 经验自动升级机制
 * - 进化计时器机制
 *
 * @module engines/idle/modules/UnitSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 角色稀有度枚举 */
export enum UnitRarity {
  Common = 0,
  Uncommon = 1,
  Rare = 2,
  Epic = 3,
  Legendary = 4,
  Mythic = 5,
}

/** 材料消耗 */
export interface MaterialCost {
  /** 材料唯一标识 */
  materialId: string;
  /** 所需数量 */
  quantity: number;
}

/** 进化分支 */
export interface EvolutionBranch {
  /** 分支唯一标识 */
  branchId: string;
  /** 进化目标角色 ID */
  targetUnitId: string;
  /** 所需材料列表 */
  requiredMaterials: MaterialCost[];
  /** 所需金币 */
  requiredGold: number;
  /** 前置阶段 ID（可选） */
  requiredStage?: string;
  /** 成功率（0~1） */
  successRate: number;
  /** 进化耗时（毫秒） */
  evolveTime: number;
}

/** 角色定义（基础接口） */
export interface UnitDef {
  /** 角色唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 角色描述 */
  description: string;
  /** 稀有度 */
  rarity: UnitRarity;
  /** 基础属性：属性类型 → 数值 */
  baseStats: Record<string, number>;
  /** 成长率：属性类型 → 每级增长 */
  growthRates: Record<string, number>;
  /** 可用进化分支列表 */
  evolutions: EvolutionBranch[];
  /** 招募消耗材料列表 */
  recruitCost: MaterialCost[];
  /** 最大等级 */
  maxLevel: number;
  /** 标签列表（用于分类筛选） */
  tags: string[];
  /** 被动技能 ID 列表 */
  passiveSkillIds: string[];
}

/** 角色运行时状态 */
export interface UnitState {
  /** 关联的角色定义 ID */
  defId: string;
  /** 当前等级 */
  level: number;
  /** 当前经验值 */
  exp: number;
  /** 是否已解锁（已招募） */
  unlocked: boolean;
  /** 当前进化分支 ID */
  currentEvolutionBranch: string | null;
  /** 进化开始时间戳（毫秒） */
  evolutionStartTime: number | null;
  /** 已装备物品 ID 列表 */
  equippedIds: string[];
}

/** 角色系统事件 */
export interface UnitSystemEvent {
  /** 事件类型 */
  type: 'unlocked' | 'leveled_up' | 'evolved' | 'exp_gained';
  /** 触发事件的角色 ID */
  unitId: string;
  /** 事件附加数据 */
  data?: Record<string, unknown>;
}

/** 操作结果类型 */
export interface UnitResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

// ============================================================
// UnitSystem 实现
// ============================================================

/**
 * 角色系统 — 管理角色招募、升级、进化
 *
 * @typeParam Def - 角色定义类型，必须继承 UnitDef
 *
 * @example
 * ```typescript
 * const system = new UnitSystem([
 *   {
 *     id: 'warrior',
 *     name: '战士',
 *     description: '勇敢的前线战士',
 *     rarity: UnitRarity.Common,
 *     baseStats: { hp: 100, atk: 10, def: 5 },
 *     growthRates: { hp: 10, atk: 2, def: 1 },
 *     evolutions: [],
 *     recruitCost: [{ materialId: 'gold', quantity: 100 }],
 *     maxLevel: 50,
 *     tags: ['melee', 'tank'],
 *     passiveSkillIds: [],
 *   },
 * ]);
 *
 * const result = system.unlock('warrior');
 * if (result.ok) {
 *   console.log('招募成功！', result.value);
 * }
 * ```
 */
export class UnitSystem<Def extends UnitDef = UnitDef> {

  // ========== 内部数据 ==========

  /** 角色定义注册表：defId → Def */
  private readonly defs: Map<string, Def> = new Map();

  /** 角色运行时状态：defId → UnitState */
  private readonly states: Map<string, UnitState> = new Map();

  /** 事件监听器列表 */
  private readonly listeners: ((event: UnitSystemEvent) => void)[] = [];

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 创建角色系统实例
   *
   * 注册所有角色定义，并初始化每个角色的运行时状态（未解锁）。
   * 重复 ID 的定义会被后者覆盖。
   *
   * @param definitions - 角色定义数组
   */
  constructor(definitions: Def[]) {
    for (const def of definitions) {
      this.defs.set(def.id, def);
      this.states.set(def.id, {
        defId: def.id,
        level: 1,
        exp: 0,
        unlocked: false,
        currentEvolutionBranch: null,
        evolutionStartTime: null,
        equippedIds: [],
      });
    }
  }

  // ============================================================
  // 核心操作
  // ============================================================

  /**
   * 招募（解锁）角色
   *
   * 将指定角色标记为已解锁，初始等级为 1。
   * 如果角色不存在或已经解锁，返回失败结果。
   *
   * @param unitId - 要招募的角色 ID
   * @returns 操作结果，成功时包含角色状态
   */
  unlock(unitId: string): UnitResult<UnitState> {
    const def = this.defs.get(unitId);
    if (!def) {
      return { ok: false, error: `角色定义不存在: ${unitId}` };
    }

    const state = this.states.get(unitId)!;
    if (state.unlocked) {
      return { ok: false, error: `角色已解锁: ${unitId}` };
    }

    state.unlocked = true;
    state.level = 1;
    state.exp = 0;
    state.currentEvolutionBranch = null;
    state.evolutionStartTime = null;
    state.equippedIds = [];

    this.emitEvent({ type: 'unlocked', unitId, data: { name: def.name } });

    return { ok: true, value: { ...state } };
  }

  /**
   * 开始进化
   *
   * 角色进入进化流程，设置进化分支和开始时间。
   * 进化完成需要调用 checkEvolutionCompletion() 检查。
   *
   * @param unitId - 要进化的角色 ID
   * @param branchId - 进化分支 ID
   * @returns 操作结果
   */
  evolve(unitId: string, branchId: string): UnitResult<void> {
    const def = this.defs.get(unitId);
    if (!def) {
      return { ok: false, error: `角色定义不存在: ${unitId}` };
    }

    const state = this.states.get(unitId)!;
    if (!state.unlocked) {
      return { ok: false, error: `角色未解锁: ${unitId}` };
    }

    if (state.evolutionStartTime !== null) {
      return { ok: false, error: `角色正在进化中: ${unitId}` };
    }

    // 查找进化分支
    const branch = def.evolutions.find((e) => e.branchId === branchId);
    if (!branch) {
      return { ok: false, error: `进化分支不存在: ${branchId}` };
    }

    // 设置进化状态
    state.currentEvolutionBranch = branchId;
    state.evolutionStartTime = Date.now();

    return { ok: true };
  }

  /**
   * 增加经验值
   *
   * 为指定角色增加经验，自动处理升级逻辑。
   * 当经验值达到升级阈值时自动升级，可连续升级多级。
   * 达到最大等级后不再升级，多余经验保留。
   *
   * @param unitId - 角色 ID
   * @param amount - 经验值数量（必须 > 0）
   * @returns 操作结果，成功时包含更新后的角色状态
   */
  addExp(unitId: string, amount: number): UnitResult<UnitState> {
    const def = this.defs.get(unitId);
    if (!def) {
      return { ok: false, error: `角色定义不存在: ${unitId}` };
    }

    const state = this.states.get(unitId)!;
    if (!state.unlocked) {
      return { ok: false, error: `角色未解锁: ${unitId}` };
    }

    if (amount <= 0) {
      return { ok: false, error: '经验值必须大于 0' };
    }

    // 增加经验
    state.exp += amount;
    this.emitEvent({ type: 'exp_gained', unitId, data: { amount, totalExp: state.exp } });

    // 自动升级循环
    while (state.level < def.maxLevel) {
      const required = this.expToNextLevel(state.level);
      if (state.exp >= required) {
        state.exp -= required;
        state.level += 1;
        this.emitEvent({
          type: 'leveled_up',
          unitId,
          data: { newLevel: state.level, maxLevel: def.maxLevel },
        });
      } else {
        break;
      }
    }

    // 达到最大等级时，经验值不超过下一级所需（因为没有下一级了）
    if (state.level >= def.maxLevel) {
      state.exp = Math.min(state.exp, this.expToNextLevel(state.level));
    }

    return { ok: true, value: { ...state } };
  }

  // ============================================================
  // 查询
  // ============================================================

  /**
   * 计算所有已解锁角色的某属性加成总和
   *
   * 公式：Σ (baseStats[statType] + growthRates[statType] * (level - 1))
   * 只计算已解锁的角色。
   *
   * @param statType - 属性类型（如 'hp', 'atk', 'def'）
   * @returns 属性加成总和
   */
  getBonus(statType: string): number {
    let total = 0;

    for (const [id, state] of this.states) {
      if (!state.unlocked) {
        continue;
      }

      const def = this.defs.get(id)!;
      const base = def.baseStats[statType] ?? 0;
      const growth = def.growthRates[statType] ?? 0;
      total += base + growth * (state.level - 1);
    }

    return total;
  }

  /**
   * 获取已解锁角色列表
   *
   * 支持按稀有度和标签筛选，返回匹配的已解锁角色状态数组。
   *
   * @param filter - 筛选条件（可选）
   * @param filter.rarity - 按稀有度筛选
   * @param filter.tag - 按标签筛选
   * @returns 符合条件的已解锁角色状态数组
   */
  getUnits(filter?: { rarity?: UnitRarity; tag?: string }): UnitState[] {
    const result: UnitState[] = [];

    for (const [id, state] of this.states) {
      if (!state.unlocked) {
        continue;
      }

      // 按稀有度筛选
      if (filter?.rarity !== undefined) {
        const def = this.defs.get(id)!;
        if (def.rarity !== filter.rarity) {
          continue;
        }
      }

      // 按标签筛选
      if (filter?.tag !== undefined) {
        const def = this.defs.get(id)!;
        if (!def.tags.includes(filter.tag)) {
          continue;
        }
      }

      result.push({ ...state });
    }

    return result;
  }

  /**
   * 获取角色定义
   *
   * @param id - 角色 ID
   * @returns 角色定义，不存在则返回 undefined
   */
  getDef(id: string): Def | undefined {
    return this.defs.get(id);
  }

  /**
   * 获取角色运行时状态
   *
   * @param id - 角色 ID
   * @returns 角色状态的副本，不存在则返回 undefined
   */
  getState(id: string): UnitState | undefined {
    const state = this.states.get(id);
    return state ? { ...state } : undefined;
  }

  /**
   * 获取角色等级
   *
   * @param id - 角色 ID
   * @returns 角色等级，未找到返回 0
   */
  getLevel(id: string): number {
    const state = this.states.get(id);
    return state ? state.level : 0;
  }

  /**
   * 检查角色是否已解锁
   *
   * @param id - 角色 ID
   * @returns 是否已解锁
   */
  isUnlocked(id: string): boolean {
    const state = this.states.get(id);
    return state ? state.unlocked : false;
  }

  // ============================================================
  // 进化检查
  // ============================================================

  /**
   * 检查进化是否完成
   *
   * 遍历所有正在进化中的角色，判断当前时间是否已超过进化开始时间 + evolveTime。
   * 完成的角色会清除进化状态，并触发 evolved 事件。
   *
   * @returns 完成进化的角色 ID 列表
   */
  checkEvolutionCompletion(): string[] {
    const completed: string[] = [];
    const now = Date.now();

    for (const [id, state] of this.states) {
      if (state.evolutionStartTime === null || state.currentEvolutionBranch === null) {
        continue;
      }

      const def = this.defs.get(id)!;
      const branch = def.evolutions.find(
        (e) => e.branchId === state.currentEvolutionBranch,
      );

      if (!branch) {
        continue;
      }

      const elapsed = now - state.evolutionStartTime;
      if (elapsed >= branch.evolveTime) {
        // 进化完成
        const branchId = state.currentEvolutionBranch;
        state.currentEvolutionBranch = null;
        state.evolutionStartTime = null;

        this.emitEvent({
          type: 'evolved',
          unitId: id,
          data: {
            branchId,
            targetUnitId: branch.targetUnitId,
          },
        });

        completed.push(id);
      }
    }

    return completed;
  }

  // ============================================================
  // 存档 / 读档
  // ============================================================

  /**
   * 序列化当前状态
   *
   * 导出所有角色的关键状态数据，用于持久化存储。
   *
   * @returns 角色状态映射：unitId → 状态数据
   */
  saveState(): Record<string, {
    level: number;
    exp: number;
    unlocked: boolean;
    evolutionBranch: string | null;
    evolutionStartTime: number | null;
    equippedIds: string[];
  }> {
    const result: Record<string, {
      level: number;
      exp: number;
      unlocked: boolean;
      evolutionBranch: string | null;
      evolutionStartTime: number | null;
      equippedIds: string[];
    }> = {};

    for (const [id, state] of this.states) {
      result[id] = {
        level: state.level,
        exp: state.exp,
        unlocked: state.unlocked,
        evolutionBranch: state.currentEvolutionBranch,
        evolutionStartTime: state.evolutionStartTime,
        equippedIds: [...state.equippedIds],
      };
    }

    return result;
  }

  /**
   * 反序列化恢复状态
   *
   * 从存档数据恢复角色状态。未注册的角色 ID 会被静默忽略。
   *
   * @param data - 存档数据：unitId → 状态数据
   */
  loadState(data: Record<string, any>): void {
    for (const [id, saved] of Object.entries(data)) {
      const state = this.states.get(id);
      if (!state) {
        continue;
      }

      // 基本校验：saved 必须是非 null 对象
      if (saved === null || typeof saved !== 'object') {
        continue;
      }

      state.level = typeof saved.level === 'number' && saved.level >= 1
        ? saved.level
        : 1;
      state.exp = typeof saved.exp === 'number' && saved.exp >= 0
        ? saved.exp
        : 0;
      state.unlocked = typeof saved.unlocked === 'boolean'
        ? saved.unlocked
        : false;
      state.currentEvolutionBranch = typeof saved.evolutionBranch === 'string'
        ? saved.evolutionBranch
        : null;
      // 恢复进化开始时间（向后兼容：旧存档无此字段时默认 null）
      state.evolutionStartTime = typeof saved.evolutionStartTime === 'number'
        ? saved.evolutionStartTime
        : null;
      // 恢复已装备物品列表（向后兼容：旧存档无此字段时默认 []）
      state.equippedIds = Array.isArray(saved.equippedIds)
        && saved.equippedIds.every((item: unknown) => typeof item === 'string')
        ? [...saved.equippedIds]
        : [];
    }
  }

  /**
   * 重置所有角色状态
   *
   * 将所有角色恢复到初始未解锁状态。
   * 不会清除事件监听器。
   */
  reset(): void {
    for (const [id, state] of this.states) {
      state.level = 1;
      state.exp = 0;
      state.unlocked = false;
      state.currentEvolutionBranch = null;
      state.evolutionStartTime = null;
      state.equippedIds = [];
    }
  }

  // ============================================================
  // 事件系统
  // ============================================================

  /**
   * 注册事件监听器
   *
   * 监听角色系统的所有事件（unlocked, leveled_up, evolved, exp_gained）。
   * 返回一个取消订阅函数，调用即可移除该监听器。
   *
   * @param callback - 事件回调函数
   * @returns 取消订阅函数
   *
   * @example
   * ```typescript
   * const unsubscribe = system.onEvent((event) => {
   *   console.log(`${event.type}: ${event.unitId}`);
   * });
   *
   * // 取消监听
   * unsubscribe();
   * ```
   */
  onEvent(callback: (event: UnitSystemEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 计算升级所需经验值
   *
   * 公式：floor(100 * 1.15^(level-1))
   * 等级越高，所需经验越多。
   *
   * @param level - 当前等级
   * @returns 升到下一级所需的经验值
   */
  private expToNextLevel(level: number): number {
    return Math.floor(100 * Math.pow(1.15, level - 1));
  }

  /**
   * 触发事件，通知所有监听器
   *
   * @param event - 事件对象
   */
  private emitEvent(event: UnitSystemEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // 防止监听器异常影响系统运行
      }
    }
  }
}
