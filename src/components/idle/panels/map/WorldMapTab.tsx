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
  /** 选中领土回调 */
  onSelectTerritory?: (id: string) => void;
  /** 发起攻城回调 */
  onSiegeTerritory?: (id: string) => void;
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
  onSelectTerritory,
  onSiegeTerritory,
}) => {
  // ── 筛选状态 ──
  const [regionFilter, setRegionFilter] = useState<RegionId | 'all'>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipStatus | 'all'>('all');
  const [landmarkFilter, setLandmarkFilter] = useState<LandmarkType | 'all'>('all');
  const [showHeatmap, setShowHeatmap] = useState(false);

  // ── 选中领土 ──
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      onSiegeTerritory?.(id);
    },
    [onSiegeTerritory],
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
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default WorldMapTab;
