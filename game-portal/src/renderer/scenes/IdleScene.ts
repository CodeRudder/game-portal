/**
 * renderer/scenes/IdleScene.ts — 通用放置游戏场景
 *
 * 为所有放置游戏提供统一的 PixiJS 渲染场景。
 * 所有 UI 元素使用 Graphics 程序化绘制，无需真实图片资源。
 *
 * 布局结构：
 * ┌────────────────────────────────────────────────────────┐
 * │                    资源栏（顶部）                        │
 * ├──────────────────────────────────┬─────────────────────┤
 * │                                  │                     │
 * │           建筑区域               │     统计面板        │
 * │       （网格布局）               │     （侧边栏）      │
 * │                                  │                     │
 * ├──────────────────────────────────┴─────────────────────┤
 * │                  升级面板（底部）                        │
 * └────────────────────────────────────────────────────────┘
 *
 * @module renderer/scenes/IdleScene
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { RenderStrategy, IdleGameRenderState } from '../types';

// ═══════════════════════════════════════════════════════════════
// 事件类型
// ═══════════════════════════════════════════════════════════════

/** IdleScene 事件映射 */
export interface IdleSceneEventMap {
  /** 点击升级按钮 */
  upgradeClick: [upgradeId: string];
}

type IdleSceneEventCallback = (...args: any[]) => void;

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

/** 格式化大数字 */
function formatNumber(n: number): string {
  if (n >= 1e15) return (n / 1e15).toFixed(1) + 'Qa';
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  if (n < 10) return n.toFixed(1);
  return Math.floor(n).toString();
}

/** 十六进制颜色转数值 */
function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

// ═══════════════════════════════════════════════════════════════
// 升级按钮数据
// ═══════════════════════════════════════════════════════════════

interface UpgradeButton {
  container: Container;
  background: Graphics;
  nameText: Text;
  levelText: Text;
  costText: Text;
  upgradeId: string;
}

// ═══════════════════════════════════════════════════════════════
// IdleScene
// ═══════════════════════════════════════════════════════════════

/**
 * 通用放置游戏场景
 *
 * 使用 PixiJS Graphics 程序化绘制所有 UI 元素。
 * 支持响应式布局（通过 resize 方法适配不同屏幕尺寸）。
 */
export class IdleScene {
  // ─── PixiJS 对象 ────────────────────────────────────────

  /** 场景根容器 */
  private container: Container;
  /** 资源栏容器 */
  private resourceBar: Container;
  /** 资源栏背景 */
  private resourceBarBg: Graphics;
  /** 资源文本列表 */
  private resourceTexts: Text[] = [];
  /** 建筑区域容器 */
  private buildingArea: Container;
  /** 建筑区域背景 */
  private buildingAreaBg: Graphics;
  /** 建筑卡片列表 */
  private buildingCards: Container[] = [];
  /** 升级面板容器 */
  private upgradePanel: Container;
  /** 升级面板背景 */
  private upgradePanelBg: Graphics;
  /** 升级按钮列表 */
  private upgradeButtons: UpgradeButton[] = [];
  /** 统计面板容器 */
  private statsPanel: Container;
  /** 统计面板背景 */
  private statsPanelBg: Graphics;
  /** 统计文本列表 */
  private statsTexts: Text[] = [];
  /** 游戏标题文本 */
  private titleText: Text;

  // ─── 配置 ───────────────────────────────────────────────

  /** 渲染策略 */
  private strategy: RenderStrategy;

  // ─── 状态 ───────────────────────────────────────────────

  /** 是否已激活 */
  private active: boolean = false;
  /** 当前渲染状态 */
  private currentState: IdleGameRenderState | null = null;
  /** 当前画布尺寸 */
  private canvasWidth: number = 800;
  private canvasHeight: number = 600;

  // ─── 事件 ───────────────────────────────────────────────

  private listeners: Map<string, Set<IdleSceneEventCallback>> = new Map();

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  constructor(strategy: RenderStrategy) {
    this.strategy = strategy;

    // 创建根容器
    this.container = new Container({ label: 'idle-scene' });

    // 创建子容器
    this.resourceBar = new Container({ label: 'resource-bar' });
    this.resourceBarBg = new Graphics();
    this.resourceBar.addChild(this.resourceBarBg);

    this.buildingArea = new Container({ label: 'building-area' });
    this.buildingAreaBg = new Graphics();
    this.buildingArea.addChild(this.buildingAreaBg);

    this.upgradePanel = new Container({ label: 'upgrade-panel' });
    this.upgradePanelBg = new Graphics();
    this.upgradePanel.addChild(this.upgradePanelBg);

    this.statsPanel = new Container({ label: 'stats-panel' });
    this.statsPanelBg = new Graphics();
    this.statsPanel.addChild(this.statsPanelBg);

    // 标题
    this.titleText = new Text({
      text: '',
      style: {
        fontSize: 14,
        fill: hexToNum(strategy.theme.accent),
        fontWeight: 'bold',
      },
    });
    this.titleText.visible = false;

    // 添加到根容器
    this.container.addChild(this.resourceBar);
    this.container.addChild(this.buildingArea);
    this.container.addChild(this.upgradePanel);
    this.container.addChild(this.statsPanel);
    this.container.addChild(this.titleText);
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  /**
   * 进入场景
   */
  async enter(): Promise<void> {
    this.container.visible = true;
    this.active = true;
    this.layout();
  }

  /**
   * 退出场景
   */
  async exit(): Promise<void> {
    this.active = false;
    this.container.visible = false;
  }

  /**
   * 每帧更新
   *
   * @param deltaTime - 帧间隔（毫秒）
   */
  update(deltaTime: number): void {
    if (!this.active) return;
    // 当前无需每帧动画，状态通过 updateState 驱动
    void deltaTime;
  }

  /**
   * 销毁场景
   */
  destroy(): void {
    this.active = false;
    this.container.destroy({ children: true });
    this.listeners.clear();
  }

  // ═══════════════════════════════════════════════════════════
  // 状态更新
  // ═══════════════════════════════════════════════════════════

  /**
   * 更新渲染状态
   *
   * 由 PixiGameAdapter 调用，将引擎状态推送到渲染层。
   */
  updateState(state: IdleGameRenderState): void {
    if (!this.active) return;
    this.currentState = state;
    this.renderResourceBar(state);
    this.renderBuildingArea(state);
    this.renderUpgradePanel(state);
    this.renderStatsPanel(state);
    this.renderTitle(state);
  }

  // ═══════════════════════════════════════════════════════════
  // 响应式布局
  // ═══════════════════════════════════════════════════════════

  /**
   * 调整场景尺寸
   */
  resize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.layout();
    // 如果有状态，重新渲染
    if (this.currentState) {
      this.updateState(this.currentState);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 公共访问器
  // ═══════════════════════════════════════════════════════════

  /** 获取根容器 */
  getContainer(): Container {
    return this.container;
  }

  /** 是否已激活 */
  isActive(): boolean {
    return this.active;
  }

  /** 获取当前渲染状态 */
  getCurrentState(): IdleGameRenderState | null {
    return this.currentState;
  }

  // ═══════════════════════════════════════════════════════════
  // 事件系统
  // ═══════════════════════════════════════════════════════════

  /**
   * 注册事件回调
   */
  on(event: string, callback: IdleSceneEventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * 注销事件回调
   */
  off(event: string, callback: IdleSceneEventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法 — 布局
  // ═══════════════════════════════════════════════════════════

  /**
   * 计算并应用布局
   *
   * 根据策略中的比例参数分配各区域的位置和尺寸。
   */
  private layout(): void {
    const { layout, theme } = this.strategy;
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    const p = layout.padding;
    const br = layout.borderRadius;

    // ── 资源栏（顶部）─────────────────────────────────────
    const rbH = h * layout.resourceBarHeight;
    this.resourceBar.position.set(0, 0);
    this.resourceBarBg.clear();
    this.resourceBarBg.roundRect(0, 0, w, rbH, br);
    this.resourceBarBg.fill(hexToNum(theme.resourceBarBg));

    // ── 统计面板（右侧）───────────────────────────────────
    const spW = w * layout.statsPanelWidth;
    const spH = h - rbH;
    this.statsPanel.position.set(w - spW, rbH);
    this.statsPanelBg.clear();
    this.statsPanelBg.roundRect(0, 0, spW, spH, br);
    this.statsPanelBg.fill(hexToNum(theme.panelBackground));

    // ── 建筑区域（中部，统计面板左侧）─────────────────────
    const baW = w - spW;
    const baH = h * layout.buildingAreaHeight;
    const baY = rbH;
    this.buildingArea.position.set(0, baY);
    this.buildingAreaBg.clear();
    this.buildingAreaBg.roundRect(0, 0, baW, baH, 0);
    this.buildingAreaBg.fill(hexToNum(theme.background));

    // ── 升级面板（底部）───────────────────────────────────
    const upW = w;
    const upH = h * layout.upgradePanelHeight;
    const upY = h - upH;
    this.upgradePanel.position.set(0, upY);
    this.upgradePanelBg.clear();
    this.upgradePanelBg.roundRect(0, 0, upW, upH, br);
    this.upgradePanelBg.fill(hexToNum(theme.panelBackground));

    // ── 标题 ──────────────────────────────────────────────
    this.titleText.position.set(p, p);
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法 — 渲染
  // ═══════════════════════════════════════════════════════════

  /**
   * 渲染资源栏
   */
  private renderResourceBar(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    // 清除旧文本
    for (const t of this.resourceTexts) {
      t.destroy();
    }
    this.resourceTexts = [];

    // 绘制资源项
    let x = p;
    const y = (this.canvasHeight * layout.resourceBarHeight) / 2;

    for (const res of state.resources) {
      const text = new Text({
        text: `${res.name}: ${formatNumber(res.amount)}`,
        style: {
          fontSize: 13,
          fill: hexToNum(theme.textPrimary),
          fontFamily: 'monospace',
        },
      });
      text.anchor.set(0, 0.5);
      text.position.set(x, y);

      this.resourceBar.addChild(text);
      this.resourceTexts.push(text);

      // 产出速率
      if (res.perSecond > 0) {
        const rateText = new Text({
          text: ` +${formatNumber(res.perSecond)}/s`,
          style: {
            fontSize: 10,
            fill: hexToNum(theme.success),
            fontFamily: 'monospace',
          },
        });
        rateText.anchor.set(0, 0.5);
        rateText.position.set(x + text.width + 2, y);
        this.resourceBar.addChild(rateText);
        this.resourceTexts.push(rateText);
        x += text.width + rateText.width + 20;
      } else {
        x += text.width + 20;
      }
    }
  }

  /**
   * 渲染建筑区域
   *
   * 使用资源作为"建筑"的简化表示。
   * 每个资源显示为一个卡片，包含名称、数量、产出速率。
   */
  private renderBuildingArea(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;
    const gap = layout.gridGap;
    const cols = layout.gridColumns;

    // 清除旧卡片
    for (const card of this.buildingCards) {
      card.destroy();
    }
    this.buildingCards = [];

    const baW = this.canvasWidth - this.canvasWidth * layout.statsPanelWidth;
    const cardW = Math.max(60, (baW - p * 2 - gap * (cols - 1)) / cols);
    const cardH = 60;

    for (let i = 0; i < state.resources.length; i++) {
      const res = state.resources[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = p + col * (cardW + gap);
      const y = p + row * (cardH + gap);

      const card = new Container({ label: `building-${res.id}` });
      card.position.set(x, y);

      // 卡片背景
      const bg = new Graphics();
      bg.roundRect(0, 0, cardW, cardH, layout.borderRadius);
      bg.fill(hexToNum(theme.panelBackground));
      bg.stroke({ color: hexToNum(theme.accent), width: 1 });
      card.addChild(bg);

      // 资源名称
      const nameText = new Text({
        text: res.name,
        style: {
          fontSize: 11,
          fill: hexToNum(theme.accent),
          fontWeight: 'bold',
        },
      });
      nameText.position.set(6, 4);
      card.addChild(nameText);

      // 数量
      const amountText = new Text({
        text: formatNumber(res.amount),
        style: {
          fontSize: 16,
          fill: hexToNum(theme.textPrimary),
          fontWeight: 'bold',
        },
      });
      amountText.position.set(6, 20);
      card.addChild(amountText);

      // 产出速率
      if (res.perSecond > 0) {
        const rateText = new Text({
          text: `+${formatNumber(res.perSecond)}/s`,
          style: {
            fontSize: 10,
            fill: hexToNum(theme.success),
          },
        });
        rateText.position.set(6, 42);
        card.addChild(rateText);
      }

      this.buildingArea.addChild(card);
      this.buildingCards.push(card);
    }
  }

  /**
   * 渲染升级面板
   *
   * 显示可购买的升级按钮，点击触发 upgradeClick 事件。
   */
  private renderUpgradePanel(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;
    const gap = layout.gridGap;

    // 清除旧按钮
    for (const btn of this.upgradeButtons) {
      btn.container.destroy();
    }
    this.upgradeButtons = [];

    const cols = Math.max(1, layout.gridColumns);
    const upW = this.canvasWidth;
    const btnW = Math.max(80, (upW - p * 2 - gap * (cols - 1)) / cols);
    const btnH = 50;

    for (let i = 0; i < state.upgrades.length; i++) {
      const upgrade = state.upgrades[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = p + col * (btnW + gap);
      const y = p + row * (btnH + gap);

      const btnContainer = new Container({ label: `upgrade-${upgrade.id}` });
      btnContainer.position.set(x, y);
      btnContainer.eventMode = 'static';
      btnContainer.cursor = 'pointer';

      // 按钮背景
      const bg = new Graphics();
      const bgColor = upgrade.canAfford ? theme.buttonBg : theme.panelBackground;
      const borderColor = upgrade.canAfford ? theme.success : theme.textSecondary;
      bg.roundRect(0, 0, btnW, btnH, layout.borderRadius);
      bg.fill(hexToNum(bgColor));
      bg.stroke({ color: hexToNum(borderColor), width: 1 });
      btnContainer.addChild(bg);

      // 名称
      const nameText = new Text({
        text: `${upgrade.name} Lv.${upgrade.level}`,
        style: {
          fontSize: 10,
          fill: hexToNum(upgrade.canAfford ? theme.textPrimary : theme.textSecondary),
          fontWeight: 'bold',
        },
      });
      nameText.position.set(4, 4);
      btnContainer.addChild(nameText);

      // 费用
      const costStr = Object.entries(upgrade.baseCost)
        .map(([k, v]) => `${v}${k}`)
        .join(' ');
      const costText = new Text({
        text: costStr,
        style: {
          fontSize: 9,
          fill: hexToNum(upgrade.canAfford ? theme.success : theme.warning),
        },
      });
      costText.position.set(4, 20);
      btnContainer.addChild(costText);

      // 描述
      const descText = new Text({
        text: upgrade.description.substring(0, 20),
        style: {
          fontSize: 8,
          fill: hexToNum(theme.textSecondary),
        },
      });
      descText.position.set(4, 34);
      btnContainer.addChild(descText);

      // 点击事件
      btnContainer.on('pointertap', () => {
        this.emit('upgradeClick', upgrade.id);
      });

      this.upgradePanel.addChild(btnContainer);
      this.upgradeButtons.push({
        container: btnContainer,
        background: bg,
        nameText,
        levelText: nameText,
        costText,
        upgradeId: upgrade.id,
      });
    }
  }

  /**
   * 渲染统计面板
   */
  private renderStatsPanel(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    // 清除旧文本
    for (const t of this.statsTexts) {
      t.destroy();
    }
    this.statsTexts = [];

    let y = p;

    // 标题
    const title = new Text({
      text: '📊 统计',
      style: {
        fontSize: 13,
        fill: hexToNum(theme.accent),
        fontWeight: 'bold',
      },
    });
    title.position.set(p, y);
    this.statsPanel.addChild(title);
    this.statsTexts.push(title);
    y += 22;

    // 声望
    const prestigeText = new Text({
      text: `声望: ${formatNumber(state.prestige.currency)}`,
      style: {
        fontSize: 11,
        fill: hexToNum(theme.textPrimary),
      },
    });
    prestigeText.position.set(p, y);
    this.statsPanel.addChild(prestigeText);
    this.statsTexts.push(prestigeText);
    y += 18;

    const countText = new Text({
      text: `转生: ${state.prestige.count}次`,
      style: {
        fontSize: 11,
        fill: hexToNum(theme.textSecondary),
      },
    });
    countText.position.set(p, y);
    this.statsPanel.addChild(countText);
    this.statsTexts.push(countText);
    y += 24;

    // 统计数据
    const entries = Object.entries(state.statistics);
    if (entries.length > 0) {
      const statsTitle = new Text({
        text: '📈 数据',
        style: {
          fontSize: 12,
          fill: hexToNum(theme.accent),
          fontWeight: 'bold',
        },
      });
      statsTitle.position.set(p, y);
      this.statsPanel.addChild(statsTitle);
      this.statsTexts.push(statsTitle);
      y += 18;

      for (const [key, value] of entries.slice(0, 10)) {
        const statText = new Text({
          text: `${key}: ${formatNumber(value)}`,
          style: {
            fontSize: 10,
            fill: hexToNum(theme.textSecondary),
          },
        });
        statText.position.set(p, y);
        this.statsPanel.addChild(statText);
        this.statsTexts.push(statText);
        y += 15;
      }
    }
  }

  /**
   * 渲染游戏标题
   */
  private renderTitle(state: IdleGameRenderState): void {
    this.titleText.text = state.gameId;
    this.titleText.visible = true;
  }

  /**
   * 触发事件
   */
  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(...args);
      } catch (err) {
        console.error(`[IdleScene] Error in event "${event}":`, err);
      }
    });
  }
}
