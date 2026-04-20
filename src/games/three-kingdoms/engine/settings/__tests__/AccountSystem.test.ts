/**
 * AccountSystem 单元测试
 *
 * 覆盖：
 * 1. 账号绑定（手机/邮箱/第三方+首次绑定奖励元宝×50）
 * 2. 解绑（至少保留一个绑定）
 * 3. 多设备管理（最多5台+主力标记+解绑冷却24h）
 * 4. 账号删除流程（确认文字→二次确认→7天冷静期→永久删除）
 * 5. 游客账号（过期检测+剩余天数）
 * 6. 事件监听
 */

import { AccountSystem, DeleteFlowState } from '../AccountSystem';
import type { BindResult, DeviceResult } from '../AccountSystem';
import {
  BindMethod,
  MAX_DEVICES,
  FIRST_BIND_REWARD,
  ACCOUNT_DELETE_COOLDOWN_DAYS,
  DEVICE_UNBIND_COOLDOWN_HOURS,
} from '../../../core/settings';
import type { AccountSettings } from '../../../core/settings';
import { createDefaultAccountSettings } from '../../../core/settings';

// ─────────────────────────────────────────────
// Mock
// ─────────────────────────────────────────────

let mockNow = 1000000;
function mockNowFn(): number {
  return mockNow;
}

function createAccountSettings(): AccountSettings {
  return createDefaultAccountSettings();
}

function createAccount(): AccountSystem {
  const account = new AccountSystem({ nowFn: mockNowFn });
  account.initialize(createAccountSettings());
  return account;
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('AccountSystem', () => {
  let account: AccountSystem;

  beforeEach(() => {
    mockNow = 1000000;
    account = createAccount();
  });

  // ── 账号绑定 ────────────────────────────

  describe('账号绑定', () => {
    test('绑定手机号成功', () => {
      const result = account.bind(BindMethod.Phone, '138****1234');
      expect(result.success).toBe(true);
      expect(result.message).toBe('绑定成功');
    });

    test('首次绑定奖励元宝×50', () => {
      const grantFn = jest.fn();
      account.setGrantIngotFn(grantFn);
      const result = account.bind(BindMethod.Phone, '138****1234');
      expect(result.rewardGranted).toBe(true);
      expect(result.rewardAmount).toBe(FIRST_BIND_REWARD);
      expect(grantFn).toHaveBeenCalledWith(FIRST_BIND_REWARD);
    });

    test('第二次绑定不触发奖励', () => {
      account.bind(BindMethod.Phone, '138****1234');
      const result = account.bind(BindMethod.Email, 'test@example.com');
      expect(result.rewardGranted).toBe(false);
      expect(result.rewardAmount).toBe(0);
    });

    test('重复绑定同一种方式失败', () => {
      account.bind(BindMethod.Phone, '138****1234');
      const result = account.bind(BindMethod.Phone, '139****5678');
      expect(result.success).toBe(false);
      expect(result.message).toContain('已绑定');
    });

    test('可绑定多种不同方式', () => {
      account.bind(BindMethod.Phone, '138****1234');
      account.bind(BindMethod.Email, 'test@example.com');
      account.bind(BindMethod.WeChat, 'wx_123');
      expect(account.getBindings()).toHaveLength(3);
    });

    test('绑定后不再是游客', () => {
      expect(account.getSettings()?.isGuest).toBe(true);
      account.bind(BindMethod.Phone, '138****1234');
      expect(account.getSettings()?.isGuest).toBe(false);
    });

    test('hasBinding 正确判断', () => {
      expect(account.hasBinding(BindMethod.Phone)).toBe(false);
      account.bind(BindMethod.Phone, '138****1234');
      expect(account.hasBinding(BindMethod.Phone)).toBe(true);
      expect(account.hasBinding(BindMethod.Email)).toBe(false);
    });
  });

  // ── 解绑 ────────────────────────────────

  describe('解绑', () => {
    test('解绑成功', () => {
      account.bind(BindMethod.Phone, '138****1234');
      account.bind(BindMethod.Email, 'test@example.com');
      const result = account.unbind(BindMethod.Phone);
      expect(result.success).toBe(true);
      expect(account.hasBinding(BindMethod.Phone)).toBe(false);
      expect(account.hasBinding(BindMethod.Email)).toBe(true);
    });

    test('只剩一个绑定时不能解绑', () => {
      account.bind(BindMethod.Phone, '138****1234');
      const result = account.unbind(BindMethod.Phone);
      expect(result.success).toBe(false);
      expect(result.message).toContain('至少保留');
    });

    test('解绑不存在的绑定失败', () => {
      const result = account.unbind(BindMethod.Phone);
      expect(result.success).toBe(false);
      expect(result.message).toContain('未找到');
    });
  });

  // ── 多设备管理 ──────────────────────────

  describe('多设备管理', () => {
    test('注册第一个设备自动设为主力', () => {
      const result = account.registerDevice('dev1', 'iPhone 15');
      expect(result.success).toBe(true);
      expect(result.devices).toHaveLength(1);
      expect(result.devices[0].isPrimary).toBe(true);
    });

    test('注册多个设备', () => {
      account.registerDevice('dev1', 'iPhone 15');
      account.registerDevice('dev2', 'iPad Pro');
      expect(account.getDevices()).toHaveLength(2);
    });

    test('超过最大设备数限制', () => {
      for (let i = 0; i < MAX_DEVICES; i++) {
        account.registerDevice(`dev${i}`, `Device ${i}`);
      }
      const result = account.registerDevice('dev_extra', 'Extra Device');
      expect(result.success).toBe(false);
      expect(result.message).toContain(`${MAX_DEVICES}`);
    });

    test('重复注册更新活跃时间', () => {
      account.registerDevice('dev1', 'iPhone 15');
      const first = account.getDevices()[0].lastActiveAt;

      mockNow += 10000;
      account.registerDevice('dev1', 'iPhone 15');
      const updated = account.getDevices()[0].lastActiveAt;

      expect(updated).toBeGreaterThan(first);
      expect(account.getDevices()).toHaveLength(1);
    });

    test('解绑设备', () => {
      account.registerDevice('dev1', 'iPhone 15');
      account.registerDevice('dev2', 'iPad Pro');
      const result = account.unregisterDevice('dev2');
      expect(result.success).toBe(true);
      expect(account.getDevices()).toHaveLength(1);
    });

    test('解绑主力设备后最新设备升级为主力', () => {
      account.registerDevice('dev1', 'iPhone 15');
      mockNow += 1000;
      account.registerDevice('dev2', 'iPad Pro');

      const result = account.unregisterDevice('dev1');
      expect(result.success).toBe(true);
      expect(account.getPrimaryDevice()?.deviceId).toBe('dev2');
    });

    test('不能解绑唯一设备', () => {
      account.registerDevice('dev1', 'iPhone 15');
      const result = account.unregisterDevice('dev1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('至少保留');
    });

    test('设置主力设备', () => {
      account.registerDevice('dev1', 'iPhone 15');
      account.registerDevice('dev2', 'iPad Pro');

      const result = account.setPrimaryDevice('dev2');
      expect(result.success).toBe(true);
      expect(account.getPrimaryDevice()?.deviceId).toBe('dev2');
      expect(account.getDevices().find(d => d.deviceId === 'dev1')?.isPrimary).toBe(false);
    });

    test('设备解绑冷却检测', () => {
      const unbindTime = mockNow;
      expect(account.isDeviceInUnbindCooldown(unbindTime)).toBe(true);

      // 超过冷却期
      mockNow += DEVICE_UNBIND_COOLDOWN_HOURS * 60 * 60 * 1000 + 1;
      expect(account.isDeviceInUnbindCooldown(unbindTime)).toBe(false);
    });

    test('getPrimaryDevice 返回主力设备', () => {
      account.registerDevice('dev1', 'iPhone 15');
      expect(account.getPrimaryDevice()?.deviceId).toBe('dev1');
    });

    test('getPrimaryDevice 无设备返回 null', () => {
      expect(account.getPrimaryDevice()).toBeNull();
    });
  });

  // ── 账号删除流程 ────────────────────────

  describe('账号删除流程', () => {
    test('步骤1：输入确认文字', () => {
      // 先绑定一个账号（非游客）
      account.bind(BindMethod.Phone, '138****1234');

      const result = account.initiateDelete('确认删除');
      expect(result.success).toBe(true);
      expect(account.getDeleteFlow()?.state).toBe(DeleteFlowState.Confirmed);
    });

    test('步骤1：确认文字不匹配', () => {
      account.bind(BindMethod.Phone, '138****1234');
      const result = account.initiateDelete('错误文字');
      expect(result.success).toBe(false);
      expect(result.message).toContain('不匹配');
    });

    test('步骤2：二次确认进入冷静期', () => {
      account.bind(BindMethod.Phone, '138****1234');
      account.initiateDelete('确认删除');

      const result = account.confirmDelete();
      expect(result.success).toBe(true);
      expect(result.message).toContain(`${ACCOUNT_DELETE_COOLDOWN_DAYS}天冷静期`);
      expect(account.getDeleteFlow()?.state).toBe(DeleteFlowState.CoolingDown);
    });

    test('冷静期未结束不能删除', () => {
      account.bind(BindMethod.Phone, '138****1234');
      account.initiateDelete('确认删除');
      account.confirmDelete();

      const result = account.executeDelete();
      expect(result.success).toBe(false);
    });

    test('冷静期结束后可永久删除', () => {
      account.bind(BindMethod.Phone, '138****1234');
      account.initiateDelete('确认删除');
      account.confirmDelete();

      // 快进冷静期
      mockNow += ACCOUNT_DELETE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000 + 1;
      account.checkDeleteCooldown();

      const result = account.executeDelete();
      expect(result.success).toBe(true);
      expect(result.message).toContain('永久删除');
      // 重置为游客
      expect(account.getSettings()?.isGuest).toBe(true);
      expect(account.getSettings()?.bindings).toHaveLength(0);
    });

    test('冷静期内可撤销', () => {
      account.bind(BindMethod.Phone, '138****1234');
      account.initiateDelete('确认删除');
      account.confirmDelete();

      const result = account.cancelDelete();
      expect(result.success).toBe(true);
      expect(account.getDeleteFlow()).toBeNull();
    });

    test('游客账号不能发起删除', () => {
      const result = account.initiateDelete('确认删除');
      expect(result.success).toBe(false);
      expect(result.message).toContain('游客');
    });

    test('重复发起删除失败', () => {
      account.bind(BindMethod.Phone, '138****1234');
      account.initiateDelete('确认删除');
      const result = account.initiateDelete('确认删除');
      expect(result.success).toBe(false);
      expect(result.message).toContain('已在进行中');
    });

    test('checkDeleteCooldown 自动更新状态', () => {
      account.bind(BindMethod.Phone, '138****1234');
      account.initiateDelete('确认删除');
      account.confirmDelete();

      // 冷静期未结束
      const data1 = account.checkDeleteCooldown();
      expect(data1?.state).toBe(DeleteFlowState.CoolingDown);

      // 快进冷静期
      mockNow += ACCOUNT_DELETE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000 + 1;
      const data2 = account.checkDeleteCooldown();
      expect(data2?.state).toBe(DeleteFlowState.ReadyToDelete);
    });
  });

  // ── 游客账号 ────────────────────────────

  describe('游客账号', () => {
    test('游客账号过期检测', () => {
      const createdAt = mockNow - 31 * 24 * 60 * 60 * 1000; // 31天前
      expect(account.isGuestExpired(createdAt)).toBe(true);
    });

    test('游客账号未过期', () => {
      const createdAt = mockNow - 10 * 24 * 60 * 60 * 1000; // 10天前
      expect(account.isGuestExpired(createdAt)).toBe(false);
    });

    test('游客账号剩余天数', () => {
      const createdAt = mockNow - 20 * 24 * 60 * 60 * 1000; // 20天前
      const remaining = account.getGuestRemainingDays(createdAt);
      expect(remaining).toBe(10);
    });

    test('非游客账号不过期', () => {
      account.bind(BindMethod.Phone, '138****1234');
      const createdAt = mockNow - 31 * 24 * 60 * 60 * 1000;
      expect(account.isGuestExpired(createdAt)).toBe(false);
    });
  });

  // ── 事件监听 ────────────────────────────

  describe('事件监听', () => {
    test('onChange 在绑定变更时触发', () => {
      const cb = jest.fn();
      account.onChange(cb);
      account.bind(BindMethod.Phone, '138****1234');
      expect(cb).toHaveBeenCalledTimes(1);
    });

    test('取消注册后不再触发', () => {
      const cb = jest.fn();
      const unsub = account.onChange(cb);
      unsub();
      account.bind(BindMethod.Phone, '138****1234');
      expect(cb).not.toHaveBeenCalled();
    });

    test('removeAllListeners 清除所有回调', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      account.onChange(cb1);
      account.onChange(cb2);
      account.removeAllListeners();
      account.bind(BindMethod.Phone, '138****1234');
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });
  });

  // ── 重置 ────────────────────────────────

  describe('重置', () => {
    test('reset 恢复到初始状态', () => {
      account.bind(BindMethod.Phone, '138****1234');
      account.registerDevice('dev1', 'iPhone');
      account.reset();
      expect(account.getSettings()).toBeNull();
      expect(account.getDeleteFlow()).toBeNull();
    });
  });

  // ── 未初始化 ────────────────────────────

  describe('未初始化', () => {
    test('未初始化时绑定失败', () => {
      const uninitialized = new AccountSystem({ nowFn: mockNowFn });
      const result = uninitialized.bind(BindMethod.Phone, '138****1234');
      expect(result.success).toBe(false);
      expect(result.message).toContain('未初始化');
    });

    test('未初始化时注册设备失败', () => {
      const uninitialized = new AccountSystem({ nowFn: mockNowFn });
      const result = uninitialized.registerDevice('dev1', 'iPhone');
      expect(result.success).toBe(false);
    });
  });
});
