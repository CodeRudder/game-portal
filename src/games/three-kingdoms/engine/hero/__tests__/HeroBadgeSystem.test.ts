import { describe, it, expect, beforeEach } from 'vitest';
import { HeroBadgeSystem } from '../HeroBadgeSystem';
import type { BadgeSystemDeps } from '../HeroBadgeSystem';

describe('HeroBadgeSystem', () => {
  let system: HeroBadgeSystem;

  /** 注入 mock 业务依赖 */
  function injectMockDeps(overrides?: Partial<BadgeSystemDeps>): void {
    system.setBadgeSystemDeps({
      getGeneralIds: () => ['hero1', 'hero2', 'hero3'],
      canLevelUp: (id) => id === 'hero1' || id === 'hero2',
      canStarUp: (id) => id === 'hero3',
      canEquip: (id) => id === 'hero1',
      ...overrides,
    });
  }

  beforeEach(() => {
    system = new HeroBadgeSystem();
  });

  // ── ISubsystem 接口 ──

  describe('ISubsystem', () => {
    it('should have correct name', () => {
      expect(system.name).toBe('heroBadge');
    });

    it('should implement getState', () => {
      injectMockDeps();
      const state = system.getState();
      expect(state).toHaveProperty('mainEntryRedDot');
      expect(state).toHaveProperty('tabLevelBadge');
      expect(state).toHaveProperty('tabStarBadge');
      expect(state).toHaveProperty('todayTodos');
    });

    it('should implement reset', () => {
      injectMockDeps();
      system.reset();
      // reset 后依赖恢复为默认空实现，各项指标应为零/空
      expect(system.getLevelBadgeCount()).toBe(0);
      expect(system.getStarBadgeCount()).toBe(0);
      expect(system.canEquipNewEquipment('hero1')).toBe(false);
    });

    it('should implement init without throwing', () => {
      expect(() => system.init({} as Record<string, unknown>)).not.toThrow();
    });

    it('should implement update without throwing', () => {
      expect(() => system.update(16)).not.toThrow();
    });
  });

  // ── F12.03: 蓝点检测 ──

  describe('canEquipNewEquipment', () => {
    it('should return true when hero can equip new equipment', () => {
      injectMockDeps();
      expect(system.canEquipNewEquipment('hero1')).toBe(true);
    });

    it('should return false when hero cannot equip new equipment', () => {
      injectMockDeps();
      expect(system.canEquipNewEquipment('hero2')).toBe(false);
      expect(system.canEquipNewEquipment('hero3')).toBe(false);
    });

    it('should return false for unknown hero', () => {
      injectMockDeps();
      expect(system.canEquipNewEquipment('hero999')).toBe(false);
    });
  });

  // ── F12.05: Tab 升级角标 ──

  describe('getLevelBadgeCount', () => {
    it('should return count of upgradable heroes', () => {
      injectMockDeps();
      // hero1 & hero2 can level up
      expect(system.getLevelBadgeCount()).toBe(2);
    });

    it('should return 0 when no heroes can level up', () => {
      injectMockDeps({ canLevelUp: () => false });
      expect(system.getLevelBadgeCount()).toBe(0);
    });

    it('should return 0 when hero list is empty', () => {
      injectMockDeps({ getGeneralIds: () => [] });
      expect(system.getLevelBadgeCount()).toBe(0);
    });
  });

  // ── F12.05: Tab 升星角标 ──

  describe('getStarBadgeCount', () => {
    it('should return count of star-upgradable heroes', () => {
      injectMockDeps();
      // only hero3 can star up
      expect(system.getStarBadgeCount()).toBe(1);
    });

    it('should return 0 when no heroes can star up', () => {
      injectMockDeps({ canStarUp: () => false });
      expect(system.getStarBadgeCount()).toBe(0);
    });

    it('should return 0 when hero list is empty', () => {
      injectMockDeps({ getGeneralIds: () => [] });
      expect(system.getStarBadgeCount()).toBe(0);
    });
  });

  // ── F12.06: 主界面入口红点 ──

  describe('hasMainEntryRedDot', () => {
    it('should return true when at least one hero has actionable items', () => {
      injectMockDeps();
      expect(system.hasMainEntryRedDot()).toBe(true);
    });

    it('should return false when no actionable items exist', () => {
      injectMockDeps({
        canLevelUp: () => false,
        canStarUp: () => false,
        canEquip: () => false,
      });
      expect(system.hasMainEntryRedDot()).toBe(false);
    });

    it('should return true if only equip is available', () => {
      injectMockDeps({
        canLevelUp: () => false,
        canStarUp: () => false,
        canEquip: (id) => id === 'hero1',
      });
      expect(system.hasMainEntryRedDot()).toBe(true);
    });

    it('should return false when hero list is empty', () => {
      injectMockDeps({ getGeneralIds: () => [] });
      expect(system.hasMainEntryRedDot()).toBe(false);
    });
  });

  // ── F12.07: 今日待办聚合 ──

  describe('getTodayTodoList', () => {
    it('should aggregate all actionable todos for heroes', () => {
      injectMockDeps();
      const todos = system.getTodayTodoList();
      // hero1: levelUp + equip, hero2: levelUp, hero3: starUp → 4 items
      expect(todos).toHaveLength(4);
    });

    it('should include levelUp todo for upgradable heroes', () => {
      injectMockDeps();
      const todos = system.getTodayTodoList();
      const levelUpTodos = todos.filter(t => t.type === 'levelUp');
      expect(levelUpTodos).toHaveLength(2);
      expect(levelUpTodos.map(t => t.heroId)).toEqual(
        expect.arrayContaining(['hero1', 'hero2']),
      );
    });

    it('should include starUp todo for star-upgradable heroes', () => {
      injectMockDeps();
      const todos = system.getTodayTodoList();
      const starUpTodos = todos.filter(t => t.type === 'starUp');
      expect(starUpTodos).toHaveLength(1);
      expect(starUpTodos[0].heroId).toBe('hero3');
    });

    it('should include equip todo for heroes with new equipment', () => {
      injectMockDeps();
      const todos = system.getTodayTodoList();
      const equipTodos = todos.filter(t => t.type === 'equip');
      expect(equipTodos).toHaveLength(1);
      expect(equipTodos[0].heroId).toBe('hero1');
    });

    it('should return recruit todo when no actionable items exist', () => {
      injectMockDeps({
        canLevelUp: () => false,
        canStarUp: () => false,
        canEquip: () => false,
      });
      const todos = system.getTodayTodoList();
      expect(todos).toHaveLength(1);
      expect(todos[0].type).toBe('recruit');
      expect(todos[0].action).toBe('recruit');
      expect(todos[0].label).toContain('招募');
    });

    it('should have correct action field for each todo type', () => {
      injectMockDeps();
      const todos = system.getTodayTodoList();
      for (const todo of todos) {
        expect(todo.action).toBe(todo.type);
      }
    });
  });

  // ── F12.08: 快捷操作 ──

  describe('executeQuickAction', () => {
    it('should return affected heroes for levelUp action', () => {
      injectMockDeps();
      const result = system.executeQuickAction('levelUp');
      expect(result.success).toBe(true);
      expect(result.affectedHeroes).toEqual(['hero1', 'hero2']);
      expect(result.message).toContain('2');
    });

    it('should return affected heroes for starUp action', () => {
      injectMockDeps();
      const result = system.executeQuickAction('starUp');
      expect(result.success).toBe(true);
      expect(result.affectedHeroes).toEqual(['hero3']);
      expect(result.message).toContain('1');
    });

    it('should return affected heroes for equip action', () => {
      injectMockDeps();
      const result = system.executeQuickAction('equip');
      expect(result.success).toBe(true);
      expect(result.affectedHeroes).toEqual(['hero1']);
      expect(result.message).toContain('1');
    });

    it('should return success for recruit action', () => {
      injectMockDeps();
      const result = system.executeQuickAction('recruit');
      expect(result.success).toBe(true);
      expect(result.affectedHeroes).toEqual([]);
      expect(result.message).toContain('招募');
    });

    it('should return failure when no heroes match the action', () => {
      injectMockDeps({
        getGeneralIds: () => ['hero1'],
        canLevelUp: () => false,
        canStarUp: () => false,
        canEquip: () => false,
      });
      const result = system.executeQuickAction('levelUp');
      expect(result.success).toBe(false);
      expect(result.affectedHeroes).toEqual([]);
      expect(result.message).toContain('0');
    });
  });
});
