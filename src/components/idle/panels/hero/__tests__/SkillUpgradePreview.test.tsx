/**
 * SkillUpgradePreview — 技能升级预览测试
 *
 * 覆盖场景：
 * - 渲染测试（名称、等级、效果对比）
 * - 消耗显示（技能书、铜钱）
 * - 升级按钮（可用/禁用）
 * - 交互回调
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SkillUpgradePreview from '../SkillUpgradePreview';

// ── Mock CSS ──
vi.mock('../SkillUpgradePreview.css', () => ({}));

// ── 测试数据工厂 ──

const makeProps = (overrides: Record<string, unknown> = {}) => ({
  skillName: '青龙偃月',
  currentLevel: 3,
  currentEffect: '对前方敌人造成200%攻击力伤害',
  nextEffect: '对前方敌人造成250%攻击力伤害',
  cost: { skillBooks: 2, copper: 4000 },
  canUpgrade: true,
  onUpgrade: vi.fn(),
  ...overrides,
});

// ── 测试 ──

describe('SkillUpgradePreview', () => {
  const onUpgrade = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染测试
  // ═══════════════════════════════════════════

  it('应正常渲染组件', () => {
    render(<SkillUpgradePreview {...makeProps({ onUpgrade })} />);
    expect(screen.getByTestId('skill-upgrade-preview')).toBeInTheDocument();
  });

  it('应显示技能名称和等级', () => {
    render(<SkillUpgradePreview {...makeProps({ onUpgrade })} />);
    expect(screen.getByText('青龙偃月')).toBeInTheDocument();
    expect(screen.getByText('Lv.3')).toBeInTheDocument();
  });

  it('应显示当前效果和升级效果', () => {
    render(<SkillUpgradePreview {...makeProps({ onUpgrade })} />);
    expect(screen.getByText('对前方敌人造成200%攻击力伤害')).toBeInTheDocument();
    expect(screen.getByText('对前方敌人造成250%攻击力伤害')).toBeInTheDocument();
  });

  it('应显示效果对比标签', () => {
    render(<SkillUpgradePreview {...makeProps({ onUpgrade })} />);
    expect(screen.getByText('当前效果')).toBeInTheDocument();
    expect(screen.getByText('升级效果')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 消耗显示
  // ═══════════════════════════════════════════

  it('应显示升级消耗（技能书和铜钱）', () => {
    render(<SkillUpgradePreview {...makeProps({ onUpgrade })} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('4,000')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 升级按钮 — 可用
  // ═══════════════════════════════════════════

  it('canUpgrade为true时按钮应显示"升级"且可用', () => {
    render(<SkillUpgradePreview {...makeProps({ canUpgrade: true, onUpgrade })} />);
    const btn = screen.getByTestId('btn-skill-preview-upgrade');
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent('升级');
  });

  // ═══════════════════════════════════════════
  // 4. 升级按钮 — 禁用
  // ═══════════════════════════════════════════

  it('canUpgrade为false时按钮应显示"资源不足"且禁用', () => {
    render(<SkillUpgradePreview {...makeProps({ canUpgrade: false, onUpgrade })} />);
    const btn = screen.getByTestId('btn-skill-preview-upgrade');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('资源不足');
  });

  // ═══════════════════════════════════════════
  // 5. 交互回调
  // ═══════════════════════════════════════════

  it('点击升级按钮应调用onUpgrade', () => {
    render(<SkillUpgradePreview {...makeProps({ canUpgrade: true, onUpgrade })} />);
    fireEvent.click(screen.getByTestId('btn-skill-preview-upgrade'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('按钮禁用时点击不应调用onUpgrade', () => {
    render(<SkillUpgradePreview {...makeProps({ canUpgrade: false, onUpgrade })} />);
    fireEvent.click(screen.getByTestId('btn-skill-preview-upgrade'));
    expect(onUpgrade).not.toHaveBeenCalled();
  });
});
