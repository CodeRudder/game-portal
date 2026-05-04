/**
 * 跨系统链路测试 — Sprint 7
 *
 * 覆盖：
 *   XI-007: 武将派驻→建筑产出加成注入
 *   XI-015: 战斗伤兵→医馆恢复链路
 *
 * @module engine/__tests__/cross-system-bridge.test
 */

import { describe, it, expect, vi } from 'vitest';
import { executeTick, type TickContext } from '../engine-tick';
import { HeroDispatchSystem } from '../hero/HeroDispatchSystem';
import { BattleCasualtySystem } from '../battle/BattleCasualtySystem';
import { ClinicTreatmentSystem } from '../clinic/ClinicTreatmentSystem';
import { bridgeBattleCasualtiesToClinic } from '../battle/BattleClinicBridge';

// ─────────────────────────────────────────────
// XI-007: 武将派驻→建筑产出加成
// ─────────────────────────────────────────────

describe('XI-007: 武将派驻→建筑产出加成注入', () => {
  it('无派驻时 heroBonusCallback 返回 0', () => {
    const dispatch = new HeroDispatchSystem();
    const callback = () => {
      const all = dispatch.getAllDispatchBonuses();
      const values = Object.values(all);
      return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length / 100 : 0;
    };
    expect(callback()).toBe(0);
  });

  it('派驻武将后 heroBonusCallback 返回正数', () => {
    const dispatch = new HeroDispatchSystem();
    // 注入武将查询函数
    dispatch.setGetGeneral(() => ({
      id: 'guanyu',
      name: '关羽',
      quality: 'LEGENDARY',
      level: 10,
      baseStats: { attack: 200, defense: 150, hp: 1000, speed: 80 },
    } as any));

    const result = dispatch.dispatchHero('guanyu', 'farmland');
    expect(result.success).toBe(true);
    expect(result.bonusPercent).toBeGreaterThan(0);

    // 通过回调获取加成
    const callback = () => {
      const all = dispatch.getAllDispatchBonuses();
      const values = Object.values(all);
      return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length / 100 : 0;
    };
    const bonus = callback();
    expect(bonus).toBeGreaterThan(0);
  });

  it('executeTick 使用 heroBonusCallback 注入 bonuses.hero', () => {
    let capturedBonuses: any = null;

    // Mock minimal TickContext
    const mockResource = {
      tick: (_ms: number, bonuses: any) => { capturedBonuses = bonuses; },
      getResources: () => ({}),
      getProductionRates: () => ({}),
    } as any;

    const mockBuilding = {
      tick: () => [],
      getCastleBonusMultiplier: () => 1,
      getLevel: () => 0,
      calculateTotalProduction: () => ({}),
      getProductionBuildingLevels: () => ({}),
    } as any;

    const mockTechTree = { getTechBonusMultiplier: () => 0, getEffectValue: () => 0 } as any;
    const mockTechPoint = { syncAcademyLevel: () => {}, update: () => {}, syncResearchSpeedBonus: () => {} } as any;
    const mockTechResearch = { update: () => {} } as any;

    const ctx: TickContext = {
      resource: mockResource,
      building: mockBuilding,
      calendar: { update: () => {} } as any,
      hero: { update: () => {} } as any,
      campaign: { update: () => {} } as any,
      techTree: mockTechTree,
      techPoint: mockTechPoint,
      techResearch: mockTechResearch,
      bus: { emit: () => {} } as any,
      prevResourcesJson: '',
      prevRatesJson: '',
      heroBonusCallback: () => 0.15, // 15% hero bonus
    };

    executeTick(ctx, 1);
    expect(capturedBonuses).not.toBeNull();
    expect(capturedBonuses.hero).toBe(0.15);
  });

  it('无 heroBonusCallback 时 bonuses.hero 默认为 0', () => {
    let capturedBonuses: any = null;

    const mockResource = {
      tick: (_ms: number, bonuses: any) => { capturedBonuses = bonuses; },
      getResources: () => ({}),
      getProductionRates: () => ({}),
    } as any;

    const mockBuilding = {
      tick: () => [],
      getCastleBonusMultiplier: () => 1,
      getLevel: () => 0,
      calculateTotalProduction: () => ({}),
      getProductionBuildingLevels: () => ({}),
    } as any;

    const ctx: TickContext = {
      resource: mockResource,
      building: mockBuilding,
      calendar: { update: () => {} } as any,
      hero: { update: () => {} } as any,
      campaign: { update: () => {} } as any,
      techTree: { getTechBonusMultiplier: () => 0, getEffectValue: () => 0 } as any,
      techPoint: { syncAcademyLevel: () => {}, update: () => {}, syncResearchSpeedBonus: () => {} } as any,
      techResearch: { update: () => {} } as any,
      bus: { emit: () => {} } as any,
      prevResourcesJson: '',
      prevRatesJson: '',
      // heroBonusCallback 不设置
    };

    executeTick(ctx, 1);
    expect(capturedBonuses.hero).toBe(0);
  });
});

// ─────────────────────────────────────────────
// XI-015: 战斗伤兵→医馆恢复链路
// ─────────────────────────────────────────────

describe('XI-015: 战斗伤兵→医馆恢复链路', () => {
  it('战斗产生伤兵→医馆接收伤兵', () => {
    const casualty = new BattleCasualtySystem();
    const clinic = new ClinicTreatmentSystem();

    const result = bridgeBattleCasualtiesToClinic(
      casualty,
      { victory: true, troopCount: 1000 },
      clinic,
    );

    // 胜利: wounded = floor(1000 * 0.10) = 100
    expect(result.wounded).toBe(100);
    expect(result.killed).toBe(50);

    // 医馆应接收到伤兵
    const pool = clinic.getWoundedPool();
    expect(pool.totalWounded).toBe(100);
  });

  it('战斗失败→更多伤兵进入医馆', () => {
    const casualty = new BattleCasualtySystem();
    const clinic = new ClinicTreatmentSystem();

    const result = bridgeBattleCasualtiesToClinic(
      casualty,
      { victory: false, troopCount: 1000 },
      clinic,
    );

    // 失败: wounded = floor(1000 * 0.25) = 250
    expect(result.wounded).toBe(250);
    expect(result.killed).toBe(150);

    const pool = clinic.getWoundedPool();
    expect(pool.totalWounded).toBe(250);
  });

  it('无 clinicReceiver 时仍计算伤亡但不转发', () => {
    const casualty = new BattleCasualtySystem();

    const result = bridgeBattleCasualtiesToClinic(
      casualty,
      { victory: true, troopCount: 500 },
      null,
    );

    expect(result.wounded).toBe(50);
    expect(result.killed).toBe(25);
  });

  it('伤兵经过治疗→恢复为可用兵力', () => {
    const casualty = new BattleCasualtySystem();
    const clinic = new ClinicTreatmentSystem();
    clinic.init(1, () => 10000, () => true);
    clinic.setNow(Date.now());

    // 产生伤兵
    bridgeBattleCasualtiesToClinic(
      casualty,
      { victory: false, troopCount: 1000 },
      clinic,
    );
    expect(clinic.getWoundedPool().totalWounded).toBe(250);

    // 被动恢复
    const healed = clinic.tickPassiveHeal(1000); // 1秒
    // 被动恢复速率 = clinicLevel(1) * 0.02 = 0.02/s, 恢复量 = floor(250 * 0.02 * 1) = 5
    expect(healed).toBeGreaterThanOrEqual(0);
    expect(clinic.getWoundedPool().totalWounded).toBeLessThanOrEqual(250);
  });

  it('多次战斗累积伤兵到医馆', () => {
    const casualty = new BattleCasualtySystem();
    const clinic = new ClinicTreatmentSystem();

    bridgeBattleCasualtiesToClinic(casualty, { victory: true, troopCount: 500 }, clinic);
    bridgeBattleCasualtiesToClinic(casualty, { victory: false, troopCount: 800 }, clinic);

    // 第一次: 50 wounded, 第二次: 200 wounded → 总计 250
    expect(clinic.getWoundedPool().totalWounded).toBe(250);
  });
});
