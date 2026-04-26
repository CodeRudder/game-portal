/**
 * HeroAwakeningSection — 武将觉醒区域
 *
 * 从 HeroDetailSections.tsx 拆分而来，解决单文件超过500行的问题。
 *
 * 功能：
 * - 觉醒条件检查列表（等级/星级/突破/品质）
 * - 觉醒资源消耗展示
 * - 觉醒效果预览 + 终极技能预览
 * - 觉醒材料获取途径提示
 * - 觉醒按钮 + 二次确认弹窗
 * - 已觉醒状态展示
 *
 * @module components/idle/panels/hero/HeroAwakeningSection
 */

import React, { useMemo, useCallback, useState } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { AwakeningEligibility } from '@/games/three-kingdoms/engine/hero/AwakeningSystem';
import { Toast } from '@/components/idle/common/Toast';
import { formatNumber } from '@/components/idle/utils/formatNumber';
import { AWAKENING_COST, AWAKENING_EFFECT_TEXT } from '@/games/three-kingdoms/engine/hero/awakening-config';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface HeroAwakeningSectionProps {
  /** 引擎实例 */
  engine: ThreeKingdomsEngine;
  /** 武将ID */
  generalId: string;
  /** 觉醒是否可用（条件+资源都满足） */
  isAvailable: boolean;
  /** 觉醒条件检查结果 */
  eligibility: AwakeningEligibility;
  /** 觉醒资源数据 */
  resources: Record<string, number> | null;
  /** 觉醒系统实例 */
  awakeningSys: any;
  /** 是否已觉醒 */
  isAwakened: boolean;
  /** 觉醒后等级上限 */
  awakenedLevelCap: number;
  /** 觉醒成功回调 */
  onAwakenComplete?: () => void;
}

// ─────────────────────────────────────────────
// 子组件：觉醒条件项
// ─────────────────────────────────────────────

interface ConditionItemProps {
  label: string;
  detail: { current: number | string; required: number | string; met: boolean };
}

const ConditionItem: React.FC<ConditionItemProps> = React.memo(({ label, detail }) => (
  <div className="tk-hero-detail-awakening-condition">
    <span className="tk-hero-detail-awakening-condition-label">{label}</span>
    <span className={`tk-hero-detail-awakening-condition-value ${detail.met ? 'tk-hero-detail-awakening-met' : 'tk-hero-detail-awakening-unmet'}`}>
      {typeof detail.current === 'string'
        ? `${detail.current} (需${detail.required})`
        : `${detail.current}/${detail.required}`}
    </span>
    <span>{detail.met ? '✅' : '❌'}</span>
  </div>
));
ConditionItem.displayName = 'ConditionItem';

// ─────────────────────────────────────────────
// 子组件：觉醒资源消耗项
// ─────────────────────────────────────────────

interface CostItemProps {
  icon: string;
  label: string;
  owned: number;
  required: number;
}

const CostItem: React.FC<CostItemProps> = React.memo(({ icon, label, owned, required }) => {
  const sufficient = owned >= required;
  return (
    <div className="tk-hero-detail-awakening-cost-item">
      <span>{icon} {label}</span>
      <span className={sufficient ? 'tk-hero-detail-awakening-met' : 'tk-hero-detail-awakening-unmet'}>
        {formatNumber(owned)}/{formatNumber(required)}
      </span>
    </div>
  );
});
CostItem.displayName = 'CostItem';

// ─────────────────────────────────────────────
// 子组件：材料获取途径
// ─────────────────────────────────────────────

/** 材料获取途径配置 */
const MATERIAL_SOURCES: readonly { icon: string; label: string; sources: string }[] = [
  { icon: '🪙', label: '铜钱', sources: '建筑产出、日常任务、战役扫荡' },
  { icon: '🔮', label: '突破石', sources: '精英副本、商店兑换、联盟商店' },
  { icon: '📖', label: '技能书', sources: '科技研究奖励、活动兑换' },
  { icon: '💎', label: '觉醒石', sources: '觉醒副本、赛季排行奖励、限时活动' },
  { icon: '💠', label: '武将碎片', sources: '招募重复武将、碎片商店、扫荡关卡' },
] as const;

const MaterialSources: React.FC = React.memo(() => (
  <div className="tk-hero-detail-awakening-sources" data-testid="awakening-sources">
    <div className="tk-hero-detail-awakening-sources-title">📍 材料获取途径</div>
    {MATERIAL_SOURCES.map(({ icon, label, sources }) => (
      <div key={label} className="tk-hero-detail-awakening-source-item">
        <span>{icon} {label}</span>
        <span>{sources}</span>
      </div>
    ))}
  </div>
));
MaterialSources.displayName = 'MaterialSources';

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * HeroAwakeningSection — 觉醒区域
 *
 * 包含觉醒条件、资源消耗、效果预览、确认弹窗和已觉醒状态。
 */
export const HeroAwakeningSection: React.FC<HeroAwakeningSectionProps> = ({
  engine,
  generalId,
  eligibility,
  resources,
  awakeningSys,
  isAwakened,
  awakenedLevelCap,
  onAwakenComplete,
}) => {
  // 觉醒资源是否充足
  const resourcesSufficient = useMemo(() => {
    if (!resources) return false;
    return (
      resources.copper >= AWAKENING_COST.copper
      && resources.breakthroughStones >= AWAKENING_COST.breakthroughStones
      && resources.skillBooks >= AWAKENING_COST.skillBooks
      && resources.awakeningStones >= AWAKENING_COST.awakeningStones
      && resources.fragments >= AWAKENING_COST.fragments
    );
  }, [resources]);

  const canAwaken = eligibility.eligible && resourcesSufficient;

  // 觉醒二次确认弹窗
  const [showAwakenConfirm, setShowAwakenConfirm] = useState(false);
  // 关闭动画状态（弹窗关闭时先播放动画再移除DOM）
  const [awakenClosing, setAwakenClosing] = useState(false);

  // 缓存觉醒终极技能预览数据，避免同一渲染周期内重复调用
  const skillPreview = useMemo(
    () => awakeningSys?.getAwakeningSkillPreview(generalId) ?? null,
    [awakeningSys, generalId],
  );

  /** 关闭觉醒确认弹窗（带关闭动画） */
  const closeAwakenConfirm = useCallback(() => {
    setAwakenClosing(true);
    setTimeout(() => {
      setShowAwakenConfirm(false);
      setAwakenClosing(false);
    }, 200);
  }, []);

  // 觉醒操作
  const handleAwaken = useCallback(() => {
    if (!awakeningSys || !canAwaken) return;
    const result = awakeningSys.awaken(generalId);
    if (result.success) {
      Toast.success(`✨ 觉醒成功！${AWAKENING_EFFECT_TEXT}`);
      onAwakenComplete?.();
    } else {
      Toast.danger(result.reason ?? '觉醒失败');
    }
    setShowAwakenConfirm(false);
  }, [awakeningSys, canAwaken, generalId, onAwakenComplete]);

  const handleAwakenClick = useCallback(() => {
    if (!canAwaken) return;
    setShowAwakenConfirm(true);
  }, [canAwaken]);

  // 未满足条件数量
  const unmetCount = Object.values(eligibility.details).filter(
    (d) => typeof d === 'object' && d !== null && 'met' in d && !d.met,
  ).length;

  return (
    <>
      {/* ── 觉醒按钮区域 ── */}
      {!isAwakened && eligibility && (
        <div className="tk-hero-detail-awakening" data-testid="hero-detail-awakening">
          <div className="tk-hero-detail-awakening-header">
            <span className="tk-hero-detail-awakening-title">🌟 武将觉醒</span>
          </div>

          {/* 觉醒条件检查列表 */}
          <div className="tk-hero-detail-awakening-conditions">
            {Object.entries({
              '等级': eligibility.details.level,
              '星级': eligibility.details.stars,
              '突破': eligibility.details.breakthrough,
              '品质': eligibility.details.quality,
            }).map(([label, detail]) => (
              <ConditionItem key={label} label={label} detail={detail as any} />
            ))}
          </div>

          {/* 觉醒资源消耗 */}
          {eligibility.eligible && resources && (
            <div className="tk-hero-detail-awakening-costs">
              <div className="tk-hero-detail-awakening-cost-title">觉醒消耗</div>
              {([
                { icon: '🪙', label: '铜钱', key: 'copper' as const },
                { icon: '🔮', label: '突破石', key: 'breakthroughStones' as const },
                { icon: '📖', label: '技能书', key: 'skillBooks' as const },
                { icon: '💎', label: '觉醒石', key: 'awakeningStones' as const },
                { icon: '💠', label: '碎片', key: 'fragments' as const },
              ]).map(({ icon, label, key }) => (
                <CostItem
                  key={key}
                  icon={icon}
                  label={label}
                  owned={resources[key]}
                  required={AWAKENING_COST[key]}
                />
              ))}
            </div>
          )}

          {/* 觉醒效果预览 */}
          <div className="tk-hero-detail-awakening-effect">
            <span>觉醒效果：{AWAKENING_EFFECT_TEXT}</span>
          </div>

          {/* 觉醒终极技能预览 */}
          {skillPreview && (
            <div className="tk-hero-detail-awakening-skill-preview" data-testid="awakening-skill-preview">
              <div className="tk-hero-detail-awakening-skill-preview-title">⚔️ 终极技能</div>
              <div className="tk-hero-detail-awakening-skill-preview-name">
                {skillPreview.name}
              </div>
              <div className="tk-hero-detail-awakening-skill-preview-desc">
                {skillPreview.description}
              </div>
            </div>
          )}

          {/* 材料获取途径提示 */}
          <MaterialSources />

          {/* 觉醒按钮 */}
          <div className="tk-hero-detail-awakening-btn-wrapper">
            <button
              className={`tk-hero-detail-awakening-btn ${canAwaken ? 'tk-hero-detail-awakening-btn--active' : ''}`}
              disabled={!canAwaken}
              onClick={handleAwakenClick}
              data-testid="awakening-btn"
              aria-label={canAwaken ? '立即觉醒' : eligibility.eligible ? '资源不足，无法觉醒' : '条件未满足，无法觉醒'}
            >
              {canAwaken ? '🌟 立即觉醒' : eligibility.eligible ? '资源不足' : '条件未满足'}
            </button>
            {!canAwaken && eligibility && (
              <div className="tk-hero-detail-awakening-btn-hint" data-testid="awakening-btn-hint">
                {!eligibility.eligible
                  ? `还需满足 ${unmetCount} 项条件`
                  : '收集足够材料后即可觉醒'}
              </div>
            )}
          </div>

          {/* 觉醒二次确认弹窗 */}
          {showAwakenConfirm && (
            <div
              className={`tk-hero-detail-awakening-confirm-overlay${awakenClosing ? ' tk-hero-detail-awakening-confirm-overlay--closing' : ''}`}
              data-testid="awakening-confirm-overlay"
              onClick={closeAwakenConfirm}
            >
              <div
                className={`tk-hero-detail-awakening-confirm-dialog${awakenClosing ? ' tk-hero-detail-awakening-confirm-dialog--closing' : ''}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="tk-hero-detail-awakening-confirm-title">⚠️ 确认觉醒</div>
                <div className="tk-hero-detail-awakening-confirm-desc">
                  觉醒后将消耗大量资源，且操作不可撤销。确认要觉醒该武将吗？
                </div>
                <div className="tk-hero-detail-awakening-confirm-effect">
                  觉醒效果：{AWAKENING_EFFECT_TEXT}
                </div>
                <div className="tk-hero-detail-awakening-confirm-actions">
                  <button
                    className="tk-hero-detail-awakening-confirm-cancel"
                    data-testid="awakening-confirm-cancel"
                    onClick={closeAwakenConfirm}
                  >
                    取消
                  </button>
                  <button
                    className="tk-hero-detail-awakening-confirm-ok"
                    data-testid="awakening-confirm-ok"
                    onClick={handleAwaken}
                  >
                    确认觉醒
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 已觉醒状态展示 */}
      {isAwakened && (
        <div className="tk-hero-detail-awakening-awakened" data-testid="awakening-status">
          <span>🌟 已觉醒 — {AWAKENING_EFFECT_TEXT}</span>
          {skillPreview && (
            <div className="tk-hero-detail-awakening-awakened-skill" data-testid="awakening-awakened-skill">
              <span className="tk-hero-detail-awakening-awakened-skill-label">⚔️ 终极技能：</span>
              <span className="tk-hero-detail-awakening-awakened-skill-name">
                {skillPreview.name}
              </span>
              <span className="tk-hero-detail-awakening-awakened-skill-desc">
                — {skillPreview.description}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
};

HeroAwakeningSection.displayName = 'HeroAwakeningSection';
export default HeroAwakeningSection;
