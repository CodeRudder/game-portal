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
import { ThreeKingdomsEngine, shouldShowOfflinePopup, BUILDING_DEFS } from '@/games/three-kingdoms/engine';
import { RESOURCE_LABELS } from '@/games/three-kingdoms/engine';
import type {
  EngineSnapshot,
  BuildingType,
  BuildingState,
  ResourceType,
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
  type TabBadges,
  FEATURE_ITEMS,
  FEATURE_TO_TAB,
} from './three-kingdoms/TabBar';
import OfflineRewardModal from './three-kingdoms/OfflineRewardModal';
import WelcomeModal from './three-kingdoms/WelcomeModal';
import SceneRouter from './three-kingdoms/SceneRouter';
import { useEngineEvents } from './three-kingdoms/useEngineEvents';
import FeaturePanelOverlay, { type FeaturePanelId } from './three-kingdoms/FeaturePanelOverlay';
import { GameErrorBoundary } from './three-kingdoms/GameErrorBoundary';

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
  const [engineError, setEngineError] = useState<Error | null>(null);

  if (!engineRef.current && !engineError) {
    try {
      engineRef.current = new ThreeKingdomsEngine();
    } catch (e) {
      console.error('[ThreeKingdoms] 引擎创建失败:', e);
      setEngineError(e instanceof Error ? e : new Error(String(e)));
    }
  }
  const engine = engineRef.current;

  // ── UI 状态 ──
  const [activeTab, setActiveTab] = useState<TabId>('building');
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [offlineReward, setOfflineReward] = useState<any>(null);

  // ── 功能面板状态 ──
  const [openFeature, setOpenFeature] = useState<FeaturePanelId | null>(null);

  // ── 「更多」Tab 已改为在主内容区显示网格列表（MoreTab），不再需要下拉菜单状态 ──

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
    if (!engine) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const offlineEarnings = engine.load();
      if (!offlineEarnings) {
        engine.init();
      } else {
        // 只有离线超过 300 秒（5分钟）才弹出离线收益弹窗
        if (shouldShowOfflinePopup(offlineEarnings.offlineSeconds)) {
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
    if (!engine) return;
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
    if (!engine) {
      // 返回默认快照，避免在引擎为 null 时崩溃
      const defaultBuildingState = (type: BuildingType): BuildingState => ({
        type,
        level: 0,
        status: 'locked',
        upgradeStartTime: null,
        upgradeEndTime: null,
      });
      return {
        resources: { grain: 0, gold: 0, ore: 0, wood: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 },
        productionRates: { grain: 0, gold: 0, ore: 0, wood: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 },
        caps: { grain: 0, gold: 0, ore: 0, wood: 0, troops: 0, mandate: null, techPoint: null, recruitToken: null, skillBook: null },
        buildings: {
          castle: defaultBuildingState('castle'),
          farmland: defaultBuildingState('farmland'),
          market: defaultBuildingState('market'),
          mine: defaultBuildingState('mine'),
          lumberMill: defaultBuildingState('lumberMill'),
          barracks: defaultBuildingState('barracks'),
          workshop: defaultBuildingState('workshop'),
          academy: defaultBuildingState('academy'),
          clinic: defaultBuildingState('clinic'),
          wall: defaultBuildingState('wall'),
          tavern: defaultBuildingState('tavern'),
          port: defaultBuildingState('port'),
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
        resources: { grain: 0, gold: 0, ore: 0, wood: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 },
        productionRates: { grain: 0, gold: 0, ore: 0, wood: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 },
        caps: { grain: 0, gold: 0, ore: 0, wood: 0, troops: 0, mandate: null, techPoint: null, recruitToken: null, skillBook: null },
        buildings: {
          castle: defaultBuildingState('castle'),
          farmland: defaultBuildingState('farmland'),
          market: defaultBuildingState('market'),
          mine: defaultBuildingState('mine'),
          lumberMill: defaultBuildingState('lumberMill'),
          barracks: defaultBuildingState('barracks'),
          workshop: defaultBuildingState('workshop'),
          academy: defaultBuildingState('academy'),
          clinic: defaultBuildingState('clinic'),
          wall: defaultBuildingState('wall'),
          tavern: defaultBuildingState('tavern'),
          port: defaultBuildingState('port'),
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

  // ── ACC-03 P0: 溢出预判 — 计算即将到来的资源收益（pendingGains） ──
  // 从生产速率推算下一个周期（60秒）内即将入账的资源量，
  // 用于 ResourceBar 的 overflowWarnings 横幅预判。
  const pendingGains = useMemo(() => {
    if (!engine) return undefined;
    try {
      const gains: Partial<Record<string, number>> = {};
      // 使用 snapshot 中已有的 productionRates，推算 60 秒内的产出
      for (const [resType, rate] of Object.entries(productionRates)) {
        if (typeof rate === 'number' && rate > 0) {
          // 60 秒内的预期收益
          gains[resType] = rate * 60;
        }
      }
      return Object.keys(gains).length > 0 ? gains : undefined;
    } catch {
      return undefined;
    }
  }, [engine, productionRates]);

  // ── 建筑升级完成回调 ──
  // Fix #2: 升级完成后在资源栏显示产出变化浮动数字
  const [floatingChanges, setFloatingChanges] = useState<Array<{
    id: number;
    type: ResourceType;
    value: number;
  }>>([]);
  const floatingIdRef = useRef(0);

  const handleUpgradeComplete = useCallback((type: BuildingType) => {
    setSnapshotVersion(v => v + 1);
    Toast.success(`${type} 升级成功！`);

    // Fix #2: 计算产出变化并显示浮动数字
    try {
      if (!engine) return;
      const snap = engine.getSnapshot();
      const def = BUILDING_DEFS[type];
      if (def?.production) {
        const state = snap.buildings[type];
        const currentLevelData = def.levelTable[state.level - 1];
        const prevLevelData = def.levelTable[state.level - 2];
        if (currentLevelData && prevLevelData) {
          const diff = currentLevelData.production - prevLevelData.production;
          if (diff > 0) {
            const id = ++floatingIdRef.current;
            setFloatingChanges(prev => [...prev, {
              id,
              type: def.production!.resourceType as ResourceType,
              value: diff,
            }]);
            // 2秒后移除浮动数字
            setTimeout(() => {
              setFloatingChanges(prev => prev.filter(c => c.id !== id));
            }, 2100);
          }
        }
      }
      // 主城加成：显示所有资源的变化
      if (type === 'castle') {
        const state = snap.buildings[type];
        const castleDef = BUILDING_DEFS.castle;
        const currentLevelData = castleDef.levelTable[state.level - 1];
        const prevLevelData = castleDef.levelTable[state.level - 2];
        if (currentLevelData && prevLevelData) {
          const bonusDiff = currentLevelData.production - prevLevelData.production;
          if (bonusDiff > 0) {
            // 对每种有产出的资源都显示浮动数字
            const resourceTypes: ResourceType[] = ['grain', 'gold', 'troops'];
            resourceTypes.forEach((resType, idx) => {
              const rate = snap.productionRates[resType] ?? 0;
              if (rate > 0) {
                const gain = rate * bonusDiff / 100;
                const id = ++floatingIdRef.current;
                setTimeout(() => {
                  setFloatingChanges(prev => [...prev, {
                    id,
                    type: resType,
                    value: gain,
                  }]);
                  setTimeout(() => {
                    setFloatingChanges(prev => prev.filter(c => c.id !== id));
                  }, 2100);
                }, idx * 200); // 错开显示
              }
            });
          }
        }
      }
    } catch (e) {
      // 浮动数字是增强功能，出错不影响主流程
    }
  }, [engine]);

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
    // ACC-01-35 修复：切换Tab时自动关闭功能面板，避免内容重叠
    setOpenFeature(null);
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

    if (!engine) return;
    try {
      const registry = engine.getSubsystemRegistry();
      const triggerSys = registry?.get?.('eventTrigger') as any;
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
        const mailSys = engine?.getSubsystemRegistry?.()?.get?.('mail') as any;
        badge = mailSys?.getUnreadCount?.() ?? 0;
      }
      return { ...item, badge };
    });
  }, [snapshotVersion]);

  // ── Tab 红点 badge（由引擎 HeroBadgeSystem 驱动） ──
  const tabBadges: TabBadges = useMemo(() => {
    if (!engine) return {};

    try {
      const badgeSystem = engine.getHeroBadgeSystem();
      const state = badgeSystem.getState();
      const badges: TabBadges = {};

      // 武将 Tab：聚合可升级 + 可升星数量
      const heroBadgeCount = state.tabLevelBadge + state.tabStarBadge;
      if (heroBadgeCount > 0) {
        badges.hero = { count: heroBadgeCount };
      }

      // 主界面入口红点 — 映射到"天下"Tab
      if (state.mainEntryRedDot) {
        badges.map = { dot: true };
      }

      return badges;
    } catch {
      return {};
    }
  }, [engine, snapshotVersion]);

  // ── 首次启动欢迎弹窗回调 ──
  const handleWelcomeClose = useCallback(() => {
    setShowWelcome(false);
    if (!engine) return;
    try {
      const registry = engine?.getSubsystemRegistry?.();
      const tutorialSM = registry?.get?.('tutorial') as any;
      const phase = tutorialSM?.getCurrentPhase?.();
      if (phase && phase !== 'free_play' && phase !== 'mini_tutorial') {
        setActiveTab('hero');
      }
    } catch {}
  }, [engine]);

  // ── 欢迎弹窗 → 引导链路：关闭欢迎弹窗后自动切换到武将Tab触发引导 ──
  const handleWelcomeStartGuide = useCallback(() => {
    setShowWelcome(false);
    // 切换到武将Tab，触发GuideOverlay的GuideWelcomeModal显示
    setActiveTab('hero');
  }, []);

  // ── 主渲染 ──
  // 引擎创建失败 — 显示错误页面（必须在所有 hooks 之后）
  if (!engine) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0a0a1a',
        color: '#e0e0e0',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚔️</div>
        <h2 style={{ color: '#ff6b6b' }}>引擎初始化失败</h2>
        <p style={{ color: '#aaa', marginTop: '8px', maxWidth: '400px', textAlign: 'center' }}>
          {engineError?.message || '未知错误'}
        </p>
        <button
          onClick={() => { localStorage.clear(); window.location.reload(); }}
          style={{
            marginTop: '16px',
            padding: '10px 24px',
            background: '#4a90d9',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          🔄 清除数据并重试
        </button>
      </div>
    );
  }

  return (
    <GameErrorBoundary>
    <div data-testid="tk-three-kingdoms-game" className="tk-game-root">
      <div className="tk-game-frame">
        {/* A区：资源栏 */}
        <ResourceBar
          resources={resources}
          rates={productionRates}
          caps={caps}
          buildings={buildings}
          pendingGains={pendingGains}
          floatingChanges={floatingChanges}
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
          tabBadges={tabBadges}
        />
      </div>

      {/* 离线收益弹窗 */}
      {offlineReward && (
        <OfflineRewardModal
          reward={offlineReward}
          onClaim={handleOfflineClaim}
        />
      )}

      {/* 首次启动欢迎弹窗 — 整合引导入口，避免双层弹窗 */}
      <WelcomeModal
        visible={showWelcome}
        onClose={handleWelcomeClose}
        showGuideEntry={(() => {
          try {
            const progress = localStorage.getItem('tk-tutorial-progress');
            if (!progress) return true; // 无引导记录 → 需要引导
            const data = JSON.parse(progress);
            return !data.completed; // 引导未完成 → 需要引导
          } catch { return true; }
        })()}
        onStartGuide={handleWelcomeStartGuide}
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
            const registry = engine?.getSubsystemRegistry?.();
            const storySys = registry?.get?.('storyEventPlayer') as any;
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
    </GameErrorBoundary>
  );
};

ThreeKingdomsGame.displayName = 'ThreeKingdomsGame';

export default ThreeKingdomsGame;
