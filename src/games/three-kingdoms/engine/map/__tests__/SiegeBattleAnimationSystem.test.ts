/**
 * SiegeBattleAnimationSystem 单元测试 (I12)
 *
 * 覆盖:
 *   初始化 / 自定义配置
 *   startSiegeAnimation: 创建动画 / 防重复
 *   update: assembly→battle 阶段转换 / completed 自动移除
 *   updateBattleProgress: 城防血条更新
 *   completeSiegeAnimation: 完成阶段 / linger 后移除
 *   cancelSiegeAnimation: 立即移除
 *   getActiveAnimations / getAnimCountByPhase
 *   事件发射: siegeAnim:started / siegeAnim:phaseChanged / siegeAnim:completed
 *   序列化/反序列化
 *   边界条件 (dt=0 / reset / 无动画时 update)
 *
 * @module engine/map/__tests__/SiegeBattleAnimationSystem.test
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  SiegeBattleAnimationSystem,
  type SiegeAnimationState,
  type SiegeAnimPhase,
} from '../SiegeBattleAnimationSystem';
import type { ISystemDeps } from '../../../core/types';
import { EventBus } from '../../../core/events/EventBus';

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

// ============================================================
// 测试
// ============================================================

describe('SiegeBattleAnimationSystem', () => {
  let system: SiegeBattleAnimationSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    system = new SiegeBattleAnimationSystem();
    deps = createMockDeps();
    system.init(deps);
  });

  // ────────────────────────────────────────────
  // 初始化
  // ────────────────────────────────────────────

  describe('初始化', () => {
    it('应正确初始化', () => {
      expect(system.name).toBe('siegeBattleAnim');
      expect(system.getState().activeAnimations).toHaveLength(0);
      expect(system.getActiveAnimations()).toHaveLength(0);
    });

    it('应使用自定义配置', () => {
      const custom = new SiegeBattleAnimationSystem({
        assemblyDurationMs: 5_000,
        completedLingerMs: 3_000,
      });
      custom.init(createMockDeps());

      const anim = custom.startSiegeAnimation({
        taskId: 't1',
        targetCityId: 'city-xuchang',
        targetX: 10,
        targetY: 20,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 1000,
      });

      // 集结阶段持续 5 秒
      custom.update(4.9); // 4.9s < 5s
      expect(anim.phase).toBe('assembly');
      custom.update(0.2); // 5.1s >= 5s
      expect(anim.phase).toBe('battle');
    });

    it('init 时应注册 battle:started 和 battle:completed 事件监听', () => {
      expect(deps.eventBus.on).toHaveBeenCalledWith('battle:started', expect.any(Function));
      expect(deps.eventBus.on).toHaveBeenCalledWith('battle:completed', expect.any(Function));
    });
  });

  // ────────────────────────────────────────────
  // startSiegeAnimation
  // ────────────────────────────────────────────

  describe('startSiegeAnimation', () => {
    it('应创建攻城动画', () => {
      const anim = system.startSiegeAnimation({
        taskId: 'task-001',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      expect(anim).toBeDefined();
      expect(anim.taskId).toBe('task-001');
      expect(anim.targetCityId).toBe('city-luoyang');
      expect(anim.targetX).toBe(25);
      expect(anim.targetY).toBe(15);
      expect(anim.phase).toBe('assembly');
      expect(anim.assemblyElapsedMs).toBe(0);
      expect(anim.strategy).toBe('forceAttack');
      expect(anim.defenseRatio).toBe(1.0);
      expect(anim.faction).toBe('wei');
      expect(anim.troops).toBe(5000);
      expect(anim.victory).toBeNull();
    });

    it('应发射 siegeAnim:started 事件', () => {
      system.startSiegeAnimation({
        taskId: 'task-001',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'siegeAnim:started',
        expect.objectContaining({
          taskId: 'task-001',
          targetCityId: 'city-luoyang',
          phase: 'assembly',
        }),
      );
    });

    it('重复创建同一 taskId 应替换旧动画', () => {
      system.startSiegeAnimation({
        taskId: 'task-001',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      // 创建第二个同名动画
      const anim2 = system.startSiegeAnimation({
        taskId: 'task-001',
        targetCityId: 'city-xuchang',
        targetX: 30,
        targetY: 20,
        strategy: 'siege',
        faction: 'shu',
        troops: 3000,
      });

      // 应该只有一个动画
      expect(system.getActiveAnimations()).toHaveLength(1);
      expect(anim2.targetCityId).toBe('city-xuchang');
      expect(anim2.strategy).toBe('siege');
    });
  });

  // ────────────────────────────────────────────
  // update: assembly → battle 阶段转换
  // ────────────────────────────────────────────

  describe('update: assembly → battle 转换', () => {
    it('应在集结时间 (3s) 后转为 battle 阶段', () => {
      const anim = system.startSiegeAnimation({
        taskId: 'task-001',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      // 推进 2.5 秒，仍在 assembly
      system.update(2.5);
      expect(anim.phase).toBe('assembly');
      expect(anim.assemblyElapsedMs).toBe(2500);

      // 再推进 1 秒，超过 3 秒，转为 battle
      system.update(1.0);
      expect(anim.phase).toBe('battle');
      expect(anim.assemblyElapsedMs).toBe(3000);
    });

    it('应精确在 assemblyDurationMs 边界转换', () => {
      const anim = system.startSiegeAnimation({
        taskId: 'task-boundary',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      // 恰好 3 秒
      system.update(3.0);
      expect(anim.phase).toBe('battle');
      expect(anim.assemblyElapsedMs).toBe(3000);
    });

    it('阶段转换时应发射 siegeAnim:phaseChanged 事件', () => {
      system.startSiegeAnimation({
        taskId: 'task-001',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      // 推进到 battle 阶段
      system.update(3.0);

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'siegeAnim:phaseChanged',
        expect.objectContaining({
          taskId: 'task-001',
          fromPhase: 'assembly',
          toPhase: 'battle',
        }),
      );
    });

    it('assembly 阶段不应在 dt=0 时改变状态', () => {
      const anim = system.startSiegeAnimation({
        taskId: 'task-dt0',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      system.update(0);
      expect(anim.phase).toBe('assembly');
      expect(anim.assemblyElapsedMs).toBe(0);
    });
  });

  // ────────────────────────────────────────────
  // updateBattleProgress
  // ────────────────────────────────────────────

  describe('updateBattleProgress', () => {
    it('应更新城防比值', () => {
      system.startSiegeAnimation({
        taskId: 'task-001',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      system.updateBattleProgress('task-001', 0.7);
      const anim = system.getAnimation('task-001');
      expect(anim!.defenseRatio).toBe(0.7);
    });

    it('应将城防比值限制在 0~1 范围', () => {
      system.startSiegeAnimation({
        taskId: 'task-001',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      system.updateBattleProgress('task-001', 1.5);
      expect(system.getAnimation('task-001')!.defenseRatio).toBe(1.0);

      system.updateBattleProgress('task-001', -0.5);
      expect(system.getAnimation('task-001')!.defenseRatio).toBe(0);
    });

    it('不存在的 taskId 应安全忽略', () => {
      expect(() => system.updateBattleProgress('non-existent', 0.5)).not.toThrow();
    });
  });

  // ────────────────────────────────────────────
  // updateTargetPosition
  // ────────────────────────────────────────────

  describe('updateTargetPosition', () => {
    it('应更新目标城池坐标', () => {
      system.startSiegeAnimation({
        taskId: 'task-001',
        targetCityId: 'city-luoyang',
        targetX: 0,
        targetY: 0,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      system.updateTargetPosition('task-001', 42, 17);
      const anim = system.getAnimation('task-001');
      expect(anim!.targetX).toBe(42);
      expect(anim!.targetY).toBe(17);
    });

    it('不存在的 taskId 应安全忽略', () => {
      expect(() => system.updateTargetPosition('non-existent', 10, 20)).not.toThrow();
    });
  });

  // ────────────────────────────────────────────
  // completeSiegeAnimation
  // ────────────────────────────────────────────

  describe('completeSiegeAnimation', () => {
    it('应将动画状态设为 completed', () => {
      const anim = system.startSiegeAnimation({
        taskId: 'task-001',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      system.completeSiegeAnimation('task-001', true);

      expect(anim.phase).toBe('completed');
      expect(anim.victory).toBe(true);
    });

    it('胜利时城防比值应归零', () => {
      const anim = system.startSiegeAnimation({
        taskId: 'task-001',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      system.updateBattleProgress('task-001', 0.5);
      system.completeSiegeAnimation('task-001', true);

      expect(anim.defenseRatio).toBe(0);
    });

    it('失败时城防比值保持不变', () => {
      const anim = system.startSiegeAnimation({
        taskId: 'task-001',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      system.updateBattleProgress('task-001', 0.5);
      system.completeSiegeAnimation('task-001', false);

      expect(anim.defenseRatio).toBe(0.5);
      expect(anim.victory).toBe(false);
    });

    it('应发射 siegeAnim:phaseChanged 和 siegeAnim:completed 事件', () => {
      system.startSiegeAnimation({
        taskId: 'task-001',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      // 清除之前的 emit 调用
      (deps.eventBus.emit as ReturnType<typeof vi.fn>).mockClear();

      system.completeSiegeAnimation('task-001', true);

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'siegeAnim:phaseChanged',
        expect.objectContaining({
          taskId: 'task-001',
          fromPhase: 'assembly',
          toPhase: 'completed',
        }),
      );

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'siegeAnim:completed',
        expect.objectContaining({
          taskId: 'task-001',
          targetCityId: 'city-luoyang',
          victory: true,
        }),
      );
    });

    it('不存在的 taskId 应安全忽略', () => {
      expect(() => system.completeSiegeAnimation('non-existent', true)).not.toThrow();
    });
  });

  // ────────────────────────────────────────────
  // update: completed 后自动移除
  // ────────────────────────────────────────────

  describe('update: completed 后自动移除', () => {
    it('completed 后应在 linger 时间后自动移除', () => {
      const anim = system.startSiegeAnimation({
        taskId: 'task-linger',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      system.completeSiegeAnimation('task-linger', true);
      expect(anim.phase).toBe('completed');
      expect(system.getActiveAnimations()).toHaveLength(1);

      // 推进 1.9 秒 (< 2s linger)，动画仍在
      system.update(1.9);
      expect(system.getActiveAnimations()).toHaveLength(1);

      // 推进 0.2 秒 (总计 2.1s >= 2s linger)，动画应被移除
      system.update(0.2);
      expect(system.getActiveAnimations()).toHaveLength(0);
      expect(system.getAnimation('task-linger')).toBeNull();
    });
  });

  // ────────────────────────────────────────────
  // cancelSiegeAnimation
  // ────────────────────────────────────────────

  describe('cancelSiegeAnimation', () => {
    it('应立即移除动画', () => {
      system.startSiegeAnimation({
        taskId: 'task-cancel',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      expect(system.getActiveAnimations()).toHaveLength(1);

      system.cancelSiegeAnimation('task-cancel');

      expect(system.getActiveAnimations()).toHaveLength(0);
      expect(system.getAnimation('task-cancel')).toBeNull();
    });

    it('不存在的 taskId 应安全忽略', () => {
      expect(() => system.cancelSiegeAnimation('non-existent')).not.toThrow();
    });
  });

  // ────────────────────────────────────────────
  // getAnimation / getActiveAnimations
  // ────────────────────────────────────────────

  describe('查询', () => {
    it('getAnimation 应返回指定动画', () => {
      system.startSiegeAnimation({
        taskId: 'task-a',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      const anim = system.getAnimation('task-a');
      expect(anim).not.toBeNull();
      expect(anim!.taskId).toBe('task-a');

      expect(system.getAnimation('non-existent')).toBeNull();
    });

    it('getActiveAnimations 应返回所有活跃动画', () => {
      system.startSiegeAnimation({
        taskId: 'task-1',
        targetCityId: 'city-a',
        targetX: 10,
        targetY: 10,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 1000,
      });
      system.startSiegeAnimation({
        taskId: 'task-2',
        targetCityId: 'city-b',
        targetX: 20,
        targetY: 20,
        strategy: 'siege',
        faction: 'shu',
        troops: 2000,
      });

      const anims = system.getActiveAnimations();
      expect(anims).toHaveLength(2);
      const ids = anims.map((a) => a.taskId).sort();
      expect(ids).toEqual(['task-1', 'task-2']);
    });

    it('getAnimCountByPhase 应统计指定阶段的动画数量', () => {
      system.startSiegeAnimation({
        taskId: 'task-1',
        targetCityId: 'city-a',
        targetX: 10,
        targetY: 10,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 1000,
      });
      system.startSiegeAnimation({
        taskId: 'task-2',
        targetCityId: 'city-b',
        targetX: 20,
        targetY: 20,
        strategy: 'siege',
        faction: 'shu',
        troops: 2000,
      });

      expect(system.getAnimCountByPhase('assembly')).toBe(2);
      expect(system.getAnimCountByPhase('battle')).toBe(0);
      expect(system.getAnimCountByPhase('completed')).toBe(0);

      // 推进 task-1 和 task-2 都到 battle (3.0s >= assemblyDurationMs)
      system.update(3.0);
      // Both are now battle (3.0 >= 3.0 threshold)
      expect(system.getAnimCountByPhase('assembly')).toBe(0);
      expect(system.getAnimCountByPhase('battle')).toBe(2);
    });
  });

  // ────────────────────────────────────────────
  // 策略特效 (验证策略正确存储)
  // ────────────────────────────────────────────

  describe('策略支持', () => {
    const strategies: Array<{ strategy: SiegeAnimPhase extends never ? never : import('../../core/map/siege-enhancer.types').SiegeStrategyType; name: string }> = [
      { strategy: 'forceAttack', name: '强攻' },
      { strategy: 'siege', name: '围困' },
      { strategy: 'nightRaid', name: '夜袭' },
      { strategy: 'insider', name: '内应' },
    ];

    for (const { strategy } of strategies) {
      it(`应正确存储 ${strategy} 策略`, () => {
        const anim = system.startSiegeAnimation({
          taskId: `task-${strategy}`,
          targetCityId: 'city-luoyang',
          targetX: 25,
          targetY: 15,
          strategy: strategy as any,
          faction: 'wei',
          troops: 5000,
        });

        expect(anim.strategy).toBe(strategy as any);
      });
    }
  });

  // ────────────────────────────────────────────
  // 多动画并发
  // ────────────────────────────────────────────

  describe('多动画并发', () => {
    it('应同时管理多个攻城动画', () => {
      system.startSiegeAnimation({
        taskId: 'task-1',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });
      system.startSiegeAnimation({
        taskId: 'task-2',
        targetCityId: 'city-xuchang',
        targetX: 30,
        targetY: 20,
        strategy: 'siege',
        faction: 'shu',
        troops: 3000,
      });
      system.startSiegeAnimation({
        taskId: 'task-3',
        targetCityId: 'city-chengdu',
        targetX: 10,
        targetY: 40,
        strategy: 'nightRaid',
        faction: 'wu',
        troops: 4000,
      });

      expect(system.getActiveAnimations()).toHaveLength(3);

      // 推进所有动画到 battle
      system.update(3.5);
      expect(system.getAnimCountByPhase('battle')).toBe(3);

      // 完成 task-1
      system.completeSiegeAnimation('task-1', true);
      expect(system.getAnimCountByPhase('completed')).toBe(1);
      expect(system.getAnimCountByPhase('battle')).toBe(2);

      // 取消 task-2
      system.cancelSiegeAnimation('task-2');
      expect(system.getActiveAnimations()).toHaveLength(2);
    });
  });

  // ────────────────────────────────────────────
  // 序列化
  // ────────────────────────────────────────────

  describe('序列化', () => {
    it('应正确序列化活跃动画', () => {
      system.startSiegeAnimation({
        taskId: 'task-1',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      const data = system.serialize();
      expect(data.version).toBe(1);
      expect(data.animations).toHaveLength(1);
      expect(data.animations[0].taskId).toBe('task-1');
    });

    it('应正确反序列化恢复动画', () => {
      system.startSiegeAnimation({
        taskId: 'task-deser',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });

      // 推进到 battle 阶段
      system.update(4.0);

      const data = system.serialize();
      system.reset();
      expect(system.getActiveAnimations()).toHaveLength(0);

      system.deserialize(data);
      const anim = system.getAnimation('task-deser');
      expect(anim).not.toBeNull();
      expect(anim!.taskId).toBe('task-deser');
      expect(anim!.phase).toBe('battle');
    });

    it('序列化往返应保持一致', () => {
      system.startSiegeAnimation({
        taskId: 'task-roundtrip',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'nightRaid',
        faction: 'wu',
        troops: 4000,
      });

      system.update(1.5);

      const data = system.serialize();

      const sys2 = new SiegeBattleAnimationSystem();
      sys2.init(createMockDeps());
      sys2.deserialize(data);

      const data2 = sys2.serialize();
      expect(data2).toEqual(data);
    });

    it('反序列化时 completed 阶段的动画应正确恢复', () => {
      system.startSiegeAnimation({
        taskId: 'task-completed',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });
      system.completeSiegeAnimation('task-completed', true);

      const data = system.serialize();
      system.reset();
      system.deserialize(data);

      const anim = system.getAnimation('task-completed');
      expect(anim).not.toBeNull();
      expect(anim!.phase).toBe('completed');
      expect(anim!.victory).toBe(true);
    });

    it('无效数据反序列化应安全处理', () => {
      expect(() => system.deserialize(null)).not.toThrow();
      expect(() => system.deserialize(undefined)).not.toThrow();
      expect(() => system.deserialize('invalid')).not.toThrow();
      expect(() => system.deserialize({})).not.toThrow();
      expect(() => system.deserialize({ version: 99, animations: null })).not.toThrow();
    });

    it('completed 动画序列化后应精确恢复停留时间 (R6 C-05)', () => {
      // 1. 创建动画，完成，让其停留 1 秒
      system.startSiegeAnimation({
        taskId: 'task-linger-fidelity',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });
      system.completeSiegeAnimation('task-linger-fidelity', true);

      // 停留 1 秒 (总 linger 是 2 秒)
      system.update(1.0);
      expect(system.getAnimation('task-linger-fidelity')).not.toBeNull();

      // 2. 序列化
      const data = system.serialize();
      expect(data.completedLinger).toBeDefined();
      expect(data.completedLinger).toHaveLength(1);
      expect(data.completedLinger![0].taskId).toBe('task-linger-fidelity');
      // lingerElapsedMs 应约等于 1000 (允许微小浮点误差)
      expect(data.completedLinger![0].lingerElapsedMs).toBeGreaterThanOrEqual(999);
      expect(data.completedLinger![0].lingerElapsedMs).toBeLessThanOrEqual(1001);

      // 3. 反序列化到新系统
      const sys2 = new SiegeBattleAnimationSystem();
      sys2.init(createMockDeps());
      sys2.deserialize(data);

      expect(sys2.getAnimation('task-linger-fidelity')).not.toBeNull();
      expect(sys2.getAnimation('task-linger-fidelity')!.phase).toBe('completed');

      // 4. 推进 0.9s (< 剩余 1s linger)，动画应还在
      sys2.update(0.9);
      expect(sys2.getAnimation('task-linger-fidelity')).not.toBeNull();

      // 5. 再推进 0.2s (总计 1.1s > 剩余 1s linger)，动画应被移除
      sys2.update(0.2);
      expect(sys2.getAnimation('task-linger-fidelity')).toBeNull();
    });

    it('旧存档无 completedLinger 字段应向后兼容 (R6 C-05)', () => {
      // 模拟旧版存档数据 (没有 completedLinger)
      const oldSaveData = {
        version: 1,
        animations: [
          {
            taskId: 'task-old-save',
            targetCityId: 'city-luoyang',
            targetX: 25,
            targetY: 15,
            phase: 'completed',
            assemblyElapsedMs: 3000,
            strategy: 'forceAttack',
            defenseRatio: 0,
            faction: 'wei',
            troops: 5000,
            startTimeMs: Date.now(),
            victory: true,
          },
        ],
      };

      // 反序列化不应报错
      expect(() => system.deserialize(oldSaveData)).not.toThrow();

      // 动画应被恢复
      const anim = system.getAnimation('task-old-save');
      expect(anim).not.toBeNull();
      expect(anim!.phase).toBe('completed');

      // 旧存档没有 linger 信息，所以 completedAtElapsedMs = totalElapsedMs = 0
      // 动画在推进 completedLingerMs (2s) 后应被移除
      system.update(1.9);
      expect(system.getAnimation('task-old-save')).not.toBeNull();

      system.update(0.2);
      expect(system.getAnimation('task-old-save')).toBeNull();
    });
  });

  // ────────────────────────────────────────────
  // 边界条件
  // ────────────────────────────────────────────

  describe('边界条件', () => {
    it('无动画时 update 应安全返回', () => {
      expect(() => system.update(1.0)).not.toThrow();
      expect(system.getActiveAnimations()).toHaveLength(0);
    });

    it('reset 应清空所有动画', () => {
      system.startSiegeAnimation({
        taskId: 'task-1',
        targetCityId: 'city-a',
        targetX: 10,
        targetY: 10,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 1000,
      });
      system.startSiegeAnimation({
        taskId: 'task-2',
        targetCityId: 'city-b',
        targetX: 20,
        targetY: 20,
        strategy: 'siege',
        faction: 'shu',
        troops: 2000,
      });

      expect(system.getActiveAnimations()).toHaveLength(2);

      system.reset();

      expect(system.getActiveAnimations()).toHaveLength(0);
      expect(system.getAnimation('task-1')).toBeNull();
      expect(system.getAnimation('task-2')).toBeNull();
    });
  });

  // ────────────────────────────────────────────
  // 完整生命周期: assembly → battle → completed → remove
  // ────────────────────────────────────────────

  describe('完整生命周期', () => {
    it('应完成完整的动画生命周期', () => {
      // 1. 启动动画
      const anim = system.startSiegeAnimation({
        taskId: 'task-lifecycle',
        targetCityId: 'city-luoyang',
        targetX: 25,
        targetY: 15,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 5000,
      });
      expect(anim.phase).toBe('assembly');
      expect(anim.defenseRatio).toBe(1.0);

      // 2. 推进到 battle 阶段
      system.update(3.0);
      expect(anim.phase).toBe('battle');

      // 3. 模拟战斗进度衰减
      system.updateBattleProgress('task-lifecycle', 0.7);
      expect(anim.defenseRatio).toBe(0.7);

      system.updateBattleProgress('task-lifecycle', 0.3);
      expect(anim.defenseRatio).toBe(0.3);

      // 4. 完成战斗
      system.completeSiegeAnimation('task-lifecycle', true);
      expect(anim.phase).toBe('completed');
      expect(anim.victory).toBe(true);
      expect(anim.defenseRatio).toBe(0); // 胜利后归零

      // 5. 动画仍在 (linger)
      expect(system.getActiveAnimations()).toHaveLength(1);

      // 6. 推进 linger 时间后移除
      system.update(2.5);
      expect(system.getActiveAnimations()).toHaveLength(0);
      expect(system.getAnimation('task-lifecycle')).toBeNull();
    });
  });

  // ────────────────────────────────────────────
  // 生命周期: destroy / idempotent init (R6 C-01/C-06)
  // ────────────────────────────────────────────

  describe('生命周期: destroy / idempotent init', () => {
    /** 创建使用真实 EventBus 的依赖 */
    const createRealDeps = (): ISystemDeps & { eventBus: EventBus } => {
      const eventBus = new EventBus();
      return {
        eventBus,
        config: { get: vi.fn(), set: vi.fn() } as any,
        registry: { get: vi.fn(() => null) } as any,
      };
    };

    it('destroy() 应移除所有事件监听', () => {
      const realDeps = createRealDeps();
      const sys = new SiegeBattleAnimationSystem();
      sys.init(realDeps);

      // 确认事件监听已注册
      expect(realDeps.eventBus.listenerCount('battle:started')).toBe(1);
      expect(realDeps.eventBus.listenerCount('battle:completed')).toBe(1);

      // 销毁
      sys.destroy();

      // 事件监听应被移除
      expect(realDeps.eventBus.listenerCount('battle:started')).toBe(0);
      expect(realDeps.eventBus.listenerCount('battle:completed')).toBe(0);
    });

    it('destroy() 应清除所有动画数据', () => {
      const realDeps = createRealDeps();
      const sys = new SiegeBattleAnimationSystem();
      sys.init(realDeps);

      // 添加动画
      sys.startSiegeAnimation({
        taskId: 'task-destroy-1',
        targetCityId: 'city-a',
        targetX: 10,
        targetY: 10,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 1000,
      });
      sys.startSiegeAnimation({
        taskId: 'task-destroy-2',
        targetCityId: 'city-b',
        targetX: 20,
        targetY: 20,
        strategy: 'siege',
        faction: 'shu',
        troops: 2000,
      });
      expect(sys.getActiveAnimations()).toHaveLength(2);

      // 销毁
      sys.destroy();

      // 动画应被清除
      expect(sys.getActiveAnimations()).toHaveLength(0);
    });

    it('destroy() 后事件不再触发动画创建', () => {
      const realDeps = createRealDeps();
      const sys = new SiegeBattleAnimationSystem();
      sys.init(realDeps);

      // 销毁
      sys.destroy();

      // 发射 battle:started 事件 — 不应创建动画
      realDeps.eventBus.emit('battle:started', {
        taskId: 'task-after-destroy',
        targetId: 'city-x',
        targetX: 5,
        targetY: 5,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 1000,
      });

      expect(sys.getActiveAnimations()).toHaveLength(0);
    });

    it('多次 init() 调用只注册一次事件监听 (幂等)', () => {
      const realDeps = createRealDeps();
      const sys = new SiegeBattleAnimationSystem();

      // 多次调用 init
      sys.init(realDeps);
      sys.init(realDeps);
      sys.init(realDeps);

      // 应只注册一次监听
      expect(realDeps.eventBus.listenerCount('battle:started')).toBe(1);
      expect(realDeps.eventBus.listenerCount('battle:completed')).toBe(1);

      // 触发事件应只创建一个动画 (不会重复)
      realDeps.eventBus.emit('battle:started', {
        taskId: 'task-idempotent',
        targetId: 'city-y',
        targetX: 5,
        targetY: 5,
        strategy: 'siege',
        faction: 'shu',
        troops: 2000,
      });

      expect(sys.getActiveAnimations()).toHaveLength(1);
      expect(sys.getAnimation('task-idempotent')).not.toBeNull();
    });

    it('destroy() 后可重新 init() 初始化', () => {
      const realDeps = createRealDeps();
      const sys = new SiegeBattleAnimationSystem();

      // 首次初始化
      sys.init(realDeps);
      sys.startSiegeAnimation({
        taskId: 'task-round1',
        targetCityId: 'city-a',
        targetX: 10,
        targetY: 10,
        strategy: 'forceAttack',
        faction: 'wei',
        troops: 1000,
      });
      expect(sys.getActiveAnimations()).toHaveLength(1);

      // 销毁
      sys.destroy();
      expect(sys.getActiveAnimations()).toHaveLength(0);
      expect(realDeps.eventBus.listenerCount('battle:started')).toBe(0);

      // 重新初始化 — 使用新的 deps
      const newDeps = createRealDeps();
      sys.init(newDeps);

      // 应重新注册事件监听
      expect(newDeps.eventBus.listenerCount('battle:started')).toBe(1);
      expect(newDeps.eventBus.listenerCount('battle:completed')).toBe(1);

      // 应能响应事件
      newDeps.eventBus.emit('battle:started', {
        taskId: 'task-round2',
        targetId: 'city-b',
        targetX: 20,
        targetY: 20,
        strategy: 'nightRaid',
        faction: 'wu',
        troops: 3000,
      });
      expect(sys.getActiveAnimations()).toHaveLength(1);
      expect(sys.getAnimation('task-round2')).not.toBeNull();
    });

    it('reset() 不移除事件监听', () => {
      const realDeps = createRealDeps();
      const sys = new SiegeBattleAnimationSystem();
      sys.init(realDeps);

      // 重置
      sys.reset();

      // 事件监听应仍然存在
      expect(realDeps.eventBus.listenerCount('battle:started')).toBe(1);
      expect(realDeps.eventBus.listenerCount('battle:completed')).toBe(1);

      // 事件应仍然能触发动画创建
      realDeps.eventBus.emit('battle:started', {
        taskId: 'task-after-reset',
        targetId: 'city-c',
        targetX: 30,
        targetY: 30,
        strategy: 'insider',
        faction: 'wei',
        troops: 4000,
      });
      expect(sys.getActiveAnimations()).toHaveLength(1);
    });
  });
});
