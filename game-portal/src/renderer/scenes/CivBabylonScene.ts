/**
 * renderer/scenes/CivBabylonScene.ts — 巴比伦文明放置游戏场景
 *
 * 青铜配色主题，空中花园/神庙建筑风格。
 * 特色建筑：空中花园、金字形神塔、城门（程序化绘制）。
 * 声望系统：神眷
 * 单位类型：英雄
 *
 * @module renderer/scenes/CivBabylonScene
 */

import { Graphics } from 'pixi.js';
import { CivBaseScene } from './CivBaseScene';
import { CIV_BABYLON_STRATEGY } from '../CivRenderStrategies';
import type { RenderStrategy } from '../types';

// ═══════════════════════════════════════════════════════════════
// 巴比伦文明场景
// ═══════════════════════════════════════════════════════════════

export class CivBabylonScene extends CivBaseScene {
  constructor(strategy?: RenderStrategy) {
    super(strategy ?? CIV_BABYLON_STRATEGY, 'civ-babylon');
    this.prestigeName = '神眷';
    this.unitTypeName = '英雄';
  }

  /**
   * 绘制巴比伦建筑图标
   *
   * 根据资源类型绘制不同的巴比伦建筑：
   * - grain: 谷仓（方形 + 麦穗装饰）
   * - clay: 砖窑（方形 + 烟囱）
   * - copper: 冶炼厂（方形 + 火焰）
   * - silver: 宝库（拱形门）
   * - 默认: 金字形神塔
   */
  protected drawBuildingIcon(
    card: any,
    resourceId: string,
    cardW: number,
    cardH: number,
    theme: RenderStrategy['theme'],
  ): void {
    const g = new Graphics();
    const iconX = cardW - 30;
    const iconY = cardH - 30;

    switch (resourceId) {
      case 'grain':
        // 谷仓 — 方形 + 麦穗装饰
        g.rect(iconX, iconY + 8, 22, 14);
        g.fill(0x8b7355);
        // 屋顶
        g.moveTo(iconX - 2, iconY + 8);
        g.lineTo(iconX + 11, iconY + 2);
        g.lineTo(iconX + 24, iconY + 8);
        g.fill(0x6b5335);
        // 门
        g.rect(iconX + 8, iconY + 14, 6, 8);
        g.fill(0x4a3325);
        break;

      case 'clay':
        // 砖窑 — 方形 + 烟囱
        g.rect(iconX + 2, iconY + 8, 18, 14);
        g.fill(0xa0522d);
        // 烟囱
        g.rect(iconX + 14, iconY + 2, 4, 8);
        g.fill(0x8b4513);
        // 烟
        g.circle(iconX + 16, iconY, 3);
        g.fill(0x888888);
        // 门
        g.rect(iconX + 6, iconY + 14, 6, 8);
        g.fill(0x3a2515);
        break;

      case 'copper':
        // 冶炼厂 — 方形 + 火焰
        g.rect(iconX, iconY + 10, 22, 12);
        g.fill(0x5a3a2a);
        // 火焰
        g.moveTo(iconX + 8, iconY + 10);
        g.lineTo(iconX + 11, iconY + 2);
        g.lineTo(iconX + 14, iconY + 10);
        g.fill(0xff6600);
        g.moveTo(iconX + 10, iconY + 10);
        g.lineTo(iconX + 11, iconY + 5);
        g.lineTo(iconX + 12, iconY + 10);
        g.fill(0xffaa00);
        break;

      case 'silver':
        // 宝库 — 拱形门
        g.rect(iconX, iconY + 6, 22, 16);
        g.fill(0x4a4a5a);
        // 拱形门
        g.moveTo(iconX + 6, iconY + 22);
        g.lineTo(iconX + 6, iconY + 14);
        g.arc(iconX + 11, iconY + 14, 5, Math.PI, 0);
        g.lineTo(iconX + 16, iconY + 22);
        g.fill(0x2a2a3a);
        // 装饰
        g.circle(iconX + 11, iconY + 3, 3);
        g.fill(0xc8963e);
        break;

      default:
        // 金字形神塔 — 阶梯金字塔
        // 底层
        g.rect(iconX, iconY + 16, 22, 6);
        g.fill(0x8b7355);
        // 中层
        g.rect(iconX + 3, iconY + 10, 16, 6);
        g.fill(0x9b8365);
        // 上层
        g.rect(iconX + 6, iconY + 4, 10, 6);
        g.fill(0xab8775);
        // 顶部神殿
        g.rect(iconX + 8, iconY, 6, 4);
        g.fill(0xc8963e);
        break;
    }

    card.addChild(g);
  }
}
