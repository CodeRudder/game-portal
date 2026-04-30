/**
 * 对抗式测试 — 离线研究边界
 *
 * 维度：F-Boundary + F-Error
 * 重点：离线时间边界、效率衰减、进度计算、回归面板
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TechTreeSystem } from '../TechTreeSystem';
import { TechPointSystem } from '../TechPointSystem';
import { TechResearchSystem } from '../TechResearchSystem';
import { TechOfflineSystem } from '../TechOfflineSystem';
import { createRealDeps } from '../../../test-utils/test-helpers';
import { MAX_OFFLINE_RESEARCH_SECONDS } from '../../../core/tech/offline-research.types';

describe('对抗式测试: 离线研究边界', () => {
  let treeSys: TechTreeSystem;
  let pointSys: TechPointSystem;
  let researchSys: TechResearchSystem;
  let offlineSys: TechOfflineSystem;
  let baseTime: number;
  let currentTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    currentTime = baseTime;
    vi.spyOn(Date, 'now').mockReturnValue(currentTime);

    treeSys = new TechTreeSystem();
    pointSys = new TechPointSystem();
    researchSys = new TechResearchSystem(
      treeSys, pointSys, () => 20, () => 100, () => true,
    );
    offlineSys = new TechOfflineSystem(treeSys, researchSys);

    const deps = createRealDeps();
    treeSys.init(deps);
    pointSys.init(deps);
    researchSys.init(deps);
    offlineSys.init(deps);
  });

  afterEach(() => vi.restoreAllMocks());

  function grantPoints(amount: number) {
    pointSys.syncAcademyLevel(20);
    pointSys.update(Math.ceil(amount / 1.76) + 10);
  }

  function advanceTime(ms: number) {
    currentTime += ms;
    vi.spyOn(Date, 'now').mockReturnValue(currentTime);
  }

  // ═══════════════════════════════════════════
  // 离线时间边界
  // ═══════════════════════════════════════════
  describe('离线时间边界', () => {
    it('离线0秒 → 无进度', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      offlineSys.onGoOffline(baseTime);
      const panel = offlineSys.onComeBackOnline(baseTime); // 0秒
      expect(panel).toBeNull();
    });

    it('离线1秒 → 有进度但不完成', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      offlineSys.onGoOffline(baseTime);
      const panel = offlineSys.onComeBackOnline(baseTime + 1000);
      expect(panel).not.toBeNull();
      expect(panel!.techProgressList.length).toBeGreaterThan(0);
      expect(panel!.techProgressList[0].completed).toBe(false);
    });

    it('离线刚好2小时 → 全程100%效率', () => {
      const effectiveSec = offlineSys.calculateEffectiveSeconds(2 * 3600);
      expect(effectiveSec).toBeCloseTo(2 * 3600, 0); // 100%
    });

    it('离线3小时 → 2h@100% + 1h@70%', () => {
      const effectiveSec = offlineSys.calculateEffectiveSeconds(3 * 3600);
      const expected = 2 * 3600 * 1.0 + 1 * 3600 * 0.7;
      expect(effectiveSec).toBeCloseTo(expected, 0);
    });

    it('离线8小时 → 2h@100% + 6h@70%', () => {
      const effectiveSec = offlineSys.calculateEffectiveSeconds(8 * 3600);
      const expected = 2 * 3600 * 1.0 + 6 * 3600 * 0.7;
      expect(effectiveSec).toBeCloseTo(expected, 0);
    });

    it('离线10小时 → 2h@100% + 6h@70% + 2h@40%', () => {
      const effectiveSec = offlineSys.calculateEffectiveSeconds(10 * 3600);
      const expected = 2 * 3600 * 1.0 + 6 * 3600 * 0.7 + 2 * 3600 * 0.4;
      expect(effectiveSec).toBeCloseTo(expected, 0);
    });

    it('离线24小时 → 2h@100% + 6h@70% + 16h@40%', () => {
      const effectiveSec = offlineSys.calculateEffectiveSeconds(24 * 3600);
      const expected = 2 * 3600 * 1.0 + 6 * 3600 * 0.7 + 16 * 3600 * 0.4;
      expect(effectiveSec).toBeCloseTo(expected, 0);
    });

    it('离线48小时 → 2h@100% + 6h@70% + 16h@40% + 24h@20%', () => {
      const effectiveSec = offlineSys.calculateEffectiveSeconds(48 * 3600);
      const expected = 2 * 3600 * 1.0 + 6 * 3600 * 0.7 + 16 * 3600 * 0.4 + 24 * 3600 * 0.2;
      expect(effectiveSec).toBeCloseTo(expected, 0);
    });

    it('离线72小时 → 封顶', () => {
      const effectiveSec = offlineSys.calculateEffectiveSeconds(72 * 3600);
      const expected = 2 * 3600 * 1.0 + 6 * 3600 * 0.7 + 16 * 3600 * 0.4 + 48 * 3600 * 0.2;
      expect(effectiveSec).toBeCloseTo(expected, 0);
    });

    it('离线超过72小时 → 封顶在72小时', () => {
      const sec72 = offlineSys.calculateEffectiveSeconds(72 * 3600);
      const sec100 = offlineSys.calculateEffectiveSeconds(100 * 3600);
      expect(sec72).toBeCloseTo(sec100, 0);
    });

    it('负数离线秒数 → 0', () => {
      expect(offlineSys.calculateEffectiveSeconds(-1)).toBe(0);
      expect(offlineSys.calculateEffectiveSeconds(-100)).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 综合效率
  // ═══════════════════════════════════════════
  describe('综合效率', () => {
    it('0秒 → 效率0', () => {
      expect(offlineSys.calculateOverallEfficiency(0)).toBe(0);
    });

    it('2小时 → 效率100%', () => {
      expect(offlineSys.calculateOverallEfficiency(2 * 3600)).toBeCloseTo(1.0, 3);
    });

    it('72小时 → 效率较低', () => {
      const eff = offlineSys.calculateOverallEfficiency(72 * 3600);
      expect(eff).toBeLessThan(0.5);
      expect(eff).toBeGreaterThan(0);
    });

    it('getEfficiencyPercent 返回百分比', () => {
      expect(offlineSys.getEfficiencyPercent(2 * 3600)).toBe(100);
    });
  });

  // ═══════════════════════════════════════════
  // 效率曲线
  // ═══════════════════════════════════════════
  describe('效率曲线', () => {
    it('0秒 → 只有起点', () => {
      const curve = offlineSys.generateEfficiencyCurve(0);
      expect(curve.length).toBeGreaterThanOrEqual(1);
      expect(curve[0].seconds).toBe(0);
    });

    it('3小时 → 至少3个采样点', () => {
      const curve = offlineSys.generateEfficiencyCurve(3 * 3600);
      expect(curve.length).toBeGreaterThanOrEqual(2);
    });

    it('效率曲线起点为100%', () => {
      const curve = offlineSys.generateEfficiencyCurve(10 * 3600);
      expect(curve[0].efficiency).toBe(1.0);
    });
  });

  // ═══════════════════════════════════════════
  // 离线进度计算
  // ═══════════════════════════════════════════
  describe('离线进度计算', () => {
    it('短时间离线不完成研究', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack'); // 120秒
      offlineSys.onGoOffline(baseTime);
      const panel = offlineSys.onComeBackOnline(baseTime + 60 * 1000); // 60秒
      expect(panel).not.toBeNull();
      expect(panel!.techProgressList[0].completed).toBe(false);
      expect(panel!.techProgressList[0].progressAfter).toBeGreaterThan(0);
      expect(panel!.techProgressList[0].progressAfter).toBeLessThan(1);
    });

    it('长时间离线完成研究', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack'); // 120秒
      offlineSys.onGoOffline(baseTime);
      // 离线3小时，100%效率2h + 70%效率1h，远超120秒
      const panel = offlineSys.onComeBackOnline(baseTime + 3 * 3600 * 1000);
      expect(panel).not.toBeNull();
      expect(panel!.completedTechIds).toContain('mil_t1_attack');
    });

    it('离线完成多个研究', () => {
      grantPoints(5000);
      researchSys.startResearch('mil_t1_attack'); // 120秒
      researchSys.startResearch('eco_t1_farming'); // 120秒
      researchSys.startResearch('cul_t1_education'); // 120秒
      offlineSys.onGoOffline(baseTime);
      const panel = offlineSys.onComeBackOnline(baseTime + 3 * 3600 * 1000);
      expect(panel!.completedTechIds).toHaveLength(3);
    });
  });

  // ═══════════════════════════════════════════
  // 对抗: 空快照
  // ═══════════════════════════════════════════
  describe('对抗: 空快照', () => {
    it('无研究时离线回归返回 null', () => {
      offlineSys.onGoOffline(baseTime);
      const panel = offlineSys.onComeBackOnline(baseTime + 3600 * 1000);
      expect(panel).toBeNull();
    });

    it('未调用 onGoOffline 直接回归返回 null', () => {
      const panel = offlineSys.onComeBackOnline(baseTime + 3600 * 1000);
      expect(panel).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 对抗: 重复调用
  // ═══════════════════════════════════════════
  describe('对抗: 重复调用', () => {
    it('连续两次 onComeBackOnline 第二次返回 null', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      offlineSys.onGoOffline(baseTime);
      const panel1 = offlineSys.onComeBackOnline(baseTime + 3600 * 1000);
      expect(panel1).not.toBeNull();
      const panel2 = offlineSys.onComeBackOnline(baseTime + 7200 * 1000);
      expect(panel2).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 离线状态查询
  // ═══════════════════════════════════════════
  describe('离线状态查询', () => {
    it('初始不是离线状态', () => {
      expect(offlineSys.isOffline()).toBe(false);
      expect(offlineSys.getOfflineStartTime()).toBeNull();
    });

    it('onGoOffline 后是离线状态', () => {
      offlineSys.onGoOffline(baseTime);
      expect(offlineSys.isOffline()).toBe(true);
      expect(offlineSys.getOfflineStartTime()).toBe(baseTime);
    });

    it('onComeBackOnline 后不是离线状态', () => {
      offlineSys.onGoOffline(baseTime);
      offlineSys.onComeBackOnline(baseTime + 1000);
      expect(offlineSys.isOffline()).toBe(false);
      expect(offlineSys.getOfflineStartTime()).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 格式化时间
  // ═══════════════════════════════════════════
  describe('格式化时间', () => {
    it('0秒 → 刚刚', () => {
      expect(offlineSys.formatOfflineTime(0)).toBe('刚刚');
    });

    it('30秒 → 30秒', () => {
      expect(offlineSys.formatOfflineTime(30)).toBe('30秒');
    });

    it('90秒 → 1分钟', () => {
      expect(offlineSys.formatOfflineTime(90)).toBe('1分钟');
    });

    it('150秒 → 2分钟', () => {
      expect(offlineSys.formatOfflineTime(150)).toBe('2分钟');
    });

    it('3600秒 → 1小时', () => {
      expect(offlineSys.formatOfflineTime(3600)).toBe('1小时');
    });

    it('5400秒 → 1小时30分钟', () => {
      expect(offlineSys.formatOfflineTime(5400)).toBe('1小时30分钟');
    });

    it('86400秒 → 1天', () => {
      expect(offlineSys.formatOfflineTime(86400)).toBe('1天');
    });

    it('90000秒 → 1天1小时', () => {
      expect(offlineSys.formatOfflineTime(90000)).toBe('1天1小时');
    });
  });

  // ═══════════════════════════════════════════
  // getEfficiencyAtTime
  // ═══════════════════════════════════════════
  describe('getEfficiencyAtTime', () => {
    it('0秒 → 100%', () => {
      expect(offlineSys.getEfficiencyAtTime(0)).toBe(1.0);
    });

    it('1小时 → 100%', () => {
      expect(offlineSys.getEfficiencyAtTime(3600)).toBe(1.0);
    });

    it('3小时 → 70%', () => {
      expect(offlineSys.getEfficiencyAtTime(3 * 3600)).toBe(0.7);
    });

    it('10小时 → 40%', () => {
      expect(offlineSys.getEfficiencyAtTime(10 * 3600)).toBe(0.4);
    });

    it('30小时 → 20%', () => {
      expect(offlineSys.getEfficiencyAtTime(30 * 3600)).toBe(0.2);
    });

    it('超过72小时 → 20%', () => {
      expect(offlineSys.getEfficiencyAtTime(100 * 3600)).toBe(0.2);
    });
  });

  // ═══════════════════════════════════════════
  // 序列化
  // ═══════════════════════════════════════════
  describe('离线序列化', () => {
    it('序列化/反序列化保持离线状态', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      offlineSys.onGoOffline(baseTime);
      const data = offlineSys.serialize();

      const newOffline = new TechOfflineSystem(treeSys, researchSys);
      newOffline.init(createRealDeps());
      newOffline.deserialize(data);

      expect(newOffline.isOffline()).toBe(true);
      expect(newOffline.getOfflineStartTime()).toBe(baseTime);
    });

    it('reset 清空离线状态', () => {
      offlineSys.onGoOffline(baseTime);
      offlineSys.reset();
      expect(offlineSys.isOffline()).toBe(false);
      expect(offlineSys.getOfflineStartTime()).toBeNull();
    });

    it('MAX_OFFLINE_RESEARCH_SECONDS = 72小时', () => {
      expect(MAX_OFFLINE_RESEARCH_SECONDS).toBe(72 * 3600);
    });
  });
});
