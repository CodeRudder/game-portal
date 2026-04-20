/**
 * NPCDialogModal — NPC对话弹窗测试
 *
 * 覆盖场景：
 * - 基础渲染：弹窗容器、NPC名称、对话内容
 * - 对话选项：选项按钮、效果标签
 * - 对话结束：结束提示、关闭按钮
 * - 打字机效果：文本逐字显示
 * - 交互：选择选项、关闭弹窗
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import NPCDialogModal from '../NPCDialogModal';
import type { DialogNode, DialogOption } from '@/games/three-kingdoms/core/npc';

// ── Mock CSS ──
vi.mock('../NPCDialogModal.css', () => ({}));

// ── 测试数据 ──

const makeOption = (overrides: Partial<DialogOption> = {}): DialogOption => ({
  id: 'opt-1',
  text: '购买商品',
  nextNodeId: 'node-2',
  effects: [{ type: 'affinity_change', value: 10 }],
  ...overrides,
});

const makeNode = (overrides: Partial<DialogNode> = {}): DialogNode => ({
  id: 'node-1',
  speaker: '张商人',
  text: '欢迎光临！有什么需要的吗？',
  options: [
    makeOption({ id: 'opt-1', text: '购买商品' }),
    makeOption({ id: 'opt-2', text: '告辞' }),
  ],
  ...overrides,
});

// ── 测试 ──

describe('NPCDialogModal', () => {
  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();

  const defaultProps = {
    visible: true,
    npcName: '张商人',
    npcIcon: '🏪',
    currentNode: makeNode(),
    availableOptions: makeNode().options,
    dialogEnded: false,
    onSelectOption: mockOnSelect,
    onClose: mockOnClose,
  };

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

  it('visible=false 时不渲染', () => {
    render(<NPCDialogModal {...defaultProps} visible={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('应渲染弹窗容器', () => {
    render(<NPCDialogModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('应渲染NPC名称', () => {
    render(<NPCDialogModal {...defaultProps} />);
    expect(screen.getByText('张商人')).toBeInTheDocument();
  });

  it('应渲染对话文本（打字机效果完成后）', () => {
    render(<NPCDialogModal {...defaultProps} />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('欢迎光临！有什么需要的吗？')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 对话选项
  // ═══════════════════════════════════════════

  it('打字完成后应显示选项按钮', () => {
    render(<NPCDialogModal {...defaultProps} />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('购买商品')).toBeInTheDocument();
    expect(screen.getByText('告辞')).toBeInTheDocument();
  });

  it('选项应显示效果标签', () => {
    render(<NPCDialogModal {...defaultProps} />);
    act(() => { vi.advanceTimersByTime(3000); });
    const tags = screen.getAllByText(/❤️ 10/);
    expect(tags.length).toBeGreaterThanOrEqual(1);
  });

  // ═══════════════════════════════════════════
  // 3. 交互
  // ═══════════════════════════════════════════

  it('点击选项应调用 onSelectOption', () => {
    render(<NPCDialogModal {...defaultProps} />);
    act(() => { vi.advanceTimersByTime(3000); });
    fireEvent.click(screen.getByText('购买商品'));
    expect(mockOnSelect).toHaveBeenCalledWith('opt-1');
  });

  it('点击关闭按钮应调用 onClose', () => {
    render(<NPCDialogModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('关闭对话'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩层应调用 onClose', () => {
    render(<NPCDialogModal {...defaultProps} />);
    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 4. 对话结束
  // ═══════════════════════════════════════════

  it('对话结束时显示结束提示', () => {
    render(<NPCDialogModal {...defaultProps} currentNode={null} dialogEnded={true} />);
    expect(screen.getByText('对话已结束')).toBeInTheDocument();
  });

  it('对话结束时显示关闭按钮', () => {
    render(<NPCDialogModal {...defaultProps} currentNode={null} dialogEnded={true} />);
    const closeBtn = screen.getByText('关闭');
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 5. 打字机效果
  // ═══════════════════════════════════════════

  it('打字过程中应显示光标', () => {
    render(<NPCDialogModal {...defaultProps} />);
    expect(screen.getByText('▌')).toBeInTheDocument();
  });

  it('点击内容区可跳过打字效果', () => {
    render(<NPCDialogModal {...defaultProps} />);
    const content = screen.getByText('▌').closest('.tk-dialog-content');
    if (content) fireEvent.click(content);
    expect(screen.getByText('欢迎光临！有什么需要的吗？')).toBeInTheDocument();
  });
});
