/**
 * 游戏数据校验器
 *
 * 校验 GameSaveData 的完整性和正确性，检测：必需字段缺失、数据类型错误、
 * 数据范围异常、子系统版本兼容性。
 *
 * @module core/save/GameDataValidator
 */

import type { GameSaveData } from '../../shared/types';
import { ENGINE_SAVE_VERSION } from '../../shared/constants';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 校验问题 */
export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  /** 字段路径，如 "resource.grain", "hero.generals" */
  field: string;
  message: string;
  /** 是否可自动修复 */
  autoFixable: boolean;
}

/** 校验报告 */
export interface ValidationReport {
  /** 是否通过校验（无 error 级别问题） */
  valid: boolean;
  issues: ValidationIssue[];
  stats: { errors: number; warnings: number; info: number };
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const MAX_BUILDING_LEVEL = 100;

const RESOURCE_FIELDS = ['grain', 'gold', 'troops', 'mandate', 'techPoint', 'recruitToken'] as const;

const BUILDING_TYPES = [
  'castle', 'farmland', 'market', 'barracks',
  'smithy', 'academy', 'clinic', 'wall',
] as const;

/** 可选子系统名称及最低引入版本 */
const OPTIONAL_SUBSYSTEMS: Record<string, number> = {
  calendar: 1, hero: 2, recruit: 2, formation: 2, campaign: 3, tech: 4,
  equipment: 5, equipmentForge: 10, equipmentEnhance: 10, trade: 5, shop: 5,
  prestige: 14, heritage: 14, achievement: 14,
  pvpArena: 7, pvpArenaShop: 7, pvpRanking: 7,
  eventTrigger: 7, eventNotification: 7, eventUI: 7, eventChain: 7, eventLog: 7,
  offlineEvent: 15, season: 16,
};

// ─────────────────────────────────────────────
// 数据校验器
// ─────────────────────────────────────────────

/**
 * 游戏数据校验器
 *
 * 对 GameSaveData 执行完整性校验，返回结构化的校验报告。
 *
 * @example
 * ```ts
 * const validator = new GameDataValidator();
 * const report = validator.validate(saveData);
 * if (!report.valid) {
 *   for (const issue of report.issues) {
 *     console.log(`[${issue.severity}] ${issue.field}: ${issue.message}`);
 *   }
 * }
 * ```
 */
export class GameDataValidator {
  /**
   * 校验游戏存档数据
   *
   * 执行全面校验：顶层结构 → 版本 → 必需子系统 → 可选子系统 → 武将
   */
  validate(data: unknown): ValidationReport {
    const issues: ValidationIssue[] = [];

    // 1. 顶层结构校验
    issues.push(...this.validateTopLevel(data));
    if (issues.some(i => i.severity === 'error')) {
      return this.buildReport(issues);
    }

    const saveData = data as GameSaveData;

    // 2. 版本校验
    issues.push(...this.validateVersion(saveData));

    // 3. 必需子系统校验
    issues.push(...this.validateResource(saveData.resource));
    issues.push(...this.validateBuilding(saveData.building));

    // 4. 可选子系统校验
    issues.push(...this.validateOptionalSubsystems(saveData));

    // 5. 武将子系统校验（如果存在）
    if (saveData.hero) {
      issues.push(...this.validateHero(saveData.hero));
    }

    return this.buildReport(issues);
  }

  /** 校验资源子系统数据 */
  validateResource(data: unknown): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (data === null || data === undefined || typeof data !== 'object') {
      issues.push({ severity: 'error', field: 'resource', message: 'resource 数据缺失或类型错误', autoFixable: false });
      return issues;
    }

    const res = data as Record<string, unknown>;

    if (!res.resources || typeof res.resources !== 'object') {
      issues.push({ severity: 'error', field: 'resource.resources', message: 'resources 字段缺失或类型错误', autoFixable: true });
    } else {
      const resources = res.resources as Record<string, unknown>;
      for (const field of RESOURCE_FIELDS) {
        if (typeof resources[field] !== 'number') {
          issues.push({
            severity: 'error', field: `resource.resources.${field}`,
            message: `${field} 应为 number 类型，实际为 ${typeof resources[field]}`, autoFixable: true,
          });
        } else if ((resources[field] as number) < 0) {
          issues.push({ severity: 'warning', field: `resource.resources.${field}`, message: `${field} 为负数: ${resources[field]}`, autoFixable: true });
        } else if (!isFinite(resources[field] as number)) {
          issues.push({ severity: 'error', field: `resource.resources.${field}`, message: `${field} 为非有限数: ${resources[field]}`, autoFixable: true });
        }
      }
    }

    if (typeof res.lastSaveTime !== 'number') {
      issues.push({ severity: 'warning', field: 'resource.lastSaveTime', message: 'lastSaveTime 缺失或类型错误', autoFixable: true });
    } else if ((res.lastSaveTime as number) < 0) {
      issues.push({ severity: 'warning', field: 'resource.lastSaveTime', message: `lastSaveTime 为负数: ${res.lastSaveTime}`, autoFixable: true });
    }

    if (!res.productionRates || typeof res.productionRates !== 'object') {
      issues.push({ severity: 'warning', field: 'resource.productionRates', message: 'productionRates 缺失或类型错误', autoFixable: true });
    }

    if (!res.caps || typeof res.caps !== 'object') {
      issues.push({ severity: 'warning', field: 'resource.caps', message: 'caps 缺失或类型错误', autoFixable: true });
    }

    return issues;
  }

  /** 校验建筑子系统数据 */
  validateBuilding(data: unknown): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (data === null || data === undefined || typeof data !== 'object') {
      issues.push({ severity: 'error', field: 'building', message: 'building 数据缺失或类型错误', autoFixable: false });
      return issues;
    }

    const bld = data as Record<string, unknown>;

    if (!bld.buildings || typeof bld.buildings !== 'object') {
      issues.push({ severity: 'error', field: 'building.buildings', message: 'buildings 字段缺失或类型错误', autoFixable: false });
      return issues;
    }

    const buildings = bld.buildings as Record<string, unknown>;

    for (const type of BUILDING_TYPES) {
      const building = buildings[type];
      if (!building || typeof building !== 'object') {
        issues.push({ severity: 'error', field: `building.buildings.${type}`, message: `建筑 ${type} 数据缺失`, autoFixable: true });
        continue;
      }

      const state = building as Record<string, unknown>;

      if (typeof state.level !== 'number') {
        issues.push({ severity: 'error', field: `building.buildings.${type}.level`, message: `${type}.level 应为 number 类型`, autoFixable: true });
      } else if ((state.level as number) < 0) {
        issues.push({ severity: 'warning', field: `building.buildings.${type}.level`, message: `${type} 等级为负数: ${state.level}`, autoFixable: true });
      } else if ((state.level as number) > MAX_BUILDING_LEVEL) {
        issues.push({ severity: 'warning', field: `building.buildings.${type}.level`, message: `${type} 等级超过上限: ${state.level}`, autoFixable: true });
      }

      const validStatuses = ['locked', 'idle', 'upgrading'];
      if (state.status && !validStatuses.includes(state.status as string)) {
        issues.push({ severity: 'warning', field: `building.buildings.${type}.status`, message: `${type} 状态异常: ${state.status}`, autoFixable: true });
      }
    }

    return issues;
  }

  /** 校验武将子系统数据 */
  validateHero(data: unknown): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (data === null || data === undefined || typeof data !== 'object') {
      issues.push({ severity: 'warning', field: 'hero', message: 'hero 数据缺失或类型错误', autoFixable: true });
      return issues;
    }

    const hero = data as Record<string, unknown>;

    if (hero.generals !== undefined && !Array.isArray(hero.generals)) {
      issues.push({ severity: 'warning', field: 'hero.generals', message: 'generals 应为数组类型', autoFixable: true });
    }

    if (hero.fragments !== undefined && typeof hero.fragments !== 'object') {
      issues.push({ severity: 'warning', field: 'hero.fragments', message: 'fragments 应为对象类型', autoFixable: true });
    }

    return issues;
  }

  /** 校验指定子系统数据（通用校验） */
  validateSubSystem(name: string, data: unknown): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (data === null || data === undefined) {
      issues.push({ severity: 'info', field: name, message: `子系统 ${name} 数据缺失`, autoFixable: true });
    } else if (typeof data !== 'object') {
      issues.push({ severity: 'warning', field: name, message: `子系统 ${name} 数据类型错误: ${typeof data}`, autoFixable: true });
    }

    return issues;
  }

  // ─── 私有方法 ──────────────────────────────────────────────────

  private validateTopLevel(data: unknown): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (data === null || data === undefined) {
      issues.push({ severity: 'error', field: 'root', message: '存档数据为空', autoFixable: false });
      return issues;
    }

    if (typeof data !== 'object' || Array.isArray(data)) {
      issues.push({ severity: 'error', field: 'root', message: `存档数据类型错误: ${typeof data}`, autoFixable: false });
      return issues;
    }

    const obj = data as Record<string, unknown>;

    if (typeof obj.version !== 'number') {
      issues.push({ severity: 'error', field: 'version', message: 'version 字段缺失或非 number 类型', autoFixable: true });
    }

    if (typeof obj.saveTime !== 'number') {
      issues.push({ severity: 'warning', field: 'saveTime', message: 'saveTime 字段缺失或非 number 类型', autoFixable: true });
    }

    if (!obj.resource) {
      issues.push({ severity: 'error', field: 'resource', message: '必需字段 resource 缺失', autoFixable: false });
    }

    if (!obj.building) {
      issues.push({ severity: 'error', field: 'building', message: '必需字段 building 缺失', autoFixable: false });
    }

    return issues;
  }

  private validateVersion(data: GameSaveData): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (data.version > ENGINE_SAVE_VERSION) {
      issues.push({
        severity: 'warning', field: 'version',
        message: `存档版本 ${data.version} 高于当前引擎版本 ${ENGINE_SAVE_VERSION}，可能存在不兼容`,
        autoFixable: false,
      });
    }

    if (data.version < ENGINE_SAVE_VERSION) {
      issues.push({
        severity: 'info', field: 'version',
        message: `存档版本 ${data.version} 低于当前引擎版本 ${ENGINE_SAVE_VERSION}，需要迁移`,
        autoFixable: true,
      });
    }

    return issues;
  }

  private validateOptionalSubsystems(data: GameSaveData): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const saveData = data as unknown as Record<string, unknown>;

    for (const [name, minVersion] of Object.entries(OPTIONAL_SUBSYSTEMS)) {
      const subData = saveData[name];

      if (subData === undefined) {
        issues.push({ severity: 'info', field: name, message: `子系统 ${name} 数据缺失（v${minVersion}+ 引入）`, autoFixable: true });
      } else if (subData === null || typeof subData !== 'object') {
        issues.push({ severity: 'warning', field: name, message: `子系统 ${name} 数据类型异常: ${typeof subData}`, autoFixable: true });
      }
    }

    return issues;
  }

  private buildReport(issues: ValidationIssue[]): ValidationReport {
    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    const info = issues.filter(i => i.severity === 'info').length;
    return { valid: errors === 0, issues, stats: { errors, warnings, info } };
  }
}
