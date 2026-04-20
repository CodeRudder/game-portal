/**
 * GarrisonSystem 测试
 *
 * 覆盖：
 *   #1 驻防机制 — 武将派遣、防御加成、产出加成、互斥校验
 *   撤回驻防
 *   查询方法
 *   序列化/反序列化
 *
 * @module engine/map/__tests__/GarrisonSystem.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GarrisonSystem } from '../GarrisonSystem';
import { TerritorySystem } from '../TerritorySystem';
import type { ISystemDeps } from '../../../core/types';
import type { ISubsystemRegistry } from '../../../core/types/subsystem';
import type { GeneralData } from '../../hero/hero.types';
import { Quality } from '../../hero/hero.types';
import { DEFENSE_BONUS_FACTOR, QUALITY_PRODUCTION_BONUS } from '../../../core/map';

// ─────────────────────────────────────────────
// 测试武将数据
// ─────────────────────────────────────────────

function createGeneral(id: string, quality: Quality, defense: number): GeneralData {
  return {
    id,
    name: `武将${id}`,
    quality,
    baseStats: { attack: 100, defense, intelligence: 80, speed: 70 },
    level: 10,
    exp: 0,
    faction: 'shu',
    skills: [],
  };
}

const GENERALS: Record<string, GeneralData> = {
  guanyu: createGeneral('guanyu', Quality.LEGENDARY, 200),
  zhangfei: createGeneral('zhangfei', Quality.EPIC, 180),
  zhaoyun: createGeneral('zhaoyun', Quality.RARE, 160),
  dianwei: createGeneral('dianwei', Quality.FINE, 120),
  soldier: createGeneral('soldier', Quality.COMMON, 80),
};

// ─────────────────────────────────────────────
// Mock 工厂
// ─────────────────────────────────────────────

function createMockDeps(
  generals: Record<string, GeneralData> = GENERALS,
  formationGeneralIds: string[] = [],
): ISystemDeps {
  const territorySys = new TerritorySystem();

  const deps: ISystemDeps = {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: {
      register: vi.fn(),
      get: vi.fn().mockImplementation((name: string) => {
        if (name === 'territory') return territorySys;
        if (name === 'hero') return { getGeneral: (id: string) => generals[id] };
        if (name === 'heroFormation') return {
          isGeneralInAnyFormation: (id: string) => formationGeneralIds.includes(id),
        };
        throw new Error(`Subsystem ${name} not found`);
      }),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn().mockImplementation((name: string) =>
        ['territory', 'hero', 'heroFormation'].includes(name)),
      unregister: vi.fn(),
    } as unknown as ISubsystemRegistry,
  };

  territorySys.init(deps);
  return deps;
}

/** 占领一个领土为玩家所有 */
function captureTerritory(deps: ISystemDeps, territoryId: string): void {
  const registry = deps.registry as unknown as ISubsystemRegistry;
  const territorySys = registry.get('territory') as unknown as TerritorySystem;
  territorySys.captureTerritory(territoryId, 'player');
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('GarrisonSystem', () => {
  let garrison: GarrisonSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    garrison = new GarrisonSystem();
    deps = createMockDeps();
    garrison.init(deps);
  });

  // ─── ISubsystem 接口 ───────────────────────

  describe('ISubsystem', () => {
    it('name 为 garrison', () => {
      expect(garrison.name).toBe('garrison');
    });

    it('getState 返回初始空状态', () => {
      const state = garrison.getState();
      expect(state.totalGarrisons).toBe(0);
      expect(Object.keys(state.assignments)).toHaveLength(0);
    });

    it('reset 清空所有驻防', () => {
      captureTerritory(deps, 'city-luoyang');
      garrison.assignGarrison('city-luoyang', 'guanyu');
      expect(garrison.getGarrisonCount()).toBe(1);

      garrison.reset();
      expect(garrison.getGarrisonCount()).toBe(0);
    });
  });

  // ─── 驻防派遣 ──────────────────────────────

  describe('assignGarrison', () => {
    it('成功派遣武将驻防', () => {
      captureTerritory(deps, 'city-luoyang');
      const result = garrison.assignGarrison('city-luoyang', 'guanyu');

      expect(result.success).toBe(true);
      expect(result.assignment).toBeDefined();
      expect(result.assignment!.territoryId).toBe('city-luoyang');
      expect(result.assignment!.generalId).toBe('guanyu');
      expect(result.bonus).toBeDefined();
    });

    it('领土不存在时失败', () => {
      const result = garrison.assignGarrison('nonexistent', 'guanyu');
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('TERRITORY_NOT_FOUND');
    });

    it('非己方领土时失败', () => {
      // city-luoyang 默认是 neutral
      const result = garrison.assignGarrison('city-luoyang', 'guanyu');
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('TERRITORY_NOT_OWNED');
    });

    it('武将不存在时失败', () => {
      captureTerritory(deps, 'city-luoyang');
      const result = garrison.assignGarrison('city-luoyang', 'nonexistent');
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('GENERAL_NOT_FOUND');
    });

    it('武将已驻防其他领土时失败', () => {
      captureTerritory(deps, 'city-luoyang');
      captureTerritory(deps, 'city-xuchang');

      garrison.assignGarrison('city-luoyang', 'guanyu');
      const result = garrison.assignGarrison('city-xuchang', 'guanyu');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('GENERAL_ALREADY_GARRISONED');
    });

    it('武将在出战编队中时失败', () => {
      const depsWithFormation = createMockDeps(GENERALS, ['guanyu']);
      const garrisonWithFormation = new GarrisonSystem();
      garrisonWithFormation.init(depsWithFormation);

      captureTerritory(depsWithFormation, 'city-luoyang');
      const result = garrisonWithFormation.assignGarrison('city-luoyang', 'guanyu');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('GENERAL_IN_FORMATION');
    });

    it('领土已有驻防武将时失败', () => {
      captureTerritory(deps, 'city-luoyang');

      garrison.assignGarrison('city-luoyang', 'guanyu');
      const result = garrison.assignGarrison('city-luoyang', 'zhangfei');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('TERRITORY_ALREADY_GARRISONED');
    });

    it('驻防成功时发出 garrison:assigned 事件', () => {
      captureTerritory(deps, 'city-luoyang');
      garrison.assignGarrison('city-luoyang', 'guanyu');

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'garrison:assigned',
        expect.objectContaining({
          territoryId: 'city-luoyang',
          generalId: 'guanyu',
        }),
      );
    });
  });

  // ─── 撤回驻防 ──────────────────────────────

  describe('withdrawGarrison', () => {
    it('成功撤回驻防武将', () => {
      captureTerritory(deps, 'city-luoyang');
      garrison.assignGarrison('city-luoyang', 'guanyu');

      const result = garrison.withdrawGarrison('city-luoyang');
      expect(result.success).toBe(true);
      expect(result.generalId).toBe('guanyu');
      expect(garrison.getGarrisonCount()).toBe(0);
    });

    it('无驻防时撤回失败', () => {
      const result = garrison.withdrawGarrison('city-luoyang');
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeDefined();
    });

    it('撤回后武将可再次驻防其他领土', () => {
      captureTerritory(deps, 'city-luoyang');
      captureTerritory(deps, 'city-xuchang');

      garrison.assignGarrison('city-luoyang', 'guanyu');
      garrison.withdrawGarrison('city-luoyang');

      const result = garrison.assignGarrison('city-xuchang', 'guanyu');
      expect(result.success).toBe(true);
    });

    it('撤回时发出 garrison:withdrawn 事件', () => {
      captureTerritory(deps, 'city-luoyang');
      garrison.assignGarrison('city-luoyang', 'guanyu');

      (deps.eventBus.emit as ReturnType<typeof vi.fn>).mockClear();
      garrison.withdrawGarrison('city-luoyang');

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'garrison:withdrawn',
        expect.objectContaining({
          territoryId: 'city-luoyang',
          generalId: 'guanyu',
        }),
      );
    });
  });

  // ─── 防御加成 ──────────────────────────────

  describe('防御加成', () => {
    it('防御加成 = 武将defense × DEFENSE_BONUS_FACTOR', () => {
      const general = GENERALS.guanyu; // defense=200
      const expected = 200 * DEFENSE_BONUS_FACTOR; // 0.6

      const bonus = garrison.calculateBonus(general, { grain: 10, gold: 10, troops: 5, mandate: 1 });
      expect(bonus.defenseBonus).toBeCloseTo(expected, 3);
    });

    it('不同武将的防御加成不同', () => {
      const bonus1 = garrison.calculateBonus(GENERALS.guanyu, { grain: 10, gold: 10, troops: 5, mandate: 1 });
      const bonus2 = garrison.calculateBonus(GENERALS.soldier, { grain: 10, gold: 10, troops: 5, mandate: 1 });

      expect(bonus1.defenseBonus).toBeGreaterThan(bonus2.defenseBonus);
    });

    it('getEffectiveDefense 正确计算加成后防御', () => {
      captureTerritory(deps, 'city-luoyang');
      garrison.assignGarrison('city-luoyang', 'guanyu');

      const territory = (deps.registry.get('territory') as unknown as TerritorySystem)
        .getTerritoryById('city-luoyang')!;
      const effective = garrison.getEffectiveDefense('city-luoyang', territory.defenseValue);

      expect(effective).toBeGreaterThan(territory.defenseValue);
    });

    it('无驻防时 getEffectiveDefense 返回基础值', () => {
      const effective = garrison.getEffectiveDefense('city-luoyang', 100);
      expect(effective).toBe(100);
    });
  });

  // ─── 产出加成 ──────────────────────────────

  describe('产出加成', () => {
    it('产出加成按品质递增', () => {
      const production = { grain: 10, gold: 10, troops: 5, mandate: 1 };

      const common = garrison.calculateBonus(GENERALS.soldier, production);
      const fine = garrison.calculateBonus(GENERALS.dianwei, production);
      const rare = garrison.calculateBonus(GENERALS.zhaoyun, production);
      const epic = garrison.calculateBonus(GENERALS.zhangfei, production);
      const legendary = garrison.calculateBonus(GENERALS.guanyu, production);

      expect(legendary.productionBonus.grain).toBeGreaterThan(epic.productionBonus.grain);
      expect(epic.productionBonus.grain).toBeGreaterThan(rare.productionBonus.grain);
      expect(rare.productionBonus.grain).toBeGreaterThan(fine.productionBonus.grain);
      expect(fine.productionBonus.grain).toBeGreaterThan(common.productionBonus.grain);
    });

    it('传说品质产出加成为 30%', () => {
      const production = { grain: 100, gold: 100, troops: 50, mandate: 10 };
      const bonus = garrison.calculateBonus(GENERALS.guanyu, production);

      expect(bonus.productionBonus.grain).toBe(30);
      expect(bonus.productionBonus.gold).toBe(30);
      expect(bonus.productionBonus.troops).toBe(15);
      expect(bonus.productionBonus.mandate).toBe(3);
    });

    it('普通品质产出加成为 5%', () => {
      const production = { grain: 100, gold: 100, troops: 50, mandate: 10 };
      const bonus = garrison.calculateBonus(GENERALS.soldier, production);

      expect(bonus.productionBonus.grain).toBe(5);
      expect(bonus.productionBonus.gold).toBe(5);
    });

    it('getEffectiveProduction 正确计算加成后产出', () => {
      captureTerritory(deps, 'city-luoyang');
      garrison.assignGarrison('city-luoyang', 'guanyu');

      const territory = (deps.registry.get('territory') as unknown as TerritorySystem)
        .getTerritoryById('city-luoyang')!;
      const effective = garrison.getEffectiveProduction('city-luoyang', territory.currentProduction);

      expect(effective.grain).toBeGreaterThan(territory.currentProduction.grain);
      expect(effective.gold).toBeGreaterThan(territory.currentProduction.gold);
    });

    it('无驻防时 getEffectiveProduction 返回基础值', () => {
      const production = { grain: 10, gold: 10, troops: 5, mandate: 1 };
      const effective = garrison.getEffectiveProduction('city-luoyang', production);
      expect(effective).toEqual(production);
    });
  });

  // ─── 查询方法 ──────────────────────────────

  describe('查询方法', () => {
    beforeEach(() => {
      captureTerritory(deps, 'city-luoyang');
      captureTerritory(deps, 'city-xuchang');
    });

    it('getAssignment 返回驻防记录', () => {
      garrison.assignGarrison('city-luoyang', 'guanyu');
      const assignment = garrison.getAssignment('city-luoyang');

      expect(assignment).toBeDefined();
      expect(assignment!.generalId).toBe('guanyu');
    });

    it('getAssignment 无驻防时返回 null', () => {
      expect(garrison.getAssignment('city-luoyang')).toBeNull();
    });

    it('getAllAssignments 返回所有驻防', () => {
      garrison.assignGarrison('city-luoyang', 'guanyu');
      garrison.assignGarrison('city-xuchang', 'zhangfei');

      const all = garrison.getAllAssignments();
      expect(all).toHaveLength(2);
    });

    it('isTerritoryGarrisoned 正确判断', () => {
      expect(garrison.isTerritoryGarrisoned('city-luoyang')).toBe(false);
      garrison.assignGarrison('city-luoyang', 'guanyu');
      expect(garrison.isTerritoryGarrisoned('city-luoyang')).toBe(true);
    });

    it('isGeneralGarrisoned 正确判断', () => {
      expect(garrison.isGeneralGarrisoned('guanyu')).toBe(false);
      garrison.assignGarrison('city-luoyang', 'guanyu');
      expect(garrison.isGeneralGarrisoned('guanyu')).toBe(true);
    });

    it('getGarrisonCount 正确', () => {
      expect(garrison.getGarrisonCount()).toBe(0);
      garrison.assignGarrison('city-luoyang', 'guanyu');
      expect(garrison.getGarrisonCount()).toBe(1);
      garrison.assignGarrison('city-xuchang', 'zhangfei');
      expect(garrison.getGarrisonCount()).toBe(2);
    });
  });

  // ─── 产出汇总 ──────────────────────────────

  describe('getPlayerGarrisonedProductionSummary', () => {
    it('无驻防时返回零加成', () => {
      const summary = garrison.getPlayerGarrisonedProductionSummary();
      expect(summary.totalBonus).toEqual({ grain: 0, gold: 0, troops: 0, mandate: 0 });
      expect(summary.details).toHaveLength(0);
    });

    it('有驻防时返回正确汇总', () => {
      captureTerritory(deps, 'city-luoyang');
      garrison.assignGarrison('city-luoyang', 'guanyu');

      const summary = garrison.getPlayerGarrisonedProductionSummary();
      expect(summary.details).toHaveLength(1);
      expect(summary.totalBonus.grain).toBeGreaterThan(0);
    });
  });

  // ─── 序列化 ────────────────────────────────

  describe('序列化/反序列化', () => {
    it('序列化后可正确恢复', () => {
      captureTerritory(deps, 'city-luoyang');
      garrison.assignGarrison('city-luoyang', 'guanyu');

      const data = garrison.serialize();
      expect(data.version).toBe(1);
      expect(data.assignments).toHaveLength(1);
      expect(data.assignments[0].territoryId).toBe('city-luoyang');

      const newGarrison = new GarrisonSystem();
      newGarrison.init(deps);
      newGarrison.deserialize(data);

      expect(newGarrison.getGarrisonCount()).toBe(1);
      expect(newGarrison.getAssignment('city-luoyang')?.generalId).toBe('guanyu');
    });

    it('空状态序列化/反序列化', () => {
      const data = garrison.serialize();
      expect(data.assignments).toHaveLength(0);

      const newGarrison = new GarrisonSystem();
      newGarrison.init(deps);
      newGarrison.deserialize(data);
      expect(newGarrison.getGarrisonCount()).toBe(0);
    });

    it('反序列化覆盖已有数据', () => {
      captureTerritory(deps, 'city-luoyang');
      garrison.assignGarrison('city-luoyang', 'guanyu');

      const newGarrison = new GarrisonSystem();
      newGarrison.init(deps);
      newGarrison.deserialize({ assignments: [], version: 1 });

      expect(newGarrison.getGarrisonCount()).toBe(0);
    });
  });
});
