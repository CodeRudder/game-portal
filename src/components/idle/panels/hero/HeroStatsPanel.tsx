/**
 * HeroStatsPanel — 武将详情属性面板
 *
 * 展示武将完整信息：
 * - 头像 + 名字 + 品质标签 + 阵营标签
 * - 四维属性条（攻击/防御/策略/速度）带数值和百分比条
 * - 等级和经验条
 * - 星级显示（1~6星）
 * - 突破状态指示器（4个节点）
 * - 羁绊标签列表（该武将参与的羁绊）
 */

import React from 'react';
import { QualityBadge, StarDisplay } from './atoms';
import './HeroStatsPanel.css';

// ─────────────────────────────────────────────
// Props 接口
// ─────────────────────────────────────────────
export interface HeroStatsPanelProps {
  hero: {
    id: string;
    name: string;
    quality: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    faction: 'wei' | 'shu' | 'wu' | 'neutral';
    level: number;
    maxLevel: number;
    star: number;
    breakthrough: number; // 0~4
    stats: { attack: number; defense: number; strategy: number; speed: number };
    bonds: { id: string; name: string; isActive: boolean }[];
  };
}

// ─────────────────────────────────────────────
// 常量映射
// ─────────────────────────────────────────────

/** 阵营中文名 */
const FACTION_LABELS: Record<string, string> = {
  wei: '魏',
  shu: '蜀',
  wu: '吴',
  neutral: '群',
};

/** 阵营图标 */
const FACTION_ICONS: Record<string, string> = {
  wei: '🔵',
  shu: '🔴',
  wu: '🟢',
  neutral: '🟣',
};

/** 品质色映射 */
const QUALITY_COLORS: Record<string, string> = {
  COMMON: '#9e9e9e',
  UNCOMMON: '#4caf50',
  RARE: '#2196f3',
  EPIC: '#9c27b0',
  LEGENDARY: '#ffc107',
};

/** 属性配置 */
const STAT_CONFIG = [
  { key: 'attack' as const, label: '攻击', color: '#EF4444' },
  { key: 'defense' as const, label: '防御', color: '#3B82F6' },
  { key: 'strategy' as const, label: '策略', color: '#9C27B0' },
  { key: 'speed' as const, label: '速度', color: '#EAB308' },
];

/** 属性最大值（用于百分比计算） */
const STAT_MAX = 200;

/** 突破节点总数 */
const BREAKTHROUGH_NODES = 4;

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const HeroStatsPanel: React.FC<HeroStatsPanelProps> = ({ hero }) => {
  const qualityColor = QUALITY_COLORS[hero.quality] ?? '#9e9e9e';
  const factionLabel = FACTION_LABELS[hero.faction] ?? '未知';
  const factionIcon = FACTION_ICONS[hero.faction] ?? '⚪';

  // 经验百分比（简化：用 level/maxLevel 近似）
  const expPercent = hero.maxLevel > 0
    ? Math.min(100, (hero.level / hero.maxLevel) * 100)
    : 0;

  return (
    <div
      className="tk-hero-stats-panel"
      data-testid={`hero-stats-panel-${hero.id}`}
    >
      {/* ── 头部：头像 + 名字 + 标签 ── */}
      <div className="tk-hero-stats-header">
        <div
          className="tk-hero-stats-avatar"
          style={{ borderColor: qualityColor }}
        >
          <span className="tk-hero-stats-avatar-char">{hero.name.charAt(0)}</span>
        </div>
        <div className="tk-hero-stats-info">
          <div className="tk-hero-stats-name-row">
            <span className="tk-hero-stats-name">{hero.name}</span>
            <QualityBadge quality={hero.quality} size="small" />
          </div>
          <div className="tk-hero-stats-tags">
            <span className="tk-hero-stats-faction-tag">
              {factionIcon} {factionLabel}
            </span>
          </div>
        </div>
      </div>

      {/* ── 等级 + 经验条 ── */}
      <div className="tk-hero-stats-level-section">
        <div className="tk-hero-stats-level-row">
          <span className="tk-hero-stats-level-label">等级</span>
          <span className="tk-hero-stats-level-value">
            Lv.{hero.level} / {hero.maxLevel}
          </span>
        </div>
        <div className="tk-hero-stats-exp-track">
          <div
            className="tk-hero-stats-exp-fill"
            style={{ width: `${expPercent}%` }}
            role="progressbar"
            aria-valuenow={hero.level}
            aria-valuemin={0}
            aria-valuemax={hero.maxLevel}
            aria-label="经验进度"
          />
        </div>
      </div>

      {/* ── 星级 ── */}
      <div className="tk-hero-stats-star-section">
        <span className="tk-hero-stats-section-label">星级</span>
        <StarDisplay stars={hero.star} maxStars={6} size="normal" />
      </div>

      {/* ── 突破状态 ── */}
      <div className="tk-hero-stats-breakthrough-section">
        <span className="tk-hero-stats-section-label">突破</span>
        <div className="tk-hero-stats-breakthrough-nodes" data-testid="breakthrough-nodes">
          {Array.from({ length: BREAKTHROUGH_NODES }, (_, i) => (
            <span
              key={i}
              className={`tk-hero-stats-bt-node ${i < hero.breakthrough ? 'tk-hero-stats-bt-node--active' : ''}`}
              data-testid={`bt-node-${i}`}
            />
          ))}
        </div>
      </div>

      {/* ── 四维属性 ── */}
      <div className="tk-hero-stats-attrs-section">
        <span className="tk-hero-stats-section-label">属性</span>
        {STAT_CONFIG.map(({ key, label, color }) => {
          const value = hero.stats[key];
          const percent = Math.min(100, (value / STAT_MAX) * 100);
          return (
            <div key={key} className="tk-hero-stats-attr-row" data-testid={`stat-${key}`}>
              <span className="tk-hero-stats-attr-name">{label}</span>
              <div className="tk-hero-stats-attr-bar-track">
                <div
                  className="tk-hero-stats-attr-bar-fill"
                  style={{ width: `${percent}%`, backgroundColor: color }}
                />
              </div>
              <span className="tk-hero-stats-attr-value">{value}</span>
            </div>
          );
        })}
      </div>

      {/* ── 羁绊列表 ── */}
      {hero.bonds.length > 0 && (
        <div className="tk-hero-stats-bonds-section">
          <span className="tk-hero-stats-section-label">羁绊</span>
          <div className="tk-hero-stats-bonds-list">
            {hero.bonds.map((bond) => (
              <span
                key={bond.id}
                className={`tk-hero-stats-bond-tag ${bond.isActive ? 'tk-hero-stats-bond-tag--active' : ''}`}
                data-testid={`bond-tag-${bond.id}`}
              >
                {bond.isActive ? '🔗' : '🔓'} {bond.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

HeroStatsPanel.displayName = 'HeroStatsPanel';

export default HeroStatsPanel;
