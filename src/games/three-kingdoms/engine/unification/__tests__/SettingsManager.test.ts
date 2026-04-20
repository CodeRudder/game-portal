/**
 * SettingsManager 测试
 *
 * 覆盖：
 *   - ISubsystem 接口
 *   - 基础设置 (#1 语言, #2 时区, #3 通知)
 *   - 音效设置 (#4 音量, #6 开关)
 *   - 画面设置 (#8 画质档位, #9 高级选项)
 *   - 动画设置
 *   - 恢复默认 (#17)
 *   - 持久化 (#16)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsManager } from '../SettingsManager';
import { SettingsCategory } from '../../../core/settings';

function createMockDeps() {
  const events: { category: string; key: string }[] = [];
  return {
    eventBus: {
      on: () => {},
      emit: (_event: string, data: unknown) => { events.push(data as any); },
      off: () => {},
      _events: events,
    },
    config: { get: () => null },
    registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} },
  };
}

describe('SettingsManager', () => {
  let mgr: SettingsManager;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    mgr = new SettingsManager();
    deps = createMockDeps();
    mgr.init(deps as any);
  });

  describe('ISubsystem 接口', () => {
    it('应有正确的 name', () => {
      expect(mgr.name).toBe('settings');
    });

    it('init 不应抛错', () => {
      expect(() => mgr.init(deps as any)).not.toThrow();
    });

    it('update 不应抛错', () => {
      expect(() => mgr.update(16)).not.toThrow();
    });

    it('reset 应恢复所有默认设置', () => {
      mgr.setLanguage('en', false);
      mgr.reset();
      const basic = mgr.getBasicSettings();
      expect(basic.language).toBe('zh-CN');
    });

    it('getState 应返回完整设置', () => {
      const state = mgr.getState();
      expect(state).toHaveProperty('basic');
      expect(state).toHaveProperty('audio');
      expect(state).toHaveProperty('graphics');
      expect(state).toHaveProperty('account');
      expect(state).toHaveProperty('animation');
    });
  });

  describe('#1 语言设置', () => {
    it('应设置语言', () => {
      mgr.setLanguage('en', false);
      expect(mgr.getBasicSettings().language).toBe('en');
      expect(mgr.getBasicSettings().languageFollowSystem).toBe(false);
    });

    it('应设置跟随系统', () => {
      mgr.setLanguage('zh-CN', true);
      expect(mgr.getBasicSettings().languageFollowSystem).toBe(true);
    });
  });

  describe('#2 时区设置', () => {
    it('应设置时区偏移', () => {
      mgr.setTimezone(8, false);
      expect(mgr.getBasicSettings().timezone).toBe(8);
    });

    it('时区应钳位到 -12~14', () => {
      mgr.setTimezone(20, false);
      expect(mgr.getBasicSettings().timezone).toBe(14);
      mgr.setTimezone(-15, false);
      expect(mgr.getBasicSettings().timezone).toBe(-12);
    });
  });

  describe('#3 通知设置', () => {
    it('应设置通知总开关', () => {
      mgr.setNotificationEnabled(false);
      expect(mgr.getBasicSettings().notificationEnabled).toBe(false);
    });

    it('应设置单项通知开关', () => {
      mgr.setNotificationFlag('dailyReward', false);
      expect(mgr.getBasicSettings().notificationFlags.dailyReward).toBe(false);
    });
  });

  describe('#4 音量设置', () => {
    it('应设置主音量', () => {
      mgr.setMasterVolume(50);
      expect(mgr.getAudioSettings().masterVolume).toBe(50);
    });

    it('音量应钳位到 0~100', () => {
      mgr.setMasterVolume(150);
      expect(mgr.getAudioSettings().masterVolume).toBe(100);
    });

    it('应设置 BGM/音效/语音音量', () => {
      mgr.setBgmVolume(40);
      mgr.setSfxVolume(60);
      mgr.setVoiceVolume(80);
      const audio = mgr.getAudioSettings();
      expect(audio.bgmVolume).toBe(40);
      expect(audio.sfxVolume).toBe(60);
      expect(audio.voiceVolume).toBe(80);
    });
  });

  describe('#6 开关设置', () => {
    it('应设置主开关', () => {
      mgr.setMasterSwitch(false);
      expect(mgr.getAudioSettings().masterSwitch).toBe(false);
    });

    it('应设置 BGM/语音/战斗开关', () => {
      mgr.setBgmSwitch(false);
      mgr.setVoiceSwitch(false);
      mgr.setBattleSfxSwitch(false);
      const audio = mgr.getAudioSettings();
      expect(audio.bgmSwitch).toBe(false);
      expect(audio.voiceSwitch).toBe(false);
      expect(audio.battleSfxSwitch).toBe(false);
    });
  });

  describe('#8 画面设置', () => {
    it('应设置画质档位', () => {
      mgr.setGraphicsPreset('low');
      expect(mgr.getGraphicsSettings().preset).toBe('low');
    });
  });

  describe('#9 高级画质选项', () => {
    it('应设置单个高级选项', () => {
      mgr.setAdvancedOption('particleEffects', false);
      expect(mgr.getGraphicsSettings().advanced.particleEffects).toBe(false);
    });

    it('应批量设置高级选项', () => {
      mgr.setAdvancedOptions({ particleEffects: false, antiAliasing: true });
      const advanced = mgr.getGraphicsSettings().advanced;
      expect(advanced.particleEffects).toBe(false);
      expect(advanced.antiAliasing).toBe(true);
    });
  });

  describe('动画设置', () => {
    it('应设置动画总开关', () => {
      mgr.setAnimationEnabled(false);
      expect(mgr.getAnimationSettings().enabled).toBe(false);
    });
  });

  describe('#17 恢复默认', () => {
    it('resetCategory 应重置基础设置', () => {
      mgr.setLanguage('en', false);
      mgr.resetCategory(SettingsCategory.Basic);
      expect(mgr.getBasicSettings().language).toBe('zh-CN');
    });

    it('resetCategory 应重置音效设置', () => {
      mgr.setMasterVolume(30);
      mgr.resetCategory(SettingsCategory.Audio);
      expect(mgr.getAudioSettings().masterVolume).toBe(80);
    });

    it('resetCategory 应重置画面设置', () => {
      mgr.setGraphicsPreset('low');
      mgr.resetCategory(SettingsCategory.Graphics);
      expect(mgr.getGraphicsSettings().preset).toBe('auto');
    });
  });

  describe('#16 持久化', () => {
    it('exportData 应返回保存数据', () => {
      const data = mgr.exportData();
      expect(data.version).toBeTruthy();
      expect(data.settings).toBeDefined();
    });

    it('importData 应导入设置', () => {
      const exported = mgr.exportData();
      exported.settings.basic.language = 'ja';
      exported.settings.lastModifiedAt = Date.now() + 1000;
      mgr.importData(exported);
      expect(mgr.getBasicSettings().language).toBe('ja');
    });

    it('importData 旧时间戳不应覆盖', () => {
      mgr.setLanguage('en', false);
      const exported = mgr.exportData();
      exported.settings.lastModifiedAt = 0;
      mgr.importData(exported);
      expect(mgr.getBasicSettings().language).toBe('en');
    });

    it('getLastModifiedAt 应返回时间戳', () => {
      mgr.setLanguage('en', false);
      expect(mgr.getLastModifiedAt()).toBeGreaterThan(0);
    });
  });
});
