/**
 * renderer/scenes/MapScene.ts — 地图场景
 *
 * 显示三国领土地图（节点图），包含：
 * - 领土节点（可点击、可悬停）
 * - 领土间连接线
 * - 地图上的建筑图标
 * - 摄像机平移/缩放（含惯性拖拽、滚轮缩放）
 * - 领土脉冲动画 & 建筑产出进度条
 * - 悬停 Tooltip 信息面板
 *
 * @module renderer/scenes/MapScene
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type {
  SceneType,
  MapRenderData,
  TerritoryRenderData,
  BuildingRenderData,
  GameRenderState,
} from '../types';
import { BaseScene, type SceneEventBridge } from './BaseScene';
import type { AssetManager } from '../managers/AssetManager';
import type { AnimationManager } from '../managers/AnimationManager';
import type { CameraManager } from '../managers/CameraManager';

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

/** 领土节点默认半径 */
const TERRITORY_RADIUS = 40;

/** 连接线宽度 */
const CONNECTION_WIDTH = 2;

/** 连接线颜色 */
const CONNECTION_COLOR = 0x555577;

/** 已征服领土颜色 */
const CONQUERED_COLOR = 0x4ecdc4;

/** 未征服领土颜色 */
const UNCONQUERED_COLOR = 0xe74c3c;

/** 锁定领土颜色 */
const LOCKED_COLOR = 0x636e72;

/** 领土节点悬停放大倍率 */
const HOVER_SCALE = 1.15;

/** 建筑图标尺寸 */
const BUILDING_ICON_SIZE = 24;

/** 脉冲动画周期（毫秒） */
const PULSE_PERIOD = 2000;

/** 脉冲缩放振幅（中心值 1.0，范围 ±0.05） */
const PULSE_AMPLITUDE = 0.05;

/** 惯性摩擦系数（每帧衰减，0~1，越小减速越快） */
const INERTIA_FRICTION = 0.92;

/** 惯性速度阈值（低于此值停止） */
const INERTIA_THRESHOLD = 0.5;

/** 滚轮缩放步进 */
const WHEEL_ZOOM_STEP = 0.1;

/** 建筑进度弧线半径 */
const PROGRESS_ARC_RADIUS = 18;

/** 建筑进度弧线宽度 */
const PROGRESS_ARC_WIDTH = 3;

/** 建筑进度弧线颜色 */
const PROGRESS_ARC_COLOR = 0x00ff88;

/** 建筑进度背景弧线颜色 */
const PROGRESS_ARC_BG_COLOR = 0x333344;

/** Tooltip 背景色 */
const TOOLTIP_BG_COLOR = 0x1a1a2e;

/** Tooltip 背景透明度 */
const TOOLTIP_BG_ALPHA = 0.92;

/** Tooltip 边框颜色 */
const TOOLTIP_BORDER_COLOR = 0x4ecdc4;

/** Tooltip 圆角 */
const TOOLTIP_CORNER_RADIUS = 8;

/** Tooltip 内边距 */
const TOOLTIP_PADDING = 12;

/** Tooltip 字号 */
const TOOLTIP_FONT_SIZE = 13;

/** Tooltip 行间距 */
const TOOLTIP_LINE_HEIGHT = 20;

/** Tooltip 偏移量（相对鼠标） */
const TOOLTIP_OFFSET = { x: 15, y: 15 };

/** 领土类型中文映射 */
const TERRITORY_TYPE_LABELS: Record<string, string> = {
  capital: '都城',
  city: '城市',
  fortress: '堡垒',
  village: '村庄',
  wilderness: '荒野',
};

// ═══════════════════════════════════════════════════════════════
// 内部渲染对象接口
// ═══════════════════════════════════════════════════════════════

/** 领土节点渲染对象 */
interface TerritoryNode {
  id: string;
  container: Container;
  bg: Graphics;
  label: Text;
  data: TerritoryRenderData | null;
}

/** 建筑图标渲染对象 */
interface BuildingIcon {
  id: string;
  container: Container;
  icon: Text;
  /** 建造进度弧线（叠加在图标上） */
  progressArc: Graphics;
  /** 进度弧线是否已绘制（避免每帧重复 clear） */
  hasProgressArc: boolean;
  data: BuildingRenderData | null;
}

/** Tooltip 渲染对象 */
interface TooltipView {
  container: Container;
  background: Graphics;
  texts: Text[];
}

// ═══════════════════════════════════════════════════════════════
// MapScene
// ═══════════════════════════════════════════════════════════════

/**
 * 地图场景
 *
 * 以节点图方式展示三国领土。
 * 支持摄像机平移/缩放、节点交互、建筑叠加显示。
 */
export class MapScene extends BaseScene {
  readonly type: SceneType = 'map';

  // ─── 子容器 ───────────────────────────────────────────────

  /** 连接线层 */
  private connectionLayer: Container;
  /** 领土节点层 */
  private territoryLayer: Container;
  /** 建筑图标层 */
  private buildingLayer: Container;
  /** 悬停提示层（最上层） */
  private tooltipLayer: Container;

  // ─── 渲染对象缓存 ─────────────────────────────────────────

  /** 领土节点映射（ID → TerritoryNode） */
  private territoryNodes: Map<string, TerritoryNode> = new Map();
  /** 建筑图标映射（ID → BuildingIcon） */
  private buildingIcons: Map<string, BuildingIcon> = new Map();

  // ─── 摄像机 ───────────────────────────────────────────────

  /** 摄像机管理器（地图场景独享） */
  private cameraManager: CameraManager;

  // ─── 拖拽状态 ─────────────────────────────────────────────

  /** 是否正在拖拽地图 */
  private dragging: boolean = false;
  /** 拖拽起始点 */
  private dragStart: { x: number; y: number } = { x: 0, y: 0 };
  /** 拖拽惯性速度 */
  private dragVelocity: { x: number; y: number } = { x: 0, y: 0 };
  /** 上一帧指针位置（用于计算速度） */
  private lastPointerPos: { x: number; y: number } = { x: 0, y: 0 };

  // ─── 悬停状态 ─────────────────────────────────────────────

  /** 当前悬停的领土 ID */
  private hoveredTerritory: string | null = null;

  // ─── 动画计时 ─────────────────────────────────────────────

  /** 脉冲动画累计时间（毫秒） */
  private pulseTime: number = 0;

  // ─── Tooltip ──────────────────────────────────────────────

  /** Tooltip 视图对象 */
  private tooltipView: TooltipView | null = null;
  /** 当前鼠标全局位置 */
  private pointerGlobalPos: { x: number; y: number } = { x: 0, y: 0 };

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  constructor(
    assetManager: AssetManager,
    animationManager: AnimationManager,
    cameraManager: CameraManager,
    bridgeEvent: SceneEventBridge,
  ) {
    super(assetManager, animationManager, bridgeEvent);
    this.cameraManager = cameraManager;

    // 创建子容器层
    this.connectionLayer = new Container({ label: 'connections' });
    this.territoryLayer = new Container({ label: 'territories' });
    this.buildingLayer = new Container({ label: 'buildings' });
    this.tooltipLayer = new Container({ label: 'tooltips' });

    this.container.addChild(
      this.connectionLayer,
      this.territoryLayer,
      this.buildingLayer,
      this.tooltipLayer,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  protected async onCreate(): Promise<void> {
    // 设置容器交互（用于地图拖拽和点击）
    this.container.eventMode = 'static';
    // hitArea 稍后在 onEnter 中根据实际尺寸设置

    // 绑定拖拽事件
    this.container.on('pointerdown', this.onPointerDown);
    this.container.on('pointermove', this.onPointerMove);
    this.container.on('pointerup', this.onPointerUp);
    this.container.on('pointerupoutside', this.onPointerUp);

    // 绑定滚轮缩放事件
    this.container.on('wheel', this.onWheel);
  }

  protected async onEnter(_params?: Record<string, unknown>): Promise<void> {
    // TODO: 加载地图资源包
    // await this.assetManager.loadBundle('map');

    // 设置摄像机边界
    this.cameraManager.setBounds({
      minX: -500,
      maxX: 2500,
      minY: -500,
      maxY: 1500,
    });

    // 重置动画计时
    this.pulseTime = 0;
  }

  protected async onExit(): Promise<void> {
    // TODO: 卸载地图资源包
    // await this.assetManager.unloadBundle('map');
  }

  protected onUpdate(deltaTime: number): void {
    // ── 1. 更新脉冲动画 ──────────────────────────────────────
    this.updateTerritoryPulse(deltaTime);

    // ── 2. 更新建筑进度弧线 ──────────────────────────────────
    this.updateBuildingProgress();

    // ── 3. 更新拖拽惯性 ──────────────────────────────────────
    this.updateInertia();

    // ── 4. 更新 Tooltip 位置 ─────────────────────────────────
    this.updateTooltip();
  }

  protected onSetData(data: unknown): void {
    const state = data as GameRenderState;
    if (!state.map) return;

    this.renderMap(state.map);
  }

  protected onDestroy(): void {
    this.territoryNodes.clear();
    this.buildingIcons.clear();
    this.destroyTooltip();
    this.connectionLayer.destroy({ children: true });
    this.territoryLayer.destroy({ children: true });
    this.buildingLayer.destroy({ children: true });
    this.tooltipLayer.destroy({ children: true });
  }

  // ═══════════════════════════════════════════════════════════
  // 动画更新
  // ═══════════════════════════════════════════════════════════

  /**
   * 更新领土脉冲动画
   *
   * 已征服领土有 0.95~1.05 的 sin 波缩放动画，每 2 秒一个周期。
   * 未征服或悬停中的领土不参与脉冲。
   */
  private updateTerritoryPulse(deltaTime: number): void {
    this.pulseTime += deltaTime;

    for (const [id, node] of this.territoryNodes) {
      // 仅对已征服且非悬停的领土播放脉冲
      if (!node.data?.conquered) continue;
      if (id === this.hoveredTerritory) continue;

      // sin 波缩放：周期 PULSE_PERIOD，振幅 PULSE_AMPLITUDE
      const phase = (this.pulseTime / PULSE_PERIOD) * Math.PI * 2;
      const scale = 1 + Math.sin(phase) * PULSE_AMPLITUDE;
      node.container.scale.set(scale);
    }
  }

  /**
   * 更新建筑产出进度条
   *
   * 如果建筑有 buildProgress 属性，绘制进度弧形。
   */
  private updateBuildingProgress(): void {
    for (const icon of this.buildingIcons.values()) {
      const progress = icon.data?.buildProgress;

      // 无进度数据时清除弧线
      if (progress === undefined || progress === null) {
        if (icon.hasProgressArc) {
          icon.progressArc.clear();
          icon.hasProgressArc = false;
        }
        continue;
      }

      const clampedProgress = Math.max(0, Math.min(1, progress));

      icon.progressArc.clear();

      // 背景弧线（完整圆环）
      icon.progressArc
        .arc(0, 0, PROGRESS_ARC_RADIUS, 0, Math.PI * 2)
        .stroke({ width: PROGRESS_ARC_WIDTH, color: PROGRESS_ARC_BG_COLOR });

      // 进度弧线（按比例）
      if (clampedProgress > 0) {
        const startAngle = -Math.PI / 2; // 从顶部开始
        const endAngle = startAngle + Math.PI * 2 * clampedProgress;
        icon.progressArc
          .arc(0, 0, PROGRESS_ARC_RADIUS, startAngle, endAngle)
          .stroke({ width: PROGRESS_ARC_WIDTH, color: PROGRESS_ARC_COLOR, cap: 'round' });
      }

      icon.hasProgressArc = true;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 拖拽惯性
  // ═══════════════════════════════════════════════════════════

  /**
   * 更新拖拽惯性滑动
   *
   * 松手后以 friction=0.92 每帧衰减速度，产生惯性效果。
   */
  private updateInertia(): void {
    // 正在拖拽时不应用惯性（由 onPointerMove 直接控制）
    if (this.dragging) return;

    // 速度低于阈值时停止
    const speed = Math.abs(this.dragVelocity.x) + Math.abs(this.dragVelocity.y);
    if (speed < INERTIA_THRESHOLD) {
      this.dragVelocity.x = 0;
      this.dragVelocity.y = 0;
      return;
    }

    // 衰减速度
    this.dragVelocity.x *= INERTIA_FRICTION;
    this.dragVelocity.y *= INERTIA_FRICTION;

    // 应用惯性位移
    const camState = this.cameraManager.getState();
    this.cameraManager.panTo(
      camState.x + this.dragVelocity.x,
      camState.y + this.dragVelocity.y,
      false,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Tooltip 信息面板
  // ═══════════════════════════════════════════════════════════

  /**
   * 显示 Tooltip
   *
   * 在 tooltipLayer 中绘制领土信息面板，包含：
   * - 领土名称
   * - 类型（都城/城市/堡垒/村庄/荒野）
   * - 产出信息
   * - 征服状态
   */
  private showTooltip(territoryId: string): void {
    const node = this.territoryNodes.get(territoryId);
    if (!node?.data) return;

    const data = node.data;

    // 销毁旧的 Tooltip
    this.destroyTooltip();

    // 创建 Tooltip 容器
    const tooltipContainer = new Container({ label: 'tooltip' });
    tooltipContainer.eventMode = 'none'; // Tooltip 不拦截事件

    // 构建文本行
    const lines: string[] = [];

    // 领土名称
    lines.push(`📍 ${data.name}`);

    // 类型
    const typeLabel = TERRITORY_TYPE_LABELS[data.type] ?? data.type;
    lines.push(`类型: ${typeLabel}`);

    // 征服状态
    lines.push(`状态: ${data.conquered ? '✅ 已征服' : '⚔️ 未征服'}`);

    // 产出信息
    const incomeEntries = Object.entries(data.income);
    if (incomeEntries.length > 0) {
      const incomeStr = incomeEntries
        .map(([res, amount]) => `${res}: +${amount}/s`)
        .join(', ');
      lines.push(`产出: ${incomeStr}`);
    } else {
      lines.push('产出: 无');
    }

    // 征服所需兵力
    lines.push(`所需兵力: ${data.powerRequired}`);

    // 创建文本对象
    const textStyle = new TextStyle({
      fontSize: TOOLTIP_FONT_SIZE,
      fill: '#e0e0e0',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      lineHeight: TOOLTIP_LINE_HEIGHT,
      wordWrap: false,
    });

    const texts: Text[] = [];
    let maxWidth = 0;

    for (const line of lines) {
      const textObj = new Text({ text: line, style: textStyle });
      textObj.x = TOOLTIP_PADDING;
      textObj.y = TOOLTIP_PADDING + texts.length * TOOLTIP_LINE_HEIGHT;
      texts.push(textObj);
      tooltipContainer.addChild(textObj);

      if (textObj.width > maxWidth) {
        maxWidth = textObj.width;
      }
    }

    // 绘制背景
    const bgWidth = maxWidth + TOOLTIP_PADDING * 2;
    const bgHeight = texts.length * TOOLTIP_LINE_HEIGHT + TOOLTIP_PADDING * 2;

    const background = new Graphics();
    background.roundRect(0, 0, bgWidth, bgHeight, TOOLTIP_CORNER_RADIUS)
      .fill({ color: TOOLTIP_BG_COLOR, alpha: TOOLTIP_BG_ALPHA });
    background.roundRect(0, 0, bgWidth, bgHeight, TOOLTIP_CORNER_RADIUS)
      .stroke({ color: TOOLTIP_BORDER_COLOR, width: 1 });
    tooltipContainer.addChildAt(background, 0); // 背景在最底层

    this.tooltipView = { container: tooltipContainer, background, texts };
    this.tooltipLayer.addChild(tooltipContainer);

    // 立即更新位置
    this.positionTooltip();
  }

  /**
   * 隐藏 Tooltip
   */
  private hideTooltip(): void {
    this.destroyTooltip();
  }

  /**
   * 更新 Tooltip 位置（跟随鼠标）
   */
  private updateTooltip(): void {
    if (!this.tooltipView) return;
    this.positionTooltip();
  }

  /**
   * 设置 Tooltip 位置
   *
   * 跟随鼠标，并确保不超出容器边界。
   */
  private positionTooltip(): void {
    if (!this.tooltipView) return;

    const tooltip = this.tooltipView;
    const bgWidth = tooltip.background.width;
    const bgHeight = tooltip.background.height;

    // 基础位置 = 鼠标 + 偏移
    let tx = this.pointerGlobalPos.x + TOOLTIP_OFFSET.x;
    let ty = this.pointerGlobalPos.y + TOOLTIP_OFFSET.y;

    // 防止超出右侧/下侧边界（简单处理）
    // 注：container 宽高可能为 0，使用屏幕尺寸做 fallback
    const screenW = this.container.parent?.width ?? 1920;
    const screenH = this.container.parent?.height ?? 1080;

    if (tx + bgWidth > screenW) {
      tx = this.pointerGlobalPos.x - bgWidth - TOOLTIP_OFFSET.x;
    }
    if (ty + bgHeight > screenH) {
      ty = this.pointerGlobalPos.y - bgHeight - TOOLTIP_OFFSET.y;
    }

    tooltip.container.position.set(tx, ty);
  }

  /**
   * 销毁 Tooltip 对象
   */
  private destroyTooltip(): void {
    if (this.tooltipView) {
      this.tooltipLayer.removeChild(this.tooltipView.container);
      this.tooltipView.container.destroy({ children: true });
      this.tooltipView = null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════

  /**
   * 渲染完整地图
   *
   * 对比新旧数据，增量更新节点和连接线。
   */
  private renderMap(data: MapRenderData): void {
    this.renderConnections(data);
    this.renderTerritories(data.territories);
    this.renderBuildings(data.buildings ?? []);
  }

  /**
   * 渲染领土间连接线
   */
  private renderConnections(data: MapRenderData): void {
    // 清除旧连接线
    this.connectionLayer.removeChildren();

    const line = new Graphics();
    for (const conn of data.connections) {
      const fromNode = data.territories.find((t) => t.id === conn.from);
      const toNode = data.territories.find((t) => t.id === conn.to);
      if (!fromNode || !toNode) continue;

      line
        .moveTo(fromNode.position.x, fromNode.position.y)
        .lineTo(toNode.position.x, toNode.position.y)
        .stroke({ width: CONNECTION_WIDTH, color: CONNECTION_COLOR });
    }
    this.connectionLayer.addChild(line);
  }

  /**
   * 渲染领土节点
   *
   * 使用对象池策略：已存在的节点更新数据，新节点创建，移除的节点销毁。
   */
  private renderTerritories(territories: TerritoryRenderData[]): void {
    const activeIds = new Set<string>();

    for (const t of territories) {
      activeIds.add(t.id);

      let node = this.territoryNodes.get(t.id);
      if (!node) {
        node = this.createTerritoryNode(t);
        this.territoryNodes.set(t.id, node);
        this.territoryLayer.addChild(node.container);
      } else {
        this.updateTerritoryNode(node, t);
      }
    }

    // 移除不再存在的节点
    for (const [id, node] of this.territoryNodes) {
      if (!activeIds.has(id)) {
        this.territoryLayer.removeChild(node.container);
        node.container.destroy({ children: true });
        this.territoryNodes.delete(id);
      }
    }
  }

  /**
   * 创建领土节点
   */
  private createTerritoryNode(data: TerritoryRenderData): TerritoryNode {
    const container = new Container({ label: `territory-${data.id}` });
    container.position.set(data.position.x, data.position.y);
    container.eventMode = 'static';
    container.cursor = 'pointer';

    // 背景圆
    const bg = new Graphics();
    const color = this.getTerritoryColor(data);
    bg.circle(0, 0, TERRITORY_RADIUS).fill({ color, alpha: 0.8 });
    bg.circle(0, 0, TERRITORY_RADIUS).stroke({ color: 0xffffff, width: 2 });
    container.addChild(bg);

    // 名称标签
    const label = new Text({
      text: data.name,
      style: new TextStyle({
        fontSize: 12,
        fill: '#ffffff',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
        align: 'center',
      }),
    });
    label.anchor.set(0.5, 0.5);
    container.addChild(label);

    // 交互事件
    container.on('pointerdown', () => {
      this.bridgeEvent('territoryClick', data.id);
    });
    container.on('pointerover', () => {
      this.hoveredTerritory = data.id;
      this.bridgeEvent('territoryHover', data.id);
      this.animationManager.killAnimations(container);
      container.scale.set(HOVER_SCALE);
      this.showTooltip(data.id);
    });
    container.on('pointerout', () => {
      this.hoveredTerritory = null;
      this.bridgeEvent('territoryHover', null);
      container.scale.set(1);
      this.hideTooltip();
    });

    return { id: data.id, container, bg, label, data };
  }

  /**
   * 更新领土节点
   */
  private updateTerritoryNode(node: TerritoryNode, data: TerritoryRenderData): void {
    node.data = data;

    // 更新颜色
    const color = this.getTerritoryColor(data);
    node.bg.clear();
    node.bg.circle(0, 0, TERRITORY_RADIUS).fill({ color, alpha: 0.8 });
    node.bg.circle(0, 0, TERRITORY_RADIUS).stroke({ color: 0xffffff, width: 2 });

    // 更新名称
    node.label.text = data.name;
  }

  /**
   * 获取领土颜色
   */
  private getTerritoryColor(data: TerritoryRenderData): number {
    if (data.conquered) return CONQUERED_COLOR;
    if (data.color) return parseInt(data.color.replace('#', ''), 16);
    return LOCKED_COLOR;
  }

  /**
   * 渲染建筑图标
   */
  private renderBuildings(buildings: BuildingRenderData[]): void {
    const activeIds = new Set<string>();

    for (const b of buildings) {
      activeIds.add(b.id);

      let icon = this.buildingIcons.get(b.id);
      if (!icon) {
        icon = this.createBuildingIcon(b);
        this.buildingIcons.set(b.id, icon);
        this.buildingLayer.addChild(icon.container);
      } else {
        this.updateBuildingIcon(icon, b);
      }
    }

    // 移除不再存在的建筑
    for (const [id, icon] of this.buildingIcons) {
      if (!activeIds.has(id)) {
        this.buildingLayer.removeChild(icon.container);
        icon.container.destroy({ children: true });
        this.buildingIcons.delete(id);
      }
    }
  }

  /**
   * 创建建筑图标
   */
  private createBuildingIcon(data: BuildingRenderData): BuildingIcon {
    const container = new Container({ label: `building-${data.id}` });
    container.position.set(data.position.x, data.position.y);
    container.eventMode = 'static';
    container.cursor = 'pointer';

    // 占位图标（使用 emoji 文字，后续替换为精灵图）
    const icon = new Text({
      text: data.iconAsset ?? '🏗️',
      style: new TextStyle({ fontSize: BUILDING_ICON_SIZE }),
    });
    icon.anchor.set(0.5, 0.5);
    container.addChild(icon);

    // 进度弧线（初始为空，在 updateBuildingProgress 中绘制）
    const progressArc = new Graphics();
    container.addChild(progressArc);

    // 交互事件
    container.on('pointerdown', () => {
      this.bridgeEvent('buildingClick', data.id);
    });
    container.on('pointerover', () => {
      this.bridgeEvent('buildingHover', data.id);
    });
    container.on('pointerout', () => {
      this.bridgeEvent('buildingHover', null);
    });

    return { id: data.id, container, icon, progressArc, hasProgressArc: false, data };
  }

  /**
   * 更新建筑图标
   */
  private updateBuildingIcon(icon: BuildingIcon, data: BuildingRenderData): void {
    icon.data = data;
    icon.container.position.set(data.position.x, data.position.y);
    // 进度弧线由 updateBuildingProgress() 每帧绘制，此处不重复处理
  }

  // ═══════════════════════════════════════════════════════════
  // 拖拽交互
  // ═══════════════════════════════════════════════════════════

  private onPointerDown = (e: import('pixi.js').FederatedPointerEvent): void => {
    this.dragging = true;
    this.dragStart = { x: e.globalX, y: e.globalY };
    this.lastPointerPos = { x: e.globalX, y: e.globalY };

    // 拖拽开始时清除惯性
    this.dragVelocity.x = 0;
    this.dragVelocity.y = 0;
  };

  private onPointerMove = (e: import('pixi.js').FederatedPointerEvent): void => {
    // 记录鼠标位置（用于 Tooltip 跟随）
    this.pointerGlobalPos = { x: e.globalX, y: e.globalY };

    if (!this.dragging) return;

    const dx = e.globalX - this.dragStart.x;
    const dy = e.globalY - this.dragStart.y;

    // 计算本次移动速度（用于惯性）
    this.dragVelocity.x = e.globalX - this.lastPointerPos.x;
    this.dragVelocity.y = e.globalY - this.lastPointerPos.y;
    this.lastPointerPos = { x: e.globalX, y: e.globalY };

    // 平移地图容器（通过摄像机管理器，直接移动无平滑）
    const camState = this.cameraManager.getState();
    this.cameraManager.panTo(camState.x + dx, camState.y + dy, false);

    this.dragStart = { x: e.globalX, y: e.globalY };
  };

  private onPointerUp = (): void => {
    this.dragging = false;
    // 惯性速度已由 onPointerMove 累积，松手后由 updateInertia 接管
  };

  // ═══════════════════════════════════════════════════════════
  // 滚轮缩放
  // ═══════════════════════════════════════════════════════════

  /**
   * 滚轮缩放事件处理
   *
   * deltaY > 0 → 缩小，deltaY < 0 → 放大。
   * 使用平滑过渡让缩放更自然。
   */
  private onWheel = (e: import('pixi.js').FederatedWheelEvent): void => {
    const delta = e.deltaY > 0 ? -WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP;
    const camState = this.cameraManager.getState();
    this.cameraManager.zoomTo(camState.zoom + delta, true);
  };
}
