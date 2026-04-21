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
import type { Season, WeatherType } from '@/games/three-kingdoms/engine/calendar/calendar.types';
import { SEASON_LABELS, WEATHER_LABELS } from '@/games/three-kingdoms/engine/calendar/calendar.types';
import { Toast } from '@/components/idle/common/Toast';
import ResourceBar from '@/components/idle/panels/resource/ResourceBar';
import BuildingPanel from '@/components/idle/panels/building/BuildingPanel';
import HeroTab from '@/components/idle/panels/hero/HeroTab';
import CampaignTab from '@/components/idle/panels/campaign/CampaignTab';
import TechTab from '@/components/idle/panels/tech/TechTab';
import EquipmentTab from '@/components/idle/panels/equipment/EquipmentTab';
import ArenaTab from '@/components/idle/panels/arena/ArenaTab';
import Modal from '@/components/idle/common/Modal';
import type { OfflineEarnings } from '@/games/three-kingdoms/shared/types';
import FeatureMenu from '@/components/idle/FeatureMenu';
import type { FeatureMenuItem } from '@/components/idle/FeatureMenu';
import FeaturePanel from '@/components/idle/FeaturePanel';
import WorldMapTab from '@/components/idle/panels/map/WorldMapTab';
import NPCTab from '@/components/idle/panels/npc/NPCTab';
import EventBanner from '@/components/idle/panels/event/EventBanner';
import RandomEncounterModal from '@/components/idle/panels/event/RandomEncounterModal';
import { EquipmentBag, ArenaPanel, ExpeditionPanel } from '@/games/three-kingdoms/ui/components';
import ExpeditionTab from '@/components/idle/panels/expedition/ExpeditionTab';
import ArmyTab from '@/components/idle/panels/army/ArmyTab';
import MailPanel from '@/components/idle/panels/mail/MailPanel';
import SocialPanel from '@/components/idle/panels/social/SocialPanel';
import HeritagePanel from '@/components/idle/panels/heritage/HeritagePanel';
import ActivityPanel from '@/components/idle/panels/activity/ActivityPanel';
import MoreTab from '@/components/idle/panels/more/MoreTab';
import QuestPanel from '@/components/idle/panels/quest/QuestPanel';
import ShopPanel from '@/components/idle/panels/shop/ShopPanel';
import AchievementPanel from '@/components/idle/panels/achievement/AchievementPanel';
import AlliancePanel from '@/components/idle/panels/alliance/AlliancePanel';
import PrestigePanel from '@/components/idle/panels/prestige/PrestigePanel';
import './ThreeKingdomsGame.css';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 引擎 tick 间隔（ms） */
const TICK_INTERVAL = 500;

/** UI 刷新间隔（ms），控制资源栏等 UI 更新频率 */
const UI_REFRESH_INTERVAL = 1000;

/** 天气图标映射 */
const WEATHER_ICONS: Record<WeatherType, string> = {
  clear: '☀️',
  rain: '🌧️',
  snow: '❄️',
  wind: '🌬️',
};

/** 季节图标映射 */
const SEASON_ICONS: Record<Season, string> = {
  spring: '🌸',
  summer: '🌞',
  autumn: '🍂',
  winter: '❄️',
};

/** Tab 类型定义 */
type TabId = 'building' | 'hero' | 'tech' | 'campaign' | 'map' | 'npc' | 'equipment' | 'arena' | 'expedition' | 'army' | 'more';

/** Tab 配置 */
interface TabConfig {
  id: TabId;
  icon: string;
  label: string;
  available: boolean;
}

const TABS: TabConfig[] = [
  { id: 'building', icon: '🏰', label: '建筑', available: true },
  { id: 'hero', icon: '🦸', label: '武将', available: true },
  { id: 'tech', icon: '📜', label: '科技', available: true },
  { id: 'campaign', icon: '⚔️', label: '关卡', available: true },
  { id: 'equipment', icon: '🛡️', label: '装备', available: true },
  { id: 'map', icon: '🗺️', label: '天下', available: true },
  { id: 'npc', icon: '👤', label: '名士', available: true },
  { id: 'arena', icon: '🏟️', label: '竞技', available: true },
  { id: 'expedition', icon: '🧭', label: '远征', available: true },
  { id: 'army', icon: '💪', label: '军队', available: true },
  { id: 'more', icon: '📋', label: '更多', available: true },
];

/** 功能菜单面板ID */
type FeaturePanelId = 'events' | 'quest' | 'shop' | 'mail' | 'achievement' | 'activity' | 'alliance' | 'prestige' | 'heritage' | 'social';

/** 功能菜单项配置（静态部分，badge 动态计算） */
const FEATURE_ITEMS: Array<Omit<FeatureMenuItem, 'badge'>> = [
  { id: 'worldmap', icon: '🗺️', label: '世界地图', description: '三国势力分布与领土管理', available: true },
  { id: 'equipment', icon: '🎒', label: '装备背包', description: '装备管理与穿戴', available: true },
  { id: 'arena', icon: '⚔️', label: '竞技场', description: 'PvP对战与赛季排名', available: true },
  { id: 'expedition', icon: '🚀', label: '远征', description: '探索未知领域', available: true },
  { id: 'events', icon: '⚡', label: '事件', description: '当前活跃事件', available: true },
  { id: 'npc', icon: '👥', label: 'NPC名册', description: '已发现的NPC角色', available: true },
  { id: 'mail', icon: '📬', label: '邮件', description: '系统邮件与奖励领取', available: true },
  { id: 'social', icon: '👥', label: '社交', description: '好友互动与排行榜', available: true },
  { id: 'heritage', icon: '⚔️', label: '传承', description: '武将装备经验传承', available: true },
  { id: 'activity', icon: '🎪', label: '活动', description: '限时活动与签到', available: true },
];

// ─────────────────────────────────────────────
// 日历格式化工具
// ─────────────────────────────────────────────

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] as const;

/** 数字转中文（1-99） */
function toChineseNumber(n: number): string {
  if (n <= 10) return CN_DIGITS[n];
  if (n < 20) return `十${n % 10 === 0 ? '' : CN_DIGITS[n % 10]}`;
  if (n < 100 && n % 10 === 0) return `${CN_DIGITS[Math.floor(n / 10)]}十`;
  return `${CN_DIGITS[Math.floor(n / 10)]}十${CN_DIGITS[n % 10]}`;
}

/** 年号内年数转中文 */
function toChineseYear(n: number): string {
  return toChineseNumber(n);
}

/** 日期转中文（带"初"前缀） */
function toChineseDay(day: number): string {
  if (day <= 10) return `初${CN_DIGITS[day]}`;
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  if (day < 20) return `十${CN_DIGITS[day % 10]}`;
  return `二十${CN_DIGITS[day % 10]}`;
}

/** 格式化游戏日期为中文显示 */
function formatGameDate(date: { month: number; day: number }): string {
  const monthStr = date.month === 1 ? '正月' : `${toChineseNumber(date.month)}月`;
  const dayStr = toChineseDay(date.day);
  return `${monthStr}${dayStr}`;
}

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
  const [offlineReward, setOfflineReward] = useState<OfflineEarnings | null>(null);

  // ── 功能面板状态 ──
  const [openFeature, setOpenFeature] = useState<FeaturePanelId | null>(null);

  // ── P1-01: 事件系统状态 ──
  const [activeBanner, setActiveBanner] = useState<any>(null);
  const [activeEncounter, setActiveEncounter] = useState<any>(null);

  // ── 引擎初始化（只执行一次） ──
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // 尝试加载存档，无存档则新游戏
    const offlineEarnings = engine.load();
    if (!offlineEarnings) {
      engine.init();
    } else {
      // 有离线收益，弹出领取弹窗
      const hasEarnings = offlineEarnings.earned.grain > 0
        || offlineEarnings.earned.gold > 0
        || offlineEarnings.earned.troops > 0
        || offlineEarnings.earned.mandate > 0;
      if (hasEarnings) {
        setOfflineReward(offlineEarnings);
      }
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

  // ── P1-01: 事件系统监听（急报横幅 + 随机遭遇弹窗） ──
  useEffect(() => {
    const handleBannerCreated = (data: any) => {
      setActiveBanner({
        id: data.bannerId ?? `banner-${Date.now()}`,
        eventId: data.eventId ?? '',
        title: data.title ?? '急报',
        content: data.content ?? '',
        icon: data.icon ?? '📢',
        priority: data.priority ?? 'normal',
        displayDuration: data.displayDuration ?? 5000,
        createdAt: Date.now(),
        read: false,
      });
    };

    const handleEncounterTriggered = (data: any) => {
      setActiveEncounter(data.event ?? null);
    };

    engine.on('event:banner_created' as any, handleBannerCreated);
    engine.on('event:encounter_triggered' as any, handleEncounterTriggered);

    return () => {
      engine.off('event:banner_created' as any, handleBannerCreated);
      engine.off('event:encounter_triggered' as any, handleEncounterTriggered);
    };
  }, [engine]);

  // ── 获取引擎快照 ──
  const snapshot: EngineSnapshot = useMemo(() => {
    // snapshotVersion 作为依赖触发重计算
    void snapshotVersion;
    return engine.getSnapshot();
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

  // ── 离线收益格式化 ──
  const formatOfflineDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.floor(seconds)}秒`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}天${h % 24}小时`;
    if (h > 0) return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
    return `${m}分钟`;
  };

  // ── Tab 切换 ──
  const handleTabChange = useCallback((tab: TabConfig) => {
    if (!tab.available) {
      Toast.info('敬请期待');
      return;
    }
    setActiveTab(tab.id);
  }, []);

  // ── 功能菜单选择 ──
  // 已有独立Tab的功能（worldmap→map, equipment, arena, expedition, npc）直接切换到对应Tab
  // 仅 events 等无独立Tab的功能使用 FeaturePanel 弹窗
  const FEATURE_TO_TAB: Record<string, TabId> = {
    worldmap: 'map',
    equipment: 'equipment',
    arena: 'arena',
    expedition: 'expedition',
    npc: 'npc',
  };

  const handleFeatureSelect = useCallback((id: string) => {
    const tabId = FEATURE_TO_TAB[id];
    if (tabId) {
      // 有独立Tab → 直接切换，不弹窗
      setActiveTab(tabId);
    } else {
      // 无独立Tab → 使用 FeaturePanel 弹窗
      setOpenFeature(id as FeaturePanelId);
    }
  }, []);

  // ── 功能面板关闭 ──
  const handleFeatureClose = useCallback(() => {
    setOpenFeature(null);
  }, []);

  // ── P1-01: 事件系统回调 ──
  const handleBannerDismiss = useCallback((_bannerId: string) => {
    setActiveBanner(null);
  }, []);

  const handleEncounterSelectOption = useCallback((_instanceId: string, _optionId: string) => {
    setActiveEncounter(null);
    Toast.success('已做出选择！');
  }, []);

  const handleEncounterClose = useCallback(() => {
    setActiveEncounter(null);
  }, []);

  // ── 功能菜单项（动态计算 badge） ──
  const featureMenuItems: FeatureMenuItem[] = useMemo(() => {
    return FEATURE_ITEMS.map(item => {
      let badge = 0;
      // 事件面板显示活跃事件数
      if (item.id === 'events') {
        const activeEvents = (snapshot as any).activeEvents as any[] | undefined;
        badge = activeEvents?.length ?? 0;
      }
      // 邮件面板显示未读数
      if (item.id === 'mail') {
        const mailSys = (engine as any).mail ?? (engine as any).getMailSystem?.();
        badge = mailSys?.getUnreadCount?.() ?? 0;
      }
      return { ...item, badge };
    });
  }, [snapshotVersion]);

  // ── 世界地图数据 ──
  const worldMapData = useMemo(() => {
    const territorySys = engine.getTerritorySystem();
    const territories = territorySys.getAllTerritories();
    const productionSummary = territorySys.getPlayerProductionSummary();
    return { territories, productionSummary };
  }, [engine, snapshotVersion]);

  // ── NPC 数据（使用引擎 NPC 系统，若可用） ──
  const npcData = useMemo(() => {
    // 尝试从引擎获取 NPC 系统
    const npcSys = (engine as any).npcSystem;
    if (npcSys && typeof npcSys.getAllNPCs === 'function') {
      return npcSys.getAllNPCs();
    }
    // 备用：返回空数组（NPC系统尚未集成到引擎时）
    return [];
  }, [engine, snapshotVersion]);

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
            snapshotVersion={snapshotVersion}
            onUpgradeComplete={handleUpgradeComplete}
            onUpgradeError={handleUpgradeError}
          />
        );

      case 'hero':
        return (
          <HeroTab
            engine={engine}
            snapshotVersion={snapshotVersion}
          />
        );

      case 'tech':
        return (
          <TechTab
            engine={engine}
            snapshotVersion={snapshotVersion}
          />
        );

      case 'campaign':
        return (
          <CampaignTab
            engine={engine}
            snapshotVersion={snapshotVersion}
          />
        );

      case 'equipment':
        return (
          <EquipmentTab
            engine={engine}
            snapshotVersion={snapshotVersion}
          />
        );

      case 'map':
        return (
          <WorldMapTab
            territories={worldMapData.territories}
            productionSummary={worldMapData.productionSummary}
            snapshotVersion={snapshotVersion}
            onSelectTerritory={(id) => {
              Toast.info(`选中领土: ${id}`);
            }}
            onSiegeTerritory={(id) => {
              Toast.info(`发起攻城: ${id}`);
            }}
          />
        );

      case 'npc':
        return (
          <NPCTab
            npcs={npcData}
            onSelectNPC={(npcId) => Toast.info(`查看NPC: ${npcId}`)}
            onStartDialog={(npcId) => Toast.info(`与NPC对话: ${npcId}`)}
          />
        );

      case 'arena':
        return (
          <ArenaTab
            engine={engine}
            snapshotVersion={snapshotVersion}
          />
        );

      case 'expedition':
        return (
          <ExpeditionTab
            engine={engine}
            snapshotVersion={snapshotVersion}
          />
        );

      case 'army':
        return (
          <ArmyTab
            engine={engine}
            snapshotVersion={snapshotVersion}
          />
        );

      case 'more':
        return (
          <MoreTab
            engine={engine}
            snapshotVersion={snapshotVersion}
            onOpenPanel={(id) => setOpenFeature(id as FeaturePanelId)}
          />
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

        {/* P1-01: 急报横幅（资源栏下方） */}
        <EventBanner
          banner={activeBanner}
          onDismiss={handleBannerDismiss}
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

          {/* 功能菜单按钮 */}
          <FeatureMenu
            items={featureMenuItems}
            onSelect={handleFeatureSelect}
          />

          {/* 日历信息（右侧） — 接入 CalendarSystem 实时数据 */}
          <div className="tk-calendar">
            <span className="tk-calendar-era">
              {calendar?.date
                ? `${calendar.date.eraName}${calendar.date.yearInEra === 1 ? '元年' : `${toChineseYear(calendar.date.yearInEra)}年`}`
                : '建安元年'}
            </span>
            <span className="tk-calendar-season">
              {calendar?.date
                ? `${SEASON_ICONS[calendar.date.season]} ${SEASON_LABELS[calendar.date.season]}`
                : '🌸 春'}
            </span>
            <span className="tk-calendar-weather">
              {calendar
                ? `${WEATHER_ICONS[calendar.weather]} ${WEATHER_LABELS[calendar.weather]}`
                : '☀️ 晴'}
            </span>
            <span className="tk-calendar-date">
              {calendar?.date ? formatGameDate(calendar.date) : '正月初一'}
            </span>
          </div>
        </div>

        {/* C区：场景区 */}
        <div className="tk-scene-area">
          {renderSceneContent()}
        </div>
      </div>

      {/* 离线收益弹窗 */}
      {offlineReward && (
        <Modal
          visible
          type="info"
          title="离线收益"
          confirmText="领取收益"
          onConfirm={handleOfflineClaim}
          onCancel={handleOfflineClaim}
          width="420px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: '#e8e0d0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', fontSize: '13px' }}>
              <span>⏱ 离线时长：{formatOfflineDuration(offlineReward.offlineSeconds)}</span>
              {offlineReward.isCapped && <span style={{ color: '#e8a735' }}>⚠️ 已达上限</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {([
                { key: 'grain' as const, label: '粮草', icon: '🌾', color: '#7EC850' },
                { key: 'gold' as const, label: '铜钱', icon: '💰', color: '#C9A84C' },
                { key: 'troops' as const, label: '兵力', icon: '⚔️', color: '#B8423A' },
                { key: 'mandate' as const, label: '天命', icon: '✨', color: '#7B5EA7' },
              ]).map(({ key, label, icon, color }) => {
                const val = offlineReward.earned[key];
                if (val <= 0) return null;
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                    <span>{icon}</span>
                    <span>{label}</span>
                    <span style={{ color, marginLeft: 'auto', fontWeight: 600 }}>+{Math.floor(val).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* ═══ 功能面板弹窗 ═══ */}
      {/* worldmap/equipment/arena/expedition/npc 已有独立Tab，不再重复渲染 FeaturePanel */}

      {/* P1-01: 事件系统 */}
      <FeaturePanel
        visible={openFeature === 'events'}
        title="事件"
        icon="⚡"
        width="520px"
        onClose={handleFeatureClose}
      >
        <div style={{ padding: '16px', color: '#e8e0d0' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#d4a574', marginBottom: '12px' }}>
            📨 当前事件
          </div>
          <div style={{ textAlign: 'center', padding: '24px', color: '#666', fontSize: '13px' }}>
            暂无活跃事件
          </div>
        </div>
      </FeaturePanel>

      {/* Tier 3: 邮件系统 */}
      <FeaturePanel
        visible={openFeature === 'mail'}
        title="邮件"
        icon="📬"
        width="520px"
        onClose={handleFeatureClose}
      >
        <MailPanel engine={engine} />
      </FeaturePanel>

      {/* Tier 3: 社交系统 */}
      <FeaturePanel
        visible={openFeature === 'social'}
        title="社交"
        icon="👥"
        width="520px"
        onClose={handleFeatureClose}
      >
        <SocialPanel engine={engine} />
      </FeaturePanel>

      {/* Tier 3: 传承系统 */}
      <FeaturePanel
        visible={openFeature === 'heritage'}
        title="传承"
        icon="⚔️"
        width="520px"
        onClose={handleFeatureClose}
      >
        <HeritagePanel engine={engine} />
      </FeaturePanel>

      {/* Tier 3: 活动系统 */}
      <FeaturePanel
        visible={openFeature === 'activity'}
        title="活动"
        icon="🎪"
        width="520px"
        onClose={handleFeatureClose}
      >
        <ActivityPanel engine={engine} />
      </FeaturePanel>

      {/* 任务系统 */}
      <FeaturePanel
        visible={openFeature === 'quest'}
        title="任务"
        icon="📋"
        width="520px"
        onClose={handleFeatureClose}
      >
        <QuestPanel engine={engine} />
      </FeaturePanel>

      {/* 商店系统 */}
      <FeaturePanel
        visible={openFeature === 'shop'}
        title="商店"
        icon="🏪"
        width="560px"
        onClose={handleFeatureClose}
      >
        <ShopPanel engine={engine} />
      </FeaturePanel>

      {/* 成就系统 */}
      <FeaturePanel
        visible={openFeature === 'achievement'}
        title="成就"
        icon="🏆"
        width="520px"
        onClose={handleFeatureClose}
      >
        <AchievementPanel engine={engine} />
      </FeaturePanel>

      {/* 联盟系统 */}
      <FeaturePanel
        visible={openFeature === 'alliance'}
        title="联盟"
        icon="🤝"
        width="520px"
        onClose={handleFeatureClose}
      >
        <AlliancePanel engine={engine} />
      </FeaturePanel>

      {/* 声望系统 */}
      <FeaturePanel
        visible={openFeature === 'prestige'}
        title="声望"
        icon="📊"
        width="520px"
        onClose={handleFeatureClose}
      >
        <PrestigePanel engine={engine} />
      </FeaturePanel>

      {/* npc 已有独立Tab，不再重复渲染 FeaturePanel */}

      {/* P1-01: 随机遭遇弹窗（全局覆盖层） */}
      <RandomEncounterModal
        visible={activeEncounter !== null}
        event={activeEncounter}
        onSelectOption={handleEncounterSelectOption}
        onClose={handleEncounterClose}
      />
    </div>
  );
};

ThreeKingdomsGame.displayName = 'ThreeKingdomsGame';

export default ThreeKingdomsGame;
