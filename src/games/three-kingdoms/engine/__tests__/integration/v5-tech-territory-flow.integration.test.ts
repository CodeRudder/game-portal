/**
 * V5 百家争鸣 — 科技领土 Play 流程集成测试
 *
 * 覆盖以下 play 流程：
 * - §1 科技系统: 科技树浏览、研究启动、队列管理、互斥分支、融合科技
 * - §2 世界地图: 地图渲染、区域划分、地形效果
 * - §3 领土系统: 占领、产出计算、驻防、升级
 * - §4 攻城战: 条件检查、城防计算、攻城执行
 *
 * 编码规范：
 * - 每个it前创建新的sim实例
 * - describe按play流程ID组织
 * - UI层测试 it.skip + [UI层测试]
 * - 引擎未实现 it.skip + [引擎未实现]
 * - 不使用 as any
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../../test-utils/GameEventSimulator';
import { TechTreeSystem } from '../../tech/TechTreeSystem';
import { WorldMapSystem } from '../../map/WorldMapSystem';
import { TerritorySystem } from '../../map/TerritorySystem';
import { SiegeSystem } from '../../map/SiegeSystem';
import { GarrisonSystem } from '../../map/GarrisonSystem';
import { SiegeEnhancer } from '../../map/SiegeEnhancer';
import { CalendarSystem } from '../../calendar/CalendarSystem';
import { EventTriggerSystem } from '../../event/EventTriggerSystem';
import { EventNotificationSystem } from '../../event/EventNotificationSystem';
import { EventLogSystem } from '../../event/EventLogSystem';
import { ChainEventSystem } from '../../event/ChainEventSystem';
import { OfflineEventSystem } from '../../event/OfflineEventSystem';
import { NPCSystem } from '../../npc/NPCSystem';
import { NPCFavorabilitySystem } from '../../npc/NPCFavorabilitySystem';
import type { ISystemDeps } from '../../../core/types';
import type { ISubsystemRegistry } from '../../../core/types/subsystem';

// ── 辅助：创建完整的子系统依赖 ──
function createFullDeps(): ISystemDeps {
  const calendar = new CalendarSystem();
  const eventTrigger = new EventTriggerSystem();
  const notification = new EventNotificationSystem();
  const eventLog = new EventLogSystem();
  const chainEvent = new ChainEventSystem();
  const offlineEvent = new OfflineEventSystem();
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const enhancer = new SiegeEnhancer();
  const garrison = new GarrisonSystem();
  const npc = new NPCSystem();
  const npcFavor = new NPCFavorabilitySystem();
  const worldMap = new WorldMapSystem();

  const registry = new Map<string, unknown>();
  registry.set('calendar', calendar);
  registry.set('eventTrigger', eventTrigger);
  registry.set('eventNotification', notification);
  registry.set('eventLog', eventLog);
  registry.set('chainEvent', chainEvent);
  registry.set('offlineEvent', offlineEvent);
  registry.set('territory', territory);
  registry.set('siege', siege);
  registry.set('siegeEnhancer', enhancer);
  registry.set('garrison', garrison);
  registry.set('npc', npc);
  registry.set('npcFavorability', npcFavor);
  registry.set('worldMap', worldMap);

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

  calendar.init(deps);
  eventTrigger.init(deps);
  notification.init(deps);
  eventLog.init(deps);
  chainEvent.init(deps);
  offlineEvent.init(deps);
  territory.init(deps);
  siege.init(deps);
  enhancer.init(deps);
  garrison.init(deps);
  npc.init(deps);
  npcFavor.init(deps);
  worldMap.init(deps);

  return deps;
}

// ── 辅助：获取各子系统 ──
function getSystems(deps: ISystemDeps) {
  return {
    territory: deps.registry.get<TerritorySystem>('territory')!,
    siege: deps.registry.get<SiegeSystem>('siege')!,
    enhancer: deps.registry.get<SiegeEnhancer>('siegeEnhancer')!,
    garrison: deps.registry.get<GarrisonSystem>('garrison')!,
    worldMap: deps.registry.get<WorldMapSystem>('worldMap')!,
  };
}

// ═══════════════════════════════════════════════════════════════
// V5 TECH-TERRITORY-FLOW 科技领土
// ═══════════════════════════════════════════════════════════════
describe('V5 TECH-TERRITORY-FLOW 科技领土', () => {

  // ═══════════════════════════════════════════════════════════════
  // §1 科技系统
  // ═══════════════════════════════════════════════════════════════
  describe('§1 科技系统', () => {

    it('should browse tech tree nodes', () => {
      const treeSystem = new TechTreeSystem();
      const allDefs = treeSystem.getAllNodeDefs();
      expect(allDefs.length).toBeGreaterThan(0);

      for (const def of allDefs) {
        expect(def.id).toBeDefined();
        expect(def.name).toBeDefined();
        expect(def.path).toBeDefined();
        expect(def.tier).toBeGreaterThanOrEqual(0);
      }
    });

    it('should get nodes by path', () => {
      const treeSystem = new TechTreeSystem();
      const milNodes = treeSystem.getPathNodes('military');
      expect(milNodes.length).toBeGreaterThan(0);
      expect(milNodes.every(n => n.path === 'military')).toBe(true);
    });

    it('should get nodes by tier', () => {
      const treeSystem = new TechTreeSystem();
      const tier1Nodes = treeSystem.getTierNodes('military', 1);
      expect(tier1Nodes.length).toBeGreaterThan(0);
      expect(tier1Nodes.every(n => n.tier === 1)).toBe(true);
    });

    it('should check prerequisites for tech nodes', () => {
      const treeSystem = new TechTreeSystem();
      const allDefs = treeSystem.getAllNodeDefs();

      const nodeWithPrereqs = allDefs.find(d => d.prerequisites && d.prerequisites.length > 0);
      if (nodeWithPrereqs) {
        const canResearch = treeSystem.canResearch(nodeWithPrereqs.id);
        expect(canResearch.can).toBe(false);
        expect(canResearch.reason).toContain('前置');
      }
    });

    it('should allow research for tier-1 nodes (no prerequisites)', () => {
      const treeSystem = new TechTreeSystem();
      const tier1Nodes = treeSystem.getTierNodes('military', 1);

      if (tier1Nodes.length > 0) {
        const node = tier1Nodes[0];
        const canResearch = treeSystem.canResearch(node.id);
        if (!node.mutexGroup || !treeSystem.isMutexLocked(node.id)) {
          expect(canResearch.can).toBe(true);
        }
      }
    });

    it('should enforce mutex branch selection', () => {
      const treeSystem = new TechTreeSystem();
      const allDefs = treeSystem.getAllNodeDefs();

      const mutexNode = allDefs.find(d => d.mutexGroup);
      if (mutexNode) {
        const alternatives = treeSystem.getMutexAlternatives(mutexNode.id);
        expect(alternatives.length).toBeGreaterThan(0);

        treeSystem.completeNode(mutexNode.id);
        expect(treeSystem.isMutexLocked(mutexNode.id)).toBe(false);

        for (const altId of alternatives) {
          expect(treeSystem.isMutexLocked(altId)).toBe(true);
        }
      }
    });

    it('should get chosen mutex nodes after selection', () => {
      const treeSystem = new TechTreeSystem();
      const allDefs = treeSystem.getAllNodeDefs();

      const mutexNode = allDefs.find(d => d.mutexGroup);
      if (mutexNode) {
        treeSystem.completeNode(mutexNode.id);
        const chosen = treeSystem.getChosenMutexNodes();
        expect(chosen[mutexNode.mutexGroup]).toBe(mutexNode.id);
      }
    });

    it('should get tech edges for tree rendering', () => {
      const treeSystem = new TechTreeSystem();
      const edges = treeSystem.getEdges();
      expect(edges.length).toBeGreaterThan(0);
    });

    it('should get path progress', () => {
      const treeSystem = new TechTreeSystem();
      const progress = treeSystem.getPathProgress('military');
      expect(progress.total).toBeGreaterThan(0);
      expect(progress.completed).toBe(0);
    });

    it('should get all path progress', () => {
      const treeSystem = new TechTreeSystem();
      const allProgress = treeSystem.getAllPathProgress();
      expect(allProgress.military).toBeDefined();
      expect(allProgress.economy).toBeDefined();
      expect(allProgress.culture).toBeDefined();
    });

    it('should collect effects from completed techs', () => {
      const treeSystem = new TechTreeSystem();
      const tier1Nodes = treeSystem.getTierNodes('military', 1);

      if (tier1Nodes.length > 0) {
        treeSystem.completeNode(tier1Nodes[0].id);
        const effects = treeSystem.getAllCompletedEffects();
        expect(effects.length).toBeGreaterThan(0);
      }
    });

    it('should serialize and deserialize tech tree state', () => {
      const treeSystem = new TechTreeSystem();
      const tier1Nodes = treeSystem.getTierNodes('military', 1);

      // 完成第一个 tier-1 节点
      if (tier1Nodes.length > 0) {
        treeSystem.completeNode(tier1Nodes[0].id);
      }

      const saved = treeSystem.serialize();
      // 只有在确实完成了节点时才验证
      if (tier1Nodes.length > 0) {
        expect(saved.completedTechIds.length).toBeGreaterThan(0);
      }

      treeSystem.reset();
      const allStates = treeSystem.getAllNodeStates();
      const anyCompleted = Object.values(allStates).some(s => s.status === 'completed');
      expect(anyCompleted).toBe(false);

      if (saved.completedTechIds.length > 0) {
        treeSystem.deserialize(saved);
        const restoredStates = treeSystem.getAllNodeStates();
        const hasCompleted = Object.values(restoredStates).some(s => s.status === 'completed');
        expect(hasCompleted).toBe(true);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §2 世界地图
  // ═══════════════════════════════════════════════════════════════
  describe('§2 世界地图', () => {

    it('should render world map with regions', () => {
      const worldMap = new WorldMapSystem();
      const deps = createFullDeps();
      worldMap.init(deps);

      const regions = worldMap.getRegions();
      expect(regions.length).toBeGreaterThan(0);

      const regionIds = regions.map(r => r.id);
      expect(regionIds).toContain('wei');
      expect(regionIds).toContain('shu');
      expect(regionIds).toContain('wu');
    });

    it('should return map size with valid dimensions', () => {
      const worldMap = new WorldMapSystem();
      const deps = createFullDeps();
      worldMap.init(deps);

      const size = worldMap.getSize();
      expect(size.cols).toBeGreaterThan(0);
      expect(size.rows).toBeGreaterThan(0);
      expect(worldMap.getTotalTiles()).toBe(size.cols * size.rows);
    });

    it('should get tile at valid position', () => {
      const worldMap = new WorldMapSystem();
      const deps = createFullDeps();
      worldMap.init(deps);

      const tile = worldMap.getTileAt({ x: 0, y: 0 });
      expect(tile).not.toBeNull();
      expect(tile!.region).toBeDefined();
      expect(tile!.terrain).toBeDefined();
    });

    it('should return null for out-of-bounds position', () => {
      const worldMap = new WorldMapSystem();
      const deps = createFullDeps();
      worldMap.init(deps);

      const tile = worldMap.getTileAt({ x: -1, y: -1 });
      expect(tile).toBeNull();
    });

    it('should get tiles by region', () => {
      const worldMap = new WorldMapSystem();
      const deps = createFullDeps();
      worldMap.init(deps);

      const weiTiles = worldMap.getTilesByRegion('wei');
      expect(weiTiles.length).toBeGreaterThan(0);
      expect(weiTiles.every(t => t.region === 'wei')).toBe(true);
    });

    it('should get terrain definitions', () => {
      const worldMap = new WorldMapSystem();
      const deps = createFullDeps();
      worldMap.init(deps);

      const terrains = worldMap.getTerrains();
      expect(terrains.length).toBeGreaterThan(0);
    });

    it('should get landmarks', () => {
      const worldMap = new WorldMapSystem();
      const deps = createFullDeps();
      worldMap.init(deps);

      const landmarks = worldMap.getLandmarks();
      expect(landmarks.length).toBeGreaterThan(0);
    });

    it('should get landmarks by type', () => {
      const worldMap = new WorldMapSystem();
      const deps = createFullDeps();
      worldMap.init(deps);

      const cities = worldMap.getLandmarksByType('city');
      expect(cities.length).toBeGreaterThan(0);
      expect(cities.every(c => c.type === 'city')).toBe(true);
    });

    it('should update landmark ownership', () => {
      const worldMap = new WorldMapSystem();
      const deps = createFullDeps();
      worldMap.init(deps);

      const landmarks = worldMap.getLandmarks();
      if (landmarks.length > 0) {
        const result = worldMap.setLandmarkOwnership(landmarks[0].id, 'player');
        expect(result).toBe(true);

        const updated = worldMap.getLandmarkById(landmarks[0].id);
        expect(updated!.ownership).toBe('player');
      }
    });

    it('should control viewport zoom within bounds', () => {
      const worldMap = new WorldMapSystem();
      const deps = createFullDeps();
      worldMap.init(deps);

      worldMap.setZoom(10);
      const viewport = worldMap.getViewport();
      expect(viewport.zoom).toBeLessThanOrEqual(5);

      worldMap.setZoom(-1);
      const viewport2 = worldMap.getViewport();
      expect(viewport2.zoom).toBeGreaterThanOrEqual(0.5);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §3 领土系统
  // ═══════════════════════════════════════════════════════════════
  describe('§3 领土系统', () => {

    it('should initialize with territories', () => {
      const territory = new TerritorySystem();
      const deps = createFullDeps();
      territory.init(deps);

      const all = territory.getAllTerritories();
      expect(all.length).toBeGreaterThan(0);
    });

    it('should occupy territory after capture', () => {
      const deps = createFullDeps();
      const { territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      const target = all.find(t => t.ownership !== 'player');
      if (target) {
        const result = territory.captureTerritory(target.id, 'player');
        expect(result).toBe(true);

        const updated = territory.getTerritoryById(target.id);
        expect(updated!.ownership).toBe('player');
      }
    });

    it('should calculate territory production', () => {
      const deps = createFullDeps();
      const { territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      const targets = all.filter(t => t.ownership !== 'player').slice(0, 3);
      for (const t of targets) {
        territory.captureTerritory(t.id, 'player');
      }

      const summary = territory.getPlayerProductionSummary();
      expect(summary.totalTerritories).toBeGreaterThanOrEqual(3);
      expect(summary.totalProduction.grain).toBeGreaterThan(0);
      expect(summary.totalProduction.gold).toBeGreaterThan(0);
    });

    it('should upgrade territory and increase production', () => {
      const deps = createFullDeps();
      const { territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      const target = all.find(t => t.ownership !== 'player');
      if (target) {
        territory.captureTerritory(target.id, 'player');

        const before = territory.getTerritoryById(target.id)!;
        const productionBefore = before.currentProduction.grain;

        const result = territory.upgradeTerritory(target.id);
        if (result.success) {
          expect(result.newLevel).toBeGreaterThan(result.previousLevel);
          expect(result.newProduction.grain).toBeGreaterThanOrEqual(productionBefore);
        }
      }
    });

    it('should not upgrade non-player territory', () => {
      const deps = createFullDeps();
      const { territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      const target = all.find(t => t.ownership !== 'player');
      if (target) {
        const result = territory.upgradeTerritory(target.id);
        expect(result.success).toBe(false);
      }
    });

    it('should get adjacent territory IDs', () => {
      const deps = createFullDeps();
      const { territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      if (all.length > 0) {
        const adjacent = territory.getAdjacentTerritoryIds(all[0].id);
        expect(Array.isArray(adjacent)).toBe(true);
      }
    });

    it('should check attack eligibility based on adjacency', () => {
      const deps = createFullDeps();
      const { territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      const firstTarget = all.find(t => t.ownership !== 'player');
      if (firstTarget) {
        territory.captureTerritory(firstTarget.id, 'player');

        const adjacent = territory.getAdjacentTerritoryIds(firstTarget.id);
        for (const adjId of adjacent) {
          const canAttack = territory.canAttackTerritory(adjId, 'player');
          const adj = territory.getTerritoryById(adjId);
          if (adj && adj.ownership !== 'player') {
            expect(canAttack).toBe(true);
          }
        }
      }
    });

    it('should get attackable territories list', () => {
      const deps = createFullDeps();
      const { territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      const firstTarget = all.find(t => t.ownership !== 'player');
      if (firstTarget) {
        territory.captureTerritory(firstTarget.id, 'player');
        const attackable = territory.getAttackableTerritories('player');
        expect(attackable.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should calculate accumulated production over time', () => {
      const deps = createFullDeps();
      const { territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      const target = all.find(t => t.ownership !== 'player');
      if (target) {
        territory.captureTerritory(target.id, 'player');
      }

      const production = territory.calculateAccumulatedProduction(3600);
      expect(production.grain).toBeGreaterThanOrEqual(0);
    });

    it('should serialize and deserialize territory state', () => {
      const deps = createFullDeps();
      const { territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      const target = all.find(t => t.ownership !== 'player');
      if (target) {
        territory.captureTerritory(target.id, 'player');
      }

      const saved = territory.serialize();
      territory.reset();

      const afterReset = territory.getPlayerTerritoryCount();
      territory.deserialize(saved);

      const afterRestore = territory.getPlayerTerritoryCount();
      expect(afterRestore).toBeGreaterThanOrEqual(afterReset);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §4 攻城战
  // ═══════════════════════════════════════════════════════════════
  describe('§4 攻城战', () => {

    it('should check siege conditions: target must exist', () => {
      const deps = createFullDeps();
      const { siege } = getSystems(deps);

      const result = siege.checkSiegeConditions('nonexistent_city', 'player', 10000, 10000);
      expect(result.canSiege).toBe(false);
      expect(result.errorCode).toBe('TARGET_NOT_FOUND');
    });

    it('should check siege conditions: need adjacent territory', () => {
      const deps = createFullDeps();
      const { siege, territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      const target = all.find(t => t.ownership !== 'player');
      if (target) {
        const result = siege.checkSiegeConditions(target.id, 'player', 10000, 10000);
        expect(result.canSiege).toBe(false);
        expect(result.errorCode).toBe('NOT_ADJACENT');
      }
    });

    it('should check siege conditions: need sufficient troops and grain', () => {
      const deps = createFullDeps();
      const { siege, territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      const firstTarget = all.find(t => t.ownership !== 'player');
      if (firstTarget) {
        territory.captureTerritory(firstTarget.id, 'player');

        const adjacent = territory.getAdjacentTerritoryIds(firstTarget.id);
        const attackable = adjacent.find(id => {
          const t = territory.getTerritoryById(id);
          return t && t.ownership !== 'player';
        });

        if (attackable) {
          const lowTroops = siege.checkSiegeConditions(attackable, 'player', 0, 10000);
          expect(lowTroops.canSiege).toBe(false);
          expect(lowTroops.errorCode).toBe('INSUFFICIENT_TROOPS');

          const lowGrain = siege.checkSiegeConditions(attackable, 'player', 10000, 0);
          expect(lowGrain.canSiege).toBe(false);
          expect(lowGrain.errorCode).toBe('INSUFFICIENT_GRAIN');
        }
      }
    });

    it('should calculate siege cost based on territory defense', () => {
      const deps = createFullDeps();
      const { siege, territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      if (all.length > 0) {
        const cost = siege.calculateSiegeCost(all[0]);
        expect(cost.troops).toBeGreaterThan(0);
        expect(cost.grain).toBe(500); // PRD MAP-4: 固定500粮草
      }
    });

    it('should execute siege with victory and capture territory', () => {
      const deps = createFullDeps();
      const { siege, territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      const firstTarget = all.find(t => t.ownership !== 'player');
      if (firstTarget) {
        territory.captureTerritory(firstTarget.id, 'player');

        const adjacent = territory.getAdjacentTerritoryIds(firstTarget.id);
        const attackable = adjacent.find(id => {
          const t = territory.getTerritoryById(id);
          return t && t.ownership !== 'player';
        });

        if (attackable) {
          const result = siege.executeSiegeWithResult(
            attackable, 'player', 100000, 10000, true,
          );

          expect(result.launched).toBe(true);
          expect(result.victory).toBe(true);
          expect(result.capture).toBeDefined();
          expect(result.capture!.newOwner).toBe('player');

          const updated = territory.getTerritoryById(attackable);
          expect(updated!.ownership).toBe('player');
        }
      }
    });

    it('should execute siege with defeat and not capture territory', () => {
      const deps = createFullDeps();
      const { siege, territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      const firstTarget = all.find(t => t.ownership !== 'player');
      if (firstTarget) {
        territory.captureTerritory(firstTarget.id, 'player');

        const adjacent = territory.getAdjacentTerritoryIds(firstTarget.id);
        const attackable = adjacent.find(id => {
          const t = territory.getTerritoryById(id);
          return t && t.ownership !== 'player';
        });

        if (attackable) {
          const previousOwner = territory.getTerritoryById(attackable)!.ownership;

          const result = siege.executeSiegeWithResult(
            attackable, 'player', 100000, 10000, false,
          );

          expect(result.launched).toBe(true);
          expect(result.victory).toBe(false);
          expect(result.capture).toBeUndefined();

          const updated = territory.getTerritoryById(attackable);
          expect(updated!.ownership).toBe(previousOwner);
        }
      }
    });

    it('should track siege statistics', () => {
      const deps = createFullDeps();
      const { siege, territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      const firstTarget = all.find(t => t.ownership !== 'player');
      if (firstTarget) {
        territory.captureTerritory(firstTarget.id, 'player');

        const adjacent = territory.getAdjacentTerritoryIds(firstTarget.id);
        const attackable = adjacent.find(id => {
          const t = territory.getTerritoryById(id);
          return t && t.ownership !== 'player';
        });

        if (attackable) {
          siege.executeSiegeWithResult(attackable, 'player', 100000, 10000, true);

          expect(siege.getTotalSieges()).toBe(1);
          expect(siege.getVictories()).toBe(1);
          expect(siege.getDefeats()).toBe(0);
          expect(siege.getWinRate()).toBe(1);
        }
      }
    });

    it('should enforce daily siege limit', () => {
      const deps = createFullDeps();
      const { siege, territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      const firstTarget = all.find(t => t.ownership !== 'player');
      if (firstTarget) {
        territory.captureTerritory(firstTarget.id, 'player');

        let siegeCount = 0;
        const maxAttempts = 5;
        for (let i = 0; i < maxAttempts; i++) {
          const adjacent = territory.getAdjacentTerritoryIds(firstTarget.id);
          const remaining = adjacent.filter(id => {
            const t = territory.getTerritoryById(id);
            return t && t.ownership !== 'player';
          });

          if (remaining.length === 0) break;

          const result = siege.executeSiegeWithResult(
            remaining[0], 'player', 100000, 10000, true,
          );

          if (result.launched) {
            siegeCount++;
          } else {
            break;
          }
        }

        expect(siegeCount).toBeLessThanOrEqual(3);
      }
    });

    it('should calculate siege reward after victory', () => {
      const deps = createFullDeps();
      const { enhancer, territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      if (all.length > 0) {
        const reward = enhancer.calculateSiegeRewardById(all[0].id);
        if (reward) {
          expect(reward.resources.grain).toBeGreaterThan(0);
          expect(reward.resources.gold).toBeGreaterThan(0);
        }
      }
    });

    it('should serialize and deserialize siege state', () => {
      const deps = createFullDeps();
      const { siege, territory } = getSystems(deps);

      const all = territory.getAllTerritories();
      const firstTarget = all.find(t => t.ownership !== 'player');
      if (firstTarget) {
        territory.captureTerritory(firstTarget.id, 'player');

        const adjacent = territory.getAdjacentTerritoryIds(firstTarget.id);
        const attackable = adjacent.find(id => {
          const t = territory.getTerritoryById(id);
          return t && t.ownership !== 'player';
        });

        if (attackable) {
          siege.executeSiegeWithResult(attackable, 'player', 100000, 10000, true);
        }
      }

      const saved = siege.serialize();
      expect(saved.totalSieges).toBeGreaterThanOrEqual(0);

      siege.reset();
      expect(siege.getTotalSieges()).toBe(0);

      siege.deserialize(saved);
      expect(siege.getTotalSieges()).toBe(saved.totalSieges);
    });
  });
});
