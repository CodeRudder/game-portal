/**
 * 关卡系统 — 统一导出入口
 *
 * @module engine/campaign
 */

// 类型
export type {
  StageType,
  StageStatus,
  StarCount,
  EnemyUnitDef,
  EnemyFormation,
  DropItemType,
  DropTableEntry,
  StageReward,
  Stage,
  Chapter,
  StageState,
  CampaignProgress,
  CampaignSaveData,
  AddResourceCallback,
  AddFragmentCallback,
  AddExpCallback,
  RewardDistributorDeps,
  ICampaignDataProvider,
} from './campaign.types';

export {
  STAGE_TYPE_LABELS,
  STAGE_STATUS_LABELS,
  MAX_STARS,
} from './campaign.types';

// 配置数据
export {
  CHAPTER_1,
  CHAPTER_2,
  CHAPTER_3,
  ALL_CHAPTERS,
  getChapters,
  getChapter,
  getStage,
  getStagesByChapter,
  campaignDataProvider,
} from './campaign-config';

// 进度系统
export { CampaignProgressSystem } from './CampaignProgressSystem';

// 奖励分发器
export { RewardDistributor } from './RewardDistributor';
