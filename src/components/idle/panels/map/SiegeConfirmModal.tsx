/**
 * SiegeConfirmModal — 攻城确认弹窗
 *
 * 功能：
 * - 显示目标领土信息（名称/等级/防御值/归属）
 * - 显示攻城条件校验结果（相邻/兵力/粮草）
 * - 显示预估消耗（兵力/粮草）
 * - 显示预估胜率
 * - **攻城策略选择（强攻/围困/夜袭/内应）** MAP-F06-02
 * - **内应信三态卡片** MAP-F06-07
 * - **首次/重复攻城奖励预览** MAP-F08
 * - 确认/取消按钮
 *
 * @module components/idle/panels/map/SiegeConfirmModal
 * @see flows.md MAP-F06 攻城战
 * @see flows.md MAP-F06-02 攻城策略选项
 * @see flows.md MAP-F06-07 内应信消费流程
 */

import React, { useMemo, useState, useEffect } from 'react';
import Modal from '../../common/Modal';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';
import { ExpeditionForcePanel, type HeroInfo, type ExpeditionForceSelection } from './ExpeditionForcePanel';
import {
  SIEGE_STRATEGY_CONFIGS,
  type SiegeStrategyType,
  type SiegeStrategyConfig,
} from '@/games/three-kingdoms/core/map/siege-enhancer.types';
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
  /** 用户选择的出征兵力（用于滑块控制） */
  selectedTroops?: number;
  /** 出征兵力变更回调 */
  onTroopsChange?: (troops: number) => void;
  /** 可用将领列表（用于编队选择） */
  heroes?: HeroInfo[];
  /** 编队选择结果 */
  expeditionSelection?: ExpeditionForceSelection | null;
  /** 编队选择变更回调 */
  onExpeditionChange?: (selection: ExpeditionForceSelection | null) => void;
  /** MAP-F06-02: 选中的攻城策略 */
  selectedStrategy?: SiegeStrategyType;
  /** MAP-F06-02: 策略变更回调 */
  onStrategyChange?: (strategy: SiegeStrategyType | null) => void;
  /** MAP-F06-07: 内应信持有数量 */
  insiderLetterCount?: number;
  /** MAP-F06-07: 目标城池内应是否暴露 */
  insiderExposed?: boolean;
  /** MAP-F06-07: 内应暴露冷却剩余时间(ms) */
  insiderCooldownMs?: number;
  /** MAP-F06-03: 夜袭令持有数量 */
  nightRaidTokenCount?: number;
  /** MAP-F08: 是否首次攻城该领土 */
  isFirstCapture?: boolean;
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
  selectedTroops,
  onTroopsChange,
  heroes,
  expeditionSelection,
  onExpeditionChange,
  selectedStrategy,
  onStrategyChange,
  insiderLetterCount = 0,
  insiderExposed = false,
  insiderCooldownMs = 0,
  nightRaidTokenCount = 0,
  isFirstCapture,
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

  // 如果提供了将领列表，则编队选择是必须步骤
  const hasHeroes = heroes && heroes.length > 0;
  const expeditionValid = !hasHeroes || (expeditionSelection !== null && expeditionSelection !== undefined);
  const canConfirm = allPassed && expeditionValid;

  // ── MAP-F06-02: 策略可用性判定 ──
  const strategyAvailability = useMemo(() => {
    const configs = Object.values(SIEGE_STRATEGY_CONFIGS) as SiegeStrategyConfig[];
    return configs.map((config) => {
      let available = true;
      let reason = '';

      if (config.requiredItem === 'item-insider-letter') {
        // 内应信三态判定 (MAP-F06-07)
        if (insiderExposed) {
          available = false;
          reason = '内应已暴露';
        } else if (insiderLetterCount <= 0) {
          available = false;
          reason = '需要内应信×1';
        }
      } else if (config.requiredItem === 'item-night-raid-token') {
        if (nightRaidTokenCount <= 0) {
          available = false;
          reason = '需要夜袭令×1';
        }
      }

      return { config, available, reason };
    });
  }, [insiderLetterCount, insiderExposed, nightRaidTokenCount]);

  // ── MAP-F06-07: 内应信冷却倒计时文本 ──
  const [insiderCooldownText, setInsiderCooldownText] = useState('');
  useEffect(() => {
    if (!visible || !insiderExposed || insiderCooldownMs <= 0) {
      setInsiderCooldownText('');
      return;
    }
    const startTimestamp = Date.now();
    const update = () => {
      const elapsed = Date.now() - startTimestamp;
      const remaining = Math.max(0, insiderCooldownMs - elapsed);
      if (remaining <= 0) {
        setInsiderCooldownText('');
        return;
      }
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      setInsiderCooldownText(`${hours}时${minutes}分`);
    };
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [visible, insiderExposed, insiderCooldownMs]);

  if (!target) return null;

  return (
    <Modal
      visible={visible}
      type={allPassed ? 'warning' : 'danger'}
      title={`⚔️ 攻城确认 — ${target.name}`}
      confirmText="发动攻城"
      cancelText="取消"
      onConfirm={canConfirm ? onConfirm : undefined}
      onCancel={onCancel}
      confirmDisabled={!canConfirm}
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
            {/* 兵力部署滑块 */}
            {onTroopsChange && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#a0a0a0' }}>出征兵力</span>
                  <span style={{ fontSize: 13, color: '#d4a574', fontWeight: 600 }}>
                    {selectedTroops ?? cost.troops} / {availableTroops}
                  </span>
                </div>
                <input
                  type="range"
                  min={cost.troops}
                  max={availableTroops}
                  value={selectedTroops ?? cost.troops}
                  onChange={(e) => onTroopsChange(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#d4a574' }}
                  data-testid="siege-troops-slider"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#666' }}>
                  <span>最低 {cost.troops}</span>
                  <span>全部 {availableTroops}</span>
                </div>
              </div>
            )}
            <div className="tk-siege-cost-grid">
              <div className="tk-siege-cost-item">
                <span className="tk-siege-cost-icon">⚔️</span>
                <span className="tk-siege-cost-label">兵力</span>
                <span className="tk-siege-cost-value">-{selectedTroops ?? cost.troops}</span>
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

        {/* ── MAP-F06-02: 攻城策略选择 ── */}
        {onStrategyChange && allPassed && (
          <div className="tk-siege-strategies" data-testid="siege-strategies">
            <h4 className="tk-siege-section-title">攻城策略</h4>
            <div className="tk-siege-strategy-grid">
              {strategyAvailability.map(({ config, available, reason }) => {
                const isSelected = selectedStrategy === config.type;
                return (
                  <div
                    key={config.type}
                    className={[
                      'tk-siege-strategy-card',
                      isSelected ? 'tk-siege-strategy-card--selected' : '',
                      !available ? 'tk-siege-strategy-card--disabled' : '',
                    ].filter(Boolean).join(' ')}
                    data-testid={`siege-strategy-${config.type}`}
                    onClick={() => available && onStrategyChange(isSelected ? null : config.type)}
                    role="button"
                    tabIndex={available ? 0 : -1}
                    aria-label={`${config.name}: ${config.description}`}
                  >
                    <div className="tk-siege-strategy-header">
                      <span className="tk-siege-strategy-name">{config.name}</span>
                      <span className="tk-siege-strategy-positioning">{config.positioning}</span>
                    </div>
                    <div className="tk-siege-strategy-desc">{config.description}</div>
                    <div className="tk-siege-strategy-stats">
                      <span className="tk-siege-strategy-stat" title="时间">
                        ⏱ {config.timeMultiplier}x
                      </span>
                      <span className="tk-siege-strategy-stat" title="损耗">
                        ⚔️ {config.troopCostMultiplier}x
                      </span>
                      <span className="tk-siege-strategy-stat" title="奖励">
                        🏆 {config.rewardMultiplier}x
                      </span>
                    </div>
                    <div className="tk-siege-strategy-effect">{config.specialEffect}</div>
                    {!available && reason && (
                      <div className="tk-siege-strategy-locked">
                        {config.type === 'insider' && insiderExposed
                          ? `🔒 ${reason} ${insiderCooldownText ? `(${insiderCooldownText})` : ''}`
                          : `🔒 ${reason}`}
                      </div>
                    )}
                    {available && config.requiredItem && (
                      <div className="tk-siege-strategy-item">
                        {config.type === 'insider'
                          ? `📜 持有内应信×${insiderLetterCount}`
                          : config.type === 'nightRaid'
                          ? `🌙 持有夜袭令×${nightRaidTokenCount}`
                          : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── MAP-F08: 首次攻城奖励预览 ── */}
        {isFirstCapture && allPassed && (
          <div className="tk-siege-first-capture" data-testid="siege-first-capture">
            <div className="tk-siege-first-capture-badge">🌟 首次攻城</div>
            <div className="tk-siege-first-capture-rewards">
              <span>💎 元宝×100</span>
              <span>📜 声望+50</span>
              <span>🎖️ 专属称号</span>
            </div>
          </div>
        )}

        {/* ── 编队选择（当有可用将领时显示） ── */}
        {hasHeroes && onExpeditionChange && (
          <div style={{ marginTop: 12 }} data-testid="siege-expedition-panel">
            <ExpeditionForcePanel
              heroes={heroes!}
              maxTroops={availableTroops}
              selection={expeditionSelection ?? undefined}
              onChange={onExpeditionChange}
              disabled={!allPassed}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SiegeConfirmModal;
