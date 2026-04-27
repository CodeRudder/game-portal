/**
 * 存档数据修复器 — 基于蓝图（默认数据）递归补全存档
 *
 * 核心思路：引擎初始化时各子系统已创建默认状态，
 * buildSaveData() 可序列化出完整的默认 GameSaveData（蓝图）。
 * 加载存档后，用蓝图与存档数据递归合并：
 * - 缺失字段 → 蓝图默认值
 * - 类型错误 → 蓝图默认值
 * - NaN/Infinity → 蓝图默认值
 * - 正确值 → 保持不变
 *
 * @module core/save/SaveDataRepair
 */

import type { GameSaveData } from '../../shared/types';
import { gameLog } from '../logger';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 单条修复日志 */
export interface RepairLog {
  /** 字段路径（如 "resource.resources.grain"） */
  field: string;
  /** 修复动作类型 */
  action: 'fill_missing' | 'fix_type' | 'fix_nan' | 'fix_negative';
  /** 修复前的值 */
  oldValue: unknown;
  /** 修复后的值（蓝图默认值） */
  newValue: unknown;
}

/** 修复结果 */
export interface RepairResult {
  /** 修复后的完整数据 */
  data: GameSaveData;
  /** 修复日志列表 */
  logs: RepairLog[];
  /** 是否执行了修复（logs.length > 0） */
  repaired: boolean;
}

// ─────────────────────────────────────────────
// 不应被修复的顶层字段（保留存档原值）
// ─────────────────────────────────────────────

const PRESERVED_TOP_LEVEL_KEYS = new Set(['version', 'saveTime']);

// ─────────────────────────────────────────────
// 主入口
// ─────────────────────────────────────────────

/**
 * 用蓝图递归修复存档数据
 *
 * @param loaded    从存档加载的数据（可能残缺或含错误值）
 * @param blueprint 引擎默认生成的完整数据（蓝图）
 * @returns 修复结果，包含修复后的数据、日志和是否修复标记
 */
export function repairWithBlueprint(
  loaded: unknown,
  blueprint: GameSaveData,
): RepairResult {
  const logs: RepairLog[] = [];

  // 如果 loaded 本身为 null/undefined/非对象，直接返回蓝图
  if (loaded === null || loaded === undefined || typeof loaded !== 'object') {
    return { data: structuredClone(blueprint), logs: [], repaired: false };
  }

  const repaired = deepMergeWithRepair(
    loaded,
    blueprint,
    '',
    logs,
  ) as GameSaveData;

  return {
    data: repaired,
    logs,
    repaired: logs.length > 0,
  };
}

// ─────────────────────────────────────────────
// 递归合并核心
// ─────────────────────────────────────────────

/**
 * 递归深度合并：用 blueprint 补全 loaded
 *
 * @param loaded         存档中的值
 * @param blueprintValue 蓝图中的值
 * @param path           当前字段路径（用于日志）
 * @param logs           修复日志收集器
 * @returns 合并后的值
 */
function deepMergeWithRepair(
  loaded: unknown,
  blueprintValue: unknown,
  path: string,
  logs: RepairLog[],
): unknown {
  // ── 1. 蓝图值为 null/undefined → 直接返回存档值（无需修复） ──
  if (blueprintValue === null || blueprintValue === undefined) {
    return loaded;
  }

  // ── 2. 存档值缺失 → 用蓝图补全 ──
  if (loaded === undefined) {
    logs.push({
      field: path,
      action: 'fill_missing',
      oldValue: undefined,
      newValue: blueprintValue,
    });
    return structuredClone(blueprintValue);
  }

  // ── 3. 存档值为 null → 保留 null（可能是合法的"无数据"） ──
  if (loaded === null) {
    return null;
  }

  // ── 4. 类型不匹配 → 用蓝图值替换 ──
  if (typeof loaded !== typeof blueprintValue) {
    logs.push({
      field: path,
      action: 'fix_type',
      oldValue: loaded,
      newValue: blueprintValue,
    });
    return structuredClone(blueprintValue);
  }

  // ── 5. 蓝图是对象 → 递归合并 ──
  if (typeof blueprintValue === 'object' && !Array.isArray(blueprintValue)) {
    // 存档值也必须是普通对象
    if (typeof loaded === 'object' && loaded !== null && !Array.isArray(loaded)) {
      return mergeObjects(
        loaded as Record<string, unknown>,
        blueprintValue as Record<string, unknown>,
        path,
        logs,
      );
    }
    // 类型不一致（如 blueprint 是对象但 loaded 是数组）
    return loaded;
  }

  // ── 6. 蓝图是数组 → 数组合并 ──
  if (Array.isArray(blueprintValue)) {
    if (Array.isArray(loaded)) {
      return mergeArrays(loaded, blueprintValue, path, logs);
    }
    return loaded;
  }

  // ── 7. number 类型 → 检查 NaN/Infinity/负数 ──
  if (typeof blueprintValue === 'number' && typeof loaded === 'number') {
    return validateNumber(loaded, blueprintValue, path, logs);
  }

  // ── 8. string 类型 → 检查空字符串（仅当蓝图非空时） ──
  if (typeof blueprintValue === 'string') {
    if (blueprintValue !== '' && loaded === '') {
      logs.push({
        field: path,
        action: 'fill_missing',
        oldValue: '',
        newValue: blueprintValue,
      });
      return blueprintValue;
    }
    return loaded;
  }

  // ── 9. boolean → 直接接受 ──
  return loaded;
}

// ─────────────────────────────────────────────
// 对象合并
// ─────────────────────────────────────────────

/**
 * 递归合并两个普通对象
 *
 * - 遍历蓝图所有 key，对存档缺失/错误的 key 进行补全
 * - 保留存档中已有的正确字段
 * - 保留存档中蓝图不存在的额外字段（向前兼容）
 */
function mergeObjects(
  loaded: Record<string, unknown>,
  blueprint: Record<string, unknown>,
  parentPath: string,
  logs: RepairLog[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // ── 合并蓝图中的所有字段 ──
  for (const key of Object.keys(blueprint)) {
    const fieldPath = parentPath ? `${parentPath}.${key}` : key;

    // 顶层保留字段：version / saveTime 不修复
    if (parentPath === '' && PRESERVED_TOP_LEVEL_KEYS.has(key)) {
      result[key] = key in loaded ? loaded[key] : blueprint[key];
      continue;
    }

    const loadedVal = key in loaded ? loaded[key] : undefined;
    result[key] = deepMergeWithRepair(loadedVal, blueprint[key], fieldPath, logs);
  }

  // ── 保留存档中蓝图没有的额外字段（向前兼容） ──
  for (const key of Object.keys(loaded)) {
    if (!(key in result)) {
      result[key] = loaded[key];
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// 数组合并
// ─────────────────────────────────────────────

/**
 * 数组合并策略：
 * - 存档数组长度 < 蓝图 → 保留存档前部，用蓝图补全尾部
 * - 存档数组长度 >= 蓝图 → 保留存档（已有更多数据）
 * - 逐元素递归合并（如果元素是对象/数组）
 */
function mergeArrays(
  loaded: unknown[],
  blueprint: unknown[],
  path: string,
  logs: RepairLog[],
): unknown[] {
  const result: unknown[] = [];

  // 逐元素合并
  const maxLen = Math.max(loaded.length, blueprint.length);
  for (let i = 0; i < maxLen; i++) {
    const itemPath = `${path}[${i}]`;
    const loadedItem = i < loaded.length ? loaded[i] : undefined;
    const blueprintItem = i < blueprint.length ? blueprint[i] : undefined;

    if (i >= loaded.length && blueprintItem !== undefined) {
      // 存档数组不够长，用蓝图补全
      logs.push({
        field: itemPath,
        action: 'fill_missing',
        oldValue: undefined,
        newValue: blueprintItem,
      });
      result.push(structuredClone(blueprintItem));
    } else if (i >= blueprint.length) {
      // 蓝图数组不够长，保留存档的额外元素
      result.push(loadedItem);
    } else {
      // 两边都有，递归合并
      result.push(deepMergeWithRepair(loadedItem, blueprintItem, itemPath, logs));
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// 数值校验
// ─────────────────────────────────────────────

/**
 * 校验 number 类型的值
 *
 * 检查 NaN、Infinity、以及资源类字段的负数
 */
function validateNumber(
  loaded: number,
  blueprintValue: number,
  path: string,
  logs: RepairLog[],
): number {
  // NaN 检查
  if (Number.isNaN(loaded)) {
    logs.push({
      field: path,
      action: 'fix_nan',
      oldValue: loaded,
      newValue: blueprintValue,
    });
    return blueprintValue;
  }

  // Infinity 检查
  if (!Number.isFinite(loaded)) {
    logs.push({
      field: path,
      action: 'fix_nan',
      oldValue: loaded,
      newValue: blueprintValue,
    });
    return blueprintValue;
  }

  // 负数检查：仅对资源值路径下的字段检查
  if (loaded < 0 && isResourceValuePath(path)) {
    logs.push({
      field: path,
      action: 'fix_negative',
      oldValue: loaded,
      newValue: blueprintValue,
    });
    return blueprintValue;
  }

  return loaded;
}

// ─────────────────────────────────────────────
// 路径判断辅助
// ─────────────────────────────────────────────

/**
 * 判断路径是否为资源数值路径
 *
 * 匹配模式：
 * - "resource.resources.grain"
 * - "resource.resources.gold"
 * - "resource.resources.troops"
 * - "resource.resources.mandate"
 * - "resource.resources.techPoint"
 * - "resource.resources.recruitToken"
 * - "resource.lastSaveTime"
 * - "resource.productionRates.xxx"
 * - "resource.caps.xxx"
 */
function isResourceValuePath(path: string): boolean {
  // 匹配 resource.resources.* 下的数值字段
  if (/^resource\.resources\./.test(path)) {
    return true;
  }
  // 匹配 resource.caps.* 和 resource.productionRates.*
  if (/^resource\.(caps|productionRates)\./.test(path)) {
    return true;
  }
  // 匹配 lastSaveTime
  if (path === 'resource.lastSaveTime') {
    return true;
  }
  return false;
}
