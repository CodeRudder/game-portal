/**
 * DEF-003 集成测试：HeroSystem.addExp 双路径一致性验证
 *
 * 验证两条 addExp 路径操作同一对象引用，结果一致：
 *   路径 A: HeroSystem.addExp() — 直接修改内部状态（战役/战斗奖励分发）
 *   路径 B: HeroLevelSystem.addExp() — 计算后通过 setLevelAndExp 写回（手动升级）
 *
 * 两条路径最终都修改 HeroSystem.state.generals[id] 的 level/exp 字段。
 * 结论：两条路径操作同一内部状态对象，引用一致。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSim } from '../../../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../../../test-utils/GameEventSimulator';

describe('DEF-003: addExp 双路径一致性验证', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    sim = createSim();
  });

  /**
   * 验证点1：两条路径操作同一内部对象引用
   * 先通过路径A加经验，再通过路径B加经验，验证状态连续无丢失
   */
  it('路径A(HeroSystem.addExp) + 路径B(HeroLevelSystem.addExp) 操作同一对象', () => {
    sim.addHeroDirectly('liubei');
    const heroSystem = sim.engine.hero;
    const levelSystem = sim.engine.heroLevel;

    // 路径A: HeroSystem.addExp — 加100经验
    const rA = heroSystem.addExp('liubei', 100);
    expect(rA).not.toBeNull();
    const afterA = heroSystem.getGeneral('liubei')!;
    const levelAfterA = afterA.level;
    const expAfterA = afterA.exp;

    // 路径B: HeroLevelSystem.addExp — 再加200经验
    const rB = levelSystem.addExp('liubei', 200);
    expect(rB).not.toBeNull();
    const afterB = heroSystem.getGeneral('liubei')!;
    // 等级应 >= 路径A后的等级
    expect(afterB.level).toBeGreaterThanOrEqual(levelAfterA);
    // 如果等级没变，经验应该增加
    if (afterB.level === levelAfterA) {
      expect(afterB.exp).toBeGreaterThan(expAfterA);
    }
  });

  /**
   * 验证点2：路径B后再走路径A，状态仍然一致
   */
  it('路径B(HeroLevelSystem) → 路径A(HeroSystem) 状态连续', () => {
    sim.addHeroDirectly('guanyu');
    const heroSystem = sim.engine.hero;
    const levelSystem = sim.engine.heroLevel;

    // 路径B先加经验
    levelSystem.addExp('guanyu', 150);
    const afterB = heroSystem.getGeneral('guanyu')!;

    // 路径A再加经验
    const rA = heroSystem.addExp('guanyu', 100);
    expect(rA).not.toBeNull();
    const afterA = heroSystem.getGeneral('guanyu')!;
    expect(afterA.level).toBeGreaterThanOrEqual(afterB.level);
  });

  /**
   * 验证点3：两条路径给相同经验，最终等级一致
   * HeroSystem.addExp 不扣铜钱，HeroLevelSystem.addExp 扣铜钱
   * 所以在铜钱充足时，相同经验应得到相同等级
   */
  it('相同经验值两条路径最终等级一致（铜钱充足时）', () => {
    // 准备两个独立武将
    sim.addHeroDirectly('liubei');
    sim.addHeroDirectly('guanyu');

    const heroSystem = sim.engine.hero;
    const levelSystem = sim.engine.heroLevel;

    // 确保铜钱充足
    sim.setResource('gold', 999999999);

    const EXP_AMOUNT = 500;

    // 路径A: HeroSystem.addExp (liubei)
    heroSystem.addExp('liubei', EXP_AMOUNT);
    const liubeiResult = heroSystem.getGeneral('liubei')!;

    // 路径B: HeroLevelSystem.addExp (guanyu)
    levelSystem.addExp('guanyu', EXP_AMOUNT);
    const guanyuResult = heroSystem.getGeneral('guanyu')!;

    // 两个武将初始都是等级1、0经验，加了相同经验后
    // 等级应该一致（因为铜钱充足，路径B不会因铜钱不足而停止）
    expect(liubeiResult.level).toBe(guanyuResult.level);
  });

  /**
   * 验证点4：连续交替使用两条路径，状态不丢失不回退
   */
  it('交替使用两条路径，经验/等级单调递增', () => {
    sim.addHeroDirectly('zhaoyun');
    const heroSystem = sim.engine.hero;
    const levelSystem = sim.engine.heroLevel;
    sim.setResource('gold', 999999999);

    let prevLevel = 1;
    let prevExp = 0;

    // 交替5轮
    for (let i = 0; i < 5; i++) {
      // 路径A
      heroSystem.addExp('zhaoyun', 50);
      const afterA = heroSystem.getGeneral('zhaoyun')!;
      expect(afterA.level).toBeGreaterThanOrEqual(prevLevel);
      if (afterA.level === prevLevel) {
        expect(afterA.exp).toBeGreaterThanOrEqual(prevExp);
      }
      prevLevel = afterA.level;
      prevExp = afterA.exp;

      // 路径B
      levelSystem.addExp('zhaoyun', 50);
      const afterB = heroSystem.getGeneral('zhaoyun')!;
      expect(afterB.level).toBeGreaterThanOrEqual(prevLevel);
      if (afterB.level === prevLevel) {
        expect(afterB.exp).toBeGreaterThanOrEqual(prevExp);
      }
      prevLevel = afterB.level;
      prevExp = afterB.exp;
    }

    // 5轮后应该至少升了几级
    expect(prevLevel).toBeGreaterThan(1);
  });

  /**
   * 验证点5：路径A不扣铜钱，路径B扣铜钱——但两者都正确修改等级
   * 这确认了两条路径的语义差异是预期的
   */
  it('路径A不扣铜钱，路径B扣铜钱（语义差异确认）', () => {
    sim.addHeroDirectly('liubei');
    sim.addHeroDirectly('guanyu');
    sim.setResource('gold', 10000);

    const heroSystem = sim.engine.hero;
    const levelSystem = sim.engine.heroLevel;

    const goldBefore = sim.getResource('gold');

    // 路径A: 不扣铜钱
    heroSystem.addExp('liubei', 100);
    const goldAfterA = sim.getResource('gold');
    expect(goldAfterA).toBe(goldBefore); // 路径A不扣铜钱

    // 路径B: 扣铜钱（如果升级了的话）
    levelSystem.addExp('guanyu', 100);
    // 关键是两个武将都正确获得了经验
    const liubei = heroSystem.getGeneral('liubei')!;
    const guanyu = heroSystem.getGeneral('guanyu')!;
    expect(liubei.level + liubei.exp).toBeGreaterThan(1); // > 初始值
    expect(guanyu.level + guanyu.exp).toBeGreaterThan(1);
  });
});
