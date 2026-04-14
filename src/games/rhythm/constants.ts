// ========== 音乐节拍 Rhythm 游戏常量 ==========

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 轨道数量 */
export const LANE_COUNT = 4;

/** 轨道宽度 */
export const LANE_WIDTH = CANVAS_WIDTH / LANE_COUNT; // 120

/** 轨道对应的按键 */
export const LANE_KEYS = ['d', 'f', 'j', 'k'] as const;

/** 轨道颜色 */
export const LANE_COLORS = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff'] as const;

/** 音符高度 */
export const NOTE_HEIGHT = 20;

/** 音符宽度（比轨道窄一点） */
export const NOTE_WIDTH = LANE_WIDTH - 20; // 100

/** 判定线 Y 位置（屏幕下方约 80%） */
export const JUDGE_LINE_Y = Math.floor(CANVAS_HEIGHT * 0.8); // 512

/** 音符下落速度（像素/毫秒） */
export const NOTE_FALL_SPEED = 0.3; // px/ms → 300px/s

/** 判定窗口（毫秒） */
export const JUDGE_PERFECT_MS = 50;  // ±50ms
export const JUDGE_GREAT_MS = 100;   // ±100ms
export const JUDGE_GOOD_MS = 150;    // ±150ms

/** 判定对应分数 */
export const SCORE_PERFECT = 100;
export const SCORE_GREAT = 50;
export const SCORE_GOOD = 25;
export const SCORE_MISS = 0;

/** 判定文本 */
export const JUDGE_TEXT = {
  perfect: 'PERFECT',
  great: 'GREAT',
  good: 'GOOD',
  miss: 'MISS',
} as const;

/** 判定文本颜色 */
export const JUDGE_COLORS = {
  perfect: '#FFD700',
  great: '#00FF88',
  good: '#00BFFF',
  miss: '#FF4757',
} as const;

/** 连击倍率阈值 */
export const COMBO_MULTIPLIERS: readonly { min: number; multiplier: number }[] = [
  { min: 50, multiplier: 4 },
  { min: 30, multiplier: 3 },
  { min: 10, multiplier: 2 },
  { min: 0, multiplier: 1 },
] as const;

/** 初始健康值 */
export const INITIAL_HEALTH = 100;

/** Miss 扣减的健康值 */
export const MISS_HEALTH_PENALTY = 10;

/** Good 回复的健康值 */
export const GOOD_HEALTH_RECOVER = 1;

/** Great 回复的健康值 */
export const GREAT_HEALTH_RECOVER = 3;

/** Perfect 回复的健康值 */
export const PERFECT_HEALTH_RECOVER = 5;

/** 最大健康值 */
export const MAX_HEALTH = 100;

/** 判定反馈显示持续时间（毫秒） */
export const JUDGE_FEEDBACK_DURATION = 500;

/** 音符提前生成的时间（毫秒），即音符从顶部到判定线的时间 */
export const NOTE_TRAVEL_TIME = JUDGE_LINE_Y / NOTE_FALL_SPEED; // ~1707ms

/** 节拍图类型 */
export interface BeatmapNote {
  /** 音符出现的时间（毫秒，相对于游戏开始） */
  time: number;
  /** 轨道索引 (0-3) */
  lane: number;
}

export interface Beatmap {
  name: string;
  bpm: number;
  notes: BeatmapNote[];
}

/** 预设节拍图 */
export const BEATMAPS: Beatmap[] = [
  {
    name: 'Easy Beat',
    bpm: 120,
    notes: [
      // 简单节拍：每拍一个音符
      { time: 2000, lane: 0 },
      { time: 2500, lane: 1 },
      { time: 3000, lane: 2 },
      { time: 3500, lane: 3 },
      { time: 4000, lane: 0 },
      { time: 4500, lane: 1 },
      { time: 5000, lane: 2 },
      { time: 5500, lane: 3 },
      { time: 6000, lane: 3 },
      { time: 6500, lane: 2 },
      { time: 7000, lane: 1 },
      { time: 7500, lane: 0 },
      { time: 8000, lane: 1 },
      { time: 8500, lane: 2 },
      { time: 9000, lane: 3 },
      { time: 9500, lane: 0 },
    ],
  },
  {
    name: 'Normal Flow',
    bpm: 140,
    notes: [
      // 中等难度：更密集的音符
      { time: 2000, lane: 0 },
      { time: 2143, lane: 1 },
      { time: 2286, lane: 2 },
      { time: 2429, lane: 3 },
      { time: 2571, lane: 2 },
      { time: 2714, lane: 1 },
      { time: 2857, lane: 0 },
      { time: 3000, lane: 1 },
      { time: 3143, lane: 3 },
      { time: 3286, lane: 1 },
      { time: 3429, lane: 2 },
      { time: 3571, lane: 0 },
      { time: 3714, lane: 3 },
      { time: 3857, lane: 2 },
      { time: 4000, lane: 1 },
      { time: 4143, lane: 0 },
      { time: 4286, lane: 3 },
      { time: 4429, lane: 2 },
      { time: 4571, lane: 1 },
      { time: 4714, lane: 0 },
      { time: 4857, lane: 3 },
      { time: 5000, lane: 0 },
      { time: 5143, lane: 1 },
      { time: 5286, lane: 2 },
      { time: 5429, lane: 3 },
    ],
  },
  {
    name: 'Hard Rush',
    bpm: 160,
    notes: [
      // 高难度：快速密集音符
      { time: 1500, lane: 0 },
      { time: 1500, lane: 3 },
      { time: 1875, lane: 1 },
      { time: 1875, lane: 2 },
      { time: 2250, lane: 0 },
      { time: 2250, lane: 3 },
      { time: 2625, lane: 1 },
      { time: 2625, lane: 2 },
      { time: 3000, lane: 0 },
      { time: 3188, lane: 1 },
      { time: 3375, lane: 2 },
      { time: 3563, lane: 3 },
      { time: 3750, lane: 0 },
      { time: 3750, lane: 1 },
      { time: 3938, lane: 2 },
      { time: 3938, lane: 3 },
      { time: 4125, lane: 0 },
      { time: 4125, lane: 2 },
      { time: 4313, lane: 1 },
      { time: 4313, lane: 3 },
      { time: 4500, lane: 0 },
      { time: 4500, lane: 1 },
      { time: 4500, lane: 2 },
      { time: 4500, lane: 3 },
      { time: 4875, lane: 3 },
      { time: 4875, lane: 0 },
      { time: 5250, lane: 1 },
      { time: 5250, lane: 2 },
      { time: 5625, lane: 0 },
      { time: 5625, lane: 3 },
      { time: 6000, lane: 1 },
      { time: 6000, lane: 2 },
    ],
  },
];

/** 判定结果类型 */
export type JudgeResult = 'perfect' | 'great' | 'good' | 'miss';

/** 活跃音符（运行时状态） */
export interface ActiveNote {
  /** 原始节拍图音符引用 */
  id: number;
  /** 轨道 */
  lane: number;
  /** 目标时间（应该到达判定线的时间） */
  targetTime: number;
  /** 当前 Y 位置 */
  y: number;
  /** 是否已被判定 */
  judged: boolean;
  /** 判定结果 */
  result?: JudgeResult;
}

/** 判定反馈（显示用） */
export interface JudgeFeedback {
  result: JudgeResult;
  lane: number;
  timestamp: number;
}

/** 游戏状态 */
export interface RhythmGameState {
  [key: string]: unknown;
  score: number;
  combo: number;
  maxCombo: number;
  health: number;
  judgeCounts: Record<JudgeResult, number>;
  isFinished: boolean;
  isWin: boolean;
}
