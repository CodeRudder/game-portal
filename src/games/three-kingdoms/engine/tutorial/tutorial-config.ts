/**
 * 新手引导系统 — 步骤配置
 *
 * 定义4个引导步骤的配置数据：领取新手礼包、首次招募、查看武将、编队上阵。
 * 规则：只有 interface/type/const，零逻辑。
 *
 * @module engine/tutorial/tutorial-config
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 引导步骤ID */
export type TutorialGuideStepId =
  | 'claim_newbie_pack'   // 领取新手礼包
  | 'first_recruit'       // 首次招募
  | 'view_hero'           // 查看武将
  | 'add_to_formation';   // 编队上阵

/** 引导步骤定义 */
export interface TutorialGuideStep {
  /** 步骤ID */
  id: TutorialGuideStepId;
  /** 步骤顺序（从1开始） */
  order: number;
  /** 步骤标题 */
  title: string;
  /** 步骤描述 */
  description: string;
  /** 触发完成的行为标识 */
  triggerAction: string;
  /** 完成奖励 */
  rewards: TutorialGuideReward[];
}

/** 引导奖励 */
export interface TutorialGuideReward {
  /** 资源类型 */
  resource: string;
  /** 数量 */
  amount: number;
}

/** 引导系统存档数据 */
export interface TutorialGuideSaveData {
  /** 存档版本 */
  version: number;
  /** 已完成的步骤ID列表 */
  completedSteps: TutorialGuideStepId[];
  /** 是否已跳过 */
  skipped: boolean;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 存档版本号 */
export const TUTORIAL_GUIDE_SAVE_VERSION = 1;

/** 引导步骤总数 */
export const TUTORIAL_GUIDE_TOTAL_STEPS = 4;

// ─────────────────────────────────────────────
// 步骤配置
// ─────────────────────────────────────────────

/** 4步引导配置 */
export const TUTORIAL_GUIDE_STEPS: TutorialGuideStep[] = [
  {
    id: 'claim_newbie_pack',
    order: 1,
    title: '领取新手礼包',
    description: '点击领取按钮，获得100招贤令+5000铜钱+1本技能书',
    triggerAction: 'claim_newbie_pack',
    rewards: [
      { resource: 'recruitToken', amount: 100 },
      { resource: 'copper', amount: 5000 },
      { resource: 'skillBook', amount: 1 },
    ],
  },
  {
    id: 'first_recruit',
    order: 2,
    title: '首次招募',
    description: '打开招募面板，执行一次普通招募',
    triggerAction: 'first_recruit',
    rewards: [],
  },
  {
    id: 'view_hero',
    order: 3,
    title: '查看武将',
    description: '打开武将列表，查看刚招募的武将详情',
    triggerAction: 'view_hero',
    rewards: [],
  },
  {
    id: 'add_to_formation',
    order: 4,
    title: '编队上阵',
    description: '将武将添加到编队中',
    triggerAction: 'add_to_formation',
    rewards: [],
  },
];

/** 步骤ID到定义的映射 */
export const TUTORIAL_GUIDE_STEP_MAP: Record<string, TutorialGuideStep> = Object.fromEntries(
  TUTORIAL_GUIDE_STEPS.map(s => [s.id, s]),
);

/** 触发行为到步骤的映射 */
export const TUTORIAL_GUIDE_ACTION_MAP: Record<string, TutorialGuideStep> = Object.fromEntries(
  TUTORIAL_GUIDE_STEPS.map(s => [s.triggerAction, s]),
);
