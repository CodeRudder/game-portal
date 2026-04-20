/**
 * OfflineSummary 组件测试
 *
 * 覆盖：渲染、自定义sections、空数据、推断模式
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineSummary } from '../OfflineSummary';
import type { SummarySection } from '../OfflineSummary';

// ── Mock GameContext ──

vi.mock('../../context/GameContext', () => ({
  useGameContext: () => ({
    engine: {},
    snapshot: {
      resources: { grain: 1000, gold: 500, troops: 200, mandate: 50 },
      productionRates: { grain: 10, gold: 5, troops: 2, mandate: 0.5 },
      caps: { grain: 10000, gold: null, troops: 5000, mandate: null },
      buildings: {
        castle: { type: 'castle', level: 5, status: 'upgrading', upgradeStartTime: 1, upgradeEndTime: 2 },
        farmland: { type: 'farmland', level: 3, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
        market: { type: 'market', level: 2, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
        barracks: { type: 'barracks', level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
        smithy: { type: 'smithy', level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
        academy: { type: 'academy', level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
        clinic: { type: 'clinic', level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
        wall: { type: 'wall', level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
      },
      onlineSeconds: 100,
      calendar: {},
      heroes: [{ id: 'h1', name: '关羽', faction: 'shu', power: 5000 }],
      heroFragments: {},
      totalPower: 5000,
      formations: [],
      activeFormationId: null,
      campaignProgress: {},
      techState: { researchingTechId: 'tech_1', researchedTechIds: [], version: 1 },
    },
  }),
}));

describe('OfflineSummary', () => {
  // ── 自定义 sections ──

  it('渲染自定义摘要sections', () => {
    const sections: SummarySection[] = [
      {
        title: '建筑动态',
        icon: '🏛️',
        items: [
          { icon: '🔨', title: '主城升级', description: 'Lv.4 → Lv.5', valueChange: '+1', color: '#7EC850' },
        ],
      },
    ];
    render(<OfflineSummary sections={sections} />);
    expect(screen.getByText('建筑动态')).toBeInTheDocument();
    expect(screen.getByText('主城升级')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('空items显示"暂无变化"', () => {
    const sections: SummarySection[] = [
      { title: '科技进度', icon: '📚', items: [] },
    ];
    render(<OfflineSummary sections={sections} />);
    expect(screen.getByText('暂无变化')).toBeInTheDocument();
  });

  // ── 从引擎推断 ──

  it('不传sections时从引擎推断摘要', () => {
    render(<OfflineSummary />);
    expect(screen.getByText('离线回归摘要')).toBeInTheDocument();
    expect(screen.getByText('建筑动态')).toBeInTheDocument();
  });

  // ── 无障碍 ──

  it('具有 aria-label', () => {
    const sections: SummarySection[] = [
      { title: '测试', icon: '📋', items: [] },
    ];
    render(<OfflineSummary sections={sections} />);
    expect(screen.getByRole('region', { name: '离线回归摘要' })).toBeInTheDocument();
  });
});
