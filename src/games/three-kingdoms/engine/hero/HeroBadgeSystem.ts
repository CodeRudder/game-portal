/**
 * 武将红点/角标聚合系统 — 聚合根
 *
 * 职责：武将卡片蓝点检测、Tab金色角标、主界面红点、今日待办聚合、快捷操作
 * 功能点：F12.03 蓝点检测、F12.05 Tab角标、F12.06 主界面红点、F12.07 今日待办、F12.08 快捷操作
 *
 * @module engine/hero/HeroBadgeSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import { gameLog } from '../../core/logger';

// ── 类型 ──

/** 今日待办条目 */
export interface TodayTodoItem {
  /** 待办类型 */
  type: 'levelUp' | 'starUp' | 'equip' | 'recruit';
  /** 关联武将ID（recruit类型可能为空） */
  heroId?: string;
  /** 待办描述 */
  label: string;
  /** 操作标识 */
  action: string;
}

/** 快捷操作结果 */
export interface QuickActionResult {
  /** 操作是否成功 */
  success: boolean;
  /** 操作描述 */
  message: string;
  /** 操作影响的武将ID列表 */
  affectedHeroes: string[];
}

/** 角标系统状态 */
export interface BadgeSystemState {
  /** 主界面入口红点 */
  mainEntryRedDot: boolean;
  /** Tab升级角标数量 */
  tabLevelBadge: number;
  /** Tab升星角标数量 */
  tabStarBadge: number;
  /** 今日待办列表 */
  todayTodos: TodayTodoItem[];
}

/** 角标系统业务依赖 */
export interface BadgeSystemDeps {
  /** 获取所有武将ID */
  getGeneralIds: () => string[];
  /** 判断武将是否可升级 */
  canLevelUp: (heroId: string) => boolean;
  /** 判断武将是否可升星 */
  canStarUp: (heroId: string) => boolean;
  /** 判断武将是否有新装备可穿戴 */
  canEquip: (heroId: string) => boolean;
}

// ── HeroBadgeSystem ──

/**
 * 武将红点/角标聚合系统
 *
 * 聚合各子系统状态，提供红点/角标/待办等UI提示数据。
 */
export class HeroBadgeSystem implements ISubsystem {
  readonly name = 'heroBadge' as const;
  private coreDeps: ISystemDeps | null = null;
  private deps: BadgeSystemDeps;

  constructor() {
    // 默认空实现，等待业务依赖注入
    this.deps = {
      getGeneralIds: () => [],
      canLevelUp: () => false,
      canStarUp: () => false,
      canEquip: () => false,
    };
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void {
    this.coreDeps = deps;
    gameLog.info('[HeroBadgeSystem] initialized');
  }

  update(_dt: number): void {
    // 角标系统无需每帧更新
  }

  getState(): BadgeSystemState {
    return {
      mainEntryRedDot: this.hasMainEntryRedDot(),
      tabLevelBadge: this.getLevelBadgeCount(),
      tabStarBadge: this.getStarBadgeCount(),
      todayTodos: this.getTodayTodoList(),
    };
  }

  reset(): void {
    this.deps = {
      getGeneralIds: () => [],
      canLevelUp: () => false,
      canStarUp: () => false,
      canEquip: () => false,
    };
  }

  // ── 依赖注入 ──

  /** 注入业务依赖 */
  setBadgeSystemDeps(deps: BadgeSystemDeps): void {
    this.deps = deps;
  }

  // ═══════════════════════════════════════════
  // F12.03: 蓝点检测（新装备可穿戴）
  // ═══════════════════════════════════════════

  /**
   * 检测武将是否有新装备可穿戴（蓝点标记）
   * @param heroId - 武将ID
   * @returns 是否显示蓝点
   */
  canEquipNewEquipment(heroId: string): boolean {
    return this.deps.canEquip(heroId);
  }

  // ═══════════════════════════════════════════
  // F12.05: Tab升级角标数量
  // ═══════════════════════════════════════════

  /**
   * 获取可升级的武将数量（Tab角标）
   * @returns 可升级武将数量
   */
  getLevelBadgeCount(): number {
    return this.deps.getGeneralIds().filter(id => this.deps.canLevelUp(id)).length;
  }

  // ═══════════════════════════════════════════
  // F12.05: Tab升星角标数量（金色）
  // ═══════════════════════════════════════════

  /**
   * 获取可升星的武将数量（Tab金色角标）
   * @returns 可升星武将数量
   */
  getStarBadgeCount(): number {
    return this.deps.getGeneralIds().filter(id => this.deps.canStarUp(id)).length;
  }

  // ═══════════════════════════════════════════
  // F12.06: 主界面入口红点
  // ═══════════════════════════════════════════

  /**
   * 主界面入口是否显示红点
   *
   * 聚合条件：可升级 / 可升星 / 有新装备可穿戴
   * @returns 是否显示红点
   */
  hasMainEntryRedDot(): boolean {
    const ids = this.deps.getGeneralIds();
    return ids.some(id =>
      this.deps.canLevelUp(id) || this.deps.canStarUp(id) || this.deps.canEquip(id)
    );
  }

  // ═══════════════════════════════════════════
  // F12.07: 今日待办聚合
  // ═══════════════════════════════════════════

  /**
   * 获取今日待办列表
   *
   * 聚合所有武将相关的可操作事项。无待办时返回默认招募提示。
   * @returns 待办列表
   */
  getTodayTodoList(): TodayTodoItem[] {
    const todos: TodayTodoItem[] = [];
    const ids = this.deps.getGeneralIds();

    for (const id of ids) {
      if (this.deps.canLevelUp(id)) {
        todos.push({ type: 'levelUp', heroId: id, label: '武将可升级', action: 'levelUp' });
      }
      if (this.deps.canStarUp(id)) {
        todos.push({ type: 'starUp', heroId: id, label: '武将可升星', action: 'starUp' });
      }
      if (this.deps.canEquip(id)) {
        todos.push({ type: 'equip', heroId: id, label: '有新装备可穿戴', action: 'equip' });
      }
    }

    // 无待办时提示免费招募
    if (todos.length === 0) {
      todos.push({ type: 'recruit', label: '今日免费招募未使用', action: 'recruit' });
    }

    return todos;
  }

  // ═══════════════════════════════════════════
  // F12.08: 快捷操作
  // ═══════════════════════════════════════════

  /**
   * 执行快捷操作
   *
   * @param action - 操作类型
   * @returns 操作结果
   */
  executeQuickAction(action: 'levelUp' | 'starUp' | 'equip' | 'recruit'): QuickActionResult {
    const ids = this.deps.getGeneralIds();
    const affected: string[] = [];

    switch (action) {
      case 'levelUp':
        for (const id of ids) {
          if (this.deps.canLevelUp(id)) affected.push(id);
        }
        return {
          success: affected.length > 0,
          message: `${affected.length}名武将可升级`,
          affectedHeroes: affected,
        };

      case 'starUp':
        for (const id of ids) {
          if (this.deps.canStarUp(id)) affected.push(id);
        }
        return {
          success: affected.length > 0,
          message: `${affected.length}名武将可升星`,
          affectedHeroes: affected,
        };

      case 'equip':
        for (const id of ids) {
          if (this.deps.canEquip(id)) affected.push(id);
        }
        return {
          success: affected.length > 0,
          message: `${affected.length}名武将有新装备`,
          affectedHeroes: affected,
        };

      case 'recruit':
        return { success: true, message: '跳转招募界面', affectedHeroes: [] };
    }
  }
}
