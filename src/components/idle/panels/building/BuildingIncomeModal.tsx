/**
 * 三国霸业 v1.0 — 资源收支详情弹窗组件
 *
 * 从 BuildingPanel 中提取的独立组件，负责展示：
 * - 每秒产出汇总（按资源类型）
 * - 净收入（正/负/零）
 * - 各建筑产出明细
 *
 * 使用 SharedPanel 提供统一的 overlay / header / close / ESC 结构。
 *
 * @module components/building/BuildingIncomeModal
 */

import React from 'react';
import type { BuildingType, BuildingState, ProductionRate } from '@/games/three-kingdoms/engine';
import {
  BUILDING_TYPES,
  BUILDING_LABELS,
  BUILDING_ICONS,
  RESOURCE_LABELS,
} from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import SharedPanel from '../../components/SharedPanel';
import './BuildingIncomeModal.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface BuildingIncomeModalProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 引擎实例（用于查询建筑产出明细） */
  engine: ThreeKingdomsEngine;
  /** 建筑状态集合 */
  buildings: Record<BuildingType, BuildingState>;
  /** 当前产出速率 */
  rates: ProductionRate;
}

// ─────────────────────────────────────────────
// 资源类型列表（遍历用）
// ─────────────────────────────────────────────
const RESOURCE_TYPES = ['grain', 'gold', 'troops', 'mandate'] as const;

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const BuildingIncomeModal: React.FC<BuildingIncomeModalProps> = ({
  isOpen,
  onClose,
  engine,
  buildings,
  rates,
}) => {
  return (
    <SharedPanel
      title="资源收支详情"
      icon="📊"
      visible={isOpen}
      onClose={onClose}
      width="480px"
    >
      {/* 每秒产出 */}
      <div className="tk-income-section" data-testid="building-income-section">
        <h4 className="tk-income-section-title">📈 每秒产出（建筑汇总）</h4>
        {RESOURCE_TYPES.map((resType) => {
          const rate = rates[resType];
          if (rate <= 0) return null;
          return (
            <div key={resType} className="tk-income-row" data-testid={`building-income-rate-${resType}`}>
              <span>{RESOURCE_LABELS[resType]}</span>
              <span className="tk-income-rate">+{rate.toFixed(2)}/秒</span>
            </div>
          );
        })}
      </div>

      {/* 净收入 */}
      <div className="tk-income-net-box" data-testid="building-income-net">
        <h4 className="tk-income-section-title">💰 净收入</h4>
        {RESOURCE_TYPES.map((resType) => {
          const rate = rates[resType];
          const isPositive = rate > 0;
          return (
            <div key={resType} className="tk-income-row">
              <span>{RESOURCE_LABELS[resType]}</span>
              <span className={
                isPositive
                  ? 'tk-income-rate'
                  : rate < 0
                    ? 'tk-income-rate--negative'
                    : 'tk-income-rate--zero'
              }>
                {isPositive ? '+' : ''}{rate.toFixed(2)}/秒
              </span>
            </div>
          );
        })}
      </div>

      {/* 各建筑产出明细 */}
      <div className="tk-income-section" data-testid="building-income-details">
        <h4 className="tk-income-section-title">🏗️ 建筑产出明细</h4>
        {BUILDING_TYPES.map((type) => {
          const state = buildings[type];
          if (!state || state.level <= 0 || type === 'castle') return null;
          const prod = engine.building?.getProduction?.(type) ?? 0;
          if (prod <= 0) return null;
          return (
            <div key={type} className="tk-income-row">
              <span>{BUILDING_ICONS[type]} {BUILDING_LABELS[type]} Lv.{state.level}</span>
              <span className="tk-income-rate">+{prod.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    </SharedPanel>
  );
};

BuildingIncomeModal.displayName = 'BuildingIncomeModal';

export default BuildingIncomeModal;
