/**
 * UnitSystem 角色系统 — 单元测试
 *
 * 覆盖范围：
 * - 角色招募（unlock）
 * - 经验获取与自动升级（addExp）
 * - 进化流程（evolve / checkEvolutionCompletion）
 * - 属性加成计算（getBonus）
 * - 角色查询（getUnits / getState / getLevel / isUnlocked）
 * - 序列化（saveState）与反序列化（loadState）— 含字段完整性回归
 * - 事件监听
 * - 重置（reset）
 *
 * @module engines/idle/modules/__tests__/UnitSystem.test
 */

import {
  UnitSystem,
  UnitRarity,
  type UnitDef,
  type UnitState,
} from '../UnitSystem';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建战士定义 */
function makeWarriorDef(overrides: Partial<UnitDef> = {}): UnitDef {
  return {
    id: 'warrior',
    name: '战士',
    description: '勇敢的前线战士',
    rarity: UnitRarity.Common,
    baseStats: { hp: 100, atk: 10, def: 5 },
    growthRates: { hp: 10, atk: 2, def: 1 },
    evolutions: [
      {
        branchId: 'warrior_knight',
        targetUnitId: 'knight',
        requiredMaterials: [{ materialId: 'crystal', quantity: 5 }],
        requiredGold: 1000,
        successRate: 1.0,
        evolveTime: 5000, // 5 秒
      },
    ],
    recruitCost: [{ materialId: 'gold', quantity: 100 }],
    maxLevel: 50,
    tags: ['melee', 'tank'],
    passiveSkillIds: [],
    ...overrides,
  };
}

/** 创建法师定义 */
function makeMageDef(overrides: Partial<UnitDef> = {}): UnitDef {
  return {
    id: 'mage',
    name: '法师',
    description: '远程魔法输出',
    rarity: UnitRarity.Rare,
    baseStats: { hp: 60, atk: 20, def: 2 },
    growthRates: { hp: 5, atk: 4, def: 0.5 },
    evolutions: [],
    recruitCost: [{ materialId: 'gold', quantity: 200 }],
    maxLevel: 50,
    tags: ['ranged', 'magic'],
    passiveSkillIds: [],
    ...overrides,
  };
}

/** 创建默认角色系统（战士 + 法师） */
function createSystem(): UnitSystem {
  return new UnitSystem([makeWarriorDef(), makeMageDef()]);
}

// ============================================================
// 测试
// ============================================================

describe('UnitSystem', () => {
  let system: UnitSystem;

  beforeEach(() => {
    system = createSystem();
  });

  // ----------------------------------------------------------
  // 招募
  // ----------------------------------------------------------
  describe('unlock', () => {
    it('应成功招募已注册角色', () => {
      const result = system.unlock('warrior');
      expect(result.ok).toBe(true);
      expect(result.value?.unlocked).toBe(true);
      expect(result.value?.level).toBe(1);
      expect(result.value?.exp).toBe(0);
    });

    it('不应重复招募同一角色', () => {
      system.unlock('warrior');
      const result = system.unlock('warrior');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('已解锁');
    });

    it('招募不存在的角色应返回错误', () => {
      const result = system.unlock('unknown');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('不存在');
    });

    it('招募后 isUnlocked 应返回 true', () => {
      expect(system.isUnlocked('warrior')).toBe(false);
      system.unlock('warrior');
      expect(system.isUnlocked('warrior')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 经验与升级
  // ----------------------------------------------------------
  describe('addExp', () => {
    it('应正确增加经验值', () => {
      system.unlock('warrior');
      const result = system.addExp('warrior', 50);
      expect(result.ok).toBe(true);
      expect(result.value?.exp).toBe(50);
    });

    it('经验达到阈值应自动升级', () => {
      system.unlock('warrior');
      // 升到 2 级需要 100 经验
      const result = system.addExp('warrior', 100);
      expect(result.ok).toBe(true);
      expect(result.value?.level).toBe(2);
    });

    it('经验超出阈值应连续升级', () => {
      system.unlock('warrior');
      // 给大量经验，应连续升级
      const result = system.addExp('warrior', 500);
      expect(result.ok).toBe(true);
      expect(result.value!.level).toBeGreaterThan(2);
    });

    it('未解锁角色不能获得经验', () => {
      const result = system.addExp('warrior', 50);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('未解锁');
    });

    it('经验值必须大于 0', () => {
      system.unlock('warrior');
      const result = system.addExp('warrior', 0);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('大于 0');
    });
  });

  // ----------------------------------------------------------
  // 进化
  // ----------------------------------------------------------
  describe('evolve', () => {
    it('应成功开始进化', () => {
      system.unlock('warrior');
      const result = system.evolve('warrior', 'warrior_knight');
      expect(result.ok).toBe(true);

      const state = system.getState('warrior');
      expect(state?.currentEvolutionBranch).toBe('warrior_knight');
      expect(state?.evolutionStartTime).not.toBeNull();
    });

    it('进化中的角色不能再次进化', () => {
      system.unlock('warrior');
      system.evolve('warrior', 'warrior_knight');
      const result = system.evolve('warrior', 'warrior_knight');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('进化中');
    });

    it('未解锁角色不能进化', () => {
      const result = system.evolve('warrior', 'warrior_knight');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('未解锁');
    });

    it('不存在的分支应返回错误', () => {
      system.unlock('warrior');
      const result = system.evolve('warrior', 'unknown_branch');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('不存在');
    });
  });

  describe('checkEvolutionCompletion', () => {
    it('进化时间未到不应完成', () => {
      system.unlock('warrior');
      system.evolve('warrior', 'warrior_knight');

      // 立即检查，时间不够
      const completed = system.checkEvolutionCompletion();
      expect(completed).toEqual([]);
    });

    it('进化时间到了应完成', () => {
      system.unlock('warrior');
      system.evolve('warrior', 'warrior_knight');

      // 模拟时间流逝：使用 jest.advanceTimersByTime 不适用于 Date.now
      // 直接修改内部状态来模拟
      const state = system.getState('warrior')!;
      // 手动将开始时间设为 10 秒前（evolveTime 是 5000ms）
      const pastTime = Date.now() - 10000;
      // 通过 loadState 间接设置
      system.loadState({
        warrior: {
          level: state.level,
          exp: state.exp,
          unlocked: state.unlocked,
          evolutionBranch: 'warrior_knight',
          evolutionStartTime: pastTime,
          equippedIds: [],
        },
      });

      const completed = system.checkEvolutionCompletion();
      expect(completed).toContain('warrior');

      const afterState = system.getState('warrior');
      expect(afterState?.currentEvolutionBranch).toBeNull();
      expect(afterState?.evolutionStartTime).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // 查询
  // ----------------------------------------------------------
  describe('getBonus', () => {
    it('未解锁角色不计入加成', () => {
      expect(system.getBonus('atk')).toBe(0);
    });

    it('应正确计算已解锁角色的属性加成', () => {
      system.unlock('warrior');
      // warrior: base atk=10, level=1 → 10 + 2*(1-1) = 10
      expect(system.getBonus('atk')).toBe(10);
    });

    it('升级后加成应增加', () => {
      system.unlock('warrior');
      system.addExp('warrior', 100); // 升到 2 级
      // warrior: base atk=10, level=2 → 10 + 2*(2-1) = 12
      expect(system.getBonus('atk')).toBe(12);
    });

    it('不存在的属性类型应返回 0', () => {
      system.unlock('warrior');
      expect(system.getBonus('unknown_stat')).toBe(0);
    });
  });

  describe('getUnits', () => {
    it('应返回所有已解锁角色', () => {
      system.unlock('warrior');
      system.unlock('mage');
      const units = system.getUnits();
      expect(units).toHaveLength(2);
    });

    it('按稀有度筛选', () => {
      system.unlock('warrior');
      system.unlock('mage');
      const rare = system.getUnits({ rarity: UnitRarity.Rare });
      expect(rare).toHaveLength(1);
      expect(rare[0].defId).toBe('mage');
    });

    it('按标签筛选', () => {
      system.unlock('warrior');
      system.unlock('mage');
      const melee = system.getUnits({ tag: 'melee' });
      expect(melee).toHaveLength(1);
      expect(melee[0].defId).toBe('warrior');
    });
  });

  describe('getState / getLevel / isUnlocked', () => {
    it('getState 应返回状态副本', () => {
      system.unlock('warrior');
      const state = system.getState('warrior');
      expect(state).toBeDefined();
      expect(state!.defId).toBe('warrior');
      expect(state!.unlocked).toBe(true);
    });

    it('getLevel 未解锁角色返回初始等级 1（构造时已初始化）', () => {
      // 角色在构造时 level 已初始化为 1，即使未解锁
      expect(system.getLevel('warrior')).toBe(1);
    });

    it('getLevel 不存在的角色返回 0', () => {
      expect(system.getLevel('unknown')).toBe(0);
    });

    it('isUnlocked 不存在的角色返回 false', () => {
      expect(system.isUnlocked('unknown')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // 存档 / 读档 — 核心回归测试
  // ----------------------------------------------------------
  describe('saveState / loadState', () => {
    it('saveState 应包含所有必要字段', () => {
      system.unlock('warrior');
      system.addExp('warrior', 50);

      const saved = system.saveState();
      const warriorSaved = saved['warrior'];

      expect(warriorSaved).toBeDefined();
      expect(warriorSaved.level).toBe(1);
      expect(warriorSaved.exp).toBe(50);
      expect(warriorSaved.unlocked).toBe(true);
      expect(warriorSaved.evolutionBranch).toBeNull();
      expect(warriorSaved.evolutionStartTime).toBeNull();
      expect(warriorSaved.equippedIds).toEqual([]);
    });

    it('saveState 后 loadState，equippedIds 应一致', () => {
      system.unlock('warrior');

      // 通过 loadState 设置 equippedIds（模拟已装备状态）
      system.loadState({
        warrior: {
          level: 1,
          exp: 0,
          unlocked: true,
          evolutionBranch: null,
          evolutionStartTime: null,
          equippedIds: ['sword_01', 'shield_02', 'ring_03'],
        },
      });

      // 验证内部状态已设置
      const stateBefore = system.getState('warrior')!;
      expect(stateBefore.equippedIds).toEqual(['sword_01', 'shield_02', 'ring_03']);

      // saveState → loadState 往返测试
      const saved = system.saveState();
      expect(saved['warrior'].equippedIds).toEqual(['sword_01', 'shield_02', 'ring_03']);

      const system2 = createSystem();
      system2.loadState(saved);

      const stateAfter = system2.getState('warrior')!;
      expect(stateAfter.equippedIds).toEqual(['sword_01', 'shield_02', 'ring_03']);
    });

    it('saveState 后 loadState，evolutionStartTime 应一致', () => {
      system.unlock('warrior');
      system.evolve('warrior', 'warrior_knight');

      const stateBefore = system.getState('warrior')!;
      expect(stateBefore.evolutionStartTime).not.toBeNull();

      const startTime = stateBefore.evolutionStartTime!;

      // saveState → loadState 往返测试
      const saved = system.saveState();
      expect(saved['warrior'].evolutionStartTime).toBe(startTime);

      const system2 = createSystem();
      system2.loadState(saved);

      const stateAfter = system2.getState('warrior')!;
      expect(stateAfter.evolutionStartTime).toBe(startTime);
      expect(stateAfter.currentEvolutionBranch).toBe('warrior_knight');
    });

    it('saveState 后 loadState，所有基础字段应一致', () => {
      system.unlock('warrior');
      system.addExp('warrior', 250);

      const saved = system.saveState();
      const system2 = createSystem();
      system2.loadState(saved);

      const original = system.getState('warrior')!;
      const restored = system2.getState('warrior')!;

      expect(restored.level).toBe(original.level);
      expect(restored.exp).toBe(original.exp);
      expect(restored.unlocked).toBe(original.unlocked);
      expect(restored.currentEvolutionBranch).toBe(original.currentEvolutionBranch);
      expect(restored.evolutionStartTime).toBe(original.evolutionStartTime);
      expect(restored.equippedIds).toEqual(original.equippedIds);
    });

    it('loadState 旧存档（无新字段）应安全降级为默认值', () => {
      // 模拟旧版本存档：没有 evolutionStartTime 和 equippedIds
      const oldSave = {
        warrior: {
          level: 5,
          exp: 30,
          unlocked: true,
          evolutionBranch: null,
          // evolutionStartTime 和 equippedIds 缺失
        },
      };

      const system2 = createSystem();
      system2.loadState(oldSave);

      const state = system2.getState('warrior')!;
      expect(state.level).toBe(5);
      expect(state.exp).toBe(30);
      expect(state.unlocked).toBe(true);
      expect(state.evolutionStartTime).toBeNull();
      expect(state.equippedIds).toEqual([]);
    });

    it('loadState 无效数据应安全降级', () => {
      system.unlock('warrior');
      system.addExp('warrior', 100);

      // 各种无效数据场景
      const invalidCases = [
        { description: 'null 值', data: { warrior: null } },
        { description: '数字值', data: { warrior: 42 } },
        { description: '字符串值', data: { warrior: 'invalid' } },
        { description: '空对象', data: {} },
        { description: '未注册角色', data: { unknown_unit: { level: 10 } } },
      ];

      for (const { description, data } of invalidCases) {
        const sys = createSystem();
        sys.unlock('warrior');
        sys.addExp('warrior', 100);

        // 不应抛出异常
        expect(() => sys.loadState(data)).not.toThrow();

        // 已有状态应保持合理（不崩溃）
        const state = sys.getState('warrior')!;
        expect(state).toBeDefined();
        expect(typeof state.level).toBe('number');
        expect(typeof state.exp).toBe('number');
      }
    });

    it('loadState 无效字段值应使用默认值', () => {
      const badData = {
        warrior: {
          level: -5,           // 无效：负数 → 默认 1
          exp: 'abc',          // 无效：非数字 → 默认 0
          unlocked: 123,       // 无效：非布尔 → 默认 false
          evolutionBranch: 42, // 无效：非字符串 → 默认 null
          evolutionStartTime: 'not-a-number', // 无效 → 默认 null
          equippedIds: [1, 2], // 无效：非字符串数组 → 默认 []
        },
      };

      const sys = createSystem();
      sys.loadState(badData);

      const state = sys.getState('warrior')!;
      expect(state.level).toBe(1);
      expect(state.exp).toBe(0);
      expect(state.unlocked).toBe(false);
      expect(state.currentEvolutionBranch).toBeNull();
      expect(state.evolutionStartTime).toBeNull();
      expect(state.equippedIds).toEqual([]);
    });

    it('saveState 的 equippedIds 应是副本，不影响内部状态', () => {
      system.unlock('warrior');
      system.loadState({
        warrior: {
          level: 1,
          exp: 0,
          unlocked: true,
          evolutionBranch: null,
          evolutionStartTime: null,
          equippedIds: ['sword'],
        },
      });

      const saved = system.saveState();
      // 修改导出的数组不应影响内部状态
      saved['warrior'].equippedIds.push('hacked');

      const state = system.getState('warrior')!;
      expect(state.equippedIds).toEqual(['sword']);
    });
  });

  // ----------------------------------------------------------
  // 事件系统
  // ----------------------------------------------------------
  describe('onEvent', () => {
    it('应触发 unlocked 事件', () => {
      const events: string[] = [];
      system.onEvent((e) => events.push(e.type));

      system.unlock('warrior');
      expect(events).toContain('unlocked');
    });

    it('应触发 exp_gained 和 leveled_up 事件', () => {
      const events: string[] = [];
      system.onEvent((e) => events.push(e.type));

      system.unlock('warrior');
      system.addExp('warrior', 100);

      expect(events).toContain('exp_gained');
      expect(events).toContain('leveled_up');
    });

    it('取消订阅后不再收到事件', () => {
      const events: string[] = [];
      const unsub = system.onEvent((e) => events.push(e.type));

      system.unlock('warrior');
      unsub();
      system.unlock('mage');

      expect(events).toHaveLength(1);
      expect(events[0]).toBe('unlocked');
    });

    it('监听器异常不影响系统运行', () => {
      system.onEvent(() => {
        throw new Error('listener error');
      });

      // 系统操作不应抛出异常
      expect(() => system.unlock('warrior')).not.toThrow();
      expect(system.isUnlocked('warrior')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 重置
  // ----------------------------------------------------------
  describe('reset', () => {
    it('应重置所有角色到初始状态', () => {
      system.unlock('warrior');
      system.addExp('warrior', 200);

      system.reset();

      expect(system.isUnlocked('warrior')).toBe(false);
      // 重置后 level 回到初始值 1（构造时已初始化）
      expect(system.getLevel('warrior')).toBe(1);
    });

    it('重置不应清除事件监听器', () => {
      const events: string[] = [];
      system.onEvent((e) => events.push(e.type));

      system.unlock('warrior');
      system.reset();
      system.unlock('mage');

      expect(events).toContain('unlocked');
    });
  });
});
