/**
 * 游戏数据修正器（主入口）
 *
 * 整合 Validator + Migrator + BackupManager，提供统一的数据修正入口。
 * 解决误删数据、版本升级不兼容、数据损坏等问题。
 *
 * @module core/save/GameDataFixer
 */

import type { GameSaveData } from '../../shared/types';
import type { SaveContext } from '../../engine/engine-save';
import type { ValidationIssue } from './GameDataValidator';
import { SaveBackupManager } from './SaveBackupManager';
import { GameDataValidator } from './GameDataValidator';
import { DataMigrator } from './DataMigrator';
import { ENGINE_SAVE_VERSION, SAVE_KEY } from '../../shared/constants';
import { gameLog } from '../logger';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

export type FixStrategy = 'conservative' | 'aggressive';

export interface FixerOptions {
  strategy?: FixStrategy;
  /** 备份最大保留时间（ms），默认 7 天 */
  maxBackupAge?: number;
}

export interface FixAction {
  type: 'migrate' | 'fill_default' | 'restore_backup' | 'fix_value' | 'remove_corrupt';
  field: string;
  description: string;
  before?: unknown;
  after?: unknown;
}

export interface FixReport {
  success: boolean;
  actions: FixAction[];
  originalValid: boolean;
  fixedValid: boolean;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const DEFAULT_MAX_BACKUP_AGE = 7 * 24 * 60 * 60 * 1000;

const RESOURCE_DEFAULTS: Record<string, number> = {
  grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0,
};

// ─────────────────────────────────────────────
// 数据修正器
// ─────────────────────────────────────────────

/**
 * 游戏数据修正器
 *
 * 统一入口，整合 Validator + Migrator + BackupManager。
 *
 * @example
 * ```ts
 * const fixer = new GameDataFixer(backupManager, { strategy: 'conservative' });
 * const { data, report } = fixer.fix(rawData);
 * ```
 */
export class GameDataFixer {
  private readonly backupManager: SaveBackupManager;
  private readonly validator: GameDataValidator;
  private readonly migrator: DataMigrator;
  private readonly strategy: FixStrategy;
  private readonly maxBackupAge: number;

  constructor(backupManager: SaveBackupManager, options?: FixerOptions) {
    this.backupManager = backupManager;
    this.validator = new GameDataValidator();
    this.migrator = new DataMigrator();
    this.strategy = options?.strategy ?? 'conservative';
    this.maxBackupAge = options?.maxBackupAge ?? DEFAULT_MAX_BACKUP_AGE;
  }

  // ─── 核心方法 ──────────────────────────────────────────────────

  /**
   * 修正存档数据
   *
   * 执行完整修正流程：校验 → 版本迁移 → 自动修复 → 再校验。
   */
  fix(data: unknown): { data: GameSaveData | null; report: FixReport } {
    const actions: FixAction[] = [];

    // 1. 基本可用性检查
    if (data === null || data === undefined || typeof data !== 'object') {
      const recovered = this.tryRecoverFromBackup(actions);
      if (recovered) {
        return { data: recovered, report: this.buildReport(actions, false, true) };
      }
      return { data: null, report: this.buildReport(actions, false, false) };
    }

    // 2. 解析为 GameSaveData
    let saveData: GameSaveData;
    try {
      saveData = data as GameSaveData;
    } catch {
      actions.push({ type: 'remove_corrupt', field: 'root', description: '存档数据无法解析' });
      const recovered = this.tryRecoverFromBackup(actions);
      return { data: recovered, report: this.buildReport(actions, false, recovered !== null) };
    }

    // 3. 初次校验
    const originalReport = this.validator.validate(saveData);
    const originalValid = originalReport.valid;

    // 4. 版本迁移
    if (this.migrator.needsMigration(saveData)) {
      const beforeVersion = saveData.version;
      saveData = this.migrator.migrate(saveData);
      actions.push({
        type: 'migrate', field: 'version',
        description: `版本迁移: v${beforeVersion} → v${saveData.version}`,
        before: beforeVersion, after: saveData.version,
      });
    }

    // 5. 修复校验发现的问题
    if (!originalValid) {
      saveData = this.fixIssues(saveData, originalReport.issues, actions);
    }

    // 6. 校验修正后的数据
    const fixedReport = this.validator.validate(saveData);
    if (!fixedReport.valid) {
      gameLog.warn('[GameDataFixer] 修正后仍存在问题:', fixedReport.stats);
    }

    return { data: saveData, report: this.buildReport(actions, originalValid, fixedReport.valid) };
  }

  /**
   * 修正数据并应用到引擎
   */
  fixAndApply(ctx: SaveContext, data: unknown): FixReport {
    const { data: fixedData, report } = this.fix(data);

    if (fixedData) {
      try {
        // 动态导入避免循环依赖
        const { applyDeserialize } = require('../../engine/engine-save') as typeof import('../../engine/engine-save');
        applyDeserialize(ctx, JSON.stringify(fixedData));
        gameLog.info('[GameDataFixer] 数据已修正并应用到引擎');
      } catch (err) {
        gameLog.error('[GameDataFixer] 应用修正数据失败:', err);
        return { ...report, success: false };
      }
    }

    return report;
  }

  // ─── 便捷方法 ──────────────────────────────────────────────────

  /**
   * 尝试恢复损坏的存档
   *
   * 从 localStorage 读取存档，如果无法正常解析则尝试从备份恢复。
   */
  tryRecoverSave(): GameSaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        gameLog.info('[GameDataFixer] 无存档数据');
        return null;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        gameLog.warn('[GameDataFixer] 存档 JSON 解析失败，尝试备份恢复');
        return this.recoverDeleted();
      }

      // 检查是否为新格式
      if (parsed && typeof parsed === 'object' && typeof (parsed as Record<string, unknown>).data === 'string') {
        try {
          const inner = JSON.parse((parsed as Record<string, unknown>).data as string);
          const { data, report } = this.fix(inner);
          if (data) {
            this.logReport(report);
            return data;
          }
        } catch {
          gameLog.warn('[GameDataFixer] 新格式存档内部数据解析失败');
        }
      }

      // 尝试作为旧格式
      const { data, report } = this.fix(parsed);
      if (data) {
        this.logReport(report);
        return data;
      }

      return this.recoverDeleted();
    } catch (err) {
      gameLog.error('[GameDataFixer] 恢复存档失败:', err);
      return this.recoverDeleted();
    }
  }

  /** 诊断当前存档问题（不执行修复） */
  diagnose(): FixReport {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        return { success: false, actions: [], originalValid: false, fixedValid: false };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return {
          success: false,
          actions: [{ type: 'remove_corrupt', field: 'root', description: '存档 JSON 解析失败' }],
          originalValid: false, fixedValid: false,
        };
      }

      // 处理新格式
      if (parsed && typeof parsed === 'object' && typeof (parsed as Record<string, unknown>).data === 'string') {
        try { parsed = JSON.parse((parsed as Record<string, unknown>).data as string); } catch { /* use outer */ }
      }

      const report = this.validator.validate(parsed);
      return { success: report.valid, actions: [], originalValid: report.valid, fixedValid: report.valid };
    } catch {
      return { success: false, actions: [], originalValid: false, fixedValid: false };
    }
  }

  /** 从备份恢复误删的存档 */
  recoverDeleted(): GameSaveData | null {
    const backups = this.backupManager.listBackups();
    if (backups.length === 0) {
      gameLog.warn('[GameDataFixer] 无可用备份');
      return null;
    }

    for (const backup of backups) {
      if (Date.now() - backup.timestamp > this.maxBackupAge) {
        gameLog.info(`[GameDataFixer] 备份 ${backup.id} 已过期，跳过`);
        continue;
      }

      const backupData = this.backupManager.getBackupData(backup.id);
      if (!backupData) continue;

      try {
        let parsed: unknown = JSON.parse(backupData);

        // 处理新格式
        if (parsed && typeof parsed === 'object' && typeof (parsed as Record<string, unknown>).data === 'string') {
          parsed = JSON.parse((parsed as Record<string, unknown>).data as string);
        }

        if (parsed && typeof parsed === 'object') {
          const data = parsed as GameSaveData;
          if (data.resource && data.building) {
            gameLog.info(`[GameDataFixer] 从备份 ${backup.id} 恢复成功`);
            if (this.migrator.needsMigration(data)) {
              return this.migrator.migrate(data);
            }
            return data;
          }
        }
      } catch {
        continue;
      }
    }

    gameLog.warn('[GameDataFixer] 所有备份均无法恢复');
    return null;
  }

  // ─── 私有方法 ──────────────────────────────────────────────────

  private fixIssues(data: GameSaveData, issues: ValidationIssue[], actions: FixAction[]): GameSaveData {
    let fixed = { ...data };
    const record = fixed as Record<string, unknown>;

    for (const issue of issues) {
      if (!issue.autoFixable) continue;
      // 保守策略跳过 info 级别
      if (this.strategy === 'conservative' && issue.severity === 'info') continue;

      const action = this.fixSingleIssue(record, issue);
      if (action) actions.push(action);
    }

    return fixed;
  }

  private fixSingleIssue(record: Record<string, unknown>, issue: ValidationIssue): FixAction | null {
    const field = issue.field;

    // 修复资源字段
    if (field.startsWith('resource.resources.')) {
      const resField = field.split('.').pop()!;
      if (record.resource && typeof record.resource === 'object') {
        const res = record.resource as Record<string, unknown>;
        if (res.resources && typeof res.resources === 'object') {
          const resources = res.resources as Record<string, unknown>;
          const before = resources[resField];
          const defaultValue = RESOURCE_DEFAULTS[resField] ?? 0;
          resources[resField] = defaultValue;
          return { type: 'fix_value', field, description: `修复资源字段 ${resField}: ${before} → ${defaultValue}`, before, after: defaultValue };
        }
      }
    }

    // 修复建筑等级
    if (field.includes('.level') && field.startsWith('building.buildings.')) {
      if (record.building && typeof record.building === 'object') {
        const bld = record.building as Record<string, unknown>;
        if (bld.buildings && typeof bld.buildings === 'object') {
          const buildings = bld.buildings as Record<string, unknown>;
          const buildingType = field.split('.')[2];
          const building = buildings[buildingType];
          if (building && typeof building === 'object') {
            const state = building as Record<string, unknown>;
            const before = state.level;
            const fixedLevel = Math.max(0, Math.min(typeof before === 'number' ? before : 1, 100));
            state.level = fixedLevel;
            return { type: 'fix_value', field, description: `修复 ${buildingType} 等级: ${before} → ${fixedLevel}`, before, after: fixedLevel };
          }
        }
      }
    }

    // 修复建筑状态
    if (field.includes('.status') && field.startsWith('building.buildings.')) {
      if (record.building && typeof record.building === 'object') {
        const bld = record.building as Record<string, unknown>;
        if (bld.buildings && typeof bld.buildings === 'object') {
          const buildings = bld.buildings as Record<string, unknown>;
          const buildingType = field.split('.')[2];
          const building = buildings[buildingType];
          if (building && typeof building === 'object') {
            const state = building as Record<string, unknown>;
            const before = state.status;
            state.status = 'idle';
            return { type: 'fix_value', field, description: `修复 ${buildingType} 状态: ${before} → idle`, before, after: 'idle' };
          }
        }
      }
    }

    // 修复缺失子系统（激进策略）
    if (this.strategy === 'aggressive' && issue.message.includes('数据缺失')) {
      const subsystemName = field;
      if (record[subsystemName] === undefined) {
        record[subsystemName] = this.getDefaultSubSystemData(subsystemName);
        return { type: 'fill_default', field: subsystemName, description: `补全缺失子系统 ${subsystemName} 默认数据`, before: undefined, after: '(default)' };
      }
    }

    return null;
  }

  private getDefaultSubSystemData(name: string): unknown {
    const defaults: Record<string, unknown> = {
      calendar: { version: 1 },
      hero: { generals: [], fragments: {}, version: 1 },
      recruit: { pityCounter: 0, totalPulls: 0, version: 1 },
      formation: { formations: [], activeFormationId: null, version: 1 },
      campaign: { currentChapterId: '', stageStates: {}, lastClearTime: 0, version: 1 },
      tech: { version: 1, completedTechIds: [], activeResearch: null, researchQueue: [], techPoints: { basic: 0, advanced: 0, fusion: 0 }, chosenMutexNodes: {} },
    };
    return defaults[name] ?? { version: 1 };
  }

  private tryRecoverFromBackup(actions: FixAction[]): GameSaveData | null {
    const recovered = this.recoverDeleted();
    if (recovered) {
      actions.push({ type: 'restore_backup', field: 'root', description: '从备份恢复存档数据', before: null, after: '(backup data)' });
    }
    return recovered;
  }

  private buildReport(actions: FixAction[], originalValid: boolean, fixedValid: boolean): FixReport {
    return { success: fixedValid, actions, originalValid, fixedValid };
  }

  private logReport(report: FixReport): void {
    gameLog.info(`[GameDataFixer] 修正报告: success=${report.success}, actions=${report.actions.length}`);
    for (const action of report.actions) {
      gameLog.info(`  [${action.type}] ${action.field}: ${action.description}`);
    }
  }
}
