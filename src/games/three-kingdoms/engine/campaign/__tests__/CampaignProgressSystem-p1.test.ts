/**
 * 关卡进度系统测试
 *
 * 覆盖：初始化、状态查询、通关处理、解锁逻辑、序列化、ISubsystem接口。
 */

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
    // 通关第1章全部5关
    for (let i = 1; i <= 5; i++) {
      system.completeStage(`chapter1_stage${i}`, 1);
    }
    const chapter = system.getCurrentChapter();
    expect(chapter).not.toBeNull();
    expect(chapter!.id).toBe('chapter2');
  });

  it('通关第1章BOSS后第2章第1关解锁', () => {
    for (let i = 1; i <= 5; i++) {
      system.completeStage(`chapter1_stage${i}`, 1);
    }
    expect(system.getStageStatus('chapter2_stage1')).toBe('available');
  });

  it('未通关第1章BOSS时第2章锁定', () => {
    for (let i = 1; i <= 4; i++) {
      system.completeStage(`chapter1_stage${i}`, 1);
    }
    expect(system.getStageStatus('chapter2_stage1')).toBe('locked');
  });

  it('通关全部30关后当前章节为第6章', () => {
    for (const ch of getChapters()) {
      for (const st of ch.stages) {
        system.completeStage(st.id, 1);
      }
    }
    const chapter = system.getCurrentChapter();
    expect(chapter!.id).toBe('chapter6');
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
});
});
