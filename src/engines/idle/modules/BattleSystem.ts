/**
 * BattleSystem — 放置游戏战斗波次系统核心模块（P2）
 *
 * 提供波次管理、敌人实例化、攻击伤害计算、Buff 管理、
 * 掉落掷骰、结算、统计追踪、存档/读档等完整战斗功能。
 * 使用泛型 BattleSystem<Def> 允许游戏自定义扩展 BattleDef。
 *
 * @module engines/idle/modules/BattleSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 敌人定义 */
export interface EnemyDef {
  id: string; name: string; hp: number; attack: number; defense: number;
  drops: Record<string, number>; abilities: string[]; isBoss: boolean;
}

/** 战斗波次定义 */
export interface BattleDef {
  id: string; stageId: string; wave: number; enemies: EnemyDef[];
  rewards: Record<string, number>; timeLimit: number; nextWave?: string;
  tags: string[];
}

/** 战斗 Buff/Debuff */
export interface BattleBuff {
  id: string; type: 'buff' | 'debuff'; stat: string; value: number;
  remainingMs: number;
}

/** 敌人运行时实例 */
export interface BattleEnemy {
  defId: string; instanceId: string; currentHp: number; maxHp: number;
  isAlive: boolean; buffs: BattleBuff[];
}

/** 战斗统计 */
export interface BattleStats {
  totalDamageDealt: number; totalDamageTaken: number;
  wavesCleared: number; bossesDefeated: number;
}

/** 战斗系统持久化状态 */
export interface BattleState {
  currentWave: string | null; aliveEnemies: BattleEnemy[];
  killCount: number; waveStartTime: number; stats: BattleStats;
}

/** 战斗事件 */
export interface BattleEvent {
  type: 'wave_started' | 'wave_cleared' | 'wave_failed' | 'enemy_killed'
    | 'boss_defeated' | 'loot_dropped' | 'player_damaged';
  data?: Record<string, unknown>;
}

// ============================================================
// 辅助函数
// ============================================================

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

let instanceCounter = 0;
function genInstanceId(defId: string): string {
  return `${defId}_${Date.now()}_${++instanceCounter}`;
}

/** 掷骰判定掉落（drops 中 value 为 0~1 概率） */
function rollDrops(drops: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [item, chance] of Object.entries(drops)) {
    if (Math.random() < chance) result[item] = (result[item] || 0) + 1;
  }
  return result;
}

function mergeRecords(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const r: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) r[k] = (r[k] || 0) + v;
  return r;
}

// ============================================================
// BattleSystem
// ============================================================

/**
 * 战斗波次系统 — 管理波次注册、敌人实例化、攻击、Buff、掉落结算
 * @typeParam Def - 波次定义类型，必须继承 BattleDef
 */
export class BattleSystem<Def extends BattleDef = BattleDef> {
  private waveDefs = new Map<string, Def>();
  private currentWave: string | null = null;
  private aliveEnemies: BattleEnemy[] = [];
  private killCount = 0;
  private waveStartTime = 0;
  private pendingDrops: Record<string, number> = {};
  private stats: BattleStats = {
    totalDamageDealt: 0, totalDamageTaken: 0,
    wavesCleared: 0, bossesDefeated: 0,
  };
  private listeners: ((event: BattleEvent) => void)[] = [];

  constructor(defs: Def[] = []) {
    for (const d of defs) this.waveDefs.set(d.id, d);
  }

  // ---- startWave ----

  startWave(waveId: string): boolean {
    const def = this.waveDefs.get(waveId);
    if (!def) return false;
    this.currentWave = waveId;
    this.aliveEnemies = def.enemies.map((e) => ({
      defId: e.id,
      instanceId: genInstanceId(e.id),
      currentHp: e.hp, maxHp: e.hp,
      isAlive: true, buffs: [],
    }));
    this.killCount = 0;
    this.waveStartTime = Date.now();
    this.pendingDrops = {};
    this.emit({ type: 'wave_started', data: { waveId, enemyCount: def.enemies.length } });
    return true;
  }

  // ---- attack ----

  attack(enemyInstanceId: string, damage: number): { killed: boolean; damage: number } {
    const enemy = this.aliveEnemies.find((e) => e.instanceId === enemyInstanceId);
    if (!enemy || !enemy.isAlive) return { killed: false, damage: 0 };

    const actual = Math.max(1, damage);
    enemy.currentHp = Math.max(0, enemy.currentHp - actual);
    this.stats.totalDamageDealt += actual;

    if (enemy.currentHp <= 0) {
      enemy.isAlive = false;
      this.killCount++;
      this.emit({ type: 'enemy_killed', data: { instanceId: enemyInstanceId } });

      const def = this.findEnemyDef(enemy.defId);
      if (def?.isBoss) {
        this.stats.bossesDefeated++;
        this.emit({ type: 'boss_defeated', data: { instanceId: enemyInstanceId } });
      }
      if (def) {
        const drops = rollDrops(def.drops);
        if (Object.keys(drops).length > 0) {
          this.pendingDrops = mergeRecords(this.pendingDrops, drops);
          this.emit({ type: 'loot_dropped', data: { instanceId: enemyInstanceId, drops } });
        }
      }
      return { killed: true, damage: actual };
    }
    return { killed: false, damage: actual };
  }

  // ---- enemyAttack ----

  enemyAttack(enemyDefId: string, targetDefense: number): number {
    const def = this.findEnemyDef(enemyDefId);
    if (!def) return 1;
    const dmg = Math.max(1, def.attack - targetDefense / 2);
    this.stats.totalDamageTaken += dmg;
    this.emit({ type: 'player_damaged', data: { enemyDefId, damage: dmg } });
    return dmg;
  }

  // ---- checkWin / checkLose ----

  checkWin(): boolean {
    if (!this.currentWave) return false;
    return this.aliveEnemies.length > 0 && this.aliveEnemies.every((e) => !e.isAlive);
  }

  checkLose(playerHp: number): boolean {
    return playerHp <= 0;
  }

  // ---- update (buff 倒计时) ----

  update(dt: number): void {
    if (!this.currentWave) return;
    for (const enemy of this.aliveEnemies) {
      if (!enemy.isAlive) continue;
      for (const buff of enemy.buffs) buff.remainingMs -= dt;
      enemy.buffs = enemy.buffs.filter((b) => b.remainingMs > 0);
    }
  }

  // ---- getRewardsPreview ----

  getRewardsPreview(): Record<string, number> {
    if (!this.currentWave) return {};
    return { ...(this.waveDefs.get(this.currentWave)?.rewards || {}) };
  }

  // ---- settleWave ----

  settleWave(): { rewards: Record<string, number>; drops: Record<string, number> } {
    const won = this.checkWin();
    if (won) {
      this.stats.wavesCleared++;
      this.emit({ type: 'wave_cleared', data: { waveId: this.currentWave } });
    } else {
      this.emit({ type: 'wave_failed', data: { waveId: this.currentWave } });
    }
    const rewards = won ? { ...(this.waveDefs.get(this.currentWave!)?.rewards || {}) } : {};
    const drops = { ...this.pendingDrops };
    this.currentWave = null;
    this.aliveEnemies = [];
    this.pendingDrops = {};
    return { rewards, drops };
  }

  // ---- getCurrentState ----

  getCurrentState(): BattleState {
    return {
      currentWave: this.currentWave,
      aliveEnemies: deepClone(this.aliveEnemies.filter((e) => e.isAlive)),
      killCount: this.killCount,
      waveStartTime: this.waveStartTime,
      stats: { ...this.stats },
    };
  }

  // ---- saveState / loadState ----

  saveState(): Record<string, unknown> {
    return {
      currentWave: this.currentWave,
      aliveEnemies: deepClone(this.aliveEnemies),
      killCount: this.killCount,
      waveStartTime: this.waveStartTime,
      pendingDrops: { ...this.pendingDrops },
      stats: { ...this.stats },
    };
  }

  loadState(data: Record<string, unknown>): void {
    if (!data || typeof data !== 'object') return;

    // currentWave: string | null
    this.currentWave = typeof data.currentWave === 'string' ? data.currentWave : null;

    // aliveEnemies: BattleEnemy[] — 校验每个元素的基本结构
    this.aliveEnemies = Array.isArray(data.aliveEnemies)
      ? (data.aliveEnemies as unknown[]).filter(
          (e): e is Record<string, unknown> =>
            typeof e === 'object' && e !== null,
        ).map((e) => ({
          defId: typeof e.defId === 'string' ? e.defId : '',
          instanceId: typeof e.instanceId === 'string' ? e.instanceId : '',
          currentHp: typeof e.currentHp === 'number' ? Math.max(0, e.currentHp) : 0,
          maxHp: typeof e.maxHp === 'number' ? Math.max(1, e.maxHp) : 1,
          isAlive: typeof e.isAlive === 'boolean' ? e.isAlive : false,
          buffs: Array.isArray(e.buffs)
            ? (e.buffs as unknown[]).filter(
                (b): b is Record<string, unknown> =>
                  typeof b === 'object' && b !== null,
              ).map((b) => ({
                id: typeof b.id === 'string' ? b.id : '',
                type: b.type === 'buff' || b.type === 'debuff' ? b.type : 'buff',
                stat: typeof b.stat === 'string' ? b.stat : '',
                value: typeof b.value === 'number' ? b.value : 0,
                remainingMs: typeof b.remainingMs === 'number' ? b.remainingMs : 0,
              }))
            : [],
        }))
      : [];

    // killCount: number (>= 0)
    this.killCount = typeof data.killCount === 'number' ? Math.max(0, data.killCount) : 0;

    // waveStartTime: number (>= 0)
    this.waveStartTime = typeof data.waveStartTime === 'number' ? Math.max(0, data.waveStartTime) : 0;

    // pendingDrops: Record<string, number>
    this.pendingDrops =
      typeof data.pendingDrops === 'object' && data.pendingDrops !== null && !Array.isArray(data.pendingDrops)
        ? Object.fromEntries(
            Object.entries(data.pendingDrops as Record<string, unknown>).filter(
              ([, v]) => typeof v === 'number',
            ) as [string, number][],
          )
        : {};

    // stats: BattleStats
    if (typeof data.stats === 'object' && data.stats !== null && !Array.isArray(data.stats)) {
      const s = data.stats as Record<string, unknown>;
      this.stats = {
        totalDamageDealt: typeof s.totalDamageDealt === 'number' ? Math.max(0, s.totalDamageDealt) : 0,
        totalDamageTaken: typeof s.totalDamageTaken === 'number' ? Math.max(0, s.totalDamageTaken) : 0,
        wavesCleared: typeof s.wavesCleared === 'number' ? Math.max(0, s.wavesCleared) : 0,
        bossesDefeated: typeof s.bossesDefeated === 'number' ? Math.max(0, s.bossesDefeated) : 0,
      };
    } else {
      this.stats = { totalDamageDealt: 0, totalDamageTaken: 0, wavesCleared: 0, bossesDefeated: 0 };
    }
  }

  // ---- reset ----

  reset(): void {
    this.currentWave = null;
    this.aliveEnemies = [];
    this.killCount = 0;
    this.waveStartTime = 0;
    this.pendingDrops = {};
    this.stats = { totalDamageDealt: 0, totalDamageTaken: 0, wavesCleared: 0, bossesDefeated: 0 };
  }

  // ---- onEvent ----

  onEvent(callback: (event: BattleEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const i = this.listeners.indexOf(callback);
      if (i !== -1) this.listeners.splice(i, 1);
    };
  }

  // ---- 私有工具 ----

  private emit(event: BattleEvent): void {
    for (const fn of this.listeners) fn(event);
  }

  private findEnemyDef(defId: string): EnemyDef | undefined {
    for (const def of this.waveDefs.values()) {
      const found = def.enemies.find((e) => e.id === defId);
      if (found) return found;
    }
    return undefined;
  }
}
