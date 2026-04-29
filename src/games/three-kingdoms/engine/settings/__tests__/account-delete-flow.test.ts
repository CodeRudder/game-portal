/**
 * account-delete-flow 单元测试
 *
 * 覆盖：
 * 1. initiateDelete — 发起删除（步骤1）
 * 2. confirmDelete — 二次确认（步骤2）
 * 3. checkDeleteCooldown — 冷静期检查
 * 4. executeDelete — 永久删除（步骤3）
 * 5. cancelDelete — 撤销删除
 * 6. isGuestExpired / getGuestRemainingDays — 游客过期
 */

import {
  initiateDelete,
  confirmDelete,
  checkDeleteCooldown,
  executeDelete,
  cancelDelete,
  isGuestExpired,
  getGuestRemainingDays,
} from '../account-delete-flow';

import { DeleteFlowState } from '../account.types';

import type { AccountSettings, DeleteFlowData } from '../account.types';

describe('account-delete-flow', () => {
  const normalSettings: AccountSettings = {
    isGuest: false,
    bindings: [],
    firstBindRewardClaimed: false,
    devices: [],
    masterSwitch: true,
    bgmSwitch: true,
    bgmVolume: 80,
    sfxVolume: 80,
    voiceVolume: 80,
    masterVolume: 80,
    battleSfxSwitch: true,
    voiceSwitch: true,
  };

  const guestSettings: AccountSettings = {
    ...normalSettings,
    isGuest: true,
  };

  let nowValue: number;
  const nowFn = () => nowValue;

  beforeEach(() => {
    nowValue = 1000000;
  });

  // ─── initiateDelete ───────────────────────

  describe('initiateDelete', () => {
    it('正确确认文字应成功', () => {
      const { result, flow } = initiateDelete('确认删除', normalSettings, null, nowFn);
      expect(result.success).toBe(true);
      expect(flow).not.toBeNull();
      expect(flow!.state).toBe(DeleteFlowState.Confirmed);
    });

    it('游客账号应被拒绝', () => {
      const { result, flow } = initiateDelete('DELETE', guestSettings, null, nowFn);
      expect(result.success).toBe(false);
      expect(result.message).toContain('游客');
    });

    it('确认文字不匹配应失败', () => {
      const { result } = initiateDelete('DELETE', normalSettings, null, nowFn);
      expect(result.success).toBe(false);
      expect(result.message).toContain('不匹配');
    });

    it('已有进行中的流程应被拒绝', () => {
      const existingFlow: DeleteFlowData = {
        state: DeleteFlowState.CoolingDown,
        initiatedAt: 0,
        cooldownEndAt: 0,
      };
      const { result } = initiateDelete('确认删除', normalSettings, existingFlow, nowFn);
      expect(result.success).toBe(false);
      expect(result.message).toContain('进行中');
    });
  });

  // ─── confirmDelete ────────────────────────

  describe('confirmDelete', () => {
    it('已确认状态应进入冷静期', () => {
      const flow: DeleteFlowData = {
        state: DeleteFlowState.Confirmed,
        initiatedAt: 0,
        cooldownEndAt: 0,
      };
      const { result, flow: newFlow } = confirmDelete(flow, nowFn);
      expect(result.success).toBe(true);
      expect(newFlow!.state).toBe(DeleteFlowState.CoolingDown);
      expect(newFlow!.cooldownEndAt).toBe(nowValue + 7 * 24 * 60 * 60 * 1000);
    });

    it('null flow 应失败', () => {
      const { result } = confirmDelete(null, nowFn);
      expect(result.success).toBe(false);
    });

    it('非 Confirmed 状态应失败', () => {
      const flow: DeleteFlowData = {
        state: DeleteFlowState.CoolingDown,
        initiatedAt: 0,
        cooldownEndAt: 0,
      };
      const { result } = confirmDelete(flow, nowFn);
      expect(result.success).toBe(false);
    });
  });

  // ─── checkDeleteCooldown ──────────────────

  describe('checkDeleteCooldown', () => {
    it('冷静期未结束应保持状态', () => {
      const flow: DeleteFlowData = {
        state: DeleteFlowState.CoolingDown,
        initiatedAt: 0,
        cooldownEndAt: nowValue + 100000,
      };
      const result = checkDeleteCooldown(flow, nowFn);
      expect(result!.state).toBe(DeleteFlowState.CoolingDown);
    });

    it('冷静期已结束应推进到 ReadyToDelete', () => {
      const flow: DeleteFlowData = {
        state: DeleteFlowState.CoolingDown,
        initiatedAt: 0,
        cooldownEndAt: nowValue - 1,
      };
      const result = checkDeleteCooldown(flow, nowFn);
      expect(result!.state).toBe(DeleteFlowState.ReadyToDelete);
    });

    it('null flow 应返回 null', () => {
      expect(checkDeleteCooldown(null, nowFn)).toBeNull();
    });
  });

  // ─── executeDelete ────────────────────────

  describe('executeDelete', () => {
    it('ReadyToDelete 应成功执行删除', () => {
      const flow: DeleteFlowData = {
        state: DeleteFlowState.ReadyToDelete,
        initiatedAt: 0,
        cooldownEndAt: 0,
      };
      const { result, resetSettings } = executeDelete(flow, normalSettings);
      expect(result.success).toBe(true);
      expect(resetSettings!.isGuest).toBe(true);
      expect(resetSettings!.bindings).toEqual([]);
    });

    it('非 ReadyToDelete 应失败', () => {
      const flow: DeleteFlowData = {
        state: DeleteFlowState.CoolingDown,
        initiatedAt: 0,
        cooldownEndAt: 0,
      };
      const { result } = executeDelete(flow, normalSettings);
      expect(result.success).toBe(false);
    });

    it('null flow 应失败', () => {
      const { result } = executeDelete(null, normalSettings);
      expect(result.success).toBe(false);
    });
  });

  // ─── cancelDelete ─────────────────────────

  describe('cancelDelete', () => {
    it('冷静期内应成功撤销', () => {
      const flow: DeleteFlowData = {
        state: DeleteFlowState.CoolingDown,
        initiatedAt: 0,
        cooldownEndAt: 0,
      };
      const { result, flow: newFlow } = cancelDelete(flow);
      expect(result.success).toBe(true);
      expect(newFlow).toBeNull();
    });

    it('null flow 应失败', () => {
      const { result } = cancelDelete(null);
      expect(result.success).toBe(false);
    });

    it('ReadyToDelete 状态应不可撤销', () => {
      const flow: DeleteFlowData = {
        state: DeleteFlowState.ReadyToDelete,
        initiatedAt: 0,
        cooldownEndAt: 0,
      };
      const { result } = cancelDelete(flow);
      expect(result.success).toBe(false);
      expect(result.message).toContain('冷静期已结束');
    });
  });

  // ─── 游客过期 ─────────────────────────────

  describe('isGuestExpired', () => {
    it('非游客账号不应过期', () => {
      expect(isGuestExpired(normalSettings, 0, nowFn)).toBe(false);
    });

    it('游客账号超过过期时间应返回 true', () => {
      const createdAt = nowValue - 31 * 24 * 60 * 60 * 1000; // 31天前
      expect(isGuestExpired(guestSettings, createdAt, nowFn)).toBe(true);
    });

    it('游客账号未超过应返回 false', () => {
      const createdAt = nowValue - 10 * 24 * 60 * 60 * 1000; // 10天前
      expect(isGuestExpired(guestSettings, createdAt, nowFn)).toBe(false);
    });
  });

  describe('getGuestRemainingDays', () => {
    it('非游客应返回0', () => {
      expect(getGuestRemainingDays(normalSettings, 0, nowFn)).toBe(0);
    });

    it('未过期应返回正数天', () => {
      const createdAt = nowValue - 10 * 24 * 60 * 60 * 1000;
      const remaining = getGuestRemainingDays(guestSettings, createdAt, nowFn);
      expect(remaining).toBeGreaterThan(0);
    });

    it('已过期应返回0', () => {
      const createdAt = nowValue - 100 * 24 * 60 * 60 * 1000;
      expect(getGuestRemainingDays(guestSettings, createdAt, nowFn)).toBe(0);
    });
  });
});
