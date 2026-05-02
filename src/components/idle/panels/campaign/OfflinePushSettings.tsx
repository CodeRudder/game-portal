/**
 * OfflinePushSettings — 离线推图设置区域
 *
 * 从 OfflinePushPanel 拆分出的设置子组件：
 * - 离线自动推图开关
 * - 战力阈值调整
 * - 自动推图进度显示
 *
 * @module components/idle/panels/campaign/OfflinePushSettings
 */

import React, { useCallback } from 'react';
import type { AutoPushProgress } from '@/games/three-kingdoms/engine/campaign/sweep.types';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface OfflinePushSettingsProps {
  /** 离线推图是否启用 */
  autoPushEnabled: boolean;
  /** 战力阈值 */
  powerThreshold: number;
  /** 自动推图进度（可选） */
  autoPushProgress: AutoPushProgress | null;
  /** 切换开关回调 */
  onToggleAutoPush: () => void;
  /** 战力阈值变更回调 */
  onThresholdChange: (value: number) => void;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

const OfflinePushSettings: React.FC<OfflinePushSettingsProps> = ({
  autoPushEnabled,
  powerThreshold,
  autoPushProgress,
  onToggleAutoPush,
  onThresholdChange,
}) => {
  const handleThresholdInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val >= 0) {
        onThresholdChange(val);
      }
    },
    [onThresholdChange],
  );

  return (
    <div className="tk-offline-push-section">
      <div className="tk-offline-push-section-title">⚙️ 推图设置</div>

      {/* 开关 */}
      <div className="tk-offline-push-setting-row">
        <span className="tk-offline-push-setting-label">离线自动推图</span>
        <button
          className={`tk-offline-push-toggle ${autoPushEnabled ? 'tk-offline-push-toggle--on' : ''}`}
          onClick={onToggleAutoPush}
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
            onChange={handleThresholdInput}
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
  );
};

OfflinePushSettings.displayName = 'OfflinePushSettings';
export default OfflinePushSettings;
