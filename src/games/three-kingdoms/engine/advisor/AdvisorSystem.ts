/**
 * 引擎层 — 军师推荐系统
 *
 * 管理军师建议的触发、展示和执行：
 *   #14 军师建议触发规则 — 9种触发条件 + 优先级排序 + 冷却 + 每日15条上限
 *   #15 建议内容结构 — 标题≤20字 + 描述≤50字 + 行动按钮 + 置信度 + 过期时间
 *   #16 建议展示规则 — 最多3条 + 按优先级排序 + 执行后自动移除 + 关闭冷却30min
 *
 * @module engine/advisor/AdvisorSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  AdvisorTriggerType,
  AdvisorSuggestion,
  AdvisorConfidence,
  AdvisorDisplayState,
  AdvisorSaveData,
  AdvisorCooldownRecord,
} from '../../core/advisor';
import {
  ADVISOR_TRIGGER_PRIORITY,
  ADVISOR_MAX_DISPLAY,
  ADVISOR_DAILY_LIMIT,
  ADVISOR_CLOSE_COOLDOWN_MS,
  ADVISOR_SAVE_VERSION,
} from '../../core/advisor';
import { detectAllTriggers } from './AdvisorTriggerDetector';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 资源数据 */
export interface ResourceMap {
  grain: number;
  gold: number;
  troops: number;
  mandate: number;
}

/** NPC 信息 */
export interface LeavingNpcInfo {
  id: string;
  name: string;
  hoursLeft: number;
}

/** 新功能信息 */
export interface NewFeatureInfo {
  id: string;
  name: string;
}

/** 游戏状态快照（用于触发检测） */
export interface GameStateSnapshot {
  /** 当前资源 */
  resources: ResourceMap;
  /** 资源上限 */
  resourceCaps: ResourceMap;
  /** 建筑队列是否空闲 */
  buildingQueueIdle: boolean;
  /** 可升级武将ID列表 */
  upgradeableHeroes: string[];
  /** 科技队列是否空闲 */
  techQueueIdle: boolean;
  /** 兵力是否满值 */
  armyFull: boolean;
  /** 即将离开的NPC列表 */
  leavingNpcs: LeavingNpcInfo[];
  /** 新解锁功能列表 */
  newFeatures: NewFeatureInfo[];
  /** 离线溢出百分比 (0~100) */
  offlineOverflowPercent: number;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 建议过期时间（毫秒）= 1小时 */
const SUGGESTION_EXPIRE_MS = 60 * 60 * 1000;

/** 建议ID计数器 */
let suggestionCounter = 0;

/** 生成建议ID */
function nextSuggestionId(): string {
  return `adv_${++suggestionCounter}_${Date.now()}`;
}

/** 获取今天日期字符串 */
function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────
// 内部状态
// ─────────────────────────────────────────────

/** 内部运行状态 */
interface AdvisorInternalState {
  /** 所有活跃建议（含未展示的） */
  allSuggestions: AdvisorSuggestion[];
  /** 今日已生成建议数 */
  dailyCount: number;
  /** 上次每日重置日期 */
  lastDailyReset: string;
  /** 各触发类型的冷却结束时间（until 模式） */
  cooldowns: Record<string, number>;
}

// ─────────────────────────────────────────────
// AdvisorSystem 类
// ─────────────────────────────────────────────

/**
 * 军师推荐系统
 *
 * 检测游戏状态变化，生成建议，管理展示和冷却。
 */
export class AdvisorSystem implements ISubsystem {
  readonly name = 'advisor';

  private deps!: ISystemDeps;
  private state: AdvisorInternalState = this.createInitialState();

  // ─── 生命周期 ───────────────────────────

  /**
   * FIX-508: init 增加 deps.eventBus null 防护
   */
  init(deps: ISystemDeps): void {
    this.deps = deps;
    // FIX-508: 可选链防护 eventBus 为 null/undefined
    this.deps.eventBus?.on('calendar:dayChanged', () => this.resetDaily());
  }

  update(_dt: number): void {
    // 清理过期建议
    this.cleanExpired();
  }

  getState(): AdvisorInternalState {
    return { ...this.state };
  }

  reset(): void {
    this.state = this.createInitialState();
    suggestionCounter = 0;
  }

  // ─── 核心 API ───────────────────────────

  /**
   * 检测游戏状态并返回所有匹配的触发建议（不修改内部状态）(#14)
   *
   * @param snapshot - 当前游戏状态快照
   * @returns 匹配的建议列表
   */
  detectTriggers(snapshot: GameStateSnapshot): AdvisorSuggestion[] {
    return detectAllTriggers(snapshot, this.state, (trigger, title, desc, priority, action, target, targetId) =>
      this.createSuggestion(trigger, title, desc, priority as AdvisorConfidence, action, target, targetId));
  }

  /**
   * 根据快照更新建议列表（修改内部状态）(#16)
   *
   * @param snapshot - 当前游戏状态快照
   */
  updateSuggestions(snapshot: GameStateSnapshot): void {
    this.checkDailyReset();

    const candidates = this.detectTriggers(snapshot);

    for (const suggestion of candidates) {
      // 检查每日上限
      // FIX-505: NaN 防护 — 确保 dailyCount 为有限数
      const currentCount = Number.isFinite(this.state.dailyCount) ? this.state.dailyCount : 0;
      if (currentCount >= ADVISOR_DAILY_LIMIT) {
        break;
      }

      // 检查冷却
      if (this.isInCooldown(suggestion.triggerType)) {
        continue;
      }

      // 检查是否已有同类型建议
      if (this.state.allSuggestions.some(s => s.triggerType === suggestion.triggerType)) {
        continue;
      }

      this.state.allSuggestions.push(suggestion);
      this.state.dailyCount = currentCount + 1;
    }
  }

  /**
   * 获取当前可见建议 (#16)
   * 最多3条，按优先级排序
   */
  getDisplayedSuggestions(): AdvisorSuggestion[] {
    this.cleanExpired();
    return [...this.state.allSuggestions]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, ADVISOR_MAX_DISPLAY);
  }

  /**
   * 获取展示状态 (#16)
   */
  getDisplayState(): AdvisorDisplayState {
    this.checkDailyReset();
    const cooldownRecords: AdvisorCooldownRecord[] = Object.entries(this.state.cooldowns)
      .filter(([, until]) => Number.isFinite(until) && Date.now() < until)
      .map(([type, until]) => ({
        triggerType: type as AdvisorTriggerType,
        cooldownUntil: until,
      }));

    return {
      displayedSuggestions: this.getDisplayedSuggestions(),
      dailyCount: this.state.dailyCount,
      lastDailyReset: this.state.lastDailyReset,
      cooldowns: cooldownRecords,
    };
  }

  /**
   * 执行建议 (#16)
   * 执行后自动移除
   *
   * FIX-509: 增加 deps 未初始化防护
   */
  executeSuggestion(suggestionId: string): { success: boolean; reason?: string } {
    const idx = this.state.allSuggestions.findIndex(s => s.id === suggestionId);
    if (idx === -1) {
      return { success: false, reason: '建议不存在' };
    }

    const suggestion = this.state.allSuggestions[idx];
    this.state.allSuggestions.splice(idx, 1);

    // FIX-509: deps 未初始化时仅移除建议，不 emit 事件
    this.deps?.eventBus?.emit('advisor:suggestionExecuted', {
      id: suggestionId,
      triggerType: suggestion.triggerType,
    });

    return { success: true };
  }

  /**
   * 关闭建议 (#16)
   * 同类型进入30分钟冷却
   */
  dismissSuggestion(suggestionId: string): { success: boolean; reason?: string } {
    const idx = this.state.allSuggestions.findIndex(s => s.id === suggestionId);
    if (idx === -1) {
      return { success: false, reason: '建议不存在' };
    }

    const suggestion = this.state.allSuggestions[idx];
    this.state.allSuggestions.splice(idx, 1);

    // 设置同类型冷却（until 模式：存储冷却结束时间戳）
    this.state.cooldowns[suggestion.triggerType] = Date.now() + ADVISOR_CLOSE_COOLDOWN_MS;

    return { success: true };
  }

  /**
   * 检查指定触发类型是否在冷却中
   *
   * FIX-506: 增加 NaN 防护
   */
  isInCooldown(triggerType: AdvisorTriggerType): boolean {
    const cooldownEnd = this.state.cooldowns[triggerType];
    // FIX-506: NaN 是 truthy 但 !Number.isFinite(NaN) 为 true
    if (!cooldownEnd || !Number.isFinite(cooldownEnd)) return false;
    return Date.now() < cooldownEnd;
  }

  /**
   * 序列化存档数据
   *
   * FIX-502: 增加 allSuggestions 保存
   */
  serialize(): AdvisorSaveData {
    const cooldownRecords: AdvisorCooldownRecord[] = Object.entries(this.state.cooldowns)
      .filter(([, until]) => Number.isFinite(until) && Date.now() < until)
      .map(([type, until]) => ({
        triggerType: type as AdvisorTriggerType,
        cooldownUntil: until,
      }));

    return {
      version: ADVISOR_SAVE_VERSION,
      cooldowns: cooldownRecords,
      dailyCount: this.state.dailyCount,
      lastDailyReset: this.state.lastDailyReset,
      // FIX-502: 保存活跃建议列表
      suggestions: this.state.allSuggestions.map(s => ({ ...s })),
    };
  }

  /**
   * 从存档数据恢复
   *
   * FIX-503: null/undefined 防护
   * FIX-504: Infinity cooldownUntil 防护
   * FIX-505: NaN dailyCount 防护
   * FIX-502: 恢复 allSuggestions
   */
  loadSaveData(data: AdvisorSaveData): void {
    // FIX-503: null/undefined 防护
    if (!data) return;

    // FIX-505: NaN dailyCount 防护
    const dailyCount = data.dailyCount;
    this.state.dailyCount = (Number.isFinite(dailyCount) && dailyCount >= 0) ? dailyCount : 0;

    this.state.lastDailyReset = data.lastDailyReset || getTodayStr();
    this.state.cooldowns = {};

    // FIX-504: Infinity cooldownUntil 防护
    const cooldowns = data.cooldowns || [];
    for (const cd of cooldowns) {
      if (cd && cd.triggerType && Number.isFinite(cd.cooldownUntil) && cd.cooldownUntil > 0) {
        this.state.cooldowns[cd.triggerType] = cd.cooldownUntil;
      }
    }

    // FIX-502: 恢复 allSuggestions，过滤过期项
    const savedSuggestions = data.suggestions;
    if (Array.isArray(savedSuggestions)) {
      const now = Date.now();
      this.state.allSuggestions = savedSuggestions.filter(
        s => s && s.id && (s.expiresAt == null || s.expiresAt > now),
      );
    } else {
      this.state.allSuggestions = [];
    }
  }

  // ─── 内部方法 ───────────────────────────

  /** 创建初始状态 */
  private createInitialState(): AdvisorInternalState {
    return {
      allSuggestions: [],
      dailyCount: 0,
      lastDailyReset: getTodayStr(),
      cooldowns: {},
    };
  }

  /** 创建建议对象 */
  private createSuggestion(
    triggerType: AdvisorTriggerType,
    title: string,
    description: string,
    confidence: AdvisorConfidence,
    actionLabel: string,
    actionTarget: string,
    relatedId?: string,
  ): AdvisorSuggestion {
    return {
      id: nextSuggestionId(),
      triggerType,
      title: title.slice(0, 20),
      description: description.slice(0, 50),
      actionLabel,
      actionTarget,
      confidence,
      priority: ADVISOR_TRIGGER_PRIORITY[triggerType],
      createdAt: Date.now(),
      expiresAt: Date.now() + SUGGESTION_EXPIRE_MS,
      ...(relatedId ? { relatedId } : {}),
    };
  }

  /** 查找溢出资源（>80%上限） */
  private findOverflowResource(snapshot: GameStateSnapshot): string | null {
    const keys: (keyof ResourceMap)[] = ['grain', 'gold', 'troops', 'mandate'];
    for (const key of keys) {
      const cap = snapshot.resourceCaps[key];
      if (cap > 0 && snapshot.resources[key] / cap > 0.8) {
        return key;
      }
    }
    return null;
  }

  /** 查找告急资源（<10%上限） */
  private findShortageResource(snapshot: GameStateSnapshot): string | null {
    const keys: (keyof ResourceMap)[] = ['grain', 'gold', 'troops', 'mandate'];
    for (const key of keys) {
      const cap = snapshot.resourceCaps[key];
      if (cap > 0 && snapshot.resources[key] / cap < 0.1) {
        return key;
      }
    }
    return null;
  }

  /** 清理过期建议 */
  private cleanExpired(): void {
    const now = Date.now();
    this.state.allSuggestions = this.state.allSuggestions.filter(
      s => s.expiresAt == null || s.expiresAt > now,
    );
  }

  /** 检查每日重置 */
  private checkDailyReset(): void {
    const today = getTodayStr();
    if (this.state.lastDailyReset !== today) {
      this.state.dailyCount = 0;
      this.state.lastDailyReset = today;
    }
  }

  /** 每日重置（由日历事件触发） */
  private resetDaily(): void {
    this.state.dailyCount = 0;
    this.state.lastDailyReset = getTodayStr();
  }
}
