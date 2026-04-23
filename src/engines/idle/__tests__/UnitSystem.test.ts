import { vi } from 'vitest';
/**
 * UnitSystem 单元测试
 *
 * 覆盖所有公开方法：unlock, evolve, addExp, getBonus, getUnits,
 * getDef, getState, getLevel, isUnlocked, checkEvolutionCompletion,
 * saveState, loadState, reset, onEvent。
 */
import {
  UnitSystem,
  UnitRarity,
  type UnitDef,
  type UnitState,
  type UnitSystemEvent,
} from '../modules/UnitSystem';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建基础角色定义 */
function createUnitDef(overrides?: Partial<UnitDef>): UnitDef {
  return {
    id: 'warrior',
    name: '战士',
    description: '勇敢的前线战士',
    rarity: UnitRarity.Common,
    baseStats: { hp: 100, atk: 10, def: 5 },
    growthRates: { hp: 10, atk: 2, def: 1 },
    evolutions: [],
    recruitCost: [{ materialId: 'gold', quantity: 100 }],
    maxLevel: 50,
    tags: ['melee', 'tank'],
    passiveSkillIds: [],
    ...overrides,
  };
}

/** 创建带进化分支的角色定义 */
function createEvolutionUnitDef(): UnitDef {
  return createUnitDef({
    id: 'dragon',
    name: '幼龙',
    evolutions: [
      {
        branchId: 'fire_dragon',
        targetUnitId: 'fire_dragon',
        requiredMaterials: [{ materialId: 'fire_essence', quantity: 5 }],
        requiredGold: 1000,
        successRate: 0.8,
        evolveTime: 1000, // 1 秒
      },
      {
        branchId: 'ice_dragon',
        targetUnitId: 'ice_dragon',
        requiredMaterials: [{ materialId: 'ice_essence', quantity: 5 }],
        requiredGold: 1000,
        requiredStage: 'stage_2',
        successRate: 0.6,
        evolveTime: 2000,
      },
    ],
  });
}

/** 创建多个不同稀有度的角色定义 */
function createMultiRarityDefs(): UnitDef[] {
  return [
    createUnitDef({ id: 'common_1', name: '民兵', rarity: UnitRarity.Common, tags: ['melee'] }),
    createUnitDef({ id: 'rare_1', name: '骑士', rarity: UnitRarity.Rare, tags: ['melee', 'mounted'] }),
    createUnitDef({ id: 'epic_1', name: '法师', rarity: UnitRarity.Epic, tags: ['ranged', 'magic'] }),
    createUnitDef({ id: 'legend_1', name: '龙骑士', rarity: UnitRarity.Legendary, tags: ['mounted', 'melee'] }),
  ];
}

// ============================================================
// 测试套件
// ============================================================

describe('UnitSystem', () => {

  // ========== 构造函数 ==========

  describe('constructor', () => {
    it('应正确注册所有角色定义', () => {
      const defs = createMultiRarityDefs();
      const system = new UnitSystem(defs);

      expect(system.getDef('common_1')).toBeDefined();
      expect(system.getDef('rare_1')).toBeDefined();
      expect(system.getDef('epic_1')).toBeDefined();
      expect(system.getDef('legend_1')).toBeDefined();
    });

    it('所有角色初始应为未解锁状态', () => {
      const defs = createMultiRarityDefs();
      const system = new UnitSystem(defs);

      for (const def of defs) {
        expect(system.isUnlocked(def.id)).toBe(false);
      }
    });

    it('重复 ID 的定义应被后者覆盖', () => {
      const defs = [
        createUnitDef({ id: 'unit_1', name: '原始名称' }),
        createUnitDef({ id: 'unit_1', name: '新名称' }),
      ];
      const system = new UnitSystem(defs);

      expect(system.getDef('unit_1')!.name).toBe('新名称');
    });
  });

  // ========== unlock ==========

  describe('unlock', () => {
    it('应成功解锁角色', () => {
      const system = new UnitSystem([createUnitDef()]);
      const result = system.unlock('warrior');

      expect(result.ok).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.unlocked).toBe(true);
      expect(result.value!.level).toBe(1);
      expect(result.value!.exp).toBe(0);
    });

    it('解锁不存在的角色应返回错误', () => {
      const system = new UnitSystem([createUnitDef()]);
      const result = system.unlock('nonexistent');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('角色定义不存在');
    });

    it('重复解锁同一角色应返回错误', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');
      const result = system.unlock('warrior');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('角色已解锁');
    });

    it('解锁后 isUnlocked 应返回 true', () => {
      const system = new UnitSystem([createUnitDef()]);
      expect(system.isUnlocked('warrior')).toBe(false);

      system.unlock('warrior');
      expect(system.isUnlocked('warrior')).toBe(true);
    });

    it('解锁应触发 unlocked 事件', () => {
      const system = new UnitSystem([createUnitDef()]);
      const handler = vi.fn();
      system.onEvent(handler);

      system.unlock('warrior');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'unlocked', unitId: 'warrior' }),
      );
    });
  });

  // ========== addExp ==========

  describe('addExp', () => {
    it('应成功增加经验值', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');

      const result = system.addExp('warrior', 50);

      expect(result.ok).toBe(true);
      expect(result.value!.exp).toBe(50);
    });

    it('经验达到阈值应自动升级', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');

      // level 1 → 2 需要 floor(100 * 1.15^0) = 100 经验
      const result = system.addExp('warrior', 150);

      expect(result.ok).toBe(true);
      expect(result.value!.level).toBe(2);
      expect(result.value!.exp).toBe(50); // 150 - 100 = 50
    });

    it('应支持连续多级升级', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');

      // level 1→2: floor(100*1.15^0)=100
      // level 2→3: floor(100*1.15^1)=floor(114.99..)=114
      // level 3→4: floor(100*1.15^2)=floor(132.25)=132
      // level 4→5: floor(100*1.15^3)=floor(152.08..)=152
      // 总共 100+114+132+152 = 498
      const result = system.addExp('warrior', 500);

      expect(result.ok).toBe(true);
      expect(result.value!.level).toBe(5);
      // 500 - 100 - 114 - 132 - 152 = 2
      expect(result.value!.exp).toBe(2);
    });

    it('未解锁角色增加经验应返回错误', () => {
      const system = new UnitSystem([createUnitDef()]);
      const result = system.addExp('warrior', 50);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('角色未解锁');
    });

    it('经验值为 0 或负数应返回错误', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');

      expect(system.addExp('warrior', 0).ok).toBe(false);
      expect(system.addExp('warrior', -10).ok).toBe(false);
    });

    it('达到最大等级后不再升级', () => {
      const system = new UnitSystem([createUnitDef({ maxLevel: 2 })]);
      system.unlock('warrior');

      // 给大量经验，但 maxLevel=2
      const result = system.addExp('warrior', 99999);

      expect(result.ok).toBe(true);
      expect(result.value!.level).toBe(2);
    });

    it('增加经验应触发 exp_gained 事件', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');
      const handler = vi.fn();
      system.onEvent(handler);

      system.addExp('warrior', 50);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'exp_gained', unitId: 'warrior' }),
      );
    });

    it('升级应触发 leveled_up 事件', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');
      const handler = vi.fn();
      system.onEvent(handler);

      system.addExp('warrior', 100);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'leveled_up', unitId: 'warrior' }),
      );
    });

    it('不存在的角色应返回错误', () => {
      const system = new UnitSystem([createUnitDef()]);
      const result = system.addExp('nonexistent', 50);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('角色定义不存在');
    });
  });

  // ========== getBonus ==========

  describe('getBonus', () => {
    it('应正确计算单个角色属性加成', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');

      // baseStats.hp=100, growthRates.hp=10, level=1
      // bonus = 100 + 10 * (1-1) = 100
      expect(system.getBonus('hp')).toBe(100);
    });

    it('应考虑等级成长的加成', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');
      system.addExp('warrior', 100); // level 2

      // baseStats.hp=100, growthRates.hp=10, level=2
      // bonus = 100 + 10 * (2-1) = 110
      expect(system.getBonus('hp')).toBe(110);
    });

    it('应累加多个角色的加成', () => {
      const defs = createMultiRarityDefs();
      const system = new UnitSystem(defs);

      system.unlock('common_1');
      system.unlock('rare_1');

      // common_1: hp=100+10*(1-1)=100
      // rare_1: hp=100+10*(1-1)=100
      // total = 200
      expect(system.getBonus('hp')).toBe(200);
    });

    it('未解锁角色不计入加成', () => {
      const defs = createMultiRarityDefs();
      const system = new UnitSystem(defs);

      system.unlock('common_1');
      // rare_1 未解锁

      expect(system.getBonus('hp')).toBe(100);
    });

    it('不存在的属性类型应返回 0', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');

      expect(system.getBonus('nonexistent_stat')).toBe(0);
    });

    it('无已解锁角色时应返回 0', () => {
      const system = new UnitSystem([createUnitDef()]);
      expect(system.getBonus('hp')).toBe(0);
    });
  });

  // ========== getUnits ==========

  describe('getUnits', () => {
    it('无筛选条件应返回所有已解锁角色', () => {
      const defs = createMultiRarityDefs();
      const system = new UnitSystem(defs);

      system.unlock('common_1');
      system.unlock('rare_1');

      const units = system.getUnits();
      expect(units).toHaveLength(2);
    });

    it('按稀有度筛选', () => {
      const defs = createMultiRarityDefs();
      const system = new UnitSystem(defs);

      system.unlock('common_1');
      system.unlock('rare_1');
      system.unlock('epic_1');

      const rareUnits = system.getUnits({ rarity: UnitRarity.Rare });
      expect(rareUnits).toHaveLength(1);
      expect(rareUnits[0].defId).toBe('rare_1');
    });

    it('按标签筛选', () => {
      const defs = createMultiRarityDefs();
      const system = new UnitSystem(defs);

      system.unlock('common_1');
      system.unlock('epic_1');

      const magicUnits = system.getUnits({ tag: 'magic' });
      expect(magicUnits).toHaveLength(1);
      expect(magicUnits[0].defId).toBe('epic_1');
    });

    it('同时按稀有度和标签筛选', () => {
      const defs = createMultiRarityDefs();
      const system = new UnitSystem(defs);

      system.unlock('common_1');
      system.unlock('rare_1');
      system.unlock('legend_1');

      const units = system.getUnits({ rarity: UnitRarity.Rare, tag: 'melee' });
      expect(units).toHaveLength(1);
      expect(units[0].defId).toBe('rare_1');
    });

    it('无匹配结果应返回空数组', () => {
      const defs = createMultiRarityDefs();
      const system = new UnitSystem(defs);
      system.unlock('common_1');

      const units = system.getUnits({ rarity: UnitRarity.Mythic });
      expect(units).toHaveLength(0);
    });
  });

  // ========== getDef / getState / getLevel / isUnlocked ==========

  describe('查询方法', () => {
    it('getDef 应返回角色定义', () => {
      const system = new UnitSystem([createUnitDef()]);
      const def = system.getDef('warrior');

      expect(def).toBeDefined();
      expect(def!.name).toBe('战士');
    });

    it('getDef 不存在应返回 undefined', () => {
      const system = new UnitSystem([createUnitDef()]);
      expect(system.getDef('nonexistent')).toBeUndefined();
    });

    it('getState 未解锁时应返回未解锁状态', () => {
      const system = new UnitSystem([createUnitDef()]);
      const state = system.getState('warrior');

      expect(state).toBeDefined();
      expect(state!.unlocked).toBe(false);
    });

    it('getState 应返回状态副本', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');
      const state1 = system.getState('warrior');
      const state2 = system.getState('warrior');

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });

    it('getState 不存在应返回 undefined', () => {
      const system = new UnitSystem([createUnitDef()]);
      expect(system.getState('nonexistent')).toBeUndefined();
    });

    it('getLevel 应返回正确等级', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');
      system.addExp('warrior', 100); // level 2

      expect(system.getLevel('warrior')).toBe(2);
    });

    it('getLevel 不存在应返回 0', () => {
      const system = new UnitSystem([createUnitDef()]);
      expect(system.getLevel('nonexistent')).toBe(0);
    });
  });

  // ========== evolve ==========

  describe('evolve', () => {
    it('应成功开始进化', () => {
      const system = new UnitSystem([createEvolutionUnitDef()]);
      system.unlock('dragon');

      const result = system.evolve('dragon', 'fire_dragon');

      expect(result.ok).toBe(true);
      const state = system.getState('dragon');
      expect(state!.currentEvolutionBranch).toBe('fire_dragon');
      expect(state!.evolutionStartTime).not.toBeNull();
    });

    it('未解锁角色进化应返回错误', () => {
      const system = new UnitSystem([createEvolutionUnitDef()]);
      const result = system.evolve('dragon', 'fire_dragon');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('角色未解锁');
    });

    it('不存在的进化分支应返回错误', () => {
      const system = new UnitSystem([createEvolutionUnitDef()]);
      system.unlock('dragon');

      const result = system.evolve('dragon', 'nonexistent_branch');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('进化分支不存在');
    });

    it('进化中再次进化应返回错误', () => {
      const system = new UnitSystem([createEvolutionUnitDef()]);
      system.unlock('dragon');
      system.evolve('dragon', 'fire_dragon');

      const result = system.evolve('dragon', 'ice_dragon');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('角色正在进化中');
    });

    it('不存在的角色应返回错误', () => {
      const system = new UnitSystem([createEvolutionUnitDef()]);
      const result = system.evolve('nonexistent', 'fire_dragon');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('角色定义不存在');
    });
  });

  // ========== checkEvolutionCompletion ==========

  describe('checkEvolutionCompletion', () => {
    it('进化时间未到应返回空列表', () => {
      const system = new UnitSystem([createEvolutionUnitDef()]);
      system.unlock('dragon');
      system.evolve('dragon', 'fire_dragon');

      const completed = system.checkEvolutionCompletion();
      expect(completed).toHaveLength(0);
    });

    it('进化时间已到应返回完成列表', () => {
      const system = new UnitSystem([createEvolutionUnitDef()]);
      system.unlock('dragon');
      system.evolve('dragon', 'fire_dragon');

      // 模拟时间流逝（手动修改 evolutionStartTime）
      const state = system.getState('dragon')!;
      // evolveTime=1000ms, 将开始时间设置为 2 秒前
      const internalState = (system as any).states.get('dragon');
      internalState.evolutionStartTime = Date.now() - 2000;

      const completed = system.checkEvolutionCompletion();
      expect(completed).toEqual(['dragon']);
    });

    it('进化完成后应清除进化状态', () => {
      const system = new UnitSystem([createEvolutionUnitDef()]);
      system.unlock('dragon');
      system.evolve('dragon', 'fire_dragon');

      const internalState = (system as any).states.get('dragon');
      internalState.evolutionStartTime = Date.now() - 2000;

      system.checkEvolutionCompletion();

      const state = system.getState('dragon')!;
      expect(state.currentEvolutionBranch).toBeNull();
      expect(state.evolutionStartTime).toBeNull();
    });

    it('进化完成应触发 evolved 事件', () => {
      const system = new UnitSystem([createEvolutionUnitDef()]);
      system.unlock('dragon');
      system.evolve('dragon', 'fire_dragon');

      const handler = vi.fn();
      system.onEvent(handler);

      const internalState = (system as any).states.get('dragon');
      internalState.evolutionStartTime = Date.now() - 2000;

      system.checkEvolutionCompletion();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'evolved',
          unitId: 'dragon',
          data: expect.objectContaining({ targetUnitId: 'fire_dragon' }),
        }),
      );
    });

    it('无进化中的角色应返回空列表', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');

      const completed = system.checkEvolutionCompletion();
      expect(completed).toHaveLength(0);
    });
  });

  // ========== saveState / loadState ==========

  describe('saveState / loadState', () => {
    it('saveState 应正确序列化状态', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');
      system.addExp('warrior', 150);

      const saved = system.saveState();

      expect(saved.warrior).toBeDefined();
      expect(saved.warrior.level).toBe(2);
      expect(saved.warrior.exp).toBe(50);
      expect(saved.warrior.unlocked).toBe(true);
      expect(saved.warrior.evolutionBranch).toBeNull();
    });

    it('loadState 应正确恢复状态', () => {
      const system = new UnitSystem([createUnitDef()]);

      system.loadState({
        warrior: {
          level: 10,
          exp: 200,
          unlocked: true,
          evolutionBranch: null,
          equippedIds: [],
        },
      });

      expect(system.isUnlocked('warrior')).toBe(true);
      expect(system.getLevel('warrior')).toBe(10);
      const state = system.getState('warrior');
      expect(state!.exp).toBe(200);
    });

    it('loadState 应忽略未注册的角色 ID', () => {
      const system = new UnitSystem([createUnitDef()]);

      // 不应抛出异常
      system.loadState({
        nonexistent: { level: 5, exp: 0, unlocked: true, evolutionBranch: null },
      });
    });

    it('loadState 应处理缺失字段（使用默认值）', () => {
      const system = new UnitSystem([createUnitDef()]);

      system.loadState({
        warrior: {}, // 所有字段缺失
      });

      const state = system.getState('warrior')!;
      expect(state.level).toBe(1);
      expect(state.exp).toBe(0);
      expect(state.unlocked).toBe(false);
      expect(state.currentEvolutionBranch).toBeNull();
    });

    it('save → load 往返应保持一致', () => {
      const system1 = new UnitSystem([createUnitDef()]);
      system1.unlock('warrior');
      system1.addExp('warrior', 300);

      const saved = system1.saveState();

      const system2 = new UnitSystem([createUnitDef()]);
      system2.loadState(saved);

      expect(system2.isUnlocked('warrior')).toBe(true);
      expect(system2.getLevel('warrior')).toBe(system1.getLevel('warrior'));
      expect(system2.getState('warrior')!.exp).toBe(system1.getState('warrior')!.exp);
    });
  });

  // ========== reset ==========

  describe('reset', () => {
    it('应重置所有角色到未解锁状态', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');
      system.addExp('warrior', 200);

      system.reset();

      expect(system.isUnlocked('warrior')).toBe(false);
      expect(system.getLevel('warrior')).toBe(1);
    });

    it('重置后可重新解锁', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');
      system.reset();

      const result = system.unlock('warrior');
      expect(result.ok).toBe(true);
    });
  });

  // ========== onEvent ==========

  describe('onEvent', () => {
    it('返回的取消函数应正确移除监听器', () => {
      const system = new UnitSystem([createUnitDef()]);
      const handler = vi.fn();
      const unsubscribe = system.onEvent(handler);

      unsubscribe();
      system.unlock('warrior');

      expect(handler).not.toHaveBeenCalled();
    });

    it('应支持多个监听器', () => {
      const system = new UnitSystem([createUnitDef()]);
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      system.onEvent(handler1);
      system.onEvent(handler2);
      system.unlock('warrior');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('监听器异常不应影响系统运行', () => {
      const system = new UnitSystem([createUnitDef()]);
      const errorHandler = vi.fn(() => {
        throw new Error('监听器异常');
      });
      const normalHandler = vi.fn();

      system.onEvent(errorHandler);
      system.onEvent(normalHandler);

      // 不应抛出异常
      expect(() => system.unlock('warrior')).not.toThrow();
      expect(normalHandler).toHaveBeenCalled();
    });
  });

  // ========== expToNextLevel (间接测试) ==========

  describe('经验公式', () => {
    it('level 1 → 2 需要 100 经验', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');

      system.addExp('warrior', 99);
      expect(system.getLevel('warrior')).toBe(1);

      system.addExp('warrior', 1);
      expect(system.getLevel('warrior')).toBe(2);
    });

    it('level 2 → 3 需要 floor(100*1.15)=114 经验', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');

      system.addExp('warrior', 100); // → level 2
      expect(system.getLevel('warrior')).toBe(2);

      system.addExp('warrior', 113);
      expect(system.getLevel('warrior')).toBe(2);

      system.addExp('warrior', 1);
      expect(system.getLevel('warrior')).toBe(3);
    });

    it('level 3 → 4 需要 floor(100*1.15^2)=132 经验', () => {
      const system = new UnitSystem([createUnitDef()]);
      system.unlock('warrior');

      system.addExp('warrior', 100 + 114); // → level 3
      expect(system.getLevel('warrior')).toBe(3);

      system.addExp('warrior', 131);
      expect(system.getLevel('warrior')).toBe(3);

      system.addExp('warrior', 1);
      expect(system.getLevel('warrior')).toBe(4);
    });
  });

  // ========== 泛型支持 ==========

  describe('泛型支持', () => {
    interface CustomUnitDef extends UnitDef {
      element: string;
    }

    it('应支持自定义扩展的 UnitDef', () => {
      const defs: CustomUnitDef[] = [
        {
          ...createUnitDef({ id: 'fire_mage' }),
          element: 'fire',
        },
      ];

      const system = new UnitSystem<CustomUnitDef>(defs);
      const def = system.getDef('fire_mage');

      expect(def).toBeDefined();
      expect(def!.element).toBe('fire');
    });
  });
});
