/**
 * SkillPanel — 技能面板测试
 *
 * 覆盖场景：
 * - 渲染测试（面板标题、技能数量、技能卡片）
 * - 技能信息（名称、类型、等级、描述、CD）
 * - 升级按钮（资源充足/不足/满级/未解锁）
 * - 效果对比展示
 * - 突破解锁标记
 * - 空状态
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SkillPanel from '../SkillPanel';
import type { SkillItem } from '../SkillPanel';

// ── Mock CSS ──
vi.mock('../SkillPanel.css', () => ({}));

// ── 测试数据工厂 ──

const makeSkill = (overrides: Partial<SkillItem> = {}): SkillItem => ({
  id: 'skill_001',
  name: '青龙偃月',
  type: 'active',
  level: 1,
  levelCap: 5,
  description: '对前方敌人造成大量伤害',
  unlocked: true,
  cooldown: 8,
  upgradeCost: { skillBook: 1, gold: 500 },
  ...overrides,
});

const makeProps = (overrides: Record<string, unknown> = {}) => ({
  heroId: 'guanyu',
  skills: [
    makeSkill({ id: 's1', name: '青龙偃月', type: 'active', level: 1 }),
    makeSkill({ id: 's2', name: '武圣', type: 'passive', level: 2 }),
  ],
  skillBookAmount: 10,
  goldAmount: 50000,
  onUpgrade: vi.fn(),
  ...overrides,
});

describe('SkillPanel', () => {
  const onUpgrade = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染测试
  // ═══════════════════════════════════════════

  it('应正常渲染面板', () => {
    render(<SkillPanel {...makeProps({ onUpgrade })} />);
    expect(screen.getByTestId('skill-panel')).toBeInTheDocument();
  });

  it('应显示面板标题', () => {
    render(<SkillPanel {...makeProps({ onUpgrade })} />);
    expect(screen.getByText('⚔️ 技能面板')).toBeInTheDocument();
  });

  it('应显示技能总数', () => {
    render(<SkillPanel {...makeProps({ onUpgrade })} />);
    expect(screen.getByText('共 2 个技能')).toBeInTheDocument();
  });

  it('应渲染所有技能卡片', () => {
    render(<SkillPanel {...makeProps({ onUpgrade })} />);
    expect(screen.getByTestId('skill-panel-card-0')).toBeInTheDocument();
    expect(screen.getByTestId('skill-panel-card-1')).toBeInTheDocument();
  });

  it('应显示技能名称', () => {
    render(<SkillPanel {...makeProps({ onUpgrade })} />);
    expect(screen.getByText('青龙偃月')).toBeInTheDocument();
    expect(screen.getByText('武圣')).toBeInTheDocument();
  });

  it('应显示技能类型标签', () => {
    render(<SkillPanel {...makeProps({ onUpgrade })} />);
    expect(screen.getByText('主动')).toBeInTheDocument();
    expect(screen.getByText('被动')).toBeInTheDocument();
  });

  it('应显示技能等级', () => {
    render(<SkillPanel {...makeProps({ onUpgrade })} />);
    expect(screen.getByText('Lv.1/5')).toBeInTheDocument();
    expect(screen.getByText('Lv.2/5')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 空状态
  // ═══════════════════════════════════════════

  it('空技能列表应显示空状态', () => {
    render(<SkillPanel {...makeProps({ skills: [], onUpgrade })} />);
    expect(screen.getByText('暂无技能数据')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 升级按钮 — 资源充足
  // ═══════════════════════════════════════════

  it('资源充足时升级按钮应可用', () => {
    render(<SkillPanel {...makeProps({ skillBookAmount: 10, goldAmount: 50000, onUpgrade })} />);
    expect(screen.getByTestId('btn-skillpanel-upgrade-0')).not.toBeDisabled();
  });

  it('点击升级按钮应调用 onUpgrade', () => {
    render(<SkillPanel {...makeProps({ onUpgrade })} />);
    fireEvent.click(screen.getByTestId('btn-skillpanel-upgrade-0'));
    expect(onUpgrade).toHaveBeenCalledWith('guanyu', 0);
  });

  // ═══════════════════════════════════════════
  // 4. 升级按钮 — 资源不足
  // ═══════════════════════════════════════════

  it('技能书不足时升级按钮应禁用', () => {
    render(<SkillPanel {...makeProps({ skillBookAmount: 0, goldAmount: 50000, onUpgrade })} />);
    expect(screen.getByTestId('btn-skillpanel-upgrade-0')).toBeDisabled();
  });

  it('铜钱不足时升级按钮应禁用', () => {
    render(<SkillPanel {...makeProps({ skillBookAmount: 10, goldAmount: 100, onUpgrade })} />);
    expect(screen.getByTestId('btn-skillpanel-upgrade-0')).toBeDisabled();
  });

  it('资源不足时应显示红色消耗数值', () => {
    const { container } = render(
      <SkillPanel {...makeProps({ skillBookAmount: 0, goldAmount: 0, onUpgrade })} />,
    );
    const insufficient = container.querySelectorAll('.tk-skillpanel-cost--insufficient');
    expect(insufficient.length).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════
  // 5. 满级状态
  // ═══════════════════════════════════════════

  it('满级技能应显示"已满级"标签', () => {
    const skills = [makeSkill({ id: 's1', name: '青龙偃月', level: 5, levelCap: 5 })];
    render(<SkillPanel {...makeProps({ skills, onUpgrade })} />);
    expect(screen.getByText('✅ 已满级')).toBeInTheDocument();
  });

  it('满级技能不应显示升级按钮', () => {
    const skills = [makeSkill({ id: 's1', name: '青龙偃月', level: 5, levelCap: 5 })];
    render(<SkillPanel {...makeProps({ skills, onUpgrade })} />);
    expect(screen.queryByTestId('btn-skillpanel-upgrade-0')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 6. 未解锁技能
  // ═══════════════════════════════════════════

  it('未解锁技能应显示解锁条件', () => {
    const skills = [
      makeSkill({
        id: 's3',
        name: '觉醒技',
        unlocked: false,
        unlockCondition: { breakthroughStage: 1, description: '需要突破1阶' },
      }),
    ];
    render(<SkillPanel {...makeProps({ skills, onUpgrade })} />);
    expect(screen.getByText('需要突破1阶')).toBeInTheDocument();
  });

  it('未解锁技能卡片应有锁定样式', () => {
    const skills = [
      makeSkill({ id: 's3', unlocked: false, unlockCondition: { breakthroughStage: 1, description: '需要突破' } }),
    ];
    const { container } = render(<SkillPanel {...makeProps({ skills, onUpgrade })} />);
    expect(container.querySelector('.tk-skillpanel-card--locked')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 7. 突破标记
  // ═══════════════════════════════════════════

  it('突破解锁技能应显示突破标记', () => {
    const skills = [
      makeSkill({ id: 's4', name: '觉醒·武圣', isBreakthrough: true, unlocked: true }),
    ];
    const { container } = render(<SkillPanel {...makeProps({ skills, onUpgrade })} />);
    expect(container.querySelector('.tk-skillpanel-card--breakthrough')).toBeInTheDocument();
    expect(screen.getByText('突破')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 8. 效果对比
  // ═══════════════════════════════════════════

  it('有 effects 数据时应显示效果对比', () => {
    const skills = [
      makeSkill({
        id: 's1',
        name: '青龙偃月',
        level: 1,
        levelCap: 5,
        effects: [
          { label: '伤害', currentValue: 200, nextValue: 300 },
        ],
      }),
    ];
    render(<SkillPanel {...makeProps({ skills, onUpgrade })} />);
    expect(screen.getByTestId('skill-effect-compare')).toBeInTheDocument();
    expect(screen.getByText('伤害')).toBeInTheDocument();
    expect(screen.getByText('→')).toBeInTheDocument();
  });

  it('满级技能不应显示效果对比', () => {
    const skills = [
      makeSkill({
        id: 's1',
        name: '青龙偃月',
        level: 5,
        levelCap: 5,
        effects: [
          { label: '伤害', currentValue: 500, nextValue: 600 },
        ],
      }),
    ];
    render(<SkillPanel {...makeProps({ skills, onUpgrade })} />);
    expect(screen.queryByTestId('skill-effect-compare')).not.toBeInTheDocument();
  });
});
