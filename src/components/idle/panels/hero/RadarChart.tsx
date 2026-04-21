/**
 * RadarChart — SVG 雷达图组件
 * 用于 HeroDetailModal 中的属性可视化展示
 */

import React from 'react';
import type { Quality } from '@/games/three-kingdoms/engine';
import { HERO_QUALITY_BG_COLORS } from '../../common/constants';

// ─────────────────────────────────────────────
// 品质对应的雷达图填充/描边色（使用统一常量）
// ─────────────────────────────────────────────
const QUALITY_RADAR_FILL: Record<Quality, string> = {
  COMMON: 'rgba(158, 158, 158, 0.35)', FINE: 'rgba(33, 150, 243, 0.35)',
  RARE: 'rgba(156, 39, 176, 0.35)', EPIC: 'rgba(244, 67, 54, 0.35)',
  LEGENDARY: 'rgba(255, 152, 0, 0.35)',
};
const QUALITY_RADAR_STROKE: Record<Quality, string> = {
  COMMON: 'rgba(158, 158, 158, 0.8)', FINE: 'rgba(33, 150, 243, 0.8)',
  RARE: 'rgba(156, 39, 176, 0.8)', EPIC: 'rgba(244, 67, 54, 0.8)',
  LEGENDARY: 'rgba(255, 152, 0, 0.8)',
};

// ─────────────────────────────────────────────
// 雷达图常量
// ─────────────────────────────────────────────
const RADAR_SIZE = 200;
const RADAR_CX = 100;
const RADAR_CY = 100;
const RADAR_R = 80;

/** 计算雷达图各顶点坐标 */
function getRadarPoints(stats: { key: string; value: number }[], statMax: number): string {
  const count = stats.length;
  return stats
    .map((stat, i) => {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const ratio = Math.min(1, stat.value / statMax);
      const r = RADAR_R * ratio;
      const x = RADAR_CX + r * Math.cos(angle);
      const y = RADAR_CY + r * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(' ');
}

/** 计算网格顶点（用于绘制同心多边形） */
function getGridPoints(level: number, count: number): string {
  return Array.from({ length: count })
    .map((_, i) => {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const r = RADAR_R * level;
      const x = RADAR_CX + r * Math.cos(angle);
      const y = RADAR_CY + r * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(' ');
}

/** 计算标签位置 */
function getLabelPos(index: number, count: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const labelR = RADAR_R + 20;
  return {
    x: RADAR_CX + labelR * Math.cos(angle),
    y: RADAR_CY + labelR * Math.sin(angle),
  };
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
export interface RadarChartProps {
  stats: { key: string; label: string; value: number; color: string }[];
  quality: Quality;
  /** 动态属性上限 */
  statMax: number;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────
const RadarChart: React.FC<RadarChartProps> = ({ stats, quality, statMax }) => {
  const dataPoints = getRadarPoints(stats, statMax);
  const fillColor = QUALITY_RADAR_FILL[quality];
  const strokeColor = QUALITY_RADAR_STROKE[quality];
  const count = stats.length;

  return (
    <svg
      className="tk-hero-radar"
      width={RADAR_SIZE}
      height={RADAR_SIZE}
      viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
      role="img"
      aria-label="属性雷达图"
    >
      {/* 同心网格 */}
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <polygon
          key={level}
          points={getGridPoints(level, count)}
          fill="none"
          stroke="rgba(240, 230, 211, 0.12)"
          strokeWidth={1}
        />
      ))}

      {/* 轴线 */}
      {stats.map((_, i) => {
        const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
        return (
          <line key={i} x1={RADAR_CX} y1={RADAR_CY}
            x2={RADAR_CX + RADAR_R * Math.cos(angle)}
            y2={RADAR_CY + RADAR_R * Math.sin(angle)}
            stroke="rgba(240, 230, 211, 0.08)" strokeWidth={1} />
        );
      })}

      {/* 数据区域 */}
      <polygon
        className="tk-hero-radar-data"
        points={dataPoints}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
      />

      {/* 数据顶点圆点 */}
      {stats.map((stat, i) => {
        const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
        const r = RADAR_R * Math.min(1, stat.value / statMax);
        return (
          <circle key={stat.key}
            cx={RADAR_CX + r * Math.cos(angle)}
            cy={RADAR_CY + r * Math.sin(angle)}
            r={3} fill={stat.color} stroke="#fff" strokeWidth={1} />
        );
      })}

      {/* 标签 + 数值 */}
      {stats.map((stat, i) => {
        const pos = getLabelPos(i, count);
        return (
          <g key={`label-${stat.key}`}>
            <text x={pos.x} y={pos.y - 6} textAnchor="middle"
              fill="rgba(240, 230, 211, 0.7)" fontSize={11} fontWeight={500}>
              {stat.label}
            </text>
            <text x={pos.x} y={pos.y + 8} textAnchor="middle"
              fill={stat.color} fontSize={12} fontWeight={700} fontFamily="inherit">
              {stat.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

RadarChart.displayName = 'RadarChart';

export default RadarChart;
