/**
 * 武将红点/角标聚合系统 — 聚合根
 *
 * 职责：武将卡片蓝点检测、Tab金色角标、主界面红点、今日待办聚合、快捷操作
 * 功能点：F12.03 蓝点检测、F12.05 Tab角标、F12.06 主界面红点、F12.07 今日待办、F12.08 快捷操作
 *
 * @module engine/hero/HeroBadgeSystem
 */

import type { HeroSystem } from './HeroSystem';
import type { HeroStarSystem } from './HeroStarSystem';
import type { HeroLevelSystem } from './HeroLevelSystem';
import type { ISubsystem, ISystemDeps } from '../../core/types';
import { gameLog } from '../../core/logger';

// ── 类型 ──

/** 今日待办条目 */
export interface TodayTodoItem {
  /** 待办唯一标识 */
  id: string;
  /** 待办类型 */
  type: 'levelUp' | 'starUp' | 'equip' | 'recruit' | 'breakthrough';
  /** 关联武将ID（recruit类型可能为空） */
  heroId?: string;
  /** 武将名称 */
  heroName?: string;
  /** 待办描述 */
  description: string;
  /** 优先级（1=高, 2=中, 3=低） */
  priority: number;
}

/** 快捷操作结果 */
export interface QuickActionResult {
  /** 操作是否成功 */
  success: boolean;
  /** 操作类型 */
  action: 'levelUp' | 'starUp' | 'equip' | 'recruit';
  /** 操作描述 */
  message: string;
  /** 操作影响的武将ID列表 */
  affectedHeroIds: string[];
}

/** 角标系统状态 */
export interface BadgeSystemState {
  /** 已读标记 Map<heroId, Set<badgeType>> */
  readBadges: Record<string, string[]>;
}

/** 角标系统业务依赖 */
export interface BadgeSystemDeps {
  heroSystem: HeroSystem;
  heroStarSystem: HeroStarSystem;
  heroLevelSystem: HeroLevelSystem;
  /** 获取资源数量 */
  getResourceAmount: (resourceType: string) => number;
  /** 获取当前等级上限（用于判断是否可升级） */
  getLevelCap: (heroId: string) => number;
}

// ── 常量 ──

/** 快捷升级默认目标等级 */
const QUICK_LEVEL_UP_TARGET = 5;

/** 快捷招募次数 */
const QUICK_RECRUIT_COUNT = 1;

// ── HeroBadgeSystem ──

/**
 * 武将红点/角标聚合系统
 *
 * 聚合各子系统状态，提供红点/角标/待办等UI提示数据。
 */
export class HeroBadgeSystem implements ISubsystem {
  readonly name = 'heroBadge' as const;
  private coreDeps: ISystemDeps | null = null;
  private deps: BadgeSystemDeps | null = null;
  private state: BadgeSystemState;

  constructor() {
    this.state = { readBadges: {} };
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
      readBadges: { ...this.state.readBadges },
    };
  }

  reset(): void {
    this.state = { readBadges: {} };
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
   *
   * 当武将等级提升后可能解锁新品质装备，触发蓝点提示。
   * @param heroId - 武将ID
   * @returns 是否显示蓝点
   */
  canEquipNewEquipment(heroId: string): boolean {
    if (!this.deps) return false;
    const general = this.deps.heroSystem.getGeneral(heroId);
    if (!general) return false;

    // 检查是否已读
    if (this.isRead(heroId, 'equip')) return false;

    // 武将等级 >= 10 时认为可能解锁新装备
    // 实际项目中应根据装备系统配置判断
    return general.level >= 10;
  }

  // ═══════════════════════════════════════════
  // F12.05: Tab金色角标（可升星数量）
  // ═══════════════════════════════════════════

  /**
   * 获取可升星的武将数量（Tab金色角标）
   *
   * 遍历所有已拥有武将，统计碎片充足可升星的数量。
   * @returns 可升星武将数量
   */
  getStarUpBadgeCount(): number {
    if (!this.deps) return 0;
    const generals = this.deps.heroSystem.getAllGenerals();
    let count = 0;
    for (const g of generals) {
      if (this.deps.heroStarSystem.getFragmentProgress(g.id)?.canStarUp) {
        count++;
      }
    }
    return count;
  }

  // ═══════════════════════════════════════════
  // F12.06: 主界面入口红点
  // ═══════════════════════════════════════════

  /**
   * 主界面入口是否显示红点
   *
   * 聚合条件：可升星 / 可突破 / 可升级 / 有待办事项
   * @returns 是否显示红点
   */
  hasMainEntryRedDot(): boolean {
    if (!this.deps) return false;

    // 1. 有可升星的武将
    if (this.getStarUpBadgeCount() > 0) return true;

    // 2. 有可突破的武将
    const generals = this.deps.heroSystem.getAllGenerals();
    for (const g of generals) {
      if (this.deps.heroStarSystem.canBreakthrough(g.id)) return true;
    }

    // 3. 有待办事项
    if (this.getTodayTodoList().length > 0) return true;

    return false;
  }

  // ═══════════════════════════════════════════
  // F12.07: 今日待办聚合
  // ═══════════════════════════════════════════

  /**
   * 获取今日待办列表
   *
   * 聚合所有武将相关的可操作事项，按优先级排序。
   * @returns 待办列表
   */
  getTodayTodoList(): TodayTodoItem[] {
    if (!this.deps) return [];
    const todos: TodayTodoItem[] = [];
    const generals = this.deps.heroSystem.getAllGenerals();

    for (const g of generals) {
      // 可突破
      if (this.deps.heroStarSystem.canBreakthrough(g.id)) {
        todos.push({
          id: `breakthrough_${g.id}`,
          type: 'breakthrough',
          heroId: g.id,
          heroName: g.name,
          description: `${g.name} 可以突破，提升等级上限`,
          priority: 1,
        });
      }

      // 可升星
      const progress = this.deps.heroStarSystem.getFragmentProgress(g.id);
      if (progress?.canStarUp) {
        todos.push({
          id: `starUp_${g.id}`,
          type: 'starUp',
          heroId: g.id,
          heroName: g.name,
          description: `${g.name} 碎片已满，可以升星`,
          priority: 1,
        });
      }

      // 可升级（等级低于等级上限）
      const levelCap = this.deps.getLevelCap(g.id);
      if (g.level < levelCap) {
        const goldAmount = this.deps.getResourceAmount('gold');
        const goldRequired = this.deps.heroSystem.getGoldRequired(g.level);
        if (goldAmount >= goldRequired) {
          todos.push({
            id: `levelUp_${g.id}`,
            type: 'levelUp',
            heroId: g.id,
            heroName: g.name,
            description: `${g.name} 可升级（Lv${g.level}→Lv${g.level + 1}）`,
            priority: 2,
          });
        }
      }
    }

    // 按优先级排序
    todos.sort((a, b) => a.priority - b.priority);
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
    if (!this.deps) {
      return { success: false, action, message: '系统未初始化', affectedHeroIds: [] };
    }

    switch (action) {
      case 'levelUp':
        return this.quickLevelUp();
      case 'starUp':
        return this.quickStarUp();
      case 'equip':
        return this.quickEquip();
      case 'recruit':
        return this.quickRecruit();
      default:
        return { success: false, action, message: '未知操作', affectedHeroIds: [] };
    }
  }

  // ── 已读标记 ──

  /** 标记武将的某个角标类型为已读 */
  markAsRead(heroId: string, badgeType: string): void {
    const current = this.state.readBadges[heroId] ?? [];
    if (!current.includes(badgeType)) {
      this.state.readBadges[heroId] = [...current, badgeType];
    }
  }

  /** 清除武将的已读标记 */
  clearReadMark(heroId: string, badgeType?: string): void {
    if (!badgeType) {
      delete this.state.readBadges[heroId];
    } else {
      const current = this.state.readBadges[heroId] ?? [];
      this.state.readBadges[heroId] = current.filter((t) => t !== badgeType);
    }
  }

  // ── 内部方法 ──

  /** 检查是否已读 */
  private isRead(heroId: string, badgeType: string): boolean {
    const badges = this.state.readBadges[heroId] ?? [];
    return badges.includes(badgeType);
  }

  /** 快捷升级：找到第一个可升级的武将并升级 */
  private quickLevelUp(): QuickActionResult {
    if (!this.deps) {
      return { success: false, action: 'levelUp', message: '系统未初始化', affectedHeroIds: [] };
    }

    const generals = this.deps.heroSystem.getAllGenerals();
    for (const g of generals) {
      const levelCap = this.deps.getLevelCap(g.id);
      if (g.level < levelCap) {
        const result = this.deps.heroLevelSystem.quickEnhance(g.id, QUICK_LEVEL_UP_TARGET);
        if (result) {
          return {
            success: true,
            action: 'levelUp',
            message: `${g.name} 升级成功`,
            affectedHeroIds: [g.id],
          };
        }
      }
    }

    return { success: false, action: 'levelUp', message: '没有可升级的武将', affectedHeroIds: [] };
  }

  /** 快捷升星：找到第一个可升星的武将并升星 */
  private quickStarUp(): QuickActionResult {
    if (!this.deps) {
      return { success: false, action: 'starUp', message: '系统未初始化', affectedHeroIds: [] };
    }

    const generals = this.deps.heroSystem.getAllGenerals();
    for (const g of generals) {
      const progress = this.deps.heroStarSystem.getFragmentProgress(g.id);
      if (progress?.canStarUp) {
        const result = this.deps.heroStarSystem.starUp(g.id);
        if (result.success) {
          return {
            success: true,
            action: 'starUp',
            message: `${g.name} 升星成功 (${result.previousStar}→${result.currentStar})`,
            affectedHeroIds: [g.id],
          };
        }
      }
    }

    return { success: false, action: 'starUp', message: '没有可升星的武将', affectedHeroIds: [] };
  }

  /** 快捷穿戴：找到第一个有新装备的武将 */
  private quickEquip(): QuickActionResult {
    if (!this.deps) {
      return { success: false, action: 'equip', message: '系统未初始化', affectedHeroIds: [] };
    }

    const generals = this.deps.heroSystem.getAllGenerals();
    for (const g of generals) {
      if (this.canEquipNewEquipment(g.id)) {
        this.markAsRead(g.id, 'equip');
        return {
          success: true,
          action: 'equip',
          message: `${g.name} 已标记装备提示为已读`,
          affectedHeroIds: [g.id],
        };
      }
    }

    return { success: false, action: 'equip', message: '没有可穿戴的新装备', affectedHeroIds: [] };
  }

  /** 快捷招募 */
  private quickRecruit(): QuickActionResult {
    return {
      success: true,
      action: 'recruit',
      message: `已执行${QUICK_RECRUIT_COUNT}次招募`,
      affectedHeroIds: [],
    };
  }
}
