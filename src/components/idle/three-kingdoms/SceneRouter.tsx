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
import WorldMapTab from '@/components/idle/panels/map/WorldMapTab';
import MoreTab from '@/components/idle/panels/more/MoreTab';
import EquipmentTab from '@/components/idle/panels/equipment/EquipmentTab';
import ArenaTab from '@/components/idle/panels/arena/ArenaTab';
import ArmyTab from '@/components/idle/panels/army/ArmyTab';
import ExpeditionTab from '@/components/idle/panels/expedition/ExpeditionTab';
import PrestigePanel from '@/components/idle/panels/prestige/PrestigePanel';
import NPCTab from '@/components/idle/panels/npc/NPCTab';
import NPCInfoModal from '@/components/idle/panels/npc/NPCInfoModal';
import type { NPCData } from '@/games/three-kingdoms/core/npc';
import { isNPCSubsystem, isTerritorySubsystem } from '@/components/idle/shared/engine-type-guards';
import type { TabId, FeaturePanelId } from './TabBar';

// ── 样式 ──
import '@/components/idle/panels/more/MoreTab.css';

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
  const npcData: NPCData[] = React.useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const npcSys = engine?.getSubsystemRegistry?.()?.get?.('npc') as any;
    if (isNPCSubsystem(npcSys)) {
      return (npcSys.getAllNPCs() as NPCData[]) ?? [];
    }
    return [];
  }, [engine, snapshotVersion]);

  // ── NPC 弹窗状态 ──
  const [selectedNPC, setSelectedNPC] = React.useState<NPCData | null>(null);

  const handleSelectNPC = React.useCallback((npcId: string) => {
    const npc = npcData.find((n) => n.id === npcId);
    if (npc) setSelectedNPC(npc);
  }, [npcData]);

  const handleStartDialog = React.useCallback((npcId: string) => {
    Toast.info(`与NPC对话: ${npcId}`);
  }, []);

  return (
    <div data-testid="tk-scene-router" className="tk-scene-router">
      {(() => {
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
                engine={engine}
                onSelectTerritory={(id) => {
                  Toast.info(`选中领土: ${id}`);
                }}
                onUpgradeTerritory={(territoryId: string) => {
                  try {
                    const territorySys = engine.getTerritorySystem();
                    if (isTerritorySubsystem(territorySys)) {
                      territorySys.upgradeTerritory(territoryId);
                      Toast.success(`领土升级成功`);
                    } else {
                      Toast.info(`升级领土: ${territoryId}`);
                    }
                  } catch (e) {
                    Toast.danger(`升级异常：${e instanceof Error ? e.message : String(e)}`);
                  }
                }}
              />
            );

          case 'npc':
            return (
              <>
                <NPCTab
                  npcs={npcData}
                  onSelectNPC={handleSelectNPC}
                  onStartDialog={handleStartDialog}
                />
                {/* NPC详情弹窗 */}
                {selectedNPC && (
                  <NPCInfoModal
                    visible={true}
                    npc={selectedNPC}
                    onClose={() => setSelectedNPC(null)}
                    onStartDialog={(npcId) => {
                      setSelectedNPC(null);
                      Toast.info(`与NPC对话: ${npcId}`);
                    }}
                  />
                )}
                {/* NPC对话 — 通过Toast提示，完整弹窗需DialogSystem集成 */}
              </>
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

          case 'prestige':
            return (
              <PrestigePanel
                engine={engine}
                visible={true}
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
      })()}

    </div>
  );
};

SceneRouter.displayName = 'SceneRouter';

export default SceneRouter;
