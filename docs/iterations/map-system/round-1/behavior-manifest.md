# Round 1 行为清单 — 编队系统

> **日期**: 2026-05-03
> **角色**: Builder

## 1. 现有攻城流程分析

### 攻城入口
- `WorldMapTab.tsx` → 选中敌方城市 → 点击"攻城"按钮 → `SiegeConfirmModal`
- `SiegeSystem.checkSiegeConditions()` 校验条件

### 攻城条件
1. 目标存在且非己方
2. 与己方领土相邻（通过 `TerritorySystem.canAttackTerritory()`）
3. 兵力 ≥ 消耗阈值（基于城防等级）
4. 粮草 ≥ 500（固定消耗）
5. 每日攻城次数 < 3
6. 无占领冷却（24小时）

### 攻城执行
- `SiegeSystem.executeSiege()` → 消耗资源 → 计算胜率 → 随机结果 → 更新领土归属

### 攻城结果
- `SiegeResult` 包含：胜利/失败、消耗、领土变更、失败时兵力损失(30%)

## 2. 武将系统现状

### 武将子系统
- `HeroSystem` - 武将管理
- `HeroRecruitSystem` - 武将招募
- `HeroLevelSystem` - 武将升级
- `HeroStarSystem` - 武将升星
- `AwakeningSystem` - 武将觉醒

### 武将数据模型（推测）
```typescript
interface Hero {
  id: string;
  name: string;
  level: number;
  star: number;
  // ... 其他属性
}
```

### 关键发现
- 武将系统已存在，但**未与攻城系统集成**
- 当前攻城只消耗兵力，不涉及武将
- 需要新增：武将编队、武将状态（受伤）

## 3. 编队系统设计需求

### 数据模型
```typescript
interface ExpeditionForce {
  id: string;
  heroId: string;        // 将领ID（必须）
  troops: number;        // 士兵数量（必须 > 0）
  status: 'ready' | 'marching' | 'fighting' | 'returning';
  targetId?: string;     // 目标领土ID
}
```

### 编队约束
1. 无将领 → HERO_REQUIRED
2. 无士兵 → TROOPS_REQUIRED
3. 将领已在其他编队 → HERO_BUSY
4. 士兵超过可调用量 → INSUFFICIENT_TROOPS

### 与攻城集成
- 攻城前必须先编队
- 编队携带将领+士兵
- 攻城结果影响将领状态（受伤）

## 4. 行为清单

| ID | 行为 | 预期结果 | 假设 |
|----|------|---------|------|
| B-01 | 创建编队（有将领+有士兵） | 成功，返回ExpeditionForce | 将领未在其他编队 |
| B-02 | 创建编队（无将领） | 失败，HERO_REQUIRED | - |
| B-03 | 创建编队（无士兵） | 失败，TROOPS_REQUIRED | - |
| B-04 | 创建编队（将领已编队） | 失败，HERO_BUSY | - |
| B-05 | 创建编队（士兵超量） | 失败，INSUFFICIENT_TROOPS | - |
| B-06 | 编队攻城（胜利） | 领土变更，士兵损失5-15%，将领10%轻伤 | - |
| B-07 | 编队攻城（失败） | 无变更，士兵损失20-40%，将领30%中伤 | - |
| B-08 | 编队攻城（惨败） | 无变更，士兵损失50-80%，将领50%重伤 | - |
| B-09 | 将领受伤状态 | 影响属性，需要恢复 | - |
| B-10 | 解散编队 | 释放将领，士兵返回 | - |
