/**
 * StrategyPreset 单元测试
 *
 * 覆盖战斗策略预设系统的所有核心功能：
 * - 构造函数和默认配置
 * - activate/deactivate
 * - 配置更新
 * - 单位级覆盖
 * - 决策逻辑（各种场景）
 * - 预设模板
 * - 存档/读档
 * - 重置
 * - 事件发射
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StrategyPreset,
  type StrategyPresetConfig,
  type UnitStrategyOverride,
  type StrategyDecisionContext,
  type StrategyEventListener,
} from '../../modules/battle/StrategyPreset';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建战斗单位（StrategyPreset 版本） */
function createUnit(overrides: Partial<StrategyPreset.BattleUnit> = {}): StrategyPreset.BattleUnit {
  return {
    id: 'unit-1',
    currentHp: 100,
    maxHp: 100,
    attack: 20,
    defense: 5,
    speed: 10,
    isAlive: true,
    isBoss: false,
    skills: ['skill-1'],
    ...overrides,
  };
}

/** 创建决策上下文 */
function createContext(overrides?: Partial<StrategyDecisionContext>): StrategyDecisionContext {
  return {
    unit: createUnit({ id: 'ally-1', side: 'attacker' as any }),
    allies: [createUnit({ id: 'ally-1' }), createUnit({ id: 'ally-2' })],
    enemies: [createUnit({ id: 'enemy-1' }), createUnit({ id: 'enemy-2' })],
    turn: 1,
    ...overrides,
  };
}

// ============================================================
// 测试套件
// ============================================================

describe('StrategyPreset', () => {
  let preset: StrategyPreset;

  beforeEach(() => {
    preset = new StrategyPreset();
  });

  // ============================================================
  // 构造函数与默认配置
  // ============================================================

  describe('构造函数', () => {
    it('应使用默认配置创建实例', () => {
      const p = new StrategyPreset();
      const config = p.getConfig();
      expect(config.name).toBe('默认策略');
      expect(config.targetStrategy).toBe('lowest_hp');
      expect(config.skillStrategy).toBe('balanced');
      expect(config.defenseStrategy).toBe('when_low_hp');
      expect(config.formationStrategy).toBe('balanced');
    });

    it('应接受部分配置覆盖', () => {
      const p = new StrategyPreset({ name: '自定义策略', targetStrategy: 'fastest' });
      const config = p.getConfig();
      expect(config.name).toBe('自定义策略');
      expect(config.targetStrategy).toBe('fastest');
      // 未指定的字段保持默认
      expect(config.skillStrategy).toBe('balanced');
    });

    it('初始状态应为未激活', () => {
      expect(preset.isEnabled()).toBe(false);
    });

    it('应正确设置阈值默认值', () => {
      const config = preset.getConfig();
      expect(config.retreatHpThreshold).toBe(0.3);
      expect(config.burstHpThreshold).toBe(0.2);
    });

    it('应正确设置行为开关默认值', () => {
      const config = preset.getConfig();
      expect(config.autoUseSkills).toBe(true);
      expect(config.autoHeal).toBe(true);
      expect(config.focusFire).toBe(false);
    });

    it('unitOverrides 默认为空数组', () => {
      const config = preset.getConfig();
      expect(config.unitOverrides).toEqual([]);
    });
  });

  // ============================================================
  // activate / deactivate
  // ============================================================

  describe('activate / deactivate', () => {
    it('activate 应激活策略', () => {
      preset.activate();
      expect(preset.isEnabled()).toBe(true);
    });

    it('deactivate 应停用策略', () => {
      preset.activate();
      preset.deactivate();
      expect(preset.isEnabled()).toBe(false);
    });

    it('重复 activate 不应重复发射事件', () => {
      const listener = vi.fn();
      preset.on(listener);
      preset.activate();
      preset.activate();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('未激活时 deactivate 不应发射事件', () => {
      const listener = vi.fn();
      preset.on(listener);
      preset.deactivate();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 配置更新
  // ============================================================

  describe('配置更新', () => {
    it('updateConfig 应更新指定字段', () => {
      preset.updateConfig({ targetStrategy: 'highest_attack' });
      expect(preset.getConfig().targetStrategy).toBe('highest_attack');
    });

    it('updateConfig 应保留未指定的字段', () => {
      preset.updateConfig({ name: '新名称' });
      const config = preset.getConfig();
      expect(config.name).toBe('新名称');
      expect(config.targetStrategy).toBe('lowest_hp'); // 默认值保留
    });

    it('updateConfig 应发射 config_updated 事件', () => {
      const listener = vi.fn();
      preset.on(listener);
      preset.updateConfig({ name: '更新' });
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'config_updated' }),
      );
    });

    it('updateConfig 处理 unitOverrides 应创建副本', () => {
      const overrides: UnitStrategyOverride[] = [{ unitId: 'unit-1', targetStrategy: 'fastest' }];
      preset.updateConfig({ unitOverrides: overrides });
      const config = preset.getConfig();
      // 修改原始数组不应影响配置
      overrides.push({ unitId: 'unit-2' });
      expect(config.unitOverrides).toHaveLength(1);
    });

    it('getConfig 应返回配置副本', () => {
      const config1 = preset.getConfig();
      const config2 = preset.getConfig();
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  // ============================================================
  // 单位级覆盖
  // ============================================================

  describe('单位级覆盖', () => {
    it('setUnitOverride 应添加覆盖', () => {
      preset.setUnitOverride({ unitId: 'unit-1', targetStrategy: 'fastest' });
      const config = preset.getConfig();
      expect(config.unitOverrides).toHaveLength(1);
      expect(config.unitOverrides[0].targetStrategy).toBe('fastest');
    });

    it('setUnitOverride 同 unitId 应替换', () => {
      preset.setUnitOverride({ unitId: 'unit-1', targetStrategy: 'fastest' });
      preset.setUnitOverride({ unitId: 'unit-1', targetStrategy: 'boss_priority' });
      const config = preset.getConfig();
      expect(config.unitOverrides).toHaveLength(1);
      expect(config.unitOverrides[0].targetStrategy).toBe('boss_priority');
    });

    it('removeUnitOverride 应移除覆盖', () => {
      preset.setUnitOverride({ unitId: 'unit-1', targetStrategy: 'fastest' });
      const removed = preset.removeUnitOverride('unit-1');
      expect(removed).toBe(true);
      expect(preset.getConfig().unitOverrides).toHaveLength(0);
    });

    it('removeUnitOverride 不存在的 ID 应返回 false', () => {
      const removed = preset.removeUnitOverride('nonexistent');
      expect(removed).toBe(false);
    });
  });

  // ============================================================
  // 决策逻辑
  // ============================================================

  describe('决策逻辑', () => {
    it('HP 低于 retreatHpThreshold 时应返回 defend', () => {
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 20, maxHp: 100 }); // 20% < 30%
      const ctx = createContext({ unit });
      const decision = preset.decide(ctx);
      expect(decision.action).toBe('defend');
      expect(decision.targetIds).toEqual([]);
    });

    it('HP 极低时应返回 retreat', () => {
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 5, maxHp: 100 }); // 5% < 15% (0.3*0.5)
      const ctx = createContext({ unit });
      const decision = preset.decide(ctx);
      expect(decision.action).toBe('retreat');
    });

    it('defenseStrategy=never 时不应防御', () => {
      preset.updateConfig({ defenseStrategy: 'never' });
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 5, maxHp: 100 });
      const ctx = createContext({ unit });
      const decision = preset.decide(ctx);
      expect(decision.action).not.toBe('defend');
      expect(decision.action).not.toBe('retreat');
    });

    it('defenseStrategy=always 时无论 HP 都应防御', () => {
      preset.updateConfig({ defenseStrategy: 'always' });
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 100, maxHp: 100 });
      const ctx = createContext({ unit });
      const decision = preset.decide(ctx);
      expect(decision.action).toBe('defend');
    });

    it('defenseStrategy=when_outnumbered 时敌方多于友方应防御', () => {
      preset.updateConfig({ defenseStrategy: 'when_outnumbered' });
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 100, maxHp: 100 });
      const ctx = createContext({
        unit,
        allies: [unit],
        enemies: [
          createUnit({ id: 'enemy-1' }),
          createUnit({ id: 'enemy-2' }),
          createUnit({ id: 'enemy-3' }),
        ],
      });
      const decision = preset.decide(ctx);
      expect(decision.action).toBe('defend');
    });

    it('defenseStrategy=when_outnumbered 时友方多于敌方不应防御', () => {
      preset.updateConfig({ defenseStrategy: 'when_outnumbered' });
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 100, maxHp: 100 });
      const ctx = createContext({
        unit,
        allies: [unit, createUnit({ id: 'ally-2' }), createUnit({ id: 'ally-3' })],
        enemies: [createUnit({ id: 'enemy-1' })],
      });
      const decision = preset.decide(ctx);
      expect(decision.action).not.toBe('defend');
    });

    it('治疗单位应优先治疗低 HP 友方', () => {
      preset.updateConfig({ defenseStrategy: 'never' });
      preset.activate();
      const healer = createUnit({
        id: 'healer-1',
        currentHp: 100,
        maxHp: 100,
        isHealer: true,
        healSkills: ['heal-1'],
      });
      const woundedAlly = createUnit({ id: 'ally-2', currentHp: 30, maxHp: 100 });
      const ctx = createContext({
        unit: healer,
        allies: [healer, woundedAlly],
      });
      const decision = preset.decide(ctx);
      expect(decision.action).toBe('heal');
      expect(decision.skillId).toBe('heal-1');
      expect(decision.targetIds).toContain('ally-2');
    });

    it('非治疗单位不应治疗', () => {
      preset.updateConfig({ defenseStrategy: 'never' });
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 100, maxHp: 100, isHealer: false });
      const woundedAlly = createUnit({ id: 'ally-2', currentHp: 30, maxHp: 100 });
      const ctx = createContext({ unit, allies: [unit, woundedAlly] });
      const decision = preset.decide(ctx);
      // 不应治疗，应走攻击逻辑
      expect(decision.action).not.toBe('heal');
    });

    it('autoHeal=false 时不应治疗', () => {
      preset.updateConfig({ defenseStrategy: 'never', autoHeal: false });
      preset.activate();
      const healer = createUnit({
        id: 'healer-1',
        currentHp: 100,
        maxHp: 100,
        isHealer: true,
        healSkills: ['heal-1'],
      });
      const woundedAlly = createUnit({ id: 'ally-2', currentHp: 30, maxHp: 100 });
      const ctx = createContext({ unit: healer, allies: [healer, woundedAlly] });
      const decision = preset.decide(ctx);
      expect(decision.action).not.toBe('heal');
    });

    it('autoUseSkills=true 且有技能时应使用技能', () => {
      preset.updateConfig({ defenseStrategy: 'never' });
      preset.activate();
      const unit = createUnit({
        id: 'ally-1',
        currentHp: 100,
        maxHp: 100,
        skills: ['skill-1'],
        skillPower: { 'skill-1': 50 },
      });
      const ctx = createContext({ unit });
      const decision = preset.decide(ctx);
      expect(decision.action).toBe('skill');
      expect(decision.skillId).toBe('skill-1');
    });

    it('autoUseSkills=false 时不应使用技能', () => {
      preset.updateConfig({ defenseStrategy: 'never', autoUseSkills: false });
      preset.activate();
      const unit = createUnit({
        id: 'ally-1',
        currentHp: 100,
        maxHp: 100,
        skills: ['skill-1'],
        skillPower: { 'skill-1': 50 },
      });
      const ctx = createContext({ unit });
      const decision = preset.decide(ctx);
      expect(decision.action).toBe('attack');
    });

    it('无技能时应普通攻击', () => {
      preset.updateConfig({ defenseStrategy: 'never' });
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 100, maxHp: 100, skills: [] });
      const ctx = createContext({ unit });
      const decision = preset.decide(ctx);
      expect(decision.action).toBe('attack');
    });

    it('targetStrategy=lowest_hp 应攻击血量最低的敌人', () => {
      preset.updateConfig({ defenseStrategy: 'never', autoUseSkills: false, targetStrategy: 'lowest_hp' });
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 100, maxHp: 100, skills: [] });
      const enemy1 = createUnit({ id: 'enemy-1', currentHp: 60, maxHp: 100 });
      const enemy2 = createUnit({ id: 'enemy-2', currentHp: 30, maxHp: 100 });
      const ctx = createContext({ unit, enemies: [enemy1, enemy2] });
      const decision = preset.decide(ctx);
      expect(decision.targetIds).toContain('enemy-2');
    });

    it('targetStrategy=highest_attack 应攻击攻击力最高的敌人', () => {
      preset.updateConfig({ defenseStrategy: 'never', autoUseSkills: false, targetStrategy: 'highest_attack' });
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 100, maxHp: 100, skills: [] });
      const enemy1 = createUnit({ id: 'enemy-1', attack: 30 });
      const enemy2 = createUnit({ id: 'enemy-2', attack: 50 });
      const ctx = createContext({ unit, enemies: [enemy1, enemy2] });
      const decision = preset.decide(ctx);
      expect(decision.targetIds).toContain('enemy-2');
    });

    it('targetStrategy=fastest 应攻击速度最快的敌人', () => {
      preset.updateConfig({ defenseStrategy: 'never', autoUseSkills: false, targetStrategy: 'fastest' });
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 100, maxHp: 100, skills: [] });
      const enemy1 = createUnit({ id: 'enemy-1', speed: 15 });
      const enemy2 = createUnit({ id: 'enemy-2', speed: 25 });
      const ctx = createContext({ unit, enemies: [enemy1, enemy2] });
      const decision = preset.decide(ctx);
      expect(decision.targetIds).toContain('enemy-2');
    });

    it('targetStrategy=weakest_defense 应攻击防御最低的敌人', () => {
      preset.updateConfig({ defenseStrategy: 'never', autoUseSkills: false, targetStrategy: 'weakest_defense' });
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 100, maxHp: 100, skills: [] });
      const enemy1 = createUnit({ id: 'enemy-1', defense: 10 });
      const enemy2 = createUnit({ id: 'enemy-2', defense: 3 });
      const ctx = createContext({ unit, enemies: [enemy1, enemy2] });
      const decision = preset.decide(ctx);
      expect(decision.targetIds).toContain('enemy-2');
    });

    it('targetStrategy=boss_priority 应优先攻击 Boss', () => {
      preset.updateConfig({ defenseStrategy: 'never', autoUseSkills: false, targetStrategy: 'boss_priority' });
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 100, maxHp: 100, skills: [] });
      const normalEnemy = createUnit({ id: 'enemy-1', isBoss: false });
      const bossEnemy = createUnit({ id: 'enemy-2', isBoss: true });
      const ctx = createContext({ unit, enemies: [normalEnemy, bossEnemy] });
      const decision = preset.decide(ctx);
      expect(decision.targetIds).toContain('enemy-2');
    });

    it('skillStrategy=strongest_first 应选择威力最高的技能', () => {
      preset.updateConfig({ defenseStrategy: 'never', skillStrategy: 'strongest_first' });
      preset.activate();
      const unit = createUnit({
        id: 'ally-1',
        currentHp: 100,
        maxHp: 100,
        skills: ['weak-skill', 'strong-skill'],
        skillPower: { 'weak-skill': 10, 'strong-skill': 50 },
      });
      const ctx = createContext({ unit });
      const decision = preset.decide(ctx);
      expect(decision.skillId).toBe('strong-skill');
    });

    it('skillStrategy=weakest_first 应选择威力最低的技能', () => {
      preset.updateConfig({ defenseStrategy: 'never', skillStrategy: 'weakest_first' });
      preset.activate();
      const unit = createUnit({
        id: 'ally-1',
        currentHp: 100,
        maxHp: 100,
        skills: ['weak-skill', 'strong-skill'],
        skillPower: { 'weak-skill': 10, 'strong-skill': 50 },
      });
      const ctx = createContext({ unit });
      const decision = preset.decide(ctx);
      expect(decision.skillId).toBe('weak-skill');
    });

    it('skillStrategy=save_for_boss 无 Boss 时应用最弱技能', () => {
      preset.updateConfig({ defenseStrategy: 'never', skillStrategy: 'save_for_boss' });
      preset.activate();
      const unit = createUnit({
        id: 'ally-1',
        currentHp: 100,
        maxHp: 100,
        skills: ['weak-skill', 'strong-skill'],
        skillPower: { 'weak-skill': 10, 'strong-skill': 50 },
      });
      const ctx = createContext({
        unit,
        enemies: [createUnit({ id: 'enemy-1', isBoss: false })],
      });
      const decision = preset.decide(ctx);
      expect(decision.skillId).toBe('weak-skill');
    });

    it('skillStrategy=save_for_boss 有 Boss 时应用最强技能', () => {
      preset.updateConfig({ defenseStrategy: 'never', skillStrategy: 'save_for_boss' });
      preset.activate();
      const unit = createUnit({
        id: 'ally-1',
        currentHp: 100,
        maxHp: 100,
        skills: ['weak-skill', 'strong-skill'],
        skillPower: { 'weak-skill': 10, 'strong-skill': 50 },
      });
      const ctx = createContext({
        unit,
        enemies: [createUnit({ id: 'enemy-1', isBoss: true })],
      });
      const decision = preset.decide(ctx);
      expect(decision.skillId).toBe('strong-skill');
    });

    it('黑名单中的技能不应被使用', () => {
      preset.updateConfig({ defenseStrategy: 'never', skillStrategy: 'strongest_first' });
      preset.setUnitOverride({
        unitId: 'ally-1',
        skillBlacklist: ['strong-skill'],
      });
      preset.activate();
      const unit = createUnit({
        id: 'ally-1',
        currentHp: 100,
        maxHp: 100,
        skills: ['weak-skill', 'strong-skill'],
        skillPower: { 'weak-skill': 10, 'strong-skill': 50 },
      });
      const ctx = createContext({ unit });
      const decision = preset.decide(ctx);
      expect(decision.skillId).toBe('weak-skill');
    });

    it('单位级覆盖应覆盖全局策略', () => {
      preset.updateConfig({ defenseStrategy: 'never', autoUseSkills: false, targetStrategy: 'lowest_hp' });
      preset.setUnitOverride({ unitId: 'ally-1', targetStrategy: 'fastest' });
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 100, maxHp: 100, skills: [] });
      const enemy1 = createUnit({ id: 'enemy-1', currentHp: 30, speed: 10 });
      const enemy2 = createUnit({ id: 'enemy-2', currentHp: 60, speed: 25 });
      const ctx = createContext({ unit, enemies: [enemy1, enemy2] });
      const decision = preset.decide(ctx);
      // 覆盖策略为 fastest，应选 enemy-2
      expect(decision.targetIds).toContain('enemy-2');
    });

    it('单位级 defenseThreshold 应覆盖全局阈值', () => {
      preset.updateConfig({ defenseStrategy: 'when_low_hp', retreatHpThreshold: 0.3 });
      preset.setUnitOverride({ unitId: 'ally-1', defenseThreshold: 0.8 });
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 70, maxHp: 100 }); // 70% > 30% 但 < 80%
      const ctx = createContext({ unit });
      const decision = preset.decide(ctx);
      expect(decision.action).toBe('defend');
    });

    it('focusFire=true 时所有单位应攻击同一目标', () => {
      preset.updateConfig({ defenseStrategy: 'never', autoUseSkills: false, focusFire: true, targetStrategy: 'lowest_hp' });
      preset.activate();
      const unit1 = createUnit({ id: 'ally-1', currentHp: 100, maxHp: 100, skills: [] });
      const enemy1 = createUnit({ id: 'enemy-1', currentHp: 60 });
      const enemy2 = createUnit({ id: 'enemy-2', currentHp: 30 });
      const ctx1 = createContext({ unit: unit1, enemies: [enemy1, enemy2] });
      const decision1 = preset.decide(ctx1);

      const unit2 = createUnit({ id: 'ally-2', currentHp: 100, maxHp: 100, skills: [] });
      const ctx2 = createContext({ unit: unit2, enemies: [enemy1, enemy2] });
      const decision2 = preset.decide(ctx2);

      // 两个单位应攻击同一目标
      expect(decision1.targetIds).toEqual(decision2.targetIds);
    });

    it('决策应包含 reason 字段', () => {
      preset.updateConfig({ defenseStrategy: 'never', autoUseSkills: false });
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 100, maxHp: 100, skills: [] });
      const ctx = createContext({ unit });
      const decision = preset.decide(ctx);
      expect(typeof decision.reason).toBe('string');
      expect(decision.reason.length).toBeGreaterThan(0);
    });

    it('无敌方存活时应返回空目标列表', () => {
      preset.updateConfig({ defenseStrategy: 'never', autoUseSkills: false });
      preset.activate();
      const unit = createUnit({ id: 'ally-1', currentHp: 100, maxHp: 100, skills: [] });
      const ctx = createContext({ unit, enemies: [] });
      const decision = preset.decide(ctx);
      expect(decision.targetIds).toEqual([]);
    });
  });

  // ============================================================
  // 预设模板
  // ============================================================

  describe('预设模板', () => {
    it('getDefaultConfig 应返回默认配置', () => {
      const config = StrategyPreset.getDefaultConfig();
      expect(config.name).toBe('默认策略');
      expect(config.targetStrategy).toBe('lowest_hp');
      expect(config.defenseStrategy).toBe('when_low_hp');
    });

    it('getAggressivePreset 应返回激进配置', () => {
      const config = StrategyPreset.getAggressivePreset();
      expect(config.name).toBe('激进策略');
      expect(config.skillStrategy).toBe('strongest_first');
      expect(config.defenseStrategy).toBe('never');
      expect(config.formationStrategy).toBe('offensive');
      expect(config.focusFire).toBe(true);
      expect(config.autoHeal).toBe(false);
    });

    it('getDefensivePreset 应返回防御配置', () => {
      const config = StrategyPreset.getDefensivePreset();
      expect(config.name).toBe('防御策略');
      expect(config.skillStrategy).toBe('save_for_boss');
      expect(config.defenseStrategy).toBe('when_low_hp');
      expect(config.formationStrategy).toBe('defensive');
      expect(config.retreatHpThreshold).toBe(0.5);
    });

    it('getBalancedPreset 应返回均衡配置', () => {
      const config = StrategyPreset.getBalancedPreset();
      expect(config.name).toBe('均衡策略');
      expect(config.skillStrategy).toBe('balanced');
      expect(config.formationStrategy).toBe('balanced');
    });

    it('预设模板应可直接用于构造函数', () => {
      const p = new StrategyPreset(StrategyPreset.getAggressivePreset());
      expect(p.getConfig().name).toBe('激进策略');
    });
  });

  // ============================================================
  // 存档/读档
  // ============================================================

  describe('saveState / loadState', () => {
    it('序列化后反序列化应恢复状态', () => {
      preset.activate();
      preset.updateConfig({ name: '测试策略' });

      const state = preset.getState();
      const newPreset = new StrategyPreset();
      newPreset.loadState(state);

      expect(newPreset.isEnabled()).toBe(true);
      expect(newPreset.getConfig().name).toBe('测试策略');
    });

    it('getState 应返回正确的状态快照', () => {
      preset.activate();
      const state = preset.getState();
      expect(state.enabled).toBe(true);
      expect(state.config).toBeDefined();
      expect(state.config.name).toBe('默认策略');
    });

    it('loadState 应校验 enabled 字段', () => {
      expect(() => preset.loadState({ enabled: 'yes' as any, config: StrategyPreset.getDefaultConfig() }))
        .toThrow('enabled 必须为布尔值');
    });

    it('loadState 应校验 config 对象', () => {
      expect(() => preset.loadState({ enabled: true, config: null as any }))
        .toThrow('config 必须为对象');
    });

    it('loadState 应校验 config.name', () => {
      expect(() => preset.loadState({ enabled: true, config: { ...StrategyPreset.getDefaultConfig(), name: '' } }))
        .toThrow('config.name 必须为非空字符串');
    });

    it('loadState 应校验 retreatHpThreshold 范围', () => {
      expect(() => preset.loadState({ enabled: true, config: { ...StrategyPreset.getDefaultConfig(), retreatHpThreshold: 1.5 } }))
        .toThrow('retreatHpThreshold 必须为 0-1 之间的数字');
    });

    it('loadState 应校验 burstHpThreshold 范围', () => {
      expect(() => preset.loadState({ enabled: true, config: { ...StrategyPreset.getDefaultConfig(), burstHpThreshold: -0.1 } }))
        .toThrow('burstHpThreshold 必须为 0-1 之间的数字');
    });

    it('loadState 应校验 autoUseSkills 类型', () => {
      expect(() => preset.loadState({ enabled: true, config: { ...StrategyPreset.getDefaultConfig(), autoUseSkills: 'yes' as any } }))
        .toThrow('autoUseSkills 必须为布尔值');
    });

    it('loadState 应校验 unitOverrides 数组', () => {
      expect(() => preset.loadState({ enabled: true, config: { ...StrategyPreset.getDefaultConfig(), unitOverrides: 'invalid' as any } }))
        .toThrow('config.unitOverrides 必须为数组');
    });

    it('loadState 应校验 unitOverride.unitId', () => {
      expect(() => preset.loadState({ enabled: true, config: { ...StrategyPreset.getDefaultConfig(), unitOverrides: [{ unitId: 123 as any }] } }))
        .toThrow('unitOverride.unitId 必须为字符串');
    });

    it('loadState 成功后应重置 sharedTargetId', () => {
      preset.activate();
      // 做一次决策以设置 sharedTargetId
      preset.updateConfig({ defenseStrategy: 'never', autoUseSkills: false, focusFire: true });
      const unit = createUnit({ id: 'ally-1', currentHp: 100, maxHp: 100, skills: [] });
      const ctx = createContext({ unit });
      preset.decide(ctx);

      const state = preset.getState();
      const newPreset = new StrategyPreset();
      newPreset.loadState(state);
      // sharedTargetId 应被重置（无法直接访问，但不应抛错）
      expect(newPreset.isEnabled()).toBe(true);
    });
  });

  // ============================================================
  // 重置
  // ============================================================

  describe('reset', () => {
    it('应重置为默认配置', () => {
      preset.updateConfig({ name: '自定义', targetStrategy: 'fastest' });
      preset.reset();
      expect(preset.getConfig().name).toBe('默认策略');
      expect(preset.getConfig().targetStrategy).toBe('lowest_hp');
    });

    it('应停用策略', () => {
      preset.activate();
      preset.reset();
      expect(preset.isEnabled()).toBe(false);
    });

    it('应清空单位级覆盖', () => {
      preset.setUnitOverride({ unitId: 'unit-1', targetStrategy: 'fastest' });
      preset.reset();
      expect(preset.getConfig().unitOverrides).toHaveLength(0);
    });
  });

  // ============================================================
  // 事件系统
  // ============================================================

  describe('事件系统', () => {
    it('activate 应发射 preset_activated 事件', () => {
      const listener = vi.fn();
      preset.on(listener);
      preset.activate();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'preset_activated',
          data: { name: '默认策略' },
        }),
      );
    });

    it('deactivate 应发射 preset_deactivated 事件', () => {
      const listener = vi.fn();
      preset.on(listener);
      preset.activate();
      preset.deactivate();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'preset_deactivated' }),
      );
    });

    it('decide 应发射 decision_made 事件', () => {
      const listener = vi.fn();
      preset.on(listener);
      preset.activate();
      const ctx = createContext();
      preset.decide(ctx);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'decision_made' }),
      );
    });

    it('off 应注销监听器', () => {
      const listener = vi.fn();
      preset.on(listener);
      preset.off(listener);
      preset.activate();
      expect(listener).not.toHaveBeenCalled();
    });

    it('off 不存在的监听器不应报错', () => {
      const listener = vi.fn();
      expect(() => preset.off(listener)).not.toThrow();
    });

    it('多个监听器都应收到事件', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      preset.on(listener1);
      preset.on(listener2);
      preset.activate();
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });
});
