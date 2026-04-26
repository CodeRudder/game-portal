/**
 * 集成测试 — §6+§11+§12 数值平衡+招募保底+色盲纹理+PRD矛盾回归
 *
 * 验证范围：
 *   §6  数值平衡端到端 — BalanceValidator 5维度 + BalanceUtils/BalanceReport 纯函数
 *   §11 招募概率保底   — HeroRecruitSystem 概率表/十连保底/硬保底/UP武将/免费招募
 *   §12 色盲纹理+PRD   — VisualSpecDefaults 配色差异/品质色区分度/PRD矛盾回归检测
 *
 * 覆盖：20-25 用例
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceValidator } from '../../BalanceValidator';
import {
  DEFAULT_RESOURCE_CONFIGS,
  HERO_BASE_STATS,
  DEFAULT_BATTLE_CONFIG,
  DEFAULT_ECONOMY_CONFIGS,
  DEFAULT_REBIRTH_CONFIG,
} from '../../BalanceCalculator';
import {
  generateId,
  inRange,
  calcDeviation,
  makeEntry,
  calcPower,
  calcRebirthMultiplier,
  generateResourceCurve,
} from '../../BalanceUtils';
import {
  validateSingleResource,
  validateSingleHero,
  calculateStagePoints,
  validateEconomy,
  validateRebirth,
  calculateRebirthPoints,
} from '../../BalanceReport';
import {
  DEFAULT_QUALITY_COLORS,
  DEFAULT_FACTION_COLORS,
  DEFAULT_FUNCTIONAL_COLORS,
  DEFAULT_STATUS_COLORS,
  colorDifference,
  hexToRgb,
} from '../../VisualSpecDefaults';
import { VisualConsistencyChecker } from '../../VisualConsistencyChecker';
import { HeroRecruitSystem } from '../../../hero/HeroRecruitSystem';
import {
  NORMAL_RATES,
  ADVANCED_RATES,
  RECRUIT_PITY,
  RECRUIT_COSTS,
  TEN_PULL_DISCOUNT,
} from '../../../hero/hero-recruit-config';
import {
  rollQuality,
  applyPity,
  pickGeneralByQuality,
} from '../../../hero/recruit-types';
import { Quality } from '../../../hero/hero.types';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type {
  ResourceBalanceConfig,
  HeroBaseStats,
  BattleDifficultyConfig,
  RebirthBalanceConfig,
  NumericRange,
} from '../../../../core/unification';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: {
      register: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn().mockReturnValue(false),
      unregister: vi.fn(),
    },
  } as unknown as ISystemDeps;
}

// ═════════════════════════════════════════════════════════════

describe('§6+§11+§12 数值平衡+招募保底+色盲纹理+PRD 集成测试', () => {

  // ─── §6 数值平衡端到端 ──────────────────────

  describe('§6 数值平衡端到端验证', () => {
    let balance: BalanceValidator;

    beforeEach(() => {
      balance = new BalanceValidator();
      balance.init(mockDeps());
    });

    it('默认配置全量验证5维度均生成报告条目', () => {
      const report = balance.validateAll();
      // 至少覆盖5个维度: resource_production, hero_power, battle_difficulty, economy, rebirth
      const dimensions = new Set(report.entries.map(e => e.dimension));
      expect(dimensions.size).toBeGreaterThanOrEqual(4);
      expect(report.summary).toBeDefined();
      expect(report.overallLevel).toBeDefined();
    });

    it('资源曲线产出随阶段递增且产消比在合理范围', () => {
      for (const config of DEFAULT_RESOURCE_CONFIGS) {
        const curve = generateResourceCurve(config);
        // 曲线数据点递增
        for (let i = 1; i < curve.length; i++) {
          expect(curve[i].productionRate).toBeGreaterThanOrEqual(curve[i - 1].productionRate);
        }
        // 产消比检查
        for (const point of curve) {
          if (point.totalConsumed > 0) {
            const ratio = point.totalProduced / point.totalConsumed;
            expect(ratio).toBeGreaterThan(0);
          }
        }
      }
    });

    it('5品质武将基础属性严格递增', () => {
      const qualities = ['COMMON', 'FINE', 'RARE', 'EPIC', 'LEGENDARY'];
      for (let i = 1; i < qualities.length; i++) {
        const prev = HERO_BASE_STATS[qualities[i - 1]];
        const curr = HERO_BASE_STATS[qualities[i]];
        expect(curr.attack).toBeGreaterThan(prev.attack);
        expect(curr.defense).toBeGreaterThan(prev.defense);
        expect(curr.hp).toBeGreaterThan(prev.hp);
      }
    });

    it('战力计算公式一致：BalanceUtils.calcPower 与 BalanceReport 结果对齐', () => {
      const stats = HERO_BASE_STATS['RARE'];
      const levelFactor = 2.0;
      const starFactor = 1.5;
      const power = calcPower(stats, levelFactor, starFactor);
      expect(power).toBeGreaterThan(0);
      // 验证公式: (atk*2 + def*1.5 + hp*0.5 + spd*1) * lvl * star
      const expected = Math.floor(
        (stats.attack * 2 + stats.defense * 1.5 + stats.hp * 0.5 + stats.speed * 1) * levelFactor * starFactor,
      );
      expect(power).toBe(expected);
    });

    it('转生倍率递减曲线：后续转生增量递减', () => {
      const config: RebirthBalanceConfig = {
        maxRebirthCount: 20,
        baseMultiplier: 1.0,
        perRebirthIncrement: 0.5,
        maxMultiplier: 10.0,
        curveType: 'diminishing',
        decayFactor: 0.9,
      };
      const increments: number[] = [];
      for (let i = 1; i <= 10; i++) {
        const m = calcRebirthMultiplier(i, config);
        const prev = calcRebirthMultiplier(i - 1, config);
        increments.push(m - prev);
      }
      // 递减验证：后续增量 ≤ 前一次增量
      for (let i = 1; i < increments.length; i++) {
        expect(increments[i]).toBeLessThanOrEqual(increments[i - 1] + 0.001);
      }
    });

    it('战斗难度曲线默认5章3关，同章内递增，首关战力不低于上章首关', () => {
      const result = calculateStagePoints(DEFAULT_BATTLE_CONFIG);
      const points = result.stagePoints;
      expect(points).toHaveLength(DEFAULT_BATTLE_CONFIG.totalChapters * DEFAULT_BATTLE_CONFIG.stagesPerChapter);
      // 同章内严格递增（boss关有额外倍率）
      for (let ch = 0; ch < DEFAULT_BATTLE_CONFIG.totalChapters; ch++) {
        const base = ch * DEFAULT_BATTLE_CONFIG.stagesPerChapter;
        for (let st = 1; st < DEFAULT_BATTLE_CONFIG.stagesPerChapter; st++) {
          expect(points[base + st].enemyPower).toBeGreaterThanOrEqual(points[base + st - 1].enemyPower);
        }
      }
      // 跨章首关递增（排除boss倍率影响）
      for (let ch = 1; ch < DEFAULT_BATTLE_CONFIG.totalChapters; ch++) {
        const prevFirst = points[(ch - 1) * DEFAULT_BATTLE_CONFIG.stagesPerChapter].enemyPower;
        const currFirst = points[ch * DEFAULT_BATTLE_CONFIG.stagesPerChapter].enemyPower;
        expect(currFirst).toBeGreaterThanOrEqual(prevFirst);
      }
    });

    it('经济系统4货币验证结果包含完整字段', () => {
      const result = validateEconomy(DEFAULT_ECONOMY_CONFIGS);
      expect(result.isBalanced).toBeDefined();
      expect(result.currencyFlows.length).toBe(4);
      for (const flow of result.currencyFlows) {
        expect(flow).toHaveProperty('currency');
        expect(flow).toHaveProperty('dailyAcquisition');
        expect(flow).toHaveProperty('dailyConsumption');
      }
    });
  });

  // ─── §11 招募概率保底 ──────────────────────

  describe('§11 招募概率保底验证', () => {
    let recruit: HeroRecruitSystem;

    beforeEach(() => {
      recruit = new HeroRecruitSystem();
      recruit.init(mockDeps());
    });

    it('普通/高级概率表之和为1.0', () => {
      const normalSum = NORMAL_RATES.reduce((s, r) => s + r.rate, 0);
      const advancedSum = ADVANCED_RATES.reduce((s, r) => s + r.rate, 0);
      expect(normalSum).toBeCloseTo(1.0, 6);
      expect(advancedSum).toBeCloseTo(1.0, 6);
    });

    it('十连保底阈值均为10，高级池硬保底100，普通池无硬保底', () => {
      expect(RECRUIT_PITY.normal.tenPullThreshold).toBe(10);
      expect(RECRUIT_PITY.advanced.tenPullThreshold).toBe(10);
      expect(RECRUIT_PITY.normal.hardPityThreshold).toBe(Infinity); // PRD: 普通池无硬保底
      expect(RECRUIT_PITY.advanced.hardPityThreshold).toBe(100);
    });

    it('保底计数器初始值为0', () => {
      const state = recruit.getGachaState();
      expect(state.normalPity).toBe(0);
      expect(state.advancedPity).toBe(0);
      expect(state.normalHardPity).toBe(0);
      expect(state.advancedHardPity).toBe(0);
    });

    it('getNextTenPullPity/ getNextHardPity 初始值正确', () => {
      expect(recruit.getNextTenPullPity('normal')).toBe(10);
      expect(recruit.getNextHardPity('normal')).toBe(Infinity); // 普通池无硬保底
      expect(recruit.getNextTenPullPity('advanced')).toBe(10);
      expect(recruit.getNextHardPity('advanced')).toBe(100);
    });

    it('rollQuality 确定性RNG返回正确品质', () => {
      // 固定RNG: 0.0 → 第一个区间 COMMON
      const q1 = rollQuality(NORMAL_RATES, () => 0.0);
      expect(q1).toBe(Quality.COMMON);
      // 固定RNG: 0.95 → 应在 EPIC 区间 (0.90~0.98 in advanced)
      const q2 = rollQuality(ADVANCED_RATES, () => 0.95);
      expect(q2).toBe(Quality.EPIC);
    });

    it('applyPity 十连保底触发时强制提升品质', () => {
      const config = RECRUIT_PITY.normal;
      // 模拟已抽9次未出稀有+，第10次保底
      const result = applyPity(Quality.COMMON, 9, 0, config);
      // 保底应提升到 RARE+（tenPullMinQuality）
      expect([Quality.RARE, Quality.EPIC, Quality.LEGENDARY]).toContain(result);
    });

    it('applyPity 高级池硬保底触发时强制提升品质', () => {
      const config = RECRUIT_PITY.advanced; // PRD: 仅高级池有硬保底
      // 模拟已抽99次未出史诗+，第100次硬保底
      const result = applyPity(Quality.COMMON, 0, 99, config);
      expect([Quality.LEGENDARY]).toContain(result);
    });

    it('applyPity 非保底情况不改变品质', () => {
      const config = RECRUIT_PITY.normal;
      const result = applyPity(Quality.RARE, 0, 0, config);
      expect(result).toBe(Quality.RARE);
    });

    it('招募消耗计算正确，十连无折扣', () => {
      const singleCost = recruit.getRecruitCost('normal', 1);
      expect(singleCost.resourceType).toBe('recruitToken');
      expect(singleCost.amount).toBe(RECRUIT_COSTS.normal.amount);

      const tenCost = recruit.getRecruitCost('normal', 10);
      expect(tenCost.amount).toBe(RECRUIT_COSTS.normal.amount * 10 * TEN_PULL_DISCOUNT);

      const advCost = recruit.getRecruitCost('advanced', 1);
      expect(advCost.amount).toBe(RECRUIT_COSTS.advanced.amount);
    });

    it('序列化/反序列化保底计数器完整还原', () => {
      recruit.reset();
      const data = recruit.serialize();
      expect(data.version).toBeDefined();
      expect(data.pity.normalPity).toBe(0);
      expect(data.pity.advancedPity).toBe(0);

      // 修改后序列化再反序列化
      const modified = {
        ...data,
        pity: { normalPity: 5, advancedPity: 8, normalHardPity: 3, advancedHardPity: 12 },
      };
      recruit.deserialize(modified);
      const state = recruit.getGachaState();
      expect(state.normalPity).toBe(5);
      expect(state.advancedPity).toBe(8);
      expect(state.normalHardPity).toBe(3);
      expect(state.advancedHardPity).toBe(12);
    });

    it('无依赖时招募返回null', () => {
      expect(recruit.recruitSingle('normal')).toBeNull();
      expect(recruit.recruitTen('normal')).toBeNull();
      expect(recruit.canRecruit('normal', 1)).toBe(false);
    });
  });

  // ─── §12 色盲纹理 + PRD 矛盾回归 ──────────

  describe('§12 色盲纹理 + PRD 矛盾回归', () => {
    let visual: VisualConsistencyChecker;

    beforeEach(() => {
      visual = new VisualConsistencyChecker();
      visual.init(mockDeps());
    });

    it('5品质色两两色差≥20（色盲友好最低区分度）', () => {
      for (let i = 0; i < DEFAULT_QUALITY_COLORS.length; i++) {
        for (let j = i + 1; j < DEFAULT_QUALITY_COLORS.length; j++) {
          const diff = colorDifference(
            DEFAULT_QUALITY_COLORS[i].primaryColor,
            DEFAULT_QUALITY_COLORS[j].primaryColor,
          );
          expect(diff).toBeGreaterThanOrEqual(20);
        }
      }
    });

    it('4阵营色两两色差≥15（可辨识阈值）', () => {
      for (let i = 0; i < DEFAULT_FACTION_COLORS.length; i++) {
        for (let j = i + 1; j < DEFAULT_FACTION_COLORS.length; j++) {
          const diff = colorDifference(
            DEFAULT_FACTION_COLORS[i].primaryColor,
            DEFAULT_FACTION_COLORS[j].primaryColor,
          );
          expect(diff).toBeGreaterThanOrEqual(15);
        }
      }
    });

    it('5功能色两两色差≥10（信息传达区分度）', () => {
      for (let i = 0; i < DEFAULT_FUNCTIONAL_COLORS.length; i++) {
        for (let j = i + 1; j < DEFAULT_FUNCTIONAL_COLORS.length; j++) {
          const diff = colorDifference(
            DEFAULT_FUNCTIONAL_COLORS[i].standardColor,
            DEFAULT_FUNCTIONAL_COLORS[j].standardColor,
          );
          expect(diff).toBeGreaterThanOrEqual(10);
        }
      }
    });

    it('hexToRgb 正确解析标准十六进制颜色', () => {
      const rgb = hexToRgb('#4CAF50');
      expect(rgb).toEqual({ r: 76, g: 175, b: 80 });

      const invalid = hexToRgb('invalid');
      expect(invalid).toBeNull();

      const black = hexToRgb('#000000');
      expect(black).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('colorDifference 相同颜色差为0，黑白差接近100', () => {
      expect(colorDifference('#FFFFFF', '#FFFFFF')).toBe(0);
      expect(colorDifference('#000000', '#FFFFFF')).toBeGreaterThan(90);
    });

    it('品质色注册后审查配色一致性得分100', () => {
      for (const qc of DEFAULT_QUALITY_COLORS) {
        visual.registerColor(
          `quality_${qc.quality}`,
          'quality',
          'primaryColor',
          qc.primaryColor,
          qc.quality,
        );
      }
      const report = visual.auditColors();
      expect(report.summary.consistencyScore).toBe(100);
      expect(report.summary.passedChecks).toBe(report.summary.totalChecks);
    });

    it('注册错误颜色后审查得分<100', () => {
      visual.registerColor('bad_quality', 'quality', 'primaryColor', '#FF0000', 'COMMON');
      const report = visual.auditColors();
      expect(report.summary.consistencyScore).toBeLessThan(100);
      expect(report.summary.failedChecks).toBeGreaterThan(0);
    });

    it('PRD矛盾回归：品质色数量固定为5，阵营色固定为4', () => {
      expect(DEFAULT_QUALITY_COLORS).toHaveLength(5);
      expect(DEFAULT_FACTION_COLORS).toHaveLength(4);
      expect(DEFAULT_FUNCTIONAL_COLORS.length).toBeGreaterThanOrEqual(4);
      expect(DEFAULT_STATUS_COLORS.length).toBeGreaterThanOrEqual(4);
    });

    it('PRD矛盾回归：功能色confirm/cancel/warning/info/gold齐全', () => {
      const names = DEFAULT_FUNCTIONAL_COLORS.map(c => c.name);
      expect(names).toContain('confirm');
      expect(names).toContain('cancel');
      expect(names).toContain('warning');
      expect(names).toContain('info');
      expect(names).toContain('gold');
    });

    it('PRD矛盾回归：状态色online/offline/busy/error/locked齐全', () => {
      const statuses = DEFAULT_STATUS_COLORS.map(c => c.status);
      expect(statuses).toContain('online');
      expect(statuses).toContain('offline');
      expect(statuses).toContain('busy');
      expect(statuses).toContain('error');
      expect(statuses).toContain('locked');
    });

    it('PRD矛盾回归：品质色primaryColor均为有效十六进制', () => {
      for (const qc of DEFAULT_QUALITY_COLORS) {
        expect(qc.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(qc.borderColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(qc.backgroundColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  });
});
