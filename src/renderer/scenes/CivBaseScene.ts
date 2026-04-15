/**
 * renderer/scenes/CivBaseScene.ts — 文明放置游戏场景基类
 *
 * 为四大文明游戏提供共享的 PixiJS 渲染场景。
 * 继承 IdleScene 的通用功能，添加文明特有 UI 元素：
 * - 文化点数显示
 * - 信仰/天命/神眷/业力值显示
 * - 科技进度条
 * - 文明特色建筑（程序化绘制）
 *
 * @module renderer/scenes/CivBaseScene
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { RenderStrategy, IdleGameRenderState } from '../types';

// ═══════════════════════════════════════════════════════════════
// 事件类型
// ═══════════════════════════════════════════════════════════════

/** CivBaseScene 事件映射 */
export interface CivSceneEventMap {
  upgradeClick: [upgradeId: string];
  buildingClick: [buildingId: string];
}

type CivSceneEventCallback = (...args: any[]) => void;

// ═══════════════════════════════════════════════════════════════
// 文明特有 UI 数据
// ═══════════════════════════════════════════════════════════════

/** 文明扩展渲染状态 */
export interface CivRenderState extends IdleGameRenderState {
  /** 文明特有资源（文化、信仰等） */
  civResources?: Array<{
    id: string;
    name: string;
    amount: number;
    perSecond: number;
    icon?: string;
  }>;
  /** 当前时代/朝代 */
  era?: {
    id: string;
    name: string;
    description?: string;
  };
  /** 声望系统名称（天命/神恩/神眷/业力） */
  prestigeName?: string;
  /** 单位类型名称（官员/神明/英雄） */
  unitTypeName?: string;
}

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
// CivBaseScene
// ═══════════════════════════════════════════════════════════════

/**
 * 文明放置游戏场景基类
 *
 * 提供通用的文明 UI 布局，子类可覆盖建筑绘制方法实现特色建筑。
 */
export class CivBaseScene {
  // ─── PixiJS 对象 ────────────────────────────────────────

  /** 场景根容器 */
  protected container: Container;
  /** 资源栏容器 */
  protected resourceBar: Container;
  /** 资源栏背景 */
  protected resourceBarBg: Graphics;
  /** 资源文本列表 */
  protected resourceTexts: Text[] = [];
  /** 建筑区域容器 */
  protected buildingArea: Container;
  /** 建筑区域背景 */
  protected buildingAreaBg: Graphics;
  /** 建筑卡片列表 */
  protected buildingCards: Container[] = [];
  /** 升级面板容器 */
  protected upgradePanel: Container;
  /** 升级面板背景 */
  protected upgradePanelBg: Graphics;
  /** 升级按钮列表 */
  protected upgradeButtons: Container[] = [];
  /** 统计面板容器 */
  protected statsPanel: Container;
  /** 统计面板背景 */
  protected statsPanelBg: Graphics;
  /** 统计文本列表 */
  protected statsTexts: Text[] = [];
  /** 游戏标题文本 */
  protected titleText: Text;
  /** 文明信息栏（时代/朝代） */
  protected eraBar: Container;
  protected eraBarBg: Graphics;
  protected eraTexts: Text[] = [];

  // ─── 配置 ───────────────────────────────────────────────

  /** 渲染策略 */
  protected strategy: RenderStrategy;
  /** 文明标识 */
  protected civId: string = '';
  /** 声望系统名称 */
  protected prestigeName: string = '声望';
  /** 单位类型名称 */
  protected unitTypeName: string = '英雄';

  // ─── 状态 ───────────────────────────────────────────────

  /** 是否已激活 */
  protected active: boolean = false;
  /** 当前渲染状态 */
  protected currentState: CivRenderState | null = null;
  /** 当前画布尺寸 */
  protected canvasWidth: number = 800;
  protected canvasHeight: number = 600;

  // ─── 事件 ───────────────────────────────────────────────

  protected listeners: Map<string, Set<CivSceneEventCallback>> = new Map();

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  constructor(strategy: RenderStrategy, civId: string) {
    this.strategy = strategy;
    this.civId = civId;

    // 创建根容器
    this.container = new Container({ label: `civ-scene-${civId}` });

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

    // 时代信息栏
    this.eraBar = new Container({ label: 'era-bar' });
    this.eraBarBg = new Graphics();
    this.eraBar.addChild(this.eraBarBg);

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
    this.container.addChild(this.eraBar);
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
   */
  update(deltaTime: number): void {
    if (!this.active) return;
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
   */
  updateState(state: CivRenderState): void {
    if (!this.active) return;
    this.currentState = state;
    this.renderResourceBar(state);
    this.renderEraBar(state);
    this.renderBuildingArea(state);
    this.renderUpgradePanel(state);
    this.renderStatsPanel(state);
    this.renderTitle(state);
  }

  // ═══════════════════════════════════════════════════════════
  // 响应式布局
  // ═══════════════════════════════════════════════════════════

  resize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.layout();
    if (this.currentState) {
      this.updateState(this.currentState);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 公共访问器
  // ═══════════════════════════════════════════════════════════

  getContainer(): Container {
    return this.container;
  }

  isActive(): boolean {
    return this.active;
  }

  getCurrentState(): CivRenderState | null {
    return this.currentState;
  }

  getCivId(): string {
    return this.civId;
  }

  getStrategy(): RenderStrategy {
    return this.strategy;
  }

  // ═══════════════════════════════════════════════════════════
  // 事件系统
  // ═══════════════════════════════════════════════════════════

  on(event: string, callback: CivSceneEventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: CivSceneEventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法 — 布局
  // ═══════════════════════════════════════════════════════════

  protected layout(): void {
    const { layout, theme } = this.strategy;
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    const br = layout.borderRadius;

    // ── 资源栏（顶部）─────────────────────────────────────
    const rbH = h * layout.resourceBarHeight;
    this.resourceBar.position.set(0, 0);
    this.resourceBarBg.clear();
    this.resourceBarBg.roundRect(0, 0, w, rbH, br);
    this.resourceBarBg.fill(hexToNum(theme.resourceBarBg));

    // ── 时代信息栏（资源栏下方）───────────────────────────
    const eraH = 24;
    this.eraBar.position.set(0, rbH);
    this.eraBarBg.clear();
    this.eraBarBg.roundRect(0, 0, w, eraH, 0);
    this.eraBarBg.fill(hexToNum(theme.panelBackground));

    // ── 统计面板（右侧）───────────────────────────────────
    const spW = w * layout.statsPanelWidth;
    const spH = h - rbH - eraH;
    this.statsPanel.position.set(w - spW, rbH + eraH);
    this.statsPanelBg.clear();
    this.statsPanelBg.roundRect(0, 0, spW, spH, br);
    this.statsPanelBg.fill(hexToNum(theme.panelBackground));

    // ── 建筑区域（中部）───────────────────────────────────
    const baW = w - spW;
    const baH = h * layout.buildingAreaHeight;
    const baY = rbH + eraH;
    this.buildingArea.position.set(0, baY);
    this.buildingAreaBg.clear();
    this.buildingAreaBg.roundRect(0, 0, baW, baH, 0);
    this.buildingAreaBg.fill(hexToNum(theme.background));

    // ── 升级面板（底部）───────────────────────────────────
    const upH = h * layout.upgradePanelHeight;
    const upY = h - upH;
    this.upgradePanel.position.set(0, upY);
    this.upgradePanelBg.clear();
    this.upgradePanelBg.roundRect(0, 0, w, upH, br);
    this.upgradePanelBg.fill(hexToNum(theme.panelBackground));

    // ── 标题 ──────────────────────────────────────────────
    this.titleText.position.set(layout.padding, layout.padding);
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法 — 渲染
  // ═══════════════════════════════════════════════════════════

  /**
   * 渲染资源栏
   */
  protected renderResourceBar(state: CivRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    // 清除旧文本
    for (const t of this.resourceTexts) {
      t.destroy();
    }
    this.resourceTexts = [];

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
   * 渲染时代信息栏
   */
  protected renderEraBar(state: CivRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    for (const t of this.eraTexts) {
      t.destroy();
    }
    this.eraTexts = [];

    const era = state.era;
    if (era) {
      const eraText = new Text({
        text: `🏛️ ${era.name}${era.description ? ` — ${era.description}` : ''}`,
        style: {
          fontSize: 12,
          fill: hexToNum(theme.accent),
          fontWeight: 'bold',
        },
      });
      eraText.position.set(p, 5);
      this.eraBar.addChild(eraText);
      this.eraTexts.push(eraText);
    }

    // 声望信息
    const prestigeLabel = state.prestigeName || this.prestigeName;
    const prestigeText = new Text({
      text: `${prestigeLabel}: ${formatNumber(state.prestige.currency)} | 转生: ${state.prestige.count}次`,
      style: {
        fontSize: 11,
        fill: hexToNum(theme.textSecondary),
      },
    });
    prestigeText.anchor.set(1, 0);
    prestigeText.position.set(this.canvasWidth - p, 6);
    this.eraBar.addChild(prestigeText);
    this.eraTexts.push(prestigeText);
  }

  /**
   * 渲染建筑区域 — 子类可覆盖以绘制文明特色建筑
   */
  protected renderBuildingArea(state: CivRenderState): void {
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
    const cardH = 70;

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

      // 绘制文明特色建筑图标
      this.drawBuildingIcon(card, res.id, cardW, cardH, theme);

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
   * 绘制文明特色建筑图标 — 子类应覆盖此方法
   */
  protected drawBuildingIcon(
    _card: Container,
    _resourceId: string,
    _cardW: number,
    _cardH: number,
    _theme: RenderStrategy['theme'],
  ): void {
    // 默认不绘制，子类覆盖
  }

  /**
   * 渲染升级面板
   */
  protected renderUpgradePanel(state: CivRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;
    const gap = layout.gridGap;

    // 清除旧按钮
    for (const btn of this.upgradeButtons) {
      btn.destroy();
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
      this.upgradeButtons.push(btnContainer);
    }
  }

  /**
   * 渲染统计面板
   */
  protected renderStatsPanel(state: CivRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

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
    const prestigeLabel = state.prestigeName || this.prestigeName;
    const prestigeText = new Text({
      text: `${prestigeLabel}: ${formatNumber(state.prestige.currency)}`,
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
  protected renderTitle(state: CivRenderState): void {
    this.titleText.text = state.gameId;
    this.titleText.visible = true;
  }

  /**
   * 触发事件
   */
  protected emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(...args);
      } catch (err) {
        console.error(`[CivBaseScene] Error in event "${event}":`, err);
      }
    });
  }
}
