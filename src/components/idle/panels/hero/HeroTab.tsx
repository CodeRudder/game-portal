/**
 * HeroTab — 武将Tab主面板
 *
 * 功能：
 * - 武将列表（PC端4列网格，手机端2列）
 * - 筛选：按品质、按阵营
 * - 排序：按战力、按等级、按品质
 * - 招募入口按钮
 * - 空列表时显示招募引导
 * - 点击武将卡片打开详情弹窗
 * - 新手引导（GuideOverlay）
 * - 武将对比（HeroCompareModal）
 * - 编队管理（FormationPanel）
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { GeneralData, Quality, Faction } from '@/games/three-kingdoms/engine';
import {
  QUALITY_LABELS,
  QUALITY_ORDER,
  QUALITY_TIERS,
  FACTION_LABELS,
  FACTIONS,
} from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import HeroCard from './HeroCard';
import HeroDetailModal from './HeroDetailModal';
import RecruitModal from './RecruitModal';
import GuideOverlay from './GuideOverlay';
import HeroCompareModal from './HeroCompareModal';
import FormationPanel from './FormationPanel';
import './HeroTab.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface HeroTabProps {
  engine: ThreeKingdomsEngine;
  snapshotVersion: number;
}

// ─────────────────────────────────────────────
// 排序 & 筛选类型
// ─────────────────────────────────────────────
type SortKey = 'power' | 'level' | 'quality';
type FactionFilter = 'all' | Faction;
type SubTab = 'list' | 'formation';

const SORT_LABELS: Record<SortKey, string> = {
  power: '战力', level: '等级', quality: '品质',
};

const FACTION_FILTER_OPTIONS: { value: FactionFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  ...FACTIONS.map((f) => ({ value: f, label: FACTION_LABELS[f] })),
];

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const HeroTab: React.FC<HeroTabProps> = ({ engine, snapshotVersion }) => {
  // ── 子Tab ──
  const [subTab, setSubTab] = useState<SubTab>('list');

  // ── 筛选/排序状态 ──
  const [factionFilter, setFactionFilter] = useState<FactionFilter>('all');
  const [qualityFilter, setQualityFilter] = useState<Quality | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('power');

  // ── 弹窗状态 ──
  const [selectedGeneral, setSelectedGeneral] = useState<GeneralData | null>(null);
  const [showRecruitModal, setShowRecruitModal] = useState(false);
  const [compareGeneral, setCompareGeneral] = useState<GeneralData | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  // ── 引导状态 ──
  const [showGuide, setShowGuide] = useState(() => {
    try {
      const raw = localStorage.getItem('tk-guide-progress');
      if (raw) {
        const data = JSON.parse(raw);
        return !data.completed;
      }
    } catch { /* ignore */ }
    return true;
  });

  // ── 获取武将列表 ──
  const allGenerals = useMemo(() => {
    void snapshotVersion;
    try {
      return engine?.getGenerals?.() ?? [];
    } catch {
      return [];
    }
  }, [engine, snapshotVersion]);

  // ── 筛选 + 排序 ──
  const filteredGenerals = useMemo(() => {
    let list = allGenerals;
    if (factionFilter !== 'all') list = list.filter((g) => g.faction === factionFilter);
    if (qualityFilter !== 'all') list = list.filter((g) => g.quality === qualityFilter);

    const heroSystem = engine.getHeroSystem();
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'power': return heroSystem.calculatePower(b) - heroSystem.calculatePower(a);
        case 'level': return b.level - a.level;
        case 'quality': return (QUALITY_ORDER[b.quality] ?? 0) - (QUALITY_ORDER[a.quality] ?? 0);
        default: return 0;
      }
    });
  }, [allGenerals, factionFilter, qualityFilter, sortKey, engine]);

  // ── 总战力 ──
  const totalPower = useMemo(() => engine.getHeroSystem().calculateTotalPower(), [engine, allGenerals]);

  // ── 事件处理 ──
  const handleCardClick = useCallback((general: GeneralData) => setSelectedGeneral(general), []);

  const handleDetailClose = useCallback(() => setSelectedGeneral(null), []);

  const handleEnhanceComplete = useCallback(() => {
    if (selectedGeneral) {
      const updated = engine.getGeneral(selectedGeneral.id);
      if (updated) setSelectedGeneral({ ...updated } as any);
    }
  }, [engine, selectedGeneral]);

  const handleRecruitOpen = useCallback(() => setShowRecruitModal(true), []);
  const handleRecruitClose = useCallback(() => setShowRecruitModal(false), []);
  const handleRecruitComplete = useCallback(() => { /* snapshotVersion handles refresh */ }, []);

  const handleCompareOpen = useCallback((general: GeneralData) => setCompareGeneral(general), []);
  const handleCompareClose = useCallback(() => { setCompareGeneral(null); setShowCompare(false); }, []);
  const handleCompareToggle = useCallback(() => setShowCompare((v) => !v), []);

  const handleGuideComplete = useCallback(() => setShowGuide(false), []);
  const handleGuideSkip = useCallback(() => setShowGuide(false), []);

  // ── 渲染 ──
  return (
    <div className="tk-hero-tab">
      {/* 顶部工具栏 */}
      <div className="tk-hero-toolbar">
        {/* 子Tab切换 */}
        <div className="tk-hero-sub-tabs">
          <button
            className={`tk-hero-sub-tab ${subTab === 'list' ? 'tk-hero-sub-tab--active' : ''}`}
            onClick={() => setSubTab('list')}
          >
            武将
          </button>
          <button
            className={`tk-hero-sub-tab ${subTab === 'formation' ? 'tk-hero-sub-tab--active' : ''}`}
            onClick={() => setSubTab('formation')}
          >
            编队
          </button>
        </div>

        {subTab === 'list' && (
          <>
            {/* 阵营筛选 */}
            <div className="tk-hero-filter-group">
              {FACTION_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`tk-hero-filter-btn ${factionFilter === opt.value ? 'tk-hero-filter-btn--active' : ''}`}
                  onClick={() => setFactionFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <select className="tk-hero-select" value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value as Quality | 'all')}>
              <option value="all">全部品质</option>
              {QUALITY_TIERS.map((q) => <option key={q} value={q}>{QUALITY_LABELS[q]}</option>)}
            </select>

            <select className="tk-hero-select" value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}>
              {Object.entries(SORT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}排序</option>
              ))}
            </select>
          </>
        )}

        {/* 右侧：战力 + 按钮 */}
        <div className="tk-hero-toolbar-right">
          <span className="tk-hero-total-power">⚔️ 总战力 {totalPower.toLocaleString('zh-CN')}</span>
          {subTab === 'list' && allGenerals.length > 0 && (
            <button className="tk-hero-compare-btn" onClick={() => {
              if (filteredGenerals.length > 0) handleCompareOpen(filteredGenerals[0] as GeneralData);
            }}>
              ⚖️ 对比
            </button>
          )}
          <button className="tk-hero-recruit-btn" onClick={handleRecruitOpen}>🏛️ 招募</button>
        </div>
      </div>

      {/* 内容区域 */}
      {subTab === 'list' ? (
        <>
          {filteredGenerals.length === 0 && allGenerals.length === 0 ? (
            <div className="tk-hero-empty">
              <div className="tk-hero-empty-icon">⚔️</div>
              <div className="tk-hero-empty-text">尚无武将入麾下</div>
              <div className="tk-hero-empty-sub">点击「前往招募」招揽天下英才</div>
              <button className="tk-hero-empty-btn" onClick={handleRecruitOpen}>前往招募</button>
            </div>
          ) : filteredGenerals.length === 0 ? (
            <div className="tk-hero-empty">
              <div className="tk-hero-empty-icon">🔍</div>
              <div className="tk-hero-empty-text">当前筛选无结果</div>
              <div className="tk-hero-empty-sub">试试调整筛选条件</div>
            </div>
          ) : (
            <>
              {allGenerals.length >= 2 && (
                <button className="tk-hero-compare-entry" onClick={handleCompareToggle}>
                  ⚔️ 武将对比
                </button>
              )}
              <div className="tk-hero-grid">
              {filteredGenerals.map((general) => (
                <HeroCard key={general.id} general={general} engine={engine} onClick={handleCardClick} />
              ))}
            </div>
            </>
          )}

          {filteredGenerals.length > 0 && (
            <div className="tk-hero-footer">
              <span className="tk-hero-count">武将总数: {allGenerals.length}</span>
            </div>
          )}
        </>
      ) : (
        <FormationPanel engine={engine} snapshotVersion={snapshotVersion} />
      )}

      {/* 新手引导 — 对接引擎 TutorialStateMachine */}
      {showGuide && subTab === 'list' && (
        <GuideOverlay engine={engine} onComplete={handleGuideComplete} onSkip={handleGuideSkip} />
      )}

      {/* 武将详情弹窗 */}
      {selectedGeneral && (
        <HeroDetailModal general={selectedGeneral} engine={engine}
          onClose={handleDetailClose} onEnhanceComplete={handleEnhanceComplete}
          onCompare={(g) => { setSelectedGeneral(null); handleCompareOpen(g); }} />
      )}

      {/* 招募弹窗 */}
      {showRecruitModal && (
        <RecruitModal engine={engine} onClose={handleRecruitClose} onRecruitComplete={handleRecruitComplete} />
      )}

      {/* 武将对比弹窗 */}
      {(showCompare || compareGeneral) && allGenerals.length >= 2 && (
        <HeroCompareModal
          baseGeneral={compareGeneral ?? (filteredGenerals[0] as GeneralData)}
          engine={engine}
          onClose={handleCompareClose}
        />
      )}
    </div>
  );
};

HeroTab.displayName = 'HeroTab';

export default HeroTab;
