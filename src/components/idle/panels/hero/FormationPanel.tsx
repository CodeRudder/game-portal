/**
 * FormationPanel — 编队管理面板
 *
 * 功能：
 * - 创建/删除/重命名编队
 * - 激活编队切换
 * - 拖拽式编队编辑（添加/移除武将）
 * - 编队战力展示
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { GeneralData } from '@/games/three-kingdoms/engine';
import { QUALITY_BORDER_COLORS, MAX_FORMATIONS, MAX_SLOTS_PER_FORMATION } from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { FormationData } from '@/games/three-kingdoms/engine';
import './FormationPanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface FormationPanelProps {
  engine: ThreeKingdomsEngine;
  snapshotVersion: number;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const FormationPanel: React.FC<FormationPanelProps> = ({ engine, snapshotVersion }) => {
  const formationSystem = engine.getFormationSystem();
  const heroSystem = engine.getHeroSystem();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // ── 获取数据 ──
  const formations = useMemo(() => {
    void snapshotVersion;
    const raw = formationSystem.getAllFormations();
    return Array.isArray(raw) ? raw : raw ? Object.values(raw as Record<string, any>) : [];
  }, [formationSystem, snapshotVersion]);

  const activeId = formationSystem.getActiveFormationId();
  const allGenerals = engine.getGenerals();

  // ── 编队战力 ──
  const getFormationPower = useCallback(
    (f: FormationData) => formationSystem.calculateFormationPower(
      f,
      (id) => heroSystem.getGeneral(id) as GeneralData | undefined,
      (g) => heroSystem.calculatePower(g),
    ),
    [formationSystem, heroSystem],
  );

  // ── 创建编队 ──
  const handleCreate = useCallback(() => {
    formationSystem.createFormation();
  }, [formationSystem]);

  // ── 激活编队 ──
  const handleActivate = useCallback((id: string) => {
    formationSystem.setActiveFormation(id);
  }, [formationSystem]);

  // ── 删除编队 ──
  const handleDelete = useCallback((id: string) => {
    formationSystem.deleteFormation(id);
    if (editingId === id) setEditingId(null);
  }, [formationSystem, editingId]);

  // ── 重命名 ──
  const handleRenameStart = useCallback((f: FormationData) => {
    setRenameId(f.id);
    setRenameValue(f.name);
  }, []);

  const handleRenameConfirm = useCallback(() => {
    if (renameId && renameValue.trim()) {
      formationSystem.renameFormation(renameId, renameValue.trim());
    }
    setRenameId(null);
  }, [formationSystem, renameId, renameValue]);

  // ── 添加武将 ──
  const handleAddHero = useCallback((formationId: string, generalId: string) => {
    formationSystem.addToFormation(formationId, generalId);
  }, [formationSystem]);

  // ── 移除武将 ──
  const handleRemoveHero = useCallback((formationId: string, generalId: string) => {
    formationSystem.removeFromFormation(formationId, generalId);
  }, [formationSystem]);

  // ── 可用武将（未在当前编辑编队中的） ──
  const availableGenerals = useMemo(() => {
    if (!editingId) return [];
    const f = formationSystem.getFormation(editingId);
    if (!f) return [];
    const inFormation = new Set(f.slots.filter((s) => s !== ''));
    return allGenerals.filter((g) => !inFormation.has(g.id));
  }, [editingId, allGenerals, formationSystem, snapshotVersion]);

  // ── 渲染 ──
  return (
    <div className="tk-formation-panel">
      <div className="tk-formation-header">
        <span className="tk-formation-title">⚔️ 编队管理</span>
        <button
          className="tk-formation-create-btn"
          onClick={handleCreate}
          disabled={formations.length >= MAX_FORMATIONS}
        >
          + 创建编队
        </button>
      </div>

      {formations.length === 0 ? (
        <div className="tk-formation-empty">
          <p>尚无编队，点击「创建编队」开始组建</p>
        </div>
      ) : (
        <div className="tk-formation-list">
          {formations.map((f) => {
            const isActive = f.id === activeId;
            const isEditing = f.id === editingId;
            const isRenaming = f.id === renameId;
            const members = f.slots.filter((s: string) => s !== '');
            const power = getFormationPower(f);

            return (
              <div
                key={f.id}
                className={`tk-formation-card ${isActive ? 'tk-formation-card--active' : ''}`}
              >
                <div className="tk-formation-card-header">
                  {isRenaming ? (
                    <input
                      className="tk-formation-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRenameConfirm}
                      onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
                      maxLength={10}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="tk-formation-name"
                      onClick={() => handleRenameStart(f)}
                      title="点击重命名"
                    >
                      {f.name}
                    </span>
                  )}
                  <div className="tk-formation-card-actions">
                    {!isActive && (
                      <button
                        className="tk-formation-activate-btn"
                        onClick={() => handleActivate(f.id)}
                      >
                        激活
                      </button>
                    )}
                    {isActive && <span className="tk-formation-active-badge">当前</span>}
                    <button
                      className="tk-formation-edit-btn"
                      onClick={() => setEditingId(isEditing ? null : f.id)}
                    >
                      {isEditing ? '收起' : '编辑'}
                    </button>
                    <button
                      className="tk-formation-delete-btn"
                      onClick={() => handleDelete(f.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="tk-formation-power">
                  战力: {power.toLocaleString('zh-CN')}
                </div>

                {/* 编队槽位 */}
                <div className="tk-formation-slots">
                  {f.slots.map((heroId: string, idx: number) => {
                    if (!heroId) {
                      return (
                        <div key={idx} className="tk-formation-slot tk-formation-slot--empty">
                          {idx + 1}
                        </div>
                      );
                    }
                    const hero = heroSystem.getGeneral(heroId);
                    return (
                      <div
                        key={idx}
                        className="tk-formation-slot"
                        style={hero ? { borderColor: QUALITY_BORDER_COLORS[hero.quality] } : {}}
                      >
                        <span className="tk-formation-slot-name">
                          {hero?.name ?? heroId}
                        </span>
                        {isEditing && (
                          <button
                            className="tk-formation-slot-remove"
                            onClick={() => handleRemoveHero(f.id, heroId)}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 编辑模式：添加武将 */}
                {isEditing && (
                  <div className="tk-formation-add-section">
                    <div className="tk-formation-add-label">
                      添加武将 ({members.length}/{MAX_SLOTS_PER_FORMATION})
                    </div>
                    {members.length < MAX_SLOTS_PER_FORMATION && availableGenerals.length > 0 && (
                      <div className="tk-formation-add-list">
                        {availableGenerals.map((g) => (
                          <button
                            key={g.id}
                            className="tk-formation-add-hero"
                            style={{ borderColor: QUALITY_BORDER_COLORS[g.quality] }}
                            onClick={() => handleAddHero(f.id, g.id)}
                          >
                            {g.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {availableGenerals.length === 0 && members.length < MAX_SLOTS_PER_FORMATION && (
                      <div className="tk-formation-add-empty">所有武将已在编队中</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

FormationPanel.displayName = 'FormationPanel';

export default FormationPanel;
