/**
 * engine-tech-deps.ts 单元测试
 *
 * 覆盖：
 * - createTechSystems: 创建所有科技子系统实例并注入依赖
 * - initTechSystems: 按顺序初始化所有子系统
 */

import { vi, describe, it, expect } from 'vitest';
import { createTechSystems, initTechSystems } from '../engine-tech-deps';
import type { BuildingSystem } from '../building/BuildingSystem';
import type { ISystemDeps } from '../../core/types';

function createMockBuildingSystem(): BuildingSystem {
  return {
    getLevel: vi.fn(() => 1),
  } as unknown as BuildingSystem;
}

function createMockDeps(): ISystemDeps {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as unknown,
    config: { get: vi.fn(), register: vi.fn() } as unknown,
    registry: { get: vi.fn(), register: vi.fn() } as unknown,
  } as unknown as ISystemDeps;
}

describe('engine-tech-deps', () => {
  describe('createTechSystems()', () => {
    it('创建包含所有 7 个子系统的集合', () => {
      const building = createMockBuildingSystem();
      const systems = createTechSystems(building);

      expect(systems.treeSystem).toBeDefined();
      expect(systems.pointSystem).toBeDefined();
      expect(systems.researchSystem).toBeDefined();
      expect(systems.fusionSystem).toBeDefined();
      expect(systems.linkSystem).toBeDefined();
      expect(systems.offlineSystem).toBeDefined();
      expect(systems.detailProvider).toBeDefined();
    });

    it('每次调用返回新实例', () => {
      const building = createMockBuildingSystem();
      const a = createTechSystems(building);
      const b = createTechSystems(building);
      expect(a.treeSystem).not.toBe(b.treeSystem);
      expect(a.pointSystem).not.toBe(b.pointSystem);
    });
  });

  describe('initTechSystems()', () => {
    it('调用所有子系统的 init(deps)（不含 detailProvider）', () => {
      const building = createMockBuildingSystem();
      const systems = createTechSystems(building);
      const deps = createMockDeps();

      const initSpies = [
        vi.spyOn(systems.treeSystem, 'init'),
        vi.spyOn(systems.pointSystem, 'init'),
        vi.spyOn(systems.researchSystem, 'init'),
        vi.spyOn(systems.fusionSystem, 'init'),
        vi.spyOn(systems.linkSystem, 'init'),
        vi.spyOn(systems.offlineSystem, 'init'),
      ];

      initTechSystems(systems, deps);

      for (const spy of initSpies) {
        expect(spy).toHaveBeenCalledWith(deps);
      }
    });

    it('初始化顺序：tree → point → research → fusion → link → offline', () => {
      const building = createMockBuildingSystem();
      const systems = createTechSystems(building);
      const deps = createMockDeps();
      const order: string[] = [];

      vi.spyOn(systems.treeSystem, 'init').mockImplementation(() => order.push('tree'));
      vi.spyOn(systems.pointSystem, 'init').mockImplementation(() => order.push('point'));
      vi.spyOn(systems.researchSystem, 'init').mockImplementation(() => order.push('research'));
      vi.spyOn(systems.fusionSystem, 'init').mockImplementation(() => order.push('fusion'));
      vi.spyOn(systems.linkSystem, 'init').mockImplementation(() => order.push('link'));
      vi.spyOn(systems.offlineSystem, 'init').mockImplementation(() => order.push('offline'));

      initTechSystems(systems, deps);

      expect(order).toEqual(['tree', 'point', 'research', 'fusion', 'link', 'offline']);
    });
  });
});
