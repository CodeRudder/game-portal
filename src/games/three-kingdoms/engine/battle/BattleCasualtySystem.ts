/**
 * 战斗伤亡系统 — 引擎层
 *
 * 职责：计算战斗伤亡、转发伤兵到医馆
 * 规则：
 *   - 胜利：killed=5%兵力, wounded=10%兵力
 *   - 失败：killed=15%兵力, wounded=25%兵力
 *
 * @module engine/battle/BattleCasualtySystem
 */

// ─────────────────────────────────────────────
// 伤亡比例常量
// ─────────────────────────────────────────────

/** 胜利阵亡比例 */
const WIN_KILLED_RATE = 0.05;
/** 胜利受伤比例 */
const WIN_WOUNDED_RATE = 0.10;
/** 失败阵亡比例 */
const LOSE_KILLED_RATE = 0.15;
/** 失败受伤比例 */
const LOSE_WOUNDED_RATE = 0.25;

// ─────────────────────────────────────────────
// 伤亡报告
// ─────────────────────────────────────────────

export interface CasualtyReport {
  /** 总阵亡数 */
  totalKilled: number;
  /** 总受伤数 */
  totalWounded: number;
  /** 战斗次数 */
  battles: number;
}

// ─────────────────────────────────────────────
// 战斗伤亡系统
// ─────────────────────────────────────────────

export class BattleCasualtySystem {
  /** 总阵亡数 */
  private totalKilled: number = 0;
  /** 总受伤数 */
  private totalWounded: number = 0;
  /** 战斗次数 */
  private battles: number = 0;

  /**
   * 计算战斗伤亡
   *
   * @param battleResult - 战斗结果，需包含 victory(boolean) 和 troopCount(number)
   * @returns 伤亡明细 { killed, wounded }
   */
  computeCasualties(battleResult: {
    victory: boolean;
    troopCount: number;
  }): { killed: number; wounded: number } {
    const { victory, troopCount } = battleResult;

    let killed: number;
    let wounded: number;

    if (victory) {
      killed = Math.floor(troopCount * WIN_KILLED_RATE);
      wounded = Math.floor(troopCount * WIN_WOUNDED_RATE);
    } else {
      killed = Math.floor(troopCount * LOSE_KILLED_RATE);
      wounded = Math.floor(troopCount * LOSE_WOUNDED_RATE);
    }

    // 确保不超过总兵力
    const totalCasualties = killed + wounded;
    if (totalCasualties > troopCount) {
      // 按比例缩减
      const scale = troopCount / totalCasualties;
      killed = Math.floor(killed * scale);
      wounded = troopCount - killed;
    }

    // 更新统计
    this.totalKilled += killed;
    this.totalWounded += wounded;
    this.battles += 1;

    return { killed, wounded };
  }

  /**
   * 将伤兵发送到医馆治疗系统
   *
   * @param wounded - 伤兵数量
   * @param clinicSystem - 医馆治疗系统实例（需有 addWounded 方法）
   */
  sendWoundedToClinic(wounded: number, clinicSystem: { addWounded: (count: number) => void }): void {
    if (wounded > 0) {
      clinicSystem.addWounded(wounded);
    }
  }

  /**
   * 获取伤亡报告
   */
  getCasualtyReport(): CasualtyReport {
    return {
      totalKilled: this.totalKilled,
      totalWounded: this.totalWounded,
      battles: this.battles,
    };
  }

  /**
   * 重置系统状态
   */
  reset(): void {
    this.totalKilled = 0;
    this.totalWounded = 0;
    this.battles = 0;
  }
}
