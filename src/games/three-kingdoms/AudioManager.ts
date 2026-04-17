/**
 * AudioManager — 三国霸业程序化音频管理器
 *
 * 使用 Web Audio API 程序化生成五声音阶（宫商角徵羽）BGM 和音效。
 * 不依赖外部音频文件，所有声音通过 OscillatorNode 实时合成。
 *
 * 功能：
 * - playBGM(name) — 播放背景音乐（五声音阶旋律循环）
 * - stopBGM() — 停止背景音乐
 * - playSFX(name) — 播放音效（click/build/battle/levelup/coin）
 * - setVolume(vol) — 设置主音量（0~1）
 * - toggleMute() — 静音切换
 *
 * @module games/three-kingdoms/AudioManager
 */

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

/** 中国五声音阶频率（宫 C4、商 D4、角 E4、徵 G4、羽 A4） */
const PENTATONIC_FREQS = [261.63, 293.66, 329.63, 392.00, 440.00];

/** 低八度五声音阶（用于 BGM 低音伴奏） */
const PENTATONIC_LOW = PENTATONIC_FREQS.map(f => f / 2);

/** 高八度五声音阶（用于旋律变化） */
const PENTATONIC_HIGH = PENTATONIC_FREQS.map(f => f * 2);

/** BGM 旋律模式预设 */
const MELODY_PATTERNS: Record<string, number[]> = {
  /** 平静旋律（适合主界面） */
  peaceful: [0, 2, 4, 3, 2, 0, 1, 2],
  /** 战斗旋律（适合战斗场景） */
  battle: [4, 3, 4, 2, 4, 3, 1, 0],
  /** 胜利旋律 */
  victory: [0, 1, 2, 4, 2, 4, 3, 4],
  /** 建设旋律 */
  building: [0, 2, 1, 3, 2, 4, 2, 1],
};

/** 音符持续时间范围（秒） */
const NOTE_DURATION_MIN = 0.25;
const NOTE_DURATION_MAX = 0.6;

/** BGM 音符间隔（秒） */
const BGM_NOTE_INTERVAL = 0.45;

/** BGM 循环间停顿（秒） */
const BGM_LOOP_PAUSE = 0.8;

/** 默认主音量 */
const DEFAULT_VOLUME = 0.5;

/** BGM 音量（相对主音量） */
const BGM_VOLUME_FACTOR = 0.3;

/** SFX 音量（相对主音量） */
const SFX_VOLUME_FACTOR = 0.7;

// ═══════════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════════

/** 音效名称 */
export type SFXName = 'click' | 'build' | 'battle' | 'levelup' | 'coin' | 'recruit';

/** BGM 名称 */
export type BGMName = 'peaceful' | 'battle' | 'victory' | 'building';

/** 音频管理器状态 */
export interface AudioManagerState {
  /** 是否已初始化 */
  initialized: boolean;
  /** 是否正在播放 BGM */
  bgmPlaying: boolean;
  /** 当前 BGM 名称 */
  currentBGM: string | null;
  /** 是否静音 */
  muted: boolean;
  /** 主音量（0~1） */
  volume: number;
}

// ═══════════════════════════════════════════════════════════════
// AudioManager
// ═══════════════════════════════════════════════════════════════

/**
 * 程序化音频管理器
 *
 * 使用 Web Audio API 实时合成五声音阶 BGM 和各种音效。
 * 所有音频通过 OscillatorNode + GainNode 生成，无需外部文件。
 */
export class AudioManager {
  // ─── Web Audio API ─────────────────────────────────────

  /** AudioContext 实例（延迟初始化，需要用户交互后才能创建） */
  private ctx: AudioContext | null = null;

  /** 主增益节点 */
  private masterGain: GainNode | null = null;

  /** BGM 增益节点 */
  private bgmGain: GainNode | null = null;

  /** SFX 增益节点 */
  private sfxGain: GainNode | null = null;

  // ─── BGM 状态 ──────────────────────────────────────────

  /** 当前 BGM 名称 */
  private currentBGM: BGMName | null = null;

  /** BGM 是否正在播放 */
  private bgmPlaying: boolean = false;

  /** BGM 定时器 ID */
  private bgmTimer: ReturnType<typeof setTimeout> | null = null;

  /** BGM 当前音符索引 */
  private bgmNoteIndex: number = 0;

  /** BGM 当前八度（0=低, 1=中, 2=高） */
  private bgmOctave: number = 1;

  /** BGM 活跃的 OscillatorNode（用于停止） */
  private bgmOscillators: Set<OscillatorNode> = new Set();

  // ─── 音量状态 ──────────────────────────────────────────

  /** 主音量 */
  private volume: number = DEFAULT_VOLUME;

  /** 是否静音 */
  private muted: boolean = false;

  /** 是否已初始化 */
  private initialized: boolean = false;

  // ═══════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════

  /**
   * 初始化 AudioContext
   *
   * 必须在用户交互（点击/触摸）后调用，否则浏览器会阻止 AudioContext 创建。
   * 多次调用安全（幂等）。
   */
  init(): void {
    if (this.initialized) return;

    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);

      // BGM 增益节点
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = BGM_VOLUME_FACTOR;
      this.bgmGain.connect(this.masterGain);

      // SFX 增益节点
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = SFX_VOLUME_FACTOR;
      this.sfxGain.connect(this.masterGain);

      this.initialized = true;
    } catch (e) {
      console.warn('[AudioManager] Failed to initialize AudioContext:', e);
    }
  }

  /**
   * 确保已初始化（内部使用）
   */
  private ensureInit(): boolean {
    if (!this.initialized) {
      this.init();
    }
    return this.initialized && this.ctx !== null;
  }

  // ═══════════════════════════════════════════════════════════
  // BGM 播放
  // ═══════════════════════════════════════════════════════════

  /**
   * 播放背景音乐
   *
   * 使用五声音阶程序化生成旋律，循环播放。
   * 不同名称对应不同的旋律模式。
   *
   * @param name - BGM 名称（peaceful/battle/victory/building）
   */
  playBGM(name: string): void {
    if (!this.ensureInit()) return;

    // 停止当前 BGM
    this.stopBGM();

    const bgmName = name as BGMName;
    this.currentBGM = bgmName;
    this.bgmPlaying = true;
    this.bgmNoteIndex = 0;
    this.bgmOctave = 1;

    // 开始播放旋律循环
    this.scheduleBGMNote();
  }

  /**
   * 停止背景音乐
   */
  stopBGM(): void {
    this.bgmPlaying = false;
    this.currentBGM = null;

    // 清除定时器
    if (this.bgmTimer !== null) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }

    // 停止所有活跃的 BGM 振荡器
    for (const osc of this.bgmOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // OscillatorNode 可能已经停止
      }
    }
    this.bgmOscillators.clear();
  }

  /**
   * 调度下一个 BGM 音符
   */
  private scheduleBGMNote(): void {
    if (!this.bgmPlaying || !this.ctx || !this.bgmGain) return;

    const pattern = MELODY_PATTERNS[this.currentBGM ?? 'peaceful'] ?? MELODY_PATTERNS.peaceful;
    const noteIndex = pattern[this.bgmNoteIndex % pattern.length];

    // 选择八度对应的频率数组
    const freqs = this.bgmOctave === 0 ? PENTATONIC_LOW
      : this.bgmOctave === 2 ? PENTATONIC_HIGH
      : PENTATONIC_FREQS;

    const freq = freqs[noteIndex] ?? PENTATONIC_FREQS[0];

    // 播放当前音符
    this.playTone(freq, BGM_NOTE_INTERVAL * 0.9, 'triangle', this.bgmGain);

    // 偶尔叠加低音伴奏
    if (this.bgmNoteIndex % 4 === 0) {
      const bassFreq = PENTATONIC_LOW[noteIndex] ?? PENTATONIC_LOW[0];
      this.playTone(bassFreq, BGM_NOTE_INTERVAL * 1.5, 'sine', this.bgmGain);
    }

    // 推进音符索引
    this.bgmNoteIndex++;

    // 每循环一次随机变化八度
    if (this.bgmNoteIndex % pattern.length === 0) {
      this.bgmOctave = Math.random() > 0.6 ? 2 : Math.random() > 0.3 ? 1 : 0;
    }

    // 调度下一个音符
    const interval = this.bgmNoteIndex % pattern.length === 0
      ? (BGM_NOTE_INTERVAL + BGM_LOOP_PAUSE) * 1000
      : BGM_NOTE_INTERVAL * 1000;

    this.bgmTimer = setTimeout(() => {
      this.scheduleBGMNote();
    }, interval);
  }

  // ═══════════════════════════════════════════════════════════
  // 音效播放
  // ═══════════════════════════════════════════════════════════

  /**
   * 播放音效
   *
   * @param name - 音效名称（click/build/battle/levelup/coin）
   */
  playSFX(name: string): void {
    if (!this.ensureInit() || !this.sfxGain) return;

    const sfxName = name as SFXName;
    switch (sfxName) {
      case 'click':
        this.playSFXClick();
        break;
      case 'build':
        this.playSFXBuild();
        break;
      case 'battle':
        this.playSFXBattle();
        break;
      case 'levelup':
        this.playSFXLevelUp();
        break;
      case 'coin':
        this.playSFXCoin();
        break;
      case 'recruit':
        this.playSFXRecruit();
        break;
      default:
        // 未知音效，播放默认点击音
        this.playSFXClick();
        break;
    }
  }

  /**
   * 点击音效 — 短促高频脉冲
   */
  private playSFXClick(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * 建造音效 — 上升音调
   */
  private playSFXBuild(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.2);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  /**
   * 战斗音效 — 噪声 + 低频冲击
   */
  private playSFXBattle(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // 低频冲击
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();

    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(80, now);
    bassOsc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

    bassGain.gain.setValueAtTime(0.4, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    bassOsc.connect(bassGain);
    bassGain.connect(this.sfxGain);

    bassOsc.start(now);
    bassOsc.stop(now + 0.35);

    // 高频噪声模拟
    const noiseOsc = this.ctx.createOscillator();
    const noiseGain = this.ctx.createGain();

    noiseOsc.type = 'square';
    noiseOsc.frequency.setValueAtTime(150, now);
    noiseOsc.frequency.setValueAtTime(300, now + 0.05);
    noiseOsc.frequency.setValueAtTime(100, now + 0.1);

    noiseGain.gain.setValueAtTime(0.15, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noiseOsc.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noiseOsc.start(now);
    noiseOsc.stop(now + 0.2);
  }

  /**
   * 升级音效 — 上升琶音（五声音阶）
   */
  private playSFXLevelUp(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // 五声音阶上升琶音
    const notes = [0, 1, 2, 3, 4]; // 宫商角徵羽
    const noteDuration = 0.08;
    const totalDuration = notes.length * noteDuration;

    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const startTime = now + i * noteDuration;
      const freq = PENTATONIC_FREQS[notes[i]];

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration * 1.5);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + noteDuration * 2);
    }

    // 最后一个高音延留
    const finalOsc = this.ctx.createOscillator();
    const finalGain = this.ctx.createGain();

    finalOsc.type = 'sine';
    finalOsc.frequency.setValueAtTime(PENTATONIC_HIGH[4], now + totalDuration);

    finalGain.gain.setValueAtTime(0, now + totalDuration);
    finalGain.gain.linearRampToValueAtTime(0.25, now + totalDuration + 0.02);
    finalGain.gain.exponentialRampToValueAtTime(0.001, now + totalDuration + 0.5);

    finalOsc.connect(finalGain);
    finalGain.connect(this.sfxGain);

    finalOsc.start(now + totalDuration);
    finalOsc.stop(now + totalDuration + 0.6);
  }

  /**
   * 金币音效 — 高频叮当
   */
  private playSFXCoin(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // 第一声叮
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1200, now);
    osc1.frequency.exponentialRampToValueAtTime(800, now + 0.1);

    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc1.connect(gain1);
    gain1.connect(this.sfxGain);

    osc1.start(now);
    osc1.stop(now + 0.2);

    // 第二声当（稍延迟）
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1600, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(1000, now + 0.18);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.25, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc2.connect(gain2);
    gain2.connect(this.sfxGain);

    osc2.start(now + 0.08);
    osc2.stop(now + 0.3);
  }

  /**
   * 招募音效 — 温暖和弦（C + E + G 三和弦）
   */
  private playSFXRecruit(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // C + E + G 三和弦
    const chordFreqs = [PENTATONIC_FREQS[0], PENTATONIC_FREQS[2], PENTATONIC_FREQS[3]];

    for (const freq of chordFreqs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.03);
      gain.gain.setValueAtTime(0.2, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.45);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 通用音调播放
  // ═══════════════════════════════════════════════════════════

  /**
   * 播放一个音调
   *
   * @param freq - 频率（Hz）
   * @param duration - 持续时间（秒）
   * @param type - 振荡器类型
   * @param targetGain - 目标增益节点
   */
  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType,
    targetGain: GainNode,
  ): void {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const clampedDuration = Math.max(0.05, Math.min(2.0, duration));

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    // ADSR 包络
    const attack = clampedDuration * 0.1;
    const decay = clampedDuration * 0.2;
    const sustain = 0.6; // sustain level
    const release = clampedDuration * 0.3;

    // Attack
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + attack);
    // Decay
    gain.gain.linearRampToValueAtTime(0.4 * sustain, now + attack + decay);
    // Sustain (hold)
    gain.gain.setValueAtTime(0.4 * sustain, now + clampedDuration - release);
    // Release
    gain.gain.exponentialRampToValueAtTime(0.001, now + clampedDuration);

    osc.connect(gain);
    gain.connect(targetGain);

    osc.start(now);
    osc.stop(now + clampedDuration + 0.05);

    // 追踪 BGM 振荡器（用于停止）
    if (targetGain === this.bgmGain) {
      this.bgmOscillators.add(osc);
      osc.onended = () => {
        this.bgmOscillators.delete(osc);
        osc.disconnect();
        gain.disconnect();
      };
    } else {
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 音量控制
  // ═══════════════════════════════════════════════════════════

  /**
   * 设置主音量
   *
   * @param vol - 音量值（0~1）
   */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.value = this.volume;
    }
  }

  /**
   * 切换静音
   *
   * @returns 切换后的静音状态
   */
  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
    return this.muted;
  }

  // ═══════════════════════════════════════════════════════════
  // 状态查询
  // ═══════════════════════════════════════════════════════════

  /**
   * 获取当前音频管理器状态
   */
  getState(): AudioManagerState {
    return {
      initialized: this.initialized,
      bgmPlaying: this.bgmPlaying,
      currentBGM: this.currentBGM,
      muted: this.muted,
      volume: this.volume,
    };
  }

  /**
   * 获取当前 BGM 名称
   */
  getCurrentBGM(): string | null {
    return this.currentBGM;
  }

  /**
   * 是否正在播放 BGM
   */
  isBGMPlaying(): boolean {
    return this.bgmPlaying;
  }

  /**
   * 是否静音
   */
  isMuted(): boolean {
    return this.muted;
  }

  /**
   * 获取当前音量
   */
  getVolume(): number {
    return this.volume;
  }

  // ═══════════════════════════════════════════════════════════
  // 序列化 / 反序列化
  // ═══════════════════════════════════════════════════════════

  /**
   * 序列化音频设置（用于存档）
   */
  serialize(): { muted: boolean; volume: number } {
    return {
      muted: this.muted,
      volume: this.volume,
    };
  }

  /**
   * 反序列化音频设置（用于读档）
   */
  deserialize(data: { muted?: boolean; volume?: number }): void {
    if (data.muted !== undefined) {
      this.muted = data.muted;
      if (this.masterGain) {
        this.masterGain.gain.value = this.muted ? 0 : this.volume;
      }
    }
    if (data.volume !== undefined) {
      this.setVolume(data.volume);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 清理
  // ═══════════════════════════════════════════════════════════

  /**
   * 销毁音频管理器，释放所有资源
   */
  destroy(): void {
    this.stopBGM();

    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }

    this.masterGain = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.initialized = false;
  }
}
