/**
 * QualityBadge 原子组件单元测试
 *
 * 覆盖场景：
 * - 渲染5种品质标签（COMMON/FINE/RARE/EPIC/LEGENDARY）
 * - 每种品质显示正确的文本和颜色CSS类
 * - small和normal两种尺寸
 * - 应用自定义className
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import QualityBadge from '../QualityBadge';
import type { QualityBadgeProps } from '../QualityBadge';

// Mock CSS import
vi.mock('../QualityBadge.css', () => ({}));

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('QualityBadge', () => {
  afterEach(() => {
    cleanup();
  });

  // ═══════════════════════════════════════════
  // 1. 5种品质标签渲染
  // ═══════════════════════════════════════════

  const qualities: Array<{ quality: QualityBadgeProps['quality']; text: string }> = [
    { quality: 'COMMON', text: '普通' },
    { quality: 'FINE', text: '精良' },
    { quality: 'RARE', text: '稀有' },
    { quality: 'EPIC', text: '史诗' },
    { quality: 'LEGENDARY', text: '传说' },
  ];

  it.each(qualities)('应正确渲染 $quality 品质标签，显示"$text"', ({ quality, text }) => {
    render(<QualityBadge quality={quality} />);
    const badge = screen.getByTestId(`quality-badge-${quality.toLowerCase()}`);
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe(text);
  });

  // ═══════════════════════════════════════════
  // 2. 每种品质应用正确的CSS类
  // ═══════════════════════════════════════════

  it.each(qualities)('应给 $quality 品质应用正确的CSS类', ({ quality }) => {
    render(<QualityBadge quality={quality} />);
    const badge = screen.getByTestId(`quality-badge-${quality.toLowerCase()}`);
    expect(badge.className).toContain(`tk-quality-badge--${quality.toLowerCase()}`);
  });

  // ═══════════════════════════════════════════
  // 3. 尺寸模式
  // ═══════════════════════════════════════════

  it('默认尺寸为normal', () => {
    render(<QualityBadge quality="RARE" />);
    const badge = screen.getByTestId('quality-badge-rare');
    expect(badge.className).toContain('tk-quality-badge--normal');
  });

  it('应支持small尺寸', () => {
    render(<QualityBadge quality="RARE" size="small" />);
    const badge = screen.getByTestId('quality-badge-rare');
    expect(badge.className).toContain('tk-quality-badge--small');
  });

  it('应支持normal尺寸显式指定', () => {
    render(<QualityBadge quality="EPIC" size="normal" />);
    const badge = screen.getByTestId('quality-badge-epic');
    expect(badge.className).toContain('tk-quality-badge--normal');
  });

  // ═══════════════════════════════════════════
  // 4. 自定义className
  // ═══════════════════════════════════════════

  it('应应用自定义className', () => {
    render(<QualityBadge quality="LEGENDARY" className="custom-class" />);
    const badge = screen.getByTestId('quality-badge-legendary');
    expect(badge.className).toContain('custom-class');
  });

  it('自定义className应与默认类共存', () => {
    render(<QualityBadge quality="LEGENDARY" className="my-extra" size="small" />);
    const badge = screen.getByTestId('quality-badge-legendary');
    expect(badge.className).toContain('tk-quality-badge');
    expect(badge.className).toContain('tk-quality-badge--legendary');
    expect(badge.className).toContain('tk-quality-badge--small');
    expect(badge.className).toContain('my-extra');
  });

  // ═══════════════════════════════════════════
  // 5. 基础结构
  // ═══════════════════════════════════════════

  it('应渲染为span元素', () => {
    render(<QualityBadge quality="COMMON" />);
    const badge = screen.getByTestId('quality-badge-common');
    expect(badge.tagName).toBe('SPAN');
  });

  it('应始终包含基础CSS类 tk-quality-badge', () => {
    render(<QualityBadge quality="FINE" />);
    const badge = screen.getByTestId('quality-badge-fine');
    expect(badge.className).toContain('tk-quality-badge');
  });
});
