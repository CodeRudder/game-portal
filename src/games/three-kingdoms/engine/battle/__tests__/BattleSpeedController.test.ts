/**
 * 战斗加速控制器 — 单元测试
 *
 * 覆盖：
 * - 速度档位切换（1x/2x/4x）
 * - 回合间隔缩放
 * - 动画速度缩放
 * - 简化特效判定
 * - 循环切换
 * - 监听器注册/移除
 * - 变更历史
 * - 序列化/反序列化
 * - 静态工具方法
 *
 * @module engine/battle/__tests__/BattleSpeedController.test
 */

import { BattleSpeedController } from '../BattleSpeedController';
import type { ISpeedChangeListener, SpeedChangeEvent } from '../BattleSpeedController';
import { BattleSpeed, BATTLE_CONFIG } from '../battle.types';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

/** 创建模拟监听器 */
function createMockListener(): ISpeedChangeListener {
  return {
    onSpeedChange: jest.fn(),
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('BattleSpeedController', () => {
  let controller: BattleSpeedController;

  beforeEach(() => {
    controller = new BattleSpeedController();
  });

  // ── 初始状态 ──

  describe('初始状态', () => {
    it('默认速度应为配置的默认值', () => {
      expect(controller.getSpeed()).toBe(BATTLE_CONFIG.DEFAULT_BATTLE_SPEED);
    });

    it('初始速度状态应正确', () => {
      const state = controller.getSpeedState();

      expect(state.speed).toBe(BattleSpeed.X1);
      expect(state.turnIntervalScale).toBe(1);
      expect(state.animationSpeedScale).toBe(1);
      expect(state.simplifiedEffects).toBe(false);
    });

    it('初始回合间隔应为基础间隔', () => {
      expect(controller.getAdjustedTurnInterval()).toBe(
        BATTLE_CONFIG.BASE_TURN_INTERVAL_MS,
      );
    });

    it('初始动画速度应为1倍', () => {
      expect(controller.getAnimationSpeedScale()).toBe(1);
    });

    it('初始不应简化特效', () => {
      expect(controller.shouldSimplifyEffects()).toBe(false);
    });

    it('初始变更历史为空', () => {
      expect(controller.getChangeHistory()).toHaveLength(0);
    });
  });

  // ── 速度切换 ──

  describe('setSpeed', () => {
    it('切换到2x应成功', () => {
      const result = controller.setSpeed(BattleSpeed.X2);

      expect(result).toBe(true);
      expect(controller.getSpeed()).toBe(BattleSpeed.X2);
    });

    it('切换到4x应成功', () => {
      const result = controller.setSpeed(BattleSpeed.X4);

      expect(result).toBe(true);
      expect(controller.getSpeed()).toBe(BattleSpeed.X4);
    });

    it('切换到相同速度应返回false', () => {
      const result = controller.setSpeed(BattleSpeed.X1);
      expect(result).toBe(false);
    });

    it('无效速度不应切换', () => {
      const result = controller.setSpeed(3 as BattleSpeed);
      expect(result).toBe(false);
      expect(controller.getSpeed()).toBe(BattleSpeed.X1);
    });

    it('切换到1x应正确计算缩放', () => {
      controller.setSpeed(BattleSpeed.X4); // 先切到4x
      controller.setSpeed(BattleSpeed.X1); // 再切回1x

      const state = controller.getSpeedState();
      expect(state.speed).toBe(BattleSpeed.X1);
      expect(state.turnIntervalScale).toBe(1);
      expect(state.animationSpeedScale).toBe(1);
      expect(state.simplifiedEffects).toBe(false);
    });
  });

  // ── 回合间隔缩放 ──

  describe('回合间隔缩放', () => {
    it('1x时间隔不变', () => {
      controller.setSpeed(BattleSpeed.X1);
      expect(controller.getAdjustedTurnInterval()).toBe(1000);
    });

    it('2x时间隔减半', () => {
      controller.setSpeed(BattleSpeed.X2);
      expect(controller.getAdjustedTurnInterval()).toBe(500);
    });

    it('4x时间隔为1/4', () => {
      controller.setSpeed(BattleSpeed.X4);
      expect(controller.getAdjustedTurnInterval()).toBe(250);
    });

    it('间隔缩放系数应正确', () => {
      controller.setSpeed(BattleSpeed.X2);
      expect(controller.getTurnIntervalScale()).toBeCloseTo(0.5);
    });
  });

  // ── 动画速度缩放 ──

  describe('动画速度缩放', () => {
    it('1x时动画速度为1', () => {
      controller.setSpeed(BattleSpeed.X1);
      expect(controller.getAnimationSpeedScale()).toBe(1);
    });

    it('2x时动画速度为2', () => {
      controller.setSpeed(BattleSpeed.X2);
      expect(controller.getAnimationSpeedScale()).toBe(2);
    });

    it('4x时动画速度为4', () => {
      controller.setSpeed(BattleSpeed.X4);
      expect(controller.getAnimationSpeedScale()).toBe(4);
    });
  });

  // ── 简化特效 ──

  describe('简化特效', () => {
    it('1x不应简化特效', () => {
      controller.setSpeed(BattleSpeed.X1);
      expect(controller.shouldSimplifyEffects()).toBe(false);
    });

    it('2x不应简化特效', () => {
      controller.setSpeed(BattleSpeed.X2);
      expect(controller.shouldSimplifyEffects()).toBe(false);
    });

    it('4x应简化特效', () => {
      controller.setSpeed(BattleSpeed.X4);
      expect(controller.shouldSimplifyEffects()).toBe(true);
    });
  });

  // ── 循环切换 ──

  describe('cycleSpeed', () => {
    it('应按 1x → 2x → 4x → 1x 循环', () => {
      expect(controller.getSpeed()).toBe(BattleSpeed.X1);

      controller.cycleSpeed();
      expect(controller.getSpeed()).toBe(BattleSpeed.X2);

      controller.cycleSpeed();
      expect(controller.getSpeed()).toBe(BattleSpeed.X4);

      controller.cycleSpeed();
      expect(controller.getSpeed()).toBe(BattleSpeed.X1);
    });
  });

  // ── 监听器 ──

  describe('监听器', () => {
    it('注册监听器后应收到变更事件', () => {
      const listener = createMockListener();
      controller.addListener(listener);

      controller.setSpeed(BattleSpeed.X2);

      expect(listener.onSpeedChange).toHaveBeenCalledTimes(1);
      const event = (listener.onSpeedChange as ReturnType<typeof jest.fn>).mock.calls[0][0] as SpeedChangeEvent;
      expect(event.previousSpeed).toBe(BattleSpeed.X1);
      expect(event.newSpeed).toBe(BattleSpeed.X2);
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it('移除监听器后不应收到事件', () => {
      const listener = createMockListener();
      controller.addListener(listener);
      controller.removeListener(listener);

      controller.setSpeed(BattleSpeed.X2);
      expect(listener.onSpeedChange).not.toHaveBeenCalled();
    });

    it('多个监听器都应收到事件', () => {
      const listener1 = createMockListener();
      const listener2 = createMockListener();

      controller.addListener(listener1);
      controller.addListener(listener2);

      controller.setSpeed(BattleSpeed.X4);

      expect(listener1.onSpeedChange).toHaveBeenCalledTimes(1);
      expect(listener2.onSpeedChange).toHaveBeenCalledTimes(1);
    });

    it('重复注册同一监听器不应重复通知', () => {
      const listener = createMockListener();
      controller.addListener(listener);
      controller.addListener(listener);

      controller.setSpeed(BattleSpeed.X2);
      expect(listener.onSpeedChange).toHaveBeenCalledTimes(1);
    });

    it('相同速度变更不应触发监听器', () => {
      const listener = createMockListener();
      controller.addListener(listener);

      controller.setSpeed(BattleSpeed.X1); // 已是1x
      expect(listener.onSpeedChange).not.toHaveBeenCalled();
    });
  });

  // ── 变更历史 ──

  describe('变更历史', () => {
    it('应记录所有速度变更', () => {
      controller.setSpeed(BattleSpeed.X2);
      controller.setSpeed(BattleSpeed.X4);

      const history = controller.getChangeHistory();
      expect(history).toHaveLength(2);

      expect(history[0].previousSpeed).toBe(BattleSpeed.X1);
      expect(history[0].newSpeed).toBe(BattleSpeed.X2);

      expect(history[1].previousSpeed).toBe(BattleSpeed.X2);
      expect(history[1].newSpeed).toBe(BattleSpeed.X4);
    });

    it('相同速度不应记录', () => {
      controller.setSpeed(BattleSpeed.X1);
      expect(controller.getChangeHistory()).toHaveLength(0);
    });

    it('reset应清除历史', () => {
      controller.setSpeed(BattleSpeed.X2);
      controller.reset();
      expect(controller.getChangeHistory()).toHaveLength(0);
    });

    it('历史应为副本，修改不影响内部', () => {
      controller.setSpeed(BattleSpeed.X2);
      const history = controller.getChangeHistory();
      history.pop();

      expect(controller.getChangeHistory()).toHaveLength(1);
    });
  });

  // ── 重置 ──

  describe('reset', () => {
    it('应重置为默认速度', () => {
      controller.setSpeed(BattleSpeed.X4);
      controller.reset();

      expect(controller.getSpeed()).toBe(BATTLE_CONFIG.DEFAULT_BATTLE_SPEED);
    });

    it('应清除变更历史', () => {
      controller.setSpeed(BattleSpeed.X2);
      controller.setSpeed(BattleSpeed.X4);
      controller.reset();

      expect(controller.getChangeHistory()).toHaveLength(0);
    });
  });

  // ── 序列化/反序列化 ──

  describe('序列化/反序列化', () => {
    it('应正确序列化1x状态', () => {
      const state = controller.serialize();

      expect(state.speed).toBe(BattleSpeed.X1);
      expect(state.turnIntervalScale).toBe(1);
      expect(state.animationSpeedScale).toBe(1);
      expect(state.simplifiedEffects).toBe(false);
    });

    it('应正确序列化4x状态', () => {
      controller.setSpeed(BattleSpeed.X4);
      const state = controller.serialize();

      expect(state.speed).toBe(BattleSpeed.X4);
      expect(state.turnIntervalScale).toBeCloseTo(0.25);
      expect(state.animationSpeedScale).toBe(4);
      expect(state.simplifiedEffects).toBe(true);
    });

    it('应正确反序列化', () => {
      controller.setSpeed(BattleSpeed.X4);
      const serialized = controller.serialize();

      const newController = new BattleSpeedController();
      newController.deserialize(serialized);

      expect(newController.getSpeed()).toBe(BattleSpeed.X4);
      expect(newController.getAnimationSpeedScale()).toBe(4);
    });

    it('序列化应为副本', () => {
      const state = controller.serialize();
      state.speed = BattleSpeed.X4;

      expect(controller.getSpeed()).toBe(BattleSpeed.X1);
    });
  });

  // ── 静态工具方法 ──

  describe('静态工具方法', () => {
    describe('isValidSpeed', () => {
      it('1x应合法', () => {
        expect(BattleSpeedController.isValidSpeed(1)).toBe(true);
      });

      it('2x应合法', () => {
        expect(BattleSpeedController.isValidSpeed(2)).toBe(true);
      });

      it('4x应合法', () => {
        expect(BattleSpeedController.isValidSpeed(4)).toBe(true);
      });

      it('3x应不合法', () => {
        expect(BattleSpeedController.isValidSpeed(3)).toBe(false);
      });

      it('0应合法（SKIP模式）', () => {
        expect(BattleSpeedController.isValidSpeed(0)).toBe(true);
      });

      it('负数应不合法', () => {
        expect(BattleSpeedController.isValidSpeed(-1)).toBe(false);
      });
    });

    describe('getAvailableSpeeds', () => {
      it('应返回所有可用速度', () => {
        const speeds = BattleSpeedController.getAvailableSpeeds();
        expect(speeds).toEqual([1, 2, 4]);
      });
    });
  });

  // ── 状态持久化 ──

  describe('状态持久化', () => {
    it('多次切换后状态应正确', () => {
      controller.setSpeed(BattleSpeed.X2);
      controller.setSpeed(BattleSpeed.X4);
      controller.setSpeed(BattleSpeed.X1);
      controller.setSpeed(BattleSpeed.X2);

      expect(controller.getSpeed()).toBe(BattleSpeed.X2);
      expect(controller.getAdjustedTurnInterval()).toBe(500);
      expect(controller.getAnimationSpeedScale()).toBe(2);
      expect(controller.shouldSimplifyEffects()).toBe(false);
    });

    it('速度状态对象应为副本', () => {
      const state = controller.getSpeedState();
      state.speed = BattleSpeed.X4;

      expect(controller.getSpeed()).toBe(BattleSpeed.X1);
    });
  });
});
