/**
 * ACC-12 羁绊系统 — UI层验收测试
 *
 * 覆盖验收标准 ACC-12-01 ~ ACC-12-49 中的UI相关条目
 * 每个测试标注 ACC-12-xx 编号，便于追溯验收矩阵
 *
 * 验收规则：
 * - 不确定 = 不通过
 * - UI测试不可跳过
 * - 所有测试必须通过
 *
 * @module components/idle/panels/hero/__tests__/ACC-12.bond-ui.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BondPanel from '../BondPanel';
import BondCollectionProgress from '../BondCollectionProgress';
import BondActivateModal from '../BondActivateModal';
import BondCardItem from '../BondCardItem';
import BondCollectionPanel from '../BondCollectionPanel';
import { HeroDetailBonds } from '../HeroDetailSections';

// ── Mock CSS ──
vi.mock('../BondPanel.css', () => ({}));
vi.mock('../BondCollectionProgress.css', () => ({}));
vi.mock('../BondActivateModal.css', () => ({}));
vi.mock('../BondCollectionPanel.css', () => ({}));
vi.mock('../HeroDetailModal.css', () => ({}));
vi.mock('../HeroDetailModal-chart.css', () => ({}));

// ── Mock engine dependencies for BondCollectionPanel & HeroDetailBonds ──
vi.mock('@/games/three-kingdoms/engine/hero/bond-config', () => ({
  BondType: { FACTION: 'faction', PARTNER: 'partner' },
  FACTION_BONDS: [
    {
      id: 'faction_shu',
      type: 'faction',
      name: '蜀国',
      faction: 'shu',
      tiers: [
        { requiredCount: 2, effects: [{ stat: 'attack', value: 0.05 }] },
        { requiredCount: 3, effects: [{ stat: 'attack', value: 0.10 }, { stat: 'defense', value: 0.05 }] },
        { requiredCount: 4, effects: [{ stat: 'attack', value: 0.15 }, { stat: 'defense', value: 0.10 }, { stat: 'hp', value: 0.05 }] },
      ],
    },
    {
      id: 'faction_wei',
      type: 'faction',
      name: '魏国',
      faction: 'wei',
      tiers: [
        { requiredCount: 2, effects: [{ stat: 'defense', value: 0.05 }] },
        { requiredCount: 3, effects: [{ stat: 'defense', value: 0.10 }, { stat: 'intelligence', value: 0.05 }] },
      ],
    },
    {
      id: 'faction_wu',
      type: 'faction',
      name: '吴国',
      faction: 'wu',
      tiers: [
        { requiredCount: 2, effects: [{ stat: 'speed', value: 0.05 }] },
      ],
    },
    {
      id: 'faction_qun',
      type: 'faction',
      name: '群雄',
      faction: 'qun',
      tiers: [
        { requiredCount: 2, effects: [{ stat: 'intelligence', value: 0.05 }] },
      ],
    },
  ],
  PARTNER_BONDS: [
    { id: 'partner_taoyuan', name: '桃园结义', type: 'partner', generalIds: ['liubei', 'guanyu', 'zhangfei'], effects: [{ stat: 'attack', value: 0.10 }], minRequired: 3 },
    { id: 'partner_wuhu', name: '五虎上将', type: 'partner', generalIds: ['guanyu', 'zhangfei', 'zhaoyun', 'machao', 'huangzhong'], effects: [{ stat: 'critRate', value: 0.10 }], minRequired: 3 },
    { id: 'partner_wolong_fengchu', name: '卧龙凤雏', type: 'partner', generalIds: ['zhugeliang', 'pangtong'], effects: [{ stat: 'intelligence', value: 0.20 }], minRequired: 2 },
  ],
}));

vi.mock('@/games/three-kingdoms/engine/hero/BondSystem', () => ({}));

// ── Mock BondCard CSS & BondDetailPopup ──
vi.mock('../BondCard', async () => {
  const actual = await vi.importActual<typeof import('../BondCard')>('../BondCard');
  return {
    ...actual,
  };
});

// ── Mock HeroDetailSections dependencies ──
vi.mock('@/games/three-kingdoms/engine', () => ({}));
vi.mock('@/games/three-kingdoms/engine/ThreeKingdomsEngine', () => ({}));
vi.mock('@/components/idle/utils/formatNumber', () => ({
  formatNumber: (n: number) => String(n),
}));
vi.mock('../HeroAwakeningSection', () => ({
  HeroAwakeningSection: () => <div data-testid="hero-awakening-section-mock" />,
}));

// ── 辅助工厂 ──

const makeProps = (overrides: Record<string, unknown> = {}) => ({
  heroIds: [] as string[],
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════
// ACC-12 UI验收测试
// ═══════════════════════════════════════════════════════════════
describe('ACC-12 羁绊系统UI验收', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── ACC-12-01: 羁绊面板标题与计数 ──
  describe('ACC-12-01: 羁绊面板标题与计数', () => {
    it('ACC-12-01: 显示"羁绊面板"标题', () => {
      render(<BondPanel {...makeProps()} />);
      expect(screen.getByText('羁绊面板')).toBeInTheDocument();
    });

    it('ACC-12-01: 显示"已激活 X/Y"计数', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      const countEl = screen.getByTestId('bond-active-count');
      expect(countEl).toHaveTextContent('已激活');
      expect(countEl).toHaveTextContent('/');
    });
  });

  // ── ACC-12-02: 阵营分布可视化 ──
  describe('ACC-12-02: 阵营分布可视化', () => {
    it('ACC-12-02: 显示各阵营色段', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu', 'caocao'] })} />);
      expect(screen.getByTestId('bond-faction-segment-shu')).toBeInTheDocument();
      expect(screen.getByTestId('bond-faction-segment-wei')).toBeInTheDocument();
    });

    it('ACC-12-02: 显示各阵营人数', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu', 'zhangfei'] })} />);
      const distribution = screen.getByTestId('bond-faction-distribution');
      expect(distribution.textContent).toContain('蜀');
      expect(distribution.textContent).toContain('3人');
    });
  });

  // ── ACC-12-03: 已激活羁绊列表 ──
  describe('ACC-12-03: 已激活羁绊列表', () => {
    it('ACC-12-03: 激活羁绊有active样式类', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      const bondCard = screen.getByTestId('bond-card-faction_shu');
      expect(bondCard.className).toContain('bond-card--active');
    });

    it('ACC-12-03: 显示羁绊效果文本', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      const effectEl = screen.getByTestId('bond-effect-faction_shu');
      expect(effectEl).toHaveTextContent('攻击+5%');
    });

    it('ACC-12-03: 显示进度数字', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      const progress = screen.getByTestId('bond-progress-faction_shu');
      expect(progress).toHaveTextContent('2/2');
    });
  });

  // ── ACC-12-04: 未激活羁绊列表 ──
  describe('ACC-12-04: 未激活羁绊列表', () => {
    it('ACC-12-04: 未激活羁绊有inactive样式类', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei'] })} />);
      const bondCard = screen.getByTestId('bond-card-faction_shu');
      expect(bondCard.className).toContain('bond-card--inactive');
    });

    it('ACC-12-04: 显示"未激活"状态', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei'] })} />);
      expect(screen.getByTestId('bond-status-faction_shu')).toHaveTextContent('未激活');
    });
  });

  // ── ACC-12-05: 羁绊卡片内容完整性 ──
  describe('ACC-12-05: 羁绊卡片内容完整性', () => {
    it('ACC-12-05: 卡片包含名称、状态、效果、进度', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      const card = screen.getByTestId('bond-card-faction_shu');
      expect(card.textContent).toContain('蜀');
      expect(screen.getByTestId('bond-status-faction_shu')).toHaveTextContent('已激活');
      expect(screen.getByTestId('bond-effect-faction_shu')).toHaveTextContent('攻击+5%');
      expect(screen.getByTestId('bond-progress-faction_shu')).toHaveTextContent('2/2');
    });
  });

  // ── ACC-12-06: 羁绊收集进度组件 ──
  describe('ACC-12-06: 羁绊收集进度组件', () => {
    it('ACC-12-06: 显示总进度和分类进度', () => {
      render(
        <BondCollectionProgress
          totalBonds={18}
          activatedBonds={5}
          factionActivated={2}
          factionTotal={4}
          partnerActivated={3}
          partnerTotal={14}
        />,
      );
      expect(screen.getByTestId('bond-collection-progress')).toBeInTheDocument();
      expect(screen.getByText(/5\/18/)).toBeInTheDocument();
    });
  });

  // ── ACC-12-10: 编队添加武将触发羁绊更新 ──
  describe('ACC-12-10: 编队添加武将触发羁绊更新', () => {
    it('ACC-12-10: 添加第2名同阵营武将激活初级羁绊', () => {
      const { rerender } = render(<BondPanel {...makeProps({ heroIds: ['liubei'] })} />);
      expect(screen.getByTestId('bond-status-faction_shu')).toHaveTextContent('未激活');

      rerender(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      expect(screen.getByTestId('bond-status-faction_shu')).toHaveTextContent('已激活');
      expect(screen.getByTestId('bond-effect-faction_shu')).toHaveTextContent('攻击+5%');
    });
  });

  // ── ACC-12-11: 编队移除武将触发羁绊失效 ──
  describe('ACC-12-11: 编队移除武将触发羁绊失效', () => {
    it('ACC-12-11: 移除武将使羁绊从激活变为未激活', () => {
      const { rerender } = render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      expect(screen.getByTestId('bond-status-faction_shu')).toHaveTextContent('已激活');

      rerender(<BondPanel {...makeProps({ heroIds: ['liubei'] })} />);
      expect(screen.getByTestId('bond-status-faction_shu')).toHaveTextContent('未激活');
    });
  });

  // ── ACC-12-12: 羁绊卡片展开详情 ──
  describe('ACC-12-12: 羁绊卡片展开详情', () => {
    it('ACC-12-12: 点击卡片展开详情区域', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      const card = screen.getByTestId('bond-card-faction_shu');
      fireEvent.click(card);
      expect(screen.getByTestId('bond-card-detail-faction_shu')).toBeInTheDocument();
    });
  });

  // ── ACC-12-13: 羁绊卡片收起详情 ──
  describe('ACC-12-13: 羁绊卡片收起详情', () => {
    it('ACC-12-13: 再次点击卡片收起详情', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      const card = screen.getByTestId('bond-card-faction_shu');

      fireEvent.click(card);
      expect(screen.getByTestId('bond-card-detail-faction_shu')).toBeInTheDocument();

      fireEvent.click(card);
      expect(card).toHaveAttribute('aria-expanded', 'false');
    });
  });

  // ── ACC-12-14: 羁绊详情弹窗展示 ──
  describe('ACC-12-14: 羁绊详情弹窗展示', () => {
    it('ACC-12-14: BondActivateModal显示完整信息', () => {
      render(
        <BondActivateModal
          bondId="partner_taoyuan"
          bondName="桃园结义"
          bondType="partner"
          requiredHeroes={[
            { id: 'liubei', name: '刘备', inTeam: true },
            { id: 'guanyu', name: '关羽', inTeam: true },
            { id: 'zhangfei', name: '张飞', inTeam: false },
          ]}
          effect={{ attackBonus: 10, defenseBonus: 10, hpBonus: 10, critBonus: 10, strategyBonus: 10 }}
          isActive={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByTestId('bond-name')).toHaveTextContent('桃园结义');
      expect(screen.getByText('搭档羁绊')).toBeInTheDocument();
      expect(screen.getByTestId('bond-status')).toHaveTextContent('已激活');
      expect(screen.getByTestId('bond-heroes')).toBeInTheDocument();
      expect(screen.getByTestId('bond-effects')).toBeInTheDocument();
      expect(screen.getByTestId('bond-close-btn')).toHaveTextContent('关闭');
    });
  });

  // ── ACC-12-15: 羁绊激活弹窗展示 ──
  describe('ACC-12-15: 羁绊激活弹窗展示', () => {
    it('ACC-12-15: 弹窗包含类型图标和标签', () => {
      render(
        <BondActivateModal
          bondId="faction_shu"
          bondName="蜀阵营羁绊"
          bondType="faction"
          requiredHeroes={[
            { id: 'liubei', name: '刘备', inTeam: true },
            { id: 'guanyu', name: '关羽', inTeam: true },
          ]}
          effect={{ attackBonus: 5, defenseBonus: 0, hpBonus: 0, critBonus: 0 }}
          isActive={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText('⚔️')).toBeInTheDocument();
      expect(screen.getByText('阵营羁绊')).toBeInTheDocument();
    });

    it('ACC-12-15: 点击遮罩关闭弹窗', () => {
      const onClose = vi.fn();
      render(
        <BondActivateModal
          bondId="test"
          bondName="测试"
          bondType="partner"
          requiredHeroes={[]}
          effect={{ attackBonus: 0, defenseBonus: 0, hpBonus: 0, critBonus: 0 }}
          isActive={false}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByTestId('bond-modal-overlay'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ── ACC-12-19: 空编队羁绊提示 ──
  describe('ACC-12-19: 空编队羁绊提示', () => {
    it('ACC-12-19: 空编队显示提示文本', () => {
      render(<BondPanel {...makeProps({ heroIds: [] })} />);
      expect(screen.getByTestId('bond-panel-empty')).toHaveTextContent('当前编队为空，请先添加武将');
    });
  });

  // ── ACC-12-20: 阵营羁绊2人初级激活UI ──
  describe('ACC-12-20: 阵营羁绊2人初级激活UI', () => {
    it('ACC-12-20: 蜀2人激活初级显示攻击+5%', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      expect(screen.getByTestId('bond-effect-faction_shu')).toHaveTextContent('攻击+5%');
      expect(screen.getByTestId('bond-progress-faction_shu')).toHaveTextContent('2/2');
    });
  });

  // ── ACC-12-21: 阵营羁绊3人中级激活UI ──
  describe('ACC-12-21: 阵营羁绊3人中级激活UI', () => {
    it('ACC-12-21: 蜀3人激活中级显示攻击+10%，防御+5%', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu', 'zhaoyun'] })} />);
      expect(screen.getByTestId('bond-effect-faction_shu')).toHaveTextContent('攻击+10%');
      expect(screen.getByTestId('bond-effect-faction_shu')).toHaveTextContent('防御+5%');
    });
  });

  // ── ACC-12-22: 阵营羁绊4人高级激活UI ──
  describe('ACC-12-22: 阵营羁绊4人高级激活UI', () => {
    it('ACC-12-22: 蜀4人激活高级显示3项属性', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'zhugeliang', 'pangtong', 'zhaoyun'] })} />);
      const effectEl = screen.getByTestId('bond-effect-faction_shu');
      expect(effectEl).toHaveTextContent('攻击+15%');
      expect(effectEl).toHaveTextContent('防御+10%');
      expect(effectEl).toHaveTextContent('生命+5%');
    });
  });

  // ── ACC-12-23: 阵营羁绊5人终极激活UI ──
  describe('ACC-12-23: 阵营羁绊5人终极激活UI', () => {
    it('ACC-12-23: 群雄5人激活终极显示4项属性', () => {
      render(
        <BondPanel {...makeProps({ heroIds: ['lvbu', 'diaochan', 'yuanzhao', 'jiaxu', 'zhangjiao'] })} />,
      );
      const effectEl = screen.getByTestId('bond-effect-faction_neutral');
      expect(effectEl).toHaveTextContent('攻击+20%');
      expect(effectEl).toHaveTextContent('防御+15%');
      expect(effectEl).toHaveTextContent('生命+10%');
      expect(effectEl).toHaveTextContent('暴击+5%');
    });
  });

  // ── ACC-12-24: 搭档羁绊-桃园结义UI ──
  describe('ACC-12-24: 搭档羁绊-桃园结义UI', () => {
    it('ACC-12-24: 刘关张激活桃园结义显示全属性+10%', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu', 'zhangfei'] })} />);
      const effectEl = screen.getByTestId('bond-effect-partner_taoyuan');
      expect(effectEl).toHaveTextContent('攻击+10%');
      expect(effectEl).toHaveTextContent('防御+10%');
      expect(effectEl).toHaveTextContent('生命+10%');
      expect(effectEl).toHaveTextContent('暴击+10%');
      expect(effectEl).toHaveTextContent('策略+10%');
    });
  });

  // ── ACC-12-25: 搭档羁绊-五虎上将部分激活UI ──
  describe('ACC-12-25: 搭档羁绊-五虎上将部分激活UI', () => {
    it('ACC-12-25: 3名五虎激活显示暴击+10%，攻击+8%', () => {
      render(<BondPanel {...makeProps({ heroIds: ['guanyu', 'zhaoyun', 'machao'] })} />);
      const effectEl = screen.getByTestId('bond-effect-partner_wuhu');
      expect(effectEl).toHaveTextContent('暴击+10%');
      expect(effectEl).toHaveTextContent('攻击+8%');
    });
  });

  // ── ACC-12-26: 搭档羁绊人数不足不激活UI ──
  describe('ACC-12-26: 搭档羁绊人数不足不激活UI', () => {
    it('ACC-12-26: 2名五虎显示未激活和2/3进度', () => {
      render(<BondPanel {...makeProps({ heroIds: ['guanyu', 'zhaoyun'] })} />);
      expect(screen.getByTestId('bond-status-partner_wuhu')).toHaveTextContent('未激活');
      expect(screen.getByTestId('bond-progress-partner_wuhu')).toHaveTextContent('2/3');
    });
  });

  // ── ACC-12-27: 多阵营羁绊同时激活UI ──
  describe('ACC-12-27: 多阵营羁绊同时激活UI', () => {
    it('ACC-12-27: 3蜀+2魏同时显示两个激活羁绊', () => {
      render(
        <BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu', 'zhangfei', 'caocao', 'xiahoudun'] })} />,
      );
      expect(screen.getByTestId('bond-status-faction_shu')).toHaveTextContent('已激活');
      expect(screen.getByTestId('bond-status-faction_wei')).toHaveTextContent('已激活');
    });
  });

  // ── ACC-12-28: 羁绊加成总预览UI ──
  describe('ACC-12-28: 羁绊加成总预览UI', () => {
    it('ACC-12-28: 激活羁绊后显示编队总加成预览', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      expect(screen.getByTestId('bond-total-bonus')).toBeInTheDocument();
      expect(screen.getByTestId('bond-total-bonus-effects')).toHaveTextContent('攻击');
    });

    it('ACC-12-28: 总加成只取最高等级（不累加低等级）', () => {
      // 3名蜀国武将 → 中级羁绊
      // 总加成应为中级(攻击+10%,防御+5%)，不应包含初级(攻击+5%)
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu', 'zhaoyun'] })} />);
      const bonusEl = screen.getByTestId('bond-total-bonus-effects');
      // 中级：攻击+10%，防御+5%
      expect(bonusEl.textContent).toContain('攻击 +10%');
      expect(bonusEl.textContent).toContain('防御 +5%');
      // 不应出现15%（初级+中级累加的错误值）
      expect(bonusEl.textContent).not.toContain('攻击 +15%');
    });
  });

  // ── ACC-12-30: 空编队不报错 ──
  describe('ACC-12-30: 空编队不报错', () => {
    it('ACC-12-30: 空编队渲染无JS报错', () => {
      expect(() => render(<BondPanel {...makeProps({ heroIds: [] })} />)).not.toThrow();
    });
  });

  // ── ACC-12-31: 单武将编队 ──
  describe('ACC-12-31: 单武将编队', () => {
    it('ACC-12-31: 1名武将所有羁绊显示未激活', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei'] })} />);
      expect(screen.getByTestId('bond-status-faction_shu')).toHaveTextContent('未激活');
      const distribution = screen.getByTestId('bond-faction-distribution');
      expect(distribution.textContent).toContain('1人');
    });
  });

  // ── ACC-12-32: 6人满编队羁绊UI ──
  describe('ACC-12-32: 6人满编队羁绊UI', () => {
    it('ACC-12-32: 6人编队正确显示所有羁绊', () => {
      render(
        <BondPanel
          {...makeProps({ heroIds: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'zhugeliang', 'pangtong'] })}
        />,
      );
      expect(screen.getByTestId('bond-status-faction_shu')).toHaveTextContent('已激活');
      expect(screen.getByTestId('bond-status-partner_taoyuan')).toHaveTextContent('已激活');
    });
  });

  // ── ACC-12-33: 跨阵营搭档羁绊与阵营羁绊共存UI ──
  describe('ACC-12-33: 跨阵营搭档羁绊与阵营羁绊共存UI', () => {
    it('ACC-12-33: 刘关张+吕布同时显示三英战吕布和蜀阵营羁绊', () => {
      render(
        <BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu', 'zhangfei', 'lvbu'] })} />,
      );
      expect(screen.getByTestId('bond-status-faction_shu')).toHaveTextContent('已激活');
      expect(screen.getByTestId('bond-status-partner_sanying_lvbu')).toHaveTextContent('已激活');
    });
  });

  // ── ACC-12-34: 武将重复上阵防护UI ──
  describe('ACC-12-34: 武将重复上阵防护UI', () => {
    it('ACC-12-34: 重复ID不影响羁绊面板显示', () => {
      expect(() =>
        render(<BondPanel {...makeProps({ heroIds: ['liubei', 'liubei', 'guanyu'] })} />)
      ).not.toThrow();
      expect(screen.getByTestId('bond-panel')).toBeInTheDocument();
    });
  });

  // ── ACC-12-37: 阵营羁绊只显示最高等级UI ──
  describe('ACC-12-37: 阵营羁绊只显示最高等级UI', () => {
    it('ACC-12-37: 4名蜀国武将只显示高级羁绊', () => {
      render(
        <BondPanel {...makeProps({ heroIds: ['liubei', 'zhugeliang', 'pangtong', 'zhaoyun'] })} />,
      );
      const card = screen.getByTestId('bond-card-faction_shu');
      expect(card.textContent).toContain('高级');
      expect(screen.getByTestId('bond-effect-faction_shu')).toHaveTextContent('攻击+15%');
    });
  });

  // ── ACC-12-38: 未激活阵营羁绊显示最低门槛 ──
  describe('ACC-12-38: 未激活阵营羁绊显示最低门槛', () => {
    it('ACC-12-38: 1名蜀国武将显示1/2进度', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei'] })} />);
      expect(screen.getByTestId('bond-progress-faction_shu')).toHaveTextContent('1/2');
    });
  });

  // ── ACC-12-41: 羁绊卡片触摸操作 ──
  describe('ACC-12-41: 羁绊卡片触摸操作', () => {
    it('ACC-12-41: 卡片有role=button和tabIndex=0', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      const card = screen.getByTestId('bond-card-faction_shu');
      expect(card).toHaveAttribute('role', 'button');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('ACC-12-41: 卡片支持键盘Enter/Space操作', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      const card = screen.getByTestId('bond-card-faction_shu');

      fireEvent.keyDown(card, { key: 'Enter' });
      expect(screen.getByTestId('bond-card-detail-faction_shu')).toBeInTheDocument();

      fireEvent.keyDown(card, { key: 'Enter' });
      expect(card).toHaveAttribute('aria-expanded', 'false');
    });
  });

  // ── ACC-12-42/43: 弹窗可关闭 ──
  describe('ACC-12-42/43: 弹窗可关闭', () => {
    it('ACC-12-42: 点击遮罩关闭弹窗', () => {
      const onClose = vi.fn();
      render(
        <BondActivateModal
          bondId="test"
          bondName="测试"
          bondType="partner"
          requiredHeroes={[]}
          effect={{ attackBonus: 0, defenseBonus: 0, hpBonus: 0, critBonus: 0 }}
          isActive={false}
          onClose={onClose}
        />,
      );
      fireEvent.click(screen.getByTestId('bond-modal-overlay'));
      expect(onClose).toHaveBeenCalled();
    });

    it('ACC-12-43: 点击关闭按钮关闭弹窗', () => {
      const onClose = vi.fn();
      render(
        <BondActivateModal
          bondId="test"
          bondName="测试"
          bondType="partner"
          requiredHeroes={[]}
          effect={{ attackBonus: 0, defenseBonus: 0, hpBonus: 0, critBonus: 0 }}
          isActive={false}
          onClose={onClose}
        />,
      );
      fireEvent.click(screen.getByTestId('bond-close-btn'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ── N-12-5: 好感度UI入口 ──
  describe('N-12-5: 好感度UI入口', () => {
    it('N-12-5: 编队非空时显示好感度提示区域', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      expect(screen.getByTestId('bond-favorability-hint')).toBeInTheDocument();
    });

    it('N-12-5: 编队非空时显示故事事件入口', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      expect(screen.getByTestId('bond-story-events')).toBeInTheDocument();
    });

    it('N-12-5: 故事事件显示武将齐全状态', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu', 'zhangfei'] })} />);
      const event001 = screen.getByTestId('bond-story-event-story_001');
      expect(event001.textContent).toContain('武将已齐');
    });
  });

  // ── N-12-6: 羁绊等级效果对比 ──
  describe('N-12-6: 羁绊等级效果对比', () => {
    it('N-12-6: 展开阵营羁绊卡片显示当前/下一等级对比', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      const card = screen.getByTestId('bond-card-faction_shu');
      fireEvent.click(card);

      const tierComparison = screen.getByTestId('bond-tier-comparison-faction_shu');
      expect(tierComparison).toBeInTheDocument();
      expect(tierComparison.textContent).toContain('当前等级');
      expect(tierComparison.textContent).toContain('下一等级');
    });

    it('N-12-6: 最高等级显示"已达最高等级"', () => {
      render(
        <BondPanel
          {...makeProps({ heroIds: ['lvbu', 'diaochan', 'yuanzhao', 'jiaxu', 'zhangjiao'] })}
        />,
      );
      const card = screen.getByTestId('bond-card-faction_neutral');
      fireEvent.click(card);

      const tierComparison = screen.getByTestId('bond-tier-comparison-faction_neutral');
      expect(tierComparison.textContent).toContain('已达最高等级');
    });
  });

  // ── ACC-12 ARIA无障碍 ──
  describe('ACC-12 ARIA无障碍', () => {
    it('ACC-12-ARIA: 卡片有aria-expanded属性', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      const card = screen.getByTestId('bond-card-faction_shu');
      expect(card).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(card);
      expect(card).toHaveAttribute('aria-expanded', 'true');
    });
  });

  // ── ACC-12 代码质量 ──
  describe('ACC-12 代码质量', () => {
    it('ACC-12-QUALITY: BondPanel有displayName', () => {
      expect(BondPanel.displayName).toBe('BondPanel');
    });

    it('ACC-12-QUALITY: BondCardItem有displayName', () => {
      expect(BondCardItem.displayName).toBe('BondCardItem');
    });

    it('ACC-12-QUALITY: BondCollectionProgress有displayName', () => {
      expect(BondCollectionProgress.displayName).toBe('BondCollectionProgress');
    });

    it('ACC-12-QUALITY: BondActivateModal有displayName', () => {
      expect(BondActivateModal.displayName).toBe('BondActivateModal');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 补充验收条目 — BondCollectionPanel 相关
  // ═══════════════════════════════════════════════════════════════

  // ── ACC-12-07: 羁绊图鉴Tab切换 ──
  describe('ACC-12-07: 羁绊图鉴Tab切换', () => {
    it('ACC-12-07: 显示"已激活"和"全部图鉴"两个Tab', () => {
      render(
        <BondCollectionPanel
          activeBonds={[]}
          ownedHeroIds={['liubei', 'guanyu']}
          formationHeroIds={['liubei', 'guanyu']}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('tab-active-bonds')).toHaveTextContent('已激活');
      expect(screen.getByTestId('tab-all-bonds')).toHaveTextContent('全部图鉴');
    });

    it('ACC-12-07: Tab显示对应数量', () => {
      const activeBonds = [
        { bondId: 'faction_shu', name: '蜀阵营羁绊', type: 'faction' as const, participants: ['liubei', 'guanyu'], effects: {} },
      ];
      render(
        <BondCollectionPanel
          activeBonds={activeBonds}
          ownedHeroIds={['liubei', 'guanyu']}
          formationHeroIds={['liubei', 'guanyu']}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('tab-active-bonds')).toHaveTextContent('1');
    });
  });

  // ── ACC-12-08: 武将详情中的羁绊标签 ──
  describe('ACC-12-08: 武将详情中的羁绊标签', () => {
    it('ACC-12-08: 显示"参与羁绊"区域', () => {
      render(<HeroDetailBonds heroId="liubei" />);
      expect(screen.getByTestId('hero-detail-bonds')).toBeInTheDocument();
      expect(screen.getByText('参与羁绊')).toBeInTheDocument();
    });

    it('ACC-12-08: 阵营羁绊标签有🏛️前缀', () => {
      render(<HeroDetailBonds heroId="liubei" />);
      const tags = screen.getAllByTestId(/^hero-bond-tag-faction/);
      expect(tags.length).toBeGreaterThan(0);
      tags.forEach((tag) => {
        expect(tag.textContent).toContain('🏛️');
      });
    });

    it('ACC-12-08: 搭档羁绊标签有🤝前缀', () => {
      render(<HeroDetailBonds heroId="liubei" />);
      // liubei 参与桃园结义
      const taoyuanTag = screen.getByTestId('hero-bond-tag-partner_taoyuan');
      expect(taoyuanTag.textContent).toContain('🤝');
      expect(taoyuanTag.textContent).toContain('桃园结义');
    });
  });

  // ── ACC-12-09: 羁绊图鉴阵营分布条 ──
  describe('ACC-12-09: 羁绊图鉴阵营分布条', () => {
    it('ACC-12-09: 编队非空时显示阵营分布区域', () => {
      render(
        <BondCollectionPanel
          activeBonds={[]}
          ownedHeroIds={['liubei', 'guanyu', 'caocao']}
          formationHeroIds={['liubei', 'guanyu', 'caocao']}
          heroFactionMap={{ liubei: 'shu', guanyu: 'shu', caocao: 'wei' }}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('bond-faction-distribution')).toBeInTheDocument();
    });

    it('ACC-12-09: 显示"编队阵营分布"标题', () => {
      render(
        <BondCollectionPanel
          activeBonds={[]}
          ownedHeroIds={['liubei']}
          formationHeroIds={['liubei']}
          heroFactionMap={{ liubei: 'shu' }}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText('编队阵营分布')).toBeInTheDocument();
    });
  });

  // ── ACC-12-16: 羁绊图鉴Tab切换操作 ──
  describe('ACC-12-16: 羁绊图鉴Tab切换操作', () => {
    it('ACC-12-16: 点击"全部图鉴"Tab切换列表', () => {
      render(
        <BondCollectionPanel
          activeBonds={[]}
          ownedHeroIds={['liubei', 'guanyu']}
          formationHeroIds={['liubei', 'guanyu']}
          onClose={vi.fn()}
        />,
      );
      const allTab = screen.getByTestId('tab-all-bonds');
      fireEvent.click(allTab);
      // 全部图鉴应显示分组标题
      expect(screen.getByText('🏛️ 阵营羁绊')).toBeInTheDocument();
      expect(screen.getByText('🤝 搭档羁绊')).toBeInTheDocument();
    });
  });

  // ── ACC-12-17: 羁绊图鉴Tab切回已激活 ──
  describe('ACC-12-17: 羁绊图鉴Tab切回已激活', () => {
    it('ACC-12-17: 无激活羁绊时"已激活"Tab显示空状态', () => {
      render(
        <BondCollectionPanel
          activeBonds={[]}
          ownedHeroIds={[]}
          formationHeroIds={[]}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText('暂无激活的羁绊')).toBeInTheDocument();
    });

    it('ACC-12-17: 有激活羁绊时"已激活"Tab仅显示已激活项', () => {
      const activeBonds = [
        { bondId: 'faction_shu', name: '蜀国', type: 'faction' as const, participants: ['liubei', 'guanyu'], effects: {} },
      ];
      render(
        <BondCollectionPanel
          activeBonds={activeBonds}
          ownedHeroIds={['liubei', 'guanyu']}
          formationHeroIds={['liubei', 'guanyu']}
          onClose={vi.fn()}
        />,
      );
      // 默认在"已激活"Tab，应显示蜀阵营羁绊
      const panel = screen.getByTestId('bond-collection-panel');
      expect(panel.textContent).toContain('蜀国');
    });
  });

  // ── ACC-12-18: 编队羁绊预览区域 ──
  describe('ACC-12-18: 编队羁绊预览区域', () => {
    it('ACC-12-18: 激活羁绊后显示编队总加成预览', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      expect(screen.getByTestId('bond-total-bonus')).toBeInTheDocument();
      expect(screen.getByTestId('bond-total-bonus-effects')).toBeInTheDocument();
    });

    it('ACC-12-18: 总加成预览显示具体属性加成', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      const effects = screen.getByTestId('bond-total-bonus-effects');
      expect(effects.textContent).toContain('攻击');
    });
  });

  // ── ACC-12-29: 羁绊收集进度数值 ──
  describe('ACC-12-29: 羁绊收集进度数值', () => {
    it('ACC-12-29: 总进度百分比计算正确（四舍五入）', () => {
      render(
        <BondCollectionProgress
          totalBonds={20}
          activatedBonds={7}
          factionActivated={3}
          factionTotal={8}
          partnerActivated={4}
          partnerTotal={12}
        />,
      );
      // 7/20 = 35%
      const progress = screen.getByTestId('bond-collection-progress');
      expect(progress.textContent).toContain('35%');
      expect(progress.textContent).toContain('7/20 已激活');
    });

    it('ACC-12-29: 分类进度显示阵营和搭档数值', () => {
      render(
        <BondCollectionProgress
          totalBonds={20}
          activatedBonds={7}
          factionActivated={3}
          factionTotal={8}
          partnerActivated={4}
          partnerTotal={12}
        />,
      );
      const progress = screen.getByTestId('bond-collection-progress');
      expect(progress.textContent).toContain('3/8');
      expect(progress.textContent).toContain('4/12');
    });

    it('ACC-12-29: 零进度不报错', () => {
      render(
        <BondCollectionProgress
          totalBonds={0}
          activatedBonds={0}
          factionActivated={0}
          factionTotal={0}
          partnerActivated={0}
          partnerTotal={0}
        />,
      );
      const progress = screen.getByTestId('bond-collection-progress');
      expect(progress.textContent).toContain('0%');
    });
  });

  // ── ACC-12-35: 羁绊图鉴空数据 ──
  describe('ACC-12-35: 羁绊图鉴空数据', () => {
    it('ACC-12-35: 无武将时"已激活"Tab显示空状态', () => {
      render(
        <BondCollectionPanel
          activeBonds={[]}
          ownedHeroIds={[]}
          formationHeroIds={[]}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText('暂无激活的羁绊')).toBeInTheDocument();
    });

    it('ACC-12-35: 无武将时"全部图鉴"Tab无JS报错', () => {
      expect(() => {
        render(
          <BondCollectionPanel
            activeBonds={[]}
            ownedHeroIds={[]}
            formationHeroIds={[]}
            onClose={vi.fn()}
          />,
        );
        fireEvent.click(screen.getByTestId('tab-all-bonds'));
      }).not.toThrow();
    });
  });

  // ── ACC-12-36: 快速切换编队武将 ──
  describe('ACC-12-36: 快速切换编队武将', () => {
    it('ACC-12-36: 快速添加/移除武将面板无残留', () => {
      const { rerender } = render(<BondPanel {...makeProps({ heroIds: [] })} />);
      expect(screen.getByTestId('bond-panel-empty')).toBeInTheDocument();

      // 快速切换10次
      for (let i = 0; i < 10; i++) {
        const heroes = i % 2 === 0 ? ['liubei', 'guanyu'] : [];
        rerender(<BondPanel {...makeProps({ heroIds: heroes })} />);
      }

      // 最终状态：空编队
      expect(screen.getByTestId('bond-panel-empty')).toBeInTheDocument();
    });

    it('ACC-12-36: 快速切换后最终状态正确', () => {
      const { rerender } = render(<BondPanel {...makeProps({ heroIds: [] })} />);

      rerender(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      rerender(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu', 'zhangfei'] })} />);

      // 3名蜀国应激活中级羁绊
      const panel = screen.getByTestId('bond-panel');
      expect(panel.textContent).toContain('已激活');
    });
  });

  // ── ACC-12-40: 羁绊面板竖屏布局 ──
  describe('ACC-12-40: 羁绊面板竖屏布局', () => {
    it('ACC-12-40: BondPanel有响应式容器样式', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      const panel = screen.getByTestId('bond-panel');
      expect(panel.className).toContain('bond-panel');
    });

    it('ACC-12-40: BondCollectionPanel有role=region', () => {
      render(
        <BondCollectionPanel
          activeBonds={[]}
          ownedHeroIds={['liubei']}
          formationHeroIds={['liubei']}
          onClose={vi.fn()}
        />,
      );
      const panel = screen.getByTestId('bond-collection-panel');
      expect(panel).toHaveAttribute('role', 'region');
    });
  });

  // ── ACC-12-44: 羁绊图鉴Tab手机操作 ──
  describe('ACC-12-44: 羁绊图鉴Tab手机操作', () => {
    it('ACC-12-44: Tab按钮有role=tab属性', () => {
      render(
        <BondCollectionPanel
          activeBonds={[]}
          ownedHeroIds={['liubei']}
          formationHeroIds={['liubei']}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('tab-active-bonds')).toHaveAttribute('role', 'tab');
      expect(screen.getByTestId('tab-all-bonds')).toHaveAttribute('role', 'tab');
    });

    it('ACC-12-44: Tab有aria-selected属性', () => {
      render(
        <BondCollectionPanel
          activeBonds={[]}
          ownedHeroIds={['liubei']}
          formationHeroIds={['liubei']}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('tab-active-bonds')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('tab-all-bonds')).toHaveAttribute('aria-selected', 'false');
    });
  });

  // ── ACC-12-45: 阵营分布条手机显示 ──
  describe('ACC-12-45: 阵营分布条手机显示', () => {
    it('ACC-12-45: 分布条色段有宽度样式', () => {
      render(
        <BondCollectionPanel
          activeBonds={[]}
          ownedHeroIds={['liubei', 'guanyu', 'caocao']}
          formationHeroIds={['liubei', 'guanyu', 'caocao']}
          heroFactionMap={{ liubei: 'shu', guanyu: 'shu', caocao: 'wei' }}
          onClose={vi.fn()}
        />,
      );
      const shuSegment = screen.getByTestId('faction-segment-shu');
      expect(shuSegment.style.width).toBeTruthy();
    });
  });

  // ── ACC-12-46: 羁绊收集进度条手机显示 ──
  describe('ACC-12-46: 羁绊收集进度条手机显示', () => {
    it('ACC-12-46: 进度条有progressbar角色', () => {
      render(
        <BondCollectionProgress
          totalBonds={20}
          activatedBonds={5}
          factionActivated={2}
          factionTotal={8}
          partnerActivated={3}
          partnerTotal={12}
        />,
      );
      const totalBar = screen.getByTestId('bond-total-bar');
      expect(totalBar).toHaveAttribute('role', 'progressbar');
      expect(totalBar).toHaveAttribute('aria-valuenow', '25');
    });
  });

  // ── ACC-12-47: 编队羁绊预览手机显示 ──
  describe('ACC-12-47: 编队羁绊预览手机显示', () => {
    it('ACC-12-47: 总加成预览区域有语义化标记', () => {
      render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      const bonus = screen.getByTestId('bond-total-bonus');
      expect(bonus).toBeInTheDocument();
      // 确认加成项文字可读
      const effects = screen.getByTestId('bond-total-bonus-effects');
      expect(effects.children.length).toBeGreaterThan(0);
    });
  });

  // ── ACC-12-48: 长羁绊列表滚动 ──
  describe('ACC-12-48: 长羁绊列表滚动', () => {
    it('ACC-12-48: 全部图鉴Tab显示阵营和搭档分组', () => {
      render(
        <BondCollectionPanel
          activeBonds={[]}
          ownedHeroIds={['liubei', 'guanyu']}
          formationHeroIds={['liubei', 'guanyu']}
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByTestId('tab-all-bonds'));
      // 验证分组标题存在
      expect(screen.getByText('🏛️ 阵营羁绊')).toBeInTheDocument();
      expect(screen.getByText('🤝 搭档羁绊')).toBeInTheDocument();
    });
  });

  // ── ACC-12-49: 横竖屏切换 ──
  describe('ACC-12-49: 横竖屏切换', () => {
    it('ACC-12-49: BondPanel组件响应式布局不变', () => {
      const { container } = render(<BondPanel {...makeProps({ heroIds: ['liubei', 'guanyu'] })} />);
      const panel = container.querySelector('.bond-panel');
      expect(panel).toBeTruthy();
    });

    it('ACC-12-49: BondCollectionPanel布局自适应', () => {
      render(
        <BondCollectionPanel
          activeBonds={[]}
          ownedHeroIds={['liubei']}
          formationHeroIds={['liubei']}
          onClose={vi.fn()}
        />,
      );
      const panel = screen.getByTestId('bond-collection-panel');
      expect(panel).toHaveAttribute('role', 'region');
      expect(panel).toHaveAttribute('aria-label', '羁绊图鉴');
    });
  });
});
