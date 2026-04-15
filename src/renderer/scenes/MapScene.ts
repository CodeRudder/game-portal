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

import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
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
import type {
  GameMap,
  MapTile,
  MapNPC,
  MapLandmark,
  TerrainType,
} from '../../games/three-kingdoms/MapGenerator';

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

// ─── 增强渲染常量 ──────────────────────────────────────────

/** 势力颜色映射（红/蓝/绿/黄） */
const FACTION_COLORS: Record<string, number> = {
  wei: 0x4a90d9,    // 蓝 — 魏
  shu: 0xe74c3c,    // 红 — 蜀
  wu: 0x2ecc71,     // 绿 — 吴
  qun: 0xf1c40f,    // 黄 — 群
};

/** 领土边界虚线段长 */
const DASH_SEGMENT_LENGTH = 8;

/** 领土边界虚线间隙 */
const DASH_GAP_LENGTH = 5;

/** 领土边界线宽 */
const BORDER_LINE_WIDTH = 2.5;

/** 新占领领土脉冲扩散动画周期（毫秒） */
const CAPTURE_PULSE_PERIOD = 3000;

/** 新占领领土脉冲最大半径 */
const CAPTURE_PULSE_MAX_RADIUS = 80;

/** 新占领领土脉冲透明度 */
const CAPTURE_PULSE_ALPHA = 0.4;

/** 格子悬停高亮颜色（半透明黄色） */
const CELL_HOVER_COLOR = 0xffeb3b;

/** 格子悬停高亮透明度 */
const CELL_HOVER_ALPHA = 0.25;

/** 格子悬停高亮尺寸 */
const CELL_HOVER_SIZE = 20;

/** 选区边框颜色 */
const SELECTION_BORDER_COLOR = 0x00ff88;

/** 选区边框宽度 */
const SELECTION_BORDER_WIDTH = 2;

/** 选区填充透明度 */
const SELECTION_FILL_ALPHA = 0.1;

/** 装饰物数量（树木/石头） */
const DECORATION_COUNT = 30;

/** 装饰物随机种子区域范围 */
const DECORATION_AREA = { minX: -400, maxX: 2400, minY: -400, maxY: 1400 };

/** 树木颜色 */
const TREE_TRUNK_COLOR = 0x8b5e3c;
const TREE_LEAF_COLOR = 0x27ae60;

/** 石头颜色 */
const ROCK_COLOR = 0x7f8c8d;

/** 河流颜色 */
const RIVER_COLOR = 0x3498db;

/** 河流宽度 */
const RIVER_WIDTH = 6;

/** 道路颜色 */
const ROAD_COLOR = 0xd4a574;

/** 道路宽度 */
const ROAD_WIDTH = 4;

/** 建筑精灵图尺寸 */
const BUILDING_SPRITE_SIZE = 48;

/** 建筑等级纹理后缀映射 */
const BUILDING_LEVEL_TEXTURES: Record<number, string> = {
  1: 'building-lv1',
  2: 'building-lv2',
  3: 'building-lv3',
  4: 'building-lv4',
  5: 'building-lv5',
};

// ─── 瓦片地图渲染常量 ──────────────────────────────────────

/** 地形颜色映射 */
const TERRAIN_COLORS: Record<TerrainType, number> = {
  plain: 0x4a7c4f,
  mountain: 0x8b7355,
  forest: 0x2d5a2d,
  water: 0x4a8db7,
  road: 0xc4a35a,
  city: 0xd4a574,
  village: 0x8fbc8f,
  fortress: 0xa0522d,
};

/** 地形文字标签 */
const TERRAIN_LABELS: Record<TerrainType, string> = {
  plain: '平原',
  mountain: '山地',
  forest: '森林',
  water: '水域',
  road: '道路',
  city: '城市',
  village: '村庄',
  fortress: '关卡',
};

/** 瓦片边界线颜色 */
const TILE_BORDER_COLOR = 0x2a2a4e;

/** 瓦片边界线宽度 */
const TILE_BORDER_WIDTH = 0.5;

/** 瓦片边界线透明度 */
const TILE_BORDER_ALPHA = 0.3;

/** 地标标签字号 */
const LANDMARK_FONT_SIZE = 11;

/** 地标标签颜色 */
const LANDMARK_LABEL_COLOR = 0xffd700;

/** NPC 点半径 */
const NPC_DOT_RADIUS = 6;

/** NPC 类型颜色映射 */
const NPC_TYPE_COLORS: Record<string, number> = {
  farmer: 0x4caf50,
  soldier: 0xf44336,
  merchant: 0xffc107,
  scholar: 0x2196f3,
  scout: 0x9c27b0,
};

/** NPC 类型 emoji 映射 */
const NPC_TYPE_EMOJI: Record<string, string> = {
  farmer: '🌾',
  soldier: '⚔️',
  merchant: '💰',
  scholar: '📖',
  scout: '🔍',
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

/** 装饰物渲染对象 */
interface DecorationItem {
  container: Container;
  type: 'tree' | 'rock';
}

/** 河流/道路渲染数据 */
interface TerrainPath {
  graphics: Graphics;
  points: { x: number; y: number }[];
}

/** 选区状态 */
interface SelectionState {
  active: boolean;
  start: { x: number; y: number };
  end: { x: number; y: number };
  graphics: Graphics;
  selectedTerritories: Set<string>;
}

/** 格子悬停高亮 */
interface CellHighlight {
  graphics: Graphics;
  visible: boolean;
  gridX: number;
  gridY: number;
}

/** 瓦片地图渲染对象 */
interface TileMapView {
  tileLayer: Container;
  labelLayer: Container;
  buildingLayer: Container;
  npcLayer: Container;
  borderLayer: Container;
  landmarkLayer: Container;
  graphics: Graphics;
}

/** NPC 渲染对象 */
interface NPCDotView {
  id: string;
  container: Container;
  data: MapNPC | null;
}

/** 地标渲染对象 */
interface LandmarkView {
  id: string;
  container: Container;
  data: MapLandmark;
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

  // ─── 增强渲染：装饰层 ────────────────────────────────────

  /** 装饰物层（树木/石头，位于连接线下方） */
  private decorationLayer: Container;
  /** 装饰物列表 */
  private decorations: DecorationItem[] = [];
  /** 河流/道路图形列表 */
  private terrainPaths: TerrainPath[] = [];

  // ─── 增强渲染：领土边界 ──────────────────────────────────

  /** 领土边界层（虚线边界） */
  private borderLayer: Container;
  /** 新占领领土脉冲动画计时 */
  private capturePulseTime: number = 0;
  /** 新占领领土 ID 集合（最近被占领的，用于播放扩散动画） */
  private recentlyCaptured: Set<string> = new Set();
  /** 新占领脉冲图形缓存 */
  private capturePulseGraphics: Map<string, Graphics> = new Map();

  // ─── 增强渲染：格子悬停高亮 ──────────────────────────────

  /** 格子悬停高亮图形 */
  private cellHighlight: CellHighlight;

  // ─── 增强渲染：右键选区 ──────────────────────────────────

  /** 右键选区状态 */
  private selection: SelectionState;

  // ─── 瓦片地图渲染模式 ─────────────────────────────────────

  /** 瓦片地图数据（由外部注入） */
  private tileMapData: GameMap | null = null;
  /** 瓦片地图渲染对象（仅瓦片模式时使用） */
  private tileMapView: TileMapView | null = null;
  /** NPC 渲染点映射 */
  private npcDots: Map<string, NPCDotView> = new Map();
  /** 地标渲染映射 */
  private landmarkViews: Map<string, LandmarkView> = new Map();
  /** 是否使用瓦片地图模式 */
  private useTileMapMode: boolean = false;

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
    this.decorationLayer = new Container({ label: 'decorations' });
    this.connectionLayer = new Container({ label: 'connections' });
    this.borderLayer = new Container({ label: 'borders' });
    this.territoryLayer = new Container({ label: 'territories' });
    this.buildingLayer = new Container({ label: 'buildings' });
    this.tooltipLayer = new Container({ label: 'tooltips' });

    this.container.addChild(
      this.decorationLayer,
      this.connectionLayer,
      this.borderLayer,
      this.territoryLayer,
      this.buildingLayer,
      this.tooltipLayer,
    );

    // 初始化格子悬停高亮
    const highlightGfx = new Graphics();
    highlightGfx.visible = false;
    this.container.addChild(highlightGfx);
    this.cellHighlight = {
      graphics: highlightGfx,
      visible: false,
      gridX: 0,
      gridY: 0,
    };

    // 初始化右键选区
    const selectionGfx = new Graphics();
    selectionGfx.visible = false;
    this.container.addChild(selectionGfx);
    this.selection = {
      active: false,
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 },
      graphics: selectionGfx,
      selectedTerritories: new Set(),
    };
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

    // 右键选区事件
    this.container.on('rightdown', this.onRightDown);
    this.container.on('rightup', this.onRightUp);
    this.container.on('rightupoutside', this.onRightUp);
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

    // ── 5. 更新新占领领土脉冲扩散动画 ───────────────────────
    this.updateCapturePulse(deltaTime);

    // ── 6. 更新格子悬停高亮 ─────────────────────────────────
    this.updateCellHighlight();

    // ── 7. 更新右键选区 ─────────────────────────────────────
    this.updateSelection();
  }

  protected onSetData(data: unknown): void {
    const state = data as GameRenderState;

    // 瓦片地图数据注入：首次检测到 tileMapData 时自动切换到瓦片地图模式
    if (state.tileMapData && !this.useTileMapMode) {
      this.setTileMapData(state.tileMapData as Parameters<typeof this.setTileMapData>[0]);
    }

    // 瓦片地图模式：直接使用瓦片渲染，跳过节点图
    if (this.useTileMapMode) return;

    if (!state.map) return;
    this.renderMap(state.map);
  }

  protected onDestroy(): void {
    this.destroyTileMapView();
    this.territoryNodes.clear();
    this.buildingIcons.clear();
    this.decorations = [];
    this.terrainPaths = [];
    this.recentlyCaptured.clear();
    this.capturePulseGraphics.clear();
    this.destroyTooltip();
    this.decorationLayer.destroy({ children: true });
    this.connectionLayer.destroy({ children: true });
    this.borderLayer.destroy({ children: true });
    this.territoryLayer.destroy({ children: true });
    this.buildingLayer.destroy({ children: true });
    this.tooltipLayer.destroy({ children: true });
    this.cellHighlight.graphics.destroy();
    this.selection.graphics.destroy();
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
    // 生成装饰物（仅首次有领土数据时）
    if (this.decorations.length === 0 && data.territories.length > 0) {
      this.generateDecorations();
      this.generateTerrainPaths();
    }

    this.renderConnections(data);
    this.renderTerritories(data.territories);
    this.renderBorders(data.territories);
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
   *
   * 优先使用精灵纹理（从 AssetManager 获取），纹理不可用时 fallback 到 Graphics 矩形。
   * 不同等级的建筑使用不同纹理 key。
   */
  private createBuildingIcon(data: BuildingRenderData): BuildingIcon {
    const container = new Container({ label: `building-${data.id}` });
    container.position.set(data.position.x, data.position.y);
    container.eventMode = 'static';
    container.cursor = 'pointer';

    // 尝试从 AssetManager 获取精灵纹理
    const textureKey = BUILDING_LEVEL_TEXTURES[data.level] ?? BUILDING_LEVEL_TEXTURES[1];
    const texture = this.assetManager.getTexture(textureKey);

    if (texture) {
      // 使用真实精灵纹理
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.width = BUILDING_SPRITE_SIZE;
      sprite.height = BUILDING_SPRITE_SIZE;
      container.addChild(sprite);
    } else {
      // Fallback：使用 Graphics 绘制建筑矩形 + 屋顶
      const fallbackGfx = new Graphics();
      // 建筑主体
      fallbackGfx
        .rect(
          -BUILDING_SPRITE_SIZE / 2,
          -BUILDING_SPRITE_SIZE / 4,
          BUILDING_SPRITE_SIZE,
          BUILDING_SPRITE_SIZE * 0.6,
        )
        .fill({ color: this.getBuildingColor(data.level) });
      // 屋顶（三角形）
      fallbackGfx
        .moveTo(-BUILDING_SPRITE_SIZE / 2 - 4, -BUILDING_SPRITE_SIZE / 4)
        .lineTo(0, -BUILDING_SPRITE_SIZE / 2 - 4)
        .lineTo(BUILDING_SPRITE_SIZE / 2 + 4, -BUILDING_SPRITE_SIZE / 4)
        .closePath()
        .fill({ color: 0xc0392b });
      // 等级标记
      fallbackGfx
        .circle(BUILDING_SPRITE_SIZE / 3, -BUILDING_SPRITE_SIZE / 3, 6)
        .fill({ color: 0xf39c12 });
      container.addChild(fallbackGfx);
    }

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

    return { id: data.id, container, icon: new Text(''), progressArc, hasProgressArc: false, data };
  }

  /**
   * 更新建筑图标
   *
   * 当建筑等级变化时，重新选择纹理或重新绘制 fallback。
   */
  private updateBuildingIcon(icon: BuildingIcon, data: BuildingRenderData): void {
    const levelChanged = icon.data?.level !== data.level;
    icon.data = data;
    icon.container.position.set(data.position.x, data.position.y);

    // 等级变化时重新绘制图标
    if (levelChanged) {
      // 移除旧图标（保留 progressArc，它在最后）
      const children = icon.container.removeChildren();
      for (let i = 0; i < children.length - 1; i++) {
        children[i].destroy();
      }

      // 重新创建图标
      const textureKey = BUILDING_LEVEL_TEXTURES[data.level] ?? BUILDING_LEVEL_TEXTURES[1];
      const texture = this.assetManager.getTexture(textureKey);

      if (texture) {
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 0.5);
        sprite.width = BUILDING_SPRITE_SIZE;
        sprite.height = BUILDING_SPRITE_SIZE;
        icon.container.addChildAt(sprite, 0);
      } else {
        const fallbackGfx = new Graphics();
        fallbackGfx
          .rect(
            -BUILDING_SPRITE_SIZE / 2,
            -BUILDING_SPRITE_SIZE / 4,
            BUILDING_SPRITE_SIZE,
            BUILDING_SPRITE_SIZE * 0.6,
          )
          .fill({ color: this.getBuildingColor(data.level) });
        fallbackGfx
          .moveTo(-BUILDING_SPRITE_SIZE / 2 - 4, -BUILDING_SPRITE_SIZE / 4)
          .lineTo(0, -BUILDING_SPRITE_SIZE / 2 - 4)
          .lineTo(BUILDING_SPRITE_SIZE / 2 + 4, -BUILDING_SPRITE_SIZE / 4)
          .closePath()
          .fill({ color: 0xc0392b });
        fallbackGfx
          .circle(BUILDING_SPRITE_SIZE / 3, -BUILDING_SPRITE_SIZE / 3, 6)
          .fill({ color: 0xf39c12 });
        icon.container.addChildAt(fallbackGfx, 0);
      }
    }
    // 进度弧线由 updateBuildingProgress() 每帧绘制，此处不重复处理
  }

  // ═══════════════════════════════════════════════════════════
  // 建筑颜色辅助
  // ═══════════════════════════════════════════════════════════

  /**
   * 根据建筑等级返回颜色
   */
  private getBuildingColor(level: number): number {
    const colors = [0x95a5a6, 0x2ecc71, 0x3498db, 0x9b59b6, 0xf39c12];
    return colors[Math.min(level, colors.length) - 1] ?? colors[0];
  }

  // ═══════════════════════════════════════════════════════════
  // 领土边界渲染（虚线 + 势力颜色）
  // ═══════════════════════════════════════════════════════════

  /**
   * 渲染领土间虚线边界
   *
   * 每条连接线绘制为虚线，颜色根据两端领土所属势力决定。
   */
  private renderBorders(territories: TerritoryRenderData[]): void {
    this.borderLayer.removeChildren();
    const borderGfx = new Graphics();

    for (const territory of territories) {
      for (const neighborId of territory.neighbors) {
        // 避免重复绘制（只处理 id < neighborId 的对）
        if (territory.id >= neighborId) continue;

        const neighbor = this.territoryNodes.get(neighborId);
        const currentNode = this.territoryNodes.get(territory.id);
        if (!neighbor?.data || !currentNode?.data) continue;

        const from = territory.position;
        const to = neighbor.data.position;

        // 根据势力选择颜色
        const color = this.getFactionBorderColor(territory, neighbor.data);

        // 绘制虚线
        this.drawDashedLine(borderGfx, from.x, from.y, to.x, to.y, color);
      }
    }

    this.borderLayer.addChild(borderGfx);
  }

  /**
   * 绘制虚线
   */
  private drawDashedLine(
    gfx: Graphics,
    x1: number, y1: number,
    x2: number, y2: number,
    color: number,
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    const nx = dx / dist;
    const ny = dy / dist;

    const segmentLen = DASH_SEGMENT_LENGTH;
    const gapLen = DASH_GAP_LENGTH;
    const step = segmentLen + gapLen;

    let pos = 0;
    while (pos < dist) {
      const segEnd = Math.min(pos + segmentLen, dist);
      gfx
        .moveTo(x1 + nx * pos, y1 + ny * pos)
        .lineTo(x1 + nx * segEnd, y1 + ny * segEnd)
        .stroke({ width: BORDER_LINE_WIDTH, color, alpha: 0.7 });
      pos += step;
    }
  }

  /**
   * 根据两端领土获取边界颜色
   */
  private getFactionBorderColor(t1: TerritoryRenderData, t2: TerritoryRenderData): number {
    // 优先使用势力颜色，同势力用势力色，不同势力用混合色
    const faction1 = this.inferFaction(t1);
    const faction2 = this.inferFaction(t2);

    if (faction1 && FACTION_COLORS[faction1]) return FACTION_COLORS[faction1];
    if (faction2 && FACTION_COLORS[faction2]) return FACTION_COLORS[faction2];

    // 默认：已征服用征服色，未征服用连接色
    return t1.conquered && t2.conquered ? CONQUERED_COLOR : CONNECTION_COLOR;
  }

  /**
   * 从领土数据推断势力
   *
   * 通过领土 color 字段或名称关键词推断所属势力。
   */
  private inferFaction(data: TerritoryRenderData): string | null {
    if (data.color) {
      const c = data.color.toLowerCase();
      if (c.includes('wei') || c.includes('蓝')) return 'wei';
      if (c.includes('shu') || c.includes('红')) return 'shu';
      if (c.includes('wu') || c.includes('绿')) return 'wu';
      if (c.includes('qun') || c.includes('黄')) return 'qun';
    }
    // 通过名称关键词推断
    const name = data.name;
    if (name.includes('魏') || name.includes('许') || name.includes('洛')) return 'wei';
    if (name.includes('蜀') || name.includes('成') || name.includes('汉')) return 'shu';
    if (name.includes('吴') || name.includes('建') || name.includes('会')) return 'wu';
    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // 新占领领土脉冲扩散动画
  // ═══════════════════════════════════════════════════════════

  /**
   * 更新新占领领土的脉冲扩散动画
   *
   * 扩散圆环从领土中心向外扩展，透明度逐渐降低。
   */
  private updateCapturePulse(deltaTime: number): void {
    this.capturePulseTime += deltaTime;

    for (const territoryId of this.recentlyCaptured) {
      const node = this.territoryNodes.get(territoryId);
      if (!node?.data) continue;

      let gfx = this.capturePulseGraphics.get(territoryId);
      if (!gfx) {
        gfx = new Graphics();
        this.container.addChild(gfx);
        this.capturePulseGraphics.set(territoryId, gfx);
      }

      gfx.clear();

      const phase = (this.capturePulseTime % CAPTURE_PULSE_PERIOD) / CAPTURE_PULSE_PERIOD;
      const radius = TERRITORY_RADIUS + (CAPTURE_PULSE_MAX_RADIUS - TERRITORY_RADIUS) * phase;
      const alpha = CAPTURE_PULSE_ALPHA * (1 - phase);

      const faction = this.inferFaction(node.data);
      const color = (faction && FACTION_COLORS[faction]) ?? CONQUERED_COLOR;

      gfx.circle(node.data.position.x, node.data.position.y, radius);
      gfx.stroke({ width: 2, color, alpha });

      // 内部填充光晕
      gfx.circle(node.data.position.x, node.data.position.y, radius * 0.5);
      gfx.fill({ color, alpha: alpha * 0.3 });
    }
  }

  /**
   * 标记领土为新占领（触发脉冲扩散动画）
   */
  markRecentlyCaptured(territoryId: string): void {
    this.recentlyCaptured.add(territoryId);
    // 5 秒后自动移除
    setTimeout(() => {
      this.recentlyCaptured.delete(territoryId);
      const gfx = this.capturePulseGraphics.get(territoryId);
      if (gfx) {
        gfx.clear();
        this.container.removeChild(gfx);
        gfx.destroy();
        this.capturePulseGraphics.delete(territoryId);
      }
    }, 5000);
  }

  // ═══════════════════════════════════════════════════════════
  // 瓦片地图渲染模式
  // ═══════════════════════════════════════════════════════════

  /**
   * 注入瓦片地图数据，切换到瓦片地图渲染模式
   *
   * 当 GameMap 数据可用时，优先使用瓦片地图渲染；
   * 否则 fallback 到原有节点图模式。
   *
   * @param mapData - MapGenerator 生成的完整地图数据
   */
  setTileMapData(mapData: GameMap): void {
    this.tileMapData = mapData;
    this.useTileMapMode = true;

    // 更新摄像机边界以适配瓦片地图
    const mapWidth = mapData.width * mapData.tileSize;
    const mapHeight = mapData.height * mapData.tileSize;
    this.cameraManager.setBounds({
      minX: -200,
      maxX: mapWidth + 200,
      minY: -200,
      maxY: mapHeight + 200,
    });

    // 渲染瓦片地图
    this.renderTileMap();
  }

  /**
   * 渲染完整瓦片地图
   *
   * 按层级绘制：瓦片地形 → 领土边界 → 建筑 → NPC → 地标标签
   */
  private renderTileMap(): void {
    if (!this.tileMapData) return;

    // 清理旧的瓦片地图渲染
    this.destroyTileMapView();

    const map = this.tileMapData;
    const tileSize = map.tileSize;

    // 创建瓦片地图子容器
    const tileLayer = new Container({ label: 'tile-terrain' });
    const borderLayer = new Container({ label: 'tile-borders' });
    const buildingLayer = new Container({ label: 'tile-buildings' });
    const npcLayer = new Container({ label: 'tile-npcs' });
    const landmarkLayer = new Container({ label: 'tile-landmarks' });
    const labelLayer = new Container({ label: 'tile-labels' });

    // 按层级添加到容器（地形 → 边界 → 建筑 → NPC → 标签）
    this.container.addChildAt(tileLayer, 0);
    this.container.addChildAt(borderLayer, 1);
    this.container.addChildAt(buildingLayer, 2);
    this.container.addChildAt(npcLayer, 3);
    this.container.addChildAt(landmarkLayer, 4);
    this.container.addChildAt(labelLayer, 5);

    const graphics = new Graphics();

    // ── 1. 绘制地形瓦片 ────────────────────────────────────
    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const tile = map.tiles[row]?.[col];
        if (!tile) continue;

        const x = col * tileSize;
        const y = row * tileSize;
        const color = TERRAIN_COLORS[tile.terrain] ?? TERRAIN_COLORS.plain;

        // 填充地形色块
        graphics.rect(x, y, tileSize, tileSize).fill({ color });

        // 瓦片网格线
        graphics.rect(x, y, tileSize, tileSize).stroke({
          width: TILE_BORDER_WIDTH,
          color: TILE_BORDER_COLOR,
          alpha: TILE_BORDER_ALPHA,
        });

        // 海拔视觉变化：高海拔区域加深颜色
        if (tile.elevation >= 3) {
          graphics.rect(x, y, tileSize, tileSize).fill({ color: 0x000000, alpha: 0.15 });
        } else if (tile.elevation >= 2) {
          graphics.rect(x, y, tileSize, tileSize).fill({ color: 0x000000, alpha: 0.07 });
        }
      }
    }
    tileLayer.addChild(graphics);

    // ── 2. 绘制领土边界（虚线） ────────────────────────────
    this.renderTileTerritoryBorders(borderLayer, map);

    // ── 3. 绘制建筑图标 ────────────────────────────────────
    this.renderTileBuildings(buildingLayer, map);

    // ── 4. 绘制 NPC 点 ─────────────────────────────────────
    this.renderTileNPCs(npcLayer, map);

    // ── 5. 绘制地标文字标签 ────────────────────────────────
    this.renderTileLandmarks(landmarkLayer, labelLayer, map);

    this.tileMapView = {
      tileLayer,
      labelLayer,
      buildingLayer,
      npcLayer,
      borderLayer,
      landmarkLayer,
      graphics,
    };
  }

  /**
   * 绘制领土边界虚线
   *
   * 遍历所有瓦片，当相邻瓦片属于不同领土时绘制虚线边界。
   */
  private renderTileTerritoryBorders(borderLayer: Container, map: GameMap): void {
    const borderGfx = new Graphics();
    const tileSize = map.tileSize;

    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const tile = map.tiles[row]?.[col];
        if (!tile?.territoryId) continue;

        // 检查右邻瓦片
        const rightTile = map.tiles[row]?.[col + 1];
        if (rightTile && rightTile.territoryId && rightTile.territoryId !== tile.territoryId) {
          const x = (col + 1) * tileSize;
          const y1 = row * tileSize;
          const y2 = (row + 1) * tileSize;
          this.drawDashedLine(borderGfx, x, y1, x, y2, FACTION_COLORS[tile.territoryId.split('_')[0]] ?? 0xe94560);
        }

        // 检查下邻瓦片
        const bottomTile = map.tiles[row + 1]?.[col];
        if (bottomTile && bottomTile.territoryId && bottomTile.territoryId !== tile.territoryId) {
          const x1 = col * tileSize;
          const x2 = (col + 1) * tileSize;
          const y = (row + 1) * tileSize;
          this.drawDashedLine(borderGfx, x1, y, x2, y, FACTION_COLORS[tile.territoryId.split('_')[0]] ?? 0xe94560);
        }
      }
    }

    borderLayer.addChild(borderGfx);
  }

  /**
   * 绘制建筑图标（用 PixiJS Graphics 绘制简单形状）
   *
   * 不同建筑类型使用不同形状和颜色：
   * - 城市：方形 + 城墙
   * - 村庄：小屋形状
   * - 关卡：堡垒形状
   * - 其他：简单圆形
   */
  private renderTileBuildings(buildingLayer: Container, map: GameMap): void {
    const tileSize = map.tileSize;

    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const tile = map.tiles[row]?.[col];
        if (!tile?.buildingId) continue;

        const cx = col * tileSize + tileSize / 2;
        const cy = row * tileSize + tileSize / 2;
        const container = new Container({ label: `tile-bldg-${tile.buildingId}` });
        container.position.set(cx, cy);
        container.eventMode = 'static';
        container.cursor = 'pointer';

        const gfx = new Graphics();
        const halfSize = tileSize * 0.3;

        // 根据地形类型绘制不同建筑形状
        switch (tile.terrain) {
          case 'city':
            // 城市方形 + 城墙
            gfx.rect(-halfSize, -halfSize, halfSize * 2, halfSize * 2)
              .fill({ color: 0xd4a574 });
            gfx.rect(-halfSize, -halfSize, halfSize * 2, halfSize * 2)
              .stroke({ color: 0x8b6914, width: 2 });
            // 城墙锯齿
            gfx.rect(-halfSize, -halfSize - 4, 8, 4).fill({ color: 0x8b6914 });
            gfx.rect(halfSize - 8, -halfSize - 4, 8, 4).fill({ color: 0x8b6914 });
            break;

          case 'village':
            // 小屋形状（三角屋顶 + 方形主体）
            gfx.rect(-halfSize * 0.7, -halfSize * 0.2, halfSize * 1.4, halfSize * 0.9)
              .fill({ color: 0x8fbc8f });
            gfx.moveTo(-halfSize * 0.8, -halfSize * 0.2)
              .lineTo(0, -halfSize * 0.9)
              .lineTo(halfSize * 0.8, -halfSize * 0.2)
              .closePath()
              .fill({ color: 0x8b4513 });
            break;

          case 'fortress':
            // 堡垒形状
            gfx.rect(-halfSize, -halfSize * 0.6, halfSize * 2, halfSize * 1.2)
              .fill({ color: 0xa0522d });
            gfx.rect(-halfSize, -halfSize * 0.6, halfSize * 2, halfSize * 1.2)
              .stroke({ color: 0x5c3317, width: 2 });
            // 塔楼
            gfx.rect(-halfSize - 4, -halfSize * 0.8, 8, halfSize * 1.4)
              .fill({ color: 0x8b6914 });
            gfx.rect(halfSize - 4, -halfSize * 0.8, 8, halfSize * 1.4)
              .fill({ color: 0x8b6914 });
            break;

          default:
            // 通用建筑圆形
            gfx.circle(0, 0, halfSize * 0.7).fill({ color: 0x95a5a6 });
            gfx.circle(0, 0, halfSize * 0.7).stroke({ color: 0x7f8c8d, width: 1 });
            break;
        }

        container.addChild(gfx);

        // 建筑点击事件
        container.on('pointerdown', () => {
          this.bridgeEvent('buildingClick', tile.buildingId!);
        });

        buildingLayer.addChild(container);
      }
    }
  }

  /**
   * 绘制 NPC 点（彩色小圆点 + emoji）
   */
  private renderTileNPCs(npcLayer: Container, map: GameMap): void {
    // 清理旧 NPC
    for (const [, view] of this.npcDots) {
      view.container.destroy({ children: true });
    }
    this.npcDots.clear();

    const tileSize = map.tileSize;

    for (const npc of map.npcs) {
      const cx = npc.tileX * tileSize + tileSize / 2;
      const cy = npc.tileY * tileSize + tileSize / 2;

      const container = new Container({ label: `tile-npc-${npc.id}` });
      container.position.set(cx, cy);
      container.eventMode = 'static';
      container.cursor = 'pointer';

      const gfx = new Graphics();
      const color = NPC_TYPE_COLORS[npc.type] ?? 0x9e9e9e;

      // 底部彩色圆点
      gfx.circle(0, 0, NPC_DOT_RADIUS).fill({ color });
      gfx.circle(0, 0, NPC_DOT_RADIUS).stroke({ color: 0xffffff, width: 1 });

      container.addChild(gfx);

      // Emoji 标签
      const emoji = NPC_TYPE_EMOJI[npc.type] ?? '👤';
      const emojiText = new Text({
        text: emoji,
        style: new TextStyle({ fontSize: 10 }),
      });
      emojiText.anchor.set(0.5, 0.5);
      emojiText.position.set(0, -NPC_DOT_RADIUS - 8);
      container.addChild(emojiText);

      // NPC 名称
      const nameText = new Text({
        text: npc.name,
        style: new TextStyle({
          fontSize: 9,
          fill: '#e0e0e0',
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        }),
      });
      nameText.anchor.set(0.5, 0);
      nameText.position.set(0, NPC_DOT_RADIUS + 2);
      container.addChild(nameText);

      // 点击事件
      container.on('pointerdown', () => {
        this.bridgeEvent('heroClick', npc.id);
      });

      npcLayer.addChild(container);
      this.npcDots.set(npc.id, { id: npc.id, container, data: npc });
    }
  }

  /**
   * 绘制地标文字标签
   */
  private renderTileLandmarks(
    landmarkLayer: Container,
    labelLayer: Container,
    map: GameMap,
  ): void {
    // 清理旧地标
    for (const [, view] of this.landmarkViews) {
      view.container.destroy({ children: true });
    }
    this.landmarkViews.clear();

    const tileSize = map.tileSize;

    for (const lm of map.landmarks) {
      const cx = lm.x * tileSize + tileSize / 2;
      const cy = lm.y * tileSize + tileSize / 2;

      const container = new Container({ label: `tile-landmark-${lm.name}` });
      container.position.set(cx, cy);

      // 地标标记（金色圆环）
      const marker = new Graphics();
      marker.circle(0, 0, 14).stroke({ color: LANDMARK_LABEL_COLOR, width: 2 });
      marker.circle(0, 0, 8).fill({ color: LANDMARK_LABEL_COLOR, alpha: 0.3 });
      container.addChild(marker);

      // 地标类型图标
      const iconMap: Record<string, string> = {
        capital: '👑',
        city: '🏙️',
        fortress: '🏰',
        bridge: '🌉',
      };
      const icon = new Text({
        text: iconMap[lm.type] ?? '📍',
        style: new TextStyle({ fontSize: 12 },
        ),
      });
      icon.anchor.set(0.5, 0.5);
      container.addChild(icon);

      landmarkLayer.addChild(container);

      // 文字标签（单独一层，在最高层显示）
      const label = new Text({
        text: lm.name,
        style: new TextStyle({
          fontSize: LANDMARK_FONT_SIZE,
          fill: LANDMARK_LABEL_COLOR,
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontWeight: 'bold',
          stroke: { color: '#000000', width: 2 },
        }),
      });
      label.anchor.set(0.5, 0);
      label.position.set(cx, cy + 18);
      labelLayer.addChild(label);

      this.landmarkViews.set(lm.name, { id: lm.name, container, data: lm });
    }
  }

  /**
   * 销毁瓦片地图渲染对象
   */
  private destroyTileMapView(): void {
    if (!this.tileMapView) return;

    const layers = [
      this.tileMapView.tileLayer,
      this.tileMapView.borderLayer,
      this.tileMapView.buildingLayer,
      this.tileMapView.npcLayer,
      this.tileMapView.landmarkLayer,
      this.tileMapView.labelLayer,
    ];

    for (const layer of layers) {
      if (layer.parent) layer.parent.removeChild(layer);
      layer.destroy({ children: true });
    }

    this.tileMapView = null;
    this.npcDots.clear();
    this.landmarkViews.clear();
  }

  // ═══════════════════════════════════════════════════════════
  // 地图装饰元素
  // ═══════════════════════════════════════════════════════════

  /**
   * 生成随机装饰物（树木/石头）
   *
   * 使用简单伪随机数确保每次生成结果一致。
   */
  private generateDecorations(): void {
    this.decorationLayer.removeChildren();
    this.decorations = [];

    let seed = 42;
    const random = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < DECORATION_COUNT; i++) {
      const x = DECORATION_AREA.minX + random() * (DECORATION_AREA.maxX - DECORATION_AREA.minX);
      const y = DECORATION_AREA.minY + random() * (DECORATION_AREA.maxY - DECORATION_AREA.minY);
      const type = random() > 0.4 ? 'tree' : 'rock';
      const scale = 0.5 + random() * 0.8;

      const container = new Container({ label: `decoration-${i}` });
      container.position.set(x, y);
      container.scale.set(scale);

      const gfx = new Graphics();

      if (type === 'tree') {
        // 树干
        gfx.rect(-3, 0, 6, 14).fill({ color: TREE_TRUNK_COLOR });
        // 树冠（三角形叠加）
        gfx.moveTo(-10, 2).lineTo(0, -14).lineTo(10, 2).closePath().fill({ color: TREE_LEAF_COLOR });
        gfx.moveTo(-8, -4).lineTo(0, -18).lineTo(8, -4).closePath().fill({ color: 0x2ecc71 });
      } else {
        // 石头（不规则多边形）
        gfx
          .moveTo(-8, 2).lineTo(-6, -6).lineTo(0, -8).lineTo(7, -5)
          .lineTo(9, 1).lineTo(5, 6).lineTo(-4, 5).closePath()
          .fill({ color: ROCK_COLOR });
        // 高光
        gfx.moveTo(-3, -4).lineTo(0, -6).lineTo(4, -3).lineTo(1, -1).closePath()
          .fill({ color: 0x95a5a6, alpha: 0.6 });
      }

      container.addChild(gfx);
      this.decorationLayer.addChild(container);
      this.decorations.push({ container, type });
    }
  }

  /**
   * 生成河流和道路（贝塞尔曲线）
   */
  private generateTerrainPaths(): void {
    this.terrainPaths = [];

    const riverGfx = new Graphics();
    // 河流：从左上到右下的贝塞尔曲线
    const riverPoints = [
      { x: -300, y: 200 },
      { x: 200, y: 350 },
      { x: 600, y: 250 },
      { x: 1000, y: 500 },
      { x: 1400, y: 400 },
      { x: 1800, y: 600 },
      { x: 2200, y: 550 },
    ];
    this.drawBezierPath(riverGfx, riverPoints, RIVER_COLOR, RIVER_WIDTH);
    // 河流高光
    this.drawBezierPath(riverGfx, riverPoints, 0x85c1e9, RIVER_WIDTH * 0.4);
    this.decorationLayer.addChild(riverGfx);
    this.terrainPaths.push({ graphics: riverGfx, points: riverPoints });

    // 道路：另一条贝塞尔曲线
    const roadGfx = new Graphics();
    const roadPoints = [
      { x: 100, y: -300 },
      { x: 300, y: 100 },
      { x: 500, y: 400 },
      { x: 800, y: 600 },
      { x: 1100, y: 800 },
      { x: 1500, y: 900 },
    ];
    this.drawBezierPath(roadGfx, roadPoints, ROAD_COLOR, ROAD_WIDTH);
    this.decorationLayer.addChild(roadGfx);
    this.terrainPaths.push({ graphics: roadGfx, points: roadPoints });
  }

  /**
   * 用贝塞尔曲线绘制平滑路径
   *
   * 使用二次贝塞尔曲线在相邻点之间插值。
   */
  private drawBezierPath(
    gfx: Graphics,
    points: { x: number; y: number }[],
    color: number,
    width: number,
  ): void {
    if (points.length < 2) return;

    gfx.moveTo(points[0].x, points[0].y);

    if (points.length === 2) {
      gfx.lineTo(points[1].x, points[1].y);
    } else {
      // 使用中点法绘制平滑曲线
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];

        if (i === 0) {
          gfx.lineTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
        } else if (i === points.length - 2) {
          gfx.quadraticCurveTo(p0.x, p0.y, p1.x, p1.y);
        } else {
          const midX = (p0.x + p1.x) / 2;
          const midY = (p0.y + p1.y) / 2;
          gfx.quadraticCurveTo(p0.x, p0.y, midX, midY);
        }
      }
    }

    gfx.stroke({ width, color, cap: 'round', join: 'round' });
  }

  // ═══════════════════════════════════════════════════════════
  // 格子悬停高亮
  // ═══════════════════════════════════════════════════════════

  /**
   * 更新格子悬停高亮
   *
   * 将鼠标位置对齐到虚拟网格，显示半透明黄色覆盖。
   */
  private updateCellHighlight(): void {
    if (this.dragging || this.selection.active) {
      this.cellHighlight.graphics.visible = false;
      this.cellHighlight.visible = false;
      return;
    }

    // 将全局坐标转换为本地坐标
    const camState = this.cameraManager.getState();
    const localX = this.pointerGlobalPos.x + camState.x;
    const localY = this.pointerGlobalPos.y + camState.y;

    // 对齐到虚拟网格
    const gridX = Math.floor(localX / CELL_HOVER_SIZE) * CELL_HOVER_SIZE;
    const gridY = Math.floor(localY / CELL_HOVER_SIZE) * CELL_HOVER_SIZE;

    if (gridX !== this.cellHighlight.gridX || gridY !== this.cellHighlight.gridY) {
      this.cellHighlight.gridX = gridX;
      this.cellHighlight.gridY = gridY;

      const gfx = this.cellHighlight.graphics;
      gfx.clear();
      gfx.rect(gridX, gridY, CELL_HOVER_SIZE, CELL_HOVER_SIZE)
        .fill({ color: CELL_HOVER_COLOR, alpha: CELL_HOVER_ALPHA });
      gfx.visible = true;
      this.cellHighlight.visible = true;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 右键选区（框选多个格子）
  // ═══════════════════════════════════════════════════════════

  /**
   * 更新右键选区显示
   */
  private updateSelection(): void {
    if (!this.selection.active) return;

    const gfx = this.selection.graphics;
    const s = this.selection.start;
    const e = this.selection.end;

    const x = Math.min(s.x, e.x);
    const y = Math.min(s.y, e.y);
    const w = Math.abs(e.x - s.x);
    const h = Math.abs(e.y - s.y);

    gfx.clear();
    gfx.rect(x, y, w, h).fill({ color: SELECTION_BORDER_COLOR, alpha: SELECTION_FILL_ALPHA });
    gfx.rect(x, y, w, h).stroke({ width: SELECTION_BORDER_WIDTH, color: SELECTION_BORDER_COLOR });
    gfx.visible = true;

    // 查找选区内的领土
    this.selection.selectedTerritories.clear();
    for (const [id, node] of this.territoryNodes) {
      if (!node.data) continue;
      const px = node.data.position.x;
      const py = node.data.position.y;
      if (px >= x && px <= x + w && py >= y && py <= y + h) {
        this.selection.selectedTerritories.add(id);
      }
    }
  }

  /**
   * 右键按下：开始选区
   */
  private onRightDown = (e: import('pixi.js').FederatedPointerEvent): void => {
    const camState = this.cameraManager.getState();
    const localX = e.globalX + camState.x;
    const localY = e.globalY + camState.y;

    this.selection.active = true;
    this.selection.start = { x: localX, y: localY };
    this.selection.end = { x: localX, y: localY };
  };

  /**
   * 右键移动：更新选区范围（在 onPointerMove 中处理）
   */
  private onRightMove(globalX: number, globalY: number): void {
    if (!this.selection.active) return;

    const camState = this.cameraManager.getState();
    this.selection.end = {
      x: globalX + camState.x,
      y: globalY + camState.y,
    };
  }

  /**
   * 右键松开：完成选区
   */
  private onRightUp = (): void => {
    if (this.selection.active && this.selection.selectedTerritories.size > 0) {
      // 将选中的领土 ID 列表通过事件桥接上报
      const ids = Array.from(this.selection.selectedTerritories);
      this.bridgeEvent('territoryClick', ids.join(','));
    }

    this.selection.active = false;
    this.selection.selectedTerritories.clear();
    this.selection.graphics.clear();
    this.selection.graphics.visible = false;
  };

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

    // 右键选区拖拽
    if (this.selection.active) {
      this.onRightMove(e.globalX, e.globalY);
      return;
    }

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
