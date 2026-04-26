/**
 * TerritoryInfoPanel — 领土信息面板测试
 *
 * 覆盖场景：
 * - 基础渲染：名称/等级/防御/区域
 * - 产出详情：四种资源产出
 * - 归属状态：己方显示升级按钮，敌方显示攻城按钮
 * - 总产出计算
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TerritoryInfoPanel from '../TerritoryInfoPanel';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';

// ── Mock CSS ──
vi.mock('../TerritoryInfoPanel.css', () => ({}));

// ── 测试数据 ──
const makeTerritory = (overrides: Partial<TerritoryData> = {}): TerritoryData => ({
  id: 'city-luoyang',
  name: '洛阳',
  position: { x: 5, y: 5 },
  region: 'central_plains',
  ownership: 'player',
  level: 3,
  baseProduction: { grain: 10, gold: 5, troops: 3, mandate: 1 },
  currentProduction: { grain: 15, gold: 7.5, troops: 4.5, mandate: 1.5 },
  defenseValue: 200,
  adjacentIds: ['city-xuchang'],
  ...overrides,
});

describe('TerritoryInfoPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 基础渲染 ──
  it('渲染领土名称', () => {
    render(<TerritoryInfoPanel territory={makeTerritory()} />);
    expect(screen.getByText('洛阳')).toBeTruthy();
  });

  it('显示等级和防御值', () => {
    render(<TerritoryInfoPanel territory={makeTerritory()} />);
    expect(screen.getByText('Lv.3')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
  });

  it('显示区域', () => {
    render(<TerritoryInfoPanel territory={makeTerritory()} />);
    expect(screen.getByText('central_plains')).toBeTruthy();
  });

  // ── 产出详情 ──
  it('显示四种资源产出', () => {
    render(<TerritoryInfoPanel territory={makeTerritory()} />);
    const panel = screen.getByTestId('territory-info-city-luoyang');
    expect(panel.textContent).toContain('15.0'); // grain
    expect(panel.textContent).toContain('7.5');  // gold
    expect(panel.textContent).toContain('4.5');  // troops
    expect(panel.textContent).toContain('1.5');  // mandate
  });

  it('显示总产出', () => {
    render(<TerritoryInfoPanel territory={makeTerritory()} />);
    const panel = screen.getByTestId('territory-info-city-luoyang');
    expect(panel.textContent).toContain('28.5'); // 15 + 7.5 + 4.5 + 1.5
  });

  // ── 己方领土 ──
  it('己方领土显示升级按钮', () => {
    const onUpgrade = vi.fn();
    render(<TerritoryInfoPanel territory={makeTerritory()} onUpgrade={onUpgrade} />);
    const btn = screen.getByTestId('btn-upgrade-city-luoyang');
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onUpgrade).toHaveBeenCalledWith('city-luoyang');
  });

  it('己方领土不显示攻城按钮', () => {
    render(<TerritoryInfoPanel territory={makeTerritory()} />);
    expect(screen.queryByTestId('btn-siege-city-luoyang')).toBeNull();
  });

  // ── 敌方领土 ──
  it('敌方领土显示攻城按钮', () => {
    const onSiege = vi.fn();
    render(
      <TerritoryInfoPanel
        territory={makeTerritory({ ownership: 'enemy' })}
        onSiege={onSiege}
      />,
    );
    const btn = screen.getByTestId('btn-siege-city-luoyang');
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onSiege).toHaveBeenCalledWith('city-luoyang');
  });

  it('敌方领土不显示升级按钮', () => {
    render(<TerritoryInfoPanel territory={makeTerritory({ ownership: 'enemy' })} />);
    expect(screen.queryByTestId('btn-upgrade-city-luoyang')).toBeNull();
  });

  // ── 归属标签 ──
  it('己方领土显示己方标签', () => {
    render(<TerritoryInfoPanel territory={makeTerritory()} />);
    expect(screen.getByText('己方领土')).toBeTruthy();
  });

  it('敌方领土显示敌方标签', () => {
    render(<TerritoryInfoPanel territory={makeTerritory({ ownership: 'enemy' })} />);
    expect(screen.getByText('敌方领土')).toBeTruthy();
  });

  it('中立领土显示中立标签', () => {
    render(<TerritoryInfoPanel territory={makeTerritory({ ownership: 'neutral' })} />);
    // 标签包含"中立领土 · 未占领"
    expect(screen.getByText(/中立领土/)).toBeTruthy();
  });

  it('中立领土显示未占领提示', () => {
    render(<TerritoryInfoPanel territory={makeTerritory({ ownership: 'neutral' })} />);
    expect(screen.getByText(/占领后可获得产出/)).toBeTruthy();
  });

  it('中立领土不显示产出数值', () => {
    const { container } = render(
      <TerritoryInfoPanel territory={makeTerritory({ ownership: 'neutral' })} />,
    );
    // 中立领土不应显示产出网格和总产出
    expect(container.querySelector('.tk-territory-info-prod-grid')).toBeNull();
    expect(container.querySelector('.tk-territory-info-total')).toBeNull();
  });

  // ── 中立领土操作 ──
  it('中立领土显示占领按钮', () => {
    const onSiege = vi.fn();
    render(
      <TerritoryInfoPanel
        territory={makeTerritory({ ownership: 'neutral' })}
        onSiege={onSiege}
      />,
    );
    const btn = screen.getByTestId('btn-siege-city-luoyang');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('占领');
    fireEvent.click(btn);
    expect(onSiege).toHaveBeenCalledWith('city-luoyang');
  });

  it('中立领土不显示升级按钮', () => {
    render(<TerritoryInfoPanel territory={makeTerritory({ ownership: 'neutral' })} />);
    expect(screen.queryByTestId('btn-upgrade-city-luoyang')).toBeNull();
  });

  // ── 移动端响应式 ──
  describe('移动端响应式', () => {
    it('面板在移动端正常渲染', () => {
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      window.dispatchEvent(new Event('resize'));

      render(<TerritoryInfoPanel territory={makeTerritory()} />);
      expect(screen.getByTestId('territory-info-city-luoyang')).toBeTruthy();
      expect(screen.getByText('洛阳')).toBeTruthy();

      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
    });

    it('中立领土在移动端显示占领提示', () => {
      render(<TerritoryInfoPanel territory={makeTerritory({ ownership: 'neutral' })} />);
      expect(screen.getByText(/占领后可获得产出/)).toBeTruthy();
    });

    it('操作按钮在移动端可点击', () => {
      const onUpgrade = vi.fn();
      render(<TerritoryInfoPanel territory={makeTerritory()} onUpgrade={onUpgrade} />);
      const btn = screen.getByTestId('btn-upgrade-city-luoyang');
      expect(btn).toBeTruthy();
      fireEvent.click(btn);
      expect(onUpgrade).toHaveBeenCalledWith('city-luoyang');
    });
  });
});
