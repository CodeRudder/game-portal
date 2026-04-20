/**
 * 关卡配置测试
 *
 * 验证 campaign-config.ts 中的关卡数据完整性。
 */

import {
  ALL_CHAPTERS,
  CHAPTER_1,
  CHAPTER_2,
  CHAPTER_3,
  getChapters,
  getChapter,
  getStage,
  getStagesByChapter,
} from '../campaign-config';
import type { Chapter, Stage, StageType } from '../campaign.types';

// ─────────────────────────────────────────────
// 1. 章节数据完整性
// ─────────────────────────────────────────────

describe('campaign-config 章节数据', () => {
  it('应有6个章节', () => {
    expect(ALL_CHAPTERS).toHaveLength(6);
  });

  it('章节应按 order 排序', () => {
    for (let i = 0; i < ALL_CHAPTERS.length - 1; i++) {
      expect(ALL_CHAPTERS[i].order).toBeLessThan(ALL_CHAPTERS[i + 1].order);
    }
  });

  it('第1章无前置章节', () => {
    expect(CHAPTER_1.prerequisiteChapterId).toBeNull();
  });

  it('第2章前置为第1章', () => {
    expect(CHAPTER_2.prerequisiteChapterId).toBe('chapter1');
  });

  it('第3章前置为第2章', () => {
    expect(CHAPTER_3.prerequisiteChapterId).toBe('chapter2');
  });

  it('章节ID格式正确', () => {
    for (const ch of ALL_CHAPTERS) {
      expect(ch.id).toMatch(/^chapter\d+$/);
    }
  });

  it('章节名称不为空', () => {
    for (const ch of ALL_CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(0);
      expect(ch.subtitle.length).toBeGreaterThan(0);
      expect(ch.description.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────
// 2. 关卡数据完整性
// ─────────────────────────────────────────────

describe('campaign-config 关卡数据', () => {
  it('每章应有8关', () => {
    for (const ch of ALL_CHAPTERS) {
      expect(ch.stages).toHaveLength(8);
    }
  });

  it('总关卡数应为48', () => {
    const total = ALL_CHAPTERS.reduce((sum, ch) => sum + ch.stages.length, 0);
    expect(total).toBe(48);
  });

  it('关卡ID格式正确', () => {
    for (const ch of ALL_CHAPTERS) {
      for (const st of ch.stages) {
        expect(st.id).toBe(`${ch.id}_stage${st.order}`);
      }
    }
  });

  it('关卡order从1开始连续递增', () => {
    for (const ch of ALL_CHAPTERS) {
      for (let i = 0; i < ch.stages.length; i++) {
        expect(ch.stages[i].order).toBe(i + 1);
      }
    }
  });

  it('每章最后一关应为BOSS', () => {
    for (const ch of ALL_CHAPTERS) {
      const lastStage = ch.stages[ch.stages.length - 1];
      expect(lastStage.type).toBe('boss');
    }
  });

  it('第1章：6普通+1精英+1BOSS', () => {
    const types = CHAPTER_1.stages.map((s) => s.type);
    expect(types.filter((t) => t === 'normal')).toHaveLength(6);
    expect(types.filter((t) => t === 'elite')).toHaveLength(1);
    expect(types.filter((t) => t === 'boss')).toHaveLength(1);
  });

  it('第2章：5普通+2精英+1BOSS', () => {
    const types = CHAPTER_2.stages.map((s) => s.type);
    expect(types.filter((t) => t === 'normal')).toHaveLength(5);
    expect(types.filter((t) => t === 'elite')).toHaveLength(2);
    expect(types.filter((t) => t === 'boss')).toHaveLength(1);
  });

  it('第3章：5普通+2精英+1BOSS', () => {
    const types = CHAPTER_3.stages.map((s) => s.type);
    expect(types.filter((t) => t === 'normal')).toHaveLength(5);
    expect(types.filter((t) => t === 'elite')).toHaveLength(2);
    expect(types.filter((t) => t === 'boss')).toHaveLength(1);
  });

  it('每关敌方阵容3-6个单位', () => {
    for (const ch of ALL_CHAPTERS) {
      for (const st of ch.stages) {
        expect(st.enemyFormation.units.length).toBeGreaterThanOrEqual(3);
        expect(st.enemyFormation.units.length).toBeLessThanOrEqual(6);
      }
    }
  });

  it('敌方单位属性为正数', () => {
    for (const ch of ALL_CHAPTERS) {
      for (const st of ch.stages) {
        for (const unit of st.enemyFormation.units) {
          expect(unit.attack).toBeGreaterThan(0);
          expect(unit.defense).toBeGreaterThan(0);
          expect(unit.intelligence).toBeGreaterThan(0);
          expect(unit.speed).toBeGreaterThan(0);
          expect(unit.maxHp).toBeGreaterThan(0);
          expect(unit.level).toBeGreaterThan(0);
        }
      }
    }
  });

  it('敌方单位position只能是front或back', () => {
    for (const ch of ALL_CHAPTERS) {
      for (const st of ch.stages) {
        for (const unit of st.enemyFormation.units) {
          expect(['front', 'back']).toContain(unit.position);
        }
      }
    }
  });

  it('推荐战力递增（章节内）', () => {
    for (const ch of ALL_CHAPTERS) {
      for (let i = 1; i < ch.stages.length; i++) {
        expect(ch.stages[i].recommendedPower).toBeGreaterThanOrEqual(
          ch.stages[i - 1].recommendedPower,
        );
      }
    }
  });

  it('掉落表概率在0-1之间', () => {
    for (const ch of ALL_CHAPTERS) {
      for (const st of ch.stages) {
        for (const drop of st.dropTable) {
          expect(drop.probability).toBeGreaterThan(0);
          expect(drop.probability).toBeLessThanOrEqual(1);
          expect(drop.minAmount).toBeGreaterThan(0);
          expect(drop.maxAmount).toBeGreaterThanOrEqual(drop.minAmount);
        }
      }
    }
  });

  it('BOSS关三星倍率应为2.0', () => {
    for (const ch of ALL_CHAPTERS) {
      const boss = ch.stages[ch.stages.length - 1];
      expect(boss.threeStarBonusMultiplier).toBe(2.0);
    }
  });

  it('非BOSS关三星倍率应为1.5或1.8', () => {
    for (const ch of ALL_CHAPTERS) {
      for (const st of ch.stages.slice(0, -1)) {
        expect([1.5, 1.8]).toContain(st.threeStarBonusMultiplier);
      }
    }
  });

  it('基础奖励不为空', () => {
    for (const ch of ALL_CHAPTERS) {
      for (const st of ch.stages) {
        expect(Object.keys(st.baseRewards).length).toBeGreaterThan(0);
        expect(st.baseExp).toBeGreaterThan(0);
      }
    }
  });

  it('首通奖励大于基础奖励', () => {
    for (const ch of ALL_CHAPTERS) {
      for (const st of ch.stages) {
        expect(st.firstClearExp).toBeGreaterThan(st.baseExp);
      }
    }
  });

  it('关卡描述不为空', () => {
    for (const ch of ALL_CHAPTERS) {
      for (const st of ch.stages) {
        expect(st.description.length).toBeGreaterThan(0);
      }
    }
  });
});

// ─────────────────────────────────────────────
// 3. 查询函数
// ─────────────────────────────────────────────

describe('campaign-config 查询函数', () => {
  it('getChapters 返回所有章节', () => {
    expect(getChapters()).toEqual(ALL_CHAPTERS);
  });

  it('getChapter 返回正确章节', () => {
    expect(getChapter('chapter1')).toBe(CHAPTER_1);
    expect(getChapter('chapter2')).toBe(CHAPTER_2);
    expect(getChapter('chapter3')).toBe(CHAPTER_3);
  });

  it('getChapter 不存在返回 undefined', () => {
    expect(getChapter('chapter99')).toBeUndefined();
  });

  it('getStage 返回正确关卡', () => {
    const stage = getStage('chapter1_stage1');
    expect(stage).toBeDefined();
    expect(stage!.name).toBe('黄巾前哨');
  });

  it('getStage 不存在返回 undefined', () => {
    expect(getStage('nonexistent')).toBeUndefined();
  });

  it('getStagesByChapter 返回章节内所有关卡', () => {
    const stages = getStagesByChapter('chapter1');
    expect(stages).toHaveLength(8);
    expect(stages[0].id).toBe('chapter1_stage1');
    expect(stages[7].id).toBe('chapter1_stage8');
  });

  it('getStagesByChapter 不存在返回空数组', () => {
    expect(getStagesByChapter('chapter99')).toEqual([]);
  });

  it('所有关卡ID全局唯一', () => {
    const ids = new Set<string>();
    for (const ch of ALL_CHAPTERS) {
      for (const st of ch.stages) {
        expect(ids.has(st.id)).toBe(false);
        ids.add(st.id);
      }
    }
    expect(ids.size).toBe(48);
  });
});
