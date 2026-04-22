/**
 * ThreeKingdomsGame — 三国霸业 v1.0 主游戏容器
 *
 * 职责：
 * - 创建引擎实例（useRef，单例）
 * - 500ms tick 驱动引擎更新
 * - useState 管理当前 Tab（默认 building）
 * - 事件监听 resource:changed / building:upgraded 触发重渲染
 * - 渲染子组件：顶部信息栏 + 资源栏 + Tab栏 + 场景区 + 建筑面板
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
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine';
import { RESOURCE_LABELS } from '@/games/three-kingdoms/engine';
import type {
  EngineSnapshot,
  BuildingType,
  BuildingState,
} from '@/games/three-kingdoms/shared/types';
import { Toast } from '@/components/idle/common/Toast';
import ResourceBar from '@/components/idle/panels/resource/ResourceBar';
import Modal from '@/components/idle/common/Modal';
import EventBanner from '@/components/idle/panels/event/EventBanner';
import RandomEncounterModal from '@/components/idle/panels/event/RandomEncounterModal';
import StoryEventModal from '@/components/idle/panels/event/StoryEventModal';

// ── 拆分组件 ──
import TabBar, {
  type TabId,
  type TabConfig,
  FEATURE_ITEMS,
  FEATURE_TO_TAB,
} from './three-kingdoms/TabBar';
import OfflineRewardModal from './three-kingdoms/OfflineRewardModal';
import WelcomeModal from './three-kingdoms/WelcomeModal';
import SceneRouter from './three-kingdoms/SceneRouter';
import { useEngineEvents } from './three-kingdoms/useEngineEvents';
import FeaturePanelOverlay, { type FeaturePanelId } from './three-kingdoms/FeaturePanelOverlay';

// ── 样式 ──
import './ThreeKingdomsGame.css';
import './three-kingdoms/calendar.css';
import './three-kingdoms/tab-bar.css';
import './three-kingdoms/offline-reward.css';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 引擎 tick 间隔（ms） */
const TICK_INTERVAL = 500;

/** UI 刷新间隔（ms），控制资源栏等 UI 更新频率 */
const UI_REFRESH_INTERVAL = 1000;

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
  const [offlineReward, setOfflineReward] = useState<any>(null);

  // ── 功能面板状态 ──
  const [openFeature, setOpenFeature] = useState<FeaturePanelId | null>(null);

  // ── 首次启动欢迎弹窗 ──
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const hasVisited = localStorage.getItem('tk-has-visited');
    if (!hasVisited) {
      setShowWelcome(true);
      localStorage.setItem('tk-has-visited', 'true');
    }
  }, []);

  // ── 事件系统状态 ──
  const [activeBanner, setActiveBanner] = useState<any>(null);
  const [activeEncounter, setActiveEncounter] = useState<any>(null);
  const [activeStoryEvent, setActiveStoryEvent] = useState<any>(null);

  // ── 缩放计算 — 根据视口大小动态设置 --tk-scale CSS变量 ──
  useEffect(() => {
    const updateScale = () => {
      const gameWidth = 1280;
      const gameHeight = 800;
      const containerWidth = window.innerWidth;
      const containerHeight = window.innerHeight;
      const scaleX = containerWidth / gameWidth;
      const scaleY = containerHeight / gameHeight;
      const scale = Math.min(scaleX, scaleY, 1);
      document.documentElement.style.setProperty('--tk-scale', scale.toString());
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // ── 引擎初始化（只执行一次） ──
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const offlineEarnings = engine.load();
      if (!offlineEarnings) {
        engine.init();
      } else {
        const hasEarnings = offlineEarnings.earned.grain > 0
          || offlineEarnings.earned.gold > 0
          || offlineEarnings.earned.troops > 0
          || offlineEarnings.earned.mandate > 0;
        if (hasEarnings) {
          setOfflineReward(offlineEarnings);
        }
      }
    } catch (e) {
      console.error('Failed to load save:', e);
      Toast.danger('存档加载失败，已重置');
    }

    setSnapshotVersion(1);
  }, [engine]);

  // ── 引擎 tick 循环 ──
  useEffect(() => {
    const timer = setInterval(() => {
      try {
        engine.tick(TICK_INTERVAL);
      } catch (e) {
        console.error('[ThreeKingdomsGame] Tick failed:', e);
      }
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

  // ── 引擎事件监听（拆分到自定义 Hook） ──
  const handleRefresh = useCallback(() => setSnapshotVersion(v => v + 1), []);
  const handleBannerCreated = useCallback((data: any) => setActiveBanner(data), []);
  const handleEncounterTriggered = useCallback((data: any) => setActiveEncounter(data), []);
  const handleStoryTriggered = useCallback((act: any) => setActiveStoryEvent(act), []);
  const handleStoryCompleted = useCallback(() => setActiveStoryEvent(null), []);

  useEngineEvents({
    engine,
    onRefresh: handleRefresh,
    onBannerCreated: handleBannerCreated,
    onEncounterTriggered: handleEncounterTriggered,
    onStoryTriggered: handleStoryTriggered,
    onStoryCompleted: handleStoryCompleted,
  });

  // ── 获取引擎快照 ──
  const snapshot: EngineSnapshot = useMemo(() => {
    void snapshotVersion;
    try {
      return engine.getSnapshot();
    } catch (e) {
      console.error('[ThreeKingdomsGame] getSnapshot failed:', e);
      const defaultBuildingState = (type: BuildingType): BuildingState => ({
        type,
        level: 0,
        status: 'locked',
        upgradeStartTime: null,
        upgradeEndTime: null,
      });
      return {
        resources: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        productionRates: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        caps: { grain: 0, gold: null, troops: 0, mandate: null },
        buildings: {
          castle: defaultBuildingState('castle'),
          farmland: defaultBuildingState('farmland'),
          market: defaultBuildingState('market'),
          barracks: defaultBuildingState('barracks'),
          smithy: defaultBuildingState('smithy'),
          academy: defaultBuildingState('academy'),
          clinic: defaultBuildingState('clinic'),
          wall: defaultBuildingState('wall'),
        },
        calendar: {
          date: { year: 1, month: 1, day: 1, season: 'spring', eraName: '建安', yearInEra: 1 },
          weather: 'clear',
          totalDays: 0,
          paused: false,
        },
        onlineSeconds: 0,
        heroes: [],
        heroFragments: {},
        totalPower: 0,
        formations: [],
        activeFormationId: null,
        campaignProgress: { currentChapterId: '', stageStates: {}, lastClearTime: 0 },
        techState: { nodes: {}, researchQueue: [], techPoints: { current: 0, totalEarned: 0, totalSpent: 0 }, chosenMutexNodes: {} },
      } satisfies EngineSnapshot;
    }
  }, [engine, snapshotVersion]);

  const { resources, productionRates, caps, buildings, calendar } = snapshot;

  // ── 建筑升级完成回调 ──
  const handleUpgradeComplete = useCallback((type: BuildingType) => {
    setSnapshotVersion(v => v + 1);
    Toast.success(`${type} 升级成功！`);
  }, []);

  // ── 建筑升级确认（由 BuildingPanel 调用） ──
  const handleUpgradeError = useCallback((error: Error) => {
    Toast.danger(error.message || '升级失败');
  }, []);

  // ── 离线收益领取回调 ──
  const handleOfflineClaim = useCallback(() => {
    setOfflineReward(null);
    Toast.success('离线收益已领取！');
  }, []);

  // ── Tab 切换 ──
  const handleTabChange = useCallback((tab: TabConfig) => {
    if (!tab.available) {
      Toast.info('敬请期待');
      return;
    }
    setActiveTab(tab.id);
  }, []);

  // ── 功能菜单选择 ──
  const handleFeatureSelect = useCallback((id: string) => {
    const tabId = FEATURE_TO_TAB[id];
    if (tabId) {
      setActiveTab(tabId);
    } else {
      setOpenFeature(id as FeaturePanelId);
    }
  }, []);

  // ── 功能面板关闭 ──
  const handleFeatureClose = useCallback(() => {
    setOpenFeature(null);
  }, []);

  // ── 事件系统回调 ──
  const handleBannerDismiss = useCallback((_bannerId: string) => {
    setActiveBanner(null);
  }, []);

  const handleEncounterSelectOption = useCallback((instanceId: string, optionId: string) => {
    setActiveEncounter(null);

    try {
      const registry = (engine as any).registry;
      const triggerSys = registry?.get?.('eventTrigger');
      const result = triggerSys?.resolveEvent?.(instanceId, optionId);

      if (result?.consequences) {
        const cons = result.consequences;
        if (cons.resourceChanges && typeof cons.resourceChanges === 'object' && !Array.isArray(cons.resourceChanges)) {
          for (const [key, val] of Object.entries(cons.resourceChanges)) {
            const numVal = val as number;
            if (numVal !== 0) {
              engine.resource.addResource(key as any, numVal);
            }
          }
          const changeDesc = Object.entries(cons.resourceChanges)
            .filter(([, v]) => v !== 0)
            .map(([k, v]) => `${RESOURCE_LABELS[k as keyof typeof RESOURCE_LABELS] ?? k}${(v as number) > 0 ? '+' : ''}${v}`)
            .join(' ');
          Toast.success(`事件已处理${changeDesc ? '：' + changeDesc : ''}`);
        } else if (cons.description) {
          Toast.success(cons.description);
        } else {
          Toast.success('已做出选择！');
        }
      } else {
        Toast.success('已做出选择！');
      }
    } catch {
      Toast.success('已做出选择！');
    }
  }, [engine]);

  const handleEncounterClose = useCallback(() => {
    setActiveEncounter(null);
  }, []);

  // ── 功能菜单项（动态计算 badge） ──
  const featureMenuItems = useMemo(() => {
    return FEATURE_ITEMS.map(item => {
      let badge = 0;
      if (item.id === 'events') {
        const activeEvents = (snapshot as any).activeEvents as any[] | undefined;
        badge = activeEvents?.length ?? 0;
      }
      if (item.id === 'mail') {
        const mailSys = (engine as any).mail ?? (engine as any).getMailSystem?.();
        badge = mailSys?.getUnreadCount?.() ?? 0;
      }
      return { ...item, badge };
    });
  }, [snapshotVersion]);

  // ── 首次启动欢迎弹窗回调 ──
  const handleWelcomeClose = useCallback(() => {
    setShowWelcome(false);
    try {
      const registry = engine?.getSubsystemRegistry?.();
      const tutorialSM = registry?.get?.('tutorial') as any;
      const phase = tutorialSM?.getCurrentPhase?.();
      if (phase && phase !== 'free_play' && phase !== 'mini_tutorial') {
        setActiveTab('hero');
      }
    } catch {}
  }, [engine]);

  // ── 主渲染 ──
  return (
    <div data-testid="tk-three-kingdoms-game" className="tk-game-root">
      <div className="tk-game-frame">
        {/* A区：资源栏 */}
        <ResourceBar
          resources={resources}
          rates={productionRates}
          caps={caps}
          buildings={buildings}
        />

        {/* 急报横幅（资源栏下方） */}
        <EventBanner
          banner={activeBanner}
          onDismiss={handleBannerDismiss}
        />

        {/* C区：场景区 — flex:1 撑满中间空间 */}
        <div className="tk-scene-area">
          <SceneRouter
            activeTab={activeTab}
            engine={engine}
            snapshotVersion={snapshotVersion}
            snapshot={snapshot}
            onUpgradeComplete={handleUpgradeComplete}
            onUpgradeError={handleUpgradeError}
            onOpenFeature={(id) => setOpenFeature(id)}
          />
        </div>

        {/* B区：Tab 栏 — 固定底部 */}
        <TabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          featureMenuItems={featureMenuItems}
          onFeatureSelect={handleFeatureSelect}
          calendar={calendar}
        />
      </div>

      {/* 离线收益弹窗 */}
      {offlineReward && (
        <OfflineRewardModal
          reward={offlineReward}
          onClaim={handleOfflineClaim}
        />
      )}

      {/* 首次启动欢迎弹窗 */}
      <WelcomeModal
        visible={showWelcome}
        onClose={handleWelcomeClose}
      />

      {/* ═══ 功能面板弹窗 ═══ */}
      <FeaturePanelOverlay
        engine={engine}
        snapshotVersion={snapshotVersion}
        openFeature={openFeature}
        onClose={handleFeatureClose}
      />

      {/* 随机遭遇弹窗（全局覆盖层） */}
      <RandomEncounterModal
        visible={activeEncounter !== null}
        event={activeEncounter}
        onSelectOption={handleEncounterSelectOption}
        onClose={handleEncounterClose}
      />

      {/* 剧情事件弹窗（全局覆盖层） */}
      {activeStoryEvent && (
        <StoryEventModal
          event={activeStoryEvent}
          onSelect={(choiceId: string) => {
            const registry = (engine as any).registry;
            const storySys = registry?.get?.('storyEvent');
            if (storySys) {
              const state = storySys.getState?.();
              const progresses = state?.progresses;
              let activeStoryId: string | null = null;
              if (progresses) {
                progresses.forEach((p: any, id: string) => {
                  if (p.triggered && !p.completed && p.currentActId && !activeStoryId) {
                    activeStoryId = id;
                  }
                });
              }
              if (activeStoryId) storySys.advanceStory(activeStoryId);
            }
            setActiveStoryEvent(null);
          }}
          onDismiss={() => setActiveStoryEvent(null)}
        />
      )}
    </div>
  );
};

ThreeKingdomsGame.displayName = 'ThreeKingdomsGame';

export default ThreeKingdomsGame;
