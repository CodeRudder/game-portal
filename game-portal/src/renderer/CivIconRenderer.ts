/**
 * renderer/CivIconRenderer.ts — 文明专属图标绘制器
 *
 * 使用 PixiJS Graphics API 程序化绘制文明特色图标。
 * 每个文明 8-10 个独特图标（建筑、单位、资源、科技）。
 * 无需任何图片资源，全部通过几何图形组合实现。
 *
 * 支持的文明：
 * - civ-china  (华夏) — 朱红+金色主题
 * - civ-egypt  (埃及) — 沙金+蓝色主题
 * - civ-babylon(巴比伦) — 青铜+紫色主题
 * - civ-india  (印度) — 翠绿+橙色主题
 *
 * @module renderer/CivIconRenderer
 */

import { Container, Graphics } from 'pixi.js';

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 文明 ID 类型 */
export type CivilizationId = 'civ-china' | 'civ-egypt' | 'civ-babylon' | 'civ-india';

/** 图标类别 */
export type IconCategory = 'building' | 'unit' | 'resource' | 'tech';

/** 图标定义 */
export interface IconDef {
  /** 图标 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 类别 */
  category: IconCategory;
}

/** 文明主题色 */
export interface CivThemeColors {
  /** 主色 */
  primary: number;
  /** 次色 */
  secondary: number;
  /** 强调色 */
  accent: number;
  /** 背景色 */
  bg: number;
  /** 文字色 */
  text: number;
}

// ═══════════════════════════════════════════════════════════════
// 文明主题色配置
// ═══════════════════════════════════════════════════════════════

const CIV_THEMES: Record<CivilizationId, CivThemeColors> = {
  'civ-china': {
    primary: 0xcc2936,    // 朱红
    secondary: 0xffd700,  // 金色
    accent: 0x8b0000,     // 深红
    bg: 0x1a0a0a,         // 深红底
    text: 0xfff0d0,       // 米白
  },
  'civ-egypt': {
    primary: 0xdaa520,    // 沙金
    secondary: 0x1e90ff,  // 蓝色
    accent: 0xb8860b,     // 深金
    bg: 0x1a1500,         // 深沙底
    text: 0xf0e6d3,       // 沙白
  },
  'civ-babylon': {
    primary: 0xcd7f32,    // 青铜
    secondary: 0x9370db,  // 紫色
    accent: 0x8b5a2b,     // 深铜
    bg: 0x150a1a,         // 深紫底
    text: 0xe8d0c8,       // 暖白
  },
  'civ-india': {
    primary: 0x2e8b57,    // 翠绿
    secondary: 0xff8c00,  // 橙色
    accent: 0x006400,     // 深绿
    bg: 0x0a1a0a,         // 深绿底
    text: 0xf0f8e8,       // 淡绿白
  },
};

// ═══════════════════════════════════════════════════════════════
// 图标定义表
// ═══════════════════════════════════════════════════════════════

const CIV_ICONS: Record<CivilizationId, IconDef[]> = {
  'civ-china': [
    { id: 'farm', name: '农田', category: 'building' },
    { id: 'silk_workshop', name: '丝绸坊', category: 'building' },
    { id: 'academy', name: '书院', category: 'building' },
    { id: 'great_wall', name: '长城', category: 'building' },
    { id: 'silk_road', name: '丝绸之路', category: 'building' },
    { id: 'imperial_palace', name: '皇宫', category: 'building' },
    { id: 'food', name: '粮食', category: 'resource' },
    { id: 'silk', name: '丝绸', category: 'resource' },
    { id: 'culture', name: '文化', category: 'resource' },
    { id: 'official', name: '官员', category: 'unit' },
  ],
  'civ-egypt': [
    { id: 'pyramid', name: '金字塔', category: 'building' },
    { id: 'obelisk', name: '方尖碑', category: 'building' },
    { id: 'sphinx', name: '狮身人面像', category: 'building' },
    { id: 'temple', name: '神庙', category: 'building' },
    { id: 'nile', name: '尼罗河', category: 'building' },
    { id: 'tomb', name: '陵墓', category: 'building' },
    { id: 'grain', name: '谷物', category: 'resource' },
    { id: 'gold', name: '黄金', category: 'resource' },
    { id: 'papyrus', name: '纸莎草', category: 'resource' },
    { id: 'pharaoh', name: '法老', category: 'unit' },
  ],
  'civ-babylon': [
    { id: 'hanging_gardens', name: '空中花园', category: 'building' },
    { id: 'gate', name: '伊什塔尔门', category: 'building' },
    { id: 'ziggurat', name: '金字形神塔', category: 'building' },
    { id: 'library', name: '图书馆', category: 'building' },
    { id: 'walls', name: '城墙', category: 'building' },
    { id: 'canal', name: '运河', category: 'building' },
    { id: 'clay', name: '粘土', category: 'resource' },
    { id: 'bronze', name: '青铜', category: 'resource' },
    { id: 'knowledge', name: '知识', category: 'resource' },
    { id: 'warrior', name: '战士', category: 'unit' },
  ],
  'civ-india': [
    { id: 'taj_mahal', name: '泰姬陵', category: 'building' },
    { id: 'temple', name: '寺庙', category: 'building' },
    { id: 'stepwell', name: '阶梯井', category: 'building' },
    { id: 'fort', name: '堡垒', category: 'building' },
    { id: 'market', name: '市场', category: 'building' },
    { id: 'palace', name: '宫殿', category: 'building' },
    { id: 'spice', name: '香料', category: 'resource' },
    { id: 'cotton', name: '棉花', category: 'resource' },
    { id: 'faith', name: '信仰', category: 'resource' },
    { id: 'elephant', name: '战象', category: 'unit' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

/** 绘制三角屋顶 */
function drawRoof(g: Graphics, x: number, y: number, w: number, h: number, color: number): void {
  g.moveTo(x, y);
  g.lineTo(x + w / 2, y - h);
  g.lineTo(x + w, y);
  g.closePath();
  g.fill(color);
}

/** 绘制中国式飞檐屋顶 */
function drawChineseRoof(g: Graphics, x: number, y: number, w: number, h: number, color: number): void {
  g.moveTo(x - w * 0.1, y);
  g.quadraticCurveTo(x + w * 0.25, y - h * 1.2, x + w / 2, y - h);
  g.quadraticCurveTo(x + w * 0.75, y - h * 1.2, x + w * 1.1, y);
  g.closePath();
  g.fill(color);
}

/** 绘制柱子 */
function drawPillar(g: Graphics, x: number, y: number, w: number, h: number, color: number): void {
  g.rect(x, y, w, h);
  g.fill(color);
}

// ═══════════════════════════════════════════════════════════════
// 华夏图标绘制
// ═══════════════════════════════════════════════════════════════

function drawChinaIcon(g: Graphics, iconId: string, size: number, colors: CivThemeColors): void {
  const s = size;
  const p = 2; // padding

  switch (iconId) {
    case 'farm': {
      // 田地：4块田
      const hw = (s - p * 3) / 2;
      const hh = (s - p * 3) / 2;
      g.rect(p, p, hw, hh);
      g.fill(colors.primary);
      g.rect(p * 2 + hw, p, hw, hh);
      g.fill(0x228b22);
      g.rect(p, p * 2 + hh, hw, hh);
      g.fill(0x228b22);
      g.rect(p * 2 + hw, p * 2 + hh, hw, hh);
      g.fill(colors.primary);
      break;
    }
    case 'silk_workshop': {
      // 丝绸坊：织布机形状
      g.rect(p + 4, p + 2, s - p * 2 - 8, s * 0.3);
      g.fill(colors.secondary);
      drawPillar(g, p + 4, p + s * 0.35, 3, s * 0.5, colors.primary);
      drawPillar(g, s - p - 7, p + s * 0.35, 3, s * 0.5, colors.primary);
      // 横线（丝线）
      for (let i = 0; i < 3; i++) {
        const ly = p + s * 0.4 + i * (s * 0.15);
        g.moveTo(p + 8, ly);
        g.lineTo(s - p - 8, ly);
        g.stroke({ color: colors.secondary, width: 1 });
      }
      break;
    }
    case 'academy': {
      // 书院：飞檐屋顶 + 两柱
      drawChineseRoof(g, p, p + s * 0.3, s - p * 2, s * 0.25, colors.primary);
      drawPillar(g, p + 4, p + s * 0.35, 4, s * 0.55, colors.accent);
      drawPillar(g, s - p - 8, p + s * 0.35, 4, s * 0.55, colors.accent);
      g.rect(p, s - p - 3, s - p * 2, 3);
      g.fill(colors.primary);
      break;
    }
    case 'great_wall': {
      // 长城：锯齿城垛
      const bw = (s - p * 2) / 5;
      const bh = s * 0.3;
      for (let i = 0; i < 5; i++) {
        const bx = p + i * bw;
        g.rect(bx, p, bw - 1, bh);
        g.fill(colors.primary);
      }
      // 墙体
      g.rect(p, p + bh, s - p * 2, s * 0.5);
      g.fill(colors.accent);
      // 门
      g.rect(s / 2 - 4, s - p - s * 0.25, 8, s * 0.25);
      g.fill(0x333333);
      break;
    }
    case 'silk_road': {
      // 丝绸之路：蜿蜒路线
      g.moveTo(p + 2, s - p);
      g.quadraticCurveTo(s * 0.3, s * 0.3, s / 2, s * 0.5);
      g.quadraticCurveTo(s * 0.7, s * 0.7, s - p - 2, p + 2);
      g.stroke({ color: colors.secondary, width: 2 });
      // 驼队点
      g.circle(s * 0.35, s * 0.42, 3);
      g.fill(colors.primary);
      g.circle(s * 0.65, s * 0.55, 3);
      g.fill(colors.primary);
      break;
    }
    case 'imperial_palace': {
      // 皇宫：多层飞檐
      drawChineseRoof(g, p + 4, p + s * 0.15, s - p * 2 - 8, s * 0.15, colors.primary);
      drawChineseRoof(g, p, p + s * 0.35, s - p * 2, s * 0.2, colors.accent);
      g.rect(p + 2, p + s * 0.55, s - p * 2 - 4, s * 0.35);
      g.fill(colors.primary);
      // 门
      g.rect(s / 2 - 5, s - p - s * 0.25, 10, s * 0.25);
      g.fill(colors.secondary);
      break;
    }
    case 'food': {
      // 粮食：稻穗
      g.circle(s / 2, p + 6, 4);
      g.fill(colors.secondary);
      g.circle(s / 2 - 5, p + 12, 3);
      g.fill(colors.secondary);
      g.circle(s / 2 + 5, p + 12, 3);
      g.fill(colors.secondary);
      g.circle(s / 2, p + 18, 3);
      g.fill(colors.secondary);
      // 茎
      g.moveTo(s / 2, p + 20);
      g.lineTo(s / 2, s - p);
      g.stroke({ color: 0x228b22, width: 1.5 });
      break;
    }
    case 'silk': {
      // 丝绸：丝线卷
      g.circle(s / 2, s / 2, s * 0.35);
      g.fill(colors.secondary);
      g.circle(s / 2, s / 2, s * 0.2);
      g.fill(colors.primary);
      g.circle(s / 2, s / 2, s * 0.08);
      g.fill(colors.secondary);
      break;
    }
    case 'culture': {
      // 文化：书卷
      g.roundRect(p + 2, p + 4, s - p * 2 - 4, s * 0.6, 2);
      g.fill(colors.secondary);
      // 书页线条
      for (let i = 0; i < 3; i++) {
        const ly = p + 10 + i * 5;
        g.moveTo(p + 6, ly);
        g.lineTo(s - p - 6, ly);
        g.stroke({ color: colors.accent, width: 0.8 });
      }
      // 卷轴端
      g.circle(p + 2, p + 4, 3);
      g.fill(colors.primary);
      g.circle(s - p - 2, p + 4, 3);
      g.fill(colors.primary);
      break;
    }
    case 'official': {
      // 官员：官帽 + 人形
      // 帽子
      g.ellipse(s / 2, p + 6, 8, 4);
      g.fill(colors.primary);
      g.rect(s / 2 - 5, p + 2, 10, 4);
      g.fill(colors.accent);
      // 身体
      g.moveTo(s / 2 - 6, p + 12);
      g.lineTo(s / 2 + 6, p + 12);
      g.lineTo(s / 2 + 4, s - p - 6);
      g.lineTo(s / 2 - 4, s - p - 6);
      g.closePath();
      g.fill(colors.primary);
      // 腿
      g.rect(s / 2 - 4, s - p - 6, 3, 6);
      g.fill(colors.accent);
      g.rect(s / 2 + 1, s - p - 6, 3, 6);
      g.fill(colors.accent);
      break;
    }
    default: {
      // 默认方块
      g.rect(p, p, s - p * 2, s - p * 2);
      g.fill(colors.primary);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 埃及图标绘制
// ═══════════════════════════════════════════════════════════════

function drawEgyptIcon(g: Graphics, iconId: string, size: number, colors: CivThemeColors): void {
  const s = size;
  const p = 2;

  switch (iconId) {
    case 'pyramid': {
      // 金字塔
      g.moveTo(s / 2, p + 2);
      g.lineTo(s - p - 2, s - p - 2);
      g.lineTo(p + 2, s - p - 2);
      g.closePath();
      g.fill(colors.primary);
      // 内部线
      g.moveTo(s / 2 - 6, s / 2 + 4);
      g.lineTo(s / 2 + 6, s / 2 + 4);
      g.stroke({ color: colors.secondary, width: 1 });
      break;
    }
    case 'obelisk': {
      // 方尖碑
      g.moveTo(s / 2, p + 2);
      g.lineTo(s / 2 + 5, p + 10);
      g.lineTo(s / 2 + 4, s - p - 2);
      g.lineTo(s / 2 - 4, s - p - 2);
      g.lineTo(s / 2 - 5, p + 10);
      g.closePath();
      g.fill(colors.primary);
      // 横纹
      g.moveTo(s / 2 - 3, p + 14);
      g.lineTo(s / 2 + 3, p + 14);
      g.stroke({ color: colors.secondary, width: 1 });
      break;
    }
    case 'sphinx': {
      // 狮身人面像：简化
      // 头
      g.circle(s / 2, p + 8, 6);
      g.fill(colors.primary);
      // 身体（横卧矩形）
      g.rect(p + 2, p + 12, s - p * 2 - 4, s * 0.35);
      g.fill(colors.primary);
      // 前爪
      g.rect(p + 2, p + s * 0.5, 8, 8);
      g.fill(colors.accent);
      break;
    }
    case 'temple': {
      // 神庙：柱廊
      const cols = 4;
      const cw = 4;
      const gap = (s - p * 2 - cols * cw) / (cols - 1);
      for (let i = 0; i < cols; i++) {
        const cx = p + 2 + i * (cw + gap);
        drawPillar(g, cx, p + 6, cw, s * 0.6, colors.primary);
      }
      // 顶部横梁
      g.rect(p, p + 2, s - p * 2, 5);
      g.fill(colors.secondary);
      // 底座
      g.rect(p, s - p - 4, s - p * 2, 4);
      g.fill(colors.accent);
      break;
    }
    case 'nile': {
      // 尼罗河：波浪
      g.moveTo(p, s / 2);
      for (let i = 0; i < 4; i++) {
        const sx = p + (s - p * 2) * (i / 4);
        const ex = p + (s - p * 2) * ((i + 1) / 4);
        const my = i % 2 === 0 ? s * 0.35 : s * 0.65;
        g.quadraticCurveTo((sx + ex) / 2, my, ex, s / 2);
      }
      g.stroke({ color: colors.secondary, width: 2.5 });
      break;
    }
    case 'tomb': {
      // 陵墓：拱门形状
      g.rect(p + 4, s / 2, s - p * 2 - 8, s / 2 - p - 2);
      g.fill(colors.primary);
      g.ellipse(s / 2, s / 2, (s - p * 2 - 8) / 2, s * 0.25);
      g.fill(colors.primary);
      // 门
      g.ellipse(s / 2, s - p - 8, 4, 8);
      g.fill(0x333333);
      break;
    }
    case 'grain': {
      // 谷物
      g.circle(s / 2, p + 5, 3);
      g.fill(colors.primary);
      g.circle(s / 2 - 4, p + 12, 2.5);
      g.fill(colors.primary);
      g.circle(s / 2 + 4, p + 12, 2.5);
      g.fill(colors.primary);
      g.moveTo(s / 2, p + 8);
      g.lineTo(s / 2, s - p);
      g.stroke({ color: 0xdaa520, width: 1.5 });
      break;
    }
    case 'gold': {
      // 黄金：金锭
      g.moveTo(s / 2, p + 4);
      g.lineTo(s - p - 4, p + s * 0.4);
      g.lineTo(s - p - 2, s - p - 2);
      g.lineTo(p + 2, s - p - 2);
      g.lineTo(p + 4, p + s * 0.4);
      g.closePath();
      g.fill(colors.primary);
      g.stroke({ color: colors.secondary, width: 1 });
      break;
    }
    case 'papyrus': {
      // 纸莎草：卷轴
      g.roundRect(p + 4, p + 2, s - p * 2 - 8, s - p * 2 - 4, 3);
      g.fill(colors.secondary);
      for (let i = 0; i < 4; i++) {
        const ly = p + 6 + i * 5;
        g.moveTo(p + 8, ly);
        g.lineTo(s - p - 8, ly);
        g.stroke({ color: colors.accent, width: 0.7 });
      }
      break;
    }
    case 'pharaoh': {
      // 法老：王冠 + 人形
      // 王冠
      g.moveTo(s / 2 - 6, p + 6);
      g.lineTo(s / 2, p);
      g.lineTo(s / 2 + 6, p + 6);
      g.closePath();
      g.fill(colors.secondary);
      g.rect(s / 2 - 6, p + 4, 12, 4);
      g.fill(colors.primary);
      // 身体
      g.moveTo(s / 2 - 5, p + 10);
      g.lineTo(s / 2 + 5, p + 10);
      g.lineTo(s / 2 + 3, s - p - 4);
      g.lineTo(s / 2 - 3, s - p - 4);
      g.closePath();
      g.fill(colors.primary);
      break;
    }
    default: {
      g.rect(p, p, s - p * 2, s - p * 2);
      g.fill(colors.primary);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 巴比伦图标绘制
// ═══════════════════════════════════════════════════════════════

function drawBabylonIcon(g: Graphics, iconId: string, size: number, colors: CivThemeColors): void {
  const s = size;
  const p = 2;

  switch (iconId) {
    case 'hanging_gardens': {
      // 空中花园：层叠平台 + 植物
      for (let i = 0; i < 3; i++) {
        const lw = s - p * 2 - i * 6;
        const lx = p + i * 3;
        const ly = p + 4 + i * (s * 0.25);
        g.rect(lx, ly, lw, s * 0.15);
        g.fill(colors.primary);
        // 植物点
        g.circle(lx + lw / 2, ly - 3, 3);
        g.fill(0x228b22);
      }
      break;
    }
    case 'gate': {
      // 伊什塔尔门：拱门
      g.rect(p, p, s - p * 2, s - p * 2);
      g.fill(colors.primary);
      // 拱门开口
      g.moveTo(s / 2 - 6, s - p);
      g.lineTo(s / 2 - 6, s * 0.4);
      g.quadraticCurveTo(s / 2, p + 4, s / 2 + 6, s * 0.4);
      g.lineTo(s / 2 + 6, s - p);
      g.closePath();
      g.fill(0x333333);
      // 装饰
      g.circle(s / 2, s * 0.35, 2);
      g.fill(colors.secondary);
      break;
    }
    case 'ziggurat': {
      // 金字形神塔：阶梯金字塔
      for (let i = 0; i < 4; i++) {
        const lw = s - p * 2 - i * 6;
        const lx = p + i * 3;
        const ly = s - p - (i + 1) * (s * 0.2);
        g.rect(lx, ly, lw, s * 0.18);
        g.fill(i % 2 === 0 ? colors.primary : colors.accent);
      }
      break;
    }
    case 'library': {
      // 图书馆：书架
      g.rect(p + 2, p + 2, s - p * 2 - 4, s - p * 2 - 4);
      g.fill(colors.accent);
      // 书架隔板
      for (let i = 0; i < 3; i++) {
        const sy = p + 4 + i * (s * 0.25);
        g.moveTo(p + 4, sy + 6);
        g.lineTo(s - p - 4, sy + 6);
        g.stroke({ color: colors.primary, width: 1 });
        // 书本
        for (let j = 0; j < 3; j++) {
          g.rect(p + 5 + j * 8, sy + 1, 5, 5);
          g.fill(colors.secondary);
        }
      }
      break;
    }
    case 'walls': {
      // 城墙：城垛
      const bw = (s - p * 2) / 4;
      for (let i = 0; i < 4; i++) {
        const bx = p + i * bw;
        g.rect(bx, p, bw - 1, s * 0.35);
        g.fill(colors.primary);
      }
      g.rect(p, p + s * 0.35, s - p * 2, s * 0.5);
      g.fill(colors.accent);
      break;
    }
    case 'canal': {
      // 运河：水道
      g.rect(p, s * 0.3, s - p * 2, s * 0.4);
      g.fill(colors.secondary);
      // 波纹
      g.moveTo(p + 2, s * 0.45);
      g.lineTo(s - p - 2, s * 0.45);
      g.stroke({ color: 0x4488ff, width: 1 });
      g.moveTo(p + 2, s * 0.55);
      g.lineTo(s - p - 2, s * 0.55);
      g.stroke({ color: 0x4488ff, width: 1 });
      // 两岸
      g.rect(p, p, s - p * 2, s * 0.25);
      g.fill(colors.primary);
      g.rect(p, s * 0.75, s - p * 2, s * 0.2);
      g.fill(colors.primary);
      break;
    }
    case 'clay': {
      // 粘土：泥板
      g.roundRect(p + 2, p + 2, s - p * 2 - 4, s - p * 2 - 4, 4);
      g.fill(colors.primary);
      // 楔形文字标记
      g.moveTo(s / 2 - 4, s / 2 - 3);
      g.lineTo(s / 2 + 4, s / 2 - 3);
      g.stroke({ color: colors.secondary, width: 1 });
      g.moveTo(s / 2 - 3, s / 2 + 2);
      g.lineTo(s / 2 + 3, s / 2 + 2);
      g.stroke({ color: colors.secondary, width: 1 });
      break;
    }
    case 'bronze': {
      // 青铜：锭
      g.moveTo(s / 2, p + 4);
      g.lineTo(s - p - 4, s * 0.35);
      g.lineTo(s - p - 2, s - p - 2);
      g.lineTo(p + 2, s - p - 2);
      g.lineTo(p + 4, s * 0.35);
      g.closePath();
      g.fill(colors.primary);
      g.stroke({ color: colors.secondary, width: 1 });
      break;
    }
    case 'knowledge': {
      // 知识：星形
      const cx = s / 2;
      const cy = s / 2;
      const outerR = s * 0.35;
      const innerR = s * 0.15;
      const points = 6;
      g.moveTo(cx + outerR, cy);
      for (let i = 1; i <= points * 2; i++) {
        const angle = (Math.PI * i) / points;
        const r = i % 2 === 0 ? outerR : innerR;
        g.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      }
      g.closePath();
      g.fill(colors.secondary);
      break;
    }
    case 'warrior': {
      // 战士：盾牌 + 矛
      // 盾牌
      g.moveTo(s / 2, p + 2);
      g.lineTo(s - p - 4, p + 8);
      g.lineTo(s - p - 4, s * 0.6);
      g.lineTo(s / 2, s - p - 2);
      g.lineTo(p + 4, s * 0.6);
      g.lineTo(p + 4, p + 8);
      g.closePath();
      g.fill(colors.primary);
      // 矛
      g.moveTo(s * 0.7, p);
      g.lineTo(s * 0.7, s - p);
      g.stroke({ color: colors.secondary, width: 2 });
      break;
    }
    default: {
      g.rect(p, p, s - p * 2, s - p * 2);
      g.fill(colors.primary);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 印度图标绘制
// ═══════════════════════════════════════════════════════════════

function drawIndiaIcon(g: Graphics, iconId: string, size: number, colors: CivThemeColors): void {
  const s = size;
  const p = 2;

  switch (iconId) {
    case 'taj_mahal': {
      // 泰姬陵：圆顶 + 主体
      // 圆顶
      g.ellipse(s / 2, p + 8, 8, 8);
      g.fill(0xffffff);
      // 尖顶
      g.moveTo(s / 2, p);
      g.lineTo(s / 2 - 2, p + 4);
      g.lineTo(s / 2 + 2, p + 4);
      g.closePath();
      g.fill(colors.secondary);
      // 主体
      g.rect(p + 4, p + 14, s - p * 2 - 8, s * 0.5);
      g.fill(0xf0f0f0);
      // 门
      g.ellipse(s / 2, s - p - 6, 4, 8);
      g.fill(colors.primary);
      break;
    }
    case 'temple': {
      // 寺庙：塔形
      for (let i = 0; i < 4; i++) {
        const lw = s - p * 2 - i * 5;
        const lx = p + i * 2.5;
        const ly = s - p - (i + 1) * (s * 0.2);
        g.rect(lx, ly, lw, s * 0.18);
        g.fill(i % 2 === 0 ? colors.primary : colors.secondary);
      }
      // 顶部三角
      g.moveTo(s / 2, p);
      g.lineTo(s / 2 + 5, p + 8);
      g.lineTo(s / 2 - 5, p + 8);
      g.closePath();
      g.fill(colors.secondary);
      break;
    }
    case 'stepwell': {
      // 阶梯井：倒阶梯
      for (let i = 0; i < 4; i++) {
        const lw = s - p * 2 - i * 6;
        const lx = p + i * 3;
        const ly = p + 2 + i * (s * 0.18);
        g.rect(lx, ly, lw, s * 0.15);
        g.fill(colors.primary);
      }
      // 水面
      g.rect(p + 12, s * 0.7, s - p * 2 - 24, s * 0.2);
      g.fill(colors.secondary);
      break;
    }
    case 'fort': {
      // 堡垒：城墙 + 塔楼
      g.rect(p, p + s * 0.3, s - p * 2, s * 0.6);
      g.fill(colors.primary);
      // 塔楼
      g.rect(p, p, 8, s * 0.4);
      g.fill(colors.accent);
      g.rect(s - p - 8, p, 8, s * 0.4);
      g.fill(colors.accent);
      // 门
      g.ellipse(s / 2, s - p - 4, 4, 6);
      g.fill(0x333333);
      break;
    }
    case 'market': {
      // 市场：帐篷 + 货物
      drawRoof(g, p + 2, p + 8, s - p * 2 - 4, 10, colors.secondary);
      g.rect(p + 4, p + 10, s - p * 2 - 8, s * 0.5);
      g.fill(colors.primary);
      // 货物点
      g.circle(p + 8, p + 18, 3);
      g.fill(colors.secondary);
      g.circle(s / 2, p + 18, 3);
      g.fill(0xff6347);
      g.circle(s - p - 8, p + 18, 3);
      g.fill(colors.secondary);
      break;
    }
    case 'palace': {
      // 宫殿：圆顶 + 柱廊
      g.ellipse(s / 2, p + 10, 10, 8);
      g.fill(colors.secondary);
      const cols = 4;
      const cw = 3;
      const gap = (s - p * 2 - cols * cw) / (cols - 1);
      for (let i = 0; i < cols; i++) {
        const cx = p + 2 + i * (cw + gap);
        drawPillar(g, cx, p + 18, cw, s * 0.4, colors.primary);
      }
      g.rect(p, s - p - 6, s - p * 2, 6);
      g.fill(colors.accent);
      break;
    }
    case 'spice': {
      // 香料：叶子 + 碗
      g.ellipse(s / 2, s / 2 + 4, 10, 6);
      g.fill(colors.primary);
      g.ellipse(s / 2, s / 2, 8, 4);
      g.fill(colors.secondary);
      // 叶子
      g.ellipse(s / 2 + 6, p + 6, 4, 6);
      g.fill(0x228b22);
      break;
    }
    case 'cotton': {
      // 棉花：云朵形
      g.circle(s / 2 - 4, s / 2, 6);
      g.fill(0xffffff);
      g.circle(s / 2 + 4, s / 2, 6);
      g.fill(0xffffff);
      g.circle(s / 2, s / 2 - 4, 6);
      g.fill(0xffffff);
      g.rect(p + 4, s / 2, s - p * 2 - 8, s * 0.25);
      g.fill(0xeeeeee);
      break;
    }
    case 'faith': {
      // 信仰：莲花
      const cx = s / 2;
      const cy = s / 2;
      // 花瓣
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        g.ellipse(
          cx + Math.cos(angle) * 6,
          cy + Math.sin(angle) * 6,
          4, 6,
        );
        g.fill(colors.primary);
      }
      // 花心
      g.circle(cx, cy, 3);
      g.fill(colors.secondary);
      break;
    }
    case 'elephant': {
      // 战象：简化象形
      // 身体
      g.ellipse(s / 2, s / 2 + 2, 10, 8);
      g.fill(0x808080);
      // 头
      g.circle(s / 2 + 8, s / 2 - 4, 5);
      g.fill(0x909090);
      // 象鼻
      g.moveTo(s / 2 + 12, s / 2 - 2);
      g.quadraticCurveTo(s / 2 + 14, s / 2 + 8, s / 2 + 10, s / 2 + 12);
      g.stroke({ color: 0x808080, width: 2 });
      // 象牙
      g.moveTo(s / 2 + 10, s / 2);
      g.lineTo(s / 2 + 12, s / 2 + 6);
      g.stroke({ color: 0xffffff, width: 1.5 });
      break;
    }
    default: {
      g.rect(p, p, s - p * 2, s - p * 2);
      g.fill(colors.primary);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 绘制函数映射
// ═══════════════════════════════════════════════════════════════

const DRAW_MAP: Record<CivilizationId, (g: Graphics, id: string, s: number, c: CivThemeColors) => void> = {
  'civ-china': drawChinaIcon,
  'civ-egypt': drawEgyptIcon,
  'civ-babylon': drawBabylonIcon,
  'civ-india': drawIndiaIcon,
};

// ═══════════════════════════════════════════════════════════════
// CivIconRenderer 类
// ═══════════════════════════════════════════════════════════════

/**
 * 文明专属图标绘制器
 *
 * 使用 PixiJS Graphics 程序化绘制文明特色图标。
 * 支持四种文明，每种 10 个独特图标。
 *
 * @example
 * ```ts
 * const renderer = new CivIconRenderer('civ-china');
 * const iconContainer = renderer.drawIcon('farm', 32);
 * someContainer.addChild(iconContainer);
 * ```
 */
export class CivIconRenderer {
  /** 文明 ID */
  private civId: CivilizationId;
  /** 主题色 */
  private colors: CivThemeColors;
  /** 图标缓存 */
  private cache: Map<string, Container> = new Map();

  constructor(civId: CivilizationId) {
    this.civId = civId;
    this.colors = CIV_THEMES[civId];
  }

  /**
   * 绘制指定图标
   *
   * @param iconId - 图标 ID（如 'farm', 'pyramid'）
   * @param size - 图标尺寸（正方形边长）
   * @returns 包含图标的 Container
   */
  drawIcon(iconId: string, size: number = 32): Container {
    const key = `${iconId}_${size}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const container = new Container({ label: `civ-icon-${iconId}` });
    const g = new Graphics();
    DRAW_MAP[this.civId](g, iconId, size, this.colors);
    container.addChild(g);

    this.cache.set(key, container);
    return container;
  }

  /**
   * 获取当前文明的所有图标定义
   */
  getIconDefs(): IconDef[] {
    return CIV_ICONS[this.civId] ?? [];
  }

  /**
   * 获取指定类别的图标
   */
  getIconsByCategory(category: IconCategory): IconDef[] {
    return this.getIconDefs().filter((d) => d.category === category);
  }

  /**
   * 获取当前文明的主题色
   */
  getThemeColors(): CivThemeColors {
    return { ...this.colors };
  }

  /**
   * 获取文明 ID
   */
  getCivId(): CivilizationId {
    return this.civId;
  }

  /**
   * 检查图标是否存在
   */
  hasIcon(iconId: string): boolean {
    return this.getIconDefs().some((d) => d.id === iconId);
  }

  /**
   * 获取所有已注册的文明 ID
   */
  static getRegisteredCivIds(): CivilizationId[] {
    return Object.keys(CIV_THEMES) as CivilizationId[];
  }

  /**
   * 获取指定文明的所有图标定义（静态方法）
   */
  static getIconDefs(civId: CivilizationId): IconDef[] {
    return CIV_ICONS[civId] ?? [];
  }

  /**
   * 获取指定文明的主题色（静态方法）
   */
  static getThemeColors(civId: CivilizationId): CivThemeColors {
    return { ...CIV_THEMES[civId] };
  }

  /**
   * 清除图标缓存
   */
  clearCache(): void {
    this.cache.forEach((container) => {
      container.destroy();
    });
    this.cache.clear();
  }

  /**
   * 销毁渲染器
   */
  destroy(): void {
    this.clearCache();
  }
}
