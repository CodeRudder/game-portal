/**
 * 引擎层 — 首次启动检测与新手保护
 *
 * 管理首次启动流程（语言检测、画质检测、权限申请）和新手保护机制：
 *   #17 首次启动流程 — 语言检测+画质检测+权限申请+自动触发核心引导
 *   #18 新手保护机制 — 前30分钟仅正面事件+资源消耗减半+战斗难度降低
 *
 * @module engine/guide/FirstLaunchDetector
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  GraphicsQuality,
  PermissionType,
  FirstLaunchConfig,
  FirstLaunchDetection,
  NewbieProtectionConfig,
} from '../../core/guide';
import {
  DEFAULT_NEWBIE_PROTECTION,
  NEWBIE_PROTECTION_DURATION_MS,
} from '../../core/guide';
import type { TutorialStateMachine } from './TutorialStateMachine';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 首次启动流程步骤 */
export type FirstLaunchStep =
  | 'detect_language'     // 语言检测
  | 'detect_graphics'     // 画质检测
  | 'request_permissions' // 权限申请
  | 'trigger_tutorial'    // 触发引导
  | 'completed'           // 完成
  | 'skipped';            // 跳过（非首次启动）

/** 首次启动流程状态 */
export interface FirstLaunchFlowState {
  /** 当前步骤 */
  currentStep: FirstLaunchStep;
  /** 检测到的语言 */
  detectedLanguage: string;
  /** 推荐画质 */
  recommendedQuality: GraphicsQuality;
  /** 权限状态 */
  permissionStatus: Record<PermissionType, boolean>;
  /** 是否首次启动 */
  isFirstLaunch: boolean;
}

/** 设备硬件信息（用于画质推荐） */
export interface DeviceHardwareInfo {
  /** CPU核心数 */
  cpuCores: number;
  /** 内存大小（GB） */
  memoryGB: number;
  /** GPU信息（可选） */
  gpuRenderer: string;
  /** 设备像素比 */
  devicePixelRatio: number;
}

/** 新手保护状态 */
export interface NewbieProtectionState {
  /** 是否激活 */
  active: boolean;
  /** 保护开始时间戳 */
  startTime: number | null;
  /** 保护时长（毫秒） */
  durationMs: number;
  /** 剩余时间（毫秒） */
  remainingMs: number;
  /** 资源消耗折扣 */
  resourceCostDiscount: number;
  /** 战斗难度系数 */
  battleDifficultyFactor: number;
  /** 是否仅正面事件 */
  positiveEventsOnly: boolean;
}

/** 语言检测回调 */
export type LanguageDetector = () => string;

/** 硬件信息获取回调 */
export type HardwareInfoProvider = () => DeviceHardwareInfo;

/** 权限请求回调 */
export type PermissionRequester = (permissions: PermissionType[]) => Promise<Record<PermissionType, boolean>>;

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认语言 */
const DEFAULT_LANGUAGE = 'zh-CN';

/** 默认首次启动配置 */
const DEFAULT_FIRST_LAUNCH_CONFIG: FirstLaunchConfig = {
  defaultLanguage: DEFAULT_LANGUAGE,
  recommendedQuality: 'medium',
  requiredPermissions: ['storage', 'network'],
};

/** 画质推荐阈值 */
const QUALITY_THRESHOLDS: {
  low: { minCores: number; minMemory: number };
  medium: { minCores: number; minMemory: number };
  high: { minCores: number; minMemory: number };
} = {
  low: { minCores: 2, minMemory: 2 },
  medium: { minCores: 4, minMemory: 4 },
  high: { minCores: 8, minMemory: 8 },
};

// ─────────────────────────────────────────────
// 内部状态
// ─────────────────────────────────────────────

/** 首次启动检测器内部状态 */
interface FirstLaunchDetectorInternalState {
  /** 流程状态 */
  flowState: FirstLaunchFlowState;
  /** 新手保护配置 */
  protectionConfig: NewbieProtectionConfig;
  /** 是否已完成首次启动流程 */
  launchCompleted: boolean;
}

// ─────────────────────────────────────────────
// FirstLaunchDetector 类
// ─────────────────────────────────────────────

/**
 * 首次启动检测器
 *
 * 管理首次启动流程和新手保护机制。
 */
export class FirstLaunchDetector implements ISubsystem {
  readonly name = 'first-launch';

  private deps!: ISystemDeps;
  private _stateMachine!: TutorialStateMachine;
  private state: FirstLaunchDetectorInternalState = this.createInitialState();

  // 外部回调（由UI层注入）
  private languageDetector: LanguageDetector = () => DEFAULT_LANGUAGE;
  private hardwareInfoProvider: HardwareInfoProvider = () => ({
    cpuCores: 4,
    memoryGB: 4,
    gpuRenderer: '',
    devicePixelRatio: 1,
  });

  // ─── 依赖注入 ───────────────────────────

  /** 注入状态机 */
  setStateMachine(sm: TutorialStateMachine): void {
    this._stateMachine = sm;
  }

  /** 注入语言检测回调 */
  setLanguageDetector(detector: LanguageDetector): void {
    this.languageDetector = detector;
  }

  /** 注入硬件信息获取回调 */
  setHardwareInfoProvider(provider: HardwareInfoProvider): void {
    this.hardwareInfoProvider = provider;
  }

  // ─── 生命周期 ───────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 新手保护过期由 TutorialStateMachine 处理
  }

  getState(): FirstLaunchDetectorInternalState {
    return { ...this.state };
  }

  reset(): void {
    this.state = this.createInitialState();
  }

  // ─── 首次启动检测 API (#17) ───────────────

  /**
   * 检测是否首次启动
   *
   * 通过 TutorialStateMachine 的状态判断是否首次启动。
   */
  detectFirstLaunch(): FirstLaunchDetection {
    const isFirstLaunch = this._stateMachine.isFirstLaunch();

    const detectedLanguage = this.detectLanguage();
    const recommendedQuality = this.detectGraphicsQuality();

    const permissionStatus: Record<PermissionType, boolean> = {
      storage: false,
      network: false,
      notification: false,
      location: false,
    };

    this.state.flowState = {
      currentStep: isFirstLaunch ? 'detect_language' : 'skipped',
      detectedLanguage,
      recommendedQuality,
      permissionStatus,
      isFirstLaunch,
    };

    const detection: FirstLaunchDetection = {
      isFirstLaunch,
      detectedLanguage,
      recommendedQuality,
      permissionStatus,
    };

    this.deps.eventBus.emit('tutorial:firstLaunchDetected', detection);

    return detection;
  }

  /**
   * 执行首次启动流程
   *
   * 依次执行：语言检测→画质检测→权限申请→触发引导
   */
  async executeFirstLaunchFlow(
    permissionRequester?: PermissionRequester,
  ): Promise<FirstLaunchFlowState> {
    // 重新检测是否首次启动（状态机可能已变化）
    const isFirstLaunch = this._stateMachine.isFirstLaunch();
    this.state.flowState.isFirstLaunch = isFirstLaunch;

    if (!isFirstLaunch) {
      this.state.flowState.currentStep = 'skipped';
      return { ...this.state.flowState };
    }

    // 步骤1: 语言检测
    this.state.flowState.currentStep = 'detect_language';
    this.state.flowState.detectedLanguage = this.detectLanguage();

    // 步骤2: 画质检测
    this.state.flowState.currentStep = 'detect_graphics';
    this.state.flowState.recommendedQuality = this.detectGraphicsQuality();

    // 步骤3: 权限申请
    this.state.flowState.currentStep = 'request_permissions';
    if (permissionRequester) {
      this.state.flowState.permissionStatus = await permissionRequester(
        DEFAULT_FIRST_LAUNCH_CONFIG.requiredPermissions,
      );
    } else {
      // 无权限请求回调时，标记默认权限为已授权
      for (const perm of DEFAULT_FIRST_LAUNCH_CONFIG.requiredPermissions) {
        this.state.flowState.permissionStatus[perm] = true;
      }
    }

    // 步骤4: 触发引导
    this.state.flowState.currentStep = 'trigger_tutorial';
    this.triggerTutorial();

    // 完成
    this.state.flowState.currentStep = 'completed';
    this.state.launchCompleted = true;

    return { ...this.state.flowState };
  }

  /**
   * 非首次启动处理
   */
  handleReturningUser(): void {
    this._stateMachine.enterAsReturning();
    this.state.flowState.currentStep = 'skipped';
    this.state.flowState.isFirstLaunch = false;
    this.state.launchCompleted = true;
  }

  /**
   * 触发引导
   */
  triggerTutorial(): void {
    this._stateMachine.transition('first_enter');
  }

  // ─── 新手保护 API (#18) ───────────────────

  /**
   * 获取新手保护状态
   */
  getProtectionState(): NewbieProtectionState {
    const isActive = this._stateMachine.isNewbieProtectionActive();
    const remainingMs = this._stateMachine.getProtectionRemainingMs();
    const config = this.state.protectionConfig;

    return {
      active: isActive,
      startTime: null,
      durationMs: config.durationMs,
      remainingMs,
      resourceCostDiscount: config.resourceCostDiscount,
      battleDifficultyFactor: config.battleDifficultyFactor,
      positiveEventsOnly: config.positiveEventsOnly,
    };
  }

  /**
   * 是否处于新手保护期
   */
  isNewbieProtectionActive(): boolean {
    return this._stateMachine.isNewbieProtectionActive();
  }

  /**
   * 获取资源消耗折扣
   *
   * 新手保护期内返回折扣系数，否则返回1（无折扣）。
   */
  getResourceCostDiscount(): number {
    if (this.isNewbieProtectionActive()) {
      return this.state.protectionConfig.resourceCostDiscount;
    }
    return 1;
  }

  /**
   * 获取战斗难度系数
   *
   * 新手保护期内返回降低的难度系数，否则返回1（正常难度）。
   */
  getBattleDifficultyFactor(): number {
    if (this.isNewbieProtectionActive()) {
      return this.state.protectionConfig.battleDifficultyFactor;
    }
    return 1;
  }

  /**
   * 是否仅允许正面事件
   *
   * 新手保护期内仅允许正面事件触发。
   */
  isPositiveEventsOnly(): boolean {
    if (this.isNewbieProtectionActive()) {
      return this.state.protectionConfig.positiveEventsOnly;
    }
    return false;
  }

  /**
   * 应用资源消耗折扣
   *
   * @param originalCost - 原始消耗
   * @returns 折扣后的消耗
   */
  applyResourceDiscount(originalCost: number): number {
    const discount = this.getResourceCostDiscount();
    return Math.floor(originalCost * discount);
  }

  /**
   * 应用战斗难度调整
   *
   * @param originalDifficulty - 原始难度值
   * @returns 调整后的难度值
   */
  applyBattleDifficulty(originalDifficulty: number): number {
    const factor = this.getBattleDifficultyFactor();
    return originalDifficulty * factor;
  }

  // ─── 查询 API ───────────────────────────

  /**
   * 获取首次启动流程状态
   */
  getFlowState(): FirstLaunchFlowState {
    return { ...this.state.flowState };
  }

  /**
   * 是否已完成首次启动流程
   */
  isLaunchCompleted(): boolean {
    return this.state.launchCompleted;
  }

  /**
   * 获取首次启动配置
   */
  getConfig(): FirstLaunchConfig {
    return { ...DEFAULT_FIRST_LAUNCH_CONFIG };
  }

  // ─── 内部方法 ───────────────────────────

  /** 创建初始状态 */
  private createInitialState(): FirstLaunchDetectorInternalState {
    return {
      flowState: {
        currentStep: 'detect_language',
        detectedLanguage: DEFAULT_LANGUAGE,
        recommendedQuality: 'medium',
        permissionStatus: {
          storage: false,
          network: false,
          notification: false,
          location: false,
        },
        isFirstLaunch: true,
      },
      protectionConfig: { ...DEFAULT_NEWBIE_PROTECTION },
      launchCompleted: false,
    };
  }

  /** 检测语言 (#17) */
  private detectLanguage(): string {
    return this.languageDetector();
  }

  /** 检测画质 (#17) */
  private detectGraphicsQuality(): GraphicsQuality {
    const hw = this.hardwareInfoProvider();

    if (
      hw.cpuCores >= QUALITY_THRESHOLDS.high.minCores &&
      hw.memoryGB >= QUALITY_THRESHOLDS.high.minMemory
    ) {
      return 'high';
    }

    if (
      hw.cpuCores >= QUALITY_THRESHOLDS.medium.minCores &&
      hw.memoryGB >= QUALITY_THRESHOLDS.medium.minMemory
    ) {
      return 'medium';
    }

    return 'low';
  }
}
