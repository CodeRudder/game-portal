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

import React, { useState, useMemo, useCallback } from 'react';
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
import TerritoryInfoPanel from './TerritoryInfoPanel';
import SiegeConfirmModal from './SiegeConfirmModal';
import SiegeResultModal from './SiegeResultModal';
import type { SiegeResultData } from './SiegeResultModal';
import { formatNumber } from '@/components/idle/utils/formatNumber';
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

  // ── 选中领土数据 ──
  const selectedTerritory = useMemo(
    () => territories.find((t) => t.id === selectedId) ?? null,
    [territories, selectedId],
  );

  // ── 事件处理 ──
  const handleSelectTerritory = useCallback(
    (id: string) => {
      setSelectedId((prev) => (prev === id ? null : id));
      onSelectTerritory?.(id);
    },
    [onSelectTerritory],
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
      return { canSiege: true };
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
      // 从引擎获取当前可用兵力和粮草
      const currentTroops = engine.getResourceAmount?.('troops') ?? availableTroops;
      const currentGrain = engine.getResourceAmount?.('grain') ?? availableGrain;

      const result = siegeSystem.executeSiege(siegeTarget.id, 'player', currentTroops, currentGrain);

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
      // 攻城后清除选中状态，避免残留旧数据
      setSelectedId(null);
    }
    setSiegeVisible(false);
    setSiegeTarget(null);
  }, [siegeTarget, engine, availableTroops, availableGrain]);

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
      </div>

      {/* ── 地图主体 ── */}
      <div className="tk-worldmap-body">
        {/* 地图网格 */}
        <div className="tk-worldmap-grid-wrapper" data-testid="worldmap-grid-wrapper">
          {filteredTerritories.length === 0 ? (
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
          {/* 统计卡片 */}
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
    </div>
  );
};

export default WorldMapTab;
