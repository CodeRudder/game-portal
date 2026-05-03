/**
 * BuildingPanel — 建筑面板组件
 * 设计规范: C区 6×5网格, 每格 180×160px
 */
import type { FC } from 'react';
import type { BuildingType, BuildingState } from '@/games/three-kingdoms/engine';
import { BUILDING_TYPES, BUILDING_LABELS, BUILDING_ICONS } from '@/games/three-kingdoms/engine';
import './BuildingPanel.css';

interface BuildingPanelProps {
  buildings: Record<BuildingType, BuildingState>;
  upgradeProgress: Record<BuildingType, number>;
  upgradeRemaining: Record<BuildingType, number>;
  canUpgradeMap: Record<BuildingType, boolean>;
  onUpgrade: (type: BuildingType) => void;
  onCancel: (type: BuildingType) => void;
}

/** 建筑核心效果描述 */
const BUILDING_EFFECTS: Record<BuildingType, string> = {
  castle: '全资源加成',
  farmland: '粮草/秒',
  market: '铜钱/秒',
  mine: '矿石/秒',
  lumberMill: '木材/秒',
  barracks: '兵力/秒',
  workshop: '装备锻造',
  academy: '科技点/秒',
  clinic: '伤兵恢复',
  wall: '城防值',
  tavern: '武将招募',
  port: '贸易折扣',
};

function formatTime(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const BuildingPanel: FC<BuildingPanelProps> = ({
  buildings,
  upgradeProgress,
  upgradeRemaining,
  canUpgradeMap,
  onUpgrade,
  onCancel,
}) => {
  // 升级中的建筑
  const upgradingBuildings = BUILDING_TYPES.filter(
    (t) => buildings[t]?.status === 'upgrading'
  );

  return (
    <div className="building-panel" data-testid="building-panel" style={{ position: 'relative' }}>
      {/* 升级队列 */}
      {upgradingBuildings.length > 0 && (
        <div className="upgrade-queue">
          <div className="upgrade-queue-title">🔄 升级中</div>
          {upgradingBuildings.map((type) => (
            <div key={type} className="upgrade-queue-item">
              <span>
                {BUILDING_LABELS[type]}→Lv.{buildings[type].level + 1}{' '}
                ({formatTime(upgradeRemaining[type])}剩余)
              </span>
              <div className="upgrade-queue-actions">
                <button onClick={() => onCancel(type)}>取消</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 建筑网格 */}
      <div className="building-grid">
        {BUILDING_TYPES.map((type) => {
          const state = buildings[type];
          if (!state) return null;

          const isLocked = state.status === 'locked';
          const isUpgrading = state.status === 'upgrading';
          const canUpgrade = canUpgradeMap[type];
          const progress = upgradeProgress[type] ?? 0;

          const cardClass = isLocked
            ? 'building-card locked'
            : isUpgrading
            ? 'building-card upgrading'
            : canUpgrade
            ? 'building-card can-upgrade'
            : 'building-card';

          return (
            <div key={type} className={cardClass}>
              {isLocked && (
                <div className="locked-overlay">🔒</div>
              )}

              <div className="building-icon-area">
                <span>{BUILDING_ICONS[type]}</span>
                <span className="building-icon-label">
                  {BUILDING_EFFECTS[type]}
                </span>
              </div>

              <div className="building-name">{BUILDING_LABELS[type]}</div>
              <div className="building-level">
                {isLocked ? '未解锁' : `Lv.${state.level}`}
              </div>

              {isUpgrading && (
                <div className="building-progress">
                  <div
                    className="building-progress-fill"
                    style={{ width: `${Math.min(progress * 100, 100)}%` }}
                  />
                </div>
              )}

              {!isLocked && !isUpgrading && (
                <div className="building-actions">
                  {canUpgrade && (
                    <button
                      className="btn-upgrade"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpgrade(type);
                      }}
                    >
                      升级
                    </button>
                  )}
                  <button className="btn-detail">详情</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
