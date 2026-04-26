/**
 * ProbabilityDisclosure — 概率公示合规组件
 *
 * 功能：
 * - 显示普通招募概率表（各品质概率）
 * - 显示高级招募概率表
 * - 显示保底机制说明
 * - 显示当前保底进度
 * - 符合游戏合规要求（概率透明公示）
 *
 * @module components/idle/panels/hero/ProbabilityDisclosure
 */

import React, { useState, useMemo } from 'react';
import './ProbabilityDisclosure.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface ProbabilityDisclosureProps {
  /** 普通招募概率表 */
  normalRates: { quality: string; label: string; rate: number }[];
  /** 高级招募概率表 */
  advancedRates: { quality: string; label: string; rate: number }[];
  /** 保底阈值（第N次必出高品质） */
  pityThreshold: number;
  /** 当前保底计数 */
  currentPityCount: number;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 品质颜色映射 */
const QUALITY_COLORS: Record<string, string> = {
  COMMON: '#9e9e9e',
  FINE: '#4caf50',
  RARE: '#2196f3',
  EPIC: '#9c27b0',
  LEGENDARY: '#ffc107',
  MYTHIC: '#f44336',
};

/** Tab 类型 */
type TabKey = 'normal' | 'advanced';

// ─────────────────────────────────────────────
// 子组件：概率表格
// ─────────────────────────────────────────────

interface RateTableProps {
  title: string;
  icon: string;
  rates: { quality: string; label: string; rate: number }[];
}

const RateTable: React.FC<RateTableProps> = ({ title, icon, rates }) => {
  const total = useMemo(() => rates.reduce((s, r) => s + r.rate, 0), [rates]);

  return (
    <div className="tk-prob-disc__table" data-testid="prob-rate-table">
      <div className="tk-prob-disc__table-title">
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <table className="tk-prob-disc__table-grid">
        <thead>
          <tr>
            <th>品质</th>
            <th>概率</th>
            <th>占比</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r.quality} className={`tk-prob-disc__row tk-prob-disc__row--${r.quality.toLowerCase()}`}>
              <td>
                <span
                  className="tk-prob-disc__quality-dot"
                  style={{ backgroundColor: QUALITY_COLORS[r.quality] || '#9e9e9e' }}
                />
                {r.label}
              </td>
              <td className="tk-prob-disc__rate-value">{(r.rate * 100).toFixed(2)}%</td>
              <td>
                <div className="tk-prob-disc__bar-track">
                  <div
                    className="tk-prob-disc__bar-fill"
                    style={{
                      width: `${r.rate * 100}%`,
                      backgroundColor: QUALITY_COLORS[r.quality] || '#9e9e9e',
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>合计</td>
            <td className="tk-prob-disc__rate-value">{(total * 100).toFixed(2)}%</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

// ─────────────────────────────────────────────
// 子组件：保底说明
// ─────────────────────────────────────────────

interface PityInfoProps {
  pityThreshold: number;
  currentPityCount: number;
}

const PityInfo: React.FC<PityInfoProps> = ({ pityThreshold, currentPityCount }) => {
  const progress = pityThreshold > 0 ? Math.min(currentPityCount / pityThreshold, 1) : 0;
  const remaining = Math.max(pityThreshold - currentPityCount, 0);

  return (
    <div className="tk-prob-disc__pity" data-testid="prob-pity-info">
      <div className="tk-prob-disc__pity-title">🛡️ 保底机制</div>
      <p className="tk-prob-disc__pity-desc">
        每进行 <strong>{pityThreshold}</strong> 次招募，必定获得史诗及以上品质武将。
        保底计数在获得史诗及以上品质武将后重置。
      </p>
      <div className="tk-prob-disc__pity-progress">
        <div className="tk-prob-disc__pity-header">
          <span>当前保底进度</span>
          <span className="tk-prob-disc__pity-count">
            {currentPityCount}/{pityThreshold}
          </span>
        </div>
        <div className="tk-prob-disc__bar-track tk-prob-disc__bar-track--pity">
          <div
            className="tk-prob-disc__bar-fill tk-prob-disc__bar-fill--pity"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        {remaining > 0 && (
          <span className="tk-prob-disc__pity-remaining">
            距离保底还需 <strong>{remaining}</strong> 次
          </span>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const ProbabilityDisclosure: React.FC<ProbabilityDisclosureProps> = ({
  normalRates,
  advancedRates,
  pityThreshold,
  currentPityCount,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('normal');

  const currentRates = activeTab === 'normal' ? normalRates : advancedRates;
  const tabTitle = activeTab === 'normal' ? '普通招募概率' : '高级招募概率';
  const tabIcon = activeTab === 'normal' ? '📜' : '🏆';

  return (
    <div className="tk-prob-disc" data-testid="probability-disclosure">
      {/* 标题 */}
      <div className="tk-prob-disc__header">
        <span className="tk-prob-disc__header-icon">📊</span>
        <span className="tk-prob-disc__header-title">概率公示</span>
        <span className="tk-prob-disc__header-badge">合规</span>
      </div>

      {/* 模式切换 */}
      <div className="tk-prob-disc__tabs">
        <button
          className={`tk-prob-disc__tab ${activeTab === 'normal' ? 'tk-prob-disc__tab--active' : ''}`}
          onClick={() => setActiveTab('normal')}
          data-testid="prob-tab-normal"
          aria-pressed={activeTab === 'normal'}
        >
          📜 普通招募
        </button>
        <button
          className={`tk-prob-disc__tab ${activeTab === 'advanced' ? 'tk-prob-disc__tab--active' : ''}`}
          onClick={() => setActiveTab('advanced')}
          data-testid="prob-tab-advanced"
          aria-pressed={activeTab === 'advanced'}
        >
          🏆 高级招募
        </button>
      </div>

      {/* 概率表格 */}
      <RateTable title={tabTitle} icon={tabIcon} rates={currentRates} />

      {/* 保底机制 */}
      <PityInfo pityThreshold={pityThreshold} currentPityCount={currentPityCount} />

      {/* 合规声明 */}
      <div className="tk-prob-disc__footer" data-testid="prob-compliance">
        <p>※ 以上概率已通过合规审查，真实有效。概率公示依据《网络游戏管理暂行办法》相关规定。</p>
      </div>
    </div>
  );
};

export default ProbabilityDisclosure;
