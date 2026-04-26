# 武将系统迭代完善 — 子任务提示模板

## 任务背景
game-portal项目中的三国霸业游戏正在进行武将系统专项迭代完善。
项目路径: /mnt/user-data/workspace/game-portal

## 关键文档路径
- PRD: docs/games/three-kingdoms/ui-design/prd/HER-heroes-prd.md
- UI设计: docs/games/three-kingdoms/ui-design/ui-layout/HER-heroes.md
- 功能检查清单: docs/games/three-kingdoms/process/hero-feature-checklist.md
- 改进计划: docs/games/three-kingdoms/planning/hero-recruit-improvement-plan.md
- 武将系统设计: docs/games/three-kingdoms/architecture/hero-system-design.md

## 关键引擎文件路径
- HeroSystem: src/games/three-kingdoms/engine/hero/HeroSystem.ts
- HeroRecruitSystem: src/games/three-kingdoms/engine/hero/HeroRecruitSystem.ts
- HeroStarSystem: src/games/three-kingdoms/engine/hero/HeroStarSystem.ts
- HeroLevelSystem: src/games/three-kingdoms/engine/hero/HeroLevelSystem.ts (需确认)
- SkillUpgradeSystem: src/games/three-kingdoms/engine/hero/SkillUpgradeSystem.ts
- HeroFormation: src/games/three-kingdoms/engine/hero/HeroFormation.ts (需确认)
- HeroDispatchSystem: src/games/three-kingdoms/engine/hero/HeroDispatchSystem.ts
- HeroBadgeSystem: src/games/three-kingdoms/engine/hero/HeroBadgeSystem.ts
- FormationRecommendSystem: src/games/three-kingdoms/engine/hero/FormationRecommendSystem.ts
- HeroAttributeCompare: src/games/three-kingdoms/engine/hero/HeroAttributeCompare.ts
- BondSystem: src/games/three-kingdoms/engine/bond/ (目录)

## 测试文件路径
- 武将相关测试: src/games/three-kingdoms/engine/hero/__tests__/
- 武将集成测试: src/games/three-kingdoms/engine/hero/__tests__/integration/

## 注意事项
- 代码文件≤500行，测试脚本≤1000行
- 使用vitest（非Jest）
- 所有文档使用中文
