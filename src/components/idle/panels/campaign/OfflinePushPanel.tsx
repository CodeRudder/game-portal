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
 * P1改进：
 * - 拆分为 OfflinePushSettings / OfflinePushReport 子组件
 * - 消除硬编码生产率，改为从引擎获取
 *
 * @module components/idle/panels/campaign/OfflinePushPanel
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine';
import type { AutoPushProgress } from '@/games/three-kingdoms/engine/campaign/sweep.types';
import type { Resources } from '@/games/three-kingdoms/shared/types';
import { formatDuration, formatNum, getResourceLabel } from './utils';
import OfflinePushSettings from './OfflinePushSettings';
import OfflinePushReport from './OfflinePushReport';
import type { BattleLogEntry } from './OfflinePushReport';
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

  // ── P1：从引擎获取生产率，消除硬编码 ──
  const productionRates: Readonly<Resources> = useMemo(() => {
    try {
      return engine.resource.getProductionRates() as unknown as Resources;
    } catch {
      // 降级：返回零值
      return {
        grain: 0, gold: 0, ore: 0, wood: 0,
        troops: 0, mandate: 0,
        techPoint: 0, recruitToken: 0, skillBook: 0,
      } satisfies Resources;
    }
  }, [engine, snapshotVersion]);

  // ── 计算进度百分比 ──
  const progressPercent = useMemo(() => {
    return Math.min(100, (accumulatedSeconds / MAX_IDLE_SECONDS) * 100);
  }, [accumulatedSeconds]);

  // ── 计算预计收益 ──
  const estimatedRewards = useMemo(() => {
    if (accumulatedSeconds <= 0) return null;
    try {
      if (offlineSystem) {
        const snapshot = offlineSystem.calculateSnapshot(accumulatedSeconds, productionRates);
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
  }, [offlineSystem, accumulatedSeconds, productionRates]);

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
  const handleThresholdChange = useCallback((value: number) => {
    setPowerThreshold(value);
  }, []);

  // ── 领取挂机收益 ──
  const handleClaimRewards = useCallback(() => {
    if (claimed || accumulatedSeconds <= 0) return;
    setClaiming(true);
    try {
      if (offlineSystem) {
        const emptyResources: Resources = {
          grain: 0, gold: 0, ore: 0, wood: 0,
          troops: 0, mandate: 0,
          techPoint: 0, recruitToken: 0, skillBook: 0,
        };
        const result = offlineSystem.calculateOfflineReward(
          accumulatedSeconds,
          productionRates,
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
  }, [claimed, accumulatedSeconds, offlineSystem, productionRates]);

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

        {/* ── 推图设置（拆分子组件） ── */}
        <OfflinePushSettings
          autoPushEnabled={autoPushEnabled}
          powerThreshold={powerThreshold}
          autoPushProgress={autoPushProgress}
          onToggleAutoPush={handleToggleAutoPush}
          onThresholdChange={handleThresholdChange}
        />

        {/* ── 战报列表（拆分子组件） ── */}
        <OfflinePushReport battleLogs={battleLogs} />
      </div>
    </div>
  );
};

OfflinePushPanel.displayName = 'OfflinePushPanel';

export default OfflinePushPanel;
