/**
 * E2E 地图流程集成测试
 *
 * 测试 E1-1~E1-6 全流程
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SiegeSystem } from '../../SiegeSystem';
import { ExpeditionSystem } from '../../ExpeditionSystem';
import { MarchingSystem } from '../../MarchingSystem';
import { OfflineEventSystem } from '../../OfflineEventSystem';
import {
  findPathBetweenCities,
  extractWaypoints,
} from '../../PathfindingSystem';
import type { WalkabilityGrid } from '../../../../core/map/territory-config';
import type { TerritoryData, OwnershipStatus } from '../../../../core/map';

// 模拟领土数据
const createMockTerritory = (id: string, overrides?: Partial<TerritoryData>): TerritoryData => ({
  id,
  name: `Territory ${id}`,
  level: 3,
  ownership: 'neutral' as OwnershipStatus,
  defenseValue: 1000,
  position: { x: 50, y: 30 },
  type: 'city',
  region: 'central',
  currentProduction: { grain: 10, gold: 10, troops: 5, mandate: 2 },
  ...overrides,
});

describe('E2E 地图流程集成测试', () => {
  let siegeSystem: SiegeSystem;
  let expeditionSystem: ExpeditionSystem;
  let mockTerritories: Map<string, TerritoryData>;
  let mockDeps: any;

  beforeEach(() => {
    mockTerritories = new Map();
    mockTerritories.set('city-luoyang', createMockTerritory('city-luoyang', { ownership: 'player' }));
    mockTerritories.set('city-changan', createMockTerritory('city-changan', { ownership: 'enemy' }));
    mockTerritories.set('city-ye', createMockTerritory('city-ye', { ownership: 'neutral' }));

    mockDeps = {
      eventBus: { emit: vi.fn() },
      registry: {
        get: vi.fn((name: string) => {
          if (name === 'territory') {
            return {
              getTerritoryById: (id: string) => mockTerritories.get(id),
              canAttackTerritory: (targetId: string, owner: OwnershipStatus) => {
                const territory = mockTerritories.get(targetId);
                return territory && territory.ownership !== owner;
              },
              captureTerritory: vi.fn(),
            };
          }
          if (name === 'expedition') {
            return expeditionSystem;
          }
          return null;
        }),
      },
      resource: {
        getAmount: vi.fn(() => 10000),
        consumeResource: vi.fn(),
      },
    };

    siegeSystem = new SiegeSystem();
    siegeSystem.init(mockDeps);

    expeditionSystem = new ExpeditionSystem();
    expeditionSystem.init(mockDeps);
    expeditionSystem.setExpeditionDeps({
      getHero: vi.fn((id: string) => ({ id, name: `Hero ${id}` })),
      getAvailableTroops: vi.fn(() => 5000),
      consumeTroops: vi.fn((amount: number) => true),
      isHeroInFormation: vi.fn(() => true),
    });
  });

  describe('E1-1: 启动→天下Tab→像素地图', () => {
    it('应该正确初始化领土数据', () => {
      const territories = Array.from(mockTerritories.values());
      expect(territories.length).toBe(3);
      expect(territories.find(t => t.id === 'city-luoyang')?.ownership).toBe('player');
      expect(territories.find(t => t.id === 'city-changan')?.ownership).toBe('enemy');
    });
  });

  describe('E1-2: 点击城市→攻城→结果', () => {
    it('应该完成攻城流程', () => {
      // 创建编队
      const { forceId } = expeditionSystem.createForce({ heroId: 'hero-1', troops: 2000 });
      expect(forceId).toBeDefined();

      // 执行攻城
      const result = siegeSystem.executeSiegeWithExpedition(
        forceId!,
        'city-changan',
        'player' as OwnershipStatus,
        500,
      );

      // 验证结果
      expect(result.launched).toBe(true);
      expect(result.cost.troops).toBeGreaterThan(0);
      expect(result.casualties).toBeDefined();
    });
  });

  describe('E1-3: 行军→寻路→精灵→到达→触发事件', () => {
    /** 构建连接洛阳→许昌的模拟可行走网格(含道路) */
    function createMarchTestGrid(): WalkabilityGrid {
      const rows = 60;
      const cols = 100;
      const grid: boolean[][] = [];
      for (let y = 0; y < rows; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < cols; x++) {
          row.push(false);
        }
        grid.push(row);
      }
      // 洛阳 (50, 23) 和 许昌 (37, 26)
      grid[23][50] = true;
      grid[26][37] = true;
      // 铺设道路: 洛阳→向左→向下→许昌
      for (let x = 37; x <= 50; x++) grid[23][x] = true;
      for (let y = 23; y <= 26; y++) grid[y][37] = true;
      return grid;
    }

    it('应该完成寻路→路线计算→行军创建→到达→触发事件 全流程', () => {
      const grid = createMarchTestGrid();

      // 1. A* 寻路：洛阳 → 许昌
      const rawPath = findPathBetweenCities('city-luoyang', 'city-xuchang', grid);
      expect(rawPath.length).toBeGreaterThan(0);
      expect(rawPath[0]).toEqual({ x: 50, y: 23 });
      expect(rawPath[rawPath.length - 1]).toEqual({ x: 37, y: 26 });

      // 2. 提取转折点
      const waypoints = extractWaypoints(rawPath);
      expect(waypoints.length).toBeGreaterThanOrEqual(2);
      expect(waypoints[0]).toEqual(rawPath[0]);
      expect(waypoints[waypoints.length - 1]).toEqual(rawPath[rawPath.length - 1]);

      // 3. MarchingSystem 路线计算
      const marchingSystem = new MarchingSystem();
      const marchEmitSpy = vi.fn();
      marchingSystem.init({
        eventBus: { emit: marchEmitSpy, on: vi.fn(), off: vi.fn(), once: vi.fn() },
        config: { get: vi.fn() },
        registry: { get: vi.fn(), register: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
      } as any);
      marchingSystem.setWalkabilityGrid(grid);

      const route = marchingSystem.calculateMarchRoute('city-luoyang', 'city-xuchang');
      expect(route).not.toBeNull();
      expect(route!.path.length).toBeGreaterThan(0);
      expect(route!.distance).toBeGreaterThan(0);
      expect(route!.estimatedTime).toBeGreaterThan(0);
      expect(route!.waypoints.length).toBeGreaterThanOrEqual(2);

      // 4. 创建行军单位（使用像素坐标路径）
      const pixelPath = rawPath.map(p => ({ x: p.x * 32, y: p.y * 32 }));
      const march = marchingSystem.createMarch(
        'city-luoyang', 'city-xuchang',
        2000, '关羽', 'shu',
        pixelPath,
      );
      expect(march.state).toBe('preparing');
      expect(march.troops).toBe(2000);
      expect(march.general).toBe('关羽');
      expect(marchEmitSpy).toHaveBeenCalledWith('march:created', expect.objectContaining({
        fromCityId: 'city-luoyang',
        toCityId: 'city-xuchang',
      }));

      // 5. 启动行军
      marchingSystem.startMarch(march.id);
      expect(march.state).toBe('marching');
      expect(marchEmitSpy).toHaveBeenCalledWith('march:started', expect.objectContaining({
        marchId: march.id,
      }));

      // 6. 模拟行军更新直到到达
      for (let i = 0; i < 200; i++) {
        marchingSystem.update(1);
        if (march.state === 'arrived') break;
      }

      // 7. 验证到达
      expect(march.state).toBe('arrived');
      expect(march.x).toBe(pixelPath[pixelPath.length - 1].x);
      expect(march.y).toBe(pixelPath[pixelPath.length - 1].y);
      expect(marchEmitSpy).toHaveBeenCalledWith('march:arrived', expect.objectContaining({
        marchId: march.id,
        cityId: 'city-xuchang',
        troops: 2000,
      }));
    });

    it('不可达城市应返回空路径', () => {
      // 仅标记两个城市位置，中间无道路 → 不可达
      const grid: boolean[][] = [];
      for (let y = 0; y < 60; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < 100; x++) row.push(false);
        grid.push(row);
      }
      grid[23][50] = true;  // 洛阳
      grid[49][12] = true;  // 成都

      const path = findPathBetweenCities('city-luoyang', 'city-chengdu', grid);
      expect(path).toEqual([]);
    });
  });

  describe('E1-4: 离线→上线→弹窗→领取→资源更新', () => {
    it('应该完成 离线时间检测→奖励计算→事件生成→领取→资源增加 全流程', () => {
      // 1. 初始化离线事件系统
      const offlineSystem = new OfflineEventSystem();
      const offlineEmitSpy = vi.fn();
      offlineSystem.init({
        eventBus: { emit: offlineEmitSpy, on: vi.fn(), off: vi.fn(), once: vi.fn() },
        config: { get: vi.fn() },
        registry: { get: vi.fn(), register: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
      } as any);

      // 2. 设置玩家拥有的城市（模拟玩家领土）
      offlineSystem.setCities([
        { id: 'city-luoyang', faction: 'player', level: 5 },
        { id: 'city-xuchang', faction: 'player', level: 3 },
        { id: 'city-changan', faction: 'enemy', level: 4 },
      ]);

      // 3. 模拟1小时离线时间
      const ONE_HOUR_MS = 3600 * 1000;
      (offlineSystem as any).lastOnlineTime = Date.now() - ONE_HOUR_MS;

      // 4. 处理离线时间（玩家上线时调用）
      const reward = offlineSystem.processOfflineTime();

      // 5. 验证离线时长正确计算
      expect(reward.offlineDuration).toBeGreaterThan(0);
      expect(reward.offlineDuration).toBeLessThanOrEqual(3600);

      // 6. 验证资源积累（player城市应产生资源）
      expect(reward.resources.gold).toBeGreaterThan(0);
      expect(reward.resources.grain).toBeGreaterThan(0);
      expect(reward.resources.troops).toBeGreaterThan(0);

      // 7. 验证事件列表非空
      expect(reward.events.length).toBeGreaterThan(0);

      // 8. 验证至少包含资源积累事件
      const resourceEvents = reward.events.filter(e => e.type === 'resource_accumulate');
      expect(resourceEvents.length).toBeGreaterThan(0);
      // 2个player城市 × 3种资源 = 6个资源积累事件
      expect(resourceEvents.length).toBe(6);

      // 9. 验证离线处理事件被触发（用于弹窗通知）
      expect(offlineEmitSpy).toHaveBeenCalledWith('offline:processed', expect.objectContaining({
        offlineDuration: expect.any(Number),
        eventCount: reward.events.length,
        resources: reward.resources,
      }));

      // 10. 模拟玩家逐个领取奖励
      const pendingEvents = offlineSystem.getPendingEvents();
      expect(pendingEvents.length).toBe(reward.events.length);

      // 逐个标记已处理
      for (const event of reward.events) {
        offlineSystem.markProcessed(event.id);
      }

      // 11. 验证所有事件已领取
      const remainingPending = offlineSystem.getPendingEvents();
      expect(remainingPending.length).toBe(0);

      // 12. 清除已处理事件
      offlineSystem.clearProcessed();

      // 13. 验证资源增量（玩家城市产出，非玩家城市无产出）
      // 洛阳 level=5: multiplier = 1 + (5-1)*0.2 = 1.8
      // 许昌 level=3: multiplier = 1 + (3-1)*0.2 = 1.4
      // gold rate = 0.5/s, 1h = 3600s
      // 洛阳 gold = floor(0.5 * 3600 * 1.8) = 3240
      // 许昌 gold = floor(0.5 * 3600 * 1.4) = 2520
      // total gold >= 3240 + 2520 = 5760
      expect(reward.resources.gold).toBeGreaterThanOrEqual(5760);
    });

    it('短时间离线不应产生奖励', () => {
      const offlineSystem = new OfflineEventSystem();
      offlineSystem.init({
        eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn() },
        config: { get: vi.fn() },
        registry: { get: vi.fn(), register: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
      } as any);

      offlineSystem.setCities([{ id: 'city-luoyang', faction: 'player', level: 5 }]);

      // 模拟5秒离线（阈值10秒以内）
      (offlineSystem as any).lastOnlineTime = Date.now() - 5000;
      const reward = offlineSystem.processOfflineTime();

      expect(reward.offlineDuration).toBe(0);
      expect(reward.resources).toEqual({});
      expect(reward.events).toEqual([]);
    });

    it('离线奖励上限为24小时', () => {
      const offlineSystem = new OfflineEventSystem();
      offlineSystem.init({
        eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn() },
        config: { get: vi.fn() },
        registry: { get: vi.fn(), register: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
      } as any);

      offlineSystem.setCities([{ id: 'city-luoyang', faction: 'player', level: 1 }]);

      // 模拟48小时离线
      (offlineSystem as any).lastOnlineTime = Date.now() - 48 * 3600 * 1000;
      const reward = offlineSystem.processOfflineTime();

      expect(reward.offlineDuration).toBeLessThanOrEqual(86400);
    });
  });

  describe('E1-5: 存档→读档', () => {
    it('应该支持编队系统序列化', () => {
      // 创建编队
      expeditionSystem.createForce({ heroId: 'hero-1', troops: 1000 });
      expeditionSystem.createForce({ heroId: 'hero-2', troops: 500 });

      // 序列化
      const saved = expeditionSystem.serialize();
      expect(Object.keys(saved.forces).length).toBe(2);

      // 反序列化
      expeditionSystem.reset();
      expeditionSystem.deserialize(saved);

      // 验证恢复
      expect(expeditionSystem.getAllForces().length).toBe(2);
    });

    it('应该支持攻城系统序列化', () => {
      // 执行攻城
      const { forceId } = expeditionSystem.createForce({ heroId: 'hero-1', troops: 2000 });
      siegeSystem.executeSiegeWithExpedition(
        forceId!,
        'city-changan',
        'player' as OwnershipStatus,
        500,
      );

      // 序列化
      const saved = siegeSystem.serialize();
      expect(saved.totalSieges).toBe(1);

      // 反序列化
      siegeSystem.reset();
      siegeSystem.deserialize(saved);

      // 验证恢复
      expect(siegeSystem.getTotalSieges()).toBe(1);
    });
  });

  describe('E1-6: 全链路无报错', () => {
    it('应该完成全流程', () => {
      // 1. 初始化
      const territories = Array.from(mockTerritories.values());
      expect(territories.length).toBe(3);

      // 2. 创建编队
      const { forceId } = expeditionSystem.createForce({ heroId: 'hero-1', troops: 2000 });
      expect(forceId).toBeDefined();

      // 3. 执行攻城
      const result = siegeSystem.executeSiegeWithExpedition(
        forceId!,
        'city-changan',
        'player' as OwnershipStatus,
        500,
      );
      expect(result.launched).toBe(true);

      // 4. 验证伤亡
      expect(result.casualties).toBeDefined();
      expect(result.casualties!.troopsLost).toBeGreaterThanOrEqual(0);

      // 5. 序列化
      const expeditionSaved = expeditionSystem.serialize();
      const siegeSaved = siegeSystem.serialize();
      expect(expeditionSaved).toBeDefined();
      expect(siegeSaved).toBeDefined();

      // 6. 反序列化
      expeditionSystem.reset();
      siegeSystem.reset();
      expeditionSystem.deserialize(expeditionSaved);
      siegeSystem.deserialize(siegeSaved);

      // 7. 验证恢复
      expect(expeditionSystem.getAllForces().length).toBeGreaterThan(0);
      expect(siegeSystem.getTotalSieges()).toBe(1);
    });
  });
});
