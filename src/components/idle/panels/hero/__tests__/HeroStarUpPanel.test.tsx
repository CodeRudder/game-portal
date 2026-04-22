/**
 * HeroStarUpPanel — 武将升星面板测试
 *
 * 覆盖场景：
 * - 星级展示（1~6星）
 * - 碎片进度条（百分比/颜色/来源按钮）
 * - 升星预览（属性对比）
 * - 升星消耗（碎片+铜钱，充足/不足状态）
 * - 突破状态（阶段/消耗/等级要求）
 * - 升星/突破按钮（启用/禁用）
 * - 满星/满突状态
 * - 来源按钮点击回调
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HeroStarUpPanel from '../HeroStarUpPanel';
import type {
  StarUpPreview,
  FragmentProgress,
  BreakthroughPreview,
  StarUpResult,
  BreakthroughResult,
} from '@/games/three-kingdoms/engine';

// ── Mock CSS ──
vi.mock('../HeroStarUpPanel.css', () => ({}));

// ── 测试数据 ──

const makeFragmentProgress = (overrides: Partial<FragmentProgress> = {}): FragmentProgress => ({
  generalId: 'guanyu',
  generalName: '关羽',
  currentFragments: 15,
  requiredFragments: 80,
  percentage: 19,
  currentStar: 3,
  canStarUp: false,
  ...overrides,
});

const makeStarUpPreview = (overrides: Partial<StarUpPreview> = {}): StarUpPreview => ({
  generalId: 'guanyu',
  currentStar: 3,
  targetStar: 4,
  fragmentCost: 80,
  goldCost: 20000,
  fragmentOwned: 15,
  fragmentSufficient: false,
  statsDiff: {
    before: { attack: 400, defense: 300, intelligence: 200, speed: 150 },
    after: { attack: 480, defense: 360, intelligence: 240, speed: 180 },
  },
  ...overrides,
});

const makeBreakthroughPreview = (overrides: Partial<BreakthroughPreview> = {}): BreakthroughPreview => ({
  generalId: 'guanyu',
  currentLevel: 30,
  currentLevelCap: 30,
  nextLevelCap: 40,
  nextBreakthroughStage: 1,
  fragmentCost: 30,
  goldCost: 20000,
  breakthroughStoneCost: 5,
  levelReady: true,
  resourceSufficient: true,
  canBreakthrough: true,
  ...overrides,
});

const makeStarUpResult = (success: boolean): StarUpResult => ({
  success,
  generalId: 'guanyu',
  previousStar: 3,
  currentStar: success ? 4 : 3,
  fragmentsSpent: success ? 80 : 0,
  goldSpent: success ? 20000 : 0,
  statsBefore: { attack: 400, defense: 300, intelligence: 200, speed: 150 },
  statsAfter: success
    ? { attack: 480, defense: 360, intelligence: 240, speed: 180 }
    : { attack: 400, defense: 300, intelligence: 200, speed: 150 },
});

const makeBreakthroughResult = (success: boolean): BreakthroughResult => ({
  success,
  generalId: 'guanyu',
  previousLevelCap: 30,
  newLevelCap: success ? 40 : 30,
  breakthroughStage: success ? 1 : 0,
  fragmentsSpent: success ? 30 : 0,
  goldSpent: success ? 20000 : 0,
  breakthroughStonesSpent: success ? 5 : 0,
});

// ── 测试 ──

describe('HeroStarUpPanel', () => {
  const onStarUp = vi.fn();
  const onBreakthrough = vi.fn();
  const onSourceClick = vi.fn();

  const defaultProps = {
    generalId: 'guanyu',
    generalName: '关羽',
    level: 25,
    currentStar: 3,
    fragmentProgress: makeFragmentProgress(),
    starUpPreview: makeStarUpPreview(),
    breakthroughPreview: makeBreakthroughPreview(),
    breakthroughStage: 0,
    levelCap: 30,
    goldAmount: 50000,
    breakthroughStoneAmount: 10,
    onStarUp,
    onBreakthrough,
    onSourceClick,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 星级展示
  // ═══════════════════════════════════════════

  it('应渲染6颗星（3实3空）', () => {
    const { container } = render(<HeroStarUpPanel {...defaultProps} />);
    const filled = container.querySelectorAll('.tk-star-display-star--filled');
    const empty = container.querySelectorAll('.tk-star-display-star--empty');
    expect(filled).toHaveLength(3);
    expect(empty).toHaveLength(3);
  });

  it('应显示等级信息', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    expect(screen.getByText(/Lv\.25/)).toBeInTheDocument();
  });

  it('满星时应显示特殊样式', () => {
    const { container } = render(
      <HeroStarUpPanel {...defaultProps} currentStar={6} />,
    );
    const maxStars = container.querySelectorAll('.tk-star-display-star--max');
    expect(maxStars).toHaveLength(6);
  });

  // ═══════════════════════════════════════════
  // 2. 碎片进度
  // ═══════════════════════════════════════════

  it('应显示碎片数量', () => {
    const { container } = render(<HeroStarUpPanel {...defaultProps} />);
    // 碎片进度区域包含 "15/80"
    const countEl = container.querySelector('.tk-star-fragment-count');
    expect(countEl).toBeInTheDocument();
    expect(countEl?.textContent).toContain('15');
    expect(countEl?.textContent).toContain('80');
  });

  it('应显示进度百分比', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    expect(screen.getByText('19%')).toBeInTheDocument();
  });

  it('碎片充足时应显示绿色', () => {
    const { container } = render(
      <HeroStarUpPanel
        {...defaultProps}
        fragmentProgress={makeFragmentProgress({ currentFragments: 80, percentage: 100, canStarUp: true })}
      />,
    );
    const sufficient = container.querySelector('.tk-star-fragment-count--sufficient');
    expect(sufficient).toBeInTheDocument();
  });

  it('应显示碎片来源按钮', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    expect(screen.getByText('⚔️ 扫荡')).toBeInTheDocument();
    expect(screen.getByText('🏪 商店')).toBeInTheDocument();
    expect(screen.getByText('🎉 活动')).toBeInTheDocument();
  });

  it('点击来源按钮应调用onSourceClick', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('⚔️ 扫荡'));
    expect(onSourceClick).toHaveBeenCalledWith('sweep');
  });

  // ═══════════════════════════════════════════
  // 3. 升星预览
  // ═══════════════════════════════════════════

  it('应显示升星预览标题', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    expect(screen.getByText(/3星/)).toBeInTheDocument();
    expect(screen.getByText(/4星/)).toBeInTheDocument();
  });

  it('应显示属性名', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    expect(screen.getByText('攻击')).toBeInTheDocument();
    expect(screen.getByText('防御')).toBeInTheDocument();
    expect(screen.getByText('智力')).toBeInTheDocument();
    expect(screen.getByText('速度')).toBeInTheDocument();
  });

  it('应显示属性提升差异', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    expect(screen.getByText('(+80)')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 升星消耗
  // ═══════════════════════════════════════════

  it('应显示碎片消耗', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    expect(screen.getByText('碎片')).toBeInTheDocument();
  });

  it('应显示铜钱消耗', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    expect(screen.getByText('铜钱')).toBeInTheDocument();
  });

  it('碎片不足时应显示红色', () => {
    const { container } = render(
      <HeroStarUpPanel
        {...defaultProps}
        starUpPreview={makeStarUpPreview({ fragmentSufficient: false })}
      />,
    );
    const insufficient = container.querySelectorAll('.tk-star-cost-value--insufficient');
    expect(insufficient.length).toBeGreaterThanOrEqual(1);
  });

  // ═══════════════════════════════════════════
  // 5. 突破状态
  // ═══════════════════════════════════════════

  it('应显示突破标题', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    const btTitles = screen.getAllByText('🔮 突破');
    expect(btTitles.length).toBeGreaterThanOrEqual(1);
  });

  it('应显示突破阶段', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    expect(screen.getByText(/第1阶/)).toBeInTheDocument();
  });

  it('应显示等级要求', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    expect(screen.getByText(/Lv\.40/)).toBeInTheDocument();
  });

  it('等级满足时应显示已满足', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    expect(screen.getByText('✓ 已满足')).toBeInTheDocument();
  });

  it('等级不满足时应显示提示', () => {
    render(
      <HeroStarUpPanel
        {...defaultProps}
        breakthroughPreview={makeBreakthroughPreview({ levelReady: false })}
      />,
    );
    expect(screen.getByText(/需达到/)).toBeInTheDocument();
  });

  it('应显示突破消耗标签', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    // 碎片、铜钱、突破石
    expect(screen.getByText(/💎.*30/)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 6. 操作按钮
  // ═══════════════════════════════════════════

  it('应显示升星按钮', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    expect(screen.getByText(/升星/)).toBeInTheDocument();
  });

  it('应显示突破按钮', () => {
    render(<HeroStarUpPanel {...defaultProps} />);
    // 突破标题和按钮都包含 "🔮 突破"
    const btElements = screen.getAllByText('🔮 突破');
    expect(btElements.length).toBeGreaterThanOrEqual(2);
  });

  it('材料不足时升星按钮应禁用', () => {
    render(
      <HeroStarUpPanel
        {...defaultProps}
        starUpPreview={makeStarUpPreview({ fragmentSufficient: false })}
        goldAmount={100}
      />,
    );
    const starUpBtn = screen.getByText(/升星/);
    expect(starUpBtn).toBeDisabled();
  });

  it('点击升星按钮应调用onStarUp', () => {
    onStarUp.mockReturnValue(makeStarUpResult(true));
    render(
      <HeroStarUpPanel
        {...defaultProps}
        starUpPreview={makeStarUpPreview({ fragmentSufficient: true })}
        fragmentProgress={makeFragmentProgress({ currentFragments: 80, canStarUp: true })}
      />,
    );
    fireEvent.click(screen.getByText(/升星/));
    expect(onStarUp).toHaveBeenCalledWith('guanyu');
  });

  it('点击突破按钮应调用onBreakthrough', () => {
    onBreakthrough.mockReturnValue(makeBreakthroughResult(true));
    render(<HeroStarUpPanel {...defaultProps} />);
    // 找到突破按钮（在操作区，不是标题）
    const btButtons = screen.getAllByText('🔮 突破');
    // 最后一个是按钮
    fireEvent.click(btButtons[btButtons.length - 1]);
    expect(onBreakthrough).toHaveBeenCalledWith('guanyu');
  });

  // ═══════════════════════════════════════════
  // 7. 满星/满突
  // ═══════════════════════════════════════════

  it('满星满突时应显示最高境界提示', () => {
    render(
      <HeroStarUpPanel
        {...defaultProps}
        currentStar={6}
        breakthroughStage={4}
        starUpPreview={null}
        breakthroughPreview={null}
      />,
    );
    expect(screen.getByText(/已达最高境界/)).toBeInTheDocument();
  });

  it('满突时应显示最高突破提示', () => {
    render(
      <HeroStarUpPanel
        {...defaultProps}
        breakthroughStage={4}
        breakthroughPreview={null}
      />,
    );
    expect(screen.getByText(/已达最高突破/)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 8. 边界情况
  // ═══════════════════════════════════════════

  it('无碎片进度时不应崩溃', () => {
    render(
      <HeroStarUpPanel {...defaultProps} fragmentProgress={null} />,
    );
    expect(screen.getByText(/Lv\.25/)).toBeInTheDocument();
  });

  it('无升星预览时不应崩溃', () => {
    render(
      <HeroStarUpPanel {...defaultProps} starUpPreview={null} />,
    );
    expect(screen.getByText(/Lv\.25/)).toBeInTheDocument();
  });
});
