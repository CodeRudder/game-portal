/**
 * useEngineEvents — 引擎事件监听自定义 Hook
 *
 * 职责：统一管理引擎事件监听的注册/清理
 * 从 ThreeKingdomsGame.tsx 拆分出来
 */

import { useEffect } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import { RESOURCE_LABELS } from '@/games/three-kingdoms/engine';
import { Toast } from '@/components/idle/common/Toast';
import { formatNumber } from '@/components/idle/utils/formatNumber';

interface UseEngineEventsParams {
  engine: ThreeKingdomsEngine | null;
  /** 触发 UI 重渲染的回调 */
  onRefresh: () => void;
  /** 设置急报横幅 */
  onBannerCreated: (data: any) => void;
  /** 设置随机遭遇 */
  onEncounterTriggered: (data: any) => void;
  /** 设置剧情事件 */
  onStoryTriggered: (act: any) => void;
  /** 剧情事件完成 */
  onStoryCompleted: () => void;
}

export function useEngineEvents({
  engine,
  onRefresh,
  onBannerCreated,
  onEncounterTriggered,
  onStoryTriggered,
  onStoryCompleted,
}: UseEngineEventsParams): void {
  useEffect(() => {
    // 引擎未就绪时跳过事件注册
    if (!engine) return;
    // ── 资源变化 / 建筑升级 → 刷新 UI ──
    const handleResourceChanged = () => { onRefresh(); };
    const handleBuildingUpgraded = () => { onRefresh(); };
    const handleBuildingUpgradeStart = () => { onRefresh(); };

    // ── 资源溢出通知 ──
    const handleResourceOverflow = (data: any) => {
      const label = RESOURCE_LABELS[data.resourceType as keyof typeof RESOURCE_LABELS] ?? data.resourceType;
      Toast.danger(`${label}溢出！损失 ${formatNumber(data.overflow)}，升级仓库可避免`);
      onRefresh();
    };

    engine.on('resource:changed', handleResourceChanged);
    engine.on('building:upgraded', handleBuildingUpgraded);
    engine.on('building:upgrade-start', handleBuildingUpgradeStart);
    engine.on('resource:overflow', handleResourceOverflow);

    // ── 领土/攻城事件 → 刷新地图数据 ──
    const handleTerritoryCaptured = () => { onRefresh(); };
    const handleSiegeVictory = () => { onRefresh(); };
    const handleSiegeDefeat = () => { onRefresh(); };

    engine.on('territory:captured' as any, handleTerritoryCaptured);
    engine.on('siege:victory' as any, handleSiegeVictory);
    engine.on('siege:defeat' as any, handleSiegeDefeat);

    // ── 急报横幅 + 随机遭遇弹窗 ──
    const handleBannerCreated = (data: any) => {
      onBannerCreated({
        id: data.bannerId ?? `banner-${Date.now()}`,
        eventId: data.eventId ?? '',
        title: data.title ?? '急报',
        content: data.content ?? '',
        icon: data.icon ?? '📢',
        priority: data.priority ?? 'normal',
        displayDuration: data.displayDuration ?? 5000,
        createdAt: Date.now(),
        read: false,
      });
    };

    const handleEncounterTriggered = (data: any) => {
      onEncounterTriggered(data.event ?? null);
    };

    engine.on('event:banner_created' as any, handleBannerCreated);
    engine.on('event:encounter_triggered' as any, handleEncounterTriggered);

    // ── 剧情事件 ──
    const handleStoryTriggered = (data: any) => {
      const registry = (engine as any).registry;
      const storySys = registry?.get?.('storyEvent');
      const act = storySys?.getCurrentAct?.(data.storyId);
      if (act) onStoryTriggered(act);
    };
    const handleStoryActAdvanced = (data: any) => {
      const registry = (engine as any).registry;
      const storySys = registry?.get?.('storyEvent');
      const act = storySys?.getCurrentAct?.(data.storyId);
      if (act) onStoryTriggered(act);
    };
    const handleStoryCompleted = () => {
      onStoryCompleted();
    };

    engine.on('story:triggered' as any, handleStoryTriggered);
    engine.on('story:actAdvanced' as any, handleStoryActAdvanced);
    engine.on('story:completed' as any, handleStoryCompleted);

    return () => {
      engine.off('resource:changed', handleResourceChanged);
      engine.off('building:upgraded', handleBuildingUpgraded);
      engine.off('building:upgrade-start', handleBuildingUpgradeStart);
      engine.off('resource:overflow', handleResourceOverflow);
      engine.off('territory:captured' as any, handleTerritoryCaptured);
      engine.off('siege:victory' as any, handleSiegeVictory);
      engine.off('siege:defeat' as any, handleSiegeDefeat);
      engine.off('event:banner_created' as any, handleBannerCreated);
      engine.off('event:encounter_triggered' as any, handleEncounterTriggered);
      engine.off('story:triggered' as any, handleStoryTriggered);
      engine.off('story:actAdvanced' as any, handleStoryActAdvanced);
      engine.off('story:completed' as any, handleStoryCompleted);
    };
  }, [engine, onRefresh, onBannerCreated, onEncounterTriggered, onStoryTriggered, onStoryCompleted]);
}
