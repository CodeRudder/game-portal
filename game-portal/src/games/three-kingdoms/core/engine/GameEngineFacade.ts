/**
 * 游戏引擎门面（Facade）
 *
 * 引擎唯一入口，协调 EventBus、SubsystemRegistry、LifecycleManager、
 * ConfigRegistry、SaveManager 五大 L1 组件。
 *
 * 生命周期：new → init → start ⇄ pause/resume → reset/destroy（终态）
 *
 * @module core/engine/GameEngineFacade
 */

import type { IGameEngineFacade, EngineState } from '../types/engine';
import type { ISubsystem, ISystemDeps } from '../types/subsystem';
import type { IGameState } from '../types/state';
import type { Unsubscribe } from '../types/events';

import { EventBus } from '../events/EventBus';
import { SubsystemRegistry, EngineError } from './SubsystemRegistry';
import { LifecycleManager } from './LifecycleManager';
import { ConfigRegistry } from '../config/ConfigRegistry';
import { ConstantsLoader } from '../config/ConstantsLoader';
import { SaveManager } from '../save/SaveManager';
import { EngineEvents } from '../events/EventTypes';

/** 默认 tick 间隔（毫秒） */
const DEFAULT_TICK_INTERVAL_MS = 1000;
/** 默认自动保存间隔（毫秒） */
const DEFAULT_AUTO_SAVE_INTERVAL_MS = 30000;
/** 存档版本号 */
const SAVE_VERSION = '1.0.0';

/**
 * 游戏引擎门面
 *
 * 实现 IGameEngineFacade，作为引擎唯一入口点。
 *
 * @example
 * ```ts
 * const engine = new GameEngineFacade();
 * engine.registry.register('building', new BuildingSystem());
 * engine.init();
 * engine.start();
 * const building = engine.getSystem<IBuildingSystem>('building');
 * engine.destroy();
 * ```
 */
export class GameEngineFacade implements IGameEngineFacade {
  readonly eventBus: EventBus;
  readonly registry: SubsystemRegistry;
  readonly config: ConfigRegistry;
  readonly save: SaveManager;

  private readonly lifecycle: LifecycleManager;
  private readonly constantsLoader: ConstantsLoader;
  private readonly errorHandlers: Set<(error: Error) => void> = new Set();
  private autoSaveIntervalId: ReturnType<typeof setInterval> | null = null;
  private totalPlayTime: number = 0;
  private saveCount: number = 0;

  constructor() {
    this.eventBus = new EventBus();
    this.registry = new SubsystemRegistry();
    this.config = new ConfigRegistry();
    this.save = new SaveManager(this.config);
    this.lifecycle = new LifecycleManager();
    this.constantsLoader = new ConstantsLoader();
  }

  get state(): EngineState {
    return this.lifecycle.state;
  }

  // ─── 生命周期 ──────────────────────────────────────────────────

  /** 初始化：加载配置 + 按注册顺序调用子系统 init(deps) */
  init(): void {
    this.constantsLoader.loadAll(this.config);

    const deps: ISystemDeps = {
      eventBus: this.eventBus,
      config: this.config,
      registry: this.registry,
    };

    this.registry.forEach((subsystem) => {
      try {
        subsystem.init(deps);
      } catch (err) {
        this.handleError(this.toError(err, `init "${subsystem.name}"`));
      }
    });

    this.eventBus.emit(EngineEvents.INIT, undefined);
  }

  /** 启动游戏主循环 + 自动保存 */
  start(): void {
    const ms = this.config.getOrDefault('TICK_INTERVAL_MS', DEFAULT_TICK_INTERVAL_MS);
    this.lifecycle.start((dt) => this.tick(dt), ms);
    this.startAutoSave();
    this.eventBus.emit(EngineEvents.START, undefined);
  }

  /** 暂停游戏主循环 */
  pause(): void {
    this.lifecycle.pause();
    this.stopAutoSave();
    this.eventBus.emit(EngineEvents.PAUSE, undefined);
  }

  /** 从暂停恢复 */
  resume(): void {
    const ms = this.config.getOrDefault('TICK_INTERVAL_MS', DEFAULT_TICK_INTERVAL_MS);
    this.lifecycle.resume((dt) => this.tick(dt), ms);
    this.startAutoSave();
    this.eventBus.emit(EngineEvents.RESUME, undefined);
  }

  /** 重置所有子系统到初始状态，引擎回到 idle */
  reset(): void {
    if (this.lifecycle.state === 'running' || this.lifecycle.state === 'paused') {
      this.lifecycle.stop();
      this.stopAutoSave();
    }

    this.registry.forEach((sys) => {
      try { sys.reset(); } catch (err) {
        this.handleError(this.toError(err, `reset "${sys.name}"`));
      }
    });

    this.totalPlayTime = 0;
    this.saveCount = 0;
    this.eventBus.emit(EngineEvents.RESET, undefined);
  }

  /** 销毁引擎（终态）：逆序重置子系统，释放所有资源 */
  destroy(): void {
    if (this.lifecycle.state === 'running' || this.lifecycle.state === 'paused') {
      this.lifecycle.stop();
      this.stopAutoSave();
    }

    // 逆序重置
    const order = this.registry.getInitOrder();
    for (let i = order.length - 1; i >= 0; i--) {
      const sys = this.registry.get(order[i]);
      if (sys) { try { sys.reset(); } catch { /* ignore */ } }
    }

    this.registry.clear();
    this.eventBus.removeAllListeners();
    this.errorHandlers.clear();
    this.lifecycle.destroy();
    this.eventBus.emit(EngineEvents.DESTROY, undefined);
  }

  // ─── 子系统访问 ────────────────────────────────────────────────

  /** 按名称获取子系统，不存在时抛 EngineError */
  getSystem<T extends ISubsystem>(name: string): T {
    const system = this.registry.get<T>(name);
    if (!system) throw new EngineError(`Subsystem "${name}" not found`);
    return system;
  }

  // ─── 状态快照 ──────────────────────────────────────────────────

  /** 汇总所有子系统状态，生成完整游戏状态快照 */
  getGameState(): IGameState {
    const subsystems: Record<string, unknown> = {};

    this.registry.forEach((sys, name) => {
      try {
        subsystems[name] = sys.getState();
      } catch (err) {
        this.handleError(this.toError(err, `getState "${name}"`));
        subsystems[name] = null;
      }
    });

    return {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      subsystems,
      metadata: {
        totalPlayTime: this.totalPlayTime,
        saveCount: this.saveCount,
        lastVersion: SAVE_VERSION,
      },
    };
  }

  // ─── 错误处理 ──────────────────────────────────────────────────

  /** 订阅引擎级错误 */
  onError(handler: (error: Error) => void): Unsubscribe {
    this.errorHandlers.add(handler);
    return () => { this.errorHandlers.delete(handler); };
  }

  // ─── 私有方法 ──────────────────────────────────────────────────

  /** 主循环 tick：累计时间 → 发布事件 → 更新所有子系统 */
  private tick(dt: number): void {
    this.totalPlayTime += dt;
    this.eventBus.emit(EngineEvents.TICK, { dt, timestamp: Date.now() });

    this.registry.forEach((sys) => {
      try { sys.update(dt); } catch (err) {
        this.handleError(this.toError(err, `update "${sys.name}"`));
      }
    });
  }

  /** 全局异常处理：发布事件 + 通知所有处理器 */
  private handleError(error: Error): void {
    this.eventBus.emit(EngineEvents.ERROR, { error });
    for (const handler of this.errorHandlers) {
      try { handler(error); } catch { /* 防止无限循环 */ }
    }
  }

  /** 启动自动保存定时器 */
  private startAutoSave(): void {
    this.stopAutoSave();
    const ms = this.config.getOrDefault('AUTO_SAVE_INTERVAL_MS', DEFAULT_AUTO_SAVE_INTERVAL_MS);
    this.autoSaveIntervalId = setInterval(() => {
      try {
        if (this.save.save(this.getGameState())) this.saveCount++;
      } catch (err) {
        this.handleError(this.toError(err, 'auto-save'));
      }
    }, ms);
  }

  /** 停止自动保存定时器 */
  private stopAutoSave(): void {
    if (this.autoSaveIntervalId !== null) {
      clearInterval(this.autoSaveIntervalId);
      this.autoSaveIntervalId = null;
    }
  }

  /** 将未知错误转换为 Error 对象 */
  private toError(err: unknown, context: string): Error {
    return err instanceof Error
      ? err
      : new Error(`[${context}] ${String(err)}`);
  }
}
