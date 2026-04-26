/**
 * HeroComparePanel — 武将对比面板
 *
 * 功能：
 * - 选择2个武将进行对比
 * - 雷达图式属性对比（攻击/防御/策略/速度）
 * - 技能对比
 * - 羁绊对比
 * - 战力对比
 */

import React, { useMemo, useState } from 'react';
import type { GeneralData, Quality } from '@/games/three-kingdoms/engine';
import { QUALITY_LABELS, QUALITY_BORDER_COLORS, FACTION_LABELS } from '@/games/three-kingdoms/engine';
import RadarChart from './RadarChart';
import './HeroComparePanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface HeroComparePanelProps {
  /** 所有可选武将列表 */
  generals: GeneralData[];
  /** 计算战力回调 */
  calculatePower: (general: GeneralData) => number;
  /** 获取武将羁绊列表回调 */
  getBonds?: (generalId: string) => string[];
  /** 关闭回调 */
  onClose?: () => void;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const STAT_KEYS = ['attack', 'defense', 'intelligence', 'speed'] as const;
const STAT_LABELS: Record<string, string> = {
  attack: '攻击', defense: '防御', intelligence: '策略', speed: '速度',
};
const STAT_COLORS: Record<string, string> = {
  attack: '#E53935', defense: '#1E88E5', intelligence: '#AB47BC', speed: '#43A047',
};

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 计算属性最大值（用于雷达图） */
function computeStatMax(a: GeneralData, b: GeneralData | null): number {
  const stats = [a.baseStats];
  if (b) stats.push(b.baseStats);
  const maxVal = Math.max(
    ...stats.map(s => Math.max(s.attack, s.defense, s.intelligence, s.speed)),
  );
  return Math.ceil(maxVal * 1.2 / 10) * 10;
}

// ─────────────────────────────────────────────
// 子组件：属性对比条
// ─────────────────────────────────────────────

const StatCompareRow: React.FC<{
  label: string;
  leftVal: number;
  rightVal: number;
  color: string;
  max: number;
}> = React.memo(({ label, leftVal, rightVal, color, max }) => {
  const diff = leftVal - rightVal;
  const leftPct = Math.min(100, Math.floor((leftVal / max) * 100));
  const rightPct = Math.min(100, Math.floor((rightVal / max) * 100));
  const isLeftWin = diff > 0;
  const isRightWin = diff < 0;

  return (
    <div className="hcp-stat-row" data-testid={`hcp-stat-${label}`}>
      <span className={`hcp-stat-val ${isLeftWin ? 'hcp-stat-val--win' : ''}`}>{leftVal}</span>
      <div className="hcp-stat-bar-wrap">
        <div className="hcp-stat-bar hcp-stat-bar--left">
          <div className="hcp-stat-fill" style={{ width: `${leftPct}%`, background: color }} />
        </div>
        <span className="hcp-stat-label">{label}</span>
        <div className="hcp-stat-bar hcp-stat-bar--right">
          <div className="hcp-stat-fill" style={{ width: `${rightPct}%`, background: color }} />
        </div>
      </div>
      <span className={`hcp-stat-val ${isRightWin ? 'hcp-stat-val--win' : ''}`}>{rightVal}</span>
    </div>
  );
});
StatCompareRow.displayName = 'StatCompareRow';

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const HeroComparePanel: React.FC<HeroComparePanelProps> = ({
  generals,
  calculatePower,
  getBonds,
  onClose,
}) => {
  const [leftId, setLeftId] = useState<string>(generals[0]?.id ?? '');
  const [rightId, setRightId] = useState<string>(generals[1]?.id ?? '');

  const leftHero = useMemo(() => generals.find(g => g.id === leftId) ?? null, [generals, leftId]);
  const rightHero = useMemo(() => generals.find(g => g.id === rightId) ?? null, [generals, rightId]);

  const statMax = useMemo(() => {
    if (!leftHero) return 100;
    return computeStatMax(leftHero, rightHero);
  }, [leftHero, rightHero]);

  const leftPower = leftHero ? calculatePower(leftHero) : 0;
  const rightPower = rightHero ? calculatePower(rightHero) : 0;

  const leftBonds = useMemo(() => (leftHero && getBonds ? getBonds(leftHero.id) : []), [leftHero, getBonds]);
  const rightBonds = useMemo(() => (rightHero && getBonds ? getBonds(rightHero.id) : []), [rightHero, getBonds]);

  // 雷达图数据
  const leftRadarStats = useMemo(() => {
    if (!leftHero) return [];
    return STAT_KEYS.map(key => ({
      key, label: STAT_LABELS[key], value: leftHero.baseStats[key], color: STAT_COLORS[key],
    }));
  }, [leftHero]);

  const rightRadarStats = useMemo(() => {
    if (!rightHero) return [];
    return STAT_KEYS.map(key => ({
      key, label: STAT_LABELS[key], value: rightHero.baseStats[key], color: STAT_COLORS[key],
    }));
  }, [rightHero]);

  return (
    <div className="hcp-panel" data-testid="hcp-panel">
      {/* 标题栏 */}
      <div className="hcp-panel__header">
        <h3 className="hcp-panel__title">⚔️ 武将对比</h3>
        {onClose && (
          <button className="hcp-close-btn" onClick={onClose} aria-label="关闭" data-testid="hcp-close-btn">✕</button>
        )}
      </div>

      {/* 武将选择器 */}
      <div className="hcp-selectors">
        <select
          className="hcp-select"
          value={leftId}
          onChange={e => setLeftId(e.target.value)}
          data-testid="hcp-select-left"
        >
          {generals.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <span className="hcp-vs">VS</span>
        <select
          className="hcp-select"
          value={rightId}
          onChange={e => setRightId(e.target.value)}
          data-testid="hcp-select-right"
        >
          {generals.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* 武将信息栏 */}
      <div className="hcp-hero-info-row">
        {leftHero && (
          <div className="hcp-hero-card" data-testid="hcp-hero-left">
            <span className="hcp-hero-name" style={{ color: QUALITY_BORDER_COLORS[leftHero.quality] }}>
              {leftHero.name}
            </span>
            <span className="hcp-hero-meta">
              <span className="hcp-quality-badge" style={{ background: QUALITY_BORDER_COLORS[leftHero.quality] }}>
                {QUALITY_LABELS[leftHero.quality]}
              </span>
              <span className="hcp-hero-faction">{FACTION_LABELS[leftHero.faction]}</span>
              <span className="hcp-hero-level">Lv.{leftHero.level}</span>
            </span>
          </div>
        )}
        {rightHero && (
          <div className="hcp-hero-card" data-testid="hcp-hero-right">
            <span className="hcp-hero-name" style={{ color: QUALITY_BORDER_COLORS[rightHero.quality] }}>
              {rightHero.name}
            </span>
            <span className="hcp-hero-meta">
              <span className="hcp-quality-badge" style={{ background: QUALITY_BORDER_COLORS[rightHero.quality] }}>
                {QUALITY_LABELS[rightHero.quality]}
              </span>
              <span className="hcp-hero-faction">{FACTION_LABELS[rightHero.faction]}</span>
              <span className="hcp-hero-level">Lv.{rightHero.level}</span>
            </span>
          </div>
        )}
      </div>

      {/* 雷达图对比 */}
      {leftHero && rightHero && (
        <div className="hcp-radar-section" data-testid="hcp-radar-section">
          <div className="hcp-radar-wrap">
            <RadarChart stats={leftRadarStats} quality={leftHero.quality} statMax={statMax} />
          </div>
          <div className="hcp-radar-wrap">
            <RadarChart stats={rightRadarStats} quality={rightHero.quality} statMax={statMax} />
          </div>
        </div>
      )}

      {/* 属性条对比 */}
      {leftHero && rightHero && (
        <div className="hcp-stats-section" data-testid="hcp-stats-section">
          <h4 className="hcp-section-title">属性对比</h4>
          {STAT_KEYS.map(key => (
            <StatCompareRow
              key={key}
              label={STAT_LABELS[key]}
              leftVal={leftHero.baseStats[key]}
              rightVal={rightHero.baseStats[key]}
              color={STAT_COLORS[key]}
              max={statMax}
            />
          ))}
        </div>
      )}

      {/* 技能对比 */}
      {leftHero && rightHero && (
        <div className="hcp-skills-section" data-testid="hcp-skills-section">
          <h4 className="hcp-section-title">技能对比</h4>
          <div className="hcp-compare-cols">
            <div className="hcp-skill-col" data-testid="hcp-skills-left">
              {leftHero.skills.map(s => (
                <div key={s.id} className="hcp-skill-item" data-testid={`hcp-skill-left-${s.id}`}>
                  <span className="hcp-skill-name">{s.name}</span>
                  <span className="hcp-skill-type">{s.type}</span>
                </div>
              ))}
              {leftHero.skills.length === 0 && <span className="hcp-empty-text">暂无技能</span>}
            </div>
            <div className="hcp-skill-col" data-testid="hcp-skills-right">
              {rightHero.skills.map(s => (
                <div key={s.id} className="hcp-skill-item" data-testid={`hcp-skill-right-${s.id}`}>
                  <span className="hcp-skill-name">{s.name}</span>
                  <span className="hcp-skill-type">{s.type}</span>
                </div>
              ))}
              {rightHero.skills.length === 0 && <span className="hcp-empty-text">暂无技能</span>}
            </div>
          </div>
        </div>
      )}

      {/* 羁绊对比 */}
      {leftHero && rightHero && getBonds && (
        <div className="hcp-bonds-section" data-testid="hcp-bonds-section">
          <h4 className="hcp-section-title">羁绊对比</h4>
          <div className="hcp-compare-cols">
            <div className="hcp-bond-col" data-testid="hcp-bonds-left">
              {leftBonds.map(b => (
                <div key={b} className="hcp-bond-item" data-testid={`hcp-bond-left-${b}`}>{b}</div>
              ))}
              {leftBonds.length === 0 && <span className="hcp-empty-text">暂无羁绊</span>}
            </div>
            <div className="hcp-bond-col" data-testid="hcp-bonds-right">
              {rightBonds.map(b => (
                <div key={b} className="hcp-bond-item" data-testid={`hcp-bond-right-${b}`}>{b}</div>
              ))}
              {rightBonds.length === 0 && <span className="hcp-empty-text">暂无羁绊</span>}
            </div>
          </div>
        </div>
      )}

      {/* 战力对比 */}
      {leftHero && rightHero && (
        <div className="hcp-power-section" data-testid="hcp-power-section">
          <h4 className="hcp-section-title">战力对比</h4>
          <div className="hcp-power-row">
            <span className={`hcp-power-val ${leftPower > rightPower ? 'hcp-power-val--win' : ''}`} data-testid="hcp-power-left">
              ⚔️ {leftPower.toLocaleString('zh-CN')}
            </span>
            <span className="hcp-power-vs">VS</span>
            <span className={`hcp-power-val ${rightPower > leftPower ? 'hcp-power-val--win' : ''}`} data-testid="hcp-power-right">
              ⚔️ {rightPower.toLocaleString('zh-CN')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

HeroComparePanel.displayName = 'HeroComparePanel';
export default HeroComparePanel;
