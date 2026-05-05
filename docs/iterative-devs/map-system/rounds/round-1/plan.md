# Round 1 计划

> **迭代**: map-system
> **轮次**: Round 1
> **来源**: `PLAN.md` 目标1 + 对抗性评测
> **日期**: 2026-05-03

## 本轮焦点

| 优先级 | 领域 | 来源 | 原因 |
|:------:|------|------|------|
| P1 | 编队系统核心实现 | PLAN.md 目标1 | 攻城需要编队，编队需将领+士兵 |
| P1 | 编队数据模型 | PLAN.md | 定义ExpeditionForce类型 |
| P1 | 编队UI组件 | PLAN.md | 编队选择界面 |
| P2 | 渲染管线验证 | 已修复 | 城市名字重影修复需验证 |
| P2 | 对抗性评测 | PLAN.md 目标5 | 覆盖编队和攻城流程 |

## 编队系统实现计划

### 1.1 数据模型

```typescript
// core/heroes/types.ts 或新增 core/expedition/types.ts

interface ExpeditionForce {
  id: string;
  heroId: string;        // 将领ID（必须）
  troops: number;        // 士兵数量（必须 > 0）
  status: 'ready' | 'marching' | 'fighting' | 'returning';
}

interface ExpeditionResult {
  success: boolean;
  casualties: {
    troopsLost: number;      // 士兵损失
    heroInjured: boolean;    // 武将是否受伤
    injuryLevel?: 'minor' | 'moderate' | 'severe';
  };
}
```

### 1.2 编队约束验证

- [ ] 无将领 → 返回错误 HERO_REQUIRED
- [ ] 无士兵 → 返回错误 TROOPS_REQUIRED
- [ ] 将领已在其他编队 → 返回错误 HERO_BUSY
- [ ] 士兵超过可调用量 → 返回错误 INSUFFICIENT_TROOPS

### 1.3 编队UI

- [ ] 攻城确认弹窗增加将领选择
- [ ] 显示可用将领列表（排除已编队的）
- [ ] 兵力滑块（0~可调用上限）
- [ ] 编队确认按钮（校验约束后才能点击）

## 对抗性评测重点

- [ ] 边界：编队无将领/无士兵时的行为
- [ ] 数据：将领重复使用时的检测
- [ ] 状态：将领在行军中时能否再次编队
- [ ] 并发：多个编队同时操作的竞态条件

## 质量目标

| 指标 | 目标 |
|------|------|
| P0 | 0 |
| P1 | 0 |
| 测试通过率 | ≥98% |
| 编队系统 | 核心功能可用 |
