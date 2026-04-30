/**
 * 集成测试 — §4~§5 天下大势 + 交叉验证
 *
 * 验证设置系统与统一系统联动：
 *   §4 SettingsManager × BalanceValidator × IntegrationValidator 联动
 *   §5 存档/云同步/账号管理在统一流程中的正确行为
 *
 * 覆盖：设置变更→数值验证→联调检测→云存档同步→账号绑定→存档恢复全链路。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRealDeps } from '../../../../test-utils/test-helpers';
import { SettingsManager, type ISettingsStorage } from '../../../settings/SettingsManager';
import { CloudSaveSystem, CloudSyncState } from '../../../settings/CloudSaveSystem';
import { AccountSystem, DeleteFlowState } from '../../../settings/AccountSystem';
import { BalanceValidator } from '../../BalanceValidator';
import { IntegrationValidator } from '../../IntegrationValidator';
import { DefaultSimulationDataProvider } from '../../SimulationDataProvider';
import { DEFAULT_REBIRTH_CONFIG, DEFAULT_BATTLE_CONFIG } from '../../BalanceCalculator';
import { calcRebirthMultiplier } from '../../BalanceUtils';
import type { ICloudStorage, INetworkDetector, CloudSaveChangeCallback } from '../../../settings/cloud-save.types';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function createMockStorage() {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
  };
}

function createMockCloudStorage(): ICloudStorage {
  let savedData: string | null = null;
  let savedMetadata: Record<string, unknown> | null = null;
  return {
    upload: vi.fn((data: string, metadata: Record<string, unknown>) => {
      savedData = data;
      savedMetadata = metadata;
      return Promise.resolve(true);
    }),
    download: vi.fn(() => {
      if (!savedData || !savedMetadata) return Promise.resolve(null);
      return Promise.resolve({ data: savedData, metadata: savedMetadata });
    }),
  };
}

function createMockNetworkDetector(online: boolean, wifi: boolean): INetworkDetector {
  return {
    isOnline: () => online,
    isWifi: () => wifi,
  };
}

// ═════════════════════════════════════════════════════════════

describe('§4~§5 天下大势 + 交叉验证 集成测试', () => {
  let settings: SettingsManager;
  let storage: ReturnType<typeof createMockStorage>;
  let balance: BalanceValidator;
  let integration: IntegrationValidator;

  beforeEach(() => {
    storage = createMockStorage();
    settings = new SettingsManager(storage);
    settings.init(createRealDeps());
    balance = new BalanceValidator();
    balance.init(createRealDeps());
    integration = new IntegrationValidator();
    integration.init(createRealDeps());
  });

  // ─── §4 设置系统与统一系统联动 ──────────────

  describe('§4 设置系统与统一系统联动', () => {
    it('SettingsManager初始化后BalanceValidator可独立运行验证', () => {
      expect(settings.isInitialized()).toBe(true);
      const report = balance.validateAll();
      expect(report.entries.length).toBeGreaterThan(0);
    });

    it('设置变更通知机制与联调验证器无冲突', () => {
      const changes: unknown[] = [];
      settings.onChange((evt) => changes.push(evt));
      settings.updateAudioSettings({ masterVolume: 50 });
      expect(changes).toHaveLength(1);

      // 联调验证不受设置变更影响
      const report = integration.validateAll();
      expect(report.overallPassed).toBe(true);
    });

    it('设置持久化后BalanceValidator仍使用默认配置', () => {
      settings.updateGraphicsSettings({ preset: 'low' });
      // BalanceValidator 不受设置影响
      const config = balance.getBattleConfig();
      expect(config).toEqual(DEFAULT_BATTLE_CONFIG);
    });

    it('BalanceValidator配置注入后生成新报告', () => {
      const customConfig = { ...DEFAULT_BATTLE_CONFIG, growthFactor: 2.0 };
      balance.setBattleConfig(customConfig);
      const report = balance.validateAll();
      expect(report.entries.length).toBeGreaterThan(0);
    });

    it('IntegrationValidator与SettingsManager可并行工作', () => {
      settings.updateBasicSettings({ language: 'en' });
      const intReport = integration.validateAll();
      const balReport = balance.validateAll();
      expect(intReport.overallPassed).toBe(true);
      expect(balReport.overallLevel).toBeDefined();
    });

    it('设置重置不影响BalanceValidator状态', () => {
      balance.validateAll();
      const reportBefore = balance.getLastReport();
      settings.resetAll();
      const reportAfter = balance.getLastReport();
      expect(reportAfter).toBe(reportBefore);
    });

    it('BalanceValidator重置恢复默认配置', () => {
      const customConfig = { ...DEFAULT_BATTLE_CONFIG, growthFactor: 2.0 };
      balance.setBattleConfig(customConfig);
      balance.reset();
      expect(balance.getBattleConfig()).toEqual(DEFAULT_BATTLE_CONFIG);
    });
  });

  // ─── §5 存档/云同步/账号管理在统一流程中 ──────────

  describe('§5 存档/云同步/账号管理在统一流程中', () => {
    it('云存档系统初始化后状态为Idle', () => {
      const cloud = new CloudSaveSystem();
      expect(cloud.getState()).toBe(CloudSyncState.Idle);
    });

    it('云存档同步成功后状态变为Success', async () => {
      const cloudStorage = createMockCloudStorage();
      const network = createMockNetworkDetector(true, true);
      const cloud = new CloudSaveSystem({ cloudStorage, networkDetector: network });
      cloud.init(createRealDeps());

      // 先上传一次，使远端有数据
      await cloud.sync('test-data', 'device-1');

      const result = await cloud.sync('updated-data', 'device-1');
      expect(result.state).toBe(CloudSyncState.Success);
    });

    it('网络不可用时同步失败', async () => {
      const cloudStorage = createMockCloudStorage();
      const network = createMockNetworkDetector(false, false);
      const cloud = new CloudSaveSystem({ cloudStorage, networkDetector: network });
      cloud.init(createRealDeps());

      const result = await cloud.sync('test-data', 'device-1');
      expect(result.state).toBe(CloudSyncState.Failed);
      expect(result.message).toContain('网络');
    });

    it('云存档未配置时同步返回失败', async () => {
      const network = createMockNetworkDetector(true, true);
      const cloud = new CloudSaveSystem({ networkDetector: network });
      cloud.init(createRealDeps());

      const result = await cloud.sync('test-data', 'device-1');
      expect(result.state).toBe(CloudSyncState.Failed);
    });

    it('云同步与BalanceValidator可同时运行', async () => {
      const cloudStorage = createMockCloudStorage();
      const network = createMockNetworkDetector(true, true);
      const cloud = new CloudSaveSystem({ cloudStorage, networkDetector: network });
      cloud.init(createRealDeps());

      const syncPromise = cloud.sync('data', 'dev-1');
      const balReport = balance.validateAll();
      const syncResult = await syncPromise;

      expect(balReport.entries.length).toBeGreaterThan(0);
      expect(syncResult.state).toBe(CloudSyncState.Success);
    });

    it('设置数据序列化与恢复后BalanceValidator行为不变', () => {
      const saveData = settings.getSaveData();
      expect(saveData.version).toBeDefined();

      // 恢复设置
      const restored = settings.restoreFromSaveData(saveData);
      expect(restored).toBe(true);

      // BalanceValidator 不受影响
      const report = balance.validateAll();
      expect(report.entries.length).toBeGreaterThan(0);
    });

    it('云存档状态变更回调正确触发', async () => {
      const cloudStorage = createMockCloudStorage();
      const network = createMockNetworkDetector(true, true);
      const cloud = new CloudSaveSystem({ cloudStorage, networkDetector: network });
      cloud.init(createRealDeps());

      const states: CloudSyncState[] = [];
      cloud.onChange((state) => states.push(state));

      await cloud.sync('data', 'dev-1');
      expect(states).toContain(CloudSyncState.Syncing);
      expect(states).toContain(CloudSyncState.Success);
    });

    it('云存档reset后状态回到Idle', async () => {
      const cloudStorage = createMockCloudStorage();
      const network = createMockNetworkDetector(true, true);
      const cloud = new CloudSaveSystem({ cloudStorage, networkDetector: network });
      cloud.init(createRealDeps());

      await cloud.sync('data', 'dev-1');
      cloud.reset();
      expect(cloud.getState()).toBe(CloudSyncState.Idle);
      expect(cloud.getLastSyncResult()).toBeNull();
    });

    it('AccountSystem初始化后name为account', () => {
      const account = new AccountSystem();
      account.init(createRealDeps());
      expect(account.name).toBe('account');
    });

    it('AccountSystem游客绑定后状态变更', () => {
      const account = new AccountSystem();
      account.init(createRealDeps());
      const grantIngot = vi.fn();
      account.initialize(settings.getAccountSettings(), grantIngot);

      const result = account.bind('phone', '138****1234');
      expect(result.success).toBe(true);
    });

    it('转生配置验证与云存档数据可共存', () => {
      const report = balance.validateRebirth();
      expect(report.isBalanced).toBe(true);

      const saveData = settings.getSaveData();
      expect(saveData).toHaveProperty('version');
      expect(saveData).toHaveProperty('settings');

      // 两者互不干扰
      const report2 = balance.validateRebirth();
      expect(report2.isBalanced).toBe(true);
    });

    it('云存档加密解密一致性', () => {
      const cloud = new CloudSaveSystem();
      cloud.init(createRealDeps());
      const original = 'test-save-data-12345';
      const key = 'encryption-key';
      const encrypted = cloud.encrypt(original, key);
      const decrypted = cloud.decrypt(encrypted, key);
      expect(decrypted).toBe(original);
    });

    it('云存档校验和验证正确', () => {
      const cloud = new CloudSaveSystem();
      cloud.init(createRealDeps());
      const data = 'integrity-check-data';
      const checksum = cloud.computeChecksum(data);
      expect(cloud.verifyIntegrity(data, checksum)).toBe(true);
      expect(cloud.verifyIntegrity('tampered', checksum)).toBe(false);
    });

    it('设置onChange取消注册后不再触发', () => {
      const events: unknown[] = [];
      const unsub = settings.onChange((evt) => events.push(evt));
      settings.updateAudioSettings({ masterVolume: 30 });
      expect(events).toHaveLength(1);

      unsub();
      settings.updateAudioSettings({ masterVolume: 70 });
      expect(events).toHaveLength(1); // 不再增加
    });

    it('全量联调+设置+云存档完整链路', async () => {
      // 1. 修改设置
      settings.updateAudioSettings({ masterVolume: 80 });

      // 2. 运行联调验证
      const intReport = integration.validateAll();
      expect(intReport.overallPassed).toBe(true);

      // 3. 云同步
      const cloudStorage = createMockCloudStorage();
      const network = createMockNetworkDetector(true, true);
      const cloud = new CloudSaveSystem({ cloudStorage, networkDetector: network });
      cloud.init(createRealDeps());

      const localData = JSON.stringify(settings.getSaveData());
      const syncResult = await cloud.sync(localData, 'device-1');
      expect(syncResult.state).toBe(CloudSyncState.Success);

      // 4. 验证设置未变
      expect(settings.getAudioSettings().masterVolume).toBe(80);
    });
  });
});
