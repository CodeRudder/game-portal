/**
 * EquipmentBag 组件测试
 *
 * 覆盖：渲染、筛选、排序、装备卡片、穿戴/卸下
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EquipmentBag } from '../EquipmentBag';
import type { EquipmentInstance } from '../../../../core/equipment/equipment.types';

// ── Fixtures ──

const createEquip = (overrides: Partial<EquipmentInstance> = {}): EquipmentInstance => ({
  uid: 'e1',
  templateId: 't1',
  name: '青龙偃月刀',
  slot: 'weapon',
  rarity: 'purple',
  enhanceLevel: 5,
  mainStat: { type: 'attack', baseValue: 100, value: 150 },
  subStats: [{ type: 'critRate', baseValue: 5, value: 8 }],
  specialEffect: null,
  source: 'campaign_drop',
  acquiredAt: Date.now(),
  isEquipped: false,
  equippedHeroId: null,
  seed: 12345,
  ...overrides,
});

const equip1 = createEquip({ uid: 'e1', name: '青龙偃月刀', slot: 'weapon', rarity: 'purple', enhanceLevel: 5 });
const equip2 = createEquip({ uid: 'e2', name: '白银铠甲', slot: 'armor', rarity: 'blue', enhanceLevel: 3, mainStat: { type: 'defense', baseValue: 80, value: 100 } });
const equip3 = createEquip({ uid: 'e3', name: '赤兔马', slot: 'mount', rarity: 'gold', enhanceLevel: 10, mainStat: { type: 'speed', baseValue: 50, value: 120 }, isEquipped: true, equippedHeroId: 'h1' });

describe('EquipmentBag', () => {
  const defaultEquips = [equip1, equip2, equip3];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 渲染 ──

  it('渲染装备背包标题', () => {
    render(<EquipmentBag equipments={defaultEquips} />);
    expect(screen.getByText(/装备背包/)).toBeInTheDocument();
  });

  it('显示装备数量', () => {
    render(<EquipmentBag equipments={defaultEquips} />);
    expect(screen.getByText(/🎒 装备背包 \(3\)/)).toBeInTheDocument();
  });

  // ── 装备卡片 ──

  it('渲染装备名称', () => {
    render(<EquipmentBag equipments={defaultEquips} />);
    expect(screen.getByText('青龙偃月刀')).toBeInTheDocument();
    expect(screen.getByText('白银铠甲')).toBeInTheDocument();
    expect(screen.getByText('赤兔马')).toBeInTheDocument();
  });

  it('已穿戴装备显示"卸下"按钮', () => {
    render(<EquipmentBag equipments={defaultEquips} />);
    expect(screen.getByText('卸下')).toBeInTheDocument();
  });

  it('未穿戴装备显示"穿戴"按钮', () => {
    render(<EquipmentBag equipments={defaultEquips} />);
    const equipBtns = screen.getAllByText('穿戴');
    expect(equipBtns.length).toBeGreaterThanOrEqual(1);
  });

  // ── 筛选 ──

  it('渲染部位筛选按钮', () => {
    render(<EquipmentBag equipments={defaultEquips} />);
    expect(screen.getByText('全部')).toBeInTheDocument();
  });

  it('点击部位筛选过滤装备', () => {
    render(<EquipmentBag equipments={defaultEquips} />);
    // Click weapon filter (use button role to target filter buttons specifically)
    const filterBtns = screen.getAllByText('⚔️');
    fireEvent.click(filterBtns[0]);
    // Should only show weapon
    expect(screen.getByText('青龙偃月刀')).toBeInTheDocument();
    expect(screen.queryByText('白银铠甲')).not.toBeInTheDocument();
  });

  it('点击品质筛选过滤装备', () => {
    render(<EquipmentBag equipments={[equip1, equip2]} />);
    fireEvent.click(screen.getByText('精品'));
    expect(screen.getByText('青龙偃月刀')).toBeInTheDocument();
    expect(screen.queryByText('白银铠甲')).not.toBeInTheDocument();
  });

  // ── 排序 ──

  it('渲染排序按钮', () => {
    render(<EquipmentBag equipments={defaultEquips} />);
    expect(screen.getByText('品质↓')).toBeInTheDocument();
    expect(screen.getByText('等级↓')).toBeInTheDocument();
  });

  // ── 回调 ──

  it('点击穿戴触发 onEquip', () => {
    const onEquip = vi.fn();
    render(<EquipmentBag equipments={[equip1]} onEquip={onEquip} />);
    fireEvent.click(screen.getByText('穿戴'));
    expect(onEquip).toHaveBeenCalledWith('e1');
  });

  it('点击卸下触发 onUnequip', () => {
    const onUnequip = vi.fn();
    render(<EquipmentBag equipments={[equip3]} onUnequip={onUnequip} />);
    fireEvent.click(screen.getByText('卸下'));
    expect(onUnequip).toHaveBeenCalledWith('e3');
  });

  // ── 空列表 ──

  it('空装备列表显示提示', () => {
    render(<EquipmentBag equipments={[]} />);
    expect(screen.getByText('暂无装备')).toBeInTheDocument();
  });

  // ── 无障碍 ──

  it('具有 aria-label', () => {
    render(<EquipmentBag equipments={defaultEquips} />);
    expect(screen.getByRole('region', { name: '装备背包' })).toBeInTheDocument();
  });
});
