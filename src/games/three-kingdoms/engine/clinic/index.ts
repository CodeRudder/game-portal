/**
 * 医馆治疗系统 — 模块入口
 *
 * @module engine/clinic
 */

export { ClinicTreatmentSystem } from './ClinicTreatmentSystem';
export type {
  GetResourceFn as ClinicGetResourceFn,
  SpendResourceFn as ClinicSpendResourceFn,
} from './ClinicTreatmentSystem';
export type {
  WoundedPool,
  TreatmentResult,
  ClinicState,
  ClinicSaveData,
} from './clinic.types';
export {
  TREATMENT_COOLDOWN_MS,
  PRODUCTION_BUFF_DURATION_MS,
  TREATMENT_HEAL_RATE,
  PRODUCTION_BUFF_BONUS,
  PASSIVE_HEAL_RATE_PER_LEVEL,
} from './clinic.types';

// Sprint 7: 医馆损失报告
export { ClinicLossReport } from './ClinicLossReport';
export type {
  ResourceProduction as ClinicResourceProduction,
  UpgradeComparison as ClinicUpgradeComparison,
  DailyReport as ClinicDailyReport,
  GetProductionFn as ClinicGetProductionFn,
} from './ClinicLossReport';
