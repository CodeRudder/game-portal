/**
 * 设置系统 — 类型定义
 *
 * v19.0 设置系统的完整类型定义，涵盖：
 * - 基础设置（语言/时区/通知）
 * - 音效设置（音量/开关/特殊规则）
 * - 画面设置（画质档位/高级选项）
 * - 账号与存档（绑定/云存档/多设备/存档槽位）
 * - 动画配置（过渡/状态/反馈动画）
 *
 * @module core/settings/settings.types
 */

// ─────────────────────────────────────────────
// 通用
// ─────────────────────────────────────────────

/** 设置分类枚举 */
export enum SettingsCategory {
  Basic = 'basic',
  Audio = 'audio',
  Graphics = 'graphics',
  Account = 'account',
  Animation = 'animation',
}

/** 设置变更事件 */
export interface SettingsChangeEvent {
  /** 变更的设置分类 */
  category: SettingsCategory;
  /** 变更的设置键 */
  key: string;
  /** 旧值 */
  oldValue: unknown;
  /** 新值 */
  newValue: unknown;
  /** 变更时间戳 */
  timestamp: number;
}

// ─────────────────────────────────────────────
// 模块A: 基础设置
// ─────────────────────────────────────────────

/** 支持的语言 */
export enum Language {
  SimplifiedChinese = 'zh-CN',
  TraditionalChinese = 'zh-TW',
  English = 'en',
  Japanese = 'ja',
}

/** 时区偏移（UTC-12 ~ UTC+14） */
export type UTCOffset = number; // -12 ~ +14

/** 通知类型 */
export enum NotificationType {
  BuildingComplete = 'buildingComplete',
  ExpeditionReturn = 'expeditionReturn',
  ActivityReminder = 'activityReminder',
  FriendMessage = 'friendMessage',
  AllianceNotice = 'allianceNotice',
}

/** 基础设置状态 */
export interface BasicSettings {
  /** 当前语言 */
  language: Language;
  /** 是否跟随系统语言 */
  languageFollowSystem: boolean;
  /** 时区偏移 */
  timezone: UTCOffset;
  /** 是否跟随设备时区 */
  timezoneFollowDevice: boolean;
  /** 通知总开关 */
  notificationEnabled: boolean;
  /** 各类通知开关 */
  notificationFlags: Record<NotificationType, boolean>;
}

// ─────────────────────────────────────────────
// 模块B: 音效设置
// ─────────────────────────────────────────────

/** 音效通道 */
export enum AudioChannel {
  BGM = 'bgm',
  SFX = 'sfx',
  Voice = 'voice',
  Battle = 'battle',
}

/** 音效开关类型 */
export enum AudioSwitch {
  Master = 'master',
  BGM = 'bgm',
  Voice = 'voice',
  BattleSFX = 'battleSfx',
}

/** 音效设置状态 */
export interface AudioSettings {
  /** 主音量 0~100 */
  masterVolume: number;
  /** BGM 音量 0~100 */
  bgmVolume: number;
  /** 音效音量 0~100 */
  sfxVolume: number;
  /** 语音音量 0~100 */
  voiceVolume: number;
  /** 音效总开关 */
  masterSwitch: boolean;
  /** BGM 开关 */
  bgmSwitch: boolean;
  /** 语音开关 */
  voiceSwitch: boolean;
  /** 战斗音效开关 */
  battleSfxSwitch: boolean;
}

// ─────────────────────────────────────────────
// 模块C: 画面设置
// ─────────────────────────────────────────────

/** 画质档位 */
export enum GraphicsPreset {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Auto = 'auto',
}

/** 高级画质选项 */
export interface AdvancedGraphicsOptions {
  /** 粒子特效 */
  particleEffects: boolean;
  /** 实时阴影 */
  realtimeShadows: boolean;
  /** 水墨晕染 */
  inkWash: boolean;
  /** 帧率限制 (30/60) */
  frameRateLimit: number;
  /** 抗锯齿 */
  antiAliasing: boolean;
}

/** 画面设置状态 */
export interface GraphicsSettings {
  /** 当前画质档位 */
  preset: GraphicsPreset;
  /** 高级选项 */
  advanced: AdvancedGraphicsOptions;
}

/** 设备能力检测结果 */
export interface DeviceCapability {
  /** CPU 核心数 */
  cpuCores: number;
  /** 内存 GB */
  memoryGB: number;
}

// ─────────────────────────────────────────────
// 模块D: 账号与存档
// ─────────────────────────────────────────────

/** 绑定方式 */
export enum BindMethod {
  Phone = 'phone',
  Email = 'email',
  WeChat = 'wechat',
  QQ = 'qq',
  Apple = 'apple',
}

/** 绑定状态 */
export interface BindingInfo {
  /** 绑定方式 */
  method: BindMethod;
  /** 绑定标识（脱敏） */
  identifier: string;
  /** 绑定时间 */
  boundAt: number;
}

/** 云同步频率 */
export enum CloudSyncFrequency {
  OnExit = 'onExit',
  Hourly = 'hourly',
  ManualOnly = 'manualOnly',
}

/** 冲突解决策略 */
export enum ConflictStrategy {
  LatestWins = 'latestWins',
  CloudWins = 'cloudWins',
  AlwaysAsk = 'alwaysAsk',
}

/** 设备信息 */
export interface DeviceInfo {
  /** 设备 ID */
  deviceId: string;
  /** 设备名称 */
  deviceName: string;
  /** 是否主力设备 */
  isPrimary: boolean;
  /** 最后活跃时间 */
  lastActiveAt: number;
}

/** 存档槽位 */
export interface SaveSlot {
  /** 槽位索引 0~3 */
  slotIndex: number;
  /** 是否付费槽位 */
  isPaid: boolean;
  /** 是否已购买 */
  purchased: boolean;
  /** 存档数据（null 表示空槽位） */
  data: SaveSlotData | null;
}

/** 存档数据 */
export interface SaveSlotData {
  /** 存档名称 */
  name: string;
  /** 保存时间 */
  savedAt: number;
  /** 游戏进度描述 */
  progress: string;
  /** 存档大小 (bytes) */
  sizeBytes: number;
}

/** 账号设置状态 */
export interface AccountSettings {
  /** 绑定列表 */
  bindings: BindingInfo[];
  /** 是否游客账号 */
  isGuest: boolean;
  /** 首次绑定奖励是否已领取 */
  firstBindRewardClaimed: boolean;
  /** 云同步频率 */
  cloudSyncFrequency: CloudSyncFrequency;
  /** 仅 WiFi 同步 */
  wifiOnlySync: boolean;
  /** 冲突策略 */
  conflictStrategy: ConflictStrategy;
  /** 已绑定设备列表 */
  devices: DeviceInfo[];
  /** 存档槽位 */
  saveSlots: SaveSlot[];
  /** 最后自动保存时间 */
  lastAutoSaveAt: number;
}

// ─────────────────────────────────────────────
// 模块E: 全局设置规则
// ─────────────────────────────────────────────

/** 完整设置状态 */
export interface AllSettings {
  /** 基础设置 */
  basic: BasicSettings;
  /** 音效设置 */
  audio: AudioSettings;
  /** 画面设置 */
  graphics: GraphicsSettings;
  /** 账号设置 */
  account: AccountSettings;
  /** 动画设置 */
  animation: AnimationSettings;
  /** 最后修改时间 */
  lastModifiedAt: number;
}

// ─────────────────────────────────────────────
// 模块F: 动画配置
// ─────────────────────────────────────────────

/** 缓动函数类型 */
export enum EasingType {
  Linear = 'linear',
  EaseIn = 'easeIn',
  EaseOut = 'easeOut',
  EaseInOut = 'easeInOut',
  Spring = 'spring',
}

/** 动画配置项 */
export interface AnimationConfig {
  /** 时长 (ms) */
  duration: number;
  /** 缓动函数 */
  easing: EasingType;
}

/** 过渡动画类型 */
export enum TransitionType {
  PanelOpen = 'panelOpen',
  PanelClose = 'panelClose',
  TabSwitch = 'tabSwitch',
  PageTransition = 'pageTransition',
  PopupAppear = 'popupAppear',
  SceneSwitch = 'sceneSwitch',
}

/** 状态动画类型 */
export enum StateAnimationType {
  ButtonHover = 'buttonHover',
  ButtonPress = 'buttonPress',
  ButtonRelease = 'buttonRelease',
  ToggleSwitch = 'toggleSwitch',
  CardSelect = 'cardSelect',
}

/** 反馈动画类型 */
export enum FeedbackAnimationType {
  ResourceFloat = 'resourceFloat',
  LevelUpGlow = 'levelUpGlow',
  ToastSlideIn = 'toastSlideIn',
  BattleResult = 'battleResult',
}

/** 动画设置状态 */
export interface AnimationSettings {
  /** 动画总开关 */
  enabled: boolean;
  /** 过渡动画配置 */
  transitions: Record<TransitionType, AnimationConfig>;
  /** 状态动画配置 */
  stateAnimations: Record<StateAnimationType, AnimationConfig>;
  /** 反馈动画配置 */
  feedbackAnimations: Record<FeedbackAnimationType, AnimationConfig>;
}

// ─────────────────────────────────────────────
// 持久化
// ─────────────────────────────────────────────

/** 设置持久化数据 */
export interface SettingsSaveData {
  /** 版本号 */
  version: string;
  /** 所有设置 */
  settings: AllSettings;
}
