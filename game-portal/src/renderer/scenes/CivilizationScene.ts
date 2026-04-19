/**
 * renderer/scenes/CivilizationScene.ts — 通用文明放置游戏场景
 *
 * 继承 IdleScene 的基础布局理念，增加文明特有元素：
 * - 朝代/时代进度条（顶部）
 * - 科技树面板（侧边可展开）
 * - 军事单位展示区
 * - 贸易路线可视化
 *
 * 使用 PixiJS Graphics 程序化绘制所有 UI。
 * 支持主题色切换（根据不同文明加载不同颜色方案）。
 *
 * 布局结构：
 * ┌────────────────────────────────────────────────────────┐
 * │           朝代/时代进度条（顶部）                        │
 * ├────────────────────────────────────────────────────────┤
 * │                 资源栏                                  │
 * ├──────────────────────────────┬─────────────────────────┤
 * │                              │                         │
 * │         建筑区域             │   科技树面板（可折叠）   │
 * │       （网格布局）           │   军事单位展示          │
 * │                              │   贸易路线              │
 * ├──────────────────────────────┴─────────────────────────┤
 * │                  升级面板（底部）                        │
 * └────────────────────────────────────────────────────────┘
 *
 * @module renderer/scenes/CivilizationScene
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { RenderStrategy, IdleGameRenderState } from '../types';
import { CivIconRenderer, type CivilizationId } from '../CivIconRenderer';

// ═══════════════════════════════════════════════════════════════
// 事件类型
// ═══════════════════════════════════════════════════════════════

/** CivilizationScene 事件映射 */
export interface CivilizationSceneEventMap {
  /** 点击升级按钮 */
  upgradeClick: [upgradeId: string];
  /** 点击科技节点 */
  techClick: [techId: string];
  /** 切换科技树面板 */
  toggleTechPanel: [];
  /** 点击时代/朝代 */
  eraClick: [eraId: string];
}

type CivSceneEventCallback = (...args: any[]) => void;

// ═══════════════════════════════════════════════════════════════
// 文明渲染状态扩展
// ═══════════════════════════════════════════════════════════════

/** 文明场景扩展状态 */
export interface CivilizationRenderState extends IdleGameRenderState {
  /** 当前时代/朝代 */
  currentEra?: {
    id: string;
    name: string;
    description: string;
    progress: number; // 0~1
    multiplier: number;
    themeColor: string;
  };
  /** 时代列表 */
  eras?: Array<{
    id: string;
    name: string;
    completed: boolean;
    current: boolean;
    locked: boolean;
  }>;
  /** 科技列表 */
  techs?: Array<{
    id: string;
    name: string;
    state: 'locked' | 'available' | 'researching' | 'completed';
    progress: number;
    tier: number;
  }>;
  /** 军事单位 */
  units?: Array<{
    id: string;
    name: string;
    level: number;
    unlocked: boolean;
  }>;
  /** 贸易路线 */
  tradeRoutes?: Array<{
    id: string;
    from: string;
    to: string;
    profit: number;
    isActive: boolean;
  }>;
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
// CivilizationScene
// ═══════════════════════════════════════════════════════════════

/**
 * 通用文明放置游戏场景
 *
 * 在 IdleScene 基础上增加文明特有元素：
 * - 时代进度条
 * - 科技树面板
 * - 军事单位展示
 * - 贸易路线
 */
export class CivilizationScene {
  // ─── PixiJS 对象 ────────────────────────────────────────

  /** 场景根容器 */
  private container: Container;
  /** 时代进度条容器 */
  private eraBar: Container;
  private eraBarBg: Graphics;
  private eraProgressFill: Graphics;
  private eraTexts: Text[] = [];
  private eraMarkers: Container[] = [];

  /** 资源栏容器 */
  private resourceBar: Container;
  private resourceBarBg: Graphics;
  private resourceTexts: Text[] = [];

  /** 建筑区域容器 */
  private buildingArea: Container;
  private buildingAreaBg: Graphics;
  private buildingCards: Container[] = [];

  /** 升级面板容器 */
  private upgradePanel: Container;
  private upgradePanelBg: Graphics;
  private upgradeButtons: Container[] = [];

  /** 科技树面板容器（侧边可展开） */
  private techPanel: Container;
  private techPanelBg: Graphics;
  private techNodes: Container[] = [];
  private techPanelOpen: boolean = false;

  /** 军事单位展示区 */
  private unitDisplay: Container;
  private unitDisplayBg: Graphics;
  private unitCards: Container[] = [];

  /** 贸易路线可视化 */
  private tradeDisplay: Container;
  private tradeDisplayBg: Graphics;
  private tradeLines: Container[] = [];

  /** 游戏标题 */
  private titleText: Text;

  // ─── 配置 ───────────────────────────────────────────────

  private strategy: RenderStrategy;
  private civId: CivilizationId;
  private iconRenderer: CivIconRenderer;

  // ─── 状态 ───────────────────────────────────────────────

  private active: boolean = false;
  private currentState: CivilizationRenderState | null = null;
  private canvasWidth: number = 800;
  private canvasHeight: number = 600;

  // ─── 事件 ───────────────────────────────────────────────

  private listeners: Map<string, Set<CivSceneEventCallback>> = new Map();

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  constructor(strategy: RenderStrategy, civId: CivilizationId) {
    this.strategy = strategy;
    this.civId = civId;
    this.iconRenderer = new CivIconRenderer(civId);

    // 创建根容器
    this.container = new Container({ label: 'civilization-scene' });

    // 创建时代进度条
    this.eraBar = new Container({ label: 'era-bar' });
    this.eraBarBg = new Graphics();
    this.eraProgressFill = new Graphics();
    this.eraBar.addChild(this.eraBarBg);
    this.eraBar.addChild(this.eraProgressFill);

    // 创建资源栏
    this.resourceBar = new Container({ label: 'resource-bar' });
    this.resourceBarBg = new Graphics();
    this.resourceBar.addChild(this.resourceBarBg);

    // 创建建筑区域
    this.buildingArea = new Container({ label: 'building-area' });
    this.buildingAreaBg = new Graphics();
    this.buildingArea.addChild(this.buildingAreaBg);

    // 创建升级面板
    this.upgradePanel = new Container({ label: 'upgrade-panel' });
    this.upgradePanelBg = new Graphics();
    this.upgradePanel.addChild(this.upgradePanelBg);

    // 创建科技树面板
    this.techPanel = new Container({ label: 'tech-panel' });
    this.techPanelBg = new Graphics();
    this.techPanel.addChild(this.techPanelBg);
    this.techPanel.visible = false;

    // 创建军事单位展示
    this.unitDisplay = new Container({ label: 'unit-display' });
    this.unitDisplayBg = new Graphics();
    this.unitDisplay.addChild(this.unitDisplayBg);

    // 创建贸易路线
    this.tradeDisplay = new Container({ label: 'trade-display' });
    this.tradeDisplayBg = new Graphics();
    this.tradeDisplay.addChild(this.tradeDisplayBg);

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
    this.container.addChild(this.eraBar);
    this.container.addChild(this.resourceBar);
    this.container.addChild(this.buildingArea);
    this.container.addChild(this.upgradePanel);
    this.container.addChild(this.techPanel);
    this.container.addChild(this.unitDisplay);
    this.container.addChild(this.tradeDisplay);
    this.container.addChild(this.titleText);
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  async enter(): Promise<void> {
    this.container.visible = true;
    this.active = true;
    this.layout();
  }

  async exit(): Promise<void> {
    this.active = false;
    this.container.visible = false;
  }

  update(deltaTime: number): void {
    if (!this.active) return;
    void deltaTime;
  }

  destroy(): void {
    this.active = false;
    this.iconRenderer.destroy();
    this.container.destroy({ children: true });
    this.listeners.clear();
  }

  // ═══════════════════════════════════════════════════════════
  // 状态更新
  // ═══════════════════════════════════════════════════════════

  updateState(state: CivilizationRenderState): void {
    if (!this.active) return;
    this.currentState = state;
    this.renderEraBar(state);
    this.renderResourceBar(state);
    this.renderBuildingArea(state);
    this.renderUpgradePanel(state);
    this.renderTechPanel(state);
    this.renderUnitDisplay(state);
    this.renderTradeDisplay(state);
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

  getCurrentState(): CivilizationRenderState | null {
    return this.currentState;
  }

  isTechPanelOpen(): boolean {
    return this.techPanelOpen;
  }

  getCivId(): CivilizationId {
    return this.civId;
  }

  getIconRenderer(): CivIconRenderer {
    return this.iconRenderer;
  }

  // ═══════════════════════════════════════════════════════════
  // 科技树面板控制
  // ═══════════════════════════════════════════════════════════

  toggleTechPanel(): void {
    this.techPanelOpen = !this.techPanelOpen;
    this.techPanel.visible = this.techPanelOpen;
    this.emit('toggleTechPanel');
  }

  openTechPanel(): void {
    this.techPanelOpen = true;
    this.techPanel.visible = true;
  }

  closeTechPanel(): void {
    this.techPanelOpen = false;
    this.techPanel.visible = false;
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

  private layout(): void {
    const { layout, theme } = this.strategy;
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    const br = layout.borderRadius;

    // ── 时代进度条（最顶部，高 40px）────────────────────
    const eraH = 40;
    this.eraBar.position.set(0, 0);
    this.eraBarBg.clear();
    this.eraBarBg.roundRect(0, 0, w, eraH, br);
    this.eraBarBg.fill(hexToNum(theme.panelBackground));

    // ── 资源栏（时代条下方）─────────────────────────────
    const rbY = eraH;
    const rbH = h * layout.resourceBarHeight;
    this.resourceBar.position.set(0, rbY);
    this.resourceBarBg.clear();
    this.resourceBarBg.roundRect(0, 0, w, rbH, br);
    this.resourceBarBg.fill(hexToNum(theme.resourceBarBg));

    // ── 科技树面板（右侧浮动，可展开）──────────────────
    const tpW = w * 0.3;
    const tpH = h * 0.6;
    const tpX = w - tpW;
    const tpY = rbY + rbH;
    this.techPanel.position.set(tpX, tpY);
    this.techPanelBg.clear();
    this.techPanelBg.roundRect(0, 0, tpW, tpH, br);
    this.techPanelBg.fill(hexToNum(theme.panelBackground));
    this.techPanelBg.stroke({ color: hexToNum(theme.accent), width: 1 });

    // ── 建筑区域（中部）────────────────────────────────
    const spW = this.techPanelOpen ? w * 0.3 : 0;
    const baW = w - spW;
    const baY = rbY + rbH;
    const baH = h * layout.buildingAreaHeight;
    this.buildingArea.position.set(0, baY);
    this.buildingAreaBg.clear();
    this.buildingAreaBg.roundRect(0, 0, baW, baH, 0);
    this.buildingAreaBg.fill(hexToNum(theme.background));

    // ── 升级面板（底部）────────────────────────────────
    const upH = h * layout.upgradePanelHeight;
    const upY = h - upH;
    this.upgradePanel.position.set(0, upY);
    this.upgradePanelBg.clear();
    this.upgradePanelBg.roundRect(0, 0, w, upH, br);
    this.upgradePanelBg.fill(hexToNum(theme.panelBackground));

    // ── 军事单位展示区（建筑区域右下角）────────────────
    const udW = 120;
    const udH = 80;
    const udX = baW - udW - 8;
    const udY = baH - udH - 8;
    this.unitDisplay.position.set(udX, udY);
    this.unitDisplayBg.clear();
    this.unitDisplayBg.roundRect(0, 0, udW, udH, br);
    this.unitDisplayBg.fill(hexToNum(theme.panelBackground));
    this.unitDisplayBg.stroke({ color: hexToNum(theme.accent), width: 1 });

    // ── 贸易路线可视化（建筑区域左下角）────────────────
    const tdW = 120;
    const tdH = 80;
    const tdX = 8;
    const tdY = baH - tdH - 8;
    this.tradeDisplay.position.set(tdX, tdY);
    this.tradeDisplayBg.clear();
    this.tradeDisplayBg.roundRect(0, 0, tdW, tdH, br);
    this.tradeDisplayBg.fill(hexToNum(theme.panelBackground));
    this.tradeDisplayBg.stroke({ color: hexToNum(theme.warning), width: 1 });

    // ── 标题 ────────────────────────────────────────────
    this.titleText.position.set(layout.padding, layout.padding);
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法 — 渲染
  // ═══════════════════════════════════════════════════════════

  /** 渲染时代进度条 */
  private renderEraBar(state: CivilizationRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    // 清除旧文本
    for (const t of this.eraTexts) t.destroy();
    this.eraTexts = [];
    for (const m of this.eraMarkers) m.destroy();
    this.eraMarkers = [];

    const w = this.canvasWidth;
    const eraH = 40;

    // 绘制进度条填充
    this.eraProgressFill.clear();
    if (state.currentEra) {
      const progress = state.currentEra.progress;
      const fillW = w * progress;
      const themeColor = state.currentEra.themeColor || theme.accent;
      this.eraProgressFill.roundRect(0, 0, fillW, eraH, layout.borderRadius);
      this.eraProgressFill.fill(hexToNum(themeColor));

      // 当前时代名称
      const eraName = new Text({
        text: `${state.currentEra.name} — ${state.currentEra.description}`,
        style: {
          fontSize: 12,
          fill: hexToNum(theme.textPrimary),
          fontWeight: 'bold',
          fontFamily: 'monospace',
        },
      });
      eraName.position.set(p, eraH / 2 - 6);
      this.eraBar.addChild(eraName);
      this.eraTexts.push(eraName);

      // 进度百分比
      const progressText = new Text({
        text: `${(progress * 100).toFixed(1)}%`,
        style: {
          fontSize: 10,
          fill: hexToNum(theme.success),
          fontFamily: 'monospace',
        },
      });
      progressText.position.set(w - 60, eraH / 2 - 5);
      this.eraBar.addChild(progressText);
      this.eraTexts.push(progressText);

      // 倍率
      const multText = new Text({
        text: `×${state.currentEra.multiplier.toFixed(1)}`,
        style: {
          fontSize: 10,
          fill: hexToNum(theme.accent),
          fontFamily: 'monospace',
        },
      });
      multText.position.set(w - 110, eraH / 2 - 5);
      this.eraBar.addChild(multText);
      this.eraTexts.push(multText);
    }

    // 时代标记
    if (state.eras && state.eras.length > 0) {
      const markerY = eraH - 8;
      const totalW = w - p * 2;
      const markerGap = totalW / Math.max(1, state.eras.length - 1);

      for (let i = 0; i < state.eras.length; i++) {
        const era = state.eras[i];
        const mx = p + i * markerGap;
        const marker = new Container({ label: `era-marker-${era.id}` });

        const dot = new Graphics();
        const color = era.completed
          ? theme.success
          : era.current
            ? theme.accent
            : theme.textSecondary;
        dot.circle(0, 0, 4);
        dot.fill(hexToNum(color));
        if (era.current) {
          dot.circle(0, 0, 6);
          dot.stroke({ color: hexToNum(theme.accent), width: 1 });
        }
        marker.addChild(dot);
        marker.position.set(mx, markerY);
        marker.eventMode = 'static';
        marker.cursor = 'pointer';
        marker.on('pointertap', () => this.emit('eraClick', era.id));

        this.eraBar.addChild(marker);
        this.eraMarkers.push(marker);

        // 时代名称
        const label = new Text({
          text: era.name,
          style: {
            fontSize: 8,
            fill: hexToNum(color),
            fontFamily: 'monospace',
          },
        });
        label.anchor.set(0.5, 0);
        label.position.set(mx, markerY + 6);
        this.eraBar.addChild(label);
        this.eraTexts.push(label);
      }
    }
  }

  /** 渲染资源栏 */
  private renderResourceBar(state: CivilizationRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    for (const t of this.resourceTexts) t.destroy();
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

  /** 渲染建筑区域 */
  private renderBuildingArea(state: CivilizationRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;
    const gap = layout.gridGap;
    const cols = layout.gridColumns;

    for (const card of this.buildingCards) card.destroy();
    this.buildingCards = [];

    const spW = this.techPanelOpen ? this.canvasWidth * 0.3 : 0;
    const baW = this.canvasWidth - spW;
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

      // 文明图标
      try {
        const icon = this.iconRenderer.drawIcon(res.id, 20);
        icon.position.set(cardW - 24, 4);
        card.addChild(icon);
      } catch {
        // 图标不存在则忽略
      }

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

  /** 渲染升级面板 */
  private renderUpgradePanel(state: CivilizationRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;
    const gap = layout.gridGap;
    const cols = Math.max(1, layout.gridColumns);

    for (const btn of this.upgradeButtons) btn.destroy();
    this.upgradeButtons = [];

    const btnW = Math.max(80, (this.canvasWidth - p * 2 - gap * (cols - 1)) / cols);
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

      const bg = new Graphics();
      const bgColor = upgrade.canAfford ? theme.buttonBg : theme.panelBackground;
      const borderColor = upgrade.canAfford ? theme.success : theme.textSecondary;
      bg.roundRect(0, 0, btnW, btnH, layout.borderRadius);
      bg.fill(hexToNum(bgColor));
      bg.stroke({ color: hexToNum(borderColor), width: 1 });
      btnContainer.addChild(bg);

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

      const descText = new Text({
        text: upgrade.description.substring(0, 20),
        style: {
          fontSize: 8,
          fill: hexToNum(theme.textSecondary),
        },
      });
      descText.position.set(4, 34);
      btnContainer.addChild(descText);

      btnContainer.on('pointertap', () => {
        this.emit('upgradeClick', upgrade.id);
      });

      this.upgradePanel.addChild(btnContainer);
      this.upgradeButtons.push(btnContainer);
    }
  }

  /** 渲染科技树面板 */
  private renderTechPanel(state: CivilizationRenderState): void {
    if (!this.techPanelOpen) return;

    const { theme, layout } = this.strategy;
    const p = layout.padding;

    for (const node of this.techNodes) node.destroy();
    this.techNodes = [];

    if (!state.techs || state.techs.length === 0) return;

    const tpW = this.canvasWidth * 0.3;
    const nodeW = tpW - p * 2;
    const nodeH = 30;
    const gapY = 4;

    // 标题
    const title = new Text({
      text: '🔬 科技树',
      style: {
        fontSize: 13,
        fill: hexToNum(theme.accent),
        fontWeight: 'bold',
      },
    });
    title.position.set(p, p);
    this.techPanel.addChild(title);
    this.techNodes.push(title);

    let y = p + 22;

    for (const tech of state.techs) {
      const nodeContainer = new Container({ label: `tech-${tech.id}` });
      nodeContainer.position.set(p, y);

      const bg = new Graphics();
      const color = tech.state === 'completed'
        ? theme.success
        : tech.state === 'researching'
          ? theme.accent
          : tech.state === 'available'
            ? theme.buttonBg
            : theme.panelBackground;
      bg.roundRect(0, 0, nodeW, nodeH, layout.borderRadius);
      bg.fill(hexToNum(color));
      bg.stroke({ color: hexToNum(theme.textSecondary), width: 0.5 });
      nodeContainer.addChild(bg);

      // 进度条（研究中的科技）
      if (tech.state === 'researching' && tech.progress > 0) {
        const progressBg = new Graphics();
        progressBg.roundRect(0, nodeH - 4, nodeW * tech.progress, 4, 2);
        progressBg.fill(hexToNum(theme.success));
        nodeContainer.addChild(progressBg);
      }

      const nameText = new Text({
        text: `${tech.state === 'completed' ? '✅' : tech.state === 'researching' ? '🔄' : '🔒'} ${tech.name}`,
        style: {
          fontSize: 10,
          fill: hexToNum(tech.state === 'locked' ? theme.textSecondary : theme.textPrimary),
        },
      });
      nameText.position.set(4, 4);
      nodeContainer.addChild(nameText);

      nodeContainer.eventMode = 'static';
      nodeContainer.cursor = 'pointer';
      nodeContainer.on('pointertap', () => this.emit('techClick', tech.id));

      this.techPanel.addChild(nodeContainer);
      this.techNodes.push(nodeContainer);
      y += nodeH + gapY;
    }
  }

  /** 渲染军事单位展示 */
  private renderUnitDisplay(state: CivilizationRenderState): void {
    const { theme, layout } = this.strategy;
    const p = 4;

    for (const card of this.unitCards) card.destroy();
    this.unitCards = [];

    if (!state.units || state.units.length === 0) {
      const noUnitText = new Text({
        text: '⚔️ 无单位',
        style: { fontSize: 9, fill: hexToNum(theme.textSecondary) },
      });
      noUnitText.position.set(p, p);
      this.unitDisplay.addChild(noUnitText);
      this.unitCards.push(noUnitText);
      return;
    }

    let y = p;
    for (const unit of state.units.slice(0, 4)) {
      const card = new Container({ label: `unit-${unit.id}` });

      const color = unit.unlocked ? theme.accent : theme.textSecondary;
      const text = new Text({
        text: `${unit.unlocked ? '⚔️' : '🔒'} ${unit.name} Lv.${unit.level}`,
        style: {
          fontSize: 9,
          fill: hexToNum(color),
        },
      });
      text.position.set(p, y);
      card.addChild(text);

      this.unitDisplay.addChild(card);
      this.unitCards.push(card);
      y += 14;
    }
  }

  /** 渲染贸易路线可视化 */
  private renderTradeDisplay(state: CivilizationRenderState): void {
    const { theme, layout } = this.strategy;
    const p = 4;

    for (const line of this.tradeLines) line.destroy();
    this.tradeLines = [];

    if (!state.tradeRoutes || state.tradeRoutes.length === 0) {
      const noTradeText = new Text({
        text: '💰 无贸易',
        style: { fontSize: 9, fill: hexToNum(theme.textSecondary) },
      });
      noTradeText.position.set(p, p);
      this.tradeDisplay.addChild(noTradeText);
      this.tradeLines.push(noTradeText);
      return;
    }

    let y = p;
    for (const route of state.tradeRoutes.slice(0, 4)) {
      const line = new Container({ label: `trade-${route.id}` });

      const color = route.isActive ? theme.success : theme.textSecondary;
      const text = new Text({
        text: `${route.isActive ? '🚃' : '⏸'} ${route.from}→${route.to} +${formatNumber(route.profit)}`,
        style: {
          fontSize: 8,
          fill: hexToNum(color),
        },
      });
      text.position.set(p, y);
      line.addChild(text);

      this.tradeDisplay.addChild(line);
      this.tradeLines.push(line);
      y += 14;
    }
  }

  /** 渲染标题 */
  private renderTitle(state: CivilizationRenderState): void {
    this.titleText.text = state.gameId;
    this.titleText.visible = true;
  }

  /** 触发事件 */
  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(...args);
      } catch (err) {
        console.error(`[CivilizationScene] Error in event "${event}":`, err);
      }
    });
  }
}
