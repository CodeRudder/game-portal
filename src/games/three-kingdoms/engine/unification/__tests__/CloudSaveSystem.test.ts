/**
 * CloudSaveSystem 测试
 *
 * 覆盖：
 *   - ISubsystem 接口
 *   - 云同步 (#12)
 *   - 存档管理 (#14)
 *   - 加密与完整性
 *   - 冲突解决
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CloudSaveSystem } from '../CloudSaveSystem';
import { CloudSyncStatus } from '../../../core/unification';
import { ConflictStrategy } from '../../../core/settings';

function createMockDeps() {
  return {
    eventBus: { on: () => {}, emit: () => {}, off: () => {} },
    config: { get: () => null },
    registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} },
  };
}

describe('CloudSaveSystem', () => {
  let cloud: CloudSaveSystem;

  beforeEach(() => {
    cloud = new CloudSaveSystem();
    cloud.init(createMockDeps() as any);
  });

  describe('ISubsystem 接口', () => {
    it('应有正确的 name', () => {
      expect(cloud.name).toBe('cloudSave');
    });

    it('init 不应抛错', () => {
      expect(() => cloud.init(createMockDeps() as any)).not.toThrow();
    });

    it('reset 应清除状态', () => {
      cloud.reset();
      expect(cloud.getSyncStatus()).toBe(CloudSyncStatus.Idle);
      expect(cloud.getLastSyncAt()).toBe(0);
    });

    it('getState 应返回自动存档状态', () => {
      const state = cloud.getState();
      expect(state).toHaveProperty('elapsedSinceLastSave');
      expect(state).toHaveProperty('intervalMs');
      expect(state).toHaveProperty('enabled');
    });
  });

  describe('#12 云同步', () => {
    it('sync 应返回成功结果', async () => {
      const result = await cloud.sync();
      expect(result.status).toBe(CloudSyncStatus.Success);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('WiFi 仅模式下非 WiFi 应失败', async () => {
      cloud.syncAccountSettings({
        cloudSyncFrequency: 'onExit' as any,
        wifiOnlySync: true,
        conflictStrategy: ConflictStrategy.AlwaysAsk,
        bindings: [],
        isGuest: false,
        firstBindRewardClaimed: false,
        devices: [],
        saveSlots: [],
        lastAutoSaveAt: 0,
      });
      cloud.setWifiConnected(false);
      const result = await cloud.sync();
      expect(result.status).toBe(CloudSyncStatus.Failed);
      expect(result.error).toContain('WiFi');
    });

    it('syncOnExit 应执行同步', async () => {
      const result = await cloud.syncOnExit();
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('manualSync 应执行同步', async () => {
      const result = await cloud.manualSync();
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('同步后应更新最后同步时间', async () => {
      await cloud.sync();
      expect(cloud.getLastSyncAt()).toBeGreaterThan(0);
    });
  });

  describe('#14 存档管理', () => {
    it('应返回免费和总槽位数', () => {
      expect(cloud.getFreeSlotCount()).toBeGreaterThan(0);
      expect(cloud.getTotalSlotCount()).toBeGreaterThanOrEqual(cloud.getFreeSlotCount());
    });

    it('应返回付费槽位价格', () => {
      expect(cloud.getPaidSlotPrice()).toBeGreaterThan(0);
    });

    it('saveToSlot 不存在的槽位应失败', () => {
      const result = cloud.saveToSlot(99, 'data', 'test');
      expect(result.success).toBe(false);
    });

    it('loadFromSlot 空槽位应失败', () => {
      cloud.syncAccountSettings({
        cloudSyncFrequency: 'onExit' as any,
        wifiOnlySync: false,
        conflictStrategy: ConflictStrategy.AlwaysAsk,
        bindings: [],
        isGuest: false,
        firstBindRewardClaimed: false,
        devices: [],
        saveSlots: [{ slotIndex: 0, isPaid: false, purchased: false, data: null }],
        lastAutoSaveAt: 0,
      });
      const result = cloud.loadFromSlot(0);
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('deleteSlot 应清除数据', () => {
      cloud.syncAccountSettings({
        cloudSyncFrequency: 'onExit' as any,
        wifiOnlySync: false,
        conflictStrategy: ConflictStrategy.AlwaysAsk,
        bindings: [],
        isGuest: false,
        firstBindRewardClaimed: false,
        devices: [],
        saveSlots: [{ slotIndex: 0, isPaid: false, purchased: false, data: null }],
        lastAutoSaveAt: 0,
      });
      cloud.saveToSlot(0, 'test data', 'Test');
      const result = cloud.deleteSlot(0);
      expect(result.success).toBe(true);
    });
  });

  describe('加密与完整性', () => {
    it('encryptData 应返回加密结果', () => {
      const result = cloud.encryptData('hello world');
      expect(result.encryptedData).toBeTruthy();
      expect(result.iv).toBeTruthy();
      expect(result.checksum).toBeTruthy();
    });

    it('decryptData 应还原数据', () => {
      const original = 'test data 测试';
      const encrypted = cloud.encryptData(original);
      const payload = {
        version: 1,
        encryptedData: encrypted.encryptedData,
        iv: encrypted.iv,
        clientTimestamp: Date.now(),
        deviceId: 'test',
        checksum: encrypted.checksum,
      };
      const decrypted = cloud.decryptData(payload);
      expect(decrypted).toBe(original);
    });

    it('verifyIntegrity 有 checksum 时应通过', () => {
      const payload = {
        version: 1,
        encryptedData: 'test',
        iv: 'iv',
        clientTimestamp: Date.now(),
        deviceId: 'test',
        checksum: 'abc123',
      };
      expect(cloud.verifyIntegrity(payload)).toBe(true);
    });

    it('buildPayload 应构建完整载荷', () => {
      const payload = cloud.buildPayload('game data');
      expect(payload.version).toBeTruthy();
      expect(payload.encryptedData).toBeTruthy();
      expect(payload.deviceId).toBeTruthy();
      expect(payload.checksum).toBeTruthy();
    });
  });

  describe('冲突解决', () => {
    it('LatestWins 应取最新时间戳', () => {
      cloud.syncAccountSettings({
        cloudSyncFrequency: 'onExit' as any,
        wifiOnlySync: false,
        conflictStrategy: ConflictStrategy.LatestWins,
        bindings: [],
        isGuest: false,
        firstBindRewardClaimed: false,
        devices: [],
        saveSlots: [],
        lastAutoSaveAt: 0,
      });
      const local = { version: 1, encryptedData: 'l', iv: 'i', clientTimestamp: 2000, deviceId: 'd', checksum: 'c' };
      const remote = { version: 1, encryptedData: 'r', iv: 'i', clientTimestamp: 1000, deviceId: 'd', checksum: 'c' };
      const result = cloud.resolveConflict(local, remote);
      expect(result.clientTimestamp).toBe(2000);
    });

    it('CloudWins 应取云端数据', () => {
      cloud.syncAccountSettings({
        cloudSyncFrequency: 'onExit' as any,
        wifiOnlySync: false,
        conflictStrategy: ConflictStrategy.CloudWins,
        bindings: [],
        isGuest: false,
        firstBindRewardClaimed: false,
        devices: [],
        saveSlots: [],
        lastAutoSaveAt: 0,
      });
      const local = { version: 1, encryptedData: 'local', iv: 'i', clientTimestamp: 2000, deviceId: 'd', checksum: 'c' };
      const remote = { version: 1, encryptedData: 'remote', iv: 'i', clientTimestamp: 1000, deviceId: 'd', checksum: 'c' };
      const result = cloud.resolveConflict(local, remote);
      expect(result.encryptedData).toBe('remote');
    });

    it('getConflictStrategy 应返回当前策略', () => {
      expect(cloud.getConflictStrategy()).toBeDefined();
    });
  });
});
