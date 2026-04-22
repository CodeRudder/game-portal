/**
 * components/idle/StrategyGamePixiComponent.tsx — 通用策略游戏 PixiJS React 组件
 *
 * 接受 gameId 参数，自动选择对应的渲染策略和场景。
 * 为策略类放置游戏（全面战争、英雄无敌、帝国时代）提供统一的 PixiJS 渲染入口。
 *
 * 使用方式：
 * ```tsx
 * <StrategyGamePixiComponent
 *   engine={totalWarEngine}
 *   gameId="total-war"
 * />
 * ```
 *
 * @module components/idle/StrategyGamePixiComponent
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container } from 'pixi.js';
import { RenderStrategyRegistry } from '@/renderer/RenderStrategyRegistry';
import { StrategyScene } from '@/renderer/scenes/StrategyScene';
import type { StrategyGameRenderState } from '@/renderer/scenes/StrategyScene';
import type { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { RenderStrategy, PixiGameAdapterConfig } from '@/renderer/types';

// ═══════════════════════════════════════════════════════════════
// Props 定义
// ═══════════════════════════════════════════════════════════════

export interface StrategyGamePixiComponentProps {
  /** 放置游戏引擎实例 */
  engine: IdleGameEngine;

  /** 游戏 ID，用于自动选择渲染策略 */
  gameId: string;

  /** 自定义渲染策略（可选，覆盖自动选择的策略） */
  strategy?: Partial<RenderStrategy>;

  /** 状态同步间隔（毫秒，默认 1000） */
  syncInterval?: number;

  /** 渲染器就绪回调 */
  onReady?: () => void;

  /** 状态同步回调 */
  onSync?: (state: StrategyGameRenderState) => void;

  /** 升级点击回调 */
  onUpgradeClick?: (upgradeId: string) => void;

  /** 领土点击回调 */
  onTerritoryClick?: (territoryId: string) => void;

  /** 军队/英雄点击回调 */
  onUnitClick?: (unitId: string) => void;

  /** 科技点击回调 */
  onTechClick?: (techId: string) => void;

  /** 外交点击回调 */
  onDiplomacyClick?: (action: string) => void;

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
 * StrategyGamePixiComponent — 通用策略游戏 PixiJS React 组件
 *
 * 架构：
 * ```
 * IdleGameEngine → extractStrategyState() → StrategyGameRenderState
 *                                                    ↕
 *                                       StrategyScene (PixiJS)
 *                                                    ↕
 *                                       React UI (this component)
 * ```
 */
export default function StrategyGamePixiComponent({
  engine,
  gameId,
  strategy,
  syncInterval = 1000,
  onReady,
  onSync,
  onUpgradeClick,
  onTerritoryClick,
  onUnitClick,
  onTechClick,
  onDiplomacyClick,
  onError,
  className,
  style,
}: StrategyGamePixiComponentProps) {
  // ─── Refs ─────────────────────────────────────────────────

  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<StrategyScene | null>(null);
  const syncTimerRef = useRef<number | null>(null);

  // ─── State ────────────────────────────────────────────────

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [ready, setReady] = useState(false);

  // ─── 回调 ref 模式 ──────────────────────────────────────

  const callbacksRef = useRef({
    onReady, onSync, onUpgradeClick, onTerritoryClick,
    onUnitClick, onTechClick, onDiplomacyClick, onError,
  });
  useEffect(() => {
    callbacksRef.current = {
      onReady, onSync, onUpgradeClick, onTerritoryClick,
      onUnitClick, onTechClick, onDiplomacyClick, onError,
    };
  });

  // ─── 状态提取 ─────────────────────────────────────────────

  /**
   * 从引擎提取策略游戏渲染状态
   */
  const extractStrategyState = useCallback((): StrategyGameRenderState => {
    // 基础放置游戏状态
    const resources = engine.getUnlockedResources().map((r) => ({
      id: r.id,
      name: r.name,
      amount: r.amount,
      perSecond: r.perSecond,
      maxAmount: r.maxAmount,
      unlocked: r.unlocked,
    }));

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

    const prestige = (engine as any).prestige ?? { currency: 0, count: 0 };
    const statistics = (engine as any).statistics ?? {};

    // 策略游戏扩展状态
    const strategyState: StrategyGameRenderState = {
      gameId,
      resources,
      upgrades,
      prestige: { currency: prestige.currency, count: prestige.count },
      statistics,
      territories: [],
      units: [],
      techs: [],
      resourcePoints: [],
      diplomacy: [],
    };

    // 从引擎提取策略特有数据
    const eng = engine as any;

    // 领土数据
    if (eng.territories) {
      strategyState.territories = eng.territories.map((t: any) => ({
        id: t.id,
        name: t.id.replace(/_/g, ' '),
        conquered: t.conquered ?? false,
        powerRequired: t.powerRequired,
      }));
    }

    // 兵种/英雄数据
    if (eng.troops) {
      strategyState.units = eng.troops
        .filter((t: any) => t.unlocked)
        .map((t: any) => ({
          id: t.id,
          name: t.id.replace(/_/g, ' '),
          type: t.id,
          count: t.count ?? 0,
          level: t.upgradeLevel ?? 0,
          power: (t.count ?? 0) * (t.upgradeLevel ?? 0 + 1) * 10,
          unlocked: t.unlocked,
        }));
    }

    if (eng.heroes) {
      strategyState.units = eng.heroes.map((h: any) => ({
        id: h.id,
        name: h.id.replace(/_/g, ' '),
        type: 'hero',
        count: 1,
        level: h.evolutionLevel ?? 0,
        power: (h.evolutionLevel ?? 0 + 1) * 50,
        unlocked: h.unlocked,
      }));
    }

    // 时代/阶段
    if (eng._currentAge) {
      strategyState.eraName = String(eng._currentAge).replace(/_/g, ' ');
    }

    // 总战斗力
    if (strategyState.units && strategyState.units.length > 0) {
      strategyState.totalPower = strategyState.units.reduce((sum, u) => sum + u.power, 0);
    }

    return strategyState;
  }, [engine, gameId]);

  // ─── 初始化 ───────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;

    const init = async () => {
      try {
        // 获取渲染策略
        const baseStrategy = RenderStrategyRegistry.get(gameId);
        const finalStrategy: RenderStrategy = strategy
          ? {
              ...baseStrategy,
              ...strategy,
              theme: { ...baseStrategy.theme, ...strategy.theme },
              layout: { ...baseStrategy.layout, ...strategy.layout },
            }
          : baseStrategy;

        // 等待容器尺寸
        let width = container.clientWidth;
        let height = container.clientHeight;
        if (width === 0 || height === 0) {
          await new Promise<void>((resolve) => {
            const check = () => {
              width = container.clientWidth;
              height = container.clientHeight;
              if (width > 0 && height > 0) resolve();
              else requestAnimationFrame(check);
            };
            check();
          });
        }

        // 创建 PixiJS Application
        const app = new Application();
        await app.init({
          width,
          height,
          background: finalStrategy.theme.background,
          antialias: true,
          autoDensity: true,
        });
        appRef.current = app;

        if (destroyed) {
          app.destroy(true);
          return;
        }

        // 嵌入 Canvas
        const canvas = app.canvas as HTMLCanvasElement;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        container.appendChild(canvas);

        // 创建 StrategyScene
        const scene = new StrategyScene(finalStrategy);
        sceneRef.current = scene;
        app.stage.addChild(scene.getContainer());
        await scene.enter();

        // 绑定事件
        scene.on('upgradeClick', (id: string) => {
          callbacksRef.current.onUpgradeClick?.(id);
        });
        scene.on('territoryClick', (id: string) => {
          callbacksRef.current.onTerritoryClick?.(id);
        });
        scene.on('unitClick', (id: string) => {
          callbacksRef.current.onUnitClick?.(id);
        });
        scene.on('techClick', (id: string) => {
          callbacksRef.current.onTechClick?.(id);
        });
        scene.on('diplomacyClick', (action: string) => {
          callbacksRef.current.onDiplomacyClick?.(action);
        });

        // FPS 更新
        let frameCount = 0;
        let lastFpsTime = performance.now();
        app.ticker.add(() => {
          frameCount++;
          const now = performance.now();
          if (now - lastFpsTime >= 1000) {
            const currentFps = Math.round((frameCount * 1000) / (now - lastFpsTime));
            setFps(currentFps);
            frameCount = 0;
            lastFpsTime = now;
          }

          if (scene.isActive()) {
            scene.update(app.ticker.deltaMS);
          }
        });

        // 状态同步
        const syncState = () => {
          if (destroyed || !scene.isActive()) return;
          const state = extractStrategyState();
          scene.updateState(state);
          callbacksRef.current.onSync?.(state);
        };

        syncState();
        syncTimerRef.current = window.setInterval(syncState, syncInterval);

        // ResizeObserver
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width: w, height: h } = entry.contentRect;
            if (w > 0 && h > 0) {
              app.renderer.resize(w, h);
              scene.resize(w, h);
            }
          }
        });
        observer.observe(container);

        if (!destroyed) {
          setReady(true);
          setLoading(false);
          callbacksRef.current.onReady?.();
        }

        // Cleanup
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
      if (syncTimerRef.current !== null) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      if (sceneRef.current) {
        sceneRef.current.destroy();
        sceneRef.current = null;
      }
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, gameId]);

  // ─── 渲染 ─────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={className}
      data-testid="strategy-game-pixi-component"
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
          <div style={{ fontSize: 24 }}>⚔️</div>
          <div>正在部署战略...</div>
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
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>⚠️ 战略部署失败</div>
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
            重新部署
          </button>
        </div>
      )}
    </div>
  );
}
