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
  });
});
