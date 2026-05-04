/**
 * 战斗→医馆桥接 — XI-015 跨系统链路
 *
 * 职责：在战斗结算后，将伤兵从 BattleCasualtySystem 转发到 ClinicTreatmentSystem
 * 设计：
 *   - 使用回调模式注入，不直接依赖具体类
 *   - 不修改纯函数
 *   - 向后兼容：无注入时为空操作
 *
 * @module engine/battle/BattleClinicBridge
 */

import { BattleCasualtySystem } from './BattleCasualtySystem';

/** 伤兵接收接口（ClinicTreatmentSystem.addWounded 的最小接口） */
export interface WoundedReceiver {
  addWounded(count: number): void;
}

/**
 * 战斗→医馆桥接函数
 *
 * 在战斗结算后调用，自动将伤兵发送到医馆治疗系统。
 *
 * @param casualtySystem - 战斗伤亡系统
 * @param battleResult   - 战斗结果 { victory, troopCount }
 * @param clinicReceiver - 医馆接收接口（可选，未注入时跳过）
 * @returns 伤亡明细 { killed, wounded }
 */
export function bridgeBattleCasualtiesToClinic(
  casualtySystem: BattleCasualtySystem,
  battleResult: { victory: boolean; troopCount: number },
  clinicReceiver?: WoundedReceiver | null,
): { killed: number; wounded: number } {
  const { killed, wounded } = casualtySystem.computeCasualties(battleResult);

  // XI-015: 将伤兵转发到医馆
  if (wounded > 0 && clinicReceiver) {
    clinicReceiver.addWounded(wounded);
  }

  return { killed, wounded };
}
