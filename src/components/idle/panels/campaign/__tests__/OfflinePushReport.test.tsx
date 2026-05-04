/**
 * OfflinePushReport — 离线推图战报子组件 测试
 *
 * 覆盖：
 * - 空状态提示
 * - 战报列表渲染（时间/胜负/关卡/奖励）
 * - aria-expanded 属性
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OfflinePushReport from '../OfflinePushReport';
import type { BattleLogEntry } from '../OfflinePushReport';

// ── Mock CSS ──
vi.mock('../OfflinePushPanel.css', () => ({}));

// ── 测试数据 ──

const makeLog = (overrides: Partial<BattleLogEntry> = {}): BattleLogEntry => ({
  id: 'log-1',
  timestamp: Date.now(),
  startStageId: '1-1',
  endStageId: '1-5',
  victories: 5,
  defeats: 0,
  totalAttempts: 5,
  totalResources: { grain: 1500, gold: 300 },
  totalExp: 1200,
  ...overrides,
});

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('OfflinePushReport', () => {
  it('渲染战报标题', () => {
    render(<OfflinePushReport battleLogs={[]} />);
    expect(screen.getByText('📜 推图战报')).toBeTruthy();
  });

  it('空战报显示空状态提示', () => {
    render(<OfflinePushReport battleLogs={[]} />);
    expect(screen.getByTestId('offline-push-empty')).toBeTruthy();
    expect(screen.getByText(/暂无战报/)).toBeTruthy();
  });

  it('空战报时 aria-expanded=false', () => {
    render(<OfflinePushReport battleLogs={[]} />);
    const title = screen.getByText('📜 推图战报');
    expect(title.getAttribute('aria-expanded')).toBe('false');
  });

  it('有战报时 aria-expanded=true', () => {
    const logs = [makeLog()];
    render(<OfflinePushReport battleLogs={logs} />);
    const title = screen.getByText('📜 推图战报');
    expect(title.getAttribute('aria-expanded')).toBe('true');
  });

  it('渲染战报条目 — 全胜', () => {
    const logs = [makeLog({ victories: 5, defeats: 0 })];
    render(<OfflinePushReport battleLogs={logs} />);
    expect(screen.getByText('全胜')).toBeTruthy();
  });

  it('渲染战报条目 — 有负场', () => {
    const logs = [makeLog({ victories: 3, defeats: 2 })];
    render(<OfflinePushReport battleLogs={logs} />);
    expect(screen.getByText('3胜2负')).toBeTruthy();
  });

  it('渲染关卡信息', () => {
    const logs = [makeLog({ startStageId: '2-1', endStageId: '2-8', totalAttempts: 8 })];
    render(<OfflinePushReport battleLogs={logs} />);
    expect(screen.getByText(/2-1 → 2-8/)).toBeTruthy();
    expect(screen.getByText(/8关/)).toBeTruthy();
  });

  it('渲染资源奖励（最多3项）', () => {
    const logs = [makeLog({
      totalResources: { grain: 1500, gold: 300, troops: 100 },
    })];
    render(<OfflinePushReport battleLogs={logs} />);
    expect(screen.getByText(/粮草/)).toBeTruthy();
    expect(screen.getByText(/铜钱/)).toBeTruthy();
    expect(screen.getByText(/兵力/)).toBeTruthy();
  });

  it('无资源奖励时不显示奖励区', () => {
    const logs = [makeLog({ totalResources: {} })];
    const { container } = render(<OfflinePushReport battleLogs={logs} />);
    // 不应出现 "×" 奖励标记
    const rewards = container.querySelector('.tk-offline-push-log-rewards');
    expect(rewards).toBeNull();
  });

  it('多条战报全部渲染', () => {
    const logs = [
      makeLog({ id: 'log-1', victories: 5, defeats: 0 }),
      makeLog({ id: 'log-2', victories: 3, defeats: 2 }),
    ];
    render(<OfflinePushReport battleLogs={logs} />);
    expect(screen.getByText('全胜')).toBeTruthy();
    expect(screen.getByText('3胜2负')).toBeTruthy();
  });
});
