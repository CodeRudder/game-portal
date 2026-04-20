/**
 * 核心层 — 新手引导系统类型定义
 *
 * 定义引导状态机、步骤管理、剧情事件、遮罩高亮、首次启动检测等类型。
 * 规则：只有 interface/type/enum/const，零逻辑
 *
 * 功能覆盖（v18.0 新手引导 18个功能点）：
 *   #1  引导状态机 — 5状态管理+转换条件
 *   #2  6步核心引导 — 步骤定义+子步骤
 *   #3  6步扩展引导 — 扩展步骤定义
 *   #4  阶段奖励 — 礼包+称号+中间奖励
 *   #5  8段剧情事件 — 剧情定义
 *   #6  剧情交互规则 — 打字机+自动播放+跳过
 *   #7  剧情触发时机 — 条件触发
 *   #8  引导进度存储 — 保存结构
 *   #9  冲突解决 — 并集策略
 *   #10 加速机制 — 4种加速方式
 *   #11 不可跳过内容 — 强制步骤
 *   #12 剧情跳过规则 — 二次确认+过渡
 *   #13 引导重玩 — 观看模式+奖励
 *   #14 自由探索过渡 — 推荐行动+已解锁
 *   #15 聚焦遮罩 — 遮罩配置
 *   #16 引导气泡 — 气泡配置
 *   #17 首次启动流程 — 语言/画质/权限
 *   #18 新手保护机制 — 30分钟保护
 *
 * @module core/guide/guide.types
 */

// ─────────────────────────────────────────────
// 1. 引导状态机 (#1)
// ─────────────────────────────────────────────

/** 引导状态机的5个状态 */
export type TutorialPhase =
  | 'not_started'       // 未开始（首次进入前）
  | 'core_guiding'      // 核心引导中（6步核心引导）
  | 'free_explore'      // 自由探索过渡（步骤6完成后）
  | 'free_play'         // 自由游戏（引导完成）
  | 'mini_tutorial';    // Mini-tutorial（条件触发的扩展引导）

/** 状态转换事件 */
export type TutorialTransition =
  | 'first_enter'       // 首次进入 → not_started → core_guiding
  | 'step6_complete'    // 步骤6完成 → core_guiding → free_explore
  | 'skip_to_explore'   // 加速跳过 → core_guiding → free_explore
  | 'explore_done'      // 过渡完成 → free_explore → free_play
  | 'condition_trigger' // 条件触发 → free_play → mini_tutorial
  | 'mini_done'         // Mini完成 → mini_tutorial → free_play
  | 'non_first_enter';  // 非首次进入 → 直接进入 free_play

/** 状态转换记录 */
export interface TutorialTransitionLog {
  /** 从哪个状态 */
  from: TutorialPhase;
  /** 到哪个状态 */
  to: TutorialPhase;
  /** 触发事件 */
  event: TutorialTransition;
  /** 时间戳 */
  timestamp: number;
}

// ─────────────────────────────────────────────
// 2. 引导步骤定义 (#2, #3)
// ─────────────────────────────────────────────

/** 步骤类别 */
export type TutorialStepCategory = 'core' | 'extended';

/** 6步核心引导步骤ID */
export type CoreStepId =
  | 'step1_castle_overview'    // 主城概览
  | 'step2_build_farm'         // 建造农田
  | 'step3_recruit_hero'       // 招募武将
  | 'step4_first_battle'       // 首次出征
  | 'step5_check_resources'    // 查看资源
  | 'step6_tech_research';     // 科技研究

/** 6步扩展引导步骤ID */
export type ExtendedStepId =
  | 'step7_advisor_suggest'    // 军师建议
  | 'step8_semi_auto_battle'   // 半自动战斗
  | 'step9_borrow_hero'        // 借将系统
  | 'step10_bag_manage'        // 背包管理
  | 'step11_tech_branch'       // 科技分支
  | 'step12_alliance';         // 联盟系统

/** 所有步骤ID */
export type TutorialStepId = CoreStepId | ExtendedStepId;

/** 子步骤信息 */
export interface TutorialSubStep {
  /** 子步骤ID（在步骤内唯一） */
  id: string;
  /** 显示文本 */
  text: string;
  /** 高亮目标元素选择器 */
  targetSelector: string;
  /** 是否不可跳过 (#11) */
  unskippable: boolean;
  /** 完成条件类型 */
  completionType: 'click' | 'action' | 'auto';
}

/** 步骤定义 */
export interface TutorialStepDefinition {
  /** 步骤ID */
  stepId: TutorialStepId;
  /** 步骤类别 */
  category: TutorialStepCategory;
  /** 步骤标题 */
  title: string;
  /** 步骤描述 */
  description: string;
  /** 子步骤列表 */
  subSteps: TutorialSubStep[];
  /** 前置步骤（需完成的步骤ID） */
  prerequisite?: TutorialStepId;
  /** 触发条件（扩展引导用） */
  triggerCondition?: TutorialStepTriggerCondition;
  /** 完成奖励 */
  rewards: TutorialReward[];
}

/** 扩展步骤触发条件 (#7) */
export interface TutorialStepTriggerCondition {
  /** 条件类型 */
  type: 'building_level' | 'hero_count' | 'battle_count' | 'tech_count' | 'alliance_joined';
  /** 条件值 */
  value: number | string;
}

// ─────────────────────────────────────────────
// 3. 剧情事件定义 (#5, #6, #7)
// ─────────────────────────────────────────────

/** 8段剧情事件ID */
export type StoryEventId =
  | 'e1_peach_garden'      // 桃园结义
  | 'e2_yellow_turban'     // 黄巾之乱
  | 'e3_three_visits'      // 三顾茅庐
  | 'e4_borrow_arrows'     // 草船借箭
  | 'e5_red_cliff'         // 赤壁之战
  | 'e6_single_sword'      // 单刀赴会
  | 'e7_seven_captures'    // 七擒孟获
  | 'e8_unification';      // 三国归一

/** 剧情对话行 */
export interface StoryDialogueLine {
  /** 角色名称（空字符串=旁白） */
  speaker: string;
  /** 文本内容 */
  text: string;
  /** 角色立绘ID（可选） */
  portraitId?: string;
}

/** 剧情事件定义 */
export interface StoryEventDefinition {
  /** 事件ID */
  eventId: StoryEventId;
  /** 标题 */
  title: string;
  /** 对话行列表 */
  dialogues: StoryDialogueLine[];
  /** 预计时长（毫秒） */
  estimatedDurationMs: number;
  /** 触发条件 */
  triggerCondition: StoryTriggerCondition;
  /** 完成奖励 */
  rewards: TutorialReward[];
}

/** 剧情触发条件 (#7) */
export interface StoryTriggerCondition {
  /** 触发类型 */
  type:
    | 'first_enter'          // 首次进入游戏
    | 'after_step'           // 某步骤完成后
    | 'first_recruit'        // 首次招募成功
    | 'castle_level'         // 主城等级
    | 'battle_count'         // 战斗次数
    | 'first_alliance'       // 首次加入联盟
    | 'tech_count'           // 科技研究数
    | 'all_steps_complete';  // 全部步骤完成
  /** 条件值 */
  value?: number | string;
}

// ─────────────────────────────────────────────
// 4. 奖励定义 (#4)
// ─────────────────────────────────────────────

/** 奖励类型 */
export type TutorialRewardType = 'currency' | 'item' | 'title' | 'package';

/** 引导奖励 */
export interface TutorialReward {
  /** 奖励类型 */
  type: TutorialRewardType;
  /** 奖励ID */
  rewardId: string;
  /** 奖励名称 */
  name: string;
  /** 数量 */
  amount: number;
}

/** 阶段奖励配置 */
export interface TutorialPhaseReward {
  /** 触发步骤 */
  triggerStepId: TutorialStepId;
  /** 奖励标题 */
  title: string;
  /** 奖励描述 */
  description: string;
  /** 奖励列表 */
  rewards: TutorialReward[];
}

// ─────────────────────────────────────────────
// 5. 剧情交互规则 (#6, #10, #11, #12)
// ─────────────────────────────────────────────

/** 打字机速度（毫秒/字） */
export const TYPEWRITER_SPEED_MS = 30;

/** 自动播放延迟（毫秒） */
export const AUTO_PLAY_DELAY_MS = 5000;

/** 动画加速倍率 */
export const ANIMATION_SPEED_MULTIPLIER = 3;

/** 一键完成等待时间（毫秒） */
export const QUICK_COMPLETE_THRESHOLD_MS = 60000;

/** 加速方式 */
export type AccelerationType =
  | 'dialogue_tap'       // 点击加速对话
  | 'story_skip'         // 剧情快进（跳过按钮）
  | 'animation_speed'    // 动画加速（×3）
  | 'quick_complete';    // 一键完成（>60s）

/** 不可跳过的步骤ID列表 (#11) */
export const UNSKIPPABLE_STEPS: string[] = [
  'step1_castle_overview',   // 步骤1-1 主城概览
  'step2_build_farm',        // 步骤2-3 确认建造
  'step4_first_battle',      // 步骤4-4 首次战斗
];

/** 剧情跳过确认 */
export interface StorySkipConfirm {
  /** 是否需要二次确认 */
  requireConfirm: boolean;
  /** 过渡效果 */
  transitionEffect: 'ink_wash';  // 水墨晕染
}

// ─────────────────────────────────────────────
// 6. 引导重玩 (#13)
// ─────────────────────────────────────────────

/** 每日重玩奖励上限 */
export const GUIDE_REPLAY_DAILY_LIMIT = 3;

/** 每次重玩奖励 */
export const GUIDE_REPLAY_REWARD: TutorialReward = {
  type: 'currency',
  rewardId: 'copper',
  name: '铜钱',
  amount: 100,
};

/** 重玩模式 */
export type ReplayMode = 'watch' | 'interactive';

// ─────────────────────────────────────────────
// 7. 自由探索过渡 (#14)
// ─────────────────────────────────────────────

/** 推荐行动 */
export interface RecommendedAction {
  /** 行动ID */
  id: string;
  /** 行动标题 */
  title: string;
  /** 行动描述 */
  description: string;
  /** 跳转目标 */
  target: string;
}

/** 已解锁功能 */
export interface UnlockedFeature {
  /** 功能ID */
  id: string;
  /** 功能名称 */
  name: string;
  /** 功能图标 */
  icon: string;
}

/** 自由探索过渡数据 */
export interface FreeExploreData {
  /** 推荐行动列表（3个） */
  recommendedActions: RecommendedAction[];
  /** 已解锁功能列表 */
  unlockedFeatures: UnlockedFeature[];
  /** 阶段奖励 */
  phaseReward: TutorialPhaseReward;
}

// ─────────────────────────────────────────────
// 8. 引导遮罩与高亮 (#15, #16)
// ─────────────────────────────────────────────

/** 遮罩配置 */
export interface TutorialMaskConfig {
  /** 遮罩透明度 (0~1) */
  opacity: number;
  /** 高亮区域边距 */
  padding: number;
  /** 圆角半径 */
  borderRadius: number;
  /** 是否显示引导手指动画 */
  showHandAnimation: boolean;
}

/** 默认遮罩配置 */
export const DEFAULT_MASK_CONFIG: TutorialMaskConfig = {
  opacity: 0.8,
  padding: 8,
  borderRadius: 8,
  showHandAnimation: true,
};

/** 气泡位置 */
export type BubblePosition = 'top' | 'bottom' | 'left' | 'right' | 'auto';

/** 引导气泡配置 */
export interface TutorialBubbleConfig {
  /** 显示文本 */
  text: string;
  /** 气泡位置 */
  position: BubblePosition;
  /** 箭头指向目标 */
  arrowTarget: string;
  /** 自动定位 */
  autoPosition: boolean;
  /** 最大宽度 */
  maxWidth: number;
}

// ─────────────────────────────────────────────
// 9. 首次启动 (#17)
// ─────────────────────────────────────────────

/** 画质档位 */
export type GraphicsQuality = 'low' | 'medium' | 'high';

/** 权限类型 */
export type PermissionType = 'storage' | 'network' | 'notification' | 'location';

/** 首次启动配置 */
export interface FirstLaunchConfig {
  /** 默认语言 */
  defaultLanguage: string;
  /** 推荐画质 */
  recommendedQuality: GraphicsQuality;
  /** 需要申请的权限 */
  requiredPermissions: PermissionType[];
}

/** 首次启动检测结果 */
export interface FirstLaunchDetection {
  /** 是否首次启动 */
  isFirstLaunch: boolean;
  /** 检测到的语言 */
  detectedLanguage: string;
  /** 推荐画质 */
  recommendedQuality: GraphicsQuality;
  /** 权限状态 */
  permissionStatus: Record<PermissionType, boolean>;
}

// ─────────────────────────────────────────────
// 10. 新手保护 (#18)
// ─────────────────────────────────────────────

/** 新手保护时长（毫秒）= 30分钟 */
export const NEWBIE_PROTECTION_DURATION_MS = 30 * 60 * 1000;

/** 新手保护配置 */
export interface NewbieProtectionConfig {
  /** 保护时长（毫秒） */
  durationMs: number;
  /** 资源消耗折扣（0~1，0.5=减半） */
  resourceCostDiscount: number;
  /** 战斗难度系数（0~1，越小越简单） */
  battleDifficultyFactor: number;
  /** 仅正面事件 */
  positiveEventsOnly: boolean;
}

/** 默认新手保护配置 */
export const DEFAULT_NEWBIE_PROTECTION: NewbieProtectionConfig = {
  durationMs: NEWBIE_PROTECTION_DURATION_MS,
  resourceCostDiscount: 0.5,
  battleDifficultyFactor: 0.7,
  positiveEventsOnly: true,
};

// ─────────────────────────────────────────────
// 11. 引导进度存储 (#8, #9)
// ─────────────────────────────────────────────

/** 引导系统存档数据 */
export interface TutorialSaveData {
  /** 存档版本 */
  version: number;
  /** 当前引导阶段 */
  currentPhase: TutorialPhase;
  /** 已完成的步骤ID列表 */
  completedSteps: TutorialStepId[];
  /** 已完成的剧情事件ID列表 */
  completedEvents: StoryEventId[];
  /** 当前步骤ID */
  currentStepId: TutorialStepId | null;
  /** 当前子步骤索引 */
  currentSubStepIndex: number;
  /** 引导开始时间戳 */
  tutorialStartTime: number | null;
  /** 状态转换日志 */
  transitionLogs: TutorialTransitionLog[];
  /** 重玩次数（今日） */
  dailyReplayCount: number;
  /** 上次重玩日期 */
  lastReplayDate: string;
  /** 新手保护开始时间 */
  protectionStartTime: number | null;
}

/** 引导系统存档版本 */
export const TUTORIAL_SAVE_VERSION = 1;

/** 冲突解决策略 (#9) */
export type ConflictResolution = 'union_max';

// ─────────────────────────────────────────────
// 12. 引导系统事件类型
// ─────────────────────────────────────────────

/** 引导系统事件映射 */
export interface TutorialEventMap {
  /** 状态转换 */
  'tutorial:phaseChanged': TutorialTransitionLog;
  /** 步骤完成 */
  'tutorial:stepCompleted': { stepId: TutorialStepId; timestamp: number };
  /** 子步骤完成 */
  'tutorial:subStepCompleted': { stepId: TutorialStepId; subStepIndex: number };
  /** 剧情事件触发 */
  'tutorial:storyTriggered': { eventId: StoryEventId };
  /** 剧情事件完成 */
  'tutorial:storyCompleted': { eventId: StoryEventId; skipped: boolean };
  /** 奖励发放 */
  'tutorial:rewardGranted': { rewards: TutorialReward[]; source: string };
  /** 加速触发 */
  'tutorial:accelerated': { type: AccelerationType };
  /** 引导完成 */
  'tutorial:completed': { timestamp: number };
  /** 首次启动检测完成 */
  'tutorial:firstLaunchDetected': FirstLaunchDetection;
  /** 新手保护状态变更 */
  'tutorial:protectionChanged': { active: boolean; remainingMs: number };
}
