/**
 * TechNodeDetailModal — 科技节点详情弹窗 测试
 *
 * 覆盖场景（≥15个用例）：
 * - 弹窗正确渲染
 * - 显示科技信息（名称/描述/路线/层级）
 * - 显示效果列表
 * - 显示研究消耗（科技点/时间）
 * - 显示前置条件列表
 * - 互斥分支提示
 * - 可研究状态显示开始按钮
 * - 研究中状态显示加速/取消按钮
 * - 已完成状态显示已完成按钮
 * - 锁定状态显示条件未满足
 * - 科技点不足时禁用开始按钮
 * - ESC关闭弹窗
 * - 点击遮罩关闭
 * - 加速按钮功能
 * - 取消研究功能
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TechNodeDetailModal from '../TechNodeDetailModal';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { TechNodeDef, TechNodeState } from '@/games/three-kingdoms/engine';
import { TECH_NODE_DEFS, TECH_NODE_MAP } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('../TechNodeDetailModal.css', () => ({}));

// ─────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────
const militaryNode = TECH_NODE_DEFS.find((d) => d.id === 'mil_t1_attack')!;
const militaryT2Node = TECH_NODE_DEFS.find((d) => d.id === 'mil_t2_charge')!;
const mutexNode = TECH_NODE_DEFS.find((d) => d.id === 'mil_t3_blitz')!;
const mutexAlt = TECH_NODE_DEFS.find((d) => d.id === 'mil_t3_endurance')!;

function makeNodeState(
  status: TechNodeState['status'] = 'available',
): TechNodeState {
  return {
    id: militaryNode.id,
    status,
    researchStartTime: status === 'researching' ? Date.now() - 60000 : null,
    researchEndTime: status === 'researching' ? Date.now() + 60000 : null,
  };
}

// ─────────────────────────────────────────────
// Mock Engine Factory
// ─────────────────────────────────────────────
function makeMockEngine(overrides: { currentPoints?: number } = {}) {
  const currentPoints = overrides.currentPoints ?? 500;

  const mockTreeSystem = {
    getNodeState: vi.fn((id: string) => ({
      id,
      status: 'completed',
      researchStartTime: null,
      researchEndTime: null,
    })),
    getNodeDef: vi.fn((id: string) => TECH_NODE_MAP.get(id)),
    isMutexLocked: vi.fn(() => false),
    getMutexAlternatives: vi.fn((id: string) => {
      const def = TECH_NODE_MAP.get(id);
      if (!def?.mutexGroup) return [];
      return TECH_NODE_DEFS
        .filter((d) => d.mutexGroup === def.mutexGroup && d.id !== id)
        .map((d) => d.id);
    }),
    getChosenMutexNodes: vi.fn(() => ({})),
    canResearch: vi.fn(() => ({ can: true })),
    arePrerequisitesMet: vi.fn(() => true),
    getUnmetPrerequisites: vi.fn(() => []),
  };

  const mockResearchSystem = {
    getQueue: vi.fn(() => []),
    startResearch: vi.fn(() => ({ success: true })),
    cancelResearch: vi.fn(() => ({ success: true, refundPoints: 50 })),
    getResearchProgress: vi.fn(() => 0.5),
    getRemainingTime: vi.fn(() => 60),
    speedUp: vi.fn(() => ({ success: true, cost: 5, timeReduced: 60, completed: false })),
    calculateIngotCost: vi.fn(() => 2),
    calculateMandateCost: vi.fn(() => 3),
    isResearching: vi.fn(() => false),
  };

  const mockPointSystem = {
    getTechPointState: vi.fn(() => ({
      current: currentPoints,
      totalEarned: 1000,
      totalSpent: 500,
    })),
    getCurrentPoints: vi.fn(() => currentPoints),
    getProductionRate: vi.fn(() => 0.5),
    canAfford: vi.fn(() => currentPoints >= militaryNode.costPoints),
    trySpend: vi.fn(() => ({ success: true })),
  };

  return {
    getTechTreeSystem: vi.fn(() => mockTreeSystem),
    getTechResearchSystem: vi.fn(() => mockResearchSystem),
    getTechPointSystem: vi.fn(() => mockPointSystem),
  } as unknown as ThreeKingdomsEngine;
}

// ─────────────────────────────────────────────
// Default Props
// ─────────────────────────────────────────────
const defaultProps = {
  nodeDef: militaryNode,
  nodeState: makeNodeState('available'),
  engine: makeMockEngine(),
  onClose: vi.fn(),
  onStartResearch: vi.fn(),
  snapshotVersion: 0,
  tick: 0,
};

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────
describe('TechNodeDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染弹窗遮罩和面板', () => {
    render(<TechNodeDetailModal {...defaultProps} />);
    expect(screen.getByTestId('tech-detail-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('tech-detail-panel')).toBeInTheDocument();
  });

  it('显示科技名称', () => {
    render(<TechNodeDetailModal {...defaultProps} />);
    const nameEls = screen.getAllByText(militaryNode.name);
    expect(nameEls.length).toBeGreaterThanOrEqual(1);
  });

  it('显示科技描述', () => {
    render(<TechNodeDetailModal {...defaultProps} />);
    expect(screen.getByText(militaryNode.description)).toBeInTheDocument();
  });

  it('显示路线信息', () => {
    render(<TechNodeDetailModal {...defaultProps} />);
    expect(screen.getByText(/军事路线/)).toBeInTheDocument();
  });

  it('显示科技效果', () => {
    render(<TechNodeDetailModal {...defaultProps} />);
    expect(screen.getByText('效果预览')).toBeInTheDocument();
    // 效果值应显示
    const effectValues = screen.getAllByText(/\+10%/);
    expect(effectValues.length).toBeGreaterThan(0);
  });

  it('显示研究消耗科技点', () => {
    render(<TechNodeDetailModal {...defaultProps} />);
    expect(screen.getByText('📚 科技点')).toBeInTheDocument();
  });

  it('显示研究时间', () => {
    render(<TechNodeDetailModal {...defaultProps} />);
    expect(screen.getByText('⏱️ 研究时间')).toBeInTheDocument();
  });

  it('科技点足够时显示绿色', () => {
    render(<TechNodeDetailModal {...defaultProps} />);
    const costValue = screen.getByText(new RegExp(`${militaryNode.costPoints} / 500`));
    expect(costValue).toHaveClass('tk-tech-detail-cost-value--enough');
  });

  it('科技点不足时显示红色并禁用按钮', () => {
    const engine = makeMockEngine({ currentPoints: 10 });
    render(
      <TechNodeDetailModal
        {...defaultProps}
        engine={engine}
        nodeState={makeNodeState('available')}
      />,
    );
    const costValue = screen.getByText(new RegExp(`${militaryNode.costPoints} / 10`));
    expect(costValue).toHaveClass('tk-tech-detail-cost-value--not-enough');
    expect(screen.getByTestId('tech-detail-start')).toBeDisabled();
  });

  it('可研究状态显示开始研究按钮', () => {
    render(<TechNodeDetailModal {...defaultProps} />);
    expect(screen.getByTestId('tech-detail-start')).toBeInTheDocument();
    expect(screen.getByTestId('tech-detail-start')).toHaveTextContent('开始研究');
  });

  it('点击开始研究调用回调', () => {
    const onStartResearch = vi.fn();
    const onClose = vi.fn();
    render(
      <TechNodeDetailModal
        {...defaultProps}
        onStartResearch={onStartResearch}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId('tech-detail-start'));
    expect(onStartResearch).toHaveBeenCalledWith(militaryNode.id);
    expect(onClose).toHaveBeenCalled();
  });

  it('研究中状态显示加速和取消按钮', () => {
    render(
      <TechNodeDetailModal
        {...defaultProps}
        nodeState={makeNodeState('researching')}
      />,
    );
    expect(screen.getByTestId('tech-detail-speedup-mandate')).toBeInTheDocument();
    expect(screen.getByTestId('tech-detail-speedup-ingot')).toBeInTheDocument();
    expect(screen.getByTestId('tech-detail-cancel')).toBeInTheDocument();
  });

  it('已完成状态显示已完成按钮', () => {
    render(
      <TechNodeDetailModal
        {...defaultProps}
        nodeState={makeNodeState('completed')}
      />,
    );
    expect(screen.getByText('已完成 ✅')).toBeInTheDocument();
  });

  it('锁定状态显示条件未满足按钮', () => {
    render(
      <TechNodeDetailModal
        {...defaultProps}
        nodeState={makeNodeState('locked')}
      />,
    );
    expect(screen.getByText('条件未满足 🔒')).toBeInTheDocument();
  });

  it('显示前置条件列表', () => {
    render(
      <TechNodeDetailModal
        {...defaultProps}
        nodeDef={militaryT2Node}
        nodeState={{ id: militaryT2Node.id, status: 'locked', researchStartTime: null, researchEndTime: null }}
      />,
    );
    expect(screen.getByText('前置条件')).toBeInTheDocument();
    expect(screen.getByText(militaryNode.name)).toBeInTheDocument();
  });

  it('互斥节点显示互斥分支提示', () => {
    render(
      <TechNodeDetailModal
        {...defaultProps}
        nodeDef={mutexNode}
        nodeState={{ id: mutexNode.id, status: 'available', researchStartTime: null, researchEndTime: null }}
      />,
    );
    expect(screen.getByTestId('tech-detail-mutex')).toBeInTheDocument();
    expect(screen.getByText('⚠️ 互斥分支')).toBeInTheDocument();
  });

  it('点击关闭按钮调用onClose', () => {
    const onClose = vi.fn();
    render(<TechNodeDetailModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('tech-detail-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('点击遮罩层关闭弹窗', () => {
    const onClose = vi.fn();
    render(<TechNodeDetailModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('tech-detail-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('ESC键关闭弹窗', () => {
    const onClose = vi.fn();
    render(<TechNodeDetailModal {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('点击取消研究调用引擎', () => {
    const onClose = vi.fn();
    const engine = makeMockEngine();
    render(
      <TechNodeDetailModal
        {...defaultProps}
        engine={engine}
        nodeState={makeNodeState('researching')}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId('tech-detail-cancel'));
    expect(engine.getTechResearchSystem().cancelResearch).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
