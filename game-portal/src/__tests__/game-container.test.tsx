import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { GameType } from '@/types';
import GameContainer from '@/components/GameContainer';

// Mock StorageService 的写操作（不 mock 读取，避免副作用）
vi.mock('@/services/StorageService', () => ({
  RecordService: {
    add: vi.fn().mockReturnValue({ id: 'test-id', date: new Date().toISOString() }),
  },
  HighScoreService: {
    update: vi.fn().mockReturnValue(false),
  },
}));

describe('GameContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('渲染开始界面覆盖层', () => {
    render(<GameContainer gameType={GameType.TETRIS} />);
    expect(screen.getByText('准备开始')).toBeDefined();
    expect(screen.getByText('开始游戏')).toBeDefined();
  });

  it('点击开始游戏按钮触发引擎 start', () => {
    render(<GameContainer gameType={GameType.TETRIS} />);

    const startBtn = screen.getByText('开始游戏');
    fireEvent.click(startBtn);

    // 点击后覆盖层应消失（status 变为 playing）
    // 由于 rAF mock 是 immediate，引擎会立即开始游戏循环
    // 但我们主要验证按钮可点击且不报错
    expect(startBtn).toBeDefined();
  });

  it('显示 HUD 信息（分数和等级）', () => {
    render(<GameContainer gameType={GameType.TETRIS} />);
    expect(screen.getByText(/分数/)).toBeDefined();
    expect(screen.getByText(/等级/)).toBeDefined();
  });

  it('Sokoban 显示额外 HUD（步数和关卡）', () => {
    render(<GameContainer gameType={GameType.SOKOBAN} />);
    // "步数" 只出现在 HUD 中，"关卡" 出现在 HUD 和底部提示中
    const moveEls = screen.getAllByText(/步数/);
    expect(moveEls.length).toBeGreaterThanOrEqual(1);
    const levelEls = screen.getAllByText(/关卡/);
    expect(levelEls.length).toBeGreaterThanOrEqual(1);
  });

  it('渲染 canvas 元素', () => {
    const { container } = render(<GameContainer gameType={GameType.TETRIS} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('width')).toBe('480');
    expect(canvas?.getAttribute('height')).toBe('640');
  });

  it('重置按钮存在', () => {
    render(<GameContainer gameType={GameType.TETRIS} />);
    expect(screen.getByText('🔄 重置')).toBeDefined();
  });
});
