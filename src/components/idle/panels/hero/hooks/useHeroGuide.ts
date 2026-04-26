/**
 * useHeroGuide — 引导操作统一入口 Hook
 *
 * 职责：
 * - 统一新手引导的操作路径
 * - 将引导动作桥接到引擎操作（招募/强化/编队/详情）
 * - 修复引导路径绕过桥接层的问题
 *
 * @module components/idle/panels/hero/hooks/useHeroGuide
 */

import { useCallback } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine';
import type { GuideAction, GuideActionType } from '../GuideOverlay';

/** useHeroGuide 返回类型 */
export interface UseHeroGuideReturn {
  /** 处理引导动作（统一入口） */
  handleGuideAction: (action: GuideAction) => void;
}

/**
 * 引导操作 Hook
 *
 * 将 GuideOverlay 的引导动作统一桥接到引擎操作。
 * 避免在 HeroTab 中直接调用引擎方法，确保引导路径
 * 经过桥接层，便于测试和维护。
 *
 * 所有引擎方法均通过 EngineGettersMixin 提供的类型安全 API 调用，
 * 不使用 `as unknown as` 类型断言。
 */
export function useHeroGuide(engine: ThreeKingdomsEngine): UseHeroGuideReturn {

  const handleGuideAction = useCallback((action: GuideAction) => {
    try {
      switch (action.type as GuideActionType) {
        case 'recruit': {
          // 通过引擎 recruit() API 执行普通招募
          engine.recruit('normal', 1);
          break;
        }
        case 'enhance': {
          // 对第一个武将执行升级
          const generals = engine.getGenerals();
          const firstGeneral = Array.isArray(generals) ? generals[0] : undefined;
          if (firstGeneral) {
            engine.enhanceHero(firstGeneral.id, 1);
          }
          break;
        }
        case 'formation': {
          // 将所有已有武将编入第一个编队
          const generals = engine.getGenerals();
          const allIds = generals.map((g) => g.id);
          if (allIds.length > 0) {
            engine.setFormation('0', allIds.slice(0, 6));
          }
          break;
        }
        case 'detail':
          // 详情查看步骤无需引擎操作
          break;
      }
    } catch {
      // 引擎操作失败时静默处理，不影响引导流程
    }
  }, [engine]);

  return {
    handleGuideAction,
  };
}
