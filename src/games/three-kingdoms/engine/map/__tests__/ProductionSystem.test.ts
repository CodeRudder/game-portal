/**
 * ProductionSystem 领土产出系统测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProductionSystem } from '../ProductionSystem';
import type { ISystemDeps } from '../../../core/types';

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as ISystemDeps;
}

describe('ProductionSystem', () => {
  let system: ProductionSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    system = new ProductionSystem();
    deps = createMockDeps();
    system.init(deps);
  });

  // ── 初始化 ─────────────────────────────────

  describe('初始化', () => {
    it('name为production', () => {
      expect(system.name).toBe('production');
    });

    it('初始无领土', () => {
      expect(system.getState().territories).toEqual([]);
    });

    it('初始全局倍率为1', () => {
      expect(system.getState().globalMultiplier).toBe(1);
    });
  });

  // ── 领土管理 ───────────────────────────────

  describe('领土管理', () => {
    it('registerTerritory注册领土', () => {
      system.registerTerritory('t1', 3);
      expect(system.getState().territories.length).toBe(1);
      expect(system.getState().territories[0].level).toBe(3);
    });

    it('unregisterTerritory移除领土', () => {
      system.registerTerritory('t1', 1);
      system.unregisterTerritory('t1');
      expect(system.getState().territories.length).toBe(0);
    });

    it('updateLevel更新等级', () => {
      system.registerTerritory('t1', 1);
      system.updateLevel('t1', 5);
      expect(system.getState().territories[0].level).toBe(5);
    });
  });

  // ── 建筑加成 ───────────────────────────────

  describe('建筑加成', () => {
    it('setBuildingBonus设置加成', () => {
      system.registerTerritory('t1', 1);
      system.setBuildingBonus('t1', 'farm', 0.5);

      const rate = system.getProductionRate('t1');
      expect(rate).toBeTruthy();
      // 有建筑加成时产出应更高
      expect(rate!.grain).toBeGreaterThan(0);
    });

    it('removeBuildingBonus移除加成', () => {
      system.registerTerritory('t1', 1);
      system.setBuildingBonus('t1', 'farm', 0.5);
      const rateBefore = system.getProductionRate('t1');

      system.removeBuildingBonus('t1', 'farm');
      const rateAfter = system.getProductionRate('t1');

      expect(rateAfter!.grain).toBeLessThan(rateBefore!.grain);
    });
  });

  // ── 资源操作 ───────────────────────────────

  describe('资源操作', () => {
    it('getResources获取资源', () => {
      system.registerTerritory('t1', 1);
      const resources = system.getResources('t1');
      expect(resources).toBeTruthy();
      expect(resources!.gold).toBe(0);
    });

    it('addResources添加资源', () => {
      system.registerTerritory('t1', 1);
      system.addResources('t1', { gold: 100, grain: 50 });

      const resources = system.getResources('t1');
      expect(resources!.gold).toBe(100);
      expect(resources!.grain).toBe(50);
    });

    it('addResources不超过存储上限', () => {
      system.registerTerritory('t1', 1);
      system.addResources('t1', { gold: 100000 });

      const resources = system.getResources('t1');
      expect(resources!.gold).toBeLessThanOrEqual(10000); // 默认上限
    });

    it('consumeResources消耗资源', () => {
      system.registerTerritory('t1', 1);
      system.addResources('t1', { gold: 100 });

      const success = system.consumeResources('t1', { gold: 50 });
      expect(success).toBe(true);
      expect(system.getResources('t1')!.gold).toBe(50);
    });

    it('consumeResources不足时返回false', () => {
      system.registerTerritory('t1', 1);

      const success = system.consumeResources('t1', { gold: 100 });
      expect(success).toBe(false);
    });

    it('getResources不存在返回null', () => {
      expect(system.getResources('不存在')).toBeNull();
    });
  });

  // ── 产出速率 ───────────────────────────────

  describe('产出速率', () => {
    it('getProductionRate返回速率', () => {
      system.registerTerritory('t1', 1);
      const rate = system.getProductionRate('t1');

      expect(rate).toBeTruthy();
      expect(rate!.gold).toBeGreaterThan(0);
      expect(rate!.grain).toBeGreaterThan(0);
      expect(rate!.troops).toBeGreaterThan(0);
    });

    it('高等级产出更快', () => {
      system.registerTerritory('t1', 1);
      system.registerTerritory('t2', 5);

      const rate1 = system.getProductionRate('t1');
      const rate2 = system.getProductionRate('t2');

      expect(rate2!.gold).toBeGreaterThan(rate1!.gold);
    });

    it('全局倍率影响产出', () => {
      system.registerTerritory('t1', 1);
      const rateBefore = system.getProductionRate('t1');

      system.setGlobalMultiplier(2);
      const rateAfter = system.getProductionRate('t1');

      expect(rateAfter!.gold).toBeCloseTo(rateBefore!.gold * 2);
    });

    it('getProductionRate不存在返回null', () => {
      expect(system.getProductionRate('不存在')).toBeNull();
    });
  });

  // ── 快速产出 ───────────────────────────────

  describe('快速产出', () => {
    it('quickProduce产出资源', () => {
      system.registerTerritory('t1', 1);
      const produced = system.quickProduce('t1', 3600); // 1小时

      expect(produced.gold).toBeGreaterThan(0);
      expect(produced.grain).toBeGreaterThan(0);
    });

    it('quickProduce更新资源池', () => {
      system.registerTerritory('t1', 1);
      system.quickProduce('t1', 3600);

      const resources = system.getResources('t1');
      expect(resources!.gold).toBeGreaterThan(0);
    });

    it('quickProduce不存在返回0', () => {
      const produced = system.quickProduce('不存在', 3600);
      expect(produced.gold).toBe(0);
    });
  });

  // ── update ─────────────────────────────────

  describe('update', () => {
    it('update累积产出', () => {
      system.registerTerritory('t1', 1);
      system.update(1); // 1秒

      const resources = system.getResources('t1');
      expect(resources!.gold).toBeGreaterThan(0);
    });
  });

  // ── 序列化 ─────────────────────────────────

  describe('序列化', () => {
    it('serialize返回存档', () => {
      system.registerTerritory('t1', 3);
      system.addResources('t1', { gold: 100 });

      const save = system.serialize();
      expect(save.version).toBe(1);
      expect(save.territories.length).toBe(1);
    });

    it('deserialize恢复状态', () => {
      system.registerTerritory('t1', 3);
      system.addResources('t1', { gold: 100 });

      const save = system.serialize();
      const system2 = new ProductionSystem();
      system2.init(createMockDeps());
      system2.deserialize(save);

      expect(system2.getResources('t1')!.gold).toBe(100);
    });

    it('deserialize处理空数据', () => {
      expect(() => system.deserialize(null as any)).not.toThrow();
    });
  });
});
