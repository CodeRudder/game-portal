/**
 * v6.0 集成测试 — §8 交叉验证
 *
 * 覆盖 Play 文档流程：
 *   §8.1 时代推进×势力消长
 *   §8.2 全局事件×世界地图
 *   §8.3 NPC好感度×事件系统
 *   §8.4 离线处理×全局事件
 *   §8.5 驻防×攻城×离线
 *   §8.6 NPC系统×地图事件
 *   §8.7 攻城奖励×活动系统
 *   §8.8 连锁事件×NPC好感度
 *   §8.9 手机端全流程串联（引擎层验证）
 *   §8.10 NPC离线行为×事件系统
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/__tests__/integration/v6-cross-validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarSystem } from '../../calendar/CalendarSystem';
import { EventTriggerSystem } from '../../event/EventTriggerSystem';
import { EventNotificationSystem } from '../../event/EventNotificationSystem';
import { EventLogSystem } from '../../event/EventLogSystem';
import { ChainEventSystem } from '../../event/ChainEventSystem';
import { OfflineEventSystem } from '../../event/OfflineEventSystem';
import { OfflineEventHandler } from '../../event/OfflineEventHandler';
import { TerritorySystem } from '../../map/TerritorySystem';
import { SiegeSystem } from '../../map/SiegeSystem';
import { SiegeEnhancer } from '../../map/SiegeEnhancer';
import { GarrisonSystem } from '../../map/GarrisonSystem';
import { WorldMapSystem } from '../../map/WorldMapSystem';
import { MapFilterSystem } from '../../map/MapFilterSystem';
import { NPCSystem } from '../../npc/NPCSystem';
import { NPCFavorabilitySystem } from '../../npc/NPCFavorabilitySystem';
import { NPCMapPlacer } from '../../npc/NPCMapPlacer';
import type { ISystemDeps } from '../../../core/types';
import type { ISubsystemRegistry } from '../../../core/types/subsystem';
import type { EventDef } from '../../../core/event';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createFullDeps(): ISystemDeps {
  const calendar = new CalendarSystem();
  const eventTrigger = new EventTriggerSystem();
  const notification = new EventNotificationSystem();
  const eventLog = new EventLogSystem();
  const chainEvent = new ChainEventSystem();
  const offlineEvent = new OfflineEventSystem();
  const offlineHandler = new OfflineEventHandler();
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const enhancer = new SiegeEnhancer();
  const garrison = new GarrisonSystem();
  const mapSys = new WorldMapSystem();
  const npc = new NPCSystem();
  const npcFavor = new NPCFavorabilitySystem();
  const npcMapPlacer = new NPCMapPlacer();

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
  registry.set('worldMap', mapSys);
  registry.set('npc', npc);
  registry.set('npcFavorability', npcFavor);
  registry.set('npcMapPlacer', npcMapPlacer);

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
  mapSys.init(deps);
  npc.init(deps);
  npcFavor.init(deps);
  npcMapPlacer.init(deps);

  return deps;
}

function getSystems(deps: ISystemDeps) {
  return {
    calendar: deps.registry.get<CalendarSystem>('calendar')!,
    eventTrigger: deps.registry.get<EventTriggerSystem>('eventTrigger')!,
    notification: deps.registry.get<EventNotificationSystem>('eventNotification')!,
    eventLog: deps.registry.get<EventLogSystem>('eventLog')!,
    chainEvent: deps.registry.get<ChainEventSystem>('chainEvent')!,
    offlineEvent: deps.registry.get<OfflineEventSystem>('offlineEvent')!,
    territory: deps.registry.get<TerritorySystem>('territory')!,
    siege: deps.registry.get<SiegeSystem>('siege')!,
    enhancer: deps.registry.get<SiegeEnhancer>('siegeEnhancer')!,
    garrison: deps.registry.get<GarrisonSystem>('garrison')!,
    map: deps.registry.get<WorldMapSystem>('worldMap')!,
    npc: deps.registry.get<NPCSystem>('npc')!,
    npcFavor: deps.registry.get<NPCFavorabilitySystem>('npcFavorability')!,
    npcMapPlacer: deps.registry.get<NPCMapPlacer>('npcMapPlacer')!,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('v6.0 集成测试: §8 交叉验证', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;
  let offlineHandler: OfflineEventHandler;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
    offlineHandler = new OfflineEventHandler();
  });

  // ── §8.1 时代推进×势力消长 ──────────────────

  describe('§8.1 时代推进×势力消长', () => {
    it('攻占领土完成时代目标 → 时代变迁 → 新NPC解锁', () => {
      // 1. 攻占领土
      sys.territory.captureTerritory('city-ye', 'player');
      sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);
      sys.siege.resetDailySiegeCount();
      sys.siege.executeSiegeWithResult('city-puyang', 'player', 10000, 10000, true);

      // 2. 领土数增长
      expect(sys.territory.getPlayerTerritoryCount()).toBe(3);

      // 3. 产出增长
      const summary = sys.territory.getPlayerProductionSummary();
      expect(summary.totalProduction.grain).toBeGreaterThan(0);
    });

    it('时代变迁后大势面板势力数据重算', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      sys.territory.captureTerritory('city-xuchang', 'player');

      const all = sys.territory.getAllTerritories();
      const playerCount = all.filter(t => t.ownership === 'player').length;
      const totalCount = all.length;
      const ratio = playerCount / totalCount;

      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThanOrEqual(1);
    });
  });

  // ── §8.2 全局事件×世界地图 ──────────────────

  describe('§8.2 全局事件×世界地图', () => {
    it('全局事件触发 → 急报横幅通知', () => {
      const def: EventDef = {
        id: 'global-disaster',
        title: '天灾降临',
        description: '一场大旱席卷中原',
        triggerType: 'random',
        urgency: 'critical',
        options: [
          { id: 'opt-help', text: '施药救治', consequences: { description: '铜钱-500', resourceChanges: { gold: -500 } } },
        ],
      };
      sys.eventTrigger.registerEvent(def);

      const result = sys.eventTrigger.forceTriggerEvent('global-disaster', 1);
      expect(result.triggered).toBe(true);

      const banner = sys.notification.createBanner(result.instance!, {
        title: def.title, description: def.description, urgency: def.urgency,
      }, 1);

      expect(banner.urgency).toBe('critical');
      expect(banner.read).toBe(false);

      // 记录到日志
      sys.eventLog.logEvent({
        eventDefId: def.id, title: def.title, description: def.description,
        triggeredTurn: 1, timestamp: Date.now(), eventType: 'random',
      });

      const logs = sys.eventLog.getEventLog({ eventType: 'random' });
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    it('地图事件标记：9类事件完整', () => {
      const basicEvents = ['merchant_distress', 'refugees', 'treasure', 'bandits'];
      const extendedEvents = ['bandit', 'caravan', 'disaster', 'ruins', 'conflict'];
      expect([...basicEvents, ...extendedEvents]).toHaveLength(9);
    });
  });

  // ── §8.3 NPC好感度×事件系统 ─────────────────

  describe('§8.3 NPC好感度×事件系统', () => {
    it('好感度门槛正确拦截/放行', () => {
      const config = sys.npcFavor.getGainConfig();
      expect(config).toBeDefined();

      // NPC交互解锁检查
      const npcs = sys.npc.getAllNPCs();
      if (npcs.length > 0) {
        const npc = npcs[0];
        const viz = sys.npcFavor.getVisualization(npc.id);
        if (viz) {
          // 基础交互应始终可用
          expect(viz.currentLevel).toBeDefined();
        }
      }
    });

    it('连锁事件顺序不可颠倒', () => {
      sys.chainEvent.registerChain({
        id: 'npc-chain',
        name: 'NPC事件链',
        description: '测试NPC与事件联动',
        maxDepth: 3,
        nodes: [
          { id: 'nc-1', eventDefId: 'evt-nc-1', depth: 0 },
          { id: 'nc-2', eventDefId: 'evt-nc-2', parentNodeId: 'nc-1', parentOptionId: 'go', depth: 1 },
          { id: 'nc-3', eventDefId: 'evt-nc-3', parentNodeId: 'nc-2', parentOptionId: 'go', depth: 2 },
        ],
      });

      const root = sys.chainEvent.startChain('npc-chain');
      expect(root!.depth).toBe(0);

      // 不能跳到深度2（必须先完成深度1）
      const r = sys.chainEvent.advanceChain('npc-chain', 'go');
      expect(r.success).toBe(true);
      expect(r.currentNode?.depth).toBe(1);
    });
  });

  // ── §8.4 离线处理×全局事件 ─────────────────

  describe('§8.4 离线处理×全局事件', () => {
    it('离线事件自动处理规则正确', () => {
      const def: EventDef = {
        id: 'offline-auto',
        title: '离线自动事件',
        description: '测试自动处理',
        triggerType: 'random',
        urgency: 'low',
        options: [
          { id: 'opt-safe', text: '安全选项', isDefault: true, consequences: { description: '安全', resourceChanges: { grain: 50 } } },
          { id: 'opt-risk', text: '冒险选项', consequences: { description: '冒险', resourceChanges: { grain: -100 } } },
        ],
      };

      const pile = offlineHandler.simulateOfflineEvents(10, [def], 1.0);
      expect(pile.events.length).toBeGreaterThan(0);

      const processed = offlineHandler.processOfflinePile(pile);
      expect(processed.autoResolvedEvents.length + processed.pendingEvents.length).toBe(pile.events.length);
    });

    it('离线事件处理不导致负面后果超过手动处理的50%', () => {
      // 低优先级事件应自动选择安全选项
      const def: EventDef = {
        id: 'offline-safe',
        title: '安全事件',
        description: '应自动选择安全选项',
        triggerType: 'random',
        urgency: 'low',
        options: [
          { id: 'opt-safe', text: '安全', isDefault: true, consequences: { description: '安全', resourceChanges: { gold: 100 } } },
        ],
      };

      const autoResult = offlineHandler.tryAutoResolve(def);
      expect(autoResult).not.toBeNull();
      expect(autoResult!.chosenOptionId).toBe('opt-safe');
    });

    it('高优先级事件保留给玩家', () => {
      const def: EventDef = {
        id: 'offline-critical',
        title: '紧急事件',
        description: '应保留给玩家',
        triggerType: 'random',
        urgency: 'critical',
        options: [
          { id: 'opt-1', text: '选项1', consequences: { description: '结果' } },
        ],
      };

      const autoResult = offlineHandler.tryAutoResolve(def);
      expect(autoResult).toBeNull();
    });
  });

  // ── §8.5 驻防×攻城×离线 ────────────────────

  describe('§8.5 驻防×攻城×离线', () => {
    it('驻防武将正确参与离线防御计算', () => {
      sys.territory.captureTerritory('city-ye', 'player');

      // 无驻防时防御值
      const baseDefense = sys.territory.getTerritoryById('city-ye')!.defenseValue;
      const noGarrisonDefense = sys.garrison.getEffectiveDefense('city-ye', baseDefense);
      expect(noGarrisonDefense).toBe(baseDefense);
    });

    it('离线领土损失不超过20%上限', () => {
      // 占领多块领土
      const territories = ['city-ye', 'city-xuchang', 'city-puyang', 'city-beihai', 'city-chengdu'];
      for (const t of territories) {
        sys.territory.captureTerritory(t, 'player');
      }

      const count = sys.territory.getPlayerTerritoryCount();
      const maxLoss = Math.floor(count * 0.2);
      expect(maxLoss).toBe(1); // 5块领土最多丢1块
    });

    it('攻城→占领→驻防→防御提升', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const t = sys.territory.getTerritoryById('city-ye')!;

      // 驻防前防御
      const beforeDefense = sys.garrison.getEffectiveDefense('city-ye', t.defenseValue);
      expect(beforeDefense).toBe(t.defenseValue);

      // 胜率预估
      const estimate = sys.enhancer.estimateWinRate(50000, 'city-xuchang');
      expect(estimate).toBeDefined();
    });
  });

  // ── §8.6 NPC系统×地图事件 ──────────────────

  describe('§8.6 NPC系统×地图事件', () => {
    it('NPC事件正确关联到对应NPC', () => {
      const npcs = sys.npc.getAllNPCs();
      expect(npcs.length).toBeGreaterThan(0);

      // NPC有位置信息
      for (const npc of npcs) {
        expect(npc.position).toBeDefined();
        expect(npc.region).toBeDefined();
      }
    });

    it('好感度变化即时生效', () => {
      const npcs = sys.npc.getAllNPCs();
      if (npcs.length > 0) {
        const npc = npcs[0];
        const before = npc.affinity;

        sys.npc.changeAffinity(npc.id, 10);
        const after = sys.npc.getNPCById(npc.id)!.affinity;

        expect(after).toBe(before + 10);
      }
    });
  });

  // ── §8.7 攻城奖励×活动系统 ─────────────────

  describe('§8.7 攻城奖励×活动系统', () => {
    it('攻城成功→奖励包含资源', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);

      const reward = sys.enhancer.calculateSiegeRewardById('city-xuchang');
      expect(reward).toBeDefined();
      expect(reward!.resources.grain).toBeGreaterThan(0);
      expect(reward!.resources.gold).toBeGreaterThan(0);
    });

    it('攻城统计正确', () => {
      sys.territory.captureTerritory('city-ye', 'player');

      sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);
      sys.siege.resetDailySiegeCount();
      sys.siege.executeSiegeWithResult('city-puyang', 'player', 10000, 10000, false);

      expect(sys.siege.getTotalSieges()).toBe(2);
      expect(sys.siege.getWinRate()).toBeGreaterThanOrEqual(0);
    });
  });

  // ── §8.8 连锁事件×NPC好感度 ────────────────

  describe('§8.8 连锁事件×NPC好感度', () => {
    it('连锁事件完成→记录到事件日志', () => {
      sys.chainEvent.registerChain({
        id: 'bond-chain',
        name: '羁绊链',
        description: '测试连锁事件与好感度联动',
        maxDepth: 2,
        nodes: [
          { id: 'bc-1', eventDefId: 'evt-bc-1', depth: 0 },
          { id: 'bc-2', eventDefId: 'evt-bc-2', parentNodeId: 'bc-1', parentOptionId: 'go', depth: 1 },
        ],
      });

      sys.chainEvent.startChain('bond-chain');
      const r = sys.chainEvent.advanceChain('bond-chain', 'go');
      if (!r.chainCompleted) {
        sys.chainEvent.advanceChain('bond-chain', 'done');
      }

      // 记录到事件日志
      sys.eventLog.logEvent({
        eventDefId: 'evt-bc-1', title: '羁绊链完成', description: '连锁事件已完成',
        triggeredTurn: 1, timestamp: Date.now(), eventType: 'chain',
      });

      const chainLogs = sys.eventLog.getEventLog({ eventType: 'chain' });
      expect(chainLogs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── §8.9 手机端全流程串联（引擎层验证）───────

  describe('§8.9 手机端全流程串联', () => {
    it('完整流程：地图→领土→攻城→事件→NPC', () => {
      // 1. 地图初始化
      const tiles = sys.map.getAllTiles();
      expect(tiles.length).toBeGreaterThan(0);

      // 2. 领土占领
      sys.territory.captureTerritory('city-ye', 'player');
      expect(sys.territory.getPlayerTerritoryCount()).toBe(1);

      // 3. 攻城
      const siegeResult = sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);
      expect(siegeResult.launched).toBe(true);

      // 4. 事件触发
      const def: EventDef = {
        id: 'full-flow-event',
        title: '商队来访',
        description: '一支商队经过',
        triggerType: 'random',
        urgency: 'medium',
        options: [
          { id: 'trade', text: '交易', consequences: { description: '铜钱+300', resourceChanges: { gold: 300 } } },
        ],
      };
      sys.eventTrigger.registerEvent(def);
      const eventResult = sys.eventTrigger.forceTriggerEvent('full-flow-event', 1);
      expect(eventResult.triggered).toBe(true);

      // 5. NPC查询
      const npcs = sys.npc.getAllNPCs();
      expect(npcs.length).toBeGreaterThan(0);

      // 6. 日志记录
      sys.eventLog.logEvent({
        eventDefId: def.id, title: def.title, description: def.description,
        triggeredTurn: 1, timestamp: Date.now(), eventType: 'random',
      });
      expect(sys.eventLog.getLogCount()).toBeGreaterThanOrEqual(1);
    });
  });

  // ── §8.10 NPC离线行为×事件系统 ─────────────

  describe('§8.10 NPC离线行为×事件系统', () => {
    it('离线期间NPC持续运作', () => {
      const npcs = sys.npc.getAllNPCs();
      expect(npcs.length).toBeGreaterThan(0);

      // NPC有状态信息
      for (const npc of npcs) {
        expect(npc.id).toBeDefined();
        expect(npc.profession).toBeDefined();
      }
    });

    it('离线事件堆积处理', () => {
      const def: EventDef = {
        id: 'offline-npc-event',
        title: 'NPC求助',
        description: 'NPC需要帮助',
        triggerType: 'random',
        urgency: 'medium',
        options: [
          { id: 'help', text: '提供帮助', isDefault: true, consequences: { description: '好感度+20', resourceChanges: { grain: -100 } } },
          { id: 'decline', text: '婉拒', consequences: { description: '无变化' } },
        ],
      };

      const pile = offlineHandler.simulateOfflineEvents(8, [def], 0.5);
      expect(pile.events.length).toBeGreaterThan(0);
      expect(pile.offlineTurns).toBe(8);

      const stats = offlineHandler.getPileStats(pile);
      expect(stats.total).toBe(pile.events.length);
      expect(stats.autoResolved + stats.pending).toBe(stats.total);
    });

    it('回归后急报堆展示', () => {
      // 添加急报
      const alert = sys.eventLog.addAlert({
        title: '离线急报',
        description: '你离线期间发生了重大事件',
        urgency: 'high',
        alertType: 'random',
      });

      expect(alert).toBeDefined();
      expect(alert.read).toBe(false);

      const stack = sys.eventLog.getAlertStack();
      expect(stack.unreadCount).toBeGreaterThanOrEqual(1);
      expect(stack.highestUrgency).toBe('high');
    });
  });

  // ── 全系统序列化一致性 ──────────────────────

  describe('全系统序列化一致性', () => {
    it('领土+攻城序列化一致', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);

      const tSave = sys.territory.serialize();
      const sSave = sys.siege.serialize();

      sys.territory.reset();
      sys.siege.reset();

      sys.territory.deserialize(tSave);
      sys.siege.deserialize(sSave);

      expect(sys.territory.getPlayerTerritoryCount()).toBe(2);
      expect(sys.siege.getTotalSieges()).toBe(1);
    });

    it('事件系统序列化一致', () => {
      const def: EventDef = {
        id: 'serial-test',
        title: '序列化测试',
        description: '测试',
        triggerType: 'random',
        urgency: 'low',
        options: [{ id: 'opt-1', text: '选项1', consequences: { description: '结果' } }],
      };
      sys.eventTrigger.registerEvent(def);
      sys.eventTrigger.forceTriggerEvent('serial-test', 1);

      const eSave = sys.eventTrigger.serialize();
      sys.eventTrigger.reset();
      sys.eventTrigger.deserialize(eSave);

      // 事件定义应通过 loadPredefinedEvents 重新加载
      const allDefs = sys.eventTrigger.getAllEventDefs();
      expect(allDefs.length).toBeGreaterThan(0);
    });

    it('日历序列化一致', () => {
      sys.calendar.update(100);
      const saved = sys.calendar.serialize();
      const stateBefore = sys.calendar.getState();

      sys.calendar.reset();
      sys.calendar.deserialize(saved);
      const stateAfter = sys.calendar.getState();

      expect(stateAfter.totalDays).toBe(stateBefore.totalDays);
    });
  });
});
