/**
 * audio-config 测试
 *
 * 覆盖：
 *   - AudioScene 枚举值
 *   - DEFAULT_AUDIO_CONFIG 默认值
 *   - 类型接口导出完整性
 */

import { describe, it, expect } from 'vitest';
import {
  AudioScene,
  DEFAULT_AUDIO_CONFIG,
} from '../audio-config';

describe('audio-config', () => {
  describe('AudioScene 枚举', () => {
    it('应包含所有场景类型', () => {
      expect(AudioScene.Normal).toBe('normal');
      expect(AudioScene.Background).toBe('background');
      expect(AudioScene.IncomingCall).toBe('incomingCall');
      expect(AudioScene.FirstLaunch).toBe('firstLaunch');
      expect(AudioScene.LowBattery).toBe('lowBattery');
    });

    it('应有5种场景', () => {
      const scenes = Object.values(AudioScene);
      expect(scenes).toHaveLength(5);
    });
  });

  describe('DEFAULT_AUDIO_CONFIG', () => {
    it('应包含所有配置字段', () => {
      expect(DEFAULT_AUDIO_CONFIG).toHaveProperty('firstLaunchDelayMs');
      expect(DEFAULT_AUDIO_CONFIG).toHaveProperty('backgroundFadeDurationMs');
      expect(DEFAULT_AUDIO_CONFIG).toHaveProperty('callRecoverFadeMs');
      expect(DEFAULT_AUDIO_CONFIG).toHaveProperty('lowBatteryThreshold');
      expect(DEFAULT_AUDIO_CONFIG).toHaveProperty('lowBatteryBGMReduction');
    });

    it('所有时间值应为正数', () => {
      expect(DEFAULT_AUDIO_CONFIG.firstLaunchDelayMs).toBeGreaterThan(0);
      expect(DEFAULT_AUDIO_CONFIG.backgroundFadeDurationMs).toBeGreaterThan(0);
      expect(DEFAULT_AUDIO_CONFIG.callRecoverFadeMs).toBeGreaterThan(0);
    });

    it('低电量阈值应在合理范围', () => {
      expect(DEFAULT_AUDIO_CONFIG.lowBatteryThreshold).toBeGreaterThan(0);
      expect(DEFAULT_AUDIO_CONFIG.lowBatteryThreshold).toBeLessThanOrEqual(100);
    });

    it('低电量BGM衰减系数应在 0~1 范围', () => {
      expect(DEFAULT_AUDIO_CONFIG.lowBatteryBGMReduction).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_AUDIO_CONFIG.lowBatteryBGMReduction).toBeLessThanOrEqual(1);
    });

    it('firstLaunchDelayMs 应为 3000ms', () => {
      expect(DEFAULT_AUDIO_CONFIG.firstLaunchDelayMs).toBe(3000);
    });
  });
});
