/**
 * BattleResultModal — 战斗结算弹窗
 *
 * 功能：
 * - 胜利分支：星级评定动画、获得奖励列表、首通标记
 * - 失败分支：失败原因、推荐提升方向
 * - 确认按钮
 * - v3.0 P1：碎片掉落提示（首通必掉标记 + 重复概率标记）
 *
 * @module components/idle/panels/campaign/BattleResultModal
 */

import React, { useMemo } from 'react';
import { BattleOutcome, StarRating } from '@/games/three-kingdoms/engine';
import type { BattleResult } from '@/games/three-kingdoms/engine';
import type { Stage } from '@/games/three-kingdoms/engine';
import { STAGE_TYPE_LABELS, MAX_STARS } from '@/games/three-kingdoms/engine';
import SharedPanel from '../../components/SharedPanel';
import './BattleResultModal.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface BattleResultModalProps {
  /** 战斗结果 */
  result: BattleResult;
  /** 关卡信息 */
  stage: Stage;
  /** 确认回调 */
  onConfirm: () => void;
  /** 重新挑战回调（P1-3修复：失败时提供重试入口） */
  onRetry?: () => void;
  /** 是否首通（用于碎片掉落提示标记） */
  isFirstClear?: boolean;
  /** 武将名称查找表（generalId → 武将名），用于碎片掉落显示 */
  generalNames?: Record<string, string>;
}

// ─────────────────────────────────────────────
// 资源类型中文名
// ─────────────────────────────────────────────
const RESOURCE_LABELS: Record<string, string> = {
  grain: '粮草',
  gold: '铜钱',
  troops: '兵力',
  mandate: '天命',
};

// ─────────────────────────────────────────────
// 碎片掉落信息
// ─────────────────────────────────────────────

/** 碎片掉落条目 */
export interface FragmentDropItem {
  /** 武将ID */
  generalId: string;
  /** 武将名称 */
  generalName: string;
  /** 碎片数量 */
  count: number;
  /** 是否首通必掉 */
  isFirstClearGuaranteed: boolean;
  /** 掉落概率描述 */
  dropRateLabel: string;
}

/**
 * 构建碎片掉落展示数据
 *
 * @param fragmentRewards - 碎片奖励映射（generalId → count）
 * @param isFirstClear - 是否首通
 * @param generalNames - 武将名称查找表
 * @returns 碎片掉落展示条目列表
 */
export function buildFragmentDrops(
  fragmentRewards: Record<string, number>,
  isFirstClear: boolean,
  generalNames: Record<string, string> = {},
): FragmentDropItem[] {
  if (!fragmentRewards || Object.keys(fragmentRewards).length === 0) return [];

  return Object.entries(fragmentRewards).map(([generalId, count]) => ({
    generalId,
    generalName: generalNames[generalId] || generalId,
    count,
    isFirstClearGuaranteed: isFirstClear,
    dropRateLabel: isFirstClear ? '100%必掉' : '10%概率',
  }));
}

// ─────────────────────────────────────────────
// 失败推荐提升方向
// ─────────────────────────────────────────────
function getDefeatSuggestions(result: BattleResult, stage: Stage): string[] {
  const suggestions: string[] = [];
  const powerRatio = result.allyTotalDamage / Math.max(result.enemyTotalDamage, 1);

  if (powerRatio < 0.5) {
    suggestions.push('战力差距较大，建议升级建筑、招募更强武将');
  } else if (powerRatio < 0.8) {
    suggestions.push('战力接近，尝试调整编队站位或升级武将等级');
  }

  if (result.allySurvivors === 0) {
    suggestions.push('全军覆没，建议提升防御和生命值');
  }

  if (result.totalTurns <= 3) {
    suggestions.push('战斗结束过快，建议增加队伍生存能力');
  }

  suggestions.push(`推荐战力：${stage.recommendedPower.toLocaleString()}`);

  return suggestions;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const BattleResultModal: React.FC<BattleResultModalProps> = ({
  result,
  stage,
  onConfirm,
  onRetry,
  isFirstClear = false,
  generalNames = {},
}) => {
  const isVictory = result.outcome === BattleOutcome.VICTORY;
  const isDraw = result.outcome === BattleOutcome.DRAW;
  const stars = result.stars as number;

  // ── v3.0 P1：碎片掉落数据构建 ──
  const fragmentDrops = useMemo(() => {
    if (!isVictory || !result.fragmentRewards) return [];
    return buildFragmentDrops(result.fragmentRewards, isFirstClear, generalNames);
  }, [isVictory, result.fragmentRewards, isFirstClear, generalNames]);

  // ── 计算奖励预览 ──
  const rewards = useMemo(() => {
    if (!isVictory) return null;

    const items: { label: string; value: string; isBonus?: boolean }[] = [];

    // 基础资源奖励
    const baseRewards = stage.baseRewards;
    for (const [key, amount] of Object.entries(baseRewards)) {
      if (amount && amount > 0) {
        const multiplier = stars >= MAX_STARS ? stage.threeStarBonusMultiplier : 1.0;
        const finalAmount = Math.floor(amount * multiplier);
        items.push({
          label: RESOURCE_LABELS[key] || key,
          value: finalAmount.toLocaleString(),
        });
      }
    }

    // 基础经验
    if (stage.baseExp > 0) {
      const multiplier = stars >= MAX_STARS ? stage.threeStarBonusMultiplier : 1.0;
      items.push({
        label: '经验',
        value: Math.floor(stage.baseExp * multiplier).toLocaleString(),
      });
    }

    // 首通奖励
    const isFirstClear = !stage.firstClearRewards
      ? false
      : Object.values(stage.firstClearRewards).some((v) => v && v > 0);

    if (isFirstClear) {
      for (const [key, amount] of Object.entries(stage.firstClearRewards)) {
        if (amount && amount > 0) {
          items.push({
            label: `首通 ${RESOURCE_LABELS[key] || key}`,
            value: amount.toLocaleString(),
            isBonus: true,
          });
        }
      }
      if (stage.firstClearExp > 0) {
        items.push({
          label: '首通 经验',
          value: stage.firstClearExp.toLocaleString(),
          isBonus: true,
        });
      }
    }

    return items;
  }, [isVictory, stage, stars]);

  // ── 失败建议 ──
  const defeatSuggestions = useMemo(() => {
    if (isVictory) return [];
    return getDefeatSuggestions(result, stage);
  }, [isVictory, result, stage]);

  // ── 渲染星级 ──
  const renderStars = () => {
    const starElements: React.ReactNode[] = [];
    for (let i = 0; i < MAX_STARS; i++) {
      const filled = i < stars;
      starElements.push(
        <span
          key={i}
          className={`tk-brm-star ${filled ? 'tk-brm-star--filled' : 'tk-brm-star--empty'}`}
          style={{ animationDelay: `${i * 0.15}s` }}
        >
          {filled ? '★' : '☆'}
        </span>,
      );
    }
    return starElements;
  };

  // ── 渲染奖励项 ──
  const renderRewardItem = (
    item: { label: string; value: string; isBonus?: boolean },
    idx: number,
  ) => (
    <div
      key={idx}
      className={`tk-brm-reward-item ${item.isBonus ? 'tk-brm-reward-item--bonus' : ''}`}
    >
      <span className="tk-brm-reward-label">{item.label}</span>
      <span className="tk-brm-reward-value">+{item.value}</span>
    </div>
  );

  const resultTitle = isVictory ? '战斗胜利' : isDraw ? '平局' : '战斗失败';

  return (
    <SharedPanel title={resultTitle} onClose={onConfirm} visible={true} data-testid="battle-result-modal">
        {/* ── 结果标题 ── */}
        <div className="tk-brm-result-header">
          <div className={`tk-brm-result-icon ${isVictory ? 'tk-brm-result-icon--victory' : 'tk-brm-result-icon--defeat'}`}>
            {isVictory ? '🏆' : isDraw ? '⚖️' : '💀'}
          </div>
          <h2 className={`tk-brm-result-title ${isVictory ? 'tk-brm-result-title--victory' : 'tk-brm-result-title--defeat'}`}>
            {resultTitle}
          </h2>
          <div className="tk-brm-result-stage">
            {STAGE_TYPE_LABELS[stage.type]} · {stage.name}
          </div>
        </div>

        {/* ── 胜利：星级 + 奖励 ── */}
        {isVictory && (
          <>
            {/* 星级评定 */}
            <div className="tk-brm-stars-section">
              <div className="tk-brm-stars">{renderStars()}</div>
              <div className="tk-brm-stars-label">
                {stars >= MAX_STARS
                  ? '完美通关！'
                  : stars >= 2
                    ? '出色表现！'
                    : '勉强过关'}
              </div>
            </div>

            {/* 战斗统计 */}
            <div className="tk-brm-stats">
              <div className="tk-brm-stat">
                <span className="tk-brm-stat-label">回合数</span>
                <span className="tk-brm-stat-value">{result.totalTurns}</span>
              </div>
              <div className="tk-brm-stat">
                <span className="tk-brm-stat-label">存活人数</span>
                <span className="tk-brm-stat-value">{result.allySurvivors}</span>
              </div>
              <div className="tk-brm-stat">
                <span className="tk-brm-stat-label">最大伤害</span>
                <span className="tk-brm-stat-value">{result.maxSingleDamage.toLocaleString()}</span>
              </div>
              <div className="tk-brm-stat">
                <span className="tk-brm-stat-label">最大连击</span>
                <span className="tk-brm-stat-value">{result.maxCombo}</span>
              </div>
            </div>

            {/* 奖励列表 */}
            {rewards && rewards.length > 0 && (
              <div className="tk-brm-rewards-section">
                <div className="tk-brm-rewards-title">🎁 获得奖励</div>
                <div className="tk-brm-rewards-list">
                  {rewards.map(renderRewardItem)}
                </div>
              </div>
            )}

            {/* v3.0 P1：碎片掉落提示（增强版） */}
            {isVictory && fragmentDrops.length > 0 && (
              <div className="tk-brm-fragment-section" data-testid="fragment-drop-section">
                <div className="tk-brm-fragment-title">💎 武将碎片掉落</div>
                <div className="tk-brm-fragment-list">
                  {fragmentDrops.map((drop) => (
                    <div key={drop.generalId} className="tk-brm-fragment-item" data-testid={`fragment-drop-${drop.generalId}`}>
                      <div className="tk-brm-fragment-icon" data-testid={`fragment-icon-${drop.generalId}`}>
                        {drop.generalName.charAt(0)}
                      </div>
                      <div className="tk-brm-fragment-info">
                        <span className="tk-brm-fragment-name">{drop.generalName}</span>
                        <span className={`tk-brm-fragment-rate ${drop.isFirstClearGuaranteed ? 'tk-brm-fragment-rate--guaranteed' : 'tk-brm-fragment-rate--random'}`}>
                          {drop.dropRateLabel}
                        </span>
                      </div>
                      <div className="tk-brm-fragment-count" data-testid={`fragment-count-${drop.generalId}`}>
                        ×{drop.count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 扫荡摘要信息 */}
            {isVictory && result.summary && result.summary.includes('扫荡') && (
              <div className="tk-brm-sweep-summary">
                <span className="tk-brm-sweep-summary-text">{result.summary}</span>
              </div>
            )}
          </>
        )}

        {/* ── 失败：原因 + 建议 ── */}
        {!isVictory && (
          <div className="tk-brm-defeat-section">
            <div className="tk-brm-defeat-summary">
              {result.summary || '战斗失败'}
            </div>
            <div className="tk-brm-defeat-stats">
              <div className="tk-brm-stat">
                <span className="tk-brm-stat-label">我方伤害</span>
                <span className="tk-brm-stat-value tk-brm-stat-value--dim">
                  {result.allyTotalDamage.toLocaleString()}
                </span>
              </div>
              <div className="tk-brm-stat">
                <span className="tk-brm-stat-label">敌方伤害</span>
                <span className="tk-brm-stat-value tk-brm-stat-value--dim">
                  {result.enemyTotalDamage.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="tk-brm-defeat-suggestions">
              <div className="tk-brm-defeat-suggestions-title">💡 提升建议</div>
              <ul className="tk-brm-defeat-suggestions-list">
                {defeatSuggestions.map((s, i) => (
                  <li key={i} className="tk-brm-defeat-suggestion">{s}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── 确认按钮 ── */}
        <div className="tk-brm-actions">
          {/* P1-3 修复：失败时显示重新挑战按钮 */}
          {!isVictory && onRetry && (
            <button
              className="tk-brm-confirm-btn tk-brm-confirm-btn--retry"
              onClick={onRetry}
              data-testid="battle-result-retry"
            >
              🔄 重新挑战
            </button>
          )}
          <button
            className={`tk-brm-confirm-btn ${isVictory ? 'tk-brm-confirm-btn--victory' : 'tk-brm-confirm-btn--defeat'}`}
            onClick={onConfirm}
            data-testid="battle-result-confirm"
          >
            {isVictory ? '确认' : '返回'}
          </button>
        </div>
    </SharedPanel>
  );
};

BattleResultModal.displayName = 'BattleResultModal';

export default BattleResultModal;
