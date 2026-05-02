/**
 * OfflinePushPanel — 离线推图面板
 *
 * 功能：
 * - 设置面板：开关离线推图、战力阈值调整
 * - 战报列表：最近N次离线推图结果（成功/失败、获得奖励）
 * - 挂机收益显示：已累积时间、预计收益、12小时上限进度条
 * - 领取挂机收益按钮
 *
 * 设计风格：水墨江山·铜纹霸业
 *
 * @module components/idle/panels/campaign/OfflinePushPanel
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine';
import type { AutoPushProgress, AutoPushResult } from '@/games/three-kingdoms/engine/campaign/sweep.types';
import './OfflinePushPanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface OfflinePushPanelProps {
  engine: ThreeKingdomsEngine;
  snapshotVersion: number;
  onClose: () => void;
}

// ─────────────────────────────────────────────
// 资源名称映射
// ─────────────────────────────────────────────
const RESOURCE_LABELS: Record<string, string> = {
  grain: '粮草',
  gold: '铜钱',
  troops: '兵力',
  mandate: '天命',
  techPoint: '科技点',
  recruitToken: '招募令',
  skillBook: '技能书',
  tiger_tally: '虎符',
  war_script: '兵法',
  forge_stone: '锻造石',
  exp_book_small: '经验书·小',
  exp_book_medium: '经验书·中',
  exp_book_large: '经验书·大',
};

function getResourceLabel(type: string): string {
  if (type.startsWith('fragment_')) {
    return `${type.replace('fragment_', '')}碎片`;
  }
  return RESOURCE_LABELS[type] ?? type;
}

function formatNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString();
}

/** 格式化秒数为可读时间 */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0分钟';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
  return `${m}分钟`;
}

// ─────────────────────────════════════════════
// 战报记录类型
// ─────────────────────────────────────────────
interface BattleLogEntry {
  id: string;
  timestamp: number;
  startStageId: string;
  endStageId: string;
  victories: number;
  defeats: number;
  totalAttempts: number;
  totalResources: Record<string, number>;
  totalExp: number;
}

// ─────────────────────────════────────══════════════
// 主组件
// ─────────────────────────────────────────────
const OfflinePushPanel: React.FC<OfflinePushPanelProps> = ({
  engine,
  snapshotVersion,
  onClose,
}) => {
  const sweepSystem = useMemo(() => engine.getSweepSystem?.(), [engine]);
  const offlineSystem = useMemo(() => engine.getOfflineRewardSystem?.(), [engine]);

  // ── 离线推图开关 ──
  const [autoPushEnabled, setAutoPushEnabled] = useState(false);

  // ── 战力阈值 ──
  const [powerThreshold, setPowerThreshold] = useState(10000);

  // ── 挂机累积时间（秒） ──
  const [accumulatedSeconds, setAccumulatedSeconds] = useState(0);

  // ── 模拟战报列表 ──
  const [battleLogs] = useState<BattleLogEntry[]>([]);

  // ── 领取状态 ──
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  // ── 挂机收益上限（12小时） ──
  const MAX_IDLE_SECONDS = 12 * 3600;

  // ── 计算进度百分比 ──
  const progressPercent = useMemo(() => {
    return Math.min(100, (accumulatedSeconds / MAX_IDLE_SECONDS) * 100);
  }, [accumulatedSeconds]);

  // ── 计算预计收益 ──
  const estimatedRewards = useMemo(() => {
    void snapshotVersion;
    if (accumulatedSeconds <= 0) return null;
    try {
      // 通过离线收益系统计算快照
      if (offlineSystem) {
        const rates: import('@/games/three-kingdoms/shared/types').ProductionRate = {
          grain: 100, gold: 50, ore: 30, wood: 30,
          troops: 20, mandate: 5,
          techPoint: 0, recruitToken: 0, skillBook: 0,
        };
        const snapshot = offlineSystem.calculateSnapshot(accumulatedSeconds, rates);
        const earned = snapshot.totalEarned;
        const rewards: Record<string, number> = {};
        for (const [type, amount] of Object.entries(earned)) {
          if (amount > 0) rewards[type] = amount;
        }
        return Object.keys(rewards).length > 0 ? rewards : null;
      }
      return null;
    } catch {
      return null;
    }
  }, [offlineSystem, accumulatedSeconds, snapshotVersion]);

  // ── 获取自动推图进度 ──
  const autoPushProgress = useMemo((): AutoPushProgress | null => {
    try {
      return sweepSystem?.getAutoPushProgress?.() ?? null;
    } catch {
      return null;
    }
  }, [sweepSystem]);

  // ── 切换离线推图开关 ──
  const handleToggleAutoPush = useCallback(() => {
    setAutoPushEnabled((prev) => !prev);
  }, []);

  // ── 调整战力阈值 ──
  const handleThresholdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      setPowerThreshold(val);
    }
  }, []);

  // ── 领取挂机收益 ──
  const handleClaimRewards = useCallback(() => {
    if (claimed || accumulatedSeconds <= 0) return;
    setClaiming(true);
    try {
      // 调用引擎领取离线收益
      if (offlineSystem) {
        const rates: import('@/games/three-kingdoms/shared/types').ProductionRate = {
          grain: 100, gold: 50, ore: 30, wood: 30,
          troops: 20, mandate: 5,
          techPoint: 0, recruitToken: 0, skillBook: 0,
        };
        const emptyResources: import('@/games/three-kingdoms/shared/types').Resources = {
          grain: 0, gold: 0, ore: 0, wood: 0,
          troops: 0, mandate: 0,
          techPoint: 0, recruitToken: 0, skillBook: 0,
        };
        const result = offlineSystem.calculateOfflineReward(
          accumulatedSeconds,
          rates,
          emptyResources,
          {},
          0,
          'campaign',
        );
        if (result) {
          offlineSystem.claimReward(result);
        }
      }
      setClaimed(true);
      setAccumulatedSeconds(0);
    } catch (err) {
      console.error('领取挂机收益失败:', err);
    } finally {
      setClaiming(false);
    }
  }, [claimed, accumulatedSeconds, offlineSystem]);

  // ── 模拟挂机累积（用于演示） ──
  const handleSimulateAccumulate = useCallback(() => {
    setAccumulatedSeconds((prev) => Math.min(prev + 3600, MAX_IDLE_SECONDS));
    setClaimed(false);
  }, [MAX_IDLE_SECONDS]);

  return (
    <div className="tk-offline-push-overlay" data-testid="offline-push-panel">
      <div className="tk-offline-push">
        {/* 头部 */}
        <div className="tk-offline-push-header">
          <h2 className="tk-offline-push-title">离线推图 · 挂机收益</h2>
          <button
            className="tk-offline-push-close"
            onClick={onClose}
            aria-label="关闭"
            data-testid="offline-push-close"
          >
            ✕
          </button>
        </div>

        {/* ── 挂机收益区 ── */}
        <div className="tk-offline-push-section">
          <div className="tk-offline-push-section-title">⏳ 挂机收益</div>

          {/* 累积时间 + 进度条 */}
          <div className="tk-offline-push-timer">
            <div className="tk-offline-push-timer-info">
              <span className="tk-offline-push-timer-label">已累积</span>
              <span className="tk-offline-push-timer-value" data-testid="offline-push-timer">
                {formatDuration(accumulatedSeconds)}
              </span>
            </div>
            <div className="tk-offline-push-timer-info">
              <span className="tk-offline-push-timer-label">上限</span>
              <span className="tk-offline-push-timer-limit">12小时</span>
            </div>
          </div>

          <div className="tk-offline-push-progress" data-testid="offline-push-progress">
            <div
              className="tk-offline-push-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
            <span className="tk-offline-push-progress-text">
              {Math.round(progressPercent)}%
            </span>
          </div>

          {/* 预计收益 */}
          {estimatedRewards && (
            <div className="tk-offline-push-estimated">
              <div className="tk-offline-push-estimated-title">预计收益</div>
              <div className="tk-offline-push-estimated-grid">
                {Object.entries(estimatedRewards).map(([type, amount]) => (
                  <div key={type} className="tk-offline-push-estimated-item">
                    <span className="tk-offline-push-estimated-type">{getResourceLabel(type)}</span>
                    <span className="tk-offline-push-estimated-amount">×{formatNum(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="tk-offline-push-actions">
            <button
              className="tk-offline-push-btn tk-offline-push-btn--secondary"
              onClick={handleSimulateAccumulate}
              data-testid="offline-push-simulate"
            >
              模拟+1小时
            </button>
            <button
              className={`tk-offline-push-btn tk-offline-push-btn--primary ${claimed ? 'tk-offline-push-btn--claimed' : ''}`}
              onClick={handleClaimRewards}
              disabled={claiming || claimed || accumulatedSeconds <= 0}
              data-testid="offline-push-claim"
            >
              {claimed ? '✓ 已领取' : claiming ? '领取中...' : '领取收益'}
            </button>
          </div>
        </div>

        {/* ── 离线推图设置 ── */}
        <div className="tk-offline-push-section">
          <div className="tk-offline-push-section-title">⚙️ 推图设置</div>

          {/* 开关 */}
          <div className="tk-offline-push-setting-row">
            <span className="tk-offline-push-setting-label">离线自动推图</span>
            <button
              className={`tk-offline-push-toggle ${autoPushEnabled ? 'tk-offline-push-toggle--on' : ''}`}
              onClick={handleToggleAutoPush}
              role="switch"
              aria-checked={autoPushEnabled}
              data-testid="offline-push-toggle"
            >
              <span className="tk-offline-push-toggle-knob" />
            </button>
          </div>

          {/* 战力阈值 */}
          <div className="tk-offline-push-setting-row">
            <span className="tk-offline-push-setting-label">战力阈值</span>
            <div className="tk-offline-push-threshold">
              <input
                type="number"
                className="tk-offline-push-threshold-input"
                value={powerThreshold}
                onChange={handleThresholdChange}
                min={0}
                step={1000}
                data-testid="offline-push-threshold"
              />
              <span className="tk-offline-push-threshold-hint">
                低于此战力不自动推图
              </span>
            </div>
          </div>

          {/* 自动推图进度 */}
          {autoPushProgress && autoPushProgress.isRunning && (
            <div className="tk-offline-push-autopush-status">
              <span className="tk-offline-push-autopush-label">推图中</span>
              <span className="tk-offline-push-autopush-detail">
                已推{autoPushProgress.victories}胜{autoPushProgress.defeats}负
                （共{autoPushProgress.attempts}次）
              </span>
            </div>
          )}
        </div>

        {/* ── 战报列表 ── */}
        <div className="tk-offline-push-section">
          <div className="tk-offline-push-section-title">📜 推图战报</div>

          {battleLogs.length === 0 ? (
            <div className="tk-offline-push-empty" data-testid="offline-push-empty">
              暂无战报，开启离线推图后将自动记录
            </div>
          ) : (
            <div className="tk-offline-push-logs">
              {battleLogs.map((log) => (
                <div key={log.id} className="tk-offline-push-log">
                  <div className="tk-offline-push-log-header">
                    <span className="tk-offline-push-log-time">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`tk-offline-push-log-result ${log.defeats === 0 ? 'tk-offline-push-log-result--win' : ''}`}>
                      {log.defeats === 0 ? '全胜' : `${log.victories}胜${log.defeats}负`}
                    </span>
                  </div>
                  <div className="tk-offline-push-log-detail">
                    {log.startStageId} → {log.endStageId}（{log.totalAttempts}关）
                  </div>
                  {Object.keys(log.totalResources).length > 0 && (
                    <div className="tk-offline-push-log-rewards">
                      {Object.entries(log.totalResources).slice(0, 3).map(([type, amount]) => (
                        <span key={type} className="tk-offline-push-log-reward">
                          {getResourceLabel(type)} ×{formatNum(amount)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

OfflinePushPanel.displayName = 'OfflinePushPanel';

export default OfflinePushPanel;
