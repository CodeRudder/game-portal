import {
  GameType,
  GameRecord,
  HighScore,
  Favorite,
  GameComment,
  UserProfile,
  GameMeta,
} from '@/types';

// ========== 游戏元信息 ==========
export const GAME_META: Record<GameType, GameMeta> = {
  [GameType.TETRIS]: {
    type: GameType.TETRIS,
    name: '俄罗斯方块',
    description: '经典俄罗斯方块，消除行数越多分数越高！支持加速下落、硬降等操作。',
    icon: '🧱',
    color: '#6c5ce7',
    gradient: 'from-purple-600 to-blue-500',
    controls: '← → 移动 | ↑ 旋转 | ↓ 加速 | 空格 硬降 | P 暂停',
    difficulty: '中等',
  },
  [GameType.SNAKE]: {
    type: GameType.SNAKE,
    name: '贪吃蛇',
    description: '控制小蛇吃食物，越长越难操控！碰到墙壁或自己就Game Over。',
    icon: '🐍',
    color: '#00b894',
    gradient: 'from-green-500 to-emerald-400',
    controls: '方向键 / WASD 控制方向 | P 暂停',
    difficulty: '简单',
  },
  [GameType.SOKOBAN]: {
    type: GameType.SOKOBAN,
    name: '推箱子',
    description: '经典益智游戏，把所有箱子推到目标位置即可过关。考验逻辑思维！',
    icon: '📦',
    color: '#e17055',
    gradient: 'from-orange-500 to-red-400',
    controls: '方向键 / WASD 移动 | R 重置关卡 | Z 撤销',
    difficulty: '困难',
  },
  [GameType.FLAPPY_BIRD]: {
    type: GameType.FLAPPY_BIRD,
    name: 'Flappy Bird',
    description: '点击屏幕让小鸟跳跃，穿越管道间的缝隙。看似简单，实则极具挑战！',
    icon: '🐦',
    color: '#ffd32a',
    gradient: 'from-yellow-400 to-orange-400',
    controls: '点击屏幕 / 空格 / ↑ 跳跃 | 穿越管道得分',
    difficulty: '困难',
  },
  [GameType.G2048]: {
    type: GameType.G2048,
    name: '2048',
    description: '滑动合并数字方块，挑战达到 2048！简单规则，无限策略。',
    icon: '🎯',
    color: '#f59e0b',
    gradient: 'from-amber-500 to-orange-400',
    controls: '方向键 / WASD 滑动 | 合并相同数字',
    difficulty: '中等',
  },
  [GameType.MEMORY_MATCH]: {
    type: GameType.MEMORY_MATCH,
    name: '记忆翻牌',
    description: '翻开卡牌寻找配对，考验你的记忆力！配对越快分数越高。',
    icon: '🃏',
    color: '#ec4899',
    gradient: 'from-pink-500 to-purple-500',
    controls: '方向键导航 + 空格/回车翻牌 | 鼠标点击',
    difficulty: '简单',
  },
  [GameType.TIC_TAC_TOE]: {
    type: GameType.TIC_TAC_TOE,
    name: '井字棋',
    description: '经典双人对战棋，三子连线即胜！支持 AI 对手模式。',
    icon: '⭕',
    color: '#38bdf8',
    gradient: 'from-sky-500 to-blue-500',
    controls: '方向键移动光标 + 空格/回车落子 | R 重开 | P 暂停',
    difficulty: '简单',
  },
  [GameType.GAME_OF_LIFE]: {
    type: GameType.GAME_OF_LIFE,
    name: '生命游戏',
    description: 'Conway 生命游戏 — 经典细胞自动机！放置初始细胞，观察生命的演化与涌现。',
    icon: '🧬',
    color: '#00ff88',
    gradient: 'from-green-400 to-emerald-500',
    controls: '点击放置细胞 | 空格 开始/暂停 | N 单步 | +/- 调速 | 1-9 预设图案',
    difficulty: '简单',
  },
  [GameType.MINESWEEPER]: {
    type: GameType.MINESWEEPER,
    name: '扫雷',
    description: '经典扫雷游戏，根据数字线索推理出所有地雷的位置。支持三种难度！',
    icon: '💣',
    color: '#94a3b8',
    gradient: 'from-gray-500 to-slate-500',
    controls: '点击揭开 · 右键标旗 · 方向键移动光标 · F 标旗 · 1/2/3 切换难度',
    difficulty: '中等',
  },
  [GameType.GOMOKU]: {
    type: GameType.GOMOKU,
    name: '五子棋',
    description: '15×15 棋盘上先连成五子者胜！支持人机对战和双人对弈。',
    icon: '⚫',
    color: '#8b5cf6',
    gradient: 'from-violet-500 to-purple-500',
    controls: '点击/方向键落子 · T 切换模式 · R 重开',
    difficulty: '中等',
  },
  [GameType.DINO_RUNNER]: {
    type: GameType.DINO_RUNNER,
    name: '跑酷恐龙',
    description: 'Chrome 经典离线恐龙跑酷！跳跃躲避仙人掌和翼龙，速度越来越快。',
    icon: '🦖',
    color: '#34d399',
    gradient: 'from-emerald-400 to-teal-400',
    controls: '空格/↑ 跳跃 · ↓ 下蹲 · 点击屏幕跳跃',
    difficulty: '简单',
  },
  [GameType.TRON]: {
    type: GameType.TRON,
    name: '贪吃虫 Tron',
    description: '双人光线对抗！各自控制一条光线，碰到墙壁或轨迹就输。支持 AI 模式。',
    icon: '⚡',
    color: '#a3e635',
    gradient: 'from-lime-400 to-green-400',
    controls: '玩家1 WASD · 玩家2 方向键 · 碰墙或轨迹即输',
    difficulty: '中等',
  },
  [GameType.PIPE_MANIA]: {
    type: GameType.PIPE_MANIA,
    name: '接水管',
    description: '放置管道连接水源到出口，让水流通过尽可能长的管道！',
    icon: '🔧',
    color: '#60a5fa',
    gradient: 'from-blue-400 to-cyan-400',
    controls: '点击网格放置管道 · 空格跳过 · 倒计时结束后开始流水',
    difficulty: '中等',
  },
  [GameType.BREAKOUT]: {
    type: GameType.BREAKOUT,
    name: '打砖块',
    description: '控制挡板反弹球击碎砖块，不同颜色不同分数，挑战你的反应速度！',
    icon: '🧱',
    color: '#f97316',
    gradient: 'from-orange-400 to-red-400',
    controls: '← → 移动挡板 · 空格发射球',
    difficulty: '中等',
  },
  [GameType.PACMAN]: {
    type: GameType.PACMAN,
    name: '吃豆人',
    description: '经典吃豆人，在迷宫中吃掉所有豆子，躲避幽灵追击！',
    icon: '🟡',
    color: '#facc15',
    gradient: 'from-yellow-400 to-amber-400',
    controls: '方向键/WASD 移动 · 吃大力丸反击幽灵',
    difficulty: '中等',
  },
  [GameType.SPACE_INVADERS]: {
    type: GameType.SPACE_INVADERS,
    name: '太空射击',
    description: '驾驶飞船消灭外星人阵列，保护掩体，拯救地球！',
    icon: '🚀',
    color: '#22d3ee',
    gradient: 'from-cyan-400 to-purple-400',
    controls: '← → 移动飞船 · 空格发射子弹',
    difficulty: '中等',
  },
  [GameType.OTHELLO]: {
    type: GameType.OTHELLO,
    name: '黑白棋',
    description: '经典翻转棋，落子翻转对手棋子，占据更多格子获胜！',
    icon: '⚫',
    color: '#22c55e',
    gradient: 'from-green-400 to-emerald-400',
    controls: '点击棋盘落子 · AI 自动对弈',
    difficulty: '中等',
  },
  [GameType.CHECKERS]: {
    type: GameType.CHECKERS,
    name: '跳棋',
    description: '经典西洋跳棋，吃子升王，策略对弈！',
    icon: '🟤',
    color: '#f59e0b',
    gradient: 'from-amber-400 to-orange-400',
    controls: '点击选子 · 点击落子',
    difficulty: '中等',
  },
  [GameType.PINBALL]: {
    type: GameType.PINBALL,
    name: '弹珠台',
    description: '经典弹珠台，控制挡板弹射弹珠，碰撞bumper得分！',
    icon: '🎰',
    color: '#a855f7',
    gradient: 'from-purple-500 to-pink-500',
    controls: 'Z/← 左挡板 · →/M 右挡板 · 空格 蓄力发射',
    difficulty: '中等',
  },
  [GameType.MAHJONG_CONNECT]: {
    type: GameType.MAHJONG_CONNECT,
    name: '连连看',
    description: '找到相同图案的牌面，通过不超过2个拐弯的路径连接消除！',
    icon: '🀄',
    color: '#14b8a6',
    gradient: 'from-teal-500 to-cyan-500',
    controls: '点击选牌配对 · H 提示 · S 洗牌',
    difficulty: '中等',
  },
  [GameType.MATCH_3]: {
    type: GameType.MATCH_3,
    name: '消消乐',
    description: '交换相邻宝石，三连消除得分，连锁反应获得更高倍率！',
    icon: '💎',
    color: '#f59e0b',
    gradient: 'from-amber-500 to-yellow-400',
    controls: '点击交换宝石 · 方向键移动+空格选择',
    difficulty: '简单',
  },
  [GameType.SUDOKU]: {
    type: GameType.SUDOKU,
    name: '数独',
    description: '经典数字推理，每行每列每宫1-9不重复，三种难度挑战！',
    icon: '🔢',
    color: '#3b82f6',
    gradient: 'from-blue-500 to-indigo-500',
    controls: '方向键移动 · 1-9 输入 · N 笔记 · H 提示 · Z 撤销',
    difficulty: '中等',
  },
  [GameType.TETRIS_BATTLE]: {
    type: GameType.TETRIS_BATTLE,
    name: '方块对战',
    description: '俄罗斯方块双人对战！消行攻击对手，AI对手等你挑战！',
    icon: '⚔️',
    color: '#ef4444',
    gradient: 'from-red-500 to-orange-500',
    controls: 'WASD/方向键 · 空格 硬降 · Q 旋转',
    difficulty: '困难',
  },
  [GameType.FROGGER]: {
    type: GameType.FROGGER,
    name: '青蛙过河',
    description: '控制小青蛙穿越车流和河流，安全到达对岸！经典街机重现。',
    icon: '🐸',
    color: '#22c55e',
    gradient: 'from-green-500 to-lime-400',
    controls: '↑↓←→ / WASD 移动 · 穿越车流到达对岸',
    difficulty: '中等',
  },
  [GameType.PONG]: {
    type: GameType.PONG,
    name: '乒乓球',
    description: '经典乒乓对战！控制挡板反弹球，先得7分获胜，支持AI对手。',
    icon: '🏓',
    color: '#06b6d4',
    gradient: 'from-cyan-500 to-blue-500',
    controls: '↑↓ / WS 控制挡板 · 先得7分获胜',
    difficulty: '简单',
  },
  [GameType.CONNECT_FOUR]: {
    type: GameType.CONNECT_FOUR,
    name: '四子棋',
    description: '双人对战策略棋！选择列落子，先连成四子者获胜，支持AI。',
    icon: '🔴',
    color: '#eab308',
    gradient: 'from-yellow-500 to-red-500',
    controls: '←→ 选择列 · 空格/↓ 落子 · 四子连线获胜',
    difficulty: '简单',
  },
  [GameType.LIGHTS_OUT]: {
    type: GameType.LIGHTS_OUT,
    name: '点灯',
    description: '点击切换灯光，影响相邻格子，目标是全部熄灭！考验逻辑推理。',
    icon: '💡',
    color: '#f59e0b',
    gradient: 'from-amber-500 to-yellow-400',
    controls: '方向键移动 · 空格切换灯 · 全部熄灭过关',
    difficulty: '中等',
  },
  [GameType.WHACK_A_MOLE]: {
    type: GameType.WHACK_A_MOLE,
    name: '打地鼠',
    description: '地鼠随机冒出，快速敲击得分！考验反应速度和手眼协调。',
    icon: '🔨',
    color: '#f97316',
    gradient: 'from-orange-500 to-amber-400',
    controls: '方向键移动锤子 · 空格敲击 · 打中地鼠得分',
    difficulty: '简单',
  },
  [GameType.KLOTSKI]: {
    type: GameType.KLOTSKI,
    name: '华容道',
    description: '经典三国滑块益智，移动方块为曹操开路，助其从底部逃脱！',
    icon: '🏯',
    color: '#ef4444',
    gradient: 'from-red-500 to-amber-400',
    controls: '方向键/WASD 移动方块 · 目标让曹操从底部逃脱',
    difficulty: '困难',
  },
  [GameType.SOLITAIRE]: {
    type: GameType.SOLITAIRE,
    name: '纸牌接龙',
    description: '经典 Windows 纸牌，将牌按花色从 A 到 K 依次移到基础堆！',
    icon: '🃏',
    color: '#22c55e',
    gradient: 'from-green-500 to-emerald-400',
    controls: '鼠标点击拖拽移牌 · 双击自动归堆',
    difficulty: '中等',
  },
  [GameType.ASTEROIDS]: {
    type: GameType.ASTEROIDS,
    name: '小行星',
    description: '经典街机射击！驾驶飞船旋转射击，摧毁四面八方的小行星！',
    icon: '☄️',
    color: '#9ca3af',
    gradient: 'from-gray-500 to-slate-400',
    controls: '← → 旋转 · ↑ 加速 · 空格射击',
    difficulty: '中等',
  },
  [GameType.AIR_HOCKEY]: {
    type: GameType.AIR_HOCKEY,
    name: '空气曲棍球',
    description: '双人桌上曲棍球对决！滑动推杆击球，先得7分获胜，支持AI对手。',
    icon: '🏒',
    color: '#3b82f6',
    gradient: 'from-blue-500 to-cyan-400',
    controls: '鼠标/触摸控制推杆 · 先得7分获胜',
    difficulty: '中等',
  },
  [GameType.FRUIT_NINJA]: {
    type: GameType.FRUIT_NINJA,
    name: '水果忍者',
    description: '滑动切割飞出的水果，躲避炸弹，挑战最高连击！',
    icon: '🍉',
    color: '#eab308',
    gradient: 'from-yellow-500 to-green-400',
    controls: '鼠标/触摸滑动切水果 · 躲避炸弹',
    difficulty: '简单',
  },
};

// ========== Storage Keys ==========
const KEYS = {
  RECORDS: 'gp_records',
  HIGH_SCORES: 'gp_high_scores',
  FAVORITES: 'gp_favorites',
  COMMENTS: 'gp_comments',
  PROFILE: 'gp_profile',
};

// ========== Helper ==========
const generateId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2);

const safeGet = <T>(key: string, fallback: T): T => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
};

const safeSet = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage write failed:', e);
  }
};

// ========== 游戏记录服务 ==========
export const RecordService = {
  getAll(): GameRecord[] {
    return safeGet<GameRecord[]>(KEYS.RECORDS, []);
  },

  getByGame(gameType: GameType): GameRecord[] {
    return this.getAll()
      .filter((r) => r.gameType === gameType)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  add(record: Omit<GameRecord, 'id' | 'date'>): GameRecord {
    const records = this.getAll();
    const newRecord: GameRecord = {
      ...record,
      id: generateId(),
      date: new Date().toISOString(),
    };
    records.push(newRecord);
    safeSet(KEYS.RECORDS, records);
    return newRecord;
  },

  getRecent(gameType: GameType, limit = 10): GameRecord[] {
    return this.getByGame(gameType).slice(0, limit);
  },

  getStats(gameType: GameType) {
    const records = this.getByGame(gameType);
    const totalGames = records.length;
    const totalScore = records.reduce((sum, r) => sum + r.score, 0);
    const avgScore = totalGames > 0 ? Math.round(totalScore / totalGames) : 0;
    const totalTime = records.reduce((sum, r) => sum + r.duration, 0);
    return { totalGames, totalScore, avgScore, totalTime };
  },
};

// ========== 最高分服务 ==========
export const HighScoreService = {
  getAll(): HighScore[] {
    return safeGet<HighScore[]>(KEYS.HIGH_SCORES, []);
  },

  get(gameType: GameType): number {
    const scores = this.getAll();
    const found = scores.find((s) => s.gameType === gameType);
    return found?.score ?? 0;
  },

  update(gameType: GameType, score: number): boolean {
    const current = this.get(gameType);
    if (score > current) {
      const scores = this.getAll().filter((s) => s.gameType !== gameType);
      scores.push({ gameType, score, date: new Date().toISOString() });
      safeSet(KEYS.HIGH_SCORES, scores);
      return true; // 新纪录！
    }
    return false;
  },
};

// ========== 收藏服务 ==========
export const FavoriteService = {
  getAll(): Favorite[] {
    return safeGet<Favorite[]>(KEYS.FAVORITES, []);
  },

  isFavorite(gameType: GameType): boolean {
    return this.getAll().some((f) => f.gameType === gameType);
  },

  toggle(gameType: GameType): boolean {
    const favorites = this.getAll();
    const index = favorites.findIndex((f) => f.gameType === gameType);
    if (index >= 0) {
      favorites.splice(index, 1);
      safeSet(KEYS.FAVORITES, favorites);
      return false;
    } else {
      favorites.push({ gameType, addedAt: new Date().toISOString() });
      safeSet(KEYS.FAVORITES, favorites);
      return true;
    }
  },
};

// ========== 评论服务 ==========
export const CommentService = {
  getAll(): GameComment[] {
    return safeGet<GameComment[]>(KEYS.COMMENTS, []);
  },

  getByGame(gameType: GameType): GameComment[] {
    return this.getAll()
      .filter((c) => c.gameType === gameType)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  add(gameType: GameType, nickname: string, content: string, rating: number): GameComment {
    const comments = this.getAll();
    const newComment: GameComment = {
      id: generateId(),
      gameType,
      nickname,
      content,
      rating,
      date: new Date().toISOString(),
      likes: 0,
    };
    comments.push(newComment);
    safeSet(KEYS.COMMENTS, comments);
    return newComment;
  },

  like(commentId: string): void {
    const comments = this.getAll();
    const comment = comments.find((c) => c.id === commentId);
    if (comment) {
      comment.likes++;
      safeSet(KEYS.COMMENTS, comments);
    }
  },

  getAverageRating(gameType: GameType): number {
    const comments = this.getByGame(gameType);
    if (comments.length === 0) return 0;
    const total = comments.reduce((sum, c) => sum + c.rating, 0);
    return Math.round((total / comments.length) * 10) / 10;
  },
};

// ========== 用户配置服务 ==========
export const ProfileService = {
  get(): UserProfile {
    return safeGet<UserProfile>(KEYS.PROFILE, {
      nickname: '玩家',
      avatar: '🎮',
      theme: 'dark',
      soundEnabled: true,
      favoriteGames: [],
    });
  },

  update(profile: Partial<UserProfile>): UserProfile {
    const current = this.get();
    const updated = { ...current, ...profile };
    safeSet(KEYS.PROFILE, updated);
    return updated;
  },
};
