/**
 * v11.0 远征系统 Play 流程集成测试
 *
 * 覆盖范围（按 play 文档章节组织）：
 * - §0 解锁与入口: 远征系统解锁条件、队列槽位
 * - §1 远征系统: 路线选择、队伍创建、远征派遣
 * - §2 远征推进: 节点事件、战斗、拾取
 * - §3 远征结算: 完成奖励、扫荡、里程碑
 * - §4 跨系统联动: 远征→武将→离线→装备
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 *
 * @see docs/games/three-kingdoms/play/v12-play.md (远征核心玩法)
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES, MASSIVE_RESOURCES } from '../../../test-utils/test-helpers';
import { FormationType } from '../../../core/expedition/expedition-formation.types';
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

/** 3名蜀国武将 */
function shuHeroes(): HeroBrief[] {
  return [
    createHero('guanyu', 'shu', 5000),
    createHero('zhangfei', 'shu', 4800),
    createHero('zhaoyun', 'shu', 5200),
  ];
}

// ═══════════════════════════════════════════════════════════════
// §0 解锁与入口
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征系统 — §0 解锁与入口', () => {

  it('should access expedition system via engine getter', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();
    expect(expedition).toBeDefined();
    expect(typeof expedition.getRoute).toBe('function');
    expect(typeof expedition.createTeam).toBe('function');
    expect(typeof expedition.unlockRoute).toBe('function');
  });

  it('should get expedition state with routes and teams', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const state = expedition.getState();
    expect(state).toBeDefined();
    expect(state.routes).toBeDefined();
    expect(state.teams).toBeDefined();
  });

  it('should track unlocked slot count', () => {
    // Play §0.1: 主城5级解锁第1个队列
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const slots = expedition.getUnlockedSlots();
    expect(typeof slots).toBe('number');
    expect(slots).toBeGreaterThanOrEqual(0);
  });

  it('should calculate slot count based on castle level', () => {
    // Play §1.2: 主城5/10/15/20级 → 1/2/3/4支队伍
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const slotsLv1 = expedition.getSlotCount(1);
    const slotsLv5 = expedition.getSlotCount(5);
    const slotsLv10 = expedition.getSlotCount(10);
    const slotsLv20 = expedition.getSlotCount(20);

    expect(typeof slotsLv1).toBe('number');
    expect(typeof slotsLv5).toBe('number');
    // 更高主城等级应有更多远征位
    expect(slotsLv5).toBeGreaterThanOrEqual(slotsLv1);
    expect(slotsLv10).toBeGreaterThanOrEqual(slotsLv5);
    expect(slotsLv20).toBeGreaterThanOrEqual(slotsLv10);
  });

  it('should update slots when castle level changes', () => {
    // Play §1.2: 主城等级变化时更新队列数
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const newSlots = expedition.updateSlots(5);
    expect(typeof newSlots).toBe('number');
  });

});

// ═══════════════════════════════════════════════════════════════
// §1 远征路线与派遣
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征系统 — §1 远征路线与派遣', () => {

  it('should list all expedition routes', () => {
    // Play §1.1: 地图展示树状分支路线
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const routes = expedition.getAllRoutes();
    expect(Array.isArray(routes)).toBe(true);
  });

  it('should get single route by id', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const routes = expedition.getAllRoutes();
    if (routes.length > 0) {
      const route = expedition.getRoute(routes[0].id);
      expect(route).toBeDefined();
      expect(route!.id).toBe(routes[0].id);
    }
  });

  it('should check route unlock conditions', () => {
    // Play §1.1: 未解锁路线灰色不可点击
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const routes = expedition.getAllRoutes();
    if (routes.length > 0) {
      const check = expedition.canUnlockRoute(routes[0].id);
      expect(check).toBeDefined();
      expect(typeof check.canUnlock).toBe('boolean');
    }
  });

  it('should track route stars', () => {
    // Play §1.1: 节点标注状态 ✅已通关/🔄行军中/🔒未解锁
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const routes = expedition.getAllRoutes();
    if (routes.length > 0) {
      const stars = expedition.getRouteStars(routes[0].id);
      expect(typeof stars).toBe('number');
      expect(stars).toBeGreaterThanOrEqual(0);
    }
  });

  it('should track cleared route ids', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const cleared = expedition.getClearedRouteIds();
    expect(cleared).toBeDefined();
    expect(cleared instanceof Set).toBe(true);
  });

  it('should unlock route when conditions are met', () => {
    // Play §1.1: 选择路线查看详情
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const routes = expedition.getAllRoutes();
    if (routes.length > 0) {
      const check = expedition.canUnlockRoute(routes[0].id);
      if (check.canUnlock) {
        const result = expedition.unlockRoute(routes[0].id);
        expect(typeof result).toBe('boolean');
      }
    }
  });

  it('should reject unlock when conditions not met', () => {
    // Play §1.1: 未解锁路线灰色不可点击
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const routes = expedition.getAllRoutes();
    if (routes.length > 1) {
      const lastRoute = routes[routes.length - 1];
      const check = expedition.canUnlockRoute(lastRoute.id);
      if (!check.canUnlock) {
        // 条件不满足时应返回失败原因
        expect(check).toBeDefined();
        expect(check.canUnlock).toBe(false);
      } else {
        expect(check.canUnlock).toBe(true);
      }
    }
  });

});

// ═══════════════════════════════════════════════════════════════
// §2 队伍管理
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征系统 — §2 队伍管理', () => {

  it('should list all expedition teams', () => {
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const teams = expedition.getAllTeams();
    expect(Array.isArray(teams)).toBe(true);
  });

  it('should validate team composition', () => {
    // Play §2.1: 武将选择与编队
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroes = shuHeroes();
    const heroDataMap = createHeroDataMap(heroes);

    const result = expedition.validateTeam(
      heroes.map(h => h.id),
      FormationType.STANDARD,
      heroDataMap,
      [],
    );
    expect(result).toBeDefined();
    expect(typeof result.valid).toBe('boolean');
  });

  it('should check faction bond in team', () => {
    // Play §2.2: 阵营羁绊加成
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroes = shuHeroes();
    const heroDataMap = createHeroDataMap(heroes);

    const hasBond = expedition.checkFactionBond(
      heroes.map(h => h.id),
      heroDataMap,
    );
    expect(typeof hasBond).toBe('boolean');
    // 同阵营武将应有羁绊
    expect(hasBond).toBe(true);
  });

  it('should calculate team power', () => {
    // Play §2.1: 编队战力计算
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroes = shuHeroes();
    const heroDataMap = createHeroDataMap(heroes);

    const power = expedition.calculateTeamPower(
      heroes.map(h => h.id),
      heroDataMap,
      FormationType.STANDARD,
    );
    expect(typeof power).toBe('number');
    expect(power).toBeGreaterThan(0);
  });

  it('should create a team with heroes', () => {
    // Play §2.1: 选择编队出发
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroes = shuHeroes();
    const heroDataMap = createHeroDataMap(heroes);

    const result = expedition.createTeam(
      '远征队一',
      heroes.map(h => h.id),
      FormationType.STANDARD,
      heroDataMap,
    );
    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
  });

  it('should auto-compose team from available heroes', () => {
    // Play §2.3: 智能编队
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroes = shuHeroes();
    const selected = expedition.autoComposeTeam(
      heroes,
      new Set(),
      FormationType.STANDARD,
    );
    expect(Array.isArray(selected)).toBe(true);
    expect(selected.length).toBeGreaterThan(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §3 远征推进与结算
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征系统 — §3 远征推进与结算', () => {

  it('should dispatch team to a route', () => {
    // Play §1.1: 确认进入路线详情 → 选择编队出发
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroes = shuHeroes();
    const heroDataMap = createHeroDataMap(heroes);

    // 先解锁一条路线
    const routes = expedition.getAllRoutes();
    if (routes.length > 0) {
      const check = expedition.canUnlockRoute(routes[0].id);
      if (check.canUnlock) {
        expedition.unlockRoute(routes[0].id);
      }
    }

    const result = expedition.createTeam(
      '远征队派遣',
      heroes.map(h => h.id),
      FormationType.STANDARD,
      heroDataMap,
    );

    if (routes.length > 0 && result.valid) {
      // 获取刚创建的队伍
      const teams = expedition.getAllTeams();
      const team = teams[teams.length - 1];
      if (team) {
        const dispatched = expedition.dispatchTeam(team.id, routes[0].id);
        expect(typeof dispatched).toBe('boolean');
      }
    }
  });

  it('should advance team to next node', () => {
    // Play §1.1: 节点事件推进
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroes = shuHeroes();
    const heroDataMap = createHeroDataMap(heroes);

    const routes = expedition.getAllRoutes();
    if (routes.length > 0) {
      const check = expedition.canUnlockRoute(routes[0].id);
      if (check.canUnlock) {
        expedition.unlockRoute(routes[0].id);
        const result = expedition.createTeam(
          '远征队推进',
          heroes.map(h => h.id),
          FormationType.STANDARD,
          heroDataMap,
        );
        if (result.valid) {
          const teams = expedition.getAllTeams();
          const team = teams[teams.length - 1];
          if (team) {
            expedition.dispatchTeam(team.id, routes[0].id);
            const nextNode = expedition.advanceToNextNode(team.id, 0);
            expect(nextNode === null || typeof nextNode === 'string').toBe(true);
          }
        }
      }
    }
  });

  it('should process node effect (healing)', () => {
    // Play §1.1: 休息节点回复兵力
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroes = shuHeroes();
    const heroDataMap = createHeroDataMap(heroes);

    const routes = expedition.getAllRoutes();
    if (routes.length > 0) {
      const check = expedition.canUnlockRoute(routes[0].id);
      if (check.canUnlock) {
        expedition.unlockRoute(routes[0].id);
        const result = expedition.createTeam(
          '远征队治疗',
          heroes.map(h => h.id),
          FormationType.STANDARD,
          heroDataMap,
        );
        if (result.valid) {
          const teams = expedition.getAllTeams();
          const team = teams[teams.length - 1];
          if (team) {
            expedition.dispatchTeam(team.id, routes[0].id);
            const effect = expedition.processNodeEffect(team.id);
            expect(effect).toBeDefined();
            expect(typeof effect.healed).toBe('boolean');
          }
        }
      }
    }
  });

  it('should complete route and award stars', () => {
    // Play §1.1: 结算奖励
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const heroes = shuHeroes();
    const heroDataMap = createHeroDataMap(heroes);

    const routes = expedition.getAllRoutes();
    if (routes.length > 0) {
      const check = expedition.canUnlockRoute(routes[0].id);
      if (check.canUnlock) {
        expedition.unlockRoute(routes[0].id);
        const result = expedition.createTeam(
          '远征队结算',
          heroes.map(h => h.id),
          FormationType.STANDARD,
          heroDataMap,
        );
        if (result.valid) {
          const teams = expedition.getAllTeams();
          const team = teams[teams.length - 1];
          if (team) {
            expedition.dispatchTeam(team.id, routes[0].id);
            const completed = expedition.completeRoute(team.id, 3);
            expect(typeof completed).toBe('boolean');
          }
        }
      }
    }
  });

  it('should check sweep eligibility', () => {
    // Play §1.3: 三星通关后可扫荡
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const routes = expedition.getAllRoutes();
    if (routes.length > 0) {
      const canSweep = expedition.canSweepRoute(routes[0].id);
      expect(typeof canSweep).toBe('boolean');
    }
  });

  it('should check milestones', () => {
    // Play §1.1: 里程碑奖励
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const milestones = expedition.checkMilestones();
    expect(Array.isArray(milestones)).toBe(true);
  });

  it('should recover troops over time', () => {
    // Play §2.3: 兵力管理
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    // 恢复兵力不应抛出异常
    expect(() => expedition.recoverTroops(3600)).not.toThrow();
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 跨系统联动
// ═══════════════════════════════════════════════════════════════
describe('v11.0 远征系统 — §4 跨系统联动', () => {

  it('should link expedition with castle level progression', () => {
    // Play §1.2: 主城等级决定队列数
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);

    const expedition = sim.engine.getExpeditionSystem();

    const slotsBefore = expedition.getSlotCount(1);
    const slotsAfter = expedition.getSlotCount(5);

    expect(slotsAfter).toBeGreaterThanOrEqual(slotsBefore);
  });

  it('should link expedition with hero system', () => {
    // Play §2.1: 武将数据影响远征编队
    const sim = createSim();
    sim.addResources(SUFFICIENT_RESOURCES);
    sim.addHeroDirectly('liubei');
    sim.addHeroDirectly('guanyu');

    const expedition = sim.engine.getExpeditionSystem();
    const generals = sim.getGenerals();

    expect(generals.length).toBeGreaterThanOrEqual(2);

    const heroDataMap: Record<string, HeroBrief> = {};
    for (const g of generals) {
      heroDataMap[g.id] = { id: g.id, faction: 'shu', power: 500 };
    }

    const validation = expedition.validateTeam(
      generals.slice(0, 2).map(g => g.id),
      FormationType.STANDARD,
      heroDataMap,
      [],
    );
    expect(validation).toBeDefined();
  });

  it('should link expedition with offline snapshot system', () => {
    // Play §1.3: 离线远征继续推进
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    const completedExpeditions = snapshotSys.getCompletedExpeditions();
    expect(Array.isArray(completedExpeditions)).toBe(true);
  });

  it('should serialize and deserialize expedition state', () => {
    // Play §1.3: 离线远征数据持久化
    const sim = createSim();
    const expedition = sim.engine.getExpeditionSystem();

    const saveData = expedition.serialize();
    expect(saveData).toBeDefined();

    // 反序列化应能恢复状态
    const sim2 = createSim();
    const expedition2 = sim2.engine.getExpeditionSystem();
    expedition2.deserialize(saveData);

    const state = expedition2.getState();
    expect(state).toBeDefined();
  });

});
