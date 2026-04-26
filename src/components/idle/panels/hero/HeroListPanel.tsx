/**
 * HeroListPanel — 武将列表面板组件
 *
 * 功能：
 * - 武将网格列表（3列×N行）
 * - 每个武将卡片显示：头像+名字+品质色边框+等级+星级
 * - 筛选栏：全部/魏/蜀/吴/群雄
 * - 排序：等级/战力/品质/星级
 * - 搜索框（按名字搜索）
 * - 点击武将卡片打开详情
 * - 底部显示武将总数和各品质统计
 *
 * @module components/idle/panels/hero/HeroListPanel
 */

import React, { useState, useMemo, useCallback } from 'react';
import { HERO_QUALITY_COLORS, HERO_QUALITY_BG_COLORS } from '../../common/constants';
import './HeroListPanel.css';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface HeroListPanelProps {
  /** 武将列表数据 */
  heroes: Array<{
    id: string;
    name: string;
    quality: string;
    faction: string;
    level: number;
    star: number;
    power: number;
  }>;
  /** 点击武将卡片回调 */
  onSelectHero: (heroId: string) => void;
}

/** 筛选阵营 */
type FactionFilter = 'all' | 'wei' | 'shu' | 'wu' | 'qun';

/** 排序字段 */
type SortField = 'level' | 'power' | 'quality' | 'star';

// ─────────────────────────────────────────────
// 常量映射
// ─────────────────────────────────────────────
const FACTION_OPTIONS: Array<{ value: FactionFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'wei', label: '魏' },
  { value: 'shu', label: '蜀' },
  { value: 'wu', label: '吴' },
  { value: 'qun', label: '群雄' },
];

const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: 'level', label: '等级' },
  { value: 'power', label: '战力' },
  { value: 'quality', label: '品质' },
  { value: 'star', label: '星级' },
];

/** 品质排序权重 */
const QUALITY_WEIGHT: Record<string, number> = {
  LEGENDARY: 5,
  EPIC: 4,
  RARE: 3,
  FINE: 2,
  COMMON: 1,
};

/** 品质标签 */
const QUALITY_LABELS: Record<string, string> = {
  LEGENDARY: '传说',
  EPIC: '史诗',
  RARE: '稀有',
  FINE: '精良',
  COMMON: '普通',
};

/** 阵营图标 */
const FACTION_ICONS: Record<string, string> = {
  wei: '🔵',
  shu: '🔴',
  wu: '🟢',
  qun: '🟣',
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const HeroListPanel: React.FC<HeroListPanelProps> = ({ heroes, onSelectHero }) => {
  const [factionFilter, setFactionFilter] = useState<FactionFilter>('all');
  const [sortField, setSortField] = useState<SortField>('power');
  const [searchText, setSearchText] = useState('');

  // ── 筛选 + 排序 ──
  const filteredHeroes = useMemo(() => {
    let result = [...heroes];

    // 阵营筛选
    if (factionFilter !== 'all') {
      result = result.filter(h => h.faction === factionFilter);
    }

    // 名字搜索
    if (searchText.trim()) {
      const keyword = searchText.trim().toLowerCase();
      result = result.filter(h => h.name.toLowerCase().includes(keyword));
    }

    // 排序（降序）
    result.sort((a, b) => {
      switch (sortField) {
        case 'level': return b.level - a.level;
        case 'power': return b.power - a.power;
        case 'quality': return (QUALITY_WEIGHT[b.quality] ?? 0) - (QUALITY_WEIGHT[a.quality] ?? 0);
        case 'star': return b.star - a.star;
        default: return 0;
      }
    });

    return result;
  }, [heroes, factionFilter, sortField, searchText]);

  // ── 品质统计 ──
  const qualityStats = useMemo(() => {
    const stats: Record<string, number> = { LEGENDARY: 0, EPIC: 0, RARE: 0, FINE: 0, COMMON: 0 };
    heroes.forEach(h => {
      if (stats[h.quality] !== undefined) stats[h.quality]++;
    });
    return stats;
  }, [heroes]);

  const handleSelectHero = useCallback((heroId: string) => {
    onSelectHero(heroId);
  }, [onSelectHero]);

  // ── 渲染星级 ──
  const renderStars = (star: number) => {
    const elements: React.ReactNode[] = [];
    for (let i = 0; i < 5; i++) {
      elements.push(
        <span
          key={i}
          className={`tk-hero-list-star ${i < star ? 'tk-hero-list-star--filled' : 'tk-hero-list-star--empty'}`}
        >
          {i < star ? '★' : '☆'}
        </span>,
      );
    }
    return elements;
  };

  return (
    <div className="tk-hero-list-panel" role="region" aria-label="武将列表" data-testid="hero-list-panel">
      {/* ── 筛选栏 ── */}
      <div className="tk-hero-list-toolbar">
        {/* 阵营筛选 */}
        <div className="tk-hero-list-factions" role="tablist" aria-label="阵营筛选">
          {FACTION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`tk-hero-list-faction-btn ${factionFilter === opt.value ? 'tk-hero-list-faction-btn--active' : ''}`}
              onClick={() => setFactionFilter(opt.value)}
              role="tab"
              aria-selected={factionFilter === opt.value}
              data-testid={`faction-btn-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 搜索框 */}
        <div className="tk-hero-list-search">
          <input
            type="text"
            className="tk-hero-list-search-input"
            placeholder="搜索武将名字..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            aria-label="搜索武将"
            data-testid="hero-search-input"
          />
        </div>

        {/* 排序 */}
        <div className="tk-hero-list-sort">
          <select
            className="tk-hero-list-sort-select"
            value={sortField}
            onChange={e => setSortField(e.target.value as SortField)}
            aria-label="排序方式"
            data-testid="hero-sort-select"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── 武将网格 ── */}
      <div className="tk-hero-list-grid" data-testid="hero-list-grid">
        {filteredHeroes.length === 0 ? (
          <div className="tk-hero-list-empty" data-testid="hero-list-empty">
            暂无武将
          </div>
        ) : (
          filteredHeroes.map(hero => {
            const borderColor = HERO_QUALITY_COLORS[hero.quality] ?? '#9e9e9e';
            const bgColor = HERO_QUALITY_BG_COLORS[hero.quality] ?? 'rgba(158,158,158,0.15)';
            const qualityLabel = QUALITY_LABELS[hero.quality] ?? hero.quality;
            const factionIcon = FACTION_ICONS[hero.faction] ?? '';

            return (
              <div
                key={hero.id}
                className="tk-hero-list-card"
                style={{ borderColor, background: bgColor }}
                onClick={() => handleSelectHero(hero.id)}
                role="button"
                tabIndex={0}
                aria-label={`${hero.name} Lv.${hero.level}`}
                data-testid={`hero-list-card-${hero.id}`}
              >
                {/* 品质标签 */}
                <span
                  className="tk-hero-list-card-quality"
                  style={{ color: borderColor }}
                  data-testid={`hero-quality-${hero.id}`}
                >
                  {qualityLabel}
                </span>

                {/* 头像 */}
                <div className="tk-hero-list-card-portrait">
                  <span className="tk-hero-list-card-portrait-char">{hero.name.charAt(0)}</span>
                </div>

                {/* 名字 */}
                <div className="tk-hero-list-card-name" data-testid={`hero-name-${hero.id}`}>
                  {hero.name}
                </div>

                {/* 阵营 + 等级 */}
                <div className="tk-hero-list-card-meta">
                  <span className="tk-hero-list-card-faction">{factionIcon}</span>
                  <span className="tk-hero-list-card-level">Lv.{hero.level}</span>
                </div>

                {/* 星级 */}
                <div className="tk-hero-list-card-stars">
                  {renderStars(hero.star)}
                </div>

                {/* 战力 */}
                <div className="tk-hero-list-card-power">
                  ⚔️ {hero.power.toLocaleString()}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── 底部统计 ── */}
      <div className="tk-hero-list-footer" data-testid="hero-list-footer">
        <span className="tk-hero-list-total">
          共 <strong data-testid="hero-total-count">{heroes.length}</strong> 名武将
        </span>
        <div className="tk-hero-list-quality-stats">
          {Object.entries(qualityStats).map(([quality, count]) => (
            count > 0 && (
              <span
                key={quality}
                className="tk-hero-list-quality-stat"
                style={{ color: HERO_QUALITY_COLORS[quality] ?? '#9e9e9e' }}
                data-testid={`hero-stat-${quality}`}
              >
                {QUALITY_LABELS[quality]}×{count}
              </span>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

HeroListPanel.displayName = 'HeroListPanel';

export default HeroListPanel;
