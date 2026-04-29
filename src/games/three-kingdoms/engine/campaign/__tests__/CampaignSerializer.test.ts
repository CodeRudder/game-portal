/**
 * CampaignSerializer 单元测试
 *
 * 覆盖序列化/反序列化纯函数：
 * - serializeProgress：进度 → 存档数据
 * - deserializeProgress：存档数据 → 进度（含版本校验、新关卡补全）
 */

import { describe, it, expect } from 'vitest';
import { serializeProgress, deserializeProgress, SAVE_VERSION } from '../CampaignSerializer';
import type {
  CampaignProgress,
  CampaignSaveData,
  ICampaignDataProvider,
  Chapter,
  Stage,
} from '../campaign.types';

// ─────────────────────────────────────────────
// 辅助：创建测试用数据提供者
// ─────────────────────────────────────────────

function createDataProvider(chapters?: Chapter[]): ICampaignDataProvider {
  const defaultChapters: Chapter[] = [
    {
      id: 'chapter1',
      name: '测试章1',
      subtitle: '',
      order: 1,
      stages: [
        {
          id: 'stage_1_1', name: '关卡1-1', type: 'normal', chapterId: 'chapter1',
          order: 1, enemyFormation: { id: 'ef1', name: 'ef1', units: [], recommendedPower: 100 },
          baseRewards: { grain: 100 }, baseExp: 50, firstClearRewards: { gold: 50 },
          firstClearExp: 20, threeStarBonusMultiplier: 2.0, dropTable: [],
          recommendedPower: 100, description: '',
        },
        {
          id: 'stage_1_2', name: '关卡1-2', type: 'elite', chapterId: 'chapter1',
          order: 2, enemyFormation: { id: 'ef2', name: 'ef2', units: [], recommendedPower: 200 },
          baseRewards: { grain: 200 }, baseExp: 100, firstClearRewards: { gold: 100 },
          firstClearExp: 30, threeStarBonusMultiplier: 2.0, dropTable: [],
          recommendedPower: 200, description: '',
        },
      ],
      prerequisiteChapterId: null,
      description: '',
    },
    {
      id: 'chapter2',
      name: '测试章2',
      subtitle: '',
      order: 2,
      stages: [
        {
          id: 'stage_2_1', name: '关卡2-1', type: 'normal', chapterId: 'chapter2',
          order: 1, enemyFormation: { id: 'ef3', name: 'ef3', units: [], recommendedPower: 300 },
          baseRewards: { grain: 300 }, baseExp: 150, firstClearRewards: { gold: 150 },
          firstClearExp: 40, threeStarBonusMultiplier: 2.0, dropTable: [],
          recommendedPower: 300, description: '',
        },
      ],
      prerequisiteChapterId: 'chapter1',
      description: '',
    },
  ];

  const ch = chapters ?? defaultChapters;
  return {
    getChapters: () => ch,
    getChapter: (id: string) => ch.find(c => c.id === id),
    getStage: (id: string) => {
      for (const c of ch) {
        const s = c.stages.find(st => st.id === id);
        if (s) return s;
      }
      return undefined;
    },
    getStagesByChapter: (chapterId: string) => ch.find(c => c.id === chapterId)?.stages ?? [],
  };
}

// ─────────────────────────────────────────────
// 1. serializeProgress
// ─────────────────────────────────────────────

describe('CampaignSerializer serializeProgress', () => {
  it('序列化空进度', () => {
    const progress: CampaignProgress = {
      currentChapterId: 'chapter1',
      stageStates: {},
      lastClearTime: 0,
    };
    const data = serializeProgress(progress);
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.progress.currentChapterId).toBe('chapter1');
    expect(data.progress.stageStates).toEqual({});
    expect(data.progress.lastClearTime).toBe(0);
  });

  it('序列化包含关卡状态的进度', () => {
    const progress: CampaignProgress = {
      currentChapterId: 'chapter1',
      stageStates: {
        'stage_1_1': { stageId: 'stage_1_1', stars: 3, firstCleared: true, clearCount: 5 },
        'stage_1_2': { stageId: 'stage_1_2', stars: 1, firstCleared: true, clearCount: 1 },
      },
      lastClearTime: 1000,
    };
    const data = serializeProgress(progress);
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.progress.stageStates['stage_1_1'].stars).toBe(3);
    expect(data.progress.stageStates['stage_1_2'].stars).toBe(1);
    expect(data.progress.lastClearTime).toBe(1000);
  });

  it('序列化产生深拷贝（修改原数据不影响存档）', () => {
    const progress: CampaignProgress = {
      currentChapterId: 'chapter1',
      stageStates: {
        'stage_1_1': { stageId: 'stage_1_1', stars: 1, firstCleared: false, clearCount: 0 },
      },
      lastClearTime: 0,
    };
    const data = serializeProgress(progress);
    progress.stageStates['stage_1_1'].stars = 3;
    expect(data.progress.stageStates['stage_1_1'].stars).toBe(1);
  });
});

// ─────────────────────────────────────────────
// 2. deserializeProgress
// ─────────────────────────────────────────────

describe('CampaignSerializer deserializeProgress', () => {
  it('反序列化有效数据', () => {
    const data: CampaignSaveData = {
      version: SAVE_VERSION,
      progress: {
        currentChapterId: 'chapter1',
        stageStates: {
          'stage_1_1': { stageId: 'stage_1_1', stars: 3, firstCleared: true, clearCount: 5 },
        },
        lastClearTime: 1000,
      },
    };
    const provider = createDataProvider();
    const progress = deserializeProgress(data, provider);
    expect(progress.currentChapterId).toBe('chapter1');
    expect(progress.stageStates['stage_1_1'].stars).toBe(3);
    expect(progress.lastClearTime).toBe(1000);
  });

  it('版本不匹配时抛出异常', () => {
    const data: CampaignSaveData = {
      version: 999,
      progress: {
        currentChapterId: 'chapter1',
        stageStates: {},
        lastClearTime: 0,
      },
    };
    const provider = createDataProvider();
    expect(() => deserializeProgress(data, provider)).toThrow('存档版本不兼容');
  });

  it('补全新增关卡（存档中不存在的关卡初始化为未通关）', () => {
    const data: CampaignSaveData = {
      version: SAVE_VERSION,
      progress: {
        currentChapterId: 'chapter1',
        stageStates: {
          'stage_1_1': { stageId: 'stage_1_1', stars: 3, firstCleared: true, clearCount: 5 },
        },
        lastClearTime: 0,
      },
    };
    const provider = createDataProvider();
    const progress = deserializeProgress(data, provider);
    // stage_1_1 来自存档
    expect(progress.stageStates['stage_1_1'].stars).toBe(3);
    // stage_1_2 和 stage_2_1 是新增的
    expect(progress.stageStates['stage_1_2']).toBeDefined();
    expect(progress.stageStates['stage_1_2'].stars).toBe(0);
    expect(progress.stageStates['stage_1_2'].firstCleared).toBe(false);
    expect(progress.stageStates['stage_1_2'].clearCount).toBe(0);
    expect(progress.stageStates['stage_2_1']).toBeDefined();
    expect(progress.stageStates['stage_2_1'].stars).toBe(0);
  });

  it('空存档 + 完整数据提供者 → 所有关卡初始化', () => {
    const data: CampaignSaveData = {
      version: SAVE_VERSION,
      progress: {
        currentChapterId: 'chapter1',
        stageStates: {},
        lastClearTime: 0,
      },
    };
    const provider = createDataProvider();
    const progress = deserializeProgress(data, provider);
    // 所有3个关卡都应存在
    expect(Object.keys(progress.stageStates)).toHaveLength(3);
    for (const state of Object.values(progress.stageStates)) {
      expect(state.stars).toBe(0);
      expect(state.firstCleared).toBe(false);
      expect(state.clearCount).toBe(0);
    }
  });

  it('反序列化产生深拷贝', () => {
    const data: CampaignSaveData = {
      version: SAVE_VERSION,
      progress: {
        currentChapterId: 'chapter1',
        stageStates: {
          'stage_1_1': { stageId: 'stage_1_1', stars: 2, firstCleared: true, clearCount: 3 },
        },
        lastClearTime: 500,
      },
    };
    const provider = createDataProvider();
    const progress = deserializeProgress(data, provider);
    data.progress.stageStates['stage_1_1'].stars = 3;
    expect(progress.stageStates['stage_1_1'].stars).toBe(2);
  });

  it('round-trip: 序列化→反序列化保持一致', () => {
    const provider = createDataProvider();
    const original: CampaignProgress = {
      currentChapterId: 'chapter2',
      stageStates: {
        'stage_1_1': { stageId: 'stage_1_1', stars: 3, firstCleared: true, clearCount: 10 },
        'stage_1_2': { stageId: 'stage_1_2', stars: 2, firstCleared: true, clearCount: 3 },
        'stage_2_1': { stageId: 'stage_2_1', stars: 1, firstCleared: true, clearCount: 1 },
      },
      lastClearTime: 9999,
    };
    const data = serializeProgress(original);
    const restored = deserializeProgress(data, provider);
    expect(restored.currentChapterId).toBe(original.currentChapterId);
    expect(restored.lastClearTime).toBe(original.lastClearTime);
    for (const [id, state] of Object.entries(original.stageStates)) {
      expect(restored.stageStates[id].stars).toBe(state.stars);
      expect(restored.stageStates[id].firstCleared).toBe(state.firstCleared);
      expect(restored.stageStates[id].clearCount).toBe(state.clearCount);
    }
  });
});

// ─────────────────────────────────────────────
// 3. SAVE_VERSION 常量
// ─────────────────────────────────────────────

describe('CampaignSerializer 常量', () => {
  it('SAVE_VERSION 为 1', () => {
    expect(SAVE_VERSION).toBe(1);
  });
});
