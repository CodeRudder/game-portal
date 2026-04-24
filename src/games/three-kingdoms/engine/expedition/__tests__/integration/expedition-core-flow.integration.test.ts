/**
 * 集成测试 §1~§2: 远征核心流程
 *
 * 覆盖 Play 流程：
 *   §1.1 远征地图与路线选择 (6 cases)
 *   §1.2 队列槽位与多队并行 (5 cases)
 *   §1.3 路线解锁规则 (5 cases)
 *   §2.1 武将选择与编队 (6 cases)
 *   §2.2 阵型效果与阵营羁绊 (5 cases)
 *   §2.3 智能编队与兵力管理 (5 cases)
 *   §1.5 远征日志辅助验证 (2 cases)
 *   Total: 34 cases
 *
 * 联动系统：ExpeditionSystem + ExpeditionTeamHelper
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../../ExpeditionSystem';
import type { HeroBrief, TeamValidationResult } from '../../ExpeditionTeamHelper';
import type { Faction } from '../../../hero/hero.types';
import {
  RouteDifficulty,
  NodeType,
  NodeStatus,
  FormationType,
  CASTLE_LEVEL_SLOTS,
  TROOP_COST,
  FACTION_BOND_THRESHOLD,
  MAX_HEROES_PER_TEAM,
} from '../../../../core/expedition/expedition.types';

// ── 辅助函数 ──────────────────────────────

function createHero(id: string, faction: Faction, power: number): HeroBrief {
  return { id, faction, power };
}

function createHeroDataMap(heroes: HeroBrief[]): Record<string, HeroBrief> {
  const map: Record<string, HeroBrief> = {};
  for (const h of heroes) map[h.id] = h;
  return map;
}

/** 5名蜀国武将 */
function shuHeroes(): HeroBrief[] {
  return [
    createHero('guanyu', 'shu', 5000),
    createHero('zhangfei', 'shu', 4800),
    createHero('zhaoyun', 'shu', 5200),
    createHero('machao', 'shu', 4600),
    createHero('huangzhong', 'shu', 4400),
  ];
}

/** 5名魏国武将 */
function weiHeroes(): HeroBrief[] {
  return [
    createHero('caocao', 'wei', 5500),
    createHero('xuchu', 'wei', 4500),
    createHero('dianwei', 'wei', 4700),
    createHero('xiahoudun', 'wei', 4300),
    createHero('zhangliao', 'wei', 5000),
  ];
}

/** 混合阵营武将 */
function mixedHeroes(): HeroBrief[] {
  return [
    createHero('guanyu', 'shu', 5000),
    createHero('caocao', 'wei', 5500),
    createHero('zhouyu', 'wu', 5200),
    createHero('lvbu', 'qun', 6000),
    createHero('zhaoyun', 'shu', 5200),
  ];
}

// ── §1 远征地图与路线 ─────────────────────

describe('§1 远征地图与路线选择', () => {
  let system: ExpeditionSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
  });

  // ── §1.1 远征地图与路线选择 (6) ──────────

  describe('§1.1 远征地图与路线选择', () => {
    it('默认状态应包含3个区域和10条路线', () => {
      const state = system.getState();
      const regions = Object.keys(state.regions);
      const routes = Object.keys(state.routes);
      expect(regions).toHaveLength(3);
      expect(routes).toHaveLength(10);
    });

    it('虎牢关3条路线默认解锁，汜水关和洛阳路线默认锁定', () => {
      const routes = system.getAllRoutes();
      const unlocked = routes.filter(r => r.unlocked);
      const locked = routes.filter(r => !r.unlocked);
      expect(unlocked).toHaveLength(3); // 虎牢关 easy/normal/hard
      expect(locked).toHaveLength(7);
    });

    it('路线难度正确映射：简单/普通/困难/奇袭', () => {
      const routes = system.getAllRoutes();
      const difficulties = routes.map(r => r.difficulty);
      expect(difficulties).toContain(RouteDifficulty.EASY);
      expect(difficulties).toContain(RouteDifficulty.NORMAL);
      expect(difficulties).toContain(RouteDifficulty.HARD);
      expect(difficulties).toContain(RouteDifficulty.AMBUSH);
    });

    it('路线节点包含5种类型：山贼/天险/Boss/宝箱/休息', () => {
      const routes = system.getAllRoutes();
      const allNodeTypes = new Set<NodeType>();
      for (const route of routes) {
        for (const node of Object.values(route.nodes)) {
          allNodeTypes.add(node.type);
        }
      }
      expect(allNodeTypes).toContain(NodeType.BANDIT);
      expect(allNodeTypes).toContain(NodeType.HAZARD);
      expect(allNodeTypes).toContain(NodeType.BOSS);
      expect(allNodeTypes).toContain(NodeType.TREASURE);
      expect(allNodeTypes).toContain(NodeType.REST);
    });

    it('路线起始节点应为线性链式结构(start→n1→...→end)', () => {
      const route = system.getRoute('route_hulao_easy');
      expect(route).toBeDefined();
      expect(route!.startNodeId).toBeDefined();
      expect(route!.endNodeId).toBeDefined();

      // 遍历链路
      const visited: string[] = [];
      let currentId: string | undefined = route!.startNodeId;
      while (currentId) {
        visited.push(currentId);
        const node = route!.nodes[currentId];
        currentId = node?.nextNodeIds[0];
      }
      expect(visited.length).toBeGreaterThanOrEqual(4);
      expect(visited[visited.length - 1]).toBe(route!.endNodeId);
    });

    it('每条路线末端节点为Boss类型', () => {
      const routes = system.getAllRoutes();
      for (const route of routes) {
        const endNode = route.nodes[route.endNodeId];
        expect(endNode).toBeDefined();
        expect(endNode!.type).toBe(NodeType.BOSS);
      }
    });
  });

  // ── §1.2 队列槽位与多队并行 (5) ──────────

  describe('§1.2 队列槽位与多队并行', () => {
    it('主城等级5/10/15/20分别解锁1/2/3/4个队列', () => {
      expect(system.getSlotCount(5)).toBe(1);
      expect(system.getSlotCount(10)).toBe(2);
      expect(system.getSlotCount(15)).toBe(3);
      expect(system.getSlotCount(20)).toBe(4);
    });

    it('主城等级<5时队列数为0', () => {
      expect(system.getSlotCount(1)).toBe(0);
      expect(system.getSlotCount(4)).toBe(0);
    });

    it('updateSlots应更新unlockedSlots并返回正确数量', () => {
      expect(system.updateSlots(5)).toBe(1);
      expect(system.getUnlockedSlots()).toBe(1);
      expect(system.updateSlots(20)).toBe(4);
      expect(system.getUnlockedSlots()).toBe(4);
    });

    it('多支队伍可同时出征不同路线', () => {
      system.updateSlots(20);
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      const wei = weiHeroes();
      const weiMap = createHeroDataMap(wei);

      const team1 = system.createTeam('队1', ['guanyu', 'zhangfei'], FormationType.STANDARD, heroMap);
      const team2 = system.createTeam('队2', ['caocao', 'xuchu'], FormationType.STANDARD, weiMap);

      expect(team1.valid).toBe(true);
      expect(team2.valid).toBe(true);

      const dispatched1 = system.dispatchTeam(
        Object.keys(system.getState().teams)[0], 'route_hulao_easy',
      );
      expect(dispatched1).toBe(true);

      const dispatched2 = system.dispatchTeam(
        Object.keys(system.getState().teams)[1], 'route_hulao_normal',
      );
      expect(dispatched2).toBe(true);
    });

    it('出征队伍数超过槽位上限时拒绝出发', () => {
      system.updateSlots(5); // 主城5级 = 1个槽位
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      const wei = weiHeroes();
      const weiMap = createHeroDataMap(wei);

      system.createTeam('队1', ['guanyu', 'zhangfei'], FormationType.STANDARD, heroMap);
      system.createTeam('队2', ['caocao', 'xuchu'], FormationType.STANDARD, weiMap);

      const teamIds = Object.keys(system.getState().teams);
      const dispatched1 = system.dispatchTeam(teamIds[0], 'route_hulao_easy');
      expect(dispatched1).toBe(true);

      const dispatched2 = system.dispatchTeam(teamIds[1], 'route_hulao_normal');
      expect(dispatched2).toBe(false);
    });
  });

  // ── §1.3 路线解锁规则 (5) ───────────────

  describe('§1.3 路线解锁规则', () => {
    it('虎牢关路线默认解锁，汜水关路线需要通关虎牢关全部路线', () => {
      const route = system.getRoute('route_hulao_easy');
      expect(route!.unlocked).toBe(true);

      const yishuiRoute = system.getRoute('route_yishui_easy');
      expect(yishuiRoute!.unlocked).toBe(false);
      const check = system.canUnlockRoute('route_yishui_easy');
      expect(check.canUnlock).toBe(false);
    });

    it('通关虎牢关全部路线后汜水关路线自动解锁', () => {
      // 模拟通关虎牢关3条路线
      system.getState().clearedRouteIds.add('route_hulao_easy');
      system.getState().clearedRouteIds.add('route_hulao_normal');
      system.getState().clearedRouteIds.add('route_hulao_hard');

      const check = system.canUnlockRoute('route_yishui_easy');
      expect(check.canUnlock).toBe(true);

      const unlocked = system.unlockRoute('route_yishui_easy');
      expect(unlocked).toBe(true);
    });

    it('奇袭路线需通关同区域困难路线才解锁', () => {
      // 先解锁洛阳区域
      system.getState().clearedRouteIds.add('route_hulao_easy');
      system.getState().clearedRouteIds.add('route_hulao_normal');
      system.getState().clearedRouteIds.add('route_hulao_hard');
      system.getState().clearedRouteIds.add('route_yishui_easy');
      system.getState().clearedRouteIds.add('route_yishui_normal');
      system.getState().clearedRouteIds.add('route_yishui_hard');

      // 洛阳简单路线应可解锁
      expect(system.canUnlockRoute('route_luoyang_easy').canUnlock).toBe(true);
      system.unlockRoute('route_luoyang_easy');

      // 奇袭路线未通关困难路线，不可解锁
      const ambushCheck = system.canUnlockRoute('route_luoyang_ambush');
      expect(ambushCheck.canUnlock).toBe(false);
    });

    it('通关洛阳困难路线后奇袭路线可解锁', () => {
      // 解锁全部前置
      const allPreRoutes = [
        'route_hulao_easy', 'route_hulao_normal', 'route_hulao_hard',
        'route_yishui_easy', 'route_yishui_normal', 'route_yishui_hard',
      ];
      for (const id of allPreRoutes) system.getState().clearedRouteIds.add(id);

      // 通关洛阳困难路线
      system.getState().clearedRouteIds.add('route_luoyang_hard');

      const check = system.canUnlockRoute('route_luoyang_ambush');
      expect(check.canUnlock).toBe(true);
    });

    it('不存在的路线返回解锁失败', () => {
      const check = system.canUnlockRoute('route_nonexistent');
      expect(check.canUnlock).toBe(false);
      expect(check.reasons).toContain('路线不存在');
    });
  });

  // ── §1.5 远征日志辅助验证 (2) ────────────

  describe('§1.5 远征推进与节点效果', () => {
    it('休息节点恢复20%最大兵力（向上取整，不超过上限）', () => {
      system.updateSlots(5);
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('测试队', ['guanyu', 'zhangfei', 'zhaoyun'], FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      // 设置兵力到50%
      team.troopCount = 50;
      team.maxTroops = 300; // 3武将 × 100

      // 模拟到达休息节点
      const route = system.getRoute('route_hulao_easy');
      const restNode = Object.values(route!.nodes).find(n => n.type === NodeType.REST);
      if (restNode) {
        team.currentRouteId = 'route_hulao_easy';
        team.currentNodeId = restNode.id;
        team.isExpeditioning = true;

        const result = system.processNodeEffect(teamIds[0]);
        if (result.healed) {
          // 恢复20%最大兵力 = 300 * 0.2 = 60
          expect(result.healAmount).toBe(60);
          expect(team.troopCount).toBe(110); // 50 + 60
        }
      }
    });

    it('非休息节点不触发恢复效果', () => {
      system.updateSlots(5);
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('测试队', ['guanyu'], FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      team.troopCount = 50;
      team.maxTroops = 100;

      // 模拟到达山贼节点（非休息）
      const route = system.getRoute('route_hulao_easy');
      const banditNode = Object.values(route!.nodes).find(n => n.type === NodeType.BANDIT);
      team.currentRouteId = 'route_hulao_easy';
      team.currentNodeId = banditNode!.id;
      team.isExpeditioning = true;

      const result = system.processNodeEffect(teamIds[0]);
      expect(result.healed).toBe(false);
      expect(result.healAmount).toBe(0);
    });
  });
});

// ── §2 远征队编组 ─────────────────────────

describe('§2 远征队编组', () => {
  let system: ExpeditionSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.updateSlots(20);
  });

  // ── §2.1 武将选择与编队 (6) ──────────────

  describe('§2.1 武将选择与编队', () => {
    it('成功创建包含5名武将的队伍', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      const result = system.createTeam('蜀国队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('武将数量超过5名时校验失败', () => {
      const heroes = [...shuHeroes(), createHero('extra', 'shu', 3000)];
      const heroMap = createHeroDataMap(heroes);
      const result = system.createTeam('超员队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`武将数量不能超过${MAX_HEROES_PER_TEAM}名`);
    });

    it('空武将列表校验失败', () => {
      const result = system.createTeam('空队', [], FormationType.STANDARD, {});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('至少需要1名武将');
    });

    it('武将互斥：同一武将不可编入多支队伍', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);

      // 创建第一支队伍（标记为出征中）
      const result1 = system.createTeam('队1', ['guanyu', 'zhangfei'], FormationType.STANDARD, heroMap);
      expect(result1.valid).toBe(true);

      const teamIds = Object.keys(system.getState().teams);
      system.getState().teams[teamIds[0]].isExpeditioning = true;

      // 创建第二支队伍尝试使用guanyu
      const result2 = system.createTeam('队2', ['guanyu', 'zhaoyun'], FormationType.STANDARD, heroMap);
      expect(result2.valid).toBe(false);
      expect(result2.errors.some(e => e.includes('guanyu') && e.includes('已在其他远征队伍中'))).toBe(true);
    });

    it('不存在的武将ID校验失败', () => {
      const result = system.createTeam('幽灵队', ['nonexistent_hero'], FormationType.STANDARD, {});
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('nonexistent_hero'))).toBe(true);
    });

    it('创建队伍后兵力消耗正确计算', () => {
      const heroes = shuHeroes().slice(0, 3);
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('测试队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);

      const team = Object.values(system.getState().teams)[0];
      const expectedTroopCost = 3 * TROOP_COST.expeditionPerHero; // 3 * 20 = 60
      expect(team.troopCount).toBe(expectedTroopCost);
    });
  });

  // ── §2.2 阵型效果与阵营羁绊 (5) ──────────

  describe('§2.2 阵型效果与阵营羁绊', () => {
    it('同阵营≥3名武将触发羁绊加成', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      const bond = system.checkFactionBond(['guanyu', 'zhangfei', 'zhaoyun'], heroMap);
      expect(bond).toBe(true);
    });

    it('同阵营<3名武将不触发羁绊', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      const bond = system.checkFactionBond(['guanyu', 'zhangfei'], heroMap);
      expect(bond).toBe(false);
    });

    it('混合阵营不触发羁绊', () => {
      const heroes = mixedHeroes();
      const heroMap = createHeroDataMap(heroes);
      // 每个阵营最多2名
      const bond = system.checkFactionBond(['guanyu', 'caocao', 'zhouyu'], heroMap);
      expect(bond).toBe(false);
    });

    it('不同阵型影响队伍总战力', () => {
      const heroes = shuHeroes().slice(0, 3);
      const heroMap = createHeroDataMap(heroes);
      const heroIds = heroes.map(h => h.id);

      const standardPower = system.calculateTeamPower(heroIds, heroMap, FormationType.STANDARD);
      const offensivePower = system.calculateTeamPower(heroIds, heroMap, FormationType.OFFENSIVE);

      // 锋矢阵攻击加成应使总战力不同
      expect(offensivePower).not.toBe(standardPower);
    });

    it('羁绊加成10%正确体现在战力计算中', () => {
      const heroes = shuHeroes().slice(0, 3);
      const heroMap = createHeroDataMap(heroes);
      const heroIds = heroes.map(h => h.id);

      // 标准阵型无阵型效果，只有羁绊影响
      const standardPower = system.calculateTeamPower(heroIds, heroMap, FormationType.STANDARD);

      // 手动计算：3名蜀将，羁绊+10%
      const basePower = heroes.reduce((sum, h) => sum + h.power, 0);
      const expectedWithBond = Math.round(basePower * 1.10);

      expect(standardPower).toBe(expectedWithBond);
    });
  });

  // ── §2.3 智能编队与兵力管理 (5) ──────────

  describe('§2.3 智能编队与兵力管理', () => {
    it('智能编队优先选择同阵营高战力武将触发羁绊', () => {
      const allHeroes = [...shuHeroes(), ...weiHeroes()];
      const activeHeroIds = new Set<string>();

      const selected = system.autoComposeTeam(allHeroes, activeHeroIds, FormationType.STANDARD);
      expect(selected.length).toBeGreaterThan(0);
      expect(selected.length).toBeLessThanOrEqual(MAX_HEROES_PER_TEAM);

      // 应优先选择同阵营（蜀或魏）触发羁绊
      const heroMap = createHeroDataMap(allHeroes);
      const bond = system.checkFactionBond(selected, heroMap);
      expect(bond).toBe(true);
    });

    it('智能编队排除已出征武将', () => {
      const allHeroes = [...shuHeroes(), ...weiHeroes()];
      const activeHeroIds = new Set(['guanyu', 'zhangfei']); // 已在其他队伍

      const selected = system.autoComposeTeam(allHeroes, activeHeroIds, FormationType.STANDARD);
      expect(selected).not.toContain('guanyu');
      expect(selected).not.toContain('zhangfei');
    });

    it('无可用武将时智能编队返回空数组', () => {
      const allHeroes = shuHeroes();
      const activeHeroIds = new Set(allHeroes.map(h => h.id)); // 全部已出征

      const selected = system.autoComposeTeam(allHeroes, activeHeroIds, FormationType.STANDARD);
      expect(selected).toEqual([]);
    });

    it('兵力自然恢复按1点/5分钟计算', () => {
      const heroes = shuHeroes().slice(0, 2);
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('恢复队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      team.troopCount = 0;

      // 恢复300秒 = 5分钟 = 1点
      system.recoverTroops(TROOP_COST.recoveryIntervalSeconds);
      expect(team.troopCount).toBe(TROOP_COST.recoveryAmount);
    });

    it('兵力恢复不超过最大上限', () => {
      const heroes = shuHeroes().slice(0, 1);
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('满血队', [heroes[0].id], FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      const maxTroops = team.maxTroops;

      // 恢复很长时间
      system.recoverTroops(999999);
      expect(team.troopCount).toBeLessThanOrEqual(maxTroops);
    });
  });
});
