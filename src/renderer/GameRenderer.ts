/**
 * renderer/GameRenderer.ts — PixiJS v8 主渲染器
 *
 * 管理 PixiJS Application 生命周期，协调所有子管理器和场景。
 * 作为渲染层的入口点，提供逻辑层到渲染层的唯一桥接接口。
 *
 * @example
 * ```ts
 * const renderer = new GameRenderer();
 * await renderer.init(containerEl, { backgroundColor: '#1a1a2e' });
 * renderer.on('buildingClick', (id) => engine.buyBuilding(id));
 * renderer.switchScene('map');
 * ```
 *
 * @module renderer/GameRenderer
 */

import { Application, Container } from 'pixi.js';
import type {
  RendererConfig,
  SceneType,
  SceneSwitchOptions,
  GameRenderState,
  RendererEventMap,
} from './types';
import { DEFAULT_RENDERER_CONFIG } from './types';
import { AssetManager } from './managers/AssetManager';
import { AnimationManager } from './managers/AnimationManager';
import { CameraManager } from './managers/CameraManager';
import { OrientationManager } from './managers/OrientationManager';
import { BaseScene } from './scenes/BaseScene';
import { MapScene } from './scenes/MapScene';
import { CombatScene } from './scenes/CombatScene';
import { TechTreeScene } from './scenes/TechTreeScene';
import { HeroDetailScene } from './scenes/HeroDetailScene';
import { StageInfoScene } from './scenes/StageInfoScene';

// ═══════════════════════════════════════════════════════════════
// 事件回调类型
// ═══════════════════════════════════════════════════════════════

type EventCallback<T extends keyof RendererEventMap = keyof RendererEventMap> = (
  ...args: RendererEventMap[T]
) => void;

// ═══════════════════════════════════════════════════════════════
// GameRenderer
// ═══════════════════════════════════════════════════════════════

/**
 * PixiJS v8 主渲染器
 *
 * 职责：
 * - 管理 PixiJS Application 的创建与销毁
 * - 协调场景切换（含过渡动画）
 * - 分发渲染数据到当前活跃场景
 * - 管理子管理器（Asset / Animation / Camera / Orientation）
 * - 提供事件总线（PixiJS → React 方向）
 */
export class GameRenderer {
  // ─── PixiJS 核心 ──────────────────────────────────────────

  /** PixiJS Application 实例 */
  private app: Application | null = null;
  /** 场景根容器（挂载到 stage 上） */
  private sceneRoot: Container | null = null;

  // ─── 配置 ─────────────────────────────────────────────────

  /** 合并后的渲染器配置 */
  private config: RendererConfig = { ...DEFAULT_RENDERER_CONFIG };

  // ─── 子管理器 ─────────────────────────────────────────────

  /** 资源管理器 */
  readonly assetManager: AssetManager;
  /** 动画管理器 */
  readonly animationManager: AnimationManager;
  /** 摄像机管理器 */
  readonly cameraManager: CameraManager;
  /** 横竖屏管理器 */
  readonly orientationManager: OrientationManager;

  // ─── 场景管理 ─────────────────────────────────────────────

  /** 已注册的场景实例 */
  private scenes: Map<SceneType, BaseScene> = new Map();
  /** 当前活跃场景 */
  private activeScene: BaseScene | null = null;
  /** 当前场景类型 */
  private currentSceneType: SceneType | null = null;
  /** 场景切换锁（防止并发切换） */
  private switching: boolean = false;

  // ─── 事件系统 ─────────────────────────────────────────────

  /** 事件监听器映射 */
  private listeners: Map<string, Set<EventCallback>> = new Map();

  // ─── 状态 ─────────────────────────────────────────────────

  /** 是否已初始化 */
  private initialized: boolean = false;
  /** FPS 统计 */
  private fps: number = 0;
  private frameCount: number = 0;
  private lastFpsTime: number = 0;

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  constructor() {
    this.assetManager = new AssetManager();
    this.animationManager = new AnimationManager();
    this.cameraManager = new CameraManager();
    this.orientationManager = new OrientationManager();
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  /**
   * 初始化渲染器
   *
   * 创建 PixiJS Application，嵌入到指定 DOM 容器，
   * 注册所有场景，启动主循环。
   *
   * @param container - React 提供的 DOM 容器（div）
   * @param config - 覆盖默认配置
   */
  async init(container: HTMLDivElement, config?: Partial<RendererConfig>): Promise<void> {
    if (this.initialized) {
      console.warn('[GameRenderer] Already initialized');
      return;
    }

    // 合并配置
    this.config = { ...DEFAULT_RENDERER_CONFIG, ...config };

    // ── 防御性检查：容器尺寸 ────────────────────────────────
    let width = container.clientWidth;
    let height = container.clientHeight;

    if (width === 0 || height === 0) {
      console.warn('[GameRenderer] Container has zero size, waiting for layout...');
      // 等待容器获得尺寸（最多 2 秒）
      const maxWait = 2000;
      const interval = 50;
      let waited = 0;
      while ((width === 0 || height === 0) && waited < maxWait) {
        await new Promise((r) => setTimeout(r, interval));
        width = container.clientWidth;
        height = container.clientHeight;
        waited += interval;
      }
      // 如果仍然为 0，使用设计分辨率作为 fallback
      if (width === 0 || height === 0) {
        width = this.config.designWidth;
        height = this.config.designHeight;
        console.warn(`[GameRenderer] Container still zero-sized, using design resolution: ${width}×${height}`);
      }
    }

    console.info('[GameRenderer] Initializing...', {
      containerSize: `${width}×${height}`,
      resolution: this.config.resolution,
    });

    // ── 创建 PixiJS Application ─────────────────────────────
    try {
      this.app = new Application();
      await this.app.init({
        width,
        height,
        background: this.config.backgroundColor,
        resolution: this.config.resolution,
        autoDensity: this.config.autoDensity ?? true,
        antialias: this.config.antialias,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[GameRenderer] PixiJS Application.init() failed:', msg);
      throw new Error(`PixiJS 初始化失败: ${msg}`);
    }

    // 嵌入 Canvas 到 React DOM
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    // 创建场景根容器
    this.sceneRoot = new Container({ label: 'sceneRoot' });
    this.app.stage.addChild(this.sceneRoot);

    // 初始化横竖屏管理器
    this.orientationManager.init(container, this.config);

    // 初始化摄像机管理器
    this.cameraManager.attach(this.sceneRoot);

    // ── 注册场景（包裹 try-catch 防止单个场景失败阻塞整体初始化）──
    try {
      this.registerScenes();
    } catch (err) {
      console.error('[GameRenderer] registerScenes() failed:', err);
      // 场景注册失败不应阻塞渲染器初始化，继续执行
    }

    // 注册主循环
    this.app.ticker.add(this.onTick);

    // 监听横竖屏变化
    this.orientationManager.onOrientationChange((layout) => {
      this.emit('orientationChange', layout);
    });

    this.initialized = true;
    console.info('[GameRenderer] Initialized successfully', {
      resolution: this.config.resolution,
      size: `${width}×${height}`,
    });

    // 触发 rendererReady 事件（让 PixiGameCanvas 隐藏加载指示器）
    this.emit('rendererReady');
  }

  /**
   * 销毁渲染器
   *
   * 清理所有场景、管理器和 PixiJS 资源。
   */
  destroy(): void {
    if (!this.initialized) return;

    // 销毁所有场景
    for (const scene of this.scenes.values()) {
      scene.destroy();
    }
    this.scenes.clear();
    this.activeScene = null;
    this.currentSceneType = null;

    // 销毁管理器
    this.assetManager.destroy();
    this.animationManager.destroy();
    this.cameraManager.destroy();
    this.orientationManager.destroy();

    // 销毁 PixiJS
    if (this.app) {
      this.app.ticker.remove(this.onTick);
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }

    this.sceneRoot = null;
    this.listeners.clear();
    this.initialized = false;

    this.emit('rendererDestroy');
    console.info('[GameRenderer] Destroyed');
  }

  // ═══════════════════════════════════════════════════════════
  // 场景管理
  // ═══════════════════════════════════════════════════════════

  /**
   * 切换场景
   *
   * @param sceneType - 目标场景类型
   * @param options - 过渡动画和参数
   */
  async switchScene(sceneType: SceneType, options?: SceneSwitchOptions): Promise<void> {
    if (!this.initialized || !this.sceneRoot) return;
    if (this.switching) {
      console.warn('[GameRenderer] Scene switch in progress, ignoring');
      return;
    }
    if (this.currentSceneType === sceneType) return;

    this.switching = true;

    try {
      const targetScene = this.scenes.get(sceneType);
      if (!targetScene) {
        console.error(`[GameRenderer] Unknown scene: ${sceneType}`);
        return;
      }

      // 退出当前场景
      if (this.activeScene) {
        const transition = options?.transition ?? 'fade';
        const duration = options?.duration ?? 300;

        // 播放退出过渡动画
        if (transition !== 'none') {
          await this.animationManager.playSceneTransition(
            this.activeScene.getContainer(),
            transition,
            duration,
            'out',
          );
        }

        await this.activeScene.exit();

        // 从场景根移除
        this.sceneRoot.removeChild(this.activeScene.getContainer());
      }

      // 进入新场景
      this.activeScene = targetScene;
      this.currentSceneType = sceneType;

      // 添加到场景根
      this.sceneRoot.addChild(targetScene.getContainer());

      await targetScene.enter(options?.params);

      // 播放进入过渡动画
      const transition = options?.transition ?? 'fade';
      const duration = options?.duration ?? 300;
      if (transition !== 'none') {
        await this.animationManager.playSceneTransition(
          targetScene.getContainer(),
          transition,
          duration,
          'in',
        );
      }

      this.emit('sceneChange', sceneType);
    } finally {
      this.switching = false;
    }
  }

  /**
   * 获取当前场景类型
   */
  getCurrentScene(): SceneType {
    return this.currentSceneType ?? 'map';
  }

  // ═══════════════════════════════════════════════════════════
  // 数据推送
  // ═══════════════════════════════════════════════════════════

  /**
   * 推送渲染数据到当前场景
   *
   * 由逻辑层每帧调用，将序列化后的渲染数据传递给渲染层。
   * 渲染器根据 activeScene 分发到对应场景。
   *
   * @param state - 逻辑层推送的完整渲染状态
   */
  pushRenderState(state: GameRenderState): void {
    if (!this.activeScene) return;

    // 如果逻辑层请求了场景切换
    if (state.activeScene !== this.currentSceneType) {
      this.switchScene(state.activeScene);
    }

    // 将数据推送给当前场景
    this.activeScene.setData(state);
  }

  // ═══════════════════════════════════════════════════════════
  // 尺寸管理
  // ═══════════════════════════════════════════════════════════

  /**
   * 调整渲染器尺寸
   *
   * 在窗口 resize 或容器尺寸变化时调用。
   */
  resize(width: number, height: number): void {
    if (!this.app) return;

    this.app.renderer.resize(width, height);
    this.orientationManager.handleResize(width, height);

    this.emit('resize', width, height);
  }

  // ═══════════════════════════════════════════════════════════
  // 事件系统
  // ═══════════════════════════════════════════════════════════

  /**
   * 注册事件回调
   */
  on<K extends keyof RendererEventMap>(
    event: K,
    callback: (...args: RendererEventMap[K]) => void,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);
  }

  /**
   * 注销事件回调
   */
  off<K extends keyof RendererEventMap>(
    event: K,
    callback: (...args: RendererEventMap[K]) => void,
  ): void {
    this.listeners.get(event)?.delete(callback as EventCallback);
  }

  /**
   * 触发事件（内部使用）
   */
  private emit<K extends keyof RendererEventMap>(
    event: K,
    ...args: RendererEventMap[K]
  ): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        (cb as (...a: RendererEventMap[K]) => void)(...args);
      } catch (err) {
        console.error(`[GameRenderer] Error in event handler "${String(event)}":`, err);
      }
    });
  }

  /**
   * 将场景内部事件桥接到渲染器事件总线
   *
   * 每个场景通过此方法将用户交互事件上报，
   * 渲染器再转发给 React 层。
   */
  private bridgeSceneEvent<K extends keyof RendererEventMap>(
    event: K,
    ...args: RendererEventMap[K]
  ): void {
    this.emit(event, ...args);
  }

  // ═══════════════════════════════════════════════════════════
  // 公共访问器
  // ═══════════════════════════════════════════════════════════

  /**
   * 获取 PixiJS Application 实例
   *
   * 仅用于高级定制，一般不应直接访问。
   */
  getApp(): Application | null {
    return this.app;
  }

  /**
   * 获取当前帧率
   */
  getFPS(): number {
    return this.fps;
  }

  /**
   * 是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 获取指定类型的场景实例
   *
   * 用于外部代码需要直接访问场景（如注入瓦片地图数据）。
   */
  getScene<T extends BaseScene>(type: SceneType): T | undefined {
    return this.scenes.get(type) as T | undefined;
  }

  /**
   * 获取 MapScene 实例
   *
   * 便捷方法，用于注入瓦片地图数据等操作。
   */
  getMapScene(): MapScene | undefined {
    return this.scenes.get('map') as MapScene | undefined;
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法
  // ═══════════════════════════════════════════════════════════

  /**
   * 注册所有场景实例
   *
   * 每个场景的创建独立包裹 try-catch，单个场景创建失败不影响其他场景。
   */
  private registerScenes(): void {
    const sceneClasses: { type: SceneType; create: () => BaseScene }[] = [
      {
        type: 'map',
        create: () => new MapScene(
          this.assetManager,
          this.animationManager,
          this.cameraManager,
          this.bridgeSceneEvent.bind(this),
        ),
      },
      {
        type: 'combat',
        create: () => new CombatScene(
          this.assetManager,
          this.animationManager,
          this.bridgeSceneEvent.bind(this),
        ),
      },
      {
        type: 'tech-tree',
        create: () => new TechTreeScene(
          this.assetManager,
          this.animationManager,
          this.bridgeSceneEvent.bind(this),
        ),
      },
      {
        type: 'hero-detail',
        create: () => new HeroDetailScene(
          this.assetManager,
          this.animationManager,
          this.bridgeSceneEvent.bind(this),
        ),
      },
      {
        type: 'stage-info',
        create: () => new StageInfoScene(
          this.assetManager,
          this.animationManager,
          this.bridgeSceneEvent.bind(this),
        ),
      },
    ];

    for (const { type, create } of sceneClasses) {
      try {
        const scene = create();
        this.scenes.set(type, scene);
      } catch (err) {
        console.error(`[GameRenderer] Failed to create scene "${type}":`, err);
      }
    }
  }

  /**
   * 主循环回调
   *
   * 每帧调用：更新 FPS、更新活跃场景、更新摄像机。
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

    // 更新活跃场景
    if (this.activeScene?.isActive()) {
      this.activeScene.update(deltaTime);
    }

    // 更新摄像机
    this.cameraManager.update(deltaTime);
  };
}
