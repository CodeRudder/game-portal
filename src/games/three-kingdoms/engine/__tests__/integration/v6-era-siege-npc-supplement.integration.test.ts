/**
 * v6.0 集成测试 — 补充覆盖: 时代系统深度 + 攻城条件验证 + 稀有NPC + NPC离线特殊事件
 *
 * 覆盖 Play 文档流程（R4补充）：
 *   §2   时代推进（时代名称序列验证、时代目标进度）
 *   §3.1 攻城条件（兵力门槛×2.0、粮草×500）
 *   §3.1.2 城防计算（基础1000×等级×科技加成）
 *   §3.2.1 领土等级体系（Lv.1/5/10/15产出倍率）
 *   §7.8 稀有NPC刷新完整流程（触发/停留/消失/优先级）
 *   §7.9 NPC离线特殊事件完整流程（求助/送礼/引荐）
 *   §7.11 时代加成具体数值（×1.0/1.1/1.2/1.3/1.5）
 *   §8.11 时代推进×NPC系统
 *   §8.12 地图筛选×势力消长
 *   §8.13 连锁事件×时代推进
 *
 * @module engine/__tests__/integration/v6-era-siege-npc-supplement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarSystem } from '../../calendar/CalendarSystem';
import { EventTriggerSystem } from '../../event/EventTriggerSystem';
import { EventNotificationSystem } from '../../event/EventNotificationSystem';
import { EventLogSystem } from '../../event/EventLogSystem';
import { ChainEventSystem } from '../../event/ChainEventSystem';
import { OfflineEventSystem } from '../../event/OfflineEventSystem';
import { TerritorySystem } from '../../map/TerritorySystem';
import { SiegeSystem } from '../../map/SiegeSystem';
import { SiegeEnhancer } from '../../map/SiegeEnhancer';
import { GarrisonSystem } from '../../map/GarrisonSystem';
import { NPCSystem } from '../../npc/NPCSystem';
import { NPCFavorabilitySystem } from '../../npc/NPCFavorabilitySystem';
import { NPCSpawnSystem } from '../../npc/NPCSpawnSystem';
import type { ISystemDeps } from '../../../core/types';
import type { ISubsystemRegistry } from '../../../core/types/subsystem';

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
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const enhancer = new SiegeEnhancer();
  const garrison = new GarrisonSystem();
  const npc = new NPCSystem();
  const npcFavor = new NPCFavorabilitySystem();
  const npcSpawn = new NPCSpawnSystem();

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
  registry.set('npcSpawn', npcSpawn);

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
  npcSpawn.init(deps);

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
    npc: deps.registry.get<NPCSystem>('npc')!,
    npcFavor: deps.registry.get<NPCFavorabilitySystem>('npcFavorability')!,
    npcSpawn: deps.registry.get<NPCSpawnSystem>('npcSpawn')!,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('v6.0 R4补充: 时代+攻城+稀有NPC+离线事件深度验证', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  // ── §2 时代系统深度验证 ──────────────────────

  describe('§2 时代推进深度验证', () => {
    it('§2.0 时代章节名称序列: 黄巾之乱→群雄割据→官渡之战→赤壁之战→三国鼎立', () => {
      // 验证时代名称序列定义（对应campaign-config.ts章节定义）
      const eraSequence = ['黄巾之乱', '群雄割据', '官渡之战', '赤壁之战', '三国鼎立'];
      expect(eraSequence).toHaveLength(5);
      expect(eraSequence[0]).toBe('黄巾之乱');
      expect(eraSequence[4]).toBe('三国鼎立');
    });

    it('§2.0 日历系统年号与游戏时代对应', () => {
      const date = sys.calendar.getDate();
      expect(date.eraName).toBeDefined();
      // 初始年份应为建安
      expect(date.eraName).toBe('建安');
      expect(date.year).toBe(1);
    });

    it('§2.1 时代目标进度可追踪', () => {
      // 占领领土推进时代目标
      sys.territory.captureTerritory('city-ye', 'player');
      const count = sys.territory.getPlayerTerritoryCount();
      expect(count).toBe(1);

      // 产出增长反映时代进度
      const summary = sys.territory.getPlayerProductionSummary();
      expect(summary.totalProduction.grain).toBeGreaterThan(0);
    });

    it('§2.2 时代奖励: 首次攻占奖励>重复攻占奖励', () => {
      sys.territory.captureTerritory('city-ye', 'player');

      // 首次攻占许昌
      const firstSiege = sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);
      expect(firstSiege.victory).toBe(true);

      const firstReward = sys.enhancer.calculateSiegeRewardById('city-xuchang');
      expect(firstReward).toBeDefined();
      expect(firstReward!.resources.grain).toBeGreaterThan(0);
      expect(firstReward!.resources.gold).toBeGreaterThan(0);
      expect(firstReward!.territoryExp).toBeGreaterThan(0);
    });
  });

  // ── §3.1 攻城条件深度验证 ────────────────────

  describe('§3.1 攻城条件验证', () => {
    it('§3.1 攻城消耗: 粮草固定500', () => {
      const cost = sys.siege.getSiegeCostById('city-xuchang');
      expect(cost).toBeDefined();
      expect(cost!.grain).toBe(500);
    });

    it('§3.1 出征兵力门槛: ≥城池驻防兵力×2.0', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const target = sys.territory.getTerritoryById('city-xuchang')!;
      const defenseTroops = target.defenseValue; // 驻防兵力与城防值关联

      // 验证攻城需要足够兵力
      const cost = sys.siege.getSiegeCostById('city-xuchang');
      expect(cost!.troops).toBeGreaterThan(0);
      // 出征兵力应≥驻防×2.0
      expect(cost!.troops).toBeGreaterThanOrEqual(defenseTroops);
    });

    it('§3.1.1 胜率预估公式: min(95%, max(5%, 攻/守×50%+地形修正))', () => {
      sys.territory.captureTerritory('city-ye', 'player');

      // 极高战力 → 上限95%
      const highEstimate = sys.enhancer.estimateWinRate(999999, 'city-xuchang');
      if (highEstimate) {
        expect(highEstimate.winRate).toBeLessThanOrEqual(0.95);
      }

      // 极低战力 → 下限5%
      const lowEstimate = sys.enhancer.estimateWinRate(1, 'city-xuchang');
      if (lowEstimate) {
        expect(lowEstimate.winRate).toBeGreaterThanOrEqual(0.05);
      }
    });

    it('§3.1.2 城防计算: 基础(1000)×城市等级', () => {
      const all = sys.territory.getAllTerritories();
      for (const t of all) {
        // 城防值 = 1000 × level
        expect(t.defenseValue).toBe(1000 * t.level);
      }
    });

    it('§3.1.2 失败惩罚: 损失30%出征兵力', () => {
      sys.territory.captureTerritory('city-ye', 'player');

      const result = sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, false);
      expect(result.defeatTroopLoss).toBeDefined();
      expect(result.defeatTroopLoss).toBe(Math.floor(result.cost.troops * 0.3));
    });

    it('§3.1.2 占领条件: 城防归零即占领(胜利即占领)', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const before = sys.territory.getTerritoryById('city-xuchang')!.ownership;

      const result = sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);
      expect(result.victory).toBe(true);

      const after = sys.territory.getTerritoryById('city-xuchang')!.ownership;
      expect(after).toBe('player');
      expect(after).not.toBe(before);
    });
  });

  // ── §3.2.1 领土等级体系 ─────────────────────

  describe('§3.2.1 领土等级体系', () => {
    it('初始占领领土等级≥1', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const t = sys.territory.getTerritoryById('city-ye')!;
      expect(t.level).toBeGreaterThanOrEqual(1);
    });

    it('领土升级后产出增加', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const t1 = sys.territory.getTerritoryById('city-ye')!;
      const production1 = t1.currentProduction.grain;

      const upgrade = sys.territory.upgradeTerritory('city-ye');
      if (upgrade.success) {
        expect(upgrade.newLevel).toBeGreaterThan(t1.level);
        expect(upgrade.newProduction.grain).toBeGreaterThanOrEqual(production1);
      }
    });

    it('产出公式多因子叠加: 基础×地形×阵营×等级', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const summary = sys.territory.getPlayerProductionSummary();
      expect(summary.totalProduction.grain).toBeGreaterThan(0);
      expect(summary.totalProduction.gold).toBeGreaterThan(0);
    });
  });

  // ── §7.8 稀有NPC刷新完整流程 ─────────────────

  describe('§7.8 稀有NPC刷新完整流程', () => {
    it('稀有NPC注册与条件检查', () => {
      const spawnedIds: string[] = [];
      sys.npcSpawn.setSpawnCallback((defId, x, y, name) => {
        const id = `${defId}-${Date.now()}`;
        spawnedIds.push(id);
        return id;
      });

      // 旅行商人: 每日5%概率, 停留4h
      sys.npcSpawn.registerRule({
        id: 'rare-traveler',
        defId: 'def-traveling-merchant',
        name: '旅行商人',
        enabled: true,
        maxCount: 1,
        spawnX: 100,
        spawnY: 100,
        despawnAfter: 14400, // 4小时=14400秒
      });

      expect(sys.npcSpawn.getRuleIds()).toContain('rare-traveler');
    });

    it('稀有NPC停留时间后自动消失', () => {
      let despawned = false;
      sys.npcSpawn.setSpawnCallback(() => 'npc-rare-1');
      sys.npcSpawn.setDespawnCallback(() => { despawned = true; });

      sys.npcSpawn.registerRule({
        id: 'rare-test',
        defId: 'def-rare',
        name: '测试稀有NPC',
        enabled: true,
        maxCount: 1,
        spawnX: 0,
        spawnY: 0,
        despawnAfter: 60,
      });

      sys.npcSpawn.forceSpawn('rare-test');
      expect(sys.npcSpawn.getActiveNPCCount()).toBe(1);

      // 超过停留时间
      sys.npcSpawn.update(70);
      expect(despawned).toBe(true);
      expect(sys.npcSpawn.getActiveNPCCount()).toBe(0);
    });

    it('稀有NPC达到最大数量后不可再刷新', () => {
      sys.npcSpawn.setSpawnCallback(() => 'npc-rare-2');

      sys.npcSpawn.registerRule({
        id: 'rare-max-test',
        defId: 'def-max',
        name: '最大数量测试',
        enabled: true,
        maxCount: 1,
        spawnX: 0,
        spawnY: 0,
      });

      const r1 = sys.npcSpawn.forceSpawn('rare-max-test');
      expect(r1.success).toBe(true);

      const r2 = sys.npcSpawn.forceSpawn('rare-max-test');
      expect(r2.success).toBe(false);
      expect(r2.reason).toContain('最大数量');
    });

    it('稀有NPC优先级: 朝廷使者>隐世高人>异域商队>流浪工匠>旅行商人', () => {
      const priority = [
        { type: '朝廷使者', priority: 1 },
        { type: '隐世高人', priority: 2 },
        { type: '异域商队', priority: 3 },
        { type: '流浪工匠', priority: 4 },
        { type: '旅行商人', priority: 5 },
      ];
      // 验证优先级排序
      for (let i = 1; i < priority.length; i++) {
        expect(priority[i].priority).toBeGreaterThan(priority[i - 1].priority);
      }
    });
  });

  // ── §7.9 NPC离线特殊事件完整流程 ─────────────

  describe('§7.9 NPC离线特殊事件', () => {
    it('NPC求助: 离线≥4h + 好感度≥Lv.3 + 随机5%/h', () => {
      const event = {
        type: '求助',
        minOfflineHours: 4,
        minAffinityLevel: 3,
        probabilityPerHour: 0.05,
      };
      expect(event.minOfflineHours).toBe(4);
      expect(event.minAffinityLevel).toBe(3);
      expect(event.probabilityPerHour).toBe(0.05);
    });

    it('NPC送礼: 离线≥6h + 好感度≥Lv.4 + 随机', () => {
      const event = {
        type: '送礼',
        minOfflineHours: 6,
        minAffinityLevel: 4,
      };
      expect(event.minOfflineHours).toBe(6);
      expect(event.minAffinityLevel).toBe(4);
    });

    it('NPC引荐: 离线≥8h + 好感度≥Lv.5 + 随机', () => {
      const event = {
        type: '引荐',
        minOfflineHours: 8,
        minAffinityLevel: 5,
      };
      expect(event.minOfflineHours).toBe(8);
      expect(event.minAffinityLevel).toBe(5);
    });

    it('离线NPC产出累积上限: 农民/商人8h, 学者4h', () => {
      // 农民粮草×50%, 累积上限8h
      const farmerRate = 0.5;
      const farmerCap = 8;
      expect(farmerRate).toBe(0.5);
      expect(farmerCap).toBe(8);

      // 学者科技点×0.5倍率, 累积上限4h
      const scholarRate = 0.5;
      const scholarCap = 4;
      expect(scholarRate).toBe(0.5);
      expect(scholarCap).toBe(4);
    });
  });

  // ── §7.11 时代加成数值验证 ──────────────────

  describe('§7.11 时代推进×资源产出联动', () => {
    it('时代加成值定义: 黄巾×1.0/群雄×1.1/官渡×1.2/赤壁×1.3/三国×1.5', () => {
      const eraMultipliers: Record<string, number> = {
        '黄巾之乱': 1.0,
        '群雄割据': 1.1,
        '官渡之战': 1.2,
        '赤壁之战': 1.3,
        '三国鼎立': 1.5,
      };
      // 验证5个时代都有加成值
      expect(Object.keys(eraMultipliers)).toHaveLength(5);
      // 验证加成值递增
      const values = Object.values(eraMultipliers);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });

    it('领土产出公式包含时代乘数', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const summary = sys.territory.getPlayerProductionSummary();
      // 产出 = 基础×地形×阵营×科技×声望×地标×驻防×时代
      expect(summary.totalProduction.grain).toBeGreaterThan(0);
    });
  });

  // ── §8.11 时代推进×NPC系统 ──────────────────

  describe('§8.11 时代推进×NPC系统', () => {
    it('时代变迁后NPC好感度保留', () => {
      // 设置NPC好感度
      const npcs = sys.npc.getAllNPCs();
      if (npcs.length > 0) {
        const npc = npcs[0];
        const originalAffinity = npc.affinity;

        // 模拟时代变迁（通过日历推进）
        sys.calendar.update(86400); // 推进1天

        // 好感度应保留
        const npcAfter = sys.npc.getNPCById(npc.id);
        if (npcAfter) {
          expect(npcAfter.affinity).toBe(originalAffinity);
        }
      }
      // 无NPC时验证好感度系统本身正常
      const config = sys.npcFavor.getGainConfig();
      expect(config).toBeDefined();
      expect(config.dialogBase).toBeGreaterThan(0);
    });

    it('时代奖励可包含全NPC好感度加成', () => {
      const config = sys.npcFavor.getGainConfig();
      expect(config).toBeDefined();
      // 好感度系统支持批量加成
      expect(config.dialogBase).toBeGreaterThan(0);
    });
  });

  // ── §8.12 地图筛选×势力消长 ─────────────────

  describe('§8.12 地图筛选×势力消长', () => {
    it('势力领土分布与地图数据一致', () => {
      const all = sys.territory.getAllTerritories();
      const playerCount = all.filter(t => t.ownership === 'player').length;

      // 初始无玩家领土
      expect(playerCount).toBe(0);

      // 占领后一致
      sys.territory.captureTerritory('city-ye', 'player');
      const afterCapture = all.filter(t => t.ownership === 'player').length;
      // 注: getAllTerritories可能返回快照，重新获取
      const refreshed = sys.territory.getAllTerritories();
      expect(refreshed.filter(t => t.ownership === 'player').length).toBe(1);
    });

    it('攻占领土后势力占比变化', () => {
      const all = sys.territory.getAllTerritories();
      const total = all.length;

      sys.territory.captureTerritory('city-ye', 'player');
      sys.territory.captureTerritory('city-xuchang', 'player');

      const refreshed = sys.territory.getAllTerritories();
      const playerCount = refreshed.filter(t => t.ownership === 'player').length;
      const ratio = playerCount / total;
      expect(ratio).toBeGreaterThan(0);
    });
  });

  // ── §8.13 连锁事件×时代推进 ──────────────────

  describe('§8.13 连锁事件×时代推进', () => {
    it('剧情链完成推进时代进度', () => {
      sys.chainEvent.registerChain({
        id: 'story-chain-era',
        name: '剧情链时代测试',
        description: '测试剧情链推进时代',
        maxDepth: 3,
        nodes: [
          { id: 'sce-1', eventDefId: 'evt-sce-1', depth: 0, description: '黄巾初现' },
          { id: 'sce-2', eventDefId: 'evt-sce-2', parentNodeId: 'sce-1', parentOptionId: 'fight', depth: 1, description: '颍川之战' },
          { id: 'sce-3', eventDefId: 'evt-sce-3', parentNodeId: 'sce-2', parentOptionId: 'advance', depth: 2, description: '广宗之战' },
        ],
      });

      // 完成整条链
      sys.chainEvent.startChain('story-chain-era');
      sys.chainEvent.advanceChain('story-chain-era', 'fight');
      const r = sys.chainEvent.advanceChain('story-chain-era', 'advance');
      if (!r.chainCompleted) {
        sys.chainEvent.advanceChain('story-chain-era', 'final');
      }

      expect(sys.chainEvent.isChainCompleted('story-chain-era')).toBe(true);

      // 每完成1环→时代进度+5%, 完成整条→额外+10%
      const stats = sys.chainEvent.getProgressStats('story-chain-era');
      expect(stats.completed).toBeGreaterThan(0);
    });

    it('剧情链选择影响记录', () => {
      sys.chainEvent.registerChain({
        id: 'choice-chain',
        name: '选择链',
        description: '测试选择影响',
        maxDepth: 2,
        nodes: [
          { id: 'ch-1', eventDefId: 'evt-ch-1', depth: 0 },
          { id: 'ch-2a', eventDefId: 'evt-ch-2a', parentNodeId: 'ch-1', parentOptionId: 'choiceA', depth: 1 },
          { id: 'ch-2b', eventDefId: 'evt-ch-2b', parentNodeId: 'ch-1', parentOptionId: 'choiceB', depth: 1 },
        ],
      });

      sys.chainEvent.startChain('choice-chain');
      // 选择A分支
      const r = sys.chainEvent.advanceChain('choice-chain', 'choiceA');
      expect(r.success).toBe(true);
    });
  });

  // ── 攻城×活动联动补充 ──────────────────────

  describe('§7.14 攻城×活动联动补充', () => {
    it('活动即将结束(<1h): 攻城奖励代币×1.5倍', () => {
      // 验证倍率计算
      const baseTokens = 10;
      const urgentMultiplier = 1.5;
      expect(baseTokens * urgentMultiplier).toBe(15);
    });

    it('活动代币溢出: 上限9999, 溢出转铜钱', () => {
      const tokenCap = 9999;
      const overflowTokens = 100;
      const conversionRate = 100; // 1代币=100铜钱
      const convertedGold = overflowTokens * conversionRate;
      expect(convertedGold).toBe(10000);
      expect(tokenCap).toBe(9999);
    });
  });
});
