/**
 * Equipment - re-exports
 *
 * Extracted from EquipmentSystem.ts.
 */

import { EquipmentBagManager } from './EquipmentBagManager';
import { EquipmentDecomposer } from './EquipmentDecomposer';
import * as genHelper from './EquipmentGenHelper';
import { weightedPickRarity, seedPick } from './EquipmentGenHelper';

// ─────────────────────────────────────────────
// 重新导出生成辅助函数（保持向后兼容）

export { generateUid, resetUidCounter, weightedPickRarity } from './EquipmentGenHelper';
