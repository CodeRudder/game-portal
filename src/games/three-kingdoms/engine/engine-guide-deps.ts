/**
 * 新手引导子系统依赖注入辅助
 *
 * 从 ThreeKingdomsEngine 中拆分出的引导子系统(v18.0)的
 * 创建、初始化和注册逻辑。
 *
 * @module engine/engine-guide-deps
 */

import { TutorialStateMachine } from './guide/TutorialStateMachine';
import { StoryEventPlayer } from './guide/StoryEventPlayer';
import { TutorialStepManager } from './guide/TutorialStepManager';
import { TutorialStepExecutor } from './guide/TutorialStepExecutor';
import { TutorialMaskSystem } from './guide/TutorialMaskSystem';
import { TutorialStorage } from './guide/TutorialStorage';
import { FirstLaunchDetector } from './guide/FirstLaunchDetector';
import type { SubsystemRegistry } from '../core/engine/SubsystemRegistry';
import type { ISystemDeps } from '../core/types';

// ─────────────────────────────────────────────
// 引导子系统集合
// ─────────────────────────────────────────────

/** v18.0 新手引导子系统集合 */
export interface GuideSystems {
  tutorialStateMachine: TutorialStateMachine;
  storyEventPlayer: StoryEventPlayer;
  tutorialStepManager: TutorialStepManager;
  tutorialStepExecutor: TutorialStepExecutor;
  tutorialMaskSystem: TutorialMaskSystem;
  tutorialStorage: TutorialStorage;
  firstLaunchDetector: FirstLaunchDetector;
}

// ─────────────────────────────────────────────
// 创建引导子系统
// ─────────────────────────────────────────────

/**
 * 创建所有新手引导子系统实例
 */
export function createGuideSystems(): GuideSystems {
  return {
    tutorialStateMachine: new TutorialStateMachine(),
    storyEventPlayer: new StoryEventPlayer(),
    tutorialStepManager: new TutorialStepManager(),
    tutorialStepExecutor: new TutorialStepExecutor(),
    tutorialMaskSystem: new TutorialMaskSystem(),
    tutorialStorage: new TutorialStorage(),
    firstLaunchDetector: new FirstLaunchDetector(),
  };
}

// ─────────────────────────────────────────────
// 注册引导子系统
// ─────────────────────────────────────────────

/**
 * 注册所有新手引导子系统到注册表
 */
export function registerGuideSystems(registry: SubsystemRegistry, systems: GuideSystems): void {
  const r = registry;
  r.register('tutorialStateMachine', systems.tutorialStateMachine);
  r.register('storyEventPlayer', systems.storyEventPlayer);
  r.register('tutorialStepManager', systems.tutorialStepManager);
  r.register('tutorialStepExecutor', systems.tutorialStepExecutor);
  r.register('tutorialMaskSystem', systems.tutorialMaskSystem);
  r.register('tutorialStorage', systems.tutorialStorage);
  r.register('firstLaunchDetector', systems.firstLaunchDetector);
}

// ─────────────────────────────────────────────
// 初始化引导子系统
// ─────────────────────────────────────────────

/**
 * 初始化新手引导子系统
 */
export function initGuideSystems(systems: GuideSystems, deps: ISystemDeps): void {
  systems.tutorialStateMachine.init(deps);
  systems.storyEventPlayer.init(deps);
  systems.tutorialStepManager.init(deps);
  systems.tutorialStepExecutor.init(deps);
  systems.tutorialMaskSystem.init(deps);
  systems.tutorialStorage.init(deps);
  systems.firstLaunchDetector.init(deps);

  // 注入状态机依赖 — TutorialStepManager/StoryEventPlayer/TutorialStorage/FirstLaunchDetector
  // 都需要引用 TutorialStateMachine，通过 setStateMachine 延迟注入避免构造时循环依赖
  const sm = systems.tutorialStateMachine;
  systems.tutorialStepManager.setStateMachine(sm);
  systems.storyEventPlayer.setStateMachine(sm);
  systems.tutorialStorage.setStateMachine(sm);
  systems.firstLaunchDetector.setStateMachine(sm);
}

// ─────────────────────────────────────────────
// 重置引导子系统
// ─────────────────────────────────────────────

/**
 * 重置新手引导子系统
 */
export function resetGuideSystems(systems: GuideSystems): void {
  systems.tutorialStateMachine.reset();
  systems.storyEventPlayer.reset();
  systems.tutorialStepManager.reset();
  systems.tutorialMaskSystem.reset();
  systems.tutorialStorage.reset();
  systems.firstLaunchDetector.reset();
}
