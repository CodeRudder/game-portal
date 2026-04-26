/**
 * AttributeBar 原子组件单元测试
 *
 * 覆盖场景：
 * - 渲染属性名和数值
 * - 进度条百分比计算正确
 * - 变化值显示（正数绿色+号、负数红色-号）
 * - 内置颜色映射（攻击红/防御蓝/生命绿/速度黄）
 * - 自定义颜色覆盖
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AttributeBar from '../AttributeBar';

// Mock CSS import
vi.mock('../AttributeBar.css', () => ({}));

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('AttributeBar', () => {
  afterEach(() => {
    cleanup();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染属性名和数值
  // ═══════════════════════════════════════════

  it('应渲染属性名', () => {
    render(<AttributeBar name="攻击" value={100} />);
    expect(screen.getByText('攻击')).toBeInTheDocument();
  });

  it('应渲染属性数值', () => {
    render(<AttributeBar name="攻击" value={100} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('应渲染大数值（万位以上）', () => {
    render(<AttributeBar name="生命" value={15000} />);
    // formatAttributeValue(15000) => "1.5万"
    expect(screen.getByText('1.5万')).toBeInTheDocument();
  });

  it('应正确渲染data-testid', () => {
    render(<AttributeBar name="攻击" value={100} />);
    expect(screen.getByTestId('attr-bar-攻击')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 进度条百分比计算
  // ═══════════════════════════════════════════

  it('无maxValue时进度条宽度为100%', () => {
    render(<AttributeBar name="攻击" value={100} />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.width).toBe('100%');
  });

  it('应正确计算50%进度条', () => {
    render(<AttributeBar name="攻击" value={50} maxValue={100} />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.width).toBe('50%');
  });

  it('应正确计算0%进度条', () => {
    render(<AttributeBar name="攻击" value={0} maxValue={100} />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.width).toBe('0%');
  });

  it('进度条百分比上限为100%', () => {
    render(<AttributeBar name="攻击" value={200} maxValue={100} />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.width).toBe('100%');
  });

  it('maxValue为0时进度条为0%', () => {
    render(<AttributeBar name="攻击" value={50} maxValue={0} />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.width).toBe('0%');
  });

  it('进度条应有正确的aria属性', () => {
    render(<AttributeBar name="攻击" value={50} maxValue={100} />);
    const fill = screen.getByRole('progressbar');
    expect(fill.getAttribute('aria-valuenow')).toBe('50');
    expect(fill.getAttribute('aria-valuemin')).toBe('0');
    expect(fill.getAttribute('aria-valuemax')).toBe('100');
    expect(fill.getAttribute('aria-label')).toBe('攻击进度');
  });

  // ═══════════════════════════════════════════
  // 3. 变化值显示
  // ═══════════════════════════════════════════

  it('正数变化值应显示绿色+号', () => {
    render(<AttributeBar name="攻击" value={100} change={15} />);
    const changeEl = screen.getByText('+15');
    expect(changeEl).toBeInTheDocument();
    expect(changeEl.className).toContain('tk-attr-bar__change--positive');
  });

  it('负数变化值应显示红色-号', () => {
    render(<AttributeBar name="攻击" value={100} change={-10} />);
    const changeEl = screen.getByText('-10');
    expect(changeEl).toBeInTheDocument();
    expect(changeEl.className).toContain('tk-attr-bar__change--negative');
  });

  it('变化值为0时不显示变化值', () => {
    render(<AttributeBar name="攻击" value={100} change={0} />);
    expect(screen.queryByText('+0')).not.toBeInTheDocument();
    expect(screen.queryByText('-0')).not.toBeInTheDocument();
  });

  it('无change prop时不显示变化值', () => {
    render(<AttributeBar name="攻击" value={100} />);
    const container = screen.getByTestId('attr-bar-攻击');
    expect(container.querySelector('.tk-attr-bar__change')).toBeNull();
  });

  it('大数值变化值应格式化', () => {
    render(<AttributeBar name="攻击" value={15000} change={20000} />);
    // formatChange(20000) => "+2.0万"
    expect(screen.getByText('+2.0万')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 内置颜色映射
  // ═══════════════════════════════════════════

  it('攻击属性应使用红色', () => {
    render(<AttributeBar name="攻击" value={100} />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.backgroundColor).toBe('rgb(239, 68, 68)'); // #EF4444
  });

  it('攻击力属性应使用红色', () => {
    render(<AttributeBar name="攻击力" value={100} />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.backgroundColor).toBe('rgb(239, 68, 68)');
  });

  it('ATK属性应使用红色', () => {
    render(<AttributeBar name="ATK" value={100} />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.backgroundColor).toBe('rgb(239, 68, 68)');
  });

  it('防御属性应使用蓝色', () => {
    render(<AttributeBar name="防御" value={100} />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.backgroundColor).toBe('rgb(59, 130, 246)'); // #3B82F6
  });

  it('DEF属性应使用蓝色', () => {
    render(<AttributeBar name="DEF" value={100} />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.backgroundColor).toBe('rgb(59, 130, 246)');
  });

  it('生命属性应使用绿色', () => {
    render(<AttributeBar name="生命" value={100} />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.backgroundColor).toBe('rgb(34, 197, 94)'); // #22C55E
  });

  it('HP属性应使用绿色', () => {
    render(<AttributeBar name="HP" value={100} />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.backgroundColor).toBe('rgb(34, 197, 94)');
  });

  it('速度属性应使用黄色', () => {
    render(<AttributeBar name="速度" value={100} />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.backgroundColor).toBe('rgb(234, 179, 8)'); // #EAB308
  });

  it('SPD属性应使用黄色', () => {
    render(<AttributeBar name="SPD" value={100} />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.backgroundColor).toBe('rgb(234, 179, 8)');
  });

  it('未知属性名应使用默认金色', () => {
    render(<AttributeBar name="暴击" value={100} />);
    const fill = screen.getByRole('progressbar');
    // 默认色: var(--tk-gold, #C9A84C)，jsdom中CSS变量不解析，使用fallback
    expect(fill.style.backgroundColor).toBeTruthy();
  });

  // ═══════════════════════════════════════════
  // 5. 自定义颜色覆盖
  // ═══════════════════════════════════════════

  it('color prop应覆盖内置颜色映射', () => {
    render(<AttributeBar name="攻击" value={100} color="#FF00FF" />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.backgroundColor).toBe('rgb(255, 0, 255)'); // #FF00FF
  });

  it('color prop应覆盖未知属性名的默认色', () => {
    render(<AttributeBar name="自定义属性" value={100} color="#00FF00" />);
    const fill = screen.getByRole('progressbar');
    expect(fill.style.backgroundColor).toBe('rgb(0, 255, 0)');
  });

  // ═══════════════════════════════════════════
  // 6. 自定义className
  // ═══════════════════════════════════════════

  it('应应用自定义className', () => {
    render(<AttributeBar name="攻击" value={100} className="my-attr-bar" />);
    const container = screen.getByTestId('attr-bar-攻击');
    expect(container.className).toContain('my-attr-bar');
    expect(container.className).toContain('tk-attr-bar');
  });
});
