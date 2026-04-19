/**
 * 关卡进度系统测试
 *
 * 覆盖：初始化、状态查询、通关处理、解锁逻辑、序列化、ISubsystem接口。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CampaignProgressSystem } from '../CampaignProgressSystem';
import type { ICampaignDataProvider, CampaignSaveData } from '../campaign.types';
import { getChapters, getChapter, getStage, getStagesByChapter } from '../campaign-config';

// 使用实际配置作为数据提供者
const dataProvider: ICampaignDataProvider = {
  getChapters,
  getChapter,
  getStage,
  getStagesByChapter,
};

// ─────────────────────────────────────────────
// 1. 初始化 & ISubsystem
// ─────────────────────────────────────────────

describe('CampaignProgressSystem 初始化', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = new CampaignProgressSystem(dataProvider);
  });

  it('ISubsystem.name 为 campaignProgress', () => {
    expect(system.name).toBe('campaignProgress');
  });

  it('initProgress 后第1章第1关状态为 available', () => {
    system.initProgress();
    expect(system.getStageStatus('chapter1_stage1')).toBe('available');
  });

  it('initProgress 后第1章第2关状态为 locked', () => {
    system.initProgress();
    expect(system.getStageStatus('chapter1_stage2')).toBe('locked');
  });

  it('initProgress 后总星数为0', () => {
    system.initProgress();
    expect(system.getTotalStars()).toBe(0);
  });

  it('initProgress 后当前章节为 chapter1', () => {
    system.initProgress();
    const chapter = system.getCurrentChapter();
    expect(chapter).not.toBeNull();
    expect(chapter!.id).toBe('chapter1');
  });

  it('initProgress 后所有关卡通关次数为0', () => {
    system.initProgress();
    for (const ch of getChapters()) {
      for (const st of ch.stages) {
        expect(system.getClearCount(st.id)).toBe(0);
      }
    }
  });

  it('reset 等同于 initProgress', () => {
    system.completeStage('chapter1_stage1', 3);
    expect(system.getTotalStars()).toBe(3);

    system.reset();
    expect(system.getTotalStars()).toBe(0);
    expect(system.getStageStatus('chapter1_stage1')).toBe('available');
  });

  it('update 不抛异常', () => {
    expect(() => system.update(0.016)).not.toThrow();
  });

  it('getState 返回进度数据', () => {
    const state = system.getState();
    expect(state).toHaveProperty('currentChapterId');
    expect(state).toHaveProperty('stageStates');
  });
});

// ─────────────────────────────────────────────
// 2. 关卡状态查询
// ─────────────────────────────────────────────

describe('CampaignProgressSystem 状态查询', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = new CampaignProgressSystem(dataProvider);
  });

  it('不存在的关卡状态为 locked', () => {
    expect(system.getStageStatus('nonexistent')).toBe('locked');
  });

  it('不存在的关卡星级为0', () => {
    expect(system.getStageStars('nonexistent')).toBe(0);
  });

  it('canChallenge 对未解锁关卡返回 false', () => {
    expect(system.canChallenge('chapter1_stage2')).toBe(false);
  });

  it('canChallenge 对第1关返回 true', () => {
    expect(system.canChallenge('chapter1_stage1')).toBe(true);
  });

  it('isFirstCleared 初始为 false', () => {
    expect(system.isFirstCleared('chapter1_stage1')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// 3. 通关处理
// ─────────────────────────────────────────────

describe('CampaignProgressSystem 通关处理', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = new CampaignProgressSystem(dataProvider);
  });

  it('1星通关后状态变为 cleared', () => {
    system.completeStage('chapter1_stage1', 1);
    expect(system.getStageStatus('chapter1_stage1')).toBe('cleared');
    expect(system.getStageStars('chapter1_stage1')).toBe(1);
  });

  it('3星通关后状态变为 threeStar', () => {
    system.completeStage('chapter1_stage1', 3);
    expect(system.getStageStatus('chapter1_stage1')).toBe('threeStar');
    expect(system.getStageStars('chapter1_stage1')).toBe(3);
  });

  it('2星通关后状态变为 cleared', () => {
    system.completeStage('chapter1_stage1', 2);
    expect(system.getStageStatus('chapter1_stage1')).toBe('cleared');
    expect(system.getStageStars('chapter1_stage1')).toBe(2);
  });

  it('通关后解锁下一关', () => {
    system.completeStage('chapter1_stage1', 1);
    expect(system.getStageStatus('chapter1_stage2')).toBe('available');
  });

  it('未通关不解锁下一关', () => {
    expect(system.getStageStatus('chapter1_stage2')).toBe('locked');
  });

  it('重复通关星级取最高', () => {
    system.completeStage('chapter1_stage1', 1);
    expect(system.getStageStars('chapter1_stage1')).toBe(1);

    system.completeStage('chapter1_stage1', 3);
    expect(system.getStageStars('chapter1_stage1')).toBe(3);
    expect(system.getStageStatus('chapter1_stage1')).toBe('threeStar');
  });

  it('重复通关星级不降', () => {
    system.completeStage('chapter1_stage1', 3);
    system.completeStage('chapter1_stage1', 1);
    expect(system.getStageStars('chapter1_stage1')).toBe(3);
  });

  it('通关次数累加', () => {
    system.completeStage('chapter1_stage1', 1);
    expect(system.getClearCount('chapter1_stage1')).toBe(1);

    system.completeStage('chapter1_stage1', 2);
    expect(system.getClearCount('chapter1_stage1')).toBe(2);
  });

  it('首通标记正确', () => {
    expect(system.isFirstCleared('chapter1_stage1')).toBe(false);
    system.completeStage('chapter1_stage1', 1);
    expect(system.isFirstCleared('chapter1_stage1')).toBe(true);
  });

  it('不存在的关卡抛出异常', () => {
    expect(() => system.completeStage('nonexistent', 1)).toThrow('关卡不存在');
  });

  it('星级超出范围被截断', () => {
    system.completeStage('chapter1_stage1', 5);
    expect(system.getStageStars('chapter1_stage1')).toBe(3);
  });

  it('负星级被截断为0', () => {
    system.completeStage('chapter1_stage1', -1);
    expect(system.getStageStars('chapter1_stage1')).toBe(0);
  });

  it('通关后 lastClearTime 更新', () => {
    const before = Date.now();
    system.completeStage('chapter1_stage1', 1);
    const progress = system.getProgress();
    expect(progress.lastClearTime).toBeGreaterThanOrEqual(before);
  });
});

// ─────────────────────────────────────────────
// 4. 章节推进 & 跨章节解锁
// ─────────────────────────────────────────────

describe('CampaignProgressSystem 章节推进', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = new CampaignProgressSystem(dataProvider);
  });

  it('通关第1章所有关卡后推进到第2章', () => {
    // 通关第1章全部8关
    for (let i = 1; i <= 8; i++) {
      system.completeStage(`chapter1_stage${i}`, 1);
    }
    const chapter = system.getCurrentChapter();
    expect(chapter).not.toBeNull();
    expect(chapter!.id).toBe('chapter2');
  });

  it('通关第1章BOSS后第2章第1关解锁', () => {
    for (let i = 1; i <= 8; i++) {
      system.completeStage(`chapter1_stage${i}`, 1);
    }
    expect(system.getStageStatus('chapter2_stage1')).toBe('available');
  });

  it('未通关第1章BOSS时第2章锁定', () => {
    for (let i = 1; i <= 7; i++) {
      system.completeStage(`chapter1_stage${i}`, 1);
    }
    expect(system.getStageStatus('chapter2_stage1')).toBe('locked');
  });

  it('通关全部24关后当前章节为第3章', () => {
    for (const ch of getChapters()) {
      for (const st of ch.stages) {
        system.completeStage(st.id, 1);
      }
    }
    const chapter = system.getCurrentChapter();
    expect(chapter!.id).toBe('chapter3');
  });

  it('总星数统计正确', () => {
    system.completeStage('chapter1_stage1', 3);
    system.completeStage('chapter1_stage2', 2);
    system.completeStage('chapter1_stage3', 1);
    expect(system.getTotalStars()).toBe(6);
  });
});

// ─────────────────────────────────────────────
// 5. 序列化 & 反序列化
// ─────────────────────────────────────────────

describe('CampaignProgressSystem 序列化', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = new CampaignProgressSystem(dataProvider);
  });

  it('serialize 返回正确的版本号', () => {
    const data = system.serialize();
    expect(data.version).toBe(1);
  });

  it('serialize/deserialize 往返一致', () => {
    system.completeStage('chapter1_stage1', 3);
    system.completeStage('chapter1_stage2', 2);

    const saved = system.serialize();
    const newSystem = new CampaignProgressSystem(dataProvider);
    newSystem.deserialize(saved);

    expect(newSystem.getStageStars('chapter1_stage1')).toBe(3);
    expect(newSystem.getStageStars('chapter1_stage2')).toBe(2);
    expect(newSystem.getStageStatus('chapter1_stage1')).toBe('threeStar');
    expect(newSystem.getStageStatus('chapter1_stage2')).toBe('cleared');
    expect(newSystem.getStageStatus('chapter1_stage3')).toBe('available');
  });

  it('deserialize 版本不兼容抛出异常', () => {
    const badData = { version: 999, progress: { currentChapterId: '', stageStates: {}, lastClearTime: 0 } };
    expect(() => system.deserialize(badData as CampaignSaveData)).toThrow('存档版本不兼容');
  });

  it('deserialize 兼容新增关卡', () => {
    // 序列化一个只有部分关卡状态的存档
    const partialData: CampaignSaveData = {
      version: 1,
      progress: {
        currentChapterId: 'chapter1',
        stageStates: {
          chapter1_stage1: { stageId: 'chapter1_stage1', stars: 1, firstCleared: true, clearCount: 1 },
        },
        lastClearTime: 1000,
      },
    };

    system.deserialize(partialData);
    // 已通关的关卡
    expect(system.getStageStars('chapter1_stage1')).toBe(1);
    // 未在存档中的关卡应有默认状态
    expect(system.getStageStars('chapter1_stage2')).toBe(0);
  });

  it('deserialize 后 canChallenge 逻辑正确', () => {
    system.completeStage('chapter1_stage1', 3);
    const saved = system.serialize();

    const newSystem = new CampaignProgressSystem(dataProvider);
    newSystem.deserialize(saved);

    expect(newSystem.canChallenge('chapter1_stage1')).toBe(true);
    expect(newSystem.canChallenge('chapter1_stage2')).toBe(true);
    expect(newSystem.canChallenge('chapter1_stage3')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// 6. 边界情况
// ─────────────────────────────────────────────

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
    const mockDeps = { eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } } as any;
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
