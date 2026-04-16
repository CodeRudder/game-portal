/**
 * components/idle/CivChinaPixiGame.tsx — 华夏文明放置游戏 PixiJS React 组件
 *
 * 使用 PixiGameAdapter + CivChinaScene 渲染华夏文明游戏。
 * 红金配色主题，中式建筑风格。
 *
 * @module components/idle/CivChinaPixiGame
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { PixiGameAdapter } from '@/renderer/PixiGameAdapter';
import { CIV_CHINA_STRATEGY } from '@/renderer/CivRenderStrategies';
import type { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import { CivChinaEngine } from '@/games/civ-china/CivChinaEngine';
import type { IdleGameRenderState } from '@/renderer/types';

// ═══════════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════════

export interface CivChinaPixiGameProps {
  /** 华夏文明引擎实例（可选，未传入时自动创建） */
  engine?: IdleGameEngine;
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

export default function CivChinaPixiGame({
  engine: engineProp,
  onReady,
  onSync,
  onUpgradeClick,
  onError,
  className,
  style,
}: CivChinaPixiGameProps) {
  const engine = useMemo(() => engineProp ?? new CivChinaEngine(), [engineProp]);
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
          strategy: CIV_CHINA_STRATEGY,
          autoStart: false,
        });
        adapterRef.current = adapter;

        adapter.on('ready', () => {
          if (destroyed) return;
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
    };
  }, [engine]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#1a0a0a',
        ...style,
      }}
    >
      {loading && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#b89878', fontSize: 14, gap: 8,
        }}>
          <div style={{ fontSize: 24 }}>🏯</div>
          <div>华夏文明加载中...</div>
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#e74c3c', fontSize: 14, gap: 8,
        }}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>⚠️ 渲染器初始化失败</div>
          <div style={{ fontSize: 12, maxWidth: 300, textAlign: 'center', wordBreak: 'break-word' }}>
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
