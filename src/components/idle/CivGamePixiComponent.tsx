/**
 * components/idle/CivGamePixiComponent.tsx — 通用文明游戏 PixiJS React 组件
 *
 * 接受 gameId 参数，自动选择对应文明渲染策略。
 * 使用 CivilizationScene 替代通用 IdleScene，支持：
 * - 时代/朝代进度条
 * - 科技树面板
 * - 军事单位展示
 * - 贸易路线可视化
 *
 * 支持的文明：
 * - civ-china  (华夏) — 朱红+金色
 * - civ-egypt  (埃及) — 沙金+蓝色
 * - civ-babylon(巴比伦) — 青铜+紫色
 * - civ-india  (印度) — 翠绿+橙色
 *
 * @module components/idle/CivGamePixiComponent
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container } from 'pixi.js';
import type { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { RenderStrategy, PixiGameAdapterConfig, IdleGameRenderState } from '@/renderer/types';
import { RenderStrategyRegistry } from '@/renderer/RenderStrategyRegistry';
import {
  CivilizationScene,
  type CivilizationRenderState,
  type CivilizationSceneEventMap,
} from '@/renderer/scenes/CivilizationScene';
import type { CivilizationId } from '@/renderer/CivIconRenderer';

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

/** 有效的文明游戏 ID */
const VALID_CIV_IDS: CivilizationId[] = ['civ-china', 'civ-egypt', 'civ-babylon', 'civ-india'];

/** 文明名称映射 */
const CIV_NAMES: Record<CivilizationId, string> = {
  'civ-china': '华夏文明',
  'civ-egypt': '埃及文明',
  'civ-babylon': '巴比伦文明',
  'civ-india': '印度文明',
};

// ═══════════════════════════════════════════════════════════════
// Props 定义
// ═══════════════════════════════════════════════════════════════

export interface CivGamePixiComponentProps {
  /** 放置游戏引擎实例 */
  engine: IdleGameEngine;

  /** 游戏 ID（如 'civ-china'） */
  gameId: string;

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

  /** 科技点击回调 */
  onTechClick?: (techId: string) => void;

  /** 时代点击回调 */
  onEraClick?: (eraId: string) => void;

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
 * CivGamePixiComponent — 通用文明游戏 PixiJS React 组件
 *
 * 架构：
 * ```
 * IdleGameEngine → PixiJS Application → CivilizationScene
 *                                         ↕
 *                                 React UI (this component)
 * ```
 */
export default function CivGamePixiComponent({
  engine,
  gameId,
  strategy,
  config,
  onReady,
  onSync,
  onUpgradeClick,
  onTechClick,
  onEraClick,
  onError,
  className,
  style,
}: CivGamePixiComponentProps) {
  // ─── Refs ─────────────────────────────────────────────────

  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<CivilizationScene | null>(null);
  const syncTimerRef = useRef<number | null>(null);

  // ─── State ────────────────────────────────────────────────

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [fps, setFps] = useState(0);
  const [techPanelOpen, setTechPanelOpen] = useState(false);

  // ─── 回调 ref 模式 ────────────────────────────────────────

  const callbacksRef = useRef({ onReady, onSync, onUpgradeClick, onTechClick, onEraClick, onError });
  useEffect(() => {
    callbacksRef.current = { onReady, onSync, onUpgradeClick, onTechClick, onEraClick, onError };
  });

  // ─── 确定文明 ID ──────────────────────────────────────────

  const civId = (VALID_CIV_IDS.includes(gameId as CivilizationId)
    ? gameId
    : 'civ-china') as CivilizationId;

  // ─── 初始化 ───────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;

    const init = async () => {
      try {
        // 获取渲染策略
        const baseStrategy = RenderStrategyRegistry.get(civId);
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
            setTimeout(resolve, 2000);
          });
          width = width || 800;
          height = height || 600;
        }

        // 创建 PixiJS Application
        const app = new Application();
        await app.init({
          width,
          height,
          background: finalStrategy.theme.background,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          antialias: true,
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

        // 创建 CivilizationScene
        const scene = new CivilizationScene(finalStrategy, civId);
        sceneRef.current = scene;

        app.stage.addChild(scene.getContainer());
        await scene.enter();

        // 绑定场景事件
        scene.on('upgradeClick', (id: string) => {
          callbacksRef.current.onUpgradeClick?.(id);
        });
        scene.on('techClick', (id: string) => {
          callbacksRef.current.onTechClick?.(id);
        });
        scene.on('eraClick', (id: string) => {
          callbacksRef.current.onEraClick?.(id);
        });
        scene.on('toggleTechPanel', () => {
          setTechPanelOpen(scene.isTechPanelOpen());
        });

        // FPS 统计
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
          scene.update(app.ticker.deltaMS);
        });

        // 状态同步
        const syncInterval = config?.syncInterval ?? 1000;
        const syncState = () => {
          if (destroyed) return;
          try {
            const state = extractCivState(engine, civId);
            scene.updateState(state);
            callbacksRef.current.onSync?.(state);
          } catch (err) {
            console.error('[CivGamePixiComponent] sync error:', err);
          }
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
  }, [engine, civId]);

  // ─── 手动同步 ─────────────────────────────────────────────

  const syncNow = useCallback(() => {
    if (sceneRef.current && engine) {
      const state = extractCivState(engine, civId);
      sceneRef.current.updateState(state);
    }
  }, [engine, civId]);

  // ─── 切换科技面板 ─────────────────────────────────────────

  const handleToggleTech = useCallback(() => {
    sceneRef.current?.toggleTechPanel();
  }, []);

  // ─── 渲染 ─────────────────────────────────────────────────

  const civName = CIV_NAMES[civId] || gameId;

  return (
    <div
      ref={containerRef}
      className={className}
      data-testid="civ-game-pixi-component"
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

      {/* 文明名称标签 */}
      {ready && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            padding: '2px 8px',
            borderRadius: 'var(--tk-radius-sm)' as any,
            background: 'rgba(0,0,0,0.5)',
            color: '#ffd700',
            fontSize: 11,
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          🏛️ {civName}
        </div>
      )}

      {/* 科技面板切换按钮 */}
      {ready && (
        <button
          onClick={handleToggleTech}
          style={{
            position: 'absolute',
            top: 4,
            right: 70,
            padding: '2px 8px',
            borderRadius: 'var(--tk-radius-sm)' as any,
            background: techPanelOpen ? 'rgba(78,205,196,0.3)' : 'rgba(0,0,0,0.5)',
            color: techPanelOpen ? '#4ecdc4' : '#888',
            fontSize: 11,
            fontFamily: 'monospace',
            border: '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          {techPanelOpen ? '🔬 关闭' : '🔬 科技'}
        </button>
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
          <div style={{ fontSize: 24 }}>🏛️</div>
          <div>正在加载 {civName}...</div>
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

// ═══════════════════════════════════════════════════════════════
// 状态提取辅助函数
// ═══════════════════════════════════════════════════════════════

/**
 * 从引擎提取文明渲染状态
 */
function extractCivState(engine: IdleGameEngine, civId: CivilizationId): CivilizationRenderState {
  // 提取基础资源
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
  // TODO: prestige/statistics 是 protected，stages/techs/units 是子类特有，暂用 as any
  const prestige = (engine as any).prestige ?? { currency: 0, count: 0 };
  const statistics = (engine as any).statistics ?? {};

  // 提取文明特有数据
  const stages = (engine as any).stages;
  const currentStage = stages?.getCurrentStage?.();
  const allStages = stages?.getAllStages?.() ?? [];

  const currentEra = currentStage
    ? {
        id: currentStage.id,
        name: currentStage.name,
        description: currentStage.description ?? '',
        progress: stages?.getProgress?.() ?? 0,
        multiplier: currentStage.productionMultiplier ?? 1,
        themeColor: currentStage.themeColor ?? '#ffd700',
      }
    : undefined;

  const eras = allStages.map((s: any) => ({
    id: s.id,
    name: s.name,
    completed: s.order < (currentStage?.order ?? 0),
    current: s.id === (currentStage?.id ?? ''),
    locked: s.order > (currentStage?.order ?? 0) + 1,
  }));

  // 提取科技
  // TODO: techs/units 是子类引擎特有属性，暂用 as any
  const techs = (engine as any).techs?.getAllTechs?.()?.map((t: any) => ({
    id: t.id,
    name: t.name,
    state: (engine as any).techs?.getTechState?.(t.id) ?? 'locked',
    progress: (engine as any).techs?.getProgress?.(t.id) ?? 0,
    tier: t.tier ?? 1,
  })) ?? [];

  // 提取单位
  const units = (engine as any).units?.getAllUnits?.()?.map((u: any) => ({
    id: u.id,
    name: u.name,
    level: u.level ?? 1,
    unlocked: u.unlocked ?? false,
  })) ?? [];

  return {
    gameId: civId,
    resources,
    upgrades,
    prestige: { currency: prestige.currency, count: prestige.count },
    statistics,
    currentEra,
    eras,
    techs,
    units,
    tradeRoutes: [],
  };
}
