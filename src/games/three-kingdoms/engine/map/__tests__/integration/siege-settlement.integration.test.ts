/**
 * 攻占结算集成测试 (I14)
 *
 * 测试 battle:completed -> SiegeResultCalculator -> SiegeTaskManager 完整链路
 *
 * 验证场景：
 * 1. 大胜 -> decisiveVictory 结果 -> 结算正确计算
 * 2. 失败 -> defeat 结果 -> 结算正确计算
 * 3. 险胜 + 将领受伤场景
 * 4. 完整链路: 创建战斗 -> 推进到完成 -> 计算结算 -> 推进状态
 * 5. 多个战斗连续完成
 *
 * @module engine/map/__tests__/integration/siege-settlement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SiegeBattleSystem } from '../../SiegeBattleSystem';
import { SiegeResultCalculator } from '../../SiegeResultCalculator';
import { SiegeTaskManager } from '../../SiegeTaskManager';
import { EventBus } from '../../../../core/events/EventBus';
import type { BattleCompletedEvent } from '../../SiegeBattleSystem';
import type { CasualtyResult } from '../../expedition-types';
import type { ISystemDeps } from '../../../../core/types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建带有真实 EventBus 的系统依赖 */
function createRealDeps(): ISystemDeps {
  const eventBus = new EventBus();
  return {
    eventBus,
    config: { get: () => undefined, getAll: () => new Map() } as any,
    registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} } as any,
  };
}

/** 收集 emitted 事件的辅助函数 */
function collectEvents<T>(eventBus: EventBus, event: string): T[] {
  const collected: T[] = [];
  eventBus.on<T>(event, (payload) => collected.push(payload));
  return collected;
}

/** 创建一个典型的胜利 BattleCompletedEvent */
function createVictoryEvent(overrides?: Partial<BattleCompletedEvent>): BattleCompletedEvent {
  return {
    taskId: 'test-task-1',
    targetId: 'city-luoyang',
    victory: true,
    strategy: 'forceAttack',
    troops: 5000,
    elapsedMs: 8000,        // 快速胜利 -> decisiveVictory
    remainingDefense: 0,
    ...overrides,
  };
}

/** 创建一个典型的失败 BattleCompletedEvent */
function createDefeatEvent(overrides?: Partial<BattleCompletedEvent>): BattleCompletedEvent {
  return {
    taskId: 'test-task-2',
    targetId: 'city-changsha',
    victory: false,
    strategy: 'siege',
    troops: 3000,
    elapsedMs: 20000,
    remainingDefense: 30,   // 城防剩余30%
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('Siege Settlement Integration', () => {
  let eventBus: EventBus;
  let battleSystem: SiegeBattleSystem;
  let taskManager: SiegeTaskManager;
  let calculator: SiegeResultCalculator;

  beforeEach(() => {
    eventBus = new EventBus();
    const deps = {
      eventBus,
      config: { get: () => undefined, getAll: () => new Map() } as any,
      registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} } as any,
    };

    battleSystem = new SiegeBattleSystem();
    battleSystem.init(deps);

    taskManager = new SiegeTaskManager();
    taskManager.setDependencies({ eventBus });

    calculator = new SiegeResultCalculator();
  });

  // ── Scenario 1: 大胜 -> decisiveVictory ──

  it('decisiveVictory: 快速攻破城防 + 低伤亡 + 高奖励倍率', () => {
    const event = createVictoryEvent(); // elapsedMs=8000 < 10000, remainingDefense=0

    const settlement = calculator.calculateSettlement(event, {
      targetLevel: 3,
      isFirstCapture: true,
      rng: () => 0.5, // 确定性随机
    });

    // 验证结果等级
    expect(settlement.outcome).toBe('decisiveVictory');
    expect(settlement.victory).toBe(true);

    // 验证伤亡率在 decisiveVictory 范围内 (10%~20%)
    expect(settlement.troopsLostPercent).toBeGreaterThanOrEqual(0.10);
    expect(settlement.troopsLostPercent).toBeLessThanOrEqual(0.20);
    expect(settlement.troopsLost).toBe(Math.floor(5000 * settlement.troopsLostPercent));

    // 验证将领受伤概率低 (5%)
    expect(settlement.heroInjured).toBe(false);
    expect(settlement.injuryLevel).toBe('none');

    // 验证首次攻占奖励倍率: 1.5 * 1.5 = 2.25
    expect(settlement.rewardMultiplier).toBe(2.25);
  });

  // ── Scenario 2: 失败 -> defeat ──

  it('defeat: 城防未破 + 高伤亡 + 无奖励', () => {
    const event = createDefeatEvent(); // victory=false, remainingDefense=30

    const settlement = calculator.calculateSettlement(event, {
      targetLevel: 2,
      isFirstCapture: false,
      rng: () => 0.5,
    });

    // 验证结果等级
    expect(settlement.outcome).toBe('defeat');
    expect(settlement.victory).toBe(false);

    // 验证伤亡率在 defeat 范围内 (40%~70%)
    expect(settlement.troopsLostPercent).toBeGreaterThanOrEqual(0.40);
    expect(settlement.troopsLostPercent).toBeLessThanOrEqual(0.70);

    // 验证失败无奖励
    expect(settlement.rewardMultiplier).toBe(0);
  });

  // ── Scenario 3: 险胜 + 将领受伤 ──

  it('narrowVictory: 耗时较长 + 中等伤亡 + 将领受伤可能', () => {
    const event = createVictoryEvent({
      elapsedMs: 45000,  // > 40000 -> narrowVictory
      remainingDefense: 0,
    });

    // 使用确定性 rng 使将领受伤（概率30%, rng < 0.30）
    // rng调用顺序: 伤亡率(1次) + 受伤判定(1次) + 受伤等级选择(1次)
    const rngValues = [0.5, 0.1, 0.0]; // 伤亡0.5, 受伤判定0.1<0.30=true, 等级选择0.0->moderate
    let rngIndex = 0;
    const rng = () => rngValues[rngIndex++];

    const settlement = calculator.calculateSettlement(event, {
      targetLevel: 5,
      isFirstCapture: false,
      rng,
    });

    // 验证险胜
    expect(settlement.outcome).toBe('narrowVictory');
    expect(settlement.victory).toBe(true);

    // 验证伤亡率在 narrowVictory 范围内 (30%~40%)
    expect(settlement.troopsLostPercent).toBeGreaterThanOrEqual(0.30);
    expect(settlement.troopsLostPercent).toBeLessThanOrEqual(0.40);

    // 验证将领受伤（rng=0.1 < 0.30 概率）
    expect(settlement.heroInjured).toBe(true);
    expect(['moderate', 'severe']).toContain(settlement.injuryLevel);

    // 验证奖励倍率: narrowVictory 基础 0.8
    expect(settlement.rewardMultiplier).toBe(0.8);
  });

  // ── Scenario 4: 完整链路 battle:completed -> 结算 -> 状态推进 ──

  it('完整链路: 创建战斗 -> 完成 -> 结算 -> 状态推进', () => {
    const taskId = 'siege-task-integration-1';

    // 4a. 创建攻占任务
    const task = taskManager.createTask({
      targetId: 'city-luoyang',
      targetName: '洛阳',
      sourceId: 'city-xuchang',
      sourceName: '许昌',
      strategy: 'forceAttack',
      expedition: {
        forceId: 'force-1',
        heroId: 'hero-caocao',
        heroName: '曹操',
        troops: 5000,
      },
      cost: { troops: 500, grain: 200 },
      marchPath: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      faction: 'wei' as const,
    });

    // 推进到 sieging 状态
    taskManager.advanceStatus(task.id, 'marching');
    taskManager.advanceStatus(task.id, 'sieging');

    expect(task.status).toBe('sieging');
    expect(task.result).toBeNull();

    // 4b. 收集 battle:completed 事件
    const completedEvents: BattleCompletedEvent[] = [];
    eventBus.on<BattleCompletedEvent>('battle:completed', (e) => completedEvents.push(e));

    // 4c. 创建战斗会话并快速推进到完成
    battleSystem.createBattle({
      taskId: task.id,
      targetId: 'city-luoyang',
      troops: 5000,
      strategy: 'forceAttack',
      targetDefenseLevel: 1,
      targetX: 10,
      targetY: 5,
      faction: 'wei' as const,
    });

    // 推进战斗直到完成 (baseDuration=15s - strategyModifier=-5s = 10s for forceAttack)
    battleSystem.update(11); // 超过10s -> 战斗完成

    // 4d. 验证 battle:completed 事件已触发
    expect(completedEvents.length).toBe(1);
    const battleEvent = completedEvents[0];
    expect(battleEvent.taskId).toBe(task.id);
    expect(battleEvent.targetId).toBe('city-luoyang');
    expect(battleEvent.victory).toBe(true); // 城防耗尽

    // 4e. 使用 SiegeResultCalculator 计算结算
    const settlement = calculator.calculateSettlement(battleEvent, {
      targetLevel: 1,
      isFirstCapture: true,
      rng: () => 0.5,
    });

    expect(settlement.victory).toBe(true);
    expect(settlement.troopsLost).toBeGreaterThan(0);
    expect(settlement.rewardMultiplier).toBeGreaterThan(0);

    // 4f. 设置攻城结果并推进状态
    const casualties: CasualtyResult = {
      troopsLost: settlement.troopsLost,
      troopsLostPercent: settlement.troopsLostPercent,
      heroInjured: settlement.heroInjured,
      injuryLevel: settlement.injuryLevel,
      battleResult: settlement.victory ? 'victory' : 'defeat',
    };

    taskManager.setResult(task.id, {
      victory: settlement.victory,
      capture: {
        territoryId: 'city-luoyang',
        newOwner: 'player',
        previousOwner: 'neutral',
      },
      casualties,
      actualCost: { troops: settlement.troopsLost, grain: 0 },
      rewardMultiplier: settlement.rewardMultiplier,
      specialEffectTriggered: false,
    });

    taskManager.advanceStatus(task.id, 'settling');
    taskManager.advanceStatus(task.id, 'returning');

    // 4g. 验证最终任务状态
    const updatedTask = taskManager.getTask(task.id);
    expect(updatedTask).not.toBeNull();
    expect(updatedTask!.status).toBe('returning');
    expect(updatedTask!.result).not.toBeNull();
    expect(updatedTask!.result!.victory).toBe(true);
    expect(updatedTask!.result!.casualties).toEqual(casualties);
    expect(updatedTask!.result!.rewardMultiplier).toBe(settlement.rewardMultiplier);
  });

  // ── Scenario 5: 多个战斗连续完成 ──

  it('多个战斗连续完成: 多个任务同时结算', () => {
    const completedEvents: BattleCompletedEvent[] = [];
    eventBus.on<BattleCompletedEvent>('battle:completed', (e) => completedEvents.push(e));

    // 创建3个任务
    const tasks = [];
    for (let i = 1; i <= 3; i++) {
      const task = taskManager.createTask({
        targetId: `city-target-${i}`,
        targetName: `目标${i}`,
        sourceId: 'city-xuchang',
        sourceName: '许昌',
        strategy: 'forceAttack',
        expedition: {
          forceId: `force-${i}`,
          heroId: `hero-${i}`,
          heroName: `将领${i}`,
          troops: 3000 + i * 1000,
        },
        cost: { troops: 300, grain: 100 },
        marchPath: [{ x: 0, y: 0 }],
        faction: 'wei' as const,
      });
      taskManager.advanceStatus(task.id, 'marching');
      taskManager.advanceStatus(task.id, 'sieging');
      tasks.push(task);

      // 为每个任务创建战斗
      battleSystem.createBattle({
        taskId: task.id,
        targetId: `city-target-${i}`,
        troops: 3000 + i * 1000,
        strategy: 'forceAttack',
        targetDefenseLevel: i,
        targetX: i * 10,
        targetY: i * 5,
        faction: 'wei' as const,
      });
    }

    // 推进战斗直到全部完成
    battleSystem.update(11);

    // 验证所有战斗完成
    expect(completedEvents.length).toBe(3);
    expect(completedEvents.every((e) => e.victory === true)).toBe(true);

    // 为每个战斗计算结算
    const settlements = completedEvents.map((e, i) =>
      calculator.calculateSettlement(e, {
        targetLevel: i + 1,
        isFirstCapture: i === 0,
        rng: () => 0.3,
      }),
    );

    // 验证所有结算都是胜利
    expect(settlements.every((s) => s.victory)).toBe(true);
    expect(settlements.every((s) => s.troopsLost > 0)).toBe(true);

    // 验证首个任务的首次攻占奖励倍率更高
    const firstCaptureMultiplier = settlements[0].rewardMultiplier;
    const normalMultiplier = settlements[1].rewardMultiplier;
    expect(firstCaptureMultiplier).toBeGreaterThan(normalMultiplier);

    // 设置所有结果并推进状态
    for (let i = 0; i < 3; i++) {
      const task = tasks[i];
      const s = settlements[i];

      taskManager.setResult(task.id, {
        victory: s.victory,
        capture: {
          territoryId: `city-target-${i + 1}`,
          newOwner: 'player',
          previousOwner: 'neutral',
        },
        casualties: {
          troopsLost: s.troopsLost,
          troopsLostPercent: s.troopsLostPercent,
          heroInjured: s.heroInjured,
          injuryLevel: s.injuryLevel,
          battleResult: 'victory',
        },
        actualCost: { troops: s.troopsLost, grain: 0 },
        rewardMultiplier: s.rewardMultiplier,
        specialEffectTriggered: false,
      });

      taskManager.advanceStatus(task.id, 'settling');
      taskManager.advanceStatus(task.id, 'returning');
    }

    // 验证所有任务都处于 returning 状态
    const activeTasks = taskManager.getActiveTasks();
    expect(activeTasks.length).toBe(3);
    expect(activeTasks.every((t) => t.status === 'returning')).toBe(true);
    expect(activeTasks.every((t) => t.result !== null)).toBe(true);
  });

  // ── Scenario 6: 惨败 + 高伤亡 ──

  it('rout: 城防剩余高 + 极高伤亡 + 无奖励', () => {
    const event = createDefeatEvent({
      remainingDefense: 80,  // > 50 -> rout
      troops: 2000,
    });

    const settlement = calculator.calculateSettlement(event, {
      targetLevel: 4,
      isFirstCapture: false,
      rng: () => 0.5,
    });

    // 验证惨败
    expect(settlement.outcome).toBe('rout');
    expect(settlement.victory).toBe(false);

    // 验证伤亡率在 rout 范围内 (80%~90%)
    expect(settlement.troopsLostPercent).toBeGreaterThanOrEqual(0.80);
    expect(settlement.troopsLostPercent).toBeLessThanOrEqual(0.90);

    // 验证无奖励
    expect(settlement.rewardMultiplier).toBe(0);

    // 验证兵力损失计算
    const expectedLoss = Math.floor(2000 * settlement.troopsLostPercent);
    expect(settlement.troopsLost).toBe(expectedLoss);
  });

  // ── Scenario 7: EventBus 异常隔离 ──

  it('EventBus 异常隔离: 计算器不受其他 handler 异常影响', () => {
    // 注册一个会抛异常的 handler
    eventBus.on<BattleCompletedEvent>('battle:completed', () => {
      throw new Error('Handler error');
    });

    // 收集正常 handler 的事件
    let receivedEvent: BattleCompletedEvent | null = null;
    eventBus.on<BattleCompletedEvent>('battle:completed', (e) => {
      receivedEvent = e;
    });

    // 触发事件
    const event = createVictoryEvent();
    eventBus.emit('battle:completed', event);

    // 验证正常 handler 仍然收到了事件
    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent!.taskId).toBe('test-task-1');
    expect(receivedEvent!.victory).toBe(true);

    // 验证结算计算正常
    const settlement = calculator.calculateSettlement(event, {
      targetLevel: 2,
      isFirstCapture: false,
      rng: () => 0.5,
    });
    expect(settlement.outcome).toBe('decisiveVictory');
  });
});
