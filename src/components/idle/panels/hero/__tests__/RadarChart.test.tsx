/**
 * RadarChart SVG 雷达图组件测试
 *
 * 覆盖场景（18个用例）：
 * - SVG 元素渲染
 * - 属性标签渲染
 * - 5种品质色正确渲染
 * - statMax 动态计算
 * - 边界值（全0 / 全满 / 单属性突出）
 * - 数据区域 polygon points 非空
 * - 顶点圆点数量
 * - 网格层数
 * - 标签数值显示
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RadarChart from '../RadarChart';
import { Quality } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('../HeroDetailModal.css', () => ({}));

// ─────────────────────────────────────────────
// 品质对应的填充色（从 RadarChart.tsx 镜像，使用统一品质颜色）
// ─────────────────────────────────────────────
const QUALITY_FILL: Record<Quality, string> = {
  COMMON: 'rgba(158, 158, 158, 0.35)',
  FINE: 'rgba(33, 150, 243, 0.35)',
  RARE: 'rgba(156, 39, 176, 0.35)',
  EPIC: 'rgba(244, 67, 54, 0.35)',
  LEGENDARY: 'rgba(255, 152, 0, 0.35)',
};
const QUALITY_STROKE: Record<Quality, string> = {
  COMMON: 'rgba(158, 158, 158, 0.8)',
  FINE: 'rgba(33, 150, 243, 0.8)',
  RARE: 'rgba(156, 39, 176, 0.8)',
  EPIC: 'rgba(244, 67, 54, 0.8)',
  LEGENDARY: 'rgba(255, 152, 0, 0.8)',
};

// ─────────────────────────────────────────────
// Helper: 构造标准4属性 stats
// ─────────────────────────────────────────────
function makeStats(
  attack = 80,
  defense = 60,
  intelligence = 50,
  speed = 70,
) {
  return [
    { key: 'attack', label: '武力', value: attack, color: '#E53935' },
    { key: 'defense', label: '统率', value: defense, color: '#1E88E5' },
    { key: 'intelligence', label: '智力', value: intelligence, color: '#AB47BC' },
    { key: 'speed', label: '政治', value: speed, color: '#43A047' },
  ];
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('RadarChart', () => {
  // ═══════════════════════════════════════════
  // 1. SVG 元素渲染
  // ═══════════════════════════════════════════

  it('应渲染 SVG 元素', () => {
    const { container } = render(
      <RadarChart stats={makeStats()} quality={Quality.LEGENDARY} statMax={100} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('class')).toBe('tk-hero-radar');
  });

  it('SVG 应有正确的 viewBox 和尺寸属性', () => {
    const { container } = render(
      <RadarChart stats={makeStats()} quality={Quality.COMMON} statMax={100} />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('200');
    expect(svg?.getAttribute('height')).toBe('200');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 200 200');
  });

  it('SVG 应有 aria-label 属性', () => {
    const { container } = render(
      <RadarChart stats={makeStats()} quality={Quality.COMMON} statMax={100} />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-label')).toBe('属性雷达图');
  });

  // ═══════════════════════════════════════════
  // 2. 属性标签渲染
  // ═══════════════════════════════════════════

  it('应渲染4个属性标签（武力/统率/智力/政治）', () => {
    render(<RadarChart stats={makeStats()} quality={Quality.COMMON} statMax={100} />);
    expect(screen.getByText('武力')).toBeInTheDocument();
    expect(screen.getByText('统率')).toBeInTheDocument();
    expect(screen.getByText('智力')).toBeInTheDocument();
    expect(screen.getByText('政治')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 标签数值显示正确
  // ═══════════════════════════════════════════

  it('应显示各属性数值', () => {
    render(<RadarChart stats={makeStats(95, 72, 48, 60)} quality={Quality.COMMON} statMax={100} />);
    expect(screen.getByText('95')).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 品质色渲染（5种品质各1个测试）
  // ═══════════════════════════════════════════

  it('COMMON 品质应使用正确的填充色和描边色', () => {
    const { container } = render(
      <RadarChart stats={makeStats()} quality={Quality.COMMON} statMax={100} />,
    );
    const dataPolygon = container.querySelector('.tk-hero-radar-data');
    expect(dataPolygon?.getAttribute('fill')).toBe(QUALITY_FILL.COMMON);
    expect(dataPolygon?.getAttribute('stroke')).toBe(QUALITY_STROKE.COMMON);
  });

  it('FINE 品质应使用正确的填充色和描边色', () => {
    const { container } = render(
      <RadarChart stats={makeStats()} quality={Quality.FINE} statMax={100} />,
    );
    const dataPolygon = container.querySelector('.tk-hero-radar-data');
    expect(dataPolygon?.getAttribute('fill')).toBe(QUALITY_FILL.FINE);
    expect(dataPolygon?.getAttribute('stroke')).toBe(QUALITY_STROKE.FINE);
  });

  it('RARE 品质应使用正确的填充色和描边色', () => {
    const { container } = render(
      <RadarChart stats={makeStats()} quality={Quality.RARE} statMax={100} />,
    );
    const dataPolygon = container.querySelector('.tk-hero-radar-data');
    expect(dataPolygon?.getAttribute('fill')).toBe(QUALITY_FILL.RARE);
    expect(dataPolygon?.getAttribute('stroke')).toBe(QUALITY_STROKE.RARE);
  });

  it('EPIC 品质应使用正确的填充色和描边色', () => {
    const { container } = render(
      <RadarChart stats={makeStats()} quality={Quality.EPIC} statMax={100} />,
    );
    const dataPolygon = container.querySelector('.tk-hero-radar-data');
    expect(dataPolygon?.getAttribute('fill')).toBe(QUALITY_FILL.EPIC);
    expect(dataPolygon?.getAttribute('stroke')).toBe(QUALITY_STROKE.EPIC);
  });

  it('LEGENDARY 品质应使用正确的填充色和描边色', () => {
    const { container } = render(
      <RadarChart stats={makeStats()} quality={Quality.LEGENDARY} statMax={100} />,
    );
    const dataPolygon = container.querySelector('.tk-hero-radar-data');
    expect(dataPolygon?.getAttribute('fill')).toBe(QUALITY_FILL.LEGENDARY);
    expect(dataPolygon?.getAttribute('stroke')).toBe(QUALITY_STROKE.LEGENDARY);
  });

  // ═══════════════════════════════════════════
  // 5. 数据区域 polygon
  // ═══════════════════════════════════════════

  it('数据区域 polygon 的 points 属性非空', () => {
    const { container } = render(
      <RadarChart stats={makeStats()} quality={Quality.COMMON} statMax={100} />,
    );
    const dataPolygon = container.querySelector('.tk-hero-radar-data');
    expect(dataPolygon).toBeInTheDocument();
    const points = dataPolygon?.getAttribute('points');
    expect(points).toBeTruthy();
    expect(points!.trim().length).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════
  // 6. 顶点圆点数量
  // ═══════════════════════════════════════════

  it('应渲染4个数据顶点圆点', () => {
    const { container } = render(
      <RadarChart stats={makeStats()} quality={Quality.COMMON} statMax={100} />,
    );
    // 数据顶点圆点在 svg 内，排除网格后取 circle 元素
    const svg = container.querySelector('svg');
    const circles = svg?.querySelectorAll('circle');
    expect(circles?.length).toBe(4);
  });

  // ═══════════════════════════════════════════
  // 7. 网格层数（4层同心多边形）
  // ═══════════════════════════════════════════

  it('应渲染4层同心网格多边形', () => {
    const { container } = render(
      <RadarChart stats={makeStats()} quality={Quality.COMMON} statMax={100} />,
    );
    const svg = container.querySelector('svg');
    // 网格 polygon 没有 className，数据区域有 .tk-hero-radar-data
    // 所以总 polygon 数 = 4(网格) + 1(数据) = 5
    const allPolygons = svg?.querySelectorAll('polygon');
    expect(allPolygons?.length).toBe(5);

    // 数据区域 polygon
    const dataPolygon = container.querySelector('.tk-hero-radar-data');
    expect(dataPolygon).toBeInTheDocument();

    // 网格 polygon = 总数 - 数据区域
    const gridPolygons = Array.from(allPolygons || []).filter(
      (p) => !p.classList.contains('tk-hero-radar-data'),
    );
    expect(gridPolygons.length).toBe(4);
  });

  // ═══════════════════════════════════════════
  // 8. 边界值：全0属性
  // ═══════════════════════════════════════════

  it('全0属性时数据区域所有顶点应收缩到中心', () => {
    const { container } = render(
      <RadarChart stats={makeStats(0, 0, 0, 0)} quality={Quality.COMMON} statMax={100} />,
    );
    const dataPolygon = container.querySelector('.tk-hero-radar-data');
    const points = dataPolygon?.getAttribute('points');
    // 所有顶点应在中心 (100,100)
    const pairs = points!.trim().split(' ');
    pairs.forEach((pair) => {
      const [x, y] = pair.split(',').map(Number);
      expect(x).toBeCloseTo(100, 0);
      expect(y).toBeCloseTo(100, 0);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 边界值：全满属性
  // ═══════════════════════════════════════════

  it('全满属性时数据区域应扩展到网格边界', () => {
    const { container } = render(
      <RadarChart stats={makeStats(100, 100, 100, 100)} quality={Quality.COMMON} statMax={100} />,
    );
    const dataPolygon = container.querySelector('.tk-hero-radar-data');
    const points = dataPolygon?.getAttribute('points');
    // 每个顶点到中心的距离应接近 RADAR_R=80
    const pairs = points!.trim().split(' ');
    pairs.forEach((pair) => {
      const [x, y] = pair.split(',').map(Number);
      const dist = Math.sqrt((x - 100) ** 2 + (y - 100) ** 2);
      expect(dist).toBeCloseTo(80, 0);
    });
  });

  // ═══════════════════════════════════════════
  // 10. 边界值：单属性突出
  // ═══════════════════════════════════════════

  it('单属性突出时只有该属性顶点远离中心', () => {
    const { container } = render(
      <RadarChart stats={makeStats(100, 10, 10, 10)} quality={Quality.COMMON} statMax={100} />,
    );
    const dataPolygon = container.querySelector('.tk-hero-radar-data');
    const points = dataPolygon?.getAttribute('points')!.trim().split(' ');
    // 第一个顶点（attack=100）应远离中心
    const [x0, y0] = points![0].split(',').map(Number);
    const dist0 = Math.sqrt((x0 - 100) ** 2 + (y0 - 100) ** 2);
    expect(dist0).toBeCloseTo(80, 0);

    // 其余顶点应接近中心
    for (let i = 1; i < points!.length; i++) {
      const [x, y] = points![i].split(',').map(Number);
      const dist = Math.sqrt((x - 100) ** 2 + (y - 100) ** 2);
      expect(dist).toBeLessThan(20);
    }
  });

  // ═══════════════════════════════════════════
  // 11. statMax 动态计算（属性值大时雷达图扩展）
  // ═══════════════════════════════════════════

  it('statMax 较大时属性值映射到较小的比例', () => {
    const { container } = render(
      <RadarChart stats={makeStats(50, 50, 50, 50)} quality={Quality.COMMON} statMax={200} />,
    );
    const dataPolygon = container.querySelector('.tk-hero-radar-data');
    const points = dataPolygon?.getAttribute('points')!.trim().split(' ');
    // statMax=200, value=50 → ratio=0.25 → r=80*0.25=20
    points!.forEach((pair) => {
      const [x, y] = pair.split(',').map(Number);
      const dist = Math.sqrt((x - 100) ** 2 + (y - 100) ** 2);
      expect(dist).toBeCloseTo(20, 0);
    });
  });

  // ═══════════════════════════════════════════
  // 12. 轴线数量
  // ═══════════════════════════════════════════

  it('应渲染4条轴线（从中心到各顶点）', () => {
    const { container } = render(
      <RadarChart stats={makeStats()} quality={Quality.COMMON} statMax={100} />,
    );
    const svg = container.querySelector('svg');
    const lines = svg?.querySelectorAll('line');
    expect(lines?.length).toBe(4);
  });
});
