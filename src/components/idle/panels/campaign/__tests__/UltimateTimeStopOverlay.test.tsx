/**
 * UltimateTimeStopOverlay — 大招时停面板 测试
 *
 * 覆盖场景：
 * - 隐藏状态不渲染
 * - 基础渲染：面板、标题、倒计时
 * - 就绪大招列表
 * - 点击确认释放
 * - 点击取消
 * - 超时自动释放
 * - 空列表不渲染
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import UltimateTimeStopOverlay from '../UltimateTimeStopOverlay';
import type { ReadyUltimateItem } from '../UltimateTimeStopOverlay';

// ── Mock CSS ──
vi.mock('../UltimateTimeStopOverlay.css', () => ({}));

// ── 测试数据 ──

const makeReadyItem = (overrides?: Partial<ReadyUltimateItem>): ReadyUltimateItem => ({
  unit: {
    id: 'guanyu',
    name: '关羽',
    faction: 'shu',
    position: 'front',
    hp: 1000,
    maxHp: 1000,
    attack: 120,
    defense: 90,
    speed: 78,
    rage: 100,
    maxRage: 100,
    isAlive: true,
    level: 10,
  },
  skills: [
    {
      id: 'skill_qinglong',
      name: '青龙偃月',
      type: 'active',
      rageCost: 100,
      currentCooldown: 0,
      baseCooldown: 3,
      targetCount: 3,
      multiplier: 2.5,
    },
  ],
  ...overrides,
});

// ── 测试 ──

describe('UltimateTimeStopOverlay', () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════
  // 1. 隐藏状态
  // ═══════════════════════════════════════════

  it('visible=false时不应渲染', () => {
    render(
      <UltimateTimeStopOverlay
        visible={false}
        readyItems={[makeReadyItem()]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.queryByTestId('ultimate-time-stop-overlay')).not.toBeInTheDocument();
  });

  it('readyItems为空时不应渲染', () => {
    render(
      <UltimateTimeStopOverlay
        visible={true}
        readyItems={[]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.queryByTestId('ultimate-time-stop-overlay')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 基础渲染
  // ═══════════════════════════════════════════

  it('visible=true且有就绪大招时应渲染面板', () => {
    render(
      <UltimateTimeStopOverlay
        visible={true}
        readyItems={[makeReadyItem()]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByTestId('ultimate-time-stop-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('ultimate-panel')).toBeInTheDocument();
  });

  it('应显示标题"大招就绪"', () => {
    render(
      <UltimateTimeStopOverlay
        visible={true}
        readyItems={[makeReadyItem()]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('⚡ 大招就绪')).toBeInTheDocument();
  });

  it('应显示倒计时', () => {
    render(
      <UltimateTimeStopOverlay
        visible={true}
        readyItems={[makeReadyItem()]}
        onConfirm={onConfirm}
        onCancel={onCancel}
        timeoutMs={5000}
      />,
    );
    expect(screen.getByTestId('ultimate-countdown')).toHaveTextContent('5s');
  });

  // ═══════════════════════════════════════════
  // 3. 就绪大招列表
  // ═══════════════════════════════════════════

  it('应显示就绪大招列表', () => {
    render(
      <UltimateTimeStopOverlay
        visible={true}
        readyItems={[makeReadyItem()]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByTestId('ultimate-ready-list')).toBeInTheDocument();
  });

  it('应显示武将名称和技能名称', () => {
    render(
      <UltimateTimeStopOverlay
        visible={true}
        readyItems={[makeReadyItem()]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('关羽')).toBeInTheDocument();
    expect(screen.getByText('青龙偃月')).toBeInTheDocument();
  });

  it('应显示怒气消耗', () => {
    render(
      <UltimateTimeStopOverlay
        visible={true}
        readyItems={[makeReadyItem()]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('100怒')).toBeInTheDocument();
  });

  it('多个就绪大招时应显示多个按钮', () => {
    const items = [
      makeReadyItem(),
      makeReadyItem({
        unit: {
          id: 'zhangfei',
          name: '张飞',
          faction: 'shu',
          position: 'front',
          hp: 800,
          maxHp: 800,
          attack: 100,
          defense: 70,
          speed: 60,
          rage: 100,
          maxRage: 100,
          isAlive: true,
          level: 10,
        },
        skills: [{
          id: 'skill_zhangba',
          name: '丈八蛇矛',
          type: 'active',
          rageCost: 100,
          currentCooldown: 0,
          baseCooldown: 3,
          targetCount: 1,
          multiplier: 3.0,
        }],
      }),
    ];
    render(
      <UltimateTimeStopOverlay
        visible={true}
        readyItems={items}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('关羽')).toBeInTheDocument();
    expect(screen.getByText('张飞')).toBeInTheDocument();
    expect(screen.getByText('青龙偃月')).toBeInTheDocument();
    expect(screen.getByText('丈八蛇矛')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 点击确认释放
  // ═══════════════════════════════════════════

  it('点击技能按钮应调用onConfirm', () => {
    render(
      <UltimateTimeStopOverlay
        visible={true}
        readyItems={[makeReadyItem()]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const btn = screen.getByTestId('ultimate-skill-btn-guanyu-skill_qinglong');
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledWith('guanyu', 'skill_qinglong');
  });

  // ═══════════════════════════════════════════
  // 5. 点击取消
  // ═══════════════════════════════════════════

  it('点击取消按钮应调用onCancel', () => {
    render(
      <UltimateTimeStopOverlay
        visible={true}
        readyItems={[makeReadyItem()]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const cancelBtn = screen.getByTestId('ultimate-cancel-btn');
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();
  });

  it('应显示取消按钮文字', () => {
    render(
      <UltimateTimeStopOverlay
        visible={true}
        readyItems={[makeReadyItem()]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('取消（使用普攻）')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 6. 超时自动释放
  // ═══════════════════════════════════════════

  it('超时后应自动调用onConfirm释放第一个就绪大招', () => {
    render(
      <UltimateTimeStopOverlay
        visible={true}
        readyItems={[makeReadyItem()]}
        onConfirm={onConfirm}
        onCancel={onCancel}
        timeoutMs={5000}
      />,
    );

    // 快进5秒
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onConfirm).toHaveBeenCalledWith('guanyu', 'skill_qinglong');
  });

  it('超时前点击确认不应触发超时自动释放', () => {
    render(
      <UltimateTimeStopOverlay
        visible={true}
        readyItems={[makeReadyItem()]}
        onConfirm={onConfirm}
        onCancel={onCancel}
        timeoutMs={5000}
      />,
    );

    // 在3秒时点击确认
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByTestId('ultimate-skill-btn-guanyu-skill_qinglong'));

    // 再快进到超时
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // onConfirm 应只被调用一次（手动点击的那次）
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('guanyu', 'skill_qinglong');
  });

  // ═══════════════════════════════════════════
  // 7. 倒计时更新
  // ═══════════════════════════════════════════

  it('倒计时每秒更新', () => {
    render(
      <UltimateTimeStopOverlay
        visible={true}
        readyItems={[makeReadyItem()]}
        onConfirm={onConfirm}
        onCancel={onCancel}
        timeoutMs={5000}
      />,
    );

    expect(screen.getByTestId('ultimate-countdown')).toHaveTextContent('5s');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('ultimate-countdown')).toHaveTextContent('4s');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('ultimate-countdown')).toHaveTextContent('3s');
  });
});
