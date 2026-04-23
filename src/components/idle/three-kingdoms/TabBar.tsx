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

/**
 * Tab 类型定义 — 与 Plan/PRD NAV-2 统一
 *
 * 7个一级Tab: 天下/出征/武将/科技/建筑/声望/更多▼
 * 其他功能（装备/名士/竞技/远征/军队）通过"更多▼"下拉菜单访问
 */
export type TabId = 'map' | 'campaign' | 'hero' | 'tech' | 'building' | 'prestige' | 'more' | 'equipment' | 'npc' | 'arena' | 'expedition' | 'army';

/** Tab 配置 */
export interface TabConfig {
  id: TabId;
  icon: string;
  label: string;
  available: boolean;
}

/**
 * 7个一级Tab — 与 Plan v1.0 #3 / PRD NAV-2 统一
 * 顺序: 天下/出征/武将/科技/建筑/声望/更多▼
 */
export const TABS: TabConfig[] = [
  { id: 'map', icon: '🗺️', label: '天下', available: true },
  { id: 'campaign', icon: '⚔️', label: '出征', available: true },
  { id: 'hero', icon: '🦸', label: '武将', available: true },
  { id: 'tech', icon: '📜', label: '科技', available: true },
  { id: 'building', icon: '🏰', label: '建筑', available: true },
  { id: 'prestige', icon: '👑', label: '声望', available: true },
  { id: 'more', icon: '📋', label: '更多▼', available: true },
];

/** 功能菜单面板ID — 通过"更多▼"菜单访问 */
export type FeaturePanelId = 'events' | 'quest' | 'shop' | 'mail' | 'achievement' | 'activity' | 'alliance' | 'prestige' | 'heritage' | 'social' | 'trade' | 'settings' | 'equipment' | 'npc' | 'arena' | 'expedition' | 'army';

/** 功能菜单项配置（静态部分） — 4个功能区 A/B/C/D */
export const FEATURE_ITEMS: Array<Omit<FeatureMenuItem, 'badge'>> = [
  // A区-核心功能
  { id: 'quest', icon: '📜', label: '任务', description: '日常任务与活跃度', available: true },
  { id: 'activity', icon: '🎪', label: '活动', description: '限时活动与签到', available: true },
  { id: 'mail', icon: '📬', label: '邮件', description: '系统邮件与奖励领取', available: true },
  { id: 'shop', icon: '🛒', label: '商店', description: '道具与资源购买', available: true },
  // B区-社交互动
  { id: 'social', icon: '👥', label: '好友', description: '好友互动与排行榜', available: true },
  { id: 'alliance', icon: '⚔️', label: '公会', description: '公会BOSS与任务', available: true },
  { id: 'achievement', icon: '🏆', label: '排行榜', description: '全服排名与赛季奖励', available: true },
  // C区-扩展系统
  { id: 'expedition', icon: '🧭', label: '远征', description: '探索未知领域', available: true },
  { id: 'equipment', icon: '🛡️', label: '装备', description: '装备管理与穿戴', available: true },
  { id: 'npc', icon: '👤', label: '名士', description: 'NPC名册与好感度', available: true },
  { id: 'arena', icon: '🏟️', label: '竞技', description: 'PvP对战与赛季排名', available: true },
  { id: 'army', icon: '💪', label: '军队', description: '军队编组与训练', available: true },
  // D区-系统功能
  { id: 'events', icon: '⚡', label: '事件', description: '当前活跃事件', available: true },
  { id: 'heritage', icon: '⚔️', label: '传承', description: '武将装备经验传承', available: true },
  { id: 'trade', icon: '💱', label: '交易', description: '资源兑换与交易', available: true },
  { id: 'settings', icon: '⚙️', label: '设置', description: '游戏设置与账号管理', available: true },
];

/** 已有独立Tab的功能映射 — 点击"更多"菜单项时跳转到对应Tab */
export const FEATURE_TO_TAB: Record<string, TabId> = {
  worldmap: 'map',
  // 以下功能不再有独立Tab，通过"更多▼"菜单打开面板
  // equipment, arena, expedition, npc, army 等通过 FeaturePanelId 访问
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
    <div className="tk-tab-bar" data-testid="tab-bar">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`tk-tab-btn ${activeTab === tab.id ? 'tk-tab-btn--active' : ''}`}
          onClick={() => onTabChange(tab)}
          aria-label={tab.label}
          aria-selected={activeTab === tab.id}
          role="tab"
          data-testid={`tab-bar-${tab.id}`}
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
