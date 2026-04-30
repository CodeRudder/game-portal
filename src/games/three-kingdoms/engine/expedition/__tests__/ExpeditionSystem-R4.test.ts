/**
 * 远征系统 R4 修复测试
 *
 * 覆盖三个P1修复：
 * 1. 武将远征中锁定检查
 * 2. 快速派遣（记录上次配置 + 一键重派）
 * 3. 远征进度条（完成百分比 + 当前/总节点数）
 *
 * @module engine/expedition/__tests__/ExpeditionSystem-R4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../ExpeditionSystem';
import { NodeStatus, NodeType, RouteDifficulty, FormationType } from '../../../core/expedition/expedition.types';
import type { HeroBrief } from '../ExpeditionTeamHelper';

// ─── 辅助函数 ─────────────────────────────

/** 创建测试用远征系统 */
function createSystem(): ExpeditionSystem {
  return new ExpeditionSystem();
}

/** 创建测试武将映射 */
function createHeroMap(heroes: Array<{ id: string; faction: string; power: number }>): Record<string, HeroBrief> {
  const map: Record<string, HeroBrief> = {};
  for (const h of heroes) {
    map[h.id] = { id: h.id, faction: h.faction as any, power: h.power };
  }
  return map;
}

/** 获取第一个已解锁路线 */
function getFirstUnlockedRoute(system: ExpeditionSystem) {
  const routes = system.getAllRoutes();
  const route = routes.find(r => r.unlocked);
  expect(route).toBeDefined();
  system.unlockRoute(route!.id);
  return route!;
}

/** 创建队伍并派遣 */
function createAndDispatchTeam(
  system: ExpeditionSystem,
  teamName: string,
  heroIds: string[],
  formation: FormationType = FormationType.STANDARD,
  heroPower: number = 1000,
): { teamId: string; routeId: string } {
  const heroMap = createHeroMap(heroIds.map(id => ({ id, faction: 'shu', power: heroPower })));
  system.createTeam(teamName, heroIds, formation, heroMap);

  const route = getFirstUnlockedRoute(system);
  const teamId = Object.keys(system.getState().teams)[Object.keys(system.getState().teams).length - 1];
  system.dispatchTeam(teamId, route.id);
  return { teamId, routeId: route.id };
}

// ─── 测试 ─────────────────────────────────

describe('ExpeditionSystem R4 修复', () => {
  let system: ExpeditionSystem;

  beforeEach(() => {
    system = createSystem();
  });

  // ─── P1-1: 武将远征中锁定检查 ─────────────

  describe('P1-1: 武将远征中锁定检查', () => {
    it('初始状态下无远征中武将', () => {
      const heroIds = system.getExpeditioningHeroIds();
      expect(heroIds.size).toBe(0);
    });

    it('派遣队伍后，武将应出现在远征中集合', () => {
      // 派遣前无远征中武将
      expect(system.getExpeditioningHeroIds().size).toBe(0);

      createAndDispatchTeam(system, '测试队', ['hero1', 'hero2']);

      // 派遣后武将在远征中
      const expHeroIds = system.getExpeditioningHeroIds();
      expect(expHeroIds.has('hero1')).toBe(true);
      expect(expHeroIds.has('hero2')).toBe(true);
      expect(expHeroIds.size).toBe(2);
    });

    it('isHeroExpeditioning 应正确检查单个武将', () => {
      const { teamId } = createAndDispatchTeam(system, '远征队', ['heroA', 'heroB']);

      expect(system.isHeroExpeditioning('heroA')).toBe(true);
      expect(system.isHeroExpeditioning('heroB')).toBe(true);
      expect(system.isHeroExpeditioning('heroC')).toBe(false); // 不存在的武将
    });

    it('完成路线后，武将应从远征中集合移除', () => {
      const { teamId } = createAndDispatchTeam(system, '测试队', ['hero1']);

      expect(system.isHeroExpeditioning('hero1')).toBe(true);

      // 完成路线
      system.completeRoute(teamId, 3);

      expect(system.isHeroExpeditioning('hero1')).toBe(false);
      expect(system.getExpeditioningHeroIds().size).toBe(0);
    });

    it('多支队伍远征时，应合并所有远征中武将', () => {
      system.updateSlots(10); // 解锁2个槽位

      const heroMap1 = createHeroMap([
        { id: 'h1', faction: 'shu', power: 1000 },
        { id: 'h2', faction: 'shu', power: 800 },
      ]);
      const heroMap2 = createHeroMap([
        { id: 'h3', faction: 'wei', power: 1200 },
        { id: 'h4', faction: 'wei', power: 700 },
      ]);

      system.createTeam('队伍1', ['h1', 'h2'], FormationType.STANDARD, heroMap1);
      system.createTeam('队伍2', ['h3', 'h4'], FormationType.OFFENSIVE, heroMap2);

      const routes = system.getAllRoutes();
      const unlockedRoutes = routes.filter(r => r.unlocked);
      for (const r of unlockedRoutes) {
        system.unlockRoute(r.id);
      }

      const teamIds = Object.keys(system.getState().teams);
      const dispatch1 = system.dispatchTeam(teamIds[0], unlockedRoutes[0]!.id);
      expect(dispatch1).toBe(true);

      // 第二个队伍使用相同路线（如果只有一条解锁路线也可以）
      const secondRoute = unlockedRoutes[1] ?? unlockedRoutes[0]!;
      const dispatch2 = system.dispatchTeam(teamIds[1], secondRoute.id);
      expect(dispatch2).toBe(true);

      const expHeroIds = system.getExpeditioningHeroIds();
      expect(expHeroIds.has('h1')).toBe(true);
      expect(expHeroIds.has('h2')).toBe(true);
      expect(expHeroIds.has('h3')).toBe(true);
      expect(expHeroIds.has('h4')).toBe(true);
      expect(expHeroIds.size).toBe(4);
    });
  });

  // ─── P1-2: 快速派遣 ─────────────────────

  describe('P1-2: 快速派遣', () => {
    it('初始状态下无上次派遣配置', () => {
      expect(system.getLastDispatchConfig()).toBeNull();
    });

    it('派遣队伍后应记录上次派遣配置', () => {
      const { teamId, routeId } = createAndDispatchTeam(system, '测试队', ['hero1']);

      const config = system.getLastDispatchConfig();
      expect(config).not.toBeNull();
      expect(config!.routeId).toBe(routeId);
      expect(config!.heroIds).toEqual(['hero1']);
      expect(config!.formation).toBe(FormationType.STANDARD);
      expect(config!.timestamp).toBeGreaterThan(0);
    });

    it('快速重派应在无上次配置时失败', () => {
      expect(system.quickRedeploy()).toBe(false);
    });

    it('快速重派应使用上次配置重新派遣', () => {
      const { teamId, routeId } = createAndDispatchTeam(system, '测试队', ['hero1']);

      // 完成路线，释放队伍
      system.completeRoute(teamId, 3);

      // 快速重派
      const result = system.quickRedeploy();
      expect(result).toBe(true);

      // 验证队伍重新远征中
      const team = system.getTeam(teamId);
      expect(team?.isExpeditioning).toBe(true);
      expect(team?.currentRouteId).toBe(routeId);
    });

    it('快速重派在无空闲队伍时应失败', () => {
      createAndDispatchTeam(system, '测试队', ['hero1']);

      // 队伍正在远征中，快速重派应失败
      expect(system.quickRedeploy()).toBe(false);
    });

    it('上次配置应包含正确的武将列表副本', () => {
      createAndDispatchTeam(system, '测试队', ['hero1', 'hero2'], FormationType.OFFENSIVE);

      const config = system.getLastDispatchConfig();
      expect(config!.heroIds).toEqual(['hero1', 'hero2']);

      // 确保是副本而非引用
      config!.heroIds.push('hero3');
      expect(system.getLastDispatchConfig()!.heroIds).toEqual(['hero1', 'hero2']);
    });
  });

  // ─── P1-3: 远征进度条 ─────────────────────

  describe('P1-3: 远征进度条', () => {
    it('未选择路线时进度应为0', () => {
      const progress = system.getRouteNodeProgress('nonexistent');
      expect(progress.current).toBe(0);
      expect(progress.total).toBe(0);
      expect(progress.percentage).toBe(0);
    });

    it('初始路线节点全部未清除', () => {
      const routes = system.getAllRoutes();
      const firstRoute = routes.find(r => r.unlocked);
      expect(firstRoute).toBeDefined();

      const progress = system.getRouteNodeProgress(firstRoute!.id);
      expect(progress.total).toBeGreaterThan(0);
      expect(progress.current).toBe(0);
      expect(progress.percentage).toBe(0);
    });

    it('推进节点后进度应更新', () => {
      const { teamId, routeId } = createAndDispatchTeam(system, '测试队', ['hero1'], FormationType.STANDARD, 2000);

      // 推进一个节点
      system.advanceToNextNode(teamId, 0);

      const progress = system.getRouteNodeProgress(routeId);
      expect(progress.current).toBe(1);
      expect(progress.total).toBeGreaterThan(1);
      expect(progress.percentage).toBeGreaterThan(0);
    });

    it('完全推进后进度应为100%', () => {
      const { teamId, routeId } = createAndDispatchTeam(system, '测试队', ['hero1'], FormationType.STANDARD, 5000);

      // 持续推进直到终点
      let nodeId: string | null = 'start';
      let maxIterations = 20; // 防止无限循环
      while (nodeId && maxIterations-- > 0) {
        nodeId = system.advanceToNextNode(teamId, 0);
      }

      // 完成路线（清除最后一个节点）
      system.completeRoute(teamId, 3);

      const progress = system.getRouteNodeProgress(routeId);
      expect(progress.percentage).toBe(100);
      expect(progress.current).toBe(progress.total);
    });

    it('getTeamNodeProgress 应返回队伍当前路线的进度', () => {
      const { teamId, routeId } = createAndDispatchTeam(system, '测试队', ['hero1'], FormationType.STANDARD, 2000);

      // 未推进时
      const progressBefore = system.getTeamNodeProgress(teamId);
      expect(progressBefore.routeName).toBeTruthy();
      expect(progressBefore.current).toBe(0);

      // 推进一个节点
      system.advanceToNextNode(teamId, 0);

      const progressAfter = system.getTeamNodeProgress(teamId);
      expect(progressAfter.current).toBe(1);
      expect(progressAfter.percentage).toBeGreaterThan(0);
    });

    it('空闲队伍的节点进度应为空', () => {
      const heroMap = createHeroMap([{ id: 'hero1', faction: 'shu', power: 1000 }]);
      system.createTeam('空闲队', ['hero1'], FormationType.STANDARD, heroMap);

      const teamId = Object.keys(system.getState().teams)[0];
      const progress = system.getTeamNodeProgress(teamId);
      expect(progress.current).toBe(0);
      expect(progress.total).toBe(0);
      expect(progress.percentage).toBe(0);
      expect(progress.routeName).toBe('');
    });
  });

  // ─── 序列化/反序列化 ─────────────────────

  describe('序列化/反序列化', () => {
    it('lastDispatchConfig 应正确序列化和反序列化', () => {
      const { teamId, routeId } = createAndDispatchTeam(system, '测试队', ['hero1']);

      // 序列化
      const data = system.serialize();
      expect(data.lastDispatchConfig).not.toBeNull();
      expect(data.lastDispatchConfig!.routeId).toBe(routeId);

      // 反序列化到新系统
      const newSystem = createSystem();
      newSystem.deserialize(data);

      const config = newSystem.getLastDispatchConfig();
      expect(config).not.toBeNull();
      expect(config!.routeId).toBe(routeId);
      expect(config!.heroIds).toEqual(['hero1']);
    });

    it('null lastDispatchConfig 应正确处理', () => {
      const data = system.serialize();
      expect(data.lastDispatchConfig).toBeNull();

      const newSystem = createSystem();
      newSystem.deserialize(data);
      expect(newSystem.getLastDispatchConfig()).toBeNull();
    });
  });
});
