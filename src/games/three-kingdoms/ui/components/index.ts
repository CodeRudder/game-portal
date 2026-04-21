/**
 * 三国霸业 — 通用 UI 组件统一导出
 *
 * @module ui/components
 */

export { Panel } from './Panel';
export type { PanelProps } from './Panel';

export { Modal } from './Modal';
export type { ModalProps, ModalType } from './Modal';

export { Toast } from './Toast';
export type { ToastProps, ToastItem, ToastType } from './Toast';

export { ToastProvider, useToast } from './ToastProvider';

export { GameErrorBoundary } from './GameErrorBoundary';
export type { GameErrorBoundaryProps } from './GameErrorBoundary';

// v9.0 离线收益
export { OfflineRewardModal } from './OfflineRewardModal';
export type { OfflineRewardModalProps } from './OfflineRewardModal';

export { OfflineSummary } from './OfflineSummary';
export type { OfflineSummaryProps, SummaryItem, SummarySection } from './OfflineSummary';

export { OfflineEstimate } from './OfflineEstimate';
export type { OfflineEstimateProps } from './OfflineEstimate';

// v10.0 兵强马壮
export { ArmyPanel } from './ArmyPanel';
export type { ArmyPanelProps } from './ArmyPanel';

export { EquipmentBag } from './EquipmentBag';
export type { EquipmentBagProps } from './EquipmentBag';

// v11.0 群雄逐鹿
export { ArenaPanel } from './ArenaPanel';
export type { ArenaPanelProps } from './ArenaPanel';

export { PvPBattleResult } from './PvPBattleResult';
export type { PvPBattleResultProps } from './PvPBattleResult';

// v12.0 远征天下
export { ExpeditionPanel } from './ExpeditionPanel';
export type { ExpeditionPanelProps } from './ExpeditionPanel';

export { ExpeditionResult } from './ExpeditionResult';
export type { ExpeditionResultProps } from './ExpeditionResult';
