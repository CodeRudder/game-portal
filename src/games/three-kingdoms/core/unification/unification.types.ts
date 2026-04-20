/**
 * 核心层 — v19.0 天下一统(上) 类型定义
 *
 * 涵盖云存档、账号管理、画质管理、动画控制等子系统的类型。
 *
 * @module core/unification/unification.types
 */

// ─────────────────────────────────────────────
// 云存档系统
// ─────────────────────────────────────────────

/** 云同步状态 */
export enum CloudSyncStatus {
  Idle = 'idle',
  Syncing = 'syncing',
  Success = 'success',
  Failed = 'failed',
  Conflict = 'conflict',
}

/** 云同步结果 */
export interface CloudSyncResult {
  /** 同步状态 */
  status: CloudSyncStatus;
  /** 时间戳 */
  timestamp: number;
  /** 错误信息（失败时） */
  error?: string;
  /** 冲突的远程数据（冲突时） */
  remoteData?: CloudSavePayload;
}

/** 云存档载荷 */
export interface CloudSavePayload {
  /** 数据版本 */
  version: string;
  /** 加密后的存档数据（Base64） */
  encryptedData: string;
  /** 加密 IV（Base64） */
  iv: string;
  /** 客户端时间戳 */
  clientTimestamp: number;
  /** 设备 ID */
  deviceId: string;
  /** 数据哈希（完整性校验） */
  checksum: string;
}

/** 云同步配置 */
export interface CloudSyncConfig {
  /** 同步频率（毫秒，0 = 仅手动） */
  syncIntervalMs: number;
  /** 是否仅 WiFi 同步 */
  wifiOnly: boolean;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试间隔（毫秒） */
  retryIntervalMs: number;
  /** 同步超时（毫秒） */
  timeoutMs: number;
}

// ─────────────────────────────────────────────
// 账号系统
// ─────────────────────────────────────────────

/** 账号状态 */
export enum AccountStatus {
  /** 游客 */
  Guest = 'guest',
  /** 已绑定 */
  Bound = 'bound',
  /** 删除冷静期 */
  PendingDelete = 'pendingDelete',
  /** 已删除 */
  Deleted = 'deleted',
}

/** 账号删除请求 */
export interface AccountDeleteRequest {
  /** 请求时间 */
  requestedAt: number;
  /** 冷静期结束时间 */
  cooldownEndsAt: number;
  /** 是否已撤销 */
  revoked: boolean;
}

/** 绑定操作结果 */
export interface BindResult {
  /** 是否成功 */
  success: boolean;
  /** 绑定方式 */
  method: string;
  /** 错误信息 */
  error?: string;
  /** 是否获得首次绑定奖励 */
  rewardGranted: boolean;
}

/** 设备解绑结果 */
export interface DeviceUnbindResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 冷却结束时间（解绑失败时） */
  cooldownEndsAt?: number;
}

// ─────────────────────────────────────────────
// 画质管理
// ─────────────────────────────────────────────

/** 画质预设配置 */
export interface GraphicsPresetConfig {
  /** 粒子特效 */
  particleEffects: boolean;
  /** 实时阴影 */
  realtimeShadows: boolean;
  /** 水墨晕染 */
  inkWash: boolean;
  /** 帧率限制 */
  frameRateLimit: number;
  /** 抗锯齿 */
  antiAliasing: boolean;
  /** 是否显示高级选项 */
  showAdvancedOptions: boolean;
}

/** 画质检测结果 */
export interface QualityDetectionResult {
  /** 检测到的 CPU 核心数 */
  cpuCores: number;
  /** 检测到的内存（GB） */
  memoryGB: number;
  /** 推荐档位 */
  recommendedPreset: string;
  /** 检测时间 */
  detectedAt: number;
}

/** 画质切换事件 */
export interface GraphicsChangeEvent {
  /** 旧预设 */
  oldPreset: string;
  /** 新预设 */
  newPreset: string;
  /** 是否需要水墨过渡 */
  needsTransition: boolean;
}

// ─────────────────────────────────────────────
// 动画控制
// ─────────────────────────────────────────────

/** 动画播放状态 */
export enum AnimationPlayState {
  Idle = 'idle',
  Playing = 'playing',
  Paused = 'paused',
  Completed = 'completed',
}

/** 动画播放请求 */
export interface AnimationPlayRequest {
  /** 动画类型标识 */
  animationType: string;
  /** 目标元素 ID */
  targetId: string;
  /** 自定义时长（覆盖默认值） */
  duration?: number;
  /** 自定义缓动（覆盖默认值） */
  easing?: string;
  /** 完成回调 */
  onComplete?: () => void;
}

/** 动画播放实例 */
export interface AnimationInstance {
  /** 唯一 ID */
  id: string;
  /** 关联的播放请求 */
  request: AnimationPlayRequest;
  /** 播放状态 */
  state: AnimationPlayState;
  /** 已播放时间 (ms) */
  elapsed: number;
  /** 总时长 (ms) */
  totalDuration: number;
}

/** 动画控制器状态 */
export interface AnimationControllerState {
  /** 动画总开关 */
  enabled: boolean;
  /** 当前活跃动画数 */
  activeCount: number;
  /** 是否处于水墨过渡中 */
  inkTransitionActive: boolean;
}

// ─────────────────────────────────────────────
// 存档管理
// ─────────────────────────────────────────────

/** 存档操作类型 */
export enum SaveAction {
  AutoSave = 'autoSave',
  ManualSave = 'manualSave',
  Load = 'load',
  Delete = 'delete',
}

/** 存档操作结果 */
export interface SaveActionResult {
  /** 操作类型 */
  action: SaveAction;
  /** 槽位索引 */
  slotIndex: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/** 自动存档计时器状态 */
export interface AutoSaveTimerState {
  /** 距离上次自动保存的毫秒数 */
  elapsedSinceLastSave: number;
  /** 自动保存间隔（毫秒） */
  intervalMs: number;
  /** 是否启用 */
  enabled: boolean;
}
