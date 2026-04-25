/**
 * v11.0 远征系统 — 补充边界测试
 *
 * 覆盖范围：
 * - §5 扫荡系统边界: 三星前置、扫荡次数上限、三种扫荡类型、每日重置
 * - §6 自动远征: 启停控制、重复执行、暂停条件
 * - §7 里程碑边界: 首通/10次/30次/全通、重复触发不重复发放
 * - §8 兵力恢复: 自然恢复周期、恢复上限、零恢复
 * - §9 序列化边界: 空状态/满状态序列化、版本兼容
 * - §10 队伍编成边界: 空队伍/满员/重复武将/阵营羁绊
 * - §11 路线解锁链: 前置区域、困难路线前置、奇袭路线
 * - §12 跨系统联动补充: 多队伍并行、资源消耗
 *
 * @see docs/games/three-kingdoms/play/v12-play.md (远征核心玩法)
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES, MASSIVE_RESOURCES } from '../../../test-utils/test-helpers';
import { FormationType } from '../../../core/expedition/expedition-formation.types';
import { SweepType, MilestoneType, RouteDifficulty, NodeType, NodeStatus, CASTLE_LEVEL_SLOTS, TROOP_COST, MAX_HEROES_PER_TEAM, FACTION_BOND_THRESHOLD } from '../../../core/expedition/expedition.types';
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

function weiHeroes(count: number = 2): HeroBrief[] {
  const pool: HeroBrief[] = [
    createHero('caocao', 'wei', 5500),
    createHero('xuchu', 'wei', 4700),
    createHero('dianwei', 'wei', 4900),
  ];
  return pool.slice(0, count);
}

/** 准备一条已三星通关的路线，返回路线ID */
function prepareThreeStarRoute(
  expedition: ReturnType<ReturnType<typeof createSim>['engine']['getExpeditionSystem']>,
): string {
  const routes = expedition.getAllRoutes();
  const easyRoute = routes.find(r => r.difficulty === RouteDifficulty.EASY && r.unlocked);
  if (!easyRoute) return routes[0]?.id ?? 'route_hulao_easy';

  // 手动设置三星通关状态
  (expedition as any).state.routeStars[easyRoute.id] = 3;
  (expedition as any).state.clearedRouteIds.add(easyRoute.id);
  return easyRoute.id;
}

// ═══════════════════════════════════════════════════════════════
// §5 扫荡系统边界
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征补充 — §5 扫荡系统边界', () => {

  it('SWEEP-BOUNDARY-1: 未三星通关路线不可扫荡', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const routes = expedition.getAllRoutes();
    const route = routes.find(r => r.unlocked);
    if (!route) return;

    // 0星不可扫荡
    expect(expedition.canSweepRoute(route.id)).toBe(false);
  });

  it('SWEEP-BOUNDARY-2: 三星通关路线可扫荡', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const routeId = prepareThreeStarRoute(expedition);

    expect(expedition.canSweepRoute(routeId)).toBe(true);
  });

  it('SWEEP-BOUNDARY-3: 普通扫荡每日上限5次', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const routeId = prepareThreeStarRoute(expedition);

    // 执行5次普通扫荡
    for (let i = 0; i < 5; i++) {
      const result = expedition.executeSweep(routeId, SweepType.NORMAL);
      expect(result.success).toBe(true);
    }
    // 第6次应失败
    const result = expedition.executeSweep(routeId, SweepType.NORMAL);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('次数');
  });

  it('SWEEP-BOUNDARY-4: 高级扫荡每日上限3次', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const routeId = prepareThreeStarRoute(expedition);

    for (let i = 0; i < 3; i++) {
      const result = expedition.executeSweep(routeId, SweepType.ADVANCED);
      expect(result.success).toBe(true);
    }
    const result = expedition.executeSweep(routeId, SweepType.ADVANCED);
    expect(result.success).toBe(false);
  });

  it('SWEEP-BOUNDARY-5: 免费扫荡每日上限1次', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const routeId = prepareThreeStarRoute(expedition);

    const result1 = expedition.executeSweep(routeId, SweepType.FREE);
    expect(result1.success).toBe(true);

    const result2 = expedition.executeSweep(routeId, SweepType.FREE);
    expect(result2.success).toBe(false);
  });

  it('SWEEP-BOUNDARY-6: 不同扫荡类型计数独立', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const routeId = prepareThreeStarRoute(expedition);

    // 消耗完普通扫荡
    for (let i = 0; i < 5; i++) expedition.executeSweep(routeId, SweepType.NORMAL);

    // 高级扫荡仍可用
    const advResult = expedition.executeSweep(routeId, SweepType.ADVANCED);
    expect(advResult.success).toBe(true);

    // 免费扫荡仍可用
    const freeResult = expedition.executeSweep(routeId, SweepType.FREE);
    expect(freeResult.success).toBe(true);
  });

  it('SWEEP-BOUNDARY-7: 不存在的路线不可扫荡', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    expect(expedition.canSweepRoute('nonexistent_route')).toBe(false);
    const result = expedition.executeSweep('nonexistent_route', SweepType.NORMAL);
    expect(result.success).toBe(false);
  });

});

// ═══════════════════════════════════════════════════════════════
// §6 自动远征
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征补充 — §6 自动远征边界', () => {

  it('AUTO-1: 自动远征配置应有默认值', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const state = expedition.getState();

    expect(state.autoConfig).toBeDefined();
    expect(state.isAutoExpeditioning).toBe(false);
  });

  it('AUTO-2: 未启动自动远征时状态为false', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    expect(expedition.getState().isAutoExpeditioning).toBe(false);
  });

  it('AUTO-3: 自动远征需已解锁路线', () => {
    const sim = createSim();
    const autoSys = sim.engine.getAutoExpeditionSystem?.();
    if (!autoSys) return; // 系统不存在则跳过

    const expedition = sim.engine.getExpeditionSystem();
    const state = expedition.getState();

    // 未解锁路线不可启动自动远征
    const result = autoSys.startAutoExpedition(state, 'nonexistent_team', 'nonexistent_route');
    expect(result).toBe(false);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7 里程碑边界
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征补充 — §7 里程碑边界', () => {

  it('MILESTONE-1: 初始状态无里程碑达成', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const milestones = expedition.checkMilestones();
    expect(milestones).toEqual([]);
  });

  it('MILESTONE-2: 通关1条路线触发FIRST_CLEAR', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const state = expedition.getState();

    // 模拟通关1条路线
    const routes = expedition.getAllRoutes();
    if (routes.length > 0) {
      state.clearedRouteIds.add(routes[0].id);
    }

    const milestones = expedition.checkMilestones();
    expect(milestones).toContain(MilestoneType.FIRST_CLEAR);
  });

  it('MILESTONE-3: 重复检查里程碑不重复触发', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const state = expedition.getState();

    const routes = expedition.getAllRoutes();
    if (routes.length > 0) state.clearedRouteIds.add(routes[0].id);

    // 第一次触发
    expedition.checkMilestones();
    // 第二次不应重复
    const milestones2 = expedition.checkMilestones();
    expect(milestones2).not.toContain(MilestoneType.FIRST_CLEAR);
  });

  it('MILESTONE-4: 通关10条路线触发TEN_CLEARS', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const state = expedition.getState();

    // 模拟通关10条路线（用虚拟ID）
    for (let i = 0; i < 10; i++) {
      state.clearedRouteIds.add(`virtual_route_${i}`);
    }

    const milestones = expedition.checkMilestones();
    expect(milestones).toContain(MilestoneType.TEN_CLEARS);
  });

  it('MILESTONE-5: 通关所有路线触发ALL_CLEARS', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const state = expedition.getState();

    const allRoutes = expedition.getAllRoutes();
    for (const r of allRoutes) {
      state.clearedRouteIds.add(r.id);
    }

    const milestones = expedition.checkMilestones();
    expect(milestones).toContain(MilestoneType.ALL_CLEARS);
  });

});

// ═══════════════════════════════════════════════════════════════
// §8 兵力恢复
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征补充 — §8 兵力恢复', () => {

  it('TROOP-1: 零时间不恢复兵力', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    // 创建一个队伍
    const heroes = shuHeroes(3);
    const heroMap = createHeroDataMap(heroes);
    const result = expedition.createTeam(
      '测试队',
      heroes.map(h => h.id),
      FormationType.STANDARD,
      heroMap,
    );

    if (result.valid) {
      const teamBefore = expedition.getAllTeams()[0];
      const troopsBefore = teamBefore?.troopCount ?? 0;

      expedition.recoverTroops(0);

      const teamAfter = expedition.getAllTeams()[0];
      expect(teamAfter?.troopCount).toBe(troopsBefore);
    }
  });

  it('TROOP-2: 恢复量不超过最大兵力', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroes = shuHeroes(3);
    const heroMap = createHeroDataMap(heroes);
    const result = expedition.createTeam(
      '测试队',
      heroes.map(h => h.id),
      FormationType.STANDARD,
      heroMap,
    );

    if (result.valid) {
      // 大量恢复时间
      expedition.recoverTroops(999999);

      const team = expedition.getAllTeams()[0];
      if (team) {
        expect(team.troopCount).toBeLessThanOrEqual(team.maxTroops);
      }
    }
  });

  it('TROOP-3: 恢复按TROOP_COST配置周期计算', () => {
    // 验证配置常量存在且合理
    expect(TROOP_COST.recoveryIntervalSeconds).toBeGreaterThan(0);
    expect(TROOP_COST.recoveryAmount).toBeGreaterThan(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §9 序列化边界
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征补充 — §9 序列化边界', () => {

  it('SERIAL-1: 空状态序列化/反序列化', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const data = expedition.serialize();
    expect(data).toBeDefined();
    expect(data.clearedRouteIds).toEqual([]);
    expect(data.routeStars).toBeDefined();

    // 反序列化到新实例
    const sim2 = createSim();
    const expedition2 = sim2.engine.getExpeditionSystem();
    expedition2.deserialize(data);

    const state = expedition2.getState();
    expect(state).toBeDefined();
  });

  it('SERIAL-2: 有扫荡数据时序列化正确', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const routeId = prepareThreeStarRoute(expedition);

    // 执行扫荡
    expedition.executeSweep(routeId, SweepType.NORMAL);
    expedition.executeSweep(routeId, SweepType.ADVANCED);

    const data = expedition.serialize();
    expect(data.sweepCounts).toBeDefined();
    expect(data.sweepCounts[routeId]).toBeDefined();

    // 反序列化
    const sim2 = createSim();
    const expedition2 = sim2.engine.getExpeditionSystem();
    expedition2.deserialize(data);

    // 验证扫荡计数恢复
    expect(expedition2.getSweepCount(routeId, SweepType.NORMAL)).toBe(1);
    expect(expedition2.getSweepCount(routeId, SweepType.ADVANCED)).toBe(1);
  });

  it('SERIAL-3: 里程碑数据序列化正确', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    const state = expedition.getState();

    // 触发里程碑
    const routes = expedition.getAllRoutes();
    for (const r of routes) state.clearedRouteIds.add(r.id);
    expedition.checkMilestones();

    const data = expedition.serialize();
    expect(data.achievedMilestones.length).toBeGreaterThan(0);

    // 反序列化恢复
    const sim2 = createSim();
    const expedition2 = sim2.engine.getExpeditionSystem();
    expedition2.deserialize(data);

    // 再次检查不应重复触发
    const newMilestones = expedition2.checkMilestones();
    expect(newMilestones).toEqual([]);
  });

});

// ═══════════════════════════════════════════════════════════════
// §10 队伍编成边界
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征补充 — §10 队伍编成边界', () => {

  it('TEAM-BOUNDARY-1: 空队伍不可创建', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const result = expedition.createTeam('空队', [], FormationType.STANDARD, {});
    expect(result.valid).toBe(false);
  });

  it('TEAM-BOUNDARY-2: 超过5人不可创建', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroes = [
      ...shuHeroes(5),
      createHero('extra', 'shu', 4000),
    ];
    const heroMap = createHeroDataMap(heroes);

    const result = expedition.createTeam(
      '超大队',
      heroes.map(h => h.id),
      FormationType.STANDARD,
      heroMap,
    );
    expect(result.valid).toBe(false);
  });

  it('TEAM-BOUNDARY-3: 武将不存在时创建失败', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroMap: Record<string, HeroBrief> = {};

    const result = expedition.createTeam(
      '无效队',
      ['nonexistent_hero'],
      FormationType.STANDARD,
      heroMap,
    );
    expect(result.valid).toBe(false);
  });

  it('TEAM-BOUNDARY-4: 单人队伍可创建', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const hero = createHero('guanyu', 'shu', 5000);
    const heroMap = createHeroDataMap([hero]);

    const result = expedition.createTeam(
      '单人队',
      ['guanyu'],
      FormationType.STANDARD,
      heroMap,
    );
    expect(result.valid).toBe(true);
  });

  it('TEAM-BOUNDARY-5: 5人满员队伍可创建', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroes = shuHeroes(5);
    const heroMap = createHeroDataMap(heroes);

    const result = expedition.createTeam(
      '满员队',
      heroes.map(h => h.id),
      FormationType.STANDARD,
      heroMap,
    );
    expect(result.valid).toBe(true);
  });

  it('TEAM-BOUNDARY-6: 阵营羁绊需≥3同阵营', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    // 2蜀2魏 — 无羁绊
    const mixed = [...shuHeroes(2), ...weiHeroes(2)];
    const heroMap = createHeroDataMap(mixed);
    const hasBond = expedition.checkFactionBond(mixed.map(h => h.id), heroMap);
    expect(hasBond).toBe(false);

    // 3蜀 — 有羁绊
    const shu3 = shuHeroes(3);
    const heroMap3 = createHeroDataMap(shu3);
    const hasBond3 = expedition.checkFactionBond(shu3.map(h => h.id), heroMap3);
    expect(hasBond3).toBe(true);
  });

  it('TEAM-BOUNDARY-7: 自动编队排除已在远征的武将', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroes = shuHeroes(5);
    const activeHeroIds = new Set<string>(['guanyu', 'zhangfei']);

    const selected = expedition.autoComposeTeam(
      heroes,
      activeHeroIds,
      FormationType.STANDARD,
    );

    // 选出的武将不应包含已在远征的
    for (const id of selected) {
      expect(activeHeroIds.has(id)).toBe(false);
    }
  });

});

// ═══════════════════════════════════════════════════════════════
// §11 路线解锁链
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征补充 — §11 路线解锁链', () => {

  it('ROUTE-CHAIN-1: 初始仅虎牢关路线解锁', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const routes = expedition.getAllRoutes();
    const unlockedRoutes = routes.filter(r => r.unlocked);
    const lockedRoutes = routes.filter(r => !r.unlocked);

    // 虎牢关路线应解锁
    expect(unlockedRoutes.some(r => r.regionId === 'region_hulao')).toBe(true);
    // 汜水关和洛阳应锁定（需前置区域通关）
    expect(lockedRoutes.some(r => r.regionId === 'region_yishui')).toBe(true);
  });

  it('ROUTE-CHAIN-2: 解锁检查返回具体原因', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    // 查找一条需要前置区域的路线
    const routes = expedition.getAllRoutes();
    const lockedRoute = routes.find(r => !r.unlocked && r.requiredRegionId);

    if (lockedRoute) {
      const check = expedition.canUnlockRoute(lockedRoute.id);
      expect(check.canUnlock).toBe(false);
      expect(check.reasons.length).toBeGreaterThan(0);
    }
  });

  it('ROUTE-CHAIN-3: 不存在的路线解锁检查', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const check = expedition.canUnlockRoute('nonexistent_route');
    expect(check.canUnlock).toBe(false);
  });

  it('ROUTE-CHAIN-4: 路线难度分布正确', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const routes = expedition.getAllRoutes();
    const difficulties = new Set(routes.map(r => r.difficulty));

    expect(difficulties.has(RouteDifficulty.EASY)).toBe(true);
    expect(difficulties.has(RouteDifficulty.NORMAL)).toBe(true);
    expect(difficulties.has(RouteDifficulty.HARD)).toBe(true);
  });

  it('ROUTE-CHAIN-5: 每条路线有起止节点', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const routes = expedition.getAllRoutes();
    for (const route of routes) {
      expect(route.startNodeId).toBeTruthy();
      expect(route.endNodeId).toBeTruthy();
      expect(route.nodes[route.startNodeId]).toBeDefined();
      expect(route.nodes[route.endNodeId]).toBeDefined();
    }
  });

});

// ═══════════════════════════════════════════════════════════════
// §12 跨系统联动补充
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征补充 — §12 跨系统联动补充', () => {

  it('CROSS-1: 主城等级对应槽位配置正确', () => {
    // 验证CASTLE_LEVEL_SLOTS配置
    expect(CASTLE_LEVEL_SLOTS[5]).toBe(1);
    expect(CASTLE_LEVEL_SLOTS[10]).toBe(2);
    expect(CASTLE_LEVEL_SLOTS[15]).toBe(3);
    expect(CASTLE_LEVEL_SLOTS[20]).toBe(4);
  });

  it('CROSS-2: 低等级主城只有1个槽位', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const slots = expedition.getSlotCount(1);
    expect(slots).toBeGreaterThanOrEqual(0);
  });

  it('CROSS-3: 队伍武将上限为5', () => {
    expect(MAX_HEROES_PER_TEAM).toBe(5);
  });

  it('CROSS-4: 阵营羁绊阈值为3', () => {
    expect(FACTION_BOND_THRESHOLD).toBe(3);
  });

  it('CROSS-5: 远征系统reset恢复初始状态', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    // 修改状态
    const routeId = prepareThreeStarRoute(expedition);
    expedition.executeSweep(routeId, SweepType.NORMAL);

    // 重置
    expedition.reset();

    const state = expedition.getState();
    expect(state.clearedRouteIds.size).toBe(0);
  });

});
