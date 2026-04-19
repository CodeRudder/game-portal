/**
 * renderer/PixiGameAdapter.ts — 通用放置游戏 PixiJS 渲染适配器
 *
 * 接收任何 IdleGameEngine 实例，自动提取游戏状态并同步到 PixiJS 渲染层。
 * 是 IdleGameEngine → PixiJS 渲染管线之间的桥梁。
 *
 * 职责：
 * - 从 IdleGameEngine 提取渲染状态（资源、升级、声望、统计）
 * - 管理 PixiJS Application 生命周期
 * - 每帧同步引擎状态到 IdleScene
 * - 支持自定义渲染策略
 *
 * @example
 * ```ts
 * const adapter = new PixiGameAdapter(engine, { strategy: myStrategy });
 * await adapter.init(containerEl);
 * // 每帧自动同步引擎状态到渲染层
 * adapter.startSync();
 * ```
 *
 * @module renderer/PixiGameAdapter
 */

import { Application, Container } from 'pixi.js';
import type { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type {
  RendererConfig,
  IdleGameRenderState,
  RenderStrategy,
  PixiGameAdapterConfig,
} from './types';
import { DEFAULT_RENDERER_CONFIG } from './types';
import { RenderStrategyRegistry } from './RenderStrategyRegistry';
import { IdleScene } from './scenes/IdleScene';

// ═══════════════════════════════════════════════════════════════
// 默认配置
// ═══════════════════════════════════════════════════════════════

const DEFAULT_ADAPTER_CONFIG: PixiGameAdapterConfig = {
  syncInterval: 1000,
  autoStart: true,
  showFPS: false,
};

// ═══════════════════════════════════════════════════════════════
// 事件回调类型
// ═══════════════════════════════════════════════════════════════

/** 适配器事件映射 */
export interface AdapterEventMap {
  /** 渲染器就绪 */
  ready: [];
  /** 状态同步完成 */
  sync: [state: IdleGameRenderState];
  /** 购买升级请求 */
  upgradeClick: [upgradeId: string];
  /** 错误 */
  error: [error: Error];
  /** 销毁 */
  destroy: [];
}

type AdapterEventCallback<K extends keyof AdapterEventMap = keyof AdapterEventMap> = (
  ...args: AdapterEventMap[K]
) => void;

// ═══════════════════════════════════════════════════════════════
// PixiGameAdapter
// ═══════════════════════════════════════════════════════════════

/**
 * 通用放置游戏 PixiJS 渲染适配器
 *
 * 将任何 IdleGameEngine 实例桥接到 PixiJS 渲染管线。
 * 轻量级设计，不重复 GameRenderer 的功能。
 */
export class PixiGameAdapter {
  // ─── 引擎引用 ───────────────────────────────────────────

  /** 关联的放置游戏引擎 */
  private engine: IdleGameEngine;

  // ─── PixiJS 核心 ────────────────────────────────────────

  /** PixiJS Application 实例 */
  private app: Application | null = null;
  /** 场景根容器 */
  private sceneRoot: Container | null = null;
  /** 通用放置场景 */
  private idleScene: IdleScene | null = null;

  // ─── 配置 ───────────────────────────────────────────────

  /** 合并后的适配器配置 */
  private config: PixiGameAdapterConfig;
  /** 合并后的渲染器配置 */
  private rendererConfig: RendererConfig;
  /** 渲染策略 */
  private strategy: RenderStrategy;

  // ─── 状态同步 ───────────────────────────────────────────

  /** 状态同步定时器 ID */
  private syncTimerId: number | null = null;
  /** 上一次同步的渲染状态（用于脏检测） */
  private lastState: IdleGameRenderState | null = null;
  /** 是否已初始化 */
  private initialized: boolean = false;
  /** 是否正在同步 */
  private syncing: boolean = false;

  // ─── 事件系统 ───────────────────────────────────────────

  /** 事件监听器映射 */
  private listeners: Map<string, Set<AdapterEventCallback>> = new Map();

  // ─── FPS 统计 ───────────────────────────────────────────

  private fps: number = 0;
  private frameCount: number = 0;
  private lastFpsTime: number = 0;

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  /**
   * @param engine - 放置游戏引擎实例
   * @param config - 适配器配置（可选）
   */
  constructor(engine: IdleGameEngine, config?: PixiGameAdapterConfig) {
    this.engine = engine;
    this.config = { ...DEFAULT_ADAPTER_CONFIG, ...config };

    // 渲染器配置
    this.rendererConfig = {
      ...DEFAULT_RENDERER_CONFIG,
      ...this.config.rendererConfig,
    };

    // 渲染策略：自定义 > 根据 gameId 查找 > 默认
    this.strategy = this.config.strategy
      ?? RenderStrategyRegistry.get((engine as any).gameId ?? 'default');
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  /**
   * 初始化适配器
   *
   * 创建 PixiJS Application，构建 IdleScene，挂载到 DOM。
   *
   * @param container - React 提供的 DOM 容器
   */
  async init(container: HTMLDivElement): Promise<void> {
    if (this.initialized) {
      console.warn('[PixiGameAdapter] Already initialized');
      return;
    }

    // ── 防御性检查：容器尺寸 ────────────────────────────────
    let width = container.clientWidth;
    let height = container.clientHeight;

    if (width === 0 || height === 0) {
      console.warn('[PixiGameAdapter] Container has zero size, waiting...');
      const maxWait = 2000;
      const interval = 50;
      let waited = 0;
      while ((width === 0 || height === 0) && waited < maxWait) {
        await new Promise((r) => setTimeout(r, interval));
        width = container.clientWidth;
        height = container.clientHeight;
        waited += interval;
      }
      if (width === 0 || height === 0) {
        width = this.rendererConfig.designWidth;
        height = this.rendererConfig.designHeight;
      }
    }

    // ── 创建 PixiJS Application ─────────────────────────────
    try {
      this.app = new Application();
      await this.app.init({
        width,
        height,
        background: this.strategy.theme.background,
        resolution: this.rendererConfig.resolution,
        autoDensity: this.rendererConfig.autoDensity ?? true,
        antialias: this.rendererConfig.antialias,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PixiGameAdapter] PixiJS init failed:', msg);
      throw new Error(`PixiJS 初始化失败: ${msg}`);
    }

    // 嵌入 Canvas 到 DOM
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    // 创建场景根容器
    this.sceneRoot = new Container({ label: 'adapterSceneRoot' });
    this.app.stage.addChild(this.sceneRoot);

    // ── 创建 IdleScene ─────────────────────────────────────
    this.idleScene = new IdleScene(this.strategy);
    this.sceneRoot.addChild(this.idleScene.getContainer());
    await this.idleScene.enter();

    // ── 绑定场景事件 ────────────────────────────────────────
    this.idleScene.on('upgradeClick', (id: string) => {
      this.handleUpgradeClick(id);
    });

    // ── 注册主循环 ──────────────────────────────────────────
    this.app.ticker.add(this.onTick);

    this.initialized = true;

    // 首次同步
    this.syncState();

    this.emit('ready');
    console.info('[PixiGameAdapter] Initialized', {
      gameId: (this.engine as any).gameId ?? 'unknown',
      strategy: this.strategy.name,
      size: `${width}×${height}`,
    });
  }

  /**
   * 销毁适配器
   *
   * 停止同步，销毁场景和 PixiJS 资源。
   */
  destroy(): void {
    if (!this.initialized) return;

    // 停止同步
    this.stopSync();

    // 销毁场景
    if (this.idleScene) {
      this.idleScene.destroy();
      this.idleScene = null;
    }

    // 销毁 PixiJS
    if (this.app) {
      this.app.ticker.remove(this.onTick);
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }

    this.sceneRoot = null;
    this.initialized = false;
    this.lastState = null;

    this.emit('destroy');
    this.listeners.clear();
    console.info('[PixiGameAdapter] Destroyed');
  }

  // ═══════════════════════════════════════════════════════════
  // 状态同步
  // ═══════════════════════════════════════════════════════════

  /**
   * 开始定期同步引擎状态到渲染层
   */
  startSync(): void {
    if (this.syncTimerId !== null) return;

    const interval = this.config.syncInterval ?? 1000;
    this.syncTimerId = window.setInterval(() => {
      this.syncState();
    }, interval);

    // 立即同步一次
    this.syncState();
  }

  /**
   * 停止定期同步
   */
  stopSync(): void {
    if (this.syncTimerId !== null) {
      clearInterval(this.syncTimerId);
      this.syncTimerId = null;
    }
  }

  /**
   * 手动触发一次状态同步
   */
  syncState(): void {
    if (!this.initialized || !this.idleScene || this.syncing) return;
    this.syncing = true;

    try {
      const state = this.extractState();
      this.lastState = state;
      this.idleScene.updateState(state);
      this.emit('sync', state);
    } catch (err) {
      console.error('[PixiGameAdapter] syncState error:', err);
    } finally {
      this.syncing = false;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 尺寸管理
  // ═══════════════════════════════════════════════════════════

  /**
   * 调整渲染器尺寸
   */
  resize(width: number, height: number): void {
    if (!this.app) return;
    this.app.renderer.resize(width, height);
    if (this.idleScene) {
      this.idleScene.resize(width, height);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 事件系统
  // ═══════════════════════════════════════════════════════════

  /**
   * 注册事件回调
   */
  on<K extends keyof AdapterEventMap>(
    event: K,
    callback: (...args: AdapterEventMap[K]) => void,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as AdapterEventCallback);
  }

  /**
   * 注销事件回调
   */
  off<K extends keyof AdapterEventMap>(
    event: K,
    callback: (...args: AdapterEventMap[K]) => void,
  ): void {
    this.listeners.get(event)?.delete(callback as AdapterEventCallback);
  }

  /**
   * 触发事件
   */
  private emit<K extends keyof AdapterEventMap>(
    event: K,
    ...args: AdapterEventMap[K]
  ): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        (cb as (...a: AdapterEventMap[K]) => void)(...args);
      } catch (err) {
        console.error(`[PixiGameAdapter] Error in event "${String(event)}":`, err);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 公共访问器
  // ═══════════════════════════════════════════════════════════

  /** 是否已初始化 */
  isInitialized(): boolean {
    return this.initialized;
  }

  /** 获取当前帧率 */
  getFPS(): number {
    return this.fps;
  }

  /** 获取当前渲染策略 */
  getStrategy(): RenderStrategy {
    return this.strategy;
  }

  /** 获取最后一次同步的渲染状态 */
  getLastState(): IdleGameRenderState | null {
    return this.lastState;
  }

  /** 获取 PixiJS Application（高级用途） */
  getApp(): Application | null {
    return this.app;
  }

  /** 获取关联的引擎 */
  getEngine(): IdleGameEngine {
    return this.engine;
  }

  /** 获取 IdleScene 实例 */
  getIdleScene(): IdleScene | null {
    return this.idleScene;
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法
  // ═══════════════════════════════════════════════════════════

  /**
   * 从引擎提取渲染状态
   *
   * 通过 IdleGameEngine 的公共 API 提取资源、升级、声望、统计数据。
   */
  private extractState(): IdleGameRenderState {
    const engine = this.engine;

    // 提取资源
    const resources = engine.getUnlockedResources().map((r) => ({
      id: r.id,
      name: r.name,
      amount: r.amount,
      perSecond: r.perSecond,
      maxAmount: r.maxAmount,
      unlocked: r.unlocked,
    }));

    // 提取升级
    const availableUpgrades = engine.getAvailableUpgrades();
    const upgrades = availableUpgrades.map((u) => {
      const cost = engine.getUpgradeCost(u.id);
      return {
        id: u.id,
        name: u.name,
        description: u.description,
        level: u.level,
        maxLevel: u.maxLevel,
        baseCost: u.baseCost,
        costMultiplier: u.costMultiplier,
        unlocked: u.unlocked,
        canAfford: engine.canAfford(cost),
        effect: u.effect,
        icon: u.icon,
      };
    });

    // 提取声望
    const prestige = (engine as any).prestige ?? { currency: 0, count: 0 };

    // 提取统计
    const statistics = (engine as any).statistics ?? {};

    // 提取 gameId
    const gameId = (engine as any).gameId ?? 'unknown';

    return {
      gameId,
      resources,
      upgrades,
      prestige: { currency: prestige.currency, count: prestige.count },
      statistics,
    };
  }

  /**
   * 处理升级点击事件
   *
   * 委托给引擎执行购买逻辑。
   */
  private handleUpgradeClick(upgradeId: string): void {
    try {
      const success = this.engine.purchaseUpgrade(upgradeId);
      if (success) {
        // 购买成功后立即同步状态
        this.syncState();
      }
    } catch (err) {
      console.error('[PixiGameAdapter] purchaseUpgrade error:', err);
    }
    // 转发事件
    this.emit('upgradeClick', upgradeId);
  }

  /**
   * 主循环回调
   */
  private onTick = (): void => {
    const deltaTime = this.app?.ticker.deltaMS ?? 16.67;

    // FPS 统计
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    // 更新场景
    if (this.idleScene?.isActive()) {
      this.idleScene.update(deltaTime);
    }
  };
}
