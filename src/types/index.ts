// ========== 游戏类型枚举 ==========
export enum GameType {
  TETRIS = 'tetris',
  SNAKE = 'snake',
  SOKOBAN = 'sokoban',
  FLAPPY_BIRD = 'flappy-bird',
  G2048 = 'g2048',
  MEMORY_MATCH = 'memory-match',
  TIC_TAC_TOE = 'tic-tac-toe',
  GAME_OF_LIFE = 'game-of-life',
  MINESWEEPER = 'minesweeper',
  GOMOKU = 'gomoku',
  DINO_RUNNER = 'dino-runner',
  TRON = 'tron',
  PIPE_MANIA = 'pipe-mania',
  BREAKOUT = 'breakout',
  PACMAN = 'pacman',
  SPACE_INVADERS = 'space-invaders',
  OTHELLO = 'othello',
  CHECKERS = 'checkers',
  PINBALL = 'pinball',
  MAHJONG_CONNECT = 'mahjong-connect',
  MATCH_3 = 'match-3',
  SUDOKU = 'sudoku',
  TETRIS_BATTLE = 'tetris-battle',
  FROGGER = 'frogger',
  PONG = 'pong',
  CONNECT_FOUR = 'connect-four',
  LIGHTS_OUT = 'lights-out',
  WHACK_A_MOLE = 'whack-a-mole',
  KLOTSKI = 'klotski',
  SOLITAIRE = 'solitaire',
  ASTEROIDS = 'asteroids',
  AIR_HOCKEY = 'air-hockey',
  FRUIT_NINJA = 'fruit-ninja',
  GALAGA = 'galaga',
  BUBBLE_SHOOTER = 'bubble-shooter',
  SNAKE_2P = 'snake-2p',
  MANCALA = 'mancala',
  EIGHT_QUEENS = 'eight-queens',
  CENTIPEDE = 'centipede',
  MISSILE_COMMAND = 'missile-command',
  LUNAR_LANDER = 'lunar-lander',
  SLIDER_PUZZLE = 'slider-puzzle',
  TOWER_OF_HANOI = 'tower-of-hanoi',
  DONKEY_KONG = 'donkey-kong',
  DIG_DUG = 'dig-dug',
  BATTLE_CITY = 'battle-city',
  MASTERMIND = 'mastermind',
  MAKE_24 = 'make-24',
  COOKIE_CLICKER = 'cookie-clicker',
  REACTION_TEST = 'reaction-test',
  ZUMA = 'zuma',
  PIXEL_ART = 'pixel-art',
  SPIROGRAPH = 'spirograph',
  WORDLE = 'wordle',
  GEOMETRY_DASH = 'geometry-dash',
  FALL_DOWN = 'fall-down',
  CAVE_FLYER = 'cave-flyer',
  GRAVITY_FLIP = 'gravity-flip',
  KNIGHTS_TOUR = 'knights-tour',
  VIRTUAL_PET = 'virtual-pet',
  ZTYPE = 'ztype',
  WATER_SORT = 'water-sort',
  SAND_SIMULATION = 'sand-simulation',
  SCREW_PUZZLE = 'screw-puzzle',
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
