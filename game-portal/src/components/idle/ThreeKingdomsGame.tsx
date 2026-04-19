/**
 * ThreeKingdomsGame — 三国霸业 v1.0 主游戏容器
 *
 * 职责：
 * - 创建引擎实例（useRef，单例）
 * - 500ms tick 驱动引擎更新
 * - useState 管理当前 Tab（默认 building）
 * - 事件监听 resource:changed / building:upgraded 触发重渲染
 * - 渲染子组件：顶部信息栏 + 资源栏 + Tab栏 + 场景区 + 建筑面板
 * - v1.0 只有建筑Tab有内容，其他Tab显示"敬请期待"
 *
 * 布局规格（PC 1280×800）：
 * ┌──────────────────────────────────────────────┐
 * │ 资源栏（ResourceBar）                         │
 * ├──────────────────────────────────────────────┤
 * │ [建筑] [武将] [科技] [关卡]   ← Tab栏        │
 * ├──────────────────────────────────────────────┤
 * │                                              │
 * │         中央场景区（建筑面板/占位）            │
 * │                                              │
 * └──────────────────────────────────────────────┘
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type {
  EngineSnapshot,
  BuildingType,
  Resources,
  ProductionRate,
  ResourceCap,
  BuildingState,
} from '@/games/three-kingdoms/shared/types';
import { Toast } from '@/components/idle/common/Toast';
import ResourceBar from '@/components/idle/panels/resource/ResourceBar';
import BuildingPanel from '@/components/idle/panels/building/BuildingPanel';
import './ThreeKingdomsGame.css';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 引擎 tick 间隔（ms） */
const TICK_INTERVAL = 500;

/** UI 刷新间隔（ms），控制资源栏等 UI 更新频率 */
const UI_REFRESH_INTERVAL = 1000;

/** Tab 类型定义 */
type TabId = 'building' | 'hero' | 'tech' | 'campaign';

/** Tab 配置 */
interface TabConfig {
  id: TabId;
  icon: string;
  label: string;
  available: boolean;
}

const TABS: TabConfig[] = [
  { id: 'building', icon: '🏗️', label: '建筑', available: true },
  { id: 'hero', icon: '⚔️', label: '武将', available: false },
  { id: 'tech', icon: '📜', label: '科技', available: false },
  { id: 'campaign', icon: '🗺️', label: '关卡', available: false },
];

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const ThreeKingdomsGame: React.FC = () => {
  // ── 引擎实例（单例，只创建一次） ──
  const engineRef = useRef<ThreeKingdomsEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new ThreeKingdomsEngine();
  }
  const engine = engineRef.current;

  // ── UI 状态 ──
  const [activeTab, setActiveTab] = useState<TabId>('building');
  const [snapshotVersion, setSnapshotVersion] = useState(0);

  // ── 引擎初始化（只执行一次） ──
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // 尝试加载存档，无存档则新游戏
    const offlineEarnings = engine.load();
    if (!offlineEarnings) {
      engine.init();
    }

    // 首次渲染触发
    setSnapshotVersion(1);
  }, [engine]);

  // ── 引擎 tick 循环 ──
  useEffect(() => {
    const timer = setInterval(() => {
      engine.tick(TICK_INTERVAL);
    }, TICK_INTERVAL);

    return () => clearInterval(timer);
  }, [engine]);

  // ── UI 定时刷新（1秒） ──
  useEffect(() => {
    const timer = setInterval(() => {
      setSnapshotVersion(v => v + 1);
    }, UI_REFRESH_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  // ── 事件监听：资源变化 / 建筑升级完成 → 立即刷新 UI ──
  useEffect(() => {
    const handleResourceChanged = () => {
      setSnapshotVersion(v => v + 1);
    };

    const handleBuildingUpgraded = () => {
      setSnapshotVersion(v => v + 1);
    };

    const handleBuildingUpgradeStart = () => {
      setSnapshotVersion(v => v + 1);
    };

    engine.on('resource:changed', handleResourceChanged);
    engine.on('building:upgraded', handleBuildingUpgraded);
    engine.on('building:upgrade-start', handleBuildingUpgradeStart);

    return () => {
      engine.off('resource:changed', handleResourceChanged);
      engine.off('building:upgraded', handleBuildingUpgraded);
      engine.off('building:upgrade-start', handleBuildingUpgradeStart);
    };
  }, [engine]);

  // ── 获取引擎快照 ──
  const snapshot: EngineSnapshot = useMemo(() => {
    // snapshotVersion 作为依赖触发重计算
    void snapshotVersion;
    return engine.getSnapshot();
  }, [engine, snapshotVersion]);

  const { resources, productionRates, caps, buildings } = snapshot;

  // ── 建筑升级完成回调 ──
  const handleUpgradeComplete = useCallback((type: BuildingType) => {
    setSnapshotVersion(v => v + 1);
    Toast.success(`${type} 升级成功！`);
  }, []);

  // ── 建筑升级确认（由 BuildingPanel 调用） ──
  const handleUpgradeError = useCallback((error: Error) => {
    Toast.danger(error.message || '升级失败');
  }, []);

  // ── Tab 切换 ──
  const handleTabChange = useCallback((tab: TabConfig) => {
    if (!tab.available) {
      Toast.info('敬请期待');
      return;
    }
    setActiveTab(tab.id);
  }, []);

  // ── 渲染场景区内容 ──
  const renderSceneContent = () => {
    switch (activeTab) {
      case 'building':
        return (
          <BuildingPanel
            buildings={buildings}
            resources={resources}
            rates={productionRates}
            caps={caps}
            engine={engine}
            onUpgradeComplete={handleUpgradeComplete}
          />
        );

      case 'hero':
      case 'tech':
      case 'campaign':
        return (
          <div className="tk-scene-placeholder">
            <div className="tk-placeholder-content">
              <span className="tk-placeholder-icon">
                {TABS.find(t => t.id === activeTab)?.icon || '🚧'}
              </span>
              <span className="tk-placeholder-text">敬请期待</span>
              <span className="tk-placeholder-sub">
                {TABS.find(t => t.id === activeTab)?.label}系统将在后续版本开放
              </span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ── 主渲染 ──
  return (
    <div className="tk-game-root">
      <div className="tk-game-frame">
        {/* A区：资源栏 */}
        <ResourceBar
          resources={resources}
          rates={productionRates}
          caps={caps}
        />

        {/* B区：Tab 栏 */}
        <div className="tk-tab-bar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`tk-tab-btn ${activeTab === tab.id ? 'tk-tab-btn--active' : ''}`}
              onClick={() => handleTabChange(tab)}
              aria-label={tab.label}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              <span className="tk-tab-icon">{tab.icon}</span>
              <span className="tk-tab-label">{tab.label}</span>
              {!tab.available && <span className="tk-tab-soon">即将开放</span>}
            </button>
          ))}

          {/* 日历信息（右侧） */}
          <div className="tk-calendar">
            <span className="tk-calendar-era">建安元年</span>
            <span className="tk-calendar-season">春</span>
            <span className="tk-calendar-weather">☀️ 晴</span>
          </div>
        </div>

        {/* C区：场景区 */}
        <div className="tk-scene-area">
          {renderSceneContent()}
        </div>
      </div>
    </div>
  );
};

ThreeKingdomsGame.displayName = 'ThreeKingdomsGame';

export default ThreeKingdomsGame;
