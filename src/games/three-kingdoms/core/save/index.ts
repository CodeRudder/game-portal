/**
 * 存档模块 — 统一导出
 *
 * L1 内核层存档子模块的入口文件。
 * 导出存档管理器、序列化器、备份管理器、数据校验器、版本迁移器和数据修正器。
 *
 * @module core/save
 */

export { SaveManager } from './SaveManager';
export { StateSerializer, SerializationError } from './StateSerializer';
export { SaveBackupManager } from './SaveBackupManager';
export type { BackupEntry } from './SaveBackupManager';
export { GameDataValidator } from './GameDataValidator';
export type { ValidationIssue, ValidationReport } from './GameDataValidator';
export { DataMigrator } from './DataMigrator';
export type { MigrationStep } from './DataMigrator';
export { GameDataFixer } from './GameDataFixer';
export type { FixAction, FixReport, FixStrategy, FixerOptions } from './GameDataFixer';
