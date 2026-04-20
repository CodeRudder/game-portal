/**
 * SiegeSystem 单元测试
 *
 * 覆盖攻城战系统的所有核心功能：
 * - 初始化（城墙、城门、士气）
 * - 城墙伤害/修复
 * - 城门伤害/开启
 * - 士气增减和溃逃
 * - 箭塔攻击
 * - 事件系统
 * - 序列化/反序列化
 * - 重置
 * - 边界条件
 */

import { SiegeSystem, type SiegeConfig, type SiegeEvent } from '../../modules/battle/SiegeSystem';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建默认攻城配置 */
function createDefaultConfig(overrides?: Partial<SiegeConfig>): SiegeConfig {
  return {
    walls: [
      { id: 'wall-n', position: { x: 5, y: 0 }, maxHp: 200, defense: 10, type: 'wall' },
      { id: 'wall-s', position: { x: 5, y: 10 }, maxHp: 200, defense: 10, type: 'wall' },
      { id: 'tower-nw', position: { x: 0, y: 0 }, maxHp: 300, defense: 15, type: 'tower' },
      { id: 'tower-ne', position: { x: 10, y: 0 }, maxHp: 300, defense: 15, type: 'tower' },
    ],
    gate: { maxHp: 150, defense: 5 },
    initialMorale: { attacker: 80, defender: 90 },
    moraleThreshold: 20,
    towerDamage: 15,
    towerRange: 3,
    ...overrides,
  };
}

/** 创建攻城系统实例 */
function createSiegeSystem(overrides?: Partial<SiegeConfig>): SiegeSystem {
  return new SiegeSystem(createDefaultConfig(overrides));
}

/** 创建模拟单位（用于箭塔测试） */
function createMockUnit(overrides: {
  id: string;
  side: 'attacker' | 'defender';
  isAlive?: boolean;
  position?: { x: number; y: number };
}) {
  return {
    id: overrides.id,
    side: overrides.side,
    isAlive: overrides.isAlive ?? true,
    position: overrides.position ?? { x: 0, y: 0 },
  };
}

// ============================================================
// 测试套件
// ============================================================

describe('SiegeSystem', () => {
  let siege: SiegeSystem;

  beforeEach(() => {
    siege = createSiegeSystem();
  });

  // ============================================================
  // 构造函数与初始化
  // ============================================================

  describe('构造函数', () => {
    it('应正确初始化城墙段', () => {
      const walls = siege.getWalls();
      expect(walls).toHaveLength(4);
      expect(walls[0].id).toBe('wall-n');
      expect(walls[0].currentHp).toBe(200);
      expect(walls[0].isDestroyed).toBe(false);
    });

    it('应正确初始化城门', () => {
      const gate = siege.getGate();
      expect(gate.currentHp).toBe(150);
      expect(gate.maxHp).toBe(150);
      expect(gate.isOpen).toBe(false);
      expect(gate.isDestroyed).toBe(false);
    });

    it('应正确初始化士气', () => {
      const morale = siege.getMorale();
      expect(morale.attackerMorale).toBe(80);
      expect(morale.defenderMorale).toBe(90);
      expect(morale.attackerModifiers).toHaveLength(0);
      expect(morale.defenderModifiers).toHaveLength(0);
    });

    it('应支持自定义士气阈值', () => {
      const s = createSiegeSystem({ moraleThreshold: 30 });
      const state = s.getState();
      expect((state.config as SiegeConfig).moraleThreshold).toBe(30);
    });
  });

  // ============================================================
  // getWalls / getWall
  // ============================================================

  describe('getWalls / getWall', () => {
    it('getWalls 应返回所有城墙段的拷贝', () => {
      const walls = siege.getWalls();
      expect(walls).toHaveLength(4);
      // 修改返回值不应影响内部状态
      walls[0].currentHp = 0;
      expect(siege.getWall('wall-n')!.currentHp).toBe(200);
    });

    it('getWall 应返回指定城墙段', () => {
      const wall = siege.getWall('wall-n');
      expect(wall).toBeDefined();
      expect(wall!.id).toBe('wall-n');
      expect(wall!.type).toBe('wall');
    });

    it('getWall 不存在的 ID 应返回 undefined', () => {
      expect(siege.getWall('non-existent')).toBeUndefined();
    });

    it('应正确区分城墙类型', () => {
      const wallN = siege.getWall('wall-n');
      const tower = siege.getWall('tower-nw');
      expect(wallN!.type).toBe('wall');
      expect(tower!.type).toBe('tower');
    });
  });

  // ============================================================
  // damageWall — 城墙伤害
  // ============================================================

  describe('damageWall', () => {
    it('应对城墙造成伤害', () => {
      const result = siege.damageWall('wall-n', 30);
      // 实际伤害 = 30 - 10(defense) = 20
      expect(result.currentHp).toBe(180);
    });

    it('伤害至少为 1', () => {
      const result = siege.damageWall('wall-n', 5);
      // 5 - 10 = -5, 但最少为 1
      expect(result.currentHp).toBe(199);
    });

    it('城墙 HP 不应低于 0', () => {
      siege.damageWall('wall-n', 500);
      const wall = siege.getWall('wall-n');
      expect(wall!.currentHp).toBe(0);
    });

    it('城墙被摧毁时应设置 isDestroyed', () => {
      siege.damageWall('wall-n', 500);
      const wall = siege.getWall('wall-n');
      expect(wall!.isDestroyed).toBe(true);
    });

    it('城墙被摧毁应发射 wall_destroyed 事件', () => {
      const handler = jest.fn();
      siege.on(handler);
      siege.damageWall('wall-n', 500);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'wall_destroyed' }),
      );
    });

    it('城墙被破坏应降低防守方士气 5', () => {
      siege.damageWall('wall-n', 500);
      const morale = siege.getMorale();
      expect(morale.defenderMorale).toBe(85); // 90 - 5
    });

    it('对已摧毁的城墙造成伤害应无效果', () => {
      siege.damageWall('wall-n', 500);
      const result = siege.damageWall('wall-n', 50);
      expect(result.currentHp).toBe(0);
      expect(result.isDestroyed).toBe(true);
    });

    it('不存在的城墙应抛出错误', () => {
      expect(() => siege.damageWall('non-existent', 10)).toThrow('城墙段不存在');
    });

    it('应发射 wall_damaged 事件', () => {
      const handler = jest.fn();
      siege.on(handler);
      siege.damageWall('wall-n', 30);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'wall_damaged',
          data: expect.objectContaining({ wallId: 'wall-n', damage: 20 }),
        }),
      );
    });

    it('多次伤害应累积', () => {
      siege.damageWall('wall-n', 30); // -20
      siege.damageWall('wall-n', 30); // -20
      const wall = siege.getWall('wall-n');
      expect(wall!.currentHp).toBe(160);
    });
  });

  // ============================================================
  // repairWall — 城墙修复
  // ============================================================

  describe('repairWall', () => {
    it('应修复城墙 HP', () => {
      siege.damageWall('wall-n', 30);
      const result = siege.repairWall('wall-n', 10);
      expect(result.currentHp).toBe(190); // 180 + 10
    });

    it('修复不应超过最大 HP', () => {
      siege.damageWall('wall-n', 30);
      const result = siege.repairWall('wall-n', 1000);
      expect(result.currentHp).toBe(200);
    });

    it('修复被摧毁的城墙应恢复其状态', () => {
      siege.damageWall('wall-n', 500);
      expect(siege.getWall('wall-n')!.isDestroyed).toBe(true);
      siege.repairWall('wall-n', 100);
      const wall = siege.getWall('wall-n');
      expect(wall!.isDestroyed).toBe(false);
      expect(wall!.currentHp).toBe(100);
    });

    it('满 HP 城墙修复应无效果', () => {
      const result = siege.repairWall('wall-n', 50);
      expect(result.currentHp).toBe(200);
    });

    it('不存在的城墙应抛出错误', () => {
      expect(() => siege.repairWall('non-existent', 10)).toThrow('城墙段不存在');
    });
  });

  // ============================================================
  // damageGate — 城门伤害
  // ============================================================

  describe('damageGate', () => {
    it('应对城门造成伤害', () => {
      const result = siege.damageGate(30);
      // 实际伤害 = 30 - 5(defense) = 25
      expect(result.currentHp).toBe(125);
    });

    it('伤害至少为 1', () => {
      const result = siege.damageGate(1);
      expect(result.currentHp).toBe(149);
    });

    it('城门被摧毁应设置 isDestroyed', () => {
      siege.damageGate(500);
      const gate = siege.getGate();
      expect(gate.isDestroyed).toBe(true);
    });

    it('城门被摧毁应自动打开', () => {
      siege.damageGate(500);
      const gate = siege.getGate();
      expect(gate.isOpen).toBe(true);
    });

    it('城门被摧毁应发射 gate_destroyed 事件', () => {
      const handler = jest.fn();
      siege.on(handler);
      siege.damageGate(500);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'gate_destroyed' }),
      );
    });

    it('城门被破坏应降低防守方士气 15', () => {
      siege.damageGate(500);
      const morale = siege.getMorale();
      expect(morale.defenderMorale).toBe(75); // 90 - 15
    });

    it('对已摧毁的城门造成伤害应无效果', () => {
      siege.damageGate(500);
      const result = siege.damageGate(50);
      expect(result.currentHp).toBe(0);
    });
  });

  // ============================================================
  // openGate — 开启城门
  // ============================================================

  describe('openGate', () => {
    it('应成功开启城门', () => {
      const result = siege.openGate();
      expect(result).toBe(true);
      expect(siege.getGate().isOpen).toBe(true);
    });

    it('应发射 gate_opened 事件', () => {
      const handler = jest.fn();
      siege.on(handler);
      siege.openGate();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'gate_opened' }),
      );
    });

    it('已打开的城门不应重复开启', () => {
      siege.openGate();
      const result = siege.openGate();
      expect(result).toBe(false);
    });

    it('已摧毁的城门无法开启', () => {
      siege.damageGate(500);
      const result = siege.openGate();
      expect(result).toBe(false);
    });
  });

  // ============================================================
  // modifyMorale — 士气修改
  // ============================================================

  describe('modifyMorale', () => {
    it('应增加攻击方士气', () => {
      siege.modifyMorale('attacker', 5, '击杀敌方');
      expect(siege.getMorale().attackerMorale).toBe(85);
    });

    it('应减少防守方士气', () => {
      siege.modifyMorale('defender', -5, '城墙被破坏');
      expect(siege.getMorale().defenderMorale).toBe(85);
    });

    it('士气不应超过 100', () => {
      siege.modifyMorale('attacker', 50, '大胜');
      expect(siege.getMorale().attackerMorale).toBe(100);
    });

    it('士气不应低于 0', () => {
      siege.modifyMorale('defender', -200, '崩溃');
      expect(siege.getMorale().defenderMorale).toBe(0);
    });

    it('应记录士气修饰器', () => {
      siege.modifyMorale('attacker', 5, '击杀', 3);
      const morale = siege.getMorale();
      expect(morale.attackerModifiers).toHaveLength(1);
      expect(morale.attackerModifiers[0].source).toBe('击杀');
      expect(morale.attackerModifiers[0].durationTurns).toBe(3);
    });

    it('应发射 morale_changed 事件', () => {
      const handler = jest.fn();
      siege.on(handler);
      siege.modifyMorale('attacker', 5, '击杀');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'morale_changed',
          data: expect.objectContaining({ side: 'attacker', newValue: 85, delta: 5 }),
        }),
      );
    });
  });

  // ============================================================
  // updateMorale — 士气更新
  // ============================================================

  describe('updateMorale', () => {
    it('应递减临时修饰器持续回合', () => {
      siege.modifyMorale('attacker', 5, '临时增益', 2);
      siege.updateMorale();
      const morale = siege.getMorale();
      expect(morale.attackerModifiers[0].durationTurns).toBe(1);
    });

    it('应移除过期的临时修饰器', () => {
      siege.modifyMorale('attacker', 5, '临时增益', 1);
      siege.updateMorale(); // 递减到 0，移除
      const morale = siege.getMorale();
      expect(morale.attackerModifiers).toHaveLength(0);
    });

    it('永久修饰器（durationTurns=0）不应被移除', () => {
      siege.modifyMorale('attacker', 5, '永久增益', 0);
      siege.updateMorale();
      siege.updateMorale();
      const morale = siege.getMorale();
      expect(morale.attackerModifiers).toHaveLength(1);
    });

    it('士气低于阈值应触发溃逃', () => {
      const handler = jest.fn();
      siege.on(handler);
      siege.modifyMorale('defender', -75, '大败'); // 90 - 75 = 15 < 20
      siege.updateMorale();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'morale_rout', data: { side: 'defender' } }),
      );
    });

    it('士气恢复后应取消溃逃', () => {
      siege.modifyMorale('defender', -75, '大败'); // 15
      siege.updateMorale();
      expect(siege.isRouted('defender')).toBe(true);

      siege.modifyMorale('defender', 50, '反攻'); // 65
      siege.updateMorale();
      expect(siege.isRouted('defender')).toBe(false);
    });
  });

  // ============================================================
  // isRouted — 溃逃检查
  // ============================================================

  describe('isRouted', () => {
    it('初始状态不应溃逃', () => {
      expect(siege.isRouted('attacker')).toBe(false);
      expect(siege.isRouted('defender')).toBe(false);
    });

    it('士气低于阈值后应溃逃', () => {
      siege.modifyMorale('attacker', -65, '大败'); // 80 - 65 = 15 < 20
      siege.updateMorale();
      expect(siege.isRouted('attacker')).toBe(true);
    });
  });

  // ============================================================
  // getTowerAttacks — 箭塔攻击
  // ============================================================

  describe('getTowerAttacks', () => {
    it('应攻击范围内的攻方单位', () => {
      const units = [
        createMockUnit({ id: 'atk-1', side: 'attacker', position: { x: 0, y: 1 } }), // 距离 tower-nw(0,0) = 1
        createMockUnit({ id: 'def-1', side: 'defender', position: { x: 0, y: 1 } }),
      ];
      const attacks = siege.getTowerAttacks(units);
      // tower-nw (0,0) 范围 3 内的攻方单位
      expect(attacks.length).toBeGreaterThan(0);
      expect(attacks[0].targetId).toBe('atk-1');
      expect(attacks[0].damage).toBe(15);
    });

    it('不应攻击防守方单位', () => {
      const units = [
        createMockUnit({ id: 'def-1', side: 'defender', position: { x: 0, y: 0 } }),
      ];
      const attacks = siege.getTowerAttacks(units);
      expect(attacks).toHaveLength(0);
    });

    it('范围外的单位不应被攻击', () => {
      const units = [
        createMockUnit({ id: 'atk-1', side: 'attacker', position: { x: 50, y: 50 } }),
      ];
      const attacks = siege.getTowerAttacks(units);
      expect(attacks).toHaveLength(0);
    });

    it('已摧毁的箭塔不应攻击', () => {
      siege.damageWall('tower-nw', 500); // 摧毁箭塔
      siege.damageWall('tower-ne', 500); // 摧毁箭塔
      const units = [
        createMockUnit({ id: 'atk-1', side: 'attacker', position: { x: 0, y: 0 } }),
      ];
      const attacks = siege.getTowerAttacks(units);
      expect(attacks).toHaveLength(0);
    });

    it('已死亡的单位不应被攻击', () => {
      const units = [
        createMockUnit({ id: 'atk-1', side: 'attacker', isAlive: false, position: { x: 0, y: 0 } }),
      ];
      const attacks = siege.getTowerAttacks(units);
      expect(attacks).toHaveLength(0);
    });

    it('多个箭塔可攻击同一单位', () => {
      // 单位在两个箭塔的范围内
      const units = [
        createMockUnit({ id: 'atk-1', side: 'attacker', position: { x: 5, y: 1 } }),
      ];
      // tower-nw (0,0) 距离 (5,1) = sqrt(26) ≈ 5.1 > 3
      // tower-ne (10,0) 距离 (5,1) = sqrt(26) ≈ 5.1 > 3
      // 所以这个位置不在范围内，换一个位置
      const units2 = [
        createMockUnit({ id: 'atk-1', side: 'attacker', position: { x: 1, y: 0 } }),
      ];
      // tower-nw (0,0) 距离 (1,0) = 1 <= 3 ✓
      // tower-ne (10,0) 距离 (1,0) = 9 > 3 ✗
      const attacks = siege.getTowerAttacks(units2);
      expect(attacks).toHaveLength(1);
    });
  });

  // ============================================================
  // 事件系统
  // ============================================================

  describe('事件系统', () => {
    it('应注册和调用事件监听器', () => {
      const handler = jest.fn();
      siege.on(handler);
      siege.damageWall('wall-n', 30);
      expect(handler).toHaveBeenCalled();
    });

    it('应注销事件监听器', () => {
      const handler = jest.fn();
      siege.on(handler);
      siege.off(handler);
      siege.damageWall('wall-n', 30);
      expect(handler).not.toHaveBeenCalled();
    });

    it('多个监听器都应被调用', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      siege.on(handler1);
      siege.on(handler2);
      siege.damageWall('wall-n', 30);
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  // ============================================================
  // 序列化 / 反序列化
  // ============================================================

  describe('getState / loadState', () => {
    it('序列化后反序列化应恢复状态', () => {
      siege.damageWall('wall-n', 30);
      siege.damageGate(30);
      siege.modifyMorale('attacker', 5, '击杀');

      const data = siege.getState();
      const newSiege = createSiegeSystem();
      newSiege.loadState(data);

      expect(newSiege.getWall('wall-n')!.currentHp).toBe(180);
      expect(newSiege.getGate().currentHp).toBe(125); // 150 - (30-5) = 125
      expect(newSiege.getMorale().attackerMorale).toBe(85);
    });

    it('空数据不应崩溃', () => {
      expect(() => siege.loadState({})).not.toThrow();
    });

    it('null 数据不应崩溃', () => {
      expect(() => siege.loadState(null as any)).not.toThrow();
    });

    it('undefined 数据不应崩溃', () => {
      expect(() => siege.loadState(undefined as any)).not.toThrow();
    });

    it('应正确序列化城墙', () => {
      siege.damageWall('wall-n', 30);
      const data = siege.getState();
      const walls = data.walls as any[];
      expect(walls[0].currentHp).toBe(180);
    });

    it('应正确序列化士气', () => {
      siege.modifyMorale('defender', -10, '测试');
      const data = siege.getState();
      const morale = data.morale as any;
      expect(morale.defenderMorale).toBe(80);
    });
  });

  // ============================================================
  // 重置
  // ============================================================

  describe('reset', () => {
    it('应重置城墙到初始状态', () => {
      siege.damageWall('wall-n', 500);
      siege.reset();
      expect(siege.getWall('wall-n')!.currentHp).toBe(200);
      expect(siege.getWall('wall-n')!.isDestroyed).toBe(false);
    });

    it('应重置城门到初始状态', () => {
      siege.damageGate(500);
      siege.reset();
      const gate = siege.getGate();
      expect(gate.currentHp).toBe(150);
      expect(gate.isDestroyed).toBe(false);
      expect(gate.isOpen).toBe(false);
    });

    it('应重置士气到初始值', () => {
      siege.modifyMorale('attacker', -50, '大败');
      siege.modifyMorale('defender', -50, '大败');
      siege.reset();
      const morale = siege.getMorale();
      expect(morale.attackerMorale).toBe(80);
      expect(morale.defenderMorale).toBe(90);
      expect(morale.attackerModifiers).toHaveLength(0);
      expect(morale.defenderModifiers).toHaveLength(0);
    });

    it('应重置溃逃状态', () => {
      siege.modifyMorale('attacker', -65, '大败');
      siege.updateMorale();
      expect(siege.isRouted('attacker')).toBe(true);
      siege.reset();
      expect(siege.isRouted('attacker')).toBe(false);
    });
  });

  // ============================================================
  // 边界条件
  // ============================================================

  describe('边界条件', () => {
    it('没有城墙时应正常工作', () => {
      const s = createSiegeSystem({ walls: [] });
      expect(s.getWalls()).toHaveLength(0);
      expect(s.getTowerAttacks([])).toHaveLength(0);
    });

    it('士气为 0 时应稳定工作', () => {
      siege.modifyMorale('attacker', -80, '大败'); // 0
      siege.updateMorale();
      expect(siege.getMorale().attackerMorale).toBe(0);
      expect(siege.isRouted('attacker')).toBe(true);
    });

    it('士气为 100 时应稳定工作', () => {
      siege.modifyMorale('attacker', 20, '大胜'); // 100
      expect(siege.getMorale().attackerMorale).toBe(100);
    });

    it('空单位列表的箭塔攻击应返回空数组', () => {
      expect(siege.getTowerAttacks([])).toHaveLength(0);
    });

    it('城墙防御大于伤害时实际伤害为 1', () => {
      const wall = siege.getWall('wall-n');
      expect(wall!.defense).toBe(10);
      const result = siege.damageWall('wall-n', 1);
      expect(result.currentHp).toBe(199); // 200 - 1
    });

    it('城门防御大于伤害时实际伤害为 1', () => {
      const result = siege.damageGate(1);
      expect(result.currentHp).toBe(149); // 150 - 1
    });

    it('getMorale 应返回深拷贝', () => {
      const morale1 = siege.getMorale();
      morale1.attackerModifiers.push({ source: 'test', value: 5, durationTurns: 1 });
      const morale2 = siege.getMorale();
      expect(morale2.attackerModifiers).toHaveLength(0);
    });
  });
});
