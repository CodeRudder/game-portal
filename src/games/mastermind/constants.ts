// ========== Mastermind 猜数字常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 游戏核心 ==========
export const DEFAULT_CODE_LENGTH = 4;       // 默认密码位数
export const COLOR_COUNT = 6;               // 可用颜色数
export const MAX_GUESSES = 10;              // 最大猜测次数

// ========== 难度等级 ==========
export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY_CONFIG: Record<Difficulty, { codeLength: number; label: string }> = {
  easy:   { codeLength: 4, label: '简单 (4位)' },
  normal: { codeLength: 5, label: '普通 (5位)' },
  hard:   { codeLength: 6, label: '困难 (6位)' },
};

// ========== 颜色 ==========
export const PEG_COLORS: string[] = [
  '#f44336', // 1 - 红色
  '#2196f3', // 2 - 蓝色
  '#4caf50', // 3 - 绿色
  '#ffc107', // 4 - 黄色
  '#9c27b0', // 5 - 紫色
  '#ff9800', // 6 - 橙色
];

export const PEG_BORDER_COLORS: string[] = [
  '#c62828',
  '#1565c0',
  '#2e7d32',
  '#f9a825',
  '#6a1b9a',
  '#e65100',
];

export const FEEDBACK_A_COLOR = '#ffffff';  // A 指示器颜色（白色）
export const FEEDBACK_B_COLOR = '#bdbdbd';  // B 指示器颜色（灰色）

// ========== 布局 ==========
export const PEG_RADIUS = 18;               // 密码珠半径
export const PEG_SPACING = 52;              // 密码珠间距
export const FEEDBACK_RADIUS = 6;           // 反馈指示器半径
export const ROW_HEIGHT = 48;               // 每行高度
export const ROW_SPACING = 4;               // 行间距
export const INPUT_ROW_Y = 560;             // 输入行 Y 坐标
export const GUESS_START_Y = 80;            // 猜测区域起始 Y
export const HUD_HEIGHT = 60;               // HUD 区域高度

// ========== 分数 ==========
export const BASE_SCORE = 1000;             // 基础分
export const GUESS_PENALTY = 100;           // 每次猜测扣分
export const PERFECT_BONUS = 500;           // 一次猜对奖励

// ========== 颜色名称（用于显示）==========
export const COLOR_NAMES: string[] = [
  '红', '蓝', '绿', '黄', '紫', '橙',
];

// ========== 背景与 UI ==========
export const BG_COLOR = '#1a1a2e';
export const BOARD_COLOR = '#16213e';
export const TEXT_COLOR = '#e0e0e0';
export const HIGHLIGHT_COLOR = '#0f3460';
export const EMPTY_PEG_COLOR = '#2a2a4a';
export const EMPTY_PEG_BORDER = '#3a3a5a';
export const CURSOR_COLOR = '#ffd600';
