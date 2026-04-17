/**
 * renderer/scenes/MapScene.ts — 地图场景
 *
 * 显示三国领土地图（节点图），包含：
 * - 领土节点（可点击、可悬停）
 * - 领土间连接线
 * - 地图上的建筑图标
 * - 摄像机平移/缩放（含边缘滚动、滚轮缩放）
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
  MapResourcePoint,
  TerrainType,
} from '../../games/three-kingdoms/MapGenerator';
import {
  TERRAIN_ASSETS,
  TERRAIN_SPRITE_NAMES,
  BUILDING_SPRITE_NAMES,
  TERRAIN_VISUALS,
  getFactionCityColors,
  type FactionCityColors,
} from '../../games/three-kingdoms/AssetConfig';

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

/** 领土节点默认半径 */
const TERRITORY_RADIUS = 40;

/** 连接线宽度 */
const CONNECTION_WIDTH = 2;

/** 连接线颜色（水墨灰） */
const CONNECTION_COLOR = 0x5a4a3a;

/** 已征服领土颜色（暗金） */
const CONQUERED_COLOR = 0xb8860b;

/** 未征服领土颜色（朱砂红） */
const UNCONQUERED_COLOR = 0xc62828;

/** 锁定领土颜色（墨灰） */
const LOCKED_COLOR = 0x4a4a3a;

/** 领土节点悬停放大倍率 */
const HOVER_SCALE = 1.15;

/** 建筑图标尺寸 */
const BUILDING_ICON_SIZE = 24;

/** 脉冲动画周期（毫秒） */
const PULSE_PERIOD = 2000;

/** 脉冲缩放振幅（中心值 1.0，范围 ±0.05） */
const PULSE_AMPLITUDE = 0.05;

/** 边缘滚动区域宽度（像素） */
const EDGE_SCROLL_ZONE = 30;

/** 边缘滚动最大速度（像素/秒） */
const EDGE_SCROLL_MAX_SPEED = 250;

/** 边缘滚动最小速度（像素/秒） */
const EDGE_SCROLL_MIN_SPEED = 20;

/** 边缘滚动平滑插值系数（0~1，越大跟随越快） */
const EDGE_SCROLL_SMOOTH_FACTOR = 0.12;

/** 滚轮缩放步进 */
const WHEEL_ZOOM_STEP = 0.1;

/** 建筑进度弧线半径 */
const PROGRESS_ARC_RADIUS = 18;

/** 建筑进度弧线宽度 */
const PROGRESS_ARC_WIDTH = 3;

/** 建筑进度弧线颜色（暗金） */
const PROGRESS_ARC_COLOR = 0xb8860b;

/** 建筑进度背景弧线颜色（深棕） */
const PROGRESS_ARC_BG_COLOR = 0x3a2a1a;

/** Tooltip 背景色（墨黑） */
const TOOLTIP_BG_COLOR = 0x1a1a2e;

/** Tooltip 背景透明度 */
const TOOLTIP_BG_ALPHA = 0.92;

/** Tooltip 边框颜色（暗金） */
const TOOLTIP_BORDER_COLOR = 0xb8860b;

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

/** 势力颜色映射（古风版：魏蓝/蜀红/吴绿/群黄） */
const FACTION_COLORS: Record<string, number> = {
  wei: 0x4a6fa5,    // 魏蓝 — 沉稳靛蓝
  shu: 0xc62828,    // 蜀红 — 赤焰朱红
  wu: 0x2e7d32,     // 吴绿 — 翠墨深绿
  qun: 0xb8860b,    // 群黄 — 暗金铜色
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

/** 格子悬停高亮颜色（半透明暗金） */
const CELL_HOVER_COLOR = 0xd4a030;

/** 格子悬停高亮透明度 */
const CELL_HOVER_ALPHA = 0.2;

/** 格子悬停高亮尺寸 */
const CELL_HOVER_SIZE = 20;

/** 选区边框颜色（暗金） */
const SELECTION_BORDER_COLOR = 0xb8860b;

/** 选区边框宽度 */
const SELECTION_BORDER_WIDTH = 2;

/** 选区填充透明度 */
const SELECTION_FILL_ALPHA = 0.1;

/** 装饰物数量（树木/石头） */
const DECORATION_COUNT = 30;

/** 装饰物随机种子区域范围 */
const DECORATION_AREA = { minX: -400, maxX: 2400, minY: -400, maxY: 1400 };

/** 树木颜色（古风版） */
const TREE_TRUNK_COLOR = 0x6d4c41;
const TREE_LEAF_COLOR = 0x33691e;

/** 石头颜色（水墨灰） */
const ROCK_COLOR = 0x6b6b5a;

/** 河流颜色（水墨蓝灰） */
const RIVER_COLOR = 0x546e7a;

/** 河流宽度 */
const RIVER_WIDTH = 6;

/** 道路颜色（古纸色） */
const ROAD_COLOR = 0xc4a35a;

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

/** 地形颜色映射（古风水墨色系） */
const TERRAIN_COLORS: Record<TerrainType, number> = {
  plain: 0x5a7a4a,      // 墨绿平原
  mountain: 0x6d4c41,    // 山地棕 — 赭石色
  forest: 0x33691e,      // 深林绿 — 松墨
  water: 0x546e7a,       // 水墨蓝灰 — 淡墨
  road: 0xc4a35a,        // 土黄道路
  city: 0xd4a574,        // 古纸色 — 城市
  village: 0x6b8e5a,     // 墨绿村庄
  fortress: 0xa0522d,    // 赭棕关卡
  desert: 0xd4b36a,      // 沙黄荒漠
  snow: 0xd8dce6,        // 淡墨雪地
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
  desert: '荒漠',
  snow: '雪地',
};

// ─── 增强地形视觉常量 ──────────────────────────────────────

/** 地形纹理密度系数（控制每种地形纹理细节的数量） */
const TERRAIN_DETAIL_DENSITY: Record<string, number> = {
  plain: 1.2,     // 平原：中密度草地
  mountain: 1.0,  // 山地：标准山峰
  forest: 1.4,    // 森林：密集树木
  water: 1.0,     // 水域：标准波纹
  desert: 1.0,    // 荒漠：标准沙丘
  snow: 1.0,      // 雪地：标准雪花
};

/** 旗帜尺寸（像素） */
const FLAG_WIDTH = 10;
const FLAG_HEIGHT = 7;
const FLAG_POLE_HEIGHT = 12;

/** 道路连接虚线样式 */
const ROAD_DASH_LENGTH = 6;
const ROAD_DASH_GAP = 4;
const ROAD_DASH_WIDTH = 2.5;
const ROAD_DASH_COLOR = 0xc4a35a;
const ROAD_DASH_ALPHA = 0.6;

/** 地形过渡渐变步数（越大过渡越柔和） */
const TRANSITION_GRADIENT_STEPS = 4;

/** 装饰灌木概率（0~1，基于伪随机） */
const BUSH_PROBABILITY = 0.15;

/** 装饰石头概率 */
const STONE_PROBABILITY = 0.1;

/** 装饰小路概率 */
const PATH_PROBABILITY = 0.08;

/** 地标标签字号 */
const LANDMARK_FONT_SIZE = 11;

/** 地标标签颜色（暗金） */
const LANDMARK_LABEL_COLOR = 0xd4a030;

/** NPC 点半径 */
const NPC_DOT_RADIUS = 6;

// ─── 资源点渲染常量 ──────────────────────────────────────

/** 资源点类型颜色映射（古风色系） */
const RESOURCE_POINT_COLORS: Record<string, number> = {
  farm: 0x6b8e5a,      // 墨绿 — 农田
  mine: 0x8d6e63,      // 棕色 — 矿场
  lumber: 0x2e7d32,    // 深绿 — 伐木场
  fishery: 0x546e7a,   // 水墨蓝灰 — 渔场
  stable: 0xb8860b,    // 暗金 — 牧场
};

/** 资源点类型图标映射 */
const RESOURCE_POINT_ICONS: Record<string, string> = {
  farm: '🌾',
  mine: '⛏️',
  lumber: '🪵',
  fishery: '🐟',
  stable: '🐎',
};

/** 资源点标签字号 */
const RESOURCE_LABEL_FONT_SIZE = 9;

/** 资源点标记尺寸 */
const RESOURCE_POINT_SIZE = 8;

// ─── 粒子效果常量 ──────────────────────────────────────────

/** 粒子类型 */
type ParticleType = 'petal' | 'smoke' | 'spark';

/** 粒子数据 */
interface MapParticle {
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
  color: number;
}

/** 粒子数量上限 */
const MAX_PARTICLES = 40;

/** 花瓣颜色池（桃花色系：淡粉/桃红） */
const PETAL_COLORS = [0xffb7c5, 0xff8fa3, 0xe8a0b4, 0xd4839a];

/** 烟雾颜色（水墨灰） */
const SMOKE_COLOR = 0x8a8a7a;

/** 火花颜色（暗金/铜色） */
const SPARK_COLOR = 0xb87333;

/** NPC 类型颜色映射（古风色系） */
const NPC_TYPE_COLORS: Record<string, number> = {
  farmer: 0x8d6e63,     // 棕色 — 农民
  soldier: 0xc62828,    // 朱红 — 士兵/武将
  merchant: 0x2e7d32,   // 墨绿 — 商人
  scholar: 0x4a6fa5,    // 魏蓝 — 文臣/学者
  scout: 0x7c4dff,      // 紫色 — 斥候
  general: 0xb71c1c,    // 深赤 — 武将
  craftsman: 0xb8860b,  // 暗金 — 工匠
  villager: 0x5a6a5a,   // 灰绿 — 村民
  sage: 0x7c4dff,       // 紫色 — 名士
};

/** NPC 类型 emoji 映射 */
const NPC_TYPE_EMOJI: Record<string, string> = {
  farmer: '🌾',
  soldier: '⚔️',
  merchant: '💰',
  scholar: '📚',
  scout: '🔍',
  general: '🗡️',
  craftsman: '🔨',
  villager: '🏘️',
  sage: '⭐',
};

/** NPC 形状按职业区分（全部使用方形 + 不同装饰） */
const NPC_SHAPES: Record<string, 'square'> = {
  farmer: 'square',
  soldier: 'square',
  merchant: 'square',
  scholar: 'square',
  scout: 'square',
  general: 'square',
  craftsman: 'square',
  villager: 'square',
  sage: 'square',
};

/** 建筑形状按类型区分（屋顶 + 主体 + 颜色） */
const BUILDING_SHAPE_CONFIG: Record<string, { roof: 'triangle' | 'flat' | 'curved'; body: 'rect'; color: number; label: string }> = {
  yamen:     { roof: 'triangle', body: 'rect', color: 0xd4a030, label: '衙门' },
  residence: { roof: 'triangle', body: 'rect', color: 0xc4a574, label: '民居' },
  shop:      { roof: 'triangle', body: 'rect', color: 0xb8860b, label: '商铺' },
  barracks:  { roof: 'flat',     body: 'rect', color: 0x4a6fa5, label: '兵营' },
  market:    { roof: 'curved',   body: 'rect', color: 0xc62828, label: '市场' },
  smithy:    { roof: 'triangle', body: 'rect', color: 0x6d4c41, label: '铁匠铺' },
  tavern:    { roof: 'triangle', body: 'rect', color: 0x8b4513, label: '酒馆' },
  academy:   { roof: 'curved',   body: 'rect', color: 0x5d4037, label: '书院' },
  wall:      { roof: 'flat',     body: 'rect', color: 0x8a8a7a, label: '城墙' },
};

/**
 * 将颜色按比例变暗（用于建筑屋顶/边框）
 * @param color - 原始颜色（十六进制数字）
 * @param factor - 亮度因子（0=全黑, 1=原色）
 * @returns 变暗后的颜色
 */
function darkenColor(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

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
  resourcePointLayer: Container;
  graphics: Graphics;
}

/** NPC 渲染对象 */
interface NPCDotView {
  id: string;
  container: Container;
  data: MapNPC | null;
  /** 呼吸动画相位偏移（避免所有 NPC 同步） */
  breathPhase: number;
  /** 对话气泡容器（点击时显示，自动消失） */
  dialogBubble: Container | null;
  /** 对话气泡显示计时器（秒），倒计时到 0 自动隐藏 */
  dialogTimer: number;
  /** NPC 信息面板容器（选中时显示） */
  infoPanel: Container | null;
}

/** NPC 对话文本库（按职业分类，随机选取） */
const NPC_DIALOG_POOL: Record<string, string[]> = {
  farmer: [
    '大人，今年收成不错！',
    '田里的庄稼长势喜人啊。',
    '最近雨水充沛，粮食充足。',
    '希望能加强巡逻，防盗匪骚扰。',
    '农忙时节，人手有些不够啊。',
  ],
  soldier: [
    '报告大人，一切正常！',
    '边境有些小动静，需注意。',
    '属下正在巡逻，请放心。',
    '兵器略有磨损，需找工匠修整。',
    '夜间巡逻要小心，大人注意脚下。',
  ],
  merchant: [
    '大人好！新到一批上等丝绸！',
    '走过路过不要错过！',
    '商路畅通，生意兴隆！',
    '听说西凉那边有稀有马匹。',
    '这批货从蜀地运来，品质上乘！',
  ],
  scholar: [
    '学而时习之，不亦说乎。',
    '大人有何赐教？',
    '依我之见，应当以守为主。',
    '这段经文颇有深意。',
    '近日研读兵法，颇有感悟。',
  ],
  scout: [
    '前方侦察未发现异常。',
    '大人，属下刚从边境回来。',
    '发现了一些可疑的脚印。',
    '敌军探子在附近活动。',
    '南边有一条隐蔽的小路。',
  ],
  general: [
    '军务繁忙，请简明扼要。',
    '兵马未动，粮草先行。',
    '士气高昂，随时可以出征！',
    '练兵不可松懈！再来一组！',
    '属下定当日夜坚守岗位！',
  ],
  craftsman: [
    '叮叮当当……需要打造什么吗？',
    '好铁配好匠，这把刀快成了！',
    '攻城云梯和投石车都在赶制中。',
    '放这儿吧，明天就能修好。',
    '这根梁柱得刨平才行。',
  ],
  villager: [
    '大人来了！快进来坐坐。',
    '今天天气真好啊。',
    '村里最近挺好的。',
    '老朽身子骨还硬朗着呢！',
    '东边有个温泉，是好地方。',
  ],
};

/** NPC 信息面板配置 */
const NPC_INFO_PANEL_WIDTH = 160;
const NPC_INFO_PANEL_HEIGHT = 80;
const NPC_INFO_PANEL_CORNER_RADIUS = 6;
const NPC_INFO_PANEL_BG_COLOR = 0x1a1a2e;
const NPC_INFO_PANEL_BG_ALPHA = 0.92;
const NPC_INFO_PANEL_BORDER_COLOR = 0xd4a030;
const NPC_INFO_PANEL_TEXT_COLOR = '#e0e0e0';
const NPC_INFO_PANEL_FONT_SIZE = 11;
const NPC_INFO_PANEL_LINE_HEIGHT = 16;

/** NPC 对话气泡配置 */
const NPC_BUBBLE_MAX_WIDTH = 140;
const NPC_BUBBLE_PADDING = 8;
const NPC_BUBBLE_CORNER_RADIUS = 8;
const NPC_BUBBLE_BG_COLOR = 0x2a2a3a;
const NPC_BUBBLE_BG_ALPHA = 0.95;
const NPC_BUBBLE_BORDER_COLOR = 0xb8860b;
const NPC_BUBBLE_TEXT_COLOR = '#ffffff';
const NPC_BUBBLE_FONT_SIZE = 11;
const NPC_BUBBLE_TAIL_SIZE = 6;
const NPC_BUBBLE_DISPLAY_DURATION = 4.0; // 秒

/** NPC 选中发光效果配置 */
const NPC_GLOW_INNER_RADIUS = NPC_DOT_RADIUS + 4;
const NPC_GLOW_OUTER_RADIUS = NPC_DOT_RADIUS + 12;
const NPC_GLOW_COLOR = 0xd4a030;
const NPC_GLOW_ALPHA = 0.6;
const NPC_GLOW_PULSE_SPEED = 3.0; // 脉冲速度

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
  /** 建筑动画累计时间（秒） */
  private buildingAnimTime: number = 0;
  /** 建筑产出粒子（小圆点从建筑上方浮出） */
  private buildingParticles: Array<{
    x: number;
    y: number;
    vy: number;
    alpha: number;
    color: number;
    life: number;
    buildingId: string;
    graphics: Graphics;
  }> = [];
  /** 建筑产出粒子发射计时器 */
  private buildingParticleTimer: number = 0;

  // ─── 摄像机 ───────────────────────────────────────────────

  /** 摄像机管理器（地图场景独享） */
  private cameraManager: CameraManager;

  // ─── 边缘滚动状态 ─────────────────────────────────────────

  /** 边缘检测区域宽度（像素） */
  private readonly EDGE_SCROLL_ZONE = 30;
  /** 最大滚动速度（像素/秒） */
  private readonly MAX_SCROLL_SPEED = 250;
  /** 最小滚动速度（像素/秒） */
  private readonly MIN_SCROLL_SPEED = 20;

  /** 当前边缘滚动速度（像素/帧，由 pointermove 更新） */
  private edgeScrollVelocity: { x: number; y: number } = { x: 0, y: 0 };
  /** 平滑插值后的实际滚动速度 */
  private smoothEdgeScrollVelocity: { x: number; y: number } = { x: 0, y: 0 };
  /** 鼠标是否在容器内 */
  private pointerInContainer: boolean = false;

  // ─── 触摸状态 ─────────────────────────────────────────────

  /** 触摸点缓存（用于双指缩放） */
  private touchPoints: Map<number, { x: number; y: number }> = new Map();
  /** 上一次双指间距（用于计算缩放比例） */
  private lastPinchDistance: number = 0;
  /** 上一次双指中心（用于平移） */
  private lastPinchCenter: { x: number; y: number } = { x: 0, y: 0 };
  /** 触摸拖拽起始点 */
  private touchDragStart: { x: number; y: number } = { x: 0, y: 0 };
  /** 触摸拖拽速度 */
  private touchDragVelocity: { x: number; y: number } = { x: 0, y: 0 };

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
  /** NPC 呼吸动画累计时间（秒） */
  private npcBreathTime: number = 0;
  /** NPC 行走动画累计时间（秒） */
  private npcWalkTime: number = 0;
  /** 当前选中的 NPC ID（高亮显示） */
  private selectedNPCId: string | null = null;
  /** NPC 选中高亮图形 */
  private npcSelectionRing: Graphics | null = null;
  /** NPC 渲染数据缓存（用于位置更新） */
  private npcRenderDataCache: Map<string, { x: number; y: number; direction?: string; state?: string }> = new Map();
  /** 地标渲染映射 */
  private landmarkViews: Map<string, LandmarkView> = new Map();
  /** 是否使用瓦片地图模式 */
  private useTileMapMode: boolean = false;

  // ─── 精灵纹理缓存 ────────────────────────────────────────

  /** 已加载的精灵纹理缓存（spriteName → Texture） */
  private spriteTextureCache: Map<string, import('pixi.js').Texture> = new Map();
  /** 精灵图是否已加载 */
  private kenneySpritesLoaded: boolean = false;

  // ─── 粒子效果（烟雾/花瓣） ─────────────────────────────────

  /** 粒子容器层（最顶层，半透明装饰） */
  private particleLayer: Container;
  /** 粒子图形对象（复用单个 Graphics 批量绘制） */
  private particleGraphics: Graphics;
  /** 粒子数据列表 */
  private particles: MapParticle[] = [];
  /** 粒子动画累计时间 */
  private particleTime: number = 0;

  // ─── 动画水面叠加层 ──────────────────────────────────────

  /** 水面动画叠加图形（sine 曲线波纹，每帧更新） */
  private waterAnimGraphics: Graphics | null = null;
  /** 水面动画累计时间（秒） */
  private waterAnimTime: number = 0;
  /** 水面瓦片位置缓存（避免每帧遍历全地图） */
  private waterTiles: Array<{ x: number; y: number; tileSize: number; variant: number }> = [];

  // ─── 装饰性面板边框 ─────────────────────────────────────────

  /** 古风装饰边框图形（回纹/云纹） */
  private decorBorderGraphics: Graphics;

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

    // 初始化粒子效果层（烟雾/花瓣，半透明装饰）
    this.particleLayer = new Container({ label: 'particles' });
    this.particleGraphics = new Graphics();
    this.particleLayer.addChild(this.particleGraphics);
    this.container.addChild(this.particleLayer);

    // 初始化古风装饰边框
    this.decorBorderGraphics = new Graphics();
    this.container.addChild(this.decorBorderGraphics);

    // 初始化水面动画叠加层
    this.waterAnimGraphics = new Graphics();
    this.waterAnimGraphics.visible = false;
    this.container.addChild(this.waterAnimGraphics);

    // 初始化粒子数据
    this.particles = [];

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
    // 设置容器交互（用于地图点击和边缘滚动）
    this.container.eventMode = 'static';
    this.container.cursor = 'default'; // 使用默认鼠标光标（非方块十字线）

    // 绑定指针事件（仅用于 Tooltip 跟踪和点击，不再拖拽）
    this.container.on('pointermove', this.onPointerMove);
    this.container.on('pointerup', this.onPointerUp);
    this.container.on('pointerupoutside', this.onPointerUp);

    // 鼠标进入/离开容器（用于边缘滚动启停）
    this.container.on('pointerenter', this.onPointerEnter);
    this.container.on('pointerleave', this.onPointerLeave);

    // 绑定滚轮缩放事件
    this.container.on('wheel', this.onWheel);

    // 触摸事件（单指拖拽 + 双指缩放）
    this.container.on('touchstart', this.onTouchStart);
    this.container.on('touchmove', this.onTouchMove);
    this.container.on('touchend', this.onTouchEnd);
    this.container.on('touchcancel', this.onTouchEnd);

    // 右键选区事件
    this.container.on('rightdown', this.onRightDown);
    this.container.on('rightup', this.onRightUp);
    this.container.on('rightupoutside', this.onRightUp);
  }

  protected async onEnter(_params?: Record<string, unknown>): Promise<void> {
    // 加载 Kenney Tower Defense 精灵图（仅首次）
    if (!this.kenneySpritesLoaded) {
      try {
        const frameNames = await this.assetManager.loadKenneySpritesheet();
        if (frameNames.length > 0) {
          this.kenneySpritesLoaded = true;
          console.info(`[MapScene] Kenney spritesheet loaded: ${frameNames.length} frames`);
        }
      } catch (err) {
        console.warn('[MapScene] Failed to load Kenney spritesheet, using fallback rendering:', err);
      }
    }

    // 设置摄像机边界（瓦片地图模式由 setTileMapData 管理）
    if (!this.useTileMapMode) {
      this.cameraManager.setBounds({
        minX: -500,
        maxX: 2500,
        minY: -500,
        maxY: 1500,
      });
    }

    // 重置动画计时
    this.pulseTime = 0;

    // 初始化粒子效果（花瓣飘落 + 烟雾）
    this.initParticles();

    // 绘制古风装饰边框
    this.drawDecorativeBorder();
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

    // ── 2.5. 更新建筑浮动和产出动画 ─────────────────────────
    this.updateBuildingAnimation(deltaTime);

    // ── 3. 更新边缘滚动 ──────────────────────────────────────
    this.updateEdgeScroll(deltaTime);

    // ── 4. 更新 Tooltip 位置 ─────────────────────────────────
    this.updateTooltip();

    // ── 5. 更新新占领领土脉冲扩散动画 ───────────────────────
    this.updateCapturePulse(deltaTime);

    // ── 6. 更新右键选区 ─────────────────────────────────────
    this.updateSelection();

    // ── 8. 更新 NPC 呼吸动画 ────────────────────────────────
    this.updateNPCBreath(deltaTime);

    // ── 9. 更新 NPC 行走动画（位置插值） ──────────────────
    this.updateNPCWalk(deltaTime);

    // ── 10. 更新 NPC 选中高亮 ──────────────────────────────
    this.updateNPCSelection();

    // ── 10.5. 更新 NPC 对话气泡倒计时 ──────────────────────
    this.updateNPCDialogTimers(deltaTime);

    // ── 11. 更新粒子效果（花瓣/烟雾） ──────────────────────
    this.updateParticles(deltaTime);

    // ── 11.5. 更新水面动画叠加层 ──────────────────────────
    this.updateWaterAnimation(deltaTime);

    // ── 12. 绘制古风装饰边框 ──────────────────────────────
    this.drawDecorativeBorder();
  }

  protected onSetData(data: unknown): void {
    const state = data as GameRenderState;

    // 瓦片地图数据注入：首次检测到 tileMapData 时自动切换到瓦片地图模式
    if (state.tileMapData && !this.useTileMapMode) {
      this.setTileMapData(state.tileMapData as Parameters<typeof this.setTileMapData>[0]);
    }

    // 更新 NPC 渲染数据缓存（用于位置插值）
    if (state.npcs && state.npcs.length > 0) {
      for (const npc of state.npcs) {
        this.npcRenderDataCache.set(npc.id, {
          x: npc.x,
          y: npc.y,
          direction: npc.direction,
          state: npc.state,
        });
      }
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
    // 清理建筑产出粒子
    for (const p of this.buildingParticles) {
      p.graphics.destroy();
    }
    this.buildingParticles = [];
    this.buildingParticleTimer = 0;
    this.decorations = [];
    this.terrainPaths = [];
    this.recentlyCaptured.clear();
    this.capturePulseGraphics.clear();
    this.destroyTooltip();
    this.edgeScrollVelocity = { x: 0, y: 0 };
    this.smoothEdgeScrollVelocity = { x: 0, y: 0 };
    this.pointerInContainer = false;
    this.decorationLayer.destroy({ children: true });
    this.connectionLayer.destroy({ children: true });
    this.borderLayer.destroy({ children: true });
    this.territoryLayer.destroy({ children: true });
    this.buildingLayer.destroy({ children: true });
    this.tooltipLayer.destroy({ children: true });
    this.cellHighlight.graphics.destroy();
    this.selection.graphics.destroy();
    this.particles = [];
    this.particleGraphics.destroy();
    this.particleLayer.destroy({ children: true });
    this.decorBorderGraphics.destroy();
    if (this.waterAnimGraphics) {
      this.waterAnimGraphics.destroy();
      this.waterAnimGraphics = null;
    }
    this.waterTiles = [];
    this.waterAnimTime = 0;
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

  /**
   * 更新建筑浮动和产出动画
   *
   * - idle 状态：轻微上下浮动（sin 波，幅度 2px，周期 2s）
   * - producing 状态：小圆点从建筑上方浮出（向上飘动 + 渐隐）
   */
  private updateBuildingAnimation(deltaTime: number): void {
    this.buildingAnimTime += deltaTime;

    // ── 1. 建筑浮动动画 ────────────────────────────────────
    for (const icon of this.buildingIcons.values()) {
      const state = icon.data?.state;
      // 所有建筑都有轻微浮动，producing 状态幅度稍大
      const amplitude = state === 'producing' ? 3 : 2;
      const floatY = amplitude * Math.sin(this.buildingAnimTime * Math.PI); // 周期 2s
      icon.container.y = Math.floor((icon.data?.position.y ?? 0) + floatY);
    }

    // ── 2. 产出粒子（仅 producing 状态的建筑） ──────────────
    this.buildingParticleTimer += deltaTime;

    // 每 0.5 秒发射一个粒子
    if (this.buildingParticleTimer >= 0.5) {
      this.buildingParticleTimer -= 0.5;

      for (const icon of this.buildingIcons.values()) {
        if (icon.data?.state !== 'producing') continue;

        // 限制粒子总数
        if (this.buildingParticles.length >= 20) break;

        const gfx = new Graphics();
        gfx.circle(0, 0, 3).fill({ color: 0xb8860b, alpha: 0.8 });
        const baseX = icon.container.x;
        const baseY = icon.container.y;
        gfx.position.set(baseX, baseY - 20);
        this.container.addChild(gfx);

        this.buildingParticles.push({
          x: baseX,
          y: baseY - 20,
          vy: -30, // 向上飘动速度（像素/秒）
          alpha: 0.8,
          color: 0xb8860b,
          life: 1.5, // 1.5 秒后消失
          buildingId: icon.id,
          graphics: gfx,
        });
      }
    }

    // ── 3. 更新已有粒子 ─────────────────────────────────────
    for (let i = this.buildingParticles.length - 1; i >= 0; i--) {
      const p = this.buildingParticles[i];
      p.life -= deltaTime;
      p.y += p.vy * deltaTime;
      p.alpha -= deltaTime * 0.6; // 渐隐

      if (p.life <= 0 || p.alpha <= 0) {
        // 移除粒子
        this.container.removeChild(p.graphics);
        p.graphics.destroy();
        this.buildingParticles.splice(i, 1);
      } else {
        p.graphics.position.set(Math.floor(p.x), Math.floor(p.y));
        p.graphics.alpha = Math.max(0, p.alpha);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 边缘滚动
  // ═══════════════════════════════════════════════════════════

  /**
   * 更新边缘滚动（带平滑插值）
   *
   * 鼠标在容器边缘 30px 区域时，地图平滑滚动：
   * - 鼠标在左边缘 → 地图向右滚（显示左侧内容）
   * - 鼠标在右边缘 → 地图向左滚（显示右侧内容）
   * - 鼠标在上边缘 → 地图向下滚（显示上方内容）
   * - 鼠标在下边缘 → 地图向上滚（显示下方内容）
   *
   * 使用平滑插值避免突兀的速度跳变。
   */
  private updateEdgeScroll(deltaTime: number): void {
    // 鼠标不在容器内时，目标速度归零
    if (!this.pointerInContainer) {
      this.edgeScrollVelocity.x = 0;
      this.edgeScrollVelocity.y = 0;
    }

    // 平滑插值：实际速度逐渐趋近目标速度
    const factor = EDGE_SCROLL_SMOOTH_FACTOR;
    this.smoothEdgeScrollVelocity.x += (this.edgeScrollVelocity.x - this.smoothEdgeScrollVelocity.x) * factor;
    this.smoothEdgeScrollVelocity.y += (this.edgeScrollVelocity.y - this.smoothEdgeScrollVelocity.y) * factor;

    const vx = this.smoothEdgeScrollVelocity.x;
    const vy = this.smoothEdgeScrollVelocity.y;

    // 速度极小时跳过（避免浮点漂移）
    if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) return;

    // deltaTime 为秒，计算本帧位移
    const camState = this.cameraManager.getState();
    this.cameraManager.panTo(
      camState.x - vx * deltaTime,
      camState.y - vy * deltaTime,
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
        .fill({ color: 0xc62828 });
      // 等级标记
      fallbackGfx
        .circle(BUILDING_SPRITE_SIZE / 3, -BUILDING_SPRITE_SIZE / 3, 6)
        .fill({ color: 0xd4a030 });
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
          .fill({ color: 0xd4a030 });
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
    const colors = [0x8a7a60, 0x6b8e5a, 0x4a6fa5, 0x7c4dff, 0xd4a030];
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

  // ═══════════════════════════════════════════════════════════
  // 精灵纹理加载
  // ═══════════════════════════════════════════════════════════

  /**
   * 尝试获取精灵纹理
   *
   * 优先从 AssetManager 的 textureCache 中查找（spritesheet 方式），
   * 回退到按帧名直接查找。找不到时返回 null，由调用方决定 fallback。
   *
   * @param spriteName - spritesheet 帧名（如 'terrain_grass'）
   * @returns Texture 或 null
   */
  private getSpriteTexture(spriteName: string): import('pixi.js').Texture | null {
    // 1. 查本地缓存
    const cached = this.spriteTextureCache.get(spriteName);
    if (cached) return cached;

    // 2. 查 AssetManager 缓存（spritesheet 加载的帧）
    const tex = this.assetManager.getTexture(spriteName);
    if (tex) {
      this.spriteTextureCache.set(spriteName, tex);
      return tex;
    }

    return null;
  }

  /**
   * 获取地形精灵纹理
   *
   * @param terrain - 地形类型
   * @returns Texture 或 null
   */
  private getTerrainTexture(terrain: TerrainType): import('pixi.js').Texture | null {
    const spriteName = TERRAIN_SPRITE_NAMES[terrain];
    return spriteName ? this.getSpriteTexture(spriteName) : null;
  }

  /**
   * 获取建筑精灵纹理
   *
   * @param buildingType - 建筑类型（地形名称）
   * @returns Texture 或 null
   */
  private getBuildingTexture(buildingType: string): import('pixi.js').Texture | null {
    const spriteName = BUILDING_SPRITE_NAMES[buildingType];
    return spriteName ? this.getSpriteTexture(spriteName) : null;
  }
  // 瓦片地图渲染模式
  // ═══════════════════════════════════════════════════════════

  /**
   * 注入瓦片地图数据，切换到瓦片地图渲染模式
   *
   * 当 GameMap 数据可用时，优先使用瓦片地图渲染；
   * 否则 fallback 到原有节点图模式。
   *
   * 摄像机边界：限制在地图范围内，不允许超出。
   *
   * @param mapData - MapGenerator 生成的完整地图数据
   */
  setTileMapData(mapData: GameMap): void {
    this.tileMapData = mapData;
    this.useTileMapMode = true;

    // 更新摄像机边界以适配瓦片地图（严格边界，不超出地图范围）
    const mapWidth = mapData.width * mapData.tileSize;
    const mapHeight = mapData.height * mapData.tileSize;
    this.cameraManager.setBounds({
      minX: 0,
      maxX: mapWidth,
      minY: 0,
      maxY: mapHeight,
    });

    // 将摄像机初始位置设为地图中心
    this.cameraManager.panTo(
      Math.floor(mapWidth / 2),
      Math.floor(mapHeight / 2),
      false,
    );

    // 渲染瓦片地图
    this.renderTileMap();
  }

  /**
   * 渲染完整瓦片地图
   *
   * 按层级绘制：瓦片地形 → 过渡边缘 → 领土边界 → 建筑 → NPC → 地标标签
   *
   * 渲染策略（基于瓦片地图最佳实践）：
   * 1. 先绘制所有基础地形色块
   * 2. 再绘制高优先级地形向低优先级地形的过渡边缘（消除硬拼接）
   * 3. 绘制地形纹理细节（草地、树木、波纹等）
   * 4. 叠加海拔阴影和微妙的网格线
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
    const resourcePointLayer = new Container({ label: 'tile-resources' });
    const labelLayer = new Container({ label: 'tile-labels' });

    // 按层级添加到容器（水墨背景 → 地形 → 边界 → 建筑 → 资源点 → NPC → 地标 → 标签）
    // ── 水墨宣纸背景纹理 ──
    const inkWashBg = new Graphics();
    this.drawInkWashBackground(inkWashBg, map);
    this.container.addChildAt(inkWashBg, 0);

    this.container.addChildAt(tileLayer, 1);
    this.container.addChildAt(borderLayer, 2);
    this.container.addChildAt(buildingLayer, 3);
    this.container.addChildAt(resourcePointLayer, 4);
    this.container.addChildAt(npcLayer, 5);
    this.container.addChildAt(landmarkLayer, 6);
    this.container.addChildAt(labelLayer, 7);

    const graphics = new Graphics();

    // ── Pass 1: 绘制基础地形色块（整数坐标 + 1px 扩展防止缝隙） ──
    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const tile = map.tiles[row]?.[col];
        if (!tile) continue;

        // 使用 Math.floor 确保整数像素坐标，防止亚像素缝隙
        const x = Math.floor(col * tileSize);
        const y = Math.floor(row * tileSize);
        const visual = TERRAIN_VISUALS[tile.terrain];

        if (visual) {
          // 基于 variant 产生颜色微变，使相邻同类型瓦片有细微色差
          // 使用位运算安全地调整 RGB 各通道，避免溢出
          const shift = (tile.variant % 3 - 1) * 6; // ±6 per channel
          const r = Math.max(0, Math.min(255, ((visual.baseColor >> 16) & 0xff) + shift));
          const g = Math.max(0, Math.min(255, ((visual.baseColor >> 8) & 0xff) + shift));
          const b = Math.max(0, Math.min(255, (visual.baseColor & 0xff) + shift));
          const baseColor = (r << 16) | (g << 8) | b;
          // 每个瓦片扩展 1px（向右和向下），消除相邻瓦片间的亚像素缝隙
          // 使用整数坐标 + 1px overlap 是瓦片地图无缝拼接的标准方案
          graphics.rect(x, y, tileSize + 1, tileSize + 1).fill({ color: baseColor });
        } else {
          graphics.rect(x, y, tileSize + 1, tileSize + 1).fill({ color: 0x888888 });
        }
      }
    }

    // ── Pass 2: 绘制地形过渡边缘 ──────────────────────────
    // 高优先级地形向低优先级地形绘制渐变边缘，实现自然过渡
    this.renderTerrainTransitions(graphics, map, tileSize);

    // ── Pass 3: 绘制地形纹理细节 ──────────────────────────
    this.renderTerrainPatterns(graphics, map, tileSize);

    // ── Pass 4: 海拔阴影 + 极淡网格线（整数坐标） ─────────
    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const tile = map.tiles[row]?.[col];
        if (!tile) continue;

        const x = Math.floor(col * tileSize);
        const y = Math.floor(row * tileSize);

        // 海拔阴影效果：高地顶部微亮，底部微暗
        if (tile.elevation >= 3) {
          // 山峰：顶部高光 + 整体暗化
          graphics.rect(x, y, tileSize + 1, 3).fill({ color: 0xffffff, alpha: 0.08 });
          graphics.rect(x, y + 3, tileSize + 1, tileSize - 3).fill({ color: 0x000000, alpha: 0.12 });
        } else if (tile.elevation >= 2) {
          // 丘陵：仅底部微暗
          graphics.rect(x, Math.floor(y + tileSize * 0.7), tileSize + 1, Math.ceil(tileSize * 0.3) + 1)
            .fill({ color: 0x000000, alpha: 0.06 });
        }

        // 极淡网格线（仅在相邻同地形时不画，不同地形时画细线）
        const terrain = tile.terrain;
        const rightTile = map.tiles[row]?.[col + 1];
        const bottomTile = map.tiles[row + 1]?.[col];

        // 右边线：仅在与右边不同地形时绘制
        if (rightTile && rightTile.terrain !== terrain) {
          const lx = Math.floor(x + tileSize);
          graphics.moveTo(lx, y).lineTo(lx, y + tileSize)
            .stroke({ width: 0.5, color: 0x1a1a2e, alpha: 0.15 });
        }
        // 下边线：仅在与下方不同地形时绘制
        if (bottomTile && bottomTile.terrain !== terrain) {
          const ly = Math.floor(y + tileSize);
          graphics.moveTo(x, ly).lineTo(x + tileSize, ly)
            .stroke({ width: 0.5, color: 0x1a1a2e, alpha: 0.15 });
        }
      }
    }

    // 将地形图形添加到瓦片层
    tileLayer.addChild(graphics);

    // ── 2. 绘制领土边界（虚线） ────────────────────────────
    this.renderTileTerritoryBorders(borderLayer, map);

    // ── 3. 绘制建筑图标 ────────────────────────────────────
    this.renderTileBuildings(buildingLayer, map);

    // ── 4. 绘制 NPC 点 ─────────────────────────────────────
    this.renderTileNPCs(npcLayer, map);

    // ── 5. 绘制地标文字标签 ────────────────────────────────
    this.renderTileLandmarks(landmarkLayer, labelLayer, map);

    // ── 6. 绘制资源点图标 ────────────────────────────────
    this.renderTileResourcePoints(resourcePointLayer, labelLayer, map);

    // ── 7. 缓存水面瓦片位置（用于动画叠加层） ────────────
    this.waterTiles = [];
    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const tile = map.tiles[row]?.[col];
        if (tile?.terrain === 'water') {
          this.waterTiles.push({
            x: Math.floor(col * tileSize),
            y: Math.floor(row * tileSize),
            tileSize,
            variant: tile.variant,
          });
        }
      }
    }

    this.tileMapView = {
      tileLayer,
      labelLayer,
      buildingLayer,
      npcLayer,
      borderLayer,
      landmarkLayer,
      resourcePointLayer,
      graphics,
    };
  }

  /**
   * 绘制地形过渡边缘（整数坐标）
   *
   * 增强版：使用多步渐变实现柔和过渡，而非单色条带。
   * 核心算法：对于每个瓦片，检查四个方向的邻居。
   * 如果当前地形优先级高于邻居，则在朝向邻居的边缘绘制多步渐变过渡。
   */
  private renderTerrainTransitions(graphics: Graphics, map: GameMap, tileSize: number): void {
    // 四个方向偏移：上、下、左、右
    const dirs = [
      { dx: 0, dy: -1, edge: 'top' as const },
      { dx: 0, dy: 1, edge: 'bottom' as const },
      { dx: -1, dy: 0, edge: 'left' as const },
      { dx: 1, dy: 0, edge: 'right' as const },
    ];

    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const tile = map.tiles[row]?.[col];
        if (!tile) continue;

        const visual = TERRAIN_VISUALS[tile.terrain];
        if (!visual) continue;

        // 整数坐标
        const x = Math.floor(col * tileSize);
        const y = Math.floor(row * tileSize);
        const tw = visual.transitionWidth;
        const tc = visual.transitionColor;
        const ta = visual.transitionAlpha;

        for (const dir of dirs) {
          const nr = row + dir.dy;
          const nc = col + dir.dx;

          // 边界外视为最低优先级（水域级别）
          if (nr < 0 || nr >= map.height || nc < 0 || nc >= map.width) continue;

          const neighbor = map.tiles[nr]?.[nc];
          if (!neighbor) continue;

          // 同类型地形不需要过渡
          if (neighbor.terrain === tile.terrain) continue;

          const neighborVisual = TERRAIN_VISUALS[neighbor.terrain];
          if (!neighborVisual) continue;

          // 仅高优先级地形向低优先级地形绘制过渡
          if (visual.renderPriority <= neighborVisual.renderPriority) continue;

          // ── 增强版：多步渐变过渡（由内到外，透明度递减） ──
          const steps = TRANSITION_GRADIENT_STEPS;
          const stepWidth = Math.max(1, Math.floor(tw / steps));

          for (let s = 0; s < steps; s++) {
            const progress = s / steps; // 0=最靠近自身, 1=最靠近邻居
            const alpha = ta * (1 - progress * 0.7); // 透明度从内到外递减
            const sw = stepWidth + (s === steps - 1 ? 1 : 0); // 最后一步扩展1px防缝隙

            switch (dir.edge) {
              case 'top': {
                const sy = y + s * stepWidth;
                graphics.rect(x, sy, tileSize + 1, sw)
                  .fill({ color: tc, alpha });
                break;
              }
              case 'bottom': {
                const sy = y + tileSize - tw + s * stepWidth;
                graphics.rect(x, sy, tileSize + 1, sw)
                  .fill({ color: tc, alpha });
                break;
              }
              case 'left': {
                const sx = x + s * stepWidth;
                graphics.rect(sx, y, sw, tileSize + 1)
                  .fill({ color: tc, alpha });
                break;
              }
              case 'right': {
                const sx = x + tileSize - tw + s * stepWidth;
                graphics.rect(sx, y, sw, tileSize + 1)
                  .fill({ color: tc, alpha });
                break;
              }
            }
          }
        }
      }
    }
  }

  /**
   * 绘制地形纹理图案（整数坐标）
   *
   * 增强版纹理：每种地形有独特的视觉纹理，
   * 使用 variant 和坐标产生自然变化。
   */
  private renderTerrainPatterns(graphics: Graphics, map: GameMap, tileSize: number): void {
    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const tile = map.tiles[row]?.[col];
        if (!tile) continue;

        const x = Math.floor(col * tileSize);
        const y = Math.floor(row * tileSize);
        const visual = TERRAIN_VISUALS[tile.terrain];
        if (!visual) continue;

        // 简易伪随机种子（基于瓦片坐标，确保一致）
        const seed = tile.x * 7 + tile.y * 13 + tile.variant * 31;
        const prng = (i: number) => {
          const s = ((seed * (i + 1) * 2654435761) >>> 0) % 1000;
          return s / 1000;
        };

        switch (visual.pattern) {
          // ── 草地纹理（平原）：散布小草叶 + 偶尔花朵 ──
          case 'grass': {
            for (let i = 0; i < 8; i++) {
              const gx = x + 4 + prng(i) * (tileSize - 8);
              const gy = y + 4 + prng(i + 10) * (tileSize - 8);
              const gh = 4 + prng(i + 20) * 6;
              graphics.moveTo(gx, gy + gh)
                .lineTo(gx - 1, gy)
                .stroke({ width: 1, color: visual.lightColor, alpha: 0.4 + prng(i + 30) * 0.2 });
              graphics.moveTo(gx + 2, gy + gh)
                .lineTo(gx + 3, gy + 1)
                .stroke({ width: 1, color: visual.darkColor, alpha: 0.3 });
            }
            // 偶尔添加小花点缀
            if (prng(100) < 0.3) {
              const fx = x + 8 + prng(101) * (tileSize - 16);
              const fy = y + 8 + prng(102) * (tileSize - 16);
              const flowerColors = [0xffeb3b, 0xff7043, 0xce93d8, 0x81d4fa];
              const fc = flowerColors[Math.floor(prng(103) * flowerColors.length)];
              graphics.circle(fx, fy, 2).fill({ color: fc, alpha: 0.6 });
            }
            break;
          }

          // ── 岩石纹理（山地）：三角形山峰 + 雪顶 + 山体阴影 + 山脚碎石 ──
          case 'rocks': {
            // 绘制 2-3 个重叠三角形山峰
            const peakCount = 2 + Math.floor(prng(0) * 2);
            for (let i = 0; i < peakCount; i++) {
              const rx = Math.floor(x + 6 + prng(i) * (tileSize - 12));
              const ry = Math.floor(y + tileSize * 0.55 + prng(i + 10) * (tileSize * 0.25));
              const rh = Math.floor(14 + prng(i + 20) * 18);
              const rw = Math.floor(12 + prng(i + 30) * 14);

              // 山脚碎石（先画，被山体覆盖）
              for (let r = 0; r < 3; r++) {
                const rbx = Math.floor(rx - rw / 2 + prng(i * 10 + r + 80) * rw);
                const rby = Math.floor(ry + prng(i * 10 + r + 90) * 4);
                const rbr = Math.floor(1 + prng(i * 10 + r + 95) * 2);
                graphics.circle(rbx, rby, rbr)
                  .fill({ color: 0x5a4a3a, alpha: 0.35 });
              }

              // 山体暗面（左侧阴影，更大面积）
              graphics.moveTo(rx, ry - rh)
                .lineTo(rx - rw / 2, ry)
                .lineTo(rx - rw * 0.15, ry)
                .lineTo(rx, ry - rh * 0.3)
                .closePath()
                .fill({ color: visual.darkColor, alpha: 0.5 });

              // 山体中间色调
              graphics.moveTo(rx, ry - rh)
                .lineTo(rx - rw * 0.15, ry - rh * 0.3)
                .lineTo(rx + rw * 0.1, ry - rh * 0.15)
                .closePath()
                .fill({ color: visual.baseColor, alpha: 0.35 });

              // 山体亮面（右侧）
              graphics.moveTo(rx, ry - rh)
                .lineTo(rx + rw / 2, ry)
                .lineTo(rx + rw * 0.1, ry - rh * 0.15)
                .closePath()
                .fill({ color: visual.lightColor, alpha: 0.35 });

              // 雪顶（更明显的白色三角形区域）
              const snowH = Math.floor(rh * 0.25);
              graphics.moveTo(rx, ry - rh)
                .lineTo(rx - rw * 0.22, ry - rh + snowH)
                .lineTo(rx + rw * 0.22, ry - rh + snowH)
                .closePath()
                .fill({ color: 0xf0f0f0, alpha: 0.5 });
              // 雪顶高光线
              graphics.moveTo(rx - rw * 0.18, ry - rh + snowH - 1)
                .lineTo(rx + rw * 0.18, ry - rh + snowH - 1)
                .stroke({ width: 0.8, color: 0xffffff, alpha: 0.4 });
            }
            // 岩缝纹理线（增加数量）
            for (let i = 0; i < 3; i++) {
              const lx = Math.floor(x + 4 + prng(i + 40) * (tileSize - 8));
              const ly = Math.floor(y + tileSize * 0.3 + prng(i + 50) * (tileSize * 0.4));
              graphics.moveTo(lx, ly)
                .lineTo(lx + 3 + prng(i + 60) * 6, ly + 4 + prng(i + 70) * 5)
                .stroke({ width: 0.8, color: visual.darkColor, alpha: 0.3 });
            }
            break;
          }

          // ── 树木纹理（森林）：多层树冠 + 树干 + 树根 ──
          case 'trees': {
            const treeCount = 3 + Math.floor(prng(0) * 3);
            for (let i = 0; i < treeCount; i++) {
              const tx = Math.floor(x + 6 + prng(i) * (tileSize - 12));
              const ty = Math.floor(y + 8 + prng(i + 10) * (tileSize - 14));
              const tr = Math.floor(3 + prng(i + 20) * 5);

              // 树干（棕色矩形，底部较宽）
              const trunkW = Math.max(2, Math.floor(tr * 0.35));
              const trunkH = Math.floor(tr * 1.2);
              graphics.rect(tx - Math.floor(trunkW / 2), ty + Math.floor(tr * 0.3), trunkW, trunkH)
                .fill({ color: 0x5d3a1a, alpha: 0.5 });
              // 树干纹理线
              graphics.moveTo(tx, ty + Math.floor(tr * 0.4))
                .lineTo(tx, ty + Math.floor(tr * 0.4) + trunkH)
                .stroke({ width: 0.5, color: 0x3d2a0a, alpha: 0.3 });

              // 树根（2-3条小线从树干底部延伸）
              for (let r = 0; r < 2 + Math.floor(prng(i + 70) * 2); r++) {
                const rootAngle = (r === 0 ? -1 : 1) * (0.3 + prng(i * 5 + r + 75) * 0.5);
                const rootLen = Math.floor(2 + prng(i * 5 + r + 85) * 3);
                const rootY = ty + Math.floor(tr * 0.3) + trunkH;
                graphics.moveTo(tx, rootY)
                  .lineTo(Math.floor(tx + Math.sin(rootAngle) * rootLen), Math.floor(rootY + Math.abs(Math.cos(rootAngle)) * rootLen))
                  .stroke({ width: 0.8, color: 0x4a2a0a, alpha: 0.35 });
              }

              // 树冠阴影（底层）
              graphics.circle(tx + 1, ty + 1, tr + 1).fill({ color: 0x0a2a05, alpha: 0.25 });

              // 多层树冠：底层（深色，最大）
              graphics.circle(tx, ty, tr).fill({ color: visual.darkColor, alpha: 0.5 + prng(i + 30) * 0.15 });
              // 中层（主色，偏移）
              graphics.circle(tx - 1, ty - Math.floor(tr * 0.2), Math.floor(tr * 0.75))
                .fill({ color: visual.lightColor, alpha: 0.45 });
              // 顶层高光（小圆，偏上）
              graphics.circle(tx - Math.floor(tr * 0.15), ty - Math.floor(tr * 0.35), Math.floor(tr * 0.4))
                .fill({ color: visual.lightColor, alpha: 0.2 });
            }
            break;
          }

          // ── 波纹纹理（水域）：曲线波纹 + 高光 + 水草 + 河流动画效果 ──
          case 'ripples': {
            // 连续河流路径效果：sine 曲线边缘
            const edgeAmplitude = 2 + prng(0) * 2;
            // 上边缘 sine 曲线
            graphics.moveTo(x, y + 2)
              .bezierCurveTo(
                x + tileSize * 0.33, y + 2 - edgeAmplitude,
                x + tileSize * 0.66, y + 2 + edgeAmplitude,
                x + tileSize, y + 2,
              )
              .stroke({ width: 1, color: visual.lightColor, alpha: 0.25 });
            // 下边缘 sine 曲线
            graphics.moveTo(x, y + tileSize - 2)
              .bezierCurveTo(
                x + tileSize * 0.33, y + tileSize - 2 + edgeAmplitude,
                x + tileSize * 0.66, y + tileSize - 2 - edgeAmplitude,
                x + tileSize, y + tileSize - 2,
              )
              .stroke({ width: 1, color: visual.lightColor, alpha: 0.25 });

            // 波纹曲线（更丰富的水波）
            for (let wy = 6; wy < tileSize; wy += 8) {
              const offset = prng(wy) * 4 - 2;
              const amp = 2 + prng(wy + 200) * 3;
              graphics.moveTo(x + 3, y + wy + offset)
                .bezierCurveTo(
                  x + tileSize * 0.25, y + wy - amp + offset,
                  x + tileSize * 0.75, y + wy + amp + offset,
                  x + tileSize - 3, y + wy + offset,
                )
                .stroke({ width: 1.2, color: visual.lightColor, alpha: 0.3 + prng(wy + 300) * 0.1 });
            }
            // 水面高光点（增加数量）
            for (let i = 0; i < 6; i++) {
              const sx = Math.floor(x + 6 + prng(i + 50) * (tileSize - 12));
              const sy = Math.floor(y + 6 + prng(i + 60) * (tileSize - 12));
              graphics.circle(sx, sy, 1.5).fill({ color: 0xffffff, alpha: 0.2 });
            }
            // 偶尔水草
            if (prng(80) < 0.25) {
              const gx = Math.floor(x + 4 + prng(81) * (tileSize - 8));
              const gy = Math.floor(y + tileSize - 4);
              for (let j = 0; j < 3; j++) {
                const angle = -0.4 + prng(82 + j) * 0.8;
                const glen = Math.floor(6 + prng(85 + j) * 4);
                graphics.moveTo(gx + j * 3, gy)
                  .lineTo(gx + j * 3 + Math.sin(angle) * glen, gy - Math.cos(angle) * glen)
                  .stroke({ width: 1, color: 0x2e7d32, alpha: 0.3 });
              }
            }
            break;
          }

          // ── 棋盘纹理（村庄）：田垄网格 ──
          case 'checker': {
            const half = tileSize / 2;
            graphics.rect(x, y, half, half).fill({ color: visual.darkColor, alpha: 0.15 });
            graphics.rect(x + half, y + half, half, half).fill({ color: visual.darkColor, alpha: 0.15 });
            // 添加田垄线
            for (let i = 0; i < tileSize; i += 8) {
              graphics.moveTo(x + i, y).lineTo(x + i, y + tileSize)
                .stroke({ width: 0.4, color: visual.lightColor, alpha: 0.12 });
            }
            break;
          }

          // ── 对角线纹理 ──
          case 'diagonal': {
            for (let i = 0; i < tileSize; i += 8) {
              graphics.rect(x + i, y, 1.5, tileSize).fill({ color: visual.lightColor, alpha: 0.12 });
            }
            break;
          }

          // ── 圆点纹理 ──
          case 'dots': {
            for (let i = 0; i < 5; i++) {
              const dx = 5 + prng(i) * (tileSize - 10);
              const dy = 5 + prng(i + 10) * (tileSize - 10);
              graphics.circle(x + dx, y + dy, 2.5).fill({ color: visual.lightColor, alpha: 0.4 });
            }
            break;
          }

          // ── 波浪纹理（旧版水域兼容） ──
          case 'waves': {
            for (let wy = 8; wy < tileSize; wy += 14) {
              graphics.moveTo(x + 2, y + wy)
                .bezierCurveTo(
                  x + tileSize * 0.25, y + wy - 4,
                  x + tileSize * 0.75, y + wy + 4,
                  x + tileSize - 2, y + wy,
                )
                .stroke({ width: 1, color: visual.lightColor, alpha: 0.3 });
            }
            break;
          }

          // ── 交叉线纹理（城池/关卡）：城墙 + 城门 + 城楼 ──
          case 'crosshatch': {
            for (let i = 4; i < tileSize; i += 10) {
              graphics.moveTo(x + i, y).lineTo(x + i, y + tileSize)
                .stroke({ width: 0.5, color: visual.lightColor, alpha: 0.15 });
              graphics.moveTo(x, y + i).lineTo(x + tileSize, y + i)
                .stroke({ width: 0.5, color: visual.lightColor, alpha: 0.15 });
            }

            // 城池/关卡增强渲染
            if (tile.terrain === 'city' || tile.terrain === 'fortress') {
              const wallInset = Math.floor(tileSize * 0.12);
              const wallX = x + wallInset;
              const wallY = y + wallInset;
              const wallW = tileSize - wallInset * 2;
              const wallH = tileSize - wallInset * 2;

              // 城墙（矩形轮廓）
              graphics.rect(wallX, wallY, wallW, wallH)
                .stroke({ width: 1.5, color: visual.lightColor, alpha: 0.4 });

              // 城垛（城墙顶部小方块）
              const battlementSize = Math.max(2, Math.floor(tileSize * 0.08));
              const battlementGap = Math.max(3, Math.floor(tileSize * 0.12));
              for (let bx = wallX; bx < wallX + wallW; bx += battlementGap) {
                graphics.rect(bx, wallY - battlementSize, battlementSize, battlementSize)
                  .fill({ color: visual.lightColor, alpha: 0.35 });
              }
              // 底部城垛
              for (let bx = wallX; bx < wallX + wallW; bx += battlementGap) {
                graphics.rect(bx, wallY + wallH, battlementSize, battlementSize)
                  .fill({ color: visual.lightColor, alpha: 0.25 });
              }

              // 城门（拱形 — 底部中央）
              const gateW = Math.max(6, Math.floor(wallW * 0.3));
              const gateH = Math.max(5, Math.floor(wallH * 0.35));
              const gateX = Math.floor(wallX + (wallW - gateW) / 2);
              const gateY = Math.floor(wallY + wallH - gateH);
              // 拱形：矩形 + 顶部半圆
              graphics.rect(gateX, gateY + Math.floor(gateH * 0.4), gateW, Math.floor(gateH * 0.6))
                .fill({ color: 0x2a1a0a, alpha: 0.5 });
              graphics.arc(Math.floor(gateX + gateW / 2), gateY + Math.floor(gateH * 0.4), Math.floor(gateW / 2), Math.PI, 0)
                .fill({ color: 0x2a1a0a, alpha: 0.5 });

              // 城楼（三角形屋顶 — 顶部中央）
              const roofW = Math.max(8, Math.floor(wallW * 0.5));
              const roofH = Math.max(4, Math.floor(wallH * 0.25));
              const roofX = Math.floor(wallX + (wallW - roofW) / 2);
              const roofY = wallY - battlementSize;
              graphics.moveTo(Math.floor(roofX + roofW / 2), roofY - roofH)
                .lineTo(roofX - 2, roofY)
                .lineTo(roofX + roofW + 2, roofY)
                .closePath()
                .fill({ color: 0xb87333, alpha: 0.5 });
              // 屋顶边线
              graphics.moveTo(Math.floor(roofX + roofW / 2), roofY - roofH)
                .lineTo(roofX - 2, roofY)
                .stroke({ width: 0.8, color: 0x8a5a23, alpha: 0.4 });
              graphics.moveTo(Math.floor(roofX + roofW / 2), roofY - roofH)
                .lineTo(roofX + roofW + 2, roofY)
                .stroke({ width: 0.8, color: 0x8a5a23, alpha: 0.4 });

              // 角落小方块（保留原有装饰）
              const cs = 3;
              graphics.rect(x + 2, y + 2, cs, cs).fill({ color: visual.lightColor, alpha: 0.2 });
              graphics.rect(x + tileSize - cs - 2, y + 2, cs, cs).fill({ color: visual.lightColor, alpha: 0.2 });
              graphics.rect(x + 2, y + tileSize - cs - 2, cs, cs).fill({ color: visual.lightColor, alpha: 0.2 });
              graphics.rect(x + tileSize - cs - 2, y + tileSize - cs - 2, cs, cs).fill({ color: visual.lightColor, alpha: 0.2 });
            }
            break;
          }

          // ── 沙丘纹理（荒漠）：圆点沙丘 + 风纹 ──
          case 'dunes': {
            // 沙丘圆点
            for (let i = 0; i < 6; i++) {
              const ddx = 4 + prng(i) * (tileSize - 8);
              const ddy = 4 + prng(i + 10) * (tileSize - 8);
              const dr = 2 + prng(i + 20) * 3;
              graphics.circle(x + ddx, y + ddy, dr).fill({ color: visual.darkColor, alpha: 0.2 });
              // 沙丘高光
              graphics.circle(x + ddx - 1, y + ddy - 1, dr * 0.6)
                .fill({ color: visual.lightColor, alpha: 0.15 });
            }
            // 风纹（水平波浪线）
            for (let wy = 5; wy < tileSize; wy += 14) {
              const woff = prng(wy + 100) * 3 - 1.5;
              graphics.moveTo(x + 2, y + wy + woff)
                .bezierCurveTo(
                  x + tileSize * 0.3, y + wy - 2 + woff,
                  x + tileSize * 0.7, y + wy + 2 + woff,
                  x + tileSize - 2, y + wy + woff,
                )
                .stroke({ width: 0.8, color: visual.darkColor, alpha: 0.18 });
            }
            break;
          }

          // ── 雪花纹理（雪地）：小星形 + 冰晶 ──
          case 'snowflakes': {
            // 雪花星形
            for (let i = 0; i < 4; i++) {
              const sx = 6 + prng(i) * (tileSize - 12);
              const sy = 6 + prng(i + 10) * (tileSize - 12);
              const sr = 2 + prng(i + 20) * 2.5;
              const arms = 6;
              for (let a = 0; a < arms; a++) {
                const angle = (a / arms) * Math.PI * 2;
                const ex = sx + Math.cos(angle) * sr;
                const ey = sy + Math.sin(angle) * sr;
                graphics.moveTo(sx, sy).lineTo(ex, ey)
                  .stroke({ width: 0.6, color: 0xffffff, alpha: 0.35 });
              }
              graphics.circle(sx, sy, 0.8).fill({ color: 0xffffff, alpha: 0.3 });
            }
            // 冰晶小点
            for (let i = 0; i < 5; i++) {
              const ix = 3 + prng(i + 40) * (tileSize - 6);
              const iy = 3 + prng(i + 50) * (tileSize - 6);
              graphics.circle(x + ix, y + iy, 1).fill({ color: 0xffffff, alpha: 0.2 });
            }
            // 淡蓝色冰面高光
            if (prng(70) < 0.3) {
              const hx = x + 4 + prng(71) * (tileSize - 8);
              const hy = y + 4 + prng(72) * (tileSize - 8);
              graphics.circle(hx, hy, 3 + prng(73) * 4)
                .fill({ color: 0xb3e5fc, alpha: 0.12 });
            }
            break;
          }

          // ── 纯色（道路等）：路辙痕迹 + 路边小石子 ──
          case 'solid': {
            // 道路特殊处理
            if (tile.terrain === 'road') {
              const cy = Math.floor(y + tileSize / 2);
              // 路辙痕迹（两条平行线）
              const rutOffset = Math.floor(tileSize * 0.18);
              graphics.moveTo(x + 2, cy - rutOffset).lineTo(x + tileSize - 2, cy - rutOffset)
                .stroke({ width: 1, color: visual.darkColor, alpha: 0.3 });
              graphics.moveTo(x + 2, cy + rutOffset).lineTo(x + tileSize - 2, cy + rutOffset)
                .stroke({ width: 1, color: visual.darkColor, alpha: 0.3 });
              // 虚线中心线
              for (let dx = 0; dx < tileSize; dx += 8) {
                if ((dx / 8) % 2 === 0) {
                  graphics.rect(x + dx, cy - 0.5, 5, 1)
                    .fill({ color: 0xffffff, alpha: 0.2 });
                }
              }
              // 路边小石子
              for (let s = 0; s < 4; s++) {
                const sx = Math.floor(x + 3 + prng(s + 110) * (tileSize - 6));
                const sy = Math.floor(s % 2 === 0 ? y + 2 : y + tileSize - 3);
                const sr = Math.max(0.5, 0.8 + prng(s + 120) * 1.2);
                graphics.circle(sx, sy, sr)
                  .fill({ color: visual.darkColor, alpha: 0.3 + prng(s + 130) * 0.15 });
              }
              // 路面边缘线
              graphics.moveTo(x, y + 2).lineTo(x + tileSize, y + 2)
                .stroke({ width: 0.5, color: visual.darkColor, alpha: 0.2 });
              graphics.moveTo(x, y + tileSize - 2).lineTo(x + tileSize, y + tileSize - 2)
                .stroke({ width: 0.5, color: visual.darkColor, alpha: 0.2 });
            }
            break;
          }
        }
      }
    }
  }

  /**
   * 绘制领土边界虚线（整数坐标）
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
          const bx = Math.floor((col + 1) * tileSize);
          const y1 = Math.floor(row * tileSize);
          const y2 = Math.floor((row + 1) * tileSize);
          this.drawDashedLine(borderGfx, bx, y1, bx, y2, FACTION_COLORS[tile.territoryId.split('_')[0]] ?? 0xe94560);
        }

        // 检查下邻瓦片
        const bottomTile = map.tiles[row + 1]?.[col];
        if (bottomTile && bottomTile.territoryId && bottomTile.territoryId !== tile.territoryId) {
          const x1 = Math.floor(col * tileSize);
          const x2 = Math.floor((col + 1) * tileSize);
          const by = Math.floor((row + 1) * tileSize);
          this.drawDashedLine(borderGfx, x1, by, x2, by, FACTION_COLORS[tile.territoryId.split('_')[0]] ?? 0xe94560);
        }
      }
    }

    borderLayer.addChild(borderGfx);
  }

  /**
   * 绘制建筑图标（整数坐标）
   *
   * 优先使用精灵纹理（从 Kenney spritesheet 获取），
   * 找不到时 fallback 到 PixiJS Graphics 绘制简单形状。
   */
  private renderTileBuildings(buildingLayer: Container, map: GameMap): void {
    const tileSize = map.tileSize;

    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const tile = map.tiles[row]?.[col];
        if (!tile?.buildingId) continue;

        // 整数坐标：瓦片中心
        const cx = Math.floor(col * tileSize + tileSize / 2);
        const cy = Math.floor(row * tileSize + tileSize / 2);
        const container = new Container({ label: `tile-bldg-${tile.buildingId}` });
        container.position.set(cx, cy);
        container.eventMode = 'static';
        container.cursor = 'pointer';

        // 尝试获取建筑精灵纹理
        const buildingTexture = this.getBuildingTexture(tile.terrain);

        if (buildingTexture) {
          // 使用精灵纹理渲染建筑
          const sprite = new Sprite(buildingTexture);
          sprite.anchor.set(0.5, 0.5);
          const spriteSize = tileSize * 0.6;
          sprite.width = spriteSize;
          sprite.height = spriteSize;
          container.addChild(sprite);

          // 叠加半透明背景色表示所属势力
          if (tile.territoryId) {
            const factionKey = tile.territoryId.split('_')[0];
            const factionColor = FACTION_COLORS[factionKey];
            if (factionColor) {
              const overlay = new Graphics();
              overlay.circle(0, 0, spriteSize * 0.55).fill({ color: factionColor, alpha: 0.2 });
              container.addChildAt(overlay, 0);
            }
          }
        } else {
          // Fallback：使用 Graphics 绘制程序化建筑形状
          const gfx = new Graphics();
          const halfSize = tileSize * 0.3;

          // 检查是否有建筑类型配置（yamen/barracks 等）
          const buildingConfig = BUILDING_SHAPE_CONFIG[tile.buildingId];

          if (buildingConfig) {
            // ── 使用建筑类型配置绘制 ──
            const bodyW = halfSize * 1.6;
            const bodyH = halfSize * 1.2;
            const bodyY = -bodyH * 0.1; // 主体稍偏下，给屋顶留空间

            // 1) 绘制主体（矩形）
            gfx.roundRect(-bodyW / 2, bodyY, bodyW, bodyH, 1)
              .fill({ color: buildingConfig.color, alpha: 0.85 });
            gfx.roundRect(-bodyW / 2, bodyY, bodyW, bodyH, 1)
              .stroke({ color: darkenColor(buildingConfig.color, 0.5), width: 1.5 });

            // 2) 绘制门（小矩形）
            const doorW = bodyW * 0.25;
            const doorH = bodyH * 0.45;
            gfx.roundRect(-doorW / 2, bodyY + bodyH - doorH, doorW, doorH, 1)
              .fill({ color: darkenColor(buildingConfig.color, 0.35) });

            // 3) 绘制屋顶
            const roofY = bodyY;
            switch (buildingConfig.roof) {
              case 'triangle': {
                // 三角形屋顶
                const roofOverhang = bodyW * 0.15;
                gfx.moveTo(-bodyW / 2 - roofOverhang, roofY)
                  .lineTo(0, roofY - halfSize * 0.8)
                  .lineTo(bodyW / 2 + roofOverhang, roofY)
                  .closePath()
                  .fill({ color: darkenColor(buildingConfig.color, 0.65) });
                gfx.moveTo(-bodyW / 2 - roofOverhang, roofY)
                  .lineTo(0, roofY - halfSize * 0.8)
                  .lineTo(bodyW / 2 + roofOverhang, roofY)
                  .closePath()
                  .stroke({ color: darkenColor(buildingConfig.color, 0.4), width: 1 });
                break;
              }
              case 'flat': {
                // 平顶（城墙/兵营）
                const roofOverhang = bodyW * 0.1;
                gfx.rect(-bodyW / 2 - roofOverhang, roofY - halfSize * 0.3, bodyW + roofOverhang * 2, halfSize * 0.3)
                  .fill({ color: darkenColor(buildingConfig.color, 0.6) });
                // 城垛效果
                const crenelW = (bodyW + roofOverhang * 2) / 5;
                for (let i = 0; i < 5; i += 2) {
                  const cx2 = -bodyW / 2 - roofOverhang + i * crenelW;
                  gfx.rect(cx2, roofY - halfSize * 0.3 - 3, crenelW, 3)
                    .fill({ color: darkenColor(buildingConfig.color, 0.5) });
                }
                break;
              }
              case 'curved': {
                // 弧形屋顶（市场/书院）
                const roofOverhang = bodyW * 0.2;
                gfx.moveTo(-bodyW / 2 - roofOverhang, roofY)
                  .quadraticCurveTo(-bodyW / 4, roofY - halfSize * 1.0, 0, roofY - halfSize * 0.7)
                  .quadraticCurveTo(bodyW / 4, roofY - halfSize * 1.0, bodyW / 2 + roofOverhang, roofY)
                  .closePath()
                  .fill({ color: darkenColor(buildingConfig.color, 0.65) });
                gfx.moveTo(-bodyW / 2 - roofOverhang, roofY)
                  .quadraticCurveTo(-bodyW / 4, roofY - halfSize * 1.0, 0, roofY - halfSize * 0.7)
                  .quadraticCurveTo(bodyW / 4, roofY - halfSize * 1.0, bodyW / 2 + roofOverhang, roofY)
                  .closePath()
                  .stroke({ color: darkenColor(buildingConfig.color, 0.4), width: 1 });
                break;
              }
            }

            // 4) 建筑名称标签
            const labelText = new Text({
              text: buildingConfig.label,
              style: new TextStyle({
                fontSize: 8,
                fill: '#ffffff',
                fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
                stroke: { color: '#000000', width: 2 },
              }),
            });
            labelText.anchor.set(0.5, 0);
            labelText.position.set(0, bodyY + bodyH + 2);
            container.addChild(labelText);

          } else {
            // ── 原有地形建筑 fallback ──
            switch (tile.terrain) {
              case 'city':
                gfx.rect(-halfSize, -halfSize, halfSize * 2, halfSize * 2)
                  .fill({ color: 0xd4a574 });
                gfx.rect(-halfSize, -halfSize, halfSize * 2, halfSize * 2)
                  .stroke({ color: 0x8b6914, width: 2 });
                gfx.rect(-halfSize, -halfSize - 4, 8, 4).fill({ color: 0x8b6914 });
                gfx.rect(halfSize - 8, -halfSize - 4, 8, 4).fill({ color: 0x8b6914 });
                break;

              case 'village':
                gfx.rect(-halfSize * 0.7, -halfSize * 0.2, halfSize * 1.4, halfSize * 0.9)
                  .fill({ color: 0x8fbc8f });
                gfx.moveTo(-halfSize * 0.8, -halfSize * 0.2)
                  .lineTo(0, -halfSize * 0.9)
                  .lineTo(halfSize * 0.8, -halfSize * 0.2)
                  .closePath()
                  .fill({ color: 0x8b4513 });
                break;

              case 'fortress':
                gfx.rect(-halfSize, -halfSize * 0.6, halfSize * 2, halfSize * 1.2)
                  .fill({ color: 0xa0522d });
                gfx.rect(-halfSize, -halfSize * 0.6, halfSize * 2, halfSize * 1.2)
                  .stroke({ color: 0x5c3317, width: 2 });
                gfx.rect(-halfSize - 4, -halfSize * 0.8, 8, halfSize * 1.4)
                  .fill({ color: 0x8b6914 });
                gfx.rect(halfSize - 4, -halfSize * 0.8, 8, halfSize * 1.4)
                  .fill({ color: 0x8b6914 });
                break;

              default:
                gfx.circle(0, 0, halfSize * 0.7).fill({ color: 0x95a5a6 });
                gfx.circle(0, 0, halfSize * 0.7).stroke({ color: 0x7f8c8d, width: 1 });
                break;
            }
          }

          container.addChild(gfx);
        }

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
    const shapeRadius = NPC_DOT_RADIUS + 2; // 略大于原来的圆点

    let npcIndex = 0;
    for (const npc of map.npcs) {
      // 整数坐标：瓦片中心
      const cx = Math.floor(npc.tileX * tileSize + tileSize / 2);
      const cy = Math.floor(npc.tileY * tileSize + tileSize / 2);

      const container = new Container({ label: `tile-npc-${npc.id}` });
      container.position.set(cx, cy);
      container.eventMode = 'static';
      container.cursor = 'pointer';

      const gfx = new Graphics();
      const color = NPC_TYPE_COLORS[npc.type] ?? 0x9e9e9e;

      // 所有 NPC 使用方形基础 + 职业装饰
      const half = Math.floor(shapeRadius * 0.85);
      // 方形主体
      gfx.roundRect(-half, -half, half * 2, half * 2, 2)
        .fill({ color });
      gfx.roundRect(-half, -half, half * 2, half * 2, 2)
        .stroke({ color: 0xffffff, width: 1 });

      // 根据职业绘制装饰图标
      this.drawNPCDecoration(gfx, npc.type, half);

      container.addChild(gfx);

      // 职业图标（Emoji）—— 放在形状上方
      const emoji = NPC_TYPE_EMOJI[npc.type] ?? '👤';
      const emojiText = new Text({
        text: emoji,
        style: new TextStyle({ fontSize: 10 }),
      });
      emojiText.anchor.set(0.5, 0.5);
      emojiText.position.set(0, -shapeRadius - 8);
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
      nameText.position.set(0, shapeRadius + 2);
      container.addChild(nameText);

      // 点击事件 — 选中 NPC 并高亮，触发 npcClick 交互事件
      container.on('pointerdown', () => {
        this.selectNPC(npc.id);
        this.bridgeEvent('npcClick', npc.id);
      });

      npcLayer.addChild(container);
      this.npcDots.set(npc.id, {
        id: npc.id,
        container,
        data: npc,
        breathPhase: npcIndex * 0.7, // 每个NPC相位错开
        dialogBubble: null,
        dialogTimer: 0,
        infoPanel: null,
      });
      npcIndex++;
    }
  }

  /**
   * 绘制 NPC 职业装饰（在方形主体内部）
   *
   * 每种职业有独特的装饰图案：
   * - scholar（文臣）：书卷 — 两条平行横线
   * - soldier/general（武将）：剑 — 十字 + 竖线
   * - merchant（商人）：钱币 — 中心圆环
   * - farmer（农民）：麦穗 — V 形 + 竖线
   * - craftsman（工匠）：锤子 — T 形
   * - sage（名士）：星形 — 五角星
   * - scout/villager：默认 — 中心小圆点
   */
  private drawNPCDecoration(gfx: Graphics, npcType: string, half: number): void {
    const decoColor = 0xffffff;
    const decoAlpha = 0.9;

    switch (npcType) {
      case 'scholar': {
        // 书卷：两条平行横线
        const lineW = Math.floor(half * 0.7);
        gfx.moveTo(-lineW, -2)
          .lineTo(lineW, -2)
          .stroke({ color: decoColor, width: 1.5, alpha: decoAlpha });
        gfx.moveTo(-lineW, 2)
          .lineTo(lineW, 2)
          .stroke({ color: decoColor, width: 1.5, alpha: decoAlpha });
        break;
      }
      case 'soldier':
      case 'general': {
        // 剑：竖线 + 横线（十字形）
        const bladeLen = Math.floor(half * 0.7);
        // 剑身（竖线）
        gfx.moveTo(0, -bladeLen)
          .lineTo(0, bladeLen)
          .stroke({ color: decoColor, width: 1.5, alpha: decoAlpha });
        // 剑柄（横线）
        gfx.moveTo(-Math.floor(bladeLen * 0.5), 0)
          .lineTo(Math.floor(bladeLen * 0.5), 0)
          .stroke({ color: decoColor, width: 1.5, alpha: decoAlpha });
        break;
      }
      case 'merchant': {
        // 钱币：中心圆环
        const coinR = Math.floor(half * 0.35);
        gfx.circle(0, 0, coinR)
          .stroke({ color: decoColor, width: 1.5, alpha: decoAlpha });
        // 钱币中心小点
        gfx.circle(0, 0, Math.max(1, Math.floor(coinR * 0.3)))
          .fill({ color: decoColor, alpha: decoAlpha });
        break;
      }
      case 'farmer': {
        // 麦穗：竖线 + 两侧 V 形
        const stemLen = Math.floor(half * 0.6);
        // 茎
        gfx.moveTo(0, stemLen)
          .lineTo(0, -stemLen)
          .stroke({ color: decoColor, width: 1.5, alpha: decoAlpha });
        // 左穗
        gfx.moveTo(-Math.floor(half * 0.3), -Math.floor(stemLen * 0.3))
          .lineTo(0, -stemLen)
          .stroke({ color: decoColor, width: 1, alpha: decoAlpha });
        // 右穗
        gfx.moveTo(Math.floor(half * 0.3), -Math.floor(stemLen * 0.3))
          .lineTo(0, -stemLen)
          .stroke({ color: decoColor, width: 1, alpha: decoAlpha });
        break;
      }
      case 'craftsman': {
        // 锤子：T 形
        const hammerH = Math.floor(half * 0.6);
        // 锤柄（竖线）
        gfx.moveTo(0, hammerH)
          .lineTo(0, -Math.floor(hammerH * 0.2))
          .stroke({ color: decoColor, width: 1.5, alpha: decoAlpha });
        // 锤头（横线）
        gfx.moveTo(-Math.floor(half * 0.5), -Math.floor(hammerH * 0.2))
          .lineTo(Math.floor(half * 0.5), -Math.floor(hammerH * 0.2))
          .stroke({ color: decoColor, width: 2, alpha: decoAlpha });
        break;
      }
      case 'sage': {
        // 星形：五角星
        const starR = Math.floor(half * 0.5);
        const innerR = Math.floor(starR * 0.4);
        const points = 5;
        gfx.moveTo(0, -starR);
        for (let i = 0; i < points * 2; i++) {
          const angle = (Math.PI * i) / points - Math.PI / 2;
          const r = i % 2 === 0 ? starR : innerR;
          const px = Math.floor(Math.cos(angle) * r);
          const py = Math.floor(Math.sin(angle) * r);
          gfx.lineTo(px, py);
        }
        gfx.closePath()
          .fill({ color: decoColor, alpha: decoAlpha });
        break;
      }
      default: {
        // 默认装饰：中心小圆点
        gfx.circle(0, 0, Math.max(1, Math.floor(half * 0.25)))
          .fill({ color: decoColor, alpha: decoAlpha });
        break;
      }
    }
  }

  /**
   * 更新 NPC 呼吸动画（alpha 微变）
   */
  private updateNPCBreath(deltaTime: number): void {
    if (this.npcDots.size === 0) return;

    this.npcBreathTime += deltaTime;

    for (const [, view] of this.npcDots) {
      // 正弦呼吸：alpha 在 0.7 ~ 1.0 之间波动
      const breath = 0.85 + 0.15 * Math.sin(this.npcBreathTime * 2.0 + view.breathPhase);
      view.container.alpha = breath;
    }
  }

  /**
   * 更新 NPC 行走动画（位置插值 + 方向指示器）
   *
   * 每帧从 npcRenderDataCache 读取 NPC 最新位置，
   * 平滑插值移动 NPC 容器到目标位置。
   * 行走中的 NPC 会有微小的上下弹跳动画和方向指示器。
   */
  private updateNPCWalk(deltaTime: number): void {
    if (this.npcDots.size === 0) return;

    this.npcWalkTime += deltaTime;

    for (const [npcId, view] of this.npcDots) {
      const cached = this.npcRenderDataCache.get(npcId);
      if (!cached) continue;

      const tileSize = this.tileMapData?.tileSize ?? 64;
      const targetPixelX = cached.x * tileSize + tileSize / 2;
      const targetPixelY = cached.y * tileSize + tileSize / 2;

      const currentX = view.container.x;
      const currentY = view.container.y;

      // 平滑插值移动（lerp factor 0.1）
      const lerpFactor = 0.1;
      const newX = currentX + (targetPixelX - currentX) * lerpFactor;
      const newY = currentY + (targetPixelY - currentY) * lerpFactor;

      view.container.position.set(newX, newY);

      // 行走弹跳动画：移动中的 NPC 有微小的 Y 偏移
      const isMoving = Math.abs(targetPixelX - currentX) > 1 || Math.abs(targetPixelY - currentY) > 1;
      if (isMoving) {
        const bounce = Math.sin(this.npcWalkTime * 8 + view.breathPhase) * 2;
        view.container.y = newY + bounce;

        // 方向指示器：移动中的 NPC 显示小箭头指示移动方向
        const direction = cached.direction;
        if (direction && direction !== 'idle') {
          // 确保方向指示器存在
          let dirIndicator = view.container.getChildByLabel('dir-indicator') as Graphics | null;
          if (!dirIndicator) {
            dirIndicator = new Graphics();
            dirIndicator.label = 'dir-indicator';
            view.container.addChild(dirIndicator);
          }

          dirIndicator.clear();
          const arrowSize = 4;
          const arrowDist = NPC_DOT_RADIUS + 6;
          dirIndicator.fill({ color: 0xffffff, alpha: 0.7 });

          switch (direction) {
            case 'up':
              dirIndicator.moveTo(0, -arrowDist - arrowSize)
                .lineTo(-arrowSize, -arrowDist + arrowSize)
                .lineTo(arrowSize, -arrowDist + arrowSize)
                .closePath();
              break;
            case 'down':
              dirIndicator.moveTo(0, arrowDist + arrowSize)
                .lineTo(-arrowSize, arrowDist - arrowSize)
                .lineTo(arrowSize, arrowDist - arrowSize)
                .closePath();
              break;
            case 'left':
              dirIndicator.moveTo(-arrowDist - arrowSize, 0)
                .lineTo(-arrowDist + arrowSize, -arrowSize)
                .lineTo(-arrowDist + arrowSize, arrowSize)
                .closePath();
              break;
            case 'right':
              dirIndicator.moveTo(arrowDist + arrowSize, 0)
                .lineTo(arrowDist - arrowSize, -arrowSize)
                .lineTo(arrowDist - arrowSize, arrowSize)
                .closePath();
              break;
          }
        }
      } else {
        // 不在移动时移除方向指示器
        const dirIndicator = view.container.getChildByLabel('dir-indicator') as Graphics | null;
        if (dirIndicator) {
          dirIndicator.clear();
        }
      }
    }
  }

  /**
   * 选中 NPC（高亮显示 + 信息面板 + 对话气泡）
   *
   * @param npcId - 要选中的 NPC ID
   */
  private selectNPC(npcId: string): void {
    // 取消之前的选中
    this.deselectNPC();

    this.selectedNPCId = npcId;

    // 创建选中高亮环（发光效果）
    const view = this.npcDots.get(npcId);
    if (!view) return;

    const ring = new Graphics();
    const ringRadius = NPC_DOT_RADIUS + 8;
    ring.circle(0, 0, ringRadius);
    ring.stroke({ color: 0xffeb3b, width: 2, alpha: 0.9 });
    ring.circle(0, 0, ringRadius + 3);
    ring.stroke({ color: 0xffeb3b, width: 1, alpha: 0.4 });
    view.container.addChildAt(ring, 0);
    this.npcSelectionRing = ring;

    // 显示 NPC 信息面板
    this.showNPCInfoPanel(view);

    // 显示对话气泡
    this.showNPCDialogBubble(view);
  }

  /**
   * 显示 NPC 信息面板（名称、职业、状态）
   */
  private showNPCInfoPanel(view: NPCDotView): void {
    // 清理旧面板
    if (view.infoPanel) {
      view.container.removeChild(view.infoPanel);
      view.infoPanel.destroy({ children: true });
      view.infoPanel = null;
    }

    const npc = view.data;
    if (!npc) return;

    const panel = new Container({ label: `npc-info-${npc.id}` });
    panel.eventMode = 'none';

    const gfx = new Graphics();

    // 面板位置：NPC 上方偏右
    const panelX = NPC_DOT_RADIUS + 12;
    const panelY = -(NPC_DOT_RADIUS + NPC_INFO_PANEL_HEIGHT + 10);

    // 背景
    gfx.roundRect(panelX, panelY, NPC_INFO_PANEL_WIDTH, NPC_INFO_PANEL_HEIGHT, NPC_INFO_PANEL_CORNER_RADIUS)
      .fill({ color: NPC_INFO_PANEL_BG_COLOR, alpha: NPC_INFO_PANEL_BG_ALPHA });
    gfx.roundRect(panelX, panelY, NPC_INFO_PANEL_WIDTH, NPC_INFO_PANEL_HEIGHT, NPC_INFO_PANEL_CORNER_RADIUS)
      .stroke({ color: NPC_INFO_PANEL_BORDER_COLOR, width: 1.5 });
    panel.addChild(gfx);

    // 文本信息
    const textStyle = new TextStyle({
      fontSize: NPC_INFO_PANEL_FONT_SIZE,
      fill: NPC_INFO_PANEL_TEXT_COLOR,
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      lineHeight: NPC_INFO_PANEL_LINE_HEIGHT,
    });

    const nameStyle = new TextStyle({
      fontSize: NPC_INFO_PANEL_FONT_SIZE + 1,
      fill: '#ffd700',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontWeight: 'bold',
      lineHeight: NPC_INFO_PANEL_LINE_HEIGHT,
    });

    // NPC 名称
    const nameText = new Text({ text: `👤 ${npc.name}`, style: nameStyle });
    nameText.position.set(panelX + 8, panelY + 6);
    panel.addChild(nameText);

    // NPC 职业
    const professionLabels: Record<string, string> = {
      farmer: '🌾 农民',
      soldier: '⚔️ 士兵',
      merchant: '💰 商人',
      scholar: '📚 学者',
      scout: '🔍 斥候',
      general: '🗡️ 武将',
      craftsman: '🔨 工匠',
      villager: '🏘️ 村民',
    };
    const professionText = new Text({
      text: `职业: ${professionLabels[npc.type] ?? npc.type}`,
      style: textStyle,
    });
    professionText.position.set(panelX + 8, panelY + 24);
    panel.addChild(professionText);

    // NPC 状态
    const activityLabels: Record<string, string> = {
      farming: '🟢 耕种中',
      patrolling: '🔵 巡逻中',
      trading: '🟡 交易中',
      studying: '🟣 研习中',
      scouting: '🔴 侦察中',
      idle: '⏸️ 空闲',
      moving: '🚶 移动中',
      resting: '💤 休息中',
    };
    const stateStr = activityLabels[npc.activity] ?? npc.activity;
    const stateText = new Text({ text: `状态: ${stateStr}`, style: textStyle });
    stateText.position.set(panelX + 8, panelY + 42);
    panel.addChild(stateText);

    // 位置信息
    const posText = new Text({
      text: `📍 (${npc.tileX}, ${npc.tileY})`,
      style: new TextStyle({
        fontSize: NPC_INFO_PANEL_FONT_SIZE - 1,
        fill: '#888888',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      }),
    });
    posText.position.set(panelX + 8, panelY + 60);
    panel.addChild(posText);

    view.container.addChild(panel);
    view.infoPanel = panel;
  }

  /**
   * 显示 NPC 对话气泡（随机选取对话文本）
   */
  private showNPCDialogBubble(view: NPCDotView): void {
    // 清理旧气泡
    this.removeNPCDialogBubble(view);

    const npc = view.data;
    if (!npc) return;

    // 从对话池中随机选取
    const pool = NPC_DIALOG_POOL[npc.type] ?? NPC_DIALOG_POOL['villager'] ?? ['……'];
    const dialogText = pool[Math.floor(Math.random() * pool.length)];

    const bubble = new Container({ label: `npc-bubble-${npc.id}` });
    bubble.eventMode = 'none';

    // 创建文本对象（先创建文本，再根据文本尺寸绘制背景）
    const textStyle = new TextStyle({
      fontSize: NPC_BUBBLE_FONT_SIZE,
      fill: NPC_BUBBLE_TEXT_COLOR,
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      wordWrap: true,
      wordWrapWidth: NPC_BUBBLE_MAX_WIDTH - NPC_BUBBLE_PADDING * 2,
      lineHeight: 16,
    });

    const textObj = new Text({ text: dialogText, style: textStyle });

    // 计算气泡背景尺寸
    const bgWidth = Math.min(textObj.width + NPC_BUBBLE_PADDING * 2, NPC_BUBBLE_MAX_WIDTH);
    const bgHeight = textObj.height + NPC_BUBBLE_PADDING * 2;

    // 气泡位置：NPC 上方居中
    const bubbleX = -bgWidth / 2;
    const bubbleY = -(NPC_DOT_RADIUS + bgHeight + 16);

    const gfx = new Graphics();

    // 气泡背景（圆角矩形）
    gfx.roundRect(bubbleX, bubbleY, bgWidth, bgHeight, NPC_BUBBLE_CORNER_RADIUS)
      .fill({ color: NPC_BUBBLE_BG_COLOR, alpha: NPC_BUBBLE_BG_ALPHA });
    gfx.roundRect(bubbleX, bubbleY, bgWidth, bgHeight, NPC_BUBBLE_CORNER_RADIUS)
      .stroke({ color: NPC_BUBBLE_BORDER_COLOR, width: 1 });

    // 气泡尾巴（小三角形指向 NPC）
    const tailX = 0;
    const tailTopY = bubbleY + bgHeight;
    gfx.moveTo(tailX - NPC_BUBBLE_TAIL_SIZE, tailTopY)
      .lineTo(tailX, tailTopY + NPC_BUBBLE_TAIL_SIZE)
      .lineTo(tailX + NPC_BUBBLE_TAIL_SIZE, tailTopY)
      .closePath()
      .fill({ color: NPC_BUBBLE_BG_COLOR, alpha: NPC_BUBBLE_BG_ALPHA });

    bubble.addChild(gfx);

    // 文本
    textObj.position.set(bubbleX + NPC_BUBBLE_PADDING, bubbleY + NPC_BUBBLE_PADDING);
    bubble.addChild(textObj);

    // 初始透明度动画（淡入）
    bubble.alpha = 0;

    view.container.addChild(bubble);
    view.dialogBubble = bubble;
    view.dialogTimer = NPC_BUBBLE_DISPLAY_DURATION;
  }

  /**
   * 移除 NPC 对话气泡
   */
  private removeNPCDialogBubble(view: NPCDotView): void {
    if (view.dialogBubble) {
      view.container.removeChild(view.dialogBubble);
      view.dialogBubble.destroy({ children: true });
      view.dialogBubble = null;
      view.dialogTimer = 0;
    }
  }

  /**
   * 取消选中 NPC
   */
  private deselectNPC(): void {
    if (this.npcSelectionRing) {
      this.npcSelectionRing.destroy();
      this.npcSelectionRing = null;
    }
    // 清理选中 NPC 的信息面板和对话气泡
    if (this.selectedNPCId) {
      const view = this.npcDots.get(this.selectedNPCId);
      if (view) {
        if (view.infoPanel) {
          view.container.removeChild(view.infoPanel);
          view.infoPanel.destroy({ children: true });
          view.infoPanel = null;
        }
        this.removeNPCDialogBubble(view);
      }
    }
    this.selectedNPCId = null;
  }

  /**
   * 更新 NPC 选中高亮动画（脉冲闪烁 + 发光效果）及对话气泡倒计时
   */
  private updateNPCSelection(): void {
    if (!this.npcSelectionRing || !this.selectedNPCId) return;

    // 脉冲缩放动画
    const pulse = 1 + 0.1 * Math.sin(this.npcWalkTime * NPC_GLOW_PULSE_SPEED);
    this.npcSelectionRing.scale.set(pulse);

    // 发光效果（透明度脉冲）
    const glowAlpha = NPC_GLOW_ALPHA * (0.5 + 0.5 * Math.sin(this.npcWalkTime * NPC_GLOW_PULSE_SPEED));
    this.npcSelectionRing.alpha = glowAlpha;

    // 更新对话气泡倒计时
    const view = this.npcDots.get(this.selectedNPCId);
    if (view && view.dialogBubble && view.dialogTimer > 0) {
      // 淡入动画（前 0.3 秒）
      const elapsed = NPC_BUBBLE_DISPLAY_DURATION - view.dialogTimer;
      if (elapsed < 0.3) {
        view.dialogBubble.alpha = elapsed / 0.3;
      } else if (view.dialogTimer < 1.0) {
        // 淡出动画（最后 1 秒）
        view.dialogBubble.alpha = view.dialogTimer;
      } else {
        view.dialogBubble.alpha = 1.0;
      }
    }
  }

  /**
   * 更新所有 NPC 的对话气泡计时器
   */
  private updateNPCDialogTimers(deltaTime: number): void {
    for (const [, view] of this.npcDots) {
      if (view.dialogTimer > 0) {
        view.dialogTimer -= deltaTime;
        if (view.dialogTimer <= 0) {
          this.removeNPCDialogBubble(view);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 粒子效果系统（花瓣飘落 / 烟雾 / 火花）
  // ═══════════════════════════════════════════════════════════

  /**
   * 初始化粒子效果
   *
   * 生成初始粒子池，花瓣从顶部飘落，烟雾从底部升起。
   * 粒子数量控制在 MAX_PARTICLES 以内，确保性能。
   */
  private initParticles(): void {
    this.particles = [];

    // 花瓣粒子（从顶部飘落）
    for (let i = 0; i < 15; i++) {
      this.particles.push(this.createParticle('petal'));
    }

    // 烟雾粒子（从底部缓慢升起）
    for (let i = 0; i < 8; i++) {
      this.particles.push(this.createParticle('smoke'));
    }

    // 火花粒子（随机闪烁）
    for (let i = 0; i < 5; i++) {
      this.particles.push(this.createParticle('spark'));
    }
  }

  /**
   * 创建单个粒子
   */
  private createParticle(type: ParticleType): MapParticle {
    // 地图范围（用于粒子活动区域）
    const mapW = this.tileMapData ? this.tileMapData.width * this.tileMapData.tileSize : 1280;
    const mapH = this.tileMapData ? this.tileMapData.height * this.tileMapData.tileSize : 960;

    switch (type) {
      case 'petal':
        return {
          type,
          x: Math.random() * mapW,
          y: Math.random() * mapH - mapH * 0.1,
          vx: 8 + Math.random() * 15,
          vy: 10 + Math.random() * 20,
          size: 2 + Math.random() * 3,
          alpha: 0.3 + Math.random() * 0.4,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 2,
          life: Math.random() * 8,
          maxLife: 6 + Math.random() * 6,
          color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
        };
      case 'smoke':
        return {
          type,
          x: Math.random() * mapW,
          y: mapH * (0.7 + Math.random() * 0.3),
          vx: (Math.random() - 0.5) * 5,
          vy: -(3 + Math.random() * 8),
          size: 6 + Math.random() * 10,
          alpha: 0.05 + Math.random() * 0.1,
          rotation: 0,
          rotationSpeed: 0,
          life: Math.random() * 10,
          maxLife: 8 + Math.random() * 8,
          color: SMOKE_COLOR,
        };
      case 'spark':
        return {
          type,
          x: Math.random() * mapW,
          y: Math.random() * mapH,
          vx: 0,
          vy: 0,
          size: 1 + Math.random() * 2,
          alpha: 0,
          rotation: 0,
          rotationSpeed: 0,
          life: Math.random() * 4,
          maxLife: 2 + Math.random() * 3,
          color: SPARK_COLOR,
        };
    }
  }

  /**
   * 更新粒子位置和生命周期
   */
  /**
   * 更新水面动画叠加层
   *
   * 在水域瓦片上绘制动态 sine 曲线波纹，产生流动感。
   * 使用预缓存的水面瓦片位置，避免每帧遍历全地图。
   */
  private updateWaterAnimation(deltaTime: number): void {
    if (!this.waterAnimGraphics || this.waterTiles.length === 0) return;

    this.waterAnimTime += deltaTime;
    this.waterAnimGraphics.clear();
    this.waterAnimGraphics.visible = true;

    const t = this.waterAnimTime;

    for (const wt of this.waterTiles) {
      const { x, y, tileSize, variant } = wt;
      // 每个瓦片的波纹有不同相位偏移
      const phaseOffset = variant * 0.7;

      // 动态波纹线（3条，不同振幅和速度）
      for (let line = 0; line < 3; line++) {
        const lineY = y + tileSize * 0.2 + line * (tileSize * 0.25);
        const amp = 1.5 + line * 0.5;
        const speed = 1.5 + line * 0.3;
        const alpha = 0.12 + line * 0.03;

        this.waterAnimGraphics!.moveTo(x + 2, lineY + Math.sin(t * speed + phaseOffset) * amp);
        for (let px = 4; px <= tileSize - 2; px += 4) {
          const py = lineY + Math.sin(t * speed + phaseOffset + px * 0.15) * amp;
          this.waterAnimGraphics!.lineTo(Math.floor(x + px), Math.floor(py));
        }
        this.waterAnimGraphics!.stroke({ width: 0.8, color: 0x8ab4d0, alpha });
      }

      // 闪烁高光点（模拟阳光反射）
      for (let i = 0; i < 2; i++) {
        const sparkX = Math.floor(x + 6 + ((t * 15 + variant * 20 + i * 30) % (tileSize - 12)));
        const sparkY = Math.floor(y + 6 + ((t * 10 + variant * 15 + i * 25) % (tileSize - 12)));
        const sparkAlpha = 0.15 + 0.1 * Math.sin(t * 3 + i + variant);
        this.waterAnimGraphics!.circle(sparkX, sparkY, 1.2)
          .fill({ color: 0xffffff, alpha: Math.max(0, sparkAlpha) });
      }
    }
  }

  private updateParticles(deltaTime: number): void {
    this.particleTime += deltaTime;

    const mapW = this.tileMapData ? this.tileMapData.width * this.tileMapData.tileSize : 1280;
    const mapH = this.tileMapData ? this.tileMapData.height * this.tileMapData.tileSize : 960;

    this.particleGraphics.clear();

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // 更新生命周期
      p.life += deltaTime;

      // 生命周期结束 → 重生
      if (p.life >= p.maxLife) {
        this.particles[i] = this.createParticle(p.type);
        continue;
      }

      // 更新位置
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.rotation += p.rotationSpeed * deltaTime;

      // 计算生命周期进度（0→1）
      const progress = p.life / p.maxLife;

      // 根据类型计算透明度
      let alpha: number;
      switch (p.type) {
        case 'petal':
          // 花瓣：淡入 → 稳定 → 淡出
          alpha = progress < 0.1 ? p.alpha * (progress / 0.1)
            : progress > 0.8 ? p.alpha * (1 - (progress - 0.8) / 0.2)
            : p.alpha;
          break;
        case 'smoke':
          // 烟雾：缓慢淡入后淡出
          alpha = p.alpha * (1 - progress * progress);
          break;
        case 'spark':
          // 火花：闪烁效果
          alpha = p.alpha * Math.max(0, Math.sin(progress * Math.PI * 4));
          break;
        default:
          alpha = p.alpha;
      }

      if (alpha < 0.01) continue;

      // 绘制粒子
      switch (p.type) {
        case 'petal': {
          // 花瓣：椭圆形
          this.particleGraphics
            .ellipse(p.x, p.y, p.size, p.size * 0.6)
            .fill({ color: p.color, alpha });
          break;
        }
        case 'smoke': {
          // 烟雾：大圆形，极低透明度
          this.particleGraphics
            .circle(p.x, p.y, p.size * (1 + progress * 0.5))
            .fill({ color: p.color, alpha });
          break;
        }
        case 'spark': {
          // 火花：小亮点
          this.particleGraphics
            .circle(p.x, p.y, p.size)
            .fill({ color: p.color, alpha });
          break;
        }
      }

      // 边界循环（花瓣从右侧消失后从左侧出现）
      if (p.type === 'petal') {
        if (p.x > mapW + 20) p.x = -20;
        if (p.y > mapH + 20) { p.y = -20; p.x = Math.random() * mapW; }
      }
      if (p.type === 'smoke') {
        if (p.y < -20) { p.y = mapH + 20; p.x = Math.random() * mapW; }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 水墨宣纸背景纹理
  // ═══════════════════════════════════════════════════════════

  /**
   * 绘制水墨宣纸背景纹理
   *
   * 使用 Graphics API 模拟宣纸质感：
   * - 淡墨色渐变底色
   * - 随机纹理线条（模拟宣纸纤维）
   * - 淡色墨点（模拟纸张颗粒感）
   */
  private drawInkWashBackground(gfx: Graphics, map: GameMap): void {
    const mapW = Math.floor(map.width * map.tileSize);
    const mapH = Math.floor(map.height * map.tileSize);

    // ── 1. 古纸底色渐变（深棕→暗金） ──
    // 使用矩形模拟渐变（从上到下，深棕到暗金棕）
    const gradientSteps = 8;
    for (let i = 0; i < gradientSteps; i++) {
      const t = i / gradientSteps;
      const y = Math.floor(mapH * t);
      const h = Math.ceil(mapH / gradientSteps) + 1;
      // 从深墨棕(0x1a1410)到暗金棕(0x2d1b0a)
      const r = Math.floor(0x1a + (0x2d - 0x1a) * t);
      const g = Math.floor(0x14 + (0x1b - 0x14) * t);
      const b = Math.floor(0x10 + (0x0a - 0x10) * t);
      const color = (r << 16) | (g << 8) | b;
      gfx.rect(0, y, mapW, h).fill({ color, alpha: 0.35 });
    }

    // ── 2. 宣纸纤维纹理（随机淡色线条） ──
    // 使用伪随机种子生成固定纹理，避免每帧变化
    const fiberCount = 60;
    for (let i = 0; i < fiberCount; i++) {
      // 简单伪随机：使用索引生成固定位置
      const seed1 = (i * 7919 + 104729) % mapW;
      const seed2 = (i * 6271 + 87383) % mapH;
      const seed3 = (i * 3571 + 51439) % 100;
      const x1 = Math.floor(seed1);
      const y1 = Math.floor(seed2);
      const len = Math.floor(20 + seed3 * 0.6);
      const angle = ((i * 3) % 360) * Math.PI / 180;
      const x2 = Math.floor(x1 + Math.cos(angle) * len);
      const y2 = Math.floor(y1 + Math.sin(angle) * len);
      const fiberAlpha = 0.02 + (seed3 % 5) * 0.008;
      gfx.moveTo(x1, y1).lineTo(x2, y2)
        .stroke({ width: 0.5, color: 0xd4a574, alpha: fiberAlpha });
    }

    // ── 3. 淡墨点（纸张颗粒感） ──
    const dotCount = 40;
    for (let i = 0; i < dotCount; i++) {
      const dx = Math.floor((i * 8737 + 54321) % mapW);
      const dy = Math.floor((i * 4261 + 98765) % mapH);
      const size = 1 + (i % 3);
      const dotAlpha = 0.015 + (i % 4) * 0.005;
      gfx.circle(dx, dy, size).fill({ color: 0x8a7a60, alpha: dotAlpha });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 古风装饰边框（回纹/云纹）
  // ═══════════════════════════════════════════════════════════

  /**
   * 绘制古风装饰边框
   *
   * 使用 Graphics API 在地图边缘绘制回纹和云纹装饰。
   * 边框跟随摄像机移动，始终显示在视口边缘。
   */
  private drawDecorativeBorder(): void {
    this.decorBorderGraphics.clear();

    // 获取视口尺寸（使用画布尺寸作为参考）
    const parent = this.container.parent;
    if (!parent) return;

    const viewW = parent.width;
    const viewH = parent.height;

    if (viewW === 0 || viewH === 0) return;

    // 获取摄像机偏移，将边框固定在视口上
    const camState = this.cameraManager.getState();
    const camX = camState.x - viewW / (2 * camState.zoom);
    const camY = camState.y - viewH / (2 * camState.zoom);
    const camW = viewW / camState.zoom;
    const camH = viewH / camState.zoom;

    const borderAlpha = 0.2;
    const gold = 0xb8860b; // 暗金 — 青铜色

    // ── 顶部回纹装饰 ──
    const topY = camY + 4;
    const segmentW = 30;
    for (let x = camX; x < camX + camW; x += segmentW * 2) {
      // 回纹单元：方折线
      this.decorBorderGraphics
        .moveTo(x, topY)
        .lineTo(x + segmentW * 0.5, topY)
        .lineTo(x + segmentW * 0.5, topY + 6)
        .lineTo(x + segmentW, topY + 6)
        .lineTo(x + segmentW, topY)
        .stroke({ width: 1, color: gold, alpha: borderAlpha });
    }

    // ── 底部回纹装饰 ──
    const botY = camY + camH - 10;
    for (let x = camX; x < camX + camW; x += segmentW * 2) {
      this.decorBorderGraphics
        .moveTo(x, botY + 6)
        .lineTo(x + segmentW * 0.5, botY + 6)
        .lineTo(x + segmentW * 0.5, botY)
        .lineTo(x + segmentW, botY)
        .lineTo(x + segmentW, botY + 6)
        .stroke({ width: 1, color: gold, alpha: borderAlpha });
    }

    // ── 左侧云纹装饰 ──
    const leftX = camX + 4;
    const segmentH = 40;
    for (let y = camY + 20; y < camY + camH - 20; y += segmentH) {
      // 简易云纹：螺旋弧线
      this.decorBorderGraphics
        .moveTo(leftX, y)
        .quadraticCurveTo(leftX + 8, y + segmentH * 0.25, leftX + 4, y + segmentH * 0.5)
        .stroke({ width: 1, color: gold, alpha: borderAlpha * 0.8 });
      this.decorBorderGraphics
        .moveTo(leftX + 4, y + segmentH * 0.5)
        .quadraticCurveTo(leftX - 2, y + segmentH * 0.75, leftX, y + segmentH)
        .stroke({ width: 1, color: gold, alpha: borderAlpha * 0.8 });
    }

    // ── 右侧云纹装饰 ──
    const rightX = camX + camW - 4;
    for (let y = camY + 20; y < camY + camH - 20; y += segmentH) {
      this.decorBorderGraphics
        .moveTo(rightX, y)
        .quadraticCurveTo(rightX - 8, y + segmentH * 0.25, rightX - 4, y + segmentH * 0.5)
        .stroke({ width: 1, color: gold, alpha: borderAlpha * 0.8 });
      this.decorBorderGraphics
        .moveTo(rightX - 4, y + segmentH * 0.5)
        .quadraticCurveTo(rightX + 2, y + segmentH * 0.75, rightX, y + segmentH)
        .stroke({ width: 1, color: gold, alpha: borderAlpha * 0.8 });
    }

    // ── 四角装饰（简化回纹方角） ──
    const cornerSize = 16;
    const corners = [
      { x: camX + 2, y: camY + 2 },
      { x: camX + camW - 2, y: camY + 2 },
      { x: camX + 2, y: camY + camH - 2 },
      { x: camX + camW - 2, y: camY + camH - 2 },
    ];
    for (const corner of corners) {
      const dx = corner.x < camX + camW / 2 ? 1 : -1;
      const dy = corner.y < camY + camH / 2 ? 1 : -1;
      this.decorBorderGraphics
        .moveTo(corner.x, corner.y + dy * cornerSize)
        .lineTo(corner.x, corner.y)
        .lineTo(corner.x + dx * cornerSize, corner.y)
        .stroke({ width: 1.5, color: gold, alpha: borderAlpha * 1.5 });
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
      // 整数坐标：瓦片中心
      const cx = Math.floor(lm.x * tileSize + tileSize / 2);
      const cy = Math.floor(lm.y * tileSize + tileSize / 2);

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
   * 绘制资源点图标（农田/矿场/伐木场/渔场/牧场）
   *
   * 每种资源点使用独特的图形标记：
   * - 农田：绿色方块
   * - 矿场：棕色三角
   * - 伐木场：深绿菱形
   * - 渔场：蓝色波浪线
   * - 牧场：橙色圆形
   */
  private renderTileResourcePoints(
    resourcePointLayer: Container,
    labelLayer: Container,
    map: GameMap,
  ): void {
    const tileSize = map.tileSize;

    for (const rp of map.resourcePoints) {
      const cx = Math.floor(rp.x * tileSize + tileSize / 2);
      const cy = Math.floor(rp.y * tileSize + tileSize / 2);

      const container = new Container({ label: `tile-resource-${rp.name}` });
      container.position.set(cx, cy);
      container.eventMode = 'static';
      container.cursor = 'pointer';

      const color = RESOURCE_POINT_COLORS[rp.type] ?? 0x9e9e9e;
      const gfx = new Graphics();
      const half = RESOURCE_POINT_SIZE;

      // 根据类型绘制不同形状
      switch (rp.type) {
        case 'farm': {
          // 绿色方块（田地）
          gfx.rect(-half, -half, half * 2, half * 2)
            .fill({ color, alpha: 0.7 });
          gfx.rect(-half, -half, half * 2, half * 2)
            .stroke({ color: 0x2e7d32, width: 1 });
          // 田地纹理（十字线）
          gfx.moveTo(-half, 0).lineTo(half, 0)
            .stroke({ width: 0.5, color: 0x1b5e20, alpha: 0.5 });
          gfx.moveTo(0, -half).lineTo(0, half)
            .stroke({ width: 0.5, color: 0x1b5e20, alpha: 0.5 });
          break;
        }
        case 'mine': {
          // 棕色三角（矿山）
          gfx.moveTo(0, -half - 2)
            .lineTo(-half, half)
            .lineTo(half, half)
            .closePath()
            .fill({ color, alpha: 0.7 });
          gfx.moveTo(0, -half - 2)
            .lineTo(-half, half)
            .lineTo(half, half)
            .closePath()
            .stroke({ color: 0x5d4037, width: 1 });
          break;
        }
        case 'lumber': {
          // 深绿菱形（伐木场）
          gfx.moveTo(0, -half - 1)
            .lineTo(half + 1, 0)
            .lineTo(0, half + 1)
            .lineTo(-half - 1, 0)
            .closePath()
            .fill({ color, alpha: 0.7 });
          gfx.moveTo(0, -half - 1)
            .lineTo(half + 1, 0)
            .lineTo(0, half + 1)
            .lineTo(-half - 1, 0)
            .closePath()
            .stroke({ color: 0x1b5e20, width: 1 });
          break;
        }
        case 'fishery': {
          // 蓝色波浪线（渔场）
          gfx.circle(0, 0, half).fill({ color, alpha: 0.5 });
          gfx.circle(0, 0, half).stroke({ color: 0x1565c0, width: 1 });
          // 波浪纹
          gfx.moveTo(-half + 2, 0)
            .bezierCurveTo(-half / 2, -3, half / 2, 3, half - 2, 0)
            .stroke({ width: 1, color: 0xffffff, alpha: 0.4 });
          break;
        }
        case 'stable': {
          // 橙色圆形（牧场）
          gfx.circle(0, 0, half).fill({ color, alpha: 0.7 });
          gfx.circle(0, 0, half).stroke({ color: 0xe65100, width: 1 });
          break;
        }
      }

      container.addChild(gfx);

      // 资源类型 emoji 图标
      const emoji = RESOURCE_POINT_ICONS[rp.type] ?? '📦';
      const emojiText = new Text({
        text: emoji,
        style: new TextStyle({ fontSize: 8 }),
      });
      emojiText.anchor.set(0.5, 0.5);
      emojiText.position.set(0, -half - 7);
      container.addChild(emojiText);

      resourcePointLayer.addChild(container);

      // 资源点名称标签
      const nameLabel = new Text({
        text: rp.name,
        style: new TextStyle({
          fontSize: RESOURCE_LABEL_FONT_SIZE,
          fill: '#c0c0c0',
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          stroke: { color: '#000000', width: 1.5 },
        }),
      });
      nameLabel.anchor.set(0.5, 0);
      nameLabel.position.set(cx, cy + half + 2);
      labelLayer.addChild(nameLabel);
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
      this.tileMapView.resourcePointLayer,
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
    // 格子悬停高亮已禁用（取消鼠标移动时的色块）
    this.cellHighlight.graphics.visible = false;
    this.cellHighlight.visible = false;
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
  // 边缘滚动交互
  // ═══════════════════════════════════════════════════════════

  /**
   * 鼠标进入容器：启用边缘滚动检测
   */
  private onPointerEnter = (): void => {
    this.pointerInContainer = true;
  };

  /**
   * 鼠标离开容器：目标速度归零（实际速度通过平滑插值逐渐衰减）
   */
  private onPointerLeave = (): void => {
    this.pointerInContainer = false;
    this.edgeScrollVelocity.x = 0;
    this.edgeScrollVelocity.y = 0;
  };

  /**
   * 指针移动：更新 Tooltip 位置 + 计算边缘滚动速度
   *
   * 边缘滚动逻辑：
   * - 获取鼠标在容器中的位置
   * - 计算到各边缘的距离
   * - 在边缘检测区域内，根据距离比例计算滚动速度
   * - 鼠标越靠近边缘，速度越快
   */
  private onPointerMove = (e: import('pixi.js').FederatedPointerEvent): void => {
    // 记录鼠标位置（用于 Tooltip 跟随）
    this.pointerGlobalPos = { x: e.globalX, y: e.globalY };

    // 右键选区拖拽
    if (this.selection.active) {
      this.onRightMove(e.globalX, e.globalY);
      return;
    }

    // ── 边缘滚动速度计算 ──────────────────────────────────
    this.computeEdgeScrollVelocity(e.globalX, e.globalY);
  };

  /**
   * 根据鼠标位置计算边缘滚动速度
   *
   * @param globalX 鼠标全局 X 坐标
   * @param globalY 鼠标全局 Y 坐标
   */
  private computeEdgeScrollVelocity(globalX: number, globalY: number): void {
    // 获取容器实际尺寸（通过 renderer 或 DOM）
    const renderer = this.container.parent;
    if (!renderer) {
      this.edgeScrollVelocity.x = 0;
      this.edgeScrollVelocity.y = 0;
      return;
    }

    // 使用 PixiJS 获取画布尺寸
    const width = renderer.width;
    const height = renderer.height;
    const zone = this.EDGE_SCROLL_ZONE;

    let vx = 0;
    let vy = 0;

    // 左边缘：鼠标在左边 zone 像素内 → 地图向右滚（正方向）
    if (globalX < zone) {
      const ratio = 1 - (globalX / zone); // 越靠近边缘 ratio 越大（0→1）
      vx = EDGE_SCROLL_MIN_SPEED + ratio * (EDGE_SCROLL_MAX_SPEED - EDGE_SCROLL_MIN_SPEED);
    }
    // 右边缘：鼠标在右边 zone 像素内 → 地图向左滚（负方向）
    else if (globalX > width - zone) {
      const ratio = 1 - ((width - globalX) / zone);
      vx = -(EDGE_SCROLL_MIN_SPEED + ratio * (EDGE_SCROLL_MAX_SPEED - EDGE_SCROLL_MIN_SPEED));
    }

    // 上边缘：鼠标在上边 zone 像素内 → 地图向下滚（正方向）
    if (globalY < zone) {
      const ratio = 1 - (globalY / zone);
      vy = EDGE_SCROLL_MIN_SPEED + ratio * (EDGE_SCROLL_MAX_SPEED - EDGE_SCROLL_MIN_SPEED);
    }
    // 下边缘：鼠标在下边 zone 像素内 → 地图向上滚（负方向）
    else if (globalY > height - zone) {
      const ratio = 1 - ((height - globalY) / zone);
      vy = -(EDGE_SCROLL_MIN_SPEED + ratio * (EDGE_SCROLL_MAX_SPEED - EDGE_SCROLL_MIN_SPEED));
    }

    this.edgeScrollVelocity.x = vx;
    this.edgeScrollVelocity.y = vy;
  }

  private onPointerUp = (): void => {
    // 无拖拽逻辑，保留空方法以防事件绑定报错
  };

  // ═══════════════════════════════════════════════════════════
  // 触摸交互（单指拖拽 + 双指缩放）
  //
  // PixiJS v8 为每个触摸点分发独立的 FederatedPointerEvent，
  // 通过 pointerId 区分不同手指。
  // ═══════════════════════════════════════════════════════════

  /**
   * 触摸开始：记录触摸点
   *
   * PixiJS v8 为每根手指分别触发 touchstart 事件，
   * 通过 pointerId 和 touchPoints.size 判断当前触摸点数。
   */
  private onTouchStart = (e: import('pixi.js').FederatedPointerEvent): void => {
    // 仅处理触摸类型事件
    if (e.pointerType !== 'touch') return;

    // 记录此触摸点
    this.touchPoints.set(e.pointerId, { x: e.globalX, y: e.globalY });

    if (this.touchPoints.size === 1) {
      // 第一根手指：进入平移模式
      this.touchDragStart = { x: e.globalX, y: e.globalY };
      this.touchDragVelocity = { x: 0, y: 0 };
    } else if (this.touchPoints.size === 2) {
      // 第二根手指：退出平移，进入缩放模式
      this.touchDragVelocity = { x: 0, y: 0 };

      // 计算两指初始距离和中心
      const pts = Array.from(this.touchPoints.values());
      this.lastPinchDistance = Math.hypot(
        pts[1].x - pts[0].x,
        pts[1].y - pts[0].y,
      );
      this.lastPinchCenter = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
    }
  };

  /**
   * 触摸移动：
   *
   * - 单指（touchPoints.size === 1）：平移地图
   * - 双指（touchPoints.size === 2）：根据距离变化缩放 + 中心平移
   */
  private onTouchMove = (e: import('pixi.js').FederatedPointerEvent): void => {
    if (e.pointerType !== 'touch') return;

    // 更新此触摸点位置
    this.touchPoints.set(e.pointerId, { x: e.globalX, y: e.globalY });

    if (this.touchPoints.size === 1) {
      // 单指平移
      const dx = e.globalX - this.touchDragStart.x;
      const dy = e.globalY - this.touchDragStart.y;

      this.touchDragVelocity = {
        x: e.globalX - this.touchDragStart.x,
        y: e.globalY - this.touchDragStart.y,
      };

      const camState = this.cameraManager.getState();
      this.cameraManager.panTo(camState.x + dx, camState.y + dy, false);
      this.touchDragStart = { x: e.globalX, y: e.globalY };
    } else if (this.touchPoints.size >= 2) {
      // 双指缩放：取最新两个触摸点位置
      const pts = Array.from(this.touchPoints.values());
      const p0 = pts[0];
      const p1 = pts[1];
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const center = {
        x: (p0.x + p1.x) / 2,
        y: (p0.y + p1.y) / 2,
      };

      if (this.lastPinchDistance > 0) {
        const scale = dist / this.lastPinchDistance;
        const camState = this.cameraManager.getState();
        this.cameraManager.zoomTo(camState.zoom * scale, false);

        // 双指中心平移
        const cdx = center.x - this.lastPinchCenter.x;
        const cdy = center.y - this.lastPinchCenter.y;
        this.cameraManager.panTo(camState.x + cdx, camState.y + cdy, false);
      }

      this.lastPinchDistance = dist;
      this.lastPinchCenter = center;
    }
  };

  /**
   * 触摸结束：清理状态
   *
   * PixiJS v8 为每根手指分别触发 touchend 事件。
   */
  private onTouchEnd = (e: import('pixi.js').FederatedPointerEvent): void => {
    if (e.pointerType !== 'touch') return;

    // 移除已释放的触摸点
    this.touchPoints.delete(e.pointerId);

    if (this.touchPoints.size === 0) {
      // 全部手指离开：停止平移
      this.lastPinchDistance = 0;
    } else if (this.touchPoints.size === 1) {
      // 从双指切回单指：重新开始平移
      const remaining = this.touchPoints.values().next().value;
      if (remaining) {
        this.touchDragStart = { x: remaining.x, y: remaining.y };
        this.touchDragVelocity = { x: 0, y: 0 };
      }
      this.lastPinchDistance = 0;
    }
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
