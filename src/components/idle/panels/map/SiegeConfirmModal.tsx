/**
 * SiegeConfirmModal — 攻城确认弹窗
 *
 * 功能：
 * - 显示目标领土信息（名称/等级/防御值/归属）
 * - 显示攻城条件校验结果（相邻/兵力/粮草）
 * - 显示预估消耗（兵力/粮草）
 * - 显示预估胜率
 * - 确认/取消按钮
 *
 * @module components/idle/panels/map/SiegeConfirmModal
 */

import React, { useMemo, useState, useEffect } from 'react';
import Modal from '../../common/Modal';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';
import './SiegeConfirmModal.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
export interface SiegeConfirmModalProps {
  /** 是否显示 */
  visible: boolean;
  /** 目标领土 */
  target: TerritoryData | null;
  /** 攻城消耗 */
  cost: { troops: number; grain: number } | null;
  /** 攻城条件校验结果 */
  conditionResult: {
    canSiege: boolean;
    errorCode?: string;
    errorMessage?: string;
  } | null;
  /** 当前可用兵力 */
  availableTroops: number;
  /** 当前可用粮草 */
  availableGrain: number;
  /** 今日剩余攻城次数（null表示不限制） */
  dailySiegesRemaining?: number | null;
  /** 攻城冷却剩余毫秒数（0表示无冷却） */
  cooldownRemainingMs?: number;
  /** 确认攻城 */
  onConfirm: () => void;
  /** 取消 */
  onCancel: () => void;
}

// ─────────────────────────────────────────────
// 条件检查项
// ─────────────────────────────────────────────
interface ConditionItem {
  label: string;
  passed: boolean;
  detail: string;
}

function getConditions(
  conditionResult: SiegeConfirmModalProps['conditionResult'],
  cost: SiegeConfirmModalProps['cost'],
  availableTroops: number,
  availableGrain: number,
  dailySiegesRemaining?: number | null,
  cooldownRemainingMs?: number,
): ConditionItem[] {
  const items: ConditionItem[] = [];

  // 每日攻城次数检查
  const hasDailyLimit = dailySiegesRemaining != null;
  const hasDailyLeft = !hasDailyLimit || dailySiegesRemaining > 0;
  if (hasDailyLimit) {
    items.push({
      label: '今日攻城次数',
      passed: hasDailyLeft,
      detail: hasDailyLeft ? `剩余 ${dailySiegesRemaining} 次` : '今日次数已用完',
    });
  }

  // 攻城冷却检查
  const hasCooldown = (cooldownRemainingMs ?? 0) > 0;
  if (hasCooldown) {
    items.push({
      label: '攻城冷却',
      passed: false,
      detail: '冷却中，请稍后再试',
    });
  }

  // 相邻检查
  const isAdjacent = conditionResult?.errorCode !== 'NOT_ADJACENT';
  items.push({
    label: '领土相邻',
    passed: isAdjacent,
    detail: isAdjacent ? '与己方领土相邻' : '不与己方领土相邻',
  });

  // 兵力检查
  const hasTroops = cost
    ? availableTroops >= cost.troops
    : conditionResult?.errorCode !== 'INSUFFICIENT_TROOPS';
  items.push({
    label: '兵力充足',
    passed: hasTroops,
    detail: cost
      ? `${hasTroops ? '✓' : '✗'} 需要 ${cost.troops}，可用 ${availableTroops}`
      : '兵力检查中...',
  });

  // 粮草检查
  const hasGrain = cost
    ? availableGrain >= cost.grain
    : conditionResult?.errorCode !== 'INSUFFICIENT_GRAIN';
  items.push({
    label: '粮草充足',
    passed: hasGrain,
    detail: cost
      ? `${hasGrain ? '✓' : '✗'} 需要 ${cost.grain}，可用 ${availableGrain}`
      : '粮草检查中...',
  });

  return items;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const SiegeConfirmModal: React.FC<SiegeConfirmModalProps> = ({
  visible,
  target,
  cost,
  conditionResult,
  availableTroops,
  availableGrain,
  dailySiegesRemaining,
  cooldownRemainingMs = 0,
  onConfirm,
  onCancel,
}) => {
  // ── 攻城冷却倒计时 ──
  const [cooldownText, setCooldownText] = useState('');
  useEffect(() => {
    if (!visible || cooldownRemainingMs <= 0) {
      setCooldownText('');
      return;
    }
    // 记录组件挂载时的时间戳，作为冷却计算的基准点
    const startTimestamp = Date.now();
    const updateCooldown = () => {
      const elapsed = Date.now() - startTimestamp;
      const remaining = Math.max(0, cooldownRemainingMs - elapsed);
      if (remaining <= 0) {
        setCooldownText('');
        return;
      }
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setCooldownText(`⏳ 冷却中: ${hours}时${minutes}分${seconds}秒`);
    };
    updateCooldown();
    const timer = setInterval(updateCooldown, 1000);
    return () => clearInterval(timer);
  }, [visible, cooldownRemainingMs]);

  // ── 条件检查列表 ──
  const conditions = useMemo(
    () => getConditions(conditionResult, cost, availableTroops, availableGrain, dailySiegesRemaining, cooldownRemainingMs),
    [conditionResult, cost, availableTroops, availableGrain, dailySiegesRemaining, cooldownRemainingMs],
  );

  const allPassed = conditions.every((c) => c.passed);

  if (!target) return null;

  return (
    <Modal
      visible={visible}
      type={allPassed ? 'warning' : 'danger'}
      title={`⚔️ 攻城确认 — ${target.name}`}
      confirmText="发动攻城"
      cancelText="取消"
      onConfirm={allPassed ? onConfirm : undefined}
      onCancel={onCancel}
      confirmDisabled={!allPassed}
      dangerConfirm
      width="480px"
    >
      <div className="tk-siege-confirm" data-testid="siege-confirm">
        {/* ── 每日攻城次数 & 冷却倒计时 ── */}
        {(dailySiegesRemaining != null || cooldownText) && (
          <div className="tk-siege-status-bar">
            {dailySiegesRemaining != null && (
              <span className={`tk-siege-daily-count ${dailySiegesRemaining > 0 ? 'tk-siege-daily-count--available' : 'tk-siege-daily-count--exhausted'}`}>
                ⚔️ 今日攻城: {dailySiegesRemaining}次
              </span>
            )}
            {cooldownText && (
              <span className="tk-siege-cooldown">{cooldownText}</span>
            )}
          </div>
        )}

        {/* ── 目标信息 ── */}
        <div className="tk-siege-target-info">
          <div className="tk-siege-target-row">
            <span className="tk-siege-target-label">等级</span>
            <span className="tk-siege-target-value">Lv.{target.level}</span>
          </div>
          <div className="tk-siege-target-row">
            <span className="tk-siege-target-label">防御</span>
            <span className="tk-siege-target-value">{target.defenseValue}</span>
          </div>
          <div className="tk-siege-target-row">
            <span className="tk-siege-target-label">归属</span>
            <span className="tk-siege-target-value">
              {target.ownership === 'enemy' ? '敌方' : target.ownership === 'neutral' ? '中立' : '己方'}
            </span>
          </div>
        </div>

        {/* ── 攻城条件 ── */}
        <div className="tk-siege-conditions">
          <h4 className="tk-siege-section-title">攻城条件</h4>
          {conditions.map((c) => (
            <div
              key={c.label}
              className={`tk-siege-condition ${c.passed ? 'tk-siege-condition--pass' : 'tk-siege-condition--fail'}`}
              data-testid={`siege-condition-${c.label}`}
            >
              <span className="tk-siege-condition-icon">{c.passed ? '✅' : '❌'}</span>
              <span className="tk-siege-condition-label">{c.label}</span>
              <span className="tk-siege-condition-detail">{c.detail}</span>
            </div>
          ))}
        </div>

        {/* ── 预估消耗 ── */}
        {cost && (
          <div className="tk-siege-cost">
            <h4 className="tk-siege-section-title">预估消耗</h4>
            <div className="tk-siege-cost-grid">
              <div className="tk-siege-cost-item">
                <span className="tk-siege-cost-icon">⚔️</span>
                <span className="tk-siege-cost-label">兵力</span>
                <span className="tk-siege-cost-value">-{cost.troops}</span>
              </div>
              <div className="tk-siege-cost-item">
                <span className="tk-siege-cost-icon">🌾</span>
                <span className="tk-siege-cost-label">粮草</span>
                <span className="tk-siege-cost-value">-{cost.grain}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── 错误消息 ── */}
        {conditionResult?.errorMessage && !allPassed && (
          <div className="tk-siege-error" data-testid="siege-error">
            ⚠️ {conditionResult.errorMessage}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SiegeConfirmModal;
