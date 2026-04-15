/**
 * ExpeditionSystem — 放置游戏远征系统核心模块（P2）
 *
 * 提供远征定义管理、解锁检查、远征发起、进度更新、
 * 完成结算（成功/失败）、加速、统计追踪、存档/读档等完整功能。
 * 使用泛型 `ExpeditionSystem<Def>` 允许游戏自定义扩展 ExpeditionDef。
 * 适用于 8/28 款放置游戏。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 泛型设计，支持游戏自定义远征定义
 * - 事件驱动，支持 UI 层监听远征状态变化
 * - 完整的存档/读档支持
 * - 资源消耗 + 船员配置 + 解锁条件三重检查机制
 *
 * @module engines/idle/modules/ExpeditionSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 远征定义（基础接口） */
export interface ExpeditionDef {
  /** 远征唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 远征描述 */
  description: string;
  /** 持续时间（毫秒） */
  duration: number;
  /** 消耗资源：资源 ID → 数量 */
  cost: Record<string, number>;
  /** 成功奖励：资源 ID → 数量 */
  rewards: Record<string, number>;
  /** 失败奖励（可选）：资源 ID → 数量 */
  failureRewards?: Record<string, number>;
  /** 基础成功率（0~1） */
  baseSuccessRate: number;
  /** 前置远征 ID（可选） */
  requires?: string;
  /** 所需船员数量 */
  crewRequired: number;
  /** 难度等级 */
  difficulty: number;
  /** 是否可重复 */
  repeatable: boolean;
  /** 自定义解锁条件（可选）：统计键 → 最小值 */
  unlockCondition?: Record<string, number>;
}

/** 活跃远征（运行时状态） */
export interface ActiveExpedition {
  /** 关联的远征定义 ID */
  defId: string;
  /** 本次远征实例唯一标识 */
  instanceId: string;
  /** 开始时间戳（毫秒） */
  startTime: number;
  /** 结束时间戳（毫秒） */
  endTime: number;
  /** 当前进度（0~1） */
  progress: number;
  /** 参与船员 ID 列表 */
  crew: string[];
  /** 实际成功率（经过难度和船员加成后） */
  successRate: number;
}

/** 远征统计 */
export interface ExpeditionStats {
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failCount: number;
  /** 总执行次数 */
  totalRuns: number;
  /** 累计获得奖励：资源 ID → 数量 */
  totalRewardsEarned: Record<string, number>;
}

/**
 * 远征系统持久化状态
 *
 * 内部使用 Set<string> 存储 completed / unlocked，
 * 序列化时自动转换为数组以支持 JSON。
 */
export interface ExpeditionState {
  /** 活跃远征列表 */
  active: ActiveExpedition[];
  /** 已完成的远征定义 ID 集合 */
  completed: Set<string>;
  /** 已解锁的远征定义 ID 集合 */
  unlocked: Set<string>;
  /** 按远征定义 ID 分组的统计 */
  stats: Record<string, ExpeditionStats>;
}

/** 远征系统事件 */
export interface ExpeditionEvent {
  /** 事件类型 */
  type:
    | 'expedition_started'
    | 'expedition_completed'
    | 'expedition_failed'
    | 'expedition_unlocked'
    | 'progress_updated';
  /** 事件附加数据 */
  data?: Record<string, unknown>;
}

// ============================================================
// 内部工具：轻量级事件总线
// ============================================================

/**
 * 轻量级事件总线 — 模块内部使用，零外部依赖
 *
 * 使用简单的回调数组实现发布/订阅模式。
 *
 * @typeParam T - 事件类型
 */
class SimpleEventBus<T> {
  /** 已注册的监听器回调列表 */
  private readonly listeners: Array<(event: T) => void> = [];

  /**
   * 注册事件监听器
   *
   * @param callback - 事件回调函数
   * @returns 取消订阅函数（调用即移除该监听器）
   */
  on(callback: (event: T) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx !== -1) {
        this.listeners.splice(idx, 1);
      }
    };
  }

  /**
   * 发布事件，通知所有已注册的监听器
   *
   * 使用 try-catch 保护每个监听器调用，
   * 确保单个监听器的异常不会影响其他监听器或系统主流程。
   *
   * @param event - 要发布的事件对象
   */
  emit(event: T): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // 静默吞掉监听器异常，保护系统稳定性
      }
    }
  }

  /**
   * 移除所有已注册的监听器
   */
  clear(): void {
    this.listeners.length = 0;
  }
}

// ============================================================
// ExpeditionSystem 实现
// ============================================================

/**
 * 远征系统 — 管理远征定义、解锁、发起、进度、结算、统计
 *
 * @typeParam Def - 远征定义类型，必须继承 ExpeditionDef
 *
 * @example
 * ```typescript
 * const system = new ExpeditionSystem([
 *   {
 *     id: 'forest',
 *     name: '森林探索',
 *     description: '探索神秘森林',
 *     duration: 30_000,
 *     cost: { gold: 100 },
 *     rewards: { wood: 500, herb: 50 },
 *     failureRewards: { wood: 100 },
 *     baseSuccessRate: 0.8,
 *     crewRequired: 2,
 *     difficulty: 1,
 *     repeatable: true,
 *   },
 * ]);
 *
 * // 检查并开始远征
 * if (system.canStart('forest', ['hero1', 'hero2'], { gold: 100 })) {
 *   const active = system.start('forest', ['hero1', 'hero2'], { gold: 100 });
 *   // active!.instanceId → 实例 ID
 * }
 *
 * // 每帧更新进度
 * system.update(deltaMs);
 *
 * // 监听事件
 * const unsub = system.onEvent((event) => {
 *   if (event.type === 'expedition_completed') {
 *     console.log('远征成功！数据:', event.data);
 *   }
 * });
 * ```
 */
export class ExpeditionSystem<Def extends ExpeditionDef = ExpeditionDef> {

  // ========== 内部数据 ==========

  /** 远征定义数组（只读，构造时确定） */
  private readonly defs: Def[];

  /** 远征定义索引（id → Def），加速查找 */
  private readonly defsById: Map<string, Def>;

  /** 活跃远征列表 */
  private active: ActiveExpedition[];

  /** 已完成的远征定义 ID 集合 */
  private completed: Set<string>;

  /** 已解锁的远征定义 ID 集合 */
  private unlocked: Set<string>;

  /** 按远征定义 ID 分组的统计 */
  private stats: Record<string, ExpeditionStats>;

  /** 实例 ID 自增计数器，确保唯一性 */
  private instanceCounter: number;

  /** 内部事件总线 */
  private readonly eventBus: SimpleEventBus<ExpeditionEvent>;

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 创建远征系统实例
   *
   * 初始化定义索引、空状态集合，并自动解锁
   * 没有前置条件（requires）且没有自定义解锁条件（unlockCondition）的远征。
   *
   * @param defs - 远征定义数组
   */
  constructor(defs: Def[]) {
    this.defs = [...defs];
    this.defsById = new Map<string, Def>();
    for (const def of defs) {
      this.defsById.set(def.id, def);
    }

    this.active = [];
    this.completed = new Set<string>();
    this.unlocked = new Set<string>();
    this.stats = {};
    this.instanceCounter = 0;
    this.eventBus = new SimpleEventBus<ExpeditionEvent>();

    // 自动解锁没有前置条件且没有自定义解锁条件的远征
    for (const def of defs) {
      if (!def.requires && !def.unlockCondition) {
        this.unlocked.add(def.id);
      }
    }
  }

  // ============================================================
  // 查询方法
  // ============================================================

  /**
   * 检查远征是否已解锁
   *
   * 解锁条件：
   * 1. 没有前置远征（requires）且没有自定义条件（unlockCondition）→ 构造时自动解锁
   * 2. 有前置远征 → 前置远征必须已完成（在 completed 集合中）
   * 3. 有自定义条件 → 由 checkUnlocks() 方法根据外部统计判定
   *
   * @param id - 远征定义 ID
   * @returns 是否已解锁
   */
  isUnlocked(id: string): boolean {
    return this.unlocked.has(id);
  }

  /**
   * 检查是否可以开始指定远征
   *
   * 综合检查五项条件：
   * 1. 远征定义存在
   * 2. 远征已解锁
   * 3. 如果不可重复，确认尚未完成
   * 4. 资源满足消耗需求
   * 5. 船员数量满足最低要求
   * 6. 该远征当前没有正在进行的实例（未在进行）
   *
   * @param id        - 远征定义 ID
   * @param crew      - 参与船员 ID 列表
   * @param resources - 当前可用资源：资源 ID → 数量（不会被修改）
   * @returns 是否可以开始
   */
  canStart(id: string, crew: string[], resources: Record<string, number>): boolean {
    const def = this.defsById.get(id);
    if (!def) {
      return false;
    }

    // 1. 检查是否已解锁
    if (!this.unlocked.has(id)) {
      return false;
    }

    // 2. 不可重复的远征只能完成一次
    if (!def.repeatable && this.completed.has(id)) {
      return false;
    }

    // 3. 检查船员数量
    if (crew.length < def.crewRequired) {
      return false;
    }

    // 4. 检查资源是否充足
    for (const [resourceId, amount] of Object.entries(def.cost)) {
      const available = resources[resourceId] ?? 0;
      if (available < amount) {
        return false;
      }
    }

    // 5. 该远征不能已有正在进行的实例（未在进行）
    if (this.active.some((exp) => exp.defId === id)) {
      return false;
    }

    return true;
  }

  /**
   * 获取所有活跃远征列表
   *
   * 返回内部活跃远征数组的深拷贝（每个元素也是独立对象），
   * 外部修改不影响内部状态。
   *
   * @returns 活跃远征只读列表
   */
  getActiveExpeditions(): readonly ActiveExpedition[] {
    return this.active.map((exp) => ({
      ...exp,
      crew: [...exp.crew],
    }));
  }

  /**
   * 获取指定远征的统计数据
   *
   * 返回统计的深拷贝，外部修改不影响内部状态。
   *
   * @param id - 远征定义 ID
   * @returns 统计数据副本，未找到时返回 null
   */
  getStats(id: string): ExpeditionStats | null {
    const stat = this.stats[id];
    if (!stat) {
      return null;
    }
    return {
      successCount: stat.successCount,
      failCount: stat.failCount,
      totalRuns: stat.totalRuns,
      totalRewardsEarned: { ...stat.totalRewardsEarned },
    };
  }

  /**
   * 获取远征定义
   *
   * @param id - 远征定义 ID
   * @returns 远征定义，未找到时返回 undefined
   */
  getDef(id: string): Def | undefined {
    return this.defsById.get(id);
  }

  /**
   * 获取所有远征定义
   *
   * @returns 远征定义数组的浅拷贝
   */
  getAllDefs(): Def[] {
    return [...this.defs];
  }

  // ============================================================
  // 操作方法
  // ============================================================

  /**
   * 开始远征
   *
   * 执行流程：
   * 1. 通过 canStart 进行完整的前置检查
   * 2. **从 resources 中扣除消耗资源**（直接修改传入的 resources 对象）
   * 3. 生成唯一实例 ID（自增计数器 + 时间戳）
   * 4. 计算实际成功率（基础成功率 + 船员额外加成，上限 1.0）
   * 5. 创建活跃远征记录并加入活跃列表
   * 6. 触发 expedition_started 事件
   *
   * ⚠️ **副作用警告**：此方法会 **直接修改** 传入的 `resources` 对象，
   * 从中扣除远征消耗的资源（即 `def.cost` 中定义的数量）。
   * 调用方应意识到传入的 `resources` 对象在方法返回后会被改变。
   * 如需保留原始资源数据，请在调用前自行深拷贝。
   *
   * @param id        - 远征定义 ID
   * @param crew      - 参与船员 ID 列表
   * @param resources - 当前可用资源（**⚠️ 将被直接修改，扣除远征消耗量**）
   * @returns 活跃远征对象副本，不可开始时返回 null
   */
  start(id: string, crew: string[], resources: Record<string, number>): ActiveExpedition | null {
    // 前置检查
    if (!this.canStart(id, crew, resources)) {
      return null;
    }

    const def = this.defsById.get(id)!;

    // 扣除资源（直接修改传入的 resources 对象）
    for (const [resourceId, amount] of Object.entries(def.cost)) {
      resources[resourceId] = (resources[resourceId] ?? 0) - amount;
    }

    // 生成唯一实例 ID
    this.instanceCounter += 1;
    const instanceId = `exp_${id}_${this.instanceCounter}_${Date.now()}`;

    // 计算实际成功率：
    // 基础成功率 + 船员额外加成（每多一个船员增加 2% 成功率），上限 1.0
    const crewBonus = Math.max(0, crew.length - def.crewRequired) * 0.02;
    const successRate = Math.min(1, Math.max(0, def.baseSuccessRate + crewBonus));

    const now = Date.now();

    const expedition: ActiveExpedition = {
      defId: id,
      instanceId,
      startTime: now,
      endTime: now + def.duration,
      progress: 0,
      crew: [...crew],
      successRate,
    };

    this.active.push(expedition);

    // 触发 expedition_started 事件
    this.eventBus.emit({
      type: 'expedition_started',
      data: {
        expeditionId: id,
        instanceId,
        crew: [...crew],
        successRate,
        startTime: now,
        endTime: now + def.duration,
      },
    });

    // 返回深拷贝，防止外部修改内部状态
    return {
      ...expedition,
      crew: [...expedition.crew],
    };
  }

  /**
   * 每帧更新所有活跃远征的进度
   *
   * 遍历所有活跃远征，基于 Date.now() 计算实际进度。
   * 当进度达到 1.0 时，自动调用 complete() 进行结算。
   *
   * 注意：进度计算依赖 Date.now() 而非 dt 参数，
   * dt 仅作为最小时间增量阈值（dt <= 0 时跳过更新）。
   *
   * @param dt - 距上次更新的时间增量（毫秒），用于判断是否需要更新
   */
  update(dt: number): void {
    if (dt <= 0) {
      return;
    }

    const toComplete: string[] = [];

    for (const expedition of this.active) {
      const def = this.defsById.get(expedition.defId);
      if (!def) {
        continue;
      }

      // 计算总时长
      const totalDuration = expedition.endTime - expedition.startTime;
      if (totalDuration <= 0) {
        expedition.progress = 1;
        toComplete.push(expedition.instanceId);
        continue;
      }

      // 基于 Date.now() 计算已过时间
      const elapsed = Date.now() - expedition.startTime;
      const newProgress = Math.min(1, elapsed / totalDuration);

      // 触发 progress_updated 事件（仅在进度有变化时）
      if (newProgress !== expedition.progress) {
        expedition.progress = newProgress;
        this.eventBus.emit({
          type: 'progress_updated',
          data: {
            expeditionId: expedition.defId,
            instanceId: expedition.instanceId,
            progress: expedition.progress,
          },
        });
      }

      // 进度满时标记为待完成
      if (expedition.progress >= 1) {
        toComplete.push(expedition.instanceId);
      }
    }

    // 自动完成已到时间的远征（倒序遍历，避免 splice 索引偏移）
    for (const instanceId of toComplete) {
      this.complete(instanceId);
    }
  }

  /**
   * 完成指定远征实例
   *
   * 执行流程：
   * 1. 查找活跃远征并从活跃列表移除
   * 2. 基于成功率进行成功/失败掷骰判定
   * 3. 根据判定结果分配奖励（成功给 rewards，失败给 failureRewards）
   * 4. 更新完成记录和统计数据
   * 5. 触发 expedition_completed 或 expedition_failed 事件
   *
   * 掷骰机制：使用确定性哈希函数（基于 instanceId + defId），
   * 确保相同输入产生相同判定结果，支持重放和调试。
   *
   * @param instanceId - 远征实例 ID
   * @returns 完成结果（包含成功标志和奖励），未找到实例时返回 null
   */
  complete(instanceId: string): { success: boolean; rewards: Record<string, number> } | null {
    // 查找活跃远征
    const index = this.active.findIndex((exp) => exp.instanceId === instanceId);
    if (index === -1) {
      return null;
    }

    const expedition = this.active[index];
    const def = this.defsById.get(expedition.defId);
    if (!def) {
      return null;
    }

    // 从活跃列表移除
    this.active.splice(index, 1);

    // 成功/失败判定：确定性哈希掷骰
    const roll = this.deterministicRandom(instanceId, expedition.defId);
    const success = roll < expedition.successRate;

    // 计算奖励
    const rewards: Record<string, number> = {};
    if (success) {
      // 成功：给予完整奖励
      for (const [resourceId, amount] of Object.entries(def.rewards)) {
        rewards[resourceId] = amount;
      }
    } else {
      // 失败：给予失败奖励（如果有定义）
      if (def.failureRewards) {
        for (const [resourceId, amount] of Object.entries(def.failureRewards)) {
          rewards[resourceId] = amount;
        }
      }
    }

    // 更新完成记录
    this.completed.add(expedition.defId);

    // 更新统计
    this.ensureStats(expedition.defId);
    const stat = this.stats[expedition.defId];
    stat.totalRuns += 1;

    if (success) {
      stat.successCount += 1;
    } else {
      stat.failCount += 1;
    }

    // 累计奖励到统计
    for (const [resourceId, amount] of Object.entries(rewards)) {
      stat.totalRewardsEarned[resourceId] =
        (stat.totalRewardsEarned[resourceId] ?? 0) + amount;
    }

    // 触发对应事件
    this.eventBus.emit({
      type: success ? 'expedition_completed' : 'expedition_failed',
      data: {
        expeditionId: expedition.defId,
        instanceId,
        success,
        rewards: { ...rewards },
      },
    });

    return { success, rewards };
  }

  /**
   * 加速指定远征
   *
   * 减少远征的结束时间，使进度加快。
   * 加速后不会立即完成远征——完成由 update() 驱动。
   * 结束时间不会早于开始时间。
   *
   * @param instanceId  - 远征实例 ID
   * @param reductionMs - 减少的时间（毫秒），必须 > 0
   */
  speedUp(instanceId: string, reductionMs: number): void {
    if (reductionMs <= 0) {
      return;
    }

    const expedition = this.active.find((exp) => exp.instanceId === instanceId);
    if (!expedition) {
      return;
    }

    expedition.endTime -= reductionMs;

    // 防止结束时间早于开始时间
    if (expedition.endTime < expedition.startTime) {
      expedition.endTime = expedition.startTime;
    }
  }

  /**
   * 检查并解锁满足条件的远征
   *
   * 遍历所有未解锁的远征定义，检查其解锁条件：
   * 1. 前置远征条件（requires）：前置远征必须在 completed 集合中
   * 2. 自定义解锁条件（unlockCondition）：每个统计键值必须 >= 最小值
   *
   * @param stats - 当前游戏统计数据：统计键 → 数值
   * @returns 新解锁的远征定义 ID 列表
   */
  checkUnlocks(stats: Record<string, number>): string[] {
    const newlyUnlocked: string[] = [];

    for (const def of this.defs) {
      // 跳过已解锁的
      if (this.unlocked.has(def.id)) {
        continue;
      }

      // 检查前置远征条件
      if (def.requires && !this.completed.has(def.requires)) {
        continue;
      }

      // 检查自定义解锁条件
      if (def.unlockCondition) {
        let conditionsMet = true;
        for (const [statKey, minValue] of Object.entries(def.unlockCondition)) {
          const currentValue = stats[statKey] ?? 0;
          if (currentValue < minValue) {
            conditionsMet = false;
            break;
          }
        }
        if (!conditionsMet) {
          continue;
        }
      }

      // 所有条件满足，解锁
      this.unlocked.add(def.id);
      newlyUnlocked.push(def.id);

      // 触发 expedition_unlocked 事件
      this.eventBus.emit({
        type: 'expedition_unlocked',
        data: { expeditionId: def.id },
      });
    }

    return newlyUnlocked;
  }

  // ============================================================
  // 序列化 / 反序列化
  // ============================================================

  /**
   * 序列化当前状态为可 JSON 序列化的纯对象
   *
   * Set 集合转换为数组，所有对象进行深拷贝。
   * ExpeditionState 中 Set<string> 字段在此处序列化为 string[]。
   *
   * @returns 状态对象
   */
  serialize(): Record<string, unknown> {
    return {
      active: this.active.map((exp) => ({
        defId: exp.defId,
        instanceId: exp.instanceId,
        startTime: exp.startTime,
        endTime: exp.endTime,
        progress: exp.progress,
        crew: [...exp.crew],
        successRate: exp.successRate,
      })),
      completed: [...this.completed],
      unlocked: [...this.unlocked],
      stats: this.serializeStats(),
      instanceCounter: this.instanceCounter,
    };
  }

  /**
   * 反序列化恢复状态
   *
   * 从存档数据恢复所有运行时状态。
   * 无效数据会被静默忽略，确保系统稳定性。
   * 数组字段自动转换回 Set<string>。
   *
   * @param data - 存档状态对象（由 serialize() 生成）
   */
  deserialize(data: Record<string, unknown>): void {
    // 恢复活跃远征
    if (Array.isArray(data.active)) {
      this.active = [];
      for (const item of data.active) {
        if (this.isValidActiveExpedition(item)) {
          this.active.push({
            defId: item.defId,
            instanceId: item.instanceId,
            startTime: item.startTime,
            endTime: item.endTime,
            progress: item.progress,
            crew: Array.isArray(item.crew) ? [...(item.crew as string[])] : [],
            successRate: item.successRate,
          });
        }
      }
    }

    // 恢复已完成列表（数组 → Set）
    if (Array.isArray(data.completed)) {
      this.completed = new Set<string>();
      for (const id of data.completed) {
        if (typeof id === 'string') {
          this.completed.add(id);
        }
      }
    }

    // 恢复已解锁列表（数组 → Set）
    if (Array.isArray(data.unlocked)) {
      this.unlocked = new Set<string>();
      for (const id of data.unlocked) {
        if (typeof id === 'string') {
          this.unlocked.add(id);
        }
      }
    }

    // 恢复统计
    if (data.stats && typeof data.stats === 'object' && !Array.isArray(data.stats)) {
      this.stats = {};
      const statsData = data.stats as Record<string, unknown>;
      for (const [id, statObj] of Object.entries(statsData)) {
        if (statObj && typeof statObj === 'object' && !Array.isArray(statObj)) {
          const s = statObj as Record<string, unknown>;
          this.stats[id] = {
            successCount: typeof s.successCount === 'number' ? s.successCount : 0,
            failCount: typeof s.failCount === 'number' ? s.failCount : 0,
            totalRuns: typeof s.totalRuns === 'number' ? s.totalRuns : 0,
            totalRewardsEarned:
              typeof s.totalRewardsEarned === 'object' &&
              s.totalRewardsEarned !== null &&
              !Array.isArray(s.totalRewardsEarned)
                ? { ...(s.totalRewardsEarned as Record<string, number>) }
                : {},
          };
        }
      }
    }

    // 恢复实例计数器
    if (typeof data.instanceCounter === 'number') {
      this.instanceCounter = data.instanceCounter;
    }
  }

  /**
   * 完全重置远征系统
   *
   * 将所有状态恢复到初始值：
   * - 清空活跃远征列表
   * - 清空完成记录
   * - 重新自动解锁无前置条件的远征
   * - 清空统计数据
   * - 重置实例计数器
   *
   * 注意：不会清除事件监听器，保持 UI 层绑定。
   */
  reset(): void {
    this.active = [];
    this.completed = new Set<string>();
    this.unlocked = new Set<string>();
    this.stats = {};
    this.instanceCounter = 0;

    // 重新自动解锁无前置条件的远征
    for (const def of this.defs) {
      if (!def.requires && !def.unlockCondition) {
        this.unlocked.add(def.id);
      }
    }
  }

  // ============================================================
  // 事件系统
  // ============================================================

  /**
   * 注册事件监听器
   *
   * 监听远征系统的所有事件类型：
   * - expedition_started   远征开始
   * - expedition_completed 远征成功完成
   * - expedition_failed    远征失败
   * - expedition_unlocked  远征解锁
   * - progress_updated     进度更新
   *
   * 返回一个取消订阅函数，调用即可移除该监听器。
   *
   * @param callback - 事件回调函数
   * @returns 取消订阅函数
   *
   * @example
   * ```typescript
   * const unsubscribe = system.onEvent((event) => {
   *   if (event.type === 'expedition_completed') {
   *     console.log('远征成功！数据:', event.data);
   *   }
   * });
   *
   * // 取消监听
   * unsubscribe();
   * ```
   */
  onEvent(callback: (event: ExpeditionEvent) => void): () => void {
    return this.eventBus.on(callback);
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 确保指定远征的统计数据存在
   *
   * 如果统计不存在，创建初始统计对象。
   *
   * @param defId - 远征定义 ID
   */
  private ensureStats(defId: string): void {
    if (!this.stats[defId]) {
      this.stats[defId] = {
        successCount: 0,
        failCount: 0,
        totalRuns: 0,
        totalRewardsEarned: {},
      };
    }
  }

  /**
   * 序列化统计数据
   *
   * 将 stats Record 深拷贝为可序列化的纯对象。
   *
   * @returns 序列化后的统计对象
   */
  private serializeStats(): Record<string, ExpeditionStats> {
    const result: Record<string, ExpeditionStats> = {};
    for (const [id, stat] of Object.entries(this.stats)) {
      result[id] = {
        successCount: stat.successCount,
        failCount: stat.failCount,
        totalRuns: stat.totalRuns,
        totalRewardsEarned: { ...stat.totalRewardsEarned },
      };
    }
    return result;
  }

  /**
   * 确定性随机数生成
   *
   * 基于实例 ID 和远征 ID 生成一个 0~1 的确定性伪随机数。
   * 使用 DJB2 风格的哈希函数，确保：
   * - 相同输入产生相同结果（支持重放/调试）
   * - 不同实例产生不同结果（避免批量完成时全部相同判定）
   *
   * @param instanceId   - 远征实例 ID
   * @param expeditionId - 远征定义 ID
   * @returns 0~1 之间的伪随机数
   */
  private deterministicRandom(instanceId: string, expeditionId: string): number {
    let hash = 0;
    const combined = instanceId + ':' + expeditionId;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0; // |0 确保 32 位整数溢出安全
    }
    // 映射到 0~1 范围
    return Math.abs(hash % 10000) / 10000;
  }

  /**
   * 校验活跃远征数据有效性
   *
   * 用于 deserialize 时过滤无效数据，防止损坏的存档导致系统异常。
   *
   * @param item - 待校验的数据对象
   * @returns 是否为有效的 ActiveExpedition 数据
   */
  private isValidActiveExpedition(item: unknown): item is ActiveExpedition {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.defId === 'string' &&
      typeof obj.instanceId === 'string' &&
      typeof obj.startTime === 'number' &&
      typeof obj.endTime === 'number' &&
      typeof obj.progress === 'number' &&
      typeof obj.successRate === 'number'
    );
  }
}
