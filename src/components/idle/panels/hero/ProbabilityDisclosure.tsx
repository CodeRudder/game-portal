/**
 * ProbabilityDisclosure — 概率公示合规组件
 * 显示普通/高级招募概率表、保底机制说明，符合游戏合规要求。
 * @module components/idle/panels/hero/ProbabilityDisclosure
 */

import React, { useState, useMemo } from 'react';
import './ProbabilityDisclosure.css';

export interface ProbabilityDisclosureProps {
  normalRates: { quality: string; label: string; rate: number }[];
  advancedRates: { quality: string; label: string; rate: number }[];
  pityThreshold: number;
  currentPityCount: number;
}

const QUALITY_COLORS: Record<string, string> = {
  COMMON: '#9e9e9e', FINE: '#4caf50', RARE: '#2196f3',
  EPIC: '#9c27b0', LEGENDARY: '#ffc107', MYTHIC: '#f44336',
};

type TabKey = 'normal' | 'advanced';

// ── 子组件：概率表格 ──

const RateTable: React.FC<{
  title: string; icon: string;
  rates: { quality: string; label: string; rate: number }[];
}> = ({ title, icon, rates }) => {
  const total = useMemo(() => rates.reduce((s, r) => s + r.rate, 0), [rates]);
  return (
    <div className="tk-prob-disc__table" data-testid="prob-rate-table">
      <div className="tk-prob-disc__table-title">
        <span>{icon}</span><span>{title}</span>
      </div>
      <table className="tk-prob-disc__table-grid">
        <thead>
          <tr><th>品质</th><th>概率</th><th>占比</th></tr>
        </thead>
        <tbody>
          {rates.map((r) => {
            const isZero = r.rate === 0;
            return (
              <tr key={r.quality} className={`tk-prob-disc__row tk-prob-disc__row--${r.quality.toLowerCase()} ${isZero ? 'tk-prob-disc__row--unavailable' : ''}`}>
                <td>
                  <span className="tk-prob-disc__quality-dot"
                    style={{ backgroundColor: isZero ? '#666' : (QUALITY_COLORS[r.quality] || '#9e9e9e') }} />
                  <span className={isZero ? 'tk-prob-disc__quality-label--unavailable' : ''}>{r.label}</span>
                </td>
                <td className={`tk-prob-disc__rate-value ${isZero ? 'tk-prob-disc__rate-value--zero' : ''}`}>
                  {isZero ? '无法获得' : `${(r.rate * 100).toFixed(2)}%`}
                </td>
                <td>
                  {isZero ? (
                    <span className="tk-prob-disc__unavailable-text">—</span>
                  ) : (
                    <div className="tk-prob-disc__bar-track">
                      <div className="tk-prob-disc__bar-fill" style={{
                        width: `${r.rate * 100}%`,
                        backgroundColor: QUALITY_COLORS[r.quality] || '#9e9e9e',
                      }} />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
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

// ── 子组件：保底说明 ──

const PityInfo: React.FC<{ pityThreshold: number; currentPityCount: number }> = ({
  pityThreshold, currentPityCount,
}) => {
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
          <span className="tk-prob-disc__pity-count">{currentPityCount}/{pityThreshold}</span>
        </div>
        <div className="tk-prob-disc__bar-track tk-prob-disc__bar-track--pity">
          <div className="tk-prob-disc__bar-fill tk-prob-disc__bar-fill--pity"
            style={{ width: `${progress * 100}%` }} />
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

// ── 主组件 ──

const ProbabilityDisclosure: React.FC<ProbabilityDisclosureProps> = ({
  normalRates, advancedRates, pityThreshold, currentPityCount,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('normal');
  const currentRates = activeTab === 'normal' ? normalRates : advancedRates;
  const tabTitle = activeTab === 'normal' ? '普通招募概率' : '高级招募概率';
  const tabIcon = activeTab === 'normal' ? '📜' : '🏆';

  return (
    <div className="tk-prob-disc" data-testid="probability-disclosure">
      <div className="tk-prob-disc__header">
        <span className="tk-prob-disc__header-icon">📊</span>
        <span className="tk-prob-disc__header-title">概率公示</span>
        <span className="tk-prob-disc__header-badge">合规</span>
      </div>
      <div className="tk-prob-disc__tabs">
        {(['normal', 'advanced'] as const).map((key) => (
          <button key={key}
            className={`tk-prob-disc__tab ${activeTab === key ? 'tk-prob-disc__tab--active' : ''}`}
            onClick={() => setActiveTab(key)}
            data-testid={`prob-tab-${key}`}
            aria-pressed={activeTab === key}
          >
            {key === 'normal' ? '📜 普通招募' : '🏆 高级招募'}
          </button>
        ))}
      </div>
      <RateTable title={tabTitle} icon={tabIcon} rates={currentRates} />
      <PityInfo pityThreshold={pityThreshold} currentPityCount={currentPityCount} />
      <div className="tk-prob-disc__footer" data-testid="prob-compliance">
        <p>※ 以上概率已通过合规审查，真实有效。概率公示依据《网络游戏管理暂行办法》相关规定。</p>
      </div>
    </div>
  );
};

export default ProbabilityDisclosure;
