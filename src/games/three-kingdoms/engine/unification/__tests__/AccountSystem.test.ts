/**
 * AccountSystem 测试
 *
 * 覆盖：
 *   - ISubsystem 接口
 *   - 账号绑定 (#11)
 *   - 多设备管理 (#13)
 *   - 账号删除 (#15)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AccountSystem } from '../AccountSystem';
import { AccountStatus } from '../../../core/unification';
import { BindMethod } from '../../../core/settings';

function createMockDeps() {
  const events: Record<string, unknown[]> = {};
  return {
    eventBus: {
      on: () => {},
      emit: (event: string, data: unknown) => { (events[event] ??= []).push(data); },
      off: () => {},
      _events: events,
    },
    config: { get: () => null },
    registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} },
  };
}

describe('AccountSystem', () => {
  let account: AccountSystem;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    account = new AccountSystem();
    deps = createMockDeps();
    account.init(deps as any);
  });

  describe('ISubsystem 接口', () => {
    it('应有正确的 name', () => {
      expect(account.name).toBe('account');
    });

    it('init 不应抛错', () => {
      expect(() => account.init(deps as any)).not.toThrow();
    });

    it('update 不应抛错', () => {
      expect(() => account.update(16)).not.toThrow();
    });

    it('reset 应恢复游客状态', () => {
      account.bind(BindMethod.Phone, '13800138000');
      account.reset();
      expect(account.isGuest()).toBe(true);
      expect(account.getBindings()).toHaveLength(0);
    });

    it('getState 应返回账号设置', () => {
      const state = account.getState();
      expect(state.isGuest).toBe(true);
      expect(state.bindings).toEqual([]);
      expect(state.devices.length).toBeGreaterThan(0);
    });
  });

  describe('#11 账号绑定', () => {
    it('游客状态应可绑定手机号', () => {
      const result = account.bind(BindMethod.Phone, '13800138000');
      expect(result.success).toBe(true);
      expect(result.method).toBe(BindMethod.Phone);
      expect(result.rewardGranted).toBe(true);
      expect(account.isBound()).toBe(true);
    });

    it('首次绑定应发放奖励', () => {
      const result = account.bind(BindMethod.Phone, '13800138000');
      expect(result.rewardGranted).toBe(true);
      expect(account.isFirstBindRewardClaimed()).toBe(true);
      expect(account.getFirstBindReward()).toBeGreaterThan(0);
    });

    it('重复绑定同方式应失败', () => {
      account.bind(BindMethod.Phone, '13800138000');
      const result = account.bind(BindMethod.Phone, '13900139000');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Already bound');
    });

    it('应支持多种绑定方式', () => {
      account.bind(BindMethod.Phone, '13800138000');
      const result = account.bind(BindMethod.Email, 'test@example.com');
      expect(result.success).toBe(true);
      expect(account.getBindings()).toHaveLength(2);
    });

    it('解绑应保留至少一个绑定', () => {
      account.bind(BindMethod.Phone, '13800138000');
      const result = account.unbind(BindMethod.Phone);
      expect(result.success).toBe(false);
      expect(result.error).toContain('last binding');
    });

    it('解绑未绑定的方式应失败', () => {
      const result = account.unbind(BindMethod.Email);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('绑定多个后可解绑', () => {
      account.bind(BindMethod.Phone, '13800138000');
      account.bind(BindMethod.Email, 'test@example.com');
      const result = account.unbind(BindMethod.Phone);
      expect(result.success).toBe(true);
      expect(account.getBindings()).toHaveLength(1);
    });

    it('标识符应脱敏显示', () => {
      account.bind(BindMethod.Phone, '13800138000');
      const bindings = account.getBindings();
      expect(bindings[0].identifier).toContain('****');
      expect(bindings[0].identifier).not.toBe('13800138000');
    });
  });

  describe('#13 多设备管理', () => {
    it('init 后应注册当前设备', () => {
      expect(account.getDeviceCount()).toBeGreaterThanOrEqual(1);
    });

    it('应返回最大设备数', () => {
      expect(account.getMaxDevices()).toBeGreaterThan(0);
    });

    it('canAddDevice 初始应为 true', () => {
      expect(account.canAddDevice()).toBe(true);
    });

    it('应可设置主力设备', () => {
      const devices = account.getDevices();
      const deviceId = devices[0].deviceId;
      expect(account.setPrimaryDevice(deviceId)).toBe(true);
      const primary = account.getPrimaryDevice();
      expect(primary).not.toBeNull();
      expect(primary!.deviceId).toBe(deviceId);
    });

    it('设置不存在的设备为主力应失败', () => {
      expect(account.setPrimaryDevice('nonexistent')).toBe(false);
    });

    it('不能解绑当前设备', () => {
      const currentId = account.getCurrentDeviceId();
      const result = account.unbindDevice(currentId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('current device');
    });

    it('解绑不存在的设备应失败', () => {
      const result = account.unbindDevice('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('#15 账号删除', () => {
    it('游客不能删除账号', () => {
      const result = account.requestDelete('确认删除');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Guest');
    });

    it('确认文字不匹配应失败', () => {
      account.bind(BindMethod.Phone, '13800138000');
      const result = account.requestDelete('错误文字');
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not match');
    });

    it('确认删除应进入冷静期', () => {
      account.bind(BindMethod.Phone, '13800138000');
      account.requestDelete('确认删除');
      const result = account.confirmDelete();
      expect(result.success).toBe(true);
      expect(result.cooldownEndsAt).toBeGreaterThan(0);
      expect(account.getAccountStatus()).toBe(AccountStatus.PendingDelete);
    });

    it('冷静期内应可撤销', () => {
      account.bind(BindMethod.Phone, '13800138000');
      account.requestDelete('确认删除');
      account.confirmDelete();
      expect(account.revokeDelete()).toBe(true);
      expect(account.getAccountStatus()).toBe(AccountStatus.Bound);
    });

    it('冷静期天数应合理', () => {
      expect(account.getCooldownDays()).toBeGreaterThan(0);
    });

    it('无删除请求时撤销应失败', () => {
      expect(account.revokeDelete()).toBe(false);
    });

    it('getDeleteRequest 无请求时应返回 null', () => {
      expect(account.getDeleteRequest()).toBeNull();
    });

    it('confirmDelete 后 getDeleteRequest 应有值', () => {
      account.bind(BindMethod.Phone, '13800138000');
      account.requestDelete('确认删除');
      account.confirmDelete();
      expect(account.getDeleteRequest()).not.toBeNull();
    });
  });
});
