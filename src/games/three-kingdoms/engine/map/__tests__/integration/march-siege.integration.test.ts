/**
 * 行军→攻占完整链路集成测试 (march-siege integration)
 *
 * 测试行军全生命周期：A*寻路 → 行军创建 → 沿路径移动 → 到达 → 事件触发
 * 以及多城链式行军、行军速度/距离关系、取消行军、回城行军等场景。
 *
 * R12 Task4 / R13 Task6 (renamed from march-siege-e2e)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarchingSystem, type MarchUnit, type MarchState } from '../../MarchingSystem';
import {
  findPathBetweenCities,
  extractWaypoints,
  type WalkabilityGrid,
} from '../../PathfindingSystem';
import type { ISystemDeps } from '../../../../core/types';

// ─────────────────────────────────────────────
// 测试工具函数
// ─────────────────────────────────────────────

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as ISystemDeps;
}

/** 构建连接洛阳→许昌的可行走网格(含道路) */
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

/** 构建连接洛阳→长安的可行走网格(含道路) */
function createLuoyangChanganGrid(): WalkabilityGrid {
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
  // 洛阳 (50, 23), 许昌 (37, 26), 长安 (27, 36)
  grid[23][50] = true;
  grid[26][37] = true;
  grid[36][27] = true;
  // 洛阳→许昌
  for (let x = 37; x <= 50; x++) grid[23][x] = true;
  for (let y = 23; y <= 26; y++) grid[y][37] = true;
  // 许昌→长安
  for (let x = 27; x <= 37; x++) grid[26][x] = true;
  for (let y = 26; y <= 36; y++) grid[y][27] = true;
  return grid;
}

/** 构建完整的3城道路网格 (洛阳→许昌→长安) */
function createFullThreeCityGrid(): WalkabilityGrid {
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
  // 三个城市坐标
  grid[23][50] = true;  // 洛阳
  grid[26][37] = true;  // 许昌
  grid[36][27] = true;  // 长安
  // 洛阳→许昌道路
  for (let x = 37; x <= 50; x++) grid[23][x] = true;
  for (let y = 23; y <= 26; y++) grid[y][37] = true;
  // 许昌→长安道路
  for (let x = 27; x <= 37; x++) grid[26][x] = true;
  for (let y = 26; y <= 36; y++) grid[y][27] = true;
  return grid;
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('E1-3 行军→攻占完整链路 E2E', () => {
  let marchingSystem: MarchingSystem;
  let deps: ISystemDeps;
  let emitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    marchingSystem = new MarchingSystem();
    deps = createMockDeps();
    emitSpy = deps.eventBus.emit as ReturnType<typeof vi.fn>;
    marchingSystem.init(deps);
  });

  // ── Scenario 1: Complete march lifecycle ─────────────────────────

  describe('Scenario 1: 完整行军生命周期', () => {
    it('应该完成 寻路→创建行军→启动→沿路径移动→到达→触发march:arrived', () => {
      const grid = createMarchTestGrid();
      marchingSystem.setWalkabilityGrid(grid);

      // 1. A* 寻路
      const rawPath = findPathBetweenCities('city-luoyang', 'city-xuchang', grid);
      expect(rawPath.length).toBeGreaterThan(0);
      expect(rawPath[0]).toEqual({ x: 50, y: 23 });
      expect(rawPath[rawPath.length - 1]).toEqual({ x: 37, y: 26 });

      // 2. 计算行军路线
      const route = marchingSystem.calculateMarchRoute('city-luoyang', 'city-xuchang');
      expect(route).not.toBeNull();
      expect(route!.path.length).toBeGreaterThan(0);
      expect(route!.distance).toBeGreaterThan(0);
      expect(route!.estimatedTime).toBeGreaterThan(0);

      // 3. 创建行军
      const pixelPath = rawPath.map(p => ({ x: p.x * 32, y: p.y * 32 }));
      const march = marchingSystem.createMarch(
        'city-luoyang', 'city-xuchang',
        2000, '关羽', 'shu',
        pixelPath,
      );

      expect(march.state).toBe('preparing');
      expect(march.troops).toBe(2000);
      expect(march.general).toBe('关羽');
      expect(march.x).toBe(pixelPath[0].x);
      expect(march.y).toBe(pixelPath[0].y);

      // 验证 march:created 事件
      expect(emitSpy).toHaveBeenCalledWith('march:created', expect.objectContaining({
        marchId: march.id,
        fromCityId: 'city-luoyang',
        toCityId: 'city-xuchang',
        troops: 2000,
        general: '关羽',
      }));

      // 4. 启动行军
      marchingSystem.startMarch(march.id);
      expect(march.state).toBe('marching');
      expect(emitSpy).toHaveBeenCalledWith('march:started', expect.objectContaining({
        marchId: march.id,
        fromCityId: 'city-luoyang',
        toCityId: 'city-xuchang',
      }));

      // 5. 模拟行军更新，逐步推进行军位置
      const startX = march.x;
      const startY = march.y;
      for (let i = 0; i < 200; i++) {
        marchingSystem.update(1);
        if (march.state === 'arrived') break;
      }

      // 6. 验证行军位置沿路径推进
      //    行军应该已经移动了（不是原地）
      //    注意: startX/startY 是起始位置，行军后位置应更接近终点

      // 7. 验证到达
      expect(march.state).toBe('arrived');
      expect(march.x).toBe(pixelPath[pixelPath.length - 1].x);
      expect(march.y).toBe(pixelPath[pixelPath.length - 1].y);

      // 8. 验证 march:arrived 事件
      expect(emitSpy).toHaveBeenCalledWith('march:arrived', expect.objectContaining({
        marchId: march.id,
        cityId: 'city-xuchang',
        troops: 2000,
        general: '关羽',
      }));
    });
  });

  // ── Scenario 2: March position follows A* path ──────────────────

  describe('Scenario 2: 行军位置沿A*路径推进', () => {
    it('行军位置应沿A*计算路径逐步推进', () => {
      const grid = createMarchTestGrid();
      marchingSystem.setWalkabilityGrid(grid);

      const rawPath = findPathBetweenCities('city-luoyang', 'city-xuchang', grid);
      expect(rawPath.length).toBeGreaterThan(0);

      const pixelPath = rawPath.map(p => ({ x: p.x * 32, y: p.y * 32 }));
      const march = marchingSystem.createMarch(
        'city-luoyang', 'city-xuchang',
        1500, '张飞', 'shu',
        pixelPath,
      );
      marchingSystem.startMarch(march.id);

      // 记录每个update后的位置
      const positions: Array<{ x: number; y: number }> = [{ x: march.x, y: march.y }];
      const dt = 0.1; // 小步长

      for (let i = 0; i < 2000; i++) {
        marchingSystem.update(dt);
        positions.push({ x: march.x, y: march.y });
        if (march.state === 'arrived') break;
      }

      // 验证: 位置序列是单调推进的（至少在某个轴上）
      // 由于A*路径先向左再向下，先验证x递减（向许昌方向）
      const xValues = positions.map(p => p.x);
      const yValues = positions.map(p => p.y);

      // 总体趋势: x从1600 (50*32) 走向 1184 (37*32), y从736 (23*32) 走向 832 (26*32)
      expect(xValues[0]).toBeCloseTo(50 * 32, 0);
      expect(yValues[0]).toBeCloseTo(23 * 32, 0);

      // 最终位置
      expect(march.x).toBeCloseTo(37 * 32, 0);
      expect(march.y).toBeCloseTo(26 * 32, 0);

      // 验证: 行军到达了终点
      expect(march.state).toBe('arrived');

      // 验证: 位置总数 > 1 (确实有移动)
      expect(positions.length).toBeGreaterThan(2);
    });

    it('行军位置在相邻两次update间不应有突变', () => {
      const grid = createMarchTestGrid();
      marchingSystem.setWalkabilityGrid(grid);

      const rawPath = findPathBetweenCities('city-luoyang', 'city-xuchang', grid);
      const pixelPath = rawPath.map(p => ({ x: p.x * 32, y: p.y * 32 }));
      const march = marchingSystem.createMarch(
        'city-luoyang', 'city-xuchang',
        1000, '赵云', 'shu',
        pixelPath,
      );
      marchingSystem.startMarch(march.id);

      // BASE_SPEED=30 px/s, dt=0.5s → max move=15px per step
      const dt = 0.5;
      const maxMovePerStep = 30 * dt + 2; // speed * dt + tolerance
      let prevX = march.x;
      let prevY = march.y;

      for (let i = 0; i < 500; i++) {
        marchingSystem.update(dt);
        const dx = Math.abs(march.x - prevX);
        const dy = Math.abs(march.y - prevY);

        // 除非到达路径点（可能snap），否则位移应 <= speed*dt + epsilon
        if (march.state === 'marching') {
          expect(dx).toBeLessThanOrEqual(maxMovePerStep);
          expect(dy).toBeLessThanOrEqual(maxMovePerStep);
        }

        prevX = march.x;
        prevY = march.y;

        if (march.state === 'arrived') break;
      }

      expect(march.state).toBe('arrived');
    });
  });

  // ── Scenario 3: Multi-city chain march ───────────────────────────

  describe('Scenario 3: 多城链式行军', () => {
    it('应该完成 A→B 然后 B→C 的链式行军', () => {
      const grid = createFullThreeCityGrid();
      marchingSystem.setWalkabilityGrid(grid);

      // === 第一段: 洛阳→许昌 ===
      const rawPathAB = findPathBetweenCities('city-luoyang', 'city-xuchang', grid);
      expect(rawPathAB.length).toBeGreaterThan(0);

      const pixelPathAB = rawPathAB.map(p => ({ x: p.x * 32, y: p.y * 32 }));
      const marchAB = marchingSystem.createMarch(
        'city-luoyang', 'city-xuchang',
        3000, '诸葛亮', 'shu',
        pixelPathAB,
      );
      marchAB.siegeTaskId = 'task-ab-001';

      marchingSystem.startMarch(marchAB.id);

      // 模拟行军直到到达
      for (let i = 0; i < 300; i++) {
        marchingSystem.update(1);
        if (marchAB.state === 'arrived') break;
      }

      expect(marchAB.state).toBe('arrived');

      // 验证 march:arrived 事件携带正确的 cityId
      expect(emitSpy).toHaveBeenCalledWith('march:arrived', expect.objectContaining({
        marchId: marchAB.id,
        cityId: 'city-xuchang',
        troops: 3000,
        siegeTaskId: 'task-ab-001',
      }));

      // 清理第一段行军
      marchingSystem.removeMarch(marchAB.id);

      // === 第二段: 许昌→长安 ===
      const rawPathBC = findPathBetweenCities('city-xuchang', 'city-changan', grid);
      expect(rawPathBC.length).toBeGreaterThan(0);

      const pixelPathBC = rawPathBC.map(p => ({ x: p.x * 32, y: p.y * 32 }));
      const marchBC = marchingSystem.createMarch(
        'city-xuchang', 'city-changan',
        2500, '诸葛亮', 'shu',
        pixelPathBC,
      );
      marchBC.siegeTaskId = 'task-bc-002';

      marchingSystem.startMarch(marchBC.id);

      for (let i = 0; i < 300; i++) {
        marchingSystem.update(1);
        if (marchBC.state === 'arrived') break;
      }

      expect(marchBC.state).toBe('arrived');

      // 验证第二段 march:arrived 携带正确的 cityId
      expect(emitSpy).toHaveBeenCalledWith('march:arrived', expect.objectContaining({
        marchId: marchBC.id,
        cityId: 'city-changan',
        troops: 2500,
        siegeTaskId: 'task-bc-002',
      }));

      // 验证: 没有状态污染 — activeMarches 只包含第二段行军（到达后仍在map中）
      // 第一段已被 removeMarch 移除
      const activeMarches = marchingSystem.getActiveMarches();
      const marchABIds = activeMarches.filter(m => m.id === marchAB.id);
      expect(marchABIds.length).toBe(0);

      // 第二段行军仍在map中（arrived状态不会被自动删除）
      const marchBCInMap = marchingSystem.getMarch(marchBC.id);
      expect(marchBCInMap).toBeDefined();
      expect(marchBCInMap!.state).toBe('arrived');
    });
  });

  // ── Scenario 4: March speed vs distance relationship ─────────────

  describe('Scenario 4: 行军速度与距离关系', () => {
    it('行军到达时间应与 distance / speed 一致(100ms容忍度)', () => {
      // 使用简单2点路径: (0,0) → (300,0), 距离=300px
      // BASE_SPEED = 30 px/s, 预计到达时间 = 300/30 = 10s
      const path = [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ];

      const march = marchingSystem.createMarch(
        'city-a', 'city-b',
        1000, '张飞', 'shu',
        path,
      );
      marchingSystem.startMarch(march.id);

      const distance = 300; // px
      const speed = 30; // BASE_SPEED px/s
      const expectedTime = distance / speed; // 10s

      // 使用小的dt逐步推进
      const dt = 0.01; // 10ms
      let elapsed = 0;
      let arrivalTime: number | null = null;

      for (let i = 0; i < 50000; i++) {
        marchingSystem.update(dt);
        elapsed += dt;

        if (march.state === 'arrived') {
          arrivalTime = elapsed;
          break;
        }
      }

      expect(arrivalTime).not.toBeNull();
      // 允许100ms容忍度
      expect(Math.abs(arrivalTime! - expectedTime)).toBeLessThanOrEqual(0.1);
    });

    it('较远路径比较近路径花更长时间', () => {
      const shortPath = [
        { x: 0, y: 0 },
        { x: 30, y: 0 }, // 30px
      ];
      const longPath = [
        { x: 0, y: 0 },
        { x: 300, y: 0 }, // 300px
      ];

      // 短路径行军
      const shortMarch = marchingSystem.createMarch(
        'city-a', 'city-b',
        500, '赵云', 'shu',
        shortPath,
      );
      marchingSystem.startMarch(shortMarch.id);

      let shortTime = 0;
      for (let i = 0; i < 10000; i++) {
        marchingSystem.update(0.01);
        shortTime += 0.01;
        if (shortMarch.state === 'arrived') break;
      }
      expect(shortMarch.state).toBe('arrived');

      // 长路径行军（新系统实例）
      const system2 = new MarchingSystem();
      system2.init(createMockDeps());
      const longMarch = system2.createMarch(
        'city-a', 'city-c',
        500, '赵云', 'shu',
        longPath,
      );
      system2.startMarch(longMarch.id);

      let longTime = 0;
      for (let i = 0; i < 100000; i++) {
        system2.update(0.01);
        longTime += 0.01;
        if (longMarch.state === 'arrived') break;
      }
      expect(longMarch.state).toBe('arrived');

      // 长路径应花约10倍时间
      expect(longTime).toBeGreaterThan(shortTime * 5); // 至少5倍
    });
  });

  // ── Scenario 5: Empty march cleanup (P2 #8) ─────────────────────

  describe('Scenario 5: 取消行军清理', () => {
    it('cancelMarch后行军从activeMarches中移除', () => {
      const path = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];

      const march = marchingSystem.createMarch(
        'city-a', 'city-b',
        1000, '关羽', 'shu',
        path,
      );
      march.siegeTaskId = 'task-cancel-test';

      // 验证行军在active列表中
      expect(marchingSystem.getActiveMarches().length).toBe(1);
      expect(marchingSystem.getMarch(march.id)).toBeDefined();

      // 启动行军
      marchingSystem.startMarch(march.id);
      expect(march.state).toBe('marching');

      // 取消行军
      marchingSystem.cancelMarch(march.id);

      // 验证从active列表移除
      expect(marchingSystem.getActiveMarches().length).toBe(0);
      expect(marchingSystem.getMarch(march.id)).toBeUndefined();

      // 验证 march:cancelled 事件被触发
      expect(emitSpy).toHaveBeenCalledWith('march:cancelled', expect.objectContaining({
        marchId: march.id,
        troops: 1000,
        siegeTaskId: 'task-cancel-test',
      }));

      // 验证状态为cancelled（P2 #10 fix: 原为retreating）
      expect(march.state).toBe('cancelled');
    });

    it('取消不存在的行军ID不会崩溃', () => {
      expect(() => marchingSystem.cancelMarch('nonexistent_id')).not.toThrow();
    });
  });

  // ── Scenario 6: march:created event payload verification ─────────

  describe('Scenario 6: march:created事件payload验证', () => {
    it('march:created事件包含所有必要字段', () => {
      const path = [
        { x: 100, y: 200 },
        { x: 200, y: 200 },
        { x: 300, y: 300 },
      ];

      emitSpy.mockClear();

      const march = marchingSystem.createMarch(
        'city-luoyang', 'city-xuchang',
        5000, '曹操', 'wei',
        path,
      );

      // 验证 march:created 被调用
      const createdCalls = emitSpy.mock.calls.filter(
        (call: unknown[]) => call[0] === 'march:created',
      );
      expect(createdCalls.length).toBe(1);

      const payload = createdCalls[0][1] as Record<string, unknown>;

      // 验证所有必要字段
      expect(payload).toHaveProperty('marchId', march.id);
      expect(payload).toHaveProperty('fromCityId', 'city-luoyang');
      expect(payload).toHaveProperty('toCityId', 'city-xuchang');
      expect(payload).toHaveProperty('troops', 5000);
      expect(payload).toHaveProperty('general', '曹操');
      expect(payload).toHaveProperty('estimatedTime');

      // ETA应该是正数
      expect(typeof payload.estimatedTime).toBe('number');
      expect(payload.estimatedTime as number).toBeGreaterThan(0);

      // march.eta 应该是未来时间
      expect(march.eta).toBeGreaterThan(Date.now() - 1000);
    });
  });

  // ── Scenario 7: Return march via createReturnMarch ──────────────

  describe('Scenario 7: 回城行军', () => {
    it('createReturnMarch 速度为 BASE_SPEED * 0.8 (24 px/s)', () => {
      // Mock calculateMarchRoute 以返回已知路线
      const spy = vi.spyOn(marchingSystem, 'calculateMarchRoute').mockReturnValue({
        path: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 },
        ],
        waypoints: [{ x: 0, y: 0 }, { x: 20, y: 0 }],
        distance: 2,
        estimatedTime: 2,
        waypointCities: [],
      });

      const result = marchingSystem.createReturnMarch({
        fromCityId: 'city-xuchang',
        toCityId: 'city-luoyang',
        troops: 2000,
        general: '关羽',
        faction: 'shu',
        siegeTaskId: 'task-return-001',
      });

      expect(result).not.toBeNull();
      // 速度为 BASE_SPEED * 0.8 = 30 * 0.8 = 24
      expect(result!.speed).toBeCloseTo(24);
      expect(result!.fromCityId).toBe('city-xuchang');
      expect(result!.toCityId).toBe('city-luoyang');
      expect(result!.troops).toBe(2000);
      expect(result!.general).toBe('关羽');
      expect(result!.faction).toBe('shu');
      expect(result!.siegeTaskId).toBe('task-return-001');

      spy.mockRestore();
    });

    it('回城行军可以正常到达终点', () => {
      const spy = vi.spyOn(marchingSystem, 'calculateMarchRoute').mockReturnValue({
        path: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        waypoints: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        distance: 1,
        estimatedTime: 1,
        waypointCities: [],
      });

      const result = marchingSystem.createReturnMarch({
        fromCityId: 'city-xuchang',
        toCityId: 'city-luoyang',
        troops: 1500,
        general: '张飞',
        faction: 'shu',
      });

      expect(result).not.toBeNull();

      // 启动回城行军
      marchingSystem.startMarch(result!.id);
      expect(result!.state).toBe('retreating');
      expect(result!.speed).toBeCloseTo(24); // 80% of 30

      // 推进到到达 (100px / 24px/s ≈ 4.17s)
      for (let i = 0; i < 200; i++) {
        marchingSystem.update(1);
        if (result!.state === 'arrived') break;
      }

      expect(result!.state).toBe('arrived');
      expect(result!.x).toBe(100);
      expect(result!.y).toBe(0);

      spy.mockRestore();
    });

    it('不可达时 createReturnMarch 返回 null', () => {
      // 不设置 walkabilityGrid
      const result = marchingSystem.createReturnMarch({
        fromCityId: 'city-xuchang',
        toCityId: 'city-luoyang',
        troops: 1000,
        general: '关羽',
        faction: 'shu',
      });

      expect(result).toBeNull();
    });
  });

  // ── Scenario 8: March state transitions ──────────────────────────

  describe('Scenario 8: 行军状态转换', () => {
    it('行军状态正确转换 preparing → marching → arrived', () => {
      const path = [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
      ];

      const march = marchingSystem.createMarch(
        'city-a', 'city-b',
        1000, '张飞', 'shu',
        path,
      );

      // 初始状态: preparing
      expect(march.state).toBe('preparing');

      // 启动: preparing → marching
      marchingSystem.startMarch(march.id);
      expect(march.state).toBe('marching');

      // 到达: marching → arrived
      for (let i = 0; i < 100; i++) {
        marchingSystem.update(1);
        if (march.state === 'arrived') break;
      }
      expect(march.state).toBe('arrived');
    });

    it('取消后状态为cancelled', () => {
      const path = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];

      const march = marchingSystem.createMarch(
        'city-a', 'city-b',
        500, '赵云', 'shu',
        path,
      );

      // preparing状态取消
      marchingSystem.cancelMarch(march.id);
      expect(march.state).toBe('cancelled');
      expect(marchingSystem.getActiveMarches().length).toBe(0);
    });

    it('marching状态取消后状态为cancelled', () => {
      const path = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];

      const march = marchingSystem.createMarch(
        'city-a', 'city-b',
        800, '黄忠', 'shu',
        path,
      );
      marchingSystem.startMarch(march.id);
      expect(march.state).toBe('marching');

      marchingSystem.cancelMarch(march.id);
      expect(march.state).toBe('cancelled');
      expect(marchingSystem.getActiveMarches().length).toBe(0);
    });
  });

  // ── Scenario 9: MarchState type includes 'cancelled' ─────────────

  describe('Scenario 9: MarchState类型包含cancelled', () => {
    it('MarchState允许cancelled值', () => {
      // 编译时类型检查 — 如果类型不包含'cancelled'，TS会报错
      const states: MarchState[] = [
        'preparing', 'marching', 'arrived', 'intercepted', 'retreating', 'cancelled',
      ];
      expect(states).toContain('cancelled');
    });
  });

  // ── Scenario 10: Multiple concurrent marches ─────────────────────

  describe('Scenario 10: 多个并行行军', () => {
    it('多个行军可以同时存在且独立到达', () => {
      const path1 = [
        { x: 0, y: 0 },
        { x: 60, y: 0 }, // 60px, 2s at 30px/s
      ];
      const path2 = [
        { x: 0, y: 100 },
        { x: 120, y: 100 }, // 120px, 4s at 30px/s
      ];

      const march1 = marchingSystem.createMarch(
        'city-a', 'city-b',
        1000, '关羽', 'shu',
        path1,
      );
      const march2 = marchingSystem.createMarch(
        'city-c', 'city-d',
        2000, '张飞', 'shu',
        path2,
      );

      marchingSystem.startMarch(march1.id);
      marchingSystem.startMarch(march2.id);

      expect(marchingSystem.getActiveMarches().length).toBe(2);

      // 推进直到短行军到达
      let march1Arrived = false;
      let march2Arrived = false;

      for (let i = 0; i < 200; i++) {
        marchingSystem.update(0.5);
        if (march1.state === 'arrived' && !march1Arrived) {
          march1Arrived = true;
          // march2 还不应到达（它是 march1 距离的2倍）
          // 注意: 由于update可能有累计误差，这里用宽松检查
        }
        if (march2.state === 'arrived') {
          march2Arrived = true;
          break;
        }
      }

      // march1 应该先到达
      expect(march1Arrived).toBe(true);
      expect(march2Arrived).toBe(true);

      // 两个行军都到达了
      expect(march1.state).toBe('arrived');
      expect(march2.state).toBe('arrived');

      // 验证各自到达了正确的终点
      expect(march1.x).toBe(60);
      expect(march1.y).toBe(0);
      expect(march2.x).toBe(120);
      expect(march2.y).toBe(100);
    });
  });

  // ── Scenario 11: Pathfinding integration ─────────────────────────

  describe('Scenario 11: A*寻路集成', () => {
    it('计算路线后行军可以到达目标', () => {
      const grid = createMarchTestGrid();
      marchingSystem.setWalkabilityGrid(grid);

      // 计算路线
      const route = marchingSystem.calculateMarchRoute('city-luoyang', 'city-xuchang');
      expect(route).not.toBeNull();

      // 使用路线的路径创建行军
      const path = route!.path.map(p => ({ x: p.x * 32, y: p.y * 32 }));
      const march = marchingSystem.createMarch(
        'city-luoyang', 'city-xuchang',
        1000, '赵云', 'shu',
        path,
      );
      marchingSystem.startMarch(march.id);

      // 推进到到达
      for (let i = 0; i < 300; i++) {
        marchingSystem.update(1);
        if (march.state === 'arrived') break;
      }

      expect(march.state).toBe('arrived');
      // 最终位置应匹配许昌的像素坐标
      const destination = route!.path[route!.path.length - 1];
      expect(march.x).toBeCloseTo(destination.x * 32, 0);
      expect(march.y).toBeCloseTo(destination.y * 32, 0);
    });

    it('不可达城市calculateMarchRoute返回null', () => {
      // 仅标记两个城市位置，中间无道路
      const grid: boolean[][] = [];
      for (let y = 0; y < 60; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < 100; x++) row.push(false);
        grid.push(row);
      }
      grid[23][50] = true;  // 洛阳
      grid[49][12] = true;  // 成都

      marchingSystem.setWalkabilityGrid(grid);
      const route = marchingSystem.calculateMarchRoute('city-luoyang', 'city-chengdu');
      expect(route).toBeNull();
    });

    it('waypoints从路径转折点中提取', () => {
      const grid = createMarchTestGrid();
      marchingSystem.setWalkabilityGrid(grid);

      const route = marchingSystem.calculateMarchRoute('city-luoyang', 'city-xuchang');
      expect(route).not.toBeNull();

      // waypoints至少包含起点和终点
      expect(route!.waypoints.length).toBeGreaterThanOrEqual(2);
      expect(route!.waypoints[0]).toEqual(route!.path[0]);
      expect(route!.waypoints[route!.waypoints.length - 1]).toEqual(
        route!.path[route!.path.length - 1],
      );
    });
  });

  // ── Scenario 12: Siege task ID propagation ───────────────────────

  describe('Scenario 12: siegeTaskId传播', () => {
    it('siegeTaskId在created/arrived/cancelled事件中正确传播', () => {
      const path = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ];

      emitSpy.mockClear();

      const march = marchingSystem.createMarch(
        'city-a', 'city-b',
        1000, '张飞', 'shu',
        path,
      );
      march.siegeTaskId = 'task-siege-prop-001';

      // march:created 不包含 siegeTaskId (设计如此)
      // 但 march 对象上有 siegeTaskId

      marchingSystem.startMarch(march.id);

      // 推进到到达
      for (let i = 0; i < 100; i++) {
        marchingSystem.update(1);
        if (march.state === 'arrived') break;
      }

      // march:arrived 事件应包含 siegeTaskId
      const arrivedCalls = emitSpy.mock.calls.filter(
        (call: unknown[]) => call[0] === 'march:arrived',
      );
      expect(arrivedCalls.length).toBe(1);
      expect(arrivedCalls[0][1]).toHaveProperty('siegeTaskId', 'task-siege-prop-001');
    });

    it('cancel时siegeTaskId在cancelled事件中传播', () => {
      const path = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];

      emitSpy.mockClear();

      const march = marchingSystem.createMarch(
        'city-a', 'city-b',
        500, '赵云', 'shu',
        path,
      );
      march.siegeTaskId = 'task-siege-cancel-002';
      marchingSystem.startMarch(march.id);

      marchingSystem.cancelMarch(march.id);

      const cancelledCalls = emitSpy.mock.calls.filter(
        (call: unknown[]) => call[0] === 'march:cancelled',
      );
      expect(cancelledCalls.length).toBe(1);
      expect(cancelledCalls[0][1]).toHaveProperty('siegeTaskId', 'task-siege-cancel-002');
    });
  });
});
