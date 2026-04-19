/**
 * HeroDetailModal — 武将详情弹窗
 *
 * 布局：左侧画像+品质+等级，右侧属性条+技能列表
 * PC端：800×700 弹窗
 * 手机端：全屏详情
 */

import React, { useMemo } from 'react';
import type { GeneralData, Quality } from '@/games/three-kingdoms/engine';
import {
  QUALITY_LABELS,
  QUALITY_BORDER_COLORS,
} from '@/games/three-kingdoms/engine';
import { FACTION_LABELS } from '@/games/three-kingdoms/engine/hero/hero.types';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import './HeroDetailModal.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface HeroDetailModalProps {
  /** 武将数据 */
  general: GeneralData;
  /** 引擎实例 */
  engine: ThreeKingdomsEngine;
  /** 关闭回调 */
  onClose: () => void;
}

// ─────────────────────────────────────────────
// 属性条标签映射
// ─────────────────────────────────────────────
const STAT_LABELS: Record<string, string> = {
  attack: '武力',
  defense: '统率',
  intelligence: '智力',
  speed: '政治',
};

const STAT_COLORS: Record<string, string> = {
  attack: '#E53935',
  defense: '#1E88E5',
  intelligence: '#AB47BC',
  speed: '#43A047',
};

// ─────────────────────────────────────────────
// 品质对应的头像背景渐变
// ─────────────────────────────────────────────
const QUALITY_BG: Record<Quality, string> = {
  COMMON: 'linear-gradient(135deg, #555 0%, #777 100%)',
  FINE: 'linear-gradient(135deg, #2a5298 0%, #5B8BD4 100%)',
  RARE: 'linear-gradient(135deg, #6a1b9a 0%, #9B6DBF 100%)',
  EPIC: 'linear-gradient(135deg, #b71c1c 0%, #D4553A 100%)',
  LEGENDARY: 'linear-gradient(135deg, #8B6914 0%, #C9A84C 100%)',
};

/** 属性条最大值（用于百分比计算） */
const STAT_MAX = 150;

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const HeroDetailModal: React.FC<HeroDetailModalProps> = ({ general, engine, onClose }) => {
  const heroSystem = engine.getHeroSystem();
  const levelSystem = engine.getLevelSystem();

  const power = useMemo(
    () => heroSystem.calculatePower(general),
    [heroSystem, general],
  );

  const expProgress = useMemo(
    () => levelSystem.getExpProgress(general.id),
    [levelSystem, general.id],
  );

  const fragments = useMemo(
    () => heroSystem.getFragments(general.id),
    [heroSystem, general.id],
  );

  const borderColor = QUALITY_BORDER_COLORS[general.quality];
  const qualityLabel = QUALITY_LABELS[general.quality];
  const factionLabel = FACTION_LABELS[general.faction];

  // 属性列表
  const stats = useMemo(() => {
    const { baseStats } = general;
    return (['attack', 'defense', 'intelligence', 'speed'] as const).map((key) => ({
      key,
      label: STAT_LABELS[key],
      value: baseStats[key],
      color: STAT_COLORS[key],
      percentage: Math.min(100, Math.floor((baseStats[key] / STAT_MAX) * 100)),
    }));
  }, [general]);

  return (
    <div className="tk-hero-detail-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tk-hero-detail-modal" role="dialog" aria-modal="true" aria-label={`${general.name} 详情`}>
        {/* 关闭按钮 */}
        <button className="tk-hero-detail-close" onClick={onClose} aria-label="关闭">✕</button>

        {/* 标题栏 */}
        <div className="tk-hero-detail-header" style={{ borderBottomColor: borderColor }}>
          <span className="tk-hero-detail-title-name">{general.name}</span>
          <span className="tk-hero-detail-title-faction">{factionLabel}</span>
          <span
            className="tk-hero-detail-title-quality"
            style={{ background: borderColor }}
          >
            {qualityLabel}
          </span>
        </div>

        {/* 主体：左右分栏 */}
        <div className="tk-hero-detail-body">
          {/* 左侧：画像 + 等级 + 经验条 */}
          <div className="tk-hero-detail-left">
            <div
              className="tk-hero-detail-portrait"
              style={{ background: QUALITY_BG[general.quality], borderColor }}
            >
              <span className="tk-hero-detail-portrait-char">{general.name}</span>
            </div>
            <div className="tk-hero-detail-level-badge" style={{ borderColor }}>
              Lv.{general.level}
            </div>

            {/* 经验条 */}
            {expProgress && expProgress.required > 0 && (
              <div className="tk-hero-detail-exp-section">
                <div className="tk-hero-detail-exp-label">
                  经验 {expProgress.current}/{expProgress.required}
                </div>
                <div className="tk-hero-detail-exp-bar">
                  <div
                    className="tk-hero-detail-exp-fill"
                    style={{ width: `${expProgress.percentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* 战力 */}
            <div className="tk-hero-detail-power">
              ⚔️ 战力 <strong>{power.toLocaleString('zh-CN')}</strong>
            </div>

            {/* 碎片 */}
            <div className="tk-hero-detail-fragments">
              💎 碎片 {fragments}
            </div>
          </div>

          {/* 右侧：属性条 + 技能列表 */}
          <div className="tk-hero-detail-right">
            {/* 属性条 */}
            <div className="tk-hero-detail-stats">
              <h4 className="tk-hero-detail-section-title">四维属性</h4>
              {stats.map((stat) => (
                <div key={stat.key} className="tk-hero-detail-stat-row">
                  <span className="tk-hero-detail-stat-label">{stat.label}</span>
                  <div className="tk-hero-detail-stat-bar">
                    <div
                      className="tk-hero-detail-stat-fill"
                      style={{
                        width: `${stat.percentage}%`,
                        background: stat.color,
                      }}
                    />
                  </div>
                  <span className="tk-hero-detail-stat-value">{stat.value}</span>
                </div>
              ))}
            </div>

            {/* 技能列表 */}
            <div className="tk-hero-detail-skills">
              <h4 className="tk-hero-detail-section-title">技能</h4>
              {general.skills.length === 0 ? (
                <div className="tk-hero-detail-skill-empty">暂无技能</div>
              ) : (
                general.skills.map((skill) => (
                  <div key={skill.id} className="tk-hero-detail-skill-item">
                    <div className="tk-hero-detail-skill-header">
                      <span className="tk-hero-detail-skill-name">{skill.name}</span>
                      <span className="tk-hero-detail-skill-type">
                        {skill.type === 'active' ? '主动' :
                          skill.type === 'passive' ? '被动' :
                            skill.type === 'faction' ? '阵营' : '觉醒'}
                      </span>
                      <span className="tk-hero-detail-skill-level">Lv.{skill.level}</span>
                    </div>
                    <div className="tk-hero-detail-skill-desc">{skill.description}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

HeroDetailModal.displayName = 'HeroDetailModal';

export default HeroDetailModal;
