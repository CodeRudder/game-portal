/**
 * renderer/scenes/CivIndiaScene.ts — 印度文明放置游戏场景
 *
 * 翡翠配色主题，佛塔/宫殿建筑风格。
 * 特色建筑：佛塔、宫殿、丛林小屋（程序化绘制）。
 * 声望系统：业力
 * 单位类型：英雄
 *
 * @module renderer/scenes/CivIndiaScene
 */

import { Graphics } from 'pixi.js';
import { CivBaseScene } from './CivBaseScene';
import { CIV_INDIA_STRATEGY } from '../CivRenderStrategies';
import type { RenderStrategy } from '../types';

// ═══════════════════════════════════════════════════════════════
// 印度文明场景
// ═══════════════════════════════════════════════════════════════

export class CivIndiaScene extends CivBaseScene {
  constructor(strategy?: RenderStrategy) {
    super(strategy ?? CIV_INDIA_STRATEGY, 'civ-india');
    this.prestigeName = '业力';
    this.unitTypeName = '英雄';
  }

  /**
   * 绘制印度建筑图标
   *
   * 根据资源类型绘制不同的印度建筑：
   * - rice: 稻田（绿色方块 + 稻穗）
   * - spice: 香料园（彩色方块 + 植物装饰）
   * - gem: 宝石矿（洞穴 + 宝石）
   * - gold: 宫殿（圆顶建筑）
   * - 默认: 佛塔
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
      case 'rice':
        // 稻田 — 绿色方块 + 稻穗
        g.rect(iconX, iconY + 10, 22, 12);
        g.fill(0x4a8c3f);
        // 稻穗
        g.moveTo(iconX + 4, iconY + 10);
        g.lineTo(iconX + 4, iconY + 4);
        g.stroke({ color: 0x3a7a2f, width: 1 });
        g.moveTo(iconX + 11, iconY + 10);
        g.lineTo(iconX + 11, iconY + 2);
        g.stroke({ color: 0x3a7a2f, width: 1 });
        g.moveTo(iconX + 18, iconY + 10);
        g.lineTo(iconX + 18, iconY + 5);
        g.stroke({ color: 0x3a7a2f, width: 1 });
        // 稻穗顶部
        g.circle(iconX + 4, iconY + 3, 2);
        g.fill(0x6aac5f);
        g.circle(iconX + 11, iconY + 1, 2);
        g.fill(0x6aac5f);
        g.circle(iconX + 18, iconY + 4, 2);
        g.fill(0x6aac5f);
        break;

      case 'spice':
        // 香料园 — 彩色方块 + 植物装饰
        g.rect(iconX, iconY + 8, 22, 14);
        g.fill(0x6a4a2a);
        // 香料植物
        g.circle(iconX + 5, iconY + 10, 4);
        g.fill(0xcc4400);
        g.circle(iconX + 11, iconY + 8, 4);
        g.fill(0xddaa00);
        g.circle(iconX + 17, iconY + 10, 4);
        g.fill(0x2ecc71);
        break;

      case 'gem':
        // 宝石矿 — 洞穴 + 宝石
        g.rect(iconX, iconY + 6, 22, 16);
        g.fill(0x5a4a3a);
        // 洞口
        g.moveTo(iconX + 4, iconY + 22);
        g.lineTo(iconX + 4, iconY + 14);
        g.arc(iconX + 11, iconY + 14, 7, Math.PI, 0);
        g.lineTo(iconX + 18, iconY + 22);
        g.fill(0x2a1a0a);
        // 宝石
        g.moveTo(iconX + 11, iconY + 12);
        g.lineTo(iconX + 14, iconY + 16);
        g.lineTo(iconX + 11, iconY + 20);
        g.lineTo(iconX + 8, iconY + 16);
        g.fill(0x9b59b6);
        break;

      case 'gold':
        // 宫殿 — 圆顶建筑
        g.rect(iconX + 2, iconY + 12, 18, 10);
        g.fill(0xd4a030);
        // 圆顶
        g.arc(iconX + 11, iconY + 12, 9, Math.PI, 0);
        g.fill(0xe8b040);
        // 顶部尖塔
        g.moveTo(iconX + 11, iconY + 3);
        g.lineTo(iconX + 9, iconY + 6);
        g.lineTo(iconX + 13, iconY + 6);
        g.fill(0xffd700);
        // 门
        g.moveTo(iconX + 8, iconY + 22);
        g.lineTo(iconX + 8, iconY + 18);
        g.arc(iconX + 11, iconY + 18, 3, Math.PI, 0);
        g.lineTo(iconX + 14, iconY + 22);
        g.fill(0x4a3010);
        break;

      default:
        // 佛塔 — 圆顶 + 方形底座 + 尖顶
        // 底座
        g.rect(iconX + 2, iconY + 16, 18, 6);
        g.fill(0xd4a030);
        // 中层
        g.rect(iconX + 5, iconY + 10, 12, 6);
        g.fill(0xe0b040);
        // 圆顶
        g.arc(iconX + 11, iconY + 10, 6, Math.PI, 0);
        g.fill(0xf0c050);
        // 尖顶
        g.rect(iconX + 10, iconY + 1, 2, 5);
        g.fill(0xffd700);
        g.circle(iconX + 11, iconY, 3);
        g.fill(0xffd700);
        break;
    }

    card.addChild(g);
  }
}
