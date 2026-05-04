/**
 * PixelWorldMap — 像素风格世界地图组件
 *
 * 在Canvas上渲染ASCII地图数据，叠加游戏领土信息:
 * - 地形渲染(像素风格)
 * - 城市标记(阵营色+名称)
 * - 点击选中城市
 * - 鸟瞰小地图
 * - 自动适配缩放并居中
 *
 * @module components/idle/panels/map/PixelWorldMap
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ASCIIMapParser } from '@/games/three-kingdoms/core/map/ASCIIMapParser';
import { PixelMapRenderer, type CityRenderData } from '@/games/three-kingdoms/engine/map/PixelMapRenderer';
import { ConquestAnimationSystem } from '@/games/three-kingdoms/engine/map/ConquestAnimation';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';
import type { MarchRoute, MarchUnit } from '@/games/three-kingdoms/engine/map/MarchingSystem';
import type { SiegeAnimationState } from '@/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem';
import { LANDMARK_POSITIONS, DEFAULT_LANDMARKS } from '@/games/three-kingdoms/core/map/map-config';
import worldMapText from '@/games/three-kingdoms/core/map/maps/world-map.txt?raw';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface PixelWorldMapProps {
  /** 领土数据(用于城市标记) */
  territories: TerritoryData[];
  /** 选中领土回调 */
  onSelectTerritory?: (id: string) => void;
  /** 选中的领土ID */
  selectedId?: string | null;
  /** 攻城动画系统(用于在地图上渲染攻城动画) */
  conquestAnimationSystem?: ConquestAnimationSystem;
  /** 行军路线(用于在地图上叠加绘制行军路线) */
  marchRoute?: MarchRoute | null;
  /** 活跃行军单位列表(用于在地图上渲染行军精灵) */
  activeMarches?: MarchUnit[];
  /** 活跃攻城战斗动画列表 (I12, 用于未来的攻城动画渲染) */
  activeSiegeAnims?: SiegeAnimationState[];
  /** R9 Task5: 高亮的攻占任务ID(用于渲染高亮行军路线) */
  highlightedTaskId?: string | null;
}

// ─────────────────────────────────────────────
// 阵营颜色
// ─────────────────────────────────────────────

const FACTION_COLORS: Record<string, string> = {
  player: '#7EC850',
  enemy: '#e74c3c',
  neutral: 'rgba(255,255,255,0.15)',
  wei: '#2E5090',
  shu: '#8B2500',
  wu: '#2E6B3E',
};

// ─────────────────────────────────────────────
// 城市ID映射(地图字母→领土ID)
// ─────────────────────────────────────────────

/** CITY映射中的字母→领土ID */
const CITY_CHAR_TO_ID: Record<string, string> = {
  Y: 'city-ye',
  X: 'city-xuchang',
  P: 'city-puyang',
  E: 'city-beihai',
  L: 'city-luoyang',
  C: 'city-changan',
  G: 'city-chengdu',
  H: 'city-hanzhong',
  A: 'city-yongan',
  N: 'city-nanzhong',
  J: 'city-jianye',
  K: 'city-kuaiji',
  S: 'city-chaisang',
  B: 'city-lujiang',
  Q: 'city-xiangyang',
  '0': 'pass-hulao',
  '1': 'pass-tong',
  '2': 'pass-jian',
  '3': 'pass-yangping',
};

// ─────────────────────────────────────────────
// 行军精灵渲染常量
// ─────────────────────────────────────────────

/** 阵营精灵颜色 — I11: 使用更鲜明的阵营色 */
const MARCH_SPRITE_COLORS: Record<string, string> = {
  wei: '#2196F3',
  shu: '#4CAF50',
  wu: '#F44336',
  neutral: '#9E9E9E',
};

/** 行走动画帧间隔(ms) — 8fps = 125ms per frame */
const WALK_FRAME_INTERVAL = 125;

/** I11: 行走动画帧数 — 4帧循环 */
const WALK_FRAME_COUNT = 4;

/** 准备阶段闪烁间隔(ms) */
const PREPARE_BLINK_INTERVAL = 400;

// ─────────────────────────────────────────────
// 攻城动画渲染常量
// ─────────────────────────────────────────────

/** 集结阶段集结点数量 */
const ASSEMBLY_POINT_COUNT = 8;

/** 集结点围绕城池的半径(瓦片数) */
const ASSEMBLY_RADIUS = 3;

/** 集结点闪烁间隔(ms) */
const ASSEMBLY_BLINK_MS = 200;

/** 战斗粒子数量 */
const BATTLE_PARTICLE_COUNT = 12;

/** 战斗粒子扩散半径(瓦片数) */
const BATTLE_RADIUS = 2;

/** 完成旗帜闪烁间隔(ms) */
const COMPLETED_FLAG_BLINK_MS = 300;

/** 策略对应特效颜色 */
const STRATEGY_COLORS: Record<string, { primary: string; secondary: string; glow: string }> = {
  forceAttack: { primary: '#FF3333', secondary: '#FF8866', glow: 'rgba(255,51,51,0.3)' },
  siege:       { primary: '#FF8800', secondary: '#FFBB44', glow: 'rgba(255,136,0,0.25)' },
  nightRaid:   { primary: '#7744CC', secondary: '#AA66FF', glow: 'rgba(119,68,204,0.3)' },
  insider:     { primary: '#33CC55', secondary: '#66FF88', glow: 'rgba(51,204,85,0.25)' },
};

/** 阵营对应集结点颜色 */
const SIEGE_FACTION_COLORS: Record<string, string> = {
  wei: '#4A90D9',
  shu: '#D94A4A',
  wu: '#4AD94A',
  neutral: '#888888',
};

// ─────────────────────────────────────────────
// Minimap 常量
// ─────────────────────────────────────────────

/** Minimap Canvas 尺寸(px)，保持100:60比例 */
const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 108;

/** Minimap 像素/瓦片比率(用于坐标转换) */
const MINIMAP_PX_PER_TILE_X = MINIMAP_WIDTH / 100;   // 1.8
const MINIMAP_PX_PER_TILE_Y = MINIMAP_HEIGHT / 60;    // 1.8

/**
 * 批量绘制矩形 — R13 Task2: 同色批量渲染优化
 *
 * 将收集到的矩形按 (fillStyle, globalAlpha) 分组，
 * 每组使用一次 beginPath + 多个 rect + 一次 fill，
 * 减少 fillStyle 切换次数（drawCall）。
 *
 * @param ctx - Canvas 2D 上下文
 * @param rects - 待绘制矩形列表
 */
function flushBatchedRects(
  ctx: CanvasRenderingContext2D,
  rects: Array<{ x: number; y: number; w: number; h: number; color: string; alpha: number }>,
): void {
  if (rects.length === 0) return;

  // 按 (color, alpha) 分组
  const groups = new Map<string, Array<{ x: number; y: number; w: number; h: number }>>();
  for (const r of rects) {
    const key = `${r.color}|${r.alpha}`;
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
    }
    group.push({ x: r.x, y: r.y, w: r.w, h: r.h });
  }

  // 逐组批量绘制
  for (const [key, items] of groups) {
    const [color, alphaStr] = key.split('|');
    const alpha = parseFloat(alphaStr);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const item of items) {
      ctx.rect(item.x, item.y, item.w, item.h);
    }
    ctx.fill();
  }

  // 恢复
  ctx.globalAlpha = 1.0;
}

/**
 * 收集单个行军精灵的矩形数据 (R13 Task2: 批量渲染优化)
 *
 * 不直接调用Canvas API，而是返回需要绘制的矩形列表，
 * 供后续按颜色分组批量绘制，减少fillStyle切换（drawCall）。
 *
 * 仍保留对Canvas直接调用的特效（arrived攻城闪烁、preparing箭头、
 * 路线虚线等），这些不适合批量绘制。
 *
 * @param march - 行军单位数据
 * @param ts - 瓦片像素尺寸 (tileSize * scale)
 * @param offsetX - 视口X偏移
 * @param offsetY - 视口Y偏移
 * @returns rects: 待批量绘制的矩形列表; effects: 需要直接绘制的效果列表
 */
function collectMarchRects(
  march: MarchUnit,
  ts: number,
  offsetX: number,
  offsetY: number,
): {
  rects: Array<{ x: number; y: number; w: number; h: number; color: string; alpha: number }>;
  effects: Array<{
    type: 'siege_ring' | 'crossed_swords' | 'preparing_arrow';
    px: number; py: number; size: number; ts: number;
  }>;
} {
  const rects: Array<{ x: number; y: number; w: number; h: number; color: string; alpha: number }> = [];
  const effects: Array<{
    type: 'siege_ring' | 'crossed_swords' | 'preparing_arrow';
    px: number; py: number; size: number; ts: number;
  }> = [];

  // 计算屏幕坐标
  const px = march.x * ts - offsetX + ts / 2;
  const py = march.y * ts - offsetY + ts / 2;

  // I11: 阵营颜色 — 使用增强的阵营色
  const color = MARCH_SPRITE_COLORS[march.faction] || MARCH_SPRITE_COLORS.neutral;

  // cancelled: 不渲染（已从activeMarches删除，不会到达此处）
  if (march.state === 'cancelled') {
    return { rects, effects };
  }

  // P3 #6.5: troops=0时不渲染精灵
  if (march.troops <= 0) {
    return { rects, effects };
  }

  // 根据兵力决定精灵数量
  const spriteCount = march.troops > 1000 ? 5 : march.troops > 500 ? 3 : 1;

  // 精灵尺寸(3px基础，随缩放)
  const size = Math.max(2, 3 * (ts / 8));

  // 间距
  const spacing = size * 2.5;

  // 当前时间
  const now = Date.now();

  // 状态特殊处理
  if (march.state === 'preparing') {
    // 准备阶段: 闪烁效果
    const blinkPhase = Math.floor(now / PREPARE_BLINK_INTERVAL) % 2;
    if (blinkPhase === 0) return { rects, effects }; // 闪烁: 每隔一帧不绘制
  }

  // I11: 4帧行走动画 (8fps, 4帧循环)
  const walkFrame = Math.floor(now / WALK_FRAME_INTERVAL) % WALK_FRAME_COUNT;

  // 精灵主透明度
  const mainAlpha = march.state === 'retreating' ? 0.7 : 1.0;
  // 身体颜色
  const bodyColor = march.state === 'retreating' ? '#888888' : color;
  // 头部颜色
  const headColor = march.state === 'retreating' ? '#AAAAAA' : '#F0D0B0';

  for (let i = 0; i < spriteCount; i++) {
    const ox = px + (i - (spriteCount - 1) / 2) * spacing;

    // I11: 4帧行走偏移 — 不同帧产生不同的腿部/身体位移
    let legOffset = 0;
    let bodyShiftX = 0;
    if (march.state === 'marching') {
      switch (walkFrame) {
        case 0: legOffset = -size * 0.3; bodyShiftX = size * 0.1; break;
        case 1: legOffset = 0; bodyShiftX = 0; break;
        case 2: legOffset = size * 0.3; bodyShiftX = -size * 0.1; break;
        case 3: legOffset = 0; bodyShiftX = 0; break;
      }
    } else if (march.state === 'retreating') {
      switch (walkFrame) {
        case 0: legOffset = -size * 0.2; bodyShiftX = -size * 0.1; break;
        case 1: legOffset = 0; bodyShiftX = 0; break;
        case 2: legOffset = size * 0.2; bodyShiftX = size * 0.1; break;
        case 3: legOffset = 0; bodyShiftX = 0; break;
      }
    }

    // 精灵身体(矩形) — 收集
    rects.push({
      x: ox - size / 2 + bodyShiftX,
      y: py - size + legOffset,
      w: size,
      h: size * 2,
      color: bodyColor,
      alpha: mainAlpha,
    });

    // 精灵头部(小方块) — 收集
    rects.push({
      x: ox - size * 0.3 + bodyShiftX,
      y: py - size * 1.4 + legOffset,
      w: size * 0.6,
      h: size * 0.6,
      color: headColor,
      alpha: mainAlpha,
    });

    // I11: 骑士/旗帜标记 — 像素风格旗帜 — 收集
    if (i === 0 && march.state !== 'retreating') {
      // 旗杆(阵营色)
      rects.push({
        x: ox + size * 0.4 + bodyShiftX,
        y: py - size * 2.2 + legOffset,
        w: Math.max(1, size * 0.15),
        h: size * 1.2,
        color: color,
        alpha: mainAlpha,
      });
      // 旗面(阵营色)
      rects.push({
        x: ox + size * 0.55 + bodyShiftX,
        y: py - size * 2.2 + legOffset,
        w: size * 1.0,
        h: size * 0.6,
        color: color,
        alpha: mainAlpha,
      });
      // 旗帜高光(白色, 30%透明度)
      rects.push({
        x: ox + size * 0.55 + bodyShiftX,
        y: py - size * 2.2 + legOffset,
        w: size * 0.4,
        h: size * 0.3,
        color: '#FFFFFF',
        alpha: 0.3,
      });
    }
  }

  // arrived状态: 记录特效（需要直接Canvas调用）
  if (march.state === 'arrived') {
    effects.push({ type: 'siege_ring', px, py, size, ts });
    effects.push({ type: 'crossed_swords', px, py, size, ts });
  }

  // preparing状态: 集结标识(向上的箭头) — 记录特效
  if (march.state === 'preparing') {
    effects.push({ type: 'preparing_arrow', px, py, size, ts });
  }

  return { rects, effects };
}

/**
 * 渲染直接Canvas特效 (R13 Task2: 不适合批量绘制的特效)
 *
 * 包括: arrived攻城闪烁环、交叉双剑、preparing箭头
 *
 * @param ctx - Canvas 2D 上下文
 * @param effects - 需要直接绘制的效果列表
 */
function renderMarchEffects(
  ctx: CanvasRenderingContext2D,
  effects: Array<{
    type: 'siege_ring' | 'crossed_swords' | 'preparing_arrow';
    px: number; py: number; size: number; ts: number;
  }>,
): void {
  const now = Date.now();

  for (const eff of effects) {
    if (eff.type === 'siege_ring') {
      const siegeBlink = Math.floor(now / 300) % 2;
      if (siegeBlink === 0) {
        ctx.strokeStyle = '#FF4444';
        ctx.lineWidth = Math.max(1, eff.ts * 0.15);
        const ringRadius = eff.ts * 0.6;
        ctx.beginPath();
        ctx.arc(eff.px, eff.py, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (eff.type === 'crossed_swords') {
      const swordLen = eff.size * 1.5;
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = Math.max(1, eff.size * 0.3);
      ctx.beginPath();
      ctx.moveTo(eff.px - swordLen, eff.py - eff.size * 2.5);
      ctx.lineTo(eff.px + swordLen, eff.py - eff.size * 4.0);
      ctx.moveTo(eff.px + swordLen, eff.py - eff.size * 2.5);
      ctx.lineTo(eff.px - swordLen, eff.py - eff.size * 4.0);
      ctx.stroke();
    } else if (eff.type === 'preparing_arrow') {
      ctx.fillStyle = '#FFD700';
      const arrowY = eff.py - eff.size * 3;
      const arrowSize = eff.size * 0.8;
      ctx.beginPath();
      ctx.moveTo(eff.px, arrowY - arrowSize);
      ctx.lineTo(eff.px - arrowSize, arrowY);
      ctx.lineTo(eff.px + arrowSize, arrowY);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/**
 * 渲染单个行军精灵 (I11: Canvas渲染+路线交互增强)
 *
 * 根据行军状态渲染不同动画效果:
 * - preparing: 在出发城市闪烁
 * - marching: 沿路径移动，4帧行走动画(8fps)
 * - arrived: 到达目标城市，攻城闪烁效果
 * - retreating: 撤退状态，70%透明度+不同精灵样式
 *
 * @param ctx - Canvas 2D 上下文
 * @param march - 行军单位数据
 * @param ts - 瓦片像素尺寸 (tileSize * scale)
 * @param offsetX - 视口X偏移
 * @param offsetY - 视口Y偏移
 */
function renderSingleMarch(
  ctx: CanvasRenderingContext2D,
  march: MarchUnit,
  ts: number,
  offsetX: number,
  offsetY: number,
): void {
  // R13 Task2: 使用收集+批量绘制模式（保持向后兼容）
  const { rects, effects } = collectMarchRects(march, ts, offsetX, offsetY);
  flushBatchedRects(ctx, rects);
  renderMarchEffects(ctx, effects);
}

// ─────────────────────────────────────────────
// 城防血条颜色计算 (R12 Task5: 平滑颜色插值)
// ─────────────────────────────────────────────

/**
 * 根据城防比值计算血条颜色 (R12 Task5)
 *
 * 使用平滑颜色插值，避免硬边界:
 * - ratio > 0.6: 绿色区间，从 #4CAF50 到更亮的绿
 * - 0.3 < ratio <= 0.6: 黄色区间，从绿→黄→红之间插值
 * - ratio <= 0.3: 红色区间，从黄→红之间插值
 *
 * @param ratio - 城防比值 (0~1)
 * @returns CSS颜色字符串
 */
export function getDefenseBarColor(ratio: number): string {
  if (isNaN(ratio)) return 'rgb(76,175,80)'; // NaN → 默认绿色
  const r = Math.max(0, Math.min(1, ratio));

  if (r > 0.6) {
    // 绿色区间: 在 #4CAF50 到更鲜亮的绿色之间插值
    // t: 0 (at 0.6) → 1 (at 1.0)
    const t = (r - 0.6) / 0.4;
    const rr = Math.round(76 - t * 20);   // 76 → 56
    const gg = Math.round(175 + t * 30);  // 175 → 205
    const bb = Math.round(80 - t * 20);   // 80 → 60
    return `rgb(${rr},${gg},${bb})`;
  } else if (r > 0.3) {
    // 黄色区间: 从绿色边缘(#4CAF50) → 黄色中心(#FFC107) → 红色边缘(#E8A030)
    // t: 0 (at 0.3) → 1 (at 0.6)
    const t = (r - 0.3) / 0.3;
    // 从暖黄→绿黄过渡
    const rr = Math.round(255 - t * (255 - 76));   // 255 → 76
    const gg = Math.round(193 - t * (193 - 175));  // 193 → 175
    const bb = Math.round(7 + t * (80 - 7));       // 7 → 80
    return `rgb(${rr},${gg},${bb})`;
  } else {
    // 红色区间: 从深红→亮红之间插值
    // t: 0 (at 0) → 1 (at 0.3)
    const t = r / 0.3;
    const rr = Math.round(180 + t * (231 - 180));  // 180 → 231
    const gg = Math.round(30 + t * (76 - 30));     // 30 → 76
    const bb = Math.round(20 + t * (60 - 20));     // 20 → 60
    return `rgb(${rr},${gg},${bb})`;
  }
}

// ─────────────────────────────────────────────
// 攻城动画阶段渲染函数
// ─────────────────────────────────────────────

/**
 * 渲染集结阶段(assembly)
 *
 * 军队从四方汇集到城下：
 * - 围绕目标城池分布的闪烁集结点（阵营颜色小圆点）
 * - 集结点从外围向中心汇聚
 * - 兵力数字指示
 */
function renderAssemblyPhase(
  ctx: CanvasRenderingContext2D,
  anim: SiegeAnimationState,
  cx: number,
  cy: number,
  ts: number,
  now: number,
): void {
  const factionColor = SIEGE_FACTION_COLORS[anim.faction] || SIEGE_FACTION_COLORS.neutral;

  // 计算集结进度 (0→1)
  const ASSEMBLY_DURATION = 3000;
  const elapsed = now - anim.startTimeMs;
  const progress = Math.min(1, elapsed / ASSEMBLY_DURATION);

  // 集结点半径从外圈缩小到内圈
  const startRadius = ASSEMBLY_RADIUS * ts;
  const endRadius = ts * 0.8;
  const currentRadius = startRadius + (endRadius - startRadius) * progress;

  // 像素点尺寸(3~5px)
  const dotSize = Math.max(2, Math.round(ts * 0.35));

  for (let i = 0; i < ASSEMBLY_POINT_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / ASSEMBLY_POINT_COUNT + (now * 0.001);
    const px = cx + Math.cos(angle) * currentRadius;
    const py = cy + Math.sin(angle) * currentRadius;

    // 闪烁效果
    const blinkPhase = Math.floor(now / ASSEMBLY_BLINK_MS + i) % 3;
    const alpha = blinkPhase === 0 ? 0.4 : blinkPhase === 1 ? 0.7 : 1.0;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = factionColor;

    // 像素风格：使用方块而非圆形
    ctx.fillRect(
      Math.round(px - dotSize / 2),
      Math.round(py - dotSize / 2),
      dotSize,
      dotSize,
    );
  }

  // 中心目标标记(红色十字闪烁)
  ctx.globalAlpha = 0.6 + Math.sin(now * 0.006) * 0.4;
  ctx.fillStyle = '#FF4444';
  const crossSize = Math.max(2, Math.round(ts * 0.2));
  ctx.fillRect(cx - crossSize * 2, cy - crossSize / 2, crossSize * 4, crossSize);
  ctx.fillRect(cx - crossSize / 2, cy - crossSize * 2, crossSize, crossSize * 4);

  // 兵力数字标签
  ctx.globalAlpha = 0.9;
  const fontSize = Math.max(8, Math.round(ts * 0.8));
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  // 背景
  const label = `${anim.troops}`;
  const metrics = ctx.measureText(label);
  const padX = 3, padY = 2;
  const labelY = cy - startRadius - ts * 0.3;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(
    cx - metrics.width / 2 - padX,
    labelY - fontSize - padY,
    metrics.width + padX * 2,
    fontSize + padY * 2,
  );
  ctx.fillStyle = factionColor;
  ctx.fillText(label, cx, labelY);

  ctx.globalAlpha = 1.0;
}

/**
 * 渲染战斗阶段(battle)
 *
 * 城池周围战斗效果：
 * - 策略特定特效(强攻闪光/围困圈/夜袭暗光/内应开放)
 * - 飞溅粒子(火焰/箭矢像素效果)
 * - 城防血条
 */
function renderBattlePhase(
  ctx: CanvasRenderingContext2D,
  anim: SiegeAnimationState,
  cx: number,
  cy: number,
  ts: number,
  now: number,
  stratColors: { primary: string; secondary: string; glow: string },
): void {
  const battleElapsed = now - anim.startTimeMs - 3000; // 减去集结阶段
  const pixelUnit = Math.max(2, Math.round(ts * 0.25));

  // ── 策略特效 ──

  if (anim.strategy === 'forceAttack') {
    // 强攻: 红色闪光 + 撞击效果
    const flashIntensity = Math.abs(Math.sin(now * 0.012));
    ctx.globalAlpha = flashIntensity * 0.35;
    ctx.fillStyle = '#FF2222';
    const flashRadius = ts * 2;
    ctx.fillRect(cx - flashRadius, cy - flashRadius, flashRadius * 2, flashRadius * 2);

    // 撞击线(从四个方向射入)
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = stratColors.primary;
    ctx.lineWidth = Math.max(1, pixelUnit * 0.5);
    const impactPhase = (now * 0.008) % 1;
    const impactLen = ts * 1.5;
    for (let dir = 0; dir < 4; dir++) {
      const angle = (Math.PI / 2) * dir + impactPhase * 0.5;
      const sx = cx + Math.cos(angle) * impactLen * 1.5;
      const sy = cy + Math.sin(angle) * impactLen * 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle + Math.PI) * impactLen * 0.5, sy + Math.sin(angle + Math.PI) * impactLen * 0.5);
      ctx.stroke();
    }
  } else if (anim.strategy === 'siege') {
    // 围困: 橙色围困圈
    ctx.globalAlpha = 0.6 + Math.sin(now * 0.004) * 0.2;
    ctx.strokeStyle = stratColors.primary;
    ctx.lineWidth = Math.max(1, ts * 0.15);
    ctx.setLineDash([ts * 0.4, ts * 0.3]);
    const circleR = BATTLE_RADIUS * ts;
    ctx.beginPath();
    ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 围困圈上的旋转标记点
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 + now * 0.002;
      const px = cx + Math.cos(angle) * circleR;
      const py = cy + Math.sin(angle) * circleR;
      ctx.fillStyle = stratColors.secondary;
      ctx.fillRect(Math.round(px - pixelUnit), Math.round(py - pixelUnit), pixelUnit * 2, pixelUnit * 2);
    }
  } else if (anim.strategy === 'nightRaid') {
    // 夜袭: 蓝紫色暗光脉动
    const pulseR = ts * (1.5 + Math.sin(now * 0.005) * 0.5);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = stratColors.primary;
    ctx.beginPath();
    ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
    ctx.fill();

    // 月牙图标(像素化)
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = stratColors.secondary;
    const moonSize = Math.max(3, ts * 0.5);
    ctx.fillRect(cx + ts - moonSize, cy - ts * 2, moonSize * 2, moonSize);
    ctx.fillStyle = '#111122';
    ctx.fillRect(cx + ts, cy - ts * 2, moonSize, moonSize);
  } else if (anim.strategy === 'insider') {
    // 内应: 绿色开放效果(城门打开)
    const openProgress = Math.min(1, Math.max(0, battleElapsed / 5000));
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = stratColors.primary;

    // 城门裂缝(向下展开)
    const gateW = ts * 0.3 * openProgress;
    ctx.fillRect(cx - gateW, cy - ts * 0.5, gateW * 2, ts);

    // 开门标记箭头
    ctx.fillStyle = stratColors.secondary;
    const arrowSize = Math.max(2, pixelUnit);
    ctx.beginPath();
    ctx.moveTo(cx, cy - ts);
    ctx.lineTo(cx - arrowSize, cy - ts + arrowSize * 2);
    ctx.lineTo(cx + arrowSize, cy - ts + arrowSize * 2);
    ctx.closePath();
    ctx.fill();
  }

  // ── 通用战斗粒子 ──

  ctx.globalAlpha = 0.85;
  for (let i = 0; i < BATTLE_PARTICLE_COUNT; i++) {
    // 使用伪随机，每个粒子有固定轨迹但循环移动
    const seed = i * 7919 + 13; // 素数种子
    const angle = ((seed % 360) * Math.PI) / 180 + now * 0.003 * (i % 2 === 0 ? 1 : -1);
    const dist = (BATTLE_RADIUS * ts * 0.3) + ((seed % 100) / 100) * BATTLE_RADIUS * ts * 0.7;
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;

    // 粒子颜色交替(火焰色)
    const isFlame = i % 3 === 0;
    const isArrow = i % 3 === 1;
    ctx.fillStyle = isFlame ? '#FF6633' : isArrow ? '#FFCC00' : stratColors.primary;

    // 像素粒子(小方块)
    const pSize = Math.max(1, pixelUnit * (isFlame ? 1.2 : 0.8));
    ctx.fillRect(Math.round(px - pSize / 2), Math.round(py - pSize / 2), pSize, pSize);

    // 火焰粒子带尾迹
    if (isFlame) {
      ctx.globalAlpha = 0.3;
      const trailLen = pixelUnit * 2;
      ctx.fillRect(Math.round(px - pSize / 2), Math.round(py), pSize, trailLen);
      ctx.globalAlpha = 0.85;
    }
  }

  // ── 城防血条 (MAP-F06-13 I5: 城防衰减显示 + R12 Task5: 动画增强) ──

  ctx.globalAlpha = 0.9;
  const barWidth = ts * 3;
  const barHeight = Math.max(3, ts * 0.35);
  const barX = cx - barWidth / 2;
  const barY = cy - ts * 2.5;

  // 背景
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

  // R12 Task5: 城防值 — 平滑颜色插值
  // 绿(#4CAF50) > 0.6, 黄(#FFC107) 0.3-0.6, 红(#E74C3C) < 0.3
  // 在每个区间内进行线性插值，实现视觉平滑过渡
  const ratio = anim.defenseRatio;
  const hpColor = getDefenseBarColor(ratio);
  ctx.fillStyle = hpColor;
  ctx.fillRect(barX, barY, barWidth * ratio, barHeight);

  // R12 Task5: 攻击指示 — 城防条脉冲边框(当城市被攻击时)
  const pulseAlpha = 0.4 + Math.abs(Math.sin(now * 0.008)) * 0.6;
  ctx.strokeStyle = `rgba(255,68,68,${pulseAlpha.toFixed(2)})`;
  ctx.lineWidth = Math.max(1, ts * 0.12);
  ctx.strokeRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

  // R12 Task5: 攻击图标(交叉剑) — 在血条上方
  const swordLen = Math.max(2, ts * 0.4);
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = Math.max(1, ts * 0.08);
  const iconY = barY - ts * 0.6;
  ctx.beginPath();
  ctx.moveTo(cx - swordLen, iconY - swordLen);
  ctx.lineTo(cx + swordLen, iconY + swordLen);
  ctx.moveTo(cx + swordLen, iconY - swordLen);
  ctx.lineTo(cx - swordLen, iconY + swordLen);
  ctx.stroke();

  // 标准边框
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  // 百分比文本
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.max(8, Math.round(ts * 0.7))}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(Math.floor(ratio * 100) + '%', cx, barY - ts * 0.7);

  ctx.globalAlpha = 1.0;
}

/**
 * 渲染完成阶段(completed)
 *
 * 胜利旗帜闪烁或失败效果
 */
function renderCompletedPhase(
  ctx: CanvasRenderingContext2D,
  anim: SiegeAnimationState,
  cx: number,
  cy: number,
  ts: number,
  now: number,
  stratColors: { primary: string; secondary: string; glow: string },
): void {
  const isVictory = anim.victory === true;
  const pixelUnit = Math.max(2, Math.round(ts * 0.25));

  if (isVictory) {
    // 胜利: 金色旗帜闪烁
    const blinkOn = Math.floor(now / COMPLETED_FLAG_BLINK_MS) % 2 === 0;

    // 旗杆
    ctx.fillStyle = '#8B6914';
    const poleW = Math.max(2, pixelUnit * 0.6);
    ctx.fillRect(cx - poleW / 2, cy - ts * 3, poleW, ts * 3.5);

    // 旗帜(金色闪烁)
    ctx.globalAlpha = blinkOn ? 1.0 : 0.5;
    ctx.fillStyle = '#FFD700';
    const flagW = ts * 1.2;
    const flagH = ts * 0.8;
    ctx.fillRect(cx + poleW / 2, cy - ts * 3, flagW, flagH);

    // 旗帜上纹理(像素小星星)
    ctx.fillStyle = '#FFF8DC';
    const starSize = Math.max(1, pixelUnit * 0.5);
    ctx.fillRect(cx + poleW / 2 + starSize, cy - ts * 3 + starSize, starSize, starSize);
    ctx.fillRect(cx + poleW / 2 + starSize * 3, cy - ts * 3 + starSize, starSize, starSize);
    ctx.fillRect(cx + poleW / 2 + starSize * 2, cy - ts * 3 + starSize * 2.5, starSize, starSize);

    // 胜利光环
    ctx.globalAlpha = 0.15 + Math.sin(now * 0.008) * 0.1;
    ctx.fillStyle = '#FFD700';
    const haloR = ts * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 失败: 灰色效果
    ctx.globalAlpha = 0.5;

    // 灰色旗帜
    ctx.fillStyle = '#666666';
    const poleW = Math.max(2, pixelUnit * 0.6);
    ctx.fillRect(cx - poleW / 2, cy - ts * 3, poleW, ts * 3.5);

    const flagW = ts * 1.0;
    const flagH = ts * 0.6;
    ctx.fillRect(cx + poleW / 2, cy - ts * 3, flagW, flagH);

    // 烟雾粒子(上升)
    for (let i = 0; i < 4; i++) {
      const seed = i * 3571;
      const sx = cx + ((seed % 60) - 30) * ts * 0.02;
      const phase = ((now * 0.002) + i * 0.5) % 1;
      const sy = cy - ts * 2 - phase * ts * 2;
      ctx.fillStyle = 'rgba(100,100,100,0.3)';
      const smokeSize = Math.max(2, pixelUnit * (1 + phase));
      ctx.fillRect(Math.round(sx - smokeSize / 2), Math.round(sy - smokeSize / 2), smokeSize, smokeSize);
    }

    // Defense recovery indicator (defeat with recovering defense)
    if (anim.defenseRatio > 0) {
      const barW = ts * 2;
      const barH = Math.max(2, pixelUnit * 0.5);
      const barX = cx - barW / 2;
      const barY = cy + ts * 1.5;

      // Background
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barW, barH);

      // Recovery fill
      ctx.globalAlpha = 0.7;
      const recoveryColor = anim.defenseRatio > 0.6 ? '#4caf50' : anim.defenseRatio > 0.3 ? '#ffc107' : '#f44336';
      ctx.fillStyle = recoveryColor;
      ctx.fillRect(barX, barY, barW * anim.defenseRatio, barH);

      // Recovery percentage text
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.max(8, pixelUnit * 1.5)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(anim.defenseRatio * 100)}%`, cx, barY + barH + pixelUnit * 1.5);
    }
  }

  ctx.globalAlpha = 1.0;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

export const PixelWorldMap: React.FC<PixelWorldMapProps> = ({
  territories,
  onSelectTerritory,
  selectedId,
  conquestAnimationSystem,
  marchRoute,
  activeMarches,
  activeSiegeAnims,
  highlightedTaskId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PixelMapRenderer | null>(null);
  const minimapRendererRef = useRef<PixelMapRenderer | null>(null);
  const offscreenMinimapRef = useRef<HTMLCanvasElement | null>(null);
  const routeRef = useRef<MarchRoute | null>(null);
  const marchesRef = useRef<MarchUnit[]>([]);
  const selectedIdRef = useRef<string | null | undefined>(selectedId);
  const markDirtyRef = useRef<() => void>(() => {});
  const territoriesRef = useRef<TerritoryData[]>(territories);
  territoriesRef.current = territories;
  const siegeAnimsRef = useRef<SiegeAnimationState[]>([]);
  const highlightedTaskIdRef = useRef<string | null | undefined>(highlightedTaskId);

  // ── D3-2: 脏标记 — 控制Canvas分层重绘 ──
  const dirtyFlagsRef = useRef({
    terrain: true,    // 地图层脏（territory数据变化）
    sprites: true,    // 精灵层脏（activeMarches变化）
    effects: true,    // 特效层脏（攻城/防御条变化）
    route: true,      // 路线层脏（marchRoute变化）
  });

  // R16 Task1: Track previous frame's dirty state for transition detection
  const prevFlagsRef = useRef({ sprites: false, effects: false });

  /** 标记所有层为脏（用于强制完整重绘） */
  const markAllDirty = useCallback(() => {
    dirtyFlagsRef.current.terrain = true;
    dirtyFlagsRef.current.sprites = true;
    dirtyFlagsRef.current.effects = true;
    dirtyFlagsRef.current.route = true;
  }, []);

  /** 检查是否有任何脏层 */
  const hasAnyDirty = useCallback(() => {
    const flags = dirtyFlagsRef.current;
    return flags.terrain || flags.sprites || flags.effects || flags.route;
  }, []);

  // D3-2: 注册脏标记引用供测试访问
  _setDirtyFlagsForTest(dirtyFlagsRef);
  const [isDragging, setIsDragging] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [isMinimapDragging, setIsMinimapDragging] = useState(false);

  // ── 初始化 ─────────────────────────────────

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    // 根据父容器尺寸动态设置Canvas像素尺寸
    const parent = containerRef.current || canvas.parentElement;
    if (parent) {
      const { width, height } = parent.getBoundingClientRect();
      if (width > 0 && height > 0) {
        canvas.width = Math.floor(width);
        canvas.height = Math.floor(height);
      }
    }

    const parser = new ASCIIMapParser();
    const map = parser.parse(worldMapText);

    const renderer = new PixelMapRenderer(canvas, {
      tileSize: 8,
      scale: 1,
      showCityNames: true,
      showGrid: false,
      factionColors: FACTION_COLORS,
    });
    renderer.loadMap(map);

    // 自动适配缩放并居中地图
    renderer.autoFit(canvas.width, canvas.height);

    rendererRef.current = renderer;

    // 创建Minimap离屏渲染器(用于鸟瞰图全局缩略)
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.floor(100 * 8 * 0.5);   // 400px (地图宽×tileSize×scale)
    offscreen.height = Math.floor(60 * 8 * 0.5);    // 240px
    offscreenMinimapRef.current = offscreen;

    const mmRenderer = new PixelMapRenderer(offscreen, {
      tileSize: 8,
      scale: 0.5,
      showCityNames: false,
      showGrid: false,
      factionColors: FACTION_COLORS,
    });
    mmRenderer.loadMap(map);
    mmRenderer.setViewport(0, 0);
    mmRenderer.render(); // 预渲染一次(地形不变)
    minimapRendererRef.current = mmRenderer;

    // 原生wheel事件(React的onWheel是passive，无法preventDefault)
    // 支持触摸板双指缩放/平移，同时阻止页面滚动
    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 触摸板双指张开/合拢 → 缩放(ctrlKey或大幅deltaY)
      if (e.ctrlKey || Math.abs(e.deltaY) > 50) {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const state = renderer as any;
        const newScale = Math.max(1.0, Math.min(4.0, state.config.scale + delta));
        renderer.setScale(newScale);
        markDirtyRef.current();
        return;
      }

      // 平移(双指拖拽或普通滚轮)
      const damping = 0.5;
      const state = renderer as any;
      renderer.setViewport(
        state.offsetX + e.deltaX * damping,
        state.offsetY + e.deltaY * damping,
      );
      markDirtyRef.current();
    };
    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });

    // D1-2/D1-3: 键盘快捷键事件监听
    const handleMapPan = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        const state = renderer as any;
        renderer.setViewport(
          state.offsetX + detail.dx,
          state.offsetY + detail.dy,
        );
        markDirtyRef.current();
      }
    };

    const handleMapZoom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        const state = renderer as any;
        const newScale = Math.max(1.0, Math.min(4.0, state.config.scale + detail.delta));
        renderer.setScale(newScale);
        markDirtyRef.current();
      }
    };

    const handleMapCenter = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.territoryId) {
        // 找到领土位置并居中
        const territory = territoriesRef.current?.find((t: any) => t.id === detail.territoryId);
        if (territory) {
          const state = renderer as any;
          const ts = state.config.tileSize * state.config.scale;
          renderer.setViewport(
            territory.position.x * ts - canvas.width / 2,
            territory.position.y * ts - canvas.height / 2,
          );
          markDirtyRef.current();
        }
      }
    };

    window.addEventListener('map-pan', handleMapPan);
    window.addEventListener('map-zoom', handleMapZoom);
    window.addEventListener('map-center', handleMapCenter);

    // 渲染循环(D3-2: 分层脏标记)
    let animId: number;

    const markDirty = () => {
      // 标记所有层为脏（用于交互事件：拖拽、缩放等）
      dirtyFlagsRef.current.terrain = true;
      dirtyFlagsRef.current.sprites = true;
      dirtyFlagsRef.current.effects = true;
      dirtyFlagsRef.current.route = true;
    };
    markDirtyRef.current = markDirty;

    // 监听攻城动画变更，触发重绘
    let unsubConquest: (() => void) | undefined;
    if (conquestAnimationSystem) {
      unsubConquest = conquestAnimationSystem.onChange(markDirty);
    }

    const animate = () => {
      const hasActiveConquest = conquestAnimationSystem?.getActive().length ?? 0;
      const hasActiveMarches = marchesRef.current.length > 0;
      const hasActiveSiegeAnims = siegeAnimsRef.current.length > 0;
      const flags = dirtyFlagsRef.current;

      // 持续动画源：行军/攻城/征服动画需要每帧更新精灵和特效层
      if (hasActiveConquest || hasActiveMarches || hasActiveSiegeAnims) {
        flags.sprites = true;
        flags.effects = true;
      }

      // R16 Task1: Only mark terrain dirty on transition frames (sprites/effects dirty state changes)
      // R15 Task1 originally forced terrain dirty every frame when overlays were active,
      // but this caused performance regression. Now we only force terrain dirty when
      // the sprites/effects dirty state transitions (false→true or true→false).
      const spritesTransition = prevFlagsRef.current.sprites !== flags.sprites;
      const effectsTransition = prevFlagsRef.current.effects !== flags.effects;
      if (spritesTransition || effectsTransition) {
        flags.terrain = true;
      }

      // 快照脏标记状态（在渲染过程中用于判断哪些层需要重绘）
      const wasTerrainDirty = flags.terrain;
      const wasSpritesDirty = flags.sprites;
      const wasEffectsDirty = flags.effects;
      const wasRouteDirty = flags.route;

      if (wasTerrainDirty || wasSpritesDirty || wasEffectsDirty || wasRouteDirty) {
        // D3-2: 分层重绘 — 仅重绘脏层
        if (wasTerrainDirty) {
          renderer.render();
          flags.terrain = false;
        }

        // 渲染攻城动画叠加层(特效层)
        if (wasEffectsDirty && conquestAnimationSystem) {
          conquestAnimationSystem.update();
          const cvs = canvasRef.current;
          if (cvs) {
            const ctx = cvs.getContext('2d');
            if (ctx) {
              const state = renderer as any;
              const ts = state.config.tileSize * state.config.scale;
              conquestAnimationSystem.render(ctx, ts, state.offsetX, state.offsetY);
            }
          }
        }

        // 渲染行军路线叠加层(路线层)
        if (wasRouteDirty) {
          renderMarchRouteOverlay();
          flags.route = false;
        }

        // 渲染行军精灵叠加层(精灵层)
        if (wasSpritesDirty) {
          renderMarchSpritesOverlay();
          flags.sprites = false;
        }

        // R9 Task5: 渲染高亮行军路线叠加层(精灵层或路线层脏时重绘)
        if (wasSpritesDirty || wasRouteDirty) {
          renderHighlightedMarchOverlay();
        }

        // 渲染攻城战斗动画叠加层(特效层)
        if (wasEffectsDirty) {
          renderSiegeAnimationOverlay();
          flags.effects = false;
        }

        // 渲染选中城市高亮边框(地形层脏时重绘)
        if (wasTerrainDirty) {
          renderSelectionHighlight();
        }

        renderMinimap();
      }

      // R16 Task1: Save current flags state for next frame's transition detection.
      // Must be AFTER flags are cleared by rendering, so we capture the final state.
      prevFlagsRef.current = { sprites: flags.sprites, effects: flags.effects };

      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('wheel', handleNativeWheel);
      window.removeEventListener('map-pan', handleMapPan);
      window.removeEventListener('map-zoom', handleMapZoom);
      window.removeEventListener('map-center', handleMapCenter);
      unsubConquest?.();
    };
  }, [conquestAnimationSystem]);

  // ── 窗口尺寸变化时重新适配 ─────────────────

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      const parent = containerRef.current || canvas?.parentElement;
      if (!canvas || !renderer || !parent) return;

      const { width, height } = parent.getBoundingClientRect();
      const newW = Math.floor(width);
      const newH = Math.floor(height);

      // 仅在尺寸真正变化时重新适配
      if (newW > 0 && newH > 0 && (newW !== canvas.width || newH !== canvas.height)) {
        canvas.width = newW;
        canvas.height = newH;
        renderer.autoFit(newW, newH);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── 更新城市数据 ───────────────────────────

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    // 资源类型→图标映射(用于res-spawn-*等不在DEFAULT_LANDMARKS中的资源点)
    const RESOURCE_TYPE_ICONS: Record<string, string> = {
      grain: '🌾', gold: '💰', troops: '⚔️', mandate: '🌟',
    };

    const cities: CityRenderData[] = territories.map(t => {
      const lm = DEFAULT_LANDMARKS.find(l => l.id === t.id);
      // 对于res-spawn-*类型的资源点，从ID中提取资源类型并映射图标
      let icon = lm?.icon;
      if (!icon && t.id.startsWith('res-spawn-')) {
        const resType = t.id.replace('res-spawn-', '');
        icon = RESOURCE_TYPE_ICONS[resType] || '🌾';
      }
      return {
        id: t.id,
        name: t.name,
        x: t.position.x,
        y: t.position.y,
        faction: t.ownership,
        level: t.level,
        icon: icon || '🏰',
        type: lm?.type || (t.id.startsWith('res-') ? 'resource' : 'city'),
      };
    });
    renderer.setCityData(cities);

    // D3-2: territories变化 → 标记地形层脏
    dirtyFlagsRef.current.terrain = true;

    // 同步更新minimap的城市数据并重绘离屏
    const mmRenderer = minimapRendererRef.current;
    if (mmRenderer) {
      mmRenderer.setCityData(cities);
      mmRenderer.render();
    }
  }, [territories]);

  // ── 行军路线数据同步 ───────────────────────

  useEffect(() => {
    routeRef.current = marchRoute ?? null;
    // D3-2: marchRoute变化 → 仅标记路线层脏
    dirtyFlagsRef.current.route = true;
  }, [marchRoute]);

  // ── 行军精灵数据同步 ───────────────────────

  useEffect(() => {
    marchesRef.current = activeMarches ?? [];
    // D3-2: activeMarches变化 → 仅标记精灵层脏
    dirtyFlagsRef.current.sprites = true;
  }, [activeMarches]);

  // ── 攻城战斗动画数据同步 ─────────────────

  useEffect(() => {
    siegeAnimsRef.current = activeSiegeAnims ?? [];
    // D3-2: activeSiegeAnims变化 → 仅标记特效层脏
    dirtyFlagsRef.current.effects = true;
  }, [activeSiegeAnims]);

  // ── 渲染行军路线 ──────────────────────────

  const renderMarchRouteOverlay = useCallback(() => {
    const route = routeRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!route || !renderer || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 从 renderer 获取渲染参数
    const state = renderer as any;
    const ts: number = state.config.tileSize * state.config.scale;
    const offsetX: number = state.offsetX;
    const offsetY: number = state.offsetY;

    // ── 绘制黄色虚线路径 ──
    if (route.path.length < 2) return;

    ctx.save();

    // 路径外发光(半透明宽线)
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.25)';
    ctx.lineWidth = ts * 0.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(
      route.path[0].x * ts - offsetX + ts / 2,
      route.path[0].y * ts - offsetY + ts / 2,
    );
    for (let i = 1; i < route.path.length; i++) {
      ctx.lineTo(
        route.path[i].x * ts - offsetX + ts / 2,
        route.path[i].y * ts - offsetY + ts / 2,
      );
    }
    ctx.stroke();

    // 路径主线(黄色虚线)
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = Math.max(2, ts * 0.25);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([ts * 0.6, ts * 0.4]);
    ctx.beginPath();
    ctx.moveTo(
      route.path[0].x * ts - offsetX + ts / 2,
      route.path[0].y * ts - offsetY + ts / 2,
    );
    for (let i = 1; i < route.path.length; i++) {
      ctx.lineTo(
        route.path[i].x * ts - offsetX + ts / 2,
        route.path[i].y * ts - offsetY + ts / 2,
      );
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // ── 绘制转折点圆点标记 ──
    for (const wp of route.waypoints) {
      const px = wp.x * ts - offsetX + ts / 2;
      const py = wp.y * ts - offsetY + ts / 2;
      const radius = Math.max(3, ts * 0.35);

      // 外圈(白色描边)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, radius + 1, 0, Math.PI * 2);
      ctx.fill();

      // 内圈(金色填充)
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 绘制途径城市名称标签 ──
    // 构建坐标→城市名映射(仅 city-* 类型)
    const posToCityName = new Map<string, string>();
    for (const landmark of DEFAULT_LANDMARKS) {
      if (landmark.id.startsWith('city-')) {
        const pos = LANDMARK_POSITIONS[landmark.id];
        if (pos) {
          posToCityName.set(`${pos.x},${pos.y}`, landmark.name);
        }
      }
    }

    const fontSize = Math.max(9, ts * 1.0);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // 在途径城市位置绘制标签
    for (const cityId of route.waypointCities) {
      const pos = LANDMARK_POSITIONS[cityId];
      if (!pos) continue;

      const cityName = posToCityName.get(`${pos.x},${pos.y}`) || cityId;
      const px = pos.x * ts - offsetX + ts / 2;
      const py = pos.y * ts - offsetY - ts * 0.3;

      // 背景框
      const metrics = ctx.measureText(cityName);
      const pad = 3;
      const bgX = px - metrics.width / 2 - pad;
      const bgY = py - fontSize - pad;
      const bgW = metrics.width + pad * 2;
      const bgH = fontSize + pad * 2;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(bgX, bgY, bgW, bgH, 3);
      ctx.fill();

      // 白色文字
      ctx.fillStyle = '#FFD700';
      ctx.fillText(cityName, px, py);
    }

    ctx.restore();
  }, []);

  // ── 渲染行军精灵叠加层 (I11: Canvas渲染+路线交互增强) ─────────────────────

  const renderMarchSpritesOverlay = useCallback(() => {
    const marches = marchesRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;

    // R15 Task1: No longer clearRect on empty marches — terrain must persist
    if (!marches.length) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 从 renderer 获取渲染参数
    const state = renderer as any;
    const ts: number = state.config.tileSize * state.config.scale;
    const offsetX: number = state.offsetX;
    const offsetY: number = state.offsetY;

    ctx.save();

    // ── R14 Task4: 同阵营精灵按创建时间(startTime)排序，确保确定性z-order ──
    // 更早创建的精灵在底层，后创建的在顶层
    const sortedMarches = [...marches].sort((a, b) => a.startTime - b.startTime);

    // ── Phase 1: 绘制行军路线(虚线) ──
    // 路线使用stroke，无法批量，逐个绘制
    for (const march of sortedMarches) {
      // I11: 绘制行军路线(虚线) — 当路径>=2个点时才绘制
      if (march.path && march.path.length >= 2) {
        const routeColor = MARCH_SPRITE_COLORS[march.faction] || MARCH_SPRITE_COLORS.neutral;

        // 路线半透明底色(宽线)
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = routeColor;
        ctx.lineWidth = ts * 0.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(
          march.path[0].x * ts - offsetX + ts / 2,
          march.path[0].y * ts - offsetY + ts / 2,
        );
        for (let pi = 1; pi < march.path.length; pi++) {
          ctx.lineTo(
            march.path[pi].x * ts - offsetX + ts / 2,
            march.path[pi].y * ts - offsetY + ts / 2,
          );
        }
        ctx.stroke();

        // I11: 路线主线(阵营色虚线)
        ctx.globalAlpha = march.state === 'retreating' ? 0.5 : 0.7;
        ctx.strokeStyle = routeColor;
        ctx.lineWidth = Math.max(1, ts * 0.15);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([ts * 0.4, ts * 0.3]);
        ctx.beginPath();
        ctx.moveTo(
          march.path[0].x * ts - offsetX + ts / 2,
          march.path[0].y * ts - offsetY + ts / 2,
        );
        for (let pi = 1; pi < march.path.length; pi++) {
          ctx.lineTo(
            march.path[pi].x * ts - offsetX + ts / 2,
            march.path[pi].y * ts - offsetY + ts / 2,
          );
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;
      }
    }

    // ── Phase 2: R13 Task2 批量收集精灵矩形 ──
    // 将所有march的精灵矩形收集起来，按颜色分组批量绘制
    const allRects: Array<{ x: number; y: number; w: number; h: number; color: string; alpha: number }> = [];
    const allEffects: Array<{
      type: 'siege_ring' | 'crossed_swords' | 'preparing_arrow';
      px: number; py: number; size: number; ts: number;
    }> = [];

    for (const march of sortedMarches) {
      const { rects, effects } = collectMarchRects(march, ts, offsetX, offsetY);
      allRects.push(...rects);
      allEffects.push(...effects);
    }

    // 批量绘制所有精灵矩形（减少fillStyle切换次数）
    flushBatchedRects(ctx, allRects);

    // 绘制特效（攻城闪烁、交叉双剑、集结箭头等）
    renderMarchEffects(ctx, allEffects);

    ctx.restore();
  }, []);

  // ── R9 Task5: 渲染高亮行军路线叠加层 ──────

  const renderHighlightedMarchOverlay = useCallback(() => {
    const hid = highlightedTaskIdRef.current;
    if (!hid) return;

    const marches = marchesRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!marches.length || !renderer || !canvas) return;

    // 找到匹配高亮任务ID的行军单位
    const matchedMarch = marches.find((m) => m.siegeTaskId === hid);
    if (!matchedMarch || matchedMarch.path.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = renderer as any;
    const ts: number = state.config.tileSize * state.config.scale;
    const offsetX: number = state.offsetX;
    const offsetY: number = state.offsetY;
    const now = Date.now();

    ctx.save();

    // 高亮外发光(半透明宽线)
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
    ctx.lineWidth = ts * 1.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(
      matchedMarch.path[0].x * ts - offsetX + ts / 2,
      matchedMarch.path[0].y * ts - offsetY + ts / 2,
    );
    for (let i = 1; i < matchedMarch.path.length; i++) {
      ctx.lineTo(
        matchedMarch.path[i].x * ts - offsetX + ts / 2,
        matchedMarch.path[i].y * ts - offsetY + ts / 2,
      );
    }
    ctx.stroke();

    // 高亮主线(亮黄色，加粗)
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = Math.max(3, ts * 0.4);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 脉冲闪烁效果
    const pulseAlpha = 0.7 + Math.sin(now * 0.005) * 0.3;
    ctx.globalAlpha = pulseAlpha;
    ctx.setLineDash([ts * 0.8, ts * 0.3]);
    ctx.beginPath();
    ctx.moveTo(
      matchedMarch.path[0].x * ts - offsetX + ts / 2,
      matchedMarch.path[0].y * ts - offsetY + ts / 2,
    );
    for (let i = 1; i < matchedMarch.path.length; i++) {
      ctx.lineTo(
        matchedMarch.path[i].x * ts - offsetX + ts / 2,
        matchedMarch.path[i].y * ts - offsetY + ts / 2,
      );
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 起点和终点标记
    // 起点: 绿色圆点
    const startX = matchedMarch.path[0].x * ts - offsetX + ts / 2;
    const startY = matchedMarch.path[0].y * ts - offsetY + ts / 2;
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#7EC850';
    const markerRadius = Math.max(4, ts * 0.5);
    ctx.beginPath();
    ctx.arc(startX, startY, markerRadius, 0, Math.PI * 2);
    ctx.fill();

    // 终点: 红色圆点
    const endX = matchedMarch.path[matchedMarch.path.length - 1].x * ts - offsetX + ts / 2;
    const endY = matchedMarch.path[matchedMarch.path.length - 1].y * ts - offsetY + ts / 2;
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(endX, endY, markerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, []);

  // ── 渲染攻城战斗动画叠加层 ───────────────

  const renderSiegeAnimationOverlay = useCallback(() => {
    const anims = siegeAnimsRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!anims.length || !renderer || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = renderer as any;
    const ts: number = state.config.tileSize * state.config.scale;
    const offsetX: number = state.offsetX;
    const offsetY: number = state.offsetY;
    const now = Date.now();

    ctx.save();

    for (const anim of anims) {
      // 目标城池屏幕中心坐标
      const cx = anim.targetX * ts - offsetX + ts / 2;
      const cy = anim.targetY * ts - offsetY + ts / 2;

      // 策略颜色
      const stratColors = STRATEGY_COLORS[anim.strategy] || STRATEGY_COLORS.forceAttack;

      if (anim.phase === 'assembly') {
        renderAssemblyPhase(ctx, anim, cx, cy, ts, now);
      } else if (anim.phase === 'battle') {
        renderBattlePhase(ctx, anim, cx, cy, ts, now, stratColors);
      } else if (anim.phase === 'completed') {
        renderCompletedPhase(ctx, anim, cx, cy, ts, now, stratColors);
      }
    }

    ctx.restore();
  }, []);

  // ── 渲染选中城市高亮边框 ─────────────────

  const renderSelectionHighlight = useCallback(() => {
    const sid = selectedIdRef.current;
    if (!sid) return;

    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const territory = territories.find(t => t.id === sid);
    if (!territory) return;

    const state = renderer as any;
    const ts: number = state.config.tileSize * state.config.scale;

    // 计算城市在Canvas上的像素位置
    const px = territory.position.x * ts - state.offsetX;
    const py = territory.position.y * ts - state.offsetY;

    // 高亮色块: 覆盖城市位置的3x3区域
    const blockSize = ts * 3;
    const bx = px - ts;
    const by = py - ts;

    // 金色高亮边框(#d4a574)
    ctx.save();
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = Math.max(2, ts * 0.3);
    ctx.setLineDash([ts * 0.5, ts * 0.3]);
    ctx.beginPath();
    ctx.roundRect(bx, by, blockSize, blockSize, ts * 0.3);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }, [territories]);

  // ── 渲染小地图 ────────────────────────────

  const renderMinimap = useCallback(() => {
    const minimap = minimapRef.current;
    const offscreen = offscreenMinimapRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!minimap || !offscreen || !renderer || !canvas) return;

    const ctx = minimap.getContext('2d');
    if (!ctx) return;

    // 将离屏全局地图缩放绘制到minimap
    ctx.clearRect(0, 0, minimap.width, minimap.height);
    ctx.drawImage(offscreen, 0, 0, minimap.width, minimap.height);

    // 绘制白色半透明视口矩形
    const state = renderer as any;
    const ts: number = state.config.tileSize * state.config.scale;
    const vx = (state.offsetX / ts) * MINIMAP_PX_PER_TILE_X;
    const vy = (state.offsetY / ts) * MINIMAP_PX_PER_TILE_Y;
    const vw = (canvas.width / ts) * MINIMAP_PX_PER_TILE_X;
    const vh = (canvas.height / ts) * MINIMAP_PX_PER_TILE_Y;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);
  }, []);

  // ── 鼠标交互（支持左键拖拽平移）──────────

  /** 记录鼠标按下位置，用于区分拖拽与点击 */
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  /** 是否处于拖拽平移状态（鼠标移动超过阈值后激活） */
  const isPanningRef = useRef(false);
  const DRAG_THRESHOLD = 5; // 像素阈值，超过则视为拖拽

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 2) {
      // 中键/右键: 立即平移
      setIsDragging(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      isPanningRef.current = true;
      e.preventDefault();
      return;
    }

    // 左键: 记录按下位置，等待判断是拖拽还是点击
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    isPanningRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 中键/右键拖拽
    if (isDragging && panStart) {
      const renderer = rendererRef.current;
      if (!renderer) return;

      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      renderer.setViewport(
        (renderer as any).offsetX - dx,
        (renderer as any).offsetY - dy,
      );
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // 左键拖拽检测
    if (mouseDownPosRef.current) {
      const dx = e.clientX - mouseDownPosRef.current.x;
      const dy = e.clientY - mouseDownPosRef.current.y;
      if (!isPanningRef.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        // 超过阈值，进入拖拽平移模式
        isPanningRef.current = true;
        setIsDragging(true);
        setPanStart({ x: mouseDownPosRef.current.x, y: mouseDownPosRef.current.y });
      }
      if (isPanningRef.current && panStart) {
        const renderer = rendererRef.current;
        if (!renderer) return;
        const mdx = e.clientX - panStart.x;
        const mdy = e.clientY - panStart.y;
        renderer.setViewport(
          (renderer as any).offsetX - mdx,
          (renderer as any).offsetY - mdy,
        );
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 如果没有拖拽，视为点击（选择城市）
    if (!isPanningRef.current && mouseDownPosRef.current && e.button === 0) {
      const renderer = rendererRef.current;
      if (renderer) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const grid = renderer.screenToGrid(x, y);
        if (grid) {
          const clickedCity = findCityAt(grid.x, grid.y);
          if (clickedCity) {
            onSelectTerritory?.(clickedCity.id);
          } else {
            onSelectTerritory?.('');
          }
        }
      }
    }

    mouseDownPosRef.current = null;
    isPanningRef.current = false;
    setIsDragging(false);
    setPanStart(null);
  };

  /** 查找网格坐标附近的领土 */
  const findCityAt = (gx: number, gy: number): TerritoryData | null => {
    // 在3x3范围内查找
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const checkX = gx + dx;
        const checkY = gy + dy;
        // 遍历领土，检查位置匹配
        for (const t of territories) {
          if (Math.abs(t.position.x - checkX) <= 1 && Math.abs(t.position.y - checkY) <= 1) {
            return t;
          }
        }
      }
    }
    return null;
  };

  // ── 小地图交互(点击跳转 + 拖拽移动) ──────

  /** 将minimap上的鼠标位置转换为主视窗偏移 */
  const jumpToMinimapPosition = useCallback((clientX: number, clientY: number) => {
    const renderer = rendererRef.current;
    const minimap = minimapRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !minimap || !canvas) return;

    const rect = minimap.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const state = renderer as any;
    const ts: number = state.config.tileSize * state.config.scale;

    // minimap坐标 → 瓦片坐标 → 主视窗偏移(居中)
    const tileX = mx / MINIMAP_PX_PER_TILE_X;
    const tileY = my / MINIMAP_PX_PER_TILE_Y;
    renderer.setViewport(
      tileX * ts - canvas.width / 2,
      tileY * ts - canvas.height / 2,
    );
  }, []);

  const handleMinimapMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsMinimapDragging(true);
    jumpToMinimapPosition(e.clientX, e.clientY);
  };

  const handleMinimapMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMinimapDragging) return;
    e.preventDefault();
    jumpToMinimapPosition(e.clientX, e.clientY);
  };

  const handleMinimapMouseUp = () => {
    setIsMinimapDragging(false);
  };

  // ── 选中城市高亮（仅重绘，不自动居中）─────

  // ── 选中ID同步(驱动高亮重绘) ─────────────

  useEffect(() => {
    selectedIdRef.current = selectedId;
    // D3-2: selectedId变化 → 标记地形层脏（选中高亮）
    dirtyFlagsRef.current.terrain = true;
    markDirtyRef.current();
  }, [selectedId]);

  // ── 高亮任务ID同步(驱动行军路线高亮重绘) ──

  useEffect(() => {
    highlightedTaskIdRef.current = highlightedTaskId;
    // D3-2: highlightedTaskId变化 → 标记精灵层+路线层脏
    dirtyFlagsRef.current.sprites = true;
    dirtyFlagsRef.current.route = true;
    markDirtyRef.current();
  }, [highlightedTaskId]);

  // ── D2-3/D2-4: 触摸手势支持 ─────────────────

  /** 触摸状态 */
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchDistanceRef = useRef<number>(0);
  const touchPanStartRef = useRef<{ x: number; y: number } | null>(null);

  /** 计算两点间距离 */
  const getTouchDistance = (t1: React.Touch, t2: React.Touch): number => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  /** 触摸开始 */
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      // 单指: 记录起始位置
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchPanStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      // 双指: 记录初始距离（用于缩放）
      touchDistanceRef.current = getTouchDistance(e.touches[0], e.touches[1]);
      touchStartRef.current = null;
    }
    e.preventDefault();
  };

  /** 触摸移动 */
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    if (e.touches.length === 1 && touchPanStartRef.current) {
      // 单指拖拽: 平移视窗
      const dx = e.touches[0].clientX - touchPanStartRef.current.x;
      const dy = e.touches[0].clientY - touchPanStartRef.current.y;
      renderer.setViewport(
        (renderer as any).offsetX - dx,
        (renderer as any).offsetY - dy,
      );
      touchPanStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      markDirtyRef.current();
    } else if (e.touches.length === 2) {
      // 双指: 缩放
      const newDistance = getTouchDistance(e.touches[0], e.touches[1]);
      const scaleDiff = (newDistance - touchDistanceRef.current) * 0.005;
      const state = renderer as any;
      const newScale = Math.max(1.0, Math.min(4.0, state.config.scale + scaleDiff));
      renderer.setScale(newScale);
      touchDistanceRef.current = newDistance;
      markDirtyRef.current();
    }
    e.preventDefault();
  };

  /** 触摸结束 */
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) {
      // 所有手指抬起: 判断是点击还是拖拽
      if (touchStartRef.current && touchPanStartRef.current) {
        const dx = touchPanStartRef.current.x - touchStartRef.current.x;
        const dy = touchPanStartRef.current.y - touchStartRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < DRAG_THRESHOLD) {
          // 点击: 选择城市
          const renderer = rendererRef.current;
          if (renderer) {
            const rect = canvasRef.current!.getBoundingClientRect();
            const x = touchStartRef.current.x - rect.left;
            const y = touchStartRef.current.y - rect.top;
            const grid = renderer.screenToGrid(x, y);
            if (grid) {
              const clickedCity = findCityAt(grid.x, grid.y);
              if (clickedCity) {
                onSelectTerritory?.(clickedCity.id);
              } else {
                onSelectTerritory?.('');
              }
            }
          }
        }
      }
      touchStartRef.current = null;
      touchPanStartRef.current = null;
    }
  };

  return (
    <div className="pixel-worldmap" ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={800}
        height={480}
        className="pixel-worldmap-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={e => e.preventDefault()}
      />
      <canvas
        ref={minimapRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        className="pixel-worldmap-minimap"
        onMouseDown={handleMinimapMouseDown}
        onMouseMove={handleMinimapMouseMove}
        onMouseUp={handleMinimapMouseUp}
        onMouseLeave={handleMinimapMouseUp}
      />
    </div>
  );
};

export default PixelWorldMap;

// ── D3-2: 脏标记类型(用于测试) ──

/** 分层脏标记接口 */
export interface DirtyFlags {
  terrain: boolean;
  sprites: boolean;
  effects: boolean;
  route: boolean;
}

/**
 * 获取组件最近创建的脏标记引用(仅用于测试)
 *
 * 用法: 在渲染PixelWorldMap后调用此函数获取dirtyFlagsRef
 * import { getDirtyFlagsForTest } from '../PixelWorldMap';
 * const flags = getDirtyFlagsForTest();
 */
let _testDirtyFlagsRef: React.MutableRefObject<DirtyFlags> | null = null;

/** @internal 设置脏标记引用(由组件内部调用) */
export function _setDirtyFlagsForTest(ref: React.MutableRefObject<DirtyFlags>) {
  _testDirtyFlagsRef = ref;
}

/** @internal 获取脏标记引用(由测试调用) */
export function getDirtyFlagsForTest(): DirtyFlags | null {
  return _testDirtyFlagsRef?.current ?? null;
}
