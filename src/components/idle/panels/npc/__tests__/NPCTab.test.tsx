/**
 * NPCTab — NPC名册面板测试
 *
 * 覆盖场景：
 * - 基础渲染：面板容器、搜索栏、筛选栏、NPC卡片
 * - 职业筛选：全部/商人/谋士等
 * - 搜索功能：按名称搜索
 * - NPC卡片：好感度显示、操作按钮
 * - 空状态：无NPC/无搜索结果
 * - 点击交互：选择NPC、发起对话
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NPCTab from '../NPCTab';
import type { NPCData } from '@/games/three-kingdoms/core/npc';

// ── Mock CSS ──
vi.mock('../NPCTab.css', () => ({}));

// ── 测试数据 ──

const makeNPC = (overrides: Partial<NPCData> = {}): NPCData => ({
  id: 'npc-test-01',
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

const sampleNPCs: NPCData[] = [
  makeNPC({ id: 'n1', name: '张商人', profession: 'merchant', affinity: 50 }),
  makeNPC({ id: 'n2', name: '李谋士', profession: 'strategist', affinity: 30 }),
  makeNPC({ id: 'n3', name: '王武将', profession: 'warrior', affinity: 10 }),
  makeNPC({ id: 'n4', name: '赵工匠', profession: 'artisan', affinity: 85 }),
  makeNPC({ id: 'n5', name: '隐藏NPC', profession: 'traveler', visible: false, affinity: 0 }),
];

// ── 测试 ──

describe('NPCTab', () => {
  const mockOnSelect = vi.fn();
  const mockOnDialog = vi.fn();

  const defaultProps = {
    npcs: sampleNPCs,
    onSelectNPC: mockOnSelect,
    onStartDialog: mockOnDialog,
    visible: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('应渲染面板容器', () => {
    const { container } = render(<NPCTab {...defaultProps} />);
    expect(container.querySelector('.tk-npc-tab')).toBeInTheDocument();
  });

  it('visible=false 时不渲染', () => {
    const { container } = render(<NPCTab {...defaultProps} visible={false} />);
    expect(container.querySelector('.tk-npc-tab')).not.toBeInTheDocument();
  });

  it('应渲染搜索栏', () => {
    render(<NPCTab {...defaultProps} />);
    expect(screen.getByLabelText('搜索NPC')).toBeInTheDocument();
  });

  it('应渲染职业筛选栏', () => {
    render(<NPCTab {...defaultProps} />);
    expect(screen.getByRole('tablist', { name: '职业筛选' })).toBeInTheDocument();
  });

  it('应渲染可见的NPC卡片', () => {
    render(<NPCTab {...defaultProps} />);
    // 4个可见NPC: 张商人(友善), 李谋士(中立), 王武将(敌对), 赵工匠(羁绊)
    expect(screen.getByLabelText(/张商人.*友善/)).toBeInTheDocument();
    expect(screen.getByLabelText(/李谋士.*中立/)).toBeInTheDocument();
    expect(screen.getByLabelText(/王武将.*敌对/)).toBeInTheDocument();
    expect(screen.getByLabelText(/赵工匠.*羁绊/)).toBeInTheDocument();
  });

  it('不应渲染隐藏的NPC', () => {
    render(<NPCTab {...defaultProps} />);
    expect(screen.queryByText('隐藏NPC')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 好感度显示
  // ═══════════════════════════════════════════

  it('NPC卡片应显示好感度数值', () => {
    render(<NPCTab {...defaultProps} />);
    expect(screen.getByText(/50\)/)).toBeInTheDocument();
  });

  it('NPC卡片应显示好感度等级标签', () => {
    render(<NPCTab {...defaultProps} />);
    // 张商人(50)→友善, 王武将(10)→敌对, 赵工匠(85)→羁绊
    expect(screen.getByText(/友善/)).toBeInTheDocument();
    expect(screen.getByText(/敌对/)).toBeInTheDocument();
    expect(screen.getByText(/羁绊/)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 职业筛选
  // ═══════════════════════════════════════════

  it('点击"全部"应显示所有可见NPC', () => {
    render(<NPCTab {...defaultProps} />);
    const allBtn = screen.getByRole('tab', { name: /全部/ });
    fireEvent.click(allBtn);
    // 4 visible NPCs
    expect(screen.getByText('张商人')).toBeInTheDocument();
    expect(screen.getByText('李谋士')).toBeInTheDocument();
    expect(screen.getByText('王武将')).toBeInTheDocument();
    expect(screen.getByText('赵工匠')).toBeInTheDocument();
  });

  it('点击职业筛选应只显示对应NPC', () => {
    render(<NPCTab {...defaultProps} />);
    const merchantBtn = screen.getByRole('tab', { name: /商人/ });
    fireEvent.click(merchantBtn);
    expect(screen.getByText('张商人')).toBeInTheDocument();
    expect(screen.queryByText('李谋士')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 搜索功能
  // ═══════════════════════════════════════════

  it('搜索应过滤NPC列表', () => {
    render(<NPCTab {...defaultProps} />);
    const searchInput = screen.getByLabelText('搜索NPC');
    fireEvent.change(searchInput, { target: { value: '张' } });
    expect(screen.getByText('张商人')).toBeInTheDocument();
    expect(screen.queryByText('李谋士')).not.toBeInTheDocument();
  });

  it('无搜索结果应显示空状态', () => {
    render(<NPCTab {...defaultProps} />);
    const searchInput = screen.getByLabelText('搜索NPC');
    fireEvent.change(searchInput, { target: { value: '不存在的NPC' } });
    expect(screen.getByText('未找到匹配的NPC')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 5. 点击交互
  // ═══════════════════════════════════════════

  it('点击详情按钮应调用 onSelectNPC', () => {
    render(<NPCTab {...defaultProps} />);
    const detailBtns = screen.getAllByText('📋 详情');
    fireEvent.click(detailBtns[0]);
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('点击对话按钮应调用 onStartDialog', () => {
    render(<NPCTab {...defaultProps} />);
    const dialogBtns = screen.getAllByText('💬 对话');
    fireEvent.click(dialogBtns[0]);
    expect(mockOnDialog).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 6. 底部统计
  // ═══════════════════════════════════════════

  it('应显示NPC数量统计', () => {
    render(<NPCTab {...defaultProps} />);
    expect(screen.getByText(/共 4 \/ 4 位/)).toBeInTheDocument();
  });

  it('空NPC列表应显示空状态', () => {
    render(<NPCTab {...defaultProps} npcs={[]} />);
    expect(screen.getByText('暂无发现的NPC')).toBeInTheDocument();
  });
});
