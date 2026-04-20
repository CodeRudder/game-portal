/**
 * 引擎层 — 任务追踪系统
 *
 * 实时检测任务进度变化，自动更新任务目标。
 * 通过 EventBus 监听各子系统事件，驱动任务进度。
 *
 * 功能覆盖：
 *   #19 任务追踪面板（进度实时更新部分）
 *   #20 任务跳转（任务目标→对应功能映射）
 *
 * @module engine/quest/QuestTrackerSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { ObjectiveType, QuestDef } from '../../core/quest';
import { OBJECTIVE_EVENT_MAP } from '../../core/quest';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 任务跳转映射 */
export interface QuestJumpTarget {
  /** 目标类型 */
  objectiveType: ObjectiveType;
  /** UI 路由路径 */
  route: string;
  /** 描述 */
  description: string;
}

/** 任务进度更新事件 */
export interface QuestProgressEvent {
  /** 任务实例 ID */
  instanceId: string;
  /** 目标 ID */
  objectiveId: string;
  /** 目标类型 */
  objectiveType: ObjectiveType;
  /** 当前进度 */
  currentCount: number;
  /** 目标数量 */
  targetCount: number;
}

// ─────────────────────────────────────────────
// 默认跳转映射
// ─────────────────────────────────────────────

/** 默认任务跳转映射 */
export const DEFAULT_JUMP_TARGETS: QuestJumpTarget[] = [
  { objectiveType: 'build_upgrade', route: '/buildings', description: '前往建筑' },
  { objectiveType: 'battle_clear', route: '/campaign', description: '前往战役' },
  { objectiveType: 'recruit_hero', route: '/heroes', description: '前往招募' },
  { objectiveType: 'collect_resource', route: '/resources', description: '前往资源' },
  { objectiveType: 'npc_interact', route: '/npc', description: '前往NPC' },
  { objectiveType: 'npc_gift', route: '/npc', description: '前往NPC' },
  { objectiveType: 'tech_research', route: '/tech', description: '前往科技' },
  { objectiveType: 'event_complete', route: '/events', description: '前往事件' },
  { objectiveType: 'daily_login', route: '/', description: '主页' },
  { objectiveType: 'reach_chapter', route: '/campaign', description: '前往战役' },
];

// ─────────────────────────────────────────────
// 任务追踪系统
// ─────────────────────────────────────────────

/**
 * 任务追踪系统
 *
 * 监听游戏事件，自动更新匹配的任务目标进度。
 * 提供任务跳转映射功能。
 */
export class QuestTrackerSystem implements ISubsystem {
  readonly name = 'questTracker';

  private deps!: ISystemDeps;
  private jumpTargets: Map<string, QuestJumpTarget> = new Map();
  private unsubscribeFns: Array<() => void> = [];
  private questSystem: { updateProgressByType: (type: string, count: number, params?: Record<string, unknown>) => void } | null = null;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.loadDefaultJumpTargets();
  }

  update(_dt: number): void {
    // 进度更新由事件驱动，无需帧更新
  }

  getState() {
    return {
      jumpTargets: new Map(this.jumpTargets),
    };
  }

  reset(): void {
    this.unsubscribe();
    this.jumpTargets.clear();
  }

  // ─── 绑定任务系统 ──────────────────────────

  /**
   * 绑定 QuestSystem 实例
   *
   * QuestTrackerSystem 需要引用 QuestSystem 来更新进度。
   *
   * @param questSystem - QuestSystem 实例
   */
  bindQuestSystem(questSystem: { updateProgressByType: (type: string, count: number, params?: Record<string, unknown>) => void }): void {
    this.questSystem = questSystem;
  }

  /**
   * 启动事件监听
   *
   * 注册所有目标类型对应的事件监听器。
   * 必须在 bindQuestSystem 之后调用。
   */
  startTracking(): void {
    this.unsubscribe();

    for (const [objectiveType, eventName] of Object.entries(OBJECTIVE_EVENT_MAP)) {
      const unsub = this.deps.eventBus.on(eventName, (payload: unknown) => {
        this.handleGameEvent(objectiveType as ObjectiveType, payload);
      });
      this.unsubscribeFns.push(unsub);
    }
  }

  /** 停止事件监听 */
  unsubscribe(): void {
    for (const fn of this.unsubscribeFns) {
      fn();
    }
    this.unsubscribeFns = [];
  }

  // ─── 任务跳转（#20）──────────────────────────

  /** 注册跳转目标 */
  registerJumpTarget(target: QuestJumpTarget): void {
    this.jumpTargets.set(target.objectiveType, target);
  }

  /** 获取跳转目标 */
  getJumpTarget(objectiveType: ObjectiveType): QuestJumpTarget | undefined {
    return this.jumpTargets.get(objectiveType);
  }

  /** 获取所有跳转目标 */
  getAllJumpTargets(): QuestJumpTarget[] {
    return Array.from(this.jumpTargets.values());
  }

  /**
   * 获取任务定义的跳转路由
   *
   * 优先使用任务定义中的 jumpTarget，否则根据目标类型查找默认映射。
   *
   * @param questDef - 任务定义
   * @returns 跳转路由，无则返回 null
   */
  getQuestJumpRoute(questDef: QuestDef): string | null {
    // 优先使用任务定义的跳转
    if (questDef.jumpTarget) return questDef.jumpTarget;

    // 根据第一个未完成目标类型查找
    for (const objective of questDef.objectives) {
      const target = this.jumpTargets.get(objective.type);
      if (target) return target.route;
    }

    return null;
  }

  // ─── 序列化 ────────────────────────────────

  serialize(): { version: number } {
    return { version: 1 };
  }

  deserialize(_data: { version: number }): void {
    // 无状态需要恢复
  }

  // ─── 内部方法 ──────────────────────────────

  /** 加载默认跳转映射 */
  private loadDefaultJumpTargets(): void {
    for (const target of DEFAULT_JUMP_TARGETS) {
      this.jumpTargets.set(target.objectiveType, target);
    }
  }

  /** 处理游戏事件 */
  private handleGameEvent(objectiveType: ObjectiveType, payload: unknown): void {
    if (!this.questSystem) return;

    // 从事件 payload 中提取参数
    const params = this.extractParams(objectiveType, payload);

    // 更新进度
    this.questSystem.updateProgressByType(objectiveType, 1, params);
  }

  /** 从事件 payload 提取参数 */
  private extractParams(objectiveType: ObjectiveType, payload: unknown): Record<string, unknown> | undefined {
    if (!payload || typeof payload !== 'object') return undefined;

    const p = payload as Record<string, unknown>;

    switch (objectiveType) {
      case 'collect_resource':
        if (p.resource) return { resource: p.resource };
        return undefined;
      case 'build_upgrade':
        if (p.buildingType) return { buildingType: p.buildingType };
        return undefined;
      default:
        return undefined;
    }
  }
}
