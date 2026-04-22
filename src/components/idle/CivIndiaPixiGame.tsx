/**
 * components/idle/CivIndiaPixiGame.tsx — 印度文明放置游戏 PixiJS React 组件
 *
 * 使用 PixiGameAdapter + CivIndiaStrategy 渲染印度文明游戏。
 * 翡翠配色主题，佛塔/宫殿建筑风格。
 *
 * @module components/idle/CivIndiaPixiGame
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { PixiGameAdapter } from '@/renderer/PixiGameAdapter';
import { CIV_INDIA_STRATEGY } from '@/renderer/CivRenderStrategies';
import type { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import { CivIndiaEngine } from '@/games/civ-india/CivIndiaEngine';
import type { IdleGameRenderState } from '@/renderer/types';

export interface CivIndiaPixiGameProps {
  engine?: IdleGameEngine;
  onReady?: () => void;
  onSync?: (state: IdleGameRenderState) => void;
  onUpgradeClick?: (upgradeId: string) => void;
  onError?: (error: Error) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function CivIndiaPixiGame({
  engine: engineProp, onReady, onSync, onUpgradeClick, onError, className, style,
}: CivIndiaPixiGameProps) {
  const engine = useMemo(() => engineProp ?? new CivIndiaEngine(), [engineProp]);
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<PixiGameAdapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const adapter = new PixiGameAdapter(engine, {
          strategy: CIV_INDIA_STRATEGY,
          autoStart: false,
        });
        adapterRef.current = adapter;

        adapter.on('ready', () => {
          if (destroyed) return;
          setLoading(false);
          callbacksRef.current.onReady?.();
        });
        adapter.on('sync', (state: IdleGameRenderState) => { callbacksRef.current.onSync?.(state); });
        adapter.on('upgradeClick', (id: string) => { callbacksRef.current.onUpgradeClick?.(id); });
        adapter.on('error', (err: Error) => { callbacksRef.current.onError?.(err); });

        await adapter.init(container);
        if (destroyed) { adapter.destroy(); return; }
        adapter.startSync();

        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0 && adapterRef.current) adapterRef.current.resize(width, height);
          }
        });
        observer.observe(container);
        return () => { observer.disconnect(); };
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
      if (adapterRef.current) { adapterRef.current.destroy(); adapterRef.current = null; }
    };
  }, [engine]);

  return (
    <div ref={containerRef} className={className} data-testid="civ-india-pixi-game" style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: '#0a1a0e', ...style,
    }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: '#78a878', fontSize: 14, gap: 8,
        }}>
          <div style={{ fontSize: 24 }}>🕉️</div>
          <div>印度文明加载中...</div>
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: '#e74c3c', fontSize: 14, gap: 8,
        }}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>⚠️ 渲染器初始化失败</div>
          <div style={{ fontSize: 12 }}>{error}</div>
        </div>
      )}
    </div>
  );
}
