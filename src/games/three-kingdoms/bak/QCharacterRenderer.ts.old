/**
 * Q版角色绘制工具 — 程序化绘制中国风 Q 版小人
 *
 * 从纯色圆点升级为程序化 Q 版角色，根据职业类型绘制不同的外观特征：
 * - soldier: 头盔（三角形）+ 剑
 * - merchant: 帽子 + 背包
 * - farmer: 草帽 + 锄头
 * - scholar: 书卷 + 帽子
 * - scout: 斗篷 + 望远镜
 * - hero: 更大的角色 + 发光效果
 * - general: 盔甲 + 武器
 *
 * 使用 PixiJS Graphics API 绘制，无外部图片依赖。
 *
 * @module games/three-kingdoms/QCharacterRenderer
 */

import { Graphics } from 'pixi.js';

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

/** Q版角色默认缩放 */
const Q_SCALE = 1.0;

/** 头部半径 */
const HEAD_RADIUS = 6;

/** 身体宽度 */
const BODY_WIDTH = 10;

/** 身体高度 */
const BODY_HEIGHT = 10;

/** 身体圆角 */
const BODY_RADIUS = 3;

/** 腿部长度 */
const LEG_LENGTH = 5;

/** 手臂长度 */
const ARM_LENGTH = 6;

/** 皮肤颜色 */
const SKIN_COLOR = 0xFFDBAC;

/** 眼睛颜色 */
const EYE_COLOR = 0x1a1a2e;

/** 眼睛大小 */
const EYE_RADIUS = 1.2;

/** 嘴巴颜色 */
const MOUTH_COLOR = 0xcc6666;

// ═══════════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════════

/** Q版角色职业类型 */
export type QCharacterType = 'farmer' | 'soldier' | 'merchant' | 'scholar' | 'scout' | 'hero' | 'general' | 'craftsman';

/** Q版角色绘制参数 */
export interface QCharacterParams {
  /** 职业 */
  type: QCharacterType;
  /** 主色调 */
  color: number;
  /** 缩放比例 */
  scale?: number;
  /** 是否选中（高亮） */
  selected?: boolean;
  /** 行走动画相位（0~1） */
  walkPhase?: number;
}

// ═══════════════════════════════════════════════════════════════
// 颜色辅助
// ═══════════════════════════════════════════════════════════════

/**
 * 将颜色按比例变暗
 */
function darken(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

/**
 * 将颜色变亮
 */
function lighten(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) + (255 - ((color >> 16) & 0xff)) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) + (255 - ((color >> 8) & 0xff)) * factor));
  const b = Math.min(255, Math.round((color & 0xff) + (255 - (color & 0xff)) * factor));
  return (r << 16) | (g << 8) | b;
}

// ═══════════════════════════════════════════════════════════════
// Q版角色绘制
// ═══════════════════════════════════════════════════════════════

/**
 * 绘制 Q 版角色
 *
 * 在 Graphics 对象上绘制一个 Q 版小人，包含头部、身体、四肢和职业特征。
 *
 * @param g - PixiJS Graphics 对象
 * @param x - 中心 X 坐标
 * @param y - 脚底 Y 坐标
 * @param params - 角色绘制参数
 */
export function drawQCharacter(
  g: Graphics,
  x: number,
  y: number,
  params: QCharacterParams,
): void {
  const { type, color, scale = Q_SCALE, selected = false, walkPhase = 0 } = params;
  const s = scale;

  // ── 选中高亮光圈 ──
  if (selected) {
    g.circle(x, y - 12 * s, 14 * s)
      .fill({ color: 0xffeb3b, alpha: 0.15 });
    g.circle(x, y - 12 * s, 14 * s)
      .stroke({ color: 0xffeb3b, width: 1.5, alpha: 0.6 });
  }

  // ── 腿部（行走动画） ──
  const legSwing = Math.sin(walkPhase * Math.PI * 2) * 3 * s;
  // 左腿
  g.moveTo(x - 3 * s, y - BODY_HEIGHT * s)
    .lineTo(x - 3 * s + legSwing, y)
    .stroke({ width: 2 * s, color: darken(color, 0.5), cap: 'round' });
  // 右腿
  g.moveTo(x + 3 * s, y - BODY_HEIGHT * s)
    .lineTo(x + 3 * s - legSwing, y)
    .stroke({ width: 2 * s, color: darken(color, 0.5), cap: 'round' });

  // ── 鞋子 ──
  g.circle(x - 3 * s + legSwing, y, 2 * s).fill({ color: 0x3e2723 });
  g.circle(x + 3 * s - legSwing, y, 2 * s).fill({ color: 0x3e2723 });

  // ── 身体 ──
  const bodyY = y - BODY_HEIGHT * s - LEG_LENGTH * s * 0.3;
  g.roundRect(
    x - (BODY_WIDTH / 2) * s,
    bodyY,
    BODY_WIDTH * s,
    BODY_HEIGHT * s,
    BODY_RADIUS * s,
  ).fill({ color });
  // 身体边框
  g.roundRect(
    x - (BODY_WIDTH / 2) * s,
    bodyY,
    BODY_WIDTH * s,
    BODY_HEIGHT * s,
    BODY_RADIUS * s,
  ).stroke({ color: darken(color, 0.6), width: 1 });

  // ── 手臂 ──
  const armSwing = Math.sin(walkPhase * Math.PI * 2 + Math.PI) * 2 * s;
  // 左臂
  g.moveTo(x - (BODY_WIDTH / 2) * s, bodyY + 3 * s)
    .lineTo(x - (BODY_WIDTH / 2) * s - ARM_LENGTH * s * 0.5, bodyY + 3 * s + armSwing)
    .stroke({ width: 2 * s, color: SKIN_COLOR, cap: 'round' });
  // 右臂
  g.moveTo(x + (BODY_WIDTH / 2) * s, bodyY + 3 * s)
    .lineTo(x + (BODY_WIDTH / 2) * s + ARM_LENGTH * s * 0.5, bodyY + 3 * s - armSwing)
    .stroke({ width: 2 * s, color: SKIN_COLOR, cap: 'round' });

  // ── 头部 ──
  const headY = bodyY - HEAD_RADIUS * s * 0.8;
  g.circle(x, headY, HEAD_RADIUS * s).fill({ color: SKIN_COLOR });
  g.circle(x, headY, HEAD_RADIUS * s).stroke({ color: darken(SKIN_COLOR, 0.8), width: 0.5 });

  // ── 眼睛 ──
  g.circle(x - 2.5 * s, headY - 1 * s, EYE_RADIUS * s).fill({ color: EYE_COLOR });
  g.circle(x + 2.5 * s, headY - 1 * s, EYE_RADIUS * s).fill({ color: EYE_COLOR });
  // 眼睛高光
  g.circle(x - 2 * s, headY - 1.5 * s, 0.5 * s).fill({ color: 0xffffff });
  g.circle(x + 3 * s, headY - 1.5 * s, 0.5 * s).fill({ color: 0xffffff });

  // ── 嘴巴（微笑） ──
  g.arc(x, headY + 2 * s, 2 * s, 0.1 * Math.PI, 0.9 * Math.PI)
    .stroke({ width: 0.8 * s, color: MOUTH_COLOR });

  // ── 腮红 ──
  g.circle(x - 4 * s, headY + 1 * s, 1.5 * s).fill({ color: 0xff9999, alpha: 0.3 });
  g.circle(x + 4 * s, headY + 1 * s, 1.5 * s).fill({ color: 0xff9999, alpha: 0.3 });

  // ═══════════════════════════════════════════════════════════
  // 职业特征绘制
  // ═══════════════════════════════════════════════════════════

  switch (type) {
    case 'soldier':
      drawSoldierFeatures(g, x, headY, bodyY, s, color);
      break;
    case 'merchant':
      drawMerchantFeatures(g, x, headY, bodyY, s, color);
      break;
    case 'farmer':
      drawFarmerFeatures(g, x, headY, bodyY, s, color);
      break;
    case 'scholar':
      drawScholarFeatures(g, x, headY, bodyY, s, color);
      break;
    case 'scout':
      drawScoutFeatures(g, x, headY, bodyY, s, color);
      break;
    case 'hero':
    case 'general':
      drawHeroFeatures(g, x, headY, bodyY, s, color);
      break;
    case 'craftsman':
      drawCraftsmanFeatures(g, x, headY, bodyY, s, color);
      break;
  }
}

// ═══════════════════════════════════════════════════════════════
// 职业特征绘制
// ═══════════════════════════════════════════════════════════════

/**
 * 士兵特征：头盔 + 剑
 */
function drawSoldierFeatures(g: Graphics, x: number, headY: number, bodyY: number, s: number, _color: number): void {
  // 头盔（半圆形 + 红缨）
  g.arc(x, headY - 1 * s, HEAD_RADIUS * s * 1.1, Math.PI, 2 * Math.PI)
    .fill({ color: 0x607d8b });
  g.arc(x, headY - 1 * s, HEAD_RADIUS * s * 1.1, Math.PI, 2 * Math.PI)
    .stroke({ color: 0x37474f, width: 1 });
  // 红缨
  g.moveTo(x, headY - HEAD_RADIUS * s * 1.1)
    .lineTo(x, headY - HEAD_RADIUS * s * 1.1 - 4 * s)
    .stroke({ width: 1.5 * s, color: 0xf44336, cap: 'round' });
  g.circle(x, headY - HEAD_RADIUS * s * 1.1 - 4 * s, 1.5 * s).fill({ color: 0xf44336 });

  // 剑（右手持）
  const swordX = x + (BODY_WIDTH / 2) * s + ARM_LENGTH * s * 0.5;
  const swordY = bodyY + 3 * s;
  g.moveTo(swordX, swordY)
    .lineTo(swordX + 2 * s, swordY - 10 * s)
    .stroke({ width: 1.5 * s, color: 0xbdbdbd });
  // 剑柄
  g.moveTo(swordX - 2 * s, swordY)
    .lineTo(swordX + 2 * s, swordY)
    .stroke({ width: 2 * s, color: 0x795548 });
}

/**
 * 商人特征：帽子 + 背包
 */
function drawMerchantFeatures(g: Graphics, x: number, headY: number, bodyY: number, s: number, _color: number): void {
  // 帽子（圆形帽）
  g.ellipse(x, headY - HEAD_RADIUS * s * 0.9, HEAD_RADIUS * s * 1.2, HEAD_RADIUS * s * 0.5)
    .fill({ color: 0x8d6e63 });
  g.ellipse(x, headY - HEAD_RADIUS * s * 0.9, HEAD_RADIUS * s * 1.2, HEAD_RADIUS * s * 0.5)
    .stroke({ color: 0x5d4037, width: 0.8 });

  // 背包（身体后面的矩形）
  const packX = x - (BODY_WIDTH / 2) * s - 4 * s;
  const packY = bodyY + 2 * s;
  g.roundRect(packX, packY, 5 * s, 7 * s, 1.5 * s)
    .fill({ color: 0x8d6e63 });
  g.roundRect(packX, packY, 5 * s, 7 * s, 1.5 * s)
    .stroke({ color: 0x5d4037, width: 0.8 });
  // 背包带子
  g.moveTo(packX + 5 * s, packY)
    .lineTo(x - (BODY_WIDTH / 2) * s, packY)
    .stroke({ width: 0.8 * s, color: 0x5d4037 });
}

/**
 * 农民特征：草帽 + 锄头
 */
function drawFarmerFeatures(g: Graphics, x: number, headY: number, bodyY: number, s: number, _color: number): void {
  // 草帽（宽边帽）
  g.ellipse(x, headY - HEAD_RADIUS * s * 0.6, HEAD_RADIUS * s * 1.8, HEAD_RADIUS * s * 0.35)
    .fill({ color: 0xffcc02 });
  g.ellipse(x, headY - HEAD_RADIUS * s * 0.6, HEAD_RADIUS * s * 1.8, HEAD_RADIUS * s * 0.35)
    .stroke({ color: 0xf9a825, width: 0.8 });
  // 帽顶
  g.arc(x, headY - HEAD_RADIUS * s * 0.5, HEAD_RADIUS * s * 0.7, Math.PI, 2 * Math.PI)
    .fill({ color: 0xffcc02 });

  // 锄头（左手持）
  const hoeX = x - (BODY_WIDTH / 2) * s - ARM_LENGTH * s * 0.5;
  const hoeY = bodyY + 3 * s;
  g.moveTo(hoeX, hoeY)
    .lineTo(hoeX - 2 * s, hoeY - 10 * s)
    .stroke({ width: 1.5 * s, color: 0x795548 });
  // 锄头头
  g.moveTo(hoeX - 2 * s, hoeY - 10 * s)
    .lineTo(hoeX - 5 * s, hoeY - 11 * s)
    .lineTo(hoeX - 5 * s, hoeY - 9 * s)
    .closePath()
    .fill({ color: 0x9e9e9e });
}

/**
 * 学者特征：书卷 + 方巾帽
 */
function drawScholarFeatures(g: Graphics, x: number, headY: number, bodyY: number, s: number, _color: number): void {
  // 方巾帽（方形帽子）
  const hatW = HEAD_RADIUS * s * 1.3;
  const hatH = HEAD_RADIUS * s * 0.8;
  g.rect(x - hatW, headY - HEAD_RADIUS * s - hatH, hatW * 2, hatH)
    .fill({ color: 0x1a237e });
  g.rect(x - hatW, headY - HEAD_RADIUS * s - hatH, hatW * 2, hatH)
    .stroke({ color: 0x0d1b5e, width: 0.8 });
  // 帽翅（两边延伸）
  g.moveTo(x - hatW, headY - HEAD_RADIUS * s - hatH * 0.5)
    .lineTo(x - hatW - 4 * s, headY - HEAD_RADIUS * s - hatH * 0.3)
    .stroke({ width: 1 * s, color: 0x1a237e });
  g.moveTo(x + hatW, headY - HEAD_RADIUS * s - hatH * 0.5)
    .lineTo(x + hatW + 4 * s, headY - HEAD_RADIUS * s - hatH * 0.3)
    .stroke({ width: 1 * s, color: 0x1a237e });

  // 书卷（右手持）
  const bookX = x + (BODY_WIDTH / 2) * s + ARM_LENGTH * s * 0.5;
  const bookY = bodyY + 2 * s;
  g.roundRect(bookX - 2 * s, bookY - 3 * s, 4 * s, 6 * s, 0.5 * s)
    .fill({ color: 0xf5f5dc });
  g.roundRect(bookX - 2 * s, bookY - 3 * s, 4 * s, 6 * s, 0.5 * s)
    .stroke({ color: 0x8d6e63, width: 0.5 });
  // 书脊
  g.moveTo(bookX, bookY - 3 * s)
    .lineTo(bookX, bookY + 3 * s)
    .stroke({ width: 0.5 * s, color: 0x5d4037 });
}

/**
 * 斥候特征：斗篷 + 望远镜
 */
function drawScoutFeatures(g: Graphics, x: number, headY: number, bodyY: number, s: number, color: number): void {
  // 斗篷（三角形披风）
  const cloakColor = darken(color, 0.7);
  g.moveTo(x - (BODY_WIDTH / 2) * s - 1 * s, bodyY)
    .lineTo(x, bodyY + BODY_HEIGHT * s + 4 * s)
    .lineTo(x + (BODY_WIDTH / 2) * s + 1 * s, bodyY)
    .closePath()
    .fill({ color: cloakColor, alpha: 0.7 });

  // 兜帽
  g.arc(x, headY - 2 * s, HEAD_RADIUS * s * 1.15, Math.PI * 0.8, Math.PI * 2.2)
    .fill({ color: cloakColor });

  // 望远镜（右手持）
  const scopeX = x + (BODY_WIDTH / 2) * s + ARM_LENGTH * s * 0.3;
  const scopeY = bodyY + 2 * s;
  g.roundRect(scopeX, scopeY - 1 * s, 6 * s, 2.5 * s, 1 * s)
    .fill({ color: 0x5d4037 });
  g.circle(scopeX + 6 * s, scopeY + 0.25 * s, 1.5 * s)
    .fill({ color: 0x90caf9, alpha: 0.6 });
}

/**
 * 英雄/武将特征：发光效果 + 更大角色 + 武器
 */
function drawHeroFeatures(g: Graphics, x: number, headY: number, bodyY: number, s: number, color: number): void {
  // 发光光环
  g.circle(x, headY + (bodyY - headY) / 2, 16 * s)
    .fill({ color: lighten(color, 0.3), alpha: 0.08 });
  g.circle(x, headY + (bodyY - headY) / 2, 13 * s)
    .fill({ color: lighten(color, 0.3), alpha: 0.05 });

  // 武将盔甲肩甲
  g.circle(x - (BODY_WIDTH / 2) * s - 1 * s, bodyY + 2 * s, 3 * s)
    .fill({ color: darken(color, 0.7) });
  g.circle(x + (BODY_WIDTH / 2) * s + 1 * s, bodyY + 2 * s, 3 * s)
    .fill({ color: darken(color, 0.7) });

  // 头盔（更华丽）
  g.arc(x, headY - 1 * s, HEAD_RADIUS * s * 1.15, Math.PI, 2 * Math.PI)
    .fill({ color: 0xffd700 });
  g.arc(x, headY - 1 * s, HEAD_RADIUS * s * 1.15, Math.PI, 2 * Math.PI)
    .stroke({ color: 0xffa000, width: 1 });
  // 头盔装饰
  g.moveTo(x - 2 * s, headY - HEAD_RADIUS * s * 1.15)
    .lineTo(x, headY - HEAD_RADIUS * s * 1.15 - 6 * s)
    .lineTo(x + 2 * s, headY - HEAD_RADIUS * s * 1.15)
    .closePath()
    .fill({ color: 0xffd700 });

  // 武器（长枪/戟）
  const weaponX = x + (BODY_WIDTH / 2) * s + ARM_LENGTH * s * 0.5;
  const weaponY = bodyY + 3 * s;
  g.moveTo(weaponX, weaponY + 2 * s)
    .lineTo(weaponX + 1 * s, weaponY - 12 * s)
    .stroke({ width: 1.5 * s, color: 0x8d6e63 });
  // 枪头
  g.moveTo(weaponX + 1 * s, weaponY - 12 * s)
    .lineTo(weaponX - 1 * s, weaponY - 15 * s)
    .lineTo(weaponX + 3 * s, weaponY - 15 * s)
    .closePath()
    .fill({ color: 0xc0c0c0 });
}

/**
 * 工匠特征：围裙 + 工具
 */
function drawCraftsmanFeatures(g: Graphics, x: number, headY: number, bodyY: number, s: number, _color: number): void {
  // 围裙
  g.roundRect(x - (BODY_WIDTH / 2) * s * 0.8, bodyY + 2 * s, BODY_WIDTH * s * 0.8, BODY_HEIGHT * s * 0.7, 1 * s)
    .fill({ color: 0x795548, alpha: 0.6 });

  // 帽子（圆形小帽）
  g.arc(x, headY - HEAD_RADIUS * s * 0.8, HEAD_RADIUS * s * 0.9, Math.PI, 2 * Math.PI)
    .fill({ color: 0x5d4037 });

  // 锤子（右手持）
  const hammerX = x + (BODY_WIDTH / 2) * s + ARM_LENGTH * s * 0.4;
  const hammerY = bodyY + 2 * s;
  g.moveTo(hammerX, hammerY)
    .lineTo(hammerX + 1 * s, hammerY - 8 * s)
    .stroke({ width: 1.5 * s, color: 0x795548 });
  // 锤头
  g.roundRect(hammerX - 1 * s, hammerY - 10 * s, 4 * s, 3 * s, 0.5 * s)
    .fill({ color: 0x757575 });
}

/**
 * 获取 NPC 职业对应的 Q 版角色类型
 *
 * 将引擎 NPC 类型映射到 Q 版角色绘制类型。
 */
export function mapNPCTypeToQCharacter(npcType: string): QCharacterType {
  const mapping: Record<string, QCharacterType> = {
    farmer: 'farmer',
    soldier: 'soldier',
    merchant: 'merchant',
    scholar: 'scholar',
    scout: 'scout',
    hero: 'hero',
    general: 'general',
    craftsman: 'craftsman',
  };
  return mapping[npcType] ?? 'farmer';
}
