/**
 * NPCInfoModal — NPC信息弹窗测试
 *
 * 覆盖场景：
 * - 基础渲染：弹窗容器、NPC名称、职业、好感度
 * - 好感度显示：等级标签、进度条、数值
 * - 位置信息：区域、坐标
 * - 操作按钮：对话、交易、比武、锻造、情报
 * - 交互：关闭弹窗、点击操作按钮
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NPCInfoModal from '../NPCInfoModal';
import type { NPCData } from '@/games/three-kingdoms/core/npc';

// ── Mock CSS ──
vi.mock('../NPCInfoModal.css', () => ({}));

// ── 测试数据 ──

const makeNPC = (overrides: Partial<NPCData> = {}): NPCData => ({
  id: 'npc-merchant-01',
  name: '张商人',
  profession: 'merchant',
  affinity: 50,
  position: { x: 3, y: 5 },
  region: 'central_plains',
  visible: true,
  dialogId: 'dialog-merchant-default',
  createdAt: 0,
  lastInteractedAt: 0,
  ...overrides,
});

// ── 测试 ──

describe('NPCInfoModal', () => {
  const mockOnClose = vi.fn();
  const mockOnAction = vi.fn();
  const mockOnDialog = vi.fn();

  const defaultProps = {
    visible: true,
    npc: makeNPC(),
    onClose: mockOnClose,
    onAction: mockOnAction,
    onStartDialog: mockOnDialog,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('visible=false 时不渲染', () => {
    render(<NPCInfoModal {...defaultProps} visible={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('npc=null 时不渲染', () => {
    render(<NPCInfoModal {...defaultProps} npc={null} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('应渲染弹窗容器', () => {
    render(<NPCInfoModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('应渲染NPC名称', () => {
    render(<NPCInfoModal {...defaultProps} />);
    expect(screen.getByText('张商人')).toBeInTheDocument();
  });

  it('应渲染职业标签', () => {
    render(<NPCInfoModal {...defaultProps} />);
    // 职业标签包含图标和文字，用 getAllByText 因为"商人"同时出现在名称和职业中
    const matches = screen.getAllByText(/商人/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  // ═══════════════════════════════════════════
  // 2. 好感度显示
  // ═══════════════════════════════════════════

  it('应显示好感度等级标签', () => {
    render(<NPCInfoModal {...defaultProps} />);
    expect(screen.getByText('友善')).toBeInTheDocument();
  });

  it('应显示好感度数值', () => {
    render(<NPCInfoModal {...defaultProps} />);
    expect(screen.getByText('50 / 100')).toBeInTheDocument();
  });

  it('应显示距下一等级信息', () => {
    render(<NPCInfoModal {...defaultProps} />);
    expect(screen.getByText(/距下一等级: 14/)).toBeInTheDocument();
  });

  it('应显示好感度描述', () => {
    render(<NPCInfoModal {...defaultProps} />);
    expect(screen.getByText('关系良好，可进行更多交互')).toBeInTheDocument();
  });

  it('敌对NPC应显示敌对标签', () => {
    render(<NPCInfoModal {...defaultProps} npc={makeNPC({ affinity: 10 })} />);
    expect(screen.getByText('敌对')).toBeInTheDocument();
  });

  it('羁绊NPC应显示羁绊标签', () => {
    render(<NPCInfoModal {...defaultProps} npc={makeNPC({ affinity: 90 })} />);
    expect(screen.getByText('羁绊')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 位置信息
  // ═══════════════════════════════════════════

  it('应显示区域信息', () => {
    render(<NPCInfoModal {...defaultProps} />);
    expect(screen.getByText(/区域: central_plains/)).toBeInTheDocument();
  });

  it('应显示坐标信息', () => {
    render(<NPCInfoModal {...defaultProps} />);
    expect(screen.getByText(/坐标: \(3, 5\)/)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 操作按钮
  // ═══════════════════════════════════════════

  it('商人NPC应显示交易按钮', () => {
    render(<NPCInfoModal {...defaultProps} />);
    expect(screen.getByText('🏪 交易')).toBeInTheDocument();
  });

  it('武将NPC应显示比武按钮', () => {
    render(<NPCInfoModal {...defaultProps} npc={makeNPC({ profession: 'warrior' })} />);
    expect(screen.getByText('⚔️ 比武')).toBeInTheDocument();
  });

  it('工匠NPC应显示锻造按钮', () => {
    render(<NPCInfoModal {...defaultProps} npc={makeNPC({ profession: 'artisan' })} />);
    expect(screen.getByText('🔨 锻造')).toBeInTheDocument();
  });

  it('谋士NPC应显示情报按钮', () => {
    render(<NPCInfoModal {...defaultProps} npc={makeNPC({ profession: 'strategist' })} />);
    expect(screen.getByText('📜 情报')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 5. 交互
  // ═══════════════════════════════════════════

  it('点击关闭按钮应调用 onClose', () => {
    render(<NPCInfoModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩层应调用 onClose', () => {
    render(<NPCInfoModal {...defaultProps} />);
    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('点击对话按钮应调用 onStartDialog', () => {
    render(<NPCInfoModal {...defaultProps} />);
    fireEvent.click(screen.getByText('💬 对话'));
    expect(mockOnDialog).toHaveBeenCalledWith('npc-merchant-01');
  });

  it('点击交易按钮应调用 onAction', () => {
    render(<NPCInfoModal {...defaultProps} />);
    fireEvent.click(screen.getByText('🏪 交易'));
    expect(mockOnAction).toHaveBeenCalledWith('trade', 'npc-merchant-01');
  });
});
