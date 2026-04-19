/**
 * 三国霸业 v1.0 — 建筑面板组件
 *
 * 设计稿：[BLD-1] 建筑网格场景 (C区 1280×696px)
 * PC端：6×5 网格布局，每格 180×160px
 * 手机端：纵向列表，每条目 355×72px
 *
 * 8座建筑 + 空地块
 * 建筑卡片：图标 + 名称 + 等级 + 状态 + 操作按钮
 */

import React, { useMemo } from 'react';
import type {
  BuildingType,
  BuildingState,
  Resources,
  ProductionRate,
  ResourceCap,
  UpgradeCheckResult,
} from '@/games/three-kingdoms/engine';
import {
  BUILDING_TYPES,
  BUILDING_LABELS,
  BUILDING_ICONS,
  BUILDING_ZONES,
} from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine';
import './BuildingPanel.css';

interface BuildingPanelProps {
  buildings: Record<BuildingType, BuildingState>;
  resources: Resources;
  rates: ProductionRate;
  caps: ResourceCap;
  engine: ThreeKingdomsEngine;
  onUpgradeClick: (type: BuildingType) => void;
}

/** 建筑分区标签 */
const ZONE_LABELS: Record<string, string> = {
  core: '核心',
  civilian: '民生',
  military: '军事',
  cultural: '文教',
  defense: '防御',
};

/** 建筑在网格中的位置 (row, col) 1-based */
const GRID_POSITIONS: Record<BuildingType, { row: number; col: number }> = {
  wall:     { row: 1, col: 1 },
  castle:   { row: 3, col: 3 },
  farmland: { row: 2, col: 1 },
  market:   { row: 2, col: 2 },
  barracks: { row: 3, col: 2 },
  smithy:   { row: 3, col: 4 },
  academy:  { row: 2, col: 4 },
  clinic:   { row: 2, col: 5 },
};

/** 建筑产出描述 */
function getProductionDesc(type: BuildingType, level: number, rates: ProductionRate): string {
  if (level === 0) return '';
  switch (type) {
    case 'farmland':  return `🌾+${rates.grain.toFixed(1)}/秒`;
    case 'market':    return `💰+${rates.gold.toFixed(1)}/秒`;
    case 'barracks':  return `⚔️+${rates.troops.toFixed(1)}/秒`;
    case 'academy':   return '📚科技点/秒';
    case 'castle':    return '全资源加成';
    case 'smithy':    return '装备材料';
    case 'clinic':    return '伤兵恢复';
    case 'wall':      return '城防加成';
    default:          return '';
  }
}

/** 升级进度百分比 */
function getUpgradeProgress(state: BuildingState): number {
  if (state.status !== 'upgrading' || !state.upgradeEndTime || !state.upgradeStartTime) return 0;
  const now = Date.now();
  const total = state.upgradeEndTime - state.upgradeStartTime;
  const elapsed = now - state.upgradeStartTime;
  return total > 0 ? Math.min(elapsed / total, 1) : 0;
}

/** 升级剩余时间格式化 */
function formatRemainingTime(state: BuildingState): string {
  if (state.status !== 'upgrading' || !state.upgradeEndTime) return '';
  const remaining = Math.max(0, state.upgradeEndTime - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}:${secs.toString().padStart(2, '0')}`;
  return `${secs}秒`;
}

// ─── 建筑卡片组件 ────────────────────────────────
function BuildingCard({
  type,
  state,
  rates,
  canUpgrade,
  onUpgradeClick,
}: {
  type: BuildingType;
  state: BuildingState;
  rates: ProductionRate;
  canUpgrade: boolean;
  onUpgradeClick: () => void;
}) {
  const icon = BUILDING_ICONS[type];
  const name = BUILDING_LABELS[type];
  const zone = ZONE_LABELS[BUILDING_ZONES[type]] || '';
  const isLocked = state.status === 'locked';
  const isUpgrading = state.status === 'upgrading';
  const progress = getUpgradeProgress(state);
  const remaining = formatRemainingTime(state);
  const productionDesc = getProductionDesc(type, state.level, rates);

  // 状态样式类
  const statusClass = isLocked
    ? 'tk-bld-card--locked'
    : isUpgrading
      ? 'tk-bld-card--upgrading'
      : canUpgrade
        ? 'tk-bld-card--upgradable'
        : 'tk-bld-card--normal';

  return (
    <div className={`tk-bld-card ${statusClass}`}>
      {/* 图标区 */}
      <div className="tk-bld-card-icon">
        {isLocked ? '🔒' : icon}
      </div>

      {/* 信息区 */}
      <div className="tk-bld-card-info">
        <div className="tk-bld-card-name">{name}</div>
        <div className="tk-bld-card-level">
          {isLocked ? '未解锁' : `Lv.${state.level}`}
        </div>
        {/* 产出描述 */}
        {state.level > 0 && (
          <div className="tk-bld-card-production">{productionDesc}</div>
        )}
      </div>

      {/* 升级进度条（升级中显示） */}
      {isUpgrading && (
        <div className="tk-bld-card-progress">
          <div className="tk-bld-card-progress-bar" style={{ width: `${progress * 100}%` }} />
          <span className="tk-bld-card-progress-text">{remaining}</span>
        </div>
      )}

      {/* 操作按钮 */}
      {!isLocked && !isUpgrading && (
        <button
          className={`tk-bld-card-btn ${canUpgrade ? 'tk-bld-card-btn--active' : 'tk-bld-card-btn--disabled'}`}
          onClick={canUpgrade ? onUpgradeClick : undefined}
          disabled={!canUpgrade}
        >
          {canUpgrade ? '升级' : '升级'}
        </button>
      )}

      {/* 升级中标识 */}
      {isUpgrading && (
        <div className="tk-bld-card-upgrading-badge">🔄 升级中</div>
      )}
    </div>
  );
}

// ─── 手机端建筑条目 ──────────────────────────────
function BuildingListItem({
  type,
  state,
  rates,
  canUpgrade,
  upgradeCost,
  onUpgradeClick,
}: {
  type: BuildingType;
  state: BuildingState;
  rates: ProductionRate;
  canUpgrade: boolean;
  upgradeCost: { grain: number; gold: number } | null;
  onUpgradeClick: () => void;
}) {
  const icon = BUILDING_ICONS[type];
  const name = BUILDING_LABELS[type];
  const isLocked = state.status === 'locked';
  const isUpgrading = state.status === 'upgrading';
  const remaining = formatRemainingTime(state);
  const productionDesc = getProductionDesc(type, state.level, rates);

  return (
    <div className={`tk-bld-list-item ${isLocked ? 'tk-bld-list-item--locked' : ''}`}>
      <span className="tk-bld-list-icon">{isLocked ? '🔒' : icon}</span>
      <div className="tk-bld-list-info">
        <div className="tk-bld-list-name">
          {name} {isLocked ? '' : `Lv.${state.level}`}
        </div>
        <div className="tk-bld-list-detail">
          {isLocked ? (
            <span className="tk-bld-list-locked-text">
              需主城升级解锁
            </span>
          ) : isUpgrading ? (
            <span className="tk-bld-list-upgrading-text">🔄 {remaining}</span>
          ) : (
            <span>{productionDesc}</span>
          )}
        </div>
        {/* 升级费用预览（手机端显示） */}
        {!isLocked && !isUpgrading && upgradeCost && (
          <div className="tk-bld-list-cost">
            需: 🌾{upgradeCost.grain} 💰{upgradeCost.gold}
          </div>
        )}
      </div>
      <button
        className={`tk-bld-list-btn ${canUpgrade ? 'tk-bld-list-btn--active' : ''}`}
        onClick={canUpgrade ? onUpgradeClick : undefined}
        disabled={!canUpgrade || isLocked}
      >
        {isLocked ? '🔒' : isUpgrading ? '⏳' : '→'}
      </button>
    </div>
  );
}

// ─── 建筑面板主组件 ──────────────────────────────
export default function BuildingPanel({
  buildings,
  resources,
  rates,
  caps,
  engine,
  onUpgradeClick,
}: BuildingPanelProps) {
  // 预计算每个建筑的可升级状态
  const upgradeChecks = useMemo(() => {
    const checks: Record<BuildingType, { canUpgrade: boolean; cost: { grain: number; gold: number } | null }> = {} as any;
    for (const type of BUILDING_TYPES) {
      const state = buildings[type];
      if (state.status === 'locked' || state.status === 'upgrading') {
        checks[type] = { canUpgrade: false, cost: null };
        continue;
      }
      try {
        const check = engine.checkUpgrade(type);
        const cost = engine.getUpgradeCost(type);
        checks[type] = {
          canUpgrade: check.canUpgrade,
          cost: cost ? { grain: cost.grain, gold: cost.gold } : null,
        };
      } catch {
        checks[type] = { canUpgrade: false, cost: null };
      }
    }
    return checks;
  }, [buildings, engine, resources]);

  // PC端网格布局：按位置排列
  const gridBuildings = useMemo(() => {
    const items: Array<{
      type: BuildingType;
      row: number;
      col: number;
    }> = BUILDING_TYPES.map(type => ({
      type,
      ...GRID_POSITIONS[type],
    }));
    return items.sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);
  }, []);

  return (
    <div className="tk-building-panel">
      {/* 升级队列（右上角悬浮） */}
      {BUILDING_TYPES.some(t => buildings[t].status === 'upgrading') && (
        <div className="tk-bld-queue">
          {BUILDING_TYPES.filter(t => buildings[t].status === 'upgrading').map(type => (
            <div key={type} className="tk-bld-queue-item">
              <span>{BUILDING_ICONS[type]} {BUILDING_LABELS[type]}→Lv.{buildings[type].level + 1}</span>
              <span className="tk-bld-queue-time">{formatRemainingTime(buildings[type])}</span>
            </div>
          ))}
        </div>
      )}

      {/* PC端：建筑网格 */}
      <div className="tk-bld-grid">
        {gridBuildings.map(({ type }) => (
          <BuildingCard
            key={type}
            type={type}
            state={buildings[type]}
            rates={rates}
            canUpgrade={upgradeChecks[type].canUpgrade}
            onUpgradeClick={() => onUpgradeClick(type)}
          />
        ))}
      </div>

      {/* 手机端：建筑列表 */}
      <div className="tk-bld-list">
        {BUILDING_TYPES.map(type => (
          <BuildingListItem
            key={type}
            type={type}
            state={buildings[type]}
            rates={rates}
            canUpgrade={upgradeChecks[type].canUpgrade}
            upgradeCost={upgradeChecks[type].cost}
            onUpgradeClick={() => onUpgradeClick(type)}
          />
        ))}
      </div>
    </div>
  );
}
