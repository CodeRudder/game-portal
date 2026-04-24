/**
 * 游戏里程碑枚举
 *
 * 定义游戏流程中的关键节点，用于流程集成测试。
 * 每个里程碑代表玩家达成的重要进度。
 */

export enum GameMilestone {
  // ─────────────────────────────────────────
  // v1.0 基业初立
  // ─────────────────────────────────────────

  /** 游戏开始（引擎初始化完成） */
  GAME_STARTED = 'game_started',

  /** 完成新手教程（获得初始资源 + 求贤令） */
  TUTORIAL_COMPLETED = 'tutorial_completed',

  /** 主城达到 3 级（解锁更多建筑） */
  MAIN_CITY_LV3 = 'main_city_lv3',

  /** 主城达到 5 级（解锁招贤馆） */
  MAIN_CITY_LV5 = 'main_city_lv5',

  /** 主城达到 10 级 */
  MAIN_CITY_LV10 = 'main_city_lv10',

  // ─────────────────────────────────────────
  // v2.0 招贤纳士
  // ─────────────────────────────────────────

  /** 招贤馆解锁（主城 5 级后可建造） */
  RECRUIT_HALL_UNLOCKED = 'recruit_hall_unlocked',

  /** 首次招募武将（消耗求贤令） */
  FIRST_HERO_RECRUITED = 'first_hero_recruited',

  /** 拥有 5 名武将 */
  HERO_COUNT_5 = 'hero_count_5',

  /** 拥有 10 名武将 */
  HERO_COUNT_10 = 'hero_count_10',

  // ─────────────────────────────────────────
  // v3.0 攻城略地
  // ─────────────────────────────────────────

  /** 首次通关（完成第一个关卡） */
  FIRST_STAGE_CLEARED = 'first_stage_cleared',

  /** 第一章完成（通关前 10 个关卡） */
  CHAPTER_1_COMPLETED = 'chapter_1_completed',

  // ─────────────────────────────────────────
  // v4.0 兵强马壮
  // ─────────────────────────────────────────

  /** 兵营达到 10 级 */
  BARRACKS_LV10 = 'barracks_lv10',

  /** 兵力达到 1000 */
  ARMY_SIZE_1000 = 'army_size_1000',

  /** 兵力达到 10000 */
  ARMY_SIZE_10000 = 'army_size_10000',

  // ─────────────────────────────────────────
  // v5.0 资源富足
  // ─────────────────────────────────────────

  /** 农田达到 10 级 */
  FARMLAND_LV10 = 'farmland_lv10',

  /** 金币达到 100000 */
  GOLD_100K = 'gold_100k',

  /** 粮草达到 100000 */
  GRAIN_100K = 'grain_100k',
}

/**
 * 里程碑依赖关系
 * 定义达成某个里程碑所需的前置里程碑
 */
export const MILESTONE_DEPENDENCIES: Partial<Record<GameMilestone, GameMilestone[]>> = {
  [GameMilestone.TUTORIAL_COMPLETED]: [GameMilestone.GAME_STARTED],
  [GameMilestone.MAIN_CITY_LV3]: [GameMilestone.TUTORIAL_COMPLETED],
  [GameMilestone.MAIN_CITY_LV5]: [GameMilestone.MAIN_CITY_LV3],
  [GameMilestone.MAIN_CITY_LV10]: [GameMilestone.MAIN_CITY_LV5],
  [GameMilestone.RECRUIT_HALL_UNLOCKED]: [GameMilestone.MAIN_CITY_LV5],
  [GameMilestone.FIRST_HERO_RECRUITED]: [GameMilestone.RECRUIT_HALL_UNLOCKED],
  [GameMilestone.HERO_COUNT_5]: [GameMilestone.FIRST_HERO_RECRUITED],
  [GameMilestone.HERO_COUNT_10]: [GameMilestone.HERO_COUNT_5],
  [GameMilestone.FIRST_STAGE_CLEARED]: [GameMilestone.FIRST_HERO_RECRUITED],
  [GameMilestone.CHAPTER_1_COMPLETED]: [GameMilestone.FIRST_STAGE_CLEARED],
};
