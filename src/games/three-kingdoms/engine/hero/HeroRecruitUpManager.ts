/**
 * UP 武将管理子系统
 *
 * 职责：UP 武将状态管理、概率配置、序列化/反序列化
 * 从 HeroRecruitSystem.ts 拆分而来，通过依赖注入解耦。
 *
 * @module engine/hero/HeroRecruitUpManager
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { UpHeroState, RecruitSaveData } from './recruit-types';
import { createDefaultUpHero } from './recruit-types';
import { DEFAULT_UP_CONFIG, RECRUIT_SAVE_VERSION } from './hero-recruit-config';
import { gameLog } from '../../core/logger';

/**
 * UP 武将管理器
 *
 * 管理 UP 武将的设置、查询、清除，以及序列化/反序列化。
 * 被 HeroRecruitSystem 通过依赖注入调用。
 */
export class HeroRecruitUpManager implements ISubsystem {
  readonly name = 'heroRecruitUp' as const;
  private deps: ISystemDeps | null = null;
  private upHero: UpHeroState;

  constructor() {
    this.upHero = createDefaultUpHero();
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void { /* 无需每帧更新 */ }
  getState(): unknown { return this.serializeUpHero(); }
  reset(): void { this.upHero = createDefaultUpHero(); }

  // ─────────────────────────────────────────
  // 1. UP 武将状态管理
  // ─────────────────────────────────────────

  /** 设置当前 UP 武将（仅高级招募生效） */
  setUpHero(generalId: string | null, rate?: number): void {
    this.upHero.upGeneralId = generalId;
    if (rate !== undefined) {
      this.upHero.upRate = rate;
    }
  }

  /** 获取当前 UP 武将状态（只读副本） */
  getUpHeroState(): Readonly<UpHeroState> {
    return { ...this.upHero };
  }

  /** 清除 UP 武将（重置为默认状态） */
  clearUpHero(): void {
    this.upHero = createDefaultUpHero();
    gameLog.info('[HeroRecruitUpManager] UP hero cleared');
  }

  /** 获取 UP 武将 ID */
  getUpGeneralId(): string | null {
    return this.upHero.upGeneralId;
  }

  /** 获取 UP 触发概率 */
  getUpRate(): number {
    return this.upHero.upRate;
  }

  /** 设置 UP 触发概率 */
  setUpRate(rate: number): void {
    this.upHero.upRate = rate;
  }

  // ─────────────────────────────────────────
  // 2. 序列化/反序列化
  // ─────────────────────────────────────────

  /** 序列化 UP 武将状态 */
  serializeUpHero(): UpHeroState {
    return { ...this.upHero };
  }

  /** 反序列化恢复 UP 武将状态（兼容旧存档） */
  deserializeUpHero(data: RecruitSaveData): void {
    if (data.version !== RECRUIT_SAVE_VERSION) {
      gameLog.warn(
        `HeroRecruitUpManager: 存档版本不匹配 (期望 ${RECRUIT_SAVE_VERSION}，实际 ${data.version})`,
      );
    }
    if (data.upHero) {
      this.upHero = {
        upGeneralId: data.upHero.upGeneralId ?? null,
        upRate: data.upHero.upRate ?? DEFAULT_UP_CONFIG.upRate,
        description: data.upHero.description ?? '',
      };
    } else {
      this.upHero = createDefaultUpHero();
    }
  }
}
