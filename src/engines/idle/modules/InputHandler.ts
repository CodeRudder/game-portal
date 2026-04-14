/**
 * InputHandler — 放置游戏输入处理核心模块
 *
 * 提供键盘按键到游戏动作的映射与事件分发功能：
 * - 可配置的按键映射表（KeyBinding）
 * - 默认按键映射（空格、方向键、Enter、Esc 等）
 * - 事件回调注册与移除（on / off）
 * - 运行时动态添加/移除映射
 * - 全局启用/禁用控制
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 不直接绑定 DOM 事件，由外部调用 handleKeyDown / handleKeyUp
 * - 支持多个回调监听同一动作
 * - 线程安全：所有状态在单线程中维护
 *
 * @module engines/idle/modules/InputHandler
 */

// ============================================================
// 类型定义
// ============================================================

/** 按键动作类型 */
export type InputAction =
  | 'click' | 'select_up' | 'select_down' | 'confirm' | 'cancel'
  | 'tab_left' | 'tab_right' | 'prestige' | 'speed_up' | 'speed_down'
  | 'pause' | 'save' | 'custom';

/** 按键映射条目 */
export interface KeyBinding {
  /** 按键标识（如 'Space', 'ArrowUp', 'Enter', 'a' 等） */
  key: string;
  /** 映射到的游戏动作 */
  action: InputAction;
  /** 自定义动作标识（当 action 为 'custom' 时使用） */
  actionId?: string;
}

/** 输入处理配置 */
export interface InputConfig {
  /** 按键映射列表 */
  bindings: KeyBinding[];
  /** 是否启用右键菜单（默认 false） */
  enableContextMenu?: boolean;
}

/** 输入事件 */
export interface InputEvent {
  /** 触发的动作类型 */
  action: InputAction;
  /** 自定义动作标识 */
  actionId?: string;
  /** 原始按键标识 */
  originalKey: string;
  /** 事件时间戳（performance.now() 或 Date.now()） */
  timestamp: number;
}

/** 输入处理回调 */
export type InputCallback = (event: InputEvent) => void;

// ============================================================
// InputHandler 类
// ============================================================

/**
 * 输入处理器
 *
 * 管理按键映射表与事件回调分发。
 * 外部通过调用 handleKeyDown(key) 传入按键，InputHandler
 * 查表后触发已注册的回调函数。
 */
export class InputHandler {
  // ----------------------------------------------------------
  // 静态默认映射
  // ----------------------------------------------------------

  /** 默认按键映射表 */
  static readonly DEFAULT_BINDINGS: KeyBinding[] = [
    { key: 'Space',       action: 'click' },
    { key: ' ',           action: 'click' },
    { key: 'ArrowUp',     action: 'select_up' },
    { key: 'ArrowDown',   action: 'select_down' },
    { key: 'Enter',       action: 'confirm' },
    { key: 'Escape',      action: 'cancel' },
    { key: 'ArrowLeft',   action: 'tab_left' },
    { key: 'ArrowRight',  action: 'tab_right' },
    { key: 'r',           action: 'prestige' },
    { key: 'R',           action: 'prestige' },
    { key: 'p',           action: 'pause' },
    { key: 'P',           action: 'pause' },
    { key: '+',           action: 'speed_up' },
    { key: '=',           action: 'speed_up' },
    { key: '-',           action: 'speed_down' },
    { key: '_',           action: 'speed_down' },
  ];

  // ----------------------------------------------------------
  // 实例属性
  // ----------------------------------------------------------

  /** 当前按键映射表（key → KeyBinding） */
  private bindingMap: Map<string, KeyBinding>;

  /** 事件回调注册表（action → callback 数组） */
  private listeners: Map<string, InputCallback[]>;

  /** 是否启用输入处理 */
  private enabled: boolean;

  /** 是否启用右键菜单 */
  private enableContextMenu: boolean;

  // ----------------------------------------------------------
  // 构造函数
  // ----------------------------------------------------------

  /**
   * 创建 InputHandler 实例
   *
   * @param config - 可选的部分配置，覆盖默认设置
   *
   * 加载流程：
   * 1. 以 DEFAULT_BINDINGS 为基础构建映射表
   * 2. 如果 config.bindings 存在，逐条覆盖/追加到映射表
   * 3. 设置 enableContextMenu 等选项
   */
  constructor(config?: Partial<InputConfig>) {
    this.bindingMap = new Map<string, KeyBinding>();
    this.listeners = new Map<string, InputCallback[]>();
    this.enabled = true;
    this.enableContextMenu = config?.enableContextMenu ?? false;

    // 加载默认映射
    for (const binding of InputHandler.DEFAULT_BINDINGS) {
      this.bindingMap.set(binding.key, { ...binding });
    }

    // 使用自定义映射覆盖/追加
    if (config?.bindings) {
      for (const binding of config.bindings) {
        this.bindingMap.set(binding.key, { ...binding });
      }
    }
  }

  // ----------------------------------------------------------
  // 按键处理
  // ----------------------------------------------------------

  /**
   * 处理按键按下事件
   *
   * 根据按键查找映射表，如果找到对应动作且处理器已启用，
   * 则构造 InputEvent 并分发给所有注册的回调。
   *
   * @param key - 按键标识（来自 KeyboardEvent.key 或自定义值）
   */
  handleKeyDown(key: string): void {
    if (!this.enabled) {
      return;
    }

    const binding = this.bindingMap.get(key);
    if (!binding) {
      return;
    }

    const event: InputEvent = {
      action: binding.action,
      actionId: binding.actionId,
      originalKey: key,
      timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    };

    this.dispatch(event);
  }

  /**
   * 处理按键释放事件（预留）
   *
   * 当前版本不执行任何操作，预留用于后续扩展：
   * - 长按检测
   * - 按键组合判定
   * - 按键持续触发（如按住方向键连续选择）
   *
   * @param _key - 按键标识
   */
  handleKeyUp(_key: string): void {
    // 预留：当前版本不处理 keyUp
  }

  // ----------------------------------------------------------
  // 事件回调管理
  // ----------------------------------------------------------

  /**
   * 注册输入事件回调
   *
   * 当对应动作触发时，回调将被调用。支持同一动作注册多个回调。
   * 如果 action 为 'custom'，应同时使用 actionId 区分不同自定义动作，
   * 此时监听的 key 格式为 'custom:actionId'。
   *
   * @param action - 要监听的动作类型，或自定义动作标识
   * @param callback - 回调函数
   */
  on(action: InputAction | string, callback: InputCallback): void {
    const key = action;
    let callbacks = this.listeners.get(key);
    if (!callbacks) {
      callbacks = [];
      this.listeners.set(key, callbacks);
    }

    // 防止重复注册同一回调
    if (!callbacks.includes(callback)) {
      callbacks.push(callback);
    }
  }

  /**
   * 移除输入事件回调
   *
   * 从指定动作的回调列表中移除给定函数引用。
   *
   * @param action - 要移除监听的动作类型
   * @param callback - 要移除的回调函数引用
   */
  off(action: InputAction | string, callback: InputCallback): void {
    const key = action;
    const callbacks = this.listeners.get(key);
    if (!callbacks) {
      return;
    }

    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }

    // 清理空数组，避免内存泄漏
    if (callbacks.length === 0) {
      this.listeners.delete(key);
    }
  }

  // ----------------------------------------------------------
  // 映射管理
  // ----------------------------------------------------------

  /**
   * 添加自定义按键映射
   *
   * 如果该按键已有映射，将被覆盖。
   *
   * @param binding - 按键映射条目
   */
  addBinding(binding: KeyBinding): void {
    this.bindingMap.set(binding.key, { ...binding });
  }

  /**
   * 移除按键映射
   *
   * 移除指定按键的映射条目。移除后该按键将不再触发任何动作。
   *
   * @param key - 要移除的按键标识
   */
  removeBinding(key: string): void {
    this.bindingMap.delete(key);
  }

  // ----------------------------------------------------------
  // 状态控制
  // ----------------------------------------------------------

  /**
   * 设置输入处理的启用/禁用状态
   *
   * 禁用时，handleKeyDown 不会触发任何回调。
   *
   * @param enabled - true 启用，false 禁用
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 获取当前所有按键映射
   *
   * 返回映射表的浅拷贝数组，修改返回值不影响内部状态。
   *
   * @returns 当前所有 KeyBinding 条目的数组
   */
  getBindings(): KeyBinding[] {
    const result: KeyBinding[] = [];
    this.bindingMap.forEach((binding) => {
      result.push({ ...binding });
    });
    return result;
  }

  // ----------------------------------------------------------
  // 内部方法
  // ----------------------------------------------------------

  /**
   * 分发输入事件到所有注册的回调
   *
   * 按注册顺序依次调用，如果某个回调抛出异常，
   * 会被捕获并输出到控制台，不影响后续回调的执行。
   *
   * @param event - 输入事件
   */
  private dispatch(event: InputEvent): void {
    // 分发给 action 对应的回调
    const actionCallbacks = this.listeners.get(event.action);
    if (actionCallbacks) {
      for (const cb of actionCallbacks) {
        try {
          cb(event);
        } catch (err) {
          console.error(`[InputHandler] Error in callback for action "${event.action}":`, err);
        }
      }
    }

    // 如果是 custom 动作且有 actionId，同时分发给 'custom:actionId' 的回调
    if (event.action === 'custom' && event.actionId) {
      const customKey = `custom:${event.actionId}`;
      const customCallbacks = this.listeners.get(customKey);
      if (customCallbacks) {
        for (const cb of customCallbacks) {
          try {
            cb(event);
          } catch (err) {
            console.error(`[InputHandler] Error in callback for custom action "${event.actionId}":`, err);
          }
        }
      }
    }
  }
}
