/**
 * 集成测试：战役地图（§1.1 ~ §1.4）
 *
 * 覆盖 Play v3.0 攻城略地(上) 中的 4 个流程：
 *   §1.1 查看章节与关卡列表
 *   §1.2 识别关卡类型
 *   §1.3 查看关卡状态
 *   §1.4 查看星级评定
 *
 * 测试策略：使用 campaignDataProvider 真实配置 + CampaignProgressSystem 引擎，
 * 验证从配置加载到进度查询的完整链路。
 */

import { CampaignProgressSystem } from '../../CampaignProgressSystem';
import {
  campaignDataProvider,
  getChapters,
  getChapter,
  getStage,
  getStagesByChapter,
} from '../../campaign-config';
import type { ICampaignDataProvider, Chapter, Stage, StageType, StageStatus } from '../../campaign.types';
import { MAX_STARS, STAGE_TYPE_LABELS, STAGE_STATUS_LABELS } from '../../campaign.types';

// ─────────────────────────────────────────────
// 共享 fixture
// ─────────────────────────────────────────────

/** 创建一个全新的进度系统实例 */
function createSystem(): CampaignProgressSystem {
  return new CampaignProgressSystem(campaignDataProvider);
}

/** 所有章节（来自真实配置） */
const allChapters = getChapters();

// ═══════════════════════════════════════════════
// §1.1 查看章节与关卡列表
// ═══════════════════════════════════════════════

describe('§1.1 查看章节与关卡列表', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = createSystem();
  });

  it('§1.1 应返回6个章节', () => {
    const chapters = campaignDataProvider.getChapters();
    expect(chapters).toHaveLength(6);
  });

  it('§1.1 章节应按 order 升序排列', () => {
    const chapters = campaignDataProvider.getChapters();
    for (let i = 1; i < chapters.length; i++) {
      expect(chapters[i].order).toBeGreaterThan(chapters[i - 1].order);
    }
  });

  it('§1.1 每个章节应包含关卡列表', () => {
    const chapters = campaignDataProvider.getChapters();
    for (const chapter of chapters) {
      expect(chapter.stages.length).toBeGreaterThan(0);
    }
  });

  it('§1.1 章节字段完整性：id/name/subtitle/order/stages', () => {
    const chapters = campaignDataProvider.getChapters();
    for (const ch of chapters) {
      expect(ch.id).toBeTruthy();
      expect(ch.name).toBeTruthy();
      expect(ch.subtitle).toBeTruthy();
      expect(typeof ch.order).toBe('number');
      expect(Array.isArray(ch.stages)).toBe(true);
    }
  });

  it('§1.1 getChapter 能按ID查找到指定章节', () => {
    const ch1 = campaignDataProvider.getChapter('chapter1');
    expect(ch1).not.toBeNull();
    expect(ch1!.name).toBe('黄巾之乱');
  });

  it('§1.1 getChapter 对不存在的章节返回 undefined', () => {
    const ch = campaignDataProvider.getChapter('chapter99');
    expect(ch).toBeUndefined();
  });

  it('§1.1 getStagesByChapter 返回章节内关卡列表', () => {
    const stages = campaignDataProvider.getStagesByChapter('chapter1');
    expect(stages.length).toBeGreaterThan(0);
    for (const st of stages) {
      expect(st.chapterId).toBe('chapter1');
    }
  });

  it('§1.1 getCurrentChapter 初始返回第1章', () => {
    const chapter = system.getCurrentChapter();
    expect(chapter).not.toBeNull();
    expect(chapter!.id).toBe('chapter1');
  });

  it('§1.1 章节前置关系链完整', () => {
    // chapter1 无前置，后续章节依次依赖
    expect(allChapters[0].prerequisiteChapterId).toBeNull();
    for (let i = 1; i < allChapters.length; i++) {
      expect(allChapters[i].prerequisiteChapterId).toBe(allChapters[i - 1].id);
    }
  });
});

// ═══════════════════════════════════════════════
// §1.2 识别关卡类型
// ═══════════════════════════════════════════════

describe('§1.2 识别关卡类型', () => {
  it('§1.2 关卡类型应为 normal/elite/boss 之一', () => {
    const validTypes: StageType[] = ['normal', 'elite', 'boss'];
    for (const ch of allChapters) {
      for (const st of ch.stages) {
        expect(validTypes).toContain(st.type);
      }
    }
  });

  it('§1.2 每章最后一关应为 BOSS 类型', () => {
    for (const ch of allChapters) {
      const lastStage = ch.stages[ch.stages.length - 1];
      expect(lastStage.type).toBe('boss');
    }
  });

  it('§1.2 每章应包含至少1个精英关卡', () => {
    for (const ch of allChapters) {
      const eliteCount = ch.stages.filter((s) => s.type === 'elite').length;
      expect(eliteCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('§1.2 关卡类型标签映射完整', () => {
    expect(STAGE_TYPE_LABELS.normal).toBe('普通');
    expect(STAGE_TYPE_LABELS.elite).toBe('精英');
    expect(STAGE_TYPE_LABELS.boss).toBe('BOSS');
  });

  it('§1.2 getStage 能获取关卡并读取类型', () => {
    const stage = getStage('chapter1_stage1');
    expect(stage).not.toBeUndefined();
    expect(typeof stage!.type).toBe('string');
  });

  it('§1.2 关卡 order 从1开始且连续', () => {
    for (const ch of allChapters) {
      for (let i = 0; i < ch.stages.length; i++) {
        expect(ch.stages[i].order).toBe(i + 1);
      }
    }
  });
});

// ═══════════════════════════════════════════════
// §1.3 查看关卡状态
// ═══════════════════════════════════════════════

describe('§1.3 查看关卡状态', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = createSystem();
  });

  it('§1.3 第1章第1关初始状态为 available（可挑战）', () => {
    expect(system.getStageStatus('chapter1_stage1')).toBe('available');
  });

  it('§1.3 第1章第2关初始状态为 locked（未解锁）', () => {
    expect(system.getStageStatus('chapter1_stage2')).toBe('locked');
  });

  it('§1.3 通关第1关后第2关变为 available', () => {
    system.completeStage('chapter1_stage1', 1);
    expect(system.getStageStatus('chapter1_stage2')).toBe('available');
  });

  it('§1.3 1星通关后状态为 cleared（已通关）', () => {
    system.completeStage('chapter1_stage1', 1);
    expect(system.getStageStatus('chapter1_stage1')).toBe('cleared');
  });

  it('§1.3 3星通关后状态为 threeStar（已满星）', () => {
    system.completeStage('chapter1_stage1', 3);
    expect(system.getStageStatus('chapter1_stage1')).toBe('threeStar');
  });

  it('§1.3 2星通关后状态为 cleared（非满星）', () => {
    system.completeStage('chapter1_stage1', 2);
    expect(system.getStageStatus('chapter1_stage1')).toBe('cleared');
  });

  it('§1.3 不存在的关卡状态为 locked', () => {
    expect(system.getStageStatus('nonexistent_stage')).toBe('locked');
  });

  it('§1.3 canChallenge 对 available 状态返回 true', () => {
    expect(system.canChallenge('chapter1_stage1')).toBe(true);
  });

  it('§1.3 canChallenge 对 locked 状态返回 false', () => {
    expect(system.canChallenge('chapter1_stage2')).toBe(false);
  });

  it('§1.3 canChallenge 对 cleared 状态返回 true（可重复挑战）', () => {
    system.completeStage('chapter1_stage1', 1);
    expect(system.canChallenge('chapter1_stage1')).toBe(true);
  });

  it('§1.3 canChallenge 对 threeStar 状态返回 true（可重复挑战）', () => {
    system.completeStage('chapter1_stage1', 3);
    expect(system.canChallenge('chapter1_stage1')).toBe(true);
  });

  it('§1.3 状态标签映射完整', () => {
    expect(STAGE_STATUS_LABELS.locked).toBe('未解锁');
    expect(STAGE_STATUS_LABELS.available).toBe('可挑战');
    expect(STAGE_STATUS_LABELS.cleared).toBe('已通关');
    expect(STAGE_STATUS_LABELS.threeStar).toBe('三星通关');
  });

  it('§1.3 跨章节解锁：通关第1章BOSS后第2章第1关解锁', () => {
    const ch1Stages = getStagesByChapter('chapter1');
    for (const st of ch1Stages) {
      system.completeStage(st.id, 1);
    }
    expect(system.getStageStatus('chapter2_stage1')).toBe('available');
  });

  it('§1.3 跨章节锁定：未通关第1章BOSS时第2章锁定', () => {
    const ch1Stages = getStagesByChapter('chapter1');
    // 只通关到倒数第二关
    for (let i = 0; i < ch1Stages.length - 1; i++) {
      system.completeStage(ch1Stages[i].id, 1);
    }
    expect(system.getStageStatus('chapter2_stage1')).toBe('locked');
  });
});

// ═══════════════════════════════════════════════
// §1.4 查看星级评定
// ═══════════════════════════════════════════════

describe('§1.4 查看星级评定', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = createSystem();
  });

  it('§1.4 初始所有关卡星级为0', () => {
    for (const ch of allChapters) {
      for (const st of ch.stages) {
        expect(system.getStageStars(st.id)).toBe(0);
      }
    }
  });

  it('§1.4 1星通关后星级为1', () => {
    system.completeStage('chapter1_stage1', 1);
    expect(system.getStageStars('chapter1_stage1')).toBe(1);
  });

  it('§1.4 2星通关后星级为2', () => {
    system.completeStage('chapter1_stage1', 2);
    expect(system.getStageStars('chapter1_stage1')).toBe(2);
  });

  it('§1.4 3星通关后星级为3', () => {
    system.completeStage('chapter1_stage1', 3);
    expect(system.getStageStars('chapter1_stage1')).toBe(3);
  });

  it('§1.4 重复通关星级取最高（3→1 不降级）', () => {
    system.completeStage('chapter1_stage1', 3);
    system.completeStage('chapter1_stage1', 1);
    expect(system.getStageStars('chapter1_stage1')).toBe(3);
  });

  it('§1.4 重复通关星级可升级（1→3）', () => {
    system.completeStage('chapter1_stage1', 1);
    expect(system.getStageStars('chapter1_stage1')).toBe(1);
    system.completeStage('chapter1_stage1', 3);
    expect(system.getStageStars('chapter1_stage1')).toBe(3);
  });

  it('§1.4 MAX_STARS 常量为3', () => {
    expect(MAX_STARS).toBe(3);
  });

  it('§1.4 超出范围星级被截断为3', () => {
    system.completeStage('chapter1_stage1', 5);
    expect(system.getStageStars('chapter1_stage1')).toBe(3);
  });

  it('§1.4 负星级被截断为0', () => {
    system.completeStage('chapter1_stage1', -1);
    expect(system.getStageStars('chapter1_stage1')).toBe(0);
  });

  it('§1.4 getTotalStars 统计所有关卡星级之和', () => {
    system.completeStage('chapter1_stage1', 3);
    system.completeStage('chapter1_stage2', 2);
    system.completeStage('chapter1_stage3', 1);
    expect(system.getTotalStars()).toBe(6);
  });

  it('§1.4 getTotalStars 初始为0', () => {
    expect(system.getTotalStars()).toBe(0);
  });

  it('§1.4 通关次数累加正确', () => {
    system.completeStage('chapter1_stage1', 1);
    system.completeStage('chapter1_stage1', 2);
    system.completeStage('chapter1_stage1', 3);
    expect(system.getClearCount('chapter1_stage1')).toBe(3);
  });

  it('§1.4 首通标记在首次通关后为 true', () => {
    expect(system.isFirstCleared('chapter1_stage1')).toBe(false);
    system.completeStage('chapter1_stage1', 1);
    expect(system.isFirstCleared('chapter1_stage1')).toBe(true);
  });

  it('§1.4 不存在的关卡星级为0', () => {
    expect(system.getStageStars('nonexistent')).toBe(0);
  });
});
