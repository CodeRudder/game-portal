/**
 * FormationSaveSlot — 阵容收藏测试
 *
 * 覆盖场景：
 * - 渲染测试（标题、方案列表、空状态）
 * - 保存交互（输入名称、点击保存）
 * - 加载/删除交互
 * - 收藏位已满状态
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FormationSaveSlot from '../FormationSaveSlot';

// ── Mock CSS ──
vi.mock('../FormationSaveSlot.css', () => ({}));

// ── 测试数据工厂 ──

const makeSlots = () => [
  { id: 'slot-1', name: '蜀国主力', heroIds: ['guanyu', 'zhangfei', 'liubei'] },
  { id: 'slot-2', name: '魏国速攻', heroIds: ['caocao', 'xuchu'] },
];

const makeProps = (overrides: Record<string, unknown> = {}) => ({
  slots: makeSlots(),
  onSave: vi.fn(),
  onLoad: vi.fn(),
  onDelete: vi.fn(),
  maxSlots: 3,
  ...overrides,
});

// ── 测试 ──

describe('FormationSaveSlot', () => {
  const onSave = vi.fn();
  const onLoad = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染测试
  // ═══════════════════════════════════════════

  it('应正常渲染组件', () => {
    render(<FormationSaveSlot {...makeProps({ onSave, onLoad, onDelete })} />);
    expect(screen.getByTestId('formation-save-slot')).toBeInTheDocument();
  });

  it('应显示标题和计数', () => {
    render(<FormationSaveSlot {...makeProps({ onSave, onLoad, onDelete })} />);
    expect(screen.getByText('💾 阵容收藏')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('应渲染已保存的方案列表', () => {
    render(<FormationSaveSlot {...makeProps({ onSave, onLoad, onDelete })} />);
    expect(screen.getByText('蜀国主力')).toBeInTheDocument();
    expect(screen.getByText('魏国速攻')).toBeInTheDocument();
  });

  it('应显示方案武将数量', () => {
    render(<FormationSaveSlot {...makeProps({ onSave, onLoad, onDelete })} />);
    expect(screen.getByText('武将 x3')).toBeInTheDocument();
    expect(screen.getByText('武将 x2')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 空状态
  // ═══════════════════════════════════════════

  it('无保存方案时应显示空状态', () => {
    render(<FormationSaveSlot {...makeProps({ slots: [], onSave, onLoad, onDelete })} />);
    expect(screen.getByText('暂无保存的阵容方案')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 保存交互
  // ═══════════════════════════════════════════

  it('输入名称后点击保存应调用onSave', () => {
    render(<FormationSaveSlot {...makeProps({ onSave, onLoad, onDelete })} />);
    const input = screen.getByTestId('formation-slot-name-input');
    fireEvent.change(input, { target: { value: '吴国阵容' } });
    fireEvent.click(screen.getByTestId('btn-save-formation'));
    expect(onSave).toHaveBeenCalledWith('吴国阵容');
  });

  it('名称为空时保存按钮应禁用', () => {
    render(<FormationSaveSlot {...makeProps({ onSave, onLoad, onDelete })} />);
    const btn = screen.getByTestId('btn-save-formation');
    expect(btn).toBeDisabled();
  });

  // ═══════════════════════════════════════════
  // 4. 加载/删除交互
  // ═══════════════════════════════════════════

  it('点击加载按钮应调用onLoad', () => {
    render(<FormationSaveSlot {...makeProps({ onSave, onLoad, onDelete })} />);
    fireEvent.click(screen.getByTestId('btn-load-slot-slot-1'));
    expect(onLoad).toHaveBeenCalledWith('slot-1');
  });

  it('点击删除按钮应调用onDelete', () => {
    render(<FormationSaveSlot {...makeProps({ onSave, onLoad, onDelete })} />);
    fireEvent.click(screen.getByTestId('btn-delete-slot-slot-2'));
    expect(onDelete).toHaveBeenCalledWith('slot-2');
  });

  // ═══════════════════════════════════════════
  // 5. 收藏位已满
  // ═══════════════════════════════════════════

  it('收藏位已满时应显示已满提示且无输入框', () => {
    const fullSlots = [
      { id: 's1', name: '方案1', heroIds: [] },
      { id: 's2', name: '方案2', heroIds: [] },
      { id: 's3', name: '方案3', heroIds: [] },
    ];
    render(<FormationSaveSlot {...makeProps({ slots: fullSlots, onSave, onLoad, onDelete })} />);
    expect(screen.getByText('收藏位已满（3/3）')).toBeInTheDocument();
    expect(screen.queryByTestId('formation-slot-name-input')).not.toBeInTheDocument();
  });
});
