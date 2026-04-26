/**
 * BondCollectionProgress — 羁绊收集进度测试
 *
 * 覆盖场景：
 * - 渲染测试（总进度、分类进度）
 * - 进度百分比计算
 * - 边界测试（零值、满值）
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import BondCollectionProgress from '../BondCollectionProgress';

// ── Mock CSS ──
vi.mock('../BondCollectionProgress.css', () => ({}));

// ── 测试数据工厂 ──

const makeProps = (overrides: Record<string, unknown> = {}) => ({
  totalBonds: 20,
  activatedBonds: 8,
  factionActivated: 6,
  factionTotal: 16,
  partnerActivated: 2,
  partnerTotal: 4,
  ...overrides,
});

// ── 测试 ──

describe('BondCollectionProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染测试
  // ═══════════════════════════════════════════

  it('应正常渲染组件', () => {
    render(<BondCollectionProgress {...makeProps()} />);
    expect(screen.getByTestId('bond-collection-progress')).toBeInTheDocument();
  });

  it('应显示羁绊收集总进度', () => {
    render(<BondCollectionProgress {...makeProps()} />);
    expect(screen.getByText('羁绊收集')).toBeInTheDocument();
    expect(screen.getByText('8/20 已激活')).toBeInTheDocument();
  });

  it('应显示总进度百分比', () => {
    render(<BondCollectionProgress {...makeProps()} />);
    // 8/20 = 40%
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 分类进度
  // ═══════════════════════════════════════════

  it('应显示阵营羁绊进度', () => {
    render(<BondCollectionProgress {...makeProps()} />);
    expect(screen.getByText('阵营羁绊')).toBeInTheDocument();
    expect(screen.getByText('6/16')).toBeInTheDocument();
  });

  it('应显示搭档羁绊进度', () => {
    render(<BondCollectionProgress {...makeProps()} />);
    expect(screen.getByText('搭档羁绊')).toBeInTheDocument();
    expect(screen.getByText('2/4')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 边界测试
  // ═══════════════════════════════════════════

  it('全部未激活时应显示0%', () => {
    render(<BondCollectionProgress {...makeProps({
      activatedBonds: 0,
      factionActivated: 0,
      partnerActivated: 0,
    })} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('0/20 已激活')).toBeInTheDocument();
  });

  it('全部激活时应显示100%', () => {
    render(<BondCollectionProgress {...makeProps({
      activatedBonds: 20,
      factionActivated: 16,
      partnerActivated: 4,
    })} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('总数为0时应显示0%避免除零', () => {
    render(<BondCollectionProgress {...makeProps({
      totalBonds: 0,
      activatedBonds: 0,
    })} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
