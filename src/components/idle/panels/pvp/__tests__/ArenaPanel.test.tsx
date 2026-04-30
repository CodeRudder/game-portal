/**
 * ArenaPanel R4 — 竞技场面板测试
 *
 * 覆盖场景：
 * - P1-1: 空防守阵容引导提示
 * - P1-1: 低胜率策略建议
 * - P1-2: 挑战结果战斗摘要（评级/伤害/回合）
 * - P1-5: 对手详情（阵容预览/战力/最近战绩）
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ArenaPanel from '../ArenaPanel';

// ── Mock CSS ──
vi.mock('../ArenaPanel.css', () => ({}));

// ── Mock SharedPanel & Modal ──
vi.mock('@/components/idle/components/SharedPanel', () => ({
  default: ({ children, visible }: any) =>
    visible ? <div data-testid="shared-panel">{children}</div> : null,
}));

vi.mock('@/components/idle/common/Modal', () => ({
  default: ({ visible, title, children, onConfirm, confirmText }: any) =>
    visible ? (
      <div data-testid="modal" data-title={title}>
        <div data-testid="modal-body">{children}</div>
        <button data-testid="modal-confirm" onClick={onConfirm}>{confirmText}</button>
      </div>
    ) : null,
}));

// ── 测试数据工厂 ──

function makePlayerState(overrides: any = {}) {
  return {
    playerId: 'p1',
    score: 1200,
    rankId: 'GOLD_III',
    ranking: 42,
    dailyChallengesLeft: 5,
    dailyBoughtChallenges: 0,
    dailyManualRefreshes: 0,
    lastFreeRefreshTime: 0,
    opponents: [],
    defenseFormation: {
      slots: ['', '', '', '', ''],
      formation: 'FISH_SCALE',
      strategy: 'BALANCED',
    },
    defenseLogs: [],
    replays: [],
    arenaCoins: 150,
    ...overrides,
  };
}

function makeOpponent(overrides: any = {}) {
  return {
    playerId: 'opp1',
    playerName: '赵云',
    power: 8500,
    rankId: 'GOLD_II',
    score: 1350,
    ranking: 35,
    faction: 'SHU',
    defenseSnapshot: {
      slots: ['hero1', 'hero2', '', '', ''],
      formation: 'WEDGE',
      aiStrategy: 'AGGRESSIVE',
    },
    recentRecord: ['win', 'lose', 'win', 'win', 'lose'],
    ...overrides,
  };
}

/**
 * 构建模拟引擎
 * @param arenaOverrides 覆盖竞技场子系统的特定方法
 * @param playerStateOverrides 覆盖玩家状态
 */
function makeEngine(arenaOverrides: any = {}, playerStateOverrides: any = {}) {
  const playerState = makePlayerState(playerStateOverrides);
  const defaultArena = {
    getPlayerState: () => playerState,
    canChallenge: () => true,
    consumeChallenge: vi.fn(() => playerState),
    getDefenseStats: () => ({
      totalDefenses: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      suggestedStrategy: null,
    }),
    getAllPlayers: () => [],
    canFreeRefresh: () => true,
    freeRefresh: vi.fn(),
    manualRefresh: vi.fn(),
    buyChallenge: vi.fn(() => ({ cost: 50 })),
  };
  const arena = { ...defaultArena, ...arenaOverrides };

  return {
    getArenaSystem: () => arena,
    getPvPBattleSystem: () => ({
      executeBattle: vi.fn(() => ({
        battleId: 'b1',
        attackerWon: true,
        scoreChange: 15,
        totalTurns: 4,
        isTimeout: false,
        attackerNewScore: 1215,
        defenderNewScore: 1335,
        battleState: {
          actions: [
            { turn: 1, attackerName: '我方', targetName: '敌方', damage: 120 },
            { turn: 2, attackerName: '敌方', targetName: '我方', damage: 80 },
            { turn: 3, attackerName: '我方', targetName: '敌方', damage: 150 },
          ],
        },
      })),
      applyBattleResult: vi.fn(),
    }),
  };
}

// ── 测试 ──

describe('ArenaPanel R4', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────
  // P1-1: 空防守阵容引导提示
  // ──────────────────────────────────────────

  describe('P1-1: 空防守阵容引导', () => {
    it('首次进入且防守阵容为空时，显示"请设置防守阵容"引导', () => {
      const engine = makeEngine();
      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);

      expect(screen.getByTestId('arena-defense-guide')).toBeDefined();
      expect(screen.getByText('请设置防守阵容')).toBeDefined();
    });

    it('引导提示包含"立即设置"和"稍后"按钮', () => {
      const engine = makeEngine();
      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);

      expect(screen.getByTestId('arena-defense-guide-setup')).toBeDefined();
      expect(screen.getByTestId('arena-defense-guide-dismiss')).toBeDefined();
    });

    it('点击"稍后"关闭引导提示', () => {
      const engine = makeEngine();
      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByTestId('arena-defense-guide-dismiss'));
      expect(screen.queryByTestId('arena-defense-guide')).toBeNull();
    });

    it('防守阵容已设置时不显示引导提示', () => {
      const engine = makeEngine({}, {
        defenseFormation: {
          slots: ['hero1', 'hero2', 'hero3', '', ''],
          formation: 'FISH_SCALE',
          strategy: 'BALANCED',
        },
      });
      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);

      expect(screen.queryByTestId('arena-defense-guide')).toBeNull();
    });
  });

  // ──────────────────────────────────────────
  // P1-1: 低胜率策略建议
  // ──────────────────────────────────────────

  describe('P1-1: 低胜率策略建议', () => {
    it('防守胜率低于40%且防守>=5场时，显示策略建议', () => {
      const engine = makeEngine({
        getDefenseStats: () => ({
          totalDefenses: 8,
          wins: 2,
          losses: 6,
          winRate: 0.25,
          suggestedStrategy: 'DEFENSIVE',
        }),
      }, {
        defenseFormation: {
          slots: ['hero1', 'hero2', 'hero3', '', ''],
          formation: 'FISH_SCALE',
          strategy: 'BALANCED',
        },
      });
      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);

      expect(screen.getByTestId('arena-strategy-tip')).toBeDefined();
      expect(screen.getByText(/防守胜率仅25%/)).toBeDefined();
    });

    it('点击"调整"按钮打开防守编辑弹窗', () => {
      const engine = makeEngine({
        getDefenseStats: () => ({
          totalDefenses: 8,
          wins: 2,
          losses: 6,
          winRate: 0.25,
          suggestedStrategy: 'DEFENSIVE',
        }),
      }, {
        defenseFormation: {
          slots: ['hero1', 'hero2', 'hero3', '', ''],
          formation: 'FISH_SCALE',
          strategy: 'BALANCED',
        },
      });
      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByTestId('arena-strategy-tip-action'));
      // Modal should appear with defense edit title (title is set as data-attribute on modal)
      const modal = screen.getByTestId('modal');
      expect(modal.getAttribute('data-title')).toBe('🛡️ 防守阵容设置');
    });

    it('胜率>=40%时不显示策略建议', () => {
      const engine = makeEngine({
        getDefenseStats: () => ({
          totalDefenses: 10,
          wins: 6,
          losses: 4,
          winRate: 0.6,
          suggestedStrategy: null,
        }),
      }, {
        defenseFormation: {
          slots: ['hero1', 'hero2', 'hero3', '', ''],
          formation: 'FISH_SCALE',
          strategy: 'BALANCED',
        },
      });
      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);

      expect(screen.queryByTestId('arena-strategy-tip')).toBeNull();
    });
  });

  // ──────────────────────────────────────────
  // P1-2: 挑战结果战斗摘要
  // ──────────────────────────────────────────

  describe('P1-2: 挑战结果战斗摘要', () => {
    it('挑战胜利后显示战斗摘要弹窗', () => {
      const opp = makeOpponent();
      const engine = makeEngine({}, { opponents: [opp] });

      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);

      // 点击挑战
      fireEvent.click(screen.getByTestId('arena-panel-challenge-opp1'));

      // 战斗摘要弹窗出现
      expect(screen.getByTestId('arena-battle-summary')).toBeDefined();
    });

    it('战斗摘要包含评级（S/A/B/C/D）', () => {
      const opp = makeOpponent();
      const engine = makeEngine({}, { opponents: [opp] });

      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('arena-panel-challenge-opp1'));

      expect(screen.getByTestId('arena-battle-rating')).toBeDefined();
    });

    it('战斗摘要显示积分变化、回合数、超时状态', () => {
      const opp = makeOpponent();
      const engine = makeEngine({}, { opponents: [opp] });

      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('arena-panel-challenge-opp1'));

      const summary = screen.getByTestId('arena-battle-summary');
      expect(summary).toBeDefined();
      // 应包含积分变化
      expect(summary.textContent).toContain('+15');
      // 应包含回合数
      expect(summary.textContent).toContain('4回合');
      // 应包含超时状态
      expect(summary.textContent).toContain('正常');
    });

    it('战斗摘要显示当前积分', () => {
      const opp = makeOpponent();
      const engine = makeEngine({}, { opponents: [opp] });

      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('arena-panel-challenge-opp1'));

      const summary = screen.getByTestId('arena-battle-summary');
      expect(summary.textContent).toContain('1215');
    });

    it('战斗摘要显示战斗行动记录', () => {
      const opp = makeOpponent();
      const engine = makeEngine({}, { opponents: [opp] });

      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('arena-panel-challenge-opp1'));

      const summary = screen.getByTestId('arena-battle-summary');
      expect(summary.textContent).toContain('R1');
      expect(summary.textContent).toContain('伤害120');
    });
  });

  // ──────────────────────────────────────────
  // P1-5: 对手详情展示
  // ──────────────────────────────────────────

  describe('P1-5: 对手信息详情', () => {
    it('对手卡片显示段位信息', () => {
      const opp = makeOpponent();
      const engine = makeEngine({}, { opponents: [opp] });

      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);

      const card = screen.getByTestId('arena-panel-opponent-opp1');
      expect(card.textContent).toContain('黄金');
    });

    it('对手卡片显示战力、积分、排名', () => {
      const opp = makeOpponent();
      const engine = makeEngine({}, { opponents: [opp] });

      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);

      const card = screen.getByTestId('arena-panel-opponent-opp1');
      expect(card.textContent).toContain('8500');
      expect(card.textContent).toContain('1350');
      expect(card.textContent).toContain('35');
    });

    it('对手卡片显示阵容预览（阵型+武将阵位）', () => {
      const opp = makeOpponent();
      const engine = makeEngine({}, { opponents: [opp] });

      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);

      const formation = screen.getByTestId('arena-opp-formation-opp1');
      expect(formation).toBeDefined();
      expect(formation.textContent).toContain('锋矢阵');
      expect(formation.textContent).toContain('2/5');
    });

    it('对手卡片显示最近战绩', () => {
      const opp = makeOpponent();
      const engine = makeEngine({}, { opponents: [opp] });

      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);

      const record = screen.getByTestId('arena-opp-record-opp1');
      expect(record).toBeDefined();
      expect(record.textContent).toContain('胜');
      expect(record.textContent).toContain('负');
    });

    it('对手无防守快照时不显示阵容预览', () => {
      const opp = makeOpponent({ defenseSnapshot: null });
      const engine = makeEngine({}, { opponents: [opp] });

      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);

      expect(screen.queryByTestId('arena-opp-formation-opp1')).toBeNull();
    });

    it('对手无最近战绩时不显示战绩', () => {
      const opp = makeOpponent({ recentRecord: undefined, recentResults: undefined });
      const engine = makeEngine({}, { opponents: [opp] });

      render(<ArenaPanel engine={engine} visible={true} onClose={mockOnClose} />);

      expect(screen.queryByTestId('arena-opp-record-opp1')).toBeNull();
    });
  });
});
