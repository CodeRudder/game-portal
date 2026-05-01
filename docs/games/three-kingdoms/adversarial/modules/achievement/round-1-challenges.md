# Achievement R1 Challenges

> Challenger: AdversarialChallenger v1.8 | Time: 2026-05-01
> 模块: achievement | 基于树: round-1-tree.md

## 5维度挑战评分

| 维度 | 节点数 | challenged | 通过 | 失败 | 通过率 |
|------|--------|------------|------|------|--------|
| F-Normal | 42 | 0 | 42 | 0 | 100% |
| F-Error | 8 | 2 | 6 | 2 | 75% |
| F-Boundary | 18 | 4 | 14 | 4 | 78% |
| F-Cross | 12 | 1 | 11 | 1 | 92% |
| F-Lifecycle | 14 | 5 | 9 | 5 | 64% |
| **总计** | **94** | **12** | **82** | **12** | **87%** |

---

## Challenge 1: loadSaveData 缺失字段导致运行时崩溃

**维度**: F-Lifecycle | **严重度**: 🔴 P0 | **节点**: AS-141, AS-142, AS-143

### 问题描述

`loadSaveData(data)` 在 FIX-904 中仅添加了 `!data || !data.state` 的顶层防护，但未验证 `data.state` 内部字段的完整性：

1. **AS-141**: `data.state.achievements` 为空对象 `{}` → 所有成就实例丢失 → 后续 `getAchievement()` 返回 createAchievementInstance 新实例（progress=0），已完成的成就回退
2. **AS-142**: `data.state.completedChains` 为 `undefined` → `this.state.completedChains` 被设为 undefined → 后续 `includes()` 调用崩溃
3. **AS-143**: `data.state.dimensionStats` 为 `undefined` → `dimStats` 为 undefined → `claimReward` 中 `dimStats.completedCount++` 崩溃

### 复现路径

```typescript
const sys = createSystem();
// 完成一些成就
progressToComplete(sys, 'ach-battle-001');
sys.claimReward('ach-battle-001');

// 构造缺失字段的存档
const badData = {
  state: { totalPoints: 10 }, // 缺少 achievements, completedChains, dimensionStats
  version: 1,
};
sys.loadSaveData(badData);
// loadSaveData 通过了 !data && !data.state 检查
// this.state.completedChains = undefined
sys.getCompletedChains(); // → undefined.includes → 💥 TypeError
```

### 修复建议

```typescript
loadSaveData(data: AchievementSaveData): void {
  if (!data || !data.state) return;
  if (data.version !== ACHIEVEMENT_SAVE_VERSION) return;

  // 验证关键字段存在
  const s = data.state;
  if (!s.achievements || !s.dimensionStats || !Array.isArray(s.completedChains)) {
    return; // 关键字段缺失，拒绝加载
  }

  this.state = { ... };
  this.checkChainProgress();
}
```

### 影响评估

- **攻击面**: 存档文件可被用户篡改，删除关键字段
- **影响范围**: 所有依赖 state 内部结构的后续操作
- **现有测试**: ❌ 无缺失字段测试

---

## Challenge 2: claimReward NaN 穿透到 totalPoints 和 dimStats

**维度**: F-Error | **严重度**: 🔴 P0 | **节点**: AS-079, AS-080

### 问题描述

`claimReward` 中直接累加 `achievementPoints` 到 `totalPoints` 和 `dimStats.totalPoints`，未验证积分值是否为有限数：

```typescript
// AchievementSystem.ts:claimReward
this.state.totalPoints += def.rewards.achievementPoints;  // 无 NaN 检查
dimStats.totalPoints += def.rewards.achievementPoints;      // 无 NaN 检查
```

虽然配置文件中 `achievementPoints` 都是硬编码正整数，但通过 `loadSaveData` 加载被篡改的存档后，`ACHIEVEMENT_DEF_MAP` 中的定义可能被间接影响（如果 ALL_ACHIEVEMENTS 被修改），或者未来配置动态加载时可能引入 NaN。

### 复现路径

```typescript
// 通过 loadSaveData 注入 NaN 进度，触发 checkCompletion
const sys = createSystem();
const badData = {
  state: {
    achievements: {
      'ach-battle-001': {
        defId: 'ach-battle-001',
        status: 'completed',
        progress: { battle_wins: 10 },
        completedAt: 1,
        claimedAt: null,
      }
    },
    totalPoints: 0,
    dimensionStats: createInitialState().dimensionStats,
    completedChains: [],
    chainProgress: {},
  },
  version: 1,
};
sys.loadSaveData(badData);
sys.claimReward('ach-battle-001');
// totalPoints += 10 → 安全（因为 ACHIEVEMENT_DEF_MAP 是静态的）

// 但如果通过原型污染修改 ACHIEVEMENT_DEF_MAP：
// Object.defineProperty(ACHIEVEMENT_DEF_MAP['ach-battle-001'].rewards, 'achievementPoints', { value: NaN });
// sys.claimReward('ach-battle-001') → totalPoints = NaN
```

### 修复建议

```typescript
// claimReward 中添加积分验证
const points = def.rewards.achievementPoints;
if (!Number.isFinite(points) || points <= 0) {
  return { success: false, reason: '成就奖励配置异常' };
}
this.state.totalPoints += points;
dimStats.totalPoints += points;
```

### 影响评估

- **攻击面**: 配置注入/原型污染 + 存档篡改
- **影响范围**: totalPoints 影响所有积分相关 UI 和排行榜
- **现有测试**: ❌ 无 NaN 积分测试
- **防御深度**: 即使当前硬编码安全，也应添加防御层（规则17: 战斗数值安全）

---

## Challenge 3: loadSaveData NaN 穿透到 totalPoints 和 progress

**维度**: F-Lifecycle | **严重度**: 🔴 P0 | **节点**: AS-138, AS-139

### 问题描述

`loadSaveData` 恢复 state 时未验证数值字段的合法性：

```typescript
// AchievementSystem.ts:loadSaveData
this.state = {
  ...data.state,
  achievements: { ...data.state.achievements },
  dimensionStats: { ...data.state.dimensionStats },
};
```

1. `data.state.totalPoints = NaN` → 直接赋值 → `getTotalPoints()` 返回 NaN
2. `data.state.achievements[id].progress[type] = NaN` → 后续 `Math.max(NaN, validValue)` = NaN → 进度永远无法完成

### 复现路径

```typescript
const sys = createSystem();
const state = createInitialState();
state.totalPoints = NaN;
state.achievements['ach-battle-001'].progress['battle_wins'] = NaN;

const badData = { state, version: 1 };
sys.loadSaveData(badData);

sys.getTotalPoints(); // → NaN
sys.updateProgress('battle_wins', 10);
// Math.max(NaN, 10) = NaN → ach-battle-001 永远无法完成
```

### 修复建议

```typescript
loadSaveData(data: AchievementSaveData): void {
  if (!data || !data.state) return;
  if (data.version !== ACHIEVEMENT_SAVE_VERSION) return;

  // 验证 totalPoints
  const totalPoints = Number.isFinite(data.state.totalPoints) ? data.state.totalPoints : 0;

  // 验证每个成就的 progress
  const achievements: Record<string, AchievementInstance> = {};
  for (const [id, inst] of Object.entries(data.state.achievements)) {
    if (!inst) continue;
    const progress: Record<string, number> = {};
    for (const [key, val] of Object.entries(inst.progress || {})) {
      progress[key] = Number.isFinite(val) ? val : 0;
    }
    achievements[id] = { ...inst, progress };
  }

  this.state = {
    ...data.state,
    achievements,
    totalPoints: Math.max(0, totalPoints),
    dimensionStats: { ...data.state.dimensionStats },
    completedChains: Array.isArray(data.state.completedChains) ? [...data.state.completedChains] : [],
  };
  this.checkChainProgress();
}
```

### 影响评估

- **攻击面**: 存档文件直接可编辑
- **影响范围**: 所有依赖 totalPoints 和 progress 的功能
- **现有测试**: ❌ 无 NaN 存档测试

---

## Challenge 4: updateProgress 已有 NaN 进度穿透

**维度**: F-Boundary | **严重度**: 🔴 P0 | **节点**: AS-051

### 问题描述

`updateProgress` 中使用 `Math.max` 更新进度：

```typescript
instance.progress[cond.type] = Math.max(instance.progress[cond.type], value);
```

如果 `instance.progress[cond.type]` 已经是 NaN（通过 loadSaveData 注入），则 `Math.max(NaN, validValue)` = NaN，进度永远无法恢复。

虽然 FIX-901 防护了 `value` 参数的 NaN，但未防护已有进度的 NaN。

### 复现路径

```typescript
const sys = createSystem();
// 通过存档注入 NaN 进度
const state = createInitialState();
state.achievements['ach-battle-001'].progress['battle_wins'] = NaN;
sys.loadSaveData({ state, version: 1 });

// 正常更新进度
sys.updateProgress('battle_wins', 10);
// Math.max(NaN, 10) = NaN → 进度仍为 NaN
// ach-battle-001 永远无法完成
```

### 修复建议

```typescript
// updateProgress 中添加已有进度 NaN 防护
for (const cond of def.conditions) {
  if (cond.type === conditionType) {
    const current = instance.progress[cond.type];
    // 如果当前进度为 NaN，重置为 0
    const safeCurrent = Number.isFinite(current) ? current : 0;
    instance.progress[cond.type] = Math.max(safeCurrent, value);
  }
}
```

### 影响评估

- **攻击面**: loadSaveData + updateProgress 链式攻击
- **影响范围**: 所有成就的进度更新
- **现有测试**: ❌ 无 NaN 进度穿透测试

---

## Challenge 5: createInitialState 未知维度崩溃

**维度**: F-Normal | **严重度**: 🔴 P0 | **节点**: AH-009

### 问题描述

`createInitialState` 硬编码了5个维度的 `dimensionStats`：

```typescript
const dimensionStats: Record<string, DimensionStats> = {
  battle: { ... },
  building: { ... },
  collection: { ... },
  social: { ... },
  rebirth: { ... },
};

for (const def of ALL_ACHIEVEMENTS) {
  achievements[def.id] = createAchievementInstance(def);
  const dim = dimensionStats[def.dimension];
  if (dim) dim.totalCount++;  // if(dim) 保护
}
```

虽然 `if (dim)` 提供了基本防护，但新增维度时 `totalCount` 不会累加，导致该维度统计丢失。这不是崩溃问题（因为有 `if(dim)` 保护），但会导致新维度成就完全不在统计中。

**修正**: 重新评估后，由于 `if (dim)` 保护，不会崩溃，但会静默丢失数据。降级为 P1。

### 影响评估

- **攻击面**: 配置扩展时遗漏
- **影响范围**: 新维度成就统计丢失
- **现有测试**: ❌ 无未知维度测试

---

## Challenge 6: 事件监听器测试覆盖不足

**维度**: F-Cross | **严重度**: 🟡 P1 | **节点**: AS-120~AS-128

### 问题描述

`setupEventListeners` 注册了5个事件监听器，但仅 `prestige:levelUp` 有直接测试。其余4个（battle:completed, building:upgraded, hero:recruited, rebirth:completed）仅通过 `updateProgress` 间接覆盖。

关键风险点：
1. `battle:completed` 事件中 `p.wins` 为 `undefined` → `if(p.wins)` 跳过（安全）
2. `hero:recruited` 事件中 `p.count` 为 `NaN` → `if(NaN)` 为 false，跳过（安全）
3. `rebirth:completed` 事件中 `p.count` 为 `0` → `if(0)` 为 false，跳过（可能非预期）

### 修复建议

为所有5个事件监听器添加直接测试，验证：
- 正常 payload 触发 updateProgress
- undefined/NaN/0 payload 安全处理

### 影响评估

- **攻击面**: 事件总线 payload 注入
- **影响范围**: 成就进度更新
- **现有测试**: ⚠️ 仅1/5有直接测试

---

## Challenge 7: getSaveData 浅拷贝导致 AchievementInstance 共享引用

**维度**: F-Lifecycle | **严重度**: 🟡 P1 | **节点**: AS-131

### 问题描述

`getSaveData` 中对 `achievements` 使用浅拷贝：

```typescript
getSaveData(): AchievementSaveData {
  return {
    state: {
      ...this.state,
      achievements: { ...this.state.achievements },
      dimensionStats: { ...this.state.dimensionStats },
    },
    version: ACHIEVEMENT_SAVE_VERSION,
  };
}
```

`{ ...this.state.achievements }` 创建新的 Record，但每个 `AchievementInstance` 仍是同一引用。外部修改 `instance.progress` 会影响内部状态。

### 复现路径

```typescript
const sys = createSystem();
const saved = sys.getSaveData();
const inst = saved.state.achievements['ach-battle-001'];
inst.progress['battle_wins'] = 999;
inst.status = 'completed';

// 内部状态被修改
const ach = sys.getAchievement('ach-battle-001');
expect(ach.instance.progress['battle_wins']).toBe(999); // 通过！内部被篡改
```

### 修复建议

```typescript
getSaveData(): AchievementSaveData {
  const achievements: Record<string, AchievementInstance> = {};
  for (const [id, inst] of Object.entries(this.state.achievements)) {
    achievements[id] = { ...inst, progress: { ...inst.progress } };
  }
  return {
    state: {
      ...this.state,
      achievements,
      dimensionStats: { ...this.state.dimensionStats },
    },
    version: ACHIEVEMENT_SAVE_VERSION,
  };
}
```

### 影响评估

- **攻击面**: getSaveData 返回值被修改
- **影响范围**: 成就进度和状态可被外部篡改
- **现有测试**: ❌ 无存档数据隔离测试

---

## Challenge 8: loadSaveData 缺失成就实例导致状态不一致

**维度**: F-Lifecycle | **严重度**: 🔴 P0 | **节点**: AS-141

### 问题描述

如果 `data.state.achievements` 中缺少某些成就ID，`loadSaveData` 会直接使用传入的 achievements（浅拷贝），导致部分成就实例丢失。

后续 `getAllAchievements` 中通过 `this.state.achievements[def.id] ?? createAchievementInstance(def)` 创建新实例，但这个新实例的 progress=0，与存档前的状态不一致。

### 复现路径

```typescript
const sys = createSystem();
progressToComplete(sys, 'ach-battle-001');
sys.claimReward('ach-battle-001');
expect(sys.getTotalPoints()).toBe(10);

// 构造缺失 ach-battle-001 的存档
const state = createInitialState();
delete state.achievements['ach-battle-001'];
state.totalPoints = 10; // totalPoints 保留但成就实例丢失

sys.loadSaveData({ state, version: 1 });
// this.state.achievements 中没有 ach-battle-001
// getTotalPoints() = 10，但 ach-battle-001 的 instance 是新建的（progress=0, status=in_progress）
// 状态不一致：积分显示10分，但对应成就显示未完成
```

### 修复建议

在 `loadSaveData` 中合并缺失的成就实例：

```typescript
// 确保所有成就都有实例
for (const def of ALL_ACHIEVEMENTS) {
  if (!achievements[def.id]) {
    achievements[def.id] = createAchievementInstance(def);
  }
}
```

### 影响评估

- **攻击面**: 存档篡改删除特定成就
- **影响范围**: 成就状态与积分不一致
- **现有测试**: ❌ 无缺失成就测试

---

## Challenge 9: rebirth:completed 事件 count=0 被跳过

**维度**: F-Boundary | **严重度**: 🟡 P1 | **节点**: AS-125

### 问题描述

`rebirth:completed` 事件监听器使用 `if(p.count)` 检查：

```typescript
this.deps.eventBus.on<{ count: number }>('rebirth:completed', (p) => {
  this.updateProgress('rebirth_count', p.count);
});
```

如果 `p.count = 0`（理论上不应发生，但防御性编程应考虑），`if(0)` 为 false，不触发更新。但 `ach-rebirth-001` 的 targetValue=1，所以 count=0 即使触发也不会完成。

**降级**: 这不是真正的bug，因为 count=0 没有实际意义。但与其他事件处理器的模式不一致（`battle:completed` 用 `p.wins` 也是 `if` 检查）。

### 影响评估

- **严重度**: 🟢 信息级，无需修复
- **建议**: 统一事件 payload 检查模式

---

## Challenge 10: reset() 不清空 rewardCallback

**维度**: F-Lifecycle | **严重度**: 🟡 P1 | **节点**: AS-010

### 问题描述

`reset()` 清理了事件监听器和状态，但未重置 `rewardCallback`。在测试环境中，如果同一个系统实例被 reset 后重新使用，旧的 callback 可能引用已失效的上下文。

```typescript
reset(): void {
  for (const unsub of this.eventUnsubscribers) {
    try { unsub(); } catch (_e) { /* 忽略 */ }
  }
  this.eventUnsubscribers = [];
  this.state = createInitialState();
  this.chainProgress = initChainProgress();
  // rewardCallback 未清空
}
```

### 影响评估

- **严重度**: 🟡 P1，生产环境中 reset 后通常需要重新 init + setRewardCallback
- **建议**: 在 reset 中添加 `this.rewardCallback = undefined;`

---

## Challenge 11: checkChainProgress 链奖励 NaN 穿透

**维度**: F-Boundary | **严重度**: 🟡 P1 | **节点**: AS-100

### 问题描述

`checkChainProgress` 中链完成奖励通过 `rewardCallback(chainBonusReward)` 发放，但未验证 `chainBonusReward` 的内容是否合法。如果配置被篡改（原型污染），`chainBonusReward.achievementPoints` 可能为 NaN。

注意：链奖励不累加到 `state.totalPoints`（仅通过 callback 发放），所以不影响内部积分。但会影响接收方（如资源系统）。

### 影响评估

- **严重度**: 🟡 P1，依赖外部配置安全性
- **建议**: 在 rewardCallback 调用前验证奖励内容

---

## Challenge 12: loadSaveData 不恢复 chainProgress

**维度**: F-Lifecycle | **严重度**: 🟡 P1 | **节点**: AS-144

### 问题描述

`loadSaveData` 恢复 state 后调用 `checkChainProgress()` 重建链进度，但不恢复 `this.chainProgress`。这意味着：

1. `getAchievementChains()` 返回的 `progress` 是基于当前 state 重建的，应该是正确的
2. 但 `this.chainProgress` 不从存档恢复，如果存档中有 `chainProgress` 字段，它会被忽略

实际上 `checkChainProgress()` 会正确重建 `this.chainProgress`，所以这不是数据丢失问题。但如果未来 `chainProgress` 包含非重建可得的信息（如时间戳），就会丢失。

### 影响评估

- **严重度**: 🟢 信息级，当前实现正确
- **建议**: 文档化 chainProgress 不持久化的设计决策

---

## 挑战结果汇总

| # | 挑战 | 严重度 | 维度 | 判定 | 需修复 |
|---|------|--------|------|------|--------|
| C1 | loadSaveData 缺失字段崩溃 | 🔴 P0 | F-Lifecycle | ❌ 失败 | ✅ 是 |
| C2 | claimReward NaN 穿透 | 🔴 P0 | F-Error | ❌ 失败 | ✅ 是 |
| C3 | loadSaveData NaN 穿透 | 🔴 P0 | F-Lifecycle | ❌ 失败 | ✅ 是 |
| C4 | updateProgress NaN 穿透 | 🔴 P0 | F-Boundary | ❌ 失败 | ✅ 是 |
| C5 | createInitialState 未知维度 | 🟡 P1 | F-Normal | ⚠️ 降级 | ❌ 否 |
| C6 | 事件监听器覆盖不足 | 🟡 P1 | F-Cross | ⚠️ 警告 | ❌ 否 |
| C7 | getSaveData 浅拷贝引用泄漏 | 🟡 P1 | F-Lifecycle | ❌ 失败 | ✅ 是 |
| C8 | loadSaveData 缺失成就实例 | 🔴 P0 | F-Lifecycle | ❌ 失败 | ✅ 是 |
| C9 | rebirth:completed count=0 | 🟢 信息 | F-Boundary | ✅ 通过 | ❌ 否 |
| C10 | reset 不清空 callback | 🟡 P1 | F-Lifecycle | ⚠️ 警告 | ❌ 否 |
| C11 | 链奖励 NaN 穿透 | 🟡 P1 | F-Boundary | ⚠️ 警告 | ❌ 否 |
| C12 | chainProgress 不持久化 | 🟢 信息 | F-Lifecycle | ✅ 通过 | ❌ 否 |

### P0 失败项（需修复）

1. **C1**: loadSaveData 缺失字段 → 运行时崩溃
2. **C2**: claimReward NaN → totalPoints/dimStats 污染
3. **C3**: loadSaveData NaN → 进度永久损坏
4. **C4**: updateProgress NaN 穿透 → 已有进度无法恢复
5. **C7**: getSaveData 浅拷贝 → 外部可篡改内部状态
6. **C8**: loadSaveData 缺失成就 → 状态不一致
