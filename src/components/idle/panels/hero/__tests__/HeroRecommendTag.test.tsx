/**
 * HeroRecommendTag — 推荐武将标记测试
 *
 * 覆盖场景：
 * - 渲染测试（原因文本、优先级样式）
 * - 优先级图标
 * - title属性
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import HeroRecommendTag from '../HeroRecommendTag';

// ── Mock CSS ──
vi.mock('../HeroRecommendTag.css', () => ({}));

// ── 测试 ──

describe('HeroRecommendTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染测试
  // ═══════════════════════════════════════════

  it('应正常渲染组件', () => {
    render(<HeroRecommendTag reason="羁绊推荐：桃园结义" priority="high" />);
    expect(screen.getByTestId('hero-recommend-tag')).toBeInTheDocument();
  });

  it('应显示推荐原因文本', () => {
    render(<HeroRecommendTag reason="羁绊推荐：桃园结义" priority="high" />);
    expect(screen.getByText('羁绊推荐：桃园结义')).toBeInTheDocument();
  });

  it('应设置title属性为推荐原因', () => {
    render(<HeroRecommendTag reason="羁绊推荐：桃园结义" priority="high" />);
    expect(screen.getByTestId('hero-recommend-tag')).toHaveAttribute('title', '羁绊推荐：桃园结义');
  });

  // ═══════════════════════════════════════════
  // 2. 优先级样式
  // ═══════════════════════════════════════════

  it('high优先级应使用high样式类', () => {
    render(<HeroRecommendTag reason="测试" priority="high" />);
    const tag = screen.getByTestId('hero-recommend-tag');
    expect(tag.className).toContain('tk-hero-recommend-tag--high');
  });

  it('medium优先级应使用medium样式类', () => {
    render(<HeroRecommendTag reason="测试" priority="medium" />);
    const tag = screen.getByTestId('hero-recommend-tag');
    expect(tag.className).toContain('tk-hero-recommend-tag--medium');
  });

  it('low优先级应使用low样式类', () => {
    render(<HeroRecommendTag reason="测试" priority="low" />);
    const tag = screen.getByTestId('hero-recommend-tag');
    expect(tag.className).toContain('tk-hero-recommend-tag--low');
  });

  // ═══════════════════════════════════════════
  // 3. 优先级图标
  // ═══════════════════════════════════════════

  it('high优先级应显示星标图标⭐', () => {
    render(<HeroRecommendTag reason="测试" priority="high" />);
    expect(screen.getByText('⭐')).toBeInTheDocument();
  });
});
