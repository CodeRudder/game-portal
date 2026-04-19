/**
 * BattleEnhancement 测试套件
 *
 * 覆盖：伤害计算、暴击/闪避、远程惩罚、技能效果、
 * 持续效果处理、多人对战房间、范围检测。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BattleEnhancement,
  type CombatUnit,
  type CombatEffect,
  type SkillEffect,
} from '@/games/three-kingdoms/BattleEnhancement';

// ═══════════════════════════════════════════════════════════════
// 测试辅助
// ═══════════════════════════════════════════════════════════════

function makeUnit(
  id: string,
  overrides: Partial<CombatUnit> = {},
): CombatUnit {
  return {
    id,
    name: id,
    hp: 500,
    maxHp: 500,
    attack: 100,
    defense: 30,
    intelligence: 80,
    range: 'melee',
    position: { x: 10, y: 10 },
    effects: [],
    skills: [],
    isAlive: true,
    ...overrides,
  };
}

const burnSkill: SkillEffect = {
  name: '烈焰斩',
  damage: 3,
  damageType: 'magical',
  range: 'melee',
  effects: [{ type: 'burn', duration: 3, value: 20, sourceId: '', targetId: '' }],
  animationType: 'fire',
  cooldown: 2,
  currentCooldown: 0,
};

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('BattleEnhancement', () => {
  let system: BattleEnhancement;

  beforeEach(() => {
    system = new BattleEnhancement();
  });

  // ─── 1. 基础物理伤害 ───────────────────────────────
  it('基础物理伤害 = attack - defense * 0.5', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // 不暴击、不闪避
    const attacker = makeUnit('a', { attack: 100 });
    const defender = makeUnit('d', { defense: 30 });
    const result = system.calculateDamage(attacker, defender);
    expect(result.isMiss).toBe(false);
    expect(result.isCrit).toBe(false);
    expect(result.damage).toBe(Math.max(1, 100 - 30 * 0.5)); // 85
    vi.restoreAllMocks();
  });

  // ─── 2. 暴击伤害验证 ───────────────────────────────
  it('暴击时伤害 × 2.0', () => {
    // 第一次 random() → 闪避判定 (>= 0.05 → 不闪避)
    // 第二次 random() → 暴击判定 (< 0.10 → 暴击)
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.05);
    const attacker = makeUnit('a', { attack: 100 });
    const defender = makeUnit('d', { defense: 30 });
    const result = system.calculateDamage(attacker, defender);
    expect(result.isCrit).toBe(true);
    expect(result.isMiss).toBe(false);
    const base = Math.max(1, 100 - 30 * 0.5);
    expect(result.damage).toBe(Math.round(base * 2));
    vi.restoreAllMocks();
  });

  // ─── 3. 闪避验证 ──────────────────────────────────
  it('闪避时伤害为 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01); // < 0.05 → 闪避
    const attacker = makeUnit('a');
    const defender = makeUnit('d');
    const result = system.calculateDamage(attacker, defender);
    expect(result.isMiss).toBe(true);
    expect(result.damage).toBe(0);
    vi.restoreAllMocks();
  });

  // ─── 4. 远程距离惩罚 ───────────────────────────────
  it('远程单位距离 > 50 时伤害 × 0.7', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const attacker = makeUnit('a', { range: 'ranged', position: { x: 0, y: 0 } });
    const defender = makeUnit('d', { defense: 0, position: { x: 80, y: 0 } }); // 距离 80
    const result = system.calculateDamage(attacker, defender);
    const base = Math.max(1, attacker.attack - 0);
    expect(result.damage).toBe(Math.round(base * 0.7));
    vi.restoreAllMocks();
  });

  it('近战单位不受距离惩罚', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const attacker = makeUnit('a', { range: 'melee', position: { x: 0, y: 0 } });
    const defender = makeUnit('d', { defense: 0, position: { x: 80, y: 0 } });
    const result = system.calculateDamage(attacker, defender);
    expect(result.damage).toBe(Math.max(1, attacker.attack));
    vi.restoreAllMocks();
  });

  // ─── 5. 技能伤害 + 效果附加 ────────────────────────
  it('魔法技能伤害 = intelligence × multiplier', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const attacker = makeUnit('a', { intelligence: 80, skills: [burnSkill] });
    const defender = makeUnit('d');
    const result = system.calculateDamage(attacker, defender, 0);
    expect(result.damageType).toBe('magical');
    expect(result.damage).toBe(Math.round(80 * (3 / 10))); // 24
    expect(result.appliedEffects).toHaveLength(1);
    expect(result.appliedEffects[0].type).toBe('burn');
    vi.restoreAllMocks();
  });

  it('技能冷却中不造成伤害', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const skillOnCd = { ...burnSkill, currentCooldown: 2 };
    const attacker = makeUnit('a', { skills: [skillOnCd] });
    const defender = makeUnit('d');
    const result = system.calculateDamage(attacker, defender, 0);
    expect(result.damage).toBe(0);
    vi.restoreAllMocks();
  });

  // ─── 6. 持续效果处理 ───────────────────────────────
  it('burn 效果每回合造成伤害', () => {
    const unit = makeUnit('u', {
      hp: 200,
      effects: [
        { type: 'burn', duration: 2, value: 30, sourceId: 'a', targetId: 'u' },
      ],
    });
    const result = system.processEffects(unit);
    expect(result.damage).toBe(30);
    expect(unit.hp).toBe(170);
    expect(unit.effects).toHaveLength(1); // 持续 1 回合后还剩 1
  });

  it('效果到期后移除', () => {
    const unit = makeUnit('u', {
      hp: 200,
      effects: [
        { type: 'poison', duration: 1, value: 15, sourceId: 'a', targetId: 'u' },
      ],
    });
    const result = system.processEffects(unit);
    expect(result.effectsExpired).toHaveLength(1);
    expect(unit.effects).toHaveLength(0);
  });

  it('heal 效果恢复生命', () => {
    const unit = makeUnit('u', {
      hp: 100,
      maxHp: 200,
      effects: [
        { type: 'heal', duration: 1, value: 50, sourceId: 'a', targetId: 'u' },
      ],
    });
    const result = system.processEffects(unit);
    expect(result.healed).toBe(50);
    expect(unit.hp).toBe(150);
  });

  // ─── 7. 多人对战房间 ───────────────────────────────
  it('创建房间 → 加入 → 执行回合', () => {
    const hostUnits = [makeUnit('h1')];
    const guestUnits = [makeUnit('g1')];

    const room = system.createRoom('host', hostUnits);
    expect(room.status).toBe('waiting');

    const joined = system.joinRoom(room.id, 'guest', guestUnits);
    expect(joined).toBe(true);

    // 从 rooms map 中拿到最新状态
    const joinedRoom = system.createRoom('host2', [makeUnit('h2')]);
    // 直接用 room 对象操作
    room.status = 'playing';
    room.guestId = 'guest';
    room.guestUnits = guestUnits;

    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const updated = system.executeTurn(room, {
      attackerId: 'h1',
      skillIndex: -1,
      targetId: 'g1',
    });
    expect(updated.turnNumber).toBeGreaterThanOrEqual(1);
    vi.restoreAllMocks();
  });

  it('加入不存在的房间返回 false', () => {
    expect(system.joinRoom('nonexistent', 'guest', [])).toBe(false);
  });

  // ─── 8. 战场范围检测 ───────────────────────────────
  it('isInRange 正确判断距离', () => {
    const a = makeUnit('a', { position: { x: 0, y: 0 } });
    const b = makeUnit('b', { position: { x: 30, y: 40 } }); // 距离 50
    expect(system.isInRange(a, b, 50)).toBe(true);
    expect(system.isInRange(a, b, 49)).toBe(false);
  });

  it('getUnitsInRange 返回范围内的存活单位', () => {
    const center = makeUnit('center', { position: { x: 50, y: 50 } });
    const units = [
      makeUnit('u1', { position: { x: 55, y: 55 } }),   // 距离 ~7
      makeUnit('u2', { position: { x: 90, y: 90 } }),   // 距离 ~57
      makeUnit('u3', { position: { x: 52, y: 52 }, isAlive: false }),
    ];
    const inRange = system.getUnitsInRange(units, center, 10);
    expect(inRange).toHaveLength(1);
    expect(inRange[0].id).toBe('u1');
  });
});
