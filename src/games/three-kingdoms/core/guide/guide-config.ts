/**
 * 核心层 — 新手引导系统配置
 *
 * 定义引导步骤和剧情事件的具体配置数据。
 * 规则：只有 const 数据，零逻辑
 *
 * @module core/guide/guide-config
 */

import type {
  TutorialStepDefinition,
  StoryEventDefinition,
  TutorialPhaseReward,
  RecommendedAction,
  TutorialReward,
  CoreStepId,
  ExtendedStepId,
  StoryEventId,
} from './guide.types';

// ─────────────────────────────────────────────
// 1. 6步核心引导步骤配置 (#2)
// ─────────────────────────────────────────────

/** 核心步骤配置 */
export const CORE_STEP_DEFINITIONS: TutorialStepDefinition[] = [
  {
    stepId: 'step1_castle_overview',
    category: 'core',
    title: '初入乱世，立足根基',
    description: '了解主界面布局、资源栏和导航Tab',
    subSteps: [
      { id: '1-1', text: '欢迎来到三国乱世！这是你的主城。', targetSelector: '#main-castle', unskippable: true, completionType: 'click' },
      { id: '1-2', text: '上方是资源栏，显示你的铜钱、粮草等资源。', targetSelector: '#resource-bar', unskippable: false, completionType: 'click' },
      { id: '1-3', text: '底部是导航Tab，可以切换不同功能界面。', targetSelector: '#nav-tab', unskippable: false, completionType: 'click' },
      { id: '1-4', text: '左侧是建筑区域，可以建造和升级各种建筑。', targetSelector: '#building-area', unskippable: false, completionType: 'click' },
      { id: '1-5', text: '准备好了吗？让我们开始建造吧！', targetSelector: '#building-area', unskippable: false, completionType: 'click' },
    ],
    rewards: [{ type: 'currency', rewardId: 'copper', name: '铜钱', amount: 200 }],
  },
  {
    stepId: 'step2_build_farm',
    category: 'core',
    title: '兵马未动，粮草先行',
    description: '学习建造系统，建造你的第一座农田',
    subSteps: [
      { id: '2-1', text: '点击空地可以建造新建筑。', targetSelector: '#empty-plot', unskippable: false, completionType: 'click' },
      { id: '2-2', text: '选择农田建筑，它是资源产出的基础。', targetSelector: '#building-farm', unskippable: false, completionType: 'click' },
      { id: '2-3', text: '确认建造！农田将持续产出粮草。', targetSelector: '#confirm-build', unskippable: true, completionType: 'action' },
      { id: '2-4', text: '建造需要一定时间，可以点击加速。', targetSelector: '#speed-up', unskippable: false, completionType: 'click' },
      { id: '2-5', text: '很好！农田已建造完成。', targetSelector: '#building-area', unskippable: false, completionType: 'auto' },
    ],
    prerequisite: 'step1_castle_overview',
    rewards: [{ type: 'currency', rewardId: 'grain', name: '粮草', amount: 500 }],
  },
  {
    stepId: 'step3_recruit_hero',
    category: 'core',
    title: '千军易得，一将难求',
    description: '学习武将系统，招募你的第一位武将',
    subSteps: [
      { id: '3-1', text: '点击酒馆可以招募武将。', targetSelector: '#tavern', unskippable: false, completionType: 'click' },
      { id: '3-2', text: '选择一位武将进行招募。', targetSelector: '#hero-list', unskippable: false, completionType: 'click' },
      { id: '3-3', text: '确认招募！武将将加入你的麾下。', targetSelector: '#confirm-recruit', unskippable: false, completionType: 'action' },
      { id: '3-4', text: '在武将界面可以查看武将属性和技能。', targetSelector: '#hero-detail', unskippable: false, completionType: 'click' },
      { id: '3-5', text: '武将已就位，准备出征！', targetSelector: '#hero-detail', unskippable: false, completionType: 'auto' },
    ],
    prerequisite: 'step2_build_farm',
    rewards: [{ type: 'item', rewardId: 'recruit_ticket', name: '招贤令', amount: 1 }],
  },
  {
    stepId: 'step4_first_battle',
    category: 'core',
    title: '出征！扬我军威',
    description: '学习战斗流程：选关→布阵→战斗',
    subSteps: [
      { id: '4-1', text: '点击出征按钮进入战役界面。', targetSelector: '#campaign-btn', unskippable: false, completionType: 'click' },
      { id: '4-2', text: '选择第一关「黄巾之乱」。', targetSelector: '#stage-1', unskippable: false, completionType: 'click' },
      { id: '4-3', text: '布阵：将武将拖入战场位置。', targetSelector: '#formation', unskippable: false, completionType: 'action' },
      { id: '4-4', text: '开战！观看战斗过程。', targetSelector: '#battle-start', unskippable: true, completionType: 'action' },
      { id: '4-5', text: '战斗胜利！获得了战利品。', targetSelector: '#battle-result', unskippable: false, completionType: 'auto' },
    ],
    prerequisite: 'step3_recruit_hero',
    rewards: [{ type: 'currency', rewardId: 'copper', name: '铜钱', amount: 500 }],
  },
  {
    stepId: 'step5_check_resources',
    category: 'core',
    title: '开源节流，富国强兵',
    description: '了解资源类型、产出速率和消耗途径',
    subSteps: [
      { id: '5-1', text: '点击资源栏查看详细资源信息。', targetSelector: '#resource-bar', unskippable: false, completionType: 'click' },
      { id: '5-2', text: '铜钱用于建造和招募，粮草用于出征。', targetSelector: '#resource-detail', unskippable: false, completionType: 'click' },
      { id: '5-3', text: '产出速率由建筑等级和数量决定。', targetSelector: '#production-rate', unskippable: false, completionType: 'click' },
      { id: '5-4', text: '合理分配资源是发展的关键！', targetSelector: '#resource-detail', unskippable: false, completionType: 'auto' },
    ],
    prerequisite: 'step4_first_battle',
    rewards: [{ type: 'currency', rewardId: 'grain', name: '粮草', amount: 300 }],
  },
  {
    stepId: 'step6_tech_research',
    category: 'core',
    title: '运筹帷幄，决胜千里',
    description: '学习科技系统，选择研究方向',
    subSteps: [
      { id: '6-1', text: '点击科技按钮进入科技树。', targetSelector: '#tech-btn', unskippable: false, completionType: 'click' },
      { id: '6-2', text: '科技树分为多个分支，每条路线有不同加成。', targetSelector: '#tech-tree', unskippable: false, completionType: 'click' },
      { id: '6-3', text: '选择一个科技开始研究。', targetSelector: '#tech-node', unskippable: false, completionType: 'click' },
      { id: '6-4', text: '确认研究！研究需要一定时间完成。', targetSelector: '#confirm-research', unskippable: false, completionType: 'action' },
      { id: '6-5', text: '恭喜！你已完成核心引导。', targetSelector: '#tech-tree', unskippable: false, completionType: 'auto' },
    ],
    prerequisite: 'step5_check_resources',
    rewards: [
      { type: 'currency', rewardId: 'copper', name: '铜钱', amount: 2000 },
      { type: 'currency', rewardId: 'grain', name: '粮草', amount: 1000 },
      { type: 'item', rewardId: 'recruit_ticket', name: '招贤令', amount: 1 },
    ],
  },
];

// ─────────────────────────────────────────────
// 2. 6步扩展引导步骤配置 (#3)
// ─────────────────────────────────────────────

/** 扩展步骤配置 */
export const EXTENDED_STEP_DEFINITIONS: TutorialStepDefinition[] = [
  {
    stepId: 'step7_advisor_suggest',
    category: 'extended',
    title: '军师献策',
    description: '了解军师建议系统',
    subSteps: [
      { id: '7-1', text: '军师会根据局势给出建议。', targetSelector: '#advisor-panel', unskippable: false, completionType: 'click' },
      { id: '7-2', text: '点击建议可查看详情并执行。', targetSelector: '#advisor-suggestion', unskippable: false, completionType: 'click' },
    ],
    triggerCondition: { type: 'building_level', value: 3 },
    rewards: [{ type: 'currency', rewardId: 'copper', name: '铜钱', amount: 300 }],
  },
  {
    stepId: 'step8_semi_auto_battle',
    category: 'extended',
    title: '半自动战斗',
    description: '学习半自动战斗模式',
    subSteps: [
      { id: '8-1', text: '战斗中可以开启半自动模式。', targetSelector: '#auto-battle-btn', unskippable: false, completionType: 'click' },
      { id: '8-2', text: '武将将在合适时机自动释放技能。', targetSelector: '#battle-ui', unskippable: false, completionType: 'click' },
    ],
    triggerCondition: { type: 'battle_count', value: 3 },
    rewards: [{ type: 'currency', rewardId: 'copper', name: '铜钱', amount: 200 }],
  },
  {
    stepId: 'step9_borrow_hero',
    category: 'extended',
    title: '借将系统',
    description: '学习借用好友武将',
    subSteps: [
      { id: '9-1', text: '出征前可以借用好友的武将助战。', targetSelector: '#borrow-hero-btn', unskippable: false, completionType: 'click' },
      { id: '9-2', text: '选择一位强力武将加入你的阵容。', targetSelector: '#borrow-list', unskippable: false, completionType: 'click' },
    ],
    triggerCondition: { type: 'battle_count', value: 5 },
    rewards: [{ type: 'currency', rewardId: 'copper', name: '铜钱', amount: 200 }],
  },
  {
    stepId: 'step10_bag_manage',
    category: 'extended',
    title: '背包管理',
    description: '学习管理背包物品',
    subSteps: [
      { id: '10-1', text: '背包中存放着各种道具和装备。', targetSelector: '#bag-btn', unskippable: false, completionType: 'click' },
      { id: '10-2', text: '点击物品可查看详情和使用。', targetSelector: '#bag-item', unskippable: false, completionType: 'click' },
    ],
    triggerCondition: { type: 'building_level', value: 4 },
    rewards: [{ type: 'currency', rewardId: 'copper', name: '铜钱', amount: 200 }],
  },
  {
    stepId: 'step11_tech_branch',
    category: 'extended',
    title: '科技分支',
    description: '了解科技树的分支选择',
    subSteps: [
      { id: '11-1', text: '科技树有多条分支路线。', targetSelector: '#tech-tree', unskippable: false, completionType: 'click' },
      { id: '11-2', text: '选择不同路线获得不同加成效果。', targetSelector: '#tech-branch', unskippable: false, completionType: 'click' },
    ],
    triggerCondition: { type: 'tech_count', value: 3 },
    rewards: [{ type: 'currency', rewardId: 'copper', name: '铜钱', amount: 300 }],
  },
  {
    stepId: 'step12_alliance',
    category: 'extended',
    title: '联盟系统',
    description: '加入联盟，与其他玩家合作',
    subSteps: [
      { id: '12-1', text: '加入联盟可以获得更多资源和支援。', targetSelector: '#alliance-btn', unskippable: false, completionType: 'click' },
      { id: '12-2', text: '选择一个联盟申请加入。', targetSelector: '#alliance-list', unskippable: false, completionType: 'click' },
    ],
    triggerCondition: { type: 'alliance_joined', value: 1 },
    rewards: [{ type: 'title', rewardId: 'graduate_title', name: '新手毕业', amount: 1 }],
  },
];

// ─────────────────────────────────────────────
// 3. 8段剧情事件配置 (#5, #7)
// ─────────────────────────────────────────────

/** 剧情事件配置 */
export const STORY_EVENT_DEFINITIONS: StoryEventDefinition[] = [
  {
    eventId: 'e1_peach_garden',
    title: '桃园结义',
    dialogues: [
      { speaker: '', text: '东汉末年，天下大乱，群雄并起……' },
      { speaker: '刘备', text: '我虽力薄，但愿匡扶汉室，救万民于水火！' },
      { speaker: '关羽', text: '关某愿追随兄长，赴汤蹈火，在所不辞！' },
      { speaker: '张飞', text: '俺也一样！大哥说干啥就干啥！' },
      { speaker: '', text: '三人于桃园焚香结义，立誓同生共死。' },
      { speaker: '旁白', text: '桃园三结义，传为千古佳话。' },
    ],
    estimatedDurationMs: 45000,
    triggerCondition: { type: 'first_enter' },
    rewards: [{ type: 'currency', rewardId: 'copper', name: '铜钱', amount: 500 }],
  },
  {
    eventId: 'e2_yellow_turban',
    title: '黄巾之乱',
    dialogues: [
      { speaker: '', text: '黄巾贼四处作乱，百姓苦不堪言。' },
      { speaker: '刘备', text: '黄巾贼寇为祸一方，我们必须出兵平乱！' },
      { speaker: '关羽', text: '兄长放心，关某的青龙偃月刀已饥渴难耐！' },
      { speaker: '', text: '三人率义军大破黄巾，初露锋芒。' },
    ],
    estimatedDurationMs: 40000,
    triggerCondition: { type: 'after_step', value: 'step3_recruit_hero' },
    rewards: [{ type: 'currency', rewardId: 'copper', name: '铜钱', amount: 300 }],
  },
  {
    eventId: 'e3_three_visits',
    title: '三顾茅庐',
    dialogues: [
      { speaker: '', text: '刘备听闻卧龙先生诸葛亮隐居隆中。' },
      { speaker: '刘备', text: '若得先生相助，何愁大事不成！' },
      { speaker: '诸葛亮', text: '将军三顾茅庐，亮愿效犬马之劳。' },
      { speaker: '', text: '自此，卧龙出山，如虎添翼。' },
    ],
    estimatedDurationMs: 35000,
    triggerCondition: { type: 'first_recruit' },
    rewards: [{ type: 'item', rewardId: 'recruit_ticket', name: '招贤令', amount: 1 }],
  },
  {
    eventId: 'e4_borrow_arrows',
    title: '草船借箭',
    dialogues: [
      { speaker: '诸葛亮', text: '大雾漫天，正可用计。' },
      { speaker: '', text: '诸葛亮以草船借得曹军十万支箭。' },
      { speaker: '周瑜', text: '诸葛亮神机妙算，吾不如也！' },
    ],
    estimatedDurationMs: 30000,
    triggerCondition: { type: 'after_step', value: 'step5_check_resources' },
    rewards: [{ type: 'currency', rewardId: 'copper', name: '铜钱', amount: 300 }],
  },
  {
    eventId: 'e5_red_cliff',
    title: '赤壁之战',
    dialogues: [
      { speaker: '诸葛亮', text: '万事俱备，只欠东风。' },
      { speaker: '', text: '东风骤起，火烧赤壁，曹军大败。' },
      { speaker: '刘备', text: '此战大捷，三分天下之势已成！' },
      { speaker: '', text: '赤壁一战，奠定了三国鼎立的基础。' },
    ],
    estimatedDurationMs: 45000,
    triggerCondition: { type: 'castle_level', value: 5 },
    rewards: [{ type: 'currency', rewardId: 'copper', name: '铜钱', amount: 500 }],
  },
  {
    eventId: 'e6_single_sword',
    title: '单刀赴会',
    dialogues: [
      { speaker: '关羽', text: '吾单刀赴会，何惧之有！' },
      { speaker: '', text: '关羽单刀赴鲁肃之宴，胆略过人。' },
      { speaker: '鲁肃', text: '关将军真乃世之虎将也！' },
    ],
    estimatedDurationMs: 30000,
    triggerCondition: { type: 'first_alliance' },
    rewards: [{ type: 'currency', rewardId: 'copper', name: '铜钱', amount: 200 }],
  },
  {
    eventId: 'e7_seven_captures',
    title: '七擒孟获',
    dialogues: [
      { speaker: '诸葛亮', text: '攻心为上，攻城为下。' },
      { speaker: '', text: '七擒七纵，孟获终于心服口服。' },
      { speaker: '孟获', text: '丞相天威，南人誓不复反！' },
    ],
    estimatedDurationMs: 35000,
    triggerCondition: { type: 'tech_count', value: 4 },
    rewards: [{ type: 'currency', rewardId: 'copper', name: '铜钱', amount: 300 }],
  },
  {
    eventId: 'e8_unification',
    title: '三国归一',
    dialogues: [
      { speaker: '', text: '经过多年征战，天下终归一统。' },
      { speaker: '刘备', text: '天下太平，百姓安居乐业，此乃吾愿也。' },
      { speaker: '', text: '恭喜你完成了所有新手引导，真正的征途才刚刚开始！' },
    ],
    estimatedDurationMs: 40000,
    triggerCondition: { type: 'all_steps_complete' },
    rewards: [
      { type: 'currency', rewardId: 'copper', name: '铜钱', amount: 1000 },
      { type: 'item', rewardId: 'recruit_ticket', name: '招贤令', amount: 2 },
    ],
  },
];

// ─────────────────────────────────────────────
// 4. 阶段奖励配置 (#4)
// ─────────────────────────────────────────────

/** 阶段奖励配置 */
export const TUTORIAL_PHASE_REWARDS: TutorialPhaseReward[] = [
  {
    triggerStepId: 'step6_tech_research',
    title: '初出茅庐',
    description: '完成核心引导，获得新手礼包！',
    rewards: [
      { type: 'currency', rewardId: 'copper', name: '铜钱', amount: 2000 },
      { type: 'currency', rewardId: 'grain', name: '粮草', amount: 1000 },
      { type: 'item', rewardId: 'recruit_ticket', name: '招贤令', amount: 1 },
    ],
  },
  {
    triggerStepId: 'step12_alliance',
    title: '新手毕业',
    description: '完成全部引导，获得毕业称号！',
    rewards: [
      { type: 'title', rewardId: 'graduate_title', name: '新手毕业', amount: 1 },
      { type: 'currency', rewardId: 'copper', name: '铜钱', amount: 3000 },
    ],
  },
];

// ─────────────────────────────────────────────
// 5. 自由探索过渡推荐行动 (#14)
// ─────────────────────────────────────────────

/** 自由探索推荐行动 */
export const DEFAULT_RECOMMENDED_ACTIONS: RecommendedAction[] = [
  {
    id: 'upgrade_building',
    title: '升级主城建筑',
    description: '提升建筑等级，增加资源产出',
    target: '#building-area',
  },
  {
    id: 'recruit_more',
    title: '招募更多武将',
    description: '扩充阵容，应对更强的敌人',
    target: '#tavern',
  },
  {
    id: 'explore_map',
    title: '探索世界地图',
    description: '占领更多领地，扩大势力范围',
    target: '#world-map',
  },
];

// ─────────────────────────────────────────────
// 6. 步骤ID辅助映射
// ─────────────────────────────────────────────

/** 所有步骤定义（核心+扩展） */
export const ALL_STEP_DEFINITIONS: TutorialStepDefinition[] = [
  ...CORE_STEP_DEFINITIONS,
  ...EXTENDED_STEP_DEFINITIONS,
];

/** 步骤ID到定义的映射 */
export const STEP_DEFINITION_MAP: Record<string, TutorialStepDefinition> = Object.fromEntries(
  ALL_STEP_DEFINITIONS.map(d => [d.stepId, d]),
);

/** 剧情事件ID到定义的映射 */
export const STORY_EVENT_MAP: Record<string, StoryEventDefinition> = Object.fromEntries(
  STORY_EVENT_DEFINITIONS.map(d => [d.eventId, d]),
);
