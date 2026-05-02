/**
 * OfflinePushReport — 离线推图战报区域
 *
 * 从 OfflinePushPanel 拆分出的战报子组件：
 * - 战报列表展示（成功/失败、获得奖励）
 * - 空状态提示
 *
 * @module components/idle/panels/campaign/OfflinePushReport
 */

import React from 'react';
import { formatNum, getResourceLabel } from './utils';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 战报记录条目 */
export interface BattleLogEntry {
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

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface OfflinePushReportProps {
  /** 战报列表 */
  battleLogs: BattleLogEntry[];
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

const OfflinePushReport: React.FC<OfflinePushReportProps> = ({
  battleLogs,
}) => {
  return (
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
  );
};

OfflinePushReport.displayName = 'OfflinePushReport';
export default OfflinePushReport;
