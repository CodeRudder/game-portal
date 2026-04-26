/**
 * RecruitPanel — 招募面板增强组件
 *
 * 功能：
 * - 招贤令余额显示（大数字 + 图标）
 * - 普通招募 / 高级招募模式切换
 * - 各品质概率表可视化
 * - 保底进度条
 * - 单抽 / 十连按钮（含折扣提示）
 * - 招募结果展示区
 */

import React, { useState, useMemo } from 'react';
import './RecruitPanel.css';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** 品质概率条目 */
export interface RateEntry {
  quality: string;
  rate: number;
}

/** 招募结果条目 */
export interface RecruitResultEntry {
  id: string;
  name: string;
  quality: string;
  isDuplicate: boolean;
}

/** RecruitPanel Props */
export interface RecruitPanelProps {
  /** 当前招贤令余额 */
  recruitToken: number;
  /** 招募回调 */
  onRecruit: (mode: 'normal' | 'advanced', count: 1 | 10) => void;
  /** 当前保底计数 */
  pityCount: number;
  /** 保底阈值 */
  pityThreshold: number;
  /** 普通招募概率表 */
  normalRates: RateEntry[];
  /** 高级招募概率表 */
  advancedRates: RateEntry[];
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 招募消耗配置 */
const RECRUIT_COST = {
  normal: { single: 5, multi: 45 },
  advanced: { single: 100, multi: 900 },
} as const;

/** 模式标签 */
const MODE_LABELS: Record<'normal' | 'advanced', { label: string; icon: string; desc: string }> = {
  normal: { label: '普通招贤', icon: '📜', desc: '铜钱招募，基础概率' },
  advanced: { label: '高级招贤', icon: '🏆', desc: '求贤令招募，高品质概率' },
};

/** 品质颜色映射 */
const QUALITY_COLORS: Record<string, string> = {
  COMMON: '#9e9e9e',
  FINE: '#4caf50',
  RARE: '#2196f3',
  EPIC: '#9c27b0',
  LEGENDARY: '#ffc107',
};

/** 品质中文标签 */
const QUALITY_LABELS: Record<string, string> = {
  COMMON: '普通',
  FINE: '精良',
  RARE: '稀有',
  EPIC: '史诗',
  LEGENDARY: '传说',
};

// ─────────────────────────────────────────────
// 子组件：余额显示
// ─────────────────────────────────────────────

const TokenBalance: React.FC<{ amount: number }> = ({ amount }) => (
  <div className="tk-rp-balance">
    <span className="tk-rp-balance-icon">🪙</span>
    <span className="tk-rp-balance-label">招贤令</span>
    <span className="tk-rp-balance-value" data-testid="recruit-token-balance">{amount.toLocaleString()}</span>
  </div>
);

// ─────────────────────────────────────────────
// 子组件：模式切换
// ─────────────────────────────────────────────

const ModeSwitch: React.FC<{
  mode: 'normal' | 'advanced';
  onChange: (mode: 'normal' | 'advanced') => void;
}> = ({ mode, onChange }) => (
  <div className="tk-rp-mode-switch">
    {(['normal', 'advanced'] as const).map((m) => {
      const info = MODE_LABELS[m];
      const isActive = mode === m;
      return (
        <button
          key={m}
          className={`tk-rp-mode-btn ${isActive ? 'tk-rp-mode-btn--active' : ''} ${m === 'advanced' ? 'tk-rp-mode-btn--gold' : 'tk-rp-mode-btn--copper'}`}
          onClick={() => onChange(m)}
          data-testid={`mode-btn-${m}`}
          aria-pressed={isActive}
        >
          <span className="tk-rp-mode-icon">{info.icon}</span>
          <span className="tk-rp-mode-label">{info.label}</span>
        </button>
      );
    })}
  </div>
);

// ─────────────────────────────────────────────
// 子组件：概率表
// ─────────────────────────────────────────────

const RateTable: React.FC<{ rates: RateEntry[] }> = ({ rates }) => (
  <div className="tk-rp-rate-table" data-testid="rate-table">
    <div className="tk-rp-rate-title">概率一览</div>
    {rates.map((entry) => (
      <div key={entry.quality} className="tk-rp-rate-row">
        <span
          className="tk-rp-rate-quality"
          style={{ color: QUALITY_COLORS[entry.quality] || '#ccc' }}
        >
          {QUALITY_LABELS[entry.quality] || entry.quality}
        </span>
        <div className="tk-rp-rate-bar-track">
          <div
            className="tk-rp-rate-bar-fill"
            style={{
              width: `${Math.min(entry.rate * 100, 100)}%`,
              backgroundColor: QUALITY_COLORS[entry.quality] || '#ccc',
            }}
          />
        </div>
        <span className="tk-rp-rate-value">{(entry.rate * 100).toFixed(1)}%</span>
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────
// 子组件：保底进度条
// ─────────────────────────────────────────────

const PityBar: React.FC<{ pityCount: number; pityThreshold: number }> = ({
  pityCount,
  pityThreshold,
}) => {
  const remaining = Math.max(0, pityThreshold - pityCount);
  const progress = Math.min(pityCount / pityThreshold, 1);
  return (
    <div className="tk-rp-pity" data-testid="pity-bar">
      <div className="tk-rp-pity-header">
        <span className="tk-rp-pity-label">保底进度</span>
        <span className="tk-rp-pity-count" data-testid="pity-count">
          {pityCount} / {pityThreshold}
        </span>
      </div>
      <div className="tk-rp-pity-track">
        <div
          className="tk-rp-pity-fill"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="tk-rp-pity-hint" data-testid="pity-remaining">
        距离保底还需 <strong>{remaining}</strong> 次
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 子组件：招募按钮
// ─────────────────────────────────────────────

const RecruitButtons: React.FC<{
  mode: 'normal' | 'advanced';
  recruitToken: number;
  onRecruit: (mode: 'normal' | 'advanced', count: 1 | 10) => void;
}> = ({ mode, recruitToken, onRecruit }) => {
  const costs = RECRUIT_COST[mode];
  const canSingle = recruitToken >= costs.single;
  const canMulti = recruitToken >= costs.multi;

  const btnClass = mode === 'advanced' ? 'tk-rp-btn--gold' : 'tk-rp-btn--copper';

  return (
    <div className="tk-rp-buttons">
      {/* 单抽 */}
      <button
        className={`tk-rp-btn ${btnClass}`}
        disabled={!canSingle}
        onClick={() => onRecruit(mode, 1)}
        data-testid="btn-single-recruit"
        aria-label={`单抽，消耗${costs.single}招贤令`}
      >
        <span className="tk-rp-btn-label">单抽</span>
        <span className="tk-rp-btn-cost">🪙 {costs.single}</span>
      </button>

      {/* 十连 */}
      <button
        className={`tk-rp-btn ${btnClass}`}
        disabled={!canMulti}
        onClick={() => onRecruit(mode, 10)}
        data-testid="btn-multi-recruit"
        aria-label={`十连，消耗${costs.multi}招贤令`}
      >
        <span className="tk-rp-btn-label">十连</span>
        <span className="tk-rp-btn-cost">🪙 {costs.multi}</span>
        <span className="tk-rp-btn-discount">9折</span>
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────
// 子组件：招募结果展示区
// ─────────────────────────────────────────────

const ResultArea: React.FC<{ results: RecruitResultEntry[] }> = ({ results }) => {
  if (results.length === 0) return null;
  return (
    <div className="tk-rp-results" data-testid="recruit-results">
      <div className="tk-rp-results-title">招募结果</div>
      <div className="tk-rp-results-grid">
        {results.map((r, idx) => (
          <div
            key={`${r.id}-${idx}`}
            className={`tk-rp-result-card tk-rp-result-card--${r.quality.toLowerCase()}`}
            data-testid={`result-card-${idx}`}
          >
            <div
              className="tk-rp-result-quality-dot"
              style={{ backgroundColor: QUALITY_COLORS[r.quality] || '#ccc' }}
            />
            <span className="tk-rp-result-name">{r.name}</span>
            {r.isDuplicate && <span className="tk-rp-result-dup">重复</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const RecruitPanel: React.FC<RecruitPanelProps> = ({
  recruitToken,
  onRecruit,
  pityCount,
  pityThreshold,
  normalRates,
  advancedRates,
}) => {
  const [mode, setMode] = useState<'normal' | 'advanced'>('normal');
  const [results, setResults] = useState<RecruitResultEntry[]>([]);

  /** 当前模式的概率表 */
  const currentRates = useMemo(
    () => (mode === 'normal' ? normalRates : advancedRates),
    [mode, normalRates, advancedRates],
  );

  /** 处理招募 */
  const handleRecruit = (m: 'normal' | 'advanced', count: 1 | 10) => {
    onRecruit(m, count);
    // 结果由外部通过 props 更新，这里仅清空旧结果
    setResults([]);
  };

  return (
    <div className="tk-rp-panel" data-testid="recruit-panel">
      {/* 标题 */}
      <div className="tk-rp-header">
        <h3 className="tk-rp-title">招贤纳士</h3>
      </div>

      {/* 余额显示 */}
      <TokenBalance amount={recruitToken} />

      {/* 模式切换 */}
      <ModeSwitch mode={mode} onChange={setMode} />

      {/* 概率表 */}
      <RateTable rates={currentRates} />

      {/* 保底进度 */}
      <PityBar pityCount={pityCount} pityThreshold={pityThreshold} />

      {/* 招募按钮 */}
      <RecruitButtons mode={mode} recruitToken={recruitToken} onRecruit={handleRecruit} />

      {/* 结果展示 */}
      <ResultArea results={results} />
    </div>
  );
};

export default RecruitPanel;
