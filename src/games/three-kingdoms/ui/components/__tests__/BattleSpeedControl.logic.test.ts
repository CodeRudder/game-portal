/**
 * BattleSpeedControl 逻辑测试 — 不依赖 DOM 渲染
 *
 * 测试 SpeedControlLogic 的核心逻辑：
 * - 速度设置与切换
 * - 循环切换速度
 * - 自动战斗开关
 * - 暂停/恢复
 * - 回合间隔计算
 * - 特效简化判断
 */

import { SpeedControlLogic } from '../battle/BattleSpeedControl';

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('SpeedControlLogic — 速度设置', () => {
  it('默认速度为 X1', () => {
    const logic = new SpeedControlLogic();
    expect(logic.getSpeed()).toBe(1);
  });

  it('设置速度为 X2', () => {
    const logic = new SpeedControlLogic();
    const result = logic.setSpeed(2);
    expect(result.changed).toBe(true);
    expect(result.previousSpeed).toBe(1);
    expect(logic.getSpeed()).toBe(2);
  });

  it('设置相同速度不变化', () => {
    const logic = new SpeedControlLogic(1);
    const result = logic.setSpeed(1);
    expect(result.changed).toBe(false);
  });

  it('设置非法速度不变化', () => {
    const logic = new SpeedControlLogic(1);
    const result = logic.setSpeed(3 as 1);
    expect(result.changed).toBe(false);
    expect(logic.getSpeed()).toBe(1);
  });

  it('设置 X4 速度', () => {
    const logic = new SpeedControlLogic();
    logic.setSpeed(4);
    expect(logic.getSpeed()).toBe(4);
  });
});

describe('SpeedControlLogic — 循环切换', () => {
  it('X1 → X2', () => {
    const logic = new SpeedControlLogic(1);
    expect(logic.cycleSpeed()).toBe(2);
  });

  it('X2 → X4', () => {
    const logic = new SpeedControlLogic(2);
    expect(logic.cycleSpeed()).toBe(4);
  });

  it('X4 → X1 循环', () => {
    const logic = new SpeedControlLogic(4);
    expect(logic.cycleSpeed()).toBe(1);
  });

  it('连续循环切换', () => {
    const logic = new SpeedControlLogic(1);
    expect(logic.cycleSpeed()).toBe(2);
    expect(logic.cycleSpeed()).toBe(4);
    expect(logic.cycleSpeed()).toBe(1);
  });
});

describe('SpeedControlLogic — 自动战斗', () => {
  it('默认关闭', () => {
    const logic = new SpeedControlLogic();
    expect(logic.isAutoBattle()).toBe(false);
  });

  it('切换开启', () => {
    const logic = new SpeedControlLogic();
    const result = logic.toggleAutoBattle();
    expect(result).toBe(true);
    expect(logic.isAutoBattle()).toBe(true);
  });

  it('再次切换关闭', () => {
    const logic = new SpeedControlLogic();
    logic.toggleAutoBattle();
    const result = logic.toggleAutoBattle();
    expect(result).toBe(false);
    expect(logic.isAutoBattle()).toBe(false);
  });
});

describe('SpeedControlLogic — 暂停/恢复', () => {
  it('默认不暂停', () => {
    const logic = new SpeedControlLogic();
    expect(logic.isPaused()).toBe(false);
  });

  it('暂停', () => {
    const logic = new SpeedControlLogic();
    logic.pause();
    expect(logic.isPaused()).toBe(true);
  });

  it('恢复', () => {
    const logic = new SpeedControlLogic();
    logic.pause();
    logic.resume();
    expect(logic.isPaused()).toBe(false);
  });
});

describe('SpeedControlLogic — 回合间隔', () => {
  it('X1 间隔 1000ms', () => {
    const logic = new SpeedControlLogic(1);
    expect(logic.getTurnInterval()).toBe(1000);
  });

  it('X2 间隔 500ms', () => {
    const logic = new SpeedControlLogic(2);
    expect(logic.getTurnInterval()).toBe(500);
  });

  it('X4 间隔 250ms', () => {
    const logic = new SpeedControlLogic(4);
    expect(logic.getTurnInterval()).toBe(250);
  });
});

describe('SpeedControlLogic — 动画速度', () => {
  it('X1 缩放 1.0', () => {
    const logic = new SpeedControlLogic(1);
    expect(logic.getAnimationSpeedScale()).toBe(1);
  });

  it('X2 缩放 2.0', () => {
    const logic = new SpeedControlLogic(2);
    expect(logic.getAnimationSpeedScale()).toBe(2);
  });

  it('X4 缩放 4.0', () => {
    const logic = new SpeedControlLogic(4);
    expect(logic.getAnimationSpeedScale()).toBe(4);
  });
});

describe('SpeedControlLogic — 特效简化', () => {
  it('X1 不简化', () => {
    const logic = new SpeedControlLogic(1);
    expect(logic.shouldSimplifyEffects()).toBe(false);
  });

  it('X2 不简化', () => {
    const logic = new SpeedControlLogic(2);
    expect(logic.shouldSimplifyEffects()).toBe(false);
  });

  it('X4 简化特效', () => {
    const logic = new SpeedControlLogic(4);
    expect(logic.shouldSimplifyEffects()).toBe(true);
  });
});

describe('SpeedControlLogic — 速度验证', () => {
  it('1 是合法速度', () => {
    const logic = new SpeedControlLogic();
    expect(logic.isValidSpeed(1)).toBe(true);
  });

  it('2 是合法速度', () => {
    const logic = new SpeedControlLogic();
    expect(logic.isValidSpeed(2)).toBe(true);
  });

  it('4 是合法速度', () => {
    const logic = new SpeedControlLogic();
    expect(logic.isValidSpeed(4)).toBe(true);
  });

  it('3 是非法速度', () => {
    const logic = new SpeedControlLogic();
    expect(logic.isValidSpeed(3)).toBe(false);
  });

  it('0 是非法速度', () => {
    const logic = new SpeedControlLogic();
    expect(logic.isValidSpeed(0)).toBe(false);
  });
});

describe('SpeedControlLogic — 速度配置', () => {
  it('获取 X1 配置', () => {
    const logic = new SpeedControlLogic(1);
    const config = logic.getSpeedConfig();
    expect(config.label).toBe('X1');
    expect(config.color).toBe('#a0a0a0');
    expect(config.interval).toBe(1000);
  });

  it('获取 X2 配置', () => {
    const logic = new SpeedControlLogic(2);
    const config = logic.getSpeedConfig();
    expect(config.label).toBe('X2');
    expect(config.interval).toBe(500);
  });

  it('获取 X4 配置', () => {
    const logic = new SpeedControlLogic(4);
    const config = logic.getSpeedConfig();
    expect(config.label).toBe('X4');
    expect(config.interval).toBe(250);
  });
});

describe('SpeedControlLogic — 状态获取', () => {
  it('获取完整状态', () => {
    const logic = new SpeedControlLogic(2);
    logic.toggleAutoBattle();
    const state = logic.getState();
    expect(state.currentSpeed).toBe(2);
    expect(state.autoBattle).toBe(true);
    expect(state.paused).toBe(false);
  });

  it('获取可用速度列表', () => {
    const logic = new SpeedControlLogic();
    const speeds = logic.getAvailableSpeeds();
    expect(speeds).toEqual([1, 2, 4]);
  });
});

describe('SpeedControlLogic — 重置', () => {
  it('重置到初始状态', () => {
    const logic = new SpeedControlLogic(4);
    logic.toggleAutoBattle();
    logic.pause();
    logic.reset();
    expect(logic.getSpeed()).toBe(1);
    expect(logic.isAutoBattle()).toBe(false);
    expect(logic.isPaused()).toBe(false);
  });
});
