/**
 * MarchingSystem 行军动画系统测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarchingSystem, type MarchUnit } from '../MarchingSystem';
import type { ISystemDeps } from '../../../core/types';

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

const TEST_PATH = [
  { x: 100, y: 100 },
  { x: 200, y: 100 },
  { x: 300, y: 200 },
  { x: 400, y: 200 },
];

describe('MarchingSystem', () => {
  let system: MarchingSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    system = new MarchingSystem();
    deps = createMockDeps();
    system.init(deps);
  });

  // ── 初始化 ─────────────────────────────────

  describe('初始化', () => {
    it('name为marching', () => {
      expect(system.name).toBe('marching');
    });

    it('初始无活跃行军', () => {
      expect(system.getActiveMarches()).toEqual([]);
    });

    it('reset清空所有行军', () => {
      system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      system.reset();
      expect(system.getActiveMarches()).toEqual([]);
    });
  });

  // ── 创建行军 ───────────────────────────────

  describe('创建行军', () => {
    it('createMarch返回行军单位', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);

      expect(march.id).toBeTruthy();
      expect(march.fromCityId).toBe('city-a');
      expect(march.toCityId).toBe('city-b');
      expect(march.troops).toBe(1000);
      expect(march.general).toBe('张飞');
      expect(march.faction).toBe('shu');
      expect(march.state).toBe('preparing');
    });

    it('行军初始位置为路径起点', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);

      expect(march.x).toBe(TEST_PATH[0].x);
      expect(march.y).toBe(TEST_PATH[0].y);
      expect(march.pathIndex).toBe(0);
    });

    it('行军士气初始为100', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      expect(march.morale).toBe(100);
    });

    it('创建后加入活跃列表', () => {
      system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      expect(system.getActiveMarches().length).toBe(1);
    });

    it('emit march:created事件', () => {
      system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('march:created', expect.objectContaining({
        fromCityId: 'city-a',
        toCityId: 'city-b',
        troops: 1000,
        general: '张飞',
      }));
    });
  });

  // ── 启动行军 ───────────────────────────────

  describe('启动行军', () => {
    it('startMarch将状态改为marching', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      system.startMarch(march.id);

      expect(system.getMarch(march.id)?.state).toBe('marching');
    });

    it('emit march:started事件', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      system.startMarch(march.id);

      expect(deps.eventBus.emit).toHaveBeenCalledWith('march:started', expect.objectContaining({
        marchId: march.id,
      }));
    });

    it('preparing状态不能重复启动', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      system.startMarch(march.id);
      // 再次调用不应触发事件
      (deps.eventBus.emit as ReturnType<typeof vi.fn>).mockClear();
      system.startMarch(march.id);
      expect(deps.eventBus.emit).not.toHaveBeenCalledWith('march:started', expect.anything());
    });
  });

  // ── 取消行军 ───────────────────────────────

  describe('取消行军', () => {
    it('cancelMarch移除行军', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      system.cancelMarch(march.id);

      expect(system.getActiveMarches().length).toBe(0);
    });

    it('emit march:cancelled事件', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      system.cancelMarch(march.id);

      expect(deps.eventBus.emit).toHaveBeenCalledWith('march:cancelled', expect.objectContaining({
        marchId: march.id,
        troops: 1000,
      }));
    });

    it('cancelMarch事件payload包含siegeTaskId', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      march.siegeTaskId = 'task-test-123';
      system.cancelMarch(march.id);

      expect(deps.eventBus.emit).toHaveBeenCalledWith('march:cancelled', expect.objectContaining({
        marchId: march.id,
        troops: 1000,
        siegeTaskId: 'task-test-123',
      }));
    });
  });

  // ── 行军更新 ───────────────────────────────

  describe('行军更新', () => {
    it('update推进行军位置', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      system.startMarch(march.id);

      const initialX = march.x;
      system.update(1); // 1秒

      // 应该向第二个路径点移动
      expect(march.x).toBeGreaterThanOrEqual(initialX);
    });

    it('update更新动画帧', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      system.startMarch(march.id);

      system.update(0.1);
      const frame1 = march.animFrame;

      // animFrame应该在0~3之间
      expect(frame1).toBeGreaterThanOrEqual(0);
      expect(frame1).toBeLessThanOrEqual(3);
    });

    it('到达终点时状态变为arrived', () => {
      // 短路径
      const shortPath = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', shortPath);
      system.startMarch(march.id);

      // 模拟足够时间到达终点
      for (let i = 0; i < 100; i++) {
        system.update(1);
      }

      expect(march.state).toBe('arrived');
    });

    it('到达终点时emit march:arrived事件', () => {
      const shortPath = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', shortPath);
      system.startMarch(march.id);

      for (let i = 0; i < 100; i++) {
        system.update(1);
      }

      expect(deps.eventBus.emit).toHaveBeenCalledWith('march:arrived', expect.objectContaining({
        marchId: march.id,
        cityId: 'city-b',
      }));
    });

    it('到达终点时emit march:arrived事件包含siegeTaskId', () => {
      const shortPath = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', shortPath);
      march.siegeTaskId = 'task-arrived-123';
      system.startMarch(march.id);

      for (let i = 0; i < 100; i++) {
        system.update(1);
      }

      expect(deps.eventBus.emit).toHaveBeenCalledWith('march:arrived', expect.objectContaining({
        marchId: march.id,
        cityId: 'city-b',
        siegeTaskId: 'task-arrived-123',
      }));
    });

    it('preparing状态不更新位置', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      const initialX = march.x;

      system.update(1);

      expect(march.x).toBe(initialX);
    });
  });

  // ── 查询 ───────────────────────────────────

  describe('查询', () => {
    it('getMarch返回指定行军', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      expect(system.getMarch(march.id)?.id).toBe(march.id);
    });

    it('getMarch不存在返回undefined', () => {
      expect(system.getMarch('不存在')).toBeUndefined();
    });

    it('removeMarch移除行军', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      system.removeMarch(march.id);
      expect(system.getActiveMarches().length).toBe(0);
    });
  });

  // ── 预览 ───────────────────────────────────

  describe('路线预览', () => {
    it('generatePreview返回路径信息', () => {
      const preview = system.generatePreview(TEST_PATH);

      expect(preview.path).toEqual(TEST_PATH);
      expect(preview.distance).toBeGreaterThan(0);
      expect(preview.estimatedTime).toBeGreaterThan(0);
    });

    it('generatePreview包含地形摘要', () => {
      const preview = system.generatePreview(TEST_PATH);

      expect(preview.terrainSummary.length).toBeGreaterThan(0);
      expect(preview.terrainSummary[0].terrain).toBeTruthy();
      expect(preview.terrainSummary[0].percentage).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 回城行军 ───────────────────────────────

  describe('createReturnMarch', () => {
    it('walkabilityGrid 未设置时返回 null', () => {
      // 不设置 walkabilityGrid，calculateMarchRoute 内部会返回 null
      const result = system.createReturnMarch({
        fromCityId: 'city-luoyang',
        toCityId: 'city-xuchang',
        troops: 500,
        general: '关羽',
        faction: 'shu',
      });
      expect(result).toBeNull();
    });

    it('城市不存在时返回 null', () => {
      // 即使设置了空 grid，城市不存在也会返回 null
      system.setWalkabilityGrid({} as any);
      const result = system.createReturnMarch({
        fromCityId: 'non-existent-city',
        toCityId: 'also-non-existent',
        troops: 500,
        general: '关羽',
        faction: 'shu',
      });
      expect(result).toBeNull();
    });

    it('成功创建回城行军，速度为 BASE_SPEED * 0.8', () => {
      // Mock calculateMarchRoute 以返回有效路线
      const spy = vi.spyOn(system, 'calculateMarchRoute').mockReturnValue({
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

      const result = system.createReturnMarch({
        fromCityId: 'city-luoyang',
        toCityId: 'city-xuchang',
        troops: 500,
        general: '关羽',
        faction: 'shu',
      });

      expect(result).not.toBeNull();
      // 速度为 BASE_SPEED * 0.8 = 30 * 0.8 = 24
      expect(result!.speed).toBeCloseTo(24);
      expect(result!.fromCityId).toBe('city-luoyang');
      expect(result!.toCityId).toBe('city-xuchang');
      expect(result!.troops).toBe(500);
      expect(result!.general).toBe('关羽');
      expect(result!.faction).toBe('shu');

      spy.mockRestore();
    });

    it('siegeTaskId 被正确设置', () => {
      const spy = vi.spyOn(system, 'calculateMarchRoute').mockReturnValue({
        path: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        distance: 1,
        estimatedTime: 1,
        waypointCities: [],
      });

      const result = system.createReturnMarch({
        fromCityId: 'city-a',
        toCityId: 'city-b',
        troops: 300,
        general: '赵云',
        faction: 'shu',
        siegeTaskId: 'task-siege-abc',
      });

      expect(result).not.toBeNull();
      expect(result!.siegeTaskId).toBe('task-siege-abc');

      spy.mockRestore();
    });

    it('路径基于 calculateMarchRoute（非 originalPath）', () => {
      const routePath = [
        { x: 100, y: 200 },
        { x: 150, y: 250 },
        { x: 200, y: 300 },
      ];
      const spy = vi.spyOn(system, 'calculateMarchRoute').mockReturnValue({
        path: routePath,
        waypoints: routePath,
        distance: 2,
        estimatedTime: 2,
        waypointCities: [],
      });

      const result = system.createReturnMarch({
        fromCityId: 'city-a',
        toCityId: 'city-b',
        troops: 100,
        general: '张飞',
        faction: 'shu',
      });

      expect(result).not.toBeNull();
      // 确认路径是通过 calculateMarchRoute 重新计算的
      expect(spy).toHaveBeenCalled();
      // 路径应来自 calculateMarchRoute 返回的结果
      expect(result!.path[0]).toEqual({ x: 100, y: 200 });
      expect(result!.path[2]).toEqual({ x: 200, y: 300 });

      spy.mockRestore();
    });
  });

  // ── 取消行军异常路径 ─────────────────────────

  describe('取消行军异常路径', () => {
    // 场景A: 行军中取消 → 状态正确变为cancelled，行军从active列表移除，事件发射
    it('marching状态取消 → 状态变为cancelled，从active列表移除，发射march:cancelled', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      system.startMarch(march.id);
      expect(march.state).toBe('marching');

      system.cancelMarch(march.id);

      // 行军已从active列表移除
      expect(system.getMarch(march.id)).toBeUndefined();
      expect(system.getActiveMarches().length).toBe(0);

      // 状态在删除前被设为cancelled（删除后引用仍有效）
      expect(march.state).toBe('cancelled');

      // 事件发射
      expect(deps.eventBus.emit).toHaveBeenCalledWith('march:cancelled', expect.objectContaining({
        marchId: march.id,
        troops: 1000,
      }));
    });

    // 场景B: 取消不存在的行军 → 不崩溃，无事件发射
    it('取消不存在的行军ID → 不抛异常，不发射事件', () => {
      const emitBefore = (deps.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.length;

      expect(() => system.cancelMarch('march_nonexistent_999')).not.toThrow();

      // 不应有新的emit调用
      const emitAfter = (deps.eventBus.emit).mock.calls.length;
      expect(emitAfter).toBe(emitBefore);
    });

    // 场景C: 重复取消同一行军 → 第二次取消无效果，无异常
    it('重复取消同一行军 → 第二次取消无效果且无异常', () => {
      const march = system.createMarch('city-a', 'city-b', 800, '赵云', 'shu', TEST_PATH);
      system.cancelMarch(march.id);

      // 第一次取消成功
      expect(system.getMarch(march.id)).toBeUndefined();

      // 清除emit记录
      (deps.eventBus.emit as ReturnType<typeof vi.fn>).mockClear();

      // 第二次取消
      expect(() => system.cancelMarch(march.id)).not.toThrow();
      // 第二次不应发射任何事件
      expect(deps.eventBus.emit).not.toHaveBeenCalled();
    });

    // 场景D: 已到达行军取消 → 不影响arrived状态（但行军被移除）
    it('arrived状态取消 → 行军从列表移除，发射march:cancelled', () => {
      const shortPath = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
      const march = system.createMarch('city-a', 'city-b', 500, '关羽', 'shu', shortPath);
      system.startMarch(march.id);

      // 模拟到达
      for (let i = 0; i < 100; i++) {
        system.update(1);
      }
      expect(march.state).toBe('arrived');

      // 清除之前的emit记录
      (deps.eventBus.emit as ReturnType<typeof vi.fn>).mockClear();

      // 取消已到达的行军
      system.cancelMarch(march.id);

      // 行军被移除
      expect(system.getMarch(march.id)).toBeUndefined();
      // 状态变为cancelled
      expect(march.state).toBe('cancelled');
      // 发射了cancelled事件
      expect(deps.eventBus.emit).toHaveBeenCalledWith('march:cancelled', expect.objectContaining({
        marchId: march.id,
        troops: 500,
      }));
    });

    // 场景E: preparing状态取消 → 正确处理
    it('preparing状态取消 → 状态变为cancelled，从active列表移除', () => {
      const march = system.createMarch('city-a', 'city-b', 2000, '马超', 'shu', TEST_PATH);
      expect(march.state).toBe('preparing');

      system.cancelMarch(march.id);

      expect(march.state).toBe('cancelled');
      expect(system.getMarch(march.id)).toBeUndefined();
      expect(deps.eventBus.emit).toHaveBeenCalledWith('march:cancelled', expect.objectContaining({
        marchId: march.id,
        troops: 2000,
      }));
    });

    // 场景E补充: preparing状态取消不发射march:started事件
    it('preparing状态取消 → 不发射march:started', () => {
      const march = system.createMarch('city-a', 'city-b', 1500, '黄忠', 'shu', TEST_PATH);

      (deps.eventBus.emit as ReturnType<typeof vi.fn>).mockClear();
      system.cancelMarch(march.id);

      // 不应有march:started事件
      expect(deps.eventBus.emit).not.toHaveBeenCalledWith('march:started', expect.anything());
      // 应有march:cancelled事件
      expect(deps.eventBus.emit).toHaveBeenCalledWith('march:cancelled', expect.anything());
    });

    // 场景F: cancelMarch触发march:cancelled事件，携带正确的siegeTaskId
    it('cancelMarch发射march:cancelled事件携带正确的siegeTaskId', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      march.siegeTaskId = 'task-siege-xyz-789';
      system.startMarch(march.id);

      (deps.eventBus.emit as ReturnType<typeof vi.fn>).mockClear();
      system.cancelMarch(march.id);

      expect(deps.eventBus.emit).toHaveBeenCalledWith('march:cancelled', expect.objectContaining({
        marchId: march.id,
        troops: 1000,
        siegeTaskId: 'task-siege-xyz-789',
      }));
    });

    // 场景F补充: 无siegeTaskId时payload中siegeTaskId为undefined
    it('cancelMarch发射march:cancelled事件无siegeTaskId时为undefined', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      // 不设置siegeTaskId
      system.startMarch(march.id);

      (deps.eventBus.emit as ReturnType<typeof vi.fn>).mockClear();
      system.cancelMarch(march.id);

      const cancelledCalls = (deps.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        call => call[0] === 'march:cancelled',
      );
      expect(cancelledCalls.length).toBe(1);
      expect(cancelledCalls[0][1].siegeTaskId).toBeUndefined();
    });
  });

  // ── 序列化 ─────────────────────────────────

  describe('序列化', () => {
    it('serialize返回存档数据', () => {
      system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      const save = system.serialize();

      expect(save.version).toBe(1);
      expect(save.activeMarches.length).toBe(1);
    });

    it('deserialize恢复行军', () => {
      system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      const save = system.serialize();

      const system2 = new MarchingSystem();
      system2.init(createMockDeps());
      system2.deserialize(save);

      expect(system2.getActiveMarches().length).toBe(1);
      expect(system2.getActiveMarches()[0].general).toBe('张飞');
    });

    it('deserialize处理空数据', () => {
      expect(() => system.deserialize(null as any)).not.toThrow();
      expect(() => system.deserialize({ activeMarches: [], version: 1 })).not.toThrow();
    });

    it('siegeTaskId在序列化/反序列化后保留', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      march.siegeTaskId = 'task-serialize-123';
      const save = system.serialize();

      const system2 = new MarchingSystem();
      system2.init(createMockDeps());
      system2.deserialize(save);

      const restored = system2.getMarch(march.id);
      expect(restored).toBeDefined();
      expect(restored!.siegeTaskId).toBe('task-serialize-123');
    });

    it('未设置siegeTaskId的行军序列化/反序列化后仍为undefined', () => {
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
      // 不设置 siegeTaskId
      const save = system.serialize();

      const system2 = new MarchingSystem();
      system2.init(createMockDeps());
      system2.deserialize(save);

      const restored = system2.getMarch(march.id);
      expect(restored).toBeDefined();
      expect(restored!.siegeTaskId).toBeUndefined();
    });
  });
});
