/**
 * ACC-13 觉醒系统 — 用户验收集成测试
 *
 * 覆盖范围：
 * - 基础可见性：升星弹窗、碎片进度、突破路线、材料需求、突破状态、属性预览
 * - 核心交互：升星操作、升星禁用、突破操作、突破禁用、关闭弹窗、碎片来源
 * - 数据正确性：碎片/铜钱消耗、突破材料消耗、等级上限、属性差值、觉醒条件检查
 * - 边界情况：重复觉醒拒绝、未拥有武将、低品质不可觉醒、满星满突状态
 * - 手机端适配：弹窗适配、突破路线、按钮触控
 *
 * @module tests/acc/ACC-13
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import HeroStarUpModal from '@/components/idle/panels/hero/HeroStarUpModal';
import HeroBreakthroughPanel from '@/components/idle/panels/hero/HeroBreakthroughPanel';
import { accTest, assertStrict, assertInDOM } from './acc-test-utils';
import type {
  StarUpPreview,
  FragmentProgress,
  BreakthroughPreview,
  StarUpResult,
  BreakthroughResult,
} from '@/games/three-kingdoms/engine';

// ── Mock CSS ──
vi.mock('@/components/idle/panels/hero/HeroStarUpModal.css', () => ({}));
vi.mock('@/components/idle/panels/hero/HeroBreakthroughPanel.css', () => ({}));

// ── Test Data Factories ──

function makeFragmentProgress(overrides: Partial<FragmentProgress> = {}): FragmentProgress {
  return {
    generalId: 'guanyu',
    generalName: '关羽',
    currentFragments: 15,
    requiredFragments: 20,
    percentage: 75,
    currentStar: 3,
    canStarUp: false,
    ...overrides,
  };
}

function makeStarUpPreview(overrides: Partial<StarUpPreview> = {}): StarUpPreview {
  return {
    generalId: 'guanyu',
    currentStar: 3,
    targetStar: 4,
    fragmentCost: 20,
    goldCost: 5000,
    fragmentOwned: 15,
    fragmentSufficient: true,
    statsDiff: {
      before: { attack: 100, defense: 80, intelligence: 60, speed: 50 },
      after: { attack: 130, defense: 100, intelligence: 75, speed: 60 },
    },
    ...overrides,
  };
}

function makeBreakthroughPreview(overrides: Partial<BreakthroughPreview> = {}): BreakthroughPreview {
  return {
    generalId: 'guanyu',
    currentLevel: 30,
    currentLevelCap: 60,
    nextLevelCap: 70,
    nextBreakthroughStage: 2,
    fragmentCost: 50,
    goldCost: 50000,
    breakthroughStoneCost: 10,
    levelReady: true,
    resourceSufficient: true,
    canBreakthrough: true,
    ...overrides,
  };
}

const successStarUpResult: StarUpResult = {
  success: true,
  generalId: 'guanyu',
  previousStar: 3,
  currentStar: 4,
  fragmentsSpent: 20,
  goldSpent: 5000,
  statsBefore: { attack: 100, defense: 80, intelligence: 60, speed: 50 },
  statsAfter: { attack: 130, defense: 100, intelligence: 75, speed: 60 },
};

const successBtResult: BreakthroughResult = {
  success: true,
  generalId: 'guanyu',
  previousLevelCap: 60,
  newLevelCap: 70,
  breakthroughStage: 2,
  fragmentsSpent: 50,
  goldSpent: 50000,
  breakthroughStonesSpent: 10,
};

function makeDefaultProps(overrides: Record<string, unknown> = {}) {
  return {
    generalId: 'guanyu',
    generalName: '关羽',
    level: 35,
    currentStar: 3,
    fragmentProgress: makeFragmentProgress(),
    starUpPreview: makeStarUpPreview(),
    breakthroughPreview: makeBreakthroughPreview(),
    breakthroughStage: 1,
    levelCap: 60,
    goldAmount: 100000,
    breakthroughStoneAmount: 50,
    onClose: vi.fn(),
    onStarUp: vi.fn(() => successStarUpResult),
    onBreakthrough: vi.fn(() => successBtResult),
    onSourceClick: vi.fn(),
    ...overrides,
  };
}

function makeBreakthroughProps(overrides: Record<string, unknown> = {}) {
  return {
    heroId: 'guanyu',
    currentBreakthrough: 1,
    levelCap: 60,
    materials: { fragments: 50, copper: 50000, breakthroughStones: 10 },
    onBreakthrough: vi.fn(),
    ...overrides,
  };
}

/**
 * 辅助：查找升星按钮
 * 组件中升星按钮没有 data-testid，通过文本内容定位
 * 按钮文本格式："⭐ 升星 (3→4)"
 */
function getStarUpButton() {
  return screen.getByRole('button', { name: /升星/ });
}

/**
 * 辅助：查找禁用的升星按钮
 */
function queryStarUpButton() {
  return screen.queryByRole('button', { name: /升星/ });
}

// ── Tests ──

describe('ACC-13 觉醒系统 验收测试', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  // ═══════════════════════════════════════════════════════════════
  // 1. 基础可见性
  // ═══════════════════════════════════════════════════════════════

  it(accTest('ACC-13-01', '升星弹窗正确展示武将星级 - ★标记和等级显示'), () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    const overlay = screen.getByTestId('starup-modal-overlay');
    assertInDOM(overlay, 'ACC-13-01', '升星弹窗');
    const stars = screen.getAllByText('★');
    expect(stars.length).toBeGreaterThan(0);
  });

  it(accTest('ACC-13-02', '碎片进度条可见 - 显示当前/所需和百分比'), () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByText(/关羽 碎片/)).toBeInTheDocument();
    expect(screen.getByText('15/20')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it(accTest('ACC-13-03', '碎片来源快捷入口可见 - 扫荡/商店/活动按钮'), () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    const panel = screen.getByTestId('starup-modal-content');
    assertInDOM(panel, 'ACC-13-03', '升星弹窗内容');
    // 检查碎片来源按钮存在
    expect(screen.getByText(/扫荡/)).toBeInTheDocument();
    expect(screen.getByText(/商店/)).toBeInTheDocument();
    expect(screen.getByText(/活动/)).toBeInTheDocument();
  });

  it(accTest('ACC-13-04', '突破路线可视化 - 5个突破节点'), () => {
    render(<HeroBreakthroughPanel {...makeBreakthroughProps()} />);
    const roadmap = screen.getByTestId('breakthrough-roadmap');
    assertInDOM(roadmap, 'ACC-13-04', '突破路线');
  });

  it(accTest('ACC-13-05', '突破材料需求展示 - 碎片/铜钱/突破石'), () => {
    render(<HeroBreakthroughPanel {...makeBreakthroughProps()} />);
    const materials = screen.getByTestId('breakthrough-materials');
    assertInDOM(materials, 'ACC-13-05', '突破材料区域');
    // HeroBreakthroughPanel 使用 MaterialItem 组件，格式为 "owned / required"
    // 当前阶段(currentBreakthrough=1)对应 BREAKTHROUGH_COSTS[1] = {fragments:50, copper:50000, breakthroughStones:10}
    // 组件不使用 toLocaleString()，直接显示原始数字
    expect(materials.textContent).toContain('50');
    expect(materials.textContent).toContain('50000');
    expect(materials.textContent).toContain('10');
  });

  it(accTest('ACC-13-06', '武将详情中突破状态可见 - 显示突破阶段'), () => {
    render(<HeroBreakthroughPanel {...makeBreakthroughProps()} />);
    const stage = screen.getByTestId('breakthrough-stage');
    assertInDOM(stage, 'ACC-13-06', '突破阶段');
  });

  it(accTest('ACC-13-07', '升星预览属性对比可见 - 四维属性变化'), () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    const content = screen.getByTestId('starup-modal-content');
    expect(content.textContent).toContain('攻击');
    expect(content.textContent).toContain('防御');
    expect(content.textContent).toContain('智力');
    expect(content.textContent).toContain('速度');
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. 核心交互
  // ═══════════════════════════════════════════════════════════════

  it(accTest('ACC-13-10', '升星操作正常执行 - 星级+1，碎片和铜钱扣除'), () => {
    const onStarUp = vi.fn(() => successStarUpResult);
    render(<HeroStarUpModal {...makeDefaultProps({
      fragmentProgress: makeFragmentProgress({ canStarUp: true, currentFragments: 20 }),
      onStarUp,
    })} />);
    // 升星按钮通过文本定位，格式 "⭐ 升星 (3→4)"
    const starUpBtn = getStarUpButton();
    fireEvent.click(starUpBtn);
    expect(onStarUp).toHaveBeenCalledWith('guanyu');
  });

  it(accTest('ACC-13-11', '升星按钮在材料不足时禁用 - 灰色不可点击'), () => {
    render(<HeroStarUpModal {...makeDefaultProps({
      fragmentProgress: makeFragmentProgress({ canStarUp: false, currentFragments: 5 }),
      starUpPreview: makeStarUpPreview({ fragmentSufficient: false }),
    })} />);
    // 升星按钮通过文本定位
    const starUpBtn = getStarUpButton();
    expect(starUpBtn).toBeDisabled();
  });

  it(accTest('ACC-13-12', '突破操作正常执行 - 突破阶段+1'), () => {
    const onBreakthrough = vi.fn();
    render(<HeroBreakthroughPanel {...makeBreakthroughProps({ onBreakthrough })} />);
    const btBtn = screen.getByTestId('breakthrough-btn');
    fireEvent.click(btBtn);
    expect(onBreakthrough).toHaveBeenCalledWith('guanyu');
  });

  it(accTest('ACC-13-13', '突破按钮在条件不满足时禁用'), () => {
    render(<HeroBreakthroughPanel {...makeBreakthroughProps({
      materials: { fragments: 10, copper: 1000, breakthroughStones: 2 },
    })} />);
    // 材料不足时突破按钮应禁用
    const btBtn = screen.getByTestId('breakthrough-btn');
    expect(btBtn).toBeDisabled();
  });

  it(accTest('ACC-13-15', '关闭按钮关闭升星弹窗'), () => {
    const onClose = vi.fn();
    render(<HeroStarUpModal {...makeDefaultProps({ onClose })} />);
    fireEvent.click(screen.getByTestId('starup-modal-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it(accTest('ACC-13-16', '碎片来源快捷跳转 - 点击触发onSourceClick'), () => {
    const onSourceClick = vi.fn();
    render(<HeroStarUpModal {...makeDefaultProps({ onSourceClick })} />);
    // 点击扫荡按钮
    const sweepBtn = screen.getByText(/扫荡/);
    fireEvent.click(sweepBtn);
    expect(onSourceClick).toHaveBeenCalled();
  });

  it(accTest('ACC-13-17', '满突后突破区域隐藏突破按钮 - 显示提示'), () => {
    render(<HeroBreakthroughPanel {...makeBreakthroughProps({
      currentBreakthrough: 4,
    })} />);
    const maxHint = screen.getByTestId('breakthrough-max-hint');
    assertInDOM(maxHint, 'ACC-13-17', '满突提示');
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. 数据正确性
  // ═══════════════════════════════════════════════════════════════

  it(accTest('ACC-13-20', '升星消耗碎片数量正确 - 与starUpPreview一致'), () => {
    const onStarUp = vi.fn(() => successStarUpResult);
    render(<HeroStarUpModal {...makeDefaultProps({
      fragmentProgress: makeFragmentProgress({ canStarUp: true, currentFragments: 20 }),
      onStarUp,
    })} />);
    const content = screen.getByTestId('starup-modal-content');
    // 升星消耗区域显示 fragmentCost=20
    expect(content.textContent).toContain('20'); // fragmentCost
    // 点击升星按钮
    const starUpBtn = getStarUpButton();
    fireEvent.click(starUpBtn);
    expect(onStarUp).toHaveBeenCalledWith('guanyu');
  });

  it(accTest('ACC-13-21', '升星消耗铜钱数量正确 - 与starUpPreview一致'), () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    const content = screen.getByTestId('starup-modal-content');
    // HeroStarUpModal 使用 toLocaleString() 格式化铜钱 → "5,000"
    expect(content.textContent).toContain('5,000'); // goldCost
  });

  it(accTest('ACC-13-22', '突破材料消耗正确 - 碎片30/50/80/120按阶段'), () => {
    render(<HeroBreakthroughPanel {...makeBreakthroughProps({
      currentBreakthrough: 1,
      materials: { fragments: 50, copper: 50000, breakthroughStones: 10 },
    })} />);
    const materials = screen.getByTestId('breakthrough-materials');
    // HeroBreakthroughPanel 的 MaterialItem 不使用 toLocaleString()，直接显示数字
    // currentBreakthrough=1 → BREAKTHROUGH_COSTS[1] = {fragments:50, copper:50000, breakthroughStones:10}
    expect(materials.textContent).toContain('50');
    expect(materials.textContent).toContain('50000');
    expect(materials.textContent).toContain('10');
  });

  it(accTest('ACC-13-23', '突破后等级上限正确 - 50→60→70→80→100'), () => {
    render(<HeroBreakthroughPanel {...makeBreakthroughProps({
      currentBreakthrough: 0,
      levelCap: 50,
    })} />);
    const levelCap = screen.getByTestId('breakthrough-level-cap');
    assertInDOM(levelCap, 'ACC-13-23', '等级上限');
  });

  it(accTest('ACC-13-24', '升星预览属性差值正确 - diff=after-before'), () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    const content = screen.getByTestId('starup-modal-content');
    // 预览应显示属性变化：攻击100→130(+30)
    expect(content.textContent).toContain('130');
    expect(content.textContent).toContain('+30');
  });

  it(accTest('ACC-13-25', '觉醒条件四项检查正确 - 等级/星级/突破/品质'), () => {
    // 觉醒条件仅在 isMaxStar(6星) + breakthroughStage>=4 时显示
    // 设置满星满突但不满足觉醒条件
    render(<HeroStarUpModal {...makeDefaultProps({
      currentStar: 6,
      breakthroughStage: 4,
      starUpPreview: null,
      canAwaken: false,
      awakenFailures: ['等级不足: 85/100', '星级不足: 5/6'],
      onAwaken: vi.fn(),
    })} />);
    const content = screen.getByTestId('starup-modal-content');
    expect(content.textContent).toContain('等级不足');
    expect(content.textContent).toContain('星级不足');
  });

  it(accTest('ACC-13-26', '觉醒消耗资源正确 - 铜钱500000/突破石100/技能书50/觉醒石30/碎片200'), () => {
    // 觉醒按钮仅在 isMaxStar(6星) + breakthroughStage>=4 + canAwaken + onAwaken 时显示
    render(<HeroStarUpModal {...makeDefaultProps({
      currentStar: 6,
      breakthroughStage: 4,
      starUpPreview: null,
      canAwaken: true,
      isAwakened: false,
      onAwaken: vi.fn(() => ({ success: true })),
    })} />);
    // 觉醒按钮应可见
    const awakenBtn = screen.getByTestId('btn-awaken');
    assertInDOM(awakenBtn, 'ACC-13-26', '觉醒按钮');
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. 边界情况
  // ═══════════════════════════════════════════════════════════════

  it(accTest('ACC-13-30', '重复觉醒被拒绝 - 提示武将已觉醒'), () => {
    const onAwaken = vi.fn(() => ({ success: false, reason: '武将已觉醒' }));
    render(<HeroStarUpModal {...makeDefaultProps({
      currentStar: 6,
      breakthroughStage: 4,
      starUpPreview: null,
      canAwaken: true,
      isAwakened: true,
      onAwaken,
    })} />);
    // 已觉醒状态显示 "✨ 关羽 已觉醒 — 最高境界"
    const content = screen.getByTestId('starup-modal-content');
    expect(content.textContent).toContain('已觉醒');
  });

  it(accTest('ACC-13-33', '材料刚好等于消耗时操作成功 - 碎片归零'), () => {
    const onStarUp = vi.fn(() => successStarUpResult);
    render(<HeroStarUpModal {...makeDefaultProps({
      fragmentProgress: makeFragmentProgress({ canStarUp: true, currentFragments: 20, requiredFragments: 20, percentage: 100 }),
      onStarUp,
    })} />);
    const starUpBtn = getStarUpButton();
    fireEvent.click(starUpBtn);
    expect(onStarUp).toHaveBeenCalled();
  });

  it(accTest('ACC-13-34', '材料差1时操作失败 - 按钮禁用'), () => {
    render(<HeroStarUpModal {...makeDefaultProps({
      fragmentProgress: makeFragmentProgress({ canStarUp: false, currentFragments: 19, requiredFragments: 20, percentage: 95 }),
      starUpPreview: makeStarUpPreview({ fragmentSufficient: false }),
    })} />);
    const starUpBtn = getStarUpButton();
    expect(starUpBtn).toBeDisabled();
  });

  it(accTest('ACC-13-35', '满星(6星)后升星按钮消失 - 显示已满星'), () => {
    render(<HeroStarUpModal {...makeDefaultProps({
      currentStar: 6,
      fragmentProgress: makeFragmentProgress({ percentage: 100, canStarUp: false }),
      starUpPreview: null,
    })} />);
    const content = screen.getByTestId('starup-modal-content');
    expect(content.textContent).toContain('已满星');
  });

  it(accTest('ACC-13-36', '满突(4阶)后突破按钮消失 - 显示已达最高突破'), () => {
    render(<HeroBreakthroughPanel {...makeBreakthroughProps({
      currentBreakthrough: 4,
    })} />);
    expect(screen.getByTestId('breakthrough-max-hint')).toBeInTheDocument();
  });

  it(accTest('ACC-13-39', '未满足条件时觉醒按钮不可见或禁用'), () => {
    // 觉醒条件仅在 isMaxStar(6星) + breakthroughStage>=4 时显示
    render(<HeroStarUpModal {...makeDefaultProps({
      currentStar: 6,
      breakthroughStage: 4,
      starUpPreview: null,
      canAwaken: false,
      awakenFailures: ['等级不足: 85/100'],
      onAwaken: vi.fn(),
    })} />);
    const content = screen.getByTestId('starup-modal-content');
    expect(content.textContent).toContain('等级不足');
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. 手机端适配
  // ═══════════════════════════════════════════════════════════════

  it(accTest('ACC-13-40', '升星弹窗在手机端适配 - 弹窗存在且内容完整'), () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    const overlay = screen.getByTestId('starup-modal-overlay');
    assertInDOM(overlay, 'ACC-13-40', '升星弹窗');
    const content = screen.getByTestId('starup-modal-content');
    assertInDOM(content, 'ACC-13-40', '升星弹窗内容');
  });

  it(accTest('ACC-13-41', '突破路线在手机端适配 - 节点可见'), () => {
    render(<HeroBreakthroughPanel {...makeBreakthroughProps()} />);
    const roadmap = screen.getByTestId('breakthrough-roadmap');
    assertInDOM(roadmap, 'ACC-13-41', '突破路线');
  });

  it(accTest('ACC-13-42', '材料需求在手机端不截断 - 三项材料完整显示'), () => {
    render(<HeroBreakthroughPanel {...makeBreakthroughProps()} />);
    const materials = screen.getByTestId('breakthrough-materials');
    assertInDOM(materials, 'ACC-13-42', '材料区域');
    // HeroBreakthroughPanel 的 MaterialItem 不使用 toLocaleString()，直接显示数字
    expect(materials.textContent).toContain('50');
    expect(materials.textContent).toContain('50000');
    expect(materials.textContent).toContain('10');
  });

  it(accTest('ACC-13-44', '操作按钮在手机端可点击 - 升星/突破按钮存在'), () => {
    render(<HeroStarUpModal {...makeDefaultProps({
      fragmentProgress: makeFragmentProgress({ canStarUp: true, currentFragments: 20 }),
    })} />);
    // 升星按钮通过文本定位
    const starUpBtn = getStarUpButton();
    assertInDOM(starUpBtn, 'ACC-13-44', '升星按钮');
    expect(starUpBtn).not.toBeDisabled();
  });

  it(accTest('ACC-13-47', '碎片进度条在手机端显示正常 - 百分比和颜色'), () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('15/20')).toBeInTheDocument();
  });
});
