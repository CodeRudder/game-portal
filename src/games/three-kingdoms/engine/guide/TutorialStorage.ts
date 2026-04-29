/**
 * 引擎层 — 引导状态存储
 *
 * 负责引导进度的持久化存储、断点续引和重置：
 *   #8  引导进度存储 — localStorage实时保存
 *   #9  冲突解决 — 取completed_steps并集(最大进度)
 *   #13 引导重玩 — 重玩次数存储
 *   #17 首次启动检测 — isFirstLaunch标记
 *
 * @module engine/guide/TutorialStorage
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  TutorialSaveData,
  StoryEventId,
  TutorialStepId,
  TutorialPhase,
} from '../../core/guide';
import { TUTORIAL_SAVE_VERSION } from '../../core/guide';
import type { TutorialStateMachine } from './TutorialStateMachine';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** localStorage 存储键 */
const STORAGE_KEY = 'three-kingdoms-tutorial-save';

/** 首次启动标记键 */
const FIRST_LAUNCH_KEY = 'three-kingdoms-first-launch';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 存储操作结果 */
export interface StorageResult {
  success: boolean;
  reason?: string;
}

/** 首次启动检测结果 */
export interface FirstLaunchResult {
  isFirstLaunch: boolean;
  /** 之前的存档数据（如有） */
  existingData: TutorialSaveData | null;
}

// ─────────────────────────────────────────────
// TutorialStorage 类
// ─────────────────────────────────────────────

/**
 * 引导状态存储
 *
 * 管理 TutorialSaveData 的持久化、恢复和冲突解决。
 * 使用 localStorage 作为底层存储。
 */
export class TutorialStorage implements ISubsystem {
  readonly name = 'tutorial-storage';

  private deps!: ISystemDeps;
  private _stateMachine!: TutorialStateMachine;

  /** 内存回退存储 — localStorage不可用时使用 */
  private memoryStore: Map<string, string> = new Map();
  /** 是否使用内存回退 */
  private usingMemoryFallback: boolean = false;

  // ─── 依赖注入 ───────────────────────────

  /** 注入状态机 */
  setStateMachine(sm: TutorialStateMachine): void {
    this._stateMachine = sm;
  }

  // ─── 生命周期 ───────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    // 检测localStorage是否可用
    this.detectStorageAvailability();
  }

  update(_dt: number): void {
    // 存储层无需每帧更新，由调用方主动保存
  }

  getState(): { lastSaveTime: number | null } {
    return { lastSaveTime: this._lastSaveTime };
  }

  reset(): void {
    this._lastSaveTime = null;
  }

  // ─── 保存 API (#8) ───────────────────────

  /**
   * 保存当前引导进度到 localStorage
   */
  save(): StorageResult {
    try {
      const data = this._stateMachine.serialize();
      const json = JSON.stringify(data);
      this.storageSet(STORAGE_KEY, json);
      this._lastSaveTime = Date.now();
      return { success: true };
    } catch (e) {
      return {
        success: false,
        reason: `保存失败: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  /**
   * 从 localStorage 加载引导进度
   */
  load(): StorageResult & { data?: TutorialSaveData } {
    try {
      const json = this.storageGet(STORAGE_KEY);
      if (!json) {
        return { success: true, data: undefined };
      }
      const data = JSON.parse(json) as TutorialSaveData;
      if (!this.validateSaveData(data)) {
        return { success: false, reason: '存档数据格式无效' };
      }
      return { success: true, data };
    } catch (e) {
      return {
        success: false,
        reason: `加载失败: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  /**
   * 恢复引导进度到状态机（断点续引）
   */
  restore(): StorageResult {
    const result = this.load();
    if (!result.success) {
      return { success: false, reason: result.reason };
    }
    if (!result.data) {
      // 无存档数据，不恢复
      return { success: true };
    }
    this._stateMachine.loadSaveData(result.data);
    return { success: true };
  }

  /**
   * 实时保存（步骤完成/状态转换后调用）
   */
  autoSave(): StorageResult {
    return this.save();
  }

  // ─── 冲突解决 (#9) ───────────────────────

  /**
   * 解决跨设备同步冲突
   *
   * 策略：取 completed_steps 并集 + completed_events 并集（最大进度）
   *
   * @param localData - 本地存档
   * @param remoteData - 远程存档
   * @returns 合并后的存档
   */
  resolveConflict(
    localData: TutorialSaveData,
    remoteData: TutorialSaveData,
  ): TutorialSaveData {
    return this._stateMachine.resolveConflict(localData, remoteData);
  }

  /**
   * 合并远程数据到本地
   */
  mergeRemoteData(remoteData: TutorialSaveData): StorageResult {
    const localResult = this.load();
    const localData = localResult.data ?? this.createEmptySaveData();
    const merged = this.resolveConflict(localData, remoteData);
    this._stateMachine.loadSaveData(merged);
    return this.save();
  }

  // ─── 重置 API (#D) ───────────────────────

  /**
   * 全量重置引导进度
   */
  fullReset(): StorageResult {
    try {
      this.storageRemove(STORAGE_KEY);
      this._stateMachine.reset();
      this._lastSaveTime = null;
      return { success: true };
    } catch (e) {
      return {
        success: false,
        reason: `重置失败: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  /**
   * 仅重置引导步骤（保留剧情完成记录）
   */
  resetStepsOnly(): StorageResult {
    const currentData = this._stateMachine.serialize();
    const resetData: TutorialSaveData = {
      ...currentData,
      currentPhase: 'not_started',
      completedSteps: [],
      completedEvents: [],
      currentStepId: null,
      currentSubStepIndex: 0,
      tutorialStartTime: null,
      transitionLogs: [],
      protectionStartTime: null,
    };
    this._stateMachine.loadSaveData(resetData);
    return this.save();
  }

  // ─── 首次启动检测 (#17) ───────────────────

  /**
   * 检测是否首次启动
   */
  detectFirstLaunch(): FirstLaunchResult {
    const launched = this.storageGet(FIRST_LAUNCH_KEY);
    if (launched === null) {
      // 从未启动过
      return { isFirstLaunch: true, existingData: null };
    }
    const loadResult = this.load();
    return {
      isFirstLaunch: false,
      existingData: loadResult.data ?? null,
    };
  }

  /**
   * 标记已启动（首次启动流程完成后调用）
   */
  markLaunched(): void {
    this.storageSet(FIRST_LAUNCH_KEY, Date.now().toString());
  }

  /**
   * 清除首次启动标记（调试用）
   */
  clearLaunchMark(): void {
    this.storageRemove(FIRST_LAUNCH_KEY);
  }

  // ─── 查询 API ───────────────────────────

  /**
   * 获取上次保存时间
   */
  getLastSaveTime(): number | null {
    return this._lastSaveTime;
  }

  /**
   * 是否有存档数据
   */
  hasSaveData(): boolean {
    return this.storageGet(STORAGE_KEY) !== null;
  }

  /**
   * 获取存档大小（字节估算）
   */
  getSaveDataSize(): number {
    const json = this.storageGet(STORAGE_KEY);
    return json ? new Blob([json]).size : 0;
  }

  // ─── 内部方法 ───────────────────────────

  private _lastSaveTime: number | null = null;

  /** 检测localStorage是否可用 */
  private detectStorageAvailability(): void {
    try {
      const testKey = '__tk_storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      this.usingMemoryFallback = false;
    } catch {
      this.usingMemoryFallback = true;
    }
  }

  /** 统一存储读取 — 自动降级到内存 */
  private storageGet(key: string): string | null {
    if (this.usingMemoryFallback) {
      return this.memoryStore.get(key) ?? null;
    }
    try {
      return localStorage.getItem(key);
    } catch {
      // 运行时降级
      this.usingMemoryFallback = true;
      return this.memoryStore.get(key) ?? null;
    }
  }

  /** 统一存储写入 — 自动降级到内存 */
  private storageSet(key: string, value: string): boolean {
    if (this.usingMemoryFallback) {
      this.memoryStore.set(key, value);
      return true;
    }
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      // 运行时降级
      this.usingMemoryFallback = true;
      this.memoryStore.set(key, value);
      return true;
    }
  }

  /** 统一存储删除 — 自动降级到内存 */
  private storageRemove(key: string): void {
    if (this.usingMemoryFallback) {
      this.memoryStore.delete(key);
    } else {
      try {
        localStorage.removeItem(key);
      } catch {
        this.usingMemoryFallback = true;
        this.memoryStore.delete(key);
      }
    }
  }

  /** 是否正在使用内存回退 */
  isUsingMemoryFallback(): boolean {
    return this.usingMemoryFallback;
  }

  /** 验证存档数据格式 */
  private validateSaveData(data: TutorialSaveData): boolean {
    if (!data || typeof data !== 'object') return false;
    if (typeof data.version !== 'number') return false;
    if (!Array.isArray(data.completedSteps)) return false;
    if (!Array.isArray(data.completedEvents)) return false;
    if (typeof data.currentPhase !== 'string') return false;
    return true;
  }

  /** 创建空存档数据 */
  private createEmptySaveData(): TutorialSaveData {
    return {
      version: TUTORIAL_SAVE_VERSION,
      currentPhase: 'not_started',
      completedSteps: [],
      completedEvents: [],
      currentStepId: null,
      currentSubStepIndex: 0,
      tutorialStartTime: null,
      transitionLogs: [],
      dailyReplayCount: 0,
      lastReplayDate: '',
      protectionStartTime: null,
    };
  }
}
