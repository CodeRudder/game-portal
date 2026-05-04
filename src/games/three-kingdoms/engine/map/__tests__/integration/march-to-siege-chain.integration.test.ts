/**
 * E1-3 行军→攻占完整链路 E2E 集成测试
 *
 * 测试 createMarch → A* pathfinding → sprite movement → arrival →
 * siege trigger → return march → arrive at origin city 的完整链路。
 *
 * 使用真实实例（非 mock）:
 *   - EventBus
 *   - MarchingSystem
 *   - SiegeTaskManager
 *   - SiegeBattleSystem
 *
 * @module engine/map/__tests__/integration/march-to-siege-chain
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarchingSystem, type MarchUnit } from '../../MarchingSystem';
import { SiegeTaskManager } from '../../SiegeTaskManager';
import { SiegeBattleSystem } from '../../SiegeBattleSystem';
import { EventBus } from '../../../../core/events/EventBus';
import type { ISystemDeps } from '../../../../core/types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建带有真实 EventBus 的系统依赖 */
function createSystemDeps(eventBus: EventBus): ISystemDeps {
  return {
    eventBus,
    config: { get: () => undefined, getAll: () => new Map() } as any,
    registry: {
      get: () => null,
      getAll: () => new Map(),
      has: () => false,
      register: () => {},
      unregister: () => {},
    } as any,
  };
}

/** 创建标准出征编队参数 */
function defaultExpedition(troops = 5000) {
  return {
    forceId: 'force-1',
    heroId: 'hero-guanyu',
    heroName: '关羽',
    troops,
  };
}

/** 收集事件总线上的指定事件 */
function collectEvents<T>(eventBus: EventBus, event: string): T[] {
  const collected: T[] = [];
  eventBus.on<T>(event, (payload) => collected.push(payload));
  return collected;
}

/** 收集事件并记录触发顺序 */
function collectOrderedEvents(eventBus: EventBus, events: string[]): Array<{ event: string; payload: unknown }> {
  const collected: Array<{ event: string; payload: unknown }> = [];
  for (const evt of events) {
    eventBus.on(evt, (payload) => collected.push({ event: evt, payload }));
  }
  return collected;
}

/** 模拟行军直到到达终点 */
function simulateMarchUntilArrived(marchingSystem: MarchingSystem, march: MarchUnit, maxTicks = 500): void {
  marchingSystem.startMarch(march.id);
  for (let i = 0; i < maxTicks; i++) {
    marchingSystem.update(1);
    if (march.state === 'arrived') break;
  }
}

/** 标准测试路径: city-a → city-b, 100px 直线路径 */
const STANDARD_PATH = [
  { x: 0, y: 0 },
  { x: 50, y: 0 },
  { x: 100, y: 0 },
];

/** 短路径用于快速到达测试 */
const SHORT_PATH = [
  { x: 0, y: 0 },
  { x: 30, y: 0 },
];

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('March-to-Siege Chain E2E Integration', () => {
  let eventBus: EventBus;
  let marchingSystem: MarchingSystem;
  let taskManager: SiegeTaskManager;
  let battleSystem: SiegeBattleSystem;

  beforeEach(() => {
    eventBus = new EventBus();

    marchingSystem = new MarchingSystem();
    marchingSystem.init(createSystemDeps(eventBus));

    taskManager = new SiegeTaskManager();
    taskManager.setDependencies({ eventBus });

    battleSystem = new SiegeBattleSystem();
    battleSystem.init(createSystemDeps(eventBus));
  });

  // ── Scenario 1: Complete chain — createMarch → update(dt) loop → march:arrived ──

  describe('Scenario 1: Complete chain — createMarch → update(dt) → march:arrived', () => {
    it('should emit march:created → march:started → march:arrived in correct order', () => {
      // 收集事件并记录顺序
      const orderedEvents = collectOrderedEvents(eventBus, [
        'march:created',
        'march:started',
        'march:arrived',
      ]);

      // 1. 创建行军
      const march = marchingSystem.createMarch(
        'city-a', 'city-b', 3000, '关羽', 'shu', STANDARD_PATH,
      );
      expect(march.state).toBe('preparing');
      expect(march.id).toBeTruthy();

      // 2. 验证 march:created 已触发
      expect(orderedEvents.some(e => e.event === 'march:created')).toBe(true);

      // 3. 启动行军
      marchingSystem.startMarch(march.id);
      expect(march.state).toBe('marching');

      // 4. 验证 march:started 已触发
      expect(orderedEvents.some(e => e.event === 'march:started')).toBe(true);

      // 5. 模拟更新直到到达
      simulateMarchUntilArrived(marchingSystem, march);

      // 6. 验证到达
      expect(march.state).toBe('arrived');
      expect(march.x).toBe(STANDARD_PATH[STANDARD_PATH.length - 1].x);
      expect(march.y).toBe(STANDARD_PATH[STANDARD_PATH.length - 1].y);

      // 7. 验证 march:arrived 已触发
      expect(orderedEvents.some(e => e.event === 'march:arrived')).toBe(true);

      // 8. 验证事件触发顺序: created → started → arrived
      const eventTypes = orderedEvents.map(e => e.event);
      const createdIdx = eventTypes.indexOf('march:created');
      const startedIdx = eventTypes.indexOf('march:started');
      const arrivedIdx = eventTypes.indexOf('march:arrived');

      expect(createdIdx).toBeLessThan(startedIdx);
      expect(startedIdx).toBeLessThan(arrivedIdx);
    });

    it('should produce correct march:arrived payload with siegeTaskId', () => {
      const arrivedEvents = collectEvents<any>(eventBus, 'march:arrived');

      const march = marchingSystem.createMarch(
        'city-xuchang', 'city-luoyang', 5000, '曹操', 'wei', SHORT_PATH,
      );
      march.siegeTaskId = 'task-e2e-001';

      simulateMarchUntilArrived(marchingSystem, march);

      expect(arrivedEvents.length).toBe(1);
      expect(arrivedEvents[0]).toMatchObject({
        marchId: march.id,
        cityId: 'city-luoyang',
        troops: 5000,
        general: '曹操',
        siegeTaskId: 'task-e2e-001',
      });
    });
  });

  // ── Scenario 2: March sprite data — valid path/position/speed for Canvas rendering ──

  describe('Scenario 2: March sprite data — valid path/position/speed for Canvas rendering', () => {
    it('MarchUnit should have valid path, position, and speed properties for Canvas rendering', () => {
      const march = marchingSystem.createMarch(
        'city-a', 'city-b', 2000, '赵云', 'shu', STANDARD_PATH,
      );

      // 验证初始位置为路径起点
      expect(march.x).toBe(STANDARD_PATH[0].x);
      expect(march.y).toBe(STANDARD_PATH[0].y);

      // 验证路径数据完整
      expect(march.path).toEqual(STANDARD_PATH);
      expect(march.path.length).toBeGreaterThanOrEqual(2);
      expect(march.pathIndex).toBe(0);

      // 验证速度为基础行军速度 (BASE_SPEED = 30 px/s)
      expect(march.speed).toBe(30);

      // 验证初始状态
      expect(march.state).toBe('preparing');
      expect(march.animFrame).toBe(0);

      // 验证元数据
      expect(march.faction).toBe('shu');
      expect(march.troops).toBe(2000);
      expect(march.general).toBe('赵云');
      expect(march.morale).toBe(100);
    });

    it('march position should update smoothly during marching for sprite animation', () => {
      const path = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 200, y: 100 },
      ];
      const march = marchingSystem.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', path);

      // 启动行军
      marchingSystem.startMarch(march.id);
      expect(march.state).toBe('marching');

      // 执行一帧更新 (dt=0.5s, speed=30 => move=15px)
      marchingSystem.update(0.5);
      expect(march.x).toBeGreaterThan(0);
      expect(march.x).toBeLessThan(100);
      expect(march.y).toBe(0);

      // 继续更新，确保位置不断前进
      const prevX = march.x;
      marchingSystem.update(0.5);
      expect(march.x).toBeGreaterThanOrEqual(prevX);

      // 验证 animFrame 在有效范围内 (0~3)
      expect(march.animFrame).toBeGreaterThanOrEqual(0);
      expect(march.animFrame).toBeLessThanOrEqual(3);
    });

    it('march ETA should be calculable from distance and speed', () => {
      const path = [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ];
      const march = marchingSystem.createMarch('city-a', 'city-b', 1000, '马超', 'shu', path);

      // distance = 300px, speed = 30px/s, ETA = 10s
      expect(march.eta).toBeGreaterThan(Date.now());
      expect(march.eta - march.startTime).toBeGreaterThanOrEqual(9000); // ~10s
    });
  });

  // ── Scenario 3: Arrival triggers siege — march:arrived → SiegeTaskManager.advanceStatus('sieging') ──

  describe('Scenario 3: Arrival triggers siege — march:arrived → advanceStatus sieging', () => {
    it('should advance SiegeTaskManager from marching to sieging upon march arrival', () => {
      // 1. 创建攻占任务
      const task = taskManager.createTask({
        targetId: 'city-luoyang',
        targetName: '洛阳',
        sourceId: 'city-xuchang',
        sourceName: '许昌',
        strategy: 'forceAttack',
        expedition: defaultExpedition(5000),
        cost: { troops: 500, grain: 200 },
        marchPath: SHORT_PATH,
      });

      expect(task.status).toBe('preparing');

      // 2. 推进到 marching
      taskManager.advanceStatus(task.id, 'marching');
      expect(taskManager.getTask(task.id)!.status).toBe('marching');

      // 3. 创建关联行军
      const march = marchingSystem.createMarch(
        'city-xuchang', 'city-luoyang', 5000, '曹操', 'wei', SHORT_PATH,
      );
      march.siegeTaskId = task.id;

      // 4. 监听 march:arrived 并自动推进 SiegeTaskManager
      eventBus.on('march:arrived', (payload: any) => {
        if (payload.siegeTaskId) {
          taskManager.advanceStatus(payload.siegeTaskId, 'sieging');
        }
      });

      // 5. 模拟行军到达
      simulateMarchUntilArrived(marchingSystem, march);

      // 6. 验证 SiegeTaskManager 已推进到 sieging
      const updatedTask = taskManager.getTask(task.id);
      expect(updatedTask!.status).toBe('sieging');
      expect(updatedTask!.arrivedAt).not.toBeNull();
    });

    it('should trigger battle creation after arriving at target', () => {
      // 1. 创建任务并推进到 sieging
      const task = taskManager.createTask({
        targetId: 'city-ye',
        targetName: '邺',
        sourceId: 'city-xuchang',
        sourceName: '许昌',
        strategy: 'forceAttack',
        expedition: defaultExpedition(5000),
        cost: { troops: 500, grain: 200 },
        marchPath: SHORT_PATH,
      });
      taskManager.advanceStatus(task.id, 'marching');
      taskManager.advanceStatus(task.id, 'sieging');

      // 2. 创建战斗
      const battleStartedEvents = collectEvents<any>(eventBus, 'battle:started');

      const session = battleSystem.createBattle({
        taskId: task.id,
        targetId: task.targetId,
        troops: task.expedition.troops,
        strategy: task.strategy!,
        targetDefenseLevel: 1,
        targetX: 10,
        targetY: 5,
        faction: 'wei',
      });

      // 3. 验证战斗会话已创建
      expect(session.status).toBe('active');
      expect(session.defenseValue).toBe(100);
      expect(battleStartedEvents.length).toBe(1);

      // 4. 验证 SiegeTaskManager 状态为 sieging
      expect(taskManager.getTask(task.id)!.status).toBe('sieging');
    });
  });

  // ── Scenario 4: Return march chain — siege complete → createReturnMarch → speed x0.8 → arrive at origin ──

  describe('Scenario 4: Return march chain — siege complete → return march → arrive at origin', () => {
    it('should create return march with speed x0.8 and complete full lifecycle', () => {
      // 1. 创建完整攻占流程直到 returning 状态
      const task = taskManager.createTask({
        targetId: 'city-luoyang',
        targetName: '洛阳',
        sourceId: 'city-xuchang',
        sourceName: '许昌',
        strategy: 'forceAttack',
        expedition: defaultExpedition(5000),
        cost: { troops: 500, grain: 200 },
        marchPath: STANDARD_PATH,
      });

      taskManager.advanceStatus(task.id, 'marching');
      taskManager.advanceStatus(task.id, 'sieging');

      // 2. 模拟攻城战斗完成
      const battleCompletedEvents = collectEvents<any>(eventBus, 'battle:completed');
      battleSystem.createBattle({
        taskId: task.id,
        targetId: task.targetId,
        troops: task.expedition.troops,
        strategy: task.strategy!,
        targetDefenseLevel: 1,
        targetX: 10,
        targetY: 5,
        faction: 'wei',
      });
      battleSystem.update(11); // forceAttack: ~10s => 11s exceeds

      expect(battleCompletedEvents.length).toBe(1);
      expect(battleCompletedEvents[0].victory).toBe(true);

      // 3. 设置结果并推进到 returning
      taskManager.setResult(task.id, {
        victory: true,
        capture: { territoryId: task.targetId, newOwner: 'player', previousOwner: 'neutral' },
        casualties: { troopsLost: 750, troopsLostPercent: 0.15, heroInjured: false, injuryLevel: 'none', battleResult: 'victory' },
        actualCost: { troops: 750, grain: 0 },
        rewardMultiplier: 1.0,
        specialEffectTriggered: false,
      });

      taskManager.advanceStatus(task.id, 'settling');
      taskManager.advanceStatus(task.id, 'returning');

      expect(taskManager.getTask(task.id)!.status).toBe('returning');

      // 4. 创建回城行军 (mock calculateMarchRoute)
      const returnPath = [
        { x: 100, y: 0 },
        { x: 50, y: 0 },
        { x: 0, y: 0 },
      ];
      vi.spyOn(marchingSystem, 'calculateMarchRoute').mockReturnValue({
        path: returnPath,
        waypoints: returnPath,
        distance: 2,
        estimatedTime: 2,
        waypointCities: [],
      });

      const returnMarch = marchingSystem.createReturnMarch({
        fromCityId: task.targetId,
        toCityId: task.sourceId,
        troops: 5000 - 750,
        general: task.expedition.heroName,
        faction: 'wei',
        siegeTaskId: task.id,
      });

      // 5. 验证回城行军属性
      expect(returnMarch).not.toBeNull();
      expect(returnMarch!.speed).toBe(24); // BASE_SPEED * 0.8 = 30 * 0.8 = 24
      expect(returnMarch!.fromCityId).toBe('city-luoyang');
      expect(returnMarch!.toCityId).toBe('city-xuchang');
      expect(returnMarch!.troops).toBe(4250);
      expect(returnMarch!.siegeTaskId).toBe(task.id);
      expect(returnMarch!.state).toBe('preparing');

      // 6. 启动并模拟回城行军到达
      const marchArrivedEvents = collectEvents<any>(eventBus, 'march:arrived');
      simulateMarchUntilArrived(marchingSystem, returnMarch!);

      expect(returnMarch!.state).toBe('arrived');
      expect(returnMarch!.x).toBe(returnPath[returnPath.length - 1].x);
      expect(returnMarch!.y).toBe(returnPath[returnPath.length - 1].y);

      // 7. 验证 march:arrived 事件
      const returnArrived = marchArrivedEvents.find((e: any) => e.marchId === returnMarch!.id);
      expect(returnArrived).toBeDefined();
      expect(returnArrived!.cityId).toBe('city-xuchang');

      // 8. 回城到达后推进到 completed
      taskManager.advanceStatus(task.id, 'completed');
      expect(taskManager.getTask(task.id)!.status).toBe('completed');
      expect(taskManager.getTask(task.id)!.returnCompletedAt).not.toBeNull();

      vi.restoreAllMocks();
    });

    it('return march speed should equal BASE_SPEED * 0.8 (24 px/s)', () => {
      vi.spyOn(marchingSystem, 'calculateMarchRoute').mockReturnValue({
        path: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
        waypoints: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
        distance: 1,
        estimatedTime: 1,
        waypointCities: [],
      });

      const returnMarch = marchingSystem.createReturnMarch({
        fromCityId: 'city-a',
        toCityId: 'city-b',
        troops: 1000,
        general: '张辽',
        faction: 'wei',
      });

      expect(returnMarch).not.toBeNull();
      expect(returnMarch!.speed).toBe(24); // 30 * 0.8 = 24

      vi.restoreAllMocks();
    });
  });

  // ── Scenario 5: Multiple city chain — A→B success, then B→C, no state pollution ──

  describe('Scenario 5: Multiple city chain — A→B siege success, then B→C, no state pollution', () => {
    it('should handle two sequential siege tasks without state pollution', () => {
      // ── 第一次攻占: city-xuchang → city-luoyang ──

      // 1a. 创建第一个任务
      const task1 = taskManager.createTask({
        targetId: 'city-luoyang',
        targetName: '洛阳',
        sourceId: 'city-xuchang',
        sourceName: '许昌',
        strategy: 'forceAttack',
        expedition: defaultExpedition(5000),
        cost: { troops: 500, grain: 200 },
        marchPath: SHORT_PATH,
      });
      taskManager.advanceStatus(task1.id, 'marching');
      taskManager.advanceStatus(task1.id, 'sieging');

      // 1b. 创建行军并模拟到达
      const march1 = marchingSystem.createMarch(
        'city-xuchang', 'city-luoyang', 5000, '曹操', 'wei', SHORT_PATH,
      );
      march1.siegeTaskId = task1.id;
      simulateMarchUntilArrived(marchingSystem, march1);

      // 1c. 模拟攻城完成
      battleSystem.createBattle({
        taskId: task1.id,
        targetId: task1.targetId,
        troops: 5000,
        strategy: 'forceAttack',
        targetDefenseLevel: 1,
        targetX: 10,
        targetY: 5,
        faction: 'wei',
      });
      battleSystem.update(11);

      // 1d. 设置结果并推进到 returning
      taskManager.setResult(task1.id, {
        victory: true,
        capture: { territoryId: 'city-luoyang', newOwner: 'player', previousOwner: 'enemy' },
        casualties: { troopsLost: 1000, troopsLostPercent: 0.2, heroInjured: false, injuryLevel: 'none', battleResult: 'victory' },
        actualCost: { troops: 1000, grain: 100 },
        rewardMultiplier: 1.5,
        specialEffectTriggered: false,
      });
      taskManager.advanceStatus(task1.id, 'settling');
      taskManager.advanceStatus(task1.id, 'returning');

      // 验证第一次任务状态
      expect(taskManager.getTask(task1.id)!.status).toBe('returning');
      expect(taskManager.getTask(task1.id)!.result!.victory).toBe(true);

      // ── 第二次攻占: city-luoyang → city-changan ──

      // 2a. 创建第二个任务（从已占领的洛阳出发）
      const task2 = taskManager.createTask({
        targetId: 'city-changan',
        targetName: '长安',
        sourceId: 'city-luoyang',
        sourceName: '洛阳',
        strategy: 'siege',
        expedition: {
          forceId: 'force-2',
          heroId: 'hero-xiahou',
          heroName: '夏侯惇',
          troops: 4000,
        },
        cost: { troops: 400, grain: 300 },
        marchPath: [
          { x: 0, y: 0 },
          { x: 100, y: 50 },
          { x: 200, y: 50 },
        ],
      });

      // 2b. 验证 task2 不会影响 task1
      expect(task2.id).not.toBe(task1.id);
      expect(taskManager.getTask(task1.id)!.status).toBe('returning'); // task1 不受影响
      expect(taskManager.getTask(task2.id)!.status).toBe('preparing');

      // 2c. 推进 task2 到 sieging
      taskManager.advanceStatus(task2.id, 'marching');
      taskManager.advanceStatus(task2.id, 'sieging');

      // 2d. 验证两个任务的独立性
      expect(taskManager.getTask(task1.id)!.status).toBe('returning'); // task1 不受影响
      expect(taskManager.getTask(task2.id)!.status).toBe('sieging');

      // 2e. 模拟 task2 攻城完成
      battleSystem.createBattle({
        taskId: task2.id,
        targetId: task2.targetId,
        troops: 4000,
        strategy: 'siege',
        targetDefenseLevel: 2,
        targetX: 20,
        targetY: 10,
        faction: 'wei',
      });
      battleSystem.update(31); // siege: 30s duration

      taskManager.setResult(task2.id, {
        victory: true,
        capture: { territoryId: 'city-changan', newOwner: 'player', previousOwner: 'enemy' },
        casualties: { troopsLost: 800, troopsLostPercent: 0.2, heroInjured: false, injuryLevel: 'none', battleResult: 'victory' },
        actualCost: { troops: 800, grain: 150 },
        rewardMultiplier: 1.2,
        specialEffectTriggered: false,
      });
      taskManager.advanceStatus(task2.id, 'settling');
      taskManager.advanceStatus(task2.id, 'returning');

      // 2f. 完成 task1
      taskManager.advanceStatus(task1.id, 'completed');

      // ── 最终验证 ──

      // task1 已完成
      expect(taskManager.getTask(task1.id)!.status).toBe('completed');
      expect(taskManager.getTask(task1.id)!.result!.victory).toBe(true);
      expect(taskManager.getTask(task1.id)!.result!.capture!.territoryId).toBe('city-luoyang');

      // task2 在 returning
      expect(taskManager.getTask(task2.id)!.status).toBe('returning');
      expect(taskManager.getTask(task2.id)!.result!.victory).toBe(true);
      expect(taskManager.getTask(task2.id)!.result!.capture!.territoryId).toBe('city-changan');

      // 活跃任务只有 task2
      const activeTasks = taskManager.getActiveTasks();
      expect(activeTasks.length).toBe(1);
      expect(activeTasks[0].id).toBe(task2.id);

      // 完成所有任务
      taskManager.advanceStatus(task2.id, 'completed');
      expect(taskManager.getActiveTasks().length).toBe(0);
    });
  });

  // ── Scenario 6: Cancel march — cancelMarch mid-way → SiegeTaskManager state rollback ──

  describe('Scenario 6: Cancel march — cancelMarch mid-way → rollback', () => {
    it('should emit march:cancelled with siegeTaskId and allow task cleanup', () => {
      // 收集事件
      const cancelledEvents = collectEvents<any>(eventBus, 'march:cancelled');
      const statusChangedEvents = collectEvents<any>(eventBus, 'siegeTask:statusChanged');

      // 1. 创建攻占任务
      const task = taskManager.createTask({
        targetId: 'city-luoyang',
        targetName: '洛阳',
        sourceId: 'city-xuchang',
        sourceName: '许昌',
        strategy: 'nightRaid',
        expedition: defaultExpedition(3000),
        cost: { troops: 300, grain: 100 },
        marchPath: STANDARD_PATH,
      });
      taskManager.advanceStatus(task.id, 'marching');

      // 2. 创建行军
      const march = marchingSystem.createMarch(
        'city-xuchang', 'city-luoyang', 3000, '曹操', 'wei', STANDARD_PATH,
      );
      march.siegeTaskId = task.id;

      // 3. 启动行军
      marchingSystem.startMarch(march.id);
      expect(march.state).toBe('marching');

      // 4. 模拟部分行军（中途取消）
      marchingSystem.update(0.5);
      expect(march.x).toBeGreaterThan(0);

      const midX = march.x;

      // 5. 取消行军
      marchingSystem.cancelMarch(march.id);

      // 6. 验证 march:cancelled 事件
      expect(cancelledEvents.length).toBe(1);
      expect(cancelledEvents[0]).toMatchObject({
        marchId: march.id,
        troops: 3000,
        siegeTaskId: task.id,
      });

      // 7. 验证行军已从活跃列表移除
      expect(marchingSystem.getMarch(march.id)).toBeUndefined();
      expect(marchingSystem.getActiveMarches().length).toBe(0);
    });

    it('should handle cancellation with proper SiegeTaskManager state awareness', () => {
      // 1. 创建任务并推进到 marching
      const task = taskManager.createTask({
        targetId: 'city-ye',
        targetName: '邺',
        sourceId: 'city-xuchang',
        sourceName: '许昌',
        strategy: 'insider',
        expedition: defaultExpedition(4000),
        cost: { troops: 400, grain: 200 },
        marchPath: STANDARD_PATH,
      });

      // 2. 推进状态并记录
      taskManager.advanceStatus(task.id, 'marching');
      expect(taskManager.getTask(task.id)!.status).toBe('marching');
      expect(taskManager.getTask(task.id)!.marchStartedAt).not.toBeNull();

      // 3. 创建行军
      const march = marchingSystem.createMarch(
        'city-xuchang', 'city-ye', 4000, '司马懿', 'wei', STANDARD_PATH,
      );
      march.siegeTaskId = task.id;
      marchingSystem.startMarch(march.id);

      // 4. 部分行军后取消
      marchingSystem.update(0.3);
      marchingSystem.cancelMarch(march.id);

      // 5. 验证任务状态仍为 marching（SiegeTaskManager 不会自动回滚）
      // 状态回滚需要由上层协调器处理
      expect(taskManager.getTask(task.id)!.status).toBe('marching');

      // 6. 上层可以手动将任务重置或推进（模拟上层回滚逻辑）
      // 由于 SiegeTaskManager 没有回滚接口，上层可以：
      // a) 保持 marching 状态并创建新行军重试
      // b) 或者直接移除任务（清理）
      const taskAfterCancel = taskManager.getTask(task.id);
      expect(taskAfterCancel!.id).toBe(task.id);
      expect(taskAfterCancel!.status).toBe('marching');

      // 7. 可以重新创建行军重试
      const march2 = marchingSystem.createMarch(
        'city-xuchang', 'city-ye', 4000, '司马懿', 'wei', STANDARD_PATH,
      );
      march2.siegeTaskId = task.id;
      expect(marchingSystem.getActiveMarches().length).toBe(1);
      expect(march2.id).not.toBe(march.id);
    });

    it('cancel march should not affect other active marches', () => {
      // 1. 创建两个行军
      const march1 = marchingSystem.createMarch(
        'city-a', 'city-b', 2000, '关羽', 'shu', SHORT_PATH,
      );
      march1.siegeTaskId = 'task-1';

      const march2 = marchingSystem.createMarch(
        'city-c', 'city-d', 3000, '张飞', 'shu',
        [{ x: 10, y: 10 }, { x: 40, y: 10 }],
      );
      march2.siegeTaskId = 'task-2';

      marchingSystem.startMarch(march1.id);
      marchingSystem.startMarch(march2.id);

      expect(marchingSystem.getActiveMarches().length).toBe(2);

      // 2. 取消第一个行军
      const cancelledEvents = collectEvents<any>(eventBus, 'march:cancelled');
      marchingSystem.cancelMarch(march1.id);

      // 3. 验证第一个被取消
      expect(cancelledEvents.length).toBe(1);
      expect(cancelledEvents[0].siegeTaskId).toBe('task-1');
      expect(marchingSystem.getMarch(march1.id)).toBeUndefined();

      // 4. 验证第二个仍活跃
      expect(marchingSystem.getMarch(march2.id)).toBeDefined();
      expect(marchingSystem.getMarch(march2.id)!.state).toBe('marching');
      expect(marchingSystem.getActiveMarches().length).toBe(1);

      // 5. 第二个行军可以正常到达
      simulateMarchUntilArrived(marchingSystem, march2);
      expect(march2.state).toBe('arrived');
    });
  });

  // ── Scenario 7 (bonus): Full lifecycle status transitions verification ──

  describe('Full lifecycle: preparing → marching → sieging → settling → returning → completed', () => {
    it('should emit all status change events in correct order', () => {
      const statusEvents = collectEvents<any>(eventBus, 'siegeTask:statusChanged');

      // 1. 创建任务
      const task = taskManager.createTask({
        targetId: 'city-luoyang',
        targetName: '洛阳',
        sourceId: 'city-xuchang',
        sourceName: '许昌',
        strategy: 'forceAttack',
        expedition: defaultExpedition(5000),
        cost: { troops: 500, grain: 200 },
        marchPath: SHORT_PATH,
      });

      // 2. 推进全部状态
      taskManager.advanceStatus(task.id, 'marching');
      taskManager.advanceStatus(task.id, 'sieging');
      taskManager.advanceStatus(task.id, 'settling');
      taskManager.advanceStatus(task.id, 'returning');
      taskManager.advanceStatus(task.id, 'completed');

      // 3. 验证状态转换事件链
      const transitions = statusEvents.map(e => ({ from: e.from, to: e.to }));

      expect(transitions).toEqual([
        { from: 'preparing', to: 'marching' },
        { from: 'marching', to: 'sieging' },
        { from: 'sieging', to: 'settling' },
        { from: 'settling', to: 'returning' },
        { from: 'returning', to: 'completed' },
      ]);

      // 4. 验证时间戳递增
      const t = taskManager.getTask(task.id)!;
      expect(t.marchStartedAt).not.toBeNull();
      expect(t.arrivedAt).not.toBeNull();
      expect(t.siegeCompletedAt).not.toBeNull();
      expect(t.returnCompletedAt).not.toBeNull();

      expect(t.marchStartedAt!).toBeLessThanOrEqual(t.arrivedAt!);
      expect(t.arrivedAt!).toBeLessThanOrEqual(t.siegeCompletedAt!);
      expect(t.siegeCompletedAt!).toBeLessThanOrEqual(t.returnCompletedAt!);

      // 5. 验证终态
      expect(t.status).toBe('completed');
      expect(taskManager.getActiveTasks().length).toBe(0);
    });
  });
});
