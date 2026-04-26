/**
 * SkillUpgradePanel — 技能升级面板测试
 *
 * 覆盖场景：
 * - 渲染测试（空技能列表、正常技能列表）
 * - 技能卡片展示（名称、类型标签、等级、描述、CD）
 * - 升级按钮（资源充足/不足、满级、未解锁）
 * - 升级交互（点击升级按钮回调）
 * - 边界测试（无技能/满级/资源不足）
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SkillUpgradePanel from '../SkillUpgradePanel';
import type { SkillItem } from '../SkillUpgradePanel';

// ── Mock CSS ──
vi.mock('../SkillUpgradePanel.css', () => ({}));

// ── 测试数据工厂 ──

const makeSkill = (overrides: Partial<SkillItem> = {}): SkillItem => ({
  id: 'skill_001',
  name: '青龙偃月',
  type: 'active',
  level: 1,
  description: '对前方敌人造成大量伤害',
  levelCap: 5,
  unlocked: true,
  cooldown: 8,
  upgradeCost: { skillBook: 1, gold: 500 },
  ...overrides,
});

const makeProps = (overrides: Record<string, unknown> = {}) => ({
  heroId: 'guanyu',
  skills: [
    makeSkill({ id: 'skill_001', name: '青龙偃月', type: 'active', level: 1, description: '对前方敌人造成大量伤害' }),
    makeSkill({ id: 'skill_002', name: '武圣', type: 'passive', level: 2, description: '提升自身攻击力' }),
  ],
  skillBookAmount: 10,
  goldAmount: 50000,
  onUpgrade: vi.fn(),
  onClose: vi.fn(),
  ...overrides,
});

// ── 测试 ──

describe('SkillUpgradePanel', () => {
  const onUpgrade = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染测试
  // ═══════════════════════════════════════════

  it('应正常渲染面板', () => {
    render(<SkillUpgradePanel {...makeProps({ onUpgrade, onClose })} />);
    expect(screen.getByTestId('skill-upgrade-panel')).toBeInTheDocument();
  });

  it('应显示面板标题', () => {
    render(<SkillUpgradePanel {...makeProps({ onUpgrade, onClose })} />);
    expect(screen.getByText('⚔️ 技能升级')).toBeInTheDocument();
  });

  it('应显示等级上限', () => {
    render(<SkillUpgradePanel {...makeProps({ onUpgrade, onClose })} />);
    expect(screen.getByText('等级上限: 5')).toBeInTheDocument();
  });

  it('应渲染所有技能卡片', () => {
    render(<SkillUpgradePanel {...makeProps({ onUpgrade, onClose })} />);
    expect(screen.getByTestId('skill-card-0')).toBeInTheDocument();
    expect(screen.getByTestId('skill-card-1')).toBeInTheDocument();
  });

  it('应显示技能名称和类型标签', () => {
    render(<SkillUpgradePanel {...makeProps({ onUpgrade, onClose })} />);
    expect(screen.getByText('青龙偃月')).toBeInTheDocument();
    expect(screen.getByText('主动')).toBeInTheDocument();
    expect(screen.getByText('武圣')).toBeInTheDocument();
    expect(screen.getByText('被动')).toBeInTheDocument();
  });

  it('应显示技能等级', () => {
    render(<SkillUpgradePanel {...makeProps({ onUpgrade, onClose })} />);
    expect(screen.getByText('Lv.1/5')).toBeInTheDocument();
    expect(screen.getByText('Lv.2/5')).toBeInTheDocument();
  });

  it('应显示技能描述', () => {
    render(<SkillUpgradePanel {...makeProps({ onUpgrade, onClose })} />);
    expect(screen.getByText('对前方敌人造成大量伤害')).toBeInTheDocument();
  });

  it('应显示CD信息', () => {
    const skills = [
      makeSkill({ id: 'skill_001', name: '青龙偃月', type: 'active', level: 1, cooldown: 8 }),
    ];
    render(<SkillUpgradePanel {...makeProps({ skills, onUpgrade, onClose })} />);
    expect(screen.getByText(/CD: 8s/)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 空状态
  // ═══════════════════════════════════════════

  it('空技能列表应显示空状态', () => {
    render(<SkillUpgradePanel {...makeProps({ skills: [], onUpgrade, onClose })} />);
    expect(screen.getByText('暂无技能数据')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 升级按钮 — 资源充足
  // ═══════════════════════════════════════════

  it('资源充足时升级按钮应可用', () => {
    render(<SkillUpgradePanel {...makeProps({ skillBookAmount: 10, goldAmount: 50000, onUpgrade, onClose })} />);
    const btn = screen.getByTestId('btn-upgrade-skill-0');
    expect(btn).not.toBeDisabled();
  });

  it('点击升级按钮应调用onUpgrade', () => {
    render(<SkillUpgradePanel {...makeProps({ onUpgrade, onClose })} />);
    fireEvent.click(screen.getByTestId('btn-upgrade-skill-0'));
    expect(onUpgrade).toHaveBeenCalledWith('guanyu', 0);
  });

  // ═══════════════════════════════════════════
  // 4. 升级按钮 — 资源不足
  // ═══════════════════════════════════════════

  it('技能书不足时升级按钮应禁用', () => {
    render(<SkillUpgradePanel {...makeProps({ skillBookAmount: 0, goldAmount: 50000, onUpgrade, onClose })} />);
    const btn = screen.getByTestId('btn-upgrade-skill-0');
    expect(btn).toBeDisabled();
  });

  it('铜钱不足时升级按钮应禁用', () => {
    render(<SkillUpgradePanel {...makeProps({ skillBookAmount: 10, goldAmount: 100, onUpgrade, onClose })} />);
    const btn = screen.getByTestId('btn-upgrade-skill-0');
    expect(btn).toBeDisabled();
  });

  it('资源不足时应显示红色消耗数值', () => {
    const { container } = render(
      <SkillUpgradePanel {...makeProps({ skillBookAmount: 0, goldAmount: 0, onUpgrade, onClose })} />,
    );
    const insufficient = container.querySelectorAll('.tk-skill-cost__value--insufficient');
    expect(insufficient.length).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════
  // 5. 满级状态
  // ═══════════════════════════════════════════

  it('满级技能应显示"已满级"标签', () => {
    const skills = [
      makeSkill({ id: 'skill_001', name: '青龙偃月', level: 5, levelCap: 5 }),
    ];
    render(<SkillUpgradePanel {...makeProps({ skills, onUpgrade, onClose })} />);
    expect(screen.getByText('✅ 已满级')).toBeInTheDocument();
  });

  it('满级技能不应显示升级按钮', () => {
    const skills = [
      makeSkill({ id: 'skill_001', name: '青龙偃月', level: 5, levelCap: 5 }),
    ];
    render(<SkillUpgradePanel {...makeProps({ skills, onUpgrade, onClose })} />);
    expect(screen.queryByTestId('btn-upgrade-skill-0')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 6. 未解锁技能
  // ═══════════════════════════════════════════

  it('未解锁技能应显示锁图标和锁定提示', () => {
    const skills = [
      makeSkill({
        id: 'skill_003',
        name: '觉醒·武圣',
        type: 'awaken',
        level: 0,
        unlocked: false,
        unlockCondition: { breakthroughStage: 1, description: '需要突破1阶' },
      }),
    ];
    render(<SkillUpgradePanel {...makeProps({ skills, onUpgrade, onClose })} />);
    expect(screen.getByText('需要突破1阶')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-upgrade-skill-0')).not.toBeInTheDocument();
  });

  it('未解锁技能卡片应有锁定样式', () => {
    const skills = [
      makeSkill({ id: 'skill_003', unlocked: false, unlockCondition: { breakthroughStage: 1, description: '需要突破' } }),
    ];
    const { container } = render(<SkillUpgradePanel {...makeProps({ skills, onUpgrade, onClose })} />);
    const lockedCard = container.querySelector('.tk-skill-card--locked');
    expect(lockedCard).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 7. 多种技能类型
  // ═══════════════════════════════════════════

  it('应正确显示阵营技能类型标签', () => {
    const skills = [
      makeSkill({ id: 'skill_f1', name: '蜀之魂', type: 'faction', level: 1 }),
    ];
    render(<SkillUpgradePanel {...makeProps({ skills, onUpgrade, onClose })} />);
    expect(screen.getByText('阵营')).toBeInTheDocument();
  });

  it('应正确显示觉醒技能类型标签', () => {
    const skills = [
      makeSkill({ id: 'skill_a1', name: '觉醒技', type: 'awaken', level: 1, unlocked: true }),
    ];
    render(<SkillUpgradePanel {...makeProps({ skills, onUpgrade, onClose })} />);
    expect(screen.getByText('觉醒')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 8. 边界测试
  // ═══════════════════════════════════════════

  it('无CD技能不应显示CD信息', () => {
    const skills = [
      makeSkill({ id: 'skill_001', name: '被动技', type: 'passive', cooldown: 0 }),
    ];
    render(<SkillUpgradePanel {...makeProps({ skills, onUpgrade, onClose })} />);
    expect(screen.queryByText(/CD:/)).not.toBeInTheDocument();
  });

  it('无CD字段技能不应显示CD信息', () => {
    const skills = [
      makeSkill({ id: 'skill_001', name: '被动技', type: 'passive' }),
    ];
    const { cooldown: _cd, ...skillWithoutCd } = skills[0];
    render(<SkillUpgradePanel {...makeProps({ skills: [skillWithoutCd as SkillItem], onUpgrade, onClose })} />);
    expect(screen.queryByText(/CD:/)).not.toBeInTheDocument();
  });

  it('等级上限应取所有技能中的最大值', () => {
    const skills = [
      makeSkill({ id: 's1', levelCap: 3 }),
      makeSkill({ id: 's2', levelCap: 8 }),
    ];
    render(<SkillUpgradePanel {...makeProps({ skills, onUpgrade, onClose })} />);
    expect(screen.getByText('等级上限: 8')).toBeInTheDocument();
  });
});
