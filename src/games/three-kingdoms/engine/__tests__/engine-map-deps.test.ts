/**
 * engine-map-deps.ts 单元测试
 *
 * 覆盖：
 * - createMapSystems: 创建所有地图子系统实例
 * - initMapSystems: 按顺序初始化所有子系统
 */

import { vi, describe, it, expect } from 'vitest';
import { createMapSystems, initMapSystems } from '../engine-map-deps';
import type { ISystemDeps } from '../../core/types';

function createMockDeps(): ISystemDeps {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as unknown,
    config: { get: vi.fn(), register: vi.fn() } as unknown,
    registry: { get: vi.fn(), register: vi.fn() } as unknown,
  } as unknown as ISystemDeps;
}

describe('engine-map-deps', () => {
  describe('createMapSystems()', () => {
    it('创建包含所有 6 个子系统的集合', () => {
      const systems = createMapSystems();

      expect(systems.worldMap).toBeDefined();
      expect(systems.territory).toBeDefined();
      expect(systems.siege).toBeDefined();
      expect(systems.garrison).toBeDefined();
      expect(systems.siegeEnhancer).toBeDefined();
      expect(systems.mapEvent).toBeDefined();
    });

    it('每次调用返回新实例', () => {
      const a = createMapSystems();
      const b = createMapSystems();
      expect(a.worldMap).not.toBe(b.worldMap);
      expect(a.territory).not.toBe(b.territory);
    });
  });

  describe('initMapSystems()', () => {
    it('调用所有子系统的 init(deps)', () => {
      const systems = createMapSystems();
      const deps = createMockDeps();

      const initSpies = [
        vi.spyOn(systems.worldMap, 'init'),
        vi.spyOn(systems.territory, 'init'),
        vi.spyOn(systems.garrison, 'init'),
        vi.spyOn(systems.siege, 'init'),
        vi.spyOn(systems.siegeEnhancer, 'init'),
        vi.spyOn(systems.mapEvent, 'init'),
      ];

      initMapSystems(systems, deps);

      for (const spy of initSpies) {
        expect(spy).toHaveBeenCalledWith(deps);
      }
    });

    it('初始化顺序：worldMap → territory → garrison → siege → siegeEnhancer → mapEvent', () => {
      const systems = createMapSystems();
      const deps = createMockDeps();
      const order: string[] = [];

      vi.spyOn(systems.worldMap, 'init').mockImplementation(() => order.push('worldMap'));
      vi.spyOn(systems.territory, 'init').mockImplementation(() => order.push('territory'));
      vi.spyOn(systems.garrison, 'init').mockImplementation(() => order.push('garrison'));
      vi.spyOn(systems.siege, 'init').mockImplementation(() => order.push('siege'));
      vi.spyOn(systems.siegeEnhancer, 'init').mockImplementation(() => order.push('siegeEnhancer'));
      vi.spyOn(systems.mapEvent, 'init').mockImplementation(() => order.push('mapEvent'));

      initMapSystems(systems, deps);

      expect(order).toEqual(['worldMap', 'territory', 'garrison', 'siege', 'siegeEnhancer', 'mapEvent']);
    });
  });
});
