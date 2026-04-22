import { vi } from 'vitest';
/**
 * StageSystem 单元测试
 *
 * 覆盖所有公开方法：constructor, advance, getCurrent, getCurrentId,
 * getMultiplier, getAllStages, getNextStage, canAdvance, getProgress,
 * saveState, loadState, reset, onEvent。
 */
import {
  StageSystem,
  type StageDef,
  type StageInfo,
  type StageSystemEvent,
} from '../modules/StageSystem';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建基础阶段定义 */
function createStageDefs(): StageDef[] {
  return [
    {
      id: 'stage_1',
      name: '初始森林',
      description: '新手起步阶段',
      order: 1,
      prerequisiteStageId: null,
      requiredResources: {},
      requiredConditions: [],
      rewards: [],
      productionMultiplier: 1.0,
      combatMultiplier: 1.0,
      iconAsset: '/icons/forest.png',
      themeColor: '#4CAF50',
    },
    {
      id: 'stage_2',
      name: '黑暗洞穴',
      description: '深入地下的神秘洞穴',
      order: 2,
      prerequisiteStageId: 'stage_1',
      requiredResources: { gold: 500 },
      requiredConditions: [
        { type: 'level', targetId: 'player', minValue: 5 },
      ],
      rewards: [
        { type: 'multiplier', targetId: 'production', value: 1.5 },
      ],
      productionMultiplier: 1.5,
      combatMultiplier: 1.2,
      iconAsset: '/icons/cave.png',
      themeColor: '#607D8B',
    },
    {
      id: 'stage_3',
      name: '火山熔岩',
      description: '炽热的火山地带',
      order: 3,
      prerequisiteStageId: 'stage_2',
      requiredResources: { gold: 2000, gem: 10 },
      requiredConditions: [
        { type: 'level', targetId: 'player', minValue: 15 },
        { type: 'building_level', targetId: 'smithy', minValue: 3 },
      ],
      rewards: [
        { type: 'resource', targetId: 'gem', value: 50 },
        { type: 'unit', targetId: 'fire_dragon', value: 1 },
      ],
      productionMultiplier: 2.0,
      combatMultiplier: 1.8,
      iconAsset: '/icons/volcano.png',
      themeColor: '#F44336',
    },
    {
      id: 'stage_4',
      name: '天空之城',
      description: '传说中的天空之城',
      order: 4,
      prerequisiteStageId: 'stage_3',
      requiredResources: { gold: 10000, gem: 100, crystal: 50 },
      requiredConditions: [
        { type: 'level', targetId: 'player', minValue: 30 },
      ],
      rewards: [
        { type: 'feature', targetId: 'prestige', value: 1 },
      ],
      productionMultiplier: 3.0,
      combatMultiplier: 2.5,
      iconAsset: '/icons/sky.png',
      themeColor: '#9C27B0',
    },
  ];
}

/** 创建条件检查器 */
function createConditionChecker(overrides: Record<string, number> = {}): (type: string, targetId: string) => number {
  return (type: string, targetId: string) => {
    const key = `${type}:${targetId}`;
    return overrides[key] ?? 0;
  };
}

// ============================================================
// 测试套件
// ============================================================

describe('StageSystem', () => {

  // ========== 构造函数 ==========

  describe('constructor', () => {
    it('应按 order 排序阶段定义', () => {
      const defs = createStageDefs();
      // 打乱顺序传入
      const shuffled = [defs[3], defs[0], defs[2], defs[1]];
      const system = new StageSystem(shuffled, 'stage_1');

      const stages = system.getAllStages();
      expect(stages[0].id).toBe('stage_1');
      expect(stages[1].id).toBe('stage_2');
      expect(stages[2].id).toBe('stage_3');
      expect(stages[3].id).toBe('stage_4');
    });

    it('初始阶段应自动解锁', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      expect(system.getCurrentId()).toBe('stage_1');
      const stages = system.getAllStages();
      expect(stages[0].isUnlocked).toBe(true);
      expect(stages[0].isCurrent).toBe(true);
    });
  });

  // ========== getCurrent / getCurrentId ==========

  describe('getCurrent / getCurrentId', () => {
    it('getCurrent 应返回当前阶段定义', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      const current = system.getCurrent();
      expect(current.id).toBe('stage_1');
      expect(current.name).toBe('初始森林');
    });

    it('getCurrentId 应返回当前阶段 ID', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');
      expect(system.getCurrentId()).toBe('stage_1');
    });
  });

  // ========== getMultiplier ==========

  describe('getMultiplier', () => {
    it('应返回正确的产出倍率', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');
      expect(system.getMultiplier('production')).toBe(1.0);
    });

    it('应返回正确的战斗倍率', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');
      expect(system.getMultiplier('combat')).toBe(1.0);
    });

    it('推进后倍率应更新', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      system.advance(
        { gold: 500 },
        createConditionChecker({ 'level:player': 5 }),
      );

      expect(system.getMultiplier('production')).toBe(1.5);
      expect(system.getMultiplier('combat')).toBe(1.2);
    });
  });

  // ========== getAllStages ==========

  describe('getAllStages', () => {
    it('应返回所有阶段信息', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      const stages = system.getAllStages();
      expect(stages).toHaveLength(4);
    });

    it('应包含正确的解锁和当前状态', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      const stages = system.getAllStages();
      expect(stages[0].isUnlocked).toBe(true);
      expect(stages[0].isCurrent).toBe(true);
      expect(stages[1].isUnlocked).toBe(false);
      expect(stages[1].isCurrent).toBe(false);
    });

    it('推进后解锁状态应更新', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      system.advance(
        { gold: 500 },
        createConditionChecker({ 'level:player': 5 }),
      );

      const stages = system.getAllStages();
      expect(stages[0].isUnlocked).toBe(true);
      expect(stages[0].isCurrent).toBe(false);
      expect(stages[1].isUnlocked).toBe(true);
      expect(stages[1].isCurrent).toBe(true);
    });
  });

  // ========== getNextStage ==========

  describe('getNextStage', () => {
    it('应返回下一阶段预览', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      const next = system.getNextStage();
      expect(next).not.toBeNull();
      expect(next!.id).toBe('stage_2');
    });

    it('最后阶段应返回 null', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      // 推进到最终阶段
      system.advance({ gold: 500 }, createConditionChecker({ 'level:player': 5 }));
      system.advance({ gold: 2000, gem: 10 }, createConditionChecker({ 'level:player': 15, 'building_level:smithy': 3 }));
      system.advance({ gold: 10000, gem: 100, crystal: 50 }, createConditionChecker({ 'level:player': 30 }));

      expect(system.getNextStage()).toBeNull();
    });
  });

  // ========== canAdvance ==========

  describe('canAdvance', () => {
    it('满足所有条件应返回 true', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      const canAdvance = system.canAdvance(
        { gold: 500 },
        createConditionChecker({ 'level:player': 5 }),
      );

      expect(canAdvance).toBe(true);
    });

    it('资源不足应返回 false', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      const canAdvance = system.canAdvance(
        { gold: 100 }, // 需要 500
        createConditionChecker({ 'level:player': 5 }),
      );

      expect(canAdvance).toBe(false);
    });

    it('条件不满足应返回 false', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      const canAdvance = system.canAdvance(
        { gold: 500 },
        createConditionChecker({ 'level:player': 3 }), // 需要 5
      );

      expect(canAdvance).toBe(false);
    });

    it('已是最后阶段应返回 false', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      system.advance({ gold: 500 }, createConditionChecker({ 'level:player': 5 }));
      system.advance({ gold: 2000, gem: 10 }, createConditionChecker({ 'level:player': 15, 'building_level:smithy': 3 }));
      system.advance({ gold: 10000, gem: 100, crystal: 50 }, createConditionChecker({ 'level:player': 30 }));

      const canAdvance = system.canAdvance(
        { gold: 99999 },
        createConditionChecker({ 'level:player': 99 }),
      );

      expect(canAdvance).toBe(false);
    });

    it('无资源需求的阶段只需满足条件', () => {
      const noReqStage: StageDef = {
        id: 'free_stage',
        name: '免费阶段',
        description: '无需资源',
        order: 1,
        prerequisiteStageId: null,
        requiredResources: {},
        requiredConditions: [],
        rewards: [],
        productionMultiplier: 1.0,
        combatMultiplier: 1.0,
        iconAsset: '/icons/free.png',
        themeColor: '#000',
      };
      const nextStage: StageDef = {
        id: 'next_stage',
        name: '下一阶段',
        description: '需要条件',
        order: 2,
        prerequisiteStageId: 'free_stage',
        requiredResources: {},
        requiredConditions: [{ type: 'kill', targetId: 'boss', minValue: 1 }],
        rewards: [],
        productionMultiplier: 1.0,
        combatMultiplier: 1.0,
        iconAsset: '/icons/next.png',
        themeColor: '#111',
      };

      const system = new StageSystem([noReqStage, nextStage], 'free_stage');

      expect(system.canAdvance({}, createConditionChecker())).toBe(false);
      expect(system.canAdvance({}, createConditionChecker({ 'kill:boss': 1 }))).toBe(true);
    });
  });

  // ========== advance ==========

  describe('advance', () => {
    it('满足条件应成功推进', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      const result = system.advance(
        { gold: 500 },
        createConditionChecker({ 'level:player': 5 }),
      );

      expect(result.ok).toBe(true);
      expect(result.value!.id).toBe('stage_2');
      expect(result.value!.name).toBe('黑暗洞穴');
    });

    it('推进后当前阶段应更新', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      system.advance(
        { gold: 500 },
        createConditionChecker({ 'level:player': 5 }),
      );

      expect(system.getCurrentId()).toBe('stage_2');
    });

    it('资源不足应返回错误', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      const result = system.advance(
        { gold: 100 },
        createConditionChecker({ 'level:player': 5 }),
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('资源不足');
    });

    it('条件不满足应返回错误', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      const result = system.advance(
        { gold: 500 },
        createConditionChecker({ 'level:player': 3 }),
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('条件未满足');
    });

    it('已是最后阶段应返回错误', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      system.advance({ gold: 500 }, createConditionChecker({ 'level:player': 5 }));
      system.advance({ gold: 2000, gem: 10 }, createConditionChecker({ 'level:player': 15, 'building_level:smithy': 3 }));
      system.advance({ gold: 10000, gem: 100, crystal: 50 }, createConditionChecker({ 'level:player': 30 }));

      const result = system.advance(
        { gold: 99999 },
        createConditionChecker({ 'level:player': 99 }),
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('已经是最后一个阶段');
    });

    it('推进应触发 advanced 事件', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');
      const handler = vi.fn();
      system.onEvent(handler);

      system.advance(
        { gold: 500 },
        createConditionChecker({ 'level:player': 5 }),
      );

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        type: 'advanced',
        oldStageId: 'stage_1',
        newStageId: 'stage_2',
      });
    });

    it('应支持连续推进多个阶段', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      // stage_1 → stage_2
      system.advance({ gold: 500 }, createConditionChecker({ 'level:player': 5 }));
      expect(system.getCurrentId()).toBe('stage_2');

      // stage_2 → stage_3
      system.advance(
        { gold: 2000, gem: 10 },
        createConditionChecker({ 'level:player': 15, 'building_level:smithy': 3 }),
      );
      expect(system.getCurrentId()).toBe('stage_3');

      // stage_3 → stage_4
      system.advance(
        { gold: 10000, gem: 100, crystal: 50 },
        createConditionChecker({ 'level:player': 30 }),
      );
      expect(system.getCurrentId()).toBe('stage_4');
    });

    it('缺少资源字段应视为 0', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      const result = system.advance(
        {}, // 缺少 gold
        createConditionChecker({ 'level:player': 5 }),
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('资源不足');
    });
  });

  // ========== getProgress ==========

  describe('getProgress', () => {
    it('应正确计算资源进度', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      const progress = system.getProgress({ gold: 250 });

      expect(progress.stageId).toBe('stage_2');
      expect(progress.resourceProgress.gold).toEqual({
        current: 250,
        required: 500,
        met: false,
      });
    });

    it('资源满足时 met 应为 true', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      const progress = system.getProgress({ gold: 600 });

      expect(progress.resourceProgress.gold.met).toBe(true);
    });

    it('应正确计算整体进度百分比', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      // gold: 250/500 = 0.5, overallProgress = 0.5
      const progress = system.getProgress({ gold: 250 });
      expect(progress.overallProgress).toBeCloseTo(0.5);
    });

    it('多资源需求应综合计算进度', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      // 先推进到 stage_3
      system.advance({ gold: 500 }, createConditionChecker({ 'level:player': 5 }));

      // stage_3 需要 gold:2000, gem:10
      const progress = system.getProgress({ gold: 1000, gem: 5 });
      // gold: 1000/2000 = 0.5, gem: 5/10 = 0.5
      // overall = (0.5 + 0.5) / 2 = 0.5
      expect(progress.overallProgress).toBeCloseTo(0.5);
    });

    it('最后阶段进度应为 100%', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      system.advance({ gold: 500 }, createConditionChecker({ 'level:player': 5 }));
      system.advance({ gold: 2000, gem: 10 }, createConditionChecker({ 'level:player': 15, 'building_level:smithy': 3 }));
      system.advance({ gold: 10000, gem: 100, crystal: 50 }, createConditionChecker({ 'level:player': 30 }));

      const progress = system.getProgress({});
      expect(progress.overallProgress).toBe(1);
    });

    it('无资源需求的下一阶段进度应为 100%', () => {
      const stage1: StageDef = {
        id: 's1', name: 'S1', description: '', order: 1,
        prerequisiteStageId: null, requiredResources: {}, requiredConditions: [],
        rewards: [], productionMultiplier: 1, combatMultiplier: 1,
        iconAsset: '', themeColor: '#000',
      };
      const stage2: StageDef = {
        id: 's2', name: 'S2', description: '', order: 2,
        prerequisiteStageId: 's1', requiredResources: {}, requiredConditions: [],
        rewards: [], productionMultiplier: 1, combatMultiplier: 1,
        iconAsset: '', themeColor: '#000',
      };

      const system = new StageSystem([stage1, stage2], 's1');
      const progress = system.getProgress({});

      expect(progress.overallProgress).toBe(1);
    });
  });

  // ========== saveState / loadState ==========

  describe('saveState / loadState', () => {
    it('saveState 应返回当前阶段 ID', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      const saved = system.saveState();
      expect(saved.currentStageId).toBe('stage_1');
    });

    it('loadState 应恢复到指定阶段', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      system.loadState({ currentStageId: 'stage_3' });

      expect(system.getCurrentId()).toBe('stage_3');
    });

    it('loadState 应解锁目标阶段及之前的所有阶段', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      system.loadState({ currentStageId: 'stage_3' });

      const stages = system.getAllStages();
      expect(stages[0].isUnlocked).toBe(true);
      expect(stages[1].isUnlocked).toBe(true);
      expect(stages[2].isUnlocked).toBe(true);
      expect(stages[3].isUnlocked).toBe(false);
    });

    it('loadState 无效 ID 应静默忽略', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      system.loadState({ currentStageId: 'nonexistent' });
      expect(system.getCurrentId()).toBe('stage_1');
    });

    it('save → load 往返应保持一致', () => {
      const system1 = new StageSystem(createStageDefs(), 'stage_1');
      system1.advance({ gold: 500 }, createConditionChecker({ 'level:player': 5 }));
      system1.advance({ gold: 2000, gem: 10 }, createConditionChecker({ 'level:player': 15, 'building_level:smithy': 3 }));

      const saved = system1.saveState();

      const system2 = new StageSystem(createStageDefs(), 'stage_1');
      system2.loadState(saved);

      expect(system2.getCurrentId()).toBe('stage_3');
    });
  });

  // ========== reset ==========

  describe('reset', () => {
    it('应重置到初始阶段', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      system.advance({ gold: 500 }, createConditionChecker({ 'level:player': 5 }));
      expect(system.getCurrentId()).toBe('stage_2');

      system.reset();
      expect(system.getCurrentId()).toBe('stage_1');
    });

    it('重置后只有初始阶段解锁', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      system.advance({ gold: 500 }, createConditionChecker({ 'level:player': 5 }));
      system.reset();

      const stages = system.getAllStages();
      expect(stages[0].isUnlocked).toBe(true);
      expect(stages[1].isUnlocked).toBe(false);
    });

    it('重置后可重新推进', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      system.advance({ gold: 500 }, createConditionChecker({ 'level:player': 5 }));
      system.reset();

      const result = system.advance(
        { gold: 500 },
        createConditionChecker({ 'level:player': 5 }),
      );

      expect(result.ok).toBe(true);
      expect(system.getCurrentId()).toBe('stage_2');
    });
  });

  // ========== onEvent ==========

  describe('onEvent', () => {
    it('返回的取消函数应正确移除监听器', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');
      const handler = vi.fn();
      const unsubscribe = system.onEvent(handler);

      unsubscribe();
      system.advance({ gold: 500 }, createConditionChecker({ 'level:player': 5 }));

      expect(handler).not.toHaveBeenCalled();
    });

    it('应支持多个监听器', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      system.onEvent(handler1);
      system.onEvent(handler2);
      system.advance({ gold: 500 }, createConditionChecker({ 'level:player': 5 }));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('监听器异常不应影响系统运行', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');
      const errorHandler = vi.fn(() => {
        throw new Error('监听器异常');
      });
      const normalHandler = vi.fn();

      system.onEvent(errorHandler);
      system.onEvent(normalHandler);

      expect(() => {
        system.advance({ gold: 500 }, createConditionChecker({ 'level:player': 5 }));
      }).not.toThrow();

      expect(normalHandler).toHaveBeenCalled();
    });
  });

  // ========== 泛型支持 ==========

  describe('泛型支持', () => {
    interface CustomStageDef extends StageDef {
      bossName: string;
    }

    it('应支持自定义扩展的 StageDef', () => {
      const defs: CustomStageDef[] = [
        {
          ...createStageDefs()[0],
          id: 'boss_stage',
          bossName: '暗影龙',
        },
      ];

      const system = new StageSystem<CustomStageDef>(defs, 'boss_stage');
      const current = system.getCurrent();

      expect(current.bossName).toBe('暗影龙');
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('单个阶段无法推进', () => {
      const singleStage: StageDef = {
        id: 'only_stage',
        name: '唯一阶段',
        description: '只有一个阶段',
        order: 1,
        prerequisiteStageId: null,
        requiredResources: {},
        requiredConditions: [],
        rewards: [],
        productionMultiplier: 1.0,
        combatMultiplier: 1.0,
        iconAsset: '/icons/only.png',
        themeColor: '#000',
      };

      const system = new StageSystem([singleStage], 'only_stage');

      const result = system.advance({}, () => 0);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('已经是最后一个阶段');

      expect(system.getNextStage()).toBeNull();
    });

    it('多条件全部需要满足', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      // 先推进到 stage_2
      system.advance({ gold: 500 }, createConditionChecker({ 'level:player': 5 }));

      // stage_3 需要 level:player>=15 AND building_level:smithy>=3
      // 只满足一个条件
      const result = system.advance(
        { gold: 2000, gem: 10 },
        createConditionChecker({ 'level:player': 15, 'building_level:smithy': 1 }),
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('条件未满足');
    });

    it('资源刚好满足应能推进', () => {
      const system = new StageSystem(createStageDefs(), 'stage_1');

      const result = system.advance(
        { gold: 500 }, // 刚好 500
        createConditionChecker({ 'level:player': 5 }),
      );

      expect(result.ok).toBe(true);
    });
  });
});
