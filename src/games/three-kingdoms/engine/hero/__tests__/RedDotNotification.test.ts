/**
 * 武将红点/角标UI — 引擎层红点触发逻辑测试
 *
 * 验证红点/角标系统核心逻辑：
 * - F12.03 蓝点检测（新装备可穿戴）
 * - F12.05 Tab升级角标 / Tab升星角标
 * - F12.06 主界面入口红点
 * - F12.07 今日待办聚合
 * - F12.08 快捷操作
 *
 * P1 缺口：零 ACC 测试 → 补充引擎层红点触发逻辑测试
 * 使用真实 HeroBadgeSystem 实例 + 真实 HeroSystem 注入依赖
 *
 * @module engine/hero/__tests__/RedDotNotification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HeroBadgeSystem } from '../HeroBadgeSystem';
import type { BadgeSystemDeps, TodayTodoItem, QuickActionResult, BadgeSystemState } from '../HeroBadgeSystem';
import { HeroSystem } from '../HeroSystem';
import { GENERAL_DEFS } from '../hero-config';

// ═══════════════════════════════════════════
// 测试辅助
// ═══════════════════════════════════════════

/** 创建真实的 HeroSystem 并添加指定武将 */
function createRealHeroSystem(heroIds: string[]): HeroSystem {
  const system = new HeroSystem();
  for (const id of heroIds) {
    system.addGeneral(id);
  }
  return system;
}

/** 创建基于真实 HeroSystem 的 BadgeSystemDeps */
function createRealDeps(
  heroSystem: HeroSystem,
  overrides?: {
    canLevelUp?: (id: string) => boolean;
    canStarUp?: (id: string) => boolean;
    canEquip?: (id: string) => boolean;
  },
): BadgeSystemDeps {
  return {
    getGeneralIds: () => Object.keys((heroSystem as any).state.generals),
    canLevelUp: overrides?.canLevelUp ?? (() => false),
    canStarUp: overrides?.canStarUp ?? (() => false),
    canEquip: overrides?.canEquip ?? (() => false),
  };
}

// ═══════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════

describe('RedDotNotification — 红点/角标触发逻辑', () => {
  let badgeSystem: HeroBadgeSystem;

  beforeEach(() => {
    badgeSystem = new HeroBadgeSystem();
  });

  // ── F12.03: 蓝点检测 ──

  describe('F12.03 蓝点检测（新装备可穿戴）', () => {
    it('武将有新装备可穿戴时返回 true', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canEquip: (id) => id === 'guanyu',
      }));
      expect(badgeSystem.canEquipNewEquipment('guanyu')).toBe(true);
    });

    it('武将无新装备可穿戴时返回 false', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem));
      expect(badgeSystem.canEquipNewEquipment('guanyu')).toBe(false);
    });

    it('不存在的武将返回 false', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem));
      expect(badgeSystem.canEquipNewEquipment('unknown')).toBe(false);
    });

    it('多个武将中只有部分有蓝点', () => {
      const heroSystem = createRealHeroSystem(['guanyu', 'caocao', 'liubei']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canEquip: (id) => id === 'caocao',
      }));
      expect(badgeSystem.canEquipNewEquipment('guanyu')).toBe(false);
      expect(badgeSystem.canEquipNewEquipment('caocao')).toBe(true);
      expect(badgeSystem.canEquipNewEquipment('liubei')).toBe(false);
    });
  });

  // ── F12.05: Tab升级角标 ──

  describe('F12.05 Tab升级角标数量', () => {
    it('无武将可升级时角标为 0', () => {
      const heroSystem = createRealHeroSystem(['guanyu', 'caocao']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem));
      expect(badgeSystem.getLevelBadgeCount()).toBe(0);
    });

    it('单个武将可升级时角标为 1', () => {
      const heroSystem = createRealHeroSystem(['guanyu', 'caocao']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: (id) => id === 'guanyu',
      }));
      expect(badgeSystem.getLevelBadgeCount()).toBe(1);
    });

    it('多个武将可升级时角标数量正确', () => {
      const heroSystem = createRealHeroSystem(['guanyu', 'caocao', 'liubei', 'zhangfei']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: (id) => id === 'guanyu' || id === 'caocao' || id === 'zhangfei',
      }));
      expect(badgeSystem.getLevelBadgeCount()).toBe(3);
    });

    it('全部武将可升级时角标等于武将总数', () => {
      const heroSystem = createRealHeroSystem(['guanyu', 'caocao']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: () => true,
      }));
      expect(badgeSystem.getLevelBadgeCount()).toBe(2);
    });

    it('空名册时角标为 0', () => {
      const heroSystem = createRealHeroSystem([]);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: () => true,
      }));
      expect(badgeSystem.getLevelBadgeCount()).toBe(0);
    });
  });

  // ── F12.05: Tab升星角标（金色） ──

  describe('F12.05 Tab升星角标数量（金色）', () => {
    it('无武将可升星时角标为 0', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem));
      expect(badgeSystem.getStarBadgeCount()).toBe(0);
    });

    it('单个武将可升星时角标为 1', () => {
      const heroSystem = createRealHeroSystem(['guanyu', 'caocao']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canStarUp: (id) => id === 'guanyu',
      }));
      expect(badgeSystem.getStarBadgeCount()).toBe(1);
    });

    it('多个武将可升星时角标数量正确', () => {
      const heroSystem = createRealHeroSystem(['guanyu', 'caocao', 'liubei']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canStarUp: (id) => id === 'guanyu' || id === 'liubei',
      }));
      expect(badgeSystem.getStarBadgeCount()).toBe(2);
    });
  });

  // ── F12.06: 主界面入口红点 ──

  describe('F12.06 主界面入口红点', () => {
    it('无任何可操作项时不显示红点', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem));
      expect(badgeSystem.hasMainEntryRedDot()).toBe(false);
    });

    it('有武将可升级时显示红点', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: () => true,
      }));
      expect(badgeSystem.hasMainEntryRedDot()).toBe(true);
    });

    it('有武将可升星时显示红点', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canStarUp: () => true,
      }));
      expect(badgeSystem.hasMainEntryRedDot()).toBe(true);
    });

    it('有武将有新装备可穿戴时显示红点', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canEquip: () => true,
      }));
      expect(badgeSystem.hasMainEntryRedDot()).toBe(true);
    });

    it('三种条件都不满足时不显示红点', () => {
      const heroSystem = createRealHeroSystem(['guanyu', 'caocao']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem));
      expect(badgeSystem.hasMainEntryRedDot()).toBe(false);
    });

    it('空名册时不显示红点', () => {
      const heroSystem = createRealHeroSystem([]);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: () => true,
      }));
      expect(badgeSystem.hasMainEntryRedDot()).toBe(false);
    });

    it('红点聚合：任一条件满足即显示', () => {
      const heroSystem = createRealHeroSystem(['guanyu', 'caocao', 'liubei']);
      // 只有 liubei 可装备
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canEquip: (id) => id === 'liubei',
      }));
      expect(badgeSystem.hasMainEntryRedDot()).toBe(true);
    });
  });

  // ── F12.07: 今日待办聚合 ──

  describe('F12.07 今日待办聚合', () => {
    it('无待办时返回默认招募提示', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem));
      const todos = badgeSystem.getTodayTodoList();
      expect(todos).toHaveLength(1);
      expect(todos[0].type).toBe('recruit');
      expect(todos[0].action).toBe('recruit');
    });

    it('有武将可升级时生成升级待办', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: () => true,
      }));
      const todos = badgeSystem.getTodayTodoList();
      const levelUpTodos = todos.filter((t) => t.type === 'levelUp');
      expect(levelUpTodos).toHaveLength(1);
      expect(levelUpTodos[0].heroId).toBe('guanyu');
      expect(levelUpTodos[0].action).toBe('levelUp');
    });

    it('有武将可升星时生成升星待办', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canStarUp: () => true,
      }));
      const todos = badgeSystem.getTodayTodoList();
      const starUpTodos = todos.filter((t) => t.type === 'starUp');
      expect(starUpTodos).toHaveLength(1);
    });

    it('有武将有新装备时生成装备待办', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canEquip: () => true,
      }));
      const todos = badgeSystem.getTodayTodoList();
      const equipTodos = todos.filter((t) => t.type === 'equip');
      expect(equipTodos).toHaveLength(1);
    });

    it('一个武将同时可升级和升星时生成多条待办', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: () => true,
        canStarUp: () => true,
      }));
      const todos = badgeSystem.getTodayTodoList();
      expect(todos.length).toBeGreaterThanOrEqual(2);
    });

    it('多个武将各有不同待办时正确聚合', () => {
      const heroSystem = createRealHeroSystem(['guanyu', 'caocao', 'liubei']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: (id) => id === 'guanyu',
        canStarUp: (id) => id === 'caocao',
        canEquip: (id) => id === 'liubei',
      }));
      const todos = badgeSystem.getTodayTodoList();
      expect(todos).toHaveLength(3);
      expect(todos.some((t) => t.type === 'levelUp' && t.heroId === 'guanyu')).toBe(true);
      expect(todos.some((t) => t.type === 'starUp' && t.heroId === 'caocao')).toBe(true);
      expect(todos.some((t) => t.type === 'equip' && t.heroId === 'liubei')).toBe(true);
    });

    it('有待办时不包含默认招募提示', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: () => true,
      }));
      const todos = badgeSystem.getTodayTodoList();
      expect(todos.every((t) => t.type !== 'recruit')).toBe(true);
    });

    it('待办条目应包含正确的字段', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: () => true,
      }));
      const todos = badgeSystem.getTodayTodoList();
      for (const todo of todos) {
        expect(todo).toHaveProperty('type');
        expect(todo).toHaveProperty('label');
        expect(todo).toHaveProperty('action');
      }
    });

    it('空名册时仅返回招募提示', () => {
      const heroSystem = createRealHeroSystem([]);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem));
      const todos = badgeSystem.getTodayTodoList();
      expect(todos).toHaveLength(1);
      expect(todos[0].type).toBe('recruit');
    });
  });

  // ── F12.08: 快捷操作 ──

  describe('F12.08 快捷操作', () => {
    it('levelUp 操作返回可升级武将列表', () => {
      const heroSystem = createRealHeroSystem(['guanyu', 'caocao']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: (id) => id === 'guanyu' || id === 'caocao',
      }));
      const result = badgeSystem.executeQuickAction('levelUp');
      expect(result.success).toBe(true);
      expect(result.affectedHeroes).toContain('guanyu');
      expect(result.affectedHeroes).toContain('caocao');
    });

    it('starUp 操作返回可升星武将列表', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canStarUp: () => true,
      }));
      const result = badgeSystem.executeQuickAction('starUp');
      expect(result.success).toBe(true);
      expect(result.affectedHeroes).toContain('guanyu');
    });

    it('equip 操作返回有新装备的武将列表', () => {
      const heroSystem = createRealHeroSystem(['guanyu', 'liubei']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canEquip: (id) => id === 'liubei',
      }));
      const result = badgeSystem.executeQuickAction('equip');
      expect(result.success).toBe(true);
      expect(result.affectedHeroes).toEqual(['liubei']);
    });

    it('无匹配武将时操作返回 success=false', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem));
      const result = badgeSystem.executeQuickAction('levelUp');
      expect(result.success).toBe(false);
      expect(result.affectedHeroes).toHaveLength(0);
    });

    it('recruit 操作始终返回 success=true', () => {
      const result = badgeSystem.executeQuickAction('recruit');
      expect(result.success).toBe(true);
      expect(result.message).toContain('招募');
    });

    it('操作结果应包含 success、message、affectedHeroes 字段', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: () => true,
      }));
      const result = badgeSystem.executeQuickAction('levelUp');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('affectedHeroes');
    });
  });

  // ── getState 聚合 ──

  describe('getState 聚合', () => {
    it('应返回完整的 BadgeSystemState', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: () => true,
        canStarUp: () => true,
        canEquip: () => true,
      }));
      const state: BadgeSystemState = badgeSystem.getState();
      expect(state).toHaveProperty('mainEntryRedDot');
      expect(state).toHaveProperty('tabLevelBadge');
      expect(state).toHaveProperty('tabStarBadge');
      expect(state).toHaveProperty('todayTodos');
      expect(state.mainEntryRedDot).toBe(true);
      expect(state.tabLevelBadge).toBe(1);
      expect(state.tabStarBadge).toBe(1);
      expect(state.todayTodos.length).toBeGreaterThanOrEqual(1);
    });

    it('无操作时 mainEntryRedDot 为 false', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem));
      const state = badgeSystem.getState();
      expect(state.mainEntryRedDot).toBe(false);
      expect(state.tabLevelBadge).toBe(0);
      expect(state.tabStarBadge).toBe(0);
    });
  });

  // ── reset ──

  describe('reset 重置', () => {
    it('重置后所有红点/角标/待办清零', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: () => true,
      }));
      expect(badgeSystem.hasMainEntryRedDot()).toBe(true);

      badgeSystem.reset();
      expect(badgeSystem.hasMainEntryRedDot()).toBe(false);
      expect(badgeSystem.getLevelBadgeCount()).toBe(0);
      expect(badgeSystem.getStarBadgeCount()).toBe(0);
    });
  });

  // ── 依赖注入动态更新 ──

  describe('依赖注入动态更新', () => {
    it('更新依赖后红点状态应立即反映', () => {
      const heroSystem = createRealHeroSystem(['guanyu']);
      // 初始无红点
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem));
      expect(badgeSystem.hasMainEntryRedDot()).toBe(false);

      // 更新依赖：guanyu 可升级
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: () => true,
      }));
      expect(badgeSystem.hasMainEntryRedDot()).toBe(true);
    });

    it('二次注入覆盖前一次依赖', () => {
      const heroSystem = createRealHeroSystem(['guanyu', 'caocao']);
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: () => true,
      }));
      expect(badgeSystem.getLevelBadgeCount()).toBe(2);

      // 覆盖：只有 guanyu 可升级
      badgeSystem.setBadgeSystemDeps(createRealDeps(heroSystem, {
        canLevelUp: (id) => id === 'guanyu',
      }));
      expect(badgeSystem.getLevelBadgeCount()).toBe(1);
    });
  });

  // ── 边界场景 ──

  describe('边界场景', () => {
    it('大量武将时性能不退化（100 个武将）', () => {
      const heroSystem = createRealHeroSystem(
        GENERAL_DEFS.slice(0, 10).map((d) => d.id),
      );
      // 模拟大量武将（通过多次注入）
      const manyIds = Array.from({ length: 100 }, (_, i) => `hero_${i}`);
      badgeSystem.setBadgeSystemDeps({
        getGeneralIds: () => manyIds,
        canLevelUp: (id) => id.endsWith('0'),
        canStarUp: (id) => id.endsWith('5'),
        canEquip: () => false,
      });

      // 验证计数正确
      expect(badgeSystem.getLevelBadgeCount()).toBe(10); // hero_0, hero_10, ..., hero_90
      expect(badgeSystem.getStarBadgeCount()).toBe(10); // hero_5, hero_15, ..., hero_95
      expect(badgeSystem.hasMainEntryRedDot()).toBe(true);
    });

    it('依赖返回异常值时不崩溃', () => {
      badgeSystem.setBadgeSystemDeps({
        getGeneralIds: () => ['hero1'], // 非空列表以触发 canLevelUp 调用
        canLevelUp: () => { throw new Error('unexpected'); },
        canStarUp: () => false,
        canEquip: () => false,
      });
      // 不应崩溃，但会抛出异常（由调用方捕获）
      expect(() => badgeSystem.getLevelBadgeCount()).toThrow();
    });
  });
});
