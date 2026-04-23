/**
 * SettingsManager 单元测试
 *
 * 覆盖：
 * 1. 初始化（默认值/从存储加载）
 * 2. 读取设置（各分类）
 * 3. 更新设置（部分更新/音量clamp）
 * 4. 持久化（保存/加载）
 * 5. 恢复默认（单分类/全部）
 * 6. 变更通知
 * 7. 音量计算
 * 8. 云端冲突解决
 */

import { SettingsManager } from '../SettingsManager';
import type { ISettingsStorage } from '../SettingsManager';
import {
  SettingsCategory,
  Language,
  NotificationType,
  AudioChannel,
  GraphicsPreset,
  CloudSyncFrequency,
  ConflictStrategy,
  EasingType,
  TransitionType,
  StateAnimationType,
  FeedbackAnimationType,
  SETTINGS_STORAGE_KEY,
  VOLUME_MIN,
  VOLUME_MAX,
} from '../../../core/settings';
import type { AllSettings, SettingsSaveData } from '../../../core/settings';

// ─────────────────────────────────────────────
// Mock 存储
// ─────────────────────────────────────────────

function createMockStorage(): ISettingsStorage & { store: Record<string, string> } {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, val: string) => { store[key] = val; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
  };
}

/** 创建 SettingsManager 实例 */
function createManager(storage?: ISettingsStorage): SettingsManager {
  const mgr = new SettingsManager(storage ?? createMockStorage());
  mgr.initialize();
  return mgr;
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('SettingsManager', () => {
  let storage: ReturnType<typeof createMockStorage>;
  let manager: SettingsManager;

  beforeEach(() => {
    storage = createMockStorage();
    manager = createManager(storage);
  });

  // ── 初始化 ──────────────────────────────

  describe('初始化', () => {
    test('默认初始化应设置所有默认值', () => {
      const settings = manager.getAllSettings();
      expect(settings.basic.language).toBe(Language.SimplifiedChinese);
      expect(settings.audio.masterVolume).toBe(80);
      expect(settings.graphics.preset).toBe(GraphicsPreset.Auto);
      expect(settings.animation.enabled).toBe(true);
    });

    test('重复初始化不会重置设置', () => {
      manager.updateAudioSettings({ masterVolume: 30 });
      manager.initialize(); // 重复调用
      expect(manager.getAudioSettings().masterVolume).toBe(30);
    });

    test('从存储加载已有设置', () => {
      const savedData: SettingsSaveData = {
        version: '19.0.0',
        settings: {
          ...manager.getAllSettings(),
          audio: { ...manager.getAudioSettings(), masterVolume: 42 },
        },
      };
      storage.store[SETTINGS_STORAGE_KEY] = JSON.stringify(savedData);

      const mgr2 = new SettingsManager(storage);
      mgr2.initialize();
      expect(mgr2.getAudioSettings().masterVolume).toBe(42);
    });

    test('存储数据损坏时使用默认值', () => {
      storage.store[SETTINGS_STORAGE_KEY] = 'invalid json{{{';
      const mgr2 = new SettingsManager(storage);
      mgr2.initialize();
      expect(mgr2.getAudioSettings().masterVolume).toBe(80);
    });
  });

  // ── 读取设置 ────────────────────────────

  describe('读取设置', () => {
    test('getBasicSettings 返回正确的默认值', () => {
      const basic = manager.getBasicSettings();
      expect(basic.language).toBe(Language.SimplifiedChinese);
      expect(basic.languageFollowSystem).toBe(true);
      expect(basic.timezone).toBe(8);
      expect(basic.timezoneFollowDevice).toBe(true);
      expect(basic.notificationEnabled).toBe(true);
      expect(basic.notificationFlags[NotificationType.BuildingComplete]).toBe(true);
    });

    test('getAudioSettings 返回正确的默认值', () => {
      const audio = manager.getAudioSettings();
      expect(audio.masterVolume).toBe(80);
      expect(audio.bgmVolume).toBe(60);
      expect(audio.sfxVolume).toBe(70);
      expect(audio.voiceVolume).toBe(80);
      expect(audio.masterSwitch).toBe(true);
      expect(audio.bgmSwitch).toBe(true);
      expect(audio.voiceSwitch).toBe(true);
      expect(audio.battleSfxSwitch).toBe(true);
    });

    test('getGraphicsSettings 返回正确的默认值', () => {
      const gfx = manager.getGraphicsSettings();
      expect(gfx.preset).toBe(GraphicsPreset.Auto);
      expect(gfx.advanced.particleEffects).toBe(true);
      expect(gfx.advanced.inkWash).toBe(true);
    });

    test('getAccountSettings 返回正确的默认值', () => {
      const account = manager.getAccountSettings();
      expect(account.isGuest).toBe(true);
      expect(account.bindings).toEqual([]);
      expect(account.cloudSyncFrequency).toBe(CloudSyncFrequency.OnExit);
      expect(account.conflictStrategy).toBe(ConflictStrategy.AlwaysAsk);
      expect(account.saveSlots).toHaveLength(4); // 3 free + 1 paid
    });

    test('getAnimationSettings 返回正确的默认值', () => {
      const anim = manager.getAnimationSettings();
      expect(anim.enabled).toBe(true);
      expect(anim.transitions[TransitionType.PanelOpen].duration).toBe(300);
      expect(anim.transitions[TransitionType.PanelOpen].easing).toBe(EasingType.EaseOut);
      expect(anim.stateAnimations[StateAnimationType.ButtonHover].duration).toBe(150);
      expect(anim.feedbackAnimations[FeedbackAnimationType.ResourceFloat].duration).toBe(800);
    });
  });

  // ── 更新设置 ────────────────────────────

  describe('更新设置', () => {
    test('updateBasicSettings 部分更新', () => {
      manager.updateBasicSettings({ language: Language.English });
      expect(manager.getBasicSettings().language).toBe(Language.English);
      expect(manager.getBasicSettings().timezone).toBe(8); // 未变
    });

    test('updateAudioSettings 部分更新', () => {
      manager.updateAudioSettings({ masterVolume: 50 });
      expect(manager.getAudioSettings().masterVolume).toBe(50);
      expect(manager.getAudioSettings().bgmVolume).toBe(60); // 未变
    });

    test('updateAudioSettings 音量 clamp 到 [0, 100]', () => {
      manager.updateAudioSettings({ masterVolume: 150 });
      expect(manager.getAudioSettings().masterVolume).toBe(VOLUME_MAX);

      manager.updateAudioSettings({ bgmVolume: -10 });
      expect(manager.getAudioSettings().bgmVolume).toBe(VOLUME_MIN);
    });

    test('updateGraphicsSettings 部分更新', () => {
      manager.updateGraphicsSettings({ preset: GraphicsPreset.High });
      expect(manager.getGraphicsSettings().preset).toBe(GraphicsPreset.High);
    });

    test('updateGraphicsSettings 高级选项部分更新', () => {
      manager.updateGraphicsSettings({
        advanced: { particleEffects: false },
      });
      expect(manager.getGraphicsSettings().advanced.particleEffects).toBe(false);
      // 其他高级选项保持不变
      expect(manager.getGraphicsSettings().advanced.inkWash).toBe(true);
    });

    test('updateAccountSettings 部分更新', () => {
      manager.updateAccountSettings({ isGuest: false });
      expect(manager.getAccountSettings().isGuest).toBe(false);
    });

    test('updateAnimationSettings 部分更新', () => {
      manager.updateAnimationSettings({ enabled: false });
      expect(manager.getAnimationSettings().enabled).toBe(false);
    });

    test('更新设置后立即持久化', () => {
      manager.updateBasicSettings({ language: Language.Japanese });
      expect(storage.setItem).toHaveBeenCalled();
      const saved = JSON.parse(storage.store[SETTINGS_STORAGE_KEY]);
      expect(saved.settings.basic.language).toBe(Language.Japanese);
    });

    test('更新设置后 lastModifiedAt 更新', () => {
      const before = manager.getAllSettings().lastModifiedAt;
      // 稍微等待确保时间戳不同
      manager.updateBasicSettings({ timezone: 9 });
      expect(manager.getAllSettings().lastModifiedAt).toBeGreaterThanOrEqual(before);
    });
  });

  // ── 音量计算 ────────────────────────────

  describe('音量计算', () => {
    test('实际输出 = 分类音量 × 主音量 / 10000', () => {
      manager.updateAudioSettings({ masterVolume: 80, bgmVolume: 60 });
      const effective = manager.calculateEffectiveVolume(60);
      expect(effective).toBeCloseTo(0.48, 2); // 60/100 * 80/100
    });

    test('总开关关闭时实际音量为 0', () => {
      manager.updateAudioSettings({ masterSwitch: false });
      expect(manager.calculateEffectiveVolume(60)).toBe(0);
    });

    test('音量为 0 时实际输出为 0', () => {
      manager.updateAudioSettings({ masterVolume: 0 });
      expect(manager.calculateEffectiveVolume(60)).toBe(0);
    });

    test('音量 100% 时实际输出 = 分类音量 / 100', () => {
      manager.updateAudioSettings({ masterVolume: 100 });
      expect(manager.calculateEffectiveVolume(80)).toBeCloseTo(0.8, 2);
    });

    test('adjustVolume 按步进调整', () => {
      manager.updateAudioSettings({ masterVolume: 50 });
      manager.adjustVolume('masterVolume', 1); // +5
      expect(manager.getAudioSettings().masterVolume).toBe(55);
      manager.adjustVolume('masterVolume', -1); // -5
      expect(manager.getAudioSettings().masterVolume).toBe(50);
    });

    test('adjustVolume 不超出范围', () => {
      manager.updateAudioSettings({ masterVolume: 98 });
      manager.adjustVolume('masterVolume', 1); // 98 + 5 = 103 → 100
      expect(manager.getAudioSettings().masterVolume).toBe(100);
    });
  });

  // ── 恢复默认 ────────────────────────────

  describe('恢复默认', () => {
    test('resetCategory 恢复指定分类', () => {
      manager.updateAudioSettings({ masterVolume: 30, bgmVolume: 10 });
      manager.resetCategory(SettingsCategory.Audio);
      expect(manager.getAudioSettings().masterVolume).toBe(80); // 默认值
      expect(manager.getAudioSettings().bgmVolume).toBe(60); // 默认值
    });

    test('resetCategory 不影响其他分类', () => {
      manager.updateBasicSettings({ language: Language.English });
      manager.resetCategory(SettingsCategory.Audio);
      expect(manager.getBasicSettings().language).toBe(Language.English); // 不受影响
    });

    test('resetAll 恢复所有分类', () => {
      manager.updateBasicSettings({ language: Language.English });
      manager.updateAudioSettings({ masterVolume: 30 });
      manager.resetAll();
      expect(manager.getBasicSettings().language).toBe(Language.SimplifiedChinese);
      expect(manager.getAudioSettings().masterVolume).toBe(80);
    });
  });

  // ── 变更通知 ────────────────────────────

  describe('变更通知', () => {
    test('onChange 在设置变更时触发', () => {
      const callback = jest.fn();
      manager.onChange(callback);
      manager.updateBasicSettings({ language: Language.English });
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          category: SettingsCategory.Basic,
          key: 'basic',
        }),
      );
    });

    test('onChange 回调包含新旧值', () => {
      const callback = jest.fn();
      manager.onChange(callback);
      manager.updateAudioSettings({ masterVolume: 50 });
      const event = callback.mock.calls[0][0];
      expect(event.oldValue).toBeDefined();
      expect(event.newValue).toBeDefined();
      expect(event.timestamp).toBeGreaterThan(0);
    });

    test('取消注册后不再触发', () => {
      const callback = jest.fn();
      const unsub = manager.onChange(callback);
      unsub();
      manager.updateBasicSettings({ timezone: 9 });
      expect(callback).not.toHaveBeenCalled();
    });

    test('removeAllListeners 清除所有回调', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      manager.onChange(cb1);
      manager.onChange(cb2);
      manager.removeAllListeners();
      manager.updateAudioSettings({ masterVolume: 50 });
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });
  });

  // ── 持久化 ──────────────────────────────

  describe('持久化', () => {
    test('getSaveData 返回正确的序列化数据', () => {
      const data = manager.getSaveData();
      expect(data.version).toBe('19.0.0');
      expect(data.settings).toBeDefined();
      expect(data.settings.basic).toBeDefined();
      expect(data.settings.audio).toBeDefined();
    });

    test('restoreFromSaveData 恢复设置', () => {
      const saveData: SettingsSaveData = {
        version: '19.0.0',
        settings: {
          ...manager.getAllSettings(),
          audio: { ...manager.getAudioSettings(), masterVolume: 42 },
        },
      };
      const result = manager.restoreFromSaveData(saveData);
      expect(result).toBe(true);
      expect(manager.getAudioSettings().masterVolume).toBe(42);
    });

    test('restoreFromSaveData 无效数据返回 false', () => {
      expect(manager.restoreFromSaveData(null as unknown as Record<string, unknown>)).toBe(false);
      expect(manager.restoreFromSaveData({} as unknown as Record<string, unknown>)).toBe(false);
    });

    test('mergeRemoteSettings 远程更新时覆盖本地', () => {
      const remoteSettings: AllSettings = {
        ...manager.getAllSettings(),
        audio: { ...manager.getAudioSettings(), masterVolume: 99 },
        lastModifiedAt: Date.now() + 10000, // 更新
      };
      manager.mergeRemoteSettings(remoteSettings, remoteSettings.lastModifiedAt);
      expect(manager.getAudioSettings().masterVolume).toBe(99);
    });

    test('mergeRemoteSettings 本地更新时不覆盖', () => {
      manager.updateAudioSettings({ masterVolume: 50 }); // 更新 lastModifiedAt
      const localTimestamp = manager.getAllSettings().lastModifiedAt;
      const remoteSettings: AllSettings = {
        ...manager.getAllSettings(),
        audio: { ...manager.getAudioSettings(), masterVolume: 99 },
        lastModifiedAt: localTimestamp - 1000, // 更旧
      };
      manager.mergeRemoteSettings(remoteSettings, remoteSettings.lastModifiedAt);
      expect(manager.getAudioSettings().masterVolume).toBe(50); // 保持本地
    });
  });

  // ── 设置联动 ────────────────────────────

  describe('设置联动', () => {
    test('setSetting 精确设置单个分类', () => {
      manager.setSetting(
        SettingsCategory.Audio,
        'audio',
        { ...manager.getAudioSettings(), masterVolume: 25 },
      );
      expect(manager.getAudioSettings().masterVolume).toBe(25);
    });

    test('通知设置总开关关闭时所有子项应保持独立', () => {
      manager.updateBasicSettings({
        notificationEnabled: false,
        notificationFlags: {
          [NotificationType.BuildingComplete]: true, // 子项仍然 true
          [NotificationType.ExpeditionReturn]: true,
          [NotificationType.ActivityReminder]: false,
          [NotificationType.FriendMessage]: true,
          [NotificationType.AllianceNotice]: true,
        },
      });
      const basic = manager.getBasicSettings();
      expect(basic.notificationEnabled).toBe(false);
      expect(basic.notificationFlags[NotificationType.BuildingComplete]).toBe(true);
    });
  });
});
