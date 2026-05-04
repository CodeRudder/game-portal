/**
 * SiegeResultModal — 攻城结果弹窗测试
 *
 * 覆盖场景：
 * - 胜利渲染：战斗概要、消耗统计、奖励展示、道具掉落
 * - 失败渲染：失败信息、兵力损失、提升建议
 * - 空数据：result为null时不渲染
 * - 关闭回调：确认按钮触发onClose
 * - P0-1/P0-2 修复验证
 * - R9 Task 6: 战斗结果等级、伤亡健康色、将领恢复时间、奖励倍率
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
  targetLevel: 3,
  cost: { troops: 500, grain: 500 },
  siegeReward: {
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
  launched: true,
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
    expect(screen.getByText(/攻城大捷/)).toBeTruthy();
  });

  it('胜利时显示占领信息', () => {
    render(<SiegeResultModal {...defaultProps} />);
    expect(screen.getByText(/成功占领.*许昌/)).toBeTruthy();
  });

  it('失败时显示攻城失败标题', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeDefeatResult()}
      />
    );
    expect(screen.getByText(/攻城失利/)).toBeTruthy();
  });

  it('失败时显示失败原因', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeDefeatResult()}
      />
    );
    expect(screen.getByText(/防守坚固/)).toBeTruthy();
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

  it('显示道具数量', () => {
    render(<SiegeResultModal {...defaultProps} />);
    // Component renders item quantity as "×N"
    expect(screen.getByText((content) => content.includes('×1'))).toBeTruthy();
    expect(screen.getByText((content) => content.includes('×2'))).toBeTruthy();
  });

  it('无奖励时显示预计产出', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeVictoryResult({ siegeReward: undefined })}
      />
    );
    expect(screen.getByText(/获得奖励/)).toBeTruthy();
    expect(screen.getByText(/预计产出/)).toBeTruthy();
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

  it('失败时显示城池防守信息', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeDefeatResult()}
      />
    );
    const allYecheng = screen.getAllByText(/邺城/);
    expect(allYecheng.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/防守坚固/)).toBeTruthy();
  });

  it('失败时显示兵力损失百分比', () => {
    render(
      <SiegeResultModal
        {...defaultProps}
        result={makeDefeatResult()}
      />
    );
    expect(screen.getByText(/兵力损失/)).toBeTruthy();
    expect(screen.getByText(/30%/)).toBeTruthy();
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

  // ── R9 Task 6: 战斗结果等级、伤亡健康色、将领恢复时间、奖励倍率 ──

  describe('R9: 战斗结果等级显示', () => {
    const outcomes: Array<{ value: string; label: string }> = [
      { value: 'decisiveVictory', label: '大捷' },
      { value: 'victory', label: '胜利' },
      { value: 'narrowVictory', label: '险胜' },
      { value: 'defeat', label: '失败' },
      { value: 'rout', label: '惨败' },
    ];

    outcomes.forEach(({ value, label }) => {
      it(`outcome="${value}" 时显示 "${label}" 标签`, () => {
        render(
          <SiegeResultModal
            {...defaultProps}
            result={makeVictoryResult({
              outcome: value as any,
            })}
          />
        );
        const badge = screen.getByTestId('siege-outcome-badge');
        expect(badge).toBeTruthy();
        expect(badge.textContent).toBe(label);
      });
    });

    it('无 outcome 时不显示等级标签（向后兼容）', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({ outcome: undefined })}
        />
      );
      expect(screen.queryByTestId('siege-outcome-badge')).toBeNull();
    });
  });

  describe('R9: 伤亡健康色指示器', () => {
    it('低伤亡 (10%) 显示绿色条', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            casualties: {
              troopsLost: 50,
              troopsLostPercent: 0.1,
              heroInjured: false,
              injuryLevel: 'none' as const,
              battleResult: 'victory' as const,
            },
          })}
        />
      );
      const healthBar = screen.getByTestId('siege-casualty-health-bar');
      expect(healthBar).toBeTruthy();
      const innerBar = healthBar.firstChild as HTMLElement;
      expect(innerBar).toBeTruthy();
      // 10% → width=10%
      expect(innerBar.style.width).toBe('10%');
      // 绿色 (jsdom normalizes hex to rgb)
      expect(innerBar.style.background).toBe('rgb(76, 175, 80)');
    });

    it('中等伤亡 (30%) 显示黄色条', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            casualties: {
              troopsLost: 150,
              troopsLostPercent: 0.3,
              heroInjured: false,
              injuryLevel: 'none' as const,
              battleResult: 'victory' as const,
            },
          })}
        />
      );
      const healthBar = screen.getByTestId('siege-casualty-health-bar');
      const innerBar = healthBar.firstChild as HTMLElement;
      // 30% → width=30%
      expect(innerBar.style.width).toBe('30%');
      // 黄色 (jsdom normalizes hex to rgb)
      expect(innerBar.style.background).toBe('rgb(255, 193, 7)');
    });

    it('高伤亡 (60%) 显示红色条', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            casualties: {
              troopsLost: 300,
              troopsLostPercent: 0.6,
              heroInjured: false,
              injuryLevel: 'none' as const,
              battleResult: 'victory' as const,
            },
          })}
        />
      );
      const healthBar = screen.getByTestId('siege-casualty-health-bar');
      const innerBar = healthBar.firstChild as HTMLElement;
      // 60% → width=60%
      expect(innerBar.style.width).toBe('60%');
      // 红色 (jsdom normalizes hex to rgb)
      expect(innerBar.style.background).toBe('rgb(231, 76, 60)');
    });

    it('无 casualties 时不显示健康色条', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({ casualties: undefined })}
        />
      );
      expect(screen.queryByTestId('siege-casualty-health-bar')).toBeNull();
    });
  });

  describe('R9: 将领受伤恢复时间', () => {
    it('轻伤显示恢复时间 (0.5小时/30分钟)', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            casualties: {
              troopsLost: 50,
              troopsLostPercent: 0.1,
              heroInjured: true,
              injuryLevel: 'minor' as const,
              battleResult: 'victory' as const,
            },
          })}
        />
      );
      const heroInjured = screen.getByTestId('siege-casualty-hero-injured');
      expect(heroInjured).toBeTruthy();
      expect(heroInjured.textContent).toContain('轻伤');
      const recovery = screen.getByTestId('siege-hero-recovery-time');
      expect(recovery.textContent).toContain('恢复时间');
    });

    it('中伤显示恢复时间 (2小时)', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            casualties: {
              troopsLost: 100,
              troopsLostPercent: 0.2,
              heroInjured: true,
              injuryLevel: 'moderate' as const,
              battleResult: 'victory' as const,
            },
          })}
        />
      );
      const heroInjured = screen.getByTestId('siege-casualty-hero-injured');
      expect(heroInjured.textContent).toContain('中伤');
      const recovery = screen.getByTestId('siege-hero-recovery-time');
      expect(recovery.textContent).toContain('2小时');
    });

    it('重伤显示恢复时间 (6小时)', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            casualties: {
              troopsLost: 200,
              troopsLostPercent: 0.4,
              heroInjured: true,
              injuryLevel: 'severe' as const,
              battleResult: 'victory' as const,
            },
          })}
        />
      );
      const heroInjured = screen.getByTestId('siege-casualty-hero-injured');
      expect(heroInjured.textContent).toContain('重伤');
      const recovery = screen.getByTestId('siege-hero-recovery-time');
      expect(recovery.textContent).toContain('6小时');
    });

    it('使用自定义 heroRecoveryTime 覆盖默认恢复时间', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            heroRecoveryTime: 8 * 60 * 60 * 1000, // 8小时
            casualties: {
              troopsLost: 200,
              troopsLostPercent: 0.4,
              heroInjured: true,
              injuryLevel: 'moderate' as const,
              battleResult: 'victory' as const,
            },
          })}
        />
      );
      const recovery = screen.getByTestId('siege-hero-recovery-time');
      expect(recovery.textContent).toContain('8小时');
    });

    it('无伤时不显示恢复时间', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            casualties: {
              troopsLost: 10,
              troopsLostPercent: 0.02,
              heroInjured: false,
              injuryLevel: 'none' as const,
              battleResult: 'victory' as const,
            },
          })}
        />
      );
      // heroInjured=false → 整行不显示
      expect(screen.queryByTestId('siege-casualty-hero-injured')).toBeNull();
      expect(screen.queryByTestId('siege-hero-recovery-time')).toBeNull();
    });
  });

  describe('R9: 奖励倍率说明', () => {
    it('首次攻占时显示 "首次奖励 x1.5" 标签', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            firstCaptureBonus: true,
          })}
        />
      );
      const badge = screen.getByTestId('siege-first-capture-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('首次奖励 x1.5');
    });

    it('有结果倍率时显示倍率标签', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            rewardMultiplier: 1.5,
          })}
        />
      );
      const badge = screen.getByTestId('siege-reward-multiplier-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('x1.5');
    });

    it('倍率为1时不显示倍率标签', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            rewardMultiplier: 1,
          })}
        />
      );
      expect(screen.queryByTestId('siege-reward-multiplier-badge')).toBeNull();
    });

    it('无 firstCaptureBonus 和 rewardMultiplier 时倍率区域为空', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            firstCaptureBonus: undefined,
            rewardMultiplier: undefined,
          })}
        />
      );
      expect(screen.queryByTestId('siege-first-capture-badge')).toBeNull();
      expect(screen.queryByTestId('siege-reward-multiplier-badge')).toBeNull();
    });
  });

  // ── R13 Task 4: H5 部队损失详情 + H6 将领受伤状态 UI ──

  describe('R13 H6: 将领受伤状态标签颜色编码', () => {
    it('轻伤(light)显示黄色标签 (#FFC107)', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          injuryData={{
            generalName: '关羽',
            injuryLevel: 'light',
            recoveryHours: 0.5,
          }}
        />
      );
      const section = screen.getByTestId('siege-injury-status-section');
      expect(section).toBeTruthy();
      const tag = screen.getByTestId('siege-injury-tag');
      expect(tag).toBeTruthy();
      // jsdom normalizes #FFC107 to rgb
      expect(tag.style.color).toBe('rgb(255, 193, 7)');
      expect(tag.textContent).toContain('\u8F7B\u4F24'); // 轻伤
    });

    it('中伤(medium)显示橙色标签 (#FF9800)', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          injuryData={{
            generalName: '张飞',
            injuryLevel: 'medium',
            recoveryHours: 2,
          }}
        />
      );
      const tag = screen.getByTestId('siege-injury-tag');
      expect(tag).toBeTruthy();
      // jsdom normalizes #FF9800 to rgb
      expect(tag.style.color).toBe('rgb(255, 152, 0)');
      expect(tag.textContent).toContain('\u4E2D\u4F24'); // 中伤
    });

    it('重伤(severe)显示红色标签 (#F44336)', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          injuryData={{
            generalName: '赵云',
            injuryLevel: 'severe',
            recoveryHours: 6,
          }}
        />
      );
      const tag = screen.getByTestId('siege-injury-tag');
      expect(tag).toBeTruthy();
      // jsdom normalizes #F44336 to rgb
      expect(tag.style.color).toBe('rgb(244, 67, 54)');
      expect(tag.textContent).toContain('\u91CD\u4F24'); // 重伤
    });

    it('无伤(none)不显示受伤区域', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          injuryData={{
            generalName: '诸葛亮',
            injuryLevel: 'none',
            recoveryHours: 0,
          }}
        />
      );
      expect(screen.queryByTestId('siege-injury-status-section')).toBeNull();
      expect(screen.queryByTestId('siege-injury-tag')).toBeNull();
    });

    it('不传injuryData时不显示受伤区域（向后兼容）', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
        />
      );
      expect(screen.queryByTestId('siege-injury-status-section')).toBeNull();
    });
  });

  describe('R13 H6: 将领恢复倒计时显示', () => {
    it('恢复时间显示正确 "恢复中: X小时"', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          injuryData={{
            generalName: '关羽',
            injuryLevel: 'medium',
            recoveryHours: 2,
          }}
        />
      );
      const recovery = screen.getByTestId('siege-injury-recovery');
      expect(recovery).toBeTruthy();
      expect(recovery.textContent).toContain('\u6062\u590D\u4E2D'); // 恢复中
      expect(recovery.textContent).toContain('2\u5C0F\u65F6'); // 2小时
    });

    it('恢复时间为0时不显示恢复行', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          injuryData={{
            generalName: '马超',
            injuryLevel: 'light',
            recoveryHours: 0,
          }}
        />
      );
      // section still shows because injuryLevel !== 'none'
      const section = screen.getByTestId('siege-injury-status-section');
      expect(section).toBeTruthy();
      // but recovery line should not appear
      expect(screen.queryByTestId('siege-injury-recovery')).toBeNull();
    });

    it('将领名称正确显示', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          injuryData={{
            generalName: '黄忠',
            injuryLevel: 'severe',
            recoveryHours: 6,
          }}
        />
      );
      const name = screen.getByTestId('siege-injury-general-name');
      expect(name.textContent).toBe('\u9EC4\u5FE0'); // 黄忠
    });
  });

  describe('R13 H5: 部队损失详情（数字+百分比）', () => {
    it('伤亡数字和百分比正确显示', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          troopLoss={{ lost: 150, total: 500 }}
        />
      );
      const section = screen.getByTestId('siege-troop-loss-section');
      expect(section).toBeTruthy();
      const count = screen.getByTestId('siege-troop-loss-count');
      expect(count.textContent).toBe('150');
      const percent = screen.getByTestId('siege-troop-loss-percent');
      expect(percent.textContent).toContain('30.0%');
    });

    it('出征总数正确显示', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          troopLoss={{ lost: 150, total: 500 }}
        />
      );
      // 出征总数在troopLoss section中显示
      const section = screen.getByTestId('siege-troop-loss-section');
      expect(section).toBeTruthy();
      expect(section.textContent).toContain('500');
    });

    it('无伤亡(lost=0)时不显示伤亡区域', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          troopLoss={{ lost: 0, total: 500 }}
        />
      );
      expect(screen.queryByTestId('siege-troop-loss-section')).toBeNull();
    });

    it('不传troopLoss时不显示伤亡区域（向后兼容）', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
        />
      );
      expect(screen.queryByTestId('siege-troop-loss-section')).toBeNull();
    });
  });

  // ── R14: 道具掉落 (itemDrops) ──

  describe('R14: 道具掉落 (itemDrops)', () => {
    it('renders item drops section when result.itemDrops is provided', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            itemDrops: [{ type: 'insiderLetter', count: 1 }],
          })}
        />
      );
      expect(screen.getByTestId('siege-item-drops-section')).toBeTruthy();
      // Item type name is resolved from SIEGE_ITEM_NAMES: insiderLetter -> 内应信
      expect(screen.getByTestId('siege-item-drop-insiderLetter')).toBeTruthy();
      expect(screen.getByTestId('siege-item-drop-insiderLetter').textContent).toContain('内应信');
      // Count is displayed as "x1"
      expect(screen.getByTestId('siege-item-drop-insiderLetter').textContent).toContain('x1');
    });

    it('does not render item drops section when result.itemDrops is undefined', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({ itemDrops: undefined })}
        />
      );
      expect(screen.queryByTestId('siege-item-drops-section')).toBeNull();
    });

    it('does not render item drops section when result.itemDrops is empty array', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({ itemDrops: [] })}
        />
      );
      expect(screen.queryByTestId('siege-item-drops-section')).toBeNull();
    });

    it('renders multiple item drops correctly', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            itemDrops: [
              { type: 'insiderLetter', count: 2 },
              { type: 'nightRaid', count: 1 },
            ],
          })}
        />
      );
      expect(screen.getByTestId('siege-item-drops-section')).toBeTruthy();

      // First drop: insiderLetter (内应信) x2
      const insiderDrop = screen.getByTestId('siege-item-drop-insiderLetter');
      expect(insiderDrop).toBeTruthy();
      expect(insiderDrop.textContent).toContain('内应信');
      expect(insiderDrop.textContent).toContain('x2');

      // Second drop: nightRaid (夜袭令) x1
      const raidDrop = screen.getByTestId('siege-item-drop-nightRaid');
      expect(raidDrop).toBeTruthy();
      expect(raidDrop.textContent).toContain('夜袭令');
      expect(raidDrop.textContent).toContain('x1');
    });

    it('renders all three item types correctly', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            itemDrops: [
              { type: 'insiderLetter', count: 3 },
              { type: 'nightRaid', count: 2 },
              { type: 'siegeManual', count: 1 },
            ],
          })}
        />
      );
      expect(screen.getByTestId('siege-item-drop-insiderLetter').textContent).toContain('x3');
      expect(screen.getByTestId('siege-item-drop-nightRaid').textContent).toContain('x2');
      expect(screen.getByTestId('siege-item-drop-siegeManual').textContent).toContain('攻城手册');
      expect(screen.getByTestId('siege-item-drop-siegeManual').textContent).toContain('x1');
    });

    it('does not render item drops section on defeat', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeDefeatResult({
            itemDrops: [{ type: 'insiderLetter', count: 1 }],
          })}
        />
      );
      // itemDrops section only renders when isWin=true, defeat should not show it
      expect(screen.queryByTestId('siege-item-drops-section')).toBeNull();
    });

    it('displays war loot section title', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            itemDrops: [{ type: 'insiderLetter', count: 1 }],
          })}
        />
      );
      const section = screen.getByTestId('siege-item-drops-section');
      expect(section.textContent).toContain('战利品');
    });
  });

  describe('R13: 已有测试不回归', () => {
    it('胜利时基础渲染仍然正常', () => {
      render(<SiegeResultModal {...defaultProps} />);
      expect(screen.getByTestId('siege-result-modal')).toBeTruthy();
      expect(screen.getByText(/攻城大捷/)).toBeTruthy();
      expect(screen.getByText(/获得奖励/)).toBeTruthy();
    });

    it('失败时基础渲染仍然正常', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeDefeatResult()}
        />
      );
      expect(screen.getByText(/攻城失利/)).toBeTruthy();
    });

    it('R9 伤亡健康条仍然正常', () => {
      render(
        <SiegeResultModal
          {...defaultProps}
          result={makeVictoryResult({
            casualties: {
              troopsLost: 50,
              troopsLostPercent: 0.1,
              heroInjured: false,
              injuryLevel: 'none' as const,
              battleResult: 'victory' as const,
            },
          })}
        />
      );
      expect(screen.getByTestId('siege-casualty-health-bar')).toBeTruthy();
    });
  });
});
