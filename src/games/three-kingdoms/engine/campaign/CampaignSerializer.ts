/**
 * 关卡系统 — 序列化/反序列化纯函数
 *
 * 从 CampaignProgressSystem 中提取的存档序列化逻辑。
 * 纯函数设计，无副作用，便于测试。
 *
 * @module engine/campaign/CampaignSerializer
 */

import type {
  CampaignProgress,
  CampaignSaveData,
  ICampaignDataProvider,
  StageState,
  StarRating,
} from './campaign.types';
import { MAX_STARS } from './campaign.types';
import { createInitialProgress } from './CampaignProgressSystem';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 存档数据版本号 */
export const SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 序列化 / 反序列化
// ─────────────────────────────────────────────

/**
 * 序列化进度为存档数据
 *
 * @param progress - 当前进度
 * @returns 存档数据
 */
export function serializeProgress(progress: CampaignProgress): CampaignSaveData {
  return {
    version: SAVE_VERSION,
    progress: {
      currentChapterId: progress.currentChapterId,
      stageStates: Object.fromEntries(
        Object.entries(progress.stageStates).map(([id, s]) => [id, { ...s }]),
      ),
      lastClearTime: progress.lastClearTime,
    },
  };
}

/**
 * 从存档数据反序列化进度
 *
 * 自动补全新增关卡（存档中不存在的关卡会被初始化为未通关状态）。
 *
 * @param data - 存档数据
 * @param dataProvider - 关卡数据提供者（用于获取所有关卡ID）
 * @returns 反序列化后的进度
 * @throws {Error} 版本不兼容时抛出异常
 */
export function deserializeProgress(
  data: CampaignSaveData,
  dataProvider: ICampaignDataProvider,
): CampaignProgress {
  // DEF-017: null/undefined 防护，防止空存档导致崩溃
  if (!data || !data.progress || !data.progress.stageStates) {
    return createInitialProgress(dataProvider);
  }

  if (data.version !== SAVE_VERSION) {
    throw new Error(
      `[CampaignProgress] 存档版本不兼容: 期望 ${SAVE_VERSION}, 实际 ${data.version}`,
    );
  }

  // 获取所有关卡ID（兼容新增关卡）
  const allStageIds = getAllStageIds(dataProvider);
  const stageStates: Record<string, StageState> = {};

  for (const stageId of allStageIds) {
    if (data.progress.stageStates[stageId]) {
      stageStates[stageId] = { ...data.progress.stageStates[stageId] };
    } else {
      stageStates[stageId] = createInitialStageState(stageId);
    }
  }

  return {
    currentChapterId: data.progress.currentChapterId,
    stageStates,
    lastClearTime: data.progress.lastClearTime,
  };
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建初始关卡状态（未通关） */
function createInitialStageState(stageId: string): StageState {
  return {
    stageId,
    stars: 0 as StarRating,
    firstCleared: false,
    clearCount: 0,
  };
}

/** 获取所有关卡ID */
function getAllStageIds(dataProvider: ICampaignDataProvider): string[] {
  const ids: string[] = [];
  for (const chapter of dataProvider.getChapters()) {
    for (const stage of chapter.stages) {
      ids.push(stage.id);
    }
  }
  return ids;
}
