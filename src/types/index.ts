// ========== 游戏类型枚举 ==========
export enum GameType {
  TETRIS = 'tetris',
  SNAKE = 'snake',
  SOKOBAN = 'sokoban',
}

// ========== 游戏状态枚举 ==========
export enum GameState {
  IDLE = 'idle',
  PLAYING = 'playing',
  PAUSED = 'paused',
  GAME_OVER = 'gameover',
}

// ========== 游戏状态类型 ==========
export type GameStatus = 'idle' | 'playing' | 'paused' | 'gameover';

// ========== 游戏元信息 ==========
export interface GameMeta {
  type: GameType;
  name: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
  controls: string;
  difficulty: '简单' | '中等' | '困难';
}

// ========== 游戏信息（精简版） ==========
export interface GameInfo {
  type: GameType;
  name: string;
  description: string;
  icon: string;
  color: string;
  controls: string;
  maxScore: number;
}

// ========== 游戏记录 ==========
export interface GameRecord {
  id: string;
  gameType: GameType;
  score: number;
  level: number;
  duration: number; // 秒
  date: string; // ISO string
  isWin: boolean;
  metadata?: Record<string, unknown>;
}

// ========== 最高分 ==========
export interface HighScore {
  gameType: GameType;
  score: number;
  date: string;
}

// ========== 排行榜条目 ==========
export interface LeaderboardEntry {
  rank: number;
  score: number;
  date: string;
  nickname?: string;
}

// ========== 收藏 ==========
export interface Favorite {
  gameType: GameType;
  addedAt: string;
}

// ========== 评论 ==========
export interface GameComment {
  id: string;
  gameType: GameType;
  nickname: string;
  content: string;
  rating: number; // 1-5
  date: string;
  likes: number;
}

// ========== 用户配置 ==========
export interface UserProfile {
  nickname: string;
  avatar: string;
  theme: 'dark' | 'light';
  soundEnabled: boolean;
  favoriteGames: GameType[];
}

// ========== 游戏引擎接口 ==========
export interface IGameEngine {
  score: number;
  level: number;
  status: GameStatus;
  init(canvas: HTMLCanvasElement): void;
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  destroy(): void;
  handleKeyDown(key: string): void;
  handleKeyUp(key: string): void;
  getState(): Record<string, unknown>;
}
