/**
 * 集成测试：战斗模式与控制（§3.7 ~ §3.9）
 *
 * 覆盖 Play v3.0 攻城略地(上) 中的 3 个流程：
 *   §3.7  切换战斗模式：自动/手动/半自动模式切换
 *   §3.7a 手动模式操作流程：手动选择技能/目标
 *   §3.8  调整战斗速度：1x/2x/4x速度控制
 *   §3.9  大招时停机制（半自动）：大招释放时暂停
 *
 * 测试策略：引擎层API验证，使用 BattleEngine / BattleSpeedController / UltimateSkillSystem。
 */

import { BattleEngine } from '../../../battle/BattleEngine';
import { BattleSpeedController } from '../../../battle/BattleSpeedController';
import { UltimateSkillSystem } from '../../../battle/UltimateSkillSystem';
import {
  BattlePhase,
  BattleSpeed,
  BattleMode,
  TimeStopState,
  TroopType,
} from '../../../battle/battle.types';
import type {
  BattleUnit,
  BattleTeam,
  BattleSkill,
  BattleSpeedState,
  SpeedChangeEvent,
} from '../../../battle/battle.types';
import { BATTLE_CONFIG } from '../../../battle/battle-config';

// ─────────────────────────────────────────────
// Mock 数据工厂
// ─────────────────────────────────────────────

function createNormalAttack(): BattleSkill {
  return {
    id: 'normal_attack',
    name: '普攻',
    type: 'active',
    level: 1,
    description: '普通攻击',
    multiplier: 1.0,
    targetType: 'SINGLE_ENEMY' as any,
    rageCost: 0,
    cooldown: 0,
    currentCooldown: 0,
  };
}

function createActiveSkill(
  id = 'skill_fire',
  name = '烈焰斩',
  multiplier = 1.8,
  rageCost = 100,
  cooldown = 2,
): BattleSkill {
  return {
    id,
    name,
    type: 'active',
    level: 1,
    description: '强力技能',
    multiplier,
    targetType: 'ALL_ENEMY' as any,
    rageCost,
    cooldown,
    currentCooldown: 0,
  };
}

function createUnit(
  id: string,
  name: string,
  opts: Partial<{
    attack: number;
    defense: number;
    speed: number;
    maxHp: number;
    troopType: TroopType;
    side: 'ally' | 'enemy';
    rage: number;
    skills: BattleSkill[];
  }> = {},
): BattleUnit {
  const atk = opts.attack ?? 100;
  const def = opts.defense ?? 50;
  return {
    id,
    name,
    faction: 'shu',
    troopType: opts.troopType ?? TroopType.INFANTRY,
    position: 'front',
    side: opts.side ?? 'ally',
    attack: atk,
    baseAttack: atk,
    defense: def,
    baseDefense: def,
    intelligence: 60,
    speed: opts.speed ?? 50,
    hp: opts.maxHp ?? 1000,
    maxHp: opts.maxHp ?? 1000,
    isAlive: true,
    rage: opts.rage ?? 0,
    maxRage: BATTLE_CONFIG.MAX_RAGE,
    normalAttack: createNormalAttack(),
    skills: opts.skills ?? [createActiveSkill()],
    buffs: [],
  };
}

function createTeam(side: 'ally' | 'enemy', units: BattleUnit[]): BattleTeam {
  for (const u of units) {
    u.side = side;
  }
  return { units, side };
}

// ═══════════════════════════════════════════════
// §3.7 切换战斗模式
// ═══════════════════════════════════════════════

describe('§3.7 切换战斗模式', () => {
  let engine: BattleEngine;

  beforeEach(() => {
    engine = new BattleEngine();
  });

  it('默认模式为 AUTO（全自动）', () => {
    expect(engine.getBattleMode()).toBe(BattleMode.AUTO);
  });

  it('可切换到 SEMI_AUTO（半自动）模式', () => {
    engine.setBattleMode(BattleMode.SEMI_AUTO);
    expect(engine.getBattleMode()).toBe(BattleMode.SEMI_AUTO);
  });

  it('可切换到 MANUAL（手动）模式', () => {
    engine.setBattleMode(BattleMode.MANUAL);
    expect(engine.getBattleMode()).toBe(BattleMode.MANUAL);
  });

  it('模式可来回切换', () => {
    engine.setBattleMode(BattleMode.SEMI_AUTO);
    expect(engine.getBattleMode()).toBe(BattleMode.SEMI_AUTO);

    engine.setBattleMode(BattleMode.MANUAL);
    expect(engine.getBattleMode()).toBe(BattleMode.MANUAL);

    engine.setBattleMode(BattleMode.AUTO);
    expect(engine.getBattleMode()).toBe(BattleMode.AUTO);

    engine.setBattleMode(BattleMode.SEMI_AUTO);
    expect(engine.getBattleMode()).toBe(BattleMode.SEMI_AUTO);
  });

  it('半自动模式自动启用大招时停', () => {
    engine.setBattleMode(BattleMode.SEMI_AUTO);
    expect(engine.getUltimateSystem().isEnabled()).toBe(true);
  });

  it('自动/手动模式关闭大招时停', () => {
    // 先启用
    engine.setBattleMode(BattleMode.SEMI_AUTO);
    expect(engine.getUltimateSystem().isEnabled()).toBe(true);

    // 切到AUTO
    engine.setBattleMode(BattleMode.AUTO);
    expect(engine.getUltimateSystem().isEnabled()).toBe(false);

    // 切到MANUAL
    engine.setBattleMode(BattleMode.MANUAL);
    expect(engine.getUltimateSystem().isEnabled()).toBe(false);
  });

  it('模式切换不影响战斗进行中的数据', () => {
    const allyTeam = createTeam('ally', [
      createUnit('ally1', '刘备', { attack: 200, speed: 60 }),
    ]);
    const enemyTeam = createTeam('enemy', [
      createUnit('enemy1', '黄巾贼', { attack: 50, maxHp: 500, speed: 30 }),
    ]);

    const state = engine.initBattle(allyTeam, enemyTeam);

    // 战斗中切换模式
    engine.setBattleMode(BattleMode.SEMI_AUTO);
    engine.executeTurn(state);

    // 战斗状态仍然正常
    expect(state.phase).toBe(BattlePhase.IN_PROGRESS);
    expect(state.actionLog.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// §3.7a 手动模式操作流程
// ═══════════════════════════════════════════════

describe('§3.7a 手动模式操作流程', () => {
  it('手动模式下大招时停系统不启用', () => {
    const engine = new BattleEngine();
    engine.setBattleMode(BattleMode.MANUAL);

    const ultimateSystem = engine.getUltimateSystem();
    expect(ultimateSystem.isEnabled()).toBe(false);
  });

  it('手动模式下怒气满的单位不触发自动时停', () => {
    const engine = new BattleEngine();
    engine.setBattleMode(BattleMode.MANUAL);

    const unit = createUnit('hero1', '赵云', { rage: 100 });
    unit.skills = [createActiveSkill('ult_1', '龙胆', 2.5, 100, 0)];

    const result = engine.getUltimateSystem().checkUltimateReady(unit);
    // 时停未启用，不应检测为就绪
    expect(result.isReady).toBe(false);
  });

  it('手动模式切到半自动后可检测大招就绪', () => {
    const engine = new BattleEngine();
    engine.setBattleMode(BattleMode.MANUAL);

    // 切到半自动
    engine.setBattleMode(BattleMode.SEMI_AUTO);

    const unit = createUnit('hero1', '赵云', { rage: 100 });
    unit.skills = [createActiveSkill('ult_1', '龙胆', 2.5, 100, 0)];

    const result = engine.getUltimateSystem().checkUltimateReady(unit);
    expect(result.isReady).toBe(true);
    expect(result.readyUnits).toHaveLength(1);
    expect(result.readyUnits[0].skills).toHaveLength(1);
  });

  it('手动模式下引擎仍可正常执行战斗', () => {
    const engine = new BattleEngine();
    engine.setBattleMode(BattleMode.MANUAL);

    const allyTeam = createTeam('ally', [
      createUnit('ally1', '吕布', { attack: 300, speed: 80, maxHp: 2000 }),
    ]);
    const enemyTeam = createTeam('enemy', [
      createUnit('enemy1', '小兵', { attack: 10, maxHp: 100, speed: 10 }),
    ]);

    const result = engine.runFullBattle(allyTeam, enemyTeam);
    expect(result.outcome).toBeDefined();
  });
});

// ═══════════════════════════════════════════════
// §3.8 调整战斗速度
// ═══════════════════════════════════════════════

describe('§3.8 调整战斗速度', () => {
  let controller: BattleSpeedController;

  beforeEach(() => {
    controller = new BattleSpeedController();
  });

  it('初始速度为 X1', () => {
    expect(controller.getSpeed()).toBe(BattleSpeed.X1);
  });

  it('可设置 X1 速度', () => {
    controller.setSpeed(BattleSpeed.X4); // 先切换到其他速度
    controller.setSpeed(BattleSpeed.X1);
    expect(controller.getSpeed()).toBe(BattleSpeed.X1);
  });

  it('可设置 X2 速度', () => {
    controller.setSpeed(BattleSpeed.X2);
    expect(controller.getSpeed()).toBe(BattleSpeed.X2);
  });

  it('可设置 X3 速度', () => {
    controller.setSpeed(BattleSpeed.X3);
    expect(controller.getSpeed()).toBe(BattleSpeed.X3);
  });

  it('X1 速度：回合间隔为基准值', () => {
    controller.setSpeed(BattleSpeed.X1);
    expect(controller.getAdjustedTurnInterval()).toBe(BATTLE_CONFIG.BASE_TURN_INTERVAL_MS);
  });

  it('X2 速度：回合间隔减半', () => {
    controller.setSpeed(BattleSpeed.X2);
    expect(controller.getAdjustedTurnInterval()).toBe(
      Math.floor(BATTLE_CONFIG.BASE_TURN_INTERVAL_MS / 2),
    );
  });

  it('X3 速度：回合间隔为1/3', () => {
    controller.setSpeed(BattleSpeed.X3);
    expect(controller.getAdjustedTurnInterval()).toBe(
      Math.floor(BATTLE_CONFIG.BASE_TURN_INTERVAL_MS / 3),
    );
  });

  it('X1 动画缩放系数为 1.0', () => {
    controller.setSpeed(BattleSpeed.X1);
    expect(controller.getAnimationSpeedScale()).toBe(1.0);
  });

  it('X2 动画缩放系数为 2.0', () => {
    controller.setSpeed(BattleSpeed.X2);
    expect(controller.getAnimationSpeedScale()).toBe(2.0);
  });

  it('X3 动画缩放系数为 3.0', () => {
    controller.setSpeed(BattleSpeed.X3);
    expect(controller.getAnimationSpeedScale()).toBe(3.0);
  });

  it('X3 速度不需要简化特效', () => {
    controller.setSpeed(BattleSpeed.X3);
    expect(controller.shouldSimplifyEffects()).toBe(false);
  });

  it('X1/X2 速度不需要简化特效', () => {
    controller.setSpeed(BattleSpeed.X1);
    expect(controller.shouldSimplifyEffects()).toBe(false);

    controller.setSpeed(BattleSpeed.X2);
    expect(controller.shouldSimplifyEffects()).toBe(false);
  });

  it('相同速度切换返回 false', () => {
    controller.setSpeed(BattleSpeed.X1);
    const result = controller.setSpeed(BattleSpeed.X1);
    expect(result).toBe(false);
  });

  it('不同速度切换返回 true', () => {
    const result = controller.setSpeed(BattleSpeed.X2);
    expect(result).toBe(true);
  });

  it('cycleSpeed 循环：X1 → X2 → X3 → X1', () => {
    expect(controller.getSpeed()).toBe(BattleSpeed.X1);

    controller.cycleSpeed();
    expect(controller.getSpeed()).toBe(BattleSpeed.X2);

    controller.cycleSpeed();
    expect(controller.getSpeed()).toBe(BattleSpeed.X3);

    controller.cycleSpeed();
    expect(controller.getSpeed()).toBe(BattleSpeed.X1);
  });

  it('速度变更通知监听器', () => {
    const listener = {
      onSpeedChange: vi.fn(),
    };

    controller.addListener(listener);
    controller.setSpeed(BattleSpeed.X2);

    expect(listener.onSpeedChange).toHaveBeenCalledTimes(1);
    const event = listener.onSpeedChange.mock.calls[0][0] as SpeedChangeEvent;
    expect(event.previousSpeed).toBe(BattleSpeed.X1);
    expect(event.newSpeed).toBe(BattleSpeed.X2);
  });

  it('移除监听器后不再收到通知', () => {
    const listener = {
      onSpeedChange: vi.fn(),
    };

    controller.addListener(listener);
    controller.removeListener(listener);
    controller.setSpeed(BattleSpeed.X2);

    expect(listener.onSpeedChange).not.toHaveBeenCalled();
  });

  it('速度变更记录在历史中', () => {
    controller.setSpeed(BattleSpeed.X2);
    controller.setSpeed(BattleSpeed.X3);

    const history = controller.getChangeHistory();
    expect(history).toHaveLength(2);
    expect(history[0].previousSpeed).toBe(BattleSpeed.X1);
    expect(history[0].newSpeed).toBe(BattleSpeed.X2);
    expect(history[1].previousSpeed).toBe(BattleSpeed.X2);
    expect(history[1].newSpeed).toBe(BattleSpeed.X3);
  });

  it('reset 恢复默认速度并清空历史', () => {
    controller.setSpeed(BattleSpeed.X3);
    controller.reset();

    expect(controller.getSpeed()).toBe(BattleSpeed.X1);
    expect(controller.getChangeHistory()).toHaveLength(0);
  });

  it('SKIP 模式回合间隔为 0', () => {
    controller.setSpeed(BattleSpeed.SKIP);
    expect(controller.getAdjustedTurnInterval()).toBe(0);
  });

  it('通过 BattleEngine 设置速度', () => {
    const engine = new BattleEngine();
    engine.setSpeed(BattleSpeed.X2);

    const speedState = engine.getSpeedState();
    expect(speedState.speed).toBe(BattleSpeed.X2);
  });

  it('通过 BattleEngine 获取调整后的回合间隔', () => {
    const engine = new BattleEngine();
    engine.setSpeed(BattleSpeed.X2);

    expect(engine.getAdjustedTurnInterval()).toBe(
      Math.floor(BATTLE_CONFIG.BASE_TURN_INTERVAL_MS / 2),
    );
  });
});

// ═══════════════════════════════════════════════
// §3.9 大招时停机制（半自动）
// ═══════════════════════════════════════════════

describe('§3.9 大招时停机制（半自动）', () => {
  let ultimateSystem: UltimateSkillSystem;

  beforeEach(() => {
    ultimateSystem = new UltimateSkillSystem();
    ultimateSystem.setEnabled(true);
  });

  it('怒气未满时检测不到大招就绪', () => {
    const unit = createUnit('hero1', '赵云', { rage: 50 });
    unit.skills = [createActiveSkill('ult_1', '龙胆', 2.5, 100, 0)];

    const result = ultimateSystem.checkUltimateReady(unit);
    expect(result.isReady).toBe(false);
    expect(result.readyUnits).toHaveLength(0);
  });

  it('怒气满且有主动技能时检测到大招就绪', () => {
    const unit = createUnit('hero1', '赵云', { rage: 100 });
    unit.skills = [createActiveSkill('ult_1', '龙胆', 2.5, 100, 0)];

    const result = ultimateSystem.checkUltimateReady(unit);
    expect(result.isReady).toBe(true);
    expect(result.readyUnits).toHaveLength(1);
    expect(result.readyUnits[0].unit.id).toBe('hero1');
    expect(result.readyUnits[0].skills).toHaveLength(1);
    expect(result.readyUnits[0].skills[0].id).toBe('ult_1');
  });

  it('怒气满但技能在CD中不触发', () => {
    const unit = createUnit('hero1', '赵云', { rage: 100 });
    const skill = createActiveSkill('ult_1', '龙胆', 2.5, 100, 2);
    skill.currentCooldown = 2; // CD中
    unit.skills = [skill];

    const result = ultimateSystem.checkUltimateReady(unit);
    expect(result.isReady).toBe(false);
  });

  it('被动技能不计入大招就绪', () => {
    const unit = createUnit('hero1', '赵云', { rage: 100 });
    unit.skills = [{
      id: 'passive_1',
      name: '铁壁',
      type: 'passive',
      level: 1,
      description: '增加防御',
      multiplier: 0,
      targetType: 'SELF' as any,
      rageCost: 0,
      cooldown: 0,
      currentCooldown: 0,
    }];

    const result = ultimateSystem.checkUltimateReady(unit);
    expect(result.isReady).toBe(false);
  });

  it('pauseForUltimate 触发时停暂停', () => {
    const handler = {
      onUltimateReady: vi.fn(),
      onBattlePaused: vi.fn(),
      onUltimateConfirmed: vi.fn(),
      onUltimateCancelled: vi.fn(),
    };
    ultimateSystem.registerHandler(handler);

    const unit = createUnit('hero1', '赵云', { rage: 100 });
    const skill = createActiveSkill('ult_1', '龙胆', 2.5, 100, 0);

    ultimateSystem.pauseForUltimate(unit, skill);

    // 应触发 onUltimateReady 和 onBattlePaused
    expect(handler.onUltimateReady).toHaveBeenCalledTimes(1);
    expect(handler.onBattlePaused).toHaveBeenCalledTimes(1);

    // 状态应为 PAUSED
    expect(ultimateSystem.getTimeStopState()).toBe(TimeStopState.PAUSED);
  });

  it('confirmUltimate 恢复战斗并触发确认回调', () => {
    const handler = {
      onUltimateReady: vi.fn(),
      onBattlePaused: vi.fn(),
      onUltimateConfirmed: vi.fn(),
      onUltimateCancelled: vi.fn(),
    };
    ultimateSystem.registerHandler(handler);

    const unit = createUnit('hero1', '赵云', { rage: 100 });
    const skill = createActiveSkill('ult_1', '龙胆', 2.5, 100, 0);

    ultimateSystem.pauseForUltimate(unit, skill);
    const confirmed = ultimateSystem.confirmUltimate(unit.id, skill.id);

    expect(confirmed).toBe(true);
    expect(handler.onUltimateConfirmed).toHaveBeenCalledTimes(1);
    // 确认后状态重置为 INACTIVE
    expect(ultimateSystem.getTimeStopState()).toBe(TimeStopState.INACTIVE);
  });

  it('cancelUltimate 取消大招释放', () => {
    const handler = {
      onUltimateReady: vi.fn(),
      onBattlePaused: vi.fn(),
      onUltimateConfirmed: vi.fn(),
      onUltimateCancelled: vi.fn(),
    };
    ultimateSystem.registerHandler(handler);

    const unit = createUnit('hero1', '赵云', { rage: 100 });
    const skill = createActiveSkill('ult_1', '龙胆', 2.5, 100, 0);

    ultimateSystem.pauseForUltimate(unit, skill);
    ultimateSystem.cancelUltimate();

    expect(handler.onUltimateCancelled).toHaveBeenCalledTimes(1);
    expect(ultimateSystem.getTimeStopState()).toBe(TimeStopState.INACTIVE);
  });

  it('未暂停时 confirmUltimate 返回 false', () => {
    const unit = createUnit('hero1', '赵云', { rage: 100 });
    const skill = createActiveSkill('ult_1', '龙胆', 2.5, 100, 0);

    const result = ultimateSystem.confirmUltimate(unit.id, skill.id);
    expect(result).toBe(false);
  });

  it('单位ID或技能ID不匹配时 confirmUltimate 返回 false', () => {
    const handler = {
      onUltimateReady: vi.fn(),
      onBattlePaused: vi.fn(),
      onUltimateConfirmed: vi.fn(),
      onUltimateCancelled: vi.fn(),
    };
    ultimateSystem.registerHandler(handler);

    const unit = createUnit('hero1', '赵云', { rage: 100 });
    const skill = createActiveSkill('ult_1', '龙胆', 2.5, 100, 0);

    ultimateSystem.pauseForUltimate(unit, skill);

    // 错误的 unitId
    expect(ultimateSystem.confirmUltimate('wrong_id', skill.id)).toBe(false);
    // 错误的 skillId
    expect(ultimateSystem.confirmUltimate(unit.id, 'wrong_skill')).toBe(false);
  });

  it('禁用时停后 checkUltimateReady 始终返回 false', () => {
    ultimateSystem.setEnabled(false);

    const unit = createUnit('hero1', '赵云', { rage: 100 });
    unit.skills = [createActiveSkill('ult_1', '龙胆', 2.5, 100, 0)];

    const result = ultimateSystem.checkUltimateReady(unit);
    expect(result.isReady).toBe(false);
  });

  it('批量检测队伍大招就绪状态', () => {
    const units = [
      createUnit('hero1', '赵云', { rage: 100 }),
      createUnit('hero2', '关羽', { rage: 50 }),
      createUnit('hero3', '张飞', { rage: 100 }),
    ];
    units[0].skills = [createActiveSkill('ult_1', '龙胆', 2.5, 100, 0)];
    units[1].skills = [createActiveSkill('ult_2', '青龙', 2.0, 100, 0)];
    units[2].skills = [createActiveSkill('ult_3', '咆哮', 2.2, 100, 0)];

    const result = ultimateSystem.checkTeamUltimateReady(units);
    expect(result.isReady).toBe(true);
    expect(result.readyUnits).toHaveLength(2); // 赵云和张飞怒气满
  });

  it('通过 BattleEngine 完整流程：半自动模式大招时停', () => {
    const engine = new BattleEngine();
    engine.setBattleMode(BattleMode.SEMI_AUTO);

    const handler = {
      onUltimateReady: vi.fn(),
      onBattlePaused: vi.fn(),
      onUltimateConfirmed: vi.fn(),
      onUltimateCancelled: vi.fn(),
    };
    engine.registerTimeStopHandler(handler);

    // 验证时停系统已启用
    expect(engine.getUltimateSystem().isEnabled()).toBe(true);
    expect(engine.isTimeStopPaused()).toBe(false);
  });
});
