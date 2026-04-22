/**
 * NPCTab — NPC名册面板
 *
 * 展示所有已发现的NPC列表，支持按职业筛选和搜索。
 * 点击NPC卡片可查看详情或发起对话。
 *
 * 设计规范：水墨江山·铜纹霸业
 */
import React, { useState, useMemo, useCallback } from 'react';
import './NPCTab.css';

import type {
  NPCData,
  NPCProfession,
  AffinityLevel,
} from '@/games/three-kingdoms/core/npc';
import {
  NPC_PROFESSION_DEFS,
  NPC_PROFESSION_LABELS,
  getAffinityLevel,
} from '@/games/three-kingdoms/core/npc';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export interface NPCTabProps {
  /** NPC 列表 */
  npcs: NPCData[];
  /** 点击 NPC 卡片回调 */
  onSelectNPC: (npcId: string) => void;
  /** 发起对话回调 */
  onStartDialog: (npcId: string) => void;
  /** 面板是否可见 */
  visible?: boolean;
}

/** 好感度等级对应的颜色 */
const AFFINITY_COLORS: Record<AffinityLevel, string> = {
  hostile: '#b8423a',
  neutral: '#a0a0a0',
  friendly: '#52a349',
  trusted: '#3498db',
  bonded: '#c9a84c',
};

/** 好感度等级中文 */
const AFFINITY_LABELS: Record<AffinityLevel, string> = {
  hostile: '敌对',
  neutral: '中立',
  friendly: '友善',
  trusted: '信赖',
  bonded: '羁绊',
};

// ─────────────────────────────────────────────
// NPC卡片子组件
// ─────────────────────────────────────────────

interface NPCCardProps {
  npc: NPCData;
  onSelect: () => void;
  onStartDialog: () => void;
}

const NPCCard: React.FC<NPCCardProps> = ({ npc, onSelect, onStartDialog }) => {
  const profDef = NPC_PROFESSION_DEFS[npc.profession];
  const affinityLevel = getAffinityLevel(npc.affinity);
  const affinityColor = AFFINITY_COLORS[affinityLevel];
  const affinityLabel = AFFINITY_LABELS[affinityLevel];

  return (
    <div
      className="tk-npc-card"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-label={`${npc.name} ${affinityLabel} 好感度${npc.affinity}`}
      data-testid={`npc-card-${npc.id}`}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}
    >
      <div className="tk-npc-card-header">
        <span className="tk-npc-card-icon">{npc.customIcon ?? profDef.icon}</span>
        <div className="tk-npc-card-info">
          <span className="tk-npc-card-name">{npc.name}</span>
          <span className="tk-npc-card-profession">{NPC_PROFESSION_LABELS[npc.profession]}</span>
        </div>
      </div>

      <div className="tk-npc-card-affinity">
        <div className="tk-npc-affinity-bar">
          <div
            className="tk-npc-affinity-fill"
            style={{ width: `${npc.affinity}%`, backgroundColor: affinityColor }}
          />
        </div>
        <span className="tk-npc-affinity-label" style={{ color: affinityColor }}>
          {affinityLabel} ({npc.affinity})
        </span>
      </div>

      <div className="tk-npc-card-actions">
        <button
          className="tk-npc-action-btn tk-npc-action-btn--dialog"
          onClick={(e) => { e.stopPropagation(); onStartDialog(); }}
          aria-label={`与${npc.name}对话`}
          data-testid={`npc-btn-dialog-${npc.id}`}
        >
          💬 对话
        </button>
        <button
          className="tk-npc-action-btn tk-npc-action-btn--info"
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          aria-label={`查看${npc.name}详情`}
          data-testid={`npc-btn-info-${npc.id}`}
        >
          📋 详情
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// NPCTab 主组件
// ─────────────────────────────────────────────

const NPCTab: React.FC<NPCTabProps> = ({
  npcs,
  onSelectNPC,
  onStartDialog,
  visible = true,
}) => {
  const [searchText, setSearchText] = useState('');
  const [filterProfession, setFilterProfession] = useState<NPCProfession | 'all'>('all');

  /** 按条件过滤NPC列表 */
  const filteredNPCs = useMemo(() => {
    let result = npcs.filter((n) => n.visible);

    if (filterProfession !== 'all') {
      result = result.filter((n) => n.profession === filterProfession);
    }

    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      result = result.filter((n) =>
        n.name.toLowerCase().includes(lower) ||
        NPC_PROFESSION_LABELS[n.profession].includes(searchText),
      );
    }

    return result;
  }, [npcs, filterProfession, searchText]);

  /** 职业筛选按钮列表 */
  const professionFilters: Array<{ value: NPCProfession | 'all'; label: string }> = [
    { value: 'all', label: '全部' },
    ...Object.entries(NPC_PROFESSION_DEFS).map(([key, def]) => ({
      value: key as NPCProfession,
      label: `${def.icon} ${def.label}`,
    })),
  ];

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value),
    [],
  );

  if (!visible) return null;

  return (
    <div className="tk-npc-tab" role="region" aria-label="NPC名册" data-testid="npc-tab">
      {/* 搜索栏 */}
      <div className="tk-npc-tab-toolbar">
        <input
          className="tk-npc-search"
          type="text"
          placeholder="搜索NPC名称..."
          value={searchText}
          onChange={handleSearchChange}
          aria-label="搜索NPC"
          data-testid="npc-search-input"
        />
      </div>

      {/* 职业筛选 */}
      <div className="tk-npc-filter-bar" role="tablist" aria-label="职业筛选" data-testid="npc-filter-bar">
        {professionFilters.map((f) => (
          <button
            key={f.value}
            className={`tk-npc-filter-btn ${filterProfession === f.value ? 'tk-npc-filter-btn--active' : ''}`}
            onClick={() => setFilterProfession(f.value)}
            role="tab"
            aria-selected={filterProfession === f.value}
            data-testid={`npc-filter-${f.value}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* NPC列表 */}
      <div className="tk-npc-list" data-testid="npc-list">
        {filteredNPCs.length === 0 ? (
          <div className="tk-npc-empty" data-testid="npc-empty">
            <span className="tk-npc-empty-icon">🔍</span>
            <span className="tk-npc-empty-text">
              {searchText ? '未找到匹配的NPC' : '暂无发现的NPC'}
            </span>
          </div>
        ) : (
          filteredNPCs.map((npc) => (
            <NPCCard
              key={npc.id}
              npc={npc}
              onSelect={() => onSelectNPC(npc.id)}
              onStartDialog={() => onStartDialog(npc.id)}
            />
          ))
        )}
      </div>

      {/* 底部统计 */}
      <div className="tk-npc-tab-footer" data-testid="npc-tab-footer">
        <span className="tk-npc-tab-count">
          共 {filteredNPCs.length} / {npcs.filter((n) => n.visible).length} 位
        </span>
      </div>
    </div>
  );
};

export default NPCTab;
