import { vi } from 'vitest';
/**
 * CloudSaveSystem 单元测试
 *
 * 覆盖：
 * 1. 初始化与配置
 * 2. 同步执行（正常/冲突/失败）
 * 3. 冲突解决（最新优先/云端优先/始终询问）
 * 4. 自动同步调度
 * 5. 加密/解密
 * 6. 数据完整性（校验和）
 * 7. 事件通知
 * 8. 重置
 */

import {
  CloudSaveSystem,
  CloudSyncState,
} from '../CloudSaveSystem';
import type {
  INetworkDetector,
  ICloudStorage,
  CloudSaveMetadata,
  CloudSaveChangeCallback,
  NowFn,
} from '../CloudSaveSystem';
import {
  CloudSyncFrequency,
  ConflictStrategy,
} from '../../../core/settings';
import type { AccountSettings } from '../../../core/settings';
import { createDefaultAccountSettings } from '../../../core/settings';

// ─────────────────────────────────────────────
// Mock 工具
// ─────────────────────────────────────────────

let mockNow = 1000000;
const mockNowFn: NowFn = () => mockNow;

/** Mock 网络检测器 */
function createMockNetwork(online = true, wifi = true): INetworkDetector {
  return {
    isOnline: () => online,
    isWifi: () => wifi,
  };
}

/** Mock 云存储 */
function createMockStorage(): {
  storage: ICloudStorage;
  uploaded: Array<{ data: string; metadata: CloudSaveMetadata }>;
  remoteData: { data: string; metadata: CloudSaveMetadata } | null;
  setRemote: (data: string, ts: number) => void;
} {
  const uploaded: Array<{ data: string; metadata: CloudSaveMetadata }> = [];
  let remoteData: { data: string; metadata: CloudSaveMetadata } | null = null;

  const storage: ICloudStorage = {
    upload: async (data: string, metadata: CloudSaveMetadata) => {
      uploaded.push({ data, metadata });
      remoteData = { data, metadata };
      return true;
    },
    download: async () => remoteData,
    getMetadata: async () => remoteData?.metadata ?? null,
    delete: async () => {
      remoteData = null;
      return true;
    },
  };

  return {
    storage,
    uploaded,
    get remoteData() { return remoteData; },
    setRemote: (data: string, ts: number) => {
      remoteData = {
        data,
        metadata: {
          version: '1.0',
          lastSyncedAt: ts,
          syncedDeviceId: 'remote-device',
          sizeBytes: data.length,
          checksum: '',
        },
      };
    },
  };
}

function createSystem(options?: {
  network?: INetworkDetector;
  storage?: ICloudStorage;
}): CloudSaveSystem {
  const sys = new CloudSaveSystem({
    nowFn: mockNowFn,
    networkDetector: options?.network ?? createMockNetwork(),
    cloudStorage: options?.storage,
  });
  return sys;
}

function createInitializedSystem(
  settings?: Partial<AccountSettings>,
  options?: {
    network?: INetworkDetector;
    storage?: ICloudStorage;
  },
): CloudSaveSystem {
  const sys = createSystem(options);
  const defaultSettings = createDefaultAccountSettings();
  sys.configure({ ...defaultSettings, ...settings });
  return sys;
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('CloudSaveSystem', () => {
  beforeEach(() => {
    mockNow = 1000000;
  });

  // ── 初始化与配置 ────────────────────────

  describe('初始化与配置', () => {
    test('初始状态为 Idle', () => {
      const sys = createSystem();
      expect(sys.getState()).toBe(CloudSyncState.Idle);
    });

    test('getLastSyncResult 初始为 null', () => {
      const sys = createSystem();
      expect(sys.getLastSyncResult()).toBeNull();
    });

    test('configure 设置账号配置后仍为 Idle', () => {
      const sys = createInitializedSystem();
      expect(sys.getState()).toBe(CloudSyncState.Idle);
    });

    test('setCloudStorage 设置存储实现', () => {
      const sys = createSystem();
      const { storage } = createMockStorage();
      sys.setCloudStorage(storage);
      // 设置后不会抛错
      expect(sys.getState()).toBe(CloudSyncState.Idle);
    });
  });

  // ── 同步执行 ────────────────────────────

  describe('同步执行', () => {
    test('无云存储时同步失败', async () => {
      const sys = createInitializedSystem();
      const result = await sys.sync('local-data', 'device-1');
      expect(result.state).toBe(CloudSyncState.Failed);
      expect(result.message).toBe('云存储未配置');
    });

    test('网络不可用时同步失败', async () => {
      const { storage } = createMockStorage();
      const network = createMockNetwork(false, false);
      const sys = createInitializedSystem({}, { storage, network });
      const result = await sys.sync('local-data', 'device-1');
      expect(result.state).toBe(CloudSyncState.Failed);
      expect(result.message).toBe('网络不可用');
    });

    test('WiFi 限制下非 WiFi 同步失败', async () => {
      const { storage } = createMockStorage();
      const network = createMockNetwork(true, false);
      const sys = createInitializedSystem(
        { wifiOnlySync: true },
        { storage, network },
      );
      const result = await sys.sync('local-data', 'device-1');
      expect(result.state).toBe(CloudSyncState.Failed);
      expect(result.message).toBe('仅 WiFi 下同步');
    });

    test('正常同步成功', async () => {
      const { storage } = createMockStorage();
      const sys = createInitializedSystem({}, { storage });
      const result = await sys.sync('local-data', 'device-1');
      expect(result.state).toBe(CloudSyncState.Success);
      expect(result.syncedAt).toBe(mockNow);
    });

    test('同步后更新 lastSyncResult', async () => {
      const { storage } = createMockStorage();
      const sys = createInitializedSystem({}, { storage });
      await sys.sync('local-data', 'device-1');
      const last = sys.getLastSyncResult();
      expect(last).not.toBeNull();
      expect(last!.state).toBe(CloudSyncState.Success);
    });

    test('同步时状态经过 Syncing', async () => {
      const { storage } = createMockStorage();
      const sys = createInitializedSystem({}, { storage });
      const states: CloudSyncState[] = [];
      sys.onChange((state) => states.push(state));
      await sys.sync('local-data', 'device-1');
      expect(states).toContain(CloudSyncState.Syncing);
      expect(states).toContain(CloudSyncState.Success);
    });
  });

  // ── 冲突解决 ────────────────────────────

  describe('冲突解决', () => {
    test('AlwaysAsk 策略检测到冲突返回 Conflict', async () => {
      const mock = createMockStorage();
      mock.setRemote('remote-data', 2000);
      const sys = createInitializedSystem(
        { conflictStrategy: ConflictStrategy.AlwaysAsk },
        { storage: mock.storage },
      );
      const result = await sys.sync('local-data', 'device-1', 1000);
      expect(result.state).toBe(CloudSyncState.Conflict);
      expect(result.remoteData).toBe('remote-data');
      expect(result.remoteTimestamp).toBe(2000);
    });

    test('LatestWins 策略自动选择最新数据', async () => {
      const mock = createMockStorage();
      mock.setRemote('remote-data', 2000);
      const sys = createInitializedSystem(
        { conflictStrategy: ConflictStrategy.LatestWins },
        { storage: mock.storage },
      );
      const result = await sys.sync('local-data', 'device-1', 1000);
      // 远程更新 → 选择远程
      expect(result.state).toBe(CloudSyncState.Success);
      expect(mock.uploaded.length).toBeGreaterThan(0);
    });

    test('CloudWins 策略始终选择远程', async () => {
      const mock = createMockStorage();
      mock.setRemote('remote-data', 500);
      const sys = createInitializedSystem(
        { conflictStrategy: ConflictStrategy.CloudWins },
        { storage: mock.storage },
      );
      const result = await sys.sync('local-data', 'device-1', 2000);
      expect(result.state).toBe(CloudSyncState.Success);
    });

    test('resolveAndUpload 解决冲突后上传', async () => {
      const mock = createMockStorage();
      mock.setRemote('remote-data', 2000);
      const sys = createInitializedSystem(
        { conflictStrategy: ConflictStrategy.AlwaysAsk },
        { storage: mock.storage },
      );
      // 先触发冲突
      await sys.sync('local-data', 'device-1', 1000);
      // 用户选择后解决
      const result = await sys.resolveAndUpload('chosen-data', 'device-1');
      expect(result.state).toBe(CloudSyncState.Success);
      expect(result.message).toContain('冲突已解决');
    });

    test('resolveAndUpload 无存储时失败', async () => {
      const sys = createInitializedSystem();
      const result = await sys.resolveAndUpload('data', 'device-1');
      expect(result.state).toBe(CloudSyncState.Failed);
    });
  });

  // ── 自动同步 ────────────────────────────

  describe('自动同步', () => {
    test('ManualOnly 模式不启动自动同步', () => {
      const sys = createInitializedSystem({
        cloudSyncFrequency: CloudSyncFrequency.ManualOnly,
      });
      sys.startAutoSync(() => 'data', 'device-1');
      expect(sys.isAutoSyncing()).toBe(false);
    });

    test('Hourly 模式启动自动同步', () => {
      const { storage } = createMockStorage();
      const sys = createInitializedSystem(
        { cloudSyncFrequency: CloudSyncFrequency.Hourly },
        { storage },
      );
      sys.startAutoSync(() => 'data', 'device-1');
      expect(sys.isAutoSyncing()).toBe(true);
      sys.stopAutoSync();
    });

    test('stopAutoSync 停止自动同步', () => {
      const { storage } = createMockStorage();
      const sys = createInitializedSystem(
        { cloudSyncFrequency: CloudSyncFrequency.Hourly },
        { storage },
      );
      sys.startAutoSync(() => 'data', 'device-1');
      sys.stopAutoSync();
      expect(sys.isAutoSyncing()).toBe(false);
    });

    test('OnExit 模式不启动定时同步', () => {
      const sys = createInitializedSystem({
        cloudSyncFrequency: CloudSyncFrequency.OnExit,
      });
      sys.startAutoSync(() => 'data', 'device-1');
      expect(sys.isAutoSyncing()).toBe(false);
    });
  });

  // ── 加密/解密 ──────────────────────────

  describe('加密/解密', () => {
    test('加密后可解密还原', () => {
      const sys = createSystem();
      const original = '{"test": "数据", "num": 123}';
      const key = 'test-key-123';
      const encrypted = sys.encrypt(original, key);
      expect(encrypted).not.toBe(original);
      const decrypted = sys.decrypt(encrypted, key);
      expect(decrypted).toBe(original);
    });

    test('不同密钥解密结果不同', () => {
      const sys = createSystem();
      const original = 'hello world';
      const encrypted = sys.encrypt(original, 'key1');
      const decrypted = sys.decrypt(encrypted, 'key2');
      expect(decrypted).not.toBe(original);
    });

    test('空字符串加密解密', () => {
      const sys = createSystem();
      const encrypted = sys.encrypt('', 'key');
      const decrypted = sys.decrypt(encrypted, 'key');
      expect(decrypted).toBe('');
    });
  });

  // ── 数据完整性 ──────────────────────────

  describe('数据完整性', () => {
    test('校验和一致返回 true', () => {
      const sys = createSystem();
      const data = 'test-data';
      const checksum = sys.computeChecksum(data);
      expect(sys.verifyIntegrity(data, checksum)).toBe(true);
    });

    test('数据篡改后校验和不一致', () => {
      const sys = createSystem();
      const checksum = sys.computeChecksum('original');
      expect(sys.verifyIntegrity('modified', checksum)).toBe(false);
    });

    test('相同数据产生相同校验和', () => {
      const sys = createSystem();
      const data = 'consistent-data';
      expect(sys.computeChecksum(data)).toBe(sys.computeChecksum(data));
    });
  });

  // ── 事件通知 ────────────────────────────

  describe('事件通知', () => {
    test('同步状态变更触发回调', async () => {
      const { storage } = createMockStorage();
      const sys = createInitializedSystem({}, { storage });
      const callback = vi.fn();
      sys.onChange(callback);

      await sys.sync('data', 'device-1');
      expect(callback).toHaveBeenCalled();
      // 至少 Syncing + Success
      const calls = callback.mock.calls.map((c: [CloudSyncState]) => c[0]);
      expect(calls).toContain(CloudSyncState.Syncing);
      expect(calls).toContain(CloudSyncState.Success);
    });

    test('取消注册后不再触发', async () => {
      const { storage } = createMockStorage();
      const sys = createInitializedSystem({}, { storage });
      const callback = vi.fn();
      const unsub = sys.onChange(callback);
      unsub();

      await sys.sync('data', 'device-1');
      expect(callback).not.toHaveBeenCalled();
    });

    test('removeAllListeners 清除所有回调', async () => {
      const { storage } = createMockStorage();
      const sys = createInitializedSystem({}, { storage });
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      sys.onChange(cb1);
      sys.onChange(cb2);
      sys.removeAllListeners();

      await sys.sync('data', 'device-1');
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });
  });

  // ── 重置 ────────────────────────────────

  describe('重置', () => {
    test('reset 清除所有状态', async () => {
      const { storage } = createMockStorage();
      const sys = createInitializedSystem({}, { storage });
      await sys.sync('data', 'device-1');
      sys.reset();

      expect(sys.getState()).toBe(CloudSyncState.Idle);
      expect(sys.getLastSyncResult()).toBeNull();
    });

    test('reset 停止自动同步', () => {
      const { storage } = createMockStorage();
      const sys = createInitializedSystem(
        { cloudSyncFrequency: CloudSyncFrequency.Hourly },
        { storage },
      );
      sys.startAutoSync(() => 'data', 'device-1');
      sys.reset();
      expect(sys.isAutoSyncing()).toBe(false);
    });
  });
});
