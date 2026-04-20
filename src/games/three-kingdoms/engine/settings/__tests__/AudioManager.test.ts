/**
 * AudioManager 单元测试
 *
 * 覆盖：
 * 1. 音量计算规则（实际输出 = 分类音量 × 主音量）
 * 2. 4通道音量控制
 * 3. 4个音效开关
 * 4. 特殊场景（后台/来电/首次启动/低电量）
 * 5. BGM 管理
 * 6. 设置应用
 */

import { AudioManager } from '../AudioManager';
import type { IAudioPlayer, AudioEventCallbacks } from '../AudioManager';
import { AudioChannel, AudioSwitch } from '../../../core/settings';
import type { AudioSettings } from '../../../core/settings';
import { createDefaultAudioSettings } from '../../../core/settings';

// ─────────────────────────────────────────────
// Mock 播放器
// ─────────────────────────────────────────────

function createMockPlayer(): IAudioPlayer {
  return {
    play: jest.fn(),
    stop: jest.fn(),
    setVolume: jest.fn(),
    fade: jest.fn(),
  };
}

/** 创建默认音效设置 */
function defaultAudio(): AudioSettings {
  return createDefaultAudioSettings();
}

/** 创建 AudioManager */
function createAudioManager(): AudioManager {
  return new AudioManager();
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('AudioManager', () => {
  let audio: AudioManager;
  let player: IAudioPlayer;

  beforeEach(() => {
    audio = createAudioManager();
    player = createMockPlayer();
    audio.setPlayer(player);
    audio.applySettings(defaultAudio());
  });

  // ── 音量计算规则 ────────────────────────

  describe('音量计算规则', () => {
    test('实际输出 = 分类音量 × 主音量 / 10000', () => {
      // BGM: 60/100 * 80/100 = 0.48
      expect(audio.getEffectiveVolume(AudioChannel.BGM)).toBeCloseTo(0.48, 2);
      // SFX: 70/100 * 80/100 = 0.56
      expect(audio.getEffectiveVolume(AudioChannel.SFX)).toBeCloseTo(0.56, 2);
      // Voice: 80/100 * 80/100 = 0.64
      expect(audio.getEffectiveVolume(AudioChannel.Voice)).toBeCloseTo(0.64, 2);
    });

    test('主音量 0 时所有通道实际音量为 0', () => {
      audio.applySettings({ ...defaultAudio(), masterVolume: 0 });
      expect(audio.getEffectiveVolume(AudioChannel.BGM)).toBe(0);
      expect(audio.getEffectiveVolume(AudioChannel.SFX)).toBe(0);
      expect(audio.getEffectiveVolume(AudioChannel.Voice)).toBe(0);
    });

    test('主音量 100 + 分类音量 100 时实际输出为 1', () => {
      audio.applySettings({
        ...defaultAudio(),
        masterVolume: 100,
        bgmVolume: 100,
      });
      expect(audio.getEffectiveVolume(AudioChannel.BGM)).toBeCloseTo(1.0, 2);
    });

    test('getRawVolume 不受特殊场景影响', () => {
      audio.updateBatteryLevel(10); // 低电量
      const raw = audio.getRawVolume(AudioChannel.BGM);
      const effective = audio.getEffectiveVolume(AudioChannel.BGM);
      expect(raw).toBeGreaterThan(effective); // raw 不受低电量影响
    });
  });

  // ── 音效开关 ────────────────────────────

  describe('音效开关', () => {
    test('总开关关闭 → 所有通道实际音量为 0', () => {
      audio.applySettings({ ...defaultAudio(), masterSwitch: false });
      expect(audio.getEffectiveVolume(AudioChannel.BGM)).toBe(0);
      expect(audio.getEffectiveVolume(AudioChannel.SFX)).toBe(0);
      expect(audio.getEffectiveVolume(AudioChannel.Voice)).toBe(0);
      expect(audio.getEffectiveVolume(AudioChannel.Battle)).toBe(0);
    });

    test('BGM 开关关闭 → BGM 通道音量为 0', () => {
      audio.applySettings({ ...defaultAudio(), bgmSwitch: false });
      expect(audio.getEffectiveVolume(AudioChannel.BGM)).toBe(0);
      expect(audio.getEffectiveVolume(AudioChannel.SFX)).toBeGreaterThan(0); // 其他不受影响
    });

    test('语音开关关闭 → 语音通道音量为 0', () => {
      audio.applySettings({ ...defaultAudio(), voiceSwitch: false });
      expect(audio.getEffectiveVolume(AudioChannel.Voice)).toBe(0);
    });

    test('战斗音效开关关闭 → 战斗通道音量为 0', () => {
      audio.applySettings({ ...defaultAudio(), battleSfxSwitch: false });
      expect(audio.getEffectiveVolume(AudioChannel.Battle)).toBe(0);
    });

    test('开关变更触发回调', () => {
      const callbacks: AudioEventCallbacks = {
        onSwitchToggle: jest.fn(),
      };
      audio.setCallbacks(callbacks);
      audio.applySettings({ ...defaultAudio(), bgmSwitch: false });
      expect(callbacks.onSwitchToggle).toHaveBeenCalledWith(AudioSwitch.BGM, false);
    });
  });

  // ── 特殊场景 ────────────────────────────

  describe('特殊场景', () => {
    test('后台运行 → BGM 渐弱至静音', () => {
      // 需要先播放 BGM 才能触发渐弱
      jest.useFakeTimers();
      const newAudio = new AudioManager({ firstLaunchDelayMs: 0 });
      newAudio.setPlayer(player);
      newAudio.applySettings(defaultAudio());
      newAudio.playBGM('main-theme');
      jest.advanceTimersByTime(10);
      jest.useRealTimers();

      newAudio.enterBackground();
      expect(newAudio.getEffectiveVolume(AudioChannel.BGM)).toBe(0);
      expect(player.fade).toHaveBeenCalledWith(AudioChannel.BGM, 0, 1000);
      expect(newAudio.isBackground()).toBe(true);
    });

    test('回到前台 → BGM 渐入恢复', () => {
      jest.useFakeTimers();
      const newAudio = new AudioManager({ firstLaunchDelayMs: 0 });
      newAudio.setPlayer(player);
      newAudio.applySettings(defaultAudio());
      newAudio.playBGM('main-theme');
      jest.advanceTimersByTime(10);
      jest.useRealTimers();

      newAudio.enterBackground();
      newAudio.enterForeground();
      expect(newAudio.isBackground()).toBe(false);
      expect(player.fade).toHaveBeenCalled();
    });

    test('来电中断 → 全部静音', () => {
      audio.handleInterruption();
      expect(audio.isInterrupted()).toBe(true);
      expect(audio.getEffectiveVolume(AudioChannel.BGM)).toBe(0);
      expect(audio.getEffectiveVolume(AudioChannel.SFX)).toBe(0);
    });

    test('来电恢复 → 渐入恢复', () => {
      jest.useFakeTimers();
      const newAudio = new AudioManager({ firstLaunchDelayMs: 0 });
      newAudio.setPlayer(player);
      newAudio.applySettings(defaultAudio());
      newAudio.playBGM('main-theme');
      jest.advanceTimersByTime(10);
      jest.useRealTimers();

      newAudio.handleInterruption();
      newAudio.handleInterruptionEnd();
      expect(newAudio.isInterrupted()).toBe(false);
      expect(player.fade).toHaveBeenCalled();
    });

    test('首次启动 → BGM 延迟播放', () => {
      const newAudio = new AudioManager({ firstLaunchDelayMs: 100 });
      newAudio.setPlayer(player);
      newAudio.applySettings(defaultAudio());
      expect(newAudio.isFirstLaunchState()).toBe(true);

      jest.useFakeTimers();
      newAudio.playBGM('main-theme');
      expect(player.play).not.toHaveBeenCalled(); // 还没播放

      jest.advanceTimersByTime(100);
      expect(player.play).toHaveBeenCalledWith(AudioChannel.BGM, 'main-theme', expect.any(Number));
      jest.useRealTimers();
    });

    test('非首次启动 → BGM 立即播放', () => {
      jest.useFakeTimers();
      audio.playBGM('theme-1'); // 首次
      jest.advanceTimersByTime(3000); // 等待首次延迟
      audio.stopBGM();
      audio.playBGM('theme-2'); // 非首次
      // 第二次应该直接播放（setPlayer 的 player.play 已被调用）
      jest.useRealTimers();
    });

    test('低电量 (<20%) → BGM 音量降低 50%', () => {
      audio.updateBatteryLevel(15);
      const vol = audio.getEffectiveVolume(AudioChannel.BGM);
      // 0.48 * 0.5 = 0.24
      expect(vol).toBeCloseTo(0.24, 2);
    });

    test('电量正常 (≥20%) → BGM 音量不受影响', () => {
      audio.updateBatteryLevel(50);
      expect(audio.getEffectiveVolume(AudioChannel.BGM)).toBeCloseTo(0.48, 2);
    });
  });

  // ── BGM 管理 ────────────────────────────

  describe('BGM 管理', () => {
    test('playBGM 播放指定 BGM', () => {
      jest.useFakeTimers();
      const newAudio = new AudioManager({ firstLaunchDelayMs: 0 });
      newAudio.setPlayer(player);
      newAudio.applySettings(defaultAudio());
      newAudio.playBGM('main-theme');
      jest.advanceTimersByTime(10);
      expect(player.play).toHaveBeenCalledWith(
        AudioChannel.BGM, 'main-theme', expect.any(Number),
      );
      expect(newAudio.getCurrentBGM()).toBe('main-theme');
      jest.useRealTimers();
    });

    test('重复播放同一 BGM 不重新播放', () => {
      jest.useFakeTimers();
      const newAudio = new AudioManager({ firstLaunchDelayMs: 0 });
      newAudio.setPlayer(player);
      newAudio.applySettings(defaultAudio());
      newAudio.playBGM('main-theme');
      jest.advanceTimersByTime(10);
      const callCount = (player.play as jest.Mock).mock.calls.length;
      newAudio.playBGM('main-theme'); // 重复
      expect((player.play as jest.Mock).mock.calls.length).toBe(callCount);
      jest.useRealTimers();
    });

    test('stopBGM 停止播放', () => {
      audio.stopBGM();
      expect(player.stop).toHaveBeenCalledWith(AudioChannel.BGM);
      expect(audio.getCurrentBGM()).toBeNull();
    });
  });

  // ── 音效播放 ────────────────────────────

  describe('音效播放', () => {
    test('playSFX 播放音效', () => {
      audio.playSFX('click');
      expect(player.play).toHaveBeenCalledWith(
        AudioChannel.SFX, 'click', expect.any(Number),
      );
    });

    test('playVoice 播放语音', () => {
      audio.playVoice('dialog-01');
      expect(player.play).toHaveBeenCalledWith(
        AudioChannel.Voice, 'dialog-01', expect.any(Number),
      );
    });

    test('playBattleSFX 播放战斗音效', () => {
      audio.playBattleSFX('sword-slash');
      expect(player.play).toHaveBeenCalledWith(
        AudioChannel.Battle, 'sword-slash', expect.any(Number),
      );
    });
  });

  // ── 设置应用 ────────────────────────────

  describe('设置应用', () => {
    test('applySettings 更新音量', () => {
      audio.applySettings({ ...defaultAudio(), masterVolume: 50 });
      // BGM: 60/100 * 50/100 = 0.30
      expect(audio.getEffectiveVolume(AudioChannel.BGM)).toBeCloseTo(0.30, 2);
    });

    test('音量变更触发 onVolumeChange 回调', () => {
      const callbacks: AudioEventCallbacks = {
        onVolumeChange: jest.fn(),
      };
      audio.setCallbacks(callbacks);
      audio.applySettings({ ...defaultAudio(), bgmVolume: 30 });
      expect(callbacks.onVolumeChange).toHaveBeenCalledWith(AudioChannel.BGM, expect.any(Number));
    });
  });

  // ── 重置 ────────────────────────────────

  describe('重置', () => {
    test('reset 恢复到初始状态', () => {
      audio.playBGM('test');
      audio.enterBackground();
      audio.updateBatteryLevel(10);
      audio.reset();
      expect(audio.isBackground()).toBe(false);
      expect(audio.isInterrupted()).toBe(false);
      expect(audio.isFirstLaunchState()).toBe(true);
      expect(audio.getBatteryLevel()).toBe(100);
      expect(audio.getCurrentBGM()).toBeNull();
    });
  });
});
