/**
 * HeroDetailModal — 武将详情弹窗
 * PC端：800×700 弹窗，含SVG雷达图 | 手机端：全屏滑入面板
 * 功能：雷达图、属性条、技能列表、升级操作、武将传记
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import type { GeneralData, Quality } from '@/games/three-kingdoms/engine';
import {
  QUALITY_LABELS,
  QUALITY_BORDER_COLORS,
  FACTION_LABELS,
  HERO_MAX_LEVEL,
  GENERAL_DEF_MAP,
} from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { EnhancePreview } from '@/games/three-kingdoms/engine';
import { Toast } from '@/components/idle/common/Toast';
import { HERO_QUALITY_BG_COLORS } from '../../common/constants';
import { formatNumber } from '@/components/idle/utils/formatNumber';
import RadarChart from './RadarChart';
import HeroStarUpModal from './HeroStarUpModal';
import './HeroDetailModal.css';
import './HeroDetailModal-chart.css';

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
  /** 升级完成回调（触发外部重渲染） */
  onEnhanceComplete?: () => void;
  /** 对比回调（打开武将对比弹窗） */
  onCompare?: (general: GeneralData) => void;
}

// ─────────────────────────────────────────────
// 属性条标签映射
// ─────────────────────────────────────────────
const STAT_LABELS: Record<string, string> = {
  attack: '武力', defense: '统率', intelligence: '智力', speed: '政治',
};
const STAT_COLORS: Record<string, string> = {
  attack: '#E53935', defense: '#1E88E5', intelligence: '#AB47BC', speed: '#43A047',
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

/** 计算动态属性上限（当前武将最大属性值 × 1.2，向上取整到10的倍数） */
function computeStatMax(stats: { attack: number; defense: number; intelligence: number; speed: number }): number {
  const maxVal = Math.max(stats.attack, stats.defense, stats.intelligence, stats.speed);
  return Math.ceil(maxVal * 1.2 / 10) * 10;
}

/** 格式化数值 */
function formatNum(n: number): string {
  return formatNumber(n);
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const HeroDetailModal: React.FC<HeroDetailModalProps> = ({
  general,
  engine,
  onClose,
  onEnhanceComplete,
  onCompare,
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
  const levelSystem = engine.getLevelSystem();

  // 升级目标等级（默认+1）
  const [targetLevel, setTargetLevel] = useState(general.level + 1);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [showStarUp, setShowStarUp] = useState(false);

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

  const synthesizeProgress = useMemo(
    () => heroSystem.getSynthesizeProgress(general.id),
    [heroSystem, general.id],
  );

  const canSynth = useMemo(
    () => heroSystem.canSynthesize(general.id),
    [heroSystem, general.id],
  );

  // 武将传记（从静态配置中获取）
  const biography = useMemo(
    () => GENERAL_DEF_MAP.get(general.id)?.biography,
    [general.id],
  );

  const borderColor = QUALITY_BORDER_COLORS[general.quality];
  const qualityLabel = QUALITY_LABELS[general.quality];
  const factionLabel = FACTION_LABELS[general.faction];

  // 升级预览
  const enhancePreview: EnhancePreview | null = useMemo(() => {
    if (targetLevel <= general.level) return null;
    try {
      return engine.getEnhancePreview(general.id, targetLevel);
    } catch {
      return null;
    }
  }, [engine, general.id, targetLevel, general.level]);

  // 属性列表
  const stats = useMemo(() => {
    const { baseStats } = general;
    const statMax = computeStatMax(baseStats);
    return (['attack', 'defense', 'intelligence', 'speed'] as const).map((key) => ({
      key,
      label: STAT_LABELS[key],
      value: baseStats[key],
      color: STAT_COLORS[key],
      percentage: Math.min(100, Math.floor((baseStats[key] / statMax) * 100)),
    }));
  }, [general]);

  // 升级操作
  const handleEnhance = useCallback(() => {
    if (targetLevel <= general.level) return;
    setIsEnhancing(true);
    try {
      const result = engine.enhanceHero(general.id, targetLevel);
      if (result) {
        Toast.success(`${general.name} 升级至 Lv.${result.levelsGained > 1 ? targetLevel : general.level + 1}，战力 +${result.levelsGained}`);
        onEnhanceComplete?.();
      }
    } catch (e: any) {
      Toast.danger(e?.message || '升级失败');
    } finally {
      setIsEnhancing(false);
    }
  }, [engine, general.id, general.level, general.name, targetLevel, onEnhanceComplete]);

  // 一键满级（升5级）
  const handleEnhanceMax = useCallback(() => {
    const maxTarget = Math.min(general.level + 5, HERO_MAX_LEVEL);
    setTargetLevel(maxTarget);
  }, [general.level]);

  // 碎片合成
  const handleSynthesize = useCallback(() => {
    setIsSynthesizing(true);
    try {
      const result = heroSystem.fragmentSynthesize(general.id);
      if (result) {
        Toast.success(`🎉 ${general.name} 合成成功！`);
        onEnhanceComplete?.();
      } else {
        Toast.danger('合成失败：碎片不足或已拥有该武将');
      }
    } catch (e: any) {
      Toast.danger(e?.message || '合成失败');
    } finally {
      setIsSynthesizing(false);
    }
  }, [heroSystem, general.id, general.name, onEnhanceComplete]);

  return (
    <div className="tk-hero-detail-overlay" data-testid="hero-detail-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tk-hero-detail-modal" data-testid="hero-detail-modal" role="dialog" aria-modal="true" aria-label={`${general.name} 详情`}>
        {/* 关闭按钮 */}
        <button className="tk-hero-detail-close" data-testid="hero-detail-modal-close" onClick={onClose} aria-label="关闭">✕</button>

        {/* 标题栏 */}
        <div className="tk-hero-detail-header" style={{ borderBottomColor: borderColor }}>
          <span className="tk-hero-detail-title-name" data-testid="hero-detail-modal-name">{general.name}</span>
          <span className="tk-hero-detail-title-faction" data-testid="hero-detail-modal-faction">{factionLabel}</span>
          <span
            className="tk-hero-detail-title-quality"
            style={{ background: borderColor }}
          >
            {qualityLabel}
          </span>
          {/* P1-01: 与其他武将对比按钮 */}
          {onCompare && (
            <button
              className="tk-hero-detail-compare-btn"
              onClick={() => onCompare(general)}
              title="与其他武将对比"
            >
              ⚖️ 对比
            </button>
          )}
          {/* P0: 升星按钮 — 打开升星弹窗 */}
          <button
            className="tk-hero-detail-compare-btn"
            onClick={() => setShowStarUp(true)}
            title="武将升星"
          >
            ⭐ 升星
          </button>
        </div>

        {/* 武将传记 */}
        {biography && (
          <p className="tk-hero-detail-biography">{biography}</p>
        )}

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
            <div className="tk-hero-detail-power" data-testid="hero-detail-modal-power">
              ⚔️ 战力 <strong>{power.toLocaleString('zh-CN')}</strong>
            </div>

            {/* 碎片 + 合成 */}
            <div className="tk-hero-detail-fragments">
              <div className="tk-hero-detail-fragments-header">
                <span>💎 碎片 {fragments}/{synthesizeProgress.required}</span>
              </div>
              <div className="tk-hero-detail-fragments-bar">
                <div
                  className="tk-hero-detail-fragments-fill"
                  style={{ width: `${Math.min(100, (synthesizeProgress.current / synthesizeProgress.required) * 100)}%` }}
                />
              </div>
              <button
                className={`tk-hero-detail-synthesize-btn ${canSynth ? 'tk-hero-detail-synthesize-btn--active' : ''}`}
                disabled={!canSynth || isSynthesizing}
                onClick={handleSynthesize}
              >
                {isSynthesizing ? '合成中...' : canSynth ? '✨ 碎片合成' : `碎片合成 (${synthesizeProgress.current}/${synthesizeProgress.required})`}
              </button>
            </div>

            {/* 升级操作区 */}
            <div className="tk-hero-detail-enhance">
              <div className="tk-hero-detail-enhance-header">
                <span className="tk-hero-detail-enhance-title">强化升级</span>
                <button
                  className="tk-hero-detail-enhance-max-btn"
                  onClick={handleEnhanceMax}
                >
                  +5级
                </button>
              </div>

              {/* 目标等级选择 */}
              <div className="tk-hero-detail-enhance-target">
                <span className="tk-hero-detail-enhance-label">
                  目标等级: Lv.{targetLevel}
                </span>
              </div>

              {/* 升级预览 */}
              {enhancePreview && (
                <div className="tk-hero-detail-enhance-preview">
                  <div className="tk-hero-detail-enhance-cost">
                    💰 {formatNum(enhancePreview.totalGold)} 铜钱
                  </div>
                  <div className="tk-hero-detail-enhance-power-diff">
                    战力: {formatNum(enhancePreview.powerBefore)} → {formatNum(enhancePreview.powerAfter)}
                    <span className="tk-hero-detail-enhance-power-gain">
                      (+{formatNum(enhancePreview.powerAfter - enhancePreview.powerBefore)})
                    </span>
                  </div>
                  <div className="tk-hero-detail-enhance-affordable">
                    {enhancePreview.affordable ? '✅ 资源充足' : '❌ 资源不足'}
                  </div>
                </div>
              )}

              {/* 升级按钮 */}
              <button
                className="tk-hero-detail-enhance-btn"
                data-testid="hero-detail-modal-enhance-btn"
                disabled={!enhancePreview?.affordable || isEnhancing || targetLevel <= general.level}
                onClick={handleEnhance}
              >
                {isEnhancing ? '升级中...' : `升级至 Lv.${targetLevel}`}
              </button>
            </div>
          </div>

          {/* 右侧：雷达图 + 属性条 + 技能列表 */}
          <div className="tk-hero-detail-right">
            {/* 雷达图 */}
            <div className="tk-hero-detail-radar-section">
              <h4 className="tk-hero-detail-section-title">属性总览</h4>
              <div className="tk-hero-detail-radar-wrap">
                <RadarChart stats={stats} quality={general.quality} statMax={computeStatMax(general.baseStats)} />
              </div>
            </div>

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
                general.skills.map((skill: any) => (
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

        {/* P0: 升星弹窗 */}
        {showStarUp && (
          <HeroStarUpModal
            generalId={general.id}
            generalName={general.name}
            level={general.level}
            currentStar={engine.getHeroStarSystem().getStar(general.id)}
            fragmentProgress={engine.getHeroStarSystem().getFragmentProgress(general.id)}
            starUpPreview={engine.getHeroStarSystem().getStarUpPreview(general.id)}
            breakthroughPreview={engine.getHeroStarSystem().getBreakthroughPreview(general.id)}
            breakthroughStage={engine.getHeroStarSystem().getBreakthroughStage(general.id)}
            levelCap={engine.getHeroStarSystem().getLevelCap(general.id)}
            goldAmount={engine.getResourceAmount('gold')}
            breakthroughStoneAmount={engine.getResourceAmount('breakthroughStone')}
            onClose={() => setShowStarUp(false)}
            onStarUp={(id) => {
              const result = engine.getHeroStarSystem().starUp(id);
              if (result.success) {
                Toast.success(`⭐ ${general.name} 升星成功！${result.previousStar}→${result.currentStar}`);
                onEnhanceComplete?.();
              } else {
                Toast.danger('升星失败：资源不足');
              }
              setShowStarUp(false);
              return result;
            }}
            onBreakthrough={(id) => {
              const result = engine.getHeroStarSystem().breakthrough(id);
              if (result.success) {
                Toast.success(`🔮 ${general.name} 突破成功！等级上限 → Lv.${result.newLevelCap}`);
                onEnhanceComplete?.();
              } else {
                Toast.danger('突破失败：资源不足或条件未满足');
              }
              setShowStarUp(false);
              return result;
            }}
          />
        )}
      </div>
    </div>
  );
};

HeroDetailModal.displayName = 'HeroDetailModal';

export default HeroDetailModal;
