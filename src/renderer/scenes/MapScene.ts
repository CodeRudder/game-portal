/**
 * renderer/scenes/MapScene.ts — 地图场景
 *
 * 显示三国领土地图（节点图），包含：
 * - 领土节点（可点击、可悬停）
 * - 领土间连接线
 * - 地图上的建筑图标
 * - 摄像机平移/缩放
 * - 点击交互
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
  data: BuildingRenderData | null;
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

  // ─── 悬停状态 ─────────────────────────────────────────────

  /** 当前悬停的领土 ID */
  private hoveredTerritory: string | null = null;

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
  }

  protected async onExit(): Promise<void> {
    // TODO: 卸载地图资源包
    // await this.assetManager.unloadBundle('map');
  }

  protected onUpdate(_deltaTime: number): void {
    // TODO: 更新领土动画（如脉冲效果、产出粒子等）
    // TODO: 更新建筑动画（如建造进度条）
    // TODO: 更新摄像机平滑跟随
  }

  protected onSetData(data: unknown): void {
    const state = data as GameRenderState;
    if (!state.map) return;

    this.renderMap(state.map);
  }

  protected onDestroy(): void {
    this.territoryNodes.clear();
    this.buildingIcons.clear();
    this.connectionLayer.destroy({ children: true });
    this.territoryLayer.destroy({ children: true });
    this.buildingLayer.destroy({ children: true });
    this.tooltipLayer.destroy({ children: true });
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
    });
    container.on('pointerout', () => {
      this.hoveredTerritory = null;
      this.bridgeEvent('territoryHover', null);
      container.scale.set(1);
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

    return { id: data.id, container, icon, data };
  }

  /**
   * 更新建筑图标
   */
  private updateBuildingIcon(icon: BuildingIcon, data: BuildingRenderData): void {
    icon.data = data;
    icon.container.position.set(data.position.x, data.position.y);
    // TODO: 根据状态更新外观（建造进度、产出动画等）
  }

  // ═══════════════════════════════════════════════════════════
  // 拖拽交互
  // ═══════════════════════════════════════════════════════════

  private onPointerDown = (e: import('pixi.js').FederatedPointerEvent): void => {
    this.dragging = true;
    this.dragStart = { x: e.globalX, y: e.globalY };
  };

  private onPointerMove = (e: import('pixi.js').FederatedPointerEvent): void => {
    if (!this.dragging) return;

    const dx = e.globalX - this.dragStart.x;
    const dy = e.globalY - this.dragStart.y;

    // 平移地图容器（通过摄像机管理器）
    const camState = this.cameraManager.getState();
    this.cameraManager.panTo(camState.x + dx, camState.y + dy, false);

    this.dragStart = { x: e.globalX, y: e.globalY };
  };

  private onPointerUp = (): void => {
    this.dragging = false;
  };
}
