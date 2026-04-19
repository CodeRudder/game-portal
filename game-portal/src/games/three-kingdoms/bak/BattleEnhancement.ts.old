/**
 * 三国霸业 — 战斗增强系统
 *
 * 在 BattleChallengeSystem 基础上提供：
 *   - 暴击 / 闪避机制
 *   - 武技特效（灼烧、冰冻、中毒、眩晕、流血、增益、治疗）
 *   - 远程 / 近战区分与距离惩罚
 *   - 多人对战房间框架
 */

export type DamageType = 'physical' | 'magical' | 'true';
export type AttackRange = 'melee' | 'ranged';
export type CombatEffectType =
  | 'burn' | 'freeze' | 'poison' | 'stun'
  | 'bleed' | 'buff_attack' | 'buff_defense' | 'heal';

export interface CombatEffect {
  type: CombatEffectType;
  duration: number;      // 回合数
  value: number;         // 效果值
  sourceId: string;
  targetId: string;
}

export interface SkillEffect {
  name: string;
  damage: number;
  damageType: DamageType;
  range: AttackRange;
  effects: CombatEffect[];
  animationType: 'slash' | 'fire' | 'ice' | 'lightning' | 'arrow' | 'heal';
  cooldown: number;
  currentCooldown: number;
}

export interface CombatUnit {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  intelligence: number;
  range: AttackRange;
  position: { x: number; y: number }; // 战场坐标 0-100
  effects: CombatEffect[];
  skills: SkillEffect[];
  isAlive: boolean;
}

export interface MultiplayerRoom {
  id: string;
  hostId: string;
  guestId?: string;
  hostUnits: CombatUnit[];
  guestUnits: CombatUnit[];
  currentTurn: 'host' | 'guest';
  turnNumber: number;
  status: 'waiting' | 'playing' | 'finished';
  winner?: 'host' | 'guest';
}

// 伤害公式常量
const CRIT_RATE = 0.1;
const CRIT_MULTIPLIER = 2.0;
const MISS_RATE = 0.05;
const RANGE_PENALTY_THRESHOLD = 50;
const RANGE_PENALTY_FACTOR = 0.7;

export class BattleEnhancement {
  private effects: CombatEffect[] = [];
  private combatLog: string[] = [];
  private rooms: Map<string, MultiplayerRoom> = new Map();

  constructor() {}

  /**
   * 计算伤害（含暴击 / 闪避 / 防御 / 远程近战）
   * 公式：物理 = attack - defense×0.5, 魔法 = intelligence×multiplier, 真实 = 固定值
   * 暴击(10%): 伤害×2.0  |  闪避(5%): 伤害=0  |  远程距离>50: 伤害×0.7
   */
  calculateDamage(
    attacker: CombatUnit, defender: CombatUnit, skillIndex?: number,
  ): { damage: number; isCrit: boolean; isMiss: boolean; damageType: DamageType; appliedEffects: CombatEffect[] } {
    // 闪避判定（5%）
    if (Math.random() < MISS_RATE) {
      this.log(`${defender.name} 闪避了 ${attacker.name} 的攻击！`);
      return { damage: 0, isCrit: false, isMiss: true, damageType: 'physical', appliedEffects: [] };
    }

    let damage: number;
    let damageType: DamageType;
    const appliedEffects: CombatEffect[] = [];

    if (skillIndex !== undefined && skillIndex >= 0 && skillIndex < attacker.skills.length) {
      const skill = attacker.skills[skillIndex];
      // 冷却检查
      if (skill.currentCooldown > 0) {
        this.log(`${attacker.name} 的 ${skill.name} 冷却中（剩余 ${skill.currentCooldown} 回合）`);
        return { damage: 0, isCrit: false, isMiss: false, damageType: skill.damageType, appliedEffects: [] };
      }
      damageType = skill.damageType;
      if (damageType === 'magical') {
        damage = Math.round(attacker.intelligence * (skill.damage / 10));
      } else if (damageType === 'true') {
        damage = skill.damage;
      } else {
        damage = Math.max(1, attacker.attack + skill.damage - defender.defense * 0.5);
      }
      // 附带效果
      for (const eff of skill.effects) {
        appliedEffects.push({ ...eff, sourceId: attacker.id, targetId: defender.id });
      }
      skill.currentCooldown = skill.cooldown; // 重置冷却
    } else {
      damageType = 'physical';
      damage = Math.max(1, attacker.attack - defender.defense * 0.5);
    }

    // 远程距离惩罚
    const penalty = this.getRangePenalty(attacker, defender);
    if (penalty < 1) damage = Math.round(damage * penalty);

    // 暴击判定（10%）
    const isCrit = Math.random() < CRIT_RATE;
    if (isCrit) {
      damage = Math.round(damage * CRIT_MULTIPLIER);
      this.log(`${attacker.name} 触发暴击！`);
    }

    damage = Math.max(0, damage);
    const typeLabel = damageType === 'physical' ? '物理' : damageType === 'magical' ? '魔法' : '真实';
    this.log(`${attacker.name} → ${defender.name}: ${damage} 点${typeLabel}伤害${isCrit ? '（暴击）' : ''}`);
    return { damage, isCrit, isMiss: false, damageType, appliedEffects };
  }

  /** 每回合处理持续效果，返回本回合伤害/治疗/过期效果 */
  processEffects(unit: CombatUnit): { damage: number; healed: number; effectsExpired: CombatEffect[] } {
    let totalDamage = 0;
    let totalHealed = 0;
    const expired: CombatEffect[] = [];
    const remaining: CombatEffect[] = [];

    for (const effect of unit.effects.filter((e) => e.targetId === unit.id)) {
      if (effect.type === 'burn' || effect.type === 'poison' || effect.type === 'bleed') {
        totalDamage += effect.value;
      } else if (effect.type === 'heal') {
        totalHealed += effect.value;
      }
      effect.duration -= 1;
      if (effect.duration <= 0) expired.push(effect);
      else remaining.push(effect);
    }

    unit.effects = remaining;
    unit.hp = Math.max(0, Math.min(unit.maxHp, unit.hp - totalDamage + totalHealed));
    if (unit.hp <= 0) unit.isAlive = false;
    if (totalDamage > 0) this.log(`${unit.name} 受到 ${totalDamage} 点持续伤害`);
    if (totalHealed > 0) this.log(`${unit.name} 恢复 ${totalHealed} 点生命`);
    return { damage: totalDamage, healed: totalHealed, effectsExpired: expired };
  }

  /** 计算远程攻击距离惩罚系数（1.0 = 无惩罚，0.7 = 有惩罚） */
  getRangePenalty(attacker: CombatUnit, defender: CombatUnit): number {
    if (attacker.range !== 'ranged') return 1.0;
    return this.getDistance(attacker, defender) > RANGE_PENALTY_THRESHOLD ? RANGE_PENALTY_FACTOR : 1.0;
  }

  /** 添加战斗效果 */
  addEffect(effect: CombatEffect): void {
    this.effects.push(effect);
  }

  // ─── 多人对战框架 ──────────────────────────────────

  /** 创建对战房间 */
  createRoom(hostId: string, hostUnits: CombatUnit[]): MultiplayerRoom {
    const id = `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const room: MultiplayerRoom = {
      id, hostId,
      hostUnits: hostUnits.map((u) => ({ ...u, effects: [...u.effects], skills: u.skills.map((s) => ({ ...s })) })),
      guestUnits: [],
      currentTurn: 'host',
      turnNumber: 1,
      status: 'waiting',
    };
    this.rooms.set(id, room);
    return room;
  }

  /** 加入对战房间 */
  joinRoom(roomId: string, guestId: string, guestUnits: CombatUnit[]): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'waiting') return false;
    room.guestId = guestId;
    room.guestUnits = guestUnits.map((u) => ({ ...u, effects: [...u.effects], skills: u.skills.map((s) => ({ ...s })) }));
    room.status = 'playing';
    return true;
  }

  /** 执行一个回合动作 */
  executeTurn(
    room: MultiplayerRoom,
    action: { attackerId: string; skillIndex: number; targetId: string },
  ): MultiplayerRoom {
    if (room.status !== 'playing') return room;

    const isHostTurn = room.currentTurn === 'host';
    const attackerSide = isHostTurn ? room.hostUnits : room.guestUnits;
    const defenderSide = isHostTurn ? room.guestUnits : room.hostUnits;
    const attacker = attackerSide.find((u) => u.id === action.attackerId && u.isAlive);
    const defender = defenderSide.find((u) => u.id === action.targetId && u.isAlive);
    if (!attacker || !defender) return room;

    // 处理攻击者身上的持续效果
    this.processEffects(attacker);

    if (!attacker.isAlive) {
      this.log(`${attacker.name} 因持续效果阵亡`);
    } else {
      const result = this.calculateDamage(attacker, defender, action.skillIndex);
      defender.hp = Math.max(0, defender.hp - result.damage);
      if (defender.hp <= 0) { defender.isAlive = false; this.log(`${defender.name} 被击败！`); }
      for (const eff of result.appliedEffects) defender.effects.push({ ...eff });
      this.processEffects(defender);
      // 减少攻击方技能冷却
      for (const skill of attacker.skills) {
        if (skill.currentCooldown > 0) skill.currentCooldown -= 1;
      }
    }

    // 检查胜负
    const hostAlive = room.hostUnits.some((u) => u.isAlive);
    const guestAlive = room.guestUnits.some((u) => u.isAlive);
    if (!hostAlive || !guestAlive) {
      room.status = 'finished';
      room.winner = !hostAlive ? 'guest' : 'host';
      this.log(`${room.winner === 'host' ? '房主' : '挑战者'} 获胜！`);
    } else {
      room.currentTurn = isHostTurn ? 'guest' : 'host';
      if (room.currentTurn === 'host') room.turnNumber += 1;
    }
    return room;
  }

  // ─── 战斗日志 ──────────────────────────────────────

  getCombatLog(): string[] { return [...this.combatLog]; }
  clearLog(): void { this.combatLog = []; }

  // ─── 工具方法 ──────────────────────────────────────

  /** 判断目标是否在攻击范围内 */
  isInRange(attacker: CombatUnit, defender: CombatUnit, range: number): boolean {
    return this.getDistance(attacker, defender) <= range;
  }

  /** 获取范围内所有存活单位 */
  getUnitsInRange(units: CombatUnit[], center: CombatUnit, range: number): CombatUnit[] {
    return units.filter((u) => u.isAlive && u.id !== center.id && this.getDistance(center, u) <= range);
  }

  /** 计算两个单位之间的欧几里得距离 */
  private getDistance(a: CombatUnit, b: CombatUnit): number {
    const dx = a.position.x - b.position.x;
    const dy = a.position.y - b.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private log(message: string): void { this.combatLog.push(message); }
}
