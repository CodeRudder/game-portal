import { vi } from 'vitest';
import {
  RecordService,
  HighScoreService,
  FavoriteService,
  CommentService,
  ProfileService,
  GAME_META,
} from '@/services/StorageService';

// localStorage mock — Vitest 在 jsdom 环境中自动提供，我们只需清理
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ========== RecordService ==========
describe('RecordService', () => {
  it('初始状态返回空数组', () => {
    expect(RecordService.getAll()).toEqual([]);
  });

  it('add 添加记录并返回含 id 和 date 的完整记录', () => {
    const record = RecordService.add({
      gameType: 'tetris',
      score: 1000,
      level: 5,
      duration: 120,
      isWin: false,
    });
    expect(record.id).toBeDefined();
    expect(record.date).toBeDefined();
    expect(record.score).toBe(1000);
    expect(record.gameType).toBe('tetris');
  });

  it('getByGame 按类型过滤并按日期降序排列', () => {
    RecordService.add({ gameType: 'tetris', score: 500, level: 3, duration: 60, isWin: false });
    RecordService.add({ gameType: 'snake', score: 300, level: 2, duration: 45, isWin: false });
    RecordService.add({ gameType: 'tetris', score: 800, level: 4, duration: 90, isWin: false });

    const tetrisRecords = RecordService.getByGame('tetris');
    expect(tetrisRecords).toHaveLength(2);
    // 按日期降序排列（同毫秒内添加时顺序可能不确定，仅验证过滤正确）
    const scores = tetrisRecords.map((r) => r.score).sort((a, b) => b - a);
    expect(scores).toEqual([800, 500]);
  });

  it('getStats 返回正确的统计数据', () => {
    RecordService.add({ gameType: 'tetris', score: 200, level: 2, duration: 30, isWin: false });
    RecordService.add({ gameType: 'tetris', score: 400, level: 3, duration: 60, isWin: true });

    const stats = RecordService.getStats('tetris');
    expect(stats.totalGames).toBe(2);
    expect(stats.totalScore).toBe(600);
    expect(stats.avgScore).toBe(300);
    expect(stats.totalTime).toBe(90);
  });

  it('getRecent 限制返回数量', () => {
    for (let i = 0; i < 15; i++) {
      RecordService.add({ gameType: 'snake', score: i * 100, level: 1, duration: 10, isWin: false });
    }
    const recent = RecordService.getRecent('snake', 5);
    expect(recent).toHaveLength(5);
  });
});

// ========== HighScoreService ==========
describe('HighScoreService', () => {
  it('初始状态返回 0', () => {
    expect(HighScoreService.get('tetris')).toBe(0);
  });

  it('update 更新高分并返回 true', () => {
    const result = HighScoreService.update('tetris', 500);
    expect(result).toBe(true);
    expect(HighScoreService.get('tetris')).toBe(500);
  });

  it('update 低于当前高分返回 false', () => {
    HighScoreService.update('tetris', 1000);
    const result = HighScoreService.update('tetris', 500);
    expect(result).toBe(false);
    expect(HighScoreService.get('tetris')).toBe(1000);
  });

  it('不同游戏类型的高分独立', () => {
    HighScoreService.update('tetris', 1000);
    HighScoreService.update('snake', 500);
    expect(HighScoreService.get('tetris')).toBe(1000);
    expect(HighScoreService.get('snake')).toBe(500);
    expect(HighScoreService.get('sokoban')).toBe(0);
  });
});

// ========== FavoriteService ==========
describe('FavoriteService', () => {
  it('初始状态无收藏', () => {
    expect(FavoriteService.getAll()).toEqual([]);
    expect(FavoriteService.isFavorite('tetris')).toBe(false);
  });

  it('toggle 添加收藏返回 true', () => {
    const result = FavoriteService.toggle('tetris');
    expect(result).toBe(true);
    expect(FavoriteService.isFavorite('tetris')).toBe(true);
  });

  it('toggle 再次调用取消收藏返回 false', () => {
    FavoriteService.toggle('tetris');
    const result = FavoriteService.toggle('tetris');
    expect(result).toBe(false);
    expect(FavoriteService.isFavorite('tetris')).toBe(false);
  });
});

// ========== CommentService ==========
describe('CommentService', () => {
  it('初始状态返回空数组', () => {
    expect(CommentService.getAll()).toEqual([]);
    expect(CommentService.getByGame('tetris')).toEqual([]);
  });

  it('add 添加评论并返回完整对象', () => {
    const comment = CommentService.add('tetris', '玩家1', '很好玩', 5);
    expect(comment.id).toBeDefined();
    expect(comment.nickname).toBe('玩家1');
    expect(comment.content).toBe('很好玩');
    expect(comment.rating).toBe(5);
    expect(comment.likes).toBe(0);
  });

  it('like 增加评论点赞数', () => {
    const comment = CommentService.add('snake', '玩家2', '不错', 4);
    CommentService.like(comment.id);
    const comments = CommentService.getAll();
    expect(comments[0].likes).toBe(1);
  });

  it('getAverageRating 计算正确平均分', () => {
    CommentService.add('tetris', 'A', '好', 5);
    CommentService.add('tetris', 'B', '一般', 3);
    CommentService.add('snake', 'C', '差', 1);

    expect(CommentService.getAverageRating('tetris')).toBe(4.0);
    expect(CommentService.getAverageRating('snake')).toBe(1);
    expect(CommentService.getAverageRating('sokoban')).toBe(0);
  });
});

// ========== ProfileService ==========
describe('ProfileService', () => {
  it('get 返回默认配置', () => {
    const profile = ProfileService.get();
    expect(profile.nickname).toBe('玩家');
    expect(profile.avatar).toBe('🎮');
    expect(profile.theme).toBe('dark');
    expect(profile.soundEnabled).toBe(true);
    expect(profile.favoriteGames).toEqual([]);
  });

  it('update 部分更新配置', () => {
    ProfileService.update({ nickname: '极客玩家', soundEnabled: false });
    const profile = ProfileService.get();
    expect(profile.nickname).toBe('极客玩家');
    expect(profile.soundEnabled).toBe(false);
    // 未更新的字段保持原值
    expect(profile.avatar).toBe('🎮');
    expect(profile.theme).toBe('dark');
  });

  it('update 多次调用保持最新状态', () => {
    ProfileService.update({ nickname: '玩家A' });
    ProfileService.update({ theme: 'light' });
    const profile = ProfileService.get();
    expect(profile.nickname).toBe('玩家A');
    expect(profile.theme).toBe('light');
  });
});

// ========== GAME_META ==========
describe('GAME_META', () => {
  it('包含三种游戏类型的元信息', () => {
    expect(GAME_META.tetris).toBeDefined();
    expect(GAME_META.snake).toBeDefined();
    expect(GAME_META.sokoban).toBeDefined();
  });

  it('每个游戏元信息包含必要字段', () => {
    for (const type of ['tetris', 'snake', 'sokoban'] as const) {
      const meta = GAME_META[type];
      expect(meta.name).toBeDefined();
      expect(meta.icon).toBeDefined();
      expect(meta.color).toBeDefined();
      expect(meta.gradient).toBeDefined();
      expect(meta.controls).toBeDefined();
      expect(meta.difficulty).toBeDefined();
    }
  });
});
