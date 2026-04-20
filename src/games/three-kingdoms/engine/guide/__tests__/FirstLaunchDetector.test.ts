/**
 * FirstLaunchDetector 单元测试
 * 覆盖：#17 首次启动流程、#18 新手保护机制
 */

import type { ISystemDeps } from '../../../core/types';
import { FirstLaunchDetector } from '../FirstLaunchDetector';
import { TutorialStateMachine } from '../TutorialStateMachine';
import type { DeviceHardwareInfo } from '../FirstLaunchDetector';

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

describe('FirstLaunchDetector', () => {
  let detector: FirstLaunchDetector;
  let sm: TutorialStateMachine;
  let deps: ISystemDeps;
  let baseTime: number;

  beforeEach(() => {
    jest.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(baseTime);

    detector = new FirstLaunchDetector();
    sm = new TutorialStateMachine();
    deps = mockDeps();

    sm.init(deps);
    detector.init(deps);
    detector.setStateMachine(sm);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 首次启动检测 (#17)
  // ═══════════════════════════════════════════
  describe('首次启动检测', () => {
    it('初始状态为首次启动', () => {
      const detection = detector.detectFirstLaunch();
      expect(detection.isFirstLaunch).toBe(true);
    });

    it('检测发射 firstLaunchDetected 事件', () => {
      detector.detectFirstLaunch();
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:firstLaunchDetected',
        expect.objectContaining({ isFirstLaunch: true }),
      );
    });

    it('状态机进入 free_play 后不是首次启动', () => {
      sm.enterAsReturning();
      const detection = detector.detectFirstLaunch();
      expect(detection.isFirstLaunch).toBe(false);
    });

    it('检测到语言', () => {
      detector.setLanguageDetector(() => 'en-US');
      const detection = detector.detectFirstLaunch();
      expect(detection.detectedLanguage).toBe('en-US');
    });

    it('默认语言为 zh-CN', () => {
      detector.setLanguageDetector(() => 'zh-CN');
      const detection = detector.detectFirstLaunch();
      expect(detection.detectedLanguage).toBe('zh-CN');
    });
  });

  // ═══════════════════════════════════════════
  // 2. 画质检测 (#17)
  // ═══════════════════════════════════════════
  describe('画质检测', () => {
    it('高端设备推荐高画质', () => {
      detector.setHardwareInfoProvider(() => ({
        cpuCores: 8,
        memoryGB: 16,
        gpuRenderer: 'Adreno 660',
        devicePixelRatio: 3,
      }));
      const detection = detector.detectFirstLaunch();
      expect(detection.recommendedQuality).toBe('high');
    });

    it('中端设备推荐中画质', () => {
      detector.setHardwareInfoProvider(() => ({
        cpuCores: 4,
        memoryGB: 4,
        gpuRenderer: 'Mali-G76',
        devicePixelRatio: 2,
      }));
      const detection = detector.detectFirstLaunch();
      expect(detection.recommendedQuality).toBe('medium');
    });

    it('低端设备推荐低画质', () => {
      detector.setHardwareInfoProvider(() => ({
        cpuCores: 2,
        memoryGB: 2,
        gpuRenderer: 'Mali-T880',
        devicePixelRatio: 1.5,
      }));
      const detection = detector.detectFirstLaunch();
      expect(detection.recommendedQuality).toBe('low');
    });
  });

  // ═══════════════════════════════════════════
  // 3. 首次启动流程 (#17)
  // ═══════════════════════════════════════════
  describe('首次启动流程', () => {
    it('执行完整首次启动流程', async () => {
      const flowState = await detector.executeFirstLaunchFlow();
      expect(flowState.currentStep).toBe('completed');
      expect(flowState.isFirstLaunch).toBe(true);
    });

    it('流程步骤按顺序执行', async () => {
      const steps: string[] = [];

      detector.setLanguageDetector(() => {
        steps.push('detect_language');
        return 'zh-CN';
      });
      detector.setHardwareInfoProvider(() => {
        steps.push('detect_graphics');
        return { cpuCores: 4, memoryGB: 4, gpuRenderer: '', devicePixelRatio: 2 };
      });

      await detector.executeFirstLaunchFlow(async (permissions) => {
        steps.push('request_permissions');
        const result: Record<string, boolean> = {};
        for (const p of permissions) {
          result[p] = true;
        }
        return result as Record<'storage' | 'network' | 'notification' | 'location', boolean>;
      });

      expect(steps).toEqual([
        'detect_language',
        'detect_graphics',
        'request_permissions',
      ]);
    });

    it('流程完成后标记已完成', async () => {
      await detector.executeFirstLaunchFlow();
      expect(detector.isLaunchCompleted()).toBe(true);
    });

    it('流程触发引导', async () => {
      await detector.executeFirstLaunchFlow();
      expect(sm.getCurrentPhase()).toBe('core_guiding');
    });

    it('无权限回调时默认授权', async () => {
      const flowState = await detector.executeFirstLaunchFlow();
      expect(flowState.permissionStatus.storage).toBe(true);
      expect(flowState.permissionStatus.network).toBe(true);
    });

    it('非首次启动跳过流程', async () => {
      sm.enterAsReturning();
      const flowState = await detector.executeFirstLaunchFlow();
      expect(flowState.currentStep).toBe('skipped');
    });
  });

  // ═══════════════════════════════════════════
  // 4. 回归用户处理 (#17)
  // ═══════════════════════════════════════════
  describe('回归用户处理', () => {
    it('handleReturningUser 进入自由游戏', () => {
      detector.handleReturningUser();
      expect(sm.getCurrentPhase()).toBe('free_play');
    });

    it('handleReturningUser 标记非首次启动', () => {
      detector.handleReturningUser();
      const flowState = detector.getFlowState();
      expect(flowState.isFirstLaunch).toBe(false);
    });

    it('handleReturningUser 标记流程完成', () => {
      detector.handleReturningUser();
      expect(detector.isLaunchCompleted()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 新手保护 (#18)
  // ═══════════════════════════════════════════
  describe('新手保护', () => {
    it('首次进入后新手保护激活', async () => {
      await detector.executeFirstLaunchFlow();
      expect(detector.isNewbieProtectionActive()).toBe(true);
    });

    it('获取保护状态', async () => {
      await detector.executeFirstLaunchFlow();
      const state = detector.getProtectionState();
      expect(state.active).toBe(true);
      expect(state.remainingMs).toBe(30 * 60 * 1000);
      expect(state.resourceCostDiscount).toBe(0.5);
      expect(state.battleDifficultyFactor).toBe(0.7);
      expect(state.positiveEventsOnly).toBe(true);
    });

    it('资源消耗折扣', async () => {
      await detector.executeFirstLaunchFlow();
      expect(detector.getResourceCostDiscount()).toBe(0.5);
      expect(detector.applyResourceDiscount(1000)).toBe(500);
    });

    it('战斗难度降低', async () => {
      await detector.executeFirstLaunchFlow();
      expect(detector.getBattleDifficultyFactor()).toBe(0.7);
      expect(detector.applyBattleDifficulty(100)).toBeCloseTo(70);
    });

    it('仅正面事件', async () => {
      await detector.executeFirstLaunchFlow();
      expect(detector.isPositiveEventsOnly()).toBe(true);
    });

    it('30分钟后保护过期', async () => {
      await detector.executeFirstLaunchFlow();
      jest.spyOn(Date, 'now').mockReturnValue(baseTime + 31 * 60 * 1000);
      expect(detector.isNewbieProtectionActive()).toBe(false);
      expect(detector.getResourceCostDiscount()).toBe(1);
      expect(detector.getBattleDifficultyFactor()).toBe(1);
      expect(detector.isPositiveEventsOnly()).toBe(false);
    });

    it('回归用户无新手保护', () => {
      detector.handleReturningUser();
      expect(detector.isNewbieProtectionActive()).toBe(false);
      expect(detector.getResourceCostDiscount()).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 查询 API
  // ═══════════════════════════════════════════
  describe('查询 API', () => {
    it('获取流程状态', () => {
      const state = detector.getFlowState();
      expect(state).toBeDefined();
      expect(state.currentStep).toBeDefined();
    });

    it('获取配置', () => {
      const config = detector.getConfig();
      expect(config.defaultLanguage).toBe('zh-CN');
      expect(config.requiredPermissions).toContain('storage');
      expect(config.requiredPermissions).toContain('network');
    });
  });

  // ═══════════════════════════════════════════
  // 7. 重置
  // ═══════════════════════════════════════════
  describe('重置', () => {
    it('reset 恢复初始状态', async () => {
      await detector.executeFirstLaunchFlow();
      detector.reset();
      expect(detector.isLaunchCompleted()).toBe(false);
    });
  });
});
