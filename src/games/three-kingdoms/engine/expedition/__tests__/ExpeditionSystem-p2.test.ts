import {
import type { HeroBrief, TeamValidationResult } from '../ExpeditionSystem';
import type { ExpeditionState, ExpeditionTeam } from '../../../core/expedition/expedition.types';
import {

      createHero('h4', 'wei', 1500),
      createHero('h5', 'wu', 1000),
    ];
    const selected = system.autoComposeTeam(heroes, new Set(), FormationType.STANDARD, 3);
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
    const selected = system.autoComposeTeam(heroes, new Set(), FormationType.STANDARD, 4);
    // 至少包含3个蜀国武将
    const shuCount = selected.filter(id => id.startsWith('shu')).length;
    expect(shuCount).toBeGreaterThanOrEqual(3);
  });

  test('autoComposeTeam 排除已出征武将', () => {
    const heroes = [createHero('h1', 'shu', 3000), createHero('h2', 'wei', 2000)];
    const selected = system.autoComposeTeam(heroes, new Set(['h1']), FormationType.STANDARD, 2);
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
    const result = system.createTeam('远征队', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);
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
    system.createTeam('test', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);
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
    system.createTeam('test', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);
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
    system.createTeam('test', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);
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
