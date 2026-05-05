/**
 * 集成测试 -- SiegeBattleSystem + SiegeBattleAnimationSystem 完整链路
 *
 * 使用真实 EventBus 验证两个子系统之间通过事件驱动
 * (battle:started / battle:completed / battle:cancelled) 的集成行为。
 *
 * 覆盖场景：
 *   A -- 完整生命周期 (create -> assembly -> battle -> completed -> destroy)
 *   B -- defenseRatio 手动桥接 (逐帧同步城防比值)
 *   C -- 多任务并发 (两个独立战斗/动画并行)
 *   D -- cancelBattle 中断 (取消后动画残留)
 *
 * @module engine/map/__tests__/integration/siege-battle-chain
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SiegeBattleSystem } from '../../SiegeBattleSystem';
import { SiegeBattleAnimationSystem } from '../../SiegeBattleAnimationSystem';
import { EventBus } from '../../../../core/events/EventBus';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';
import type { BattleCompletedEvent, BattleStartedEvent } from '../../SiegeBattleSystem';

// ─────────────────────────────────────────────
// 真实 EventBus + 最小 stub
// ─────────────────────────────────────────────

/**
 * 创建包含真实 EventBus 的 ISystemDeps。
 * config 和 registry 使用最小 stub 实现。
 */
function createRealDeps(): ISystemDeps {
  const eventBus = new EventBus();

  const config = {
    get: () => undefined,
    set: () => {},
    has: () => false,
    delete: () => {},
    loadFromConstants: () => {},
    getAll: () => ({} as Record<string, unknown>),
  };

  const subsystems = new Map<string, unknown>();

  const registry: ISubsystemRegistry = {
    register: (name: string, subsystem: unknown) => { subsystems.set(name, subsystem); },
    get: <T>(name: string) => subsystems.get(name) as T,
    getAll: () => new Map() as Map<string, any>,
    has: (name: string) => subsystems.has(name),
    unregister: (name: string) => { subsystems.delete(name); },
  };

  return { eventBus, config: config as any, registry };
}

/** 创建战斗用的标准参数 */
function defaultBattleParams(taskId = 'task-001') {
  return {
    taskId,
    targetId: 'city-luoyang',
    troops: 1000, // 使用 BASE_TROOPS 保持1x速度，测试可预测
    strategy: 'forceAttack' as const,
    targetDefenseLevel: 1,
    targetX: 25,
    targetY: 15,
    faction: 'wei' as const,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('SiegeBattleChain Integration', () => {
  let battleSystem: SiegeBattleSystem;
  let animSystem: SiegeBattleAnimationSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    // 使用极短的战斗时长和短集结时间来加速测试
    battleSystem = new SiegeBattleSystem({
      baseDurationMs: 1000,
      baseDefenseValue: 100,
      minDurationMs: 500,
      maxDurationMs: 60_000,
    });

    animSystem = new SiegeBattleAnimationSystem({
      assemblyDurationMs: 3_000, // 保持默认 3s 集结
      completedLingerMs: 2_000,
    });

    deps = createRealDeps();

    // 两个系统共享同一个 EventBus
    battleSystem.init(deps);
    animSystem.init(deps);
  });

  // ─────────────────────────────────────────────
  // Scenario A -- 完整生命周期
  // ─────────────────────────────────────────────

  it('Scenario A: complete lifecycle -- create -> assembly -> battle -> completed -> destroy', () => {
    // 用于捕获发出的事件
    const completedEvents: BattleCompletedEvent[] = [];
    deps.eventBus.on<BattleCompletedEvent>('battle:completed', (e) => completedEvents.push(e));

    // 1. 创建战斗 -- SiegeBattleSystem 发出 battle:started,
    //    SiegeBattleAnimationSystem 监听并自动创建动画
    const session = battleSystem.createBattle(defaultBattleParams());

    // 2. 验证动画自动启动
    const anim = animSystem.getAnimation(session.taskId);
    expect(anim).not.toBeNull();
    expect(anim!.phase).toBe('assembly');
    expect(anim!.defenseRatio).toBe(1.0);
    expect(anim!.targetCityId).toBe('city-luoyang');
    expect(anim!.strategy).toBe('forceAttack');
    expect(anim!.faction).toBe('wei');

    // 3. 推进时间通过集结阶段 (>= 3s)
    animSystem.update(3.5);
    // assembly 3s 后自动转为 battle
    expect(anim!.phase).toBe('battle');

    // 4. 继续推进使战斗完成
    //    forceAttack: baseDuration(1000) + modifier(-5000) = -4000, clamped to minDurationMs(500)
    //    所以战斗只需 0.5s
    //    但由于上面 animSystem.update 已经推进 3.5s,
    //    SiegeBattleSystem 尚未 update, 其 elapsedMs 仍为 0
    //    我们需要让 battleSystem.update 也走过足够时间
    const estimatedDuration = session.estimatedDurationMs / 1000; // 秒
    battleSystem.update(estimatedDuration + 0.1);

    // battleSystem 发出 battle:completed,
    // animSystem 监听并自动调用 completeSiegeAnimation
    expect(completedEvents.length).toBe(1);
    expect(completedEvents[0].taskId).toBe('task-001');
    expect(completedEvents[0].victory).toBe(true);

    // 5. 验证动画自动完成
    expect(anim!.phase).toBe('completed');
    expect(anim!.victory).toBe(true);

    // 6. 销毁系统
    battleSystem.destroy();
    animSystem.destroy();

    // 7. 验证清理完毕
    expect(animSystem.getActiveAnimations()).toHaveLength(0);
    expect(battleSystem.getState().activeBattles).toHaveLength(0);
  });

  // ─────────────────────────────────────────────
  // Scenario B -- defenseRatio 手动桥接
  // ─────────────────────────────────────────────

  it('Scenario B: defenseRatio bridging -- manual sync from battle to animation', () => {
    const session = battleSystem.createBattle(defaultBattleParams('task-ratio'));
    const taskId = session.taskId;

    const ratios: number[] = [];
    const dt = 0.5; // 每次推进 0.5s

    // battleSystem estimatedDurationMs with forceAttack = clamp(1000-5000, 500, 60000) = 500ms
    // 所以只需 1 步 (0.5s) 就能完成战斗
    // 让我们使用 siege 策略 (baseDuration + 15000 = 16000ms, clamped = 16000) 来获得更长的战斗时间
    // 重新创建系统使用更长的战斗时长
    battleSystem.destroy();
    animSystem.destroy();
    deps.eventBus.removeAllListeners();

    battleSystem = new SiegeBattleSystem({
      baseDurationMs: 10_000,
      baseDefenseValue: 100,
      minDurationMs: 500,
      maxDurationMs: 60_000,
    });
    animSystem = new SiegeBattleAnimationSystem({
      assemblyDurationMs: 3_000,
      completedLingerMs: 2_000,
    });

    battleSystem.init(deps);
    animSystem.init(deps);

    // 使用 siege 策略 (10s + 15s modifier = 25s)
    const session2 = battleSystem.createBattle({
      ...defaultBattleParams('task-ratio'),
      strategy: 'siege',
    });

    // 先通过集结阶段
    animSystem.update(4.0); // > 3s
    const anim = animSystem.getAnimation('task-ratio');
    expect(anim!.phase).toBe('battle');

    // 逐帧推进并桥接 defenseRatio
    let prevRatio = 1.0;
    let reachedZero = false;

    for (let i = 0; i < 60; i++) { // 最多 30s
      battleSystem.update(dt);

      const battle = battleSystem.getBattle('task-ratio');
      if (battle) {
        const ratio = battle.defenseValue / battle.maxDefense;
        animSystem.updateBattleProgress('task-ratio', ratio);
        animSystem.update(dt);
        ratios.push(ratio);

        // 防御比值应单调递减
        expect(ratio).toBeLessThanOrEqual(prevRatio);
        prevRatio = ratio;
      } else {
        // 战斗已完成
        const anim2 = animSystem.getAnimation('task-ratio');
        if (anim2 && anim2.phase === 'completed') {
          expect(anim2.defenseRatio).toBe(0);
          reachedZero = true;
        }
        animSystem.update(dt);
        break;
      }
    }

    // 至少采集了一些比值
    expect(ratios.length).toBeGreaterThan(0);
    // 初始比值应接近 1
    expect(ratios[0]).toBeLessThanOrEqual(1.0);
    // 最终应达到 0
    expect(reachedZero).toBe(true);
  });

  // ─────────────────────────────────────────────
  // Scenario C -- 多任务并发
  // ─────────────────────────────────────────────

  it('Scenario C: multi-task concurrency -- two independent battles/animations', () => {
    // 使用不同策略使战斗时长不同
    const session1 = battleSystem.createBattle({
      ...defaultBattleParams('task-concurrent-1'),
      strategy: 'forceAttack', // 很快 (clamped to minDuration)
    });

    const session2 = battleSystem.createBattle({
      ...defaultBattleParams('task-concurrent-2'),
      strategy: 'siege', // baseDuration(1000)×timeMultiplier(2.0)=2000ms, clamp(2000, 500, 60000) = 2000
    });

    // 验证两个动画都创建了
    expect(animSystem.getAnimation('task-concurrent-1')).not.toBeNull();
    expect(animSystem.getAnimation('task-concurrent-2')).not.toBeNull();
    expect(animSystem.getActiveAnimations()).toHaveLength(2);

    // 推进集结阶段
    animSystem.update(4.0);

    // 推进战斗 -- session1 (forceAttack, est ~500ms) 很快就完成
    battleSystem.update(1.0); // > 500ms

    // session1 应完成, session2 仍在进行中
    expect(battleSystem.getBattle('task-concurrent-1')).toBeNull();
    // session2 尚未完成 (需要 16s)
    expect(battleSystem.getBattle('task-concurrent-2')).not.toBeNull();

    // session1 动画自动完成
    const anim1 = animSystem.getAnimation('task-concurrent-1');
    expect(anim1!.phase).toBe('completed');
    expect(anim1!.victory).toBe(true);

    // session2 动画仍在 battle 阶段
    const anim2 = animSystem.getAnimation('task-concurrent-2');
    expect(anim2!.phase).toBe('battle');

    // 继续推进 session2 直到完成
    battleSystem.update(16.0);

    // session2 现在也完成了
    const anim2After = animSystem.getAnimation('task-concurrent-2');
    expect(anim2After!.phase).toBe('completed');
    expect(anim2After!.victory).toBe(true);
  });

  // ─────────────────────────────────────────────
  // Scenario D -- cancelBattle 中断
  // ─────────────────────────────────────────────

  it('Scenario D: cancelBattle interruption -- animation persists without cleanup', () => {
    const cancelledEvents: Array<{ taskId: string }> = [];
    deps.eventBus.on('battle:cancelled', (e: any) => cancelledEvents.push(e));

    const session = battleSystem.createBattle(defaultBattleParams('task-cancel'));

    // 验证动画已创建
    const anim = animSystem.getAnimation('task-cancel');
    expect(anim).not.toBeNull();
    expect(anim!.phase).toBe('assembly');

    // 取消战斗
    battleSystem.cancelBattle('task-cancel');

    // 验证取消事件已发出
    expect(cancelledEvents.length).toBe(1);
    expect(cancelledEvents[0].taskId).toBe('task-cancel');

    // 战斗已从 activeBattles 移除
    expect(battleSystem.getBattle('task-cancel')).toBeNull();

    // SiegeBattleAnimationSystem 不监听 battle:cancelled,
    // 因此动画仍然存在
    const animAfterCancel = animSystem.getAnimation('task-cancel');
    expect(animAfterCancel).not.toBeNull();
    expect(animAfterCancel!.phase).toBe('assembly');

    // destroy 后动画才清除
    animSystem.destroy();
    expect(animSystem.getActiveAnimations()).toHaveLength(0);
  });
});
