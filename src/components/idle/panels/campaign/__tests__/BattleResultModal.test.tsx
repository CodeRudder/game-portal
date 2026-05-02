/**
 * BattleResultModal — 结算弹窗测试
 *
 * 覆盖场景（15个用例）：
 * - 胜利分支：标题/图标/星级/统计/奖励/确认按钮
 * - 失败分支：标题/图标/统计/建议/返回按钮
 * - 平局分支
 * - 星级评定：1星/2星/3星
 * - 首通奖励显示
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BattleResultModal from '../BattleResultModal';
import { BattleOutcome, StarRating } from '@/games/three-kingdoms/engine/battle/battle.types';
import type { BattleResult } from '@/games/three-kingdoms/engine/battle/battle.types';
import type { Stage } from '@/games/three-kingdoms/engine/campaign/campaign.types';

// ── Mock CSS ──
vi.mock('../BattleResultModal.css', () => ({}));

// ── 测试数据 ──

const makeStage = (overrides: Partial<Stage> = {}): Stage => ({
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
  ...overrides,
});

const makeVictoryResult = (overrides: Partial<BattleResult> = {}): BattleResult => ({
  outcome: BattleOutcome.VICTORY,
  stars: StarRating.THREE,
  totalTurns: 5,
  allySurvivors: 4,
  enemySurvivors: 0,
  allyTotalDamage: 5000,
  enemyTotalDamage: 2000,
  maxSingleDamage: 1500,
  maxCombo: 3,
  summary: '战斗胜利！',
  ...overrides,
});

const makeDefeatResult = (overrides: Partial<BattleResult> = {}): BattleResult => ({
  outcome: BattleOutcome.DEFEAT,
  stars: StarRating.NONE,
  totalTurns: 8,
  allySurvivors: 0,
  enemySurvivors: 3,
  allyTotalDamage: 1500,
  enemyTotalDamage: 4000,
  maxSingleDamage: 800,
  maxCombo: 1,
  summary: '战斗失败',
  ...overrides,
});

// ── 测试 ──

describe('BattleResultModal', () => {
  const onConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 胜利分支
  // ═══════════════════════════════════════════

  it('应渲染胜利弹窗容器', () => {
    const { container } = render(
      <BattleResultModal result={makeVictoryResult()} stage={makeStage()} onConfirm={onConfirm} />,
    );
    expect(container.querySelector('.tk-brm-result-title--victory')).toBeInTheDocument();
  });

  it('应显示胜利标题和图标', () => {
    render(<BattleResultModal result={makeVictoryResult()} stage={makeStage()} onConfirm={onConfirm} />);
    expect(screen.getAllByText('战斗胜利').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('🏆')).toBeInTheDocument();
  });

  it('应显示星级评定', () => {
    render(<BattleResultModal result={makeVictoryResult()} stage={makeStage()} onConfirm={onConfirm} />);
    const stars = screen.getAllByText('★');
    expect(stars).toHaveLength(3);
    // 3星没有空心星
    expect(screen.queryByText('☆')).not.toBeInTheDocument();
  });

  it('2星应显示2个实心星和1个空心星', () => {
    render(
      <BattleResultModal result={makeVictoryResult({ stars: StarRating.TWO })} stage={makeStage()} onConfirm={onConfirm} />,
    );
    expect(screen.getAllByText('★')).toHaveLength(2);
    expect(screen.getAllByText('☆')).toHaveLength(1);
  });

  it('1星应显示1个实心星和2个空心星', () => {
    render(
      <BattleResultModal result={makeVictoryResult({ stars: StarRating.ONE })} stage={makeStage()} onConfirm={onConfirm} />,
    );
    expect(screen.getAllByText('★')).toHaveLength(1);
    expect(screen.getAllByText('☆')).toHaveLength(2);
  });

  it('3星应显示完美通关', () => {
    render(<BattleResultModal result={makeVictoryResult()} stage={makeStage()} onConfirm={onConfirm} />);
    expect(screen.getByText('完美通关！')).toBeInTheDocument();
  });

  it('应显示战斗统计数据', () => {
    render(<BattleResultModal result={makeVictoryResult()} stage={makeStage()} onConfirm={onConfirm} />);
    expect(screen.getByText('回合数')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('存活人数')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('应显示奖励列表', () => {
    render(<BattleResultModal result={makeVictoryResult()} stage={makeStage()} onConfirm={onConfirm} />);
    expect(screen.getByText(/获得奖励/)).toBeInTheDocument();
    expect(screen.getByText('粮草')).toBeInTheDocument();
    expect(screen.getByText('铜钱')).toBeInTheDocument();
  });

  it('应显示首通奖励', () => {
    render(<BattleResultModal result={makeVictoryResult()} stage={makeStage()} onConfirm={onConfirm} />);
    expect(screen.getByText('首通 铜钱')).toBeInTheDocument();
  });

  it('点击确认按钮应调用onConfirm', () => {
    render(<BattleResultModal result={makeVictoryResult()} stage={makeStage()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('确认'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 2. 失败分支
  // ═══════════════════════════════════════════

  it('应渲染失败弹窗容器', () => {
    const { container } = render(
      <BattleResultModal result={makeDefeatResult()} stage={makeStage()} onConfirm={onConfirm} />,
    );
    expect(container.querySelector('.tk-brm-result-title--defeat')).toBeInTheDocument();
  });

  it('应显示失败标题和图标', () => {
    render(<BattleResultModal result={makeDefeatResult()} stage={makeStage()} onConfirm={onConfirm} />);
    // 标题和摘要都有"战斗失败"
    const failTexts = screen.getAllByText('战斗失败');
    expect(failTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('💀')).toBeInTheDocument();
  });

  it('应显示失败统计数据', () => {
    render(<BattleResultModal result={makeDefeatResult()} stage={makeStage()} onConfirm={onConfirm} />);
    expect(screen.getByText('我方伤害')).toBeInTheDocument();
    expect(screen.getByText('敌方伤害')).toBeInTheDocument();
  });

  it('应显示提升建议', () => {
    render(<BattleResultModal result={makeDefeatResult()} stage={makeStage()} onConfirm={onConfirm} />);
    expect(screen.getByText(/提升建议/)).toBeInTheDocument();
  });

  it('点击返回按钮应调用onConfirm', () => {
    render(<BattleResultModal result={makeDefeatResult()} stage={makeStage()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('返回'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 3. v3.0 P1：碎片掉落提示
  // ═══════════════════════════════════════════

  describe('碎片掉落提示', () => {
    it('胜利且有碎片时应显示碎片掉落区域', () => {
      const result = makeVictoryResult({
        fragmentRewards: { 'guanyu': 1 },
      });
      render(
        <BattleResultModal
          result={result}
          stage={makeStage()}
          onConfirm={onConfirm}
          isFirstClear={true}
          generalNames={{ guanyu: '关羽' }}
        />,
      );
      expect(screen.getByTestId('fragment-drop-section')).toBeInTheDocument();
      expect(screen.getByText(/武将碎片掉落/)).toBeInTheDocument();
    });

    it('胜利但无碎片时不应显示碎片区域', () => {
      const result = makeVictoryResult({ fragmentRewards: {} });
      render(
        <BattleResultModal
          result={result}
          stage={makeStage()}
          onConfirm={onConfirm}
        />,
      );
      expect(screen.queryByTestId('fragment-drop-section')).not.toBeInTheDocument();
    });

    it('失败时不应显示碎片区域', () => {
      const result = makeDefeatResult({ fragmentRewards: { 'guanyu': 1 } });
      render(
        <BattleResultModal
          result={result}
          stage={makeStage()}
          onConfirm={onConfirm}
          isFirstClear={false}
        />,
      );
      expect(screen.queryByTestId('fragment-drop-section')).not.toBeInTheDocument();
    });

    it('首通碎片应显示100%必掉标记', () => {
      const result = makeVictoryResult({
        fragmentRewards: { 'guanyu': 1 },
      });
      render(
        <BattleResultModal
          result={result}
          stage={makeStage()}
          onConfirm={onConfirm}
          isFirstClear={true}
          generalNames={{ guanyu: '关羽' }}
        />,
      );
      expect(screen.getByText('100%必掉')).toBeInTheDocument();
      expect(screen.getByText('关羽')).toBeInTheDocument();
    });

    it('非首通碎片应显示10%概率标记', () => {
      const result = makeVictoryResult({
        fragmentRewards: { 'zhaoyun': 1 },
      });
      render(
        <BattleResultModal
          result={result}
          stage={makeStage()}
          onConfirm={onConfirm}
          isFirstClear={false}
          generalNames={{ zhaoyun: '赵云' }}
        />,
      );
      expect(screen.getByText('10%概率')).toBeInTheDocument();
    });

    it('应显示碎片数量', () => {
      const result = makeVictoryResult({
        fragmentRewards: { 'guanyu': 3 },
      });
      render(
        <BattleResultModal
          result={result}
          stage={makeStage()}
          onConfirm={onConfirm}
          isFirstClear={true}
          generalNames={{ guanyu: '关羽' }}
        />,
      );
      expect(screen.getByTestId('fragment-count-guanyu')).toHaveTextContent('×3');
    });

    it('应显示碎片图标（武将名首字）', () => {
      const result = makeVictoryResult({
        fragmentRewards: { 'guanyu': 1 },
      });
      render(
        <BattleResultModal
          result={result}
          stage={makeStage()}
          onConfirm={onConfirm}
          isFirstClear={true}
          generalNames={{ guanyu: '关羽' }}
        />,
      );
      expect(screen.getByTestId('fragment-icon-guanyu')).toHaveTextContent('关');
    });

    it('多个碎片应全部显示', () => {
      const result = makeVictoryResult({
        fragmentRewards: { 'guanyu': 1, 'zhaoyun': 2 },
      });
      render(
        <BattleResultModal
          result={result}
          stage={makeStage()}
          onConfirm={onConfirm}
          isFirstClear={true}
          generalNames={{ guanyu: '关羽', zhaoyun: '赵云' }}
        />,
      );
      expect(screen.getByTestId('fragment-drop-guanyu')).toBeInTheDocument();
      expect(screen.getByTestId('fragment-drop-zhaoyun')).toBeInTheDocument();
      expect(screen.getByText('关羽')).toBeInTheDocument();
      expect(screen.getByText('赵云')).toBeInTheDocument();
    });

    it('无generalNames时应使用ID作为名称', () => {
      const result = makeVictoryResult({
        fragmentRewards: { 'guanyu': 1 },
      });
      render(
        <BattleResultModal
          result={result}
          stage={makeStage()}
          onConfirm={onConfirm}
          isFirstClear={true}
        />,
      );
      expect(screen.getByText('guanyu')).toBeInTheDocument();
    });
  });
});
