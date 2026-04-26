/**
 * 三国霸业 v1.0 — 建筑升级弹窗组件
 *
 * 设计稿：06-building-system.md 建筑详情面板
 * 居中弹窗，显示升级预览 + 费用 + 操作按钮
 * 关闭方式：[×] / 点击遮罩 / ESC
 */
import React, { useMemo, useState } from 'react';
import type { BuildingType, Resources } from '@/games/three-kingdoms/engine';
import {
  BUILDING_LABELS,
  BUILDING_ICONS,
  BUILDING_ZONES,
} from '@/games/three-kingdoms/engine';
import { BUILDING_DEFS } from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine';
import { formatNumber } from '@/components/idle/utils/formatNumber';
import SharedPanel from '../../components/SharedPanel';
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

  // BUG-1: 满级判断
  const maxLevel = BUILDING_DEFS[buildingType]?.maxLevel ?? 0;
  const isMaxLevel = info.level >= maxLevel;

  // Bug-04: 防重复点击保护
  const [upgrading, setUpgrading] = useState(false);

  const canAfford = affordability.grain && affordability.gold && affordability.troops;

  // BUG-2: 使用引擎综合判断（canUpgrade）+ 资源检查（canAfford）+ 满级检查
  const isConfirmDisabled = !info.canUpgrade || !canAfford || upgrading || isMaxLevel;

  // 防重复点击的升级确认处理
  const handleConfirm = () => {
    if (isConfirmDisabled) return;
    setUpgrading(true);
    onConfirm(buildingType);
  };

  return (
    <SharedPanel title={`${name}升级`} onClose={onCancel} visible={true}>
        {/* 建筑头部 */}
        <div className="tk-upgrade-header" data-testid="building-upgrade-header">
          <span className="tk-upgrade-icon">{icon}</span>
          <div className="tk-upgrade-header-info">
            <div className="tk-upgrade-name">{name} · {zone}建筑</div>
            <div className="tk-upgrade-level">Lv.{info.level}</div>
          </div>
        </div>

        {/* BUG-1: 满级建筑显示"已满级"，非满级显示升级预览 */}
        {isMaxLevel ? (
          <div className="tk-upgrade-section">
            <div className="tk-upgrade-section-title" style={{ textAlign: 'center', color: 'var(--tk-gold, #D4A017)' }}>
              🏆 已达最高等级
            </div>
          </div>
        ) : (
          <>
            {/* 升级预览 */}
            <div className="tk-upgrade-section">
              <div className="tk-upgrade-section-title">升级预览</div>
              <div className="tk-upgrade-level-change">
                Lv.{info.level} → Lv.{info.level + 1}
              </div>
              {/* 产出变化预览 */}
              {(() => {
                const def = BUILDING_DEFS[buildingType];
                const currentLevelData = def?.levelTable?.[info.level - 1];
                const nextLevelData = def?.levelTable?.[info.level];
                if (!def?.production || !currentLevelData) return null;
                const prod = def.production;
                const currentProd = currentLevelData.production;
                const nextProd = nextLevelData?.production ?? currentProd;
                const resIcon: Record<string, string> = { grain: '🌾', gold: '💰', troops: '⚔️', mandate: '👑', material: '🔨', techPoint: '📜' };
                return (
                  <div className="tk-upgrade-production">
                    <span className="tk-upgrade-prod-icon">{resIcon[prod.resourceType] || '📊'}</span>
                    <span className="tk-upgrade-prod-label">产出</span>
                    <span className="tk-upgrade-prod-current">{formatNum(currentProd)}/秒</span>
                    <span className="tk-upgrade-prod-arrow">→</span>
                    <span className="tk-upgrade-prod-next">{formatNum(nextProd)}/秒</span>
                  </div>
                );
              })()}
              {/* 特殊属性变化预览 */}
              {(() => {
                const def = BUILDING_DEFS[buildingType];
                const currentLevelData = def?.levelTable?.[info.level - 1];
                const nextLevelData = def?.levelTable?.[info.level];
                if (!def?.specialAttribute || !currentLevelData) return null;
                const currentVal = currentLevelData.specialValue ?? 0;
                const nextVal = nextLevelData?.specialValue ?? currentVal;
                return (
                  <div className="tk-upgrade-production">
                    <span className="tk-upgrade-prod-icon">📊</span>
                    <span className="tk-upgrade-prod-label">{def.specialAttribute.name}</span>
                    <span className="tk-upgrade-prod-current">{currentVal}%</span>
                    <span className="tk-upgrade-prod-arrow">→</span>
                    <span className="tk-upgrade-prod-next">{nextVal}%</span>
                  </div>
                );
              })()}
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
          </>
        )}

        {/* 失败原因 */}
        {!info.canUpgrade && info.reasons.length > 0 && (
          <div className="tk-upgrade-section tk-upgrade-reasons">
            {info.reasons.map((reason: string, i: number) => (
              <div key={i} className="tk-upgrade-reason">❌ {reason}</div>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="tk-upgrade-actions">
          <button className="tk-upgrade-btn tk-upgrade-btn--cancel" data-testid="building-upgrade-cancel" onClick={onCancel}>
            取消
          </button>
          <button
            className={`tk-upgrade-btn tk-upgrade-btn--confirm ${isConfirmDisabled ? 'tk-upgrade-btn--disabled' : ''}`}
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            data-testid="building-upgrade-confirm"
          >
            {isMaxLevel ? '已满级' : upgrading ? '升级中...' : !info.canUpgrade ? '无法升级' : canAfford ? '▲ 升级' : '资源不足'}
          </button>
        </div>
    </SharedPanel>
  );
};

BuildingUpgradeModal.displayName = 'BuildingUpgradeModal';

export default BuildingUpgradeModal;
