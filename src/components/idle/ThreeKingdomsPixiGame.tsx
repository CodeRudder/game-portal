/**
 * ThreeKingdomsPixiGame — 三国霸业主游戏容器
 * v1.0: 基础建设 — 资源产出 + 建筑升级
 * 使用纯DOM渲染（React），不使用PixiJS
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { BuildingType } from '@/games/three-kingdoms/engine/building/building.types';
import type { Resources, ProductionRate, ResourceCap } from '@/games/three-kingdoms/engine/resource/resource.types';
import type { EngineSnapshot } from '@/games/three-kingdoms/shared/types';
import { ResourceBar } from './ResourceBar';
import { BuildingPanel } from './BuildingPanel';
import './ThreeKingdomsPixiGame.css';

const TICK_INTERVAL = 100; // 100ms

export default function ThreeKingdomsPixiGame() {
  const engineRef = useRef<ThreeKingdomsEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [canUpgradeMap, setCanUpgradeMap] = useState<Record<BuildingType, boolean>>({} as any);
  const [error, setError] = useState<string | null>(null);

  // 初始化引擎
  useEffect(() => {
    const engine = new ThreeKingdomsEngine();

    // 尝试加载存档，无存档则新游戏
    const loaded = engine.load();
    if (!loaded) {
      engine.init();
    }

    engineRef.current = engine;

    // 游戏循环
    timerRef.current = setInterval(() => {
      engine.tick(TICK_INTERVAL);
      updateState(engine);
    }, TICK_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      engine.reset();
    };
  }, []);

  function updateState(engine: ThreeKingdomsEngine) {
    const snap = engine.getSnapshot();
    setSnapshot(snap);

    // 更新可升级状态
    const canUpgrade: Record<BuildingType, boolean> = {} as any;
    const types = ['castle', 'farmland', 'market', 'barracks', 'smithy', 'academy', 'clinic', 'wall'] as BuildingType[];
    for (const t of types) {
      const check = engine.checkUpgrade(t);
      canUpgrade[t] = check.canUpgrade;
    }
    setCanUpgradeMap(canUpgrade);
  }

  const handleUpgrade = useCallback((type: BuildingType) => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      engine.upgradeBuilding(type);
      setError(null);
      updateState(engine);
    } catch (e: any) {
      setError(e.message || '升级失败');
    }
  }, []);

  const handleCancelUpgrade = useCallback((type: BuildingType) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.cancelUpgrade(type);
    setError(null);
    updateState(engine);
  }, []);

  if (!snapshot) {
    return <div className="game-loading">加载中...</div>;
  }

  // 计算升级进度
  const engine = engineRef.current!;
  const upgradeProgress: Record<BuildingType, number> = {} as any;
  const upgradeRemaining: Record<BuildingType, number> = {} as any;
  const types = ['castle', 'farmland', 'market', 'barracks', 'smithy', 'academy', 'clinic', 'wall'] as BuildingType[];
  for (const t of types) {
    upgradeProgress[t] = engine.getUpgradeProgress(t);
    upgradeRemaining[t] = engine.getUpgradeRemainingTime(t);
  }

  return (
    <div className="game-container">
      {/* 资源栏 */}
      <ResourceBar
        resources={snapshot.resources}
        rates={snapshot.productionRates}
        caps={snapshot.caps}
      />

      {/* 建筑面板 */}
      <BuildingPanel
        buildings={snapshot.buildings}
        upgradeProgress={upgradeProgress}
        upgradeRemaining={upgradeRemaining}
        canUpgradeMap={canUpgradeMap}
        onUpgrade={handleUpgrade}
        onCancel={handleCancelUpgrade}
      />

      {/* 错误提示 */}
      {error && (
        <div className="game-error-toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}
    </div>
  );
}
