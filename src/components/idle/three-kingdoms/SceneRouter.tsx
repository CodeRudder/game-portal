/**
 * SceneRouter — 场景路由组件
 *
 * 职责：根据当前 Tab 渲染对应场景内容
 * 从 ThreeKingdomsGame.tsx 拆分出来
 */

import React from 'react';
import type { EngineSnapshot, BuildingType, BuildingState } from '@/games/three-kingdoms/shared/types';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import { Toast } from '@/components/idle/common/Toast';
import BuildingPanel from '@/components/idle/panels/building/BuildingPanel';
import HeroTab from '@/components/idle/panels/hero/HeroTab';
import CampaignTab from '@/components/idle/panels/campaign/CampaignTab';
import TechTab from '@/components/idle/panels/tech/TechTab';
import EquipmentTab from '@/components/idle/panels/equipment/EquipmentTab';
import ArenaTab from '@/components/idle/panels/arena/ArenaTab';
import WorldMapTab from '@/components/idle/panels/map/WorldMapTab';
import NPCTab from '@/components/idle/panels/npc/NPCTab';
import ExpeditionTab from '@/components/idle/panels/expedition/ExpeditionTab';
import ArmyTab from '@/components/idle/panels/army/ArmyTab';
import MoreTab from '@/components/idle/panels/more/MoreTab';
import type { TabId, FeaturePanelId } from './TabBar';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface SceneRouterProps {
  /** 当前激活的 Tab */
  activeTab: TabId;
  /** 引擎实例 */
  engine: ThreeKingdomsEngine;
  /** 快照版本号 */
  snapshotVersion: number;
  /** 引擎快照 */
  snapshot: EngineSnapshot;
  /** 建筑升级完成回调 */
  onUpgradeComplete: (type: BuildingType) => void;
  /** 建筑升级失败回调 */
  onUpgradeError: (error: Error) => void;
  /** 打开功能面板回调 */
  onOpenFeature: (id: FeaturePanelId) => void;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

const SceneRouter: React.FC<SceneRouterProps> = ({
  activeTab,
  engine,
  snapshotVersion,
  snapshot,
  onUpgradeComplete,
  onUpgradeError,
  onOpenFeature,
}) => {
  const { resources, productionRates, caps, buildings } = snapshot;

  // ── 世界地图数据 ──
  const worldMapData = React.useMemo(() => {
    const territorySys = engine.getTerritorySystem();
    const territories = territorySys.getAllTerritories();
    const productionSummary = territorySys.getPlayerProductionSummary();
    return { territories, productionSummary };
  }, [engine, snapshotVersion]);

  // ── NPC 数据 ──
  const npcData = React.useMemo(() => {
    const npcSys = (engine as any).npcSystem;
    if (npcSys && typeof npcSys.getAllNPCs === 'function') {
      return npcSys.getAllNPCs();
    }
    return [];
  }, [engine, snapshotVersion]);

  switch (activeTab) {
    case 'building':
      return (
        <BuildingPanel
          buildings={buildings}
          resources={resources}
          rates={productionRates}
          caps={caps}
          engine={engine}
          snapshotVersion={snapshotVersion}
          onUpgradeComplete={onUpgradeComplete}
          onUpgradeError={onUpgradeError}
        />
      );

    case 'hero':
      return (
        <HeroTab
          engine={engine}
          snapshotVersion={snapshotVersion}
        />
      );

    case 'tech':
      return (
        <TechTab
          engine={engine}
          snapshotVersion={snapshotVersion}
        />
      );

    case 'campaign':
      return (
        <CampaignTab
          engine={engine}
          snapshotVersion={snapshotVersion}
        />
      );

    case 'equipment':
      return (
        <EquipmentTab
          engine={engine}
          snapshotVersion={snapshotVersion}
        />
      );

    case 'map':
      return (
        <WorldMapTab
          territories={worldMapData.territories}
          productionSummary={worldMapData.productionSummary}
          snapshotVersion={snapshotVersion}
          onSelectTerritory={(id) => {
            Toast.info(`选中领土: ${id}`);
          }}
          onSiegeTerritory={(id) => {
            Toast.info(`发起攻城: ${id}`);
          }}
        />
      );

    case 'npc':
      return (
        <NPCTab
          npcs={npcData}
          onSelectNPC={(npcId) => Toast.info(`查看NPC: ${npcId}`)}
          onStartDialog={(npcId) => Toast.info(`与NPC对话: ${npcId}`)}
        />
      );

    case 'arena':
      return (
        <ArenaTab
          engine={engine}
          snapshotVersion={snapshotVersion}
        />
      );

    case 'expedition':
      return (
        <ExpeditionTab
          engine={engine}
          snapshotVersion={snapshotVersion}
        />
      );

    case 'army':
      return (
        <ArmyTab
          engine={engine}
          snapshotVersion={snapshotVersion}
        />
      );

    case 'more':
      return (
        <MoreTab
          engine={engine}
          snapshotVersion={snapshotVersion}
          onOpenPanel={(id) => onOpenFeature(id as FeaturePanelId)}
        />
      );

    default:
      return null;
  }
};

SceneRouter.displayName = 'SceneRouter';

export default SceneRouter;
