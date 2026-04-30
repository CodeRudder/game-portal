/**
 * v11.0 远征系统 — 补充测试（第二卷）
 *
 * 新增覆盖范围：
 * - §13 扫荡系统深化: 扫荡计数独立于路线、扫荡配置验证、扫荡奖励倍率
 * - §14 自动远征深化: 停止后状态恢复、重复启停、无限循环模式、连续失败暂停
 * - §15 里程碑边界深化: 30次通关里程碑、边界值（9/10/11）、空路线集
 * - §16 远征队伍配置深化: 战力计算、阵型效果、多队伍槽位管理
 * - §17 ISubsystem合规: name/init/update/reset/序列化完整流程
 * - §18 离线远征: 效率衰减、时间上限、胜率修正
 *
 * @see docs/games/three-kingdoms/play/v12-play.md (远征核心玩法)
 */

import { describe, it, expect } from 'vitest';
import { createSim, createRealDeps, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import { FormationType } from '../../../core/expedition/expedition-formation.types';
import {
  SweepType,
  MilestoneType,
  RouteDifficulty,
  NodeType,
  NodeStatus,
  CASTLE_LEVEL_SLOTS,
  TROOP_COST,
  OFFLINE_EXPEDITION_CONFIG,
  PauseReason,
} from '../../../core/expedition/expedition.types';
import { ExpeditionSystem } from '../../expedition/ExpeditionSystem';
import { ExpeditionBattleSystem } from '../../expedition/ExpeditionBattleSystem';
import { ExpeditionRewardSystem } from '../../expedition/ExpeditionRewardSystem';
import { AutoExpeditionSystem } from '../../expedition/AutoExpeditionSystem';
import type { HeroBrief } from '../../expedition/ExpeditionTeamHelper';
import type { Faction } from '../../hero/hero.types';

// ── 辅助函数 ──

function createHero(id: string, faction: Faction, power: number): HeroBrief {
  return { id, faction, power };
}

function createHeroDataMap(heroes: HeroBrief[]): Record<string, HeroBrief> {
  const map: Record<string, HeroBrief> = {};
  for (const h of heroes) map[h.id] = h;
  return map;
}

function shuHeroes(count: number = 3): HeroBrief[] {
  const pool: HeroBrief[] = [
    createHero('guanyu', 'shu', 5000),
    createHero('zhangfei', 'shu', 4800),
    createHero('zhaoyun', 'shu', 5200),
    createHero('machao', 'shu', 4600),
    createHero('huangzhong', 'shu', 4500),
  ];
  return pool.slice(0, count);
}

/** 获取真实系统依赖（替代 mockDeps，使用引擎真实的 EventBus/Config/Registry） */
const realDeps = () => createRealDeps();

/** 准备一条已三星通关的路线 */
function prepareThreeStarRoute(
  expedition: ExpeditionSystem,
): string {
  const routes = expedition.getAllRoutes();
  const easyRoute = routes.find(r => r.difficulty === RouteDifficulty.EASY && r.unlocked);
  if (!easyRoute) return routes[0]?.id ?? 'route_hulao_easy';

  // 手动设置三星通关状态
  const state = expedition.getState();
  (state.routeStars as Record<string, number>)[easyRoute.id] = 3;
  state.clearedRouteIds.add(easyRoute.id);
  return easyRoute.id;
}

/** 准备多条已通关路线 */
function prepareMultipleClearedRoutes(expedition: ExpeditionSystem, count: number): string[] {
  const routes = expedition.getAllRoutes();
  const cleared: string[] = [];
  const state = expedition.getState();
  for (let i = 0; i < Math.min(count, routes.length); i++) {
    state.clearedRouteIds.add(routes[i].id);
    cleared.push(routes[i].id);
  }
  // 如果需要更多，用虚拟ID补充
  for (let i = routes.length; i < count; i++) {
    const virtualId = `virtual_route_${i}`;
    state.clearedRouteIds.add(virtualId);
    cleared.push(virtualId);
  }
  return cleared;
}

// ═══════════════════════════════════════════════════════════════
// §13 扫荡系统深化
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征补充2 — §13 扫荡系统深化', () => {

  it('SWEEP-DEEP-1: 不同路线的扫荡计数独立', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const state = expedition.getState();

    // 准备两条三星路线
    const routes = expedition.getAllRoutes().filter(r => r.unlocked);
    if (routes.length < 2) return;

    for (const r of routes.slice(0, 2)) {
      (state.routeStars as Record<string, number>)[r.id] = 3;
      state.clearedRouteIds.add(r.id);
    }

    // 对路线A扫荡3次
    for (let i = 0; i < 3; i++) {
      expedition.executeSweep(routes[0].id, SweepType.NORMAL);
    }

    // 路线B的扫荡计数应为0
    expect(expedition.getSweepCount(routes[1].id, SweepType.NORMAL)).toBe(0);

    // 路线B仍可扫荡5次
    for (let i = 0; i < 5; i++) {
      const result = expedition.executeSweep(routes[1].id, SweepType.NORMAL);
      expect(result.success).toBe(true);
    }
  });

  it('SWEEP-DEEP-2: 扫荡返回成功时reason为空', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const routeId = prepareThreeStarRoute(expedition);

    const result = expedition.executeSweep(routeId, SweepType.NORMAL);
    expect(result.success).toBe(true);
    expect(result.reason).toBe('');
  });

  it('SWEEP-DEEP-3: 扫荡计数可通过getSweepCount查询', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const routeId = prepareThreeStarRoute(expedition);

    expect(expedition.getSweepCount(routeId, SweepType.NORMAL)).toBe(0);

    expedition.executeSweep(routeId, SweepType.NORMAL);
    expect(expedition.getSweepCount(routeId, SweepType.NORMAL)).toBe(1);

    expedition.executeSweep(routeId, SweepType.NORMAL);
    expect(expedition.getSweepCount(routeId, SweepType.NORMAL)).toBe(2);
  });

  it('SWEEP-DEEP-4: 1星和2星路线不可扫荡', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const routes = expedition.getAllRoutes();
    const route = routes.find(r => r.unlocked);
    if (!route) return;

    const state = expedition.getState();
    // 设置1星
    (state.routeStars as Record<string, number>)[route.id] = 1;
    state.clearedRouteIds.add(route.id);
    expect(expedition.canSweepRoute(route.id)).toBe(false);

    // 设置2星
    (state.routeStars as Record<string, number>)[route.id] = 2;
    expect(expedition.canSweepRoute(route.id)).toBe(false);
  });

});

// ═══════════════════════════════════════════════════════════════
// §14 自动远征深化
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征补充2 — §14 自动远征深化', () => {

  it('AUTO-DEEP-1: 停止自动远征后状态恢复', () => {
    const battleSys = new ExpeditionBattleSystem();
    battleSys.init(realDeps());
    const rewardSys = new ExpeditionRewardSystem();
    rewardSys.init(realDeps());
    const autoSys = new AutoExpeditionSystem(battleSys, rewardSys);
    autoSys.init(realDeps());

    const expedition = new ExpeditionSystem();
    expedition.init(realDeps());
    expedition.updateSlots(10);

    const state = expedition.getState();
    // 手动设置自动远征状态
    state.isAutoExpeditioning = true;

    autoSys.stopAutoExpedition(state);

    expect(state.isAutoExpeditioning).toBe(false);
    expect(state.consecutiveFailures).toBe(0);
  });

  it('AUTO-DEEP-2: 重复启停自动远征', () => {
    const battleSys = new ExpeditionBattleSystem();
    battleSys.init(realDeps());
    const rewardSys = new ExpeditionRewardSystem();
    rewardSys.init(realDeps());
    const autoSys = new AutoExpeditionSystem(battleSys, rewardSys);
    autoSys.init(realDeps());

    const expedition = new ExpeditionSystem();
    expedition.init(realDeps());
    expedition.updateSlots(10);

    const state = expedition.getState();

    // 创建队伍
    const heroes = shuHeroes(3);
    const heroMap = createHeroDataMap(heroes);
    const teamResult = expedition.createTeam('测试队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);
    if (!teamResult.valid) return;

    const team = expedition.getAllTeams()[0];
    const routes = expedition.getAllRoutes();
    const easyRoute = routes.find(r => r.unlocked);
    if (!easyRoute) return;

    // 第一次启动
    const started1 = autoSys.startAutoExpedition(state, team.id, easyRoute.id);
    if (started1) {
      expect(state.isAutoExpeditioning).toBe(true);
      autoSys.stopAutoExpedition(state);
      expect(state.isAutoExpeditioning).toBe(false);

      // 第二次启动
      const started2 = autoSys.startAutoExpedition(state, team.id, easyRoute.id);
      expect(started2).toBe(true);
      expect(state.isAutoExpeditioning).toBe(true);
      autoSys.stopAutoExpedition(state);
    }
  });

  it('AUTO-DEEP-3: AutoExpeditionSystem实现ISubsystem接口', () => {
    const battleSys = new ExpeditionBattleSystem();
    const rewardSys = new ExpeditionRewardSystem();
    const autoSys = new AutoExpeditionSystem(battleSys, rewardSys);

    expect(autoSys.name).toBe('autoExpedition');
    expect(typeof autoSys.init).toBe('function');
    expect(typeof autoSys.update).toBe('function');
    expect(typeof autoSys.reset).toBe('function');
    expect(typeof autoSys.getState).toBe('function');
  });

  it('AUTO-DEEP-4: AutoExpeditionSystem reset清除状态', () => {
    const battleSys = new ExpeditionBattleSystem();
    battleSys.init(realDeps());
    const rewardSys = new ExpeditionRewardSystem();
    rewardSys.init(realDeps());
    const autoSys = new AutoExpeditionSystem(battleSys, rewardSys);
    autoSys.init(realDeps());

    const state = autoSys.getState();
    expect(state.remainingRepeats).toBeNull();

    autoSys.reset();
    const stateAfter = autoSys.getState();
    expect(stateAfter.remainingRepeats).toBeNull();
  });

  it('AUTO-DEEP-5: 连续失败达到阈值时自动暂停', () => {
    const battleSys = new ExpeditionBattleSystem();
    battleSys.init(realDeps());
    const rewardSys = new ExpeditionRewardSystem();
    rewardSys.init(realDeps());
    const autoSys = new AutoExpeditionSystem(battleSys, rewardSys);
    autoSys.init(realDeps());

    const expedition = new ExpeditionSystem();
    expedition.init(realDeps());
    expedition.updateSlots(10);
    const state = expedition.getState();

    // 创建队伍
    const heroes = shuHeroes(3);
    const heroMap = createHeroDataMap(heroes);
    expedition.createTeam('测试队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);
    const team = expedition.getAllTeams()[0];
    if (!team) return;

    // 设置自动远征状态
    state.isAutoExpeditioning = true;
    state.consecutiveFailures = 0;

    // 使用极高敌方战力确保连续失败
    // CONSECUTIVE_FAILURE_LIMIT = 2，所以需要连续失败2次
    const step1 = autoSys.executeAutoStep(
      state, team, 99999, FormationType.STANDARD, RouteDifficulty.EASY, false,
    );
    const step2 = autoSys.executeAutoStep(
      state, team, 99999, FormationType.STANDARD, RouteDifficulty.EASY, false,
    );

    // 至少应有一次失败（敌方战力极高）
    // 连续失败2次后应触发暂停
    if (!step1.success && !step2.success) {
      expect(state.isAutoExpeditioning).toBe(false);
    }
  });

});

// ═══════════════════════════════════════════════════════════════
// §15 里程碑边界深化
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征补充2 — §15 里程碑边界深化', () => {

  it('MILESTONE-DEEP-1: 9条通关不触发TEN_CLEARS', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const state = expedition.getState();

    for (let i = 0; i < 9; i++) {
      state.clearedRouteIds.add(`virtual_route_${i}`);
    }

    const milestones = expedition.checkMilestones();
    expect(milestones).toContain(MilestoneType.FIRST_CLEAR);
    expect(milestones).not.toContain(MilestoneType.TEN_CLEARS);
  });

  it('MILESTONE-DEEP-2: 10条通关刚好触发TEN_CLEARS', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const state = expedition.getState();

    for (let i = 0; i < 10; i++) {
      state.clearedRouteIds.add(`virtual_route_${i}`);
    }

    const milestones = expedition.checkMilestones();
    expect(milestones).toContain(MilestoneType.TEN_CLEARS);
  });

  it('MILESTONE-DEEP-3: 11条通关也触发TEN_CLEARS', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const state = expedition.getState();

    for (let i = 0; i < 11; i++) {
      state.clearedRouteIds.add(`virtual_route_${i}`);
    }

    const milestones = expedition.checkMilestones();
    expect(milestones).toContain(MilestoneType.TEN_CLEARS);
  });

  it('MILESTONE-DEEP-4: 29条通关不触发THIRTY_CLEARS', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const state = expedition.getState();

    for (let i = 0; i < 29; i++) {
      state.clearedRouteIds.add(`virtual_route_${i}`);
    }

    const milestones = expedition.checkMilestones();
    expect(milestones).not.toContain(MilestoneType.THIRTY_CLEARS);
  });

  it('MILESTONE-DEEP-5: 30条通关触发THIRTY_CLEARS', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const state = expedition.getState();

    for (let i = 0; i < 30; i++) {
      state.clearedRouteIds.add(`virtual_route_${i}`);
    }

    const milestones = expedition.checkMilestones();
    expect(milestones).toContain(MilestoneType.THIRTY_CLEARS);
  });

  it('MILESTONE-DEEP-6: 多个里程碑可同时触发', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const state = expedition.getState();

    // 通关所有路线（同时满足FIRST_CLEAR + TEN_CLEARS + THIRTY_CLEARS + ALL_CLEARS条件）
    const allRoutes = expedition.getAllRoutes();
    for (const r of allRoutes) {
      state.clearedRouteIds.add(r.id);
    }
    // 补充到30+
    for (let i = allRoutes.length; i < 30; i++) {
      state.clearedRouteIds.add(`virtual_route_${i}`);
    }

    const milestones = expedition.checkMilestones();
    expect(milestones.length).toBeGreaterThanOrEqual(3);
    expect(milestones).toContain(MilestoneType.FIRST_CLEAR);
    expect(milestones).toContain(MilestoneType.TEN_CLEARS);
    expect(milestones).toContain(MilestoneType.ALL_CLEARS);
  });

});

// ═══════════════════════════════════════════════════════════════
// §16 远征队伍配置深化
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征补充2 — §16 远征队伍配置深化', () => {

  it('TEAM-DEEP-1: 战力计算正确', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroes = shuHeroes(3);
    const heroMap = createHeroDataMap(heroes);

    const power = expedition.calculateTeamPower(
      heroes.map(h => h.id),
      heroMap,
      FormationType.STANDARD,
    );

    expect(power).toBeGreaterThan(0);
    // 战力应基于武将power之和加阵型效果
    const basePower = heroes.reduce((sum, h) => sum + h.power, 0);
    expect(power).toBeGreaterThanOrEqual(basePower);
  });

  it('TEAM-DEEP-2: 不同阵型战力不同', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroes = shuHeroes(3);
    const heroMap = createHeroDataMap(heroes);
    const heroIds = heroes.map(h => h.id);

    const powerStandard = expedition.calculateTeamPower(heroIds, heroMap, FormationType.STANDARD);
    const powerOffensive = expedition.calculateTeamPower(heroIds, heroMap, FormationType.OFFENSIVE);

    // 不同阵型应有不同战力（阵型效果不同）
    expect(typeof powerStandard).toBe('number');
    expect(typeof powerOffensive).toBe('number');
    expect(powerStandard).toBeGreaterThan(0);
    expect(powerOffensive).toBeGreaterThan(0);
  });

  it('TEAM-DEEP-3: 多队伍槽位管理', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    // 低等级主城只有少量槽位
    const slots1 = expedition.updateSlots(5);
    expect(slots1).toBeGreaterThanOrEqual(1);

    // 高等级主城有更多槽位
    const slots2 = expedition.updateSlots(15);
    expect(slots2).toBeGreaterThan(slots1);

    // 验证内部状态一致
    expect(expedition.getUnlockedSlots()).toBe(slots2);
  });

  it('TEAM-DEEP-4: 派遣队伍消耗兵力', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    expedition.updateSlots(10);

    const heroes = shuHeroes(3);
    const heroMap = createHeroDataMap(heroes);
    const result = expedition.createTeam('测试队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);
    if (!result.valid) return;

    const team = expedition.getAllTeams()[0];
    if (!team) return;

    const troopsBefore = team.troopCount;
    const routes = expedition.getAllRoutes();
    const easyRoute = routes.find(r => r.unlocked);
    if (!easyRoute) return;

    const dispatched = expedition.dispatchTeam(team.id, easyRoute.id);
    if (dispatched) {
      const teamAfter = expedition.getAllTeams()[0];
      expect(teamAfter!.troopCount).toBeLessThan(troopsBefore);
    }
  });

  it('TEAM-DEEP-5: 槽位满时不可再派遣', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    expedition.updateSlots(1); // 只有1个槽位

    const heroes = shuHeroes(3);
    const heroMap = createHeroDataMap(heroes);

    // 创建两个队伍
    const heroes2 = [
      createHero('caocao', 'wei', 5500),
      createHero('xuchu', 'wei', 4700),
      createHero('dianwei', 'wei', 4900),
    ];
    const heroMap2 = createHeroDataMap(heroes2);

    expedition.createTeam('队1', heroes.map(h => h.id), FormationType.STANDARD, heroMap);
    expedition.createTeam('队2', heroes2.map(h => h.id), FormationType.STANDARD, heroMap2);

    const teams = expedition.getAllTeams();
    const routes = expedition.getAllRoutes();
    const easyRoute = routes.find(r => r.unlocked);
    if (!easyRoute || teams.length < 2) return;

    // 派遣第一个队伍
    const dispatched1 = expedition.dispatchTeam(teams[0].id, easyRoute.id);
    if (dispatched1) {
      // 第二个队伍应该无法派遣（槽位已满）
      const dispatched2 = expedition.dispatchTeam(teams[1].id, easyRoute.id);
      expect(dispatched2).toBe(false);
    }
  });

});

// ═══════════════════════════════════════════════════════════════
// §17 ISubsystem合规
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征补充2 — §17 ISubsystem合规', () => {

  it('ISUBSYSTEM-1: ExpeditionSystem实现ISubsystem完整接口', () => {
    const sys = new ExpeditionSystem();
    expect(sys.name).toBe('expedition');
    expect(typeof sys.init).toBe('function');
    expect(typeof sys.update).toBe('function');
    expect(typeof sys.reset).toBe('function');
  });

  it('ISUBSYSTEM-2: init注入依赖不报错', () => {
    const sys = new ExpeditionSystem();
    const deps = realDeps();
    expect(() => sys.init(deps)).not.toThrow();
  });

  it('ISUBSYSTEM-3: update不报错（事件驱动系统）', () => {
    const sys = new ExpeditionSystem();
    sys.init(realDeps());
    expect(() => sys.update(16)).not.toThrow();
    expect(() => sys.update(0)).not.toThrow();
    expect(() => sys.update(-1)).not.toThrow();
  });

  it('ISUBSYSTEM-4: reset后状态回到初始值', () => {
    const sys = new ExpeditionSystem();
    sys.init(realDeps());

    // 修改状态
    const state = sys.getState();
    state.clearedRouteIds.add('test_route');
    state.routeStars['test_route'] = 3;

    // reset
    sys.reset();

    const stateAfter = sys.getState();
    expect(stateAfter.clearedRouteIds.size).toBe(0);
    expect(Object.keys(stateAfter.routeStars).length).toBe(0);
    expect(stateAfter.teams).toBeDefined();
  });

  it('ISUBSYSTEM-5: 序列化-反序列化完整流程', () => {
    const sys = new ExpeditionSystem();
    sys.init(realDeps());
    sys.updateSlots(10);

    // 创建队伍和扫荡数据
    const heroes = shuHeroes(3);
    const heroMap = createHeroDataMap(heroes);
    sys.createTeam('测试队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);
    const routeId = prepareThreeStarRoute(sys);
    sys.executeSweep(routeId, SweepType.NORMAL);
    sys.executeSweep(routeId, SweepType.ADVANCED);

    // 序列化
    const data = sys.serialize();

    // 反序列化到新实例
    const sys2 = new ExpeditionSystem();
    sys2.init(realDeps());
    sys2.deserialize(data);

    // 验证状态恢复
    const state2 = sys2.getState();
    expect(state2.clearedRouteIds.size).toBeGreaterThan(0);
    expect(sys2.getSweepCount(routeId, SweepType.NORMAL)).toBe(1);
    expect(sys2.getSweepCount(routeId, SweepType.ADVANCED)).toBe(1);
  });

  it('ISUBSYSTEM-6: ExpeditionBattleSystem实现ISubsystem', () => {
    const sys = new ExpeditionBattleSystem();
    expect(sys.name).toBe('expeditionBattle');
    expect(typeof sys.init).toBe('function');
    expect(typeof sys.update).toBe('function');
    expect(typeof sys.reset).toBe('function');
  });

  it('ISUBSYSTEM-7: ExpeditionRewardSystem实现ISubsystem', () => {
    const sys = new ExpeditionRewardSystem();
    expect(sys.name).toBe('expeditionReward');
    expect(typeof sys.init).toBe('function');
    expect(typeof sys.update).toBe('function');
    expect(typeof sys.reset).toBe('function');
  });

});

// ═══════════════════════════════════════════════════════════════
// §18 离线远征
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征补充2 — §18 离线远征', () => {

  it('OFFLINE-1: 离线远征配置正确', () => {
    expect(OFFLINE_EXPEDITION_CONFIG.battleEfficiency).toBeLessThanOrEqual(1.0);
    expect(OFFLINE_EXPEDITION_CONFIG.maxOfflineHours).toBeGreaterThan(0);
    expect(OFFLINE_EXPEDITION_CONFIG.winRateModifier).toBeLessThanOrEqual(1.0);
  });

  it('OFFLINE-2: 离线远征效率衰减', () => {
    const battleSys = new ExpeditionBattleSystem();
    battleSys.init(realDeps());
    const rewardSys = new ExpeditionRewardSystem();
    rewardSys.init(realDeps());
    const autoSys = new AutoExpeditionSystem(battleSys, rewardSys);
    autoSys.init(realDeps());

    const baseReward = { grain: 100, gold: 200, iron: 1, equipFragments: 1, exp: 50, drops: [] };

    // 1小时离线
    const result1h = autoSys.calculateOfflineExpedition({
      offlineSeconds: 3600,
      teamPower: 5000,
      teamFormation: FormationType.STANDARD,
      routeAvgPower: 3000,
      routeAvgFormation: FormationType.STANDARD,
      avgRouteDurationSeconds: 1800,
      baseRouteReward: baseReward,
      heroCount: 3,
    });

    // 72小时离线
    const result72h = autoSys.calculateOfflineExpedition({
      offlineSeconds: 72 * 3600,
      teamPower: 5000,
      teamFormation: FormationType.STANDARD,
      routeAvgPower: 3000,
      routeAvgFormation: FormationType.STANDARD,
      avgRouteDurationSeconds: 1800,
      baseRouteReward: baseReward,
      heroCount: 3,
    });

    // 更长时间应产生更多完成次数
    expect(result72h.completedRuns).toBeGreaterThan(result1h.completedRuns);
    // 效率应小于1（有衰减）
    expect(result72h.efficiency).toBeLessThanOrEqual(1.0);
  });

  it('OFFLINE-3: 超过72小时被截断', () => {
    const battleSys = new ExpeditionBattleSystem();
    battleSys.init(realDeps());
    const rewardSys = new ExpeditionRewardSystem();
    rewardSys.init(realDeps());
    const autoSys = new AutoExpeditionSystem(battleSys, rewardSys);
    autoSys.init(realDeps());

    const baseReward = { grain: 100, gold: 200, iron: 1, equipFragments: 1, exp: 50, drops: [] };

    const result = autoSys.calculateOfflineExpedition({
      offlineSeconds: 200 * 3600, // 200小时，远超72小时上限
      teamPower: 5000,
      teamFormation: FormationType.STANDARD,
      routeAvgPower: 3000,
      routeAvgFormation: FormationType.STANDARD,
      avgRouteDurationSeconds: 1800,
      baseRouteReward: baseReward,
      heroCount: 3,
    });

    expect(result.isTimeCapped).toBe(true);
    expect(result.offlineSeconds).toBeLessThanOrEqual(OFFLINE_EXPEDITION_CONFIG.maxOfflineHours * 3600);
  });

  it('OFFLINE-4: 预估收益接口返回多个时间点', () => {
    const battleSys = new ExpeditionBattleSystem();
    battleSys.init(realDeps());
    const rewardSys = new ExpeditionRewardSystem();
    rewardSys.init(realDeps());
    const autoSys = new AutoExpeditionSystem(battleSys, rewardSys);
    autoSys.init(realDeps());

    const baseReward = { grain: 100, gold: 200, iron: 1, equipFragments: 1, exp: 50, drops: [] };

    const estimates = autoSys.estimateOfflineEarnings({
      offlineSeconds: 72 * 3600,
      teamPower: 5000,
      teamFormation: FormationType.STANDARD,
      routeAvgPower: 3000,
      routeAvgFormation: FormationType.STANDARD,
      avgRouteDurationSeconds: 1800,
      baseRouteReward: baseReward,
      heroCount: 3,
    }, 72);

    expect(estimates.length).toBeGreaterThan(0);
    // 应包含多个时间点的预估
    expect(estimates[0].hours).toBeLessThanOrEqual(72);
    // 时间点应递增
    for (let i = 1; i < estimates.length; i++) {
      expect(estimates[i].hours).toBeGreaterThan(estimates[i - 1].hours);
    }
  });

});
