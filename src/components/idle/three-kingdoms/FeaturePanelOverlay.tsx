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

export type FeaturePanelId =
  | 'events' | 'mail' | 'social' | 'heritage' | 'activity'
  | 'quest' | 'shop' | 'achievement' | 'alliance' | 'prestige'
  | 'trade' | 'settings';

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
];

const FeaturePanelOverlay: React.FC<FeaturePanelOverlayProps> = ({
  engine,
  snapshotVersion,
  openFeature,
  onClose,
}) => {
  return (
    <>
      {PANELS.map(({ id, Component, needsSnapshot }) => (
        <Component
          key={id}
          engine={engine}
          snapshotVersion={needsSnapshot ? snapshotVersion : undefined}
          visible={openFeature === id}
          onClose={onClose}
        />
      ))}
    </>
  );
};

FeaturePanelOverlay.displayName = 'FeaturePanelOverlay';

export default FeaturePanelOverlay;
