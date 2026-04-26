/**
 * HeroDetailModal — 武将详情弹窗
 * PC端：800×700 弹窗，含SVG雷达图 | 手机端：全屏滑入面板
 * 功能：雷达图、属性条、技能列表、升级操作、武将传记
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import type { GeneralData } from '@/games/three-kingdoms/engine';
import {
  QUALITY_BORDER_COLORS,
  HERO_MAX_LEVEL,
  GENERAL_DEF_MAP,
} from '@/games/three-kingdoms/engine';
import { statsAtLevel } from '@/games/three-kingdoms/engine/hero/HeroLevelSystem';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import { Toast } from '@/components/idle/common/Toast';
import RadarChart from './RadarChart';
import HeroStarUpModal from './HeroStarUpModal';
import {
  HeroDetailHeader,
  HeroDetailLeftPanel,
  HeroDetailSkills,
  HeroDetailBonds,
  HeroDetailBreakthrough,
} from './HeroDetailSections';
import './hero-design-tokens.css';
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

/** 计算动态属性上限（当前武将最大属性值 × 1.2，向上取整到10的倍数） */
function computeStatMax(stats: { attack: number; defense: number; intelligence: number; speed: number }): number {
  const maxVal = Math.max(stats.attack, stats.defense, stats.intelligence, stats.speed);
  return Math.ceil(maxVal * 1.2 / 10) * 10;
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

  // 升级预览
  const enhancePreview = useMemo(() => {
    if (targetLevel <= general.level) return null;
    try {
      return engine.getEnhancePreview(general.id, targetLevel);
    } catch {
      return null;
    }
  }, [engine, general.id, targetLevel, general.level]);

  // 属性列表（使用 statsAtLevel 计算当前等级实际属性）
  const stats = useMemo(() => {
    const effectiveStats = statsAtLevel(general.baseStats, general.level);
    const statMax = computeStatMax(effectiveStats);
    return (['attack', 'defense', 'intelligence', 'speed'] as const).map((key) => ({
      key,
      label: STAT_LABELS[key],
      value: effectiveStats[key],
      color: STAT_COLORS[key],
      percentage: Math.min(100, Math.floor((effectiveStats[key] / statMax) * 100)),
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '升级失败';
      Toast.danger(message);
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '合成失败';
      Toast.danger(message);
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
        <HeroDetailHeader
          general={general}
          onCompare={onCompare}
          onStarUp={() => setShowStarUp(true)}
        />

        {/* 武将传记 */}
        {biography && (
          <p className="tk-hero-detail-biography">{biography}</p>
        )}

        {/* 主体：左右分栏 */}
        <div className="tk-hero-detail-body">
          {/* 左侧面板 */}
          <HeroDetailLeftPanel
            general={general}
            engine={engine}
            power={power}
            expProgress={expProgress}
            fragments={fragments}
            synthesizeProgress={synthesizeProgress}
            canSynth={canSynth}
            targetLevel={targetLevel}
            enhancePreview={enhancePreview}
            isEnhancing={isEnhancing}
            isSynthesizing={isSynthesizing}
            onTargetLevelChange={setTargetLevel}
            onEnhanceMax={handleEnhanceMax}
            onEnhance={handleEnhance}
            onSynthesize={handleSynthesize}
          />

          {/* 右侧：雷达图 + 属性条 + 技能列表 */}
          <div className="tk-hero-detail-right">
            {/* 雷达图 */}
            <div className="tk-hero-detail-radar-section">
              <h4 className="tk-hero-detail-section-title">属性总览</h4>
              <div className="tk-hero-detail-radar-wrap">
                <RadarChart stats={stats} quality={general.quality} statMax={computeStatMax(statsAtLevel(general.baseStats, general.level))} />
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
            <HeroDetailSkills skills={general.skills} />

            {/* 羁绊标签 */}
            <HeroDetailBonds heroId={general.id} />

            {/* 突破状态 */}
            <HeroDetailBreakthrough
              engine={engine}
              generalId={general.id}
              currentLevel={general.level}
            />
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
