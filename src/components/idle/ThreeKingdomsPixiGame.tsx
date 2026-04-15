/**
 * ThreeKingdomsPixiGame — 三国霸业 PixiJS 渲染页面组件
 *
 * 使用 PixiJS 渲染器替代旧的 Canvas 2D 渲染。
 * 通过 ThreeKingdomsRenderStateAdapter 将引擎状态转换为渲染数据，
 * 由 PixiGameCanvas 组件驱动 PixiJS 渲染管线。
 *
 * 数据流：
 *   Engine → Adapter → GameRenderState → PixiGameCanvas → PixiJS Renderer
 *
 * @module components/idle/ThreeKingdomsPixiGame
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/ThreeKingdomsEngine';
import { ThreeKingdomsRenderStateAdapter } from '@/games/three-kingdoms/ThreeKingdomsRenderStateAdapter';
import PixiGameCanvas from '@/renderer/components/PixiGameCanvas';
import type { GameRenderState, SceneType } from '@/renderer/types';

export default function ThreeKingdomsPixiGame() {
  const engineRef = useRef<ThreeKingdomsEngine | null>(null);
  const adapterRef = useRef<ThreeKingdomsRenderStateAdapter | null>(null);
  const [renderState, setRenderState] = useState<GameRenderState | undefined>();
  const [scene, setScene] = useState<SceneType>('map');

  // ─── 初始化引擎 ─────────────────────────────────────────

  useEffect(() => {
    const engine = new ThreeKingdomsEngine();

    // 创建一个离屏 canvas 供引擎启动游戏循环
    // PixiJS 负责实际渲染，引擎只使用逻辑更新部分
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 1;
    offscreenCanvas.height = 1;
    engine.init(offscreenCanvas);

    engineRef.current = engine;
    adapterRef.current = new ThreeKingdomsRenderStateAdapter(engine);

    // 监听引擎状态变化，更新渲染状态
    engine.on('stateChange', () => {
      if (adapterRef.current) {
        setRenderState(adapterRef.current.toRenderState());
      }
    });

    // 初始渲染
    setRenderState(adapterRef.current.toRenderState());

    // 启动游戏循环（引擎内部使用 requestAnimationFrame）
    engine.start();

    return () => {
      engine.pause();
      engine.destroy();
      engineRef.current = null;
      adapterRef.current = null;
    };
  }, []);

  // ─── 键盘输入 ───────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      engineRef.current?.handleKeyDown(e.key);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── 事件处理 ───────────────────────────────────────────

  const handleBuildingClick = useCallback((id: string) => {
    // TODO: 触发建筑购买/升级
    console.log('Building click:', id);
  }, []);

  const handleTerritoryClick = useCallback((id: string) => {
    // TODO: 触发领土征服
    console.log('Territory click:', id);
  }, []);

  const handleCombatAction = useCallback((action: string, targetId?: string) => {
    console.log('Combat action:', action, targetId);
  }, []);

  const handleSceneChange = useCallback((newScene: SceneType) => {
    setScene(newScene);
  }, []);

  // ─── 渲染 ───────────────────────────────────────────────

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* PixiJS 渲染区域 — 占满剩余空间 */}
      <div style={{ flex: 1, position: 'relative' }}>
        <PixiGameCanvas
          renderState={renderState}
          config={{
            backgroundColor: '#1a0a0a',
            designWidth: 1920,
            designHeight: 1080,
          }}
          onBuildingClick={handleBuildingClick}
          onTerritoryClick={handleTerritoryClick}
          onCombatAction={handleCombatAction}
          onSceneChange={handleSceneChange}
          onRendererReady={() => console.log('Renderer ready')}
        />
      </div>
    </div>
  );
}
