/**
 * SiegeResultModal — 攻城结果弹窗
 *
 * P0-3 修复：攻城结束后显示正式的结果弹窗，
 * 展示战斗结果（胜/败）、战损统计、获得奖励。
 *
 * 使用 SharedPanel 统一弹窗容器，与项目风格一致。
 *
 * @module components/idle/panels/map/SiegeResultModal
 */
import React, { useMemo } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';

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
  /** 攻城奖励（来自SiegeEnhancer） */
  siegeReward?: {
    resources?: Record<string, number>;
    territoryExp?: number;
    items?: SiegeRewardItem[];
  };
}

export interface SiegeResultModalProps {
  /** 是否显示 */
  visible: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 攻城结果数据 */
  result: SiegeResultData | null;
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
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const SiegeResultModal: React.FC<SiegeResultModalProps> = ({
  visible,
  onClose,
  result,
}) => {
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
            </>
          )}
        </div>

        {/* ── 获得奖励（胜利时） ── */}
        {isWin && (
          <div style={s.section} data-testid="siege-result-rewards">
            <div style={s.sectionTitle}>🎁 获得奖励</div>
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
