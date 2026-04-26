/**
 * HeroUpgradePanel — 武将升级面板
 *
 * 从 HeroDetailModal 中拆出的独立升级面板组件。
 * 功能：
 *   - 当前等级和经验条
 *   - 目标等级选择（+1 / +5 / +10）
 *   - 升级消耗资源展示（ResourceCost 原子组件）
 *   - 升级确认按钮
 *   - 升级后属性变化预览（AttributeBar 原子组件）
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { GeneralData } from '@/games/three-kingdoms/engine';
import { HERO_MAX_LEVEL } from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { EnhancePreview } from '@/games/three-kingdoms/engine';
import { Toast } from '@/components/idle/common/Toast';
import { formatNumber } from '@/components/idle/utils/formatNumber';
import { AttributeBar, ResourceCost } from './atoms';
import type { ResourceCostItem } from './atoms';
import './HeroUpgradePanel.css';

// ─────────────────────────────────────────────
// Props 接口
// ─────────────────────────────────────────────
export interface HeroUpgradePanelProps {
  /** 武将数据 */
  general: GeneralData;
  /** 引擎实例 */
  engine: ThreeKingdomsEngine;
  /** 升级完成回调 */
  onUpgradeComplete?: (general: GeneralData) => void;
  /** 关闭回调 */
  onClose?: () => void;
}

// ─────────────────────────────────────────────
// 属性条标签映射
// ─────────────────────────────────────────────
const STAT_LABELS: Record<string, string> = {
  attack: '攻击',
  defense: '防御',
  intelligence: '智力',
  speed: '速度',
};

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────
function formatNum(n: number): string {
  return formatNumber(n);
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const HeroUpgradePanel: React.FC<HeroUpgradePanelProps> = ({
  general,
  engine,
  onUpgradeComplete,
  onClose,
}) => {
  const levelSystem = engine.getLevelSystem();
  const heroSystem = engine.getHeroSystem();

  // 目标等级（默认 +1）
  const [targetLevel, setTargetLevel] = useState(general.level + 1);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // 经验进度
  const expProgress = useMemo(
    () => levelSystem.getExpProgress(general.id),
    [levelSystem, general.id],
  );

  // 升级预览
  const enhancePreview: EnhancePreview | null = useMemo(() => {
    if (targetLevel <= general.level) return null;
    try {
      return engine.getEnhancePreview(general.id, targetLevel);
    } catch {
      return null;
    }
  }, [engine, general.id, targetLevel, general.level]);

  // 目标等级选项
  const levelOptions = useMemo(() => {
    const opts: { label: string; value: number }[] = [];
    const increments = [1, 5, 10];
    for (const inc of increments) {
      const target = Math.min(general.level + inc, HERO_MAX_LEVEL);
      if (target > general.level && !opts.some((o) => o.value === target)) {
        opts.push({ label: `+${inc}`, value: target });
      }
    }
    return opts;
  }, [general.level]);

  // 资源消耗列表（用于 ResourceCost 原子组件）
  const resourceItems: ResourceCostItem[] = useMemo(() => {
    if (!enhancePreview) return [];
    const goldCurrent = engine.getResourceAmount('gold');
    const expCurrent = engine.getResourceAmount('grain');
    return [
      {
        type: 'copper',
        name: '铜钱',
        required: enhancePreview.totalGold,
        current: goldCurrent,
      },
      {
        type: 'exp',
        name: '经验',
        required: enhancePreview.totalExp,
        current: expCurrent,
      },
    ];
  }, [enhancePreview, engine]);

  // 属性变化预览列表
  const attributeChanges = useMemo(() => {
    if (!enhancePreview) return [];
    const { before, after } = enhancePreview.statsDiff;
    return (['attack', 'defense', 'intelligence', 'speed'] as const).map((key) => ({
      key,
      label: STAT_LABELS[key],
      before: before[key],
      after: after[key],
      change: after[key] - before[key],
    }));
  }, [enhancePreview]);

  // 选择目标等级
  const handleSelectTarget = useCallback((level: number) => {
    setTargetLevel(level);
  }, []);

  // 执行升级
  const handleEnhance = useCallback(() => {
    if (targetLevel <= general.level) return;
    setIsEnhancing(true);
    try {
      const result = engine.enhanceHero(general.id, targetLevel);
      if (result) {
        Toast.success(
          `${general.name} 升级至 Lv.${result.levelsGained > 1 ? targetLevel : general.level + 1}，战力 +${result.levelsGained}`,
        );
        onUpgradeComplete?.(general);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '升级失败';
      Toast.danger(message);
    } finally {
      setIsEnhancing(false);
    }
  }, [engine, general, targetLevel, onUpgradeComplete]);

  return (
    <div className="tk-upgrade-panel" data-testid="hero-upgrade-panel">
      {/* 标题栏 */}
      <div className="tk-upgrade-panel__header">
        <h4 className="tk-upgrade-panel__title">强化升级</h4>
        {onClose && (
          <button
            className="tk-upgrade-panel__close"
            onClick={onClose}
            aria-label="关闭升级面板"
          >
            ✕
          </button>
        )}
      </div>

      {/* 当前等级 + 经验条 */}
      <div className="tk-upgrade-panel__level-section">
        <div className="tk-upgrade-panel__level-badge">
          当前等级: <strong>Lv.{general.level}</strong>
        </div>
        {expProgress && expProgress.required > 0 && (
          <div className="tk-upgrade-panel__exp-section">
            <div className="tk-upgrade-panel__exp-label">
              经验 {formatNum(expProgress.current)}/{formatNum(expProgress.required)}
            </div>
            <div className="tk-upgrade-panel__exp-bar">
              <div
                className="tk-upgrade-panel__exp-fill"
                style={{ width: `${expProgress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 目标等级选择 */}
      <div className="tk-upgrade-panel__target-section">
        <span className="tk-upgrade-panel__target-label">
          目标等级: <strong>Lv.{targetLevel}</strong>
        </span>
        <div className="tk-upgrade-panel__target-options">
          {levelOptions.map((opt) => (
            <button
              key={opt.value}
              className={`tk-upgrade-panel__target-btn ${
                targetLevel === opt.value ? 'tk-upgrade-panel__target-btn--active' : ''
              }`}
              onClick={() => handleSelectTarget(opt.value)}
              data-testid={`upgrade-target-${opt.label}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 升级消耗资源展示 */}
      {resourceItems.length > 0 && (
        <div className="tk-upgrade-panel__cost-section">
          <h5 className="tk-upgrade-panel__section-title">消耗资源</h5>
          <ResourceCost items={resourceItems} layout="horizontal" />
        </div>
      )}

      {/* 升级后属性变化预览 */}
      {attributeChanges.length > 0 && (
        <div className="tk-upgrade-panel__preview-section">
          <h5 className="tk-upgrade-panel__section-title">属性变化预览</h5>
          {attributeChanges.map((attr) => (
            <AttributeBar
              key={attr.key}
              name={attr.label}
              value={attr.after}
              maxValue={Math.max(attr.after, attr.before) * 1.2}
              change={attr.change}
            />
          ))}
          {/* 战力变化 */}
          {enhancePreview && (
            <div className="tk-upgrade-panel__power-diff">
              战力: {formatNum(enhancePreview.powerBefore)} → {formatNum(enhancePreview.powerAfter)}
              <span className="tk-upgrade-panel__power-gain">
                (+{formatNum(enhancePreview.powerAfter - enhancePreview.powerBefore)})
              </span>
            </div>
          )}
        </div>
      )}

      {/* 升级确认按钮 */}
      <button
        className="tk-upgrade-panel__enhance-btn"
        data-testid="upgrade-panel-enhance-btn"
        disabled={!enhancePreview?.affordable || isEnhancing || targetLevel <= general.level}
        onClick={handleEnhance}
      >
        {isEnhancing
          ? '升级中...'
          : enhancePreview?.affordable
            ? `升级至 Lv.${targetLevel}`
            : '资源不足'}
      </button>
    </div>
  );
};

HeroUpgradePanel.displayName = 'HeroUpgradePanel';

export default HeroUpgradePanel;
