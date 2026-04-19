/**
 * 三国霸业 — 战斗关卡挑战系统
 *
 * 提供 8 个渐进式关卡，支持多种战斗目标、波次生成、
 * 玩家操作（普攻/技能）、星级评价和收益结算。
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export type BattleObjective = 'eliminate_all' | 'defeat_boss' | 'survive_waves' | 'protect_npc' | 'capture_point';
export type BattleDifficulty = 'easy' | 'normal' | 'hard' | 'nightmare';

export interface BattleEnemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  type: 'melee' | 'ranged' | 'boss';
  isAlive: boolean;
}

export interface BattleWave {
  enemies: BattleEnemy[];
  spawnDelay: number;
}

export interface BattleRewards {
  food: number;
  gold: number;
  troops: number;
  heroExp: number;
  unlockId?: string;
}

export interface BattleChallenge {
  id: string;
  name: string;
  description: string;
  difficulty: BattleDifficulty;
  objective: BattleObjective;
  waves: BattleWave[];
  rewards: BattleRewards;
  unlockCondition: { minLevel: number; completedChallenges: string[]; minHeroes?: number };
  timeLimit?: number;
  isCompleted: boolean;
  bestTime?: number;
  stars: 0 | 1 | 2 | 3;
}

export interface PlayerHero {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
}

// ═══════════════════════════════════════════════════════════════
// 关卡数据工厂
// ═══════════════════════════════════════════════════════════════

/** 创建标准敌人 */
function makeEnemy(id: string, name: string, hp: number, attack: number, defense: number, type: BattleEnemy['type'] = 'melee'): BattleEnemy {
  return { id, name, hp, maxHp: hp, attack, defense, type, isAlive: true };
}

/** 创建波次 */
function makeWave(enemyCount: number, prefix: string, baseHp: number, baseAtk: number, baseDef: number, spawnDelay: number, type: BattleEnemy['type'] = 'melee'): BattleWave {
  const enemies: BattleEnemy[] = [];
  for (let i = 0; i < enemyCount; i++) {
    enemies.push(makeEnemy(`${prefix}_e${i}`, `${prefix}兵${i + 1}`, baseHp, baseAtk, baseDef, type));
  }
  return { enemies, spawnDelay };
}

/** 8 个关卡模板定义 */
function createChallengeTemplates(): Omit<BattleChallenge, 'isCompleted' | 'bestTime' | 'stars'>[] {
  return [
    {
      id: 'ch01', name: '黄巾之乱', description: '剿灭黄巾贼，平定乱世之始。',
      difficulty: 'easy', objective: 'eliminate_all',
      waves: [makeWave(3, '黄巾', 80, 10, 3, 0), makeWave(3, '黄巾', 90, 12, 4, 2)],
      rewards: { food: 100, gold: 50, troops: 20, heroExp: 30 },
      unlockCondition: { minLevel: 1, completedChallenges: [] },
    },
    {
      id: 'ch02', name: '讨伐董卓', description: '集结义军，讨伐暴君董卓。',
      difficulty: 'easy', objective: 'defeat_boss',
      waves: [
        makeWave(2, '凉州', 100, 14, 5, 0),
        makeWave(2, '凉州', 110, 15, 6, 2),
        { enemies: [makeEnemy('dongzhuo', '董卓', 350, 25, 10, 'boss')], spawnDelay: 3 },
      ],
      rewards: { food: 150, gold: 80, troops: 30, heroExp: 50, unlockId: 'hero_lubu' },
      unlockCondition: { minLevel: 1, completedChallenges: ['ch01'] },
    },
    {
      id: 'ch03', name: '虎牢关之战', description: '坚守虎牢关，抵御敌军连番进攻。',
      difficulty: 'normal', objective: 'survive_waves',
      waves: Array.from({ length: 5 }, (_, i) => makeWave(2, '虎牢', 120 + i * 10, 16 + i, 7, i * 2)),
      rewards: { food: 200, gold: 120, troops: 40, heroExp: 70 },
      unlockCondition: { minLevel: 3, completedChallenges: ['ch02'] },
      timeLimit: 120,
    },
    {
      id: 'ch04', name: '官渡之战', description: '以少胜多，击败袁绍大军。',
      difficulty: 'normal', objective: 'eliminate_all',
      waves: Array.from({ length: 4 }, (_, i) => makeWave(3, '袁军', 130 + i * 15, 18 + i * 2, 8 + i, i * 2)),
      rewards: { food: 250, gold: 150, troops: 50, heroExp: 90 },
      unlockCondition: { minLevel: 5, completedChallenges: ['ch03'], minHeroes: 2 },
    },
    {
      id: 'ch05', name: '赤壁之战', description: '火烧连环船，奠定三分天下。',
      difficulty: 'hard', objective: 'capture_point',
      waves: Array.from({ length: 6 }, (_, i) => makeWave(2, '曹军', 150 + i * 10, 20 + i * 2, 10 + i, i * 2)),
      rewards: { food: 350, gold: 200, troops: 70, heroExp: 120 },
      unlockCondition: { minLevel: 8, completedChallenges: ['ch04'], minHeroes: 3 },
      timeLimit: 150,
    },
    {
      id: 'ch06', name: '定军山', description: '保护军师，攻占定军山要塞。',
      difficulty: 'hard', objective: 'protect_npc',
      waves: Array.from({ length: 4 }, (_, i) => makeWave(3, '蜀军', 160 + i * 15, 22 + i * 2, 12 + i, i * 2)),
      rewards: { food: 400, gold: 250, troops: 80, heroExp: 150 },
      unlockCondition: { minLevel: 10, completedChallenges: ['ch05'] },
      timeLimit: 120,
    },
    {
      id: 'ch07', name: '五丈原', description: '最终决战，击败终极 BOSS。',
      difficulty: 'hard', objective: 'defeat_boss',
      waves: [
        makeWave(2, '魏军', 170, 24, 14, 0),
        makeWave(2, '魏军', 180, 26, 15, 2),
        makeWave(3, '魏军', 190, 28, 16, 2),
        makeWave(2, '魏军', 200, 30, 17, 2),
        { enemies: [makeEnemy('simayi', '司马懿', 600, 40, 20, 'boss')], spawnDelay: 3 },
      ],
      rewards: { food: 500, gold: 350, troops: 100, heroExp: 200, unlockId: 'hero_simayi' },
      unlockCondition: { minLevel: 12, completedChallenges: ['ch06'], minHeroes: 4 },
    },
    {
      id: 'ch08', name: '一统天下', description: '终极挑战，一统三国！',
      difficulty: 'nightmare', objective: 'eliminate_all',
      waves: Array.from({ length: 8 }, (_, i) => makeWave(3, '天下', 200 + i * 20, 30 + i * 3, 18 + i * 2, i * 2)),
      rewards: { food: 1000, gold: 800, troops: 200, heroExp: 500, unlockId: 'title_emperor' },
      unlockCondition: { minLevel: 15, completedChallenges: ['ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07'], minHeroes: 5 },
      timeLimit: 300,
    },
  ];
}

// ═══════════════════════════════════════════════════════════════
// 战斗挑战系统
// ═══════════════════════════════════════════════════════════════

export class BattleChallengeSystem {
  private challenges: Map<string, BattleChallenge> = new Map();
  private activeChallenge: BattleChallenge | null = null;
  private currentWave: number = 0;
  private battleTime: number = 0;
  private playerHeroes: PlayerHero[] = [];
  private buffTimers: Map<string, number> = new Map(); // heroId -> 剩余时间
  private npcHp: number = 0; // protect_npc 模式的 NPC 生命值
  private captureProgress: number = 0; // capture_point 模式的占领进度

  constructor() {
    this.initChallenges();
  }

  /** 初始化 8 个关卡 */
  initChallenges(): void {
    this.challenges.clear();
    const templates = createChallengeTemplates();
    for (const t of templates) {
      this.challenges.set(t.id, { ...t, isCompleted: false, bestTime: undefined, stars: 0 });
    }
  }

  // ─── 关卡查询 ──────────────────────────────────────

  /** 检查玩家是否满足关卡解锁条件 */
  canChallenge(id: string, playerLevel: number, completedIds: string[], heroCount: number): boolean {
    const challenge = this.challenges.get(id);
    if (!challenge) return false;
    const cond = challenge.unlockCondition;
    if (playerLevel < cond.minLevel) return false;
    if (heroCount < (cond.minHeroes ?? 0)) return false;
    return cond.completedChallenges.every((cid) => completedIds.includes(cid));
  }

  /** 获取所有关卡 */
  getChallenges(): BattleChallenge[] {
    return Array.from(this.challenges.values());
  }

  /** 获取当前可挑战的关卡 */
  getAvailableChallenges(playerLevel: number, completedIds: string[], heroCount: number): BattleChallenge[] {
    return this.getChallenges().filter((c) => this.canChallenge(c.id, playerLevel, completedIds, heroCount));
  }

  /** 获取当前进行中的挑战 */
  getActiveChallenge(): BattleChallenge | null {
    return this.activeChallenge;
  }

  getCurrentWave(): number {
    return this.currentWave;
  }

  getBattleTime(): number {
    return this.battleTime;
  }

  // ─── 战斗流程 ──────────────────────────────────────

  /** 开始挑战 */
  startChallenge(id: string, heroes: PlayerHero[]): BattleChallenge | null {
    if (this.activeChallenge) return null; // 已有进行中的挑战
    const template = this.challenges.get(id);
    if (!template) return null;

    // 深拷贝关卡数据，避免修改原始模板
    const challenge: BattleChallenge = {
      ...template,
      waves: template.waves.map((w) => ({
        ...w,
        enemies: w.enemies.map((e) => ({ ...e })),
      })),
    };

    this.activeChallenge = challenge;
    this.currentWave = 0;
    this.battleTime = 0;
    this.playerHeroes = heroes.map((h) => ({ ...h }));
    this.buffTimers.clear();
    this.npcHp = 500; // 保护 NPC 初始生命
    this.captureProgress = 0;
    return challenge;
  }

  /** 每帧更新战斗状态 */
  updateBattle(deltaTime: number): { event: string; data?: any }[] {
    const events: { event: string; data?: any }[] = [];
    if (!this.activeChallenge) return events;

    this.battleTime += deltaTime;

    // 更新增益计时器
    for (const [heroId, remaining] of this.buffTimers) {
      const newRemaining = remaining - deltaTime;
      if (newRemaining <= 0) {
        this.buffTimers.delete(heroId);
        events.push({ event: 'buff_expired', data: { heroId } });
      } else {
        this.buffTimers.set(heroId, newRemaining);
      }
    }

    // 敌人自动攻击存活英雄
    const currentEnemies = this.getCurrentWaveEnemies();
    const aliveHeroes = this.playerHeroes.filter((h) => h.hp > 0);
    for (const enemy of currentEnemies) {
      if (!enemy.isAlive || aliveHeroes.length === 0) continue;
      const target = aliveHeroes[Math.floor(Math.random() * aliveHeroes.length)];
      const rawDamage = Math.max(1, enemy.attack - target.defense * 0.5);
      const damage = Math.round(rawDamage);
      target.hp = Math.max(0, target.hp - damage);
      events.push({ event: 'enemy_attack', data: { enemyId: enemy.id, targetId: target.id, damage } });
      if (target.hp <= 0) {
        events.push({ event: 'hero_defeated', data: { heroId: target.id } });
      }
    }

    // protect_npc: 敌人也会攻击 NPC
    if (this.activeChallenge.objective === 'protect_npc' && currentEnemies.some((e) => e.isAlive)) {
      const npcDamage = Math.round(currentEnemies.filter((e) => e.isAlive).length * 5);
      this.npcHp = Math.max(0, this.npcHp - npcDamage);
      events.push({ event: 'npc_damaged', data: { npcHp: this.npcHp } });
    }

    // capture_point: 存活英雄自动推进占领
    if (this.activeChallenge.objective === 'capture_point') {
      this.captureProgress += aliveHeroes.length * deltaTime * 2;
      events.push({ event: 'capture_progress', data: { progress: Math.min(this.captureProgress, 100) } });
    }

    return events;
  }

  // ─── 玩家操作 ──────────────────────────────────────

  /** 玩家普通攻击 */
  playerAttack(targetId: string): { damage: number; isCrit: boolean; isMiss: boolean } {
    if (!this.activeChallenge) return { damage: 0, isCrit: false, isMiss: false };

    const enemies = this.getCurrentWaveEnemies();
    const target = enemies.find((e) => e.id === targetId && e.isAlive);
    if (!target) return { damage: 0, isCrit: false, isMiss: false };

    // 闪避判定 5%
    if (Math.random() < 0.05) {
      return { damage: 0, isCrit: false, isMiss: true };
    }

    // 计算基础伤害（取英雄平均攻击力）
    const avgAttack = this.getAverageAttack();
    const rawDamage = Math.max(1, avgAttack - target.defense * 0.5);

    // 暴击判定 10%
    const isCrit = Math.random() < 0.1;
    const damage = Math.round(isCrit ? rawDamage * 2 : rawDamage);

    target.hp = Math.max(0, target.hp - damage);
    if (target.hp <= 0) {
      target.isAlive = false;
    }

    return { damage, isCrit, isMiss: false };
  }

  /** 玩家技能 */
  playerSkill(heroId: string, skillType: 'fire' | 'combo' | 'heal' | 'buff', targetId: string): { damage: number; effect: string } {
    if (!this.activeChallenge) return { damage: 0, effect: '无效' };

    const hero = this.playerHeroes.find((h) => h.id === heroId);
    if (!hero || hero.hp <= 0) return { damage: 0, effect: '英雄已阵亡' };

    switch (skillType) {
      case 'fire': {
        // 火攻：对所有存活敌人造成当前 HP 30% 的伤害
        const enemies = this.getCurrentWaveEnemies().filter((e) => e.isAlive);
        let totalDamage = 0;
        for (const enemy of enemies) {
          const dmg = Math.round(enemy.hp * 0.3);
          enemy.hp = Math.max(0, enemy.hp - dmg);
          totalDamage += dmg;
          if (enemy.hp <= 0) enemy.isAlive = false;
        }
        return { damage: totalDamage, effect: `火攻波及 ${enemies.length} 名敌人` };
      }
      case 'combo': {
        // 连击：对目标造成 攻击×3 的伤害
        const target = this.getCurrentWaveEnemies().find((e) => e.id === targetId && e.isAlive);
        if (!target) return { damage: 0, effect: '目标不存在' };
        const damage = Math.round(Math.max(1, hero.attack * 3 - target.defense * 0.5));
        target.hp = Math.max(0, target.hp - damage);
        if (target.hp <= 0) target.isAlive = false;
        return { damage, effect: '连击三段' };
      }
      case 'heal': {
        // 治疗：恢复全体英雄 30% maxHp
        let totalHealed = 0;
        for (const h of this.playerHeroes) {
          if (h.hp > 0) {
            const heal = Math.round(h.maxHp * 0.3);
            h.hp = Math.min(h.maxHp, h.hp + heal);
            totalHealed += heal;
          }
        }
        return { damage: 0, effect: `全体恢复 ${totalHealed} HP` };
      }
      case 'buff': {
        // 增益：攻击 +50% 持续 10 秒
        this.buffTimers.set(heroId, 10);
        return { damage: 0, effect: `${hero.name} 攻击力提升 50%，持续 10 秒` };
      }
    }
  }

  /** 结算挑战 */
  settleChallenge(won: boolean, timeUsed: number): { rewards: BattleRewards; stars: number } {
    const challenge = this.activeChallenge;
    const emptyRewards: BattleRewards = { food: 0, gold: 0, troops: 0, heroExp: 0 };

    if (!challenge || !won) {
      this.activeChallenge = null;
      return { rewards: emptyRewards, stars: 0 };
    }

    // 星级评价
    let stars: 0 | 1 | 2 | 3;
    if (timeUsed < 30) stars = 3;
    else if (timeUsed < 60) stars = 2;
    else stars = 1;

    // 更新关卡记录
    const saved = this.challenges.get(challenge.id);
    if (saved) {
      saved.isCompleted = true;
      if (saved.bestTime === undefined || timeUsed < saved.bestTime) {
        saved.bestTime = timeUsed;
      }
      if (stars > saved.stars) {
        saved.stars = stars;
      }
    }

    this.activeChallenge = null;
    return { rewards: { ...challenge.rewards }, stars };
  }

  // ─── 序列化 ────────────────────────────────────────

  serialize(): object {
    const challengeData: Record<string, object> = {};
    for (const [id, c] of this.challenges) {
      challengeData[id] = {
        isCompleted: c.isCompleted,
        bestTime: c.bestTime,
        stars: c.stars,
      };
    }
    return { challenges: challengeData };
  }

  deserialize(data: any): void {
    if (!data?.challenges) return;
    for (const [id, state] of Object.entries(data.challenges) as [string, any][]) {
      const challenge = this.challenges.get(id);
      if (challenge) {
        challenge.isCompleted = !!state.isCompleted;
        challenge.bestTime = state.bestTime ?? undefined;
        challenge.stars = (state.stars ?? 0) as 0 | 1 | 2 | 3;
      }
    }
  }

  // ─── 内部辅助 ──────────────────────────────────────

  /** 获取当前波次的敌人 */
  private getCurrentWaveEnemies(): BattleEnemy[] {
    if (!this.activeChallenge || this.currentWave >= this.activeChallenge.waves.length) return [];
    return this.activeChallenge.waves[this.currentWave].enemies;
  }

  /** 获取英雄平均攻击力（含增益） */
  private getAverageAttack(): number {
    const alive = this.playerHeroes.filter((h) => h.hp > 0);
    if (alive.length === 0) return 0;
    const total = alive.reduce((sum, h) => {
      const buffMultiplier = this.buffTimers.has(h.id) ? 1.5 : 1;
      return sum + h.attack * buffMultiplier;
    }, 0);
    return total / alive.length;
  }
}
