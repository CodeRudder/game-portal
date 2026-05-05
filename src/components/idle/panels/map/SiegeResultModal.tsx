/**
 * SiegeResultModal — 攻城结果弹窗
 *
 * P0-3 修复：攻城结束后显示正式的结果弹窗，
 * 展示战斗结果（胜/败）、战损统计、获得奖励。
 *
 * R9 Task 6 增强：
 * - 战斗结果等级显示（大捷/胜利/险胜/失败/惨败）
 * - 伤亡健康色指示器（绿/黄/红背景条）
 * - 将领受伤恢复时间显示
 * - 奖励倍率说明
 *
 * 使用 SharedPanel 统一弹窗容器，与项目风格一致。
 *
 * @module components/idle/panels/map/SiegeResultModal
 */
import React, { useMemo, useEffect } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';
import type { CasualtyResult, InjuryLevel } from '@/games/three-kingdoms/engine/map/expedition-types';
import { INJURY_RECOVERY_TIME, INJURY_RECOVERY_HOURS, mapInjuryLevel } from '@/games/three-kingdoms/engine/map/expedition-types';
import { SIEGE_ITEM_NAMES, type SiegeItemType } from '@/games/three-kingdoms/engine/map/SiegeItemSystem';

// ─────────────────────────────────────────────
// 资源名称映射
// ─────────────────────────────────────────────

const RESOURCE_LABELS: Record<string, string> = {
  gold: '铜钱', grain: '粮草', gem: '元宝', troops: '兵力',
  mandate: '天命', experience: '经验',
};

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export interface SiegeRewardItem {
  itemId: string;
  itemName: string;
  quantity: number;
  rarity: string;
}

export type SiegeOutcome = 'decisiveVictory' | 'victory' | 'narrowVictory' | 'defeat' | 'rout';

export interface SiegeResultData {
  /** 是否发动攻城 */
  launched: boolean;
  /** 是否胜利 */
  victory: boolean;
  /** 目标ID */
  targetId: string;
  /** 目标名称 */
  targetName: string;
  /** 攻城消耗 */
  cost: {
    troops: number;
    grain: number;
  };
  /** 占领信息（胜利时） */
  capture?: {
    territoryId: string;
    newOwner: string;
    previousOwner: string;
  };
  /** 失败原因 */
  failureReason?: string;
  /** 攻城失败时损失的兵力 */
  defeatTroopLoss?: number;
  /** 编队出征的伤亡详情 */
  casualties?: CasualtyResult;
  /** 将领受伤信息（快捷字段，来源于 casualties） */
  heroInjured?: {
    heroId: string;
    injuryLevel: InjuryLevel;
  };
  /** 攻城奖励（来自SiegeEnhancer） */
  siegeReward?: {
    resources?: Record<string, number>;
    territoryExp?: number;
    items?: SiegeRewardItem[];
  };
  /** R9: 战斗结果等级 */
  outcome?: SiegeOutcome;
  /** R9: 将领恢复时间(ms) */
  heroRecoveryTime?: number;
  /** R9: 是否首次攻占（触发首次奖励倍率） */
  firstCaptureBonus?: boolean;
  /** R9: 奖励倍率 */
  rewardMultiplier?: number;
  /** R14: 道具掉落（攻城胜利时从SiegeItemSystem检测） */
  itemDrops?: Array<{ type: SiegeItemType; count: number }>;
}

export interface SiegeResultModalProps {
  /** 是否显示 */
  visible: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 攻城结果数据 */
  result: SiegeResultData | null;
  /** R13 H6: 将领受伤详情（增强显示） */
  injuryData?: {
    generalName: string;
    injuryLevel: 'light' | 'medium' | 'severe' | 'none';
    recoveryHours: number;
  };
  /** R13 H5: 部队损失详情（数字+百分比） */
  troopLoss?: {
    lost: number;
    total: number;
  };
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  wrap: { padding: 16, color: '#e8e0d0', minHeight: '100%' },
  resultHeader: { textAlign: 'center', padding: '20px 12px', marginBottom: 16, borderRadius: 'var(--tk-radius-lg)' as any },
  resultHeaderWin: { background: 'rgba(126,200,80,0.1)', border: '1px solid rgba(126,200,80,0.3)' },
  resultHeaderLose: { background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)' },
  resultHeaderFail: { background: 'rgba(160,160,160,0.1)', border: '1px solid rgba(160,160,160,0.3)' },
  resultIcon: { fontSize: 48, marginBottom: 8 },
  resultTitle: { fontSize: 20, fontWeight: 700 },
  resultTitleWin: { color: '#7EC850' },
  resultTitleLose: { color: '#e74c3c' },
  resultTitleFail: { color: '#a0a0a0' },
  resultSub: { fontSize: 13, color: '#a0a0a0', marginTop: 4 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: '#d4a574', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid rgba(212,165,116,0.2)' },
  statRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13 },
  statLabel: { color: '#a0a0a0' },
  statValue: { color: '#e8e0d0', fontWeight: 600 },
  statValueLoss: { color: '#e74c3c', fontWeight: 600 },
  statValueGain: { color: '#7EC850', fontWeight: 600 },
  divider: { height: 1, background: 'rgba(255,255,255,0.08)', margin: '12px 0' },
  targetName: { color: '#d4a574', fontWeight: 600 },
  rewardCard: { padding: 12, background: 'rgba(126,200,80,0.06)', border: '1px solid rgba(126,200,80,0.15)', borderRadius: 'var(--tk-radius-lg)' as any },
  confirmBtn: {
    display: 'block', width: '100%', padding: '12px 24px', marginTop: 16,
    border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-lg)' as any,
    background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 15,
    cursor: 'pointer', textAlign: 'center', fontWeight: 600,
  },
  // R9: 结果等级标签
  outcomeBadge: {
    display: 'inline-block', padding: '2px 10px', borderRadius: 4,
    fontSize: 13, fontWeight: 700, marginTop: 6,
  },
  // R9: 伤亡健康条
  casualtyBarWrap: {
    width: '100%', height: 6, borderRadius: 3,
    background: 'rgba(255,255,255,0.08)', marginTop: 4, overflow: 'hidden',
  },
  // R9: 奖励倍率标签
  multiplierBadge: {
    display: 'inline-block', padding: '1px 6px', borderRadius: 3,
    fontSize: 11, fontWeight: 600, marginLeft: 6,
  },
  // R9: 恢复时间
  recoveryTime: {
    fontSize: 11, color: '#a0a0a0', marginLeft: 4,
  },
  // R13 H5: 部队损失详情
  troopLossSection: {
    padding: '8px 12px', borderRadius: 6,
    background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.15)',
    marginTop: 6,
  },
  troopLossValue: {
    fontSize: 16, fontWeight: 700, color: '#e74c3c',
  },
  troopLossPercent: {
    fontSize: 12, color: '#a0a0a0', marginLeft: 6,
  },
  // R13 H6: 将领受伤标签
  injuryTag: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 8px', borderRadius: 4,
    fontSize: 12, fontWeight: 700,
  },
  injuryGeneralName: {
    fontSize: 14, fontWeight: 600, color: '#e8e0d0', marginRight: 6,
  },
  injuryRecovery: {
    fontSize: 12, color: '#a0a0a0', marginTop: 2,
  },
};

// ─────────────────────────────────────────────
// 受伤等级显示名称
// ─────────────────────────────────────────────

const INJURY_LEVEL_LABEL: Record<string, string> = {
  none: '无伤',
  minor: '轻伤',
  moderate: '中伤',
  severe: '重伤',
};

// ─────────────────────────────────────────────
// R9: 战斗结果等级
// ─────────────────────────────────────────────

const OUTCOME_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  decisiveVictory: { label: '大捷', color: '#FFD700', bgColor: 'rgba(255,215,0,0.15)' },
  victory:         { label: '胜利', color: '#7EC850', bgColor: 'rgba(126,200,80,0.10)' },
  narrowVictory:   { label: '险胜', color: '#e67e22', bgColor: 'rgba(230,126,34,0.10)' },
  defeat:          { label: '失败', color: '#e74c3c', bgColor: 'rgba(231,76,60,0.10)' },
  rout:            { label: '惨败', color: '#c0392b', bgColor: 'rgba(192,57,43,0.15)' },
};

// ─────────────────────────────────────────────
// R13 H6: 受伤等级颜色配置
// ─────────────────────────────────────────────

const INJURY_TAG_CONFIG: Record<string, { icon: string; color: string; bgColor: string; label: string }> = {
  light:  { icon: '\u26A0\uFE0F', color: '#FFC107', bgColor: 'rgba(255,193,7,0.12)', label: '\u8F7B\u4F24' },
  medium: { icon: '\uD83D\uDD25', color: '#FF9800', bgColor: 'rgba(255,152,0,0.12)', label: '\u4E2D\u4F24' },
  severe: { icon: '\uD83D\uDC80', color: '#F44336', bgColor: 'rgba(244,67,54,0.12)', label: '\u91CD\u4F24' },
  none:   { icon: '',             color: '#a0a0a0', bgColor: 'transparent',           label: '\u65E0\u4F24' },
};

// ─────────────────────────────────────────────
// R9: 伤亡健康色
// ─────────────────────────────────────────────

function getCasualtyHealthColor(percent: number): string {
  if (percent <= 0.2) return '#4caf50';  // 绿色 — 低伤亡
  if (percent <= 0.4) return '#ffc107';  // 黄色 — 中等伤亡
  return '#e74c3c';                       // 红色 — 高伤亡
}

// ─────────────────────────────────────────────
// R9→R16: 受伤等级恢复时间已移至 expedition-types.ts
// INJURY_RECOVERY_HOURS 从共享配置导入（按引擎 InjuryLevel 索引）
// ─────────────────────────────────────────────

/** 引擎 InjuryLevel 恢复小时数（使用引擎 level 作为 key，与 INJURY_RECOVERY_TIME 一致） */
const INJURY_RECOVERY_HOURS_ENGINE: Record<string, number> = {
  none: INJURY_RECOVERY_HOURS.none,
  minor: INJURY_RECOVERY_HOURS.light,
  moderate: INJURY_RECOVERY_HOURS.medium,
  severe: INJURY_RECOVERY_HOURS.severe,
};

/** 格式化恢复时间 */
function formatRecoveryTime(ms: number): string {
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return `${Math.round(ms / (60 * 1000))}分钟`;
  if (Number.isInteger(hours)) return `${hours}小时`;
  return `${hours.toFixed(1)}小时`;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const SiegeResultModal: React.FC<SiegeResultModalProps> = ({
  visible,
  onClose,
  result,
  injuryData,
  troopLoss,
}) => {
  // P2-1修复: 5秒自动关闭fallback
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [visible, onClose]);

  if (!result) return null;

  const isWin = result.launched && result.victory;
  const isLose = result.launched && !result.victory;
  const isFail = !result.launched;

  // ── 胜利奖励（基于领土等级估算） ──
  const estimatedRewards = useMemo(() => {
    if (!isWin) return null;
    return {
      territoryName: result.targetName,
      // 占领领土后获得的产出加成
      productionBonus: '粮草+50/h',
    };
  }, [isWin, result.targetName]);

  return (
    <SharedPanel
      visible={visible}
      title="⚔️ 攻城战报"
      icon=""
      onClose={onClose}
      width="460px"
      data-testid="siege-result-modal"
    >
      <div style={s.wrap} data-testid="siege-result-content">
        {/* ── 结果头部 ── */}
        <div
          style={{
            ...s.resultHeader,
            ...(isWin ? s.resultHeaderWin : isLose ? s.resultHeaderLose : s.resultHeaderFail),
          }}
          data-testid="siege-result-header"
        >
          <div style={s.resultIcon}>
            {isWin ? '🏆' : isLose ? '💀' : '⚠️'}
          </div>
          <div style={{
            ...s.resultTitle,
            ...(isWin ? s.resultTitleWin : isLose ? s.resultTitleLose : s.resultTitleFail),
          }}>
            {isWin ? '攻城大捷！' : isLose ? '攻城失利' : '无法攻城'}
          </div>
          {/* R9: 战斗结果等级标签 */}
          {result.outcome && OUTCOME_CONFIG[result.outcome] && (
            <div
              style={{
                ...s.outcomeBadge,
                color: OUTCOME_CONFIG[result.outcome].color,
                background: OUTCOME_CONFIG[result.outcome].bgColor,
                border: `1px solid ${OUTCOME_CONFIG[result.outcome].color}40`,
              }}
              data-testid="siege-outcome-badge"
            >
              {OUTCOME_CONFIG[result.outcome].label}
            </div>
          )}
          <div style={s.resultSub}>
            {isWin
              ? `成功占领了 ${result.targetName}`
              : isLose
                ? `${result.targetName} 防守坚固，未能攻破`
                : result.failureReason ?? '条件不满足'}
          </div>
        </div>

        {/* ── 目标信息 ── */}
        <div style={s.section} data-testid="siege-result-target">
          <div style={s.sectionTitle}>📍 目标</div>
          <div style={s.statRow}>
            <span style={s.statLabel}>城池</span>
            <span style={s.targetName}>{result.targetName}</span>
          </div>
          {result.capture && (
            <div style={s.statRow}>
              <span style={s.statLabel}>原属势力</span>
              <span style={s.statValue}>
                {result.capture.previousOwner === 'neutral' ? '中立' :
                  result.capture.previousOwner === 'player' ? '我方' :
                    result.capture.previousOwner === 'enemy' ? '敌方' : result.capture.previousOwner}
              </span>
            </div>
          )}
        </div>

        {/* ── 战损统计 ── */}
        <div style={s.section} data-testid="siege-result-casualties">
          <div style={s.sectionTitle}>⚔️ 战损统计</div>
          {result.launched && (
            <>
              <div style={s.statRow}>
                <span style={s.statLabel}>出征兵力</span>
                <span style={s.statValue}>{result.cost.troops.toLocaleString()}</span>
              </div>
              <div style={s.statRow}>
                <span style={s.statLabel}>消耗粮草</span>
                <span style={s.statValueLoss}>-{result.cost.grain.toLocaleString()}</span>
              </div>
              {isLose && result.defeatTroopLoss != null && result.defeatTroopLoss > 0 && (
                <div style={s.statRow}>
                  <span style={s.statLabel}>兵力损失（30%）</span>
                  <span style={s.statValueLoss}>-{result.defeatTroopLoss.toLocaleString()}</span>
                </div>
              )}
              {isWin && (
                <div style={s.statRow}>
                  <span style={s.statLabel}>兵力消耗</span>
                  <span style={s.statValueLoss}>-{result.cost.troops.toLocaleString()}</span>
                </div>
              )}

              {/* ── 编队伤亡详情 ── */}
              {result.casualties && (
                <>
                  <div style={s.divider} />
                  <div style={s.statRow} data-testid="siege-casualty-troops-lost">
                    <span style={s.statLabel}>士兵伤亡</span>
                    <span style={s.statValueLoss}>
                      -{result.casualties.troopsLost.toLocaleString()}
                      <span style={{ fontSize: 11, color: '#a0a0a0', marginLeft: 4 }}>
                        ({(result.casualties.troopsLostPercent * 100).toFixed(0)}%)
                      </span>
                    </span>
                  </div>
                  {/* R9: 伤亡健康色指示条 */}
                  <div
                    style={s.casualtyBarWrap}
                    data-testid="siege-casualty-health-bar"
                  >
                    <div style={{
                      width: `${Math.min(result.casualties.troopsLostPercent * 100, 100)}%`,
                      height: '100%',
                      borderRadius: 3,
                      background: getCasualtyHealthColor(result.casualties.troopsLostPercent),
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  {result.casualties.heroInjured && (
                    <div style={s.statRow} data-testid="siege-casualty-hero-injured">
                      <span style={s.statLabel}>将领受伤</span>
                      <span style={{
                        ...s.statValueLoss,
                        color: result.casualties.injuryLevel === 'severe' ? '#e74c3c' :
                               result.casualties.injuryLevel === 'moderate' ? '#e67e22' : '#f1c40f',
                      }}>
                        {INJURY_LEVEL_LABEL[result.casualties.injuryLevel] ?? '轻伤'}
                        {/* R9: 恢复时间显示 */}
                        {(result.casualties.injuryLevel !== 'none') && (() => {
                          const recoveryMs = result.heroRecoveryTime
                            ?? INJURY_RECOVERY_TIME[result.casualties.injuryLevel]
                            ?? 0;
                          const recoveryHours = INJURY_RECOVERY_HOURS_ENGINE[result.casualties.injuryLevel] ?? 0;
                          if (recoveryMs <= 0 && recoveryHours <= 0) return null;
                          const displayTime = result.heroRecoveryTime
                            ? formatRecoveryTime(result.heroRecoveryTime)
                            : `${recoveryHours}小时`;
                          return (
                            <span
                              style={s.recoveryTime}
                              data-testid="siege-hero-recovery-time"
                            >
                              (恢复时间: {displayTime})
                            </span>
                          );
                        })()}
                      </span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* ── 获得奖励（胜利时） ── */}
        {isWin && (
          <div style={s.section} data-testid="siege-result-rewards">
            <div style={s.sectionTitle}>🎁 获得奖励</div>
            {/* R9: 奖励倍率说明 */}
            <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }} data-testid="siege-reward-multipliers">
              {result.firstCaptureBonus && (
                <span
                  style={{
                    ...s.multiplierBadge,
                    color: '#FFD700',
                    background: 'rgba(255,215,0,0.12)',
                    border: '1px solid rgba(255,215,0,0.3)',
                  }}
                  data-testid="siege-first-capture-badge"
                >
                  首次奖励 x1.5
                </span>
              )}
              {result.rewardMultiplier != null && result.rewardMultiplier !== 1 && (
                <span
                  style={{
                    ...s.multiplierBadge,
                    color: '#d4a574',
                    background: 'rgba(212,165,116,0.10)',
                    border: '1px solid rgba(212,165,116,0.25)',
                  }}
                  data-testid="siege-reward-multiplier-badge"
                >
                  结果倍率 x{result.rewardMultiplier.toFixed(1)}
                </span>
              )}
            </div>
            <div style={s.rewardCard}>
              {result.siegeReward?.resources && Object.entries(result.siegeReward.resources).length > 0 && (
                <>
                  {Object.entries(result.siegeReward.resources).map(([key, value]) => (
                    <div key={key} style={s.statRow}>
                      <span style={s.statLabel}>{RESOURCE_LABELS[key] ?? key}</span>
                      <span style={s.statValueGain}>+{value.toLocaleString()}</span>
                    </div>
                  ))}
                </>
              )}
              {result.siegeReward?.territoryExp && result.siegeReward.territoryExp > 0 && (
                <div style={s.statRow}>
                  <span style={s.statLabel}>领土经验</span>
                  <span style={s.statValueGain}>+{result.siegeReward.territoryExp.toLocaleString()}</span>
                </div>
              )}
              {result.siegeReward?.items && result.siegeReward.items.length > 0 && (
                <>
                  <div style={s.divider} />
                  <div style={{ fontSize: 12, color: '#d4a574', marginBottom: 4 }}>道具掉落</div>
                  {result.siegeReward.items.map((item, idx) => (
                    <div key={idx} style={s.statRow}>
                      <span style={s.statLabel}>{item.itemName}</span>
                      <span style={{
                        ...s.statValueGain,
                        color: item.rarity === 'legendary' ? '#f1c40f' :
                               item.rarity === 'epic' ? '#9b59b6' :
                               item.rarity === 'rare' ? '#3498db' : '#7EC850',
                      }}>×{item.quantity}</span>
                    </div>
                  ))}
                </>
              )}
              {(!result.siegeReward || (!result.siegeReward.resources && !result.siegeReward.items)) && estimatedRewards && (
                <div style={s.statRow}>
                  <span style={s.statLabel}>预计产出</span>
                  <span style={s.statValueGain}>{estimatedRewards.productionBonus}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── R14: 道具掉落展示（攻城胜利时检测） ── */}
        {isWin && result.itemDrops && result.itemDrops.length > 0 && (
          <div style={s.section} data-testid="siege-item-drops-section">
            <div style={s.sectionTitle}>🎒 战利品</div>
            <div style={{
              padding: 12,
              background: 'rgba(155,89,182,0.06)',
              border: '1px solid rgba(155,89,182,0.2)',
              borderRadius: 8,
            }}>
              {result.itemDrops.map((drop, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 0',
                    animation: 'fadeInOut 0.6s ease-in-out',
                  }}
                  data-testid={`siege-item-drop-${drop.type}`}
                >
                  <span style={{ color: '#9b59b6', fontWeight: 600, fontSize: 13 }}>
                    📜 {SIEGE_ITEM_NAMES[drop.type] ?? drop.type}
                  </span>
                  <span style={{
                    color: '#9b59b6',
                    fontWeight: 700,
                    fontSize: 14,
                  }}>
                    x{drop.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── R13 H5: 部队损失详情（数字+百分比） ── */}
        {troopLoss && troopLoss.lost > 0 && (
          <div style={s.section} data-testid="siege-troop-loss-section">
            <div style={s.sectionTitle}>📊 部队损失</div>
            <div style={s.troopLossSection}>
              <div style={s.statRow}>
                <span style={s.statLabel}>损失士兵</span>
                <span>
                  <span style={s.troopLossValue} data-testid="siege-troop-loss-count">
                    {troopLoss.lost.toLocaleString()}
                  </span>
                  <span style={s.troopLossPercent} data-testid="siege-troop-loss-percent">
                    ({((troopLoss.lost / troopLoss.total) * 100).toFixed(1)}%)
                  </span>
                </span>
              </div>
              <div style={s.statRow}>
                <span style={s.statLabel}>出征总数</span>
                <span style={s.statValue}>{troopLoss.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── R13 H6: 将领受伤状态显示（颜色编码标签+恢复倒计时） ── */}
        {injuryData && injuryData.injuryLevel !== 'none' && (
          <div style={s.section} data-testid="siege-injury-status-section">
            <div style={s.sectionTitle}>🩹 将领状态</div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <span style={s.injuryGeneralName} data-testid="siege-injury-general-name">
                {injuryData.generalName}
              </span>
              {(() => {
                const config = INJURY_TAG_CONFIG[injuryData.injuryLevel];
                if (!config) return null;
                return (
                  <span
                    style={{
                      ...s.injuryTag,
                      color: config.color,
                      background: config.bgColor,
                      border: `1px solid ${config.color}40`,
                    }}
                    data-testid="siege-injury-tag"
                  >
                    {config.icon} {config.label}
                  </span>
                );
              })()}
            </div>
            {injuryData.recoveryHours > 0 && (
              <div style={s.injuryRecovery} data-testid="siege-injury-recovery">
                恢复中: {injuryData.recoveryHours}小时
              </div>
            )}
          </div>
        )}

        {/* ── 确认按钮 ── */}
        <button
          style={s.confirmBtn}
          onClick={onClose}
          data-testid="siege-result-confirm"
        >
          确认
        </button>
      </div>
    </SharedPanel>
  );
};

export default SiegeResultModal;
