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
import type { MarchRoute, MarchUnit, MarchArrivedPayload, MarchCancelledPayload } from '@/games/three-kingdoms/engine/map/MarchingSystem';
import { ConquestAnimationSystem } from '@/games/three-kingdoms/engine/map/ConquestAnimation';
import { SiegeBattleAnimationSystem } from '@/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem';
import type { SiegeAnimationState } from '@/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem';
import { SiegeBattleSystem } from '@/games/three-kingdoms/engine/map/SiegeBattleSystem';
import type { BattleCompletedEvent } from '@/games/three-kingdoms/engine/map/SiegeBattleSystem';
import { SettlementPipeline } from '@/games/three-kingdoms/engine/map/SettlementPipeline';
import type { SettlementContext } from '@/games/three-kingdoms/engine/map/SettlementPipeline';
import worldMapText from '@/games/three-kingdoms/core/map/maps/world-map.txt?raw';
import TerritoryInfoPanel from './TerritoryInfoPanel';
import SiegeConfirmModal from './SiegeConfirmModal';
import SiegeResultModal from './SiegeResultModal';
import type { SiegeResultData } from './SiegeResultModal';
import OfflineRewardModal from './OfflineRewardModal';
import ProductionPanel from './ProductionPanel';
import SiegeTaskPanel from './SiegeTaskPanel';
import type { OfflineEvent } from '@/games/three-kingdoms/engine/map/OfflineEventSystem';
import type { HeroInfo, ExpeditionForceSelection } from './ExpeditionForcePanel';
import type { CasualtyResult } from '@/games/three-kingdoms/engine/map/expedition-types';
import {
  mapInjuryLevel,
  INJURY_RECOVERY_HOURS,
} from '@/games/three-kingdoms/engine/map/expedition-types';
import type { UIInjuryLevel } from '@/games/three-kingdoms/engine/map/expedition-types';
import type { SiegeStrategyType } from '@/games/three-kingdoms/core/map/siege-enhancer.types';
import type { IEventBus } from '@/games/three-kingdoms/core/types/events';
import { SiegeTaskManager } from '@/games/three-kingdoms/engine/map/SiegeTaskManager';
import type { SiegeTask } from '@/games/three-kingdoms/core/map/siege-task.types';
import { type SiegeItemType } from '@/games/three-kingdoms/engine/map/SiegeItemSystem';
import { formatNumber } from '@/components/idle/utils/formatNumber';
import { PixelWorldMap } from './PixelWorldMap';
import './WorldMapTab.css';

// ─────────────────────────────────────────────
// R14→R16: Engine InjuryLevel → UI injuryLevel 映射
// 映射函数和恢复时间已移至 expedition-types.ts 共享配置
// Re-export for backward compatibility with existing tests
// ─────────────────────────────────────────────
export { mapInjuryLevel } from '@/games/three-kingdoms/engine/map/expedition-types';

/**
 * 将引擎 CasualtyResult 转换为 UI injuryData
 *
 * @param casualties - 引擎伤亡结果
 * @param generalName - 将领名称
 * @returns injuryData 对象，无伤时返回 undefined
 */
export function mapInjuryData(
  casualties: CasualtyResult | undefined,
  generalName: string,
): { generalName: string; injuryLevel: UIInjuryLevel; recoveryHours: number } | undefined {
  if (!casualties || !casualties.heroInjured || casualties.injuryLevel === 'none') {
    return undefined;
  }
  const uiLevel = mapInjuryLevel(casualties.injuryLevel);
  return {
    generalName,
    injuryLevel: uiLevel,
    recoveryHours: INJURY_RECOVERY_HOURS[uiLevel],
  };
}

/**
 * 将引擎 CasualtyResult 转换为 UI troopLoss
 *
 * @param casualties - 引擎伤亡结果
 * @param totalTroops - 出征总兵力
 * @returns troopLoss 对象，无伤亡时返回 undefined
 */
export function mapTroopLoss(
  casualties: CasualtyResult | undefined,
  totalTroops: number,
): { lost: number; total: number } | undefined {
  if (!casualties || casualties.troopsLost <= 0 || totalTroops <= 0) {
    return undefined;
  }
  return { lost: casualties.troopsLost, total: totalTroops };
}

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

  // ── J-01: 编队选择状态 ──
  const [expeditionSelection, setExpeditionSelection] = useState<ExpeditionForceSelection | null>(null);

  // ── MAP-F06-02: 攻城策略选择状态 ──
  const [selectedStrategy, setSelectedStrategy] = useState<SiegeStrategyType | null>(null);

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
  // ── 攻城战斗动画系统 (I12) ──
  const siegeBattleAnimRef = useRef<SiegeBattleAnimationSystem | null>(null);
  // ── 攻城战斗回合制引擎 ──
  const siegeBattleSystemRef = useRef<SiegeBattleSystem | null>(null);
  const [activeSiegeAnims, setActiveSiegeAnims] = useState<SiegeAnimationState[]>([]);
  // ── 攻占任务管理 ──
  const siegeTaskManagerRef = useRef<SiegeTaskManager>(new SiegeTaskManager());
  const [activeSiegeTasks, setActiveSiegeTasks] = useState<SiegeTask[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  // ── R9 Task5: 行军路线高亮 ──
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const marchAnimRef = useRef<number>(0);
  const [marchNotification, setMarchNotification] = useState<string | null>(null);
  const territoriesRef = useRef<TerritoryData[]>(territories);
  territoriesRef.current = territories;
  const engineRef = useRef(engine);
  engineRef.current = engine;
  // ── 攻城动画→结果弹窗时序控制 ──
  const pendingSiegeResultRef = useRef<any>(null);
  const siegeAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      emit: (event: string, payload: any) => {
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
        return () => listeners.get(event)?.delete(wrapper);
      },
      removeAllListeners: (event?: string) => {
        if (event) {
          listeners.delete(event);
        } else {
          listeners.clear();
        }
      },
    } as IEventBus;
    const mockDeps = {
      eventBus,
      config: {} as any,
      registry: { get: () => null } as any,
    };
    marchingSystem.init(mockDeps);

    // ── 初始化攻城战斗动画系统 (I12) ──
    const siegeBattleAnimSystem = new SiegeBattleAnimationSystem();
    siegeBattleAnimSystem.init(mockDeps);
    siegeBattleAnimRef.current = siegeBattleAnimSystem;

    // ── 初始化攻城战斗回合制引擎 ──
    const siegeBattleSystem = new SiegeBattleSystem();
    siegeBattleSystem.init(mockDeps);
    siegeBattleSystemRef.current = siegeBattleSystem;

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

    // ── 初始化 SettlementPipeline（统一结算流水线） ──
    const settlementPipeline = new SettlementPipeline();
    settlementPipeline.setDependencies({ eventBus });

    // ── 初始化 SiegeTaskManager 依赖注入 ──
    siegeTaskManagerRef.current.setDependencies({ eventBus });

    // 监听行军到达事件
    const handleArrived = (data: MarchArrivedPayload) => {
      const { marchId, cityId, troops, general } = data ?? {};
      console.log('行军到达:', cityId);

      // 更新活跃行军列表
      setActiveMarches(marchingSystem.getActiveMarches());

      // 查找目标领土信息
      const targetTerritory = territoriesRef.current.find((t) => t.id === cityId);
      const targetName = targetTerritory?.name ?? cityId ?? '未知';

      // 显示到达通知
      setMarchNotification(`${general ?? '部队'}率${troops ?? 0}兵到达${targetName}`);

      // 检查是否有关联的攻占任务
      const siegeTaskManager = siegeTaskManagerRef.current;
      const siegeTaskId = data.siegeTaskId;
      const associatedTask = siegeTaskId ? siegeTaskManager.getTask(siegeTaskId) : null;

      if (associatedTask && !associatedTask.result) {
        // 自动执行攻城（P5→P8→P9 阶段）
        // 将攻城执行延迟到下一个宏任务，避免在 rAF 回调中同步执行重计算阻塞渲染
        const taskId = associatedTask.id;
        setTimeout(() => {
          // 防重复处理守卫：再次检查任务状态是否仍有效
          const currentTask = siegeTaskManager.getTask(taskId);
          if (!currentTask || currentTask.result || currentTask.status !== 'marching') return;

          const eng = engineRef.current;
          if (eng) {
            const siegeSystem = eng.getSiegeSystem?.() ?? eng?.siege;
            if (siegeSystem?.executeSiege) {
              // 推进: sieging
              siegeTaskManager.advanceStatus(currentTask.id, 'sieging');

              // 启动攻城战斗回合制引擎（emit battle:started → SiegeBattleAnimationSystem 自动启动动画）
              const targetTerritory = territoriesRef.current.find((t) => t.id === currentTask.targetId);
              const battleSystem = siegeBattleSystemRef.current;
              if (battleSystem) {
                battleSystem.createBattle({
                  taskId: currentTask.id,
                  targetId: currentTask.targetId,
                  troops: currentTask.expedition.troops,
                  strategy: currentTask.strategy ?? 'forceAttack',
                  targetDefenseLevel: 1,
                  targetX: targetTerritory?.position.x ?? 0,
                  targetY: targetTerritory?.position.y ?? 0,
                  faction: 'wei',
                });
              }

              // 执行攻城（使用旧 siegeSystem 确定胜负，因为 SettlementPipeline 不负责战斗判定）
              const siegeResult = siegeSystem.executeSiege(
                currentTask.targetId,
                'player',
                currentTask.expedition.troops,
                eng.getResourceAmount?.('grain') ?? 0,
                currentTask.strategy,
              );

              // ── 使用 SettlementPipeline 统一结算（R14 修复：消除双路径架构） ──
              //
              // [R15-Task3 架构说明：SettlementPipeline 的唯一调用路径]
              // 这是 SettlementPipeline 在攻城流程中的**唯一执行入口**。
              // 攻城结算完全由 handleArrived 的 setTimeout(0) 回调同步完成，
              // 而非依赖 SiegeBattleSystem.update() 自然完成后的 battle:completed 事件。
              //
              // 原因：SiegeBattleSystem 在每帧 animate() 中被 update(dt) 驱动，
              // 但 handleArrived 在结算完成后会立即调用 cancelBattle() 从活跃列表中
              // 移除该战斗会话，因此 SiegeBattleSystem 永远不会为其发出 battle:completed。
              // 即使 battle:completed 被发出，也不存在对应的监听器来处理它。
              // 这种单路径设计确保了结算只执行一次，避免了双路径竞态问题。
              //
              // 从攻城结果构造 BattleCompletedEvent（pipeline 的 calculate 阶段需要）
              const battleEvent: BattleCompletedEvent = {
                taskId: currentTask.id,
                targetId: currentTask.targetId,
                victory: siegeResult.victory,
                strategy: currentTask.strategy ?? 'forceAttack',
                troops: currentTask.expedition.troops,
                elapsedMs: 0,
                remainingDefense: siegeResult.victory ? 0 : 100,
              };

              const returnMarchInfo = {
                fromCityId: currentTask.targetId,
                toCityId: currentTask.sourceId,
                troops: currentTask.expedition.troops,
                general: currentTask.expedition.heroName,
              };

              const isFirstCapture = targetTerritory?.ownership === 'neutral' || targetTerritory?.ownership === 'enemy';

              const settlementCtx: SettlementContext = siegeResult.victory
                ? settlementPipeline.createVictoryContext({
                    taskId: currentTask.id,
                    battleEvent,
                    sourceId: currentTask.sourceId,
                    returnMarch: returnMarchInfo,
                    troops: currentTask.expedition.troops,
                    targetLevel: targetTerritory?.level ?? 1,
                    isFirstCapture,
                  })
                : settlementPipeline.createDefeatContext({
                    taskId: currentTask.id,
                    battleEvent,
                    sourceId: currentTask.sourceId,
                    returnMarch: returnMarchInfo,
                    troops: currentTask.expedition.troops,
                    targetLevel: targetTerritory?.level ?? 1,
                  });

              const settlementResult = settlementPipeline.execute(settlementCtx);
              if (!settlementResult.success) {
                // Pipeline validation failed — skip settlement
                return;
              }

              const settlement = settlementResult.context;

              // 推进: settling
              siegeTaskManager.advanceStatus(currentTask.id, 'settling');

              // 从 SettlementPipeline 获取伤亡数据（包含真实的 heroInjured 和 injuryLevel）
              const casualties: CasualtyResult = {
                troopsLost: settlement.casualties?.troopsLost ?? 0,
                troopsLostPercent: settlement.casualties?.troopsLostPercent ?? 0,
                heroInjured: settlement.casualties?.heroInjured ?? false,
                injuryLevel: settlement.casualties?.injuryLevel ?? 'none',
                battleResult: siegeResult.victory ? 'victory' : 'defeat',
              };

              const effectiveTroopsLost = casualties.troopsLost;

              // 设置攻城结果
              siegeTaskManager.setResult(currentTask.id, {
                victory: siegeResult.victory,
                capture: siegeResult.capture,
                casualties,
                actualCost: siegeResult.cost,
                rewardMultiplier: settlement.rewards?.rewardMultiplier ?? 0,
                specialEffectTriggered: false,
                failureReason: siegeResult.failureReason,
              });

              // 推进: returning（编队回城）
              siegeTaskManager.advanceStatus(currentTask.id, 'returning');

              // 停止战斗引擎空转（结算已完成，避免 SiegeBattleSystem 继续衰减城防）
              // [R15-Task3] cancelBattle() 将战斗从活跃列表中移除且不触发 battle:completed，
              // 这确保了 SettlementPipeline 只在上方执行一次，不会在后续帧中被重复调用。
              if (battleSystem) {
                battleSystem.cancelBattle(currentTask.id);
              }

              // 创建回城行军（速度 x0.8，使用 createReturnMarch）
              const marchingSys = marchingSystemRef.current;
              if (marchingSys) {
                const returnMarch = marchingSys.createReturnMarch({
                  fromCityId: currentTask.targetId,
                  toCityId: currentTask.sourceId,
                  troops: currentTask.expedition.troops - effectiveTroopsLost,
                  general: currentTask.expedition.heroName,
                  faction: 'wei',
                  siegeTaskId: currentTask.id,
                });
                if (returnMarch) {
                  marchingSys.startMarch(returnMarch.id);
                } else {
                  // 回城路线不可达时直接完成任务并通知用户
                  siegeTaskManager.advanceStatus(currentTask.id, 'completed');
                  siegeTaskManager.removeCompletedTasks();
                  setMarchNotification('回城路线不可达，部队就地驻扎');
                }
                // PRD: 攻城结束后移除去程行军精灵（精灵在攻城期间保持存活）
                marchingSys.removeMarch(marchId);
                setActiveMarches(marchingSys.getActiveMarches());
              }

              // 显示攻城结果弹窗
              // R14: 从 SettlementPipeline.distribute() 获取道具掉落（pipeline 已处理 shouldDropInsiderLetter）
              const droppedItems = settlement.rewards?.items ?? [];

              const siegeResultData: SiegeResultData = {
                launched: siegeResult.launched,
                victory: siegeResult.victory,
                targetId: siegeResult.targetId,
                targetName: siegeResult.targetName,
                cost: siegeResult.cost,
                capture: siegeResult.capture,
                failureReason: siegeResult.failureReason,
                defeatTroopLoss: casualties.troopsLost,
                casualties,
                // R14: 道具掉落数据来自 SettlementPipeline
                itemDrops: droppedItems.length > 0 ? droppedItems as Array<{ type: SiegeItemType; count: number }> : undefined,
                // R14: 奖励倍率来自 SettlementPipeline
                rewardMultiplier: settlement.rewards?.rewardMultiplier,
              };

              // Store result but don't show modal yet — wait for animation to complete
              pendingSiegeResultRef.current = siegeResultData;
              setSiegeResultData(siegeResultData);

              // Listen for animation completion before showing modal
              const animHandler = (animData: { taskId: string; targetCityId: string; victory: boolean }) => {
                if (animData.taskId === currentTask.id) {
                  if (siegeAnimTimeoutRef.current) {
                    clearTimeout(siegeAnimTimeoutRef.current);
                    siegeAnimTimeoutRef.current = null;
                  }
                  setSiegeResultVisible(true);
                }
              };

              eventBus.once('siegeAnim:completed', animHandler);

              // Safety fallback: show modal after 5s even if animation event never fires
              siegeAnimTimeoutRef.current = setTimeout(() => {
                eventBus.off('siegeAnim:completed', animHandler);
                siegeAnimTimeoutRef.current = null;
                setSiegeResultVisible(true);
              }, 5000);

              // 完成攻城动画：cancelBattle 不会触发 battle:completed，
              // 所以需要手动完成动画以触发 siegeAnim:completed 事件。
              // 必须在 eventBus.once 注册之后调用，否则事件会在监听器注册前就已发出。
              const siegeAnimSystem = siegeBattleAnimRef.current;
              if (siegeAnimSystem) {
                siegeAnimSystem.completeSiegeAnimation(currentTask.id, siegeResult.victory);
              }

              // 攻城成功时触发攻城动画
              if (siegeResult.victory && targetTerritory) {
                const ownershipToFaction = (ownership: string): string => {
                  switch (ownership) {
                    case 'player': return 'wei';
                    case 'enemy': return 'shu';
                    case 'neutral': return 'neutral';
                    default: return 'neutral';
                  }
                };
                conquestAnimSystem.create(
                  targetTerritory.id,
                  targetTerritory.position.x,
                  targetTerritory.position.y,
                  ownershipToFaction(targetTerritory.ownership),
                  'wei',
                  { success: true, troopsLost: effectiveTroopsLost, general: currentTask.expedition.heroName },
                );
              }
            }
          }
          // 更新攻占任务列表
          setActiveSiegeTasks(siegeTaskManager.getActiveTasks());
        }, 0);
      }

      // 检查是否为回城行军（到达己方城市）
      if (targetTerritory && targetTerritory.ownership === 'player' && associatedTask?.status === 'returning') {
        siegeTaskManager.advanceStatus(associatedTask.id, 'completed');
        siegeTaskManager.removeCompletedTasks();
        setActiveSiegeTasks(siegeTaskManager.getActiveTasks());
      }

      // PRD: 行军精灵在攻城期间保持存活，攻城结束后才移除
      // 只有非攻城行军（无关联任务）才在3秒后自动清除
      // 攻城行军的精灵在攻城完成/取消时移除（见下方 removeMarch 调用）
      if (!associatedTask || !!associatedTask.result) {
        setTimeout(() => {
          marchingSystem.removeMarch(marchId);
          setActiveMarches(marchingSystem.getActiveMarches());
        }, 3000);
      }
      // 通知始终3秒后清除
      setTimeout(() => {
        setMarchNotification(null);
      }, 3000);
    };
    eventBus.on('march:arrived', handleArrived);

    // 监听行军取消事件：清理关联的攻占任务
    // 注意：cancelMarch 在 emit 前已删除 march，所以 siegeTaskId 通过事件 payload 传递
    const handleCancelled = (data: MarchCancelledPayload) => {
      const { siegeTaskId } = data ?? {};
      if (siegeTaskId) {
        const siegeTaskManager = siegeTaskManagerRef.current;
        const task = siegeTaskManager.getTask(siegeTaskId);
        if (task && task.status !== 'completed') {
          // 任务未完成时，推进到 completed 并清理
          siegeTaskManager.setResult(siegeTaskId, {
            victory: false,
            casualties: null,
            actualCost: task.cost,
            rewardMultiplier: 0,
            specialEffectTriggered: false,
            failureReason: '行军被取消',
          });
          siegeTaskManager.cancelTask(siegeTaskId);
          siegeTaskManager.removeCompletedTasks();
          setActiveSiegeTasks(siegeTaskManager.getActiveTasks());
        }
      }
    };
    eventBus.on('march:cancelled', handleCancelled);

    // 行军动画循环
    let lastTime = Date.now();
    const animate = () => {
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      marchingSystem.update(dt);

      // 更新攻城战斗回合制引擎（驱动城防衰减，自然完成时 emit battle:completed）
      // [R15-Task3] 注意：对于攻城任务，cancelBattle() 在结算后已被调用，
      // 所以 battle:completed 不会被发出。此 update() 仅用于驱动城防衰减动画。
      siegeBattleSystem.update(dt);

      // Bridge: sync defenseValue from SiegeBattleSystem to SiegeBattleAnimationSystem
      // so the HP bar reflects the actual defense ratio each frame
      const activeBattles = siegeBattleSystem.getState().activeBattles;
      for (const battle of activeBattles) {
        if (battle.maxDefense > 0) {
          siegeBattleAnimSystem.updateBattleProgress(
            battle.taskId,
            battle.defenseValue / battle.maxDefense,
          );
        }
      }

      // 更新攻城战斗动画系统 (I12)
      siegeBattleAnimSystem.update(dt);

      // 同步活跃行军到 state（仅在有变化时更新）
      const current = marchingSystem.getActiveMarches();
      setActiveMarches((prev) => {
        // 简单长度/ID 比较避免不必要的重渲染
        if (prev.length !== current.length) return [...current];
        if (current.length > 0) return [...current];
        return prev;
      });

      // 同步攻城战斗动画到 state (I12)
      const siegeAnims = siegeBattleAnimSystem.getActiveAnimations();
      setActiveSiegeAnims((prev) => {
        if (prev.length !== siegeAnims.length) return [...siegeAnims];
        if (siegeAnims.length > 0) return [...siegeAnims];
        return prev;
      });

      marchAnimRef.current = requestAnimationFrame(animate);
    };
    marchAnimRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(marchAnimRef.current);
      // Cleanup pending siege animation listeners
      if (siegeAnimTimeoutRef.current) {
        clearTimeout(siegeAnimTimeoutRef.current);
        siegeAnimTimeoutRef.current = null;
      }
      siegeBattleSystem.destroy();
      siegeBattleSystemRef.current = null;
      siegeBattleAnimSystem.destroy();
      siegeBattleAnimRef.current = null;
      eventBus.off('march:arrived', handleArrived);
      eventBus.off('march:cancelled', handleCancelled);
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

      // 已选中己方源城市，点击目标城市 → 打开攻城确认弹窗（统一走 SiegeTaskManager 异步流程）
      if (selectedSourceId && selectedSourceId !== id) {
        // 计算并显示行军路线预览
        const marchingSystem = marchingSystemRef.current;
        if (marchingSystem) {
          const route = marchingSystem.calculateMarchRoute(selectedSourceId, id);
          if (route) {
            setMarchRoute(route);
          }
        }
        // 打开攻城确认弹窗（而非旧行军路径）
        setSiegeTarget(clickedTerritory);
        setSiegeVisible(true);
        const troops = engine?.getResourceAmount?.('troops') ?? 0;
        setSelectedTroops(troops);
        setSelectedId(id);
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
    [selectedSourceId, territories, onSelectTerritory, engine],
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

  // ── J-01: 编队系统检测和将领数据 ──
  const expeditionSystem = useMemo(() => {
    if (!engine) return null;
    return engine.getExpeditionSystem?.() ?? engine?.expedition ?? null;
  }, [engine]);

  /** 从引擎获取可用将领列表 */
  const heroes = useMemo<HeroInfo[]>(() => {
    if (!engine) return [];
    // 尝试从引擎获取将领数据（多种可能的接口）
    const heroList = engine.getHeroes?.() ?? engine.heroes ?? [];
    if (!Array.isArray(heroList) || heroList.length === 0) return [];
    return heroList.map((hero: any) => {
      const injuryLevel = expeditionSystem?.getHeroInjury?.(hero.id) ?? 'none';
      const isInjured = injuryLevel !== 'none';
      const isBusy = expeditionSystem?.isHeroBusy?.(hero.id) ?? false;
      return {
        id: hero.id,
        name: hero.name,
        level: hero.level ?? 1,
        injured: isInjured,
        injuryLevel: isInjured ? injuryLevel : undefined,
        injuryRecoveryTime: undefined,
        busy: isBusy,
      };
    });
  }, [engine, expeditionSystem, snapshotVersion]);

  // ── MAP-F06-07: 内应信/夜袭令道具数量 ──
  const insiderLetterCount = useMemo(() => {
    if (!engine) return 0;
    const inventory = engine.getInventory?.() ?? engine.inventory;
    if (!inventory) return 0;
    const item = inventory['item-insider-letter'] ?? inventory['insiderLetter'];
    return typeof item === 'number' ? item : item?.quantity ?? 0;
  }, [engine, snapshotVersion]);

  const nightRaidTokenCount = useMemo(() => {
    if (!engine) return 0;
    const inventory = engine.getInventory?.() ?? engine.inventory;
    if (!inventory) return 0;
    const item = inventory['item-night-raid-token'] ?? inventory['nightRaidToken'];
    return typeof item === 'number' ? item : item?.quantity ?? 0;
  }, [engine, snapshotVersion]);

  // ── MAP-F06-07: 目标城池内应暴露状态 ──
  const insiderExposed = useMemo(() => {
    if (!siegeTarget || !engine) return false;
    const siegeSystem = engine.getSiegeSystem?.() ?? engine?.siege;
    return siegeSystem?.isInsiderExposed?.(siegeTarget.id) ?? false;
  }, [siegeTarget, engine, snapshotVersion]);

  const insiderCooldownMs = useMemo(() => {
    if (!siegeTarget || !engine) return 0;
    const siegeSystem = engine.getSiegeSystem?.() ?? engine?.siege;
    return siegeSystem?.getInsiderCooldownRemaining?.(siegeTarget.id) ?? 0;
  }, [siegeTarget, engine, snapshotVersion]);

  // ── MAP-F08: 是否首次攻城该领土 ──
  const isFirstCapture = useMemo(() => {
    if (!siegeTarget || !engine) return false;
    const siegeSystem = engine.getSiegeSystem?.() ?? engine?.siege;
    return siegeSystem?.isFirstCapture?.(siegeTarget.id) ?? true;
  }, [siegeTarget, engine]);

  // ── 攻城执行入口（同步触发异步流程：创建任务→行军→到达时自动攻城） ──
  const handleSiegeConfirm = useCallback(() => {
    if (!siegeTarget || !engine) return;

    const marchingSystem = marchingSystemRef.current;
    if (!marchingSystem) return;

    // 1. 确定出发城市：优先使用已选源城市，否则找最近的己方城市
    const sourceTerritory = selectedSourceId
      ? territories.find((t) => t.id === selectedSourceId)
      : territories.find((t) => t.ownership === 'player');

    if (!sourceTerritory) {
      setSiegeVisible(false);
      setSiegeTarget(null);
      return;
    }

    // 2. 计算行军路线
    const route = marchingSystem.calculateMarchRoute(sourceTerritory.id, siegeTarget.id);
    if (!route) {
      setSiegeVisible(false);
      setSiegeTarget(null);
      return;
    }

    // 3. 创建攻占任务（状态: preparing）
    const siegeTaskManager = siegeTaskManagerRef.current;
    const deployTroops = selectedTroops > 0 ? selectedTroops : availableTroops;
    const currentGrain = engine.getResourceAmount?.('grain') ?? availableGrain;

    // 获取攻城系统预估消耗
    const siegeSystem = engine.getSiegeSystem?.() ?? engine?.siege;
    const costEstimate = siegeSystem?.calculateSiegeCost?.(siegeTarget.id) ??
      siegeSystem?.getSiegeCostById?.(siegeTarget.id) ?? { troops: deployTroops, grain: 100 };

    const task = siegeTaskManager.createTask({
      targetId: siegeTarget.id,
      targetName: siegeTarget.name,
      sourceId: sourceTerritory.id,
      sourceName: sourceTerritory.name,
      strategy: selectedStrategy,
      expedition: expeditionSelection
        ? {
            forceId: `force-${Date.now()}`,
            heroId: expeditionSelection.heroId,
            heroName: heroes.find((h) => h.id === expeditionSelection.heroId)?.name ?? '将军',
            troops: expeditionSelection.troops,
          }
        : {
            forceId: `force-${Date.now()}`,
            heroId: 'default-hero',
            heroName: '将军',
            troops: deployTroops,
          },
      cost: costEstimate,
      marchPath: route.path.map((p) => ({ x: p.x, y: p.y })),
      faction: 'wei',
    });

    if (!task) {
      // 攻城锁被占用，无法创建任务
      setMarchNotification('该城池正在被攻占中');
      setSiegeVisible(false);
      setSiegeTarget(null);
      return;
    }

    // 4. 创建行军单位并开始行军
    const pathWithPixels = route.path.map((p) => ({ x: p.x, y: p.y }));
    const march = marchingSystem.createMarch(
      sourceTerritory.id,
      siegeTarget.id,
      deployTroops,
      heroes.find((h) => h.id === expeditionSelection?.heroId)?.name ?? '将军',
      'wei',
      pathWithPixels,
    );

    // 5. 关联任务ID到行军单位（用于到达时匹配）
    march.siegeTaskId = task.id;

    marchingSystem.startMarch(march.id);

    // 6. 推进任务状态到 marching
    siegeTaskManager.advanceStatus(task.id, 'marching');
    const preview = marchingSystem.generatePreview(route.path);
    const estimatedDuration = preview.estimatedTime; // 秒（基于实际路径，已 clamp 到 [10,60]）
    siegeTaskManager.setEstimatedArrival(task.id, Date.now() + estimatedDuration * 1000);

    // 7. 更新UI状态
    setActiveSiegeTasks(siegeTaskManager.getActiveTasks());
    setMarchRoute(route);
    setSiegeVisible(false);
    setSiegeTarget(null);
    setSelectedId(null);
    setExpeditionSelection(null);
    setSelectedSourceId(null);

    // 稍后清除路线预览，让行军精灵接管
    setTimeout(() => setMarchRoute(null), 2000);
  }, [siegeTarget, engine, selectedTroops, availableTroops, availableGrain, expeditionSelection, territories, selectedStrategy, selectedSourceId, heroes]);

  // ── 取消攻城弹窗 ──
  const handleSiegeCancel = useCallback(() => {
    setSiegeVisible(false);
    setSiegeTarget(null);
    // J-01: 清除编队选择
    setExpeditionSelection(null);
  }, []);

  // ── R9 Task5: 聚焦行军路线 ──
  const handleFocusMarchRoute = useCallback((taskId: string) => {
    const task = siegeTaskManagerRef.current?.getTask(taskId);
    if (!task) return;

    // 1. 平移视窗到目标城池中心 — 通过 setSelectedId 实现
    setSelectedId(task.targetId);

    // 2. 如果有活跃行军，高亮路线
    if (task.status === 'marching' || task.status === 'returning') {
      setHighlightedTaskId(taskId);

      // 3. 触发像素地图居中到目标城池
      const targetTerritory = territoriesRef.current.find((t) => t.id === task.targetId);
      if (targetTerritory) {
        const event = new CustomEvent('map-center', { detail: { territoryId: task.targetId } });
        window.dispatchEvent(event);
      }
    } else {
      // 非行军状态也居中到目标城池
      const targetTerritory = territoriesRef.current.find((t) => t.id === task.targetId);
      if (targetTerritory) {
        const event = new CustomEvent('map-center', { detail: { territoryId: task.targetId } });
        window.dispatchEvent(event);
      }
    }
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

  // ── R9 Task5: 从攻城动画系统提取 defenseRatios ──
  const defenseRatiosMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (!siegeBattleAnimRef.current) return map;
    const anims = siegeBattleAnimRef.current.getActiveAnimations();
    for (const anim of anims) {
      map[anim.taskId] = anim.defenseRatio;
    }
    return map;
  }, [activeSiegeAnims]);

  // ── R9 Task5: 从行军系统提取 returnETAs ──
  const returnETAsMap = useMemo(() => {
    const map: Record<string, number> = {};
    const marchingSystem = marchingSystemRef.current;
    if (!marchingSystem) return map;
    const marches = marchingSystem.getActiveMarches();
    for (const march of marches) {
      if (march.siegeTaskId && march.eta) {
        map[march.siegeTaskId] = march.eta;
      }
    }
    return map;
  }, [activeMarches]);

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
              activeSiegeAnims={activeSiegeAnims}
              highlightedTaskId={highlightedTaskId}
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
        heroes={heroes}
        expeditionSelection={expeditionSelection}
        onExpeditionChange={setExpeditionSelection}
        selectedStrategy={selectedStrategy ?? undefined}
        onStrategyChange={setSelectedStrategy}
        insiderLetterCount={insiderLetterCount}
        insiderExposed={insiderExposed}
        insiderCooldownMs={insiderCooldownMs}
        nightRaidTokenCount={nightRaidTokenCount}
        isFirstCapture={isFirstCapture}
        onConfirm={handleSiegeConfirm}
        onCancel={handleSiegeCancel}
      />

      {/* P0-3: 攻城结果弹窗 ── */}
      <SiegeResultModal
        visible={siegeResultVisible}
        result={siegeResultData}
        injuryData={(() => {
          if (!siegeResultData?.casualties) return undefined;
          // 从 result.heroInjured 或 result.casualties 推断将领名称
          const generalName = siegeResultData.heroInjured?.heroId
            ? (heroes.find(h => h.id === siegeResultData.heroInjured!.heroId)?.name ?? '将军')
            : '将军';
          return mapInjuryData(siegeResultData.casualties, generalName);
        })()}
        troopLoss={(() => {
          if (!siegeResultData?.casualties) return undefined;
          const totalTroops = siegeResultData.cost?.troops ?? 0;
          return mapTroopLoss(siegeResultData.casualties, totalTroops);
        })()}
        onClose={() => {
          setSiegeResultVisible(false);
          setSiegeResultData(null);
        }}
      />

      {/* ── 攻占任务面板 ── */}
      <SiegeTaskPanel
        tasks={activeSiegeTasks}
        onSelectTask={(task) => {
          setSelectedId(task.targetId);
        }}
        onFocusMarchRoute={handleFocusMarchRoute}
        defenseRatios={defenseRatiosMap}
        returnETAs={returnETAsMap}
        onClaimReward={(taskId: string) => {
          siegeTaskManagerRef.current.claimReward(taskId);
        }}
        claimedRewardTaskIds={siegeTaskManagerRef.current.getClaimedRewards()}
        onPauseSiege={(taskId: string) => {
          const task = siegeTaskManagerRef.current.getTask(taskId);
          const snapshot = task?.pauseSnapshot ? undefined : {
            defenseRatio: defenseRatiosMap[taskId] ?? 1,
            elapsedBattleTime: task ? Date.now() - task.createdAt : 0,
          };
          siegeTaskManagerRef.current.pauseSiege(taskId, snapshot);
        }}
        onResumeSiege={(taskId: string) => {
          siegeTaskManagerRef.current.resumeSiege(taskId);
        }}
        onCancelSiege={(taskId: string) => {
          const marchingSys = marchingSystemRef.current;
          siegeTaskManagerRef.current.cancelSiege(taskId, marchingSys);
          // PRD: 攻城取消时移除关联的行军精灵
          if (marchingSys) {
            const marches = marchingSys.getActiveMarches();
            const taskMarch = marches.find((m) => m.siegeTaskId === taskId);
            if (taskMarch) {
              marchingSys.removeMarch(taskMarch.id);
            }
          }
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
