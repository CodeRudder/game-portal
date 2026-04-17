/**
 * AudioManager — 程序化音频管理器
 *
 * 使用 Web Audio API 生成所有音效和背景音乐，无需外部音频文件。
 *
 * 音效列表：
 * - 背景音乐：五声音阶（宫商角徵羽 C-D-E-G-A）循环旋律
 * - 点击音效：短促正弦波下滑（200ms）
 * - 升级音效：上行音阶 C-E-G（300ms）
 * - 战斗音效：噪声+低频震动（200ms）
 * - 奖励音效：叮铃声（高频正弦波，500ms）
 * - 错误音效：低频嗡嗡声（200ms）
 *
 * @module games/idle-subsystems/AudioManager
 */

// ═══════════════════════════════════════════════════════════════
// 配置常量
// ═══════════════════════════════════════════════════════════════

/** 五声音阶频率（C4-D4-E4-G4-A4-C5-D5-E5） */
const PENTATONIC_SCALE = [
  261.63, // C4 宫
  293.66, // D4 商
  329.63, // E4 角
  392.00, // G4 徵
  440.00, // A4 羽
  523.25, // C5 宫（高八度）
  587.33, // D5 商（高八度）
  659.25, // E5 角（高八度）
];

/** BGM 旋律模式：索引到五声音阶 */
const BGM_MELODY_PATTERN = [0, 2, 4, 3, 2, 1, 0, 3, 4, 2, 1, 0, 4, 3, 2, 1];

/** BGM 每个音符时长（秒） */
const BGM_NOTE_DURATION = 0.4;

/** BGM 循环间隔（毫秒） */
const BGM_LOOP_INTERVAL = BGM_MELODY_PATTERN.length * BGM_NOTE_DURATION * 1000;

/** 默认 BGM 音量 */
const DEFAULT_BGM_VOLUME = 0.3;

/** 默认音效音量 */
const DEFAULT_SFX_VOLUME = 0.5;

// ═══════════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════════

/** 音频管理器状态 */
export interface AudioState {
  /** 是否已初始化 */
  initialized: boolean;
  /** 是否静音 */
  muted: boolean;
  /** BGM 音量 0~1 */
  bgmVolume: number;
  /** SFX 音量 0~1 */
  sfxVolume: number;
  /** BGM 是否正在播放 */
  bgmPlaying: boolean;
}

// ═══════════════════════════════════════════════════════════════
// AudioManager
// ═══════════════════════════════════════════════════════════════

/**
 * 音频管理器
 *
 * 使用 Web Audio API 程序化生成所有音频。
 * 不依赖任何外部音频文件，所有声音通过 OscillatorNode 合成。
 *
 * 注意：AudioContext 需要在用户交互（click/touch）后才能创建/resume，
 * 这是浏览器的安全策略。调用 init() 应在用户点击事件处理函数中。
 */
export class AudioManager {
  private audioContext: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private bgmPlaying: boolean = false;
  private muted: boolean = false;
  private bgmVolume: number = DEFAULT_BGM_VOLUME;
  private sfxVolume: number = DEFAULT_SFX_VOLUME;
  private bgmTimer: ReturnType<typeof setInterval> | null = null;
  private currentBgmOscillators: OscillatorNode[] = [];

  // ─── 生命周期 ───────────────────────────────────────────

  constructor() {}

  /**
   * 初始化音频上下文
   *
   * 必须在用户交互（click/touchstart）后调用。
   * 创建 AudioContext、主增益节点、BGM/SFX 增益节点。
   */
  init(): void {
    if (this.audioContext) return; // 防止重复初始化

    this.audioContext = new AudioContext();

    // 主增益节点
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.audioContext.destination);

    // BGM 增益节点
    this.bgmGain = this.audioContext.createGain();
    this.bgmGain.gain.value = this.bgmVolume;
    this.bgmGain.connect(this.masterGain);

    // SFX 增益节点
    this.sfxGain = this.audioContext.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.masterGain);
  }

  /**
   * 恢复被浏览器暂停的 AudioContext
   *
   * 某些浏览器在用户交互后需要显式 resume。
   */
  async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * 销毁音频管理器，释放所有资源
   */
  destroy(): void {
    this.stopBGM();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.bgmGain = null;
    this.sfxGain = null;
    this.masterGain = null;
  }

  // ─── 背景音乐 ───────────────────────────────────────────

  /**
   * 播放背景音乐（程序化生成的五声音阶旋律）
   *
   * 使用正弦波 + 三角波叠加，循环播放五声音阶旋律。
   */
  playBGM(): void {
    if (!this.audioContext || this.bgmPlaying) return;
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    this.bgmPlaying = true;
    this.playPentatonicMelodyLoop();
  }

  /**
   * 停止背景音乐
   */
  stopBGM(): void {
    this.bgmPlaying = false;
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    // 停止当前所有 BGM 振荡器
    for (const osc of this.currentBgmOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // 振荡器可能已停止
      }
    }
    this.currentBgmOscillators = [];
  }

  // ─── 音效播放 ───────────────────────────────────────────

  /**
   * 播放点击音效
   *
   * 短促的正弦波，频率从 800Hz 下滑到 600Hz，持续 200ms。
   */
  playClick(): void {
    if (!this.audioContext || this.muted || !this.sfxGain) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.2);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * 播放建筑升级音效
   *
   * 上行音阶 C-E-G，每个音符 100ms，共 300ms。
   */
  playUpgrade(): void {
    if (!this.audioContext || this.muted || !this.sfxGain) return;
    const ctx = this.audioContext;
    const sfxGain = this.sfxGain;
    const now = ctx.currentTime;

    const notes = [261.63, 329.63, 392.00]; // C4, E4, G4
    const noteDuration = 0.1;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * noteDuration);

      gain.gain.setValueAtTime(0.3, now + i * noteDuration);
      gain.gain.exponentialRampToValueAtTime(0.01, now + (i + 1) * noteDuration);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now + i * noteDuration);
      osc.stop(now + (i + 1) * noteDuration);
    });
  }

  /**
   * 播放战斗音效
   *
   * 噪声（通过高频振荡器模拟）+ 低频震动，持续 200ms。
   */
  playBattle(): void {
    if (!this.audioContext || this.muted || !this.sfxGain) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // 低频震动
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(80, now);
    bassOsc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    bassGain.gain.setValueAtTime(0.25, now);
    bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    bassOsc.connect(bassGain);
    bassGain.connect(this.sfxGain);
    bassOsc.start(now);
    bassOsc.stop(now + 0.2);

    // 高频噪声模拟
    const noiseOsc = ctx.createOscillator();
    const noiseGain = ctx.createGain();
    noiseOsc.type = 'square';
    noiseOsc.frequency.setValueAtTime(2000, now);
    noiseOsc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
    noiseGain.gain.setValueAtTime(0.1, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    noiseOsc.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noiseOsc.start(now);
    noiseOsc.stop(now + 0.15);
  }

  /**
   * 播放获得奖励音效
   *
   * 叮铃声，高频正弦波，持续 500ms。
   */
  playReward(): void {
    if (!this.audioContext || this.muted || !this.sfxGain) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // 主音
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1200, now);
    osc1.frequency.exponentialRampToValueAtTime(800, now + 0.5);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // 泛音
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2400, now);
    osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.3);
    gain2.gain.setValueAtTime(0.1, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now);
    osc2.stop(now + 0.3);
  }

  /**
   * 播放错误音效
   *
   * 低频嗡嗡声，200Hz，持续 200ms。
   */
  playError(): void {
    if (!this.audioContext || this.muted || !this.sfxGain) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * 播放武将招募音效
   *
   * 明亮的号角声，上行 C5-E5-G5，持续 400ms。
   */
  playRecruit(): void {
    if (!this.audioContext || this.muted || !this.sfxGain) return;
    const ctx = this.audioContext;
    const sfxGain = this.sfxGain;
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const noteDuration = 0.13;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * noteDuration);
      gain.gain.setValueAtTime(0.25, now + i * noteDuration);
      gain.gain.exponentialRampToValueAtTime(0.01, now + (i + 1) * noteDuration + 0.05);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now + i * noteDuration);
      osc.stop(now + (i + 1) * noteDuration + 0.05);
    });
  }

  /**
   * 播放科技研究音效
   *
   * 神秘的电子音，持续 350ms。
   */
  playTechResearch(): void {
    if (!this.audioContext || this.muted || !this.sfxGain) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.35);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * 播放领土征服音效
   *
   * 凯旋号角，持续 500ms。
   */
  playConquer(): void {
    if (!this.audioContext || this.muted || !this.sfxGain) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // 号角音
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(330, now);
    osc1.frequency.setValueAtTime(392, now + 0.15);
    osc1.frequency.setValueAtTime(523, now + 0.3);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.setValueAtTime(0.15, now + 0.35);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // 和声
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(165, now);
    osc2.frequency.setValueAtTime(196, now + 0.15);
    osc2.frequency.setValueAtTime(262, now + 0.3);
    gain2.gain.setValueAtTime(0.1, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now);
    osc2.stop(now + 0.5);
  }

  // ─── 控制接口 ───────────────────────────────────────────

  /**
   * 设置静音
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
    // 静音时通过主增益节点控制
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 1;
    }
    // BGM 在静音时也停止播放以节省资源
    if (muted && this.bgmPlaying) {
      this.stopBGM();
    }
  }

  /**
   * 切换静音状态
   * @returns 新的静音状态
   */
  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * 设置 BGM 音量
   * @param volume - 0~1 之间的音量值
   */
  setBGMVolume(volume: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.bgmGain) {
      this.bgmGain.gain.value = this.bgmVolume;
    }
  }

  /**
   * 设置 SFX 音量
   * @param volume - 0~1 之间的音量值
   */
  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.sfxVolume;
    }
  }

  // ─── 状态查询 ───────────────────────────────────────────

  /**
   * 获取当前音频状态
   */
  getState(): AudioState {
    return {
      initialized: this.audioContext !== null,
      muted: this.muted,
      bgmVolume: this.bgmVolume,
      sfxVolume: this.sfxVolume,
      bgmPlaying: this.bgmPlaying,
    };
  }

  /**
   * 是否已初始化
   */
  isInitialized(): boolean {
    return this.audioContext !== null;
  }

  /**
   * 是否静音
   */
  isMuted(): boolean {
    return this.muted;
  }

  /**
   * BGM 是否正在播放
   */
  isBGMPlaying(): boolean {
    return this.bgmPlaying;
  }

  // ─── 内部方法 ───────────────────────────────────────────

  /**
   * 播放单次五声音阶旋律
   */
  private playPentatonicMelody(): void {
    if (!this.audioContext || !this.bgmGain) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // 清理旧的振荡器引用
    this.currentBgmOscillators = [];

    BGM_MELODY_PATTERN.forEach((noteIdx, i) => {
      const freq = PENTATONIC_SCALE[noteIdx % PENTATONIC_SCALE.length];
      const startTime = now + i * BGM_NOTE_DURATION;

      // 正弦波主旋律
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, startTime);
      gain1.gain.setValueAtTime(0.15, startTime);
      gain1.gain.setValueAtTime(0.15, startTime + BGM_NOTE_DURATION * 0.8);
      gain1.gain.exponentialRampToValueAtTime(0.01, startTime + BGM_NOTE_DURATION);
      osc1.connect(gain1);
      gain1.connect(this.bgmGain!);
      osc1.start(startTime);
      osc1.stop(startTime + BGM_NOTE_DURATION);
      this.currentBgmOscillators.push(osc1);

      // 三角波泛音（低八度，轻柔）
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq / 2, startTime);
      gain2.gain.setValueAtTime(0.05, startTime);
      gain2.gain.setValueAtTime(0.05, startTime + BGM_NOTE_DURATION * 0.8);
      gain2.gain.exponentialRampToValueAtTime(0.01, startTime + BGM_NOTE_DURATION);
      osc2.connect(gain2);
      gain2.connect(this.bgmGain!);
      osc2.start(startTime);
      osc2.stop(startTime + BGM_NOTE_DURATION);
      this.currentBgmOscillators.push(osc2);
    });
  }

  /**
   * 循环播放五声音阶旋律
   */
  private playPentatonicMelodyLoop(): void {
    if (!this.bgmPlaying) return;

    this.playPentatonicMelody();

    // 设定定时器循环播放
    this.bgmTimer = setInterval(() => {
      if (this.bgmPlaying) {
        this.playPentatonicMelody();
      }
    }, BGM_LOOP_INTERVAL);
  }
}
