/**
 * renderer/scenes/CivChinaScene.ts — 华夏文明放置游戏场景
 *
 * 红金配色主题，中式建筑风格。
 * 特色建筑：宫殿、城墙、宝塔（程序化绘制）。
 * 声望系统：天命
 * 单位类型：官员
 *
 * @module renderer/scenes/CivChinaScene
 */

import { Graphics } from 'pixi.js';
import { CivBaseScene } from './CivBaseScene';
import { CIV_CHINA_STRATEGY } from '../CivRenderStrategies';
import type { RenderStrategy } from '../types';

// ═══════════════════════════════════════════════════════════════
// 华夏文明场景
// ═══════════════════════════════════════════════════════════════

export class CivChinaScene extends CivBaseScene {
  constructor(strategy?: RenderStrategy) {
    super(strategy ?? CIV_CHINA_STRATEGY, 'civ-china');
    this.prestigeName = '天命';
    this.unitTypeName = '官员';
  }

  /**
   * 绘制中式建筑图标
   *
   * 根据资源类型绘制不同的中式建筑：
   * - food: 稻田（绿色方块 + 波浪线）
   * - silk: 织坊（方形 + 飞檐屋顶）
   * - culture: 书院（多层宝塔）
   * - 默认: 宫殿（红色方形 + 金色屋顶）
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
      case 'food':
        // 稻田 — 绿色方块 + 波浪线
        g.rect(iconX, iconY, 22, 16);
        g.fill(0x4a8c3f);
        g.moveTo(iconX, iconY + 8);
        g.bezierCurveTo(iconX + 5, iconY + 4, iconX + 11, iconY + 12, iconX + 22, iconY + 8);
        g.stroke({ color: 0x2d5a22, width: 1 });
        break;

      case 'silk':
        // 织坊 — 方形 + 飞檐屋顶
        g.rect(iconX, iconY + 8, 20, 14);
        g.fill(0x8b4513);
        // 飞檐屋顶
        g.moveTo(iconX - 3, iconY + 8);
        g.lineTo(iconX + 10, iconY);
        g.lineTo(iconX + 23, iconY + 8);
        g.fill(0xd4a017);
        break;

      case 'culture':
        // 书院 — 多层宝塔
        g.rect(iconX + 4, iconY + 14, 14, 10);
        g.fill(0x8b0000);
        g.rect(iconX + 6, iconY + 8, 10, 6);
        g.fill(0xa00000);
        g.rect(iconX + 8, iconY + 3, 6, 5);
        g.fill(0xc00000);
        // 塔尖
        g.moveTo(iconX + 11, iconY);
        g.lineTo(iconX + 9, iconY + 3);
        g.lineTo(iconX + 13, iconY + 3);
        g.fill(0xd4a017);
        break;

      default:
        // 宫殿 — 红色方形 + 金色屋顶
        g.rect(iconX, iconY + 10, 22, 14);
        g.fill(0x8b0000);
        // 屋顶
        g.moveTo(iconX - 4, iconY + 10);
        g.lineTo(iconX + 11, iconY);
        g.lineTo(iconX + 26, iconY + 10);
        g.fill(0xd4a017);
        // 门
        g.rect(iconX + 8, iconY + 16, 6, 8);
        g.fill(0x4a1a1a);
        break;
    }

    card.addChild(g);
  }
}
