# Round 2: hero + building + guide 模块盲区扫描

## 扫描结果

### 扫描范围
- hero 模块：27 个源文件（排除 index/types/config/constants）
- building 模块：4 个源文件
- guide 模块：10 个源文件（排除 index/types/config/constants）

### 未覆盖文件发现

| 模块 | 未覆盖文件 | 文件大小 | 说明 |
|------|-----------|---------|------|
| hero | `SkillStrategyRecommender.ts` | 3.3KB | 技能策略推荐子系统 |
| building | `BuildingBatchOps.ts` | 2.9KB | 批量升级操作 |
| building | `BuildingStateHelpers.ts` | 1.3KB | 状态辅助纯函数 |
| building | `BuildingRecommender.ts` | 6.5KB | 建筑升级推荐 |
| guide | `StoryEventPlayer.helpers.ts` | 4.5KB | 剧情播放器辅助函数 |
| guide | `TutorialTransitions.ts` | 2.2KB | 引导状态转换规则 |
| guide | `TutorialStorage.ts` | 8.9KB | 引导状态存储 |

**发现无覆盖文件: 7 个**

### 新增测试文件

| 测试文件 | 模块 | 测试用例数 |
|----------|------|-----------|
| `hero/__tests__/SkillStrategyRecommender.test.ts` | hero | 21 |
| `building/__tests__/BuildingBatchOps.test.ts` | building | 14 |
| `building/__tests__/BuildingStateHelpers.test.ts` | building | 19 |
| `building/__tests__/BuildingRecommender.test.ts` | building | 23 |
| `guide/__tests__/StoryEventPlayer.helpers.test.ts` | guide | 25 |
| `guide/__tests__/TutorialTransitions.test.ts` | guide | 20 |
| `guide/__tests__/TutorialStorage.test.ts` | guide | 30 |

**新增测试文件: 7 个**
**新增测试用例: 152 个**

### 测试覆盖维度

| 文件 | 正常路径 | 边界条件 | 异常路径 |
|------|---------|---------|---------|
| SkillStrategyRecommender | ✅ 策略推荐、技能类型、属性侧重 | ✅ 无效context回退、空输入 | — |
| BuildingBatchOps | ✅ 单个/多个升级、资源扣减 | ✅ 空列表、多失败原因合并 | ✅ 异常捕获、非Error对象 |
| BuildingStateHelpers | ✅ 外观阶段、初始状态、全量映射 | ✅ 等级0、负数等级、边界值 | — |
| BuildingRecommender | ✅ 三阶段推荐、优先级排序 | ✅ 全满级、无效context | ✅ 资源不足降级 |
| StoryEventPlayer.helpers | ✅ 初始状态、定义查找、打字机、自动播放 | ✅ null eventId、越界行、dtMs不足 | — |
| TutorialTransitions | ✅ 转换规则、目标映射、一致性 | — | — |
| TutorialStorage | ✅ 保存/加载/恢复/冲突解决/重置 | ✅ 无存档、损坏数据、缺失字段 | ✅ JSON解析失败 |

## 发现的问题

### BUG-P0: SkillStrategyRecommender.recommendStrategy 浅拷贝导致数据污染

- **文件**: `engine/hero/SkillStrategyRecommender.ts`
- **严重程度**: P0（阻塞级）
- **复现步骤**:
  1. 调用 `recommender.recommendStrategy('burn-heavy')` 获取 result1
  2. 修改 `result1.prioritySkillTypes.push('faction')`
  3. 再次调用 `recommender.recommendStrategy('burn-heavy')` 获取 result2
  4. result2.prioritySkillTypes 包含被污染的 'faction'
- **预期结果**: result2.prioritySkillTypes 应为 `['passive', 'active']`
- **实际结果**: result2.prioritySkillTypes 为 `['passive', 'active', 'faction']`
- **根因**: `recommendStrategy` 使用 `{ ...STRATEGY_CONFIG[enemyType] }` 浅拷贝，嵌套数组 `prioritySkillTypes` 和 `focusStats` 仍与内部常量 `STRATEGY_CONFIG` 共享引用
- **建议修复**:
  ```typescript
  recommendStrategy(enemyType: EnemyType): StrategyRecommendation {
    const config = STRATEGY_CONFIG[enemyType];
    return {
      ...config,
      prioritySkillTypes: [...config.prioritySkillTypes],
      focusStats: [...config.focusStats],
    };
  }
  ```
- **测试标记**: `SkillStrategyRecommender.test.ts` 中 `【BUG】返回的策略结果中嵌套数组与内部配置共享引用` 测试用例验证了此 Bug

## 评估指标

### hero 模块 BSI
- **Round 1**: 未覆盖文件 1 个 (SkillStrategyRecommender)
- **Round 2**: 新增 21 个测试用例覆盖
- **hero 模块 BSI**: 94% → 100% (源文件级全覆盖)

### building 模块 BSI
- **Round 1**: 未覆盖文件 3 个 (BuildingBatchOps, BuildingStateHelpers, BuildingRecommender)
- **Round 2**: 新增 56 个测试用例覆盖
- **building 模块 BSI**: 25% → 100% (源文件级全覆盖)

### guide 模块 BSI
- **Round 1**: 未覆盖文件 3 个 (StoryEventPlayer.helpers, TutorialTransitions, TutorialStorage)
- **Round 2**: 新增 75 个测试用例覆盖
- **guide 模块 BSI**: 70% → 100% (源文件级全覆盖)

## 运行验证

```
✓ 63 test files passed
✓ 1909 test cases passed (含新增 152 个)
✓ 0 regressions
Duration: 18.83s
```
