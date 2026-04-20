/**
 * 三国霸业 — 武将详情弹窗
 *
 * 显示武将的完整信息：
 *   - 基础信息（名称/品质/阵营/等级/经验）
 *   - 四维属性（攻击/防御/智力/速度）+ 属性条
 *   - 技能列表
 *   - 传记描述
 *
 * @module ui/components/HeroDetailModal
 */

import { useMemo } from 'react';
import type { GeneralData, Quality } from '../../engine/hero/hero.types';
import { QUALITY_LABELS, QUALITY_BORDER_COLORS, FACTION_LABELS } from '../../engine/hero/hero.types';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface HeroDetailModalProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 武将数据 */
  hero: GeneralData | null;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 属性最大参考值（用于计算属性条宽度） */
const STAT_MAX = 200;

/** 属性配置 */
const STAT_CONFIG = [
  { key: 'attack' as const, label: '攻击', icon: '⚔️', color: '#B8423A' },
  { key: 'defense' as const, label: '防御', icon: '🛡️', color: '#5B9BD5' },
  { key: 'intelligence' as const, label: '智力', icon: '📖', color: '#9B6DBF' },
  { key: 'speed' as const, label: '速度', icon: '💨', color: '#7EC850' },
];

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * HeroDetailModal — 武将详情弹窗
 *
 * @example
 * ```tsx
 * <HeroDetailModal isOpen={!!hero} onClose={() => setHero(null)} hero={hero} />
 * ```
 */
export function HeroDetailModal({ isOpen, onClose, hero }: HeroDetailModalProps) {
  if (!isOpen || !hero) return null;

  const borderColor = QUALITY_BORDER_COLORS[hero.quality];
  const qualityLabel = QUALITY_LABELS[hero.quality];

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        style={{ ...styles.modal, borderColor }}
        role="dialog"
        aria-modal="true"
        aria-label={`${hero.name}详情`}
      >
        {/* 头部 */}
        <div style={styles.header}>
          <div style={styles.headerInfo}>
            <span style={{ ...styles.quality, color: borderColor }}>{qualityLabel}</span>
            <span style={styles.name}>{hero.name}</span>
            <span style={styles.faction}>{FACTION_LABELS[hero.faction]}</span>
          </div>
          <button style={styles.closeBtn} onClick={onClose} aria-label="关闭">✕</button>
        </div>

        {/* 等级 + 经验 */}
        <div style={styles.levelRow}>
          <span style={styles.level}>Lv.{hero.level}</span>
          <div style={styles.expBarBg}>
            <div style={{ ...styles.expBarFill, width: `${Math.min(hero.exp, 100)}%` }} />
          </div>
          <span style={styles.expText}>{hero.exp}%</span>
        </div>

        {/* 四维属性 */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>属性</div>
          {STAT_CONFIG.map((cfg) => {
            const val = hero.baseStats[cfg.key];
            const pct = Math.min((val / STAT_MAX) * 100, 100);
            return (
              <div key={cfg.key} style={styles.statRow}>
                <span style={styles.statIcon}>{cfg.icon}</span>
                <span style={styles.statLabel}>{cfg.label}</span>
                <div style={styles.statBarBg}>
                  <div style={{ ...styles.statBarFill, width: `${pct}%`, backgroundColor: cfg.color }} />
                </div>
                <span style={styles.statValue}>{val}</span>
              </div>
            );
          })}
        </div>

        {/* 技能列表 */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>技能</div>
          {hero.skills.length === 0 ? (
            <div style={styles.empty}>暂无技能</div>
          ) : (
            hero.skills.map((skill) => (
              <div key={skill.id} style={styles.skillItem}>
                <div style={styles.skillHeader}>
                  <span style={styles.skillName}>{skill.name}</span>
                  <span style={styles.skillLevel}>Lv.{skill.level}</span>
                </div>
                <div style={styles.skillDesc}>{skill.description}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    background: 'rgba(13, 17, 23, 0.98)',
    border: '2px solid',
    borderRadius: '12px',
    width: '420px',
    maxWidth: '90vw',
    maxHeight: '80vh',
    overflowY: 'auto',
    padding: '16px',
    color: '#e8e0d0',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  quality: {
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: '3px',
    background: 'rgba(255,255,255,0.05)',
  },
  name: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#e8e0d0',
  },
  faction: {
    fontSize: '12px',
    color: '#a0a0a0',
  },
  closeBtn: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: '#a0a0a0',
    fontSize: '14px',
    cursor: 'pointer',
  },
  levelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  level: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#d4a574',
    whiteSpace: 'nowrap',
  },
  expBarBg: {
    flex: 1,
    height: '6px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  expBarFill: {
    height: '100%',
    background: '#d4a574',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  expText: {
    fontSize: '11px',
    color: '#a0a0a0',
    whiteSpace: 'nowrap',
  },
  section: {
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '8px',
    paddingBottom: '4px',
    borderBottom: '1px solid rgba(212,165,116,0.2)',
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '6px',
  },
  statIcon: {
    fontSize: '14px',
    width: '20px',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: '12px',
    color: '#a0a0a0',
    width: '36px',
  },
  statBarBg: {
    flex: 1,
    height: '8px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  statValue: {
    fontSize: '13px',
    fontWeight: 600,
    width: '32px',
    textAlign: 'right',
  },
  empty: {
    padding: '12px',
    textAlign: 'center',
    color: '#a0a0a0',
    fontSize: '12px',
  },
  skillItem: {
    padding: '8px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '6px',
    marginBottom: '6px',
  },
  skillHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  skillName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e8e0d0',
  },
  skillLevel: {
    fontSize: '11px',
    color: '#d4a574',
  },
  skillDesc: {
    fontSize: '11px',
    color: '#a0a0a0',
    lineHeight: 1.4,
  },
};
