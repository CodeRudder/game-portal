/**
 * 中国风建筑绘制工具 — 程序化绘制中国风建筑
 *
 * 从 Emoji 改为程序化中国风建筑，支持多种建筑类型和等级。
 * 使用 PixiJS Graphics API 绘制飞檐屋顶、红墙、斗拱等中国建筑元素。
 *
 * 建筑类型：
 * - farm: 农田（麦穗图案）
 * - market: 市场（旗帜）
 * - barracks: 兵营（兵器架）
 * - academy: 书院（书卷）
 * - yamen: 衙门（官府建筑）
 * - residence: 民居（住宅）
 * - shop: 商铺
 * - smithy: 铁匠铺
 * - tavern: 酒馆
 * - wall: 城墙
 *
 * 等级越高，建筑越大越精美。
 *
 * @module games/three-kingdoms/ChineseBuildingRenderer
 */

import { Graphics, TextStyle, Text } from 'pixi.js';

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

/** 建筑类型配置 */
export interface ChineseBuildingConfig {
  /** 屋顶样式 */
  roofStyle: 'hip' | 'gable' | 'pavilion' | 'flat' | 'pagoda';
  /** 主色 */
  mainColor: number;
  /** 屋顶颜色 */
  roofColor: number;
  /** 柱子颜色 */
  pillarColor: number;
  /** 标签文字 */
  label: string;
  /** 是否有旗帜 */
  hasFlag?: boolean;
  /** 旗颜色 */
  flagColor?: number;
}

/** 建筑类型配置映射 */
const BUILDING_CONFIGS: Record<string, ChineseBuildingConfig> = {
  yamen: {
    roofStyle: 'hip', mainColor: 0xd4a574, roofColor: 0x8b0000,
    pillarColor: 0xcc0000, label: '衙门', hasFlag: true, flagColor: 0xffd700,
  },
  residence: {
    roofStyle: 'gable', mainColor: 0xdeb887, roofColor: 0x654321,
    pillarColor: 0x8b4513, label: '民居',
  },
  shop: {
    roofStyle: 'gable', mainColor: 0xff8c00, roofColor: 0x8b4513,
    pillarColor: 0xa0522d, label: '商铺', hasFlag: true, flagColor: 0xff4444,
  },
  barracks: {
    roofStyle: 'flat', mainColor: 0x4169e1, roofColor: 0x2f4f4f,
    pillarColor: 0x4682b4, label: '兵营', hasFlag: true, flagColor: 0x4169e1,
  },
  market: {
    roofStyle: 'pavilion', mainColor: 0xff6347, roofColor: 0x8b0000,
    pillarColor: 0xb22222, label: '市场', hasFlag: true, flagColor: 0xff6347,
  },
  smithy: {
    roofStyle: 'gable', mainColor: 0x808080, roofColor: 0x4a4a4a,
    pillarColor: 0x696969, label: '铁匠铺',
  },
  tavern: {
    roofStyle: 'gable', mainColor: 0x8b4513, roofColor: 0x5c3317,
    pillarColor: 0x654321, label: '酒馆', hasFlag: true, flagColor: 0x228b22,
  },
  academy: {
    roofStyle: 'hip', mainColor: 0x800080, roofColor: 0x4a0080,
    pillarColor: 0x6a0dad, label: '书院',
  },
  wall: {
    roofStyle: 'flat', mainColor: 0xa0a0a0, roofColor: 0x808080,
    pillarColor: 0x909090, label: '城墙',
  },
  farm: {
    roofStyle: 'gable', mainColor: 0x8fbc8f, roofColor: 0x556b2f,
    pillarColor: 0x6b8e23, label: '农田',
  },
};

// ═══════════════════════════════════════════════════════════════
// 颜色辅助
// ═══════════════════════════════════════════════════════════════

function darken(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

function lighten(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) + (255 - ((color >> 16) & 0xff)) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) + (255 - ((color >> 8) & 0xff)) * factor));
  const b = Math.min(255, Math.round((color & 0xff) + (255 - (color & 0xff)) * factor));
  return (r << 16) | (g << 8) | b;
}

// ═══════════════════════════════════════════════════════════════
// 中国风建筑绘制
// ═══════════════════════════════════════════════════════════════

/**
 * 绘制中国风建筑
 *
 * @param g - PixiJS Graphics 对象
 * @param x - 中心 X 坐标
 * @param y - 基座底部 Y 坐标
 * @param buildingType - 建筑类型（yamen/residence/shop/barracks/market/smithy/tavern/academy/wall/farm）
 * @param level - 建筑等级（1~5），等级越高建筑越大越精美
 * @param tileSize - 瓦片大小（用于缩放参考）
 * @returns 建筑标签 Text 对象（需要添加到容器中），如果没有则返回 null
 */
export function drawChineseBuilding(
  g: Graphics,
  x: number,
  y: number,
  buildingType: string,
  level: number,
  tileSize: number = 48,
): Text | null {
  const config = BUILDING_CONFIGS[buildingType] ?? BUILDING_CONFIGS.residence;
  const clampedLevel = Math.max(1, Math.min(5, level));

  // 等级缩放因子（1.0 ~ 1.5）
  const levelScale = 1.0 + (clampedLevel - 1) * 0.12;
  const s = (tileSize / 48) * levelScale;

  // 建筑尺寸
  const baseW = 22 * s;
  const baseH = 5 * s;
  const bodyW = 18 * s;
  const bodyH = 14 * s;
  const roofOverhang = 4 * s;

  // ── 台基 ──
  g.roundRect(x - baseW / 2, y - baseH, baseW, baseH, 1)
    .fill({ color: 0xd4c5a9 });
  g.roundRect(x - baseW / 2, y - baseH, baseW, baseH, 1)
    .stroke({ color: darken(0xd4c5a9, 0.7), width: 0.5 });
  // 台基台阶
  g.roundRect(x - baseW * 0.35, y - 2, baseW * 0.7, 2, 0.5)
    .fill({ color: darken(0xd4c5a9, 0.85) });

  // ── 墙体 ──
  const wallY = y - baseH - bodyH;
  g.roundRect(x - bodyW / 2, wallY, bodyW, bodyH, 1)
    .fill({ color: config.mainColor, alpha: 0.9 });
  g.roundRect(x - bodyW / 2, wallY, bodyW, bodyH, 1)
    .stroke({ color: darken(config.mainColor, 0.6), width: 1 });

  // ── 柱子 ──
  const pillarW = 2 * s;
  const pillarPositions = [-bodyW / 2 + 1 * s, -bodyW / 4, bodyW / 4, bodyW / 2 - 1 * s];
  for (const px of pillarPositions) {
    g.rect(x + px - pillarW / 2, wallY, pillarW, bodyH)
      .fill({ color: config.pillarColor, alpha: 0.7 });
  }

  // ── 门 ──
  const doorW = 5 * s;
  const doorH = bodyH * 0.6;
  g.roundRect(x - doorW / 2, wallY + bodyH - doorH, doorW, doorH, 1)
    .fill({ color: darken(config.mainColor, 0.4) });
  // 门环
  g.circle(x - 1 * s, wallY + bodyH - doorH / 2, 0.8 * s)
    .fill({ color: 0xffd700 });
  g.circle(x + 1 * s, wallY + bodyH - doorH / 2, 0.8 * s)
    .fill({ color: 0xffd700 });

  // ── 窗户（等级 >= 2） ──
  if (clampedLevel >= 2) {
    const winS = 3 * s;
    // 左窗
    g.roundRect(x - bodyW / 2 + 2 * s, wallY + 2 * s, winS, winS, 0.5)
      .fill({ color: lighten(config.mainColor, 0.3), alpha: 0.5 });
    g.roundRect(x - bodyW / 2 + 2 * s, wallY + 2 * s, winS, winS, 0.5)
      .stroke({ color: darken(config.mainColor, 0.5), width: 0.5 });
    // 右窗
    g.roundRect(x + bodyW / 2 - 2 * s - winS, wallY + 2 * s, winS, winS, 0.5)
      .fill({ color: lighten(config.mainColor, 0.3), alpha: 0.5 });
    g.roundRect(x + bodyW / 2 - 2 * s - winS, wallY + 2 * s, winS, winS, 0.5)
      .stroke({ color: darken(config.mainColor, 0.5), width: 0.5 });
  }

  // ═══════════════════════════════════════════════════════════
  // 屋顶绘制（中国建筑核心特征：飞檐）
  // ═══════════════════════════════════════════════════════════

  const roofY = wallY;

  switch (config.roofStyle) {
    case 'hip': {
      // 庑殿顶（四坡顶）— 最高等级，衙门/书院使用
      drawHipRoof(g, x, roofY, bodyW, roofOverhang, s, config.roofColor, clampedLevel);
      break;
    }
    case 'gable': {
      // 硬山顶（人字形）— 民居/商铺常见
      drawGableRoof(g, x, roofY, bodyW, roofOverhang, s, config.roofColor, clampedLevel);
      break;
    }
    case 'pavilion': {
      // 攒尖顶（亭阁式）— 市场使用
      drawPavilionRoof(g, x, roofY, bodyW, roofOverhang, s, config.roofColor, clampedLevel);
      break;
    }
    case 'flat': {
      // 平顶（城墙/兵营）
      drawFlatRoof(g, x, roofY, bodyW, roofOverhang, s, config.roofColor, clampedLevel);
      break;
    }
    case 'pagoda': {
      // 宝塔顶
      drawPagodaRoof(g, x, roofY, bodyW, s, config.roofColor, clampedLevel);
      break;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 装饰特征
  // ═══════════════════════════════════════════════════════════

  // ── 旗帜（如果有） ──
  if (config.hasFlag && config.flagColor) {
    const flagX = x + bodyW / 2 + 2 * s;
    const flagBaseY = roofY - 5 * s;
    // 旗杆
    g.moveTo(flagX, wallY)
      .lineTo(flagX, flagBaseY - 10 * s)
      .stroke({ width: 1 * s, color: 0x5d4037 });
    // 旗面（三角旗）
    g.moveTo(flagX, flagBaseY - 10 * s)
      .lineTo(flagX + 6 * s, flagBaseY - 7 * s)
      .lineTo(flagX, flagBaseY - 4 * s)
      .closePath()
      .fill({ color: config.flagColor });
    g.moveTo(flagX, flagBaseY - 10 * s)
      .lineTo(flagX + 6 * s, flagBaseY - 7 * s)
      .lineTo(flagX, flagBaseY - 4 * s)
      .closePath()
      .stroke({ color: darken(config.flagColor, 0.6), width: 0.5 });
  }

  // ── 等级装饰（等级 >= 3） ──
  if (clampedLevel >= 3) {
    // 屋脊装饰（鸱吻）
    const ridgeY = roofY - 12 * s;
    g.moveTo(x - bodyW / 2 - roofOverhang, ridgeY + 2 * s)
      .lineTo(x - bodyW / 2 - roofOverhang - 2 * s, ridgeY - 2 * s)
      .lineTo(x - bodyW / 2 - roofOverhang + 2 * s, ridgeY)
      .closePath()
      .fill({ color: 0xffd700 });
    g.moveTo(x + bodyW / 2 + roofOverhang, ridgeY + 2 * s)
      .lineTo(x + bodyW / 2 + roofOverhang + 2 * s, ridgeY - 2 * s)
      .lineTo(x + bodyW / 2 + roofOverhang - 2 * s, ridgeY)
      .closePath()
      .fill({ color: 0xffd700 });
  }

  // ── 等级 >= 4: 灯笼 ──
  if (clampedLevel >= 4) {
    const lanternX = x - bodyW / 2 - 3 * s;
    const lanternY = wallY + bodyH / 2;
    // 灯笼线
    g.moveTo(lanternX, wallY)
      .lineTo(lanternX, lanternY - 2 * s)
      .stroke({ width: 0.5 * s, color: 0x5d4037 });
    // 灯笼体
    g.ellipse(lanternX, lanternY, 2 * s, 3 * s)
      .fill({ color: 0xff0000, alpha: 0.8 });
    g.ellipse(lanternX, lanternY, 2 * s, 3 * s)
      .stroke({ color: 0xcc0000, width: 0.5 });

    // 右侧灯笼
    const rLanternX = x + bodyW / 2 + 3 * s;
    g.moveTo(rLanternX, wallY)
      .lineTo(rLanternX, lanternY - 2 * s)
      .stroke({ width: 0.5 * s, color: 0x5d4037 });
    g.ellipse(rLanternX, lanternY, 2 * s, 3 * s)
      .fill({ color: 0xff0000, alpha: 0.8 });
    g.ellipse(rLanternX, lanternY, 2 * s, 3 * s)
      .stroke({ color: 0xcc0000, width: 0.5 });
  }

  // ── 等级 >= 5: 金色光环 ──
  if (clampedLevel >= 5) {
    g.circle(x, wallY + bodyH / 2, bodyW * 0.8)
      .fill({ color: 0xffd700, alpha: 0.06 });
    g.circle(x, wallY + bodyH / 2, bodyW * 0.6)
      .fill({ color: 0xffd700, alpha: 0.04 });
  }

  // ── 建筑标签 ──
  const labelText = new Text({
    text: config.label,
    style: new TextStyle({
      fontSize: 8,
      fill: '#ffffff',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      stroke: { color: '#000000', width: 2 },
    }),
  });
  labelText.anchor.set(0.5, 0);
  labelText.position.set(x, y + 1);

  return labelText;
}

// ═══════════════════════════════════════════════════════════════
// 屋顶绘制函数
// ═══════════════════════════════════════════════════════════════

/**
 * 庑殿顶（四坡顶）
 *
 * 中国古建筑最高等级屋顶，四面坡，有正脊和四条垂脊。
 */
function drawHipRoof(
  g: Graphics, x: number, roofY: number,
  bodyW: number, overhang: number, s: number,
  roofColor: number, level: number,
): void {
  const roofH = (10 + level * 2) * s;
  const totalW = bodyW + overhang * 2;

  // 主屋顶面（使用贝塞尔曲线模拟飞檐翘角）
  g.moveTo(x - totalW / 2, roofY)
    .quadraticCurveTo(
      x - totalW / 2 + 2 * s, roofY - roofH * 0.7,
      x, roofY - roofH,
    )
    .quadraticCurveTo(
      x + totalW / 2 - 2 * s, roofY - roofH * 0.7,
      x + totalW / 2, roofY,
    )
    .closePath()
    .fill({ color: roofColor });

  // 屋顶边框
  g.moveTo(x - totalW / 2, roofY)
    .quadraticCurveTo(
      x - totalW / 2 + 2 * s, roofY - roofH * 0.7,
      x, roofY - roofH,
    )
    .quadraticCurveTo(
      x + totalW / 2 - 2 * s, roofY - roofH * 0.7,
      x + totalW / 2, roofY,
    )
    .closePath()
    .stroke({ color: darken(roofColor, 0.6), width: 1 });

  // 飞檐翘角效果（两端微微上翘）
  g.moveTo(x - totalW / 2, roofY)
    .quadraticCurveTo(
      x - totalW / 2 - 1 * s, roofY - 2 * s,
      x - totalW / 2 - 2 * s, roofY - 3 * s,
    )
    .stroke({ width: 1.5 * s, color: roofColor, cap: 'round' });

  g.moveTo(x + totalW / 2, roofY)
    .quadraticCurveTo(
      x + totalW / 2 + 1 * s, roofY - 2 * s,
      x + totalW / 2 + 2 * s, roofY - 3 * s,
    )
    .stroke({ width: 1.5 * s, color: roofColor, cap: 'round' });

  // 屋脊线
  g.moveTo(x - totalW / 2 * 0.3, roofY - roofH * 0.85)
    .lineTo(x + totalW / 2 * 0.3, roofY - roofH * 0.85)
    .stroke({ width: 1 * s, color: lighten(roofColor, 0.3) });

  // 宝顶（屋顶装饰球）
  g.circle(x, roofY - roofH - 1 * s, 1.5 * s)
    .fill({ color: 0xffd700 });
}

/**
 * 硬山顶（人字形）
 *
 * 最常见的中国民居屋顶，两面坡，两侧有山墙。
 */
function drawGableRoof(
  g: Graphics, x: number, roofY: number,
  bodyW: number, overhang: number, s: number,
  roofColor: number, level: number,
): void {
  const roofH = (8 + level * 1.5) * s;
  const totalW = bodyW + overhang * 2;

  // 主屋顶面
  g.moveTo(x - totalW / 2, roofY)
    .lineTo(x, roofY - roofH)
    .lineTo(x + totalW / 2, roofY)
    .closePath()
    .fill({ color: roofColor });

  g.moveTo(x - totalW / 2, roofY)
    .lineTo(x, roofY - roofH)
    .lineTo(x + totalW / 2, roofY)
    .closePath()
    .stroke({ color: darken(roofColor, 0.6), width: 1 });

  // 飞檐翘角
  g.moveTo(x - totalW / 2, roofY)
    .quadraticCurveTo(
      x - totalW / 2 - 1 * s, roofY - 1.5 * s,
      x - totalW / 2 - 2 * s, roofY - 2 * s,
    )
    .stroke({ width: 1.2 * s, color: roofColor, cap: 'round' });

  g.moveTo(x + totalW / 2, roofY)
    .quadraticCurveTo(
      x + totalW / 2 + 1 * s, roofY - 1.5 * s,
      x + totalW / 2 + 2 * s, roofY - 2 * s,
    )
    .stroke({ width: 1.2 * s, color: roofColor, cap: 'round' });

  // 屋脊
  g.moveTo(x - totalW / 2 * 0.3, roofY - roofH + 1 * s)
    .lineTo(x + totalW / 2 * 0.3, roofY - roofH + 1 * s)
    .stroke({ width: 1.5 * s, color: lighten(roofColor, 0.2) });

  // 瓦片纹理线（等级 >= 2）
  if (level >= 2) {
    for (let i = 1; i <= 3; i++) {
      const ratio = i / 4;
      const lineW = totalW * (1 - ratio) / 2;
      const lineY = roofY - roofH * ratio;
      g.moveTo(x - lineW, roofY - (roofY - lineY))
        .lineTo(x + lineW, roofY - (roofY - lineY))
        .stroke({ width: 0.3 * s, color: darken(roofColor, 0.5), alpha: 0.4 });
    }
  }
}

/**
 * 攒尖顶（亭阁式）
 *
 * 圆锥形或方锥形屋顶，常见于亭、塔、市场。
 */
function drawPavilionRoof(
  g: Graphics, x: number, roofY: number,
  bodyW: number, overhang: number, s: number,
  roofColor: number, level: number,
): void {
  const roofH = (10 + level * 2) * s;
  const totalW = bodyW + overhang * 2;

  // 攒尖顶（多层曲线）
  g.moveTo(x - totalW / 2, roofY)
    .quadraticCurveTo(
      x - totalW / 3, roofY - roofH * 0.5,
      x - totalW * 0.15, roofY - roofH * 0.85,
    )
    .lineTo(x, roofY - roofH)
    .lineTo(x + totalW * 0.15, roofY - roofH * 0.85)
    .quadraticCurveTo(
      x + totalW / 3, roofY - roofH * 0.5,
      x + totalW / 2, roofY,
    )
    .closePath()
    .fill({ color: roofColor });

  g.moveTo(x - totalW / 2, roofY)
    .quadraticCurveTo(
      x - totalW / 3, roofY - roofH * 0.5,
      x - totalW * 0.15, roofY - roofH * 0.85,
    )
    .lineTo(x, roofY - roofH)
    .lineTo(x + totalW * 0.15, roofY - roofH * 0.85)
    .quadraticCurveTo(
      x + totalW / 3, roofY - roofH * 0.5,
      x + totalW / 2, roofY,
    )
    .closePath()
    .stroke({ color: darken(roofColor, 0.6), width: 1 });

  // 飞檐
  g.moveTo(x - totalW / 2, roofY)
    .quadraticCurveTo(x - totalW / 2 - 1 * s, roofY - 2 * s, x - totalW / 2 - 3 * s, roofY - 3 * s)
    .stroke({ width: 1.5 * s, color: roofColor, cap: 'round' });
  g.moveTo(x + totalW / 2, roofY)
    .quadraticCurveTo(x + totalW / 2 + 1 * s, roofY - 2 * s, x + totalW / 2 + 3 * s, roofY - 3 * s)
    .stroke({ width: 1.5 * s, color: roofColor, cap: 'round' });

  // 宝顶
  g.circle(x, roofY - roofH - 1 * s, 2 * s)
    .fill({ color: 0xffd700 });
  g.circle(x, roofY - roofH - 1 * s, 2 * s)
    .stroke({ color: 0xffa000, width: 0.5 });
}

/**
 * 平顶（城墙/兵营）
 *
 * 简单的平顶结构，城垛效果。
 */
function drawFlatRoof(
  g: Graphics, x: number, roofY: number,
  bodyW: number, overhang: number, s: number,
  roofColor: number, level: number,
): void {
  const totalW = bodyW + overhang * 2;
  const roofH = 3 * s;

  // 平顶
  g.rect(x - totalW / 2, roofY - roofH, totalW, roofH)
    .fill({ color: roofColor });
  g.rect(x - totalW / 2, roofY - roofH, totalW, roofH)
    .stroke({ color: darken(roofColor, 0.6), width: 1 });

  // 城垛
  const crenelW = totalW / (4 + level);
  for (let i = 0; i < 4 + level; i += 2) {
    const cx = x - totalW / 2 + i * crenelW;
    g.rect(cx, roofY - roofH - 2 * s, crenelW, 2 * s)
      .fill({ color: darken(roofColor, 0.8) });
  }
}

/**
 * 宝塔顶（多层）
 */
function drawPagodaRoof(
  g: Graphics, x: number, roofY: number,
  bodyW: number, s: number,
  roofColor: number, level: number,
): void {
  const layers = Math.min(level + 1, 5);

  for (let i = 0; i < layers; i++) {
    const layerW = bodyW * (1 - i * 0.15);
    const layerY = roofY - i * 6 * s;
    const layerH = 4 * s;

    // 层檐
    g.moveTo(x - layerW / 2 - 2 * s, layerY)
      .quadraticCurveTo(x - layerW / 2, layerY - layerH, x, layerY - layerH - 1 * s)
      .quadraticCurveTo(x + layerW / 2, layerY - layerH, x + layerW / 2 + 2 * s, layerY)
      .closePath()
      .fill({ color: roofColor, alpha: 0.9 - i * 0.1 });

    g.moveTo(x - layerW / 2 - 2 * s, layerY)
      .quadraticCurveTo(x - layerW / 2, layerY - layerH, x, layerY - layerH - 1 * s)
      .quadraticCurveTo(x + layerW / 2, layerY - layerH, x + layerW / 2 + 2 * s, layerY)
      .closePath()
      .stroke({ color: darken(roofColor, 0.6), width: 0.5 });
  }

  // 塔刹
  const topY = roofY - layers * 6 * s;
  g.moveTo(x, topY)
    .lineTo(x, topY - 5 * s)
    .stroke({ width: 1 * s, color: 0xffd700 });
  g.circle(x, topY - 5 * s, 1.5 * s)
    .fill({ color: 0xffd700 });
}

/**
 * 获取建筑配置
 *
 * @param buildingType - 建筑类型
 * @returns 建筑配置，未找到时返回默认民居配置
 */
export function getBuildingConfig(buildingType: string): ChineseBuildingConfig {
  return BUILDING_CONFIGS[buildingType] ?? BUILDING_CONFIGS.residence;
}
