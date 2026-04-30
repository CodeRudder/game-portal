/**
 * R22-5: 存档系统异常路径覆盖
 *
 * 覆盖场景：
 * - 损坏数据加载（无效JSON、字段缺失）
 * - 版本迁移（旧版本存档）
 * - 空存档恢复
 * - 序列化/反序列化一致性
 *
 * R29: 将 mockDeps 替换为 createRealDeps()（基于真实引擎实例）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceSystem } from '../../resource/ResourceSystem';
import { BuildingSystem } from '../../building/BuildingSystem';
import { HeroSystem } from '../../hero/HeroSystem';
import { SAVE_VERSION } from '../../resource/resource-config';
import { ENGINE_SAVE_VERSION } from '../../../shared/constants';
import { createRealDeps } from '../../../test-utils/test-helpers';
import type { ISystemDeps } from '../../../core/types';

describe('R22-5: 存档系统异常路径', () => {

  // ═══════════════════════════════════════════
  // 损坏数据加载
  // ═══════════════════════════════════════════
  describe('损坏数据加载', () => {
    let rs: ResourceSystem;
    let bs: BuildingSystem;
    let hs: HeroSystem;
    let deps: ISystemDeps;

    beforeEach(() => {
      deps = createRealDeps();
      rs = new ResourceSystem();
      bs = new BuildingSystem();
      hs = new HeroSystem();
      rs.init(deps);
      hs.init(deps);
    });

    it('ResourceSystem deserialize 缺失字段不崩溃', () => {
      // 缺少部分资源字段
      rs.deserialize({
        resources: { grain: 100, gold: 200 } as any,
        lastSaveTime: Date.now(),
        productionRates: { grain: 1 } as any,
        caps: { grain: 2000 } as any,
        version: SAVE_VERSION,
      });
      // 不崩溃，缺失字段被修正为 0
      expect(rs.getAmount('grain')).toBe(100);
      expect(rs.getAmount('troops')).toBe(0);
    });

    it('ResourceSystem deserialize 版本不匹配时兼容加载', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      rs.deserialize({
        resources: { grain: 100, gold: 200, troops: 50, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 },
        lastSaveTime: Date.now(),
        productionRates: { grain: 1, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 },
        caps: { grain: 2000, gold: null, troops: 500, mandate: null, techPoint: null, recruitToken: null, skillBook: null },
        version: 999, // 不存在的版本
      });
      // 应该兼容加载
      expect(rs.getAmount('grain')).toBe(100);
      warnSpy.mockRestore();
    });

    it('BuildingSystem deserialize 空建筑数据不崩溃', () => {
      expect(() => {
        bs.deserialize({
          buildings: {} as any,
          version: 1,
        });
      }).not.toThrow();
    });

    it('HeroSystem deserialize 空武将数据不崩溃', () => {
      expect(() => {
        hs.deserialize({
          version: 1,
          state: {
            generals: {},
            fragments: {},
          },
        });
      }).not.toThrow();
    });

    it('ResourceSystem reset 后恢复初始状态', () => {
      rs.addResource('grain', 5000);
      rs.reset();
      expect(rs.getAmount('grain')).toBe(500); // INITIAL_RESOURCES.grain
    });

    it('BuildingSystem reset 后恢复初始状态', () => {
      bs.reset();
      expect(bs.getLevel('castle')).toBe(1);
      expect(bs.getLevel('farmland')).toBe(1);
    });

    it('HeroSystem reset 后恢复初始状态', () => {
      hs.addGeneral('liubei');
      hs.reset();
      expect(hs.getGeneralCount()).toBe(0);
      expect(hs.getAllFragments()).toEqual({});
    });
  });

  // ═══════════════════════════════════════════
  // 序列化/反序列化一致性
  // ═══════════════════════════════════════════
  describe('序列化/反序列化一致性', () => {
    it('ResourceSystem 序列化后反序列化数据一致', () => {
      const deps = createRealDeps();
      const rs1 = new ResourceSystem();
      rs1.init(deps);
      rs1.addResource('grain', 1000);
      rs1.addResource('gold', 500);

      const data = rs1.serialize();

      const deps2 = createRealDeps();
      const rs2 = new ResourceSystem();
      rs2.init(deps2);
      rs2.deserialize(data);

      expect(rs2.getAmount('grain')).toBe(rs1.getAmount('grain'));
      expect(rs2.getAmount('gold')).toBe(rs1.getAmount('gold'));
    });

    it('BuildingSystem 序列化后反序列化数据一致', () => {
      const bs1 = new BuildingSystem();
      const data = bs1.serialize();

      const bs2 = new BuildingSystem();
      bs2.deserialize(data);

      expect(bs2.getLevel('castle')).toBe(bs1.getLevel('castle'));
      expect(bs2.getLevel('farmland')).toBe(bs1.getLevel('farmland'));
    });

    it('HeroSystem 序列化后反序列化数据一致', () => {
      const deps = createRealDeps();
      const hs1 = new HeroSystem();
      hs1.init(deps);
      hs1.addGeneral('liubei');
      hs1.addGeneral('guanyu');
      hs1.addFragment('zhangfei', 50);

      const data = hs1.serialize();

      const deps2 = createRealDeps();
      const hs2 = new HeroSystem();
      hs2.init(deps2);
      hs2.deserialize(data);

      expect(hs2.getGeneralCount()).toBe(2);
      expect(hs2.hasGeneral('liubei')).toBe(true);
      expect(hs2.hasGeneral('guanyu')).toBe(true);
      expect(hs2.getFragments('zhangfei')).toBe(50);
    });
  });

  // ═══════════════════════════════════════════
  // 空存档恢复
  // ═══════════════════════════════════════════
  describe('空存档恢复', () => {
    it('ResourceSystem 全零存档恢复正常', () => {
      const deps = createRealDeps();
      const rs = new ResourceSystem();
      rs.init(deps);
      rs.deserialize({
        resources: { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 },
        lastSaveTime: 0,
        productionRates: { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 },
        caps: { grain: 2000, gold: null, troops: 500, mandate: null, techPoint: null, recruitToken: null, skillBook: null },
        version: SAVE_VERSION,
      });
      expect(rs.getAmount('grain')).toBe(0);
      expect(rs.getAmount('gold')).toBe(0);
    });
  });
});
