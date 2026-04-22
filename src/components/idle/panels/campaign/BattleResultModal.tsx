/**
 * BattleResultModal — 战斗结算弹窗
 *
 * 功能：
 * - 胜利分支：星级评定动画、获得奖励列表、首通标记
 * - 失败分支：失败原因、推荐提升方向
 * - 确认按钮
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
}) => {
  const isVictory = result.outcome === BattleOutcome.VICTORY;
  const isDraw = result.outcome === BattleOutcome.DRAW;
  const stars = result.stars as number;

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
