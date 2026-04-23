/**
 * 关卡系统 — 关卡配置数据（章节组装 + 查找函数）
 *
 * 将各章节关卡数据组装为完整章节配置，并提供查找函数。
 * 实现 ICampaignDataProvider 接口，供 CampaignProgressSystem 使用。
 *
 * 章节概览（对齐 Play v3.0 §1.1）：
 *   第1章：黄巾之乱（推荐战力 100~500）
 *   第2章：群雄割据（推荐战力 500~1,200）
 *   第3章：官渡之战（推荐战力 1,200~2,500）
 *   第4章：赤壁之战（推荐战力 2,500~5,000）
 *   第5章：三国鼎立（推荐战力 5,000~10,000）
 *   第6章：一统天下（推荐战力 10,000~20,000）
 *
 * @module engine/campaign/campaign-config
 */

import type {
  Chapter,
  ICampaignDataProvider,
  Stage,
} from './campaign.types';
import { CHAPTER1_STAGES } from './campaign-chapter1';
import { CHAPTER2_STAGES } from './campaign-chapter2';
import { CHAPTER3_STAGES } from './campaign-chapter3';
import { CHAPTER4_STAGES } from './campaign-chapter4';
import { CHAPTER5_STAGES } from './campaign-chapter5';
import { CHAPTER6_STAGES } from './campaign-chapter6';

// ═══════════════════════════════════════════════
// 章节组装
// ═══════════════════════════════════════════════

/** 第1章：黄巾之乱 */
export const CHAPTER_1: Chapter = {
  id: 'chapter1',
  name: '黄巾之乱',
  subtitle: '苍天已死，黄天当立',
  order: 1,
  stages: CHAPTER1_STAGES,
  prerequisiteChapterId: null,
  description: '东汉末年，张角率黄巾军起义，天下大乱。刘备、关羽、张飞桃园结义，开始平定黄巾之乱的征程。',
};

/** 第2章：群雄割据 */
export const CHAPTER_2: Chapter = {
  id: 'chapter2',
  name: '群雄割据',
  subtitle: '十八路诸侯讨董卓',
  order: 2,
  stages: CHAPTER2_STAGES,
  prerequisiteChapterId: 'chapter1',
  description: '董卓入京把持朝政，十八路诸侯联合讨伐。虎牢关前，吕布英勇无敌，关羽温酒斩华雄。',
};

/** 第3章：官渡之战 */
export const CHAPTER_3: Chapter = {
  id: 'chapter3',
  name: '官渡之战',
  subtitle: '官渡之战定北方',
  order: 3,
  stages: CHAPTER3_STAGES,
  prerequisiteChapterId: 'chapter2',
  description: '董卓覆灭后，各路诸侯争霸中原。曹操与袁绍在官渡展开决战，以少胜多奠定北方基业。',
};

/** 第4章：赤壁之战 */
export const CHAPTER_4: Chapter = {
  id: 'chapter4',
  name: '赤壁之战',
  subtitle: '东风夜放花千树',
  order: 4,
  stages: CHAPTER4_STAGES,
  prerequisiteChapterId: 'chapter3',
  description: '曹操率八十万大军南下，孙刘联军在赤壁以火攻大破曹军，奠定三分天下之局。',
};

/** 第5章：三国鼎立 */
export const CHAPTER_5: Chapter = {
  id: 'chapter5',
  name: '三国鼎立',
  subtitle: '三分天下',
  order: 5,
  stages: CHAPTER5_STAGES,
  prerequisiteChapterId: 'chapter4',
  description: '魏蜀吴三国鼎立，群雄逐鹿，各路英雄尽显风采。',
};

/** 第6章：一统天下 */
export const CHAPTER_6: Chapter = {
  id: 'chapter6',
  name: '一统天下',
  subtitle: '天下归一',
  order: 6,
  stages: CHAPTER6_STAGES,
  prerequisiteChapterId: 'chapter5',
  description: '司马氏篡魏建晋，一统天下，三国终局。',
};

/** 所有章节配置（按 order 排序） */
export const ALL_CHAPTERS: Chapter[] = [CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4, CHAPTER_5, CHAPTER_6];

// ═══════════════════════════════════════════════
// 查找函数
// ═══════════════════════════════════════════════

/** 关卡ID → 关卡配置的查找表 */
const _stageMap = new Map<string, Stage>();
for (const ch of ALL_CHAPTERS) {
  for (const st of ch.stages) {
    _stageMap.set(st.id, st);
  }
}

/** 获取所有章节 */
export function getChapters(): Chapter[] {
  return ALL_CHAPTERS;
}

/** 获取指定章节 */
export function getChapter(chapterId: string): Chapter | undefined {
  return ALL_CHAPTERS.find((ch) => ch.id === chapterId);
}

/** 获取指定关卡 */
export function getStage(stageId: string): Stage | undefined {
  return _stageMap.get(stageId);
}

/** 获取章节内的关卡列表 */
export function getStagesByChapter(chapterId: string): Stage[] {
  return getChapter(chapterId)?.stages ?? [];
}

// ═══════════════════════════════════════════════
// ICampaignDataProvider 实现
// ═══════════════════════════════════════════════

/**
 * 默认关卡数据提供者
 *
 * 使用静态配置数据实现 ICampaignDataProvider 接口。
 * 可直接传给 CampaignProgressSystem 和 RewardDistributor。
 *
 * @example
 * ```ts
 * const progress = new CampaignProgressSystem(campaignDataProvider);
 * const reward = new RewardDistributor(campaignDataProvider, deps);
 * ```
 */
export const campaignDataProvider: ICampaignDataProvider = {
  getChapters,
  getChapter,
  getStage,
  getStagesByChapter,
};
