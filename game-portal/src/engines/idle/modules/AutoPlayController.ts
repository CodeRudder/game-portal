/**
 * AutoPlayController — 放置游戏自动操作控制器
 *
 * 管理自动操作规则（如自动升级建筑、自动招募武将），
 * 支持启用/禁用单条规则、全局自动操作开关、冷却时间控制、
 * 以及自动操作执行事件通知。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 事件驱动，支持 UI 层监听自动操作状态变化
 * - 完整的存档/读档支持（含校验）
 * - condition 和 action 为回调函数，运行时注入
 *
 * @module engines/idle/modules/AutoPlayController
 */

// ============================================================
// 类型定义
// ============================================================

/** 自动操作规则 */
export interface AutoPlayRule {
  /** 规则唯一标识 */
  id: string;
  /** 规则名称（用于显示） */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** 冷却时间（毫秒） */
  cooldownMs: number;
  /** 上次执行时间戳 */
  lastExecutedAt: number;
  /** 执行条件（返回 true 时方可执行） */
  condition: () => boolean;
  /** 执行动作 */
  action: () => void;
}

/** 自动操作控制器状态（用于存档） */
export interface AutoPlayState {
  /** 全局自动操作开关 */
  globalEnabled: boolean;
  /** 规则状态映射 */
  rules: Record<string, {
    /** 是否启用 */
    enabled: boolean;
    /** 上次执行时间戳 */
    lastExecutedAt: number;
  }>;
}

/** 自动操作事件 */
export type AutoPlayEvent =
  | { type: 'rule_executed'; data: { ruleId: string; ruleName: string } }
  | { type: 'rule_enabled'; data: { ruleId: string } }
  | { type: 'rule_disabled'; data: { ruleId: string } }
  | { type: 'global_toggled'; data: { enabled: boolean } };

/** 事件监听器类型 */
export type AutoPlayEventListener = (event: AutoPlayEvent) => void;

// ============================================================
// AutoPlayController 实现
// ============================================================

/**
 * 自动操作控制器 — 管理自动操作规则与执行
 *
 * @example
 * ```typescript
 * const ctrl = new AutoPlayController();
 * ctrl.addRule({
 *   id: 'auto_upgrade',
 *   name: '自动升级',
 *   enabled: true,
 *   cooldownMs: 1000,
 *   condition: () => gold >= 100,
 *   action: () => { upgrade(); gold -= 100; },
 * });
 * ctrl.setGlobalEnabled(true);
 * ctrl.update(Date.now()); // 检查并执行就绪规则
 * ```
 */
export class AutoPlayController {
  /** 已注册的规则映射 */
  private readonly rules: Map<string, AutoPlayRule> = new Map();
  /** 全局自动操作开关 */
  private globalEnabled: boolean = false;
  /** 事件监听器列表 */
  private readonly listeners: AutoPlayEventListener[] = [];

  // ============================================================
  // 初始化
  // ============================================================

  constructor() {
    // 初始化 — 空控制器
  }

  // ============================================================
  // 规则管理
  // ============================================================

  /**
   * 添加自动操作规则
   *
   * @param rule - 规则定义（不含 lastExecutedAt，默认为 0）
   */
  addRule(rule: Omit<AutoPlayRule, 'lastExecutedAt'>): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`AutoPlayController.addRule: 规则 ${rule.id} 已存在`);
    }
    this.rules.set(rule.id, {
      ...rule,
      lastExecutedAt: 0,
    });
  }

  /**
   * 移除自动操作规则
   *
   * @param ruleId - 规则 ID
   * @returns 是否成功移除
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * 启用指定规则
   *
   * @param ruleId - 规则 ID
   */
  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (!rule) return;
    if (!rule.enabled) {
      rule.enabled = true;
      this.emit({ type: 'rule_enabled', data: { ruleId } });
    }
  }

  /**
   * 禁用指定规则
   *
   * @param ruleId - 规则 ID
   */
  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (!rule) return;
    if (rule.enabled) {
      rule.enabled = false;
      this.emit({ type: 'rule_disabled', data: { ruleId } });
    }
  }

  // ============================================================
  // 全局控制
  // ============================================================

  /**
   * 设置全局自动操作开关
   *
   * @param enabled - 是否启用全局自动操作
   */
  setGlobalEnabled(enabled: boolean): void {
    if (this.globalEnabled !== enabled) {
      this.globalEnabled = enabled;
      this.emit({ type: 'global_toggled', data: { enabled } });
    }
  }

  /**
   * 获取全局自动操作开关状态
   *
   * @returns 是否全局启用
   */
  isGlobalEnabled(): boolean {
    return this.globalEnabled;
  }

  // ============================================================
  // 更新与执行
  // ============================================================

  /**
   * 检查并执行所有就绪规则
   *
   * 遍历所有已启用规则，检查全局开关、冷却时间和执行条件，
   * 对满足条件的规则执行动作。
   *
   * @param currentTime - 当前时间戳（毫秒）
   */
  update(currentTime: number): void {
    if (!this.globalEnabled) return;
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      // 检查冷却时间
      if (currentTime - rule.lastExecutedAt < rule.cooldownMs) continue;
      // 检查执行条件
      if (!rule.condition()) continue;
      // 执行动作
      rule.action();
      rule.lastExecutedAt = currentTime;
      this.emit({
        type: 'rule_executed',
        data: { ruleId: rule.id, ruleName: rule.name },
      });
    }
  }

  // ============================================================
  // 状态管理
  // ============================================================

  /**
   * 获取当前完整状态（用于存档）
   *
   * @returns 自动操作控制器状态快照
   */
  getState(): AutoPlayState {
    const rules: AutoPlayState['rules'] = {};
    for (const [id, rule] of this.rules.entries()) {
      rules[id] = {
        enabled: rule.enabled,
        lastExecutedAt: rule.lastExecutedAt,
      };
    }
    return {
      globalEnabled: this.globalEnabled,
      rules,
    };
  }

  /**
   * 加载状态（含校验）
   *
   * @param state - 要加载的状态
   * @throws 当状态不合法时抛出错误
   */
  loadState(state: AutoPlayState): void {
    // 校验 globalEnabled
    if (typeof state.globalEnabled !== 'boolean') {
      throw new Error('AutoPlayController.loadState: globalEnabled 必须为布尔值');
    }
    // 校验 rules
    if (typeof state.rules !== 'object' || state.rules === null) {
      throw new Error('AutoPlayController.loadState: rules 必须为对象');
    }
    for (const [ruleId, ruleState] of Object.entries(state.rules)) {
      if (typeof ruleState.enabled !== 'boolean') {
        throw new Error(`AutoPlayController.loadState: 规则 ${ruleId} 的 enabled 必须为布尔值`);
      }
      if (typeof ruleState.lastExecutedAt !== 'number' || ruleState.lastExecutedAt < 0) {
        throw new Error(`AutoPlayController.loadState: 规则 ${ruleId} 的 lastExecutedAt 必须为 >= 0 的数字`);
      }
    }
    // 应用状态
    this.globalEnabled = state.globalEnabled;
    for (const [ruleId, ruleState] of Object.entries(state.rules)) {
      const rule = this.rules.get(ruleId);
      if (rule) {
        rule.enabled = ruleState.enabled;
        rule.lastExecutedAt = ruleState.lastExecutedAt;
      }
    }
  }

  /**
   * 重置为初始状态（保留规则定义，重置运行时状态）
   */
  reset(): void {
    this.globalEnabled = false;
    for (const rule of this.rules.values()) {
      rule.lastExecutedAt = 0;
    }
  }

  // ============================================================
  // 事件系统
  // ============================================================

  /**
   * 注册事件监听器
   *
   * @param handler - 事件处理回调
   */
  on(handler: AutoPlayEventListener): void {
    this.listeners.push(handler);
  }

  /**
   * 注销事件监听器
   *
   * @param handler - 要移除的事件处理回调
   */
  off(handler: AutoPlayEventListener): void {
    const idx = this.listeners.indexOf(handler);
    if (idx !== -1) {
      this.listeners.splice(idx, 1);
    }
  }

  /**
   * 内部事件发射
   *
   * @param event - 要发射的事件
   */
  private emit(event: AutoPlayEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
