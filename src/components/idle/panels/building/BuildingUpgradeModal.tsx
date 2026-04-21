/**
 * 三国霸业 v1.0 — 建筑升级弹窗组件
 *
 * 设计稿：06-building-system.md 建筑详情面板
 * 居中弹窗，显示升级预览 + 费用 + 操作按钮
 * 关闭方式：[×] / 点击遮罩 / ESC
 */
import React, { useMemo } from 'react';
import type { BuildingType, Resources } from '@/games/three-kingdoms/engine';
import {
  BUILDING_LABELS,
  BUILDING_ICONS,
  BUILDING_ZONES,
} from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine';
import { formatNumber } from '@/components/idle/utils/formatNumber';
import { SharedPanel } from '../../components/SharedPanel';
import './BuildingUpgradeModal.css';

interface BuildingUpgradeModalProps {
  buildingType: BuildingType;
  engine: ThreeKingdomsEngine;
  resources: Resources;
  onConfirm: (type: BuildingType) => void;
  onCancel: () => void;
}

/** 分区标签 */
const ZONE_LABELS: Record<string, string> = {
  core: '核心',
  civilian: '民生',
  military: '军事',
  cultural: '文教',
  defense: '防御',
};

/** 格式化数值 */
function formatNum(n: number): string {
  return formatNumber(n);
}

/** 格式化时间 */
function formatTime(seconds: number): string {
  if (seconds <= 0) return '瞬间';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) return `${mins}分${secs > 0 ? `${secs}秒` : '钟'}`;
  return `${secs}秒`;
}

const BuildingUpgradeModal: React.FC<BuildingUpgradeModalProps> = ({
  buildingType,
  engine,
  resources,
  onConfirm,
  onCancel,
}) => {
  const icon = BUILDING_ICONS[buildingType];
  const name = BUILDING_LABELS[buildingType];
  const zone = ZONE_LABELS[BUILDING_ZONES[buildingType]] || '';

  // 获取建筑状态和升级信息
  const info = useMemo(() => {
    let snapshot;
    try {
      snapshot = engine.getSnapshot();
    } catch (e) {
      console.error('[BuildingUpgradeModal] getSnapshot failed:', e);
      return { level: 0, status: 'idle', canUpgrade: false, reasons: [], cost: null };
    }
    const state = snapshot.buildings[buildingType];
    const level = state.level;
    let check;
    try {
      check = engine.checkUpgrade(buildingType);
    } catch (e) {
      console.error('[BuildingUpgradeModal] checkUpgrade failed:', e);
      check = { canUpgrade: false, reasons: ['引擎异常'] };
    }
    let cost;
    try {
      cost = engine.getUpgradeCost(buildingType);
    } catch (e) {
      console.error('[BuildingUpgradeModal] getUpgradeCost failed:', e);
      cost = null;
    }

    return {
      level,
      status: state.status,
      canUpgrade: check.canUpgrade,
      reasons: check.reasons,
      cost,
    };
  }, [engine, buildingType, resources]);

  // 检查各项资源是否充足
  const affordability = useMemo(() => {
    if (!info.cost) return { grain: true, gold: true, troops: true };
    return {
      grain: resources.grain >= info.cost.grain,
      gold: resources.gold >= info.cost.gold,
      troops: resources.troops >= (info.cost.troops || 0),
    };
  }, [info.cost, resources]);

  const canAfford = affordability.grain && affordability.gold && affordability.troops;

  return (
    <SharedPanel title={`${name}升级`} onClose={onCancel}>
        {/* 建筑头部 */}
        <div className="tk-upgrade-header">
          <span className="tk-upgrade-icon">{icon}</span>
          <div className="tk-upgrade-header-info">
            <div className="tk-upgrade-name">{name} · {zone}建筑</div>
            <div className="tk-upgrade-level">Lv.{info.level}</div>
          </div>
        </div>

        {/* 升级预览 */}
        <div className="tk-upgrade-section">
          <div className="tk-upgrade-section-title">升级预览</div>
          <div className="tk-upgrade-level-change">
            Lv.{info.level} → Lv.{info.level + 1}
          </div>
        </div>

        {/* 升级消耗 */}
        {info.cost && (
          <div className="tk-upgrade-section">
            <div className="tk-upgrade-section-title">升级消耗</div>
            <div className="tk-upgrade-costs">
              <div className={`tk-upgrade-cost-item ${affordability.grain ? 'tk-upgrade-cost--enough' : 'tk-upgrade-cost--short'}`}>
                <span className="tk-upgrade-cost-icon">🌾</span>
                <span className="tk-upgrade-cost-value">{formatNum(info.cost.grain)}</span>
                <span className="tk-upgrade-cost-current">/ {formatNum(resources.grain)}</span>
                <span className="tk-upgrade-cost-status">{affordability.grain ? '✅' : '❌'}</span>
              </div>
              <div className={`tk-upgrade-cost-item ${affordability.gold ? 'tk-upgrade-cost--enough' : 'tk-upgrade-cost--short'}`}>
                <span className="tk-upgrade-cost-icon">💰</span>
                <span className="tk-upgrade-cost-value">{formatNum(info.cost.gold)}</span>
                <span className="tk-upgrade-cost-current">/ {formatNum(resources.gold)}</span>
                <span className="tk-upgrade-cost-status">{affordability.gold ? '✅' : '❌'}</span>
              </div>
              {info.cost.troops > 0 && (
                <div className={`tk-upgrade-cost-item ${affordability.troops ? 'tk-upgrade-cost--enough' : 'tk-upgrade-cost--short'}`}>
                  <span className="tk-upgrade-cost-icon">⚔️</span>
                  <span className="tk-upgrade-cost-value">{formatNum(info.cost.troops)}</span>
                  <span className="tk-upgrade-cost-current">/ {formatNum(resources.troops)}</span>
                  <span className="tk-upgrade-cost-status">{affordability.troops ? '✅' : '❌'}</span>
                </div>
              )}
              <div className="tk-upgrade-cost-item tk-upgrade-cost-time">
                <span className="tk-upgrade-cost-icon">⏱️</span>
                <span className="tk-upgrade-cost-value">{formatTime(info.cost.timeSeconds)}</span>
              </div>
            </div>
          </div>
        )}

        {/* 失败原因 */}
        {!info.canUpgrade && info.reasons.length > 0 && (
          <div className="tk-upgrade-section tk-upgrade-reasons">
            {info.reasons.map((reason, i) => (
              <div key={i} className="tk-upgrade-reason">❌ {reason}</div>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="tk-upgrade-actions">
          <button className="tk-upgrade-btn tk-upgrade-btn--cancel" onClick={onCancel}>
            取消
          </button>
          <button
            className={`tk-upgrade-btn tk-upgrade-btn--confirm ${!canAfford ? 'tk-upgrade-btn--disabled' : ''}`}
            onClick={() => canAfford && onConfirm(buildingType)}
            disabled={!canAfford}
          >
            {canAfford ? `▲ 升级` : '资源不足'}
          </button>
        </div>
    </SharedPanel>
  );
};

BuildingUpgradeModal.displayName = 'BuildingUpgradeModal';

export default BuildingUpgradeModal;
