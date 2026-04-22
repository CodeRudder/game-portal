/**
 * components/idle/TotalWarPixiGame.tsx — 全面战争 PixiJS React 组件
 *
 * 军事主题渲染组件，使用 TotalWarScene 替代通用 IdleScene。
 * 钢铁灰+血红色配色，战场地图，军队编制面板。
 *
 * @module components/idle/TotalWarPixiGame
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { PixiGameAdapter } from '@/renderer/PixiGameAdapter';
import type { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import { TotalWarEngine } from '@/games/total-war/TotalWarEngine';
import type { RenderStrategy, PixiGameAdapterConfig, IdleGameRenderState } from '@/renderer/types';

// ═══════════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════════

export interface TotalWarPixiGameProps {
  engine?: IdleGameEngine;
  strategy?: Partial<RenderStrategy>;
  config?: Omit<PixiGameAdapterConfig, 'strategy'>;
  onReady?: () => void;
  onSync?: (state: IdleGameRenderState) => void;
  onUpgradeClick?: (upgradeId: string) => void;
  onError?: (error: Error) => void;
  className?: string;
  style?: React.CSSProperties;
}

// ═══════════════════════════════════════════════════════════════
// 组件
// ═══════════════════════════════════════════════════════════════

export default function TotalWarPixiGame({
  engine: engineProp,
  strategy,
  config,
  onReady,
  onSync,
  onUpgradeClick,
  onError,
  className,
  style,
}: TotalWarPixiGameProps) {
  const engine = useMemo(() => engineProp ?? new TotalWarEngine(), [engineProp]);
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<PixiGameAdapter | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [ready, setReady] = useState(false);

  const callbacksRef = useRef({ onReady, onSync, onUpgradeClick, onError });
  useEffect(() => {
    callbacksRef.current = { onReady, onSync, onUpgradeClick, onError };
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;

    const init = async () => {
      try {
        const adapterConfig: PixiGameAdapterConfig = {
          ...config,
          autoStart: false,
        };

        if (strategy) {
          const { RenderStrategyRegistry } = await import('@/renderer/RenderStrategyRegistry');
          const baseStrategy = RenderStrategyRegistry.get('total-war');
          adapterConfig.strategy = {
            ...baseStrategy,
            ...strategy,
            theme: { ...baseStrategy.theme, ...strategy.theme },
            layout: { ...baseStrategy.layout, ...strategy.layout },
          };
        }

        const adapter = new PixiGameAdapter(engine, adapterConfig);
        adapterRef.current = adapter;

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

        await adapter.init(container);

        if (destroyed) {
          adapter.destroy();
          return;
        }

        adapter.startSync();

        const fpsInterval = setInterval(() => {
          if (adapterRef.current) setFps(adapterRef.current.getFPS());
        }, 1000);

        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0 && adapterRef.current) {
              adapterRef.current.resize(width, height);
            }
          }
        });
        observer.observe(container);

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
  }, [engine]);

  const syncNow = useCallback(() => {
    adapterRef.current?.syncState();
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).__syncNow = syncNow;
    }
  }, [syncNow]);

  return (
    <div
      ref={containerRef}
      className={className}
      data-testid="total-war-pixi-game"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#1a1a1e',
        ...style,
      }}
    >
      {ready && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            padding: '2px 6px',
            borderRadius: 'var(--tk-radius-sm)' as any,
            background: 'rgba(0,0,0,0.5)',
            color: fps >= 55 ? '#27ae60' : fps >= 30 ? '#e67e22' : '#c0392b',
            fontSize: 11,
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {fps} FPS
        </div>
      )}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#7a7a8a',
            fontSize: 14,
            gap: 8,
          }}
        >
          <div style={{ fontSize: 24 }}>⚔️</div>
          <div>正在集结军队...</div>
        </div>
      )}
      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#c0392b',
            fontSize: 14,
            gap: 8,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>⚠️ 战场初始化失败</div>
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
              border: '1px solid #c0392b',
              background: 'transparent',
              color: '#c0392b',
              cursor: 'pointer',
            }}
          >
            重新部署
          </button>
        </div>
      )}
    </div>
  );
}
