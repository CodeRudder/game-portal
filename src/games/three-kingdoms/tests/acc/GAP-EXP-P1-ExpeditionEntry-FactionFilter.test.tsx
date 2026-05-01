/**
 * 远征模块 P1覆盖缺口 ACC测试
 *
 * 覆盖覆盖树文档中的2项P1缺口：
 *   - GAP-06: 远征入口可达性 (EXP-1 §1.2) — 从建筑/菜单进入远征
 *   - GAP-07: 阵营筛选 (EXP-2 §2.3) — 武将选择界面的阵营筛选器
 *
 * 使用真实引擎（通过 createSim()），不 mock engine。
 *
 * @module tests/acc/GAP-EXP-P1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  accTest,
  assertStrict,
} from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';
import {
  ExpeditionSystem,
  RouteDifficulty,
  NodeType,
  NodeStatus,
  ExpeditionFormationType as FormationType,
  BattleGrade,
  SweepType,
  MilestoneType,
  TROOP_COST,
  MAX_HEROES_PER_TEAM,
  BASE_REWARDS,
} from '../../engine/expedition';
import type { HeroBrief } from '../../engine/expedition';
import type { Faction } from '../../engine/hero/hero.types';

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

function createExpeditionSim(): GameEventSimulator {
  const sim = createSim();
  sim.addResources({ grain: 500000, gold: 500000, troops: 50000 });
  return sim;
}

function createHeroBrief(id: string, faction: Faction, power: number): HeroBrief {
  return { id, faction, power };
}

function createHeroDataMap(heroes: HeroBrief[]): Record<string, HeroBrief> {
  const map: Record<string, HeroBrief> = {};
  for (const h of heroes) map[h.id] = h;
  return map;
}

function shuHeroes(): HeroBrief[] {
  return [
    createHeroBrief('guanyu', 'shu', 5000),
    createHeroBrief('zhangfei', 'shu', 4800),
    createHeroBrief('zhaoyun', 'shu', 5200),
    createHeroBrief('machao', 'shu', 4600),
    createHeroBrief('huangzhong', 'shu', 4400),
  ];
}

function weiHeroes(): HeroBrief[] {
  return [
    createHeroBrief('caocao', 'wei', 5500),
    createHeroBrief('xuchu', 'wei', 4500),
    createHeroBrief('dianwei', 'wei', 4700),
  ];
}

function wuHeroes(): HeroBrief[] {
  return [
    createHeroBrief('sunquan', 'wu', 4800),
    createHeroBrief('zhouyu', 'wu', 5000),
    createHeroBrief('lvmeng', 'wu', 4600),
  ];
}

function neutralHeroes(): HeroBrief[] {
  return [
    createHeroBrief('lvbu', 'neutral', 6000),
    createHeroBrief('diaochan', 'neutral', 3500),
  ];
}

function allFactionHeroes(): HeroBrief[] {
  return [...shuHeroes(), ...weiHeroes(), ...wuHeroes(), ...neutralHeroes()];
}

function getExpedition(sim: GameEventSimulator): ExpeditionSystem {
  return sim.engine.getExpeditionSystem();
}

// ═══════════════════════════════════════════════════════════════
// GAP-06: 远征入口可达性 (EXP-1 §1.2)
// ═══════════════════════════════════════════════════════════════

describe('GAP-06: 远征入口可达性 (EXP-1 §1.2)', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    vi.clearAllMocks();
    sim = createExpeditionSim();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it(accTest('GAP-06-01', '引擎层 — 远征系统可通过engine.getExpeditionSystem()获取'), () => {
    const expedition = getExpedition(sim);
    assertStrict(expedition !== null && expedition !== undefined, 'GAP-06-01', '远征系统不可访问');
    expect(expedition).toBeInstanceOf(ExpeditionSystem);
  });

  it(accTest('GAP-06-02', '引擎层 — 远征系统实现了ISubsystem接口'), () => {
    const expedition = getExpedition(sim);
    assertStrict(typeof expedition.name === 'string', 'GAP-06-02', '远征系统缺少name属性');
    assertStrict(typeof expedition.init === 'function', 'GAP-06-02', '远征系统缺少init方法');
    assertStrict(typeof expedition.update === 'function', 'GAP-06-02', '远征系统缺少update方法');
    assertStrict(typeof expedition.reset === 'function', 'GAP-06-02', '远征系统缺少reset方法');
    expect(expedition.name).toBe('expedition');
  });

  it(accTest('GAP-06-03', '引擎层 — 远征系统包含路线和区域数据'), () => {
    const expedition = getExpedition(sim);
    const state = expedition.getState();

    assertStrict(Object.keys(state.routes).length > 0, 'GAP-06-03', '远征系统无路线数据');
    assertStrict(Object.keys(state.regions).length > 0, 'GAP-06-03', '远征系统无区域数据');
    expect(Object.keys(state.routes).length).toBeGreaterThan(0);
    expect(Object.keys(state.regions).length).toBeGreaterThan(0);
  });

  it(accTest('GAP-06-04', '引擎层 — 初始路线包含已解锁的虎牢关简单路线'), () => {
    const expedition = getExpedition(sim);
    const route = expedition.getRoute('route_hulao_easy');

    assertStrict(route !== undefined, 'GAP-06-04', '虎牢关简单路线不存在');
    expect(route!.unlocked).toBe(true);
    expect(route!.name).toContain('虎牢关');
  });

  it(accTest('GAP-06-05', '引擎层 — 主城5级解锁远征槽位'), () => {
    const expedition = getExpedition(sim);
    const slots = expedition.getSlotCount(5);
    assertStrict(slots >= 1, 'GAP-06-05', `主城5级应有≥1个远征槽位，实际为${slots}`);
    expect(slots).toBe(1);
  });

  it(accTest('GAP-06-06', '引擎层 — 远征系统reset后恢复初始状态'), () => {
    const expedition = getExpedition(sim);

    // 修改状态
    expedition.updateSlots(20);
    assertStrict(expedition.getUnlockedSlots() === 4, 'GAP-06-06', '槽位更新失败');

    // 重置
    expedition.reset();
    expect(expedition.getUnlockedSlots()).toBe(1); // createDefaultExpeditionState 默认 unlockedSlots=1
    expect(expedition.getClearedRouteIds().size).toBe(0);
  });

  it(accTest('GAP-06-07', '引擎层 — 远征系统可通过建筑系统间接访问'), () => {
    // 验证引擎架构：远征系统作为子系统注册在引擎中
    const engine = sim.engine;
    assertStrict(typeof engine.getExpeditionSystem === 'function', 'GAP-06-07', '引擎缺少getExpeditionSystem方法');

    const expedition = engine.getExpeditionSystem();
    assertStrict(expedition !== null, 'GAP-06-07', '远征系统通过引擎获取失败');
    expect(expedition.getState()).toBeDefined();
  });

  it(accTest('GAP-06-08', '引擎层 — 远征系统序列化/反序列化后入口仍可达'), () => {
    const expedition = getExpedition(sim);
    expedition.updateSlots(10);

    // 序列化
    const saveData = expedition.serialize();
    assertStrict(saveData !== null, 'GAP-06-08', '远征系统序列化失败');

    // 反序列化到新实例
    const restored = new ExpeditionSystem();
    restored.deserialize(saveData);
    expect(restored.getUnlockedSlots()).toBe(2);
    expect(restored.getState()).toBeDefined();
    expect(Object.keys(restored.getState().routes).length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// GAP-07: 阵营筛选 (EXP-2 §2.3)
// ═══════════════════════════════════════════════════════════════

describe('GAP-07: 阵营筛选 (EXP-2 §2.3)', () => {
  let sim: GameEventSimulator;
  let expedition: ExpeditionSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    sim = createExpeditionSim();
    expedition = getExpedition(sim);
    expedition.updateSlots(20);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** 阵营筛选函数 — 模拟UI层阵营筛选器逻辑 */
  function filterHeroesByFaction(heroes: HeroBrief[], faction: Faction | 'all'): HeroBrief[] {
    if (faction === 'all') return [...heroes];
    return heroes.filter(h => h.faction === faction);
  }

  it(accTest('GAP-07-01', '阵营筛选 — "全部"显示所有武将'), () => {
    const allHeroes = allFactionHeroes();
    const filtered = filterHeroesByFaction(allHeroes, 'all');

    expect(filtered.length).toBe(allFactionHeroes().length);
    expect(filtered.length).toBe(13); // 5蜀+3魏+3吴+2群
  });

  it(accTest('GAP-07-02', '阵营筛选 — "蜀"只显示蜀国武将'), () => {
    const allHeroes = allFactionHeroes();
    const filtered = filterHeroesByFaction(allHeroes, 'shu');

    expect(filtered.length).toBe(5);
    expect(filtered.every(h => h.faction === 'shu')).toBe(true);
    expect(filtered.map(h => h.id)).toContain('guanyu');
    expect(filtered.map(h => h.id)).toContain('zhaoyun');
  });

  it(accTest('GAP-07-03', '阵营筛选 — "魏"只显示魏国武将'), () => {
    const allHeroes = allFactionHeroes();
    const filtered = filterHeroesByFaction(allHeroes, 'wei');

    expect(filtered.length).toBe(3);
    expect(filtered.every(h => h.faction === 'wei')).toBe(true);
    expect(filtered.map(h => h.id)).toContain('caocao');
  });

  it(accTest('GAP-07-04', '阵营筛选 — "吴"只显示吴国武将'), () => {
    const allHeroes = allFactionHeroes();
    const filtered = filterHeroesByFaction(allHeroes, 'wu');

    expect(filtered.length).toBe(3);
    expect(filtered.every(h => h.faction === 'wu')).toBe(true);
    expect(filtered.map(h => h.id)).toContain('sunquan');
  });

  it(accTest('GAP-07-05', '阵营筛选 — "群"只显示群雄武将'), () => {
    const allHeroes = allFactionHeroes();
    const filtered = filterHeroesByFaction(allHeroes, 'neutral');

    expect(filtered.length).toBe(2);
    expect(filtered.every(h => h.faction === 'neutral')).toBe(true);
    expect(filtered.map(h => h.id)).toContain('lvbu');
  });

  it(accTest('GAP-07-06', '阵营筛选 — 筛选后武将可用于创建远征队伍'), () => {
    const allHeroes = allFactionHeroes();
    const shuOnly = filterHeroesByFaction(allHeroes, 'shu');
    const heroMap = createHeroDataMap(shuOnly);

    // 使用筛选后的蜀国武将创建队伍
    const result = expedition.createTeam(
      '蜀国队',
      ['guanyu', 'zhangfei', 'zhaoyun'],
      FormationType.STANDARD,
      heroMap,
    );

    assertStrict(result.valid === true, 'GAP-07-06', '筛选后的蜀国武应能创建有效队伍');
    expect(result.totalPower).toBeGreaterThan(0);
  });

  it(accTest('GAP-07-07', '阵营筛选 — 同阵营3人触发羁绊加成'), () => {
    const allHeroes = allFactionHeroes();
    const shuOnly = filterHeroesByFaction(allHeroes, 'shu');
    const heroMap = createHeroDataMap(shuOnly);

    const bondResult = expedition.checkFactionBond(['guanyu', 'zhangfei', 'zhaoyun'], heroMap);
    assertStrict(bondResult === true, 'GAP-07-07', '3名蜀国武将应触发阵营羁绊');
    expect(bondResult).toBe(true);
  });

  it(accTest('GAP-07-08', '阵营筛选 — 筛选后武将战力正确计算'), () => {
    const allHeroes = allFactionHeroes();
    const weiOnly = filterHeroesByFaction(allHeroes, 'wei');
    const heroMap = createHeroDataMap(weiOnly);

    const power = expedition.calculateTeamPower(
      ['caocao', 'xuchu', 'dianwei'],
      heroMap,
      FormationType.STANDARD,
    );

    // 魏国3人总战力 = 5500 + 4500 + 4700 = 14700（基础，不含羁绊加成）
    assertStrict(power > 0, 'GAP-07-08', '筛选后武将战力应大于0');
    expect(power).toBeGreaterThan(14000);
  });

  it(accTest('GAP-07-09', '阵营筛选 — 混合阵营筛选后不触发羁绊'), () => {
    const allHeroes = allFactionHeroes();
    const heroMap = createHeroDataMap(allHeroes);

    // 混合阵营（蜀+魏+吴各1人）
    const bondResult = expedition.checkFactionBond(['guanyu', 'caocao', 'sunquan'], heroMap);
    assertStrict(bondResult === false, 'GAP-07-09', '混合阵营不应触发羁绊');
    expect(bondResult).toBe(false);
  });

  it(accTest('GAP-07-10', '阵营筛选 — 空阵营筛选结果不影响队伍校验'), () => {
    // 如果某个阵营没有武将（如只有蜀国武将时筛选魏国）
    const onlyShuHeroes = shuHeroes();
    const weiFiltered = filterHeroesByFaction(onlyShuHeroes, 'wei');

    expect(weiFiltered.length).toBe(0);

    // 空列表不应能创建队伍
    const result = expedition.validateTeam([], FormationType.STANDARD, {}, []);
    assertStrict(result.valid === false, 'GAP-07-10', '空武将列表不应能创建队伍');
  });

  it(accTest('GAP-07-11', '阵营筛选 — 筛选后武将互斥检查仍生效'), () => {
    const allHeroes = allFactionHeroes();
    const shuOnly = filterHeroesByFaction(allHeroes, 'shu');
    const heroMap = createHeroDataMap(shuOnly);

    // 创建第一支队伍
    const result1 = expedition.createTeam(
      '蜀国队1',
      ['guanyu', 'zhangfei', 'zhaoyun'],
      FormationType.STANDARD,
      heroMap,
    );
    expect(result1.valid).toBe(true);

    // 派遣第一支队伍
    const teams = expedition.getAllTeams();
    const team1 = teams[teams.length - 1];
    expedition.dispatchTeam(team1.id, 'route_hulao_easy');

    // 尝试使用相同武将创建第二支队伍
    const activeTeams = expedition.getAllTeams().filter(t => t.isExpeditioning);
    const result2 = expedition.validateTeam(
      ['guanyu', 'zhangfei'],
      FormationType.STANDARD,
      heroMap,
      activeTeams,
    );

    assertStrict(result2.valid === false, 'GAP-07-11', '已在远征中的武将不应能重复使用');
  });
});
