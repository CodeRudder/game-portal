/**
 * SiegeBattleAnimationSystem 城防衰减显示测试 (R18 Task2: I5 City Defense Decay Display)
 *
 * 覆盖:
 *   1. defenseRatio 初始值 1.0 (满血)
 *   2. updateBattleProgress 设置正确的城防比值 (0.5, 0.0)
 *   3. defenseRatio 被限制在 [0, 1]
 *   4. defenseRatio 反映在动画状态中
 *   5. 攻城失败后城防自然恢复 (completed + victory=false)
 *   6. 攻城胜利后城防不恢复 (completed + victory=true)
 *   7. recoverDefense 手动恢复方法
 *   8. getDefenseRecoveryRate 返回配置的恢复速率
 *   9. 自定义恢复速率配置
 *  10. 已移除动画不参与恢复
 *
 * @module engine/map/__tests__/SiegeBattleAnim.defense.test
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  SiegeBattleAnimationSystem,
  type SiegeAnimationState,
} from '../SiegeBattleAnimationSystem';
import type { ISystemDeps } from '../../../core/types';

// ─────────────────────────────────────────────
// Mock 工具
// ─────────────────────────────────────────────

const createMockDeps = (): ISystemDeps => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(() => () => {}),
    off: vi.fn(),
    once: vi.fn(() => () => {}),
    removeAllListeners: vi.fn(),
  } as any,
  config: { get: vi.fn(), set: vi.fn() } as any,
  registry: { get: vi.fn(() => null) } as any,
});

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('SiegeBattleAnimationSystem 城防衰减显示 (R18 Task2)', () => {
  let system: SiegeBattleAnimationSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    system = new SiegeBattleAnimationSystem();
    deps = createMockDeps();
    system.init(deps);
  });

  // Helper: 启动一个攻城动画
  function startAnim(taskId = 'task-defense-001') {
    return system.startSiegeAnimation({
      taskId,
      targetCityId: 'city-luoyang',
      targetX: 25,
      targetY: 15,
      strategy: 'forceAttack',
      faction: 'wei',
      troops: 5000,
    });
  }

  // ────────────────────────────────────────────
  // Test 1: defenseRatio 初始值 1.0 (满血)
  // ────────────────────────────────────────────

  it('defenseRatio 初始值应为 1.0 (满血)', () => {
    const anim = startAnim();
    expect(anim.defenseRatio).toBe(1.0);
  });

  // ────────────────────────────────────────────
  // Test 2: updateBattleProgress 设置正确的城防比值
  // ────────────────────────────────────────────

  it('updateBattleProgress 设置 defenseRatio = 0.5', () => {
    startAnim();
    system.updateBattleProgress('task-defense-001', 0.5);
    const anim = system.getAnimation('task-defense-001');
    expect(anim!.defenseRatio).toBe(0.5);
  });

  it('updateBattleProgress 设置 defenseRatio = 0.0', () => {
    startAnim();
    system.updateBattleProgress('task-defense-001', 0.0);
    const anim = system.getAnimation('task-defense-001');
    expect(anim!.defenseRatio).toBe(0.0);
  });

  // ────────────────────────────────────────────
  // Test 3: defenseRatio 被限制在 [0, 1]
  // ────────────────────────────────────────────

  it('defenseRatio 超过 1.0 时被 clamp 到 1.0', () => {
    startAnim();
    system.updateBattleProgress('task-defense-001', 2.5);
    expect(system.getAnimation('task-defense-001')!.defenseRatio).toBe(1.0);
  });

  it('defenseRatio 低于 0 时被 clamp 到 0', () => {
    startAnim();
    system.updateBattleProgress('task-defense-001', -1.0);
    expect(system.getAnimation('task-defense-001')!.defenseRatio).toBe(0);
  });

  // ────────────────────────────────────────────
  // Test 4: defenseRatio 反映在动画状态中 (getActiveAnimations)
  // ────────────────────────────────────────────

  it('defenseRatio 反映在 getActiveAnimations 返回的状态中', () => {
    startAnim();
    system.updateBattleProgress('task-defense-001', 0.65);

    const anims = system.getActiveAnimations();
    expect(anims).toHaveLength(1);
    expect(anims[0].defenseRatio).toBe(0.65);
  });

  it('defenseRatio 反映在 getState 快照中', () => {
    startAnim();
    system.updateBattleProgress('task-defense-001', 0.35);

    const state = system.getState();
    expect(state.activeAnimations).toHaveLength(1);
    expect(state.activeAnimations[0].defenseRatio).toBe(0.35);
  });

  // ────────────────────────────────────────────
  // Test 5: 攻城失败后城防自然恢复
  // ────────────────────────────────────────────

  it('攻城失败后城防在 update 中自然恢复', () => {
    startAnim();
    system.updateBattleProgress('task-defense-001', 0.3);
    system.completeSiegeAnimation('task-defense-001', false);

    // 验证初始状态: 失败后 defenseRatio 保持 0.3
    expect(system.getAnimation('task-defense-001')!.defenseRatio).toBe(0.3);

    // update 1秒 → 恢复 0.05 (默认恢复速率)
    system.update(1.0);
    expect(system.getAnimation('task-defense-001')!.defenseRatio).toBeCloseTo(0.35, 5);
  });

  it('攻城失败后城防持续恢复直到满血', () => {
    // Use longer linger to prevent auto-removal during recovery
    const longLinger = new SiegeBattleAnimationSystem({ completedLingerMs: 10_000 });
    longLinger.init(createMockDeps());

    longLinger.startSiegeAnimation({
      taskId: 'task-defense-001',
      targetCityId: 'city-luoyang',
      targetX: 25,
      targetY: 15,
      strategy: 'forceAttack',
      faction: 'wei',
      troops: 5000,
    });
    longLinger.updateBattleProgress('task-defense-001', 0.8);
    longLinger.completeSiegeAnimation('task-defense-001', false);

    // 需要恢复 0.2, 速率 0.05/s → 需要 4 秒
    for (let i = 0; i < 40; i++) {
      longLinger.update(0.1);
    }
    const anim = longLinger.getAnimation('task-defense-001');
    expect(anim).not.toBeNull();
    expect(anim!.defenseRatio).toBe(1.0);
  });

  it('攻城失败后城防恢复不超过 1.0', () => {
    const longLinger = new SiegeBattleAnimationSystem({ completedLingerMs: 10_000 });
    longLinger.init(createMockDeps());

    longLinger.startSiegeAnimation({
      taskId: 'task-defense-001',
      targetCityId: 'city-luoyang',
      targetX: 25,
      targetY: 15,
      strategy: 'forceAttack',
      faction: 'wei',
      troops: 5000,
    });
    longLinger.updateBattleProgress('task-defense-001', 0.9);
    longLinger.completeSiegeAnimation('task-defense-001', false);

    // 恢复 0.1 就满血，但 update 超出 → 超出部分被 clamp
    for (let i = 0; i < 20; i++) {
      longLinger.update(0.1);
    }
    const anim = longLinger.getAnimation('task-defense-001');
    expect(anim!.defenseRatio).toBe(1.0);
  });

  // ────────────────────────────────────────────
  // Test 6: 攻城胜利后城防不恢复
  // ────────────────────────────────────────────

  it('攻城胜利后城防不恢复 (victory=true)', () => {
    startAnim();
    system.updateBattleProgress('task-defense-001', 0.3);
    system.completeSiegeAnimation('task-defense-001', true);

    // 胜利后 defenseRatio 归零
    expect(system.getAnimation('task-defense-001')!.defenseRatio).toBe(0);

    // update 后仍为 0 (不恢复)
    system.update(1.0);
    expect(system.getAnimation('task-defense-001')!.defenseRatio).toBe(0);
  });

  // ────────────────────────────────────────────
  // Test 7: recoverDefense 手动恢复方法
  // ────────────────────────────────────────────

  it('recoverDefense 手动恢复指定任务的城防', () => {
    startAnim();
    system.updateBattleProgress('task-defense-001', 0.4);
    system.completeSiegeAnimation('task-defense-001', false);

    system.recoverDefense('task-defense-001', 0.3);
    expect(system.getAnimation('task-defense-001')!.defenseRatio).toBeCloseTo(0.7, 5);
  });

  it('recoverDefense 不超过 1.0', () => {
    startAnim();
    system.updateBattleProgress('task-defense-001', 0.8);
    system.completeSiegeAnimation('task-defense-001', false);

    system.recoverDefense('task-defense-001', 0.5);
    expect(system.getAnimation('task-defense-001')!.defenseRatio).toBe(1.0);
  });

  it('recoverDefense 对胜利的动画无效', () => {
    startAnim();
    system.completeSiegeAnimation('task-defense-001', true);

    system.recoverDefense('task-defense-001', 0.5);
    expect(system.getAnimation('task-defense-001')!.defenseRatio).toBe(0);
  });

  it('recoverDefense 对非 completed 阶段无效', () => {
    startAnim();
    system.updateBattleProgress('task-defense-001', 0.5);

    // 仍在 battle 阶段 (assembly → battle 需要 update)
    system.update(5.0); // 驱动 assembly → battle
    system.recoverDefense('task-defense-001', 0.3);
    expect(system.getAnimation('task-defense-001')!.defenseRatio).toBe(0.5);
  });

  it('recoverDefense 对不存在的 taskId 安全忽略', () => {
    expect(() => system.recoverDefense('non-existent', 0.5)).not.toThrow();
  });

  // ────────────────────────────────────────────
  // Test 8: getDefenseRecoveryRate 返回配置的恢复速率
  // ────────────────────────────────────────────

  it('getDefenseRecoveryRate 返回默认恢复速率 0.05', () => {
    expect(system.getDefenseRecoveryRate()).toBe(0.05);
  });

  // ────────────────────────────────────────────
  // Test 9: 自定义恢复速率配置
  // ────────────────────────────────────────────

  it('自定义 defenseRecoveryRate 生效', () => {
    const custom = new SiegeBattleAnimationSystem({
      defenseRecoveryRate: 0.2,
    });
    custom.init(createMockDeps());

    expect(custom.getDefenseRecoveryRate()).toBe(0.2);

    custom.startSiegeAnimation({
      taskId: 'task-custom',
      targetCityId: 'city-luoyang',
      targetX: 25,
      targetY: 15,
      strategy: 'forceAttack',
      faction: 'wei',
      troops: 5000,
    });
    custom.updateBattleProgress('task-custom', 0.5);
    custom.completeSiegeAnimation('task-custom', false);

    // 恢复速率 0.2/s → update 1秒恢复 0.2
    custom.update(1.0);
    expect(custom.getAnimation('task-custom')!.defenseRatio).toBeCloseTo(0.7, 5);
  });

  // ────────────────────────────────────────────
  // Test 10: 已移除动画不参与恢复
  // ────────────────────────────────────────────

  it('已移除的动画不参与城防恢复', () => {
    startAnim();
    system.updateBattleProgress('task-defense-001', 0.5);
    system.completeSiegeAnimation('task-defense-001', false);
    system.cancelSiegeAnimation('task-defense-001');

    // 动画已移除
    expect(system.getAnimation('task-defense-001')).toBeNull();

    // update 不应抛出错误
    expect(() => system.update(1.0)).not.toThrow();
  });
});
