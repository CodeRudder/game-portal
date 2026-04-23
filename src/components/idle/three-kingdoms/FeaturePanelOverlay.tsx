/**
 * FeaturePanelOverlay — 功能面板弹窗统一渲染层
 *
 * 从 ThreeKingdomsGame.tsx 拆分出来。
 * 负责渲染所有功能面板弹窗（事件/邮件/社交/传承/活动/任务/商店/成就/联盟/声望/商贸/设置）。
 */

import React from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import EventListPanel from '@/components/idle/panels/event/EventListPanel';
import MailPanel from '@/components/idle/panels/mail/MailPanel';
import SocialPanel from '@/components/idle/panels/social/SocialPanel';
import HeritagePanel from '@/components/idle/panels/heritage/HeritagePanel';
import ActivityPanel from '@/components/idle/panels/activity/ActivityPanel';
import QuestPanel from '@/components/idle/panels/quest/QuestPanel';
import ShopPanel from '@/components/idle/panels/shop/ShopPanel';
import AchievementPanel from '@/components/idle/panels/achievement/AchievementPanel';
import AlliancePanel from '@/components/idle/panels/alliance/AlliancePanel';
import PrestigePanel from '@/components/idle/panels/prestige/PrestigePanel';
import TradePanel from '@/components/idle/panels/trade/TradePanel';
import SettingsPanel from '@/components/idle/panels/settings/SettingsPanel';
import EquipmentTab from '@/components/idle/panels/equipment/EquipmentTab';
import ArenaTab from '@/components/idle/panels/arena/ArenaTab';
import NPCTab from '@/components/idle/panels/npc/NPCTab';
import ExpeditionTab from '@/components/idle/panels/expedition/ExpeditionTab';
import ArmyTab from '@/components/idle/panels/army/ArmyTab';
import type { NPCData } from '@/games/three-kingdoms/core/npc';
import { Toast } from '@/components/idle/common/Toast';

/** NPCTab包装器 — 适配FeaturePanelOverlay的engine/snapshotVersion/visible/onClose接口 */
const NPCPanelWrapper: React.FC<any> = ({ engine, visible, onClose }) => {
  const npcData: NPCData[] = React.useMemo(() => {
    const npcSys = (engine as any)?.npcSystem;
    if (npcSys && typeof npcSys.getAllNPCs === 'function') {
      return npcSys.getAllNPCs();
    }
    return [];
  }, [engine]);

  if (!visible) return null;
  return (
    <div className="tk-feature-overlay" onClick={onClose}>
      <div className="tk-feature-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tk-feature-header">
          <h3>👤 名士</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <NPCTab
          npcs={npcData}
          onSelectNPC={(id) => Toast.info(`选中NPC: ${id}`)}
          onStartDialog={(id) => Toast.info(`与NPC对话: ${id}`)}
        />
      </div>
    </div>
  );
};

export type FeaturePanelId =
  | 'events' | 'mail' | 'social' | 'heritage' | 'activity'
  | 'quest' | 'shop' | 'achievement' | 'alliance' | 'prestige'
  | 'trade' | 'settings' | 'equipment' | 'npc' | 'arena'
  | 'expedition' | 'army';

interface FeaturePanelOverlayProps {
  engine: ThreeKingdomsEngine;
  snapshotVersion: number;
  openFeature: FeaturePanelId | null;
  onClose: () => void;
}

const PANELS: Array<{
  id: FeaturePanelId;
  Component: React.FC<any>;
  needsSnapshot?: boolean;
}> = [
  { id: 'events', Component: EventListPanel, needsSnapshot: true },
  { id: 'mail', Component: MailPanel },
  { id: 'social', Component: SocialPanel },
  { id: 'heritage', Component: HeritagePanel },
  { id: 'activity', Component: ActivityPanel },
  { id: 'quest', Component: QuestPanel },
  { id: 'shop', Component: ShopPanel },
  { id: 'achievement', Component: AchievementPanel },
  { id: 'alliance', Component: AlliancePanel },
  { id: 'prestige', Component: PrestigePanel },
  { id: 'trade', Component: TradePanel },
  { id: 'settings', Component: SettingsPanel },
  { id: 'equipment', Component: EquipmentTab, needsSnapshot: true },
  { id: 'arena', Component: ArenaTab, needsSnapshot: true },
  { id: 'npc', Component: NPCPanelWrapper },
  { id: 'expedition', Component: ExpeditionTab, needsSnapshot: true },
  { id: 'army', Component: ArmyTab, needsSnapshot: true },
];

const FeaturePanelOverlay: React.FC<FeaturePanelOverlayProps> = ({
  engine,
  snapshotVersion,
  openFeature,
  onClose,
}) => {
  return (
    <div data-testid="feature-panel-overlay">
      {PANELS.map(({ id, Component, needsSnapshot }) => (
        <Component
          key={id}
          engine={engine}
          snapshotVersion={needsSnapshot ? snapshotVersion : undefined}
          visible={openFeature === id}
          onClose={onClose}
          data-testid={`feature-panel-${id}`}
        />
      ))}
    </div>
  );
};

FeaturePanelOverlay.displayName = 'FeaturePanelOverlay';

export default FeaturePanelOverlay;
