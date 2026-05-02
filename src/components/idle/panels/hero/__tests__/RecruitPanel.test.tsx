/**
 * RecruitPanel UI 交互测试
 *
 * 覆盖场景（12个测试用例）：
 * 1. 渲染招贤令余额
 * 2. 渲染面板标题
 * 3. 默认选中普通模式
 * 4. 切换到高级模式
 * 5. 显示概率表
 * 6. 切换模式后概率表更新
 * 7. 显示保底进度
 * 8. 显示保底剩余次数
 * 9. 单抽按钮点击回调
 * 10. 十连按钮点击回调
 * 11. 招贤令不足时单抽按钮禁用
 * 12. 招贤令不足时十连按钮禁用
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RecruitPanel from '../RecruitPanel';

// ─────────────────────────────────────────────
// 测试数据
// ─────────────────────────────────────────────

const NORMAL_RATES = [
  { quality: 'COMMON', rate: 0.60 },
  { quality: 'FINE', rate: 0.30 },
  { quality: 'RARE', rate: 0.08 },
  { quality: 'EPIC', rate: 0.02 },
  { quality: 'LEGENDARY', rate: 0 },
];

const ADVANCED_RATES = [
  { quality: 'COMMON', rate: 0.20 },
  { quality: 'FINE', rate: 0.40 },
  { quality: 'RARE', rate: 0.25 },
  { quality: 'EPIC', rate: 0.13 },
  { quality: 'LEGENDARY', rate: 0.02 },
];

/** 创建默认 props */
function makeProps(overrides: Partial<Parameters<typeof RecruitPanel>[0]> = {}) {
  return {
    recruitToken: 500,
    onRecruit: vi.fn(),
    pityCount: 3,
    pityThreshold: 10,
    normalRates: NORMAL_RATES,
    advancedRates: ADVANCED_RATES,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('RecruitPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ── 1. 渲染招贤令余额 ──
  it('显示招贤令余额', () => {
    render(<RecruitPanel {...makeProps({ recruitToken: 1234 })} />);
    expect(screen.getByTestId('recruit-token-balance').textContent).toBe('1,234');
  });

  // ── 2. 渲染面板标题 ──
  it('显示面板标题', () => {
    render(<RecruitPanel {...makeProps()} />);
    expect(screen.getByText('招贤纳士')).toBeTruthy();
  });

  // ── 3. 默认选中普通模式 ──
  it('默认选中普通模式', () => {
    render(<RecruitPanel {...makeProps()} />);
    const normalBtn = screen.getByTestId('mode-btn-normal');
    expect(normalBtn.getAttribute('aria-pressed')).toBe('true');
    const advancedBtn = screen.getByTestId('mode-btn-advanced');
    expect(advancedBtn.getAttribute('aria-pressed')).toBe('false');
  });

  // ── 4. 切换到高级模式 ──
  it('切换到高级模式', () => {
    render(<RecruitPanel {...makeProps()} />);
    const advancedBtn = screen.getByTestId('mode-btn-advanced');
    fireEvent.click(advancedBtn);
    expect(advancedBtn.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('mode-btn-normal').getAttribute('aria-pressed')).toBe('false');
  });

  // ── 5. 显示概率表 ──
  it('显示概率表（默认普通模式）', () => {
    render(<RecruitPanel {...makeProps()} />);
    expect(screen.getByTestId('rate-table')).toBeTruthy();
    // 普通模式第一个品质为 COMMON 60%
    expect(screen.getByText('60.0%')).toBeTruthy();
    expect(screen.getByText('普通')).toBeTruthy();
  });

  // ── 6. 切换模式后概率表更新 ──
  it('切换到高级模式后概率表更新', () => {
    render(<RecruitPanel {...makeProps()} />);
    fireEvent.click(screen.getByTestId('mode-btn-advanced'));
    // 高级模式 COMMON 为 20%
    expect(screen.getByText('20.0%')).toBeTruthy();
    // 不应再显示 60.0%
    expect(screen.queryByText('60.0%')).toBeNull();
  });

  // ── 7. 显示保底进度 ──
  it('显示保底进度条', () => {
    render(<RecruitPanel {...makeProps({ pityCount: 3, pityThreshold: 10 })} />);
    expect(screen.getByTestId('pity-bar')).toBeTruthy();
    expect(screen.getByTestId('pity-count').textContent).toBe('3 / 10');
  });

  // ── 8. 显示保底剩余次数 ──
  it('显示保底剩余次数', () => {
    render(<RecruitPanel {...makeProps({ pityCount: 7, pityThreshold: 10 })} />);
    const hint = screen.getByTestId('pity-remaining');
    expect(hint.textContent).toContain('3');
  });

  // ── 9. 单抽按钮点击回调 ──
  it('单抽按钮点击触发回调（普通模式）', () => {
    const onRecruit = vi.fn();
    render(<RecruitPanel {...makeProps({ onRecruit })} />);
    fireEvent.click(screen.getByTestId('btn-single-recruit'));
    expect(onRecruit).toHaveBeenCalledWith('normal', 1);
  });

  // ── 10. 十连按钮点击回调 ──
  it('十连按钮点击触发回调（高级模式）', () => {
    const onRecruit = vi.fn();
    // 高级模式十连需要 900 招贤令
    render(<RecruitPanel {...makeProps({ onRecruit, recruitToken: 1000 })} />);
    fireEvent.click(screen.getByTestId('mode-btn-advanced'));
    fireEvent.click(screen.getByTestId('btn-multi-recruit'));
    expect(onRecruit).toHaveBeenCalledWith('advanced', 10);
  });

  // ── 11. 招贤令不足时单抽按钮禁用 ──
  it('招贤令不足时单抽按钮禁用', () => {
    render(<RecruitPanel {...makeProps({ recruitToken: 0 })} />);
    // 普通模式单抽需要 1 招贤令，0 < 1
    const btn = screen.getByTestId('btn-single-recruit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  // ── 12. 招贤令不足时十连按钮禁用 ──
  it('招贤令不足时十连按钮禁用', () => {
    render(<RecruitPanel {...makeProps({ recruitToken: 50 })} />);
    // 普通模式十连需要 45，可以；切换高级模式需要 900，不够
    fireEvent.click(screen.getByTestId('mode-btn-advanced'));
    const btn = screen.getByTestId('btn-multi-recruit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
