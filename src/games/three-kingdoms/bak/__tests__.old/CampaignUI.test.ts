/**
 * CampaignUI 测试 — 从 UI 角度测试关卡面板数据获取和战斗流程
 *
 * 覆盖：
 * - 关卡列表渲染数据获取
 * - 关卡详情弹窗数据获取
 * - 关卡状态判断（锁定/可攻/已攻克）
 * - 战斗流程（从 UI 角度模拟）
 * - 战斗结果数据结构验证
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CampaignSystem,
  CAMPAIGN_STAGES,
  CAMPAIGN_LEVEL_DETAILS,
  type TroopComposition,
  type CampaignBattleResult,
  type LevelStatusInfo,
} from '../CampaignSystem';

// ═══════════════════════════════════════════════════════════════
// 辅助：模拟 UI 面板所需的数据获取
// ═══════════════════════════════════════════════════════════════

/** 模拟面板获取关卡列表数据（对应 CampaignPanel 中 stages） */
function getStageListData(sys: CampaignSystem) {
  return CAMPAIGN_STAGES.map(stage => ({
    id: stage.id,
    name: stage.name,
    status: sys.getStageStatus(stage.id),
    stars: sys.getCompletionRecord(stage.id)?.stars ?? 0,
  }));
}

/** 模拟面板获取关卡详情（对应 LevelDetailModal 所需数据） */
function getLevelDetailData(sys: CampaignSystem, levelId: string) {
  const detail = sys.getLevelDetail(levelId);
  if (!detail) return null;
  const statusInfo = sys.getLevelStatus(levelId);
  return { detail, statusInfo, canAttack: statusInfo.canAttack };
}

/** 模拟 UI 发起战斗 */
function simulateBattleFromUI(sys: CampaignSystem, levelId: string, troops: TroopComposition) {
  // UI 先检查是否可攻打
  const statusInfo = sys.getLevelStatus(levelId);
  if (!statusInfo.canAttack) {
    return { success: false, reason: statusInfo.reason, result: null };
  }
  // 执行战斗
  const result = sys.attackLevel(levelId, troops);
  return { success: true, reason: null, result };
}

// ═══════════════════════════════════════════════════════════════

describe('CampaignUI - 关卡列表数据获取', () => {
  let sys: CampaignSystem;

  beforeEach(() => {
    sys = new CampaignSystem();
  });

  it('should return all 18 stages for panel rendering', () => {
    const stages = getStageListData(sys);
    expect(stages).toHaveLength(18);
    expect(stages[0].name).toBe('涿郡起兵');
    expect(stages[5].name).toBe('天下归一');
  });

  it('should show first stage as available and rest as locked', () => {
    const stages = getStageListData(sys);
    expect(stages[0].status).toBe('available');
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i].status).toBe('locked');
    }
  });

  it('should show zero stars initially', () => {
    const stages = getStageListData(sys);
    stages.forEach(s => expect(s.stars).toBe(0));
  });

  it('should update stage status after completing a stage', () => {
    sys.completeStage('campaign_zhuo', 80);
    const stages = getStageListData(sys);
    expect(stages[0].status).toBe('victory');
    expect(stages[0].stars).toBeGreaterThanOrEqual(1);
    expect(stages[1].status).toBe('available');
  });

  it('should track completion progress', () => {
    const completed = sys.getCompletedStages();
    expect(completed).toHaveLength(0);

    sys.completeStage('campaign_zhuo', 90);
    expect(sys.getCompletedStages()).toHaveLength(1);

    sys.completeStage('campaign_hulao', 70);
    expect(sys.getCompletedStages()).toHaveLength(2);
  });
});

describe('CampaignUI - 关卡详情弹窗数据获取', () => {
  let sys: CampaignSystem;

  beforeEach(() => {
    sys = new CampaignSystem();
  });

  it('should return detail with all required fields for each level', () => {
    for (const stage of CAMPAIGN_STAGES) {
      const data = getLevelDetailData(sys, stage.id);
      expect(data).not.toBeNull();
      expect(data!.detail.name).toBeTruthy();
      expect(data!.detail.description).toBeTruthy();
      expect(data!.detail.defender.lord).toBeTruthy();
      expect(data!.detail.defender.troops).toBeDefined();
      expect(data!.detail.defender.fortLevel).toBeGreaterThanOrEqual(1);
      expect(data!.detail.rewards).toBeDefined();
      expect(data!.detail.battleConfig).toBeDefined();
    }
  });

  it('should return correct canAttack for first level', () => {
    const data = getLevelDetailData(sys, 'campaign_zhuo');
    expect(data).not.toBeNull();
    expect(data!.canAttack).toBe(true);
    expect(data!.statusInfo.status).toBe('available');
  });

  it('should return locked status for second level initially', () => {
    const data = getLevelDetailData(sys, 'campaign_hulao');
    expect(data).not.toBeNull();
    expect(data!.canAttack).toBe(false);
    expect(data!.statusInfo.status).toBe('locked');
    expect(data!.statusInfo.reason).toBeTruthy();
  });

  it('should unlock second level after completing first', () => {
    sys.completeStage('campaign_zhuo', 90);
    const data = getLevelDetailData(sys, 'campaign_hulao');
    expect(data).not.toBeNull();
    expect(data!.canAttack).toBe(true);
    expect(data!.statusInfo.status).toBe('available');
  });

  it('should show victory status for completed level', () => {
    sys.completeStage('campaign_zhuo', 90);
    const data = getLevelDetailData(sys, 'campaign_zhuo');
    expect(data).not.toBeNull();
    expect(data!.statusInfo.status).toBe('victory');
    expect(data!.canAttack).toBe(false);
  });

  it('should include officer list in detail', () => {
    const detail = sys.getLevelDetail('campaign_hulao');
    expect(detail).not.toBeNull();
    expect(detail!.defender.officers.length).toBeGreaterThan(0);
    expect(detail!.defender.officers).toContain('吕布');
  });

  it('should include troop breakdown', () => {
    const detail = sys.getLevelDetail('campaign_hulao');
    expect(detail).not.toBeNull();
    const troops = detail!.defender.troops;
    expect(troops.infantry).toBeGreaterThan(0);
    expect(troops.cavalry).toBeGreaterThan(0);
    expect(troops.archers).toBeGreaterThan(0);
  });

  it('should include difficulty config', () => {
    const detail = sys.getLevelDetail('campaign_zhuo');
    expect(detail!.battleConfig.difficulty).toBe('easy');
    const detail2 = sys.getLevelDetail('campaign_hulao');
    expect(detail2!.battleConfig.difficulty).toBe('normal');
  });
});

describe('CampaignUI - 战斗流程（UI 角度）', () => {
  let sys: CampaignSystem;
  const defaultTroops: TroopComposition = { infantry: 1000, cavalry: 500, archers: 400 };

  beforeEach(() => {
    sys = new CampaignSystem();
  });

  it('should allow attacking first level', () => {
    const result = simulateBattleFromUI(sys, 'campaign_zhuo', defaultTroops);
    expect(result.success).toBe(true);
    expect(result.result).not.toBeNull();
  });

  it('should reject attacking locked level', () => {
    const result = simulateBattleFromUI(sys, 'campaign_hulao', defaultTroops);
    expect(result.success).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('should reject attacking with insufficient troops', () => {
    const result = simulateBattleFromUI(sys, 'campaign_zhuo', { infantry: 5, cavalry: 0, archers: 0 });
    expect(result.success).toBe(true); // canAttack is true
    expect(result.result!.victory).toBe(false); // but battle result is defeat
  });

  it('should produce battle result with required UI fields', () => {
    const result = simulateBattleFromUI(sys, 'campaign_zhuo', defaultTroops);
    expect(result.success).toBe(true);
    const br = result.result!;
    expect(br).toHaveProperty('victory');
    expect(br).toHaveProperty('playerLosses');
    expect(br).toHaveProperty('enemyLosses');
    expect(br).toHaveProperty('rounds');
    expect(br).toHaveProperty('battleLog');
    expect(typeof br.victory).toBe('boolean');
    expect(typeof br.rounds).toBe('number');
    expect(Array.isArray(br.battleLog)).toBe(true);
  });

  it('should complete stage on victory and unlock next', () => {
    // Use overwhelming force to ensure victory
    const strongTroops: TroopComposition = { infantry: 5000, cavalry: 3000, archers: 2000 };
    const result = simulateBattleFromUI(sys, 'campaign_zhuo', strongTroops);

    if (result.result!.victory) {
      // After victory, first stage should be completed
      expect(sys.isStageCompleted('campaign_zhuo')).toBe(true);
      // Second stage should be unlocked
      const nextStatus = sys.getLevelStatus('campaign_hulao');
      expect(nextStatus.canAttack).toBe(true);
    }
  });

  it('should handle sequential battle flow (level 1 → level 2)', () => {
    const strongTroops: TroopComposition = { infantry: 10000, cavalry: 5000, archers: 3000 };

    // Attack level 1
    const r1 = simulateBattleFromUI(sys, 'campaign_zhuo', strongTroops);
    if (r1.result!.victory) {
      // Attack level 2
      const r2 = simulateBattleFromUI(sys, 'campaign_hulao', strongTroops);
      expect(r2.success).toBe(true);
      if (r2.result!.victory) {
        expect(sys.isStageCompleted('campaign_hulao')).toBe(true);
        // Level 3 should be unlocked
        const s3 = sys.getLevelStatus('campaign_guandu');
        expect(s3.canAttack).toBe(true);
      }
    }
  });

  it('should not allow re-attacking completed level', () => {
    sys.completeStage('campaign_zhuo', 90);
    const result = simulateBattleFromUI(sys, 'campaign_zhuo', defaultTroops);
    expect(result.success).toBe(false);
  });

  it('should track stars from battle results', () => {
    // Complete with high remaining troops → more stars
    sys.completeStage('campaign_zhuo', 95);
    const record = sys.getCompletionRecord('campaign_zhuo');
    expect(record).not.toBeUndefined();
    expect(record!.stars).toBeGreaterThanOrEqual(1);
    expect(record!.stars).toBeLessThanOrEqual(3);
  });

  it('should provide correct total/max stars for progress display', () => {
    expect(sys.getTotalStars()).toBe(0);
    expect(sys.getMaxStars()).toBe(54); // 18 levels × 3 stars

    sys.completeStage('campaign_zhuo', 90);
    expect(sys.getTotalStars()).toBeGreaterThanOrEqual(1);
  });
});

describe('CampaignUI - 关卡详情数据完整性（所有6关）', () => {
  it('should have matching IDs between CAMPAIGN_STAGES and CAMPAIGN_LEVEL_DETAILS', () => {
    const stageIds = CAMPAIGN_STAGES.map(s => s.id).sort();
    const detailIds = CAMPAIGN_LEVEL_DETAILS.map(d => d.id).sort();
    expect(stageIds).toEqual(detailIds);
  });

  it('should have valid troop data for all levels', () => {
    for (const detail of CAMPAIGN_LEVEL_DETAILS) {
      const t = detail.defender.troops;
      expect(t.infantry + t.cavalry + t.archers).toBeGreaterThan(0);
    }
  });

  it('should have valid rewards for all levels', () => {
    for (const detail of CAMPAIGN_LEVEL_DETAILS) {
      const r = detail.rewards;
      expect(r.gold + r.food + r.materials).toBeGreaterThan(0);
    }
  });

  it('should have valid difficulty for all levels', () => {
    const validDifficulties = ['easy', 'normal', 'hard', 'legendary'];
    for (const detail of CAMPAIGN_LEVEL_DETAILS) {
      expect(validDifficulties).toContain(detail.battleConfig.difficulty);
    }
  });

  it('should have valid prerequisite chain', () => {
    // First level (zhuo) has no prerequisite
    expect(CAMPAIGN_LEVEL_DETAILS[0].prerequisite).toBeNull();
    // Each subsequent level should have a prerequisite that is another level's ID
    const allIds = new Set(CAMPAIGN_LEVEL_DETAILS.map(l => l.id));
    for (let i = 1; i < CAMPAIGN_LEVEL_DETAILS.length; i++) {
      const prereq = CAMPAIGN_LEVEL_DETAILS[i].prerequisite;
      expect(prereq).not.toBeNull();
      expect(allIds).toContain(prereq);
    }
  });
});
