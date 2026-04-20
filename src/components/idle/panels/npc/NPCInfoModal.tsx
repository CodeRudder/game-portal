/**
 * NPCInfoModal — NPC信息弹窗
 *
 * 展示NPC详细信息：属性、好感度进度、可执行操作。
 * 基于通用 Modal 组件风格。
 *
 * 设计规范：水墨江山·铜纹霸业
 */
import React, { useMemo } from 'react';
import './NPCInfoModal.css';

import type {
  NPCData,
  NPCProfessionDef,
  AffinityLevel,
  NPCAction,
} from '@/games/three-kingdoms/core/npc';
import {
  NPC_PROFESSION_DEFS,
  NPC_PROFESSION_LABELS,
  getAffinityLevel,
  getAffinityProgress,
} from '@/games/three-kingdoms/core/npc';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export interface NPCInfoModalProps {
  /** 是否显示 */
  visible: boolean;
  /** NPC数据 */
  npc: NPCData | null;
  /** 关闭回调 */
  onClose: () => void;
  /** 操作按钮点击回调 */
  onAction?: (actionId: string, npcId: string) => void;
  /** 发起对话回调 */
  onStartDialog?: (npcId: string) => void;
}

/** 好感度等级对应的颜色和标签 */
const AFFINITY_DISPLAY: Record<AffinityLevel, { color: string; label: string; desc: string }> = {
  hostile:  { color: '#b8423a', label: '敌对', desc: '此人与你关系紧张' },
  neutral:  { color: '#a0a0a0', label: '中立', desc: '彼此尚无深交' },
  friendly: { color: '#52a349', label: '友善', desc: '关系良好，可进行更多交互' },
  trusted:  { color: '#3498db', label: '信赖', desc: '深受信任，解锁特殊能力' },
  bonded:   { color: '#c9a84c', label: '羁绊', desc: '生死之交，获得羁绊技能' },
};

/** 好感度等级阈值（用于显示进度条） */
const AFFINITY_THRESHOLDS: Record<AffinityLevel, { min: number; max: number }> = {
  hostile:  { min: 0, max: 19 },
  neutral:  { min: 20, max: 39 },
  friendly: { min: 40, max: 64 },
  trusted:  { min: 65, max: 84 },
  bonded:   { min: 85, max: 100 },
};

// ─────────────────────────────────────────────
// NPCInfoModal 主组件
// ─────────────────────────────────────────────

const NPCInfoModal: React.FC<NPCInfoModalProps> = ({
  visible,
  npc,
  onClose,
  onAction,
  onStartDialog,
}) => {
  if (!visible || !npc) return null;

  const profDef = NPC_PROFESSION_DEFS[npc.profession];
  const affinityLevel = getAffinityLevel(npc.affinity);
  const affinityDisplay = AFFINITY_DISPLAY[affinityLevel];
  const threshold = AFFINITY_THRESHOLDS[affinityLevel];
  const progressInLevel = threshold.max > threshold.min
    ? ((npc.affinity - threshold.min) / (threshold.max - threshold.min)) * 100
    : 100;

  const handleAction = (actionId: string) => {
    if (actionId === 'dialog' && onStartDialog) {
      onStartDialog(npc.id);
    } else if (onAction) {
      onAction(actionId, npc.id);
    }
  };

  return (
    <div className="tk-npcinfo-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${npc.name}信息`}>
      <div className="tk-npcinfo-modal" onClick={(e) => e.stopPropagation()}>
        {/* 关闭按钮 */}
        <button className="tk-npcinfo-close" onClick={onClose} aria-label="关闭">✕</button>

        {/* NPC头像区 */}
        <div className="tk-npcinfo-portrait">
          <span className="tk-npcinfo-portrait-icon">{npc.customIcon ?? profDef.icon}</span>
          <div className="tk-npcinfo-portrait-info">
            <h3 className="tk-npcinfo-name">{npc.name}</h3>
            <span className="tk-npcinfo-profession">{profDef.icon} {profDef.label}</span>
          </div>
        </div>

        {/* 职业描述 */}
        <div className="tk-npcinfo-section">
          <p className="tk-npcinfo-desc">{profDef.description}</p>
        </div>

        {/* 好感度区域 */}
        <div className="tk-npcinfo-section">
          <div className="tk-npcinfo-section-title">好感度</div>
          <div className="tk-npcinfo-affinity">
            <div className="tk-npcinfo-affinity-header">
              <span className="tk-npcinfo-affinity-level" style={{ color: affinityDisplay.color }}>
                {affinityDisplay.label}
              </span>
              <span className="tk-npcinfo-affinity-value">{npc.affinity} / 100</span>
            </div>
            <div className="tk-npcinfo-affinity-bar">
              <div
                className="tk-npcinfo-affinity-fill"
                style={{ width: `${npc.affinity}%`, backgroundColor: affinityDisplay.color }}
              />
            </div>
            <div className="tk-npcinfo-affinity-progress">
              <span style={{ color: affinityDisplay.color }}>
                距下一等级: {Math.max(0, threshold.max - npc.affinity)}
              </span>
            </div>
            <p className="tk-npcinfo-affinity-desc">{affinityDisplay.desc}</p>
          </div>
        </div>

        {/* 位置信息 */}
        <div className="tk-npcinfo-section">
          <div className="tk-npcinfo-section-title">位置</div>
          <div className="tk-npcinfo-location">
            <span>区域: {npc.region}</span>
            <span>坐标: ({npc.position.x}, {npc.position.y})</span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="tk-npcinfo-actions">
          <button
            className="tk-npcinfo-action-btn tk-npcinfo-action-btn--primary"
            onClick={() => handleAction('dialog')}
          >
            💬 对话
          </button>
          {npc.profession === 'merchant' && (
            <button className="tk-npcinfo-action-btn" onClick={() => handleAction('trade')}>
              🏪 交易
            </button>
          )}
          {npc.profession === 'warrior' && (
            <button className="tk-npcinfo-action-btn" onClick={() => handleAction('challenge')}>
              ⚔️ 比武
            </button>
          )}
          {npc.profession === 'artisan' && (
            <button className="tk-npcinfo-action-btn" onClick={() => handleAction('craft')}>
              🔨 锻造
            </button>
          )}
          {npc.profession === 'strategist' && (
            <button className="tk-npcinfo-action-btn" onClick={() => handleAction('intel')}>
              📜 情报
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NPCInfoModal;
