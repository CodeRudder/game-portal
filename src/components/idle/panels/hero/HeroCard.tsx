/**
 * HeroCard — 武将卡片组件
 *
 * 显示：品质边框 + 头像占位 + 名字 + 等级 + 战力
 * 品质边框色：普通灰 / 精良蓝 / 稀有紫 / 史诗赤 / 传说金
 * 响应式：PC 端 160×180 卡片，手机端紧凑卡片
 */

import React, { useMemo } from 'react';
import type { GeneralData, Quality, Faction } from '@/games/three-kingdoms/engine';
import { QUALITY_LABELS, QUALITY_BORDER_COLORS, FACTION_LABELS } from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import { HERO_QUALITY_BG_COLORS } from '../../common/constants';
import { formatNumber } from '@/components/idle/utils/formatNumber';
import './HeroCard.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface HeroCardProps {
  /** 武将数据 */
  general: GeneralData;
  /** 引擎实例（用于计算战力） */
  engine: ThreeKingdomsEngine;
  /** 点击回调 */
  onClick?: (general: GeneralData) => void;
}

// ─────────────────────────────────────────────
// 阵营图标映射
// ─────────────────────────────────────────────
const FACTION_ICONS: Record<Faction, string> = {
  shu: '🔴',
  wei: '🔵',
  wu: '🟢',
  qun: '🟣',
};

// ─────────────────────────────────────────────
// 品质对应的头像背景渐变（使用统一常量）
// ─────────────────────────────────────────────
const QUALITY_BG: Record<Quality, string> = {
  COMMON: `linear-gradient(135deg, rgba(158,158,158,0.4) 0%, rgba(158,158,158,0.2) 100%)`,
  FINE: `linear-gradient(135deg, rgba(33,150,243,0.4) 0%, rgba(33,150,243,0.2) 100%)`,
  RARE: `linear-gradient(135deg, rgba(156,39,176,0.4) 0%, rgba(156,39,176,0.2) 100%)`,
  EPIC: `linear-gradient(135deg, rgba(244,67,54,0.4) 0%, rgba(244,67,54,0.2) 100%)`,
  LEGENDARY: `linear-gradient(135deg, rgba(255,152,0,0.4) 0%, rgba(255,152,0,0.2) 100%)`,
};

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────
function formatPower(n: number): string {
  return formatNumber(n);
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const HeroCard: React.FC<HeroCardProps> = ({ general, engine, onClick }) => {
  const power = useMemo(() => {
    try {
      return engine?.getHeroSystem?.()?.calculatePower?.(general) ?? 0;
    } catch {
      return 0;
    }
  }, [engine, general]);

  const borderColor = QUALITY_BORDER_COLORS[general.quality];
  const factionLabel = FACTION_LABELS[general.faction];
  const factionIcon = FACTION_ICONS[general.faction];
  const qualityLabel = QUALITY_LABELS[general.quality];

  const handleClick = () => {
    onClick?.(general);
  };

  return (
    <div
      className={`tk-hero-card tk-hero-card--${general.quality.toLowerCase()}`}
      style={{ borderColor }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${general.name} Lv.${general.level} 战力${power}`}
      data-testid={`hero-card-${general.id}`}
    >
      {/* 品质标签 — 左上角 */}
      <span className="tk-hero-card-quality" style={{ background: borderColor }}>
        {qualityLabel}
      </span>

      {/* 头像区 */}
      <div
        className="tk-hero-card-portrait"
        style={{ background: QUALITY_BG[general.quality] }}
      >
        <span className="tk-hero-card-portrait-char">
          {general.name.charAt(0)}
        </span>
      </div>

      {/* 名字 */}
      <div className="tk-hero-card-name">{general.name}</div>

      {/* 阵营 + 等级 */}
      <div className="tk-hero-card-meta">
        <span className="tk-hero-card-faction">
          {factionIcon}{factionLabel}
        </span>
        <span className="tk-hero-card-level">Lv.{general.level}</span>
      </div>

      {/* 战力 */}
      <div className="tk-hero-card-power">
        ⚔️ {formatPower(power)}
      </div>
    </div>
  );
};

HeroCard.displayName = 'HeroCard';

export default HeroCard;
