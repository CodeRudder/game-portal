/**
 * 三国霸业 v1.0 — 建筑面板组件
 *
 * 设计稿：06-building-system.md
 * PC端：4列建筑网格，卡片 160×180px
 * 手机端：纵向列表
 *
 * 功能：
 * - 8座建筑列表（图标+名称+等级+状态）
 * - 升级按钮（资源不足灰显）
 * - 升级进度条（升级中显示）
 * - 升级费用显示
 * - 升级队列悬浮面板
 * - 点击卡片打开升级弹窗
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { BuildingType, BuildingState, Resources, ProductionRate, ResourceCap } from '@/games/three-kingdoms/engine';
import {
  BUILDING_TYPES,
  BUILDING_LABELS,
  BUILDING_ICONS,
  BUILDING_ZONES,
} from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import BuildingUpgradeModal from './BuildingUpgradeModal';
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
  /** 升级失败回调，用于统一错误提示 */
  onUpgradeError?: (error: Error) => void;
}

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

/** 分区标签 */
const ZONE_LABELS: Record<string, string> = {
  core: '核心',
  civilian: '民生',
  military: '军事',
  cultural: '文教',
  defense: '防御',
};

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────
function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString('zh-CN');
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
        // 等待下一个 tick 让引擎更新
        setTimeout(() => onUpgradeComplete(type), 100);
      }
    } catch (e: any) {
      // 通过回调统一使用 Toast.danger 显示错误
      if (onUpgradeError) {
        onUpgradeError(e instanceof Error ? e : new Error(e?.message || '升级失败'));
      }
    }
  }, [engine, onUpgradeComplete, onUpgradeError]);

  // 处理卡片点击
  const handleCardClick = useCallback((type: BuildingType) => {
    const state = buildings[type];
    if (state?.status === 'locked') return;
    setSelectedBuilding(type);
  }, [buildings]);

  return (
    <div className="tk-building-panel">
      {/* 升级队列 — 右上角悬浮 */}
      {upgradingBuildings.length > 0 && (
        <div className="tk-bld-queue">
          <div className="tk-bld-queue-title">🔄 升级中 ({upgradingBuildings.length})</div>
          {upgradingBuildings.map(type => (
            <div key={type} className="tk-bld-queue-item">
              <span>{BUILDING_ICONS[type]} {BUILDING_LABELS[type]}→Lv.{buildings[type].level + 1}</span>
              <span className="tk-bld-queue-time">{formatTime(buildingInfo[type].remaining)}</span>
            </div>
          ))}
        </div>
      )}

      {/* PC端：建筑网格 */}
      <div className="tk-bld-grid">
        {BUILDING_TYPES.map(type => {
          const state = buildings[type];
          if (!state) return null;

          const info = buildingInfo[type];
          const isLocked = state.status === 'locked';
          const isUpgrading = state.status === 'upgrading';
          const canUpgrade = info.canUpgrade;

          // 卡片状态 class
          const cardClass = isLocked
            ? 'tk-bld-card tk-bld-card--locked'
            : isUpgrading
              ? 'tk-bld-card tk-bld-card--upgrading'
              : canUpgrade
                ? 'tk-bld-card tk-bld-card--upgradable'
                : 'tk-bld-card tk-bld-card--normal';

          return (
            <div
              key={type}
              className={cardClass}
              onClick={() => handleCardClick(type)}
              role="button"
              tabIndex={isLocked ? -1 : 0}
              aria-label={`${BUILDING_LABELS[type]} Lv.${state.level}`}
            >
              {/* 等级徽章 */}
              {!isLocked && (
                <div className="tk-bld-card-badge">{state.level}</div>
              )}

              {/* 图标 */}
              <div className="tk-bld-card-icon">
                {isLocked ? '🔒' : BUILDING_ICONS[type]}
              </div>

              {/* 信息区 */}
              <div className="tk-bld-card-info">
                <div className="tk-bld-card-name">{BUILDING_LABELS[type]}</div>
                {isLocked ? (
                  <div className="tk-bld-card-locked-text">未解锁</div>
                ) : (
                  <>
                    <div className="tk-bld-card-production">
                      {getProductionText(type, rates)}
                    </div>
                  </>
                )}
              </div>

              {/* 升级进度条 */}
              {isUpgrading && (
                <div className="tk-bld-card-progress">
                  <div
                    className="tk-bld-card-progress-bar"
                    style={{ width: `${Math.min(info.progress * 100, 100)}%` }}
                  />
                  <span className="tk-bld-card-progress-text">
                    {Math.floor(info.progress * 100)}% {formatTime(info.remaining)}
                  </span>
                </div>
              )}

              {/* 升级按钮 */}
              {!isLocked && !isUpgrading && (
                <button
                  className={`tk-bld-card-btn ${canUpgrade ? 'tk-bld-card-btn--active' : 'tk-bld-card-btn--disabled'}`}
                  disabled={!canUpgrade}
                  onClick={e => {
                    e.stopPropagation();
                    if (canUpgrade) setSelectedBuilding(type);
                  }}
                >
                  {canUpgrade ? '▲ 升级' : '升级'}
                </button>
              )}

              {/* 升级费用 */}
              {!isLocked && !isUpgrading && info.costText && (
                <div className="tk-bld-card-cost">{info.costText}</div>
              )}

              {/* 升级中标识 */}
              {isUpgrading && (
                <div className="tk-bld-card-upgrading-badge">
                  升级中 {formatTime(info.remaining)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 手机端：建筑列表 */}
      <div className="tk-bld-list">
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
              onClick={() => handleCardClick(type)}
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
                  <div className="tk-bld-list-detail" style={{ color: '#7EC850' }}>
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
    </div>
  );
};

BuildingPanel.displayName = 'BuildingPanel';

export default BuildingPanel;
