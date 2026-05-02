/**
 * BattleScene — 战斗日志（BattleLog）折叠功能测试
 *
 * 覆盖场景（4个用例）：
 * - 应显示战斗日志区域
 * - 点击日志标题按钮应切换展开/收起
 * - 日志区域应有 aria-label 无障碍标注
 * - 展开时日志区域添加 expanded CSS 类
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BattleScene from '../BattleScene';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { Stage } from '@/games/three-kingdoms/engine/campaign/campaign.types';
import type { BattleResult, BattleState, BattleUnit, BattleTeam } from '@/games/three-kingdoms/engine/battle/battle.types';
import { BattleOutcome, BattlePhase } from '@/games/three-kingdoms/engine/battle/battle.types';

// ── Mock CSS ──
vi.mock('../BattleScene.css', () => ({}));
vi.mock('../BattleAnimation.css', () => ({}));

// ── Mock BattleAnimation hook ──
const mockLogs = [
  { id: 1, html: '关羽 发起攻击', type: 'ally' as const, parts: [{ type: 'actor', text: '关羽' }, { type: 'text', text: ' 发起攻击' }] },
  { id: 2, html: '黄巾兵 受到 500 伤害', type: 'enemy' as const, parts: [{ type: 'actor', text: '黄巾兵' }, { type: 'text', text: ' 受到 ' }, { type: 'damage', text: '500' }, { type: 'text', text: ' 伤害' }] },
  { id: 3, html: '暴击！', type: 'critical' as const, parts: [{ type: 'crit', text: '暴击！' }] },
];

const mockAllyUnit: BattleUnit = {
  id: 'guanyu', name: '关羽', faction: 'shu', position: 'front',
  hp: 1000, maxHp: 1000, attack: 120, defense: 90, speed: 78,
  rage: 0, maxRage: 100, isAlive: true, level: 10,
};

const mockEnemyUnit: BattleUnit = {
  id: 'e1', name: '黄巾兵', faction: 'qun', position: 'front',
  hp: 500, maxHp: 500, attack: 50, defense: 30, speed: 40,
  rage: 0, maxRage: 100, isAlive: true, level: 5,
};

const mockBattleState: BattleState = {
  phase: BattlePhase.ROUND_START,
  currentTurn: 1,
  maxTurns: 10,
  allyTeam: {
    id: 'ally',
    units: [mockAllyUnit],
    formationId: 'f1',
  },
  enemyTeam: {
    id: 'enemy',
    units: [mockEnemyUnit],
    formationId: 'ef1',
  },
  actionLog: [],
};

vi.mock('../BattleAnimation', () => ({
  useBattleAnimation: vi.fn(() => ({
    battleState: mockBattleState,
    battleResult: null,
    isFinished: false,
    actingUnitId: null,
    actingUnitSide: null,
    hitUnitIds: new Set(),
    dyingUnitIds: new Set(),
    skillActiveUnitId: null,
    critShake: false,
    damageFloats: [],
    logs: mockLogs,
    logAreaRef: { current: null },
    speed: 1 as const,
    setSpeed: vi.fn(),
    toggleSpeed: vi.fn(),
    skip: vi.fn(),
  })),
  // Re-export LogEntry type for consumers
}));

// ── Mock engine.buildTeamsForStage (facade method) ──

// ── 测试数据 ──

const makeStage = (): Stage => ({
  id: 'chapter1_stage1',
  name: '黄巾之乱',
  type: 'normal',
  chapterId: 'chapter1',
  order: 1,
  enemyFormation: {
    id: 'ef1',
    name: '黄巾军',
    units: [],
    recommendedPower: 1000,
  },
  baseRewards: { grain: 100, gold: 50 },
  baseExp: 200,
  firstClearRewards: { gold: 200 },
  firstClearExp: 100,
  threeStarBonusMultiplier: 1.5,
  dropTable: [],
  recommendedPower: 1000,
  description: '黄巾起义的第一战',
});

function makeMockEngine() {
  return {
    getBattleEngine: vi.fn(() => ({})),
    getFormationSystem: vi.fn(() => ({})),
    getHeroSystem: vi.fn(() => ({})),
    getVIPSystem: vi.fn(() => ({
      getEffectiveLevel: vi.fn(() => 0),
    })),
    buildTeamsForStage: vi.fn(() => ({
      allyTeam: {
        id: 'ally',
        units: [mockAllyUnit],
        formationId: 'f1',
      },
      enemyTeam: {
        id: 'enemy',
        units: [mockEnemyUnit],
        formationId: 'ef1',
      },
    })),
  } as unknown as ThreeKingdomsEngine;
}

// ── 测试 ──

describe('BattleScene — 战斗日志', () => {
  const onBattleEnd = vi.fn();
  const defaultProps = {
    engine: makeMockEngine(),
    stage: makeStage(),
    onBattleEnd,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 日志区域渲染
  // ═══════════════════════════════════════════

  it('应显示战斗日志区域', () => {
    const { container } = render(<BattleScene {...defaultProps} />);
    // 日志区域容器
    expect(container.querySelector('.tk-bs-log-area')).toBeInTheDocument();
    // 日志标题
    expect(screen.getByText('📜 战斗播报')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 展开/收起切换
  // ═══════════════════════════════════════════

  it('点击日志切换按钮应切换展开/收起状态', () => {
    const { container } = render(<BattleScene {...defaultProps} />);

    // 初始状态：收起（没有 expanded 类）
    const logArea = container.querySelector('.tk-bs-log-area');
    expect(logArea).not.toHaveClass('tk-bs-log-area--expanded');

    // 初始按钮显示"▲ 展开"
    const toggleBtn = screen.getByLabelText('展开日志');
    expect(toggleBtn).toHaveTextContent('▲ 展开');

    // 点击展开
    fireEvent.click(toggleBtn);

    // 展开后：添加 expanded 类
    expect(logArea).toHaveClass('tk-bs-log-area--expanded');

    // 按钮变为"▼ 收起"
    const collapseBtn = screen.getByLabelText('收起日志');
    expect(collapseBtn).toHaveTextContent('▼ 收起');

    // 再次点击收起
    fireEvent.click(collapseBtn);
    expect(logArea).not.toHaveClass('tk-bs-log-area--expanded');
  });

  // ═══════════════════════════════════════════
  // 3. aria-label 无障碍
  // ═══════════════════════════════════════════

  it('日志切换按钮应有正确的 aria-label', () => {
    render(<BattleScene {...defaultProps} />);

    // 收起状态
    expect(screen.getByLabelText('展开日志')).toBeInTheDocument();
    expect(screen.queryByLabelText('收起日志')).not.toBeInTheDocument();

    // 点击展开
    fireEvent.click(screen.getByLabelText('展开日志'));

    // 展开状态
    expect(screen.getByLabelText('收起日志')).toBeInTheDocument();
    expect(screen.queryByLabelText('展开日志')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 展开时 CSS 类变化
  // ═══════════════════════════════════════════

  it('展开时日志区域应添加 expanded CSS 类', () => {
    const { container } = render(<BattleScene {...defaultProps} />);
    const logArea = container.querySelector('.tk-bs-log-area')!;

    // 初始无 expanded
    expect(logArea.className).not.toContain('expanded');

    // 点击展开
    fireEvent.click(screen.getByLabelText('展开日志'));
    expect(logArea.className).toContain('expanded');

    // 点击收起
    fireEvent.click(screen.getByLabelText('收起日志'));
    expect(logArea.className).not.toContain('expanded');
  });
});
