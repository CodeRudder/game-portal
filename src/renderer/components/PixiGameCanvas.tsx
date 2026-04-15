/**
 * renderer/components/PixiGameCanvas.tsx — React ↔ PixiJS 桥接组件
 *
 * 替代现有的 GameContainer，作为 PixiJS 渲染器的 React 入口。
 *
 * 职责：
 * - 嵌入 PixiJS Canvas 到 React DOM 树
 * - 接收游戏数据 props，推送给渲染器
 * - 转发渲染器事件到 React 回调
 * - 管理渲染器生命周期（创建/销毁）
 * - 处理横竖屏布局
 *
 * @example
 * ```tsx
 * <PixiGameCanvas
 *   renderState={gameRenderState}
 *   onBuildingClick={(id) => engine.buyBuilding(id)}
 *   onSceneChange={(scene) => setActiveScene(scene)}
 * />
 * ```
 *
 * @module renderer/components/PixiGameCanvas
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { GameRenderer } from '../GameRenderer';
import type {
  GameRenderState,
  SceneType,
  RendererConfig,
} from '../types';

// ═══════════════════════════════════════════════════════════════
// Props 定义
// ═══════════════════════════════════════════════════════════════

/**
 * PixiGameCanvas 组件属性
 *
 * 分为三类：
 * 1. 数据 Props：renderState（逻辑层推送的渲染数据）
 * 2. 事件 Props：onXxx（渲染器事件转发到 React）
 * 3. 配置 Props：config（渲染器初始化配置）
 */
export interface PixiGameCanvasProps {
  // ─── 数据 ─────────────────────────────────────────────────

  /**
   * 游戏渲染状态
   *
   * 由逻辑层每帧/每次状态变化时更新。
   * 渲染器根据此数据更新画面。
   */
  renderState?: GameRenderState;

  // ─── 事件回调 ─────────────────────────────────────────────

  /** 渲染器就绪 */
  onRendererReady?: () => void;

  /** 场景切换完成 */
  onSceneChange?: (scene: SceneType) => void;

  /** 点击建筑 */
  onBuildingClick?: (id: string) => void;

  /** 悬停建筑 */
  onBuildingHover?: (id: string | null) => void;

  /** 点击地图空白处 */
  onMapClick?: (x: number, y: number) => void;

  /** 点击领土 */
  onTerritoryClick?: (id: string) => void;

  /** 悬停领土 */
  onTerritoryHover?: (id: string | null) => void;

  /** 战斗操作 */
  onCombatAction?: (action: string, targetId?: string) => void;

  /** 点击科技节点 */
  onTechClick?: (id: string) => void;

  /** 点击武将 */
  onHeroClick?: (id: string) => void;

  /** 购买建筑 */
  onBuildingBuy?: (id: string) => void;

  /** 升级建筑 */
  onBuildingUpgrade?: (id: string) => void;

  /** 招募武将 */
  onHeroRecruit?: (id: string) => void;

  /** 研究科技 */
  onTechResearch?: (id: string) => void;

  /** 征服领土 */
  onTerritoryConquer?: (id: string) => void;

  /** 执行声望转生 */
  onPrestigeExecute?: () => void;

  /** 横竖屏切换 */
  onOrientationChange?: (orientation: 'landscape' | 'portrait') => void;

  /** 渲染器尺寸变化 */
  onResize?: (width: number, height: number) => void;

  // ─── 配置 ─────────────────────────────────────────────────

  /** 渲染器配置（覆盖默认值） */
  config?: Partial<RendererConfig>;

  // ─── 样式 ─────────────────────────────────────────────────

  /** 容器 CSS 类名 */
  className?: string;

  /** 容器内联样式 */
  style?: React.CSSProperties;
}

// ═══════════════════════════════════════════════════════════════
// 组件
// ═══════════════════════════════════════════════════════════════

/**
 * PixiGameCanvas — React ↔ PixiJS 桥接组件
 *
 * ## 架构位置
 *
 * ```
 * React 层                    PixiJS 层
 * ┌──────────────┐           ┌──────────────────┐
 * │ ThreeKingdoms│           │ GameRenderer     │
 * │ Engine       │──state──▶│ ├─ MapScene      │
 * │ (逻辑层)     │           │ ├─ CombatScene   │
 * │              │◀─events──│ └─ ...           │
 * └──────────────┘           └──────────────────┘
 *        │                          ▲
 *        ▼                          │
 * ┌──────────────────────────────────────────────┐
 * │ PixiGameCanvas (React Component)             │
 * │ - 嵌入 Canvas DOM                            │
 * │ - Props → pushRenderState                    │
 * │ - Events → Callbacks                         │
 * └──────────────────────────────────────────────┘
 * ```
 *
 * ## 数据流
 *
 * 1. 逻辑层 → renderState (props) → GameRenderer.pushRenderState()
 * 2. GameRenderer → 事件 → Props.onXxx → React 状态更新
 */
export default function PixiGameCanvas({
  renderState,
  onRendererReady,
  onSceneChange,
  onBuildingClick,
  onBuildingHover,
  onMapClick,
  onTerritoryClick,
  onTerritoryHover,
  onCombatAction,
  onTechClick,
  onHeroClick,
  onBuildingBuy,
  onBuildingUpgrade,
  onHeroRecruit,
  onTechResearch,
  onTerritoryConquer,
  onPrestigeExecute,
  onOrientationChange,
  onResize,
  config,
  className,
  style,
}: PixiGameCanvasProps) {
  // ─── Refs ─────────────────────────────────────────────────

  /** DOM 容器 */
  const containerRef = useRef<HTMLDivElement>(null);
  /** 渲染器实例 */
  const rendererRef = useRef<GameRenderer | null>(null);

  // ─── State ────────────────────────────────────────────────

  /** 是否已初始化 */
  const [ready, setReady] = useState(false);
  /** 当前帧率 */
  const [fps, setFps] = useState(0);
  /** 当前方向 */
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');

  // ─── 事件绑定辅助（ref 模式，避免闭包陷阱）──────────────

  /**
   * 使用 ref 存储最新的回调引用。
   *
   * 每次 render 更新 ref，事件绑定只在初始化时执行一次，
   * 通过 ref 间接调用，始终获取最新回调。
   */
  const callbacksRef = useRef({
    onRendererReady,
    onSceneChange,
    onBuildingClick,
    onBuildingHover,
    onMapClick,
    onTerritoryClick,
    onTerritoryHover,
    onCombatAction,
    onTechClick,
    onHeroClick,
    onBuildingBuy,
    onBuildingUpgrade,
    onHeroRecruit,
    onTechResearch,
    onTerritoryConquer,
    onPrestigeExecute,
    onOrientationChange,
    onResize,
  });

  // 每次 render 更新 ref（无依赖 → 每次都执行）
  useEffect(() => {
    callbacksRef.current = {
      onRendererReady,
      onSceneChange,
      onBuildingClick,
      onBuildingHover,
      onMapClick,
      onTerritoryClick,
      onTerritoryHover,
      onCombatAction,
      onTechClick,
      onHeroClick,
      onBuildingBuy,
      onBuildingUpgrade,
      onHeroRecruit,
      onTechResearch,
      onTerritoryConquer,
      onPrestigeExecute,
      onOrientationChange,
      onResize,
    };
  });

  /**
   * 将渲染器事件映射到 React 回调
   *
   * 使用 ref 间接调用，绑定只在初始化时执行一次。
   */
  const bindEvents = useCallback((renderer: GameRenderer) => {
    renderer.on('rendererReady', () => {
      setReady(true);
      callbacksRef.current.onRendererReady?.();
    });

    renderer.on('sceneChange', (...args) => {
      callbacksRef.current.onSceneChange?.(...args);
    });
    renderer.on('buildingClick', (...args) => {
      callbacksRef.current.onBuildingClick?.(...args);
    });
    renderer.on('buildingHover', (...args) => {
      callbacksRef.current.onBuildingHover?.(...args);
    });
    renderer.on('mapClick', (...args) => {
      callbacksRef.current.onMapClick?.(...args);
    });
    renderer.on('territoryClick', (...args) => {
      callbacksRef.current.onTerritoryClick?.(...args);
    });
    renderer.on('territoryHover', (...args) => {
      callbacksRef.current.onTerritoryHover?.(...args);
    });
    renderer.on('combatAction', (...args) => {
      callbacksRef.current.onCombatAction?.(...args);
    });
    renderer.on('techClick', (...args) => {
      callbacksRef.current.onTechClick?.(...args);
    });
    renderer.on('heroClick', (...args) => {
      callbacksRef.current.onHeroClick?.(...args);
    });
    renderer.on('buildingBuy', (...args) => {
      callbacksRef.current.onBuildingBuy?.(...args);
    });
    renderer.on('buildingUpgrade', (...args) => {
      callbacksRef.current.onBuildingUpgrade?.(...args);
    });
    renderer.on('heroRecruit', (...args) => {
      callbacksRef.current.onHeroRecruit?.(...args);
    });
    renderer.on('techResearch', (...args) => {
      callbacksRef.current.onTechResearch?.(...args);
    });
    renderer.on('territoryConquer', (...args) => {
      callbacksRef.current.onTerritoryConquer?.(...args);
    });
    renderer.on('prestigeExecute', () => {
      callbacksRef.current.onPrestigeExecute?.();
    });

    renderer.on('orientationChange', (layout) => {
      setOrientation(layout);
      callbacksRef.current.onOrientationChange?.(layout);
    });

    renderer.on('resize', (...args) => {
      callbacksRef.current.onResize?.(...args);
    });
  }, []); // 空依赖 — 只绑定一次

  // ─── 初始化渲染器 ─────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;

    const initRenderer = async () => {
      const renderer = new GameRenderer();

      // 绑定事件
      bindEvents(renderer);

      // 初始化
      await renderer.init(container, config);

      if (destroyed) {
        renderer.destroy();
        return;
      }

      rendererRef.current = renderer;

      // FPS 更新定时器
      const fpsInterval = setInterval(() => {
        if (rendererRef.current) {
          setFps(rendererRef.current.getFPS());
        }
      }, 1000);

      // ResizeObserver
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0 && rendererRef.current) {
            rendererRef.current.resize(width, height);
          }
        }
      });
      observer.observe(container);

      // Cleanup
      return () => {
        clearInterval(fpsInterval);
        observer.disconnect();
      };
    };

    const cleanupPromise = initRenderer();

    return () => {
      destroyed = true;
      cleanupPromise?.then((cleanup) => cleanup?.());
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 推送渲染数据 ─────────────────────────────────────────

  useEffect(() => {
    if (!ready || !rendererRef.current || !renderState) return;
    rendererRef.current.pushRenderState(renderState);
  }, [renderState, ready]);

  // ─── 渲染 ─────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#1a1a2e',
        ...style,
      }}
    >
      {/* PixiJS Canvas 由 GameRenderer 动态插入 */}

      {/* FPS 指示器（开发模式） */}
      {ready && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'rgba(0,0,0,0.5)',
            color: fps >= 55 ? '#4ecdc4' : fps >= 30 ? '#f39c12' : '#e74c3c',
            fontSize: 11,
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {fps} FPS · {orientation === 'landscape' ? '横屏' : '竖屏'}
        </div>
      )}

      {/* 加载指示器 */}
      {!ready && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888',
            fontSize: 14,
          }}
        >
          正在初始化渲染器...
        </div>
      )}
    </div>
  );
}
