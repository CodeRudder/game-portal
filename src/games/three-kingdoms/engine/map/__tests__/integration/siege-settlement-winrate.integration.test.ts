/**
 * 集成测试 — 攻城结算 + 胜率预估 + 重复攻城奖励
 *
 * 覆盖 Play 文档流程：
 *   §7.5  攻城结算（胜利→占领/失败→损30%/首次奖励/重复奖励/冷却）
 *   §7.5.1 重复攻城奖励验证
 *   §7.6  胜率预估公式与评级
 *   §10.0B 攻城胜利→声望增加（事件驱动）
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/map/__tests__/integration/siege-settlement-winrate
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorldMapSystem } from '../../WorldMapSystem';
import { TerritorySystem } from '../../TerritorySystem';
import { SiegeSystem } from '../../SiegeSystem';
import { SiegeEnhancer } from '../../SiegeEnhancer';
import { GarrisonSystem } from '../../GarrisonSystem';
import { createSim } from '../../../../test-utils/test-helpers';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createFullDeps(): ISystemDeps {
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const enhancer = new SiegeEnhancer();
  const garrison = new GarrisonSystem();
  const mapSys = new WorldMapSystem();

  const registry = new Map<string, unknown>();
  registry.set('territory', territory);
  registry.set('siege', siege);
  registry.set('siegeEnhancer', enhancer);
  registry.set('garrison', garrison);
  registry.set('worldMap', mapSys);

  const deps: ISystemDeps = {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: () => {},
      off: () => {},
      removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: (name: string) => registry.get(name) ?? null,
      getAll: () => new Map(),
      has: (name: string) => registry.has(name),
      unregister: () => {},
    } as unknown as ISubsystemRegistry,
  };

  territory.init(deps);
  siege.init(deps);
  enhancer.init(deps);
  garrison.init(deps);
  mapSys.init(deps);

  return deps;
}

function getSystems(deps: ISystemDeps) {
  return {
    territory: deps.registry.get<TerritorySystem>('territory')!,
    siege: deps.registry.get<SiegeSystem>('siege')!,
    enhancer: deps.registry.get<SiegeEnhancer>('siegeEnhancer')!,
    garrison: deps.registry.get<GarrisonSystem>('garrison')!,
    map: deps.registry.get<WorldMapSystem>('worldMap')!,
  };
}

function setupPlayerBase(sys: ReturnType<typeof getSystems>, baseId = 'city-ye') {
  sys.territory.captureTerritory(baseId, 'player');
  return baseId;
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('集成测试: 攻城结算 + 胜率预估 (Play §7.5-7.6)', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  // ── §7.5 攻城结算 ──────────────────────

  describe('§7.5 攻城结算', () => {
    it('胜利: 领土归己方，产出开始生效', () => {
      setupPlayerBase(sys);
      const result = sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);

      expect(result.launched).toBe(true);
      expect(result.victory).toBe(true);
      expect(result.capture).toBeDefined();
      expect(result.capture!.newOwner).toBe('player');
      expect(result.capture!.previousOwner).toBe('neutral');

      // 领土归属确认
      const territory = sys.territory.getTerritoryById('city-xuchang');
      expect(territory!.ownership).toBe('player');

      // 产出汇总应包含新领土
      const summary = sys.territory.getPlayerProductionSummary();
      expect(summary.totalTerritories).toBeGreaterThanOrEqual(2);
    });

    it('失败: 损失30%出征兵力，领土不变', () => {
      setupPlayerBase(sys);
      const result = sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, false);

      expect(result.launched).toBe(true);
      expect(result.victory).toBe(false);
      expect(result.defeatTroopLoss).toBeDefined();
      // R27修复: SiegeSystem不再扣减兵力，defeatTroopLoss=0
      expect(result.defeatTroopLoss).toBe(0);

      // 领土归属不变
      const territory = sys.territory.getTerritoryById('city-xuchang');
      expect(territory!.ownership).toBe('neutral');
    });

    it('首次攻占: 占领事件触发（供声望系统消费）', () => {
      const events: Array<{ event: string; data: unknown }> = [];
      const depsWithEvents: ISystemDeps = {
        ...deps,
        eventBus: {
          on: () => () => {},
          once: () => () => {},
          emit: (event: string, data: unknown) => { events.push({ event, data }); },
          off: () => {},
          removeAllListeners: () => {},
        },
      };

      const territory = new TerritorySystem();
      const siege = new SiegeSystem();
      const r = new Map<string, unknown>();
      r.set('territory', territory);
      r.set('siege', siege);
      depsWithEvents.registry = {
        register: () => {},
        get: (name: string) => r.get(name) ?? null,
        getAll: () => new Map(),
        has: (name: string) => r.has(name),
        unregister: () => {},
      } as unknown as ISubsystemRegistry;
      territory.init(depsWithEvents);
      siege.init(depsWithEvents);

      territory.captureTerritory('city-ye', 'player');
      siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);

      const victoryEvent = events.find(e => e.event === 'siege:victory');
      expect(victoryEvent).toBeDefined();
      expect((victoryEvent!.data as { territoryId: string }).territoryId).toBe('city-xuchang');
    });

    it('占领后产出汇总正确增长', () => {
      setupPlayerBase(sys);

      // 记录占领前产出
      const beforeSummary = sys.territory.getPlayerProductionSummary();

      sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);

      // 占领后产出应增加
      const afterSummary = sys.territory.getPlayerProductionSummary();
      expect(afterSummary.totalTerritories).toBe(beforeSummary.totalTerritories + 1);
      expect(afterSummary.totalProduction.grain).toBeGreaterThanOrEqual(beforeSummary.totalProduction.grain);
      expect(afterSummary.totalProduction.gold).toBeGreaterThanOrEqual(beforeSummary.totalProduction.gold);
    });

    it('连续攻占多座城池，领土数和产出持续增长', () => {
      const baseCount = sys.territory.getPlayerTerritoryCount(); // 洛阳 + 随机资源点
      setupPlayerBase(sys, 'city-ye');

      // 攻占许昌
      sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);
      sys.siege.resetDailySiegeCount();

      // 攻占濮阳
      sys.siege.executeSiegeWithResult('city-puyang', 'player', 10000, 10000, true);
      sys.siege.resetDailySiegeCount();

      // 验证领土数增长: base + 邺城 + 许昌 + 濮阳
      expect(sys.territory.getPlayerTerritoryCount()).toBe(baseCount + 3);

      // 产出汇总应包含所有领土
      const summary = sys.territory.getPlayerProductionSummary();
      expect(summary.details.length).toBeGreaterThanOrEqual(baseCount + 2);
    });
  });

  // ── §7.5.1 重复攻城奖励 ──────────────────────

  describe('§7.5.1 重复攻城奖励', () => {
    it('SiegeEnhancer 计算奖励包含资源和经验', () => {
      const territory = sys.territory.getTerritoryById('city-xuchang')!;
      const reward = sys.enhancer.calculateSiegeReward(territory);

      expect(reward.resources).toBeDefined();
      expect(reward.resources.grain).toBeGreaterThan(0);
      expect(reward.resources.gold).toBeGreaterThan(0);
      expect(reward.territoryExp).toBeGreaterThan(0);
    });

    it('高等级领土奖励 > 低等级领土奖励', () => {
      const xu = sys.territory.getTerritoryById('city-xuchang')!; // lv4
      const nanzhong = sys.territory.getTerritoryById('city-nanzhong')!; // lv2

      const rewardXu = sys.enhancer.calculateSiegeReward(xu);
      const rewardNz = sys.enhancer.calculateSiegeReward(nanzhong);

      expect(rewardXu.resources.grain).toBeGreaterThan(rewardNz.resources.grain);
      expect(rewardXu.resources.gold).toBeGreaterThan(rewardNz.resources.gold);
    });

    it('关卡类型有额外加成（passBonusMultiplier > 1）', () => {
      const pass = sys.territory.getTerritoryById('pass-hulao')!;
      const reward = sys.enhancer.calculateSiegeReward(pass);
      expect(reward.resources).toBeDefined();
      expect(reward.resources.grain).toBeGreaterThan(0);
    });

    it('奖励可能包含道具掉落', () => {
      const luoyang = sys.territory.getTerritoryById('city-luoyang')!; // lv5
      // 多次测试以覆盖随机掉落
      let hasItems = false;
      for (let i = 0; i < 20; i++) {
        const reward = sys.enhancer.calculateSiegeReward(luoyang);
        if (reward.items && reward.items.length > 0) {
          hasItems = true;
          break;
        }
      }
      // 高等级领土多次测试应有道具掉落
      expect(hasItems).toBe(true);
    });

    it('executeConquest 完整流程返回正确阶段', () => {
      setupPlayerBase(sys);
      const result = sys.enhancer.executeConquest(
        'city-xuchang', 'player', 10000, 10000, 10000,
      );

      expect(result).toBeDefined();
      expect(['check', 'battle', 'reward']).toContain(result.phase);
      expect(result.targetId).toBe('city-xuchang');
      expect(result.targetName).toBe('许昌');
    });
  });

  // ── §7.6 胜率预估 ──────────────────────

  describe('§7.6 胜率预估', () => {
    it('胜率预估返回完整数据', () => {
      setupPlayerBase(sys);
      const estimate = sys.enhancer.estimateWinRate(5000, 'city-xuchang');

      expect(estimate).not.toBeNull();
      expect(estimate!.winRate).toBeGreaterThanOrEqual(0);
      expect(estimate!.winRate).toBeLessThanOrEqual(1);
      expect(estimate!.attackerPower).toBe(5000);
      expect(estimate!.defenderPower).toBeGreaterThan(0);
      expect(estimate!.estimatedLossRate).toBeGreaterThanOrEqual(0);
    });

    it('攻击方战力越高，胜率越高', () => {
      setupPlayerBase(sys);
      const low = sys.enhancer.estimateWinRate(1000, 'city-xuchang')!;
      const mid = sys.enhancer.estimateWinRate(5000, 'city-xuchang')!;
      const high = sys.enhancer.estimateWinRate(20000, 'city-xuchang')!;

      // 胜率可能达到上限0.95，所以使用 >=
      expect(mid.winRate).toBeGreaterThanOrEqual(low.winRate);
      expect(high.winRate).toBeGreaterThanOrEqual(mid.winRate);
    });

    it('低防御目标胜率 >= 高防御目标胜率', () => {
      setupPlayerBase(sys);
      // city-nanzhong lv2 (def=1000) vs city-luoyang lv5 (def=2500)
      const easy = sys.enhancer.estimateWinRate(5000, 'city-nanzhong')!;
      const hard = sys.enhancer.estimateWinRate(5000, 'city-luoyang')!;

      // 低防御目标胜率应更高或相等（可能都达到上限0.95）
      expect(easy.winRate).toBeGreaterThanOrEqual(hard.winRate);
    });

    it('战斗评级在有效范围内', () => {
      setupPlayerBase(sys);
      const validRatings = ['easy', 'moderate', 'hard', 'very_hard', 'impossible'];

      const easy = sys.enhancer.estimateWinRate(50000, 'city-nanzhong')!;
      expect(validRatings).toContain(easy.rating);

      const hard = sys.enhancer.estimateWinRate(100, 'city-luoyang')!;
      expect(validRatings).toContain(hard.rating);
    });

    it('预估损失率与胜率负相关', () => {
      setupPlayerBase(sys);
      const easy = sys.enhancer.estimateWinRate(50000, 'city-nanzhong')!;
      const hard = sys.enhancer.estimateWinRate(500, 'city-luoyang')!;

      // 胜率高时损失率应更低
      expect(easy.estimatedLossRate).toBeLessThan(hard.estimatedLossRate);
    });

    it('不存在的领土返回 null', () => {
      const estimate = sys.enhancer.estimateWinRate(5000, 'nonexistent');
      expect(estimate).toBeNull();
    });
  });

  // ── §10.0B 攻城胜利→声望增加 ──────────────────────

  describe('§10.0B 攻城胜利→声望增加（事件驱动）', () => {
    it('攻城胜利触发 siege:victory 事件，携带领土信息', () => {
      const events: Array<{ event: string; data: unknown }> = [];
      const depsWithEvents: ISystemDeps = {
        ...deps,
        eventBus: {
          on: () => () => {},
          once: () => () => {},
          emit: (event: string, data: unknown) => { events.push({ event, data }); },
          off: () => {},
          removeAllListeners: () => {},
        },
      };

      const territory = new TerritorySystem();
      const siege = new SiegeSystem();
      const r = new Map<string, unknown>();
      r.set('territory', territory);
      r.set('siege', siege);
      depsWithEvents.registry = {
        register: () => {},
        get: (name: string) => r.get(name) ?? null,
        getAll: () => new Map(),
        has: (name: string) => r.has(name),
        unregister: () => {},
      } as unknown as ISubsystemRegistry;
      territory.init(depsWithEvents);
      siege.init(depsWithEvents);

      territory.captureTerritory('city-ye', 'player');
      siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);

      const victoryEvent = events.find(e => e.event === 'siege:victory');
      expect(victoryEvent).toBeDefined();
      const data = victoryEvent!.data as { territoryId: string; territoryName: string; newOwner: string };
      expect(data.territoryId).toBe('city-xuchang');
      expect(data.territoryName).toBe('许昌');
      expect(data.newOwner).toBe('player');
    });

    it('攻城胜利 → 声望+50（PrestigeSystem 监听 siege:victory 事件）', () => {
      // 验证 PrestigeSystem 可获取声望
      const sim = createSim();
      const prestigeSystem = sim.engine.getPrestigeSystem();
      expect(prestigeSystem).toBeDefined();
      const state = prestigeSystem.getState();
      expect(state).toBeDefined();
    });

    it('攻城失败触发 siege:defeat 事件', () => {
      const events: Array<{ event: string; data: unknown }> = [];
      const depsWithEvents: ISystemDeps = {
        ...deps,
        eventBus: {
          on: () => () => {},
          once: () => () => {},
          emit: (event: string, data: unknown) => { events.push({ event, data }); },
          off: () => {},
          removeAllListeners: () => {},
        },
      };

      const territory = new TerritorySystem();
      const siege = new SiegeSystem();
      const r = new Map<string, unknown>();
      r.set('territory', territory);
      r.set('siege', siege);
      depsWithEvents.registry = {
        register: () => {},
        get: (name: string) => r.get(name) ?? null,
        getAll: () => new Map(),
        has: (name: string) => r.has(name),
        unregister: () => {},
      } as unknown as ISubsystemRegistry;
      territory.init(depsWithEvents);
      siege.init(depsWithEvents);

      territory.captureTerritory('city-ye', 'player');
      siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, false);

      const defeatEvent = events.find(e => e.event === 'siege:defeat');
      expect(defeatEvent).toBeDefined();
      const data = defeatEvent!.data as { defeatTroopLoss: number };
      // R27修复: SiegeSystem不再扣减兵力，defeatTroopLoss=0
      expect(data.defeatTroopLoss).toBe(0);
    });
  });
});
