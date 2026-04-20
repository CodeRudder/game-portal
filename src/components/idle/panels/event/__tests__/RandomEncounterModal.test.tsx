/**
 * RandomEncounterModal — 随机遭遇弹窗测试
 *
 * 覆盖场景：
 * - 基础渲染：弹窗容器、事件名称、描述
 * - 分类图标：军事/外交/经济等
 * - 选项显示：选项文本、后果标签
 * - 后果标签：正/负数值显示
 * - 交互：选择选项、关闭弹窗、忽略
 * - 优先级样式
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RandomEncounterModal from '../RandomEncounterModal';
import type { ActiveGameEvent, EventOption, EventConsequence } from '@/games/three-kingdoms/core/events';

// ── Mock CSS ──
vi.mock('../RandomEncounterModal.css', () => ({}));

// ── 测试数据 ──

const makeConsequence = (overrides: Partial<EventConsequence> = {}): EventConsequence => ({
  type: 'resource_change',
  target: 'gold',
  value: 100,
  description: '获得黄金',
  ...overrides,
});

const makeOption = (overrides: Partial<EventOption> = {}): EventOption => ({
  id: 'opt-accept',
  text: '接纳难民',
  description: '消耗粮食，获得民心',
  consequences: [
    makeConsequence({ type: 'resource_change', target: 'grain', value: -50, description: '消耗粮食' }),
    makeConsequence({ type: 'affinity_change', target: 'npc-01', value: 10, description: '好感度提升' }),
  ],
  aiWeight: 0.8,
  isDefault: true,
  ...overrides,
});

const makeEvent = (overrides: Partial<ActiveGameEvent> = {}): ActiveGameEvent => ({
  instanceId: 'evt-inst-001',
  eventId: 'evt-refugees',
  name: '流民潮',
  description: '大量流民涌入你的领地，请求庇护。',
  triggerType: 'random',
  category: 'social',
  priority: 'high',
  status: 'active',
  options: [
    makeOption({ id: 'opt-accept', text: '接纳难民' }),
    makeOption({
      id: 'opt-reject',
      text: '拒绝入城',
      description: undefined,
      consequences: [
        makeConsequence({ type: 'affinity_change', target: 'npc-01', value: -15, description: '好感度下降' }),
      ],
    }),
  ],
  triggeredAtTurn: 10,
  expiresAtTurn: 15,
  selectedOptionId: null,
  appliedConsequences: [],
  ...overrides,
});

// ── 测试 ──

describe('RandomEncounterModal', () => {
  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();

  const defaultProps = {
    visible: true,
    event: makeEvent(),
    onSelectOption: mockOnSelect,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('visible=false 时不渲染', () => {
    render(<RandomEncounterModal {...defaultProps} visible={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('event=null 时不渲染', () => {
    render(<RandomEncounterModal {...defaultProps} event={null} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('应渲染弹窗容器', () => {
    render(<RandomEncounterModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('应渲染事件名称', () => {
    render(<RandomEncounterModal {...defaultProps} />);
    expect(screen.getByText('流民潮')).toBeInTheDocument();
  });

  it('应渲染事件描述', () => {
    render(<RandomEncounterModal {...defaultProps} />);
    expect(screen.getByText(/大量流民涌入/)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 分类图标
  // ═══════════════════════════════════════════

  it('应显示分类标签', () => {
    render(<RandomEncounterModal {...defaultProps} />);
    expect(screen.getByText('社会')).toBeInTheDocument();
  });

  it('军事事件应显示军事标签', () => {
    render(<RandomEncounterModal {...defaultProps} event={makeEvent({ category: 'military' })} />);
    expect(screen.getByText('军事')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 选项显示
  // ═══════════════════════════════════════════

  it('应显示所有选项文本', () => {
    render(<RandomEncounterModal {...defaultProps} />);
    expect(screen.getByText('接纳难民')).toBeInTheDocument();
    expect(screen.getByText('拒绝入城')).toBeInTheDocument();
  });

  it('应显示选项描述', () => {
    render(<RandomEncounterModal {...defaultProps} />);
    expect(screen.getByText('消耗粮食，获得民心')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 后果标签
  // ═══════════════════════════════════════════

  it('应显示正面后果标签', () => {
    render(<RandomEncounterModal {...defaultProps} />);
    expect(screen.getByText(/好感度提升.*\+10/)).toBeInTheDocument();
  });

  it('应显示负面后果标签', () => {
    render(<RandomEncounterModal {...defaultProps} />);
    expect(screen.getByText(/消耗粮食.*-50/)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 5. 交互
  // ═══════════════════════════════════════════

  it('点击选项应调用 onSelectOption', () => {
    render(<RandomEncounterModal {...defaultProps} />);
    fireEvent.click(screen.getByText('接纳难民'));
    expect(mockOnSelect).toHaveBeenCalledWith('evt-inst-001', 'opt-accept');
  });

  it('点击关闭按钮应调用 onClose', () => {
    render(<RandomEncounterModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩层应调用 onClose', () => {
    render(<RandomEncounterModal {...defaultProps} />);
    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('点击"暂不处理"应调用 onClose', () => {
    render(<RandomEncounterModal {...defaultProps} />);
    fireEvent.click(screen.getByText('暂不处理'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 6. 优先级样式
  // ═══════════════════════════════════════════

  it('high优先级应添加对应CSS类', () => {
    const { container } = render(<RandomEncounterModal {...defaultProps} />);
    const modal = container.querySelector('.tk-encounter-modal');
    expect(modal?.className).toContain('tk-encounter--high');
  });

  it('urgent优先级应添加对应CSS类', () => {
    const { container } = render(
      <RandomEncounterModal {...defaultProps} event={makeEvent({ priority: 'urgent' })} />,
    );
    const modal = container.querySelector('.tk-encounter-modal');
    expect(modal?.className).toContain('tk-encounter--urgent');
  });
});
