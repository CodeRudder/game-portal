/**
 * P0-3 攻城结果弹窗测试 — SiegeResultModal 组件测试
 *
 * 验证攻城结束后弹窗正确显示：
 * - 胜利时显示战果和奖励
 * - 失败时显示战损统计
 * - 条件不满足时显示失败原因
 * - 确认按钮关闭弹窗
 *
 * @module tests/acc/P0-3-SiegeResultModal
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SiegeResultModal from '@/components/idle/panels/map/SiegeResultModal';
import type { SiegeResultData } from '@/components/idle/panels/map/SiegeResultModal';
import { accTest, assertStrict, assertInDOM } from './acc-test-utils';

/** Mock CSS imports */
vi.mock('@/components/idle/components/SharedPanel.css', () => ({}));

vi.mock('@/components/idle/components/SharedPanel', () => ({
  __esModule: true,
  default: ({ children, title, onClose, visible, 'data-testid': dataTestId }: any) =>
    visible ? (
      <div data-testid={dataTestId ?? 'shared-panel'} data-title={title}>
        {title && <div data-testid="panel-title">{title}</div>}
        {children}
        {onClose && <button data-testid="panel-close" onClick={onClose}>关闭</button>}
      </div>
    ) : null,
}));

// ── 测试数据工厂 ──

function createVictoryResult(overrides?: Partial<SiegeResultData>): SiegeResultData {
  return {
    launched: true,
    victory: true,
    targetId: 'city-xuchang',
    targetName: '许昌',
    cost: { troops: 5000, grain: 3000 },
    capture: {
      territoryId: 'city-xuchang',
      newOwner: 'player',
      previousOwner: 'enemy',
    },
    ...overrides,
  };
}

function createDefeatResult(overrides?: Partial<SiegeResultData>): SiegeResultData {
  return {
    launched: true,
    victory: false,
    targetId: 'city-luoyang',
    targetName: '洛阳',
    cost: { troops: 8000, grain: 5000 },
    failureReason: '攻城失败，兵力不足以攻破防线',
    defeatTroopLoss: 2400,
    ...overrides,
  };
}

function createFailResult(overrides?: Partial<SiegeResultData>): SiegeResultData {
  return {
    launched: false,
    victory: false,
    targetId: 'city-nonexistent',
    targetName: '未知城池',
    cost: { troops: 0, grain: 0 },
    failureReason: '不相邻',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// P0-3 攻城结果弹窗测试
// ═══════════════════════════════════════════════════════════════

describe('P0-3 攻城结果弹窗测试', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  // ── 胜利场景 ──

  describe('攻城胜利', () => {
    it(accTest('P0-3-01', '胜利弹窗 — 正确渲染'), () => {
      const onClose = vi.fn();
      const result = createVictoryResult();

      render(
        <SiegeResultModal
          visible={true}
          onClose={onClose}
          result={result}
        />,
      );

      // 弹窗应可见
      const modal = screen.getByTestId('siege-result-modal');
      assertStrict(!!modal, 'P0-3-01', '弹窗应渲染');
      const content = screen.getByTestId('siege-result-content');
      assertStrict(!!content, 'P0-3-01', '内容区应渲染');
    });

    it(accTest('P0-3-02', '胜利弹窗 — 显示胜利标题和城池名'), () => {
      const onClose = vi.fn();
      const result = createVictoryResult();

      render(
        <SiegeResultModal visible={true} onClose={onClose} result={result} />,
      );

      const header = screen.getByTestId('siege-result-header');
      expect(header.textContent).toContain('攻城大捷');
      expect(header.textContent).toContain('许昌');
    });

    it(accTest('P0-3-03', '胜利弹窗 — 显示战损统计'), () => {
      const onClose = vi.fn();
      const result = createVictoryResult();

      render(
        <SiegeResultModal visible={true} onClose={onClose} result={result} />,
      );

      const casualties = screen.getByTestId('siege-result-casualties');
      expect(casualties.textContent).toContain('5,000'); // 出征兵力
      expect(casualties.textContent).toContain('3,000'); // 消耗粮草
    });

    it(accTest('P0-3-04', '胜利弹窗 — 显示获得奖励'), () => {
      const onClose = vi.fn();
      const result = createVictoryResult();

      render(
        <SiegeResultModal visible={true} onClose={onClose} result={result} />,
      );

      const rewards = screen.getByTestId('siege-result-rewards');
      // 奖励区域应包含标题和产出信息
      expect(rewards.textContent).toContain('获得奖励');
      expect(rewards.textContent).toContain('预计产出');
    });

    it(accTest('P0-3-05', '胜利弹窗 — 显示目标信息和占领详情'), () => {
      const onClose = vi.fn();
      const result = createVictoryResult();

      render(
        <SiegeResultModal visible={true} onClose={onClose} result={result} />,
      );

      const target = screen.getByTestId('siege-result-target');
      expect(target.textContent).toContain('许昌');
      expect(target.textContent).toContain('敌方'); // previousOwner
    });
  });

  // ── 失败场景 ──

  describe('攻城失败', () => {
    it(accTest('P0-3-06', '失败弹窗 — 显示失败标题'), () => {
      const onClose = vi.fn();
      const result = createDefeatResult();

      render(
        <SiegeResultModal visible={true} onClose={onClose} result={result} />,
      );

      const header = screen.getByTestId('siege-result-header');
      expect(header.textContent).toContain('攻城失利');
      expect(header.textContent).toContain('洛阳');
    });

    it(accTest('P0-3-07', '失败弹窗 — 显示兵力损失30%'), () => {
      const onClose = vi.fn();
      const result = createDefeatResult();

      render(
        <SiegeResultModal visible={true} onClose={onClose} result={result} />,
      );

      const casualties = screen.getByTestId('siege-result-casualties');
      expect(casualties.textContent).toContain('2,400'); // 30% of 8000
    });

    it(accTest('P0-3-08', '失败弹窗 — 不显示奖励区域'), () => {
      const onClose = vi.fn();
      const result = createDefeatResult();

      render(
        <SiegeResultModal visible={true} onClose={onClose} result={result} />,
      );

      const rewards = screen.queryByTestId('siege-result-rewards');
      expect(rewards).toBeNull();
    });
  });

  // ── 条件不满足场景 ──

  describe('无法攻城', () => {
    it(accTest('P0-3-09', '条件不满足 — 显示警告标题'), () => {
      const onClose = vi.fn();
      const result = createFailResult();

      render(
        <SiegeResultModal visible={true} onClose={onClose} result={result} />,
      );

      const header = screen.getByTestId('siege-result-header');
      expect(header.textContent).toContain('无法攻城');
    });

    it(accTest('P0-3-10', '条件不满足 — 显示失败原因'), () => {
      const onClose = vi.fn();
      const result = createFailResult();

      render(
        <SiegeResultModal visible={true} onClose={onClose} result={result} />,
      );

      const header = screen.getByTestId('siege-result-header');
      expect(header.textContent).toContain('不相邻');
    });
  });

  // ── 交互测试 ──

  describe('交互', () => {
    it(accTest('P0-3-11', '确认按钮 — 点击后调用onClose'), () => {
      const onClose = vi.fn();
      const result = createVictoryResult();

      render(
        <SiegeResultModal visible={true} onClose={onClose} result={result} />,
      );

      const confirmBtn = screen.getByTestId('siege-result-confirm');
      fireEvent.click(confirmBtn);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it(accTest('P0-3-12', '不可见时 — 不渲染内容'), () => {
      const onClose = vi.fn();
      const result = createVictoryResult();

      render(
        <SiegeResultModal visible={false} onClose={onClose} result={result} />,
      );

      const modal = screen.queryByTestId('siege-result-modal');
      expect(modal).toBeNull();
    });

    it(accTest('P0-3-13', 'result为null — 不渲染'), () => {
      const onClose = vi.fn();

      render(
        <SiegeResultModal visible={true} onClose={onClose} result={null} />,
      );

      const modal = screen.queryByTestId('siege-result-modal');
      expect(modal).toBeNull();
    });
  });
});
