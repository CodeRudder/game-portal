/**
 * AudioController 测试
 *
 * 覆盖：
 *   - ISubsystem 接口
 *   - 音量控制 (#4)
 *   - 音量计算 (#5)
 *   - 开关控制 (#6)
 *   - 特殊场景 (#7)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AudioController, AudioScene } from '../AudioController';

function createMockDeps() {
  return {
    eventBus: { on: () => {}, emit: () => {}, off: () => {} },
    config: { get: () => null },
    registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} },
  };
}

describe('AudioController', () => {
  let audio: AudioController;

  beforeEach(() => {
    audio = new AudioController();
    audio.init(createMockDeps() as any);
  });

  describe('ISubsystem 接口', () => {
    it('应有正确的 name', () => {
      expect(audio.name).toBe('audioController');
    });

    it('init 不应抛错', () => {
      expect(() => audio.init(createMockDeps() as any)).not.toThrow();
    });

    it('reset 应恢复默认设置', () => {
      audio.setMasterVolume(50);
      audio.reset();
      const state = audio.getState();
      expect(state.masterVolume).toBe(80);
    });

    it('getState 应返回音效设置', () => {
      const state = audio.getState();
      expect(state.masterVolume).toBe(80);
      expect(state.bgmVolume).toBe(60);
      expect(state.sfxVolume).toBe(70);
      expect(state.voiceVolume).toBe(80);
    });
  });

  describe('#4 音量控制', () => {
    it('应设置主音量', () => {
      audio.setMasterVolume(50);
      expect(audio.getState().masterVolume).toBe(50);
    });

    it('应设置 BGM 音量', () => {
      audio.setBgmVolume(40);
      expect(audio.getState().bgmVolume).toBe(40);
    });

    it('应设置音效音量', () => {
      audio.setSfxVolume(60);
      expect(audio.getState().sfxVolume).toBe(60);
    });

    it('应设置语音音量', () => {
      audio.setVoiceVolume(90);
      expect(audio.getState().voiceVolume).toBe(90);
    });

    it('音量应钳位到 0~100', () => {
      audio.setMasterVolume(150);
      expect(audio.getState().masterVolume).toBe(100);
      audio.setMasterVolume(-10);
      expect(audio.getState().masterVolume).toBe(0);
    });

    it('音量应对齐到步进值 (5%)', () => {
      audio.setMasterVolume(73);
      expect(audio.getState().masterVolume).toBe(75);
    });

    it('stepUp 应增加音量', () => {
      audio.setMasterVolume(50);
      const next = audio.stepUp('master', 5);
      expect(next).toBe(55);
    });

    it('stepDown 应减少音量', () => {
      audio.setMasterVolume(50);
      const next = audio.stepDown('master', 5);
      expect(next).toBe(45);
    });

    it('stepUp 不应超过最大值', () => {
      audio.setMasterVolume(100);
      const next = audio.stepUp('master', 5);
      expect(next).toBe(100);
    });
  });

  describe('#5 音量计算', () => {
    it('实际输出 = 分类音量 × 主音量 / 100', () => {
      audio.setMasterVolume(80);
      audio.setBgmVolume(60);
      const output = audio.calculateOutput();
      expect(output.bgm).toBe(Math.round(60 * 0.8));
    });

    it('主开关关闭时所有输出为 0', () => {
      audio.setMasterSwitch(false);
      const output = audio.calculateOutput();
      expect(output.bgm).toBe(0);
      expect(output.sfx).toBe(0);
      expect(output.voice).toBe(0);
      expect(output.battle).toBe(0);
    });

    it('BGM 开关关闭时 BGM 输出为 0', () => {
      audio.setBgmSwitch(false);
      const output = audio.calculateOutput();
      expect(output.bgm).toBe(0);
      // 其他通道不受影响
      expect(output.sfx).toBeGreaterThan(0);
    });

    it('getEffectiveVolume 应返回指定通道输出', () => {
      const vol = audio.getEffectiveVolume('bgm');
      expect(vol).toBeGreaterThanOrEqual(0);
      expect(vol).toBeLessThanOrEqual(100);
    });
  });

  describe('#6 开关控制', () => {
    it('应设置语音开关', () => {
      audio.setVoiceSwitch(false);
      expect(audio.getState().voiceSwitch).toBe(false);
    });

    it('应设置战斗音效开关', () => {
      audio.setBattleSfxSwitch(false);
      expect(audio.getState().battleSfxSwitch).toBe(false);
    });

    it('isMuted 应判断通道是否静音', () => {
      audio.setMasterSwitch(true);
      audio.setBgmSwitch(true);
      expect(audio.isMuted('bgm')).toBe(false);
      audio.setBgmSwitch(false);
      expect(audio.isMuted('bgm')).toBe(true);
    });

    it('主开关关闭时所有通道静音', () => {
      audio.setMasterSwitch(false);
      expect(audio.isMuted('sfx')).toBe(true);
      expect(audio.isMuted('voice')).toBe(true);
    });
  });

  describe('#7 特殊场景', () => {
    it('后台场景应降低音量乘数为 0', () => {
      audio.setScene(AudioScene.Background);
      expect(audio.getSceneVolumeMultiplier()).toBe(0);
    });

    it('来电场景应静音', () => {
      audio.setScene(AudioScene.IncomingCall);
      expect(audio.getSceneVolumeMultiplier()).toBe(0);
    });

    it('低电量场景应降低 BGM', () => {
      audio.setScene(AudioScene.LowBattery);
      expect(audio.getSceneVolumeMultiplier()).toBeLessThan(1);
      expect(audio.getSceneVolumeMultiplier()).toBeGreaterThan(0);
    });

    it('正常场景应恢复音量', () => {
      audio.setScene(AudioScene.Background);
      audio.setScene(AudioScene.Normal);
      expect(audio.getSceneVolumeMultiplier()).toBe(1);
    });

    it('setBatteryLevel 低电量应自动切换场景', () => {
      audio.setScene(AudioScene.Normal);
      audio.setBatteryLevel(10);
      expect(audio.getScene()).toBe(AudioScene.LowBattery);
    });

    it('setBatteryLevel 恢复应切回正常', () => {
      audio.setBatteryLevel(10);
      audio.setBatteryLevel(50);
      expect(audio.getScene()).toBe(AudioScene.Normal);
    });

    it('首次启动延迟应正常工作', () => {
      audio.setScene(AudioScene.FirstLaunch);
      expect(audio.getScene()).toBe(AudioScene.FirstLaunch);
      expect(audio.getSceneVolumeMultiplier()).toBe(0);
    });

    it('markFirstLaunchComplete 应结束首次启动', () => {
      audio.setScene(AudioScene.FirstLaunch);
      audio.markFirstLaunchComplete();
      expect(audio.getIsFirstLaunch()).toBe(false);
      expect(audio.getScene()).toBe(AudioScene.Normal);
    });

    it('getConfig 应返回配置', () => {
      const config = audio.getConfig();
      expect(config.firstLaunchDelay).toBe(3000);
      expect(config.lowBatteryThreshold).toBeGreaterThan(0);
    });
  });
});
