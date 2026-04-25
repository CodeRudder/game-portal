/**
 * HeroBadgeSystem 单元测试 — 红点/角标聚合系统
 *
 * 覆盖功能点：
 * - F12.03 蓝点检测（新装备可穿戴）
 * - F12.05 Tab角标（升级/升星数量）
 * - F12.06 主界面入口红点
 * - F12.07 今日待办聚合
 * - F12.08 快捷操作
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HeroBadgeSystem } from '../HeroBadgeSystem';
import type { BadgeSystemDeps } from '../HeroBadgeSystem';

// ── 辅助函数 ──

function makeMockCoreDeps() {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: { get: vi.fn(), register: vi.fn(), has: vi.fn(), getAll: vi.fn(), unregister: vi.fn() },
  };
}

/** 创建可编程的 BadgeSystemDeps mock */
function createMockableDeps(overrides?: Partial<{
  generalIds: string[];
  canLevelUp: Record<string, boolean>;
  canStarUp: Record<string, boolean>;
  canEquip: Record<string, boolean>;
}>): BadgeSystemDeps & {
  setGeneralIds: (ids: string[]) => void;
  setCanLevelUp: (map: Record<string, boolean>) => void;
  setCanStarUp: (map: Record<string, boolean>) => void;
  setCanEquip: (map: Record<string, boolean>) => void;
} {
  let generalIds = overrides?.generalIds ?? [];
  let canLevelUpMap = overrides?.canLevelUp ?? {};
  let canStarUpMap = overrides?.canStarUp ?? {};
  let canEquipMap = overrides?.canEquip ?? {};

  return {
    getGeneralIds: () => generalIds,
    canLevelUp: (id: string) => canLevelUpMap[id] ?? false,
    canStarUp: (id: string) => canStarUpMap[id] ?? false,
    canEquip: (id: string) => canEquipMap[id] ?? false,
    setGeneralIds: (ids: string[]) => { generalIds = ids; },
    setCanLevelUp: (map: Record<string, boolean>) => { canLevelUpMap = map; },
    setCanStarUp: (map: Record<string, boolean>) => { canStarUpMap = map; },
    setCanEquip: (map: Record<string, boolean>) => { canEquipMap = map; },
  };
}

// ═══════════════════════════════════════════
// init 依赖注入
// ═══════════════════════════════════════════

describe('HeroBadgeSystem init 与依赖注入', () => {
  it('should implement ISubsystem interface (init/update/getState/reset)', () => {
    const system = new HeroBadgeSystem();
    system.init(makeMockCoreDeps());
    expect(system.name).toBe('heroBadge');

    // update 不应抛错
    expect(() => system.update(16)).not.toThrow();
  });

  it('should accept BadgeSystemDeps via setBadgeSystemDeps', () => {
    const system = new HeroBadgeSystem();
    system.init(makeMockCoreDeps());
    const deps = createMockableDeps();
    expect(() => system.setBadgeSystemDeps(deps)).not.toThrow();
  });

  it('should reset deps on reset()', () => {
    const system = new HeroBadgeSystem();
    system.init(makeMockCoreDeps());
    const deps = createMockableDeps({ generalIds: ['guanyu'], canLevelUp: { guanyu: true } });
    system.setBadgeSystemDeps(deps);

    // Before reset, should have data
    expect(system.getLevelBadgeCount()).toBe(1);

    system.reset();

    // After reset, deps are cleared to defaults
    expect(system.getLevelBadgeCount()).toBe(0);
  });
});

// ═══════════════════════════════════════════
// F12.03: 蓝点检测（新装备可穿戴）
// ═══════════════════════════════════════════

describe('HeroBadgeSystem canEquipNewEquipment (F12.03)', () => {
  let system: HeroBadgeSystem;
  let deps: ReturnType<typeof createMockableDeps>;

  beforeEach(() => {
    system = new HeroBadgeSystem();
    system.init(makeMockCoreDeps());
    deps = createMockableDeps();
    system.setBadgeSystemDeps(deps);
  });

  it('should return true when hero has new equipment available', () => {
    deps.setCanEquip({ guanyu: true });
    expect(system.canEquipNewEquipment('guanyu')).toBe(true);
  });

  it('should return false when hero has no new equipment', () => {
    deps.setCanEquip({ guanyu: false });
    expect(system.canEquipNewEquipment('guanyu')).toBe(false);
  });

  it('should return false for unknown hero (default)', () => {
    expect(system.canEquipNewEquipment('unknown')).toBe(false);
  });
});

// ═══════════════════════════════════════════
// F12.05: Tab升级角标数量
// ═══════════════════════════════════════════

describe('HeroBadgeSystem getLevelBadgeCount (F12.05)', () => {
  let system: HeroBadgeSystem;
  let deps: ReturnType<typeof createMockableDeps>;

  beforeEach(() => {
    system = new HeroBadgeSystem();
    system.init(makeMockCoreDeps());
    deps = createMockableDeps();
    system.setBadgeSystemDeps(deps);
  });

  it('should return 0 when no heroes', () => {
    expect(system.getLevelBadgeCount()).toBe(0);
  });

  it('should return count of heroes that can level up', () => {
    deps.setGeneralIds(['guanyu', 'zhangfei', 'liubei']);
    deps.setCanLevelUp({ guanyu: true, zhangfei: false, liubei: true });
    expect(system.getLevelBadgeCount()).toBe(2);
  });

  it('should return 0 when no heroes can level up', () => {
    deps.setGeneralIds(['guanyu', 'zhangfei']);
    deps.setCanLevelUp({ guanyu: false, zhangfei: false });
    expect(system.getLevelBadgeCount()).toBe(0);
  });
});

// ═══════════════════════════════════════════
// F12.05: Tab升星角标数量（金色）
// ═══════════════════════════════════════════

describe('HeroBadgeSystem getStarBadgeCount (F12.05 金色角标)', () => {
  let system: HeroBadgeSystem;
  let deps: ReturnType<typeof createMockableDeps>;

  beforeEach(() => {
    system = new HeroBadgeSystem();
    system.init(makeMockCoreDeps());
    deps = createMockableDeps();
    system.setBadgeSystemDeps(deps);
  });

  it('should return 0 when no heroes', () => {
    expect(system.getStarBadgeCount()).toBe(0);
  });

  it('should return count of heroes that can star up', () => {
    deps.setGeneralIds(['guanyu', 'zhangfei', 'liubei']);
    deps.setCanStarUp({ guanyu: true, zhangfei: true, liubei: false });
    expect(system.getStarBadgeCount()).toBe(2);
  });

  it('should return 0 when no heroes can star up', () => {
    deps.setGeneralIds(['guanyu']);
    deps.setCanStarUp({ guanyu: false });
    expect(system.getStarBadgeCount()).toBe(0);
  });
});

// ═══════════════════════════════════════════
// F12.06: 主界面入口红点
// ═══════════════════════════════════════════

describe('HeroBadgeSystem hasMainEntryRedDot (F12.06)', () => {
  let system: HeroBadgeSystem;
  let deps: ReturnType<typeof createMockableDeps>;

  beforeEach(() => {
    system = new HeroBadgeSystem();
    system.init(makeMockCoreDeps());
    deps = createMockableDeps();
    system.setBadgeSystemDeps(deps);
  });

  it('should return false when no heroes', () => {
    expect(system.hasMainEntryRedDot()).toBe(false);
  });

  it('should return false when all heroes have no actions', () => {
    deps.setGeneralIds(['guanyu', 'zhangfei']);
    deps.setCanLevelUp({ guanyu: false, zhangfei: false });
    deps.setCanStarUp({ guanyu: false, zhangfei: false });
    deps.setCanEquip({ guanyu: false, zhangfei: false });
    expect(system.hasMainEntryRedDot()).toBe(false);
  });

  it('should return true when any hero can level up', () => {
    deps.setGeneralIds(['guanyu']);
    deps.setCanLevelUp({ guanyu: true });
    expect(system.hasMainEntryRedDot()).toBe(true);
  });

  it('should return true when any hero can star up', () => {
    deps.setGeneralIds(['guanyu']);
    deps.setCanStarUp({ guanyu: true });
    expect(system.hasMainEntryRedDot()).toBe(true);
  });

  it('should return true when any hero has new equipment', () => {
    deps.setGeneralIds(['guanyu']);
    deps.setCanEquip({ guanyu: true });
    expect(system.hasMainEntryRedDot()).toBe(true);
  });

  it('should aggregate all conditions', () => {
    deps.setGeneralIds(['a', 'b', 'c']);
    deps.setCanLevelUp({ a: false, b: false, c: false });
    deps.setCanStarUp({ a: false, b: false, c: false });
    deps.setCanEquip({ a: false, b: false, c: true });
    expect(system.hasMainEntryRedDot()).toBe(true);
  });
});

// ═══════════════════════════════════════════
// F12.07: 今日待办聚合
// ═══════════════════════════════════════════

describe('HeroBadgeSystem getTodayTodoList (F12.07)', () => {
  let system: HeroBadgeSystem;
  let deps: ReturnType<typeof createMockableDeps>;

  beforeEach(() => {
    system = new HeroBadgeSystem();
    system.init(makeMockCoreDeps());
    deps = createMockableDeps();
    system.setBadgeSystemDeps(deps);
  });

  it('should return default recruit todo when no heroes', () => {
    const todos = system.getTodayTodoList();
    expect(todos).toHaveLength(1);
    expect(todos[0].type).toBe('recruit');
    expect(todos[0].action).toBe('recruit');
    expect(todos[0].label).toContain('招募');
  });

  it('should return default recruit todo when no heroes have actions', () => {
    deps.setGeneralIds(['guanyu']);
    deps.setCanLevelUp({ guanyu: false });
    deps.setCanStarUp({ guanyu: false });
    deps.setCanEquip({ guanyu: false });

    const todos = system.getTodayTodoList();
    expect(todos).toHaveLength(1);
    expect(todos[0].type).toBe('recruit');
  });

  it('should include levelUp todo for heroes that can level up', () => {
    deps.setGeneralIds(['guanyu']);
    deps.setCanLevelUp({ guanyu: true });

    const todos = system.getTodayTodoList();
    const levelUpTodo = todos.find(t => t.type === 'levelUp');
    expect(levelUpTodo).toBeDefined();
    expect(levelUpTodo!.heroId).toBe('guanyu');
    expect(levelUpTodo!.action).toBe('levelUp');
  });

  it('should include starUp todo for heroes that can star up', () => {
    deps.setGeneralIds(['zhangfei']);
    deps.setCanStarUp({ zhangfei: true });

    const todos = system.getTodayTodoList();
    const starUpTodo = todos.find(t => t.type === 'starUp');
    expect(starUpTodo).toBeDefined();
    expect(starUpTodo!.heroId).toBe('zhangfei');
  });

  it('should include equip todo for heroes with new equipment', () => {
    deps.setGeneralIds(['liubei']);
    deps.setCanEquip({ liubei: true });

    const todos = system.getTodayTodoList();
    const equipTodo = todos.find(t => t.type === 'equip');
    expect(equipTodo).toBeDefined();
    expect(equipTodo!.heroId).toBe('liubei');
  });

  it('should aggregate multiple todos for multiple heroes', () => {
    deps.setGeneralIds(['guanyu', 'zhangfei']);
    deps.setCanLevelUp({ guanyu: true, zhangfei: false });
    deps.setCanStarUp({ guanyu: false, zhangfei: true });
    deps.setCanEquip({ guanyu: true, zhangfei: false });

    const todos = system.getTodayTodoList();
    expect(todos.length).toBeGreaterThanOrEqual(3);

    const types = todos.map(t => t.type);
    expect(types).toContain('levelUp');
    expect(types).toContain('starUp');
    expect(types).toContain('equip');
  });

  it('should not include recruit default when other todos exist', () => {
    deps.setGeneralIds(['guanyu']);
    deps.setCanLevelUp({ guanyu: true });

    const todos = system.getTodayTodoList();
    const recruitTodo = todos.find(t => t.type === 'recruit');
    expect(recruitTodo).toBeUndefined();
  });
});

// ═══════════════════════════════════════════
// F12.08: 快捷操作
// ═══════════════════════════════════════════

describe('HeroBadgeSystem executeQuickAction (F12.08)', () => {
  let system: HeroBadgeSystem;
  let deps: ReturnType<typeof createMockableDeps>;

  beforeEach(() => {
    system = new HeroBadgeSystem();
    system.init(makeMockCoreDeps());
    deps = createMockableDeps();
    system.setBadgeSystemDeps(deps);
  });

  it('should return affected heroes for levelUp action', () => {
    deps.setGeneralIds(['guanyu', 'zhangfei']);
    deps.setCanLevelUp({ guanyu: true, zhangfei: false });

    const result = system.executeQuickAction('levelUp');
    expect(result.success).toBe(true);
    expect(result.affectedHeroes).toEqual(['guanyu']);
    expect(result.message).toContain('1');
  });

  it('should return success=false for levelUp when no heroes can level up', () => {
    deps.setGeneralIds(['guanyu']);
    deps.setCanLevelUp({ guanyu: false });

    const result = system.executeQuickAction('levelUp');
    expect(result.success).toBe(false);
    expect(result.affectedHeroes).toEqual([]);
  });

  it('should return affected heroes for starUp action', () => {
    deps.setGeneralIds(['guanyu', 'zhangfei']);
    deps.setCanStarUp({ guanyu: false, zhangfei: true });

    const result = system.executeQuickAction('starUp');
    expect(result.success).toBe(true);
    expect(result.affectedHeroes).toEqual(['zhangfei']);
  });

  it('should return affected heroes for equip action', () => {
    deps.setGeneralIds(['guanyu', 'zhangfei', 'liubei']);
    deps.setCanEquip({ guanyu: true, zhangfei: true, liubei: false });

    const result = system.executeQuickAction('equip');
    expect(result.success).toBe(true);
    expect(result.affectedHeroes).toEqual(['guanyu', 'zhangfei']);
  });

  it('should return success for recruit action (always succeeds)', () => {
    const result = system.executeQuickAction('recruit');
    expect(result.success).toBe(true);
    expect(result.message).toContain('招募');
    expect(result.affectedHeroes).toEqual([]);
  });
});

// ═══════════════════════════════════════════
// getBadgeState 完整状态
// ═══════════════════════════════════════════

describe('HeroBadgeSystem getBadgeState', () => {
  let system: HeroBadgeSystem;
  let deps: ReturnType<typeof createMockableDeps>;

  beforeEach(() => {
    system = new HeroBadgeSystem();
    system.init(makeMockCoreDeps());
    deps = createMockableDeps();
    system.setBadgeSystemDeps(deps);
  });

  it('should return complete badge state with all fields', () => {
    deps.setGeneralIds(['guanyu', 'zhangfei']);
    deps.setCanLevelUp({ guanyu: true, zhangfei: false });
    deps.setCanStarUp({ guanyu: false, zhangfei: true });
    deps.setCanEquip({ guanyu: false, zhangfei: false });

    const state = system.getState();
    expect(state).toHaveProperty('mainEntryRedDot');
    expect(state).toHaveProperty('tabLevelBadge');
    expect(state).toHaveProperty('tabStarBadge');
    expect(state).toHaveProperty('todayTodos');
  });

  it('should compute all badge values correctly', () => {
    deps.setGeneralIds(['a', 'b', 'c']);
    deps.setCanLevelUp({ a: true, b: false, c: true });
    deps.setCanStarUp({ a: false, b: true, c: false });
    deps.setCanEquip({ a: false, b: false, c: false });

    const state = system.getState();
    expect(state.mainEntryRedDot).toBe(true);
    expect(state.tabLevelBadge).toBe(2);
    expect(state.tabStarBadge).toBe(1);
    expect(state.todayTodos.length).toBeGreaterThanOrEqual(2);
  });

  it('should return empty state when no heroes', () => {
    const state = system.getState();
    expect(state.mainEntryRedDot).toBe(false);
    expect(state.tabLevelBadge).toBe(0);
    expect(state.tabStarBadge).toBe(0);
    expect(state.todayTodos).toHaveLength(1); // default recruit todo
  });
});
