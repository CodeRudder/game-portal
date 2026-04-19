/**
 * renderer/scenes/CivEgyptScene.ts — 古埃及文明放置游戏场景
 *
 * 金沙配色主题，金字塔/神殿建筑风格。
 * 特色建筑：金字塔、方尖碑、神殿（程序化绘制）。
 * 声望系统：神恩
 * 单位类型：神明
 *
 * @module renderer/scenes/CivEgyptScene
 */

import { Graphics } from 'pixi.js';
import { CivBaseScene } from './CivBaseScene';
import { CIV_EGYPT_STRATEGY } from '../CivRenderStrategies';
import type { RenderStrategy } from '../types';

// ═══════════════════════════════════════════════════════════════
// 古埃及文明场景
// ═══════════════════════════════════════════════════════════════

export class CivEgyptScene extends CivBaseScene {
  constructor(strategy?: RenderStrategy) {
    super(strategy ?? CIV_EGYPT_STRATEGY, 'civ-egypt');
    this.prestigeName = '神恩';
    this.unitTypeName = '神明';
  }

  /**
   * 绘制古埃及建筑图标
   *
   * 根据资源类型绘制不同的埃及建筑：
   * - grain: 麦田（金色方块 + 麦穗）
   * - stone: 采石场（灰色方块 + 石块）
   * - papyrus: 纸莎草（绿色植物）
   * - gold: 金字塔
   * - 默认: 神殿
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
        // 麦田 — 金色方块 + 麦穗
        g.rect(iconX, iconY + 8, 22, 14);
        g.fill(0xc8a832);
        // 麦穗
        g.moveTo(iconX + 4, iconY + 8);
        g.lineTo(iconX + 4, iconY + 2);
        g.stroke({ color: 0x8b7a2e, width: 1 });
        g.moveTo(iconX + 11, iconY + 8);
        g.lineTo(iconX + 11, iconY);
        g.stroke({ color: 0x8b7a2e, width: 1 });
        g.moveTo(iconX + 18, iconY + 8);
        g.lineTo(iconX + 18, iconY + 3);
        g.stroke({ color: 0x8b7a2e, width: 1 });
        break;

      case 'stone':
        // 采石场 — 灰色方块 + 石块
        g.rect(iconX, iconY + 6, 22, 16);
        g.fill(0x808080);
        g.circle(iconX + 6, iconY + 14, 4);
        g.fill(0x606060);
        g.circle(iconX + 16, iconY + 12, 3);
        g.fill(0x707070);
        break;

      case 'papyrus':
        // 纸莎草 — 绿色植物
        g.rect(iconX + 2, iconY + 16, 18, 6);
        g.fill(0x4a7a3f);
        // 茎
        g.moveTo(iconX + 6, iconY + 16);
        g.lineTo(iconX + 6, iconY + 4);
        g.stroke({ color: 0x3a6a2f, width: 1 });
        g.moveTo(iconX + 11, iconY + 16);
        g.lineTo(iconX + 11, iconY + 2);
        g.stroke({ color: 0x3a6a2f, width: 1 });
        g.moveTo(iconX + 16, iconY + 16);
        g.lineTo(iconX + 16, iconY + 6);
        g.stroke({ color: 0x3a6a2f, width: 1 });
        // 顶部圆球
        g.circle(iconX + 6, iconY + 3, 3);
        g.fill(0x5a8a4f);
        g.circle(iconX + 11, iconY + 1, 3);
        g.fill(0x5a8a4f);
        g.circle(iconX + 16, iconY + 5, 3);
        g.fill(0x5a8a4f);
        break;

      case 'gold':
        // 金字塔
        g.moveTo(iconX + 11, iconY);
        g.lineTo(iconX + 22, iconY + 22);
        g.lineTo(iconX, iconY + 22);
        g.fill(0xc8a832);
        // 金字塔纹理线
        g.moveTo(iconX + 11, iconY);
        g.lineTo(iconX + 11, iconY + 22);
        g.stroke({ color: 0xa08828, width: 1 });
        g.moveTo(iconX + 5, iconY + 11);
        g.lineTo(iconX + 17, iconY + 11);
        g.stroke({ color: 0xa08828, width: 1 });
        break;

      default:
        // 神殿 — 方形柱子 + 三角顶
        g.rect(iconX + 2, iconY + 10, 4, 12);
        g.fill(0xc8a832);
        g.rect(iconX + 9, iconY + 10, 4, 12);
        g.fill(0xc8a832);
        g.rect(iconX + 16, iconY + 10, 4, 12);
        g.fill(0xc8a832);
        // 横梁
        g.rect(iconX, iconY + 8, 22, 3);
        g.fill(0xd4b840);
        // 三角顶
        g.moveTo(iconX, iconY + 8);
        g.lineTo(iconX + 11, iconY);
        g.lineTo(iconX + 22, iconY + 8);
        g.fill(0xd4b840);
        break;
    }

    card.addChild(g);
  }
}
