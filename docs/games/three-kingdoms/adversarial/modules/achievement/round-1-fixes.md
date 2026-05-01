# Achievement R1 Fixes

> Fixer: AdversarialFixer v1.8 | Time: 2026-05-01
> 模块: achievement | 基于: round-1-verdict.md

## 修复概览

| # | FIX-ID | 挑战 | 严重度 | 状态 | 文件 |
|---|--------|------|--------|------|------|
| 1 | FIX-ACH-402 | C1+C3+C5 | 🔴 P0 | ✅ 已修复 | AchievementSystem.ts:loadSaveData |
| 2 | FIX-ACH-403 | C4 | 🔴 P0 | ✅ 已修复 | AchievementSystem.ts:updateProgress |
| 3 | FIX-ACH-404 | C7 | 🔴 P0 | ✅ 已修复 | AchievementSystem.ts:getSaveData |
| 4 | FIX-ACH-406 | C2 | 🔴 P0 | ✅ 已修复 | AchievementSystem.ts:claimReward |

---

## FIX-ACH-402: loadSaveData 全面防护

**合并修复**: C1(缺失字段崩溃) + C3(NaN穿透) + C5(缺失成就实例)

### 修复内容

```typescript
// 修复前
loadSaveData(data: AchievementSaveData): void {
  if (!data || !data.state) return;
  if (data.version !== ACHIEVEMENT_SAVE_VERSION) return;
  this.state = {
    ...data.state,
    achievements: { ...data.state.achievements },
    dimensionStats: { ...data.state.dimensionStats },
  };
  this.checkChainProgress();
}

// 修复后
loadSaveData(data: AchievementSaveData): void {
  if (!data || !data.state) return;
  if (data.version !== ACHIEVEMENT_SAVE_VERSION) return;

  // 验证关键字段存在
  const s = data.state;
  if (!s.achievements || typeof s.achievements !== 'object') return;
  if (!s.dimensionStats || typeof s.dimensionStats !== 'object') return;

  // 验证 totalPoints 为有限数
  const totalPoints = Number.isFinite(s.totalPoints) && s.totalPoints >= 0
    ? s.totalPoints : 0;

  // 验证每个成就进度的数值合法性
  const achievements: Record<string, AchievementInstance> = {};
  for (const [id, inst] of Object.entries(s.achievements)) {
    if (!inst) continue;
    const progress: Record<string, number> = {};
    for (const [key, val] of Object.entries(inst.progress || {})) {
      progress[key] = (Number.isFinite(val) && val >= 0) ? val : 0;
    }
    achievements[id] = { ...inst, progress };
  }

  // 补全缺失的成就实例
  for (const def of ALL_ACHIEVEMENTS) {
    if (!achievements[def.id]) {
      achievements[def.id] = createAchievementInstance(def);
    }
  }

  this.state = {
    ...s,
    achievements,
    totalPoints,
    dimensionStats: { ...s.dimensionStats },
    completedChains: Array.isArray(s.completedChains) ? [...s.completedChains] : [],
    chainProgress: s.chainProgress && typeof s.chainProgress === 'object' ? { ...s.chainProgress } : {},
  };
  this.checkChainProgress();
}
```

### 防护点

| 攻击向量 | 防护方式 |
|---------|---------|
| data.state.achievements = undefined/null | `typeof !== 'object'` 检查，拒绝加载 |
| data.state.dimensionStats = undefined/null | `typeof !== 'object'` 检查，拒绝加载 |
| data.state.totalPoints = NaN/Infinity/-1 | `Number.isFinite() && >= 0`，fallback 0 |
| data.state.achievements[id].progress[key] = NaN | `Number.isFinite(val) && val >= 0`，fallback 0 |
| data.state.completedChains = undefined | `Array.isArray()` 检查，fallback [] |
| data.state.achievements 缺少某些成就 | 遍历 ALL_ACHIEVEMENTS 补全 |

---

## FIX-ACH-403: updateProgress NaN 进度防护

**挑战**: C4 — 已有 NaN 进度穿透

### 修复内容

```typescript
// 修复前
instance.progress[cond.type] = Math.max(instance.progress[cond.type], value);

// 修复后
const current = instance.progress[cond.type];
const safeCurrent = Number.isFinite(current) ? current : 0;
instance.progress[cond.type] = Math.max(safeCurrent, value);
```

### 防护点

| 攻击向量 | 防护方式 |
|---------|---------|
| progress[type] = NaN（通过 loadSaveData 注入） | `Number.isFinite(current)` 检查，重置为 0 |
| progress[type] = Infinity | 同上，重置为 0 |

### 穿透验证

- ✅ updateProgress 的 value 参数已有 FIX-901 防护
- ✅ 已有进度 NaN 现在有 FIX-ACH-403 防护
- ✅ loadSaveData 的 progress NaN 有 FIX-ACH-402 防护
- 穿透率: 0%（三层防护完整闭环）

---

## FIX-ACH-404: getSaveData 深拷贝

**挑战**: C7 — 浅拷贝引用泄漏

### 修复内容

```typescript
// 修复前
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

// 修复后
getSaveData(): AchievementSaveData {
  const achievements: Record<string, AchievementInstance> = {};
  for (const [id, inst] of Object.entries(this.state.achievements)) {
    achievements[id] = {
      ...inst,
      progress: { ...inst.progress },
    };
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

### 防护点

| 攻击向量 | 防护方式 |
|---------|---------|
| 修改返回值的 instance.progress | 深拷贝 progress 对象 |
| 修改返回值的 instance.status | 浅拷贝 instance（status 是原始类型） |

---

## FIX-ACH-406: claimReward 积分 NaN 验证

**挑战**: C2 — claimReward NaN 穿透到 totalPoints

### 修复内容

```typescript
// 修复前
this.state.totalPoints += def.rewards.achievementPoints;

// 修复后
const points = def.rewards.achievementPoints;
if (!Number.isFinite(points) || points <= 0) {
  return { success: true, reward: def.rewards };
}
this.state.totalPoints += points;
```

### 防护点

| 攻击向量 | 防护方式 |
|---------|---------|
| achievementPoints = NaN | `!Number.isFinite()` 检查，跳过累加 |
| achievementPoints = 0/-1 | `points <= 0` 检查，跳过累加 |
| achievementPoints = Infinity | `!Number.isFinite()` 检查，跳过累加 |

### 设计决策

- 积分异常时仍标记为 claimed（不阻塞用户流程）
- 但不累加异常积分到 totalPoints
- dimStats.totalPoints 同样使用 points 变量（在修复中同步受保护）

---

## 测试更新

### 修正的测试

| 测试 | 修改原因 | 修改内容 |
|------|---------|---------|
| NaN 进度不应破坏系统 | FIX-901 已拦截 NaN，进度保持 0（非 NaN） | 改为验证 progress=0 |
| Infinity 进度应正常完成 | FIX-901 已拦截 Infinity | 改为验证 status=in_progress, progress=0 |

### 测试结果

```
✓ achievement-adversarial.test.ts    72 tests passed
✓ AchievementSystem.test.ts          93 tests passed
✓ AchievementHelpers.test.ts          9 tests passed
─────────────────────────────────────────────────
总计                               174 tests passed
```

---

## 穿透率分析

| 修复 | 底层函数是否也需要防护 | 穿透率 |
|------|----------------------|--------|
| FIX-ACH-402 (loadSaveData) | ✅ 已验证：getState 返回浅拷贝，不影响 | 0% |
| FIX-ACH-403 (updateProgress) | ✅ 已验证：FIX-901 防护 value，FIX-ACH-402 防护来源 | 0% |
| FIX-ACH-404 (getSaveData) | ✅ 已验证：深拷贝后外部修改不影响内部 | 0% |
| FIX-ACH-406 (claimReward) | ✅ 已验证：dimStats.totalPoints 使用同一 points 变量 | 0% |

**总穿透率: 0%**（目标 <10% ✅）

---

## 规则符合性验证

| 规则 | 状态 | 说明 |
|------|------|------|
| BR-001 NaN防护 | ✅ | updateProgress/loadSaveData/claimReward 全覆盖 |
| BR-010 FIX穿透 | ✅ | 穿透率 0% |
| BR-014 保存/加载覆盖 | ✅ | loadSaveData 全面字段验证 |
| BR-017 战斗数值安全 | ✅ | claimReward 积分验证 |
| BR-019 Infinity序列化 | ✅ | loadSaveData 拦截 Infinity progress |
| BR-021 资源比较NaN | N/A | 成就系统无资源比较 |
