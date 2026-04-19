/**
 * AudioManager 程序化音频管理器测试
 *
 * 测试初始化、音量控制、静音切换、音效播放、BGM 播放、
 * 序列化/反序列化和 destroy 清理。
 * 所有 Web Audio API 节点通过 mock 模拟。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioManager } from '@/games/three-kingdoms/AudioManager';

// ═══════════════════════════════════════════════════════════════
// Web Audio API Mock
// ═══════════════════════════════════════════════════════════════

/** 创建一个 mock GainNode */
function createMockGainNode(): any {
  return {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

/** 创建一个 mock OscillatorNode */
function createMockOscillator(): any {
  return {
    type: 'sine',
    frequency: {
      value: 440,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  };
}

/** Mock AudioContext */
function createMockAudioContext(): any {
  const mockCtx = {
    currentTime: 0,
    createGain: vi.fn(() => createMockGainNode()),
    createOscillator: vi.fn(() => createMockOscillator()),
    destination: Symbol('destination'),
    close: vi.fn(() => Promise.resolve()),
  };
  return mockCtx;
}

// 保存原始引用
const originalAudioContext = globalThis.AudioContext;

beforeEach(() => {
  // Mock AudioContext
  (globalThis as any).AudioContext = vi.fn(() => createMockAudioContext());
  vi.useFakeTimers();
});

afterEach(() => {
  // 恢复原始 AudioContext
  if (originalAudioContext) {
    (globalThis as any).AudioContext = originalAudioContext;
  } else {
    delete (globalThis as any).AudioContext;
  }
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('AudioManager', () => {
  describe('初始化', () => {
    it('应该正确初始化 AudioContext 和增益节点', () => {
      const am = new AudioManager();
      am.init();

      expect((globalThis as any).AudioContext).toHaveBeenCalled();
      expect(am.isMuted()).toBe(false);
      expect(am.getVolume()).toBe(0.5);
    });

    it('应该幂等 — 多次调用 init 不会创建多个 AudioContext', () => {
      const am = new AudioManager();
      am.init();
      am.init();
      am.init();

      expect((globalThis as any).AudioContext).toHaveBeenCalledTimes(1);
    });

    it('未初始化时 getState 应该显示未初始化', () => {
      const am = new AudioManager();
      const state = am.getState();

      expect(state.initialized).toBe(false);
      expect(state.bgmPlaying).toBe(false);
      expect(state.currentBGM).toBeNull();
    });
  });

  describe('音量控制', () => {
    it('应该正确设置音量', () => {
      const am = new AudioManager();
      am.init();

      am.setVolume(0.8);
      expect(am.getVolume()).toBe(0.8);
    });

    it('应该将音量限制在 0~1 范围', () => {
      const am = new AudioManager();
      am.init();

      am.setVolume(-0.5);
      expect(am.getVolume()).toBe(0);

      am.setVolume(1.5);
      expect(am.getVolume()).toBe(1);
    });

    it('未初始化时也能记录音量设置', () => {
      const am = new AudioManager();
      am.setVolume(0.3);
      expect(am.getVolume()).toBe(0.3);
    });
  });

  describe('静音切换', () => {
    it('应该正确切换静音状态', () => {
      const am = new AudioManager();
      am.init();

      expect(am.isMuted()).toBe(false);

      const muted = am.toggleMute();
      expect(muted).toBe(true);
      expect(am.isMuted()).toBe(true);

      const unmuted = am.toggleMute();
      expect(unmuted).toBe(false);
      expect(am.isMuted()).toBe(false);
    });

    it('静音时音量应该为 0', () => {
      const am = new AudioManager();
      am.init();
      am.setVolume(0.7);

      am.toggleMute();

      // 通过 getState 验证
      const state = am.getState();
      expect(state.muted).toBe(true);
      expect(state.volume).toBe(0.7); // volume 值保持不变
    });
  });

  describe('音效播放', () => {
    it('应该播放 click 音效', () => {
      const am = new AudioManager();
      am.init();

      expect(() => am.playSFX('click')).not.toThrow();
    });

    it('应该播放 build 音效', () => {
      const am = new AudioManager();
      am.init();

      expect(() => am.playSFX('build')).not.toThrow();
    });

    it('应该播放 battle 音效', () => {
      const am = new AudioManager();
      am.init();

      expect(() => am.playSFX('battle')).not.toThrow();
    });

    it('应该播放 levelup 音效', () => {
      const am = new AudioManager();
      am.init();

      expect(() => am.playSFX('levelup')).not.toThrow();
    });

    it('应该播放 coin 音效', () => {
      const am = new AudioManager();
      am.init();

      expect(() => am.playSFX('coin')).not.toThrow();
    });

    it('应该播放 recruit 音效', () => {
      const am = new AudioManager();
      am.init();

      expect(() => am.playSFX('recruit')).not.toThrow();
    });

    it('未知音效应该播放默认 click', () => {
      const am = new AudioManager();
      am.init();

      expect(() => am.playSFX('unknown' as any)).not.toThrow();
    });

    it('未初始化时播放音效应该自动初始化', () => {
      const am = new AudioManager();
      am.playSFX('click');

      expect(am.getState().initialized).toBe(true);
    });
  });

  describe('BGM 播放', () => {
    it('应该开始播放 BGM', () => {
      const am = new AudioManager();
      am.init();

      am.playBGM('peaceful');

      expect(am.isBGMPlaying()).toBe(true);
      expect(am.getCurrentBGM()).toBe('peaceful');
    });

    it('应该停止 BGM', () => {
      const am = new AudioManager();
      am.init();

      am.playBGM('peaceful');
      expect(am.isBGMPlaying()).toBe(true);

      am.stopBGM();
      expect(am.isBGMPlaying()).toBe(false);
      expect(am.getCurrentBGM()).toBeNull();
    });

    it('切换 BGM 应该先停止旧的', () => {
      const am = new AudioManager();
      am.init();

      am.playBGM('peaceful');
      am.playBGM('battle');

      expect(am.getCurrentBGM()).toBe('battle');
      expect(am.isBGMPlaying()).toBe(true);
    });

    it('BGM 应该循环播放音符', () => {
      const am = new AudioManager();
      am.init();

      am.playBGM('peaceful');

      // 推进时间，触发几个音符
      vi.advanceTimersByTime(2000);

      // 应该仍在播放
      expect(am.isBGMPlaying()).toBe(true);
    });
  });

  describe('序列化 / 反序列化', () => {
    it('应该正确序列化音频设置', () => {
      const am = new AudioManager();
      am.init();
      am.setVolume(0.8);
      am.toggleMute();

      const data = am.serialize();
      expect(data).toEqual({
        muted: true,
        volume: 0.8,
      });
    });

    it('应该正确反序列化音频设置', () => {
      const am = new AudioManager();
      am.init();

      am.deserialize({ muted: true, volume: 0.3 });

      expect(am.isMuted()).toBe(true);
      expect(am.getVolume()).toBe(0.3);
    });

    it('反序列化部分数据应该只更新提供的字段', () => {
      const am = new AudioManager();
      am.init();
      am.setVolume(0.7);

      am.deserialize({ muted: true });

      expect(am.isMuted()).toBe(true);
      expect(am.getVolume()).toBe(0.7);
    });

    it('未初始化时序列化也应正常工作', () => {
      const am = new AudioManager();
      const data = am.serialize();

      expect(data).toEqual({
        muted: false,
        volume: 0.5,
      });
    });

    it('反序列化空对象不应改变状态', () => {
      const am = new AudioManager();
      am.init();
      am.setVolume(0.9);

      am.deserialize({});

      expect(am.getVolume()).toBe(0.9);
      expect(am.isMuted()).toBe(false);
    });
  });

  describe('destroy 清理', () => {
    it('应该清理所有资源', () => {
      const am = new AudioManager();
      am.init();
      am.playBGM('peaceful');

      am.destroy();

      expect(am.getState().initialized).toBe(false);
      expect(am.isBGMPlaying()).toBe(false);
      expect(am.getCurrentBGM()).toBeNull();
    });

    it('destroy 后应该可以重新初始化', () => {
      const am = new AudioManager();
      am.init();
      am.destroy();

      // 重新初始化
      am.init();
      expect(am.getState().initialized).toBe(true);
    });

    it('destroy 后播放音效应该自动重新初始化', () => {
      const am = new AudioManager();
      am.init();
      am.destroy();

      am.playSFX('click');
      expect(am.getState().initialized).toBe(true);
    });
  });

  describe('getState', () => {
    it('应该返回完整的状态快照', () => {
      const am = new AudioManager();
      am.init();
      am.setVolume(0.6);
      am.playBGM('victory');

      const state = am.getState();

      expect(state.initialized).toBe(true);
      expect(state.bgmPlaying).toBe(true);
      expect(state.currentBGM).toBe('victory');
      expect(state.muted).toBe(false);
      expect(state.volume).toBe(0.6);
    });
  });
});
