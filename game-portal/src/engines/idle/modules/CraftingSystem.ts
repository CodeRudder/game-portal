/**
 * CraftingSystem — 放置游戏炼制/合成系统核心模块（P2）
 *
 * 提供配方注册、材料检查、炼制启动、进度推进、
 * 品质掷骰、完成结算等完整功能。
 * 泛型 `CraftingSystem<Def>` 允许游戏自定义扩展 RecipeDef。
 *
 * @module engines/idle/modules/CraftingSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 品质等级定义 */
export interface CraftQuality {
  name: string;
  /** 产出倍率（乘以配方基础产出） */
  multiplier: number;
  /** 掷骰权重（值越大越容易被选中） */
  weight: number;
  /** 显示颜色（CSS 颜色值） */
  color: string;
}

/** 配方定义（基础接口） */
export interface RecipeDef {
  id: string;
  name: string;
  /** 所需材料：物品ID → 数量 */
  ingredients: Record<string, number>;
  /** 基础产出：物品ID → 数量 */
  result: Record<string, number>;
  /** 基础成功率 (0~1) */
  successRate: number;
  /** 炼制时间（毫秒） */
  craftTime: number;
  qualities: CraftQuality[];
  /** 前置配方 ID（需先学习） */
  requires?: string;
  /** 解锁条件：资源ID → 所需数量 */
  unlockCondition?: Record<string, number>;
  /** 失败时的产出（部分返还） */
  failureResult?: Record<string, number>;
  /** 最大同时炼制数量 */
  maxConcurrent: number;
}

/** 活跃的炼制任务 */
export interface ActiveCraft {
  instanceId: string;
  recipeId: string;
  /** 开始时间戳（毫秒） */
  startTime: number;
  /** 预计完成时间戳（毫秒） */
  endTime: number;
  /** 当前进度 (0~1) */
  progress: number;
}

/** 炼制结果 */
export interface CraftResult {
  success: boolean;
  quality: string;
  /** 产出物品：物品ID → 数量 */
  output: Record<string, number>;
}

/** 炼制统计数据 */
export interface CraftingStats {
  totalCrafts: number;
  successCount: number;
  failCount: number;
  /** 品质分布：品质名 → 次数 */
  qualityDistribution: Record<string, number>;
}

/** 炼制系统状态（序列化用） */
export interface CraftingState {
  learned: Set<string>;
  active: ActiveCraft[];
  stats: CraftingStats;
}

/** 炼制事件 */
export interface CraftingEvent {
  type: 'started' | 'completed' | 'failed' | 'recipe_learned' | 'quality_hit';
  recipeId?: string;
  instanceId?: string;
  result?: CraftResult;
}

/** 兼容旧测试的内部事件格式 */
interface InternalEvent {
  type: 'craft_started' | 'craft_completed' | 'craft_failed' | 'recipe_learned' | 'quality_hit';
  data?: Record<string, unknown>;
}

/** 事件监听器函数类型 */
export type CraftingEventListener = (event: CraftingEvent) => void;

// ============================================================
// CraftingSystem 实现
// ============================================================

/**
 * 炼制/合成系统 — 管理配方注册、材料检查、炼制进度、品质掷骰、完成结算
 * @typeParam Def - 配方定义类型，必须继承 RecipeDef
 */
import { TimeSource } from './TimeSource';

export class CraftingSystem<Def extends RecipeDef = RecipeDef> {
  private readonly timeSource: TimeSource = TimeSource.default();
  /** 配方定义注册表 */
  private readonly defs: Map<string, Def> = new Map();
  /** 事件监听器回调数组（简单数组代替 EventBus） */
  private readonly listeners: Array<(event: InternalEvent) => void> = [];
  /** 已学习的配方 ID 集合 */
  private learned: Set<string> = new Set();
  /** 当前活跃的炼制任务列表 */
  private active: ActiveCraft[] = [];
  /** 炼制统计数据 */
  private stats: CraftingStats = {
    totalCrafts: 0, successCount: 0, failCount: 0, qualityDistribution: {},
  };
  /** 自增实例 ID 计数器 */
  private instanceIdCounter = 0;

  /** 创建炼制系统实例，注册传入的配方定义 */
  constructor(defs: Def[] = []) {
    for (const def of defs) {
      this.defs.set(def.id, def);
    }
  }

  /** 检查背包中是否拥有足够的材料 */
  checkIngredients(recipeId: string, inventory: Record<string, number>): boolean {
    const def = this.defs.get(recipeId);
    if (!def) return false;
    for (const [itemId, required] of Object.entries(def.ingredients)) {
      if ((inventory[itemId] ?? 0) < required) return false;
    }
    return true;
  }

  /**
   * 开始炼制
   * 验证学习状态、前置配方、并发上限、材料充足后，扣除材料并创建炼制任务。
   * @returns 炼制任务实例，条件不满足时返回 null
   */
  craft(recipeId: string, inventory: Record<string, number>): ActiveCraft | null {
    const def = this.defs.get(recipeId);
    if (!def || !this.learned.has(recipeId)) return null;
    if (def.requires && !this.learned.has(def.requires)) return null;
    // 检查并发上限
    const currentActive = this.active.filter((a) => a.recipeId === recipeId).length;
    if (currentActive >= def.maxConcurrent) return null;
    if (!this.checkIngredients(recipeId, inventory)) return null;
    // 扣除材料
    for (const [itemId, required] of Object.entries(def.ingredients)) {
      inventory[itemId] = (inventory[itemId] ?? 0) - required;
    }
    // 创建炼制任务
    const now = this.timeSource.now();
    const instance: ActiveCraft = {
      instanceId: `craft_${++this.instanceIdCounter}`,
      recipeId, startTime: now, endTime: now + def.craftTime, progress: 0,
    };
    this.active.push(instance);
    this.emitInternal({ type: 'craft_started', data: { instanceId: instance.instanceId, recipeId } });
    return { ...instance };
  }

  /**
   * 更新炼制进度
   * 推进所有活跃任务的进度，进度达到 1.0 时自动完成。
   * @param dt - 距上次更新的时间间隔（毫秒）
   */
  update(dt: number): void {
    if (this.active.length === 0) return;
    const now = this.timeSource.now();
    const completed: string[] = [];
    for (const craft of this.active) {
      if (craft.progress >= 1) continue;
      const def = this.defs.get(craft.recipeId);
      if (!def) continue;
      craft.progress = Math.min(1, (now - craft.startTime) / def.craftTime);
      if (craft.progress >= 1) completed.push(craft.instanceId);
    }
    for (const id of completed) this.completeCraft(id);
  }

  /**
   * 完成指定炼制任务
   * 执行成功/失败掷骰 + 品质掷骰，完成后从活跃列表移除。
   */
  completeCraft(instanceId: string): CraftResult {
    const idx = this.active.findIndex((c) => c.instanceId === instanceId);
    if (idx === -1) return { success: false, quality: '', output: {} };
    const craft = this.active[idx];
    const def = this.defs.get(craft.recipeId);
    this.active.splice(idx, 1);
    if (!def) return { success: false, quality: '', output: {} };
    this.stats.totalCrafts++;
    // 成功/失败掷骰
    if (Math.random() >= def.successRate) {
      this.stats.failCount++;
      const output: Record<string, number> = {};
      if (def.failureResult) {
        for (const [k, v] of Object.entries(def.failureResult)) output[k] = v;
      }
      this.emitInternal({ type: 'craft_failed', data: { instanceId, recipeId: craft.recipeId } });
      return { success: false, quality: '', output };
    }
    // 成功 → 品质掷骰
    this.stats.successCount++;
    const quality = this.rollQuality(def.qualities);
    this.stats.qualityDistribution[quality.name] = (this.stats.qualityDistribution[quality.name] ?? 0) + 1;
    const output: Record<string, number> = {};
    for (const [k, v] of Object.entries(def.result)) output[k] = Math.floor(v * quality.multiplier);
    this.emitInternal({ type: 'quality_hit', data: { instanceId, recipeId: craft.recipeId, quality: quality.name } });
    this.emitInternal({ type: 'craft_completed', data: { instanceId, recipeId: craft.recipeId, quality: quality.name, output } });
    return { success: true, quality: quality.name, output };
  }

  /** 学习配方，首次学习返回 true */
  learnRecipe(recipeId: string): boolean {
    if (!this.defs.has(recipeId) || this.learned.has(recipeId)) return false;
    this.learned.add(recipeId);
    this.emitInternal({ type: 'recipe_learned', data: { recipeId } });
    return true;
  }

  /** 检查配方是否已学习 */
  isLearned(recipeId: string): boolean {
    return this.learned.has(recipeId);
  }

  /** 获取活跃炼制任务列表（只读副本） */
  getActiveCrafts(): readonly ActiveCraft[] {
    return this.active.map((c) => ({ ...c }));
  }

  /** 获取炼制统计数据副本 */
  getStats(): CraftingStats {
    return {
      totalCrafts: this.stats.totalCrafts,
      successCount: this.stats.successCount,
      failCount: this.stats.failCount,
      qualityDistribution: { ...this.stats.qualityDistribution },
    };
  }

  /** 获取配方定义 */
  getRecipe(id: string): Def | undefined {
    return this.defs.get(id);
  }

  /** 保存系统状态（规范接口） */
  saveState(): Record<string, unknown> {
    return this.serialize();
  }

  /** 加载系统状态（规范接口） */
  loadState(data: Record<string, unknown>): void {
    this.deserialize(data);
  }

  /** 序列化炼制系统状态为纯对象 */
  serialize(): Record<string, unknown> {
    return {
      learned: Array.from(this.learned),
      active: this.active.map((c) => ({ ...c })),
      stats: {
        totalCrafts: this.stats.totalCrafts,
        successCount: this.stats.successCount,
        failCount: this.stats.failCount,
        qualityDistribution: { ...this.stats.qualityDistribution },
      },
      instanceIdCounter: this.instanceIdCounter,
    };
  }

  /** 从存档数据恢复运行时状态（配方定义不会被覆盖） */
  deserialize(data: Record<string, unknown>): void {
    this.learned = new Set((data.learned as string[] | undefined) ?? []);
    const savedActive = data.active as Array<Record<string, unknown>> | undefined;
    this.active = [];
    if (Array.isArray(savedActive)) {
      for (const cd of savedActive) {
        this.active.push({
          instanceId: cd.instanceId as string,
          recipeId: cd.recipeId as string,
          startTime: cd.startTime as number,
          endTime: cd.endTime as number,
          progress: cd.progress as number,
        });
      }
    }
    const s = data.stats as Record<string, unknown> | undefined;
    this.stats = s
      ? {
          totalCrafts: (s.totalCrafts as number) ?? 0,
          successCount: (s.successCount as number) ?? 0,
          failCount: (s.failCount as number) ?? 0,
          qualityDistribution: { ...(s.qualityDistribution as Record<string, number> ?? {}) },
        }
      : { totalCrafts: 0, successCount: 0, failCount: 0, qualityDistribution: {} };
    this.instanceIdCounter = (data.instanceIdCounter as number) ?? 0;
  }

  /** 重置到初始状态（保留已注册的配方定义） */
  reset(): void {
    this.learned = new Set();
    this.active = [];
    this.instanceIdCounter = 0;
    this.stats = { totalCrafts: 0, successCount: 0, failCount: 0, qualityDistribution: {} };
  }

  /**
   * 注册炼制事件监听器
   * @returns 取消监听的函数
   */
  onEvent(callback: (event: InternalEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const i = this.listeners.indexOf(callback);
      if (i !== -1) this.listeners.splice(i, 1);
    };
  }

  /** 内部事件发射 */
  private emitInternal(event: InternalEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  /** 品质掷骰：根据权重加权随机选择 */
  private rollQuality(qualities: CraftQuality[]): CraftQuality {
    if (qualities.length === 0) return { name: '普通', multiplier: 1.0, weight: 1, color: '#ffffff' };
    if (qualities.length === 1) return qualities[0];
    let totalWeight = 0;
    for (const q of qualities) totalWeight += q.weight;
    const roll = Math.random() * totalWeight;
    let cumulative = 0;
    for (const q of qualities) {
      cumulative += q.weight;
      if (roll < cumulative) return q;
    }
    return qualities[qualities.length - 1];
  }
}
