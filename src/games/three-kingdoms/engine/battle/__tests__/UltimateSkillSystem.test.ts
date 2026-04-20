/**
 * 大招时停系统 — 单元测试
 *
 * 覆盖：就绪检测、时停状态、确认/取消、超时、启用/禁用、序列化
 * @module engine/battle/__tests__/UltimateSkillSystem.test
 */

import { UltimateSkillSystem } from '../UltimateSkillSystem';
import type {
  BattleUnit, BattleSkill, IUltimateTimeStopHandler, UltimateTimeStopEvent,
} from '../battle.types';
import { TimeStopState, TroopType, BATTLE_CONFIG } from '../battle.types';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

const NORMAL_ATTACK: BattleSkill = {
  id: 'normal', name: '普攻', type: 'active', level: 1,
  description: '普通攻击', multiplier: 1.0, targetType: 'SINGLE_ENEMY',
  rageCost: 0, cooldown: 0, currentCooldown: 0,
};

const ULTIMATE_SKILL: BattleSkill = {
  id: 'ultimate_fire', name: '烈焰斩', type: 'active', level: 1,
  description: '强力火属性大招', multiplier: 2.5, targetType: 'ALL_ENEMY',
  rageCost: 100, cooldown: 3, currentCooldown: 0,
};

const ULTIMATE_SKILL_2: BattleSkill = {
  id: 'ultimate_ice', name: '冰封万里', type: 'active', level: 1,
  description: '强力冰属性大招', multiplier: 3.0, targetType: 'ALL_ENEMY',
  rageCost: 100, cooldown: 2, currentCooldown: 0,
};

const PASSIVE_SKILL: BattleSkill = {
  id: 'passive_def', name: '铁壁', type: 'passive', level: 1,
  description: '被动防御', multiplier: 0, targetType: 'SELF',
  rageCost: 0, cooldown: 0, currentCooldown: 0,
};

function createUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: `unit_${Math.random().toString(36).slice(2, 6)}`, name: '测试武将',
    faction: 'shu', troopType: TroopType.CAVALRY, position: 'front', side: 'ally',
    attack: 100, baseAttack: 100, defense: 50, baseDefense: 50,
    intelligence: 60, speed: 80, hp: 1000, maxHp: 1000, isAlive: true,
    rage: 0, maxRage: 100, normalAttack: { ...NORMAL_ATTACK },
    skills: [{ ...ULTIMATE_SKILL }], buffs: [], ...overrides,
  };
}

function createMockHandler() {
  return {
    onUltimateReady: jest.fn(), onBattlePaused: jest.fn(),
    onUltimateConfirmed: jest.fn(), onUltimateCancelled: jest.fn(),
  } as IUltimateTimeStopHandler;
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('UltimateSkillSystem', () => {
  let system: UltimateSkillSystem;

  beforeEach(() => {
    jest.useFakeTimers();
    system = new UltimateSkillSystem();
  });

  afterEach(() => {
    system.reset();
    jest.useRealTimers();
  });

  // ── 初始状态 ──

  describe('初始状态', () => {
    it('初始状态应为 INACTIVE', () => expect(system.getState()).toBe(TimeStopState.INACTIVE));
    it('默认启用时停', () => expect(system.isEnabled()).toBe(true));
    it('初始无等待单位', () => {
      expect(system.getPendingUnitId()).toBeNull();
      expect(system.getPendingSkillId()).toBeNull();
    });
    it('初始不处于暂停状态', () => expect(system.isPaused()).toBe(false));
  });

  // ── 大招就绪检测 ──

  describe('checkUltimateReady', () => {
    it('怒气满时应检测到大招就绪', () => {
      const unit = createUnit({ rage: 100 });
      const result = system.checkUltimateReady(unit);
      expect(result.isReady).toBe(true);
      expect(result.readyUnits).toHaveLength(1);
      expect(result.readyUnits[0].skills[0].id).toBe('ultimate_fire');
    });

    it('怒气超过阈值时应检测到', () => {
      const result = system.checkUltimateReady(createUnit({ rage: 150, maxRage: 200 }));
      expect(result.isReady).toBe(true);
    });

    it('怒气不足时不应检测到', () => {
      expect(system.checkUltimateReady(createUnit({ rage: 50 })).isReady).toBe(false);
    });

    it('技能在冷却中时不应检测到', () => {
      const unit = createUnit({ rage: 100 });
      unit.skills[0].currentCooldown = 2;
      expect(system.checkUltimateReady(unit).isReady).toBe(false);
    });

    it('被动技能不应被视为大招', () => {
      const unit = createUnit({ rage: 100, skills: [{ ...PASSIVE_SKILL }] });
      expect(system.checkUltimateReady(unit).isReady).toBe(false);
    });

    it('多个可用大招时应全部返回', () => {
      const unit = createUnit({ rage: 100, skills: [{ ...ULTIMATE_SKILL }, { ...ULTIMATE_SKILL_2 }] });
      const result = system.checkUltimateReady(unit);
      expect(result.readyUnits[0].skills).toHaveLength(2);
    });

    it('禁用时不应检测', () => {
      system.setEnabled(false);
      expect(system.checkUltimateReady(createUnit({ rage: 100 })).isReady).toBe(false);
    });

    it('怒气刚好等于阈值时应该检测到', () => {
      const result = system.checkUltimateReady(
        createUnit({ rage: BATTLE_CONFIG.ULTIMATE_RAGE_THRESHOLD }),
      );
      expect(result.isReady).toBe(true);
    });
  });

  // ── 队伍批量检测 ──

  describe('checkTeamUltimateReady', () => {
    it('应检测队伍中所有怒气满的单位', () => {
      const units = [
        createUnit({ id: 'u1', rage: 100 }),
        createUnit({ id: 'u2', rage: 50 }),
        createUnit({ id: 'u3', rage: 100 }),
      ];
      const result = system.checkTeamUltimateReady(units);
      expect(result.readyUnits).toHaveLength(2);
    });

    it('死亡单位不应被检测', () => {
      const units = [createUnit({ id: 'u1', rage: 100, isAlive: false }), createUnit({ id: 'u2', rage: 50 })];
      expect(system.checkTeamUltimateReady(units).isReady).toBe(false);
    });

    it('空队伍应返回未就绪', () => {
      expect(system.checkTeamUltimateReady([]).isReady).toBe(false);
    });
  });

  // ── 时停流程 ──

  describe('pauseForUltimate', () => {
    it('应触发时停并通知处理器', () => {
      const handler = createMockHandler();
      system.registerHandler(handler);
      const unit = createUnit({ rage: 100 });
      const skill = unit.skills[0];

      system.pauseForUltimate(unit, skill);

      expect(handler.onUltimateReady).toHaveBeenCalledTimes(1);
      const readyEvent = handler.onUltimateReady.mock.calls[0][0] as UltimateTimeStopEvent;
      expect(readyEvent.type).toBe('ultimate_ready');
      expect(readyEvent.unitId).toBe(unit.id);
      expect(readyEvent.skill.id).toBe(skill.id);

      expect(handler.onBattlePaused).toHaveBeenCalledTimes(1);
      expect(system.isPaused()).toBe(true);
      expect(system.getState()).toBe(TimeStopState.PAUSED);
    });

    it('应记录等待的单位ID和技能ID', () => {
      const unit = createUnit({ id: 'hero_zhaoyun', rage: 100 });
      system.pauseForUltimate(unit, unit.skills[0]);
      expect(system.getPendingUnitId()).toBe('hero_zhaoyun');
      expect(system.getPendingSkillId()).toBe('ultimate_fire');
    });

    it('禁用时应忽略暂停请求', () => {
      system.setEnabled(false);
      system.pauseForUltimate(createUnit({ rage: 100 }), ULTIMATE_SKILL);
      expect(system.isPaused()).toBe(false);
    });

    it('无处理器时不应报错', () => {
      expect(() => system.pauseForUltimate(createUnit({ rage: 100 }), ULTIMATE_SKILL)).not.toThrow();
      expect(system.isPaused()).toBe(true);
    });
  });

  // ── 玩家确认 ──

  describe('confirmUltimate', () => {
    it('确认正确的单位和技能应成功', () => {
      const handler = createMockHandler();
      system.registerHandler(handler);
      const unit = createUnit({ id: 'hero1', rage: 100 });
      system.pauseForUltimate(unit, unit.skills[0]);

      const result = system.confirmUltimate('hero1', 'ultimate_fire');
      expect(result).toBe(true);
      expect(handler.onUltimateConfirmed).toHaveBeenCalledTimes(1);
      expect(system.getState()).toBe(TimeStopState.INACTIVE);
    });

    it('确认错误的单位ID应失败', () => {
      system.pauseForUltimate(createUnit({ id: 'hero1', rage: 100 }), ULTIMATE_SKILL);
      expect(system.confirmUltimate('hero2', 'ultimate_fire')).toBe(false);
      expect(system.isPaused()).toBe(true);
    });

    it('确认错误的技能ID应失败', () => {
      system.pauseForUltimate(createUnit({ id: 'hero1', rage: 100 }), ULTIMATE_SKILL);
      expect(system.confirmUltimate('hero1', 'wrong_skill')).toBe(false);
    });

    it('未暂停时确认应失败', () => {
      expect(system.confirmUltimate('hero1', 'ultimate_fire')).toBe(false);
    });
  });

  describe('confirmUltimateWithInfo', () => {
    it('带完整信息确认应成功并通知处理器', () => {
      const handler = createMockHandler();
      system.registerHandler(handler);
      const unit = createUnit({ id: 'hero1', rage: 100 });
      const skill = unit.skills[0];
      system.pauseForUltimate(unit, skill);

      const result = system.confirmUltimateWithInfo(unit, skill);
      expect(result).toBe(true);
      const event = handler.onUltimateConfirmed.mock.calls[0][0] as UltimateTimeStopEvent;
      expect(event.type).toBe('ultimate_confirmed');
      expect(event.unitId).toBe('hero1');
      expect(event.unitName).toBe('测试武将');
    });
  });

  // ── 玩家取消 ──

  describe('cancelUltimate', () => {
    it('取消时应通知处理器并重置状态', () => {
      const handler = createMockHandler();
      system.registerHandler(handler);
      system.pauseForUltimate(createUnit({ rage: 100 }), ULTIMATE_SKILL);

      system.cancelUltimate();
      expect(handler.onUltimateCancelled).toHaveBeenCalledTimes(1);
      expect(system.getState()).toBe(TimeStopState.INACTIVE);
      expect(system.getPendingUnitId()).toBeNull();
    });

    it('未暂停时取消不应报错', () => {
      expect(() => system.cancelUltimate()).not.toThrow();
    });
  });

  // ── 超时自动确认 ──

  describe('超时自动确认', () => {
    it('超时后应自动确认释放大招', () => {
      const handler = createMockHandler();
      system.registerHandler(handler);
      const unit = createUnit({ id: 'hero1', rage: 100 });
      system.pauseForUltimate(unit, unit.skills[0]);

      jest.advanceTimersByTime(BATTLE_CONFIG.TIME_STOP_TIMEOUT_MS - 1);
      expect(system.isPaused()).toBe(true);

      jest.advanceTimersByTime(1);
      expect(handler.onUltimateConfirmed).toHaveBeenCalledTimes(1);
      expect(system.getState()).toBe(TimeStopState.INACTIVE);
    });

    it('确认后应清除超时定时器', () => {
      const handler = createMockHandler();
      system.registerHandler(handler);
      const unit = createUnit({ id: 'hero1', rage: 100 });
      system.pauseForUltimate(unit, unit.skills[0]);
      system.confirmUltimate('hero1', 'ultimate_fire');

      jest.advanceTimersByTime(BATTLE_CONFIG.TIME_STOP_TIMEOUT_MS + 1000);
      expect(handler.onUltimateConfirmed).toHaveBeenCalledTimes(1);
    });

    it('取消后应清除超时定时器', () => {
      const handler = createMockHandler();
      system.registerHandler(handler);
      system.pauseForUltimate(createUnit({ id: 'hero1', rage: 100 }), ULTIMATE_SKILL);
      system.cancelUltimate();

      jest.advanceTimersByTime(BATTLE_CONFIG.TIME_STOP_TIMEOUT_MS + 1000);
      expect(handler.onUltimateConfirmed).not.toHaveBeenCalled();
    });
  });

  // ── 启用/禁用 ──

  describe('启用/禁用', () => {
    it('禁用时应重置状态', () => {
      system.pauseForUltimate(createUnit({ rage: 100 }), ULTIMATE_SKILL);
      expect(system.isPaused()).toBe(true);

      system.setEnabled(false);
      expect(system.getState()).toBe(TimeStopState.INACTIVE);
      expect(system.getPendingUnitId()).toBeNull();
    });

    it('重新启用后应能正常工作', () => {
      system.setEnabled(false);
      system.setEnabled(true);
      expect(system.checkUltimateReady(createUnit({ rage: 100 })).isReady).toBe(true);
    });
  });

  // ── 事件处理器管理 ──

  describe('事件处理器管理', () => {
    it('注册处理器后应能接收事件', () => {
      const handler = createMockHandler();
      system.registerHandler(handler);
      system.pauseForUltimate(createUnit({ rage: 100 }), ULTIMATE_SKILL);
      expect(handler.onUltimateReady).toHaveBeenCalled();
    });

    it('移除处理器后不应再接收事件', () => {
      const handler = createMockHandler();
      system.registerHandler(handler);
      system.removeHandler();
      system.pauseForUltimate(createUnit({ rage: 100 }), ULTIMATE_SKILL);
      expect(handler.onUltimateReady).not.toHaveBeenCalled();
    });

    it('替换处理器应使用最新的', () => {
      const handler1 = createMockHandler();
      const handler2 = createMockHandler();
      system.registerHandler(handler1);
      system.registerHandler(handler2);
      system.pauseForUltimate(createUnit({ rage: 100 }), ULTIMATE_SKILL);
      expect(handler1.onUltimateReady).not.toHaveBeenCalled();
      expect(handler2.onUltimateReady).toHaveBeenCalled();
    });
  });

  // ── 序列化/反序列化 ──

  describe('序列化/反序列化', () => {
    it('应正确序列化初始状态', () => {
      const s = system.serialize();
      expect(s.state).toBe(TimeStopState.INACTIVE);
      expect(s.enabled).toBe(true);
      expect(s.pendingUnitId).toBeNull();
    });

    it('应正确序列化暂停状态', () => {
      system.pauseForUltimate(createUnit({ id: 'hero1', rage: 100 }), ULTIMATE_SKILL);
      const s = system.serialize();
      expect(s.state).toBe(TimeStopState.PAUSED);
      expect(s.pendingUnitId).toBe('hero1');
      expect(s.pendingSkillId).toBe('ultimate_fire');
    });

    it('应正确反序列化状态', () => {
      system.deserialize({
        state: TimeStopState.PAUSED, enabled: true,
        pendingUnitId: 'hero1', pendingSkillId: 'skill1',
      });
      expect(system.getState()).toBe(TimeStopState.PAUSED);
      expect(system.getPendingUnitId()).toBe('hero1');
    });

    it('反序列化禁用状态', () => {
      system.deserialize({ state: TimeStopState.INACTIVE, enabled: false, pendingUnitId: null, pendingSkillId: null });
      expect(system.isEnabled()).toBe(false);
    });
  });

  // ── 重置 ──

  describe('reset', () => {
    it('应完全重置所有状态', () => {
      system.pauseForUltimate(createUnit({ id: 'hero1', rage: 100 }), ULTIMATE_SKILL);
      system.reset();
      expect(system.getState()).toBe(TimeStopState.INACTIVE);
      expect(system.getPendingUnitId()).toBeNull();
      expect(system.isPaused()).toBe(false);
    });
  });
});
