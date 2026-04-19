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
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { GeneralData, Quality, Faction } from '@/games/three-kingdoms/engine';
import {
  QUALITY_LABELS,
  QUALITY_ORDER,
  QUALITY_TIERS,
} from '@/games/three-kingdoms/engine';
import { FACTION_LABELS, FACTIONS } from '@/games/three-kingdoms/engine/hero/hero.types';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import HeroCard from './HeroCard';
import HeroDetailModal from './HeroDetailModal';
import RecruitModal from './RecruitModal';
import './HeroTab.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface HeroTabProps {
  /** 引擎实例 */
  engine: ThreeKingdomsEngine;
  /** 快照版本（用于触发重渲染） */
  snapshotVersion: number;
}

// ─────────────────────────────────────────────
// 排序类型
// ─────────────────────────────────────────────
type SortKey = 'power' | 'level' | 'quality';

const SORT_LABELS: Record<SortKey, string> = {
  power: '战力',
  level: '等级',
  quality: '品质',
};

// ─────────────────────────────────────────────
// 阵营筛选选项（含"全部"）
// ─────────────────────────────────────────────
type FactionFilter = 'all' | Faction;

const FACTION_FILTER_OPTIONS: { value: FactionFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  ...FACTIONS.map((f) => ({ value: f, label: FACTION_LABELS[f] })),
];

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const HeroTab: React.FC<HeroTabProps> = ({ engine, snapshotVersion }) => {
  // ── 筛选/排序状态 ──
  const [factionFilter, setFactionFilter] = useState<FactionFilter>('all');
  const [qualityFilter, setQualityFilter] = useState<Quality | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('power');

  // ── 弹窗状态 ──
  const [selectedGeneral, setSelectedGeneral] = useState<GeneralData | null>(null);
  const [showRecruitModal, setShowRecruitModal] = useState(false);

  // ── 获取武将列表 ──
  const allGenerals = useMemo(() => {
    void snapshotVersion; // 作为依赖触发重渲染
    return engine.getGenerals();
  }, [engine, snapshotVersion]);

  // ── 筛选 + 排序 ──
  const filteredGenerals = useMemo(() => {
    let list = allGenerals;

    // 阵营筛选
    if (factionFilter !== 'all') {
      list = list.filter((g) => g.faction === factionFilter);
    }

    // 品质筛选
    if (qualityFilter !== 'all') {
      list = list.filter((g) => g.quality === qualityFilter);
    }

    // 排序
    const heroSystem = engine.getHeroSystem();
    const sorted = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'power': {
          const pa = heroSystem.calculatePower(a);
          const pb = heroSystem.calculatePower(b);
          return pb - pa; // 降序
        }
        case 'level':
          return b.level - a.level; // 降序
        case 'quality':
          return (QUALITY_ORDER[b.quality] ?? 0) - (QUALITY_ORDER[a.quality] ?? 0); // 降序
        default:
          return 0;
      }
    });

    return sorted;
  }, [allGenerals, factionFilter, qualityFilter, sortKey, engine]);

  // ── 总战力 ──
  const totalPower = useMemo(() => {
    const heroSystem = engine.getHeroSystem();
    return heroSystem.calculateTotalPower();
  }, [engine, allGenerals]);

  // ── 事件处理 ──
  const handleCardClick = useCallback((general: GeneralData) => {
    setSelectedGeneral(general);
  }, []);

  const handleDetailClose = useCallback(() => {
    setSelectedGeneral(null);
  }, []);

  const handleRecruitOpen = useCallback(() => {
    setShowRecruitModal(true);
  }, []);

  const handleRecruitClose = useCallback(() => {
    setShowRecruitModal(false);
  }, []);

  const handleRecruitComplete = useCallback(() => {
    // 触发重渲染（通过 snapshotVersion 机制自动处理）
  }, []);

  // ── 渲染 ──
  return (
    <div className="tk-hero-tab">
      {/* 顶部工具栏 */}
      <div className="tk-hero-toolbar">
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

        {/* 品质筛选 */}
        <select
          className="tk-hero-select"
          value={qualityFilter}
          onChange={(e) => setQualityFilter(e.target.value as Quality | 'all')}
        >
          <option value="all">全部品质</option>
          {QUALITY_TIERS.map((q) => (
            <option key={q} value={q}>{QUALITY_LABELS[q]}</option>
          ))}
        </select>

        {/* 排序 */}
        <select
          className="tk-hero-select"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          {Object.entries(SORT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}排序</option>
          ))}
        </select>

        {/* 右侧：战力 + 招募按钮 */}
        <div className="tk-hero-toolbar-right">
          <span className="tk-hero-total-power">
            ⚔️ 总战力 {totalPower.toLocaleString('zh-CN')}
          </span>
          <button className="tk-hero-recruit-btn" onClick={handleRecruitOpen}>
            🏛️ 招募
          </button>
        </div>
      </div>

      {/* 武将列表 */}
      {filteredGenerals.length === 0 ? (
        <div className="tk-hero-empty">
          <div className="tk-hero-empty-icon">⚔️</div>
          <div className="tk-hero-empty-text">暂无武将</div>
          <div className="tk-hero-empty-sub">招募天下英才，共图霸业</div>
          <button className="tk-hero-empty-btn" onClick={handleRecruitOpen}>
            前往招募
          </button>
        </div>
      ) : (
        <div className="tk-hero-grid">
          {filteredGenerals.map((general) => (
            <HeroCard
              key={general.id}
              general={general}
              engine={engine}
              onClick={handleCardClick}
            />
          ))}
        </div>
      )}

      {/* 底部信息栏 */}
      {filteredGenerals.length > 0 && (
        <div className="tk-hero-footer">
          <span className="tk-hero-count">
            武将总数: {allGenerals.length}
          </span>
        </div>
      )}

      {/* 武将详情弹窗 */}
      {selectedGeneral && (
        <HeroDetailModal
          general={selectedGeneral}
          engine={engine}
          onClose={handleDetailClose}
        />
      )}

      {/* 招募弹窗 */}
      {showRecruitModal && (
        <RecruitModal
          engine={engine}
          onClose={handleRecruitClose}
          onRecruitComplete={handleRecruitComplete}
        />
      )}
    </div>
  );
};

HeroTab.displayName = 'HeroTab';

export default HeroTab;
