/**
 * ResourceCost 原子组件单元测试
 *
 * 覆盖场景：
 * - 渲染多种资源类型
 * - 资源充足时正常显示
 * - 资源不足时标红
 * - horizontal和vertical布局
 * - 空items数组
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ResourceCost from '../ResourceCost';
import type { ResourceCostItem } from '../ResourceCost';

// Mock CSS import
vi.mock('../ResourceCost.css', () => ({}));

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeItem(overrides: Partial<ResourceCostItem> = {}): ResourceCostItem {
  return {
    type: 'copper',
    name: '铜钱',
    required: 100,
    current: 200,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('ResourceCost', () => {
  afterEach(() => {
    cleanup();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染多种资源类型
  // ═══════════════════════════════════════════

  it('应渲染铜钱资源', () => {
    const items = [makeItem({ type: 'copper', name: '铜钱', required: 100, current: 200 })];
    render(<ResourceCost items={items} />);
    expect(screen.getByTestId('resource-cost-copper')).toBeInTheDocument();
    expect(screen.getByText('铜钱')).toBeInTheDocument();
  });

  it('应渲染招贤令资源', () => {
    const items = [makeItem({ type: 'recruitToken', name: '招贤令', required: 10, current: 50 })];
    render(<ResourceCost items={items} />);
    expect(screen.getByTestId('resource-cost-recruitToken')).toBeInTheDocument();
    expect(screen.getByText('招贤令')).toBeInTheDocument();
  });

  it('应渲染突破石资源', () => {
    const items = [makeItem({ type: 'breakthroughStone', name: '突破石', required: 5, current: 3 })];
    render(<ResourceCost items={items} />);
    expect(screen.getByTestId('resource-cost-breakthroughStone')).toBeInTheDocument();
    expect(screen.getByText('突破石')).toBeInTheDocument();
  });

  it('应渲染碎片资源', () => {
    const items = [makeItem({ type: 'fragment', name: '碎片', required: 20, current: 15 })];
    render(<ResourceCost items={items} />);
    expect(screen.getByTestId('resource-cost-fragment')).toBeInTheDocument();
    expect(screen.getByText('碎片')).toBeInTheDocument();
  });

  it('应渲染经验资源', () => {
    const items = [makeItem({ type: 'exp', name: '经验', required: 500, current: 1000 })];
    render(<ResourceCost items={items} />);
    expect(screen.getByTestId('resource-cost-exp')).toBeInTheDocument();
    expect(screen.getByText('经验')).toBeInTheDocument();
  });

  it('应同时渲染多种资源', () => {
    const items = [
      makeItem({ type: 'copper', name: '铜钱', required: 100, current: 200 }),
      makeItem({ type: 'exp', name: '经验', required: 500, current: 300 }),
    ];
    render(<ResourceCost items={items} />);
    expect(screen.getByTestId('resource-cost-copper')).toBeInTheDocument();
    expect(screen.getByTestId('resource-cost-exp')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 资源充足时正常显示
  // ═══════════════════════════════════════════

  it('资源充足时不应有insufficient类', () => {
    const items = [makeItem({ type: 'copper', name: '铜钱', required: 100, current: 200 })];
    render(<ResourceCost items={items} />);
    const item = screen.getByTestId('resource-cost-copper');
    expect(item.className).not.toContain('tk-resource-cost__item--insufficient');
  });

  it('资源恰好相等时不应标红', () => {
    const items = [makeItem({ type: 'copper', name: '铜钱', required: 100, current: 100 })];
    render(<ResourceCost items={items} />);
    const item = screen.getByTestId('resource-cost-copper');
    expect(item.className).not.toContain('tk-resource-cost__item--insufficient');
  });

  it('应显示正确的数量格式', () => {
    const items = [makeItem({ type: 'copper', name: '铜钱', required: 100, current: 200 })];
    render(<ResourceCost items={items} />);
    // formatResourceAmount(200) => "200"
    expect(screen.getByText('200')).toBeInTheDocument();
    // formatResourceAmount(100) => "100"
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('应显示分隔符/', () => {
    const items = [makeItem({ type: 'copper', name: '铜钱', required: 100, current: 200 })];
    render(<ResourceCost items={items} />);
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 资源不足时标红
  // ═══════════════════════════════════════════

  it('资源不足时item应有insufficient类', () => {
    const items = [makeItem({ type: 'copper', name: '铜钱', required: 200, current: 50 })];
    render(<ResourceCost items={items} />);
    const item = screen.getByTestId('resource-cost-copper');
    expect(item.className).toContain('tk-resource-cost__item--insufficient');
  });

  it('资源不足时current数量应有lack类', () => {
    const items = [makeItem({ type: 'copper', name: '铜钱', required: 200, current: 50 })];
    render(<ResourceCost items={items} />);
    const currentSpan = screen.getByText('50');
    expect(currentSpan.className).toContain('tk-resource-cost__current--lack');
  });

  it('资源充足时current数量不应有lack类', () => {
    const items = [makeItem({ type: 'copper', name: '铜钱', required: 100, current: 200 })];
    render(<ResourceCost items={items} />);
    const currentSpan = screen.getByText('200');
    expect(currentSpan.className).not.toContain('tk-resource-cost__current--lack');
  });

  it('混合资源时仅不足的标红', () => {
    const items = [
      makeItem({ type: 'copper', name: '铜钱', required: 100, current: 200 }),
      makeItem({ type: 'exp', name: '经验', required: 500, current: 100 }),
    ];
    render(<ResourceCost items={items} />);
    const copperItem = screen.getByTestId('resource-cost-copper');
    const expItem = screen.getByTestId('resource-cost-exp');
    expect(copperItem.className).not.toContain('tk-resource-cost__item--insufficient');
    expect(expItem.className).toContain('tk-resource-cost__item--insufficient');
  });

  // ═══════════════════════════════════════════
  // 4. 布局方向
  // ═══════════════════════════════════════════

  it('默认布局为vertical', () => {
    const items = [makeItem()];
    render(<ResourceCost items={items} />);
    const container = screen.getByTestId('resource-cost');
    expect(container.className).toContain('tk-resource-cost--vertical');
  });

  it('应支持horizontal布局', () => {
    const items = [makeItem()];
    render(<ResourceCost items={items} layout="horizontal" />);
    const container = screen.getByTestId('resource-cost');
    expect(container.className).toContain('tk-resource-cost--horizontal');
  });

  it('应支持vertical布局显式指定', () => {
    const items = [makeItem()];
    render(<ResourceCost items={items} layout="vertical" />);
    const container = screen.getByTestId('resource-cost');
    expect(container.className).toContain('tk-resource-cost--vertical');
  });

  // ═══════════════════════════════════════════
  // 5. 空items数组
  // ═══════════════════════════════════════════

  it('空items数组应正常渲染容器', () => {
    render(<ResourceCost items={[]} />);
    const container = screen.getByTestId('resource-cost');
    expect(container).toBeInTheDocument();
    expect(container.children).toHaveLength(0);
  });

  // ═══════════════════════════════════════════
  // 6. 数量格式化
  // ═══════════════════════════════════════════

  it('千位以上数量应正常显示', () => {
    const items = [makeItem({ type: 'copper', name: '铜钱', required: 1500, current: 2000 })];
    render(<ResourceCost items={items} />);
    // formatResourceAmount(2000) => "2000"
    expect(screen.getByText('2000')).toBeInTheDocument();
    expect(screen.getByText('1500')).toBeInTheDocument();
  });

  it('万位以上数量应显示万格式', () => {
    const items = [makeItem({ type: 'copper', name: '铜钱', required: 15000, current: 20000 })];
    render(<ResourceCost items={items} />);
    // formatResourceAmount(20000) => "2.0万"
    expect(screen.getByText('2.0万')).toBeInTheDocument();
    expect(screen.getByText('1.5万')).toBeInTheDocument();
  });

  it('亿级以上数量应显示亿格式', () => {
    const items = [makeItem({ type: 'copper', name: '铜钱', required: 150000000, current: 200000000 })];
    render(<ResourceCost items={items} />);
    // formatResourceAmount(200000000) => "2.0亿"
    expect(screen.getByText('2.0亿')).toBeInTheDocument();
    expect(screen.getByText('1.5亿')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 7. 图标显示
  // ═══════════════════════════════════════════

  it('应显示资源图标', () => {
    const items = [makeItem({ type: 'copper', name: '铜钱', required: 100, current: 200 })];
    render(<ResourceCost items={items} />);
    const icon = screen.getByTestId('resource-cost-copper').querySelector('.tk-resource-cost__icon');
    expect(icon).toBeInTheDocument();
    expect(icon?.textContent).toBe('🪙');
  });

  // ═══════════════════════════════════════════
  // 8. 自定义className
  // ═══════════════════════════════════════════

  it('应应用自定义className', () => {
    const items = [makeItem()];
    render(<ResourceCost items={items} className="my-resource-cost" />);
    const container = screen.getByTestId('resource-cost');
    expect(container.className).toContain('my-resource-cost');
    expect(container.className).toContain('tk-resource-cost');
  });
});
