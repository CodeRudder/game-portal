/**
 * F03 武将招募 P1-2 修复测试：概率0%项显示"无法获得"标注
 *
 * 验证点：
 * 1. ProbabilityDisclosure 组件中 rate=0 的行应显示"无法获得"文本
 * 2. 0%概率行的品质标签应有 line-through 样式类
 * 3. 0%概率行应显示"—"而非概率条
 * 4. 0%概率行应有 unavailable 行样式类
 * 5. 非0%概率行应正常显示百分比
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProbabilityDisclosure from '@/components/idle/panels/hero/ProbabilityDisclosure';

vi.mock('@/components/idle/panels/hero/ProbabilityDisclosure.css', () => ({}));

// ── 测试数据 ──

/** 包含0%概率项的普通池 */
const normalRatesWithZero = [
  { quality: 'COMMON', label: '普通', rate: 0.55 },
  { quality: 'FINE', label: '精良', rate: 0.25 },
  { quality: 'RARE', label: '稀有', rate: 0.12 },
  { quality: 'EPIC', label: '史诗', rate: 0.08 },
  { quality: 'LEGENDARY', label: '传说', rate: 0 },
];

/** 包含0%概率项的高级池 */
const advancedRatesWithZero = [
  { quality: 'RARE', label: '稀有', rate: 0.45 },
  { quality: 'EPIC', label: '史诗', rate: 0.35 },
  { quality: 'LEGENDARY', label: '传说', rate: 0.15 },
  { quality: 'MYTHIC', label: '神话', rate: 0 },
];

/** 全部非零概率的普通池（对照） */
const normalRatesAllNonZero = [
  { quality: 'COMMON', label: '普通', rate: 0.55 },
  { quality: 'FINE', label: '精良', rate: 0.25 },
  { quality: 'RARE', label: '稀有', rate: 0.12 },
  { quality: 'EPIC', label: '史诗', rate: 0.06 },
  { quality: 'LEGENDARY', label: '传说', rate: 0.02 },
];

const makeProps = (overrides: Record<string, unknown> = {}) => ({
  normalRates: normalRatesWithZero,
  advancedRates: advancedRatesWithZero,
  pityThreshold: 90,
  currentPityCount: 30,
  ...overrides,
});

// ── 测试 ──

describe('F03 P1-2: 概率0%项显示"无法获得"标注', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rate=0 的行应显示"无法获得"文本', () => {
    render(<ProbabilityDisclosure {...makeProps()} />);

    // 传说品质在普通池中概率为0
    expect(screen.getByText('无法获得')).toBeInTheDocument();
  });

  it('rate=0 的行品质标签应有 unavailable 样式类', () => {
    const { container } = render(<ProbabilityDisclosure {...makeProps()} />);

    // 查找 unavailable 行
    const unavailableRows = container.querySelectorAll('.tk-prob-disc__row--unavailable');
    expect(unavailableRows.length).toBeGreaterThanOrEqual(1);

    // 查找品质标签的 unavailable 样式
    const unavailableLabels = container.querySelectorAll('.tk-prob-disc__quality-label--unavailable');
    expect(unavailableLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('rate=0 的行概率值应有 zero 样式类', () => {
    const { container } = render(<ProbabilityDisclosure {...makeProps()} />);

    const zeroValues = container.querySelectorAll('.tk-prob-disc__rate-value--zero');
    expect(zeroValues.length).toBeGreaterThanOrEqual(1);
  });

  it('rate=0 的行应显示"—"而非概率条', () => {
    const { container } = render(<ProbabilityDisclosure {...makeProps()} />);

    // 验证 unavailable-text（"—"）存在
    const dashTexts = container.querySelectorAll('.tk-prob-disc__unavailable-text');
    expect(dashTexts.length).toBeGreaterThanOrEqual(1);
    expect(dashTexts[0].textContent).toBe('—');
  });

  it('rate=0 的行不应显示概率条填充', () => {
    const { container } = render(<ProbabilityDisclosure {...makeProps()} />);

    // unavailable 行内不应有 bar-fill 元素
    const unavailableRows = container.querySelectorAll('.tk-prob-disc__row--unavailable');
    unavailableRows.forEach((row) => {
      const barFill = row.querySelector('.tk-prob-disc__bar-fill');
      expect(barFill).toBeNull();
    });
  });

  it('非0%概率行应正常显示百分比数值', () => {
    render(<ProbabilityDisclosure {...makeProps()} />);

    // 普通品质 55%
    expect(screen.getByText('55.00%')).toBeInTheDocument();
    // 精良品质 25%
    expect(screen.getByText('25.00%')).toBeInTheDocument();
    // 稀有品质 12%
    expect(screen.getByText('12.00%')).toBeInTheDocument();
    // 史诗品质 8%
    expect(screen.getByText('8.00%')).toBeInTheDocument();
  });

  it('非0%概率行不应有 unavailable 样式类', () => {
    const { container } = render(<ProbabilityDisclosure {...makeProps()} />);

    // 获取所有行
    const allRows = container.querySelectorAll('.tk-prob-disc__row');
    const unavailableRows = container.querySelectorAll('.tk-prob-disc__row--unavailable');

    // 非0%行不应有 unavailable 类
    allRows.forEach((row) => {
      if (!row.classList.contains('tk-prob-disc__row--unavailable')) {
        expect(row.querySelector('.tk-prob-disc__quality-label--unavailable')).toBeNull();
        expect(row.querySelector('.tk-prob-disc__rate-value--zero')).toBeNull();
      }
    });

    // 确认有非 unavailable 行存在
    expect(allRows.length - unavailableRows.length).toBeGreaterThan(0);
  });

  it('切换到高级招募后，神话0%也应显示"无法获得"', () => {
    render(<ProbabilityDisclosure {...makeProps()} />);

    // 切换到高级招募
    fireEvent.click(screen.getByTestId('prob-tab-advanced'));

    // 神话品质在高级池中概率为0
    expect(screen.getByText('无法获得')).toBeInTheDocument();
  });

  it('全部概率非零时不应显示"无法获得"', () => {
    render(<ProbabilityDisclosure {...makeProps({
      normalRates: normalRatesAllNonZero,
    })} />);

    expect(screen.queryByText('无法获得')).not.toBeInTheDocument();
  });

  it('0%概率行的品质圆点颜色应为灰色(#666)', () => {
    const { container } = render(<ProbabilityDisclosure {...makeProps()} />);

    const unavailableRows = container.querySelectorAll('.tk-prob-disc__row--unavailable');
    expect(unavailableRows.length).toBeGreaterThanOrEqual(1);

    const dot = unavailableRows[0].querySelector('.tk-prob-disc__quality-dot');
    expect(dot).toBeInTheDocument();
    expect((dot as HTMLElement).style.backgroundColor).toBe('rgb(102, 102, 102)');
  });
});
