/**
 * EndingSystem 单元测试
 *
 * 覆盖：
 * 1. 结局类型管理
 * 2. 条件评估（四维评分）
 * 3. 结局触发
 * 4. 序列化/反序列化
 */

import { EndingSystem } from '../EndingSystem';

describe('EndingSystem', () => {
  let system: EndingSystem;
  const mockDeps = {
    eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
    registry: { get: vi.fn() },
  };

  beforeEach(() => {
    system = new EndingSystem();
    system.init(mockDeps);
  });

  // ─── 结局类型 ─────────────────────────────

  describe('getEndingTypes', () => {
    it('应返回4种结局类型', () => {
      const types = system.getEndingTypes();
      expect(types.length).toBe(4);
    });

    it('应包含 S/A/B/C 四个等级', () => {
      const types = system.getEndingTypes();
      const grades = types.map(t => t.grade);
      expect(grades).toContain('S');
      expect(grades).toContain('A');
      expect(grades).toContain('B');
      expect(grades).toContain('C');
    });

    it('S级应需要90分以上', () => {
      const types = system.getEndingTypes();
      const s = types.find(t => t.grade === 'S');
      expect(s!.minScore).toBe(90);
    });
  });

  // ─── 条件评估 ─────────────────────────────

  describe('evaluateConditions', () => {
    it('满分上下文应获得100分', () => {
      const score = system.evaluateConditions({
        totalPower: 100000,
        powerCap: 100000,
        heroCount: 40,
        heroTotal: 40,
        prestigeLevel: 30,
        prestigeCap: 30,
        territoryOwned: 15,
        territoryTotal: 15,
      });
      expect(score.powerScore).toBe(100);
      expect(score.collectionScore).toBe(100);
      expect(score.prestigeScore).toBe(100);
      expect(score.territoryScore).toBe(100);
      expect(score.totalScore).toBe(100);
    });

    it('零分上下文应获得低分', () => {
      const score = system.evaluateConditions({
        totalPower: 0,
        powerCap: 100000,
        heroCount: 0,
        heroTotal: 40,
        prestigeLevel: 1,
        prestigeCap: 30,
        territoryOwned: 0,
        territoryTotal: 15,
      });
      expect(score.powerScore).toBe(0);
      expect(score.collectionScore).toBe(0);
      expect(score.totalScore).toBeLessThan(20);
    });

    it('四维权重应正确应用', () => {
      const score = system.evaluateConditions({
        totalPower: 50000,
        powerCap: 100000,
        heroCount: 20,
        heroTotal: 40,
        prestigeLevel: 15,
        prestigeCap: 30,
        territoryOwned: 7,
        territoryTotal: 15,
      });
      // powerScore=50, collectionScore=50, prestigeScore=50, territoryScore≈47
      // totalScore = 50*0.3 + 50*0.25 + 50*0.25 + 47*0.20 ≈ 49.4
      expect(score.totalScore).toBeGreaterThan(40);
      expect(score.totalScore).toBeLessThan(60);
    });

    it('单项不应超过100', () => {
      const score = system.evaluateConditions({
        totalPower: 999999,
        powerCap: 100,
        heroCount: 999,
        heroTotal: 40,
        prestigeLevel: 999,
        prestigeCap: 30,
        territoryOwned: 999,
        territoryTotal: 15,
      });
      expect(score.powerScore).toBeLessThanOrEqual(100);
      expect(score.collectionScore).toBeLessThanOrEqual(100);
    });
  });

  // ─── 结局触发 ─────────────────────────────

  describe('triggerUnification', () => {
    it('未占领全部领土不应满足触发条件', () => {
      // 默认上下文 territoryOwned=0, territoryTotal=15
      expect(system.checkTrigger()).toBe(false);
    });

    it('占领全部领土后应可触发', () => {
      // 通过mock registry模拟全部占领
      const deps = {
        eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
        registry: {
          get: vi.fn().mockImplementation((key: string) => {
            if (key === 'territory') {
              return {
                getPlayerTerritoryCount: () => 15,
                getTotalTerritoryCount: () => 15,
              };
            }
            return null;
          }),
        },
      };
      system.init(deps);
      expect(system.checkTrigger()).toBe(true);
    });

    it('触发后应锁定结局', () => {
      const deps = {
        eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
        registry: {
          get: vi.fn().mockImplementation((key: string) => {
            if (key === 'territory') {
              return {
                getPlayerTerritoryCount: () => 15,
                getTotalTerritoryCount: () => 15,
              };
            }
            if (key === 'hero') {
              return {
                calculateTotalPower: () => 50000,
                getAllGenerals: () => Array.from({ length: 20 }, () => ({ id: 'h' })),
              };
            }
            if (key === 'prestige') {
              return { getState: () => ({ level: 15 }) };
            }
            return null;
          }),
        },
      };
      system.init(deps);
      const result = system.triggerUnification();
      expect(result.triggered).toBe(true);
      expect(result.grade).toBeDefined();
      expect(result.score).toBeDefined();
    });

    it('重复触发应返回缓存结果', () => {
      const deps = {
        eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
        registry: {
          get: vi.fn().mockImplementation((key: string) => {
            if (key === 'territory') {
              return {
                getPlayerTerritoryCount: () => 15,
                getTotalTerritoryCount: () => 15,
              };
            }
            return null;
          }),
        },
      };
      system.init(deps);
      const r1 = system.triggerUnification();
      const r2 = system.triggerUnification();
      expect(r1.grade).toBe(r2.grade);
    });
  });

  // ─── 序列化 ───────────────────────────────

  describe('序列化', () => {
    it('应正确序列化和反序列化', () => {
      const deps = {
        eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
        registry: {
          get: vi.fn().mockImplementation((key: string) => {
            if (key === 'territory') {
              return {
                getPlayerTerritoryCount: () => 15,
                getTotalTerritoryCount: () => 15,
              };
            }
            return null;
          }),
        },
      };
      system.init(deps);
      system.triggerUnification();
      const data = system.serialize();

      const system2 = new EndingSystem();
      system2.deserialize(data);
      expect(system2.getState().unified).toBe(true);
    });

    it('未触发时序列化应为默认值', () => {
      const data = system.serialize();
      expect(data.unified).toBe(false);
      expect(data.finalGrade).toBeNull();
    });
  });

  // ─── reset ────────────────────────────────

  describe('reset', () => {
    it('应重置为初始状态', () => {
      const deps = {
        eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
        registry: {
          get: vi.fn().mockImplementation((key: string) => {
            if (key === 'territory') {
              return {
                getPlayerTerritoryCount: () => 15,
                getTotalTerritoryCount: () => 15,
              };
            }
            return null;
          }),
        },
      };
      system.init(deps);
      system.triggerUnification();
      system.reset();
      expect(system.getState().unified).toBe(false);
    });
  });
});
