/**
 * BattleFormationModal — 布阵弹窗测试
 *
 * 覆盖场景（15个用例）：
 * - 基础渲染：弹窗容器、标题栏、关闭按钮
 * - 敌方阵容：显示敌方单位
 * - 战力对比：碾压/优势/势均力敌/危险
 * - 我方编队：前排/后排槽位
 * - 操作按钮：取消/一键布阵/出征
 * - 出征流程：点击出征→进入战斗
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BattleFormationModal from '../BattleFormationModal';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { Stage, EnemyUnitDef } from '@/games/three-kingdoms/engine/campaign/campaign.types';
import type { GeneralData } from '@/games/three-kingdoms/engine/hero/hero.types';
import { Quality } from '@/games/three-kingdoms/engine/hero/hero.types';

// ── Mock CSS ──
vi.mock('../BattleFormationModal.css', () => ({}));
vi.mock('../BattleScene.css', () => ({}));
vi.mock('../BattleAnimation.css', () => ({}));
vi.mock('../BattleResultModal.css', () => ({}));

// ── Mock BattleScene ──
vi.mock('../BattleScene', () => ({
  default: function MockBattleScene({ onBattleEnd }: { onBattleEnd: (r: any) => void }) {
    return <div data-testid="battle-scene">战斗场景</div>;
  },
}));

// ── Mock BattleResultModal ──
vi.mock('../BattleResultModal', () => ({
  default: function MockResultModal({ onConfirm }: { onConfirm: () => void }) {
    return <div data-testid="result-modal">结算弹窗<button onClick={onConfirm}>确认</button></div>;
  },
}));

// ── 测试数据 ──

const makeGeneral = (overrides: Partial<GeneralData> = {}): GeneralData => ({
  id: 'guanyu',
  name: '关羽',
  quality: Quality.LEGENDARY,
  baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
  level: 10,
  exp: 500,
  faction: 'shu',
  skills: [{ id: 's1', name: '青龙偃月', type: 'active', level: 1, description: '200%物伤' }],
  ...overrides,
});

const generals: GeneralData[] = [
  makeGeneral({ id: 'guanyu', name: '关羽', quality: Quality.LEGENDARY, baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 } }),
  makeGeneral({ id: 'zhangfei', name: '张飞', quality: Quality.EPIC, baseStats: { attack: 105, defense: 80, intelligence: 40, speed: 70 } }),
  makeGeneral({ id: 'liubei', name: '刘备', quality: Quality.RARE, baseStats: { attack: 80, defense: 85, intelligence: 90, speed: 75 } }),
];

const enemyUnits: EnemyUnitDef[] = [
  { id: 'e1', name: '黄巾兵', faction: 'qun', troopType: 'INFANTRY' as any, level: 5, attack: 50, defense: 30, intelligence: 20, speed: 40, maxHp: 500, position: 'front' },
  { id: 'e2', name: '黄巾弓手', faction: 'qun', troopType: 'ARCHER' as any, level: 5, attack: 60, defense: 20, intelligence: 25, speed: 45, maxHp: 400, position: 'back' },
];

const makeStage = (): Stage => ({
  id: 'chapter1_stage1',
  name: '黄巾之乱',
  type: 'normal',
  chapterId: 'chapter1',
  order: 1,
  description: '黄巾起义的第一战',
  enemyFormation: {
    id: 'ef1',
    name: '黄巾军',
    units: enemyUnits,
    recommendedPower: 1000,
  },
  baseRewards: { grain: 100, gold: 50 },
  baseExp: 200,
  firstClearRewards: { gold: 200 },
  firstClearExp: 100,
  threeStarBonusMultiplier: 1.5,
  dropTable: [],
  recommendedPower: 1000,
});

// ── Mock Engine ──

function makeMockEngine(generalList: GeneralData[] = generals) {
  const powerMap: Record<string, number> = {};
  generalList.forEach((g) => {
    const s = g.baseStats;
    powerMap[g.id] = Math.floor((s.attack * 2 + s.defense * 1.5 + s.intelligence * 2 + s.speed) * (1 + g.level * 0.05));
  });

  const mockFormation = {
    id: 'f1',
    name: '主力编队',
    slots: generalList.map((g) => g.id).concat(Array(6 - generalList.length).fill('')),
    isActive: true,
  };

  return {
    getGenerals: vi.fn(() => [...generalList]),
    getHeroSystem: vi.fn(() => ({
      calculatePower: vi.fn((g: GeneralData) => powerMap[g.id] ?? 0),
      getGeneral: vi.fn((id: string) => generalList.find((g) => g.id === id)),
      getGeneralsSortedByPower: vi.fn(() => [...generalList].sort((a, b) => (powerMap[b.id] ?? 0) - (powerMap[a.id] ?? 0))),
    })),
    getActiveFormation: vi.fn(() => mockFormation),
    getFormationSystem: vi.fn(() => ({})),
    createFormation: vi.fn(() => ({ id: 'f2', name: '新编队', slots: Array(6).fill(''), isActive: false })),
    setFormation: vi.fn(),
    getBattleEngine: vi.fn(() => ({})),
    completeBattle: vi.fn(),
  } as unknown as ThreeKingdomsEngine;
}

// ── 测试 ──

describe('BattleFormationModal', () => {
  const onClose = vi.fn();
  const defaultProps = {
    engine: makeMockEngine(),
    stage: makeStage(),
    onClose,
    snapshotVersion: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('应渲染弹窗遮罩层', () => {
    const { container } = render(<BattleFormationModal {...defaultProps} />);
    expect(container.querySelector('.tk-bfm-overlay')).toBeInTheDocument();
  });

  it('应渲染标题栏，显示关卡名称', () => {
    render(<BattleFormationModal {...defaultProps} />);
    expect(screen.getByText('黄巾之乱')).toBeInTheDocument();
  });

  it('应渲染关闭按钮', () => {
    render(<BattleFormationModal {...defaultProps} />);
    expect(screen.getByLabelText('关闭')).toBeInTheDocument();
  });

  it('点击关闭按钮应调用onClose', () => {
    render(<BattleFormationModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩层应调用onClose', () => {
    const { container } = render(<BattleFormationModal {...defaultProps} />);
    fireEvent.click(container.querySelector('.tk-bfm-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 2. 敌方阵容
  // ═══════════════════════════════════════════

  it('应显示敌方阵容区域', () => {
    render(<BattleFormationModal {...defaultProps} />);
    expect(screen.getByText(/敌方阵容/)).toBeInTheDocument();
    // "黄巾军"出现在section title中
    expect(screen.getByText(/黄巾军/)).toBeInTheDocument();
  });

  it('应显示敌方单位信息', () => {
    render(<BattleFormationModal {...defaultProps} />);
    expect(screen.getByText('黄巾兵')).toBeInTheDocument();
    expect(screen.getByText('黄巾弓手')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 战力对比
  // ═══════════════════════════════════════════

  it('应显示战力对比区域', () => {
    render(<BattleFormationModal {...defaultProps} />);
    expect(screen.getByText('我方战力')).toBeInTheDocument();
    expect(screen.getByText('推荐战力')).toBeInTheDocument();
    expect(screen.getByText('VS')).toBeInTheDocument();
  });

  it('我方战力远超推荐时应显示碾压', () => {
    // 高战力武将，远超1000推荐战力
    const strongGenerals = [makeGeneral({ id: 'g1', name: '吕布', baseStats: { attack: 200, defense: 150, intelligence: 100, speed: 120 } })];
    const engine = makeMockEngine(strongGenerals);
    render(<BattleFormationModal engine={engine} stage={makeStage()} onClose={onClose} snapshotVersion={1} />);
    expect(screen.getByText('碾压')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 我方编队
  // ═══════════════════════════════════════════

  it('应显示我方编队区域', () => {
    render(<BattleFormationModal {...defaultProps} />);
    expect(screen.getByText(/我方编队/)).toBeInTheDocument();
  });

  it('应显示前排和后排标签', () => {
    render(<BattleFormationModal {...defaultProps} />);
    // 前排/后排标签出现多次（敌方+我方）
    const frontLabels = screen.getAllByText('前排');
    const backLabels = screen.getAllByText('后排');
    expect(frontLabels.length).toBeGreaterThanOrEqual(1);
    expect(backLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('应显示编队中的武将名称', () => {
    render(<BattleFormationModal {...defaultProps} />);
    expect(screen.getByText('关羽')).toBeInTheDocument();
    expect(screen.getByText('张飞')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 5. 操作按钮
  // ═══════════════════════════════════════════

  it('应显示取消、一键布阵、出征按钮', () => {
    render(<BattleFormationModal {...defaultProps} />);
    expect(screen.getByText('取消')).toBeInTheDocument();
    expect(screen.getByText(/一键布阵/)).toBeInTheDocument();
    expect(screen.getByText(/出征/)).toBeInTheDocument();
  });

  it('点击出征应进入战斗场景', () => {
    render(<BattleFormationModal {...defaultProps} />);
    fireEvent.click(screen.getByText(/出征/));
    expect(screen.getByTestId('battle-scene')).toBeInTheDocument();
  });

  it('空编队时出征按钮应禁用', () => {
    const emptyEngine = makeMockEngine([]);
    render(<BattleFormationModal engine={emptyEngine} stage={makeStage()} onClose={onClose} snapshotVersion={1} />);
    const fightBtn = screen.getByText(/出征/);
    expect(fightBtn).toBeDisabled();
  });
});
