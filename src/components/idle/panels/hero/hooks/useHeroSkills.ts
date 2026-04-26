/**
 * useHeroSkills — 技能数据 + 升级操作 Hook
 *
 * 职责：
 * - 获取当前选中武将的技能列表
 * - 提供技能书和铜钱数量
 * - 提供技能升级操作方法
 *
 * @module components/idle/panels/hero/hooks/useHeroSkills
 */

import { useMemo, useCallback } from 'react';
import type { SkillData } from '@/games/three-kingdoms/engine';
import type { SkillUpgradeCost, SkillUnlockCondition } from '../SkillUpgradePanel';
import type { UseHeroEngineParams, UseHeroSkillsReturn } from './hero-hook.types';
import { UPGRADE_COST_TABLE, DEFAULT_COST } from './hero-constants';

/**
 * 安全获取技能冷却时间
 *
 * 引擎 SkillData 接口不包含 cooldown 字段，
 * 但运行时部分技能数据可能携带 cooldown 属性。
 * 使用 in 操作符检测，避免类型断言。
 */
function getSkillCooldown(skill: SkillData): number {
  if ('cooldown' in skill && typeof skill.cooldown === 'number') {
    return skill.cooldown;
  }
  // 默认冷却：主动技能 8 秒，被动技能 0 秒
  return skill.type === 'active' ? 8 : 0;
}

/**
 * 技能数据 + 升级操作 Hook
 *
 * 根据选中武将ID获取技能详情，并提供升级操作。
 * 技能解锁条件与突破阶段关联，消耗与引擎对齐。
 */
export function useHeroSkills(params: UseHeroEngineParams): UseHeroSkillsReturn {
  const { engine, snapshotVersion, selectedHeroId } = params;

  // ── 技能数据 ──
  const skills = useMemo(() => {
    if (!selectedHeroId) return [];
    try {
      const general = engine.getGeneral(selectedHeroId);
      if (!general) return [];

      const heroStarSystem = engine.getHeroStarSystem();

      return (general.skills ?? []).map((skill, index) => {
        const levelCap = heroStarSystem
          ? heroStarSystem.getLevelCap(selectedHeroId)
          : 100;
        const skillCap = Math.min(5, Math.floor(levelCap / 10));

        // 判断是否解锁（突破阶段检查）
        const breakthroughStage = heroStarSystem?.getBreakthroughStage?.(selectedHeroId) ?? 0;
        const unlockStage = index >= 3 ? index - 2 : 0;
        const unlocked = breakthroughStage >= unlockStage;

        // 消耗
        const costTable = UPGRADE_COST_TABLE[skill.level] ?? DEFAULT_COST;
        const upgradeCost: SkillUpgradeCost = {
          skillBook: costTable.skillBook,
          gold: costTable.copper,
        };

        const cooldown = getSkillCooldown(skill);

        const unlockCondition: SkillUnlockCondition | undefined = !unlocked ? {
          breakthroughStage: unlockStage,
          description: `突破阶段 ${unlockStage} 解锁`,
        } : undefined;

        return {
          ...skill,
          upgradeCost,
          levelCap: skillCap,
          unlocked: index < 2 || unlocked,
          unlockCondition,
          cooldown,
        };
      });
    } catch {
      return [];
    }
  }, [engine, selectedHeroId, snapshotVersion]);

  // ── 资源数量 ──
  const skillBookAmount = useMemo(() => {
    try {
      const resource = engine.resource;
      return resource?.getAmount?.('skillBook' as any) ?? 0;
    } catch {
      return 0;
    }
  }, [engine, snapshotVersion]);

  const goldAmount = useMemo(() => {
    try {
      const resource = engine.resource;
      return resource?.getAmount?.('gold') ?? 0;
    } catch {
      return 0;
    }
  }, [engine, snapshotVersion]);

  // ── 升级操作 ──
  const upgradeSkill = useCallback(
    (heroId: string, skillIndex: number) => {
      try {
        const skillSystem = engine.getSkillUpgradeSystem();
        const general = engine.getGeneral(heroId);
        if (!general) return;
        const skill = general.skills[skillIndex];
        if (!skill) return;

        const cost = UPGRADE_COST_TABLE[skill.level] ?? DEFAULT_COST;
        skillSystem.upgradeSkill(heroId, skillIndex, {
          skillBooks: cost.skillBook,
          gold: cost.copper,
        });
      } catch {
        // 引擎操作失败，静默处理
      }
    },
    [engine],
  );

  return {
    skills,
    skillBookAmount,
    goldAmount,
    upgradeSkill,
  };
}
