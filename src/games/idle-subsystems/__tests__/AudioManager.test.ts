/**
 * AudioManager 测试套件
 *
 * 测试程序化音频管理器的初始化、音量控制、静音、各音效播放。
 * 使用 mock AudioContext 来避免浏览器依赖。
 */
import { AudioManager } from '../AudioManager';

// ═══════════════════════════════════════════════════════════════
// Mock AudioContext
// ═══════════════════════════════════════════════════════════════

function createMockGainNode(): GainNode {
  return {
    gain: {
      value: 1,
      setValueAtTime: jest.fn(),
      exponentialRampToValueAtTime: jest.fn(),
      linearRampToValueAtTime: jest.fn(),
    },
    connect: jest.fn(),
    disconnect: jest.fn(),
  } as unknown as GainNode;
}

function createMockOscillator(): OscillatorNode {
  return {
    type: 'sine' as OscillatorType,
    frequency: {
      value: 440,
      setValueAtTime: jest.fn(),
      exponentialRampToValueAtTime: jest.fn(),
      linearRampToValueAtTime: jest.fn(),
    },
    connect: jest.fn(),
    disconnect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  } as unknown as OscillatorNode;
}

function createMockAudioContext(): AudioContext {
  const ctx = {
    currentTime: 0,
    state: 'running' as AudioContextState,
    createGain: jest.fn(() => createMockGainNode()),
    createOscillator: jest.fn(() => createMockOscillator()),
    destination: {} as AudioDestinationNode,
    connect: jest.fn(),
    disconnect: jest.fn(),
    close: jest.fn(),
    resume: jest.fn(() => Promise.resolve()),
  } as unknown as AudioContext;
  return ctx;
}

// 保存原始引用
const originalAudioContext = globalThis.AudioContext;

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('AudioManager', () => {
  let audioManager: AudioManager;
  let mockCtxInstance: any;

  beforeEach(() => {
    jest.useFakeTimers();

    // Mock AudioContext 构造函数 — 必须用 class 形式才能 `new`
    const MockAC = class {
      currentTime = 0;
      state: AudioContextState = 'running';
      createGain = jest.fn(() => createMockGainNode());
      createOscillator = jest.fn(() => createMockOscillator());
      destination = {};
      connect = jest.fn();
      disconnect = jest.fn();
      close = jest.fn();
      resume = jest.fn(() => Promise.resolve());
    };
    globalThis.AudioContext = MockAC as unknown as typeof AudioContext;

    audioManager = new AudioManager();
  });

  /** 获取内部 AudioContext 实例（即构造函数创建的实例） */
  function getCtx(): any {
    return (audioManager as any).audioContext;
  }

  afterEach(() => {
    audioManager.destroy();
    globalThis.AudioContext = originalAudioContext;
    jest.useRealTimers();
  });

  // ─── 初始化 ───────────────────────────────────────────

  describe('初始化', () => {
    it('应该正确初始化音频上下文', () => {
      audioManager.init();

      expect(audioManager.isInitialized()).toBe(true);
      expect(getCtx()).toBeDefined();
      expect(getCtx().createGain).toBeDefined();
    });

    it('应该防止重复初始化', () => {
      audioManager.init();
      const ctx1 = getCtx();
      audioManager.init();
      const ctx2 = getCtx();

      // 同一个实例，没有重新创建
      expect(ctx1).toBe(ctx2);
    });

    it('初始化后状态应该正确', () => {
      audioManager.init();
      const state = audioManager.getState();

      expect(state.initialized).toBe(true);
      expect(state.muted).toBe(false);
      expect(state.bgmVolume).toBe(0.3);
      expect(state.sfxVolume).toBe(0.5);
      expect(state.bgmPlaying).toBe(false);
    });

    it('未初始化时状态应该正确', () => {
      const state = audioManager.getState();

      expect(state.initialized).toBe(false);
      expect(state.bgmPlaying).toBe(false);
    });
  });

  // ─── 音量控制 ───────────────────────────────────────────

  describe('音量控制', () => {
    beforeEach(() => {
      audioManager.init();
    });

    it('应该正确设置 BGM 音量', () => {
      audioManager.setBGMVolume(0.8);
      expect(audioManager.getState().bgmVolume).toBe(0.8);
    });

    it('应该正确设置 SFX 音量', () => {
      audioManager.setSFXVolume(0.7);
      expect(audioManager.getState().sfxVolume).toBe(0.7);
    });

    it('BGM 音量应该被限制在 0~1 范围', () => {
      audioManager.setBGMVolume(-0.5);
      expect(audioManager.getState().bgmVolume).toBe(0);

      audioManager.setBGMVolume(1.5);
      expect(audioManager.getState().bgmVolume).toBe(1);
    });

    it('SFX 音量应该被限制在 0~1 范围', () => {
      audioManager.setSFXVolume(-0.5);
      expect(audioManager.getState().sfxVolume).toBe(0);

      audioManager.setSFXVolume(1.5);
      expect(audioManager.getState().sfxVolume).toBe(1);
    });

    it('应该正确设置 BGM 音量为 0', () => {
      audioManager.setBGMVolume(0);
      expect(audioManager.getState().bgmVolume).toBe(0);
    });

    it('应该正确设置 SFX 音量为 1', () => {
      audioManager.setSFXVolume(1);
      expect(audioManager.getState().sfxVolume).toBe(1);
    });
  });

  // ─── 静音控制 ───────────────────────────────────────────

  describe('静音控制', () => {
    beforeEach(() => {
      audioManager.init();
    });

    it('应该正确设置静音', () => {
      audioManager.setMuted(true);
      expect(audioManager.isMuted()).toBe(true);
      expect(audioManager.getState().muted).toBe(true);
    });

    it('应该正确取消静音', () => {
      audioManager.setMuted(true);
      audioManager.setMuted(false);
      expect(audioManager.isMuted()).toBe(false);
    });

    it('toggleMute 应该正确切换状态', () => {
      const result1 = audioManager.toggleMute();
      expect(result1).toBe(true);
      expect(audioManager.isMuted()).toBe(true);

      const result2 = audioManager.toggleMute();
      expect(result2).toBe(false);
      expect(audioManager.isMuted()).toBe(false);
    });

    it('静音时 BGM 应该停止', () => {
      audioManager.playBGM();
      expect(audioManager.isBGMPlaying()).toBe(true);

      audioManager.setMuted(true);
      expect(audioManager.isBGMPlaying()).toBe(false);
    });
  });

  // ─── 背景音乐 ───────────────────────────────────────────

  describe('背景音乐', () => {
    beforeEach(() => {
      audioManager.init();
    });

    it('应该正确开始播放 BGM', () => {
      audioManager.playBGM();
      expect(audioManager.isBGMPlaying()).toBe(true);
    });

    it('不应该重复播放 BGM', () => {
      audioManager.playBGM();
      audioManager.playBGM();
      expect(audioManager.isBGMPlaying()).toBe(true);
    });

    it('应该正确停止 BGM', () => {
      audioManager.playBGM();
      audioManager.stopBGM();
      expect(audioManager.isBGMPlaying()).toBe(false);
    });

    it('未初始化时不应该播放 BGM', () => {
      const fresh = new AudioManager();
      fresh.playBGM();
      expect(fresh.isBGMPlaying()).toBe(false);
    });

    it('BGM 播放时应该创建振荡器', () => {
      audioManager.playBGM();
      const ctx = getCtx();
      // 旋律模式有 16 个音符，每个音符 2 个振荡器 = 32
      expect(ctx.createOscillator).toHaveBeenCalled();
      expect(ctx.createGain).toHaveBeenCalled();
    });

    it('BGM 应该循环播放', () => {
      audioManager.playBGM();
      const ctx = getCtx();

      // 前进一个循环周期
      jest.advanceTimersByTime(7000);

      // 应该再次调用 createOscillator（新的循环）
      const callCount = ctx.createOscillator.mock.calls.length;
      expect(callCount).toBeGreaterThan(16);
    });
  });

  // ─── 音效播放 ───────────────────────────────────────────

  describe('音效播放', () => {
    beforeEach(() => {
      audioManager.init();
    });

    it('playClick 应该创建振荡器', () => {
      audioManager.playClick();
      expect(getCtx().createOscillator).toHaveBeenCalled();
    });

    it('playUpgrade 应该创建多个振荡器（C-E-G 三音）', () => {
      audioManager.playUpgrade();
      // 3 个音符，每个 1 个振荡器
      expect(getCtx().createOscillator).toHaveBeenCalledTimes(3);
    });

    it('playBattle 应该创建振荡器', () => {
      audioManager.playBattle();
      // 低频 + 高频 = 2 个振荡器
      expect(getCtx().createOscillator).toHaveBeenCalledTimes(2);
    });

    it('playReward 应该创建振荡器', () => {
      audioManager.playReward();
      // 主音 + 泛音 = 2 个振荡器
      expect(getCtx().createOscillator).toHaveBeenCalledTimes(2);
    });

    it('playError 应该创建振荡器', () => {
      audioManager.playError();
      expect(getCtx().createOscillator).toHaveBeenCalledTimes(1);
    });

    it('playRecruit 应该创建振荡器', () => {
      audioManager.playRecruit();
      expect(getCtx().createOscillator).toHaveBeenCalledTimes(3);
    });

    it('playTechResearch 应该创建振荡器', () => {
      audioManager.playTechResearch();
      expect(getCtx().createOscillator).toHaveBeenCalledTimes(1);
    });

    it('playConquer 应该创建振荡器', () => {
      audioManager.playConquer();
      // 号角 + 和声 = 2 个振荡器
      expect(getCtx().createOscillator).toHaveBeenCalledTimes(2);
    });

    it('静音时不应该播放音效', () => {
      audioManager.setMuted(true);

      // 清空之前的调用记录
      getCtx().createOscillator.mockClear();

      audioManager.playClick();
      audioManager.playUpgrade();
      audioManager.playBattle();
      audioManager.playReward();
      audioManager.playError();

      expect(getCtx().createOscillator).not.toHaveBeenCalled();
    });

    it('未初始化时不应该播放音效', () => {
      const fresh = new AudioManager();
      // 不应该抛出错误
      expect(() => fresh.playClick()).not.toThrow();
      expect(() => fresh.playUpgrade()).not.toThrow();
      expect(() => fresh.playBattle()).not.toThrow();
    });
  });

  // ─── 销毁 ───────────────────────────────────────────

  describe('销毁', () => {
    it('应该正确销毁并清理资源', () => {
      audioManager.init();
      audioManager.playBGM();
      const ctx = getCtx();
      audioManager.destroy();

      expect(audioManager.isInitialized()).toBe(false);
      expect(audioManager.isBGMPlaying()).toBe(false);
      expect(ctx.close).toHaveBeenCalled();
    });

    it('销毁后不应该崩溃', () => {
      audioManager.init();
      audioManager.destroy();

      expect(() => audioManager.playClick()).not.toThrow();
      expect(() => audioManager.playBGM()).not.toThrow();
    });
  });

  // ─── resume ───────────────────────────────────────────

  describe('resume', () => {
    it('应该在 suspended 状态时调用 resume', async () => {
      audioManager.init();
      getCtx().state = 'suspended';

      await audioManager.resume();
      expect(getCtx().resume).toHaveBeenCalled();
    });

    it('应该在 running 状态时不调用 resume', async () => {
      audioManager.init();
      getCtx().state = 'running';

      await audioManager.resume();
      expect(getCtx().resume).not.toHaveBeenCalled();
    });

    it('未初始化时不应该崩溃', async () => {
      const fresh = new AudioManager();
      await expect(fresh.resume()).resolves.toBeUndefined();
    });
  });
});
