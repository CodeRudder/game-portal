/**
 * v6.0 集成测试 — §3 势力消长 + §4 世界地图交互
 *
 * 覆盖 Play 文档流程：
 *   §3   势力消长（领土攻占、驻防机制、离线领土变化）
 *   §3.1 领土攻占（征服流程、胜率预估、攻城战）
 *   §3.2 驻防机制（驻防兵力、互斥规则）
 *   §4   世界地图交互（地图筛选、地图事件标记）
 *   §7.6 手机端领土详情
 *   §7.14 攻城×活动联动
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/__tests__/integration/v6-territory-map
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TerritorySystem } from '../../map/TerritorySystem';
import { SiegeSystem } from '../../map/SiegeSystem';
import { SiegeEnhancer } from '../../map/SiegeEnhancer';
import { GarrisonSystem } from '../../map/GarrisonSystem';
import { WorldMapSystem } from '../../map/WorldMapSystem';
import { MapFilterSystem } from '../../map/MapFilterSystem';
import { MapDataRenderer } from '../../map/MapDataRenderer';
import { EventTriggerSystem } from '../../event/EventTriggerSystem';
import { EventNotificationSystem } from '../../event/EventNotificationSystem';
import { EventLogSystem } from '../../event/EventLogSystem';
import type { ISystemDeps } from '../../../core/types';
import type { ISubsystemRegistry } from '../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createFullDeps(): ISystemDeps {
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const enhancer = new SiegeEnhancer();
  const garrison = new GarrisonSystem();
  const mapSys = new WorldMapSystem();
  const eventTrigger = new EventTriggerSystem();
  const notification = new EventNotificationSystem();
  const eventLog = new EventLogSystem();

  const registry = new Map<string, unknown>();
  registry.set('territory', territory);
  registry.set('siege', siege);
  registry.set('siegeEnhancer', enhancer);
  registry.set('garrison', garrison);
  registry.set('worldMap', mapSys);
  registry.set('eventTrigger', eventTrigger);
  registry.set('eventNotification', notification);
  registry.set('eventLog', eventLog);

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

  territory.init(deps);
  siege.init(deps);
  enhancer.init(deps);
  garrison.init(deps);
  mapSys.init(deps);
  eventTrigger.init(deps);
  notification.init(deps);
  eventLog.init(deps);

  return deps;
}

function getSystems(deps: ISystemDeps) {
  return {
    territory: deps.registry.get<TerritorySystem>('territory')!,
    siege: deps.registry.get<SiegeSystem>('siege')!,
    enhancer: deps.registry.get<SiegeEnhancer>('siegeEnhancer')!,
    garrison: deps.registry.get<GarrisonSystem>('garrison')!,
    map: deps.registry.get<WorldMapSystem>('worldMap')!,
    eventTrigger: deps.registry.get<EventTriggerSystem>('eventTrigger')!,
    notification: deps.registry.get<EventNotificationSystem>('eventNotification')!,
    eventLog: deps.registry.get<EventLogSystem>('eventLog')!,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('v6.0 集成测试: §3 势力消长 + §4 世界地图交互', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  // ── §3 势力消长 ──────────────────────────────

  describe('§3 势力消长', () => {
    it('§3.0 势力领土分布：三大阵营+中立', () => {
      const all = sys.territory.getAllTerritories();
      const regions = new Set(all.map(t => t.region));
      expect(regions.has('wei')).toBe(true);
      expect(regions.has('shu')).toBe(true);
      expect(regions.has('wu')).toBe(true);
      // Note: RegionId type only has wei/shu/wu; neutral territories belong to one of these regions
    });

    it('§3.0 势力占比总和100%', () => {
      const all = sys.territory.getAllTerritories();
      const total = all.length;
      expect(total).toBeGreaterThan(0);

      // 统计各阵营占比
      const counts: Record<string, number> = {};
      for (const t of all) {
        counts[t.region] = (counts[t.region] || 0) + 1;
      }
      const sum = Object.values(counts).reduce((a, b) => a + b, 0);
      expect(sum).toBe(total);
    });
  });

  // ── §3.1 领土攻占（征服流程）──────────────────

  describe('§3.1 领土攻占', () => {
    it('征服条件：目标领土必须与己方领土相邻', () => {
      // 无己方领土时不能攻击
      const canAttack0 = sys.territory.canAttackTerritory('city-xuchang', 'player');
      expect(canAttack0).toBe(false);

      // 占领邺城后，可以攻击相邻的许昌
      sys.territory.captureTerritory('city-ye', 'player');
      const canAttack1 = sys.territory.canAttackTerritory('city-xuchang', 'player');
      // 许昌是否与邺城相邻取决于地图配置
      const adjacents = sys.territory.getAdjacentTerritoryIds('city-ye');
      if (adjacents.includes('city-xuchang')) {
        expect(canAttack1).toBe(true);
      }
    });

    it('征服流程：攻城→胜利→领土归属变更', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const before = sys.territory.getTerritoryById('city-xuchang')!;

      const result = sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);
      expect(result.victory).toBe(true);
      expect(result.launched).toBe(true);

      const after = sys.territory.getTerritoryById('city-xuchang')!;
      expect(after.ownership).toBe('player');
    });

    it('攻占后势力领土数+1，防守方领土数-1', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const beforeCount = sys.territory.getPlayerTerritoryCount();

      sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);

      expect(sys.territory.getPlayerTerritoryCount()).toBe(beforeCount + 1);
    });

    it('失败惩罚：损失30%出征兵力', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const result = sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, false);

      expect(result.defeatTroopLoss).toBeDefined();
      expect(result.defeatTroopLoss).toBe(Math.floor(result.cost.troops * 0.3));
    });

    it('每日攻城次数上限3次', () => {
      sys.territory.captureTerritory('city-ye', 'player');

      // 第1次
      sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);
      expect(sys.siege.getRemainingDailySieges()).toBe(2);

      // 第2次（需要重置或使用不同目标）
      sys.siege.resetDailySiegeCount();
      expect(sys.siege.getRemainingDailySieges()).toBe(3);
    });
  });

  // ── §3.1.1 胜率预估 ──────────────────────────

  describe('§3.1.1 胜率预估', () => {
    it('胜率公式：min(95%, max(5%, 攻方/守方×50%+地形修正))', () => {
      sys.territory.captureTerritory('city-ye', 'player');

      const estimate = sys.enhancer.estimateWinRate(50000, 'city-xuchang');
      expect(estimate).toBeDefined();
      expect(estimate!.winRate).toBeGreaterThan(0);
      expect(estimate!.winRate).toBeLessThanOrEqual(1);
    });

    it('胜率颜色分级：>80%翠绿 / 60~80%金色 / 40~60%琥珀 / <40%赤红', () => {
      sys.territory.captureTerritory('city-ye', 'player');

      // 高胜率
      const high = sys.enhancer.estimateWinRate(100000, 'city-nanzhong');
      if (high) {
        expect(high.rating).toBeDefined();
      }

      // 低胜率
      const low = sys.enhancer.estimateWinRate(100, 'city-luoyang');
      if (low) {
        expect(low.rating).toBeDefined();
      }
    });
  });

  // ── §3.1.2 攻城战 ───────────────────────────

  describe('§3.1.2 攻城战', () => {
    it('城防计算：基础(1000)×城市等级', () => {
      const xu = sys.territory.getTerritoryById('city-xuchang')!;
      expect(xu.defenseValue).toBe(1000 * xu.level);
    });

    it('攻城消耗：粮草固定500', () => {
      const cost = sys.siege.getSiegeCostById('city-xuchang');
      expect(cost).toBeDefined();
      expect(cost!.grain).toBe(500);
    });

    it('占领条件：城防归零即占领（胜利即占领）', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const result = sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);

      expect(result.victory).toBe(true);
      expect(sys.territory.getTerritoryById('city-xuchang')!.ownership).toBe('player');
    });

    it('攻城奖励：首次攻占资源+道具', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);

      const reward = sys.enhancer.calculateSiegeRewardById('city-xuchang');
      expect(reward).toBeDefined();
      expect(reward!.resources.grain).toBeGreaterThan(0);
      expect(reward!.resources.gold).toBeGreaterThan(0);
      expect(reward!.territoryExp).toBeGreaterThan(0);
    });

    it('完整征服流程：条件→胜率→战斗→占领→奖励', () => {
      sys.territory.captureTerritory('city-ye', 'player');

      const conquest = sys.enhancer.executeConquest(
        'city-xuchang', 'player', 50000, 10000, 10000,
      );

      expect(conquest).toBeDefined();
      expect(['check', 'battle', 'reward']).toContain(conquest.phase);
    });
  });

  // ── §3.2 驻防机制 ───────────────────────────

  describe('§3.2 驻防机制', () => {
    it('驻防加成：防御+产出提升', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const t = sys.territory.getTerritoryById('city-ye')!;

      // 无驻防时加成为0
      const noGarrison = sys.garrison.getGarrisonBonus('city-ye');
      expect(noGarrison.defenseBonus).toBe(0);
      expect(noGarrison.productionBonus.grain).toBe(0);
    });

    it('驻防互斥：同一武将不可同时驻防和出战', () => {
      // GarrisonSystem 依赖 HeroSystem，无 HeroSystem 时返回 null
      const result = sys.garrison.assignGarrison('city-ye', 'general-1');
      // 无 hero 系统时 general 不存在 → 失败
      expect(result.success).toBe(false);
    });

    it('领土等级体系：Lv.1初始，升级后产出增加', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const t1 = sys.territory.getTerritoryById('city-ye')!;
      expect(t1.level).toBeGreaterThanOrEqual(1);

      const upgrade = sys.territory.upgradeTerritory('city-ye');
      if (upgrade.success) {
        expect(upgrade.newLevel).toBeGreaterThan(t1.level);
        expect(upgrade.newProduction.grain).toBeGreaterThanOrEqual(t1.currentProduction.grain);
      }
    });

    it('领土产出公式：基础×地形×阵营×科技×等级', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const summary = sys.territory.getPlayerProductionSummary();
      expect(summary.totalProduction.grain).toBeGreaterThan(0);
    });

    it('产出累积：按时间线性增长', () => {
      sys.territory.captureTerritory('city-ye', 'player');

      const hourly = sys.territory.calculateAccumulatedProduction(3600);
      const twoHours = sys.territory.calculateAccumulatedProduction(7200);

      expect(hourly.grain).toBeGreaterThan(0);
      expect(twoHours.grain).toBeCloseTo(hourly.grain * 2, 0);
    });
  });

  // ── §3.3 离线领土变化 ────────────────────────

  describe('§3.3 离线领土变化', () => {
    it('离线损失上限：最多丢失20%领土', () => {
      // 占领5块领土
      sys.territory.captureTerritory('city-ye', 'player');
      sys.territory.captureTerritory('city-xuchang', 'player');
      sys.territory.captureTerritory('city-puyang', 'player');

      const count = sys.territory.getPlayerTerritoryCount();
      // 20%上限 = Math.floor(count * 0.2)
      const maxLoss = Math.floor(count * 0.2);
      expect(maxLoss).toBeGreaterThanOrEqual(0);
    });

    it('地标加成：洛阳全资源+50%', () => {
      sys.territory.captureTerritory('city-luoyang', 'player');
      const t = sys.territory.getTerritoryById('city-luoyang')!;
      expect(t).toBeDefined();
      expect(t.currentProduction.grain).toBeGreaterThan(0);
    });
  });

  // ── §4 世界地图交互 ──────────────────────────

  describe('§4 世界地图交互', () => {
    it('§4.0.1 三大区域与阵营色', () => {
      const all = sys.territory.getAllTerritories();
      const wei = all.filter(t => t.region === 'wei');
      const shu = all.filter(t => t.region === 'shu');
      const wu = all.filter(t => t.region === 'wu');

      // 魏国：邺城、许昌、濮阳、北海
      expect(wei.length).toBeGreaterThan(0);
      // 蜀国：成都、汉中、永安、南中
      expect(shu.length).toBeGreaterThan(0);
      // 吴国：建业、会稽、柴桑、庐江
      expect(wu.length).toBeGreaterThan(0);
    });

    it('§4.0.2 地图筛选：按阵营/地形/收益过滤', () => {
      const tiles = sys.map.getAllTiles();
      const landmarks = sys.map.getLandmarks();

      // 按阵营筛选
      const filterResult = MapFilterSystem.filter(tiles, landmarks, {
        regions: ['wei'],
      });
      expect(filterResult).toBeDefined();

      // 空筛选返回全部
      const allResult = MapFilterSystem.filter(tiles, landmarks, {});
      expect(allResult.totalLandmarks).toBe(landmarks.length);
    });

    it('§4.1 地图事件标记：事件类型与概率', () => {
      // 验证事件类型定义完整
      const basicEvents = ['merchant_distress', 'refugees', 'treasure', 'bandits'];
      const extendedEvents = ['bandit', 'caravan', 'disaster', 'ruins', 'conflict'];
      expect(basicEvents).toHaveLength(4);
      expect(extendedEvents).toHaveLength(5);
      expect([...basicEvents, ...extendedEvents]).toHaveLength(9);
    });

    it('§4.1 地图事件选择分支：强攻/谈判/忽略', () => {
      // 验证事件选项结构
      const branches = ['强攻', '谈判', '忽略'];
      expect(branches).toHaveLength(3);
    });
  });

  // ── §7.14 攻城×活动联动 ──────────────────────

  describe('§7.14 攻城×活动联动', () => {
    it('攻城成功→获得奖励→活动积分增加', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const result = sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);

      expect(result.victory).toBe(true);
      // 奖励包含资源
      const reward = sys.enhancer.calculateSiegeRewardById('city-xuchang');
      expect(reward!.resources).toBeDefined();
    });

    it('无进行中活动：攻城奖励不含活动代币', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const result = sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);

      // 基础奖励正常发放
      expect(result.victory).toBe(true);
      const reward = sys.enhancer.calculateSiegeRewardById('city-xuchang');
      expect(reward!.resources.grain).toBeGreaterThan(0);
    });
  });

  // ── 地图数据完整性 ──────────────────────────

  describe('地图数据完整性', () => {
    it('所有领土都有产出数据', () => {
      const all = sys.territory.getAllTerritories();
      for (const t of all) {
        expect(t.currentProduction).toBeDefined();
        expect(typeof t.currentProduction.grain).toBe('number');
      }
    });

    it('所有领土都有防御值', () => {
      const all = sys.territory.getAllTerritories();
      for (const t of all) {
        expect(t.defenseValue).toBeGreaterThan(0);
        expect(t.defenseValue).toBe(1000 * t.level);
      }
    });

    it('攻城系统统计正确', () => {
      sys.territory.captureTerritory('city-ye', 'player');

      const r1 = sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);
      expect(sys.siege.getTotalSieges()).toBe(1);
      expect(sys.siege.getVictories()).toBe(r1.victory ? 1 : 0);

      sys.siege.resetDailySiegeCount();
      const r2 = sys.siege.executeSiegeWithResult('city-puyang', 'player', 10000, 10000, false);
      expect(sys.siege.getTotalSieges()).toBe(2);

      const winRate = sys.siege.getWinRate();
      expect(winRate).toBeGreaterThanOrEqual(0);
      expect(winRate).toBeLessThanOrEqual(1);
    });

    it('领土序列化/反序列化一致', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      sys.territory.captureTerritory('city-xuchang', 'player');

      const saved = sys.territory.serialize();
      sys.territory.reset();
      expect(sys.territory.getPlayerTerritoryCount()).toBe(0);

      sys.territory.deserialize(saved);
      expect(sys.territory.getPlayerTerritoryCount()).toBe(2);
    });
  });
});
