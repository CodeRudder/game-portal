/**
 * TechOfflinePanel — 离线研究面板测试
 *
 * 覆盖场景：
 * - 基础渲染：离线时长、完成研究、效果加成
 * - 科技点显示和分配按钮
 * - 空报告状态
 * - 科技重置：两步确认
 * - 关闭面板
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TechOfflinePanel from '../TechOfflinePanel';

// ── Mock CSS ──
vi.mock('../TechOfflinePanel.css', () => ({}));
vi.mock('../../../common/Modal.css', () => ({}));

// ── 测试数据 ──
const mockReport = {
  offlineSeconds: 7200,
  completedTechIds: ['tech-iron-weapons', 'tech-farming'],
  effectsGained: { attackMultiplier: 0.1, grainMultiplier: 0.15 },
  techPoints: 50,
};

const researchedTechs = [
  { id: 'tech-iron-weapons', name: '铁制兵器' },
  { id: 'tech-farming', name: '精耕细作' },
  { id: 'tech-archery', name: '弓箭改良' },
];

const defaultProps = {
  visible: true,
  report: mockReport,
  researchedTechs,
  onResetTech: vi.fn(),
  onClose: vi.fn(),
  onAllocatePoints: vi.fn(),
};

describe('TechOfflinePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 基础渲染 ──
  it('渲染面板容器', () => {
    render(<TechOfflinePanel {...defaultProps} />);
    expect(screen.getByTestId('tech-offline-panel')).toBeTruthy();
  });

  it('显示离线时长', () => {
    render(<TechOfflinePanel {...defaultProps} />);
    const duration = screen.getByTestId('offline-duration');
    expect(duration.textContent).toContain('2时0分');
  });

  it('显示完成的研究列表', () => {
    render(<TechOfflinePanel {...defaultProps} />);
    expect(screen.getByTestId('offline-tech-tech-iron-weapons')).toBeTruthy();
    expect(screen.getByTestId('offline-tech-tech-farming')).toBeTruthy();
  });

  it('显示效果加成', () => {
    render(<TechOfflinePanel {...defaultProps} />);
    expect(screen.getByTestId('offline-effect-attackMultiplier')).toBeTruthy();
    expect(screen.getByTestId('offline-effect-grainMultiplier')).toBeTruthy();
  });

  it('显示科技点', () => {
    render(<TechOfflinePanel {...defaultProps} />);
    const points = screen.getByTestId('offline-points');
    expect(points.textContent).toContain('50');
  });

  // ── 科技点分配 ──
  it('点击分配按钮触发回调', () => {
    render(<TechOfflinePanel {...defaultProps} />);
    const btn = screen.getByTestId('allocate-points-btn');
    fireEvent.click(btn);
    expect(defaultProps.onAllocatePoints).toHaveBeenCalledWith(50);
  });

  // ── 空报告 ──
  it('空报告显示空状态', () => {
    render(<TechOfflinePanel {...defaultProps} report={null} />);
    expect(screen.getByTestId('offline-empty')).toBeTruthy();
  });

  // ── 科技重置 ──
  it('显示科技重置按钮', () => {
    render(<TechOfflinePanel {...defaultProps} />);
    expect(screen.getByTestId('tech-reset-btn')).toBeTruthy();
  });

  it('第一次点击重置按钮显示确认', () => {
    render(<TechOfflinePanel {...defaultProps} />);
    const btn = screen.getByTestId('tech-reset-btn');
    fireEvent.click(btn);
    expect(btn.textContent).toContain('确认重置');
    expect(screen.getByTestId('tech-reset-cancel')).toBeTruthy();
  });

  it('第二次点击重置按钮触发重置回调', () => {
    render(<TechOfflinePanel {...defaultProps} />);
    const btn = screen.getByTestId('tech-reset-btn');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(defaultProps.onResetTech).toHaveBeenCalledOnce();
  });

  it('点击取消重置恢复初始状态', () => {
    render(<TechOfflinePanel {...defaultProps} />);
    const btn = screen.getByTestId('tech-reset-btn');
    fireEvent.click(btn);
    const cancel = screen.getByTestId('tech-reset-cancel');
    fireEvent.click(cancel);
    expect(screen.queryByTestId('tech-reset-cancel')).toBeNull();
    expect(btn.textContent).toContain('重置科技树');
  });

  // ── 不可见时不渲染 ──
  it('visible=false时不渲染', () => {
    render(<TechOfflinePanel {...defaultProps} visible={false} />);
    expect(screen.queryByTestId('tech-offline-panel')).toBeNull();
  });

  // ── 无已研究科技时不显示重置 ──
  it('无已研究科技时不显示重置按钮', () => {
    render(<TechOfflinePanel {...defaultProps} researchedTechs={[]} />);
    expect(screen.queryByTestId('tech-reset-section')).toBeNull();
  });
});
