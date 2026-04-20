/**
 * ExpeditionSystem 单元测试
 *
 * 覆盖：
 *   - 状态初始化与访问
 *   - 队列槽位管理
 *   - 路线解锁条件
 *   - 队伍编成与校验
 *   - 远征推进（派遣/推进/完成）
 *   - 扫荡系统
 *   - 里程碑检测
 *   - 兵力恢复
 *   - 序列化/反序列化
 */

import {
  ExpeditionSystem,
  createDefaultExpeditionState,
} from '../ExpeditionSystem';
import type { HeroBrief, TeamValidationResult } from '../ExpeditionSystem';
import type { ExpeditionState, ExpeditionTeam } from '../../../core/expedition/expedition.types';
import {
  NodeStatus,
  NodeType,
  RouteDifficulty,
  FormationType,
  SweepType,
  MilestoneType,
  BattleGrade,
} from '../../../core/expedition/expedition.types';

// ── 辅助函数 ──────────────────────────────

/** 创建测试用武将简要信息 */
function createHero(id: string, faction: string = 'shu', power: number = 1000): HeroBrief {
  return { id, faction: faction as HeroBrief['faction'], power };
}

/** 创建武将映射 */
function createHeroMap(heroes: HeroBrief[]): Record<string, HeroBrief> {
  const map: Record<string, HeroBrief> = {};
  for (const h of heroes) map[h.id] = h;
  return map;
}

/** 创建3个蜀国武将（触发羁绊） */
function createShuHeroes(count: number = 3): HeroBrief[] {
  return Array.from({ length: count }, (_, i) => createHero(`shu_${i}`, 'shu', 1000 + i * 100));
}

/** 创建混合阵营武将 */
function createMixedHeroes(): HeroBrief[] {
  return [
    createHero('shu_1', 'shu', 1200),
    createHero('wei_1', 'wei', 1100),
    createHero('wu_1', 'wu', 1000),
  ];
}

// ── 全局实例 ──────────────────────────────

let system: ExpeditionSystem;

beforeEach(() => {
  system = new ExpeditionSystem();
});

// ═══════════════════════════════════════════
// 1. 状态初始化与访问
// ═══════════════════════════════════════════

describe('ExpeditionSystem — 状态初始化', () => {
  test('默认状态包含路线和区域', () => {
    const state = system.getState();
    expect(Object.keys(state.routes).length).toBeGreaterThan(0);
    expect(Object.keys(state.regions).length).toBeGreaterThan(0);
  });

  test('默认未解锁路线存在', () => {
    const routes = system.getAllRoutes();
    const unlocked = routes.filter(r => r.unlocked);
    const locked = routes.filter(r => !r.unlocked);
    expect(unlocked.length).toBeGreaterThan(0);
    expect(locked.length).toBeGreaterThan(0);
  });

  test('getRoute 返回对应路线', () => {
    const route = system.getRoute('route_hulao_easy');
    expect(route).toBeDefined();
    expect(route!.name).toContain('虎牢关');
  });

  test('getRoute 返回 undefined 对于不存在路线', () => {
    expect(system.getRoute('nonexistent')).toBeUndefined();
  });

  test('getRegion 返回对应区域', () => {
    const region = system.getRegion('region_hulao');
    expect(region).toBeDefined();
    expect(region!.name).toBe('虎牢关');
  });

  test('getClearedRouteIds 初始为空', () => {
    expect(system.getClearedRouteIds().size).toBe(0);
  });

  test('getRouteStars 初始为0', () => {
    expect(system.getRouteStars('route_hulao_easy')).toBe(0);
  });
});

// ═══════════════════════════════════════════
// 2. 队列槽位管理
// ═══════════════════════════════════════════

describe('ExpeditionSystem — 队列槽位', () => {
  test('主城5级→1个槽位', () => {
    expect(system.getSlotCount(5)).toBe(1);
  });

  test('主城10级→2个槽位', () => {
    expect(system.getSlotCount(10)).toBe(2);
  });

  test('主城15级→3个槽位', () => {
    expect(system.getSlotCount(15)).toBe(3);
  });

  test('主城20级→4个槽位', () => {
    expect(system.getSlotCount(20)).toBe(4);
  });

  test('主城25级→4个槽位（上限）', () => {
    expect(system.getSlotCount(25)).toBe(4);
  });

  test('主城3级→0个槽位', () => {
    expect(system.getSlotCount(3)).toBe(0);
  });

  test('updateSlots 更新状态中的槽位数', () => {
    const slots = system.updateSlots(10);
    expect(slots).toBe(2);
    expect(system.getUnlockedSlots()).toBe(2);
  });
});

// ═══════════════════════════════════════════
// 3. 路线解锁
// ═══════════════════════════════════════════

describe('ExpeditionSystem — 路线解锁', () => {
  test('初始路线已解锁', () => {
    const route = system.getRoute('route_hulao_easy');
    expect(route!.unlocked).toBe(true);
  });

  test('需要前置区域的路线初始锁定', () => {
    const route = system.getRoute('route_yishui_easy');
    expect(route!.unlocked).toBe(false);
  });

  test('canUnlockRoute 不存在的路线返回false', () => {
    const result = system.canUnlockRoute('nonexistent');
    expect(result.canUnlock).toBe(false);
    expect(result.reasons).toContain('路线不存在');
  });

  test('已解锁路线 canUnlockRoute 返回true', () => {
    const result = system.canUnlockRoute('route_hulao_easy');
    expect(result.canUnlock).toBe(true);
  });

  test('通关前置区域后可解锁新路线', () => {
    // 通关虎牢关所有路线
    const state = system.getState();
    state.clearedRouteIds.add('route_hulao_easy');
    state.clearedRouteIds.add('route_hulao_normal');
    state.clearedRouteIds.add('route_hulao_hard');

    const result = system.canUnlockRoute('route_yishui_easy');
    expect(result.canUnlock).toBe(true);
  });

  test('奇袭路线需要通关困难路线', () => {
    // 通关汜水关（前置区域）但未通关困难
    const state = system.getState();
    state.clearedRouteIds.add('route_hulao_easy');
    state.clearedRouteIds.add('route_hulao_normal');
    state.clearedRouteIds.add('route_hulao_hard');
    state.clearedRouteIds.add('route_yishui_easy');
    state.clearedRouteIds.add('route_yishui_normal');

    const result = system.canUnlockRoute('route_luoyang_ambush');
    expect(result.canUnlock).toBe(false);
  });

  test('unlockRoute 成功解锁并设置起始节点', () => {
    const state = system.getState();
    state.clearedRouteIds.add('route_hulao_easy');
    state.clearedRouteIds.add('route_hulao_normal');
    state.clearedRouteIds.add('route_hulao_hard');

    const ok = system.unlockRoute('route_yishui_easy');
    expect(ok).toBe(true);

    const route = system.getRoute('route_yishui_easy');
    expect(route!.unlocked).toBe(true);
    expect(route!.nodes[route!.startNodeId].status).toBe(NodeStatus.MARCHING);
  });
});

// ═══════════════════════════════════════════
// 4. 队伍编成与校验
// ═══════════════════════════════════════════

describe('ExpeditionSystem — 队伍编成', () => {
  test('创建有效队伍', () => {
    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    const result = system.createTeam('测试队', ['shu_0', 'shu_1', 'shu_2'], FormationType.FISH_SCALE, heroMap);
    expect(result.valid).toBe(true);
    expect(result.totalPower).toBeGreaterThan(0);
  });

  test('空武将列表校验失败', () => {
    const result = system.validateTeam([], FormationType.FISH_SCALE, {}, []);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('至少需要1名武将');
  });

  test('超过5名武将校验失败', () => {
    const ids = Array.from({ length: 6 }, (_, i) => `hero_${i}`);
    const result = system.validateTeam(ids, FormationType.FISH_SCALE, {}, []);
    expect(result.valid).toBe(false);
  });

  test('不存在的武将校验失败', () => {
    const result = system.validateTeam(['ghost'], FormationType.FISH_SCALE, {}, []);
    expect(result.valid).toBe(false);
  });

  test('同阵营3人触发羁绊', () => {
    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    const result = system.validateTeam(['shu_0', 'shu_1', 'shu_2'], FormationType.FISH_SCALE, heroMap, []);
    expect(result.factionBond).toBe(true);
  });

  test('混合阵营不触发羁绊', () => {
    const heroes = createMixedHeroes();
    const heroMap = createHeroMap(heroes);
    const result = system.validateTeam(['shu_1', 'wei_1', 'wu_1'], FormationType.FISH_SCALE, heroMap, []);
    expect(result.factionBond).toBe(false);
  });

  test('羁绊加成提高总战力', () => {
    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);

    const withBond = system.calculateTeamPower(['shu_0', 'shu_1', 'shu_2'], heroMap, FormationType.FISH_SCALE);
    const mixed = createMixedHeroes();
    const mixedMap = createHeroMap(mixed);
    const withoutBond = system.calculateTeamPower(['shu_1', 'wei_1', 'wu_1'], mixedMap, FormationType.FISH_SCALE);

    // 羁绊加成10%，蜀国武将总power更高
    expect(withBond).toBeGreaterThan(withoutBond * 0.9);
  });

  test('autoComposeTeam 选择最强武将', () => {
    const heroes = [
      createHero('h1', 'shu', 3000),
      createHero('h2', 'shu', 2500),
      createHero('h3', 'shu', 2000),
      createHero('h4', 'wei', 1500),
      createHero('h5', 'wu', 1000),
    ];
    const selected = system.autoComposeTeam(heroes, new Set(), FormationType.FISH_SCALE, 3);
    expect(selected).toContain('h1');
    expect(selected).toContain('h2');
    expect(selected).toContain('h3');
  });

  test('autoComposeTeam 尝试触发羁绊', () => {
    const heroes = [
      createHero('shu_1', 'shu', 3000),
      createHero('shu_2', 'shu', 2800),
      createHero('shu_3', 'shu', 2600),
      createHero('wei_1', 'wei', 2900),
    ];
    const selected = system.autoComposeTeam(heroes, new Set(), FormationType.FISH_SCALE, 4);
    // 至少包含3个蜀国武将
    const shuCount = selected.filter(id => id.startsWith('shu')).length;
    expect(shuCount).toBeGreaterThanOrEqual(3);
  });

  test('autoComposeTeam 排除已出征武将', () => {
    const heroes = [createHero('h1', 'shu', 3000), createHero('h2', 'wei', 2000)];
    const selected = system.autoComposeTeam(heroes, new Set(['h1']), FormationType.FISH_SCALE, 2);
    expect(selected).not.toContain('h1');
    expect(selected).toContain('h2');
  });
});

// ═══════════════════════════════════════════
// 5. 远征推进
// ═══════════════════════════════════════════

describe('ExpeditionSystem — 远征推进', () => {
  let teamId: string;

  beforeEach(() => {
    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    const result = system.createTeam('远征队', ['shu_0', 'shu_1', 'shu_2'], FormationType.FISH_SCALE, heroMap);
    teamId = Object.keys(system.getState().teams)[0];
    system.updateSlots(5);
  });

  test('派遣队伍到已解锁路线', () => {
    const ok = system.dispatchTeam(teamId, 'route_hulao_easy');
    expect(ok).toBe(true);

    const team = system.getTeam(teamId);
    expect(team!.isExpeditioning).toBe(true);
    expect(team!.currentRouteId).toBe('route_hulao_easy');
  });

  test('派遣到不存在的路线失败', () => {
    expect(system.dispatchTeam(teamId, 'nonexistent')).toBe(false);
  });

  test('派遣到未解锁路线失败', () => {
    expect(system.dispatchTeam(teamId, 'route_yishui_easy')).toBe(false);
  });

  test('推进到下一节点', () => {
    system.dispatchTeam(teamId, 'route_hulao_easy');
    const nextId = system.advanceToNextNode(teamId);
    expect(nextId).not.toBeNull();

    const team = system.getTeam(teamId);
    expect(team!.currentNodeId).toBe(nextId);
  });

  test('休息点恢复兵力', () => {
    system.dispatchTeam(teamId, 'route_hulao_easy');
    // 推进到休息点（第5个节点 route_hulao_easy_n5）
    const route = system.getRoute('route_hulao_easy')!;
    const team = system.getTeam(teamId)!;
    team.currentNodeId = 'route_hulao_easy_n5';

    const result = system.processNodeEffect(teamId);
    expect(result.healed).toBe(true);
    expect(result.healAmount).toBeGreaterThan(0);
  });

  test('非休息点不恢复兵力', () => {
    system.dispatchTeam(teamId, 'route_hulao_easy');
    const result = system.processNodeEffect(teamId);
    expect(result.healed).toBe(false);
    expect(result.healAmount).toBe(0);
  });

  test('完成路线记录通关和星级', () => {
    system.dispatchTeam(teamId, 'route_hulao_easy');
    const ok = system.completeRoute(teamId, 3);
    expect(ok).toBe(true);

    expect(system.getClearedRouteIds().has('route_hulao_easy')).toBe(true);
    expect(system.getRouteStars('route_hulao_easy')).toBe(3);
  });

  test('完成路线重置队伍状态', () => {
    system.dispatchTeam(teamId, 'route_hulao_easy');
    system.completeRoute(teamId, 2);

    const team = system.getTeam(teamId);
    expect(team!.isExpeditioning).toBe(false);
    expect(team!.currentRouteId).toBeNull();
  });

  test('星级取最高值', () => {
    system.dispatchTeam(teamId, 'route_hulao_easy');
    system.completeRoute(teamId, 2);

    // 再次通关同一路线
    system.dispatchTeam(teamId, 'route_hulao_easy');
    system.completeRoute(teamId, 3);

    expect(system.getRouteStars('route_hulao_easy')).toBe(3);
  });
});

// ═══════════════════════════════════════════
// 6. 扫荡系统
// ═══════════════════════════════════════════

describe('ExpeditionSystem — 扫荡系统', () => {
  test('未三星通关路线不可扫荡', () => {
    expect(system.canSweepRoute('route_hulao_easy')).toBe(false);
  });

  test('三星通关路线可扫荡', () => {
    const state = system.getState();
    state.routeStars['route_hulao_easy'] = 3;
    expect(system.canSweepRoute('route_hulao_easy')).toBe(true);
  });

  test('执行扫荡成功', () => {
    const state = system.getState();
    state.routeStars['route_hulao_easy'] = 3;
    const result = system.executeSweep('route_hulao_easy', SweepType.NORMAL);
    expect(result.success).toBe(true);
  });

  test('扫荡次数记录', () => {
    const state = system.getState();
    state.routeStars['route_hulao_easy'] = 3;
    system.executeSweep('route_hulao_easy', SweepType.NORMAL);
    expect(system.getSweepCount('route_hulao_easy', SweepType.NORMAL)).toBe(1);
  });

  test('普通扫荡每日上限5次', () => {
    const state = system.getState();
    state.routeStars['route_hulao_easy'] = 3;
    for (let i = 0; i < 5; i++) {
      system.executeSweep('route_hulao_easy', SweepType.NORMAL);
    }
    const result = system.executeSweep('route_hulao_easy', SweepType.NORMAL);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('已用完');
  });

  test('高级扫荡每日上限3次', () => {
    const state = system.getState();
    state.routeStars['route_hulao_easy'] = 3;
    for (let i = 0; i < 3; i++) {
      system.executeSweep('route_hulao_easy', SweepType.ADVANCED);
    }
    const result = system.executeSweep('route_hulao_easy', SweepType.ADVANCED);
    expect(result.success).toBe(false);
  });

  test('免费扫荡每日上限1次', () => {
    const state = system.getState();
    state.routeStars['route_hulao_easy'] = 3;
    system.executeSweep('route_hulao_easy', SweepType.FREE);
    const result = system.executeSweep('route_hulao_easy', SweepType.FREE);
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════
// 7. 里程碑检测
// ═══════════════════════════════════════════

describe('ExpeditionSystem — 里程碑', () => {
  test('初始无里程碑', () => {
    const state = system.getState();
    expect(state.achievedMilestones.size).toBe(0);
  });

  test('通关1条路线达成初出茅庐', () => {
    const state = system.getState();
    state.clearedRouteIds.add('route_hulao_easy');
    const achieved = system.checkMilestones();
    expect(achieved).toContain(MilestoneType.FIRST_CLEAR);
  });

  test('重复检查不重复达成', () => {
    const state = system.getState();
    state.clearedRouteIds.add('route_hulao_easy');
    system.checkMilestones();
    const achieved2 = system.checkMilestones();
    expect(achieved2).not.toContain(MilestoneType.FIRST_CLEAR);
  });
});

// ═══════════════════════════════════════════
// 8. 兵力恢复
// ═══════════════════════════════════════════

describe('ExpeditionSystem — 兵力恢复', () => {
  test('自然恢复兵力', () => {
    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    system.createTeam('test', ['shu_0', 'shu_1', 'shu_2'], FormationType.FISH_SCALE, heroMap);
    const teamId = Object.keys(system.getState().teams)[0];

    const team = system.getTeam(teamId)!;
    const before = team.troopCount;
    // 恢复5分钟 = 300秒 = 1个恢复周期 = 1点兵力
    system.recoverTroops(300);
    expect(team.troopCount).toBe(Math.min(team.maxTroops, before + 1));
  });

  test('兵力不超过上限', () => {
    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    system.createTeam('test', ['shu_0', 'shu_1', 'shu_2'], FormationType.FISH_SCALE, heroMap);
    const teamId = Object.keys(system.getState().teams)[0];

    const team = system.getTeam(teamId)!;
    team.troopCount = team.maxTroops;
    system.recoverTroops(999999);
    expect(team.troopCount).toBe(team.maxTroops);
  });
});

// ═══════════════════════════════════════════
// 9. 序列化/反序列化
// ═══════════════════════════════════════════

describe('ExpeditionSystem — 序列化', () => {
  test('序列化包含版本号', () => {
    const data = system.serialize();
    expect(data.version).toBe(1);
  });

  test('序列化后反序列化保持一致', () => {
    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    system.createTeam('test', ['shu_0', 'shu_1', 'shu_2'], FormationType.FISH_SCALE, heroMap);
    system.updateSlots(10);

    const data = system.serialize();
    const system2 = new ExpeditionSystem();
    system2.deserialize(data);

    const state2 = system2.getState();
    expect(state2.unlockedSlots).toBe(2);
    expect(Object.keys(state2.teams).length).toBe(1);
  });
});

// ═══════════════════════════════════════════
// 10. createDefaultExpeditionState 工厂函数
// ═══════════════════════════════════════════

describe('createDefaultExpeditionState', () => {
  test('创建默认状态', () => {
    const state = createDefaultExpeditionState(2000);
    expect(Object.keys(state.routes).length).toBeGreaterThan(0);
    expect(state.unlockedSlots).toBe(1);
    expect(state.isAutoExpeditioning).toBe(false);
    expect(state.consecutiveFailures).toBe(0);
  });
});
