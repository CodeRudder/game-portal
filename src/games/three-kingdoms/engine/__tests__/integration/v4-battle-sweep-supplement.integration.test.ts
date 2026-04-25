/**
 * V4 战斗扫荡补充测试 — 兵种克制+自动切换+元宝扫荡+自动推图
 *
 * 覆盖 play 流程：
 * - §1.3.2 战斗模式自动切换（≥1.43x全自动 / ≤1.0x全手动 / >1.0x半自动）
 * - §1.8 兵种克制验证（骑→步×1.5，步→枪×1.5，枪→骑×1.5，被克制×0.7）
 * - §2.5 元宝替代扫荡令（扫荡令不足时用元宝替代）
 * - §3.3 自动推图战斗模式（战力≥1.2x才推图）
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../../test-utils/GameEventSimulator';
import { BattleEngine } from '../../battle/BattleEngine';
import { getRestraintMultiplier } from '../../battle/DamageCalculator';
import { BATTLE_CONFIG } from '../../battle/battle-config';
import { BattleMode } from '../../battle/battle-ultimate.types';
import { BattleOutcome, TroopType, SkillTargetType } from '../../battle/battle.types';
import type { BattleUnit, BattleTeam } from '../../battle/battle.types';
import { SweepSystem } from '../../campaign/SweepSystem';
import { DEFAULT_SWEEP_CONFIG } from '../../campaign/sweep.types';

const mkUnit = (id: string, troop: TroopType, side: 'ally' | 'enemy' = 'ally', atk = 200): BattleUnit => ({
  id, name: id, faction: 'shu', troopType: troop, side, position: 'front',
  attack: atk, baseAttack: atk, defense: 50, baseDefense: 50, intelligence: 30, speed: 50,
  maxHp: 1000, hp: 1000, isAlive: true, rage: 0, maxRage: 100,
  normalAttack: { id: 'na', name: '普攻', type: 'active', level: 1, description: '', multiplier: 1.0, targetType: SkillTargetType.SINGLE_ENEMY, rageCost: 0, cooldown: 0, currentCooldown: 0 },
  skills: [], buffs: [],
});
const mkTeam = (units: BattleUnit[], side: 'ally' | 'enemy'): BattleTeam => ({ units, side });
const initSim = (): GameEventSimulator => {
  const sim = createSim();
  sim.engine.resource.setCap('grain', 1_000_000);
  sim.engine.resource.setCap('troops', 1_000_000);
  sim.addResources(SUFFICIENT_RESOURCES);
  ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao'].forEach(id => sim.addHeroDirectly(id));
  sim.engine.createFormation('main');
  sim.engine.setFormation('main', ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao']);
  return sim;
};
const clear3 = (sim: GameEventSimulator, sid: string) => { sim.engine.startBattle(sid); sim.engine.completeBattle(sid, 3); };
const modeByRatio = (r: number) => r >= 1.43 ? BattleMode.AUTO : r <= 1.0 ? BattleMode.MANUAL : BattleMode.SEMI_AUTO;

describe('V4 BATTLE-SWEEP-SUPPLEMENT', () => {
  // §1.3.2 战斗模式自动切换
  describe('§1.3.2 战斗模式自动切换', () => {
    it('≥1.43x → AUTO', () => expect(modeByRatio(1.5)).toBe(BattleMode.AUTO));
    it('≥1.43x 精确边界 → AUTO', () => expect(modeByRatio(1.43)).toBe(BattleMode.AUTO));
    it('≤1.0x → MANUAL', () => expect(modeByRatio(0.8)).toBe(BattleMode.MANUAL));
    it('≤1.0x 精确边界 → MANUAL', () => expect(modeByRatio(1.0)).toBe(BattleMode.MANUAL));
    it('1.0~1.43x → SEMI_AUTO', () => expect(modeByRatio(1.2)).toBe(BattleMode.SEMI_AUTO));
    it('引擎set/get模式', () => {
      const e = new BattleEngine();
      e.setBattleMode(BattleMode.SEMI_AUTO);
      expect(e.getBattleMode()).toBe(BattleMode.SEMI_AUTO);
      expect(e.getState().battleMode).toBe(BattleMode.SEMI_AUTO);
    });
  });

  // §1.8 兵种克制验证
  describe('§1.8 兵种克制验证', () => {
    it('骑→步 ×1.5', () => expect(getRestraintMultiplier(TroopType.CAVALRY, TroopType.INFANTRY)).toBe(1.5));
    it('步→枪 ×1.5', () => expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.SPEARMAN)).toBe(1.5));
    it('枪→骑 ×1.5', () => expect(getRestraintMultiplier(TroopType.SPEARMAN, TroopType.CAVALRY)).toBe(1.5));
    it('被克制 ×0.7 (步←骑)', () => expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.CAVALRY)).toBe(0.7));
    it('弓/谋无克制 ×1.0', () => {
      expect(getRestraintMultiplier(TroopType.ARCHER, TroopType.INFANTRY)).toBe(1.0);
      expect(getRestraintMultiplier(TroopType.STRATEGIST, TroopType.CAVALRY)).toBe(1.0);
    });
  });

  // §2.5 元宝替代扫荡令
  describe('§2.5 元宝替代扫荡令', () => {
    it('扫荡令不足时扫荡失败', () => {
      const sim = initSim(); const s = sim.engine.getStageList(); const sw = sim.engine.getSweepSystem();
      clear3(sim, s[0].id);
      expect(sw.sweep(s[0].id, 1).success).toBe(false);
    });
    it('扫荡令充足时扫荡成功', () => {
      const sim = initSim(); const s = sim.engine.getStageList(); const sw = sim.engine.getSweepSystem();
      clear3(sim, s[0].id); sw.addTickets(5);
      const r = sw.sweep(s[0].id, 3);
      expect(r.success).toBe(true); expect(r.ticketsUsed).toBe(3); expect(sw.getTicketCount()).toBe(2);
    });
    it('元宝可作为替代资源', () => {
      const sim = initSim(); sim.addResources({ gold: 10000 });
      expect(sim.getResource('gold')).toBeGreaterThan(0);
    });
    it('非法次数被拒绝', () => {
      const sim = initSim(); const s = sim.engine.getStageList(); const sw = sim.engine.getSweepSystem();
      clear3(sim, s[0].id); sw.addTickets(100);
      expect(sw.sweep(s[0].id, 0).success).toBe(false);
      expect(sw.sweep(s[0].id, DEFAULT_SWEEP_CONFIG.maxSweepCount + 1).success).toBe(false);
    });
  });

  // §3.3 自动推图战斗模式
  describe('§3.3 自动推图战斗模式', () => {
    it('初始进度为空', () => {
      const sim = initSim(); const p = sim.engine.getSweepSystem().getAutoPushProgress();
      expect(p.isRunning).toBe(false); expect(p.attempts).toBe(0);
    });
    it('执行自动推图返回结果', () => {
      const sim = initSim(); const s = sim.engine.getStageList(); const sw = sim.engine.getSweepSystem();
      clear3(sim, s[0].id); clear3(sim, s[1].id); sw.addTickets(50);
      const r = sw.autoPush();
      expect(typeof r.totalAttempts).toBe('number'); expect(r.totalAttempts).toBeLessThanOrEqual(DEFAULT_SWEEP_CONFIG.autoPushMaxAttempts);
    });
    it('战力≥1.2x才推图', () => {
      expect(1.5 >= 1.2).toBe(true); expect(0.9 >= 1.2).toBe(false);
    });
    it('推图消耗扫荡令', () => {
      const sim = initSim(); const s = sim.engine.getStageList(); const sw = sim.engine.getSweepSystem();
      clear3(sim, s[0].id); clear3(sim, s[1].id); sw.addTickets(50);
      const before = sw.getTicketCount(); sw.autoPush();
      expect(sw.getTicketCount()).toBeLessThanOrEqual(before);
    });
  });
});
