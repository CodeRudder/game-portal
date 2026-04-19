/**
 * HeroRecruitSystem 招募历史测试
 * 覆盖：getRecruitHistory、getRecruitHistoryCount、clearRecruitHistory
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeroRecruitSystem } from '../HeroRecruitSystem';
import type { RecruitDeps } from '../HeroRecruitSystem';
import { HeroSystem } from '../HeroSystem';
import { Quality } from '../hero.types';

// ── 辅助 ──

function makeRichDeps(heroSystem: HeroSystem): RecruitDeps {
  return {
    heroSystem,
    spendResource: vi.fn().mockReturnValue(true),
    canAffordResource: vi.fn().mockReturnValue(true),
  };
}

function makeConstantRng(value: number): () => number {
  return () => value;
}

// ═══════════════════════════════════════════════════════════════
describe('HeroRecruitSystem — 招募历史', () => {
  let heroSystem: HeroSystem;
  let recruit: HeroRecruitSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    recruit = new HeroRecruitSystem();
    recruit.setRecruitDeps(makeRichDeps(heroSystem));
  });

  // ───────────────────────────────────────────
  // 1. 历史记录基本功能
  // ───────────────────────────────────────────
  describe('基本功能', () => {
    it('初始历史为空', () => {
      expect(recruit.getRecruitHistoryCount()).toBe(0);
      expect(recruit.getRecruitHistory()).toEqual([]);
    });

    it('单抽后历史记录 +1', () => {
      recruit.recruitSingle('normal');
      expect(recruit.getRecruitHistoryCount()).toBe(1);
    });

    it('十连后历史记录 +1（十连算一次操作）', () => {
      recruit.recruitTen('normal');
      expect(recruit.getRecruitHistoryCount()).toBe(1);
      const history = recruit.getRecruitHistory();
      expect(history[0].results).toHaveLength(10);
    });

    it('历史记录包含正确字段', () => {
      recruit.recruitSingle('normal');
      const history = recruit.getRecruitHistory();
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('type');
      expect(history[0]).toHaveProperty('results');
      expect(history[0]).toHaveProperty('cost');
      expect(typeof history[0].timestamp).toBe('number');
    });

    it('历史记录包含正确的招募类型', () => {
      recruit.recruitSingle('advanced');
      const history = recruit.getRecruitHistory();
      expect(history[0].type).toBe('advanced');
    });

    it('历史记录包含正确的消耗', () => {
      recruit.recruitSingle('normal');
      const history = recruit.getRecruitHistory();
      expect(history[0].cost.resourceType).toBe('gold');
      expect(history[0].cost.amount).toBe(100);
    });
  });

  // ───────────────────────────────────────────
  // 2. 历史记录排序和限制
  // ───────────────────────────────────────────
  describe('排序和限制', () => {
    it('历史记录最新在前', () => {
      recruit.recruitSingle('normal');
      recruit.recruitSingle('advanced');
      const history = recruit.getRecruitHistory();
      expect(history[0].type).toBe('advanced');
      expect(history[1].type).toBe('normal');
    });

    it('历史记录最多保留 20 条', () => {
      for (let i = 0; i < 25; i++) {
        recruit.recruitSingle('normal');
      }
      expect(recruit.getRecruitHistoryCount()).toBe(20);
    });

    it('超过 20 条后保留最近的记录', () => {
      for (let i = 0; i < 22; i++) {
        recruit.recruitSingle('normal');
      }
      const history = recruit.getRecruitHistory();
      // 最新在前，应该看到最近 20 条
      expect(history.length).toBe(20);
    });
  });

  // ───────────────────────────────────────────
  // 3. 清空和重置
  // ───────────────────────────────────────────
  describe('清空和重置', () => {
    it('clearRecruitHistory 清空历史', () => {
      recruit.recruitSingle('normal');
      recruit.recruitSingle('normal');
      expect(recruit.getRecruitHistoryCount()).toBe(2);
      recruit.clearRecruitHistory();
      expect(recruit.getRecruitHistoryCount()).toBe(0);
    });

    it('reset 清空历史', () => {
      recruit.recruitSingle('normal');
      recruit.reset();
      expect(recruit.getRecruitHistoryCount()).toBe(0);
    });

    it('清空后可继续记录', () => {
      recruit.recruitSingle('normal');
      recruit.clearRecruitHistory();
      recruit.recruitSingle('advanced');
      expect(recruit.getRecruitHistoryCount()).toBe(1);
      expect(recruit.getRecruitHistory()[0].type).toBe('advanced');
    });
  });

  // ───────────────────────────────────────────
  // 4. 失败招募不记录历史
  // ───────────────────────────────────────────
  describe('失败不记录', () => {
    it('资源不足时不记录历史', () => {
      const poorDeps: RecruitDeps = {
        heroSystem,
        spendResource: vi.fn().mockReturnValue(false),
        canAffordResource: vi.fn().mockReturnValue(false),
      };
      recruit.setRecruitDeps(poorDeps);
      recruit.recruitSingle('normal');
      expect(recruit.getRecruitHistoryCount()).toBe(0);
    });

    it('依赖未设置时不记录历史', () => {
      const r = new HeroRecruitSystem();
      r.recruitSingle('normal');
      expect(r.getRecruitHistoryCount()).toBe(0);
    });
  });
});
