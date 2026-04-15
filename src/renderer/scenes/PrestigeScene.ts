/**
 * renderer/scenes/PrestigeScene.ts — 声望转生场景
 *
 * 展示声望转生界面，包含：
 * - 天命货币数量与转生次数
 * - 当前倍率与预览新倍率
 * - 资源保留率
 * - 转生按钮
 *
 * 该场景在 GameRenderer 中注册，供 React 层通过 switchScene('prestige') 切换。
 *
 * @module renderer/scenes/PrestigeScene
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { SceneType } from '../types';
import { BaseScene, type SceneEventBridge } from './BaseScene';
import type { AssetManager } from '../managers/AssetManager';
import type { AnimationManager } from '../managers/AnimationManager';

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

const BG_COLOR = 0x1a0a0a;
const GOLD_COLOR = 0xffd700;
const TEXT_COLOR = 0xe0e0e0;
const DIM_COLOR = 0x888888;
const GREEN_COLOR = 0x2ecc71;
const TITLE_FONT_SIZE = 32;
const BODY_FONT_SIZE = 16;
const SMALL_FONT_SIZE = 13;

// ═══════════════════════════════════════════════════════════════
// 声望数据接口
// ═══════════════════════════════════════════════════════════════

export interface PrestigeRenderData {
  currency: number;
  count: number;
  multiplier: number;
  previewGain: number;
  previewNewMultiplier: number;
  retentionRate: number;
  canPrestige: boolean;
  warning?: string;
}

// ═══════════════════════════════════════════════════════════════
// PrestigeScene
// ═══════════════════════════════════════════════════════════════

export class PrestigeScene extends BaseScene {
  readonly type: SceneType = 'prestige';

  // ─── 子容器 ───────────────────────────────────────────────

  private bgLayer: Container;
  private contentLayer: Container;

  // ─── 渲染数据 ─────────────────────────────────────────────

  private prestigeData: PrestigeRenderData | null = null;

  // ─── 尺寸 ─────────────────────────────────────────────────

  private width = 960;
  private height = 640;

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  constructor(
    assetManager: AssetManager,
    animationManager: AnimationManager,
    bridgeEvent: SceneEventBridge,
  ) {
    super(assetManager, animationManager, bridgeEvent);

    this.bgLayer = new Container({ label: 'prestige-bg' });
    this.contentLayer = new Container({ label: 'prestige-content' });

    this.container.addChild(this.bgLayer, this.contentLayer);
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  protected async onCreate(): Promise<void> {
    this.container.eventMode = 'static';
  }

  protected async onEnter(): Promise<void> {
    this.renderAll();
  }

  protected async onExit(): Promise<void> {
    this.contentLayer.removeChildren();
  }

  protected onUpdate(_deltaTime: number): void {
    // 预留：可添加粒子/光效动画
  }

  protected onSetData(data: unknown): void {
    const state = data as { prestige?: PrestigeRenderData };
    if (state.prestige) {
      this.prestigeData = state.prestige;
      this.renderAll();
    }
  }

  protected onDestroy(): void {
    this.contentLayer.removeChildren();
  }

  // ═══════════════════════════════════════════════════════════
  // 公共方法
  // ═══════════════════════════════════════════════════════════

  /** 设置声望数据 */
  setPrestigeData(data: PrestigeRenderData): void {
    this.prestigeData = data;
    this.renderAll();
  }

  /** 调整尺寸 */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderAll();
  }

  // ═══════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════

  private renderAll(): void {
    this.bgLayer.removeChildren();
    this.contentLayer.removeChildren();

    // 背景
    const bg = new Graphics();
    bg.rect(0, 0, this.width, this.height).fill({ color: BG_COLOR, alpha: 0.85 });
    this.bgLayer.addChild(bg);

    // 标题
    const title = new Text({
      text: '👑 声望转生',
      style: new TextStyle({
        fontSize: TITLE_FONT_SIZE,
        fill: GOLD_COLOR,
        fontFamily: 'Arial, "Microsoft YaHei", "Noto Serif SC", sans-serif',
        fontWeight: 'bold',
      }),
    });
    title.anchor.set(0.5, 0);
    title.position.set(this.width / 2, 60);
    this.contentLayer.addChild(title);

    // 数据面板
    const d = this.prestigeData;
    if (!d) {
      const noData = new Text({
        text: '暂无声望数据',
        style: new TextStyle({
          fontSize: BODY_FONT_SIZE,
          fill: DIM_COLOR,
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        }),
      });
      noData.anchor.set(0.5, 0.5);
      noData.position.set(this.width / 2, this.height / 2);
      this.contentLayer.addChild(noData);
      return;
    }

    const bodyFont = {
      fontSize: BODY_FONT_SIZE,
      fill: TEXT_COLOR,
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      lineHeight: 28,
    };

    const lines = [
      `天命: ${this.fmt(d.currency)}  |  转生: ${d.count}次`,
      `当前倍率: ×${d.multiplier.toFixed(2)}`,
      ``,
      `本次获得: ${this.fmt(d.previewGain)} 天命`,
      `新倍率: ×${d.previewNewMultiplier.toFixed(2)}`,
      `资源保留: ${(d.retentionRate * 100).toFixed(0)}%`,
    ];

    const startY = 130;
    for (let i = 0; i < lines.length; i++) {
      const t = new Text({
        text: lines[i],
        style: new TextStyle(bodyFont),
      });
      t.anchor.set(0.5, 0);
      t.position.set(this.width / 2, startY + i * 32);
      this.contentLayer.addChild(t);
    }

    // 警告
    if (d.warning) {
      const warn = new Text({
        text: d.warning,
        style: new TextStyle({
          fontSize: SMALL_FONT_SIZE,
          fill: DIM_COLOR,
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        }),
      });
      warn.anchor.set(0.5, 0);
      warn.position.set(this.width / 2, startY + lines.length * 32 + 10);
      this.contentLayer.addChild(warn);
    }

    // 转生按钮区域
    const btnY = this.height - 120;
    const btnLabel = d.canPrestige ? '执行转生' : '资源不足';
    const btnColor = d.canPrestige ? GOLD_COLOR : 0x555555;

    const btnBg = new Graphics();
    btnBg.roundRect(-80, -20, 160, 40, 8).fill({ color: btnColor, alpha: 0.9 });
    btnBg.roundRect(-80, -20, 160, 40, 8).stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
    btnBg.position.set(this.width / 2, btnY);
    btnBg.eventMode = 'static';
    btnBg.cursor = d.canPrestige ? 'pointer' : 'default';

    const btnText = new Text({
      text: btnLabel,
      style: new TextStyle({
        fontSize: BODY_FONT_SIZE,
        fill: d.canPrestige ? 0x1a0a0a : DIM_COLOR,
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
      }),
    });
    btnText.anchor.set(0.5, 0.5);
    btnText.position.set(this.width / 2, btnY);

    if (d.canPrestige) {
      btnBg.on('pointerdown', () => {
        this.bridgeEvent('combatAction', 'prestige', undefined);
      });
    }

    this.contentLayer.addChild(btnBg, btnText);
  }

  // ═══════════════════════════════════════════════════════════
  // 工具
  // ═══════════════════════════════════════════════════════════

  /** 格式化大数字 */
  private fmt(n: number): string {
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n < 10 ? n.toFixed(1) : Math.floor(n).toString();
  }
}
