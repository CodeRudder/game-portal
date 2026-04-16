/**
 * renderer/types.ts — PixiJS v8 渲染层类型定义
 *
 * 定义渲染层与逻辑层之间的所有桥接接口。
 * 渲染器只接收序列化后的渲染数据，不直接访问子系统模块。
 *
 * @module renderer/types
 */

import type { Container } from 'pixi.js';

// ═══════════════════════════════════════════════════════════════
// 1. 渲染器配置
// ═══════════════════════════════════════════════════════════════

/** 渲染器初始化配置 */
export interface RendererConfig {
  /** 设备像素比，默认 window.devicePixelRatio */
  resolution: number;
  /** 背景色（CSS 颜色字符串或十六进制数字） */
  backgroundColor: string;
  /** 横屏设计宽度 */
  designWidth: number;
  /** 横屏设计高度 */
  designHeight: number;
  /** 竖屏设计宽度（可选，默认等于 designHeight） */
  designWidthPortrait?: number;
  /** 竖屏设计高度（可选，默认等于 designWidth） */
  designHeightPortrait?: number;
  /** 抗锯齿 */
  antialias: boolean;
  /** 自动检测 density（默认 true） */
  autoDensity?: boolean;
}

/** 渲染器默认配置 */
export const DEFAULT_RENDERER_CONFIG: RendererConfig = {
  resolution: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  backgroundColor: '#1a1a2e',
  designWidth: 1920,
  designHeight: 1080,
  antialias: true,
  autoDensity: true,
};

// ═══════════════════════════════════════════════════════════════
// 2. 场景类型
// ═══════════════════════════════════════════════════════════════

/** 支持的场景类型 */
export type SceneType =
  | 'map'             // 主地图 — 领土全景
  | 'building-detail' // 建筑详情 — 单个建筑放大视图
  | 'combat'          // 战斗场景 — 回合/即时战斗
  | 'dialog'          // 对话场景 — 剧情对话
  | 'tech-tree'       // 科技树 — 技术路线图
  | 'hero-detail'     // 武将详情 — 武将信息面板
  | 'prestige'        // 声望转生 — 转生界面
  | 'stage-info';     // 阶段信息 — 当前阶段概览

/** 场景过渡动画类型 */
export type SceneTransition =
  | 'none'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'zoom-in'
  | 'zoom-out';

/** 场景切换选项 */
export interface SceneSwitchOptions {
  /** 过渡动画类型 */
  transition?: SceneTransition;
  /** 过渡持续时间（毫秒） */
  duration?: number;
  /** 传递给新场景的参数 */
  params?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// 3. 建筑渲染数据
// ═══════════════════════════════════════════════════════════════

/** 建筑状态 */
export type BuildingState = 'idle' | 'building' | 'upgrading' | 'producing' | 'locked';

/** 建筑在地图上的渲染数据 */
export interface BuildingRenderData {
  /** 建筑实例 ID */
  id: string;
  /** 建筑类型标识（对应定义表的 key） */
  type: string;
  /** 显示名称 */
  name: string;
  /** 当前等级 */
  level: number;
  /** 最大等级 */
  maxLevel: number;
  /** 地图上的位置（设计坐标系） */
  position: { x: number; y: number };
  /** 建筑尺寸（设计坐标系） */
  size: { width: number; height: number };
  /** 当前状态 */
  state: BuildingState;
  /** 产出资源 ID */
  productionResource?: string;
  /** 每秒产出速率 */
  productionRate?: number;
  /** 升级费用（资源 ID → 数量） */
  upgradeCost?: Record<string, number>;
  /** 是否可购买升级 */
  canUpgrade?: boolean;
  /** 图标/精灵资源 key */
  iconAsset?: string;
  /** 建造进度（0~1） */
  buildProgress?: number;
}

// ═══════════════════════════════════════════════════════════════
// 4. 战斗渲染数据
// ═══════════════════════════════════════════════════════════════

/** 战斗角色阵营 */
export type CombatFaction = 'player' | 'enemy';

/** 单个战斗角色的渲染数据 */
export interface CombatUnitRenderData {
  /** 角色 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 阵营 */
  faction: CombatFaction;
  /** 位置（战斗场景坐标） */
  position: { x: number; y: number };
  /** 当前 HP */
  currentHp: number;
  /** 最大 HP */
  maxHp: number;
  /** 攻击力 */
  attack: number;
  /** 防御力 */
  defense: number;
  /** 是否存活 */
  alive: boolean;
  /** 精灵资源 key */
  spriteAsset?: string;
  /** 稀有度（用于边框颜色） */
  rarity?: string;
  /** 当前状态动画 */
  animState?: 'idle' | 'attack' | 'hurt' | 'die' | 'skill';
}

/** 伤害飘字数据 */
export interface DamageNumberData {
  /** 唯一 ID */
  id: string;
  /** 伤害数值 */
  value: number;
  /** 显示位置 */
  position: { x: number; y: number };
  /** 伤害类型 */
  type: 'normal' | 'critical' | 'heal' | 'miss';
  /** 颜色覆盖 */
  color?: string;
}

/** 技能特效数据 */
export interface SkillEffectData {
  /** 特效 ID */
  id: string;
  /** 特效类型 */
  type: 'slash' | 'fire' | 'ice' | 'lightning' | 'heal' | 'buff' | 'debuff' | 'freeze' | 'flame' | 'thunder';
  /** 起始位置 */
  from: { x: number; y: number };
  /** 目标位置 */
  to: { x: number; y: number };
  /** 持续时间（毫秒） */
  duration: number;
}

/** 战斗场景完整渲染数据 */
export interface CombatRenderData {
  /** 战斗 ID */
  battleId: string;
  /** 当前波次 */
  currentWave: number;
  /** 总波次 */
  totalWaves: number;
  /** 玩家角色列表 */
  playerUnits: CombatUnitRenderData[];
  /** 敌方角色列表 */
  enemyUnits: CombatUnitRenderData[];
  /** 活跃的伤害飘字 */
  damageNumbers: DamageNumberData[];
  /** 活跃的技能特效 */
  skillEffects: SkillEffectData[];
  /** 战斗状态 */
  state: 'preparing' | 'fighting' | 'victory' | 'defeat';
  /** 奖励预览 */
  rewards?: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// 5. 领土/地图渲染数据
// ═══════════════════════════════════════════════════════════════

/** 领土渲染数据 */
export interface TerritoryRenderData {
  /** 领土 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 领土类型 */
  type: 'capital' | 'city' | 'fortress' | 'village' | 'wilderness';
  /** 地图上的位置（节点图坐标） */
  position: { x: number; y: number };
  /** 是否已被征服 */
  conquered: boolean;
  /** 征服所需兵力 */
  powerRequired: number;
  /** 征服奖励（资源 ID → 每秒产出） */
  income: Record<string, number>;
  /** 相邻领土 ID 列表 */
  neighbors: string[];
  /** 颜色（已征服/未征服/锁定） */
  color?: string;
  /** 图标资源 key */
  iconAsset?: string;
}

/** 地图渲染数据 */
export interface MapRenderData {
  /** 所有领土节点 */
  territories: TerritoryRenderData[];
  /** 领土间连接线 */
  connections: { from: string; to: string }[];
  /** 摄像机位置 */
  cameraPosition: { x: number; y: number };
  /** 缩放级别 */
  zoom: number;
  /** 地图上的建筑 */
  buildings: BuildingRenderData[];
}

// ═══════════════════════════════════════════════════════════════
// 6. 科技树渲染数据
// ═══════════════════════════════════════════════════════════════

/** 科技节点渲染数据 */
export interface TechNodeRenderData {
  /** 科技 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 层级 */
  tier: number;
  /** 位置（科技树坐标） */
  position: { x: number; y: number };
  /** 状态 */
  state: 'locked' | 'available' | 'researching' | 'completed';
  /** 研究进度（0~1） */
  progress: number;
  /** 研究费用 */
  cost: Record<string, number>;
  /** 前置科技 ID */
  prerequisites: string[];
  /** 图标资源 key */
  iconAsset?: string;
}

/** 科技树渲染数据 */
export interface TechTreeRenderData {
  /** 所有科技节点 */
  nodes: TechNodeRenderData[];
  /** 节点间依赖连线 */
  connections: { from: string; to: string }[];
  /** 摄像机位置 */
  cameraPosition: { x: number; y: number };
  /** 缩放级别 */
  zoom: number;
}

// ═══════════════════════════════════════════════════════════════
// 7. 武将渲染数据
// ═══════════════════════════════════════════════════════════════

/** 武将渲染数据 */
export interface HeroRenderData {
  /** 武将 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 稀有度 */
  rarity: string;
  /** 阵营 */
  faction: string;
  /** 等级 */
  level: number;
  /** 经验值 */
  exp: number;
  /** 最大经验值 */
  maxExp: number;
  /** 是否已解锁 */
  unlocked: boolean;
  /** 基础属性 */
  stats: {
    attack: number;
    defense: number;
    intelligence: number;
    command: number;
  };
  /** 招募费用 */
  recruitCost?: Record<string, number>;
  /** 是否可招募 */
  canRecruit?: boolean;
  /** 精灵资源 key */
  portraitAsset?: string;
}

// ═══════════════════════════════════════════════════════════════
// 8. 资源栏渲染数据
// ═══════════════════════════════════════════════════════════════

/** 单项资源渲染数据 */
export interface ResourceItemRenderData {
  /** 资源 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 图标 */
  icon: string;
  /** 当前数量 */
  amount: number;
  /** 每秒产出 */
  perSecond: number;
  /** 是否已解锁 */
  unlocked: boolean;
}

/** 资源栏渲染数据 */
export interface ResourceBarRenderData {
  /** 资源列表 */
  resources: ResourceItemRenderData[];
}

// ═══════════════════════════════════════════════════════════════
// 9. 阶段渲染数据
// ═══════════════════════════════════════════════════════════════

/** 阶段渲染数据 */
export interface StageRenderData {
  /** 阶段 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 图标 */
  iconAsset: string;
  /** 主题色 */
  themeColor: string;
  /** 产出倍率 */
  multiplier: number;
  /** 解锁所需资源 */
  requiredResources: Record<string, number>;
  /** 是否为当前阶段 */
  isCurrent: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 10. 声望渲染数据
// ═══════════════════════════════════════════════════════════════

/** 声望渲染数据 */
export interface PrestigeRenderData {
  /** 当前天命数量 */
  currency: number;
  /** 转生次数 */
  count: number;
  /** 当前倍率 */
  multiplier: number;
  /** 本次预计获得天命 */
  previewGain: number;
  /** 预计新倍率 */
  previewNewMultiplier: number;
  /** 资源保留率 */
  retentionRate: number;
  /** 是否可转生 */
  canPrestige: boolean;
  /** 警告信息 */
  warning?: string;
}

// ═══════════════════════════════════════════════════════════════
// 10.5 NPC 渲染数据
// ═══════════════════════════════════════════════════════════════

/** NPC 渲染数据 */
export interface NPCRenderData {
  /** NPC 实例 ID */
  id: string;
  /** 显示名称（对应 defId） */
  name: string;
  /** NPC 类型（对应 defId） */
  type: string;
  /** 地图 X 坐标 */
  x: number;
  /** 地图 Y 坐标 */
  y: number;
  /** 当前状态 */
  state?: string;
  /** 朝向（用于行走动画朝向） */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** 移动速度（格/秒），0 表示静止 */
  speed?: number;
  /** 目标 X 坐标（移动中时有效） */
  targetX?: number;
  /** 目标 Y 坐标（移动中时有效） */
  targetY?: number;
  /** 职业（用于区分 NPC 行为类型） */
  profession?: string;
  /** emoji 图标（用于渲染） */
  iconEmoji?: string;
  /** 是否被选中（高亮状态） */
  selected?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 10.6 昼夜天气渲染数据
// ═══════════════════════════════════════════════════════════════

/** 昼夜天气渲染数据 */
export interface DayNightRenderData {
  /** 当前小时 0-24 */
  hour: number;
  /** 时段名称 */
  timeOfDay: string;
  /** 环境光颜色 (0xRRGGBB) */
  ambientColor: number;
  /** 环境光透明度 0-1 */
  ambientAlpha: number;
  /** 当前天气 */
  weather: string;
  /** 天气强度 0-1 */
  weatherIntensity: number;
}

/** 日历时间渲染数据 */
export interface CalendarRenderData {
  /** 格式化日期字符串（如"建安三年 五月初七 午时"） */
  dateStr: string;
  /** 当前季节 */
  season: string;
  /** 当前时辰 */
  shichen: string;
  /** 当前小时 0-23 */
  timeOfDay: number;
  /** 时间缩放倍率 */
  timeScale: number;
  /** 是否暂停 */
  isPaused: boolean;
  /** 即将到来的事件（最多3个） */
  upcomingEvents: { id: string; name: string; daysRemaining: number }[];
}

// ═══════════════════════════════════════════════════════════════
// 11. 全局游戏渲染状态（逻辑层 → 渲染层的完整数据包）
// ═══════════════════════════════════════════════════════════════

/** 全局游戏渲染数据 — 逻辑层每帧推送给渲染层的完整数据 */
export interface GameRenderState {
  /** 当前场景 */
  activeScene: SceneType;
  /** 资源栏数据 */
  resources: ResourceBarRenderData;
  /** 当前阶段 */
  currentStage: StageRenderData | null;
  /** 地图数据（仅在 map 场景有效） */
  map?: MapRenderData;
  /** 战斗数据（仅在 combat 场景有效） */
  combat?: CombatRenderData;
  /** 科技树数据（仅在 tech-tree 场景有效） */
  techTree?: TechTreeRenderData;
  /** 武将列表（仅在 hero-detail 场景有效） */
  heroes?: HeroRenderData[];
  /** 声望数据（仅在 prestige 场景有效） */
  prestige?: PrestigeRenderData;
  /** 建筑列表（仅在 building-detail 场景有效） */
  buildings?: BuildingRenderData[];
  /** NPC 列表（始终填充） */
  npcs?: NPCRenderData[];
  /** 瓦片地图数据（由 MapGenerator 生成，注入到 MapScene） */
  tileMapData?: unknown;
  /** 昼夜天气数据（始终填充） */
  dayNight?: DayNightRenderData;
  /** 日历时间数据（始终填充） */
  calendar?: CalendarRenderData;
  /** 城市列表（已征服领土的城市内地图数据） */
  cities?: Array<{
    cityId: string;
    cityName: string;
    prosperity: number;
    population: number;
    buildingCount: number;
  }>;
  /** 资源点列表（野外可占领资源点） */
  resourcePoints?: Array<{
    id: string;
    type: string;
    name: string;
    position: { tileX: number; tileY: number };
    isOccupied: boolean;
    workerCount: number;
    maxWorkers: number;
    level: number;
  }>;
  /** 贸易路线列表（城市间贸易） */
  tradeRoutes?: Array<{
    id: string;
    from: string;
    to: string;
    profit: number;
    isActive: boolean;
    caravanCount: number;
  }>;
  /** 活跃事件列表（丰富事件系统） */
  activeEvents?: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
  }>;
  /** 征战关卡进度数据 */
  campaign?: {
    currentStageIndex: number;
    completedStages: string[];
    currentStage: import('../games/three-kingdoms/CampaignSystem').CampaignStage | undefined;
    totalStars: number;
    maxStars: number;
    isAllCompleted: boolean;
    stageStatuses: Array<{
      id: string;
      name: string;
      status: import('../games/three-kingdoms/CampaignSystem').CampaignStageStatus;
      stars: number;
    }>;
    /** 关卡连接路线 */
    connections: Array<{
      from: string;
      to: string;
      type: string;
    }>;
    /** 战斗冷却信息 */
    cooldowns: Array<{
      stageId: string;
      canFight: boolean;
      remainingSeconds: number;
    }>;
    /** 战斗预览（当前选中关卡） */
    battlePreview?: {
      canFight: boolean;
      reason?: string;
      attackerPower: number;
      defenderPower: number;
      difficulty: string;
      estimatedLosses: { min: number; max: number };
      winProbability: number;
    };
  };
}

// ═══════════════════════════════════════════════════════════════
// 12. 渲染器事件（PixiJS → React 方向）
// ═══════════════════════════════════════════════════════════════

/** 渲染器事件回调映射 */
export interface RendererEventMap {
  /** 点击建筑 */
  buildingClick: [id: string];
  /** 悬停建筑 */
  buildingHover: [id: string | null];
  /** 点击地图空白处 */
  mapClick: [x: number, y: number];
  /** 点击领土 */
  territoryClick: [id: string];
  /** 悬停领土 */
  territoryHover: [id: string | null];
  /** 战斗操作 */
  combatAction: [action: string, targetId?: string];
  /** 场景切换完成 */
  sceneChange: [scene: SceneType];
  /** 点击科技节点 */
  techClick: [id: string];
  /** 点击武将 */
  heroClick: [id: string];
  /** 点击购买建筑 */
  buildingBuy: [id: string];
  /** 点击升级建筑 */
  buildingUpgrade: [id: string];
  /** 点击招募武将 */
  heroRecruit: [id: string];
  /** 点击研究科技 */
  techResearch: [id: string];
  /** 点击征服领土 */
  territoryConquer: [id: string];
  /** 点击执行声望转生 */
  prestigeExecute: [];
  /** 点击 NPC */
  npcClick: [npcId: string];
  /** 渲染器初始化完成 */
  rendererReady: [];
  /** 渲染器销毁 */
  rendererDestroy: [];
  /** 渲染器尺寸变化 */
  resize: [width: number, height: number];
  /** 横竖屏切换 */
  orientationChange: [orientation: 'landscape' | 'portrait'];
}

/** 渲染器事件回调类型 */
export type RendererEvents = {
  [K in keyof RendererEventMap]: (...args: RendererEventMap[K]) => void;
};

// ═══════════════════════════════════════════════════════════════
// 13. 场景接口
// ═══════════════════════════════════════════════════════════════

/** 场景生命周期接口 */
export interface IScene {
  /** 场景类型标识 */
  readonly type: SceneType;

  /** 进入场景（带过渡参数） */
  enter(params?: Record<string, unknown>): Promise<void>;

  /** 退出场景 */
  exit(): Promise<void>;

  /** 每帧更新（逻辑帧） */
  update(deltaTime: number): void;

  /** 接收渲染数据推送 */
  setData(data: unknown): void;

  /** 获取 PixiJS 根容器 */
  getContainer(): Container;

  /** 场景是否已激活 */
  isActive(): boolean;

  /** 销毁场景资源 */
  destroy(): void;
}

// ═══════════════════════════════════════════════════════════════
// 14. 管理器接口
// ═══════════════════════════════════════════════════════════════

/** 资源加载进度回调 */
export type LoadProgressCallback = (loaded: number, total: number, assetName: string) => void;

/** 资源管理器接口 */
export interface IAssetManager {
  /** 加载资源包 */
  loadBundle(bundleName: string, onProgress?: LoadProgressCallback): Promise<void>;

  /** 卸载资源包 */
  unloadBundle(bundleName: string): Promise<void>;

  /** 获取纹理 */
  getTexture(assetId: string): import('pixi.js').Texture | null;

  /** 获取纹理图集帧 */
  getSpriteFrame(assetId: string, frame: string): import('pixi.js').Texture | null;

  /** 是否已加载 */
  isBundleLoaded(bundleName: string): boolean;

  /** 销毁所有资源 */
  destroy(): void;
}

/** 动画管理器接口 */
export interface IAnimationManager {
  /** 创建建筑建造动画 */
  playBuildingAnimation(
    target: Container,
    type: 'build' | 'upgrade' | 'produce',
    onComplete?: () => void,
  ): void;

  /** 创建战斗动画序列 */
  playCombatAnimation(
    attacker: Container,
    target: Container,
    effectType: string,
    damage: number,
    onComplete?: () => void,
  ): void;

  /** 创建伤害飘字 */
  playDamageNumber(
    parent: Container,
    data: DamageNumberData,
  ): void;

  /** 创建场景过渡动画 */
  playSceneTransition(
    container: Container,
    transition: SceneTransition,
    duration: number,
    direction: 'in' | 'out',
  ): Promise<void>;

  /** 创建 UI 过渡动画 */
  playUITransition(
    target: Container,
    type: 'fadeIn' | 'fadeOut' | 'slideUp' | 'slideDown' | 'scaleIn' | 'scaleOut',
    duration: number,
  ): Promise<void>;

  /** 停止目标上所有动画 */
  killAnimations(target: Container): void;

  /** 销毁所有动画 */
  destroy(): void;
}

/** 摄像机边界 */
export interface CameraBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** 摄像机管理器接口 */
export interface ICameraManager {
  /** 设置摄像机目标容器 */
  attach(container: Container): void;

  /** 平移到指定位置 */
  panTo(x: number, y: number, smooth?: boolean): void;

  /** 缩放到指定级别 */
  zoomTo(level: number, smooth?: boolean): void;

  /** 平滑跟随目标 */
  followTarget(getPosition: () => { x: number; y: number }): void;

  /** 停止跟随 */
  stopFollow(): void;

  /** 设置边界 */
  setBounds(bounds: CameraBounds): void;

  /** 获取当前摄像机状态 */
  getState(): { x: number; y: number; zoom: number };

  /** 每帧更新 */
  update(deltaTime: number): void;

  /** 销毁 */
  destroy(): void;
}

/** 横竖屏布局策略 */
export type OrientationLayout = 'landscape' | 'portrait';

/** 横竖屏管理器接口 */
export interface IOrientationManager {
  /** 当前方向 */
  getOrientation(): OrientationLayout;

  /** 当前设计尺寸 */
  getDesignSize(): { width: number; height: number };

  /** 当前缩放值 */
  getScale(): number;

  /** 注册方向变化回调 */
  onOrientationChange(callback: (layout: OrientationLayout) => void): () => void;

  /** 销毁 */
  destroy(): void;
}

// ═══════════════════════════════════════════════════════════════
// 15. 渲染器主接口
// ═══════════════════════════════════════════════════════════════

/** 渲染器主接口 */
export interface IGameRenderer {
  /** 初始化渲染器 */
  init(container: HTMLDivElement, config?: Partial<RendererConfig>): Promise<void>;

  /** 销毁渲染器 */
  destroy(): void;

  /** 调整渲染器尺寸 */
  resize(width: number, height: number): void;

  /** 切换场景 */
  switchScene(sceneType: SceneType, options?: SceneSwitchOptions): Promise<void>;

  /** 获取当前场景类型 */
  getCurrentScene(): SceneType;

  /** 推送渲染数据 */
  pushRenderState(state: GameRenderState): void;

  /** 注册事件回调 */
  on<K extends keyof RendererEventMap>(event: K, callback: (...args: RendererEventMap[K]) => void): void;

  /** 注销事件回调 */
  off<K extends keyof RendererEventMap>(event: K, callback: (...args: RendererEventMap[K]) => void): void;

  /** 获取 PixiJS Application 实例（仅用于高级定制） */
  getApp(): import('pixi.js').Application | null;

  /** 获取当前帧率 */
  getFPS(): number;
}

// ═══════════════════════════════════════════════════════════════
// 16. PixiGameAdapter — 通用放置游戏渲染适配层类型
// ═══════════════════════════════════════════════════════════════

/**
 * 从 IdleGameEngine 提取的渲染状态
 *
 * 适配器通过此接口将引擎内部状态序列化为渲染层可消费的数据。
 */
export interface IdleGameRenderState {
  /** 游戏 ID */
  gameId: string;
  /** 资源列表（已解锁） */
  resources: Array<{
    id: string;
    name: string;
    amount: number;
    perSecond: number;
    maxAmount: number;
    unlocked: boolean;
  }>;
  /** 升级列表（可购买的） */
  upgrades: Array<{
    id: string;
    name: string;
    description: string;
    level: number;
    maxLevel: number;
    baseCost: Record<string, number>;
    costMultiplier: number;
    unlocked: boolean;
    canAfford: boolean;
    effect: { type: string; target: string; value: number };
    icon?: string;
  }>;
  /** 声望数据 */
  prestige: {
    currency: number;
    count: number;
  };
  /** 游戏统计 */
  statistics: Record<string, number>;
}

/**
 * 渲染策略接口
 *
 * 定义游戏类型对应的渲染行为，包括场景类型、颜色主题、布局参数。
 */
export interface RenderStrategy {
  /** 策略名称（用于日志和调试） */
  name: string;
  /** 对应的场景类型（默认 'idle'） */
  sceneType: 'idle';
  /** 颜色主题 */
  theme: {
    /** 主背景色 */
    background: string;
    /** 面板背景色 */
    panelBackground: string;
    /** 主文字颜色 */
    textPrimary: string;
    /** 次要文字颜色 */
    textSecondary: string;
    /** 强调色（用于标题、高亮） */
    accent: string;
    /** 成功色（用于产出、可购买） */
    success: string;
    /** 警告色（用于资源不足） */
    warning: string;
    /** 资源栏背景色 */
    resourceBarBg: string;
    /** 按钮背景色 */
    buttonBg: string;
    /** 按钮悬停色 */
    buttonHover: string;
  };
  /** 布局参数 */
  layout: {
    /** 资源栏高度比例（0~1） */
    resourceBarHeight: number;
    /** 建筑区域高度比例（0~1） */
    buildingAreaHeight: number;
    /** 升级面板高度比例（0~1） */
    upgradePanelHeight: number;
    /** 统计面板宽度比例（0~1，侧边栏） */
    statsPanelWidth: number;
    /** 建筑网格列数 */
    gridColumns: number;
    /** 建筑卡片间距（像素） */
    gridGap: number;
    /** 内边距（像素） */
    padding: number;
    /** 圆角半径（像素） */
    borderRadius: number;
  };
}

/**
 * PixiGameAdapter 配置
 */
export interface PixiGameAdapterConfig {
  /** 渲染器配置（覆盖默认值） */
  rendererConfig?: Partial<RendererConfig>;
  /** 自定义渲染策略（覆盖默认策略） */
  strategy?: RenderStrategy;
  /** 状态同步间隔（毫秒，默认 1000） */
  syncInterval?: number;
  /** 是否自动启动引擎（默认 true） */
  autoStart?: boolean;
  /** 是否显示 FPS 指示器（默认 false） */
  showFPS?: boolean;
}
