/**
 * HeroCompareModal — 武将对比弹窗
 *
 * 并排展示两个武将的属性条，高亮差异属性
 */

import React, { useMemo, useState, useEffect } from 'react';
import type { GeneralData, Quality } from '@/games/three-kingdoms/engine';
import { QUALITY_LABELS, QUALITY_BORDER_COLORS, FACTION_LABELS } from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import './HeroCompareModal.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface HeroCompareModalProps {
  /** 基准武将 */
  baseGeneral: GeneralData;
  /** 引擎实例 */
  engine: ThreeKingdomsEngine;
  /** 关闭回调 */
  onClose: () => void;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────
const STAT_KEYS = ['attack', 'defense', 'intelligence', 'speed'] as const;
const STAT_LABELS: Record<string, string> = {
  attack: '武力', defense: '统率', intelligence: '智力', speed: '政治',
};
const STAT_COLORS: Record<string, string> = {
  attack: '#E53935', defense: '#1E88E5', intelligence: '#AB47BC', speed: '#43A047',
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const HeroCompareModal: React.FC<HeroCompareModalProps> = ({
  baseGeneral,
  engine,
  onClose,
}) => {
  // ── ESC 键关闭 ──
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const heroSystem = engine.getHeroSystem();
  const allGenerals = engine.getGenerals().filter((g) => g.id !== baseGeneral.id);

  const [selectedId, setSelectedId] = useState<string | null>(
    allGenerals.length > 0 ? allGenerals[0].id : null,
  );

  const compareGeneral = useMemo(() => {
    if (!selectedId) return null;
    return heroSystem.getGeneral(selectedId) ?? null;
  }, [heroSystem, selectedId]);

  // 计算属性最大值
  const statMax = useMemo(() => {
    if (!compareGeneral) return computeStatMax(baseGeneral.baseStats);
    return computeStatMax({
      attack: Math.max(baseGeneral.baseStats.attack, compareGeneral.baseStats.attack),
      defense: Math.max(baseGeneral.baseStats.defense, compareGeneral.baseStats.defense),
      intelligence: Math.max(baseGeneral.baseStats.intelligence, compareGeneral.baseStats.intelligence),
      speed: Math.max(baseGeneral.baseStats.speed, compareGeneral.baseStats.speed),
    });
  }, [baseGeneral, compareGeneral]);

  // 战力
  const basePower = heroSystem.calculatePower(baseGeneral);
  const comparePower = compareGeneral ? heroSystem.calculatePower(compareGeneral) : 0;

  return (
    <div className="tk-compare-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tk-compare-modal" role="dialog" aria-modal="true" aria-label="武将对比">
        <button className="tk-compare-close" onClick={onClose} aria-label="关闭">✕</button>

        <h3 className="tk-compare-title">⚔️ 武将对比</h3>

        {/* 武将选择 */}
        <div className="tk-compare-selector">
          <span className="tk-compare-selector-label">选择对比武将：</span>
          <select
            className="tk-compare-select"
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(e.target.value || null)}
          >
            <option value="">-- 选择武将 --</option>
            {allGenerals.map((g) => (
              <option key={g.id} value={g.id}>{g.name} (Lv.{g.level})</option>
            ))}
          </select>
        </div>

        {/* 并排对比 */}
        <div className="tk-compare-content">
          {/* 基准武将信息 */}
          <div className="tk-compare-hero tk-compare-hero--base">
            <div className="tk-compare-hero-name" style={{ color: QUALITY_BORDER_COLORS[baseGeneral.quality] }}>
              {baseGeneral.name}
            </div>
            <div className="tk-compare-hero-meta">
              <span style={{ background: QUALITY_BORDER_COLORS[baseGeneral.quality] }} className="tk-compare-quality-badge">
                {QUALITY_LABELS[baseGeneral.quality]}
              </span>
              <span className="tk-compare-hero-faction">{FACTION_LABELS[baseGeneral.faction]}</span>
              <span className="tk-compare-hero-level">Lv.{baseGeneral.level}</span>
            </div>
            <div className="tk-compare-hero-power">⚔️ {basePower.toLocaleString('zh-CN')}</div>
          </div>

          {/* VS */}
          <div className="tk-compare-vs">VS</div>

          {/* 对比武将信息 */}
          <div className="tk-compare-hero tk-compare-hero--compare">
            {compareGeneral ? (
              <>
                <div className="tk-compare-hero-name" style={{ color: QUALITY_BORDER_COLORS[compareGeneral.quality] }}>
                  {compareGeneral.name}
                </div>
                <div className="tk-compare-hero-meta">
                  <span style={{ background: QUALITY_BORDER_COLORS[compareGeneral.quality] }} className="tk-compare-quality-badge">
                    {QUALITY_LABELS[compareGeneral.quality]}
                  </span>
                  <span className="tk-compare-hero-faction">{FACTION_LABELS[compareGeneral.faction]}</span>
                  <span className="tk-compare-hero-level">Lv.{compareGeneral.level}</span>
                </div>
                <div className="tk-compare-hero-power">⚔️ {comparePower.toLocaleString('zh-CN')}</div>
              </>
            ) : (
              <div className="tk-compare-hero-empty">请选择武将</div>
            )}
          </div>
        </div>

        {/* 属性对比条 */}
        {compareGeneral && (
          <div className="tk-compare-stats">
            <h4 className="tk-compare-stats-title">属性对比</h4>
            {STAT_KEYS.map((key) => {
              const baseVal = baseGeneral.baseStats[key];
              const compVal = compareGeneral.baseStats[key];
              const diff = baseVal - compVal;
              const basePct = Math.min(100, Math.floor((baseVal / statMax) * 100));
              const compPct = Math.min(100, Math.floor((compVal / statMax) * 100));
              const isWin = diff > 0;
              const isLose = diff < 0;

              return (
                <div key={key} className="tk-compare-stat-row">
                  <div className="tk-compare-stat-label">{STAT_LABELS[key]}</div>

                  <div className="tk-compare-stat-bars">
                    {/* 基准武将属性条（右对齐） */}
                    <div className="tk-compare-stat-side tk-compare-stat-side--base">
                      <span className={`tk-compare-stat-value ${isWin ? 'tk-compare-stat-value--win' : ''}`}>
                        {baseVal}
                      </span>
                      <div className="tk-compare-stat-bar tk-compare-stat-bar--right">
                        <div
                          className="tk-compare-stat-fill"
                          style={{ width: `${basePct}%`, background: STAT_COLORS[key] }}
                        />
                      </div>
                    </div>

                    {/* 差值 */}
                    <div className={`tk-compare-stat-diff ${isWin ? 'tk-compare-stat-diff--win' : isLose ? 'tk-compare-stat-diff--lose' : ''}`}>
                      {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '='}
                    </div>

                    {/* 对比武将属性条（左对齐） */}
                    <div className="tk-compare-stat-side tk-compare-stat-side--compare">
                      <div className="tk-compare-stat-bar tk-compare-stat-bar--left">
                        <div
                          className="tk-compare-stat-fill"
                          style={{ width: `${compPct}%`, background: STAT_COLORS[key] }}
                        />
                      </div>
                      <span className={`tk-compare-stat-value ${isLose ? 'tk-compare-stat-value--win' : ''}`}>
                        {compVal}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 战力对比 */}
            <div className="tk-compare-power-row">
              <span className="tk-compare-power-label">总战力</span>
              <span className={`tk-compare-power-value ${basePower > comparePower ? 'tk-compare-stat-value--win' : ''}`}>
                {basePower.toLocaleString('zh-CN')}
              </span>
              <span className="tk-compare-power-vs">VS</span>
              <span className={`tk-compare-power-value ${comparePower > basePower ? 'tk-compare-stat-value--win' : ''}`}>
                {comparePower.toLocaleString('zh-CN')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** 计算属性上限 */
function computeStatMax(stats: { attack: number; defense: number; intelligence: number; speed: number }): number {
  const maxVal = Math.max(stats.attack, stats.defense, stats.intelligence, stats.speed);
  return Math.ceil(maxVal * 1.2 / 10) * 10;
}

HeroCompareModal.displayName = 'HeroCompareModal';

export default HeroCompareModal;
