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
  victory: true,
  targetId: 'city-xuchang',
  targetName: '许昌',
  targetLevel: 3,
  cost: { troops: 500, grain: 500 },
  reward: {
    resources: { grain: 300, gold: 200, troops: 100, mandate: 50 },
    territoryExp: 150,
    items: [
      { itemId: 'scroll-attack', itemName: '攻击卷轴', quantity: 1, rarity: 'common' },
      { itemId: 'fragment-box', itemName: '碎片宝箱', quantity: 2, rarity: 'rare' },
    ],
  },
  capture: { territoryId: 'city-xuchang', previousOwner: 'enemy' },
  ...overrides,
});

/** 构建失败结果 */
const makeDefeatResult = (overrides: Partial<SiegeResultData> = {}): SiegeResultData => ({
  victory: false,
  targetId: 'city-ye',
  targetName: '邺城',
  targetLevel: 4,
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
    expect(screen.getByText(/攻城胜利.*许昌/)).toBeTruthy();
  });

  it('胜利时显示占领信息', () => {
    render(<SiegeResultModal {...defaultProps} />);
    expect(screen.getByText(/成功占领.*许昌/)).toBeTruthy();
    expect(screen.getByText(/Lv\.3/)).toBeTruthy();
  });

  it('失败时显示攻城失败标题', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeDefeatResult()}
      />
    );
    expect(screen.getByText(/攻城失败.*邺城/)).toBeTruthy();
  });

  it('失败时显示失败原因', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeDefeatResult()}
      />
    );
    expect(screen.getByText(/兵力不足以攻破防线/)).toBeTruthy();
  });

  // ── 战斗统计 ──

  it('显示消耗兵力', () => {
    render(<SiegeResultModal {...defaultProps} />);
    const allCosts = screen.getAllByText('-500');
    expect(allCosts.length).toBeGreaterThanOrEqual(2); // 兵力和粮草都是500
  });

  it('显示消耗粮草', () => {
    render(<SiegeResultModal {...defaultProps} />);
    // 粮草消耗也是500，与兵力相同，验证至少有2个-500
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

  // ── P0-2: 奖励展示（消费 siege:reward 事件数据）──

  it('胜利时显示攻城奖励标题', () => {
    render(<SiegeResultModal {...defaultProps} />);
    expect(screen.getByText(/攻城奖励/)).toBeTruthy();
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

  it('显示道具稀有度', () => {
    render(<SiegeResultModal {...defaultProps} />);
    const allCommon = screen.getAllByText('普通');
    expect(allCommon.length).toBeGreaterThanOrEqual(1);
    const allRare = screen.getAllByText('稀有');
    expect(allRare.length).toBeGreaterThanOrEqual(1);
  });

  it('无奖励时不显示奖励区域', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeVictoryResult({ reward: null })}
      />
    );
    expect(screen.queryByText(/攻城奖励/)).toBeNull();
  });

  it('无道具时不显示道具掉落区域', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeVictoryResult({
          reward: {
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

  it('失败时显示提升建议', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeDefeatResult()}
      />
    );
    expect(screen.getByText(/提升建议/)).toBeTruthy();
  });

  it('失败建议包含科技升级提示', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeDefeatResult()}
      />
    );
    expect(screen.getByText(/升级科技/)).toBeTruthy();
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
