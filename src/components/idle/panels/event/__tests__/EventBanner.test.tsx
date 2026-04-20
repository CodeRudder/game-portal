/**
 * EventBanner — 急报横幅通知测试
 *
 * 覆盖场景：
 * - 基础渲染：横幅容器、标题、内容
 * - 优先级样式：low/normal/high/urgent
 * - 自动消失：定时器触发
 * - 点击交互：点击横幅、关闭按钮
 * - 动画：入场/退场
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import EventBanner from '../EventBanner';
import type { EventBanner as EventBannerData } from '@/games/three-kingdoms/core/events';

// ── Mock CSS ──
vi.mock('../EventBanner.css', () => ({}));

// ── 测试数据 ──

const makeBanner = (overrides: Partial<EventBannerData> = {}): EventBannerData => ({
  id: 'banner-001',
  eventId: 'evt-storm',
  title: '暴风雨来袭',
  content: '一场猛烈的暴风雨正在逼近',
  icon: '🌊',
  priority: 'normal',
  displayDuration: 5000,
  createdAt: Date.now(),
  read: false,
  ...overrides,
});

// ── 测试 ──

describe('EventBanner', () => {
  const mockOnClick = vi.fn();
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('banner=null 时不渲染', () => {
    render(<EventBanner banner={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('应渲染横幅容器', () => {
    render(<EventBanner banner={makeBanner()} onClick={mockOnClick} onDismiss={mockOnDismiss} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('应渲染横幅标题', () => {
    render(<EventBanner banner={makeBanner()} />);
    expect(screen.getByText('暴风雨来袭')).toBeInTheDocument();
  });

  it('应渲染横幅内容', () => {
    render(<EventBanner banner={makeBanner()} />);
    expect(screen.getByText('一场猛烈的暴风雨正在逼近')).toBeInTheDocument();
  });

  it('应渲染自定义图标', () => {
    render(<EventBanner banner={makeBanner({ icon: '🔥' })} />);
    expect(screen.getByText('🔥')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 优先级样式
  // ═══════════════════════════════════════════

  it('normal优先级应添加对应CSS类', () => {
    render(<EventBanner banner={makeBanner({ priority: 'normal' })} />);
    const banner = screen.getByRole('alert');
    expect(banner.className).toContain('tk-ebanner--normal');
  });

  it('urgent优先级应添加对应CSS类', () => {
    render(<EventBanner banner={makeBanner({ priority: 'urgent' })} />);
    const banner = screen.getByRole('alert');
    expect(banner.className).toContain('tk-ebanner--urgent');
  });

  it('high优先级应添加对应CSS类', () => {
    render(<EventBanner banner={makeBanner({ priority: 'high' })} />);
    const banner = screen.getByRole('alert');
    expect(banner.className).toContain('tk-ebanner--high');
  });

  // ═══════════════════════════════════════════
  // 3. 自动消失
  // ═══════════════════════════════════════════

  it('到达自动消失时间后应触发 onDismiss', () => {
    render(<EventBanner banner={makeBanner()} onDismiss={mockOnDismiss} autoHideDuration={3000} />);
    act(() => { vi.advanceTimersByTime(3300); }); // 3s auto + 300ms exit animation
    expect(mockOnDismiss).toHaveBeenCalledWith('banner-001');
  });

  // ═══════════════════════════════════════════
  // 4. 点击交互
  // ═══════════════════════════════════════════

  it('点击横幅内容应调用 onClick', () => {
    render(<EventBanner banner={makeBanner()} onClick={mockOnClick} />);
    fireEvent.click(screen.getByText('暴风雨来袭'));
    expect(mockOnClick).toHaveBeenCalledWith('banner-001');
  });

  it('点击关闭按钮应触发退场动画', () => {
    render(<EventBanner banner={makeBanner()} onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByLabelText('关闭通知'));
    act(() => { vi.advanceTimersByTime(400); }); // 300ms exit animation
    expect(mockOnDismiss).toHaveBeenCalledWith('banner-001');
  });

  // ═══════════════════════════════════════════
  // 5. 入场动画
  // ═══════════════════════════════════════════

  it('横幅应添加入场动画CSS类', () => {
    render(<EventBanner banner={makeBanner()} />);
    const banner = screen.getByRole('alert');
    expect(banner.className).toContain('tk-ebanner--entering');
  });
});
