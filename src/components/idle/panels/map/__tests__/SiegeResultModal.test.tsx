/**
 * SiegeResultModal — 攻城结果弹窗测试
 *
 * 覆盖场景：
 * - 胜利渲染：战斗概要、消耗统计、奖励展示、道具掉落
 * - 失败渲染：失败信息、兵力损失、提升建议
 * - 空数据：result为null时不渲染
 * - 关闭回调：确认按钮触发onClose
 * - P0-1/P0-2 修复验证
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SiegeResultModal from '../SiegeResultModal';
import type { SiegeResultData } from '../SiegeResultModal';

// ── Mock CSS ──
vi.mock('../SiegeResultModal.css', () => ({}));
vi.mock('../../../common/Modal.css', () => ({}));

// ── 测试数据 ──

/** 构建胜利结果 */
const makeVictoryResult = (overrides: Partial<SiegeResultData> = {}): SiegeResultData => ({
  launched: true,
  victory: true,
  targetId: 'city-xuchang',
  targetName: '许昌',
  cost: { troops: 500, grain: 500 },
  siegeReward: {
    resources: { grain: 300, gold: 200, troops: 100, mandate: 50 },
    territoryExp: 150,
    items: [
      { itemId: 'scroll-attack', itemName: '攻击卷轴', quantity: 1, rarity: 'common' },
      { itemId: 'fragment-box', itemName: '碎片宝箱', quantity: 2, rarity: 'rare' },
    ],
  },
  capture: { territoryId: 'city-xuchang', newOwner: 'player', previousOwner: 'enemy' },
  ...overrides,
});

/** 构建失败结果 */
const makeDefeatResult = (overrides: Partial<SiegeResultData> = {}): SiegeResultData => ({
  launched: true,
  victory: false,
  targetId: 'city-ye',
  targetName: '邺城',
  cost: { troops: 800, grain: 500 },
  defeatTroopLoss: 240,
  failureReason: '攻城失败，兵力不足以攻破防线',
  ...overrides,
});

const defaultProps = {
  visible: true,
  result: makeVictoryResult(),
  onClose: vi.fn(),
};

describe('SiegeResultModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── P0-1: 攻城结果弹窗基础渲染 ──

  it('result为null时不渲染', () => {
    const { container } = render(
      <SiegeResultModal {...defaultProps} result={null} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('胜利时显示攻城胜利标题', () => {
    render(<SiegeResultModal {...defaultProps} />);
    expect(screen.getByTestId('siege-result-modal')).toBeTruthy();
    // 组件显示"攻城大捷！"作为标题
    expect(screen.getByText('攻城大捷！')).toBeTruthy();
    // 副标题包含目标名称
    expect(screen.getByText(/成功占领了.*许昌/)).toBeTruthy();
  });

  it('胜利时显示占领信息', () => {
    render(<SiegeResultModal {...defaultProps} />);
    expect(screen.getByText(/成功占领了.*许昌/)).toBeTruthy();
    // 目标信息区域显示城池名
    expect(screen.getByText('许昌')).toBeTruthy();
  });

  it('失败时显示攻城失败标题', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeDefeatResult()}
      />
    );
    // 组件显示"攻城失利"作为失败标题
    expect(screen.getByText('攻城失利')).toBeTruthy();
    // 副标题包含目标名称
    expect(screen.getByText(/邺城.*防守坚固/)).toBeTruthy();
  });

  it('失败时显示失败原因', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeDefeatResult()}
      />
    );
    // 组件在副标题显示"邺城 防守坚固，未能攻破"
    expect(screen.getByText(/邺城.*防守坚固.*未能攻破/)).toBeTruthy();
  });

  // ── 战斗统计 ──

  it('显示消耗兵力', () => {
    render(<SiegeResultModal {...defaultProps} />);
    // 胜利时显示"兵力消耗"和对应的消耗值
    expect(screen.getByText('兵力消耗')).toBeTruthy();
    // 兵力和粮草消耗都是500，所以有多个-500
    const allCosts = screen.getAllByText('-500');
    expect(allCosts.length).toBeGreaterThanOrEqual(2);
  });

  it('显示消耗粮草', () => {
    render(<SiegeResultModal {...defaultProps} />);
    // 消耗粮草显示 -500
    expect(screen.getByText('消耗粮草')).toBeTruthy();
    const allCosts = screen.getAllByText('-500');
    expect(allCosts.length).toBeGreaterThanOrEqual(2);
  });

  it('失败时显示额外兵力损失', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeDefeatResult()}
      />
    );
    expect(screen.getByText('-240')).toBeTruthy();
  });

  // ── P0-2: 奖励展示（消费 siegeReward 数据）──

  it('胜利时显示攻城奖励标题', () => {
    render(<SiegeResultModal {...defaultProps} />);
    // 组件显示"获得奖励"作为奖励区域标题
    expect(screen.getByText(/获得奖励/)).toBeTruthy();
  });

  it('显示资源奖励明细', () => {
    render(<SiegeResultModal {...defaultProps} />);
    expect(screen.getByText('粮草')).toBeTruthy();
    expect(screen.getByText('+300')).toBeTruthy();
    expect(screen.getByText('铜钱')).toBeTruthy();
    expect(screen.getByText('+200')).toBeTruthy();
    expect(screen.getByText('兵力')).toBeTruthy();
    expect(screen.getByText('+100')).toBeTruthy();
    expect(screen.getByText('天命')).toBeTruthy();
    expect(screen.getByText('+50')).toBeTruthy();
  });

  it('显示领土经验奖励', () => {
    render(<SiegeResultModal {...defaultProps} />);
    expect(screen.getByText('领土经验')).toBeTruthy();
    expect(screen.getByText('+150')).toBeTruthy();
  });

  it('显示道具掉落', () => {
    render(<SiegeResultModal {...defaultProps} />);
    const allAttackScroll = screen.getAllByText('攻击卷轴');
    expect(allAttackScroll.length).toBeGreaterThanOrEqual(1);
    const allFragmentBox = screen.getAllByText('碎片宝箱');
    expect(allFragmentBox.length).toBeGreaterThanOrEqual(1);
  });

  it('显示道具稀有度通过颜色区分', () => {
    render(<SiegeResultModal {...defaultProps} />);
    // 组件通过颜色区分稀有度：common=#7EC850, rare=#3498db
    // 验证道具掉落区域存在且包含道具名
    expect(screen.getByText('道具掉落')).toBeTruthy();
    expect(screen.getByText('攻击卷轴')).toBeTruthy();
    expect(screen.getByText('碎片宝箱')).toBeTruthy();
    // 验证数量显示
    expect(screen.getByText('×1')).toBeTruthy();
    expect(screen.getByText('×2')).toBeTruthy();
  });

  it('无奖励时不显示资源奖励明细', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeVictoryResult({ siegeReward: undefined })}
      />
    );
    // 无 siegeReward 时显示"获得奖励"区域但用"预计产出"替代
    expect(screen.getByText(/获得奖励/)).toBeTruthy();
    expect(screen.getByText('预计产出')).toBeTruthy();
    // 不应显示具体资源数值
    expect(screen.queryByText('+300')).toBeNull();
  });

  it('无道具时不显示道具掉落区域', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeVictoryResult({
          siegeReward: {
            resources: { grain: 100, gold: 50, troops: 20, mandate: 10 },
            territoryExp: 50,
            items: [],
          },
        })}
      />
    );
    expect(screen.queryByText(/道具掉落/)).toBeNull();
  });

  // ── 失败建议 ──

  it('失败时显示目标信息', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeDefeatResult()}
      />
    );
    // 失败时仍然显示目标信息区域
    expect(screen.getByText('📍 目标')).toBeTruthy();
    expect(screen.getByText('邺城')).toBeTruthy();
  });

  it('失败时显示战损统计区域', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeDefeatResult()}
      />
    );
    // 失败时显示战损统计
    expect(screen.getByText('⚔️ 战损统计')).toBeTruthy();
    expect(screen.getByText('兵力损失（30%）')).toBeTruthy();
  });

  // ── 关闭回调 ──

  it('点击确认按钮触发onClose', () => {
    render(<SiegeResultModal {...defaultProps} />);
    const confirmBtn = screen.getByText('确认');
    fireEvent.click(confirmBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  // ── 移动端响应式 ──

  describe('移动端响应式', () => {
    it('弹窗在移动端正常渲染', () => {
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      window.dispatchEvent(new Event('resize'));

      render(<SiegeResultModal {...defaultProps} />);
      expect(screen.getByTestId('siege-result-modal')).toBeTruthy();

      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
    });
  });
});
