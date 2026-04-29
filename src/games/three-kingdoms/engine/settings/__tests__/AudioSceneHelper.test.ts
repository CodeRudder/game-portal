/**
 * AudioSceneHelper 单元测试
 *
 * 覆盖：
 * 1. isChannelEnabled — 通道启用检查
 * 2. getChannelVolume — 通道音量获取
 * 3. clampAndSnap — 音量钳位与对齐
 * 4. calculateOutput — 实际输出音量计算
 * 5. isMuted — 静音判断
 * 6. stepUp / stepDown — 音量步进
 */

import { AudioSceneHelper } from '../AudioSceneHelper';
import { AudioChannel } from '../../../core/settings';

import type { AudioSettings } from '../../../core/settings';
import type { AudioSceneContext } from '../AudioSceneHelper';

describe('AudioSceneHelper', () => {
  const defaultSettings: AudioSettings = {
    masterSwitch: true,
    bgmSwitch: true,
    sfxVolume: 80,
    bgmVolume: 70,
    voiceVolume: 60,
    masterVolume: 90,
    battleSfxSwitch: true,
    voiceSwitch: true,
  };

  function makeCtx(overrides?: Partial<AudioSceneContext>): AudioSceneContext {
    return {
      settings: defaultSettings,
      player: { play: vi.fn(), stop: vi.fn(), setVolume: vi.fn() },
      callbacks: {},
      isInBackground: false,
      isInCall: false,
      batteryLevel: 100,
      lowBatteryThreshold: 20,
      lowBatteryBGMReduction: 0.5,
      getEffectiveVolume: () => 50,
      ...overrides,
    };
  }

  // ─── isChannelEnabled ─────────────────────

  describe('isChannelEnabled', () => {
    it('BGM 通道应检查 bgmSwitch', () => {
      expect(AudioSceneHelper.isChannelEnabled(defaultSettings, AudioChannel.BGM)).toBe(true);
      const off = { ...defaultSettings, bgmSwitch: false };
      expect(AudioSceneHelper.isChannelEnabled(off, AudioChannel.BGM)).toBe(false);
    });

    it('SFX 通道应检查 masterSwitch', () => {
      expect(AudioSceneHelper.isChannelEnabled(defaultSettings, AudioChannel.SFX)).toBe(true);
      const off = { ...defaultSettings, masterSwitch: false };
      expect(AudioSceneHelper.isChannelEnabled(off, AudioChannel.SFX)).toBe(false);
    });

    it('null settings 应返回 false', () => {
      expect(AudioSceneHelper.isChannelEnabled(null, AudioChannel.BGM)).toBe(false);
    });
  });

  // ─── getChannelVolume ─────────────────────

  describe('getChannelVolume', () => {
    it('BGM 应返回 bgmVolume', () => {
      expect(AudioSceneHelper.getChannelVolume(defaultSettings, AudioChannel.BGM)).toBe(70);
    });

    it('SFX 应返回 sfxVolume', () => {
      expect(AudioSceneHelper.getChannelVolume(defaultSettings, AudioChannel.SFX)).toBe(80);
    });

    it('null settings 应返回 0', () => {
      expect(AudioSceneHelper.getChannelVolume(null, AudioChannel.BGM)).toBe(0);
    });
  });

  // ─── clampAndSnap ─────────────────────────

  describe('clampAndSnap', () => {
    it('正常值应对齐到步进', () => {
      const result = AudioSceneHelper.clampAndSnap(55);
      expect(result % 5).toBe(0);
    });

    it('超过100应被钳位到100', () => {
      expect(AudioSceneHelper.clampAndSnap(150)).toBe(100);
    });

    it('低于0应被钳位到0', () => {
      expect(AudioSceneHelper.clampAndSnap(-10)).toBe(0);
    });

    it('边界值0和100应正常', () => {
      expect(AudioSceneHelper.clampAndSnap(0)).toBe(0);
      expect(AudioSceneHelper.clampAndSnap(100)).toBe(100);
    });
  });

  // ─── calculateOutput ──────────────────────

  describe('calculateOutput', () => {
    it('正常场景应返回非零音量', () => {
      const ctx = makeCtx();
      const output = AudioSceneHelper.calculateOutput(ctx);
      expect(output.bgm).toBeGreaterThan(0);
      expect(output.sfx).toBeGreaterThan(0);
    });

    it('后台场景 BGM 应为 0', () => {
      const ctx = makeCtx({ isInBackground: true });
      const output = AudioSceneHelper.calculateOutput(ctx);
      expect(output.bgm).toBe(0);
    });

    it('通话中所有通道应为 0', () => {
      const ctx = makeCtx({ isInCall: true });
      const output = AudioSceneHelper.calculateOutput(ctx);
      expect(output.bgm).toBe(0);
      expect(output.sfx).toBe(0);
      expect(output.voice).toBe(0);
      expect(output.battle).toBe(0);
    });

    it('null settings 应返回全0', () => {
      const ctx = makeCtx({ settings: null });
      const output = AudioSceneHelper.calculateOutput(ctx);
      expect(output.bgm).toBe(0);
      expect(output.sfx).toBe(0);
    });

    it('masterSwitch 关闭应使所有音量为0', () => {
      const ctx = makeCtx({ settings: { ...defaultSettings, masterSwitch: false } });
      const output = AudioSceneHelper.calculateOutput(ctx);
      expect(output.bgm).toBe(0);
      expect(output.sfx).toBe(0);
    });
  });

  // ─── isMuted ──────────────────────────────

  describe('isMuted', () => {
    it('BGM 关闭时应静音', () => {
      expect(AudioSceneHelper.isMuted({ ...defaultSettings, bgmSwitch: false }, AudioChannel.BGM)).toBe(true);
    });

    it('master 关闭时所有应静音', () => {
      const s = { ...defaultSettings, masterSwitch: false };
      expect(AudioSceneHelper.isMuted(s, AudioChannel.SFX)).toBe(true);
      expect(AudioSceneHelper.isMuted(s, AudioChannel.BGM)).toBe(true);
    });

    it('正常设置应不静音', () => {
      expect(AudioSceneHelper.isMuted(defaultSettings, AudioChannel.BGM)).toBe(false);
    });

    it('null settings 应返回 true', () => {
      expect(AudioSceneHelper.isMuted(null, AudioChannel.BGM)).toBe(true);
    });
  });

  // ─── stepUp / stepDown ───────────────────

  describe('stepUp / stepDown', () => {
    it('stepUp 应增加音量', () => {
      const settings = { ...defaultSettings, bgmVolume: 50 };
      const result = AudioSceneHelper.stepUp(settings, AudioChannel.BGM);
      expect(result).toBeGreaterThan(50);
      expect(settings.bgmVolume).toBe(result);
    });

    it('stepDown 应减少音量', () => {
      const settings = { ...defaultSettings, bgmVolume: 50 };
      const result = AudioSceneHelper.stepDown(settings, AudioChannel.BGM);
      expect(result).toBeLessThan(50);
      expect(settings.bgmVolume).toBe(result);
    });

    it('stepUp 不应超过最大值', () => {
      const settings = { ...defaultSettings, bgmVolume: 100 };
      const result = AudioSceneHelper.stepUp(settings, AudioChannel.BGM);
      expect(result).toBe(100);
    });

    it('stepDown 不应低于最小值', () => {
      const settings = { ...defaultSettings, bgmVolume: 0 };
      const result = AudioSceneHelper.stepDown(settings, AudioChannel.BGM);
      expect(result).toBe(0);
    });

    it('null settings 应返回步进值（默认从0开始）', () => {
      expect(AudioSceneHelper.stepUp(null, AudioChannel.BGM)).toBe(5);
      expect(AudioSceneHelper.stepDown(null, AudioChannel.BGM)).toBe(0);
    });
  });

  // ─── setChannelVolume ─────────────────────

  describe('setChannelVolume', () => {
    it('应正确设置 BGM 音量', () => {
      const settings = { ...defaultSettings };
      AudioSceneHelper.setChannelVolume(settings, AudioChannel.BGM, 30);
      expect(settings.bgmVolume).toBe(30);
    });

    it('null settings 不应抛错', () => {
      expect(() => AudioSceneHelper.setChannelVolume(null, AudioChannel.BGM, 50)).not.toThrow();
    });
  });
});
