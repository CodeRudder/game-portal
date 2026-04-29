/**
 * 引导状态存储测试
 *
 * 覆盖：保存/加载、断点续引、冲突解决、重置、首次启动检测
 * 使用 mock TutorialStateMachine 避免依赖真实状态机
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TutorialStorage } from '../TutorialStorage';
import type { TutorialSaveData } from '../../../core/guide';
import { TUTORIAL_SAVE_VERSION } from '../../../core/guide';

// ── Mock TutorialStateMachine ──

function createMockStateMachine() {
  let savedData: TutorialSaveData = {
    version: TUTORIAL_SAVE_VERSION,
    currentPhase: 'not_started',
    completedSteps: [],
    completedEvents: [],
    currentStepId: null,
    currentSubStepIndex: 0,
    tutorialStartTime: null,
    transitionLogs: [],
    dailyReplayCount: 0,
    lastReplayDate: '',
    protectionStartTime: null,
  };

  return {
    serialize: vi.fn(() => ({ ...savedData })),
    loadSaveData: vi.fn((data: TutorialSaveData) => {
      savedData = { ...data };
    }),
    reset: vi.fn(() => {
      savedData = {
        version: TUTORIAL_SAVE_VERSION,
        currentPhase: 'not_started',
        completedSteps: [],
        completedEvents: [],
        currentStepId: null,
        currentSubStepIndex: 0,
        tutorialStartTime: null,
        transitionLogs: [],
        dailyReplayCount: 0,
        lastReplayDate: '',
        protectionStartTime: null,
      };
    }),
    resolveConflict: vi.fn((local: TutorialSaveData, remote: TutorialSaveData) => {
      // 简单并集实现
      const mergedSteps = [...new Set([...local.completedSteps, ...remote.completedSteps])];
      const mergedEvents = [...new Set([...local.completedEvents, ...remote.completedEvents])];
      return {
        ...local,
        completedSteps: mergedSteps,
        completedEvents: mergedEvents,
      };
    }),
  };
}

// ── 测试 ──

describe('TutorialStorage', () => {
  let storage: TutorialStorage;
  let mockSM: ReturnType<typeof createMockStateMachine>;

  beforeEach(() => {
    storage = new TutorialStorage();
    mockSM = createMockStateMachine();
    storage.setStateMachine(mockSM as never);
    localStorage.clear();
  });

  // ── 保存/加载 ──

  describe('save & load', () => {
    it('save 成功并写入 localStorage', () => {
      const result = storage.save();

      expect(result.success).toBe(true);
      expect(localStorage.getItem('three-kingdoms-tutorial-save')).not.toBeNull();
    });

    it('save 后 lastSaveTime 被更新', () => {
      const before = Date.now();
      storage.save();
      const after = Date.now();

      const lastSaveTime = storage.getLastSaveTime();
      expect(lastSaveTime).not.toBeNull();
      expect(lastSaveTime!).toBeGreaterThanOrEqual(before);
      expect(lastSaveTime!).toBeLessThanOrEqual(after);
    });

    it('load 无存档时返回成功但无数据', () => {
      const result = storage.load();

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });

    it('load 有存档时返回数据', () => {
      storage.save();
      const result = storage.load();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.version).toBe(TUTORIAL_SAVE_VERSION);
    });

    it('load 存档格式无效时返回失败', () => {
      localStorage.setItem('three-kingdoms-tutorial-save', 'invalid json');

      const result = storage.load();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('加载失败');
    });

    it('load 存档缺少必要字段时返回失败', () => {
      const badData = { version: 1 }; // 缺少 completedSteps 等字段
      localStorage.setItem('three-kingdoms-tutorial-save', JSON.stringify(badData));

      const result = storage.load();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('格式无效');
    });

    it('load 存档 version 不是数字时返回失败', () => {
      const badData = { version: 'not_a_number', completedSteps: [], completedEvents: [], currentPhase: 'not_started' };
      localStorage.setItem('three-kingdoms-tutorial-save', JSON.stringify(badData));

      const result = storage.load();
      expect(result.success).toBe(false);
    });
  });

  // ── 断点续引 ──

  describe('restore', () => {
    it('无存档时 restore 成功但不恢复数据', () => {
      const result = storage.restore();

      expect(result.success).toBe(true);
      expect(mockSM.loadSaveData).not.toHaveBeenCalled();
    });

    it('有存档时 restore 调用 loadSaveData', () => {
      storage.save();
      const result = storage.restore();

      expect(result.success).toBe(true);
      expect(mockSM.loadSaveData).toHaveBeenCalledTimes(1);
    });

    it('存档损坏时 restore 返回失败', () => {
      localStorage.setItem('three-kingdoms-tutorial-save', 'bad data');

      const result = storage.restore();
      expect(result.success).toBe(false);
    });
  });

  // ── 自动保存 ──

  describe('autoSave', () => {
    it('autoSave 行为与 save 一致', () => {
      const result = storage.autoSave();

      expect(result.success).toBe(true);
      expect(localStorage.getItem('three-kingdoms-tutorial-save')).not.toBeNull();
    });
  });

  // ── 冲突解决 ──

  describe('resolveConflict', () => {
    it('调用状态机的 resolveConflict', () => {
      const local: TutorialSaveData = {
        version: 1,
        currentPhase: 'core_guiding',
        completedSteps: ['step1', 'step2'],
        completedEvents: [],
        currentStepId: 'step3',
        currentSubStepIndex: 0,
        tutorialStartTime: null,
        transitionLogs: [],
        dailyReplayCount: 0,
        lastReplayDate: '',
        protectionStartTime: null,
      };
      const remote: TutorialSaveData = {
        ...local,
        completedSteps: ['step2', 'step3'],
      };

      storage.resolveConflict(local, remote);
      expect(mockSM.resolveConflict).toHaveBeenCalledWith(local, remote);
    });
  });

  // ── mergeRemoteData ──

  describe('mergeRemoteData', () => {
    it('无本地存档时使用空数据合并', () => {
      const remote: TutorialSaveData = {
        version: 1,
        currentPhase: 'free_explore',
        completedSteps: ['step1'],
        completedEvents: [],
        currentStepId: null,
        currentSubStepIndex: 0,
        tutorialStartTime: null,
        transitionLogs: [],
        dailyReplayCount: 0,
        lastReplayDate: '',
        protectionStartTime: null,
      };

      const result = storage.mergeRemoteData(remote);
      expect(result.success).toBe(true);
      expect(mockSM.loadSaveData).toHaveBeenCalled();
    });
  });

  // ── 重置 ──

  describe('fullReset', () => {
    it('清除 localStorage 中的存档', () => {
      storage.save();
      expect(localStorage.getItem('three-kingdoms-tutorial-save')).not.toBeNull();

      storage.fullReset();
      expect(localStorage.getItem('three-kingdoms-tutorial-save')).toBeNull();
    });

    it('调用状态机的 reset', () => {
      storage.fullReset();
      expect(mockSM.reset).toHaveBeenCalledTimes(1);
    });

    it('清除 lastSaveTime', () => {
      storage.save();
      expect(storage.getLastSaveTime()).not.toBeNull();

      storage.fullReset();
      expect(storage.getLastSaveTime()).toBeNull();
    });
  });

  describe('resetStepsOnly', () => {
    it('保留版本号但重置步骤和阶段', () => {
      storage.save();
      storage.resetStepsOnly();

      // 应调用 loadSaveData 并传入重置后的数据
      const lastCall = mockSM.loadSaveData.mock.calls[mockSM.loadSaveData.mock.calls.length - 1];
      const resetData = lastCall[0] as TutorialSaveData;

      expect(resetData.currentPhase).toBe('not_started');
      expect(resetData.completedSteps).toEqual([]);
      expect(resetData.completedEvents).toEqual([]);
      expect(resetData.currentStepId).toBeNull();
      expect(resetData.currentSubStepIndex).toBe(0);
      expect(resetData.tutorialStartTime).toBeNull();
      expect(resetData.transitionLogs).toEqual([]);
      expect(resetData.protectionStartTime).toBeNull();
    });
  });

  // ── 首次启动检测 ──

  describe('detectFirstLaunch', () => {
    it('从未启动过时返回 isFirstLaunch=true', () => {
      localStorage.removeItem('three-kingdoms-first-launch');

      const result = storage.detectFirstLaunch();
      expect(result.isFirstLaunch).toBe(true);
      expect(result.existingData).toBeNull();
    });

    it('已启动过时返回 isFirstLaunch=false', () => {
      localStorage.setItem('three-kingdoms-first-launch', Date.now().toString());

      const result = storage.detectFirstLaunch();
      expect(result.isFirstLaunch).toBe(false);
    });
  });

  describe('markLaunched', () => {
    it('设置首次启动标记', () => {
      localStorage.removeItem('three-kingdoms-first-launch');
      storage.markLaunched();

      expect(localStorage.getItem('three-kingdoms-first-launch')).not.toBeNull();
    });
  });

  describe('clearLaunchMark', () => {
    it('清除首次启动标记', () => {
      localStorage.setItem('three-kingdoms-first-launch', '123');
      storage.clearLaunchMark();

      expect(localStorage.getItem('three-kingdoms-first-launch')).toBeNull();
    });
  });

  // ── 查询 API ──

  describe('hasSaveData', () => {
    it('无存档时返回 false', () => {
      expect(storage.hasSaveData()).toBe(false);
    });

    it('有存档时返回 true', () => {
      storage.save();
      expect(storage.hasSaveData()).toBe(true);
    });

    it('fullReset 后返回 false', () => {
      storage.save();
      storage.fullReset();
      expect(storage.hasSaveData()).toBe(false);
    });
  });

  describe('getSaveDataSize', () => {
    it('无存档时返回 0', () => {
      expect(storage.getSaveDataSize()).toBe(0);
    });

    it('有存档时返回正数', () => {
      storage.save();
      expect(storage.getSaveDataSize()).toBeGreaterThan(0);
    });
  });

  // ── ISubsystem 接口 ──

  describe('ISubsystem 接口', () => {
    it('name 属性为 tutorial-storage', () => {
      expect(storage.name).toBe('tutorial-storage');
    });

    it('init 不抛异常', () => {
      expect(() => {
        storage.init({
          eventBus: { on: () => {}, off: () => {}, emit: () => {} },
          config: { get: () => null, getNumber: () => 0 },
          registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} },
        });
      }).not.toThrow();
    });

    it('update 不抛异常', () => {
      expect(() => storage.update(16)).not.toThrow();
    });

    it('reset 清除 lastSaveTime', () => {
      storage.save();
      storage.reset();
      expect(storage.getLastSaveTime()).toBeNull();
    });
  });
});
