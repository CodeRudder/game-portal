/**
 * renderer/StrategyIconRenderer.ts — 策略游戏程序化图标绘制器
 *
 * 使用 PixiJS Graphics API 程序化绘制策略游戏所需的各类图标。
 * 无需真实图片资源，全部通过几何图形组合实现。
 *
 * 支持的图标类别：
 * - 军事图标：sword（剑）、shield（盾）、bow（弓）、horse（马）、tower（塔）
 * - 资源图标：wood（木材）、stone（石头）、food（粮食）、gold（金矿）
 * - 建筑图标：barracks（兵营）、market（市场）、castle（城堡）、wall（城墙）
 *
 * @module renderer/StrategyIconRenderer
 */

import { Container, Graphics } from 'pixi.js';

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 军事图标类型 */
export type MilitaryIconType = 'sword' | 'shield' | 'bow' | 'horse' | 'tower';

/** 资源图标类型 */
export type ResourceIconType = 'wood' | 'stone' | 'food' | 'gold';

/** 建筑图标类型 */
export type BuildingIconType = 'barracks' | 'market' | 'castle' | 'wall';

/** 所有支持的图标类型 */
export type StrategyIconType = MilitaryIconType | ResourceIconType | BuildingIconType;

/** 图标绘制配置 */
export interface IconDrawConfig {
  /** 图标尺寸（宽高相等，默认 24） */
  size?: number;
  /** 主颜色（十六进制字符串，如 '#ff0000'） */
  color?: string;
  /** 次要颜色（用于细节，如 '#880000'） */
  secondaryColor?: string;
  /** 背景色（可选，不填则透明） */
  backgroundColor?: string;
  /** 描边颜色 */
  strokeColor?: string;
  /** 描边宽度 */
  strokeWidth?: number;
}

/** 默认绘制配置 */
const DEFAULT_CONFIG: Required<Omit<IconDrawConfig, 'backgroundColor'>> = {
  size: 24,
  color: '#ffffff',
  secondaryColor: '#888888',
  strokeColor: '#000000',
  strokeWidth: 1,
};

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

/** 十六进制颜色字符串转数值 */
function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** 合并配置 */
function mergeConfig(config?: IconDrawConfig): Required<Omit<IconDrawConfig, 'backgroundColor'>> & { backgroundColor?: string } {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    backgroundColor: config?.backgroundColor,
  };
}

// ═══════════════════════════════════════════════════════════════
// StrategyIconRenderer 类
// ═══════════════════════════════════════════════════════════════

/**
 * 策略游戏图标绘制器
 *
 * 使用 PixiJS Graphics API 程序化绘制各类策略游戏图标。
 * 所有方法返回包含绘制结果的 Container。
 */
export class StrategyIconRenderer {
  /** 已绘制的图标缓存（用于复用） */
  private cache: Map<string, Container> = new Map();

  // ═══════════════════════════════════════════════════════════
  // 公共 API
  // ═══════════════════════════════════════════════════════════

  /**
   * 绘制指定类型的图标
   *
   * @param type - 图标类型
   * @param config - 绘制配置
   * @returns 包含图标的 Container
   */
  drawIcon(type: StrategyIconType, config?: IconDrawConfig): Container {
    const cfg = mergeConfig(config);
    const container = new Container({ label: `icon-${type}` });

    const g = new Graphics();
    container.addChild(g);

    // 绘制背景（如果指定）
    if (cfg.backgroundColor) {
      g.roundRect(0, 0, cfg.size, cfg.size, 3);
      g.fill(hexToNum(cfg.backgroundColor));
    }

    // 根据类型分发绘制
    switch (type) {
      // 军事图标
      case 'sword':
        this.drawSword(g, cfg);
        break;
      case 'shield':
        this.drawShield(g, cfg);
        break;
      case 'bow':
        this.drawBow(g, cfg);
        break;
      case 'horse':
        this.drawHorse(g, cfg);
        break;
      case 'tower':
        this.drawTower(g, cfg);
        break;
      // 资源图标
      case 'wood':
        this.drawWood(g, cfg);
        break;
      case 'stone':
        this.drawStone(g, cfg);
        break;
      case 'food':
        this.drawFood(g, cfg);
        break;
      case 'gold':
        this.drawGold(g, cfg);
        break;
      // 建筑图标
      case 'barracks':
        this.drawBarracks(g, cfg);
        break;
      case 'market':
        this.drawMarket(g, cfg);
        break;
      case 'castle':
        this.drawCastle(g, cfg);
        break;
      case 'wall':
        this.drawWall(g, cfg);
        break;
    }

    return container;
  }

  /**
   * 绘制带缓存的图标
   *
   * 相同 type + config 会返回缓存的 Container 克隆。
   */
  drawCachedIcon(type: StrategyIconType, config?: IconDrawConfig): Container {
    const cacheKey = `${type}-${JSON.stringify(config ?? {})}`;
    if (this.cache.has(cacheKey)) {
      // 返回新的容器引用（避免共享状态）
      const cached = this.cache.get(cacheKey)!;
      const clone = new Container({ label: `icon-${type}-cached` });
      const g = new Graphics();
      clone.addChild(g);
      // 复制缓存的绘制操作（简化：直接重新绘制）
      return this.drawIcon(type, config);
    }

    const icon = this.drawIcon(type, config);
    this.cache.set(cacheKey, icon);
    return icon;
  }

  /**
   * 清除图标缓存
   */
  clearCache(): void {
    this.cache.forEach((container) => container.destroy());
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * 获取所有支持的图标类型
   */
  static getSupportedTypes(): StrategyIconType[] {
    return [
      'sword', 'shield', 'bow', 'horse', 'tower',
      'wood', 'stone', 'food', 'gold',
      'barracks', 'market', 'castle', 'wall',
    ];
  }

  /**
   * 获取军事图标类型列表
   */
  static getMilitaryTypes(): MilitaryIconType[] {
    return ['sword', 'shield', 'bow', 'horse', 'tower'];
  }

  /**
   * 获取资源图标类型列表
   */
  static getResourceTypes(): ResourceIconType[] {
    return ['wood', 'stone', 'food', 'gold'];
  }

  /**
   * 获取建筑图标类型列表
   */
  static getBuildingTypes(): BuildingIconType[] {
    return ['barracks', 'market', 'castle', 'wall'];
  }

  /**
   * 销毁渲染器
   */
  destroy(): void {
    this.clearCache();
  }

  // ═══════════════════════════════════════════════════════════
  // 军事图标绘制
  // ═══════════════════════════════════════════════════════════

  /** 绘制剑图标 */
  private drawSword(g: Graphics, cfg: Required<Omit<IconDrawConfig, 'backgroundColor'>> & { backgroundColor?: string }): void {
    const s = cfg.size;
    const sw = cfg.strokeWidth;
    const color = hexToNum(cfg.color);
    const secColor = hexToNum(cfg.secondaryColor);

    // 剑身（竖直长方形）
    const bladeW = s * 0.12;
    const bladeH = s * 0.65;
    const bladeX = (s - bladeW) / 2;
    const bladeY = s * 0.05;
    g.rect(bladeX, bladeY, bladeW, bladeH);
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 剑尖（三角形）
    g.moveTo(bladeX, bladeY);
    g.lineTo(s / 2, 0);
    g.lineTo(bladeX + bladeW, bladeY);
    g.closePath();
    g.fill(color);

    // 护手（横条）
    const guardY = bladeY + bladeH;
    const guardW = s * 0.4;
    const guardH = s * 0.06;
    g.rect((s - guardW) / 2, guardY, guardW, guardH);
    g.fill(secColor);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 剑柄
    const handleW = s * 0.08;
    const handleH = s * 0.2;
    g.rect((s - handleW) / 2, guardY + guardH, handleW, handleH);
    g.fill(secColor);

    // 剑柄底部圆球
    const pommelR = s * 0.06;
    g.circle(s / 2, guardY + guardH + handleH + pommelR, pommelR);
    g.fill(secColor);
  }

  /** 绘制盾牌图标 */
  private drawShield(g: Graphics, cfg: Required<Omit<IconDrawConfig, 'backgroundColor'>> & { backgroundColor?: string }): void {
    const s = cfg.size;
    const color = hexToNum(cfg.color);
    const secColor = hexToNum(cfg.secondaryColor);
    const sw = cfg.strokeWidth;
    const cx = s / 2;

    // 盾牌外形（上方矩形 + 下方三角形）
    const top = s * 0.08;
    const w = s * 0.7;
    const midY = s * 0.55;
    const bottomY = s * 0.92;

    g.moveTo(cx - w / 2, top);
    g.lineTo(cx + w / 2, top);
    g.lineTo(cx + w / 2, midY);
    g.lineTo(cx, bottomY);
    g.lineTo(cx - w / 2, midY);
    g.closePath();
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 盾牌中心横条装饰
    const barH = s * 0.06;
    g.rect(cx - w / 2 + 2, midY - barH / 2, w - 4, barH);
    g.fill(secColor);

    // 盾牌中心竖条装饰
    const barW = s * 0.08;
    g.rect(cx - barW / 2, top + 2, barW, midY - top - 4);
    g.fill(secColor);

    // 中心圆点
    g.circle(cx, midY, s * 0.06);
    g.fill(secColor);
  }

  /** 绘制弓图标 */
  private drawBow(g: Graphics, cfg: Required<Omit<IconDrawConfig, 'backgroundColor'>> & { backgroundColor?: string }): void {
    const s = cfg.size;
    const color = hexToNum(cfg.color);
    const secColor = hexToNum(cfg.secondaryColor);
    const sw = cfg.strokeWidth;

    // 弓臂（弧形）
    const cx = s * 0.35;
    const cy = s / 2;
    const rx = s * 0.2;
    const ry = s * 0.4;

    g.arc(cx, cy, rx, -Math.PI * 0.4, Math.PI * 0.4);
    g.stroke({ color, width: sw + 1 });

    // 弓弦（直线）
    const topY = cy - ry * Math.sin(Math.PI * 0.4);
    const topX = cx + rx * Math.cos(Math.PI * 0.4);
    const botY = cy + ry * Math.sin(Math.PI * 0.4);
    const botX = cx + rx * Math.cos(Math.PI * 0.4);

    g.moveTo(topX, topY);
    g.lineTo(botX, botY);
    g.stroke({ color: secColor, width: sw });

    // 箭矢
    const arrowX = s * 0.55;
    const arrowY1 = s * 0.1;
    const arrowY2 = s * 0.9;

    g.moveTo(arrowX, arrowY1);
    g.lineTo(arrowX, arrowY2);
    g.stroke({ color, width: sw });

    // 箭头
    g.moveTo(arrowX - s * 0.06, arrowY1 + s * 0.08);
    g.lineTo(arrowX, arrowY1);
    g.lineTo(arrowX + s * 0.06, arrowY1 + s * 0.08);
    g.closePath();
    g.fill(color);

    // 箭羽
    g.moveTo(arrowX, arrowY2);
    g.lineTo(arrowX - s * 0.05, arrowY2 + s * 0.06);
    g.moveTo(arrowX, arrowY2);
    g.lineTo(arrowX + s * 0.05, arrowY2 + s * 0.06);
    g.stroke({ color: secColor, width: sw });
  }

  /** 绘制马图标（简化侧面轮廓） */
  private drawHorse(g: Graphics, cfg: Required<Omit<IconDrawConfig, 'backgroundColor'>> & { backgroundColor?: string }): void {
    const s = cfg.size;
    const color = hexToNum(cfg.color);
    const secColor = hexToNum(cfg.secondaryColor);
    const sw = cfg.strokeWidth;

    // 马身体（椭圆）
    g.ellipse(s * 0.45, s * 0.45, s * 0.3, s * 0.18);
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 马头（小圆 + 脖子线条）
    g.ellipse(s * 0.78, s * 0.22, s * 0.1, s * 0.12);
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 脖子
    g.moveTo(s * 0.65, s * 0.32);
    g.lineTo(s * 0.72, s * 0.18);
    g.lineTo(s * 0.82, s * 0.18);
    g.lineTo(s * 0.72, s * 0.35);
    g.closePath();
    g.fill(color);

    // 四条腿
    const legW = s * 0.04;
    const legs = [
      { x: s * 0.25, y: s * 0.6 },
      { x: s * 0.38, y: s * 0.6 },
      { x: s * 0.52, y: s * 0.6 },
      { x: s * 0.65, y: s * 0.6 },
    ];
    for (const leg of legs) {
      g.rect(leg.x, leg.y, legW, s * 0.3);
      g.fill(secColor);
    }

    // 尾巴
    g.moveTo(s * 0.15, s * 0.4);
    g.quadraticCurveTo(s * 0.05, s * 0.35, s * 0.08, s * 0.55);
    g.stroke({ color: secColor, width: sw + 1 });

    // 眼睛
    g.circle(s * 0.82, s * 0.2, s * 0.02);
    g.fill(secColor);
  }

  /** 绘制塔楼图标 */
  private drawTower(g: Graphics, cfg: Required<Omit<IconDrawConfig, 'backgroundColor'>> & { backgroundColor?: string }): void {
    const s = cfg.size;
    const color = hexToNum(cfg.color);
    const secColor = hexToNum(cfg.secondaryColor);
    const sw = cfg.strokeWidth;

    // 主体
    const bodyW = s * 0.5;
    const bodyH = s * 0.55;
    const bodyX = (s - bodyW) / 2;
    const bodyY = s * 0.3;
    g.rect(bodyX, bodyY, bodyW, bodyH);
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 城垛（顶部锯齿）
    const merlonW = s * 0.1;
    const merlonH = s * 0.1;
    const merlonCount = 4;
    const merlonGap = (bodyW - merlonCount * merlonW) / (merlonCount - 1);
    for (let i = 0; i < merlonCount; i++) {
      const mx = bodyX + i * (merlonW + merlonGap);
      g.rect(mx, bodyY - merlonH, merlonW, merlonH);
      g.fill(color);
      g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });
    }

    // 门（拱形）
    const doorW = s * 0.15;
    const doorH = s * 0.2;
    const doorX = (s - doorW) / 2;
    const doorY = bodyY + bodyH - doorH;
    g.rect(doorX, doorY + doorH * 0.3, doorW, doorH * 0.7);
    g.fill(secColor);
    g.arc(doorX + doorW / 2, doorY + doorH * 0.3, doorW / 2, Math.PI, 0, false);
    g.fill(secColor);

    // 窗户
    const winR = s * 0.03;
    g.circle(s * 0.38, s * 0.45, winR);
    g.fill(secColor);
    g.circle(s * 0.62, s * 0.45, winR);
    g.fill(secColor);
  }

  // ═══════════════════════════════════════════════════════════
  // 资源图标绘制
  // ═══════════════════════════════════════════════════════════

  /** 绘制木材图标（交叉原木） */
  private drawWood(g: Graphics, cfg: Required<Omit<IconDrawConfig, 'backgroundColor'>> & { backgroundColor?: string }): void {
    const s = cfg.size;
    const color = hexToNum(cfg.color);
    const secColor = hexToNum(cfg.secondaryColor);
    const sw = cfg.strokeWidth;

    // 原木1（斜向）
    g.moveTo(s * 0.1, s * 0.3);
    g.lineTo(s * 0.9, s * 0.7);
    g.stroke({ color, width: sw + 3 });

    // 原木2（交叉）
    g.moveTo(s * 0.9, s * 0.3);
    g.lineTo(s * 0.1, s * 0.7);
    g.stroke({ color, width: sw + 3 });

    // 中心结
    g.circle(s / 2, s / 2, s * 0.08);
    g.fill(secColor);

    // 年轮
    g.circle(s / 2, s / 2, s * 0.04);
    g.fill(color);
  }

  /** 绘制石头图标（堆叠石块） */
  private drawStone(g: Graphics, cfg: Required<Omit<IconDrawConfig, 'backgroundColor'>> & { backgroundColor?: string }): void {
    const s = cfg.size;
    const color = hexToNum(cfg.color);
    const secColor = hexToNum(cfg.secondaryColor);
    const sw = cfg.strokeWidth;

    // 底部大石块
    g.ellipse(s * 0.5, s * 0.7, s * 0.35, s * 0.2);
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 中间石块
    g.ellipse(s * 0.4, s * 0.45, s * 0.22, s * 0.15);
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 顶部小石块
    g.ellipse(s * 0.55, s * 0.28, s * 0.15, s * 0.12);
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 高光
    g.ellipse(s * 0.45, s * 0.42, s * 0.05, s * 0.03);
    g.fill(secColor);
  }

  /** 绘制粮食图标（麦穗） */
  private drawFood(g: Graphics, cfg: Required<Omit<IconDrawConfig, 'backgroundColor'>> & { backgroundColor?: string }): void {
    const s = cfg.size;
    const color = hexToNum(cfg.color);
    const secColor = hexToNum(cfg.secondaryColor);
    const sw = cfg.strokeWidth;

    // 茎
    g.moveTo(s * 0.5, s * 0.95);
    g.lineTo(s * 0.5, s * 0.35);
    g.stroke({ color: secColor, width: sw + 1 });

    // 麦穗粒（左右对称排列）
    const grainPositions = [
      { y: 0.15, dx: 0.12 },
      { y: 0.22, dx: 0.15 },
      { y: 0.29, dx: 0.13 },
      { y: 0.36, dx: 0.1 },
    ];

    for (const gp of grainPositions) {
      // 左粒
      g.ellipse(s * 0.5 - gp.dx, s * gp.y, s * 0.06, s * 0.04);
      g.fill(color);
      // 右粒
      g.ellipse(s * 0.5 + gp.dx, s * gp.y, s * 0.06, s * 0.04);
      g.fill(color);
    }

    // 顶部穗尖
    g.moveTo(s * 0.5, s * 0.12);
    g.lineTo(s * 0.5, s * 0.02);
    g.stroke({ color, width: sw + 1 });

    // 叶子
    g.moveTo(s * 0.5, s * 0.65);
    g.quadraticCurveTo(s * 0.25, s * 0.55, s * 0.2, s * 0.7);
    g.stroke({ color: secColor, width: sw });

    g.moveTo(s * 0.5, s * 0.75);
    g.quadraticCurveTo(s * 0.75, s * 0.65, s * 0.8, s * 0.8);
    g.stroke({ color: secColor, width: sw });
  }

  /** 绘制金矿图标（金币堆） */
  private drawGold(g: Graphics, cfg: Required<Omit<IconDrawConfig, 'backgroundColor'>> & { backgroundColor?: string }): void {
    const s = cfg.size;
    const color = hexToNum(cfg.color);
    const secColor = hexToNum(cfg.secondaryColor);
    const sw = cfg.strokeWidth;

    // 底部金币
    g.ellipse(s * 0.5, s * 0.75, s * 0.35, s * 0.12);
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 中间金币
    g.ellipse(s * 0.45, s * 0.55, s * 0.3, s * 0.1);
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 顶部金币
    g.ellipse(s * 0.5, s * 0.38, s * 0.25, s * 0.09);
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 闪光符号
    const starX = s * 0.7;
    const starY = s * 0.25;
    const starR = s * 0.06;
    // 十字闪光
    g.moveTo(starX, starY - starR);
    g.lineTo(starX, starY + starR);
    g.stroke({ color: secColor, width: sw });
    g.moveTo(starX - starR, starY);
    g.lineTo(starX + starR, starY);
    g.stroke({ color: secColor, width: sw });
    // 对角闪光
    const dr = starR * 0.6;
    g.moveTo(starX - dr, starY - dr);
    g.lineTo(starX + dr, starY + dr);
    g.stroke({ color: secColor, width: sw });
    g.moveTo(starX + dr, starY - dr);
    g.lineTo(starX - dr, starY + dr);
    g.stroke({ color: secColor, width: sw });
  }

  // ═══════════════════════════════════════════════════════════
  // 建筑图标绘制
  // ═══════════════════════════════════════════════════════════

  /** 绘制兵营图标（帐篷+旗帜） */
  private drawBarracks(g: Graphics, cfg: Required<Omit<IconDrawConfig, 'backgroundColor'>> & { backgroundColor?: string }): void {
    const s = cfg.size;
    const color = hexToNum(cfg.color);
    const secColor = hexToNum(cfg.secondaryColor);
    const sw = cfg.strokeWidth;

    // 帐篷主体（三角形）
    g.moveTo(s * 0.1, s * 0.85);
    g.lineTo(s * 0.5, s * 0.15);
    g.lineTo(s * 0.9, s * 0.85);
    g.closePath();
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 帐篷入口
    g.moveTo(s * 0.35, s * 0.85);
    g.lineTo(s * 0.5, s * 0.5);
    g.lineTo(s * 0.65, s * 0.85);
    g.closePath();
    g.fill(secColor);

    // 旗杆
    g.moveTo(s * 0.5, s * 0.15);
    g.lineTo(s * 0.5, s * 0.02);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 旗帜
    g.moveTo(s * 0.5, s * 0.02);
    g.lineTo(s * 0.75, s * 0.08);
    g.lineTo(s * 0.5, s * 0.14);
    g.closePath();
    g.fill(secColor);
  }

  /** 绘制市场图标（摊位+天幕） */
  private drawMarket(g: Graphics, cfg: Required<Omit<IconDrawConfig, 'backgroundColor'>> & { backgroundColor?: string }): void {
    const s = cfg.size;
    const color = hexToNum(cfg.color);
    const secColor = hexToNum(cfg.secondaryColor);
    const sw = cfg.strokeWidth;

    // 天幕（波浪形顶）
    g.moveTo(s * 0.05, s * 0.35);
    g.quadraticCurveTo(s * 0.2, s * 0.15, s * 0.35, s * 0.35);
    g.quadraticCurveTo(s * 0.5, s * 0.15, s * 0.65, s * 0.35);
    g.quadraticCurveTo(s * 0.8, s * 0.15, s * 0.95, s * 0.35);
    g.lineTo(s * 0.95, s * 0.4);
    g.lineTo(s * 0.05, s * 0.4);
    g.closePath();
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 柜台
    g.rect(s * 0.1, s * 0.5, s * 0.8, s * 0.1);
    g.fill(secColor);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 柜台腿
    g.rect(s * 0.15, s * 0.6, s * 0.06, s * 0.25);
    g.fill(secColor);
    g.rect(s * 0.79, s * 0.6, s * 0.06, s * 0.25);
    g.fill(secColor);

    // 商品（小方块）
    g.rect(s * 0.25, s * 0.42, s * 0.08, s * 0.08);
    g.fill(color);
    g.rect(s * 0.46, s * 0.42, s * 0.08, s * 0.08);
    g.fill(color);
    g.rect(s * 0.67, s * 0.42, s * 0.08, s * 0.08);
    g.fill(color);
  }

  /** 绘制城堡图标 */
  private drawCastle(g: Graphics, cfg: Required<Omit<IconDrawConfig, 'backgroundColor'>> & { backgroundColor?: string }): void {
    const s = cfg.size;
    const color = hexToNum(cfg.color);
    const secColor = hexToNum(cfg.secondaryColor);
    const sw = cfg.strokeWidth;

    // 主城墙
    g.rect(s * 0.1, s * 0.4, s * 0.8, s * 0.5);
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 左塔
    g.rect(s * 0.05, s * 0.2, s * 0.2, s * 0.7);
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 右塔
    g.rect(s * 0.75, s * 0.2, s * 0.2, s * 0.7);
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 左塔顶（三角形）
    g.moveTo(s * 0.05, s * 0.2);
    g.lineTo(s * 0.15, s * 0.05);
    g.lineTo(s * 0.25, s * 0.2);
    g.closePath();
    g.fill(secColor);

    // 右塔顶（三角形）
    g.moveTo(s * 0.75, s * 0.2);
    g.lineTo(s * 0.85, s * 0.05);
    g.lineTo(s * 0.95, s * 0.2);
    g.closePath();
    g.fill(secColor);

    // 城门
    const gateW = s * 0.18;
    const gateH = s * 0.25;
    const gateX = (s - gateW) / 2;
    const gateY = s * 0.65;
    g.rect(gateX, gateY, gateW, gateH);
    g.fill(secColor);
    g.arc(gateX + gateW / 2, gateY, gateW / 2, Math.PI, 0, false);
    g.fill(secColor);

    // 窗户
    g.rect(s * 0.25, s * 0.5, s * 0.08, s * 0.08);
    g.fill(secColor);
    g.rect(s * 0.67, s * 0.5, s * 0.08, s * 0.08);
    g.fill(secColor);
  }

  /** 绘制城墙图标 */
  private drawWall(g: Graphics, cfg: Required<Omit<IconDrawConfig, 'backgroundColor'>> & { backgroundColor?: string }): void {
    const s = cfg.size;
    const color = hexToNum(cfg.color);
    const secColor = hexToNum(cfg.secondaryColor);
    const sw = cfg.strokeWidth;

    // 城墙主体
    g.rect(s * 0.05, s * 0.35, s * 0.9, s * 0.5);
    g.fill(color);
    g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });

    // 城垛（顶部锯齿形）
    const merlonW = s * 0.15;
    const merlonH = s * 0.12;
    const merlonCount = 5;
    const totalMerlonW = merlonCount * merlonW;
    const startX = (s - totalMerlonW) / 2;

    for (let i = 0; i < merlonCount; i++) {
      if (i % 2 === 0) {
        const mx = startX + i * merlonW;
        g.rect(mx, s * 0.35 - merlonH, merlonW, merlonH);
        g.fill(color);
        g.stroke({ color: hexToNum(cfg.strokeColor), width: sw });
      }
    }

    // 砖缝线条
    const brickRows = 3;
    const brickH = (s * 0.5) / brickRows;
    for (let row = 0; row < brickRows; row++) {
      const by = s * 0.35 + row * brickH;
      g.moveTo(s * 0.05, by);
      g.lineTo(s * 0.95, by);
      g.stroke({ color: secColor, width: sw * 0.5 });
    }

    // 竖向砖缝
    for (let row = 0; row < brickRows; row++) {
      const by = s * 0.35 + row * brickH;
      const offset = row % 2 === 0 ? 0 : s * 0.12;
      for (let bx = s * 0.05 + offset; bx < s * 0.95; bx += s * 0.24) {
        g.moveTo(bx, by);
        g.lineTo(bx, by + brickH);
        g.stroke({ color: secColor, width: sw * 0.5 });
      }
    }
  }
}
