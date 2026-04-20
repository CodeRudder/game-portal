/**
 * TechTab — 科技树主面板 测试
 *
 * 覆盖场景（≥15个用例）：
 * - 三条路线Tab正确渲染
 * - 路线切换功能
 * - 科技节点正确渲染（各状态）
 * - 科技点信息显示
 * - 路线进度显示
 * - 点击节点打开详情
 * - 互斥分支锁定状态
 * - 研究中进度条
 * - 手机端底部浮动条
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TechTab from '../TechTab';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { TechNodeState, TechNodeDef } from '@/games/three-kingdoms/engine';
import {
  TECH_PATHS,
  TECH_PATH_LABELS,
  TECH_NODE_DEFS,
  getNodesByPath,
} from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('../TechTab.css', () => ({}));
vi.mock('../TechNodeDetailModal.css', () => ({}));
vi.mock('../TechResearchPanel.css', () => ({}));

// ─────────────────────────────────────────────
// Mock window.innerWidth
// ─────────────────────────────────────────────
const originalInnerWidth = window.innerWidth;

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
}

// ─────────────────────────────────────────────
// 创建默认节点状态
// ─────────────────────────────────────────────
function createDefaultNodeStates(): Record<string, TechNodeState> {
  const states: Record<string, TechNodeState> = {};
  for (const def of TECH_NODE_DEFS) {
    // 第一层无前置的节点设为 available，其余 locked
    const hasAvailable = def.prerequisites.length === 0;
    states[def.id] = {
      id: def.id,
      status: hasAvailable ? 'available' : 'locked',
      researchStartTime: null,
      researchEndTime: null,
    };
  }
  return states;
}

// ─────────────────────────────────────────────
// Mock Engine Factory
// ─────────────────────────────────────────────
function makeMockEngine(
  overrides: {
    nodeStates?: Record<string, TechNodeState>;
    researchQueue?: Array<{ techId: string; startTime: number; endTime: number }>;
    techPoints?: { current: number; totalEarned: number; totalSpent: number };
    productionRate?: number;
    chosenMutex?: Record<string, string>;
  } = {},
) {
  const nodeStates = overrides.nodeStates ?? createDefaultNodeStates();
  const queue = overrides.researchQueue ?? [];
  const techPoints = overrides.techPoints ?? { current: 500, totalEarned: 1000, totalSpent: 500 };
  const productionRate = overrides.productionRate ?? 0.5;
  const chosenMutex = overrides.chosenMutex ?? {};

  const mockTreeSystem = {
    getAllNodeStates: vi.fn(() => nodeStates),
    getNodeState: vi.fn((id: string) => nodeStates[id]),
    getNodeDef: vi.fn((id: string) => TECH_NODE_DEFS.find((d) => d.id === id)),
    getPathNodes: vi.fn((path: string) => getNodesByPath(path)),
    getEdges: vi.fn(() => []),
    getAllNodeDefs: vi.fn(() => TECH_NODE_DEFS),
    getChosenMutexNodes: vi.fn(() => chosenMutex),
    isMutexLocked: vi.fn((id: string) => {
      const def = TECH_NODE_DEFS.find((d) => d.id === id);
      if (!def?.mutexGroup) return false;
      const chosen = chosenMutex[def.mutexGroup];
      return !!chosen && chosen !== id;
    }),
    getMutexAlternatives: vi.fn((id: string) => {
      const def = TECH_NODE_DEFS.find((d) => d.id === id);
      if (!def?.mutexGroup) return [];
      return TECH_NODE_DEFS
        .filter((d) => d.mutexGroup === def.mutexGroup && d.id !== id)
        .map((d) => d.id);
    }),
    canResearch: vi.fn(() => ({ can: true })),
    arePrerequisitesMet: vi.fn(() => true),
    getUnmetPrerequisites: vi.fn(() => []),
    getPathProgress: vi.fn(() => ({ completed: 0, total: 8 })),
    getAllPathProgress: vi.fn(() => ({
      military: { completed: 0, total: 8 },
      economy: { completed: 0, total: 8 },
      culture: { completed: 0, total: 8 },
    })),
    completeNode: vi.fn(),
    setResearching: vi.fn(),
    cancelResearch: vi.fn(),
  };

  const mockResearchSystem = {
    getQueue: vi.fn(() => queue),
    getMaxQueueSize: vi.fn(() => 1),
    startResearch: vi.fn(() => ({ success: true })),
    cancelResearch: vi.fn(() => ({ success: true, refundPoints: 50 })),
    getResearchProgress: vi.fn(() => 0.6),
    getRemainingTime: vi.fn(() => 120),
    speedUp: vi.fn(() => ({ success: true, cost: 10, timeReduced: 60, completed: false })),
    calculateIngotCost: vi.fn(() => 5),
    calculateMandateCost: vi.fn(() => 3),
    isResearching: vi.fn(() => false),
  };

  const mockPointSystem = {
    getTechPointState: vi.fn(() => techPoints),
    getCurrentPoints: vi.fn(() => techPoints.current),
    getProductionRate: vi.fn(() => productionRate),
    canAfford: vi.fn(() => true),
    trySpend: vi.fn(() => ({ success: true })),
    spend: vi.fn(),
    getResearchSpeedMultiplier: vi.fn(() => 1.0),
  };

  return {
    getTechTreeSystem: vi.fn(() => mockTreeSystem),
    getTechResearchSystem: vi.fn(() => mockResearchSystem),
    getTechPointSystem: vi.fn(() => mockPointSystem),
  } as unknown as ThreeKingdomsEngine;
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────
describe('TechTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setViewport(1280);
  });

  afterEach(() => {
    setViewport(originalInnerWidth);
  });

  it('渲染科技树面板', () => {
    const engine = makeMockEngine();
    render(<TechTab engine={engine} snapshotVersion={0} />);
    expect(screen.getByTestId('tech-tab')).toBeInTheDocument();
  });

  it('显示三条路线Tab', () => {
    const engine = makeMockEngine();
    render(<TechTab engine={engine} snapshotVersion={0} />);
    for (const path of TECH_PATHS) {
      expect(screen.getByTestId(`tech-path-tab-${path}`)).toBeInTheDocument();
    }
  });

  it('路线Tab显示路线名称', () => {
    const engine = makeMockEngine();
    render(<TechTab engine={engine} snapshotVersion={0} />);
    for (const path of TECH_PATHS) {
      expect(screen.getByText(TECH_PATH_LABELS[path])).toBeInTheDocument();
    }
  });

  it('点击路线Tab切换激活状态', () => {
    const engine = makeMockEngine();
    render(<TechTab engine={engine} snapshotVersion={0} />);

    const ecoTab = screen.getByTestId('tech-path-tab-economy');
    fireEvent.click(ecoTab);
    expect(ecoTab).toHaveClass('tk-tech-path-tab--active');
  });

  it('显示科技点信息', () => {
    const engine = makeMockEngine();
    render(<TechTab engine={engine} snapshotVersion={0} />);
    expect(screen.getByText('📚 科技点:')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('显示科技点产出速率', () => {
    const engine = makeMockEngine({ productionRate: 0.5 });
    render(<TechTab engine={engine} snapshotVersion={0} />);
    expect(screen.getByText('+0.50/s')).toBeInTheDocument();
  });

  it('显示科技树画布', () => {
    const engine = makeMockEngine();
    render(<TechTab engine={engine} snapshotVersion={0} />);
    expect(screen.getByTestId('tech-canvas')).toBeInTheDocument();
  });

  it('PC端显示所有路线列', () => {
    setViewport(1280);
    const engine = makeMockEngine();
    render(<TechTab engine={engine} snapshotVersion={0} />);
    for (const path of TECH_PATHS) {
      expect(screen.getByTestId(`tech-path-${path}`)).toBeInTheDocument();
    }
  });

  it('显示路线进度', () => {
    const engine = makeMockEngine();
    render(<TechTab engine={engine} snapshotVersion={0} />);
    // 进度显示在Tab上
    const progressEls = screen.getAllByText(/0\/8/);
    expect(progressEls.length).toBeGreaterThanOrEqual(3);
  });

  it('渲染科技节点', () => {
    const engine = makeMockEngine();
    render(<TechTab engine={engine} snapshotVersion={0} />);
    // 检查第一层节点是否存在
    const milNodes = getNodesByPath('military');
    expect(screen.getByTestId(`tech-node-${milNodes[0].id}`)).toBeInTheDocument();
  });

  it('节点显示正确状态角标', () => {
    const engine = makeMockEngine();
    render(<TechTab engine={engine} snapshotVersion={0} />);
    // 第一层无前置节点应显示为 available
    const milNodes = getNodesByPath('military');
    const badge = screen.getByTestId(`tech-badge-${milNodes[0].id}`);
    expect(badge).toHaveTextContent('🔓');
  });

  it('点击节点打开详情弹窗', () => {
    const engine = makeMockEngine();
    render(<TechTab engine={engine} snapshotVersion={0} />);

    const milNodes = getNodesByPath('military');
    const firstNode = screen.getByTestId(`tech-node-${milNodes[0].id}`);
    fireEvent.click(firstNode);

    expect(screen.getByTestId('tech-detail-overlay')).toBeInTheDocument();
  });

  it('显示研究队列面板', () => {
    const engine = makeMockEngine();
    render(<TechTab engine={engine} snapshotVersion={0} />);
    expect(screen.getByTestId('tech-research-panel')).toBeInTheDocument();
  });

  it('研究中时显示节点进度条', () => {
    const nodeStates = createDefaultNodeStates();
    // 设置一个节点为研究中
    const milNodes = getNodesByPath('military');
    nodeStates[milNodes[0].id] = {
      id: milNodes[0].id,
      status: 'researching',
      researchStartTime: Date.now() - 60000,
      researchEndTime: Date.now() + 60000,
    };

    const engine = makeMockEngine({
      nodeStates,
      researchQueue: [{
        techId: milNodes[0].id,
        startTime: Date.now() - 60000,
        endTime: Date.now() + 60000,
      }],
    });
    render(<TechTab engine={engine} snapshotVersion={0} />);

    // 研究中节点应显示进度条
    const node = screen.getByTestId(`tech-node-${milNodes[0].id}`);
    const progressBar = node.querySelector('.tk-tech-node-progress');
    expect(progressBar).toBeInTheDocument();
  });

  it('手机端底部显示研究浮动条', () => {
    setViewport(375);
    const nodeStates = createDefaultNodeStates();
    const milNodes = getNodesByPath('military');
    nodeStates[milNodes[0].id] = {
      id: milNodes[0].id,
      status: 'researching',
      researchStartTime: Date.now() - 60000,
      researchEndTime: Date.now() + 60000,
    };

    const engine = makeMockEngine({
      nodeStates,
      researchQueue: [{
        techId: milNodes[0].id,
        startTime: Date.now() - 60000,
        endTime: Date.now() + 60000,
      }],
    });
    render(<TechTab engine={engine} snapshotVersion={0} />);

    expect(screen.getByTestId('tech-research-float')).toBeInTheDocument();
  });

  it('互斥锁定节点显示正确样式', () => {
    const nodeStates = createDefaultNodeStates();
    const milNodes = getNodesByPath('military');
    // 找到互斥组节点
    const mutexNode = milNodes.find((n) => n.mutexGroup);
    if (!mutexNode) return;

    // 模拟另一个节点被选中
    const altNode = milNodes.find(
      (n) => n.mutexGroup === mutexNode.mutexGroup && n.id !== mutexNode.id,
    );
    if (!altNode) return;

    nodeStates[altNode.id].status = 'completed';
    nodeStates[mutexNode.id].status = 'locked';

    const engine = makeMockEngine({
      nodeStates,
      chosenMutex: { [mutexNode.mutexGroup]: altNode.id },
    });
    render(<TechTab engine={engine} snapshotVersion={0} />);

    const node = screen.getByTestId(`tech-node-${mutexNode.id}`);
    expect(node).toHaveClass('tk-tech-node--mutex-locked');
  });

  it('已完成的节点显示完成角标', () => {
    const nodeStates = createDefaultNodeStates();
    const milNodes = getNodesByPath('military');
    nodeStates[milNodes[0].id] = {
      id: milNodes[0].id,
      status: 'completed',
      researchStartTime: null,
      researchEndTime: null,
    };

    const engine = makeMockEngine({ nodeStates });
    render(<TechTab engine={engine} snapshotVersion={0} />);

    const badge = screen.getByTestId(`tech-badge-${milNodes[0].id}`);
    expect(badge).toHaveTextContent('✅');
  });
});
