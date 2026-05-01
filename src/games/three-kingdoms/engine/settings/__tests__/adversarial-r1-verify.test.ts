/**
 * Settings R1 对抗测试 — 修复验证
 *
 * 验证所有 FIX 修复是否正确工作
 */
import { describe, test, expect, vi } from 'vitest';

import { SettingsManager } from '../SettingsManager';
import type { ISettingsStorage } from '../SettingsManager';
import { createDefaultAllSettings, BindMethod, createDefaultAccountSettings } from '../../../core/settings';
import type { AllSettings } from '../../../core/settings';

import { encryptData, decryptData } from '../CloudSaveCrypto';

import { AccountSystem } from '../AccountSystem';

import { SaveSlotManager } from '../SaveSlotManager';
import type { ISaveSlotStorage } from '../save-slot.types';

import { CloudSaveSystem, CloudSyncState } from '../CloudSaveSystem';
import type { INetworkDetector, ICloudStorage, NowFn } from '../cloud-save.types';

import { AudioManager } from '../AudioManager';
import { AudioChannel } from '../../../core/settings';
import type { AudioSettings } from '../../../core/settings';

import { GraphicsManager } from '../GraphicsManager';
import { GraphicsPreset } from '../../../core/settings';

import { AnimationController } from '../AnimationController';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function createMockStorage(): ISettingsStorage & { store: Record<string, string> } {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
  };
}

function createSlotStorage(): ISaveSlotStorage & { store: Record<string, string> } {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
  };
}

let mockNow = 1000000;
const mockNowFn = () => mockNow;

// ═══════════════════════════════════════════════
// P0 修复验证
// ═══════════════════════════════════════════════

describe('Settings R1 — P0 修复验证', () => {

  describe('FIX-001: restoreFromSaveData 数据注入防护', () => {
    test('Infinity lastModifiedAt 被修正为 Date.now()', () => {
      const storage = createMockStorage();
      const mgr = new SettingsManager(storage);
      mgr.initialize();

      const defaults = createDefaultAllSettings();
      const result = mgr.restoreFromSaveData({
        version: '19.0.0',
        settings: { ...defaults, lastModifiedAt: Infinity },
      });
      expect(result).toBe(true);
      expect(Number.isFinite(mgr.getAllSettings().lastModifiedAt)).toBe(true);
    });

    test('NaN lastModifiedAt 被修正', () => {
      const storage = createMockStorage();
      const mgr = new SettingsManager(storage);
      mgr.initialize();

      const defaults = createDefaultAllSettings();
      mgr.restoreFromSaveData({
        version: '19.0.0',
        settings: { ...defaults, lastModifiedAt: NaN },
      });
      expect(Number.isFinite(mgr.getAllSettings().lastModifiedAt)).toBe(true);
    });

    test('非法音量值 999 被 clamp 到 100', () => {
      const storage = createMockStorage();
      const mgr = new SettingsManager(storage);
      mgr.initialize();

      const defaults = createDefaultAllSettings();
      mgr.restoreFromSaveData({
        version: '19.0.0',
        settings: {
          ...defaults,
          audio: { ...defaults.audio, masterVolume: 999 },
        },
      });
      expect(mgr.getAudioSettings().masterVolume).toBe(100);
    });

    test('修复后 mergeRemoteSettings 正常工作', () => {
      const storage = createMockStorage();
      const mgr = new SettingsManager(storage);
      mgr.initialize();

      const defaults = createDefaultAllSettings();
      // restoreFromSaveData 会把 Infinity 修正为 Date.now()
      mgr.restoreFromSaveData({
        version: '19.0.0',
        settings: { ...defaults, lastModifiedAt: Infinity },
      });

      // 使用远大于当前时间的时间戳确保远程更新
      const futureTimestamp = Date.now() + 100000;
      const remote: AllSettings = {
        ...defaults,
        audio: { ...defaults.audio, masterVolume: 99 },
        lastModifiedAt: futureTimestamp,
      };
      mgr.mergeRemoteSettings(remote, futureTimestamp);
      expect(mgr.getAudioSettings().masterVolume).toBe(99);
    });
  });

  describe('FIX-002: CloudSaveCrypto 空密钥防护', () => {
    test('空密钥加密抛出异常', () => {
      expect(() => encryptData('data', '')).toThrow('加密密钥不能为空');
    });

    test('空密钥解密抛出异常', () => {
      expect(() => decryptData('encrypted', '')).toThrow('解密密钥不能为空');
    });

    test('正常密钥加密解密正确', () => {
      const original = 'sensitive-game-data';
      const encrypted = encryptData(original, 'valid-key-123');
      const decrypted = decryptData(encrypted, 'valid-key-123');
      expect(decrypted).toBe(original);
      expect(encrypted).not.toBe(original);
    });
  });

  describe('FIX-003: AccountSystem.bind identifier 校验', () => {
    test('bind(null) 失败', () => {
      const account = new AccountSystem({ nowFn: mockNowFn });
      account.initialize(createDefaultAccountSettings());
      const result = account.bind(BindMethod.Phone, null as unknown as string);
      expect(result.success).toBe(false);
      expect(result.message).toContain('不能为空');
    });

    test('bind("") 失败', () => {
      const account = new AccountSystem({ nowFn: mockNowFn });
      account.initialize(createDefaultAccountSettings());
      const result = account.bind(BindMethod.Phone, '');
      expect(result.success).toBe(false);
    });

    test('bind(undefined) 失败', () => {
      const account = new AccountSystem({ nowFn: mockNowFn });
      account.initialize(createDefaultAccountSettings());
      const result = account.bind(BindMethod.Phone, undefined as unknown as string);
      expect(result.success).toBe(false);
    });

    test('bind(有效值) 成功', () => {
      const account = new AccountSystem({ nowFn: mockNowFn });
      account.initialize(createDefaultAccountSettings());
      const result = account.bind(BindMethod.Phone, '138****1234');
      expect(result.success).toBe(true);
      expect(account.getBindings()[0].identifier).toBe('138****1234');
    });
  });

  describe('FIX-004: SaveSlotManager.importSaves 两阶段导入', () => {
    test('部分无效数据全部拒绝，原数据保留', () => {
      const storage = createSlotStorage();
      const mgr = new SaveSlotManager(storage);

      mgr.saveToSlot(0, 'original-data', 'Original');
      expect(mgr.getSlot(0)?.data?.name).toBe('Original');

      const validBase64 = btoa(unescape(encodeURIComponent('imported-data')));
      const result = mgr.importSaves({
        version: '1.0',
        exportedAt: Date.now(),
        slots: { '0': validBase64, '1': '!!!invalid-base64!!!' },
      });

      expect(result.success).toBe(false);
      expect(mgr.getSlot(0)?.data?.name).toBe('Original');
    });

    test('全部有效数据成功导入', () => {
      const storage = createSlotStorage();
      const mgr = new SaveSlotManager(storage);

      const testData = 'test-game-state';
      const encoded = btoa(unescape(encodeURIComponent(testData)));
      const result = mgr.importSaves({
        version: '1.0',
        exportedAt: Date.now(),
        slots: { '0': encoded },
      });

      expect(result.success).toBe(true);
      expect(mgr.loadFromSlot(0)).toBe(testData);
    });
  });

  describe('FIX-005: CloudSaveSystem.sync 并发锁', () => {
    test('并发 sync 第二个被拒绝', async () => {
      let resolveDownload: () => void;
      const downloadPromise = new Promise<void>(r => { resolveDownload = r; });
      const mockStorageImpl: ICloudStorage = {
        upload: async () => true,
        download: async () => {
          await downloadPromise;
          return null;
        },
        getMetadata: async () => null,
        delete: async () => true,
      };

      const network: INetworkDetector = { isOnline: () => true, isWifi: () => true };
      const sys = new CloudSaveSystem({ cloudStorage: mockStorageImpl, networkDetector: network, nowFn: mockNowFn });
      sys.configure(createDefaultAccountSettings());

      // 发起第一个 sync（会挂起等待 download）
      const p1 = sys.sync('data-1', 'dev-1');
      // 发起第二个 sync（应立即被拒绝）
      const r2 = await sys.sync('data-2', 'dev-2');
      expect(r2.state).toBe(CloudSyncState.Failed);
      expect(r2.message).toContain('正在进行中');

      // 释放第一个 sync
      resolveDownload!();
      const r1 = await p1;
      expect(r1.state).toBe(CloudSyncState.Success);
    }, 10000);
  });
});

// ═══════════════════════════════════════════════
// P1 修复验证
// ═══════════════════════════════════════════════

describe('Settings R1 — P1 修复验证', () => {

  describe('FIX-006: AudioManager NaN 音量防护', () => {
    test('NaN masterVolume 返回 0 而非 NaN', () => {
      const audio = new AudioManager();
      const settings: AudioSettings = {
        masterVolume: NaN, bgmVolume: 60, sfxVolume: 70, voiceVolume: 80,
        masterSwitch: true, bgmSwitch: true, voiceSwitch: true, battleSfxSwitch: true,
      };
      audio.applySettings(settings);
      const vol = audio.getEffectiveVolume(AudioChannel.BGM);
      expect(vol).toBe(0);
      expect(Number.isNaN(vol)).toBe(false);
    });

    test('NaN channelVolume 返回 0', () => {
      const audio = new AudioManager();
      const settings: AudioSettings = {
        masterVolume: 80, bgmVolume: NaN, sfxVolume: 70, voiceVolume: 80,
        masterSwitch: true, bgmSwitch: true, voiceSwitch: true, battleSfxSwitch: true,
      };
      audio.applySettings(settings);
      const vol = audio.getEffectiveVolume(AudioChannel.BGM);
      expect(vol).toBe(0);
      expect(Number.isNaN(vol)).toBe(false);
    });
  });

  describe('FIX-007: GraphicsManager.detectBestPreset NaN/Infinity 防护', () => {
    test('Infinity cpuCores 降级为 0 选择 Low', () => {
      const gfx = new GraphicsManager();
      expect(gfx.detectBestPreset({ cpuCores: Infinity, memoryGB: Infinity })).toBe(GraphicsPreset.Low);
    });

    test('NaN cpuCores 选择 Low', () => {
      const gfx = new GraphicsManager();
      expect(gfx.detectBestPreset({ cpuCores: NaN, memoryGB: NaN })).toBe(GraphicsPreset.Low);
    });

    test('正常 capability 选择正确', () => {
      const gfx = new GraphicsManager();
      expect(gfx.detectBestPreset({ cpuCores: 8, memoryGB: 8 })).toBe(GraphicsPreset.High);
      expect(gfx.detectBestPreset({ cpuCores: 4, memoryGB: 4 })).toBe(GraphicsPreset.Medium);
      expect(gfx.detectBestPreset({ cpuCores: 2, memoryGB: 2 })).toBe(GraphicsPreset.Low);
    });
  });

  describe('FIX-008: SaveSlotManager.saveToSlot null gameData 防护', () => {
    test('null gameData 被拒绝', () => {
      const storage = createSlotStorage();
      const mgr = new SaveSlotManager(storage);
      const result = mgr.saveToSlot(0, null as unknown as string, 'Test');
      expect(result.success).toBe(false);
      expect(result.message).toContain('无效');
    });

    test('undefined gameData 被拒绝', () => {
      const storage = createSlotStorage();
      const mgr = new SaveSlotManager(storage);
      const result = mgr.saveToSlot(0, undefined as unknown as string, 'Test');
      expect(result.success).toBe(false);
    });
  });

  describe('P1-4: AnimationController settings=null（设计选择）', () => {
    test('未 applySettings 时 isEnabled 返回 true', () => {
      const ctrl = new AnimationController();
      expect(ctrl.isEnabled()).toBe(true);
    });

    test('applySettings({ enabled: false }) 后 isEnabled 返回 false', () => {
      const ctrl = new AnimationController();
      ctrl.applySettings({
        enabled: false, transitions: {}, stateAnimations: {}, feedbackAnimations: {},
      });
      expect(ctrl.isEnabled()).toBe(false);
    });
  });

  describe('FIX-009: isGuestExpired NaN createdAt 防护', () => {
    test('NaN createdAt 视为过期', () => {
      const account = new AccountSystem({ nowFn: () => Date.now() });
      account.initialize(createDefaultAccountSettings());
      expect(account.isGuestExpired(NaN)).toBe(true);
    });

    test('正常 createdAt 过期检测', () => {
      const now = Date.now();
      const account = new AccountSystem({ nowFn: () => now });
      account.initialize(createDefaultAccountSettings());
      expect(account.isGuestExpired(now - 31 * 24 * 60 * 60 * 1000)).toBe(true);
      expect(account.isGuestExpired(now - 10 * 24 * 60 * 60 * 1000)).toBe(false);
    });
  });

  describe('P1-7: mergeRemoteSettings 相等时间戳（设计选择）', () => {
    test('相等时间戳时保留本地', () => {
      const storage = createMockStorage();
      const mgr = new SettingsManager(storage);
      mgr.initialize();
      mgr.updateAudioSettings({ masterVolume: 50 });

      const ts = mgr.getAllSettings().lastModifiedAt;
      const defaults = createDefaultAllSettings();
      const remote: AllSettings = {
        ...defaults,
        audio: { ...defaults.audio, masterVolume: 99 },
        lastModifiedAt: ts,
      };
      mgr.mergeRemoteSettings(remote, ts);
      expect(mgr.getAudioSettings().masterVolume).toBe(50);
    });
  });
});
