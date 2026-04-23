/**
 * components/idle/CivBabylonPixiGame.tsx — 巴比伦文明放置游戏 PixiJS React 组件
 *
 * 使用 PixiGameAdapter + CivBabylonStrategy 渲染巴比伦文明游戏。
 * 青铜配色主题，空中花园/神庙建筑风格。
 *
 * @module components/idle/CivBabylonPixiGame
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { PixiGameAdapter } from '@/renderer/PixiGameAdapter';
import { CIV_BABYLON_STRATEGY } from '@/renderer/CivRenderStrategies';
import type { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import { CivBabylonEngine } from '@/games/civ-babylon/CivBabylonEngine';
import type { IdleGameRenderState } from '@/renderer/types';

export interface CivBabylonPixiGameProps {
  engine?: IdleGameEngine;
  onReady?: () => void;
  onSync?: (state: IdleGameRenderState) => void;
  onUpgradeClick?: (upgradeId: string) => void;
  onError?: (error: Error) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function CivBabylonPixiGame({
  engine: engineProp, onReady, onSync, onUpgradeClick, onError, className, style,
}: CivBabylonPixiGameProps) {
  const engine = useMemo(() => engineProp ?? new CivBabylonEngine(), [engineProp]);
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
          strategy: CIV_BABYLON_STRATEGY,
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
    <div ref={containerRef} className={className} data-testid="civ-babylon-pixi-game" style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: '#0a1218', ...style,
    }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: '#8a8070', fontSize: 14, gap: 8,
        }}>
          <div style={{ fontSize: 24 }}>🏛️</div>
          <div>巴比伦文明加载中...</div>
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
