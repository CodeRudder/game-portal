/**
 * Engine 契约定义 — 集中管理 UI 组件对 Engine 的所有依赖关系。
 *
 * 任何 getter / 子系统 / registry key 变更都必须在此处更新，
 * 契约测试会自动验证，确保前后端不会因重构而断裂。
 *
 * 数据来源：
 *   getter 列表  ← engine-getters.ts（applyGetters 中的 p.xxx 赋值）
 *   registry     ← engine-extended-deps.ts / engine-offline-deps.ts / engine-guide-deps.ts
 *   依赖注入     ← initR11Systems / initGuideSystems 等函数中的 setXxx 调用
 *
 * @module tests/lib/engine-contract
 */

/** 返回子系统实例的 getter 方法名（不含参数化查询方法），必须返回非 null */
export const ENGINE_GETTER_CONTRACT = [
  // 武将系统
  'getHeroSystem', 'getRecruitSystem', 'getLevelSystem', 'getFormationSystem',
  'getHeroStarSystem', 'getSkillUpgradeSystem', 'getBondSystem',
  'getFormationRecommendSystem', 'getHeroDispatchSystem', 'getHeroBadgeSystem',
  'getHeroAttributeCompare', 'getSweepSystem', 'getVIPSystem', 'getChallengeStageSystem',
  // 战斗 / 关卡
  'getBattleEngine', 'getCampaignSystem', 'getRewardDistributor',
  // 科技系统
  'getTechTreeSystem', 'getTechPointSystem', 'getTechResearchSystem',
  // 地图系统
  'getWorldMapSystem', 'getTerritorySystem', 'getSiegeSystem',
  'getGarrisonSystem', 'getSiegeEnhancer', 'getMapEventSystem',
  // R11 子系统
  'getMailSystem', 'getMailTemplateSystem', 'getShopSystem', 'getCurrencySystem',
  'getNPCSystem', 'getEquipmentSystem', 'getEquipmentForgeSystem',
  'getEquipmentEnhanceSystem', 'getEquipmentSetSystem', 'getEquipmentRecommendSystem',
  'getArenaSystem', 'getSeasonSystem', 'getRankingSystem', 'getPvPBattleSystem',
  'getDefenseFormationSystem', 'getArenaShopSystem', 'getExpeditionSystem',
  'getAllianceSystem', 'getAllianceTaskSystem', 'getAllianceBossSystem',
  'getAllianceShopSystem', 'getPrestigeSystem', 'getPrestigeShopSystem',
  'getRebirthSystem', 'getQuestSystem', 'getAchievementSystem', 'getFriendSystem',
  'getChatSystem', 'getSocialLeaderboardSystem', 'getHeritageSystem',
  'getTimedActivitySystem', 'getAdvisorSystem', 'getActivitySystem', 'getSignInSystem',
  'getTradeSystem', 'getCaravanSystem', 'getResourceTradeEngine',
  'getSettingsManager', 'getAccountSystem', 'getEndingSystem', 'getGlobalStatisticsSystem',
  // 事件系统
  'getEventTriggerSystem', 'getEventNotificationSystem', 'getEventUINotification',
  'getEventChainSystem', 'getEventLogSystem', 'getOfflineEventSystem',
  // 离线系统
  'getOfflineRewardSystem', 'getOfflineEstimateSystem', 'getOfflineSnapshotSystem',
  // 引导系统
  'getTutorialStateMachine', 'getStoryEventPlayer', 'getTutorialStepManager',
  'getTutorialStepExecutor', 'getTutorialMaskSystem', 'getTutorialStorage',
  'getFirstLaunchDetector',
] as const;

/** 子系统间依赖关系（A 依赖 B，B 通过 setter 注入到 A） */
export const ENGINE_DEPENDENCY_CONTRACT = [
  { system: 'ShopSystem', dependency: 'CurrencySystem', via: 'setCurrencySystem' },
] as const;

/** Registry key 注册契约（来源：engine-*-deps.ts 中的 r.register 调用） */
export const REGISTRY_KEY_CONTRACT = [
  // engine-extended-deps.ts
  { subsystem: 'MailSystem', registeredKey: 'mail' },
  { subsystem: 'MailTemplateSystem', registeredKey: 'mailTemplate' },
  { subsystem: 'ShopSystem', registeredKey: 'shop' },
  { subsystem: 'CurrencySystem', registeredKey: 'currency' },
  { subsystem: 'NPCSystem', registeredKey: 'npc' },
  { subsystem: 'EquipmentSystem', registeredKey: 'equipment' },
  { subsystem: 'EquipmentForgeSystem', registeredKey: 'equipmentForge' },
  { subsystem: 'EquipmentEnhanceSystem', registeredKey: 'equipmentEnhance' },
  { subsystem: 'EquipmentSetSystem', registeredKey: 'equipmentSet' },
  { subsystem: 'EquipmentRecommendSystem', registeredKey: 'equipmentRecommend' },
  { subsystem: 'ArenaSystem', registeredKey: 'arena' },
  { subsystem: 'ArenaSeasonSystem', registeredKey: 'arenaSeason' },
  { subsystem: 'RankingSystem', registeredKey: 'ranking' },
  { subsystem: 'PvPBattleSystem', registeredKey: 'pvpBattle' },
  { subsystem: 'DefenseFormationSystem', registeredKey: 'defenseFormation' },
  { subsystem: 'ArenaShopSystem', registeredKey: 'arenaShop' },
  { subsystem: 'ExpeditionSystem', registeredKey: 'expedition' },
  { subsystem: 'AllianceSystem', registeredKey: 'alliance' },
  { subsystem: 'AllianceTaskSystem', registeredKey: 'allianceTask' },
  { subsystem: 'AllianceBossSystem', registeredKey: 'allianceBoss' },
  { subsystem: 'AllianceShopSystem', registeredKey: 'allianceShop' },
  { subsystem: 'PrestigeSystem', registeredKey: 'prestige' },
  { subsystem: 'PrestigeShopSystem', registeredKey: 'prestigeShop' },
  { subsystem: 'RebirthSystem', registeredKey: 'rebirth' },
  { subsystem: 'QuestSystem', registeredKey: 'quest' },
  { subsystem: 'AchievementSystem', registeredKey: 'achievement' },
  { subsystem: 'FriendSystem', registeredKey: 'friend' },
  { subsystem: 'ChatSystem', registeredKey: 'chat' },
  { subsystem: 'SocialLeaderboardSystem', registeredKey: 'socialLeaderboard' },
  { subsystem: 'HeritageSystem', registeredKey: 'heritage' },
  { subsystem: 'TimedActivitySystem', registeredKey: 'timedActivity' },
  { subsystem: 'AdvisorSystem', registeredKey: 'advisor' },
  { subsystem: 'ActivitySystem', registeredKey: 'activity' },
  { subsystem: 'SignInSystem', registeredKey: 'signIn' },
  { subsystem: 'TradeSystem', registeredKey: 'trade' },
  { subsystem: 'CaravanSystem', registeredKey: 'caravan' },
  { subsystem: 'ResourceTradeEngine', registeredKey: 'resourceTrade' },
  { subsystem: 'SettingsManager', registeredKey: 'settings' },
  { subsystem: 'AccountSystem', registeredKey: 'account' },
  { subsystem: 'EndingSystem', registeredKey: 'endingSystem' },
  { subsystem: 'GlobalStatisticsSystem', registeredKey: 'globalStatistics' },
  // engine-offline-deps.ts
  { subsystem: 'OfflineRewardSystem', registeredKey: 'offlineReward' },
  { subsystem: 'OfflineEstimateSystem', registeredKey: 'offlineEstimate' },
  { subsystem: 'OfflineSnapshotSystem', registeredKey: 'offlineSnapshot' },
  // engine-guide-deps.ts
  { subsystem: 'TutorialStateMachine', registeredKey: 'tutorialStateMachine' },
  { subsystem: 'StoryEventPlayer', registeredKey: 'storyEventPlayer' },
  { subsystem: 'TutorialStepManager', registeredKey: 'tutorialStepManager' },
  { subsystem: 'TutorialStepExecutor', registeredKey: 'tutorialStepExecutor' },
  { subsystem: 'TutorialMaskSystem', registeredKey: 'tutorialMaskSystem' },
  { subsystem: 'TutorialStorage', registeredKey: 'tutorialStorage' },
  { subsystem: 'FirstLaunchDetector', registeredKey: 'firstLaunchDetector' },
] as const;

/** 前端 Tab ID 与后端枚举的映射契约 */
export const TAB_ID_CONTRACT = {
  shop: {
    frontend: ['normal', 'black_market', 'limited_time', 'vip'] as const,
    backendType: 'ShopType' as const,
  },
} as const;
