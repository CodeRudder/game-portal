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
  /** 各触发类型的冷却结束时间 */
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

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.deps.eventBus.on('calendar:dayChanged', () => this.resetDaily());
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
    const suggestions: AdvisorSuggestion[] = [];

    // 资源溢出检测: 任何资源 > 80% 上限
    const overflowResource = this.findOverflowResource(snapshot);
    if (overflowResource && !this.isInCooldown('resource_overflow')) {
      suggestions.push(this.createSuggestion(
        'resource_overflow',
        '资源满仓，建议升级',
        `资源已满仓，建议升级仓库或消耗资源`,
        'high',
        '前往升级',
        'building',
      ));
    }

    // 资源告急检测: 任何资源 < 10% 上限
    const shortageResource = this.findShortageResource(snapshot);
    if (shortageResource && !this.isInCooldown('resource_shortage')) {
      suggestions.push(this.createSuggestion(
        'resource_shortage',
        '粮草告急，建议建造农田',
        '资源严重不足，建议立即建造或升级资源建筑',
        'high',
        '前往建造',
        'building',
      ));
    }

    // 建筑队列空闲
    if (snapshot.buildingQueueIdle && !this.isInCooldown('building_idle')) {
      suggestions.push(this.createSuggestion(
        'building_idle',
        '建造队列空闲，建议升级',
        '有建造队列空闲，建议安排建筑升级',
        'medium',
        '前往建造',
        'building',
      ));
    }

    // 武将可升级
    if (snapshot.upgradeableHeroes.length > 0 && !this.isInCooldown('hero_upgradeable')) {
      const heroId = snapshot.upgradeableHeroes[0];
      suggestions.push(this.createSuggestion(
        'hero_upgradeable',
        `武将${heroId}可升级`,
        `${heroId}已满足升级条件，建议立即升级`,
        'high',
        '前往升级',
        'hero',
        heroId,
      ));
    }

    // 科技队列空闲
    if (snapshot.techQueueIdle && !this.isInCooldown('tech_idle')) {
      suggestions.push(this.createSuggestion(
        'tech_idle',
        '科技研究空闲',
        '科技研究队列空闲，建议安排新的研究',
        'medium',
        '前往研究',
        'tech',
      ));
    }

    // 兵力满值
    if (snapshot.armyFull && !this.isInCooldown('army_full')) {
      suggestions.push(this.createSuggestion(
        'army_full',
        '兵力已满，建议出征',
        '兵力已达上限，建议出征或扩充兵营',
        'medium',
        '前往出征',
        'campaign',
      ));
    }

    // 限时NPC即将离开
    for (const npc of snapshot.leavingNpcs) {
      if (!this.isInCooldown('npc_leaving')) {
        suggestions.push(this.createSuggestion(
          'npc_leaving',
          `${npc.name}即将离开`,
          `限时NPC${npc.name}即将离开，请尽快交互`,
          'high',
          '前往查看',
          'npc',
          npc.id,
        ));
      }
    }

    // 新功能解锁
    for (const feature of snapshot.newFeatures) {
      if (!this.isInCooldown('new_feature_unlock')) {
        suggestions.push(this.createSuggestion(
          'new_feature_unlock',
          `点击了解${feature.name}`,
          `新功能${feature.name}已解锁，点击了解详情`,
          'low',
          '了解更多',
          'feature',
          feature.id,
        ));
      }
    }

    // 离线溢出
    if (snapshot.offlineOverflowPercent > 50 && !this.isInCooldown('offline_overflow')) {
      suggestions.push(this.createSuggestion(
        'offline_overflow',
        '建议升级仓库',
        '离线收益溢出较多，建议升级仓库容量',
        'medium',
        '前往升级',
        'building',
      ));
    }

    return suggestions;
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
      if (this.state.dailyCount >= ADVISOR_DAILY_LIMIT) {
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
      this.state.dailyCount++;
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
      .filter(([, until]) => Date.now() < until)
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
   */
  executeSuggestion(suggestionId: string): { success: boolean; reason?: string } {
    const idx = this.state.allSuggestions.findIndex(s => s.id === suggestionId);
    if (idx === -1) {
      return { success: false, reason: '建议不存在' };
    }

    const suggestion = this.state.allSuggestions[idx];
    this.state.allSuggestions.splice(idx, 1);

    this.deps.eventBus.emit('advisor:suggestionExecuted', {
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

    // 设置同类型冷却
    this.state.cooldowns[suggestion.triggerType] = Date.now() + ADVISOR_CLOSE_COOLDOWN_MS;

    return { success: true };
  }

  /**
   * 检查指定触发类型是否在冷却中
   */
  isInCooldown(triggerType: AdvisorTriggerType): boolean {
    const cooldownEnd = this.state.cooldowns[triggerType];
    if (!cooldownEnd) return false;
    return Date.now() < cooldownEnd;
  }

  /**
   * 序列化存档数据
   */
  serialize(): AdvisorSaveData {
    const cooldownRecords: AdvisorCooldownRecord[] = Object.entries(this.state.cooldowns)
      .filter(([, until]) => Date.now() < until)
      .map(([type, until]) => ({
        triggerType: type as AdvisorTriggerType,
        cooldownUntil: until,
      }));

    return {
      version: ADVISOR_SAVE_VERSION,
      cooldowns: cooldownRecords,
      dailyCount: this.state.dailyCount,
      lastDailyReset: this.state.lastDailyReset,
    };
  }

  /**
   * 从存档数据恢复
   */
  loadSaveData(data: AdvisorSaveData): void {
    this.state.dailyCount = data.dailyCount;
    this.state.lastDailyReset = data.lastDailyReset;
    this.state.cooldowns = {};
    for (const cd of data.cooldowns) {
      this.state.cooldowns[cd.triggerType] = cd.cooldownUntil;
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
