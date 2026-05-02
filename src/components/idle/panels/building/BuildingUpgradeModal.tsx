/**
 * 三国霸业 v1.0 — 建筑升级弹窗组件
 *
 * 设计稿：06-building-system.md 建筑详情面板
 * 居中弹窗，显示升级预览 + 费用 + 操作按钮
 * 关闭方式：[×] / 点击遮罩 / ESC
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { BuildingType, Resources } from '@/games/three-kingdoms/engine';
import {
  BUILDING_LABELS,
  BUILDING_ICONS,
  BUILDING_ZONES,
} from '@/games/three-kingdoms/engine';
import { BUILDING_DEFS } from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine';
import { formatNumber } from '@/components/idle/utils/formatNumber';
import { Toast } from '@/components/idle/common/Toast';
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

  // Fix #3: 首次升级完成总结弹窗
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    buildingName: string;
    buildingIcon: string;
    fromLevel: number;
    toLevel: number;
    changes: Array<{ label: string; from: string; to: string; diff: string }>;
  } | null>(null);

  // Fix #4: 资源不足时点击按钮的Toast提示已处理（见handleConfirm）

  const canAfford = affordability.grain && affordability.gold && affordability.troops;

  // BUG-2: 使用引擎综合判断（canUpgrade）+ 资源检查（canAfford）+ 满级检查
  const isConfirmDisabled = !info.canUpgrade || !canAfford || upgrading || isMaxLevel;

  // Fix #3: 检查是否为首次升级
  const isFirstUpgrade = useMemo(() => {
    try {
      return !localStorage.getItem('tk_first_upgrade_done');
    } catch {
      return false;
    }
  }, []);

  // 防重复点击的升级确认处理
  const handleConfirm = () => {
    if (isConfirmDisabled) {
      // Fix #4: 资源不足时点击禁用按钮显示Toast提示
      if (info.canUpgrade && !canAfford && !isMaxLevel) {
        const shortages: string[] = [];
        if (!affordability.grain) {
          const deficit = (info.cost?.grain ?? 0) - resources.grain;
          shortages.push(`粮草不足 ${formatNum(Math.abs(deficit))}`);
        }
        if (!affordability.gold) {
          const deficit = (info.cost?.gold ?? 0) - resources.gold;
          shortages.push(`铜钱不足 ${formatNum(Math.abs(deficit))}`);
        }
        if (!affordability.troops && (info.cost?.troops ?? 0) > 0) {
          const deficit = (info.cost?.troops ?? 0) - resources.troops;
          shortages.push(`兵力不足 ${formatNum(Math.abs(deficit))}`);
        }
        if (shortages.length > 0) {
          Toast.warning(shortages.join('，'), 3000);
        }
      }
      return;
    }

    // Fix #3: 收集升级前数据用于总结弹窗
    const def = BUILDING_DEFS[buildingType];
    const prevLevel = info.level;
    const nextLevel = info.level + 1;
    const currentLevelData = def?.levelTable?.[prevLevel - 1];
    const nextLevelData = def?.levelTable?.[nextLevel - 1];
    const changes: Array<{ label: string; from: string; to: string; diff: string }> = [];

    if (def?.production && currentLevelData && nextLevelData) {
      const currentProd = currentLevelData.production;
      const nextProd = nextLevelData.production;
      const diff = nextProd - currentProd;
      const resIcon: Record<string, string> = { grain: '🌾', gold: '💰', troops: '⚔️', mandate: '👑', material: '🔨', techPoint: '📜' };
      changes.push({
        label: `${resIcon[def.production.resourceType] || '📊'} 产出`,
        from: `${currentProd}/秒`,
        to: `${nextProd}/秒`,
        diff: `+${diff.toFixed(1)}/秒`,
      });
    }

    // 主城全资源加成
    if (buildingType === 'castle' && currentLevelData && nextLevelData) {
      const currentBonus = currentLevelData.production ?? 0;
      const nextBonus = nextLevelData.production ?? 0;
      const bonusDiff = nextBonus - currentBonus;
      changes.push({
        label: '🏛️ 全资源加成',
        from: `${currentBonus}%`,
        to: `${nextBonus}%`,
        diff: `+${bonusDiff}%`,
      });
    }

    // 特殊属性
    if (def?.specialAttribute && currentLevelData && nextLevelData) {
      const currentVal = currentLevelData.specialValue ?? 0;
      const nextVal = nextLevelData.specialValue ?? 0;
      changes.push({
        label: `📊 ${def.specialAttribute.name}`,
        from: `${currentVal}%`,
        to: `${nextVal}%`,
        diff: `+${nextVal - currentVal}%`,
      });
    }

    setUpgrading(true);

    // Fix #3: 首次升级时显示总结弹窗
    if (isFirstUpgrade && changes.length > 0) {
      setSummaryData({
        buildingName: BUILDING_LABELS[buildingType],
        buildingIcon: BUILDING_ICONS[buildingType],
        fromLevel: prevLevel,
        toLevel: nextLevel,
        changes,
      });
      try { localStorage.setItem('tk_first_upgrade_done', '1'); } catch {}
    }

    onConfirm(buildingType);
  };

  return (
    <>
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
              {/* 主城专属：全资源加成醒目提示（P0-1 增强感知） */}
              {(() => {
                if (buildingType !== 'castle') return null;
                const currentLevelData = BUILDING_DEFS.castle.levelTable[info.level - 1];
                const nextLevelData = BUILDING_DEFS.castle.levelTable[info.level];
                const currentBonus = currentLevelData?.production ?? 0;
                const nextBonus = nextLevelData?.production ?? currentBonus;
                const bonusDiff = nextBonus - currentBonus;
                return (
                  <div className="tk-upgrade-castle-bonus">
                    <div className="tk-upgrade-castle-bonus-title">🏛️ 全资源加成</div>
                    <div className="tk-upgrade-castle-bonus-change">
                      <span className="tk-upgrade-castle-bonus-current">{currentBonus}%</span>
                      <span className="tk-upgrade-castle-bonus-arrow">→</span>
                      <span className="tk-upgrade-castle-bonus-next">+{nextBonus}%</span>
                    </div>
                    <div className="tk-upgrade-castle-bonus-detail">
                      粮草、铜钱、兵力等所有资源产出 +{bonusDiff}%
                    </div>
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
            aria-disabled={isConfirmDisabled}
            data-testid="building-upgrade-confirm"
          >
            {isMaxLevel ? '已满级' : upgrading ? '升级中...' : !info.canUpgrade ? '无法升级' : canAfford ? '▲ 升级' : '资源不足'}
          </button>
        </div>
    </SharedPanel>

    {/* Fix #3: 首次升级效果总结弹窗 */}
    {summaryData && (
      <SharedPanel
        title="🎉 升级成功"
        visible={true}
        onClose={() => setSummaryData(null)}
        width="380px"
        data-testid="upgrade-summary-modal"
      >
        <div className="tk-upgrade-summary" data-testid="upgrade-summary-content">
          <div className="tk-upgrade-summary-header">
            <span className="tk-upgrade-summary-icon">{summaryData.buildingIcon}</span>
            <span className="tk-upgrade-summary-name">{summaryData.buildingName}</span>
            <span className="tk-upgrade-summary-level">
              Lv.{summaryData.fromLevel} → Lv.{summaryData.toLevel}
            </span>
          </div>

          <div className="tk-upgrade-summary-title">升级效果</div>

          <div className="tk-upgrade-summary-changes">
            {summaryData.changes.map((change, idx) => (
              <div key={idx} className="tk-upgrade-summary-change-item" data-testid={`summary-change-${idx}`}>
                <span className="tk-upgrade-summary-change-label">{change.label}</span>
                <span className="tk-upgrade-summary-change-from">{change.from}</span>
                <span className="tk-upgrade-summary-change-arrow">→</span>
                <span className="tk-upgrade-summary-change-to">{change.to}</span>
                <span className="tk-upgrade-summary-change-diff">{change.diff}</span>
              </div>
            ))}
          </div>

          {buildingType === 'castle' && (
            <div className="tk-upgrade-summary-tip" data-testid="summary-castle-tip">
              💡 主城升级可提升全资源产出加成，是前期最重要的建筑！
            </div>
          )}

          <button
            className="tk-upgrade-btn tk-upgrade-btn--confirm"
            data-testid="upgrade-summary-close"
            onClick={() => setSummaryData(null)}
            style={{ width: '100%', marginTop: '16px' }}
          >
            知道了
          </button>
        </div>
      </SharedPanel>
    )}
    </>
  );
};

BuildingUpgradeModal.displayName = 'BuildingUpgradeModal';

export default BuildingUpgradeModal;
