/**
 * SpeedManager 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SpeedManager,
  type SpeedConfig,
  type SpeedState,
  type SpeedEvent,
} from '../modules/SpeedManager';

describe('SpeedManager', () => {
  let manager: SpeedManager;

  beforeEach(() => {
    manager = new SpeedManager();
  });

  // ============================================================
  // 初始化
  // ============================================================

  describe('初始化', () => {
    it('应使用默认配置创建实例', () => {
      const mgr = new SpeedManager();
      expect(mgr.getBaseSpeed()).toBe(1);
      expect(mgr.getSpeed()).toBe(1);
    });

    it('应接受自定义配置', () => {
      const mgr = new SpeedManager({
        baseSpeed: 2,
        maxSpeed: 20,
        allowedSpeeds: [1, 2, 4, 8, 16],
      });
      expect(mgr.getBaseSpeed()).toBe(2);
      expect(mgr.getSpeed()).toBe(2);
    });

    it('应将 allowedSpeeds 排序', () => {
      const mgr = new SpeedManager({ allowedSpeeds: [10, 1, 5, 2] });
      expect(mgr.setSpeed(1)).toBe(true);
      expect(mgr.setSpeed(2)).toBe(true);
      expect(mgr.setSpeed(5)).toBe(true);
      expect(mgr.setSpeed(10)).toBe(true);
    });
  });

  // ============================================================
  // setSpeed
  // ============================================================

  describe('setSpeed', () => {
    it('应成功设置允许的速度', () => {
      expect(manager.setSpeed(1)).toBe(true);
      expect(manager.getBaseSpeed()).toBe(1);
    });

    it('应成功切换到不同速度', () => {
      expect(manager.setSpeed(2)).toBe(true);
      expect(manager.getBaseSpeed()).toBe(2);
      expect(manager.setSpeed(5)).toBe(true);
      expect(manager.getBaseSpeed()).toBe(5);
    });

    it('应拒绝不在 allowedSpeeds 中的速度', () => {
      expect(manager.setSpeed(3)).toBe(false);
      expect(manager.getBaseSpeed()).toBe(1);
    });

    it('应拒绝超过 maxSpeed 的速度', () => {
      const mgr = new SpeedManager({ maxSpeed: 5, allowedSpeeds: [1, 2, 5, 10] });
      expect(mgr.setSpeed(10)).toBe(false);
      expect(mgr.getBaseSpeed()).toBe(1);
    });

    it('应拒绝小于 1 的速度', () => {
      expect(manager.setSpeed(0)).toBe(false);
      expect(manager.setSpeed(-1)).toBe(false);
    });

    it('设置相同速度应成功但不触发 speed_changed 事件', () => {
      const handler = vi.fn();
      manager.on(handler);
      manager.setSpeed(1);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // getSpeed
  // ============================================================

  describe('getSpeed', () => {
    it('无加速时应返回基础速度', () => {
      manager.setSpeed(2);
      expect(manager.getSpeed()).toBe(2);
    });

    it('有临时加速时应返回基础速度 × 倍率', () => {
      manager.setSpeed(2);
      manager.activateBoost(3, 10000);
      expect(manager.getSpeed()).toBe(6);
    });

    it('临时加速结果不应超过 maxSpeed', () => {
      const mgr = new SpeedManager({ maxSpeed: 10, allowedSpeeds: [1, 2, 5, 10] });
      mgr.setSpeed(5);
      mgr.activateBoost(10, 10000);
      expect(mgr.getSpeed()).toBe(10);
    });
  });

  // ============================================================
  // activateBoost
  // ============================================================

  describe('activateBoost', () => {
    it('应成功激活临时加速', () => {
      expect(manager.activateBoost(2, 5000)).toBe(true);
      expect(manager.getSpeed()).toBe(2);
    });

    it('应拒绝倍率 <= 1 的加速', () => {
      expect(manager.activateBoost(1, 5000)).toBe(false);
      expect(manager.activateBoost(0, 5000)).toBe(false);
      expect(manager.activateBoost(-1, 5000)).toBe(false);
    });

    it('应拒绝持续时间为 0 的加速', () => {
      expect(manager.activateBoost(2, 0)).toBe(false);
    });

    it('应拒绝持续时间为负数的加速', () => {
      expect(manager.activateBoost(2, -100)).toBe(false);
    });

    it('新加速应覆盖旧加速', () => {
      manager.activateBoost(2, 10000);
      manager.activateBoost(5, 5000);
      expect(manager.getSpeed()).toBe(5);
    });
  });

  // ============================================================
  // update
  // ============================================================

  describe('update', () => {
    it('应在倒计时结束后清除临时加速', () => {
      manager.activateBoost(2, 5000);
      manager.update(5000);
      expect(manager.getSpeed()).toBe(1);
    });

    it('应在倒计时未结束时保留临时加速', () => {
      manager.activateBoost(2, 5000);
      manager.update(3000);
      expect(manager.getSpeed()).toBe(2);
    });

    it('应在无临时加速时安全调用', () => {
      expect(() => manager.update(1000)).not.toThrow();
    });

    it('应正确递减剩余时间', () => {
      manager.activateBoost(2, 10000);
      manager.update(3000);
      const state = manager.getState();
      expect(state.temporaryBoost?.remainingMs).toBe(7000);
    });

    it('多次 update 累计超过持续时间应过期', () => {
      manager.activateBoost(2, 5000);
      manager.update(2000);
      manager.update(2000);
      manager.update(2000);
      expect(manager.getSpeed()).toBe(1);
    });
  });

  // ============================================================
  // 事件系统
  // ============================================================

  describe('事件系统', () => {
    it('setSpeed 应触发 speed_changed 事件', () => {
      const handler = vi.fn();
      manager.on(handler);
      manager.setSpeed(2);
      expect(handler).toHaveBeenCalledWith({
        type: 'speed_changed',
        data: { from: 1, to: 2 },
      });
    });

    it('activateBoost 应触发 boost_activated 事件', () => {
      const handler = vi.fn();
      manager.on(handler);
      manager.activateBoost(3, 5000);
      expect(handler).toHaveBeenCalledWith({
        type: 'boost_activated',
        data: { multiplier: 3, durationMs: 5000 },
      });
    });

    it('update 导致过期应触发 boost_expired 事件', () => {
      const handler = vi.fn();
      manager.on(handler);
      manager.activateBoost(2, 5000);
      manager.update(5000);
      expect(handler).toHaveBeenCalledWith({
        type: 'boost_expired',
        data: {},
      });
    });

    it('update 未过期应触发 boost_updated 事件', () => {
      const handler = vi.fn();
      manager.on(handler);
      manager.activateBoost(2, 10000);
      manager.update(3000);
      expect(handler).toHaveBeenCalledWith({
        type: 'boost_updated',
        data: { remainingMs: 7000 },
      });
    });

    it('off 应正确注销监听器', () => {
      const handler = vi.fn();
      manager.on(handler);
      manager.off(handler);
      manager.setSpeed(2);
      expect(handler).not.toHaveBeenCalled();
    });

    it('注销未注册的监听器应安全无操作', () => {
      const handler = vi.fn();
      expect(() => manager.off(handler)).not.toThrow();
    });
  });

  // ============================================================
  // getState / loadState
  // ============================================================

  describe('getState / loadState', () => {
    it('getState 应返回正确的初始状态', () => {
      const state = manager.getState();
      expect(state.currentSpeed).toBe(1);
      expect(state.baseSpeed).toBe(1);
      expect(state.temporaryBoost).toBeNull();
    });

    it('getState 应反映临时加速状态', () => {
      manager.activateBoost(3, 10000);
      const state = manager.getState();
      expect(state.temporaryBoost).toEqual({ multiplier: 3, remainingMs: 10000 });
    });

    it('loadState 应正确恢复状态', () => {
      const state: SpeedState = {
        currentSpeed: 5,
        baseSpeed: 1,
        temporaryBoost: { multiplier: 2, remainingMs: 3000 },
      };
      manager.loadState(state);
      expect(manager.getBaseSpeed()).toBe(5);
      expect(manager.getSpeed()).toBe(10);
    });

    it('loadState 应拒绝不合法的 currentSpeed', () => {
      expect(() => manager.loadState({ currentSpeed: 0, baseSpeed: 1, temporaryBoost: null }))
        .toThrow();
      expect(() => manager.loadState({ currentSpeed: -1, baseSpeed: 1, temporaryBoost: null }))
        .toThrow();
    });

    it('loadState 应拒绝不在 allowedSpeeds 中的速度', () => {
      expect(() => manager.loadState({ currentSpeed: 3, baseSpeed: 1, temporaryBoost: null }))
        .toThrow();
    });

    it('loadState 应拒绝不合法的 temporaryBoost', () => {
      expect(() =>
        manager.loadState({ currentSpeed: 1, baseSpeed: 1, temporaryBoost: { multiplier: 1, remainingMs: 1000 } }),
      ).toThrow();
      expect(() =>
        manager.loadState({ currentSpeed: 1, baseSpeed: 1, temporaryBoost: { multiplier: 2, remainingMs: -100 } }),
      ).toThrow();
    });

    it('loadState 应接受 null 临时加速', () => {
      manager.activateBoost(2, 5000);
      manager.loadState({ currentSpeed: 1, baseSpeed: 1, temporaryBoost: null });
      expect(manager.getSpeed()).toBe(1);
    });
  });

  // ============================================================
  // reset
  // ============================================================

  describe('reset', () => {
    it('应重置速度到基础速度', () => {
      manager.setSpeed(5);
      manager.reset();
      expect(manager.getBaseSpeed()).toBe(1);
      expect(manager.getSpeed()).toBe(1);
    });

    it('应清除临时加速', () => {
      manager.activateBoost(3, 10000);
      manager.reset();
      expect(manager.getSpeed()).toBe(1);
      const state = manager.getState();
      expect(state.temporaryBoost).toBeNull();
    });
  });
});
