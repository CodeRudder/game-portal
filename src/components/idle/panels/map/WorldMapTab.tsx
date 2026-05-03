/**
 * WorldMapTab — 世界地图Tab主面板
 *
 * 功能：
 * - 领土网格地图：显示所有领土及其归属状态
 * - 筛选工具栏：按区域/地形/归属筛选
 * - 收益热力图：可视化各领土产出
 * - 产出气泡：已占领领土显示产出值
 * - 右侧信息面板：统计+选中领土详情
 *
 * PC端：左侧地图 + 右侧信息面板
 * 手机端：全屏地图 + 底部抽屉信息
 *
 * @module components/idle/panels/map/WorldMapTab
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type {
  RegionId,
  OwnershipStatus,
  LandmarkType,
} from '@/games/three-kingdoms/core/map';
import {
  REGION_IDS,
  REGION_LABELS,
  TERRAIN_TYPES,
  TERRAIN_LABELS,
} from '@/games/three-kingdoms/core/map';
import type {
  TerritoryData,
  TerritoryProductionSummary,
} from '@/games/three-kingdoms/core/map';
import { ASCIIMapParser } from '@/games/three-kingdoms/core/map/ASCIIMapParser';
import { buildWalkabilityGrid } from '@/games/three-kingdoms/engine/map/PathfindingSystem';
import { MarchingSystem } from '@/games/three-kingdoms/engine/map/MarchingSystem';
import type { MarchRoute, MarchUnit } from '@/games/three-kingdoms/engine/map/MarchingSystem';
import { ConquestAnimationSystem } from '@/games/three-kingdoms/engine/map/ConquestAnimation';
import worldMapText from '@/games/three-kingdoms/core/map/maps/world-map.txt?raw';
import TerritoryInfoPanel from './TerritoryInfoPanel';
import SiegeConfirmModal from './SiegeConfirmModal';
import SiegeResultModal from './SiegeResultModal';
import type { SiegeResultData } from './SiegeResultModal';
import OfflineRewardModal from './OfflineRewardModal';
import ProductionPanel from './ProductionPanel';
import type { OfflineEvent } from '@/games/three-kingdoms/engine/map/OfflineEventSystem';
import { formatNumber } from '@/components/idle/utils/formatNumber';
import { PixelWorldMap } from './PixelWorldMap';
import './WorldMapTab.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
export interface WorldMapTabProps {
  /** 所有领土数据 */
  territories: TerritoryData[];
  /** 产出汇总 */
  productionSummary: TerritoryProductionSummary | null;
  /** 快照版本号（用于触发重渲染） */
  snapshotVersion: number;
  /** 引擎实例（用于攻城条件检查和执行） */
  engine?: any;
  /** 选中领土回调 */
  onSelectTerritory?: (id: string) => void;
  /** 发起攻城回调（若不传则WorldMapTab内部集成攻城流程） */
  onSiegeTerritory?: (id: string) => void;
  /** 升级领土回调 */
  onUpgradeTerritory?: (id: string) => void;
}

// ─────────────────────────────────────────────
// 类型常量
// ─────────────────────────────────────────────
const OWNERSHIP_OPTIONS: Array<{ value: OwnershipStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部归属' },
  { value: 'player', label: '己方' },
  { value: 'enemy', label: '敌方' },
  { value: 'neutral', label: '中立' },
];

const LANDMARK_OPTIONS: Array<{ value: LandmarkType | 'all'; label: string }> = [
  { value: 'all', label: '全部类型' },
  { value: 'capital', label: '都城' },
  { value: 'city', label: '城市' },
  { value: 'fortress', label: '要塞' },
  { value: 'village', label: '村庄' },
];

/** 热力图颜色计算：低→中→高 */
function getHeatmapColor(value: number, max: number): string {
  if (max <= 0) return 'transparent';
  const ratio = Math.min(value / max, 1);
  if (ratio < 0.33) return `rgba(52, 152, 219, ${0.1 + ratio * 0.6})`;
  if (ratio < 0.66) return `rgba(126, 200, 80, ${0.15 + ratio * 0.5})`;
  return `rgba(220, 160, 23, ${0.2 + ratio * 0.6})`;
}

/** 格式化产出数值 */
function formatProduction(val: number): string {
  return formatNumber(val);
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const WorldMapTab: React.FC<WorldMapTabProps> = ({
  territories,
  productionSummary,
  snapshotVersion,
  engine,
  onSelectTerritory,
  onSiegeTerritory,
  onUpgradeTerritory,
}) => {
  // ── 视图模式 ──
  const [viewMode, setViewMode] = useState<'pixel' | 'grid'>('pixel');

  // ── 筛选状态 ──
  const [regionFilter, setRegionFilter] = useState<RegionId | 'all'>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipStatus | 'all'>('all');
  const [landmarkFilter, setLandmarkFilter] = useState<LandmarkType | 'all'>('all');
  const [showHeatmap, setShowHeatmap] = useState(false);

  // ── 选中领土 ──
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── 攻城确认弹窗状态 ──
  const [siegeTarget, setSiegeTarget] = useState<TerritoryData | null>(null);
  const [siegeVisible, setSiegeVisible] = useState(false);

  // ── 攻城结果弹窗状态（P0-3） ──
  const [siegeResultData, setSiegeResultData] = useState<SiegeResultData | null>(null);
  const [siegeResultVisible, setSiegeResultVisible] = useState(false);

  // ── P1-1: 兵力部署滑块状态 ──
  const [selectedTroops, setSelectedTroops] = useState<number>(0);

  // ── 离线奖励弹窗状态 ──
  const [offlineVisible, setOfflineVisible] = useState(false);
  const [offlineDuration, setOfflineDuration] = useState(0);
  const [offlineEvents, setOfflineEvents] = useState<OfflineEvent[]>([]);
  const offlineRewardClaimedRef = useRef(false);

  // ── 信息面板子Tab ──
  const [infoPanelTab, setInfoPanelTab] = useState<'detail' | 'production'>('detail');

  // ── 行军系统状态 ──
  const marchingSystemRef = useRef<MarchingSystem | null>(null);
  const [marchRoute, setMarchRoute] = useState<MarchRoute | null>(null);
  const [activeMarches, setActiveMarches] = useState<MarchUnit[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const marchAnimRef = useRef<number>(0);
  const [marchNotification, setMarchNotification] = useState<string | null>(null);
  const territoriesRef = useRef<TerritoryData[]>(territories);
  territoriesRef.current = territories;
  const engineRef = useRef(engine);
  engineRef.current = engine;

  // ── 攻城动画系统 ──
  const conquestAnimSystem = useMemo(() => new ConquestAnimationSystem(), []);

  // ── 筛选后的领土 ──
  const filteredTerritories = useMemo(() => {
    let result = territories;
    if (regionFilter !== 'all') {
      result = result.filter((t) => t.region === regionFilter);
    }
    if (ownershipFilter !== 'all') {
      result = result.filter((t) => t.ownership === ownershipFilter);
    }
    if (landmarkFilter !== 'all') {
      result = result.filter((t) => {
        // 从 id 推断类型（如 city-luoyang → city）
        const prefix = t.id.split('-')[0];
        return prefix === landmarkFilter;
      });
    }
    return result;
  }, [territories, regionFilter, ownershipFilter, landmarkFilter]);

  // ── 热力图最大值 ──
  const heatmapMax = useMemo(() => {
    if (!showHeatmap) return 0;
    let max = 0;
    for (const t of territories) {
      const total = t.currentProduction.grain + t.currentProduction.gold
        + t.currentProduction.troops + t.currentProduction.mandate;
      if (total > max) max = total;
    }
    return max;
  }, [territories, showHeatmap]);

  // ── D1: 快捷键支持 ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果有弹窗打开，只处理Escape
      if (siegeVisible || siegeResultVisible || offlineVisible) {
        if (e.key === 'Escape') {
          setSiegeVisible(false);
          setSiegeResultVisible(false);
          setOfflineVisible(false);
          e.preventDefault();
        }
        return;
      }

      // 如果焦点在输入框中，不处理快捷键
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      switch (e.key) {
        case 'v':
        case 'V':
          // D1-1: V键切换像素/列表视图
          setViewMode((v) => v === 'pixel' ? 'grid' : 'pixel');
          e.preventDefault();
          break;

        case 'ArrowUp':
          // D1-2: 方向上键平移视窗
          if (viewMode === 'pixel') {
            // 触发像素地图向上平移
            const event = new CustomEvent('map-pan', { detail: { dx: 0, dy: -50 } });
            window.dispatchEvent(event);
            e.preventDefault();
          }
          break;

        case 'ArrowDown':
          // D1-2: 方向下键平移视窗
          if (viewMode === 'pixel') {
            const event = new CustomEvent('map-pan', { detail: { dx: 0, dy: 50 } });
            window.dispatchEvent(event);
            e.preventDefault();
          }
          break;

        case 'ArrowLeft':
          // D1-2: 方向左键平移视窗
          if (viewMode === 'pixel') {
            const event = new CustomEvent('map-pan', { detail: { dx: -50, dy: 0 } });
            window.dispatchEvent(event);
            e.preventDefault();
          }
          break;

        case 'ArrowRight':
          // D1-2: 方向右键平移视窗
          if (viewMode === 'pixel') {
            const event = new CustomEvent('map-pan', { detail: { dx: 50, dy: 0 } });
            window.dispatchEvent(event);
            e.preventDefault();
          }
          break;

        case '+':
        case '=':
          // D1-3: +键放大
          if (viewMode === 'pixel') {
            const event = new CustomEvent('map-zoom', { detail: { delta: 0.1 } });
            window.dispatchEvent(event);
            e.preventDefault();
          }
          break;

        case '-':
          // D1-3: -键缩小
          if (viewMode === 'pixel') {
            const event = new CustomEvent('map-zoom', { detail: { delta: -0.1 } });
            window.dispatchEvent(event);
            e.preventDefault();
          }
          break;

        case 'Escape':
          // D1-4: Escape取消选中
          setSelectedId(null);
          setSelectedSourceId(null);
          setMarchRoute(null);
          e.preventDefault();
          break;

        case ' ':
          // D1-5: 空格键居中到选中城市
          if (selectedId && viewMode === 'pixel') {
            const event = new CustomEvent('map-center', { detail: { territoryId: selectedId } });
            window.dispatchEvent(event);
            e.preventDefault();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [siegeVisible, siegeResultVisible, offlineVisible, viewMode, selectedId]);

  // ── 选中领土数据 ──
  const selectedTerritory = useMemo(
    () => territories.find((t) => t.id === selectedId) ?? null,
    [territories, selectedId],
  );

  // ── 离线奖励处理(引擎初始化后自动检测) ──
  useEffect(() => {
    if (!engine || offlineRewardClaimedRef.current) return;
    // 优先使用 engine.offlineEvents（地图层 OfflineEventSystem，有 processOfflineTime）
    // engine.getOfflineEventSystem() 返回的是事件队列系统（v15），没有 processOfflineTime
    const offlineSystem = engine?.offlineEvents ?? engine.getOfflineEventSystem?.();
    if (!offlineSystem?.processOfflineTime) return;

    try {
      const reward = offlineSystem.processOfflineTime();
      if (reward.offlineDuration >= 10) {
        setOfflineDuration(reward.offlineDuration * 1000); // 转换为毫秒
        setOfflineEvents(reward.events);
        setOfflineVisible(true);
      }
    } catch {
      // 离线系统未就绪时静默忽略
    }
  }, [engine]);

  // ── 行军系统初始化 ──
  useEffect(() => {
    const marchingSystem = new MarchingSystem();
    // 创建一个最小化的 ISystemDeps 以满足 MarchingSystem.init 要求
    // 使用功能性的 eventBus 以支持 march:arrived 事件监听
    const listeners = new Map<string, Set<(payload: any) => void>>();
    const eventBus = {
      emit: (event: string, payload?: any) => {
        const handlers = listeners.get(event);
        if (handlers) {
          for (const handler of handlers) {
            handler(payload);
          }
        }
      },
      on: (event: string, handler: (payload: any) => void) => {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        listeners.get(event)!.add(handler);
        return () => listeners.get(event)?.delete(handler);
      },
      off: (event: string, handler: (payload: any) => void) => {
        listeners.get(event)?.delete(handler);
      },
      once: (event: string, handler: (payload: any) => void) => {
        const wrapper = (payload: any) => {
          handler(payload);
          listeners.get(event)?.delete(wrapper);
        };
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        listeners.get(event)!.add(wrapper);
      },
      removeAllListeners: (event?: string) => {
        if (event) {
          listeners.delete(event);
        } else {
          listeners.clear();
        }
      },
    } as any;
    const mockDeps = {
      eventBus,
      config: {} as any,
      registry: { get: () => null } as any,
    };
    marchingSystem.init(mockDeps);

    // 构建可行走网格
    try {
      const parser = new ASCIIMapParser();
      const parsedMap = parser.parse(worldMapText);
      const grid = buildWalkabilityGrid(parsedMap);
      marchingSystem.setWalkabilityGrid(grid);
    } catch {
      // 地图解析失败时静默忽略
    }

    marchingSystemRef.current = marchingSystem;

    // 监听行军到达事件
    const handleArrived = (data: any) => {
      const { marchId, cityId, troops, general } = data ?? {};
      console.log('行军到达:', cityId);

      // 更新活跃行军列表
      setActiveMarches(marchingSystem.getActiveMarches());

      // 查找目标领土信息
      const targetTerritory = territoriesRef.current.find((t) => t.id === cityId);
      const targetName = targetTerritory?.name ?? cityId ?? '未知';

      // 显示到达通知
      setMarchNotification(`${general ?? '部队'}率${troops ?? 0}兵到达${targetName}`);

      // 到达敌方/中立城市时自动触发攻城
      if (targetTerritory && targetTerritory.ownership !== 'player') {
        // 延迟触发攻城UI，让玩家先看到行军到达动画
        setTimeout(() => {
          const eng = engineRef.current;
          if (!eng) return;
          // 使用攻城回调打开攻城确认弹窗
          setSelectedId(cityId);
          setSiegeTarget(targetTerritory);
          setSiegeVisible(true);
          const engTroops = eng.getResourceAmount?.('troops') ?? 0;
          setSelectedTroops(engTroops);
        }, 1500);
      }

      // 3秒后自动清除到达的行军并隐藏通知
      setTimeout(() => {
        marchingSystem.removeMarch(marchId);
        setActiveMarches(marchingSystem.getActiveMarches());
        setMarchNotification(null);
      }, 3000);
    };
    eventBus.on('march:arrived', handleArrived);

    // 行军动画循环
    let lastTime = Date.now();
    const animate = () => {
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      marchingSystem.update(dt);

      // 同步活跃行军到 state（仅在有变化时更新）
      const current = marchingSystem.getActiveMarches();
      setActiveMarches((prev) => {
        // 简单长度/ID 比较避免不必要的重渲染
        if (prev.length !== current.length) return [...current];
        if (current.length > 0) return [...current];
        return prev;
      });

      marchAnimRef.current = requestAnimationFrame(animate);
    };
    marchAnimRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(marchAnimRef.current);
      eventBus.off('march:arrived', handleArrived);
    };
  }, []);

  // ── 领取离线奖励 ──
  const handleClaimOfflineReward = useCallback(() => {
    if (!engine) {
      setOfflineVisible(false);
      offlineRewardClaimedRef.current = true;
      return;
    }

    // 优先使用 engine.offlineEvents（地图层 OfflineEventSystem，有 clearProcessed）
    const offlineSystem = engine?.offlineEvents ?? engine.getOfflineEventSystem?.();
    const productionSystem = engine.getProductionSystem?.() ?? engine?.production;

    // 将资源奖励添加到产出系统
    if (productionSystem && offlineEvents.length > 0) {
      const rewards: Record<string, number> = { gold: 0, grain: 0, troops: 0, mandate: 0 };
      for (const event of offlineEvents) {
        const data = event.data;
        switch (event.type) {
          case 'resource_accumulate': {
            const resource = data.resource as string;
            const amount = data.amount as number;
            if (resource && amount) rewards[resource] = (rewards[resource] || 0) + amount;
            break;
          }
          case 'caravan_visit':
          case 'trade_complete': {
            const goldGained = data.goldGained as number;
            if (goldGained) rewards.gold += goldGained;
            break;
          }
          case 'refugee_arrival': {
            const troopsGained = data.troopsGained as number;
            const grainCost = data.grainCost as number;
            if (troopsGained) rewards.troops += troopsGained;
            if (grainCost) rewards.grain -= grainCost;
            break;
          }
          case 'bandit_raid': {
            const troopsLost = data.troopsLost as number;
            const goldLost = data.goldLost as number;
            if (troopsLost) rewards.troops -= troopsLost;
            if (goldLost) rewards.gold -= goldLost;
            break;
          }
        }
      }

      // 将净奖励添加到第一个己方领土
      const playerTerritory = territories.find((t) => t.ownership === 'player');
      if (playerTerritory) {
        const positiveRewards: Record<string, number> = {};
        for (const [key, val] of Object.entries(rewards)) {
          if (val > 0) positiveRewards[key] = val;
        }
        if (Object.keys(positiveRewards).length > 0) {
          productionSystem.addResources(playerTerritory.id, positiveRewards);
        }
      }
    }

    // 标记事件已处理
    if (offlineSystem?.clearProcessed) {
      offlineSystem.clearProcessed();
    }

    setOfflineVisible(false);
    offlineRewardClaimedRef.current = true;
  }, [engine, offlineEvents, territories]);

  // ── 行军触发逻辑 ──
  const handleStartMarch = useCallback(
    (sourceId: string, targetId: string) => {
      const marchingSystem = marchingSystemRef.current;
      if (!marchingSystem) return;

      // 1. A* 寻路计算行军路线
      const route = marchingSystem.calculateMarchRoute(sourceId, targetId);
      if (!route) {
        // 不可达时清除路线
        setMarchRoute(null);
        setSelectedSourceId(null);
        return;
      }

      // 2. 在地图上显示路线
      setMarchRoute(route);

      // 3. 查找己方领土获取兵力和阵营信息
      const sourceTerritory = territories.find((t) => t.id === sourceId);
      const troops = engine?.getResourceAmount?.('troops') ?? 100;
      const faction: MarchUnit['faction'] = 'wei'; // 默认阵营

      // 4. 创建行军单位并开始行军
      const pathWithPixels = route.path.map((p) => ({ x: p.x, y: p.y }));
      const march = marchingSystem.createMarch(
        sourceId,
        targetId,
        troops,
        '行军',
        faction,
        pathWithPixels,
      );
      marchingSystem.startMarch(march.id);

      // 5. 清除选中源城市和路线（行军精灵将由 activeMarches 驱动显示）
      setSelectedSourceId(null);
      setSelectedId(null);
      // 稍后清除路线预览，让行军精灵接管
      setTimeout(() => setMarchRoute(null), 2000);
    },
    [territories, engine],
  );

  // ── 事件处理 ──
  const handleSelectTerritory = useCallback(
    (id: string) => {
      if (!id) {
        // 点击空白区域：清除所有选中和行军状态
        setSelectedId(null);
        setSelectedSourceId(null);
        setMarchRoute(null);
        onSelectTerritory?.('');
        return;
      }

      const clickedTerritory = territories.find((t) => t.id === id);
      if (!clickedTerritory) {
        setSelectedId((prev) => (prev === id ? null : id));
        onSelectTerritory?.(id);
        return;
      }

      // 行军触发逻辑：己方城市选为目标时触发行军
      if (selectedSourceId && selectedSourceId !== id) {
        // 已选中己方源城市，点击目标城市 → 触发行军
        handleStartMarch(selectedSourceId, id);
        onSelectTerritory?.(id);
        return;
      }

      if (clickedTerritory.ownership === 'player') {
        // 点击己方城市：设为行军源城市（或取消选中）
        if (selectedSourceId === id) {
          setSelectedSourceId(null);
          setSelectedId(null);
          setMarchRoute(null);
        } else {
          setSelectedSourceId(id);
          setSelectedId(id);
        }
      } else {
        // 点击非己方城市：普通选中
        setSelectedSourceId(null);
        setSelectedId((prev) => (prev === id ? null : id));
      }

      onSelectTerritory?.(id);
    },
    [selectedSourceId, territories, onSelectTerritory, handleStartMarch],
  );

  const handleSiege = useCallback(
    (id: string) => {
      if (onSiegeTerritory) {
        // 外部管理攻城流程时透传回调
        onSiegeTerritory(id);
        return;
      }
      // 内部集成攻城确认弹窗
      const target = territories.find((t) => t.id === id);
      if (target) {
        setSiegeTarget(target);
        setSiegeVisible(true);
        // P1-1: 初始化兵力选择为可用兵力（默认全兵）
        const troops = engine?.getResourceAmount?.('troops') ?? 0;
        setSelectedTroops(troops);
      }
    },
    [onSiegeTerritory, territories, engine],
  );

  // ── 攻城确认弹窗：可用兵力/粮草 ──
  const availableTroops = useMemo(() => {
    if (!engine) return 0;
    return engine.getResourceAmount?.('troops') ?? 0;
  }, [engine, snapshotVersion]);

  const availableGrain = useMemo(() => {
    if (!engine) return 0;
    return engine.getResourceAmount?.('grain') ?? 0;
  }, [engine, snapshotVersion]);

  // ── 攻城确认弹窗：条件校验 ──
  const siegeConditionResult = useMemo(() => {
    if (!siegeTarget || !engine) return null;
    const siegeSystem = engine.getSiegeSystem?.() ?? engine?.siege;
    if (!siegeSystem?.checkSiegeConditions) return null;
    try {
      return siegeSystem.checkSiegeConditions(siegeTarget.id, 'player', availableTroops, availableGrain);
    } catch {
      return { canSiege: false, errorCode: 'SYSTEM_ERROR', errorMessage: '条件检查异常' };
    }
  }, [siegeTarget, engine, snapshotVersion, availableTroops, availableGrain]);

  // ── 攻城确认弹窗：消耗预估 ──
  const siegeCost = useMemo(() => {
    if (!siegeTarget || !engine) return null;
    const siegeSystem = engine.getSiegeSystem?.() ?? engine?.siege;
    if (!siegeSystem?.getSiegeCostById && !siegeSystem?.calculateSiegeCost) return null;
    try {
      return siegeSystem.getSiegeCostById?.(siegeTarget.id) ?? siegeSystem.calculateSiegeCost(siegeTarget.id);
    } catch {
      return { troops: 0, grain: 0 };
    }
  }, [siegeTarget, engine, snapshotVersion]);

  // ── 攻城确认弹窗：每日次数和冷却 ──
  const dailySiegesRemaining = useMemo(() => {
    if (!engine) return null;
    const siegeSystem = engine.getSiegeSystem?.() ?? engine?.siege;
    return siegeSystem?.getDailySiegesRemaining?.() ?? siegeSystem?.getRemainingDailySieges?.() ?? null;
  }, [engine, snapshotVersion]);

  const cooldownRemainingMs = useMemo(() => {
    if (!engine) return 0;
    const siegeSystem = engine.getSiegeSystem?.() ?? engine?.siege;
    return siegeSystem?.getCooldownRemaining?.() ?? 0;
  }, [engine, snapshotVersion]);

  // ── 确认攻城执行 ──
  const handleSiegeConfirm = useCallback(() => {
    if (!siegeTarget || !engine) return;

    // P0-2 修复：正确获取攻城系统并执行攻城
    const siegeSystem = engine.getSiegeSystem?.() ?? engine?.siege;
    if (siegeSystem?.executeSiege) {
      // 使用滑块选择的兵力（而非全部可用兵力）
      const deployTroops = selectedTroops > 0 ? selectedTroops : availableTroops;
      // 粮草始终从引擎获取最新值
      const currentGrain = engine.getResourceAmount?.('grain') ?? availableGrain;

      const result = siegeSystem.executeSiege(siegeTarget.id, 'player', deployTroops, currentGrain);

      // 将 SiegeResult 转换为 SiegeResultData 格式
      const siegeResultData: SiegeResultData = {
        launched: result.launched,
        victory: result.victory,
        targetId: result.targetId,
        targetName: result.targetName,
        cost: result.cost,
        capture: result.capture,
        failureReason: result.failureReason,
        defeatTroopLoss: result.defeatTroopLoss,
      };

      // P0-3: 显示攻城结果弹窗
      setSiegeResultData(siegeResultData);
      setSiegeResultVisible(true);

      // 攻城成功时触发攻城动画
      if (result.victory && siegeTarget) {
        // 将 ownership 映射为 ConquestAnimationSystem 使用的阵营名称
        const ownershipToFaction = (ownership: string): string => {
          switch (ownership) {
            case 'player': return 'wei';    // 玩家默认魏阵营
            case 'enemy': return 'shu';     // 敌方默认蜀阵营
            case 'neutral': return 'neutral';
            default: return 'neutral';
          }
        };
        conquestAnimSystem.create(
          siegeTarget.id,
          siegeTarget.position.x,
          siegeTarget.position.y,
          ownershipToFaction(siegeTarget.ownership),
          'wei', // 玩家阵营
          { success: true, troopsLost: result.defeatTroopLoss ?? 0, general: '将军' },
        );
      }

      // 攻城后清除选中状态，避免残留旧数据
      setSelectedId(null);
    }
    setSiegeVisible(false);
    setSiegeTarget(null);
  }, [siegeTarget, engine, selectedTroops, availableTroops, availableGrain]);

  // ── 取消攻城弹窗 ──
  const handleSiegeCancel = useCallback(() => {
    setSiegeVisible(false);
    setSiegeTarget(null);
  }, []);

  const handleUpgrade = useCallback(
    (id: string) => {
      onUpgradeTerritory?.(id);
    },
    [onUpgradeTerritory],
  );

  // ── 网格列数 ──
  const gridCols = useMemo(() => {
    const count = filteredTerritories.length;
    if (count <= 4) return 2;
    if (count <= 9) return 3;
    if (count <= 16) return 4;
    return 5;
  }, [filteredTerritories.length]);

  // ── 统计数据 ──
  const stats = useMemo(() => {
    const playerCount = territories.filter((t) => t.ownership === 'player').length;
    const totalCount = territories.length;
    const totalGrain = productionSummary?.totalProduction.grain ?? 0;
    const totalGold = productionSummary?.totalProduction.gold ?? 0;
    return { playerCount, totalCount, totalGrain, totalGold };
  }, [territories, productionSummary]);

  // ── 攻城每日次数和冷却信息 ──
  const siegeInfo = useMemo(() => {
    if (!engine) return null;
    const siegeSystem = engine.getSiegeSystem?.() ?? engine?.siege;
    if (!siegeSystem) return null;
    const remaining = siegeSystem.getRemainingDailySieges?.() ?? 0;
    return { remainingDaily: remaining };
  }, [engine, snapshotVersion]);

  return (
    <div className="tk-worldmap-tab" data-testid="worldmap-tab">
      {/* ── 筛选工具栏 ── */}
      <div className="tk-worldmap-toolbar" data-testid="worldmap-toolbar">
        <div className="tk-worldmap-filter-group">
          <span className="tk-worldmap-filter-label">区域</span>
          <select
            className="tk-worldmap-filter-select"
            data-testid="worldmap-filter-region"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value as RegionId | 'all')}
          >
            <option value="all">全部区域</option>
            {REGION_IDS.map((r) => (
              <option key={r} value={r}>{REGION_LABELS[r] ?? r}</option>
            ))}
          </select>
        </div>

        <div className="tk-worldmap-filter-group">
          <span className="tk-worldmap-filter-label">归属</span>
          <select
            className="tk-worldmap-filter-select"
            data-testid="worldmap-filter-ownership"
            value={ownershipFilter}
            onChange={(e) => setOwnershipFilter(e.target.value as OwnershipStatus | 'all')}
          >
            {OWNERSHIP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="tk-worldmap-filter-group">
          <span className="tk-worldmap-filter-label">类型</span>
          <select
            className="tk-worldmap-filter-select"
            data-testid="worldmap-filter-landmark"
            value={landmarkFilter}
            onChange={(e) => setLandmarkFilter(e.target.value as LandmarkType | 'all')}
          >
            {LANDMARK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="tk-worldmap-toolbar-divider" />

        <button
          className={`tk-worldmap-heatmap-toggle ${showHeatmap ? 'tk-worldmap-heatmap-toggle--active' : ''}`}
          data-testid="worldmap-heatmap-toggle"
          onClick={() => setShowHeatmap((v) => !v)}
        >
          🗺️ 热力图
        </button>

        <div className="tk-worldmap-toolbar-divider" />

        <button
          className={`tk-worldmap-heatmap-toggle ${viewMode === 'pixel' ? 'tk-worldmap-heatmap-toggle--active' : ''}`}
          data-testid="worldmap-view-toggle"
          onClick={() => setViewMode((v) => v === 'pixel' ? 'grid' : 'pixel')}
        >
          {viewMode === 'pixel' ? '🗺️ 像素地图' : '📋 列表'}
        </button>
      </div>

      {/* ── 行军到达通知 ── */}
      {marchNotification && (
        <div
          data-testid="march-notification"
          style={{
            padding: '6px 12px',
            margin: '0 8px',
            borderRadius: 6,
            background: 'rgba(46, 80, 144, 0.25)',
            border: '1px solid rgba(46, 80, 144, 0.5)',
            color: '#7EC850',
            fontSize: 12,
            fontWeight: 600,
            textAlign: 'center',
            animation: 'fadeInOut 3s ease-in-out',
          }}
        >
          {marchNotification}
        </div>
      )}

      {/* ── 地图主体 ── */}
      <div className="tk-worldmap-body">
        {/* 地图网格 */}
        <div className="tk-worldmap-grid-wrapper" data-testid="worldmap-grid-wrapper">
          {viewMode === 'pixel' ? (
            <PixelWorldMap
              territories={filteredTerritories}
              onSelectTerritory={handleSelectTerritory}
              selectedId={selectedId}
              marchRoute={marchRoute}
              activeMarches={activeMarches}
              conquestAnimationSystem={conquestAnimSystem}
            />
          ) : filteredTerritories.length === 0 ? (
            <div className="tk-worldmap-empty" data-testid="worldmap-empty">
              暂无匹配领土
            </div>
          ) : (
            <div
              className="tk-worldmap-grid"
              data-testid="worldmap-grid"
              style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
            >
              {filteredTerritories.map((t) => {
                const totalProd = t.currentProduction.grain + t.currentProduction.gold
                  + t.currentProduction.troops + t.currentProduction.mandate;
                const isSelected = selectedId === t.id;

                return (
                  <div
                    key={t.id}
                    className={[
                      'tk-territory-cell',
                      `tk-territory-cell--${t.ownership}`,
                      isSelected ? 'tk-territory-cell--selected' : '',
                    ].filter(Boolean).join(' ')}
                    data-testid={`territory-cell-${t.id}`}
                    onClick={() => handleSelectTerritory(t.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${t.name} - ${t.ownership === 'player' ? '己方' : t.ownership === 'enemy' ? '敌方' : '中立'}`}
                  >
                    {/* 热力图叠加 */}
                    {showHeatmap && (
                      <div
                        className="tk-territory-cell-heatmap"
                        data-testid={`heatmap-${t.id}`}
                        style={{ background: getHeatmapColor(totalProd, heatmapMax) }}
                      />
                    )}

                    {/* 产出气泡（仅己方领土显示） */}
                    {t.ownership === 'player' && totalProd > 0 && (
                      <span
                        className="tk-territory-bubble"
                        data-testid={`bubble-${t.id}`}
                        title={`产出: ${formatProduction(totalProd)}/s`}
                      >
                        +{formatProduction(totalProd)}
                      </span>
                    )}

                    <span className="tk-territory-cell-name">{t.name}</span>
                    <span className="tk-territory-cell-level">Lv.{t.level}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 右侧信息面板 */}
        <div className="tk-worldmap-info-panel" data-testid="worldmap-info-panel">
          {/* 信息面板子Tab切换 */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }} data-testid="info-panel-tabs">
            <button
              onClick={() => setInfoPanelTab('detail')}
              style={{
                flex: 1,
                padding: '6px 0',
                border: '1px solid',
                borderColor: infoPanelTab === 'detail' ? 'rgba(212,165,116,0.5)' : 'rgba(200,168,76,0.15)',
                borderRadius: 4,
                background: infoPanelTab === 'detail' ? 'rgba(212,165,116,0.15)' : 'transparent',
                color: infoPanelTab === 'detail' ? '#d4a574' : '#a0a0a0',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              data-testid="info-tab-detail"
            >
              信息
            </button>
            <button
              onClick={() => setInfoPanelTab('production')}
              style={{
                flex: 1,
                padding: '6px 0',
                border: '1px solid',
                borderColor: infoPanelTab === 'production' ? 'rgba(212,165,116,0.5)' : 'rgba(200,168,76,0.15)',
                borderRadius: 4,
                background: infoPanelTab === 'production' ? 'rgba(212,165,116,0.15)' : 'transparent',
                color: infoPanelTab === 'production' ? '#d4a574' : '#a0a0a0',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              data-testid="info-tab-production"
            >
              产出
            </button>
          </div>

          {/* 统计卡片（始终显示） */}
          <div className="tk-worldmap-stats">
            <div className="tk-worldmap-stat-card" data-testid="stat-territories">
              <span className="tk-worldmap-stat-label">占领/总数</span>
              <span className="tk-worldmap-stat-value">
                {stats.playerCount}/{stats.totalCount}
              </span>
            </div>
            <div className="tk-worldmap-stat-card" data-testid="stat-grain">
              <span className="tk-worldmap-stat-label">粮食/秒</span>
              <span className="tk-worldmap-stat-value">{formatProduction(stats.totalGrain)}</span>
            </div>
            <div className="tk-worldmap-stat-card" data-testid="stat-gold">
              <span className="tk-worldmap-stat-label">金币/秒</span>
              <span className="tk-worldmap-stat-value">{formatProduction(stats.totalGold)}</span>
            </div>
          </div>

          {/* 子Tab: 产出面板 */}
          {infoPanelTab === 'production' && (
            <ProductionPanel
              territories={territories}
              productionSummary={productionSummary}
            />
          )}

          {/* 子Tab: 详情面板（原有内容） */}
          {infoPanelTab === 'detail' && (
            <>
              {/* 攻城信息面板（每日次数+冷却） */}
              {siegeInfo && (
                <div style={{ padding: '6px 10px', marginBottom: 8, borderRadius: 6, background: 'rgba(212,165,116,0.06)', border: '1px solid rgba(212,165,116,0.12)', fontSize: 11 }}
                  data-testid="siege-info-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#a0a0a0' }}>⚔️ 今日攻城</span>
                    <span style={{ color: siegeInfo.remainingDaily > 0 ? '#7EC850' : '#e74c3c', fontWeight: 600 }}>
                      {siegeInfo.remainingDaily > 0 ? `剩余 ${siegeInfo.remainingDaily} 次` : '已用完'}
                    </span>
                  </div>
                </div>
              )}

              {/* 小地图缩略图 */}
              <div style={{ padding: '6px 0', marginBottom: 8 }} data-testid="worldmap-minimap">
                <div style={{ fontSize: 11, color: '#a0a0a0', marginBottom: 4 }}>🗺️ 缩略图</div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: 2,
                  padding: 4,
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: 4,
                  maxWidth: 180,
                }}>
                  {territories.slice(0, 24).map((t) => (
                    <div
                      key={t.id}
                      style={{
                        width: 12, height: 12, borderRadius: 2,
                        background: t.ownership === 'player' ? '#7EC850' : t.ownership === 'enemy' ? '#e74c3c' : 'rgba(255,255,255,0.15)',
                        border: selectedId === t.id ? '1px solid #d4a574' : 'none',
                        cursor: 'pointer',
                      }}
                      title={t.name}
                      onClick={() => handleSelectTerritory(t.id)}
                    />
                  ))}
                </div>
              </div>

              {/* 热力图图例 */}
              {showHeatmap && (
                <div className="tk-worldmap-legend" data-testid="worldmap-legend">
                  <span className="tk-worldmap-legend-label">低</span>
                  <div className="tk-worldmap-legend-bar" />
                  <span className="tk-worldmap-legend-label">高</span>
                </div>
              )}

              {/* 领土详情面板 */}
              {selectedTerritory && (
                <TerritoryInfoPanel
                  territory={selectedTerritory}
                  onSiege={handleSiege}
                  onUpgrade={handleUpgrade}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 攻城确认弹窗 ── */}
      <SiegeConfirmModal
        visible={siegeVisible}
        target={siegeTarget}
        cost={siegeCost}
        conditionResult={siegeConditionResult}
        availableTroops={availableTroops}
        availableGrain={availableGrain}
        dailySiegesRemaining={dailySiegesRemaining}
        cooldownRemainingMs={cooldownRemainingMs}
        selectedTroops={selectedTroops}
        onTroopsChange={setSelectedTroops}
        onConfirm={handleSiegeConfirm}
        onCancel={handleSiegeCancel}
      />

      {/* P0-3: 攻城结果弹窗 ── */}
      <SiegeResultModal
        visible={siegeResultVisible}
        result={siegeResultData}
        onClose={() => {
          setSiegeResultVisible(false);
          setSiegeResultData(null);
        }}
      />

      {/* ── 离线奖励弹窗 ── */}
      <OfflineRewardModal
        visible={offlineVisible}
        offlineDuration={offlineDuration}
        events={offlineEvents}
        onClaim={handleClaimOfflineReward}
        onClose={() => {
          setOfflineVisible(false);
          offlineRewardClaimedRef.current = true;
        }}
      />
    </div>
  );
};

export default WorldMapTab;
