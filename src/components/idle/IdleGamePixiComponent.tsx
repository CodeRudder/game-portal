/**
 * components/idle/IdleGamePixiComponent.tsx — 通用放置游戏 PixiJS React 组件
 *
 * 接收任何 IdleGameEngine 实例，自动创建 PixiGameAdapter 并挂载到 DOM。
 * 提供加载状态、错误边界、自动同步引擎状态。
 *
 * 使用方式：
 * ```tsx
 * import { CookieClickerEngine } from '@/games/cookie-clicker/CookieClickerEngine';
 * import IdleGamePixiComponent from '@/components/idle/IdleGamePixiComponent';
 *
 * <IdleGamePixiComponent
 *   engine={new CookieClickerEngine()}
 *   strategy={{ theme: { accent: '#ff9f43' } }}
 * />
 * ```
 *
 * @module components/idle/IdleGamePixiComponent
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { PixiGameAdapter } from '@/renderer/PixiGameAdapter';
import type { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { RenderStrategy, PixiGameAdapterConfig, IdleGameRenderState } from '@/renderer/types';

// ═══════════════════════════════════════════════════════════════
// Props 定义
// ═══════════════════════════════════════════════════════════════

export interface IdleGamePixiComponentProps {
  /** 放置游戏引擎实例 */
  engine: IdleGameEngine;

  /** 自定义渲染策略（可选，覆盖默认策略） */
  strategy?: Partial<RenderStrategy>;

  /** 适配器配置（可选） */
  config?: Omit<PixiGameAdapterConfig, 'strategy'>;

  /** 渲染器就绪回调 */
  onReady?: () => void;

  /** 状态同步回调 */
  onSync?: (state: IdleGameRenderState) => void;

  /** 升级点击回调 */
  onUpgradeClick?: (upgradeId: string) => void;

  /** 错误回调 */
  onError?: (error: Error) => void;

  /** 容器 CSS 类名 */
  className?: string;

  /** 容器内联样式 */
  style?: React.CSSProperties;
}

// ═══════════════════════════════════════════════════════════════
// 组件
// ═══════════════════════════════════════════════════════════════

/**
 * IdleGamePixiComponent — 通用放置游戏 PixiJS React 组件
 *
 * 架构：
 * ```
 * IdleGameEngine → PixiGameAdapter → IdleScene (PixiJS)
 *                                      ↕
 *                              React UI (this component)
 * ```
 *
 * 数据流：
 * 1. engine → PixiGameAdapter.extractState() → IdleGameRenderState
 * 2. IdleGameRenderState → IdleScene.updateState() → PixiJS Graphics
 * 3. IdleScene events → PixiGameAdapter → React callbacks
 */
export default function IdleGamePixiComponent({
  engine,
  strategy,
  config,
  onReady,
  onSync,
  onUpgradeClick,
  onError,
  className,
  style,
}: IdleGamePixiComponentProps) {
  // ─── Refs ─────────────────────────────────────────────────

  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<PixiGameAdapter | null>(null);

  // ─── State ────────────────────────────────────────────────

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [ready, setReady] = useState(false);

  // ─── 回调 ref 模式（避免闭包陷阱）──────────────────────

  const callbacksRef = useRef({ onReady, onSync, onUpgradeClick, onError });
  useEffect(() => {
    callbacksRef.current = { onReady, onSync, onUpgradeClick, onError };
  });

  // ─── 初始化适配器 ─────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;

    const init = async () => {
      try {
        // 构建适配器配置
        const adapterConfig: PixiGameAdapterConfig = {
          ...config,
          autoStart: false, // 手动控制同步
        };

        // 如果传入了自定义策略，合并到配置
        if (strategy) {
          const { RenderStrategyRegistry } = await import('@/renderer/RenderStrategyRegistry');
          const baseStrategy = RenderStrategyRegistry.get((engine as any).gameId ?? 'default');
          adapterConfig.strategy = {
            ...baseStrategy,
            ...strategy,
            theme: { ...baseStrategy.theme, ...strategy.theme },
            layout: { ...baseStrategy.layout, ...strategy.layout },
          };
        }

        const adapter = new PixiGameAdapter(engine, adapterConfig);
        adapterRef.current = adapter;

        // 绑定事件
        adapter.on('ready', () => {
          if (destroyed) return;
          setReady(true);
          setLoading(false);
          callbacksRef.current.onReady?.();
        });

        adapter.on('sync', (state: IdleGameRenderState) => {
          callbacksRef.current.onSync?.(state);
        });

        adapter.on('upgradeClick', (id: string) => {
          callbacksRef.current.onUpgradeClick?.(id);
        });

        adapter.on('error', (err: Error) => {
          callbacksRef.current.onError?.(err);
        });

        // 初始化
        await adapter.init(container);

        if (destroyed) {
          adapter.destroy();
          return;
        }

        // 启动同步
        adapter.startSync();

        // FPS 更新定时器
        const fpsInterval = setInterval(() => {
          if (adapterRef.current) {
            setFps(adapterRef.current.getFPS());
          }
        }, 1000);

        // ResizeObserver
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0 && adapterRef.current) {
              adapterRef.current.resize(width, height);
            }
          }
        });
        observer.observe(container);

        // Cleanup
        return () => {
          clearInterval(fpsInterval);
          observer.disconnect();
        };
      } catch (err) {
        if (!destroyed) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          setLoading(false);
          callbacksRef.current.onError?.(err instanceof Error ? err : new Error(msg));
        }
      }
    };

    const cleanupPromise = init();

    return () => {
      destroyed = true;
      cleanupPromise?.then((cleanup) => cleanup?.());
      if (adapterRef.current) {
        adapterRef.current.destroy();
        adapterRef.current = null;
      }
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  // ─── 手动同步方法（通过 ref 暴露）───────────────────────

  const syncNow = useCallback(() => {
    adapterRef.current?.syncState();
  }, []);

  // 暴露 syncNow 到外部（通过 ref）
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).__syncNow = syncNow;
    }
  }, [syncNow]);

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
        background: '#0f0f1a',
        ...style,
      }}
    >
      {/* FPS 指示器 */}
      {ready && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            padding: '2px 6px',
            borderRadius: 'var(--tk-radius-sm)' as any,
            background: 'rgba(0,0,0,0.5)',
            color: fps >= 55 ? '#4ecdc4' : fps >= 30 ? '#f39c12' : '#e74c3c',
            fontSize: 11,
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {fps} FPS
        </div>
      )}

      {/* 加载指示器 */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888',
            fontSize: 14,
            gap: 8,
          }}
        >
          <div style={{ fontSize: 24 }}>⏳</div>
          <div>正在初始化渲染器...</div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#e74c3c',
            fontSize: 14,
            gap: 8,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>⚠️ 渲染器初始化失败</div>
          <div style={{ fontSize: 12, maxWidth: 300, textAlign: 'center', wordBreak: 'break-word' }}>
            {error}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: '6px 16px',
              fontSize: 12,
              borderRadius: 'var(--tk-radius-sm)' as any,
              border: '1px solid #e74c3c',
              background: 'transparent',
              color: '#e74c3c',
              cursor: 'pointer',
            }}
          >
            重新加载
          </button>
        </div>
      )}
    </div>
  );
}
