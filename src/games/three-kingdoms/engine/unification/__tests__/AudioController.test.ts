/**
 * AudioController 向后兼容测试
 *
 * 验证从 unification/AudioController 导出的符号
 * 实际上是 AudioManager 的别名。
 */

import { describe, it, expect } from 'vitest';
import { AudioController, AudioScene } from '../AudioController';
import { AudioManager } from '../../settings/AudioManager';

describe('AudioController (backward compat)', () => {
  it('AudioController 应为 AudioManager 的别名', () => {
    expect(AudioController).toBe(AudioManager);
  });

  it('AudioScene 应从 AudioManager 域导出', () => {
    expect(AudioScene.Normal).toBe('normal');
    expect(AudioScene.Background).toBe('background');
    expect(AudioScene.IncomingCall).toBe('incomingCall');
    expect(AudioScene.FirstLaunch).toBe('firstLaunch');
    expect(AudioScene.LowBattery).toBe('lowBattery');
  });
});
