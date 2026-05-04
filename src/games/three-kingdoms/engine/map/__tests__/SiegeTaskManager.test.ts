/**
 * SiegeTaskManager 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SiegeTaskManager } from '../SiegeTaskManager';
import type { SiegeTaskStatus } from '../../../core/map/siege-task.types';

describe('SiegeTaskManager', () => {
  let manager: SiegeTaskManager;

  beforeEach(() => {
    manager = new SiegeTaskManager();
  });

  describe('createTask', () => {
    it('应创建 preparing 状态的攻占任务', () => {
      const task = manager.createTask({
        targetId: 'city-xuchang',
        targetName: '许昌',
        sourceId: 'city-changsha',
        sourceName: '长沙',
        strategy: 'forceAttack',
        expedition: {
          forceId: 'force-1',
          heroId: 'hero-guanyu',
          heroName: '关羽',
          troops: 3000,
        },
        cost: { troops: 2000, grain: 500 },
        marchPath: [{ x: 10, y: 20 }, { x: 15, y: 25 }],
        faction: 'wei' as const,
      });

      expect(task.id).toMatch(/^siege-task-\d+$/);
      expect(task.status).toBe('preparing');
      expect(task.targetId).toBe('city-xuchang');
      expect(task.targetName).toBe('许昌');
      expect(task.sourceId).toBe('city-changsha');
      expect(task.strategy).toBe('forceAttack');
      expect(task.expedition.heroName).toBe('关羽');
      expect(task.expedition.troops).toBe(3000);
      expect(task.cost.troops).toBe(2000);
      expect(task.cost.grain).toBe(500);
      expect(task.createdAt).toBeGreaterThan(0);
      expect(task.marchStartedAt).toBeNull();
      expect(task.result).toBeNull();
    });

    it('应发射 siegeTask:created 事件', () => {
      const events: unknown[] = [];
      manager.setDependencies({
        eventBus: {
          emit: (event: string, data: unknown) => events.push({ event, data }),
          on: () => {},
          off: () => {},
        },
      });

      manager.createTask({
        targetId: 'city-luoyang',
        targetName: '洛阳',
        sourceId: 'city-changsha',
        sourceName: '长沙',
        strategy: null,
        expedition: { forceId: 'f1', heroId: 'h1', heroName: '张飞', troops: 1000 },
        cost: { troops: 500, grain: 200 },
        marchPath: [],
        faction: 'wei' as const,
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toHaveProperty('event', 'siegeTask:created');
    });
  });

  describe('advanceStatus', () => {
    it('应按合法路径推进: preparing→marching→sieging→settling→returning→completed', () => {
      const task = manager.createTask({
        targetId: 't1', targetName: 'T1',
        sourceId: 's1', sourceName: 'S1',
        strategy: null,
        expedition: { forceId: 'f1', heroId: 'h1', heroName: 'H1', troops: 100 },
        cost: { troops: 50, grain: 10 },
        marchPath: [],
        faction: 'wei' as const,
      });

      const transitions: SiegeTaskStatus[] = ['marching', 'sieging', 'settling', 'returning', 'completed'];
      for (const newStatus of transitions) {
        const result = manager.advanceStatus(task.id, newStatus);
        expect(result).not.toBeNull();
        expect(result!.status).toBe(newStatus);
      }
    });

    it('应拒绝非法状态转换', () => {
      const task = manager.createTask({
        targetId: 't1', targetName: 'T1',
        sourceId: 's1', sourceName: 'S1',
        strategy: null,
        expedition: { forceId: 'f1', heroId: 'h1', heroName: 'H1', troops: 100 },
        cost: { troops: 50, grain: 10 },
        marchPath: [],
        faction: 'wei' as const,
      });

      // preparing → sieging 是非法的 (必须先经过 marching)
      const result = manager.advanceStatus(task.id, 'sieging');
      expect(result).toBeNull();
      expect(task.status).toBe('preparing');
    });

    it('应拒绝从 completed 转换', () => {
      const task = manager.createTask({
        targetId: 't1', targetName: 'T1',
        sourceId: 's1', sourceName: 'S1',
        strategy: null,
        expedition: { forceId: 'f1', heroId: 'h1', heroName: 'H1', troops: 100 },
        cost: { troops: 50, grain: 10 },
        marchPath: [],
        faction: 'wei' as const,
      });

      manager.advanceStatus(task.id, 'marching');
      manager.advanceStatus(task.id, 'sieging');
      manager.advanceStatus(task.id, 'settling');
      manager.advanceStatus(task.id, 'returning');
      manager.advanceStatus(task.id, 'completed');

      // completed 是终态
      const result = manager.advanceStatus(task.id, 'preparing');
      expect(result).toBeNull();
    });

    it('应更新对应时间戳', () => {
      const task = manager.createTask({
        targetId: 't1', targetName: 'T1',
        sourceId: 's1', sourceName: 'S1',
        strategy: null,
        expedition: { forceId: 'f1', heroId: 'h1', heroName: 'H1', troops: 100 },
        cost: { troops: 50, grain: 10 },
        marchPath: [],
        faction: 'wei' as const,
      });

      manager.advanceStatus(task.id, 'marching');
      expect(task.marchStartedAt).toBeGreaterThan(0);

      manager.advanceStatus(task.id, 'sieging');
      expect(task.arrivedAt).toBeGreaterThan(0);

      manager.advanceStatus(task.id, 'settling');
      manager.advanceStatus(task.id, 'returning');
      expect(task.siegeCompletedAt).toBeGreaterThan(0);

      manager.advanceStatus(task.id, 'completed');
      expect(task.returnCompletedAt).toBeGreaterThan(0);
    });

    it('应发射 statusChanged 事件', () => {
      const events: unknown[] = [];
      manager.setDependencies({
        eventBus: {
          emit: (event: string, data: unknown) => events.push({ event, data }),
          on: () => {},
          off: () => {},
        },
      });

      const task = manager.createTask({
        targetId: 't1', targetName: 'T1',
        sourceId: 's1', sourceName: 'S1',
        strategy: null,
        expedition: { forceId: 'f1', heroId: 'h1', heroName: 'H1', troops: 100 },
        cost: { troops: 50, grain: 10 },
        marchPath: [],
        faction: 'wei' as const,
      });

      manager.advanceStatus(task.id, 'marching');

      const statusEvent = events.find((e: any) => e.event === 'siegeTask:statusChanged');
      expect(statusEvent).toBeDefined();
      expect((statusEvent as any).data).toMatchObject({
        taskId: task.id,
        from: 'preparing',
        to: 'marching',
      });
    });

    it('不存在的任务应返回null', () => {
      const result = manager.advanceStatus('nonexistent', 'marching');
      expect(result).toBeNull();
    });
  });

  describe('查询方法', () => {
    it('getActiveTasks 应返回非终态任务', () => {
      const t1 = manager.createTask({
        targetId: 't1', targetName: 'T1', sourceId: 's1', sourceName: 'S1',
        strategy: null,
        expedition: { forceId: 'f1', heroId: 'h1', heroName: 'H1', troops: 100 },
        cost: { troops: 50, grain: 10 }, marchPath: [], faction: 'wei' as const,
        faction: 'wei' as const,
      });
      const t2 = manager.createTask({
        targetId: 't2', targetName: 'T2', sourceId: 's1', sourceName: 'S1',
        strategy: null,
        expedition: { forceId: 'f2', heroId: 'h2', heroName: 'H2', troops: 100 },
        cost: { troops: 50, grain: 10 }, marchPath: [], faction: 'wei' as const,
        faction: 'wei' as const,
      });

      // 完成 t2
      manager.advanceStatus(t2.id, 'marching');
      manager.advanceStatus(t2.id, 'sieging');
      manager.advanceStatus(t2.id, 'settling');
      manager.advanceStatus(t2.id, 'returning');
      manager.advanceStatus(t2.id, 'completed');

      const active = manager.getActiveTasks();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(t1.id);
    });

    it('getTaskByTarget 应返回目标活跃任务', () => {
      manager.createTask({
        targetId: 'city-xuchang', targetName: '许昌', sourceId: 's1', sourceName: 'S1',
        strategy: null,
        expedition: { forceId: 'f1', heroId: 'h1', heroName: 'H1', troops: 100 },
        cost: { troops: 50, grain: 10 }, marchPath: [], faction: 'wei' as const,
        faction: 'wei' as const,
      });

      const found = manager.getTaskByTarget('city-xuchang');
      expect(found).not.toBeNull();
      expect(found!.targetName).toBe('许昌');

      expect(manager.getTaskByTarget('nonexistent')).toBeNull();
    });

    it('isTargetUnderSiege 应正确判断', () => {
      manager.createTask({
        targetId: 'city-a', targetName: 'A', sourceId: 's1', sourceName: 'S1',
        strategy: null,
        expedition: { forceId: 'f1', heroId: 'h1', heroName: 'H1', troops: 100 },
        cost: { troops: 50, grain: 10 }, marchPath: [], faction: 'wei' as const,
        faction: 'wei' as const,
      });

      expect(manager.isTargetUnderSiege('city-a')).toBe(true);
      expect(manager.isTargetUnderSiege('city-b')).toBe(false);
    });

    it('getTasksByStatus 应按状态筛选', () => {
      const t1 = manager.createTask({
        targetId: 't1', targetName: 'T1', sourceId: 's1', sourceName: 'S1',
        strategy: null,
        expedition: { forceId: 'f1', heroId: 'h1', heroName: 'H1', troops: 100 },
        cost: { troops: 50, grain: 10 }, marchPath: [], faction: 'wei' as const,
        faction: 'wei' as const,
      });
      manager.createTask({
        targetId: 't2', targetName: 'T2', sourceId: 's1', sourceName: 'S1',
        strategy: null,
        expedition: { forceId: 'f2', heroId: 'h2', heroName: 'H2', troops: 100 },
        cost: { troops: 50, grain: 10 }, marchPath: [], faction: 'wei' as const,
        faction: 'wei' as const,
      });

      manager.advanceStatus(t1.id, 'marching');

      expect(manager.getTasksByStatus('preparing')).toHaveLength(1);
      expect(manager.getTasksByStatus('marching')).toHaveLength(1);
    });
  });

  describe('setResult', () => {
    it('应设置攻城结果', () => {
      const task = manager.createTask({
        targetId: 't1', targetName: 'T1', sourceId: 's1', sourceName: 'S1',
        strategy: 'forceAttack',
        expedition: { forceId: 'f1', heroId: 'h1', heroName: 'H1', troops: 100 },
        cost: { troops: 50, grain: 10 }, marchPath: [], faction: 'wei' as const,
        faction: 'wei' as const,
      });

      manager.setResult(task.id, {
        victory: true,
        capture: { territoryId: 't1', newOwner: 'player', previousOwner: 'enemy' },
        casualties: {
          troopsLost: 15,
          troopsLostPercent: 15,
          heroInjured: false,
          injuryLevel: 'none' as any,
          battleResult: 'victory',
        },
        actualCost: { troops: 50, grain: 10 },
        rewardMultiplier: 0.9,
        specialEffectTriggered: true,
      });

      expect(task.result).not.toBeNull();
      expect(task.result!.victory).toBe(true);
      expect(task.result!.casualties!.troopsLost).toBe(15);
    });
  });

  describe('序列化', () => {
    it('应正确序列化和反序列化', () => {
      const task = manager.createTask({
        targetId: 't1', targetName: 'T1', sourceId: 's1', sourceName: 'S1',
        strategy: 'siege',
        expedition: { forceId: 'f1', heroId: 'h1', heroName: 'H1', troops: 100 },
        cost: { troops: 50, grain: 10 }, marchPath: [{ x: 1, y: 2 }], faction: 'wei' as const,
      });
      manager.advanceStatus(task.id, 'marching');

      const data = manager.serialize();

      const manager2 = new SiegeTaskManager();
      manager2.deserialize(data);

      const restored = manager2.getTask(task.id);
      expect(restored).not.toBeNull();
      expect(restored!.status).toBe('marching');
      expect(restored!.strategy).toBe('siege');
      expect(restored!.marchPath).toEqual([{ x: 1, y: 2 }]);
    });

    it('反序列化后ID计数器应继续递增', () => {
      manager.createTask({
        targetId: 't1', targetName: 'T1', sourceId: 's1', sourceName: 'S1',
        strategy: null,
        expedition: { forceId: 'f1', heroId: 'h1', heroName: 'H1', troops: 100 },
        cost: { troops: 50, grain: 10 }, marchPath: [], faction: 'wei' as const,
        faction: 'wei' as const,
      });

      const data = manager.serialize();

      const manager2 = new SiegeTaskManager();
      manager2.deserialize(data);

      const newTask = manager2.createTask({
        targetId: 't2', targetName: 'T2', sourceId: 's1', sourceName: 'S1',
        strategy: null,
        expedition: { forceId: 'f2', heroId: 'h2', heroName: 'H2', troops: 100 },
        cost: { troops: 50, grain: 10 }, marchPath: [], faction: 'wei' as const,
        faction: 'wei' as const,
      });

      // 新ID应大于已有ID
      expect(parseInt(newTask.id.split('-')[2], 10)).toBeGreaterThan(1);
    });
  });

  describe('清理', () => {
    it('removeCompletedTasks 应移除已完成任务', () => {
      const t1 = manager.createTask({
        targetId: 't1', targetName: 'T1', sourceId: 's1', sourceName: 'S1',
        strategy: null,
        expedition: { forceId: 'f1', heroId: 'h1', heroName: 'H1', troops: 100 },
        cost: { troops: 50, grain: 10 }, marchPath: [], faction: 'wei' as const,
        faction: 'wei' as const,
      });

      // 完成 t1
      manager.advanceStatus(t1.id, 'marching');
      manager.advanceStatus(t1.id, 'sieging');
      manager.advanceStatus(t1.id, 'settling');
      manager.advanceStatus(t1.id, 'returning');
      manager.advanceStatus(t1.id, 'completed');

      // 创建活跃任务
      manager.createTask({
        targetId: 't2', targetName: 'T2', sourceId: 's1', sourceName: 'S1',
        strategy: null,
        expedition: { forceId: 'f2', heroId: 'h2', heroName: 'H2', troops: 100 },
        cost: { troops: 50, grain: 10 }, marchPath: [], faction: 'wei' as const,
        faction: 'wei' as const,
      });

      const removed = manager.removeCompletedTasks();
      expect(removed).toBe(1);
      expect(manager.getAllTasks()).toHaveLength(1);
      expect(manager.activeCount).toBe(1);
    });
  });
});
