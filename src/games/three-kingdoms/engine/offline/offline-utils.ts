/**
 * 离线收益域 — 共享工具函数
 *
 * 统一管理 offline 域各子系统共用的资源操作工具函数，
 * 消除 OfflineRewardSystem / OfflineRewardEngine / OfflineTradeAndBoost / OfflineEstimateSystem 中的重复定义。
 *
 * @module engine/offline/offline-utils
 */

import type { Resources } from '../../shared/types';

// ─────────────────────────────────────────────
// 资源操作工具
// ─────────────────────────────────────────────

/** 创建零资源对象 */
export function zeroRes(): Resources {
  return { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
}

/** 克隆资源对象（浅拷贝） */
export function cloneRes(r: Readonly<Resources>): Resources {
  return { ...r };
}

/** 两个资源对象相加，返回新对象 */
export function addRes(a: Resources, b: Readonly<Resources>): Resources {
  return {
    grain: a.grain + b.grain,
    gold: a.gold + b.gold,
    troops: a.troops + b.troops,
    mandate: a.mandate + b.mandate,
    techPoint: a.techPoint + b.techPoint,
    recruitToken: a.recruitToken + b.recruitToken,
  };
}

/** 资源对象乘以标量，返回新对象 */
export function mulRes(r: Readonly<Resources>, f: number): Resources {
  return {
    grain: r.grain * f,
    gold: r.gold * f,
    troops: r.troops * f,
    mandate: r.mandate * f,
    techPoint: r.techPoint * f,
    recruitToken: r.recruitToken * f,
  };
}

/** 资源对象各字段向下取整，返回新对象 */
export function floorRes(r: Resources): Resources {
  return {
    grain: Math.floor(r.grain),
    gold: Math.floor(r.gold),
    troops: Math.floor(r.troops),
    mandate: Math.floor(r.mandate),
    techPoint: Math.floor(r.techPoint),
    recruitToken: Math.floor(r.recruitToken),
  };
}
