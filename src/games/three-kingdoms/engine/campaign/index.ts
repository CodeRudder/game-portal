/**
 * 关卡系统 — 统一导出入口
 *
 * @module engine/campaign
 */

// 类型
export type {
  StageType,
  StageStatus,
  StarRating,
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

// 扫荡类型
export type {
  SweepTicketSource,
  SweepTicketGainRecord,
  SweepTicketCostRecord,
  SweepConfig,
  SweepResult,
  SweepBatchResult,
  AutoPushProgress,
  AutoPushResult,
  SweepDeps,
  SweepSaveData,
} from './sweep.types';

export { DEFAULT_SWEEP_CONFIG } from './sweep.types';

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

// 序列化
export { serializeProgress, deserializeProgress, SAVE_VERSION } from './CampaignSerializer';

// 奖励分发器
export { RewardDistributor } from './RewardDistributor';

// 扫荡系统
export { SweepSystem } from './SweepSystem';
export { AutoPushExecutor } from './AutoPushExecutor';
