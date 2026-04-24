/**
 * 集成测试 — §10.5 存档→云同步→设置
 *
 * 验证：多存档槽位、云同步冲突解决、设置持久化
 *
 * @module engine/heritage/__tests__/integration/save-cloud-settings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveSlotManager } from '../../../settings/SaveSlotManager';
import { CloudSaveSystem } from '../../../settings/CloudSaveSystem';
import { CloudSyncState } from '../../../settings/cloud-save.types';
import { AccountSystem } from '../../../settings/AccountSystem';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type { AccountSettings, BindMethod } from '../../../../core/settings';
import { ConflictStrategy } from '../../../../core/settings';
import type { ISaveSlotStorage } from '../../../settings/save-slot.types';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function createMockDeps() {
  return {
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn() },
    registry: { get: vi.fn() },
  } as unknown as ISystemDeps;
}

/** 内存存储实现 */
function createMemoryStorage(): ISaveSlotStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };
}

/** Mock 云存储 */
function createMockCloudStorage() {
  let remoteData: string | null = null;
  let remoteMetadata = { lastSyncedAt: 0 };
  return {
    upload: vi.fn(async (data: string) => {
      remoteData = data;
      remoteMetadata = { lastSyncedAt: Date.now() };
    }),
    download: vi.fn(async () => {
      if (!remoteData) return null;
      return { data: remoteData, metadata: remoteMetadata };
    }),
    getRemoteData: () => remoteData,
    setRemoteData: (data: string, ts: number) => {
      remoteData = data;
      remoteMetadata = { lastSyncedAt: ts };
    },
  };
}

/** Mock 网络检测器 */
function createMockNetworkDetector(online = true, wifi = true) {
  return {
    isOnline: vi.fn(() => online),
    isWifi: vi.fn(() => wifi),
  };
}

/** 创建默认账号设置 */
function createAccountSettings(): AccountSettings {
  return {
    isGuest: true,
    bindings: [],
    firstBindRewardClaimed: false,
    wifiOnlySync: false,
    conflictStrategy: ConflictStrategy.LatestWins,
    deviceId: 'test-device',
  } as AccountSettings;
}

/** 创建完整环境 */
function createEnv() {
  const deps = createMockDeps();
  const storage = createMemoryStorage();
  const cloudStorage = createMockCloudStorage();
  const networkDetector = createMockNetworkDetector();

  const saveSlot = new SaveSlotManager(storage);
  saveSlot.init(deps);

  const cloudSave = new CloudSaveSystem({
    cloudStorage: cloudStorage as any,
    networkDetector: networkDetector as any,
    nowFn: () => Date.now(),
  });
  cloudSave.init(deps);

  const account = new AccountSystem();
  account.init(deps);
  account.initialize(createAccountSettings());

  return {
    saveSlot, cloudSave, account, deps,
    storage, cloudStorage, networkDetector,
  };
}

// ═══════════════════════════════════════════════
// §10.5 存档→云同步→设置
// ═══════════════════════════════════════════════

describe('§10.5 存档→云同步→设置', () => {

  // ─── §10.5.1 多存档槽位管理 ───

  describe('§10.5.1 多存档槽位管理', () => {
    let env: ReturnType<typeof createEnv>;

    beforeEach(() => { env = createEnv(); });

    it('§10.5.1.1 初始有3个免费槽位', () => {
      const slots = env.saveSlot.getSlots();
      const freeSlots = slots.filter(s => !s.isPaid);
      expect(freeSlots.length).toBe(3);
    });

    it('§10.5.1.2 保存到指定槽位成功', () => {
      const result = env.saveSlot.saveToSlot(0, '{"level":10}', '第一章');
      expect(result.success).toBe(true);
    });

    it('§10.5.1.3 从指定槽位加载成功', () => {
      env.saveSlot.saveToSlot(0, '{"level":10}', '第一章');
      const data = env.saveSlot.loadFromSlot(0);
      expect(data).toBe('{"level":10}');
    });

    it('§10.5.1.4 空槽位加载返回null', () => {
      const data = env.saveSlot.loadFromSlot(1);
      expect(data).toBeNull();
    });

    it('§10.5.1.5 删除槽位存档成功', () => {
      env.saveSlot.saveToSlot(0, '{"level":10}', '第一章');
      const result = env.saveSlot.deleteSlot(0);
      expect(result.success).toBe(true);
      expect(env.saveSlot.loadFromSlot(0)).toBeNull();
    });

    it('§10.5.1.6 删除空槽位返回失败', () => {
      const result = env.saveSlot.deleteSlot(1);
      expect(result.success).toBe(false);
      expect(result.message).toContain('空');
    });

    it('§10.5.1.7 无效索引保存返回失败', () => {
      const result = env.saveSlot.saveToSlot(-1, '{}', 'test');
      expect(result.success).toBe(false);
    });

    it('§10.5.1.8 覆盖已有存档成功', () => {
      env.saveSlot.saveToSlot(0, '{"v":1}', '旧存档');
      env.saveSlot.saveToSlot(0, '{"v":2}', '新存档');
      const data = env.saveSlot.loadFromSlot(0);
      expect(data).toBe('{"v":2}');
    });

    it('§10.5.1.9 已使用槽位数量统计正确', () => {
      env.saveSlot.saveToSlot(0, '{}', 'a');
      env.saveSlot.saveToSlot(1, '{}', 'b');
      expect(env.saveSlot.getUsedSlotCount()).toBe(2);
    });

    it('§10.5.1.10 槽位为空判断正确', () => {
      expect(env.saveSlot.isSlotEmpty(0)).toBe(true);
      env.saveSlot.saveToSlot(0, '{}', 'test');
      expect(env.saveSlot.isSlotEmpty(0)).toBe(false);
    });
  });

  // ─── §10.5.2 付费槽位 ───

  describe('§10.5.2 付费槽位', () => {
    let env: ReturnType<typeof createEnv>;

    beforeEach(() => { env = createEnv(); });

    it('§10.5.2.1 购买付费槽位成功', () => {
      const spendFn = vi.fn(() => true);
      const result = env.saveSlot.purchasePaidSlot(spendFn);
      expect(result.success).toBe(true);
      expect(env.saveSlot.isPaidSlotPurchased()).toBe(true);
    });

    it('§10.5.2.2 元宝不足购买失败', () => {
      const spendFn = vi.fn(() => false);
      const result = env.saveSlot.purchasePaidSlot(spendFn);
      expect(result.success).toBe(false);
      expect(result.message).toContain('元宝');
    });

    it('§10.5.2.3 重复购买返回失败', () => {
      env.saveSlot.purchasePaidSlot(() => true);
      const result = env.saveSlot.purchasePaidSlot(() => true);
      expect(result.success).toBe(false);
    });

    it('§10.5.2.4 购买后付费槽位可用', () => {
      env.saveSlot.purchasePaidSlot(() => true);
      // 付费槽位（索引3）应可用
      expect(env.saveSlot.isSlotAvailable(3)).toBe(true);
    });
  });

  // ─── §10.5.3 导入导出 ───

  describe('§10.5.3 导入导出', () => {
    let env: ReturnType<typeof createEnv>;

    beforeEach(() => { env = createEnv(); });

    it('§10.5.3.1 导出所有存档', () => {
      env.saveSlot.saveToSlot(0, '{"a":1}', 'slot0');
      env.saveSlot.saveToSlot(1, '{"b":2}', 'slot1');
      const exported = env.saveSlot.exportSaves();
      expect(exported.version).toBeDefined();
      expect(Object.keys(exported.slots).length).toBe(2);
    });

    it('§10.5.3.2 导入存档成功', () => {
      env.saveSlot.saveToSlot(0, '{"test":true}', 'original');
      const exported = env.saveSlot.exportSaves();

      // 新管理器导入
      const newMgr = new SaveSlotManager(createMemoryStorage());
      newMgr.init(env.deps);
      const result = newMgr.importSaves(exported);
      expect(result.success).toBe(true);
    });

    it('§10.5.3.3 导入无效数据返回失败', () => {
      const result = env.saveSlot.importSaves(null as any);
      expect(result.success).toBe(false);
    });

    it('§10.5.3.4 空存档导出无数据', () => {
      const exported = env.saveSlot.exportSaves();
      expect(Object.keys(exported.slots).length).toBe(0);
    });
  });

  // ─── §10.5.4 云同步冲突解决 ───

  describe('§10.5.4 云同步冲突解决', () => {
    let env: ReturnType<typeof createEnv>;

    beforeEach(() => { env = createEnv(); });

    it('§10.5.4.1 LatestWins策略选择较新数据', () => {
      const result = env.saveSlot.resolveConflict(
        ConflictStrategy.LatestWins,
        1000, 2000,
        'local', 'remote',
      );
      expect(result).toBe('remote');
    });

    it('§10.5.4.2 LatestWins策略本地较新时选择本地', () => {
      const result = env.saveSlot.resolveConflict(
        ConflictStrategy.LatestWins,
        3000, 2000,
        'local', 'remote',
      );
      expect(result).toBe('local');
    });

    it('§10.5.4.3 CloudWins策略始终选择云端', () => {
      const result = env.saveSlot.resolveConflict(
        ConflictStrategy.CloudWins,
        3000, 2000,
        'local', 'remote',
      );
      expect(result).toBe('remote');
    });

    it('§10.5.4.4 AlwaysAsk策略返回本地（等待用户选择）', () => {
      const result = env.saveSlot.resolveConflict(
        ConflictStrategy.AlwaysAsk,
        1000, 2000,
        'local', 'remote',
      );
      expect(result).toBe('local');
    });

    it('§10.5.4.5 云同步成功时状态更新', async () => {
      env.cloudSave.configure({
        ...createAccountSettings(),
        wifiOnlySync: false,
        conflictStrategy: ConflictStrategy.LatestWins,
      });
      const result = await env.cloudSave.sync('local-data', 'device1', Date.now());
      expect(result.state).toBe(CloudSyncState.Success);
    });

    it('§10.5.4.6 无网络时同步失败', async () => {
      env.networkDetector.isOnline.mockReturnValue(false);
      env.cloudSave.configure(createAccountSettings());
      const result = await env.cloudSave.sync('local-data', 'device1');
      expect(result.state).toBe(CloudSyncState.Failed);
      expect(result.message).toContain('网络');
    });

    it('§10.5.4.7 WiFi限制下非WiFi同步失败', async () => {
      env.networkDetector.isWifi.mockReturnValue(false);
      env.cloudSave.configure({
        ...createAccountSettings(),
        wifiOnlySync: true,
      });
      const result = await env.cloudSave.sync('local-data', 'device1');
      expect(result.state).toBe(CloudSyncState.Failed);
      expect(result.message).toContain('WiFi');
    });

    it('§10.5.4.8 云端较新时触发冲突检测', async () => {
      const localTs = 1000;
      env.cloudStorage.setRemoteData('remote-data', 2000);
      env.cloudSave.configure({
        ...createAccountSettings(),
        conflictStrategy: ConflictStrategy.AlwaysAsk,
      });
      const result = await env.cloudSave.sync('local-data', 'device1', localTs);
      expect(result.state).toBe(CloudSyncState.Conflict);
    });
  });

  // ─── §10.5.5 设置持久化 ───

  describe('§10.5.5 设置持久化', () => {
    let env: ReturnType<typeof createEnv>;

    beforeEach(() => { env = createEnv(); });

    it('§10.5.5.1 账号初始化后设置可读取', () => {
      const settings = env.account.getSettings();
      expect(settings).toBeDefined();
      expect(settings!.isGuest).toBe(true);
    });

    it('§10.5.5.2 绑定账号后isGuest变为false', () => {
      env.account.bind('phone' as BindMethod, '13800138000');
      const settings = env.account.getSettings();
      expect(settings!.isGuest).toBe(false);
    });

    it('§10.5.5.3 首次绑定获得元宝奖励', () => {
      const grantFn = vi.fn();
      env.account.setGrantIngotFn(grantFn);
      env.account.bind('phone' as BindMethod, '13800138000');
      expect(grantFn).toHaveBeenCalled();
    });

    it('§10.5.5.4 重复绑定同方式失败', () => {
      env.account.bind('phone' as BindMethod, '13800138000');
      const result = env.account.bind('phone' as BindMethod, '13900139000');
      expect(result.success).toBe(false);
      expect(result.message).toContain('已绑定');
    });

    it('§10.5.5.5 检查绑定方式', () => {
      env.account.bind('phone' as BindMethod, '13800138000');
      expect(env.account.hasBinding('phone' as BindMethod)).toBe(true);
      expect(env.account.hasBinding('wechat' as BindMethod)).toBe(false);
    });

    it('§10.5.5.6 解绑最后一个方式失败', () => {
      env.account.bind('phone' as BindMethod, '13800138000');
      const result = env.account.unbind('phone' as BindMethod);
      expect(result.success).toBe(false);
      expect(result.message).toContain('至少保留');
    });

    it('§10.5.5.7 多绑定方式可解绑', () => {
      env.account.bind('phone' as BindMethod, '13800138000');
      env.account.bind('wechat' as BindMethod, 'wx123');
      const result = env.account.unbind('phone' as BindMethod);
      expect(result.success).toBe(true);
      expect(env.account.hasBinding('wechat' as BindMethod)).toBe(true);
    });

    it('§10.5.5.8 获取所有绑定信息', () => {
      env.account.bind('phone' as BindMethod, '13800138000');
      env.account.bind('wechat' as BindMethod, 'wx123');
      const bindings = env.account.getBindings();
      expect(bindings.length).toBe(2);
    });
  });

  // ─── §10.5.6 自动存档与事件 ───

  describe('§10.5.6 自动存档与事件', () => {
    let env: ReturnType<typeof createEnv>;

    beforeEach(() => { env = createEnv(); });

    it('§10.5.6.1 注册槽位变更回调', () => {
      const callback = vi.fn();
      const unsub = env.saveSlot.onChange(callback);
      env.saveSlot.saveToSlot(0, '{}', 'test');
      expect(callback).toHaveBeenCalledWith(0, 'save');
      unsub();
    });

    it('§10.5.6.2 取消注册后不再触发', () => {
      const callback = vi.fn();
      const unsub = env.saveSlot.onChange(callback);
      unsub();
      env.saveSlot.saveToSlot(0, '{}', 'test');
      expect(callback).not.toHaveBeenCalled();
    });

    it('§10.5.6.3 加载触发load事件', () => {
      const callback = vi.fn();
      env.saveSlot.onChange(callback);
      env.saveSlot.saveToSlot(0, '{}', 'test');
      env.saveSlot.loadFromSlot(0);
      expect(callback).toHaveBeenCalledWith(0, 'load');
    });

    it('§10.5.6.4 删除触发delete事件', () => {
      const callback = vi.fn();
      env.saveSlot.onChange(callback);
      env.saveSlot.saveToSlot(0, '{}', 'test');
      env.saveSlot.deleteSlot(0);
      expect(callback).toHaveBeenCalledWith(0, 'delete');
    });

    it('§10.5.6.5 reset清除所有状态', () => {
      env.saveSlot.saveToSlot(0, '{}', 'test');
      env.saveSlot.reset();
      expect(env.saveSlot.getUsedSlotCount()).toBe(0);
      expect(env.saveSlot.isPaidSlotPurchased()).toBe(false);
    });
  });
});
