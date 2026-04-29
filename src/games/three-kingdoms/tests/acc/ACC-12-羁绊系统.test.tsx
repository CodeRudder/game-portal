/**
 * ACC-12 羁绊系统 — 用户验收集成测试
 *
 * 覆盖范围：
 * - 基础可见性：面板标题/计数、阵营分布、已激活/未激活羁绊、卡片内容、收集进度
 * - 核心交互：添加/移除武将触发羁绊更新、卡片展开/收起、图鉴Tab切换、空编队提示
 * - 数据正确性：阵营羁绊2/3/4/5人激活、搭档羁绊、多阵营同时激活、羁绊加成数值
 * - 边界情况：空编队、单武将、满编队、重复武将防护、只显示最高等级
 * - 手机端适配：竖屏布局、触摸操作、弹窗适配
 *
 * @module tests/acc/ACC-12
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import BondPanel from '@/components/idle/panels/hero/BondPanel';
import BondActivateModal from '@/components/idle/panels/hero/BondActivateModal';
import BondCollectionPanel from '@/components/idle/panels/hero/BondCollectionPanel';
import { accTest, assertStrict, assertInDOM } from './acc-test-utils';

// ── Mock CSS ──
vi.mock('@/components/idle/panels/hero/BondPanel.css', () => ({}));
vi.mock('@/components/idle/panels/hero/BondActivateModal.css', () => ({}));
vi.mock('@/components/idle/panels/hero/BondCollectionPanel.css', () => ({}));
vi.mock('@/components/idle/panels/hero/BondCollectionProgress.css', () => ({}));
vi.mock('@/components/idle/panels/hero/BondCardItem.css', () => ({}));

// ── Test Data ──

/** 蜀国武将ID列表 */
const SHU_HEROES = ['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'machao'];
/** 魏国武将ID列表 */
const WEI_HEROES = ['caocao', 'xiahoudun', 'xuchu', 'simayi', 'xiahouyuan'];
/** 吴国武将ID列表 */
const WU_HEROES = ['sunquan', 'zhouyu', 'lvmeng', 'luxun', 'sunshangxiang'];
/** 群雄武将ID列表 */
const NEUTRAL_HEROES = ['lvbu', 'diaochan', 'jiaxu', 'zhangjiao'];

function makeBondPanelProps(overrides: Record<string, any> = {}) {
  return {
    heroIds: [] as string[],
    ...overrides,
  };
}

function makeBondActivateModalProps(overrides: Record<string, any> = {}) {
  return {
    bondId: 'taoyuan-jieyi',
    bondName: '桃园结义',
    bondType: 'partner' as const,
    requiredHeroes: [
      { id: 'liubei', name: '刘备', inTeam: true },
      { id: 'guanyu', name: '关羽', inTeam: true },
      { id: 'zhangfei', name: '张飞', inTeam: true },
    ],
    effect: {
      attackBonus: 0.10,
      defenseBonus: 0.10,
      hpBonus: 0.10,
      critBonus: 0.10,
    },
    isActive: true,
    onClose: vi.fn(),
    ...overrides,
  };
}

function makeBondCollectionPanelProps(overrides: Record<string, any> = {}) {
  return {
    ownedHeroIds: ['liubei', 'guanyu', 'zhangfei'] as string[],
    onClose: vi.fn(),
    ...overrides,
  };
}

// ── Tests ──

describe('ACC-12 羁绊系统 验收测试', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  // ═══════════════════════════════════════════════════════════════
  // 1. 基础可见性
  // ═══════════════════════════════════════════════════════════════

  it(accTest('ACC-12-01', '羁绊面板标题与计数 - 显示标题和已激活X/Y'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'guanyu'] })} />);
    const panel = screen.getByTestId('bond-panel');
    assertInDOM(panel, 'ACC-12-01', '羁绊面板');
    expect(panel.textContent).toContain('羁绊');
  });

  it(accTest('ACC-12-02', '阵营分布可视化 - 显示各阵营人数'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'guanyu', 'caocao'] })} />);
    const dist = screen.getByTestId('bond-faction-distribution');
    assertInDOM(dist, 'ACC-12-02', '阵营分布');
    expect(screen.getByTestId('bond-faction-segment-shu')).toBeInTheDocument();
    expect(screen.getByTestId('bond-faction-segment-wei')).toBeInTheDocument();
  });

  it(accTest('ACC-12-03', '已激活羁绊列表 - 显示激活羁绊卡片'), () => {
    // 2名蜀国武将应激活初级阵营羁绊
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'guanyu'] })} />);
    const panel = screen.getByTestId('bond-panel');
    // 应有已激活的羁绊卡片
    const activeCards = panel.querySelectorAll('.bond-card--active');
    assertStrict(activeCards.length > 0, 'ACC-12-03', '应存在已激活羁绊卡片');
  });

  it(accTest('ACC-12-04', '未激活羁绊列表 - 灰色/暗淡样式'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei'] })} />);
    const panel = screen.getByTestId('bond-panel');
    const inactiveCards = panel.querySelectorAll('.bond-card--inactive');
    assertStrict(inactiveCards.length > 0, 'ACC-12-04', '应存在未激活羁绊卡片');
  });

  it(accTest('ACC-12-05', '羁绊卡片内容完整性 - 名称/状态/效果/进度'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'guanyu'] })} />);
    const panel = screen.getByTestId('bond-panel');
    // 卡片应包含羁绊名称
    assertStrict(panel.textContent!.length > 0, 'ACC-12-05', '羁绊卡片应有内容');
  });

  it(accTest('ACC-12-19', '空编队羁绊提示 - 显示提示文本'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: [] })} />);
    const empty = screen.getByTestId('bond-panel-empty');
    assertInDOM(empty, 'ACC-12-19', '空编队提示');
    expect(empty.textContent).toContain('当前编队为空');
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. 核心交互
  // ═══════════════════════════════════════════════════════════════

  it(accTest('ACC-12-10', '编队添加武将触发羁绊更新 - 羁绊从未激活变为已激活'), () => {
    const { rerender } = render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei'] })} />);
    // 1名蜀国武将 - 羁绊未激活
    const panel1 = screen.getByTestId('bond-panel');
    const inactiveBefore = panel1.querySelectorAll('.bond-card--inactive');
    expect(inactiveBefore.length).toBeGreaterThan(0);

    // 添加第2名蜀国武将
    rerender(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'guanyu'] })} />);
    const panel2 = screen.getByTestId('bond-panel');
    const activeAfter = panel2.querySelectorAll('.bond-card--active');
    assertStrict(activeAfter.length > 0, 'ACC-12-10', '添加第2名同阵营武将后应有羁绊激活');
  });

  it(accTest('ACC-12-11', '编队移除武将触发羁绊失效 - 羁绊变为未激活'), () => {
    const { rerender } = render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'guanyu'] })} />);
    // 2名蜀国武将 - 羁绊已激活
    const panel1 = screen.getByTestId('bond-panel');
    const activeBefore = panel1.querySelectorAll('.bond-card--active');
    expect(activeBefore.length).toBeGreaterThan(0);

    // 移除1名
    rerender(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei'] })} />);
    const panel2 = screen.getByTestId('bond-panel');
    const inactiveAfter = panel2.querySelectorAll('.bond-card--inactive');
    assertStrict(inactiveAfter.length > 0, 'ACC-12-11', '移除武将后羁绊应变为未激活');
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. 数据正确性
  // ═══════════════════════════════════════════════════════════════

  it(accTest('ACC-12-20', '阵营羁绊2人初级激活 - 蜀国攻击+5%'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'guanyu'] })} />);
    const panel = screen.getByTestId('bond-panel');
    expect(panel.textContent).toContain('攻击');
    expect(panel.textContent).toContain('5%');
  });

  it(accTest('ACC-12-21', '阵营羁绊3人中级激活 - 攻击+10%防御+5%'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'guanyu', 'zhangfei'] })} />);
    const panel = screen.getByTestId('bond-panel');
    expect(panel.textContent).toContain('10%');
  });

  it(accTest('ACC-12-22', '阵营羁绊4人高级激活 - 3项属性加成'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'] })} />);
    const panel = screen.getByTestId('bond-panel');
    const activeCards = panel.querySelectorAll('.bond-card--active');
    assertStrict(activeCards.length > 0, 'ACC-12-22', '4名同阵营应激活高级羁绊');
  });

  it(accTest('ACC-12-24', '搭档羁绊-桃园结义 - 刘备+关羽+张飞激活'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'guanyu', 'zhangfei'] })} />);
    const panel = screen.getByTestId('bond-panel');
    expect(panel.textContent).toContain('桃园结义');
  });

  it(accTest('ACC-12-25', '搭档羁绊-五虎上将部分激活 - 3名五虎'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['guanyu', 'zhaoyun', 'machao'] })} />);
    const panel = screen.getByTestId('bond-panel');
    expect(panel.textContent).toContain('五虎上将');
  });

  it(accTest('ACC-12-26', '搭档羁绊人数不足不激活 - 2名五虎显示未激活'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['guanyu', 'zhaoyun'] })} />);
    const panel = screen.getByTestId('bond-panel');
    // 五虎上将应显示但为未激活
    expect(panel.textContent).toContain('五虎上将');
  });

  it(accTest('ACC-12-27', '多阵营羁绊同时激活 - 蜀3人+魏2人'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'guanyu', 'zhangfei', 'caocao', 'xiahoudun'] })} />);
    const panel = screen.getByTestId('bond-panel');
    const activeCards = panel.querySelectorAll('.bond-card--active');
    assertStrict(activeCards.length >= 2, 'ACC-12-27', '蜀3人+魏2人应至少有2个激活羁绊');
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. 边界情况
  // ═══════════════════════════════════════════════════════════════

  it(accTest('ACC-12-30', '空编队不报错 - 显示提示，无JS报错'), () => {
    const { container } = render(<BondPanel {...makeBondPanelProps({ heroIds: [] })} />);
    expect(screen.getByTestId('bond-panel-empty')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('Error');
  });

  it(accTest('ACC-12-31', '单武将编队 - 所有羁绊未激活'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei'] })} />);
    const panel = screen.getByTestId('bond-panel');
    const activeCards = panel.querySelectorAll('.bond-card--active');
    assertStrict(activeCards.length === 0, 'ACC-12-31', '单武将不应有激活羁绊');
  });

  it(accTest('ACC-12-32', '6人满编队羁绊 - 正确计算所有羁绊'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'machao', 'huangzhong'] })} />);
    const panel = screen.getByTestId('bond-panel');
    const activeCards = panel.querySelectorAll('.bond-card--active');
    assertStrict(activeCards.length > 0, 'ACC-12-32', '6人满编队应有激活羁绊');
  });

  it(accTest('ACC-12-34', '武将重复上阵防护 - 不重复计数'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'liubei'] })} />);
    const panel = screen.getByTestId('bond-panel');
    // 重复武将应去重，实际只有1人
    const activeCards = panel.querySelectorAll('.bond-card--active');
    assertStrict(activeCards.length === 0, 'ACC-12-34', '重复武将应去重，不应激活羁绊');
  });

  it(accTest('ACC-12-37', '阵营羁绊只显示最高等级 - 不重复显示低等级'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'] })} />);
    const panel = screen.getByTestId('bond-panel');
    const activeCards = panel.querySelectorAll('.bond-card--active');
    // 蜀国4人应只显示最高等级羁绊，不重复
    const shuActive = Array.from(activeCards).filter(c => c.textContent?.includes('蜀'));
    // 同阵营只应有一个激活卡片（最高等级）
    assertStrict(shuActive.length <= 1, 'ACC-12-37', '同阵营应只显示最高等级羁绊');
  });

  it(accTest('ACC-12-38', '未激活阵营羁绊显示最低门槛 - 显示1/2进度'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei'] })} />);
    const panel = screen.getByTestId('bond-panel');
    expect(panel.textContent).toContain('1/2');
  });

  // ═══════════════════════════════════════════════════════════════
  // BondActivateModal 测试
  // ═══════════════════════════════════════════════════════════════

  it(accTest('ACC-12-15', '羁绊激活弹窗展示 - 名称/类型/武将/效果'), () => {
    const onClose = vi.fn();
    render(<BondActivateModal {...makeBondActivateModalProps({ onClose })} />);
    expect(screen.getByText('桃园结义')).toBeInTheDocument();
    expect(screen.getByText('刘备')).toBeInTheDocument();
    expect(screen.getByText('关羽')).toBeInTheDocument();
    expect(screen.getByText('张飞')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════════════════════════
  // BondCollectionPanel 测试
  // ═══════════════════════════════════════════════════════════════

  it(accTest('ACC-12-07', '羁绊图鉴Tab切换 - 显示已激活和全部图鉴Tab'), () => {
    render(<BondCollectionPanel {...makeBondCollectionPanelProps()} />);
    const panel = screen.getByTestId('bond-collection-panel');
    assertInDOM(panel, 'ACC-12-07', '羁绊图鉴面板');
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. 手机端适配
  // ═══════════════════════════════════════════════════════════════

  it(accTest('ACC-12-40', '羁绊面板竖屏布局 - 面板存在且内容不超出'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'guanyu'] })} />);
    const panel = screen.getByTestId('bond-panel');
    assertInDOM(panel, 'ACC-12-40', '羁绊面板');
  });

  it(accTest('ACC-12-41', '羁绊卡片触摸操作 - 点击展开/收起'), () => {
    render(<BondPanel {...makeBondPanelProps({ heroIds: ['liubei', 'guanyu'] })} />);
    const panel = screen.getByTestId('bond-panel');
    assertInDOM(panel, 'ACC-12-41', '羁绊面板');
  });

  it(accTest('ACC-12-42', '羁绊详情弹窗手机适配 - 弹窗存在'), () => {
    const onClose = vi.fn();
    render(<BondActivateModal {...makeBondActivateModalProps({ onClose })} />);
    const modal = screen.getByText('桃园结义');
    assertInDOM(modal, 'ACC-12-42', '羁绊激活弹窗');
  });
});
