/**
 * ProbabilityDisclosure — 概率公示合规组件测试
 * 覆盖：渲染、概率表切换、保底进度、合规声明
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProbabilityDisclosure from '../ProbabilityDisclosure';

vi.mock('../ProbabilityDisclosure.css', () => ({}));

const normalRates = [
  { quality: 'COMMON', label: '普通', rate: 0.55 },
  { quality: 'FINE', label: '精良', rate: 0.25 },
  { quality: 'RARE', label: '稀有', rate: 0.12 },
  { quality: 'EPIC', label: '史诗', rate: 0.06 },
  { quality: 'LEGENDARY', label: '传说', rate: 0.02 },
];
const advancedRates = [
  { quality: 'RARE', label: '稀有', rate: 0.45 },
  { quality: 'EPIC', label: '史诗', rate: 0.35 },
  { quality: 'LEGENDARY', label: '传说', rate: 0.15 },
  { quality: 'MYTHIC', label: '神话', rate: 0.05 },
];
const makeProps = (o: Record<string, unknown> = {}) => ({
  normalRates, advancedRates, pityThreshold: 90, currentPityCount: 30, ...o,
});

describe('ProbabilityDisclosure', () => {
  beforeEach(() => vi.clearAllMocks());

  it('应正常渲染概率公示组件', () => {
    render(<ProbabilityDisclosure {...makeProps()} />);
    expect(screen.getByTestId('probability-disclosure')).toBeInTheDocument();
    expect(screen.getByText('概率公示')).toBeInTheDocument();
  });

  it('应显示合规标识', () => {
    render(<ProbabilityDisclosure {...makeProps()} />);
    expect(screen.getByText('合规')).toBeInTheDocument();
  });

  it('默认应显示普通招募概率表', () => {
    render(<ProbabilityDisclosure {...makeProps()} />);
    expect(screen.getByText('普通招募概率')).toBeInTheDocument();
    expect(screen.getByText('普通')).toBeInTheDocument();
    expect(screen.getByText('55.00%')).toBeInTheDocument();
  });

  it('切换到高级招募应显示对应概率', () => {
    render(<ProbabilityDisclosure {...makeProps()} />);
    fireEvent.click(screen.getByTestId('prob-tab-advanced'));
    expect(screen.getByText('高级招募概率')).toBeInTheDocument();
    expect(screen.getByText('神话')).toBeInTheDocument();
    expect(screen.getByText('5.00%')).toBeInTheDocument();
  });

  it('应显示保底进度和剩余次数', () => {
    render(<ProbabilityDisclosure {...makeProps()} />);
    expect(screen.getByTestId('prob-pity-info')).toBeInTheDocument();
    expect(screen.getByText('30/90')).toBeInTheDocument();
    expect(screen.getByText(/距离保底还需/)).toBeInTheDocument();
  });

  it('保底已满时不应显示剩余次数', () => {
    render(<ProbabilityDisclosure {...makeProps({ currentPityCount: 90 })} />);
    expect(screen.getByText('90/90')).toBeInTheDocument();
    expect(screen.queryByText(/距离保底还需/)).not.toBeInTheDocument();
  });

  it('应显示合规声明文案', () => {
    render(<ProbabilityDisclosure {...makeProps()} />);
    expect(screen.getByTestId('prob-compliance')).toBeInTheDocument();
    expect(screen.getByText(/概率已通过合规审查/)).toBeInTheDocument();
  });
});
