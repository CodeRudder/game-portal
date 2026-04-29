/**
 * GlobalStatisticsSystem 单元测试
 *
 * 覆盖：
 * 1. update — 累计在线时长
 * 2. getSnapshot — 聚合统计
 * 3. getTotalPlayTime — 获取游戏时长
 * 4. serialize / deserialize — 存档
 * 5. reset — 重置
 */

import { GlobalStatisticsSystem } from '../GlobalStatisticsSystem';

describe('GlobalStatisticsSystem', () => {
  let system: GlobalStatisticsSystem;

  const mockDeps = {
    eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
    registry: { get: vi.fn().mockReturnValue(null) },
  };

  beforeEach(() => {
    system = new GlobalStatisticsSystem();
    system.init(mockDeps);
  });

  // ─── update ───────────────────────────────

  describe('update', () => {
    it('应累计在线时长', () => {
      system.update(100);
      system.update(200);
      expect(system.getTotalPlayTime()).toBe(300);
    });

    it('0 dt 应无影响', () => {
      system.update(0);
      expect(system.getTotalPlayTime()).toBe(0);
    });
  });

  // ─── getSnapshot ──────────────────────────

  describe('getSnapshot', () => {
    it('应返回统计快照', () => {
      system.update(100);
      const snapshot = system.getSnapshot();
      expect(snapshot.totalPlayTime).toBe(100);
      expect(snapshot.totalPower).toBe(0);
      expect(snapshot.heroCount).toBe(0);
    });

    it('应聚合英雄系统数据', () => {
      const deps = {
        eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
        registry: {
          get: vi.fn().mockImplementation((key: string) => {
            if (key === 'hero') {
              return {
                calculateTotalPower: () => 50000,
                getAllGenerals: () => [{ id: 'h1' }, { id: 'h2' }],
              };
            }
            return null;
          }),
        },
      };
      system.init(deps);
      const snapshot = system.getSnapshot();
      expect(snapshot.totalPower).toBe(50000);
      expect(snapshot.heroCount).toBe(2);
    });

    it('应聚合领土系统数据', () => {
      const deps = {
        eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
        registry: {
          get: vi.fn().mockImplementation((key: string) => {
            if (key === 'territory') {
              return {
                getPlayerTerritoryCount: () => 10,
                getTotalTerritoryCount: () => 15,
              };
            }
            return null;
          }),
        },
      };
      system.init(deps);
      const snapshot = system.getSnapshot();
      expect(snapshot.territoryOwned).toBe(10);
      expect(snapshot.territoryTotal).toBe(15);
    });

    it('注册表查询失败应使用默认值', () => {
      const deps = {
        eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
        registry: {
          get: vi.fn().mockImplementation(() => { throw new Error('fail'); }),
        },
      };
      system.init(deps);
      const snapshot = system.getSnapshot();
      expect(snapshot.totalPower).toBe(0);
    });
  });

  // ─── getTotalPlayTime ─────────────────────

  describe('getTotalPlayTime', () => {
    it('初始应为0', () => {
      expect(system.getTotalPlayTime()).toBe(0);
    });
  });

  // ─── 序列化 ───────────────────────────────

  describe('serialize / deserialize', () => {
    it('应正确序列化和反序列化', () => {
      system.update(500);
      const data = system.serialize();

      const system2 = new GlobalStatisticsSystem();
      system2.deserialize(data);
      expect(system2.getTotalPlayTime()).toBe(500);
    });
  });

  // ─── reset ────────────────────────────────

  describe('reset', () => {
    it('应重置在线时长', () => {
      system.update(500);
      system.reset();
      expect(system.getTotalPlayTime()).toBe(0);
    });
  });
});
