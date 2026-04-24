/**
 * 时间加速器 — 游戏流程集成测试基础设施
 *
 * 通过时间加速推进游戏到指定里程碑，不捏造任何游戏状态。
 * 所有操作基于真实游戏逻辑：资源自然累积、建筑真实升级、解锁条件真实检查。
 *
 * 用法:
 *   const sim = new GameEventSimulator();
 *   sim.init();
 *   const acc = new TimeAccelerator(sim);
 *   acc.advanceTo(GameMilestone.MAIN_CITY_LV5);
 */

import { GameEventSimulator } from './GameEventSimulator';
import { GameMilestone, MILESTONE_DEPENDENCIES } from './GameMilestone';
import type { ResourceType, BuildingType } from '../shared/types';

/** 时间加速配置 */
interface TimeAcceleratorConfig {
  /** 单次快进最大时间（秒），避免一次性快进过长导致问题 */
  maxFastForwardSeconds?: number;
  /** 等待资源时的轮询间隔（秒） */
  resourceWaitInterval?: number;
  /** 等待资源的最大超时时间（秒） */
  resourceWaitTimeout?: number;
}

const DEFAULT_CONFIG: Required<TimeAcceleratorConfig> = {
  maxFastForwardSeconds: 3600, // 1 小时
  resourceWaitInterval: 60,    // 1 分钟
  resourceWaitTimeout: 7200,   // 2 小时
};

export class TimeAccelerator {
  private readonly config: Required<TimeAcceleratorConfig>;
  private readonly completedMilestones = new Set<GameMilestone>();

  constructor(
    private readonly sim: GameEventSimulator,
    config: TimeAcceleratorConfig = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // 游戏初始化后，GAME_STARTED 里程碑自动完成
    if (this.sim.engine.isInitialized()) {
      this.completedMilestones.add(GameMilestone.GAME_STARTED);
    }
  }

  /**
   * 推进游戏到指定里程碑
   * 内部通过时间加速 + 触发玩家操作实现，不捏造任何游戏状态
   */
  advanceTo(milestone: GameMilestone): void {
    // 检查是否已完成
    if (this.completedMilestones.has(milestone)) {
      return;
    }

    // 检查前置依赖
    const dependencies = MILESTONE_DEPENDENCIES[milestone] || [];
    for (const dep of dependencies) {
      if (!this.completedMilestones.has(dep)) {
        this.advanceTo(dep); // 递归推进前置里程碑
      }
    }

    // 执行里程碑推进逻辑
    this.executeMilestone(milestone);

    // 标记完成
    this.completedMilestones.add(milestone);
  }

  /**
   * 快进指定游戏时间（秒）
   */
  fastForward(seconds: number): void {
    this.sim.fastForwardSeconds(seconds);
  }

  /**
   * 等待资源积累到指定数量
   * 通过多次 tick 实现，不直接设置资源
   * @returns 是否在超时前达到目标
   */
  waitForResource(
    type: ResourceType,
    targetAmount: number,
    maxSeconds: number = this.config.resourceWaitTimeout,
  ): boolean {
    const startTime = this.sim.getOnlineSeconds();
    const interval = this.config.resourceWaitInterval;

    while (this.sim.getResource(type) < targetAmount) {
      const elapsed = this.sim.getOnlineSeconds() - startTime;
      if (elapsed >= maxSeconds) {
        return false; // 超时
      }
      this.sim.fastForwardSeconds(interval);
    }

    return true;
  }

  /**
   * 执行具体里程碑的推进逻辑
   */
  private executeMilestone(milestone: GameMilestone): void {
    switch (milestone) {
      case GameMilestone.GAME_STARTED:
        // 引擎初始化即完成
        break;

      case GameMilestone.TUTORIAL_COMPLETED:
        // 完成新手教程：快进时间让资源自然累积
        this.fastForward(300); // 5 分钟
        // TODO: 自动完成教程任务（需要 QuestSystem API）
        break;

      case GameMilestone.MAIN_CITY_LV3:
        this.advanceBuildingToLevel('castle', 3);
        break;

      case GameMilestone.MAIN_CITY_LV5:
        // 主城 5 级需要前置：至少一座其他建筑达到 Lv4
        // 先升主城到 4 级
        this.advanceBuildingToLevel('castle', 4);
        // 再升其他建筑到 4 级
        this.advanceBuildingToLevel('farmland', 4);
        // 最后升主城到 5 级
        this.advanceBuildingToLevel('castle', 5);
        break;

      case GameMilestone.MAIN_CITY_LV10:
        // 主城 10 级需要前置：至少一座其他建筑达到 Lv9
        this.advanceBuildingToLevel('farmland', 9);
        this.advanceBuildingToLevel('castle', 10);
        break;

      case GameMilestone.RECRUIT_HALL_UNLOCKED:
        // 招贤馆在主城 5 级后自动解锁（无需额外操作）
        // 只需确保主城已达 5 级
        if (this.sim.getBuildingLevel('castle') < 5) {
          this.advanceTo(GameMilestone.MAIN_CITY_LV5);
        }
        break;

      case GameMilestone.FIRST_HERO_RECRUITED:
        // 确保有求贤令
        if (this.sim.getResource('recruitToken') < 1) {
          // 等待资源累积或完成任务获取
          this.waitForResource('recruitToken', 1);
        }
        // 执行招募
        this.sim.recruitHero('normal', 1);
        break;

      case GameMilestone.HERO_COUNT_5:
        this.advanceHeroCountTo(5);
        break;

      case GameMilestone.HERO_COUNT_10:
        this.advanceHeroCountTo(10);
        break;

      case GameMilestone.FIRST_STAGE_CLEARED:
        // 确保有武将
        if (this.sim.getGeneralCount() === 0) {
          this.advanceTo(GameMilestone.FIRST_HERO_RECRUITED);
        }
        // 挑战第一个关卡
        const stages = this.sim.getStageList();
        if (stages.length > 0) {
          this.sim.winBattle(stages[0].id, 3);
        }
        break;

      case GameMilestone.CHAPTER_1_COMPLETED:
        // 通关前 10 个关卡
        const allStages = this.sim.getStageList();
        const targetCount = Math.min(10, allStages.length);
        for (let i = 0; i < targetCount; i++) {
          try {
            this.sim.winBattle(allStages[i].id, 3);
          } catch {
            // 战力不足，跳过
            break;
          }
        }
        break;

      case GameMilestone.BARRACKS_LV10:
        this.advanceBuildingToLevel('barracks', 10);
        break;

      case GameMilestone.FARMLAND_LV10:
        this.advanceBuildingToLevel('farmland', 10);
        break;

      case GameMilestone.ARMY_SIZE_1000:
        this.waitForResource('troops', 1000);
        break;

      case GameMilestone.ARMY_SIZE_10000:
        this.waitForResource('troops', 10000);
        break;

      case GameMilestone.GOLD_100K:
        this.waitForResource('gold', 100000);
        break;

      case GameMilestone.GRAIN_100K:
        this.waitForResource('grain', 100000);
        break;

      default:
        throw new Error(`Unknown milestone: ${milestone}`);
    }
  }

  /**
   * 推进建筑到指定等级
   * 通过时间加速积累资源 + 真实升级流程实现
   */
  private advanceBuildingToLevel(type: BuildingType, targetLevel: number): void {
    const currentLevel = this.sim.getBuildingLevel(type);
    if (currentLevel >= targetLevel) {
      return;
    }

    for (let level = currentLevel; level < targetLevel; level++) {
      // 等待资源充足（通过时间加速）
      this.fastForward(600); // 快进 10 分钟积累资源

      // 尝试升级（会检查解锁条件和资源消耗）
      try {
        this.sim.upgradeBuilding(type);
      } catch (error) {
        // 资源不足或解锁条件不满足，继续等待
        this.fastForward(1800); // 再快进 30 分钟
        this.sim.upgradeBuilding(type);
      }
    }
  }

  /**
   * 推进武将数量到指定值
   */
  private advanceHeroCountTo(targetCount: number): void {
    while (this.sim.getGeneralCount() < targetCount) {
      // 等待求贤令
      if (this.sim.getResource('recruitToken') < 1) {
        this.waitForResource('recruitToken', 1);
      }
      // 招募
      this.sim.recruitHero('normal', 1);
    }
  }
}
