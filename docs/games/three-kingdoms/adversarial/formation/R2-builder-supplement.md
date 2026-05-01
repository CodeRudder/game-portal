# R2: Formation 编队模块 — Builder补充 + 测试代码 (Builder)

> Builder: 针对R1 Arbiter裁决的P0/P1遗漏，补充测试分支树和具体测试代码

## R2补充分支树 (基于R1 Arbiter指令)

### 新增/补充节点

```
T1-ADD: 编队互斥一致性
├── T1-ADD.1 [P0] setFormation绕过互斥检查
│   → 编队A有hero1, setFormation('B',['hero1']) → hero1出现在两个编队
│   → 验证 isGeneralInAnyFormation('hero1') 返回true但无法区分编队归属
├── T1-ADD.2 [P0] setFormation混合值过滤精确行为
│   → [null,'a',undefined,'','b','c','d','e','f','g'] → filter后7个 → slice(0,6) → 6个
│   → [null,undefined,''] → filter后0个 → 空编队
│   → ['a',null,'b',undefined,'c'] → filter后3个 → 正确
└── T1-ADD.3 [P1] deleteFormation后武将互斥释放
    → 编队A有hero1, deleteFormation('A'), addToFormation('B','hero1') → 成功

T4-ADD: 反序列化安全
└── T4-ADD.1 [P0] activeFormationId指向不存在编队
    → deserialize({state:{formations:{'1':...}, activeFormationId:'99'}})
    → getActiveFormation() → null (因为formations['99']不存在)
    → 但getActiveFormationId() → '99' (不一致!)

T5-ADD: 一键布阵副作用
└── T5-ADD.1 [P1] autoFormationByIds空候选时创建编队
    → 编队不存在 + 空候选列表 → createFormation被调用 → 返回null → 但编队已创建

T6-ADD: 动态上限边界
└── T6-ADD.1 [P1] setMaxFormations边界值
    → setMaxFormations(0) → 3
    → setMaxFormations(3) → 3
    → setMaxFormations(5) → 5
    → setMaxFormations(6) → 5
    → setMaxFormations(-1) → 3

T3-ADD: 异常值传播
├── T3-ADD.1 [P1] calcPower返回NaN
│   → calculateFormationPower with NaN calcPower → 结果为NaN
└── T3-ADD.2 [P1] calcPower返回Infinity
    → calculateFormationPower with Infinity → Math.floor(Infinity) = Infinity

T7-ADD: 推荐系统异常值
├── T7-ADD.1 [P1] calculatePower返回负数
└── T7-ADD.2 [P2] 空阵营字符串

T8-ADD: 防守系统补充
├── T8-ADD.1 [P2] 全部dead单位
├── T8-ADD.2 [P2] 异常消息验证
└── T8-ADD.3 [P2] 日志老化精确行为
```

---

## R2测试代码

### 文件1: HeroFormation.adversarial.p0.test.ts

```typescript
/**
 * R2 Adversarial Test — P0级别修复验证
 *
 * 覆盖R1 Arbiter确认的3个P0遗漏：
 * 1. setFormation绕过互斥检查
 * 2. setFormation混合值过滤边界
 * 3. deserialize activeFormationId悬空
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HeroFormation, MAX_SLOTS_PER_FORMATION } from '../HeroFormation';
import type { FormationSaveData } from '../formation-types';

describe('HeroFormation — R2 Adversarial P0 Fixes', () => {
  let formation: HeroFormation;

  beforeEach(() => {
    formation = new HeroFormation();
  });

  // ═══════════════════════════════════════════
  // P0-1: setFormation绕过互斥检查
  // ═══════════════════════════════════════════
  describe('P0-1: setFormation bypasses mutual exclusion', () => {
    it('should allow same hero in multiple formations via setFormation (BUG)', () => {
      // 编队A添加hero1
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');

      // 编队B通过setFormation直接设置hero1 — 绕过互斥检查
      formation.createFormation('2');
      const result = formation.setFormation('2', ['hero1']);

      // BUG: setFormation不检查互斥，hero1出现在两个编队中
      // 预期行为：应该拒绝或自动从编队A移除
      // 实际行为：成功设置
      expect(result).not.toBeNull();
      expect(result!.slots[0]).toBe('hero1');

      // 验证hero1确实在两个编队中
      const f1 = formation.getFormation('1')!;
      const f2 = formation.getFormation('2')!;
      expect(f1.slots).toContain('hero1');
      expect(f2.slots).toContain('hero1');

      // isGeneralInAnyFormation只返回true，无法区分
      expect(formation.isGeneralInAnyFormation('hero1')).toBe(true);
      // hero1出现在两个编队中
      const containing = formation.getFormationsContainingGeneral('hero1');
      expect(containing).toHaveLength(2);
      expect(containing).toContain('1');
      expect(containing).toContain('2');
    });

    it('should detect cross-formation duplication after setFormation', () => {
      formation.createFormation('1');
      formation.createFormation('2');

      formation.setFormation('1', ['heroA', 'heroB']);
      formation.setFormation('2', ['heroB', 'heroC']); // heroB重复

      const heroBFormations = formation.getFormationsContainingGeneral('heroB');
      // BUG: heroB在两个编队中
      expect(heroBFormations.length).toBeGreaterThan(1);
    });
  });

  // ═══════════════════════════════════════════
  // P0-2: setFormation混合值过滤边界
  // ═══════════════════════════════════════════
  describe('P0-2: setFormation mixed value filtering boundary', () => {
    it('should filter null/undefined/empty and truncate to MAX_SLOTS', () => {
      formation.createFormation('1');

      const mixed = [null, 'a', undefined, '', 'b', 'c', 'd', 'e', 'f', 'g'] as unknown as string[];
      const result = formation.setFormation('1', mixed);

      expect(result).not.toBeNull();
      // filter后: ['a','b','c','d','e','f','g'] = 7个
      // slice(0,6): ['a','b','c','d','e','f']
      expect(result!.slots[0]).toBe('a');
      expect(result!.slots[1]).toBe('b');
      expect(result!.slots[2]).toBe('c');
      expect(result!.slots[3]).toBe('d');
      expect(result!.slots[4]).toBe('e');
      expect(result!.slots[5]).toBe('f');
      expect(result!.slots).toHaveLength(MAX_SLOTS_PER_FORMATION);
    });

    it('should result in empty formation when all values are null/undefined/empty', () => {
      formation.createFormation('1');

      const allInvalid = [null, undefined, '', null, undefined, ''] as unknown as string[];
      const result = formation.setFormation('1', allInvalid);

      expect(result).not.toBeNull();
      expect(result!.slots.every(s => s === '')).toBe(true);
    });

    it('should handle sparse valid values among invalid ones', () => {
      formation.createFormation('1');

      const sparse = ['a', null, 'b', undefined, 'c'] as unknown as string[];
      const result = formation.setFormation('1', sparse);

      expect(result).not.toBeNull();
      expect(result!.slots[0]).toBe('a');
      expect(result!.slots[1]).toBe('b');
      expect(result!.slots[2]).toBe('c');
      expect(result!.slots[3]).toBe('');
    });

    it('should handle exactly MAX_SLOTS valid values', () => {
      formation.createFormation('1');

      const exact = Array.from({ length: MAX_SLOTS_PER_FORMATION }, (_, i) => `hero${i}`);
      const result = formation.setFormation('1', exact);

      expect(result).not.toBeNull();
      expect(result!.slots.filter(s => s !== '')).toHaveLength(MAX_SLOTS_PER_FORMATION);
    });
  });

  // ═══════════════════════════════════════════
  // P0-3: deserialize activeFormationId悬空
  // ═══════════════════════════════════════════
  describe('P0-3: deserialize with dangling activeFormationId', () => {
    it('should handle activeFormationId pointing to non-existent formation', () => {
      const maliciousData: FormationSaveData = {
        version: 1,
        state: {
          formations: {
            '1': { id: '1', name: '第一队', slots: ['', '', '', '', '', ''] },
          },
          activeFormationId: '99', // 指向不存在的编队
        },
      };

      formation.deserialize(maliciousData);

      // getActiveFormationId返回'99'（不一致状态）
      expect(formation.getActiveFormationId()).toBe('99');
      // 但getActiveFormation返回null（因为formations['99']不存在）
      expect(formation.getActiveFormation()).toBeNull();
      // 状态不一致：ID存在但数据不存在
    });

    it('should handle activeFormationId as null in deserialized data', () => {
      const data: FormationSaveData = {
        version: 1,
        state: {
          formations: {
            '1': { id: '1', name: '第一队', slots: ['hero1', '', '', '', '', ''] },
          },
          activeFormationId: null,
        },
      };

      formation.deserialize(data);
      expect(formation.getActiveFormationId()).toBeNull();
      expect(formation.getActiveFormation()).toBeNull();
      // 编队存在但未激活
      expect(formation.getFormation('1')).not.toBeNull();
    });

    it('should handle empty formations with non-null activeFormationId', () => {
      const data: FormationSaveData = {
        version: 1,
        state: {
          formations: {},
          activeFormationId: '1', // 无编队但有activeId
        },
      };

      formation.deserialize(data);
      expect(formation.getActiveFormationId()).toBe('1');
      expect(formation.getActiveFormation()).toBeNull();
      expect(formation.getFormationCount()).toBe(0);
    });
  });
});
```

### 文件2: HeroFormation.adversarial.p1.test.ts

```typescript
/**
 * R2 Adversarial Test — P1级别补充验证
 *
 * 覆盖R1 Arbiter接受的P1遗漏：
 * 1. autoFormationByIds空候选副作用
 * 2. deleteFormation后互斥释放
 * 3. renameFormation空字符串
 * 4. setMaxFormations边界
 * 5. calcPower异常值传播
 * 6. 序列化数据独立性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HeroFormation, MAX_FORMATIONS, MAX_SLOTS_PER_FORMATION } from '../HeroFormation';
import type { GeneralData } from '../hero.types';

function makeGeneral(id: string, power: number = 100): GeneralData {
  return {
    id, name: id, faction: 'shu', quality: 'EPIC' as any,
    level: 1, exp: 0,
    baseStats: { attack: power, defense: power, intelligence: power, speed: power },
    skills: [], isUnlocked: true, unlockTime: Date.now(),
  };
}

describe('HeroFormation — R2 Adversarial P1 Fixes', () => {
  let formation: HeroFormation;

  beforeEach(() => {
    formation = new HeroFormation();
  });

  // ═══════════════════════════════════════════
  // P1-1: autoFormationByIds空候选副作用
  // ═══════════════════════════════════════════
  describe('P1-1: autoFormationByIds empty candidate side effect', () => {
    it('should create formation as side effect even with empty candidates', () => {
      const beforeCount = formation.getFormationCount();

      const result = formation.autoFormationByIds(
        [], // 空候选列表
        (id) => undefined,
        (g) => g.baseStats.attack,
        '1',
      );

      // 返回null（无可用武将）
      expect(result).toBeNull();
      // 但编队已被创建（副作用）
      expect(formation.getFormationCount()).toBe(beforeCount + 1);
      // 编队存在但为空
      expect(formation.getFormation('1')).not.toBeNull();
    });

    it('should create formation even when all candidates are invalid', () => {
      const result = formation.autoFormationByIds(
        ['nonexistent1', 'nonexistent2'],
        (id) => undefined, // 所有武将都不存在
        (g) => 0,
        '1',
      );

      expect(result).toBeNull();
      // 副作用：编队被创建
      expect(formation.getFormation('1')).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // P1-2: deleteFormation后互斥释放
  // ═══════════════════════════════════════════
  describe('P1-2: mutual exclusion release after deleteFormation', () => {
    it('should allow hero to join another formation after its formation is deleted', () => {
      // 编队A有hero1
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');

      // 创建编队B
      formation.createFormation('2');

      // hero1在编队A中，不能加入B
      expect(formation.addToFormation('2', 'hero1')).toBeNull();

      // 删除编队A
      formation.deleteFormation('1');

      // hero1现在可以加入编队B
      const result = formation.addToFormation('2', 'hero1');
      expect(result).not.toBeNull();
      expect(result!.slots[0]).toBe('hero1');
    });

    it('should release all heroes when formation is deleted', () => {
      formation.createFormation('1');
      formation.createFormation('2');
      formation.addToFormation('1', 'hero1');
      formation.addToFormation('1', 'hero2');
      formation.addToFormation('1', 'hero3');

      // 删除编队1
      formation.deleteFormation('1');

      // 所有武将都可以加入编队2
      expect(formation.addToFormation('2', 'hero1')).not.toBeNull();
      expect(formation.addToFormation('2', 'hero2')).not.toBeNull();
      expect(formation.addToFormation('2', 'hero3')).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // P1-3: renameFormation空字符串
  // ═══════════════════════════════════════════
  describe('P1-3: renameFormation with empty string', () => {
    it('should accept empty string as name', () => {
      formation.createFormation('1');
      const result = formation.renameFormation('1', '');
      // 代码只做slice(0,10)，空字符串不触发截断
      expect(result).not.toBeNull();
      expect(result!.name).toBe('');
    });

    it('should accept whitespace-only name', () => {
      formation.createFormation('1');
      const result = formation.renameFormation('1', '   ');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('   ');
    });
  });

  // ═══════════════════════════════════════════
  // P1-4: setMaxFormations边界
  // ═══════════════════════════════════════════
  describe('P1-4: setMaxFormations boundary values', () => {
    it('should clamp 0 to MAX_FORMATIONS(3)', () => {
      formation.setMaxFormations(0);
      expect(formation.getMaxFormations()).toBe(MAX_FORMATIONS);
    });

    it('should clamp negative to MAX_FORMATIONS(3)', () => {
      formation.setMaxFormations(-1);
      expect(formation.getMaxFormations()).toBe(MAX_FORMATIONS);
    });

    it('should keep MAX_FORMATIONS(3) unchanged', () => {
      formation.setMaxFormations(3);
      expect(formation.getMaxFormations()).toBe(3);
    });

    it('should allow expansion to 4', () => {
      formation.setMaxFormations(4);
      expect(formation.getMaxFormations()).toBe(4);
    });

    it('should allow expansion to 5', () => {
      formation.setMaxFormations(5);
      expect(formation.getMaxFormations()).toBe(5);
    });

    it('should clamp 6 to 5', () => {
      formation.setMaxFormations(6);
      expect(formation.getMaxFormations()).toBe(5);
    });

    it('should clamp 100 to 5', () => {
      formation.setMaxFormations(100);
      expect(formation.getMaxFormations()).toBe(5);
    });

    it('should allow creating 4th formation after setMaxFormations(4)', () => {
      formation.setMaxFormations(4);
      formation.createFormation();
      formation.createFormation();
      formation.createFormation();
      const f4 = formation.createFormation();
      expect(f4).not.toBeNull();
      expect(f4!.id).toBe('4');
    });

    it('should allow creating 5th formation after setMaxFormations(5)', () => {
      formation.setMaxFormations(5);
      for (let i = 0; i < 5; i++) {
        const f = formation.createFormation();
        expect(f).not.toBeNull();
      }
      const f6 = formation.createFormation();
      expect(f6).toBeNull(); // 第6个应失败
    });
  });

  // ═══════════════════════════════════════════
  // P1-5: calcPower异常值传播
  // ═══════════════════════════════════════════
  describe('P1-5: calcPower abnormal value propagation', () => {
    it('should propagate NaN from calcPower', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');

      const f = formation.getFormation('1')!;
      const power = formation.calculateFormationPower(
        f,
        (id) => id === 'hero1' ? makeGeneral('hero1', 100) : undefined,
        () => NaN, // calcPower返回NaN
      );

      // NaN传播：Math.floor(NaN) = NaN
      expect(power).toBeNaN();
    });

    it('should propagate Infinity from calcPower', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');

      const f = formation.getFormation('1')!;
      const power = formation.calculateFormationPower(
        f,
        (id) => id === 'hero1' ? makeGeneral('hero1', 100) : undefined,
        () => Infinity,
      );

      // Infinity * bondBonus = Infinity, Math.floor(Infinity) = Infinity
      expect(power).toBe(Infinity);
    });

    it('should handle mixed NaN and normal values', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');
      formation.addToFormation('1', 'hero2');

      let callCount = 0;
      const f = formation.getFormation('1')!;
      const power = formation.calculateFormationPower(
        f,
        (id) => id === 'hero1' || id === 'hero2' ? makeGeneral(id, 100) : undefined,
        () => callCount++ === 0 ? NaN : 200,
      );

      // NaN + 200 = NaN
      expect(power).toBeNaN();
    });
  });

  // ═══════════════════════════════════════════
  // P1-6: 序列化数据独立性
  // ═══════════════════════════════════════════
  describe('P1-6: serialization data independence', () => {
    it('should not affect internal state when modifying serialized data', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');

      const serialized = formation.serialize();
      // 修改序列化数据
      serialized.state.formations['1'].slots[0] = 'HACKED';
      serialized.state.formations['1'].name = 'HACKED';

      // 内部状态不受影响
      const f = formation.getFormation('1')!;
      expect(f.slots[0]).toBe('hero1');
      expect(f.name).toBe('第一队');
    });

    it('should not affect deserialized data when modifying source', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');

      const serialized = formation.serialize();

      // 创建新实例并反序列化
      const other = new HeroFormation();
      other.deserialize(serialized);

      // 修改源数据
      serialized.state.formations['1'].slots[0] = 'HACKED';

      // 反序列化的实例不受影响
      const f = other.getFormation('1')!;
      expect(f.slots[0]).toBe('hero1');
    });
  });
});
```

### 文件3: FormationRecommend.adversarial.p1.test.ts

```typescript
/**
 * R2 Adversarial Test — 推荐系统P1补充
 */

import { describe, it, expect } from 'vitest';
import { FormationRecommendSystem } from '../FormationRecommendSystem';
import type { GeneralData } from '../hero.types';

function makeGeneral(id: string, power: number, faction: string = 'shu'): GeneralData {
  return {
    id, name: id, faction, quality: 'EPIC' as any,
    level: 1, exp: 0,
    baseStats: { attack: power, defense: power, intelligence: power, speed: power },
    skills: [], isUnlocked: true, unlockTime: Date.now(),
  };
}

describe('FormationRecommendSystem — R2 Adversarial P1', () => {
  let system: FormationRecommendSystem;

  beforeEach(() => {
    system = new FormationRecommendSystem();
  });

  it('should handle negative power values', () => {
    const heroes = [
      makeGeneral('h1', -100),
      makeGeneral('h2', 200),
      makeGeneral('h3', 300),
    ];

    const result = system.recommend('normal', heroes, (g) => g.baseStats.attack);
    // 负战力武将排在最后，不应出现在最优方案前排
    expect(result.plans.length).toBeGreaterThan(0);
    if (result.plans[0]) {
      expect(result.plans[0].heroIds[0]).not.toBe('h1');
    }
  });

  it('should handle heroes with empty faction string', () => {
    const heroes = [
      makeGeneral('h1', 100, ''),
      makeGeneral('h2', 200, ''),
      makeGeneral('h3', 300, ''),
      makeGeneral('h4', 400, 'shu'),
    ];

    const result = system.recommend('normal', heroes, (g) => g.baseStats.attack);
    // 空字符串阵营应被分组在一起
    expect(result.plans.length).toBeGreaterThan(0);
  });

  it('should handle single hero against very high difficulty', () => {
    const heroes = [makeGeneral('h1', 100)];

    const result = system.recommend('boss', heroes, (g) => g.baseStats.attack, 99999, 6);
    expect(result.plans.length).toBe(1); // 只有最强战力方案
    expect(result.plans[0].estimatedPower).toBe(200); // 100+100
    expect(result.plans[0].score).toBeLessThan(50); // 分数应很低
  });

  it('should handle null heroes in list', () => {
    const heroes = [null, makeGeneral('h1', 100), undefined, makeGeneral('h2', 200)] as unknown as GeneralData[];

    const result = system.recommend('normal', heroes, (g) => g.baseStats.attack);
    expect(result.plans.length).toBeGreaterThan(0);
  });

  it('should handle calculatePower returning NaN', () => {
    const heroes = [makeGeneral('h1', 100), makeGeneral('h2', 200)];

    const result = system.recommend('normal', heroes, (g) => NaN);
    // NaN被转换为0（safeHeroes中的Number.isFinite检查）
    expect(result.plans.length).toBeGreaterThan(0);
  });
});
```

### 文件4: DefenseFormation.adversarial.test.ts

```typescript
/**
 * R2 Adversarial Test — 防守阵容系统补充
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DefenseFormationSystem, MAX_DEFENSE_LOGS } from '../../pvp/DefenseFormationSystem';
import { FormationType, AIDefenseStrategy } from '../../../core/pvp/pvp.types';

describe('DefenseFormationSystem — R2 Adversarial', () => {
  let system: DefenseFormationSystem;

  beforeEach(() => {
    system = new DefenseFormationSystem();
  });

  describe('异常消息验证', () => {
    it('should throw error when no heroes in defense formation', () => {
      const default_ = system.createDefaultFormation();
      expect(() =>
        system.setFormation(default_, ['', '', '', '', ''])
      ).toThrow('防守阵容至少需要1名武将');
    });

    it('should throw error when exceeding max heroes', () => {
      const default_ = system.createDefaultFormation();
      // TypeScript编译期会拦截，但运行时测试
      const tooMany = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as unknown as [string, string, string, string, string];
      // 长度6 > 5，应抛出异常
      expect(() => system.setFormation(default_, tooMany)).toThrow();
    });
  });

  describe('日志老化', () => {
    it('should discard oldest log when exceeding MAX_DEFENSE_LOGS', () => {
      let logs: any[] = [];

      // 添加51条日志
      for (let i = 0; i < MAX_DEFENSE_LOGS + 1; i++) {
        logs = system.addDefenseLog(logs, {
          attackerId: `attacker_${i}`,
          defenderWon: true,
          timestamp: Date.now() + i,
        });
      }

      // 应最多50条
      expect(logs.length).toBe(MAX_DEFENSE_LOGS);
      // 最新的应该在前面
      expect(logs[0].attackerId).toBe(`attacker_${MAX_DEFENSE_LOGS}`);
      // 最老的（attacker_0）应该被丢弃
      expect(logs.find((l: any) => l.attackerId === 'attacker_0')).toBeUndefined();
    });
  });

  describe('阵容验证', () => {
    it('should detect duplicate heroes in defense formation', () => {
      const default_ = system.createDefaultFormation();
      const dup = system.setFormation(default_, ['hero1', 'hero1', '', '', '']);
      const validation = system.validateFormation(dup);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('武将不能重复');
    });

    it('should validate formation type', () => {
      const default_ = system.createDefaultFormation();
      const modified = { ...default_, formation: 'INVALID' as FormationType };
      const validation = system.validateFormation(modified);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('无效的阵型');
    });
  });

  describe('序列化/反序列化', () => {
    it('should serialize and deserialize defense data', () => {
      const default_ = system.createDefaultFormation();
      const formation = system.setFormation(default_, ['h1', 'h2', '', '', '']);

      const playerState = {
        defenseFormation: formation,
        defenseLogs: [],
      } as any;

      const serialized = system.serialize(playerState);
      const deserialized = system.deserialize(serialized);

      expect(deserialized.defenseFormation).toBeDefined();
      expect(deserialized.defenseFormation!.slots[0]).toBe('h1');
    });

    it('should create default formation when deserializing null data', () => {
      const result = system.deserialize({
        defenseFormation: null as any,
        defenseLogs: null as any,
      });
      expect(result.defenseFormation).toBeDefined();
      expect(result.defenseFormation!.formation).toBe(FormationType.FISH_SCALE);
    });
  });
});
```

### 文件5: autoFormation.adversarial.test.ts

```typescript
/**
 * R2 Adversarial Test — 战斗布阵补充
 */

import { describe, it, expect } from 'vitest';
import { autoFormation } from '../autoFormation';
import type { BattleUnit } from '../battle.types';

function makeUnit(id: string, defense: number, hp: number, attack: number = 50, alive: boolean = true): BattleUnit {
  return {
    id,
    name: id,
    level: 1,
    maxHp: hp,
    currentHp: hp,
    attack,
    defense,
    intelligence: 50,
    speed: 50,
    skills: [],
    position: 'front',
    isAlive: alive,
    side: 'ally',
    buffIds: [],
    debuffIds: [],
    cooldowns: {},
  };
}

describe('autoFormation (battle) — R2 Adversarial', () => {
  it('should return empty result when all units are dead', () => {
    const units = [
      makeUnit('u1', 100, 1000, 50, false),
      makeUnit('u2', 80, 800, 60, false),
      makeUnit('u3', 60, 600, 70, false),
    ];

    const result = autoFormation(units);
    expect(result.frontLine).toHaveLength(0);
    expect(result.backLine).toHaveLength(0);
    expect(result.score).toBe(0);
    expect(result.team.units).toHaveLength(0);
  });

  it('should handle single alive unit among dead ones', () => {
    const units = [
      makeUnit('u1', 100, 1000, 50, false),
      makeUnit('u2', 80, 800, 60, true), // only alive
      makeUnit('u3', 60, 600, 70, false),
    ];

    const result = autoFormation(units);
    expect(result.frontLine).toHaveLength(1);
    expect(result.backLine).toHaveLength(0);
    expect(result.frontLine[0]).toBe('u2');
  });

  it('should not modify original unit positions', () => {
    const units = [
      makeUnit('u1', 100, 1000),
      makeUnit('u2', 80, 800),
    ];
    const originalPositions = units.map(u => u.position);

    autoFormation(units);

    // 原始单位position不应被修改（深拷贝）
    expect(units[0].position).toBe(originalPositions[0]);
    expect(units[1].position).toBe(originalPositions[1]);
  });

  it('should handle exactly 6 alive units', () => {
    const units = Array.from({ length: 8 }, (_, i) =>
      makeUnit(`u${i}`, 100 - i * 10, 1000 - i * 100, 50 + i * 10, i < 6)
    );

    const result = autoFormation(units);
    expect(result.team.units).toHaveLength(6);
    expect(result.frontLine).toHaveLength(3);
    expect(result.backLine).toHaveLength(3);
  });
});
```

---

## R2更新后的分支树统计

| 维度 | R1节点 | R2新增 | 总节点 | P0覆盖 |
|------|--------|--------|--------|--------|
| F-Normal | 22 | +4 | 26 | ✅ 100% |
| F-Boundary | 18 | +6 | 24 | ✅ 100% |
| F-Error | 9 | +5 | 14 | ✅ 100% |
| F-Cross | 14 | +2 | 16 | ⚠️ 部分P2延后 |
| F-Lifecycle | 10 | +3 | 13 | ✅ 100% |
| **总计** | **113** | **+20** | **133** | |

P0遗漏: 0 (全部已补充测试代码)
