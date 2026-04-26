/**
 * BondCollectionPanel — 羁绊图鉴面板测试
 *
 * 覆盖场景：
 * - 渲染测试（面板正常渲染、Tab展示）
 * - Tab切换（已激活/全部图鉴）
 * - 羁绊卡片展示（名称、状态标签、描述、武将标签）
 * - 交互测试（点击卡片展开详情）
 * - 边界测试（无羁绊/无激活羁绊）
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BondCollectionPanel from '../BondCollectionPanel';
import type { BondCatalogItem } from '../BondCollectionPanel';
import type { ActiveBond } from '@/games/three-kingdoms/engine/hero/BondSystem';
import { BondType } from '@/games/three-kingdoms/engine/hero/bond-config';

// ── Mock CSS ──
vi.mock('../BondCollectionPanel.css', () => ({}));

// ── 测试数据工厂 ──

const makeActiveBond = (overrides: Partial<ActiveBond> = {}): ActiveBond => ({
  bondId: 'faction_shu',
  name: '蜀国',
  type: BondType.FACTION,
  level: 1,
  levelMultiplier: 1.0,
  effects: [{ stat: 'attack', value: 0.05 }],
  participants: ['liubei', 'guanyu'],
  dispatchFactor: 1.0,
  ...overrides,
});

const makeBondCatalogItem = (overrides: Partial<BondCatalogItem> = {}): BondCatalogItem => ({
  id: 'faction_shu',
  name: '蜀国',
  type: BondType.FACTION,
  faction: 'shu',
  heroIds: ['liubei', 'guanyu', 'zhangfei'],
  heroNames: ['刘备', '关羽', '张飞'],
  description: '2人: 攻击+5% | 3人: 攻击+10%, 防御+5%',
  level: 1,
  effects: [{ stat: 'attack', value: 0.05 }],
  isActive: true,
  minRequired: 2,
  ...overrides,
});

const makeProps = (overrides: Record<string, unknown> = {}) => ({
  ownedHeroIds: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'],
  activeBonds: [
    makeActiveBond({ bondId: 'faction_shu', name: '蜀国' }),
  ] as ActiveBond[],
  formationHeroIds: ['liubei', 'guanyu', 'zhangfei'],
  onClose: vi.fn(),
  ...overrides,
});

// ── 测试 ──

describe('BondCollectionPanel', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染测试
  // ═══════════════════════════════════════════

  it('应正常渲染面板', () => {
    render(<BondCollectionPanel {...makeProps({ onClose })} />);
    expect(screen.getByTestId('bond-collection-panel')).toBeInTheDocument();
  });

  it('应显示Tab按钮', () => {
    render(<BondCollectionPanel {...makeProps({ onClose })} />);
    expect(screen.getByTestId('tab-active-bonds')).toBeInTheDocument();
    expect(screen.getByTestId('tab-all-bonds')).toBeInTheDocument();
  });

  it('默认应选中"已激活"Tab', () => {
    render(<BondCollectionPanel {...makeProps({ onClose })} />);
    const activeTab = screen.getByTestId('tab-active-bonds');
    expect(activeTab).toHaveAttribute('aria-selected', 'true');
  });

  // ═══════════════════════════════════════════
  // 2. 使用外部图鉴数据渲染
  // ═══════════════════════════════════════════

  it('使用外部bondCatalog时应正确渲染羁绊卡片', () => {
    const catalog: BondCatalogItem[] = [
      makeBondCatalogItem({ id: 'faction_shu', name: '蜀国', isActive: true }),
      makeBondCatalogItem({
        id: 'partner_taoyuan',
        name: '桃园结义',
        type: BondType.PARTNER,
        heroIds: ['liubei', 'guanyu', 'zhangfei'],
        heroNames: ['刘备', '关羽', '张飞'],
        description: '攻击+15%',
        effects: [{ stat: 'attack', value: 0.15 }],
        minRequired: 3,
        isActive: true,
      }),
    ];
    render(<BondCollectionPanel {...makeProps({ bondCatalog: catalog, onClose })} />);
    expect(screen.getByTestId('bond-card-faction_shu')).toBeInTheDocument();
    expect(screen.getByTestId('bond-card-partner_taoyuan')).toBeInTheDocument();
  });

  it('应显示羁绊名称', () => {
    const catalog: BondCatalogItem[] = [
      makeBondCatalogItem({ name: '蜀国' }),
    ];
    render(<BondCollectionPanel {...makeProps({ bondCatalog: catalog, onClose })} />);
    expect(screen.getByText('蜀国')).toBeInTheDocument();
  });

  it('已激活羁绊应显示"已激活"标签', () => {
    const catalog: BondCatalogItem[] = [
      makeBondCatalogItem({ isActive: true }),
    ];
    render(<BondCollectionPanel {...makeProps({ bondCatalog: catalog, onClose })} />);
    expect(screen.getByText('已激活')).toBeInTheDocument();
  });

  it('未激活羁绊应显示"未激活"标签', () => {
    const catalog: BondCatalogItem[] = [
      makeBondCatalogItem({ id: 'bond_inactive', name: '测试羁绊', isActive: false, level: 0 }),
    ];
    // 切换到"全部"Tab才能看到未激活的
    render(<BondCollectionPanel {...makeProps({ bondCatalog: catalog, activeBonds: [], onClose })} />);
    fireEvent.click(screen.getByTestId('tab-all-bonds'));
    expect(screen.getByText('未激活')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. Tab切换
  // ═══════════════════════════════════════════

  it('点击"全部图鉴"Tab应切换', () => {
    const catalog: BondCatalogItem[] = [
      makeBondCatalogItem({ id: 'faction_shu', name: '蜀国', isActive: true }),
      makeBondCatalogItem({
        id: 'partner_wuhu', name: '五虎上将', type: BondType.PARTNER,
        heroIds: ['guanyu', 'zhangfei', 'zhaoyun'], heroNames: [],
        description: '暴击率+10%', effects: [{ stat: 'critRate', value: 0.1 }],
        minRequired: 3, isActive: false, level: 0,
      }),
    ];
    render(<BondCollectionPanel {...makeProps({ bondCatalog: catalog, onClose })} />);

    // 默认已激活Tab，只显示激活的
    expect(screen.getByTestId('bond-card-faction_shu')).toBeInTheDocument();
    expect(screen.queryByTestId('bond-card-partner_wuhu')).not.toBeInTheDocument();

    // 切换到全部
    fireEvent.click(screen.getByTestId('tab-all-bonds'));
    expect(screen.getByTestId('bond-card-faction_shu')).toBeInTheDocument();
    expect(screen.getByTestId('bond-card-partner_wuhu')).toBeInTheDocument();
  });

  it('Tab应显示计数', () => {
    const catalog: BondCatalogItem[] = [
      makeBondCatalogItem({ id: 'b1', isActive: true }),
      makeBondCatalogItem({ id: 'b2', isActive: false }),
    ];
    render(<BondCollectionPanel {...makeProps({ bondCatalog: catalog, activeBonds: [makeActiveBond()], onClose })} />);
    expect(screen.getByTestId('tab-active-bonds').textContent).toContain('1');
    expect(screen.getByTestId('tab-all-bonds').textContent).toContain('2');
  });

  // ═══════════════════════════════════════════
  // 4. 点击卡片展开详情
  // ═══════════════════════════════════════════

  it('点击羁绊卡片应展开详情', () => {
    const catalog: BondCatalogItem[] = [
      makeBondCatalogItem({ id: 'faction_shu', effects: [{ stat: 'attack', value: 0.05 }] }),
    ];
    render(<BondCollectionPanel {...makeProps({ bondCatalog: catalog, onClose })} />);

    // 详情不应存在
    expect(screen.queryByTestId('bond-detail-faction_shu')).not.toBeInTheDocument();

    // 点击展开
    fireEvent.click(screen.getByTestId('bond-card-faction_shu'));
    expect(screen.getByTestId('bond-detail-faction_shu')).toBeInTheDocument();
  });

  it('再次点击应折叠详情', () => {
    const catalog: BondCatalogItem[] = [
      makeBondCatalogItem({ id: 'faction_shu' }),
    ];
    render(<BondCollectionPanel {...makeProps({ bondCatalog: catalog, onClose })} />);

    fireEvent.click(screen.getByTestId('bond-card-faction_shu'));
    expect(screen.getByTestId('bond-detail-faction_shu')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('bond-card-faction_shu'));
    expect(screen.queryByTestId('bond-detail-faction_shu')).not.toBeInTheDocument();
  });

  it('详情应显示属性加成数值', () => {
    const catalog: BondCatalogItem[] = [
      makeBondCatalogItem({
        id: 'faction_shu',
        effects: [{ stat: 'attack', value: 0.05 }],
        isActive: true,
      }),
    ];
    render(<BondCollectionPanel {...makeProps({ bondCatalog: catalog, onClose })} />);
    fireEvent.click(screen.getByTestId('bond-card-faction_shu'));

    expect(screen.getByText('攻击')).toBeInTheDocument();
    expect(screen.getByText('+5%')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 5. 武将标签
  // ═══════════════════════════════════════════

  it('已拥有武将应显示绿色标签', () => {
    const catalog: BondCatalogItem[] = [
      makeBondCatalogItem({
        id: 'partner_taoyuan',
        name: '桃园结义',
        type: BondType.PARTNER,
        heroIds: ['liubei', 'guanyu'],
        heroNames: ['刘备', '关羽'],
        isActive: true,
      }),
    ];
    const { container } = render(
      <BondCollectionPanel {...makeProps({
        bondCatalog: catalog,
        ownedHeroIds: ['liubei', 'guanyu'],
        onClose,
      })} />,
    );
    const ownedTags = container.querySelectorAll('.tk-bond-hero-tag--owned');
    expect(ownedTags).toHaveLength(2);
  });

  it('未拥有武将应显示灰色标签', () => {
    const catalog: BondCatalogItem[] = [
      makeBondCatalogItem({
        id: 'partner_taoyuan',
        name: '桃园结义',
        type: BondType.PARTNER,
        heroIds: ['liubei', 'guanyu', 'zhangfei'],
        heroNames: ['刘备', '关羽', '张飞'],
        isActive: true,
      }),
    ];
    const { container } = render(
      <BondCollectionPanel {...makeProps({
        bondCatalog: catalog,
        ownedHeroIds: ['liubei'],
        onClose,
      })} />,
    );
    const missingTags = container.querySelectorAll('.tk-bond-hero-tag--missing');
    expect(missingTags).toHaveLength(2);
  });

  // ═══════════════════════════════════════════
  // 6. 分组展示
  // ═══════════════════════════════════════════

  it('应分组展示阵营羁绊和搭档羁绊', () => {
    const catalog: BondCatalogItem[] = [
      makeBondCatalogItem({ id: 'faction_shu', name: '蜀国', type: BondType.FACTION, isActive: true }),
      makeBondCatalogItem({
        id: 'partner_taoyuan', name: '桃园结义', type: BondType.PARTNER,
        heroIds: ['liubei'], heroNames: ['刘备'], description: '测试',
        effects: [], minRequired: 3, isActive: true,
      }),
    ];
    render(<BondCollectionPanel {...makeProps({ bondCatalog: catalog, onClose })} />);
    expect(screen.getByText('🏛️ 阵营羁绊')).toBeInTheDocument();
    expect(screen.getByText('🤝 搭档羁绊')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 7. 边界测试
  // ═══════════════════════════════════════════

  it('已激活Tab无羁绊时应显示空状态', () => {
    render(<BondCollectionPanel {...makeProps({ activeBonds: [], onClose })} />);
    expect(screen.getByText('暂无激活的羁绊')).toBeInTheDocument();
  });

  it('全部Tab无羁绊时应显示空状态', () => {
    render(
      <BondCollectionPanel
        {...makeProps({ activeBonds: [], bondCatalog: [], onClose })}
      />,
    );
    fireEvent.click(screen.getByTestId('tab-all-bonds'));
    expect(screen.getByText('暂无羁绊数据')).toBeInTheDocument();
  });

  it('羁绊等级为0时不应显示等级标签', () => {
    const catalog: BondCatalogItem[] = [
      makeBondCatalogItem({ id: 'b1', level: 0, isActive: false }),
    ];
    const { container } = render(
      <BondCollectionPanel {...makeProps({ bondCatalog: catalog, activeBonds: [], onClose })} />,
    );
    fireEvent.click(screen.getByTestId('tab-all-bonds'));
    const levelBadge = container.querySelector('.tk-bond-card__level');
    expect(levelBadge).not.toBeInTheDocument();
  });

  it('羁绊等级大于0时应显示等级标签', () => {
    const catalog: BondCatalogItem[] = [
      makeBondCatalogItem({ id: 'b1', level: 2, isActive: true }),
    ];
    render(<BondCollectionPanel {...makeProps({ bondCatalog: catalog, onClose })} />);
    expect(screen.getByText('Lv.2')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 8. 未激活羁绊详情中的激活条件
  // ═══════════════════════════════════════════

  it('未激活羁绊展开详情应显示激活条件', () => {
    const catalog: BondCatalogItem[] = [
      makeBondCatalogItem({
        id: 'partner_wuhu', name: '五虎上将', type: BondType.PARTNER,
        heroIds: ['guanyu'], heroNames: ['关羽'],
        description: '暴击+10%', effects: [{ stat: 'critRate', value: 0.1 }],
        minRequired: 3, isActive: false, level: 0,
      }),
    ];
    render(<BondCollectionPanel {...makeProps({ bondCatalog: catalog, activeBonds: [], onClose })} />);
    fireEvent.click(screen.getByTestId('tab-all-bonds'));
    fireEvent.click(screen.getByTestId('bond-card-partner_wuhu'));
    expect(screen.getByText('需要 3 名武将')).toBeInTheDocument();
  });
});
