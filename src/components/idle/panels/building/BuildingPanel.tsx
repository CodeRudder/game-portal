/**
 * 三国霸业 v1.0 — 建筑面板组件（城池地图版）
 *
 * 设计稿：BLD-buildings.md [BLD-1] 建筑网格场景
 * PC端：地图式布局，建筑图标按位置错落放置
 * 手机端：纵向列表
 *
 * 功能：
 * - 8座建筑按固定位置放置在城池地图上
 * - 未解锁建筑灰色显示
 * - 升级队列悬浮面板（右上角）
 * - 点击建筑打开升级弹窗
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { BuildingType, BuildingState, Resources, ProductionRate, ResourceCap } from '@/games/three-kingdoms/engine';
import {
  BUILDING_TYPES,
  BUILDING_LABELS,
  BUILDING_ICONS,
} from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import { formatNumber } from '@/components/idle/utils/formatNumber';
import BuildingUpgradeModal from './BuildingUpgradeModal';
import BuildingIncomeModal from './BuildingIncomeModal';
import './BuildingPanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface BuildingPanelProps {
  buildings: Record<BuildingType, BuildingState>;
  resources: Resources;
  rates: ProductionRate;
  caps: ResourceCap;
  engine: ThreeKingdomsEngine;
  snapshotVersion: number;
  onUpgradeComplete?: (type: BuildingType) => void;
  onUpgradeError?: (error: Error) => void;
}

// ─────────────────────────────────────────────
// 建筑地图位置规划（百分比定位，相对地图容器）
//
// 布局参考：
//        [铁匠铺]
//  [农田]  [主城]  [伐木场(市集)]
//  [兵营] [仓库(书院)] [瞭望塔(城墙)]
//         [医馆]
// ─────────────────────────────────────────────
interface MapPosition {
  top: number; // 百分比
  left: number; // 百分比
}

/** 建筑在地图上的固定位置（百分比） */
const BUILDING_MAP_POSITIONS: Record<BuildingType, MapPosition> = {
  smithy:   { top: 5,  left: 42 },  // 顶部中央
  farmland: { top: 28, left: 10 },  // 左侧
  castle:   { top: 30, left: 42 },  // 核心中央
  market:   { top: 28, left: 74 },  // 右侧
  barracks: { top: 55, left: 10 },  // 左下
  academy:  { top: 55, left: 42 },  // 中下
  wall:     { top: 55, left: 74 },  // 右下
  clinic:   { top: 78, left: 42 },  // 底部中央
};

// ─────────────────────────────────────────────
// 建筑核心效果描述
// ─────────────────────────────────────────────
const BUILDING_EFFECTS: Record<BuildingType, string> = {
  castle: '全资源加成',
  farmland: '粮草/秒',
  market: '铜钱/秒',
  barracks: '兵力/秒',
  smithy: '装备强化',
  academy: '科技点/秒',
  clinic: '伤兵恢复',
  wall: '城防值',
};

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────
function formatNum(n: number): string {
  return formatNumber(n);
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getProductionText(type: BuildingType, rates: ProductionRate): string {
  switch (type) {
    case 'farmland': return `+${rates.grain.toFixed(1)} 粮草/s`;
    case 'market': return `+${rates.gold.toFixed(1)} 铜钱/s`;
    case 'barracks': return `+${rates.troops.toFixed(1)} 兵力/s`;
    case 'academy': return `+${rates.mandate.toFixed(1)} 科技点/s`;
    default: return BUILDING_EFFECTS[type];
  }
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const BuildingPanel: React.FC<BuildingPanelProps> = ({
  buildings,
  resources,
  rates,
  caps,
  engine,
  snapshotVersion,
  onUpgradeComplete,
  onUpgradeError,
}) => {
  // 升级弹窗状态
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingType | null>(null);
  // P1-03: 资源收支详情弹窗
  const [showIncomeModal, setShowIncomeModal] = useState(false);

  // 计算每座建筑的可升级状态和进度
  const buildingInfo = useMemo(() => {
    const info: Record<BuildingType, {
      canUpgrade: boolean;
      progress: number;
      remaining: number;
      costText: string;
    }> = {} as any;

    for (const type of BUILDING_TYPES) {
      const state = buildings[type];
      const check = engine.checkUpgrade(type);
      const cost = engine.getUpgradeCost(type);
      const progress = engine.getUpgradeProgress(type);
      const remaining = engine.getUpgradeRemainingTime(type);

      let costText = '';
      if (cost) {
        const parts: string[] = [];
        if (cost.grain > 0) parts.push(`${formatNum(cost.grain)}粮`);
        if (cost.gold > 0) parts.push(`${formatNum(cost.gold)}钱`);
        if (cost.troops > 0) parts.push(`${formatNum(cost.troops)}兵`);
        costText = parts.join(' / ');
      }

      info[type] = {
        canUpgrade: check.canUpgrade,
        progress,
        remaining,
        costText,
      };
    }

    return info;
  }, [buildings, snapshotVersion]);

  // 升级中的建筑列表
  const upgradingBuildings = useMemo(
    () => BUILDING_TYPES.filter(t => buildings[t]?.status === 'upgrading'),
    [buildings],
  );

  // 处理升级确认
  const handleUpgradeConfirm = useCallback((type: BuildingType) => {
    try {
      engine.upgradeBuilding(type);
      setSelectedBuilding(null);
      if (onUpgradeComplete) {
        setTimeout(() => onUpgradeComplete(type), 100);
      }
    } catch (e: any) {
      if (onUpgradeError) {
        onUpgradeError(e instanceof Error ? e : new Error(e?.message || '升级失败'));
      }
    }
  }, [engine, onUpgradeComplete, onUpgradeError]);

  // 处理建筑点击
  const handleBuildingClick = useCallback((type: BuildingType) => {
    const state = buildings[type];
    if (state?.status === 'locked') return;
    setSelectedBuilding(type);
  }, [buildings]);

  return (
    <div className="tk-building-panel" data-testid="building-panel">
      {/* P1-03: 资源收支详情按钮 */}
      <div className="tk-bld-income-bar">
        <button
          className="tk-bld-income-btn"
          data-testid="building-panel-income-btn"
          onClick={() => setShowIncomeModal(true)}
        >
          📊 收支详情
        </button>
      </div>

      {/* 升级队列 — 右上角悬浮 */}
      {upgradingBuildings.length > 0 && (
        <div className="tk-bld-queue" data-testid="building-panel-queue">
          <div className="tk-bld-queue-title">🔄 升级中 ({upgradingBuildings.length})</div>
          {upgradingBuildings.map(type => (
            <div key={type} className="tk-bld-queue-item">
              <span>{BUILDING_ICONS[type]} {BUILDING_LABELS[type]}→Lv.{buildings[type].level + 1}</span>
              <span className="tk-bld-queue-time">{formatTime(buildingInfo[type].remaining)}</span>
            </div>
          ))}
        </div>
      )}

      {/* PC端：城池地图（绝对定位） */}
      <div className="tk-bld-map" data-testid="building-panel-map">
        {/* 地图背景装饰 */}
        <div className="tk-bld-map-ground" />

        {BUILDING_TYPES.map(type => {
          const state = buildings[type];
          if (!state) return null;

          const info = buildingInfo[type];
          const isLocked = state.status === 'locked';
          const isUpgrading = state.status === 'upgrading';
          const canUpgrade = info.canUpgrade;
          const pos = BUILDING_MAP_POSITIONS[type];

          // 建筑状态 class
          const buildingClass = isLocked
            ? 'tk-bld-pin tk-bld-pin--locked'
            : isUpgrading
              ? 'tk-bld-pin tk-bld-pin--upgrading'
              : canUpgrade
                ? 'tk-bld-pin tk-bld-pin--upgradable'
                : 'tk-bld-pin tk-bld-pin--normal';

          return (
            <div
              key={type}
              className={buildingClass}
              data-testid={`building-panel-item-${type}`}
              style={{ top: `${pos.top}%`, left: `${pos.left}%` }}
              onClick={() => handleBuildingClick(type)}
              role="button"
              tabIndex={isLocked ? -1 : 0}
              aria-label={`${BUILDING_LABELS[type]} Lv.${state.level}`}
            >
              {/* 等级徽章 */}
              {!isLocked && (
                <div className="tk-bld-pin-badge">Lv.{state.level}</div>
              )}

              {/* 图标 */}
              <div className="tk-bld-pin-icon">
                {isLocked ? '🔒' : BUILDING_ICONS[type]}
              </div>

              {/* 名称 */}
              <div className="tk-bld-pin-name">{BUILDING_LABELS[type]}</div>

              {/* 产出/状态 */}
              {isLocked ? (
                <div className="tk-bld-pin-status tk-bld-pin-status--locked">未解锁</div>
              ) : isUpgrading ? (
                <div className="tk-bld-pin-status tk-bld-pin-status--upgrading">
                  <div className="tk-bld-pin-progress">
                    <div
                      className="tk-bld-pin-progress-bar"
                      style={{ width: `${Math.min(info.progress * 100, 100)}%` }}
                    />
                  </div>
                  <span>{formatTime(info.remaining)}</span>
                </div>
              ) : (
                <div className="tk-bld-pin-status">
                  {getProductionText(type, rates)}
                </div>
              )}

              {/* 可升级指示器 */}
              {canUpgrade && !isUpgrading && (
                <div className="tk-bld-pin-upgrade-indicator">▲</div>
              )}
            </div>
          );
        })}
      </div>

      {/* 手机端：建筑列表 */}
      <div className="tk-bld-list" data-testid="building-panel-list">
        {BUILDING_TYPES.map(type => {
          const state = buildings[type];
          if (!state) return null;

          const info = buildingInfo[type];
          const isLocked = state.status === 'locked';
          const isUpgrading = state.status === 'upgrading';
          const canUpgrade = info.canUpgrade;

          return (
            <div
              key={type}
              className={`tk-bld-list-item ${isLocked ? 'tk-bld-list-item--locked' : ''}`}
              data-testid={`building-panel-list-item-${type}`}
              onClick={() => handleBuildingClick(type)}
            >
              <div className="tk-bld-list-icon">
                {isLocked ? '🔒' : BUILDING_ICONS[type]}
              </div>
              <div className="tk-bld-list-info">
                <div className="tk-bld-list-name">
                  {BUILDING_LABELS[type]} Lv.{state.level}
                </div>
                {isLocked ? (
                  <div className="tk-bld-list-detail">未解锁</div>
                ) : isUpgrading ? (
                  <div className="tk-bld-list-detail tk-bld-list-detail--upgrading">
                    升级中 {Math.floor(info.progress * 100)}% {formatTime(info.remaining)}
                  </div>
                ) : (
                  <div className="tk-bld-list-detail">
                    {getProductionText(type, rates)}
                  </div>
                )}
                {!isLocked && !isUpgrading && info.costText && (
                  <div className="tk-bld-list-cost">{info.costText}</div>
                )}
              </div>
              {!isLocked && !isUpgrading && (
                <button
                  className={`tk-bld-list-btn ${canUpgrade ? 'tk-bld-list-btn--active' : ''}`}
                  disabled={!canUpgrade}
                  onClick={e => {
                    e.stopPropagation();
                    if (canUpgrade) setSelectedBuilding(type);
                  }}
                >
                  ▲
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 建筑升级弹窗 */}
      {selectedBuilding && (
        <BuildingUpgradeModal
          buildingType={selectedBuilding}
          engine={engine}
          resources={resources}
          onConfirm={handleUpgradeConfirm}
          onCancel={() => setSelectedBuilding(null)}
        />
      )}

      {/* P1-03: 资源收支详情弹窗 */}
      <BuildingIncomeModal
        isOpen={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
        engine={engine}
        buildings={buildings}
        rates={rates}
      />
    </div>
  );
};

BuildingPanel.displayName = 'BuildingPanel';

export default BuildingPanel;
