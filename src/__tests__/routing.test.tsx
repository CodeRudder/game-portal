import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import App from '@/App';
import GamePage from '@/pages/GamePage';

// Mock StorageService — factory 中不引用外部变量，避免 hoisting 问题
vi.mock('@/services/StorageService', () => {
  const mockMeta = {
    tetris: { name: '俄罗斯方块', description: '经典方块消除', icon: '🧱', color: '#00f5ff', gradient: 'from-cyan-500 to-blue-600' },
    snake: { name: '贪吃蛇', description: '经典贪吃蛇', icon: '🐍', color: '#00ff88', gradient: 'from-green-500 to-emerald-600' },
    sokoban: { name: '推箱子', description: '经典推箱子', icon: '📦', color: '#ff6b35', gradient: 'from-orange-500 to-red-600' },
  };
  return {
    RecordService: {
      add: vi.fn().mockReturnValue({ id: 'test-id', date: new Date().toISOString() }),
      getAll: vi.fn(() => []),
      getByGame: vi.fn(() => []),
      getRecent: vi.fn(() => []),
      getStats: vi.fn(() => ({ totalGames: 0, totalDuration: 0, averageScore: 0 })),
    },
    HighScoreService: {
      get: vi.fn(() => 0),
      update: vi.fn(() => false),
    },
    FavoriteService: {
      getAll: vi.fn(() => []),
      isFavorite: vi.fn(() => false),
      toggle: vi.fn(),
    },
    CommentService: {
      getAll: vi.fn(() => []),
      getByGame: vi.fn(() => []),
      add: vi.fn(),
      like: vi.fn(),
      getAverageRating: vi.fn(() => 0),
    },
    ProfileService: {
      get: vi.fn(() => ({
        theme: 'dark',
        soundEnabled: true,
        difficulty: 'normal',
        favoriteGames: [],
      })),
      update: vi.fn(),
    },
    GAME_META: mockMeta,
  };
});

function renderWithRouter(ui: React.ReactElement, initialEntries?: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries || ['/']}>
      {ui}
    </MemoryRouter>
  );
}

/** 用 Route 包裹 GamePage，使 useParams 可以正确解析 URL 参数 */
function renderGamePageWithRoute(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/game/:gameType" element={<GamePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('路由与导航', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('首页渲染正确 — 显示 Game Portal 标题', async () => {
    renderWithRouter(<App />);
    // "Game Portal" 在 header/h1/footer 出现多次，用 waitFor 等待渲染完成
    const matches = await waitFor(() => screen.getAllByText(/Game Portal/i));
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // h1 标题应存在
    const h1 = matches.find(el => el.tagName === 'H1');
    expect(h1).toBeDefined();
  });

  it('有效游戏类型渲染 GameContainer', async () => {
    renderWithRouter(<App />, ['/game/tetris']);
    // GamePage 通过 React.lazy 加载，需等待 Suspense 结束后再断言
    expect(await screen.findByText('开始游戏')).toBeDefined();
  });

  it('无效游戏类型显示未找到提示', () => {
    renderWithRouter(<App />, ['/game/invalid']);
    expect(screen.getByText(/游戏未找到/i)).toBeDefined();
  });

  it('无效游戏类型显示返回按钮', () => {
    renderWithRouter(<App />, ['/game/invalid']);
    expect(screen.getByText(/返回首页/i)).toBeDefined();
  });

  it('三个游戏类型均可访问', async () => {
    const types = ['tetris', 'snake', 'sokoban'];
    for (const type of types) {
      const { unmount } = renderWithRouter(<App />, [`/game/${type}`]);
      // GamePage 通过 React.lazy 加载，需等待 Suspense 结束后再断言
      expect(await screen.findByText('开始游戏')).toBeDefined();
      unmount();
    }
  });

  it('GamePage 直接渲染有效类型（通过 Route 包裹）', async () => {
    renderGamePageWithRoute('/game/snake');
    // GamePage 通过 useParams 获取 gameType="snake"，应渲染 GameContainer
    // createEngine 是异步的，需等待 loading → start overlay 转换
    expect(await screen.findByText('开始游戏')).toBeDefined();
  });
});
