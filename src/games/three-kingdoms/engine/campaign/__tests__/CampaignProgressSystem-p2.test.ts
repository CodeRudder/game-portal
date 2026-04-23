import { CampaignProgressSystem } from '../CampaignProgressSystem';
import type { ICampaignDataProvider, CampaignSaveData } from '../campaign.types';
import { getChapters, getChapter, getStage, getStagesByChapter } from '../campaign-config';

describe('CampaignProgressSystem 边界情况', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = new CampaignProgressSystem(dataProvider);
  });

  it('getProgress 返回深拷贝（不影响内部状态）', () => {
    system.completeStage('chapter1_stage1', 1);
    const progress = system.getProgress();
    progress.stageStates['chapter1_stage1'].stars = 3;
    // 内部状态不受影响
    expect(system.getStageStars('chapter1_stage1')).toBe(1);
  });

  it('重复调用 initProgress 不出错', () => {
    system.initProgress();
    system.initProgress();
    expect(system.getTotalStars()).toBe(0);
  });

  it('0星通关仍记录通关次数', () => {
    system.completeStage('chapter1_stage1', 0);
    expect(system.getClearCount('chapter1_stage1')).toBe(1);
    expect(system.getStageStars('chapter1_stage1')).toBe(0);
  });

  it('小数星级被截断', () => {
    system.completeStage('chapter1_stage1', 2.7);
    expect(system.getStageStars('chapter1_stage1')).toBe(2);
  });
});

// ─────────────────────────────────────────────
// 7. 逐关解锁链路测试
// ─────────────────────────────────────────────

describe('CampaignProgressSystem 逐关解锁链路', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = new CampaignProgressSystem(dataProvider);
  });

  it('第1关→第2关→第3关 逐关解锁', () => {
    expect(system.getStageStatus('chapter1_stage2')).toBe('locked');
    expect(system.getStageStatus('chapter1_stage3')).toBe('locked');

    system.completeStage('chapter1_stage1', 1);
    expect(system.getStageStatus('chapter1_stage2')).toBe('available');
    expect(system.getStageStatus('chapter1_stage3')).toBe('locked');

    system.completeStage('chapter1_stage2', 1);
    expect(system.getStageStatus('chapter1_stage3')).toBe('available');
  });

  it('跳关不解锁（不能跳过中间关卡）', () => {
    system.completeStage('chapter1_stage1', 3);
    // 即使3星通关第1关，第3关仍然锁定
    expect(system.getStageStatus('chapter1_stage3')).toBe('locked');
  });

  it('第2章第1关需要第1章BOSS通关', () => {
    // 通关第1章前7关，但不是BOSS
    for (let i = 1; i <= 7; i++) {
      system.completeStage(`chapter1_stage${i}`, 3);
    }
    expect(system.getStageStatus('chapter2_stage1')).toBe('locked');

    // 通关BOSS
    system.completeStage('chapter1_stage8', 1);
    expect(system.getStageStatus('chapter2_stage1')).toBe('available');
  });

  it('第2章内逐关解锁', () => {
    // 先通关第1章全部
    for (let i = 1; i <= 8; i++) {
      system.completeStage(`chapter1_stage${i}`, 1);
    }
    expect(system.getStageStatus('chapter2_stage2')).toBe('locked');

    system.completeStage('chapter2_stage1', 1);
    expect(system.getStageStatus('chapter2_stage2')).toBe('available');
  });

  it('第3章需要第2章BOSS通关', () => {
    // 通关第1章
    for (let i = 1; i <= 8; i++) {
      system.completeStage(`chapter1_stage${i}`, 1);
    }
    // 通关第2章前7关
    for (let i = 1; i <= 7; i++) {
      system.completeStage(`chapter2_stage${i}`, 1);
    }
    expect(system.getStageStatus('chapter3_stage1')).toBe('locked');

    system.completeStage('chapter2_stage8', 1);
    expect(system.getStageStatus('chapter3_stage1')).toBe('available');
  });
});

// ─────────────────────────────────────────────
// 8. canChallenge 详细场景
// ─────────────────────────────────────────────

describe('CampaignProgressSystem canChallenge 详细场景', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = new CampaignProgressSystem(dataProvider);
  });

  it('已通关关卡可以重复挑战', () => {
    system.completeStage('chapter1_stage1', 1);
    expect(system.canChallenge('chapter1_stage1')).toBe(true);
  });

  it('三星通关关卡可以重复挑战', () => {
    system.completeStage('chapter1_stage1', 3);
    expect(system.canChallenge('chapter1_stage1')).toBe(true);
  });

  it('未解锁关卡不可挑战', () => {
    expect(system.canChallenge('chapter1_stage5')).toBe(false);
  });

  it('不存在的关卡不可挑战', () => {
    expect(system.canChallenge('fake_stage')).toBe(false);
  });

  it('刚解锁的关卡可以挑战', () => {
    system.completeStage('chapter1_stage1', 1);
    expect(system.canChallenge('chapter1_stage2')).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 9. 星级 & 统计详细测试
// ─────────────────────────────────────────────

describe('CampaignProgressSystem 星级统计', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = new CampaignProgressSystem(dataProvider);
  });

  it('全部三星通关总星数正确', () => {
    let stageCount = 0;
    for (const ch of getChapters()) {
      for (const st of ch.stages) {
        system.completeStage(st.id, 3);
        stageCount++;
      }
    }
    expect(system.getTotalStars()).toBe(stageCount * 3);
  });

  it('混合星级总星数正确', () => {
    system.completeStage('chapter1_stage1', 1);
    system.completeStage('chapter1_stage2', 2);
    system.completeStage('chapter1_stage3', 3);
    expect(system.getTotalStars()).toBe(6);
  });

  it('未通关关卡星级为0', () => {
    expect(system.getStageStars('chapter1_stage1')).toBe(0);
    expect(system.getStageStars('chapter1_stage5')).toBe(0);
  });

  it('getClearCount 不存在的关卡返回0', () => {
    expect(system.getClearCount('nonexistent')).toBe(0);
  });

  it('isFirstCleared 不存在的关卡返回false', () => {
    expect(system.isFirstCleared('nonexistent')).toBe(false);
  });

  it('多次重复通关次数正确累加', () => {
    for (let i = 0; i < 5; i++) {
      system.completeStage('chapter1_stage1', 1);
    }
    expect(system.getClearCount('chapter1_stage1')).toBe(5);
  });
});

// ─────────────────────────────────────────────
// 10. 序列化边界情况
// ─────────────────────────────────────────────

describe('CampaignProgressSystem 序列化边界', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = new CampaignProgressSystem(dataProvider);
  });

  it('空进度序列化/反序列化正确', () => {
    system.initProgress();
    const saved = system.serialize();
    const newSystem = new CampaignProgressSystem(dataProvider);
    newSystem.deserialize(saved);
    expect(newSystem.getTotalStars()).toBe(0);
    expect(newSystem.getStageStatus('chapter1_stage1')).toBe('available');
  });

  it('序列化数据包含所有关卡', () => {
    system.initProgress();
    const saved = system.serialize();
    const allStages = getChapters().flatMap(ch => ch.stages.map(st => st.id));
    for (const stageId of allStages) {
      expect(saved.progress.stageStates[stageId]).toBeDefined();
    }
  });

  it('反序列化后通关次数保持', () => {
    system.completeStage('chapter1_stage1', 1);
    system.completeStage('chapter1_stage1', 2);
    system.completeStage('chapter1_stage1', 3);

    const saved = system.serialize();
    const newSystem = new CampaignProgressSystem(dataProvider);
    newSystem.deserialize(saved);
    expect(newSystem.getClearCount('chapter1_stage1')).toBe(3);
  });

  it('反序列化后章节推进状态保持', () => {
    for (let i = 1; i <= 8; i++) {
      system.completeStage(`chapter1_stage${i}`, 1);
    }
    const saved = system.serialize();
    const newSystem = new CampaignProgressSystem(dataProvider);
    newSystem.deserialize(saved);
    expect(newSystem.getCurrentChapter()!.id).toBe('chapter2');
  });

  it('反序列化后 lastClearTime 保持', () => {
    system.completeStage('chapter1_stage1', 1);
    const saved = system.serialize();
    const newSystem = new CampaignProgressSystem(dataProvider);
    newSystem.deserialize(saved);
    expect(newSystem.getProgress().lastClearTime).toBe(saved.progress.lastClearTime);
  });
});

// ─────────────────────────────────────────────
// 11. getCurrentChapter 边界
// ─────────────────────────────────────────────

describe('CampaignProgressSystem getCurrentChapter', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = new CampaignProgressSystem(dataProvider);
  });

  it('初始时当前章节为第1章', () => {
    expect(system.getCurrentChapter()!.id).toBe('chapter1');
  });

  it('通关第1章BOSS后推进到第2章', () => {
    for (let i = 1; i <= 8; i++) {
      system.completeStage(`chapter1_stage${i}`, 1);
    }
    expect(system.getCurrentChapter()!.id).toBe('chapter2');
  });

  it('未通关第1章BOSS不推进', () => {
    for (let i = 1; i <= 7; i++) {
      system.completeStage(`chapter1_stage${i}`, 1);
    }
    expect(system.getCurrentChapter()!.id).toBe('chapter1');
  });

  it('通关全部章节后停留在最后一章', () => {
    for (const ch of getChapters()) {
      for (const st of ch.stages) {
        system.completeStage(st.id, 1);
      }
    }
    const chapters = getChapters();
    expect(system.getCurrentChapter()!.id).toBe(chapters[chapters.length - 1].id);
  });
});

// ─────────────────────────────────────────────
// 12. init 依赖注入
// ─────────────────────────────────────────────

describe('CampaignProgressSystem ISubsystem', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = new CampaignProgressSystem(dataProvider);
  });

  it('init 注入依赖不报错', () => {
    const mockDeps = { eventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() } } as unknown as Record<string, unknown>;
    expect(() => system.init(mockDeps)).not.toThrow();
  });

  it('update 多次调用不报错', () => {
    for (let i = 0; i < 100; i++) {
      system.update(0.016);
    }
  });

  it('getState 返回与 getProgress 相同的 currentChapterId', () => {
    system.completeStage('chapter1_stage1', 1);
    const state = system.getState();
    const progress = system.getProgress();
    expect(state.currentChapterId).toBe(progress.currentChapterId);
  });
});
