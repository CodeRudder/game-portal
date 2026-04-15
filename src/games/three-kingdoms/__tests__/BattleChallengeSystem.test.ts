/**
 * BattleChallengeSystem 测试套件
 *
 * 覆盖：初始化、解锁条件、开始挑战、玩家攻击/技能、
 * 战斗结算与星级评价、序列化/反序列化。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BattleChallengeSystem, type PlayerHero } from '@/games/three-kingdoms/BattleChallengeSystem';

// ═══════════════════════════════════════════════════════════════
// 测试辅助
// ═══════════════════════════════════════════════════════════════

function makeHeroes(count: number): PlayerHero[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `hero_${i}`,
    name: `武将${i + 1}`,
    hp: 200,
    maxHp: 200,
    attack: 30 + i * 5,
    defense: 10 + i * 2,
  }));
}

const ALL_IDS = ['ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07', 'ch08'];

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('BattleChallengeSystem', () => {
  let system: BattleChallengeSystem;

  beforeEach(() => {
    system = new BattleChallengeSystem();
  });

  // ─── 1. 初始化 ─────────────────────────────────────
  it('应初始化 8 个关卡', () => {
    const challenges = system.getChallenges();
    expect(challenges).toHaveLength(8);
    const ids = challenges.map((c) => c.id).sort();
    expect(ids).toEqual(ALL_IDS);
  });

  it('所有关卡初始状态为未完成、0 星', () => {
    for (const c of system.getChallenges()) {
      expect(c.isCompleted).toBe(false);
      expect(c.stars).toBe(0);
      expect(c.bestTime).toBeUndefined();
    }
  });

  // ─── 2. 解锁条件 ───────────────────────────────────
  it('ch01 无前置条件，等级 1 即可挑战', () => {
    expect(system.canChallenge('ch01', 1, [], 1)).toBe(true);
  });

  it('ch02 需要 ch01 完成', () => {
    expect(system.canChallenge('ch02', 1, [], 1)).toBe(false);
    expect(system.canChallenge('ch02', 1, ['ch01'], 1)).toBe(true);
  });

  it('ch04 需要至少 2 名英雄', () => {
    expect(system.canChallenge('ch04', 5, ['ch03'], 1)).toBe(false);
    expect(system.canChallenge('ch04', 5, ['ch03'], 2)).toBe(true);
  });

  it('ch08 需要全部前置关卡和 5 名英雄', () => {
    // 缺少 ch07
    expect(system.canChallenge('ch08', 15, ALL_IDS.slice(0, 6), 5)).toBe(false);
    expect(system.canChallenge('ch08', 15, ALL_IDS, 4)).toBe(false);
    expect(system.canChallenge('ch08', 15, ALL_IDS, 5)).toBe(true);
  });

  it('getAvailableChallenges 返回符合条件的关卡', () => {
    const available = system.getAvailableChallenges(1, [], 1);
    expect(available).toHaveLength(1);
    expect(available[0].id).toBe('ch01');
  });

  // ─── 3. 开始挑战 ───────────────────────────────────
  it('开始挑战后 activeChallenge 不为空', () => {
    const challenge = system.startChallenge('ch01', makeHeroes(1));
    expect(challenge).not.toBeNull();
    expect(challenge!.id).toBe('ch01');
    expect(system.getActiveChallenge()).not.toBeNull();
    expect(system.getCurrentWave()).toBe(0);
  });

  it('已有进行中挑战时不能开始新挑战', () => {
    system.startChallenge('ch01', makeHeroes(1));
    const second = system.startChallenge('ch02', makeHeroes(1));
    expect(second).toBeNull();
  });

  // ─── 4. 玩家攻击 ───────────────────────────────────
  it('玩家攻击对存活敌人造成伤害', () => {
    system.startChallenge('ch01', makeHeroes(1));
    const enemies = system.getActiveChallenge()!.waves[0].enemies;
    const target = enemies[0];
    const result = system.playerAttack(target.id);
    expect(result.isMiss).toBe(false);
    if (!result.isCrit) {
      expect(result.damage).toBeGreaterThan(0);
      expect(result.damage).toBeLessThan(target.maxHp);
    } else {
      expect(result.isCrit).toBe(true);
      expect(result.damage).toBeGreaterThan(0);
    }
  });

  it('攻击不存在的目标返回 0 伤害', () => {
    system.startChallenge('ch01', makeHeroes(1));
    const result = system.playerAttack('nonexistent');
    expect(result.damage).toBe(0);
    expect(result.isCrit).toBe(false);
    expect(result.isMiss).toBe(false);
  });

  it('暴击概率验证：多次攻击中至少出现一次暴击或闪避', () => {
    system.startChallenge('ch01', makeHeroes(5));
    const enemies = system.getActiveChallenge()!.waves[0].enemies;
    let critCount = 0;
    let missCount = 0;
    // 运行足够多次以覆盖概率分布
    for (let i = 0; i < 200; i++) {
      // 重置敌人 HP 以保持可攻击
      for (const e of enemies) {
        if (!e.isAlive) { e.isAlive = true; e.hp = e.maxHp; }
      }
      const target = enemies[i % enemies.length];
      const result = system.playerAttack(target.id);
      if (result.isCrit) critCount++;
      if (result.isMiss) missCount++;
    }
    // 统计上 200 次中应至少各出现 1 次（10% 暴击 / 5% 闪避）
    expect(critCount).toBeGreaterThan(0);
    expect(missCount).toBeGreaterThan(0);
  });

  // ─── 5. 技能使用 ───────────────────────────────────
  it('火攻对全体敌人造成伤害', () => {
    system.startChallenge('ch01', makeHeroes(2));
    const enemies = system.getActiveChallenge()!.waves[0].enemies;
    const result = system.playerSkill('hero_0', 'fire', '');
    expect(result.damage).toBeGreaterThan(0);
    expect(result.effect).toContain('火攻');
  });

  it('治疗恢复英雄 HP', () => {
    const heroes = makeHeroes(2);
    heroes[0].hp = 50; // 受伤状态
    system.startChallenge('ch01', heroes);
    const result = system.playerSkill('hero_0', 'heal', '');
    expect(result.effect).toContain('恢复');
  });

  it('连击对目标造成高额伤害', () => {
    system.startChallenge('ch01', makeHeroes(2));
    const target = system.getActiveChallenge()!.waves[0].enemies[0];
    const result = system.playerSkill('hero_0', 'combo', target.id);
    expect(result.damage).toBeGreaterThan(0);
    expect(result.effect).toContain('连击');
  });

  it('增益提升攻击力', () => {
    system.startChallenge('ch01', makeHeroes(2));
    const result = system.playerSkill('hero_0', 'buff', '');
    expect(result.effect).toContain('提升');
  });

  // ─── 6. 战斗结算与星级 ─────────────────────────────
  it('胜利结算返回正确星级', () => {
    system.startChallenge('ch01', makeHeroes(2));
    const result = system.settleChallenge(true, 25);
    expect(result.stars).toBe(3);
    expect(result.rewards.food).toBe(100);
    expect(result.rewards.gold).toBe(50);
  });

  it('60 秒内完成获得 2 星', () => {
    system.startChallenge('ch01', makeHeroes(2));
    const result = system.settleChallenge(true, 45);
    expect(result.stars).toBe(2);
  });

  it('超过 60 秒完成获得 1 星', () => {
    system.startChallenge('ch01', makeHeroes(2));
    const result = system.settleChallenge(true, 90);
    expect(result.stars).toBe(1);
  });

  it('失败返回 0 星和空奖励', () => {
    system.startChallenge('ch01', makeHeroes(2));
    const result = system.settleChallenge(false, 30);
    expect(result.stars).toBe(0);
    expect(result.rewards.food).toBe(0);
  });

  it('结算后更新关卡记录', () => {
    system.startChallenge('ch01', makeHeroes(2));
    system.settleChallenge(true, 20);
    const ch = system.getChallenges().find((c) => c.id === 'ch01')!;
    expect(ch.isCompleted).toBe(true);
    expect(ch.bestTime).toBe(20);
    expect(ch.stars).toBe(3);
  });

  // ─── 7. 序列化/反序列化 ────────────────────────────
  it('序列化后反序列化应恢复状态', () => {
    system.startChallenge('ch01', makeHeroes(2));
    system.settleChallenge(true, 25);

    const data = system.serialize();
    const newSystem = new BattleChallengeSystem();
    newSystem.deserialize(data);

    const ch = newSystem.getChallenges().find((c) => c.id === 'ch01')!;
    expect(ch.isCompleted).toBe(true);
    expect(ch.bestTime).toBe(25);
    expect(ch.stars).toBe(3);
  });

  it('反序列化空数据不会崩溃', () => {
    const fresh = new BattleChallengeSystem();
    expect(() => fresh.deserialize(null)).not.toThrow();
    expect(() => fresh.deserialize({})).not.toThrow();
  });
});
