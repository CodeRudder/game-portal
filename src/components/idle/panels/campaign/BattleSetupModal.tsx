/**
 * BattleSetupModal — 战前布阵弹窗
 *
 * 功能：
 * - 显示敌方阵容预览（3-6个敌方单位）
 * - 我方编队区域（前排3+后排3）
 * - 一键布阵按钮
 * - 战力对比（我方 vs 敌方）
 * - 出征按钮
 * - 从引擎获取数据：engine.getCampaignSystem(), engine.getHeroSystem()
 *
 * @module components/idle/panels/campaign/BattleSetupModal
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { Stage, EnemyUnitDef } from '@/games/three-kingdoms/engine/campaign/campaign.types';
import { STAGE_TYPE_LABELS } from '@/games/three-kingdoms/engine/campaign/campaign.types';
import { QUALITY_LABELS, QUALITY_BORDER_COLORS } from '@/games/three-kingdoms/engine/hero/hero.types';
import type { GeneralData } from '@/games/three-kingdoms/engine/hero/hero.types';
import { MAX_SLOTS_PER_FORMATION } from '@/games/three-kingdoms/engine/hero/HeroFormation';
import { Toast } from '@/components/idle/common/Toast';
import './BattleSetupModal.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface BattleSetupModalProps {
  engine: ThreeKingdomsEngine;
  stage: Stage;
  onClose: () => void;
  snapshotVersion: number;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const BattleSetupModal: React.FC<BattleSetupModalProps> = ({
  engine,
  stage,
  onClose,
  snapshotVersion,
}) => {
  const heroSystem = engine.getHeroSystem();
  const formationSystem = engine.getFormationSystem();

  // ── 数据 ──
  const allGenerals = useMemo(() => {
    void snapshotVersion;
    return engine.getGenerals();
  }, [engine, snapshotVersion]);

  const activeFormation = useMemo(() => {
    void snapshotVersion;
    return engine.getActiveFormation();
  }, [engine, snapshotVersion]);

  // ── 我方编队武将 ──
  const formationGenerals = useMemo(() => {
    if (!activeFormation) return [];
    return activeFormation.slots
      .map((id) => (id ? heroSystem.getGeneral(id) : undefined))
      .filter((g): g is GeneralData => g !== undefined);
  }, [activeFormation, heroSystem]);

  // ── 我方总战力 ──
  const allyPower = useMemo(() => {
    return formationGenerals.reduce((sum, g) => sum + heroSystem.calculatePower(g), 0);
  }, [formationGenerals, heroSystem]);

  // ── 敌方信息 ──
  const enemyFormation = stage.enemyFormation;
  const enemyUnits = enemyFormation.units;
  const recommendedPower = enemyFormation.recommendedPower;

  // ── 战力对比 ──
  const powerComparison = useMemo(() => {
    const ratio = recommendedPower > 0 ? allyPower / recommendedPower : 1;
    if (ratio >= 1.2) return { label: '碾压', className: 'tk-power--crush' };
    if (ratio >= 1.0) return { label: '优势', className: 'tk-power--advantage' };
    if (ratio >= 0.8) return { label: '势均力敌', className: 'tk-power--even' };
    return { label: '危险', className: 'tk-power--danger' };
  }, [allyPower, recommendedPower]);

  // ── 编队槽位（前排3 + 后排3） ──
  const formationSlots = useMemo(() => {
    const slots: { position: 'front' | 'back'; index: number; general: GeneralData | null }[] = [];
    const frontCount = 3;
    const backCount = MAX_SLOTS_PER_FORMATION - frontCount;

    for (let i = 0; i < frontCount; i++) {
      const g = i < formationGenerals.length ? formationGenerals[i] : null;
      slots.push({ position: 'front', index: i, general: g });
    }
    for (let i = 0; i < backCount; i++) {
      const g = (frontCount + i) < formationGenerals.length ? formationGenerals[frontCount + i] : null;
      slots.push({ position: 'back', index: frontCount + i, general: g });
    }
    return slots;
  }, [formationGenerals]);

  // ── 出征 ──
  const [isBattling, setIsBattling] = useState(false);

  const handleBattle = useCallback(() => {
    if (isBattling) return;
    setIsBattling(true);
    try {
      const result = engine.startBattle(stage.id);
      if (result.outcome === 'VICTORY') {
        engine.completeBattle(stage.id, result.stars as number);
        const starText = result.stars > 0 ? ` (${result.stars}星)` : '';
        Toast.success(`战斗胜利！${starText}`);
      } else {
        Toast.danger('战斗失败，请提升战力后再试');
      }
    } catch (err) {
      Toast.danger(err instanceof Error ? err.message : '战斗出错');
    } finally {
      setIsBattling(false);
      onClose();
    }
  }, [engine, stage.id, isBattling, onClose]);

  // ── 一键布阵 ──
  const handleAutoFormation = useCallback(() => {
    const sorted = heroSystem.getGeneralsSortedByPower(true);
    const top6 = sorted.slice(0, MAX_SLOTS_PER_FORMATION).map((g) => g.id);
    // 如果有激活编队，更新它；否则创建新编队
    if (activeFormation) {
      engine.setFormation(activeFormation.id, top6);
    } else {
      const newFormation = engine.createFormation();
      if (newFormation) {
        engine.setFormation(newFormation.id, top6);
      }
    }
    Toast.success('已自动布阵');
  }, [heroSystem, activeFormation, engine]);

  // ── 渲染敌方单位 ──
  const renderEnemyUnit = (unit: EnemyUnitDef) => (
    <div key={unit.id} className="tk-enemy-unit">
      <div className="tk-enemy-unit-avatar">
        <span className="tk-enemy-unit-level">Lv.{unit.level}</span>
      </div>
      <div className="tk-enemy-unit-info">
        <span className="tk-enemy-unit-name">{unit.name}</span>
        <span className="tk-enemy-unit-position">
          {unit.position === 'front' ? '前排' : '后排'}
        </span>
      </div>
    </div>
  );

  // ── 渲染我方槽位 ──
  const renderAllySlot = (slot: { position: 'front' | 'back'; index: number; general: GeneralData | null }) => {
    const { general } = slot;
    return (
      <div
        key={`${slot.position}-${slot.index}`}
        className={`tk-ally-slot ${general ? 'tk-ally-slot--filled' : 'tk-ally-slot--empty'}`}
      >
        {general ? (
          <>
            <div
              className="tk-ally-slot-avatar"
              style={{ borderColor: QUALITY_BORDER_COLORS[general.quality] }}
            >
              <span className="tk-ally-slot-avatar-text">
                {general.name.charAt(0)}
              </span>
            </div>
            <span className="tk-ally-slot-name">{general.name}</span>
            <span className="tk-ally-slot-quality">
              {QUALITY_LABELS[general.quality]}
            </span>
            <span className="tk-ally-slot-power">
              {heroSystem.calculatePower(general).toLocaleString()}
            </span>
          </>
        ) : (
          <span className="tk-ally-slot-placeholder">空位</span>
        )}
      </div>
    );
  };

  return (
    <div className="tk-battle-setup-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="tk-battle-setup-modal" onClick={(e) => e.stopPropagation()}>
        {/* 标题 */}
        <div className="tk-battle-setup-header">
          <div className="tk-battle-setup-title">
            <span className="tk-battle-setup-stage-type">
              {STAGE_TYPE_LABELS[stage.type]}
            </span>
            <span className="tk-battle-setup-stage-name">{stage.name}</span>
          </div>
          <button className="tk-battle-setup-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        {/* 关卡描述 */}
        {stage.description && (
          <div className="tk-battle-setup-desc">{stage.description}</div>
        )}

        {/* 敌方阵容 */}
        <div className="tk-battle-section">
          <div className="tk-battle-section-title">
            <span className="tk-battle-section-icon">👹</span>
            敌方阵容 — {enemyFormation.name}
          </div>
          <div className="tk-enemy-units">
            {enemyUnits.map(renderEnemyUnit)}
          </div>
        </div>

        {/* 战力对比 */}
        <div className="tk-power-compare">
          <div className="tk-power-side tk-power-ally">
            <span className="tk-power-label">我方战力</span>
            <span className="tk-power-value">{allyPower.toLocaleString()}</span>
          </div>
          <div className="tk-power-vs">
            <span className={`tk-power-ratio ${powerComparison.className}`}>
              {powerComparison.label}
            </span>
            <span className="tk-power-vs-text">VS</span>
          </div>
          <div className="tk-power-side tk-power-enemy">
            <span className="tk-power-label">推荐战力</span>
            <span className="tk-power-value">{recommendedPower.toLocaleString()}</span>
          </div>
        </div>

        {/* 我方编队 */}
        <div className="tk-battle-section">
          <div className="tk-battle-section-title">
            <span className="tk-battle-section-icon">⚔️</span>
            我方编队
          </div>

          {/* 前排 */}
          <div className="tk-ally-row-label">前排</div>
          <div className="tk-ally-row">
            {formationSlots.filter((s) => s.position === 'front').map(renderAllySlot)}
          </div>

          {/* 后排 */}
          <div className="tk-ally-row-label">后排</div>
          <div className="tk-ally-row">
            {formationSlots.filter((s) => s.position === 'back').map(renderAllySlot)}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="tk-battle-actions">
          <button
            className="tk-battle-btn tk-battle-btn--auto"
            onClick={handleAutoFormation}
          >
            🤖 一键布阵
          </button>
          <button
            className="tk-battle-btn tk-battle-btn--fight"
            onClick={handleBattle}
            disabled={isBattling || formationGenerals.length === 0}
          >
            {isBattling ? '⏳ 战斗中...' : '⚔️ 出征'}
          </button>
        </div>
      </div>
    </div>
  );
};

BattleSetupModal.displayName = 'BattleSetupModal';

export default BattleSetupModal;
