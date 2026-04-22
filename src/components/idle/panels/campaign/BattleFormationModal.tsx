/**
 * BattleFormationModal — 战前布阵弹窗
 *
 * 功能：
 * - 显示敌方阵容预览（3-6个敌方单位）
 * - 我方编队区域（前排3 + 后排3）
 * - 一键布阵按钮（自动选择战力最高武将）
 * - 战力对比（我方 vs 敌方）
 * - 出征按钮 → 触发战斗 → 显示 BattleResultModal
 * - 取消按钮
 *
 * @module components/idle/panels/campaign/BattleFormationModal
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine';
import type { Stage, EnemyUnitDef } from '@/games/three-kingdoms/engine';
import { STAGE_TYPE_LABELS } from '@/games/three-kingdoms/engine';
import {
  QUALITY_LABELS,
  QUALITY_BORDER_COLORS,
} from '@/games/three-kingdoms/engine';
import type { GeneralData } from '@/games/three-kingdoms/engine';
import { MAX_SLOTS_PER_FORMATION } from '@/games/three-kingdoms/engine';
import { BattleOutcome } from '@/games/three-kingdoms/engine';
import type { BattleResult } from '@/games/three-kingdoms/engine';
import BattleResultModal from './BattleResultModal';
import BattleScene from './BattleScene';
import SharedPanel from '../../components/SharedPanel';
import './BattleFormationModal.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface BattleFormationModalProps {
  engine: ThreeKingdomsEngine;
  stage: Stage;
  onClose: () => void;
  /** 快照版本号，用于刷新数据 */
  snapshotVersion: number;
}

// ─────────────────────────────────────────────
// 战力对比等级
// ─────────────────────────────────────────────
interface PowerLevel {
  label: string;
  className: string;
}

function getPowerLevel(allyPower: number, recommendedPower: number): PowerLevel {
  const ratio = recommendedPower > 0 ? allyPower / recommendedPower : 1;
  if (ratio >= 1.2) return { label: '碾压', className: 'tk-power--crush' };
  if (ratio >= 1.0) return { label: '优势', className: 'tk-power--advantage' };
  if (ratio >= 0.8) return { label: '势均力敌', className: 'tk-power--even' };
  return { label: '危险', className: 'tk-power--danger' };
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const BattleFormationModal: React.FC<BattleFormationModalProps> = ({
  engine,
  stage,
  onClose,
  snapshotVersion,
}) => {
  const heroSystem = engine.getHeroSystem();

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
    return formationGenerals.reduce(
      (sum, g) => sum + heroSystem.calculatePower(g),
      0,
    );
  }, [formationGenerals, heroSystem]);

  // ── 敌方信息 ──
  const enemyFormation = stage.enemyFormation;
  const enemyUnits = enemyFormation.units;
  const recommendedPower = enemyFormation.recommendedPower;

  // ── 战力对比 ──
  const powerLevel = useMemo(
    () => getPowerLevel(allyPower, recommendedPower),
    [allyPower, recommendedPower],
  );

  // ── 编队槽位（前排3 + 后排3） ──
  const formationSlots = useMemo(() => {
    const frontCount = 3;
    const backCount = MAX_SLOTS_PER_FORMATION - frontCount;
    const slots: {
      position: 'front' | 'back';
      index: number;
      general: GeneralData | null;
    }[] = [];

    for (let i = 0; i < frontCount; i++) {
      const g = i < formationGenerals.length ? formationGenerals[i] : null;
      slots.push({ position: 'front', index: i, general: g });
    }
    for (let i = 0; i < backCount; i++) {
      const g =
        frontCount + i < formationGenerals.length
          ? formationGenerals[frontCount + i]
          : null;
      slots.push({ position: 'back', index: frontCount + i, general: g });
    }
    return slots;
  }, [formationGenerals]);

  // ── 战斗状态 ──
  const [isBattling, setIsBattling] = useState(false);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [showBattleScene, setShowBattleScene] = useState(false);

  // ── 出征 → 打开战斗场景 ──
  const handleBattle = useCallback(() => {
    if (isBattling) return;
    setIsBattling(true);
    setShowBattleScene(true);
  }, [isBattling]);

  // ── 战斗场景结束回调 ──
  const handleBattleSceneEnd = useCallback((result: BattleResult) => {
    setShowBattleScene(false);
    setBattleResult(result);
    setIsBattling(false);
  }, []);

  // ── 战斗结果确认 ──
  const handleResultConfirm = useCallback(() => {
    if (!battleResult) return;
    // 胜利时发放奖励 + 更新进度
    if (battleResult.outcome === BattleOutcome.VICTORY) {
      engine.completeBattle(stage.id, battleResult.stars as number);
    }
    setBattleResult(null);
    onClose();
  }, [battleResult, engine, stage.id, onClose]);

  // ── 一键布阵 ──
  const handleAutoFormation = useCallback(() => {
    const sorted = heroSystem.getGeneralsSortedByPower(true);
    const top6 = sorted.slice(0, MAX_SLOTS_PER_FORMATION).map((g) => g.id);
    if (activeFormation) {
      engine.setFormation(activeFormation.id, top6);
    } else {
      const newFormation = engine.createFormation();
      if (newFormation) {
        engine.setFormation(newFormation.id, top6);
      }
    }
  }, [heroSystem, activeFormation, engine]);

  // ── 渲染敌方单位 ──
  const renderEnemyUnit = (unit: EnemyUnitDef) => (
    <div key={unit.id} className="tk-bfm-enemy-unit">
      <div className="tk-bfm-enemy-avatar">
        <span className="tk-bfm-enemy-level">Lv.{unit.level}</span>
      </div>
      <div className="tk-bfm-enemy-info">
        <span className="tk-bfm-enemy-name">{unit.name}</span>
        <span className="tk-bfm-enemy-pos">
          {unit.position === 'front' ? '前排' : '后排'}
        </span>
      </div>
    </div>
  );

  // ── 渲染我方槽位 ──
  const renderAllySlot = (slot: {
    position: 'front' | 'back';
    index: number;
    general: GeneralData | null;
  }) => {
    const { general } = slot;
    return (
      <div
        key={`${slot.position}-${slot.index}`}
        className={`tk-bfm-ally-slot ${general ? 'tk-bfm-ally-slot--filled' : 'tk-bfm-ally-slot--empty'}`}
      >
        {general ? (
          <>
            <div
              className="tk-bfm-ally-avatar"
              style={{ borderColor: QUALITY_BORDER_COLORS[general.quality] }}
            >
              <span className="tk-bfm-ally-avatar-text">
                {general.name.charAt(0)}
              </span>
            </div>
            <span className="tk-bfm-ally-name">{general.name}</span>
            <span className="tk-bfm-ally-quality">
              {QUALITY_LABELS[general.quality]}
            </span>
            <span className="tk-bfm-ally-power">
              {heroSystem.calculatePower(general).toLocaleString()}
            </span>
          </>
        ) : (
          <span className="tk-bfm-ally-placeholder">空位</span>
        )}
      </div>
    );
  };

  // ── 战斗场景全屏覆盖 ──
  if (showBattleScene) {
    return (
      <BattleScene
        engine={engine}
        stage={stage}
        onBattleEnd={handleBattleSceneEnd}
      />
    );
  }

  // ── 如果有战斗结果，显示结算弹窗 ──
  if (battleResult) {
    return (
      <BattleResultModal
        result={battleResult}
        stage={stage}
        onConfirm={handleResultConfirm}
      />
    );
  }

  return (
    <SharedPanel title={`战前布阵 - ${stage.name}`} onClose={onClose} visible={true}>
        {/* ── 关卡描述 ── */}
        {stage.description && (
          <div className="tk-bfm-desc">{stage.description}</div>
        )}

        {/* ── 敌方阵容 ── */}
        <div className="tk-bfm-section">
          <div className="tk-bfm-section-title">
            <span className="tk-bfm-section-icon">👹</span>
            敌方阵容 — {enemyFormation.name}
          </div>
          <div className="tk-bfm-enemy-units">
            {enemyUnits.map(renderEnemyUnit)}
          </div>
        </div>

        {/* ── 战力对比 ── */}
        <div className="tk-bfm-power-compare">
          <div className="tk-bfm-power-side tk-bfm-power-ally">
            <span className="tk-bfm-power-label">我方战力</span>
            <span className="tk-bfm-power-value">
              {allyPower.toLocaleString()}
            </span>
          </div>
          <div className="tk-bfm-power-vs">
            <span className={`tk-bfm-power-ratio ${powerLevel.className}`}>
              {powerLevel.label}
            </span>
            <span className="tk-bfm-power-vs-text">VS</span>
          </div>
          <div className="tk-bfm-power-side tk-bfm-power-enemy">
            <span className="tk-bfm-power-label">推荐战力</span>
            <span className="tk-bfm-power-value">
              {recommendedPower.toLocaleString()}
            </span>
          </div>
        </div>

        {/* ── 我方编队 ── */}
        <div className="tk-bfm-section">
          <div className="tk-bfm-section-title">
            <span className="tk-bfm-section-icon">⚔️</span>
            我方编队
            <span className="tk-bfm-formation-count">
              ({formationGenerals.length}/{MAX_SLOTS_PER_FORMATION})
            </span>
          </div>

          {/* 前排 */}
          <div className="tk-bfm-row-label">前排</div>
          <div className="tk-bfm-ally-row">
            {formationSlots
              .filter((s) => s.position === 'front')
              .map(renderAllySlot)}
          </div>

          {/* 后排 */}
          <div className="tk-bfm-row-label">后排</div>
          <div className="tk-bfm-ally-row">
            {formationSlots
              .filter((s) => s.position === 'back')
              .map(renderAllySlot)}
          </div>
        </div>

        {/* ── 操作按钮 ── */}
        <div className="tk-bfm-actions">
          <button className="tk-bfm-btn tk-bfm-btn--cancel" onClick={onClose}>
            取消
          </button>
          <button
            className="tk-bfm-btn tk-bfm-btn--auto"
            onClick={handleAutoFormation}
          >
            🤖 一键布阵
          </button>
          <button
            className="tk-bfm-btn tk-bfm-btn--fight"
            onClick={handleBattle}
            disabled={isBattling || formationGenerals.length === 0}
          >
            {isBattling ? '⏳ 战斗中...' : '⚔️ 出征'}
          </button>
        </div>
    </SharedPanel>
  );
};

BattleFormationModal.displayName = 'BattleFormationModal';

export default BattleFormationModal;
