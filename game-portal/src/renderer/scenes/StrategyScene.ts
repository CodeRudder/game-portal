/**
 * renderer/scenes/StrategyScene.ts — 策略游戏通用场景
 *
 * 为策略类放置游戏（全面战争、英雄无敌、帝国时代）提供统一的 PixiJS 渲染场景。
 * 复用 IdleScene 的基础布局模式，增加策略游戏特有元素。
 *
 * 布局结构：
 * ┌──────────────────────────────────────────────────────────────┐
 * │                    资源栏（顶部）                              │
 * ├──────────────────────┬───────────────────┬───────────────────┤
 * │                      │                   │                   │
 * │    领地/地图概览      │   军队/英雄编队    │   科技研究进度     │
 * │   （小型地图区域）    │  （兵种/英雄列表）  │   （进度条列表）   │
 * │                      │                   │                   │
 * ├──────────────────────┴───────────────────┴───────────────────┤
 * │              资源采集点 + 外交面板（底部）                      │
 * └──────────────────────────────────────────────────────────────┘
 *
 * @module renderer/scenes/StrategyScene
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { RenderStrategy, IdleGameRenderState } from '../types';
import { StrategyIconRenderer } from '../StrategyIconRenderer';
import type { StrategyIconType } from '../StrategyIconRenderer';

// ═══════════════════════════════════════════════════════════════
// 事件类型
// ═══════════════════════════════════════════════════════════════

/** StrategyScene 事件映射 */
export interface StrategySceneEventMap {
  /** 点击升级按钮 */
  upgradeClick: [upgradeId: string];
  /** 点击领土 */
  territoryClick: [territoryId: string];
  /** 点击军队/英雄 */
  unitClick: [unitId: string];
  /** 点击科技 */
  techClick: [techId: string];
  /** 点击外交选项 */
  diplomacyClick: [action: string];
}

type StrategySceneEventCallback = (...args: any[]) => void;

// ═══════════════════════════════════════════════════════════════
// 策略游戏扩展渲染状态
// ═══════════════════════════════════════════════════════════════

/** 领土渲染信息 */
export interface TerritoryInfo {
  id: string;
  name: string;
  conquered: boolean;
  powerRequired?: number;
}

/** 军队/英雄编队信息 */
export interface UnitInfo {
  id: string;
  name: string;
  type: string;
  count: number;
  level: number;
  power: number;
  unlocked: boolean;
}

/** 科技研究信息 */
export interface TechInfo {
  id: string;
  name: string;
  progress: number; // 0~1
  state: 'locked' | 'available' | 'researching' | 'completed';
}

/** 资源采集点信息 */
export interface ResourcePointInfo {
  id: string;
  type: string;
  name: string;
  level: number;
  output: number;
  isActive: boolean;
}

/** 外交/联盟信息 */
export interface DiplomacyInfo {
  id: string;
  name: string;
  relation: 'ally' | 'neutral' | 'enemy';
  strength: number;
}

/** 策略游戏完整渲染状态（扩展 IdleGameRenderState） */
export interface StrategyGameRenderState extends IdleGameRenderState {
  /** 领土列表 */
  territories?: TerritoryInfo[];
  /** 军队/英雄编队 */
  units?: UnitInfo[];
  /** 科技研究列表 */
  techs?: TechInfo[];
  /** 资源采集点 */
  resourcePoints?: ResourcePointInfo[];
  /** 外交/联盟信息 */
  diplomacy?: DiplomacyInfo[];
  /** 当前时代/阶段名称 */
  eraName?: string;
  /** 总战斗力 */
  totalPower?: number;
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

/** 资源类型到图标类型的映射 */
const RESOURCE_ICON_MAP: Record<string, StrategyIconType> = {
  gold: 'gold',
  wood: 'wood',
  stone: 'stone',
  food: 'food',
  iron: 'stone',
  troop: 'sword',
  gems: 'gold',
  crystal: 'gold',
  magic: 'gold',
};

/** 资源类型到图标类型的映射（获取默认图标） */
function getResourceIcon(resourceId: string): StrategyIconType {
  return RESOURCE_ICON_MAP[resourceId] ?? 'gold';
}

// ═══════════════════════════════════════════════════════════════
// StrategyScene
// ═══════════════════════════════════════════════════════════════

/**
 * 策略游戏通用场景
 *
 * 支持全面战争、英雄无敌、帝国时代三款策略游戏的渲染。
 * 通过不同的 RenderStrategy 切换颜色主题。
 */
export class StrategyScene {
  // ─── PixiJS 对象 ────────────────────────────────────────

  /** 场景根容器 */
  private container: Container;
  /** 资源栏容器 */
  private resourceBar: Container;
  /** 资源栏背景 */
  private resourceBarBg: Graphics;
  /** 资源文本列表 */
  private resourceTexts: Text[] = [];
  /** 领地概览容器 */
  private territoryPanel: Container;
  /** 领地面板背景 */
  private territoryPanelBg: Graphics;
  /** 军队编队容器 */
  private armyPanel: Container;
  /** 军队面板背景 */
  private armyPanelBg: Graphics;
  /** 科技进度容器 */
  private techPanel: Container;
  /** 科技面板背景 */
  private techPanelBg: Graphics;
  /** 底部面板容器（资源采集点+外交） */
  private bottomPanel: Container;
  /** 底部面板背景 */
  private bottomPanelBg: Graphics;
  /** 游戏标题 */
  private titleText: Text;
  /** 时代/阶段文本 */
  private eraText: Text;
  /** 战斗力文本 */
  private powerText: Text;

  // ─── 领地图标容器（可点击） */
  private territoryItems: Container[] = [];
  /** 军队条目容器 */
  private armyItems: Container[] = [];
  /** 科技进度条 */
  private techBars: Container[] = [];
  /** 底部资源点条目 */
  private resourcePointItems: Container[] = [];
  /** 外交条目 */
  private diplomacyItems: Container[] = [];

  // ─── 配置 ───────────────────────────────────────────────

  /** 渲染策略 */
  private strategy: RenderStrategy;
  /** 图标渲染器 */
  private iconRenderer: StrategyIconRenderer;

  // ─── 状态 ───────────────────────────────────────────────

  /** 是否已激活 */
  private active: boolean = false;
  /** 当前渲染状态 */
  private currentState: StrategyGameRenderState | null = null;
  /** 当前画布尺寸 */
  private canvasWidth: number = 800;
  private canvasHeight: number = 600;

  // ─── 事件 ───────────────────────────────────────────────

  private listeners: Map<string, Set<StrategySceneEventCallback>> = new Map();

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  constructor(strategy: RenderStrategy) {
    this.strategy = strategy;
    this.iconRenderer = new StrategyIconRenderer();

    // 创建根容器
    this.container = new Container({ label: 'strategy-scene' });

    // 创建子容器
    this.resourceBar = new Container({ label: 'strategy-resource-bar' });
    this.resourceBarBg = new Graphics();
    this.resourceBar.addChild(this.resourceBarBg);

    this.territoryPanel = new Container({ label: 'territory-panel' });
    this.territoryPanelBg = new Graphics();
    this.territoryPanel.addChild(this.territoryPanelBg);

    this.armyPanel = new Container({ label: 'army-panel' });
    this.armyPanelBg = new Graphics();
    this.armyPanel.addChild(this.armyPanelBg);

    this.techPanel = new Container({ label: 'tech-panel' });
    this.techPanelBg = new Graphics();
    this.techPanel.addChild(this.techPanelBg);

    this.bottomPanel = new Container({ label: 'bottom-panel' });
    this.bottomPanelBg = new Graphics();
    this.bottomPanel.addChild(this.bottomPanelBg);

    // 标题
    this.titleText = new Text({
      text: '',
      style: {
        fontSize: 16,
        fill: hexToNum(strategy.theme.accent),
        fontWeight: 'bold',
      },
    });
    this.titleText.visible = false;

    // 时代/阶段文本
    this.eraText = new Text({
      text: '',
      style: {
        fontSize: 12,
        fill: hexToNum(strategy.theme.textSecondary),
      },
    });
    this.eraText.visible = false;

    // 战斗力文本
    this.powerText = new Text({
      text: '',
      style: {
        fontSize: 12,
        fill: hexToNum(strategy.theme.warning),
        fontWeight: 'bold',
      },
    });
    this.powerText.visible = false;

    // 添加到根容器
    this.container.addChild(this.resourceBar);
    this.container.addChild(this.territoryPanel);
    this.container.addChild(this.armyPanel);
    this.container.addChild(this.techPanel);
    this.container.addChild(this.bottomPanel);
    this.container.addChild(this.titleText);
    this.container.addChild(this.eraText);
    this.container.addChild(this.powerText);
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
    this.iconRenderer.destroy();
    this.container.destroy({ children: true });
    this.listeners.clear();
  }

  // ═══════════════════════════════════════════════════════════
  // 状态更新
  // ═══════════════════════════════════════════════════════════

  /**
   * 更新渲染状态
   */
  updateState(state: StrategyGameRenderState): void {
    if (!this.active) return;
    this.currentState = state;
    this.renderResourceBar(state);
    this.renderTerritoryPanel(state);
    this.renderArmyPanel(state);
    this.renderTechPanel(state);
    this.renderBottomPanel(state);
    this.renderHeader(state);
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
  getCurrentState(): StrategyGameRenderState | null {
    return this.currentState;
  }

  /** 获取渲染策略 */
  getStrategy(): RenderStrategy {
    return this.strategy;
  }

  /** 获取图标渲染器 */
  getIconRenderer(): StrategyIconRenderer {
    return this.iconRenderer;
  }

  // ═══════════════════════════════════════════════════════════
  // 事件系统
  // ═══════════════════════════════════════════════════════════

  /**
   * 注册事件回调
   */
  on(event: string, callback: StrategySceneEventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * 注销事件回调
   */
  off(event: string, callback: StrategySceneEventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法 — 布局
  // ═══════════════════════════════════════════════════════════

  /**
   * 计算并应用布局
   */
  private layout(): void {
    const { layout, theme } = this.strategy;
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    const p = layout.padding;
    const br = layout.borderRadius;

    // ── 资源栏（顶部）─────────────────────────────────────
    const rbH = h * 0.1;
    this.resourceBar.position.set(0, 0);
    this.resourceBarBg.clear();
    this.resourceBarBg.roundRect(0, 0, w, rbH, br);
    this.resourceBarBg.fill(hexToNum(theme.resourceBarBg));

    // ── 中间三栏 ──────────────────────────────────────────
    const midY = rbH;
    const midH = h * 0.55;
    const colW = (w - p * 2) / 3;

    // 领地面板（左）
    this.territoryPanel.position.set(p, midY);
    this.territoryPanelBg.clear();
    this.territoryPanelBg.roundRect(0, 0, colW, midH, br);
    this.territoryPanelBg.fill(hexToNum(theme.panelBackground));

    // 军队面板（中）
    this.armyPanel.position.set(p + colW + p, midY);
    this.armyPanelBg.clear();
    this.armyPanelBg.roundRect(0, 0, colW, midH, br);
    this.armyPanelBg.fill(hexToNum(theme.panelBackground));

    // 科技面板（右）
    this.techPanel.position.set(p + (colW + p) * 2, midY);
    this.techPanelBg.clear();
    this.techPanelBg.roundRect(0, 0, colW, midH, br);
    this.techPanelBg.fill(hexToNum(theme.panelBackground));

    // ── 底部面板 ──────────────────────────────────────────
    const bpY = midY + midH + p;
    const bpH = h - bpY;
    this.bottomPanel.position.set(0, bpY);
    this.bottomPanelBg.clear();
    this.bottomPanelBg.roundRect(0, 0, w, bpH, br);
    this.bottomPanelBg.fill(hexToNum(theme.panelBackground));

    // ── 标题位置 ──────────────────────────────────────────
    this.titleText.position.set(p, p);
    this.eraText.position.set(w / 2, p);
    this.powerText.position.set(w - p - 100, p);
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法 — 渲染
  // ═══════════════════════════════════════════════════════════

  /**
   * 渲染资源栏
   */
  private renderResourceBar(state: StrategyGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    // 清除旧文本
    for (const t of this.resourceTexts) {
      t.destroy();
    }
    this.resourceTexts = [];

    let x = p;
    const y = (this.canvasHeight * 0.1) / 2;

    for (const res of state.resources) {
      // 绘制资源图标
      const iconType = getResourceIcon(res.id);
      const icon = this.iconRenderer.drawIcon(iconType, {
        size: 16,
        color: theme.accent,
      });
      icon.position.set(x, y - 8);
      this.resourceBar.addChild(icon);
      this.resourceTexts.push(icon as any);

      // 资源名称和数量
      const text = new Text({
        text: `${res.name}: ${formatNumber(res.amount)}`,
        style: {
          fontSize: 12,
          fill: hexToNum(theme.textPrimary),
          fontFamily: 'monospace',
        },
      });
      text.anchor.set(0, 0.5);
      text.position.set(x + 20, y);
      this.resourceBar.addChild(text);
      this.resourceTexts.push(text);

      // 产出速率
      if (res.perSecond > 0) {
        const rateText = new Text({
          text: `+${formatNumber(res.perSecond)}/s`,
          style: {
            fontSize: 10,
            fill: hexToNum(theme.success),
            fontFamily: 'monospace',
          },
        });
        rateText.anchor.set(0, 0.5);
        rateText.position.set(x + text.width + 22, y);
        this.resourceBar.addChild(rateText);
        this.resourceTexts.push(rateText);
        x += 20 + text.width + rateText.width + 24;
      } else {
        x += 20 + text.width + 16;
      }
    }
  }

  /**
   * 渲染领地/地图概览面板
   */
  private renderTerritoryPanel(state: StrategyGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    // 清除旧项
    for (const item of this.territoryItems) {
      item.destroy();
    }
    this.territoryItems = [];

    const territories = state.territories ?? [];
    if (territories.length === 0) return;

    let y = p;

    // 面板标题
    const title = new Text({
      text: '🗺️ 领地',
      style: {
        fontSize: 13,
        fill: hexToNum(theme.accent),
        fontWeight: 'bold',
      },
    });
    title.position.set(p, y);
    this.territoryPanel.addChild(title);
    this.territoryItems.push(title);
    y += 22;

    // 征服/未征服统计
    const conquered = territories.filter((t) => t.conquered).length;
    const statsText = new Text({
      text: `已征服: ${conquered}/${territories.length}`,
      style: {
        fontSize: 11,
        fill: hexToNum(theme.textSecondary),
      },
    });
    statsText.position.set(p, y);
    this.territoryPanel.addChild(statsText);
    this.territoryItems.push(statsText);
    y += 20;

    // 领土列表
    for (const territory of territories.slice(0, 6)) {
      const item = new Container({ label: `territory-${territory.id}` });
      item.position.set(p, y);
      item.eventMode = 'static';
      item.cursor = 'pointer';

      // 状态指示圆点
      const dot = new Graphics();
      const dotColor = territory.conquered ? theme.success : theme.textSecondary;
      dot.circle(6, 6, 4);
      dot.fill(hexToNum(dotColor));
      item.addChild(dot);

      // 领土名称
      const nameText = new Text({
        text: territory.name,
        style: {
          fontSize: 10,
          fill: hexToNum(territory.conquered ? theme.textPrimary : theme.textSecondary),
        },
      });
      nameText.position.set(14, 0);
      item.addChild(nameText);

      // 兵力需求
      if (!territory.conquered && territory.powerRequired) {
        const powerText = new Text({
          text: `⚔️${formatNumber(territory.powerRequired)}`,
          style: {
            fontSize: 9,
            fill: hexToNum(theme.warning),
          },
        });
        powerText.position.set(80, 1);
        item.addChild(powerText);
      }

      // 点击事件
      item.on('pointertap', () => {
        this.emit('territoryClick', territory.id);
      });

      this.territoryPanel.addChild(item);
      this.territoryItems.push(item);
      y += 16;
    }
  }

  /**
   * 渲染军队/英雄编队面板
   */
  private renderArmyPanel(state: StrategyGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    // 清除旧项
    for (const item of this.armyItems) {
      item.destroy();
    }
    this.armyItems = [];

    const units = state.units ?? [];
    let y = p;

    // 面板标题
    const title = new Text({
      text: '⚔️ 编队',
      style: {
        fontSize: 13,
        fill: hexToNum(theme.accent),
        fontWeight: 'bold',
      },
    });
    title.position.set(p, y);
    this.armyPanel.addChild(title);
    this.armyItems.push(title);
    y += 22;

    // 总战斗力
    if (state.totalPower !== undefined) {
      const powerTitle = new Text({
        text: `战力: ${formatNumber(state.totalPower)}`,
        style: {
          fontSize: 11,
          fill: hexToNum(theme.warning),
          fontWeight: 'bold',
        },
      });
      powerTitle.position.set(p, y);
      this.armyPanel.addChild(powerTitle);
      this.armyItems.push(powerTitle);
      y += 20;
    }

    // 军队/英雄列表
    for (const unit of units.slice(0, 6)) {
      const item = new Container({ label: `unit-${unit.id}` });
      item.position.set(p, y);
      item.eventMode = 'static';
      item.cursor = 'pointer';

      // 兵种图标
      const iconType = this.getUnitIconType(unit.type);
      const icon = this.iconRenderer.drawIcon(iconType, {
        size: 14,
        color: unit.unlocked ? theme.accent : theme.textSecondary,
      });
      item.addChild(icon);

      // 名称和等级
      const nameText = new Text({
        text: `${unit.name} Lv.${unit.level}`,
        style: {
          fontSize: 10,
          fill: hexToNum(unit.unlocked ? theme.textPrimary : theme.textSecondary),
        },
      });
      nameText.position.set(18, 0);
      item.addChild(nameText);

      // 数量
      if (unit.count > 0) {
        const countText = new Text({
          text: `x${formatNumber(unit.count)}`,
          style: {
            fontSize: 9,
            fill: hexToNum(theme.success),
          },
        });
        countText.position.set(18, 12);
        item.addChild(countText);
      }

      // 战力
      const powerText = new Text({
        text: `⚔${formatNumber(unit.power)}`,
        style: {
          fontSize: 9,
          fill: hexToNum(theme.warning),
        },
      });
      powerText.position.set(70, 0);
      item.addChild(powerText);

      // 点击事件
      item.on('pointertap', () => {
        this.emit('unitClick', unit.id);
      });

      this.armyPanel.addChild(item);
      this.armyItems.push(item);
      y += 28;
    }
  }

  /**
   * 渲染科技研究进度面板
   */
  private renderTechPanel(state: StrategyGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    // 清除旧项
    for (const item of this.techBars) {
      item.destroy();
    }
    this.techBars = [];

    const techs = state.techs ?? [];
    let y = p;

    // 面板标题
    const title = new Text({
      text: '🔬 科技',
      style: {
        fontSize: 13,
        fill: hexToNum(theme.accent),
        fontWeight: 'bold',
      },
    });
    title.position.set(p, y);
    this.techPanel.addChild(title);
    this.techBars.push(title);
    y += 22;

    // 科技进度条列表
    for (const tech of techs.slice(0, 5)) {
      const barContainer = new Container({ label: `tech-${tech.id}` });
      barContainer.position.set(p, y);
      barContainer.eventMode = 'static';
      barContainer.cursor = 'pointer';

      // 科技名称
      const nameText = new Text({
        text: tech.name,
        style: {
          fontSize: 10,
          fill: hexToNum(
            tech.state === 'completed' ? theme.success :
            tech.state === 'researching' ? theme.accent :
            tech.state === 'available' ? theme.textPrimary :
            theme.textSecondary,
          ),
        },
      });
      barContainer.addChild(nameText);

      // 进度条背景
      const barW = 80;
      const barH = 8;
      const barY = 14;
      const barBg = new Graphics();
      barBg.roundRect(0, barY, barW, barH, 2);
      barBg.fill(hexToNum(theme.background));
      barContainer.addChild(barBg);

      // 进度条填充
      if (tech.progress > 0) {
        const barFill = new Graphics();
        const fillColor = tech.state === 'completed' ? theme.success : theme.accent;
        barFill.roundRect(0, barY, barW * Math.min(1, tech.progress), barH, 2);
        barFill.fill(hexToNum(fillColor));
        barContainer.addChild(barFill);
      }

      // 进度百分比
      const progressText = new Text({
        text: `${Math.floor(tech.progress * 100)}%`,
        style: {
          fontSize: 9,
          fill: hexToNum(theme.textSecondary),
        },
      });
      progressText.position.set(barW + 4, barY);
      barContainer.addChild(progressText);

      // 状态标签
      const stateLabel = this.getTechStateLabel(tech.state);
      const stateText = new Text({
        text: stateLabel,
        style: {
          fontSize: 8,
          fill: hexToNum(
            tech.state === 'completed' ? theme.success :
            tech.state === 'researching' ? theme.accent :
            theme.textSecondary,
          ),
        },
      });
      stateText.position.set(barW + 30, barY);
      barContainer.addChild(stateText);

      // 点击事件
      barContainer.on('pointertap', () => {
        this.emit('techClick', tech.id);
      });

      this.techPanel.addChild(barContainer);
      this.techBars.push(barContainer);
      y += 30;
    }
  }

  /**
   * 渲染底部面板（资源采集点+外交）
   */
  private renderBottomPanel(state: StrategyGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    // 清除旧项
    for (const item of this.resourcePointItems) {
      item.destroy();
    }
    this.resourcePointItems = [];
    for (const item of this.diplomacyItems) {
      item.destroy();
    }
    this.diplomacyItems = [];

    const resourcePoints = state.resourcePoints ?? [];
    const diplomacy = state.diplomacy ?? [];

    // ── 左半部分：资源采集点 ──────────────────────────────
    let y = p;
    const leftW = this.canvasWidth * 0.5;

    const rpTitle = new Text({
      text: '⛏️ 资源采集点',
      style: {
        fontSize: 12,
        fill: hexToNum(theme.accent),
        fontWeight: 'bold',
      },
    });
    rpTitle.position.set(p, y);
    this.bottomPanel.addChild(rpTitle);
    this.resourcePointItems.push(rpTitle);
    y += 18;

    for (const rp of resourcePoints.slice(0, 4)) {
      const item = new Container({ label: `rp-${rp.id}` });
      item.position.set(p, y);

      // 图标
      const iconType = getResourceIcon(rp.type);
      const icon = this.iconRenderer.drawIcon(iconType, {
        size: 12,
        color: rp.isActive ? theme.accent : theme.textSecondary,
      });
      item.addChild(icon);

      // 名称和等级
      const nameText = new Text({
        text: `${rp.name} Lv.${rp.level}`,
        style: {
          fontSize: 10,
          fill: hexToNum(theme.textPrimary),
        },
      });
      nameText.position.set(16, 0);
      item.addChild(nameText);

      // 产出
      const outputText = new Text({
        text: `+${formatNumber(rp.output)}/s`,
        style: {
          fontSize: 9,
          fill: hexToNum(rp.isActive ? theme.success : theme.textSecondary),
        },
      });
      outputText.position.set(90, 1);
      item.addChild(outputText);

      this.bottomPanel.addChild(item);
      this.resourcePointItems.push(item);
      y += 16;
    }

    // ── 右半部分：外交/联盟 ──────────────────────────────
    y = p;
    const rightX = leftW + p;

    const dipTitle = new Text({
      text: '🤝 外交',
      style: {
        fontSize: 12,
        fill: hexToNum(theme.accent),
        fontWeight: 'bold',
      },
    });
    dipTitle.position.set(rightX, y);
    this.bottomPanel.addChild(dipTitle);
    this.diplomacyItems.push(dipTitle);
    y += 18;

    for (const dip of diplomacy.slice(0, 4)) {
      const item = new Container({ label: `dip-${dip.id}` });
      item.position.set(rightX, y);
      item.eventMode = 'static';
      item.cursor = 'pointer';

      // 关系指示圆点
      const dot = new Graphics();
      const relationColor = dip.relation === 'ally' ? theme.success :
        dip.relation === 'enemy' ? '#e74c3c' : theme.textSecondary;
      dot.circle(5, 5, 4);
      dot.fill(hexToNum(relationColor));
      item.addChild(dot);

      // 名称
      const nameText = new Text({
        text: dip.name,
        style: {
          fontSize: 10,
          fill: hexToNum(theme.textPrimary),
        },
      });
      nameText.position.set(14, 0);
      item.addChild(nameText);

      // 实力
      const strText = new Text({
        text: `💪${formatNumber(dip.strength)}`,
        style: {
          fontSize: 9,
          fill: hexToNum(theme.textSecondary),
        },
      });
      strText.position.set(70, 1);
      item.addChild(strText);

      // 点击事件
      item.on('pointertap', () => {
        this.emit('diplomacyClick', dip.id);
      });

      this.bottomPanel.addChild(item);
      this.diplomacyItems.push(item);
      y += 16;
    }
  }

  /**
   * 渲染头部信息（标题、时代、战力）
   */
  private renderHeader(state: StrategyGameRenderState): void {
    this.titleText.text = state.gameId;
    this.titleText.visible = true;

    if (state.eraName) {
      this.eraText.text = `📍 ${state.eraName}`;
      this.eraText.visible = true;
    }

    if (state.totalPower !== undefined) {
      this.powerText.text = `⚡ ${formatNumber(state.totalPower)}`;
      this.powerText.visible = true;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 内部辅助方法
  // ═══════════════════════════════════════════════════════════

  /**
   * 获取兵种对应的图标类型
   */
  private getUnitIconType(unitType: string): StrategyIconType {
    const map: Record<string, StrategyIconType> = {
      infantry: 'sword',
      cavalry: 'horse',
      archer: 'bow',
      knight: 'shield',
      tower: 'tower',
      hero: 'sword',
      mage: 'bow',
      // 帝国时代兵种
      militia: 'sword',
      archer_infantry: 'bow',
      cavalry_unit: 'horse',
      // 英雄无敌兵种
      warrior: 'sword',
      defender: 'shield',
      ranger: 'bow',
    };
    return map[unitType] ?? 'sword';
  }

  /**
   * 获取科技状态标签
   */
  private getTechStateLabel(state: string): string {
    const labels: Record<string, string> = {
      locked: '🔒',
      available: '✅',
      researching: '⏳',
      completed: '✔️',
    };
    return labels[state] ?? state;
  }

  /**
   * 触发事件
   */
  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(...args);
      } catch (err) {
        console.error(`[StrategyScene] Error in event "${event}":`, err);
      }
    });
  }
}
