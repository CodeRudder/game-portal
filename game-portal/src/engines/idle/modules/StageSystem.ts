/**
 * StageSystem — 阶段演进系统
 *
 * 提供阶段推进、条件检查、进度查询、倍率管理等完整功能。
 * 使用泛型 `StageSystem<Def>` 允许游戏自定义扩展 StageDef。
 * 适用于 8/28 款放置游戏。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 泛型设计，支持游戏自定义阶段定义
 * - 事件驱动，支持 UI 层监听阶段变化
 * - 完整的存档/读档支持
 * - 资源 + 条件双重检查机制
 *
 * @module engines/idle/modules/StageSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 阶段奖励 */
export interface StageReward {
  /** 奖励类型 */
  type: 'resource' | 'unit' | 'feature' | 'multiplier';
  /** 目标 ID（资源 ID、角色 ID、功能 ID 等） */
  targetId: string;
  /** 奖励数值 */
  value: number;
}

/** 阶段条件 */
export interface StageCondition {
  /** 条件类型（如 'level', 'building_level', 'unit_count' 等） */
  type: string;
  /** 目标 ID */
  targetId: string;
  /** 最小值要求 */
  minValue: number;
}

/** 阶段定义（基础接口） */
export interface StageDef {
  /** 阶段唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 阶段描述 */
  description: string;
  /** 排序序号（用于确定阶段顺序） */
  order: number;
  /** 前置阶段 ID（null 表示首个阶段） */
  prerequisiteStageId: string | null;
  /** 所需资源：资源 ID → 数量 */
  requiredResources: Record<string, number>;
  /** 所需条件列表 */
  requiredConditions: StageCondition[];
  /** 阶段奖励列表 */
  rewards: StageReward[];
  /** 产出倍率 */
  productionMultiplier: number;
  /** 战斗倍率 */
  combatMultiplier: number;
  /** 图标资源路径 */
  iconAsset: string;
  /** 主题颜色 */
  themeColor: string;
}

/** 阶段信息（含解锁状态） */
export interface StageInfo extends StageDef {
  /** 是否已解锁 */
  isUnlocked: boolean;
  /** 是否为当前阶段 */
  isCurrent: boolean;
}

/** 阶段系统事件 */
export interface StageSystemEvent {
  /** 事件类型 */
  type: 'advanced';
  /** 原阶段 ID */
  oldStageId: string;
  /** 新阶段 ID */
  newStageId: string;
}

/** 操作结果类型 */
export interface StageResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

// ============================================================
// StageSystem 实现
// ============================================================

/**
 * 阶段系统 — 管理阶段推进、条件检查、倍率计算
 *
 * @typeParam Def - 阶段定义类型，必须继承 StageDef
 *
 * @example
 * ```typescript
 * const system = new StageSystem(
 *   [
 *     {
 *       id: 'stage_1',
 *       name: '初始森林',
 *       description: '新手起步阶段',
 *       order: 1,
 *       prerequisiteStageId: null,
 *       requiredResources: {},
 *       requiredConditions: [],
 *       rewards: [],
 *       productionMultiplier: 1.0,
 *       combatMultiplier: 1.0,
 *       iconAsset: '/icons/forest.png',
 *       themeColor: '#4CAF50',
 *     },
 *     {
 *       id: 'stage_2',
 *       name: '黑暗洞穴',
 *       description: '深入地下的神秘洞穴',
 *       order: 2,
 *       prerequisiteStageId: 'stage_1',
 *       requiredResources: { gold: 500 },
 *       requiredConditions: [{ type: 'level', targetId: 'player', minValue: 5 }],
 *       rewards: [{ type: 'multiplier', targetId: 'production', value: 1.5 }],
 *       productionMultiplier: 1.5,
 *       combatMultiplier: 1.2,
 *       iconAsset: '/icons/cave.png',
 *       themeColor: '#607D8B',
 *     },
 *   ],
 *   'stage_1',
 * );
 *
 * const current = system.getCurrent();
 * console.log(`当前阶段: ${current.name}`);
 * ```
 */
export class StageSystem<Def extends StageDef = StageDef> {

  // ========== 内部数据 ==========

  /** 阶段定义注册表：stageId → Def（按 order 排序） */
  private readonly sortedDefs: Def[];

  /** 阶段定义查找表：stageId → Def */
  private readonly defsById: Map<string, Def> = new Map();

  /** 初始阶段 ID */
  private readonly initialStageId: string;

  /** 当前阶段 ID */
  private currentStageId: string;

  /** 已解锁的阶段 ID 集合 */
  private readonly unlockedStages: Set<string> = new Set();

  /** 事件监听器列表 */
  private readonly listeners: ((event: StageSystemEvent) => void)[] = [];

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 创建阶段系统实例
   *
   * 按 order 升序排列阶段定义，设置初始阶段为已解锁状态。
   *
   * @param definitions - 阶段定义数组
   * @param initialStageId - 初始阶段 ID（通常为第一个阶段）
   */
  constructor(definitions: Def[], initialStageId: string) {
    // 按 order 升序排序
    this.sortedDefs = [...definitions].sort((a, b) => a.order - b.order);

    // 构建查找表
    for (const def of this.sortedDefs) {
      this.defsById.set(def.id, def);
    }

    this.initialStageId = initialStageId;
    this.currentStageId = initialStageId;

    // 初始阶段自动解锁
    this.unlockedStages.add(initialStageId);
  }

  // ============================================================
  // 核心操作
  // ============================================================

  /**
   * 推进到下一阶段
   *
   * 检查当前阶段是否为最后一个、资源是否充足、条件是否满足。
   * 所有条件满足后推进到下一阶段，并触发 advanced 事件。
   *
   * @param currentResources - 当前玩家资源：资源 ID → 数量
   * @param conditionChecker - 条件检查函数：(type, targetId) → 当前值
   * @returns 操作结果，成功时包含新的阶段定义
   */
  advance(
    currentResources: Record<string, number>,
    conditionChecker: (type: string, targetId: string) => number,
  ): StageResult<Def> {
    const currentIndex = this.sortedDefs.findIndex((d) => d.id === this.currentStageId);

    if (currentIndex === -1) {
      return { ok: false, error: `当前阶段定义不存在: ${this.currentStageId}` };
    }

    // 检查是否为最后一个阶段
    if (currentIndex >= this.sortedDefs.length - 1) {
      return { ok: false, error: '已经是最后一个阶段，无法继续推进' };
    }

    const nextDef = this.sortedDefs[currentIndex + 1];

    // 检查前置阶段
    if (nextDef.prerequisiteStageId !== null && nextDef.prerequisiteStageId !== this.currentStageId) {
      return {
        ok: false,
        error: `前置阶段未完成: ${nextDef.prerequisiteStageId}`,
      };
    }

    // 检查资源需求
    for (const [resourceId, required] of Object.entries(nextDef.requiredResources)) {
      const current = currentResources[resourceId] ?? 0;
      if (current < required) {
        return {
          ok: false,
          error: `资源不足: ${resourceId}（需要 ${required}，当前 ${current}）`,
        };
      }
    }

    // 检查条件需求
    for (const condition of nextDef.requiredConditions) {
      const currentValue = conditionChecker(condition.type, condition.targetId);
      if (currentValue < condition.minValue) {
        return {
          ok: false,
          error: `条件未满足: ${condition.type}/${condition.targetId}（需要 ${condition.minValue}，当前 ${currentValue}）`,
        };
      }
    }

    // 推进阶段
    const oldStageId = this.currentStageId;
    this.currentStageId = nextDef.id;
    this.unlockedStages.add(nextDef.id);

    this.emitEvent({
      type: 'advanced',
      oldStageId,
      newStageId: nextDef.id,
    });

    return { ok: true, value: nextDef };
  }

  // ============================================================
  // 查询
  // ============================================================

  /**
   * 获取当前阶段定义
   *
   * @returns 当前阶段的定义
   */
  getCurrent(): Def {
    return this.defsById.get(this.currentStageId)!;
  }

  /**
   * 获取当前阶段 ID
   *
   * @returns 当前阶段 ID
   */
  getCurrentId(): string {
    return this.currentStageId;
  }

  /**
   * 获取当前阶段的倍率
   *
   * @param type - 倍率类型：'production' 或 'combat'
   * @returns 倍率值
   */
  getMultiplier(type: 'production' | 'combat'): number {
    const current = this.getCurrent();
    if (type === 'production') {
      return current.productionMultiplier;
    }
    return current.combatMultiplier;
  }

  /**
   * 获取所有阶段信息（含解锁状态）
   *
   * 返回所有阶段的完整信息，包括是否已解锁和是否为当前阶段。
   * 按 order 升序排列。
   *
   * @returns 阶段信息数组
   */
  getAllStages(): StageInfo[] {
    return this.sortedDefs.map((def) => ({
      ...def,
      isUnlocked: this.unlockedStages.has(def.id),
      isCurrent: def.id === this.currentStageId,
    }));
  }

  /**
   * 获取下一阶段预览
   *
   * @returns 下一阶段的定义，若已是最后阶段则返回 null
   */
  getNextStage(): Def | null {
    const currentIndex = this.sortedDefs.findIndex((d) => d.id === this.currentStageId);
    if (currentIndex === -1 || currentIndex >= this.sortedDefs.length - 1) {
      return null;
    }
    return this.sortedDefs[currentIndex + 1];
  }

  /**
   * 检查是否可以推进到下一阶段
   *
   * 不执行推进，仅做条件检查。
   *
   * @param currentResources - 当前玩家资源
   * @param conditionChecker - 条件检查函数
   * @returns 是否满足推进条件
   */
  canAdvance(
    currentResources: Record<string, number>,
    conditionChecker: (type: string, targetId: string) => number,
  ): boolean {
    const currentIndex = this.sortedDefs.findIndex((d) => d.id === this.currentStageId);

    // 已是最后阶段
    if (currentIndex === -1 || currentIndex >= this.sortedDefs.length - 1) {
      return false;
    }

    const nextDef = this.sortedDefs[currentIndex + 1];

    // 检查前置阶段
    if (nextDef.prerequisiteStageId !== null && nextDef.prerequisiteStageId !== this.currentStageId) {
      return false;
    }

    // 检查资源需求
    for (const [resourceId, required] of Object.entries(nextDef.requiredResources)) {
      const current = currentResources[resourceId] ?? 0;
      if (current < required) {
        return false;
      }
    }

    // 检查条件需求
    for (const condition of nextDef.requiredConditions) {
      const currentValue = conditionChecker(condition.type, condition.targetId);
      if (currentValue < condition.minValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * 获取推进进度
   *
   * 计算当前资源相对于下一阶段需求的完成度。
   * 返回每个资源的当前值、需求值和是否达标，以及整体进度百分比。
   *
   * @param currentResources - 当前玩家资源
   * @returns 进度信息
   */
  getProgress(currentResources: Record<string, number>): {
    stageId: string;
    resourceProgress: Record<string, { current: number; required: number; met: boolean }>;
    overallProgress: number;
  } {
    const nextDef = this.getNextStage();

    if (!nextDef) {
      // 已是最后阶段，进度为 100%
      return {
        stageId: this.currentStageId,
        resourceProgress: {},
        overallProgress: 1,
      };
    }

    const resourceProgress: Record<string, { current: number; required: number; met: boolean }> = {};
    let totalRatio = 0;
    let resourceCount = 0;

    for (const [resourceId, required] of Object.entries(nextDef.requiredResources)) {
      const current = currentResources[resourceId] ?? 0;
      const met = current >= required;
      resourceProgress[resourceId] = { current, required, met };
      totalRatio += Math.min(current / required, 1);
      resourceCount += 1;
    }

    const overallProgress = resourceCount > 0 ? totalRatio / resourceCount : 1;

    return {
      stageId: nextDef.id,
      resourceProgress,
      overallProgress,
    };
  }

  // ============================================================
  // 存档 / 读档
  // ============================================================

  /**
   * 序列化当前状态
   *
   * @returns 包含当前阶段 ID 的状态对象
   */
  saveState(): { currentStageId: string } {
    return { currentStageId: this.currentStageId };
  }

  /**
   * 反序列化恢复状态
   *
   * 从存档数据恢复当前阶段。无效的阶段 ID 会被静默忽略。
   * 对 state 参数本身及 currentStageId 字段均做严格的类型校验，
   * 确保传入 null / undefined / 非对象等异常值时不会抛出运行时异常。
   *
   * @param state - 存档状态对象
   */
  loadState(state: { currentStageId: string }): void {
    // ---- 第一层：state 本身必须是合法的非空对象 ----
    if (state == null || typeof state !== 'object') {
      return;
    }

    // ---- 第二层：提取并校验 currentStageId 字段 ----
    const { currentStageId } = state as Record<string, unknown>;

    if (
      typeof currentStageId !== 'string' ||
      currentStageId.trim().length === 0 ||
      !this.defsById.has(currentStageId)
    ) {
      // 非法值（null、undefined、非字符串、空白串、未注册 ID）静默忽略
      return;
    }

    // ---- 第三层：安全恢复 — 解锁从初始阶段到目标阶段之间的所有阶段 ----
    const targetIndex = this.sortedDefs.findIndex((d) => d.id === currentStageId);
    for (let i = 0; i <= targetIndex; i++) {
      this.unlockedStages.add(this.sortedDefs[i].id);
    }
    this.currentStageId = currentStageId;
  }

  /**
   * 重置到初始阶段
   *
   * 将当前阶段重置为初始阶段，清除所有解锁记录（仅保留初始阶段）。
   * 不会清除事件监听器。
   */
  reset(): void {
    this.currentStageId = this.initialStageId;
    this.unlockedStages.clear();
    this.unlockedStages.add(this.initialStageId);
  }

  // ============================================================
  // 事件系统
  // ============================================================

  /**
   * 注册事件监听器
   *
   * 监听阶段系统的所有事件（advanced）。
   * 返回一个取消订阅函数，调用即可移除该监听器。
   *
   * @param callback - 事件回调函数
   * @returns 取消订阅函数
   *
   * @example
   * ```typescript
   * const unsubscribe = system.onEvent((event) => {
   *   console.log(`阶段推进: ${event.oldStageId} → ${event.newStageId}`);
   * });
   *
   * // 取消监听
   * unsubscribe();
   * ```
   */
  onEvent(callback: (event: StageSystemEvent) => void): () => void {
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
   * 触发事件，通知所有监听器
   *
   * @param event - 事件对象
   */
  private emitEvent(event: StageSystemEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // 防止监听器异常影响系统运行
      }
    }
  }
}
