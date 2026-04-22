/**
 * TabBar — 底部 Tab 栏组件
 *
 * 职责：渲染底部导航 Tab 栏（建筑/武将/科技/关卡等）
 * 从 ThreeKingdomsGame.tsx 拆分出来
 */

import React from 'react';
import FeatureMenu from '@/components/idle/FeatureMenu';
import type { FeatureMenuItem } from '@/components/idle/FeatureMenu';
import CalendarDisplay from './CalendarDisplay';
import type { Season, WeatherType } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// 类型 & 常量
// ─────────────────────────────────────────────

/** Tab 类型定义 */
export type TabId = 'building' | 'hero' | 'tech' | 'campaign' | 'map' | 'npc' | 'equipment' | 'arena' | 'expedition' | 'army' | 'more';

/** Tab 配置 */
export interface TabConfig {
  id: TabId;
  icon: string;
  label: string;
  available: boolean;
}

export const TABS: TabConfig[] = [
  { id: 'building', icon: '🏰', label: '建筑', available: true },
  { id: 'hero', icon: '🦸', label: '武将', available: true },
  { id: 'tech', icon: '📜', label: '科技', available: true },
  { id: 'campaign', icon: '⚔️', label: '关卡', available: true },
  { id: 'equipment', icon: '🛡️', label: '装备', available: true },
  { id: 'map', icon: '🗺️', label: '天下', available: true },
  { id: 'npc', icon: '👤', label: '名士', available: true },
  { id: 'arena', icon: '🏟️', label: '竞技', available: true },
  { id: 'expedition', icon: '🧭', label: '远征', available: true },
  { id: 'army', icon: '💪', label: '军队', available: true },
  { id: 'more', icon: '📋', label: '更多', available: true },
];

/** 功能菜单面板ID */
export type FeaturePanelId = 'events' | 'quest' | 'shop' | 'mail' | 'achievement' | 'activity' | 'alliance' | 'prestige' | 'heritage' | 'social' | 'trade' | 'settings';

/** 功能菜单项配置（静态部分） */
export const FEATURE_ITEMS: Array<Omit<FeatureMenuItem, 'badge'>> = [
  { id: 'worldmap', icon: '🗺️', label: '世界地图', description: '三国势力分布与领土管理', available: true },
  { id: 'equipment', icon: '🎒', label: '装备背包', description: '装备管理与穿戴', available: true },
  { id: 'arena', icon: '⚔️', label: '竞技场', description: 'PvP对战与赛季排名', available: true },
  { id: 'expedition', icon: '🚀', label: '远征', description: '探索未知领域', available: true },
  { id: 'events', icon: '⚡', label: '事件', description: '当前活跃事件', available: true },
  { id: 'npc', icon: '👥', label: 'NPC名册', description: '已发现的NPC角色', available: true },
  { id: 'mail', icon: '📬', label: '邮件', description: '系统邮件与奖励领取', available: true },
  { id: 'social', icon: '👥', label: '社交', description: '好友互动与排行榜', available: true },
  { id: 'heritage', icon: '⚔️', label: '传承', description: '武将装备经验传承', available: true },
  { id: 'activity', icon: '🎪', label: '活动', description: '限时活动与签到', available: true },
  { id: 'quest', icon: '📜', label: '任务', description: '日常任务与活跃度', available: true },
  { id: 'achievement', icon: '🏆', label: '成就', description: '成就系统与奖励', available: true },
];

/** 已有独立Tab的功能映射 */
export const FEATURE_TO_TAB: Record<string, TabId> = {
  worldmap: 'map',
  equipment: 'equipment',
  arena: 'arena',
  expedition: 'expedition',
  npc: 'npc',
};

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface TabBarProps {
  /** 当前激活的 Tab */
  activeTab: TabId;
  /** Tab 切换回调 */
  onTabChange: (tab: TabConfig) => void;
  /** 功能菜单项（含动态 badge） */
  featureMenuItems: FeatureMenuItem[];
  /** 功能菜单选择回调 */
  onFeatureSelect: (id: string) => void;
  /** 日历数据 */
  calendar: {
    date?: {
      eraName: string;
      yearInEra: number;
      month: number;
      day: number;
      season: Season;
    };
    weather: WeatherType;
  } | null;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  onTabChange,
  featureMenuItems,
  onFeatureSelect,
  calendar,
}) => {
  return (
    <div className="tk-tab-bar">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`tk-tab-btn ${activeTab === tab.id ? 'tk-tab-btn--active' : ''}`}
          onClick={() => onTabChange(tab)}
          aria-label={tab.label}
          aria-selected={activeTab === tab.id}
          role="tab"
        >
          <span className="tk-tab-icon">{tab.icon}</span>
          <span className="tk-tab-label">{tab.label}</span>
          {!tab.available && <span className="tk-tab-soon">即将开放</span>}
        </button>
      ))}

      {/* 功能菜单按钮 */}
      <FeatureMenu
        items={featureMenuItems}
        onSelect={onFeatureSelect}
      />

      {/* 日历信息（右侧） */}
      <CalendarDisplay calendar={calendar} />
    </div>
  );
};

TabBar.displayName = 'TabBar';

export default TabBar;
