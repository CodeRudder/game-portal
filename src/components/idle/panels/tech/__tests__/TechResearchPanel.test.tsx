/**
 * TechResearchPanel — 研究队列面板 测试
 *
 * 覆盖场景（≥10个用例）：
 * - 渲染研究队列面板
 * - 显示队列标题和槽位数
 * - 空队列时显示空闲槽位
 * - 研究中显示进度和倒计时
 * - 加速按钮展开选项
 * - 天命加速功能
 * - 元宝加速功能
 * - 取消研究功能
 * - 多槽位队列显示
 * - 进度条正确渲染
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TechResearchPanel from '../TechResearchPanel';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import { TECH_NODE_DEFS, TECH_NODE_MAP } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('../TechResearchPanel.css', () => ({}));

// ─────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────
const milNode = TECH_NODE_DEFS.find((d) => d.id === 'mil_t1_attack')!;
const ecoNode = TECH_NODE_DEFS.find((d) => d.id === 'eco_t1_farming')!;

const activeSlot = {
  techId: milNode.id,
  startTime: Date.now() - 60000,
  endTime: Date.now() + 60000,
};

const queuedSlot = {
  techId: ecoNode.id,
  startTime: Date.now() + 60000,
  endTime: Date.now() + 180000,
};

// ─────────────────────────────────────────────
// Mock Engine Factory
// ─────────────────────────────────────────────
function makeMockEngine(
  overrides: {
    queue?: Array<{ techId: string; startTime: number; endTime: number }>;
    maxQueueSize?: number;
  } = {},
) {
  const queue = overrides.queue ?? [];
  const maxQueueSize = overrides.maxQueueSize ?? 1;

  const mockResearchSystem = {
    getQueue: vi.fn(() => queue),
    getMaxQueueSize: vi.fn(() => maxQueueSize),
    startResearch: vi.fn(() => ({ success: true })),
    cancelResearch: vi.fn(() => ({ success: true, refundPoints: 50 })),
    getResearchProgress: vi.fn((techId: string) => {
      if (techId === milNode.id) return 0.5;
      return 0;
    }),
    getRemainingTime: vi.fn((techId: string) => {
      if (techId === milNode.id) return 60;
      return 120;
    }),
    speedUp: vi.fn(() => ({ success: true, cost: 5, timeReduced: 60, completed: false })),
    calculateIngotCost: vi.fn(() => 2),
    calculateMandateCost: vi.fn(() => 3),
    isResearching: vi.fn(() => queue.length > 0),
  };

  const mockTreeSystem = {
    getNodeState: vi.fn(() => ({
      status: 'researching',
      researchStartTime: activeSlot.startTime,
      researchEndTime: activeSlot.endTime,
    })),
  };

  const mockPointSystem = {
    getCurrentPoints: vi.fn(() => 500),
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
describe('TechResearchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染研究队列面板', () => {
    const engine = makeMockEngine();
    render(<TechResearchPanel engine={engine} snapshotVersion={0} tick={0} />);
    expect(screen.getByTestId('tech-research-panel')).toBeInTheDocument();
  });

  it('显示队列标题和槽位数', () => {
    const engine = makeMockEngine();
    render(<TechResearchPanel engine={engine} snapshotVersion={0} tick={0} />);
    expect(screen.getByText('🔬 研究队列')).toBeInTheDocument();
    expect(screen.getByText('0/1')).toBeInTheDocument();
  });

  it('空队列时显示空闲槽位', () => {
    const engine = makeMockEngine({ queue: [] });
    render(<TechResearchPanel engine={engine} snapshotVersion={0} tick={0} />);
    expect(screen.getByTestId('research-slot-empty-0')).toBeInTheDocument();
    expect(screen.getByText('空闲槽位 1')).toBeInTheDocument();
  });

  it('有研究时显示研究槽位', () => {
    const engine = makeMockEngine({ queue: [activeSlot] });
    render(<TechResearchPanel engine={engine} snapshotVersion={0} tick={0} />);
    expect(screen.getByTestId(`research-slot-${milNode.id}`)).toBeInTheDocument();
    expect(screen.getByText(milNode.name)).toBeInTheDocument();
  });

  it('显示研究进度百分比', () => {
    const engine = makeMockEngine({ queue: [activeSlot] });
    render(<TechResearchPanel engine={engine} snapshotVersion={0} tick={0} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('显示剩余时间', () => {
    const engine = makeMockEngine({ queue: [activeSlot] });
    render(<TechResearchPanel engine={engine} snapshotVersion={0} tick={0} />);
    expect(screen.getByText(/⏱️/)).toBeInTheDocument();
  });

  it('点击加速按钮展开选项', () => {
    const engine = makeMockEngine({ queue: [activeSlot] });
    render(<TechResearchPanel engine={engine} snapshotVersion={0} tick={0} />);

    const speedupBtn = screen.getByTestId(`research-speedup-toggle-${milNode.id}`);
    fireEvent.click(speedupBtn);

    expect(screen.getByTestId(`speedup-options-${milNode.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`speedup-mandate-${milNode.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`speedup-ingot-${milNode.id}`)).toBeInTheDocument();
  });

  it('点击天命加速调用引擎', () => {
    const engine = makeMockEngine({ queue: [activeSlot] });
    render(<TechResearchPanel engine={engine} snapshotVersion={0} tick={0} />);

    // 展开加速选项
    fireEvent.click(screen.getByTestId(`research-speedup-toggle-${milNode.id}`));

    // 点击天命加速
    fireEvent.click(screen.getByTestId(`speedup-mandate-${milNode.id}`));

    expect(engine.getTechResearchSystem().speedUp).toHaveBeenCalledWith(
      milNode.id,
      'mandate',
      3,
    );
  });

  it('点击元宝加速调用引擎', () => {
    const engine = makeMockEngine({ queue: [activeSlot] });
    render(<TechResearchPanel engine={engine} snapshotVersion={0} tick={0} />);

    // 展开加速选项
    fireEvent.click(screen.getByTestId(`research-speedup-toggle-${milNode.id}`));

    // 点击元宝加速
    fireEvent.click(screen.getByTestId(`speedup-ingot-${milNode.id}`));

    expect(engine.getTechResearchSystem().speedUp).toHaveBeenCalledWith(
      milNode.id,
      'ingot',
      2,
    );
  });

  it('点击取消研究调用引擎', () => {
    const engine = makeMockEngine({ queue: [activeSlot] });
    render(<TechResearchPanel engine={engine} snapshotVersion={0} tick={0} />);

    fireEvent.click(screen.getByTestId(`research-cancel-${milNode.id}`));

    expect(engine.getTechResearchSystem().cancelResearch).toHaveBeenCalledWith(milNode.id);
  });

  it('多槽位队列正确显示', () => {
    const engine = makeMockEngine({
      queue: [activeSlot, queuedSlot],
      maxQueueSize: 2,
    });
    render(<TechResearchPanel engine={engine} snapshotVersion={0} tick={0} />);

    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getByTestId(`research-slot-${milNode.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`research-slot-${ecoNode.id}`)).toBeInTheDocument();
  });

  it('第一个槽位标记为活跃', () => {
    const engine = makeMockEngine({ queue: [activeSlot] });
    render(<TechResearchPanel engine={engine} snapshotVersion={0} tick={0} />);

    const slot = screen.getByTestId(`research-slot-${milNode.id}`);
    expect(slot).toHaveClass('tk-tech-research-slot--active');
  });

  it('再次点击加速按钮收起选项', () => {
    const engine = makeMockEngine({ queue: [activeSlot] });
    render(<TechResearchPanel engine={engine} snapshotVersion={0} tick={0} />);

    const speedupBtn = screen.getByTestId(`research-speedup-toggle-${milNode.id}`);
    // 展开
    fireEvent.click(speedupBtn);
    expect(screen.getByTestId(`speedup-options-${milNode.id}`)).toBeInTheDocument();

    // 收起
    fireEvent.click(speedupBtn);
    expect(screen.queryByTestId(`speedup-options-${milNode.id}`)).not.toBeInTheDocument();
  });

  it('进度条渲染正确宽度', () => {
    const engine = makeMockEngine({ queue: [activeSlot] });
    render(<TechResearchPanel engine={engine} snapshotVersion={0} tick={0} />);

    const fill = screen.getByTestId(`research-slot-${milNode.id}`)
      .querySelector('.tk-tech-research-progress-fill');
    expect(fill).toBeInTheDocument();
    expect(fill).toHaveStyle({ width: '50%' });
  });
});
