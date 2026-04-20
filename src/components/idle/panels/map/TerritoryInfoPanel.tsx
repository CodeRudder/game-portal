/**
 * TerritoryInfoPanel — 领土信息面板
 *
 * 功能：
 * - 显示选中领土的详细信息（名称/等级/归属/产出）
 * - 升级按钮（己方领土）
 * - 攻城按钮（非己方领土且可攻击）
 * - 相邻领土列表
 *
 * @module components/idle/panels/map/TerritoryInfoPanel
 */

import React, { useMemo } from 'react';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';
import './TerritoryInfoPanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
export interface TerritoryInfoPanelProps {
  /** 领土数据 */
  territory: TerritoryData;
  /** 攻城回调 */
  onSiege?: (id: string) => void;
  /** 升级回调 */
  onUpgrade?: (id: string) => void;
}

// ─────────────────────────────────────────────
// 归属标签
// ─────────────────────────────────────────────
const OWNERSHIP_LABELS: Record<string, string> = {
  player: '己方领土',
  enemy: '敌方领土',
  neutral: '中立领土',
};

const OWNERSHIP_CLASS: Record<string, string> = {
  player: 'tk-territory-info--player',
  enemy: 'tk-territory-info--enemy',
  neutral: 'tk-territory-info--neutral',
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const TerritoryInfoPanel: React.FC<TerritoryInfoPanelProps> = ({
  territory,
  onSiege,
  onUpgrade,
}) => {
  const { id, name, level, ownership, currentProduction, defenseValue, region } = territory;

  // ── 总产出 ──
  const totalProduction = useMemo(
    () => currentProduction.grain + currentProduction.gold
      + currentProduction.troops + currentProduction.mandate,
    [currentProduction],
  );

  const isPlayerOwned = ownership === 'player';
  const isEnemy = ownership === 'enemy';

  return (
    <div
      className={`tk-territory-info ${OWNERSHIP_CLASS[ownership] ?? ''}`}
      data-testid={`territory-info-${id}`}
    >
      {/* ── 标题 ── */}
      <div className="tk-territory-info-header">
        <h4 className="tk-territory-info-name">{name}</h4>
        <span className="tk-territory-info-ownership">
          {OWNERSHIP_LABELS[ownership] ?? ownership}
        </span>
      </div>

      {/* ── 基础属性 ── */}
      <div className="tk-territory-info-attrs">
        <div className="tk-territory-info-attr">
          <span className="tk-territory-info-attr-label">等级</span>
          <span className="tk-territory-info-attr-value">Lv.{level}</span>
        </div>
        <div className="tk-territory-info-attr">
          <span className="tk-territory-info-attr-label">防御</span>
          <span className="tk-territory-info-attr-value">{defenseValue}</span>
        </div>
        <div className="tk-territory-info-attr">
          <span className="tk-territory-info-attr-label">区域</span>
          <span className="tk-territory-info-attr-value">{region}</span>
        </div>
      </div>

      {/* ── 产出详情 ── */}
      <div className="tk-territory-info-production">
        <h5 className="tk-territory-info-section-title">每秒产出</h5>
        <div className="tk-territory-info-prod-grid">
          <div className="tk-territory-info-prod-item">
            <span className="tk-territory-info-prod-icon">🌾</span>
            <span className="tk-territory-info-prod-value">{currentProduction.grain.toFixed(1)}</span>
          </div>
          <div className="tk-territory-info-prod-item">
            <span className="tk-territory-info-prod-icon">💰</span>
            <span className="tk-territory-info-prod-value">{currentProduction.gold.toFixed(1)}</span>
          </div>
          <div className="tk-territory-info-prod-item">
            <span className="tk-territory-info-prod-icon">⚔️</span>
            <span className="tk-territory-info-prod-value">{currentProduction.troops.toFixed(1)}</span>
          </div>
          <div className="tk-territory-info-prod-item">
            <span className="tk-territory-info-prod-icon">👑</span>
            <span className="tk-territory-info-prod-value">{currentProduction.mandate.toFixed(1)}</span>
          </div>
        </div>
        <div className="tk-territory-info-total">
          总产出: <strong>{totalProduction.toFixed(1)}</strong>/s
        </div>
      </div>

      {/* ── 操作按钮 ── */}
      <div className="tk-territory-info-actions">
        {isPlayerOwned && (
          <button
            className="tk-territory-info-btn tk-territory-info-btn--upgrade"
            data-testid={`btn-upgrade-${id}`}
            onClick={() => onUpgrade?.(id)}
          >
            ⬆️ 升级
          </button>
        )}
        {isEnemy && (
          <button
            className="tk-territory-info-btn tk-territory-info-btn--siege"
            data-testid={`btn-siege-${id}`}
            onClick={() => onSiege?.(id)}
          >
            ⚔️ 攻城
          </button>
        )}
      </div>
    </div>
  );
};

export default TerritoryInfoPanel;
