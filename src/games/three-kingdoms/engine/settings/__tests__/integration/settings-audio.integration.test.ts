/**
 * 集成测试 — §1 音效系统统一 (v19.0)
 *
 * 覆盖：
 *   - 4通道独立控制 (BGM/SFX/Voice/Battle)
 *   - 主音量公式 (实际输出 = 分类音量 × 主音量)
 *   - 特殊场景处理 (后台BGM渐弱/来电静音/首次启动延迟/低电量降BGM)
 *   - BGM延迟播放
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/settings/__tests__/integration/settings-audio
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioManager } from '../../AudioManager';
import { AudioSceneHelper } from '../../AudioSceneHelper';
import { AudioScene, DEFAULT_AUDIO_CONFIG } from '../../audio-config';
import type { IAudioPlayer, AudioEventCallbacks, VolumeOutput } from '../../audio-config';
import type { AudioSettings } from '../../../../core/settings';
import { AudioChannel, AudioSwitch, VOLUME_MIN, VOLUME_MAX, VOLUME_STEP } from '../../../../core/settings';
import type { ISystemDeps } from '../../../../core/types';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

/** 构造 mock ISystemDeps */
function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

/** 创建 mock 播放器，记录所有调用 */
function createMockPlayer(): IAudioPlayer & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    play: (...args) => { calls.push({ method: 'play', args }); },
    stop: (...args) => { calls.push({ method: 'stop', args }); },
    setVolume: (...args) => { calls.push({ method: 'setVolume', args }); },
    fade: (...args) => { calls.push({ method: 'fade', args }); },
  };
}

/** 创建默认音效设置 */
function defaultAudioSettings(overrides?: Partial<AudioSettings>): AudioSettings {
  return {
    masterVolume: 80,
    bgmVolume: 70,
    sfxVolume: 60,
    voiceVolume: 50,
    masterSwitch: true,
    bgmSwitch: true,
    voiceSwitch: true,
    battleSfxSwitch: true,
    ...overrides,
  };
}

/** 创建已初始化的 AudioManager */
function createAudioManager(config?: Partial<typeof DEFAULT_AUDIO_CONFIG>): AudioManager {
  const mgr = new AudioManager(config);
  mgr.init(mockDeps());
  return mgr;
}

// ═══════════════════════════════════════════════════════════════════════

describe('v19.0 §1 音效系统统一 集成测试', () => {

  beforeEach(() => {
    vi.useFakeTimers();
  });

  // ═══════════════════════════════════════════════════════════════════
  // §1.1  4通道独立控制
  // ═══════════════════════════════════════════════════════════════════

  describe('§1.1 4通道独立控制', () => {

    it('BGM通道: bgmSwitch=false 时 getEffectiveVolume 返回 0', () => {
      const mgr = createAudioManager();
      mgr.applySettings(defaultAudioSettings({ bgmSwitch: false }));
      expect(mgr.getEffectiveVolume(AudioChannel.BGM)).toBe(0);
    });

    it('SFX通道: masterSwitch 控制开关', () => {
      const mgr = createAudioManager();
      mgr.applySettings(defaultAudioSettings({ masterSwitch: false }));
      expect(mgr.getEffectiveVolume(AudioChannel.SFX)).toBe(0);
    });

    it('Voice通道: voiceSwitch=false 时静音', () => {
      const mgr = createAudioManager();
      mgr.applySettings(defaultAudioSettings({ voiceSwitch: false }));
      expect(mgr.getEffectiveVolume(AudioChannel.Voice)).toBe(0);
    });

    it('Battle通道: battleSfxSwitch=false 时静音', () => {
      const mgr = createAudioManager();
      mgr.applySettings(defaultAudioSettings({ battleSfxSwitch: false }));
      expect(mgr.getEffectiveVolume(AudioChannel.Battle)).toBe(0);
    });

    it('4通道音量互不干扰 — 各通道独立设置不同值', () => {
      const mgr = createAudioManager();
      mgr.applySettings(defaultAudioSettings({
        masterVolume: 100,
        bgmVolume: 40,
        sfxVolume: 60,
        voiceVolume: 80,
      }));
      // Battle 使用 sfxVolume
      expect(mgr.getEffectiveVolume(AudioChannel.BGM)).toBeCloseTo(0.4, 2);
      expect(mgr.getEffectiveVolume(AudioChannel.SFX)).toBeCloseTo(0.6, 2);
      expect(mgr.getEffectiveVolume(AudioChannel.Voice)).toBeCloseTo(0.8, 2);
      expect(mgr.getEffectiveVolume(AudioChannel.Battle)).toBeCloseTo(0.6, 2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §1.2  主音量公式
  // ═══════════════════════════════════════════════════════════════════

  describe('§1.2 主音量公式 (实际输出 = 分类音量 × 主音量)', () => {

    it('公式验证: bgmVolume=50, masterVolume=80 → effective = 0.5 × 0.8 = 0.4', () => {
      const mgr = createAudioManager();
      mgr.applySettings(defaultAudioSettings({ bgmVolume: 50, masterVolume: 80 }));
      expect(mgr.getEffectiveVolume(AudioChannel.BGM)).toBeCloseTo(0.4, 2);
    });

    it('masterVolume=0 时所有通道静音', () => {
      const mgr = createAudioManager();
      mgr.applySettings(defaultAudioSettings({ masterVolume: 0 }));
      expect(mgr.getEffectiveVolume(AudioChannel.BGM)).toBe(0);
      expect(mgr.getEffectiveVolume(AudioChannel.SFX)).toBe(0);
      expect(mgr.getEffectiveVolume(AudioChannel.Voice)).toBe(0);
      expect(mgr.getEffectiveVolume(AudioChannel.Battle)).toBe(0);
    });

    it('masterVolume=100, bgmVolume=100 → effective = 1.0', () => {
      const mgr = createAudioManager();
      mgr.applySettings(defaultAudioSettings({ masterVolume: 100, bgmVolume: 100 }));
      expect(mgr.getEffectiveVolume(AudioChannel.BGM)).toBeCloseTo(1.0, 2);
    });

    it('calculateOutput 返回 0~100 范围的 4 通道输出', () => {
      const mgr = createAudioManager();
      mgr.applySettings(defaultAudioSettings({ masterVolume: 50, bgmVolume: 60, sfxVolume: 70, voiceVolume: 80 }));
      const output: VolumeOutput = mgr.calculateOutput();
      expect(output.bgm).toBe(Math.round(60 * 0.5));
      expect(output.sfx).toBe(Math.round(70 * 0.5));
      expect(output.voice).toBe(Math.round(80 * 0.5));
      expect(output.battle).toBe(Math.round(70 * 0.5));
    });

    it('getRawVolume 不受特殊场景影响', () => {
      const mgr = createAudioManager();
      mgr.applySettings(defaultAudioSettings({ bgmVolume: 60, masterVolume: 50 }));
      mgr.enterBackground(); // 后台场景
      // rawVolume 不受场景影响
      expect(mgr.getRawVolume(AudioChannel.BGM)).toBeCloseTo(0.3, 2);
      // effectiveVolume 受场景影响 → 0
      expect(mgr.getEffectiveVolume(AudioChannel.BGM)).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §1.3  特殊场景处理
  // ═══════════════════════════════════════════════════════════════════

  describe('§1.3 特殊场景处理', () => {

    it('后台场景: enterBackground → BGM fade 至 0', () => {
      const mgr = createAudioManager();
      const player = createMockPlayer();
      mgr.setPlayer(player);
      mgr.applySettings(defaultAudioSettings());
      mgr.playBGM('main_theme');
      vi.advanceTimersByTime(100); // 清除首次启动延迟

      mgr.enterBackground();
      // 应调用 fade(BGM, 0, backgroundFadeDurationMs)
      const fadeCalls = player.calls.filter(c => c.method === 'fade');
      expect(fadeCalls.length).toBeGreaterThanOrEqual(1);
      expect(fadeCalls[fadeCalls.length - 1].args[1]).toBe(0);
      expect(mgr.isBackground()).toBe(true);
    });

    it('来电中断: handleInterruption → 所有通道静音', () => {
      const mgr = createAudioManager();
      const player = createMockPlayer();
      mgr.setPlayer(player);
      mgr.applySettings(defaultAudioSettings());

      mgr.handleInterruption();
      // handleInterruption 对 4 个通道调用 setVolume(channel, 0)
      const setVolCalls = player.calls.filter(
        c => c.method === 'setVolume' && c.args[1] === 0,
      );
      // 至少 4 个通道各一次 (applySettings 也会触发 setVolume)
      expect(setVolCalls.length).toBeGreaterThanOrEqual(4);
      // 验证 BGM/SFX/Voice/Battle 4 个通道都被设为 0
      const mutedChannels = new Set(setVolCalls.map(c => c.args[0]));
      expect(mutedChannels.has(AudioChannel.BGM)).toBe(true);
      expect(mutedChannels.has(AudioChannel.SFX)).toBe(true);
      expect(mutedChannels.has(AudioChannel.Voice)).toBe(true);
      expect(mutedChannels.has(AudioChannel.Battle)).toBe(true);
      expect(mgr.isInterrupted()).toBe(true);
      // getEffectiveVolume 全部为 0
      expect(mgr.getEffectiveVolume(AudioChannel.BGM)).toBe(0);
      expect(mgr.getEffectiveVolume(AudioChannel.SFX)).toBe(0);
    });

    it('来电恢复: handleInterruptionEnd → 渐入恢复', () => {
      const mgr = createAudioManager();
      const player = createMockPlayer();
      mgr.setPlayer(player);
      mgr.applySettings(defaultAudioSettings());
      mgr.playBGM('main_theme');
      vi.advanceTimersByTime(100);

      mgr.handleInterruption();
      mgr.handleInterruptionEnd();
      expect(mgr.isInterrupted()).toBe(false);
      // 恢复后应有 fade 调用
      const fadeCalls = player.calls.filter(c => c.method === 'fade');
      expect(fadeCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('低电量: batteryLevel < 20 → BGM 音量降低 50%', () => {
      const mgr = createAudioManager({ lowBatteryThreshold: 20, lowBatteryBGMReduction: 0.5 });
      mgr.applySettings(defaultAudioSettings({ bgmVolume: 100, masterVolume: 100 }));
      // 正常音量
      expect(mgr.getEffectiveVolume(AudioChannel.BGM)).toBeCloseTo(1.0, 2);
      // 低电量
      mgr.updateBatteryLevel(10);
      expect(mgr.getEffectiveVolume(AudioChannel.BGM)).toBeCloseTo(0.5, 2);
    });

    it('低电量不影响 SFX/Voice/Battle 通道', () => {
      const mgr = createAudioManager({ lowBatteryThreshold: 20, lowBatteryBGMReduction: 0.5 });
      mgr.applySettings(defaultAudioSettings({ masterVolume: 100, sfxVolume: 80, voiceVolume: 60 }));
      mgr.updateBatteryLevel(10);
      expect(mgr.getEffectiveVolume(AudioChannel.SFX)).toBeCloseTo(0.8, 2);
      expect(mgr.getEffectiveVolume(AudioChannel.Voice)).toBeCloseTo(0.6, 2);
    });

    it('setScene(AudioScene.Background) 自动触发后台处理', () => {
      const mgr = createAudioManager();
      mgr.applySettings(defaultAudioSettings());
      mgr.setScene(AudioScene.Background);
      expect(mgr.isBackground()).toBe(true);
      expect(mgr.getScene()).toBe(AudioScene.Background);
    });

    it('setScene(AudioScene.Normal) 从后台/来电恢复', () => {
      const mgr = createAudioManager();
      mgr.applySettings(defaultAudioSettings());
      mgr.setScene(AudioScene.Background);
      mgr.setScene(AudioScene.IncomingCall);
      mgr.setScene(AudioScene.Normal);
      expect(mgr.isBackground()).toBe(false);
      expect(mgr.isInterrupted()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §1.4  BGM 延迟播放
  // ═══════════════════════════════════════════════════════════════════

  describe('§1.4 BGM 延迟播放', () => {

    it('首次启动: playBGM 延迟 firstLaunchDelayMs 后播放', () => {
      const mgr = createAudioManager({ firstLaunchDelayMs: 3000 });
      const player = createMockPlayer();
      mgr.setPlayer(player);
      mgr.applySettings(defaultAudioSettings());

      mgr.playBGM('opening');
      // 立即检查 — 尚未播放（延迟中）
      const playCalls0 = player.calls.filter(c => c.method === 'play');
      expect(playCalls0.length).toBe(0);
      expect(mgr.isFirstLaunchState()).toBe(true);

      // 推进 3 秒后触发
      vi.advanceTimersByTime(3000);
      const playCallsAfter = player.calls.filter(c => c.method === 'play');
      expect(playCallsAfter.length).toBe(1);
      expect(playCallsAfter[0].args[1]).toBe('opening');
      expect(mgr.isFirstLaunchState()).toBe(false);
    });

    it('非首次启动: playBGM 立即播放无延迟', () => {
      const mgr = createAudioManager({ firstLaunchDelayMs: 3000 });
      const player = createMockPlayer();
      mgr.setPlayer(player);
      mgr.applySettings(defaultAudioSettings());
      mgr.markFirstLaunchComplete();

      mgr.playBGM('battle_theme');
      const playCalls = player.calls.filter(c => c.method === 'play');
      expect(playCalls.length).toBe(1);
      expect(playCalls[0].args[1]).toBe('battle_theme');
    });

    it('重复播放同一 BGM 不触发重复播放', () => {
      const mgr = createAudioManager();
      const player = createMockPlayer();
      mgr.setPlayer(player);
      mgr.applySettings(defaultAudioSettings());
      mgr.markFirstLaunchComplete();

      mgr.playBGM('main');
      mgr.playBGM('main'); // 重复
      const playCalls = player.calls.filter(c => c.method === 'play');
      expect(playCalls.length).toBe(1);
    });

    it('stopBGM 清除延迟定时器', () => {
      const mgr = createAudioManager({ firstLaunchDelayMs: 5000 });
      const player = createMockPlayer();
      mgr.setPlayer(player);
      mgr.applySettings(defaultAudioSettings());

      mgr.playBGM('delayed_theme');
      mgr.stopBGM();
      vi.advanceTimersByTime(5000);
      // 定时器已清除，不应播放
      const playCalls = player.calls.filter(c => c.method === 'play');
      expect(playCalls.length).toBe(0);
      expect(mgr.getCurrentBGM()).toBeNull();
    });
  });
});
